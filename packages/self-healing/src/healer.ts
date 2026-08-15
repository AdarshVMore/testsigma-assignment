import type { Locator, Page } from "playwright";
import { CandidateGenerator } from "./candidate-generator";
import type { ElementFingerprint } from "./fingerprint";
import { classify, Scorer, type SignalScore } from "./scorer";

export type HealingStatus = "original-ok" | "healed" | "ambiguous" | "failed";

export interface HealingResult {
  status: HealingStatus;
  /** Resolvable only when status is "original-ok" or "healed". */
  locator: Locator | null;
  /** The winning candidate's score, when one was found (healed/ambiguous/failed-with-candidates). */
  score: number | null;
  /** Full per-signal breakdown for the winning/best candidate — why it scored what it scored. */
  breakdown: SignalScore[] | null;
  candidatesConsidered: number;
  /** Gap to the second-best candidate; null only when there were zero candidates. */
  margin: number | null;
}

export interface HealingLocatorConfig {
  page: Page;
  /** The original selector, as originally authored — may currently be broken. */
  selector: string;
  /**
   * Explicitly authored, not auto-captured: see README "Important decisions"
   * for why. Typically produced once via FingerprintExtractor while the
   * selector still resolved, then hand-copied into the test/config.
   */
  fingerprint: ElementFingerprint;
}

/**
 * Orchestrates the self-healing pipeline for a single locator:
 * try the original selector first; if it doesn't resolve to exactly one
 * element, generate + score candidates against the supplied fingerprint and
 * apply the auto-heal decision rule (see scorer.ts `classify`).
 *
 * The "ambiguous" outcome is a first-class result, not squashed into
 * success or failure — it's the seam a future LLM tiebreaker would plug
 * into (not implemented in this V1; see README "What I'd do next").
 */
export class Healer {
  constructor(private readonly config: HealingLocatorConfig) {}

  async locate(): Promise<HealingResult> {
    const original = this.config.page.locator(this.config.selector);
    const originalCount = await original.count();

    if (originalCount === 1) {
      return {
        status: "original-ok",
        locator: original,
        score: null,
        breakdown: null,
        candidatesConsidered: 0,
        margin: null,
      };
    }

    const candidates = await new CandidateGenerator().generate(this.config.page, this.config.fingerprint);
    const scorer = new Scorer();
    const scored = candidates.map((candidate) => ({
      candidate,
      score: scorer.score(this.config.fingerprint, candidate.fingerprint),
    }));
    const result = classify(scored);

    const base = {
      score: result.best?.score.total ?? null,
      breakdown: result.best?.score.signals ?? null,
      candidatesConsidered: candidates.length,
      margin: result.margin,
    };

    if (result.outcome === "healed") {
      return { status: "healed", locator: result.best!.candidate.locator, ...base };
    }
    return { status: result.outcome, locator: null, ...base };
  }

  /** Convenience wrapper: locate then click. Throws if no interactable element was found. */
  async click(): Promise<HealingResult> {
    const result = await this.locate();
    if (!result.locator) {
      throw new Error(`Healer.click(): cannot resolve an element (status="${result.status}")`);
    }
    await result.locator.click();
    return result;
  }

  /** Convenience wrapper: locate then fill. Throws if no interactable element was found. */
  async fill(value: string): Promise<HealingResult> {
    const result = await this.locate();
    if (!result.locator) {
      throw new Error(`Healer.fill(): cannot resolve an element (status="${result.status}")`);
    }
    await result.locator.fill(value);
    return result;
  }
}
