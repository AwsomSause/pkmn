# Whole-Game Events G1: Deep Dives, Essential Priority (11 entries)

Long versions of the Essential entries from `game-events-00-index.md`. Each has: Concept, Rules (with numbers to tune), Data (new saved fields, versioned and Zod-validated), Presentation, Edge cases, Tests, Build order. All outcomes derive from saved history plus the run seed, never from animation or gameplay RNG. Numbers are starting points for balance, not decisions.

---

## GWE-C01 Statue in the Square
**Concept.** The first Champion win raises a statue of your Ace in a town square. The statue is a living scoreboard of your relationship with the world: wreaths for wins, a crack for a defeat with that Ace, ivy if you stay away.
**Rules.** Statue subject = the Ace recorded in the Legacy run record (`legacyRuns[0].ace`). One statue per profile at first; later Champion wins with a different Ace add a second plinth (max 6). Wreath tier = wins with that species line: 1 / 5 / 15 / 40 (bronze, silver, gold, flower-gold). A wipe with that Ace as lead sets `cracked: true`; the next Champion win repairs it and adds a "mended" gold seam (permanent cosmetic). No gameplay effect except one line of NPC dialogue per visit and a once-per-run "Salute" (+1 friendship to the Ace).
**Data.** `world.statues[] = {species, form, runId, wreath, cracked, mendedCount}`. Derived from `legacyRuns`; rebuilt if missing, so a lost world record never loses statues.
**Presentation.** Hub map adds a Town Square screen; statue is the Ace's sprite rendered as stone (greyscale plus noise shader, or a pre-tinted copy). Wreath and crack are overlay sprites. Pigeons land on it.
**Edge cases.** Ace changes species by evolution mid-run (use the final form). Shiny Ace gets a gold-tinted statue. Retired or released Pokémon still count. Imported saves rebuild from Legacy.
**Tests.** Pure function `statuesFromLegacy(legacyRuns)` unit tests (empty, one, many, wipe, repair). Save round-trip. A Playwright screenshot of the square with crack and wreath.
**Build order.** 1 pure derivation, 2 square scene with static statue, 3 wreath and crack states, 4 dialogue and Salute.

## GWE-C11 The Graveyard Garden
**Concept.** A quiet garden in the Hub with one headstone per wiped run. It turns losses into a keepsake and a tiny comfort mechanic, not a punishment.
**Rules.** Unlocks at 10 wipes (`legacyRuns` with outcome loss). Each stone shows: the team's sprites in a row, the last line they said (from the narrative-defeat text), the killer (boss or nemesis name). Visiting once per run grants "Comforted": +1 morale on the team's first battle (no stats), ends after that battle. Planting a flower on a stone (free) changes its look; planting on the stone of a Pokémon now alive in your party adds a tiny "remembered" memory.
**Data.** Pure derivation from Legacy; `world.garden.flowers[stoneId] = flowerKind`.
**Presentation.** Soft music, falling petals, stones grouped by region. Tapping a stone opens a small card with the run's date and rival.
**Edge cases.** Hundreds of wipes: paginate by region and show the most recent 30 as full cards. Abandoned runs are not wipes. Players who dislike the theme can hide the garden in settings.
**Tests.** Derivation, pagination, Comforted expiry (end of first battle, not saved past a reload twice), settings hide switch.
**Build order.** 1 derivation, 2 scene, 3 Comforted buff via the existing morale hook, 4 flowers.

