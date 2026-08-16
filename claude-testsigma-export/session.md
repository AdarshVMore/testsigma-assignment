## Prompt 1

Read the attached assignment PDF first. Treat it as the source of truth for requirements and submission expectations.

I want to build this as a **V1 assignment-quality implementation**, not a production-grade framework. The goal is something I can run end-to-end, test properly, understand completely, and explain in a technical interview.

### Architecture

Use this overall flow:

Playwright
→ Self-healing locator
→ Test execution
→ screenshots + logs
→ Visual regression + Log parser
→ HTML report

Use a class-based architecture for the core components.

Suggested structure:

```text
testsigma-assignment/
├── packages/
│   ├── self-healing/
│   │   ├── src/
│   │   │   ├── locator.ts
│   │   │   ├── fingerprint.ts
│   │   │   ├── candidate-generator.ts
│   │   │   ├── scorer.ts
│   │   │   └── healer.ts
│   │   └── tests/
│   ├── visual-regression/
│   │   ├── src/
│   │   │   ├── compare.py
│   │   │   ├── threshold.py
│   │   │   └── regions.py
│   │   └── tests/
│   └── test-reporter/
│       ├── src/
│       │   ├── parser.ts
│       │   ├── model.ts
│       │   └── renderer.ts
│       └── tests/
├── examples/
│   ├── self-healing/
│   ├── visual-regression/
│   └── reporter/
├── README.md
├── PROMPTS.md
└── package.json
```

Adjust the structure only if you have a good technical reason.

### Tech stack

* Self-healing: TypeScript + Playwright
* Reporter: TypeScript
* Visual regression: Python + Pillow/OpenCV as appropriate
* LLM: OpenRouter, only where it genuinely helps

### Self-healing locator

Use a deterministic approach first:

original locator fails
→ capture/derive element fingerprint
→ generate DOM candidates
→ score candidates
→ check score + ambiguity/margin
→ auto-heal only when sufficiently confident
→ use OpenRouter LLM only as an optional fallback for ambiguous cases

The scoring must be explainable. Do not pretend a heuristic similarity score is a statistical probability.

Include useful signals such as text, tag, aria-label, role, name, placeholder, type, attributes, class and DOM context where appropriate.

Make the scoring decision inspectable so I can see why candidate A beat candidate B.

Create a small evaluation/test dataset with changed IDs/classes, ambiguous candidates, and cases where healing should fail. Tune/validate the heuristic against those tests rather than choosing weights blindly.

The LLM must be optional and its output must be validated before being trusted.

### Visual regression

Build a practical V1, not an Applitools clone.

Handle:

* screenshot comparison
* configurable tolerance/threshold
* meaningful visual differences
* changed-region detection
* generated diff image

Be aware that naïve pixel-perfect comparison is sensitive to 1px shifts, anti-aliasing and rendering noise. Use a sensible comparison strategy and document V1 limitations rather than over-engineering it.

### Test reporter

Normalize parsed logs into a common model such as:

```ts
interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  duration?: number;
  error?: string;
  screenshot?: string;
}
```

Support at least one concrete log format well, but design the parser so additional formats can be added.

A simple configurable parser definition is preferable to hardcoding everything. An LLM may optionally help generate a parser configuration for an unknown format, but normal parsing should remain deterministic.

### Development rules

Do not build the whole project in one shot.

First inspect the repository and assignment, then give me a concise implementation plan and proceed incrementally.

Write tests alongside development, not at the end.

I need:

* unit tests for important classes
* integration tests where useful
* at least one runnable E2E example for each of the three components

I should be able to run the project locally and demonstrate:

1. A Playwright test where the ID/class changes but the self-healing locator still finds the element.
2. Two screenshots where visual regression detects and highlights a real change.
3. Raw test logs being converted into a standalone HTML report containing pass/fail results and screenshots.

Keep dependencies and abstractions minimal.

Do not add databases, microservices, Kubernetes, authentication, dashboards, or other infrastructure unless the assignment genuinely requires them.

If you think a technical decision is important or my proposed approach is flawed, tell me before implementing it. Don't blindly agree with me.

Keep the V1 small enough that I can understand and defend every part of it.

Maintain `PROMPTS.md` with the actual prompts used during development, as required by the assignment.

Make the README concise and cover the assignment interpretation, architecture, important decisions, V1 limitations, assumptions, setup, testing, and what could be improved with more time.

Start by inspecting the PDF/repository and giving me the implementation plan. Do not write the entire codebase immediately.





## Prompt 2

Now that the backend/V1 implementation is working, I want to build a frontend for the project.

