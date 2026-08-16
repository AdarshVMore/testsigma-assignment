# Spec overview

This directory formalizes, after the fact, what was already built for the three
components in `assignment.md`. It is not a greenfield spec written before
implementation — the code came first (see `PROMPTS.md` for how), and this is the
retroactive audit + specification pass requested to (a) pin down what the system
is actually supposed to do vs. what it happens to do today, and (b) give future
work (including LLM-assisted changes) a stable document to work against instead
of re-deriving intent from source.

**Ground truth is the code.** Where a `SPEC.md`/`DESIGN.md` and the implementation
disagree, that's either a bug (tracked in that component's `changes/`) or a spec
error — not license to change behavior to match the doc.

## Structure

Each component (`self-healing`, `visual-regression`, `test-reporter`) has:

- **`SPEC.md`** — what the system must do: goal, scope, inputs/outputs, behavior,
  failure behavior, assumptions, acceptance criteria. Describes the contract, not
  the code.
- **`DESIGN.md`** — the implementation decisions actually made and why, including
  the tradeoffs and known weaknesses that came out of the audit below. No
  aspirational architecture that doesn't exist in the repo.
- **`changes/`** — individual proposed-but-not-yet-built changes, one per file,
  named `<PREFIX>-<NNN>-<slug>.md` (`SHL-` self-healing, `VR-` visual-regression,
  `TR-` test-reporter). These are backlog items, not history — a change file
  disappears (or gets a `Status: Done` line, implementer's call) once it ships.

## Audit summary (2026-08-15)

Full findings live in each component's `SPEC.md` ("Known gaps") and the
individual `changes/` entries. Headline result: **all three components' core V1
scope is implemented and green** — 42 TypeScript tests (`bun run test`), 19
Python tests (`pytest`), clean typecheck, all three required demos runnable.
Nothing here is "broken" in the sense of failing its own tests. The audit's
value is in what the tests *don't* cover:

- **Self-healing**: candidate recall has a real gap (role-based fallback only
  triggers when zero same-tag elements exist at all, never unions with them —
  see `SHL-003`); the DOM-context weight was never validated against the one
  eval scenario that would actually stress it (element moved to a new parent,
  see `SHL-004`); text similarity is punctuation-naive.
- **Visual regression**: the anti-aliasing tolerance claim — the whole reason
  the blur+threshold pipeline exists — has only ever been tested against
  synthetic PIL-drawn images, never a real Chromium-rendered screenshot pair
  (see `VR-001`). That's the single most important gap in this component.
- **Test reporter**: `ConfigurableLogParser` correlates a failure's detailed
  error block back to its summary line **by test name alone**, not location.
  Two tests sharing a name (plausible across spec files in a real suite) will
  silently misattribute or drop error text. This is the closest thing to an
  actual bug found in this audit (see `TR-001`).

## Where to look

- [`self-healing/SPEC.md`](self-healing/SPEC.md), [`self-healing/DESIGN.md`](self-healing/DESIGN.md)
- [`visual-regression/SPEC.md`](visual-regression/SPEC.md), [`visual-regression/DESIGN.md`](visual-regression/DESIGN.md)
- [`test-reporter/SPEC.md`](test-reporter/SPEC.md), [`test-reporter/DESIGN.md`](test-reporter/DESIGN.md)
- [`../Phases.md`](../Phases.md) — phase-by-phase checklist of the whole assignment
- [`../README.md`](../README.md) — the submission-facing summary (interpretation, setup, what's left out and why)
- [`../PROMPTS.md`](../PROMPTS.md) — the real prompt history
