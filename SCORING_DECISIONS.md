# Scoring decisions

This document records methodology gaps, discrepancies, and modeling decisions in the Tashkhees
scoring engine that are not fully resolved by the source methodology, plus decisions made during
the September 2026 corrective pass that introduced `RubricVersion` v2. It exists so these gaps are
never silently "fixed" by future edits without a new methodology version and a deliberate record
of the change.

## 1. Purpose and scope

An audit of the backend against the authoritative scoring methodology found the core formula,
decimal precision/rounding, status-score mapping, and finalize/concurrency logic already correct.
It found one genuine defect (see §3) and several gaps versus the methodology's explicit
requirements for handling unresolved rules and incomplete assessments (see §5, §6). This document
covers the decisions made while correcting those issues. Section references (e.g. "spec §12") refer
to the numbered sections of the supplied methodology document.

## 2. Mobile Penetration: 65/35 vs. legacy 80/20 split

The methodology states the primary split for Mobile Penetration (smartphone vs. feature-phone) is
65/35, which is what `src/lib/rubric/rubric-v1.ts` and `rubric-v2.ts` implement. The methodology
separately notes that existing country tabs in the source spreadsheet used an 80/20 split, and asks
that this be preserved as a separately identified, non-default configuration "if implementing
spreadsheet compatibility."

**Decision:** the 80/20 legacy split is documented here only and is **not implemented** as a second
methodology version or config flag. It is not required for correctness of the primary (65/35)
methodology, and no country data pinned to the 80/20 split currently exists in this system. If a
legacy-compatibility need arises later, it should be added as its own explicitly-labeled
`RubricVersion` (e.g. "Legacy 80/20 compatibility"), never silently mixed into v1 or v2.

## 3. Digital Transactions 30–40% gap

**This was a genuine defect, now corrected in `RubricVersion` v2.**

The methodology's Digital Transactions bands (part of Consumer Behavior) are: `<10% → 0.20`,
`10–15% → 0.40`, `15–20% → 0.60`, `20–30% → 0.80`, `>40% → 1.00`. The methodology explicitly states:
"The supplied source does not define the 30–40% band. Do not invent a multiplier for it" (spec §12),
and requires that an input landing in that range return a structured `UNRESOLVED_SCORING_RULE`
issue, save the input, leave that row's contribution `null`, and block the assessment from being
presented as complete or finalized — never substitute zero, interpolate, or silently pick a nearby
band's value.

`RubricVersion` v1 violated this: its `digital_transactions` bands merged `20–30%` and the
undefined `30–40%` range into a single band `[20, 40) → 0.8`, silently inventing a multiplier for
the undefined half.

**Correction (v2):** the band for `[30, 40)` is now modeled as a genuinely distinct band with
`multiplier: null`, `resolutionState: "UNRESOLVED"`, `sourceLabel: "30–40%"`, and an explanatory
`note`. The engine's `resolveRow()` (`src/lib/scoring/engine.ts`) detects this resolution state and
returns a row with `state: "unresolved"`, `rowContribution: null`, `rowScore: null`, and a
`UNRESOLVED_SCORING_RULE` issue — the assessment cannot be marked complete or finalized while any
row is in this state (see §5).

