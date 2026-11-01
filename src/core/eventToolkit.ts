// Event toolkit (ideas W0): run counters that carry between battles (Electric Week's Charge, Water Week's
// tide) and the perks they turn into. Counters live in run.itemCounters as `ev:<id>` (an existing optional
// field, so no save change). Everything is pure and deterministic: no random numbers, no clock.

import type { ArchetypeModifier } from './contentSchema';
import type { RunState } from './state';
import type { Perks } from './archetypes';

type CounterMod = Extract<ArchetypeModifier, { kind: 'eventCounter' }>;
type DamageMod = Extract<ArchetypeModifier, { kind: 'counterDamage' }>;

export const counterKey = (id: string): string => `ev:${id}`;
export const counterValue = (run: Pick<RunState, 'itemCounters'>, id: string): number => run.itemCounters?.[counterKey(id)] ?? 0;

/** Adds each matching counter's `amount` (capped at `max`; a cycling counter wraps to 0 past `max`). Mutates `run`. */
export function bumpEventCounters(perks: Perks | undefined, run: Pick<RunState, 'itemCounters'>, on: CounterMod['on']): void {
  for (const m of (perks ?? []) as ArchetypeModifier[]) {
    if (m.kind !== 'eventCounter' || m.on !== on) continue;
    const next = counterValue(run, m.id) + m.amount;
    run.itemCounters = { ...(run.itemCounters ?? {}), [counterKey(m.id)]: m.cycle ? (next > m.max ? 0 : next) : Math.min(m.max, next) };
  }
}

/** The perk list with each `counterDamage` turned into a plain `damageMultiplier` for the counter's current value. */
export function resolveCounterPerks(perks: Perks, run: Pick<RunState, 'itemCounters'>): Perks {
  if (!perks.some((m) => m.kind === 'counterDamage')) return perks;
  const out: ArchetypeModifier[] = [];
  for (const m of perks as ArchetypeModifier[]) {
    if (m.kind !== 'counterDamage') { out.push(m); continue; }
    const d: DamageMod = m;
    const n = counterValue(run, d.counter);
    if (n < d.atLeast) continue;
    out.push({ kind: 'damageMultiplier', ...(d.type ? { type: d.type } : {}), value: d.base + d.perPoint * n });
  }
  return out;
}
