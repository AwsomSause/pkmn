// Held items in battle (M8.75 item effects, slice 2).
//
// A Pokémon holds catalog items in `mon.held` (item id → copies; the director
// chose PokeRogue's model: many items, each stacking up to its max). The
// player's team items (the Plates) are counted in run.passives and passed in
// as `teamItems`. Each item's effect is a list of hooks (contentSchema
// HeldHookSchema); the engine asks this module at fixed points of a turn:
// damage, accuracy, speed, critical hits, after a hit, end of turn, switching
// in, knockouts. Berries and "once per battle" hooks are used up: an eaten
// berry loses a copy for good, a Gem or Focus Sash only for this battle.
//
// Battle boosts (X items, Dire Hit, Guard Spec., status healers) sit in
// `mon.boosts` until the Pokémon battles; stage boosts count down only while
// it is in battle.

import type { BattleBoost, BoostStat, Content, HeldHook, Move, StatusId, TypeName, Weather } from '../contentSchema';
import { calcStats, getSpecies } from '../pokemon';
import type { Rng } from '../rng';
import type { BattleState, HeldState, PokemonInstance, Stages, Volatile } from '../state';
import { clampStage } from './damage';

export type Side = 'player' | 'enemy';

/** The parts of a combatant this module reads and changes. */
export interface Holder {
  side: Side;
  mon: PokemonInstance;
  stages: Stages;
  vol: Volatile;
  flinched: boolean;
}

export interface HeldContext {
  content: Content;
  battle: BattleState;
  rng: Rng;
  /** The player's team items (run.passives): Plates count for every team member. */
  teamItems?: Record<string, number>;
}

/** What happened, for the battle text. */
export type HeldWhat =
  | 'heal'
  | 'hurt'
  | 'cure'
  | 'gem'
  | 'survive'
  | 'balloon'
  | 'pop'
  | 'helmet'
  | 'orb'
  | 'recoil'
  | 'resist'
  | 'stat'
  | 'sure'
  | 'first'
  | 'pp'
  | 'steal'
  | 'barb'
  | 'herb'
  | 'boostEnd'
  | 'attribute'
  | 'guard'
  | 'distracted';

export interface HeldEvent {
  type: 'held';
  side: Side;
  itemId: string;
  what: HeldWhat;
  hpAfter?: number;
  /** For 'stat': which stat (or "crit") and how many stages. */
  stat?: BoostStat | 'crit';
  change?: number;
  /** For 'attribute' (Scarves): the attribute and amount for the run to add. */
  attribute?: string;
  amount?: number;
  /** For 'steal': the item taken from the other side. */
  stolen?: string;
}

export interface ActiveHook {
  itemId: string;
  hook: HeldHook;
  copies: number;
}

function stateOf(battle: BattleState): HeldState {
  battle.held ??= { used: {}, choice: {}, streak: {}, popped: [], sure: [], first: [], crit: {} };
  return battle.held;
}

/** Every hook on this Pokémon: its own held items, plus the team items for the player's side. */
export function hooksOf(ctx: Pick<HeldContext, 'content' | 'teamItems'>, mon: PokemonInstance, side: Side): ActiveHook[] {
  const out: ActiveHook[] = [];
  const add = (items: Record<string, number> | undefined, teamOnly: boolean) => {
    for (const [itemId, copies] of Object.entries(items ?? {})) {
      const entry = ctx.content.catalog.get(itemId);
      if (entry?.status !== 'supported' || entry.effect?.kind !== 'held' || copies <= 0) continue;
      if (teamOnly !== (entry.stacksOn === 'team')) continue;
      for (const hook of entry.effect.hooks) {
        if ('species' in hook && hook.species && !speciesMatches(ctx.content, mon.speciesId, hook.species)) continue;
        out.push({ itemId, hook, copies });
      }
    }
  };
  add(mon.held, false);
  if (side === 'player') add(ctx.teamItems, true);
  return out;
}

function speciesMatches(content: Content, speciesId: string, list: string[]): boolean {
  const species = content.species.get(speciesId);
  return list.includes(speciesId) || (species?.form ? list.includes(species.form.base) : false);
}

function hooks<K extends HeldHook['hook']>(all: ActiveHook[], kind: K): (ActiveHook & { hook: Extract<HeldHook, { hook: K }> })[] {
  return all.filter((h) => h.hook.hook === kind) as (ActiveHook & { hook: Extract<HeldHook, { hook: K }> })[];
}

function timesUsed(ctx: HeldContext, uid: string, itemId: string): number {
  return stateOf(ctx.battle).used[uid]?.[itemId] ?? 0;
}

