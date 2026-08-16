# TR-002: LLM-assisted parser config generation for unknown formats

**Status:** Proposed — not started
**Component:** test-reporter

## Problem

Adding support for a new raw log format currently means a human hand-writes a
new `ParserDefinition` (regexes + field maps) by reading sample output. The
assignment explicitly allows an LLM to help generate a parser configuration
for an unknown format, as long as normal parsing stays deterministic.

## Proposed change

A separate, manually-invoked script/module (e.g.
`parser-config-generator.ts`) — **not** imported by `parser.ts` or
`renderer.ts`, so the normal `parse()`/`render()` call graph never references
an LLM or `OPENROUTER_API_KEY` at all:

1. Takes a sample of the unknown log format as input.
2. Asks an LLM to draft a `ParserDefinition` matching it (the same plain-data
   shape the engine already consumes — regexes + field maps, nothing
   `eval`'d).
3. Outputs the draft for a human to review, test against the sample, and
   check into the repo alongside `PLAYWRIGHT_LIST_REPORTER` — never
   auto-adopted without review.

## Why it's not done yet

Explicitly scoped out with the LLM self-healing fallback (`SHL-001`) when
time budget was set — both are "optional LLM enhancement" items cut before
the required deterministic core.

## Effort / risk

Small-to-medium. Low risk to the rest of the system by construction (it's
architecturally isolated from the parse path), but the generated
`ParserDefinition`s would need real validation against real sample logs
before being trusted — an LLM asked to write regex-based line rules can
produce plausible-looking-but-wrong patterns (e.g. mishandling
edge cases in duration formatting or multi-line errors) that only show up
against real data, same caution as `SHL-001`'s validation requirement.
