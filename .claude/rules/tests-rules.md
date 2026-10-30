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
