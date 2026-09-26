import type { BandDef, CategoryDef, ParameterDef, RubricDef, ScoredRowRef } from "./types";

/** Derives the canonical list of scored rows (24 for RUBRIC_V1) from a rubric definition. */
export function deriveScoredRows(rubric: RubricDef): ScoredRowRef[] {
  const rows: ScoredRowRef[] = [];
  for (const category of rubric.categories) {
    for (const parameter of category.parameters) {
      rows.push(...deriveParameterRows(category, parameter));
    }
  }
  return rows;
}

function deriveParameterRows(category: CategoryDef, parameter: ParameterDef): ScoredRowRef[] {
  if (parameter.inputType === "SPLIT_BANDED") {
    if (!parameter.subMetrics || parameter.subMetrics.length === 0) {
      throw new Error(`SPLIT_BANDED parameter ${parameter.key} must define subMetrics`);
    }
    return parameter.subMetrics.map((sm) => ({
      categoryKey: category.key,
      parameterKey: parameter.key,
      rowKey: sm.key,
      splitWeight: sm.splitWeight,
    }));
  }
  return [
    {
      categoryKey: category.key,
      parameterKey: parameter.key,
      rowKey: "main",
      splitWeight: 1,
    },
  ];
}

export interface RubricValidationIssue {
  message: string;
}

/** Structural checks over the rubric Key: weight sums, band coverage, row counts. */
export function validateRubricDef(rubric: RubricDef): RubricValidationIssue[] {
  const issues: RubricValidationIssue[] = [];
  const approxEqual = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

  const categoryWeightSum = rubric.categories.reduce((s, c) => s + c.weight, 0);
  if (!approxEqual(categoryWeightSum, 1)) {
    issues.push({ message: `Category weights sum to ${categoryWeightSum}, expected 1` });
  }

  for (const category of rubric.categories) {
    const paramWeightSum = category.parameters.reduce((s, p) => s + p.weight, 0);
    if (!approxEqual(paramWeightSum, 1)) {
      issues.push({
        message: `Parameter weights in category ${category.key} sum to ${paramWeightSum}, expected 1`,
      });
    }

    for (const parameter of category.parameters) {
      if (parameter.inputType === "SUBPARAM") {
        const sum = (parameter.subParameters ?? []).reduce((s, sp) => s + sp.contributorWeight, 0);
        if (!approxEqual(sum, 1)) {
          issues.push({
            message: `Contributor weights for ${parameter.key} sum to ${sum}, expected 1`,
          });
        }
      }
      if (parameter.inputType === "SPLIT_BANDED") {
        const sum = (parameter.subMetrics ?? []).reduce((s, sm) => s + sm.splitWeight, 0);
        if (!approxEqual(sum, 1)) {
          issues.push({
            message: `Split weights for ${parameter.key} sum to ${sum}, expected 1`,
          });
        }
        for (const sm of parameter.subMetrics ?? []) {
          issues.push(...checkBandCoverage(`${parameter.key}.${sm.key}`, sm.bands));
        }
      }
      if (parameter.inputType === "BANDED") {
        issues.push(...checkBandCoverage(parameter.key, parameter.bands ?? []));
      }
    }
  }

  const rows = deriveScoredRows(rubric);
  if (rows.length !== 24) {
    issues.push({ message: `Expected 24 scored rows, derived ${rows.length}` });
  }
  const technicalRows = rows.filter((r) => r.categoryKey === "technical").length;
  const operationalRows = rows.filter((r) => r.categoryKey === "operational").length;
  const fiRows = rows.filter((r) => r.categoryKey === "financial_inclusion").length;
  if (technicalRows !== 6) issues.push({ message: `Expected 6 technical rows, got ${technicalRows}` });
  if (operationalRows !== 7) issues.push({ message: `Expected 7 operational rows, got ${operationalRows}` });
  if (fiRows !== 11) issues.push({ message: `Expected 11 financial inclusion rows, got ${fiRows}` });

  return issues;
}

function checkBandCoverage(label: string, bands: BandDef[]): RubricValidationIssue[] {
  const issues: RubricValidationIssue[] = [];
  const sorted = [...bands].sort((a, b) => a.lower - b.lower);
  if (sorted.length === 0) {
    issues.push({ message: `${label} has no bands defined` });
    return issues;
  }
  if (sorted[0].lower !== 0) {
    issues.push({ message: `${label} bands do not start at 0` });
  }
  const last = sorted[sorted.length - 1];
  if (last.upper !== 100 || !last.upperInclusive) {
    issues.push({ message: `${label} bands do not end inclusively at 100` });
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current.upperInclusive) {
      issues.push({ message: `${label} band [${current.lower},${current.upper}] is inclusive but is not the top band, causing overlap` });
    }
    if (current.upper !== next.lower) {
      issues.push({
        message: `${label} has a gap/overlap between ${current.upper} and ${next.lower}`,
      });
    }
  }
  for (const band of sorted) {
    const state = band.resolutionState ?? "RESOLVED";
    if (state === "UNRESOLVED") {
      if (band.multiplier !== null) {
        issues.push({
          message: `${label} band [${band.lower},${band.upper}] is marked UNRESOLVED but defines a multiplier`,
        });
      }
      if (!band.note) {
        issues.push({
          message: `${label} band [${band.lower},${band.upper}] is marked UNRESOLVED but has no explanatory note`,
        });
      }
    } else if (band.multiplier === null) {
      issues.push({
        message: `${label} band [${band.lower},${band.upper}] is RESOLVED but has no multiplier`,
      });
    }
  }
  return issues;
}

export interface UnresolvedRuleRef {
  parameterKey: string;
  subMetricKey: string | null;
  description: string;
}

/** Collects every deliberately-unresolved band in the rubric, for storage on RubricVersion.unresolvedRules. */
export function deriveUnresolvedRules(rubric: RubricDef): UnresolvedRuleRef[] {
  const rules: UnresolvedRuleRef[] = [];
  for (const category of rubric.categories) {
    for (const parameter of category.parameters) {
      if (parameter.inputType === "BANDED") {
        for (const band of parameter.bands ?? []) {
          if ((band.resolutionState ?? "RESOLVED") === "UNRESOLVED") {
            rules.push({
              parameterKey: parameter.key,
              subMetricKey: null,
              description: band.note ?? `Undefined band [${band.lower},${band.upper}] for ${parameter.key}`,
            });
          }
        }
      }
      if (parameter.inputType === "SPLIT_BANDED") {
        for (const sm of parameter.subMetrics ?? []) {
          for (const band of sm.bands) {
            if ((band.resolutionState ?? "RESOLVED") === "UNRESOLVED") {
              rules.push({
                parameterKey: parameter.key,
                subMetricKey: sm.key,
                description: band.note ?? `Undefined band [${band.lower},${band.upper}] for ${parameter.key}.${sm.key}`,
              });
            }
          }
        }
      }
    }
  }
  return rules;
}
