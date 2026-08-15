import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright";
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

test("extracts tag, text, id and class from a simple button", async () => {
  await page.setContent(`<button id="submit-btn" class="btn primary">Submit Order</button>`);
  const fp = await new FingerprintExtractor().extract(page.locator("#submit-btn"));

  expect(fp.tag).toBe("button");
  expect(fp.text).toBe("Submit Order");
  expect(fp.id).toBe("submit-btn");
  expect(fp.classList).toEqual(["btn", "primary"]);
});

test("infers implicit role for common interactive tags", async () => {
  await page.setContent(`<a href="/checkout">Checkout</a>`);
  const fp = await new FingerprintExtractor().extract(page.locator("a"));
  expect(fp.role).toBe("link");
});

test("explicit role attribute wins over implicit inference", async () => {
  await page.setContent(`<div role="button" tabindex="0">Click</div>`);
  const fp = await new FingerprintExtractor().extract(page.locator("div"));
  expect(fp.role).toBe("button");
});

test("captures aria-label, name, placeholder and type on a form field", async () => {
  await page.setContent(
    `<input id="email" name="email" type="email" placeholder="you@example.com" aria-label="Email address" />`,
  );
  const fp = await new FingerprintExtractor().extract(page.locator("#email"));

  expect(fp.ariaLabel).toBe("Email address");
  expect(fp.name).toBe("email");
  expect(fp.placeholder).toBe("you@example.com");
  expect(fp.type).toBe("email");
});

test("captures data-* attributes but excludes id/class/style/etc from the attribute bag", async () => {
  await page.setContent(
    `<button id="x" class="y" style="color:red" data-testid="checkout-btn" data-track="cta" title="Proceed">Go</button>`,
  );
  const fp = await new FingerprintExtractor().extract(page.locator("#x"));

  expect(fp.attributes["data-testid"]).toBe("checkout-btn");
  expect(fp.attributes["data-track"]).toBe("cta");
  expect(fp.attributes["title"]).toBe("Proceed");
  expect(fp.attributes["id"]).toBeUndefined();
  expect(fp.attributes["style"]).toBeUndefined();
});

test("captures DOM context: parent tag, ancestor chain and sibling position", async () => {
  await page.setContent(`
    <form>
      <div class="row">
        <button>First</button>
        <button id="target">Second</button>
        <button>Third</button>
      </div>
    </form>
  `);
  const fp = await new FingerprintExtractor().extract(page.locator("#target"));

  expect(fp.domContext.parentTag).toBe("div");
  expect(fp.domContext.siblingIndex).toBe(1);
  expect(fp.domContext.siblingCount).toBe(3);
  expect(fp.domContext.ancestorTags[0]).toBe("div");
  expect(fp.domContext.ancestorTags[1]).toBe("form");
});

test("normalizes multi-line/whitespace-heavy text content", async () => {
  await page.setContent(`<button id="b">\n   Submit    Order   \n</button>`);
  const fp = await new FingerprintExtractor().extract(page.locator("#b"));
  expect(fp.text).toBe("Submit Order");
});
