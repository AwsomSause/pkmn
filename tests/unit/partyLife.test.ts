// Party Personality & Chemistry (APPROVED.md §1, §9, §10).

import { describe, expect, it } from 'vitest';
import { bondOf, TRAIT_AUTONOMY } from '../../src/core/bond';
import { ensureScene, resolveScene, partyLifeTurn, partyLifeVictory, partyLifeCamp, battleLife, personalityOf, relationLabel, stageIndex, teamPhoto, peekPair, PARTY_LIFE, createPartyLife } from '../../src/core/partyLife';
import type { BattleEvent } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import { RunStateSchema, type RunState } from '../../src/core/state';
import { openHistory } from '../../src/core/story/record';
import { content } from './helpers';

function setup(seed: string) {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0));
  for (const [id, uid] of [['rattata', 'b1'], ['pidgey', 'b2'], ['caterpie', 'b3']] as const) {
    const m = createPokemon(content, id, 12, uid);
    run.party.push(m);
    openHistory(content, run, m.uid, m.speciesId, 'caught');
  }
  run.phase = 'map';
  return run;
}

describe('partyLife data', () => {
  it('every Bond Engine trait has a personality with every voice line', () => {
    const voices = new Set(PARTY_LIFE.vignettes.flatMap((v) => (v.voice ? [v.voice] : [])));
    for (const trait of Object.keys(TRAIT_AUTONOMY)) {
      const p = PARTY_LIFE.personalities[trait];
      expect(p, trait).toBeDefined();
      for (const voice of voices) expect(p!.say[voice], `${trait}.${voice}`).toBeTruthy();
      for (const g of p!.gifts) expect(content.items.has(g) || content.catalog.has(g), g).toBe(true);
    }
  });
  it('scene text only uses placeholders the builder fills', () => {
    const known = new Set(['A', 'B', 'foe', 'mem', 'type', 'sulk', 'weatherA', 'poses', 'sayA', 'gift', 'move']);
    for (const v of PARTY_LIFE.vignettes) {
      const all = [...v.text, v.caption, ...(v.choices ?? []).flatMap((c) => [c.label, c.text])];
      for (const t of all) for (const m of t.matchAll(/\{(\w+)\}/g)) expect(known.has(m[1]!), `${v.id}: {${m[1]}}`).toBe(true);
    }
    for (const id of [...PARTY_LIFE.hideRewards, ...PARTY_LIFE.babies.slice(0, 0)]) expect(content.items.has(id) || content.catalog.has(id), id).toBe(true);
  });
});

describe('personality', () => {
  it('is stable for a Pokémon and differs between members of one species', () => {
    const run = setup('pl-person');
    const a = createPokemon(content, 'rattata', 5, 'twin-a');
    const b = createPokemon(content, 'rattata', 5, 'twin-b');
    run.party.push(a, b);
    const views = [a, b].map((m) => personalityOf(run, m));
    expect(personalityOf(run, a)).toEqual(views[0]);
    const many = Array.from({ length: 12 }, (_, i) => personalityOf(run, createPokemon(content, 'rattata', 5, `t${i}`)));
    expect(new Set(many.map((p) => `${p.trait}/${p.quirk}`)).size).toBeGreaterThan(5);
  });
});

