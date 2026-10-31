# Rival QA scenarios

Hand checks for the rival system (Rivalry Engine phase 13). Run `npm run report:rivals` first: it must say `Contradictions | 0`.
Numbers come from `docs/quality/RIVAL_REPORT.md` (40 seeds).

## What the report shows (2026-10-31, after tuning)

- Every run makes rivals (about 3 each) and fights 2 to 3 rematches.
- About 73% of runs name an Ultimate Rival and 28% finish its quest.
- Arcs now end more often: 21 of 110 rivals, up from 2 of 115. An arc now resolves after 2 fights or 4 stages (it was 3 fights or 8 stages; runs rarely last 8 stages). The numbers are in `rivalArcs.json`.
- Rivals now win ranks without you: 14 Gym takeovers in 40 runs. Active rivals and nemeses can climb now, not just contenders, at a 30% chance per unseen win (`rivals.json` `promotion`). Finalist and Champion ranks still need a Gym takeover to happen first, so they stay rare in the bot's short runs.
- A few rivals share a class and name with another rival in the same run. That's allowed, but it can read as the same person twice.

## Scenarios

| # | Do this | Expect |
|---|---|---|
| 1 | Beat a trainer with your lead at low HP | A "became your rival" Chronicle line; the Story screen lists them with ★ |
| 2 | Meet that rival again in a later stage | "…is back to beat you!" and a red RIVAL title card |
| 3 | Beat them once more (they become the Ultimate Rival) | Chronicle: "became the rival who defines your journey"; Story screen shows ★★ and the quest chain |
| 4 | Fight the Ultimate Rival again | Orange "★★ ULTIMATE RIVAL ★★" title card and "…, your Ultimate Rival, blocks the way!" |
| 5 | Win 3 times against them (or make them an ally) | "You settled things with…", ₽2500 and 2 Full Restores, once only |
| 6 | Finish the run, start a new one, open Story | "Previous Ultimate Rival: …" row with how it ended |
| 7 | Save mid-run after step 3, reload | The quest steps and ★★ marks are unchanged |
| 8 | Let a rival you skip keep winning (5.5) | It may take over a Gym, Elite Four or Champion fight with its own team |
