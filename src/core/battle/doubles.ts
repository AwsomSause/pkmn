// Double battles: two Pokémon on each side.
//
// The engine (engine.ts) works on one Pokémon per side: battle.activeIndex /
// enemyIndex with their stages and volatile state. In a double battle the
// second Pokémon on each side waits in battle.doubles; before a step involves
// it, the two trade places ("focus") and a `focus` event tells the screen
// which Pokémon the following events are about. Each move runs through the
// normal engine (executeMove) with a hook that hits every Pokémon a spread
// move reaches, so every move, ability and item keeps working.
//
// Doubles-only rules live here: spread moves (0.75× when they hit more than
// one Pokémon), aiming, redirection (Follow Me, Rage Powder, Spotlight,
// Lightning Rod, Storm Drain), Helping Hand, Ally Switch, After You, Quash,
// Instruct, Wide Guard, Coaching, Aromatic Mist, Dragon Cheer, Hold Hands,
// and the ally abilities (Telepathy, Healer, Hospitality, Curious Medicine,
// Costar, Receiver, Power of Alchemy, Commander, Dancer, Symbiosis; the
// damage and status ones are in engine.ts). Uses only the battle stream.

import targetsJson from '../../data/moveTargets.json';
import type { BoostStat, Move } from '../contentSchema';
import { abilityOf, calcStats, getSpecies } from '../pokemon';
import { freshStages, freshVolatile, type BattleState, type DoublesState, type PokemonInstance, type Stages, type Volatile } from '../state';
import { firstStrikeBonus } from '../trainerEvolution';
import { compareTurnOrder } from './damage';
import { doublesSteps as S, forcedMoveId, hasUsableMove, type BattleContext, type BattleEvent, type Combatant, type PlayerAction, type Side, type SlotCommand } from './engine';
import * as Held from './held';
import { applyTransformations, battleMove, endDynamax, tickDynamax, zMoveFor, type TransformStepEvent } from './transform';

export type Spot = 0 | 1;
const SPOTS: readonly Spot[] = [0, 1];
const SIDES: readonly Side[] = ['player', 'enemy'];
const otherSide = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');

// ---------- who a move hits ----------

type TargetGroup = 'foes' | 'others' | 'ally' | 'userOrAlly' | 'userAndAllies' | 'random';
const MOVE_GROUP = new Map<string, TargetGroup>();
for (const [group, ids] of Object.entries(targetsJson as Record<TargetGroup, string[]>)) for (const id of ids) MOVE_GROUP.set(id, group as TargetGroup);

/** How a move picks its targets in a double battle (PokeAPI's move targets, see tools/build-move-targets.ts). */
export type TargetKind = TargetGroup | 'single' | 'self';
export function targetKind(move: Pick<Move, 'id' | 'target'>): TargetKind {
  return MOVE_GROUP.get(move.id) ?? (move.target === 'self' ? 'self' : 'single');
}

/** Single-target moves meant for a partner (the screen offers your ally as a target for these). */
export const ALLY_AIMED = new Set(['pollen-puff', 'heal-pulse', 'floral-healing', 'decorate', 'instruct', 'after-you', 'skill-swap', 'beat-up', 'acupressure', 'aromatic-mist', 'helping-hand', 'hold-hands', 'spotlight', 'quash']);

/** True when the player picks a target for this move (more than one Pokémon it could be aimed at). */
export function needsTarget(move: Pick<Move, 'id' | 'target'>): boolean {
  const kind = targetKind(move);
  return kind === 'single' || kind === 'userOrAlly';
}

const DANCES = new Set(['swords-dance', 'dragon-dance', 'quiver-dance', 'feather-dance', 'petal-dance', 'teeter-dance', 'lunar-dance', 'fiery-dance', 'revelation-dance', 'victory-dance', 'aqua-step', 'clangorous-soul']);
const NO_COPY = new Set(['trace', 'receiver', 'power-of-alchemy', 'wonder-guard', 'multitype', 'stance-change', 'schooling', 'comatose', 'shields-down', 'disguise', 'rks-system', 'battle-bond', 'power-construct', 'ice-face', 'gulp-missile', 'neutralizing-gas', 'hunger-switch', 'zen-mode', 'imposter', 'flower-gift', 'forecast', 'illusion', 'commander', 'zero-to-hero', 'protosynthesis', 'quark-drive', 'tera-shift']);

// ---------- spots and focus ----------

/** The spot (0 left, 1 right) of the Pokémon in the engine's main fields. */
export function primarySpot(d: DoublesState, side: Side): Spot {
  return d.swapped[side] ? 1 : 0;
}

interface SlotView {
  mon: PokemonInstance;
  stages: Stages;
  vol: Volatile;
  index: number;
}

function slotView(ctx: Pick<BattleContext, 'battle' | 'party'>, side: Side, spot: Spot): SlotView | null {
  const { battle } = ctx;
  const d = battle.doubles!;
  if (spot === primarySpot(d, side)) {
    return side === 'player'
      ? { mon: ctx.party[battle.activeIndex]!, stages: battle.playerStages, vol: battle.playerVolatile, index: battle.activeIndex }
      : { mon: battle.enemyTeam[battle.enemyIndex]!, stages: battle.enemyStages, vol: battle.enemyVolatile, index: battle.enemyIndex };
  }
  const o = d[side];
  if (o.index < 0) return null;
  const mon = (side === 'player' ? ctx.party : battle.enemyTeam)[o.index];
  return mon ? { mon, stages: o.stages, vol: o.vol, index: o.index } : null;
}

/** The Pokémon standing in a spot (fainted ones included until they are replaced), or null for an empty spot. */
export function monAt(ctx: Pick<BattleContext, 'battle' | 'party'>, side: Side, spot: Spot): PokemonInstance | null {
  return slotView(ctx, side, spot)?.mon ?? null;
}

/** The stat changes of the Pokémon in a spot. */
export function stagesAt(ctx: Pick<BattleContext, 'battle' | 'party'>, side: Side, spot: Spot): Stages | null {
  return slotView(ctx, side, spot)?.stages ?? null;
}

/** The party / team index in a spot, or -1. */
export function indexAt(ctx: Pick<BattleContext, 'battle' | 'party'>, side: Side, spot: Spot): number {
  return slotView(ctx, side, spot)?.index ?? -1;
}

/** The volatile state of the Pokémon in a spot (for menus: two-turn moves, choice locks). */
export function volAt(ctx: Pick<BattleContext, 'battle' | 'party'>, side: Side, spot: Spot): Volatile | null {
  return slotView(ctx, side, spot)?.vol ?? null;
}

function swapFields(battle: BattleState, side: Side): void {
  const d = battle.doubles!;
  const o = d[side];
  if (side === 'player') {
    [battle.activeIndex, o.index] = [o.index, battle.activeIndex];
    [battle.playerStages, o.stages] = [o.stages, battle.playerStages];
    [battle.playerVolatile, o.vol] = [o.vol, battle.playerVolatile];
  } else {
    [battle.enemyIndex, o.index] = [o.index, battle.enemyIndex];
    [battle.enemyStages, o.stages] = [o.stages, battle.enemyStages];
    [battle.enemyVolatile, o.vol] = [o.vol, battle.enemyVolatile];
  }
  d.swapped[side] = !d.swapped[side];
}

