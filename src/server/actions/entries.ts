"use server";

import * as entryService from "@/server/services/entry-service";
import type { ActionResultCode, SaveEntryResult, SaveMetaResult } from "@/server/services/entry-service";

export type { ActionResultCode, SaveEntryResult, SaveMetaResult };

export async function saveEntry(
  evaluationId: string,
  expectedRevision: number,
  rawEntry: unknown
): Promise<SaveEntryResult> {
  return entryService.saveEntry(evaluationId, expectedRevision, rawEntry);
}

export async function saveEvaluationMeta(
  evaluationId: string,
  expectedRevision: number,
  rawMeta: unknown
): Promise<SaveMetaResult> {
  return entryService.saveEvaluationMeta(evaluationId, expectedRevision, rawMeta);
}
