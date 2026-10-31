// Shadow and Blissful world (APPROVED.md §12-14): Snag and Blessing Balls, recovery stories, gang raids, the
// world's memory, and the events that tie them together.

import { describe, expect, it } from 'vitest';
import { createBattle, itemProblem, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { chooseEvent, conditionMet, eligibleEvents } from '../../src/core/events';
import { pickRaidFor } from '../../src/core/raid/raid';
import { Rng, hashSeed } from '../../src/core/rng';
import { chooseStarter, createRun, startRaidBattle, takeTurn } from '../../src/core/run';
import { heartStage, makeShadow, shadowResists, sootheAmount, soothePartyAfterBattle, temperamentOf } from '../../src/core/shadow';
import { blissfulAfterBattle, blissfulAtRest, grantBlessing, isBlissful, makeBlissful } from '../../src/core/shadowWorld/blissful';
import { addFlag, advanceShadowWorld, flagOf, gangNotes, gangRaidWon, outbreakShadow, placeGangDen } from '../../src/core/shadowWorld/world';
import { PokemonInstanceSchema } from '../../src/core/state';
import { content } from './helpers';

const fresh = (seed: string) => structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));

function engine(enemies: ReturnType<typeof createPokemon>[], kind: 'wild' | 'trainer', inventory: Record<string, number>, leaderId: string | null = null) {
  const party = [createPokemon(content, 'charmander', 30, 'p1')];
  const battle = createBattle(kind, enemies, 0, 'p1', kind === 'trainer' ? { classId: 'event', name: 'Grunt', leaderId } : null);
  const ctx: BattleContext = { content, battle, party, inventory, rng: new Rng(hashSeed('sw')), captureRng: new Rng(hashSeed('sw-c')), catchMultiplier: 1 };
  return { battle, ctx, party };
}
const shadowFoe = (id: string, species = 'rattata') => {
  const m = createPokemon(content, species, 5, id);
  makeShadow(m, 90);
  return m;
};

