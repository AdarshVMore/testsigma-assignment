# PROMPTS.md

This file is a running log of the prompts that actually directed this build, appended live
as development happened (not reconstructed afterward). It is being written using **Claude
Code** (Claude Sonnet 5, Anthropic's CLI tool), working directly in this repository.

**Note on completeness:** this file captures the substantive, decision-shaping prompts —
the initial brief, clarifying questions and their answers, and any mid-build course
corrections. It is not a byte-for-byte transcript (tool calls, file reads, and intermediate
subagent exchanges are not reproduced here). If the reviewer wants the full raw session
transcript, it can be exported from the Claude Code session directly — ask and I'll provide
it.

---

## Prompt 1 — Initial brief (verbatim)

> Act as a senior Backend Engineer
>
> Read the attached assignment @assignment.md first. Treat it as the source of truth for
> requirements and submission expectations.
>
> I want to build this as a **V1 assignment-quality implementation**, not a
> production-grade framework. The goal is something I can run end-to-end, test properly,
> understand completely, and explain in a technical interview.
>
> ### Architecture
>
> Use this overall flow:
>
> Playwright → Self-healing locator → Test execution → screenshots + logs → Visual
> regression + Log parser → HTML report
>
> Use a class-based architecture for the core components.
>
> Suggested structure: [packages/{self-healing,visual-regression,test-reporter},
> examples/, README.md, PROMPTS.md, package.json — see repo layout]
>
> Adjust the structure only if you have a good technical reason.
>
> ### Tech stack
>
> - Self-healing: TypeScript + Playwright
> - Reporter: TypeScript
> - Visual regression: Python + Pillow/OpenCV as appropriate
> - LLM: OpenRouter, only where it genuinely helps
>
> ### Self-healing locator
>
> Use a deterministic approach first: original locator fails → capture/derive element
> fingerprint → generate DOM candidates → score candidates → check score +
> ambiguity/margin → auto-heal only when sufficiently confident → use OpenRouter LLM only
> as an optional fallback for ambiguous cases.
>
> The scoring must be explainable. Do not pretend a heuristic similarity score is a
> statistical probability.
>
> Include useful signals such as text, tag, aria-label, role, name, placeholder, type,
> attributes, class and DOM context where appropriate.
>
> Make the scoring decision inspectable so I can see why candidate A beat candidate B.
>
> Create a small evaluation/test dataset with changed IDs/classes, ambiguous candidates,
> and cases where healing should fail. Tune/validate the heuristic against those tests
> rather than choosing weights blindly.
>
> The LLM must be optional and its output must be validated before being trusted.
>
> ### Visual regression
>
> Build a practical V1, not an Applitools clone. Handle: screenshot comparison,
> configurable tolerance/threshold, meaningful visual differences, changed-region
> detection, generated diff image.
>
> Be aware that naïve pixel-perfect comparison is sensitive to 1px shifts, anti-aliasing
> and rendering noise. Use a sensible comparison strategy and document V1 limitations
> rather than over-engineering it.
>
> ### Test reporter
>
> Normalize parsed logs into a common model such as: `TestResult { name, status,
> duration?, error?, screenshot? }`.
>
> Support at least one concrete log format well, but design the parser so additional
> formats can be added.
>
> A simple configurable parser definition is preferable to hardcoding everything. An LLM
> may optionally help generate a parser configuration for an unknown format, but normal
> parsing should remain deterministic.
>
> ### Development rules
>
> Do not build the whole project in one shot. First inspect the repository and
> assignment, then give me a concise implementation plan and proceed incrementally.
>
> Write tests alongside development, not at the end.
>
> I need: unit tests for important classes, integration tests where useful, and at least
> one runnable E2E example for each of the three components.
>
> I should be able to run the project locally and demonstrate: (1) a Playwright test
> where the ID/class changes but the self-healing locator still finds the element, (2)
> two screenshots where visual regression detects and highlights a real change, (3) raw
> test logs being converted into a standalone HTML report containing pass/fail results
> and screenshots.
>
> Keep dependencies and abstractions minimal. Do not add databases, microservices,
> Kubernetes, authentication, dashboards, or other infrastructure unless the assignment
> genuinely requires them.
>
> If you think a technical decision is important or my proposed approach is flawed, tell
> me before implementing it. Don't blindly agree with me.
>
> Keep the V1 small enough that I can understand and defend every part of it.
>
> Maintain PROMPTS.md with the actual prompts used during development, as required by the
> assignment.
>
> Make the README concise and cover the assignment interpretation, architecture,
> important decisions, V1 limitations, assumptions, setup, testing, and what could be
> improved with more time.
>
> Start by inspecting the PDF/repository and giving me the implementation plan. Do not
> write the entire codebase immediately.

## Response summary — inspection + plan

Inspected `assignment.md` and the actual repo state (a fresh `bun init` scaffold with one
git commit and a GitHub remote already existed — corrected an earlier stale read that had
assumed an empty, non-git repo). Produced a phased implementation plan and, before
implementing, surfaced three decisions back to the user rather than assuming defaults:

1. **Time budget** — the assignment's own "aim to spend around [X hours/days]" line was
   left blank in the source PDF/markdown. Asked directly.
2. **A real design gap in the stated self-healing flow**: "original locator fails →
   derive fingerprint" has a chicken-and-egg problem — a fingerprint can't be derived by
   inspecting the live DOM through a selector that's already broken. Proposed resolution:
   the fingerprint is supplied explicitly alongside the selector at `HealingLocator`
   construction time, rather than auto-captured from a prior run (which would need a
   persisted snapshot store — flagged as a V2 idea, not built).
3. **OpenCV as a new Python dependency** for connected-component region clustering in
   visual regression (vs. hand-rolling a union-find labeler) — asked since it's a new
   install with a real alternative.

## Prompt 2 — Clarifying answers (via structured question tool)

> Time budget: **"Just a few hours"** — aggressively trim: skip the integration demo and
> LLM fallback entirely, minimal eval dataset, focus only on the 3 required runnable
> demos.
>
> Fingerprint source: **"Explicit authoring (Recommended)"** — caller supplies selector +
> fingerprint together up front.
>
> Region clustering: **"Add opencv-python-headless (Recommended)"**.

## Response summary — scope cut + plan finalized

Given the "few hours" budget, cut the integration-demo increment and the OpenRouter LLM
fallback from V1 entirely (documented as deliberate, explained omissions rather than
silently dropped — the `Healer`'s `AMBIGUOUS` status is still a distinct, inspectable
result so the seam for a future LLM tiebreaker exists without any LLM code being written).
Locked in Bun workspaces (matches the pre-existing `bun.lock`/`CLAUDE.md`), `bun test` as
the TS runner, a fully decoupled Python package for visual regression, and Playwright's
list-reporter stdout as the one log format the reporter supports well (chosen because the
self-healing example can produce it for real, tying the reporter's demo to genuine output
rather than a synthetic fixture). Wrote the full plan to
`~/.claude/plans/act-as-a-senior-eager-russell.md`, user approved it, and implementation
began increment-by-increment as described in that plan.

---

## Implementation log (increments 0-5)

Implementation proceeded increment-by-increment per the approved plan, without further
user prompts mid-build (the user's "just a few hours" answer had already set the scope).
Worth recording honestly here — since the assignment specifically asks whether I can
"recognize when the AI gets something wrong and course-correct" — are the concrete bugs
caught and fixed in my own generated code while building, not just at review time:

1. **`fingerprint.ts` closure bug.** First draft used `declare const X_PLACEHOLDER` to
   reference constants inside a Playwright `locator.evaluate()` callback. That's a
   type-only lie — Playwright serializes `evaluate()` callbacks by source text and runs
   them inside the browser via CDP, so they cannot close over outer TS/JS scope at
   runtime. Fixed by passing the needed constants through `evaluate()`'s second (`arg`)
   parameter instead. Caught by re-reading the code before running it, not by a failing test.

2. **Missing "class" signal.** The original brief explicitly lists `class` among the
   signals to include; the first `Scorer` draft captured `classList` in the fingerprint
   but never scored it. Added `scoreClassList` and rebalanced weights (text 0.30→0.25,
   ariaLabel 0.20→0.15, classList new at 0.10) to keep the total at 1.0.

3. **Score renormalization.** The first weighted-sum design summed `weight*value` across
   *all* signals unconditionally, which meant an element with no aria-label/data-attributes
   (i.e. most ordinary elements) could never score above ~0.60 even for a perfect id/class-only
   rename — the "auto-heal" unit test failed against this design. Fixed by only counting
   signals the *target* fingerprint actually had information for, renormalizing the
   weighted average over just those applicable signals. This is exactly the "tune against
   the eval tests rather than choosing weights blindly" loop the brief asked for.

4. **Visual-regression demo fixture accidentally validated a documented limitation.**
   The first before/after example changed a button's color from blue `(66,133,244)` to
   green `(52,168,83)` — and the tool reported no difference. Not a bug in the comparator:
   those two colors convert to nearly identical grayscale luminance (~126 vs ~124), which
   is exactly the "grayscale diffing under-detects same-brightness color changes"
   limitation already planned to be documented. Caught by actually running the CLI against
   its own example instead of assuming it would work, then fixed the fixture (switched to
   a high-contrast color pair) and kept the near-miss documented in
   `examples/visual-regression/README.md` as a real, reproducible instance rather than
   quietly picking around it.

5. **Screenshot-to-test association was backwards from what real output shows.** The
   original plan assumed `[screenshot]` marker lines should associate with "the
   most-recently-completed test." Checking the *actual* captured `raw-run.log` showed
   Playwright's list reporter prints a test's own console output (including these
   markers) *during* that test's body — i.e. *before* its pass/fail summary line, not
   after. Fixed the parser to buffer a "pending" screenshot path and assign it to the
   *next* test-result line instead.

6. **Bare `bun test` at the repo root crashed.** Bun's default test runner scans the
   whole repo tree by filename pattern, which also matched
   `examples/self-healing/demo.spec.ts` — a `@playwright/test` file that can only run
   under Playwright's own CLI, not Bun's test runner. Running the full-repo verification
   pass surfaced this before it could surprise a reviewer; fixed with a `bunfig.toml`
   scoping Bun's default test root to `packages/`.

All three required demos, the full TS test suite (42 tests), and the full Python test
suite (19 tests) were verified green — with zero environment variables set, confirming
the (deliberately unbuilt) LLM paths are never load-bearing — before finalizing this
file and the README.

*(Further prompts — any follow-up requests or re-scoping beyond this point — get appended
below as they happen.)*
