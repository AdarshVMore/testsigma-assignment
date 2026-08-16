# TR-001: Correlate failure details by location, not name alone

**Status:** Proposed — not started
**Component:** test-reporter
**Priority:** Highest of all `changes/` entries across the three components — this is closest to an actual bug.

## Problem

`ConfigurableLogParser` correlates a `failureDetailStart` line back to its
`testResult` line using `byName.get(name)` — a `Map<string, TestResult>`
keyed purely on the test's display name. Both line types actually carry a
`location` (file:line:col) in the real Playwright format, but it's never
captured or used.

Concretely: if two tests anywhere in the parsed log share the exact same name
(realistic — e.g. `test("renders correctly")` reused across two different
spec files, or two `describe` blocks each containing an identically-titled
test), `byName.set()` on the second one silently overwrites the map entry for
the first. Depending on ordering, this either misattributes a failure's error
text to the wrong `TestResult`, or drops it entirely.

No existing test exercises duplicate names — every fixture and the real
captured log happen to have unique names, so this has never actually failed
in this repo's own test suite, but that's exactly why it's worth flagging
rather than assuming it doesn't matter.

## Proposed change

1. Extract `location` from both the `testResult` and `failureDetailStart`
   regex patterns (add a named group to `PLAYWRIGHT_LIST_REPORTER`'s rules).
2. Key the correlation map on `` `${location}::${name}` `` instead of `name`
   alone — location is effectively unique per test in a real suite (same
   file, same line).
3. Add a test case with two identically-named tests at different locations,
   one of them failing, asserting the error attaches to the correct one.

## Why it's not done yet

Found during this audit, not before — the original design used name-only
correlation because every test fixture happened to have unique names, so it
wasn't caught by any test. This is the audit doing its job.

## Effort / risk

Small. Purely additive to the regex + a map-key change; low risk since the
existing behavior for unique-name logs is unaffected. The main cost is
writing a good duplicate-name test fixture.