/** Makes the Pokémon in `spot` the one the engine works on (emits a `focus` event when that changes). */
function focus(ctx: BattleContext, side: Side, spot: Spot, events: BattleEvent[]): void {
  const d = ctx.battle.doubles!;
  if (primarySpot(d, side) === spot || d[side].index < 0) return;
  swapFields(ctx.battle, side);
  events.push({ type: 'focus', side, uid: slotView(ctx, side, spot)!.mon.uid });
}

/** Between turns the left spot is in the main fields, unless it is empty. */
function rest(ctx: BattleContext, events: BattleEvent[]): void {
  const d = ctx.battle.doubles!;
  for (const side of SIDES) {
    const left = slotView(ctx, side, 0);
    if (left) focus(ctx, side, 0, events);
    else focus(ctx, side, 1, events);
  }
}

/** The Combatants of one turn, by uid, so Protect and flinching last the whole turn. */
class Field {
  private byUid = new Map<string, Combatant>();
  constructor(private ctx: BattleContext) {}

  at(side: Side, spot: Spot): Combatant | null {
    const view = slotView(this.ctx, side, spot);
    if (!view) return null;
    let c = this.byUid.get(view.mon.uid);
    if (!c) {
      c = { side, mon: view.mon, stages: view.stages, vol: view.vol, flinched: false, protected: false };
      this.byUid.set(view.mon.uid, c);
    }
    c.mon = view.mon;
    c.stages = view.stages;
    c.vol = view.vol;
    return c;
  }

  /** The Pokémon in battle that haven't fainted. */
  alive(side?: Side): Combatant[] {
    const out: Combatant[] = [];
    for (const s of side ? [side] : SIDES) for (const spot of SPOTS) {
      const c = this.at(s, spot);
      if (c && c.mon.hp > 0) out.push(c);
    }
    return out;
  }

  spotOf(c: Combatant): Spot | null {
    for (const spot of SPOTS) if (slotView(this.ctx, c.side, spot)?.mon.uid === c.mon.uid) return spot;
    return null;
  }

  ally(c: Combatant): Combatant | null {
    const spot = this.spotOf(c);
    if (spot === null) return null;
    const a = this.at(c.side, spot === 0 ? 1 : 0);
    return a && a.mon.hp > 0 ? a : null;
  }

  /** Focuses on `c` (and keeps the other side as it is). Returns false if it is no longer in battle. */
  on(c: Combatant, events: BattleEvent[]): boolean {
    const spot = this.spotOf(c);
    if (spot === null) return false;
    focus(this.ctx, c.side, spot, events);
    this.at(c.side, spot);
    return true;
  }
}

// ---------- setting up ----------

/** Turns a new battle into a double battle: the next healthy Pokémon on each side takes the right-hand spot. */
export function makeDoubles(battle: BattleState, party: PokemonInstance[]): void {
  const ally = party.findIndex((m, i) => i !== battle.activeIndex && m.hp > 0);
  const foe = battle.enemyTeam.findIndex((m, i) => i !== battle.enemyIndex && m.hp > 0);
  battle.doubles = {
    player: { index: ally, stages: freshStages(), vol: freshVolatile() },
    enemy: { index: foe, stages: freshStages(), vol: freshVolatile() },
    swapped: { player: false, enemy: false },
    refill: [],
    commanding: [],
    aims: {},
  };
  if (ally >= 0) battle.participants.push(party[ally]!.uid);
}

/** True when this run's battle can be a double battle (two Pokémon able to fight on each side). */
export function canBeDoubles(party: PokemonInstance[], enemyTeam: PokemonInstance[]): boolean {
  return party.filter((m) => m.hp > 0).length >= 2 && enemyTeam.filter((m) => m.hp > 0).length >= 2;
}

/** The uids on the field, left then right, for each side (the screen's layout). */
export function fieldUids(ctx: Pick<BattleContext, 'battle' | 'party'>): Record<Side, (string | null)[]> {
  return {
    player: SPOTS.map((s) => monAt(ctx, 'player', s)?.uid ?? null),
    enemy: SPOTS.map((s) => monAt(ctx, 'enemy', s)?.uid ?? null),
  };
}

/** Why the Pokémon at `partyIndex` can't be sent out in a double battle, or null. */
export function doublesSwitchProblem(ctx: Pick<BattleContext, 'battle' | 'party'>, partyIndex: number, taken: number[] = []): string | null {
  const mon = ctx.party[partyIndex];
  if (!mon) return 'There is no Pokémon there';
  if (mon.hp <= 0) return `${mon.uid} has fainted`;
  if (SPOTS.some((s) => indexAt(ctx, 'player', s) === partyIndex)) return 'That Pokémon is already in battle';
  if (taken.includes(partyIndex)) return 'That Pokémon is already being sent out';
  return null;
}

/** Battle start: the entry abilities of all four Pokémon, fastest first. Uses no random numbers. */
export function startDoubles(ctx: BattleContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const { battle } = ctx;
  if ((battle.pendingEntry ?? []).length === 0) return events;
  battle.pendingEntry = [];
  const field = new Field(ctx);
  for (const c of field.alive()) S.enterField(ctx, c);
  runEntries(ctx, field, field.alive(), events);
  settle(ctx, field, events);
  rest(ctx, events);
  S.totemAura(ctx, events);
  return events;
}

/** A Totem on the field: its behaviour phases and its territory's status, once per turn (same rules as one-on-one). */
function totemEndOfTurn(ctx: BattleContext, field: Field, events: BattleEvent[]): void {
  const t = ctx.battle.totem;
  if (!t) return;
  const totem = field.alive('enemy').find((c) => c.mon.uid === t.uid);
  if (!totem) return;
  S.totemPhases(ctx, totem, events);
  S.totemFieldEffect(ctx, totem, field.alive('player'), events);
}

// ---------- the turn ----------

interface Planned {
  user: Combatant;
  move: Move;
  slot: number;
  target?: { side: Side; spot: Spot };
  priority: number;
  speed: number;
  tie: number;
}

interface TurnState {
  center: Partial<Record<Side, { uid: string; powder: boolean }>>;
  wideGuard: Partial<Record<Side, boolean>>;
  acted: Set<string>;
  queue: Planned[];
  lastTarget: Map<string, { side: Side; spot: Spot } | undefined>;
}

/**
 * One turn of a double battle. `action` is `{ kind: 'double', commands }` (one command per
 * player spot, left then right) or, while a spot waits for a replacement, `{ kind: 'switch' }`.
 */
