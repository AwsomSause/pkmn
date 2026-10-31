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
