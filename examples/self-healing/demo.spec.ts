import { expect, test } from "@playwright/test";
import { FingerprintExtractor } from "../../packages/self-healing/src/fingerprint";
import { Healer } from "../../packages/self-healing/src/healer";

/**
 * Demo requirement #1: a Playwright test where the target element's id/class
 * change, and the self-healing locator still finds it.
 *
 * `[screenshot] <path>` lines are logged deliberately — Playwright's
 * list-reporter stdout doesn't carry screenshot paths on its own, and the
 * test-reporter example (packages/test-reporter) parses these markers back
 * out of this test's real captured stdout. See README "Important decisions".
 */
test("self-healing locator survives an id/class rename after a simulated deploy", async ({ page }) => {
  await page.setContent(`
    <html>
      <body>
        <form>
          <button id="save-draft-btn" class="btn-secondary" type="button">Save Draft</button>
          <button id="legacy-submit-btn" class="btn-legacy" type="submit">Submit Order</button>
        </form>
        <div id="confirmation" hidden>Order submitted!</div>
        <script>
          document.querySelector('#legacy-submit-btn').addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('#confirmation').hidden = false;
          });
        </script>
      </body>
    </html>
  `);

  // 1. Capture the fingerprint while the original selector still resolves —
  // this is the "explicit authoring" step from README/Decision 5, done here
  // programmatically for the demo instead of by hand.
  const fingerprint = await new FingerprintExtractor().extract(page.locator("#legacy-submit-btn"));

  await page.screenshot({ path: "examples/self-healing/output/01-before-rename.png" });
  console.log("[screenshot] examples/self-healing/output/01-before-rename.png");

  // 2. Simulate a deploy that renamed the button's id/class. The decoy
  // "Save Draft" button is left alone to prove healing doesn't just grab
  // "the first button on the page".
  await page.evaluate(() => {
    const el = document.querySelector("#legacy-submit-btn")!;
    el.id = "cta-2024-submit";
    el.className = "button-refactored primary-refactored";
  });

  await page.screenshot({ path: "examples/self-healing/output/02-after-rename-before-heal.png" });
  console.log("[screenshot] examples/self-healing/output/02-after-rename-before-heal.png");

  // 3. The original selector is now broken. Healer resolves it via the
  // fingerprint instead of the (stale) id.
  const healer = new Healer({ page, selector: "#legacy-submit-btn", fingerprint });
  const result = await healer.click();

  console.log(
    `[healing] status=${result.status} score=${result.score} margin=${result.margin} ` +
      `candidatesConsidered=${result.candidatesConsidered}`,
  );
  if (result.breakdown) {
    for (const signal of result.breakdown) {
      console.log(
        `[healing]   ${signal.signal}: value=${signal.value} weight=${signal.weight} ` +
          `applicable=${signal.applicable} (${signal.detail})`,
      );
    }
  }

  expect(result.status).toBe("healed");

  // 4. Prove it's a *real* successful interaction on the correct element,
  // not just a plausible-looking match.
  await expect(page.locator("#confirmation")).toBeVisible();
  await expect(page.locator("#confirmation")).toHaveText("Order submitted!");

  await page.screenshot({ path: "examples/self-healing/output/03-after-heal-and-click.png" });
  console.log("[screenshot] examples/self-healing/output/03-after-heal-and-click.png");
});

// The remaining tests exist to give the test-reporter example (Increment 4)
// real pass/fail/skip variety and a genuine Playwright error/stack to parse,
// instead of a synthetic log — see README "Important decisions" (Decision 5/6).

test("self-healing reports ambiguous instead of guessing among duplicate candidates", async ({ page }) => {
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

  console.log(`[healing] status=${result.status} margin=${result.margin} candidatesConsidered=${result.candidatesConsidered}`);
  expect(result.status).toBe("ambiguous");
});

test("example of a genuine failure (kept intentionally so the report shows a real red result)", async ({ page }) => {
  await page.setContent(`<button id="only-btn">Only Button</button>`);
  await expect(page.locator("#only-btn")).toHaveText("Wrong Expected Text", { timeout: 1000 });
});

test.skip("example of a skipped test (kept intentionally so the report shows a real skip)", async () => {
  // Intentionally skipped — demonstrates the reporter's skip-status handling.
});
