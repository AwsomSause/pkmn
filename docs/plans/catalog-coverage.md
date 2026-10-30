# Master Expansion Catalog coverage (162 items)

Source: `POKEMON_ROGUELIKE_MASTER_EXPANSION_CATALOG.md` (item numbers below). Kice: add EVERYTHING. Status: DONE (works, tested), PART, TODO. Owner thread in brackets where another thread owns it. Update in every PR that moves a line.

| Items | Topic | Status |
|---|---|---|
| 1-15 | A Battle drama, trainer voice, banter, recap cards | PART: Battle Drama Engine covers 1-13 [drama thread]. **14 recap card: TODO (run-end recap done in slice 1)**, 15 PART |
| 16-25 | B Mid-battle evolution, phases, charge-ups | PART: 16, 20, 22, 23, 25 exist (drama/Hyper/raids) [Hyper thread]; 17-19, 21, 24 TODO |
| 26-35 | C Wild Pokémon identity | PART: **26, 27 first-impression behaviours (7, narrative only), 30 territorial warnings, 31 rescue events (no punishment for declining), 32/66 one 3-link ecological chain (disturbed habitat -> poacher hideout -> habitat restored) DONE (slice 4)**; 28 recognized wild rival, 29 pack/habitat encounters, 35 unusual moves as clues TODO; 33-34 PART (shiny/special forms exist) |
| 36-47 | D Bond and personality | PART: 36-37, 44-46 via Bond screen/engine; 40 mentorship DONE; 38-39, 41-43, 47 TODO |
| 48-61 | E Rivals and nemesis | PART/DONE [rivals thread]; 60 Rival Ghost, 61 Chronicle page TODO |
| 62-75 | F World, routes, events | PART: 64-66, 71 events/services exist; 62, 63, 67-70, 72-75 TODO |
| 76-84 | G Shadow, Delta, forms | PART: 78-84 partial (specialForms.ts); 76-77 Shadow arc TODO |
| 85-93 | H Bosses and raids | PART: 85-89 raids/totems exist; 90-93 TODO |
| 94-104 | I Rewards and pacing | PART: **95 synergy line on draft cards DONE (slice 2; vitamins, level-ups, healing, attributes only)**; 98 contracts, 102 run rules DONE; **103 recap and 104 seed code DONE (slice 1)**; 94-97, 99-101 TODO |
| 105-114 | J Persistent progression | PART: **105 Research Room (met/caught/evolved totals), 112 collection sets (9 generations, Delta/Z/Spooky/Regional/Mega) with Research Point milestones DONE (slice 3; no shiny count: not tracked)**; 106 mastery, 108 trainer mastery, 113 legacy DONE; 107, 109-111 TODO; 114 recap DONE (slice 1) |
| 115-125 | K UI and QoL | **116 damage details DONE, 120 retry seed DONE, 124 settings PART (slice 1); 115 battle log (H key), 119 party roles on the Bond screen DONE, 118 PART (synergy line, no side-by-side) (slice 2)**; 117, 121-123, 125 TODO |
| 126-132 | L Audio | TODO (audio.ts exists, basic) |
| 133-145 | M Technical pipeline | PART: 133 provenance doc, 142 dashboard, 143 migrations exist; 134-141, 144-145 TODO |
| 146-155 | N Endgame and challenge modes | PART: 146 Daily, 152 modifiers, 153 Endless DONE; 147-151, 154-155 TODO |
| 156-162 | O Experimental | **162 accessibility profiles DONE (slice 1)**; 156 [doubles thread]; 157-161 TODO |
| Combos 1-6 | Cross-system combos | built from the above; tracked after slices land |
| Gates 0-6 | Order | Gate 0 items for Kice: repo visibility, GitHub Actions |

## Slices
1. Run recap, seed code, retry seed, damage details, accessibility profiles (settings v5). DONE.
2. Party roles, battle log (H), reward synergy line. DONE.
3. Research Room with collection sets and milestone payouts. DONE.
4. Wild behaviours, territorial warning, rescue events, ecological chain (`core/wildBehavior.ts`, `tools/events/wild.ts`). DONE (limited: behaviours are framing only, no catch or battle change).
