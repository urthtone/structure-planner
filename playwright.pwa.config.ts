import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e-pwa",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3102",
    headless: true,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npm start -- --hostname 127.0.0.1 --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      XAI_API_KEY: "",
      OPENAI_API_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
