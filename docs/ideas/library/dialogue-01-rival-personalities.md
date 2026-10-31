# Dialogue 01: Rival lines by personality (240 lines)

Expands `ideas/dialogue.md` §1-6, §58-59, which are generic. Here every line belongs to ONE of the 40 rival personalities in `src/data/rivalProfiles.json`, so a rival sounds like itself for the whole run.

Format: `- [situation | extra condition] text`. Situations: `meet` first meeting, `pre` before a fight, `won` the rival lost, `lost` the rival won, `soft` a quiet non-battle moment, `bye` farewell. Placeholders: `{player}`, `{rival}`, `{name}` (player's lead), `{rname}` (rival's lead), `{town}`. Conditions after `|` are optional gates (HP, streak, arc stage, weather, party, legacy).

## Perfectionist
- [meet] I counted your steps on the way in. Eleven too many. Let's see if that carries over to battle.
- [pre | rival team full-level] Every slot, every move, every item. Reviewed twice. Come on.
- [won | by one hit] One hit. One. I miscounted the speed tier and it cost me. Never again.
- [lost] A clean win. Not flashy. Clean. I respect that more than you know.
- [soft | rest stop] I re-sorted my bag by type, then by weight. Don't look at me like that.
- [bye] If I see a flaw in your play next time, I will tell you. It's a compliment.

## Prodigy
- [meet] They told me I'd be good at this. They were quiet about how good.
- [pre] I learned that trick in an afternoon. Do you want to see how long it took me to beat it?
- [won | first loss] ...I haven't lost before. Is it supposed to feel like this? Hot, and also strangely quiet?
- [lost] Hm. That was too easy. Come back when you've caught up.
- [soft | player has beaten them twice] You taught me something, and I never needed teaching. Annoying.
- [bye] Don't wait for me. You can't keep this pace anyway. Or can you?

## Underdog
- [meet] Everybody expects me to lose. I'm used to it. I kind of like it.
- [pre | rival team weaker] Look at my team. Look at yours. Yeah. Still not scared.
- [won] I'm okay. Honest. I got one good hit in and my heart's still racing.
- [lost | upset win] Did I just... did I just win? Somebody pinch me. Not you. Somebody.
- [soft] Everyone has a first win. Mine's today. Don't tell my {rname} I cried.
- [bye] You were the first person who didn't underestimate me. Thanks, I think.

## Tactician
- [meet] Three exits, two choke points, one shortcut. Welcome to the fight.
- [pre | storm] Rain lowers fire damage and raises my accuracy. I picked this route on purpose.
- [won | player used a switch-in trick] You read my read of your read. I'll write that down.
- [lost] Everything went to plan. I'm almost sorry. Almost.
- [soft] You can learn a lot from a loss. I've kept a notebook of yours for months.
- [bye] Next time, I'll bring a plan B. And a plan C. And one that's just spite.

## Gambler
- [meet] Heads, you win. Tails, you also win. Kidding. Let's go.
- [pre] Double or nothing on this one? I'm not betting money. I'm betting pride.
- [won] The dice rolled bad. They never roll bad twice. See you.
- [lost | crit swing] Did you see that critical? That's called luck, {player}. Bottle it.
- [soft] Fun fact: I never bet against myself. Only against you.
- [bye] I'm all in next time. Last warning.

## Showboat
- [meet] Smile, {player}! Camera's rolling. In my head, anyway.
- [pre] I practiced my entrance in the mirror for an hour. Do appreciate it.
- [won] That wasn't the finale! That was the middle act! Okay, fine, it was the finale.
- [lost | style win] And THAT is how it's done, with flair! You may clap.
- [soft | quiet] When nobody is watching, I still pose. Habit. Don't tell.
- [bye] Remember this day, {player}. I'll be the one who made it fun.

## Veteran
- [meet] I've been through more gyms than you've had hot meals, kid.
- [pre] Experience isn't power. It's knowing where not to stand.
- [won] I've lost before, and I'll lose again. You're better than I remembered.
- [lost] There's no shame in learning from an old hand.
- [soft | campfire] I carry the same pouch of berries I did twenty years ago. Taste hasn't changed.
- [bye] Go on. The road's lonely if you stop to admire it.

## Speedrunner
- [meet] Hi. Bye. Wait, fight first. Quickly.
- [pre] I have eleven minutes before I'm late for a thing I don't have yet.
- [won] ...Lost two minutes. That's a personal worst. Let's go again.
- [lost] Done in six turns. Could have been five. Next time five.
- [soft | rest stop] Resting's wasteful. I'm resting. See how bad I'm at it?
- [bye] Gotta go. Gotta go. Gotta go. Bye!

