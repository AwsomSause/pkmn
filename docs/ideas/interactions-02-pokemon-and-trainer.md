# Interactions 02: Pokémon and their trainer, reactions to choices and outcomes (I-111 to I-220)

Part 2 of 5. Design ideas only. Format: **Name** — *What* · *How* · *Why* · `Cx` (S/M/L) · `Sys` (systems touched). Extends Bond Engine (12 traits), affection, Party Life quirks, narrative defeats, memories log and the Moment Codex. Older one-liners: `ideas/interactions.md` section A and B.

## A. Reactions to the player's decisions

**I-111 Judged Choice** — *What:* party members react when you pick an event option. *How:* after any choice, the 1-2 members whose personality cares (Kind vs a cruel pick, Greedy vs a freebie) show a short emote bubble; bond ±1. *Why:* your decisions are watched. `M` · events, bond, personalities.

**I-112 Disappointed Look** — *What:* a Pokémon sighs when you leave a rare item behind. *How:* skipping a free item shows a lone portrait glance; Greedy members sulk, Frugal ones approve. *Why:* choices have witnesses. `S` · rewards.

**I-113 Second Guess** — *What:* a Pokémon refuses to move when you drag it into a bad swap. *How:* swapping a nearly-fainted ally back into a known-losing matchup makes a Stubborn one resist once (the swap still happens on a second try). *Why:* personality in the interface. `M` · battle, UI.

**I-114 Trusted Call** — *What:* a high-bond Pokémon acts on its own when you hesitate. *How:* if you don't act for 20 seconds in an optional UI moment, an Inseparable partner picks the safe default and says so. *Why:* the game gets the feeling of a partner. `M` · bond, battle UI.

**I-115 Vote of No Confidence** — *What:* the party objects to a terrible plan. *How:* before an optional risky choice with high fail chance, a member says "Are you sure?" If you proceed anyway and it works, they cheer; if not, they don't say I told you so (or Sassy ones do). *Why:* emotional stakes for gambles. `M` · events.

**I-116 Gambler's Glee** — *What:* a Greedy/Playful Pokémon loves a gamble. *How:* slot/coin events: such a member bounces; bond up on win. *Why:* personality drives mood. `S` · events.

**I-117 Safe Route Preference** — *What:* timid members prefer the safe node. *How:* on the map, hovering a risky node shows tiny worried icons for Timid members, ambitious ones show stars. *Why:* decisions with voices. `S` · map UI.

**I-118 Mercy Applause** — *What:* sparing a foe makes the Kind members glow. *How:* spare/release choices trigger bond bumps and a visible glow in Kind members; Ruthless ones mutter. *Why:* moral weight. `M` · events, bond.

**I-119 Heard You Brag** — *What:* a Pokémon overhears the trainer boast to an NPC. *How:* when the player picks a boast dialog option, a Proud member smiles; a Humble one cringes. *Why:* choices land. `S` · dialogue.

**I-120 Protective Glare** — *What:* a Pokémon stands between the trainer and a shady NPC. *How:* merchant/scam NPCs: Protective members step forward; refusing the trade gives bond. *Why:* loyalty. `S` · merchants.

**I-121 Bargain Hunter Pride** — *What:* a Frugal Pokémon is proud of a discount. *How:* buying at a sale gives a short flourish. *Why:* small joy. `S` · shop.

**I-122 Splurge Shame** — *What:* a Pokémon disapproves of a pricey impulse buy. *How:* spending >70% gold in one purchase triggers a sheepish note. *Why:* soft consequences. `S` · shop.

**I-123 Hesitation Tail Wag** — *What:* a Pokémon waits to see your pick. *How:* idle portrait wags/tilts head when you linger on a menu. *Why:* life in idle time. `S` · UI.

**I-124 Drop-In Advice** — *What:* a member whispers a hint on a puzzle event. *How:* high-bond smart personalities give a vague clue (not the answer) when you open certain puzzle events. *Why:* the party as a hint system. `M` · events.

