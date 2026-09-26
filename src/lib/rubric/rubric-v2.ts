import type { RubricDef } from "./types";
import { RUBRIC_V1 } from "./rubric-v1";

/**
 * Tashkhees scoring Key, version 2.
 *
 * Corrects a defect in v1: the `digital_transactions` sub-metric of
 * `consumer_behavior` silently merged the spec's 20-30% band with the
 * explicitly-undefined 30-40% range, inventing a 0.8 multiplier for the
 * undefined half. The source methodology states plainly that no multiplier
 * is defined for 30-40% and one must not be invented (see
 * SCORING_DECISIONS.md). This version instead models that range as a
 * genuinely unresolved band: an assessment with an input in [30,40) can be
 * saved, but scoring returns an UNRESOLVED_SCORING_RULE issue and the
 * assessment cannot be finalized until the methodology is corrected or the
 * input changes.
 *
 * Because this changes scoring outcomes, spec section 12 requires it to ship
 * as a new methodology version rather than mutating v1 in place. Every row
 * other than the one below is byte-identical to v1 (structuredClone, not
 * retyped, to eliminate transcription risk across the other 23 rows).
 * Evaluations already pinned to v1 (via Evaluation.rubricVersionId) are
 * completely unaffected by this file.
 */
export const RUBRIC_V2: RubricDef = (() => {
  const def: RubricDef = structuredClone(RUBRIC_V1);
  def.version = 2;
  def.label = "Tashkhees Scoring Key v2 — corrected Digital Transactions bands";

  const financialInclusion = def.categories.find((c) => c.key === "financial_inclusion")!;
  const consumerBehavior = financialInclusion.parameters.find((p) => p.key === "consumer_behavior")!;
  const digitalTransactions = consumerBehavior.subMetrics!.find((sm) => sm.key === "digital_transactions")!;

  digitalTransactions.bands = [
    { lower: 40, upper: 100, upperInclusive: true, multiplier: 1.0 },
    {
      lower: 30,
      upper: 40,
      upperInclusive: false,
      multiplier: null,
      sourceLabel: "30–40%",
      resolutionState: "UNRESOLVED",
      note:
        "The supplied source does not define a multiplier for the 30–40% band (spec §12). " +
        "Do not invent a value; an input in this range must resolve to UNRESOLVED_SCORING_RULE.",
    },
    { lower: 20, upper: 30, upperInclusive: false, multiplier: 0.8 },
    { lower: 15, upper: 20, upperInclusive: false, multiplier: 0.6 },
    { lower: 10, upper: 15, upperInclusive: false, multiplier: 0.4 },
    { lower: 0, upper: 10, upperInclusive: false, multiplier: 0.2 },
  ];

  return def;
})();
