// Camp, gadgets and crafting (W3, ledger rows I189-I239, F131-F155). Every action here is pure and deterministic:
// rolls come from hashes of the run seed, the action and the stop, so reload and replay agree and no gameplay stream moves.
// Numbers live in data/camp.json. State: `run.camp` (this run) and `profile.camp` (cookbook, album, journal, time capsule).

import { berryFlavor, berryReaction, careOf, favoriteFlavor, hash, hatedFlavor } from '../care';
import { teachableMoves } from '../catalog';
import type { ArchetypeModifier, Content } from '../contentSchema';
import { changeFriendship } from '../friendship';
import { addItem, consumeItem, itemCount } from '../items';
import { currentColumn } from '../map';
import { maxHp } from '../pokemon';
import { hashSeed, Rng } from '../rng';
import type { PokemonInstance, RunState } from '../state';
import { forecast, scoutAhead } from '../world';
import { CAMP, freshCamp, freshCampProfile, type CampProfile, type CampState } from './schema';

export * from './schema';

export type CampActionDef = (typeof CAMP.actions)[number];
export type Grade = 'miss' | 'ok' | 'good' | 'perfect';
export interface CampArgs {
  /** A slot like `bag:potion`, `mat:fiber`, `held:oran-berry`, `stuff:key`. */
  item?: string;
  item2?: string;
  items?: string[];
  party?: number;
  choice?: string;
  grade?: Grade;
  text?: string;
  /** Move to teach (TM shelf) and the move slot to forget. */
  move?: string;
  forget?: number;
}
export interface CampResult { run: RunState; pc: CampProfile; message: string; ok: boolean }

const PHASES: readonly RunState['phase'][] = ['reward', 'decision', 'map', 'shop'];
const TYPES = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy'];
const STATS = ['atk', 'def', 'spa', 'spd', 'spe'] as const;
class Problem extends Error {}
const fail = (text: string): never => { throw new Problem(text); };

export const campOf = (run: RunState): CampState => (run.camp ??= freshCamp());
export const getGadget = (id: string) => CAMP.gadgets.find((g) => g.id === id);
export const getAction = (id: string) => CAMP.actions.find((a) => a.id === id);
const stopKey = (run: RunState): string => String(run.encountersCompleted);
const stageKey = (run: RunState): string => `${run.regionIndex ?? 0}:${run.stage?.kind}:${run.stage?.index}`;
const rngOf = (run: RunState, key: string, extra = ''): Rng => new Rng(hashSeed(`${run.seed}::camp::${key}:${stopKey(run)}:${extra}`));
const range = (rng: Rng, r: readonly [number, number]): number => rng.int(r[0], r[1]);
const addMat = (run: RunState, id: string, n: number): void => { if (n > 0) run.materials[id] = (run.materials[id] ?? 0) + n; };
const addStuff = (camp: CampState, id: string, n: number): void => { camp.stuff[id] = Math.max(0, (camp.stuff[id] ?? 0) + n); };
const itemName = (content: Content, id: string): string => content.items.get(id)?.name ?? content.catalog.get(id)?.name ?? id;
const nameOf = (content: Content, mon: PokemonInstance): string => mon.care?.nickname || (content.species.get(mon.speciesId)?.name ?? mon.speciesId);
const clampMood = (mon: PokemonInstance, d: number): void => { const c = careOf(mon); c.mood = Math.max(-3, Math.min(3, c.mood + d)); };
const mats = (cost: Record<string, number>): [string, number][] => Object.entries(cost).filter(([, n]) => n > 0);
const costText = (cost: Record<string, number>): string => mats(cost).map(([id, n]) => `${n} ${id}`).join(', ') || 'free';
const price = (content: Content, id: string): number => content.shop.find((e) => e.item === id)?.price ?? 100;

/** Pushes timed effects the same way trainer signatures do (they live in the perk list until the battles run out). */
function addTemp(run: RunState, effects: ArchetypeModifier[], battles: number, until: 'battle' | 'wild'): void {
  run.perkEffects.push(...effects);
  run.tempEffects.push({ effects, battles, until });
}

// ---------- gadgets ----------

export const gadgetUses = (run: RunState, id: string): number => run.camp?.wear[id] ?? 0;
export const hasGadget = (run: RunState, id: string): boolean => (run.camp?.wear[id] ?? -1) >= 0;
function needGadget(run: RunState, id: string): void {
  const g = getGadget(id)!;
  if (!hasGadget(run, id)) fail(`You do not have a ${g.name}. Craft one at the bench.`);
  if (gadgetUses(run, id) <= 0) fail(`The ${g.name} is worn out. Mend it at the forge.`);
}
function wear(run: RunState, id: string): void {
  const camp = campOf(run);
  camp.wear[id] = Math.max(0, (camp.wear[id] ?? 0) - 1);
}

// ---------- limits and tokens ----------

function scopeOf(run: RunState, limit: 'stop' | 'stage' | 'none'): string | null {
  return limit === 'stop' ? `s${stopKey(run)}` : limit === 'stage' ? `g${stageKey(run)}` : null;
}
function pruneDone(run: RunState): void {
  const camp = campOf(run);
  const now = [`s${stopKey(run)}`, `g${stageKey(run)}`];
  for (const key of Object.keys(camp.done)) if (!now.includes(key.split('@')[1] ?? '')) delete camp.done[key];
}
export function usedHere(run: RunState, def: CampActionDef): number {
  const scope = scopeOf(run, def.limit);
  return scope ? (run.camp?.done[`${def.id}@${scope}`] ?? 0) : 0;
}
function markDone(run: RunState, def: CampActionDef): void {
  const scope = scopeOf(run, def.limit);
  if (scope) campOf(run).done[`${def.id}@${scope}`] = usedHere(run, def) + 1;
  // One Camp Token per stop for doing anything at camp (event-only currency sink).
  const camp = campOf(run);
  if (!camp.done[`token@s${stopKey(run)}`]) { camp.done[`token@s${stopKey(run)}`] = 1; camp.tokens += CAMP.market.tokensPerAction; }
}

// ---------- slots (items named by where they live) ----------

type Slot = { kind: 'bag' | 'mat' | 'held' | 'stuff'; id: string };
export function parseSlot(ref: string | undefined): Slot {
  const [kind, ...rest] = (ref ?? '').split(':');
  if (!kind || rest.length === 0 || !['bag', 'mat', 'held', 'stuff'].includes(kind)) return fail('Pick an item first.');
  return { kind: kind as Slot['kind'], id: rest.join(':') };
}
export function slotCount(run: RunState, s: Slot): number {
  return s.kind === 'bag' ? itemCount(run.inventory, s.id) : s.kind === 'mat' ? run.materials[s.id] ?? 0 : s.kind === 'held' ? run.looseHeld?.[s.id] ?? 0 : run.camp?.stuff[s.id] ?? 0;
}
function takeSlot(run: RunState, s: Slot, n = 1): void {
  if (slotCount(run, s) < n) fail(`You need ${n} of that.`);
  if (s.kind === 'bag') for (let i = 0; i < n; i++) consumeItem(run.inventory, s.id);
  else if (s.kind === 'mat') { run.materials[s.id] = (run.materials[s.id] ?? 0) - n; if (run.materials[s.id] === 0) delete run.materials[s.id]; }
  else if (s.kind === 'held') { run.looseHeld![s.id] = (run.looseHeld![s.id] ?? 0) - n; if (run.looseHeld![s.id] === 0) delete run.looseHeld![s.id]; }
  else addStuff(campOf(run), s.id, -n);
}
const slotName = (content: Content, s: Slot): string => (s.kind === 'mat' ? s.id : s.kind === 'stuff' ? s.id : itemName(content, s.id));
const isBerry = (content: Content, id: string): boolean => content.catalog.get(id)?.family.startsWith('Berries') === true;

