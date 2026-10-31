# Whole-Game Events G2: Deep Dives, High Priority (22 entries)

Same schema as `game-events-g-deep-dives-essential.md` (Concept, Rules, Data, Presentation, Edge cases, Tests, Build order). Numbers are tuning starting points. All state lives in `profile.world`; outcomes derive from saved history plus seeds.

---

## GWE-A01 The Rebuilt Bridge
**Concept.** A bridge in one region is rebuilt over several runs and finally opens a shortcut.
**Rules.** Build step 0 to 5, +1 per finished run in that region (not on a wipe). At step 5 the region graph gains a branch that skips one non-boss stop and removes one shop on that branch. A foreman letter arrives each step.
**Data.** `world.builds['bridge:<region>'] = step`.
**Presentation.** Bridge art has five states; a Machop crew on step 3+.
**Edge cases.** Branch never bypasses a boss or the last shop before it; map generator keeps at least two routes.
**Tests.** Step increments only on finish, branch validity over many seeds.
**Build order.** Variant flag in map gen, art states, letters.

## GWE-A10 A New Region on the Horizon
**Concept.** After every region is cleared, fog slowly lifts from a silhouette; a new region unlocks.
**Rules.** +1 fog progress per finished run (max 12), +2 on Champion wins. At 12 the region unlocks with the +50-level-per-region curve (levels-and-regions plan). Content gate decides what exists; until content ships, the horizon is a teaser with Hub hints.
**Data.** `world.horizon = {progress, unlocked}`.
**Presentation.** World map fog shader thins; a lighthouse beam points at it.
**Edge cases.** Region content incomplete: show "coming soon" rather than unlock.
**Tests.** Progress math, gate behaviour.
**Build order.** Teaser first; region content is a separate project.

## GWE-A21 The Library Opens
**Concept.** A Hub library with lore bundles that grant small permanent hints.
**Rules.** Opens at 100 Pokédex entries. Lore bundles unlock by Pokédex milestone (every 25 entries). Each bundle gives one hint line (e.g. "Gym 3 leans on Bug"). Hints never show exact moves.
**Data.** `world.library.read[bundleId]`.
**Presentation.** Quiet music, page-turn sounds, books by region.
**Edge cases.** Hints must match actual data; content gate checks hints reference real bosses.
**Tests.** Hint-to-data validation, milestone unlocks.
**Build order.** Data and scene, then hint wiring.

## GWE-A27 Haunted Mansion Wing
**Concept.** Every slain nemesis gets a trophy room with a quiz.
**Rules.** One wing per slain nemesis. Quiz of 3 questions generated from the nemesis record (archetype, cause, final blow). 3/3 correct gives a small reward (a held item), 2/3 a smaller one; wrong answers carry no penalty. Rewards once per nemesis.
**Data.** `world.mansion[nemesisId] = {quizDone}`.
**Presentation.** Candlelit corridor, portraits, a butler NPC.
**Edge cases.** Nemesis record missing fields: skip those questions.
**Tests.** Question generation determinism, reward-once.
**Build order.** Derive from `story.nemeses` history, scene, quiz.

## GWE-B11 Rival Rewrites the Bracket
**Concept.** The rival starts cheating because of a faction debt; helping them pays back later.
**Rules.** Needs rival rank 3+ and an open debt record. Three beats across runs: you spot odd results, you confront them, you choose to help repay the debt (cost gold), report them, or ignore. Help: rival loyalty +2 and a gift at the next rivalry week. Report: the rival is humbled (team -1 level for 3 runs) and angry. Ignore: the debt escalates once, then forces a clash.
**Data.** Chain `rival-bracket` with choice flag.
**Presentation.** Rival's dialogue shifts tone; Hub letters.
**Edge cases.** Rival absent from region pool: chain waits.
**Tests.** Each branch reaches a resolution; no dead end.
**Build order.** Uses chain engine and `rivalWorld.json` debts.

