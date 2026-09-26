import "server-only";
import type { ResolvedRubric } from "@/lib/scoring/resolved-types";
import type { ParameterInputType, StatusKey } from "./types";

/**
 * Plain-JSON view of a resolved rubric for rendering the evaluation form.
 * Every Decimal is converted to a string — Server Actions/RSC can only
 * cross the server/client boundary with plain serializable values.
 */
export interface FormStandardOption {
  key: string;
  label: string;
  multiplier: string;
}
export interface FormSubParameter {
  key: string;
  label: string;
  contributorWeight: string;
}
export interface FormBand {
  lower: string;
  upper: string;
  upperInclusive: boolean;
  multiplier: string | null;
  sourceLabel: string | null;
  resolutionState: "RESOLVED" | "UNRESOLVED";
  note: string | null;
}
export interface FormSubMetric {
  key: string;
  label: string;
  splitWeight: string;
  bands: FormBand[];
}
export interface FormParameter {
  key: string;
  name: string;
  weight: string;
  inputType: ParameterInputType;
  standardOptions: FormStandardOption[];
  subParameters: FormSubParameter[];
  bands: FormBand[];
  subMetrics: FormSubMetric[];
  booleanYesMultiplier?: string;
  booleanNoMultiplier?: string;
}
export interface FormCategory {
  key: string;
  name: string;
  weight: string;
  parameters: FormParameter[];
}
export interface FormStatusOption {
  key: StatusKey;
  label: string;
  score: string;
}
export interface FormRubric {
  rubricVersionId: string;
  version: number;
  statusOptions: FormStatusOption[];
  categories: FormCategory[];
}

export function toFormRubric(r: ResolvedRubric): FormRubric {
  return {
    rubricVersionId: r.rubricVersionId,
    version: r.version,
    statusOptions: r.statusOptions.map((s) => ({ key: s.key, label: s.label, score: s.score.toString() })),
    categories: r.categories.map((c) => ({
      key: c.key,
      name: c.name,
      weight: c.weight.toString(),
      parameters: c.parameters.map((p) => ({
        key: p.key,
        name: p.name,
        weight: p.weight.toString(),
        inputType: p.inputType,
        standardOptions: p.standardOptions.map((o) => ({
          key: o.key,
          label: o.label,
          multiplier: o.multiplier.toString(),
        })),
        subParameters: p.subParameters.map((sp) => ({
          key: sp.key,
          label: sp.label,
          contributorWeight: sp.contributorWeight.toString(),
        })),
        bands: p.bands.map((b) => ({
          lower: b.lower.toString(),
          upper: b.upper.toString(),
          upperInclusive: b.upperInclusive,
          multiplier: b.multiplier !== null ? b.multiplier.toString() : null,
          sourceLabel: b.sourceLabel,
          resolutionState: b.resolutionState,
          note: b.note,
        })),
        subMetrics: p.subMetrics.map((sm) => ({
          key: sm.key,
          label: sm.label,
          splitWeight: sm.splitWeight.toString(),
          bands: sm.bands.map((b) => ({
            lower: b.lower.toString(),
            upper: b.upper.toString(),
            upperInclusive: b.upperInclusive,
            multiplier: b.multiplier !== null ? b.multiplier.toString() : null,
            sourceLabel: b.sourceLabel,
            resolutionState: b.resolutionState,
            note: b.note,
          })),
        })),
        booleanYesMultiplier: p.booleanYesMultiplier?.toString(),
        booleanNoMultiplier: p.booleanNoMultiplier?.toString(),
      })),
    })),
  };
}
