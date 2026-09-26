import "server-only";
import { Decimal } from "./decimal-config";
import type {
  ResolvedRubric,
  ResolvedCategory,
  ResolvedParameter,
  ResolvedBand,
} from "./resolved-types";

/** Raw input for one scored row, as captured by the evaluation form. */
export interface EntryInput {
  parameterKey: string;
  /** "main" for unsplit parameters, otherwise the submetric key. */
  rowKey: string;
  standardKey?: string | null;
  availability?: Record<string, boolean> | null;
  availabilityConfirmed?: boolean;
  rawPercentage?: number | string | null;
  booleanCapability?: boolean | null;
  statusKey?: string | null;
}

export interface CoverageBreakdownItem {
  key: string;
  label: string;
  present: boolean;
  contributorWeight: string;
}

/** "complete" = scored normally; "unresolved" = matched a deliberately-unresolved methodology band (null contribution, still blocks finalization). */
export type RowState = "complete" | "unresolved";

export type RowIssueSeverity = "incomplete" | "invalid" | "unresolved";

export type RowIssueCode =
  | "MISSING_ENTRY"
  | "MISSING_STANDARD"
  | "UNKNOWN_STANDARD"
  | "AVAILABILITY_NOT_CONFIRMED"
  | "INCOMPLETE_CONTRIBUTOR_ANSWERS"
  | "MISSING_PERCENTAGE"
  | "INVALID_PERCENTAGE"
  | "RUBRIC_BAND_GAP"
  | "MISSING_BOOLEAN"
  | "MISSING_STATUS"
  | "UNKNOWN_STATUS"
  | "UNRESOLVED_SCORING_RULE";

export interface UnresolvedBandDetail {
  lower: string;
  upper: string;
  upperInclusive: boolean;
  sourceLabel: string | null;
  note: string | null;
}

export interface RowResult {
  categoryKey: string;
  parameterKey: string;
  rowKey: string;
  label: string;
  state: RowState;
  categoryWeight: string;
  parameterWeight: string;
  splitWeight: string;
  capabilityMultiplier: string | null;
  statusKey: string;
  statusScore: string;
  /** Alias of rowScore using the spec's terminology (== finalContribution / 2). Null iff state is "unresolved". */
  rawWorkbookScore: string | null;
  rowScore: string | null;
  rowContribution: string | null;
  maxRowContribution: string;
  unresolvedBand?: UnresolvedBandDetail;
  // Presentational detail, one of which is populated depending on input type
  selectedStandardKey?: string;
  selectedStandardLabel?: string;
  resolvedBandLabel?: string;
  coverageBreakdown?: CoverageBreakdownItem[];
  rawPercentage?: string;
  booleanCapability?: boolean;
}

export interface RowError {
  categoryKey: string;
  parameterKey: string;
  rowKey: string;
  code: Exclude<RowIssueCode, "UNRESOLVED_SCORING_RULE">;
  message: string;
  /** Always populated, even on error, so incomplete-assessment totals can be computed. */
  maxRowContribution: string;
  /** Populated only for INCOMPLETE_CONTRIBUTOR_ANSWERS. */
  missingContributorKeys?: string[];
}

/** Every row that isn't cleanly "complete" — the union of RowError (tagged with severity) and unresolved rows. */
export interface RowIssue {
  categoryKey: string;
  parameterKey: string;
  rowKey: string;
  code: RowIssueCode;
  severity: RowIssueSeverity;
  message: string;
  maxRowContribution: string;
  missingContributorKeys?: string[];
  unresolvedBand?: UnresolvedBandDetail;
}

export interface ParameterResult {
  categoryKey: string;
  parameterKey: string;
  name: string;
  contribution: string;
  maxContribution: string;
  rows: RowResult[];
}

export interface CategoryResult {
  categoryKey: string;
  name: string;
  contribution: string;
  maxContribution: string;
  parameters: ParameterResult[];
}

