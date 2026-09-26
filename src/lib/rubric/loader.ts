import "server-only";
import { prisma } from "@/lib/db";
import { Decimal } from "@/lib/scoring/decimal-config";
import type { ResolvedRubric } from "@/lib/scoring/resolved-types";
import type { StatusKey } from "./types";

const rubricInclude = {
  statusOptions: { orderBy: { sortOrder: "asc" as const } },
  categories: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      parameters: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          standardOptions: { orderBy: { sortOrder: "asc" as const } },
          subParameters: { orderBy: { sortOrder: "asc" as const } },
          bands: { orderBy: { sortOrder: "asc" as const } },
          subMetrics: {
            orderBy: { sortOrder: "asc" as const },
            include: { bands: { orderBy: { sortOrder: "asc" as const } } },
          },
        },
      },
    },
  },
} as const;

type RawRubricVersion = NonNullable<
  Awaited<ReturnType<typeof fetchRubricVersionById>>
>;

async function fetchRubricVersionById(id: string) {
  return prisma.rubricVersion.findUnique({ where: { id }, include: rubricInclude });
}

async function fetchPublishedRubricVersion() {
  return prisma.rubricVersion.findFirst({
    where: { isPublished: true },
    orderBy: { version: "desc" },
    include: rubricInclude,
  });
}

function toResolved(raw: RawRubricVersion): ResolvedRubric {
  return {
    rubricVersionId: raw.id,
    version: raw.version,
    configHash: raw.configHash,
    engineVersion: raw.engineVersion,
    statusOptions: raw.statusOptions.map((s) => ({
      key: s.key as StatusKey,
      label: s.label,
      score: new Decimal(s.score.toString()),
    })),
    categories: raw.categories.map((c) => ({
      key: c.key,
      name: c.name,
      weight: new Decimal(c.weight.toString()),
      parameters: c.parameters.map((p) => ({
        key: p.key,
        name: p.name,
        weight: new Decimal(p.weight.toString()),
        inputType: p.inputType,
        standardOptions: p.standardOptions.map((o) => ({
          key: o.key,
          label: o.label,
          multiplier: new Decimal(o.multiplier.toString()),
        })),
        subParameters: p.subParameters.map((sp) => ({
          key: sp.key,
          label: sp.label,
          contributorWeight: new Decimal(sp.contributorWeight.toString()),
        })),
        bands: p.bands.map((b) => ({
          lower: new Decimal(b.lowerBound.toString()),
          upper: new Decimal(b.upperBound.toString()),
          upperInclusive: b.upperInclusive,
          multiplier: b.multiplier !== null ? new Decimal(b.multiplier.toString()) : null,
          sourceLabel: b.sourceLabel,
          resolutionState: b.resolutionState,
          note: b.note,
        })),
        subMetrics: p.subMetrics.map((sm) => ({
          key: sm.key,
          label: sm.label,
          splitWeight: new Decimal(sm.splitWeight.toString()),
          bands: sm.bands.map((b) => ({
            lower: new Decimal(b.lowerBound.toString()),
            upper: new Decimal(b.upperBound.toString()),
            upperInclusive: b.upperInclusive,
            multiplier: b.multiplier !== null ? new Decimal(b.multiplier.toString()) : null,
            sourceLabel: b.sourceLabel,
            resolutionState: b.resolutionState,
            note: b.note,
          })),
        })),
        booleanYesMultiplier:
          p.booleanYesMultiplier !== null ? new Decimal(p.booleanYesMultiplier.toString()) : undefined,
        booleanNoMultiplier:
          p.booleanNoMultiplier !== null ? new Decimal(p.booleanNoMultiplier.toString()) : undefined,
      })),
    })),
  };
}

/**
 * Rubric versions are immutable once created (changes ship as a new version with a new configHash —
 * see SCORING_DECISIONS.md), so a resolved version can be cached for the life of the process. This
 * removes a deep nested query from every autosave. Failed loads are evicted so they can be retried.
 */
const rubricByIdCache = new Map<string, Promise<ResolvedRubric>>();

/** Loads a specific rubric version by id — used when scoring an existing evaluation, which is pinned to the version it was created with. */
export function loadRubricVersionById(id: string): Promise<ResolvedRubric> {
  const cached = rubricByIdCache.get(id);
  if (cached) return cached;

  const pending = fetchRubricVersionById(id).then((raw) => {
    if (!raw) throw new Error(`Rubric version ${id} not found`);
    return toResolved(raw);
  });
  rubricByIdCache.set(id, pending);
  pending.catch(() => rubricByIdCache.delete(id));
  return pending;
}

/** Loads the current published rubric version — used only when creating a new evaluation. */
export async function loadPublishedRubricVersion(): Promise<ResolvedRubric> {
  const raw = await fetchPublishedRubricVersion();
  if (!raw) throw new Error("No published rubric version found — run the seed script");
  return toResolved(raw);
}
