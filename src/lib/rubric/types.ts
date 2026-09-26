export type StatusKey =
  | "fully_implemented"
  | "partially_implemented"
  | "fragmented_uneven"
  | "absent";

export interface StatusOptionDef {
  key: StatusKey;
  label: string;
  score: number;
}

export interface StandardOptionDef {
  key: string;
  label: string;
  multiplier: number;
}

export interface SubParameterDef {
  key: string;
  label: string;
  contributorWeight: number;
}

export type BandResolutionState = "RESOLVED" | "UNRESOLVED";

export interface BandDef {
  lower: number;
  upper: number;
  upperInclusive: boolean;
  /** Null only when resolutionState is "UNRESOLVED" — the methodology deliberately leaves this range unscored. */
  multiplier: number | null;
  /** The methodology's original label for this range, e.g. "30-40%". */
  sourceLabel?: string;
  /** Omitted is equivalent to "RESOLVED". */
  resolutionState?: BandResolutionState;
  /** Required and non-empty when resolutionState is "UNRESOLVED"; explains why no multiplier is defined. */
  note?: string;
}

export interface SubMetricDef {
  key: string;
  label: string;
  splitWeight: number;
  bands: BandDef[];
}

export type ParameterInputType =
  | "STANDARD"
  | "SUBPARAM"
  | "BANDED"
  | "SPLIT_BANDED"
  | "BOOLEAN";

export interface ParameterDef {
  key: string;
  name: string;
  weight: number;
  inputType: ParameterInputType;
  standardOptions?: StandardOptionDef[];
  subParameters?: SubParameterDef[];
  bands?: BandDef[];
  subMetrics?: SubMetricDef[];
  booleanYesMultiplier?: number;
  booleanNoMultiplier?: number;
}

export interface CategoryDef {
  key: string;
  name: string;
  weight: number;
  parameters: ParameterDef[];
}

export interface RubricDef {
  version: number;
  label: string;
  statusOptions: StatusOptionDef[];
  categories: CategoryDef[];
}

/** Identifies one of the 24 scored rows within the rubric. */
export interface ScoredRowRef {
  categoryKey: string;
  parameterKey: string;
  rowKey: string; // "main" for unsplit parameters, submetric key otherwise
  splitWeight: number;
}
