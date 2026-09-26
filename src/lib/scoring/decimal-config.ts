import Decimal from "decimal.js";

// High precision, no intermediate rounding. Final display rounding is applied
// explicitly with ROUND_HALF_UP via `roundDisplay` — never rely on the global
// rounding mode for that, since it also affects internal Decimal division.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

export { Decimal };

/** Round a Decimal to 2 places using ROUND_HALF_UP, per the scoring spec. */
export function roundDisplay(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function formatDisplay(value: Decimal): string {
  return roundDisplay(value).toFixed(2);
}
