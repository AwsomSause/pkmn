# Visual coverage tracker (guide 9)

Every item in `VISUAL_BIBLE.md`, `COMPLETE VISUAL REMASTER.md`, `CLAUDE_VISUAL_REVAMP_BRIEF.md` and `VISUAL_REFERENCE_BOARD.html` (project files), with its status. Director's direction (2026-10-30): use or heavily reference Enhanced Battle UI, Essentials 21 (EBDX/UIE), Deluxe Battle Kit art; aesthetic Frutiger Aero, DS era, Wii era, Cyber-Maximalism; everything flowy, bouncy, animated. Hub and Trainer Select stay unchanged (all three docs).

Status: BUILT, PART (what's missing is noted), TODO, KEEP (doc says keep as is). "VB" = Visual Bible §, "CR" = Complete Remaster §, "BR" = Brief phase.

## Phase 0 / V0 — audit and baseline (BR 0, VB 13 V0, CR 3)
| Item | Status | Where / note |
|---|---|---|
| Check git state, run checks before edits | BUILT | Every slice PR reports them |
| Baseline screenshots at fixed seeds: battle, move picker, map | BUILT | slice 1 (seed `visual-base`) |
| Baseline screenshots: reward, shop, event, league, run end | TODO | slice V4 |
| Repo visibility / asset rights decision | BUILT | D4 private; director approved pack imports 2026-10-30 |
| Asset provenance manifest | BUILT | `docs/quality/asset-provenance.md` |
| Record sizes, load time, frame pacing baseline | TODO | slice V5 perf pass |

## V1 — visual system (BR 1, VB 3, VB 13 V1, CR 4)
| Item | Status | Where / note |
|---|---|---|
| Keep 960×540 space and 320×180 pixel baseline | KEEP | `ui/theme.ts` |
| Panel roles (glass, glass-low, foe/ally rims) | BUILT | `ui/aero.ts` `paintGlass` |
| Focus / hover / disabled states | BUILT | `Menu` `glass` option (glow + bounce; disabled dimmed) |
| Rarity and type cues paired with label/icon (never colour alone) | BUILT | type label art in move picker; rarity word + rarity rim on reward cards (slice 5) |
| Motion primitives (bounce, slide, breathe, float) respecting settings | BUILT | `ui/aero.ts` |
| Shared components in the widget layer, not per-scene | BUILT | `aero.ts`, `widgets.ts` |
| Trainer/Hub untouched (scope-safe variants) | BUILT | opt-in only |

## V2 — battle renderer (BR 2, VB 4.1–4.6, CR 5)
| Item | Status | Where / note |
|---|---|---|
| Layer 1 arena + weather/ambient animation | BUILT | `battleFx/ambience.ts`: preset per type (all 18), second type adds accents (slice 2) |
| Layer 2 platforms, contact shadows, edge lights | PART | PokeRogue bases already draw a shadow patch under each side; edge lights: slice 4 |
| Layer 3 sprites: idle breathing, entry | BUILT | slice 1 |
| Sprite states: hit, dodge/miss, attack lunge, status, faint, celebrate | PART | hit/lunge/faint exist (M9); miss dodge + victory hop: slice 2 |
| Layer 4 HP/status panels, party indicators | BUILT | glass databoxes, EBDX status icons, team dots |
| Held item / ability badges when supported | TODO | slice 5 (party/detail info panel, Enhanced Battle UI `info_*` art) |
| Boss phase indicator | BUILT | header phase count (other thread) + NEW PHASE banner with the phase's rule (slice 7) |
| Layer 5 move effects, numbers, effectiveness, shake | BUILT | M9 cues + BattleFx |
| Layer 6 command UI (glossy buttons, type/category art) | BUILT | slice 1 |
| Move flag icons (Enhanced Battle UI, 18) | PART | 9 shown (slice 3): every flag our move data has (contact, sound, bite, powder, pulse, punch, Z, Max) + high crit. Slicing, wind, dance, bomb, no-protect, thaw, electrocute, minimize, no-mirror: our data has no such flag yet |
| Effectiveness hint on moves (from what the player can see) | BUILT | EBUI tag + words vs the foe's visible (or Tera) types (slice 3); abilities like Levitate aren't counted |
| Layer 7 cinematic accents (portrait, banner, reveal, stamp) | PART | Hyper moment banner exists; slice 4 |
| HP drains smoothly; damage number; crit emphasis | BUILT | M9 |
| Low-HP subtle danger pulse on panel | BUILT | slice 2 (`dangerGlow`, ≤25 % HP) |
| Catch: throw arc, shakes, burst, success/fail cue | BUILT | M2 arc/shakes + DBK burst on success (slice 2) |
| Shiny reveal sparkle (once) | BUILT | `shinySparkle` |
| Battle intro transition (EBDX transitions) | BUILT | `battleFx/spectacle.ts`: wild streak + ball wipe (indoor streaks in dark arenas), VS screens for trainers / rivals (Evil) / bosses (Skull); skippable (slice 2) |
| Exit transition / victory beat | BUILT | hop (slice 2); glass-shutter exit wipe on every battle exit (slice 4) |
| Animation profiles fast / standard / showcase | PART | battle speed normal/fast/quick exists (settings v3); showcase: slice 4 |
| Reduced motion, reduced flash, shake option, skip | BUILT | battleAnimations + effectIntensity + skip |
| Reduce particles option | PART | ambience off when animations off/reduced |
| Pause ambient loops when tab hidden | BUILT | Phaser pauses the loop on hidden tabs |
| Test: hit/miss, status, faint/replace, switch, catch, transform, reload | PART | existing e2e (m2, m8_5, m9); add visual asserts per slice |

## V3 — signature moments (BR 4, VB 4.7–4.8, CR 6 gyms/E4/champion)
| Item | Status | Where / note |
|---|---|---|
| Trainer reaction cue from real events | BUILT | every Battle Drama line also shows in a glass speech bubble by the foe (slice 7) |
| Moment hierarchy: line → callout → bond/Hyper → signature/phase | PART | Hyper moments exist; slice 4 |
| Boss intro title/role card + field transition + music | PART | Skull VS screen + title card "Gym Leader Brock · Rock specialist" (slice 4); boss music: needs tracks (Raid Battles pack BGM later) |
| Champion framing, ace indicator, unique motif | PART | role rims (gym gold, Elite violet, champion pale gold) + ACE beat (slice 4); unique champion arena: slice 10 |
| Phase-change banner with written rule | BUILT | `phaseBanner` in `battleFx/spectacle.ts`: raid/totem phase events (slice 7) |
| Ace entry beat | BUILT | last Pokémon of a trainer team: burst + ACE! stamp (slice 4) |
| Victory pose / particles / Chronicle stamp | BUILT | hop + VICTORY!/BADGE GET!/CHAMPION! stamps with sparkles (slice 4) |
| Transformation reveal (Mega, Primal, Tera, Dynamax, Z) with DBK art | PART | DBK burst/shine/pulse reveal in the form's colour replaces the full-screen flash (slice 2); EBDX Mega/Dynamax symbols in the databox (slice 3) |
| Evolution sequence | PART | burst reveal instead of white flash (slice 2); silhouette sequence: slice 5 |
| Rival callouts from real memory | BUILT | rival lines come from Drama/rival memory and show in the speech bubble (slice 7) |
| Gym leader intro and defeat sequence, gym motif | PART | intro card, badge stamp (slice 4); per-gym motif = type ambience of the leader's type |

## Effect pipeline (BR 3, VB 4.4, VB 7, CR 5.3)
| Item | Status | Where / note |
|---|---|---|
| Validated adapter into project schema | BUILT | `core/presentation/animFormat.ts`, `moveAnims.ts` |
| Data-driven startup/travel/impact/aftermath/camera/audio/fallback | BUILT | slice 8: Essentials pack anim → PokeRogue anim → family recipe (`core/presentation/families.ts`, `ui/battleFx/familyFx.ts`) |
| 26 animation families | BUILT | slice 8: all 26 in use (`docs/quality/MOVE_ANIMATIONS.md`) |
| Per-type visual vocabulary table (VB 7) | BUILT | type colour + type→family (`TYPE_FAMILY`) |
| Report per active move (mechanic, visual, sound, fallback, test, duration) | BUILT | `npm run report:anims -- --write` → `docs/quality/MOVE_ANIMATIONS.md` (family, first choice, stand-by, status) |
| Essentials pack move animations (PkmnAnimations.rxdata, 212 moves + 11 status) | BUILT | slice 8: `npm run data:pack-anims`, played first |
| EBDX scripted move animations (442 Ruby scripts) | LIMITED | code, not frame data; graphics reused for cinematics (slice 8c) |
| Z-Move / Max Move attack animations | LIMITED | no pack has them; they borrow a same-type anim + signature family |

## V4 — other gameplay screens (BR 5, VB 5–6, CR 6)
| Item | Status | Where / note |
|---|---|---|
| Map: clear node states, icon language, risk text, travelling highlight, parallax, boss column | BUILT | slice 6: glass header/footer and pill buttons; stage-type ambience + drifting scenery; open paths glow with travelling lights; breathing halo on reachable nodes, ✓ on visited ones; bouncy focus ring; glowing boss column; "Risk: high / boss" in the info line; a token hops to the chosen node before the battle |
| Reward draft: equal cards, rarity label, exact effect, eligibility, hover raise, collect motion | BUILT | glass cards with rarity rim, deal-in, focus lift, chosen card flies off with a burst (slice 5) |
| Shop: money/price labels, category icons, SOLD state, focus details | PART | glass shop/bag/party lists and Aero backdrop (slice 5); category icons + SOLD stamp: slice 8 |
| Party/detail: tabs, moves with type/category, memories | TODO | slice 9 |
| Event choice: illustration, 2–4 options with costs, consequence ack | PART | Aero backdrop + glass pickers on event/decision screens (slice 5); illustration frame: slice 9 |
| League escalation, game over, run recap, victory | PART | glass run-end panels; run-end screen ignores mashed keys for its first moment (slice 5); league escalation: slice 10 |
| Briefing, loading transitions, visual settings | PART | glass briefing panels (slice 5); loading transitions: slice 10 |
| Level-up / reward reveal / milestone transitions | TODO | slice 8 |
| Regional progression look (new palettes per region) | PART | each stage's map takes its types' ambience (slice 6); per-region palettes: later |
| Hall of Fame screen (champion teams, unusual wins, rare forms, records, Legacy Cards, epitaphs) | BUILT | Hub **Events → Hall of Fame**: glass rows for records, champion teams with epitaph and why a win was unusual, shiny Pokémon, Legacy Cards with titles; icons bob, shinies sparkle (`core/hallOfFame.ts`, `scenes/HallOfFameScene.ts`). Runs from before profile v12 have no epitaph or cards |
| Bond screen for the Bond Engine (traits, mood, bond level) | BUILT | map **Bonds** button: glass card per Pokémon, trait, floating mood bubble, 7 bars that fill with a bounce, hint explains the mood, practiced partners and refusal risk (`ui/bondMenu.ts`) |

## V5 — coverage, performance, polish (VB 9, VB 13 V5, CR 9–12)
| Item | Status | Where / note |
|---|---|---|
| Lazy-load and release art/audio; repeated-battle leak test | PART | lazy loading exists; leak test slice 11 |
| Frame pacing / memory budget measurements | TODO | slice 11 |
| Narrow viewport, no text overlap | PART | slice 1 screenshots at 960×540, 800×450, 480×800 |
| Every asset listed in provenance | BUILT | ongoing |

## Reference board (`VISUAL_REFERENCE_BOARD.html`)
| Item | Status | Where / note |
|---|---|---|
| Layer order: ambience → grounded sprites → panels → effect → command | BUILT | BattleScene |
| Palette (plum/red/amber) | PART | Kice's later direction (Aero/DS/Wii/cyber, 2026-10-30) wins for battle and gameplay screens; HP green and EXP blue kept; Hub/Trainer keep the plum palette |
| Effect templates: contact, projectile, beam, elemental, status, healing, protection, field, signature | TODO | slice 6 |
| Effects explain the action (wind-up → direction → impact → consequence) | PART | telegraph + anim + impact cues (M9) |
| Menus tactile and readable, no overlapping panels | BUILT | slice 1 |
| Gameplay authoritative; missing animation never breaks a battle | BUILT | cues layer + fallback |