export interface ScoringResult {
  /** True iff there are zero errors and zero unresolved rows — every one of the 24 rows scored cleanly. */
  ok: boolean;
  /** Spec-named alias of `ok`. */
  isComplete: boolean;
  errors: RowError[];
  /** Every non-complete row (errors, tagged with severity, plus unresolved rows). */
  issues: RowIssue[];
  categories: CategoryResult[];
  totalScore: string | null;
  /** Sum of rowContribution over rows in state "complete" — always present, even when incomplete. */
  knownPoints: string;
  /** Sum of maxRowContribution over rows in state "complete" only. */
  maxTotalScore: string;
  /** Spec-named alias of maxTotalScore. */
  scorableMaximumPoints: string;
  /** Always "100" — the theoretical maximum across all 24 rows, independent of what was actually answered. */
  totalPossiblePoints: string;
  rowStateCounts: { complete: number; incomplete: number; invalid: number; unresolved: number };
}

const ROW_ISSUE_SEVERITY: Record<Exclude<RowIssueCode, "UNRESOLVED_SCORING_RULE">, "incomplete" | "invalid"> = {
  MISSING_ENTRY: "incomplete",
  MISSING_STANDARD: "incomplete",
  AVAILABILITY_NOT_CONFIRMED: "incomplete",
  INCOMPLETE_CONTRIBUTOR_ANSWERS: "incomplete",
  MISSING_PERCENTAGE: "incomplete",
  MISSING_BOOLEAN: "incomplete",
  MISSING_STATUS: "incomplete",
  UNKNOWN_STANDARD: "invalid",
  INVALID_PERCENTAGE: "invalid",
  RUBRIC_BAND_GAP: "invalid",
  UNKNOWN_STATUS: "invalid",
};

function findEntry(
  entries: EntryInput[],
  parameterKey: string,
  rowKey: string
): EntryInput | undefined {
  return entries.find((e) => e.parameterKey === parameterKey && e.rowKey === rowKey);
}

function findBand(bands: ResolvedBand[], pct: Decimal): ResolvedBand | undefined {
  return bands.find((b) => {
    const aboveLower = pct.gte(b.lower);
    const belowUpper = b.upperInclusive ? pct.lte(b.upper) : pct.lt(b.upper);
    return aboveLower && belowUpper;
  });
}

function parsePercentage(raw: number | string | null | undefined): Decimal | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const d = new Decimal(raw);
  if (d.isNaN()) return null;
  return d;
}

interface ResolveContext {
  category: ResolvedCategory;
  parameter: ResolvedParameter;
  rowKey: string;
  label: string;
  splitWeight: Decimal;
  bands: ResolvedBand[]; // bands applicable to this row (parameter-level or submetric-level)
  entry: EntryInput | undefined;
  statusOptions: ResolvedRubric["statusOptions"];
}

function resolveStatus(
  ctx: ResolveContext,
  maxRowContribution: Decimal
): { statusKey: string; statusScore: Decimal } | RowError {
  const statusKey = ctx.entry?.statusKey;
  if (!statusKey) {
    return {
      categoryKey: ctx.category.key,
      parameterKey: ctx.parameter.key,
      rowKey: ctx.rowKey,
      code: "MISSING_STATUS",
      message: `Status is required for ${ctx.label}`,
      maxRowContribution: maxRowContribution.toString(),
    };
  }
  const status = ctx.statusOptions.find((s) => s.key === statusKey);
  if (!status) {
    return {
      categoryKey: ctx.category.key,
      parameterKey: ctx.parameter.key,
      rowKey: ctx.rowKey,
      code: "UNKNOWN_STATUS",
      message: `Unknown status "${statusKey}" for ${ctx.label}`,
      maxRowContribution: maxRowContribution.toString(),
    };
  }
  return { statusKey: status.key, statusScore: status.score };
}

function isRowError(x: unknown): x is RowError {
  return typeof x === "object" && x !== null && "code" in x;
}