## GWE-C19 Ghost of a Past Team
**Concept.** A frozen Legacy team returns as an optional boss on its own seed, fighting exactly as it did.
**Rules.** Eligible: Legacy runs that are Champion wins or famous (3+ rivals met, or a shiny). The player picks "Challenge the Ghost" on the Legacy Gallery card. The ghost team uses the stored team, moves, items and nicknames, scaled to the player's current level band so it is a fair fight (floor = ghost's old level). AI uses the standard trainer AI with that team's moves. Win: cosmetic "Haunted by Greatness", a keepsake, and the ghost's Ace joins the Garden as a flower. Lose: nothing lost.
**Data.** None new for the ghost (read-only Legacy record); `world.ghostsBeaten[runId] = bestScore`.
**Presentation.** Ghost sprites are translucent with a trailing afterimage; intro line is the team's own last words. Battle music: rival theme in a minor key.
**Edge cases.** Legacy record references a move or species since removed: skip it with a replacement Struggle-equivalent and log a content-gate warning. Replays (False Protagonist) and ghosts must never write the profile twice for the same reward.
**Tests.** Team reconstruction from a fixture record, level scaling bounds, missing-content fallback, reward-once guard.
**Build order.** 1 reconstruct team from record, 2 gallery button and battle launch, 3 rewards, 4 presentation polish.

## GWE-C21 Descendants
**Concept.** A Pokémon that has served many runs retires and leaves an egg inheriting part of its character.
**Rules.** Trigger: a Pokémon appears in 5+ finished runs, then retires to the Hall of Fame. Egg inherits: one move from its egg-move or last-used list, its nature as a 50% tilt (child gets same nature or a neighbour on the nature wheel), and a short "Parent's Note" (e.g. "Always went first"). Species is the parent's base form. One Descendant egg per parent, ever. Hatch needs normal egg steps or runs.
**Data.** `world.descendants[parentId] = {eggId, note, hatched}`; the egg uses the existing egg system with an `inheritedFrom` field.
**Presentation.** A farewell scene in the Hub; the egg sits in a nest next to the parent's flower in the Garden.
**Edge cases.** Parent with no base form egg (legendaries): no egg, a keepsake instead. Duplicates after profile import: guarded by `parentId`.
**Tests.** Nature tilt determinism with a fixed seed stream, one-egg guard, hatch inherits move and note.
**Build order.** 1 inheritance function, 2 farewell scene, 3 egg hookup, 4 note display in the summary.

## GWE-A15 The Wall of Names
**Concept.** A town wall where every Hall of Fame team is carved, with a short message from your past self.
**Rules.** One panel per Hall of Fame entry in order. Each panel lists six names in carved style. On visiting, Pokémon you currently own whisper a line (reuse dialogue barks). Once per profile per 10 panels you may write a 40-character message; it is shown again at a later run start ("Past you said: ...").
**Data.** `world.wall.messages[panelId] = text` (sanitised, max 40 chars).
**Presentation.** Stone texture, moss over old panels, a chisel sound when a new panel appears after a win.
**Edge cases.** Offensive text: client-side only, never shared. Long histories: scroll with a minimap.
**Tests.** Message length and sanitising, panel order, reminder scheduling.
**Build order.** 1 panels from Hall of Fame, 2 scene, 3 messages and reminder.

## GWE-A36 Garden of Remembered Pokémon
**Concept.** A Hub garden where retired Pokémon are remembered as flowers and ghost sprites wander.
**Rules.** One flower per retired Pokémon, colour from primary type, size from runs served. Ghost sprites (0 to 3 at once, chosen by retired age) walk slowly; tapping one plays its cry and shows its Legacy card. Visiting once per run: +1 friendship to a random party member that is a descendant of a remembered Pokémon.
**Data.** Derivation from Hall of Fame plus `world.garden` shared with the Graveyard Garden (C11); merge both as two sections of one scene.
**Presentation.** Daylight cycle follows the real clock (cached once per session).
**Edge cases.** Hundreds of retirees: show newest 60 flowers, rest as a meadow texture.
**Tests.** Derivation, ghost selection stable per session, friendship once-per-run.
**Build order.** Shares the scene with C11.

