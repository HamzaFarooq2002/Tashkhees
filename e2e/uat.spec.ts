import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { RUBRIC_V2 } from "../src/lib/rubric/rubric-v2";
import type { ParameterDef } from "../src/lib/rubric/types";

/* ---------- helpers ---------- */

const PASSWORD = "correct horse battery staple";
const stamp = Date.now();
const userA = { name: "UAT Analyst A", email: `uat.a+${stamp}@example.com` };
const userB = { name: "UAT Analyst B", email: `uat.b+${stamp}@example.com` };
const countryName = `Uatland ${stamp}`;

const consoleProblems: string[] = [];
const timings: Record<string, number> = {};

function watchConsole(page: Page) {
  page.on("console", (m: ConsoleMessage) => {
    const t = m.text();
    if (/React DevTools|Download the React/.test(t)) return;
    if (m.type() === "error" || m.type() === "warning") consoleProblems.push(`[${m.type()}] ${page.url()} :: ${t.slice(0, 200)}`);
  });
  page.on("pageerror", (e) => consoleProblems.push(`[pageerror] ${page.url()} :: ${e.message}`));
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const r = await fn();
  timings[label] = Date.now() - t0;
  return r;
}

async function selectOption(page: Page, testId: string, optionLabel: string) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: optionLabel, exact: true }).click();
}

async function fillParameter(page: Page, parameter: ParameterDef) {
  if (parameter.inputType === "STANDARD") {
    await selectOption(page, `standard-select-${parameter.key}`, parameter.standardOptions![0].label);
    await selectOption(page, `status-select-${parameter.key}`, "Fully Implemented");
  } else if (parameter.inputType === "SUBPARAM") {
    await page.getByTestId(`none-present-${parameter.key}`).click();
    await selectOption(page, `status-select-${parameter.key}`, "Fully Implemented");
  } else if (parameter.inputType === "BANDED") {
    await page.locator(`#${parameter.key}-main-pct`).fill("50");
    await selectOption(page, `status-select-${parameter.key}-main`, "Fully Implemented");
  } else if (parameter.inputType === "SPLIT_BANDED") {
    for (const sm of parameter.subMetrics!) {
      await page.locator(`#${parameter.key}-${sm.key}-pct`).fill("50");
      await selectOption(page, `status-select-${parameter.key}-${sm.key}`, "Fully Implemented");
    }
  } else if (parameter.inputType === "BOOLEAN") {
    await page.getByTestId("boolean-yes").click();
    await selectOption(page, "status-select-unique_citizen_id", "Fully Implemented");
  }
}

