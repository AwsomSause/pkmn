import { describe, expect, it } from 'vitest';
import { battleTrack, victoryTrack } from '../../src/core/presentation/battleMusic';
import { buildContent } from '../../src/data';

describe('battle music', () => {
  it('raids keep their track; GB Sounds swaps the normal battle tracks for the Game Boy loop', () => {
    expect(battleTrack({ raidTrack: 'bgm.raid.max', trainer: false, gbSounds: true })).toBe('bgm.raid.max');
    expect(battleTrack({ raidTrack: null, trainer: true, gbSounds: true })).toBe('bgm.battle_gb');
    expect(battleTrack({ raidTrack: null, trainer: true, gbSounds: false })).toBe('bgm.battle_trainer');
    expect(battleTrack({ raidTrack: null, trainer: false, gbSounds: false })).toBe('bgm.battle');
  });

  it('bosses get the leader fanfare, then trainers, then wild', () => {
    expect(victoryTrack({ trainer: true, boss: true })).toBe('bgm.victory_leader');
    expect(victoryTrack({ trainer: true, boss: false })).toBe('bgm.victory_trainer');
    expect(victoryTrack({ trainer: false, boss: false })).toBe('bgm.victory_wild');
  });
});

describe('form sprites from the Essentials kit', () => {
  const content = buildContent();
  it('Resolute Keldeo and Core Minior have their own art', () => {
    expect(content.species.get('keldeo-resolute')?.assets.sprite).toBe('custom/keldeo-resolute');
    expect(content.species.get('minior-core')?.assets.sprite).toBe('custom/minior-core');
  });

  it('the Keldeo Resolution switches Keldeo to its Resolute form', () => {
    const hooks = content.catalog.get('keldeo-resolution')!.effect;
    expect(hooks).toMatchObject({ kind: 'held', hooks: expect.arrayContaining([{ hook: 'formHeld', from: 'keldeo', to: 'keldeo-resolute' }]) });
  });
});
