# Working style: spend tokens on the work, not on finding it

Everything loaded early is re-sent on every turn for the rest of the session. Keep the window small.

## Finding things
- Read `MAP.md` before any `ls`/`find`. Don't re-list folders it already describes.
- Grep for the symbol, id or heading first (`grep -n`), then read a tight window (about 40–80 lines) around the hit. Never read a file over ~400 lines whole to change one function.
- Never `cat` the big generated JSON in `src/data/` or anything under `public/assets/`. Grep, or print one entry with `node -e`.
- Long docs (`GAME_DESIGN.md`, `CHECKLIST.md`, `docs/plans/*`): grep the `##` headings, read only the section you need.
- Don't re-read a file you just wrote or edited; the edit tool already confirmed it.

## Commands
- Trim noisy output: `npm test -- --reporter=dot`, `| tail -40`, `| grep -E "FAIL|Error|✗"`, `git log --oneline -15`, `git diff --stat` before a full diff.
- Run one test file while iterating (`npx vitest run tests/unit/save.test.ts`, `npx playwright test tests/e2e/milestone8.spec.ts`); run the full `npm run check` once at the end.

## Subagents
- Push wide, verbose work into a subagent so only its summary lands here: reading long logs or CI output, repo-wide greps across many files, long git history, surveying a big doc. Ask it for a short answer with file:line references.
- For read-only searches, use the project's `explore` agent (`.claude/agents/explore.md`, runs on Haiku, can't edit files). It's much cheaper than a general-purpose agent. If it isn't listed in your session, fall back to the built-in `Explore` agent with `model: haiku`.
- Don't use subagents for small, targeted lookups you can do with one grep.

## Git (several threads share `main`)
- Start from fresh `origin/main` (`git fetch origin main` and branch or rebase onto it) before changing code.
- Rebase onto `origin/main` again right before pushing; resolve conflicts then, while they are small.
- Save version numbers are shared: if another branch already took the next save version, take the one after.

## Tools (director wish, 2026-10-30)
- **Context7** (connector): look up library docs (Phaser, Vite, Zod, Vitest, Playwright) before guessing an API.
- **Serena** (plugin, MCP): prefer its symbol tools (find symbol, references, overview) over reading whole files in `src/`.
- **Superpowers** and **Ponytail** (plugins): follow them, but this file and CLAUDE.md win where they differ (no subagents for small lookups; smallest change that works).
- Cloud threads load plugins only from claude.ai **Project settings > Plugins** and MCP servers only from claude.ai connectors; repo `.mcp.json`, `.claude/settings.json` plugins and `.claude/skills/` are ignored there.
