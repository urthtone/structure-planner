import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3100", headless: true },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
    env: { XAI_API_KEY: "", OPENAI_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