function resolveRow(ctx: ResolveContext): RowResult | RowError {
  const { category, parameter, rowKey, entry, label, splitWeight } = ctx;
  const maxRowContribution = category.weight.mul(parameter.weight).mul(splitWeight).mul(100);
  const maxStr = maxRowContribution.toString();

  if (!entry) {
    return {
      categoryKey: category.key,
      parameterKey: parameter.key,
      rowKey,
      code: "MISSING_ENTRY",
      message: `No entry submitted for ${label}`,
      maxRowContribution: maxStr,
    };
  }

  let capabilityMultiplier: Decimal | null = null;
  let unresolvedBand: ResolvedBand | null = null;
  const detail: Partial<RowResult> = {};

  if (parameter.inputType === "STANDARD") {
    if (!entry.standardKey) {
      return {
        categoryKey: category.key,
        parameterKey: parameter.key,
        rowKey,
        code: "MISSING_STANDARD",
        message: `A standard/capability selection is required for ${label}`,
        maxRowContribution: maxStr,
      };
    }
    const option = parameter.standardOptions.find((o) => o.key === entry.standardKey);
    if (!option) {
      return {
        categoryKey: category.key,
        parameterKey: parameter.key,
        rowKey,
        code: "UNKNOWN_STANDARD",
        message: `Unknown standard "${entry.standardKey}" for ${label}`,
        maxRowContribution: maxStr,
      };
    }
    capabilityMultiplier = option.multiplier;
    detail.selectedStandardKey = option.key;
    detail.selectedStandardLabel = option.label;
  } else if (parameter.inputType === "SUBPARAM") {
    if (!entry.availabilityConfirmed) {
      return {
        categoryKey: category.key,
        parameterKey: parameter.key,
        rowKey,
        code: "AVAILABILITY_NOT_CONFIRMED",
        message: `Availability selections must be confirmed for ${label}`,
        maxRowContribution: maxStr,
      };
    }
    const availability = entry.availability ?? {};
    const missing = parameter.subParameters.filter(
      (sp) => availability[sp.key] !== true && availability[sp.key] !== false
    );
    if (missing.length > 0) {
      return {
        categoryKey: category.key,
        parameterKey: parameter.key,
        rowKey,
        code: "INCOMPLETE_CONTRIBUTOR_ANSWERS",
        message: `Contributor(s) ${missing.map((m) => m.label).join(", ")} have no explicit answer for ${label}`,
        maxRowContribution: maxStr,
        missingContributorKeys: missing.map((m) => m.key),
      };
    }
    let sum = new Decimal(0);
    const breakdown: CoverageBreakdownItem[] = [];
    for (const sp of parameter.subParameters) {
      const present = availability[sp.key] === true;
      if (present) sum = sum.plus(sp.contributorWeight);
      breakdown.push({
        key: sp.key,
        label: sp.label,
        present,
        contributorWeight: sp.contributorWeight.toString(),
      });
    }
    capabilityMultiplier = sum;
    detail.coverageBreakdown = breakdown;
  } else if (parameter.inputType === "BANDED" || parameter.inputType === "SPLIT_BANDED") {
    const pct = parsePercentage(entry.rawPercentage);
    if (pct === null) {
      return {
        categoryKey: category.key,
        parameterKey: parameter.key,
        rowKey,
        code: "MISSING_PERCENTAGE",
        message: `A percentage value is required for ${label}`,
        maxRowContribution: maxStr,
      };
    }
    if (pct.lt(0) || pct.gt(100)) {
      return {
        categoryKey: category.key,
        parameterKey: parameter.key,
        rowKey,
        code: "INVALID_PERCENTAGE",
        message: `Percentage for ${label} must be between 0 and 100`,
        maxRowContribution: maxStr,
      };
    }
    const band = findBand(ctx.bands, pct);
    if (!band) {
      return {
        categoryKey: category.key,
        parameterKey: parameter.key,
        rowKey,
        code: "RUBRIC_BAND_GAP",
        message: `No configured band covers ${pct.toString()} for ${label} — rubric configuration error`,
        maxRowContribution: maxStr,
      };
    }
    detail.rawPercentage = pct.toString();
    if (band.resolutionState === "UNRESOLVED") {
      unresolvedBand = band;
      capabilityMultiplier = null;
      detail.resolvedBandLabel =
        band.sourceLabel ?? `${band.lower.toString()}–${band.upper.toString()}${band.upperInclusive ? "" : " (exclusive)"}`;
    } else {
      capabilityMultiplier = band.multiplier;
      detail.resolvedBandLabel = `${band.lower.toString()}–${band.upper.toString()}${band.upperInclusive ? "" : " (exclusive)"}`;
    }
  } else if (parameter.inputType === "BOOLEAN") {
    if (entry.booleanCapability === null || entry.booleanCapability === undefined) {
      return {
        categoryKey: category.key,
        parameterKey: parameter.key,
        rowKey,
        code: "MISSING_BOOLEAN",
        message: `A Yes/No selection is required for ${label}`,
        maxRowContribution: maxStr,
      };
    }
    capabilityMultiplier = entry.booleanCapability
      ? parameter.booleanYesMultiplier ?? new Decimal(0)
      : parameter.booleanNoMultiplier ?? new Decimal(0);
    detail.booleanCapability = entry.booleanCapability;
  } else {
    throw new Error(`Unhandled parameter input type: ${parameter.inputType}`);
  }

  // Status is a precondition regardless of whether the row landed in an unresolved band —
  // a row with both an unresolved band AND a missing status reports MISSING_STATUS, not
  // UNRESOLVED_SCORING_RULE.
  const statusResult = resolveStatus(ctx, maxRowContribution);
  if (isRowError(statusResult)) return statusResult;

  if (unresolvedBand) {
    return {
      categoryKey: category.key,
      parameterKey: parameter.key,
      rowKey,
      label,
      state: "unresolved",
      categoryWeight: category.weight.toString(),
      parameterWeight: parameter.weight.toString(),
      splitWeight: splitWeight.toString(),
      capabilityMultiplier: null,
      statusKey: statusResult.statusKey,
      statusScore: statusResult.statusScore.toString(),
      rawWorkbookScore: null,
      rowScore: null,
      rowContribution: null,
      maxRowContribution: maxStr,
      unresolvedBand: {
        lower: unresolvedBand.lower.toString(),
        upper: unresolvedBand.upper.toString(),
        upperInclusive: unresolvedBand.upperInclusive,
        sourceLabel: unresolvedBand.sourceLabel,
        note: unresolvedBand.note,
      },
      ...detail,
    };
  }

  const resolvedMultiplier = capabilityMultiplier as Decimal;
  const rowScore = category.weight
    .mul(parameter.weight)
    .mul(splitWeight)
    .mul(resolvedMultiplier)
    .mul(statusResult.statusScore)
    .mul(10);
  const rowContribution = rowScore.mul(2);

  return {
    categoryKey: category.key,
    parameterKey: parameter.key,
    rowKey,
    label,
    state: "complete",
    categoryWeight: category.weight.toString(),
    parameterWeight: parameter.weight.toString(),
    splitWeight: splitWeight.toString(),
    capabilityMultiplier: resolvedMultiplier.toString(),
    statusKey: statusResult.statusKey,
    statusScore: statusResult.statusScore.toString(),
    rawWorkbookScore: rowScore.toString(),
    rowScore: rowScore.toString(),
    rowContribution: rowContribution.toString(),
    maxRowContribution: maxStr,
    ...detail,
  };
}