Before coding, inspect the existing implementation, examples, outputs, and README so the UI represents the real capabilities of the system. Do not invent functionality that doesn't exist.

The frontend should feel like a serious developer/testing tool, not a generic AI-generated SaaS dashboard.

### Design direction

Think:

**Linear × Playwright test report × Chromatic visual diff viewer**

Use these only as inspiration for information hierarchy and interaction patterns, not as something to copy.

I want:

* dark-first developer-tool aesthetic
* clean typography
* compact but readable information density
* subtle 1px borders
* restrained surfaces
* small consistent radii
* one restrained accent color
* green/red only for semantic test states
* monospace typography for technical values/code
* subtle transitions
* excellent spacing and alignment
* strong visual hierarchy

Avoid:

* gradients everywhere
* glassmorphism
* glowing cards
* huge hero sections
* excessive rounded cards
* excessive shadows
* "AI" sparkle aesthetics
* generic dashboard templates
* unnecessary charts
* decorative UI that doesn't communicate information

The product should feel like a tool engineers would actually use.

### Core UX

Build the UI around a **Test Run / Workbench** concept.

Main navigation should roughly expose:

* Overview
* Test Runs
* Self-Healing
* Visual Diff
* Reports
* Artifacts

Don't expose the internal package structure directly.

### Important screens

#### 1. Overview / Test Run

Show:

* current/latest run
* pass/fail counts
* duration
* visual regression status
* locator healing events
* test execution list
* recent artifacts/activity

#### 2. Self-Healing

Make this one of the strongest screens.

Show:

* original locator
* failure state
* candidate elements
* candidate similarity scores
* feature-level scoring breakdown
* best candidate
* score margin over second candidate
* healing decision
* relevant DOM/HTML details

The user should be able to understand WHY the locator was healed.

#### 3. Visual Diff

Build an image inspection experience.

Support:

* baseline vs current
* 1-up / 2-up / diff views
* highlighted difference regions
* difference percentage
* threshold
* pass/fail
* region details

Make the actual screenshot/diff the focus of the page rather than burying it inside cards.

#### 4. Reports

Show:

* overall pass rate
* passed/failed/skipped
* duration
* test list
* error details
* screenshots
* generated artifacts

The report should feel like an engineering test report, not an analytics dashboard.

### UX requirements

The frontend must work with the actual V1 backend/example outputs.

If there is currently no API layer, create the smallest sensible integration or local data adapter needed for the demo. Don't introduce a database or unnecessary backend infrastructure just for the UI.

Make the complete flow demonstrable locally.

Prioritize:

1. information hierarchy
2. usability
3. visual polish
4. realistic data
5. responsive behavior

Before implementing, briefly inspect the repo and propose the page structure and component hierarchy.

Then build incrementally and run the app after each major screen.

Do not rewrite the backend unless something genuinely needs to change to expose data required by the UI.

Most importantly: this should look like a developer tool someone designed carefully, not a collection of AI-generated cards.



## Prompt 3

pause the current frontend work for now. i want to formalize the backend with specs before we continue building.

first inspect the current repo, assignment, existing backend, tests, `PROMPTS.md`, `CLAUDE.md` and current `spec/`.

do this in order:

1. audit what is already implemented for all 3 components and what is still missing.
2. challenge the current implementation briefly — especially assumptions, edge cases and places where the behavior could be wrong.
3. create/update `spec/` with this structure:

spec/
├── overview.md
├── self-healing/
│   ├── SPEC.md
│   ├── DESIGN.md
│   └── changes/
├── visual-regression/
│   ├── SPEC.md
│   ├── DESIGN.md
│   └── changes/
└── test-reporter/
├── SPEC.md
├── DESIGN.md
└── changes/

`SPEC.md` should describe what the system must do: goal, scope, inputs, outputs, behavior, failure behavior, assumptions and acceptance criteria.

`DESIGN.md` should capture implementation decisions and why we chose them. Don't invent implementation details just to fill the file.

4. create `Phases.md` at the root. Track the whole assignment phase-wise as a checklist. Include what has already been completed based on the current repo and what remains. Mark completed work as `[x]` and remaining work as `[ ]`.

Keep the phases practical, something like:

* Phase 1: problem understanding and scope
* Phase 2: specs and design
* Phase 3: self-healing
* Phase 4: visual regression
* Phase 5: test reporter
* Phase 6: integration/demo/frontend
* Phase 7: testing and refinement
* Phase 8: README and final submission

Don't modify the implementation or continue frontend work yet.

At the end, show me the files you created/updated and a short summary of what is done vs remaining.


The files in /change should look something like these
spec/self-healing/changes/SHL-001-llm-fallback.md
etc
