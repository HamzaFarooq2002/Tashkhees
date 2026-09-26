import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCurrentUserWithOrg } from "@/lib/auth/current-user";
import { loadRubricVersionById } from "@/lib/rubric/loader";
import { computeScore } from "@/lib/scoring/engine";
import type { ScoringResult } from "@/lib/scoring/engine";
import { ActionError, toEntryInput } from "@/server/actions/shared";
import type { ActionResultCode } from "@/server/services/entry-service";

export type SubmitEvaluationResult =
  | { ok: true }
  | { ok: false; code: "INCOMPLETE"; errors: ScoringResult["errors"] }
  | { ok: false; code: ActionResultCode; message: string };

/** REST-facing name for the same concept — "finalize" is not a new operation, see SCORING_DECISIONS.md. */
export const finalizeEvaluation = submitEvaluation;

export async function submitEvaluation(
  evaluationId: string,
  expectedRevision: number
): Promise<SubmitEvaluationResult> {
  const { organization } = await requireCurrentUserWithOrg();

  try {
    const evaluation = await prisma.evaluation.findFirst({
      where: { id: evaluationId, organizationId: organization.id },
    });
    if (!evaluation) throw new ActionError("NOT_FOUND", "Evaluation not found");
    if (evaluation.status === "SUBMITTED") {
      // Repeated submission of an already-submitted evaluation is a no-op success.
      return { ok: true };
    }
    if (evaluation.revision !== expectedRevision) {
      throw new ActionError(
        "STALE_REVISION",
        "This evaluation changed elsewhere since it was loaded. Reload before submitting."
      );
    }

    const rubric = await loadRubricVersionById(evaluation.rubricVersionId);
    const entries = await prisma.evaluationEntry.findMany({ where: { evaluationId } });
    const result = computeScore(rubric, entries.map(toEntryInput));

    if (!result.ok || result.totalScore === null) {
      return { ok: false, code: "INCOMPLETE", errors: result.errors };
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.evaluation.findUniqueOrThrow({ where: { id: evaluationId } });
      if (current.status === "SUBMITTED") return; // race: already submitted by a concurrent request
      if (current.revision !== expectedRevision) {
        throw new ActionError(
          "STALE_REVISION",
          "This evaluation changed elsewhere since it was loaded. Reload before submitting."
        );
      }

      const categoryTotals = result.categories.map((c) => ({
        categoryKey: c.categoryKey,
        name: c.name,
        contribution: c.contribution,
        maxContribution: c.maxContribution,
      }));
      const parameterResults = result.categories.flatMap((c) =>
        c.parameters.map((p) => ({
          categoryKey: c.categoryKey,
          parameterKey: p.parameterKey,
          name: p.name,
          contribution: p.contribution,
          maxContribution: p.maxContribution,
        }))
      );
      const rowResults = result.categories.flatMap((c) => c.parameters.flatMap((p) => p.rows));
      const rowResultsJson = rowResults as unknown as Prisma.InputJsonValue;
      const parameterResultsJson = parameterResults as unknown as Prisma.InputJsonValue;
      const issuesJson = result.issues as unknown as Prisma.InputJsonValue;

      await tx.resultSnapshot.upsert({
        where: { evaluationId },
        create: {
          evaluationId,
          rubricVersionId: rubric.rubricVersionId,
          totalScore: result.totalScore!,
          categoryTotals,
          parameterResults: parameterResultsJson,
          rowResults: rowResultsJson,
          inputRevision: current.revision,
          configHash: rubric.configHash,
          engineVersion: rubric.engineVersion,
          issues: issuesJson,
        },
        update: {
          rubricVersionId: rubric.rubricVersionId,
          totalScore: result.totalScore!,
          categoryTotals,
          parameterResults: parameterResultsJson,
          rowResults: rowResultsJson,
          inputRevision: current.revision,
          configHash: rubric.configHash,
          engineVersion: rubric.engineVersion,
          issues: issuesJson,
        },
      });

      await tx.evaluation.update({
        where: { id: evaluationId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          revision: { increment: 1 },
        },
      });
    });

    return { ok: true };
  } catch (err) {
    if (err instanceof ActionError) {
      return { ok: false, code: err.code as ActionResultCode, message: err.message };
    }
    throw err;
  }
}