## GWE-B13 Succession Crisis
**Concept.** The Champion retires and four past rivals compete.
**Rules.** Trigger: 10 Hall of Fame entries. A season lasts 8 runs; each run advances the bracket one round. You may back a candidate (choice at start). Outcomes: winner becomes the Champion boss for a while, with team drawn from their rival record. Backing the winner yields a favour (one free revive per run for 10 runs).
**Data.** `world.succession = {candidates[], round, backed, winner}`.
**Presentation.** Campaign posters; a debate scene.
**Edge cases.** Fewer than 4 rivals met: fill with NPC rivals.
**Tests.** Bracket determinism, favour expiry.
**Build order.** Bracket sim first, then boss swap.

## GWE-B18 Cold Case
**Concept.** A nemesis who slipped away returns reformed and asks to join.
**Rules.** Needs a nemesis that fled 3 times. Offer at the Hub: accept to recruit them as a normal party member (level equal to your average, archetype tag Redeemed with a unique line set), or refuse and they leave for good. Recruit cannot be your Ace.
**Data.** `world.redeemed[nemesisId] = state`.
**Presentation.** A rain-soaked Hub scene.
**Edge cases.** Party full: offer a swap.
**Tests.** Recruit once, refusal permanence.
**Build order.** After nemesis hooks.

## GWE-B32 The Apprentice
**Concept.** A kid learns from you; their team reflects your style.
**Rules.** Unlocks at 25 runs. Each run end, one lesson (3 choices tied to playstyle). After 8 lessons the apprentice becomes a trainer on the map; their team follows your lesson choices and most-used types. They fight you once as a friendly challenge with a reward.
**Data.** `world.apprentice = {lessons[], teamSeed}`.
**Presentation.** Kid sprite in the Hub, notebook.
**Edge cases.** Style data thin: default balanced team.
**Tests.** Team build deterministic from lessons.
**Build order.** Lessons then trainer.

## GWE-C04 A Book About You
**Concept.** An unauthorised biography built from your Chronicle.
**Rules.** Unlocks at 50 runs. Chapters are templates filled by Chronicle facts, each with one deliberate error. Fixing one error by choosing the right fact gives a small reward (once per chapter).
**Data.** `world.book.fixed[chapter]`.
**Presentation.** Bookstore window, a page-flip reader.
**Edge cases.** Not enough facts: fewer chapters.
**Tests.** Template filling, error injection stable per seed.
**Build order.** Templates, reader.

## GWE-C13 The Rematch Day
**Concept.** A boss that beat you thrice invites a friendly rematch.
**Rules.** Needs 3 losses to the same boss. Letter appears; the rematch uses their weakest team (bottom half of species by BST). Win: gift item. The invitation expires after 3 runs.
**Data.** `world.rematches[bossId] = {expires, claimed}`.
**Presentation.** Sportsmanlike music.
**Edge cases.** Boss not in current campaign: skip.
**Tests.** Expiry, claim-once.
**Build order.** Loss tally, letter, battle.

## GWE-C22 The Reunion Dinner
**Concept.** Retired Pokémon meet at a yearly dinner; seating shapes friendships.
**Rules.** Needs 3 retired teams. Annual on the profile anniversary. 6 seating choices; each pair adjacency adds or removes friendship points among retired Pokémon (cosmetic) and unlocks banter lines. Present retired members give a gift if their friendship total is high.
**Data.** `world.reunion.year = seating`.
**Presentation.** Dinner table scene.
**Edge cases.** No retired: skipped.
**Tests.** Seating determinism, gift cap.
**Build order.** Scene, banter hooks.

## GWE-C23 Old Rival Returns After Years
**Concept.** After 60 real days without a meeting, the rival returns changed.
**Rules.** Their attitude resolves from last relationship state: warm, cold, humbled, or obsessive. Team grows by days away (+1 level per 10 days, cap +10).
**Data.** `world.rivalReturn = {lastSeen, state}`.
**Presentation.** A weathered rival sprite.
**Edge cases.** Clock tampering: lastSeen only moves forward.
**Tests.** State resolution, cap.
**Build order.** After rival world hooks.

