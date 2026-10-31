// Pokémon-to-Pokémon rivalry kinds (left-out plan 5.4, Techno §1 "Rivalry
// personalities"). Heated Rivalry (repeated battles) and Friendly Competition
// (teammates trading finishing blows) already exist; this adds the tones:
//   Bitter     – your Pokémon fell to a foe that was nearly beaten itself (a narrow, humiliating loss).
//   One-Sided  – your Pokémon fell to a much stronger foe that barely noticed it; it pays off when
//                your Pokémon finally knocks that species out (the rivalry becomes Mutual).
//   Friendly   – two teammates in a Friendly Competition tag in for each other in battle.
//   Generational – a returning rival's Pokémon has evolved since you last met.
// The tone is kept on the rivalry record; nothing here draws a random number.

import type { Content } from '../contentSchema';
import { maxHp } from '../pokemon';
import type { PokemonInstance, RunState } from '../state';
import { emit, openRelationship } from './record';
import type { RelationshipRecord, Where } from './schema';

const foeRef = (speciesId: string) => ({ kind: 'enemy' as const, id: `species:${speciesId}` });

/** Your Pokémon's open rivalry with an opposing species, if any. */
export function speciesRivalry(run: RunState, uid: string, speciesId: string): RelationshipRecord | undefined {
  const ref = foeRef(speciesId);
  return run.story.relationships.find((r) => r.open && r.kind === 'rivalry' && r.a.kind === 'pokemon' && r.a.id === uid && r.b.kind === ref.kind && r.b.id === ref.id);
}

/** Your Pokémon fainted to `foe`: a narrow loss starts a Bitter rivalry, a loss to a much stronger foe a One-Sided one. */
export function noteRivalryLoss(content: Content, run: RunState, mon: PokemonInstance, foe: PokemonInstance, where: Where): void {
  if (!run.story.histories[mon.uid] || speciesRivalry(run, mon.uid, foe.speciesId)) return;
  const cfg = content.story.nemesis;
  const bitter = foe.hp > 0 && foe.hp <= maxHp(content, foe) * cfg.lowHpShare;
  const oneSided = !bitter && foe.level >= mon.level + cfg.oneSidedGap;
  if (!bitter && !oneSided) return;
  const name = (id: string) => content.species.get(id)?.name ?? id;
  const cause = emit(content, run, 'rivalryFormed', {
    where,
    actors: [mon.uid],
    data: { kind: bitter ? 'bitter' : 'oneSided', speciesId: foe.speciesId },
    text: bitter ? `Lost to ${name(foe.speciesId)} when it was nearly beaten, and won't forget it` : `Was brushed aside by a stronger ${name(foe.speciesId)}, and swore to catch up`,
  });
  const record = openRelationship(content, run, 'rivalry', { kind: 'pokemon', id: mon.uid }, foeRef(foe.speciesId), cause);
  if (record) record.tone = bitter ? 'bitter' : 'oneSided';
}

/** Your Pokémon knocked out `foe`: a One-Sided rivalry becomes Mutual. Returns true when it did. */
export function noteRivalryWin(run: RunState, uid: string, speciesId: string): boolean {
  const record = speciesRivalry(run, uid, speciesId);
  if (!record || record.tone !== 'oneSided') return false;
  record.tone = 'mutual';
  record.stage += 1;
  return true;
}

/** Species on a returning rival's team now that evolved from one it brought last time (Generational Rivalry). */
export function grownSince(content: Content, before: readonly string[], now: readonly string[]): { from: string; to: string } | null {
  for (const to of now) {
    if (before.includes(to)) continue;
    const from = before.find((id) => evolvesInto(content, id, to));
    if (from) return { from, to };
  }
  return null;
}

function evolvesInto(content: Content, from: string, to: string, depth = 0): boolean {
  if (depth > 3) return false;
  return (content.species.get(from)?.evolutions ?? []).some((e) => e.to === to || evolvesInto(content, e.to, to, depth + 1));
}
