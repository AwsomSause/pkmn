# Living Rival (APPROVED §2, §6 Rival Clash/Gauntlet, §7 rival assist)

Built on rival progression (#379). No save bump: every new field is optional (`battle.finaleAssist`) or a story flag.

- **Relationship path** (`core/rivals/living.ts`): events write `rival-friend` / `rival-heat` flags; allies, nemeses and contenders add points. `rivalPath` = friend / rival / between (margin 2). Neither is "correct"; both unlock their own events. New event conditions `rivalPath`, `rivalBeaten`; new effect `moment` (writes a Chronicle/journal line: photos, promises, rescues).
- **Events** (`tools/events/livingRival.ts`, 14): Rescue the Rival + The Favour Returned, A Rival's Bad Day (support / tease / leave), Photo Opportunity (friend / rival / undecided tones), Training Montage (watch or spar), Promised Rematch + The Promise Kept, They Say It Out Loud / Grudging Respect (public acknowledgement), Rival Clash (recorded Hall of Fame team or a past run's team, shown as a recording; nobody is online), Between Rivals (rest / train / scout between gauntlet fights). Event trainer battles can now use the rival's own latest roster and name (`rival: true`).
- **Hub**: a letter from a rival of a finished run (tone follows how it ended) or, every third visit, the rival drops in and comments on trophies and run count (`hubRivalNote`).
- **Final boss assist**: a friend (state ally), or a rescued rival on a non-rival path, arrives in the final boss. Rule: 3 strikes at the end of turns, 5% of boss max HP each (type chart, cap x1.5), never lethal; you still finish the boss. A rival path keeps them away.
- **Rivalry Week** now features the Clash and Gauntlet entry stops.
- Already built before this slice: persistent/adaptive rival, learning from defeats, team evolution, grudges, promotion, Rival Gauntlet chain, Rival Tournament.
- Limited: Clash uses local records only (no online play); Rival Plaza visits (§11) are not part of this slice; letters/visits are Hub text, not a screen.