**I-125 Overruled** — *What:* a Pokémon silently overrules you. *How:* if you try to release a member in a Close pair, the partner steps between; you have to confirm twice. *Why:* heavy decisions deserve friction. `S` · release.

**I-126 Shared Joke** — *What:* a callback to an in-joke. *How:* a line from a past scene returns later in a different context, tracked by Album flags. *Why:* shared history. `M` · Album.

**I-127 Cherry-Picked Memory** — *What:* a Pokémon recalls the trainer's best decision. *How:* at a low point (loss), a member mentions the best win. *Why:* encouragement from memory. `M` · memories.

**I-128 Pep Talk Request** — *What:* a doubtful Pokémon asks for reassurance. *How:* after two faints it asks; options: praise, hug, tough love; each personality responds differently. *Why:* a mini-dialog with consequence. `M` · bond.

**I-129 Quiet Lead** — *What:* the lead Pokémon looks back to check on the trainer. *How:* walking sprite turns its head when the trainer is idle. *Why:* a heart beat. `S` · map sprite.

**I-130 Swap Etiquette** — *What:* departing Pokémon says a line as it is switched out. *How:* personalities provide varied exit lines in battle. *Why:* flavor for a repeated action. `S` · battle.

## B. Reactions to battle outcomes

**I-131 Clutch Gratitude** — *What:* a Pokémon thanks the trainer after a risky call worked. *How:* after winning with <10% HP left, the Pokémon turns toward the trainer sprite and cries. *Why:* relief and pride. `S` · battle end.

**I-132 Blamed Self** — *What:* a Pokémon takes the blame after a loss. *How:* on faint at a boss, the fainted member wobbles to apologise; reassure it for a bond gain. *Why:* tenderness. `M` · faint.

**I-133 Angry at Foe** — *What:* a Pokémon is furious after a cheap trick. *How:* after being hit by a status-lock or Fake Out chain, it glares at the foe in the next battle against it; small accuracy flavor. *Why:* grudges drive roleplay. `M` · grudges.

**I-134 Crit Pride** — *What:* a Pokémon struts after a critical hit. *How:* animation difference by personality. *Why:* each Pokémon has style. `S` · battle FX.

**I-135 Missed Move Embarrassment** — *What:* a Pokémon looks sheepish after a miss. *How:* tiny sweat-drop; Perfectionists stew an extra turn (flavor). *Why:* relatable. `S` · FX.

**I-136 Last Stand Roar** — *What:* a Pokémon refuses to faint to a taunt. *How:* once per run, at 1 HP after a taunt, an Inseparable partner gets a cry and Endure-like effect. *Why:* anime moment with a rule. `M` · drama.

**I-137 Hype After Sweep** — *What:* party jumps after a 3-KO streak. *How:* sprite bounce on the map for a few seconds. *Why:* celebration. `S` · UI.

**I-138 Humbling Defeat** — *What:* a full-party wipe prompts a quiet scene. *How:* losing a run ends with a view of the party gathered around the trainer rather than a flat screen. *Why:* defeat with dignity. `M` · narrative defeat.

**I-139 Rematch Fire** — *What:* a Pokémon that lost to a foe burns to rematch. *How:* when meeting that foe/trainer again, the Pokémon pre-battle glows; a small focus bonus. *Why:* payoff for rematches. `M` · nemesis.

**I-140 Overkill Guilt** — *What:* a gentle Pokémon is upset after crushing a weak foe. *How:* Kind types look down after one-shotting a level-20-lower foe. *Why:* personality in victory. `S` · FX.

**I-141 Survivor's Bond** — *What:* two Pokémon who survived the same near-wipe bond. *How:* those on the field at party wipe's last turn get +chemistry. *Why:* shared trauma. `M` · chemistry.

**I-142 Proud of Weakest** — *What:* when the weakest member lands a KO, the trainer sprite jumps. *How:* if a level-15-below member lands the KO on a boss minion, a special shout and bond bonus. *Why:* underdog glory. `M` · bond.

