// Care & party life (W2, ledger rows I1-I10, I21, I33, M50, M57-M60, F31, F38, F42, F44, F48).
// Everything here is pure and deterministic: no random rolls except hashes of ids, so reload and replay agree.
// Care actions run on the map (phase map/reward/decision/shop) and are limited per stop; a "stop" is
// `run.encountersCompleted`. Numbers live in data/care.json.

import { adjustBond, bondOf } from '../bond';
import type { Content } from '../contentSchema';
import { warmEggs } from '../eggs';
import { changeFriendship } from '../friendship';
import { maxHp } from '../pokemon';
import type { PokemonInstance, RunState } from '../state';
import { CARE, careMultiplier, type Care } from './mods';

export * from './mods';

const PHASES: readonly RunState['phase'][] = ['reward', 'decision', 'map', 'shop'];
const TRAIN_STATS = ['atk', 'def', 'spa', 'spd', 'spe'] as const;
export type TrainStat = (typeof TRAIN_STATS)[number];
export const CARE_ACTIONS = ['pet', 'hug', 'feed', 'groom', 'lullaby', 'cheer', 'train', 'sing', 'dress', 'fetch', 'story', 'wake', 'nickname', 'favourite', 'ace'] as const;
export type CareAction = (typeof CARE_ACTIONS)[number];

export const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
const pickLine = (kind: string, seed: string): string => {
  const lines = CARE.quips[kind] ?? [''];
  return lines[hash(seed) % lines.length]!;
};

/** The care record of a Pokémon (created on first use). */
export function careOf(mon: PokemonInstance): Care {
  mon.care ??= { mood: 0, fatigue: 0, fights: 0, wins: 0, falls: 0, benchedWins: 0, stop: -1, done: {}, sulkUntil: -1 };
  return mon.care;
}

export const displayName = (content: Content, mon: PokemonInstance): string => mon.care?.nickname || (content.species.get(mon.speciesId)?.name ?? mon.speciesId);

/** Flavors: each Pokémon has a favourite and a hated one (from its id); each berry has one (from its id). */
export function favoriteFlavor(mon: PokemonInstance): string {
  return CARE.flavors[hash(`fav:${mon.uid}`) % CARE.flavors.length]!;
}
export function hatedFlavor(mon: PokemonInstance): string {
  const fav = favoriteFlavor(mon);
  const others = CARE.flavors.filter((f) => f !== fav);
  return others[hash(`hate:${mon.uid}`) % others.length]!;
}
export const berryFlavor = (itemId: string): string => CARE.flavors[hash(`berry:${itemId}`) % CARE.flavors.length]!;
export function berryReaction(mon: PokemonInstance, itemId: string): 'liked' | 'neutral' | 'hated' {
  const f = berryFlavor(itemId);
  return f === favoriteFlavor(mon) ? 'liked' : f === hatedFlavor(mon) ? 'hated' : 'neutral';
}

/** Berries waiting loose in the Bag, best match first for this Pokémon. */
export function bagBerries(content: Content, run: RunState, mon: PokemonInstance): string[] {
  const order = { liked: 0, neutral: 1, hated: 2 } as const;
  return Object.entries(run.looseHeld ?? {})
    .filter(([id, n]) => n > 0 && content.catalog.get(id)?.family.startsWith('Berries'))
    .map(([id]) => id)
    .sort((a, b) => order[berryReaction(mon, a)] - order[berryReaction(mon, b)] || a.localeCompare(b));
}

/** Use counters reset when the stop clock moves on. */
function rollStop(run: RunState, care: Care): void {
  if (care.stop !== run.encountersCompleted) {
    care.stop = run.encountersCompleted;
    care.done = {};
  }
}
const used = (care: Care, action: string) => care.done[action] ?? 0;

export function moodWord(mood: number): string {
  return mood >= 3 ? 'Elated' : mood === 2 ? 'Happy' : mood === 1 ? 'Content' : mood === 0 ? 'Calm' : mood === -1 ? 'Uneasy' : mood === -2 ? 'Sad' : 'Miserable';
}