export function resolveDoublesTurn(ctx: BattleContext, action: PlayerAction): BattleEvent[] {
  const { battle, content, rng } = ctx;
  if (battle.outcome) throw new Error('Battle is already over');
  const d = battle.doubles;
  if (!d) throw new Error('Not a double battle');
  normalise(battle);
  const events: BattleEvent[] = [];
  const field = new Field(ctx);

  if (battle.needsSwitch) {
    if (action.kind !== 'switch') throw new Error('Choose a Pokémon to send out');
    const spot = (d.refill[0] ?? 0) as Spot;
    const problem = doublesSwitchProblem(ctx, action.partyIndex);
    if (problem) throw new Error(problem);
    sendOut(ctx, field, 'player', spot, action.partyIndex, events);
    if (battle.batonStages) {
      battle.playerStages = battle.batonStages;
      battle.batonStages = null;
    }
    d.refill.shift();
    battle.needsSwitch = d.refill.length > 0;
    if (!battle.needsSwitch) {
      const entering = events.filter((e) => e.type === 'switchIn').map((e) => field.alive().find((c) => c.mon.uid === (e as { uid: string }).uid)).filter((c): c is Combatant => Boolean(c));
      runEntries(ctx, field, entering, events);
      settle(ctx, field, events);
      rest(ctx, events);
    }
    return events;
  }

  if (action.kind === 'deal') return S.dealTurn(ctx, action.accept, events);
  if (action.kind !== 'double') throw new Error('A double battle needs a command for each Pokémon');
  ctx.doubleKoLoser = undefined;
  ctx.hyperUsed = false;
  ctx.enemyHyperUsed = false;
  const turn: TurnState = { center: {}, wideGuard: {}, acted: new Set(), queue: [], lastTarget: new Map() };
  ctx.doublesTurn = { spread: false, helped: [] };
  for (const c of field.alive()) S.enterField(ctx, c);
  for (const c of field.alive()) {
    c.vol.tookPhysical = 0;
    c.vol.tookSpecial = 0;
    c.vol.endure = false;
    c.vol.plannedAttack = false;
    c.vol.loweredThisTurn = false;
    c.vol.plannedMove = null;
  }

  // The player's commands, checked one spot at a time.
  const commands: (SlotCommand | null)[] = [];
  const switching: number[] = [];
  for (const spot of SPOTS) {
    const c = field.at('player', spot);
    if (!c || c.mon.hp <= 0 || d.refill.includes(spot) || d.commanding.includes(c.mon.uid)) {
      commands.push(null);
      continue;
    }
    focus(ctx, 'player', spot, events);
    let cmd = action.commands[spot] ?? null;
    const forced = forcedMoveId(c.vol);
    const forcedIndex = forced ? c.mon.moves.findIndex((m) => m.id === forced) : -1;
    if (forced && forcedIndex >= 0) cmd = { action: { kind: 'move', index: forcedIndex }, target: d.aims[c.mon.uid] ?? cmd?.target };
    else {
      if (forced) c.vol.locked = null;
      if (!cmd) throw new Error(`Choose what ${getSpecies(content, c.mon.speciesId).name} will do`);
      if (cmd.action.kind === 'switch') {
        const problem = doublesSwitchProblem(ctx, cmd.action.partyIndex, switching);
        if (problem) throw new Error(problem);
        if (c.vol.trapped || c.vol.bound > 0) throw new Error(`${getSpecies(content, c.mon.speciesId).name} can't be switched out!`);
        switching.push(cmd.action.partyIndex);
      } else if (cmd.action.kind === 'arena') {
        const problem = S.arenaProblem(ctx);
        if (problem) throw new Error(problem);
        if (commands.some((o) => o?.action.kind === 'arena')) throw new Error('Only one Pokémon can smash the arena');
      } else S.validateAction(ctx, cmd.action);
    }
    commands.push(cmd);
  }
  // Events so far are only focus changes for checking; drop them (the screen hasn't moved yet).
  events.length = 0;
  rest(ctx, events);
  events.length = 0;

  // Ideas W1: mind-read, grudges and a spectator's buff, once each.
  S.w1DoublesStart(ctx, field.alive('player'), field.alive('enemy'), events, (c) => field.on(c, events));

  // 1. Switches and items go before any move.
  for (const spot of SPOTS) {
    const cmd = commands[spot];
    const c = field.at('player', spot);
    if (!cmd || !c) continue;
    if (cmd.action.kind === 'switch') {
      field.on(c, events);
      events.push({ type: 'switchOut', side: 'player', uid: c.mon.uid });
      endDynamax(content, battle, 'player', c.mon, events as TransformStepEvent[]);
      S.switchOutAbility(ctx, c.mon);
      sendOut(ctx, field, 'player', spot, cmd.action.partyIndex, events);
      const fresh = field.at('player', spot)!;
      runEntries(ctx, field, [fresh], events);
      turn.acted.add(fresh.mon.uid);
    } else if (cmd.action.kind === 'item') {
      field.on(c, events);
      battle.skill = cmd.action.throwSkill;
      S.useItemInBattle(ctx, cmd.action.itemId, cmd.action.targetIndex, events);
      battle.skill = undefined;
      turn.acted.add(c.mon.uid);
    } else if (cmd.action.kind === 'arena') {
      field.on(c, events);
      S.smashArenaOn(ctx, c.mon, field.alive('enemy'), events, (f) => field.on(f, events));
      faintCheck(ctx, field, events);
      turn.acted.add(c.mon.uid);
    } else if (cmd.action.kind === 'idle') turn.acted.add(c.mon.uid);
  }

  // 2. Transformations (Mega Evolution, Tera, Dynamax) before any move, so they count for turn order.
  for (const spot of SPOTS) {
    const cmd = commands[spot];
    const c = field.at('player', spot);
    if (!cmd || !c || c.mon.hp <= 0 || cmd.action.kind !== 'move') continue;
    field.on(c, events);
    const foe = field.alive('enemy')[0];
    if (foe) field.on(foe, events);
    applyTransformations(ctx, cmd.action.transform, events as TransformStepEvent[], cmd.action.index);
  }

  // 3. What each Pokémon will do, then the order.
  const trickSign = battle.field.trickRoom > 0 ? -1 : 1;
  const plan = (user: Combatant, move: Move, slot: number, target: { side: Side; spot: Spot } | undefined): Planned => {
    field.on(user, events);
    const quickDraw = S.abilityIn(ctx, user) === 'quick-draw' && move.category !== 'status' && rng.chance(0.3) ? 0.2 : 0;
    const priority = S.priorityOf(ctx, user, move) + quickDraw + Held.orderBracket(ctx, user) / 10 + (user.side === 'player' ? firstStrikeBonus(ctx.perks, battle) : 0);
    user.vol.plannedAttack = move.category !== 'status';
    user.vol.plannedMove = move.id;
    user.vol.beakHeat = Boolean(move.effects.beakBlast);
    return { user, move, slot, target, priority, speed: S.speedOf(ctx, user) * trickSign, tie: rng.float() };
  };
  for (const spot of SPOTS) {
    const cmd = commands[spot];
    const c = field.at('player', spot);
    if (!cmd || !c || c.mon.hp <= 0 || cmd.action.kind !== 'move') continue;
    field.on(c, events);
    const index = cmd.action.index;
    const chosen = S.resolveMove(content, c.mon, index);
    const move = battleMove(content, battle, c.mon, cmd.action.transform?.kind === 'zmove' ? (zMoveFor(content, chosen) ?? chosen) : chosen);
    turn.queue.push(plan(c, move, index, cmd.target));
  }
  for (const foe of field.alive('enemy')) {
    if (battle.doubles!.commanding?.includes(foe.mon.uid)) continue;
    const choice = enemyChoice(ctx, field, foe, events);
    if (!choice) continue;
    turn.queue.push(plan(foe, choice.move, choice.slot, choice.target));
  }
  for (const c of field.alive('player')) if (battle.doubles!.commanding?.includes(c.mon.uid)) turn.queue = turn.queue.filter((p) => p.user !== c);
  turn.queue.sort((a, b) => {
    const r = compareTurnOrder({ priority: a.priority, speed: a.speed }, { priority: b.priority, speed: b.speed });
    return r === 'a' ? -1 : r === 'b' ? 1 : a.tie - b.tie;
  });

  // Ideas W1 combo: two allies using damaging moves of the same type fire a joint attack; the second one hits harder.
  battle.comboUid = undefined;
  const mine = turn.queue.filter((p) => p.user.side === 'player' && p.move.category !== 'status' && p.move.power !== null);
  if (mine.length === 2 && mine[0]!.move.type === mine[1]!.move.type) {
    battle.comboUid = mine[1]!.user.mon.uid;
    events.push({ type: 'spectacle', kind: 'combo', side: 'player', text: `${getSpecies(content, mine[0]!.user.mon.speciesId).name} and ${getSpecies(content, mine[1]!.user.mon.speciesId).name} line up a ${mine[0]!.move.type}-type combo attack!` });
  }

  // 4. Moves.
  const skills = new Map<string, NonNullable<BattleState['skill']>>();
  commands.forEach((cmd, spot) => {
    const c = field.at('player', spot as Spot);
    if (c && cmd?.action.kind === 'move' && cmd.action.skill) skills.set(c.mon.uid, cmd.action.skill);
  });
  while (turn.queue.length > 0 && !battle.outcome) {
    const next = turn.queue.shift()!;
    if (next.user.mon.hp <= 0 || field.spotOf(next.user) === null) continue;
    // Ideas W1: each Pokémon's own prompt grade counts for its own move.
    battle.skill = next.user.side === 'player' ? skills.get(next.user.mon.uid) : undefined;
    if (battle.skill?.kind === 'shout' && battle.skill.grade !== 'miss') events.push({ type: 'spectacle', kind: 'shout', side: 'player', uid: next.user.mon.uid, text: `${getSpecies(content, next.user.mon.speciesId).name} yells out! The trainer echoes it!` });
    runPlanned(ctx, field, turn, next, events);
    turn.acted.add(next.user.mon.uid);
    faintCheck(ctx, field, events);
    if (sideOut(field, 'player') || sideOut(field, 'enemy')) break;
  }

  battle.comboUid = undefined;
  battle.skill = undefined;

  // 5. End of turn.
  if (!sideOut(field, 'player') && !sideOut(field, 'enemy')) {
    // Ideas W1 arena hazard: everyone on the field takes the hit every few turns.
    S.doublesArena(ctx, field.alive(), events, (c) => field.on(c, events));
    faintCheck(ctx, field, events);
  }
  if (!sideOut(field, 'player') && !sideOut(field, 'enemy')) {
    endOfTurn(ctx, field, commands, events);
    totemEndOfTurn(ctx, field, events);
  }

  // 6. Faints, replacements, the outcome.
  ctx.doublesTurn = undefined;
  settle(ctx, field, events);
  battle.turn += 1;
  rest(ctx, events);
  return events;
}

