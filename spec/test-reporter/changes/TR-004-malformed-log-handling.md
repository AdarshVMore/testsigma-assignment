# TR-004: Explicit handling for malformed/truncated logs

**Status:** Proposed — not started
**Component:** test-reporter

## Problem

`ConfigurableLogParser.parse()` has no concept of "this input looks
incomplete or malformed." A log truncated mid-run (crashed process, killed CI
job, stdout pipe cut off) produces whatever partial `TestResult[]` the state
machine happened to accumulate before the text ended — silently. A caller has
no signal to distinguish "this log genuinely only had 3 tests" from "this log
was supposed to have 20 tests but got cut off after 3."

## Proposed change

Add a lightweight consistency check after parsing: if the log's own final
summary line(s) (matched by the `errorBoundary` rule, e.g. "`2 passed`",
"`1 failed`") state totals that don't match the actual count of parsed
`TestResult`s by status, surface that mismatch — either as a second return
value (`{ results, warnings: string[] }`) or a thrown/logged warning,
whichever fits the calling convention better. Also worth flagging: a
`currentFailureTarget` still open (non-null) when the input ends, meaning an
error block was started but never closed — a decent proxy for "the log ends
mid-failure-dump."

## Why it's not done yet

Not needed by the one real captured log this repo produces (a complete,
un-truncated run) — found by asking "what happens on bad input," not by
hitting a real failure.

## Effort / risk

Small. Purely additive; the interesting design decision is the return-shape
change (`TestResult[]` → `{ results, warnings }`) which is a breaking API
change for `parse()`'s callers (`renderer.ts`, `examples/reporter/generate.ts`,
the test suite) — small blast radius in this repo today, but worth deciding
deliberately rather than bolting on inconsistently.
