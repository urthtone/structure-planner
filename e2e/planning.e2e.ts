import { test, expect } from "@playwright/test";

async function raster(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "green";
    ctx.fillRect(0, 0, 2400, 1600);
    return canvas.toDataURL("image/png").split(",")[1];
  });
}

test("exported page responds and contains only subpath assets", async ({request}) => {
  const response = await request.get("/planner/");
  expect(response.status()).toBe(200);
  const html=await response.text();
  expect(html).toContain("Structure Planner");
  expect(html).toContain("/planner/_next/static/");
  expect(html).not.toMatch(/(?:src|href)="\/_next\//);
});

test("photo picker/drop cap, compression, rejection, removal and manual planning", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/planner/");
  const buffer = Buffer.from(await raster(page), "base64");
  await page.getByLabel("Upload photos", { exact: true }).setInputFiles(
    Array.from({ length: 6 }, (_, i) => ({
      name: `${i}.png`,
      mimeType: "image/png",
      buffer,
    })),
  );
  await expect(page.locator(".count")).toHaveText("5/5");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Maximum 5",
  );
  const dimensions = await page
    .getByAltText("Reference photo 1", { exact: true })
    .evaluate((img: HTMLImageElement) => ({
      width: img.naturalWidth,
      src: img.src.length,
    }));
  expect(dimensions.width).toBeLessThanOrEqual(1280);
  expect(dimensions.src).toBeLessThanOrEqual(650000);
  // Drop is supported even when the file input is disabled at capacity.
  await page.locator(".drop-zone").evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["text"], "bad.txt", { type: "text/plain" }));
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
    );
  });
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Only JPEG",
  );
  await expect(page.locator(".count")).toHaveText("5/5");
  await page
    .getByRole("button", { name: "Remove photo 1", exact: true })
    .click();
  await expect(page.locator(".count")).toHaveText("4/5");
  await page.locator(".drop-zone").evaluate((element, base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
    transfer.items.add(new File([bytes], "extra.png", { type: "image/png" }));
    element.dispatchEvent(
      new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
    );
  }, buffer.toString("base64"));
  await expect(page.locator(".count")).toHaveText("5/5");
  await page.route("https://analysis.example.test/api/analyze", route => route.fulfill({json:{status:"not_configured",message:"Photo analysis not configured"}}));
  await page
    .getByRole("button", { name: "Analyze photos", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Photo analysis not configured",
  );
  await page.getByRole("button", { name: "Next: structure" }).click();
  await page.getByLabel("Width / roof span").fill("0");
  await page.getByRole("button", { name: "Next: prices" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "between 6 and 60",
  );
  await page.getByLabel("Width / roof span").fill("10");
  await page.getByRole("button", { name: "Next: prices" }).click();
  await page.getByRole("button", { name: "Generate preliminary plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Your 10 × 12 ft shed" }),
  ).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("3/4-in T&G");
  await page.getByLabel("Show conceptual framing").check();
  await expect(page.locator("svg.floor-plan")).toContainText("Joists 16");
  await page.screenshot({ path: "test-results/shed-plan.png", fullPage: true });
  const pdf = await page.pdf({
    path: "test-results/shed-plan.pdf",
    format: "Letter",
    printBackground: true,
  });
  expect(pdf.byteLength).toBeGreaterThan(10000);
  expect(errors).toEqual([]);
});

test("photo suggestions are optional and user-overridable", async ({
  page,
}) => {
  await page.goto("/planner/");
  const buffer = Buffer.from(await raster(page), "base64");
  await page
    .getByLabel("Upload photos", { exact: true })
    .setInputFiles({ name: "site.png", mimeType: "image/png", buffer });
  await expect(page.locator(".count")).toHaveText("1/5");
  await page.route("**/api/analyze", (route) =>
    route.fulfill({
      json: {
        status: "ok",
        analysis: {
          groundSlope: "unknown",
          groundType: "grass",
          obstructions: [],
          sunShade: "unknown",
          styleHints: ["gable"],
          suggestedFoundation: "piers",
          notes: ["Verify on site."],
        },
      },
    }),
  );
  await page
    .getByRole("button", { name: "Analyze photos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Photo observations (not a survey)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next: structure" }).click();
  await expect(
    page.getByRole("combobox", { name: "Foundation", exact: true }),
  ).toHaveValue("skids");
  await page.getByRole("button", { name: "Use suggested foundation" }).click();
  await expect(
    page.getByRole("combobox", { name: "Foundation", exact: true }),
  ).toHaveValue("piers");
  await page
    .getByRole("combobox", { name: "Foundation", exact: true })
    .selectOption("skids");
  await page.getByRole("button", { name: "Next: prices" }).click();
  await page.getByText("Edit example/default price table").click();
  await page
    .getByLabel("Price: 3/4-in T&G 4×8 floor sheathing", { exact: true })
    .fill("100");
  await page.getByRole("button", { name: "Generate preliminary plan" }).click();
  await expect(page.locator(".estimate")).toContainText("$");
  await expect(page.locator("table").first()).toContainText("$100.00");
});

test("failed decode and concurrent drops do not stall intake or exceed the cap", async ({
  page,
}) => {
  await page.goto("/planner/");
  const buffer = Buffer.from(await raster(page), "base64");
  await page.getByLabel("Upload photos", { exact: true }).setInputFiles([
    {
      name: "bad.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    },
    { name: "valid.png", mimeType: "image/png", buffer },
  ]);
  await expect(page.locator(".count")).toHaveText("1/5");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "could not be decoded",
  );
  await page.locator(".drop-zone").evaluate((element, base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    for (let batch = 0; batch < 2; batch++) {
      const transfer = new DataTransfer();
      for (let i = 0; i < 5; i++)
        transfer.items.add(
          new File([bytes], `${batch}-${i}.png`, { type: "image/png" }),
        );
      element.dispatchEvent(
        new DragEvent("drop", { bubbles: true, dataTransfer: transfer }),
      );
    }
  }, buffer.toString("base64"));
  await expect(page.locator(".count")).toHaveText("5/5");
  await expect(page.locator(".photo-grid img")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Next: structure" }),
  ).toBeEnabled();
});
