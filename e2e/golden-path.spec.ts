import { test, expect, type Page } from "@playwright/test";
import { RUBRIC_V1 } from "../src/lib/rubric/rubric-v1";
import type { ParameterDef } from "../src/lib/rubric/types";

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

test.setTimeout(180_000);

test("golden path: signup, evaluate, submit, duplicate, delete, logout", async ({ page }) => {
  const stamp = Date.now();
  const email = `analyst+${stamp}@example.com`;
  const password = "correct horse battery staple";
  const countryName = `Testland ${stamp}`;

  // --- Sign up (creates a private organization automatically) ---
  await page.goto("/signup");
  await page.locator("#name").fill("Test Analyst");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByTestId("signup-submit").click();
  await expect(page).toHaveURL(/\/dashboard/);

  // --- New evaluation ---
  await page.getByTestId("new-evaluation-trigger").click();
  await page.locator("#countryCode").fill("PK");
  await page.locator("#countryName").fill(countryName);
  await page.locator("#assessmentDate").fill(new Date().toISOString().slice(0, 10));
  await page.getByTestId("create-evaluation-submit").click();
  await expect(page).toHaveURL(/\/evaluations\/[^/]+$/);

  // --- Fill one row, confirm autosave, then reload and confirm the draft survives ---
  const technical = RUBRIC_V1.categories[0];
  const firstStandardParam = technical.parameters.find((p) => p.inputType === "STANDARD")!;
  await selectOption(page, `standard-select-${firstStandardParam.key}`, firstStandardParam.standardOptions![0].label);
  await selectOption(page, `status-select-${firstStandardParam.key}`, "Fully Implemented");
  await expect(page.getByTestId(`param-${firstStandardParam.key}`).getByText("Saved")).toBeVisible({
    timeout: 10_000,
  });

  await page.reload();
  await expect(page.getByTestId(`standard-select-${firstStandardParam.key}`)).toContainText(
    firstStandardParam.standardOptions![0].label
  );
  await expect(page.getByTestId(`status-select-${firstStandardParam.key}`)).toContainText("Fully Implemented");

  // --- Complete every remaining scored row across all three categories ---
  for (const category of RUBRIC_V1.categories) {
    await page.getByRole("tab", { name: category.name }).click();
    for (const parameter of category.parameters) {
      if (parameter.key === firstStandardParam.key) continue;
      await fillParameter(page, parameter);
    }
  }

  // Let debounced percentage/status saves flush before checking completeness.
  await page.waitForTimeout(1500);

  await page.getByTestId("review-submit-button").click();
  await expect(page.getByText("This evaluation is complete and ready to submit.")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("confirm-submit-button").click();
  await expect(page).toHaveURL(/\/evaluations\/[^/]+\/results$/);
  await expect(page.getByText("Overall readiness score")).toBeVisible();
  await expect(page.getByText(/\/ 100/)).toBeVisible();

  // --- Re-open the submitted evaluation from the dashboard (regression: must not 404) ---
  await page.goto("/dashboard?q=" + encodeURIComponent(countryName) + "&status=SUBMITTED");
  await page.getByRole("link", { name: new RegExp(countryName) }).first().click();
  await expect(page).toHaveURL(/\/evaluations\/[^/]+\/results$/);
  await expect(page.getByText("Overall readiness score")).toBeVisible();

  // --- Duplicate from the dashboard ---
  await page.goto("/dashboard?q=" + encodeURIComponent(countryName) + "&status=SUBMITTED");
  await page.getByTestId("row-actions-trigger").first().click();
  await page.getByTestId("row-action-duplicate").click();
  await expect(page).toHaveURL(/\/evaluations\/[^/]+$/);

  // The duplicate is a fresh draft — it must not carry over the submitted score.
  await expect(page.getByText("Not scored")).toHaveCount(0); // editor screen doesn't show a score at all
  await page.goto("/dashboard?q=" + encodeURIComponent(countryName) + "&status=DRAFT");
  await expect(page.getByText("Not scored")).toBeVisible();

  // --- Delete the duplicate draft ---
  await page.getByTestId("row-actions-trigger").first().click();
  await page.getByTestId("row-action-delete").click();
  await page.getByTestId("confirm-delete-button").click();
  await expect(page.getByText("No evaluations yet")).toBeVisible();

  // --- Logout ---
  await page.getByTestId("user-menu-trigger").click();
  await page.getByTestId("logout-button").click();
  await expect(page).toHaveURL(/\/login/);
});