async function signUp(page: Page, user: { name: string; email: string }) {
  await page.goto("/signup");
  await page.locator("#name").fill(user.name);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function logIn(page: Page, email: string, path = "/login") {
  await page.goto(path);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
}

async function logOut(page: Page) {
  await page.getByTestId("user-menu-trigger").click();
  await page.getByTestId("logout-button").click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

let evaluationId = "";

/* ---------- UAT-01 Landing page & branding ---------- */
test("UAT-01 landing page branding", async ({ page }) => {
  watchConsole(page);
  await timed("landing load", () => page.goto("/", { waitUntil: "load" }));

  const logos = page.getByRole("img", { name: "Tashkhees" });
  await expect(logos).toHaveCount(2); // header + footer
  const header = logos.first();
  await expect(header).toBeVisible();
  const box = (await header.boundingBox())!;
  expect(box.height).toBe(80);
  expect(Math.abs(box.width / box.height - 228 / 132)).toBeLessThan(0.02); // aspect ratio preserved
  const natural = await header.evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(natural).toBeGreaterThan(0); // image actually decoded

  await expect(page.getByText("A Karandaaz Digital Financial Services Initiative")).toBeVisible();
  await expect(page.getByText("A Karandaaz Digital initiative", { exact: true })).toHaveCount(0);
  for (const name of ["Technology Parameters", "Operational Parameters", "Financial Inclusion Parameters"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.locator("svg.lucide-server-cog")).toHaveCount(1);
  await expect(page.locator("svg.lucide-arrow-left-right")).toHaveCount(1);
  await expect(page.locator("svg.lucide-hand-coins")).toHaveCount(1);

  // Nav buttons route correctly
  await page.getByRole("banner").getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("img", { name: "Tashkhees" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("UAT-02 landing is responsive on mobile", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  watchConsole(page);
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("img", { name: "Tashkhees" }).first()).toBeVisible();
  await page.close();
});

/* ---------- UAT-03 Auth & access control ---------- */
test("UAT-03 auth flows and route protection", async ({ page }) => {
  watchConsole(page);

  // Protected route → login with redirectTo
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard/);

  // Signup validation: short password
  await page.goto("/signup");
  await page.locator("#name").fill("x");
  await page.locator("#email").fill(`short+${stamp}@example.com`);
  await page.locator("#password").fill("abc");
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/signup/); // blocked (browser minLength or server error)

  // Real signup (user A)
  await timed("signup → dashboard", () => signUp(page, userA));
  await expect(page.getByText("No evaluations yet")).toBeVisible();

  // Logged-in users are bounced away from auth pages
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);

  await logOut(page);

  // Wrong password
  await page.locator("#email").fill(userA.email);
  await page.locator("#password").fill("wrong password 123");
  await page.getByTestId("login-submit").click();
  await expect(page.locator("form").getByText(/invalid|incorrect/i)).toBeVisible();

  // Open-redirect attempt is neutralised
  await logIn(page, userA.email, "/login?redirectTo=%2F%2Fevil.example.com");
  await expect(page).toHaveURL(/localhost:3000\/dashboard/);
  await logOut(page);

  // Legit redirectTo is honoured
  await timed("login → dashboard", async () => {
    await logIn(page, userA.email, "/login?redirectTo=%2Fdashboard%3Fstatus%3DDRAFT");
    await expect(page).toHaveURL(/\/dashboard\?status=DRAFT/);
  });
});

/* ---------- UAT-04 Dashboard & creation ---------- */
test("UAT-04 dashboard and new evaluation", async ({ page }) => {
  watchConsole(page);
  await logIn(page, userA.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("img", { name: "Tashkhees" })).toBeVisible();

  // Invalid country code rejected
  await page.getByTestId("new-evaluation-trigger").click();
  await page.locator("#countryCode").fill("P1");
  await page.locator("#countryName").fill(countryName);
  await page.getByTestId("create-evaluation-submit").click();
  await expect(page.getByRole("dialog").getByText(/2-letter|country code|invalid/i).first()).toBeVisible();

  await page.locator("#countryCode").fill("PK");
  await timed("create evaluation → editor", async () => {
    await page.getByTestId("create-evaluation-submit").click();
    await expect(page).toHaveURL(/\/evaluations\/[^/]+$/);
    await expect(page.getByTestId("review-submit-button")).toBeVisible();
  });
  evaluationId = page.url().split("/").pop()!;
});

/* ---------- UAT-05 Editor: the reported bugs ---------- */
test("UAT-05 editor selections, autosave, validation", async ({ page }) => {
  watchConsole(page);
  await logIn(page, userA.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await timed("open draft editor", async () => {
    await page.goto(`/evaluations/${evaluationId}`);
    await expect(page.getByTestId("review-submit-button")).toBeVisible();
  });

  // Rubric version is not shown anywhere
  await expect(page.getByText(/Rubric v\d/)).toHaveCount(0);

  const tech = RUBRIC_V2.categories[0];
  const std = tech.parameters.find((p) => p.inputType === "STANDARD")!;
  const card = page.getByTestId(`param-${std.key}`);

  // Placeholder shown before any choice (controlled with empty value)
  await expect(page.getByTestId(`status-select-${std.key}`)).toContainText("Select implementation status");

  // Parameter choice + implementation status save
  const t0 = Date.now();
  await selectOption(page, `standard-select-${std.key}`, std.standardOptions![0].label);
  await selectOption(page, `status-select-${std.key}`, "Partially Implemented");
  await expect(card.getByText("Saved")).toBeVisible({ timeout: 10_000 });
  timings["select + save round-trip"] = Date.now() - t0;
  await expect(card.getByText(/Row contribution/)).toBeVisible();

  // Change the choice again (controlled → controlled) and confirm it sticks
  await selectOption(page, `status-select-${std.key}`, "Fully Implemented");
  await expect(card.getByText("Saved")).toBeVisible({ timeout: 10_000 });

  // Rapid consecutive changes across parameters must not produce stale-revision errors
  const others = tech.parameters.filter((p) => p.inputType === "STANDARD" && p.key !== std.key).slice(0, 3);
  for (const p of others) await fillParameter(page, p);
  for (const p of others) await expect(page.getByTestId(`param-${p.key}`).getByText("Saved")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/changed elsewhere/)).toHaveCount(0);

  // Evidence URL: half-typed → inline hint, no toast; bare domain → normalised and saved
  await card.getByRole("button", { name: /Evidence & notes/ }).click();
  const url = page.locator(`#${std.key}-main-evidence`);
  await url.fill("sbp");
  await expect(card.getByText(/Enter a full link/)).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: /url|link|invalid/i })).toHaveCount(0);
  await url.fill("sbp.org.pk/raast");
  await expect(card.getByText(/Enter a full link/)).toHaveCount(0);
  await expect(card.getByText("Saved")).toBeVisible({ timeout: 10_000 });

  // Out-of-range percentage shows a readable inline error
  const banded = RUBRIC_V2.categories.flatMap((c) => c.parameters).find((p) => p.inputType === "BANDED")!;
  await page.getByRole("tab", { name: RUBRIC_V2.categories.find((c) => c.parameters.includes(banded))!.name }).click();
  await page.locator(`#${banded.key}-main-pct`).fill("150");
  await expect(page.getByTestId(`param-${banded.key}`).getByText(/between 0 and 100/)).toBeVisible({ timeout: 10_000 });
  await page.locator(`#${banded.key}-main-pct`).fill("60");
  await expect(page.getByTestId(`param-${banded.key}`).getByText("Saved")).toBeVisible({ timeout: 10_000 });

  // Checklist: tick a subset, Confirm → unticked count as not present, row completes (reported bug)
  const partials: { key: string; tick: string[]; coverage: string }[] = [
    { key: "use_cases_services_enabled", tick: ["p2p", "p2m", "p2g", "g2p"], coverage: "60%" },
    { key: "multiple_banks_incl_mfbs", tick: ["commercial_banks", "wallets", "psos"], coverage: "55%" },
  ];
  for (const partial of partials) {
    const category = RUBRIC_V2.categories.find((c) => c.parameters.some((p) => p.key === partial.key))!;
    await page.getByRole("tab", { name: category.name }).click();
    const checklist = page.getByTestId(`param-${partial.key}`);
    for (const k of partial.tick) await page.getByTestId(`checkbox-${partial.key}-${k}`).click();
    await page.getByTestId(`confirm-availability-${partial.key}`).click();
    await selectOption(page, `status-select-${partial.key}`, "Fully Implemented");
    await expect(checklist.getByText("Complete", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(checklist.getByText(/no explicit answer/)).toHaveCount(0);
    await expect(page.getByTestId(`coverage-${partial.key}`)).toContainText(`${partial.coverage} · confirmed`);
    await expect(checklist.getByText("Saved")).toBeVisible({ timeout: 10_000 });
  }
  await page.reload();
  for (const partial of partials) {
    const category = RUBRIC_V2.categories.find((c) => c.parameters.some((p) => p.key === partial.key))!;
    await page.getByRole("tab", { name: category.name }).click();
    await expect(page.getByTestId(`param-${partial.key}`).getByText("Complete", { exact: true })).toBeVisible();
    await expect(page.getByTestId(`coverage-${partial.key}`)).toContainText(`${partial.coverage} · confirmed`);
  }
  await page.getByRole("tab", { name: RUBRIC_V2.categories[0].name }).click();

  // Reload: everything persisted
  await page.reload();
  await expect(page.getByTestId(`standard-select-${std.key}`)).toContainText(std.standardOptions![0].label);
  await expect(page.getByTestId(`status-select-${std.key}`)).toContainText("Fully Implemented");
  await page.getByTestId(`param-${std.key}`).getByRole("button", { name: /Evidence & notes/ }).isVisible();
  await expect(page.locator(`#${std.key}-main-evidence`)).toHaveValue("https://sbp.org.pk/raast");

  // Meta edit autosaves
  await page.locator("#meta-title").fill("UAT pass");
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator("#meta-title")).toHaveValue("UAT pass");
});

