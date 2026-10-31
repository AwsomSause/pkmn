# Systems A: Pokémon behavior, autonomy and individuality (SYS-A01 to SYS-A65)

Legend. Class: N new standalone, E expansion of existing, O overhaul/replacement, L linker of existing features, X experimental. C = complexity S/M/L/XL. P = priority Ess/High/Med/Low/Exp/Rare. ★F = foundation other ideas lean on. Every entry lists purpose and function, player-facing experience, dependencies, impact on existing play, balance and implementation notes. Existing code touched: `core/partyLife`, `core/bond`, `core/story/chemistry`, `core/relationships.ts`, `core/natures.ts`, `core/attributes.ts`, `core/wildBehavior.ts`, `core/battle`.

## A1. Core autonomy frameworks

**SYS-A01 Disposition Engine ★F** · N · C:L · P:Ess
Every Pokémon gets a small seeded "disposition vector" (boldness, loyalty, appetite, curiosity, temper, pride) rolled at catch and drifting with events. It is the shared input for all autonomy, dialogue and event hooks. Player sees a six-bar "Temperament" tab on the summary. Deps: `partyLife` schema, nature, seeded RNG stream `disposition`. Impact: nothing changes until other systems read it. Balance: values only bias odds (max ±15%), never gate actions. Data-driven in `balance.json`; new save field with migration defaulting to nature-derived values.

**SYS-A02 Whim Slots** · N · C:M · P:High
Once per battle each Pokémon may roll a "whim" (a tiny voluntary action) weighted by disposition: a proud one refuses to switch out, a curious one sniffs the foe and reveals its held item. Player sees a speech bubble before the turn; the effect is small and telegraphed. Deps: A01, battle turn hooks, presentation cues. Impact: adds texture, never changes outcome by more than a minor buff or minor cost. Balance: a Whim cap of one per battle per mon, ignorable with a setting ("Pokémon obey fully"). Outcome must not depend on animation.

**SYS-A03 Obedience Curve Reborn** · O · C:M · P:Med
Replaces the old badge-obedience idea with a respect curve: Pokémon above the party's "respect" level may ignore a command (rare, flavorful) unless bonded. Respect comes from wins, care, fairness. Player sees a "ignored your order" moment with a reason line. Deps: bond levels, A01, level cap decision. Impact: makes over-levelled catches feel wild. Balance: ignore chance capped at 12%, never on the turn that would lose the battle (mercy rule), toggle in Settings.

**SYS-A04 Command Voice** · N · C:S · P:Low
Commands are tagged Calm, Firm, Cheer, Plead; the same move chosen with different "voice" nudges the mon's mood (Calm helps timid ones, Firm helps proud ones, Plead drains pride). One tap on a small selector before confirming. Deps: A01, battle UI. Impact: optional layer; defaults to Calm. Balance: voice effects are mood-only (no damage change); mood feeds A05.

**SYS-A05 Mood Weather** · E · C:M · P:High
Extends the emotion system (`story/emotions.ts`) into a per-Pokémon mood that decays toward baseline and visibly colors the sprite idle (bounce, droop, shake). Moods: Sunny, Focused, Sulky, Anxious, Giddy, Heartbroken. Each applies a tiny, named battle modifier (Giddy +crit chance 3%, Sulky -accuracy 3%). Deps: emotions, A01, sprite idle anims. Impact: gives HP-independent party health. Balance: all mood modifiers stay under 5% and are shown in a tooltip.

**SYS-A06 Habit Memory** · N · C:M · P:Med
A Pokémon tracks which move it used most and starts to prefer it: after 10 uses it gains "Habit" (+5% power) but suffers "Predictable" if the foe AI has Rival Learning (hooks `rivals/adapt.ts`). Player sees a small badge. Deps: move usage stats, rival adaptation. Impact: pushes move variety. Balance: Habit breaks after a rest at a Camp; no stat loss.