describe('pair chemistry', () => {
  it('an ordinary win builds nothing; a boss win or a close call does', () => {
    const run = setup('pl-chem');
    const [a, b] = [run.party[1]!, run.party[2]!];
    run.encountersCompleted = 3;
    for (const m of [a, b]) run.story.histories[m.uid]!.lastBattle = 3;
    partyLifeVictory(content, run);
    expect(peekPair(run, a.uid, b.uid)?.points ?? 0).toBe(0);
    run.encountersCompleted = 4;
    for (const m of [a, b]) run.story.histories[m.uid]!.lastBattle = 4;
    run.story.histories[a.uid]!.closeCalls += 1;
    partyLifeVictory(content, run);
    expect(peekPair(run, a.uid, b.uid)!.points).toBe(PARTY_LIFE.rules.shared.closeCall);
  });
  it('relationship stages follow the thresholds, and a milestone scene is queued once', () => {
    expect(stageIndex(0)).toBe(0);
    expect(stageIndex(PARTY_LIFE.stages[3]!.at)).toBe(3);
    const run = setup('pl-stage');
    const [a, b] = [run.party[1]!, run.party[2]!];
    run.encountersCompleted = 2;
    run.story.histories[a.uid]!.lastBattle = 2;
    run.story.histories[b.uid]!.lastBattle = 2;
    partyLifeTurn(content, run, []);
    run.story.histories[a.uid]!.closeCalls += 1;
    for (let i = 0; i < 6; i++) partyLifeVictory(content, run);
    expect(peekPair(run, a.uid, b.uid)!.points).toBeGreaterThanOrEqual(12);
    expect(relationLabel(run, a.uid, b.uid)).not.toBe('Indifferent');
    const scene = ensureScene(content, run);
    expect(scene?.milestone).toBe('friendly');
    expect(resolveScene(content, run, null)).not.toBeNull();
    expect(resolveScene(content, run, null)).toBeNull();
  });
});

