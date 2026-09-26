import type { EntryInput } from "@/lib/scoring/engine";
import type { ResolvedBand, ResolvedRubric } from "@/lib/scoring/resolved-types";

/** Returns a percentage (the band's lower bound, always inclusive) that resolves to the highest-multiplier resolved band. Unresolved (null-multiplier) bands are never picked as "best". */
function bestBandPercentage(bands: ResolvedBand[]): number {
  const resolved = bands.filter((b) => b.multiplier !== null);
  const best = resolved.reduce((a, b) => (b.multiplier!.gt(a.multiplier!) ? b : a));
  return best.lower.toNumber();
}

/** Builds entries that select the maximum-scoring option and "Fully Implemented" status for every row. */
export function buildPerfectEntries(rubric: ResolvedRubric): EntryInput[] {
  const entries: EntryInput[] = [];
  for (const category of rubric.categories) {
    for (const parameter of category.parameters) {
      if (parameter.inputType === "STANDARD") {
        const best = parameter.standardOptions.reduce((a, b) => (b.multiplier.gt(a.multiplier) ? b : a));
        entries.push({
          parameterKey: parameter.key,
          rowKey: "main",
          standardKey: best.key,
          statusKey: "fully_implemented",
        });
      } else if (parameter.inputType === "SUBPARAM") {
        const availability: Record<string, boolean> = {};
        for (const sp of parameter.subParameters) availability[sp.key] = true;
        entries.push({
          parameterKey: parameter.key,
          rowKey: "main",
          availability,
          availabilityConfirmed: true,
          statusKey: "fully_implemented",
        });
      } else if (parameter.inputType === "BANDED") {
        entries.push({
          parameterKey: parameter.key,
          rowKey: "main",
          rawPercentage: bestBandPercentage(parameter.bands),
          statusKey: "fully_implemented",
        });
      } else if (parameter.inputType === "SPLIT_BANDED") {
        for (const sm of parameter.subMetrics) {
          entries.push({
            parameterKey: parameter.key,
            rowKey: sm.key,
            rawPercentage: bestBandPercentage(sm.bands),
            statusKey: "fully_implemented",
          });
        }
      } else if (parameter.inputType === "BOOLEAN") {
        entries.push({
          parameterKey: parameter.key,
          rowKey: "main",
          booleanCapability: true,
          statusKey: "fully_implemented",
        });
      }
    }
  }
  return entries;
}

/** Builds entries identical to buildPerfectEntries but with every status set to "absent". */
export function buildAbsentEntries(rubric: ResolvedRubric): EntryInput[] {
  return buildPerfectEntries(rubric).map((e) => ({ ...e, statusKey: "absent" }));
}

/** Builds a perfect entry set but overrides the Digital Transactions percentage, for exercising the v2 unresolved band. */
export function buildV2EntriesWithUnresolvedDigitalTransactions(rubric: ResolvedRubric, pct = 35): EntryInput[] {
  return buildPerfectEntries(rubric).map((e) =>
    e.parameterKey === "consumer_behavior" && e.rowKey === "digital_transactions"
      ? { ...e, rawPercentage: pct }
      : e
  );
}