/** Older saves and fresh battles: fill in the fields resolveTurn would. */
function normalise(battle: BattleState): void {
  battle.playerVolatile ??= freshVolatile();
  battle.enemyVolatile ??= freshVolatile();
  battle.weather ??= null;
  battle.terrain ??= null;
  battle.pendingEntry ??= [];
  battle.doubles!.commanding ??= [];
  battle.doubles!.aims ??= {};
}

/** Sends `partyIndex` (or a team index for the foe) into a spot. */
function sendOut(ctx: BattleContext, field: Field, side: Side, spot: Spot, index: number, events: BattleEvent[]): void {
  const { battle } = ctx;
  const d = battle.doubles!;
  const view = slotView(ctx, side, spot);
  if (!view) {
    // An empty spot: the engine's main fields need someone, so the new Pokémon goes there first.
    d[side].index = index;
    d[side].stages = freshStages();
    d[side].vol = freshVolatile();
    focus(ctx, side, spot, events);
    if (side === 'player') {
      const mon = ctx.party[index]!;
      if (!battle.participants.includes(mon.uid)) battle.participants.push(mon.uid);
      events.push({ type: 'switchIn', side, uid: mon.uid, speciesId: mon.speciesId, level: mon.level });
    } else {
      const mon = battle.enemyTeam[index]!;
      events.push({ type: 'switchIn', side, uid: mon.uid, speciesId: mon.speciesId, level: mon.level });
    }
  } else {
    focus(ctx, side, spot, events);
    if (side === 'player') S.switchIn(ctx, index, events);
    else {
      battle.enemyIndex = index;
      battle.enemyStages = freshStages();
      battle.enemyVolatile = freshVolatile();
      const mon = battle.enemyTeam[index]!;
      events.push({ type: 'switchIn', side, uid: mon.uid, speciesId: mon.speciesId, level: mon.level });
    }
  }
  battle.pendingEntry = [];
  d.commanding = (d.commanding ?? []).filter((uid) => field.alive().some((c) => c.mon.uid === uid));
  const fresh = field.at(side, spot)!;
  fresh.flinched = false;
  fresh.protected = false;
  S.enterField(ctx, fresh);
}

/** Entry hazards and abilities for Pokémon that just came in, the fastest first. */
function runEntries(ctx: BattleContext, field: Field, entering: Combatant[], events: BattleEvent[]): void {
  const order = [...entering].sort((a, b) => S.speedOf(ctx, b) - S.speedOf(ctx, a));
  for (const c of order) if (field.on(c, events)) S.enterExtras(ctx, c, events);
  for (const c of order) if (field.on(c, events)) S.applyHazards(ctx, c, events);
  faintCheck(ctx, field, events);
  for (const c of order) {
    if (c.mon.hp <= 0 || !field.on(c, events)) continue;
    const foes = field.alive(otherSide(c.side));
    if (foes.length === 0) continue;
    field.on(foes[0]!, events);
    S.entryAbility(ctx, c, foes[0]!, events);
    // Intimidate (and the like) reach both foes.
    const ability = S.abilityIn(ctx, c);
    if (foes[1] && (ability === 'intimidate' || ability === 'supersweet-syrup')) {
      field.on(foes[1], events);
      const mark = events.length;
      S.entryAbility(ctx, c, foes[1], events);
      const dup = events.findIndex((e, i) => i >= mark && e.type === 'ability' && e.side === c.side && e.ability === ability);
      if (dup >= 0) events.splice(dup, 1);
    }
    allyEntry(ctx, field, c, events);
  }
}

