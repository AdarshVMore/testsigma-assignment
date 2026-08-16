# TR-003: A second real ParserDefinition

**Status:** Proposed — not started
**Component:** test-reporter

## Problem

The "add new formats without touching the engine" claim currently rests
entirely on architecture (the engine has no Playwright-specific logic outside
the one `PLAYWRIGHT_LIST_REPORTER` definition object) — it's never actually
been proven by adding a second format. There's a real difference between "the
design should support this" and "this was demonstrated."

## Proposed change

Pick one genuinely different, genuinely real log shape and write a second
`ParserDefinition` for it without modifying `ConfigurableLogParser`'s engine
code at all. Good candidates, roughly in order of how different they'd be
from the Playwright format (more different = a better proof):

- A structured-ish format like JUnit XML (would also test whether the
  line-based state machine assumption holds for a format that isn't really
  "line-oriented" the same way — possibly revealing that the fixed 4-role
  vocabulary doesn't fit non-line-oriented formats at all, which would itself
  be a useful finding).
- Jest's default console reporter output (different status glyphs, different
  failure-block shape, different duration formatting).
- A plain CI-style format (`PASS`/`FAIL` keywords instead of glyphs).

Add real sample fixtures + parser tests for whichever is chosen, mirroring
`parser.test.ts`'s existing structure.

## Why it's not done yet

Time budget; the Playwright format was prioritized because it's the one this
repo can produce for real (tying into the self-healing demo's actual
output), and one well-supported format was the explicit ask.

## Effort / risk

Small if the chosen format is genuinely line-oriented (close to the
Playwright case); potentially more revealing than expected if it isn't — see
the JUnit XML note above. That's a feature of doing this, not a risk to avoid.
