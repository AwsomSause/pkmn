# Interactions 01: Pokémon with Pokémon (I-001 to I-110)

Part 1 of 5 of the 500+ interactions library. Design ideas only; nothing here is built. Format per entry: **Name** — *What* it is · *How* it plays · *Why* it's memorable · `Cx` = complexity (S small, M medium, L large) · `Sys` = systems touched.

Already shipped (do not duplicate, extend instead): Party Life has 12 personalities, 8 quirks, per-pair chemistry (5 stages), grudges, pacts, and 57 authored scenes (campfire, huddle, comfort, newcomer welcome, debrief, box sulk). Older one-liners live in `ideas/interactions.md` section G. This part goes deeper: sleeping, comfort, jealousy, respect, mentorship, fear, species- and type-specific pairings. Mood and chemistry words below refer to the existing `partyLife` pair chemistry unless noted.

## A. Rest, sleep and closeness

**I-001 Heap of Sleepers** — *What:* two or more tired Pokémon fall asleep touching at a long rest. *How:* at a rest stop when 2+ members are below 50% HP and chemistry is Friendly or higher, the camp art shows them piled; wake-up heals 5% extra. *Why:* the cheapest cozy image in the game. `S` · partyLife, rest stop, art.

**I-002 Shoulder Perch** — *What:* a Flying type naps on a bigger friend's back. *How:* any Flying type with a Close partner ≥ twice its weight rides on the map screen idle portrait. *Why:* tiny visual that makes the party feel like a family. `S` · partyLife, map portrait.

**I-003 Blanket Thief** — *What:* a sleeper steals the whole shared blanket. *How:* campfire scene where one random member (Greedy or Playful quirk) ends up wrapped; the cold one wakes a bit grumpy (−1 mood stage next battle, cosmetic only). *Why:* comedy with a tiny cost. `S` · partyLife campfire, quirks.

**I-004 Fever Watch** — *What:* a Pokémon with a status condition is watched through the night. *How:* if someone is Poisoned/Burned at rest, a Close partner stays awake; both get a small chemistry bump and the sick one is cured at dawn. *Why:* care without a menu. `M` · status, partyLife, rest.

**I-005 Back-to-Back** — *What:* two rivals-turned-friends sit back-to-back by the fire. *How:* triggers when a grudge pair reaches Friendly; they never look at each other in the art. *Why:* the "we don't talk about it" friendship. `S` · grudges, chemistry.

**I-006 Lap Sitter** — *What:* the smallest Pokémon climbs into the biggest one's lap. *How:* rest stop; smallest by weight picks the gentlest personality in the party. *Why:* scale contrast is adorable. `S` · partyLife, art.

**I-007 Night Terror Hug** — *What:* a Pokémon wakes screaming from a faint it remembers. *How:* after a run where it fainted twice, a nearby friend wraps around it at the next rest; it sleeps. *Why:* trauma and comfort in four lines. `M` · memories, faint history.

**I-008 Snore Duet** — *What:* two sleepers snore in rhythm. *How:* pure flavor: cry audio layered at low volume at night rests. *Why:* sound makes a camp feel inhabited. `S` · audio, rest.

**I-009 Sleep-Talking** — *What:* a sleeping Pokémon mumbles a secret. *How:* one line reveals a hidden fact (its favorite berry, its fear, who it admires); logged in the Album. *Why:* free character reveals. `S` · Album, personalities.

**I-010 Cold Snap Huddle** — *What:* in snow, the whole party tightens up. *How:* snow weather at rest stop makes all pairs act as if one chemistry stage higher for that scene. *Why:* weather shaping relationships. `S` · weather, partyLife.

**I-011 Heat Wave Sprawl** — *What:* in heat, nobody wants to touch anyone. *How:* opposite of I-010; Fire types are smug, Water types hog the shade. *Why:* personality flips with climate. `S` · weather.

**I-012 Moonlit Wanderer** — *What:* an Insomniac goes for a walk under a full moon. *How:* one insomniac member walks out; a Ghost or Dark friend follows silently; they come back with a found item. *Why:* quiet little story. `M` · quirks, day/night.

