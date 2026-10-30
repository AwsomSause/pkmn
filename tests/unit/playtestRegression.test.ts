// Runs found by tools/playtest.ts that used to crash the bot or soft-lock the run.
import { describe, expect, it } from 'vitest';
import { autoplay } from './autoplay';

describe('playtest regressions', () => {
  it('a double KO the player wins never leaves a fainted team on the map', () => {
    const run = autoplay({ seed: 'pt131', archetypeId: 'spr-pt-lucas', rules: { modeId: 'spooky', difficultyId: 'standard', modifierIds: ['single-region-dex', 'limited-party'], deathBlock: false }, steps: 400, smart: true });
    expect(run.phase).toBe('over');
  });
  it('the bot lets a caught Pokémon go when Monotype or No Duplicate Species refuses it', () => {
    for (const [seed, archetypeId, modifierIds] of [['pt40', 'brock-masters', ['monotype', 'no-battle-items']], ['pt322', 'falkner', ['single-region-dex', 'no-duplicate-species']]] as const) {
      expect(() => autoplay({ seed, archetypeId, rules: { modeId: 'endless', difficultyId: 'standard', modifierIds, deathBlock: false }, steps: 300, smart: true })).not.toThrow();
    }
  });
});
