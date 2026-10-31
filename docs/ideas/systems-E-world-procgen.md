# Systems E: Persistent world, simulation, procedural generation and rare encounters (SYS-E01 to SYS-E65)

Legend as in file A. Existing code touched: `core/world.ts`, `core/map.ts`, `core/regions.ts`, `core/encounterDirector.ts`, `core/encounters.ts`, `core/events.ts`, `core/gameEvents.ts`, `core/shadowWorld`, `core/plaza`, `core/campaign`, `core/expedition`, `core/timeline`, `rivals/world.ts`, `core/availability.ts`, `core/daily.ts`.

## E1. Persistent world frameworks

**SYS-E01 World State Ledger ★F** · N · C:L · P:Ess
One versioned "world state" object in the profile: region conditions, faction standings, NPC statuses, extinct/endangered species, open threats, discovered locations. Runs read it at start and write deltas at end (deterministic, migrated). Player sees a World tab. Deps: profile, timeline, shadowWorld. Impact: foundation for all persistent-world ideas. Balance: delta caps per run so one run cannot wreck the world.

**SYS-E02 World Calendar** · E · C:M · P:High
A calendar that advances one tick per run (or per N nodes) driving seasons, festivals, migrations. Extends weekly game events. Deps: gameEvents, E01. Impact: temporal texture. Balance: calendar never locks content.

**SYS-E03 Region Moods** · N · C:M · P:Med
Each region has a mood (Festive, Wary, Frightened, Prosperous) from player history, changing shops, trainers and music. Deps: E01, music system. Impact: regions differ per play. Balance: ±10% price changes.

**SYS-E04 Ecological Balance** · N · C:L · P:Med
Species populations shift by catching/releasing; over-catching causes scarcity and predator surges. Deps: wildBehavior, spawn tables. Impact: consequences for catching. Balance: floors guard rarities from vanishing.

**SYS-E05 Rebuilt/Ruined Locations** · N · C:M · P:Med
Events can destroy or restore a node type (bridge, port); changes persist across runs until repaired. Deps: E01, map generator. Impact: dramatic world change. Balance: repair quests offered.

**SYS-E06 World Wonders Under Construction** · N · C:L · P:Med
A multi-run community-style project (a tower, a harbor) that you fund with items; completion opens new nodes. Deps: economy, E01. Impact: long goal. Balance: fixed total cost.

**SYS-E07 Historical Layers** · N · C:M · P:Low
Nodes show "layers" of history (ruins from older runs, your old Camps). Deps: D21. Impact: nostalgia. Balance: cosmetic.

**SYS-E08 Climate Drift** · N · C:M · P:Low
Gradual climate shifts alter weather odds and species ranges over meta-time. Deps: E02. Impact: slow change. Balance: reversible.

**SYS-E09 NPC Settlements** · N · C:L · P:Med
Settlements grow or shrink; shops, nurse quality and trainers scale accordingly. Deps: E01, B33. Impact: tangible effects. Balance: floors.

**SYS-E10 Faction Territory Map** · N · C:L · P:High
Three to five factions hold regions; player actions shift borders; nodes inside faction land use faction rules. Deps: factions, E01. Impact: strategic layer. Balance: no faction can fully dominate.

**SYS-E11 Trade Routes** · N · C:M · P:Low
Shops in connected towns share stock; closing a route (bandits) raises prices. Deps: shops, E05. Impact: economy-world link. Balance: moderate.

**SYS-E12 Disaster Aftermaths** · N · C:M · P:Med
After a disaster node, later runs show aftermath visuals and recovery quests. Deps: E05. Impact: consequence. Balance: none.

**SYS-E13 Pokémon Population Census** · N · C:S · P:Low
Hub census shows species counts in the world and your effect. Deps: E04. Impact: dex meta. Balance: none.

**SYS-E14 Wild Colonies** · N · C:M · P:Med
Released Pokémon form colonies that appear as friendly nodes later with gifts. Deps: release logs. Impact: payoff for releasing. Balance: rewards small.

**SYS-E15 Lost-and-Found World** · N · C:S · P:Low
Items you drop/miss show up in later runs in shops or with NPCs. Deps: ledger. Impact: continuity. Balance: junk-tier.

## E2. Procedural generation overhauls

**SYS-E16 Map Grammar Generator ★F** · O · C:L · P:High
Replace weighted node picking with a grammar of "motifs" (Crossroads, Pilgrimage, Heist, Hunt, Retreat) that assemble 6-10 node stretches with coherent pacing. Deps: map.ts, encounterDirector. Impact: maps feel designed and varied. Balance: motif weights data-driven; seeded and testable.

**SYS-E17 Biome Blending** · E · C:M · P:Med
Adjacent nodes blend biomes (swamp-forest edges) producing hybrid encounters. Deps: biome data. Impact: variety. Balance: hybrids drawn from both pools.

**SYS-E18 Procedural Landmarks** · N · C:M · P:Med
Named landmarks generated from templates (a lighthouse with a mood, history, owner) tied to the Cast Registry. Deps: B31. Impact: memorable places. Balance: reward tables fixed.

