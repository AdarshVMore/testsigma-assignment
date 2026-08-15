import type { ElementFingerprint } from "./fingerprint";

/**
 * A single signal's contribution to a candidate's score, kept around so the
 * decision is inspectable after the fact — never just a bare number.
 */
export interface SignalScore {
  signal: string;
  /** Declared weight for this signal (weights across all signals sum to 1.0). */
  weight: number;
  /** How well this signal matched, 0..1. */
  value: number;
  /** Whether this signal had anything to compare (see "Applicability" below). */
  applicable: boolean;
  /** weight * value — always computed, but only counted toward `total` if applicable. */
  contribution: number;
  /** Human-readable reason for the value, e.g. what was compared. */
  detail: string;
}

export interface CandidateScore {
  /** Final 0..1 heuristic score — a weighted average over applicable signals. */
  total: number;
  signals: SignalScore[];
}

/**
 * Decision thresholds for the healing decision (used by Healer, re-exported
 * here since they're inseparable from what a "score" means). Starting
 * values, tuned against packages/self-healing/tests/eval.test.ts — not
 * chosen and left blind. See README "Important decisions" for the
 * reasoning.
 */
export const AUTO_HEAL_MIN_SCORE = 0.65;
export const MARGIN_MIN = 0.15;
export const FAILURE_FLOOR = 0.35;

