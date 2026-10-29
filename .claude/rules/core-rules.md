---
paths:
  - "src/core/**"
---
# Rules for `src/core/` (pure game rules)

- Never import Phaser (`tests/unit/content.test.ts` enforces it), and don't import from `src/ui` or `src/scenes` either.
- All randomness goes through the named streams in `src/core/rng.ts`. Adding a stream must not change any existing roll; never borrow another system's stream for a new feature.
- Outcomes never depend on animation timing, UI state, hovers or previews.
- Balance numbers belong in `src/data/balance.json` or validated content data, not in code.
- Battle engine emits events; graphics react through the presentation-cue layer (`src/core/presentation/cues.ts`).
- Story effects carry ids and go through the ledger (`src/core/story/ledger.ts`) so nothing applies twice. Guide: `docs/story-foundation.md`.
- Old-seed fingerprint tests (`tests/unit/story.test.ts`, `autoplay.ts`) pin exact outcomes; if your change moves them, find out why before re-pinning.