## GWE-B01 The Lost Researcher
**Concept.** A five-stage mystery that ends with the researcher stuck in a loop made of your own runs.
**Rules.** Stage advances only when a run finishes. S1 note found at a ruin (2% chance per ruin stop after run 10, pity counter raises it 1% per ruin). S2 camp stop appears on a later run in the same region (guaranteed). S3 a Pokémon waits at a Centre; talking opens a choice (comfort or ignore, both advance). S4 lab stop in the region's third gym slot; contains a puzzle of three terminals (pick any order). S5 a boss-style scene: she remembers each of your last 5 runs by their Ace. Reward: time-themed ally (an existing species with a time move set) and the title "Loop Breaker".
**Data.** `world.chains['lost-researcher'] = {stage, flags: {choice}}`.
**Presentation.** Notes in handwriting font, a cork board in the Hub showing clues.
**Edge cases.** Player skips the region for weeks: chain waits; the Hub board hints which region.
**Tests.** Stage advance only on finish, pity counter, choice branch both reach S5.
**Build order.** Chain engine first (shared by B-series), then content.

## GWE-B28 The Tower of Names
**Concept.** A tower where each floor is a closure battle for a Pokémon you lost.
**Rules.** One floor per lost Pokémon (fainted-in-defeat, up to 30). The floor fight is against a "memory" of the enemy that felled it, at the level it fell. Winning gives a keepsake and sets that Pokémon's memory to "Closure". Top floor: a choice to leave all keepsakes at the top for a permanent +1 starting friendship to all future starters.
**Data.** `world.tower = {floorsCleared[], topChoice}`.
**Presentation.** Stairs ascend through sepia scenes; fading names.
**Edge cases.** Lost Pokémon with a nemesis: floor boss is the nemesis. Opt-out: tower can be hidden.
**Tests.** Floor generation from history, deterministic opponents, once-only rewards.
**Build order.** 1 floor generator, 2 scene, 3 rewards and top choice.

## GWE-D11 Roaming Legend Calendar
**Concept.** A different legend roams each month; clues and weather hint at it, and each sighting nudges your catch odds.
**Rules.** Month-to-legend table (12 legends) in data. Footprint stops appear with 15% chance per stop; each footprint adds +1 Sighting (max 5). Encounter chance per run = 5% + 10% per Sighting; ball bonus +4% per Sighting (cap 20%). Sightings reset monthly unless caught. Legends caught get a "Roaming Record" entry.
**Data.** `world.roaming[monthKey] = {legendId, sightings, caught}`; month key from cached date.
**Presentation.** Map shows a glint; Hub radio mentions the legend.
**Edge cases.** Offline clock changes: month key stored once per session; going backwards cannot re-roll.
**Tests.** Table coverage, odds cap, monthly reset, clock rollback.
**Build order.** 1 data and odds, 2 footprint stops, 3 radio and Hub hints.

## GWE-E17 Gauntlet of Retired Champions
**Concept.** A bracket tournament whose entrants are your own Legacy teams.
**Rules.** Choose 8 Legacy teams (auto-pick the best by score, or hand-pick). Bracket resolves by the battle engine in simulation only if the player watches (spectator) or lets "Quick Sim" run; seeds fixed by the bracket seed. Bets use gold with a cap (5% of savings). You can then fight the winning team yourself for the grand prize (a title and a cosmetic).
**Data.** `world.gauntlet = {seed, teams[], results[], bet, claimed}`.
**Presentation.** Bracket sheet with team portraits; spectator camera.
**Edge cases.** Fewer than 8 teams: fill with generated Champions. Simulation uses no animation state.
**Tests.** Deterministic bracket from seed, bet cap, reward-once.
**Build order.** 1 sim, 2 bracket UI, 3 betting, 4 final fight.

## GWE-F36 The World Without You
**Concept.** One rare session where the world acts as if you never played, ending with a gift for coming back.
**Rules.** Triggers once per profile at 200 runs, or via a one-in-2000 chance on app start thereafter (seeded by date). The Hub is empty of your decorations; NPCs talk about "a hero who never came" using their own earlier lines in the negative. A single short run-less scene ends with the world "restoring" and a gift (a unique cosmetic and a hint-free title).
**Data.** `world.flags.worldWithoutYou = true`.
**Presentation.** Desaturated palette, no music except a slow piano.
**Edge cases.** Skippable; no save mutation except the flag and gift. Accessibility: motion-reduced and caption friendly.
**Tests.** Once-only guard, gift granted once, skip path.
**Build order.** Single scene plus flag.
