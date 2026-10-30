// Techno §7 high-hype systems and §9 safeguards.

import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import { chemistryLines } from '../../src/core/story/chemistry';
import { campfireStory, circuitRanking, finalRivalLine, noteStruggle, recordChampionMemory } from '../../src/core/story/highHype';
import { awardLegacyTitles, legacyCard } from '../../src/core/story/legacy';
import { openHistory } from '../../src/core/story/record';
import { chronicleStories } from '../../src/core/story/storybook';
import type { Rival } from '../../src/core/story/schema';
import { content } from './helpers';

function fresh(seed: string) {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  return { run, mon: run.party[0]! };
}
const where = { region: 0, stage: 0, turn: 0 } as never;

describe('Champion Memory', () => {
  it('records the decisive hit, and an earlier struggle makes the Pokémon the MVP', () => {
    const a = fresh('champ-a');
    recordChampionMemory(content, a.run, a.mon, 'Blue', where);
    expect(a.run.story.chronicle.at(-1)!.text).toContain('decisive hit');
    const b = fresh('champ-b');
    noteStruggle(b.run, [b.mon.uid], 'Brock');
    recordChampionMemory(content, b.run, b.mon, 'Blue', where);
    expect(b.run.story.chronicle.at(-1)!.text).toContain('MVP');
    awardLegacyTitles(content, b.run);
    expect(b.run.story.histories[b.mon.uid]!.titles).toContain('From Struggle to MVP');
  });
});

describe('Campfire Stories', () => {
  it('tell once per stage, deterministically', () => {
    const { run } = fresh('camp');
    const buddy = createPokemon(content, 'rattata', 10, 'buddy');
    run.party.push(buddy);
    openHistory(content, run, buddy.uid, buddy.speciesId, 'caught');
    run.encountersCompleted = 5;
    run.regionIndex = 3;
    const first = campfireStory(content, structuredClone(run));
    expect(first).toBeTruthy();
    expect(campfireStory(content, structuredClone(run))).toBe(first);
    expect(campfireStory(content, run)).toBe(first);
    expect(campfireStory(content, run)).toBeNull();
  });
});

describe('Circuit and Final Rival', () => {
  const rival = (id: string, potential: number): Rival => ({ id, classId: 'youngster', name: id, state: 'active', rivalPotential: potential, progress: 0, encounters: 1, traits: { empathy: 50, vindictiveness: 30, resilience: 50, pride: 40, ambition: 50 }, memory: { lastBattle: { eventId: 'e', result: 'lose', hpLeftShare: 0.5, turns: 5, team: [] } }, origin: { eventId: 'e', where: { region: 1, stage: 0, turn: 0 }, path: 'p' } }) as never;

  it('ranks the rivals still in the running', () => {
    const { run } = fresh('circuit');
    run.story.rivals.push(rival('a', 10), rival('b', 40), { ...rival('c', 99), state: 'ally' } as never);
    const rows = circuitRanking(content, run);
    expect(rows.map((r) => r.name.split(' ')[1])).toEqual(['b', 'a']);
    expect(chronicleStories(content, run).some((s) => s.title === 'Rival Tournament Circuit')).toBe(true);
  });

  it('only the defining rival in the last region recreates the first meeting', () => {
    const { run } = fresh('final');
    run.story.rivals.push(rival('a', 10));
    run.regionIndex = run.regionOrder.length - 1;
    expect(finalRivalLine(content, run, 'a', true)).toContain('region 2');
    expect(finalRivalLine(content, run, 'a', false)).toBeNull();
    run.regionIndex = 0;
    expect(finalRivalLine(content, run, 'a', true)).toBeNull();
  });
});

describe('Safeguards (blueprint §9)', () => {
  it('a Pokémon that leaves the party never breaks cards, chemistry or stories', () => {
    const { run, mon } = fresh('leave');
    const buddy = createPokemon(content, 'rattata', 10, 'buddy');
    run.party.push(buddy);
    openHistory(content, run, buddy.uid, buddy.speciesId, 'caught');
    run.party = run.party.filter((m) => m.uid !== buddy.uid);
    expect(() => {
      legacyCard(content, run, buddy.uid);
      chemistryLines(content, run);
      chronicleStories(content, run);
      awardLegacyTitles(content, run);
    }).not.toThrow();
    expect(run.story.histories[mon.uid]).toBeDefined();
  });

  it('a Pokémon keeps its identity (uid and history) when it evolves', () => {
    const { run, mon } = fresh('evolve');
    const uid = mon.uid;
    mon.speciesId = 'wartortle';
    expect(run.story.histories[uid]!.uid).toBe(uid);
    expect(legacyCard(content, run, uid)!.uid).toBe(uid);
  });
});
