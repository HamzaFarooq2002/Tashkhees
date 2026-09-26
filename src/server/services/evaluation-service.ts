import "server-only";
import { prisma } from "@/lib/db";
import { requireCurrentUserWithOrg } from "@/lib/auth/current-user";
import { loadPublishedRubricVersion, loadRubricVersionById } from "@/lib/rubric/loader";
import { toFormRubric, type FormRubric } from "@/lib/rubric/formView";
import { computeScore } from "@/lib/scoring/engine";
import type { ScoringResult } from "@/lib/scoring/engine";
import { evaluationMetaSchema } from "@/lib/validation/evaluation";
import { ActionError, serializeEntry, serializeEvaluation, toEntryInput } from "@/server/actions/shared";
import type { EntryView, EvaluationSummary } from "@/server/actions/shared";

/** Framework-agnostic evaluation logic, shared by the Next.js Server Actions (src/server/actions/evaluations.ts)
 * and the REST route handlers (src/app/api/assessments/**). Callers are responsible for anything
 * framework-specific — revalidatePath for Server Actions, HTTP status mapping for routes. */

export async function getOwnedEvaluation(evaluationId: string, organizationId: string) {
  const evaluation = await prisma.evaluation.findFirst({
    where: { id: evaluationId, organizationId },
  });
  if (!evaluation) throw new ActionError("NOT_FOUND", "Evaluation not found");
  return evaluation;
}

export async function createEvaluation(input: unknown): Promise<{ id: string }> {
  const { organization, user } = await requireCurrentUserWithOrg();
  const parsed = evaluationMetaSchema.parse(input);
  const rubric = await loadPublishedRubricVersion();

  const evaluation = await prisma.evaluation.create({
    data: {
      organizationId: organization.id,
      creatorId: user.id,
      countryCode: parsed.countryCode,
      countryName: parsed.countryName,
      assessmentDate: parsed.assessmentDate,
      title: parsed.title || null,
      analystNotes: parsed.analystNotes || null,
      rubricVersionId: rubric.rubricVersionId,
    },
  });

  return { id: evaluation.id };
}

export type EvaluationListItem = EvaluationSummary;

export async function listEvaluations(params: {
  search?: string;
  status?: "DRAFT" | "SUBMITTED" | "ALL";
}): Promise<EvaluationListItem[]> {
  const { organization } = await requireCurrentUserWithOrg();
  const evaluations = await prisma.evaluation.findMany({
    where: {
      organizationId: organization.id,
      status: !params.status || params.status === "ALL" ? undefined : params.status,
      ...(params.search
        ? {
            OR: [
              { countryName: { contains: params.search, mode: "insensitive" } },
              { countryCode: { contains: params.search, mode: "insensitive" } },
              { title: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { rubricVersion: { select: { version: true } }, resultSnapshot: { select: { totalScore: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return evaluations.map((e) => serializeEvaluation(e, e.resultSnapshot?.totalScore.toString() ?? null));
}

export interface EvaluationEditPayload {
  evaluation: EvaluationSummary;
  rubric: FormRubric;
  entries: EntryView[];
  progress: ScoringResult;
}

export async function getEvaluationForEdit(evaluationId: string): Promise<EvaluationEditPayload> {
  const { organization } = await requireCurrentUserWithOrg();
  const evaluation = await getOwnedEvaluation(evaluationId, organization.id);

  const [rubric, entries] = await Promise.all([
    loadRubricVersionById(evaluation.rubricVersionId),
    prisma.evaluationEntry.findMany({ where: { evaluationId } }),
  ]);

  const progress = computeScore(
    rubric,
    entries.map(toEntryInput)
  );

  return {
    evaluation: serializeEvaluation({ ...evaluation, rubricVersion: { version: rubric.version } }),
    rubric: toFormRubric(rubric),
    entries: entries.map(serializeEntry),
    progress,
  };
}

/** Read-only scoring for the current state of an evaluation's entries. No persistence — used by
 * both the edit page's live progress and the REST "calculate" endpoint. */
export async function calculateEvaluation(evaluationId: string): Promise<ScoringResult> {
  const { organization } = await requireCurrentUserWithOrg();
  const evaluation = await getOwnedEvaluation(evaluationId, organization.id);

  const [rubric, entries] = await Promise.all([
    loadRubricVersionById(evaluation.rubricVersionId),
    prisma.evaluationEntry.findMany({ where: { evaluationId } }),
  ]);

  return computeScore(rubric, entries.map(toEntryInput));
}

export async function deleteEvaluation(evaluationId: string): Promise<{ ok: true }> {
  const { organization } = await requireCurrentUserWithOrg();
  await getOwnedEvaluation(evaluationId, organization.id);
  await prisma.evaluation.delete({ where: { id: evaluationId } });
  return { ok: true };
}

export async function duplicateEvaluation(evaluationId: string): Promise<{ id: string }> {
  const { organization, user } = await requireCurrentUserWithOrg();
  const source = await getOwnedEvaluation(evaluationId, organization.id);
  const sourceEntries = await prisma.evaluationEntry.findMany({ where: { evaluationId } });

  const duplicate = await prisma.$transaction(async (tx) => {
    const created = await tx.evaluation.create({
      data: {
        organizationId: organization.id,
        creatorId: user.id,
        countryCode: source.countryCode,
        countryName: source.countryName,
        assessmentDate: source.assessmentDate,
        title: source.title ? `${source.title} (copy)` : null,
        analystNotes: source.analystNotes,
        rubricVersionId: source.rubricVersionId,
        status: "DRAFT",
      },
    });

    if (sourceEntries.length > 0) {
      await tx.evaluationEntry.createMany({
        data: sourceEntries.map((e) => ({
          evaluationId: created.id,
          parameterKey: e.parameterKey,
          rowKey: e.rowKey,
          standardKey: e.standardKey,
          availability: e.availability ?? undefined,
          availabilityConfirmed: e.availabilityConfirmed,
          rawPercentage: e.rawPercentage,
          booleanCapability: e.booleanCapability,
          statusKey: e.statusKey,
          evidenceUrl: e.evidenceUrl,
          sourceTitle: e.sourceTitle,
          sourceDate: e.sourceDate,
          notes: e.notes,
        })),
      });
    }

    return created;
  });

  return { id: duplicate.id };
}
