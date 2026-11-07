// Story Overhaul S2: the words of Beats 1 to 4 and 10 (design doc "Opening scripts"). Before Beat 4 the player is "you".

import type { Tone } from './identity';

export const MONTAGE: { shot: string; line: string }[] = [
  { shot: 'Mist over a forest canopy. Pokémon move between the trees.', line: 'There are places the Circuit does not like to talk about.' },
  { shot: 'A Trainer in the rain, one Pokémon left. The opponent is calm and towering.', line: 'Some battles are not about winning.' },
  { shot: 'A Gym Leader alone in an empty arena, adjusting a worn glove.', line: 'Every Leader was a stranger once.' },
  { shot: 'A lab corridor. An unseen hand slides a sealed container into a rack.', line: 'Somebody is always counting what is missing.' },
  { shot: 'A mountain ridge. A vast shape crosses the moon and is gone.', line: 'Old stories are not always old.' },
  { shot: 'A stadium roars. A banner reading International Research Exhibition lowers into frame.', line: 'The world is watching, and the world is not always kind.' },
  { shot: 'Four Trainers at four stations, each beneath a different regional sky.', line: 'You will not walk this road alone.' },
  { shot: 'A silhouette on a rooftop, watching a screen that shows the other seven shots.', line: 'Now, tell me. Who are you?' },
];

export const OBJECTS: { id: string; name: string; lines: [string, string] }[] = [
  { id: 'map', name: 'Wall map with pins', lines: ['A paper map of the Circuit, soft at the folds. Red pins sit in small clusters.', 'Next to each pin, a date in a small hand. None of the dates are far apart.'] },
  { id: 'clipping', name: 'Pinned clipping', lines: ['A clipping from last week: "Quiet Roads, Loud Rumours". The paper is still sharp.', 'Someone has underlined one word in pencil. The word is "again".'] },
  { id: 'incubator', name: 'Cracked incubator', lines: ['A glass incubator with a hairline crack. The lamp inside is off.', 'A sticky note: "Do NOT hatch until I am back. -O." Under it, smaller: "(I mean it.)"'] },
  { id: 'cabinet', name: 'Locked cabinet', lines: ['A tall cabinet, locked. A symbol is burned into the door, too worn to read.', 'You tilt your head and the symbol seems to change. It does not, when you look straight at it.'] },
  { id: 'sleeper', name: 'Sleeping Pokémon', lines: ['A Pokémon is asleep in the rest corner, curled around a worn cushion.', 'It breathes slowly. One ear twitches when you step close.'] },
];
/** Quick Start requires only these two. */
export const QUICK_OBJECTS = ['map', 'clipping'];

export const VANCE_OPENING = ['VANCE: Ah, hold that thought. [She speaks into her collar.] Note, Tuesday. Visitor on time or late, check ledger. [She finally looks up.]', 'VANCE: You were late.'];

export interface ToneQuestion { prompt: string; options: { text: string; tone: Tone; reply: string; flag?: 'getting_to_it' }[] }
export const VANCE_QUESTIONS: ToneQuestion[] = [
  { prompt: 'You were late.', options: [
    { text: 'I am sorry. The road was longer than I thought.', tone: 'formal', reply: 'Formal. Good. It is a long road. Sit if you like.' },
    { text: 'I was giving the forest time to prepare.', tone: 'playful', reply: 'Ha. Marginalia, did you hear that? Write it down. No, do not draw it.' },
    { text: 'What were you doing while you waited?', tone: 'warm', reply: 'Fair question. Cataloguing the dust. It is a long list.' },
  ] },
  { prompt: 'Do you know why you are here?', options: [
    { text: 'I think so. You study what happens between a Trainer and a Pokémon.', tone: 'formal', reply: 'Close enough. Precise would be better, but close is a start.' },
    { text: 'No. Nobody told me.', tone: 'warm', reply: 'Good. Honest. Nobody told me either, at your age.' },
    { text: 'You tell me.', tone: 'playful', flag: 'getting_to_it', reply: 'Ah, well, I will get to that. Hold that thought. [She records a note.] Now what was I... yes. Later. I will get to it.' },
  ] },
  { prompt: 'Tea?', options: [
    { text: 'Tea sounds good.', tone: 'warm', reply: 'Vance holds a cup and smiles.' },
    { text: 'No, thank you. I would like to start.', tone: 'formal', reply: 'Vance sets down the cup.' },
  ] },
];

export const VANCE_CLOSING: Record<Tone, string> = {
  warm: 'Right. I have a feeling about you. I have a feeling about most people, and I am wrong at least half the time. Let us find out which half this is.',
  formal: 'Very well. Before I tell you anything, I would like to know who you are. In order. From the top.',
  playful: 'You will do. Marginalia, put the kettle down. We are going to ask this person a number of questions, and some of them will not be fair.',
};
export const VANCE_NAME_PROMPT = 'First, your name. For the record.';
export const PRONOUN_PROMPT = 'And how should I refer to you, when I write about you? Pick one. You can change it later.';
export const FIRST_NAME_USE = 'VANCE: {player}. Good. That is a name that will hold up on a cover sheet. Now. Sit. I am going to ask you some questions.';

export const BRIEFING = [
  'VANCE: This is the Field Notebook. Write in it. Draw in it. Do not lose it. If you lose it, tell me, and I will tell you how disappointed I am.',
  'VANCE: The Circuit Charter is short. Eight gym towns in each of three regions, and six badges in each region will do. Then the League. How you get them is your business.',
];

/** Beat 7: one line per backstory (the design doc's pitch for each). */
export const BACKSTORY_PITCH: Record<string, string> = {
  bs_ex_criminal: 'You used to work for the Mythic Marauders, and you left. Was that redemption or escape?',
  bs_champion_heir: 'Your father was Champion, and everyone has already decided who you are.',
  bs_viridian: 'You grew up by the Viridian forest and understood Pokémon before you learned to command them.',
  bs_aether: 'You were made in a laboratory to be the perfect Trainer, and then something went wrong.',
  bs_hisui: 'You come from Hisui, centuries ago, pulled into a world that has moved on.',
};

export const QUIZ_INTRO = 'VANCE: A few questions. No right answers, no timer. Answer like nobody is grading you, because nobody is.';
export const QUICK_QUIZ_INTRO = 'VANCE: Six quick questions. Answer from the gut.';
export const REVEAL_INTRO = 'VANCE: Marginalia has made her sketches. Three Pokémon who might suit you. Look them over.';
export const REVEAL_LABELS = ['The match', 'The complement', 'The surprise'] as const;
export const BACKSTORY_PROMPT = 'VANCE: Before we go on. Where are you coming from? Not where you were born. What you carry.';
export const STARTER_PROMPT = 'VANCE: Choose your first partner. This one is for keeps, at least for this run.';
export const INTAKE_STARTER_PROMPT = 'VANCE: Who walks out with you this time? Take one you know, or let me ask a few questions.';