**I-013 Pillow Fort** — *What:* the party builds a fort from supplies. *How:* spend 1 Potion-class item at rest; every member is "cozy" and gets +2 affection. *Why:* a use for junk items. `S` · items, affection.

**I-014 Bedtime Story** — *What:* the oldest member tells the young ones a story. *How:* oldest by catch order narrates a randomly picked past event of this run (from the memories log). *Why:* the game retells your run as myth. `M` · memories log, rest.

**I-015 Stretching Line** — *What:* morning stretches in order of height. *How:* flavor scene at dawn rest for parties of 5+. *Why:* silly rhythm. `S` · art.

## B. Comfort and care

**I-016 Tail Dab** — *What:* a Pokémon wipes a teammate's tears with its tail. *How:* after a loss or a faint; picks the nearest kind personality. *Why:* the kindest scene possible. `S` · partyLife comfort.

**I-017 Berry Peace Offering** — *What:* after an argument one drops a berry in front of the other. *How:* ends any grudge-lite spat; accepting heals 10% HP, refusing starts a standoff (I-077). *Why:* tiny stakes, big feeling. `M` · grudges, items.

**I-018 Carry Out** — *What:* a strong Pokémon carries a hurt friend off the field. *How:* in a battle ending where one member is at <10%, the strongest nearby puts them on its back for the map walk. *Why:* pays off the whole battle visually. `S` · battle end, art.

**I-019 Cheerleader Sidelines** — *What:* benched Pokémon cheer from the sideline. *How:* bench members with Close+ to the active one add a small cry/cheer that grants nothing mechanical unless Inseparable (then +1 crit stage chance tiny). *Why:* the bench stays emotionally involved. `M` · battle, chemistry.

**I-020 Reassuring Nudge** — *What:* a veteran steadies a rookie before a boss. *How:* pre-boss huddle variant when a member is < level 15 under the party average; rookie gets a one-battle focus buff. *Why:* mentorship moment with a use. `M` · pre-boss huddle.

**I-021 Medicine Sharing** — *What:* a healthy one gives half its berry to a sick one. *How:* costs the giver 5% HP, heals the receiver more. *Why:* sacrifice, small. `S` · rest.

**I-022 Hand-Me-Down Scarf** — *What:* a Pokémon gives its held cosmetic item to a friend. *How:* if chemistry Trusted Partners, a held accessory moves with a short animation. *Why:* sentimental object history. `M` · held items, Album.

**I-023 Gentle Shove** — *What:* a shy Pokémon gets pushed forward by a friend to meet a newcomer. *How:* new recruit scene variant for Shy quirk. *Why:* shy getting included. `S` · newcomer welcome.

**I-024 Whisper Pep Talk** — *What:* two Pokémon whisper off-screen before a hard fight. *How:* subtitle shows "…". Both get a small cosmetic aura. *Why:* mystery. `S` · pre-boss.

**I-025 Group Lick Wounds** — *What:* after a tough battle, multiple members tend to the hurt one. *How:* three or more present: heals extra scaled by count. *Why:* "everyone helps" is the heart of the game. `S` · rest.

**I-026 Lullaby Swap** — *What:* two singers trade lullabies. *How:* two members with sound moves at rest swap one move-flavor; cosmetic text only. *Why:* culture exchange. `S` · moves, flavor.

**I-027 Wound Comparison** — *What:* veterans compare scars. *How:* two members with the most faints boast; Playful ones exaggerate. *Why:* funny, tough-friend vibe. `S` · memories.

**I-028 Silent Vigil** — *What:* the party gathers around a fainted member's ball before the Pokémon Center. *How:* extends existing "gather round"; after a revive item, the revived is greeted by name in order of closeness. *Why:* revive moments get ritual. `S` · partyLife faint.

**I-029 Patch Job** — *What:* a Steel or Rock type braces a cracked friend. *How:* hurt Bug/Ghost/Grass friend near Steel/Rock: next battle starts with a small Defense edge. *Why:* type-flavored help. `M` · type affinity.

**I-030 Mirror Reassurance** — *What:* a nervous Pokémon checks itself in a pond. *How:* a friend stands beside it in the reflection; nervousness cleared. *Why:* images tell the whole story. `S` · map art.

## C. Rivalry, jealousy, respect

