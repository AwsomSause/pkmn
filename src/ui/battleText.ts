// Turns battle events into the sentences shown in the battle message box.

import type { BattleEvent, Side } from '../core/battle/engine';
import type { Content } from '../core/contentSchema';

const STAT_NAMES: Record<string, string> = {
  atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness',
};

const STATUS_INFLICTED: Record<string, string> = {
  brn: 'was burned!', psn: 'was poisoned!', par: 'is paralyzed! It may be unable to move!', slp: 'fell asleep!', frz: 'was frozen solid!',
};

export interface Names {
  player: string;
  enemy: string;
}

export function eventText(content: Content, names: Names, e: BattleEvent): string | null {
  const who = (side: Side) => (side === 'player' ? names.player : `The wild ${names.enemy}`);
  const whoLower = (side: Side) => (side === 'player' ? names.player : `the wild ${names.enemy}`);
  switch (e.type) {
    case 'move':
      return `${who(e.side)} used ${content.moves.get(e.moveId)?.name ?? e.moveId}!`;
    case 'noPp':
      return `${who(e.side)} has no moves left!`;
    case 'miss':
      return `${who(e.side)}'s attack missed!`;
    case 'damage': {
      const parts: string[] = [];
      if (e.crit) parts.push('A critical hit!');
      if (e.effectiveness > 1) parts.push("It's super effective!");
      if (e.effectiveness < 1) parts.push("It's not very effective…");
      return parts.length ? parts.join(' ') : null;
    }
    case 'noEffect':
      return `It doesn't affect ${whoLower(e.side)}…`;
    case 'fail':
      return 'But it failed!';
    case 'status':
      return `${who(e.side)} ${STATUS_INFLICTED[e.status]}`;
    case 'stat': {
      const amount = Math.abs(e.change) >= 2 ? (e.change > 0 ? 'rose sharply!' : 'harshly fell!') : e.change > 0 ? 'rose!' : 'fell!';
      return `${who(e.side)}'s ${STAT_NAMES[e.stat]} ${amount}`;
    }
    case 'statLimit':
      return `${who(e.side)}'s ${STAT_NAMES[e.stat]} won't go any ${e.up ? 'higher' : 'lower'}!`;
    case 'cant':
      switch (e.reason) {
        case 'slp':
          return `${who(e.side)} is fast asleep.`;
        case 'frz':
          return `${who(e.side)} is frozen solid!`;
        case 'par':
          return `${who(e.side)} is paralyzed! It can't move!`;
        case 'flinch':
          return `${who(e.side)} flinched and couldn't move!`;
      }
      return null;
    case 'wake':
      return `${who(e.side)} woke up!`;
    case 'thaw':
      return `${who(e.side)} thawed out!`;
    case 'residual':
      return `${who(e.side)} is hurt by its ${e.status === 'brn' ? 'burn' : 'poison'}!`;
    case 'drain':
      return `${who(e.side)} had its energy drained!`;
    case 'recoil':
      return `${who(e.side)} is damaged by recoil!`;
    case 'faint':
      return `${who(e.side)} fainted!`;
  }
}
