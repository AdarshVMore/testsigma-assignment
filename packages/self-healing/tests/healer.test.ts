import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
import { FingerprintExtractor } from "../src/fingerprint";
import { Healer } from "../src/healer";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

test("original selector still resolves: uses it directly, no healing attempted", async () => {
  await page.setContent(`<button id="save-btn">Save</button>`);
  const fingerprint = await new FingerprintExtractor().extract(page.locator("#save-btn"));

  const healer = new Healer({ page, selector: "#save-btn", fingerprint });
  const result = await healer.locate();

  expect(result.status).toBe("original-ok");
  expect(result.candidatesConsidered).toBe(0);
  expect(await result.locator!.textContent()).toBe("Save");
});

test("broken selector heals to the correct element when a clean winner exists", async () => {
  await page.setContent(`
    <button id="save-draft-btn">Save Draft</button>
    <button id="legacy-submit-btn" class="btn-legacy" type="submit">Submit Order</button>
  `);
  const fingerprint = await new FingerprintExtractor().extract(page.locator("#legacy-submit-btn"));

  // Simulate a deploy that renamed the id/class after the fingerprint was captured.
  await page.evaluate(() => {
    const el = document.querySelector("#legacy-submit-btn")!;
    el.id = "cta-2024-submit";
    el.className = "button-refactored primary-refactored";
  });

  const healer = new Healer({ page, selector: "#legacy-submit-btn", fingerprint });
  const result = await healer.locate();

  expect(result.status).toBe("healed");
  expect(result.score).toBeGreaterThanOrEqual(0.65);
  expect(await result.locator!.getAttribute("id")).toBe("cta-2024-submit");
  expect(result.breakdown).not.toBeNull();
});

test("ambiguous case is reported as such, not forced to a guess", async () => {
  await page.setContent(`
    <button id="row-1-delete">Delete</button>
    <button id="row-2-delete">Delete</button>
    <button id="row-3-delete">Delete</button>
  `);
  const fingerprint = await new FingerprintExtractor().extract(page.locator("#row-2-delete"));

  await page.evaluate(() => {
    document.querySelector("#row-2-delete")!.id = "row-2-delete-renamed";
  });

  const healer = new Healer({ page, selector: "#row-2-delete", fingerprint });
  const result = await healer.locate();

  expect(result.status).toBe("ambiguous");
  expect(result.locator).toBeNull();
  expect(result.candidatesConsidered).toBe(3);
});

test("removed element is reported as failed, not matched to something unrelated", async () => {
  await page.setContent(`<a href="/orders">View order status</a>`);

  const healer = new Healer({
    page,
    selector: "#gone-submit-btn",
    fingerprint: {
      tag: "button",
      text: "Submit Order",
      ariaLabel: null,
      role: "button",
      name: null,
      placeholder: null,
      type: "submit",
      id: null,
      classList: [],
      attributes: {},
      domContext: { parentTag: null, ancestorTags: [], siblingIndex: 0, siblingCount: 1 },
    },
  });
  const result = await healer.locate();

  expect(result.status).toBe("failed");
  expect(result.locator).toBeNull();
  expect(result.candidatesConsidered).toBe(0);
});

test("click() throws a clear error instead of silently no-op-ing when healing fails", async () => {
  await page.setContent(`<p>Nothing here</p>`);
  const healer = new Healer({
    page,
    selector: "#gone",
    fingerprint: {
      tag: "button",
      text: "Gone",
      ariaLabel: null,
      role: "button",
      name: null,
      placeholder: null,
      type: null,
      id: null,
      classList: [],
      attributes: {},
      domContext: { parentTag: null, ancestorTags: [], siblingIndex: 0, siblingCount: 1 },
    },
  });

  await expect(healer.click()).rejects.toThrow(/cannot resolve/);
});
