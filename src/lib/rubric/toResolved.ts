import { Decimal } from "../scoring/decimal-config";
import type { ResolvedRubric, ResolvedCategory, ResolvedParameter } from "../scoring/resolved-types";
import type { RubricDef } from "./types";
import { computeConfigHash } from "./configHash";
import { ENGINE_VERSION } from "../scoring/engine-version";

/**
 * Converts the plain-number rubric definition into the Decimal-based shape
 * the scoring engine consumes. This exists ONLY for tests, so the scoring
 * engine can be exercised without a database connection. The running
 * application always loads a ResolvedRubric from the database
 * (`src/lib/rubric/loader.ts`) — it must never import RUBRIC_V1 directly.
 */
export function toResolvedRubric(def: RubricDef): ResolvedRubric {
  return {
    rubricVersionId: `test-v${def.version}`,
    version: def.version,
    configHash: computeConfigHash(def),
    engineVersion: ENGINE_VERSION,
    statusOptions: def.statusOptions.map((s) => ({
      key: s.key,
      label: s.label,
      score: new Decimal(s.score),
    })),
    categories: def.categories.map(
      (c): ResolvedCategory => ({
        key: c.key,
        name: c.name,
        weight: new Decimal(c.weight),
        parameters: c.parameters.map(
          (p): ResolvedParameter => ({
            key: p.key,
            name: p.name,
            weight: new Decimal(p.weight),
            inputType: p.inputType,
            standardOptions: (p.standardOptions ?? []).map((o) => ({
              key: o.key,
              label: o.label,
              multiplier: new Decimal(o.multiplier),
            })),
            subParameters: (p.subParameters ?? []).map((sp) => ({
              key: sp.key,
              label: sp.label,
              contributorWeight: new Decimal(sp.contributorWeight),
            })),
            bands: (p.bands ?? []).map((b) => ({
              lower: new Decimal(b.lower),
              upper: new Decimal(b.upper),
              upperInclusive: b.upperInclusive,
              multiplier: b.multiplier !== null ? new Decimal(b.multiplier) : null,
              sourceLabel: b.sourceLabel ?? null,
              resolutionState: b.resolutionState ?? "RESOLVED",
              note: b.note ?? null,
            })),
            subMetrics: (p.subMetrics ?? []).map((sm) => ({
              key: sm.key,
              label: sm.label,
              splitWeight: new Decimal(sm.splitWeight),
              bands: sm.bands.map((b) => ({
                lower: new Decimal(b.lower),
                upper: new Decimal(b.upper),
                upperInclusive: b.upperInclusive,
                multiplier: b.multiplier !== null ? new Decimal(b.multiplier) : null,
                sourceLabel: b.sourceLabel ?? null,
                resolutionState: b.resolutionState ?? "RESOLVED",
                note: b.note ?? null,
              })),
            })),
            booleanYesMultiplier:
              p.booleanYesMultiplier !== undefined ? new Decimal(p.booleanYesMultiplier) : undefined,
            booleanNoMultiplier:
              p.booleanNoMultiplier !== undefined ? new Decimal(p.booleanNoMultiplier) : undefined,
          })
        ),
      })
    ),
  };
}