## GWE-C26 Nemesis Museum
**Concept.** A museum wing for slain nemeses.
**Rules.** Opens at 5 slain. Each exhibit shows the fight timeline; a quiz mirrors A27 but for museum credit; credit buys cosmetics.
**Data.** Shared with A27.
**Presentation.** Glass cases.
**Edge cases.** None.
**Tests.** Credit math.
**Build order.** After A27.

## GWE-C33 The Long Absence
**Concept.** A warm welcome back after 60 days away.
**Rules.** Dust on the Hub, NPCs greet you, a Return Pack (potions, a free reroll, a cosmetic). No shame text, no streak loss.
**Data.** `world.lastSeen`.
**Presentation.** Dust and cobwebs fade as you tidy.
**Edge cases.** Repeated absences: pack once per 60 days.
**Tests.** Pack timing.
**Build order.** Small.

## GWE-D01 Great Butterfree Migration
**Concept.** A yearly drift of Butterfree across the map.
**Rules.** One autumn week (date). Walking through without fighting earns petal items (cap 3). Fighting many lowers next year's size (stored count).
**Data.** `world.migrations.butterfree = {year, left}`.
**Presentation.** Cloud of wings.
**Edge cases.** Date seeding cached.
**Tests.** Cap and next-year size.
**Build order.** Small.

## GWE-D17 Legend Council
**Concept.** Every 100 runs the legends hold a council that nudges boss rosters.
**Rules.** Votes are weighted by what you caught and spared; the leading legend sets one boss slot's theme for 20 runs.
**Data.** `world.council = {runCount, votes}`.
**Presentation.** Silhouettes around a fire.
**Edge cases.** Ties: stable order.
**Tests.** Vote math.
**Build order.** After roaming legends.

## GWE-E01 Front Lines
**Concept.** Two factions fight over regions on the world map.
**Rules.** Each of 5 regions holds a control value -3 to +3 between factions X and Y. Your wins against a faction's trainers shift it by 1. At +3 a region flips and shops stock that faction's goods.
**Data.** `world.factionMap[region] = value`.
**Presentation.** World map banners.
**Edge cases.** Always at least one neutral shop.
**Tests.** Shift rules.
**Build order.** Data, map overlay, shop hook.

## GWE-E02 Coup at the League
**Concept.** A faction seizes the League for a month.
**Rules.** Triggers when a faction is at +3 in 3 regions. League roster swaps to that faction for 20 runs; defence battles (3 wins) lift it.
**Data.** `world.coup`.
**Presentation.** Banners on the League gate.
**Edge cases.** No softlock: Champion remains reachable.
**Tests.** Duration, lift.
**Build order.** After E01.

## GWE-E06 Peace Treaty Summit
**Concept.** Enemy factions meet; your choices decide the outcome.
**Rules.** Needs a long conflict (E01 flips 4+). Three mediation choices shape the treaty; outcomes grant perks for 20 runs.
**Data.** `world.treaty`.
**Presentation.** A round table.
**Edge cases.** None.
**Tests.** Outcome table.
**Build order.** After E01.

## GWE-E16 World Cup of Types
**Concept.** Types act as national teams.
**Rules.** Every four years (date), points from your runs by type; the leading type's fans give a cosmetic.
**Data.** `world.cup.year = tallies`.
**Presentation.** Flags and chants.
**Edge cases.** Leap handling cached.
**Tests.** Tally math.
**Build order.** Small.

## GWE-F16 Time Capsule
**Concept.** A letter from your past self returns years later.
**Rules.** At profile creation, optional capsule; opens after 365 real days. Letter text stored locally only.
**Data.** `world.capsule = {text, opensAt}`.
**Presentation.** A buried chest.
**Edge cases.** Clock changes handled by only moving forward.
**Tests.** Open timing.
**Build order.** Small.

## GWE-F18 Night of a Thousand Lanterns
**Concept.** Yearly lantern release; a wish picks a modifier.
**Rules.** On one night, pick from three modifiers for your next run (curated pool, no run-breakers).
**Data.** `world.lanterns.year = wish`.
**Presentation.** Floating lanterns.
**Edge cases.** One wish per year.
**Tests.** Pool validity.
**Build order.** Small.
