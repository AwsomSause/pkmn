# Rival QA scenarios

Hand checks for the rival system (Rivalry Engine phase 13). Run `npm run report:rivals` first: it must say `Contradictions | 0`.
Numbers come from `docs/quality/RIVAL_REPORT.md` (40 seeds).

## What the report shows (2026-10-31)

- Every run makes rivals (about 3 each) and fights about 3 rematches.
- 80% of runs name an Ultimate Rival and 30% finish its quest.
- **Arcs almost never end** (2 of 115 rivals). Most rivals are still open when the run ends. This is worth tuning next.
- **No rival won a rank without you** (Gym Leader, finalist, Champion) in 40 seeds. The bot's runs end before a rival's world progress reaches 3. Tune `rivals.json` `promotion` if it should happen more.
- 8 rivals shared a class and name with another rival in the same run. That's allowed, but it can read as the same person twice.

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
