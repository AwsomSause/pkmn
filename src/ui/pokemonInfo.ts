// What the Pokémon screen (pokemonMenu.ts) shows besides what summaryLook.ts already
// works out: battle readiness, a stat comparison, move effect lines, the bond and the
// battle history. Pure (no Phaser, no RNG) so tests can read it.

import { bondMood, bondOf } from '../core/bond';
import type { Content, MoveSchema, StatName } from '../core/contentSchema';
import type { z } from 'zod';
import { friendshipHearts } from '../core/friendship';
import { partyRoles } from '../core/partyRoles';
import { calcStats, getSpecies, maxPp, xpForLevel } from '../core/pokemon';
import { emotionOf } from '../core/story/emotions';
import type { PokemonInstance, RunState } from '../core/state';
import { personalityOf, relationLines } from '../core/partyLife';
import { MOOD_LOOK } from './bondLook';
import { STAT_LABELS } from './summaryLook';

export type Move = z.infer<typeof MoveSchema>;

export interface Readiness {
  state: 'ready' | 'caution' | 'down';
  /** One word: Ready, Hurt, Needs care, Fainted... */
  label: string;
  /** Why, one short line each (empty when fully ready). */
  notes: string[];
}

/** How ready a Pokémon is for the next battle: HP, status, PP and whether it can attack at all. */
export function readiness(content: Content, mon: PokemonInstance): Readiness {
  if (mon.hp <= 0) return { state: 'down', label: 'Fainted', notes: ['It has fainted: heal or revive it.'] };
  const notes: string[] = [];
  let state: Readiness['state'] = 'ready';
  const maxHp = calcStats(content, mon).hp;
  const hpPct = Math.round((mon.hp / maxHp) * 100);
  if (hpPct < 50) {
    notes.push(`HP is down to ${hpPct}%.`);
    state = 'caution';
  }
  if (mon.status) {
    notes.push(`It is ${mon.status.id === 'brn' ? 'burned' : mon.status.id === 'psn' ? 'poisoned' : mon.status.id === 'par' ? 'paralyzed' : mon.status.id === 'slp' ? 'asleep' : mon.status.id === 'frz' ? 'frozen' : mon.status.id}.`);
    state = 'caution';
  }
  const empty = mon.moves.filter((m) => m.pp <= 0).length;
  if (empty === mon.moves.length) {
    notes.push('Every move is out of PP.');
    state = 'down';
  } else if (empty > 0) {
    notes.push(`${empty} move${empty === 1 ? ' is' : 's are'} out of PP.`);
    state = 'caution';
  }
  const attacks = mon.moves.some((m) => m.pp > 0 && (content.moves.get(m.id)?.power ?? 0) > 0);
  if (!attacks && empty < mon.moves.length) {
    notes.push('It has no attacking move left.');
    state = 'caution';
  }
  const label = state === 'ready' ? 'Ready' : state === 'down' ? 'Not ready' : 'Needs care';
  return { state, label, notes };
}

export interface StatCompareRow {
  key: StatName;
  label: string;
  value: number;
  other: number;
  /** value − other. */
  delta: number;
}

/** A Pokémon's stats set beside another's (the lead by default). */
export function compareStats(content: Content, mon: PokemonInstance, other: PokemonInstance): StatCompareRow[] {
  const a = calcStats(content, mon);
  const b = calcStats(content, other);
  return (Object.keys(STAT_LABELS) as StatName[]).map((key) => ({ key, label: STAT_LABELS[key], value: a[key], other: b[key], delta: a[key] - b[key] }));
}

/** Which Pokémon a stat comparison should use: the lead, or the second if this one leads. */
export function compareTarget(party: PokemonInstance[], index: number): number | null {
  if (party.length < 2) return null;
  return index === 0 ? 1 : 0;
}

/** Experience: how far through the current level, as a fraction and words. Null at the level limit or for unknown rates. */
export function xpProgress(content: Content, mon: PokemonInstance): { fraction: number; text: string } | null {
  const species = getSpecies(content, mon.speciesId);
  const rate = species.growthRate;
  const high = content.balance.difficulty.highLevelXp;
  const floor = xpForLevel(rate, mon.level, high);
  const next = xpForLevel(rate, mon.level + 1, high);
  if (!(next > floor)) return null;
  const have = Math.max(0, mon.xp - floor);
  const need = next - floor;
  return { fraction: Math.min(1, have / need), text: `${have} / ${need} to Lv${mon.level + 1}` };
}

