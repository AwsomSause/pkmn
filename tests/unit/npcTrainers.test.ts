// Early-game NPC trainers (tools/build-npc-trainers.ts): count, early unlocks, art, teams, sorting.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { trainerGame, trainerRegion } from '../../src/core/trainerSort';
import { createProfile } from '../../src/core/profile';
import { applyRunToProfile } from '../../src/core/progress';
import { eventBattleWon } from '../../src/core/events';
import { createRun } from '../../src/core/run';
import { defaultPrep } from '../../src/core/runPrep';
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

  it('has its own art, a 5-species team in a matching starter pool, and a game and region', () => {
    const sprites = new Set<string>();
    for (const a of npcs) {
      sprites.add(a.spriteAssetId);
      const file = join(__dirname, '../../public/assets/images/bosses', `${a.spriteAssetId.slice('boss.'.length)}.png`);
      expect(existsSync(file), a.id).toBe(true);
      expect(a.signatureSpecies, a.id).toHaveLength(5);
      const pool = content.starterPools.get(a.signaturePool!);
      expect(pool?.species, a.id).toEqual(a.signatureSpecies);
      expect(trainerRegion(a)).not.toBe('Other');
      expect(trainerGame(a)).not.toBe('Other');
    }
    expect(sprites.size).toBe(npcs.length);
  });
});

describe('NPC trainer origins', () => {
  it('tags each class with the game and region it debuted in', () => {
    const o = (id: string) => [trainerGame(content.archetypes.get(id)!), trainerRegion(content.archetypes.get(id)!)];
    expect(o('npc-youngster-joey')).toEqual(['Red/Blue/Yellow', 'Kanto']);
    expect(o('npc-tuber-pip')).toEqual(['Ruby/Sapphire/Emerald', 'Hoenn']);
    expect(o('npc-pokemon-ranger-hal')).toEqual(['Diamond/Pearl/Platinum', 'Sinnoh']);
    expect(o('npc-cool-couple-leon-and-sky')).toEqual(['Black/White', 'Unova']);
  });
});

describe('NPC trainer recruit events', () => {
  it('every NPC has a meet event that recruits them, by battle win or by asking', () => {
    for (const a of npcs) {
      const e = content.events.get(`npc-meet-${a.id.slice('npc-'.length)}`);
      expect(e, a.id).toBeDefined();
      const wins = e!.choices[0]!.success.battle!.win;
      expect(wins, a.id).toContainEqual({ kind: 'recruit', trainer: a.id });
      expect(e!.choices[1]!.success.effects, a.id).toContainEqual({ kind: 'recruit', trainer: a.id });
    }
  });

  it('winning the battle recruits the trainer for good when the run ends, once', () => {
    const joey = content.archetypes.get('npc-youngster-joey')!;
    const run = createRun(content, { runId: 'r', seed: 'recruit', archetypeId: 'red', prep: defaultPrep(content) });
    eventBattleWon(content, run, { eventId: 'npc-meet-youngster-joey', choiceIndex: 0, success: true, sideId: 'a' } as never);
    expect(run.itemCounters?.['recruit:npc-youngster-joey']).toBe(1);
    const profile = createProfile(content, 'p');
    expect(profile.unlockedArchetypes).not.toContain(joey.id);
    applyRunToProfile(content, profile, run, '2026-10-30');
    applyRunToProfile(content, profile, run, '2026-10-30');
    expect(profile.unlockedArchetypes.filter((id) => id === joey.id)).toHaveLength(1);
  });
});
