import type { Locator, Page } from "playwright";
import { FingerprintExtractor, type ElementFingerprint } from "./fingerprint";

export interface Candidate {
  locator: Locator;
  fingerprint: ElementFingerprint;
}

/**
 * Upper bound on candidates scored per heal. Bounds the cost of extracting +
 * scoring on very large pages. A V1 cap, not a tuned value — documented as a
 * limitation in the README (a target whose only same-tag/same-role sibling
 * pool exceeds this on the live page won't be considered past the cap).
 */
export const MAX_CANDIDATES = 25;

/**
 * Generates the pool of DOM elements a broken locator's fingerprint gets
 * scored against.
 *
 * Strategy (deliberately simple, not exhaustive): same tag name as the
 * target first — the overwhelmingly common case for "id/class renamed"
 * refactors, since the element itself doesn't change shape. Falls back to
 * matching on the target's role only if no same-tag elements exist at all,
 * covering the rarer case where the tag itself changed (e.g. a `<div
 * role="button">` became a real `<button>`).
 */
export class CandidateGenerator {
  private extractor = new FingerprintExtractor();

  async generate(page: Page, target: Pick<ElementFingerprint, "tag" | "role">): Promise<Candidate[]> {
    let locators = await page.locator(target.tag).all();

    if (locators.length === 0 && target.role) {
      locators = await page.locator(`[role="${target.role}"]`).all();
    }

    locators = locators.slice(0, MAX_CANDIDATES);

    const candidates: Candidate[] = [];
    for (const locator of locators) {
      const fingerprint = await this.extractor.extract(locator);
      candidates.push({ locator, fingerprint });
    }
    return candidates;
  }
}
