import { PrismaClient, ParameterInputType, BandResolutionState, type Prisma } from "@prisma/client";
import type { RubricDef } from "../src/lib/rubric/types";
import { RUBRIC_V1 } from "../src/lib/rubric/rubric-v1";
import { RUBRIC_V2 } from "../src/lib/rubric/rubric-v2";
import { validateRubricDef, deriveUnresolvedRules } from "../src/lib/rubric/rows";
import { computeConfigHash } from "../src/lib/rubric/configHash";
import { ENGINE_VERSION } from "../src/lib/scoring/engine-version";

const prisma = new PrismaClient();

function num(n: number): string {
  // Pass values through as strings so Prisma writes the exact decimal
  // literal, never a binary-float approximation, into Decimal columns.
  return n.toString();
}

async function seedRubricVersion(def: RubricDef): Promise<void> {
  const issues = validateRubricDef(def);
  if (issues.length > 0) {
    console.error(`Refusing to seed version ${def.version}: rubric definition failed structural validation:`);
    for (const issue of issues) console.error(` - ${issue.message}`);
    process.exit(1);
  }

  const configHash = computeConfigHash(def);
  const unresolvedRules = deriveUnresolvedRules(def) as unknown as Prisma.InputJsonValue;

  const existing = await prisma.rubricVersion.findUnique({
    where: { version: def.version },
  });

  if (existing) {
    if (existing.isPublished) {
      // Idempotent reruns are fine as long as nothing has changed; a
      // published version must never be silently rewritten, since
      // submitted evaluations are pinned to it.
      if (existing.configHash && existing.configHash !== configHash) {
        console.error(
          `Refusing to seed: published rubric version ${def.version} configHash mismatch — ` +
            `RUBRIC_V${def.version} was edited after publishing. Bump the version instead.`
        );
        process.exit(1);
      }
      if (!existing.configHash) {
        // Migration-time placeholder ("") — backfill real metadata without touching scoring rows.
        await prisma.rubricVersion.update({
          where: { id: existing.id },
          data: { configHash, engineVersion: ENGINE_VERSION, unresolvedRules },
        });
        console.log(`Backfilled metadata (configHash/engineVersion/unresolvedRules) for published version ${def.version}.`);
      } else {
        console.log(`Rubric version ${def.version} already exists and is published. Skipping.`);
      }
      return;
    }
  }

  // ~150 sequential inserts: fine locally, but against a remote database each one is a network round
  // trip, which blows past Prisma's default 5 s interactive-transaction timeout. Still one atomic
  // transaction — a failure leaves no half-seeded rubric behind.
  await prisma.$transaction(async (tx) => {
    const rubricVersion = existing
      ? await tx.rubricVersion.update({
          where: { id: existing.id },
          data: { label: def.label, configHash, engineVersion: ENGINE_VERSION, unresolvedRules },
        })
      : await tx.rubricVersion.create({
          data: {
            version: def.version,
            label: def.label,
            isPublished: false,
            configHash,
            engineVersion: ENGINE_VERSION,
            unresolvedRules,
          },
        });

    if (existing) {
      // Unpublished draft version: wipe and re-write its config so the
      // seed script stays a pure function of the definition during development.
      await tx.category.deleteMany({ where: { rubricVersionId: rubricVersion.id } });
      await tx.statusOption.deleteMany({ where: { rubricVersionId: rubricVersion.id } });
    }

    for (const [i, status] of def.statusOptions.entries()) {
      await tx.statusOption.create({
        data: {
          rubricVersionId: rubricVersion.id,
          key: status.key,
          label: status.label,
          score: num(status.score),
          sortOrder: i,
        },
      });
    }

    for (const [ci, category] of def.categories.entries()) {
      const categoryRow = await tx.category.create({
        data: {
          rubricVersionId: rubricVersion.id,
          key: category.key,
          name: category.name,
          weight: num(category.weight),
          sortOrder: ci,
        },
      });

      for (const [pi, parameter] of category.parameters.entries()) {
        const parameterRow = await tx.parameter.create({
          data: {
            categoryId: categoryRow.id,
            key: parameter.key,
            name: parameter.name,
            weight: num(parameter.weight),
            inputType: parameter.inputType as ParameterInputType,
            sortOrder: pi,
            booleanYesMultiplier:
              parameter.booleanYesMultiplier !== undefined ? num(parameter.booleanYesMultiplier) : null,
            booleanNoMultiplier:
              parameter.booleanNoMultiplier !== undefined ? num(parameter.booleanNoMultiplier) : null,
          },
        });

        for (const [oi, option] of (parameter.standardOptions ?? []).entries()) {
          await tx.standardOption.create({
            data: {
              parameterId: parameterRow.id,
              key: option.key,
              label: option.label,
              multiplier: num(option.multiplier),
              sortOrder: oi,
            },
          });
        }

        for (const [si, sub] of (parameter.subParameters ?? []).entries()) {
          await tx.subParameter.create({
            data: {
              parameterId: parameterRow.id,
              key: sub.key,
              label: sub.label,
              contributorWeight: num(sub.contributorWeight),
              sortOrder: si,
            },
          });
        }

        for (const [bi, band] of (parameter.bands ?? []).entries()) {
          await tx.band.create({
            data: {
              parameterId: parameterRow.id,
              lowerBound: num(band.lower),
              upperBound: num(band.upper),
              upperInclusive: band.upperInclusive,
              multiplier: band.multiplier !== null ? num(band.multiplier) : null,
              sourceLabel: band.sourceLabel ?? null,
              resolutionState: (band.resolutionState ?? "RESOLVED") as BandResolutionState,
              note: band.note ?? null,
              sortOrder: bi,
            },
          });
        }

        for (const [smi, subMetric] of (parameter.subMetrics ?? []).entries()) {
          const subMetricRow = await tx.subMetric.create({
            data: {
              parameterId: parameterRow.id,
              key: subMetric.key,
              label: subMetric.label,
              splitWeight: num(subMetric.splitWeight),
              sortOrder: smi,
            },
          });

          for (const [bi, band] of subMetric.bands.entries()) {
            await tx.band.create({
              data: {
                subMetricId: subMetricRow.id,
                lowerBound: num(band.lower),
                upperBound: num(band.upper),
                upperInclusive: band.upperInclusive,
                multiplier: band.multiplier !== null ? num(band.multiplier) : null,
                sourceLabel: band.sourceLabel ?? null,
                resolutionState: (band.resolutionState ?? "RESOLVED") as BandResolutionState,
                note: band.note ?? null,
                sortOrder: bi,
              },
            });
          }
        }
      }
    }

    await tx.rubricVersion.update({
      where: { id: rubricVersion.id },
      data: { isPublished: true, publishedAt: new Date() },
    });
  }, { maxWait: 30_000, timeout: 180_000 });

  console.log(`Seeded and published rubric version ${def.version}.`);
}

async function main() {
  await seedRubricVersion(RUBRIC_V1);
  await seedRubricVersion(RUBRIC_V2);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
