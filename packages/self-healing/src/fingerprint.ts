import type { Locator } from "playwright";

/**
 * Where an element sits in the DOM tree, independent of its id/class.
 * Used as a tie-breaking / plausibility signal, not a primary identifier —
 * page redesigns legitimately move elements around, so this is intentionally
 * one of the lower-weighted signals in the scorer.
 */
export interface DomContext {
  parentTag: string | null;
  /** Tag names of up to 4 ancestors, closest first (e.g. ["div", "form", "section"]). */
  ancestorTags: string[];
  /** Index of this element among siblings that share its tag name. */
  siblingIndex: number;
  /** Count of siblings (including itself) that share its tag name. */
  siblingCount: number;
}

/**
 * A snapshot of the signals that identify an element, independent of any
 * single locator string. This is what the self-healing engine matches
 * candidates against after the original selector stops resolving.
 */
export interface ElementFingerprint {
  tag: string;
  /** Normalized (whitespace-collapsed, trimmed) visible text. */
  text: string;
  ariaLabel: string | null;
  /** Explicit `role` attribute, or a small implicit-role inference for common tags. */
  role: string | null;
  name: string | null;
  placeholder: string | null;
  type: string | null;
  id: string | null;
  classList: string[];
  /** `data-*` attributes plus a small allowlist (title/alt/for) — stable, non-styling attributes. */
  attributes: Record<string, string>;
  domContext: DomContext;
}

const MAX_ANCESTOR_DEPTH = 4;
const ATTRIBUTE_ALLOWLIST = ["title", "alt", "for"];
const ALREADY_CAPTURED_ATTRIBUTES = [
  "id",
  "class",
  "style",
  "aria-label",
  "role",
  "name",
  "placeholder",
  "type",
];

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

interface ExtractionConfig {
  maxAncestorDepth: number;
  attributeAllowlist: string[];
  alreadyCapturedAttributes: string[];
}

/**
 * Reads an {@link ElementFingerprint} off a live Playwright element.
 *
 * Used two ways in this repo: (a) as an authoring convenience — run it once
 * while the original locator still resolves, and hand-copy/paste the result
 * into a `HealingLocator` config, and (b) directly in tests/examples that
 * capture a fingerprint from a "before" DOM state before simulating a
 * rename. It is never used to derive a fingerprint from an already-broken
 * locator — see the README's "Assumptions" section for why that's not
 * possible.
 */
export class FingerprintExtractor {
  async extract(locator: Locator): Promise<ElementFingerprint> {
    const config: ExtractionConfig = {
      maxAncestorDepth: MAX_ANCESTOR_DEPTH,
      attributeAllowlist: ATTRIBUTE_ALLOWLIST,
      alreadyCapturedAttributes: ALREADY_CAPTURED_ATTRIBUTES,
    };

    // NOTE: Playwright serializes this callback by source text and runs it
    // inside the browser via CDP — it cannot close over outer TS/JS scope.
    // Everything it needs is passed explicitly through the second `evaluate`
    // argument (`config`) instead of being referenced as a closure.
    const raw = await locator.evaluate((el, cfg) => {
      const element = el as HTMLElement;
      const tag = element.tagName.toLowerCase();

      const explicitRole = element.getAttribute("role");
      const type = element.getAttribute("type");
      let implicitRole: string | null = null;
      if (tag === "a" && element.hasAttribute("href")) implicitRole = "link";
      else if (tag === "button" || (tag === "input" && ["button", "submit", "reset"].includes(type ?? "")))
        implicitRole = "button";
      else if (tag === "input" && type === "checkbox") implicitRole = "checkbox";
      else if (tag === "input" && type === "radio") implicitRole = "radio";
      else if (tag === "input" || tag === "textarea") implicitRole = "textbox";
      else if (tag === "select") implicitRole = "combobox";
      else if (tag === "img") implicitRole = "img";
      else if (/^h[1-6]$/.test(tag)) implicitRole = "heading";

      const attributes: Record<string, string> = {};
      for (const attr of Array.from(element.attributes)) {
        if (cfg.alreadyCapturedAttributes.includes(attr.name)) continue;
        if (attr.name.startsWith("data-") || cfg.attributeAllowlist.includes(attr.name)) {
          attributes[attr.name] = attr.value;
        }
      }

      const ancestorTags: string[] = [];
      let ancestor = element.parentElement;
      while (ancestor && ancestorTags.length < cfg.maxAncestorDepth) {
        ancestorTags.push(ancestor.tagName.toLowerCase());
        ancestor = ancestor.parentElement;
      }

      const parent = element.parentElement;
      let siblingIndex = 0;
      let siblingCount = 1;
      if (parent) {
        const sameTagSiblings = Array.from(parent.children).filter(
          (c) => c.tagName === element.tagName,
        );
        siblingIndex = sameTagSiblings.indexOf(element);
        siblingCount = sameTagSiblings.length;
      }

      return {
        tag,
        text: element.innerText ?? element.textContent ?? "",
        ariaLabel: element.getAttribute("aria-label"),
        role: explicitRole ?? implicitRole,
        name: element.getAttribute("name"),
        placeholder: element.getAttribute("placeholder"),
        type,
        id: element.id || null,
        classList: Array.from(element.classList),
        attributes,
        domContext: {
          parentTag: parent ? parent.tagName.toLowerCase() : null,
          ancestorTags,
          siblingIndex,
          siblingCount,
        },
      };
    }, config);

    return { ...raw, text: normalizeText(raw.text) };
  }
}
