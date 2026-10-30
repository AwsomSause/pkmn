import { describe, expect, it } from 'vitest';
import { environmentStory } from '../../src/core/presentation/environmentStory';

const base = { crisis: 0, legendClues: 0, themeName: 'Viridian Woods', event: null, shadowFoe: false };

describe('environmental storytelling (catalog 67)', () => {
  it('a calm ordinary stage shows nothing extra', () => {
    expect(environmentStory(base)).toEqual({ hints: [], factionColor: null });
  });
  it('the crisis meter brings haze, then a storm', () => {
    expect(environmentStory({ ...base, crisis: 1 }).hints).toEqual(['haze']);
    expect(environmentStory({ ...base, crisis: 4 }).hints).toEqual(['storm']);
  });
  it('a villain event shows its team colours; poachers count too', () => {
    const rocket = environmentStory({ ...base, event: { id: 'rocket-ambush', group: 'Tricksters, villains and teams' } });
    expect(rocket.hints).toContain('faction');
    expect(rocket.factionColor).toBe(0xd02828);
    expect(environmentStory({ ...base, event: { id: 'poacher-hideout', group: 'Wild Pokémon scenes' } }).hints).toContain('faction');
  });
  it('legend clues bring ruins, a lab theme lab panels, a Shadow foe miasma', () => {
    expect(environmentStory({ ...base, legendClues: 1 }).hints).toEqual(['ruins']);
    expect(environmentStory({ ...base, themeName: 'The Chemical Plant' }).hints).toEqual(['lab']);
    expect(environmentStory({ ...base, shadowFoe: true }).hints).toEqual(['corrupted']);
  });
});
