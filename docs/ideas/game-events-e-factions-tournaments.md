# Whole-Game Events E: Factions, Tournaments, Invasions, Economy (GWE-E01 to E36)

Field key and shared rules as in file A (*Desc, How, Trigger, Feel, Deps, Rar, Pay, Cx, Bal*). Faction standing extends `rivalWorld.json` (factions, sponsors, debts) inside the `world` record. Offline only: "global" tallies come from the player's own history.

---

## E1. Faction Conflicts and Invasions

### GWE-E01 Front Lines
- *Desc:* Two factions fight over regions.
- *How:* Frontier shifts per run based on your wins against each.
- *Trigger:* Two factions at standing 3+.
- *Feel:* A war map.
- *Deps:* factions.
- *Rar:* R.
- *Pay:* Territory perks.
- *Cx:* L.
- *Bal:* Neutral perks stay.

### GWE-E02 Coup at the League
- *Desc:* A faction takes the League.
- *How:* The boss roster shifts to the faction team for a month unless you win "defence" battles.
- *Trigger:* Faction at max standing.
- *Feel:* Dramatic.
- *Deps:* boss rosters.
- *Rar:* R.
- *Pay:* Defence reward.
- *Cx:* L.
- *Bal:* Roster difficulty matched.

### GWE-E03 Occupation
- *Desc:* A region falls.
- *How:* Shops use faction stock and admins replace leaders; liberation needs multi-run tasks.
- *Trigger:* Coup unresolved.
- *Feel:* Oppressive.
- *Deps:* shops.
- *Rar:* R.
- *Pay:* Liberation reward.
- *Cx:* XL.
- *Bal:* Never blocks progress.

### GWE-E04 Smuggling Ring
- *Desc:* Contraband Pokémon.
- *How:* Busting it pays and unlocks forbidden-trade events.
- *Trigger:* Underworld standing.
- *Feel:* Shady.
- *Deps:* trade events.
- *Rar:* U.
- *Pay:* Money and unlocks.
- *Cx:* M.
- *Bal:* Fair.

### GWE-E05 Sneak Attack on the Hub
- *Desc:* Raiders hit the Hub.
- *How:* A defensive battle using your retired Pokémon.
- *Trigger:* ~100 runs.
- *Feel:* Thrilling.
- *Deps:* retired roster.
- *Rar:* XR.
- *Pay:* Hub upgrades.
- *Cx:* L.
- *Bal:* Defeat has mild cost.

### GWE-E06 Peace Treaty Summit
- *Desc:* Enemies meet.
- *How:* Your past choices decide invitees; the outcome shapes four months of events.
- *Trigger:* Long conflict.
- *Feel:* Diplomatic.
- *Deps:* factions.
- *Rar:* R.
- *Pay:* Peace perks.
- *Cx:* L.
- *Bal:* None.

### GWE-E07 Faction Tithe
- *Desc:* Shops taxed.
- *How:* Pay to keep peace or face ambushes.
- *Trigger:* Dominant faction.
- *Feel:* Pressure.
- *Deps:* shops.
- *Rar:* U.
- *Pay:* Peace or fight.
- *Cx:* M.
- *Bal:* Optional.

### GWE-E08 Infiltrator Among Us
- *Desc:* A spy in the Hub.
- *How:* Spot them from hints; wrong accusations hurt trust.
- *Trigger:* Faction active.
- *Feel:* Suspenseful.
- *Deps:* NPCs.
- *Rar:* U.
- *Pay:* Reward.
- *Cx:* M.
- *Bal:* Mild penalties.

### GWE-E09 Propaganda Posters
- *Desc:* Faction posters.
- *How:* They tweak trainer dialogue; tearing them down yields minor rewards and enemies.
- *Trigger:* Faction dominance.
- *Feel:* Flavourful.
- *Deps:* dialogue.
- *Rar:* C.
- *Pay:* Minor.
- *Cx:* S.
- *Bal:* None.

### GWE-E10 Mercenary Season
- *Desc:* Hired guns.
- *How:* Mercs fight beside you; a better offer makes them betray.
- *Trigger:* Money.
- *Feel:* Tension.
- *Deps:* doubles.
- *Rar:* U.
- *Pay:* Ally.
- *Cx:* M.
- *Bal:* Betrayal telegraphed.

### GWE-E11 Siege of the Gym
- *Desc:* A gym is besieged.
- *How:* Break the siege or help defenders; outcomes differ for loyalty.
- *Trigger:* Faction war.
- *Feel:* Heroic.
- *Deps:* gyms.
- *Rar:* R.
- *Pay:* Loyalty.
- *Cx:* M.
- *Bal:* None.