/** Everything the player could put in a slot, as `{ref, name, count}` (the Combine and Recycle pickers). */
export function slotChoices(content: Content, run: RunState, kinds: readonly Slot['kind'][] = ['bag', 'mat', 'held']): { ref: string; name: string; count: number }[] {
  const out: { ref: string; name: string; count: number }[] = [];
  if (kinds.includes('bag')) for (const [id, n] of Object.entries(run.inventory)) if (n > 0 && content.items.has(id)) out.push({ ref: `bag:${id}`, name: itemName(content, id), count: n });
  if (kinds.includes('mat')) for (const [id, n] of Object.entries(run.materials)) if (n > 0) out.push({ ref: `mat:${id}`, name: id, count: n });
  if (kinds.includes('held')) for (const [id, n] of Object.entries(run.looseHeld ?? {})) if (n > 0 && content.catalog.has(id)) out.push({ ref: `held:${id}`, name: itemName(content, id), count: n });
  if (kinds.includes('stuff')) for (const [id, n] of Object.entries(run.camp?.stuff ?? {})) if (n > 0) out.push({ ref: `stuff:${id}`, name: id, count: n });
  return out;
}
export const bagBerryChoices = (content: Content, run: RunState): { id: string; name: string; flavor: string; count: number }[] =>
  Object.entries(run.looseHeld ?? {}).filter(([id, n]) => n > 0 && isBerry(content, id)).map(([id, count]) => ({ id, name: itemName(content, id), flavor: berryFlavor(id), count }));

// ---------- problems shared by the UI and the actions ----------

/** Why the action cannot run right now (null = fine). Cheap checks only; the handler checks the rest. */
export function campProblem(content: Content, run: RunState, id: string): string | null {
  const def = getAction(id);
  if (!def) return 'Unknown camp action.';
  if (!PHASES.includes(run.phase)) return 'Camp is only open between fights.';
  if (def.gadget && !hasGadget(run, def.gadget)) return `Needs a ${getGadget(def.gadget)!.name} (craft one at the bench).`;
  if (def.gadget && gadgetUses(run, def.gadget) <= 0 && id !== 'launcher') return `The ${getGadget(def.gadget)!.name} is worn out. Mend it at the forge.`;
  const scope = scopeOf(run, def.limit);
  if (scope && (run.camp?.done[`${def.id}@${scope}`] ?? 0) >= CAMP.limits.stopPerAction) return def.limit === 'stop' ? 'Already done at this stop.' : 'Already done on this stage.';
  return null;
}

// ---------- cookbook ----------

export const cookbookHas = (pc: CampProfile, id: string): boolean => pc.cookbook.includes(id);
const discover = (pc: CampProfile, id: string): boolean => { if (pc.cookbook.includes(id)) return false; pc.cookbook.push(id); return true; };
const comboKey = (c: { a: string; b: string }): string => [c.a, c.b].sort().join('+');

function matches(pattern: string, ref: string): boolean {
  if (pattern === 'any:berry') return ref.startsWith('held:');
  return pattern === ref;
}
/** The combo for two slots (either order), or undefined. Berry patterns accept any loose berry. */
export function findCombo(content: Content, ra: string, rb: string) {
  const berry = (r: string): boolean => r.startsWith('held:') && isBerry(content, r.slice(5));
  const ok = (p: string, r: string): boolean => (p === 'any:berry' ? berry(r) : matches(p, r));
  return CAMP.combos.find((c) => (ok(c.a, ra) && ok(c.b, rb)) || (ok(c.a, rb) && ok(c.b, ra)));
}
export const comboList = (pc: CampProfile): { id: string; name: string; known: boolean; locked: boolean; hint: string }[] =>
  CAMP.combos.map((c) => ({ id: c.id, name: c.name, known: cookbookHas(pc, c.id), locked: !!c.locked, hint: cookbookHas(pc, c.id) ? `${c.a.split(':')[1]} + ${c.b.split(':')[1]}` : c.locked ? 'Needs a recipe page.' : 'Try pairs to discover it.' }));
export const benchList = (pc: CampProfile) => CAMP.gadgets.map((g) => ({ ...g, open: !g.page || cookbookHas(pc, `bench:${g.id}`) }));

// ---------- actions ----------

type Ctx = { content: Content; run: RunState; pc: CampProfile; camp: CampState; args: CampArgs; def: CampActionDef };
type Handler = (c: Ctx) => string;

const stopNodes = (run: RunState, ahead = 1) => {
  const stage = run.stage;
  if (!stage) return fail('There is no map here.');
  const col = currentColumn(stage) + ahead;
  return stage.map.nodes.filter((n) => n.column === col);
};
const sideName = (kind: string, s: { roamer?: string; hidden?: boolean }): string => (s.hidden ? 'a hidden stop' : s.roamer ? 'a roaming Legendary' : kind === 'raid' ? 'a raid den' : kind === 'totem' ? 'a Totem territory' : kind === 'expedition' ? 'an expedition gate' : `a ${kind} stop`);
function unhideAhead(run: RunState): number {
  let n = 0;
  for (const node of stopNodes(run)) for (const s of node.sides) if (s.hidden) { s.hidden = false; n++; }
  return n;
}
function giveToParty(c: Ctx, fn: (m: PokemonInstance) => void): void { for (const m of c.run.party) fn(m); }
function partyHeal(c: Ctx, share: number): number {
  let total = 0;
  for (const m of c.run.party) if (m.hp > 0) { const heal = Math.max(1, Math.round(maxHp(c.content, m) * share)); const before = m.hp; m.hp = Math.min(maxHp(c.content, m), m.hp + heal); total += m.hp - before; }
  return total;
}
function partyMon(c: Ctx): PokemonInstance {
  const m = c.run.party[c.args.party ?? -1];
  return m ?? fail('Pick a party Pokémon.');
}
function relicName(id: string): string { return CAMP.relics.find((r) => r.id === id)?.name ?? id; }

export function grantRelic(run: RunState, relicId: string, cursed: boolean): string {
  const def = CAMP.relics.find((r) => r.id === relicId)!;
  const camp = campOf(run);
  const curse = cursed ? def.curse : null;
  run.perkEffects.push(...def.effects, ...(curse?.effects ?? []));
  camp.relics.push({ id: relicId, cursed: !!curse });
  return `${def.name}: ${def.blurb}${curse ? ` Cursed: ${curse.text} It cannot be dropped or traded until cleansed.` : ''}`;
}
function dropEffects(run: RunState, effects: ArchetypeModifier[]): void {
  for (const e of effects) { const at = run.perkEffects.findIndex((m) => JSON.stringify(m) === JSON.stringify(e)); if (at >= 0) run.perkEffects.splice(at, 1); }
}
export function cleanseRelic(run: RunState, index: number): string {
  const camp = campOf(run);
  const held = camp.relics[index];
  if (!held) return fail('No such relic.');
  if (!held.cursed) return fail('That relic is not cursed.');
  const def = CAMP.relics.find((r) => r.id === held.id)!;
  dropEffects(run, def.curse?.effects ?? []);
  held.cursed = false;
  return `${def.name} is cleansed. The curse lifts.`;
}
export const cursedRelics = (run: RunState): { index: number; name: string }[] => (run.camp?.relics ?? []).flatMap((r, index) => (r.cursed ? [{ index, name: relicName(r.id) }] : []));
/** A cursed relic blocks selling or dropping (the Bag asks this). */
export const hasCurse = (run: RunState): boolean => (run.camp?.relics ?? []).some((r) => r.cursed);

