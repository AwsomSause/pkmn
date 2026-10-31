# Interactions 03: Trainers, rivals, returning characters, NPCs and merchants (I-221 to I-340)

Part 3 of 5. Design ideas only. Format: **Name** — *What* · *How* · *Why* · `Cx` (S/M/L) · `Sys`. Already shipped: 14 rival events (rescue, bad day, photo, montage, promise, acknowledge, Rival Clash, gauntlet rest), Hub letters/visits, final boss rival assist, Nemesis system, rival world progress (`core/rivals/progression.ts`: read via `rivalStatus`/`rivalWorldView`, never write directly), False Protagonist replays, Legacy runs. These entries extend those.

## A. Rival interactions

**I-221 Rival Reads Your Badge Case** — *What:* the rival notices a badge you got first. *How:* after each gym, the next meeting opens with a line about your newest badge, tone from relationship stage. *Why:* progress is noticed. `S` · rival, badges.

**I-222 Rival Copies Your Team Idea** — *What:* rival adapts something you did. *How:* if you ran mono-type last run, the rival fields a counter-type. *Why:* the world reacts to your style. `M` · rival, legacy.

**I-223 Left-Behind Berry** — *What:* the rival leaves a berry on your path. *How:* friendly relationship: a hidden item on the next node, with a note. *Why:* subtle support. `S` · rival, items.

**I-224 Rival Trips Up** — *What:* a rival's mishap shows humanity. *How:* the rival faints dramatically at a node; you can help or pass. *Why:* helps shape the rivalry arc. `M` · rival events.

**I-225 Rival's Pokémon Asks For You** — *What:* the rival's Pokémon tugs at you. *How:* a former teammate released to the rival's team nods at you. *Why:* tie-in with release. `M` · release, rival.

**I-226 Shared Umbrella Rain** — *What:* a rainy-day truce. *How:* the rival offers cover; no battle this node; you learn one fact about their team. *Why:* humanizing rivals. `S` · weather, rival.

**I-227 Rival's Bad Beat** — *What:* the rival loses to a gym leader and takes it out on you. *How:* a snappish mood scene with options (console, tease, ignore). *Why:* relatable. `M` · rival.

**I-228 Rival Trade Offer** — *What:* the rival proposes a swap. *How:* a trade event; decline damages relationship slightly; accept gives a decent Pokémon with a catch. *Why:* tests trust. `M` · trade.

**I-229 Rival's Practice Ground** — *What:* you find the rival training. *How:* optional spar for hints about their ace. *Why:* a scouting reward. `M` · rival.

**I-230 Broken Promise Letter** — *What:* the rival writes about your broken vow. *How:* if you skipped a rival's invite earlier, the letter arrives with a cold tone. *Why:* consequences. `S` · letters.

**I-231 Joint Boss Cheer** — *What:* the rival's voice cheers from off-screen. *How:* on friendly stage, a one-line shout during the final boss. *Why:* emotional lift. `S` · final boss.

**I-232 Rival Sees Your Retired Pokémon** — *What:* rival visits the Hub and meets your alumni. *How:* a Hub visit where the rival compliments or lampoons. *Why:* Hub life. `M` · Hub, legacy.

**I-233 Mirror Match Nod** — *What:* the rival picks the same starter you did in a future run. *How:* dynamic rival picks based on your last run. *Why:* a living rival. `M` · rival, starter sets.

**I-234 Rival Eavesdrop** — *What:* you overhear the rival's private talk. *How:* behind a door, the rival confesses doubt to their Pokémon. *Why:* depth. `S` · events.

**I-235 Rival's Victory Pose Stolen** — *What:* the rival imitates your victory pose. *How:* an animation; you can imitate theirs back. *Why:* playful. `S` · FX.

**I-236 Rival Takes The Last Item** — *What:* you both reach for the last item. *How:* a rock-paper-scissors resolution; the loser gets a consolation. *Why:* petty drama. `S` · events.

**I-237 Rival Visits Your Grave** — *What:* a rival honors a defeat. *How:* after a failed run, the next run's start includes a flower from the rival. *Why:* the death mattered to them. `M` · narrative defeat.

**I-238 Rival Sulks Offscreen** — *What:* the rival isn't there at a gym; reports say they quit. *How:* absence arc; they reappear stronger. *Why:* narrative variety. `M` · rival progression.

