// Spec 8: Protective Instinct leaves a mark after the battle (a bond and more trust).

import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunEvent } from '../../src/core/run';
import { recordBattleTurn } from '../../src/core/story/hooks';
import { openHistory } from '../../src/core/story/record';
import { content, toBattle } from './helpers';

describe('Protective Instinct aftermath', () => {
  it('the two teammates become bonded and trust each other more', () => {
    const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: 'pi', seed: 'pi', archetypeId: 'red' }), 0)));
    run.battle!.kind = 'trainer';
    const lead = run.party[0]!;
    const mate = createPokemon(content, 'rattata', 10, 'mate');
    run.party.push(mate);
    openHistory(content, run, mate.uid, mate.speciesId, 'caught');
    const before = [lead.friendship, mate.friendship];
    const event = { type: 'hyper', side: 'player', uid: lead.uid, defId: 'protective-instinct', variant: null, hpAfter: 5, cured: false, proxy: { uid: mate.uid, hpAfter: 9 } } as RunEvent;
    recordBattleTurn(content, structuredClone(run), run, [event]);
    expect(run.story.relationships.some((r) => r.kind === 'bond' && [r.a.id, r.b.id].sort().join() === [lead.uid, mate.uid].sort().join())).toBe(true);
    expect(lead.friendship).toBeGreaterThan(before[0]!);
    expect(mate.friendship).toBeGreaterThan(before[1]!);
  });
});
