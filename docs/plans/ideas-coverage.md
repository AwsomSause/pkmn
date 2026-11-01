# Ideas coverage tracker (approved ideas, Kice 2026-11-01)

Source: the approved-ideas ledger (852 approved rows, project files) and plan ideas-implementation-plan.md. One row per approved idea. Status: TODO (nothing yet), PART (some of it works), DONE (works in the game), DROPPED (Kice removed it). A row is only DONE when it works, not when it is data. **Every workstream PR updates its rows here.** Counts: `npm run report:ideas`. First verify-vs-code pass: 2026-11-01 (W0); evidence is a pointer, not proof, so recheck before relying on it.


## W1 Battle play & battle UI (41)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I56 | Draw-your-aim: drag to aim certain moves (Thunder, Fissure) for an accuracy bonus | Y (Optional) | TODO |  |
| I67 | Coordinated attack: two allies' matching types trigger a visual combo |  | TODO |  |
| I71 | Surrender offer: low-HP trainer proposes a deal, accept or reject for rewards |  | TODO |  |
| I72 | Catch assist: weaken a wild Pokémon, then do a skill throw with moving reticle |  | TODO |  |
| I74 | Pokémon yells before using a signature move, trainer can echo the shout to boost |  | TODO |  |
| I76 | Revenge moment: a fainted ally's partner gets a rage prompt with a dialogue line |  | DONE | src/core/battle/engine.ts:5436 revengeMoment (bonded teammate after a faint, +1 Atk/SpA); battle-drama-spectacle.md |
| I77 | Mid-battle item toss: throw a berry to an ally in the field with animated arc |  | TODO |  |
| I78 | Lend-a-hand: spectator NPCs from the run can toss you one buff |  | TODO |  |
| I86 | Spectate button during AI vs AI exhibition matches, place a friendly wager |  | TODO |  |
| I88 | Foe analysis: scan a foe with a Pokédex mini-game, correct guesses reveal weaknesses |  | TODO |  |
| I95 | Dramatic crit freeze-frame where you choose the camera angle |  | TODO |  |
| I98 | Mind-read: Psychic-type allies reveal one foe move choice per battle |  | TODO |  |
| I99 | Double-tap Mega/Z/Tera trigger with matching gesture and flashy confirm |  | TODO |  |
| I102 | Environment interact: smash a cliff, drop rocks or flood tiles in some arenas |  | TODO |  |
| I103 | Split-second decision: some events give a countdown choice instead of free time |  | TODO |  |
| I106 | Pokémon remembers a past grudge vs a foe species and gets a rage buff with a line |  | TODO |  |
| M4 | **Guard break**: a shield bar on bosses; empty it with multi-hit moves to stagger them for a turn. | Y but only Champions or non gym/elite four bosses | DONE | src/core/battle/spectacle.ts Guard Break (guard points, stagger); BattleScene.ts:947; docs/status/battle-drama-spectacle.md |
| M17 | **Type resonance**: a party of 3+ sharing a type gives that type +5% damage. |  | TODO |  |
| M29 | **Hazard layers 2.0**: hazards stack by type and trigger synergy (Spikes + Toxic Spikes = poison burst). |  | TODO |  |
| M32 | **Environment hazards**: arena events (lava flow, falling rocks) hit both sides on a fixed schedule. |  | TODO |  |
| M43 | **Bleed**: slicing moves cause bleed that stacks with each hit and clears on switch. | Y (Make it only few moves and some steel type moves) | TODO |  |
| M44 | **Curse tags**: Ghost moves tag a foe; tagged foes take extra from any Ghost/Dark follow-up. |  | TODO |  |
| M76 | **Weakened capture bonus**: stacking chip damage and a status raises catch odds with clear numbers shown. |  | PART | src/core/capture.ts:25 HP+status raise catch odds; engine.ts:1194; no numbers shown to player |
| M77 | **Lure and bait**: set lure items at map stops to bias the next encounter's type. |  | PART | src/core/mapItems.ts + contentSchema.ts:1288 Incense/Flute 'types' encounter mod biases type; not placed lures |
| M78 | **Alpha encounters**: rare oversized wilds with higher stats and better drops. |  | TODO |  |
| M79 | **Shiny charm progress**: a visible shiny meter rises with encounters; all rolls remain seeded. |  | TODO |  |
| M80 | **Encounter chains**: hitting the same species repeatedly raises its shiny and perfect-stat odds. |  | TODO |  |
| M82 | **Habitat reading**: scouting a route reveals a short list of likely species. |  | TODO |  |
| M100 | **Elite gauntlet**: Elite Four fights back-to-back with a small heal between, no full restore. | Y ( Yes full restore) | DONE | src/core/run.ts:2430 Elite Four heal party after each battle |
| F3 | Battle log filter tabs: damage, status, weather, ability. | Y (Battle Log in Battle) | TODO |  |
| F6 | Critical-hit streak meter that grants a tiny crit-rate bonus. | Y (But a rare item) | TODO |  |
| F7 | Combo moves: two allies using matching moves in doubles fire a bonus joint attack. |  | TODO |  |
| F11 | Field hazards visual layer (rocks, spikes, webs drawn on the arena floor). |  | TODO |  |
| F14 | Auto-battle toggle with speed 1x/2x/4x for grinding easy fights. | Y (Put as setting that decreases rewards by 65%) | DONE | src/core/settingsRegistry.ts:91 autoBattle (EXP halved), battleSpeed:93; src/core/battle/autoBattle.ts; docs/status/battle-pages-auto-battle.md |
| F15 | Smart-target suggestion arrow in doubles. |  | TODO |  |
| F19 | Bench support: a benched Pokémon shouts a buff once per battle. | Y (But must have high enough friendship) | TODO |  |
| F20 | Item hotbar: pin 4 favourite bag items for one-tap use. |  | TODO |  |
| F21 | Adaptive music layers that intensify as HP drops. |  | TODO |  |
| F22 | Boss intro cinematic skip with remembered preference per boss. | ASK: (Make a genuine boss cinematic) | TODO |  |
| F25 | "Underdog" bonus XP when facing a team with a higher average level. | Y (Must be 4-5 levels higher) | TODO |  |
| F26 | Switch-in ability pop-ups with short flavour text. | N, but: N (Already in game) | DONE | src/ui/battleFx/abilityFx.ts ability banners; src/core/presentation/abilityAnims.ts |

