# Phases

Whole-assignment checklist, tracked phase by phase. Reflects actual repo state
as of 2026-08-15, not aspiration — a checked box means it's implemented and
tested (or written and reviewed, for docs), not "planned."

Cross-reference: `spec/overview.md` for the audit that informed Phase 7's
remaining items; `README.md` "What I'd do next" for the submission-facing
version of the same gaps; `PROMPTS.md` for how each phase was actually driven.

## Phase 1 — Problem understanding and scope

- [x] Read `assignment.md`, identify it as intentionally open-ended
- [x] Inspect repo/environment before proposing anything (bun scaffold, cached Playwright/Chromium, Python toolchain)
- [x] Surface a real design flaw before building (self-healing's "derive fingerprint from an already-broken locator" chicken-and-egg problem) rather than silently building around it
- [x] Get explicit answers on the 3 decisions that actually change scope: time budget ("a few hours"), fingerprint sourcing (explicit authoring), OpenCV vs. hand-rolled region clustering (OpenCV)
- [x] Cut scope explicitly and record why (LLM fallback, integration-demo script, persisted fingerprint store) rather than silently dropping them

## Phase 2 — Specs and design

- [x] `spec/overview.md`
- [x] `spec/self-healing/SPEC.md`, `spec/self-healing/DESIGN.md`
- [x] `spec/visual-regression/SPEC.md`, `spec/visual-regression/DESIGN.md`
- [x] `spec/test-reporter/SPEC.md`, `spec/test-reporter/DESIGN.md`
- [x] `spec/*/changes/` — 12 proposed-change docs (4 per component) capturing the 2026-08-15 audit findings
- [x] This file

## Phase 3 — Self-healing locator engine

- [x] `ElementFingerprint` + `FingerprintExtractor` (tag/text/aria-label/role/name/placeholder/type/id/class/attributes/DOM context)
- [x] `CandidateGenerator` (same-tag-first, role fallback, capped at 25)
- [x] `Scorer` — 8 weighted signals, applicability-based renormalization, full inspectable per-signal breakdown
- [x] `classify()` — healed/ambiguous/failed decision rule with tuned thresholds
- [x] `Healer` orchestration + `click()`/`fill()` convenience methods
- [x] Eval dataset (4 of the originally-planned 5 fixtures) + `eval.test.ts` harness
- [x] Unit tests (27 tests: fingerprint, candidate-generator, scorer, healer, eval)
- [x] E2E example (`examples/self-healing/demo.spec.ts`) — real id/class rename, healed and clicked for real
- [ ] OpenRouter LLM fallback for `ambiguous` (`spec/self-healing/changes/SHL-001`)
- [ ] Persisted/auto-captured fingerprint store (`SHL-002`)
- [ ] Candidate recall improvements — role/tag union, truncation flag, punctuation-aware text similarity (`SHL-003`)
- [ ] 5th "restructured DOM" eval fixture (`SHL-004`)

## Phase 4 — Visual regression

- [x] `ComparisonConfig` (validated, immutable)
- [x] `ImageComparator` — blur + grayscale threshold + dimension-mismatch handling
- [x] `RegionDetector` — connected-components clustering + area filter + nearby-region merge
- [x] `cli.py` — diff.png / highlighted.png / result.json, exit code reflects pass/fail
- [x] Unit tests (19 tests: threshold, regions, compare)
- [x] E2E example — real detected + precisely-boxed change on a mock UI, including a documented near-miss (grayscale blind spot caught by the tool's own example fixture)
- [ ] Validate against real Chromium-rendered screenshots, not just synthetic PIL images (`VR-001`) — biggest open gap in this component
- [ ] Per-channel diffing to close the same-luminance blind spot (`VR-002`)
- [ ] Ignore-region masks (`VR-003`)
- [ ] Avoid redundant mask recomputation / bound region-merge cost (`VR-004`)

## Phase 5 — Test reporter

- [x] `TestResult` / `ReportModel` (pass rate excludes skipped from denominator)
- [x] `ConfigurableLogParser` + declarative `ParserDefinition` (4-role state machine)
- [x] `PLAYWRIGHT_LIST_REPORTER` — the one format supported well, including ANSI-stripping and multi-line error accumulation
- [x] `HtmlRenderer` — self-contained HTML, base64-inlined screenshots, escaped output
- [x] Unit tests (15 tests: model, parser, renderer incl. an explicit XSS-safety assertion)
- [x] E2E example — real captured stdout from the self-healing demo (not synthetic) → `report.html`
- [ ] Fix name-only failure correlation → location-based (`TR-001`) — closest thing to an actual bug found in the whole audit
- [ ] LLM-assisted parser-config generation for unknown formats (`TR-002`)
- [ ] A second real `ParserDefinition` proving the pluggability claim (`TR-003`)
- [ ] Explicit malformed/truncated-log handling (`TR-004`)

## Phase 6 — Integration, demo, frontend

- [x] Each component's own runnable E2E example, independently demonstrable
- [x] Reporter example consumes self-healing example's *real* captured output — the pipeline is genuinely connected, not three disconnected demos
- [ ] A single script chaining all three end to end (self-heal → screenshot → visual diff → report) — cut for time, no dedicated orchestrator exists
- [~] Frontend workbench UI (`web/`) — **in progress, paused mid-build**:
  - [x] Design direction agreed (dark-first, Linear/Playwright-report/Chromatic-inspired)
  - [x] Bun HTML-import + `Bun.serve()` scaffold (per `CLAUDE.md`, no Vite)
  - [x] Data adapter (`web/data/collect.ts`) — re-runs the real backend classes against the real eval fixtures + demo scenario + real visual-regression result + real parsed log, writes `web/data/snapshot.json`
  - [x] Design tokens, app shell (sidebar nav, top bar, router), shared components (StatusBadge, StatTile, MonoValue, EmptyState)
  - [x] Verified running in a real browser (shell + routing + real snapshot data, zero console errors)
  - [x] Overview page (stat row, healing events, test execution, recent artifacts — verified with screenshot, real data, zero console errors)
  - [x] Self-Healing page (rail + detail: original locator, decision strip, target fingerprint + outerHTML, per-candidate DOM snippet + full signal breakdown with weight/value/contribution — verified with screenshot, real data, zero console errors, fixed a table-overflow layout bug found in review)
  - [x] Visual Diff page (highlighted/2-up/1-up/diff view modes, live region overlay on real pixel coordinates, region list, config/image-info panel — verified all 4 view modes with screenshots, zero console errors, fixed a region-label overlap bug found in review)
  - [x] Reports page (pass-rate/status stat row, expandable test list with real error text + screenshots, generated-artifacts section — verified with screenshot, real data, zero console errors)
  - [x] Test Runs page (honestly shows the one real captured run, not a fabricated history — verified with screenshot)
  - [x] Artifacts page (grouped by component, real thumbnails — verified with screenshot)
  - [x] Full interactive smoke test (sidebar clicks, scenario-rail switching) + mobile (480px) responsive check — verified, zero console errors

## Phase 7 — Testing and refinement

- [x] Unit tests for every important class across all 3 packages (61 tests: 42 TS + 19 Python)
- [x] Integration-level coverage where it matters (eval harness, parser correlation cases, renderer escaping)
- [x] Full clean verification pass (`bun run typecheck`, `bun run test`, `pytest`) green with zero environment variables set
- [x] Critical self-review pass — 6 real bugs caught and fixed during original implementation (recorded in `PROMPTS.md`)
- [x] Second, independent audit pass (this phase's own work) — found further real gaps, now tracked as the 12 `spec/*/changes/` entries, most notably `TR-001` (name-collision bug) and `VR-001` (never validated against real screenshots)
- [ ] Any of the 12 tracked changes actually implemented
- [x] Frontend build verified running — full click-through smoke test (sidebar nav, scenario-rail switching, all 4 visual-diff view modes, expandable report rows) plus a real mobile-width (480px) responsive check; found and fixed a genuine cross-file CSS cascade bug where the sidebar's responsive rules were silently losing to the desktop rule at narrow viewports

## Phase 8 — README and final submission

- [x] `README.md` — interpretation, architecture, decisions, limitations, assumptions, setup, testing, next steps
- [x] `PROMPTS.md` — real prompt history, maintained live, including the implementation self-corrections
- [x] `spec/` + this file — formalized after the fact per this session's request
- [x] Commit plan (grouped, human-written commit messages) handed to the user to run manually
- [ ] Commits actually made / pushed (user's call, on their machine)
- [ ] Final pass confirming `spec/` and `README.md` stay consistent once any `changes/` entries get implemented