/* ---------- UAT-06 Submit → results → reopen (404 report) ---------- */
test("UAT-06 submit, results, reopen", async ({ page }) => {
  watchConsole(page);
  await logIn(page, userA.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(`/evaluations/${evaluationId}`);

  // Incomplete review blocks submission
  await page.getByTestId("review-submit-button").click();
  await expect(page.getByText(/row\(s\) still need attention/)).toBeVisible();
  await expect(page.getByTestId("confirm-submit-button")).toBeDisabled();
  await page.getByRole("button", { name: "Keep editing" }).click();

  // v2's unresolved 30–40% digital transactions band is flagged
  const fi = RUBRIC_V2.categories.find((c) => c.key === "financial_inclusion")!;
  await page.getByRole("tab", { name: fi.name }).click();
  // Status first: by design the engine reports a missing status before an unresolved band.
  await selectOption(page, "status-select-consumer_behavior-digital_transactions", "Fully Implemented");
  await page.locator("#consumer_behavior-digital_transactions-pct").fill("35");
  await expect(page.getByTestId("param-consumer_behavior").getByText(/unresolved/i).first()).toBeVisible({ timeout: 10_000 });

  // Complete everything
  for (const category of RUBRIC_V2.categories) {
    await page.getByRole("tab", { name: category.name }).click();
    for (const parameter of category.parameters) await fillParameter(page, parameter);
  }
  await page.waitForTimeout(2000);

  await page.getByTestId("review-submit-button").click();
  await expect(page.getByText("This evaluation is complete and ready to submit.")).toBeVisible({ timeout: 15_000 });
  await timed("submit → results", async () => {
    await page.getByTestId("confirm-submit-button").click();
    await expect(page).toHaveURL(new RegExp(`/evaluations/${evaluationId}/results$`));
    await expect(page.getByText("Overall readiness score")).toBeVisible();
  });
  await expect(page.getByText(/Rubric v\d/)).toHaveCount(0);
  for (const name of ["Technical", "Operational", "Financial"]) {
    await expect(page.getByText(new RegExp(name)).first()).toBeVisible();
  }

  // Reopen from dashboard via link and via row action "Open"
  await page.goto("/dashboard");
  await expect(page.getByRole("columnheader", { name: "Rubric" })).toHaveCount(0);
  await expect(page.getByText(/\/ 100/).first()).toBeVisible();
  await timed("dashboard → results (link)", async () => {
    await page.getByRole("link", { name: new RegExp(countryName) }).click();
    await expect(page.getByText("Overall readiness score")).toBeVisible();
  });
  expect(page.url()).toMatch(/\/results$/);
  await page.goto("/dashboard");
  await page.getByTestId("row-actions-trigger").first().click();
  await page.getByTestId("row-action-open").click();
  await expect(page.getByText("Overall readiness score")).toBeVisible();

  // Submitted evaluation's edit URL redirects to results (read-only)
  await page.goto(`/evaluations/${evaluationId}`);
  await expect(page).toHaveURL(/\/results$/);

  // Hard reload of results URL works (direct navigation, no 404)
  const resp = await page.goto(`/evaluations/${evaluationId}/results`);
  expect(resp?.status()).toBe(200);

  // Search & status filters
  await page.goto(`/dashboard?q=${encodeURIComponent(countryName)}&status=DRAFT`);
  await expect(page.getByText("No evaluations yet")).toBeVisible();
  await page.goto(`/dashboard?q=${encodeURIComponent(countryName)}&status=SUBMITTED`);
  await expect(page.getByRole("link", { name: new RegExp(countryName) })).toBeVisible();

  // Duplicate → new draft, then delete it
  await page.getByTestId("row-actions-trigger").first().click();
  await page.getByTestId("row-action-duplicate").click();
  await expect(page).toHaveURL(/\/evaluations\/[^/]+$/);
  await page.goto(`/dashboard?q=${encodeURIComponent(countryName)}&status=DRAFT`);
  await page.getByTestId("row-actions-trigger").first().click();
  await page.getByTestId("row-action-delete").click();
  await page.getByTestId("confirm-delete-button").click();
  await expect(page.getByText("No evaluations yet")).toBeVisible();
});

/* ---------- UAT-07 Not found & isolation ---------- */
test("UAT-07 not-found pages and cross-account isolation", async ({ page, request }) => {
  watchConsole(page);
  await logIn(page, userA.email);
  await expect(page).toHaveURL(/\/dashboard/);

  for (const path of ["/evaluations/does-not-exist", "/evaluations/does-not-exist/results"]) {
    // With loading.tsx the response streams (HTTP 200) before notFound() runs; Next then renders the
    // not-found UI and marks the page noindex. Assert what the user sees.
    await page.goto(path);
    await expect(page.getByText("Evaluation not found")).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await expect(page.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await logOut(page);

  // User B cannot see or open user A's evaluation
  await signUp(page, userB);
  await expect(page.getByText(countryName)).toHaveCount(0);
  await page.goto(`/evaluations/${evaluationId}/results`);
  await expect(page.getByText("Evaluation not found")).toBeVisible();

  // Unauthenticated deep link → login with return path
  await logOut(page);
  await page.goto(`/evaluations/${evaluationId}/results`);
  await expect(page).toHaveURL(/\/login\?redirectTo=/);

  // REST API rejects anonymous callers
  const read = await request.get(`/api/assessments/${evaluationId}`);
  expect([401, 403]).toContain(read.status());
  const create = await request.post("/api/assessments", {
    data: { countryCode: "PK", countryName: "Anon", assessmentDate: "2026-01-01" },
  });
  expect([401, 403]).toContain(create.status());
});

/* ---------- Report ---------- */
test.afterAll(() => {
  console.log("\n==== UAT TIMINGS (ms, dev server) ====");
  for (const [k, v] of Object.entries(timings)) console.log(`${k.padEnd(32)} ${v}`);
  console.log("\n==== CONSOLE WARNINGS / ERRORS ====");
  const unique = [...new Set(consoleProblems)];
  console.log(unique.length ? unique.join("\n") : "none");
});
