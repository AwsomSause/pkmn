import { describe, expect, it } from 'vitest';
import { partyRoles } from '../../src/core/partyRoles';
import { createPokemon } from '../../src/core/pokemon';
import { content } from './helpers';

describe('party roles (catalog #119)', () => {
  it('gives every starter one or two readable roles', () => {
    for (const id of ['charmander', 'bulbasaur', 'squirtle', 'pikachu', 'snorlax']) {
      const mon = createPokemon(content, id, 30, `t-${id}`);
      const roles = partyRoles(content, mon);
      expect(roles.length, id).toBeGreaterThanOrEqual(1);
      expect(roles.length, id).toBeLessThanOrEqual(2);
    }
  });
  it('is stable for the same Pokémon', () => {
    const mon = createPokemon(content, 'snorlax', 50, 'x');
    expect(partyRoles(content, mon)).toEqual(partyRoles(content, mon));
  });
});

describe('reward synergy (catalog #95)', () => {
  it('names a fitting Pokémon for a vitamin and the lowest level for a level-up', async () => {
    const { rewardSynergy } = await import('../../src/core/rewardSynergy');
    const { createRun, chooseStarter } = await import('../../src/core/run');
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'syn', archetypeId: 'red' }), 0);
    const vit = [...content.rewards.values()].find((r) => r.effect.kind === 'vitamin')!;
    expect(rewardSynergy(content, run, vit)).toContain('Best on');
    const lvl = [...content.rewards.values()].find((r) => r.effect.kind === 'levelUp');
    if (lvl) expect(rewardSynergy(content, run, lvl)).toContain('Lowest');
  });
});

describe('reward synergy coverage (catalog #95)', () => {
  it('says something for every reward kind that shows on the draft', async () => {
    const { rewardSynergy } = await import('../../src/core/rewardSynergy');
    const { createRun, chooseStarter } = await import('../../src/core/run');
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'syn2', archetypeId: 'red' }), 0);
    const silent = new Set<string>();
    for (const r of content.rewards.values()) if (rewardSynergy(content, run, r) === null) silent.add(r.effect.kind);
    expect([...silent]).toEqual([]);
  });
});
