# GAME_DESIGN.md — Pokémon Roguelike

**Status:** Approved by the director on 2026-10-25 (open decisions in section 12 still apply).
**Sources:** the project pitch, `Master_Development_Brief.md`, and `DESIGN_DECISIONS.md` (the authoritative spec). Where they disagreed, this document follows `DESIGN_DECISIONS.md` and lists the disagreement in section 12 so you can confirm it.

Items marked **[PROPOSED]** are my suggestions that need your yes/no. Items marked **[OPEN]** have no answer yet and need a decision from you before the related system is built.

---

## 1. The game in one paragraph

A single-player, browser-based Pokémon roguelike. You pick a trainer archetype and one of three random first-stage starters, then travel through branching stage maps fighting wild Pokémon and trainers. After every encounter you draft one of five rewards. Each stage ends with a gym leader; eight stages make a region, followed by the Elite Four and a champion. Nine regular regions in random order lead to a final Grand Region. Losing ends the run but keeps permanent progress (unlocks, bank currency, achievements).

## 2. Run start

1. Create run ID and seed.
2. Load permanent profile.
3. Player picks an unlocked trainer archetype (Red, Blue, Green at first).
4. Shuffle the nine regular regions once; save the order (never reshuffled).
5. Offer three distinct, eligible, first-stage species; player picks one.
6. Party = that starter. Initialize money, inventory, candies, key items, temporary attribute modifiers.
7. Generate stage 1 map. Autosave.

## 3. Trainer archetypes (data-driven)

| Trainer | Upside | Downside | Numbers (tunable config) |
|---|---|---|---|
| Red | none | none | baseline |
| Blue | Faster leveling | Higher-level enemies | +25% XP; enemy level +2 before caps |
| Green | More money; weaker wild/trainer Pokémon | Harder catching | +25% money; enemy level −1 (respecting minimums); capture probability ×0.85 |

Green's "weaker enemies" and "harder catching" are separate rule entries. Archetypes are defined in a data file with: id, name, flavor text, art asset IDs, unlock condition, and a list of modifier entries (e.g. `{ kind: "xpMultiplier", value: 1.25 }`). Code never checks a trainer's name.

**Modifier order [PROPOSED]:** base value → region/stage/route → party-strength correction → archetype → items/buffs → clamp (levels to region caps, probabilities to 0–1).

## 4. Campaign structure

- 9 regular regions, random order, each appears once. Grand Region always last.
- Regular region = 8 stages → Elite Four (4 battles, full heal between) → Champion.
- Stage = exactly 20 numbered levels. Level 20 is the gym leader. Levels 1–19 contain exactly 2 designated trainer battles and 17 other primary encounters (mostly wild).
- Unnumbered optional nodes (shops, healing, trades, events, detours, rare Pokémon) sit beside the main path and don't count toward 20.
- Grand Region **[PROPOSED in spec]**: 8 stages of 20, then a final boss and an ending.
- A developer "short campaign" uses the same rules with tiny numbers (e.g. 2 regions × 2 stages × 4 levels) for testing.

**Built in Milestone 4 (2026-10-25):**
- Each region (Kanto to Paldea, plus Alola) lists its own gym leaders, Elite Four and champions in `regions.json`. A region's stages prefer its own leaders whose speciality fits the stage theme; its league prefers its own Elite Four and champion. Nobody appears twice in a run (D6), across all three roles.
- The league is its own map: one straight line of Elite Four members, then the champion. The party is fully healed on arrival and after every Elite Four win, and each win gives a reward draft (D13).

### 4b. Bosses and their teams (director, 2026-10-25)
- 229 bosses (`bosses.json`): every trainer from the director's boss pack plus the earlier gym leaders, Elite Four and champions. **Any boss can be a gym leader, an Elite Four member or a champion.** Each has a speciality (one or two types, or none for mixed teams), portraits (with optional champion or Elite Four outfits) and a list of signature Pokémon.
- Every boss has **36 teams** (`bossTeams.json`, built by `npm run data:bosses`):
  - **16 gym teams.** Gym team 1–8 are used for the run's first eight stages, 9–16 for the next eight, and team 16 (the hardest) again for every later gym.
  - **10 Elite Four teams**, one per region (the Grand Region is the tenth), harder every region.
  - **10 champion teams**, one per region, always six Pokémon and far harder than the Elite Four.