const HANDLERS: Record<string, Handler> = {
  compass: (c) => {
    wear(c.run, 'compass');
    const stage = c.run.stage!;
    const here = currentColumn(stage);
    let best: { d: number; text: string } | null = null;
    for (const n of stage.map.nodes) {
      if (n.column <= here) continue;
      for (const s of n.sides) {
        if (!(['raid', 'totem', 'expedition'].includes(s.kind) || s.roamer || s.hidden)) continue;
        const d = n.column - here;
        if (!best || d < best.d) best = { d, text: `${sideName(s.kind, s)} ${d} column${d === 1 ? '' : 's'} ahead (column ${n.column})` };
      }
    }
    return best ? `The needle swings: ${best.text}.` : 'The needle spins aimlessly. Nothing rare ahead.';
  },
  binoculars: (c) => {
    wear(c.run, 'binoculars');
    scoutAhead(c.content, c.run, 1);
    const kinds = stopNodes(c.run).flatMap((n) => n.sides.map((s) => sideName(s.kind, s)));
    return kinds.length > 0 ? `Through the lenses: ${[...new Set(kinds)].join(', ')} just ahead.` : 'Through the lenses: the road ahead looks plain.';
  },
  lantern: (c) => {
    if ((c.camp.stuff.oil ?? 0) < 1) fail('The lantern is out of oil. Combine ember and fiber for more.');
    addStuff(c.camp, 'oil', -1);
    wear(c.run, 'lantern');
    const n = unhideAhead(c.run);
    return n > 0 ? `The lantern light shows ${n} hidden stop${n === 1 ? '' : 's'} ahead.` : 'The lantern light finds nothing lurking ahead.';
  },
  dowse: (c) => {
    wear(c.run, 'dowsing-rod');
    const rng = rngOf(c.run, 'dowse');
    const d = CAMP.dowse;
    if (!rng.chance(d.chance + c.camp.luck * 0.03)) return 'The rod barely twitches. Nothing buried here.';
    const roll = rng.float();
    if (roll < d.chestChance) { addStuff(c.camp, 'chest', 1); return 'The rod hums hard! You dig up a locked chest.'; }
    if (roll < 0.6) { const m = rng.pick(Object.keys(c.run.materials).length > 0 ? ['scrap', 'fiber', 'ember', 'tide'] : ['scrap']); addMat(c.run, m, d.materials); return `The rod hums. You dig up ${d.materials} ${m}.`; }
    const money = range(rng, d.money); c.run.money += money; return `The rod hums. You dig up ₽${money}.`;
  },
  telescope: (c) => {
    wear(c.run, 'telescope');
    const f = forecast(c.content, c.run);
    return f ? `The stars say ${f.front.weather} in ${f.startsIn === 0 ? 'the very next column' : `${f.startsIn} columns`}.` : 'The stars are clear: no weather front ahead.';
  },
  photo: (c) => {
    const mon = partyMon(c);
    wear(c.run, 'camera');
    const first = !c.pc.album.includes(mon.speciesId);
    if (!c.camp.photos.includes(mon.speciesId)) c.camp.photos.push(mon.speciesId);
    if (first) c.pc.album.push(mon.speciesId);
    changeFriendship(c.content, mon, CAMP.photo.friendship);
    clampMood(mon, CAMP.photo.mood);
    if (first) c.run.money += CAMP.photo.firstMoney;
    return `Click! ${nameOf(c.content, mon)} poses${first ? ` for a first photo in the album (+₽${CAMP.photo.firstMoney})` : ''}.`;
  },
  radio: (c) => {
    const st = (c.args.choice ?? '') as 'news' | 'rock' | 'lullaby' | 'quiz';
    const conf = CAMP.radio[st] ?? fail('Pick a station.');
    wear(c.run, 'radio');
    addTemp(c.run, conf.effects as ArchetypeModifier[], CAMP.radio.battles, 'battle');
    const f = st === 'news' ? forecast(c.content, c.run) : null;
    return `Radio on: ${st}. The buff lasts ${CAMP.radio.battles} battles.${f ? ` News: ${f.front.weather} ahead.` : ''}`;
  },
  flute: (c) => {
    const conf = CAMP.flute[c.args.choice ?? ''] ?? fail('Calm or provoke?');
    wear(c.run, 'instrument');
    addTemp(c.run, conf.effects as ArchetypeModifier[], conf.battles, 'wild');
    return c.args.choice === 'calm' ? `A soft tune: the next ${conf.battles} wild Pokémon are easier to catch.` : `A shrill tune: rare Pokémon are likelier for the next ${conf.battles} wild encounters.`;
  },
  net: (c) => {
    wear(c.run, 'net');
    addMat(c.run, 'fiber', CAMP.net.silk);
    giveToParty(c, (m) => { if (c.content.species.get(m.speciesId)?.types.includes('bug')) changeFriendship(c.content, m, CAMP.net.friendshipBug); });
    return `You sweep up ${CAMP.net.silk} bug silk (fiber) without hurting a single bug.`;
  },
  tent: (c) => {
    const g = (c.args.grade ?? 'ok') as Grade;
    wear(c.run, 'tent');
    const healed = partyHeal(c, CAMP.tent.heal[g]!);
    const rest = CAMP.tent.fatigue[g]!;
    giveToParty(c, (m) => { const cr = careOf(m); cr.fatigue = Math.max(0, cr.fatigue - rest); clampMood(m, CAMP.tent.mood[g]!); });
    return `${g === 'perfect' ? 'A perfect pitch' : g === 'miss' ? 'A saggy pitch' : 'A decent pitch'}: the team heals ${healed} HP and rests.`;
  },
  fireworks: (c) => {
    wear(c.run, 'fireworks');
    giveToParty(c, (m) => { clampMood(m, CAMP.fireworks.mood); changeFriendship(c.content, m, CAMP.fireworks.friendship); });
    return 'Boom! Fireworks light the sky and the whole team cheers.';
  },
  glow: (c) => {
    wear(c.run, 'glow-stick');
    giveToParty(c, (m) => changeFriendship(c.content, m, CAMP.glow.friendship));
    const n = unhideAhead(c.run);
    return `You wave the glow stick: your team answers.${n > 0 ? ` ${n} hidden stop${n === 1 ? ' shows' : 's show'} ahead.` : ''}`;
  },
  mirror: (c) => {
    const mon = partyMon(c);
    wear(c.run, 'mirror');
    c.camp.luck += CAMP.mirror.luck;
    const talent = careOf(mon).talent ?? STATS[hash(`talent:${mon.uid}`) % STATS.length]!;
    return `The mirror shows ${nameOf(c.content, mon)}'s hidden talent: ${talent.toUpperCase()}. It loves ${favoriteFlavor(mon)} food and hates ${hatedFlavor(mon)}. Luck ${CAMP.mirror.luck}.`;
  },
  launcher: (c) => {
    if (!hasGadget(c.run, 'launcher')) fail('You need a Ball Launcher.');
    c.camp.launcher = !c.camp.launcher;
    return c.camp.launcher ? 'Skill throws on: balls are a timing shot now.' : 'Skill throws off.';
  },
  pot: (c) => {
    const ids = c.args.items ?? [];
    if (ids.length < 1 || ids.length > CAMP.pot.maxBerries) fail(`Cook 1 to ${CAMP.pot.maxBerries} berries.`);
    const tally: Record<string, number> = {};
    for (const id of ids) { takeSlot(c.run, { kind: 'held', id }); if (!isBerry(c.content, id)) fail('Only berries go in the pot.'); const f = berryFlavor(id); tally[f] = (tally[f] ?? 0) + 1; }
    const [flavor, same] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]!;
    const s = CAMP.pot.perBerry * (ids.length + (same - 1));
    const meal = CAMP.pot.meals[flavor]!;
    const base = meal.effect as ArchetypeModifier & { value: number };
    const value = base.kind === 'damageTakenMultiplier' ? 1 - s : 1 + s * (base.kind === 'healingMultiplier' ? 2 : 1);
    addTemp(c.run, [{ ...base, value: Math.round(value * 1000) / 1000 } as ArchetypeModifier], CAMP.pot.battles, 'battle');
    giveToParty(c, (m) => { let d = CAMP.pot.mood; for (const id of ids) { const r = berryReaction(m, id); if (r === 'hated') d -= 1; } clampMood(m, d); });
    return `${meal.name}! The whole team eats: ${Math.round(s * 100)}% buff for ${CAMP.pot.battles} battles.`;
  },
  combine: (c) => {
    const a = parseSlot(c.args.item);
    const b = parseSlot(c.args.item2);
    const same = c.args.item === c.args.item2;
    if (slotCount(c.run, a) < (same ? 2 : 1) || slotCount(c.run, b) < 1) fail('You do not have both of those.');
    const combo = findCombo(c.content, c.args.item!, c.args.item2!);
    if (!combo) return 'You try the pair. Nothing happens. (Nothing is lost.)';
    if (combo.locked && !cookbookHas(c.pc, combo.id)) return 'It almost works, but you are missing the know-how. A recipe page might help.';
    takeSlot(c.run, a); takeSlot(c.run, b);
    const g = combo.gives;
    const newly = discover(c.pc, combo.id);
    let text: string;
    if (g.kind === 'brew') { const h = partyHeal(c, g.heal); giveToParty(c, (m) => clampMood(m, g.mood)); text = `${g.text} (+${h} HP)`; }
    else if (g.kind === 'stuff') { addStuff(c.camp, g.stuff, g.amount); text = `You get ${g.amount} ${g.stuff}.`; }
    else if (g.kind === 'item') { addItem(c.run.inventory, g.item, g.amount); text = `You get ${g.amount} ${itemName(c.content, g.item)}.`; }
    else if (g.kind === 'mat') { addMat(c.run, g.mat, g.amount); text = `You get ${g.amount} ${g.mat}.`; }
    else { giveGadget(c.run, g.gadget); text = `You get ${getGadget(g.gadget)!.name}.`; }
    return `${combo.name}!${newly ? ' (New recipe in the cookbook.)' : ''} ${text}`;
  },
  mix: (c) => {
    const a = parseSlot(c.args.item); const b = parseSlot(c.args.item2);
    if (a.kind !== 'bag' || b.kind !== 'bag') fail('Mix two potions from the Bag.');
    if (slotCount(c.run, a) < (c.args.item === c.args.item2 ? 2 : 1) || slotCount(c.run, b) < 1) fail('You need both potions.');
    const want = CAMP.mixPotions.ratios[hash(`mix:${[a.id, b.id].sort().join('+')}:${c.run.seed}`) % CAMP.mixPotions.ratios.length]!;
    if (c.args.choice === want) {
      takeSlot(c.run, a); takeSlot(c.run, b);
      addItem(c.run.inventory, CAMP.mixPotions.success.item, CAMP.mixPotions.success.amount);
      return `Perfect ratio (${want})! You brew a ${itemName(c.content, CAMP.mixPotions.success.item)}.`;
    }
    takeSlot(c.run, a);
    return `The mix ${CAMP.mixPotions.fail}. One potion is lost. (The right ratio is fixed for this pair: try another.)`;
  },
  sniff: (c) => {
    const pick = Number(c.args.choice) - 1;
    const rng = rngOf(c.run, 'sniff', stageKey(c.run));
    const good = rng.int(0, 2);
    if (!(pick >= 0 && pick <= 2)) fail('Pick berry 1, 2 or 3.');
    if (pick === good) { const m = range(rng, CAMP.sniff.reward.money); c.run.money += m; return `Sweet and ripe! You sell the batch for ₽${m}.`; }
    const lead = c.run.party[0];
    if (lead) lead.hp = Math.max(1, lead.hp - Math.round(maxHp(c.content, lead) * CAMP.sniff.poison));
    return `Rotten! ${lead ? nameOf(c.content, lead) : 'Your lead'} gets a mild tummy ache.`;
  },
  page: (c) => {
    if ((c.camp.stuff['recipe-page'] ?? 0) < 1) fail('You have no recipe page.');
    const closed = [...CAMP.combos.filter((x) => x.locked).map((x) => x.id), ...CAMP.gadgets.filter((g) => g.page).map((g) => `bench:${g.id}`)].filter((id) => !c.pc.cookbook.includes(id));
    if (closed.length === 0) fail('You already know every recipe.');
    addStuff(c.camp, 'recipe-page', -1);
    const id = rngOf(c.run, 'page', String(c.pc.cookbook.length)).pick(closed);
    discover(c.pc, id);
    const name = id.startsWith('bench:') ? getGadget(id.slice(6))!.name : CAMP.combos.find((x) => x.id === id)!.name;
    return `The page teaches you: ${name}.`;
  },
  bench: (c) => {
    const g = getGadget(c.args.choice ?? '');
    if (!g) return fail('Pick a gadget.');
    if (g.page && !cookbookHas(c.pc, `bench:${g.id}`)) fail('You do not know this recipe yet. Find a recipe page.');
    const stackable = g.uses === 1;
    if (hasGadget(c.run, g.id) && gadgetUses(c.run, g.id) > 0 && !stackable) fail(`You already have a ${g.name}.`);
    for (const [id, n] of mats(g.bench)) if ((c.run.materials[id] ?? 0) < n) fail(`Needs ${costText(g.bench)} (you have ${c.run.materials[id] ?? 0} ${id}).`);
    for (const [id, n] of mats(g.bench)) takeSlot(c.run, { kind: 'mat', id }, n);
    giveGadget(c.run, g.id);
    return `Crafted ${g.name} (${g.uses} use${g.uses === 1 ? '' : 's'}).`;
  },
  forge: (c) => {
    const g = getGadget(c.args.choice ?? '');
    if (!g || !hasGadget(c.run, g.id)) return fail('You do not own that gadget.');
    if (mats(g.repair).length === 0) fail(`${g.name} cannot be mended.`);
    if (gadgetUses(c.run, g.id) >= g.uses) fail(`${g.name} is not worn.`);
    for (const [id, n] of mats(g.repair)) if ((c.run.materials[id] ?? 0) < n) fail(`Mending needs ${costText(g.repair)}.`);
    for (const [id, n] of mats(g.repair)) takeSlot(c.run, { kind: 'mat', id }, n);
    c.camp.wear[g.id] = g.uses;
    return `${g.name} is mended at the forge (${g.uses} uses).`;
  },
  recycle: (c) => {
    const s = parseSlot(c.args.item);
    if (s.kind !== 'bag') fail('Recycle a Bag item.');
    takeSlot(c.run, s);
    const amount = Math.max(CAMP.recycle.minScrap, Math.round((price(c.content, s.id) / 100) * CAMP.recycle.perCost));
    addMat(c.run, 'scrap', amount);
    return `${itemName(c.content, s.id)} is broken down into ${amount} scrap.`;
  },
  fuse: (c) => {
    const plate = c.args.item?.replace(/^held:/, '') ?? '';
    const type = CAMP.fuse.plates[plate];
    const burn = c.args.item2?.replace(/^stuff:tm-/, '');
    if (!type) return fail('Pick a Plate or Memory.');
    if (!burn || !TYPES.includes(burn) || (c.camp.stuff[`tm-${burn}`] ?? 0) < 1) return fail('Pick a TM from your shelf to burn.');
    takeSlot(c.run, { kind: 'held', id: plate });
    addStuff(c.camp, `tm-${burn}`, -1);
    const n = burn === type ? CAMP.fuse.sameTypeCopies : CAMP.fuse.differentCopies;
    addStuff(c.camp, `tm-${type}`, n);
    return `${itemName(c.content, plate)} fuses with a ${burn} TM: ${n}× ${type} TM on the shelf.`;
  },
  seal: (c) => {
    const kind = c.args.choice ?? '';
    const conf = (CAMP.seals as Record<string, { battles: number; effects: ArchetypeModifier[] }>)[kind];
    if (!conf || kind === 'cost') return fail('Pick a seal.');
    for (const [id, n] of mats(CAMP.seals.cost)) if ((c.run.materials[id] ?? 0) < n) fail(`A seal needs ${costText(CAMP.seals.cost)}.`);
    for (const [id, n] of mats(CAMP.seals.cost)) takeSlot(c.run, { kind: 'mat', id }, n);
    addTemp(c.run, conf.effects, conf.battles, 'wild');
    return `You stick a ${kind} seal on your balls for the next ${conf.battles} wild encounters.`;
  },
  label: (c) => {
    const s = parseSlot(c.args.item);
    const text = (c.args.text ?? '').trim().slice(0, 24);
    if (s.kind !== 'bag' && s.kind !== 'held') fail('Label a Bag or held item.');
    if (!text) { delete c.camp.labels[s.id]; return 'Label removed.'; }
    c.camp.labels[s.id] = text;
    wear(c.run, 'label-printer');
    return `Label printed: ${itemName(c.content, s.id)} "${text}".`;
  },
  tidy: (c) => {
    const sort = c.args.choice as CampState['bagSort'];
    if (!['obtained', 'type', 'rarity', 'recent', 'name'].includes(sort)) fail('Pick a sort.');
    c.camp.bagSort = sort;
    return `Thunk! The Bag is sorted by ${sort}.`;
  },
  hat: (c) => {
    const hat = c.args.choice ?? 'none';
    if (!(hat in CAMP.stall.hat)) fail('Pick a hat.');
    c.camp.hat = hat;
    return hat === 'none' ? 'You go hatless.' : `You tip your ${hat}. Customers notice.`;
  },
  stall: (c) => {
    const s = parseSlot(c.args.item);
    if (s.kind !== 'bag') fail('Put a Bag item in the window.');
    const rng = rngOf(c.run, 'stall');
    const customer = rng.pick(CAMP.stall.customers);
    const hat = CAMP.stall.hat[c.camp.hat] ?? 0;
    const offer = Math.round(price(c.content, s.id) * CAMP.stall.base * (1 + hat));
    const mode = c.args.choice ?? 'accept';
    takeSlot(c.run, s);
    if (!hasGadget(c.run, 'alarm-tag') || gadgetUses(c.run, 'alarm-tag') <= 0) {
      if (rng.chance(CAMP.stall.theft)) return `${customer} grabs the ${itemName(c.content, s.id)} and runs! (An Alarm Tag would have stopped that.)`;
    } else if (rng.chance(CAMP.stall.theft)) { wear(c.run, 'alarm-tag'); c.run.money += 20; addItem(c.run.inventory, s.id, 1); return `The Alarm Tag shrieks: ${customer} drops the ${itemName(c.content, s.id)} and a ₽20 fine.`; }
    let pay = offer;
    if (mode === 'haggle') {
      if (rng.chance(0.5 + hat)) pay = Math.round(offer * (1 + CAMP.stall.haggle)); else { addItem(c.run.inventory, s.id, 1); return `${customer} walks away from the haggle. You keep your ${itemName(c.content, s.id)}.`; }
    } else if (mode === 'bluff') {
      needGadget(c.run, 'prop');
      wear(c.run, 'prop');
      if (rng.chance(0.5 + hat + c.camp.luck * 0.03)) pay = Math.round(offer * (1 + CAMP.stall.bluffBonus));
      else { c.camp.morality -= 1; pay = Math.round(offer * (1 - CAMP.stall.bluffFail)); c.run.money += pay; return `${customer} sees through the bluff and pays only ₽${pay}. (Morality -1)`; }
    }
    c.run.money += pay;
    return `${customer} buys the ${itemName(c.content, s.id)} for ₽${pay}.`;
  },
  market: (c) => marketBuy(c),
  shelf: (c) => {
    const type = c.args.choice ?? '';
    if ((c.camp.stuff[`tm-${type}`] ?? 0) < 1) fail('No such TM on the shelf.');
    const mon = partyMon(c);
    const options = shelfMoves(c.content, c.run, type, c.args.party!);
    if (!c.args.move || !options.includes(c.args.move)) fail('Pick one of the offered moves.');
    const move = c.content.moves.get(c.args.move!)!;
    if (mon.moves.length < 4) mon.moves.push({ id: move.id, pp: move.pp });
    else { const at = c.args.forget ?? -1; if (!mon.moves[at]) fail('Pick a move to forget.'); mon.moves[at] = { id: move.id, pp: move.pp }; }
    addStuff(c.camp, `tm-${type}`, -1);
    return `${nameOf(c.content, mon)} learned ${move.name}!`;
  },
  shake: (c) => {
    const rng = rngOf(c.run, 'shake', stageKey(c.run));
    if (!rng.chance(CAMP.shake.chance + c.camp.luck * 0.03)) return 'You shake the bag. Nothing but lint.';
    if (rng.chance(0.5)) { const m = range(rng, CAMP.shake.money); c.run.money += m; return `A hidden pocket! ₽${m} falls out.`; }
    const stuff = rng.pick(['oil', 'key', 'bottle', 'scrap-piece']);
    addStuff(c.camp, stuff, 1);
    return `A hidden pocket! You find ${stuff === 'scrap-piece' ? 'a map scrap' : stuff === 'oil' ? 'a flask of oil' : `a ${stuff}`}.`;
  },
  rummage: (c) => {
    const rng = rngOf(c.run, 'rummage', stageKey(c.run));
    const r = CAMP.rummage;
    if (rng.chance(r.rats - c.camp.luck * 0.02)) {
      const lead = c.run.party.find((m) => m.hp > 0);
      if (lead) lead.hp = Math.max(1, lead.hp - Math.max(1, Math.round(maxHp(c.content, lead) * r.bite)));
      return `Rats! They swarm out of the bin${lead ? ` and nip ${nameOf(c.content, lead)}` : ''}.`;
    }
    if (rng.chance(r.nothing)) return 'Banana peels and old newspaper. Nothing useful.';
    const f = rng.weighted(r.finds.map((x) => ({ item: x, weight: x.weight })));
    if (f.kind === 'mat') addMat(c.run, f.id, f.amount);
    else if (f.kind === 'item') addItem(c.run.inventory, f.id, f.amount);
    else addStuff(c.camp, f.id, f.amount);
    return `Under the junk: ${f.amount} ${f.kind === 'item' ? itemName(c.content, f.id) : f.id}.`;
  },
  well: (c) => {
    if (c.run.money < CAMP.well.coin) fail(`A coin costs ₽${CAMP.well.coin}.`);
    const wish = c.args.choice ?? '';
    if (!['wealth', 'health', 'luck', 'friends'].includes(wish)) fail('Make a wish.');
    c.run.money -= CAMP.well.coin;
    const rng = rngOf(c.run, 'well', `${stageKey(c.run)}:${wish}`);
    if (!rng.chance(CAMP.well.chance + c.camp.luck * 0.04)) { c.camp.luck += CAMP.well.luckBad; return 'The well is silent. Maybe it was the wrong wish.'; }
    if (wish === 'wealth') { const m = range(rng, CAMP.well.wealth); c.run.money += m; return `Your wish comes true: ₽${m} glints at the bottom.`; }
    if (wish === 'health') { const h = partyHeal(c, CAMP.well.health); return `Your wish comes true: the team heals ${h} HP.`; }
    if (wish === 'friends') { giveToParty(c, (m) => changeFriendship(c.content, m, CAMP.well.friends)); return 'Your wish comes true: the team feels closer.'; }
    c.camp.luck += CAMP.well.luckGood;
    return 'Your wish comes true: you feel lucky.';
  },
  vending: (c) => {
    const rng = rngOf(c.run, 'vending', stageKey(c.run));
    if (rng.chance(CAMP.vending.thief)) {
      if (hasGadget(c.run, 'alarm-tag') && gadgetUses(c.run, 'alarm-tag') > 0) { wear(c.run, 'alarm-tag'); return 'A thief reaches in, but your Alarm Tag shrieks and scares them off.'; }
      const lost = Math.min(c.run.money, CAMP.vending.stolen); c.run.money -= lost;
      return `A thief snatches ₽${lost} while you shake the machine!`;
    }
    if (rng.chance(CAMP.vending.jam)) return 'You shake it... and it jams. Nothing comes out.';
    const item = rng.weighted(CAMP.vending.table.map((t) => ({ item: t.item, weight: t.weight })));
    addItem(c.run.inventory, item, 1);
    return `Clunk! A free ${itemName(c.content, item)} drops out.`;
  },
  bottle: (c) => {
    if ((c.camp.stuff.bottle ?? 0) < 1) fail('You have no bottle.');
    addStuff(c.camp, 'bottle', -1);
    const rng = rngOf(c.run, 'bottle', String(c.camp.morality));
    const text = rng.pick(CAMP.bottle.texts);
    const choice = c.args.choice ?? 'ignore';
    if (choice === 'kind') { const m = range(rng, CAMP.bottle.kind.money); c.run.money += m; c.camp.morality += 1; return `"${text}" You reply kindly. A tide brings back ₽${m}.`; }
    if (choice === 'funny') { giveToParty(c, (mon) => changeFriendship(c.content, mon, CAMP.bottle.funny.friendship)); return `"${text}" Your joke reply makes the team laugh.`; }
    return `"${text}" You toss it back unanswered.`;
  },
  scraps: (c) => {
    const need = CAMP.scraps.pieces;
    if ((c.camp.stuff['scrap-piece'] ?? 0) < need) fail(`You need ${need} map scraps (you have ${c.camp.stuff['scrap-piece'] ?? 0}).`);
    addStuff(c.camp, 'scrap-piece', -need);
    const rng = rngOf(c.run, 'scraps', String(c.camp.bought['scraps'] ?? 0));
    c.camp.bought['scraps'] = (c.camp.bought['scraps'] ?? 0) + 1;
    const m = range(rng, CAMP.scraps.money);
    c.run.money += m; addMat(c.run, 'aether', CAMP.scraps.materials); addItem(c.run.inventory, CAMP.scraps.item, 1);
    return `The map fits together! Treasure: ₽${m}, ${CAMP.scraps.materials} aether and an ${itemName(c.content, CAMP.scraps.item)}.`;
  },
  chest: (c) => {
    if ((c.camp.stuff.chest ?? 0) < 1) fail('You have no locked chest.');
    const useKey = (c.args.choice ?? 'key') === 'key';
    if (useKey) { if ((c.camp.stuff.key ?? 0) < 1) fail('You have no key. Pick the lock instead.'); addStuff(c.camp, 'key', -1); }
    else {
      const chance = CAMP.chest.lockpick[c.args.grade ?? 'ok'] ?? 0.5;
      if (!rngOf(c.run, 'lock', String(c.camp.stuff.chest)).chance(chance)) return 'The pick slips. The lock holds. Try again.';
    }
    addStuff(c.camp, 'chest', -1);
    const rng = rngOf(c.run, 'chest', String(c.camp.bought['chests'] ?? 0));
    c.camp.bought['chests'] = (c.camp.bought['chests'] ?? 0) + 1;
    const m = range(rng, CAMP.chest.money);
    c.run.money += m; addMat(c.run, 'ember', CAMP.chest.materials);
    if (rng.chance(0.3)) addItem(c.run.inventory, CAMP.chest.item, 1);
    return `Click! The chest holds ₽${m} and ${CAMP.chest.materials} ember.`;
  },
  capsule: (c) => {
    if (c.args.choice === 'dig') {
      const cap = c.pc.capsule;
      if (!cap) fail('Nothing is buried.');
      if (cap!.buriedIn === c.run.runId) fail('The soil is still fresh. Dig it up in a later run.');
      if (cap!.kind === 'bag') addItem(c.run.inventory, cap!.item, 1);
      else if (cap!.kind === 'mat') addMat(c.run, cap!.item, 1);
      else { c.run.looseHeld ??= {}; c.run.looseHeld[cap!.item] = (c.run.looseHeld[cap!.item] ?? 0) + 1; }
      const name = cap!.item; c.pc.capsule = null; c.pc.digs += 1;
      return `You dig up your time capsule: ${name}.`;
    }
    if (c.pc.capsule) fail('A capsule is already buried. Dig it up in a later run first.');
    const s = parseSlot(c.args.item);
    if (s.kind === 'stuff') fail('Bury a Bag, held or material item.');
    takeSlot(c.run, s);
    c.pc.capsule = { item: s.id, kind: s.kind as 'bag' | 'held' | 'mat', buriedIn: c.run.runId };
    return `${slotName(c.content, s)} is buried. Come back in a later run to dig it up.`;
  },
  parcel: (c) => parcelAction(c),
  distract: (c) => {
    const s = parseSlot(c.args.item);
    if (s.kind !== 'bag') fail('Throw a Bag item.');
    takeSlot(c.run, s);
    addTemp(c.run, CAMP.distract.effects as ArchetypeModifier[], CAMP.distract.battles, 'wild');
    return `You throw a ${itemName(c.content, s.id)}: the next wild Pokémon is distracted and hits softer.`;
  },
  altar: (c) => {
    const picks = (c.args.choice ?? '').split(',').map(Number);
    if (picks.length !== CAMP.altar.need || new Set(picks).size !== picks.length) fail(`Pick ${CAMP.altar.need} relics.`);
    const held = picks.map((i) => c.camp.relics[i]);
    if (held.some((r) => !r)) fail('No such relic.');
    if (held.some((r) => r!.cursed)) fail('Cursed relics cannot be traded. Cleanse them first.');
    const tier = Math.max(...held.map((r) => CAMP.relics.find((d) => d.id === r!.id)!.tier));
    const next = Math.min(Math.max(...CAMP.relics.map((r) => r.tier)), tier + 1);
    for (const r of held) dropEffects(c.run, CAMP.relics.find((d) => d.id === r!.id)!.effects);
    c.camp.relics = c.camp.relics.filter((_, i) => !picks.includes(i));
    const pool = CAMP.relics.filter((r) => r.tier === next && !r.curse && !c.camp.relics.some((h) => h.id === r.id));
    const pickFrom = pool.length > 0 ? pool : CAMP.relics.filter((r) => r.tier === next && !r.curse);
    const got = rngOf(c.run, 'altar', picks.join('-')).pick(pickFrom.length > 0 ? pickFrom : CAMP.relics.filter((r) => !r.curse));
    return `The altar glows. ${grantRelic(c.run, got.id, false)}`;
  },
  purify: (c) => {
    const index = Number(c.args.choice);
    const cost = CAMP.purify;
    const camp = campOf(c.run);
    // Shrine Water (from the Town's Shrine) lifts a curse for free.
    if ((camp.stuff['shrine-water'] ?? 0) > 0) {
      const msg = cleanseRelic(c.run, index);
      addStuff(camp, 'shrine-water', -1);
      return `${msg} The Shrine Water is used up.`;
    }
    if (c.run.money < cost.money) fail(`The rite costs ₽${cost.money}.`);
    for (const [id, n] of mats(cost.materials)) if ((c.run.materials[id] ?? 0) < n) fail(`The rite needs ${costText(cost.materials)}.`);
    const msg = cleanseRelic(c.run, index);
    c.run.money -= cost.money;
    for (const [id, n] of mats(cost.materials)) takeSlot(c.run, { kind: 'mat', id }, n);
    return msg;
  },
  sniffItem: (c) => {
    const s = parseSlot(c.args.item);
    const lead = c.run.party[0];
    if (!lead) fail('You have no Pokémon to sniff.');
    const cat = s.kind === 'bag' ? c.content.items.get(s.id)?.category ?? '' : c.content.catalog.get(s.id)?.family ?? '';
    const key = Object.keys(CAMP.sniffHints).find((k) => k !== 'default' && cat.toLowerCase().includes(k.toLowerCase().slice(0, 5))) ?? 'default';
    return `${nameOf(c.content, lead!)} sniffs the ${itemName(c.content, s.id)}: it ${CAMP.sniffHints[key]}.`;
  },
};