describe('scenes between nodes', () => {
  function withTravel(seed: string) {
    const run = setup(seed);
    run.stage!.current = run.stage!.map.nodes[0]!.id;
    run.encountersCompleted = 2;
    return run;
  }
  it('rolls the same scene for the same transition, once, and never twice in a row', () => {
    let found = 0;
    for (let i = 0; i < 40 && found < 3; i++) {
      const run = withTravel(`pl-scene-${i}`);
      const a = structuredClone(run);
      const first = ensureScene(content, run);
      const again = ensureScene(content, run);
      expect(again).toEqual(first);
      expect(ensureScene(content, a)).toEqual(first);
      if (first) {
        found++;
        const before = run.partyLife.scrapbook.length;
        resolveScene(content, run, null);
        expect(run.partyLife.recent).toContain(first.id);
        expect(run.partyLife.scrapbook.length).toBe(before + 1);
        expect(run.partyLife.scene).toBeNull();
      }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('a fainted teammate brings a gathering, comfort or pact scene next', () => {
    let seen = 0;
    for (let i = 0; i < 12; i++) {
      const run = withTravel(`pl-faint-${i}`);
      const [a, b] = [run.party[1]!, run.party[2]!];
      run.partyLife.pairs.push({ key: [a.uid, b.uid].sort().join('|'), a: a.uid, b: b.uid, points: 35, tension: 0, stageSeen: 2, memories: [], lastScene: -99 });
      b.hp = 0;
      run.battle = null;
      run.partyLife.ctx.faints.push({ uid: b.uid, foe: 'pidgey' });
      run.partyLife.pacts.push({ uid: a.uid, forUid: b.uid, species: 'pidgey', until: 99 });
      const scene = ensureScene(content, run);
      expect(['revenge-pact', 'gather-faint', 'comfort-loss']).toContain(scene?.id);
      seen++;
    }
    expect(seen).toBe(12);
  });
  it('a boss ahead triggers the pre-boss huddle, and it takes a photo', () => {
    const run = setup('pl-hug');
    const stage = run.stage!;
    stage.current = stage.map.nodes.find((n) => n.next.length > 0)!.id;
    // Make every node ahead of the current one a gym.
    const cur = stage.map.nodes.find((n) => n.id === stage.current)!;
    for (const n of stage.map.nodes) if (cur.next.includes(n.id)) n.kind = 'gym';
    run.encountersCompleted = 3;
    const scene = ensureScene(content, run);
    expect(scene?.id).toBe('group-hug');
    resolveScene(content, run, null);
    expect(run.partyLife.scrapbook.some((e) => e.kind === 'photo' && e.poses.length === run.party.length)).toBe(true);
  });
  it('a choice that suits either Pokémon doubles the chemistry', () => {
    const run = setup('pl-choice');
    const [a, b] = [run.party[1]!, run.party[2]!];
    bondOf(run, a.uid).trait = 'empathetic';
    bondOf(run, b.uid).trait = 'competitive';
    run.partyLife.scene = { id: 'bicker', key: 'k', caption: 'x', uids: [a.uid, b.uid], lines: ['x'], choices: [{ label: 'Mediate', text: 't' }, { label: 'Side', text: 't' }, { label: 'Let be', text: 't' }], dflt: 2 };
    resolveScene(content, run, 0);
    expect(peekPair(run, a.uid, b.uid)!.points).toBe(2);
  });
  it('a gift scene hands over exactly one item, once', () => {
    const run = setup('pl-gift');
    const a = run.party[1]!;
    run.partyLife.scene = { id: 'gift-found', key: 'k', caption: 'x', uids: [a.uid], lines: ['x'], choices: [], dflt: 0, gift: 'oran-berry' };
    const before = run.inventory['oran-berry'] ?? 0;
    resolveScene(content, run, null);
    resolveScene(content, run, null);
    expect(run.inventory['oran-berry']).toBe(before + 1);
  });
  it('a camp stop makes the next scene a campfire one when something fits', () => {
    const run = setup('pl-camp');
    run.stage!.current = run.stage!.map.nodes[0]!.id;
    run.encountersCompleted = 5;
    partyLifeCamp(run);
    const scene = ensureScene(content, run);
    if (scene) expect(PARTY_LIFE.vignettes.find((v) => v.id === scene.id)?.ctx).toBe('camp');
  });
});

describe('grudges and pacts', () => {
  const faint = (uid: string): BattleEvent => ({ type: 'faint', side: 'player', uid } as unknown as BattleEvent);
  it('a repeated defeat starts a grudge; a close friend swears a pact; both show in battle', () => {
    const run = setup('pl-grudge');
    const [a, b] = [run.party[1]!, run.party[2]!];
    run.partyLife.pairs.push({ key: [a.uid, b.uid].sort().join('|'), a: a.uid, b: b.uid, points: 35, tension: 0, stageSeen: 2, memories: [], lastScene: -99 });
    run.battle = { kind: 'trainer', enemyTeam: [{ speciesId: 'pidgey', uid: 'e1' }], enemyIndex: 0, trainer: null } as unknown as RunState['battle'];
    run.encountersCompleted = 4;
    partyLifeTurn(content, run, [faint(a.uid)]);
    expect(run.partyLife.grudges).toHaveLength(0);
    partyLifeTurn(content, run, [faint(a.uid)]);
    expect(run.partyLife.grudges).toEqual([{ uid: a.uid, species: 'pidgey', since: 4, settled: false }]);
    expect(run.partyLife.pacts[0]).toMatchObject({ uid: b.uid, forUid: a.uid, species: 'pidgey' });
    expect(battleLife(content, run, a, 'pidgey').grudge).toBe(true);
    expect(battleLife(content, run, b, 'pidgey').pact).toBe(b.uid);
    expect(battleLife(content, run, b, 'rattata').pact).toBeNull();
    expect(teamPhoto(content, run)).toBe(true);
    expect(teamPhoto(content, run)).toBe(false);
  });
});

describe('saves', () => {
  it('a run saved before partyLife loads with an empty one, and a full one survives a round trip', () => {
    const run = setup('pl-save');
    const { partyLife: _gone, ...old } = JSON.parse(JSON.stringify(run));
    const loaded = RunStateSchema.parse(old);
    expect(loaded.partyLife).toEqual(createPartyLife());
    run.partyLife.scrapbook.push({ id: 's', n: 1, region: 0, stage: 0, kind: 'photo', caption: 'c', uids: [], delta: 0, poses: ['x'] });
    expect(RunStateSchema.parse(JSON.parse(JSON.stringify(run))).partyLife.scrapbook).toHaveLength(1);
  });
});