**I-143 Trauma Flashback** — *What:* a brief screen flash when a Pokémon meets the foe that once KO'd it. *How:* short filter overlay and a trembling cry; passes. *Why:* memory as drama. `S` · FX, memories.

**I-144 Victory Cry Choir** — *What:* team cries in sequence at the end. *How:* order by closeness; lone Independent shouts last. *Why:* fun sound. `S` · audio.

**I-145 Tough Love** — *What:* the trainer scolds after a careless faint. *How:* optional prompt: scold or comfort; Sassy Pokémon respect the scold; Shy ones shrink. *Why:* agency. `M` · bond.

**I-146 Bring the Fire Back** — *What:* a bench Pokémon asks to be sent in after a loss. *How:* after a faint streak, the benched Pokémon with highest affection bounces and asks; picking it gives a morale edge. *Why:* proactive Pokémon. `M` · battle.

**I-147 Waiting Room Worry** — *What:* the party waits outside the Pokémon Center. *How:* after a heal, the healed member sees an anxious huddle at the door. *Why:* shows concern. `S` · hub.

**I-148 Pre-Battle Shiver** — *What:* different jitters pre-boss. *How:* portrait animations by personality: excited, calm, nauseous. *Why:* animates the mood. `S` · UI.

**I-149 Dodge Sass** — *What:* a Pokémon dodges and smirks at the foe. *How:* flavor emote on a miss against it. *Why:* sass. `S` · FX.

**I-150 Debt of Honor** — *What:* a Pokémon who was saved owes a favor. *How:* the rescuer gets a one-time "owed" token: the saved Pokémon later takes a hit for them. *Why:* memorable reciprocity. `M` · battle, chemistry.

## C. Care, feeding and small rituals

**I-151 Preferred Snack Dance** — *What:* a Pokémon dances for its favorite food. *How:* each Pokémon has a favorite berry; offering it triggers a dance and bond. *Why:* personal taste. `S` · items, Album.

**I-152 Hated Food Face** — *What:* it makes a comical face at its least liked food. *How:* offering the wrong berry gets a cute disgust animation and minimal effect. *Why:* quirky. `S` · items.

**I-153 Secret Snack Stash** — *What:* a Pokémon hides a berry. *How:* some members hide an item; later the player finds it in a scene (if they hand it back, bond up). *Why:* personality plus treasure. `M` · items.

**I-154 Bath Time** — *What:* water scene to wash off battle mud. *How:* map node pond; members react by type (Fire dislikes; Water loves); clean look cosmetic. *Why:* silly care. `S` · cosmetics.

**I-155 Brush Together** — *What:* the trainer brushes a Pokémon; others queue. *How:* Hub grooming; a line forms; cosmetic fur shine improves portrait. *Why:* heartwarming. `M` · hub.

**I-156 Photo Request** — *What:* a Pokémon asks to be photographed. *How:* vain members trigger a photo prompt at scenic nodes; picture saved to the Album. *Why:* collectible moment. `M` · Album.

**I-157 Lost Toy** — *What:* a Pokémon misses a lost keepsake. *How:* a Pokémon mopes until you find a "toy" item in a later node, returning it triggers a scene. *Why:* mini quest. `M` · items, quests.

**I-158 Goodnight Ritual** — *What:* each Pokémon has its own bedtime ritual. *How:* the rest screen plays a different ritual per personality. *Why:* depth in a repeated screen. `S` · rest.

**I-159 Sneaky Treat Share** — *What:* trainer sneaks a treat to a favorite. *How:* optional interaction at rest: giving more to one reduces others' mood slightly (jealousy). *Why:* social tradeoffs. `M` · jealousy.

**I-160 Weather Gear** — *What:* the trainer gives a Pokémon a raincoat or scarf. *How:* cosmetic items equipped for weather; each Pokémon loves different ones. *Why:* dress-up with care. `M` · cosmetics.

