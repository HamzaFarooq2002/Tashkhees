import { createHash } from "node:crypto";
import type { RubricDef } from "./types";

/** Recursively sorts object keys so structurally-identical configs hash identically regardless of property order. Array order is preserved (it's semantically meaningful). */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

/** Deterministic sha256 hex digest of a rubric definition's full resolved config. */
export function computeConfigHash(rubric: RubricDef): string {
  const canonical = JSON.stringify(canonicalize(rubric));
  return createHash("sha256").update(canonical).digest("hex");
}