**I-239 Rival Asks For A Rematch Date** — *What:* a scheduled rematch you can prepare for. *How:* the rival names a node; you choose whether to arrive; skip changes tone. *Why:* anticipation. `M` · map, rival.

**I-240 Rival's Pokémon Befriends Yours** — *What:* a pair from both teams grows close. *How:* a rival's Pokémon follows you for a node and plays with yours. *Why:* inter-team friendship. `M` · chemistry.

## B. Trainer-to-trainer conversations

**I-241 Veteran Trainer Advice** — *What:* an older trainer gives tips. *How:* after a win, gives a hint based on your lead's weakness. *Why:* learning by chat. `S` · NPC.

**I-242 Trainer Banter Pre-Battle** — *What:* trainers tease each other. *How:* lines reference your party's types and recent events. *Why:* reactive writing. `M` · dialogue.

**I-243 Trainer Rivalry Between NPCs** — *What:* two NPC trainers argue about who is stronger. *How:* you can settle it by battling both; they credit you. *Why:* worldbuilding. `M` · NPC.

**I-244 Trainer Shares Lunch** — *What:* a defeated trainer shares food. *How:* heal a small amount; hear a story. *Why:* kindness after combat. `S` · NPC.

**I-245 Trainer's Pokémon Compliments Yours** — *What:* opposing Pokémon praises. *How:* after a close battle, a one-line praise to your lead. *Why:* sportsmanship. `S` · battle end.

**I-246 Retired Champion Cameo** — *What:* an old champion watches from the crowd. *How:* spectator at gym; comments at the end. *Why:* lore. `M` · gym.

**I-247 Trainer School Class Visit** — *What:* a group of kids watches you. *How:* kids cheer or mimic your moves; one gives a berry. *Why:* world has youth. `S` · NPC.

**I-248 Apprentice Challenge** — *What:* a young trainer idolizes you. *How:* shows up each region, stronger each time, referencing your wins. *Why:* growth tracked. `M` · legacy.

**I-249 Trainer Swapping Stories** — *What:* trainers swap travel tales that hint at secrets. *How:* tales map to real hidden nodes in the run. *Why:* rumor gameplay. `M` · secrets.

**I-250 Trainer's Dare** — *What:* an NPC dares you to a handicap match. *How:* accept a restriction for a rare reward. *Why:* optional challenge. `M` · battle.

**I-251 Trainer In Mourning** — *What:* a trainer who lost a Pokémon sits quietly. *How:* choose to sit with them; a soft reward later. *Why:* emotional core. `M` · events.

**I-252 Trainer Asks You To Carry A Letter** — *What:* a delivery chain. *How:* a letter to be delivered at a later node with a tip. *Why:* ties places together. `M` · quests.

**I-253 Two Trainers Eloping** — *What:* a couple asks for a getaway. *How:* distract the chaperone with a battle. *Why:* lighthearted. `M` · events.

**I-254 Trainer Who Mistook You** — *What:* mistaken identity. *How:* an NPC treats you as a famous trainer; play along or correct. *Why:* comedy with consequences. `M` · events.

**I-255 Trainer Lost His Hat** — *What:* quick quest with a Pokémon assist. *How:* your Flying type retrieves it. *Why:* species use. `S` · events.

**I-256 Trainer Compares Notes** — *What:* an NPC compares your stats to theirs. *How:* friendly numbers, "you're a bit ahead." *Why:* feedback via NPC. `S` · UI.

**I-257 Trainer Faints From Hunger** — *What:* you find a starved trainer. *How:* feed them; they remember you later. *Why:* kindness returns. `M` · events.

**I-258 Trainer Coaches Your Lead** — *What:* a trainer gives personal training. *How:* a short drill mini-event raising a stat slightly. *Why:* variety in growth. `M` · training.

**I-259 Trainer Asks For Your Name** — *What:* NPC asks what your name means. *How:* if you've set a title, they react to it. *Why:* personalization. `S` · profile.

**I-260 Trainer Chorus** — *What:* trainers cheer for a boss win. *How:* the audience in gyms reacts to well-played turns. *Why:* a living gym. `M` · arena life.

## C. Returning characters and recurring NPCs

**I-261 Recurring Berry Merchant** — *What:* a merchant appears across regions. *How:* remembers your purchases; offers a loyalty discount. *Why:* a friendly face. `M` · shop.

**I-262 The Wandering Photographer** — *What:* photographer appears at scenic nodes. *How:* snaps shots of your party; saved prints in the Album. *Why:* collectible NPC. `M` · Album.