### GWE-E12 Counter-Revolution
- *Desc:* A splinter group.
- *How:* A darker leader forms after a faction falls.
- *Trigger:* Faction defeated.
- *Feel:* Ominous.
- *Deps:* factions.
- *Rar:* R.
- *Pay:* New boss.
- *Cx:* M.
- *Bal:* Matched.

### GWE-E13 War Orphans
- *Desc:* Pokémon left behind.
- *How:* Adopting gives inheritable scar traits that matter in story.
- *Trigger:* Occupation resolved.
- *Feel:* Poignant.
- *Deps:* traits.
- *Rar:* U.
- *Pay:* Trait Pokémon.
- *Cx:* M.
- *Bal:* Traits cosmetic or small.

### GWE-E14 Faction Fashion
- *Desc:* Faction colours trend.
- *How:* Wearing them yields bonuses and enemies.
- *Trigger:* Faction trending.
- *Feel:* Fun.
- *Deps:* cosmetics.
- *Rar:* C.
- *Pay:* Small.
- *Cx:* S.
- *Bal:* None.

### GWE-E15 Double Agent Quest
- *Desc:* Work for two factions.
- *How:* Either may expose you; the final judgement decides trust.
- *Trigger:* Two friendly standings.
- *Feel:* Risky.
- *Deps:* factions.
- *Rar:* R.
- *Pay:* Dual rewards.
- *Cx:* L.
- *Bal:* Clear stakes.

## E2. Tournaments and Championships

### GWE-E16 World Cup of Types
- *Desc:* Types as national teams.
- *How:* Your runs score points for the type you used most.
- *Trigger:* Every four years.
- *Feel:* Festive.
- *Deps:* type tallies.
- *Rar:* R.
- *Pay:* Cup rewards.
- *Cx:* M.
- *Bal:* None.

### GWE-E17 Gauntlet of Retired Champions
- *Desc:* Your old Legacy teams in a bracket.
- *How:* Bet on winners and fight the survivor.
- *Trigger:* 5 Legacy teams.
- *Feel:* Nostalgic.
- *Deps:* legacyRuns.
- *Rar:* R.
- *Pay:* Prize.
- *Cx:* L.
- *Bal:* Scaled to current.

### GWE-E18 Sudden Death Bracket
- *Desc:* One-on-one rounds.
- *How:* Trainers drawn from your history; winners get a golden ticket.
- *Trigger:* Random.
- *Feel:* Fast.
- *Deps:* trainer history.
- *Rar:* U.
- *Pay:* Ticket.
- *Cx:* M.
- *Bal:* Fair.

### GWE-E19 Masters Seeding Ceremony
- *Desc:* Fame sets seeding.
- *How:* High seeds get easier early rounds.
- *Trigger:* Fame tier.
- *Feel:* Prestigious.
- *Deps:* fame.
- *Rar:* U.
- *Pay:* Easier rounds.
- *Cx:* M.
- *Bal:* Final unchanged.

### GWE-E20 Interregional Cup
- *Desc:* Regions compete.
- *How:* Your clears give points to your home region.
- *Trigger:* Season.
- *Feel:* Loyalty.
- *Deps:* region.
- *Rar:* R.
- *Pay:* Region perk.
- *Cx:* M.
- *Bal:* None.

### GWE-E21 Amateur Hour
- *Desc:* A casual tournament.
- *How:* Handicaps: 3-Pokémon teams, level caps, silly rules.
- *Trigger:* Open.
- *Feel:* Light.
- *Deps:* rules.
- *Rar:* C.
- *Pay:* Bragging rights.
- *Cx:* M.
- *Bal:* Free entry.

### GWE-E22 Mirror Match Championship
- *Desc:* Fight yourself.
- *How:* Your team mirrored with the same nicknames.
- *Trigger:* High level.
- *Feel:* Uncanny.
- *Deps:* team snapshot.
- *Rar:* R.
- *Pay:* Title.
- *Cx:* M.
- *Bal:* Fair.

### GWE-E23 The Blindfold Open
- *Desc:* Hidden teams.
- *How:* Revealed in fight; shops sell clairvoyance.
- *Trigger:* Season.
- *Feel:* Mysterious.
- *Deps:* UI.
- *Rar:* U.
- *Pay:* Prize.
- *Cx:* M.
- *Bal:* Fair.

