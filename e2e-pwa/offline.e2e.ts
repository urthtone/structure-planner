import { test, expect } from "@playwright/test";
test("installable manifest, mobile layout, camera input and offline reload work", async ({
  page,
  context,
  request,
}) => {
  const errors: string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/planner/");
  const session=await context.newCDPSession(page);
  const browserManifest=await session.send("Page.getAppManifest");
  expect(browserManifest.errors).toEqual([]);
  expect(browserManifest.url).toContain("/planner/manifest.webmanifest");
  // A second CDP session can override Chromium's network emulation. Release it
  // before Playwright switches the page offline, so navigator.onLine is accurate.
  await session.detach();
  expect((await request.post("/planner/api/analyze",{data:{images:[]}})).status()).toBe(404);
  const manifest = await request.get("/planner/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const data = await manifest.json();
  expect(data.start_url).toBe("/planner/");
  expect(data.scope).toBe("/planner/");
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
  const registration = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(registration).pathname).toBe("/planner/");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Upload photos" }),
  ).toBeVisible();
  expect(await page.evaluate(()=>navigator.onLine)).toBe(false);
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
  expect(errors).toEqual([]);
  expect(cached.every(url=>new URL(url).pathname.startsWith("/planner/"))).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-offline.png",
    fullPage: true,
  });
});


test("configured static export sends photos only to its built-in hosted endpoint on request",async({page})=>{
  const endpoint=process.env.NEXT_PUBLIC_ANALYZE_URL;
  test.skip(!endpoint,"A configured export is required for this deployment-specific test.");
  let posts=0;
  await page.route(endpoint!,route=>{
    if(route.request().method()==="POST") {
      posts++;
      const body=route.request().postDataJSON();
      expect(body.images).toHaveLength(1);
      expect(body.images[0]).toMatch(/^data:image\/jpeg;base64,/);
    }
    return route.fulfill({status:200,headers:{
      "Access-Control-Allow-Origin":"*",
      "Access-Control-Allow-Methods":"POST, OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type",
    },json:{status:"not_configured",message:"Photo analysis not configured (mocked deployment contract)."}});
  });
  await page.goto("/planner/");
  await page.getByLabel("Upload photos",{exact:true}).setInputFiles("azure-api/test/fixtures/synthetic-site.png");
  await expect(page.locator(".count")).toHaveText("1/5");
  expect(posts).toBe(0);
  await page.getByRole("button",{name:"Analyze photos",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Photo analysis not configured");
  expect(posts).toBe(1);
});
