// Party Personality & Chemistry (APPROVED.md §1, §9, §10). Personalities, pairwise chemistry that grows
// from shared experiences, the scenes between nodes (with choices, callbacks and repetition protection),
// grudges, revenge pacts, gifts, debriefs and the scrapbook. Pure and deterministic: every roll comes from
// a generator seeded by the run seed and the transition, so reloading shows the same scene.

import { adjustBond, bondOf } from '../bond';
import type { BattleEvent } from '../battle/engine';
import type { Content } from '../contentSchema';
import { layEgg } from '../eggs';
import { changeFriendship } from '../friendship';
import { addItem } from '../items';
import { findNode } from '../map';
import { maxHp } from '../pokemon';
import { Rng, hashSeed } from '../rng';
import type { PokemonInstance, RunState } from '../state';
import { PARTY_LIFE, createPartyLife, type Pair, type PartyLifeState, type Personality, type Scene, type SceneEffect, type Vignette } from './schema';

export * from './schema';
const RULES = PARTY_LIFE.rules;
const BOSS_KINDS = ['gym', 'elite', 'champion'];

const fnv = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
const life = (run: RunState): PartyLifeState => (run.partyLife ??= createPartyLife());
const nameOf = (content: Content, mon: PokemonInstance) => content.species.get(mon.speciesId)?.name ?? mon.speciesId;
const speciesName = (content: Content, id: string) => content.species.get(id)?.name ?? id;
const find = (run: RunState, uid: string) => run.party.find((m) => m.uid === uid) ?? run.box.find((m) => m.uid === uid);

// ---------- personalities ----------

export interface PersonalityView {
  trait: string;
  label: string;
  blurb: string;
  quirk: string;
  /** What it says about being left in the box (used by the sulk scene). */
  sulk: string;
}

export const personalityData = (trait: string): Personality => PARTY_LIFE.personalities[trait] ?? PARTY_LIFE.personalities.patient!;

/** Who this Pokémon is: a trait (the Bond Engine's, from its id) and a quirk, so two of one species differ. */
export function personalityOf(run: RunState, mon: PokemonInstance): PersonalityView {
  const trait = bondOf(run, mon.uid).trait;
  const p = personalityData(trait);
  return { trait, label: p.label, blurb: p.blurb, quirk: PARTY_LIFE.quirks[fnv(`${mon.uid}:quirk`) % PARTY_LIFE.quirks.length]!, sulk: p.sulk };
}

const traitOf = (run: RunState, uid: string): string => bondOf(run, uid).trait;

// ---------- pairs and relationship stages ----------

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function stageIndex(points: number): number {
  let s = 0;
  PARTY_LIFE.stages.forEach((st, i) => {
    if (points >= st.at) s = i;
  });
  return s;
}
export const stageName = (points: number): string => PARTY_LIFE.stages[stageIndex(points)]!.name;

function pairFor(run: RunState, a: string, b: string): Pair {
  const state = life(run);
  const key = pairKey(a, b);
  let pair = state.pairs.find((p) => p.key === key);
  if (!pair) {
    const [x, y] = a < b ? [a, b] : [b, a];
    pair = { key, a: x, b: y, points: 0, tension: 0, stageSeen: 0, memories: [], lastScene: -99 };
    state.pairs.push(pair);
  }
  return pair;
}
/** A read-only look at a pair (no record is created). */
export const peekPair = (run: RunState, a: string, b: string): Pair | undefined => run.partyLife?.pairs.find((p) => p.key === pairKey(a, b));

/** How two personalities get along on paper. */
export function affinityOf(run: RunState, a: string, b: string): 'warm' | 'clash' | 'neutral' {
  const ta = traitOf(run, a);
  const tb = traitOf(run, b);
  if (personalityData(ta).clash.includes(tb) || personalityData(tb).clash.includes(ta) || (ta === tb && ['stubborn', 'proud', 'competitive'].includes(ta))) return 'clash';
  if (personalityData(ta).warm.includes(tb) || personalityData(tb).warm.includes(ta)) return 'warm';
  return 'neutral';
}

