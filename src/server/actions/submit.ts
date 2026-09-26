"use server";

import { revalidatePath } from "next/cache";
import * as submitService from "@/server/services/submit-service";
import type { SubmitEvaluationResult } from "@/server/services/submit-service";

export type { SubmitEvaluationResult };

export async function submitEvaluation(
  evaluationId: string,
  expectedRevision: number
): Promise<SubmitEvaluationResult> {
  const result = await submitService.submitEvaluation(evaluationId, expectedRevision);
  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath(`/evaluations/${evaluationId}`);
  }
  return result;
}
