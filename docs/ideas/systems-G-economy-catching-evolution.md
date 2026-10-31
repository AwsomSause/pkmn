# Systems G: Economy, trading, catching, recruitment, evolution and transformation (SYS-G01 to SYS-G70)

Legend as in file A. Existing code touched: `core/items.ts`, `core/bank.ts`, `core/candyShop.ts`, `core/crafting.ts`, `core/capture.ts`, `core/catchSummary.ts`, `core/eggs.ts`, `core/evolution.ts`, `core/specialForms.ts`, `core/shadow.ts`, `core/rewards.ts`, `core/rewardSynergy.ts`, `core/services`, `core/collection.ts`.

## G1. Economy and trading overhauls

**SYS-G01 Multi-Currency Ledger ★F** · O · C:L · P:High
One ledger handles several currencies with exchange rates set by region mood and faction (Pokédollar, Favor Tokens, Relic Shards, Guild Scrip). Deps: bank, E01. Impact: shops feel regional. Balance: no loops; caps on conversion.

**SYS-G02 Regional Price Curves** · E · C:M · P:Med
Prices follow supply/demand per region with visible trends and merchant commentary. Deps: shops. Impact: arbitrage thinking. Balance: capped swing 25%.

**SYS-G03 Barter-First Trading** · N · C:M · P:Med
Many merchants prefer item swaps; value shown as an exchange meter. Deps: B35. Impact: variety. Balance: balanced values.

**SYS-G04 Merchant Specialties and Schedules** · N · C:M · P:Med
Merchants specialize and appear on schedules; missing them matters. Deps: E02. Impact: planning. Balance: always another.

**SYS-G05 Contracts Marketplace** · N · C:M · P:Med
Contracts (deliver, defeat, escort) posted at nodes with payouts; reputation unlocks better contracts. Deps: quests. Impact: side goals. Balance: capped.

**SYS-G06 Investment and Loans** · N · C:M · P:Low
Invest funds in a shop/venture for returns after N nodes; loans have interest. Deps: G01. Impact: risk/reward. Balance: bounded.

**SYS-G07 Auction House Sim** · N · C:L · P:Low
NPC bidders compete over rare items; bid psychology via personalities. Deps: C26. Impact: event. Balance: seeded.

**SYS-G08 Appraisal Mechanic** · N · C:S · P:Low
Unknown items need appraisal; outcomes vary. Deps: items. Impact: surprise. Balance: fair.

**SYS-G09 Sell Pokémon Services (not Pokémon)** · N · C:S · P:Low
Rent your party's labor (show, escort) for income without selling them. Deps: partyLife. Impact: use for benched mons. Balance: tiny income.

**SYS-G10 Upgrade Sinks** · N · C:M · P:Med
Money sinks that matter (gear upgrades, camp comforts) to avoid inflation. Deps: Hub. Impact: economy health. Balance: audited.

**SYS-G11 Taxes and Tolls** · N · C:S · P:Low
Faction-run territories charge tolls; reputation reduces them. Deps: E10. Impact: tension. Balance: avoidable.

**SYS-G12 Black Market Reputation** · N · C:M · P:Med
Underworld deals unlock rare goods but raise infamy. Deps: B47. Impact: moral tradeoff. Balance: heat meter.

**SYS-G13 Item Provenance** · N · C:S · P:Low
Each item records source (found, bought, stolen) with minor effects (stolen draws attention). Deps: ledger. Impact: depth. Balance: small.

**SYS-G14 Bag Capacity as Strategy** · N · C:M · P:Med
Bag space limited with fun stack rules; packs upgrade. Deps: items. Impact: choices. Balance: generous floors.

**SYS-G15 Pawn Conversations** · N · C:S · P:Low
Selling items triggers stories by item provenance. Deps: G13. Impact: flavor. Balance: none.

**SYS-G16 Economy Telemetry Report** · N · C:S · P:Med
`report:economy` shows money in/out per region from the bot. Deps: report tooling. Impact: balance. Balance: dev only.

**SYS-G17 Seasonal Markets** · N · C:M · P:Low
Seasonal fairs with limited wares. Deps: E02. Impact: events. Balance: none.

**SYS-G18 Gift Economy** · N · C:S · P:Low
NPC gifts matter more than purchases; reciprocity tracked. Deps: B50. Impact: relationships. Balance: soft.

**SYS-G19 Smuggler Routes** · N · C:M · P:Low
Carry restricted goods across borders for pay with inspection risk. Deps: E10. Impact: risk. Balance: opt-in.

**SYS-G20 Run Wealth as Score** · E · C:S · P:Low
Wealth converted to Hub reputation at run end. Deps: scoring. Impact: reason to hoard. Balance: capped.

## G2. Catching and recruitment overhauls

**SYS-G21 Encounter Approaches** · O · C:L · P:High
Before a wild fight choose an approach (Battle, Sneak, Lure, Befriend, Observe) with different outcomes and rewards. Deps: wildBehavior, capture. Impact: more ways to meet Pokémon. Balance: each approach has a niche.