/** Adds a gadget at full uses (stackable one-use gadgets add a use). */
export function giveGadget(run: RunState, id: string): void {
  const g = getGadget(id)!;
  const camp = campOf(run);
  camp.wear[id] = g.uses === 1 ? (camp.wear[id] ?? 0) + 1 : g.uses;
  // A tune-up from the Town's Workshop adds 3 uses to a new gadget.
  if (g.uses > 1 && (camp.stuff['tune-up'] ?? 0) > 0) { camp.stuff['tune-up'] = (camp.stuff['tune-up'] ?? 0) - 1; camp.wear[id] = (camp.wear[id] ?? 0) + 3; }
}

// ---------- market ----------

/** The market's goods this stop (seeded; rerolled slots shuffle the pick). */
export function marketSlots(run: RunState): typeof CAMP.market.goods {
  const rerolls = run.camp?.done[`reroll@s${stopKey(run)}`] ?? 0;
  const rng = rngOf(run, 'market', `r${rerolls}`);
  const pool = [...CAMP.market.goods];
  return rng.shuffle(pool).slice(0, CAMP.market.slots);
}
export const marketLeft = (run: RunState, good: { id: string; limit: number }): number => good.limit - (run.camp?.bought[good.id] ?? 0);
export function mysteryOdds(): { label: string; percent: number }[] {
  const total = CAMP.market.mysteryOdds.reduce((a, o) => a + o.weight, 0);
  return CAMP.market.mysteryOdds.map((o) => ({ label: o.label, percent: Math.round((o.weight / total) * 100) }));
}
function marketBuy(c: Ctx): string {
  const choice = c.args.choice ?? '';
  if (choice === 'reroll') {
    needGadget(c.run, 'lucky-charm');
    const key = `reroll@s${stopKey(c.run)}`;
    if ((c.camp.done[key] ?? 0) >= CAMP.market.lucky) fail('The charm has already worked at this stop.');
    wear(c.run, 'lucky-charm');
    c.camp.done[key] = (c.camp.done[key] ?? 0) + 1;
    return 'The Lucky Charm glows: the market stock is shuffled.';
  }
  const slot = marketSlots(c.run).find((g) => g.id === choice);
  const token = CAMP.market.tokenGoods.find((g) => g.id === choice);
  const good = slot ?? token;
  if (!good) return fail('That is not for sale right now.');
  if (marketLeft(c.run, good) <= 0) fail('Sold out.');
  if (token) { if (c.camp.tokens < token.tokens!) fail(`Needs ${token.tokens} ${CAMP.market.tokenName}s.`); }
  else if (c.run.money < good.price!) fail(`You need ₽${good.price}.`);
  if (good.kind === 'relic') {
    const free = CAMP.relics.filter((r) => (good.curse ? !!r.curse : !r.curse) && !c.camp.relics.some((h) => h.id === r.id));
    if (free.length === 0) fail('No relic left of that kind.');
  }
  if (token) c.camp.tokens -= token.tokens!; else c.run.money -= good.price!;
  c.camp.bought[good.id] = (c.camp.bought[good.id] ?? 0) + 1;
  const n = c.camp.bought[good.id]!;
  if (good.kind === 'mystery') return openMystery(c, n);
  if (good.kind === 'mat') { addMat(c.run, good.mat!, good.amount ?? 1); return `Bought ${good.name}.`; }
  if (good.kind === 'relic') {
    const free = CAMP.relics.filter((r) => (good.curse ? !!r.curse : !r.curse) && !c.camp.relics.some((h) => h.id === r.id));
    const pick = rngOf(c.run, 'relic', `${good.id}:${n}`).pick(free);
    return `Bought a relic. ${grantRelic(c.run, pick.id, !!good.curse)}`;
  }
  if (good.stuff === 'tm') { const t = rngOf(c.run, 'tm', `${good.id}:${n}`).pick(TYPES); addStuff(c.camp, `tm-${t}`, 1); return `The crate holds a ${t} TM. It goes on your shelf.`; }
  addStuff(c.camp, good.stuff!, good.amount ?? 1);
  return `Bought ${good.name}.`;
}
function openMystery(c: Ctx, n: number): string {
  const rng = rngOf(c.run, 'mystery', String(n));
  const o = rng.weighted(CAMP.market.mysteryOdds.map((x) => ({ item: x, weight: x.weight })));
  if (o.kind === 'mats') { addMat(c.run, 'scrap', 2); addMat(c.run, 'fiber', 2); }
  else if (o.kind === 'item') addItem(c.run.inventory, o.item!, o.amount ?? 1);
  else if (o.kind === 'mat') addMat(c.run, o.mat!, 1);
  else if (o.kind === 'stuff' && o.stuff === 'tm') addStuff(c.camp, `tm-${rng.pick(TYPES)}`, 1);
  else if (o.kind === 'stuff') addStuff(c.camp, o.stuff!, 1);
  else {
    const free = CAMP.relics.filter((r) => !r.curse && !c.camp.relics.some((h) => h.id === r.id));
    if (free.length > 0) return `Mystery box: ${o.label}! ${grantRelic(c.run, rng.pick(free).id, false)}`;
    addMat(c.run, 'scrap', 3);
  }
  return `Mystery box: ${o.label}!`;
}