function markUsed(ctx: HeldContext, uid: string, itemId: string): void {
  const used = stateOf(ctx.battle).used;
  used[uid] = { ...used[uid], [itemId]: (used[uid]?.[itemId] ?? 0) + 1 };
}

/** Eats one copy of a berry (or other eaten item) for good. */
function eat(mon: PokemonInstance, itemId: string): void {
  const left = (mon.held?.[itemId] ?? 0) - 1;
  const held = { ...mon.held };
  if (left > 0) held[itemId] = left;
  else delete held[itemId];
  mon.held = held;
}

function maxHpOf(content: Content, mon: PokemonInstance): number {
  return calcStats(content, mon).hp;
}

function heal(content: Content, mon: PokemonInstance, amount: number): number {
  const before = mon.hp;
  mon.hp = Math.min(maxHpOf(content, mon), mon.hp + Math.max(0, Math.floor(amount)));
  return mon.hp - before;
}

// ---------- stats, speed, critical hits, accuracy ----------

/** Multiplier on a stat from held items (Choice items, Eviolite, Light Ball, Iron Ball, Everstone...). */
export function heldStatMultiplier(ctx: Pick<HeldContext, 'content' | 'teamItems'>, mon: PokemonInstance, side: Side, stat: 'atk' | 'def' | 'spa' | 'spd' | 'spe'): number {
  let m = 1;
  for (const { hook } of hooks(hooksOf(ctx, mon, side), 'stat')) {
    if (hook.stat !== stat && hook.stat !== 'all') continue;
    if (hook.canEvolve && getSpecies(ctx.content, mon.speciesId).evolutions.length === 0) continue;
    m *= hook.multiplier;
  }
  return m;
}

export function critStageBonus(ctx: HeldContext, holder: Holder): number {
  const fromItems = hooks(hooksOf(ctx, holder.mon, holder.side), 'crit').reduce((sum, h) => sum + h.hook.stages, 0);
  return fromItems + (stateOf(ctx.battle).crit[holder.mon.uid] ?? 0);
}

/** The critical-hit multiplier (Scope Lens: 1.75 instead of 1.5). */
export function critDamage(ctx: HeldContext, holder: Holder, base: number): number {
  return hooks(hooksOf(ctx, holder.mon, holder.side), 'crit').reduce((m, h) => (h.hook.critDamage ? Math.max(m, h.hook.critDamage) : m), base);
}

/** Multiplier on the holder's chance to hit; null means it can't miss (Lagging Tail, Micle Berry). */
export function accuracyMultiplier(ctx: HeldContext, user: Holder, target: Holder, movedLast: boolean, move?: Pick<Move, 'category'>): number | null {
  const state = stateOf(ctx.battle);
  const userHooks = hooksOf(ctx, user.mon, user.side);
  if (hooks(userHooks, 'moveLast').some((h) => h.hook.sureHit)) return null;
  if (state.sure.includes(user.mon.uid)) {
    state.sure = state.sure.filter((u) => u !== user.mon.uid);
    return null;
  }
  let m = 1;
  for (const { hook, copies } of hooks(userHooks, 'accuracy')) {
    if (hook.whenMovingLast && !movedLast) continue;
    m *= 1 + (hook.percent * copies) / 100;
  }
  const targetHooks = hooksOf(ctx, target.mon, target.side);
  for (const { hook } of hooks(targetHooks, 'evasion')) m *= 1 - hook.percent / 100;
  // Pure Incense: a wild Pokémon's status moves miss more often.
  if (ctx.battle.kind === 'wild' && user.side === 'enemy' && move?.category === 'status') {
    for (const { hook } of hooks(targetHooks, 'statusShield')) m *= 1 - hook.percent / 100;
  }
  // Lax Incense: the first move aimed at the holder each battle misses.
  for (const { itemId } of hooks(targetHooks, 'dodgeFirst')) {
    if (timesUsed(ctx, target.mon.uid, itemId) > 0) continue;
    markUsed(ctx, target.mon.uid, itemId);
    return 0;
  }
  return m;
}

/** Turn order adjustments: +1 to move first (Custap Berry), -1 to move last (Lagging Tail). Uses up a Custap boost. */
export function orderBracket(ctx: HeldContext, holder: Holder): number {
  const state = stateOf(ctx.battle);
  if (state.first.includes(holder.mon.uid)) {
    state.first = state.first.filter((u) => u !== holder.mon.uid);
    return 1;
  }
  return hooks(hooksOf(ctx, holder.mon, holder.side), 'moveLast').length > 0 ? -1 : 0;
}

// ---------- damage ----------

/** A Drive turns the holder's Normal moves into its type. */
export function moveTypeFor(ctx: Pick<HeldContext, 'content' | 'teamItems'>, mon: PokemonInstance, side: Side, type: TypeName): TypeName {
  if (type !== 'normal') return type;
  const drive = hooks(hooksOf(ctx, mon, side), 'drive')[0];
  return drive ? drive.hook.type : type;
}

