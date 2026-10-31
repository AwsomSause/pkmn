# Dialogue 05: Memory, legacy, rivalry arcs, and meta-aware lines (230 lines)

Lines that make the world remember: previous runs (legacy records, M9), nemesis, False Protagonist replays (M13), rival arc stages (`rivalArcs.json`), bond history, streaks, and rare "the game knows" moments. None of this exists in `ideas/dialogue.md`. Format: `- [trigger | gate] text`. Gates reference data the game already tracks (run count, deaths, wins, Pokémon history, items). `{lastRun}` = last run's lead Pokémon, `{lastKiller}` = the Pokémon that ended it, `{n}` = a count.

## Callbacks to previous runs (any NPC)
- [callback | player lost last run] Haven't seen you since the last time. You looked rough. You look better now.
- [callback | {lastRun} was a Magikarp] Last time you had a Magikarp that wouldn't quit. Whatever happened to it?
- [callback | {lastRun} died here] This is where the last one fell. I still tip my hat at this bend.
- [callback | won last run] Look who's back. The champion! Don't let it go to your head. I'll do it for you.
- [callback | quit mid-run] You left in the middle of a battle last time. I kept your seat warm.
- [callback | same starter again] The same starter again? Is it loyalty or fear of change?
- [callback | different starter] New starter this time. Same walk, though.
- [callback | {n} deaths at this gym] That's {n} times the gym's seen you. You're basically on the staff.
- [callback | {n} wins] {n} wins and you still enter like you're hunting for a first. I love that.
- [callback | friend lost] I heard {lastRun} didn't make it. I'm sorry. I kept a flower for it.
- [callback | revived with item] I remember when you used a Max Revive here. That was a heck of a call.
- [callback | team with a past] That Pikachu has your last run's scar. Is that... a coincidence?
- [callback | long absence] A month, was it? The berries went bad. The memories didn't.
- [callback | daily player] You're on your tenth day running. Even the flowers are impressed.

## Callbacks: the rival remembers
- [rival | they won last time] Last time I won. You remember? I do. I replay it. It's my favorite song.
- [rival | they lost last time] I've never forgotten that last attack. Never. It lives in my sleep.
- [rival | draw] We split it. One each. Neither of us is happy.
- [rival | your Pokémon fainted at their hands] Your {name} looks better. Mine says sorry. I say don't be.
- [rival | you used a trick last time] That sneaky trick you used... I trained a counter for it. Specifically.
- [rival | you showed mercy] You spared my last Pokémon. I didn't forget. I won't waste it.
- [rival | you showed no mercy] I said I'd get you back. Today's the day.
- [rival | you saved them] I'd say I owe you one. But owing is annoying. Let me just pay it back.
- [rival | you laughed at them] I heard you laughing. I hate that I think about it.
- [rival | they cried in front of you] You never mentioned the tears. I noticed. Thanks.
- [rival | first meeting recalled] Remember when we met on that first route? You looked so green.
- [rival | shared meal] I still think about that soup we shared. Don't tell the others.
- [rival | gift] You still have the scarf I gave you? I didn't think it'd survive this long.

## Rival arc stages (pre-turn, turning, resolved)
- [arc:start | any] I want to know how good you really are. Show me.
- [arc:start | any] We seem to cross paths. Let's make the crossing interesting.
- [arc:mid | friend] Come on. We'll do it together next. Hands on three.
- [arc:mid | enemy] Don't mistake my patience for mercy.
- [arc:mid | doubt] I keep asking myself why I'm doing this. Then I see you, and I remember.
- [arc:mid | respect] You earned your place, {player}. I'd like to say that out loud.
- [arc:turning | friend→enemy] You went easy on me. Don't ever do that again.
- [arc:turning | enemy→friend] I came here to fight. I'm leaving with something I didn't plan on.
- [arc:turning | mentor] Whatever I taught you, you passed it. Now teach it back.
- [arc:resolved | well] There's no one else I'd rather have lost to.
- [arc:resolved | badly] Next time we meet, I'll be a stranger. Remember I used to be more.
- [arc:resolved | ambiguous] We're not enemies. We're not friends. We're something that doesn't have a name.
- [arc:resolved | respect] I'd walk through fire if you asked. I'm saying that because I mean it.
- [arc:resolved | reconciled] We argued a lot, huh. I wouldn't change it for anything.
- [arc:resolved | exile] I have to leave. I'm not mad. Just... take care.