/** Hospitality, Curious Medicine, Costar and Commander: entry abilities that act on the partner. */
function allyEntry(ctx: BattleContext, field: Field, c: Combatant, events: BattleEvent[]): void {
  const ally = field.ally(c);
  if (!ally) return;
  const ability = S.abilityIn(ctx, c);
  const d = ctx.battle.doubles!;
  if (ability === 'hospitality') {
    field.on(c, events);
    S.announce(c, ability, events);
    field.on(ally, events);
    const max = calcStats(ctx.content, ally.mon).hp;
    if (ally.mon.hp < max) S.healMon(ctx, ally, 0.25, events);
  } else if (ability === 'curious-medicine') {
    field.on(c, events);
    S.announce(c, ability, events);
    field.on(ally, events);
    ally.stages = Object.assign(ally.stages, freshStages());
    events.push({ type: 'statsReset', side: ally.side });
  } else if (ability === 'costar') {
    field.on(c, events);
    S.announce(c, ability, events);
    Object.assign(c.stages, ally.stages);
    c.vol.focusEnergy = ally.vol.focusEnergy;
  } else if (ability === 'commander' && c.mon.speciesId.startsWith('tatsugiri') && ally.mon.speciesId.startsWith('dondozo') && !d.commanding!.includes(c.mon.uid)) {
    field.on(c, events);
    S.announce(c, ability, events);
    d.commanding!.push(c.mon.uid);
    events.push({ type: 'selfState', side: c.side, state: 'commanding' });
    field.on(ally, events);
    for (const stat of ['atk', 'def', 'spa', 'spd', 'spe'] as const) S.applyStageChange(ctx, ally, stat, 2, events);
  }
}

// ---------- the enemy's choices ----------

/** The foe's move and target: the best one it sees (often, for clever trainers), aimed where it hurts most. */
function enemyChoice(ctx: BattleContext, field: Field, foe: Combatant, events: BattleEvent[]): { move: Move; slot: number; target?: { side: Side; spot: Spot } } | null {
  const { battle, content, rng } = ctx;
  field.on(foe, events);
  const forced = forcedMoveId(foe.vol);
  const locked = forced ?? S.choiceLock(battle, foe.mon);
  const lockedIndex = locked ? foe.mon.moves.findIndex((m) => m.id === locked) : -1;
  if (forced && lockedIndex < 0) foe.vol.locked = null;
  const players = field.alive('player');
  if (players.length === 0) return null;
  const ally = field.ally(foe);
  // How much a move is worth against each Pokémon it would hit.
  const worth = (move: Move): { score: number; target?: { side: Side; spot: Spot } } => {
    const kind = targetKind(move);
    const value = (target: Combatant) => S.moveValue({ content, ai: 1, target: target.mon, stages: foe.stages }, foe.mon, move.id);
    if (kind === 'foes' || kind === 'others') {
      let score = players.reduce((sum, p) => sum + value(p), 0) * (players.length > 1 ? 0.75 : 1);
      // Spread moves that also hit the partner cost it what they'd do to the partner (unless Telepathy).
      if (kind === 'others' && ally && S.abilityIn(ctx, ally) !== 'telepathy') score -= value(ally) * 0.75;
      return { score };
    }
    if (move.id === 'helping-hand') {
      if (!ally) return { score: 0 };
      const best = Math.max(0, ...ally.mon.moves.filter((m) => m.pp > 0).map((m) => S.moveValue({ content, ai: 1, target: players[0]!.mon, stages: ally.stages }, ally.mon, m.id)));
      return { score: best * 0.5 };
    }
    if (move.id === 'follow-me' || move.id === 'rage-powder') return { score: ally && ally.mon.hp / calcStats(content, ally.mon).hp < 0.4 ? value(players[0]!) * 0.6 : 0 };
    if (ALLY_AIMED.has(move.id) && ally && (move.effects.healTarget || move.id === 'pollen-puff')) {
      const hurt = 1 - ally.mon.hp / calcStats(content, ally.mon).hp;
      return { score: hurt > 0.5 ? value(players[0]!) * hurt : 0, target: { side: foe.side, spot: field.spotOf(ally)! } };
    }
    if (kind !== 'single' && kind !== 'random') return { score: value(players[0]!) };
    // A single target: the one it hurts most.
    const best = players.reduce((b, p) => (value(p) > value(b) ? p : b));
    return { score: value(best), target: { side: 'player', spot: field.spotOf(best)! } };
  };
  const usable = foe.mon.moves.map((m, i) => ({ m, i })).filter((x) => x.m.pp > 0);
  let slot: number;
  if (lockedIndex >= 0) slot = lockedIndex;
  else if (usable.length === 0) slot = -1;
  else if (battle.ai > 0 && rng.chance(battle.ai)) {
    const scored = usable.map((x) => ({ i: x.i, score: worth(S.resolveMove(content, foe.mon, x.i)).score }));
    slot = scored.reduce((b, x) => (x.score > b.score ? x : b)).i;
  } else slot = rng.pick(usable).i;
  const move = battleMove(content, battle, foe.mon, S.resolveMove(content, foe.mon, slot));
  return { move, slot, target: worth(move).target };
}

// ---------- running a move ----------

function runPlanned(ctx: BattleContext, field: Field, turn: TurnState, p: Planned, events: BattleEvent[]): void {
  const { user, move } = p;
  const targets = aim(ctx, field, turn, user, move, p.target);
  const first = targets[0] ?? field.alive(otherSide(user.side))[0] ?? user;
  turn.lastTarget.set(user.mon.uid, p.target);
  if (p.target) ctx.battle.doubles!.aims[user.mon.uid] = p.target;
  else delete ctx.battle.doubles!.aims[user.mon.uid];
  field.on(user, events);
  if (first !== user) field.on(first, events);
  const heldBefore = snapshotHeld(ctx, field);
  const doubles = ctx.doublesTurn!;
  doubles.hit = (u, _t, m, movedFirst, evts) => hitAll(ctx, field, turn, u, targets, m, movedFirst, evts);
  const mark = events.length;
  // Rage (Hyper moments): an enemy that was hurt too much unleashes it; a player move can counter the foe it hits.
  const rageFoe = user.side === 'enemy' ? user : (targets.find((t) => t.side === 'enemy') ?? field.alive('enemy')[0] ?? first);
  S.actWithRage(ctx, user, rageFoe, events, () => S.executeMove(ctx, user, first, move, p.slot, !turn.acted.has(first.mon.uid), events));
  doubles.hit = undefined;
  doubles.spread = false;
  // Dancer: other dancers copy a dance move that worked.
  const used = events.slice(mark).some((e) => e.type === 'move' && e.side === user.side && e.moveId === move.id);
  if (used && DANCES.has(move.id)) dancers(ctx, field, turn, user, move, events);
  symbiosis(ctx, field, heldBefore, events);
  field.on(user, events);
}

