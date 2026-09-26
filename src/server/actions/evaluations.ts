"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import * as evaluationService from "@/server/services/evaluation-service";
import type { EvaluationEditPayload, EvaluationListItem } from "@/server/services/evaluation-service";

export type { EvaluationEditPayload, EvaluationListItem };

export type CreateEvaluationResult = { ok: true; id: string } | { ok: false; code: "VALIDATION"; message: string };

/** Returns validation problems as data: a thrown error's message is redacted by Next in production. */
export async function createEvaluation(input: unknown): Promise<CreateEvaluationResult> {
  try {
    const { id } = await evaluationService.createEvaluation(input);
    revalidatePath("/dashboard");
    return { ok: true, id };
  } catch (err) {
    if (err instanceof ZodError) {
      return { ok: false, code: "VALIDATION", message: err.issues[0]?.message ?? "Please check the details and try again." };
    }
    throw err;
  }
}

export async function listEvaluations(params: {
  search?: string;
  status?: "DRAFT" | "SUBMITTED" | "ALL";
}): Promise<EvaluationListItem[]> {
  return evaluationService.listEvaluations(params);
}

export async function getEvaluationForEdit(evaluationId: string): Promise<EvaluationEditPayload> {
  return evaluationService.getEvaluationForEdit(evaluationId);
}

export async function deleteEvaluation(evaluationId: string): Promise<{ ok: true }> {
  const result = await evaluationService.deleteEvaluation(evaluationId);
  revalidatePath("/dashboard");
  return result;
}

export async function duplicateEvaluation(evaluationId: string): Promise<{ id: string }> {
  const result = await evaluationService.duplicateEvaluation(evaluationId);
  revalidatePath("/dashboard");
  return result;
}