**SYS-G22 Befriending Mini-Interactions** · N · C:M · P:Med
Species-specific befriend sequences (feed, perform, wait). Deps: A11, G21. Impact: charm. Balance: gives capture bonus.

**SYS-G23 Recruitment by Request** · N · C:M · P:Med
Wild Pokémon ask for help (quest) then join. Deps: quests. Impact: narrative recruits. Balance: unique mons.

**SYS-G24 Catch Quality Tiers** · E · C:S · P:Med
Captures report quality (clumsy/clean/dazzling) with personality tag. Deps: catchSummary. Impact: individuality. Balance: cosmetic + small.

**SYS-G25 Trade With Wild Mons** · N · C:M · P:Low
Trade an item for a wild mon's move or feather. Deps: wildBehavior. Impact: variety. Balance: bounded.

**SYS-G26 Hatch Companion Programs** · N · C:M · P:Low
Hub nursery lets you assign eggs to NPC caretakers; hatch with traits. Deps: eggs. Impact: hub gameplay. Balance: slow.

**SYS-G27 Pokémon Contracts** · X · C:M · P:Exp
Join a Pokémon temporarily by contract (for 3 regions) with a terms sheet. Deps: G23. Impact: loans. Balance: expiry.

**SYS-G28 Capture Accountability** · N · C:S · P:Low
Over-catching consequences: guilt events or conservation fees. Deps: E04. Impact: balance. Balance: mild.

**SYS-G29 Catch Rights and Permits** · N · C:S · P:Low
Some zones require permits; cheating risks fines. Deps: factions. Impact: world rules. Balance: easy.

**SYS-G30 Species Study Sets** · E · C:M · P:Med
Studying a species repeatedly improves catch and befriend odds. Deps: researchNotes. Impact: reward for study. Balance: capped.

**SYS-G31 Capture Rivalries** · N · C:M · P:Low
Rival trainers compete for the same rare mon; whoever arrives first wins. Deps: rivals. Impact: urgency. Balance: both sides have shots.

**SYS-G32 Wild Pokémon Personalities Visible** · E · C:S · P:Med
Wild mons show a quick personality blurb pre-fight helping catch decisions. Deps: A01. Impact: choices. Balance: honest.

**SYS-G33 Shared Catches** · N · C:S · P:Low
Catch events where two mons "share" a catch; both gain small bond. Deps: B01. Impact: charm. Balance: none.

**SYS-G34 Failure Stories** · N · C:S · P:Low
Failed captures produce story beats and potential return. Deps: events. Impact: tension. Balance: none.

**SYS-G35 Specimen Documentation Rewards** · N · C:S · P:Low
Photographing/recording wild mons gives research points. Deps: photo mode. Impact: nonviolent gameplay. Balance: capped.

## G3. Evolution and transformation frameworks

**SYS-G36 Evolution Conditions Engine ★F** · O · C:L · P:High
A condition DSL for evolutions (time, place, edge values, memories, moves, party composition, weather) replacing code branches. Deps: evolution.ts, schema. Impact: unlimited creative evolutions. Balance: validated for reachability.

**SYS-G37 Evolution Ceremonies** · E · C:M · P:Med
Evolution is a scene shaped by relationships (who is present, what they say). Deps: B01. Impact: emotional. Balance: skippable.

**SYS-G38 Branching Evolutions by Experience** · N · C:M · P:High
Evolution forms chosen by how a mon was used (offense/defense/support) not only items. Deps: stats tracking. Impact: individuality. Balance: audited.

**SYS-G39 Regressions/De-evolution** · X · C:M · P:Exp
Rare events revert a mon temporarily with rewards. Deps: evolution. Impact: surprise. Balance: opt-in.

**SYS-G40 Temporary Evolutions** · N · C:M · P:Med
Battle-limited evolution-like states earned by bond (Burst Form). Deps: M8.5 gimmicks. Impact: spectacle. Balance: one per battle.

**SYS-G41 Evolution Rivalries** · N · C:S · P:Low
Eeveelution-style choices influenced by party relationships. Deps: B01. Impact: choice. Balance: none.

**SYS-G42 Fusion-Lite** · X · C:XL · P:Exp
Temporary fusion of two bonded mons into a hybrid form for a boss. Deps: designed forms. Impact: spectacle. Balance: heavy cost.

**SYS-G43 Mega/Dynamax/Tera Expression Rules** · L · C:M · P:Med
Unify gimmick gates (energy, bond, story) so only one fires per battle. Deps: M8.5. Impact: clarity. Balance: unified budget.

**SYS-G44 Evolution Stones Re-imagined** · O · C:M · P:Low
Stones carry memories/colors that shape the evolved form. Deps: items. Impact: choices. Balance: cosmetic variants.

**SYS-G45 Trade Evolutions Without Trading** · N · C:M · P:Med
Link events (NPC trade, event swap) fulfill trade evolutions. Deps: trade events. Impact: accessibility. Balance: rules.

