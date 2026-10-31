import { describe, expect, it } from 'vitest';
import abilities from '../../src/data/abilities.json';
import { abilityAnimId, abilityKind } from '../../src/core/presentation/abilityAnims';
import { animsIn, getAnim, resolveAnim } from '../../src/core/presentation/animRegistry';
import { planCues } from '../../src/core/presentation/cues';

const anims = { moves: {}, common: {} } as never;
const content = { moves: new Map(), abilities: new Map([['intimidate', { name: 'Intimidate' }]]) } as never;
const ev = [{ type: 'ability', side: 'enemy', ability: 'intimidate' }, { type: 'miss', side: 'player' }];

describe('ability and text animations', () => {
  it('every ability resolves to a registered animation', () => {
    for (const a of abilities as { id: string }[]) expect(getAnim(abilityAnimId(a.id)), a.id).toBeDefined();
    expect(animsIn('ability').length).toBe(12);
    expect(abilityKind('intimidate')).toBe('menace');
    expect(abilityKind('unknown-ability')).toBe('trigger');
  });
  it('plans an ability banner and a miss, with the ability name', () => {
    const cues = planCues(ev, content, anims, { mode: 'full', intensity: 1 });
    expect(cues[0]).toEqual([{ kind: 'abilityAnim', side: 'enemy', anim: 'ability.menace', label: 'Intimidate' }]);
    expect(cues[1]).toEqual([{ kind: 'textAnim', side: 'player', anim: 'text.miss', label: 'MISS' }]);
  });
  it('animations off plans nothing; reduced keeps a calm banner', () => {
    expect(planCues(ev, content, anims, { mode: 'off', intensity: 1 }).flat()).toEqual([]);
    const plan = resolveAnim('ability.menace', { mode: 'reduced', intensity: 1 })!;
    expect(plan).toMatchObject({ reduced: true, shake: 0, flash: 0, particles: false });
  });
});
