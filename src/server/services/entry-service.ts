import "server-only";
import { ZodError } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCurrentUserWithOrg } from "@/lib/auth/current-user";
import { loadRubricVersionById } from "@/lib/rubric/loader";
import { computeScore } from "@/lib/scoring/engine";
import type { ScoringResult } from "@/lib/scoring/engine";
import { entryInputSchema, evaluationMetaSchema } from "@/lib/validation/evaluation";
import { ActionError, toEntryInput } from "@/server/actions/shared";

export type ActionResultCode = "NOT_FOUND" | "ALREADY_SUBMITTED" | "STALE_REVISION" | "VALIDATION" | "FORBIDDEN";

export type SaveEntryResult =
  | { ok: true; revision: number; progress: ScoringResult }
  | { ok: false; code: ActionResultCode; message: string };

export type SaveMetaResult = { ok: true; revision: number } | { ok: false; code: ActionResultCode; message: string };

/**
 * Atomically claims the next revision of a DRAFT evaluation: one conditional UPDATE both checks
 * ownership/status/revision and bumps the revision (taking the row lock), replacing a separate
 * read → compare → write. Only when nothing matched do we read once more, to report *why*.
 */
async function claimDraftRevision(
  tx: Prisma.TransactionClient,
  evaluationId: string,
  organizationId: string,
  expectedRevision: number,
  data: Prisma.EvaluationUpdateManyMutationInput = {}
): Promise<number> {
  const { count } = await tx.evaluation.updateMany({
    where: { id: evaluationId, organizationId, status: "DRAFT", revision: expectedRevision },
    data: { ...data, revision: { increment: 1 } },
  });
  if (count === 1) return expectedRevision + 1;

  const evaluation = await tx.evaluation.findFirst({
    where: { id: evaluationId, organizationId },
    select: { status: true },
  });
  if (!evaluation) throw new ActionError("NOT_FOUND", "Evaluation not found");
  if (evaluation.status !== "DRAFT") {
    throw new ActionError("ALREADY_SUBMITTED", "Submitted evaluations are read-only");
  }
  throw new ActionError(
    "STALE_REVISION",
    "This evaluation changed elsewhere since it was loaded. Reload before saving."
  );
}

function toFailure(err: unknown): { ok: false; code: ActionResultCode; message: string } {
  if (err instanceof ActionError) {
    return { ok: false, code: err.code as ActionResultCode, message: err.message };
  }
  if (err instanceof ZodError) {
    return { ok: false, code: "VALIDATION", message: err.issues[0]?.message ?? "Invalid input" };
  }
  throw err;
}

export async function saveEntry(
  evaluationId: string,
  expectedRevision: number,
  rawEntry: unknown
): Promise<SaveEntryResult> {
  const { organization } = await requireCurrentUserWithOrg();

  try {
    const entry = entryInputSchema.parse(rawEntry);

    // The revision claim and the entry write commit (or roll back) together.
    const revision = await prisma.$transaction(async (tx) => {
      const revision = await claimDraftRevision(tx, evaluationId, organization.id, expectedRevision);

      await tx.evaluationEntry.upsert({
        where: {
          evaluationId_parameterKey_rowKey: {
            evaluationId,
            parameterKey: entry.parameterKey,
            rowKey: entry.rowKey,
          },
        },
        create: {
          evaluationId,
          parameterKey: entry.parameterKey,
          rowKey: entry.rowKey,
          standardKey: entry.standardKey ?? null,
          availability: entry.availability ?? undefined,
          availabilityConfirmed: entry.availabilityConfirmed ?? false,
          rawPercentage: entry.rawPercentage ?? null,
          booleanCapability: entry.booleanCapability ?? null,
          statusKey: entry.statusKey ?? null,
          evidenceUrl: entry.evidenceUrl || null,
          sourceTitle: entry.sourceTitle || null,
          sourceDate: entry.sourceDate || null,
          notes: entry.notes || null,
        },
        update: {
          standardKey: entry.standardKey ?? null,
          availability: entry.availability ?? undefined,
          availabilityConfirmed: entry.availabilityConfirmed ?? false,
          rawPercentage: entry.rawPercentage ?? null,
          booleanCapability: entry.booleanCapability ?? null,
          statusKey: entry.statusKey ?? null,
          evidenceUrl: entry.evidenceUrl || null,
          sourceTitle: entry.sourceTitle || null,
          sourceDate: entry.sourceDate || null,
          notes: entry.notes || null,
        },
      });

      return revision;
    });

    const [rubric, entries] = await Promise.all([
      prisma.evaluation
        .findUniqueOrThrow({ where: { id: evaluationId }, select: { rubricVersionId: true } })
        .then(({ rubricVersionId }) => loadRubricVersionById(rubricVersionId)),
      prisma.evaluationEntry.findMany({ where: { evaluationId } }),
    ]);
    const progress = computeScore(rubric, entries.map(toEntryInput));

    return { ok: true, revision, progress };
  } catch (err) {
    return toFailure(err);
  }
}

export async function saveEvaluationMeta(
  evaluationId: string,
  expectedRevision: number,
  rawMeta: unknown
): Promise<SaveMetaResult> {
  const { organization } = await requireCurrentUserWithOrg();

  try {
    const meta = evaluationMetaSchema.parse(rawMeta);

    const revision = await prisma.$transaction((tx) =>
      claimDraftRevision(tx, evaluationId, organization.id, expectedRevision, {
        countryCode: meta.countryCode,
        countryName: meta.countryName,
        assessmentDate: meta.assessmentDate,
        title: meta.title || null,
        analystNotes: meta.analystNotes || null,
      })
    );

    return { ok: true, revision };
  } catch (err) {
    return toFailure(err);
  }
}