## Rival: bond and chemistry lines
- [bond:low | stranger] I'm {rival}. You? Never mind, I'll find out.
- [bond:friendly] You're all right, {player}. I mean, in the annoying way.
- [bond:close] I tell my team about you. They think I'm joking when I say you're good.
- [bond:trusted] If I had to pick one person to fight beside, it'd be you. Don't tell anyone.
- [bond:rival] Rivals are the only people who truly see each other. Think about that.
- [bond:betrayed] I trusted you. That's the part that hurts.
- [bond:jealous] You're getting all the praise. I'm trying to be happy. It's hard.
- [bond:admiring] I tried to copy your style. It didn't work. Nothing works except you.

## Nemesis (a foe that keeps coming back)
- [nemesis | first return] You thought you'd seen the last of me? Cute.
- [nemesis | second return] Still alive? Fine. Round two.
- [nemesis | third return] You keep winning. I keep coming back. I'm not sure who's more stubborn.
- [nemesis | your Pokémon killed it] You took one of mine. I'll take two of yours. Fair is fair.
- [nemesis | it killed yours] Remember {name}? I do. I have its ribbon. You want it back?
- [nemesis | boss form] I've been training since that day. The old me is gone.
- [nemesis | defeated] I... I can't believe it. After all this time. You earned it.
- [nemesis | spared] You spared me? That makes it worse. I owe you now.
- [nemesis | finally respected] I'll never admit this twice: you're the best trainer I've ever lost to.
- [nemesis | redemption] No more revenge. I'm tired. Take the road. I'll take mine.
- [nemesis | wild] A wild {enemy} stares at you. You've met. It limps. It remembers.
- [nemesis | legacy] The wild one that killed {lastRun} is here again. A little older. A little wiser.

## False Protagonist (replay of your earlier self)
- [false | arrival] A trainer stands at the end of the route wearing your old clothes. It is you. Or was.
- [false | greeting] "Hi. I'm {player}. I'm headed to the Hub. Which way's the gym?"
- [false | confusion] "You look familiar. Do I know you? I feel like I do."
- [false | pre-battle] "I'll show you what I've got. I've been practicing."
- [false | party mirror] Their team is the one you used on the first run. All of them, still level 5.
- [false | win] "Wow, you're strong. I hope I get that strong someday."
- [false | loss] "Aw. I'll do better next time. Thanks for the lesson."
- [false | emotional] You watch them walk away, a little taller than they began. You remember being them.
- [false | bittersweet] They hold {lastRun}'s ball like a treasure. It's empty.
- [false | meta] "Do you ever feel like someone's watching, writing down everything we do?" "Yes."
- [false | gift] "I found this on the road. I think it's yours." It's the first Potion you ever had.

## Streaks and records
- [streak:5 wins] Five in a row. The sidewalk is starting to know your name.
- [streak:10 wins] Ten in a row! I'd say "don't stop" but you already know.
- [streak:20 wins] Twenty! Honestly, I'd like to see you lose. Just once. For science.
- [streak: first loss] There it is. The first one. Welcome to being human.
- [streak: ended] That streak was something. It's okay to put it down.
- [record:fast clear] That's the fastest anyone's cleared this route. The sign has been repainted.
- [record:no-hit] No damage taken? Are you cheating? ...Are you a ghost?
- [record:solo] Just one Pokémon? Against that gym? You're either mad or brilliant.
- [record:all-Magikarp] A full team of Magikarp. I think the League needs to update its rulebook.
- [record:low level] Level 5 against a level 50 boss? I'm calling the news.
- [record:perfect] A perfect run. The Hub is putting up a statue. It's lumpy. They'll fix it.