/**
 * The attacker's damage multiplier from held items for one hit. Uses up a Gem
 * (pushing its event) and counts Metronome streaks.
 */
export function attackMultiplier(
  ctx: HeldContext,
  user: Holder,
  target: Holder,
  move: Move,
  moveType: TypeName,
  effectiveness: number,
  events: HeldEvent[],
): number {
  const all = hooksOf(ctx, user.mon, user.side);
  let m = 1;
  for (const { hook, copies } of hooks(all, 'typePower')) if (hook.types.includes(moveType)) m *= 1 + (hook.percent * copies) / 100;
  for (const { hook, copies } of hooks(all, 'categoryPower')) if (hook.category === move.category) m *= 1 + (hook.percent * copies) / 100;
  for (const { hook } of hooks(all, 'power')) m *= 1 + hook.percent / 100;
  for (const { hook } of hooks(all, 'superPower')) if (effectiveness > 1) m *= 1 + hook.percent / 100;
  for (const { hook } of hooks(all, 'drive')) if (move.type === 'normal') m *= 1 + hook.percent / 100;
  for (const { hook } of hooks(all, 'selfStatus')) if (hook.type === moveType) m *= 1 + hook.percent / 100;
  for (const { hook } of hooks(all, 'flinch')) if (target.flinched && hook.bonus) m *= 1 + hook.bonus / 100;
  for (const { hook } of hooks(all, 'metronome')) {
    const streak = stateOf(ctx.battle).streak[user.mon.uid];
    const repeats = streak && streak.moveId === move.id ? streak.count : 0;
    m *= 1 + Math.min(hook.max, hook.percent * repeats) / 100;
  }
  for (const { itemId, hook, copies } of hooks(all, 'gem')) {
    if (hook.type !== moveType || timesUsed(ctx, user.mon.uid, itemId) >= copies) continue;
    markUsed(ctx, user.mon.uid, itemId);
    m *= hook.multiplier;
    events.push({ type: 'held', side: user.side, itemId, what: 'gem' });
    break;
  }
  return m;
}

/** Remembers the holder's move for Metronome and Choice items. */
export function noteMoveUsed(ctx: HeldContext, user: Holder, moveId: string): void {
  const state = stateOf(ctx.battle);
  const streak = state.streak[user.mon.uid];
  state.streak[user.mon.uid] = { moveId, count: streak && streak.moveId === moveId ? streak.count + 1 : 1 };
  if (hooks(hooksOf(ctx, user.mon, user.side), 'choiceLock').length > 0 && !state.choice[user.mon.uid]) state.choice[user.mon.uid] = moveId;
}

/** The move a Choice item holds it to, if any. */
export function choiceLockedMove(ctx: Pick<HeldContext, 'battle'>, mon: PokemonInstance): string | null {
  return ctx.battle.held?.choice[mon.uid] ?? null;
}

/** The defender's damage multiplier from held items for one hit. Uses up a resist berry. */
export function defenseMultiplier(ctx: HeldContext, target: Holder, moveType: TypeName, effectiveness: number, wild: boolean, events: HeldEvent[]): number {
  const all = hooksOf(ctx, target.mon, target.side);
  const types = getSpecies(ctx.content, target.mon.speciesId).types;
  let m = 1;
  for (const { hook } of hooks(all, 'damageTaken')) {
    if (hook.fromWild && !wild) continue;
    if (hook.superEffective && effectiveness <= 1) continue;
    if (hook.holderType && !types.includes(hook.holderType)) continue;
    m *= 1 + hook.percent / 100;
  }
  for (const { itemId, hook } of hooks(all, 'berryResist')) {
    if (hook.type !== moveType || (!hook.any && effectiveness <= 1)) continue;
    eat(target.mon, itemId);
    events.push({ type: 'held', side: target.side, itemId, what: 'resist' });
    m *= 0.5;
    break;
  }
  return m;
}

/** Air Balloon (immune to Ground until hit) and Ring Target (no type immunities) change type effectiveness. */
export function adjustEffectiveness(ctx: HeldContext, target: Holder, moveType: TypeName, effectiveness: number): number {
  const all = hooksOf(ctx, target.mon, target.side);
  if (moveType === 'ground' && hooks(all, 'airBalloon').length > 0 && !stateOf(ctx.battle).popped.includes(target.mon.uid)) return 0;
  if (effectiveness === 0 && hooks(all, 'ringTarget').length > 0) {
    let m = 1;
    for (const def of getSpecies(ctx.content, target.mon.speciesId).types) {
      const value = ctx.content.typeChart[moveType]?.[def] ?? 1;
      if (value !== 0) m *= value;
    }
    return m;
  }
  return effectiveness;
}