- Early teams use their Pokémon's latest level-up moves and lower evolutions (Cynthia's first gym has a Gible). Later teams use fully evolved signature Pokémon with strong same-type attacks, coverage moves, TM moves and set-up or status moves.
- Bosses get **training**: extra vitamin-style stat stacks (gym teams 9–16 a few, Elite Four one more per region, champions 4 in region 1 up to 22 in the Grand Region, spread over attack stat, Speed, HP and defences).
- Bosses **choose moves cleverly**: each turn, with chance `ai` (gym 0.15 → 0.7, Elite Four 0.6 → 0.9, champion 0.85 → 1.0) they pick their best move against your Pokémon instead of a random one.
- Legendary and mythical Pokémon only appear in a boss's team if they're in its signature list, and then only for champions from region 5 and Elite Four from region 9.
- Levels still come from the difficulty curve (§4); a team only decides who is in it, their moves and their training. The stage theme picks the gym leader (one whose speciality fits), who brings their own team.
- **Level cap (D14):** 50 in the first region, +50 per region, stopped at 100 for now because levels above 100 aren't decided. Enemy levels climb from the previous cap to just under the new one across the region's 8 stages; the league sits at the top.
- After the champion the next region starts at stage 1. Beating the last champion wins the run.
- The developer campaign is 2 regions × 2 stages × 5 levels with an Elite Four of 2 (`?campaign=dev`, or pick it in the debug panel).
- Shops unlock more stock as you earn badges (`minBadges` in `shop.json`).

**Scale warning:** a full run is 9×8×20 + 160 ≈ **1,600 numbered encounters plus ~100 bosses**. At about one minute each, that is 25–30+ hours per run. See section 12, item D1.

## 5. Stage maps (branching routes)

**[PROPOSED] Layered graph.** Think of the stage as 20 columns. Each column holds 1–3 parallel nodes. Paths only move forward one column at a time, so *every* route from start to gym passes through exactly 20 numbered nodes. That guarantees the "20 levels" rule on every route, not just on average.

- The two trainer battles are placed on two specific columns, and every node in those columns is a trainer battle, so every route meets exactly two trainers.
- Column 20 has a single node: the gym leader.
- Forks show a risk/reward indicator (e.g. "Harder: +1–2 enemy levels, better rewards"). Hidden details stay hidden unless an item reveals them.
- Optional nodes hang off a numbered node as side branches that return to the same column.
- Generator validation: connected, no dead ends, no duplicate IDs, each node records how it was generated (for debugging).

### 5b. Stage themes (director rule, 2026-10-25)

Every stage has a **theme**: a named pair of two types. Examples from the director: **"Stormy Nightmares"** (Electric/Ghost), **"Firey Promises"** (Fire/Psychic), **"Lazy Rivers"** (Water/Normal).

- **Every two-type combination is used:** all 153 pairs of the 18 types (director confirmed "all 153", not only the pairs real Pokémon have). Each has a unique name in `src/data/themes.json`.
- The theme decides **which wild Pokémon appear** (species with either type; species with both types are more common), **which trainers appear** (trainer classes whose speciality matches a theme type, with teams drawn from the theme), and **the gym leader** (a leader whose speciality matches a theme type when one is unused; they bring their own team, §4b).
- The battle background is the arena for the theme's first type.
- Themes and gym leaders don't repeat within a run (D6).

## 6. Battles

Traditional single battles (1v1 active Pokémon), turn-based.

**[PROPOSED] Baseline ruleset: modern (Gen 9-style) mechanics**, simplified where noted:
- Physical/special split; standard damage formula with STAB 1.5×, random factor 0.85–1.00, type chart (18 types).
- Critical hits: 1/24 base chance, 1.5× damage.
- Order: move priority first, then Speed, then a seeded coin flip for ties.
- Accuracy check per move.
- Statuses: burn, poison, bad poison, paralysis, sleep, freeze (main); confusion later.
- Abilities and held items: off in the first milestones, added later through data.
- Battle stats: the standard stat formula from base stats and level. **[PROPOSED]** No IVs/EVs/natures at first (keeps it readable); could be added later.

Battle actions: Fight, Bag, Pokémon (switch). No Run option (D3).

## 7. Capture

**[PROPOSED]** Use the standard modern catch formula: a catch value from species catch rate, current/max HP, ball multiplier, and status multiplier, converted to a probability. Then apply Green's ×0.85 and other modifiers, and clamp to 0–1. One random roll decides success (simpler and easier to test than the four "shake" checks; the shakes can still be shown as animation).

Successful capture:
- Party < 6: offer to add it.
- Party = 6: choose a party member to replace (shown by name, with confirmation) **or** convert the new Pokémon into candies (confirmed). Never silent.