## W2 Bonds, care & party life (132)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I1 | Pet the lead Pokémon in the party screen; happy ones purr, wiggle and gain tiny bond |  | TODO |  |
| I2 | Hold-to-hug: long-press a Pokémon to hug it, bond rises once per rest stop |  | TODO |  |
| I3 | Feed berries by hand; each Pokémon has favorite and hated flavors with reaction animations |  | TODO |  |
| I4 | Share a snack at campfires; picky eaters refuse and sulk for a node |  | TODO |  |
| I5 | Pokémon asks for a specific item by emoji bubble; granting it gives a stat nudge |  | TODO |  |
| I6 | Tickle minigame: tap the ticklish spot to cheer up a sad Pokémon before a boss |  | TODO |  |
| I7 | Lullaby: tuck in a tired Pokémon at camp to heal extra HP, crooning varies by type |  | TODO |  |
| I8 | Brush/groom swipe minigame that removes status leftovers and adds shiny-sparkle cosmetics |  | TODO |  |
| I9 | Pokémon falls asleep on your shoulder in the overworld if you idle too long |  | PART | docs/status/party-life.md shoulder-nap text scene (data/partyLife.json), no overworld sprite |
| I10 | Name-calling: nickname a Pokémon and it answers differently to its nickname vs species name |  | TODO |  |
| I11 | Whistle command in battle: tap the sprite to give a one-word hint (Dodge, Brace, Focus) |  | TODO |  |
| I12 | Trust meter unlocks "Listen" turns where the Pokémon sometimes picks a better move on its own |  | PART | src/core/bond/index.ts:~100 shapeAction "Takes Initiative" swaps to better move (bond-gated) |
| I13 | Disobedience: low-bond Pokémon may ignore a command; calming them is a mini-interaction |  | PART | src/core/bond/index.ts:73 wouldRefuse (reckless moves only); no calming interaction |
| I14 | Cuddle-evolve: certain evolutions need a hug at a specific camp, not just friendship value |  | TODO |  |
| I15 | Pokémon points at hidden things on the map when bond is high (sniffs out items) |  | TODO |  |
| I16 | Pokémon brings gifts (berry, pebble, feather) after a good battle if you're close |  | PART | partyLife.json gift-found / cheer-up-gift scenes (affection 60+), docs/status/party-life.md |
| I17 | Show-off button: let a Pokémon strike a pose before the boss intro to gain Hype |  | TODO |  |
| I18 | Photo mode: pose party members and snap a team photo saved to the Hub album |  | PART | party-life.md team photos in Album (src/ui/partyLifeUi.ts), text not sprite poses |
| I19 | Dress-up: give Pokémon scarves, bows, glasses; they react and sometimes get small buffs |  | TODO |  |
| I20 | Piggyback: tiny Pokémon ride on the trainer sprite on the map screen |  | PART | partyLife.json piggyback scene, text only (party-life.md) |
| I21 | Pokémon sulks if left in the box too long; greeting it on return mends the mood |  | DONE | partyLife.json sulk-box (3 wins sat out, reassure choice) |
| I22 | Teach moves by demonstration: drag a move card onto a Pokémon and it "practices" with animation |  | TODO |  |
| I23 | Move tutor wild-card: a Pokémon asks to forget a move it dislikes |  | DONE | partyLife.json forget-move scene (party-life.md) |
| I24 | Shake the egg (device tilt or key mash) to speed hatching, with cracking sounds |  | TODO |  |
| I25 | Warm the egg by holding it at campfires; cold maps slow hatching |  | TODO |  |
| I26 | Sing-along: rhythm tap with Jigglypuff-line Pokémon grants sleep resistance |  | TODO |  |
| I27 | Fetch game: throw a ball and the Pokémon returns items to the pack |  | TODO |  |
| I28 | Hide-and-seek at camp: find the hidden Pokémon in the scene for a bond reward |  | DONE | partyLife.json hide-seek scene |
| I29 | Fear reaction: Pokémon cowers when facing a type that once KO'd it, offer a reassure action |  | TODO |  |
| I30 | Pride reaction: after beating a type that once beat it, a victory dance plays |  | TODO |  |
| I31 | Mood ring: portrait border color shows current mood; tap for a short thought bubble |  | PART | src/ui/pokemonInfo.ts:128 bondView mood + Bond screen (no portrait border/thought bubble) |
| I32 | Pokémon yawns when the player is AFK, nudging the screen back to life |  | TODO |  |
| I33 | Wake-up call: tap a dozing Pokémon repeatedly to wake it; grumpy types buff then fail |  | TODO |  |
| I35 | Bathe in hot springs node: scrub minigame cures one status and raises bond |  | TODO |  |
| I37 | Sleep-over: pick two Pokémon to share a tent; they chat in text bubbles |  | TODO |  |
| I38 | Birthday: anniversary of catching a Pokémon pops a party prompt with cake item |  | TODO |  |
| I39 | Bedtime story: a Pokémon asks for its backstory; reading unlocks lore and a trait |  | TODO |  |
| I40 | Sacrifice choice: a dying Pokémon can pass a held item or stat boost to a friend |  | TODO |  |
| I41 | Final farewell: permadeath mode lets you say goodbye with a last-words screen |  | PART | partyLife.json last-words scene (Ghost listens), not permadeath farewell screen |
| I42 | Memorial wall: fainted Pokémon get a grave-stone interaction in the Hub, flower offering | Y (Only nuzlocke pokemon and aces) | TODO |  |
| I49 | Teach manners: scold or praise after a misbehaving Pokémon, shifts nature slightly |  | TODO |  |
| I50 | Lend a Pokémon to an NPC for one node and get it back leveled |  | TODO |  |
| I51 | Pokémon refuses an evolution (B-cancel) and the player can convince it through dialogue |  | TODO |  |
| I291 | Party members chat in text bubbles at camp, driven by nature pairings |  | DONE | partyLife.json talk-* / camp-story-* scenes (personality-driven), src/core/partyLife/index.ts |
| I292 | Rivalries within the party: two Pokémon bicker, resolve via a pick-sides prompt |  | DONE | partyLife.json bicker + rivals-tense scenes with choices |
| I293 | Friendship pairs unlock tag moves |  | TODO |  |
| I294 | Mentor-student: a high-level Pokémon coaches a low-level one for exp share |  | PART | src/core/story/mentorship.ts protege system (accept/decline), not exp share |
| I295 | Teasing: Gengar pranks teammates, the prank can be buff or debuff |  | TODO |  |
| I296 | Couple pairing: compatible Pokémon share an egg at the daycare |  | TODO |  |
| I297 | Jealousy: a new recruit upsets the lead, mediation event |  | PART | partyLife.json welcome-wary / settled-in newcomer scenes |
| I298 | Sharing food: stronger Pokémon give berries to weaker ones when bond high |  | DONE | partyLife.json share-berry (uses Bag berry or forages) |
| I299 | Group hug before big fights, requires every member bonded |  | DONE | partyLife.json group-hug once per boss (party-life.md) |
| I300 | Singing duet: Pokémon with sound moves harmonize for an aura |  | TODO |  |
| I301 | Race at camp: pick a winner, results shown by stat |  | TODO |  |
| I302 | Wrestling match for boredom relief |  | TODO |  |
| I303 | Guard duty: a vigilant Pokémon warns when a trap is near |  | TODO |  |
| I304 | Piggyback carrying a small friend over water tiles |  | PART | partyLife.json piggyback, text only |
| I305 | Nest-building: Bird Pokémon build a perch for the team |  | TODO |  |
| I306 | Pack leader emerges by nature, lead choices shift order |  | TODO |  |
| I307 | Territorial dispute with foe species, comic conflict scene |  | TODO |  |
| I308 | Pokémon swap held items on their own when one benefits more |  | TODO |  |
| I309 | Imitation: Ditto copies a teammate's mood at camp |  | TODO |  |
| I311 | Evolution celebration: teammates cheer around the evolver |  | DONE | partyLife.json evolve-cheer |
| I312 | Faint reaction: teammates gather around the downed friend |  | DONE | partyLife.json gather-faint |
| I313 | Revenge pact: they vow to avenge a fallen ally |  | DONE | partyLife.json revenge-pact (+1 Atk opener) |
| I314 | Fear of dark: a brave Pokémon leads in cave nodes |  | TODO |  |
| I315 | Quarrel over who holds the item |  | TODO |  |
| I316 | Comedy duo: a pair gets joint bonus on comedy events |  | TODO |  |
| I317 | Lullaby from a Chansey calms an angry Machamp |  | TODO |  |
| I318 | Trio formation: three same-region mons unlock a formation bonus |  | TODO |  |
| I319 | Ancient bond: legendary pair sense each other and react |  | TODO |  |
| I320 | Interspecies translation: translator Pokémon decodes wild Pokémon talk for the player |  | TODO |  |
| I321 | Egg lullaby: team sings to egg to boost hatch rate |  | TODO |  |
| I322 | Pokémon rank themselves in a pecking order shown in menu |  | TODO |  |
| I323 | Bully/victim dynamics resolved through moral choice |  | TODO |  |
| I324 | Shared dreams: during sleep, two Pokémon meet in a dream node |  | TODO |  |
| I325 | Star pupils: a Pokémon trains with a rival-boss's Pokémon in a flashback |  | TODO |  |
| I326 | Healing circle: three healers channel a single bigger heal at camp |  | TODO |  |
| I327 | Tag-team sparring: choose two to train together, both gain EV-lite points | ASK: H | PART | partyLife.json practice-moves / camp-practice scenes, chemistry only (no EV-lite) |
| I328 | Pokémon gossip about NPCs, hinting at who has secrets |  | PART | partyLife.json gossip-hint (next gym leader type, not NPC secrets) |
| I329 | Rivalry with a rival's Pokémon carries into text banter |  | PART | partyLife.json callback-rival scene |
| I330 | Food fights break out if berries are scarce |  | TODO |  |
| I331 | Group photo pose shuffle: they argue over spots |  | TODO |  |
| I332 | Sleepy chain: yawning spreads across the party |  | TODO |  |
| I333 | Big sibling protects small one by taking a hit once per battle |  | TODO |  |
| I334 | Travel songs: team hums while crossing nodes, adds ambiance |  | TODO |  |
| I335 | Pokémon fight over a comfy spot in the tent |  | TODO |  |
| I336 | Teach-a-trick: Pokémon showing another a move can unlock egg moves |  | TODO |  |
| I337 | Foster a wild baby, the party adopts it and reacts |  | PART | partyLife.json adopt-baby (one scene, gives Egg) |
| I338 | Matchmaker NPC pairs Pokémon with portrait hearts |  | TODO |  |
| I339 | Group dance at festival events for bond |  | TODO |  |
| I340 | Team meeting: Pokémon vote on which route to take |  | TODO |  |
| I341 | Wounded Pokémon is carried by a teammate on the map |  | TODO |  |
| I342 | Betrayal arc: a Dark-type secretly sides with rival, reveal event |  | TODO |  |
| I343 | Reconciliation hug after a betrayal event |  | TODO |  |
| I344 | Pokémon sacrifice their turn to help a struggling friend |  | PART | party-life.md "Came to Aid" existing event for protecting struggling teammate |
| I345 | Spirit link: Ghost types ferry a faint ally's last words to the team |  | DONE | partyLife.json last-words (Ghost-type listens), party-life.md |
| M50 | **Fatigue**: a Pokémon used in many fights in a row tires (-5% per fight) and recovers when benched. |  | TODO |  |
| M52 | **Teamwork moves**: certain species pairs unlock a combined move once per battle (e.g. Plusle + Minun). |  | TODO |  |
| M53 | **Mentor/apprentice**: a high-level Pokémon passes one move to a lower one at a service stop. |  | PART | src/core/story/mentorship.ts protege; src/data/services.json tutor/reminder; no move-passing |
| M55 | **Party synergy codex**: discovered combos (e.g. rain + Water + Electric) are logged and give a tiny reward. |  | TODO |  |
| M57 | **Quirks**: each Pokémon rolls one minor quirk at catch (e.g. Skittish, Brave, Showy). |  | PART | src/core/partyLife/index.ts:49 quirk rolled from uid (8 quirks, flavor only) |
| M58 | **Mood**: mood changes with how you treat it (items, wins, retreat) and nudges stats +/-3%. |  | PART | src/core/bond/index.ts:42 bondMood Wary/Steady/Devoted; autoBattle.ts:168; no +/-3% stat nudge verified |
| M59 | **Hidden talent**: late-run a Pokémon may reveal a talent (a free boosted stat) after enough fights. |  | TODO |  |
| M60 | **Training fields**: spend a stop to pick a stat to focus (EV-lite) for the next 3 fights. |  | TODO |  |
| M61 | **Move tutoring**: unlocked moves can be learned at a hub tutor using run currency. |  | DONE | src/data/services.json id tutor; src/core/services/flow.ts |
| M62 | **Move mastery stars**: using a move 20 times upgrades it with a small perk (+1 PP, +5% accuracy). |  | DONE | src/core/moveMastery.ts (Bronze/Silver/Gold), STATUS.md Catalog slice 6k |
| M64 | **Form swaps by condition**: regional or seasonal forms change when you pass specific events. |  | TODO |  |
| F31 | Nicknames with a rename screen and profanity-safe filter. | Y (No profanity safe filter) | TODO |  |
| F32 | Pokémon personality traits that nudge AI-controlled actions (bold, timid). |  | PART | src/core/bond/index.ts shapeAction bond traits shape player actions; autoBattle profile |
| F33 | Friendship hearts shown on the party screen with milestones. | Y (Make friendship stat and related things a larger spectrum to spread throughout run) | PART | src/core/friendship.ts friendshipHearts used in src/ui/partyPanel.ts, pokemonInfo.ts:139 |
| F35 | Move relearner NPC at map stops (pay gold). | N, but: N (Make it an Item ((Rare)) | DONE | src/data/services.json id reminder (Move Reminder service), STATUS.md Phase D2 |
| F37 | Daycare stop: leave a Pokémon for a node and gain levels. |  | TODO |  |
| F38 | Pokémon "moods" that change after fights and affect crit/accuracy slightly. | Y (But it changes Crit/Stats) | TODO |  |
| F40 | Compare screen: two Pokémon side by side. | Y (Also add this to catch menu) | DONE | src/ui/pokemonMenu.ts:516 compareStats vs lead/other party member (not in catch menu) |
| F41 | Stat radar chart on the summary page. |  | TODO |  |
| F42 | IV/EV-lite "training focus" picked at rest stops. |  | TODO |  |
| F43 | Shiny sparkle chance meter that grows with run streaks. |  | TODO |  |
| F44 | Pokémon journals: each one logs battles, KOs, favourite move. |  | DONE | src/ui/pokemonInfo.ts:152 historyView (battles, KOs, bosses, memories) |
| F45 | Evolution preview showing the next form silhouette. | Y (But put in summary) | TODO |  |
| F46 | Cancel-evolution with "hold" and regret-free re-trigger at next rest. |  | TODO |  |
| F48 | Tag a favourite; favourites are never offered as trade fodder. |  | TODO |  |
| F49 | Heal-order suggestions: "Heal X first". |  | TODO |  |
| F50 | Level-cap hints before gym-style bosses. |  | PART | src/ui/pokemonMenu.ts:101 level cap shown in Pokemon menu (runLevelCap) |
| F51 | Hidden ability capsule as a rare shop item. |  | TODO |  |
| F52 | Nature mints in rare shops to reroll nature. |  | PART | src/core/natures.ts + catalog nature effect; 21 Mints (STATUS.md), shop placement unverified |
| F54 | Pokédex-style "seen / owned / mastered" tabs. |  | PART | src/scenes/HubScene.ts:684 dex seen/caught + Species Mastery ranks (core/mastery.ts) |
| F55 | Silhouette quiz minigame to earn dex points. |  | TODO |  |
| F57 | Companion follower: your lead walks on the map screen. |  | TODO |  |
| F58 | Pokémon voice cries volume mix per Pokémon. |  | TODO |  |
| F59 | Team synergy badge (e.g. "Rain Squad") shown on the party screen. | Y (Player can change name) | PART | Team Chemistry labels (docs/status/team-chemistry-effects.md) + party culture title on Bonds screen; not renamable |
| F60 | Release-with-gift: releasing gives a small item based on level. |  | TODO |  |

## W3 Items, camp & crafting (61)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I189 | Drag-combine items to craft (berry + pot = tea) |  | TODO |  |
| I190 | Item hands: hold item up and the Pokémon sniffs, hinting at its effect |  | TODO |  |
| I191 | Item wear: tools degrade with use and can be repaired at a forge |  | TODO |  |
| I192 | Rummage: poke through trash cans for odd items, with a risk of rats | ASK: T | TODO |  |
| I193 | Shake bags to find hidden pockets |  | TODO |  |
| I194 | Gift wrap items for NPCs, wrapping style affects gratitude |  | TODO |  |
| I195 | Throw items to distract wild Pokémon |  | TODO |  |
| I196 | Use compass item to point toward the nearest rare node |  | TODO |  |
| I197 | Binoculars item: zoom the map ahead and spot events |  | TODO |  |
| I198 | Lantern item: reveals trap nodes, runs out of oil |  | TODO |  |
| I199 | Map scrap pieces assembled in a jigsaw for a treasure node |  | TODO |  |
| I200 | Bottle messages found at sea, open to read and reply |  | TODO |  |
| I201 | Keys and locks: lockpick minigame vs key hunt |  | TODO |  |
| I202 | Curse items you can't discard, only cleansed via interaction at shrines |  | TODO |  |
| I203 | Trade relic stacks at an altar, weighing up synergies |  | TODO |  |
| I204 | Bag organization drag-and-drop with a satisfying thunk |  | TODO |  |
| I205 | Label printer: rename items for run-specific notes |  | TODO |  |
| I206 | Vending machine events: shake it for a free item with a chance of jam |  | TODO |  |
| I207 | Time capsule: bury an item to dig up in a later run |  | TODO |  |
| I208 | Sell mode: haggle by displaying items in a window to NPC customers |  | TODO |  |
| I209 | Item recipes discovered by experiments and recorded in the cookbook |  | TODO |  |
| I210 | Smell test: sniff mystery berries, wrong guess poisons slightly |  | TODO |  |
| I212 | Dowsing rod: follow vibrations to buried treasure |  | TODO |  |
| I213 | Cursed mirror: reveals a Pokémon's hidden trait but costs luck |  | TODO |  |
| I214 | Gacha capsule machine at the Hub for cosmetics, tap-wiggle to open |  | TODO |  |
| I215 | Holding item swap by drag from party to party with a cute pass animation |  | TODO |  |
| I216 | Item compare overlay when hovering over upgrade options |  | DONE | src/core/rewardCompare.ts, used in src/scenes/RewardScene.ts:8 (now vs after on draft cards) |
| I217 | Wishing well: toss coins and speak a wish, outcomes seeded |  | TODO |  |
| I218 | Fishing rod minigame: cast, wait, set the hook for item or Pokémon |  | PART | src/data/minigames.json fishing-challenge, src/core/minigame/games.ts:415 (tension reel, not cast/set-hook) |
| I219 | Shovel dig events with a grid-based hot-and-cold guide |  | PART | src/core/minigame/games.ts:589 tracking (warm/cold search), :360 excavation |
| I220 | Net: catch bug types gently without damaging them |  | TODO |  |
| I221 | Tent item: pitch camp in a minigame, quality determines rest bonus |  | TODO |  |
| I223 | Item journal records the first use of each item and narrates it |  | TODO |  |
| I224 | Mix potions: guess ratios, a bad mix bubbles and explodes harmlessly |  | TODO |  |
| I225 | Poké Ball customization: sticker them with seals and effects |  | TODO |  |
| I226 | Ball launcher timing: skill shot for catch rate |  | TODO |  |
| I228 | Fireworks item: light them at camp to raise team morale |  | TODO |  |
| I229 | Telescope: stargaze at night nodes to read a forecast |  | TODO |  |
| I230 | Musical instrument items: play a tune to calm or provoke wild Pokémon |  | TODO |  |
| I231 | Radio item: tune to stations with different buffs and news |  | TODO |  |
| I232 | Camera item: photograph rare Pokémon for a Pokédex photo album |  | TODO |  |
| I233 | Trash-to-treasure: recycling junk items into small parts |  | TODO |  |
| I234 | Hat tip: wearable hats change NPC reactions |  | TODO |  |
| I235 | Fake item: bluff NPCs with a prop for a Charm check |  | TODO |  |
| I236 | Parcel deliveries: carry an NPC's parcel without opening it |  | TODO |  |
| I237 | Wallet theft insurance interactions via alarm tags |  | TODO |  |
| I238 | Glow stick signals: wave to allies in dark caves |  | TODO |  |
| I239 | Sealed letters you may open or deliver unopened for moral points |  | TODO |  |
| F131 | Item descriptions with example scenarios. |  | TODO |  |
| F132 | Bag sorting by type, rarity, recently used. |  | PART | src/core/bag.ts pocket tabs + rarity shown (docs/status/unified-bag-major-4-7.md); no rarity/recent sort |
| F136 | Rarity glow around items by tier. |  | DONE | src/scenes/RewardScene.ts:74-80 rarity glow on cards; fieldMenus.ts:333 rarity pill |
| F137 | Crafting bench combining 2 berries into a buff item. | ASK: (Pause because berry reward) | TODO |  |
| F138 | Recipe book unlocked by finds. |  | TODO |  |
| F139 | Cooking pot at camp for team-wide meal buffs. |  | TODO |  |
| F140 | Lucky charm that reroll one shop slot. |  | TODO |  |
| F142 | Mystery box purchase with odds listed. |  | TODO |  |
| F145 | Cursed items with a trade-off and a purify option. |  | TODO |  |
| F150 | Black market stops with risky stock. |  | PART | src/core/services/flow.ts:290 Black Market service (locked stock at markup) |
| F152 | Item fusion for TMs. | Y (Has to relate to type, IE Plates or Silvally Memories) | TODO |  |
| F153 | TM/HM shelf with a preview of the move animation. |  | TODO |  |
| F155 | Event-only currency sinks with limited stock. |  | TODO |  |

## W4 Map, world & run structure (66)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I346 | Tap trees to shake loose berries or wild Pokémon |  | TODO |  |
| I347 | Swim, climb, or glide across map tiles, determined by team's types |  | TODO |  |
| I348 | Cut and pull bushes with Grass types to reveal paths |  | TODO |  |
| I349 | Strength push boulders to open shortcuts |  | TODO |  |
| I350 | Light torches with Fire types to cross dark caves |  | TODO |  |
| I351 | Surf across lakes with Water types for safe passage |  | PART | events.json lost-at-sea partyType water gate (event-level, no tile traversal) |
| I352 | Ice bridges frozen by Ice types let you cross rivers |  | TODO |  |
| I353 | Weather clash: summon rain to extinguish fires blocking a path |  | TODO |  |
| I354 | Dig tunnels under walls with Ground types |  | PART | events.json quarry-2, mudslide-rescue partyType ground |
| I355 | Fly over cliffs with Flying types, costing stamina |  | PART | events.json lookout-tower, windswept-spire-1 partyType flying |
| I356 | Mind-read statues with Psychic types to learn clues |  | TODO |  |
| I357 | Spectral doors that only Ghost types open |  | TODO |  |
| I358 | Electric panels powered by Electric types |  | TODO |  |
| I359 | Poison swamp tiles cleared by Steel/Poison types |  | TODO |  |
| I360 | Cracked walls broken by Fighting types |  | TODO |  |
| I361 | Fairy rings: step in to dance and enter a hidden grove |  | TODO |  |
| I362 | Rock climbing minigame with a Rock type partner |  | TODO |  |
| I363 | Zip-line rides between map nodes with timing taps |  | TODO |  |
| I364 | Hot-air balloon event: steer by wind icons |  | TODO |  |
| I365 | Raft crossing with fishing along the way |  | TODO |  |
| I366 | Campfire map light reveals nearby unseen nodes |  | TODO |  |
| I367 | Fog banks hide nodes until cleared by a Flying or Psychic type |  | DONE | src/scenes/MapScene.ts:354 foggedAt/isFogged, core/world sightRange (Flying/scout see further) |
| I368 | Campsite night watch assignments with random events |  | TODO |  |
| I369 | Footprints: follow tracks to hidden wild Pokémon |  | PART | events.json legend-clue-tracks / form-clue-tracks / hunt-clue-* lead to lair |
| I370 | Weathervane: spin it to change the weather for the next battle |  | DONE | events.json weather-vane (front effect sets rain/sun for next columns) |
| I371 | Sundial puzzle at ruins |  | TODO |  |
| I372 | Lightning rod: gather storm bonus on stormy nodes |  | TODO |  |
| I373 | Avalanche escape sequence with swipe dodges |  | TODO |  |
| I374 | Tide pools reveal items only at low tide |  | TODO |  |
| I375 | Day-night toggles which map interactions are available |  | DONE | events period requirement; docs/status/camp-day-night.md (npc-meet-* by hour) |
| I376 | Seasonal events change terrain (flooded, frozen) |  | TODO |  |
| I377 | Ruins pressure plates: step in correct order |  | TODO |  |
| I378 | Mirror mazes with Psychic guidance |  | TODO |  |
| I379 | Haunted house room-by-room exploration with jump scares |  | PART | events.json haunted-house, spooky-haunted-mansion (single-room, no jump scares) |
| I380 | Bridge toll: pay with item, battle or favor |  | TODO |  |
| I381 | Signposts with riddles, answers unlock shortcuts |  | PART | events.json hidden-path-signpost (revealStops shortcut, no riddle) |
| I382 | Wandering merchant caravan that appears at random nodes |  | DONE | plaza caravanChance (plaza.json, plazaLife.json caravan section) |
| I383 | Ghost lantern parade at Halloween nodes |  | TODO |  |
| I384 | Meteor shower event: wish on shooting stars |  | DONE | events.json meteor-shower (make a wish: heal + love) |
| I385 | Volcano lava rivers need Water cooling interactions |  | PART | events.json ember-vent-1 / fiery-fallout partyType water |
| I386 | Quicksand rescue: team pulls someone out together |  | TODO |  |
| I387 | Spider webs: Fire types burn through, Bug types walk |  | TODO |  |
| I388 | Cave echo: shout to reveal hidden chambers |  | TODO |  |
| I389 | Underwater diving interludes with oxygen meter |  | TODO |  |
| I390 | Skyline cloud-hopping with Flying escort |  | TODO |  |
| I391 | Abandoned lab terminals to hack with logic puzzles |  | TODO |  |
| I392 | Arcade cabinets at hidden nodes |  | PART | events.json game-corner, slot-machine, voltorb-flip |
| I393 | Graffiti walls: paint to unlock hint arrows |  | TODO |  |
| I394 | Gravity wells in space-themed Ultra Space nodes |  | TODO |  |
| I395 | Time-rift nodes alter seeds to preview alternate outcomes |  | TODO |  |
| I396 | Portal puzzle switches lead to warp nodes |  | TODO |  |
| M93 | **Wandering trainer**: a trainer follows you and challenges after a few nodes. |  | TODO |  |
| M94 | **Landmarks**: unique per-region nodes with persistent effects for the rest of the run. |  | TODO |  |
| M95 | **Branching event outcomes**: past choices change which event variants appear later. |  | DONE | events.json choice effect + callback requires (strangers-map -> strangers-map-lair) |
| F65 | Day/night cycle per run affecting encounters. |  | DONE | src/core/clock.ts run clock, balance.clock.periodTypes wild shift; docs/status/camp-day-night.md |
| F68 | Campfire stop: rest, cook berries into buffs. | Y (Comes with Berry Rework) | DONE | events.json camp-checkpoint/camp-prepare; docs/status/camp-day-night.md |
| F70 | Caravan shop that appears randomly with unique stock. |  | DONE | docs/status/trainer-plaza-rework.md + plazaLife.json caravan, stock changes every stage |
| F73 | Biome-themed map backgrounds with parallax. |  | DONE | src/scenes/MapScene.ts:195 parallax scenery |
| F74 | "Danger level" slider for the whole run with score multiplier. | N, but: N (Fuck you Quinton) | PART | docs/plans/coverage-tracker.md Phase E1 5 difficulties + multiplier (no slider) |
| F75 | Checkpoint save-and-quit with a gentle "resume" banner. |  | PART | src/scenes/MainMenuScene.ts:39 Continue from latest slot with run card |
| F85 | Map legend overlay with icon meanings. |  | TODO |  |
| F87 | Treasure maps item revealing a hidden node. | Y (But make it item + detour) | PART | events.json strangers-map (map to legendary lair, no item+detour) |
| F89 | Run recap with a timeline of key moments. |  | PART | src/core/recap.ts buildRecap highlights (no timeline) |
| F92 | Random travelling NPCs who follow you across layers. |  | PART | events.json convoy-* escorts, companion-meet (3 stretches) |
| F93 | Seasonal map skins tied to real-world date. |  | TODO |  |
| F95 | Auto-scroll map toward the current node on resume. |  | TODO |  |

## W5 NPCs, shops & story (69)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I108 | Shopkeeper remembers your loyalty and offers a mystery discount |  | TODO |  |
| I109 | Gift an NPC an item to raise friendship and unlock a secret shop tier |  | TODO |  |
| I110 | Share a meal with a traveler for a rumor about the next map |  | TODO |  |
| I111 | NPC asks you to deliver a note to another map node |  | DONE | events.json deliver-letter (keyItem letter delivered to a node) |
| I112 | Escort mission: lead a lost child NPC to the next stop |  | DONE | events.json convoy-lost-children (escort convoy to the gym) |
| I113 | NPC pickpocket attempt: tap to catch the thief before the item vanishes |  | PART | events.json pickpocket (speed check chase, no tap) |
| I114 | Fortune teller: draw three cards, each affects the next battles |  | TODO |  |
| I115 | Tell a story to the campfire group for random buffs |  | PART | events.json tale-storyteller (campfire tale trade for friendship/research) |
| I116 | Duel invitation by challenge glove throw, accept or refuse |  | TODO |  |
| I117 | Beg for mercy from a trainer who could out-level you, a Charm check |  | TODO |  |
| I119 | Apprentice NPC follows you for a node and learns from your choices |  | TODO |  |
| I120 | NPC rival of the shop: two merchants compete, buy from one and the other grumbles |  | TODO |  |
| I121 | Barter with items, not money, at secret markets |  | TODO |  |
| I122 | Ask for directions: NPCs may lie depending on mood |  | TODO |  |
| I123 | NPC asks you to recommend a team for their trainer, you pick and they use it later |  | TODO |  |
| I124 | Wedding encounter: sign the guestbook, gain luck |  | TODO |  |
| I125 | Funeral encounter: pay respects, unlock lore and a relic |  | TODO |  |
| I126 | Street performer: tip to hear a song that applies a team-wide aura |  | TODO |  |
| I127 | Chef NPC: cook together with a timing minigame to produce buff meals |  | TODO |  |
| I128 | Doctor NPC: negotiate priced treatments for status ailments |  | TODO |  |
| I129 | Professor check-in: bring discoveries and receive research rewards |  | DONE | events.json professors-lab (show Pokedex for research) |
| I130 | Gym leader dialogue trees before the badge fight affect their lead choice |  | TODO |  |
| I131 | Elite-four members respond to your badge count with custom lines |  | TODO |  |
| I132 | Spy NPC: trade secrets with a masked stranger for one-time intel |  | TODO |  |
| I133 | Mentor NPC teaches a technique after an optional quiz of Pokémon trivia |  | TODO |  |
| I134 | Tournament registration desk with a clerk who comments on your past runs |  | TODO |  |
| I135 | NPC remembers whether you spared or crushed them last time |  | TODO |  |
| I136 | Trainers react to your team's type coverage with taunts or praise |  | TODO |  |
| I137 | Pen-pal NPC mailbox: letters arrive between runs with small gifts |  | TODO |  |
| I138 | Hire a guide for the next route; they reveal one hidden node |  | DONE | events.json fog-guide (hire guide: scout columns) |
| I139 | Offer a swap: pick a Pokémon to trade with an NPC who has a quirky history |  | TODO |  |
| I140 | NPC asks you to hold their egg, hatch it for a reward |  | DONE | events.json egg-cradle-find/night/hatch |
| I141 | Cooking contest judge scores your dish with a reaction montage |  | TODO |  |
| I142 | Dance-off with a festival NPC, matching arrows for a boon |  | PART | events.json dancing-lessons (speed check) |
| I143 | Carnival game booths: ring toss, shooting gallery, bobbing for berries |  | PART | events.json ball-toss, voltorb-flip, fishing-derby |
| I144 | Fishing buddy NPC shares tips and locations of rare spawns |  | TODO |  |
| I145 | Detective NPC: gather clues across nodes to solve a small mystery |  | PART | events.json eventClues counter chains (md-*, tower) |
| I146 | Gossip network: speaking to NPCs updates a rumor board in the Hub |  | PART | plazaLife.json rumors section (Plaza, not Hub board) |
| I147 | Pick a side in an NPC argument; the loser leaves, winner gifts |  | TODO |  |
| I148 | NPC offers a risky loan, repay within X nodes or face a debt-collector battle |  | TODO |  |
| I149 | Insurance NPC: pay to protect one Pokémon from permadeath this run |  | TODO |  |
| I150 | Pawn shop: appraise relics with a loupe minigame |  | TODO |  |
| I151 | Barkeep: ask for the "usual", daily special changes by seed |  | TODO |  |
| I152 | NPC guard asks a riddle, solving it grants entry |  | TODO |  |
| I153 | Language barrier NPC: decode sign language icons to trade |  | TODO |  |
| I154 | Tour guide narrates a landmark with bonus lore if you stay |  | TODO |  |
| I155 | Blind NPC asks you to describe the scene; descriptions shape reward |  | TODO |  |
| I156 | Retired champion shares a secret move hint after you win a spar |  | TODO |  |
| I157 | Mimic NPC: a Ditto in disguise, you can spot it by clues to avoid a trap |  | DONE | events.json ditto-impostor (spot the Ditto) |
| I158 | NPC rival pair you can set up as friends or enemies |  | TODO |  |
| F156 | Branching dialogue with trust meter per NPC. |  | PART | events.json mentor trust (mentor-*), no general per-NPC meter |
| F158 | Recurring merchant with memorable personality and a running arc. |  | PART | trainer-plaza-rework.md regulars/Gilded Merchant; merchant-remembers event |
| F159 | Lore fragments collected per run, assembling a codex. | ASK: Idk bru sounds cool | PART | docs/status/moment-codex.md (account codex, not per-run fragments) |
| F160 | Legendary whispers: hints appear before a legendary encounter. |  | DONE | events.json legend-clue-tracks/song/scales (flag legend-clue before legend-encounter) |
| F161 | NPC quests spanning multiple runs. | Y (but they can’t remember player) | TODO |  |
| F162 | Morality-lite choices with visible consequences. |  | DONE | events.json Lasting Choices (road-fork, strangers-map choice effects, callbacks) |
| F165 | Trainer class backstories shown on the select screen. |  | TODO |  |
| F166 | Epilogue screens by ending achieved. |  | DONE | src/core/ending.ts:18 buildEpilogue by ending |
| F167 | New Game+ story variants. |  | TODO |  |
| F168 | Secret ending requirements as a hint-puzzle. |  | TODO |  |
| F169 | In-world newspaper recapping the world after each run. | ASK: H | TODO |  |
| F170 | Rumour mill: shops sell rumours that foreshadow events. |  | PART | plazaLife.json rumors (rumour about next gym) |
| F171 | Pokémon diary snippets after evolutions. |  | TODO |  |
| F174 | Ally NPC assists in a battle once per run. |  | PART | events.json borrowed-ally (ally in battle) |
| F176 | Mentor character who gives tips based on your play style. |  | TODO |  |
| F177 | Time-limited story events tied to dates. |  | DONE | core/gameEvents.ts + balance.clock.specialDates (camp-day-night.md) |
| F178 | Credit scene with sprites of everything defeated. |  | TODO |  |
| F179 | Dialog speed setting and auto-advance. |  | DONE | src/core/settingsRegistry.ts:105-108 textSpeed, autoAdvance, messageDelay |
| F180 | Skip-seen dialogue toggle. |  | TODO |  |

## W6 Rivals, legacy & ghosts (37)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I159 | Rival texts you after major wins with taunts or support |  | TODO |  |
| I160 | Rival sends a care package if their relationship score is high |  | PART | events.json rival-gift (rival ally hands trained Pokemon); docs/status/rival-gift-swap.md |
| I161 | Rival leaves a note on the map after passing through a node first |  | TODO |  |
| I162 | Rival sabotages a shop by buying out stock if hostile |  | TODO |  |
| I163 | Rival tag-team encounter: temporarily ally against a common boss |  | DONE | src/core/raid/rivalAlly.ts named rival strikes raid boss; src/core/rivals/living.ts:71 finaleAssistRival |
| I164 | Rival asks for advice on a team choice, your answer changes their roster later |  | TODO |  |
| I165 | Rival challenges you mid-event to a one-turn duel for bragging rights |  | PART | docs/status/coverage-tracker.md:217 unscheduled rival challenge (rivals/transfer.ts); not one-turn duel |
| I166 | Rival holds a grudge when you steal their catch spot |  | TODO |  |
| I167 | Rival visits your Hub and comments on trophies |  | DONE | src/core/rivals/living.ts:123 hubRivalNote visit comments on trophies; src/scenes/HubScene.ts:280 |
| I168 | Rival gives you a berry before a boss and you feel the weight of gratitude |  | TODO |  |
| I169 | Rival's Pokémon greet your Pokémon with emotes before battles |  | TODO |  |
| I170 | Rival's gift can be a trap if their trust is low |  | TODO |  |
| I171 | Rival rescue: save them from a wild horde to flip their attitude |  | DONE | events.json living-rival-rescue + rival-asks-help; docs/status/living-rival.md |
| I172 | Rival coaching: they critique your last battle log |  | TODO |  |
| I173 | Rival race minigame to reach a node first for first pick of items |  | TODO |  |
| I174 | Rival trades a Pokémon with you at an event |  | DONE | events.json rival-swap (trade party member); docs/status/rival-gift-swap.md |
| I175 | Rival eavesdrop scene: you overhear their plans, choose to act or ignore |  | TODO |  |
| I176 | Rival's mood changes with your win streak, shown by a portrait expression |  | TODO |  |
| I177 | Rival's mentor shows up if you wrong them |  | TODO |  |
| I178 | Rival joins the final boss as surprise helper if friendship is max |  | DONE | src/core/rivals/living.ts:71 finaleAssistRival, final boss assist for friend rival |
| I179 | Rival memorial if they fall in a hard mode, with a bonus relic |  | TODO |  |
| I180 | Rival picks a nickname for you that persists between runs |  | TODO |  |
| I181 | Rival shares a drink after a close fight, revealing a secret move |  | TODO |  |
| I182 | Rival's scoreboard: head-to-head record shown in Hub |  | PART | src/scenes/HallOfFameScene.ts:118 Rival Hall of Fame (met N x, badges); no head-to-head record |
| I183 | Rival mind games: bait you with a fake lead Pokémon |  | TODO |  |
| I184 | Rival's Pokémon wins and gloats; losing triggers training montage |  | PART | events.json living-rival-montage; src/core/rivals/narrativeDefeat.ts (rival win), no gloat/montage on loss trigger |
| I185 | Rival writes a letter at run's end in their own voice |  | PART | src/core/rivals/living.ts:102 rivalLetter shown in Hub after a run; not an end-of-run screen |
| I186 | Rival cosplay event: they copy your team and you copy theirs |  | TODO |  |
| I187 | Rival promise: they ask for a rematch at a specific node, kept across runs |  | TODO |  |
| M99 | **Rival adaptation**: the rival counter-picks based on your last team's types. |  | DONE | src/core/rivals/adapt.ts:63,86 rival swaps member to resist player's most-used type |
| M113 | **Seeded rival run**: replay a ghost of a previous run's team as a rival boss. |  | DONE | src/core/memories/encounters.ts ghost trainer/Previous-Run Gauntlet; docs/status/memories.md |
| M114 | **Hall of memories**: past runs leave a "memory" the hub can replay as short story vignettes. |  | DONE | src/scenes/MemoriesScene.ts Hall of Memories vignettes; src/core/memories/journal.ts |
| F30 | Mirror matches: fight a ghost of your own previous winning team. |  | DONE | events.json living-rival-clash (recorded Hall of Fame team / past run team); memories ghost trainers |
| F118 | Legacy: choose one Pokémon to pass to the next run as an egg. | Y (But make it only appear at Daycare/Ranch events) | PART | src/core/memories/heirloom.ts Legacy Egg for next run; not limited to Daycare/Ranch events |
| F126 | Rival rivalry ledger showing win/loss history. |  | PART | src/scenes/HallOfFameScene.ts:118 Rival Hall of Fame; src/core/rivals/chronicle.ts |
| F157 | Rival letters between runs summarising their progress. |  | DONE | src/core/rivals/living.ts:102 rivalLetter with badge progress, shown in Hub |
| F173 | Cameo trainers from past runs appear as allies. |  | TODO |  |

## W7 Hub & meta progression (66)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I240 | Walk the Hub, each building has an animated entry bounce |  | TODO |  |
| I241 | Garden: water and harvest berries that carry into runs |  | TODO |  |
| I242 | Training dojo: spar with a dummy to tweak move practice |  | TODO |  |
| I243 | Library: read lore books, quiz reward |  | TODO |  |
| I244 | Trophy room: polish trophies with a rub minigame |  | TODO |  |
| I245 | Bulletin board: pin contracts and weekly events |  | PART | HubScene.ts Event Hall: weekly event + Contract Board (list, no pinning) |
| I246 | Mailbox: letters from rivals, NPCs and Pokémon |  | PART | Hub rival letters only (hubRivalNote); no general mailbox |
| I247 | Radio tower: choose a broadcast for next-run modifiers |  | TODO |  |
| I248 | Kitchen: prepare run snacks with a recipe puzzle |  | TODO |  |
| I249 | Workshop: craft balls, repair gear |  | TODO |  |
| I250 | Greenhouse: raise evolving plants like Oddish bulbs |  | TODO |  |
| I251 | Aquarium: feed and decorate for Water-type bonds |  | TODO |  |
| I252 | Observatory: stargaze to choose next-run omen |  | TODO |  |
| I253 | Hot spring: bond-and-heal session between runs |  | TODO |  |
| I254 | Fireplace: sit with team, each chat is a short vignette |  | TODO |  |
| I255 | Arcade corner: playable mini versions of battle and rhythm modes |  | TODO |  |
| I256 | Photo studio: backdrops and poses for team photos |  | TODO |  |
| I257 | Wardrobe: mirror shows trainer outfits with a twirl |  | TODO |  |
| I258 | Pet corner: boxed Pokémon roam, you can play with them |  | TODO |  |
| I259 | Gym replica: practice battles with ghost data of earlier opponents |  | TODO |  |
| I260 | Museum of relics: place found relics on pedestals to unlock set bonuses |  | TODO |  |
| I261 | Costume shop: tailor adjusts outfits with a measuring minigame |  | TODO |  |
| I262 | Daycare: leave a Pokémon, collect eggs with surprising parentage |  | TODO |  |
| I263 | Mirror room: meet a ghost version of your last run team |  | TODO |  |
| I266 | Stage: perform contests to win ribbons |  | TODO |  |
| I267 | Cinema: rewatch best battles as replays |  | PART | docs/status/memories.md Battle Replay (text only) |
| I268 | Bakery: baked goods give pre-run buffs, ovens ding with timing |  | TODO |  |
| I269 | Tea room: pour tea for an NPC guest to hear a secret |  | TODO |  |
| I270 | Rooftop: watch weather forecast and choose a lucky charm |  | TODO |  |
| I271 | Basement: secret door unlocked by a code of Pokémon cries |  | TODO |  |
| I272 | Trainer wall of fame: sign the wall with a graffiti stylus |  | TODO |  |
| I273 | Wishing tree: hang tags that affect next-run RNG flavor, not rolls |  | TODO |  |
| I274 | Shrine: offer relics for blessings |  | TODO |  |
| I275 | Pond: skip stones for tiny luck |  | TODO |  |
| I276 | Cat/Meowth café: Meowth-line staff sells coins for chores |  | TODO |  |
| I277 | Hub weather mirrors the last run result (storm after defeat) |  | TODO |  |
| I278 | Hub decorations unlocked per achievement can be dragged anywhere |  | TODO |  |
| I279 | Hub pets follow your cursor |  | TODO |  |
| I280 | Guestbook records past visitors from friends' ghost data |  | TODO |  |
| I281 | Hub phone: call NPCs for chat and favors |  | TODO |  |
| I282 | Lost & found box: items dropped in runs return here |  | PART | src/core/memories/keepsakes.ts lost-and-found items return via Auction/desk event, not Hub |
| I283 | Costume contest: show off team outfits for NPC votes |  | TODO |  |
| I284 | Seasonal Hub swaps (snow, cherry blossom, Halloween) with new interaction props |  | TODO |  |
| I285 | Tutorial garden: interactive explanations by Professor in minigame form |  | TODO |  |
| I286 | Hub night mode: fireflies to catch for tiny gifts |  | TODO |  |
| I287 | Secret passage under the bed leading to developer room jokes |  | TODO |  |
| I288 | Statue puzzle: rotate Pokémon statues to open vault |  | TODO |  |
| I289 | Elevator panel with floor buttons that each show a mini scene |  | TODO |  |
| I290 | Time machine room: replay past events with different choices |  | TODO |  |
| F29 | Practice dummy at the Hub to test movesets without risk. |  | TODO |  |
| F96 | Hub furniture shop to decorate your room. |  | TODO |  |
| F97 | Trophy shelf for boss kills and mastery. |  | PART | HallOfFameScene.ts champion teams/records; no per-boss shelf |
| F98 | Hub NPC roster that grows with achievements. |  | TODO |  |
| F99 | Daily login quest board (offline-safe, local time). |  | TODO |  |
| F102 | Cosmetic trails for the map cursor. |  | TODO |  |
| F103 | Title banners ("Dragon Tamer") equipped on the trainer card. |  | DONE | HubScene.ts Wardrobe room: title and card frame on trainer card |
| F104 | Achievement popups with art and rarity tiers. |  | PART | src/ui/achievementToast.ts toast banner; achievements have tier field |
| F105 | Statistics page: total runs, best streak, favourite type. |  | PART | HubScene.ts:1537 Trainer Card runs/wins/best; no favourite type page |
| F106 | Run history list with filter/sort and replay seed copy. |  | PART | HubScene.ts:1583 openHistory run list with seed; no filter/sort/copy |
| F110 | Music jukebox with all unlocked tracks. |  | TODO |  |
| F112 | Cutscene replay theatre. |  | TODO |  |
| F114 | Hub mini-games: darts, fishing pond, Memory Match. |  | TODO |  |
| F120 | Season pass-style progress track (free, offline). |  | TODO |  |
| F121 | Collections: badges, ribbons, stickers, trading cards. |  | PART | Research Room collection sets (HubScene.ts room research) |
| F127 | Gym-style badge case with per-badge perk. |  | TODO |  |
| F130 | Daily mystery gift envelope. |  | TODO |  |

## W8 Challenge modes & seeds (12)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I402 | Weekly challenge leaderboard replays with ghost trainers |  | TODO |  |
| I403 | Ghost data: friends' past runs appear as NPC rivals |  | TODO |  |
| I411 | Seed sharing: copy a seed and send it to friends for the same run |  | DONE | src/core/seedCode.ts encodeSeedCode PR1 codes; RunPrepScene.ts seed row; Hub Seed Shelf |
| M107 | **Run modifiers (mutators)**: pick optional run-wide rules (Glass Cannon, Mono-Type, Tiny Parties) for score multipliers |  | DONE | src/data/runRules.json 19 modifiers (Monotype, Limited Party...) with rewardMultiplier (rules.ts:112) |
| M108 | **Daily seed**: shared daily challenge run with fixed seed and modifiers. |  | DONE | src/core/daily.ts + rules.ts:275 dailySeed; Daily Run mode; docs/status/sweep-d-daily-run.md |
| M109 | **Weekly gauntlet**: fixed-team challenge with a leaderboard stored locally. |  | TODO |  |
| F77 | Run modifiers drafted at start (pick 1 of 3 curses/blessings). | Y (But add as mode with modifiers appearing every 5 levels) | TODO |  |
| F78 | Seeded daily run with a shared leaderboard-lite (local scoreboard). |  | PART | daily seeded run done (core/daily.ts); no local scoreboard found |
| F79 | Weekly challenge run with fixed starters and a themed ruleset. |  | TODO |  |
| F82 | Hardcore mode: permadeath with extra rewards. | Y (Nuzlocke mode + Hardcore Nuzlocke mode) | TODO |  |
| F84 | Co-op ghost: import a friend's run seed to race. | Y (Show friends actions they did in that seed) | TODO |  |
| F107 | Seed sharing via short codes. |  | DONE | src/core/seedCode.ts short codes; HubScene.ts:1297 Seed Shelf |

## W9 Live events (calendar) (228)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| E1 | Fire Week: Fire types spawn more, Burn never fails to land on bosses |  | TODO |  |
| E2 | Water Week: tide meter on every map; Water moves gain +1 priority at high tide |  | TODO |  |
| E3 | Grass Week: overgrown routes; Grass starters and Leech Seed shops |  | TODO |  |
| E4 | Electric Week: Charge counters that carry between battles |  | TODO |  |
| E5 | Ice Week: every route has a frozen lake shortcut; Hail starts every fight |  | TODO |  |
| E6 | Fighting Week: dojo stops replace Pokémon Centers; Focus Sash rewards |  | TODO |  |
| E7 | Poison Week: Toxic Swamp biome; antidote discount and Poison Point everywhere |  | PART | src/data/events.json:7479 toxic-swamp event stop |
| E8 | Ground Week: sinkhole stops that drop you a floor with a gift |  | TODO |  |
| E9 | Flying Week: sky routes skip one stop; Flying types gain evasion |  | TODO |  |
| E10 | Psychic Week: telepathy hints reveal the next enemy move once per fight |  | TODO |  |
| E11 | Bug Week: Bug Catching Contest with a size-ranked prize |  | PART | src/data/events.json:7682 bug-contest event stop (no week, no size-ranked tiers) |
| E12 | Rock Week: Hardhat trainers, fossil digs at every cave stop |  | TODO |  |
| E13 | Ghost Week: haunted stops; Ghost types swap sides at turn 5 |  | TODO |  |
| E14 | Dragon Hatchling Week: baby Dragons spawn and grow with each win |  | TODO |  |
| E15 | Dark Week: night-only map, every shop sells Dark held items |  | TODO |  |
| E16 | Steel Week: metal forge stops upgrade held items to +1 |  | TODO |  |
| E17 | Fairy Week: Fairy ring stops heal and charm wild Pokémon |  | TODO |  |
| E18 | Normal Week: Normal types get a flat stat boost; plain-vanilla challenge runs |  | TODO |  |
| E19 | Dual-Type Week: only dual types appear; STAB stacks reward |  | TODO |  |
| E20 | Mono-Type Spotlight: the game picks a random type each day for the week |  | TODO |  |
| E21 | Starter Fever Week: starters of every region spawn and evolve faster |  | TODO |  |
| E22 | Baby Pokémon Week: baby forms spawn; evolving them gives bonus XP |  | TODO |  |
| E23 | Pseudo-Legend Week: 600 BST lines appear in routes at low odds |  | TODO |  |
| E24 | Eeveelution Week: Eevee appears every stop and evolves by new triggers |  | TODO |  |
| E25 | Fossil Week: revived fossils join the shop pool with a fossil lab stop |  | PART | src/data/services.json fossil service (Fossil Restoration stop) |
| E26 | Valentine's Duo Week: double-battle runs with a partner NPC |  | TODO |  |
| E27 | Leap Day Special: once every four years, a 29th-day mythic encounter |  | TODO |  |
| E28 | April Fools Mixup: names and sprites randomly swapped for fun, no stat change |  | TODO |  |
| E29 | Cherry Blossom Picnic: picnic stops restore berries and friendship |  | PART | src/data/events.json:19637 cherry-blossom + src/data/events.json:26505 friendship-picnic |
| E30 | Pride Rainbow Parade: rainbow badge cosmetics and a parade stop for every type |  | TODO |  |
| E31 | Midsummer Night: shortest-night event with Fairy and Bug spawns |  | TODO |  |
| E32 | Fireworks Festival: Fireworks mini-game at map ends gives crit buffs |  | TODO |  |
| E33 | Back to School: Academy quizzes award TMs for correct answers |  | PART | src/data/events.json:26960 academy-exam + src/data/gameEvents.json:2197 trainer-academy (Sep 1-14) |
| E34 | Autumn Harvest Moon: berry farming and a Harvest Moon boss |  | PART | src/data/gameEvents.json:1317 harvest-festival + harvest-berry-fair event |
| E35 | Thanksgiving Feast: cook a meal stop, buffs last the whole run |  | TODO |  |
| E36 | Black Friday Sale: every shop 40 percent off but stock is random |  | TODO |  |
| E37 | Winter Solstice: longest-night event, Ghost and Dark spawn boosts |  | TODO |  |
| E38 | Christmas Eve Gift Swap: swap one item with a ghost NPC for a surprise |  | DONE | src/data/events.json:41718 christmas-eve-gift-swap (gameEvent-gated, winter festival) |
| E39 | New Moon Night: no weather, no crits, pure stat battles |  | TODO |  |
| E40 | Full Moon Rise: Moonlight moves boosted, Lunar-themed bosses |  | TODO |  |
| E41 | Eclipse Day: day and night rules flip mid-run |  | TODO |  |
| E42 | Spring Equinox: balanced rules, all four seasons' berries at once |  | TODO |  |
| E43 | Autumn Equinox: autumn forms of seasonal Pokémon |  | TODO |  |
| E44 | Friday the 13th: Ghost spawn up, crits can't be lucky or unlucky |  | TODO |  |
| E45 | Palindrome Date: dates like 11/11 trigger a mirror-battle event |  | TODO |  |
| E46 | Lunar New Year Dragon Parade: parade bosses with red-envelope rewards |  | PART | src/data/events.json:26452 lunar-lantern-walk + src/data/gameEvents.json:1585 lunar-new-year |
| E47 | Diwali Light Walk: lanterns light hidden stops on the map |  | TODO |  |
| E48 | Mid-Autumn Moon Cake: moon cake item restores PP across the party |  | TODO |  |
| E49 | Day of the Dead Remembrance: revive fainted run Pokémon once as spirits |  | TODO |  |
| E50 | Oktoberfest-style Brew Fair: berry juice contest for a team buff |  | PART | src/data/events.json:35450 berry-fest-contest in berry-festival |
| E51 | Weekend Warm-up: every Friday evening, double XP for 24 hours |  | TODO |  |
| E52 | Global Milestone Bar: all battles won this week fill a shared bar with unlockable rewards |  | TODO |  |
| E53 | Community Catch-a-thon: total captures across everyone this week unlock a legend |  | TODO |  |
| E54 | Boss Hunt: one huge boss HP bar shared across all runs |  | TODO |  |
| E55 | Type of the Day: community votes the next day's featured type |  | TODO |  |
| E56 | Daily Seed Challenge: same seed for everyone, leaderboard by score |  | PART | src/core/rules.ts:275 dailySeed + Daily mode (no leaderboard) |
| E57 | Weekly Seed Gauntlet: five fixed seeds, total score ranking |  | TODO |  |
| E58 | Ghost Run Leaderboard: race another player's recorded run as a ghost |  | TODO |  |
| E59 | Monthly Hall of Fame: top runs displayed in the Hub |  | PART | src/scenes/HallOfFameScene.ts local Hall of Fame (not monthly/global) |
| E60 | Rival Clash Event: your rival's team is another player's snapshot team |  | TODO |  |
| E61 | Community Naming Vote: vote on the name of a new in-game location |  | TODO |  |
| E62 | Shiny Hunt Week: shiny odds rise, global shiny counter on the Hub |  | TODO |  |
| E63 | Friendship Chain: link codes boost buffs for those who share them |  | TODO |  |
| E64 | Community Pokédex Drive: fill the Pokédex pages as a team for a prize |  | TODO |  |
| E65 | Global Hatch-a-thon: hatches count toward a shared egg reward |  | TODO |  |
| E66 | Worldwide Trade Day: ghost trade offers appear in every town |  | TODO |  |
| E67 | Tournament Brackets: weekly single-elimination snapshot tournament |  | PART | src/data/events.json:24511 tournament-entry..final rival circuit events (not weekly snapshot) |
| E68 | Speedrun Sprint: fastest clear of a fixed route wins cosmetics |  | TODO |  |
| E69 | No-Faint Challenge Week: flawless runs get a medal and board entry |  | TODO |  |
| E70 | Underdog Cup: only low-BST Pokémon allowed, with its own trophy |  | TODO |  |
| E71 | Blind Draft Weekend: shared draft pools, no repeats |  | TODO |  |
| E72 | Seasonal League Season: ranked ladder resets each month |  | TODO |  |
| E73 | Mentor Week: veterans' recorded advice pops up as hints for new players |  | TODO |  |
| E74 | Spectator Mode Night: watch replay of the best run of the week |  | TODO |  |
| E75 | Bounty Board: weekly global bounties on specific Pokémon |  | TODO |  |
| E76 | Community Chest: everyone's leftover items fill a lottery pool |  | TODO |  |
| E77 | Legendary Birds Sweep: all three birds roam the map in turn | N, but: N (Make it a week like Legendary Beasts/Dogs) | TODO |  |
| E78 | Legendary Beasts Chase: Raikou, Entei, Suicune keep running each stop | N, but: N (Already Legendary Beast/dogs week) | DONE | src/data/gameEvents.json:710 legendary-beasts-chase weekly + roamer-raikou/entei/suicune events |
| E79 | Weather Trio Showdown: Kyogre, Groudon, Rayquaza reshape the map |  | PART | src/data/legendaryEvents.json legend-kyogre/groudon/rayquaza (+raid versions) separate gates, not a trio week |
| E80 | Creation Trio Week: Dialga, Palkia, Giratina warp time and space rules |  | PART | legendaryEvents.json legend-dialga/palkia/giratina (separate gates) |
| E81 | Swords of Justice Duel: four Pokémon fight with shared HP |  | TODO |  |
| E82 | Tao Trio Gauntlet: Reshiram, Zekrom, Kyurem escalation |  | PART | legendaryEvents.json legend-reshiram/zekrom/kyurem (separate gates; kyurem-black/white events) |
| E83 | Mythical Mirage Day: a mythical shows up as an unwinnable illusion first |  | TODO |  |
| E84 | Ultra Beast Breach: Ultra Wormholes open mid-run |  | TODO |  |
| E85 | Paradox Tide: Paradox forms take over the wild pool |  | TODO |  |
| E86 | Tower of Legends: climb 50 floors of ranked legends |  | PART | src/data/gameEvents.json:1127 tower-of-legends (5 floors, not 50) |
| E87 | Titan Week: giant Titan Pokémon with weak-point targeting |  | TODO |  |
| E89 | Gym Leader Rematch Week: leaders return with upgraded teams |  | TODO |  |
| E90 | Elite Four Sweep: back-to-back-to-back champions for score |  | TODO |  |
| E91 | Champion Cup Weekend: bracket against past champions |  | TODO |  |
| E92 | Team Rocket Invasion: rocket grunts block routes |  | PART | src/data/events.json rocket-ambush / rocket-roadblock events |
| E93 | Team Aqua vs Team Magma Showdown: pick a side for a bonus |  | PART | src/data/events.json aqua-flood / magma-drill events (no pick-a-side bonus) |
| E94 | Team Galactic Machination: time mechanics warped by a boss |  | TODO |  |
| E95 | Team Plasma Liberation: free Pokémon from forced trade |  | DONE | src/data/gameEvents.json:874 plasma-operation weekly with 3 stops + plasma-protest event |
| E96 | Team Flare Experiment: Mega stone tests give weird buffs |  | TODO |  |
| E97 | Aether Foundation Rescue: rescue Pokémon from the lab |  | TODO |  |
| E98 | Macro Cosmos Meeting: fight the executives in a boardroom battle |  | TODO |  |
| E99 | Eternatus Vigil: the sky darkens; a slow countdown with a final boss |  | TODO |  |
| E100 | Rival Gauntlet: face every rival in one run |  | DONE | src/data/events.json:24261 rival-gauntlet-entry |
| E101 | Legendary Trainer Showcase: Red, Blue, Cynthia, Steven cameo battles |  | PART | src/data/events.json red-on-the-mountain, champion-lunch, ash-training events |
| E102 | Shadow Pokémon Outbreak: shadowed Pokémon appear and can be purified |  | DONE | src/data/events.json:32623 shadow-outbreak..shadow-purified + src/core/shadow.ts |
| E103 | Raid Day Rush: a free raid den at every stop |  | PART | src/data/gameEvents.json:397 raid-rally weekly |
| E104 | Dynamax Adventure: Max raid with a pass-and-capture loop |  | TODO |  |
| E105 | Z-Move Trial: trial stops hand out Z-crystals |  | PART | src/data/events.json:23299 z-form-trial and z-sigil events |
| E106 | Mega Evolution Showcase: Mega stones appear in shops |  | PART | src/data/events.json:1802 mega-bazaar + workshop crafts Mega Stones |
| E107 | Grand Opening Sale: new stock each day this week |  | TODO |  |
| E109 | Berry Bonanza: berry shops stock every variety |  | TODO |  |
| E110 | TM Tuesday: a fresh TM at half price every Tuesday |  | TODO |  |
| E111 | Held-Item Hurricane: held items pop up in every wild battle |  | TODO |  |
| E112 | Coupon Week: scratch coupons attach to any purchase |  | TODO |  |
| E113 | Bankruptcy Sale: shops sell everything one stop only |  | TODO |  |
| E114 | Prize Wheel Weekend: spin a wheel after every win |  | TODO |  |
| E115 | Lottery Draw: weekly run tickets give prize drawings |  | TODO |  |
| E116 | Black Market Week: shady stalls with cursed and powerful items |  | PART | src/data/events.json:1181 black-market event + market service |
| E117 | Auction House Week: bid against ghost NPCs |  | PART | services.json auction service (Auction House stop) |
| E118 | Traveling Merchant Festival: three merchants per map |  | TODO |  |
| E119 | Rental Week: borrow any Pokémon for one battle |  | PART | src/data/events.json:24198 borrowed-ally |
| E120 | Piggy Bank Event: leftover gold is doubled at run end |  | TODO |  |
| E121 | Inflation Day: prices climb but drops are better |  | TODO |  |
| E122 | Craft Fair: item crafting stops at every town |  | PART | src/core/crafting.ts + workshop service stop |
| E123 | Pokémart Loyalty Points: spend gold to earn points toward a rare gift |  | TODO |  |
| E124 | Delivery Rush: courier quests with a bonus for speed |  | PART | src/data/events.json:24783 deliver-oaks-parcel and other deliver-* events |
| E125 | Trade-In Week: swap spare Pokémon for item bundles |  | PART | src/data/events.json:11657 global-trade + trade service |
| E126 | Gacha Capsule Week: capsule stalls with rare-item pity timer |  | TODO |  |
| E127 | Nuzlocke Week: one capture per area, permadeath bonus |  | TODO |  |
| E128 | Hardcore Hour: bosses are tougher but pay triple |  | TODO |  |
| E129 | Pacifist Week: no wild battles; catch with berries and charm |  | TODO |  |
| E130 | Speed Week: turn timer on every decision, bonus for fast clears |  | TODO |  |
| E131 | Random Moves Week: everyone's moveset is shuffled |  | TODO |  |
| E132 | Random Ability Week: abilities are swapped at start of each stop |  | TODO |  |
| E133 | Reverse Type Chart: Inverse Battle rules for seven days |  | TODO |  |
| E135 | Level Cap Week: no XP beyond the next boss's cap |  | TODO |  |
| E136 | Double Trouble Week: every battle becomes a double battle |  | PART | src/data/events.json:1973 double-trouble event; doubles in src/core/battle/doubles.ts |
| E137 | Triple Threat Week: triple battle experiments |  | TODO |  |
| E138 | Solo Hero Week: a single Pokémon run with big stat boosts |  | PART | runRules.json:209 solo-run modifier |
| E139 | Mirror Match Week: every trainer fights with your own team type |  | PART | src/data/events.json:13887 mirror-match event |
| E140 | Weather Wars: weather changes each turn |  | TODO |  |
| E141 | Terrain Takeover: random terrain for each fight |  | TODO |  |
| E142 | Gravity Week: Flying moves and levitating lose immunity |  | TODO |  |
| E143 | Trick Room Week: slow Pokémon move first everywhere |  | TODO |  |
| E144 | Tailwind Week: one-side speed boost for first three turns |  | TODO |  |
| E145 | Critical Week: crit rate doubled for everyone, enemy included |  | TODO |  |
| E146 | Luck Week: miss and hit odds gently pulled toward the middle |  | TODO |  |
| E147 | One-Move Wonder: each Pokémon gets one move for the run |  | TODO |  |
| E148 | No Items Week: bag locked, but healing wells at stops |  | TODO |  |
| E149 | No Healing Week: only Pokémon Centers heal |  | TODO |  |
| E150 | Glass Cannon Week: every stat except HP is raised, HP is lowered |  | TODO |  |
| E151 | Tiny Terror Week: Small sprites, big attack boost |  | TODO |  |
| E152 | Giant Week: huge sprites, speed penalty, HP boost |  | TODO |  |
| E153 | Only Starters Week: only starter lines allowed |  | TODO |  |
| E154 | Only Fully Evolved: no NFEs allowed, higher difficulty |  | TODO |  |
| E155 | Only Unevolved Week: NFEs get an Eviolite for free |  | TODO |  |
| E156 | Gen 1 Throwback: Gen 1-only Pokémon pool with a retro skin |  | TODO |  |
| E157 | Gen 3 Throwback: Hoenn only |  | PART | runRules.json:81 single-region-dex modifier |
| E158 | Gen 5 Throwback: Unova only, animated sprites flavor |  | TODO |  |
| E159 | Sync Week: whoever leads your team sets everyone's type |  | TODO |  |
| E160 | Map Mutator Week: random mutators on each stop |  | TODO |  |
| E161 | Hidden Path Week: secret branches show up on the map |  | DONE | src/data/gameEvents.json:961 hidden-path-week (signpost/shortcut/keeper events) |
| E163 | Treasure Map Week: collect pieces to find a hidden stop |  | PART | old-sea-map-island / treasure-cache events |
| E164 | Caravan Week: a caravan follows you and sells things |  | PART | src/data/events.json:49573 convoy-merchant-cart |
| E166 | Weather Map Week: forecast tells you which node has storms |  | PART | src/data/events.json:43922 weather-vane event |
| E167 | Cave Expedition Week: underground maps with rare ores |  | PART | src/data/expeditions.json quarry/crystal-hollow expeditions |
| E168 | Island Hopping Week: ferry nodes connect maps |  | PART | src/data/events.json:8800 ss-ticket-ferry |
| E169 | Volcano Eruption: lava reshapes the map each stop |  | PART | src/data/events.json:19686 volcano-rim event |
| E170 | Earthquake Tremors: stops swap places mid-run |  | TODO |  |
| E171 | Flood Event: water routes open, land routes close |  | TODO |  |
| E172 | Blizzard Week: some stops locked until you clear a snowdrift puzzle |  | PART | src/data/events.json:19111 blizzard-pass event |
| E173 | Heat Wave: Fire types gain, fatigue accumulates |  | PART | src/data/events.json:19038 heatwave event |
| E174 | Aurora Night: aurora nodes offer rare Ice spawns |  | TODO |  |
| E175 | Mystery Dungeon Week: maze-like random floors |  | DONE | src/data/gameEvents.json:1045 mystery-dungeon-week (md-* events) |
| E176 | Safari Zone Week: no battling, catch only |  | PART | src/data/events.json:10910 safari-zone event + services.json safari + catch-carnival |
| E177 | Bug Contest Day: net catch, rank by size |  | PART | src/data/events.json:7682 bug-contest event |
| E178 | Pokéathlon Day: minigame-style athletic stops |  | PART | src/data/events.json:2402 pokeathlon event |
| E179 | Underground Week: dig stops reveal buried gifts |  | TODO |  |
| E180 | Ruins Expedition: puzzle stops with glyph decoding |  | TODO |  |
| E181 | Sunken Ship Dive: underwater stop chain |  | TODO |  |
| E182 | Sky Tower Climb: vertical map with checkpoints |  | TODO |  |
| E183 | Magical Forest Maze: loops until you find the exit rule |  | TODO |  |
| E184 | Ghost Town Visit: ghost NPCs at every stop with stories |  | DONE | src/data/events.json:41237 ghost-town-gate/market/hall events |
| E185 | Festival Street: stalls and games every few nodes |  | TODO |  |
| E186 | Lighthouse Beacon: stops light up on the map |  | TODO |  |
| E187 | Train Ride Special: express nodes skip a stop with a conductor puzzle |  | TODO |  |
| E188 | Campfire Tales: rest stops with story choices |  | DONE | src/data/gameEvents.json:796 campfire-tales-week + tale-* events |
| E189 | Roadside Rival: random rival ambush on route |  | TODO |  |
| E190 | Egg Tank Week: eggs hatch after N wins instead of steps |  | TODO |  |
| E191 | Shiny Charm Day: shiny odds boosted for one day |  | TODO |  |
| E192 | Mastery Marathon: mastery XP doubled for a weekend |  | TODO |  |
| E193 | Trainer Card Week: card stamps for a milestone reward |  | TODO |  |
| E194 | Stamp Rally: collect a stamp at each region type for a prize |  | TODO |  |
| E195 | Pokédex Page Week: new page unlocked daily |  | TODO |  |
| E196 | Badge Showcase: gym badges give a passive bonus for the week |  | TODO |  |
| E197 | Medal Hunt: extra achievements are active for seven days |  | TODO |  |
| E198 | Cosmetic Drop Week: one wardrobe item drops per win |  | TODO |  |
| E199 | Title Week: earn new trainer titles |  | TODO |  |
| E200 | Rival Trading Cards: collectible cards from rivals |  | TODO |  |
| E201 | Nickname Contest: names rated by a judge NPC for items |  | TODO |  |
| E202 | Friendship Level Week: friendship growth doubled |  | PART | src/data/gameEvents.json:1674 friendship-festival (+50% friendship) |
| E203 | Evolution Festival: evolutions give bonus items |  | TODO |  |
| E204 | Mega Stone Hunt: Mega stones spawn in encounter pools | strong yes | PART | data/megaStones.json; raid Mega Stone rewards; workshop crafts |
| E205 | Form Change Week: form-change items sold cheap |  | TODO |  |
| E206 | Move Tutor Tour: tutors visit every town |  | PART | services.json tutor + move-tutor event |
| E207 | Ability Capsule Week: capsules available at shops |  | PART | services.json researcher (ability swap) |
| E208 | Hidden Ability Week: HA odds raised |  | TODO |  |
| E209 | Nature Mint Week: mints in all shops |  | TODO |  |
| E210 | IV Training Week: stat training minigames |  | PART | src/data/events.json:17365 ev-trainer + dojo service |
| E211 | EV Boot Camp: train a stat in the camp stops |  | TODO |  |
| E212 | Contest Spectacular: Pokémon Contests as a side event |  | PART | src/data/events.json:2479 contest-hall event |
| E213 | Showcase Week: show off your best Pokémon to earn a rare prize |  | TODO |  |
| E214 | Pokémon Photography Week: take in-game snapshots for scores |  | TODO |  |
| E216 | Welcome-Back Bundle: lapsed players return to a gift and a streak freeze |  | TODO |  |
| E217 | Login Streak Calendar: 28-day calendar with a rare prize |  | TODO |  |
| E218 | Daily Quest Boards: three small goals per day |  | PART | src/core/contracts.ts Contract Board (3 daily + 2 weekly goals) |
| E219 | Weekly Mission Pass: free pass track with cosmetic rewards |  | TODO |  |
| E220 | Anniversary Gift: the game's birthday brings a limited reward |  | TODO |  |
| E221 | Patch Day Party: the first day after an update gives a small gift |  | TODO |  |
| E222 | Feedback Fortnight: players answer surveys for cosmetics |  | TODO |  |
| E223 | Beta Playtest Week: experimental modes behind a toggle |  | TODO |  |
| E224 | Developer Spotlight Day: dev commentary battles |  | TODO |  |
| E225 | Accessibility Week: showcases motion, color, and audio options |  | TODO |  |
| E226 | Photo Mode Weekend: pause and frame screenshots for a contest |  | TODO |  |
| E227 | Audio Fest: remixed music tracks for a week |  | TODO |  |
| E228 | Retro Filter Week: CRT or Game Boy filter with a bonus |  | TODO |  |
| E229 | Dark Mode Dusk: UI theme swap with a themed reward |  | TODO |  |
| E230 | Language Learning Week: Pokémon names in another language for bonus |  | TODO |  |
| E231 | Streamer Mode Day: spoiler-safe hints and chat-vote mode |  | TODO |  |
| E232 | Chat Hat Week: new text-speech quirks for NPCs |  | TODO |  |
| E233 | Mod Showcase Week: community-made content on display |  | TODO |  |
| E234 | Bug Bounty Day: report glitches in-game for a reward |  | TODO |  |

## W10 Set-piece events, quests & misc (63)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I397 | Choose-your-own-adventure chains with branching consequences |  | DONE | events chains: stranded-trainer (src/data/events.json:36049) -friend/-revenge, rival-asks-help-repaid/-grudge |
| I398 | Quest board hand-ins with a stamp ceremony |  | PART | plaza Errands/Trade board (src/core/plaza/flow.ts) + trainer quests |
| I399 | Bounty hunts: track a named wild Pokémon through map rumors |  | DONE | src/data/events.json:24307 hunt-clue-* + hunt-lair chain |
| I400 | Contract negotiation: pick between risky/safe contracts with sliders |  | TODO |  |
| I401 | Daily fortune cookie at the Hub, tap to crack |  | TODO |  |
| I404 | Community gift codes from posters unlock cosmetics |  | TODO |  |
| I406 | Meta-currency donation drive: spend to fund Hub upgrades with progress bar |  | TODO |  |
| I407 | Achievement toast taps open the story behind them |  | TODO |  |
| I408 | Photo contest events using the album |  | TODO |  |
| I410 | Konami-style code entries produce harmless jokes |  | TODO |  |
| I412 | Ritual summoning with ingredient selection for boss variants |  | TODO |  |
| I413 | Oath system: swear a challenge oath at a shrine for extra rewards |  | TODO |  |
| I414 | Trade-in tokens for exotic events |  | TODO |  |
| I415 | Voting booth events where Pokémon vote on direction |  | TODO |  |
| I416 | Court case event: you defend a Pokémon accused of damage |  | TODO |  |
| I417 | Treasure hunts based on riddles in lore books |  | PART | src/data/minigames.json treasure-hunt (hints), not lore books |
| I418 | Seasonal festivals with mini-games per day |  | TODO |  |
| I419 | Festival fireworks require lighting sequence correct |  | TODO |  |
| I420 | Fishing tournament with leaderboard |  | PART | src/data/events.json:16739 fishing-derby + fishing-challenge minigame (no leaderboard) |
| I421 | Cooking tournament with ingredient draft |  | TODO |  |
| I422 | Dance competition using rhythm arrows |  | PART | minigames.json rhythm-challenge + src/data/events.json:11567 dancing-lessons |
| I423 | Hide-and-seek event with a legendary Pokémon |  | TODO |  |
| I424 | Escape room event with locked doors and clues |  | TODO |  |
| I425 | Heist event: plan roles and execute in steps |  | TODO |  |
| I426 | Trial of choices: the Hall of Mirrors reflects your past decisions |  | TODO |  |
| I427 | Charity events where giving earns future favor |  | TODO |  |
| I428 | Mercy event: spare a wounded rare Pokémon or catch it |  | PART | src/data/events.json:33720 hurt-wanderer carry/leave choice |
| I429 | Haunted trade event: ghost trader demands a sacrifice |  | PART | src/data/events.json:41284 ghost-town-market trade a memory |
| I430 | Black-market auction: bid with items against NPC bidders |  | PART | services.json auction (bid money; no NPC bidders) |
| I431 | Game show: answer Pokémon trivia questions with lifelines |  | PART | src/data/events.json:13604 quiz-master + minigames.json knowledge-quiz (no lifelines) |
| I432 | Lottery stand: scratch card minigame |  | PART | src/data/events.json:16524 scratch-card event |
| I433 | Detective mystery: examine scene, interview NPCs, accuse the culprit |  | TODO |  |
| I434 | Time-loop village: relive the day until you solve a puzzle |  | TODO |  |
| I435 | Tutorial skipping dialogue where the Prof reacts to your skip |  | TODO |  |
| I436 | Reputation system with towns: greetings and discounts shift |  | PART | src/core/plaza reputation with discounts (plaza.json) |
| I437 | Karma interactions: kindness/cruelty choices recorded and echoed in endings |  | PART | src/core/attributes.ts goodEvil meter + src/data/events.json:20383 it-saw-what-you-did |
| I438 | Oracle prophecies that come true in later nodes if conditions are met |  | TODO |  |
| I439 | Dream sequences revealing memories after rest |  | PART | src/data/events.json:5868 weird-dream / dream-mist events |
| I440 | Cursed treasure event with moral choice |  | TODO |  |
| I441 | Rescue mission: save captured Pokémon from poachers |  | DONE | src/data/events.json:27261 poacher-hideout free-the-Pokemon + trapped-pokemon |
| I442 | Poacher confrontation with dialogue options and combat |  | DONE | src/data/events.json:27261 poacher-hideout Challenge the poachers (dialogue + battle) |
| I443 | Archaeology dig with brush-and-chisel minigame |  | PART | minigames.json fossil-excavation dig minigame |
| I444 | Museum heist reversal: return stolen relics |  | TODO |  |
| I445 | Legendary shrine puzzle where Pokémon cries are used as keys |  | TODO |  |
| I446 | Sky pillar ascent with obstacle dodging |  | TODO |  |
| I447 | Final boss pre-fight conversation tree changing the fight's rules |  | TODO |  |
| I495 | Weather-based petting: rain makes Pokémon snuggle under the trainer's umbrella |  | TODO |  |
| I496 | Tap a wild Pokémon silhouette on the map to hear its cry before engaging |  | TODO |  |
| I497 | Rename a node on the map; the label shows up in later runs' ghost data |  | TODO |  |
| I498 | Share an umbrella with an NPC during a storm event for a friendship bump |  | TODO |  |
| I499 | Pokémon waves goodbye at the Hub gate as you depart on a new run |  | TODO |  |
| I500 | Tap-to-wave at passing NPC caravans; each wave may drop a trinket |  | TODO |  |
| I501 | Letter-writing: write a short note to your future self, read it on the next run's start |  | TODO |  |
| I502 | Teach a parrot-like Pokémon a phrase that it repeats at random battle moments |  | TODO |  |
| I503 | Hand over your last berry to a hungry foe to end a fight peacefully |  | PART | src/data/events.json:39232 starving-wild Feed it a berry |
| I504 | Return a lost item to its owner NPC for a surprise reward later |  | DONE | src/data/events.json:25156 return-lost-item + src/data/events.json:35335 lost-and-found-desk |
| I505 | Group chant before the final boss: all party members voice a line in sequence |  | TODO |  |
| I507 | Hold the lead Pokémon's hand (pointer) while crossing scary nodes for a fear shield |  | TODO |  |
| I509 | Wish upon a Hub star at night; next morning a small gift appears |  | TODO |  |
| I510 | Tap a sleeping NPC to eavesdrop on their dream, giving a hint |  | TODO |  |
| I511 | Ring a bell at shrines with timing for a stronger blessing |  | TODO |  |
| I512 | Give the egg a name; the hatched Pokémon greets you by it |  | TODO |  |
| I513 | Cheer from the sidelines in a rival-vs-rival match to affect their morale |  | TODO |  |

## W11 UI, accessibility & presentation (57)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| I448 | Every button bounces, squishes and plays a soft chime (Frutiger Aero feel) |  | PART | src/ui/wiiMotion.ts hover/press bounces (no chime) |
| I449 | Hold-to-confirm on risky actions with a ring fill |  | TODO |  |
| I450 | Swipe gestures on mobile for switch / run / bag |  | TODO |  |
| I451 | Haptic buzz patterns tied to move types on supported devices |  | TODO |  |
| I453 | Cursor trails of sparkles that vary by region |  | TODO |  |
| I454 | Hover cards that tilt in 3D toward the mouse |  | TODO |  |
| I455 | Drag-and-drop party ordering with elastic snap |  | TODO |  |
| I456 | Right-click/long-press context menus on Pokémon | ASK: T | TODO |  |
| I457 | Quick-swap hotkeys 1–6 for party members |  | TODO |  |
| I460 | Ctrl-click compare two Pokémon side by side |  | TODO |  |
| I461 | Undo last non-RNG menu action in the party screen |  | TODO |  |
| I462 | Tooltip chains: click a keyword in a tooltip to see its entry |  | TODO |  |
| I465 | Reduced-motion mode keeps feedback as static highlights |  | DONE | src/core/accessibility.ts reducedMotion profile + battleAnimations reduced |
| I466 | One-handed play layout toggles |  | TODO |  |
| I467 | Auto-battle toggle with interruption prompts at key moments |  | PART | src/core/battle/autoBattle.ts autoBattleProblem; settingsRegistry autoBattle toggle |
| I468 | Speed dial: fast-forward animations in halves |  | PART | settingsRegistry.ts battleSpeed setting |
| I469 | Skip-cutscene hold with progress ring |  | TODO |  |
| I470 | Interaction log: view recent choices and results |  | TODO |  |
| I471 | Pin a Pokémon's detail card as a floating overlay |  | TODO |  |
| I472 | Notification stack with swipe-away bubbles |  | TODO |  |
| I473 | Mini-map ping: click to mark nodes with icons |  | TODO |  |
| I475 | Custom sound bank: choose which jingle plays for victories |  | TODO |  |
| I477 | Pet-the-menu easter egg: tapping the logo makes Pokémon peek in |  | TODO |  |
| I478 | Dialogue skip vs savour: hold to show the full backlog of lines |  | TODO |  |
| I479 | Context hints appear when idle too long, never intrusive |  | TODO |  |
| I480 | Lyric-style subtitles for song events |  | TODO |  |
| I481 | Interactive loading screens with tiny catch-the-Magikarp games |  | TODO |  |
| I482 | Pause menu shows team doodles animated lazily |  | TODO |  |
| I483 | Death screen offers a reflective "What if?" replay of the last choice |  | TODO |  |
| I484 | Victory screen lets you poke each Pokémon for a final reaction |  | TODO |  |
| I485 | Run summary cards flip like trading cards on tap |  | TODO |  |
| I486 | Settings screen sliders respond with preview animations |  | TODO |  |
| I488 | Daily login chest with a tap-to-shake open |  | TODO |  |
| I489 | Shake-to-undo easter egg on mobile |  | TODO |  |
| I490 | Pull-down refresh reveals a hidden mini tip |  | TODO |  |
| I491 | Window resize makes the Hub rearrange with bounce |  | TODO |  |
| I492 | Screenshot button adds a framed border and watermark option |  | TODO |  |
| I493 | Share-card export for runs with the team portrait |  | TODO |  |
| M118 | **Dynamic music layers**: battle music adds layers as momentum or phase rises. |  | DONE | src/core/presentation/musicLayers.ts layered adaptive battle music (calm/tense/boss/danger) |
| M119 | **Camera focus rules**: camera pushes in on KOs and boss phase breaks (presentation only). |  | TODO |  |
| M120 | **Aero panel moods**: the battle UI tint shifts with weather and morale, cosmetic only. |  | TODO |  |
| F181 | Frutiger Aero theme pack with glossy bubbles. |  | DONE | src/ui/aero.ts Aero glass panels, bubbles (battleUi aero) |
| F182 | DS-era touch-style menu skin. |  | TODO |  |
| F183 | Wii-channel style Hub menu with bouncy tiles. |  | PART | src/ui/wiiMotion.ts Wii-style bouncy menus |
| F184 | Cyber-Maximalism neon theme. |  | PART | src/ui/aero.ts:21 neon accent only |
| F185 | Theme swapper in settings with live preview. |  | PART | settingsRegistry.ts battleUi style selector (no live preview) |
| F186 | Controller glyph hints (Xbox/PS/Switch). |  | TODO |  |
| F187 | Full gamepad support with remap screen. |  | TODO |  |
| F189 | Mobile portrait layout and touch controls. |  | PART | src/ui/touchControls.ts on-screen pad + touchLayout rotate hint |
| F192 | Font size and dyslexia-friendly font option. |  | TODO |  |
| F193 | Reduced-flash mode. |  | DONE | settingsRegistry.ts effectIntensity (Flashes 0%) + lowFlash profile |
| F195 | Tooltips everywhere with a global hover delay setting. |  | TODO |  |
| F196 | Animated loading screens with tips. |  | PART | src/scenes/BootScene.ts:79 progress bar; ui/loadCard.ts (no tips) |
| F197 | Transition effects pack (bounce, wipe, ripple) selectable. |  | TODO |  |
| F199 | Idle animations for party members on menus. |  | PART | settingsRegistry spriteAnimations; ui/showcase.ts floatIdle |
| F200 | Screen-shake slider and per-effect toggles. |  | DONE | settingsRegistry.ts shakeIntensity slider + per-effect animation toggles |
| F201 | Damage popup scale slider. |  | PART | settingsRegistry.ts damageNumbers toggle (no scale slider) |

## W12 Tech & community tools (pending your answers) (20)

| # | Idea | Note | Status | Evidence |
|---|---|---|---|---|
| F206 | Debug overlay (FPS, RNG stream positions) behind a flag. | ASK | PART | src/debug/debugPanel.ts behind ?debug=1 (no FPS/RNG positions) |
| F207 | Save export/import as a file. | ASK | DONE | src/scenes/HubScene.ts:1604-1618 export/import save file |
| F208 | Cloud-free backup reminder. | ASK | TODO |  |
| F209 | Mod loader for JSON content packs validated by Zod. | ASK | PART | src/core/configPack.ts Zod-validated JSON packs (dialogue lines only) |
| F210 | In-game content status viewer (supported/limited/disabled). | ASK | TODO |  |
| F211 | Balance dashboard page from playtest logs. | ASK | PART | src/quality/dashboard.ts HTML dashboard (not from playtest logs) |
| F212 | Bug-report button that bundles seed, log and version. | ASK | TODO |  |
| F213 | Offline PWA install with cached assets. | ASK | TODO |  |
| F214 | Performance preset (low/med/high) toggling particles. | ASK | PART | settingsRegistry.ts reduceParticles (no low/med/high preset) |
| F215 | Asset preloader progress with per-pack status. | ASK | PART | src/scenes/BootScene.ts:79 loading progress bar |
| F216 | Replay validator that re-runs a seed and checks results. | ASK | TODO |  |
| F217 | Sandbox/Test mode with infinite gold and any Pokémon. | ASK | PART | src/debug/debugPanel.ts add Pokemon / give items (debug only) |
| F218 | Level editor for custom events using the existing schema. | ASK | TODO |  |
| F219 | Community seed board (static JSON, curated). | ASK | PART | HubScene Seed Shelf (user-kept seed codes, not curated board) |
| F220 | Changelog screen shown after updates. | ASK | TODO |  |
| F221 | Telemetry-free local analytics page for the player. | ASK | TODO |  |
| F222 | Auto-update notice for the live site. | ASK | TODO |  |
| F223 | Accessibility audit checklist page for releases. | ASK | TODO |  |
| F224 | Cheat-detection flag that tags runs as "assisted". | ASK | TODO |  |
| F225 | Press kit page generated from promo images. | ASK | TODO |  |