/** The Pokémon a move will hit, in order. */
function aim(ctx: BattleContext, field: Field, turn: TurnState, user: Combatant, move: Move, chosen?: { side: Side; spot: Spot }): Combatant[] {
  const kind = targetKind(move);
  const foes = field.alive(otherSide(user.side)).filter((c) => !ctx.battle.doubles!.commanding!.includes(c.mon.uid));
  const ally = field.ally(user);
  switch (kind) {
    case 'self':
      return [];
    case 'foes':
      return foes;
    case 'others':
      return [...foes, ...(ally ? [ally] : [])];
    case 'ally':
      return ally ? [ally] : [];
    case 'userAndAllies':
      return [user, ...(ally ? [ally] : [])];
    case 'userOrAlly':
      return chosen && chosen.side === user.side && ally && field.spotOf(ally) === chosen.spot ? [ally] : [user];
    case 'random':
      return foes.length ? [foes.length > 1 ? ctx.rng.pick(foes) : foes[0]!] : [];
    case 'single': {
      let target: Combatant | null = chosen ? field.at(chosen.side, chosen.spot) : null;
      if (target && (target.mon.hp <= 0 || target === user)) target = null;
      if (!target) {
        if (chosen?.side === user.side && ALLY_AIMED.has(move.id)) return ally ? [ally] : [];
        target = foes.find((f) => chosen && f.side === chosen.side && field.spotOf(f) === chosen.spot) ?? foes[0] ?? null;
      }
      if (target && ctx.battle.doubles!.commanding!.includes(target.mon.uid)) target = field.ally(target) ?? null;
      if (!target) return [];
      return [redirect(ctx, field, turn, user, move, target)];
    }
  }
}

/** Follow Me, Rage Powder and Spotlight, then Lightning Rod and Storm Drain, pull single-target moves aimed at a foe. */
function redirect(ctx: BattleContext, field: Field, turn: TurnState, user: Combatant, move: Move, target: Combatant): Combatant {
  if (target.side === user.side) return target;
  const own = S.abilityIn(ctx, user);
  if (own === 'stalwart' || own === 'propeller-tail' || move.id === 'snipe-shot') return target;
  const center = turn.center[target.side];
  if (center && center.uid !== target.mon.uid) {
    const c = field.alive(target.side).find((x) => x.mon.uid === center.uid);
    const powderProof = getSpecies(ctx.content, user.mon.speciesId).types.includes('grass') || own === 'overcoat';
    if (c && !(center.powder && powderProof)) return c;
  }
  const rod = move.type === 'electric' ? 'lightning-rod' : move.type === 'water' ? 'storm-drain' : null;
  if (rod && S.targetAbility(ctx, user, target) !== rod) {
    const other = field.ally(target);
    if (other && S.targetAbility(ctx, user, other) === rod) return other;
  }
  return target;
}

/** executeMove's hook: the move hits each target in turn (spread moves at 0.75×). */
function hitAll(ctx: BattleContext, field: Field, turn: TurnState, user: Combatant, targets: Combatant[], move: Move, movedFirst: boolean, events: BattleEvent[]): void {
  const doubles = ctx.doublesTurn!;
  if (DOUBLES_MOVES[move.id]) {
    const target = targets[0] ?? null;
    if (target) field.on(target, events);
    field.on(user, events);
    if (!DOUBLES_MOVES[move.id]!(ctx, field, turn, user, target, events)) events.push({ type: 'fail', side: user.side });
    return;
  }
  const kind = targetKind(move);
  // Moves with no target, and moves that only touch the user, run once as usual.
  if (targets.length === 0 || kind === 'self') {
    const foe = field.alive(otherSide(user.side))[0];
    if (foe) field.on(foe, events);
    field.on(user, events);
    S.runMove(ctx, user, foe ?? user, move, movedFirst, events);
    return;
  }
  if (kind === 'userAndAllies') {
    const foe = field.alive(otherSide(user.side))[0] ?? user;
    for (const t of targets) {
      // The partner gets the same boost or healing, as if it had used the move itself.
      if (t !== user && move.effects.cure === 'party') continue;
      if (foe !== user) field.on(foe, events);
      field.on(t, events);
      S.runMove(ctx, t, foe, move, movedFirst, events);
    }
    field.on(user, events);
    return;
  }
  doubles.spread = targets.length > 1 && move.category !== 'status';
  for (const t of targets) {
    if (t.mon.hp <= 0 || field.spotOf(t) === null) continue;
    field.on(t, events);
    field.on(user, events);
    if (t.side === user.side) field.on(t, events);
    if (targets.length > 1 && turn.wideGuard[t.side]) {
      events.push({ type: 'protected', side: t.side });
      continue;
    }
    if (t.side === user.side && move.category !== 'status' && S.abilityIn(ctx, t) === 'telepathy') {
      S.announce(t, 'telepathy', events);
      events.push({ type: 'noEffect', side: t.side });
      continue;
    }
    S.runMove(ctx, user, t, move, movedFirst && !turn.acted.has(t.mon.uid), events);
    if (user.mon.hp <= 0 && !move.effects.selfFaint) break;
  }
  doubles.spread = false;
  field.on(user, events);
}

type DoublesMove = (ctx: BattleContext, field: Field, turn: TurnState, user: Combatant, target: Combatant | null, events: BattleEvent[]) => boolean;

const boostAlly = (stats: [BoostStat, number][]): DoublesMove => (ctx, field, _turn, user, target, events) => {
  const ally = target && target !== user ? target : field.ally(user);
  if (!ally) return false;
  field.on(ally, events);
  let any = false;
  for (const [stat, n] of stats) any = S.applyStageChange(ctx, ally, stat, n, events) || any;
  field.on(user, events);
  return any;
};

