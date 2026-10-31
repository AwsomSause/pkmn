// Advanced AI port, batch 1 (core/battle/aai.ts): ability reads, recoil, disruption, special moves, side moves, safe set-up,
// status timing and repetition. Each behaviour is checked on, and off through its balance switch.

import { describe, expect, it } from 'vitest';
import { createBattle, moveValue, type EnemyBrain } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { freshStages, type PokemonInstance } from '../../src/core/state';
import { content } from './helpers';

type Aai = typeof content.balance.trainerAi.aai;
const withAai = (patch: Partial<Aai>) => ({ ...content, balance: { ...content.balance, trainerAi: { ...content.balance.trainerAi, aai: { ...content.balance.trainerAi.aai, ...patch } } } });
const off = withAai({ abilityReads: false, recoil: false, disruption: false, specialMoves: false, sideMoves: false, setupSafety: false, statusTiming: false, repetition: false });

function mon(species: string, level: number, uid: string, moves: string[], ability?: number): PokemonInstance {
  const m = createPokemon(content, species, level, uid);
  m.moves = moves.map((id) => ({ id, pp: 10 }));
  if (ability !== undefined) m.abilitySlot = ability;
  return m;
}
/** An enemy `user` facing the player's `target`, in a trainer battle with a spare player Pokémon. */
function fight(user: PokemonInstance, target: PokemonInstance, spare = true) {
  const battle = createBattle('trainer', [user, mon('rattata', 5, 'e2', ['tackle'])], 0, target.uid);
  const party = spare ? [target, mon('pidgey', 5, 'p2', ['tackle'])] : [target];
  const brain = (c = content): EnemyBrain => ({ content: c, ai: 1, target, stages: battle.enemyStages, battle, party });
  return { battle, party, brain };
}
const abilityIndex = (species: string, id: string) => {
  const { normal, hidden } = content.species.get(species)!.abilities;
  const i = normal.indexOf(id);
  if (i >= 0) return i;
  if (hidden === id) return -1;
  throw new Error(`${species} has no ${id}`);
};

describe('ability reads', () => {
  it('a sound move into Soundproof is worth nothing', () => {
    const target = mon('mr-mime', 30, 't', ['psychic'], abilityIndex('mr-mime', 'soundproof'));
    const user = mon('exploud', 30, 'u', ['hyper-voice', 'tackle']);
    const { brain } = fight(user, target);
    expect(moveValue(brain(), user, 'hyper-voice')).toBe(0);
    expect(moveValue(brain(off), user, 'hyper-voice')).toBeGreaterThan(0);
  });

  it('Thick Fat halves a Fire move', () => {
    const target = mon('snorlax', 30, 't', ['tackle'], abilityIndex('snorlax', 'thick-fat'));
    const user = mon('charmeleon', 30, 'u', ['ember']);
    const { brain } = fight(user, target);
    expect(moveValue(brain(), user, 'ember')).toBeCloseTo(moveValue(brain(off), user, 'ember') * 0.5);
  });

  it('no KO bonus into Sturdy at full HP', () => {
    const target = mon('geodude', 5, 't', ['tackle'], abilityIndex('geodude', 'sturdy'));
    const user = mon('blastoise', 80, 'u', ['surf']);
    const { brain } = fight(user, target);
    const koBonus = content.balance.trainerAi.koBonus;
    expect(moveValue(brain(off), user, 'surf') / moveValue(brain(), user, 'surf')).toBeCloseTo(koBonus);
  });

  it('no status move into Magic Bounce', () => {
    const target = mon('espeon', 30, 't', ['psychic'], abilityIndex('espeon', 'magic-bounce'));
    const user = mon('gengar', 30, 'u', ['hypnosis', 'shadow-ball']);
    const { brain } = fight(user, target);
    expect(moveValue(brain(), user, 'hypnosis')).toBe(0);
    expect(moveValue(brain(off), user, 'hypnosis')).toBeGreaterThan(0);
  });
});

describe('recoil', () => {
  it('a low user avoids Mind Blown-style self damage', () => {
    const user = mon('blacephalon', 50, 'u', ['mind-blown', 'shadow-ball']);
    const target = mon('snorlax', 60, 't', ['tackle']);
    user.hp = 5;
    const { brain } = fight(user, target);
    expect(moveValue(brain(), user, 'mind-blown')).toBeCloseTo(moveValue(brain(off), user, 'mind-blown') * 0.2);
  });
});