/** Plain-language lines for what a move does besides damage, from its data. */
export function moveEffectLines(move: Move): string[] {
  const lines: string[] = [];
  const e = move.effects;
  if (move.priority !== 0) lines.push(`Priority ${move.priority > 0 ? '+' : ''}${move.priority}: ${move.priority > 0 ? 'moves before others' : 'moves after others'}.`);
  if (move.critStage > 0) lines.push(`High critical-hit chance (+${move.critStage}).`);
  if (e?.status) lines.push(`${e.status.chance}% chance to cause ${e.status.id}.`);
  if (e?.flinchChance) lines.push(`${e.flinchChance}% chance to make the target flinch.`);
  for (const s of e?.statChanges ?? []) lines.push(`${s.chance}%: ${s.target === 'self' ? 'its own' : "target's"} ${s.stat} ${s.stages > 0 ? 'rises' : 'falls'} ${Math.abs(s.stages)}.`);
  if (e?.drain) lines.push(`Heals the user for ${Math.round(e.drain * 100)}% of the damage.`);
  if (e?.recoil) lines.push(`The user takes ${Math.round(e.recoil * 100)}% of the damage back.`);
  if (e?.recoilMaxHp) lines.push(`The user loses ${Math.round(e.recoilMaxHp * 100)}% of its max HP.`);
  if (e?.fixedDamage) lines.push(e.fixedDamage === 'level' ? "Deals damage equal to the user's level." : e.fixedDamage === 'psywave' ? 'Deals random damage based on level.' : `Deals exactly ${e.fixedDamage} damage.`);
  if (e?.halveTarget) lines.push("Takes off half of the target's HP.");
  if (e?.noop) lines.push('Does nothing.');
  if (move.flags.includes('contact')) lines.push('Makes contact.');
  if (move.flags.includes('sound')) lines.push('A sound move.');
  if (move.target === 'self' && move.category === 'status') lines.push('Used on itself.');
  if (lines.length === 0) lines.push(move.category === 'status' ? 'A status move; see its description in battle.' : 'A plain damaging move.');
  return lines;
}

export interface BondView {
  mood: { text: string; color: number; hint: string };
  values: { key: string; value: number }[];
  trait: string;
  personality: string;
  relations: string;
  hearts: number;
  emotion: { name: string; color: string } | null;
  roles: string[];
}

/** The Personality and relationships tab: bond, mood, personality, teammates, emotion. */
export function bondView(content: Content, run: RunState, mon: PokemonInstance): BondView {
  const bond = bondOf(run, mon.uid);
  const mood = MOOD_LOOK[bondMood(bond)];
  const p = personalityOf(run, mon);
  const emotion = emotionOf(content, run, mon.uid);
  return {
    mood,
    values: (['trust', 'affection', 'respect', 'synchronization', 'confidence', 'autonomy', 'strain'] as const).map((key) => ({ key, value: bond[key] })),
    trait: bond.trait,
    personality: `${p.label}: ${p.blurb} It ${p.quirk}.`,
    relations: relationLines(content, run, mon).slice(0, 3).join('  ·  '),
    hearts: friendshipHearts(content, mon),
    emotion: emotion ? { name: emotion.name, color: emotion.color } : null,
    roles: partyRoles(content, mon),
  };
}

export interface HistoryView {
  record: string;
  titles: string[];
  /** Up to six moments, most memorable first. */
  memories: string[];
}

export function historyView(run: RunState | null, mon: PokemonInstance): HistoryView {
  const h = run?.story.histories[mon.uid];
  if (!h) return { record: 'No battles yet this run.', titles: [], memories: [] };
  const record = [`${h.battles} battle${h.battles === 1 ? '' : 's'}`, `${h.knockoutsDealt} KO${h.knockoutsDealt === 1 ? '' : 's'}`, h.bossesBeaten ? `${h.bossesBeaten} boss${h.bossesBeaten === 1 ? '' : 'es'}` : ''].filter(Boolean).join(' · ');
  const memories = [...(h.memories ?? [])].sort((a, b) => b.importance - a.importance || b.seq - a.seq).slice(0, 6).map((m) => m.text);
  return { record, titles: h.titles ?? [], memories };
}

/** Special characteristics beyond the stats: shiny, hatched, lineage, vitamins, permanent boosts. */
export function traitLines(content: Content, mon: PokemonInstance): string[] {
  const out: string[] = [];
  if (mon.shiny) out.push('★ Shiny.');
  if (mon.hatched) out.push('Hatched from an Egg this run.');
  if (mon.lineage) out.push(`Descends from ${mon.lineage.ancestor}, from an earlier run.`);
  for (const [stat, n] of Object.entries(mon.vitamins)) if (n > 0) out.push(`${STAT_LABELS[stat as StatName]}: ${n} vitamin${n === 1 ? '' : 's'} taken.`);
  for (const [stat, n] of Object.entries(mon.statBoosts ?? {})) if (n && n > 0) out.push(`${STAT_LABELS[stat as StatName]}: ${n} permanent boost${n === 1 ? '' : 's'}.`);
  if (mon.perkHp) out.push(`${mon.perkHp > 0 ? '+' : ''}${mon.perkHp}% max HP from your trainer's perks.`);
  if (mon.boosts?.length) out.push(`${mon.boosts.length} battle boost${mon.boosts.length === 1 ? '' : 's'} ready for its next fight.`);
  if (mon.moves.length > 0 && mon.moves.some((m) => m.pp < maxPp(content, m))) out.push('Some moves are below full PP.');
  return out;
}
