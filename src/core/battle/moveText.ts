// Short plain-words description of what a move does, built from its data (no move text is stored). Pure.

import type { Move } from '../contentSchema';

const STAT: Record<string, string> = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness' };
const STATUS: Record<string, string> = { brn: 'burn the foe', psn: 'poison the foe', par: 'paralyze the foe', slp: 'put the foe to sleep', frz: 'freeze the foe' };
const FLAG: Record<string, string> = { contact: 'Makes contact', punch: 'Punching move', bite: 'Biting move', pulse: 'Pulse move', sound: 'Sound move', bullet: 'Ball/bomb move', slicing: 'Slicing move', wind: 'Wind move', powder: 'Powder move' };

export function moveFlagLabels(move: Move): string[] {
  return move.flags.map((f) => FLAG[f]).filter((f): f is string => Boolean(f));
}

/** Effect clauses in reading order, e.g. ["30% chance to burn the foe", "User takes recoil"]. */
export function moveEffectClauses(move: Move): string[] {
  const e = move.effects;
  const out: string[] = [];
  if (e.fixedDamage) out.push(e.fixedDamage === 'level' ? 'Damage equals the user’s level' : e.fixedDamage === 'psywave' ? 'Damage varies' : `Always deals ${e.fixedDamage} damage`);
  if (e.ohko) out.push('Knocks out in one hit if it lands');
  if (e.hits) out.push(e.hits[0] === e.hits[1] ? `Hits ${e.hits[0]} times` : `Hits ${e.hits[0]}–${e.hits[1]} times`);
  if (e.status) {
    const v = STATUS[e.status.id] ?? `inflict ${e.status.id} on the foe`;
    out.push(e.status.chance >= 100 ? `Will ${v}` : `${e.status.chance}% chance to ${v}`);
  }
  if (e.confuse) out.push(`${e.confuse.chance >= 100 ? 'Confuses' : `${e.confuse.chance}% chance to confuse`} the foe`);
  if (e.flinchChance) out.push(`${e.flinchChance}% chance to flinch the foe`);
  for (const c of e.statChanges ?? []) {
    const who = c.target === 'self' ? 'user’s' : 'foe’s';
    out.push(`${c.chance >= 100 ? '' : `${c.chance}% chance: `}${c.stages > 0 ? 'raises' : 'lowers'} the ${who} ${STAT[c.stat] ?? c.stat}${Math.abs(c.stages) > 1 ? ` by ${Math.abs(c.stages)}` : ''}`);
  }
  if (e.drain) out.push(`User regains ${Math.round(e.drain * 100)}% of the damage`);
  if (e.recoil) out.push(`User takes ${Math.round(e.recoil * 100)}% recoil`);
  if (e.recoilMaxHp) out.push(`User loses ${Math.round(e.recoilMaxHp * 100)}% of its max HP`);
  if (e.heal) out.push(`User restores ${Math.round(e.heal * 100)}% of its HP`);
  if (e.protect) out.push('Blocks attacks this turn');
  if (e.recharge) out.push('Must rest next turn');
  if (e.selfFaint) out.push('User faints');
  if (e.alwaysCrit) out.push('Always a critical hit');
  else if (move.critStage > 0) out.push('High critical-hit chance');
  if (e.switchOut) out.push(e.switchOut === 'baton' ? 'Switches out, passing stat changes' : 'Switches the user out');
  if (e.forceSwitch) out.push('Drags the foe out');
  if (e.rest) out.push('Sleeps two turns, heals fully');
  if (e.noop) out.push('Does nothing');
  if (move.priority !== 0) out.push(`Priority ${move.priority > 0 ? '+' : ''}${move.priority}`);
  return out;
}

/** One sentence-ish description: the clauses, or a plain line for a bare attack. */
export function moveDescription(move: Move): string {
  const c = moveEffectClauses(move);
  if (c.length > 0) return `${c.join('. ')}.`;
  return move.category === 'status' ? 'A support move.' : 'A straightforward attack.';
}
