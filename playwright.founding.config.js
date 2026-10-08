import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "founding-maintenance.local.spec.js",
  workers: 1,
  retries: 0,
  timeout: 180000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3105",
    trace: "off", // Do not record authentication headers or session cookies.
    screenshot: "only-on-failure",
  },
});
