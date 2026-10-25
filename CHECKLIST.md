# Implementation checklist

Status of every feature. "Done" means implemented **and** tested (unit tests and/or a browser test).

## Milestone 0 — Baseline ✅

- [x] Vite + TypeScript (strict) + Phaser 3.90 project
- [x] Vitest unit tests, Playwright browser tests
- [x] GitHub Actions CI: type check, unit tests, build, browser tests
- [x] Architecture rule: `src/core` never imports Phaser (enforced by a unit test)
- [x] Asset catalog, manifest generator, import script, placeholders for missing files

## Milestone 1 — Vertical slice ✅

- [x] Main menu: Continue (only with a valid save), New Run, Sound on/off, profile stats, save warnings
- [x] Trainer select: Red / Blue / Green from data, pros and cons shown
- [x] Starter select: 3 distinct, seeded, first-stage species from a 12-species pool
- [x] Wild battles with the Gen 9-style baseline ruleset:
  - [x] damage formula, STAB, type chart (18 types), immunities
  - [x] accuracy and accuracy/evasion stages, critical hits (with crit stages)
  - [x] priority → Speed → seeded tie-break turn order
  - [x] status conditions: burn, poison, paralysis, sleep, freeze (incl. type and powder immunities)
  - [x] stat stage moves, secondary effects (status chance, flinch, stat drops), drain, recoil, fixed damage
  - [x] PP, Struggle when out of PP
  - [x] fainting, victory and defeat
- [x] No running from battles (director decision D3)
- [x] XP (Blue +25%) with level-ups and new moves while a slot is free
- [x] Money for wins (Green +25%)
- [x] Enemy levels from a prototype curve, with Blue +2 / Green −1 and level caps
- [x] Five distinct reward choices, pick exactly one, applied immediately
- [x] Next encounter after each reward
- [x] Save at safe checkpoints (starter pick, every turn, reward pick, run end)
- [x] Continue after refresh resumes exactly; reward screen shows the same five choices
- [x] Damaged saves detected; backed up (never deleted) before starting fresh
- [x] Saves from newer versions refused; migration framework for older ones
- [x] Defeat ends the run; profile statistics updated exactly once
- [x] Debug panel (F2): run state, heal, replace wild Pokémon, seeded new run, asset report

### Known limits in Milestone 1 (by design, documented)

- ~~Party is always one Pokémon~~ (done in Milestone 2).
- ~~New moves skipped when four are known~~ (done in Milestone 2).
- ~~No Bag/battle items~~ (done in Milestone 2).
- Encounters are a straight sequence, not a stage map (Milestone 3).
- Luck and the other nine attributes are stored but have no effect until their formulas are approved.
- Move animations from the supplied pack are not played yet (hit flashes only).
- Prototype learnsets are hand-written and simplified to supported moves; full data import is Milestone 6.
- Damage uses whole-number rounding after each step; the main games use a slightly different rounding, so results can differ by about 1 HP.
- If both Pokémon faint in the same turn (e.g. from recoil), the player wins.

## Milestone 2 — Battle completeness ✅

- [x] Battle menu: Fight / Bag / Pokémon (still no running, D3)
- [x] Bag: Poké / Great / Ultra Balls, Potion, Super Potion, Hyper Potion, Full Heal, Full Restore, Ether, Revive, Last Stand Charm
- [x] Items in battle use the turn; the opponent still moves
- [x] Items outside battle, on the reward screen (Bag button)
- [x] Catching: modern catch formula (HP, catch rate, ball, status), seeded roll, 0–3 shakes shown, Green's 0.85 capture modifier
- [x] Balls can't be thrown at a trainer's Pokémon
- [x] Party of up to 6; party screen with HP, level, status, fainted marker
- [x] Switching uses the turn; after a faint the player must send out another Pokémon (no turn used)
- [x] Caught Pokémon: add to party, or (party full) replace a member with confirmation, or release for candies with confirmation
- [x] Candies saved with the run and added to the profile once at run end (D7)
- [x] Trainer battles with teams of 1–3: intro, sends out the next Pokémon, prize money = class rate × highest level
- [x] Experience shared by every Pokémon that took part and is still standing
- [x] Move learning: choose a move to forget, or skip, with confirmation; never offered twice
- [x] Standard level-up evolution (D15), after battles and Rare Candies; fainted Pokémon don't evolve
- [x] Last Stand Charm: the last healthy Pokémon survives a knockout once at 1 HP; the charm is used up
- [x] Rewards for one Pokémon (vitamins, Rare Candy) ask which party member gets them
- [x] Reward screen: change the lead Pokémon
- [x] Shiny wild Pokémon (1/2000, D8) with shiny sprites and a sparkle
- [x] Party icons, ball icons, trainer battle music, ball sounds from the asset packs
- [x] Save format v2 (run and profile) with automatic upgrade of v1 saves; saves checked for unknown items and trainers
- [x] Debug panel: give items, add a Pokémon to the party

