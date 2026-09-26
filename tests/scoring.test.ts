import { describe, expect, it } from "vitest";
import { RUBRIC_V1 } from "@/lib/rubric/rubric-v1";
import { deriveScoredRows, validateRubricDef } from "@/lib/rubric/rows";
import { toResolvedRubric } from "@/lib/rubric/toResolved";
import { computeScore, type EntryInput } from "@/lib/scoring/engine";
import { formatDisplay, Decimal } from "@/lib/scoring/decimal-config";
import { buildAbsentEntries, buildPerfectEntries } from "./fixtures";

const rubric = toResolvedRubric(RUBRIC_V1);

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

function getParameter(result: ReturnType<typeof computeScore>, parameterKey: string) {
  for (const category of result.categories) {
    const parameter = category.parameters.find((p) => p.parameterKey === parameterKey);
    if (parameter) return parameter;
  }
  return undefined;
}

function getCategory(result: ReturnType<typeof computeScore>, categoryKey: string) {
  return result.categories.find((c) => c.categoryKey === categoryKey);
}

describe("rubric Key structural checks", () => {
  it("has no structural validation issues", () => {
    expect(validateRubricDef(RUBRIC_V1)).toEqual([]);
  });

  it("has exactly 24 scored rows: 6 technical, 7 operational, 11 financial inclusion", () => {
    const rows = deriveScoredRows(RUBRIC_V1);
    expect(rows.length).toBe(24);
    expect(rows.filter((r) => r.categoryKey === "technical").length).toBe(6);
    expect(rows.filter((r) => r.categoryKey === "operational").length).toBe(7);
    expect(rows.filter((r) => r.categoryKey === "financial_inclusion").length).toBe(11);
  });

  it("category weights sum to 1", () => {
    const sum = RUBRIC_V1.categories.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("parameter weights within each category sum to 1", () => {
    for (const category of RUBRIC_V1.categories) {
      const sum = category.parameters.reduce((s, p) => s + p.weight, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });
});

describe("perfect assessment", () => {
  const result = computeScore(rubric, buildPerfectEntries(rubric));

  it("is fully resolved with no errors", () => {
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("scores exactly 100 overall", () => {
    expect(result.totalScore).not.toBeNull();
    expect(new Decimal(result.totalScore!).toString()).toBe("100");
  });

  it("scores exactly 40/35/25 per category", () => {
    expect(new Decimal(getCategory(result, "technical")!.contribution).toString()).toBe("40");
    expect(new Decimal(getCategory(result, "operational")!.contribution).toString()).toBe("35");
    expect(new Decimal(getCategory(result, "financial_inclusion")!.contribution).toString()).toBe("25");
  });

  it("maxRowContribution sums match declared category maxima", () => {
    expect(new Decimal(getCategory(result, "technical")!.maxContribution).toString()).toBe("40");
    expect(new Decimal(getCategory(result, "operational")!.maxContribution).toString()).toBe("35");
    expect(new Decimal(getCategory(result, "financial_inclusion")!.maxContribution).toString()).toBe("25");
  });
});

describe("absent status always yields zero", () => {
  const result = computeScore(rubric, buildAbsentEntries(rubric));

  it("scores exactly 0 overall despite maximum capability selections", () => {
    expect(result.totalScore).not.toBeNull();
    expect(new Decimal(result.totalScore!).toString()).toBe("0");
  });
});

describe("zero capability yields zero regardless of status", () => {
  it("messaging standards 'No Standard' with Fully Implemented status scores 0", () => {
    const entries = buildPerfectEntries(rubric).map((e) =>
      e.parameterKey === "messaging_standards"
        ? { ...e, standardKey: "no_standard", statusKey: "fully_implemented" }
        : e
    );
    const result = computeScore(rubric, entries);
    const row = getRow(result, "messaging_standards", "main")!;
    expect(new Decimal(row.rowContribution!).toString()).toBe("0");
  });
});

describe("worked examples from the specification", () => {
  it("Example A — Messaging Standards: ISO8583 + Partially Implemented = 4.50 contribution", () => {
    const entries: EntryInput[] = [
      { parameterKey: "messaging_standards", rowKey: "main", standardKey: "iso8583", statusKey: "partially_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "messaging_standards", "main")!;
    expect(new Decimal(row.rowScore!).toString()).toBe("2.25");
    expect(new Decimal(row.rowContribution!).toString()).toBe("4.5");
    expect(formatDisplay(new Decimal(row.rowContribution!))).toBe("4.50");
  });

  it("Example B — Access Channels: 0.70 coverage + Fully Implemented = 4.76 out of 6.80", () => {
    const entries: EntryInput[] = [
      {
        parameterKey: "access_channels",
        rowKey: "main",
        availability: { mobile_banking: true, internet_banking: true, ussd: true, atm: false, branches: false },
        availabilityConfirmed: true,
        statusKey: "fully_implemented",
      },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "access_channels", "main")!;
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe("0.7");
    expect(new Decimal(row.rowScore!).toString()).toBe("2.38");
    expect(formatDisplay(new Decimal(row.rowContribution!))).toBe("4.76");
    expect(formatDisplay(new Decimal(row.maxRowContribution))).toBe("6.80");
  });

  it("Example C — Financial Inclusion: 80% + Partially Implemented = 2.03 out of 3.75", () => {
    const entries: EntryInput[] = [
      { parameterKey: "financial_inclusion", rowKey: "main", rawPercentage: 80, statusKey: "partially_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "financial_inclusion", "main")!;
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe("0.9");
    expect(new Decimal(row.rowScore!).toString()).toBe("1.0125");
    expect(formatDisplay(new Decimal(row.rowContribution!))).toBe("2.03");
    expect(formatDisplay(new Decimal(row.maxRowContribution))).toBe("3.75");
  });

  it("Example D — Mobile Penetration: smartphone 45%/Fully + feature-phone 25%/Partially = 2.82 out of 3.75", () => {
    const entries: EntryInput[] = [
      { parameterKey: "mobile_penetration", rowKey: "smartphone", rawPercentage: 45, statusKey: "fully_implemented" },
      { parameterKey: "mobile_penetration", rowKey: "feature_phone", rawPercentage: 25, statusKey: "partially_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const parameter = getParameter(result, "mobile_penetration")!;
    expect(formatDisplay(new Decimal(parameter.contribution))).toBe("2.82");
    expect(formatDisplay(new Decimal(parameter.maxContribution))).toBe("3.75");
  });

  it("Example E — Cash Dominance: 5% + Fully Implemented = 2.25 out of 2.50", () => {
    const entries: EntryInput[] = [
      { parameterKey: "cash_dominance", rowKey: "main", rawPercentage: 5, statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "cash_dominance", "main")!;
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe("0.9");
    expect(formatDisplay(new Decimal(row.rowContribution!))).toBe("2.25");
    expect(formatDisplay(new Decimal(row.maxRowContribution))).toBe("2.50");
  });
});

describe("Unique Citizen ID", () => {
  it("Yes + Fully Implemented contributes exactly 5", () => {
    const entries: EntryInput[] = [
      { parameterKey: "unique_citizen_id", rowKey: "main", booleanCapability: true, statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "unique_citizen_id", "main")!;
    expect(formatDisplay(new Decimal(row.rowContribution!))).toBe("5.00");
    expect(formatDisplay(new Decimal(row.maxRowContribution))).toBe("5.00");
  });

  it("No + Fully Implemented contributes exactly 0", () => {
    const entries: EntryInput[] = [
      { parameterKey: "unique_citizen_id", rowKey: "main", booleanCapability: false, statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "unique_citizen_id", "main")!;
    expect(new Decimal(row.rowContribution!).toString()).toBe("0");
  });

  it("is reported missing when unanswered (not defaulted to No)", () => {
    const entries: EntryInput[] = [{ parameterKey: "unique_citizen_id", rowKey: "main", statusKey: "fully_implemented" }];
    const result = computeScore(rubric, entries);
    expect(result.errors.some((e) => e.parameterKey === "unique_citizen_id" && e.code === "MISSING_BOOLEAN")).toBe(
      true
    );
  });
});

describe("band boundaries", () => {
  const cases: { pct: number; expectedMultiplier: string }[] = [
    { pct: 0, expectedMultiplier: "0.1" },
    { pct: 19.999, expectedMultiplier: "0.1" },
    { pct: 20, expectedMultiplier: "0.3" },
    { pct: 49.999, expectedMultiplier: "0.3" },
    { pct: 50, expectedMultiplier: "0.6" },
    { pct: 79.999, expectedMultiplier: "0.6" },
    { pct: 80, expectedMultiplier: "0.9" },
    { pct: 89.999, expectedMultiplier: "0.9" },
    { pct: 90, expectedMultiplier: "1" },
    { pct: 100, expectedMultiplier: "1" },
  ];

  it.each(cases)("Financial Inclusion at $pct% resolves to multiplier $expectedMultiplier", ({ pct, expectedMultiplier }) => {
    const entries: EntryInput[] = [
      { parameterKey: "financial_inclusion", rowKey: "main", rawPercentage: pct, statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "financial_inclusion", "main")!;
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe(expectedMultiplier);
  });

  it("Cash Dominance (lower is better) boundaries resolve correctly", () => {
    const table: [number, string][] = [
      [0, "1"],
      [4.999, "1"],
      [5, "0.9"],
      [9.999, "0.9"],
      [10, "0.7"],
      [14.999, "0.7"],
      [15, "0.2"],
      [100, "0.2"],
    ];
    for (const [pct, expected] of table) {
      const entries: EntryInput[] = [
        { parameterKey: "cash_dominance", rowKey: "main", rawPercentage: pct, statusKey: "fully_implemented" },
      ];
      const result = computeScore(rubric, entries);
      const row = getRow(result, "cash_dominance", "main")!;
      expect(new Decimal(row.capabilityMultiplier!).toString()).toBe(expected);
    }
  });
});

describe("submission completeness", () => {
  it("rejects a submission missing any of the 24 rows", () => {
    const entries = buildPerfectEntries(rubric).slice(0, 23);
    const result = computeScore(rubric, entries);
    expect(result.ok).toBe(false);
    expect(result.totalScore).toBeNull();
    expect(result.errors.length).toBe(1);
  });

  it("rejects an unconfirmed availability group even if some boxes are checked", () => {
    const entries = buildPerfectEntries(rubric).map((e) =>
      e.parameterKey === "access_channels" ? { ...e, availabilityConfirmed: false } : e
    );
    const result = computeScore(rubric, entries);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.parameterKey === "access_channels" && e.code === "AVAILABILITY_NOT_CONFIRMED")
    ).toBe(true);
  });

  it("rejects an unknown standard option", () => {
    const entries = buildPerfectEntries(rubric).map((e) =>
      e.parameterKey === "messaging_standards" ? { ...e, standardKey: "sepa_instant" } : e
    );
    const result = computeScore(rubric, entries);
    expect(result.errors.some((e) => e.code === "UNKNOWN_STANDARD")).toBe(true);
  });

  it("rejects a missing status even when capability is answered", () => {
    const entries = buildPerfectEntries(rubric).map((e) =>
      e.parameterKey === "gender_inclusion" ? { ...e, statusKey: undefined } : e
    );
    const result = computeScore(rubric, entries);
    expect(result.errors.some((e) => e.parameterKey === "gender_inclusion" && e.code === "MISSING_STATUS")).toBe(
      true
    );
  });
});

describe("contributor coverage is counted once, not per checkbox", () => {
  it("Access Channels produces exactly one scored row regardless of how many contributors are present", () => {
    const entries: EntryInput[] = [
      {
        parameterKey: "access_channels",
        rowKey: "main",
        availability: { mobile_banking: true, internet_banking: true, ussd: true, atm: true, branches: true },
        availabilityConfirmed: true,
        statusKey: "fully_implemented",
      },
    ];
    const result = computeScore(rubric, entries);
    const parameter = getParameter(result, "access_channels")!;
    expect(parameter.rows.length).toBe(1);
  });
});

describe("partial checklist selections (editor's Confirm writes explicit false for unticked items)", () => {
  const ticked = ["p2p", "p2m", "p2g", "g2p"];
  const allKeys = ["p2p", "p2m", "p2g", "g2p", "g2g", "b2b", "b2c", "b2g", "c2b"];

  it("scores coverage from the ticked contributors once the rest are explicitly false", () => {
    const availability = Object.fromEntries(allKeys.map((k) => [k, ticked.includes(k)]));
    const entries: EntryInput[] = [
      {
        parameterKey: "use_cases_services_enabled",
        rowKey: "main",
        availability,
        availabilityConfirmed: true,
        statusKey: "fully_implemented",
      },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "use_cases_services_enabled", "main")!;
    expect(row).toBeDefined();
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe("0.6"); // 0.2 + 0.2 + 0.1 + 0.1
    expect(result.errors.some((e) => e.parameterKey === "use_cases_services_enabled")).toBe(false);
  });

  it("still reports unanswered contributors when only the ticked ones are recorded", () => {
    const entries: EntryInput[] = [
      {
        parameterKey: "use_cases_services_enabled",
        rowKey: "main",
        availability: Object.fromEntries(ticked.map((k) => [k, true])),
        availabilityConfirmed: true,
        statusKey: "fully_implemented",
      },
    ];
    const result = computeScore(rubric, entries);
    expect(
      result.errors.some(
        (e) => e.parameterKey === "use_cases_services_enabled" && e.code === "INCOMPLETE_CONTRIBUTOR_ANSWERS"
      )
    ).toBe(true);
  });
});

describe("spec section 19 worked examples", () => {
  it("A — Messaging Standards: ISO 20022 + Fully Implemented = 10", () => {
    const entries: EntryInput[] = [
      { parameterKey: "messaging_standards", rowKey: "main", standardKey: "iso20022", statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "messaging_standards", "main")!;
    expect(new Decimal(row.rowContribution!).toString()).toBe("10");
  });

  it("B — APIs for Payments: Proprietary Bank APIs + Fragmented/Uneven = 1.456", () => {
    const entries: EntryInput[] = [
      { parameterKey: "apis_for_payments", rowKey: "main", standardKey: "proprietary_bank_apis", statusKey: "fragmented_uneven" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "apis_for_payments", "main")!;
    expect(new Decimal(row.rowContribution!).toString()).toBe("1.456");
  });

  it("C — Access Channels: mobile+internet+branches+ussd TRUE, atm FALSE, Fully Implemented = 6.12", () => {
    const entries: EntryInput[] = [
      {
        parameterKey: "access_channels",
        rowKey: "main",
        availability: { mobile_banking: true, internet_banking: true, branches: true, ussd: true, atm: false },
        availabilityConfirmed: true,
        statusKey: "fully_implemented",
      },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "access_channels", "main")!;
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe("0.9");
    expect(new Decimal(row.rowContribution!).toString()).toBe("6.12");
  });

  it("D — Interoperability: bank_to_bank+qr TRUE, Partially Implemented = 1.89", () => {
    const entries: EntryInput[] = [
      {
        parameterKey: "interoperability",
        rowKey: "main",
        availability: { bank_to_bank: true, banks_non_banks: false, qr: true, cards: false, gateway: false, rtp: false },
        availabilityConfirmed: true,
        statusKey: "partially_implemented",
      },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "interoperability", "main")!;
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe("0.45");
    expect(new Decimal(row.rowContribution!).toString()).toBe("1.89");
  });

  it("E — Clearing & Settlement: Same Day + Fully Implemented = 5.60", () => {
    const entries: EntryInput[] = [
      { parameterKey: "clearing_settlement", rowKey: "main", standardKey: "same_day", statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "clearing_settlement", "main")!;
    expect(new Decimal(row.rowContribution!).toString()).toBe("5.6");
  });

  it("F — Dispute Resolution: only Defined Chargeback Rules TRUE, Fully Implemented = 0.70", () => {
    const entries: EntryInput[] = [
      {
        parameterKey: "dispute_resolution",
        rowKey: "main",
        availability: { centralized_dispute_resolution_mechanism: false, defined_chargeback_rules: true },
        availabilityConfirmed: true,
        statusKey: "fully_implemented",
      },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "dispute_resolution", "main")!;
    expect(new Decimal(row.rowContribution!).toString()).toBe("0.7");
  });

  it("G — Financial Inclusion: 65% + Fully Implemented = 2.25", () => {
    const entries: EntryInput[] = [
      { parameterKey: "financial_inclusion", rowKey: "main", rawPercentage: 65, statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "financial_inclusion", "main")!;
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe("0.6");
    expect(new Decimal(row.rowContribution!).toString()).toBe("2.25");
  });

  it("H — Mobile Penetration: smartphone 35%/Fully + feature-phone 35%/Fully = 2.775", () => {
    const entries: EntryInput[] = [
      { parameterKey: "mobile_penetration", rowKey: "smartphone", rawPercentage: 35, statusKey: "fully_implemented" },
      { parameterKey: "mobile_penetration", rowKey: "feature_phone", rawPercentage: 35, statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const parameter = getParameter(result, "mobile_penetration")!;
    expect(new Decimal(parameter.contribution).toString()).toBe("2.775");
  });

  it("I — Unique Citizen ID: Yes + Partially Implemented = 3", () => {
    const entries: EntryInput[] = [
      { parameterKey: "unique_citizen_id", rowKey: "main", booleanCapability: true, statusKey: "partially_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "unique_citizen_id", "main")!;
    expect(new Decimal(row.rowContribution!).toString()).toBe("3");
  });

  it("J — Cash Dominance: 12% of GDP + Fully Implemented = 1.75", () => {
    const entries: EntryInput[] = [
      { parameterKey: "cash_dominance", rowKey: "main", rawPercentage: 12, statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const row = getRow(result, "cash_dominance", "main")!;
    expect(new Decimal(row.capabilityMultiplier!).toString()).toBe("0.7");
    expect(new Decimal(row.rowContribution!).toString()).toBe("1.75");
  });

  it("K — Consumer Behavior: digital=25%, population(15-65)=55%, literacy=75%, all Fully Implemented = 2.00", () => {
    const entries: EntryInput[] = [
      { parameterKey: "consumer_behavior", rowKey: "digital_transactions", rawPercentage: 25, statusKey: "fully_implemented" },
      { parameterKey: "consumer_behavior", rowKey: "youth_population", rawPercentage: 55, statusKey: "fully_implemented" },
      { parameterKey: "consumer_behavior", rowKey: "literacy_rate", rawPercentage: 75, statusKey: "fully_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const parameter = getParameter(result, "consumer_behavior")!;
    expect(new Decimal(parameter.contribution).toString()).toBe("2");
  });
});

describe("global invariants (spec section 19.M)", () => {
  it("both formula forms agree: rowContribution === 100 × catW × paramW × splitW × capability × (statusScore/5)", () => {
    const result = computeScore(rubric, buildPerfectEntries(rubric));
    for (const category of result.categories) {
      for (const parameter of category.parameters) {
        for (const row of parameter.rows) {
          const expected = new Decimal(100)
            .mul(row.categoryWeight)
            .mul(row.parameterWeight)
            .mul(row.splitWeight)
            .mul(row.capabilityMultiplier!)
            .mul(new Decimal(row.statusScore).div(5));
          expect(new Decimal(row.rowContribution!).eq(expected)).toBe(true);
        }
      }
    }
  });

  it("rawWorkbookScore equals rowContribution / 2 for every complete row", () => {
    const result = computeScore(rubric, buildPerfectEntries(rubric));
    for (const category of result.categories) {
      for (const parameter of category.parameters) {
        for (const row of parameter.rows) {
          expect(new Decimal(row.rawWorkbookScore!).eq(new Decimal(row.rowContribution!).div(2))).toBe(true);
        }
      }
    }
  });

  it("reordering entries does not change the total score", () => {
    const entries = buildPerfectEntries(rubric);
    const forward = computeScore(rubric, entries);
    const reversed = computeScore(rubric, [...entries].reverse());
    expect(reversed.totalScore).toBe(forward.totalScore);
    for (const category of forward.categories) {
      const other = reversed.categories.find((c) => c.categoryKey === category.categoryKey)!;
      expect(other.contribution).toBe(category.contribution);
    }
  });

  it("a duplicate contributor entry cannot increase coverage (first match wins, not summed)", () => {
    const entries = buildPerfectEntries(rubric);
    const withDuplicate = [
      ...entries,
      {
        parameterKey: "access_channels",
        rowKey: "main",
        availability: { mobile_banking: false, internet_banking: false, branches: false, ussd: false, atm: false },
        availabilityConfirmed: true,
        statusKey: "absent",
      } satisfies EntryInput,
    ];
    const result = computeScore(rubric, withDuplicate);
    const parameter = getParameter(result, "access_channels")!;
    expect(parameter.rows.length).toBe(1);
    // findEntry uses Array.find, so the first (perfect) entry still wins.
    expect(new Decimal(parameter.contribution).toString()).toBe("6.8");
  });

  it("increasing capability multiplier, status held fixed, cannot decrease the row's contribution", () => {
    const parameter = rubric.categories
      .flatMap((c) => c.parameters)
      .find((p) => p.key === "messaging_standards")!;
    const sorted = [...parameter.standardOptions].sort((a, b) => a.multiplier.cmp(b.multiplier));
    let previous = new Decimal(-1);
    for (const option of sorted) {
      const entries: EntryInput[] = [
        { parameterKey: "messaging_standards", rowKey: "main", standardKey: option.key, statusKey: "fully_implemented" },
      ];
      const result = computeScore(rubric, entries);
      const row = getRow(result, "messaging_standards", "main")!;
      const contribution = new Decimal(row.rowContribution!);
      expect(contribution.gte(previous)).toBe(true);
      previous = contribution;
    }
  });

  it("increasing status score, capability held fixed, cannot decrease the row's contribution", () => {
    const sorted = [...rubric.statusOptions].sort((a, b) => a.score.cmp(b.score));
    let previous = new Decimal(-1);
    for (const status of sorted) {
      const entries: EntryInput[] = [
        { parameterKey: "messaging_standards", rowKey: "main", standardKey: "iso20022", statusKey: status.key },
      ];
      const result = computeScore(rubric, entries);
      const row = getRow(result, "messaging_standards", "main")!;
      const contribution = new Decimal(row.rowContribution!);
      expect(contribution.gte(previous)).toBe(true);
      previous = contribution;
    }
  });
});

describe("split statuses apply independently", () => {
  it("Consumer Behavior submetrics use their own status, not a shared one", () => {
    const entries: EntryInput[] = [
      { parameterKey: "consumer_behavior", rowKey: "digital_transactions", rawPercentage: 50, statusKey: "fully_implemented" },
      { parameterKey: "consumer_behavior", rowKey: "youth_population", rawPercentage: 55, statusKey: "absent" },
      { parameterKey: "consumer_behavior", rowKey: "literacy_rate", rawPercentage: 95, statusKey: "partially_implemented" },
    ];
    const result = computeScore(rubric, entries);
    const digital = getRow(result, "consumer_behavior", "digital_transactions")!;
    const youth = getRow(result, "consumer_behavior", "youth_population")!;
    const literacy = getRow(result, "consumer_behavior", "literacy_rate")!;
    expect(new Decimal(digital.rowContribution!).gt(0)).toBe(true);
    expect(new Decimal(youth.rowContribution!).toString()).toBe("0");
    expect(new Decimal(literacy.rowContribution!).gt(0)).toBe(true);

    const parameter = getParameter(result, "consumer_behavior")!;
    expect(formatDisplay(new Decimal(parameter.maxContribution))).toBe("2.50");
  });
});