Per spec §12 ("Resolving a rule after a methodology has been used creates a new methodology
version"), this correction shipped as `RubricVersion` v2 rather than mutating v1's rows. Evaluations
already pinned to v1 via `Evaluation.rubricVersionId` are completely unaffected — `v1`'s
`digital_transactions` bands are unchanged, and `loadRubricVersionById` always loads the exact
version an evaluation was created against. New evaluations get v2 automatically, since
`loadPublishedRubricVersion()` picks the highest-`version` published row.

Every other row in v2 is byte-identical to v1 (the config is built by `structuredClone`-ing v1 and
patching only the one sub-metric's bands — see `src/lib/rubric/rubric-v2.ts`).

## 4. Parameter/category ID naming vs. the spec's literal names

The engine's internal parameter keys predate this audit and differ in a few places from the exact
names given in the supplied methodology document. **These were intentionally not renamed** (to avoid
touching `EvaluationEntry.parameterKey` values, form-rendering code, and other references), but the
mapping is recorded here for anyone reconciling the two:

| Codebase key                    | Spec literal name     |
| -------------------------------- | ---------------------- |
| `apis_for_payments`              | `payment_apis`         |
| `payments_network_connectivity`  | `network_connectivity` |
| `use_cases_services_enabled`     | `digital_use_cases`    |
| `multiple_banks_incl_mfbs`       | `institution_types`    |
| `financial_inclusion` (parameter key, distinct from the category of the same key) | `account_ownership` |

All weights, multipliers, and bands under these keys match the spec's values exactly — only the
identifier differs.

## 5. Per-contributor checklist "unanswered" vs. "false"

The methodology requires (§6, §13) that an unanswered checklist contributor be distinguishable from
an explicit `FALSE`, and that a row not be treated as complete until every contributor has an
explicit answer.

No schema or type change was needed for this: `EvaluationEntry.availability` is already a
`Record<string, boolean>` JSON map, so a contributor key's *absence* from the map was already
structurally distinguishable from `false` — the defect was purely that `engine.ts`'s completeness
check never inspected per-key presence, treating any missing key as `false` once the whole-row
`availabilityConfirmed` flag was set. This is now fixed: `resolveRow()`'s `SUBPARAM` branch checks
every contributor for an explicit `true`/`false` entry and returns `INCOMPLETE_CONTRIBUTOR_ANSWERS`
(listing the missing contributor keys) if any are missing, before computing coverage.

**Editor behavior.** Ticking a checkbox records only that contributor. The explicit answers for
the rest come from the row's confirm actions: **Confirm availability selections** records every
unticked contributor as `false` ("not present"), and **None present** records all of them as
`false`. Both set `availabilityConfirmed`. Changing any checkbox afterwards clears the confirmation,
so the analyst must confirm again. The editor has no way to deliberately leave a contributor
*unanswered* on a confirmed row; that state only arises from API clients or legacy data.

(An earlier version of this note claimed the editor already wrote explicit `false` for unticked
contributors. It did not: Confirm set only the flag, which left partially ticked rows stuck on
`INCOMPLETE_CONTRIBUTOR_ANSWERS`. The e2e test only exercised "None present". Draft rows saved in
that state can be repaired with `npx tsx prisma/scripts/backfill-subparam-availability.ts`, which
fills missing contributors with `false` for DRAFT evaluations only and is idempotent.)

## 6. Incomplete-assessment response shape

The methodology (§13) requires an incomplete assessment's response to include `isComplete: false`,
`totalScore: null`, `knownPoints` (points from calculable rows), `scorableMaximumPoints` (max of
only calculable rows), a fixed `totalPossiblePoints` of 100, per-state row counts, and structured
issues — and never a renormalized "complete-looking" score.

`ScoringResult` (`src/lib/scoring/engine.ts`) now returns all of these fields on every call,
complete or not: `isComplete`, `issues` (every non-complete row, tagged with a severity of
`incomplete` | `invalid` | `unresolved`), `knownPoints`, `scorableMaximumPoints` (identical value to
the pre-existing `maxTotalScore`, kept as its own field under the spec's name rather than renaming
`maxTotalScore` and risking a silent behavior change for existing callers), `totalPossiblePoints`
(always `"100"`, computed independently of which rows were actually answered), and
`rowStateCounts: { complete, incomplete, invalid, unresolved }`.

### Row-state taxonomy

| State        | Meaning                                                              | Issue codes |
| ------------ | --------------------------------------------------------------------- | ----------- |
| `complete`   | Scored normally; contributes to `totalScore`/`knownPoints`.           | — |
| `incomplete` | Required input or status not yet supplied.                            | `MISSING_ENTRY`, `MISSING_STANDARD`, `AVAILABILITY_NOT_CONFIRMED`, `INCOMPLETE_CONTRIBUTOR_ANSWERS`, `MISSING_PERCENTAGE`, `MISSING_BOOLEAN`, `MISSING_STATUS` |
| `invalid`    | Input supplied but doesn't resolve against the rubric (bad key, out-of-range value, or a genuine rubric-configuration gap that should never occur post-validation). | `UNKNOWN_STANDARD`, `INVALID_PERCENTAGE`, `RUBRIC_BAND_GAP`, `UNKNOWN_STATUS` |
| `unresolved` | Input is valid and matched a band the methodology deliberately leaves undefined (see §3). | `UNRESOLVED_SCORING_RULE` |

A row missing *both* an in-gap value and its status reports `MISSING_STATUS` (incomplete), not
`UNRESOLVED_SCORING_RULE` — status is always a precondition, checked after capability resolution
but before the unresolved-band short-circuit.

## 7. Methodology and calculation versioning metadata

`RubricVersion` now carries:

- `configHash` — a deterministic sha256 of the resolved config (`src/lib/rubric/configHash.ts`),
  unique per row. The seed script refuses to re-seed a *published* version whose current definition
  hashes differently than what's stored, which is the only guard against a published rubric file
  being edited in place after the fact (a mistake that would otherwise silently change already-live
  scoring without a version bump).
- `engineVersion` — the scoring engine version (`src/lib/scoring/engine-version.ts`) the rubric was
  seeded against. Bumped whenever `engine.ts`'s scoring/resolution semantics change (this corrective
  pass bumped it to `2.0.0`, since it introduced the unresolved-row and per-contributor-completeness
  semantics).
- `unresolvedRules` — a structured list of every deliberately-unresolved band
  (`{ parameterKey, subMetricKey, description }`), derived at seed time by
  `deriveUnresolvedRules()` (`src/lib/rubric/rows.ts`).

`ResultSnapshot` now carries `inputRevision` (the `Evaluation.revision` the snapshot was computed
from), `configHash`/`engineVersion` (copied from the `RubricVersion` at computation time, for future
drift detection), and `issues` (the serialized `RowIssue[]` — always `[]` for a snapshot, since
finalization is refused while any row is incomplete, invalid, or unresolved).

### `ResultSnapshot.evaluationId` cardinality

`ResultSnapshot.evaluationId` remains `@unique` (one snapshot per evaluation, upsert target). No
"reopen a finalized evaluation" feature exists today, so there is nothing to version yet. **A future
reopen feature must**: drop `@unique` on `evaluationId` (making the relation 1:many), add a way to
identify the current/latest snapshot (e.g. an `isCurrent` flag, or order by `createdAt`), and update
`results-service.ts`'s read path accordingly. Until then, keeping it 1:1 is the lower-risk choice.

## 8. REST "finalize" is the existing "submit" concept

`POST /api/assessments/:id/finalize` (`src/app/api/assessments/[id]/finalize/route.ts`) is not a
new operation — it calls the same `submitEvaluation` logic (exported as `finalizeEvaluation` from
`src/server/services/submit-service.ts`) that the evaluation editor UI's Server Action already used.
"Finalize" is simply the REST-facing name the spec uses for what this codebase calls "submit."
