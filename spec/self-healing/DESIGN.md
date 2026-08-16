# Self-healing locator engine — DESIGN

Reflects `packages/self-healing/src/*` as it exists today. See `SPEC.md` for
the contract this is implementing.

## Pipeline

```
Healer.locate()
  └─ try original selector (page.locator(selector).count() === 1?)
       ├─ yes → { status: "original-ok" }
       └─ no  → CandidateGenerator.generate(page, fingerprint)
                  └─ Scorer.score(target, candidate) for each candidate
                       └─ classify(scored) → healed | ambiguous | failed
```

Four files, one responsibility each: `fingerprint.ts` (what an element looks
like), `candidate-generator.ts` (which elements to consider), `scorer.ts` (how
well each one matches + the decision rule), `healer.ts` (orchestration +
`click()`/`fill()` convenience).

## Why an explicitly-authored fingerprint, not auto-derived

The assignment's own phrasing — "original locator fails → capture/derive
element fingerprint" — has a chicken-and-egg problem: you cannot inspect the
live DOM through a selector that no longer resolves to anything. A fingerprint
has to come from somewhere that still worked.

Two ways to resolve that: (a) require the caller to supply a fingerprint
alongside the selector, captured once while it worked, or (b) auto-capture on
first successful run and persist it to disk, healing against the stored
snapshot on later runs. **(a) was chosen for V1** — simpler, fully
deterministic, no persisted state, no first-run-vs-Nth-run branching to test.
(b) is closer to how Testim/Testsigma actually behave and is a legitimate next
step (`changes/SHL-002`), deliberately not built now because it adds real
surface area (file I/O, staleness handling, a migration story if the schema
changes) that a V1 didn't need to prove the core idea.

## Why candidate generation is same-tag-first, role-as-fallback

Same tag name is the overwhelmingly common case for the exact failure mode
this tool targets (an id/class refactor doesn't change what element it is).
Querying by tag is also cheap and easy to explain. Role-based fallback exists
for the rarer "the tag itself changed" case, but was deliberately scoped as a
**fallback**, not a union, to keep candidate pools small and the "why was this
candidate even considered" story simple. The audit (`SPEC.md` "Known gaps" #1)
found this fallback-only design has a real recall cost when a page has both
kinds of elements; `changes/SHL-003` proposes unioning them instead.

`MAX_CANDIDATES = 25` exists purely to bound worst-case cost on large pages —
not a value derived from any measurement, just a conservative round number.

## Scoring model

A weighted average over 8 signals, deliberately presented as a heuristic, not
a probability — every candidate's `SignalScore[]` is returned alongside the
total so the decision is always inspectable:

| Signal | Weight | Why this weight |
|---|---|---|
| `text` | 0.25 | Visible copy is the least likely thing to change purely from an id/class refactor. |
| `ariaLabel` | 0.15 | Same reasoning as text, second because not every element has one. |
| `role` | 0.10 | Boolean signal — cheap, reliable when present. |
| `tag` | 0.10 | Always applicable; a weak signal alone (many elements share a tag) but free. |
| `classList` | 0.10 | Deliberately **low** — in the exact scenario this tool targets, class names are expected to change. Included because some tokens (BEM modifiers, utility classes) do survive rewrites and can break ties, but must never dominate. |
| `formAttributes` (name/placeholder/type) | 0.10 | Useful for form fields, inapplicable for most other elements. |
| `otherAttributes` (`data-*`, title/alt/for) | 0.10 | Strong when present (esp. `data-testid`), often absent. |
| `domContext` (ancestor chain + sibling position) | 0.10 | Tie-breaker, not a primary identifier — legitimate redesigns move elements, so this is intentionally minor. |

**Applicability / renormalization.** A signal only counts toward the total if
the *target* fingerprint actually has that information — e.g. a plain
`<button>Submit</button>` with no `aria-label` isn't penalized for lacking
one. Concretely: `total = Σ(weight × value for applicable signals) / Σ(weight
for applicable signals)`. This was not the first design: an earlier version
summed `weight × value` unconditionally, which meant an ordinary element with
only 2-3 identifying signals could never score above ~0.60 even for a perfect
id/class-only rename. The unit tests caught this (see `PROMPTS.md`
implementation log) before it shipped, and renormalization was the fix.

**Text similarity** (`text`, `ariaLabel`) is word-level Jaccard with a
substring bonus (`max(jaccard, 0.6)` when one string fully contains the
other) — deliberately simple and auditable over anything NLP-flavored. Known
weakness: punctuation isn't stripped before tokenizing (`SPEC.md` gap #3).

## Decision thresholds

`AUTO_HEAL_MIN_SCORE = 0.65`, `MARGIN_MIN = 0.15`, `FAILURE_FLOOR = 0.35` —
starting values, tuned against `packages/self-healing/tests/eval.test.ts`'s 4
fixtures until all 4 classified correctly, not chosen blind and left alone.
The margin check exists specifically to catch the case where a high absolute
score alone would look safe to auto-heal but several candidates are tied at
that score (the "ambiguous duplicates" fixture is exactly this — every
candidate scores identically since the fixture's rows are structurally
identical, so margin lands at ~0 regardless of how high the absolute score
is).

When there's only one candidate, `margin` is defined as that candidate's own
score (there's nothing to be ambiguous against) — this means "margin" doesn't
always represent the same kind of quantity (relative gap vs. absolute score)
depending on candidate count. Documented here because it's a real modeling
choice, not an accident.

## What was deliberately not built

- **OpenRouter LLM fallback for `ambiguous`** — the `ambiguous` status is a
  first-class, distinct outcome specifically so this has somewhere to plug in
  later without changing the deterministic path. Not built due to time
  (`changes/SHL-001`).
- **Persisted fingerprint store** — see above (`changes/SHL-002`).
- **The 5th "restructured DOM" eval fixture** — cut for time; the
  `domContext` weight's behavior on a legitimate element-moved-to-new-parent
  case is therefore unverified (`changes/SHL-004`).