describe('disruption', () => {
  it('Taunt only against a foe seen using a status move', () => {
    const user = mon('sableye', 30, 'u', ['taunt', 'shadow-ball']);
    const target = mon('blissey', 30, 't', ['soft-boiled', 'pound']);
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'taunt')).toBe(0);
    battle.playerVolatile.movesUsed = ['soft-boiled'];
    expect(moveValue(brain(), user, 'taunt')).toBeGreaterThan(0);
    battle.playerVolatile.taunt = 3;
    expect(moveValue(brain(), user, 'taunt')).toBe(0);
  });

  it('Encore only after the foe used a status move', () => {
    const user = mon('wobbuffet', 30, 'u', ['encore', 'tackle']);
    const target = mon('scizor', 30, 't', ['swords-dance', 'bullet-punch']);
    const { battle, brain } = fight(user, target);
    battle.playerVolatile.lastMove = 'bullet-punch';
    expect(moveValue(brain(), user, 'encore')).toBe(0);
    battle.playerVolatile.lastMove = 'swords-dance';
    expect(moveValue(brain(), user, 'encore')).toBeGreaterThan(0);
  });
});

describe('special moves', () => {
  it('Pain Split only when the user is much lower', () => {
    const user = mon('gengar', 40, 'u', ['pain-split', 'shadow-ball']);
    const target = mon('snorlax', 40, 't', ['tackle']);
    const { brain } = fight(user, target);
    expect(moveValue(brain(), user, 'pain-split')).toBe(0);
    user.hp = 10;
    expect(moveValue(brain(), user, 'pain-split')).toBeGreaterThan(0);
  });

  it('Final Gambit needs a faster user with more HP than the target, and a teammate left', () => {
    const user = mon('ninjask', 50, 'u', ['final-gambit', 'x-scissor']);
    const target = mon('snorlax', 50, 't', ['tackle']);
    target.hp = 10;
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'final-gambit')).toBeGreaterThan(0);
    battle.enemyTeam[1]!.hp = 0;
    expect(moveValue(brain(), user, 'final-gambit')).toBe(0);
  });
});

describe('side moves', () => {
  it('hazards while the foe has reserves, never past the cap', () => {
    const user = mon('skarmory', 40, 'u', ['spikes', 'steel-wing']);
    const target = mon('pikachu', 40, 't', ['thunderbolt']);
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'spikes')).toBeGreaterThan(0);
    battle.sideEffects.player.spikes = 3;
    expect(moveValue(brain(), user, 'spikes')).toBe(0);
    const alone = fight(user, target, false);
    expect(moveValue(alone.brain(), user, 'spikes')).toBe(0);
  });

  it('no Reflect while it is up', () => {
    const user = mon('starmie', 40, 'u', ['reflect', 'surf']);
    const target = mon('machamp', 40, 't', ['cross-chop']);
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'reflect')).toBeGreaterThan(0);
    battle.sideEffects.enemy.reflect = 3;
    expect(moveValue(brain(), user, 'reflect')).toBe(0);
  });
});

describe('safe set-up and phazing', () => {
  it('no Swords Dance when the foe would KO next turn', () => {
    const user = mon('scyther', 30, 'u', ['swords-dance', 'wing-attack']);
    const target = mon('magcargo', 60, 't', ['flamethrower']);
    const { brain } = fight(user, target);
    expect(moveValue(brain(), user, 'swords-dance')).toBe(0);
    expect(moveValue(brain(off), user, 'swords-dance')).toBeGreaterThan(0);
  });

  it('Haze is worth a lot against a boosted foe and nothing otherwise', () => {
    const user = mon('weezing', 40, 'u', ['haze', 'sludge-bomb']);
    const target = mon('snorlax', 40, 't', ['tackle']);
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'haze')).toBe(0);
    battle.playerStages = { ...freshStages(), atk: 2 };
    expect(moveValue(brain(), user, 'haze')).toBeGreaterThan(0);
  });
});

describe('status timing and repetition', () => {
  it('no status into a Substitute or Misty Terrain', () => {
    const user = mon('gengar', 40, 'u', ['hypnosis', 'shadow-ball']);
    const target = mon('snorlax', 40, 't', ['tackle']);
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'hypnosis')).toBeGreaterThan(0);
    battle.playerVolatile.substitute = 20;
    expect(moveValue(brain(), user, 'hypnosis')).toBe(0);
    battle.playerVolatile.substitute = 0;
    battle.terrain = { id: 'misty', turns: 3 };
    expect(moveValue(brain(), user, 'hypnosis')).toBe(0);
  });

  it('no burn on a Guts user', () => {
    const user = mon('chandelure', 40, 'u', ['will-o-wisp', 'shadow-ball']);
    const target = mon('machamp', 40, 't', ['cross-chop'], abilityIndex('machamp', 'guts'));
    const { brain } = fight(user, target);
    expect(moveValue(brain(), user, 'will-o-wisp')).toBe(0);
  });

  it('no Protect twice in a row', () => {
    const user = mon('blissey', 40, 'u', ['protect', 'pound']);
    const target = mon('snorlax', 40, 't', ['tackle']);
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'protect')).toBeGreaterThan(0);
    battle.enemyVolatile.lastMove = 'protect';
    expect(moveValue(brain(), user, 'protect')).toBe(0);
  });
});

