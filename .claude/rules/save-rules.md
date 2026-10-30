---
paths:
  - "src/save/**"
  - "src/core/state.ts"
  - "src/core/profile.ts"
  - "src/game/GameSession.ts"
---
# Rules for saves

- Any change to saved shapes bumps the version in `src/save/saveManager.ts` and adds a migration. Never silently discard a save; malformed saves must recover safely.
- Other branches may bump the same version: rebase on `origin/main` first and take the next free number.
- Saves are validated with Zod on load.
- Test save → reload at every meaningful checkpoint; nothing (reward, story effect, evolution) may apply twice after a reload or a replayed animation.