## Death and farewell (run end)
- [death | by rival] Don't be too hard on yourself. You met someone better prepared. Today.
- [death | by wild] A wild one? That stings. Take comfort: it was probably hungry.
- [death | by trap] Traps happen. I put them in my own bag once. I'm still pulling out thorns.
- [death | by bad luck] Dice rolled low. The universe forgot your name for a second.
- [death | by choice] You chose it. That's the hardest kind.
- [death | at boss] You almost had it. Almost has its own kind of glory.
- [death | at start] Already? The road is long, and it only took one turn. Next time.
- [death | last party member] {name} stood last. It stood for you. Remember that.
- [death | farewell: Hub] The Hub welcomes you back like nothing happened. It's trying to be kind.
- [death | farewell: Nurse] I wish I could heal everything. Some things I can only sit beside.

## Pokémon who remember
- [memory | Pokémon from last run] A wild {enemy} looks at you. It has your scent on it. It comes closer.
- [memory | released Pokémon returns] A wild Pokémon wearing a tiny scarf. You gave it to it three runs ago.
- [memory | traded Pokémon returns] The Pokémon you traded away looks at you from across the street. It bows its head.
- [memory | bonded Pokémon appears wild] It's {name}'s sibling. The same eyes. It doesn't know you. Yet.
- [memory | fainted last run] {lastKiller} stands on the ridge. It doesn't attack. It just watches.
- [memory | the one that got away] The rare one you missed last run is back. Smaller. Smarter.
- [memory | favorite berry] A wild {A} sniffs out your favorite berry and sits at your feet.
- [memory | scar] {A} bears a scar from that one fight. It brushes it with a paw and growls softly.
- [memory | forgotten] {A} stares at you, searching. It doesn't remember. It pretends it does.

## Hub memory board (lines on the wall)
- [board | wall] "In memory of {lastRun}, who never gave up."
- [board | wall] "The Hub remembers: {n} trainers walked out. {n} walked back."
- [board | wall] "To whoever carved the heart on the door: we found out. We approve."
- [board | wall] "Note: if you find the red key, don't tell Marta."
- [board | wall] "Reward: one Max Potion for the return of Bubbles the Psyduck. Last seen near the library."
- [board | wall] "Wanted: someone to beat the Champion. Pay is exposure."
- [board | wall] "Lost: one wallet, one spoon, one sense of direction."
- [board | wall] "Tournament sign-up begins at sunrise. Bring snacks."
- [board | wall] "Beware: the third step creaks and the fourth doesn't."
- [board | wall | legacy] "Hall of Fame: first runs are drawn in pencil. Winners get ink."

## Meta-aware (rare, subtle)
- [meta | save] A voice that isn't a voice says: "Take your time. I'll remember where we stopped."
- [meta | load] You feel like you've been here before. You have. It's called a save file.
- [meta | menu] The NPC glances at the pause menu like it's a window and nods politely.
- [meta | seed] "Funny. I swear I've said this exact line before." "You have. Every time the seed lands here."
- [meta | glitch] The Professor blinks twice. "Sorry, where were we? I got cut off."
- [meta | fourth wall] An NPC looks directly at you. "Yes, you. Keep going. It's nearly done."
- [meta | gift] The shopkeeper slips you an item with a wink. "This one's off the books."
- [meta | thanks] A tiny sign: "Thanks for playing."
- [meta | anniversary] The Hub is decorated. A banner reads: "{n} DAYS WITH US. THANK YOU."
- [meta | patch] A note on the board: "Fixed: the Pokémon who clipped through the floor. Sorry, Bidoof."
- [meta | credits] A Pokémon shows up with a clipboard and a hard hat. It reads off the names of the people who made this. Then wanders off.

## Quiet endings (the last line of a scene)
- [end | after a win] The road home is long. It feels shorter with them beside you.
- [end | after a loss] You're still here. That's the whole game, really.
- [end | after a gift] It's small, but it says "I thought of you."
- [end | after a fight] The silence after battle has a flavor. Tonight it's sweet.
- [end | after a rest] The stars have names. Tonight, they have yours.
- [end | after a reunion] Some roads loop. This one did, and you were glad.
- [end | after a farewell] The wave lasts a bit longer than it has to.
- [end | after a promise] "Next time." "Next time."
- [end | after a secret] You tell no one. The tree keeps it.
- [end | after a feast] Everyone's asleep by the fire. Even the dishes.
