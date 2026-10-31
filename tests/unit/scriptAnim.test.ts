import { describe, expect, it } from 'vitest';
import ebdx from '../../src/data/ebdxAnims.json';
import moveAnims from '../../src/data/moveAnims.json';
import { ease, lifeAlpha, parseEbdxAnims, scatter, scriptAssets } from '../../src/core/presentation/scriptAnim';
import { existsSync } from 'node:fs';

describe('scripted EBDX move animations', () => {
  const file = parseEbdxAnims(ebdx);

  it('every script validates and every mapped move has a presentation entry with that script', () => {
    for (const [move, script] of Object.entries(file.moves)) {
      expect((moveAnims.moves as Record<string, { script?: string }>)[move]?.script).toBe(script);
    }
  });

  it('every picture and sound a script names exists in public/assets', () => {
    const { images, sounds } = scriptAssets(file);
    for (const n of images) expect(existsSync(`public/assets/images/packs/ebdx/moves/${n}.png`), n).toBe(true);
    for (const n of sounds) expect(existsSync(`public/assets/audio/ebdx/${n}.m4a`), n).toBe(true);
  });

  it('every layer ends inside the script length', () => {
    for (const [name, s] of Object.entries(file.scripts)) {
      for (const l of s.layers) expect(l.start + l.stagger * (l.count - 1) + l.dur, name).toBeLessThanOrEqual(s.length);
    }
  });

  it('rejects a move that points at a missing script', () => {
    expect(() => parseEbdxAnims({ ...ebdx, moves: { tackle: 'nope' } })).toThrow(/missing script/);
  });

  it('scatter is stable, in range, and varies', () => {
    expect(scatter('a', 1, 2, 3)).toBe(scatter('a', 1, 2, 3));
    const xs = Array.from({ length: 50 }, (_, i) => scatter('a', 0, i, 0));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(40);
  });

  it('easing and fading stay in 0..1 and hit their ends', () => {
    for (const k of ['linear', 'out', 'in', 'inOut'] as const) {
      expect(ease(k, 0)).toBe(0);
      expect(ease(k, 1)).toBeCloseTo(1);
    }
    expect(lifeAlpha(-0.1, [0.2, 0.7])).toBe(0);
    expect(lifeAlpha(0.1, [0.2, 0.7])).toBeCloseTo(0.5);
    expect(lifeAlpha(0.5, [0.2, 0.7])).toBe(1);
    expect(lifeAlpha(1.1, [0.2, 0.7])).toBe(0);
  });
});
