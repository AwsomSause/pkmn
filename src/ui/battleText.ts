// Turns battle events into the sentences shown in the battle message box.

import type { Side } from '../core/battle/engine';
import type { Content, Terrain, Weather } from '../core/contentSchema';
import type { RunEvent } from '../core/run';

const STAT_NAMES: Record<string, string> = {
  atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasiveness',
};

const STATUS_INFLICTED: Record<string, string> = {
  brn: 'was burned!', psn: 'was poisoned!', par: 'is paralyzed! It may be unable to move!', slp: 'fell asleep!', frz: 'was frozen solid!',
};

const WEATHER_START: Record<Weather, string> = {
  rain: 'It started to rain!', sun: 'The sunlight turned harsh!', sand: 'A sandstorm kicked up!', snow: 'It started to snow!', hail: 'It started to hail!',
};
const WEATHER_END: Record<Weather, string> = {
  rain: 'The rain stopped.', sun: 'The harsh sunlight faded.', sand: 'The sandstorm subsided.', snow: 'The snow stopped.', hail: 'The hail stopped.',
};

const TERRAIN_START: Record<Terrain, string> = {
  electric: 'Electric current ran across the battlefield!', grassy: 'Grass grew to cover the battlefield!', misty: 'Mist swirled around the battlefield!', psychic: 'The battlefield got weird!',
};
const TERRAIN_END: Record<Terrain, string> = {
  electric: 'The electric current disappeared.', grassy: 'The grass disappeared.', misty: 'The mist disappeared.', psychic: 'The weirdness disappeared.',
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
        case 'recharge':
          return `${who(e.side)} must recharge!`;
        case 'truant':
          return `${who(e.side)} is loafing around!`;
      }
      return null;
    case 'ability':
      return `[${who(e.side)}'s ${content.abilities.get(e.ability)?.name ?? e.ability}]`;
    case 'cured':
      return `${who(e.side)}'s status was cured!`;
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
    case 'hyper':
      // The story layer normally shows the moment's own lines instead.
      return e.cured ? `${who(e.side)} shook off its status!` : `${who(e.side)} won't give up!`;
    case 'held': {
      const item = content.catalog.get(e.itemId)?.name ?? content.items.get(e.itemId)?.name ?? 'item';
      switch (e.what) {
        case 'heal':
          return `${who(e.side)} restored HP using its ${item}!`;
        case 'hurt':
          return `${who(e.side)} was hurt by its ${item}!`;
        case 'recoil':
          return `${who(e.side)} lost some of its HP!`;
        case 'helmet':
          return `${who(e.side)} was hurt by the ${item}!`;
        case 'cure':
          return `${who(e.side)}'s ${item} cured it!`;
        case 'gem':
          return `The ${item} strengthened ${whoLower(e.side)}'s power!`;
        case 'survive':
          return `${who(e.side)} hung on using its ${item}!`;
        case 'pop':
          return `${who(e.side)}'s Air Balloon popped!`;
        case 'balloon':
          return `${who(e.side)} floats in the air with its Air Balloon!`;
        case 'orb':
          return `${who(e.side)} was affected by the ${item}!`;
        case 'resist':
          return `The ${item} weakened the damage to ${whoLower(e.side)}!`;
        case 'stat':
          return e.stat === 'crit' ? `${who(e.side)} used its ${item} to get pumped!` : `The ${item} raised ${whoLower(e.side)}'s ${STAT_NAMES[e.stat ?? 'atk']}!`;
        case 'sure':
          return `${who(e.side)} boosted the accuracy of its next move using its ${item}!`;
        case 'first':
          return `${who(e.side)} can act faster than normal, thanks to its ${item}!`;
        case 'pp':
          return `${who(e.side)} restored PP using its ${item}!`;
        case 'steal':
          return `${who(e.side)} stole an item with its ${item}!`;
        case 'barb':
          return `The Sticky Barb latched on to ${whoLower(e.side)}!`;
        case 'herb':
          return `${who(e.side)} used its ${item}!`;
        case 'guard':
          return `${who(e.side)} is protected by Guard Spec.!`;
        case 'boostEnd':
          return e.stat ? `${who(e.side)}'s ${e.stat === 'crit' ? 'focus' : STAT_NAMES[e.stat]} boost wore off.` : `${who(e.side)}'s Guard Spec. wore off.`;
        case 'distracted':
          return `${who(e.side)} is distracted by the Poké Doll!`;
        case 'attribute':
          return null;
      }
      return null;
    }
    case 'confused':
      return `${who(e.side)} became confused!`;
    case 'confusion':
      return `${who(e.side)} is confused!`;
    case 'confusionEnd':
      return `${who(e.side)} snapped out of its confusion!`;
    case 'confusionHit':
      return 'It hurt itself in its confusion!';
    case 'hits':
      return `The Pokémon was hit ${e.count} time${e.count === 1 ? '' : 's'}!`;
    case 'heal':
      return `${who(e.side)} had its HP restored.`;
    case 'protect':
      return `${who(e.side)} protected itself!`;
    case 'protected':
      return `${who(e.side)} protected itself!`;
    case 'ohko':
      return "It's a one-hit KO!";
    case 'selfKo':
      return null;
    case 'bound':
      return `${who(e.side)} was trapped by ${content.moves.get(e.moveId)?.name ?? 'the move'}!`;
    case 'bindDamage':
      return `${who(e.side)} is hurt by the bind!`;
    case 'bindEnd':
      return `${who(e.side)} was freed!`;
    case 'blocked':
      return `${who(e.side)} can't use that move right now!`;
    case 'disrupted':
      return `${who(e.side)} was hit by ${e.kind === 'healBlock' ? 'Heal Block' : e.kind[0]!.toUpperCase() + e.kind.slice(1)}!`;
    case 'statsReset':
      return 'All stat changes were changed!';
    case 'selfState':
      return SELF_STATE[e.state] ? SELF_STATE[e.state]!(who(e.side)) : `${who(e.side)} is ready!`;
    case 'substituteHit':
      return e.broke ? `${who(e.side)}'s substitute faded!` : `The substitute took damage for ${who(e.side)}!`;
    case 'perish':
      return `${who(e.side)}'s perish count fell to ${e.count}!`;
    case 'fieldStart':
      return FIELD_TEXT[e.field]?.[0] ?? 'The battlefield changed!';
    case 'fieldEnd':
      return FIELD_TEXT[e.field]?.[1] ?? 'The battlefield returned to normal.';
    case 'sideEffect':
      return sideEffectText(e.side, e.effect, e.on, who);
    case 'hazard':
      return e.hazard === 'stealthRock'
        ? `Pointed stones dug into ${who(e.side)}!`
        : e.hazard === 'spikes'
          ? `${who(e.side)} was hurt by the spikes!`
          : e.hazard === 'stickyWeb'
            ? `${who(e.side)} was caught in a sticky web!`
            : `${who(e.side)} was affected by the poison spikes!`;
    case 'seeded':
      return `${who(e.side)} was seeded!`;
    case 'seedDamage':
      return `${who(e.side)}'s health is sapped by Leech Seed!`;
    case 'charge': {
      const name = who(e.side);
      switch (e.semi) {
        case 'air':
          return e.moveId === 'bounce' ? `${name} sprang up!` : `${name} flew up high!`;
        case 'underground':
          return `${name} burrowed its way under the ground!`;
        case 'underwater':
          return `${name} hid underwater!`;
        case 'vanished':
          return `${name} vanished instantly!`;
        default:
          return e.moveId === 'solar-beam' || e.moveId === 'solar-blade' ? `${name} absorbed light!` : `${name} is charging up power!`;
      }
    }
    case 'avoided':
      return `${who(e.side)} avoided the attack!`;
    case 'fatigue':
      return `${who(e.side)} became confused due to fatigue!`;
    case 'raid':
      return e.text;
    case 'weather':
      return WEATHER_START[e.weather];
    case 'weatherEnd':
      return WEATHER_END[e.weather];
    case 'terrain':
      return TERRAIN_START[e.terrain];
    case 'terrainEnd':
      return TERRAIN_END[e.terrain];
    case 'weatherDamage':
      return `${who(e.side)} is buffeted by the ${e.weather === 'sand' ? 'sandstorm' : 'hail'}!`;
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
    case 'transform': {
      const before = e.side === 'player' ? species(e.from) : `The ${foe} ${species(e.from)}`;
      if (e.kind === 'tera') return `${before} Terastallized into the ${e.teraType![0]!.toUpperCase()}${e.teraType!.slice(1)} type!`;
      if (e.kind === 'primal') return `${before}'s Primal Reversion! It reverted to its primal form!`;
      if (e.kind === 'zmove') return `${before} surrounded itself with its Z-Power!`;
      if (e.kind === 'dynamax') return `${before} Dynamaxed!`;
      if (e.kind === 'gigantamax') return `${before} Gigantamaxed into ${species(e.to)}!`;
      if (e.kind === 'dynamaxEnd') return `${before} returned to its normal size!`;
      return `${before} has Mega Evolved into ${species(e.to)}!`;
    }
  }
}

