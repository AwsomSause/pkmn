# Whole-Game Events B: Multi-Stage Storylines (GWE-B01 to B36)

Field key and shared rules as in file A (*Desc, How, Trigger, Feel, Deps, Rar, Pay, Cx, Bal*). Each is a **chain**: `world.chains[id] = {stage, flags}`. A stage advances when a run is finished (not mid-run), delivers a Hub letter and sometimes an optional stop. Chains never block normal play and can be paused in settings.

---

## B1. Mystery Chains

### GWE-B01 The Lost Researcher
- *Desc:* A field researcher vanished; her trail runs through five runs.
- *How:* S1 torn field note at a ruin; S2 her empty camp; S3 her Pokémon waits at a Centre and will not leave; S4 follow it to her hidden lab; S5 she is alive, stuck in a loop of your own runs.
- *Trigger:* Find the note (rare ruin drop) after run 10.
- *Feel:* Notes in her handwriting; the lab has your past teams as holograms.
- *Deps:* Delta Research Week, time-rift events, letters.
- *Rar:* R.
- *Pay:* A time-themed ally Pokémon and the Researcher title.
- *Cx:* L. Chain engine plus five scenes.
- *Bal:* Ally power matches a normal catch.

### GWE-B02 The Cartographer's Missing Page
- *Desc:* Ten map pages scatter across ten runs.
- *How:* Each page found reveals one stop icon permanently; all ten unlock a true secret route.
- *Trigger:* A page drops from random stops (low chance).
- *Feel:* Parchment pickup and a growing atlas in the Hub.
- *Deps:* hidden stops.
- *Rar:* U.
- *Pay:* Small hints, big final route.
- *Cx:* M.
- *Bal:* Reveals show, they never grant.

### GWE-B03 The Museum Heist
- *Desc:* A thief takes a museum exhibit between runs.
- *How:* Clue letters arrive; you pick a suspect each time. A wrong accusation costs a fee; the right one leads to a rematch with a masked trainer who becomes a recurring minor rival.
- *Trigger:* Museum with 20 donated items.
- *Feel:* Noir letters, a spotlight at the museum.
- *Deps:* museum, trainer plaza.
- *Rar:* R.
- *Pay:* The stolen exhibit and a recurring trainer.
- *Cx:* L.
- *Bal:* Fee small; no dead ends.

### GWE-B04 Signals from Nowhere
- *Desc:* A strange tone on the Hub radio.
- *How:* Each run decodes one character from your own run seeds; the full message names where a legend sleeps.
- *Trigger:* Strange-signal event seen twice.
- *Feel:* Static, then a tone.
- *Deps:* strange-signal map event.
- *Rar:* XR.
- *Pay:* A legend encounter.
- *Cx:* M.
- *Bal:* Legend is catchable but hard.

### GWE-B05 The Stolen Starter
- *Desc:* A lab starter vanishes.
- *How:* Chase the thief across runs; at the end the "thief" is the Pokémon itself, who wanted to leave. You release it or invite it back.
- *Trigger:* 10 runs with that region's starters.
- *Feel:* A worried professor.
- *Deps:* starter sets.
- *Rar:* R.
- *Pay:* A special starter variant.
- *Cx:* M.
- *Bal:* Either choice rewards.

### GWE-B06 The Unsent Letters
- *Desc:* Letters addressed to a trainer who does not exist.
- *How:* Letters accumulate and reveal a rival from a world that ended, tying to the False Protagonist system.
- *Trigger:* 5 timeline replays started.
- *Feel:* Unsettling and sad.
- *Deps:* False Protagonist, letters.
- *Rar:* R.
- *Pay:* Lore and a replay cosmetic.
- *Cx:* M.
- *Bal:* None.

### GWE-B07 Whispering Forest
- *Desc:* A forest region goes quiet.
- *How:* Wild Pokémon stop attacking first (tame events) until a Whisperer boss reveals the cause.
- *Trigger:* Forest region cleared 6 times.
- *Feel:* Hushed audio.
- *Deps:* tame events.
- *Rar:* U.
- *Pay:* A calm companion.
- *Cx:* M.
- *Bal:* Tame events still cost turns.

