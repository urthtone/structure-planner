import { test, expect } from "@playwright/test";
test("installable manifest, mobile layout, camera input and offline reload work", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/");
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const data = await manifest.json();
  expect(data.display).toBe("standalone");
  expect(data.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of data.icons)
    expect((await request.get(icon.src)).status()).toBe(200);
  await expect(
    page.getByLabel("Upload photos", { exact: true }),
  ).toHaveAttribute("capture", "environment");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Upload photos" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Offline");
  await page.getByRole("button", { name: "Next: structure" }).click();
  await page.getByRole("button", { name: "Next: prices" }).click();
  await page.getByRole("button", { name: "Generate preliminary plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Your 10 × 12 ft shed" }),
  ).toBeVisible();
  await expect(page.locator(".estimate")).toContainText("$4,189.10");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const entries = await Promise.all(
      keys.map(async (name) =>
        (await (await caches.open(name)).keys()).map((request) => request.url),
      ),
    );
    return entries.flat();
  });
  expect(
    cached.some((url) => url.includes("/api/") || url.includes("/redirect")),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/mobile-offline.png",
    fullPage: true,
  });
});