**I-161 Hair Tug Plea** — *What:* a Pokémon tugs the trainer's sleeve to stop. *How:* Curious member tugs when an unexplored hint (a secret) is near; follow for a find. *Why:* organic hint system. `M` · secrets.

**I-162 Walk Pace Matching** — *What:* the lead slows for slower followers. *How:* walk-speed art matches the lead's speed relative to party. *Why:* tiny detail. `S` · map.

**I-163 Hold My Hand** — *What:* a small Pokémon grabs the trainer sprite's hand on the map. *How:* when afraid, small ones hug the sprite. *Why:* tender. `S` · map.

**I-164 Gift of Flowers** — *What:* a Pokémon presents a flower. *How:* random at 60+ affection: a flower item (cosmetic or a tiny buff); the trainer can wear it. *Why:* gifts from partners. `M` · affection (extends gifts).

**I-165 Shed Skin Keepsake** — *What:* a Pokémon gives you its shed skin/scale. *How:* species-specific keepsake items stored in the Album. *Why:* collectible with meaning. `M` · Album.

**I-166 Warm Hands** — *What:* trainer warms cold Pokémon at the fire. *How:* a hold-interaction heals cold status effects (cosmetic). *Why:* tactile. `S` · UI.

**I-167 Nap on Lap** — *What:* a Pokémon naps on the trainer. *How:* during long Hub idle, they climb into the trainer's lap sprite. *Why:* cozy. `S` · hub.

**I-168 Mood Ring** — *What:* the party UI shows mood as a color. *How:* a gentle color halo per Pokémon: warm = happy, cool = down. *Why:* readable emotion. `M` · UI.

**I-169 Hungry Rumble** — *What:* stomach growl timed comedy. *How:* at the quietest dialog moment, a Pokémon's stomach growls. *Why:* comedic beats. `S` · audio.

**I-170 Shared Umbrella** — *What:* trainer shares an umbrella with the smallest. *How:* rain walking art. *Why:* picture-perfect. `S` · weather.

## D. Pokémon with agency and requests

**I-171 Request: Detour** — *What:* a Pokémon asks to visit a place. *How:* a Curious or Homesick member requests a specific node type; if visited, gets a unique scene and bond. *Why:* player and Pokémon needs mingle. `M` · map.

**I-172 Request: Rematch** — *What:* a Pokémon wants to face a specific foe again. *How:* flagged after a close loss; on meeting, a free pre-battle move boost. *Why:* quest from a Pokémon. `M` · nemesis.

**I-173 Request: Learn a Move** — *What:* a Pokémon is obsessed with learning a move. *How:* asks for a TM; granting it gives huge bond, ignoring it adds slight mood drop. *Why:* personal goals. `M` · TM.

**I-174 Request: Let Me Lead** — *What:* a Pokémon asks to lead once. *How:* put it first for a battle: it gets a fixed "debut" boost and a scene. *Why:* everyone gets a turn. `S` · lead.

**I-175 Request: Sit This Out** — *What:* an injured Pokémon asks to rest. *How:* honoring it (bench a node) heals and bonds; ignoring has no penalty but bond is quiet. *Why:* respecting agency. `S` · rest.

**I-176 Request: Stay Together** — *What:* two Pokémon beg not to be split. *How:* when you box one of a Close pair, the partner protests; if boxed together they share a cell. *Why:* friendship matters in management. `M` · box.

**I-177 Request: A Name** — *What:* a Pokémon wants a nickname. *How:* nameless Close members ask; naming gives bond; refusing sets a quirk "wants a name." *Why:* personality via naming. `S` · nicknames.

**I-178 Request: Fight Alone** — *What:* a Proud Pokémon wants a solo fight. *How:* optional 1v1 vs a lone grunt; win for glory, lose for a lesson. *Why:* character-driven set piece. `M` · battle.

**I-179 Request: Free Me** — *What:* a bonded wild-caught Pokémon asks to return to the wild. *How:* at max bond it requests release at its home route; releasing gives a legacy gift and a cameo in later runs. *Why:* a bittersweet loop. `L` · legacy, release.