**I-263 The Lost Child Grown Up** — *What:* a child you helped returns as a trainer. *How:* appears later with a Pokémon you gifted. *Why:* long-term payoff. `L` · events, persistence.

**I-264 Old Man With Cane** — *What:* a mysterious elder. *How:* his advice changes depending on your party; sometimes false. *Why:* intrigue. `M` · NPC.

**I-265 The Collector** — *What:* an NPC collecting oddities. *How:* trades rare items for flavor trinkets. *Why:* sink for junk. `M` · items.

**I-266 Nurse Who Remembers** — *What:* Nurse Joy-like NPC recognizes you. *How:* her greeting changes based on how often you lost. *Why:* human touch. `S` · Hub.

**I-267 Gym Leader Off-Duty** — *What:* a gym leader lounges at a cafe. *How:* friendly talk before the fight changes dialogue during it. *Why:* humanizes bosses. `M` · gym.

**I-268 Reformed Grunt** — *What:* a defeated grunt returns on the good side. *How:* sells discounted items at later shops. *Why:* redemption. `M` · villains.

**I-269 Professor Check-In** — *What:* the professor asks for field notes. *How:* a quick report minigame filling the dex with info. *Why:* meta reward. `M` · dex.

**I-270 The Traveling Band** — *What:* musicians play at campfires. *How:* hear a tune; Pokémon dance; a hidden song unlock. *Why:* audio joy. `M` · audio.

**I-271 Weather Forecaster** — *What:* a forecaster NPC. *How:* predicts the next node's weather accurately or not depending on trust. *Why:* utility with personality. `M` · weather.

**I-272 The Fortune Teller** — *What:* a fortune teller reads your party. *How:* readings reference real data (types, bonds). *Why:* mirror. `M` · events.

**I-273 The Ferryman** — *What:* a ferryman asks riddles. *How:* wrong answers cost small gold; right answers give secrets. *Why:* classic. `M` · map.

**I-274 Hermit Mountain Monk** — *What:* a monk teaches calm. *How:* a meditation interaction raising bond. *Why:* tone shift. `M` · training.

**I-275 Kid With A Wagon** — *What:* a kid sells odd goods. *How:* randomized junk with the occasional gem. *Why:* gambling flavor. `S` · shop.

**I-276 Postman Pokémon** — *What:* a delivery Pokémon. *How:* brings letters at nodes; might deliver misrouted mail for you to deliver. *Why:* world logistics. `M` · letters.

**I-277 The Rescued Poacher** — *What:* poacher you saved turns up. *How:* gifts a rare capture lure. *Why:* gray morality. `M` · events.

**I-278 Rival's Grandmother** — *What:* an NPC grandmother serves food. *How:* gives tea; hints about the rival's past. *Why:* family depth. `M` · rival lore.

**I-279 Retired Gym Leader Café** — *What:* a hub NPC. *How:* spends time with your past aces. *Why:* Hub life. `M` · Hub.

**I-280 Detective** — *What:* an NPC investigating strange happenings. *How:* gives clues for hidden events. *Why:* mystery thread. `M` · secrets.

## D. Merchants and strange traders

**I-281 Haggling Duel** — *What:* real haggling. *How:* choose tactics (flatter, bluff, walk away); Pokémon assist with personality. *Why:* NPC shops with agency. `M` · shop.

**I-282 Merchant's Pokémon Guard** — *What:* a shop's guard Pokémon sizes you up. *How:* friendly with strong bond; hostile with grudges. *Why:* shop life. `S` · shop.

**I-283 Closing Time Deal** — *What:* a merchant packing up gives deals. *How:* last-chance stock at a steep discount; they leave next node. *Why:* urgency. `S` · shop.

**I-284 Barter-Only Merchant** — *What:* no gold accepted. *How:* trades for stories, items or favors. *Why:* breaks routine. `M` · shop.

**I-285 Counterfeit Merchant** — *What:* shady seller. *How:* identify fakes using Pokémon knowledge; success reveals a hidden stash. *Why:* skill expression. `M` · shop.

**I-286 Merchant Wants A Pokémon** — *What:* wants to buy your Pokémon at a huge price. *How:* decline; Pokémon express relief; accept (rare) for a legacy piece. *Why:* temptation. `M` · shop.

**I-287 Memory Seller** — *What:* sells recorded memories. *How:* a replay of someone else's run moment as a viewable scene. *Why:* cross-run tie. `L` · replays.