/** A short word for the pair: best friends, friendly competitors, reluctant partners, or indifferent. */
export function relationLabel(run: RunState, a: string, b: string): string {
  const pair = peekPair(run, a, b);
  const pts = pair?.points ?? 0;
  const tension = pair?.tension ?? 0;
  const rival = pair?.memories.some((m) => m.tag === 'contest') || tension >= RULES.tensionRival;
  if (rival && pts >= PARTY_LIFE.stages[1]!.at) return tension >= RULES.tensionTense ? 'Heated rivals' : 'Friendly competitors';
  if (pts >= PARTY_LIFE.stages[3]!.at) return 'Best friends';
  if (pts >= PARTY_LIFE.stages[1]!.at && affinityOf(run, a, b) === 'clash') return 'Reluctant partners';
  if (pts >= PARTY_LIFE.stages[2]!.at) return 'Close friends';
  if (pts < PARTY_LIFE.stages[1]!.at && tension === 0) return 'Indifferent';
  return 'Getting to know each other';
}

function addChem(run: RunState, a: string, b: string, points: number, tension = 0): number {
  if (a === b) return 0;
  const pair = pairFor(run, a, b);
  const before = pair.points;
  pair.points = Math.max(0, Math.min(RULES.chemCap, pair.points + points));
  pair.tension = Math.max(0, Math.min(100, pair.tension + tension));
  const stage = stageIndex(pair.points);
  if (stage > pair.stageSeen) {
    pair.stageSeen = stage;
    life(run).ctx.milestones.push(`${pair.key}|${PARTY_LIFE.stages[stage]!.id}`);
  }
  return pair.points - before;
}

/** Strongest relationship stage a Pokémon has with anyone in the party (0 to 4). */
export const bestStage = (run: RunState, uid: string): number => Math.max(0, ...run.party.filter((m) => m.uid !== uid).map((m) => stageIndex(peekPair(run, uid, m.uid)?.points ?? 0)));

/** The party's atmosphere, read from its members' personalities (not a number of its own). */
export function partyCulture(run: RunState): { id: string; name: string; blurb: string } {
  const tally = new Map<string, number>();
  for (const m of run.party) for (const c of PARTY_LIFE.culture) if (c.traits.includes(traitOf(run, m.uid))) tally.set(c.id, (tally.get(c.id) ?? 0) + 1);
  const best = [...PARTY_LIFE.culture].sort((x, y) => (tally.get(y.id) ?? 0) - (tally.get(x.id) ?? 0))[0]!;
  return best;
}

// ---------- gathering what happened (called by the run) ----------

function sync(run: RunState): void {
  const state = life(run);
  const n = run.encountersCompleted;
  const first = Object.keys(state.known).length === 0;
  for (const m of run.party) {
    const seen = state.known[m.uid];
    if (!seen) {
      state.known[m.uid] = { species: m.speciesId, joined: n };
      if (!first) state.ctx.newcomers.push(m.uid);
    } else if (seen.species !== m.speciesId) {
      seen.species = m.speciesId;
      state.ctx.evolved.push(m.uid);
      for (const o of run.party) if (o.uid !== m.uid) addChem(run, m.uid, o.uid, RULES.shared.evolve);
    }
    const h = run.story.histories[m.uid];
    state.ctx.ccBase[m.uid] ??= h?.closeCalls ?? 0;
    state.ctx.aidBase[m.uid] ??= h?.hyper['came-to-aid'] ?? 0;
  }
}

/** After a turn: who fainted to which species (grudges, pacts) and who knocked out foes. */
export function partyLifeTurn(content: Content, run: RunState, events: readonly BattleEvent[]): void {
  sync(run);
  const state = life(run);
  const battle = run.battle;
  if (!battle) return;
  const foeSpecies = battle.enemyTeam[battle.enemyIndex]?.speciesId ?? '';
  for (const e of events) {
    if (e.type === 'faint' && e.side === 'player') {
      state.ctx.faints.push({ uid: e.uid, foe: foeSpecies });
      const key = `${e.uid}|${foeSpecies}`;
      state.lost[key] = (state.lost[key] ?? 0) + 1;
      const boss = battle.trainer ? BOSS_KINDS.includes(currentNodeKind(run) ?? '') : false;
      if ((state.lost[key]! >= RULES.grudgeAfterFaints || boss) && !state.grudges.some((g) => g.uid === e.uid && g.species === foeSpecies && !g.settled)) {
        state.grudges.push({ uid: e.uid, species: foeSpecies, since: run.encountersCompleted, settled: false });
      }
      // A close teammate (Close or better) swears to avenge it.
      const avenger = run.party
        .filter((m) => m.uid !== e.uid && m.hp > 0 && stageIndex(peekPair(run, e.uid, m.uid)?.points ?? 0) >= RULES.pactMinStage)
        .sort((x, y) => (peekPair(run, e.uid, y.uid)?.points ?? 0) - (peekPair(run, e.uid, x.uid)?.points ?? 0))[0];
      if (avenger && !state.pacts.some((p) => p.uid === avenger.uid && p.species === foeSpecies)) {
        state.pacts.push({ uid: avenger.uid, forUid: e.uid, species: foeSpecies, until: run.encountersCompleted + RULES.pactBattles });
      }
    } else if (e.type === 'faint' && e.side === 'enemy') {
      for (const uid of e.participants) {
        state.ctx.kos[uid] = (state.ctx.kos[uid] ?? 0) + 1;
        const g = state.grudges.find((x) => x.uid === uid && !x.settled && x.species === (battle.enemyTeam.find((m) => m.uid === e.uid)?.speciesId ?? ''));
        if (g) {
          g.settled = true;
          state.ctx.settled.push(`${uid}|${g.species}`);
        }
      }
    }
  }
}

