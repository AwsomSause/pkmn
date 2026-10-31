// The Event Director (Electric §2C): story-aware eligibility and remembered choices.

import { describe, expect, it } from 'vitest';
import { eligibleEvents } from '../../src/core/events';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

function late(seed: string) {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  run.regionIndex = Math.min(3, run.regionOrder.length - 1);
  return run;
}
const ids = (run: ReturnType<typeof late>) => eligibleEvents(content, run).map((e) => e.id);

describe('Event Director conditions', () => {
  it('a legendary in the party makes the researcher eligible; nobody else sees it', () => {
    const run = late('dir-ev-a');
    expect(ids(run)).not.toContain('researcher-recognizes-legendary');
    const legend = [...content.species.values()].find((s) => s.tags.includes('legendary'))!;
    run.party.push(createPokemon(content, legend.id, 30, 'legend'));
    expect(ids(run)).toContain('researcher-recognizes-legendary');
  });

  it('a bond, a fought rival and the region focus each unlock their own event', () => {
    const run = late('dir-ev-b');
    expect(ids(run)).not.toContain('quiet-bond');
    expect(ids(run)).not.toContain('old-rival-old-friend');
    run.story.relationships.push({ open: true, kind: 'bond', a: { kind: 'pokemon', id: 'a' }, b: { kind: 'pokemon', id: 'b' } } as never);
    run.story.rivals.push({ encounters: 3 } as never);
    expect(ids(run)).toContain('quiet-bond');
    expect(ids(run)).toContain('old-rival-old-friend');
  });

  it('the Overdrive unusual events are rare', () => {
    for (const id of ['doesnt-want-to-fight', 'it-saw-what-you-did', 'this-place-remembers']) expect(content.events.get(id)!.rarity).toBe('rare');
  });
});

describe('a rival who became a friend (left-out 2.2)', () => {
  it('only an allied rival offers a gift or a swap, and the gift adds a Pokémon', () => {
    const run = late('dir-ev-ally');
    run.party.push(createPokemon(content, 'rattata', 5, 'extra'));
    run.story.rivals.push({ encounters: 3, state: 'recurring' } as never);
    expect(ids(run)).not.toContain('rival-gift');
    expect(ids(run)).not.toContain('rival-swap');
    run.story.rivals[0]!.state = 'ally';
    expect(ids(run)).toContain('rival-gift');
    expect(ids(run)).toContain('rival-swap');
    const gift = content.events.get('rival-gift')!;
    expect(JSON.stringify(gift)).toContain('"join"');
  });
});