/**
 * Computes the full scoring result for a set of entries against a resolved
 * rubric. Returns `ok: false` (and `isComplete: false`) when any of the 24
 * required rows is missing, invalid, or lands in a deliberately-unresolved
 * methodology band — callers must not treat a partial result as a valid
 * score (no total is computed in that case; use `knownPoints`/
 * `scorableMaximumPoints` to describe what's calculable so far).
 */
export function computeScore(rubric: ResolvedRubric, entries: EntryInput[]): ScoringResult {
  const errors: RowError[] = [];
  const issues: RowIssue[] = [];
  const categoryResults: CategoryResult[] = [];
  const rowStateCounts = { complete: 0, incomplete: 0, invalid: 0, unresolved: 0 };
  let total = new Decimal(0);
  let maxTotal = new Decimal(0);
  let theoreticalMaxTotal = new Decimal(0);

  for (const category of rubric.categories) {
    let categoryContribution = new Decimal(0);
    let categoryMax = new Decimal(0);
    const parameterResults: ParameterResult[] = [];

    for (const parameter of category.parameters) {
      const rowCtxs: ResolveContext[] =
        parameter.inputType === "SPLIT_BANDED"
          ? parameter.subMetrics.map((sm) => ({
              category,
              parameter,
              rowKey: sm.key,
              label: `${parameter.name} — ${sm.label}`,
              splitWeight: sm.splitWeight,
              bands: sm.bands,
              entry: findEntry(entries, parameter.key, sm.key),
              statusOptions: rubric.statusOptions,
            }))
          : [
              {
                category,
                parameter,
                rowKey: "main",
                label: parameter.name,
                splitWeight: new Decimal(1),
                bands: parameter.bands,
                entry: findEntry(entries, parameter.key, "main"),
                statusOptions: rubric.statusOptions,
              },
            ];

      const rows: RowResult[] = [];
      let parameterContribution = new Decimal(0);
      let parameterMax = new Decimal(0);

      for (const ctx of rowCtxs) {
        theoreticalMaxTotal = theoreticalMaxTotal.plus(
          ctx.category.weight.mul(ctx.parameter.weight).mul(ctx.splitWeight).mul(100)
        );

        const result = resolveRow(ctx);
        if (isRowError(result)) {
          errors.push(result);
          const severity = ROW_ISSUE_SEVERITY[result.code];
          issues.push({ ...result, severity });
          rowStateCounts[severity]++;
          continue;
        }
        rows.push(result);
        if (result.state === "unresolved") {
          issues.push({
            categoryKey: result.categoryKey,
            parameterKey: result.parameterKey,
            rowKey: result.rowKey,
            code: "UNRESOLVED_SCORING_RULE",
            severity: "unresolved",
            message: `No multiplier is defined for ${result.label} in the ${result.unresolvedBand!.sourceLabel ?? "matched"} range`,
            maxRowContribution: result.maxRowContribution,
            unresolvedBand: result.unresolvedBand,
          });
          rowStateCounts.unresolved++;
          continue;
        }
        rowStateCounts.complete++;
        parameterContribution = parameterContribution.plus(result.rowContribution!);
        parameterMax = parameterMax.plus(result.maxRowContribution);
      }

      parameterResults.push({
        categoryKey: category.key,
        parameterKey: parameter.key,
        name: parameter.name,
        contribution: parameterContribution.toString(),
        maxContribution: parameterMax.toString(),
        rows,
      });
      categoryContribution = categoryContribution.plus(parameterContribution);
      categoryMax = categoryMax.plus(parameterMax);
    }

    categoryResults.push({
      categoryKey: category.key,
      name: category.name,
      contribution: categoryContribution.toString(),
      maxContribution: categoryMax.toString(),
      parameters: parameterResults,
    });
    total = total.plus(categoryContribution);
    maxTotal = maxTotal.plus(categoryMax);
  }

  const ok = errors.length === 0 && rowStateCounts.unresolved === 0;
  return {
    ok,
    isComplete: ok,
    errors,
    issues,
    categories: categoryResults,
    totalScore: ok ? total.toString() : null,
    knownPoints: total.toString(),
    maxTotalScore: maxTotal.toString(),
    scorableMaximumPoints: maxTotal.toString(),
    totalPossiblePoints: theoreticalMaxTotal.toString(),
    rowStateCounts,
  };
}
