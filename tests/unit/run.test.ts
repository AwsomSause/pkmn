import { describe, expect, it } from 'vitest';
import { enemyLevelOffset, getArchetype, moneyMultiplier, xpMultiplier, captureMultiplier } from '../../src/core/archetypes';
import { enemyLevel } from '../../src/core/encounters';
import { defaultPrep, draftStarters } from '../../src/core/runPrep';
import { createPokemon, getSpecies, xpForDefeat } from '../../src/core/pokemon';
import { applyReward, generateDraft, RewardConfigError } from '../../src/core/rewards';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseReward, chooseStarter, createRun, resolveDecision, takeTurn as takeAction } from '../../src/core/run';
import { currentEnemy, type RunState } from '../../src/core/state';
import { buildContent, RAW_CONTENT } from '../../src/data';
import { content, scaleAt, toBattle } from './helpers';

function newRun(seed = 'run-seed', archetypeId = 'red'): RunState {
  return createRun(content, { runId: 'run1', seed, archetypeId });
}

const takeTurn = (c: typeof content, run: RunState, index: number) => takeAction(c, run, { kind: 'move', index });

/** Plays the current battle to the end using the first move with PP, then skips any move-learning decisions. */
function playBattle(run: RunState): RunState {
  let guard = 0;
  while (run.phase === 'battle' && guard++ < 300) {
    const mon = run.party[run.battle!.activeIndex]!;
    const damaging = mon.moves.findIndex((m) => m.pp > 0 && (content.moves.get(m.id)!.power ?? 0) > 0);
    const idx = damaging >= 0 ? damaging : mon.moves.findIndex((m) => m.pp > 0);
    run = takeTurn(content, run, idx).run;
  }
  return skipDecisions(run);
}

function skipDecisions(run: RunState): RunState {
  while (run.phase === 'decision') {
    const kind = run.pending[0]!.kind;
    run = resolveDecision(content, run, kind === 'learnMove' ? { kind: 'skipMove' } : { kind: 'release' }).run;
  }
  return run;
}

describe('starters', () => {
  it('generates three distinct, eligible, first-stage species', () => {
    for (let i = 0; i < 100; i++) {
      const { choices } = draftStarters(content, new Rng(hashSeed(`starter-${i}`)), defaultPrep(content));
      expect(choices).toHaveLength(3);
      expect(new Set(choices).size).toBe(3);
      for (const id of choices) {
        expect(content.starterPools.get('classic')!.species).toContain(id);
        expect(getSpecies(content, id).evolutionStage).toBe(1);
      }
    }
  });

  it('the same seed offers the same starters', () => {
    expect(newRun('abc').starterChoices).toEqual(newRun('abc').starterChoices);
  });
});

describe('trainer archetypes', () => {
  it('Red has no modifiers', () => {
    const red = getArchetype(content, 'red');
    expect([xpMultiplier(red), moneyMultiplier(red), enemyLevelOffset(red), captureMultiplier(red)]).toEqual([1, 1, 0, 1]);
  });

  it('Blue: +25% XP and +2 enemy levels', () => {
    const blue = getArchetype(content, 'blue');
    expect(xpMultiplier(blue)).toBe(1.25);
    expect(enemyLevelOffset(blue)).toBe(2);
    expect(moneyMultiplier(blue)).toBe(1);
  });

  it('Green: +25% money, -1 enemy level, and a separate capture modifier', () => {
    const green = getArchetype(content, 'green');
    expect(moneyMultiplier(green)).toBe(1.25);
    expect(enemyLevelOffset(green)).toBe(-1);
    expect(captureMultiplier(green)).toBe(0.85);
  });

  it('enemy levels shift by the archetype offset and respect the minimum', () => {
    const levels = (id: string) => enemyLevel(content, getArchetype(content, id), scaleAt(0, 1), 0, new Rng(hashSeed('lvl')));
    const red = levels('red');
    expect(levels('blue').level).toBe(red.level + 2);
    expect(levels('green').unclamped).toBe(red.unclamped - 1);
    expect(levels('green').level).toBeGreaterThanOrEqual(content.balance.difficulty.minLevel);
  });
});

describe('reward draft', () => {
  it('offers exactly five distinct rewards', () => {
    const run = chooseStarter(content, newRun(), 0);
    for (let i = 0; i < 200; i++) {
      const draft = generateDraft(content, run, new Rng(hashSeed(`draft-${i}`)));
      expect(draft).toHaveLength(5);
      expect(new Set(draft).size).toBe(5);
    }
  });

  it('throws a configuration error with fewer than five eligible rewards', () => {
    const small = buildContent({ ...RAW_CONTENT, rewards: (RAW_CONTENT.rewards as unknown[]).slice(0, 4) });
    const run = chooseStarter(small, createRun(small, { runId: 'r', seed: 's', archetypeId: 'red' }), 0);
    expect(() => generateDraft(small, run, new Rng(hashSeed('x')))).toThrow(RewardConfigError);
  });

  it('never offers a vitamin that is already at its stack limit', () => {
    const run = chooseStarter(content, newRun(), 0);
    run.party[0]!.vitamins.atk = content.balance.vitaminMaxStacks;
    for (let i = 0; i < 200; i++) {
      expect(generateDraft(content, run, new Rng(hashSeed(`v-${i}`)))).not.toContain('protein');
    }
  });

  it('money rewards apply Green\'s bonus', () => {
    const run = chooseStarter(content, newRun(), 0);
    applyReward(content, run, getArchetype(content, 'green'), 'nugget');
    expect(run.money).toBe(125);
  });

  it('item rewards go into the Bag', () => {
    const run = chooseStarter(content, newRun(), 0);
    const before = run.inventory.potion ?? 0;
    const result = applyReward(content, run, getArchetype(content, 'red'), 'potion');
    expect(run.inventory.potion).toBe(before + 2);
    expect(result.messages[0]).toMatch(/Bag/);
  });
});

