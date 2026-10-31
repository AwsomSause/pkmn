import { describe, expect, it } from 'vitest';
import abilities from '../../src/data/abilities.json';
import { abilityAnimId, abilityKind, abilityPackAnim, impliedAbility } from '../../src/core/presentation/abilityAnims';
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
    expect(cues[0]).toEqual([{ kind: 'abilityAnim', side: 'enemy', anim: 'ability.menace', label: 'Intimidate', ability: 'intimidate' }]);
    expect(cues[1]).toEqual([{ kind: 'textAnim', side: 'player', anim: 'text.miss', label: 'MISS' }]);
  });
  it('animations off plans nothing; reduced keeps a calm banner', () => {
    expect(planCues(ev, content, anims, { mode: 'off', intensity: 1 }).flat()).toEqual([]);
    const plan = resolveAnim('ability.menace', { mode: 'reduced', intensity: 1 })!;
    expect(plan).toMatchObject({ reduced: true, shake: 0, flash: 0, particles: false });
  });
  it('maps abilities to pack animations that exist on disk', async () => {
    const { existsSync } = await import('node:fs');
    for (const a of abilities as { id: string }[]) {
      const pack = abilityPackAnim(a.id);
      if (pack) expect(existsSync(`public/assets/battle-anims/${pack.name}.json`), `${a.id} -> ${pack.name}`).toBe(true);
    }
    expect(abilityPackAnim('intimidate')).toEqual({ name: 'scary-face', onFoe: true });
    expect(abilityPackAnim('drizzle')?.name).toBe('common-rain');
  });
  it('works out unannounced abilities from the event and the ability on that side', () => {
    const has = (m: Record<string, string>) => (side: 'player' | 'enemy') => m[side] ?? null;
    expect(impliedAbility({ type: 'weather' }, { type: 'switch' }, has({ enemy: 'drizzle' }))).toEqual({ side: 'enemy', ability: 'drizzle' });
    expect(impliedAbility({ type: 'weather' }, { type: 'move' }, has({ enemy: 'drizzle' }))).toBeNull();
    expect(impliedAbility({ type: 'noEffect', side: 'enemy' }, { type: 'move' }, has({ enemy: 'volt-absorb' }))).toEqual({ side: 'enemy', ability: 'volt-absorb' });
    expect(impliedAbility({ type: 'heal', side: 'player' }, { type: 'turnEnd' }, has({ player: 'regenerator' }))).toEqual({ side: 'player', ability: 'regenerator' });
    expect(impliedAbility({ type: 'heal', side: 'player' }, { type: 'turnEnd' }, has({ player: 'intimidate' }))).toBeNull();
    const cues = planCues([{ type: 'faint', side: 'player' }, { type: 'stat', side: 'enemy', stat: 'atk', change: 1 }] as never, content, anims, { mode: 'full', intensity: 1 }, (s) => (s === 'enemy' ? 'moxie' : null));
    expect(cues[1]![0]).toMatchObject({ kind: 'abilityAnim', ability: 'moxie', anim: 'ability.boost' });
  });
});

describe('contact punishers', () => {
  // The engine announces these when they trigger (afterHitAbilities), so the cue planner already animates them.
  it.each(['static', 'flame-body', 'poison-point', 'effect-spore', 'rough-skin', 'iron-barbs', 'cute-charm', 'gooey', 'tangling-hair', 'mummy', 'aftermath', 'cursed-body', 'perish-body', 'wandering-spirit', 'toxic-debris', 'innards-out'])('%s plays the contact animation', (id) => {
    const cues = planCues([{ type: 'ability', side: 'enemy', ability: id }] as never, content, anims, { mode: 'full', intensity: 1 });
    expect(cues[0]![0]).toMatchObject({ kind: 'abilityAnim', side: 'enemy', anim: 'ability.contact', ability: id });
  });
});
