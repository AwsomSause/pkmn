// SOS calls (Milestone Z7): a hurt wild Pokémon may call a friend that takes the field in its place.

import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { freshSos, rollSos, sosEntry } from '../../src/core/battle/sos';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { BattleStateSchema, type PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

function wild(species: string, level = 20, playerSpecies = 'blissey') {
  const player = createPokemon(content, playerSpecies, playerSpecies === 'blissey' ? 80 : 60, 'p1');
  const foe = createPokemon(content, species, level, 'w1');
  const battle = createBattle('wild', [foe], 0, player.uid);
  const party: PokemonInstance[] = [player];
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(species)), captureRng: new Rng(hashSeed('c')), catchMultiplier: 1 };
  return { player, foe, battle, ctx };
}

describe('sos data', () => {
  it('lists about 600 species with sane rates and known allies', () => {
    expect(sosEntry('pidgey')?.rate).toBe(9);
    expect(sosEntry('metapod')?.allies).toEqual(['caterpie', 'butterfree']);
    expect(sosEntry('mewtwo')).toBeNull();
    for (const [id, e] of Object.entries(sosJson())) {
      expect(content.species.has(id), id).toBe(true);
      expect(e.rate).toBeGreaterThan(0);
      for (const a of e.allies ?? []) expect(content.species.has(a), a).toBe(true);
    }
  });
});
function sosJson() {
  return Object.fromEntries([...content.species.keys()].flatMap((id) => (sosEntry(id) ? [[id, sosEntry(id)!]] : [])));
}

describe('rollSos', () => {
  it('never calls outside plain wild fights, for unknown species, with a status, or after an answered call', () => {
    const { foe, battle } = wild('pidgey');
    foe.hp = 1;
    const input = { battle, caller: foe, maxHp: maxHp(content, foe), scary: false };
    battle.kind = 'trainer';
    expect(rollSos(input).kind).toBe('none');
    battle.kind = 'wild';
    foe.status = { id: 'brn' } as never;
    expect(rollSos(input).kind).toBe('none');
    foe.status = null;
    battle.sos = { ...freshSos(), answered: 1 };
    expect(rollSos(input).kind).toBe('none');
    const mew = createPokemon(content, 'mewtwo', 50, 'm');
    expect(rollSos({ ...input, battle: { ...battle, sos: undefined }, caller: mew }).kind).toBe('none');
  });

  it('is deterministic per caller and turn, and hurt callers call more often', () => {
    const rate = (hpShare: number) => {
      let calls = 0;
      for (let t = 1; t <= 400; t++) {
        const { foe, battle } = wild('pidgey');
        foe.uid = `w${t}`;
        foe.hp = Math.max(1, Math.floor(maxHp(content, foe) * hpShare));
        battle.turn = 2;
        const a = rollSos({ battle, caller: foe, maxHp: maxHp(content, foe), scary: false });
        expect(rollSos({ battle, caller: foe, maxHp: maxHp(content, foe), scary: false })).toEqual(a);
        if (a.kind !== 'none') calls++;
      }
      return calls;
    };
    expect(rate(0.2)).toBeGreaterThan(rate(1) * 2);
  });

  it('a friend is the caller\'s level minus 1 to 5 and one of its listed species', () => {
    for (let t = 1; t <= 300; t++) {
      const { foe, battle } = wild('metapod', 20);
      foe.uid = `m${t}`;
      foe.hp = 1;
      battle.sos = { ...freshSos(), lastAnswered: false, lastTurnCalled: 0 };
      const r = rollSos({ battle, caller: foe, maxHp: maxHp(content, foe), scary: true });
      if (r.kind === 'answered') {
        expect(['caterpie', 'butterfree']).toContain(r.species);
        expect(r.level).toBeGreaterThanOrEqual(15);
        expect(r.level).toBeLessThanOrEqual(19);
        return;
      }
    }
    throw new Error('no call was answered in 300 tries');
  });
});

describe('sos in the engine', () => {
  it('a called friend takes the field, and beating it brings the caller back', () => {
    let found = false;
    for (let t = 0; t < 400 && !found; t++) {
      const { foe, battle, ctx, player } = wild('pidgey', 20, 'magikarp');
      foe.uid = `w${t}`;
      foe.hp = 1;
      battle.sos = { ...freshSos(), lastAnswered: false };
      resolveTurn(ctx, { kind: 'move', index: 0 });
      if (!battle.sos?.allyUid) {
        continue;
      }
      found = true;
      expect(battle.enemyTeam).toHaveLength(2);
      expect(battle.enemyTeam[battle.enemyIndex]!.uid).toBe(battle.sos.allyUid);
      expect(battle.outcome ?? null).toBeNull();
      const ally = battle.enemyTeam[battle.enemyIndex]!;
      ally.hp = 0;
      resolveTurn(ctx, { kind: 'move', index: 0 });
      // The friend fainted: the caller is back on the field and the fight goes on (or ended in the player's favour only after the caller falls too).
      expect(battle.enemyTeam[battle.enemyIndex]!.uid).toBe(foe.uid);
      expect(player.hp).toBeGreaterThan(0);
      expect(BattleStateSchema.safeParse(JSON.parse(JSON.stringify(battle))).success).toBe(true);
    }
    expect(found).toBe(true);
  });
});