**SYS-G46 Pre-Evolution Forms Matter** · N · C:S · P:Low
Staying unevolved gives perks (Eviolite-like quirks) so choice is real. Deps: attributes. Impact: strategy. Balance: tuned.

**SYS-G47 Evolution Lineage Trees** · N · C:M · P:Low
Visual family tree with discovered branches. Deps: dex UI. Impact: discovery. Balance: none.

**SYS-G48 Form Change Rituals** · N · C:M · P:Low
Form swaps (Rotom, Shaymin) via rituals with minigame. Deps: specialForms. Impact: ceremony. Balance: free.

**SYS-G49 Dying Light Evolutions** · X · C:M · P:Rare
Evolve at faint's edge in rare scenes with penalty. Deps: A65. Impact: drama. Balance: rare.

**SYS-G50 Evolution Surprise Events** · N · C:M · P:Rare
Unusual evolution paths hidden until conditions met, found by chance. Deps: G36. Impact: discovery. Balance: documented in codex after.

## G4. Growth, inventory and resource structures

**SYS-G51 Candy and EXP Share Rethink** · O · C:M · P:Med
Unified "experience budget" assigned per Camp so benched mons progress deliberately. Deps: candyShop. Impact: party management. Balance: totals unchanged.

**SYS-G52 Training Time as Resource** · N · C:M · P:Med
Camp time slots (3 per stop) spent on training, care, crafting or rest. Deps: Camp. Impact: tradeoffs. Balance: tuned.

**SYS-G53 Held Item Fusion** · N · C:M · P:Low
Combine two held items into a hybrid effect. Deps: crafting. Impact: build crafting. Balance: audited.

**SYS-G54 Item Cooldowns and Charges** · N · C:S · P:Low
Some items recharge instead of consume. Deps: items. Impact: resource shape. Balance: slower.

**SYS-G55 Consumable Quality Tiers** · E · C:S · P:Low
Same item with Rough/Fine/Perfect tiers from crafting skill. Deps: crafting, quality items. Impact: depth. Balance: bounded.

**SYS-G56 Gear Sets and Bonuses** · E · C:M · P:Low
Item sets give bonuses when worn together by party. Deps: rewardSynergy. Impact: collecting. Balance: small.

**SYS-G57 Loadout Presets** · N · C:S · P:Med
Save/restore item loadouts per mon and party. Deps: UI. Impact: QoL. Balance: none.

**SYS-G58 Inventory Mutations** · X · C:M · P:Exp
Items change over time (berries ripen, eggs warm, potions go stale). Deps: E02. Impact: management. Balance: gentle.

**SYS-G59 Drop Tables as Data Packs** · N · C:M · P:Med
Packs of drop tables swapped by region/season/faction. Deps: configPack. Impact: content scale. Balance: validated.

**SYS-G60 Pity and Fairness Transparency** · E · C:S · P:Med
Visible pity counters for rare drops. Deps: rewards. Impact: trust. Balance: tuned.

## G5. Services and Hub economy

**SYS-G61 Pokémon Centers as Characters** · N · C:M · P:Low
Nurses with stories, quirks, specials. Deps: services. Impact: charm. Balance: flavor.

**SYS-G62 Day Care Overhaul** · O · C:M · P:Med
Day care becomes a narrative stop with caretaker reports of mons' mood and moves learned. Deps: eggs, A36. Impact: living breeding. Balance: gentle.

**SYS-G63 Spa and Salon** · N · C:S · P:Low
Cosmetic and mood services at Hub and towns. Deps: A05. Impact: care loop. Balance: cost.

**SYS-G64 Repair/Restoration Workshops** · N · C:M · P:Low
Restore cursed or degraded items for lore and perks. Deps: items. Impact: variety. Balance: bounded.

**SYS-G65 Wishing Wells and Fountains** · N · C:S · P:Low
Offerings produce modest luck and seed callbacks. Deps: events. Impact: charm. Balance: mild.

**SYS-G66 Training Facilities Rented** · N · C:M · P:Low
Rent facilities with rotating perks. Deps: G52. Impact: variety. Balance: costly.

**SYS-G67 Mons Insurance & Medical Records** · N · C:M · P:Low
Records of injuries/ailments with medical events and treatments. Deps: A43. Impact: realism. Balance: forgiving.

**SYS-G68 Hunter's Guild Rewards** · N · C:M · P:Low
Guild ranks for catch/research achievements. Deps: G30. Impact: progression. Balance: none.

**SYS-G69 Pokémon Boutique** · N · C:S · P:Low
Cosmetics shop for mons with bond effects. Deps: wardrobe. Impact: style. Balance: cosmetic.

**SYS-G70 Hub Economy Simulator** · N · C:L · P:Low
Hub town earns/spends via NPC activities; investment grows features. Deps: Hub, E09. Impact: city-builder lite. Balance: capped.