**I-031 Sibling Squabble** — *What:* two members of the same evolution line bicker. *How:* same family tree in party triggers a recurring mild argument scene; resolved by either evolving. *Why:* species lore as personality. `M` · evolution, partyLife.

**I-032 Spotlight Sulk** — *What:* a Pokémon sulks when another gets a nickname/item/evolution. *How:* jealous quirk triggers on the next rest after a good thing happens to someone else; the Sulker gets an item to calm. *Why:* jealousy is human. `M` · quirks, affection.

**I-033 Level Race** — *What:* two peers compete to level faster. *How:* flavor counter in Album; at tie they both gain a tiny EXP share. *Why:* friendly competition. `M` · EXP, Album.

**I-034 Staring Contest** — *What:* two stubborn Pokémon stare until one blinks. *How:* flavor scene; loser sulks 1 node; winner gets a chemistry tick. *Why:* pure silliness. `S` · scenes.

**I-035 Respect Nod** — *What:* a proud Pokémon finally nods at a friend. *How:* when a Proud personality's partner clutches a boss KO, a one-time nod line plays and chemistry jumps one stage. *Why:* earned respect is rare. `M` · chemistry, boss.

**I-036 Borrowed Move Pride** — *What:* a student shows a mentor the move it just learned. *How:* at level-up learning an egg/TM move, the older party member in the same type reacts. *Why:* mentor/student arc. `M` · moves, level up.

**I-037 Rank Squabble** — *What:* the party argues over who leads. *How:* at run start with 2 Leader-type personalities, a short scene resolves by lead pick; the loser later sulks if lead stays. *Why:* the lead slot has social meaning. `M` · lead, personalities.

**I-038 Friendly Tackle** — *What:* a playful body check. *How:* two Playful quirk friends knock each other over; one randomly drops a berry. *Why:* roughhousing is nostalgic. `S` · scenes.

**I-039 Underdog Cheer** — *What:* the whole party cheers the weakest in a sparring match. *How:* training scene before a gym: lowest level fights a stand-in; party shouts; small one-battle morale. *Why:* underdogs. `M` · pre-gym, morale.

**I-040 Poached Berry** — *What:* a glutton eats a friend's saved berry. *How:* Glutton quirk steals; victim holds a grudge-lite for 2 nodes. *Why:* mischief with a tell. `S` · quirks, items.

**I-041 Turf Marking** — *What:* two territorial types mark opposite sides of the camp. *How:* Ground/Dark pair; they don't sit beside each other until chemistry ≥ Close. *Why:* shows relationship by seating. `S` · art.

**I-042 Starter Rivalry** — *What:* two Pokémon from the same starter set can't stand each other. *How:* if both are from the same starter box, a flavor line refers to "the old days." *Why:* history. `S` · starter sets.

**I-043 Idol Worship** — *What:* a young Pokémon idolizes a champion member. *How:* a Pokémon with ≥20 levels difference follows the champion around; gets small stat mimic of its highest stat. *Why:* hero worship. `M` · levels, stats.

**I-044 Rival Within** — *What:* two near-identical Pokémon (same species) compete. *How:* two copies of a species; each tries to outdo the other with different nature; the Album tracks "who's better." *Why:* duplicates have identity. `M` · duplicates, natures.

**I-045 Tag-Team Callout** — *What:* partners call each other's names in a clutch. *How:* at 3+ ally faints, a Trusted Partner pair yells; both get a surge (once per run). *Why:* hype. `M` · drama, chemistry.

**I-046 Overshadowed** — *What:* a shiny/legendary overshadows a regular Pokémon. *How:* when a shiny joins, a plain teammate with Insecure quirk looks down; reassurance scene later. *Why:* nuanced emotion. `M` · shiny, quirks.

**I-047 Gym Leader Envy** — *What:* a Pokémon sees a boss's ace and wants to be like it. *How:* after a boss fight, one member of the same type gets a motivation boost. *Why:* ambition. `M` · boss, types.

**I-048 Hand Shake Duel** — *What:* two Fighting types test strength with a handshake. *How:* flavor; result uses Attack stat comparison for text only. *Why:* classic manga beat. `S` · stats.

