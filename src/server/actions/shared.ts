import "server-only";
import type { Evaluation, EvaluationEntry } from "@prisma/client";
import type { EntryInput } from "@/lib/scoring/engine";

export class ActionError extends Error {
  code:
    | "UNAUTHENTICATED"
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "ALREADY_SUBMITTED"
    | "STALE_REVISION"
    | "VALIDATION"
    | "INCOMPLETE";
  constructor(code: ActionError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface EvaluationSummary {
  id: string;
  countryCode: string;
  countryName: string;
  assessmentDate: string;
  title: string | null;
  analystNotes: string | null;
  status: "DRAFT" | "SUBMITTED";
  rubricVersionId: string;
  rubricVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  totalScore: string | null;
}

export function serializeEvaluation(
  evaluation: Evaluation & { rubricVersion?: { version: number } },
  totalScore: string | null = null
): EvaluationSummary {
  return {
    id: evaluation.id,
    countryCode: evaluation.countryCode,
    countryName: evaluation.countryName,
    assessmentDate: evaluation.assessmentDate.toISOString(),
    title: evaluation.title,
    analystNotes: evaluation.analystNotes,
    status: evaluation.status,
    rubricVersionId: evaluation.rubricVersionId,
    rubricVersion: evaluation.rubricVersion?.version ?? 0,
    revision: evaluation.revision,
    createdAt: evaluation.createdAt.toISOString(),
    updatedAt: evaluation.updatedAt.toISOString(),
    submittedAt: evaluation.submittedAt ? evaluation.submittedAt.toISOString() : null,
    totalScore,
  };
}

export interface EntryView {
  parameterKey: string;
  rowKey: string;
  standardKey: string | null;
  availability: Record<string, boolean> | null;
  availabilityConfirmed: boolean;
  rawPercentage: string | null;
  booleanCapability: boolean | null;
  statusKey: string | null;
  evidenceUrl: string | null;
  sourceTitle: string | null;
  sourceDate: string | null;
  notes: string | null;
}

export function serializeEntry(entry: EvaluationEntry): EntryView {
  return {
    parameterKey: entry.parameterKey,
    rowKey: entry.rowKey,
    standardKey: entry.standardKey,
    availability: (entry.availability as Record<string, boolean> | null) ?? null,
    availabilityConfirmed: entry.availabilityConfirmed,
    rawPercentage: entry.rawPercentage !== null ? entry.rawPercentage.toString() : null,
    booleanCapability: entry.booleanCapability,
    statusKey: entry.statusKey,
    evidenceUrl: entry.evidenceUrl,
    sourceTitle: entry.sourceTitle,
    sourceDate: entry.sourceDate,
    notes: entry.notes,
  };
}

export function toEntryInput(entry: EvaluationEntry): EntryInput {
  return {
    parameterKey: entry.parameterKey,
    rowKey: entry.rowKey,
    standardKey: entry.standardKey,
    availability: (entry.availability as Record<string, boolean> | null) ?? null,
    availabilityConfirmed: entry.availabilityConfirmed,
    rawPercentage: entry.rawPercentage !== null ? entry.rawPercentage.toString() : null,
    booleanCapability: entry.booleanCapability,
    statusKey: entry.statusKey,
  };
}