## Golden Retriever
- [meet] You're here! I'm SO glad you're here! Do you want a snack? I have snacks!
- [pre] Whatever happens, this is the best day! Let's do our very best!
- [won] You were AMAZING! Can we do it again? Please?
- [lost] Aww, you did great too! Group hug! You don't have to hug.
- [soft | player sad] I'm here. I don't have to say anything. I'll just be here.
- [bye] Don't forget me! I'll write! Every day! Is that too many?

## Gentle Giant
- [meet] Hello. I'm big, but I'm very nice. Please don't be scared.
- [pre] I don't enjoy hurting anyone. But I won't hold back either. Those are my rules.
- [won] Oh. You're strong. That makes me happy, actually.
- [lost] I'm sorry. Are you okay? Do you need an Oran Berry? I have two.
- [soft] I tried to catch a Butterfree once. It landed on me. We stayed until dark.
- [bye] Take care. Eat something. Sleep. In that order.

## Tease
- [meet] Oh, a new face. And such a serious one. I'll fix that.
- [pre] Don't look so tense. I only bite on Tuesdays. Is it Tuesday?
- [won] Okay, okay, you got me! I'll pay up with a smile. A small one.
- [lost] Don't pout. It really doesn't suit you. Actually, it does.
- [soft] I tease you because I like you. This isn't a secret. I think.
- [bye] Come back soon, or I'll have to find someone else to annoy.

## Ice Queen / King
- [meet] State your business. Briefly.
- [pre] I don't need a speech. I need you to be ready.
- [won] ...Acceptable. You may go.
- [lost] Was that the best you had? I have a long memory.
- [soft | nobody else around] The cold keeps me clear. Not lonely. Clear.
- [bye] Don't thank me. Don't wave either. Just go.

## Social Climber
- [meet] Hi! I know everyone worth knowing. Let me introduce you to... myself.
- [pre | player has a title] Beating a ranked name looks great on my résumé. Let's go.
- [won] Please don't tell anyone about this. I mean it. Not even the nice ones.
- [lost] Make sure you say my name when they ask who you beat.
- [soft] Fame is just friends you haven't met. I'm very nervous about the ones I have.
- [bye] Save me a seat at the top. I'll be along.

## Loner
- [meet] ...Don't follow me.
- [pre] I fight alone because it's simpler. Don't take that personally.
- [won] I'd rather lose to someone who fights fair than win against someone who doesn't.
- [lost] See? No need for anyone else. Don't look at me like that.
- [soft | player stays near] You can sit there. Just don't talk. ...You can talk a bit.
- [bye] I'll be fine. I usually am. Thanks for asking.

## Mediator
- [meet] Let's keep it friendly. Rules, a handshake, and may the best team win.
- [pre] I'd rather talk this out, but if we must battle, let's do it properly.
- [won] There. We both learned something. That's the real win.
- [lost] No hard feelings? I promise I'll buy the next round of berries.
- [soft | rivals nearby feud] I told them both to sit down and breathe. It worked for ninety seconds.
- [bye] Keep peace in your pocket. It's lighter than pride.

## People-Pleaser
- [meet] Oh! Hi! Sorry! I wasn't in your way, was I? Sorry!
- [pre] I don't want to make you mad but please don't go easy on me. Sorry. Do go easy. Sorry.
- [won] Oh, you won! Great! Thank you for the battle! Sorry!
- [lost] I won?! Oh no. Are you upset? I can lose next time if you'd like.
- [soft] I said yes to three things I couldn't do today. Please don't tell anyone.
- [bye] Thank you for being kind to me. I wasn't sure I'd earned it.

## Idealist
- [meet] I believe the world can be better. Starting with this route.
- [pre] I fight for every Pokémon that can't. That's why I'll win.
- [won] I'll keep going. People like you remind me why I started.
- [lost] Hope isn't a strategy. But it still counts for something.
- [soft | trainers in poverty nearby] I gave my last Potion to a stranger. It was worth more than a win.
- [bye] Be the person your partner thinks you are. That's all I ask.

## Pragmatist
- [meet] I don't do speeches. I do results. Let's see yours.
- [pre] Wasting a move is wasting a life. Mine's too short.
- [won] Fine. The numbers were against me. Next time I'll fix the numbers.
- [lost] Facts are facts. You were slower. I was ready.
- [soft] Idealism's lovely. Dinner's lovelier. Eat.
- [bye] If you ever need a fair price on anything, call me. Fair, not cheap.

## Traditionalist
- [meet] Two trainers, one road, a battle by the old rules. That's how it's done.
- [pre] My grandmother taught me the first bow. I'll bow. Then I'll beat you.
- [won] You fought with honor. My grandmother would have liked you.
- [lost] Respect the ritual and it respects you back.
- [soft] I keep a small shrine in my bag. It's mostly for luck. And a bit for her.
- [bye] Go with care. Come back with stories.