**I-288 Seasonal Peddler** — *What:* seasonal goods. *How:* inventory shifts with real-world date. *Why:* freshness. `M` · date.

**I-289 Merchant's Debt** — *What:* a merchant owes you a favor. *How:* after helping once, free item later. *Why:* reciprocity. `M` · shop.

**I-290 Gossiping Vendor** — *What:* sells rumors. *How:* pay to learn a coming event's category. *Why:* planning. `M` · events.

**I-291 Mystery Box Seller** — *What:* sells unlabeled boxes. *How:* odd odds; Pokémon sniffing helps (Dog types). *Why:* gamble flavor. `S` · shop.

**I-292 Travelling Tailor** — *What:* sews cosmetics for Pokémon. *How:* custom outfits by color choice. *Why:* personalization. `M` · cosmetics.

**I-293 Merchant Under Siege** — *What:* bandits attack a merchant. *How:* defend for a reward and a lifelong discount. *Why:* active events. `M` · battle.

**I-294 Merchant's Sweet Tooth** — *What:* wants a specific berry. *How:* trade for rare items. *Why:* fetch with flavor. `S` · items.

**I-295 Auction Night** — *What:* auction event. *How:* bidders are NPC personalities; Pokémon cheer your bids. *Why:* social drama. `L` · events.

**I-296 Pawnbroker** — *What:* pawn items for gold, redeem later. *How:* items return with a note of interest. *Why:* economy variation. `M` · shop.

**I-297 Collector Of Cries** — *What:* wants a recording of a rare cry. *How:* use a Pokémon's cry; reward items. *Why:* species lore. `M` · audio.

**I-298 Vending Machine Gremlin** — *What:* machine eats coins. *How:* kick it; Fighting types help; sometimes it dispenses a prize. *Why:* classic. `S` · events.

**I-299 Sleepy Shopkeeper** — *What:* dozing shop. *How:* quiet purchases get a discount; loud ones wake him. *Why:* fun mini-game. `S` · shop.

**I-300 Merchant Prince** — *What:* a rich traveling merchant with caravan. *How:* once per run, offers unique wares with story tags. *Why:* spectacle shop. `M` · shop.

## E. Villains and antagonist NPCs

**I-301 Grunt Pleads** — *What:* a defeated grunt begs. *How:* options: mercy, take loot, recruit info. *Why:* moral choice. `M` · villains.

**I-302 Villain Monologue Interrupt** — *What:* you or a Pokémon interrupts. *How:* choose to attack mid-monologue for a first strike. *Why:* meta fun. `M` · boss.

**I-303 Villain's Soft Side** — *What:* the boss is kind to their Pokémon. *How:* a glimpse before battle. *Why:* complex antagonists. `M` · lore.

**I-304 Spy Among NPCs** — *What:* a friendly NPC is secretly a spy. *How:* later reveal changes the previous scene. *Why:* twist. `M` · events.

**I-305 Villain Recruits Your Rival** — *What:* the antagonist tempts the rival. *How:* an optional scene; your choice affects rival path. *Why:* stakes. `L` · rival.

**I-306 Taunt Letters** — *What:* the villain sends letters. *How:* each addresses recent choices. *Why:* personalized threat. `M` · letters.

**I-307 Hostage Standoff** — *What:* a trainer's Pokémon is held. *How:* a multi-step rescue in battle. *Why:* tension. `L` · battle.

**I-308 Villain Gets Rained On** — *What:* funny comeuppance. *How:* weather event turns on a villain. *Why:* levity. `S` · weather.

**I-309 Team Grunt Union Meeting** — *What:* grunts complain about pay. *How:* you overhear and exploit for a shortcut. *Why:* humor. `S` · events.

**I-310 Rival Villain Duo** — *What:* the rival and villain share a past. *How:* flashbacks reveal. *Why:* connect plots. `L` · lore.

## F. Gym leaders, E4, champion

**I-311 Leader Studies Your History** — *What:* the leader references your past runs. *How:* intro line cites a Legacy record. *Why:* the world remembers. `M` · legacy.

**I-312 Leader's Pokémon Greets Yours** — *What:* a pre-battle exchange between Pokémon. *How:* animation of mutual respect. *Why:* warmth. `S` · FX.

**I-313 Leader's Secret Weakness Reveal** — *What:* leader nods at a hidden flaw. *How:* after losing, they hint at a known flaw. *Why:* teaching. `S` · hints.