/**
 * A hit that would knock the holder out: Focus Sash (full HP, once per battle)
 * or Focus Band (a chance per copy) leave it at 1 HP. Returns the damage to take.
 */
export function survive(ctx: HeldContext, target: Holder, damage: number, events: HeldEvent[]): number {
  if (damage < target.mon.hp || target.mon.hp <= 1) return damage;
  const all = hooksOf(ctx, target.mon, target.side);
  for (const { itemId } of hooks(all, 'sash')) {
    if (target.mon.hp < maxHpOf(ctx.content, target.mon) || timesUsed(ctx, target.mon.uid, itemId) > 0) continue;
    markUsed(ctx, target.mon.uid, itemId);
    events.push({ type: 'held', side: target.side, itemId, what: 'survive' });
    return target.mon.hp - 1;
  }
  for (const { itemId, hook, copies } of hooks(all, 'survive')) {
    if (!ctx.rng.chance(Math.min(1, (hook.percent * copies) / 100))) continue;
    events.push({ type: 'held', side: target.side, itemId, what: 'survive' });
    return target.mon.hp - 1;
  }
  return damage;
}

/** Love's chance to hang on at 1 HP, multiplied by a Destiny Knot. */
export function endureMultiplier(ctx: Pick<HeldContext, 'content' | 'teamItems'>, mon: PokemonInstance, side: Side): number {
  return hooks(hooksOf(ctx, mon, side), 'endure').reduce((m, h) => m * h.hook.multiplier, 1);
}

export function drainMultiplier(ctx: Pick<HeldContext, 'content' | 'teamItems'>, mon: PokemonInstance, side: Side): number {
  return hooks(hooksOf(ctx, mon, side), 'drain').reduce((m, h) => m * (1 + h.hook.percent / 100), 1);
}

export function bindMultiplier(ctx: Pick<HeldContext, 'content' | 'teamItems'>, mon: PokemonInstance, side: Side): number {
  return hooks(hooksOf(ctx, mon, side), 'bindDamage').reduce((m, h) => m * h.hook.multiplier, 1);
}

/** Healing the holder gets (Oval Stone). */
export function healingMultiplier(ctx: Pick<HeldContext, 'content' | 'teamItems'>, mon: PokemonInstance, side: Side): number {
  return hooks(hooksOf(ctx, mon, side), 'healing').reduce((m, h) => m * (1 + h.hook.percent / 100), 1);
}

/** How long weather the holder starts lasts (Heat Rock and friends), or `base`. */
export function weatherTurns(ctx: HeldContext, holder: Holder, weather: Weather, base: number): number {
  return hooks(hooksOf(ctx, holder.mon, holder.side), 'weatherTurns').reduce((t, h) => (h.hook.weathers.includes(weather) ? Math.max(t, h.hook.turns) : t), base);
}

/** A two-turn move fires at once (Power Herb, once per battle). */
export function usePowerHerb(ctx: HeldContext, holder: Holder, events: HeldEvent[]): boolean {
  for (const { itemId } of hooks(hooksOf(ctx, holder.mon, holder.side), 'powerHerb')) {
    if (timesUsed(ctx, holder.mon.uid, itemId) > 0) continue;
    markUsed(ctx, holder.mon.uid, itemId);
    events.push({ type: 'held', side: holder.side, itemId, what: 'herb' });
    return true;
  }
  return false;
}

/** Shed Shell: switching is always allowed. */
export function canAlwaysSwitch(ctx: Pick<HeldContext, 'content' | 'teamItems'>, mon: PokemonInstance, side: Side): boolean {
  return hooks(hooksOf(ctx, mon, side), 'shedShell').length > 0;
}

// ---------- after a hit ----------

/**
 * Everything that happens after `user` hits `target` with a damaging move
 * that dealt `dealt` damage: Life Orb, Rocky Helmet, retaliation berries,
 * contact status and flinching, Enigma, Absorb Bulb, Sticky Barb, Grip Claw,
 * the Air Balloon popping, then both sides' HP berries.
 */