### Known limits in Milestone 2 (by design, documented)

- Trainers appear every 4th encounter as a placeholder; the stage map (M3) will place them.
- Enemy trainers don't use items or switch on purpose; their AI picks a random usable move.
- The party is not healed between battles except by items (healing nodes arrive with the map in M3).
- Stone and trade evolutions are not in yet (Vulpix and Growlithe don't evolve).
- Candies can be earned but not spent yet.
- Levels are capped at 100 for now (see the open question on D14).

## Milestone 3 — One full stage ✅

- [x] Stage themes: all 153 type pairs, each with a name (director's examples kept); theme decides wild Pokémon, trainers and gym leader
- [x] 89 species and 94 moves (every type has wild Pokémon and a trainer class); 70 gym leaders with sprites
- [x] Level-up moves imported from the director's move dataset (`npm run data:movesets`)
- [x] 323 moves imported from the director's move list (`npm run data:moves`); moves needing new battle features are listed for later
- [x] Layered stage map: 20 columns of 1–3 nodes, forks, no crossing paths, exactly 2 trainer columns, gym in column 20
- [x] Map validator (dead ends, unreachable nodes, skipped columns, trainer columns, single gym), checked over hundreds of seeds
- [x] Map screen: theme name and types, level counter, money, badges, scrolling, risk labels on harder routes
- [x] Harder routes: +1–2 enemy levels and better reward odds; gym rewards use the best odds
- [x] Healing spot (once) and shop (buy with run money) beside nodes; a healing spot always before the gym
- [x] Gym leader battle with intro, sprite and badge; then the next stage starts with a new theme and leader
- [x] Battle backgrounds follow the theme (arena art from the asset pack)
- [x] Difficulty model with a full breakdown in the debug panel; debug jump to any column
- [x] Party and Bag usable from the map
- [x] Save format v3 with automatic upgrade of v2 runs; reload resumes on the map

### Known limits in Milestone 3 (by design, documented)

- Shop prices are placeholders, and the shop has a fixed stock.
- The difficulty curve is a straight line tuned for the first gym (about level 20); it needs a per-region curve in M4.
- Gym leaders use the theme's Pokémon rather than their famous teams.
- After the first gym the run continues into more stages, but regions, the Elite Four and the champion come in M4.

## Milestone 4 — One full region + dev campaign ✅

- [x] Regions in data (Kanto to Paldea, Alola, Grand) with their own gym leaders, Elite Four and champions; 51 league sprites from the asset pack
- [x] Shuffled region order per run, each region once, Grand Region last
- [x] 8 stages per region, then the Pokémon League map: Elite Four in a line, then the champion
- [x] Full heal on entering the league and after every Elite Four win; a reward draft after each win (D13)
- [x] Elite Four teams from their speciality type; champions from their speciality or the region's stage themes
- [x] Bosses never repeat in a run across gym leader, Elite Four and champion roles (D6), as long as the data has enough people
- [x] Level cap per region (D14): 50, then 100; experience and level-up rewards stop at the cap
- [x] Difficulty curve per region (first gym ace about 20, first champion 50)
- [x] Region transition after the champion, and a victory screen after the last one
- [x] Developer campaign (2 regions × 2 stages × 5 levels, Elite Four of 2): `?campaign=dev` or the debug panel
- [x] Shop stock unlocks with badges; prices now follow the main games
- [x] Map and battle screens show the region, level cap, league, Elite Four and champion titles and sprites
- [x] Debug panel: region info, jump to the league, start a run in either campaign
- [x] Save format v4 with automatic upgrade of v3 runs

### Known limits in Milestone 4 (by design, documented)

- Levels stop at 100 until D14 (levels above 100) is decided, so regions 3 onward are all level 100.
- A full run needs more gym leaders (80) and Elite Four members (40) than the data has (70 and 38); the last regions reuse people.
- The Grand Region has no roster, final boss or ending yet (M9); it plays like a regular region with borrowed leaders.
- Gym leaders, Elite Four and champions use type- or theme-based teams rather than their famous teams.
- The profile doesn't count wins yet (M5).

## Milestone 5+ — not started

See IMPLEMENTATION_PLAN.md §5.