describe('run flow', () => {
  it('starter → map → battle → reward → map', () => {
    let run = newRun('flow');
    expect(run.phase).toBe('starter');
    run = chooseStarter(content, run, 1);
    expect(run.phase).toBe('map');
    expect(run.stage!.current).toBeNull();
    run = toBattle(run);
    expect(run.phase).toBe('battle');
    expect(run.stage!.current).toMatch(/^c1r/);
    expect(run.party).toHaveLength(1);
    expect(run.party[0]!.speciesId).toBe(run.starterChoices[1]);
    // Give the starter a big advantage so this test is about flow, not luck.
    run.party[0] = { ...createPokemon(content, run.party[0]!.speciesId, 40, run.party[0]!.uid) };
    run = playBattle(run);
    expect(run.phase).toBe('reward');
    expect(run.draft).toHaveLength(5);
    expect(run.encountersCompleted).toBe(1);
    const moneyBefore = run.money;
    const { run: after } = chooseReward(content, run, 0);
    expect(after.phase).toBe('map');
    expect(after.draft).toBeNull();
    expect(after.log.rewardsTaken).toHaveLength(1);
    expect(after.money).toBeGreaterThanOrEqual(moneyBefore);
  });

  it('choosing a reward grants exactly one reward and cannot be repeated', () => {
    let run = toBattle(chooseStarter(content, newRun('once'), 0));
    run.party[0] = createPokemon(content, run.party[0]!.speciesId, 40, run.party[0]!.uid);
    run = playBattle(run);
    const { run: after } = chooseReward(content, run, 2);
    expect(after.log.rewardsTaken).toEqual([run.draft![2]]);
    expect(() => chooseReward(content, after, 2)).toThrow(/phase/);
  });

  it('winning awards XP and money with archetype multipliers', () => {
    for (const archetypeId of ['red', 'blue', 'green']) {
      let run = toBattle(chooseStarter(content, newRun('xp', archetypeId), 0));
      run.party[0] = createPokemon(content, run.party[0]!.speciesId, 40, run.party[0]!.uid);
      const enemy = currentEnemy(run.battle!);
      const archetype = getArchetype(content, archetypeId);
      const expectedXp = xpForDefeat(getSpecies(content, enemy.speciesId).baseExp, enemy.level, 40, xpMultiplier(archetype));
      const expectedMoney = Math.floor(content.balance.money.wildPerEnemyLevel * enemy.level * moneyMultiplier(archetype));
      let result;
      const xpBefore = run.party[0]!.xp;
      while (run.phase === 'battle') {
        result = takeTurn(content, run, run.party[0]!.moves.findIndex((m) => m.pp > 0));
        run = result.run;
      }
      expect(result!.end).toEqual(expect.objectContaining({ outcome: 'win', moneyGained: expectedMoney }));
      expect(result!.events).toContainEqual({ type: 'xp', uid: run.party[0]!.uid, amount: expectedXp });
      expect(run.party[0]!.xp - xpBefore).toBe(expectedXp);
    }
  });

  it('losing with no healthy Pokémon ends the run', () => {
    let run = toBattle(chooseStarter(content, newRun('lose'), 0));
    run.party[0]!.hp = 1;
    run.battle!.enemyTeam = [createPokemon(content, 'growlithe', 40, 'e99')];
    run = playBattle(run);
    expect(run.phase).toBe('over');
  });

  it('the same seed and the same choices reproduce the whole run', () => {
    const play = () => {
      let run = toBattle(chooseStarter(content, newRun('replay', 'blue'), 2));
      run.party[0] = createPokemon(content, run.party[0]!.speciesId, 30, run.party[0]!.uid);
      for (let i = 0; i < 3; i++) {
        run = playBattle(run);
        if (run.phase !== 'reward') break;
        run = chooseReward(content, run, 0).run;
      }
      return run;
    };
    expect(play()).toEqual(play());
  });

  it('actions never change the state passed in', () => {
    const run = newRun('pure');
    const copy = structuredClone(run);
    chooseStarter(content, run, 0);
    expect(run).toEqual(copy);
  });

  it('party never exceeds six', () => {
    const run = chooseStarter(content, newRun(), 0);
    expect(run.party.length).toBeLessThanOrEqual(content.balance.partyMax);
  });
});