**I-180 Request: Show Me The Sea** — *What:* a landlocked Pokémon wants to see the ocean. *How:* seaside node scene where it stands in awe. *Why:* wonder. `S` · regions.

## E. Species and form flavor with the trainer

**I-181 Pikachu Ear Check** — *What:* lead Pikachu perks its ears at events. *How:* species-specific idle animations on map. *Why:* fanservice. `S` · art.

**I-182 Eevee Indecision** — *What:* Eevee tries on stones like hats. *How:* stone-hold animation shows Eevee tilting; evolution scene shows it deciding. *Why:* personality for the iconic. `S` · evolution.

**I-183 Ditto Impersonation** — *What:* Ditto mimics the trainer sprite or a party member. *How:* idle in the party screen; it can pose as another party member for a joke scene. *Why:* signature gag. `M` · art.

**I-184 Snorlax Blocks Path** — *What:* Snorlax in party refuses to budge. *How:* a flavor delay; shifts the rest scene (a snore). *Why:* canon humor. `S` · map.

**I-185 Meowth Coin Hunt** — *What:* Meowth scrounges for coins. *How:* tiny gold bonus found after nodes. *Why:* species trait as mechanic. `M` · gold.

**I-186 Psyduck Headache** — *What:* Psyduck's headaches cause chaos. *How:* random harmless misfires on map (it forgets where it is). *Why:* signature comedy. `S` · map.

**I-187 Gengar Scare Prank** — *What:* Gengar scares the trainer. *How:* random jump scare in menus that costs nothing; Fearful members bolt. *Why:* spooky laughs. `S` · UI.

**I-188 Lucario Aura Sense** — *What:* Lucario senses the emotions of others. *How:* shows a hint icon for the mood of a nearby NPC or event. *Why:* species as tool. `M` · hints.

**I-189 Wobbuffet Counter-Joke** — *What:* Wobbuffet repeats everything. *How:* echoes the last dialog line comically. *Why:* silly echo. `S` · dialogue.

**I-190 Smeargle Painting** — *What:* Smeargle paints the party. *How:* produces a portrait for the Album at rest. *Why:* unique collectible art. `M` · Album.

**I-191 Chansey Egg Giving** — *What:* Chansey offers an egg. *How:* very rare at max bond. *Why:* canon payoff. `M` · eggs.

**I-192 Zorua Illusion Test** — *What:* Zorua disguises as the trainer. *How:* an event where an NPC mistakes it for you. *Why:* shapeshifter comedy. `M` · events.

**I-193 Alolan Form Homesick** — *What:* regional-form Pokémon reminisce. *How:* region scenes when passing through their home region. *Why:* geography ties. `M` · regions, forms.

**I-194 Shiny Preening** — *What:* a shiny knows it is special. *How:* extra sparkle animations on portraits; some are modest. *Why:* shiny has personality. `S` · shiny.

**I-195 Legendary Quiet** — *What:* a caught legendary is aloof. *How:* speaks seldom; its few lines carry weight; on bond cap, one line shows depth. *Why:* mystique. `M` · legendaries.

**I-196 Mega Evolution Strain** — *What:* a Pokémon looks tired after mega. *How:* after battle it needs a moment; comfort option. *Why:* power cost shown. `S` · mega.

**I-197 Dynamax-Like Surge Dizzy** — *What:* big-form Pokémon get dizzy. *How:* post-transformation wobble. *Why:* weight to spectacle. `S` · FX.

**I-198 Fossil Pokémon Wonder** — *What:* revived fossils see the modern world. *How:* confused reactions at modern nodes. *Why:* tender comedy. `S` · events.

**I-199 Ultra Beast Alienness** — *What:* an Ultra Beast reacts oddly to normal things. *How:* odd lines at shops and berry trees. *Why:* strange. `S` · events.

**I-200 Baby Imprint** — *What:* a hatchling imprints on the first face it sees. *How:* follows that character around; trainer or member. *Why:* classic behavior. `M` · eggs, chemistry.

