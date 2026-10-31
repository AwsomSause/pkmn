# Dialogue 04: World NPCs, merchants, trainer classes, time and season (230 lines)

Adds voices `ideas/dialogue.md` §12-17, §35-36, §43-44 don't cover: named recurring NPCs, per-class trainer lines keyed to what the player owns, merchants who haggle, ambient time/season/weather chatter, and "?" event microscripts. Format: `- [situation | gate] text`.

## Recurring Hub NPCs: the Nurse (Joy-style, warm and tired)
- [heal | first visit] Welcome in! I fix sniffles, scrapes, and hurt feelings. Mostly the first two.
- [heal | party fainted] Oh dear. Let me take them. You sit. Drink this.
- [heal | all full HP] They're perfectly fine. You, on the other hand, look like you need tea.
- [heal | player has a Pokémon at bond max] They won't leave your side. I'll let it hold the ball while I work.
- [heal | after a loss] Come on in. Whatever happened out there, it's over now.
- [heal | night] It's late! Quiet voices, please. The Snorlax in room two is dreaming.
- [heal | repeated visits] You again! I just changed the sheets for you.
- [heal | rival present] I healed their team earlier. Equal service, equal care. Don't look at me like that.
- [heal | legacy: long-time player] Third year in a row you've limped through my door. I'm proud, honestly.
- [heal | Poké Balls cracked] That ball's worn out. Take a spare. On the house.

## Recurring Hub NPCs: the Shopkeeper (Marta, unflappable)
- [shop | open] Everything's priced fairly. Except the stuff I'm trying to sell.
- [shop | low gold] Short on cash? I can hold items until you're back. For a small fee. Small fee.
- [shop | big spender] Oh? A big order? Someone's feeling brave. Or desperate.
- [shop | buying a hat] That hat costs more than my hair. Worth it.
- [shop | refund asked] We don't do refunds. We do "emotional store credit."
- [shop | rare stock] Don't tell the others, but this one's from the back room.
- [shop | sale day] Everything's half off, which is legally still too much.
- [shop | closing] If you want it, say so now. I'm going to pretend I'm asleep.
- [shop | rival buys] Your rival grabbed the last Max Revive. I'd say sorry, but I'm not.
- [shop | player returns after a win] Already back? Go on, treat yourself. That's an order.

## Recurring Hub NPCs: the Professor (excited, absent-minded)
- [lab | greeting] Ah, {player}! Wait, did I leave the oven on? No, no. Continue!
- [lab | new species found] This Pokémon... it breaks three of my favorite rules. Marvelous!
- [lab | player low on dex] You've seen only a handful. The world is a library and you've read the cover.
- [lab | dex 50%] Half the dex! My knees hurt just looking at the numbers.
- [lab | shiny registered] A Shiny?! Let me touch it. I'm kidding. Let me look at it. For a very long time.
- [lab | after a wipe] No matter. Every great researcher has a heap of failed experiments. You are one of them.
- [lab | legacy: first win] You did it. I've waited for this since I handed you your first ball.
- [lab | unsure] Hmm, what was I going to say? Right: eat breakfast.
- [lab | gift] Take this. I found it in my other coat. Ha. It may be dangerous.
- [lab | goodbye] Come back and tell me everything. Especially the parts you think are boring.

## Recurring Hub NPCs: the Old Ranger (gruff, gentle)
- [camp | greeting] Mind the fire. And the bear. The bear's friendly. The fire isn't.
- [camp | player weak] You need more than guts out there. Take a spare blanket.
- [camp | player strong] You walk different than you did. Like the ground owes you rent.
- [camp | stories] I once crossed that ridge in a storm with only a Spearow and a pocket knife.
- [camp | legacy] Heard about your last run. Lots of folks fall in the same hole; few climb out the same way.
- [camp | night] Stars are better this far from town. Don't waste them looking at a screen.
- [camp | warning] Something is off in the east. The birds aren't singing.
- [camp | rival] That young one passed through. Left a berry for my Growlithe. Kind soul under the thorns.
- [camp | goodbye] Come back in one piece. I don't make cocoa for ghosts.

## Recurring Hub NPCs: the Bartender / Cook
- [meal | greeting] What'll it be? Don't say "something light." You're about to walk eight routes.
- [meal | player low HP] Sit. Eat. Talk later.
- [meal | celebrating] Another round for the champion! No wait, that's you. I'm so proud I'll burn the stew.
- [meal | rival] The kid ordered the same dish as you. Tell me you didn't plan that.
- [meal | secret recipe] If I tell you what's in it, I'd have to kill the secret.
- [meal | tip] I leave extra for people who look like they're about to give up. Don't ask me how I know.
- [meal | Pokémon food] Spicy for the Fire-types, sweet for the Fairies, a plate of rocks for the Geodude.

