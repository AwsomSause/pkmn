// Builds the Story Run world scenes (Design v2 Part XI event templates, Part II-F Eevee Crossroads, Part II camp scenes).
// Writes src/data/story/worldScenes.json (compact; src/data/story/worldScenes.ts expands it into events) and
// src/data/story/text/worldScenes.en.json (the lines). Run: node tools/story/build-world-scenes.mjs, then npm run data:story.
// Scene choice and timing live in core/story2/worldScenes.ts. Tokens: {player}, {starter}, {a}, {b}, {pokemon}, {place}.
import { writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const text = {};
// counter shorthand: "c:compassion" adds 1; "f:key" sets a flag true; "m:key" adds a memory.
const fx = (id, list) => list.map((s, i) => {
  const [k, v] = s.split(':');
  const eid = `${id}_${i + 1}`;
  if (k === 'c') return { id: eid, kind: 'add_counter', counter: `world_${v}`, amount: 1 }; // own counters, so backstory ending grids never move
  if (k === 'f') return { id: eid, kind: 'set_flag', key: v, value: true };
  if (k === 'm') return { id: eid, kind: 'add_memory', memory: v };
  throw new Error(s);
});

// [id, min act, needs, beat 1, beat 2, [[choice id, choice text, effects], ...]]
// needs: after:<event id>, heartbond:<n>, backstory:<id>, team:<evil team id>, eevee
const T = [
 ['mediator', 2, [], 'A Gym Leader and your rival are arguing in the town square over who gets the arena tomorrow. Neither will back down.', 'Both turn to you at once. "You tell them," they say together, and glare at each other.', [['side_leader', 'Side with the Leader.', ['c:loyalty', 'f:tpl_mediator_leader']], ['side_rival', 'Side with your rival.', ['c:ambition', 'f:tpl_mediator_rival']], ['exhibition', 'Propose a joint exhibition.', ['c:compassion', 'f:tpl_mediator_joint', 'm:tpl_exhibition']]]],
 ['champion_notices', 2, ['heartbond:4'], 'A woman in a plain coat watches your battle from the fence. When it ends she walks over. It is the Champion.', '"Your {starter} does a little hop before it attacks. Who taught it that?" She smiles. "Spar with me. Just one exchange."', [['spar', 'Accept the spar.', ['c:ambition', 'f:tpl_champion_spar']], ['ask', 'Ask her why she noticed.', ['c:resolve', 'f:tpl_champion_asked']]]],
 ['quiet_hand', 4, [], 'The lights in the station fail all at once. In the dark a hand closes on your sleeve and pulls you behind a pillar.', '"Not here," a voice whispers, one you have heard in a uniform before. "I can help you, if you help me."', [['follow', 'Follow them.', ['c:independence', 'f:tpl_quiet_ally']], ['report', 'Report them.', ['c:loyalty', 'f:tpl_quiet_reported']], ['ask', 'Ask what they want.', ['c:compassion', 'f:tpl_quiet_debt']]]],
 ['messages', 1, [], 'Your rival\'s device buzzes for the third time. They glance at it and flip it face down, too fast.', '"It\'s nothing," they say, before you asked anything.', [['peek', 'Peek when they look away.', ['c:ambition', 'f:tpl_messages_peeked']], ['ask', 'Ask them straight.', ['c:loyalty', 'f:tpl_messages_asked']], ['ignore', 'Let it go.', ['c:compassion']]]],
 ['background_legend', 3, [], 'For the third time today you see it: a huge silhouette against the clouds, gone when you blink.', '{starter} saw it first. It is still staring at the empty sky, very still, like it is listening.', [['follow', 'Follow its gaze.', ['c:resolve', 'f:tpl_legend_rung2', 'm:tpl_silhouette']], ['wait', 'Wait for it to come back.', ['c:compassion', 'f:tpl_legend_rung2']]]],
 ['concerned_trainer', 1, [], 'A trainer steps into your path. "Your {starter} looks worn out. Do you ever let it rest?"', '"I\'ll battle you for it. No items. If you lose, you rest here tonight. Deal?"', [['accept', 'Accept, and win without items.', ['c:resolve', 'f:tpl_concerned_fought']], ['rest', 'Admit they might be right, and rest.', ['c:compassion', 'f:tpl_concerned_rested']]]],
 ['sibling', 3, [], 'A letter is waiting at the Pokémon Center. The handwriting is shaky. A trainer you once helped needs you: their brother has gone missing near the old mine.', 'Two ways in: the quiet service tunnel, or straight through the front gate.', [['stealth', 'Take the tunnel.', ['c:independence', 'f:tpl_sibling_stealth']], ['force', 'Go through the gate.', ['c:resolve', 'f:tpl_sibling_force']]]],
 ['closed_doors', 2, [], 'The Gym door has a hand-written sign: CLOSED. Inside, the Leader sits alone on the arena floor.', '"I lost four in a row," they say. "Maybe the Gym doesn\'t need me."', [['help', 'Help them with the chores, and talk.', ['c:compassion', 'f:tpl_doors_reopened']], ['challenge', 'Challenge them to snap out of it.', ['c:ambition', 'f:tpl_doors_challenged']]]],
 ['stranger_challenger', 2, [], 'A masked trainer is waiting at the route gate. "Battle me. One of my Pokémon will be holding back." They do not explain.', 'You win, barely. The stranger nods, as if a box had been ticked, and walks off without a word.', [['chase', 'Call after them.', ['c:ambition', 'f:tpl_stranger_met']], ['let', 'Let them go.', ['c:independence', 'f:tpl_stranger_met']]]],
 ['follower', 1, [], 'For three stops now, the same small wild Pokémon has been trailing your party. It hides when you turn around.', 'Tonight it sits at the edge of your campfire light, watching your food.', [['feed', 'Leave some food out for it.', ['c:compassion', 'f:tpl_follower_fed']], ['ignore', 'Ignore it.', ['c:independence']], ['battle', 'Challenge it.', ['c:ambition', 'f:tpl_follower_battled']]]],
 ['two_rivals', 3, [], 'At the festival, two of your rivals spot you at the same time and both hurry over.', '"Tell them my team is better." "Tell them mine is." The crowd is watching.', [['duo', 'Suggest the three of you team up for the duo show.', ['c:compassion', 'f:tpl_rivals_friends']], ['pick', 'Praise the one who trained harder.', ['c:ambition', 'f:tpl_rivals_picked']]]],
 ['thief_mon', 1, [], 'Something tugs your bag, and a small blur bolts into the market with one of your items in its mouth.', 'The chase runs through fruit stalls and under carts, until the thief is cornered behind a bakery, holding your item like a treasure.', [['bargain', 'Trade it a snack for the item.', ['c:compassion', 'f:tpl_thief_friend']], ['battle', 'Battle for it back.', ['c:resolve', 'f:tpl_thief_beaten']]]],
 ['false_name', 3, [], 'The friendly traveller from two towns ago said they were from the coast. Today they told someone else they grew up in the hills.', 'They catch you listening. Their smile stays, but their eyes go flat.', [['expose', 'Call out the lie.', ['c:resolve', 'f:tpl_false_exposed']], ['private', 'Ask them privately.', ['c:compassion', 'f:tpl_false_confided']]]],
 ['champion_lesson', 3, ['after:ev_tpl_champion_notices'], 'The Champion finds you again. "Three turns. You don\'t attack, you only read me. Ready?"', 'By the third turn you can see her next move before she calls it. "There," she says. "That\'s Standing Ground."', [['thank', 'Thank her.', ['c:loyalty', 'm:tpl_standing_ground']], ['again', 'Ask to go again.', ['c:ambition', 'm:tpl_standing_ground']]]],
 ['lost_ace', 4, [], 'Your rival lost a big match today, the kind everyone heard about. Now nobody can find them.', 'You find them on the roof of the Pokémon Center, ace\'s Poké Ball in their hands, saying nothing.', [['stay', 'Sit with them.', ['c:compassion', 'f:tpl_lost_supported']], ['leave', 'Give them space.', ['c:independence', 'f:tpl_lost_left']]]],
 ['copycat', 3, [], 'A trainer at the gym is using your exact strategy, move for move. They even copy how you stand.', '"I watched you," they admit, red-faced. "It works. I wanted it to work for me."', [['teach', 'Teach them why it works.', ['c:compassion', 'f:tpl_copycat_taught']], ['counter', 'Show them how to beat it.', ['c:ambition', 'f:tpl_copycat_countered']]]],
 ['photograph', 1, [], 'Inside a second-hand book you find an old photograph: young researchers in front of an institute, squinting in the sun.', 'One face is Professor Vance. The others you half recognise from wanted posters and League banners.', [['keep', 'Keep the photo.', ['c:resolve', 'f:tpl_photo_kept', 'm:tpl_photograph']], ['show', 'Show it to Vance.', ['c:loyalty', 'f:tpl_photo_shown']]]],
 ['private_life', 4, [], 'At the edge of a gala, a Gym Leader and a stranger in a dark coat exchange a folded note and a look that lasts too long.', 'The stranger wears a pin you have seen on the other side of a battle.', [['confront', 'Confront the Leader.', ['c:resolve', 'f:tpl_private_confronted']], ['quiet', 'Keep it to yourself.', ['c:loyalty', 'f:tpl_private_kept']], ['use', 'Use what you saw.', ['c:ambition', 'f:tpl_private_used']]]],
 ['returned_rescue', 4, ['after:ev_tpl_follower'], 'In the middle of the worst storm of the trip, a familiar shape bursts out of the rain: the little Pokémon you fed weeks ago.', 'It has grown. It plants itself beside {starter} and faces the storm with you.', [['welcome', 'Welcome it back.', ['c:compassion', 'm:tpl_returned']]]],
 ['rejected', 3, [], 'The trainer you turned down at the start of the road is waiting at the route gate, arms crossed.', '"You didn\'t think I was good enough. I\'ve been training since. Let\'s see now."', [['apologise', 'Apologise, then battle.', ['c:compassion', 'f:tpl_rejected_redeemed']], ['battle', 'Just battle.', ['c:ambition', 'f:tpl_rejected_grudge']]]],
 ['divided_loyalty', 4, [], 'Mid-battle, your rival\'s ace freezes. It is looking at {starter}, not at the fight.', 'Your rival notices too. For a second they look lost.', [['press', 'Press the advantage.', ['c:ambition', 'f:tpl_divided_pressed']], ['timeout', 'Call a timeout.', ['c:compassion', 'f:tpl_divided_timeout']]]],
 ['radio', 3, [], 'Your radio crackles past midnight. Static, then a voice reading numbers in a careful order.', 'The broadcast repeats. If you could find where it comes from, you might learn what is planned.', [['triangulate', 'Triangulate the signal.', ['c:resolve', 'f:tpl_radio_traced']], ['off', 'Turn it off and sleep.', ['c:independence']]]],
 ['researcher_notice', 1, [], 'A researcher with a clipboard stops you. "Your {starter}\'s readings are... unusual. May I study it for an hour?"', 'Their instruments are already humming.', [['consent', 'Agree, and stay with it.', ['c:loyalty', 'f:tpl_research_consented']], ['refuse', 'Politely refuse.', ['c:independence', 'f:tpl_research_refused']]]],
 ['recruited_leader', 4, ['team:gilt'], 'A Gym is empty. Every lamp is on, and on the Leader\'s desk is a note: "Gone to where strength is honoured. Do not follow."', 'The note is pinned with a laurel-shaped club pin.', [['follow', 'Follow the trail.', ['c:resolve', 'f:tpl_recruited_followed']], ['report', 'Tell the League.', ['c:loyalty', 'f:tpl_recruited_reported']]]],
 ['final_battle', 5, [], 'An envelope with an old League seal: a former Champion, long retired, asks for one last battle.', '"Not for the crown. For the memory of it."', [['accept', 'Accept.', ['c:loyalty', 'f:tpl_final_accepted', 'm:tpl_last_battle']], ['decline', 'Decline kindly.', ['c:compassion']]]],
 ['proof', 1, [], 'A kid at the café refuses to believe you beat that Gym Leader. "Prove it!"', 'The whole café leans in.', [['badge', 'Show the badge.', ['c:ambition', 'f:tpl_proof_badge']], ['scar', 'Show the scorch mark on your bag.', ['c:resolve', 'f:tpl_proof_scar']], ['witness', 'Let {starter} vouch for you.', ['c:loyalty', 'f:tpl_proof_witness']]]],
 ['ancient_recognition', 2, ['backstory:bs_hisui'], 'A wild Pokémon in an old regional form steps out of the trees and bows to you, low and slow.', 'You remember the old greeting. Your hands make it before you think.', [['speak', 'Speak in the old way.', ['c:loyalty', 'f:tpl_ancient_spoken', 'm:tpl_ancient']], ['leave', 'Bow back and walk on.', ['c:independence']]]],
 ['two_suitors', 1, [], 'Two trainers are shouting over a wild Pokémon that clearly does not belong to either of them.', '"You decide!" they both say to you. The Pokémon looks at you too.', [['calm', 'Calm everyone down first.', ['c:compassion', 'f:tpl_suitors_calmed']], ['choose', 'Let the Pokémon choose.', ['c:independence', 'f:tpl_suitors_chose']], ['decide', 'Decide for them.', ['c:ambition', 'f:tpl_suitors_decided']]]],
 ['signature_trade', 5, [], 'A friend from earlier in the journey finds you. "You helped me when nobody would. I want you to have something."', 'They hold out a Poké Ball: their own signature Pokémon. "Look after it. If I ever ask, you bring it back."', [['accept', 'Accept the trust.', ['c:loyalty', 'f:tpl_entrusted']], ['refuse', 'Tell them to keep it.', ['c:compassion']]]],
 ['team_up', 4, [], 'The way ahead is blocked by something too big for one trainer. Your rival walks up beside you without a word.', '"Same plan as always?" they ask. You never had a plan. You nod anyway.', [['together', 'Fight together.', ['c:loyalty', 'f:tpl_team_up', 'm:tpl_team_up']], ['alone', 'Tell them you\'ve got this.', ['c:independence', 'f:tpl_team_up_refused']]]],
];

const templates = T.map(([id, act, needs, b1, b2, choices]) => {
  const ev = `ev_tpl_${id}`;
  text[`tpl.${id}.b1`] = b1;
  text[`tpl.${id}.b2`] = b2;
  for (const [cid, ct] of choices) text[`tpl.${id}.c.${cid}`] = ct;
  return { id, act, needs, choices: choices.map(([cid, , eff]) => ({ id: cid, effects: fx(`${ev}_${cid}`, eff) })) };
});

// Eevee Crossroads (Part II-F): one offer per form, at a Recovery stop, when an Eevee of level 20+ is in the party.
const EEVEE = {
  vaporeon: ['water', 'The rain at {place} had not stopped for an hour. {pokemon} sat at the edge of the water, ears flat, then waded in until only its head showed. It looked back at {player} and did not shiver.', 'Something in the way {pokemon} floated was calm, the kind of calm that is not the same as being brave. A soft blue light moved under its fur, like the lake had decided to keep a little of it.'],
  jolteon: ['electric', 'The storm over {place} turned the sky white twice before the thunder came. Everyone else ducked. {pokemon} stood up, fur lifting, every hair bright with static, and laughed in the quick, breathless way it does before a race.', '{player} felt the air prickle. The sparks did not fade. They ran down its legs and into the grass in neat blue lines. It looked ready to run for a week.'],
  flareon: ['fire', 'The fire at {place} was small, only a camp stove and a handful of embers, but {pokemon} would not leave it. It crept closer than was sensible and pressed its nose against the warm iron.', 'The fur around its neck began to glow orange, not burning, only warming from inside, like a coal waiting to be breathed on. It sneezed and a tiny spark jumped. Then it grinned, proud and a little singed.'],
  espeon: ['psychic', 'Morning at {place}, and {pokemon} was awake before you. It sat very still, looking at the lightening sky as if it had heard its name.', 'When you reached for the water flask, {pokemon} was already pushing it your way. A violet light gathered between its eyes and settled into a small gem. It seemed to know your next thought and was too polite to say it.'],
  umbreon: ['dark', 'Night at {place}. The camp was dark, and for the first time {pokemon} was not afraid of it. It walked out past the firelight and stood where the shadows were deepest, watching.', 'A faint ring of gold appeared on its ears, then its forehead, glowing softly like moon-lit letters. It came back and pressed against your leg, warm and sure. The dark had been a friend all along.'],
  leafeon: ['grass', 'The mossy rock at {place} was the first thing that day {pokemon} would not walk past. It lay down on it and stayed. Light came through the leaves in coins.', 'Small green shoots curled out of its tail, and the air smelled of rain and cut grass. It was not a dramatic change, more like a plant turning toward light it had always had.'],
  glaceon: ['ice', 'The frozen rock at {place} cracked in the cold, and {pokemon} pressed its paw against the ice and kept it there. Breath fogged in front of both of you.', 'Frost climbed its fur in small, careful patterns, like writing. It stepped lightly on the snow and left a clean print. It looked as if it had learned to enjoy the cold on purpose.'],
  sylveon: ['fairy', 'Nothing dangerous happened at {place}. That was the point. You shared your food, sat through a long afternoon, and when {player} was low, {pokemon} stayed pressed against your side.', 'Pink and white ribbons grew from its ears and drifted in the air as if held by a hand you could not see. It had been learning, one kindness at a time, how to carry what you felt.'],
};
text['eevee.c.change'] = 'Let it change.';
text['eevee.c.stay'] = 'Stay as Eevee.';
text['eevee.stay'] = '{pokemon} watches the light fade, then bumps your hand. It seems content to be exactly what it is.';
const eevee = Object.entries(EEVEE).map(([form, [type, b1, b2]]) => {
  text[`eevee.${form}.b1`] = b1;
  text[`eevee.${form}.b2`] = b2;
  return { form, type };
});

// Camp scenes (Part II, Party chemistry): 2 per chemistry type, played at Recovery stops for a pair that has that chemistry.
const CAMP = {
  rivalry: ['{a} and {b} race to the stream and back, twice, then a third time because neither will admit the second was a tie.', '{a} knocks over a training log. {b} knocks over a bigger one, and looks at {a} as if to say: your move.'],
  mentor: ['{a} shows {b} how to dodge a falling pinecone. {b} gets hit four times, then dodges the fifth, and {a} looks very proud.', '{b} copies {a}\'s battle stance all evening, a little wobbly. {a} pretends not to notice, then fixes its footing.'],
  protective: ['A noise in the dark. {a} is between it and {b} before anyone else is awake.', '{b} trips on a root. {a} is already there, nudging it back up, glaring at the root.'],
  dislike: ['{a} and {b} sit on opposite sides of the fire, backs turned. The berries end up split exactly in half.', '{a} takes {b}\'s favourite sleeping spot. {b} stares at it for a long time.'],
  inseparable: ['{a} and {b} fall asleep in a heap, and neither moves when you add a blanket.', '{a} will not eat until {b} has eaten. {b} will not eat until {a} has. You end up feeding them at the same time.'],
  jealousy: ['{b} watches you praise {a} and turns its back. It is very obviously not sulking.', '{b} brings you a stick, then another, then a whole branch, while {a} gets its fur brushed.'],
  comfort: ['{b} startles at every owl hoot. {a} lies down beside it, slow and heavy, until it stops shaking.', 'Thunder rumbles far off. {a} hums. {b} closes its eyes.'],
  daredevil: ['{a} and {b} dare each other to the edge of the cliff and back. You do not watch.', '{a} and {b} come back from the river soaked, delighted, and carrying a fish neither of them can explain.'],
  odd_couple: ['{a} tries to organise the camp. {b} unorganises it, piece by piece, very cheerfully.', '{a} naps. {b} balances berries on {a}\'s head until the stack falls over and everyone laughs.'],
  caretaker: ['{a} has not left {b}\'s side since the last battle. It keeps checking the bandage.', '{a} brings {b} the softest leaves for its bed and arranges them twice.'],
  idol: ['{b} copies the way {a} yawns. Then the way it stretches. Then the way it glares at a Starly.', '{b} follows {a} around camp all evening, three steps behind, matching its walk.'],
  old_friends: ['{a} and {b} sit together looking at the stars, the way family does, without needing anything to happen.', '{a} and {b} share a memory nobody else in the party has. You can tell from how they both look at the same tree.'],
};
const camp = Object.entries(CAMP).map(([kind, [s1, s2]]) => {
  text[`camp.${kind}.1`] = s1;
  text[`camp.${kind}.2`] = s2;
  return kind;
});

writeFileSync(new URL('src/data/story/worldScenes.json', root), JSON.stringify({ note: 'Generated by node tools/story/build-world-scenes.mjs. Expanded by src/data/story/worldScenes.ts.', templates, eevee, camp }) + '\n');
writeFileSync(new URL('src/data/story/text/worldScenes.en.json', root), JSON.stringify(text, null, 1) + '\n');
console.log(`templates ${templates.length}, eevee ${eevee.length}, camp ${camp.length}, text ${Object.keys(text).length}`);