function currentNodeKind(run: RunState): string | null {
  const stage = run.stage;
  if (!stage?.current) return null;
  try {
    return findNode(stage.map, stage.current).kind;
  } catch {
    return null;
  }
}

/** A won battle: chemistry grows only when the fight meant something (a boss, a close call, a rescue). */
export function partyLifeVictory(content: Content, run: RunState): void {
  sync(run);
  const state = life(run);
  const n = run.encountersCompleted;
  const fought = Object.values(run.story.histories).filter((h) => h.lastBattle === n && run.party.some((m) => m.uid === h.uid)).map((h) => h.uid);
  const boss = BOSS_KINDS.includes(currentNodeKind(run) ?? '');
  state.ctx.won += 1;
  state.ctx.boss ||= boss;
  state.ctx.fought = fought;
  state.ctx.close = fought.filter((uid) => (run.story.histories[uid]?.closeCalls ?? 0) > (state.ctx.ccBase[uid] ?? 0));
  const aided = new Set(fought.filter((uid) => (run.story.histories[uid]?.hyper['came-to-aid'] ?? 0) > (state.ctx.aidBase[uid] ?? 0)));
  for (let i = 0; i < fought.length; i++) {
    for (let j = i + 1; j < fought.length; j++) {
      const a = fought[i]!;
      const b = fought[j]!;
      let pts = 0;
      if (state.ctx.close.includes(a) || state.ctx.close.includes(b)) pts += RULES.shared.closeCall;
      if (boss) pts += RULES.shared.boss;
      if (aided.has(a) || aided.has(b)) pts += RULES.shared.aid;
      if (pts > 0) addChem(run, a, b, pts);
    }
  }
  // Boxed Pokémon sit out the victory.
  for (const m of run.box) state.bench[m.uid] = (state.bench[m.uid] ?? 0) + 1;
  for (const m of run.party) delete state.bench[m.uid];
  state.pacts = state.pacts.filter((p) => p.until >= n);
}

/** A rest stop was used: the next scene may be a campfire. */
export function partyLifeCamp(run: RunState): void {
  life(run).ctx.camp = true;
}

// ---------- battle hooks (read by core/story/moments.ts) ----------

export interface BattleLife {
  /** The lead carries a grudge against this foe species. */
  grudge: boolean;
  /** The lead has met this species in at least `recognizeAfter` battles. */
  recognizes: boolean;
  /** A teammate has sworn a pact against this species (the one who swore it). */
  pact: string | null;
  /** The lead's closest healthy teammate when they are Inseparable or better. */
  synergy: string | null;
}

export function battleLife(content: Content, run: RunState, lead: PokemonInstance, foeSpecies: string): BattleLife {
  const state = run.partyLife;
  const history = run.story.histories[lead.uid];
  const grudge = !!state?.grudges.some((g) => g.uid === lead.uid && g.species === foeSpecies && !g.settled);
  const pact = state?.pacts.find((p) => p.uid === lead.uid && p.species === foeSpecies && p.until >= run.encountersCompleted)?.uid ?? null;
  const partner = run.party
    .filter((m) => m.uid !== lead.uid && m.hp > 0)
    .map((m) => ({ m, s: stageIndex(peekPair(run, lead.uid, m.uid)?.points ?? 0) }))
    .filter((x) => x.s >= RULES.synergyMinStage)
    .sort((a, b) => b.s - a.s)[0];
  void content;
  return { grudge, recognizes: (history?.foes[foeSpecies] ?? 0) >= RULES.recognizeAfter, pact, synergy: partner?.m.uid ?? null };
}

// ---------- scenes ----------

