import { test, expect } from "@playwright/test";

// Supply a local Playwright storage-state file for a signed-in test account.
// Never commit that file. This suite performs no posts, votes, or ad clicks.
const storageState = process.env.FEED_E2E_AUTH_STATE;
test.use({ storageState: storageState || undefined });
test.skip(!storageState, "FEED_E2E_AUTH_STATE is required for the authenticated feed");

test("authenticated feed navigation, hard reload, Back and multiple ads", async ({ page }) => {
  const hydrationErrors = [];
  const capture = (message) => {
    if (/hydration|hydrating|Minified React error #418|cannot be a descendant/i.test(message)) {
      hydrationErrors.push(message);
    }
  };
  page.on("pageerror", (error) => capture(error.message));
  page.on("console", (message) => { if (message.type() === "error") capture(message.text()); });

  // Retain the first parsed post DOM node before hydration. Replacement is a
  // failure even when React recovers and the feed looks correct afterward.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const post = document.querySelector(".post-card");
      if (post) {
        window.__firstServerPost = post;
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });

  await page.goto("/about");
  await page.locator('a[href="/"]').first().click();
  await expect(page.locator(".feed-page")).toBeVisible();
  await expect(page.locator(".post-card").first()).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".feed-page")).toBeVisible();
  expect(await page.evaluate(() => window.__firstServerPost === document.querySelector(".post-card"))).toBe(true);
  await expect(page.locator("a a")).toHaveCount(0);

  await page.getByRole("link", { name: "Friends", exact: true }).first().click();
  await expect(page.locator(".feed-tabs__link--active")).toHaveText("Friends");
  await page.goBack();
  await expect(page.locator(".feed-tabs__link--active")).toHaveText("Main");
  await page.locator(".post-card").last().scrollIntoViewIfNeeded();

  // The seeded account needs at least 18 feed posts and eligible campaigns.
  await expect.poll(() => page.locator(".feed-ad").count()).toBeGreaterThanOrEqual(2);
  const gaps = await page.locator(".post-feed").evaluate((feed) => {
    let organic = 0;
    const result = [];
    for (const child of feed.children) {
      if (child.classList.contains("post-card")) organic++;
      if (child.classList.contains("feed-ad")) { result.push(organic); organic = 0; }
    }
    return result;
  });
  expect(gaps.every((gap) => gap >= 6 && gap <= 9)).toBe(true);
  expect(hydrationErrors).toEqual([]);
});
