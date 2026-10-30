// Per-trainer unlock challenges (trainerUnlocks.json): coverage, tiers, progress and claiming.

import { describe, expect, it } from 'vitest';
import { claimTrainer, describeRequirement, requirementParts, requirementProgress, trainerStatus } from '../../src/core/progress';
import { createProfile } from '../../src/core/profile';
import { COUNTER_NAMES } from '../../src/core/contentSchema';
import unlocksJson from '../../src/data/trainerUnlocks.json';
import { content } from './helpers';

const unlocks = unlocksJson.unlocks as Array<{ trainerId: string; tier: number; text: string; cost: number; requirement: { kind: string } }>;

describe('trainer unlock data', () => {
  it('gives every locked trainer their own challenge (Spooky reward and Trainer Evolutions excepted)', () => {
    const ids = new Set(unlocks.map((u) => u.trainerId));
    for (const a of content.archetypes.values()) {
      if (a.unlockedByDefault || a.evolvedFrom || a.id === 'hex-maniac') continue;
      // Hand-written early unlocks (Brock, Misty...) stay; everyone else has a challenge entry.
      const generic = ids.has(a.id);
      const handWritten = !!a.unlock && !(a.unlock.kind === 'total' && a.unlock.counter === 'trainersDefeated');
      expect(generic || handWritten, a.id).toBe(true);
      if (generic) expect(a.unlockTier, a.id).toBeGreaterThan(0);
      expect(a.unlock && a.unlock.kind !== 'claim', a.id).toBe(true);
    }
  });

  it('never repeats a challenge text', () => {
    expect(new Set(unlocks.map((u) => u.text)).size).toBe(unlocks.length);
  });

  it('scales cost and effort with tier: apex trainers ask for more parts and more credits', () => {
    const avg = (tier: number, f: (u: (typeof unlocks)[number]) => number) => {
      const list = unlocks.filter((u) => u.tier === tier);
      return list.reduce((s, u) => s + f(u), 0) / Math.max(1, list.length);
    };
    const parts = (u: (typeof unlocks)[number]) => (u.requirement.kind === 'all' ? (u.requirement as unknown as { parts: unknown[] }).parts.length : 1);
    for (let t = 2; t <= 5; t++) {
      expect(avg(t, (u) => u.cost)).toBeGreaterThan(avg(t - 1, (u) => u.cost));
      expect(avg(t, parts)).toBeGreaterThanOrEqual(avg(t - 1, parts));
    }
    expect(unlocks.find((u) => u.trainerId === 'cynthia-masters')!.tier).toBe(5);
    expect(unlocks.find((u) => u.trainerId === 'ball-guy')!.tier).toBe(1);
  });

  it('knows the new feat counters', () => {
    expect(COUNTER_NAMES).toContain('bossWinsMono.rock');
    expect(COUNTER_NAMES).toContain('bossWinsSolo');
  });
});

describe('challenge progress and claiming', () => {
  it('Brock needs an all-Rock boss win AND the rest of his challenge; progress shows each part', () => {
    const brock = content.archetypes.get('brock-classic')!;
    expect(brock.unlock?.kind).toBe('all');
    const p = createProfile(content, 'p');
    expect(trainerStatus(p, brock)).toBe('locked');
    const parts = (brock.unlock as { parts: Array<{ kind: string; counter?: string; atLeast?: number }> }).parts;
    const first = parts[0]!;
    expect(first.counter).toBe('bossWinsMono.rock');
    p.counters[first.counter!] = first.atLeast!;
    expect(trainerStatus(p, brock)).toBe('locked');
    const half = requirementProgress(p, brock.unlock!);
    expect(half.met).toBe(false);
    expect(half.current).toBeGreaterThan(0);
    for (const part of parts.slice(1)) p.counters[part.counter!] = part.atLeast!;
    expect(trainerStatus(p, brock)).toBe('claimable');
    p.bankCredits = brock.unlockCost;
    const claimed = claimTrainer(content, p, brock.id);
    expect(trainerStatus(claimed, brock)).toBe('unlocked');
    expect(claimed.bankCredits).toBe(0);
  });

  it('a "catch" part needs that species caught', () => {
    const ash = content.archetypes.get('ash')!;
    const p = createProfile(content, 'p');
    const catchPart = requirementParts(p, ash.unlock!).find((x) => x.label === 'Catch Pikachu')!;
    expect(catchPart.met).toBe(false);
    p.speciesCaught.push('pikachu');
    expect(requirementParts(p, ash.unlock!).find((x) => x.label === 'Catch Pikachu')!.met).toBe(true);
  });

  it('describes parts in plain words', () => {
    expect(describeRequirement({ kind: 'total', counter: 'bossWinsMono.rock', atLeast: 3 })).toBe('Win 3 boss battles with an all-Rock party');
    expect(describeRequirement({ kind: 'caught', species: 'pikachu' })).toBe('Catch Pikachu');
    const ash = content.archetypes.get('ash')!;
    expect(requirementParts(createProfile(content, 'p'), ash.unlock!).map((x) => x.label).some((l) => l === 'Catch Pikachu')).toBe(true);
  });

  it('the Starter Laboratory set of a trainer follows their challenge', () => {
    const pool = content.starterPools.get('trainer-brock-classic')!;
    expect(pool.unlock).toEqual(content.archetypes.get('brock-classic')!.unlock);
  });
});