export function afterHit(
  ctx: HeldContext,
  user: Holder,
  target: Holder,
  move: Move,
  moveType: TypeName,
  effectiveness: number,
  dealt: number,
  movedFirst: boolean,
  events: HeldEvent[],
): void {
  const { content, rng } = ctx;
  if (dealt <= 0) return;
  const userHooks = hooksOf(ctx, user.mon, user.side);
  const targetHooks = hooksOf(ctx, target.mon, target.side);
  const physical = move.category === 'physical';
  const state = stateOf(ctx.battle);
  const hurt = (who: Holder, fraction: number, itemId: string, what: HeldWhat) => {
    if (who.mon.hp <= 0) return;
    who.mon.hp = Math.max(0, who.mon.hp - Math.max(1, Math.floor(maxHpOf(content, who.mon) * fraction)));
    events.push({ type: 'held', side: who.side, itemId, what, hpAfter: who.mon.hp });
  };

  if (hooks(targetHooks, 'airBalloon').length > 0 && !state.popped.includes(target.mon.uid)) {
    state.popped.push(target.mon.uid);
    events.push({ type: 'held', side: target.side, itemId: hooks(targetHooks, 'airBalloon')[0]!.itemId, what: 'pop' });
  }
  for (const { itemId, hook } of hooks(userHooks, 'power')) if (hook.recoil) hurt(user, hook.recoil, itemId, 'recoil');
  if (physical) {
    for (const { itemId, hook, copies } of hooks(targetHooks, 'contactDamage')) hurt(user, hook.fraction * copies, itemId, 'helmet');
    for (const { itemId, hook, copies } of hooks(userHooks, 'contactStatus')) {
      if (target.mon.hp > 0 && !target.mon.status && rng.chance((hook.percent * copies) / 100) && !statusBlocked(ctx, target, hook.status)) {
        target.mon.status = { id: hook.status, ...(hook.status === 'slp' ? { turns: 2 } : {}) };
        events.push({ type: 'held', side: target.side, itemId, what: 'orb', stat: undefined });
      }
    }
    for (const { hook, copies } of hooks(userHooks, 'flinch')) {
      if (movedFirst && target.mon.hp > 0 && rng.chance(Math.min(1, (hook.percent * copies) / 100))) target.flinched = true;
    }
    const barb = hooks(targetHooks, 'stickyBarb')[0];
    if (barb && user.mon.hp > 0 && !(user.mon.held?.[barb.itemId] ?? 0)) {
      eat(target.mon, barb.itemId);
      user.mon.held = { ...user.mon.held, [barb.itemId]: 1 };
      events.push({ type: 'held', side: user.side, itemId: barb.itemId, what: 'barb' });
    }
  }
  for (const { itemId, hook } of hooks(targetHooks, 'berryRetaliate')) {
    if (hook.category !== move.category || user.mon.hp <= 0) continue;
    eat(target.mon, itemId);
    hurt(user, hook.fraction, itemId, 'hurt');
    break;
  }
  if (target.mon.hp > 0) {
    for (const { itemId, hook } of hooks(targetHooks, 'berrySuper')) {
      if (effectiveness <= 1) continue;
      eat(target.mon, itemId);
      heal(content, target.mon, maxHpOf(content, target.mon) * hook.fraction * healingMultiplier(ctx, target.mon, target.side));
      events.push({ type: 'held', side: target.side, itemId, what: 'heal', hpAfter: target.mon.hp });
      break;
    }
    for (const { itemId, hook } of hooks(targetHooks, 'absorb')) {
      if (hook.type !== moveType || timesUsed(ctx, target.mon.uid, itemId) > 0) continue;
      markUsed(ctx, target.mon.uid, itemId);
      raiseStage(target, hook.stat, hook.stages, itemId, events);
    }
  }
  for (const { itemId, hook, copies } of hooks(userHooks, 'steal')) {
    const theirs = Object.keys(target.mon.held ?? {});
    if (theirs.length === 0 || !rng.chance(Math.min(1, (hook.percent * copies) / 100))) continue;
    const stolen = theirs[rng.int(0, theirs.length - 1)]!;
    eat(target.mon, stolen);
    user.mon.held = { ...user.mon.held, [stolen]: (user.mon.held?.[stolen] ?? 0) + 1 };
    events.push({ type: 'held', side: user.side, itemId, what: 'steal', stolen });
    break;
  }
  checkBerries(ctx, target, events);
  checkBerries(ctx, user, events);
}

function raiseStage(holder: Holder, stat: BoostStat, stages: number, itemId: string, events: HeldEvent[]): void {
  const before = holder.stages[stat];
  const after = clampStage(before + stages);
  if (after === before) return;
  holder.stages[stat] = after;
  events.push({ type: 'held', side: holder.side, itemId, what: 'stat', stat, change: after - before });
}

/** Whether a status (or confusion) is blocked for this battle by a status healer's after-effect. */
export function statusBlocked(_ctx: Pick<HeldContext, 'content'>, holder: Pick<Holder, 'mon'>, status: StatusId | 'confusion'): boolean {
  return (holder.mon.boosts ?? []).some((b) => b.kind === 'immune' && b.status === status);
}

/** Guard Spec.: the opponent can't lower this Pokémon's stats. */
export function statsGuarded(holder: Pick<Holder, 'mon'>): boolean {
  return (holder.mon.boosts ?? []).some((b) => b.kind === 'guard');
}

