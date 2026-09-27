import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Check the frontend funnel without writing test traffic to marketing data.
  await page.route(
    "**/rest/v1/rpc/record_marketing_attribution_visit",
    (route) => route.fulfill({ json: null }),
  );
});

for (const width of [320, 390, 768, 1440]) {
  test(`welcome is usable without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/welcome");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Stay Ready.",
    );
    await expect(page.locator(".welcome__audience")).toHaveCount(3);
    await page.locator(".welcome__closing").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const buttons = await page
      .locator(".welcome__button")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          height: element.getBoundingClientRect().height,
          width: element.getBoundingClientRect().width,
        })),
      );
    expect(
      buttons.every((button) => button.height >= 44 && button.width <= width),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: test.info().outputPath(`welcome-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}

for (const [label, path] of [
  ["Join TriggerFeed", "/signup"],
  ["Create a Creator Account", "/signup/creator"],
  ["Create an Organization Account", "/signup/organization"],
]) {
  test(`${label} preserves the attribution/referral journey`, async ({
    page,
  }) => {
    await page.goto(
      "/welcome?source=psa&campaign=business-card&ref=Invite_123",
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem("triggerfeed.marketingAttribution") ||
                "null",
            )?.source,
        ),
      )
      .toBe("psa");
    await page.getByRole("link", { name: label, exact: true }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`${path}\\?source=psa&campaign=business-card&ref=Invite_123$`),
    );
    await expect(page.locator("form")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("triggerfeed.signupReferralCode"),
        ),
      )
      .toBe("Invite_123");
    const attribution = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("triggerfeed.marketingAttribution")),
    );
    expect(attribution.campaign).toBe("business-card");
    expect(attribution.landingPath).toContain("/welcome?");
  });
}

test("sign-in, keyboard focus and social metadata are available", async ({
  page,
}) => {
  await page.goto("/welcome", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle("TriggerFeed | The Firearms Community");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://www.triggerfeed.com/welcome",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://www.triggerfeed.com/welcome",
  );
  const cta = page.locator(".welcome__hero .welcome__button").first();
  await cta.focus();
  await expect(cta).toBeFocused();
  expect(
    await cta.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");
  await page.getByRole("link", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});

test("the mobile header signup link also carries Welcome referral parameters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/welcome?source=psa&campaign=business-card&ref=Invite_123", { waitUntil: "networkidle" });
  await page.locator(".app-nav__toggle").click();
  await page.getByRole("link", { name: "Signup", exact: true }).click();
  await expect(page).toHaveURL(/\/signup\?source=psa&campaign=business-card&ref=Invite_123$/);
});