/** The kind of place the party is walking through, from the stage theme's types. */
export function environmentOf(content: Content, run: RunState): string {
  const theme = run.stage ? content.themes.get(run.stage.themeId) : null;
  const t = theme?.types[Math.abs(fnv(`${run.seed}:${run.stage?.index ?? 0}:${run.regionIndex}`)) % theme.types.length] ?? 'normal';
  return PARTY_LIFE.envByType[t] ?? 'road';
}
const weatherOf = (env: string): 'rain' | 'snow' | 'heat' | 'wind' | null => {
  const w = PARTY_LIFE.envWeather[env] ?? (['rain', 'snow', 'heat', 'wind'].includes(env) ? env : undefined);
  return (w as 'rain' | 'snow' | 'heat' | 'wind' | undefined) ?? null;
};

function leaderTypes(content: Content, run: RunState): string[] | null {
  const id = run.stage?.leaderId;
  return id ? content.bosses.get(id)?.types ?? null : null;
}

function matchWho(content: Content, run: RunState, mon: PokemonInstance, who: Vignette['a'], opts: { fainted: boolean }): boolean {
  if (!who) return true;
  const state = life(run);
  const species = content.species.get(mon.speciesId);
  if (who.traits && !who.traits.includes(traitOf(run, mon.uid))) return false;
  if (who.hurt !== undefined && !(mon.hp > 0 && mon.hp <= maxHp(content, mon) * who.hurt)) return false;
  if (who.fainted !== undefined && who.fainted !== (opts.fainted || mon.hp <= 0)) return false;
  if (who.fainted === undefined && mon.hp <= 0) return false;
  if (who.small && !(species && (species.weight ?? 99) <= RULES.smallWeight)) return false;
  if (who.big && !(species && (species.weight ?? 0) >= RULES.bigWeight)) return false;
  if (who.ghost && !species?.types.includes('ghost')) return false;
  if (who.affection !== undefined && bondOf(run, mon.uid).affection < who.affection) return false;
  if (who.evolved && !state.ctx.evolved.includes(mon.uid)) return false;
  if (who.newcomer && !state.ctx.newcomers.includes(mon.uid)) return false;
  if (who.recent && !((state.known[mon.uid]?.joined ?? -99) >= run.encountersCompleted - 6 && (state.known[mon.uid]?.joined ?? 0) > 0)) return false;
  return true;
}

const hasDamaging = (content: Content, mon: PokemonInstance) => mon.moves.some((m) => (content.moves.get(m.id)?.power ?? 0) > 0);

interface Pick {
  v: Vignette;
  a: PokemonInstance;
  b?: PokemonInstance;
  weight: number;
  foe?: string;
  mem?: { tag: string; text: string };
}

