// Rival battle-style tricks (left-out 2.2): berserker rage, revenge-striker, last stand. Once per Pokémon, from real state.

import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { STYLE_TRICKS, styleTrick } from '../../src/core/rivals/tricks';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { content } from './helpers';

function rivalRun(style: string, team = 1): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'st', seed: 'style', archetypeId: 'red' }), 0));
  const enemies = Array.from({ length: team }, (_, i) => createPokemon(content, 'rattata', 10, `e${i}`));
  run.battle = createBattle('trainer', enemies, 0, run.party[0]!.uid, { classId: 'youngster', name: 'Rival', leaderId: null });
  run.battle.rivalId = 'rv';
  run.story.rivals.push({ id: 'rv', style } as never);
  run.phase = 'battle';
  return run;
}

describe('style tricks', () => {
  it('a berserker rages once when it drops to half HP', () => {
    const run = rivalRun('berserker');
    expect(styleTrick(content, run)).toBeNull();
    const enemy = run.battle!.enemyTeam[0]!;
    enemy.hp = Math.floor(maxHp(content, enemy) / 2);
    const ev = styleTrick(content, run);
    expect(ev).toMatchObject({ type: 'raid' });
    expect(run.battle!.enemyStages.atk).toBe(2);
    expect(run.battle!.enemyStages.def).toBe(-1);
    expect(styleTrick(content, run)).toBeNull();
    expect(run.battle!.enemyStages.atk).toBe(2);
  });
  it('a revenge-striker needs a fallen teammate; a last stand needs the last Pokémon at low HP', () => {
    const run = rivalRun('revenge-striker', 2);
    expect(styleTrick(content, run)).toBeNull();
    run.battle!.enemyTeam[1]!.hp = 0;
    expect(styleTrick(content, run)).not.toBeNull();
    expect(run.battle!.enemyStages.spe).toBe(1);
    const stand = rivalRun('last-stand', 2);
    stand.battle!.enemyTeam[0]!.hp = 1;
    expect(styleTrick(content, stand)).toBeNull();
    stand.battle!.enemyTeam[1]!.hp = 0;
    expect(styleTrick(content, stand)).not.toBeNull();
  });
  it('does nothing without a rival, for other styles, or when switched off', () => {
    const plain = rivalRun('blitz');
    plain.battle!.enemyTeam[0]!.hp = 1;
    expect(styleTrick(content, plain)).toBeNull();
    const off = rivalRun('berserker');
    off.battle!.enemyTeam[0]!.hp = 1;
    expect(styleTrick({ ...content, balance: { ...content.balance, styleTricks: false } }, off)).toBeNull();
    expect(Object.keys(STYLE_TRICKS).every((k) => k in { berserker: 1, 'revenge-striker': 1, 'last-stand': 1 })).toBe(true);
  });
});
