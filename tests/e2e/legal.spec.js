import { test, expect } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`anonymous Legal standards and fragment navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto('/legal#csae');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(response.headers()['x-robots-tag'] ?? '').not.toContain('noindex');
    await expect(page).toHaveURL(/\/legal#csae$/);
    const section = page.locator('#csae');
    await expect(section).toHaveCount(1);
    await expect(section.getByRole('heading')).toHaveText('Child Safety Standards: Child Sexual Abuse and Exploitation (CSAE)');
    // Global smooth scrolling can finish after navigation/network idle.
    await expect.poll(() => section.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    await expect.poll(() => section.evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(200);
    await expect(section).toContainText('Peri Media Group, LLC');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section.getByRole('link', { name: 'Report Abuse form' }).click();
    await expect(page).toHaveURL(/#abuse$/);
    await expect(page.getByRole('button', { name: 'Submit Report' })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });
}

test('standards remain readable in public HTML without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto('http://localhost:3000/legal#csae');
  expect(response.status()).toBe(200);
  await expect(page.locator('#csae')).toContainText('Child Sexual Abuse Material (CSAM)');
  for (const id of ['terms', 'privacy', 'cookies', 'abuse']) await expect(page.locator(`#${id}`)).toHaveCount(1);
  await context.close();
});
