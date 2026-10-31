import { describe, expect, it } from 'vitest';
import story from '../../src/data/story.json';
import { animsIn, getAnim } from '../../src/core/presentation/animRegistry';
import { planCues } from '../../src/core/presentation/cues';
import { hyperAnimId, planFor } from '../../src/core/presentation/storyAnims';
import { DEFAULT_SETTINGS } from '../../src/save/saveManager';

const anims = { moves: {}, common: {} } as never;
const content = { moves: new Map(), abilities: new Map() } as never;

describe('Hyper/Overdrive, interaction and rival animations', () => {
  it('every story definition resolves to a registered overdrive animation', () => {
    for (const d of story.definitions as { id: string }[]) expect(getAnim(hyperAnimId(d.id)), d.id).toBeDefined();
    expect(hyperAnimId('toughened-it-out')).toBe('overdrive.toughened');
    expect(hyperAnimId('pushed-back-up')).toBe('overdrive.rise');
    expect(hyperAnimId('felt-a-bond')).toBe('overdrive.bond');
    expect(hyperAnimId('heated-rivalry')).toBe('overdrive.rivalry');
    expect(hyperAnimId('no-such-moment')).toBe('overdrive.moment');
  });
  it('registers the interaction and rival groups', () => {
    expect(animsIn('overdrive').length).toBe(9);
    expect(animsIn('interaction').map((d) => d.id)).toEqual(expect.arrayContaining(['interaction.enter', 'interaction.item', 'interaction.catch']));
    expect(animsIn('rival').map((d) => d.id)).toEqual(['rival.intro', 'rival.ace', 'rival.win', 'rival.lose']);
  });
  it('plans a flourish for a Hyper moment, a switch-in and an item; off plans none', () => {
    const ev = [
      { type: 'hyper', side: 'player', uid: 'u1', defId: 'toughened-it-out', variant: null, hpAfter: 1, cured: false },
      { type: 'switchIn', side: 'enemy', uid: 'u2', speciesId: 'rattata', level: 3 },
      { type: 'item', itemId: 'potion', targetUid: 'u1', message: '', hpAfter: 10 },
    ];
    const cues = planCues(ev, content, anims, { mode: 'full', intensity: 1 });
    expect(cues[0]).toEqual([{ kind: 'storyAnim', side: 'player', anim: 'overdrive.toughened' }]);
    expect(cues[1]).toEqual([{ kind: 'storyAnim', side: 'enemy', anim: 'interaction.enter' }]);
    expect(cues[2]).toEqual([{ kind: 'storyAnim', side: 'player', anim: 'interaction.item' }]);
    expect(planCues(ev, content, anims, { mode: 'off', intensity: 1 }).flat()).toEqual([]);
  });
  it('each group switch and Disable All turn its animations off without losing the others', () => {
    expect(planFor('overdrive.rise', DEFAULT_SETTINGS)?.play).toBe(true);
    expect(planFor('overdrive.rise', { ...DEFAULT_SETTINGS, hyperAnimations: false })).toBeNull();
    expect(planFor('rival.intro', { ...DEFAULT_SETTINGS, rivalAnimations: false })).toBeNull();
    expect(planFor('rival.intro', { ...DEFAULT_SETTINGS, hyperAnimations: false })?.play).toBe(true);
    expect(planFor('interaction.catch', { ...DEFAULT_SETTINGS, disableAllAnimations: true })).toBeNull();
  });
  it('reduced motion drops shake, flash and particles', () => {
    expect(planFor('overdrive.rise', { ...DEFAULT_SETTINGS, battleAnimations: 'reduced' })).toMatchObject({ reduced: true, shake: 0, flash: 0, particles: false });
  });
});
