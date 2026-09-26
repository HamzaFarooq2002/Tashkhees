import { describe, expect, it } from "vitest";
import { RUBRIC_V2 } from "@/lib/rubric/rubric-v2";
import { deriveScoredRows, deriveUnresolvedRules, validateRubricDef } from "@/lib/rubric/rows";
import { toResolvedRubric } from "@/lib/rubric/toResolved";
import { computeScore, type EntryInput } from "@/lib/scoring/engine";
import { buildPerfectEntries, buildV2EntriesWithUnresolvedDigitalTransactions } from "./fixtures";

const rubric = toResolvedRubric(RUBRIC_V2);

function getRow(result: ReturnType<typeof computeScore>, parameterKey: string, rowKey: string) {
  for (const category of result.categories) {
    for (const parameter of category.parameters) {
      if (parameter.parameterKey !== parameterKey) continue;
      const row = parameter.rows.find((r) => r.rowKey === rowKey);
      if (row) return row;
    }
  }
  return undefined;
}

describe("RUBRIC_V2 structural checks", () => {
  it("has no structural validation issues", () => {
    expect(validateRubricDef(RUBRIC_V2)).toEqual([]);
  });

  it("still has exactly 24 scored rows", () => {
    expect(deriveScoredRows(RUBRIC_V2).length).toBe(24);
  });

  it("declares exactly one unresolved rule: consumer_behavior.digital_transactions", () => {
    const rules = deriveUnresolvedRules(RUBRIC_V2);
    expect(rules).toEqual([
      {
        parameterKey: "consumer_behavior",
        subMetricKey: "digital_transactions",
        description: expect.stringContaining("30–40%"),
      },
    ]);
  });
});

describe("digital transactions 30-40% gap (spec section 12, test case L)", () => {
  it("35% resolves to an unresolved row: null contribution, isComplete false", () => {
    const entries = buildV2EntriesWithUnresolvedDigitalTransactions(rubric, 35);
    const result = computeScore(rubric, entries);

    const row = getRow(result, "consumer_behavior", "digital_transactions")!;
    expect(row.state).toBe("unresolved");
    expect(row.rowContribution).toBeNull();
    expect(row.rowScore).toBeNull();
    expect(row.capabilityMultiplier).toBeNull();
    expect(row.unresolvedBand?.sourceLabel).toBe("30–40%");

    expect(result.isComplete).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.totalScore).toBeNull();
    expect(result.rowStateCounts.unresolved).toBe(1);

    const issue = result.issues.find((i) => i.code === "UNRESOLVED_SCORING_RULE");
    expect(issue).toBeDefined();
    expect(issue?.parameterKey).toBe("consumer_behavior");
    expect(issue?.rowKey).toBe("digital_transactions");
  });

  it("25% still resolves normally to multiplier 0.8 (regression: only 30-40 is a gap)", () => {
    const entries = buildV2EntriesWithUnresolvedDigitalTransactions(rubric, 25);
    const result = computeScore(rubric, entries);
    const row = getRow(result, "consumer_behavior", "digital_transactions")!;
    expect(row.state).toBe("complete");
    expect(row.capabilityMultiplier).toBe("0.8");
  });

  it("35% with no status answered reports MISSING_STATUS, not UNRESOLVED_SCORING_RULE (status is still a precondition)", () => {
    const entries: EntryInput[] = buildV2EntriesWithUnresolvedDigitalTransactions(rubric, 35).map((e) =>
      e.parameterKey === "consumer_behavior" && e.rowKey === "digital_transactions"
        ? { ...e, statusKey: undefined }
        : e
    );
    const result = computeScore(rubric, entries);
    expect(
      result.errors.some(
        (e) => e.parameterKey === "consumer_behavior" && e.rowKey === "digital_transactions" && e.code === "MISSING_STATUS"
      )
    ).toBe(true);
    expect(result.issues.some((i) => i.code === "UNRESOLVED_SCORING_RULE")).toBe(false);
  });

  it("a perfect v2 assessment (which never lands in the gap) still scores exactly 100", () => {
    const result = computeScore(rubric, buildPerfectEntries(rubric));
    expect(result.isComplete).toBe(true);
    expect(result.totalScore).toBe("100");
  });
});
