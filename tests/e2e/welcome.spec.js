import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Check the frontend funnel without writing test traffic to marketing data.
  await page.route(
    "**/rest/v1/rpc/record_marketing_attribution_visit",
    (route) => route.fulfill({ json: null }),
  );
});

for (const width of [320, 390, 768, 1440]) {
  test(`real screenshots and accessible lightbox at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/welcome", { waitUntil: "networkidle" });
    const triggers = page.locator(".welcome-showcase__open");
    await expect(triggers).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const trigger = triggers.nth(i);
      await trigger.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          trigger
            .locator("img")
            .evaluate((img) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", {
        name: "TriggerFeed product screenshots",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".yarl__slide_current img")).toHaveAttribute(
        "src",
        await trigger.locator("img").getAttribute("src"),
      );
      expect(
        await page.evaluate(() => getComputedStyle(document.body).overflow),
      ).toBe("hidden");
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      await expect(close).toBeInViewport();
      const image = dialog.locator(".yarl__slide_current img");
      const box = await image.boundingBox();
      expect(box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeLessThanOrEqual(900);
      if (i === 0) {
        await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
        await page.screenshot({ path: test.info().outputPath("lightbox.png") });
      }
      if (i === 3) await close.click();
      else await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(
        await page.evaluate(() => getComputedStyle(document.body).overflow),
      ).not.toBe("hidden");
    }
    await page.locator(".welcome-showcase").screenshot({ path: test.info().outputPath("showcase.png") });
    await triggers.first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.locator(".yarl__slide_current img")).toHaveAttribute(
      "src",
      /profile-desktop/,
    );
    await dialog.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(dialog.locator(".yarl__slide_current img")).toHaveAttribute(
      "src",
      /feed-desktop/,
    );
    await dialog
      .locator(".yarl__slide_current")
      .click({ position: { x: 2, y: 2 } });
    await expect(dialog).toHaveCount(0);
    await expect(triggers.first()).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

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

test("the mobile header signup link also carries Welcome referral parameters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/welcome?source=psa&campaign=business-card&ref=Invite_123", {
    waitUntil: "networkidle",
  });
  await page.locator(".app-nav__toggle").click();
  await page.getByRole("link", { name: "Signup", exact: true }).click();
  await expect(page).toHaveURL(
    /\/signup\?source=psa&campaign=business-card&ref=Invite_123$/,
  );
});