## Innovator
- [meet] You've never seen this team style. Neither have I. Let's find out together.
- [pre] I invented this opener yesterday. It might be terrible. Fun, though.
- [won] Data point recorded: that combo does not work. Add it to the list of 400.
- [lost] A new tactic works! I mean, for me. I'm sorry for you. A little.
- [soft | late night] I couldn't sleep, so I wrote a thesis about {name}'s Speed. It's seven pages.
- [bye] Steal my ideas. Please. Then tell me what you changed.

## Naturalist
- [meet] Shh. Look. A Pidgey is on your head. It likes you. Hello, I'm {rival}.
- [pre] The wild taught me that a fight is a conversation. Let's talk.
- [won] You moved like water. I'm keeping that image forever.
- [lost] Even in defeat you listened. That's rare.
- [soft | forest] Do you hear it? The whole forest humming one note. I thought you might.
- [bye] Leave a berry on the trail for whoever comes next.

## Scholar
- [meet] Fascinating. Your stance indicates a trained left flank. Hello!
- [pre] I read forty-two papers on this matchup. They disagree. Let's vote with our fists.
- [won] The result contradicts the literature. This is the best day of my year!
- [lost] The literature was right again. Slightly dull, but I'll take it.
- [soft | at a library NPC] Silence, please. Okay. Now the big question: what's {name}'s favourite berry?
- [bye] I'll cite you in my next paper. Don't make it a footnote.

## Spiritualist
- [meet] I felt you coming three paths away. Your aura is loud.
- [pre] Close your eyes for a moment. Breathe. Now open them and strike true.
- [won] The wind chose you today. Be kind to it.
- [lost] The scales balance eventually. Walk on.
- [soft | shrine] Someone left a flower at this stone. Let's add another and say nothing.
- [bye] May your path keep surprising you.

## Nihilist
- [meet] Another trainer. Another road. Another nothing. Hi.
- [pre] It won't matter. Let's do it anyway.
- [won] Funny. I thought I'd feel something. Maybe a little. Weird.
- [lost] Fine. A win's just a loss that hasn't realized it yet.
- [soft | player hesitates] If it all means nothing, then you can choose what it means. I'm told that's the trick.
- [bye] See you when the universe loops. Or tomorrow.

## Perpetual Runner-Up
- [meet] Second place has the best view. You can see both the winner and the crowd.
- [pre | silver-rank] I've been second for so long it feels like a title. Prove me wrong today.
- [won] Second again. Of course. ...Well. Congratulations. I mean it.
- [lost | first big win] First place! I don't know where to put my hands.
- [soft] Everybody forgets the runner-up. Thanks for remembering me.
- [bye] One day. I keep saying that. One day I'll mean it.

## Burnout
- [meet] Oh. Another trainer. Sure. Why not.
- [pre] I love this. I just love it quietly now.
- [won] That was fun. I forgot it could be fun.
- [lost] Okay. Okay. Nap time. Don't text me.
- [soft | rest stop] I sat in the sun for an hour and did nothing. It was the best part of my week.
- [bye] Go be great. I'll be here, being fine.

## Obsessive
- [meet] I've been looking for you. Not in a bad way. In a "your team is a puzzle" way.
- [pre] I wrote down every move you used last time. Page forty-one is about {name}.
- [won] I got one thing wrong. One. I won't sleep until I know which.
- [lost] See? I knew it. I KNEW it. Okay, I didn't know. But I hoped.
- [soft | night] I'm not stalking you. I'm... following a pattern.
- [bye] Don't change anything. Please. You're perfect as an unsolved problem.

## Avenger
- [meet] You don't remember me. That's fine. I remember you.
- [pre] Every step I took, I took toward this. Don't flinch.
- [won] ...It was never going to feel like I thought it would.
- [lost] Is that all? I expected it to feel bigger.
- [soft | arc: turning] I hated you so long it became a habit. I'm trying to quit.
- [bye] Whatever happens after this, it's yours. I'm done carrying it.

## Control Freak
- [meet] You're early. Or I'm late. Which is it? I need to know.
- [pre] I've arranged the field. Your side has a rock. Don't touch it.
- [won] That wasn't in the plan. Who authorized that?
- [lost] Everything is as it should be. Please don't change anything.
- [soft] I set three alarms to remember to relax. It's working!
- [bye] Follow the schedule. It's kinder than it looks.

