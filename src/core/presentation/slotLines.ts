// What a save slot shows on the Save Slots screen (pure; drawn by `scenes/SaveSlotsScene.ts`).

import { getArchetype } from '../archetypes';
import type { Content } from '../contentSchema';
import type { SlotPeek } from '../../save/saveManager';

export type SlotStatus = 'empty' | 'active' | 'between' | 'damaged';

export interface SlotCard {
  slot: number;
  status: SlotStatus;
  /** "Slot 2 · Red" or "Slot 3 · Empty". */
  title: string;
  /** Run status, region and stage, party, progress: top to bottom. */
  lines: string[];
  /** The party's species ids, for icons. */
  party: string[];
  /** When it was last saved (ISO), or null. */
  savedAt: string | null;
}

const cap = (s: string): string => (s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s);

/** "2026-11-01 10:55", the same on every machine. */
export function stampText(iso: string | null): string {
  if (!iso) return 'never saved';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'unknown time' : `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}

export function slotCard(content: Content, peek: SlotPeek): SlotCard {
  const base = { slot: peek.slot, savedAt: peek.savedAt, party: [] as string[] };
  const bad = [peek.profile, peek.run].find((r) => r.status === 'corrupt' || r.status === 'incompatible');
  if (bad && 'reason' in bad) return { ...base, status: 'damaged', title: `Slot ${peek.slot} · Damaged`, lines: ['This save could not be read.', bad.reason] };
  const profile = peek.profile.status === 'ok' ? peek.profile.data : null;
  const stats = profile?.stats;
  const progress = stats ? `Runs ${stats.runsEnded} · Battles won ${stats.battlesWon} · Bank ${profile!.bankCredits}` : '';
  if (peek.run.status === 'ok') {
    const run = peek.run.data;
    const region = cap(run.regionOrder[run.regionIndex] ?? '');
    const stage = run.stage ? `Stage ${run.stage.index + 1}` : 'Between stages';
    const top = run.party.reduce((m, p) => Math.max(m, p.level), 0);
    return {
      ...base,
      status: 'active',
      title: `Slot ${peek.slot} · ${getArchetype(content, run.archetypeId).name}`,
      lines: [`Run in progress · ${region} · ${stage}`, `Party ${run.party.length} · top Lv${top} · ₽${run.money}`, progress],
      party: run.party.map((p) => p.speciesId),
    };
  }
  if (stats && (stats.runsStarted > 0 || stats.runsEnded > 0)) {
    return { ...base, status: 'between', title: `Slot ${peek.slot} · Between runs`, lines: ['No run in progress (the last one is finished).', progress] };
  }
  return { ...base, status: 'empty', title: `Slot ${peek.slot} · Empty`, lines: ['Nothing saved here yet. Choose it to start fresh.'] };
}