function candidates(content: Content, run: RunState, ctx: Vignette['ctx'], env: string): Pick[] {
  const state = life(run);
  const out: Pick[] = [];
  const living = run.party.filter((m) => m.hp > 0);
  const recent = state.recent;
  const base = (v: Vignette) => v.weight * (recent.includes(v.id) ? (recent.indexOf(v.id) >= recent.length - 4 ? 0 : 0.15) : 1);
  const list = PARTY_LIFE.vignettes.filter((v) => v.ctx === ctx);
  for (const v of list) {
    if (base(v) <= 0) continue;
    if (v.env && !v.env.includes(env) && !v.env.includes(weatherOf(env) ?? '')) continue;
    if (v.action === 'hint' && !leaderTypes(content, run)) continue;
    if (v.debrief === 'close' && state.ctx.close.length === 0) continue;
    if (v.who === 'party') {
      const fallen = v.b?.fainted ? find(run, state.ctx.faints[0]?.uid ?? '') : undefined;
      if (v.b?.fainted ? !fallen || living.length < 1 : living.length < 2) continue;
      const pool = living.filter((m) => m.uid !== fallen?.uid);
      const a = pool[fnv(`${run.seed}:${v.id}:${run.encountersCompleted}`) % pool.length]!;
      out.push({ v, a, b: fallen ?? pool.find((m) => m.uid !== a.uid), weight: base(v) });
      continue;
    }
    if (v.who === 'solo') {
      const pool = ctx === 'sulk' ? run.box.filter((m) => (state.bench[m.uid] ?? 0) >= RULES.sulkAfter) : ctx === 'grudge' ? living : living;
      for (const a of pool) {
        if (!matchWho(content, run, a, v.a, { fainted: false })) continue;
        if (v.action === 'gift' && !(bondOf(run, a.uid).affection >= RULES.giftMinAffection)) continue;
        if (v.action === 'forget' && !forgettable(content, a)) continue;
        let foe: string | undefined;
        if (ctx === 'grudge') {
          const g = v.settled ? state.ctx.settled.find((s) => s.startsWith(`${a.uid}|`))?.split('|')[1] : state.grudges.find((x) => x.uid === a.uid && !x.settled)?.species;
          if (!g) continue;
          foe = g;
        }
        out.push({ v, a, weight: base(v) * (1 + bondOf(run, a.uid).affection / 100), foe });
      }
      continue;
    }
    if (v.who === 'pact') {
      for (const f of state.ctx.faints) {
        const pact = state.pacts.find((p) => p.forUid === f.uid && p.species === f.foe);
        const a = pact && run.party.find((m) => m.uid === pact.uid && m.hp > 0);
        const b = find(run, f.uid);
        if (a && b) out.push({ v, a, b, weight: base(v), foe: f.foe });
      }
      continue;
    }
    // pairs
    const bs = v.b?.fainted ? [...run.party, ...run.box] : run.party;
    for (const a of living) {
      if (!matchWho(content, run, a, v.a, { fainted: false })) continue;
      for (const b of bs) {
        if (a.uid === b.uid) continue;
        if (!v.b?.fainted && b.hp <= 0) continue;
        const fainted = state.ctx.faints.some((f) => f.uid === b.uid);
        if (v.b?.fainted && !fainted) continue;
        if (!matchWho(content, run, b, v.b, { fainted })) continue;
        if (v.both?.damaging && !(hasDamaging(content, a) && hasDamaging(content, b))) continue;
        if (v.action === 'berry' && !(v.b?.hurt && b.hp > 0)) continue;
        if (v.action === 'forget') continue;
        const pair = peekPair(run, a.uid, b.uid);
        const stage = stageIndex(pair?.points ?? 0);
        if (v.stage && (stage < v.stage[0] || stage > v.stage[1])) continue;
        const aff = affinityOf(run, a.uid, b.uid);
        if (v.affinity && v.affinity !== aff) continue;
        const tension = pair?.tension ?? 0;
        const rivalFriendly = (pair?.memories.some((m) => m.tag === 'contest') || ['competitive', 'proud'].some((t) => [traitOf(run, a.uid), traitOf(run, b.uid)].includes(t))) && tension < RULES.tensionTense;
        if (v.rivalry === 'friendly' && !rivalFriendly) continue;
        if (v.rivalry === 'tense' && tension < RULES.tensionTense) continue;
        let mem: Pick['mem'];
        if (v.mem) {
          const m = pair?.memories.find((x) => (v.mem === '*' || x.tag === v.mem) && x.used < 2);
          if (!m) continue;
          mem = m;
        }
        let w = base(v);
        if (pair && run.encountersCompleted - pair.lastScene < RULES.pairCooldown) w *= 0.2;
        if (!mem && aff === 'warm') w *= 1.2;
        out.push({ v, a, b, weight: w, mem, foe: state.ctx.faints.find((f) => f.uid === b.uid)?.foe });
      }
    }
  }
  return out.filter((p) => p.weight > 0);
}

function forgettable(content: Content, mon: PokemonInstance): string | null {
  if (mon.moves.length < 3) return null;
  const weak = [...mon.moves].map((m) => ({ id: m.id, p: content.moves.get(m.id)?.power ?? 0 })).sort((x, y) => (x.p || 999) - (y.p || 999))[0];
  return weak ? weak.id : null;
}

function format(text: string, vars: Record<string, string>): string {
  let out = text;
  for (let pass = 0; pass < 2; pass++) out = out.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
  return out;
}

