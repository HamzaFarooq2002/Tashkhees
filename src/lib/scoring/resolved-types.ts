import type Decimal from "decimal.js";
import type { BandResolutionState, ParameterInputType, StatusKey } from "../rubric/types";

export interface ResolvedStatusOption {
  key: StatusKey;
  label: string;
  score: Decimal;
}

export interface ResolvedStandardOption {
  key: string;
  label: string;
  multiplier: Decimal;
}

export interface ResolvedSubParameter {
  key: string;
  label: string;
  contributorWeight: Decimal;
}

export interface ResolvedBand {
  lower: Decimal;
  upper: Decimal;
  upperInclusive: boolean;
  multiplier: Decimal | null;
  sourceLabel: string | null;
  resolutionState: BandResolutionState;
  note: string | null;
}

export interface ResolvedSubMetric {
  key: string;
  label: string;
  splitWeight: Decimal;
  bands: ResolvedBand[];
}

export interface ResolvedParameter {
  key: string;
  name: string;
  weight: Decimal;
  inputType: ParameterInputType;
  standardOptions: ResolvedStandardOption[];
  subParameters: ResolvedSubParameter[];
  bands: ResolvedBand[];
  subMetrics: ResolvedSubMetric[];
  booleanYesMultiplier?: Decimal;
  booleanNoMultiplier?: Decimal;
}

export interface ResolvedCategory {
  key: string;
  name: string;
  weight: Decimal;
  parameters: ResolvedParameter[];
}

export interface ResolvedRubric {
  rubricVersionId: string;
  version: number;
  configHash: string;
  engineVersion: string;
  statusOptions: ResolvedStatusOption[];
  categories: ResolvedCategory[];
}