**SYS-E19 Story-Driven Map Warping** · L · C:M · P:Med
Active arcs (D41) reshape the map: a chase adds a pursuit lane, a heist adds a vault node. Deps: D41, E16. Impact: unity. Balance: node counts bounded.

**SYS-E20 Layered Encounter Tables** · O · C:L · P:High
Encounter pools composed of stacked layers (region, weather, time, faction, mood, history) with per-layer weights and auditable output. Deps: encounterDirector. Impact: reliable variety and explainability. Balance: report tool prints why an encounter appeared.

**SYS-E21 Procedural Trainer Generator 2.0** · O · C:L · P:High
Trainers built from backstory templates (Class, Motive, Mon theme, Quirk) with name, lines and team logic. Deps: C39. Impact: no two trainers feel alike. Balance: validated vs content gate.

**SYS-E22 Procedural Dungeon Rooms** · N · C:L · P:Med
Dungeon nodes open into 3-6 rooms from a room kit (puzzle, ambush, treasure, shrine). Deps: map. Impact: depth. Balance: exit always reachable.

**SYS-E23 Curated Randomness Budget** · N · C:M · P:High
Each run has a "weirdness budget" spent on rare features, guaranteeing at least one memorable thing but not five. Deps: rarity system. Impact: consistent quality. Balance: tuneable.

**SYS-E24 Procedural Item Lore** · N · C:M · P:Low
Items get generated histories and former owners. Deps: items. Impact: flavor. Balance: none.

**SYS-E25 Seeded World Names** · N · C:S · P:Low
Procedural place/trainer names using a phoneme model per region. Deps: naming. Impact: identity. Balance: none.

**SYS-E26 Fractal Events** · X · C:L · P:Exp
Events compose from sub-events (arrive, complication, twist, resolution), creating thousands of combos from a small set. Deps: events. Impact: massive variety. Balance: validated chains.

**SYS-E27 Run Pitch Generator** · N · C:M · P:Med
At run start show a "pitch" (logline) generated from the seed: "A stormy road, a rival in debt." Deps: D45, D41. Impact: anticipation. Balance: promise kept.

**SYS-E28 Terrain Features Per Node** · N · C:M · P:Med
Node tiles carry features (cliff, pond, ruins) that matter in battle (E field zones). Deps: battle terrain. Impact: location matters. Balance: shown preview.

**SYS-E29 Multi-Seed Layers** · N · C:S · P:Low
Separate seeds for map, events and loot, letting players re-roll one layer only. Deps: seedCode. Impact: replay control. Balance: streak flagged.

**SYS-E30 Gen Audit Reports** · N · C:S · P:Med
`report:*` tooling summarizing generator distributions, dead ends and repeat rates. Deps: report scripts. Impact: quality control. Balance: dev only.

## E3. Event generation and rare encounter frameworks

**SYS-E31 Event Director ★F** · N · C:L · P:Ess
Central director picking events by tension curve, theme, cooldowns and variety; replaces ad-hoc event roll sites. Deps: events, encounterDirector, D41. Impact: pacing control. Balance: parameters in data.

**SYS-E32 Rarity Tiers With Narrative Weight** · O · C:M · P:High
Rarity tiers (Common, Notable, Rare, Mythic, Once-in-a-Hundred) with different presentation (jingle, banner, chronicle entry). Deps: rarity data. Impact: rare feels rare. Balance: mythic gets pity-free design.

**SYS-E33 Hundred-Hour Counters** · N · C:M · P:Rare
Rare events tied to lifetime counters (playtime, catches) rather than pure RNG. Deps: profile stats. Impact: long-term hooks. Balance: unlocks once.

**SYS-E34 Legendary Encounter Framework** · O · C:L · P:High
Legendary Pokémon appear through multi-stage "signs" (rumor, track, omen, encounter) with differing paths. Deps: legendary data. Impact: legendary feel. Balance: sign meters prevent frustration.

**SYS-E35 Phenomena Nodes** · N · C:M · P:Med
Mysterious phenomena (Time Slip, Mirror Lake, Dead Calm) alter rules for a single node. Deps: rules. Impact: spice. Balance: bounded.

**SYS-E36 Cascade Events** · N · C:M · P:Med
Outcomes in one event spawn follow-ups two nodes later. Deps: E31. Impact: consequence. Balance: cap chain length.

**SYS-E37 Event Memory** · N · C:S · P:Med
Per-run record of triggered events prevents repetition, enables callbacks. Deps: runs. Impact: richer references. Balance: none.

**SYS-E38 Event Authoring Schema** · N · C:M · P:High
Zod-validated event DSL (conditions, text, outcomes, rarity, art) with test fixtures. Deps: contentSchema. Impact: hundreds of events cheaply. Balance: content gate checks.

**SYS-E39 Conditional Text Engine** · N · C:M · P:High
Text templating with conditions on party, edges, history; supports pluralization, species-specific lines. Deps: dialogue. Impact: reactive text everywhere. Balance: lint tooling.

**SYS-E40 Event Replay Viewer** · N · C:S · P:Low
Codex lets you re-read seen events and see how many remain. Deps: moment codex. Impact: collection hook. Balance: none.

