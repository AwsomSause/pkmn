import { describe, expect, it } from 'vitest';
import { animsIn, getAnim, registerAnim, resolveAnim } from '../../src/core/presentation/animRegistry';

registerAnim({ id: 'test.burst', category: 'ui', ms: 400, color: '#fff', shakes: true, flashes: true, particles: true });

describe('animation registry', () => {
  it('rejects duplicate ids and finds by category', () => {
    expect(() => registerAnim({ id: 'test.burst', category: 'ui', ms: 1, color: '#000' })).toThrow();
    expect(getAnim('test.burst')?.ms).toBe(400);
    expect(animsIn('ui').some((d) => d.id === 'test.burst')).toBe(true);
  });
  it('full mode scales by the player settings', () => {
    const p = resolveAnim('test.burst', { mode: 'full', intensity: 0.5, shake: 0.25 })!;
    expect(p).toMatchObject({ play: true, reduced: false, ms: 400, flash: 0.5, shake: 0.25, particles: true });
  });
  it('reduced mode drops shake, flash and particles and shortens', () => {
    const p = resolveAnim('test.burst', { mode: 'reduced', intensity: 1 })!;
    expect(p).toMatchObject({ play: true, reduced: true, ms: 200, flash: 0, shake: 0, particles: false });
  });
  it('off does not play; Reduced Particles drops particles only', () => {
    expect(resolveAnim('test.burst', { mode: 'off', intensity: 1 })!.play).toBe(false);
    const p = resolveAnim('test.burst', { mode: 'full', intensity: 1, reduceParticles: true })!;
    expect(p.particles).toBe(false);
    expect(p.shake).toBe(1);
  });
  it('unknown ids return null', () => {
    expect(resolveAnim('nope', { mode: 'full', intensity: 1 })).toBeNull();
  });
});
