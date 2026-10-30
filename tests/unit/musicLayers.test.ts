import { describe, expect, it } from 'vitest';
import { AMBIENCE_VOICE, LAYERS, ambienceFor, motifFor, musicState } from '../../src/core/presentation/musicLayers';
import { TYPE_NAMES } from '../../src/core/contentSchema';

const base = { boss: false, lastFoe: false, playerHpShare: 1, enemyHpShare: 1 };

describe('music states and layers (#126, #128)', () => {
  it('ordinary fights are calm, then tense when hurt', () => {
    expect(musicState(base)).toBe('calm');
    expect(musicState({ ...base, enemyHpShare: 0.2 })).toBe('tense');
  });
  it('boss fights go to the boss state, then the ace state on the last foe', () => {
    expect(musicState({ ...base, boss: true })).toBe('boss');
    expect(musicState({ ...base, boss: true, lastFoe: true })).toBe('bossAce');
  });
  it('low player HP is danger in any fight', () => {
    expect(musicState({ ...base, boss: true, playerHpShare: 0.2 })).toBe('danger');
  });
  it('boss states stack more layers than calm', () => {
    expect(LAYERS.bossAce.length).toBeGreaterThan(LAYERS.boss.length);
    expect(LAYERS.boss.length).toBeGreaterThan(LAYERS.calm.length);
  });
});

describe('motifs and ambience (#129, #130)', () => {
  it('a motif is stable per id, 4-6 notes, ending on the root', () => {
    const m = motifFor('brock');
    expect(motifFor('brock')).toEqual(m);
    expect(m.length).toBeGreaterThanOrEqual(4);
    expect(m.length).toBeLessThanOrEqual(6);
    expect(m.at(-1)).toBe(0);
  });
  it('different characters get different motifs', () => {
    const ids = ['brock', 'misty', 'surge', 'erika', 'sabrina', 'blaine', 'giovanni', 'lance'];
    expect(new Set(ids.map((i) => motifFor(i).join(','))).size).toBeGreaterThan(5);
  });
  it('every type has an arena bed with a voice', () => {
    for (const t of TYPE_NAMES) expect(AMBIENCE_VOICE[ambienceFor(t)]).toBeDefined();
    expect(ambienceFor(undefined)).toBe('wind');
  });
});