/** White Herb: undo lowered stats, once per battle. Call after the holder's stats fell. */
export function whiteHerb(ctx: HeldContext, holder: Holder, events: HeldEvent[]): void {
  if (holder.mon.hp <= 0 || !Object.values(holder.stages).some((v) => v < 0)) return;
  for (const { itemId } of hooks(hooksOf(ctx, holder.mon, holder.side), 'whiteHerb')) {
    if (timesUsed(ctx, holder.mon.uid, itemId) > 0) continue;
    markUsed(ctx, holder.mon.uid, itemId);
    for (const key of Object.keys(holder.stages) as BoostStat[]) if (holder.stages[key] < 0) holder.stages[key] = 0;
    events.push({ type: 'held', side: holder.side, itemId, what: 'herb' });
    return;
  }
}

/**
 * Berries that trigger on HP or status: healing berries, pinch stat berries,
 * Micle and Custap, status cures and Leppa. Call whenever HP or status changed.
 */
export function checkBerries(ctx: HeldContext, holder: Holder, events: HeldEvent[]): void {
  const { content, rng } = ctx;
  const mon = holder.mon;
  if (mon.hp <= 0) return;
  const all = hooksOf(ctx, mon, holder.side);
  const max = maxHpOf(content, mon);
  const below = (share: number) => mon.hp <= Math.floor(max * share);
  const state = stateOf(ctx.battle);

  for (const { itemId, hook } of hooks(all, 'berryHeal')) {
    if (!below(hook.below) || mon.hp >= max) continue;
    eat(mon, itemId);
    const amount = (hook.flat ?? max * (hook.fraction ?? 0)) * healingMultiplier(ctx, mon, holder.side);
    heal(content, mon, amount);
    events.push({ type: 'held', side: holder.side, itemId, what: 'heal', hpAfter: mon.hp });
    if (holder.side === 'player') {
      for (const [attribute, value] of Object.entries(hook.changes ?? {})) events.push({ type: 'held', side: holder.side, itemId, what: 'attribute', attribute, amount: value });
    }
    break;
  }
  for (const { itemId, hook } of hooks(all, 'berryStat')) {
    if (!below(hook.below)) continue;
    eat(mon, itemId);
    if (hook.stat === 'crit') {
      state.crit[mon.uid] = (state.crit[mon.uid] ?? 0) + hook.stages;
      events.push({ type: 'held', side: holder.side, itemId, what: 'stat', stat: 'crit', change: hook.stages });
    } else {
      const stat: BoostStat = hook.stat === 'random' ? rng.pick(['atk', 'def', 'spa', 'spd', 'spe'] as const) : hook.stat;
      raiseStage(holder, stat, hook.stages, itemId, events);
    }
  }
  for (const { itemId, hook } of hooks(all, 'berrySure')) {
    if (!below(hook.below) || state.sure.includes(mon.uid)) continue;
    eat(mon, itemId);
    state.sure.push(mon.uid);
    events.push({ type: 'held', side: holder.side, itemId, what: 'sure' });
  }
  for (const { itemId, hook } of hooks(all, 'berryFirst')) {
    if (!below(hook.below) || state.first.includes(mon.uid)) continue;
    eat(mon, itemId);
    state.first.push(mon.uid);
    events.push({ type: 'held', side: holder.side, itemId, what: 'first' });
  }
  for (const { itemId, hook } of hooks(all, 'berryCure')) {
    const status = mon.status?.id;
    const cures = (status !== undefined && hook.statuses.includes(status)) || (hook.confusion === true && holder.vol.confusion > 0);
    if (!cures) continue;
    eat(mon, itemId);
    if (status !== undefined && hook.statuses.includes(status)) mon.status = null;
    if (hook.confusion) holder.vol.confusion = 0;
    events.push({ type: 'held', side: holder.side, itemId, what: 'cure' });
    break;
  }
  for (const { itemId, hook } of hooks(all, 'berryPp')) {
    const slot = mon.moves.find((m) => m.pp === 0);
    if (!slot) continue;
    eat(mon, itemId);
    slot.pp = hook.amount;
    events.push({ type: 'held', side: holder.side, itemId, what: 'pp' });
    break;
  }
}

// ---------- turns, switching, knockouts ----------

/** When a Pokémon comes into battle: its X items and Dire Hit take effect. */
export function onSwitchIn(ctx: HeldContext, holder: Holder): void {
  for (const boost of holder.mon.boosts ?? []) {
    if (boost.kind !== 'stage') continue;
    if (boost.stat === 'crit') stateOf(ctx.battle).crit[holder.mon.uid] = (stateOf(ctx.battle).crit[holder.mon.uid] ?? 0) + boost.stages;
    else holder.stages[boost.stat] = clampStage(holder.stages[boost.stat] + boost.stages);
  }
}