**I-049 Grudging Respect** — *What:* ex-grudge pair acknowledges each other. *How:* when a grudge is settled by a clutch rescue, one says "…thanks." *Why:* redemption arcs. `S` · grudges.

**I-050 Bragging Rights** — *What:* after a boss win each claims the credit. *How:* debrief scene lines vary by who did most damage. *Why:* the game tracks real contribution. `M` · battle stats.

## D. Mentor, family, newcomers

**I-051 Teacher's Pet** — *What:* a Smart-type pupil follows a mentor. *How:* Psychic/Normal elder teaches a flavor move; pupil gains a hint on the next event dialogue. *Why:* teaching matters. `M` · events.

**I-052 Surrogate Parent** — *What:* an Egg is looked after by a motherly personality. *How:* carry an Egg → a Caring member hovers; hatchling imprints on them (starts with higher chemistry). *Why:* eggs get a family. `M` · eggs, chemistry.

**I-053 Hatch Day Welcome** — *What:* the party gathers around a hatching egg. *How:* each member reacts by personality in sequence. *Why:* hatch is an event. `S` · eggs.

**I-054 Baby Duty** — *What:* a baby Pokémon is passed around. *How:* a baby (Pichu, Togepi...) rotates between laps; each Pokémon's reaction differs. *Why:* chaotic cuteness. `S` · babies.

**I-055 Elder's Last Wisdom** — *What:* a very old Pokémon (many runs) offers advice. *How:* a veteran with ≥3 run appearances gives a hint at the start. *Why:* the long game rewards loyalty. `M` · legacy.

**I-056 Name Day** — *What:* a newcomer is given a nickname by friends. *How:* friends suggest 3 nicknames; the player picks; the proposer is happy. *Why:* nicknames with authorship. `M` · nicknames.

**I-057 New Kid Test** — *What:* veterans test a newcomer. *How:* a short sparring beat; no stakes; newcomer's chemistry starts based on result. *Why:* hazing, gentle. `M` · newcomers.

**I-058 Evolving Together** — *What:* two friends evolve around the same time. *How:* if two evolve within 3 nodes the scene "Twins" plays. *Why:* synchronicity. `S` · evolution.

**I-059 Pre-Evolution Photo** — *What:* friends photograph the pre-evo form. *How:* pre-evolution picture added to the Album when evolving with Close+ friends. *Why:* nostalgia. `S` · Album.

**I-060 Fresh Evolution Teasing** — *What:* friends tease a newly evolved one for its new looks. *How:* tone depends on personality; shy evolved ones blush. *Why:* funny and warm. `S` · evolution, scenes.

## E. Type- and species-specific pairings

**I-061 Water Splash Fight** — *What:* Water types splash a Fire type. *How:* Fire + Water pair at a pond: Fire is mock-furious. *Why:* fits the type chart in story. `S` · types.

**I-062 Fire Warms Grass** — *What:* a Fire type lights a fire for a shivering Grass type. *How:* snow rest; Grass gets cozy; Fire gets glow. *Why:* type cooperation. `S` · weather.

**I-063 Electric Static Prank** — *What:* an Electric type shocks a friend with static. *How:* Playful quirk; victim's hair puffs out. *Why:* classic gag. `S` · quirks.

**I-064 Ghost Pranking** — *What:* a Ghost scares everyone at the campfire. *How:* random scare; Fearful quirk jumps; Ghost-immune Normal types are baffled. *Why:* Ghost-type immunity gag. `S` · types.

**I-065 Ground Burrow Hideout** — *What:* a Ground type digs a shelter. *How:* rest stop in rain: Ground type digs a burrow; friends hide inside. *Why:* ecology. `S` · weather.

**I-066 Psychic Mind Link** — *What:* two Psychics speak without words. *How:* subtitles; chemistry gain faster. *Why:* an alien bond. `M` · chemistry.

**I-067 Dragon's Pride** — *What:* a Dragon refuses help but gets it anyway. *How:* Dragon with a Kind partner; the partner fixes things behind its back. *Why:* characterization. `S` · scenes.

**I-068 Fairy Flower Crown** — *What:* a Fairy type gives a flower crown. *How:* Fairy + any: the receiver wears the crown on the portrait. *Why:* a cosmetic with meaning. `M` · cosmetics.