## Escapist
- [meet] Hi! Not that I'm hiding from anything. Totally normal day.
- [pre] I'd love to fight later. Like much later. Okay, now. Fine.
- [won] Cool cool cool. I'll just be over there. Far over there.
- [lost] See? Fights are easier than the stuff I'm avoiding.
- [soft] I booked a trip somewhere. Anywhere. I'll tell you if I find it.
- [bye] If anyone asks where I went, I went to a better route.

## Self-Saboteur
- [meet] You'll probably beat me. I mean, I'll probably do something to make sure you do.
- [pre | rival team strong] I could have a perfect team. I swapped two for fun. Don't ask why.
- [won] See? Knew I'd lose. Knowing is half of it. The other half is making it come true.
- [lost] I won? Oh no. I mean, yay! No, oh no. Wait.
- [soft] Why do I do this? Do you know why I do this?
- [bye] If I get better, I'll tell you. If I don't, don't be nice about it.

## Fallen Idealist
- [meet] I used to think a good heart was enough. Don't tell me I was wrong yet.
- [pre] I still believe it. Quietly. Show me it was worth it.
- [won] Maybe you're right. Maybe it matters. Maybe even a little.
- [lost] See? The world doesn't care. But I'm still here. That's something.
- [soft | arc: healing] I fed a stray today. That's the old me coming back. Little by little.
- [bye] Keep the faith I lost. You carry it better.

## Collector
- [meet] You have a Shiny Magikarp in your party? May I just look? Just look.
- [pre] I only fight trainers with interesting teams. Congratulations. You're interesting.
- [won] ...May I have your autograph? It's for my collection. And for me.
- [lost] Oh, thank you for the battle! I'll put it in the memory box.
- [soft | player has a rare item] I won't ask to trade. I'll just stare. Politely.
- [bye] Come back with something strange. I pay in stories.

## Natural Talent
- [meet] I don't practice, I just do. That sounds cooler than it is.
- [pre] I got a gym badge yesterday on a coin flip. Bet you're better prepared.
- [won] How did you do that? I've never had to figure that out before.
- [lost] Wow, that worked? I'm as shocked as you are.
- [soft] Everybody thinks it's effortless. It's not. I just hide the sweat.
- [bye] Teach me the hard way sometime. I'd like to learn the hard way.

## Caretaker
- [meet] Is that your {name}? Let me check its paws. Sorry, habit.
- [pre] I'll battle, but if it gets hurt I stop. Those are my rules.
- [won] {name} is wonderful. Take care of it. Seriously.
- [lost] Is everyone okay? Do you need a Revive? I always carry one.
- [soft | rest stop] I made soup for the whole party. There's a bowl for every Pokémon.
- [bye] Drink water. Sleep. You're no good to anyone tired.

## Chaos Agent
- [meet] Hi! Let's do something dumb! I have ideas! Seven of them!
- [pre] I replaced my moves with whatever was funny. Don't ask which.
- [won] That was GREAT. Can we do it again but with hats?
- [lost] Sorry, my {rname} used a move I didn't plan. It was perfect.
- [soft] Rules are suggestions. Dinner is a rule, though. Dinner is sacred.
- [bye] Expect a gift soon. It might be a pie. It might be a Pokémon.

## Secret Softie
- [meet] Don't think I'm nice. I'm not. This is a trick.
- [pre] I'll beat you, then I'll give you a berry. For tactical reasons.
- [won] ...Good job. Eat something. Please. I mean it, you look pale.
- [lost] Shut up. I'm not smiling. It's a muscle spasm.
- [soft | player sneezes] Here. A scarf. It was just lying around. Totally not mine.
- [bye] Don't tell anyone about the soup. Or the scarf. Or any of this.

## Reluctant Battler
- [meet] I don't want to fight. But apparently I'm good at it.
- [pre] Please be gentle. Nope, that's a lie. Let's do our best.
- [won] Thank goodness it's over. Is anybody hurt?
- [lost] I won, and I feel sick. Is that normal?
- [soft | arc: turning] When I stop fighting, I'll tell you. Just not today.
- [bye] If I stop, tell me it's okay. I'll need to hear it.

## Former Antagonist
- [meet] I was on the wrong side. You probably know. I'm working on it.
- [pre] I won't hold back. Holding back is how I used to hurt people.
- [won] Thank you. I needed someone to prove I could lose and still be okay.
- [lost] I don't want credit for winning. I want to earn the next one.
- [soft | player trusts] You're the first person who didn't flinch when I walked in.
- [bye] If you see my old crew, tell them there's a door out. It's open.

## Quiet Observer
- [meet] ...I watched your last battle. Interesting.
- [pre] I don't say much. My team says the rest.
- [won] You moved like someone listening. Not many do.
- [lost] Hm. Thank you. That was clear.
- [soft | player alone] I saw you give your last berry away. I won't mention it again.
- [bye] I'll be watching. In the nice way.
