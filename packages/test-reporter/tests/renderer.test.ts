import { expect, test } from "bun:test";
import type { TestResult } from "../src/model";
import { HtmlRenderer } from "../src/renderer";

test("renders a self-contained HTML document with summary counts", async () => {
  const results: TestResult[] = [
    { name: "test one", status: "passed", duration: 100 },
    { name: "test two", status: "failed", duration: 50, error: "boom" },
    { name: "test three", status: "skipped" },
  ];

  const html = await new HtmlRenderer().render(results, { title: "My Report" });

  expect(html).toContain("<!doctype html>");
  expect(html).toContain("My Report");
  expect(html).toContain("test one");
  expect(html).toContain("test two");
  expect(html).toContain("test three");
  // Summary stats: 3 total, 1 passed, 1 failed, 1 skipped.
  expect(html).toMatch(/<span class="stat-value">3<\/span>/);
});

test("HTML-escapes test names and error text — no raw markup or script tags survive", async () => {
  const results: TestResult[] = [
    {
      name: `<script>alert("xss")</script>`,
      status: "failed",
      error: `Expected <div class="a"> but got & "something else"`,
    },
  ];

  const html = await new HtmlRenderer().render(results);

  expect(html).not.toContain("<script>alert(");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;div class=&quot;a&quot;&gt;");
  expect(html).toContain("&amp;");
});

test("embeds a screenshot as a base64 data URI when the loader resolves bytes", async () => {
  const fakeBytes = new Uint8Array([1, 2, 3, 4]);
  const results: TestResult[] = [{ name: "with screenshot", status: "passed", screenshot: "some/path.png" }];

  const html = await new HtmlRenderer().render(results, {
    loadScreenshot: async (path) => (path === "some/path.png" ? fakeBytes : null),
  });

  const expectedBase64 = Buffer.from(fakeBytes).toString("base64");
  expect(html).toContain(`data:image/png;base64,${expectedBase64}`);
});

test("shows a visible note instead of crashing when a screenshot can't be found", async () => {
  const results: TestResult[] = [{ name: "missing screenshot", status: "passed", screenshot: "gone.png" }];

  const html = await new HtmlRenderer().render(results, { loadScreenshot: async () => null });

  expect(html).toContain("Screenshot not found");
  expect(html).toContain("gone.png");
});

test("produces valid output for an empty result set", async () => {
  const html = await new HtmlRenderer().render([]);
  expect(html).toContain("<!doctype html>");
  expect(html).toMatch(/<span class="stat-value">0<\/span>/);
});