**SYS-E41 Time-Limited Offers** · N · C:S · P:Med
Offers expire after N nodes; leaving is a choice. Deps: events. Impact: tension. Balance: not punitive.

**SYS-E42 Event Contraindications** · N · C:S · P:Low
Events refuse to fire if contradicting current story or party (no funeral for the immortal). Deps: E39. Impact: coherence. Balance: lint.

**SYS-E43 Shared Event Pools by Theme** · N · C:S · P:Low
Pools tagged by mood allow director queries ("something gentle"). Deps: E31. Impact: pacing. Balance: tags audited.

**SYS-E44 Unique-Per-Save Events** · N · C:M · P:Rare
Events that fire only once per profile, forever. Deps: E01. Impact: stories players share. Balance: well-placed.

**SYS-E45 Anomalies as World Bugs** · X · C:M · P:Exp
In-world "glitch" events (MissingNo-style) tied to cheat-free lore. Deps: anomaly.ts. Impact: eerie. Balance: safe.

## E4. Environmental simulation

**SYS-E46 Weather Simulation Layer** · E · C:L · P:Med
Weather is simulated across the map with fronts; battles inherit local weather; scouting predicts it. Deps: weather. Impact: tactics. Balance: forecast accuracy upgradeable.

**SYS-E47 Terrain Hazards That Move** · N · C:M · P:Low
Lava flows, tides, creeping fog shift per turn on dungeon nodes. Deps: E22. Impact: tension. Balance: telegraphed.

**SYS-E48 Day/Night Persistent Clock** · N · C:M · P:Med
Hub and run share a clock; shops, species and events depend on it. Deps: E02. Impact: rhythm. Balance: no lockouts.

**SYS-E49 Moon Phases** · N · C:S · P:Low
Moon phase affects Ghost/Psychic spawn and lunar events. Deps: E02. Impact: flavor. Balance: small.

**SYS-E50 Tides and Water Levels** · N · C:M · P:Low
Water nodes change access by tide, hiding treasures. Deps: map. Impact: timing. Balance: both states have value.

**SYS-E51 Wildfire and Flood Spread** · N · C:M · P:Low
Hazards spread across adjacent nodes unless stopped. Deps: E47. Impact: urgency. Balance: stoppable.

**SYS-E52 Pollination and Growth** · N · C:M · P:Low
Berry patches and Grass nodes grow over meta-time. Deps: berry garden. Impact: gardening. Balance: slow.

**SYS-E53 Scent and Sound Propagation** · N · C:M · P:Low
Loud actions attract wildlife; stealth reduces fights. Deps: C20. Impact: stealth. Balance: soft.

**SYS-E54 Habitat Restoration Jobs** · N · C:M · P:Low
Restoring habitats grants species rewards. Deps: E04. Impact: purpose. Balance: finite.

**SYS-E55 Underground Network** · N · C:L · P:Med
A hidden cave network connects distant nodes; discovering it changes route planning. Deps: map. Impact: secrets. Balance: hazards.

## E5. Rare and strange encounter frameworks

**SYS-E56 Wandering Ghost Event Lines** · N · C:M · P:Low
Ghost NPCs with unfinished business recur until resolved. Deps: B31. Impact: story-lite. Balance: reward small.

**SYS-E57 Dimensional Rifts** · X · C:M · P:Exp
Rifts replace a node with a mirror-world version using swapped types. Deps: type chart. Impact: puzzle. Balance: opt-in.

**SYS-E58 Time Traveler Encounters** · X · C:M · P:Rare
Future trainers use Pokémon not yet caught; they offer cryptic gifts. Deps: dex. Impact: wonder. Balance: gifts limited.

**SYS-E59 Impostor Encounters** · N · C:M · P:Rare
A Ditto-like impostor imitates a party mon; spotting it yields a reward. Deps: A01. Impact: puzzle. Balance: low.

**SYS-E60 Celestial Alignments** · N · C:M · P:Rare
Rare alignments (conjunction) unlock one-run-only nodes. Deps: E02. Impact: event. Balance: announced early.

**SYS-E61 Pokémon Parades and Migrations** · N · C:M · P:Med
Huge visible migrations cross the map; joining one grants a parade fight. Deps: E04. Impact: spectacle. Balance: optional.

**SYS-E62 Hidden Villages** · N · C:L · P:Rare
Hard-to-find settlements with unique culture, shop and arc. Deps: E18. Impact: discoveries. Balance: access via riddles.

**SYS-E63 Treasure Maps Chains** · E · C:M · P:Low
Chain of treasure maps across runs leading to a mythic cache. Deps: items. Impact: long hunt. Balance: pity.

**SYS-E64 Boss Cameos** · N · C:S · P:Low
Bosses from other regions appear in odd places as non-hostile cameos with items. Deps: bosses. Impact: delight. Balance: harmless.

**SYS-E65 Rare Weather Spectacles** · N · C:M · P:Rare
Meteor showers, auroras with unique buffs and visuals. Deps: weather, art. Impact: awe. Balance: small boons.