// ---------- parcels, wrapped gifts and letters ----------

function parcelAction(c: Ctx): string {
  const camp = c.camp;
  const choice = c.args.choice ?? '';
  if (choice.startsWith('wrap:')) {
    if (camp.parcel) fail('You are already carrying a parcel.');
    const s = parseSlot(c.args.item);
    if (s.kind !== 'bag') fail('Wrap a Bag item.');
    takeSlot(c.run, s);
    const style = choice.slice(5);
    camp.parcel = { item: s.id, sealed: true, style };
    return `You wrap the ${itemName(c.content, s.id)} in ${style} paper. Deliver it to the next stall customer.`;
  }
  if (choice === 'letter') {
    if (camp.parcel) fail('You are already carrying a parcel.');
    if ((camp.stuff.letter ?? 0) < 1) fail('You have no sealed letter.');
    addStuff(camp, 'letter', -1);
    camp.parcel = { item: 'letter', sealed: true, style: 'plain' };
    return 'You pocket the sealed letter. Deliver it unopened for moral points.';
  }
  const p = camp.parcel;
  if (!p) return fail('You carry no parcel.');
  if (choice === 'open') {
    if (!p.sealed) fail('It is already open.');
    p.sealed = false;
    camp.morality -= 1;
    if (p.item === 'letter') return `You read it. "${rngOf(c.run, 'letter').pick(CAMP.bottle.texts)}" Nobody needs to know. (Morality -1)`;
    return `You peek at the ${itemName(c.content, p.item)}. (Morality -1)`;
  }
  if (choice !== 'deliver') return fail('Wrap, take a letter, open or deliver?');
  const bonus = p.style === 'fancy' ? 0.5 : p.style === 'ribbon' ? 0.25 : 0;
  const base = p.item === 'letter' ? 80 : Math.round(price(c.content, p.item) * 0.6);
  const pay = Math.round(base * (1 + bonus)) + (p.sealed ? 20 : 0);
  c.run.money += pay;
  if (p.sealed) camp.morality += 1;
  camp.parcel = null;
  return `Delivered${p.sealed ? ' unopened' : ''}: ₽${pay}${p.sealed ? ' (Morality +1)' : ''}.`;
}

