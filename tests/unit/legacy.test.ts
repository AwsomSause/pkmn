// The Legacy System (Techno blueprint §6.1): cards, titles, epitaph.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { awardLegacyTitles, legacyCard, recordEpitaph, runEpitaph } from '../../src/core/story/legacy';
import { content } from './helpers';

function fresh(seed: string) {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  return { run, mon: run.party[0]! };
}

describe('Legacy system', () => {
  it('a card is built from the real history: tags, memories, titles', () => {
    const { run, mon } = fresh('legacy-card');
    const h = run.story.histories[mon.uid]!;
    h.battles = 4;
    h.bossesBeaten = 1;
    h.survivedFatal = 1;
    h.memories.push({ seq: 1, text: 'Held on against all odds', importance: 80, emotions: [] } as never);
    const card = legacyCard(content, run, mon.uid)!;
    expect(card.tags).toEqual(expect.arrayContaining(['Run Ace', 'Survivor']));
    expect(card.signature).toBe('Held on against all odds');
    expect(legacyCard(content, run, 'missing')).toBeNull();
  });

  it('titles are earned from history, never twice, never removed', () => {
    const { run, mon } = fresh('legacy-titles');
    const h = run.story.histories[mon.uid]!;
    awardLegacyTitles(content, run);
    expect(h.titles).toEqual([]);
    h.survivedFatal = 2;
    h.bossesBeaten = 3;
    awardLegacyTitles(content, run);
    awardLegacyTitles(content, run);
    expect(h.titles).toEqual(expect.arrayContaining(['Iron Will', 'Boss Slayer']));
    expect(new Set(h.titles).size).toBe(h.titles.length);
  });

  it('the epitaph names the Pokémon whose story weighs most, and is null when nobody has a history', () => {
    const { run, mon } = fresh('legacy-epitaph');
    const empty = structuredClone(run);
    empty.story.histories = {};
    expect(runEpitaph(content, empty)).toBeNull();
    const h = run.story.histories[mon.uid]!;
    h.bossesBeaten = 3;
    awardLegacyTitles(content, run);
    expect(runEpitaph(content, run)).toContain('Boss Slayer');
    const before = run.story.chronicle.length;
    recordEpitaph(content, run);
    expect(run.story.chronicle.length).toBe(before + 1);
    expect(run.story.chronicle.at(-1)!.text).toMatch(/^Epitaph:/);
  });
});