## F. Meta, history and long-run bonds

**I-201 Anniversary Card** — *What:* a card from your Pokémon on the one-year anniversary. *How:* real date check at Hub; display card on the title screen. *Why:* real-time warmth. `M` · Hub, save.

**I-202 Veteran's Look** — *What:* long-time partners age visibly. *How:* portraits get a scar or ribbon from milestone events. *Why:* history on the face. `M` · Album.

**I-203 Returning Partner Greeting** — *What:* a Pokémon you used last run greets you at the Hub. *How:* Hub shows previous run alumni with a wave. *Why:* continuity. `M` · legacy hub.

**I-204 Pokémon Remembers Defeat** — *What:* a Pokémon recalls the run that ended. *How:* if a prior run ended in its faint, it hesitates on the same node. *Why:* memory. `M` · legacy.

**I-205 First Catch Honor** — *What:* the very first Pokémon you ever caught is special. *How:* flagged across profile; it gets a gold pin and unique lines. *Why:* sentimental. `M` · profile.

**I-206 Signature Move Moment** — *What:* a Pokémon's best-used move gets a name. *How:* top KO move gets a nickname ("Old Reliable"). *Why:* personalized. `M` · battle stats.

**I-207 Trophy Shelf Visit** — *What:* Pokémon look at memorabilia. *How:* Hub shelf: they stop at items tied to their memory. *Why:* tangible history. `M` · hub.

**I-208 Letter From Retired Friend** — *What:* a retired Pokémon sends a letter. *How:* arrives at Hub with hints based on its mastery. *Why:* long relationships. `M` · letters.

**I-209 Awkward Reunion** — *What:* a released Pokémon meets you again in the wild. *How:* rare encounter; it remembers and may refuse or rejoin. *Why:* wrenching. `L` · release, encounters.

**I-210 Trainer Growing Old** — *What:* in-world time passes across runs. *How:* trainer portrait acquires small age signs after many runs, Pokémon remark. *Why:* time is felt. `L` · profile.

**I-211 Rival's Pokémon Waves** — *What:* the rival's Pokémon wave at your Pokémon. *How:* during crossing paths, friendly pairs wave; nemesis pairs glare. *Why:* relationships beyond trainers. `M` · rival.

**I-212 Class Photo** — *What:* a time-lapse of your party across the run. *How:* the end screen shows portraits from first to last. *Why:* run summary as story. `M` · end screen.

**I-213 Story Retold** — *What:* a Pokémon tells a new member the party's story. *How:* generated from the run log in 3 lines. *Why:* the log becomes lore. `M` · memories.

**I-214 Wordless Understanding** — *What:* Inseparable pairs finish each other's actions. *How:* post-battle finishing animation synchronization. *Why:* chemistry visible. `S` · FX.

**I-215 Trainer's Tell** — *What:* Pokémon learn the trainer's habits. *How:* the Album records patterns ("always leads with water") and members joke about it. *Why:* the game observes you. `L` · telemetry flavor.

**I-216 Mood Swing Memory** — *What:* a Pokémon recalls how it felt at capture. *How:* capture-time mood becomes a trait note in the Album. *Why:* personal origin story. `M` · Album.

**I-217 Rival of Memories** — *What:* a Pokémon remembers the rival's Pokémon. *How:* if beaten by the rival's ace earlier, it carries that scar. *Why:* tie to rivalry. `M` · rival, memories.

**I-218 Birth-Place Longing** — *What:* a Pokémon looks at its home route. *How:* passing near the node it was caught at triggers a nostalgic scene. *Why:* roots. `M` · map.

**I-219 Final Embrace** — *What:* after the credits, each Pokémon hugs the trainer. *How:* extended ending sequence ordered by bond. *Why:* emotional closure. `M` · ending.

**I-220 Parting Gift to Next Run** — *What:* a retiring Pokémon leaves a hint for the next run. *How:* Legacy record leaves one flavor hint line at run start. *Why:* inheritance. `M` · legacy.
