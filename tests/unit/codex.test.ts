// Hyper moment codex (left-out plan 5.19): moments seen in a run are added to the account once.

import { describe, expect, it } from 'vitest';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { chooseStarter, createRun } from '../../src/core/run';
import { addRunToCodex, codexEntries, codexTotals, noteCodex } from '../../src/core/story/codex';
import { MIGRATIONS } from '../../src/save/saveManager';
import { content } from './helpers';

describe('Moment codex', () => {
  it('counts moments told in a run and adds them to the account when the run is finalized, only once', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'cx', seed: 'cx', archetypeId: 'red' }), 0);
    noteCodex(run, 'remember-defeat');
    noteCodex(run, 'remember-defeat');
    noteCodex(run, 'enemy-will-return');
    run.phase = 'over';
    const first = finalizeRun(content, createProfile(content, 'p'), run);
    expect(first.profile.momentCodex).toEqual({ 'remember-defeat': 2, 'enemy-will-return': 1 });
    const again = finalizeRun(content, first.profile, run);
    expect(again.applied).toBe(false);
    expect(again.profile.momentCodex['remember-defeat']).toBe(2);
    const profile = structuredClone(first.profile);
    addRunToCodex(profile, run);
    expect(profile.momentCodex['remember-defeat']).toBe(4);
  });

  it('lists every story moment with how often it was seen', () => {
    const profile = createProfile(content, 'p');
    profile.momentCodex = { 'remember-defeat': 3 };
    const entries = codexEntries(content, profile);
    expect(entries).toHaveLength(content.story.definitions.length);
    expect(entries.find((e) => e.def.id === 'remember-defeat')?.seen).toBe(3);
    expect(codexTotals(content, profile)).toEqual({ found: 1, total: content.story.definitions.length });
  });

  it('a story moment told in battle is counted', async () => {
    const { takeTurn } = await import('../../src/core/run');
    const { createBattle } = await import('../../src/core/battle/engine');
    const { createPokemon } = await import('../../src/core/pokemon');
    const { freshSos } = await import('../../src/core/battle/sos');
    const { toBattle } = await import('./helpers');
    const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'cx2', seed: 'cx2', archetypeId: 'red' }), 0)));
    const lead = createPokemon(content, 'jolteon', 50, run.party[0]!.uid);
    lead.moves = [{ id: 'tackle', pp: 35 }];
    run.party[0] = lead;
    run.log.starterUid = null;
    const foe = createPokemon(content, 'rattata', 5, 'e1');
    run.battle = createBattle('wild', [foe], 0, lead.uid);
    run.battle.sos = { ...freshSos(), answered: 1 };
    run.story.flags['kind:normal'] = '0:9';
    const always = { ...content, story: { ...content.story, rarity: { ...content.story.rarity, momentChance: 1 } } };
    const after = takeTurn(always, run, { kind: 'move', index: 0 }).run;
    expect(after.story.flags['codex:not-forgotten-kindness']).toBe(1);
  });

  it('v12 profiles gain an empty codex', () => {
    expect(MIGRATIONS.profile[12]!({ a: 1 })).toEqual({ a: 1, momentCodex: {} });
  });
});