/** Moves that only do something with a partner on the field (they fail in singles). */
const DOUBLES_MOVES: Record<string, DoublesMove> = {
  'helping-hand': (ctx, field, turn, user, target, events) => {
    const ally = target && target.side === user.side && target !== user ? target : field.ally(user);
    if (!ally || turn.acted.has(ally.mon.uid)) return false;
    ctx.doublesTurn!.helped.push(ally.mon.uid);
    field.on(user, events);
    events.push({ type: 'selfState', side: user.side, state: 'helpingHand' });
    return true;
  },
  'follow-me': (_ctx, _field, turn, user, _target, events) => {
    turn.center[user.side] = { uid: user.mon.uid, powder: false };
    events.push({ type: 'selfState', side: user.side, state: 'centerOfAttention' });
    return true;
  },
  'rage-powder': (_ctx, _field, turn, user, _target, events) => {
    turn.center[user.side] = { uid: user.mon.uid, powder: true };
    events.push({ type: 'selfState', side: user.side, state: 'centerOfAttention' });
    return true;
  },
  spotlight: (_ctx, field, turn, _user, target, events) => {
    if (!target) return false;
    turn.center[target.side] = { uid: target.mon.uid, powder: false };
    field.on(target, events);
    events.push({ type: 'selfState', side: target.side, state: 'centerOfAttention' });
    return true;
  },
  'wide-guard': (_ctx, _field, turn, user, _target, events) => {
    turn.wideGuard[user.side] = true;
    events.push({ type: 'selfState', side: user.side, state: 'wideGuard' });
    return true;
  },
  'ally-switch': (ctx, field, _turn, user, _target, events) => {
    const spot = field.spotOf(user);
    const d = ctx.battle.doubles!;
    const other = spot === null ? null : slotView(ctx, user.side, spot === 0 ? 1 : 0);
    if (spot === null || !other || other.mon.hp <= 0) return false;
    // The main fields keep the same Pokémon; it now stands in the other spot.
    d.swapped[user.side] = !d.swapped[user.side];
    events.push({ type: 'allySwitch', side: user.side });
    return true;
  },
  'after-you': (_ctx, field, turn, _user, target, events) => {
    if (!target || turn.acted.has(target.mon.uid)) return false;
    const at = turn.queue.findIndex((p) => p.user === target);
    if (at < 0) return false;
    const [entry] = turn.queue.splice(at, 1);
    turn.queue.unshift(entry!);
    field.on(target, events);
    events.push({ type: 'selfState', side: target.side, state: 'afterYou' });
    return true;
  },
  quash: (_ctx, field, turn, _user, target, events) => {
    if (!target || turn.acted.has(target.mon.uid)) return false;
    const at = turn.queue.findIndex((p) => p.user === target);
    if (at < 0) return false;
    const [entry] = turn.queue.splice(at, 1);
    turn.queue.push(entry!);
    field.on(target, events);
    events.push({ type: 'selfState', side: target.side, state: 'quashed' });
    return true;
  },
  instruct: (ctx, field, turn, user, target, events) => {
    if (!target || target === user) return false;
    const last = target.vol.lastMove;
    const slot = last ? target.mon.moves.findIndex((m) => m.id === last) : -1;
    if (slot < 0 || target.mon.moves[slot]!.pp <= 0 || forcedMoveId(target.vol) || last === 'instruct') return false;
    field.on(target, events);
    events.push({ type: 'selfState', side: target.side, state: 'instructed' });
    const move = battleMove(ctx.content, ctx.battle, target.mon, S.resolveMove(ctx.content, target.mon, slot));
    const saved = ctx.doublesTurn!.hit;
    runPlanned(ctx, field, turn, { user: target, move, slot, target: turn.lastTarget.get(target.mon.uid), priority: 0, speed: 0, tie: 0 }, events);
    ctx.doublesTurn!.hit = saved;
    return true;
  },
  'aromatic-mist': boostAlly([['spd', 1]]),
  coaching: boostAlly([
    ['atk', 1],
    ['def', 1],
  ]),
  'dragon-cheer': (ctx, field, _turn, user, _target, events) => {
    const ally = field.ally(user);
    if (!ally) return false;
    const held = ctx.battle.held!;
    const dragon = getSpecies(ctx.content, ally.mon.speciesId).types.includes('dragon');
    held.crit[ally.mon.uid] = (held.crit[ally.mon.uid] ?? 0) + (dragon ? 2 : 1);
    field.on(ally, events);
    events.push({ type: 'selfState', side: ally.side, state: 'focusEnergy' });
    return true;
  },
  'hold-hands': (_ctx, field, _turn, user, _target, events) => {
    const ally = field.ally(user);
    if (!ally) return false;
    events.push({ type: 'selfState', side: user.side, state: 'holdHands' });
    return true;
  },
};

/** Dancer: each other Pokémon with Dancer copies a dance right after it (no PP). */
function dancers(ctx: BattleContext, field: Field, turn: TurnState, dancer: Combatant, move: Move, events: BattleEvent[]): void {
  const copiers = field.alive().filter((c) => c !== dancer && S.abilityIn(ctx, c) === 'dancer').sort((a, b) => S.speedOf(ctx, b) - S.speedOf(ctx, a));
  for (const c of copiers) {
    if (c.mon.hp <= 0) continue;
    field.on(c, events);
    S.announce(c, 'dancer', events);
    events.push({ type: 'move', side: c.side, moveId: move.id });
    const aimAt = dancer.side !== c.side ? { side: dancer.side, spot: field.spotOf(dancer) ?? 0 } : undefined;
    const targets = aim(ctx, field, turn, c, move, aimAt as { side: Side; spot: Spot } | undefined);
    hitAll(ctx, field, turn, c, targets, move, false, events);
  }
}

/** What each Pokémon on the field holds before a move (for Symbiosis). */
function snapshotHeld(ctx: BattleContext, field: Field): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of field.alive()) out.set(c.mon.uid, Object.values(Held.effectiveHeld(ctx, c.mon)).reduce((a, b) => a + b, 0));
  return out;
}

/** Symbiosis: when a Pokémon uses up an item, its partner passes it one of its own. */
function symbiosis(ctx: BattleContext, field: Field, before: Map<string, number>, events: BattleEvent[]): void {
  for (const c of field.alive()) {
    const had = before.get(c.mon.uid);
    const now = Object.values(Held.effectiveHeld(ctx, c.mon)).reduce((a, b) => a + b, 0);
    if (had === undefined || now >= had) continue;
    const giver = field.ally(c);
    if (!giver || S.abilityIn(ctx, giver) !== 'symbiosis') continue;
    const item = Object.keys(Held.carriedItems(ctx, giver.mon))[0];
    if (!item) continue;
    Held.takeItem(ctx, giver.mon, item, c.mon);
    field.on(giver, events);
    S.announce(giver, 'symbiosis', events);
    field.on(c, events);
    events.push({ type: 'held', side: c.side, itemId: item, what: 'received' } as BattleEvent);
  }
}

// ---------- end of turn, faints ----------

function endOfTurn(ctx: BattleContext, field: Field, commands: (SlotCommand | null)[], events: BattleEvent[]): void {
  const { battle } = ctx;
  const bySpeed = () => field.alive().sort((a, b) => S.speedOf(ctx, b) - S.speedOf(ctx, a));
  const each = (fn: (c: Combatant) => void) => {
    for (const c of bySpeed()) {
      if (c.mon.hp <= 0 || !field.on(c, events)) continue;
      const foe = field.alive(otherSide(c.side))[0];
      if (foe) field.on(foe, events);
      field.on(c, events);
      fn(c);
    }
    faintCheck(ctx, field, events);
  };
  each((c) => S.applyWeather(ctx, [c], events, false));
  S.applyWeather(ctx, [], events);
  each((c) => S.applyTurnHeal(ctx, c, events));
  each((c) => S.applyTerrain(ctx, [c], events, false));
  S.applyTerrain(ctx, [], events);
  S.tickSides(ctx, events);
  each((c) => S.statusCureAbility(ctx, c, events));
  // Healer: 30% to cure the partner's status.
  each((c) => {
    const ally = field.ally(c);
    if (S.abilityIn(ctx, c) !== 'healer' || !ally?.mon.status || !ctx.rng.chance(0.3)) return;
    S.announce(c, 'healer', events);
    ally.mon.status = null;
    field.on(ally, events);
    events.push({ type: 'cured', side: ally.side });
  });
  each((c) => {
    const foe = field.alive(otherSide(c.side))[0];
    if (foe) S.applyResidual(ctx, c, foe, events);
  });
  each((c) => {
    const spot = field.spotOf(c);
    const justIn = c.side === 'player' && spot !== null && commands[spot]?.action.kind === 'switch';
    if (S.abilityIn(ctx, c) === 'speed-boost' && c.stages.spe < 6 && !justIn) {
      S.announce(c, 'speed-boost', events);
      S.applyStageChange(ctx, c, 'spe', 1, events);
    }
  });
  each((c) => S.syncForms(ctx, c, events, true));
  const pair = (): [Combatant, Combatant] | null => {
    const p = field.alive('player')[0];
    const e = field.alive('enemy')[0];
    return p && e ? [p, e] : null;
  };
  const first = pair();
  if (first) {
    field.on(first[0], events);
    field.on(first[1], events);
    S.tickDelayed(ctx, first[0], first[1], events);
  }
  each((c) => S.endTurnMon(ctx, c, field.alive(otherSide(c.side))[0] ?? c, events));
  S.endTurnField(ctx, events);
  // Overdrive end-of-turn moments (a bond shaking off a status, Emotional Awakening, Guard Formation counting down).
  each((c) => {
    if (c.side === 'player') S.hyperEndOfTurn(ctx, c, events);
  });
  each((c) => Held.endOfTurn(ctx, c, events as Held.HeldEvent[]));
  for (const c of field.alive()) c.vol.turnsOut += 1;
  tickDynamax(ctx.content, battle, ctx.party, events as TransformStepEvent[]);
  pivots(ctx, field, events);
}

