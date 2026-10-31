import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UIE_ARENAS } from '../../src/assets/catalog';
import { pickUieArena, timeOfDay } from '../../src/core/arenaStyle';

const base = { seed: 'abc', stageIndex: 1, type: 'grass' as const };

describe('arena style', () => {
  it('every UIE arena has its three files', () => {
    for (const n of UIE_ARENAS) for (const part of ['bg', 'a', 'b']) expect(existsSync(`public/assets/images/arenas/uie/${n}_${part}.png`), `${n}_${part}`).toBe(true);
  });
  it('is stable for a seed and covers day, evening and night', () => {
    expect(timeOfDay('abc', 3)).toBe(timeOfDay('abc', 3));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => timeOfDay('seed', i)));
    expect(seen).toEqual(new Set(['day', 'eve', 'night']));
  });
  it('picks league halls, the final champion hall and the distortion', () => {
    expect(pickUieArena({ ...base, boss: { role: 'champion', eliteIndex: 0, final: true } })).toBe('champion2');
    expect(pickUieArena({ ...base, boss: { role: 'champion', eliteIndex: 0, final: false } })).toBe('champion1');
    expect(pickUieArena({ ...base, boss: { role: 'elite', eliteIndex: 2, final: false } })).toMatch(/^elite[1-8]$/);
    expect(pickUieArena({ ...base, boss: { role: 'gym', eliteIndex: 0, final: false } })).toBeNull();
    expect(pickUieArena({ ...base, shadowFoe: true })).toBe('distortion');
  });
  it('only ever names a known arena; types without a family keep their own', () => {
    for (let i = 0; i < 40; i++) {
      const n = pickUieArena({ seed: 's', stageIndex: i, type: 'water' });
      if (n) expect(UIE_ARENAS).toContain(n);
    }
    expect(pickUieArena({ seed: 's', stageIndex: 2, type: 'fire' })).toBeNull();
  });
});
