import "server-only";
import { prisma } from "@/lib/db";
import { loadRubricVersionById } from "@/lib/rubric/loader";
import { toFormRubric, type FormRubric } from "@/lib/rubric/formView";
import { ActionError } from "@/server/actions/shared";
import type { UnresolvedRuleRef } from "@/lib/rubric/rows";

export interface MethodologySummary {
  id: string;
  version: number;
  label: string;
  isPublished: boolean;
  publishedAt: string | null;
  engineVersion: string;
  unresolvedRules: UnresolvedRuleRef[];
}

function toSummary(row: {
  id: string;
  version: number;
  label: string;
  isPublished: boolean;
  publishedAt: Date | null;
  engineVersion: string;
  unresolvedRules: unknown;
}): MethodologySummary {
  return {
    id: row.id,
    version: row.version,
    label: row.label,
    isPublished: row.isPublished,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    engineVersion: row.engineVersion,
    unresolvedRules: (row.unresolvedRules as UnresolvedRuleRef[] | null) ?? [],
  };
}

/** Every published methodology version, newest first. Draft (unpublished) versions are never listed. */
export async function listMethodologies(): Promise<MethodologySummary[]> {
  const rows = await prisma.rubricVersion.findMany({
    where: { isPublished: true },
    orderBy: { version: "desc" },
  });
  return rows.map(toSummary);
}

export async function getMethodology(id: string): Promise<MethodologySummary & { rubric: FormRubric }> {
  const row = await prisma.rubricVersion.findUnique({ where: { id } });
  if (!row || !row.isPublished) throw new ActionError("NOT_FOUND", "Methodology version not found");
  const resolved = await loadRubricVersionById(id);
  return { ...toSummary(row), rubric: toFormRubric(resolved) };
}