**I-314 E4 Waiting Room** — *What:* chat with other challengers. *How:* tips and rumor; one is a rival. *Why:* tension builder. `M` · E4.

**I-315 Champion's Humility** — *What:* the champion is kind. *How:* a post-win conversation with advice. *Why:* closure. `M` · ending.

**I-316 Leader Skips Intro** — *What:* a leader who respects you by skipping speeches. *How:* after repeat wins, shorter intro. *Why:* progression feel. `S` · gym.

**I-317 Leader Gives Hand Me Down** — *What:* leader gives a Pokémon from their past. *How:* an egg or old stone for the long-run player. *Why:* reward with story. `M` · rewards.

**I-318 E4 Member Rivalry** — *What:* members banter. *How:* they bicker through the hall. *Why:* characterization. `S` · dialogue.

**I-319 Champion Cheers From Stands** — *What:* champion watches your gym fight. *How:* nods during highlights. *Why:* anticipation. `S` · FX.

**I-320 Gym Trainer Gossip** — *What:* gym trainers gossip about the leader. *How:* tips on the leader's team. *Why:* helps strategy. `S` · gym.

## G. Cross-run references

**I-321 NPC Remembers Your Ace** — *What:* NPC mentions a Pokémon from a past run. *How:* uses Legacy data. *Why:* continuity. `M` · legacy.

**I-322 Statue Of Your Finale** — *What:* a statue for your finished run. *How:* a town statue depicts your Hall of Fame team. *Why:* pride. `L` · Hall of Fame.

**I-323 Children's Song About You** — *What:* kids sing about a legendary feat. *How:* lyrics generated from record. *Why:* folk legend. `L` · legacy, audio.

**I-324 Rival's Biography** — *What:* a book about the rival. *How:* collected pages across runs. *Why:* collectible lore. `M` · lore.

**I-325 Rumors Of A Trainer** — *What:* NPCs mention a legendary trainer (you). *How:* each run adds exaggeration. *Why:* mythmaking. `M` · legacy.

**I-326 Grave Of A Fallen Run** — *What:* a memorial to a past failure. *How:* a roadside marker where your last run ended, with an offering. *Why:* roguelike tradition. `M` · persistence.

**I-327 NPC Descendants** — *What:* NPC children continue stories. *How:* a kid you helped is now an adult. *Why:* generations. `L` · persistence.

**I-328 Scholar's Thesis On You** — *What:* a scholar studies your style. *How:* shows stats with commentary. *Why:* mirror. `M` · stats.

**I-329 Wanted Poster** — *What:* a villain puts your face on a poster. *How:* NPCs recognize you and react. *Why:* notoriety. `M` · villains.

**I-330 Fan Club** — *What:* fans cheer. *How:* gifts from fans scale with Hall of Fame. *Why:* fame. `M` · fame.

## H. Everyday NPC behavior

**I-331 NPC Gets Out Of The Way** — *What:* crowds react to your party size. *How:* NPCs shuffle aside for big Pokémon. *Why:* world physicality. `S` · map.

**I-332 NPC Feeds Your Pokémon** — *What:* strangers offer treats. *How:* Pokémon accept based on personality. *Why:* charm. `S` · events.

**I-333 NPC Scared Of Your Pokémon** — *What:* some NPCs flee from big or Ghost types. *How:* shops close briefly. *Why:* type reputation. `S` · NPC.

**I-334 NPC Asks For A Photo** — *What:* tourists. *How:* pose with a Pokémon; fame points. *Why:* light fun. `S` · fame.

**I-335 NPC Gossip Changes With Results** — *What:* town talk updates. *How:* talk shifts after you win/lose. *Why:* the world listens. `M` · dialogue.

**I-336 NPC Lullaby At Night** — *What:* night-time folk songs. *How:* ambient scenes. *Why:* atmosphere. `S` · audio.

**I-337 NPC Gives Bad Directions** — *What:* a prankster. *How:* the wrong way shows a bonus node. *Why:* comedic reward. `S` · map.

**I-338 NPC Teaches A Gesture** — *What:* unlocks an emote. *How:* a villager teaches a greeting gesture used later. *Why:* expressive options. `M` · UI.

**I-339 NPC Asks You To Babysit** — *What:* a baby Pokémon for 3 nodes. *How:* you care; reward. *Why:* playful task. `M` · quests.

**I-340 NPC Throws A Party** — *What:* local festival celebrating your arrival. *How:* mini-games and gifts. *Why:* big warm moment. `L` · events.