/** What the Power column shows for a move with fixed damage: Lv, a number, or ? (Psywave). */
export function fixedDamageLabel(fixed: 'level' | 'psywave' | number | undefined): string {
  return fixed === undefined ? '—' : fixed === 'level' ? 'Lv' : fixed === 'psywave' ? '?' : String(fixed);
}

const SIDE_ON: Record<string, string> = {
  reflect: 'A wall of light cuts physical damage!',
  lightScreen: 'A wall of light cuts special damage!',
  auroraVeil: 'An aurora veil protects the team!',
  tailwind: 'A tailwind blew in behind the team!',
  safeguard: 'A veil protects the team from status!',
  mist: 'A mist shrouded the team!',
  luckyChant: 'The Lucky Chant shields the team from critical hits!',
  spikes: 'Spikes were scattered around the foe!',
  toxicSpikes: 'Poison spikes were scattered around the foe!',
  stealthRock: 'Pointed stones float around the foe!',
  stickyWeb: 'A sticky web spreads around the foe!',
};
const SIDE_OFF: Record<string, string> = {
  reflect: "Reflect wore off.",
  lightScreen: "Light Screen wore off.",
  auroraVeil: "Aurora Veil wore off.",
  tailwind: "The tailwind petered out.",
  safeguard: "Safeguard wore off.",
  mist: "The mist faded.",
  luckyChant: "Lucky Chant wore off.",
  toxicSpikes: "The poison spikes were absorbed.",
  hazards: "The hazards were swept away!",
};
function sideEffectText(_side: string, effect: string, on: boolean, _who: (s: 'player' | 'enemy') => string): string {
  return (on ? SIDE_ON : SIDE_OFF)[effect] ?? 'The field changed.';
}

