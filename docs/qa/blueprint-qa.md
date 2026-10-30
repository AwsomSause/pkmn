# Blueprint manual QA checklist

Run by Claude in a browser (Playwright, `tests/e2e/blueprint-qa.spec.ts`) on 2026-10-30. Screenshots at 1280×720, 960×540 and 640×360 are written to `test-results/qa/` on every run; three are kept here (`docs/qa/`).
"Auto" means a test checks it on every run; "Seen" means I looked at the screenshot.

| # | Check | Result |
|---|---|---|
| 1 | Map shows Raid, Totem, Expedition and Minigame stops with their own buttons at all three sizes | Seen, Auto. Fixed: "Expedition" and "Minigame" overflowed their buttons (now a smaller font). |
| 2 | Raid den preview lists mechanics, rewards and the entry cost, and warns when you cannot pay | Seen (Midnight Haunt, "You need ₽200 to enter"). |
| 3 | Raid fight uses the Raid Battles arena and music, with a status line (shield, phases, charged attack) | Seen (arena visible; music not heard, only wired). Fixed: the status line overlapped big boss sprites, so it now sits under the enemy's box. |
| 4 | Totem fight uses its own arena | Seen (Totem Marowak, its own arena, status line with aura and ally calls), Auto. |
| 5 | Expedition route screen, choices, extract, finale | Seen (route screen at 960×540), Auto (all 8 expeditions played to the end, won and lost) and `expeditions.spec.ts`. |
| 6 | Minigame screen: HUD, prompt, grid of choices, keyboard and mouse | Seen at all sizes. Fixed: plain background (now the Aero backdrop) and small text. |
| 7 | Biggest minigame grid (Memory, Hard, 22 tiles) fits at 960×540 and 640×360 | Seen. |
| 8 | Minigame result shows score, medal art, money, item and bonus | Seen (no-medal result). |
| 9 | Leaving a minigame mid-game forfeits the attempt and returns to the map | Auto (unit and e2e). |
| 10 | Reload during a raid, expedition or minigame keeps the state, and rewards are not paid twice | Auto (unit and e2e). |
| 11 | No console errors on any of the above | Auto (the spec fails on any). |
| 12 | Existing stages, shops, gyms, Elite Four, champions and events still work | Auto: the full unit suite (985+ tests) and the existing e2e specs. |

## Known limits
- Minigame screens use shared menu art and the Aero backdrop; there is no per-game art.
- Balance is checked at the data level and with random-player minigame runs (`docs/plans/balance-report.md`), not with full battle simulations.