function setMood(care: Care, delta: number): void {
  care.mood = Math.max(-CARE.moodRange, Math.min(CARE.moodRange, care.mood + delta));
}

/** Why a care action cannot be done now, or null. */
export function careProblem(content: Content, run: RunState, partyIndex: number, action: CareAction, arg?: string): string | null {
  const mon = run.party[partyIndex];
  if (!mon) return 'Choose a Pokémon.';
  if (!PHASES.includes(run.phase)) return 'Care only works between battles.';
  const care = mon.care ?? { ...({} as Care), stop: -1, done: {}, sulkUntil: -1, mood: 0, fatigue: 0, fights: 0, wins: 0, falls: 0, benchedWins: 0 };
  const fresh = care.stop === run.encountersCompleted ? care.done : {};
  const n = (k: string) => fresh[k] ?? 0;
  if (mon.hp <= 0 && action !== 'nickname' && action !== 'favourite' && action !== 'ace') return 'It has fainted.';
  switch (action) {
    case 'pet': return n('pet') >= CARE.pet.perStop ? 'It has had enough petting for this stop.' : null;
    case 'hug': return n('hug') >= 1 ? 'You already hugged it at this stop.' : null;
    case 'feed': {
      if (care.sulkUntil >= run.encountersCompleted) return 'It is sulking and will not eat yet.';
      if (n('feed') >= 1) return 'It already ate at this stop.';
      return bagBerries(content, run, mon).length === 0 ? 'You have no loose berries in the Bag.' : null;
    }
    case 'groom': return n('groom') >= 1 ? 'Already groomed at this stop.' : null;
    case 'lullaby': return n('lullaby') >= 1 ? 'Already tucked in at this stop.' : mon.hp >= maxHp(content, mon) ? 'It is not hurt.' : null;
    case 'cheer': return n('cheer') >= 1 ? 'You already cheered it up at this stop.' : null;
    case 'train': return n('train') >= 1 ? 'Already training at this stop.' : !arg || !TRAIN_STATS.includes(arg as TrainStat) ? 'Pick a stat to train.' : null;
    case 'sing': return n('sing') >= 1 ? 'Already sang at this stop.' : run.eggs.length === 0 ? 'You carry no Eggs.' : null;
    case 'wake': return n('wake') >= 1 ? 'Already woken at this stop.' : care.fatigue <= 0 ? 'It is not tired.' : null;
    case 'fetch': return n('fetch') >= 1 ? 'Already played fetch at this stop.' : null;
    case 'story': return care.storyHeard ? 'It has heard its bedtime story.' : mon.friendship < CARE.story.minFriendship ? 'It does not trust you enough to listen yet.' : null;
    case 'dress': return arg !== '' && arg !== undefined && !CARE.accessories[arg] ? 'Unknown accessory.' : null;
    default: return null;
  }
}

/** Taps a tap-mini-interaction reported ("tap:7"); the UI counts them, the rules clamp and judge them. */
export const tapsOf = (arg?: string): number => {
  const m = /^tap:(\d{1,3})$/.exec(arg ?? '');
  return m ? Math.min(99, Number(m[1])) : 0;
};
export const TAP_ACTIONS: readonly CareAction[] = ['cheer', 'groom', 'wake'];

/** The accessory names, in menu order. */
export const ACCESSORIES = Object.keys(CARE.accessories);

/** Bonus candies when a caught Pokémon is released (a small gift by level). */
export function releaseGift(content: Content, level: number): number {
  return content.balance.careEffects ? Math.floor(level / CARE.releaseGift.candiesPerLevels) : 0;
}

