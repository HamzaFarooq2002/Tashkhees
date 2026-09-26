import type { FormParameter, FormRubric } from "@/lib/rubric/formView";
import type { EntryView } from "@/server/actions/shared";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface RowState {
  parameterKey: string;
  rowKey: string;
  standardKey: string | null;
  availability: Record<string, boolean>;
  availabilityConfirmed: boolean;
  rawPercentage: string;
  booleanCapability: boolean | null;
  statusKey: string | null;
  evidenceUrl: string;
  sourceTitle: string;
  sourceDate: string;
  notes: string;
  saveState: SaveState;
  saveError?: string;
}

export function rowKeyOf(parameterKey: string, rowKey: string): string {
  return `${parameterKey}::${rowKey}`;
}

function emptyRow(parameterKey: string, rowKey: string): RowState {
  return {
    parameterKey,
    rowKey,
    standardKey: null,
    availability: {},
    availabilityConfirmed: false,
    rawPercentage: "",
    booleanCapability: null,
    statusKey: null,
    evidenceUrl: "",
    sourceTitle: "",
    sourceDate: "",
    notes: "",
    saveState: "idle",
  };
}

/** Builds the initial row-state map for every scored row in the rubric, filled in from any existing saved entries. */
export function buildInitialRows(rubric: FormRubric, entries: EntryView[]): Record<string, RowState> {
  const rows: Record<string, RowState> = {};

  for (const category of rubric.categories) {
    for (const parameter of category.parameters) {
      const rowKeys = parameter.inputType === "SPLIT_BANDED" ? parameter.subMetrics.map((sm) => sm.key) : ["main"];
      for (const rk of rowKeys) {
        rows[rowKeyOf(parameter.key, rk)] = emptyRow(parameter.key, rk);
      }
    }
  }

  for (const entry of entries) {
    const key = rowKeyOf(entry.parameterKey, entry.rowKey);
    if (!(key in rows)) continue;
    rows[key] = {
      ...rows[key],
      standardKey: entry.standardKey,
      availability: entry.availability ?? {},
      availabilityConfirmed: entry.availabilityConfirmed,
      rawPercentage: entry.rawPercentage ?? "",
      booleanCapability: entry.booleanCapability,
      statusKey: entry.statusKey,
      evidenceUrl: entry.evidenceUrl ?? "",
      sourceTitle: entry.sourceTitle ?? "",
      sourceDate: entry.sourceDate ?? "",
      notes: entry.notes ?? "",
      saveState: "saved",
    };
  }

  return rows;
}

export function parameterRowKeys(parameter: FormParameter): string[] {
  return parameter.inputType === "SPLIT_BANDED" ? parameter.subMetrics.map((sm) => sm.key) : ["main"];
}

export const TOTAL_SCORED_ROWS = 24;
