// Turns battle events into the sentences shown in the battle message box.

import type { Side } from '../core/battle/engine';
import type { Content } from '../core/contentSchema';
import type { RunEvent } from '../core/run';

const STAT_NAMES: Record<string, string> = {
  atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness',
};

const STATUS_INFLICTED: Record<string, string> = {
  brn: 'was burned!', psn: 'was poisoned!', par: 'is paralyzed! It may be unable to move!', slp: 'fell asleep!', frz: 'was frozen solid!',
};

export interface Names {
  /** Name of the player's Pokémon currently in battle. */
  player: string;
  /** Name of the opponent's Pokémon currently in battle. */
  enemy: string;
  /** "Youngster Joey" in a trainer battle; null for a wild Pokémon. */
  trainer: string | null;
  /** Name of any party Pokémon by its uid (for experience messages). */
  nameOf: (uid: string) => string;
}

const BALL_FAIL = ['Oh no! The Pokémon broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Gah! It was so close, too!'];

export function eventText(content: Content, names: Names, e: RunEvent): string | null {
  const foe = names.trainer ? 'opposing' : 'wild';
  const who = (side: Side) => (side === 'player' ? names.player : `The ${foe} ${names.enemy}`);
  const whoLower = (side: Side) => (side === 'player' ? names.player : `the ${foe} ${names.enemy}`);
  const species = (id: string) => content.species.get(id)?.name ?? id;
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
    case 'lastStand':
      return `${who(e.side)} hung on using its ${content.items.get(e.itemId)?.name ?? 'charm'}!`;
    case 'endure':
      return `${who(e.side)} hung on for you, out of love!`;
    case 'switchOut':
      return e.side === 'player' ? `Come back, ${names.player}!` : null;
    case 'switchIn':
      return e.side === 'player' ? `Go! ${species(e.speciesId)}!` : `${names.trainer ?? 'The trainer'} sent out ${species(e.speciesId)}!`;
    case 'item':
      return e.message;
    case 'ball':
      return e.caught ? `Gotcha! ${names.enemy} was caught!` : BALL_FAIL[e.shakes] ?? BALL_FAIL[0]!;
    case 'xp':
      return `${names.nameOf(e.uid)} gained ${e.amount} Exp. Points!`;
    case 'levelUp':
      return `${names.nameOf(e.uid)} grew to Lv. ${e.level}!`;
    case 'learnedMove':
      return `${names.nameOf(e.uid)} learned ${content.moves.get(e.moveId)?.name ?? e.moveId}!`;
    case 'wantsMove':
      return `${names.nameOf(e.uid)} wants to learn ${content.moves.get(e.moveId)?.name ?? e.moveId}.`;
  }
}