/** One care action on a party Pokémon. Returns a new run and a message; throws when not allowed. */
export function careAction(content: Content, current: RunState, partyIndex: number, action: CareAction, arg?: string): { run: RunState; message: string } {
  const problem = careProblem(content, current, partyIndex, action, arg);
  if (problem) throw new Error(problem);
  const run = structuredClone(current);
  const mon = run.party[partyIndex]!;
  const care = careOf(mon);
  rollStop(run, care);
  const name = displayName(content, mon);
  const seed = `${mon.uid}:${run.encountersCompleted}:${action}`;
  const tick = () => (care.done[action] = used(care, action) + 1);
  let message = '';
  switch (action) {
    case 'pet':
      tick();
      changeFriendship(content, mon, CARE.pet.friendship);
      message = `${name} ${pickLine('pet', seed)}`;
      break;
    case 'hug':
      tick();
      changeFriendship(content, mon, CARE.hug.friendship);
      adjustBond(bondOf(run, mon.uid), { affection: CARE.hug.affection });
      setMood(care, CARE.hug.mood);
      message = `${name} ${pickLine('hug', seed)}`;
      break;
    case 'feed': {
      tick();
      const berry = bagBerries(content, run, mon)[0]!;
      const reaction = berryReaction(mon, berry);
      run.looseHeld![berry] = (run.looseHeld![berry] ?? 1) - 1;
      if (run.looseHeld![berry]! <= 0) delete run.looseHeld![berry];
      const r = CARE.feed[reaction];
      changeFriendship(content, mon, r.friendship);
      setMood(care, r.mood);
      if (reaction === 'hated') care.sulkUntil = run.encountersCompleted + CARE.feed.sulkStops;
      const berryName = content.catalog.get(berry)?.name ?? berry;
      message = `${name} ate the ${berryName}: ${berryFlavor(berry)}. It ${pickLine(reaction === 'hated' ? 'hatedBerry' : 'likedBerry', seed)}`;
      break;
    }
    case 'groom':
      tick();
      mon.status = null;
      care.sparkle = true;
      changeFriendship(content, mon, CARE.groom.friendship + (tapsOf(arg) >= CARE.tap.goal ? CARE.tap.groomBonusFriendship : 0));
      message = `${name} ${pickLine('groom', seed)}`;
      break;
    case 'lullaby': {
      tick();
      const heal = Math.max(1, Math.round(maxHp(content, mon) * CARE.lullaby.healShare));
      mon.hp = Math.min(maxHp(content, mon), mon.hp + heal);
      changeFriendship(content, mon, CARE.lullaby.friendship);
      message = `${name} ${pickLine('lullaby', seed)} (+${heal} HP)`;
      break;
    }
    case 'cheer':
      tick();
      setMood(care, CARE.cheer.mood + (care.mood < 0 ? CARE.cheer.lowMoodBonus : 0) + (tapsOf(arg) >= CARE.tap.goal ? CARE.tap.cheerBonusMood : 0));
      message = `${name} ${pickLine('cheer', seed)} Mood: ${moodWord(care.mood)}.`;
      break;
    case 'train':
      tick();
      care.train = { stat: arg as TrainStat, left: CARE.train.fights };
      message = `${name} will train ${arg!.toUpperCase()} for the next ${CARE.train.fights} fights (+${CARE.train.statPercent}%).`;
      break;
    case 'sing': {
      tick();
      warmEggs(run, CARE.sing.eggSteps);
      changeFriendship(content, mon, 1);
      message = `${name} sings to the Eggs. They stir a little closer to hatching.`;
      break;
    }
    case 'wake':
      tick();
      care.fatigue = Math.max(0, care.fatigue - CARE.tap.wakeFatigue - (tapsOf(arg) >= CARE.tap.goal ? CARE.tap.wakeBonusFatigue : 0));
      message = `${name} ${pickLine('wake', seed)}`;
      break;
    case 'fetch': {
      tick();
      changeFriendship(content, mon, CARE.fetch.friendship);
      const berries = [...content.catalog.values()].filter((e) => e.family.startsWith('Berries') && e.effect?.kind === 'held').map((e) => e.id).sort();
      const found = berries.length > 0 && (hash(`fetch:${seed}`) % 1000) / 1000 < CARE.fetch.chance ? berries[hash(`fetchitem:${seed}`) % berries.length]! : null;
      if (found) run.looseHeld = { ...run.looseHeld, [found]: (run.looseHeld?.[found] ?? 0) + 1 };
      message = `${name} ${pickLine('fetch', seed)}${found ? ` It brought back a ${content.catalog.get(found)!.name}!` : ' Nothing this time.'}`;
      break;
    }
    case 'story':
      care.storyHeard = true;
      changeFriendship(content, mon, CARE.story.friendship);
      setMood(care, CARE.story.mood);
      message = `You tell ${name} its story. It ${pickLine('story', seed)}`;
      break;
    case 'dress':
      if (arg) care.accessory = arg;
      else delete care.accessory;
      message = arg ? `${name} puts on the ${arg} (+${CARE.accessories[arg]!.percent}% ${CARE.accessories[arg]!.stat.toUpperCase()}).` : `${name} takes its accessory off.`;
      break;
    case 'nickname': {
      const text = (arg ?? '').replace(/\s+/g, ' ').trim().slice(0, CARE.nicknameMax);
      if (text) care.nickname = text;
      else delete care.nickname;
      message = text ? `Nickname set: ${text}.` : 'Nickname cleared.';
      break;
    }
    case 'favourite':
      care.favourite = !care.favourite;
      message = care.favourite ? `${name} is a favourite.` : `${name} is no longer a favourite.`;
      break;
    case 'ace':
      care.ace = !care.ace;
      message = care.ace ? `${name} is now your ace.` : `${name} is no longer your ace.`;
      break;
  }
  return { run, message };
}

