# W2 Bonds, care & party life: coverage of ledger rows

Status words: **built** (this PR), **earlier** (already in the game before this PR), **partial**, **open** (not built; stays in the ledger for a later PR).
Rows come from `ideas-approved-ledger.md` (W2, 132 rows). Guard and Brace rows are not built (being removed).

## Built in this PR (`core/care`, `docs/status/care-bonds.md`)
I1 pet (partial: no purr animation) · I2 hug (once per stop) · I3 feed berries with favourite/hated flavors (text reactions) · I7 lullaby (+20% HP) · I8 groom (clears status, sparkle flag; no swipe minigame) · I10 nickname (name shows in party menu) · I21 box sulk as a mood drop (3 benched wins) · I33 not built · M50 fatigue · M58 mood · M59 hidden talent · M60 training focus · F31 nicknames, no filter · F38 moods (stats; crit not yet) · F42 training focus · F44 journal (fights, falls; partial) · F48 favourite flag (partial: stored only) · I42 ace flag (partial: stored only; memorial wall is W7/W8) · I6 cheer up (partial: button, not a tap minigame).

## Added in the second batch
I19 dress-up (scarf, bow, glasses, band, anklet: +2% to one stat; worn, shown in menu) · I24/I25/I321 egg care as **Sing to Eggs** (1 step closer per stop, never hatches by it) · F41 stat radar on the Stats tab · F60 release gift (extra candies by level, switched off with `careEffects`) · F40 compare screen already existed on the Stats tab.

I27 fetch (may bring back a berry) · I39 bedtime story (once per run, needs trust; friendship + mood). Care menu rows shrink when there are many.

Tap mini-interactions (press Enter fast): I6 tickle/cheer, I8 groom swipe, I33 wake-up (new Wake up action). 18 new party scenes in `partyLife.json` (75 total): I301 race, I302 wrestling, I309 Ditto copy, I315 item quarrel, I316 comedy duo, I322 pecking order, I323 bully/victim (moral choice), I330 food fight, I331 photo spots, I332 sleepy chain, I333 big sibling, I334 travel song, I335 comfy spot, I305 nest, I306 pack leader, I314 dark lead (cave/night), I300 duet, I308 item swap. F57 follower: the map token already shows your lead Pokémon.

## Follow-up PR
Favourite = never offered as trade fodder, cannot be swapped out of the party. Ace = marked ace on the Nuzlocke memorial, and its fall drops the team's mood a step. Map: your lead walks beside the current stop (F57), a small bonded Pokémon rides on its back (I20), and it dozes off with a floating z after 20 s idle (I9, I32). Scrapbook photos show the team striking personality poses (I18). F45 evolution preview on the Stats tab, F49 heal-first hint on Overview. 12 more scenes: I307 territory, I319 ancient bond, I324 shared dream, I325 star pupil, I338 matchmaker, I339 group dance, I340 team vote, I341 carried, I342/I343 doubt then reconciliation, I344 turn sacrifice, I320 translator.

Also: I17 Show off (Hype/hyper readiness +8), F46/I51 Hold evolution (no evolving until the next healing stop, then it may).

## Follow-up 2
M52 **Teamwork** (`data/teamwork.json`, 12 pairs like Plusle + Minun): the newcomer gets +1 in the pair's stats when sent in beside its partner, once per pair per battle (a boost, not an attack move; the log says "X and Y work together: Double Spark!"). M62 **Mastery stars**: a move used 20 times by the lead earns a star (+1 PP, +5% accuracy). M64 **Seasonal forms**: Castform takes the run's season form at a healing stop. I14 **Cuddle**: a hug gives friendship evolvers (Pichu, Eevee, Togepi...) +15 friendship (a bonus, not a hard gate: a gate broke old-seed determinism). I11 **Whistle** (Focus = crit, Steady = accuracy, Rush = speed; trust 40+; next fight only; no Guard/Brace). I26 **Sing-along** (singers only; tap Enter; a good one gives the whole team sleep immunity next fight). Show off (I17) and Hold evolution (F46/I51).
Already existing, so not rebuilt: M61 tutor and F35 relearner (`services.json` Move Tutor / relearn services).

## Earlier (see `docs/status/party-life.md`, Bond Engine)
I4/I5 share snack and gifts · I12 Listen (initiative) · I13 disobedience (refusal) · I16 gifts · I29/I30 fear and pride (grudges, comfort) · I37 sleep-over chats · I40/I41 last words · I291 chats · I292 bickering · I294 mentor/apprentice (mentors system) · I295 pranks · I297 jealousy/newcomer · I298 sharing food · I299 group hug · I311 evolution cheers · I312 gather round fainted · I313 revenge pact · I318 formation/synergy badge · I326 practice together · I328 gossip · I345 Spirit Link · M57 quirks · F33 friendship hearts · F59 team synergy.

## Open (not built here)
Photo mode with posing (I18; team photos exist as text in the Album), piggyback/shoulder sprites (I9, I20), other minigame rows (I26, I27, I28 beyond the camp scene), cuddle-evolve and refused evolution (I14, I51), whistle commands (I11, tied to the Guard/Brace actions that are being removed), daycare stop (F37), move relearner/tutor (F35, M61), mastery stars (M62), form swaps (M64), most W2 "I3xx" party-interaction rows not listed above, and the F43-F58 collection rows. They stay open in the ledger for follow-up W2 PRs.