/** U-turn, Volt Switch, Baton Pass: the user leaves at the end of the turn. */
function pivots(ctx: BattleContext, field: Field, events: BattleEvent[]): void {
  const { battle } = ctx;
  const d = battle.doubles!;
  for (const c of field.alive()) {
    const out = c.vol.pivot;
    c.vol.pivot = null;
    if (!out || battle.outcome) continue;
    const spot = field.spotOf(c);
    if (spot === null) continue;
    if (c.side === 'enemy') {
      const spare = benchOf(ctx, 'enemy')[0];
      if (spare === undefined || battle.kind !== 'trainer') continue;
      const carried = out.baton ? { ...c.stages } : null;
      field.on(c, events);
      events.push({ type: 'switchOut', side: 'enemy', uid: c.mon.uid });
      sendOut(ctx, field, 'enemy', spot, spare, events);
      if (carried) Object.assign(field.at('enemy', spot)!.stages, carried);
      runEntries(ctx, field, [field.at('enemy', spot)!], events);
    } else if (benchOf(ctx, 'player').length > 0 && !d.refill.includes(spot)) {
      battle.batonStages = out.baton ? { ...c.stages } : null;
      d.refill.push(spot);
      battle.needsSwitch = true;
    }
  }
}

/** Healthy Pokémon not on the field. */
function benchOf(ctx: BattleContext, side: Side): number[] {
  const team = side === 'player' ? ctx.party : ctx.battle.enemyTeam;
  const onField = SPOTS.map((s) => indexAt(ctx, side, s));
  return team.map((m, i) => ({ m, i })).filter(({ m, i }) => m.hp > 0 && !onField.includes(i)).map(({ i }) => i);
}

function sideOut(field: Field, side: Side): boolean {
  return field.alive(side).length === 0;
}

/** Faint events for Pokémon that just fainted; Receiver / Power of Alchemy take their abilities. */
function faintCheck(ctx: BattleContext, field: Field, events: BattleEvent[]): void {
  const { battle } = ctx;
  for (const side of SIDES) for (const spot of SPOTS) {
    const c = field.at(side, spot);
    if (!c || c.mon.hp > 0 || events.some((e) => e.type === 'faint' && e.uid === c.mon.uid)) continue;
    focus(ctx, side, spot, events);
    const p = field.at('player', primarySpot(battle.doubles!, 'player'))!;
    const e = field.at('enemy', primarySpot(battle.doubles!, 'enemy'))!;
    S.recordFaints(ctx, p, e, events);
    const ally = field.ally(c);
    const lost = c.vol.abilityOverride ?? abilityOf(ctx.content, c.mon);
    if (ally && lost && !NO_COPY.has(lost)) {
      const own = S.abilityIn(ctx, ally);
      if (own === 'receiver' || own === 'power-of-alchemy') {
        field.on(ally, events);
        S.announce(ally, own, events);
        ally.vol.abilityOverride = lost;
        S.announce(ally, lost, events);
      }
    }
    // A commanding Tatsugiri comes out when its Dondozo faints.
    const d = battle.doubles!;
    d.commanding = (d.commanding ?? []).filter((uid) => uid !== c.mon.uid && !(ally && ally.mon.uid === uid));
  }
}

/** After a turn: the outcome, the trainer's next Pokémon, or the spots the player must fill. */
function settle(ctx: BattleContext, field: Field, events: BattleEvent[]): void {
  const { battle } = ctx;
  const d = battle.doubles!;
  faintCheck(ctx, field, events);
  const enemyLeft = battle.enemyTeam.some((m) => m.hp > 0);
  const playerLeft = ctx.party.some((m) => m.hp > 0 && m.uid !== battle.loaner);
  if (!enemyLeft) {
    battle.outcome = !playerLeft && ctx.doubleKoLoser === 'player' ? 'lose' : 'win';
    return;
  }
  if (!playerLeft) {
    battle.outcome = 'lose';
    return;
  }
  // The trainer sends out its next Pokémon into each fainted spot.
  const entering: Combatant[] = [];
  for (const spot of SPOTS) {
    const c = field.at('enemy', spot);
    if (c && c.mon.hp > 0) continue;
    const next = benchOf(ctx, 'enemy')[0];
    if (next === undefined) {
      clearSpot(ctx, 'enemy', spot, events);
      continue;
    }
    sendOut(ctx, field, 'enemy', spot, next, events);
    entering.push(field.at('enemy', spot)!);
  }
  // Your fainted spots: choose replacements, or the spot stays empty.
  for (const spot of SPOTS) {
    const c = field.at('player', spot);
    if (!c || c.mon.hp > 0 || d.refill.includes(spot)) continue;
    if (benchOf(ctx, 'player').length > d.refill.length) d.refill.push(spot);
    else clearSpot(ctx, 'player', spot, events);
  }
  battle.needsSwitch = d.refill.length > 0;
  battle.participants = [...new Set([...battle.participants, ...field.alive('player').map((c) => c.mon.uid)])];
  if (entering.length > 0) runEntries(ctx, field, entering, events);
  if (entering.some((c) => c.mon.hp <= 0)) settle(ctx, field, events);
}

/** A spot whose Pokémon fainted with nobody to replace it: the other one stays in the main fields. */
function clearSpot(ctx: BattleContext, side: Side, spot: Spot, events: BattleEvent[]): void {
  const d = ctx.battle.doubles!;
  if (!slotView(ctx, side, spot)) return;
  const otherSpot: Spot = spot === 0 ? 1 : 0;
  if (!slotView(ctx, side, otherSpot)) return;
  focus(ctx, side, otherSpot, events);
  d[side].index = -1;
}

/** For the battle screen and tests: the commands a simple player would give (first usable move, first foe). */
export function autoCommands(ctx: Pick<BattleContext, 'battle' | 'party' | 'content'>): (SlotCommand | null)[] {
  return SPOTS.map((spot) => {
    const mon = monAt(ctx, 'player', spot);
    if (!mon || mon.hp <= 0) return null;
    const index = hasUsableMove(mon) ? mon.moves.findIndex((m) => m.pp > 0) : -1;
    const foeSpot = SPOTS.find((s) => (monAt(ctx, 'enemy', s)?.hp ?? 0) > 0) ?? 0;
    return { action: { kind: 'move', index }, target: { side: 'enemy', spot: foeSpot } };
  });
}
