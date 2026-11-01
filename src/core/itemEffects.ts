// What a held item really does, in words, worked out from the same hook data the
// battle engine reads (core/battle/held.ts). Used by the Pokémon screen's Items tab,
// so the text can never drift from the implementation: every hook kind is listed here
// and a unit test fails when a new one is added without a line.
// Pure: reads content, changes nothing, rolls nothing.

import type { Content, HeldHook } from './contentSchema';
import type { PokemonInstance } from './state';

const cap = (s: string): string => (s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s);
const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const pct = (p: number): string => `${num(p)}%`;
const times = (m: number): string => `×${num(m)}`;
const types = (list: string[]): string => list.map(cap).join('/');
const statName = (s: string): string => ({ atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', hp: 'HP', all: 'every stat but HP', crit: 'critical-hit chance', acc: 'accuracy', random: 'a random stat' })[s] ?? s;
const statusName = (s: string): string => ({ brn: 'burn', psn: 'poison', par: 'paralysis', slp: 'sleep', frz: 'freeze', tox: 'bad poison' })[s] ?? s;

/** Hooks whose number is multiplied by the copies held (see held.ts: `hook.percent * copies`). */
const SCALES_WITH_COPIES = new Set<HeldHook['hook']>(['typePower', 'categoryPower', 'accuracy', 'survive', 'contactDamage', 'contactStatus', 'flinch', 'steal', 'endTurn', 'gem']);
/** Hooks that are used up (or fire once) when they trigger: the rest work all the time. */
const ACTIVATED = new Set<HeldHook['hook']>([
  'gem', 'sash', 'survive', 'powerHerb', 'whiteHerb', 'mentalHerb', 'redCard', 'ejectButton', 'airBalloon', 'dodgeFirst', 'steal', 'shedShell', 'wakeAll',
  'berryHeal', 'berryCure', 'berryPp', 'berryStat', 'berrySure', 'berryFirst', 'berryResist', 'berrySuper', 'berryRetaliate', 'terrainSeed', 'absorb', 'koHeal', 'koAttribute', 'formHeld',
]);

interface HookText {
  /** What it does, as one or two short sentences. */
  text: string;
  /** A restriction or downside worth its own line, e.g. Choice lock. */
  catch?: string;
  /** When it triggers, if it isn't "always". */
  when?: string;
  /** Used up / fires once. */
  once?: boolean;
}

function hookText(hook: HeldHook, copies: number): HookText {
  const c = Math.max(1, copies);
  switch (hook.hook) {
    case 'typePower':
      return { text: `${types(hook.types)} moves hit ${pct(hook.percent * c)} harder${hook.species ? ' (only for its own species)' : ''}.`, when: `when the holder uses a ${types(hook.types)} move` };
    case 'gem':
      return { text: `The first ${cap(hook.type)} move it uses hits ${times(hook.multiplier)} as hard; the gem is used up (one use per copy).`, when: `first ${cap(hook.type)} move`, once: true };
    case 'categoryPower':
      return { text: `${cap(hook.category)} moves hit ${pct(hook.percent * c)} harder.`, when: `when it uses a ${hook.category} move` };
    case 'power':
      return { text: `All its moves hit ${pct(hook.percent)} harder.`, catch: hook.recoil ? `It loses ${pct(hook.recoil * 100)} of its max HP after each hit it lands.` : undefined };
    case 'superPower':
      return { text: `Super-effective hits do ${pct(hook.percent)} more damage.`, when: 'on super-effective hits' };
    case 'drive':
      return { text: `Its Normal-type moves become ${cap(hook.type)} and hit ${pct(hook.percent)} harder.` };
    case 'metronome':
      return { text: `Using the same move again and again adds ${pct(hook.percent)} damage per use, up to ${pct(hook.max)}.`, when: 'while repeating one move' };
    case 'stat': {
      const only = hook.species ? ' (only for its own species)' : hook.canEvolve ? ' (only while it can still evolve)' : '';
      return { text: `${cap(statName(hook.stat))} is ${times(hook.multiplier)}${only}.` };
    }
    case 'choiceLock':
      return { text: 'It can only use the first move it picks until it switches out.', catch: 'Locked into one move per battle.' };
    case 'crit':
      return { text: `+${hook.stages} critical-hit stage${hook.stages === 1 ? '' : 's'}${hook.critDamage ? `; critical hits do ${times(hook.critDamage)} instead of ×1.5` : ''}.`, when: hook.species ? 'for its own species' : undefined };
    case 'accuracy':
      return { text: `Its moves are ${pct(hook.percent * c)} more accurate${hook.whenMovingLast ? ' when it moves last' : ''}.` };
    case 'evasion':
      return { text: `Opponents' accuracy against it is cut by ${pct(hook.percent)}.` };
    case 'moveLast':
      return { text: `It moves last in its priority bracket${hook.sureHit ? ', and its moves never miss' : ''}.`, catch: 'Slower than usual.' };
    case 'endTurn':
      return { text: hook.typed ? `At the end of each turn, a ${cap(hook.typed)}-type holder ${hook.fraction >= 0 ? 'heals' : 'loses'} ${pct(Math.abs(hook.fraction) * c * 100)} of its max HP; any other holder ${(hook.otherwise ?? 0) < 0 ? 'loses' : 'heals'} ${pct(Math.abs(hook.otherwise ?? 0) * 100)}.` : `${hook.fraction >= 0 ? 'Heals' : 'Costs'} ${pct(Math.abs(hook.fraction) * c * 100)} of its max HP at the end of every turn.`, when: 'every turn' };
    case 'survive':
      return { text: `${pct(Math.min(100, hook.percent * c))} chance to hang on with 1 HP after a hit that would faint it.`, when: 'on a knockout blow' };
    case 'sash':
      return { text: 'From full HP, it survives one hit that would faint it, with 1 HP. Used up.', when: 'at full HP', once: true };
    case 'contactDamage':
      return { text: `Attackers that touch it lose ${pct(hook.fraction * c * 100)} of their max HP.`, when: 'when hit by a contact move' };
    case 'contactStatus':
      return { text: `${pct(Math.min(100, hook.percent * c))} chance to inflict ${statusName(hook.status)} when it makes contact.`, when: 'on its contact moves' };
    case 'flinch':
      return { text: `${pct(Math.min(100, hook.percent * c))} chance to make the target flinch.`, when: 'when it moves first' };
    case 'selfStatus':
      return { text: `Gives the holder ${statusName(hook.status)} at the end of its first turn, and its ${cap(hook.type)} moves hit ${pct(hook.percent)} harder.`, catch: `The holder gets ${statusName(hook.status)}.`, when: 'end of its first turn' };
    case 'airBalloon':
      return { text: 'Floats: Ground moves miss it until the balloon pops when it is hit.', once: true };
    case 'ringTarget':
      return { text: 'Type immunities no longer protect it.', catch: 'Takes damage it would normally ignore.' };
    case 'bindDamage':
      return { text: `Binding moves (Wrap, Fire Spin...) hurt ${times(hook.multiplier)} as much.` };
    case 'drain':
      return { text: `Draining moves heal ${pct(hook.percent)} more.` };
    case 'powerHerb':
      return { text: 'A two-turn move is used right away, once.', once: true };
    case 'whiteHerb':
      return { text: 'Undoes a stat drop once.', once: true };
    case 'lightClay':
      return { text: `Screens it sets last ${hook.turns} more turn${hook.turns === 1 ? '' : 's'}.` };
    case 'redCard':
      return { text: 'When it is hit, the attacker is forced out. Used up.', once: true };
    case 'ejectButton':
      return { text: 'When it is hit, it switches out. Used up.', once: true };
    case 'mentalHerb':
      return { text: 'Shrugs off infatuation, Taunt, Encore and similar once.', once: true };
    case 'damageTaken':
      return { text: `${hook.percent < 0 ? `Takes ${pct(-hook.percent)} less` : `Takes ${pct(hook.percent)} more`} damage${hook.fromWild ? ' from wild Pokémon' : ''}${hook.superEffective ? ' from super-effective hits' : ''}${hook.holderType ? ` while it is ${cap(hook.holderType)}-type` : ''}.` };
    case 'weatherTurns':
      return { text: `${hook.weathers.map(cap).join('/')} it starts lasts ${hook.turns} turns.` };
    case 'exp':
      return { text: `Earns ${times(hook.multiplier)} experience.` };
    case 'growth':
      return { text: `Every ${hook.everyLevels} level${hook.everyLevels === 1 ? '' : 's'} it gains, it grows ${cap(statName(hook.stat))} like a vitamin.`, when: 'on level up' };
    case 'noEvolve':
      return { text: 'It will not evolve while holding this.', catch: 'Blocks evolution.' };
    case 'healing':
      return { text: `Healing it receives is ${pct(hook.percent)} stronger.` };
    case 'friendship':
      return { text: `It grows fond of you ${pct(hook.percent)} faster.` };
    case 'endure':
      return { text: `Its chance to Toughen It Out (hang on at 1 HP) is ${times(hook.multiplier)}.`, when: 'on a knockout blow' };
    case 'randomStat':
      return { text: `${pct(hook.percent)} chance each turn to raise a random stat.`, when: 'every turn' };
    case 'koHeal':
      return { text: `After a knockout it heals ${pct(hook.fraction * 100)} of its max HP${hook.holderType ? ` (${cap(hook.holderType)}-type holders only)` : ''}.`, when: 'after a knockout' };
    case 'koAttribute':
      return { text: `Each knockout adds ${hook.amount >= 0 ? '+' : ''}${hook.amount} ${cap(hook.attribute)} to your run, up to ${hook.cap}.`, when: 'on each knockout' };
    case 'steal':
      return { text: `${pct(Math.min(100, hook.percent * c))} chance to steal the target's held item.`, when: 'on a hit', once: true };
    case 'stickyBarb':
      return { text: `Costs it ${pct(hook.fraction * 100)} of its max HP each turn and sticks to whatever hits it.`, catch: 'Hurts the holder.', when: 'every turn' };
    case 'absorb':
      return { text: `${cap(hook.type)} moves that hit it are absorbed and raise ${cap(statName(hook.stat))} by ${hook.stages} stage${hook.stages === 1 ? '' : 's'}. Used up.`, when: `when hit by a ${cap(hook.type)} move`, once: true };
    case 'shedShell':
      return { text: 'It can always switch out, even when trapped.' };
    case 'wildLevel':
      return { text: `While it leads the party, wild Pokémon are ${Math.abs(hook.amount)} level${Math.abs(hook.amount) === 1 ? '' : 's'} ${hook.amount < 0 ? 'lower' : 'higher'} (per copy).` };
    case 'dodgeFirst':
      return { text: 'Dodges the first hit of a battle.', once: true, when: 'first hit' };
    case 'statusShield':
      return { text: `Cuts the chance of being afflicted by ${pct(hook.percent)}.` };
    case 'weatherImmune':
      return { text: `No damage from ${hook.weathers.map(cap).join(' or ')}.` };
    case 'wakeAll':
      return { text: 'Wakes it from sleep once. Used up.', once: true };
    case 'statusImmune':
      return { text: `Cannot be ${hook.statuses.map(statusName).join(' or ')}.` };
    case 'formHeld':
      return { text: `Holding it changes the holder's form in battle.`, when: 'in battle' };
    case 'memory':
      return { text: `A Silvally holding it becomes ${cap(hook.type)}-type, and Multi-Attack follows.` };
    case 'berryHeal':
      return { text: `Eaten at or below ${pct(hook.below * 100)} HP: heals ${hook.flat ? `${hook.flat} HP` : `${pct((hook.fraction ?? 0) * 100)} of max HP`}.`, when: `at ${pct(hook.below * 100)} HP or less`, once: true };
    case 'berryCure':
      return { text: `Eaten when ${hook.statuses.map(statusName).join(' or ')}${hook.confusion ? ' or confusion' : ''} strikes, curing it.`, when: 'when afflicted', once: true };
    case 'berryPp':
      return { text: `Restores ${hook.amount} PP to a move that runs dry.`, when: 'a move hits 0 PP', once: true };
    case 'berryStat':
      return { text: `Eaten at or below ${pct(hook.below * 100)} HP: ${cap(statName(hook.stat))} +${hook.stages}.`, when: `at ${pct(hook.below * 100)} HP or less`, once: true };
    case 'berrySure':
      return { text: `Eaten at or below ${pct(hook.below * 100)} HP: its next move cannot miss.`, when: `at ${pct(hook.below * 100)} HP or less`, once: true };
    case 'berryFirst':
      return { text: `Eaten at or below ${pct(hook.below * 100)} HP: it moves first next turn.`, when: `at ${pct(hook.below * 100)} HP or less`, once: true };
    case 'berryResist': {
      const through = hook.through ?? 0.5;
      return { text: hook.any ? `Cuts a super-effective hit to ${pct(through * 100)} of its damage. Used up.` : `Cuts a super-effective ${cap(hook.type)} hit to ${pct(through * 100)} of its damage. Used up.`, when: hook.any ? 'on a super-effective hit' : `on a super-effective ${cap(hook.type)} hit`, once: true };
    }
    case 'berrySuper':
      return { text: `Eaten after a super-effective hit: heals ${pct(hook.fraction * 100)} of max HP.`, when: 'after a super-effective hit', once: true };
    case 'berryRetaliate':
      if (hook.stat) return { text: `Hit by a ${hook.category} move: ${cap(statName(hook.stat))} +${hook.stages}. Used up.`, when: `on a ${hook.category} hit`, once: true };
      return { text: `Hurts a ${hook.category} attacker for ${pct((hook.fraction ?? 0) * 100)} of its max HP. Used up.`, when: `on a ${hook.category} hit`, once: true };
    case 'terrainSeed':
      return { text: `Under ${cap(hook.terrain)} Terrain, ${cap(statName(hook.stat))} +${hook.stages}. Used up.`, when: `${cap(hook.terrain)} Terrain`, once: true };
    default: {
      const never: never = hook;
      return { text: `Has an effect in battle (${(never as HeldHook).hook}).` };
    }
  }
}

export interface HeldItemInfo {
  id: string;
  name: string;
  icon: string | null;
  copies: number;
  max: number | null;
  description: string;
  /** "passive" works all the time; "activated" fires on a condition (and may be used up). */
  mode: 'passive' | 'activated' | 'mixed';
  /** The real gameplay effects, one line each, with numbers for the copies held. */
  effects: string[];
  /** Downsides and restrictions. */
  catches: string[];
  /** When it triggers (empty for always-on). */
  conditions: string[];
  /** How extra copies combine. */
  stacking: string;
  /** True if it is used up. */
  consumed: boolean;
  /** An extended explanation for items with several effects or interactions. */
  detail: string[];
  /** The item has no effect that works in battle yet (only its description). */
  noEffect: boolean;
}

/** Everything the Items tab shows for one held item. */
export function describeHeldItem(content: Content, itemId: string, copies: number): HeldItemInfo {
  const entry = content.catalog.get(itemId);
  const max = entry?.max ?? null;
  const base: HeldItemInfo = {
    id: itemId,
    name: entry?.name ?? itemId,
    // Catalog art id, the same convention as data/index.ts catalogIconAssetId.
    icon: entry ? `item.gen5/${entry.icon ?? '0'}` : null,
    copies,
    max,
    description: entry?.description ?? '',
    mode: 'passive',
    effects: [],
    catches: [],
    conditions: [],
    stacking: '',
    consumed: false,
    detail: [],
    noEffect: false,
  };
  if (!entry || entry.effect?.kind !== 'held' || entry.status !== 'supported') {
    const state = entry && entry.status === 'pending' ? 'Not working in battle yet.' : 'No battle effect.';
    return { ...base, noEffect: true, effects: [state], stacking: max === null ? 'No stack limit.' : `Up to ${max} copies.` };
  }
  const hooks = entry.effect.hooks;
  const texts = hooks.map((h) => hookText(h, copies));
  const activated = hooks.filter((h) => ACTIVATED.has(h.hook)).length;
  base.mode = activated === 0 ? 'passive' : activated === hooks.length ? 'activated' : 'mixed';
  base.effects = texts.map((t) => t.text);
  base.catches = texts.flatMap((t) => (t.catch ? [t.catch] : []));
  base.conditions = [...new Set(texts.flatMap((t) => (t.when ? [cap(t.when)] : [])))];
  base.consumed = texts.some((t) => t.once) && hooks.every((h) => ACTIVATED.has(h.hook));
  const scaled = hooks.some((h) => SCALES_WITH_COPIES.has(h.hook));
  const limit = max === null ? 'no limit' : `max ${max}`;
  base.stacking = entry.stacksOn === 'team' ? `Shared by the whole team: every copy anyone holds counts (${limit}).` : scaled ? `Each copy adds to the number above (${limit}; you hold ${copies}).` : max === 1 ? 'One at most; it does not stack.' : `Extra copies do not make it stronger (${limit}).`;
  if (hooks.length > 1) base.detail.push(`${hooks.length} effects are active together: ${base.effects.join(' ')}`);
  if (base.catches.length > 0) base.detail.push(`The catch: ${base.catches.join(' ')}`);
  if (base.consumed) base.detail.push('It is used up the first time it triggers. A used berry or seed is gone for the rest of the battle only; check the Bag after a fight.');
  return base;
}

export interface HeldBuild {
  items: HeldItemInfo[];
  /** Total number of separate effects currently active on this Pokémon. */
  activeEffects: number;
  /** One-line summary, e.g. "3 items, 4 effects active (2 passive, 2 triggered)". */
  summary: string;
}

/** The whole held build of one Pokémon, items in a stable order (passive first, then by name). */
export function heldBuild(content: Content, mon: PokemonInstance): HeldBuild {
  const items = Object.entries(mon.held ?? {})
    .filter(([, copies]) => copies > 0)
    .map(([id, copies]) => describeHeldItem(content, id, copies))
    .sort((a, b) => Number(a.mode === 'activated') - Number(b.mode === 'activated') || a.name.localeCompare(b.name));
  const live = items.filter((i) => !i.noEffect);
  const activeEffects = live.reduce((n, i) => n + i.effects.length, 0);
  const triggered = live.filter((i) => i.mode !== 'passive').length;
  const summary = items.length === 0 ? 'Holding nothing.' : `${items.length} item${items.length === 1 ? '' : 's'}, ${activeEffects} effect${activeEffects === 1 ? '' : 's'} active (${live.length - triggered} always on, ${triggered} triggered).`;
  return { items, activeEffects, summary };
}