### GWE-B08 The Painted Pokémon
- *Desc:* A wandering painter's murals hold clues.
- *How:* Each region has a mural hinting at a future boss team; finishing all commissions one for the Hub.
- *Trigger:* Visit a painter stop.
- *Feel:* Brushwork animations.
- *Deps:* boss data.
- *Rar:* U.
- *Pay:* Hints and a Hub mural.
- *Cx:* S.
- *Bal:* Hints vague.

### GWE-B09 Echo Cave Mystery
- *Desc:* Voices from your past runs echo.
- *How:* The cave replays your old dialogue lines; over runs they answer differently.
- *Trigger:* 30 runs.
- *Feel:* Eerie double voices.
- *Deps:* memories, Chronicle.
- *Rar:* XR.
- *Pay:* Lore and a memory token.
- *Cx:* M.
- *Bal:* None.

### GWE-B10 The Weather Witch
- *Desc:* A witch sells weather in jars.
- *How:* Each jar sets weather for one fight; the arc ends with her apprentice (a Castform-line Pokémon).
- *Trigger:* Weather event seen 5 times.
- *Feel:* Bottled storms.
- *Deps:* weather.
- *Rar:* U.
- *Pay:* Jars and a Castform.
- *Cx:* M.
- *Bal:* Weather affects the enemy too.

## B2. Rivalry and Faction Arcs

### GWE-B11 Rival Rewrites the Bracket
- *Desc:* Your rival starts cheating in tournaments.
- *How:* Later runs reveal a faction debt behind it; helping pays a long loyalty reward.
- *Trigger:* Rival rank high with a debt record.
- *Feel:* Strained conversations.
- *Deps:* rivalWorld debts, sponsors.
- *Rar:* R.
- *Pay:* Loyalty bonus.
- *Cx:* L.
- *Bal:* Reward fits an Ace-tier ally.

### GWE-B12 The Fall of a Gym Leader
- *Desc:* A leader loses everything and vanishes.
- *How:* Follow them to a tower; choose to fight them at their worst or best.
- *Trigger:* Beat a leader 8 times.
- *Feel:* A somber duel.
- *Deps:* gym tiers.
- *Rar:* R.
- *Pay:* The leader returns as a coach NPC.
- *Cx:* L.
- *Bal:* The two fights differ in difficulty and reward.

### GWE-B13 Succession Crisis
- *Desc:* The Champion retires; four past rivals compete.
- *How:* A season of runs; you back one candidate.
- *Trigger:* 10 Hall of Fame entries.
- *Feel:* Campaign posters in the Hub.
- *Deps:* Hall of Fame, rival hall.
- *Rar:* R.
- *Pay:* The winner remembers your support.
- *Cx:* XL.
- *Bal:* No mandatory support.

### GWE-B14 The Defector
- *Desc:* A faction admin seeks refuge.
- *How:* Hide them over runs; they feed map intel until their boss arrives.
- *Trigger:* Faction defeated twice.
- *Feel:* Tense, late-night visits.
- *Deps:* factions.
- *Rar:* R.
- *Pay:* Intel and a final showdown.
- *Cx:* L.
- *Bal:* Intel limited.

### GWE-B15 The Long Goodbye
- *Desc:* A mentor's final lessons.
- *How:* One lesson per run; the last is a retirement gift.
- *Trigger:* Meet the mentor event.
- *Feel:* Warm.
- *Deps:* mentor NPC.
- *Rar:* U.
- *Pay:* A legacy move.
- *Cx:* M.
- *Bal:* Move is mid-tier.

### GWE-B16 Sibling Rivalry
- *Desc:* The rival's kid sibling grows up.
- *How:* The child appears each run slightly stronger and becomes a new rival archetype.
- *Trigger:* Rival at rank 3.
- *Feel:* Cute at first, then a threat.
- *Deps:* Living Rival.
- *Rar:* U.
- *Pay:* A new rival.
- *Cx:* M.
- *Bal:* Scales with your progress.