/** Clears a Pokémon's per-battle held state when it leaves the field (Choice lock, Metronome streak). */
export function onSwitchOut(ctx: Pick<HeldContext, 'battle'>, mon: PokemonInstance): void {
  const state = ctx.battle.held;
  if (!state) return;
  delete state.choice[mon.uid];
  delete state.streak[mon.uid];
  delete state.crit[mon.uid];
}

/**
 * End of turn for one active Pokémon: Leftovers, Black Sludge, Sticky Barb,
 * Toxic and Flame Orbs, Dubious Disc, berries, then its battle boosts count down.
 */
export function endOfTurn(ctx: HeldContext, holder: Holder, events: HeldEvent[]): void {
  const { content, rng } = ctx;
  const mon = holder.mon;
  if (mon.hp <= 0) return;
  const all = hooksOf(ctx, mon, holder.side);
  const max = maxHpOf(content, mon);
  const types = getSpecies(content, mon.speciesId).types;
  for (const { itemId, hook, copies } of hooks(all, 'endTurn')) {
    const fraction = hook.typed && !types.includes(hook.typed) ? (hook.otherwise ?? 0) : hook.fraction * copies;
    if (fraction > 0 && mon.hp < max) {
      heal(content, mon, Math.max(1, max * fraction * healingMultiplier(ctx, mon, holder.side)));
      events.push({ type: 'held', side: holder.side, itemId, what: 'heal', hpAfter: mon.hp });
    } else if (fraction < 0) {
      mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(max * -fraction)));
      events.push({ type: 'held', side: holder.side, itemId, what: 'hurt', hpAfter: mon.hp });
    }
  }
  for (const { itemId, hook } of hooks(all, 'stickyBarb')) {
    if (mon.hp <= 0) break;
    mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(max * hook.fraction)));
    events.push({ type: 'held', side: holder.side, itemId, what: 'hurt', hpAfter: mon.hp });
  }
  if (mon.hp > 0 && holder.vol.turnsOut === 0) {
    for (const { itemId, hook } of hooks(all, 'selfStatus')) {
      if (mon.status || statusImmuneByType(hook.status, types)) continue;
      mon.status = { id: hook.status };
      events.push({ type: 'held', side: holder.side, itemId, what: 'orb' });
    }
  }
  for (const { itemId, hook } of hooks(all, 'randomStat')) {
    if (mon.hp > 0 && rng.chance(hook.percent / 100)) raiseStage(holder, rng.pick(['atk', 'def', 'spa', 'spd', 'spe'] as const), 1, itemId, events);
  }
  checkBerries(ctx, holder, events);
  countDownBoosts(ctx, holder, events);
}

function statusImmuneByType(status: StatusId, types: readonly TypeName[]): boolean {
  if (status === 'brn') return types.includes('fire');
  if (status === 'psn') return types.includes('poison') || types.includes('steel');
  return false;
}

function countDownBoosts(ctx: HeldContext, holder: Holder, events: HeldEvent[]): void {
  const left: BattleBoost[] = [];
  for (const boost of holder.mon.boosts ?? []) {
    if (boost.kind === 'immune') {
      left.push(boost);
      continue;
    }
    if (boost.turns > 1) {
      left.push({ ...boost, turns: boost.turns - 1 });
      continue;
    }
    if (boost.kind === 'stage') {
      if (boost.stat === 'crit') {
        const state = stateOf(ctx.battle);
        state.crit[holder.mon.uid] = Math.max(0, (state.crit[holder.mon.uid] ?? 0) - boost.stages);
      } else {
        holder.stages[boost.stat] = clampStage(holder.stages[boost.stat] - boost.stages);
      }
    }
    events.push({ type: 'held', side: holder.side, itemId: boost.kind === 'guard' ? 'guard-spec' : 'x-boost', what: 'boostEnd', stat: boost.kind === 'stage' ? boost.stat : undefined });
  }
  holder.mon.boosts = left;
}

/** After a battle: "next battle" immunities are used up. */
export function endBattle(mon: PokemonInstance): void {
  if (mon.boosts?.some((b) => b.kind === 'immune')) mon.boosts = mon.boosts.filter((b) => b.kind !== 'immune');
}

