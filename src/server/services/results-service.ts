import "server-only";
import { prisma } from "@/lib/db";
import { requireCurrentUserWithOrg } from "@/lib/auth/current-user";
import { ActionError, serializeEvaluation } from "@/server/actions/shared";
import type { EvaluationSummary } from "@/server/actions/shared";
import type { ParameterResult, RowResult } from "@/lib/scoring/engine";

export interface EvaluationResultsPayload {
  evaluation: EvaluationSummary;
  totalScore: string;
  categories: {
    categoryKey: string;
    name: string;
    contribution: string;
    maxContribution: string;
    parameters: ParameterResult[];
  }[];
  rubricVersion: number;
}

export async function getEvaluationResults(evaluationId: string): Promise<EvaluationResultsPayload> {
  const { organization } = await requireCurrentUserWithOrg();

  const evaluation = await prisma.evaluation.findFirst({
    where: { id: evaluationId, organizationId: organization.id },
    include: { rubricVersion: { select: { version: true } }, resultSnapshot: true },
  });
  if (!evaluation) throw new ActionError("NOT_FOUND", "Evaluation not found");
  if (evaluation.status !== "SUBMITTED" || !evaluation.resultSnapshot) {
    throw new ActionError("VALIDATION", "This evaluation has not been submitted yet");
  }

  const snapshot = evaluation.resultSnapshot;
  const categoryTotals = snapshot.categoryTotals as {
    categoryKey: string;
    name: string;
    contribution: string;
    maxContribution: string;
  }[];
  const parameterResults = snapshot.parameterResults as unknown as ParameterResult[];
  const rowResults = snapshot.rowResults as unknown as RowResult[];

  const categories = categoryTotals.map((c) => ({
    ...c,
    parameters: parameterResults
      .filter((p) => p.categoryKey === c.categoryKey)
      .map((p) => ({
        ...p,
        rows: rowResults.filter((r) => r.parameterKey === p.parameterKey),
      })),
  }));

  return {
    evaluation: serializeEvaluation(evaluation, snapshot.totalScore.toString()),
    totalScore: snapshot.totalScore.toString(),
    categories,
    rubricVersion: evaluation.rubricVersion.version,
  };
}