function buildScene(content: Content, run: RunState, pick: Pick, key: string, rng: Rng, env: string): Scene {
  const { v, a, b } = pick;
  const pa = personalityData(traitOf(run, a.uid));
  const weather = weatherOf(env);
  const types = leaderTypes(content, run) ?? [];
  const vars: Record<string, string> = {
    A: nameOf(content, a),
    B: b ? nameOf(content, b) : '',
    foe: pick.foe ? speciesName(content, pick.foe) : '',
    mem: pick.mem ? format(pick.mem.text, { A: nameOf(content, a), B: b ? nameOf(content, b) : '' }) : '',
    type: types[0] ? types[0][0]!.toUpperCase() + types[0].slice(1) : 'mysterious',
    sulk: pa.sulk,
    weatherA: weather ? pa.weather[weather] : `${nameOf(content, a)} trots along, content.`,
    poses: run.party.map((m) => `${nameOf(content, m)}: ${personalityData(traitOf(run, m.uid)).pose}.`).join(' '),
    sayA: v.voice ? pa.say[v.voice] ?? '' : '',
    gift: '',
    move: '',
  };
  const scene: Scene = { id: v.id, key, caption: '', uids: [a.uid, ...(b ? [b.uid] : [])], lines: [], choices: [], dflt: v.dflt ?? 0 };
  if (pick.foe) scene.foe = pick.foe;
  if (v.action === 'gift') {
    scene.gift = rng.pick(pa.gifts);
    vars.gift = content.items.get(scene.gift)?.name ?? scene.gift;
  }
  if (v.action === 'forget') {
    scene.move = forgettable(content, a) ?? undefined;
    vars.move = scene.move ? content.moves.get(scene.move)?.name ?? scene.move : '';
  }
  if (v.action === 'hide') scene.hidden = rng.int(0, 2);
  scene.lines = v.text.map((t) => format(t, vars)).filter((t) => t.length > 0);
  scene.choices = (v.choices ?? []).map((c) => ({ label: format(c.label, vars), text: format(c.text, vars) }));
  scene.caption = format(v.caption, vars);
  return scene;
}

const CTX_ORDER: { ctx: Vignette['ctx']; chance: number }[] = [
  { ctx: 'faint', chance: 1 },
  { ctx: 'prebattle', chance: 1 },
  { ctx: 'evolve', chance: 1 },
  { ctx: 'newcomer', chance: 1 },
  { ctx: 'boss', chance: 1 },
  { ctx: 'win', chance: 0.6 },
  { ctx: 'camp', chance: 1 },
  { ctx: 'grudge', chance: 0.5 },
  { ctx: 'sulk', chance: 0.5 },
];

/** The upcoming node is a boss (the party huddles before it). */
function bossAhead(run: RunState): boolean {
  const stage = run.stage;
  if (!stage || run.phase !== 'map') return false;
  const from = stage.current ? stage.map.nodes.find((n) => n.id === stage.current) : null;
  const ahead = from ? stage.map.nodes.filter((n) => from.next.includes(n.id)) : stage.map.nodes.filter((n) => n.column === 0);
  return ahead.length > 0 && ahead.every((n) => BOSS_KINDS.includes(n.kind));
}

function milestoneScene(content: Content, run: RunState, key: string): Scene | null {
  const state = life(run);
  while (state.ctx.milestones.length > 0) {
    const [a, b, stageId] = state.ctx.milestones.shift()!.split(/\|/);
    const ma = a && find(run, a);
    const mb = b && find(run, b);
    const line = PARTY_LIFE.milestones[stageId ?? ''];
    if (ma && mb && line && run.party.some((m) => m.uid === a) && run.party.some((m) => m.uid === b)) {
      const vars = { A: nameOf(content, ma), B: nameOf(content, mb) };
      return { id: `milestone-${stageId}`, key, caption: format(line, vars), uids: [ma.uid, mb.uid], lines: [format(line, vars)], choices: [], dflt: 0, milestone: stageId };
    }
  }
  return null;
}

/**
 * Looks at what happened since the last transition and, once per transition, queues one scene for the map
 * to show (or none: a short walk is better than a forced scene). Safe to call again; reloading gives the same result.
 */