function normalize(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Word-level Jaccard similarity with a substring bonus, used for the two
 * free-text signals (visible text, aria-label). Deliberately not a "smart"
 * NLP similarity — it's a small, auditable heuristic: what fraction of
 * words overlap, with partial credit when one string is fully contained in
 * the other (covers "Submit" -> "Submit Order" style copy tweaks).
 */
function textSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const wordsA = new Set(na.split(" ").filter(Boolean));
  const wordsB = new Set(nb.split(" ").filter(Boolean));
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  if (na.includes(nb) || nb.includes(na)) return Math.max(jaccard, 0.6);
  return jaccard;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Scores how well a candidate element matches a target fingerprint.
 *
 * Design principle: this is an explicit, auditable weighted-average
 * heuristic — NOT a statistical probability. Every signal's raw value,
 * weight, and whether it even applied is returned alongside the total, so
 * "why did candidate A beat candidate B" is always answerable by comparing
 * two `CandidateScore.signals` arrays.
 *
 * "Applicability": a signal only counts toward the total if the *target*
 * fingerprint actually has that information (e.g. a plain `<button>Submit
 * All</button>` with no aria-label shouldn't be penalized for lacking one —
 * there was never a signal to lose). This keeps the total meaningful for
 * ordinary elements that only have a couple of identifying signals, instead
 * of diluting every score with irrelevant zeros. Concretely: total =
 * (sum of weight*value over applicable signals) / (sum of weight over
 * applicable signals).
 */
export class Scorer {
  score(target: ElementFingerprint, candidate: ElementFingerprint): CandidateScore {
    const signals: SignalScore[] = [
      this.scoreText(target, candidate),
      this.scoreAriaLabel(target, candidate),
      this.scoreRole(target, candidate),
      this.scoreTag(target, candidate),
      this.scoreClassList(target, candidate),
      this.scoreFormAttributes(target, candidate),
      this.scoreOtherAttributes(target, candidate),
      this.scoreDomContext(target, candidate),
    ];

    const applicable = signals.filter((s) => s.applicable);
    const appliedWeight = applicable.reduce((sum, s) => sum + s.weight, 0);
    const appliedContribution = applicable.reduce((sum, s) => sum + s.contribution, 0);
    const total = appliedWeight === 0 ? 0 : appliedContribution / appliedWeight;

    return { total: round3(total), signals };
  }

  private scoreText(target: ElementFingerprint, candidate: ElementFingerprint): SignalScore {
    const applicable = normalize(target.text) !== "";
    const value = textSimilarity(target.text, candidate.text);
    return this.signal("text", 0.25, value, applicable, `target="${target.text}" candidate="${candidate.text}"`);
  }

  private scoreAriaLabel(target: ElementFingerprint, candidate: ElementFingerprint): SignalScore {
    const applicable = normalize(target.ariaLabel) !== "";
    const value = textSimilarity(target.ariaLabel, candidate.ariaLabel);
    return this.signal(
      "ariaLabel",
      0.15,
      value,
      applicable,
      `target="${target.ariaLabel ?? ""}" candidate="${candidate.ariaLabel ?? ""}"`,
    );
  }

  /**
   * Class names are deliberately the lowest-confidence text-ish signal: in
   * the exact scenario this tool exists for (a refactor renames ids/classes)
   * this is expected to often score 0. It's still worth including — some
   * class tokens (utility classes, BEM modifiers like "primary"/"danger")
   * survive rewrites and can help break ties — but it must never dominate.
   */
  private scoreClassList(target: ElementFingerprint, candidate: ElementFingerprint): SignalScore {
    const applicable = target.classList.length > 0;
    if (!applicable) {
      return this.signal("classList", 0.1, 0, false, "target has no class attribute to match");
    }
    const targetSet = new Set(target.classList);
    const candidateSet = new Set(candidate.classList);
    let intersection = 0;
    for (const c of targetSet) if (candidateSet.has(c)) intersection++;
    const union = new Set([...targetSet, ...candidateSet]).size;
    const value = union === 0 ? 0 : intersection / union;
    return this.signal(
      "classList",
      0.1,
      value,
      true,
      `target=[${target.classList.join(" ")}] candidate=[${candidate.classList.join(" ")}]`,
    );
  }

  private scoreRole(target: ElementFingerprint, candidate: ElementFingerprint): SignalScore {
    const applicable = target.role !== null;
    const value = target.role !== null && target.role === candidate.role ? 1 : 0;
    return this.signal("role", 0.1, value, applicable, `target=${target.role ?? "null"} candidate=${candidate.role ?? "null"}`);
  }

  private scoreTag(target: ElementFingerprint, candidate: ElementFingerprint): SignalScore {
    const value = target.tag === candidate.tag ? 1 : 0;
    return this.signal("tag", 0.1, value, true, `target=${target.tag} candidate=${candidate.tag}`);
  }

  private scoreFormAttributes(target: ElementFingerprint, candidate: ElementFingerprint): SignalScore {
    const keys = ["name", "placeholder", "type"] as const;
    let considered = 0;
    let matched = 0;
    for (const key of keys) {
      const targetValue = target[key];
      if (!targetValue) continue;
      considered++;
      if (targetValue === candidate[key]) matched++;
    }
    const applicable = considered > 0;
    const value = considered === 0 ? 0 : matched / considered;
    return this.signal("formAttributes", 0.1, value, applicable, `${matched}/${considered} of name/placeholder/type matched`);
  }

  private scoreOtherAttributes(target: ElementFingerprint, candidate: ElementFingerprint): SignalScore {
    const targetKeys = Object.keys(target.attributes);
    const applicable = targetKeys.length > 0;
    if (!applicable) {
      return this.signal("otherAttributes", 0.1, 0, false, "target has no data-* / stable attributes to match");
    }
    let matches = 0;
    for (const key of targetKeys) {
      if (candidate.attributes[key] === target.attributes[key]) matches++;
    }
    const value = matches / targetKeys.length;
    return this.signal("otherAttributes", 0.1, value, true, `${matches}/${targetKeys.length} target attributes matched`);
  }

  private scoreDomContext(target: ElementFingerprint, candidate: ElementFingerprint): SignalScore {
    const targetAncestors = target.domContext.ancestorTags;
    const candidateAncestors = candidate.domContext.ancestorTags;

    let ancestorScore: number;
    if (targetAncestors.length === 0 && candidateAncestors.length === 0) {
      ancestorScore = 1;
    } else {
      const len = Math.max(targetAncestors.length, candidateAncestors.length);
      let matches = 0;
      for (let i = 0; i < Math.min(targetAncestors.length, candidateAncestors.length); i++) {
        if (targetAncestors[i] === candidateAncestors[i]) matches++;
      }
      ancestorScore = matches / len;
    }

    const maxCount = Math.max(target.domContext.siblingCount, candidate.domContext.siblingCount, 1);
    const positionDelta = Math.abs(target.domContext.siblingIndex - candidate.domContext.siblingIndex);
    const positionScore = 1 - Math.min(1, positionDelta / maxCount);

    const value = (ancestorScore + positionScore) / 2;
    return this.signal(
      "domContext",
      0.1,
      value,
      true,
      `ancestorMatch=${ancestorScore.toFixed(2)} positionMatch=${positionScore.toFixed(2)}`,
    );
  }

  private signal(signal: string, weight: number, value: number, applicable: boolean, detail: string): SignalScore {
    const clamped = clamp01(value);
    return {
      signal,
      weight,
      value: clamped,
      applicable,
      contribution: round3(weight * clamped),
      detail,
    };
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export type HealingOutcome = "healed" | "ambiguous" | "failed";

export interface Classified<T> {
  candidate: T;
  score: CandidateScore;
}

export interface ClassificationResult<T> {
  outcome: HealingOutcome;
  best: Classified<T> | null;
  /** Gap between the best and second-best score, or the best score itself if there was no second candidate. */
  margin: number | null;
}

/**
 * Applies the auto-heal decision rule to a set of already-scored
 * candidates. Deliberately separate from scoring itself so the exact same
 * decision logic is used by both the eval harness (packages/self-healing/tests/eval.test.ts)
 * and the Healer's orchestration layer — no duplicated thresholds.
 *
 * Rule: below FAILURE_FLOOR -> failed (don't force a bad match). At/above
 * AUTO_HEAL_MIN_SCORE *and* the margin over the second-best candidate is at
 * least MARGIN_MIN -> healed. Otherwise -> ambiguous (confident enough to
 * not be "failed", not confident/unique enough to auto-heal).
 */
export function classify<T>(scored: Classified<T>[]): ClassificationResult<T> {
  if (scored.length === 0) {
    return { outcome: "failed", best: null, margin: null };
  }

  const sorted = [...scored].sort((a, b) => b.score.total - a.score.total);
  const best = sorted[0]!;
  const second = sorted[1];
  const margin = second ? round3(best.score.total - second.score.total) : best.score.total;

  if (best.score.total < FAILURE_FLOOR) return { outcome: "failed", best, margin };
  if (best.score.total >= AUTO_HEAL_MIN_SCORE && margin >= MARGIN_MIN) {
    return { outcome: "healed", best, margin };
  }
  return { outcome: "ambiguous", best, margin };
}
