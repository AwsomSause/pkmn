// Words and colours for the Bond screen (no Phaser here, so tests can read them).

import { bondMood, bondOf, BOND_RULES, practicedPair } from '../core/bond';
import type { BondKey } from '../core/bond';
import type { PokemonInstance, RunState } from '../core/state';
import type { Content } from '../core/contentSchema';

/** The bars, in the order shown, with their colour and plain-language label. */
export const BOND_BARS: { key: BondKey; label: string; color: number }[] = [
  { key: 'trust', label: 'Trust', color: 0x38c8ff },
  { key: 'affection', label: 'Affection', color: 0xff6fb4 },
  { key: 'respect', label: 'Respect', color: 0xffc840 },
  { key: 'synchronization', label: 'Sync', color: 0x7ff3ff },
  { key: 'confidence', label: 'Confidence', color: 0x8cf070 },
  { key: 'autonomy', label: 'Will', color: 0xb070ff },
  { key: 'strain', label: 'Strain', color: 0xff4f5a },
];

export const MOOD_LOOK: Record<'wary' | 'steady' | 'devoted', { color: number; text: string; hint: string }> = {
  wary: { color: 0xff8a3c, text: 'Wary', hint: 'Wary: it doesn’t trust you yet, and a willful one may refuse a reckless command.' },
  steady: { color: 0x38c8ff, text: 'Steady', hint: 'Steady: it follows your lead.' },
  devoted: { color: 0xff6fb4, text: 'Devoted', hint: 'Devoted: in sync with you; it may act on its own when a command can’t work, or reveal a new move.' },
};

/** The hint line under the list: mood meaning, partners, and moments together. */
export function bondHint(content: Content, run: RunState, mon: PokemonInstance): string {
  const bond = bondOf(run, mon.uid);
  const mood = MOOD_LOOK[bondMood(bond)];
  const partners = run.party.filter((m) => m.uid !== mon.uid && practicedPair(run, mon.uid, m.uid)).map((m) => content.species.get(m.speciesId)?.name ?? m.speciesId);
  const parts = [mood.hint];
  if (partners.length > 0) parts.push(`Practiced partner: ${partners.join(', ')}.`);
  if (bond.sharedHistory > 0) parts.push(`${bond.sharedHistory} moment${bond.sharedHistory === 1 ? '' : 's'} together.`);
  if (bond.autonomy >= BOND_RULES.refuse.minAutonomy && bond.trust <= BOND_RULES.refuse.maxTrust) parts.push('Careful: it may refuse a move that would faint it.');
  return parts.join('  ');
}
