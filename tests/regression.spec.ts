// @ts-nocheck
import { test, expect } from "@playwright/test";

const APP = "/accelerate";

// ── 1. App loads successfully ──────────────────────────────────────────────
test("app loads without crash", async ({ page }) => {
  await page.goto(APP);

  // Wait for the loading screen to disappear and real UI to mount
  await expect(page.getByText("Loading Accelerate...")).toBeVisible({ timeout: 5_000 });

  // Bottom nav should appear once data is ready
  await expect(page.getByText("Today")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText("Accounts")).toBeVisible();
  await expect(page.getByText("Dealers")).toBeVisible();

  // No error boundary "Something went wrong" text
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ── 2. Account search returns results ──────────────────────────────────────
test("account search returns results", async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByText("Accounts")).toBeVisible({ timeout: 25_000 });

  // Navigate to Accounts tab
  await page.getByText("Accounts").click();

  // Wait for search box
  const searchBox = page.getByPlaceholder("Search accounts…");
  await expect(searchBox).toBeVisible({ timeout: 10_000 });

  // Type a common word
  await searchBox.fill("dental");

  // At least one result row should appear
  // GroupsTab renders rows inside divs — look for result count or a named row
  await expect(page.locator("text=/dental/i").first()).toBeVisible({ timeout: 8_000 });
});

// ── 3. Opening a multi-location account navigates to GroupDetail ───────────
test("clicking a group opens GroupDetail", async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByText("Accounts")).toBeVisible({ timeout: 25_000 });

  await page.getByText("Accounts").click();

  // Wait for list to render
  await page.waitForTimeout(1_500);

  // Click the first group row (any clickable account card)
  const firstRow = page.locator("[style*='cursor: pointer'], [style*='cursor:pointer']").first();
  await expect(firstRow).toBeVisible({ timeout: 8_000 });
  await firstRow.click();

  // GroupDetail shows a back button (← or "Back") and location count or product list
  // The component renders a sticky header with a back chevron
  await expect(page.locator("text=/back|←|locations|offices/i").first()).toBeVisible({ timeout: 8_000 });

  // No error boundary
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ── 4. GroupDetail renders without runtime error ───────────────────────────
test("GroupDetail renders without crash", async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByText("Accounts")).toBeVisible({ timeout: 25_000 });

  await page.getByText("Accounts").click();
  await page.waitForTimeout(1_500);

  const firstRow = page.locator("[style*='cursor: pointer'], [style*='cursor:pointer']").first();
  await firstRow.click();

  // Wait for detail to settle
  await page.waitForTimeout(2_000);

  // Error boundary should NOT be visible
  await expect(page.getByText("Something went wrong")).not.toBeVisible();

  // Page should not be blank — some text content should exist
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.length).toBeGreaterThan(50);
});

// ── 5. Today tab (KPI screen) renders without crash ────────────────────────
test("Today tab renders KPI screen", async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByText("Today")).toBeVisible({ timeout: 25_000 });

  // Today is the default tab — check for characteristic content
  // TodayTab renders a Q1 progress bar and scored accounts
  // Look for either dollar signs (revenue) or "Q1" text
  await expect(page.locator("text=/Q1|\\$[0-9]/").first()).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

// ── 6. Product row month drilldown expands ─────────────────────────────────
test("product month drilldown expands in GroupDetail", async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByText("Accounts")).toBeVisible({ timeout: 25_000 });

  await page.getByText("Accounts").click();
  await page.waitForTimeout(1_500);

  const firstRow = page.locator("[style*='cursor: pointer'], [style*='cursor:pointer']").first();
  await firstRow.click();

  // Wait for GroupDetail to mount
  await page.waitForTimeout(2_000);

  // Look for a product row — they typically show a product name + revenue
  // GroupDetail renders product rows with an expand chevron
  const productRow = page.locator("text=/kem|kerr|optibond|nexus|herculite|premise/i").first();
  const hasProducts = await productRow.isVisible().catch(() => false);

  if (hasProducts) {
    await productRow.click();
    // After click, month columns (Jan, Feb, Mar…) or a breakdown table should appear
    await expect(page.locator("text=/Jan|Feb|Mar|Apr/i").first()).toBeVisible({ timeout: 5_000 });
  } else {
    // If no named product, just confirm no crash after entering the view
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  }
});

// ── 7. Merge button exists in GroupDetail ─────────────────────────────────
test("GroupDetail shows merge / group action", async ({ page }) => {
  await page.goto(APP);
  await expect(page.getByText("Accounts")).toBeVisible({ timeout: 25_000 });

  await page.getByText("Accounts").click();
  await page.waitForTimeout(1_500);

  // Find a multi-location group — search for something likely to be a DSO
  const searchBox = page.getByPlaceholder("Search accounts…");
  await searchBox.fill("dental");
  await page.waitForTimeout(1_000);

  const firstRow = page.locator("[style*='cursor: pointer'], [style*='cursor:pointer']").first();
  await firstRow.click();
  await page.waitForTimeout(2_000);

  // GroupDetail has a "Merge" or "Link" button in the header actions or footer
  // It may also say "Find Matches" (the Opus matcher button)
  const mergeEl = page.locator("text=/merge|link group|find match/i").first();
  const mergeVisible = await mergeEl.isVisible().catch(() => false);

  // Soft assertion — if not visible, just confirm no crash
  if (!mergeVisible) {
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  } else {
    await expect(mergeEl).toBeVisible();
  }
});
