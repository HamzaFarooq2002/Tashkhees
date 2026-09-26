/**
 * One-off repair for checklist (SUBPARAM) rows saved before "Confirm availability selections" recorded
 * unticked contributors as explicitly not present. Such rows are confirmed but missing keys, so the
 * engine reports INCOMPLETE_CONTRIBUTOR_ANSWERS and the draft can't be submitted.
 *
 * For every DRAFT evaluation, each confirmed SUBPARAM entry gets `false` for any contributor with no
 * answer — exactly what clicking Confirm now does. Submitted evaluations are never touched (their
 * results are frozen snapshots). Each evaluation's revision is bumped in the same transaction so an
 * open editor gets the normal "changed elsewhere, reload" prompt. Idempotent: re-running changes nothing.
 *
 * Usage: npx tsx prisma/scripts/backfill-subparam-availability.ts [--dry-run]
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  // contributor keys per SUBPARAM parameter, per rubric version
  const parameters = await prisma.parameter.findMany({
    where: { inputType: "SUBPARAM" },
    select: {
      key: true,
      category: { select: { rubricVersionId: true } },
      subParameters: { select: { key: true } },
    },
  });
  const contributorKeys = new Map<string, string[]>();
  for (const p of parameters) {
    contributorKeys.set(`${p.category.rubricVersionId}::${p.key}`, p.subParameters.map((sp) => sp.key));
  }

  const drafts = await prisma.evaluation.findMany({
    where: { status: "DRAFT", entries: { some: { availabilityConfirmed: true } } },
    select: {
      id: true,
      revision: true,
      rubricVersionId: true,
      entries: {
        where: { availabilityConfirmed: true },
        select: { id: true, parameterKey: true, availability: true },
      },
    },
  });

  let evaluationsFixed = 0;
  let rowsFixed = 0;
  let skippedConcurrent = 0;

  for (const evaluation of drafts) {
    const updates: { id: string; parameterKey: string; availability: Record<string, boolean> }[] = [];
    for (const entry of evaluation.entries) {
      const keys = contributorKeys.get(`${evaluation.rubricVersionId}::${entry.parameterKey}`);
      if (!keys) continue; // not a SUBPARAM parameter
      const current = (entry.availability as Record<string, boolean> | null) ?? {};
      const missing = keys.filter((k) => current[k] !== true && current[k] !== false);
      if (missing.length === 0) continue;
      const filled = { ...current };
      for (const k of missing) filled[k] = false;
      updates.push({ id: entry.id, parameterKey: entry.parameterKey, availability: filled });
    }
    if (updates.length === 0) continue;

    console.log(
      `${dryRun ? "[dry-run] " : ""}evaluation ${evaluation.id}: ${updates.map((u) => u.parameterKey).join(", ")}`
    );
    if (dryRun) {
      evaluationsFixed++;
      rowsFixed += updates.length;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Only apply if nobody saved in the meantime and it is still a draft.
        const { count } = await tx.evaluation.updateMany({
          where: { id: evaluation.id, status: "DRAFT", revision: evaluation.revision },
          data: { revision: { increment: 1 } },
        });
        if (count !== 1) throw new ConcurrentChange();
        for (const u of updates) {
          await tx.evaluationEntry.update({
            where: { id: u.id },
            data: { availability: u.availability as Prisma.InputJsonValue },
          });
        }
      });
      evaluationsFixed++;
      rowsFixed += updates.length;
    } catch (err) {
      if (!(err instanceof ConcurrentChange)) throw err;
      skippedConcurrent++;
      console.warn(`  skipped: evaluation ${evaluation.id} changed during the run — re-run the script`);
    }
  }

  console.log(
    `\n${dryRun ? "[dry-run] would fix" : "Fixed"} ${rowsFixed} row(s) across ${evaluationsFixed} draft evaluation(s).` +
      (skippedConcurrent ? ` Skipped ${skippedConcurrent} (changed concurrently).` : "")
  );
}

class ConcurrentChange extends Error {}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