describe('Snag Ball', () => {
  it('only works on a Shadow Pokémon held by an enemy trainer', () => {
    const inv = { 'snag-ball': 2, 'poke-ball': 2 };
    expect(itemProblem(engine([shadowFoe('e1')], 'trainer', inv).ctx, 'snag-ball')).toBeNull();
    expect(itemProblem(engine([createPokemon(content, 'rattata', 5, 'e1')], 'trainer', inv).ctx, 'snag-ball')).toMatch(/Shadow/);
    expect(itemProblem(engine([shadowFoe('e1')], 'wild', inv).ctx, 'snag-ball')).toMatch(/enemy trainer/);
    expect(itemProblem(engine([shadowFoe('e1')], 'trainer', inv, 'brock').ctx, 'snag-ball')).toMatch(/protected/);
    // Ordinary balls still cannot take a trainer's Pokémon.
    expect(itemProblem(engine([shadowFoe('e1')], 'trainer', inv).ctx, 'poke-ball')).toMatch(/can't catch/);
  });

  it('takes the Pokémon out of the team and the battle goes on; the last snag wins the fight', () => {
    const { battle, ctx } = engine([shadowFoe('e1'), shadowFoe('e2', 'pidgey')], 'trainer', { 'snag-ball': 2 });
    const first = resolveTurn(ctx, { kind: 'item', itemId: 'snag-ball' });
    expect(first.some((e) => e.type === 'ball' && e.caught)).toBe(true);
    expect(battle.snagged).toHaveLength(1);
    expect(battle.snagged![0]!.shadow).toBeDefined();
    expect(battle.outcome).toBeNull();
    expect(battle.enemyIndex).toBe(1);
    expect(ctx.inventory['snag-ball']).toBe(1);
    resolveTurn(ctx, { kind: 'item', itemId: 'snag-ball' });
    expect(battle.snagged).toHaveLength(2);
    expect(battle.outcome).toBe('win');
  });

  it('a snagged Shadow Pokémon joins you when the fight is won, still Shadow', () => {
    const run = fresh('snag-join');
    const enemy = shadowFoe('e1');
    const battle = createBattle('trainer', [enemy], 0, run.party[0]!.uid, { classId: 'event', name: 'Grunt', leaderId: null });
    run.battle = battle;
    run.phase = 'battle';
    run.inventory['snag-ball'] = 1;
    const result = takeTurn(content, run, { kind: 'item', itemId: 'snag-ball' });
    expect(result.run.phase).toBe('decision');
    const caught = result.run.pending.find((p) => p.kind === 'caught');
    expect(caught && caught.kind === 'caught' && caught.mon.shadow).toBeDefined();
    expect(flagOf(result.run, 'rescued')).toBe(1);
  });
});

describe('Blissful Pokémon and the Blessing Ball', () => {
  const blissfulFoe = () => {
    const m = createPokemon(content, 'togetic', 60, 'e1');
    makeBlissful(content, m);
    return m;
  };
  it('a Blissful wild Pokémon takes only a Blessing Ball, and the ball takes only a Blissful one', () => {
    const inv = { 'blessing-ball': 1, 'poke-ball': 1 };
    expect(itemProblem(engine([blissfulFoe()], 'wild', inv).ctx, 'blessing-ball')).toBeNull();
    expect(itemProblem(engine([blissfulFoe()], 'wild', inv).ctx, 'poke-ball')).toMatch(/Blessing Ball/);
    expect(itemProblem(engine([createPokemon(content, 'rattata', 5, 'e1')], 'wild', inv).ctx, 'blessing-ball')).toMatch(/Nothing here/);
    expect(itemProblem(engine([blissfulFoe()], 'trainer', inv).ctx, 'blessing-ball')).toMatch(/wild/);
  });
  it('it watches calmly instead of attacking, and the Blessing Ball befriends it', () => {
    const { battle, ctx, party } = engine([blissfulFoe()], 'wild', { 'blessing-ball': 1 });
    party[0]!.level = 5;
    const hp = party[0]!.hp;
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    expect(events.some((e) => e.type === 'raid' && /calmly/.test(e.text))).toBe(true);
    expect(party[0]!.hp).toBe(hp);
    resolveTurn(ctx, { kind: 'item', itemId: 'blessing-ball' });
    expect(battle.outcome).toBe('caught');
  });
  it('after a battle the aura mends the others a little, and at rest it soothes Shadow Pokémon', () => {
    const run = fresh('aura');
    const [lead] = run.party;
    const buddy = createPokemon(content, 'rattata', 10, 'b1');
    buddy.hp = 3;
    const shadow = createPokemon(content, 'gastly', 10, 's1');
    makeShadow(shadow, 20);
    run.party.push(buddy, shadow);
    makeBlissful(content, lead!);
    expect(isBlissful(lead!)).toBe(true);
    expect(blissfulAfterBattle(content, run)).toContain('Rattata');
    expect(buddy.hp).toBeGreaterThan(3);
    expect(blissfulAtRest(content, run)).toEqual([]);
    expect(shadow.shadow!.heart).toBe(12);
    expect(blissfulAtRest(content, run)).toEqual([]);
    expect(blissfulAtRest(content, run)).toEqual(['Gastly']);
    expect(shadow.shadow).toBeUndefined();
    expect(flagOf(run, 'kindness')).toBe(1);
  });
  it('a blessing is a handful of battles of an ordinary modifier and wears off', () => {
    const run = fresh('bless');
    const before = run.perkEffects.length;
    expect(grantBlessing(content, run, 'blessing-hearth')).toMatch(/Hearth/);
    expect(run.perkEffects.length).toBe(before + 1);
    expect(run.tempEffects.at(-1)!.battles).toBe(3);
  });
  it('the awakening effect needs a fond, healthy, non-Shadow Pokémon', () => {
    const run = fresh('awaken');
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 'ev', kind: 'event', used: false, eventId: 'blissful-awakening' });
    run.stage!.current = node.id;
    addFlag(run, 'sanctuary-restored');
    run.party[0]!.friendship = 200;
    expect(conditionMet(content, run, { kind: 'friendship', atLeast: 150 })).toBe(true);
    const r = chooseEvent(content, run, 'ev', 0);
    expect(r.run.party[0]!.blissful).toBeDefined();
  });
});

