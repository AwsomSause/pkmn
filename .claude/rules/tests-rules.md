---
paths:
  - "tests/**"
  - "playwright.config.ts"
---
# Rules for tests

- Unit tests: Vitest in `tests/unit/`, shared helpers in `helpers.ts`. Run one file while iterating: `npx vitest run tests/unit/<file>`.
- Browser tests: Playwright 1.63.0 in `tests/e2e/`. Chromium is pre-installed in cloud sessions; don't reinstall Playwright.
- Gotcha: the first key press right after a scene change can be dropped. Wait 250 ms after each scene change.
- Two Run-Prep e2e tests in `milestone5_5.spec.ts` are known to be flaky on `main` as well.
- Never skip, disable or loosen a test to get green. Cover normal, boundary and failure cases.

## Re-pinning the gameplay fingerprints (`tests/unit/story.test.ts`, `BEFORE_STORY`)
These hashes say "the rules decided the same thing for these seeds". A red one means a roll or a rule changed.
- **Legit re-pin:** your slice changed gameplay on purpose (a new status rule, enemy behaviour, drafts, balance). Run the test, confirm the only diff is the hash(es), put the new value in, and add one clause to the comment above `BEFORE_STORY` saying why.
- **Not a legit re-pin:** the slice only added UI, data that isn't drawn in the first 600 steps, or a new RNG stream. Then something moved an existing roll: fix that instead (new streams must never change old rolls).
- Fetch `origin/main` first: if another thread already re-pinned, take their value and re-run; two threads re-pinning the same line is the usual cause of a red main.
- Never re-pin to make an unexplained failure go away.

## Which tests to run where (GitHub CI is on since 2026-10-30)
- Locally: `npm run check` once, plus only the e2e specs your slice touches (`npx playwright test tests/e2e/<spec>.spec.ts`). Don't run the full `npm run test:e2e` (about 15 min) before every PR.
- GitHub CI runs the full e2e suite on every PR. Wait for it to be green before merging; a red spec you didn't touch is either a real regression from your change or red on main (check main's last run before blaming yourself).
- If your change is wide (core rules, save format, shared UI like Menu or Reward), also run the specs for the screens it affects.
- A full local sweep is for the e2e-health owner after batches of PRs land.