describe('field play (batch 2)', () => {
  const noField = withAai({ fieldPlay: false });

  it('rain boosts Water and weakens Fire in the score', () => {
    const user = mon('kingdra', 40, 'u', ['surf', 'ember']);
    const target = mon('snorlax', 40, 't', ['tackle']);
    const { battle, brain } = fight(user, target);
    battle.weather = { id: 'rain', turns: 5 };
    expect(moveValue(brain(), user, 'surf')).toBeCloseTo(moveValue(brain(noField), user, 'surf') * 1.5);
    expect(moveValue(brain(), user, 'ember')).toBeCloseTo(moveValue(brain(noField), user, 'ember') * 0.5);
  });

  it('priority moves fail into Psychic Terrain on a grounded target', () => {
    const user = mon('scizor', 40, 'u', ['bullet-punch', 'x-scissor']);
    const target = mon('snorlax', 40, 't', ['tackle']);
    const { battle, brain } = fight(user, target);
    battle.terrain = { id: 'psychic', turns: 5 };
    expect(moveValue(brain(), user, 'bullet-punch')).toBe(0);
  });

  it('Rain Dance only when the rain helps it more than the foe, and not twice', () => {
    const user = mon('kingdra', 40, 'u', ['rain-dance', 'surf'], abilityIndex('kingdra', 'swift-swim'));
    const target = mon('snorlax', 40, 't', ['tackle']);
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'rain-dance')).toBeGreaterThan(0);
    battle.weather = { id: 'rain', turns: 5 };
    expect(moveValue(brain(), user, 'rain-dance')).toBe(0);
    battle.weather = null;
    const fireFoe = mon('arcanine', 40, 't2', ['flamethrower']);
    const vsFire = fight(mon('arcanine', 40, 'u2', ['rain-dance', 'flamethrower']), fireFoe);
    vsFire.battle.playerVolatile.movesUsed = ['flamethrower'];
    expect(moveValue(vsFire.brain(), vsFire.battle.enemyTeam[0]!, 'rain-dance')).toBeGreaterThan(0); // hurts the foe's Fire as much as its own: base value only
    const swimmer = fight(mon('arcanine', 40, 'u3', ['rain-dance', 'flamethrower']), mon('kingdra', 40, 't3', ['surf'], abilityIndex('kingdra', 'swift-swim')));
    expect(moveValue(swimmer.brain(), swimmer.battle.enemyTeam[0]!, 'rain-dance')).toBe(0);
  });

  it('Trick Room only for the slower side', () => {
    const slow = mon('snorlax', 40, 'u', ['trick-room', 'body-slam']);
    const fast = mon('jolteon', 40, 't', ['thunderbolt']);
    const a = fight(slow, fast);
    expect(moveValue(a.brain(), slow, 'trick-room')).toBeGreaterThan(0);
    a.battle.field.trickRoom = 4;
    expect(moveValue(a.brain(), slow, 'trick-room')).toBe(0);
    const b = fight(mon('jolteon', 40, 'u2', ['trick-room', 'thunderbolt']), mon('snorlax', 40, 't2', ['tackle']));
    expect(moveValue(b.brain(), b.battle.enemyTeam[0]!, 'trick-room')).toBe(0);
  });
});