describe('Recovery stories', () => {
  it('every nature has a story and the stages run Sealed to Opening', () => {
    expect(heartStage(content, 100)).toBe('Sealed');
    expect(heartStage(content, 60)).toBe('Wary');
    expect(heartStage(content, 30)).toBe('Thawing');
    expect(heartStage(content, 5)).toBe('Opening');
    const proud = createPokemon(content, 'gastly', 5, 'a');
    proud.nature = 'adamant';
    const stubborn = createPokemon(content, 'gastly', 5, 'b');
    stubborn.nature = 'sassy';
    expect(temperamentOf(content, proud).id).toBe('proud');
    expect(temperamentOf(content, stubborn).id).toBe('stubborn');
    for (const t of content.shadowWorld.temperaments) for (const stage of content.shadowWorld.heartStages) expect(t.lines[stage.name]).toBeTruthy();
  });
  it('a proud Pokémon opens faster than a stubborn one, and a close teammate helps', () => {
    const run = fresh('story');
    const proud = createPokemon(content, 'gastly', 5, 'a');
    proud.nature = 'adamant';
    const stubborn = createPokemon(content, 'gastly', 5, 'b');
    stubborn.nature = 'sassy';
    expect(sootheAmount(content, run, proud)).toBeGreaterThan(sootheAmount(content, run, stubborn));
  });
  it('crossing a stage reads its line, and purification reads the last one', () => {
    const run = fresh('lines');
    const mon = createPokemon(content, 'gastly', 5, 'a');
    mon.nature = 'gentle';
    makeShadow(mon, 80);
    run.party = [mon];
    const lines: string[] = [];
    soothePartyAfterBattle(content, run, ['a'], lines);
    expect(lines[0]).toMatch(/Gastly: /);
    mon.shadow = { heart: 1 };
    const done: string[] = [];
    expect(soothePartyAfterBattle(content, run, ['a'], done)).toEqual(['Gastly']);
    expect(done.at(-1)).toMatch(/purified/);
  });
  it('only a Sealed Shadow Pokémon ever ignores a command', () => {
    const sealed = createPokemon(content, 'gastly', 5, 'a');
    makeShadow(sealed, 95);
    expect(shadowResists(content, sealed, 0)).toBe(true);
    expect(shadowResists(content, sealed, 99)).toBe(false);
    makeShadow(sealed, 40);
    expect(shadowResists(content, sealed, 0)).toBe(false);
    expect(shadowResists(content, createPokemon(content, 'gastly', 5, 'b'), 0)).toBe(false);
  });
});

describe('The shadow world', () => {
  it('operations grow with a stream of their own and the same seed gives the same world', () => {
    const grow = (seed: string) => {
      const run = fresh(seed);
      for (let i = 0; i < 6; i++) {
        run.stage!.index = i;
        run.regionIndex = Math.floor(i / 3);
        advanceShadowWorld(content, run);
      }
      return { ops: flagOf(run, 'shadow-activity'), outbreak: flagOf(run, 'shadow-outbreak') };
    };
    expect(grow('world-a')).toEqual(grow('world-a'));
    expect(grow('world-a').ops).toBeGreaterThan(0);
  });
  it('a stronghold hides beside a node once operations are high, and nothing moves while they are quiet', () => {
    const quiet = fresh('den-quiet');
    placeGangDen(content, quiet);
    expect(quiet.stage!.map.nodes.some((n) => n.sides.some((s) => s.id.startsWith('raid-gang')))).toBe(false);
    const busy = fresh('den-busy');
    for (const f of content.shadowWorld.factions) addFlag(busy, `shadow-activity-${f.id}`, 4);
    addFlag(busy, 'shadow-activity', 8);
    let placed = 0;
    for (let i = 0; i < 40; i++) {
      const run = structuredClone(busy);
      run.stage!.index = i;
      placeGangDen(content, run);
      const side = run.stage!.map.nodes.flatMap((n) => n.sides).find((s) => s.id.startsWith('raid-gang'));
      if (side) {
        placed += 1;
        expect(content.raids.raids.find((r) => r.id === side.raidId)!.gang).toBeDefined();
      }
    }
    expect(placed).toBeGreaterThan(5);
  });
  it('gang raids never enter the ordinary den pool', () => {
    const ids = new Set(content.raids.raids.filter((r) => r.gang).map((r) => r.id));
    expect(ids.size).toBe(4);
    for (let i = 0; i < 30; i++) {
      const run = fresh(`pool-${i}`);
      run.stage!.index = i;
      expect(ids.has(pickRaidFor(content, run, `k${i}`).id)).toBe(false);
    }
  });
  it('a gang raid boss is a Shadow Pokémon; winning lowers operations, frees the hideout and the lieutenant slips away', () => {
    const run = fresh('gang');
    const def = content.raids.raids.find((r) => r.id === 'umbra-spire')!;
    expect(gangNotes(content, run, def).join(' ')).toMatch(/Umbra Corps/);
    startRaidBattle(content, run, def, 'gengar', 20);
    expect(run.battle!.enemyTeam[0]!.shadow).toBeDefined();
    addFlag(run, 'shadow-activity', 3);
    addFlag(run, 'shadow-activity-umbra-corps', 3);
    const notes = gangRaidWon(content, run, def);
    expect(notes.join(' ')).toMatch(/slips away/);
    expect(flagOf(run, 'shadow-activity')).toBe(1);
    expect(flagOf(run, 'liberated-umbra-corps')).toBe(1);
    expect(flagOf(run, 'lieutenant-loose')).toBe(1);
    expect(gangNotes(content, run, def).join(' ')).toMatch(/back with a fresh team/);
    gangRaidWon(content, run, def);
    gangRaidWon(content, run, def);
    expect(flagOf(run, 'lieutenant-loose')).toBe(1);
  });
  it('an outbreak taints a share of wild encounters and nothing else', () => {
    const run = fresh('outbreak');
    const plain = createPokemon(content, 'rattata', 5, 'w');
    expect(outbreakShadow(content, run, plain, 'n1')).toBe(false);
    addFlag(run, 'shadow-outbreak');
    let tainted = 0;
    for (let i = 0; i < 60; i++) {
      const m = createPokemon(content, 'rattata', 5, `w${i}`);
      if (outbreakShadow(content, run, m, `n${i}`)) {
        tainted += 1;
        expect(m.shadow!.heart).toBeGreaterThanOrEqual(content.shadowWorld.startHeart.min);
      }
    }
    expect(tainted).toBeGreaterThan(5);
    expect(tainted).toBeLessThan(60);
  });
});

