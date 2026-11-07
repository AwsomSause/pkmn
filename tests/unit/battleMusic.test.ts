import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_VARIANT_IDS, TRAINER_TRACKS, WILD_TRACKS, battleTrack, lowHpTrack, LOW_HP_TRACK, MAP_TRACKS, mapTrack, ROLE_TRACK_IDS, VICTORY_TRACKS, EXPEDITION_TRACK_IDS, expeditionTrack, RAID_TRACK_IDS, raidMusic, victoryTrack } from '../../src/core/presentation/battleMusic';
import { FIXED_ASSETS } from '../../src/assets/catalog';
import { buildContent } from '../../src/data';

describe('battle music variants', () => {
  it('no key keeps the default songs; a key picks a stable song per kind of fight', () => {
    expect(battleTrack({ raidTrack: null, trainer: false, gbSounds: false })).toBe('bgm.battle');
    expect(battleTrack({ raidTrack: null, trainer: true, gbSounds: false })).toBe('bgm.battle_trainer');
    const wild = new Set(Array.from({ length: 80 }, (_, i) => battleTrack({ raidTrack: null, trainer: false, gbSounds: false, variantKey: `seed:${i}` })));
    expect(wild).toEqual(new Set(WILD_TRACKS));
    const trainer = new Set(Array.from({ length: 80 }, (_, i) => battleTrack({ raidTrack: null, trainer: true, gbSounds: false, variantKey: `seed:${i}` })));
    expect(trainer).toEqual(new Set(TRAINER_TRACKS));
    const k = { raidTrack: null, trainer: true, gbSounds: false, variantKey: 'x:3' } as const;
    expect(battleTrack({ ...k, role: 'gym' })).toBe(battleTrack({ ...k, role: 'gym' }));
    expect(battleTrack({ ...k, role: 'rival' })).toBe('bgm.battle_rival');
    expect(battleTrack({ ...k, raidTrack: 'bgm.raid.max' })).toBe('bgm.raid.max');
    expect(battleTrack({ ...k, gbSounds: true })).toBe('bgm.battle_gb');
  });
  it('every variant song is in the catalog and its file ships; the low-HP swap covers them', () => {
    const files = new Map(FIXED_ASSETS.map((a) => [a.id, a.path]));
    for (const id of BATTLE_VARIANT_IDS) {
      expect(files.has(id), id).toBe(true);
      expect(existsSync(`public/assets/${files.get(id)}`), id).toBe(true);
    }
    expect(lowHpTrack('bgm.battle_wild_oras', 0.1)).toBe(LOW_HP_TRACK);
    expect(lowHpTrack('bgm.battle_gym_oras', 0.1)).toBe('bgm.battle_gym_oras');
  });
});

describe('battle music', () => {
  it('ordinary fights swap to the low-HP song under a fifth of HP; bosses, raids and GB Sounds keep theirs', () => {
    expect(lowHpTrack('bgm.battle', 0.19)).toBe(LOW_HP_TRACK);
    expect(lowHpTrack('bgm.battle_trainer', 0.1)).toBe(LOW_HP_TRACK);
    expect(lowHpTrack('bgm.battle', 0.2)).toBe('bgm.battle');
    expect(lowHpTrack('bgm.battle_leader', 0.05)).toBe('bgm.battle_leader');
    expect(lowHpTrack('bgm.raid.max', 0.05)).toBe('bgm.raid.max');
    expect(lowHpTrack('bgm.battle_gb', 0.05)).toBe('bgm.battle_gb');
    expect(FIXED_ASSETS.some((a) => a.id === LOW_HP_TRACK)).toBe(true);
  });
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

describe('boss and rival music', () => {
  it('each role has its own song; ordinary trainers and wild keep theirs', () => {
    const base = { raidTrack: null, trainer: true, gbSounds: false };
    const picks = (['rival', 'gym', 'elite', 'champion', 'final'] as const).map((role) => battleTrack({ ...base, role }));
    expect(new Set(picks).size).toBe(5);
    expect(battleTrack({ ...base, role: 'trainer' })).toBe('bgm.battle_trainer');
    expect(battleTrack({ ...base, trainer: false, role: 'wild' })).toBe('bgm.battle');
    expect(battleTrack({ raidTrack: 'bgm.raid.max', trainer: true, gbSounds: true, role: 'gym' })).toBe('bgm.raid.max');
    expect(battleTrack({ ...base, gbSounds: true, role: 'gym' })).toBe('bgm.battle_gb');
  });

  it('the Elite Four win song is its own; every role and victory song is in the catalog', () => {
    expect(victoryTrack({ trainer: true, boss: true, role: 'elite' })).toBe('bgm.victory_elite');
    expect(victoryTrack({ trainer: true, boss: true, role: 'champion' })).toBe('bgm.victory_leader');
    const ids = new Set(FIXED_ASSETS.map((a) => a.id));
    for (const id of [...ROLE_TRACK_IDS, ...VICTORY_TRACKS, 'bgm.map', 'bgm.hub', 'bgm.shop', 'bgm.event']) expect(ids.has(id), id).toBe(true);
  });
});

describe('raid music', () => {
  it('tier picks the set, the raid id picks a stable variant, every track is in the catalog', () => {
    expect(raidMusic(null, false, 'x')).toBeNull();
    expect(raidMusic(1, false, 'a')).toMatch(/^bgm\.raid\.basic/);
    expect(raidMusic(3, false, 'a')).toMatch(/^bgm\.raid\.ultra/);
    expect(raidMusic(4, false, 'a')).toMatch(/^bgm\.raid\.max/);
    expect(raidMusic(6, false, 'a')).toMatch(/^bgm\.raid\.tera/);
    expect(raidMusic(null, true, 'totem')).toMatch(/^bgm\.raid\.tera/);
    expect(raidMusic(4, false, 'den-7')).toBe(raidMusic(4, false, 'den-7'));
    const seen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => raidMusic(4, false, k)));
    expect(seen.size).toBeGreaterThan(1);
    const ids = new Set(FIXED_ASSETS.map((a) => a.id));
    for (const id of RAID_TRACK_IDS) expect(ids.has(id)).toBe(true);
  });
});

describe('expedition music', () => {
  it('one adventure song per tier, clamped, all in the catalog', () => {
    expect(expeditionTrack(1)).toBe('bgm.raid.adventure.basic');
    expect(expeditionTrack(9)).toBe('bgm.raid.adventure.tera');
    const ids = new Set(FIXED_ASSETS.map((a) => a.id));
    for (const id of EXPEDITION_TRACK_IDS) expect(ids.has(id)).toBe(true);
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

describe('map music', () => {
  it('a region keeps its song, every song gets used, all are in the catalog', () => {
    expect(mapTrack('kanto')).toBe(mapTrack('kanto'));
    const seen = new Set(Array.from({ length: 200 }, (_, i) => mapTrack(`region-${i}`)));
    expect(seen).toEqual(new Set(MAP_TRACKS));
    const ids = new Set(FIXED_ASSETS.map((a) => a.id));
    for (const id of MAP_TRACKS) expect(ids.has(id), id).toBe(true);
  });
});