## 8. Rewards (the five-choice draft)

After every completed encounter, show five *different* rewards; pick exactly one.
- Each reward entry has: id, category, rarity tier, effect, stacking rule, duration, scope, restrictions.
- Rarity tiers **[PROPOSED]**: Common, Uncommon, Rare, Epic, Legendary, each with a base weight.
- Bosses improve the weights (gym < Elite Four < champion < final boss).
- Luck shifts weight from lower to higher tiers by a capped formula (exact formula is an open item; luck never guarantees rare).
- Too few valid rewards → configuration error, never duplicates.

## 9. Ten attributes

Strength, Intelligence, Speed, Charisma, Luck, Rage, Peace, Good, Evil, Love.
Each has permanent value + run modifier → effective value, clamped to 0–100 (provisional).

**[PROPOSED] for the prototype:** attributes are stored and displayed, but have **no gameplay effect** until you approve exact formulas for each. This follows the spec's rule against invented effects. Luck is the first one to define, because rewards depend on it.

## 10. Items, shops, economy

- Run money (temporary) vs bank currency (permanent). Always shown separately.
- Shops sell from data-defined stock with prices from data; better items unlock with badges (Great Ball at 2, Ultra Ball at 5, Full Restore at 7). Charisma/archetype price effects come later.
- **Last Stand Charm:** rare, single-use. When your last usable Pokémon would faint (run-ending loss), it's consumed, that Pokémon stays at 1 HP, a message is shown, and the battle continues. Once per battle.

## 11. Permanent progression and saving

- Separate save records: profile, active run, settings, metadata. Each has a schema version and migrations.
- Autosave at safe points: after starter pick, after each reward pick, on entering a map node.
- Run ends in defeat: apply Charm if any → compute permanent rewards → write profile → then clear the run. Each run end has a transaction ID so a refresh can't pay out twice.
- Export/import save as a file. Local browser storage only for now.

## 12. Contradictions and open decisions

### Contradictions found (with my proposed resolution)

| # | Conflict | Proposed resolution |
|---|---|---|
| C1 | Brief says "implement Milestone 1 now"; spec says "don't code until approved". | Follow the spec. Plans only until you approve. |
| C2 | Original pitch says Green's *con* is "fight slightly weaker Pokémon", the same as her pro. | Treat it as a typo. Weaker enemies = pro; harder catching = con. |
| C3 | Pitch: "randomly generated number of stages (usually eight)" and "repeat about nine times". Spec: exactly 8 stages and exactly 9 regions. | Use the spec's exact numbers. |
| C4 | Pitch reads as 20 levels *plus* a gym battle; spec makes the gym the 20th level. | Gym = level 20. |
| C5 | "Exactly two trainer battles per stage" vs branching routes (a route could skip a trainer). | Layered map (section 5): both trainers sit on columns every route crosses. |
| C6 | Pitch: reward pick "before moving to the next stage"; brief/spec: after *every encounter*. | After every encounter. |
| C7 | Spec's party-strength correction raises enemy levels as your party gets stronger, which cancels out Blue's main benefit (faster leveling) and partly Green's (weaker enemies). | Apply archetype modifiers after the correction, and cap how much the correction can add. |
| C8 | The Last Stand Charm triggers on "run-ending defeat", but the spec never says whether *every* battle loss ends the run. | Any loss where all party Pokémon faint ends the run. |

### Decisions needed from you

**Needed before Milestone 1**
- **D0 Repository.** Decided: `AwsomSause/pkmn` (switch to private before assets go in).
- **D2 Battle ruleset.** Decided (2026-10-25): modern Gen 9-style, no IVs/EVs/natures for now.
- **D3 Fleeing.** Decided (2026-10-25): **no running** from any battle.
- **D4 Asset licensing and hosting.** Decided (2026-10-25): keep private, no public deploy.
- **D5 Starter pool for the prototype.** Decided (2026-10-25): ~12 hand-picked Gen 1 first-stage Pokémon for now.

