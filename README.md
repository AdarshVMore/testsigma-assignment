## What I understood the problem to be

Three tools, barely specified, that's the actual test. It's not whether all three exist by the deadline, it's whether the decisions behind them hold up when someone asks "why did you build it that way." So I aimed for three small, defensible cores instead of three feature-complete products, and put the real time into the parts that needed a genuine call, how do you fingerprint an element through a selector that no longer resolves, how do you diff two screenshots without flagging every anti-aliased pixel as a bug, instead of padding out edge cases nobody asked for.

## What I built, and what I left out

All three are working, tested code, not a design doc pretending to be one. Self-healing captures a fingerprint before a selector breaks, scores candidates against it, and returns healed / ambiguous / failed instead of a boolean, pretending "ambiguous" doesn't happen felt worse than admitting it does. Visual regression blurs both images, thresholds the difference, and clusters what survives into bounding boxes, which is enough to catch a real change without reaching for SSIM. The reporter turns Playwright's real stdout into one self-contained HTML file, fed the self-healing demo's *actual* captured log rather than a synthetic one, so the three pieces are genuinely connected instead of three separate show-and-tells.

Left out on purpose: an LLM tiebreaker for ambiguous matches, a persisted fingerprint store, per-channel visual diffing, a second log format for the reporter. Each has a real seam to grow into later, `ambiguous` exists specifically for something to plug into, the reporter's parser config is plain JSON with nothing hard-coded, but a half-working version of any of them seemed worse than a solid version of what was actually asked for.

## Assumptions

"Explainable" scoring means an inspectable breakdown of why a candidate won, not a calibrated probability, the brief draws that distinction itself. A screenshot belongs to whichever test's body logged it, which I only got right by reading Playwright's actual output instead of guessing at it. "Shareable" report means one file you can email, not a report plus a folder of assets that has to travel with it.

## Setup

```bash
bun install
python3 -m venv packages/visual-regression/.venv
packages/visual-regression/.venv/bin/pip install -r packages/visual-regression/requirements.txt
bunx playwright install chromium   # only if the demo below complains it's missing
```

## Testing

```bash
bun run typecheck
bun run test                                                                      # expect 42 pass
packages/visual-regression/.venv/bin/pytest packages/visual-regression/tests -v   # expect 19 passed
```

## The three required demos

```bash
# 1. Self-healing
bun run demo:self-healing
open examples/self-healing/output/03-after-heal-and-click.png   # should read "Order submitted!"

# 2. Visual regression
cd packages/visual-regression
.venv/bin/python ../../examples/visual-regression/generate_fixtures.py
.venv/bin/python src/cli.py ../../examples/visual-regression/before.png ../../examples/visual-regression/after.png \
  --output-dir ../../examples/visual-regression/output
cd ../..
open examples/visual-regression/output/highlighted.png   # red box on the changed button

# 3. Reporter
bun run demo:reporter
open examples/reporter/output/report.html
```

Demo 1 and demo 2 both exit non-zero, on purpose (a deliberately failing test, a deliberately injected visual diff). Not broken.

## The web dashboard

```bash
bun run web:collect   # re-pulls real output from all three packages into web/data/snapshot.json
bun run web:dev        # http://localhost:4300
```

Sidebar has 6 pages:
- **Overview**, stat row + recent healing/test/artifact activity, links out to everything else.
- **Self-Healing**, left rail lists scenarios, click one for fingerprint, per-candidate DOM + full signal-score breakdown.
- **Visual Diff**, Highlighted / 2-up / 1-up / Diff toggle buttons above the image; region list on the right.
- **Reports**, click a test row to expand its error text and screenshot.
- **Test Runs**, **Artifacts**, flat lists, nothing to click into.

It only reads `web/data/snapshot.json`, re-run `web:collect` any time the underlying data changes, then refresh the page.

## Testing with your own data

**Self-healing**, needs a Playwright `Page` and a selector that still resolves at capture time:
```ts
const fingerprint = await new FingerprintExtractor().extract(page.locator("#your-selector"));
// ...break the selector however (id/class rename, DOM change)...
const result = await new Healer({ page, selector: "#your-selector", fingerprint }).click();
```
No fixture files needed, any page Playwright can open works.

**Visual regression**, needs two PNG screenshots, same viewport ideally (mismatched dimensions are reported, not crashed on):
```bash
.venv/bin/python src/cli.py /path/to/before.png /path/to/after.png --output-dir /path/to/out
```

**Reporter**, needs raw stdout from Playwright's `list` reporter (not `json`/`html`):
```bash
FORCE_COLOR=1 bunx playwright test > my-run.log 2>&1
```
Then point a small script at it:
```ts
const results = new ConfigurableLogParser().parse(await Bun.file("my-run.log").text(), PLAYWRIGHT_LIST_REPORTER);
await Bun.write("report.html", await new HtmlRenderer().render(results, { title: "My Report" }));
```

**Web dashboard**, no UI for swapping data yet. Edit the scenario/fixture paths in `web/data/collect.ts`, then `bun run web:collect`.

## What I'd do next with more time

1. **OpenRouter LLM fallback** for the `ambiguous` case, propose a pick among the already-generated candidates, validate the response is (a) well-formed JSON, (b) one of the actually-offered candidate indices (never a hallucinated element), and (c) re-clears a minimum deterministic-scorer floor, the LLM breaks ties among plausible candidates, it never overrides the heuristic.
2. **Persisted fingerprint store**, auto-captured on first successful locate, so authoring a fingerprint by hand isn't required.
3. **Per-channel (not grayscale) visual diffing** to close the same-luminance blind spot, plus optional ignore-regions for known-dynamic content.
4. **A second reporter `ParserDefinition`** (e.g. JSON-lines or JUnit XML) to prove out the "additional formats without touching the engine" claim with a second real example, not just an architectural argument.
5. **The integration-demo script** chaining all three components through one command, now that all three exist independently.
