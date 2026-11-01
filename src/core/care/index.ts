// Care & party life (W2, ledger rows I1-I10, I21, I33, M50, M57-M60, F31, F38, F42, F44, F48).
// Everything here is pure and deterministic: no random rolls except hashes of ids, so reload and replay agree.
// Care actions run on the map (phase map/reward/decision/shop) and are limited per stop; a "stop" is
// `run.encountersCompleted`. Numbers live in data/care.json.

import { adjustBond, bondOf } from '../bond';
import type { Content } from '../contentSchema';
import { seasonOf } from '../clock';
import { warmEggs } from '../eggs';
import { changeFriendship } from '../friendship';
import { calcStats, maxHp } from '../pokemon';
import type { PokemonInstance, RunState } from '../state';
import { CARE, TEAMWORK, careMultiplier, type Care } from './mods';

export * from './mods';

const PHASES: readonly RunState['phase'][] = ['reward', 'decision', 'map', 'shop'];
const TRAIN_STATS = ['atk', 'def', 'spa', 'spd', 'spe'] as const;
export type TrainStat = (typeof TRAIN_STATS)[number];
export const CARE_ACTIONS = ['pet', 'hug', 'feed', 'groom', 'lullaby', 'cheer', 'train', 'sing', 'dress', 'fetch', 'story', 'wake', 'showoff', 'hold', 'whistle', 'singalong', 'teamdance', 'race', 'healcircle', 'spar', 'nickname', 'favourite', 'ace'] as const;
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
    case 'teamdance': return n('teamdance') >= 1 ? 'The team already danced at this stop.' : run.party.length < 2 ? 'You need at least two Pokémon.' : null;
    case 'race': return n('race') >= 1 ? 'Already raced at this stop.' : run.party.length < 2 ? 'You need at least two Pokémon.' : null;
    case 'healcircle': return n('healcircle') >= 1 ? 'The circle already met at this stop.' : healers(content, run).length < CARE.team.healCircle.minHealers ? `A healing circle needs ${CARE.team.healCircle.minHealers} Pokémon that know a healing move.` : null;
    case 'spar': return n('spar') >= 1 ? 'Already sparred at this stop.' : run.party.length < 2 ? 'You need a sparring partner.' : !arg || !TRAIN_STATS.includes(arg as TrainStat) ? 'Pick a stat to train.' : null;
    case 'singalong': return n('singalong') >= 1 ? 'Already sang along at this stop.' : !CARE.singalong.species.includes(mon.speciesId) ? 'Only singers (Jigglypuff and kin) can lead a sing-along.' : null;
    case 'whistle': {
      if (!arg || !CARE.whistle.commands[arg]) return 'Pick a command.';
      if (n('whistle') >= 1) return 'Already whistled at this stop.';
      return bondOf(run, mon.uid).trust < CARE.whistle.minTrust ? 'It does not trust you enough to listen.' : null;
    }
    case 'showoff': return n('showoff') >= 1 ? 'Already showed off at this stop.' : null;
    case 'wake': return n('wake') >= 1 ? 'Already woken at this stop.' : care.fatigue <= 0 ? 'It is not tired.' : null;
    case 'fetch': return n('fetch') >= 1 ? 'Already played fetch at this stop.' : null;
    case 'story': return care.storyHeard ? 'It has heard its bedtime story.' : mon.friendship < CARE.story.minFriendship ? 'It does not trust you enough to listen yet.' : null;
    case 'dress': return arg !== '' && arg !== undefined && !CARE.accessories[arg] ? 'Unknown accessory.' : null;
    default: return null;
  }
}

/** Party members that know a healing move (the healing circle needs several). */
function healers(content: Content, run: RunState): PokemonInstance[] {
  return run.party.filter((m) => m.hp > 0 && m.moves.some((mv) => CARE.team.healCircle.moves.includes(mv.id)));
}