// ---------- TM shelf ----------

/** The moves a TM of this type can teach this Pokémon (a seeded few of the legal ones). */
export function shelfMoves(content: Content, run: RunState, type: string, partyIndex: number): string[] {
  const mon = run.party[partyIndex];
  if (!mon) return [];
  const legal = teachableMoves(content, mon, type);
  return rngOf(run, 'shelf', `${type}:${mon.uid}`).shuffle(legal).slice(0, CAMP.tmShelf.choices);
}
export const shelfTypes = (run: RunState): { type: string; count: number }[] => TYPES.flatMap((type) => ((run.camp?.stuff[`tm-${type}`] ?? 0) > 0 ? [{ type, count: run.camp!.stuff[`tm-${type}`]! }] : []));

// ---------- entry point ----------

/** Runs one camp action on copies of the run and the profile's camp record. Returns ok:false (and nothing changed) on a problem. */
export function campAction(content: Content, run: RunState, pcIn: CampProfile | undefined, id: string, args: CampArgs = {}): CampResult {
  const pcBefore = pcIn ?? freshCampProfile();
  const early = campProblem(content, run, id);
  const def = getAction(id);
  if (early || !def) return { run, pc: pcBefore, message: early ?? 'Unknown camp action.', ok: false };
  const next = structuredClone(run);
  const pc = structuredClone(pcBefore);
  try {
    pruneDone(next);
    const camp = campOf(next);
    const message = HANDLERS[id]!({ content, run: next, pc, camp, args, def });
    markDone(next, def);
    return { run: next, pc, message, ok: true };
  } catch (e) {
    if (e instanceof Problem) return { run, pc: pcBefore, message: e.message, ok: false };
    throw e;
  }
}

