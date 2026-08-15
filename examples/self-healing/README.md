# Self-healing example

Demo requirement #1: a Playwright test where the target element's id/class
change mid-test, and the self-healing locator still finds it.

`demo.spec.ts` renders a small checkout form with a decoy "Save Draft"
button and a "Submit Order" button (`#legacy-submit-btn`, `.btn-legacy`).
It captures a fingerprint from the button while the selector still resolves,
then simulates a deploy that renames the id/class, then resolves the
now-broken selector through `Healer` and clicks it — asserting the click
had a real effect (a confirmation message appears), not just that *some*
plausible-looking element was found.

Three more tests exist purely to give the reporter example (see
`examples/reporter/`) real pass/fail/skip/error variety from one real run,
instead of a synthetic log.

## Run

```bash
bun run demo:self-healing
```

Or directly:

```bash
bunx playwright test --config packages/self-healing/playwright.config.ts
```

Console output includes a `[healing]` line with the score, margin, and full
per-signal breakdown for the winning candidate — this is what "inspectable
scoring" means in practice; see the root README's "Self-healing" section for
what each signal means.

Screenshots land in `output/`.