**I-069 Bug Swarm Choir** — *What:* Bug types hum. *How:* Bug-heavy parties hum at night; makes the camp a lullaby. *Why:* audio flavor. `S` · audio.

**I-070 Rock Skipping Contest** — *What:* Rock type and Water type skip stones. *How:* simple scene; winner brags. *Why:* friendly rivalry. `S` · scenes.

**I-071 Poison Mixing Tea** — *What:* a Poison type brews an odd tea for the sick. *How:* heals but tastes awful; all react. *Why:* comic care. `S` · rest.

**I-072 Normal Type Mediator** — *What:* a Normal type resolves disputes. *How:* when two members argue, a Normal type steps between; chemistry of the arguing pair rises. *Why:* the peacekeeper role. `M` · grudges.

**I-073 Steel Polish Time** — *What:* a Steel type polishes itself while others watch. *How:* vain Steel types; Proud quirk. *Why:* vanity humor. `S` · quirks.

**I-074 Ice Slide** — *What:* an Ice type makes a slide for the party. *How:* snow rest: everyone slides; a Fire type refuses then secretly tries. *Why:* delight. `S` · weather.

**I-075 Fighting Spar Lines** — *What:* two Fighting types train at dawn. *How:* repeated spar gives small EXP bonus; they brag. *Why:* training montage. `M` · EXP.

**I-076 Pikachu Cheeks Spark** — *What:* species cry-synced cheeks light when excited. *How:* species-specific art gag. *Why:* pure fanservice. `S` · art.

**I-077 Standoff** — *What:* two Pokémon refuse to apologise. *How:* following a refused offering (I-017), they won't sit together until a third friend intervenes. *Why:* social puzzles. `M` · grudges.

**I-078 Eevee Option Debate** — *What:* the party argues about which evolution Eevee should choose. *How:* when Eevee holds an evolution stone, party members argue in lines by type. *Why:* meme that is actually fun. `M` · evolution.

**I-079 Magikarp Pep Rally** — *What:* everyone encourages Magikarp. *How:* Magikarp level < 20: friends cheer; at Gyarados evolution they all stare in awe. *Why:* a classic payoff. `S` · evolution.

**I-080 Slowpoke Delay** — *What:* the party waits for Slowpoke. *How:* map walk is delayed by flavor; Slowpoke finds an item "late." *Why:* character humor. `S` · map.

## F. Fear, tension, strange

**I-081 Fear of the Same Type** — *What:* a Pokémon trembles near a type that once KO'd it. *How:* after two faints to one type, the Pokémon hides behind a friend when that type shows. *Why:* scars matter. `M` · memories, faint history.

**I-082 Shield Friend** — *What:* a friend steps between the scared one and the threat. *How:* extends I-081 with a Brave partner; the scared one's fear lifts. *Why:* closure. `M` · chemistry.

**I-083 Bad Omen** — *What:* a Pokémon senses danger. *How:* Psychic/Ghost warns before a boss (flavor + hint of boss type). *Why:* foreshadowing. `S` · hints.

**I-084 Haunted Teammate** — *What:* a Ghost teammate is seen staring at empty corners. *How:* flavor when running past a ruins node. *Why:* unease. `S` · map.

**I-085 Storm Fright** — *What:* thunderstorms scare small Pokémon. *How:* rain+thunder: small members hide in a bigger one's fur. *Why:* weather as emotion. `S` · weather.

**I-086 Dark Cave Clinging** — *What:* in a dark cave the party forms a chain. *How:* map node cave: members hold tails in a line; a Fire type leads. *Why:* a gentle image. `S` · map.

**I-087 Betrayal Whisper** — *What:* one suspects another of hiding a secret. *How:* Suspicious quirk watches a Sneaky member; reveal later is harmless (a stash). *Why:* mystery with a soft twist. `M` · quirks.

**I-088 Uneasy Truce** — *What:* two recently-grudged Pokémon fight side by side. *How:* in a boss, the pair covers each other with a small bonus. *Why:* forced cooperation. `M` · grudges, boss.

**I-089 Missing Piece** — *What:* the party notices an empty seat after a death-like event. *How:* in modes with permadeath, the fire has a gap; friends place a berry there. *Why:* heartbreaking. `S` · permadeath.

