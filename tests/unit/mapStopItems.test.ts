// Milestone 8.75, slice 3b-3a: extra map stops (Rods and fishing spots, Wave,
// Tropic and Harbor Mail, the four Bridge Mails).

import { describe, expect, it } from 'vitest';
import { applyCatalog, getCatalogEntry } from '../../src/core/catalog';
import { nextChoices } from '../../src/core/map';
import { mapItemSummary } from '../../src/core/mapItems';
import { createPokemon } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseNode, chooseStarter, createRun, fish, fishingOffer, resolveDecision, takeTurn, visitSide, type TurnResult } from '../../src/core/run';
import type { MapNode, RunState } from '../../src/core/state';
import { content, takeAnyReward } from './helpers';

function newRun(seed = 'stop-items'): RunState {
  // Past the gentle opening, whose weaker wild Pokémon would hide what these items change.
  const run = chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
  run.encountersCompleted = 2;
  return run;
}

function take(run: RunState, id: string, times = 1): RunState {
  for (let i = 0; i < times; i++) applyCatalog(content, run, getCatalogEntry(content, id), undefined, { moneyMultiplier: 1, rng: new Rng(hashSeed('t')) });
  return run;
}

/** Wins the battle in progress with a level 100 lead. */
function win(run: RunState): TurnResult {
  const lead = createPokemon(content, 'houndoom', 100, run.party[0]!.uid);
  lead.moves = [{ id: 'flamethrower', pp: 64 }];
  run.party[0] = lead;
  let turn: TurnResult | null = null;
  for (let i = 0; i < 50 && run.phase === 'battle'; i++) {
    run.party[0]!.hp = 1_000_000;
    turn = takeTurn(content, run, { kind: 'move', index: 0 });
    run = turn.run;
  }
  return turn!;
}

/** Beats this stage's gym leader and takes a reward: the next stage starts. */
function nextStage(run: RunState): RunState {
  const gym = run.stage!.map.nodes.find((n) => n.kind === 'gym')!;
  run.stage!.current = run.stage!.map.nodes.find((n) => n.next.includes(gym.id))!.id;
  let next = takeAnyReward(win(chooseNode(content, run, gym.id)).run);
  // A fossil or egg in the draft brings a Pokémon to place first.
  while (next.phase === 'decision' && next.pending[0]?.kind === 'caught') next = resolveDecision(content, next, { kind: 'release' }).run;
  return next;
}

const itemStops = (run: RunState) => run.stage!.map.nodes.flatMap((n) => n.sides.filter((s) => s.id.startsWith('item-stop')).map((s) => ({ node: n, side: s })));
const fishSpot = (run: RunState): { node: MapNode; sideId: string } => {
  const found = itemStops(run).find((s) => s.side.kind === 'fish')!;
  run.stage!.current = found.node.id;
  return { node: found.node, sideId: found.side.id };
};
const bst = (id: string) => Object.values(content.species.get(id)!.baseStats).reduce((a, b) => a + b, 0);

