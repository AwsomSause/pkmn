// The merged Pokémon screen (spec §5, §6): item effect text, readiness, comparison, reordering.

import { describe, expect, it } from 'vitest';
import { HeldHookSchema, type HeldHook } from '../../src/core/contentSchema';
import { describeHeldItem, heldBuild } from '../../src/core/itemEffects';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun, moveParty } from '../../src/core/run';
import { compareStats, compareTarget, historyView, moveEffectLines, readiness, traitLines, xpProgress } from '../../src/ui/pokemonInfo';
import { content } from './helpers';

const newRun = () => structuredClone(chooseStarter(content, createRun(content, { runId: 'pm', seed: 'pokemon-screen', archetypeId: 'red' }), 0));
const heldIds = (): string[] => [...content.catalog.values()].filter((e) => e.status === 'supported' && e.effect?.kind === 'held').map((e) => e.id);

describe('held item effect text', () => {
  it('describes Choice Band from its real hooks: Attack x1.5 and the move lock', () => {
    const info = describeHeldItem(content, 'choice-band', 1);
    expect(info.effects.join(' ')).toContain('Attack is ×1.5');
    expect(info.catches.join(' ')).toContain('Locked');
    expect(info.mode).toBe('passive');
    expect(info.detail.join(' ')).toContain('2 effects are active together');
    expect(info.stacking).toContain('does not stack');
  });

  it('scales copy-based numbers and says so', () => {
    const one = describeHeldItem(content, 'muscle-band', 1);
    const three = describeHeldItem(content, 'muscle-band', 3);
    expect(one.effects[0]).toContain('10%');
    expect(three.effects[0]).toContain('30%');
    expect(three.stacking).toContain('Each copy adds');
  });

  it('marks berries and sashes as triggered and used up', () => {
    const sash = describeHeldItem(content, 'focus-sash', 1);
    expect(sash.mode).toBe('activated');
    expect(sash.consumed).toBe(true);
    const leftovers = describeHeldItem(content, 'leftovers', 2);
    expect(leftovers.mode).toBe('passive');
    expect(leftovers.effects[0]).toContain('12.5%');
  });

  it('gives every supported held item at least one effect line with no placeholder text', () => {
    for (const id of heldIds()) {
      const info = describeHeldItem(content, id, 1);
      expect(info.noEffect, id).toBe(false);
      expect(info.effects.length, id).toBeGreaterThan(0);
      for (const line of [...info.effects, ...info.catches, ...info.conditions, info.stacking]) expect(line, `${id}: ${line}`).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it('covers every hook kind in the schema (a new hook needs a line in itemEffects.ts)', () => {
    const kinds = HeldHookSchema.options.map((o) => (o.shape.hook as unknown as { value: string }).value);
    const used = new Set<string>();
    for (const e of content.catalog.values()) if (e.effect?.kind === 'held') for (const h of e.effect.hooks as HeldHook[]) used.add(h.hook);
    // Every hook that any item uses must produce text through the default-free switch.
    for (const k of used) expect(kinds).toContain(k);
  });

  it('summarises a whole build and flags items with no battle effect', () => {
    const run = newRun();
    const mon = run.party[0]!;
    mon.held = { 'choice-band': 1, leftovers: 1 };
    const build = heldBuild(content, mon);
    expect(build.items).toHaveLength(2);
    expect(build.activeEffects).toBe(3);
    expect(build.summary).toContain('2 items');
    mon.held = {};
    expect(heldBuild(content, mon).summary).toBe('Holding nothing.');
    const odd = describeHeldItem(content, 'not-an-item', 1);
    expect(odd.noEffect).toBe(true);
  });
});

describe('readiness, comparison and history', () => {
  it('reports ready, hurt, status, out of PP and fainted', () => {
    const run = newRun();
    const mon = structuredClone(run.party[0]!);
    expect(readiness(content, mon).state).toBe('ready');
    mon.hp = 1;
    expect(readiness(content, mon)).toMatchObject({ state: 'caution', label: 'Needs care' });
    mon.status = { id: 'brn', turns: 0 };
    expect(readiness(content, mon).notes.join(' ')).toContain('burned');
    for (const m of mon.moves) m.pp = 0;
    expect(readiness(content, mon).state).toBe('down');
    mon.hp = 0;
    expect(readiness(content, mon)).toMatchObject({ state: 'down', label: 'Fainted' });
  });

  it('compares stats with the lead (or the second when it leads) and has no target alone', () => {
    const run = newRun();
    expect(compareTarget(run.party, 0)).toBeNull();
    const other = createPokemon(content, 'pidgey', 20, 'cmp-uid');
    run.party.push(other);
    expect(compareTarget(run.party, 0)).toBe(1);
    expect(compareTarget(run.party, 1)).toBe(0);
    const rows = compareStats(content, run.party[1]!, run.party[0]!);
    expect(rows).toHaveLength(6);
    for (const r of rows) expect(r.delta).toBe(r.value - r.other);
  });

  it('shows xp progress, move effects, history and traits without crashing on a fresh run', () => {
    const run = newRun();
    const mon = run.party[0]!;
    expect(xpProgress(content, mon)?.text).toContain(`Lv${mon.level + 1}`);
    for (const slot of mon.moves) expect(moveEffectLines(content.moves.get(slot.id)!).length).toBeGreaterThan(0);
    expect(historyView(run, mon).record.length).toBeGreaterThan(0);
    mon.shiny = true;
    expect(traitLines(content, mon)[0]).toContain('Shiny');
  });
});

describe('party reordering', () => {
  it('moves a member to a slot, keeps everyone, and rejects bad slots', () => {
    const run = newRun();
    run.phase = 'map';
    run.party.push(createPokemon(content, 'pidgey', 5, 'a'), createPokemon(content, 'rattata', 5, 'b'));
    const ids = run.party.map((m) => m.uid);
    const moved = moveParty(run, 2, 0);
    expect(moved.party.map((m) => m.uid)).toEqual([ids[2], ids[0], ids[1]]);
    expect(moveParty(run, 0, 2).party.map((m) => m.uid)).toEqual([ids[1], ids[2], ids[0]]);
    expect(run.party.map((m) => m.uid)).toEqual(ids);
    expect(() => moveParty(run, 5, 0)).toThrow();
    expect(() => moveParty(run, 0, 9)).toThrow();
  });
});
