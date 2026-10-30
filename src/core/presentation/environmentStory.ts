// Environmental storytelling (catalog 67): the battle background hints at what
// is going on in the run without an explorable overworld. Every hint comes from
// real run state: the crisis meter, the event that started the battle, legend
// clues found, Shadow Pokémon, the stage's theme. Pure; presentation only.

export type EnvHint = 'storm' | 'haze' | 'faction' | 'ruins' | 'lab' | 'corrupted';

export interface EnvInput {
  /** Crisis meter 0-5 (core/story/crisis.ts). */
  crisis: number;
  /** Legend clues found this run (the `legend-clue` event flag). */
  legendClues: number;
  /** The stage theme's name ("The Chemical Plant"). */
  themeName: string;
  /** The event that started this battle: its id and catalog group. */
  event: { id: string; group: string } | null;
  /** Whether the foe is a Shadow Pokémon. */
  shadowFoe: boolean;
}

export interface EnvStory {
  hints: EnvHint[];
  /** The villain team's colour when `faction` is a hint. */
  factionColor: number | null;
}

const FACTIONS: [RegExp, number][] = [
  [/rocket/, 0xd02828],
  [/aqua/, 0x2860d0],
  [/magma/, 0xd05020],
  [/galactic/, 0x40a0a0],
  [/plasma/, 0xd8d8e8],
  [/flare/, 0xf07020],
  [/skull/, 0x707070],
  [/yell/, 0xf070b0],
  [/star/, 0x9050d0],
  [/poacher/, 0x806040],
];

const LAB = /lab|plant|power|factory|tower|research|silph|institute/i;

export function environmentStory(i: EnvInput): EnvStory {
  const hints: EnvHint[] = [];
  if (i.crisis >= 3) hints.push('storm');
  else if (i.crisis >= 1) hints.push('haze');
  const villain = i.event && (i.event.group === 'Tricksters, villains and teams' || /poacher|rocket|aqua|magma|skull|yell|star-|galactic|plasma|flare/.test(i.event.id));
  const factionColor = villain ? (FACTIONS.find(([re]) => re.test(i.event!.id))?.[1] ?? 0x606060) : null;
  if (villain) hints.push('faction');
  if (i.legendClues > 0 || (i.event && /Legendary Route|World Sites|Haunted Detour/.test(i.event.group))) hints.push('ruins');
  if (LAB.test(i.themeName) || (i.event && /Form Research|Delta Research/.test(i.event.group))) hints.push('lab');
  if (i.shadowFoe || (i.event && /Shadow Pokémon|Habitats/.test(i.event.group))) hints.push('corrupted');
  return { hints, factionColor };
}
