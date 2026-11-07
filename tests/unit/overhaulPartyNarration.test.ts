import { beforeEach, describe, expect, it } from 'vitest';
import { battleStartContext, closeWinScene, countedScene, ensureNarration, finisherScene, partyNarration, resetNarration } from '../../src/core/overhaul/partyNarration';
import { content } from './helpers';

const party = ['bulbasaur', 'charmander', 'squirtle', 'pikachu'].map((speciesId, i) => ({ uid: `m${i}`, nature: 'hardy' as const, speciesId }));
const nameOf = (m: { speciesId: string }) => content.species.get(m.speciesId)?.name ?? m.speciesId;
const typesOf = (m: { speciesId: string }) => content.species.get(m.speciesId)?.types ?? [];

describe('overhaul party narration', () => {
  beforeEach(() => resetNarration());
  it('is silent until the lines load', () => {
    expect(partyNarration(party, 'rest_node', 'k', nameOf, typesOf)).toBeNull();
  });
  it('speaks after load, repeatably, with no leftover placeholders', async () => {
    await ensureNarration();
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const a = partyNarration(party, 'rest_node', `run:${i}`, nameOf, typesOf);
      expect(a).toBe(partyNarration(party, 'rest_node', `run:${i}`, nameOf, typesOf));
      if (a) {
        expect(a).not.toMatch(/[{}]/);
        seen.add(a);
      }
    }
    expect(seen.size).toBeGreaterThan(5);
    expect(partyNarration(party, 'battle_win', 'run:1', nameOf, typesOf)).toBeTruthy();
  });
  it('serves the place and hour contexts too', async () => {
    await ensureNarration();
    for (const c of ['night', 'sunny', 'boss_intro']) {
      const lines = new Set(Array.from({ length: 30 }, (_, i) => partyNarration(party, c, `k${i}`, nameOf, typesOf)).filter(Boolean));
      expect(lines.size, c).toBeGreaterThan(0);
    }
  });
  it('finisher scenes need the exact species and move', async () => {
    expect(finisherScene('bulbasaur', 'Frenzy Plant')).toBeNull();
    await ensureNarration();
    expect(finisherScene('bulbasaur', 'Frenzy Plant')).toMatch(/Frenzy Plant finishes a boss battle/);
    expect(finisherScene('bulbasaur', 'Tackle')).toBeNull();
    expect(finisherScene('missingno', 'Frenzy Plant')).toBeNull();
  });
  it('badge reactions exist', async () => {
    await ensureNarration();
    expect(Array.from({ length: 30 }, (_, i) => partyNarration(party, 'badge', `k${i}`, nameOf, typesOf)).some(Boolean)).toBe(true);
  });
  it('counted scenes fire once, on the exact count, and only after load', async () => {
    const names = (k: string, id: string) => (k === 'move' ? (id === 'bug-bite' ? 'Bug Bite' : id) : id.replaceAll('-', ' '));
    const mon = { uid: 'u1', speciesId: 'metapod' };
    const use = Array.from({ length: 10 }, () => ({ type: 'move', side: 'player', moveId: 'bug-bite' }));
    expect(countedScene({}, mon, use, names)).toBeNull();
    await ensureNarration();
    const counters: Record<string, number> = {};
    expect(countedScene(counters, mon, use.slice(0, 9), names)).toBeNull();
    expect(countedScene(counters, mon, use.slice(9), names)).toMatch(/tenth time Metapod uses Bug Bite/);
    expect(countedScene(counters, mon, use.slice(9), names)).toBeNull();
    expect(counters['pack.use.u1.bug-bite']).toBe(11);
    expect(countedScene({}, undefined, use, names)).toBeNull();
    // the enemy's moves are never counted
    expect(countedScene({}, mon, use.map((e) => ({ ...e, side: 'enemy' })), names)).toBeNull();
  });
  it('evolution, hatch and new member reactions exist', async () => {
    await ensureNarration();
    for (const c of ['evolution', 'hatch', 'new_member']) {
      expect(Array.from({ length: 30 }, (_, i) => partyNarration(party, c, `k${i}`, nameOf, typesOf)).some(Boolean), c).toBe(true);
    }
  });
  it('battle-start context: shiny, then legend, then weather', async () => {
    expect(battleStartContext({ shiny: true, tags: ['legendary'] }, 'rain')).toBe('shiny_encounter');
    expect(battleStartContext({ shiny: false, tags: ['mythical'] }, 'rain')).toBe('legend_sighting');
    expect(battleStartContext({ shiny: false, tags: [] }, 'hail')).toBe('snow');
    expect(battleStartContext({ shiny: false, tags: [] }, 'sand')).toBe('storm');
    await ensureNarration();
    for (const c of ['shiny_encounter', 'storm', 'legend_sighting', 'rain', 'snow', 'sunny', 'trade']) {
      expect(Array.from({ length: 30 }, (_, i) => partyNarration(party, c, `k${i}`, nameOf, typesOf)).some(Boolean), c).toBe(true);
    }
  });
  it('idle ability scenes can show at a rest stop', async () => {
    await ensureNarration();
    const mons = [{ uid: 'c', nature: 'hardy' as const, speciesId: 'caterpie' }];
    const lines = Array.from({ length: 40 }, (_, i) => partyNarration(mons, 'rest_node', `r${i}`, nameOf, typesOf));
    expect(lines.some((l) => l && /^During a rest node, Caterpie/.test(l))).toBe(true);
  });
  it('close-win scene needs low HP and an ability that fired this battle', async () => {
    const mon = { uid: 'u1', speciesId: 'ivysaur' };
    const counters: Record<string, number> = {};
    const ev = [{ type: 'ability', side: 'player', ability: 'overgrow' }];
    const names = (k: string, id: string) => id;
    expect(closeWinScene(counters, mon, 0.1, 5, (id) => id)).toBeNull(); // not loaded
    await ensureNarration();
    countedScene(counters, mon, ev, names, 5);
    expect(closeWinScene(counters, mon, 0.1, 5, (id) => id)).toMatch(/close win where Overgrow mattered, Ivysaur/);
    expect(closeWinScene(counters, mon, 0.6, 5, (id) => id)).toBeNull();
    expect(closeWinScene(counters, mon, 0.1, 6, (id) => id)).toBeNull();
  });
  it('an empty party has nothing to say', async () => {
    await ensureNarration();
    expect(partyNarration([], 'rest_node', 'k', nameOf, typesOf)).toBeNull();
  });
});

describe('hand-written extra moments', () => {
  it('every extra scene belongs to a real species, is one clean sentence, and the Drive Pokémon speak at rest stops', async () => {
    const extra = (await import('../../src/data/momentsExtra.json')).default.entries;
    expect(extra.filter((e) => e.group === 'drive').length).toBeGreaterThanOrEqual(40);
    expect(extra.filter((e) => e.group === 'lore').length).toBeGreaterThanOrEqual(50);
    for (const e of extra) {
      expect(content.species.has(e.speciesId), e.speciesId).toBe(true);
      expect(e.scene.length, e.speciesId).toBeLessThanOrEqual(140);
      expect(e.scene, e.speciesId).not.toMatch(/[{}]/);
    }
    resetNarration();
    await ensureNarration();
    const solo = [{ uid: 'd0', nature: 'hardy' as const, speciesId: 'dratini-delta' }];
    const none = (_m: unknown) => [] as string[];
    const line = partyNarration(solo, 'rest_node', 'k1', nameOf, none);
    expect(line).toMatch(/^Delta Dratini: /);
  });
});