### GWE-B17 The Friendly Feud
- *Desc:* Two leaders argue over a festival date.
- *How:* Supporting one shifts the town's shop theme permanently.
- *Trigger:* Visit the town 10 times.
- *Feel:* Banter.
- *Deps:* shops.
- *Rar:* U.
- *Pay:* A shop theme.
- *Cx:* S.
- *Bal:* None.

### GWE-B18 Cold Case
- *Desc:* A vanished nemesis returns reformed.
- *How:* Accepting them on a team turns their archetype to Redeemed.
- *Trigger:* A nemesis slipped away 3 times.
- *Feel:* Quiet reconciliation.
- *Deps:* nemesis.
- *Rar:* R.
- *Pay:* A loyal ally.
- *Cx:* M.
- *Bal:* Treated as a normal recruit.

### GWE-B19 Faction Civil War
- *Desc:* A faction splits.
- *How:* Territory shifts each run; the winner decides which items shops carry.
- *Trigger:* Faction at max standing.
- *Feel:* Two banners on the map.
- *Deps:* factions.
- *Rar:* R.
- *Pay:* Shop changes.
- *Cx:* L.
- *Bal:* Neutral supplies stay.

### GWE-B20 The Rival's Wedding
- *Desc:* A celebration of long friendship.
- *How:* Every NPC you met attends; small choices shape gifts.
- *Trigger:* Rival at the highest friendly rank.
- *Feel:* Music and confetti.
- *Deps:* Living Rival.
- *Rar:* XR.
- *Pay:* Unique gifts.
- *Cx:* M.
- *Bal:* None.

## B3. Legend and Myth Arcs

### GWE-B21 Three Keys of the Deep
- *Desc:* Three ocean keys.
- *How:* Each key sits behind a regional boss; combine at the ocean floor to meet a legend.
- *Trigger:* 3 ocean regions cleared.
- *Feel:* Glowing keys in the Hub.
- *Deps:* bosses.
- *Rar:* R.
- *Pay:* A legend encounter.
- *Cx:* L.
- *Bal:* Keys persist across runs.

### GWE-B22 The Sleeping Beast Wakes
- *Desc:* A legend sleeps shallower each run.
- *How:* After enough runs a calm "Awakening" run lets you meet it on its terms.
- *Trigger:* 40 runs.
- *Feel:* Rhythmic breathing in the Hub.
- *Deps:* legends.
- *Rar:* R.
- *Pay:* The legend.
- *Cx:* L.
- *Bal:* No rush; the beast waits.

### GWE-B23 Mythic Ledger
- *Desc:* Myth shards from rare events.
- *How:* Ten shards forge a mythical encounter; shard colour follows your party types.
- *Trigger:* Rare events.
- *Feel:* Gleaming shards.
- *Deps:* rare events.
- *Rar:* R.
- *Pay:* A mythical.
- *Cx:* M.
- *Bal:* Rare drops.

### GWE-B24 The Guardian Pact
- *Desc:* A guardian tests fairness.
- *How:* A region with no losses, revives or consumables earns a boon; failing hints at a retry window.
- *Trigger:* Guardian shrine found.
- *Feel:* Solemn.
- *Deps:* challenge flags.
- *Rar:* R.
- *Pay:* A boon.
- *Cx:* M.
- *Bal:* Opt-in.

### GWE-B25 The Divided Legend
- *Desc:* A legend splits by faction.
- *How:* World state decides which half you fight; reuniting needs both quests.
- *Trigger:* Two faction chains complete.
- *Feel:* Echoing roars.
- *Deps:* factions.
- *Rar:* XR.
- *Pay:* The united legend.
- *Cx:* XL.
- *Bal:* Hard.

### GWE-B26 Dream Eater's Season
- *Desc:* Missing scenery in the Hub.
- *How:* Finding the missing pieces restores Hub items.
- *Trigger:* Rare Psychic event.
- *Feel:* Strange gaps.
- *Deps:* Hub.
- *Rar:* U.
- *Pay:* Hub items.
- *Cx:* M.
- *Bal:* None.