/** When the holder knocks out a foe: Reaper Cloth heals, Scarves give attributes. */
export function onKnockout(ctx: HeldContext, holder: Holder, events: HeldEvent[]): void {
  const { content } = ctx;
  if (holder.mon.hp <= 0) return;
  const all = hooksOf(ctx, holder.mon, holder.side);
  const types = getSpecies(content, holder.mon.speciesId).types;
  for (const { itemId, hook } of hooks(all, 'koHeal')) {
    if (hook.holderType && !types.includes(hook.holderType)) continue;
    heal(content, holder.mon, maxHpOf(content, holder.mon) * hook.fraction);
    events.push({ type: 'held', side: holder.side, itemId, what: 'heal', hpAfter: holder.mon.hp });
  }
  if (holder.side !== 'player') return;
  for (const { itemId, hook } of hooks(all, 'koAttribute')) {
    events.push({ type: 'held', side: holder.side, itemId, what: 'attribute', attribute: hook.attribute, amount: hook.amount });
  }
}

// ---------- outside battle ----------

/** Extra experience for the holder (Macho Brace). */
export function expMultiplier(content: Content, mon: PokemonInstance): number {
  return hooks(hooksOf({ content }, mon, 'enemy'), 'exp').reduce((m, h) => m * h.hook.multiplier, 1);
}

/** Extra friendship gains for the holder (Prism Scale). */
export function friendshipMultiplier(content: Content, mon: PokemonInstance): number {
  return hooks(hooksOf({ content }, mon, 'enemy'), 'friendship').reduce((m, h) => m * (1 + h.hook.percent / 100), 1);
}

/** Everstone: the holder doesn't evolve. */
export function blocksEvolution(content: Content, mon: PokemonInstance): boolean {
  return hooks(hooksOf({ content }, mon, 'enemy'), 'noEvolve').length > 0;
}

/**
 * Power items: after gaining levels, the holder grows a stat like a vitamin
 * once every `everyLevels` levels. Returns the stats that grew.
 */
export function growthOnLevelUp(content: Content, mon: PokemonInstance, oldLevel: number): string[] {
  const grown: string[] = [];
  for (const { hook } of hooks(hooksOf({ content }, mon, 'enemy'), 'growth')) {
    const steps = Math.floor(mon.level / hook.everyLevels) - Math.floor(oldLevel / hook.everyLevels);
    if (steps <= 0) continue;
    const percent = Math.round(content.balance.vitaminMultiplierPerStack * 100) * steps;
    mon.statBoosts = { ...mon.statBoosts, [hook.stat]: (mon.statBoosts?.[hook.stat] ?? 0) + percent };
    grown.push(hook.stat);
  }
  return grown;
}

// ---------- bosses ----------

/** Hooks that help a boss in battle; items with other hooks (EXP, growth, attributes, self-harm) are never given to bosses. */
const BOSS_HOOKS = new Set<HeldHook['hook']>([
  'typePower', 'gem', 'categoryPower', 'power', 'superPower', 'stat', 'crit', 'accuracy', 'evasion', 'endTurn', 'survive', 'sash',
  'contactDamage', 'contactStatus', 'flinch', 'airBalloon', 'drain', 'powerHerb', 'whiteHerb', 'damageTaken', 'berryHeal', 'berryCure',
  'berryStat', 'berryResist', 'berrySuper', 'berryRetaliate', 'choiceLock', 'koHeal',
]);

/**
 * Gives a boss team its held items (director, answer 3): Gym Leaders 1, Elite
 * Four 2, Champions 3, on the ace first (the last Pokémon), then the ones
 * before it. Rarer items become likelier each region. `rng` should be a
 * generator of its own (seeded from the run seed and the battle), so this
 * never changes any other roll.
 */
export function giveBossItems(content: Content, team: PokemonInstance[], role: 'gym' | 'elite' | 'champion', regionIndex: number, rng: Rng): void {
  const settings = content.balance.bossHeldItems;
  const count = Math.min(settings[role], team.length);
  for (let n = 0; n < count; n++) {
    const mon = team[team.length - 1 - n]!;
    const pool = [...content.catalog.values()].filter((entry) => {
      if (entry.status !== 'supported' || entry.effect?.kind !== 'held' || entry.stacksOn !== 'pokemon') return false;
      if (!entry.effect.hooks.every((h) => BOSS_HOOKS.has(h.hook))) return false;
      return entry.effect.hooks.every((h) => !('species' in h) || !h.species || speciesMatches(content, mon.speciesId, h.species));
    });
    if (pool.length === 0) return;
    const growth = 1 + settings.betterPerRegion * regionIndex;
    const weightOf = (rarity: string) => (settings.rarityWeights[rarity as keyof typeof settings.rarityWeights] ?? 0) * (rarity === 'rare' || rarity === 'epic' ? growth : 1);
    const entry = rng.weighted(pool.map((e) => ({ item: e, weight: weightOf(e.rarity) })));
    mon.held = { ...mon.held, [entry.id]: (mon.held?.[entry.id] ?? 0) + 1 };
  }
}
