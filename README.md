# Tashkhees

Tashkhees is a web application for assessing a country's readiness and maturity for
Instant Payment Systems. It covers authentication, a versioned scoring rubric stored in
Postgres, server-side decimal scoring, evaluation drafts with autosave, and read-only
submitted results.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives)
- PostgreSQL + Prisma 6
- better-auth (email/password, password reset)
- decimal.js for all scoring arithmetic
- Vitest (scoring correctness checks) + Playwright (end-to-end)
- Docker Compose (Postgres + MailHog for local dev email)

## 1. Prerequisites — things you need to do

1. **Install/start Docker Desktop.** This environment does not have Docker Desktop
   running, so `docker compose up` could not be executed here. Start Docker Desktop on
   your machine, then run:

   ```bash
   docker compose up -d
   ```

   This starts:
   - `postgres` on `localhost:5432` (db `tashkhees`, user/password `tashkhees`)
   - `mailhog` — SMTP on `localhost:1025`, web inbox UI at http://localhost:1025 → open
     http://localhost:8025 in your browser to read password-reset emails sent in dev.

2. **Review `.env`** (already created with working local defaults). If you deploy to
   production, replace `BETTER_AUTH_SECRET` with a new random value and point
   `SMTP_*` at a real provider.

## 2. Install dependencies (already done in this workspace)

```bash
npm install
```

## 3. Database: migrate + seed the rubric

```bash
npm run db:migrate   # creates tables from prisma/schema.prisma
npm run db:seed      # populates + publishes RubricVersion 1 from src/lib/rubric/rubric-v1.ts
```

The seed script is idempotent: re-running it after a version is published is a no-op.
To change the scoring Key, edit `src/lib/rubric/rubric-v1.ts`, bump `version`, and
re-run `npm run db:seed` — this publishes a new `RubricVersion` without touching
evaluations pinned to the old one.

## 4. Run the app

```bash
npm run dev
```

Visit http://localhost:3000. Sign up (this creates your private organization
automatically), create an evaluation, fill in the rubric, and submit.

## 5. Tests

**Scoring engine correctness checks** (no database needed — these check the seeded Key
against the specification, worked examples, boundaries, and rejection rules):

```bash
npm run test
```

**End-to-end golden path** (signup → new evaluation → save draft → reload → complete →
submit → results → duplicate → delete duplicate → logout). Requires Postgres running
and the rubric seeded:

```bash
npm run build && npm run test:e2e
```

(`playwright.config.ts` builds against `npm run start`; set `E2E_SKIP_WEBSERVER=1` and
`E2E_BASE_URL=http://localhost:3000` if you'd rather point it at an already-running
`npm run dev` server.)

## 6. Production build

```bash
npm run build
npm run start
```

## Architecture notes

- **Scoring is server-only.** `src/lib/scoring/engine.ts` is marked `server-only` and
  is never imported by client components. The browser only ever receives resolved
  strings (multipliers, statuses, row/parameter/category contributions) computed by
  `computeScore`.
- **Rubric configuration lives in the database**, versioned via `RubricVersion` →
  `Category` → `Parameter` → (`StandardOption` | `SubParameter` | `Band` |
  `SubMetric`) → `StatusOption`. `src/lib/rubric/rubric-v1.ts` is the single
  source of truth the seed script writes from; `src/lib/rubric/loader.ts` is what the
  running app actually reads at evaluation/scoring time.
- **Decimal arithmetic throughout** via `decimal.js` (`src/lib/scoring/decimal-config.ts`),
  with display rounding only at the edge (`ROUND_HALF_UP`, 2 decimal places).
- **Every evaluation entry is scoped to an organization** resolved server-side from the
  authenticated session (`src/lib/auth/current-user.ts`) — the browser never supplies an
  organization id.
- **Optimistic concurrency**: every mutating evaluation action takes the client's last-known
  `revision` and rejects (`STALE_REVISION`) if the evaluation changed since it was loaded.
- **Submission is atomic and immutable**: `src/server/actions/submit.ts` recomputes the
  score server-side from the pinned rubric version, and only on success writes a
  `ResultSnapshot` and flips the evaluation to `SUBMITTED` in one transaction. Submitted
  evaluations are read-only and are never rescored against a newer rubric version.

## Known limitation

Next.js 16 has deprecated the `middleware.ts` file convention in favor of `proxy.ts`
(same behavior, new filename). This app still uses `middleware.ts`, which works but
prints a deprecation warning during `next build`.