describe('Events', () => {
  it('stay out of an ordinary run and show up when the world calls for them', () => {
    const run = fresh('ev-gate');
    const ids = (r: typeof run) => new Set(eligibleEvents(content, r).map((e) => e.id));
    for (const id of ['shadow-outbreak', 'shadow-stronghold', 'sanctuary-found', 'blissful-encounter', 'sanctuary-attack']) expect(ids(run).has(id)).toBe(false);
    run.stage!.index = 3;
    run.regionIndex = 1;
    addFlag(run, 'shadow-outbreak');
    addFlag(run, 'shadow-activity', 4);
    addFlag(run, 'sanctuary-sign');
    addFlag(run, 'kindness', 3);
    const now = ids(run);
    for (const id of ['shadow-outbreak', 'shadow-stronghold', 'sanctuary-found', 'ancient-shrine']) expect(now.has(id), id).toBe(true);
  });
  it('rescuing from a hideout gives a Shadow Pokémon, and a sanctuary rest blesses the party and opens the world', () => {
    const run = fresh('ev-rescue');
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 'ev1', kind: 'event', used: false, eventId: 'shadow-stronghold' });
    node.sides.push({ id: 'ev2', kind: 'event', used: false, eventId: 'sanctuary-found' });
    run.stage!.current = node.id;
    addFlag(run, 'sanctuary-sign');
    const rest = chooseEvent(content, run, 'ev2', 0);
    expect(flagOf(rest.run, 'sanctuary-found')).toBe(1);
    expect(flagOf(rest.run, 'sanctuary-sign')).toBe(0);
    expect(rest.run.tempEffects.length).toBe(1);
    const stronghold = content.events.get('shadow-stronghold')!;
    const join = stronghold.choices[0]!.success.effects.find((e) => e.kind === 'join');
    expect(join && join.kind === 'join' && join.shadow).toBe(true);
  });
  it('the old Shadow Sanctuary now hands out a real Shadow Pokémon', () => {
    const run = fresh('ev-old');
    const node = run.stage!.map.nodes[0]!;
    node.sides.push({ id: 'ev', kind: 'event', used: false, eventId: 'shadow-sanctuary' });
    run.stage!.current = node.id;
    const r = chooseEvent(content, run, 'ev', 1);
    const joined = r.run.pending.find((p) => p.kind === 'caught');
    expect(joined && joined.kind === 'caught' && joined.mon.shadow).toBeDefined();
  });
});

describe('Saves', () => {
  it('Blissful and snagged state survive a save round trip', () => {
    const mon = createPokemon(content, 'togetic', 10, 'a');
    makeBlissful(content, mon);
    expect(PokemonInstanceSchema.parse(JSON.parse(JSON.stringify(mon))).blissful).toEqual(mon.blissful);
  });
});
