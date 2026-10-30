// Early-game NPC trainers (tools/build-npc-trainers.ts): count, early unlocks, art, teams, sorting.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { trainerGame, trainerRegion } from '../../src/core/trainerSort';
import { content } from './helpers';

const npcs = [...content.archetypes.values()].filter((a) => a.id.startsWith('npc-'));

describe('early-game NPC trainers', () => {
  it('has at least 50, all locked behind small early feats', () => {
    expect(npcs.length).toBeGreaterThanOrEqual(50);
    for (const a of npcs) {
      expect(a.unlockedByDefault, a.id).toBe(false);
      expect(a.unlock?.kind, a.id).toBe('total');
      expect(a.unlockCost, a.id).toBeLessThanOrEqual(300);
      expect(a.modifiers.length, a.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('has its own art, a 5-species team in a matching starter pool, and a Kanto origin', () => {
    const sprites = new Set<string>();
    for (const a of npcs) {
      sprites.add(a.spriteAssetId);
      const file = join(__dirname, '../../public/assets/images/bosses', `${a.spriteAssetId.slice('boss.'.length)}.png`);
      expect(existsSync(file), a.id).toBe(true);
      expect(a.signatureSpecies, a.id).toHaveLength(5);
      const pool = content.starterPools.get(a.signaturePool!);
      expect(pool?.species, a.id).toEqual(a.signatureSpecies);
      expect(trainerRegion(a)).toBe('Kanto');
      expect(trainerGame(a)).toBe('Red/Blue/Yellow');
    }
    expect(sprites.size).toBe(npcs.length);
  });
});
