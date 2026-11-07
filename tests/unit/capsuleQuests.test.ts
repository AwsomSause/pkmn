import { describe, expect, it } from 'vitest';
import { capsuleCount, capsuleSlots, CAPSULE_QUESTS, questViews, recordCapsuleProgress, useCapsule } from '../../src/core/capsuleQuests';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import { makeRules, STANDARD_CHOICE } from '../../src/core/rules';
import { content } from './helpers';

function team() {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'cq', seed: 'cq', archetypeId: 'red' }), 0));
  run.party = [createPokemon(content, 'charmander', 10, 'f1'), createPokemon(content, 'squirtle', 10, 'w1')];
  return run;
}

describe('Ability Capsule Quests (S55)', () => {
  it('each quest counts a battle once per type present and pays one capsule when complete', () => {
    const run = team();
    const fire = CAPSULE_QUESTS.find((q) => q.type === 'fire')!;
    for (let i = 0; i < fire.need - 1; i += 1) expect(recordCapsuleProgress(content, run, ['f1', 'f1'])).toEqual([]);
    expect(questViews(run).find((q) => q.type === 'fire')!.progress).toBe(fire.need - 1);
    expect(questViews(run).find((q) => q.type === 'water')!.progress).toBe(0);
    expect(recordCapsuleProgress(content, run, ['f1'])).toEqual([fire.name]);
    expect(capsuleCount(run)).toBe(1);
    expect(recordCapsuleProgress(content, run, ['f1'])).toEqual([]);
    expect(capsuleCount(run)).toBe(1);
  });
  it('a capsule swaps to another ability and is used up; none means no swap', () => {
    const run = team();
    const two = createPokemon(content, [...content.species.values()].find((s) => s.evolutionStage === 1 && s.abilities.normal.length > 1 && !s.form)!.id, 10, 'two');
    run.party.push(two);
    const slots = capsuleSlots(content, two);
    expect(slots.length).toBeGreaterThan(0);
    expect(() => useCapsule(content, run, 'two', slots[0]!.slot)).toThrow(/no Ability Capsule/);
    run.itemCounters = { ...run.itemCounters, capsules: 1 };
    useCapsule(content, run, 'two', slots[0]!.slot);
    expect(run.party[2]!.abilitySlot).toBe(slots[0]!.slot);
    expect(capsuleCount(run)).toBe(0);
  });
});

describe('Ability Pick modifier', () => {
  it('makes the capsule free and unlimited', () => {
    const run = team();
    run.rules = makeRules({ ...STANDARD_CHOICE, modifierIds: ['ability-pick'] });
    const two = createPokemon(content, [...content.species.values()].find((s) => s.evolutionStage === 1 && s.abilities.normal.length > 1 && !s.form)!.id, 10, 'two');
    run.party.push(two);
    expect(capsuleCount(run)).toBe(0);
    const slot = capsuleSlots(content, two)[0]!.slot;
    useCapsule(content, run, 'two', slot);
    expect(two.abilitySlot).toBe(slot);
    expect(capsuleCount(run)).toBe(0);
    expect(() => useCapsule(content, team(), 'f1', 0)).toThrow('no Ability Capsule');
  });
});