/** Taps a tap-mini-interaction reported ("tap:7"); the UI counts them, the rules clamp and judge them. */
export const tapsOf = (arg?: string): number => {
  const m = /^tap:(\d{1,3})$/.exec(arg ?? '');
  return m ? Math.min(99, Number(m[1])) : 0;
};
export const WHISTLES = Object.keys(CARE.whistle.commands);
export const TAP_ACTIONS: readonly CareAction[] = ['cheer', 'groom', 'wake', 'singalong', 'teamdance'];

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
      care.hugs = (care.hugs ?? 0) + 1;
      changeFriendship(content, mon, CARE.hug.friendship + (content.balance.careEffects && CARE.cuddleEvolve.includes(mon.speciesId) ? CARE.cuddleBonus : 0));
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
    case 'teamdance': {
      tick();
      const good = tapsOf(arg) >= CARE.tap.goal;
      for (const m of run.party) {
        setMood(careOf(m), CARE.team.dance.mood + (good ? CARE.team.dance.goodMood : 0));
        changeFriendship(content, m, CARE.team.dance.friendship);
      }
      message = `${CARE.quips.dance![0]}${good ? ' What a show! Everyone feels great.' : ' (Tap faster for the bonus.)'}`;
      break;
    }
    case 'race': {
      tick();
      const spe = (m: PokemonInstance) => calcStats(content, m).spe + (hash(`race:${m.uid}:${run.encountersCompleted}`) % 7);
      const ranked = [...run.party].sort((a, b) => spe(b) - spe(a));
      const winner = ranked[0]!;
      for (const m of run.party) {
        if (m.uid === winner.uid) setMood(careOf(m), CARE.team.race.winnerMood);
        else changeFriendship(content, m, CARE.team.race.othersFriendship);
      }
      message = `Camp race! ${displayName(content, winner)} wins, ${displayName(content, ranked[1]!)} close behind.`;
      break;
    }
    case 'healcircle': {
      tick();
      const circle = healers(content, run);
      for (const m of run.party) if (m.hp > 0) m.hp = Math.min(maxHp(content, m), m.hp + Math.round(maxHp(content, m) * CARE.team.healCircle.healShare));
      message = `${circle.slice(0, 3).map((m) => displayName(content, m)).join(', ')} form a healing circle. The whole team recovers ${Math.round(CARE.team.healCircle.healShare * 100)}% HP!`;
      break;
    }
    case 'spar': {
      tick();
      const other = run.party[(partyIndex + 1) % run.party.length]!;
      const oc = careOf(other);
      care.train = { stat: arg as TrainStat, left: CARE.team.spar.fights };
      oc.train = { stat: arg as TrainStat, left: CARE.team.spar.fights };
      message = `${name} and ${displayName(content, other)} spar. Both train ${arg!.toUpperCase()} for ${CARE.team.spar.fights} fights.`;
      break;
    }
    case 'singalong': {
      tick();
      changeFriendship(content, mon, CARE.singalong.friendship);
      const good = tapsOf(arg) >= CARE.tap.goal;
      if (good) for (const m of run.party) m.boosts = [...(m.boosts ?? []), { kind: 'immune', status: 'slp' }];
      message = `${name} ${pickLine('singalong', seed)}${good ? ' Everyone is wide awake to the beat: no sleep next fight!' : ' (Tap faster for the bonus.)'}`;
      break;
    }
    case 'whistle': {
      tick();
      const cmd = CARE.whistle.commands[arg!]!;
      mon.boosts = [...(mon.boosts ?? []), { kind: 'stage', stat: cmd.stat, stages: cmd.stages, turns: cmd.turns }];
      message = `You whistle "${arg}". ${name} ${cmd.line} (${cmd.stat.toUpperCase()} +${cmd.stages} for its next fight)`;
      break;
    }
    case 'showoff':
      tick();
      bondOf(run, mon.uid).hyperReadiness = Math.min(100, bondOf(run, mon.uid).hyperReadiness + CARE.showoff.hyperReadiness);
      message = `${name} ${pickLine('showoff', seed)} Hype builds.`;
      break;
    case 'hold':
      care.holdEvolve = !care.holdEvolve;
      message = care.holdEvolve ? `${name} will not evolve until your next healing stop.` : `${name} is ready to evolve again.`;
      break;
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

/** A healing stop: Pokémon that held back from evolving change their minds (F46). Returns their uids. */
export function careRest(run: RunState, content?: Content): string[] {
  const out: string[] = [];
  if (content?.balance.careEffects) swapForms(content, run);
  for (const m of run.party) if (m.care?.holdEvolve) { delete m.care.holdEvolve; out.push(m.uid); }
  return out;
}

/**
 * Teamwork (M52): a pair member is sent in while its partner waits in the party: it gets +1 in the pair's stats,
 * once per pair per battle. Returns what happened (for the battle log), or null.
 */
export function teamworkOnSwitch(run: RunState, incomingUid: string): { uid: string; partner: string; name: string; stats: string[] } | null {
  const battle = run.battle;
  const mon = run.party.find((m) => m.uid === incomingUid);
  if (!battle || !mon) return null;
  for (const pair of TEAMWORK.pairs) {
    const partnerSpecies = pair.a === mon.speciesId ? pair.b : pair.b === mon.speciesId ? pair.a : null;
    if (!partnerSpecies) continue;
    const partner = run.party.find((m) => m.uid !== mon.uid && m.speciesId === partnerSpecies && m.hp > 0);
    const key = `tw:${pair.id}`;
    if (!partner || battle.drama.combos.includes(key)) continue;
    battle.drama.combos.push(key);
    for (const stat of pair.stats) battle.playerStages[stat] = Math.min(6, battle.playerStages[stat] + 1);
    return { uid: mon.uid, partner: partner.uid, name: pair.name, stats: [...pair.stats] };
  }
  return null;
}

/** Mastery stars (M62): the lead counts the moves it used; at the threshold a move earns a star (+1 PP, +5% accuracy). Returns new stars. */
export function careMoves(run: RunState, events: readonly { type: string; side?: string; moveId?: string }[]): string[] {
  const battle = run.battle;
  const mon = battle && !battle.doubles ? run.party[battle.activeIndex] : undefined;
  const stars: string[] = [];
  if (!mon) return stars;
  for (const e of events) {
    if (e.type !== 'move' || e.side !== 'player') continue;
    const slot = mon.moves.find((m) => m.id === e.moveId);
    if (!slot) continue;
    slot.uses = (slot.uses ?? 0) + 1;
    if (!slot.star && slot.uses >= CARE.stars.usesForStar) {
      slot.star = true;
      stars.push(slot.id);
    }
  }
  return stars;
}

/** Seasonal forms (M64): at a healing stop a Pokémon of a form family takes the form of the run's current season. Returns how many changed. */
export function swapForms(content: Content, run: RunState): number {
  const season = seasonOf(content, run);
  let changed = 0;
  for (const mon of run.party) {
    for (const rule of CARE.formSwaps) {
      if (!rule.family.includes(mon.speciesId)) continue;
      const to = rule.bySeason[season];
      if (to && to !== mon.speciesId && content.species.has(to)) {
        mon.speciesId = to;
        mon.hp = Math.min(mon.hp, maxHp(content, mon));
        changed += 1;
      }
    }
  }
  return changed;
}


/** The ace fell: the rest of the party is shaken (mood drops a step). */
export function careAceFell(run: RunState, uid: string): void {
  for (const m of run.party) if (m.uid !== uid) setMood(careOf(m), -1);
}

export { careMultiplier };
