import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
import { CandidateGenerator, MAX_CANDIDATES } from "../src/candidate-generator";
import { FingerprintExtractor } from "../src/fingerprint";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

test("generates candidates matching the target's tag", async () => {
  await page.setContent(`
    <button>One</button>
    <button>Two</button>
    <a href="/x">Link</a>
  `);
  const target = await new FingerprintExtractor().extract(page.locator("button").first());

  const candidates = await new CandidateGenerator().generate(page, target);

  expect(candidates.length).toBe(2);
  expect(candidates.every((c) => c.fingerprint.tag === "button")).toBe(true);
});

test("falls back to role-based matching when no same-tag elements exist on the page", async () => {
  await page.setContent(`<div role="button" id="fake-btn">Click</div>`);

  const candidates = await new CandidateGenerator().generate(page, { tag: "button", role: "button" });

  expect(candidates.length).toBe(1);
  expect(candidates[0]!.fingerprint.role).toBe("button");
});

test("returns no candidates when neither the tag nor the role exist on the page", async () => {
  await page.setContent(`<span>Nothing relevant here</span>`);

  const candidates = await new CandidateGenerator().generate(page, { tag: "button", role: "button" });

  expect(candidates.length).toBe(0);
});

test("caps candidates at MAX_CANDIDATES on pages with many matching elements", async () => {
  const buttons = Array.from({ length: 40 }, (_, i) => `<button>Btn ${i}</button>`).join("");
  await page.setContent(buttons);
  const target = await new FingerprintExtractor().extract(page.locator("button").first());

  const candidates = await new CandidateGenerator().generate(page, target);

  expect(candidates.length).toBe(MAX_CANDIDATES);
});