describe('batch 3: items, pivots, endgame, personality, Illusion, gimmick timing', () => {
  it('no Ground move into an Air Balloon until it pops', () => {
    const user = mon('garchomp', 50, 'u', ['earthquake', 'dragon-claw']);
    const target = mon('heatran', 50, 't', ['flamethrower']);
    target.held = { 'air-balloon': 1 };
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'earthquake')).toBe(0);
    battle.held.popped.push(target.uid);
    expect(moveValue(brain(), user, 'earthquake')).toBeGreaterThan(0);
  });

  it('Baton Pass only with boosts and a teammate', () => {
    const user = mon('ninjask', 40, 'u', ['baton-pass', 'x-scissor']);
    const target = mon('snorlax', 40, 't', ['tackle']);
    const { battle, brain } = fight(user, target);
    expect(moveValue(brain(), user, 'baton-pass')).toBe(0);
    battle.enemyStages = { ...freshStages(), spe: 2, atk: 1 };
    expect(moveValue({ ...brain(), stages: battle.enemyStages }, user, 'baton-pass')).toBeGreaterThan(0);
  });

  it('a last, slower Pokémon about to fall drops its status moves', () => {
    const user = mon('scyther', 30, 'u', ['swords-dance', 'wing-attack']);
    const target = mon('arcanine', 70, 't', ['flamethrower']);
    const { battle, brain } = fight(user, target);
    battle.enemyTeam[1]!.hp = 0;
    expect(moveValue(brain(withAai({ setupSafety: false })), user, 'swords-dance')).toBe(0);
    expect(moveValue(brain(withAai({ setupSafety: false, endgame: false })), user, 'swords-dance')).toBeGreaterThan(0);
  });

  it('a trainer style comes from its team and weights its moves', async () => {
    const { aaiPersonality, personalityFactor } = await import('../../src/core/battle/aai');
    const sweepers = ['scyther', 'gyarados', 'dragonite', 'garchomp'].map((s, i) => mon(s, 50, `s${i}`, ['swords-dance', 'dragon-dance', 'earthquake']));
    expect(aaiPersonality(content, sweepers)).toBe('hyperOffensive');
    const walls = ['blissey', 'chansey'].map((s, i) => mon(s, 50, `w${i}`, ['soft-boiled', 'toxic']));
    expect(aaiPersonality(content, walls)).toBe('defensive');
    expect(personalityFactor('defensive', content.moves.get('soft-boiled')!)).toBeCloseTo(1.4);
    expect(personalityFactor('aggressive', content.moves.get('soft-boiled')!)).toBeCloseTo(0.7);
  });

  it('Illusion fools the trainer: it scores against the disguise', () => {
    const user = mon('machamp', 40, 'u', ['cross-chop']);
    const target = mon('zoroark', 40, 't', ['night-daze']);
    const { battle, brain } = fight(user, target);
    const real = moveValue(brain(), user, 'cross-chop');
    battle.playerVolatile.illusion = 'gengar'; // Fighting does nothing to a Ghost
    expect(moveValue(brain(), user, 'cross-chop')).toBe(0);
    expect(moveValue(brain(withAai({ illusion: false })), user, 'cross-chop')).toBeCloseTo(real);
  });

  it('Tera waits until it helps, at most gimmickMaxWait turns', async () => {
    const { aaiGimmickReady } = await import('../../src/core/battle/aai');
    const ace = mon('dragonite', 50, 'a', ['dragon-claw', 'extreme-speed']);
    const foe = mon('pikachu', 50, 'f', ['thunderbolt']);
    const base = { aceTypes: ['dragon', 'flying'] as const, foeKnown: [], turnsOut: 0 };
    expect(aaiGimmickReady(content, 'tera', ace, foe, { ...base, teraType: 'water' })).toBe(false);
    expect(aaiGimmickReady(content, 'tera', ace, foe, { ...base, teraType: 'normal' })).toBe(true); // STAB on Extreme Speed
    expect(aaiGimmickReady(content, 'tera', ace, foe, { ...base, teraType: 'water', turnsOut: 3 })).toBe(true);
    const ice = content.moves.get('ice-beam')!;
    expect(aaiGimmickReady(content, 'tera', ace, foe, { ...base, teraType: 'water', foeKnown: [ice] })).toBe(true);
    expect(aaiGimmickReady(withAai({ gimmickTiming: false }), 'tera', ace, foe, { ...base, teraType: 'water' })).toBe(true);
  });

  it('no Z-Move into an immune foe, no Dynamax to finish a nearly-down foe', async () => {
    const { aaiGimmickReady } = await import('../../src/core/battle/aai');
    const ace = mon('machamp', 50, 'a', ['cross-chop']);
    const ghost = mon('gengar', 50, 'g', ['shadow-ball']);
    const base = { aceTypes: ['fighting'] as const, foeKnown: [], turnsOut: 0 };
    expect(aaiGimmickReady(content, 'zmove', ace, ghost, { ...base, zMoveType: 'fighting' })).toBe(false);
    ghost.hp = 1;
    expect(aaiGimmickReady(content, 'dynamax', ace, ghost, base)).toBe(false);
  });
});