/** After a won battle: the Pokémon that fought tire and grow; the others rest. `fought` is the uids that took part. */
export function careVictory(run: RunState, fought: readonly string[]): void {
  for (const mon of run.party) {
    const care = careOf(mon);
    if (fought.includes(mon.uid)) {
      care.fights += 1;
      care.wins += 1;
      care.benchedWins = 0;
      care.fatigue = Math.min(CARE.fatigue.max, care.fatigue + CARE.fatigue.perFight);
      if (care.fatigue < CARE.fatigue.max) setMood(care, CARE.winMood);
      if (care.train && care.train.left > 0) {
        care.train.left -= 1;
        if (care.train.left <= 0) delete care.train;
      }
      if (!care.talent && care.fights >= CARE.talent.afterFights && mon.friendship >= CARE.talent.minFriendship) {
        care.talent = TRAIN_STATS[hash(`talent:${mon.uid}`) % TRAIN_STATS.length]!;
      }
    } else {
      care.fatigue = Math.max(0, care.fatigue - CARE.fatigue.benchedRecovery);
      care.benchedWins += 1;
      if (care.benchedWins === CARE.benchedWinsToSulk) setMood(care, -1);
    }
  }
}

/** A player Pokémon fainted in battle. */
export function careFaint(mon: PokemonInstance): void {
  const care = careOf(mon);
  care.falls += 1;
  setMood(care, CARE.faintMood);
}

/** What a Pokémon can become, as short phrases ("Raichu at Lv.30", "Raichu with an item"), for the summary (F45). */
export function evolutionPreview(content: Content, mon: PokemonInstance): string[] {
  const sp = content.species.get(mon.speciesId);
  if (!sp) return [];
  const name = (id: string) => content.species.get(id)?.name ?? id;
  return sp.evolutions.map((e) => (e.level !== undefined ? `${name(e.to)} at Lv.${e.level}` : e.item === content.balance.friendship.evolutionItem ? `${name(e.to)} with high friendship` : `${name(e.to)} with an item`));
}

/** Heal-order suggestion (F49): the hurt Pokémon to heal first (lowest share of HP, fainted last), or null when all are full. */
export function healFirst(content: Content, run: RunState): PokemonInstance | null {
  const hurt = run.party.filter((m) => m.hp > 0 && m.hp < maxHp(content, m)).sort((a, b) => a.hp / maxHp(content, a) - b.hp / maxHp(content, b));
  return hurt[0] ?? null;
}

/** The ace fell: the rest of the party is shaken (mood drops a step). */
export function careAceFell(run: RunState, uid: string): void {
  for (const m of run.party) if (m.uid !== uid) setMood(careOf(m), -1);
}

export { careMultiplier };