**Needed before later milestones**
- **D1 Campaign length.** Decided (2026-10-25): keep the full length (9 regions × 8 stages × 20 levels, plus the Grand Region).
- **D6 Regions.** Decided (2026-10-25): the regions are a mix of the original regions and custom regions. Every gym leader, Elite Four member and champion is chosen at random, and none repeats within one run. *(Still open: the list of custom regions, and what the Grand Region contains.)*
- **D7 Candies.** Decided (2026-10-25): candies are a permanent currency spent outside a run (unlocking trainers, starting buffs, etc.). Candies earned in a run are added to the profile when the run ends.
- **D8 Shiny odds.** Decided (2026-10-25): 1/2000 per wild Pokémon. *(Still open: the luck formula and how much a shiny adds to Luck.)*
- **D9 Attribute meters.** Decided (2026-10-25): Rage/Peace and Good/Evil are each one meter with two ends. *(Still open: exact formulas for each attribute's effects.)*
- **D10 Permanent attributes.** Decided (2026-10-25): earned through actions such as catching Pokémon of certain types, battling, healing and Pokémon interactions. *(Exact action → attribute amounts to be proposed in Milestone 7.)*
- **D11 Bank.** Decided (2026-10-25): works like candies in the long run, as a permanent currency for out-of-run purchases. *(Deposit rules and fees to be proposed in Milestone 5.)*
- **D12 Trainer unlocks.** Decided (2026-10-25): future trainers include Gold, Silver, Crystal, Brendan, May, Wally, Dawn, Lucas, Barry, Looker and more. *(Unlock conditions and pros/cons to be proposed in Milestone 5.)*
- **D13 Elite Four rewards.** Decided (2026-10-25): a reward draft after each Elite Four member.
- **D14 Level caps.** Decided (2026-10-25): each region raises the level cap by 50. *(Question for the director: that passes level 100 in region 3. Should levels go above 100, as in PokeRogue? To confirm before Milestone 4.)*
- **D15 Evolution.** Decided (2026-10-25): standard level-up evolution.

## 13. Assets: what you supplied

All assets appear to come from **PokeRogue** (Pagefault Games). The audio pack includes PokeRogue's `REUSE.toml`, which marks the project **AGPL-3.0** and states that many files are sourced from Nintendo/Game Freak/Creatures (cries, music, sprites via Pokémon Showdown).

What that means in plain language:
- It's fine for building and playing privately.
- Hosting it publicly means using Nintendo-owned material, and PokeRogue's AGPL license may require the game's code to be released under AGPL too.
- **Recommendation:** keep the repo private and don't publish a public build until you've decided how you want to handle this. The code will load assets only through a manifest, so the art can be swapped later without touching gameplay.

| Pack | Size | Contents (counted, not guessed) |
|---|---|---|
| images.zip | 99 MB zipped / ~261 MB unzipped, 57,068 entries (about half are macOS `__MACOSX` junk) | `pokemon/` 24k files: front sprites as `ID.png` + `ID.json` atlas (e.g. `1.json`), plus `back/`, `shiny/`, `variant/`, `female/`, `exp/` (animated), `icons/1–9/`. `trainer/` 620 (includes `red`, `blue`, `player_m/f`, `rival_m/f`, **no `green`**). `items/` 535 + `items.json` atlas. `arenas/` 202 (39 `*_bg.png` battle backgrounds). `ui/` 1,765 (windows, HP/EXP bars, party slots, cursors, type badges). `pokeball/` 18. `battle_anims/` 653 effect sheets. Localized type sheets. |
| audio.zip | 424 MB zipped, 5,490 entries | `bgm/` 181 (incl. `title.mp3`, `menu.mp3`, `battle_wild.mp3`, `town.mp3`, gym/elite/champion tracks), `cry/` 1,201 (`.m4a` by dex number), `se/` 40 (hit, faint, level_up, pb_throw, pb_catch, buy, save…), `ui/` 4 (select, menu_open, error…), `battle_anims/` 1,317 sound effects. |
| battle-anims.zip | 1.9 MB, 929 `.json` files | Per-move animation data (e.g. `tackle.json`, frame lists referencing graphics like `PRAS- Strike`). Needs a custom player; planned for a later milestone. |
| fonts.zip | 1.8 MB | `pokemon-emerald-pro.ttf`, `pkmnems.ttf`, `rogue-thai.ttf`, `terrible-thaifix.ttf`, `8-bit-devanagari.ttf`, `item-count.png/.xml` (bitmap font). |

**Not supplied (needed):**
- **Game data.** Species stats, types, moves, learnsets, catch rates, evolutions. These packs are art and sound only. **[PROPOSED]** Generate our own JSON from an open dataset (Pokémon Showdown's data is MIT-licensed) with an import script; M1 uses a small hand-checked subset.
- A **Green** trainer sprite. *(Proposed: placeholder, or `player_f` as a stand-in, your call.)*

Sprites are small pixel art (Bulbasaur's frames are ~37×38), so the game will render at a low internal resolution and scale up crisply.