**I-090 Rumor Mill** — *What:* the party gossips. *How:* two chatty members share fake "news" about a future node; sometimes true. *Why:* creates anticipation. `M` · events preview.

## G. Group scenes and rituals

**I-091 Party Photo** — *What:* all members line up for a group photo. *How:* hotkey at the Hub or rest; Album stores the pose; positions reflect chemistry. *Why:* who stands beside whom tells a story. `M` · Album, chemistry.

**I-092 Victory Dance Chain** — *What:* a conga line after a boss. *How:* order based on closeness. *Why:* celebrating. `S` · boss.

**I-093 Rain Dance for Real** — *What:* the team does a ritual dance to summon rain. *How:* flavor; 20% to start rain at the next node. *Why:* silly ritual, real effect. `M` · weather.

**I-094 Rock-Paper-Scissors** — *What:* settling who gets the best bed. *How:* outcome shown; loser gets the draft spot (cosmetic). *Why:* comic. `S` · scenes.

**I-095 Team Cheer** — *What:* a pre-battle huddle chant. *How:* each personality contributes a word; the chant becomes the party's motto in the Album. *Why:* identity. `M` · culture.

**I-096 Culture Drift** — *What:* party traditions mutate. *How:* tradition lines change as members join/leave. *Why:* the party has a living culture. `M` · partyLife culture.

**I-097 Seat at the Fire** — *What:* the seat arrangement shows politics. *How:* the camp art arranges by chemistry and standing; new members get the outer seats. *Why:* visual information. `M` · art.

**I-098 Shared Meal Ritual** — *What:* the party eats together. *How:* each food preference creates a different meal; picky ones bargain. *Why:* meals are bonding. `M` · food, affection.

**I-099 Song Circle** — *What:* members pass a melody. *How:* cries compose a tune; saved as a "party theme" for the Album music player. *Why:* a unique song per run. `L` · audio, Album.

**I-100 Passing the Watch** — *What:* night watch passes member to member. *How:* each takes a shift; random mini-event by shift owner (a Ghost sees something; a Normal falls asleep). *Why:* varied nights. `M` · rest events.

**I-101 Reunion After Box** — *What:* a boxed Pokémon rejoins and everyone runs to it. *How:* withdraw from box after 10+ nodes; welcome scene by chemistry. *Why:* the box has emotional weight. `M` · box, partyLife.

**I-102 Farewell Line-Up** — *What:* members say goodbye when one is released/traded. *How:* each says a line; Close ones tear up. *Why:* parting hurts. `S` · release.

**I-103 Gift Exchange** — *What:* members exchange small gifts at milestones. *How:* items found earlier are handed over; the receiver's reaction lines vary. *Why:* generosity as mechanic. `M` · items.

**I-104 Impromptu Race** — *What:* two fast members race on the map. *How:* quick-time flavor; winner picks the campsite. *Why:* low-cost excitement. `S` · map.

**I-105 Storytelling Contest** — *What:* each member tells a (possibly exaggerated) tale. *How:* tales drawn from the run log with exaggeration by quirk; the party votes. *Why:* a chance to remember your own run. `M` · memories.

**I-106 Honor Guard** — *What:* party lines up for a retiring member. *How:* a maxed-mastery Pokémon retiring to the Hub gets a guard of honor. *Why:* closure. `S` · mastery.

**I-107 The Long Look** — *What:* before the final boss, everyone looks at each other. *How:* a single silent shot with portraits fading in order of chemistry. *Why:* tension and love. `S` · final boss.

**I-108 First Snow Awe** — *What:* a Pokémon from a warm region sees snow. *How:* the first snow node in a run: warm-region members are enchanted; Ice natives explain. *Why:* geography as wonder. `S` · regions.

**I-109 Sea Sickness** — *What:* land Pokémon suffer on a boat route. *How:* Ground/Rock types feel sick; Water types fuss over them. *Why:* contrast. `S` · map.

**I-110 Remember When** — *What:* old friends reminisce about a previous run. *How:* members with history across runs mention an event from a past run (Legacy records). *Why:* continuity across runs. `L` · legacy runs, memories.
