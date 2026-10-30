// The Contract Board (Electric §5).

import { describe, expect, it } from 'vitest';
import { BASE_COUNTER_NAMES } from '../../src/core/contentSchema';
import { CONTRACTS, awardContracts, contractBoard, contractDone } from '../../src/core/contracts';
import { content } from './helpers';
import { createProfile } from '../../src/core/profile';

const date = new Date('2026-10-30T12:00:00Z');

describe('Contract Board', () => {
  it('every contract reads a real run counter and has a reward', () => {
    for (const c of CONTRACTS.contracts) {
      expect(BASE_COUNTER_NAMES as readonly string[], c.id).toContain(c.counter);
      expect(c.reward.researchPoints + c.reward.bankCredits + c.reward.candies, c.id).toBeGreaterThan(0);
    }
  });

  it('the board is fixed by the date: 3 daily and 2 weekly, no repeats, and it rotates', () => {
    const board = contractBoard(date);
    expect(board.filter((e) => e.contract.period === 'daily')).toHaveLength(3);
    expect(board.filter((e) => e.contract.period === 'weekly')).toHaveLength(2);
    expect(new Set(board.map((e) => e.contract.id)).size).toBe(5);
    expect(contractBoard(date).map((e) => e.contract.id)).toEqual(board.map((e) => e.contract.id));
    const days = new Set<string>();
    for (let d = 0; d < 14; d++) days.add(contractBoard(new Date(date.getTime() + d * 86_400_000)).filter((e) => e.contract.period === 'daily').map((e) => e.contract.id).join());
    expect(days.size).toBeGreaterThan(3);
  });

  it('a run that meets a contract is paid once, never twice', () => {
    const profile = createProfile(content, 'p1');
    const big = Object.fromEntries(BASE_COUNTER_NAMES.map((n) => [n, 9999]));
    const first = awardContracts(profile, big, date, '2026-10-30T12:00:00Z');
    expect(first).toHaveLength(5);
    const points = profile.researchPoints;
    expect(points).toBeGreaterThan(0);
    expect(awardContracts(profile, big, date, '2026-10-30T13:00:00Z')).toHaveLength(0);
    expect(profile.researchPoints).toBe(points);
    for (const e of contractBoard(date)) expect(contractDone(profile, e)).toBe(true);
    expect(awardContracts(profile, {}, new Date(date.getTime() + 86_400_000 * 40), 'x')).toHaveLength(0);
  });
});

describe('Rival ghosts', () => {
  it("an archived rival's lead Pokémon returns as the new rival's ace, once per run", async () => {
    const { applyLegacy } = await import('../../src/core/rivals/legacy');
    const rival = { traits: { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50 }, style: 'a', memory: { lastBattle: { team: ['rattata', 'pidgey'] } } } as never as Parameters<typeof applyLegacy>[1];
    const run = { legacyRival: { name: 'Old', style: 'blitz', traits: { ambition: 90, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50 }, team: ['gengar', 'zubat'] }, story: { flags: {} } } as never as Parameters<typeof applyLegacy>[0];
    applyLegacy(run, rival);
    expect((rival as never as { memory: { lastBattle: { team: string[] } } }).memory.lastBattle.team).toEqual(['rattata', 'gengar']);
    applyLegacy(run, rival);
    expect((rival as never as { memory: { lastBattle: { team: string[] } } }).memory.lastBattle.team).toEqual(['rattata', 'gengar']);
  });
});
