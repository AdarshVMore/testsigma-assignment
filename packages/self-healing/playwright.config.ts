import { defineConfig } from "@playwright/test";

// Deliberately minimal: one project (chromium, already cached locally),
// list reporter (its stdout is what packages/test-reporter parses in the
// reporter example — see Decision 6 in the plan/README).
export default defineConfig({
  testDir: "../../examples/self-healing",
  timeout: 30_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    headless: true,
  },
});
