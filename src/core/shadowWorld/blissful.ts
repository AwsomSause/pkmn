// Blissful Pokémon (APPROVED.md §13): touched by a benevolent force. Their aura is small and supportive: it never
// replaces healing items. No gameplay RNG: the look of an aura comes from the Pokémon's uid.

import type { Content } from '../contentSchema';
import { maxHp } from '../pokemon';
import { soothe } from '../shadow';
import type { PokemonInstance, RunState } from '../state';
import { addFlag } from './world';

export const isBlissful = (mon: Pick<PokemonInstance, 'blissful'>): boolean => mon.blissful !== undefined;

/** The aura a Pokémon gets, fixed by its uid. */
export function auraFor(content: Content, uid: string): string {
  const list = content.shadowWorld.auras;
  let h = 0;
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length]!.id;
}

export function makeBlissful(content: Content, mon: PokemonInstance): void {
  mon.blissful = { aura: auraFor(content, mon.uid) };
}

/** The Blissful Pokémon whose aura is working (one at a time: auras never stack). */
export const blissfulSource = (run: Pick<RunState, 'party'>): PokemonInstance | undefined => run.party.find((m) => m.hp > 0 && m.blissful);

/** After a won battle: the aura mends the rest of the party a little. Returns the Pokémon that felt it. */
export function blissfulAfterBattle(content: Content, run: Pick<RunState, 'party'>): string[] {
  const source = blissfulSource(run);
  const share = content.shadowWorld.blissfulAfterBattleHeal;
  if (!source || share <= 0) return [];
  const healed: string[] = [];
  for (const mon of run.party) {
    if (mon.uid === source.uid || mon.hp <= 0) continue;
    const cap = maxHp(content, mon);
    if (mon.hp >= cap) continue;
    mon.hp = Math.min(cap, mon.hp + Math.max(1, Math.floor(cap * share)));
    healed.push(content.species.get(mon.speciesId)?.name ?? mon.speciesId);
  }
  return healed;
}

/** At a healing stop: the aura calms every Shadow Pokémon in the party. Returns the names that were purified. */
export function blissfulAtRest(content: Content, run: Pick<RunState, 'party' | 'story'>): string[] {
  if (!blissfulSource(run)) return [];
  const purified: string[] = [];
  for (const mon of run.party) {
    if (mon.shadow && soothe(content, mon, content.shadowWorld.blissfulRestSoothe)) {
      purified.push(content.species.get(mon.speciesId)?.name ?? mon.speciesId);
      addFlag(run, 'kindness');
    }
  }
  return purified;
}

/** A sanctuary's blessing: ordinary run modifiers for a few battles (taken through the same temp-effect list as signatures). */
export function grantBlessing(content: Content, run: RunState, id: string): string {
  const b = content.shadowWorld.blessings.find((x) => x.id === id);
  if (!b) return '';
  run.perkEffects.push(...b.effects);
  run.tempEffects.push({ effects: b.effects, battles: b.battles, until: b.until });
  return `${b.name}: ${b.text}`;
}