export function ensureScene(content: Content, run: RunState): Scene | null {
  const state = life(run);
  if (run.phase !== 'map' || !run.stage) return state.scene;
  const key = `${run.regionIndex}.${run.stage.index}.${run.stage.current ?? 'start'}.${run.encountersCompleted}`;
  if (state.rolledFor === key || state.scene) return state.scene;
  state.rolledFor = key;
  sync(run);
  const rng = new Rng(hashSeed(`${run.seed}::party::${key}`));
  const env = environmentOf(content, run);
  let scene = milestoneScene(content, run, key);
  const ctxGroups = bossAhead(run) ? [{ ctx: 'prebattle' as const, chance: 1 }, ...CTX_ORDER] : CTX_ORDER;
  const tried = new Set<string>();
  for (const { ctx, chance } of scene ? [] : ctxGroups) {
    if (tried.has(ctx)) continue;
    tried.add(ctx);
    const wanted =
      ctx === 'faint' ? state.ctx.faints.length > 0 : ctx === 'prebattle' ? bossAhead(run) && run.partyLife!.photoAt < run.encountersCompleted : ctx === 'evolve' ? state.ctx.evolved.length > 0 : ctx === 'newcomer' ? state.ctx.newcomers.length > 0
        : ctx === 'boss' ? state.ctx.boss : ctx === 'win' ? state.ctx.won > 0 : ctx === 'camp' ? state.ctx.camp : ctx === 'grudge' ? state.grudges.length > 0 : run.box.length > 0;
    if (!wanted) continue;
    const pool = candidates(content, run, ctx, env);
    if (pool.length === 0 || !rng.chance(chance)) continue;
    // A pact scene outranks the plain gathering.
    const pact = pool.filter((p) => p.v.who === 'pact');
    const chosen = rng.weighted((pact.length ? pact : pool).map((p) => ({ item: p, weight: p.weight })));
    scene = buildScene(content, run, chosen, key, rng, env);
    break;
  }
  if (!scene && rng.chance(RULES.sceneChance)) {
    const pool = candidates(content, run, 'any', env);
    if (pool.length > 0) scene = buildScene(content, run, rng.weighted(pool.map((p) => ({ item: p, weight: p.weight }))), key, rng, env);
  }
  state.scene = scene;
  // What was just used up: the context is spent whether or not a scene came of it.
  const keepMilestones = state.ctx.milestones;
  state.ctx = { ...createPartyLife().ctx, ccBase: {}, aidBase: {}, milestones: keepMilestones };
  sync(run);
  state.ctx.newcomers = [];
  state.ctx.evolved = [];
  return scene;
}

function applyEffect(content: Content, run: RunState, scene: Scene, e: SceneEffect, fits: string[] | undefined): number {
  const [aUid, bUid] = scene.uids;
  const a = aUid ? find(run, aUid) : undefined;
  const b = bUid ? find(run, bUid) : undefined;
  let gained = 0;
  const fit = !!fits && scene.uids.some((u) => fits.includes(traitOf(run, u)));
  if (a && b && (e.chem || e.tension)) gained = addChem(run, a.uid, b.uid, (e.chem ?? 0) * (fit && (e.chem ?? 0) > 0 ? 2 : 1), e.tension ?? 0);
  for (const m of [a, b]) {
    if (!m) continue;
    const bond = bondOf(run, m.uid);
    adjustBond(bond, { affection: e.aff ?? 0, trust: e.trust ?? 0 });
    if (e.friendship) changeFriendship(content, m, e.friendship);
  }
  if (e.heal && b && b.hp > 0) b.hp = Math.min(maxHp(content, b), b.hp + Math.round(maxHp(content, b) * e.heal));
  return gained;
}

export interface SceneResult {
  lines: string[];
  chemDelta: number;
}

const BERRIES = ['oran-berry', 'sitrus-berry'];

