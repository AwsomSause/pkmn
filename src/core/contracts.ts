// The Contract Board (Electric plan §5): a few daily and weekly objectives that rotate with the
// date, each done within a single run and paid once through the claim ledger. The date is read by
// the screens and passed in (UTC), so the rules here never read the clock and the same date always
// gives the same board. Rewards are small and horizontal: Research Points, Bank Credits and candies.

import { z } from 'zod';
import contractsJson from '../data/contracts.json';
import { isoWeek } from './gameEvents';
import { claim } from './quests';
import type { Profile } from './state';

const ContractSchema = z.object({
  id: z.string(),
  period: z.enum(['daily', 'weekly']),
  text: z.string(),
  /** A run counter (core/contentSchema BASE_COUNTER_NAMES). */
  counter: z.string(),
  atLeast: z.number().int().positive(),
  reward: z.object({ researchPoints: z.number().int().min(0).default(0), bankCredits: z.number().int().min(0).default(0), candies: z.number().int().min(0).default(0) }),
});
const FileSchema = z.object({ daily: z.number().int().min(1), weekly: z.number().int().min(1), contracts: z.array(ContractSchema).min(1) });

export type Contract = z.infer<typeof ContractSchema>;
export const CONTRACTS = FileSchema.parse(contractsJson);

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

export const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** The board for a date: its daily and weekly contracts, with the key each one is claimed under. */
export interface BoardEntry {
  contract: Contract;
  /** "2026-10-30" for daily, "2026-W44" for weekly. */
  period: string;
  claimKey: string;
}

function pick(period: 'daily' | 'weekly', key: string, count: number): Contract[] {
  const pool = CONTRACTS.contracts.filter((c) => c.period === period);
  const chosen: Contract[] = [];
  const left = [...pool];
  for (let i = 0; i < count && left.length > 0; i++) {
    const at = hash(`contract:${key}:${i}`) % left.length;
    chosen.push(left.splice(at, 1)[0]!);
  }
  return chosen;
}

export function contractBoard(date: Date): BoardEntry[] {
  const day = dayKey(date);
  const week = isoWeek(date).label;
  return [
    ...pick('daily', day, CONTRACTS.daily).map((contract) => ({ contract, period: day, claimKey: `contract:${day}:${contract.id}` })),
    ...pick('weekly', week, CONTRACTS.weekly).map((contract) => ({ contract, period: week, claimKey: `contract:${week}:${contract.id}` })),
  ];
}

export interface ContractPayout {
  contract: Contract;
  period: string;
}

/** Pays every board contract the finished run met and that has not been paid yet (mutates `profile`). */
export function awardContracts(profile: Profile, runCounters: Record<string, number>, date: Date, now: string): ContractPayout[] {
  const out: ContractPayout[] = [];
  for (const entry of contractBoard(date)) {
    const c = entry.contract;
    if ((runCounters[c.counter] ?? 0) < c.atLeast || !claim(profile, entry.claimKey, now)) continue;
    profile.researchPoints += c.reward.researchPoints;
    profile.bankCredits += c.reward.bankCredits;
    profile.lifetimeBankCredits += c.reward.bankCredits;
    profile.candies += c.reward.candies;
    out.push({ contract: c, period: entry.period });
  }
  return out;
}

export const contractDone = (profile: Profile, entry: BoardEntry): boolean => Boolean(profile.claims?.[entry.claimKey]);

export function contractRewardText(r: Contract['reward']): string {
  const parts: string[] = [];
  if (r.researchPoints) parts.push(`${r.researchPoints} Research Points`);
  if (r.bankCredits) parts.push(`${r.bankCredits} Bank Credits`);
  if (r.candies) parts.push(`${r.candies} candies`);
  return parts.join(', ');
}
