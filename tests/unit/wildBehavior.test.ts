import { describe, expect, it } from 'vitest';
import { WILD_BEHAVIORS, wildBehavior } from '../../src/core/wildBehavior';
import { createPokemon } from '../../src/core/pokemon';
import { content } from './helpers';

const fake = (seed: string, n: number, kind: 'wild' | 'trainer' = 'wild') =>
  ({ seed, encountersCompleted: n, battle: { kind, enemyIndex: 0, enemyTeam: [createPokemon(content, 'rattata', 5, 'e')] } }) as never;

describe('wild behaviours (catalog #26, #27, #30)', () => {
  it('is deterministic per seed and encounter', () => {
    for (let n = 0; n < 20; n++) expect(wildBehavior(content, fake('s', n))).toEqual(wildBehavior(content, fake('s', n)));
  });
  it('never applies to trainers and only some wild encounters', () => {
    expect(wildBehavior(content, fake('s', 1, 'trainer'))).toBeNull();
    const hits = Array.from({ length: 200 }, (_, n) => wildBehavior(content, fake('abc', n))).filter(Boolean);
    expect(hits.length).toBeGreaterThan(40);
    expect(hits.length).toBeLessThan(140);
    expect(new Set(hits.map((h) => h!.id)).size).toBe(WILD_BEHAVIORS.length);
    expect(hits[0]!.line).toContain('Rattata');
  });
});

describe('rescue and chain events (catalog #31, #32, #66)', () => {
  it('the chain links need the earlier link to have happened', async () => {
    const { eligibleEvents } = await import('../../src/core/events');
    const { createRun } = await import('../../src/core/run');
    const run = createRun(content, { runId: 'r', seed: 'chain', archetypeId: 'red' });
    run.stage = run.stage ?? (undefined as never);
    const ids = (r: typeof run) => eligibleEvents(content, r).map((e) => e.id);
    expect(content.events.has('trapped-pokemon')).toBe(true);
    for (const id of ['poacher-hideout', 'habitat-restored']) expect(content.events.get(id)!.requires.length).toBe(1);
    expect(ids({ ...run, itemCounters: {} })).not.toContain('poacher-hideout');
    expect(ids({ ...run, itemCounters: { 'event-seen:disturbed-habitat': 1 }, stage: run.stage } as never)).not.toContain('habitat-restored');
  });
});
