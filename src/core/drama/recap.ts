// Battle recap card (catalog 14): after a gym, Elite Four, champion, boss or rival win, three facts
// from the fight itself: the Pokémon that dealt the most damage, the narrowest survival and the
// biggest hit. Tallied from the turn events the drama planner already sees; never touches the battle.

import type { BattleEvent } from '../battle/engine';
import type { Content } from '../contentSchema';
import type { BattleState, RunState } from '../state';
import { calcStats } from '../pokemon';

export interface RecapTally {
  /** Damage each of your Pokémon (uid) dealt to the foe. */
  dealt: Record<string, number>;
  /** The lowest HP share a surviving Pokémon of yours reached. */
  low: { uid: string; share: number } | null;
  /** The biggest single hit you landed. */
  bigHit: { uid: string; moveId: string; amount: number } | null;
  /** Foes each of your Pokémon (uid) knocked out. */
  kos: Record<string, number>;
}

/** KOs by one Pokémon that make a sweep, and the HP share that makes a clutch. */
const SWEEP_KOS = 3;
const CLUTCH_SHARE = 0.15;

export const freshRecap = (): RecapTally => ({ dealt: {}, low: null, bigHit: null, kos: {} });

/** Adds a turn's events to the tally. `activeUid` is the Pokémon of yours that was out for the turn. */
export function tallyRecap(content: Content, run: RunState, tally: RecapTally, activeUid: string | undefined, events: readonly BattleEvent[]): void {
  if (!activeUid) return;
  let mover: { side: string; moveId: string } | null = null;
  for (const e of events) {
    if (e.type === 'move') mover = { side: e.side, moveId: e.moveId };
    else if (e.type === 'faint') {
      if (e.side === 'enemy' && mover?.side === 'player') tally.kos = { ...tally.kos, [activeUid]: (tally.kos?.[activeUid] ?? 0) + 1 };
    } else if (e.type === 'damage') {
      if (e.side === 'enemy' && mover?.side === 'player') {
        tally.dealt[activeUid] = (tally.dealt[activeUid] ?? 0) + e.amount;
        if (!tally.bigHit || e.amount > tally.bigHit.amount) tally.bigHit = { uid: activeUid, moveId: mover.moveId, amount: e.amount };
      } else if (e.side === 'player' && e.hpAfter > 0) {
        const mon = run.party.find((m) => m.uid === activeUid);
        const share = mon ? e.hpAfter / Math.max(1, calcStats(content, mon).hp) : 1;
        if (!tally.low || share < tally.low.share) tally.low = { uid: activeUid, share };
      }
    }
  }
}

/** The recap lines for a won fight (empty when nothing worth telling happened). */
export function recapLines(content: Content, run: RunState, battle: BattleState): string[] {
  const tally = battle.drama.recap;
  if (!tally) return [];
  const name = (uid: string) => {
    const m = run.party.find((p) => p.uid === uid);
    return m ? (content.species.get(m.speciesId)?.name ?? 'Pokémon') : null;
  };
  const lines: string[] = [];
  const mvp = Object.entries(tally.dealt).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (mvp && name(mvp[0]) && mvp[1] > 0) lines.push(`MVP: ${name(mvp[0])} dealt ${mvp[1]} damage.`);
  if (tally.low && tally.low.share <= 0.25 && name(tally.low.uid)) lines.push(`Narrowest survival: ${name(tally.low.uid)} held on at ${Math.max(1, Math.round(tally.low.share * 100))}% HP.`);
  if (tally.bigHit && name(tally.bigHit.uid)) lines.push(`Turning point: ${name(tally.bigHit.uid)}'s ${content.moves.get(tally.bigHit.moveId)?.name ?? 'attack'} hit for ${tally.bigHit.amount}.`);
  // Signature moments (catalog 15): not scripted, found in the fight's own numbers.
  const sweeper = Object.entries(tally.kos ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (sweeper && sweeper[1] >= SWEEP_KOS && name(sweeper[0])) lines.push(`Signature moment: ${name(sweeper[0])} knocked out ${sweeper[1]} foes on its own.`);
  if (mvp && tally.low && tally.low.uid === mvp[0] && tally.low.share <= CLUTCH_SHARE && name(mvp[0])) lines.push(`Signature moment: ${name(mvp[0])} carried the fight from ${Math.max(1, Math.round(tally.low.share * 100))}% HP.`);
  return lines;
}
