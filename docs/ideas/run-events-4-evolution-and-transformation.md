# Run Events 4: Evolutions, Transformations and Strange Changes (RE-D01 to RE-D70)

Design only, nothing built. Part of the run-event library. Rarity C/U/R/VR/M, Size S/M/L/XL.
Uses existing evolution, form, Mega/Z/Dynamax-style, mastery and custom-evolution data. Any change a Pokémon undergoes is a run-record change, reversible only where stated, and always shown with a presentation cue (never decides the outcome by animation).

**RE-D01 Moonlight Metamorphosis** · U · M
Trigger: night node, party member that evolves by Moon Stone or friendship at night. Scene: moonbeam falls on it. Outcomes: allow (evolves), shield it (keeps form, gets a Moonlit Memory and a held Moon Shard), ask it (it decides by Bond). Reward/Cost: evolution or shard. Variations: Clefairy/Jigglypuff lines.

**RE-D02 Evolution Stage Fright** · C · S
Trigger: a member at evolution level with a timid nature. Scene: it hides. Outcomes: coax (evolves, Bond +1), wait (delay until next stage), force (evolves, Bond -2). Reward/Cost: Bond. Variations: nature-specific lines.

**RE-D03 Unstable Fusion Lab** · R · L
Trigger: lab node, two compatible Pokémon. Scene: a machine hums. Outcomes: fuse (a one-stage hybrid with both types and 80% of each's stats, then splits back), refuse, sabotage (explosion, minor harm). Reward/Cost: temp hybrid. Variations: hybrid names are comedic.

**RE-D04 Regional Form Calling** · R · M
Trigger: member of a species with a regional form, region match. Scene: it senses a place. Outcomes: let it wander (returns in regional form for the run), hold it (stays), ask a Professor. Reward/Cost: new form. Variations: needs the right region.

**RE-D05 Stone Cult Demonstration** · U · M
Trigger: a stone-lover cult stall. Scene: robes and stones. Outcomes: join the rite (cheap stone, quirky nature change), donate (rare stone), refuse. Reward/Cost: stone vs nature. Variations: cults of Thunder, Water, Fire.

**RE-D06 Trade Evolution Without Trading** · R · M
Trigger: a member that evolves by trade. Scene: a Trade Station clerk. Outcomes: a ghost-trade with a past partner (evolves; the held item is lost), pay a fee (evolves), decline. Reward/Cost: ₽. Variations: the clerk mispronounces.

**RE-D07 Cocoon Watch** · C · S
Trigger: a Metapod/Kakuna-type member. Scene: it twitches. Outcomes: keep still (Bond +1, evolves with +1 defense), poke (comedic), shelter it. Reward/Cost: stat. Variations: Bug-types.

**RE-D08 Evolution Disagreement** · U · M
Trigger: member with two evolution options (Eevee, Gloom, Poliwhirl...). Scene: the party argues which form. Outcomes: let the member decide (uses nature), vote (majority), you decide. Reward/Cost: branch. Variations: the loser sulks one stage.

**RE-D09 The Wrong Stone** · U · S
Trigger: you carry a stone for another species. Scene: a member eyes it. Outcomes: let it hold (nothing), force (a failed evolution, harmless, funny), offer to a friend. Reward/Cost: comedy. Variations: items.

**RE-D10 Delayed Growth** · C · S
Trigger: member keeps evolving-cancel input. Scene: it prefers cuteness. Outcomes: accept (permanent 'cute' tag, bonus affection), nudge, wait. Reward/Cost: Bond. Variations: some species.

**RE-D11 Evolution at the Worst Moment** · U · M
Trigger: mid-boss fight at level. Scene: glow in the middle. Outcomes: let it (extra turn but sprite change), cancel (+1 defense), use it as a stall. Reward/Cost: tactic. Variations: only once per fight.

**RE-D12 Primal Shard Humming** · VR · L
Trigger: Kyogre/Groudon-type event nearby. Scene: shard hums. Outcomes: touch (a temporary primal boost for one boss), bury, trade. Reward/Cost: temp boost. Variations: element.

**RE-D13 The Adolescent Phase** · C · S
Trigger: mid-stage evolution. Scene: new body, awkward. Outcomes: help adjust (speed -1 for a fight, then +1), laugh, ignore. Reward/Cost: stat. Variations: species.

**RE-D14 Shed and Grow** · U · S
Trigger: Ekans/Dragonair lines. Scene: shedding. Outcomes: collect the skin (item: Shed Skin), help, ignore. Reward/Cost: item. Variations: rarities.

**RE-D15 Mega Pull** · R · L
Trigger: Mega Stone in the bag and Bond high. Scene: stone resonates. Outcomes: ready it (Mega at next boss free), save, trade. Reward/Cost: Mega charge. Variations: stone types.

**RE-D16 Temperamental Shift** · C · S
Trigger: Bond change event. Scene: member acts different. Outcomes: accept (nature mint effect temp), reverse, ask a mint seller. Reward/Cost: temp stat. Variations: nature list.

**RE-D17 Moult of the Moon** · U · M
Trigger: lunar phase tied. Scene: a moulting party member. Outcomes: assist (rare feather), watch, give space. Reward/Cost: feather. Variations: birds.

**RE-D18 Dreams of Another Form** · R · M
Trigger: hypnosis event. Scene: member dreams as a different species. Outcomes: let it (for one stage it holds a type tag), wake, ask. Reward/Cost: tag. Variations: Ditto.

**RE-D19 The Inherited Move** · U · S
Trigger: Egg hatches. Scene: a surprise move. Outcomes: keep (good), reroll (another), teach. Reward/Cost: move. Variations: egg moves.

**RE-D20 Trial of the Third Evolution** · U · M
Trigger: final-stage evolution item. Scene: a challenge to prove worthiness. Outcomes: pass (evolves with bonus stat), fail (try later), skip. Reward/Cost: stat. Variations: species.

**RE-D21 Uneasy Hybrid** · VR · M
Trigger: custom species hybrid. Scene: two species share one body. Outcomes: ask it (it chooses a primary), help, ignore. Reward/Cost: new custom species. Variations: from `customSpecies`.

**RE-D22 Weather Remodel** · U · S
Trigger: weather node with weather-form species (Castform, Cherrim). Scene: mood changes form. Outcomes: sync with weather (bonus), fight it (stabilise), snap a picture. Reward/Cost: temp form. Variations: forms.

**RE-D23 The Shapeshifter's Show** · U · S
Trigger: Ditto/Zorua. Scene: performance. Outcomes: ask for an act (copy a member for a fight), applaud, tip. Reward/Cost: temp copy. Variations: personality.

**RE-D24 A Baby Is Born** · C · S
Trigger: an egg hatches mid-run. Scene: party gathers. Outcomes: name it (nickname), let others, hold it. Reward/Cost: recruit. Variations: birth stats.

**RE-D25 Shiny Shimmer** · VR · M
Trigger: random 1 in thousands. Scene: a member's colours shimmer. Outcomes: accept (it becomes shiny for this run, a gift), hide, trade. Reward/Cost: shiny. Variations: Memory note. (Cosmetic only, no stat change.)

**RE-D26 Ancient Genes Awaken** · R · L
Trigger: fossil lines. Scene: rock cracks. Outcomes: support (ancient move), study, leave. Reward/Cost: move. Variations: fossils.

**RE-D27 Reverse Evolution** · VR · L
Trigger: a cursed idol or time rift. Scene: member turns younger. Outcomes: embrace (gains a re-evolve with different branch), cure (item), refuse. Reward/Cost: reroll. Variations: only one.

**RE-D28 Elemental Imprint** · R · M
Trigger: a strong elemental node (volcano, glacier). Scene: member's eyes reflect. Outcomes: give it time (adds a secondary type tag temporarily), shield it, leave. Reward/Cost: tag. Variations: tags.

**RE-D29 Heavy Evolution** · C · S
Trigger: weight-based. Scene: ground shakes. Outcomes: carry, watch, sit. Reward/Cost: small. Variations: comedic.

**RE-D30 Hatch Day Dance** · C · S
Trigger: egg with steps. Scene: party dances. Outcomes: join (steps count more), watch, skip. Reward/Cost: steps. Variations: music.

**RE-D31 Held Item Wakes Something** · U · M
Trigger: unusual held item. Scene: item glows. Outcomes: wait (a form change tied to the item), remove, pass it. Reward/Cost: form. Variations: Arceus plates etc.

**RE-D32 Gender Reveal** · C · S
Trigger: baby with gender-differing evolution. Scene: reveal. Outcomes: celebrate, shrug, bet. Reward/Cost: small. Variations: forms.

**RE-D33 Grow Up Fast** · U · S
Trigger: low-level recruit. Scene: it rushes to be strong. Outcomes: train it (+3 levels), advise patience, cheer. Reward/Cost: levels. Variations: cost ₽.

**RE-D34 Evolve Under Pressure** · R · L
Trigger: faint risk in a boss. Scene: glow in crisis. Outcomes: allow (Evolves at 1 HP with full revive), cancel, bond-surge. Reward/Cost: strong. Variations: Bond ≥ high.

**RE-D35 Dynamax-Like Energy Pool** · U · M
Trigger: power spot. Scene: red energy. Outcomes: absorb (one big move), leave, contain. Reward/Cost: one-off. Variations: spot.

**RE-D36 Aging Gracefully** · M · M
Trigger: a long-run member. Scene: silver fur. Outcomes: honour (cosmetic 'elder' look, stat tilt toward defense), hide, rest. Reward/Cost: tilt. Variations: species.

**RE-D37 Curious Mutation** · VR · L
Trigger: toxic zone. Scene: member changes colour. Outcomes: study (new ability tag), cure, cheer. Reward/Cost: ability. Variations: risk.

**RE-D38 Glimmering Cocoon** · R · M
Trigger: Wurmple. Scene: twin choice. Outcomes: wait (branch), tilt (choose), ask. Reward/Cost: branch. Variations: personality.

**RE-D39 Passing the Torch** · R · L
Trigger: elder Pokémon with high Bond. Scene: it teaches a signature move. Outcomes: accept (a recipient gains the move), refuse, share. Reward/Cost: move. Variations: elders.

**RE-D40 Fear Form** · U · S
Trigger: shadow trap. Scene: fear changes pose. Outcomes: comfort, endure, ignore. Reward/Cost: small. Variations: forms.

**RE-D41 Moulting Season** · C · S
Trigger: bird region. Scene: feathers everywhere. Outcomes: collect (crafting), tidy, nap. Reward/Cost: items. Variations: birds.

**RE-D42 Wild Evolution Feast** · U · M
Trigger: a wild Pokémon evolving nearby. Scene: you witness. Outcomes: respect (blessing), catch (weak), photograph. Reward/Cost: blessing. Variations: rare.

**RE-D43 Mind Swap** · R · M
Trigger: psychic anomaly. Scene: two members swap abilities for a stage. Outcomes: allow (swap), reverse (cost), exploit. Reward/Cost: temp. Variations: ability pairs.

**RE-D44 Egg Cracks Early** · C · S
Trigger: random. Scene: surprise. Outcomes: help, wait, panic. Reward/Cost: recruit. Variations: species.

**RE-D45 The Ugly Duckling** · U · S
Trigger: baby with a plain evolution. Scene: it envies others. Outcomes: reassure (Bond +2), promise (future reward), ignore. Reward/Cost: Bond. Variations: lines.

**RE-D46 Beast Mode Switch** · R · M
Trigger: Zygarde-like cells. Scene: cells scatter. Outcomes: collect (form change), ignore, gift. Reward/Cost: cells. Variations: cells count.

**RE-D47 Relic Song** · VR · M
Trigger: Meloetta. Scene: melody. Outcomes: dance (form), listen, record. Reward/Cost: temp. Variations: song.

**RE-D48 Meteor Core Contact** · R · L
Trigger: meteor event. Scene: Minior-style core. Outcomes: touch (form), avoid, trade. Reward/Cost: temp. Variations: colours.

**RE-D49 Ability Capsule Salesperson** · U · M
Trigger: shop node. Scene: capsule cart. Outcomes: swap (₽), haggle, refuse. Reward/Cost: ability. Variations: quote.

**RE-D50 Overnight Transformation** · U · M
Trigger: rest. Scene: sleeper is different. Outcomes: accept, revert, chase. Reward/Cost: random cosmetic form. Variations: lasts a stage.

**RE-D51 Overgrowth** · C · S
Trigger: grass terrain. Scene: vines. Outcomes: prune (berries), nurture, flee. Reward/Cost: berries. Variations: forests.

**RE-D52 Frozen Moment** · U · S
Trigger: ice. Scene: member frozen in time. Outcomes: thaw (Bond), study, wait. Reward/Cost: Bond. Variations: size.

**RE-D53 Mimic Gone Wild** · U · S
Trigger: Mimic. Scene: it copies the wrong party member's move. Outcomes: tutor it (gains the move), laugh, correct. Reward/Cost: move. Variations: comedic.

**RE-D54 Bond Phenomenon** · M · XL
Trigger: very rare, Bond max with starter and final stage. Scene: a transformation tied to partnership. Outcomes: accept (starter takes a unique 'Bond Form' for the run), save, share. Reward/Cost: permanent form per run. Variations: per starter.

**RE-D55 The Poison Nest** · U · S
Trigger: swamp. Scene: poison bubbles. Outcomes: filter (antidote item), endure, avoid. Reward/Cost: status. Variations: type.

**RE-D56 Cooking Changes Moods** · C · S
Trigger: camp. Scene: berries shift nature. Outcomes: brew (temp nature), taste, ask. Reward/Cost: temp. Variations: flavours.

**RE-D57 Statue Comes Alive** · R · M
Trigger: ruin. Scene: statue transforms to a Pokémon. Outcomes: befriend (recruit), battle, flee. Reward/Cost: recruit. Variations: types.

**RE-D58 Accidental Move Tutor** · U · S
Trigger: member fumbles. Scene: it learns a surprise move. Outcomes: keep, forget, swap. Reward/Cost: move. Variations: odd.

**RE-D59 Gain a Passenger** · R · M
Trigger: parasite or symbiosis (Paras, Wimpod). Scene: small Pokémon hitch a ride. Outcomes: allow (passive effect), remove, trade. Reward/Cost: passive. Variations: kinds.

**RE-D60 Overcharge Spike** · U · S
Trigger: lightning. Scene: electric surge. Outcomes: ground it, absorb (+speed temp), flee. Reward/Cost: temp. Variations: storms.

**RE-D61 Eclipse Awakening** · M · L
Trigger: eclipse event. Scene: dark light. Outcomes: transform (night form for the run), resist, observe. Reward/Cost: form. Variations: lunar.

**RE-D62 Pokémon Becomes Fussy About Water** · C · S
Trigger: sea. Scene: hydrophobia. Outcomes: coax, avoid water nodes (one skip), tease. Reward/Cost: skip. Variations: Fire types.

**RE-D63 Hormone Swing** · U · S
Trigger: random. Scene: mood swings. Outcomes: soothe, indulge, ignore. Reward/Cost: Bond. Variations: bit comedic.

**RE-D64 Ancient Seal Breaks** · VR · L
Trigger: shrine. Scene: seal. Outcomes: free (recruit sealed Pokémon), reseal, trade. Reward/Cost: legend-lite. Variations: seals.

**RE-D65 The Awkward Teenager** · C · S
Trigger: evolution of a baby. Scene: limbs. Outcomes: comfort, laugh, guide. Reward/Cost: Bond. Variations: comedic.

**RE-D66 Echo Evolution** · R · M
Trigger: member's evolution triggered by a repeated event type. Scene: it resonates. Outcomes: accept, hold, share. Reward/Cost: unusual evolution. Variations: custom evolutions from data.

**RE-D67 Candy Overflow** · C · S
Trigger: candy. Scene: pile. Outcomes: share, hoard, trade. Reward/Cost: candy. Variations: kinds.

**RE-D68 Silent Coronation** · M · XL
Trigger: very rare. Scene: all wild Pokémon bow to a party member. Outcomes: accept the crown (title 'King of the Route' for the stage, free passage on wild nodes), refuse, share. Reward/Cost: free passage. Variations: member.

**RE-D69 Sick Bay Surprise** · U · S
Trigger: Center. Scene: a recovering Pokémon changed. Outcomes: ask the nurse, accept, laugh. Reward/Cost: small. Variations: flavour.

**RE-D70 Looking Glass Self** · VR · L
Trigger: mirror. Scene: reversed. Outcomes: step in (swap a member's nature), refuse, smash. Reward/Cost: nature swap. Variations: natures.