export const ACTION_HANDLER_IDS = Object.keys(HANDLERS);

// ---------- journal, scenarios, labels, sorting, skill throws ----------

/** An example of when to use the item (F131), from its category. */
export function itemScenario(content: Content, itemId: string): string {
  const cat = content.items.get(itemId)?.category ?? '';
  const fam = content.catalog.get(itemId)?.family ?? '';
  const hay = `${cat} ${fam}`.toLowerCase();
  const key = Object.keys(CAMP.scenarios).find((k) => k !== 'default' && hay.includes(k.toLowerCase().split(' ')[0]!.replace(/s$/, '')));
  return CAMP.scenarios[key ?? 'default']!;
}

/** The first use of an item narrates a journal line, once per run and once ever in the profile list (I223). Returns the line or ''. */
export function recordFirstUse(content: Content, run: RunState, pc: CampProfile, itemId: string, monName: string): string {
  const camp = campOf(run);
  camp.recent = [itemId, ...camp.recent.filter((x) => x !== itemId)].slice(0, 12);
  if (camp.journal.includes(itemId)) return '';
  camp.journal.push(itemId);
  const name = itemName(content, itemId);
  const key = Object.keys(CAMP.narration).find((k) => k !== 'default' && name.toLowerCase().includes(k.toLowerCase())) ?? Object.keys(CAMP.narration).find((k) => k !== 'default' && (content.items.get(itemId)?.category ?? '').toLowerCase().includes(k.toLowerCase())) ?? 'default';
  if (!pc.journal.includes(itemId)) pc.journal.push(itemId);
  return CAMP.narration[key]!.replace('{item}', name).replace('{mon}', monName);
}

export const labelOf = (run: RunState, itemId: string): string | null => run.camp?.labels[itemId] ?? null;

/** Bag order for a sort mode (type = pocket order, rarity = rarest first, recent = last used first). */
export function sortKey(run: RunState, sort: CampState['bagSort'], e: { itemId: string; pocket: string; name: string; rarity?: string | null }): string {
  const rank = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 } as Record<string, number>;
  const recent = (run.camp?.recent ?? []).indexOf(e.itemId);
  if (sort === 'name') return e.name;
  if (sort === 'rarity') return `${rank[e.rarity ?? 'common'] ?? 5}${e.name}`;
  if (sort === 'recent') return `${String(recent < 0 ? 99 : recent).padStart(2, '0')}${e.name}`;
  return `${e.pocket}${e.name}`;
}

/** Uses the launcher for one throw (mutates `run`); false when it is off or worn out. */
export function launcherReady(run: RunState): boolean {
  return !!run.camp?.launcher && hasGadget(run, 'launcher') && gadgetUses(run, 'launcher') > 0;
}
export function wearLauncher(run: RunState): void { wear(run, 'launcher'); }