/** The player's answer (or null to dismiss: the scene's default choice). Applies the scene once and saves it to the scrapbook. */
export function resolveScene(content: Content, run: RunState, choice: number | null): SceneResult | null {
  const state = life(run);
  const scene = state.scene;
  if (!scene) return null;
  state.scene = null;
  const v = PARTY_LIFE.vignettes.find((x) => x.id === scene.id);
  const lines: string[] = [];
  let chem = 0;
  const [aUid, bUid] = scene.uids;
  const a = aUid ? find(run, aUid) : undefined;
  const b = bUid ? find(run, bUid) : undefined;
  const nm = (m?: PokemonInstance) => (m ? nameOf(content, m) : '');
  if (!v) {
    // A milestone scene: the stage is the news.
    chem = 0;
  } else {
    const idx = v.choices?.length ? (choice !== null && choice >= 0 && choice < v.choices.length ? choice : scene.dflt) : -1;
    const picked = idx >= 0 ? v.choices![idx]! : undefined;
    const effect = picked?.effect ?? v.effect ?? {};
    if (picked) lines.push(format(picked.text, { A: nm(a), B: nm(b) }));
    if (picked && picked.fits && scene.uids.some((u) => picked.fits!.includes(traitOf(run, u)))) lines.push('It was just what they needed.');
    chem = applyEffect(content, run, scene, effect, picked?.fits);
    if (a && b) {
      const pair = pairFor(run, a.uid, b.uid);
      pair.lastScene = run.encountersCompleted;
      if (v.mem) {
        const m = pair.memories.find((x) => v.mem === '*' || x.tag === v.mem);
        if (m) m.used += 1;
      }
      if (v.remember) {
        pair.memories = [...pair.memories.filter((m) => m.tag !== v.remember!.tag), { tag: v.remember.tag, text: v.remember.text, at: run.encountersCompleted, used: 0 }].slice(-RULES.memoryLimit);
      }
    }
    switch (v.action) {
      case 'gift':
        if (scene.gift) {
          addItem(run.inventory, scene.gift, 1);
          lines.push(`You received a ${content.items.get(scene.gift)?.name ?? scene.gift}.`);
        }
        break;
      case 'berry': {
        const berry = BERRIES.find((id) => (run.inventory[id] ?? 0) > 0);
        if (berry) {
          run.inventory[berry] = run.inventory[berry]! - 1;
          if (run.inventory[berry] === 0) delete run.inventory[berry];
          lines.push(`${nm(a)} used a ${content.items.get(berry)?.name ?? berry} from your Bag.`);
        } else lines.push(`${nm(a)} found a wild berry on the way.`);
        break;
      }
      case 'forget':
        if (idx === 1 && a && scene.move && a.moves.length > 2) {
          a.moves = a.moves.filter((m) => m.id !== scene.move);
          lines.push(`${nm(a)} forgot ${content.moves.get(scene.move)?.name ?? scene.move}.`);
        }
        break;
      case 'hide': {
        const found = picked?.spot === scene.hidden;
        lines.push(found ? `${nm(a)} was right there, giggling!` : `Nothing here. ${nm(a)} pops out from behind you instead.`);
        if (found) {
          const reward = PARTY_LIFE.hideRewards[fnv(`${run.seed}:${scene.key}`) % PARTY_LIFE.hideRewards.length]!;
          addItem(run.inventory, reward, 1);
          lines.push(`It was holding a ${content.items.get(reward)?.name ?? reward}.`);
        }
        break;
      }
      case 'egg':
        if (idx === 0) {
          const options = PARTY_LIFE.babies.filter((id) => content.species.has(id));
          if (options.length > 0) {
            const rng = new Rng(hashSeed(`${run.seed}::party-egg::${scene.key}`));
            layEgg(content, run, rng.pick(options), { level: 5, left: 3, unit: 'battle', source: 'Adopted Baby' }, rng);
          }
        }
        break;
      case 'reassure':
        if (idx === 0 && a) delete state.bench[a.uid];
        break;
      case 'photo':
        takePhoto(content, run, scene.caption);
        break;
      default:
        break;
    }
  }
  if (scene.milestone && a && b) {
    pushScrap(run, 'milestone', scene.caption, scene.uids, 0, []);
  } else if (v && v.action !== 'photo') {
    pushScrap(run, v.ctx === 'any' ? 'travel' : v.ctx, scene.caption, scene.uids, chem, []);
  }
  state.recent = [...state.recent, scene.id].slice(-RULES.recentLimit);
  return { lines, chemDelta: chem };
}

function pushScrap(run: RunState, kind: string, caption: string, uids: string[], delta: number, poses: string[]): void {
  const state = life(run);
  state.scrapbook.push({ id: `${kind}-${run.encountersCompleted}-${state.scrapbook.length}`, n: run.encountersCompleted, region: run.regionIndex, stage: run.stage?.index ?? 0, kind, caption, uids, delta, poses });
  if (state.scrapbook.length > RULES.scrapbookLimit) state.scrapbook.splice(0, state.scrapbook.length - RULES.scrapbookLimit);
}

function takePhoto(content: Content, run: RunState, caption: string): void {
  const poses = run.party.map((m) => `${nameOf(content, m)}: ${personalityData(traitOf(run, m.uid)).pose}`);
  pushScrap(run, 'photo', caption || 'Team photo', run.party.map((m) => m.uid), 0, poses);
  life(run).photoAt = run.encountersCompleted;
}

/** A team photo from the Scrapbook screen (once per battle completed). */
export function teamPhoto(content: Content, run: RunState): boolean {
  const state = life(run);
  if (state.photoAt >= run.encountersCompleted || run.party.length === 0) return false;
  takePhoto(content, run, `Team photo in region ${run.regionIndex + 1}, stage ${(run.stage?.index ?? 0) + 1}.`);
  return true;
}

/** One line per teammate for the Bonds screen: how this Pokémon gets on with the others. */
export function relationLines(content: Content, run: RunState, mon: PokemonInstance): string[] {
  return run.party
    .filter((o) => o.uid !== mon.uid)
    .map((o) => `${nameOf(content, o)}: ${relationLabel(run, mon.uid, o.uid)} (${stageName(peekPair(run, mon.uid, o.uid)?.points ?? 0)})`);
}