const FIELD_TEXT: Record<string, [string, string]> = {
  gravity: ['Gravity intensified!', 'Gravity returned to normal.'],
  trickRoom: ['The dimensions were twisted!', 'The twisted dimensions returned to normal.'],
  waterSport: ['Fire\'s power was weakened!', 'The effects of Water Sport faded.'],
  mudSport: ['Electricity\'s power was weakened!', 'The effects of Mud Sport faded.'],
};

const SELF_STATE: Record<string, (who: string) => string> = {
  focusEnergy: (w) => `${w} is getting pumped!`,
  laserFocus: (w) => `${w} is focused!`,
  lockOn: (w) => `${w} took aim!`,
  ingrain: (w) => `${w} planted its roots!`,
  aquaRing: (w) => `${w} surrounded itself with a veil of water!`,
  endure: (w) => `${w} braced itself!`,
  wish: (w) => `${w} made a wish!`,
  trapped: (w) => `${w} can no longer escape!`,
  substitute: (w) => `${w} put in a substitute!`,
  destinyBond: (w) => `${w} is trying to take its foe down with it!`,
  perishSong: (w) => `${w} heard the perish song!`,
  yawn: (w) => `${w} grew drowsy!`,
  magnetRise: (w) => `${w} levitated with electromagnetism!`,
  courtChange: (w) => `${w} swapped the battle effects!`,
  abilityChanged: (w) => `${w}'s ability changed!`,
  typeChanged: (w) => `${w}'s type changed!`,
  sketched: (w) => `${w} sketched the move!`,
};
