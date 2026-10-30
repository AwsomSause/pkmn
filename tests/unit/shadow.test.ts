import { describe, expect, it } from 'vitest';
import { SHADOW_BATTLE_SOOTHE, SHADOW_HEART_START, battleSoothe, shadowDamageMultiplier, soothe, soothePartyAfterBattle } from '../../src/core/shadow';
import { createPokemon } from '../../src/core/pokemon';
import { PokemonInstanceSchema } from '../../src/core/state';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

const shadowMon = (uid = 'a') => {
  const m = createPokemon(content, 'gastly', 10, uid);
  m.shadow = { heart: SHADOW_HEART_START };
  return m;
};

describe('Shadow Pokémon (catalog #76-77)', () => {
  it('shadow attackers hit harder and shadow targets take more', () => {
    const plain = createPokemon(content, 'rattata', 5, 'p');
    expect(shadowDamageMultiplier(plain, plain)).toBe(1);
    expect(shadowDamageMultiplier(shadowMon(), plain)).toBeGreaterThan(1);
    expect(shadowDamageMultiplier(plain, shadowMon())).toBeGreaterThan(1);
  });
  it('a battle soothes the gauge, closer friends faster; at 0 it purifies', () => {
    const m = shadowMon();
    m.friendship = 100;
    expect(battleSoothe(m)).toBeGreaterThan(SHADOW_BATTLE_SOOTHE);
    expect(soothe(content, m, 30)).toBe(false);
    expect(m.shadow?.heart).toBe(70);
    expect(soothe(content, m, 70)).toBe(true);
    expect(m.shadow).toBeUndefined();
  });
  it('only winners that fought are soothed, and the gauge survives a save round trip', () => {
    const a = shadowMon('a');
    const b = shadowMon('b');
    const names = soothePartyAfterBattle(content, { party: [a, b] }, ['a']);
    expect(names).toEqual([]);
    expect(a.shadow!.heart).toBeLessThan(100);
    expect(b.shadow!.heart).toBe(100);
    expect(PokemonInstanceSchema.parse(JSON.parse(JSON.stringify(a))).shadow).toEqual(a.shadow);
  });
  it('the sanctuary event gives a Pokémon that starts shadowed', () => {
    const ev = JSON.stringify([...content.events.values()].find((e) => e.id === 'shadow-sanctuary'));
    expect(ev).toContain('"shadow":true');
  });

  it('a version 22 run loads with no shadow Pokémon', () => {
    const storage = new MemoryStorageProvider();
    const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'save22', archetypeId: 'red' }), 0);
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 22, savedAt: '', data: run }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(22);
    expect(loaded.data.party[0]!.shadow).toBeUndefined();
    expect(CURRENT_VERSIONS.run).toBeGreaterThanOrEqual(23);
  });
});