## Merchants on the road (haggling)
- [merchant | arrive] Psst! Over here! Goods for the discerning traveler, fresh from a legally ambiguous source!
- [merchant | arrive] Step right up! Everything is cursed. In the fun way.
- [merchant | price high] A mere 3,000 for this fine sack of probably-berries.
- [merchant | price haggled] 2,500? You drive a hard bargain. My kids will go hungry. They're Rattata. They like it.
- [merchant | price haggled success] Sold! My margins are in tears.
- [merchant | refused] No deal? Fine. But you'll come back. I'm irresistible.
- [merchant | player poor] Come back with more coins. Or some interesting teeth.
- [merchant | rare item] This? It's older than the town. It also smells like it.
- [merchant | stolen suspicion] Where did I get it? ...Next question.
- [merchant | trust] You've got an honest face. Here, the good stock.
- [merchant | Pokémon trade] Swap you my Rattata for your Pikachu. Bad offer? Fine. A Rattata and a story.
- [merchant | gamble] Pick a box. Any box. Winner gets nothing. I'm kidding. Someone gets something.
- [merchant | leaves] Gotta run. A man in a hat is chasing me. Unrelated.
- [merchant | return] You came back! I knew I'd hooked you. Prices went up, by the way.

## Trainer classes: lines keyed to what you own
- [Bug Catcher | player has a Bug] A fellow bug lover! Let me show you my Scyther. Then I'll beat you.
- [Bug Catcher | player has none] You travel without a single Bug-type? Bold. Brave. Wrong.
- [Hiker | player has Rock] Ho ho! A real stone-friend! Don't let me down.
- [Hiker | level high] These legs have climbed every mountain. Your team is a molehill.
- [Fisherman | player has Water] I caught a Gyarados once. You'd have fainted.
- [Fisherman | win] The big one got away. Again. But so did your Magikarp.
- [Swimmer | player is Fire] Fire at the beach? Honey, bring a bucket.
- [Lass | player has Fairy] Cute Fairy! Mine are cuter. We'll see.
- [Youngster | any] I'm the strongest trainer in my class! My class has four kids!
- [Youngster | player is strong] Whoa. Okay, you win. But you're gonna remember me, okay?
- [Psychic | player's mind] Don't tell me what you're thinking. I already know. It's not a good plan.
- [Black Belt | player has Fighting] Another warrior! Fight with respect.
- [Black Belt | player has none] Weak spirit, weaker team. Let me teach you.
- [Picnicker | any] Picnic time! I'll share if you beat me. Or even if you don't.
- [Ace Trainer | high streak] A streak that long means your luck's about to break. Or I will.
- [Gentleman | any] A battle, a handshake, and tea after. Those are my terms.
- [Collector | rare mon] Ah! Is that a Shiny? I'll trade you my whole bag for a peek.
- [Rich Kid | any] My dad owns this route. He also owns the berries. You'll pay for those.
- [Scientist | any] Fascinating! Please remain still while I observe your reflexes.
- [Backpacker | any] I've been everywhere. I haven't won anywhere. Let's change that.
- [Camper | night] Don't mind the fire. It's not a trap. Probably.
- [Ranger | player has Grass] Respect to anyone who nurtures. I'll be gentle. Maybe.
- [Nurse | after win] I fix them up and then I knock them down. That's the job.
- [Cook | win] I have so many recipes, and none of them include losing.
- [Artist | Shiny] Your Shiny is the exact color I've been looking for. May I borrow it for a sunset?
- [Sailor | any] Anchors aweigh! I'll sink you in a minute and buy you a drink after.
- [Cyclist | any] I can't stop! Brakes are broken! Challenge accepted!
- [Dancer | win] Take a bow! Then one more. I like symmetry.
- [Musician | win] That was a harmony. Your Pokémon hit the right note and I missed.
- [Veteran | any] Forty years, and I still get nervous before each battle. Good. That means I care.

## Time of day
- [dawn] The route is quiet, silver, and sleepy. Birds test the morning with one note each.
- [morning] Dew clings to the grass. A Butterfree hangs over a flower.
- [noon] The sun is high and the shadows are small. Even the Zigzagoon is slow.
- [afternoon] Long light stretches over the path. The party gets lazy.
- [dusk] The sky bleeds orange. Fireflies wake up.
- [night] Stars crowd the sky. Somewhere, a Hoothoot hoots the hour.
- [midnight] The whole route is silent. The kind of silent that watches back.
- [pre-dawn] Cold, still, ready. The kind of hour that remembers things.

## Season
- [spring] Petals drift on the breeze; every trainer looks a bit lighter than usual.
- [summer] The air shimmers. Water-types are dramatically happy. Everyone else is dramatically not.
- [autumn] Leaves crunch underfoot; the Hub smells of roasted chestnuts.
- [winter] Frost laces the signposts. Everyone wears a scarf, even the Pokémon.
- [first snow] A single flake lands on {player}'s nose. The whole party stops to catch the second.
- [harvest] Berries everywhere. A sign at the market says "TAKE ONE. TAKE FIVE. BRING BACK ONE."
- [festival] Lanterns glow along the route. A band of Mareep sings out of key.
- [heat wave] The Fire-types glow; everyone else glows red.
- [monsoon] Rain for days. The party hums along with the drops.

## Weather: NPC remarks
- [rain] "Wet enough for you? It's lovely for the crops, awful for my hair."
- [rain] "Careful, the path's slick. A trainer lost a boot back there."
- [storm] "Hear that? That's the sky thinking about us. Let's not give it ideas."
- [sunny] "Perfect picnic weather! And perfect battle weather, if you ask my Torkoal."
- [snow] "The cold keeps the trouble indoors. Not me, though."
- [fog] "Can't see my own paw. Careful: some of those shapes are rocks. Some aren't."
- [wind] "Hold your hat! Hold your Pokémon!"
- [sandstorm] "Keep your goggles on. If you don't have goggles, a prayer will do."
- [hail] "Those are only little ones. Only little ones, but they add up."
- [heat] "Drink water. Every ten steps. I'm serious. My Machamp's already fainted twice."

## "?" event microscripts (one-line setups)
- [?] A trainer sits by the road with one shoe on, staring at a cooling Charmander. "Have you seen my other boot?"
- [?] An old woman offers you a bowl of soup. It glows faintly. Your Pokémon are excited.
- [?] A rope bridge sways. At the far end, a Machamp holds a sign: "Toll: one story."
- [?] A bell hangs on a branch, ringing itself. Every ring sounds like someone's name.
- [?] A trainer challenges you to a staring contest. They have four Pokémon and one very large eye.
- [?] A small shrine has a bowl. Your party each drops in something. Not you. You're not sure why.
- [?] A broken cart, a Tauros in a harness, and a driver weeping into a hat. "The wheel fell off. The whole thing fell off."
- [?] The moon is out in the daytime. The Clefairy are dancing and will not explain.
- [?] An old man sets out ten teacups. One of them has a Gastly in it.
- [?] Someone has built a sandcastle in the road. Please do not step on it.
- [?] A letter is nailed to a tree: "Dear traveler, I was never here."
- [?] A Slowbro has been sitting in the same spot so long a bird has a family on its head.
- [?] A merchant sells nothing but one very large egg. "It hatches when it's ready. Or when it's hungry."
- [?] A scarecrow has a hat. You'd swear it was in a different position a second ago.
- [?] A fisherman gives you a rod. "Don't thank me. Thank the one that got away."
- [?] You find a diary. The last page reads "Don't open the door." The door is behind you.
- [?] A line of Rattata carry a single tiny flag. The flag says "SORRY ABOUT THE BERRIES."
- [?] A Psyduck stands in the road. It's not blocking anything. It's just standing there. Proudly.
- [?] A trainer offers to read your fortune. The cards all say "snack." They're right.
- [?] A well says "Make a wish." Someone has already made seventeen.
- [?] A sign says "Free hugs." Beneath, in smaller print, "from a Snorlax."
- [?] Three Pokémon are playing cards. One is cheating. You can't tell which.
- [?] A Mime cleans the window of an abandoned house. Nobody knows who pays it.
- [?] A talking door asks a riddle. The answer is "a berry." The door is unimpressed.
- [?] You see a group of Pokémon forming a pyramid to reach a berry. They're nine high.

## Gym leaders: type-flavored entrances (new)
- [Fire gym | entrance] Hot enough for you? It'll get hotter. I promise.
- [Water gym | entrance] Care to dive in? I only drown the ones who flinch.
- [Grass gym | entrance] Roots run deep here. So does my patience.
- [Electric gym | entrance] Let's turn the lights on, shall we? Brace for brightness.
- [Ice gym | entrance] Cold hands, warm heart, freezing strategy.
- [Fighting gym | entrance] Words are cheap. Fists are honest.
- [Poison gym | entrance] I'd offer you tea, but... the cups are mine.
- [Ground gym | entrance] Plant your feet, trainer. The floor's shaky.
- [Flying gym | entrance] Look up! The sky's where I live.
- [Psychic gym | entrance] I knew you'd come at eleven. And I knew you'd be early.
- [Bug gym | entrance] Don't be fooled by size. The tiny ones bite hardest.
- [Rock gym | entrance] Solid foundation. Stubborn too. Both useful.
- [Ghost gym | entrance] Did you hear that? No? Good. Keep not hearing it.
- [Dragon gym | entrance] Only those worthy of legend pass. Are you?
- [Dark gym | entrance] You're brave to challenge me in the dark. Or foolish.
- [Steel gym | entrance] No cracks. No flaws. Test it if you must.
- [Fairy gym | entrance] Welcome! I make everything sparkle, including defeat.
- [Normal gym | entrance] Plain? Sure. Reliable? Absolutely. Fight me.

## Gym leaders: new-run fatigue (repeat attempts)
- [gym | player's third try] Third time this season? I'm starting to think we're friends.
- [gym | player lost to this leader last run] I remember you. Last time you fell on the fifth turn. Let's beat that.
- [gym | player beat this leader last run] You again. I've changed the lineup. You'll hate it.
- [gym | perfect run] Perfect record so far? Don't let it go to your head. Let it go to your heart.
- [gym | player low-leveled] You're under-leveled. I'm not going to say it again. Okay: you're under-leveled.
- [gym | player over-leveled] That's not a challenge. That's a courtesy call.
- [gym | player at 1 HP] You're barely standing. I admire that. I'll still win.