describe('Rods and fishing spots', () => {
  it('with a Rod, each new stage has a fishing spot beside a wild stop; without one, none', () => {
    const rod = nextStage(take(newRun(), 'old-rod'));
    const stops = itemStops(rod);
    expect(stops).toHaveLength(1);
    expect(stops[0]!.side.kind).toBe('fish');
    expect(stops[0]!.node.kind).toBe('wild');
    expect(itemStops(nextStage(newRun()))).toHaveLength(0);
  });

  it('the offer is Water Pokémon, the same every time, and uses no gameplay roll', () => {
    const run = nextStage(take(newRun('fish'), 'good-rod'));
    const { sideId } = fishSpot(run);
    const rng = structuredClone(run.rng);
    const offer = fishingOffer(content, run, sideId);
    expect(offer).toHaveLength(2);
    expect(fishingOffer(content, run, sideId)).toEqual(offer);
    expect(run.rng).toEqual(rng);
    for (const o of offer) expect(content.species.get(o.speciesId)!.types).toContain('water');
  });

  it('the Super Rod shows three, the last the strongest of four draws', () => {
    let first = 0;
    let last = 0;
    for (let i = 0; i < 8; i++) {
      const run = nextStage(take(newRun(`super-${i}`), 'super-rod'));
      const offer = fishingOffer(content, run, fishSpot(run).sideId);
      expect(offer).toHaveLength(3);
      first += bst(offer[0]!.speciesId);
      last += bst(offer[2]!.speciesId);
    }
    expect(last).toBeGreaterThan(first);
  });

  it('fishing starts a battle with the picked Pokémon; winning it gives no reward draft, and the spot is used up', () => {
    const run = nextStage(take(newRun('catch'), 'good-rod'));
    const { sideId } = fishSpot(run);
    const offer = fishingOffer(content, run, sideId);
    const battle = fish(content, run, sideId, 1);
    expect(battle.phase).toBe('battle');
    expect(battle.battle!.fishing).toBe(true);
    expect(battle.battle!.enemyTeam[0]!.speciesId).toBe(offer[1]!.speciesId);
    expect(battle.battle!.enemyTeam[0]!.level).toBe(offer[1]!.level);
    const after = win(battle).run;
    expect(after.phase).toBe('map');
    expect(after.draft).toBeNull();
    expect(() => fishingOffer(content, after, sideId)).toThrow(/already fished/);
    expect(() => fish(content, after, sideId, 0)).toThrow(/already fished/);
    expect(() => visitSide(content, run, sideId)).toThrow(/fish/);
    expect(() => fish(content, run, sideId, 2)).toThrow(/No fishing choice/);
  });
});

describe('Wave, Tropic and Harbor Mail', () => {
  it('each adds its stop to the next stage only', () => {
    let run = take(take(take(newRun('mail'), 'wave-mail'), 'tropic-mail'), 'harbor-mail');
    expect(itemStops(run)).toHaveLength(0);
    run = nextStage(run);
    expect(itemStops(run).map((s) => s.side.kind).sort()).toEqual(['fish', 'heal', 'shop']);
    // Without a Rod, a Wave Mail spot offers one Pokémon.
    expect(fishingOffer(content, run, fishSpot(run).sideId)).toHaveLength(1);
    expect(itemStops(nextStage(run))).toHaveLength(0);
  });
});

describe('Bridge Mail', () => {
  it('D and M: the next stop you reach gets a shop and a healing spot', () => {
    const run = take(take(newRun('bridge'), 'bridgemail-d'), 'bridgemail-m');
    const node = nextChoices(run.stage!).find((n) => n.kind === 'wild')!;
    const after = chooseNode(content, run, node.id);
    const sides = after.stage!.map.nodes.find((n) => n.id === node.id)!.sides.filter((s) => s.id.startsWith('bridge'));
    expect(sides.map((s) => s.kind).sort()).toEqual(['heal', 'shop']);
    expect(after.mapEffects).toEqual([]);
  });

  it('S: the next trainer win uses the gym odds for its draft, then the mail is used up', () => {
    const run = take(newRun('bridge-s'), 'bridgemail-s');
    expect(mapItemSummary(content, run)).toBe('Bridge Mail S ×1');
    const trainer = run.stage!.map.nodes.find((n) => n.kind === 'trainer')!;
    run.stage!.current = run.stage!.map.nodes.find((n) => n.next.includes(trainer.id))!.id;
    const after = win(chooseNode(content, run, trainer.id)).run;
    expect(after.phase).toBe('reward');
    expect(after.mapEffects).toEqual([]);
    expect(after.itemCounters?.['better-draft']).toBeUndefined();
  });

  it('T: the next wild Pokémon is the strongest of three', () => {
    for (let i = 0; i < 6; i++) {
      const plainRun = newRun(`bridge-t-${i}`);
      const node = nextChoices(plainRun.stage!).find((n) => n.kind === 'wild')!;
      const plain = chooseNode(content, plainRun, node.id).battle!.enemyTeam[0]!.speciesId;
      const t = chooseNode(content, take(newRun(`bridge-t-${i}`), 'bridgemail-t'), node.id);
      expect(bst(t.battle!.enemyTeam[0]!.speciesId)).toBeGreaterThanOrEqual(bst(plain));
      expect(t.mapEffects).toEqual([]);
    }
  });
});
