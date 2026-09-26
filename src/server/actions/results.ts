"use server";

import * as resultsService from "@/server/services/results-service";
import type { EvaluationResultsPayload } from "@/server/services/results-service";

export type { EvaluationResultsPayload };

export async function getEvaluationResults(evaluationId: string): Promise<EvaluationResultsPayload> {
  return resultsService.getEvaluationResults(evaluationId);
}