### GWE-B27 Moon Orchard
- *Desc:* Full-moon fruit.
- *How:* One pick per moon, five picks tell a constellation story.
- *Trigger:* Full moon dates.
- *Feel:* Silver light.
- *Deps:* calendar seed.
- *Rar:* U.
- *Pay:* Moon items.
- *Cx:* M.
- *Bal:* Once per moon.

### GWE-B28 The Tower of Names
- *Desc:* A tower of lost Pokémon.
- *How:* Climb floors; each floor is a memory battle for a Pokémon you lost, giving closure and a keepsake.
- *Trigger:* 10 lost Pokémon in history.
- *Feel:* Emotional.
- *Deps:* memories, defeat.
- *Rar:* R.
- *Pay:* Keepsakes.
- *Cx:* L.
- *Bal:* Optional; never punishing.

### GWE-B29 The Last Egg
- *Desc:* An egg that waits.
- *How:* Hatches only after a 10-run story arc of friendship milestones.
- *Trigger:* Find the egg.
- *Feel:* Gentle.
- *Deps:* eggs.
- *Rar:* XR.
- *Pay:* A unique form.
- *Cx:* L.
- *Bal:* Slow by design.

### GWE-B30 Curse of the Crimson Moon
- *Desc:* A red moon.
- *How:* Shiny odds spike, bosses get aggressive; a three-run ritual lifts the curse.
- *Trigger:* Rare date event.
- *Feel:* Red-tinted UI.
- *Deps:* shiny odds.
- *Rar:* XR.
- *Pay:* Shinies and a risk.
- *Cx:* M.
- *Bal:* Aggression moderate.

## B4. Social and Quiet Arcs

### GWE-B31 The Pen Pal
- *Desc:* An anonymous correspondent.
- *How:* Replies by choice; the final letter is a visit.
- *Trigger:* 15 runs.
- *Feel:* Letters.
- *Deps:* Hub mail.
- *Rar:* U.
- *Pay:* A friend.
- *Cx:* S.
- *Bal:* None.

### GWE-B32 The Apprentice
- *Desc:* A kid wants to learn.
- *How:* Each run a lesson (choice); the apprentice's team reflects your style and later appears as a trainer.
- *Trigger:* 25 runs.
- *Feel:* Charming.
- *Deps:* playstyle titles.
- *Rar:* R.
- *Pay:* A recurring trainer.
- *Cx:* L.
- *Bal:* Scales fairly.

### GWE-B33 The Lighthouse Keeper's Diary
- *Desc:* A cozy arc with no combat.
- *How:* Pages about weather and gulls end in a free Hub decoration.
- *Trigger:* Lighthouse relit (A05).
- *Feel:* Peaceful.
- *Deps:* letters.
- *Rar:* U.
- *Pay:* Decoration.
- *Cx:* S.
- *Bal:* None.

### GWE-B34 Village Recovery
- *Desc:* A wrecked village rebuilds.
- *How:* Donate resources across runs; the village becomes a market town.
- *Trigger:* Disaster event.
- *Feel:* Visible growth.
- *Deps:* shops.
- *Rar:* U.
- *Pay:* A new shop line.
- *Cx:* M.
- *Bal:* Donations capped.

### GWE-B35 The Band Gets Together
- *Desc:* Musicians join one by one.
- *How:* Each run adds an instrument layer to Hub music; a concert unlocks a battle theme remix.
- *Trigger:* Music events.
- *Feel:* Layered music.
- *Deps:* music pack.
- *Rar:* U.
- *Pay:* A remix.
- *Cx:* M.
- *Bal:* None.

### GWE-B36 Retirement Home
- *Desc:* Retired Pokémon bicker about "the good run".
- *How:* Small mini arcs in a Hub home.
- *Trigger:* 10 retired Pokémon.
- *Feel:* Funny and warm.
- *Deps:* Hall of Fame, party life.
- *Rar:* R.
- *Pay:* Tips and friendship.
- *Cx:* M.
- *Bal:* None.