**SYS-A07 Fear Responses** · N · C:M · P:Med
Species and past defeats set specific fears (a Rattata that was KO'd by Fire fears Fire). Facing the fear gives a one-turn flinch chance unless soothed by an item or a bonded ally. Player sees "Rattata trembles at the sight of Charmander." Deps: A01, memories (`core/memories`), type chart. Impact: adds tension in rematches. Balance: flinch 10% at most, one cure item (Calm Scarf), cured permanently after a victory against that type with the mon on field.

**SYS-A08 Courage Surges** · N · C:S · P:Med
The mirror of fear: when an ally falls or the party is cornered, bold Pokémon get a one-time "Courage Surge" (+1 Atk/Sp.Atk and cannot be flinched). Rolled from boldness. Player sees a short pose. Deps: A01, moment system. Impact: last-stand moments. Balance: once per battle, once per mon, never stacks with Last Stand relics.

**SYS-A09 Pride and Shame** · N · C:M · P:Med
Pride rises when a mon scores a clutch KO or beats a higher-level foe, falls when it faints to a resisted hit. High pride makes it refuse healing items once ("I can do it!"); low pride makes it hesitant (slower by 1 priority bracket occasionally). Deps: A01, battle events, item use flow. Impact: items become a conversation. Balance: refusal costs the player nothing (no turn spent); hesitation limited to 5%.

**SYS-A10 Sleep Habits** · N · C:S · P:Low
Each mon has a chronotype (early bird, night owl, nap-prone). At Camps and Hub rest, matching rest times give small bonuses and mismatches give none. Tied to the day/night clock if present. Deps: world clock, Camp stops. Impact: flavor with small PP/HP regen differences. Balance: bonus = +5% heal.

**SYS-A11 Appetite Profile** · E · C:M · P:Med
Extends berries and Poffin-like systems: every mon has favorite, neutral, and disliked flavors derived from nature plus noise. Feeding favorites raises mood and bond faster; disliked flavors cause a refusal. Deps: Natures and Mints, berries, bond. Impact: berries become gifts, not just consumables. Balance: dislike refusal never wastes the item.

**SYS-A12 Wanderlust Fidgets** · N · C:S · P:Low
On the map and Hub, idle party mons wander off the line, chase a butterfly, or pick up a small item (10% chance) and drop it in the player's bag. Pure presentation with a tiny reward from a seeded stream `fidget`. Deps: Hub follow sprites, item drop table. Impact: friendly flavor. Balance: reward is a common berry or pebble only.

**SYS-A13 Voice Boxes** · N · C:M · P:Med
Each Pokémon gets a "voice profile" (tone words, verbal tics, a catchphrase seeded by disposition and species) that dialogue and battle text pull from. Deps: A01, dialogue system. Impact: unlocks consistent character speech across 1,000+ lines. Balance: none.

**SYS-A14 Personal Quirks Deck** · E · C:M · P:High
Extends "individual quirks" idea into a drawn hand of two quirks per mon (examples: "Hates rain," "Loves the front slot," "Sleeps through the first turn of boss fights," "Gets zoomies after KOs"). Quirks have a mechanical upside and a downside, both small. Deps: A01, party order UI. Impact: roster decisions become personal. Balance: quirks come in pairs (+/-); caps on total upside.

**SYS-A15 Instinct Triggers** · N · C:M · P:Med
Species-specific instincts fire under conditions: Growlithe guards a downed ally (takes the next hit), Meowth pockets a coin on a crit, Eevee looks toward an evolution stone. A table of ~100 species instincts in data. Deps: species data pack, battle hooks. Impact: species feel distinct beyond stats. Balance: instincts add a small bonus and a visible cost.

**SYS-A16 Pack Hierarchy** · N · C:M · P:Med
Party mons form a hierarchy (alpha, second, omega) from level, wins and pride. The alpha's mood spreads to the party; omega mons get more bonding events. Player sees a crown icon. Deps: A01, chemistry. Impact: gives order-of-party meaning. Balance: alpha swap by a duel event; harmless.

**SYS-A17 Territory Marking** · N · C:M · P:Low
Wild-leaning mons mark Camp tiles; later camps reuse the mark ("Scent of Garchomp: -wild encounter rate"). Deps: Camp system, encounter director. Impact: soft run-to-run flavor. Balance: -5% wild encounters max.

**SYS-A18 Homesickness** · N · C:M · P:Med
A mon caught far from its native habitat grows homesick over many nodes; at a matching biome it perks up and gains a stat bump for the region. Deps: habitat tags, regions. Impact: a push to catch locals vs imports. Balance: bump +3% stats within one region only.

**SYS-A19 Seasonal Moods** · L · C:M · P:Low
Real or in-game seasons nudge baseline moods (spring giddy, winter sleepy) using `holiday events` data. Deps: Holiday events, A05. Impact: calendar texture. Balance: baseline shift only.

**SYS-A20 Sleepovers** · N · C:S · P:Low
Box Pokémon in the Hub can "sleep over" with each other and return with a shared story line and +small chemistry. Deps: Hub box UI, chemistry. Impact: gives benched mons relevance. Balance: +1 chemistry per night, capped.

## A2. Species-specific behaviour layers

**SYS-A21 Evolution Dread and Desire** · N · C:M · P:Med
Before evolving a mon states a stance (eager, afraid, indifferent). Eager ones evolve with a stat bonus, afraid ones need a comfort event or may "stall" evolution (opt-in toggle). Deps: evolution flow, A01. Impact: evolutions as scenes. Balance: stalling never blocks evolution, only delays it 5 levels.

**SYS-A22 Shy Species Hide** · N · C:S · P:Low
Shy species (Ditto-line, Abra, Shuckle) hide during events and only appear in the party screen after enough trust. Deps: bond, UI. Impact: a trust arc. Balance: purely cosmetic until trust 3, then a species-unique line.

**SYS-A23 Territorial Species Clash** · N · C:M · P:Med
Two territorial species in one party (Gyarados and Sharpedo) argue. A Peacekeeper item or high bond prevents a swap-out event. Deps: chemistry, event system. Impact: compositional tension. Balance: chance only at Camps; never mid-fight.

**SYS-A24 Evolution Line Siblings** · N · C:M · P:Med
Mons from the same family (Pidgey, Pidgeotto, Pidgeot) have an automatic sibling bond: shared moves learnable in cross-pollination, shared jokes. Deps: dex family data, chemistry. Impact: rewards keeping families. Balance: lessons cost EXP.

**SYS-A25 Predator-Prey Awareness** · N · C:M · P:Low
Wild AI knows predator-prey pairs; a Rattata in a party with a Persian in sight panics; Persian grows hungry. Deps: A01, chemistry data. Impact: ecological flavor. Balance: tiny stat effects, shown as lines.

**SYS-A26 Lullaby Caretakers** · N · C:S · P:Low
Soothing species (Chansey, Jigglypuff, Audino) heal the party's mood once per Camp. Deps: Camp, A05. Impact: mood utility roles. Balance: mood only.

**SYS-A27 Trickster Mischief** · N · C:S · P:Low
Trickster species (Meowth, Zorua, Mischievous nature) occasionally steal a berry from a teammate and return it later with a prank line. Never loses items permanently. Deps: item bag, memories. Impact: harmless chaos. Balance: item returned after 3 nodes, safe against event-lock.

**SYS-A28 Guardian Instinct** · N · C:M · P:Med
Protective mons (Lucario, Arcanine, Blissey) can take a hit for an injured teammate once per battle if bond is high. Deps: bond, doubles AI. Impact: tactical bond payoff. Balance: damage taken at 70%, cost to guardian in HP.

**SYS-A29 Hoarders** · N · C:S · P:Low
Hoarder species (Munchlax, Thievul, Pikachu) carry a "stash" of one random cheap item they find; the player can ask for it once per region. Deps: item drop table, Camp UI. Impact: soft item income. Balance: junk-tier only.

**SYS-A30 Chorus Species** · N · C:M · P:Low
Singing species (Jigglypuff, Meloetta, Kricketune) can harmonise: two in the party give a "Chorus" buff at the Hub and a short jingle. Deps: audio system, Hub. Impact: a collection motive. Balance: cosmetic buff plus +1 mood.

**SYS-A31 Lone Wolf Trait** · N · C:S · P:Low
Solitary species (Absol, Umbreon, Sableye) prefer being alone: reduced chemistry penalties but cannot receive assist bonuses. Deps: chemistry. Impact: a distinct build route. Balance: "no assists" is a real cost.

**SYS-A32 Nocturnal Behavior** · L · C:S · P:Med
Ghost, Dark, Bat species gain small bonuses at night encounters and at night Camps. Deps: day/night clock. Impact: time-of-day matters. Balance: 5%.

**SYS-A33 Hatchling Imprinting** · N · C:M · P:Med
A mon hatched from an egg imprints on the first party member it sees: gets that mon's favorite flavor and one move inheritance chance. Deps: eggs, party order. Impact: breeding drama. Balance: inheritance limited to existing egg moves.

**SYS-A34 Shiny Awareness** · N · C:S · P:Rare
Non-shiny Pokémon on a party with a shiny react with envy, admiration or confusion. Ties to Shiny Charm. Deps: shiny flag, dialogue. Impact: rare-content reward for shiny hunters. Balance: flavor only.

**SYS-A35 Fossil and Ancient Species Nostalgia** · N · C:S · P:Rare
Revived fossil mons react to modern Pokémon and places with era-appropriate confusion; lines stack up toward a "Time Out of Time" achievement. Deps: fossil lab, memories. Impact: charm. Balance: none.

## A3. Learning, training and growth autonomy

**SYS-A36 Self-Directed Training** · N · C:M · P:High
At Camps, each mon may "choose" a drill (speed run, endurance, move practice) based on disposition; the player can approve or redirect. Result: +small EXP or move mastery progress. Deps: move mastery, Camp. Impact: Camps become decisions. Balance: EXP value equals a minor battle.

**SYS-A37 Rival-Inspired Ambition** · L · C:M · P:Med
After a close loss, the mon sets an Ambition ("beat that Garchomp"); fulfilling it grants a unique, personalized reward (a title, a move tweak). Deps: rivals memory, titles. Impact: personal arcs per mon. Balance: titles cosmetic, tweaks small.

**SYS-A38 Move Curiosity** · N · C:M · P:Med
Mons may request to learn a specific move seen from an enemy ("Machamp wants to learn that Rock Slide"), unlocking a "witness learning" path with a trial. Deps: move learning, battle log. Impact: unusual moves from experiences. Balance: trial costs a battle.

**SYS-A39 Teaching Roles** · E · C:M · P:Med
Extends Mentorship (`story/mentorship.ts`) so any mon above level 50 can be assigned a student for a region; the student gains move hints and a bond. Deps: mentorship, levels. Impact: veteran mons get purpose. Balance: mentor loses 5% EXP gain.

**SYS-A40 Practise Streaks** · N · C:S · P:Low
Repeatedly using a move in battle without missing creates a streak that gives a mini visual flourish and small mastery credit. Deps: move mastery. Impact: reward for consistency. Balance: capped at mastery tier.

**SYS-A41 Regret and Redemption** · N · C:M · P:Med
A mon that fainted by an avoidable misplay (low-HP switch-in) carries Regret; a heroic clutch performance later redeems it into "Resolve" with a cosmetic scar mark. Deps: memory log. Impact: emotional arcs. Balance: Regret slight stat drop 3%.

**SYS-A42 Growth Spurts** · N · C:M · P:Low
Random level thresholds trigger a visible "growth spurt" (size change slider, new idle pose, sprite scale +5%). Deps: sprite scaler. Impact: physical growth visible. Balance: none.

**SYS-A43 Battle Scars and Trophies** · N · C:M · P:Med
Memorable moments leave permanent cosmetic scars or marks on the sprite (a notch from a boss, a singed tail). Deps: cosmetic overlay layer, memories. Impact: visual history. Balance: purely cosmetic; can be hidden.

**SYS-A44 Mental Stamina Pool** · N · C:M · P:Med
Each mon has a Focus pool depleted by hard decisions (switching, status moves, crits taken); at zero it makes small mistakes. Rest restores. Deps: battle, Camp. Impact: long fights matter. Balance: "mistakes" are 5% miss chance, telegraphed.

**SYS-A45 Self-Nicknaming** · N · C:S · P:Low
Mons suggest their own nickname after a milestone ("Call me Blaze."); the player may accept or keep. Seeded name pool by species. Deps: nickname field. Impact: attachment. Balance: none.

**SYS-A46 Dream Journal** · N · C:M · P:Low
After sleeping, mons log a dream seeded from their recent memories; dreams can unlock small hints or events ("dreamed of a cave behind the lake"). Deps: memories, events. Impact: lore delivery. Balance: hint only.

**SYS-A47 Bond Rituals** · N · C:M · P:Med
At bond tiers the pair performs a ritual mini-sequence (handshake, tail curl) once; it unlocks tier-specific battle bonuses. Deps: bond system. Impact: milestone moments. Balance: tier bonuses stay in the existing bond table.

**SYS-A48 Rest Preference** · N · C:S · P:Low
Some mons prefer to rest in the ball, some outside; the choice at Camp changes recovered mood. Deps: Camp, A05. Impact: small decisions. Balance: ±1 mood.

**SYS-A49 Skill Self-Assessment** · N · C:S · P:Low
The mon rates itself ("I think I'm a 7/10 on defense"); the number is the real stat tier in disguise, displayed as confidence text. Deps: stat tiers. Impact: replaces numbers with personality. Balance: none.

**SYS-A50 Body Language Layer** · E · C:M · P:Med
All idle sprites gain contextual body language: favor/anger toward the active party member via facing direction, distance in the party screen. Deps: sprite idle packs, bond. Impact: communicates relationships without text. Balance: none.

## A4. Interaction between Pokémon and the player trainer

**SYS-A51 Trainer Whistle** · N · C:S · P:Low
Pressing a key whistles; mons respond by mood (come running, ignore, sulk). Responses cost nothing and reveal mood at a glance. Deps: A05. Impact: tactile feedback. Balance: none.

**SYS-A52 Pet Interactions** · N · C:S · P:Med
Hub and Camp allow petting, feeding, brushing minigames that give bond and mood. Deps: Hub, bond. Impact: ties into the care loop. Balance: daily cap.

**SYS-A53 Argue With Your Pokémon** · N · C:M · P:Med
At decision events a mon can voice a strong opinion ("I don't like that deal."); the player may follow or override, shifting trust and pride. Deps: event system, A01. Impact: events feel like negotiations. Balance: no hard penalties.

**SYS-A54 Gifts From Pokémon** · N · C:S · P:Med
High-bond mons bring small gifts (a berry, a shiny pebble, a lost item) after battles. Seeded drops. Deps: bond, item table. Impact: warmth. Balance: gifts equivalent to a minor drop.

**SYS-A55 Trainer Mood Mirror** · L · C:M · P:Med
The trainer's run-level stress (losses, wipes) mirrors into mon moods; calm streaks lift them. Deps: run state, A05. Impact: couples player state to party emotion. Balance: ±1 mood tier.

**SYS-A56 Trust Falls** · N · C:S · P:Rare
A special mini-event only for max-bond pairs; the player falls back and the mon catches them (cutscene). Unlocks a unique dialogue set. Deps: bond max. Impact: emotional peak. Balance: none.

**SYS-A57 Misunderstandings** · N · C:M · P:Low
Miscommunication events: you call the wrong nickname, or a swap-out looks like an insult. Quick apology choice resolves. Deps: dialogue. Impact: humor. Balance: small.

**SYS-A58 Pokémon Ask For Time Off** · N · C:M · P:Low
A tired mon asks to skip the next trainer fight; granting boosts bond, refusing risks Sulky. Deps: A05. Impact: choice with cost. Balance: skipping counts as a bench slot.

**SYS-A59 Jealousy Over Time** · L · C:M · P:Med
If the player uses the same mon over and over, benched mons grow jealous of the favorite. Deps: chemistry, usage stats. Impact: pushes rotation. Balance: effect is mood only.

**SYS-A60 Pokémon Teach Each Other** · N · C:M · P:Med
Bonded mons share a technique through a "lesson" event (learn a move the other already knows if compatible). Deps: move compat table. Impact: unusual movesets. Balance: only egg-move-tier moves.

## A5. Strange and experimental autonomy

**SYS-A61 Autopilot Battles** · X · C:L · P:Exp
Optional mode where bonded mons choose moves themselves by disposition; high bond improves their picks. Used for accessibility or as a hands-off challenge. Deps: AI engine, A01. Impact: a different way to play. Balance: autopilot cannot use consumables.

**SYS-A62 Mutiny** · X · C:L · P:Exp
If the party is mistreated (repeated faints, no rest), a mutiny event pits the party against the player in a unique battle, resolved by bond. Deps: A05, chemistry. Impact: dramatic consequence. Balance: avoidable by care.

**SYS-A63 Shared Consciousness Link** · X · C:L · P:Exp
Two max-bond mons can link: damage and status are shared 50/50, and they swap perspectives in a special attack. Deps: bond. Impact: exotic synergy. Balance: link breaks when either faints.

**SYS-A64 Pokémon Politics** · X · C:XL · P:Exp
The party votes at key forks (path choices) based on disposition; the player may overrule at a trust cost. Deps: A01, map. Impact: negotiated runs. Balance: overruling cost is only social.

**SYS-A65 Last Words Archive** · N · C:S · P:Rare
When a Pokémon dies (hard mode) it leaves a final line and a keepsake, written into the run's chronicle and legacy. Deps: Legacy, memorial. Impact: emotional memory. Balance: none.