### GWE-E24 Doubles Dynasty
- *Desc:* Doubles championship.
- *How:* Partner NPCs from past rivals.
- *Trigger:* Doubles unlocked.
- *Feel:* Teamwork.
- *Deps:* doubles.
- *Rar:* U.
- *Pay:* Title.
- *Cx:* M.
- *Bal:* None.

### GWE-E25 Coaches' Cup
- *Desc:* Coach a protégé.
- *How:* Advice between rounds; no direct control.
- *Trigger:* Apprentice chain.
- *Feel:* Parental.
- *Deps:* B32.
- *Rar:* R.
- *Pay:* Trainer growth.
- *Cx:* L.
- *Bal:* None.

### GWE-E26 Hall of Fame Draft
- *Desc:* Champions draft.
- *How:* Retired champions pick Pokémon.
- *Trigger:* Draft season.
- *Feel:* Fun.
- *Deps:* Hall of Fame.
- *Rar:* U.
- *Pay:* Hints.
- *Cx:* S.
- *Bal:* None.

### GWE-E27 Underground Circuit
- *Desc:* A secret circuit.
- *How:* A code decoded across runs unlocks it.
- *Trigger:* Rumour trail.
- *Feel:* Secret.
- *Deps:* dialogue.
- *Rar:* R.
- *Pay:* Rare prizes.
- *Cx:* M.
- *Bal:* Risky wagers.

### GWE-E28 Rain Delay
- *Desc:* A postponed tournament.
- *How:* Incomplete brackets persist.
- *Trigger:* Weather.
- *Feel:* Funny.
- *Deps:* weather.
- *Rar:* U.
- *Pay:* Resumption.
- *Cx:* S.
- *Bal:* None.

### GWE-E29 Championship Betting
- *Desc:* Bets on matches.
- *How:* Seeded by date; shown on the Hub board.
- *Trigger:* Tournaments.
- *Feel:* Exciting.
- *Deps:* money.
- *Rar:* U.
- *Pay:* Winnings.
- *Cx:* S.
- *Bal:* Bet cap.

### GWE-E30 Retirement Match
- *Desc:* A legend's last bout.
- *How:* You are their final opponent; winning gives their signature move.
- *Trigger:* Legend NPC retires.
- *Feel:* Emotional.
- *Deps:* NPC.
- *Rar:* XR.
- *Pay:* Move.
- *Cx:* M.
- *Bal:* Fair.

## E3. Economy Events

### GWE-E31 Market Crash
- *Desc:* Prices swing.
- *How:* Sell/buy timing becomes a minigame.
- *Trigger:* Random week.
- *Feel:* Chaotic.
- *Deps:* shops.
- *Rar:* U.
- *Pay:* Profit or loss.
- *Cx:* M.
- *Bal:* Floor prices.

### GWE-E32 Gold Rush
- *Desc:* A gold mine.
- *How:* Stops fill with prospectors and claim jumpers.
- *Trigger:* Mine found.
- *Feel:* Western.
- *Deps:* money.
- *Rar:* U.
- *Pay:* Gold.
- *Cx:* M.
- *Bal:* Cap.

### GWE-E33 Inflation Month
- *Desc:* Everything costs more.
- *How:* Rewards scale equally.
- *Trigger:* Monthly.
- *Feel:* Goofy.
- *Deps:* shops.
- *Rar:* C.
- *Pay:* Score focus.
- *Cx:* S.
- *Bal:* Net-zero.

### GWE-E34 Monopoly Wars
- *Desc:* Shop chains compete.
- *How:* Coupons reward loyalty.
- *Trigger:* Chains.
- *Feel:* Corporate.
- *Deps:* shops.
- *Rar:* U.
- *Pay:* Coupons.
- *Cx:* M.
- *Bal:* None.

### GWE-E35 Collector's Auction
- *Desc:* Rare items auctioned.
- *How:* Includes items you donated; bids use memories as currency.
- *Trigger:* Museum high.
- *Feel:* Posh.
- *Deps:* museum.
- *Rar:* R.
- *Pay:* Rare items.
- *Cx:* L.
- *Bal:* Rarity capped.

### GWE-E36 Barter Days
- *Desc:* No money.
- *How:* Item-for-item trades only.
- *Trigger:* Lore reason.
- *Feel:* Charming.
- *Deps:* shops.
- *Rar:* U.
- *Pay:* Variety.
- *Cx:* S.
- *Bal:* Fair rates.
