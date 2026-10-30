// Mega-Expeditions (Blueprint section 2): routes, party modes, attrition, Mega Energy, extraction and failure.

import { describe, expect, it } from 'vitest';
import { generateRoute, validateRoute } from '../../src/core/expedition/graph';
import { availableNodes, beginExpedition, chooseExpeditionNode, expeditionPreview, extractExpedition, getExpedition, resolveExpeditionChoice, settleExpedition } from '../../src/core/expedition/flow';
import { ExpeditionFileSchema } from '../../src/core/expedition/schema';
import { createPokemon, maxHp } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import expeditionsJson from '../../src/data/expeditions.json';
import { content } from './helpers';

function gateRun(seed: string, expeditionId: string): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'ex', seed, archetypeId: 'red' }), 0));
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides = [{ id: 'gate-test', kind: 'expedition', expeditionId, used: false }];
  run.stage!.current = node.id;
  return run;
}

/** Takes the first available stop, answering choices with option 0, and fakes won fights. Returns the finished run. */
function walk(run: RunState, opts: { loseAt?: number; extractAt?: number } = {}): RunState {
  let fights = 0;
  for (let guard = 0; guard < 60 && run.phase === 'expedition'; guard++) {
    const exp = run.expedition!;
    if (exp.battleResult) {
      run = settleExpedition(content, run);
      continue;
    }
    if (exp.choice) {
      run = resolveExpeditionChoice(content, run, 0);
      continue;
    }
    if (opts.extractAt !== undefined && exp.nodes.filter((n) => n.done).length >= opts.extractAt) return extractExpedition(content, run);
    run = chooseExpeditionNode(content, run, availableNodes(exp)[0]!.id);
    if (run.phase === 'battle') {
      fights += 1;
      run.battle = null;
      run.phase = 'expedition';
      run.expedition!.battleResult = opts.loseAt === fights ? 'lose' : 'win';
    }
  }
  return run;
}

describe('expedition data and routes', () => {
  it('validates, covers every party mode and all four tiers', () => {
    expect(ExpeditionFileSchema.safeParse(expeditionsJson).success).toBe(true);
    const defs = content.expeditions.expeditions;
    expect(new Set(defs.map((d) => d.partyMode))).toEqual(new Set(['own', 'rental', 'recruit', 'draft', 'combined']));
    expect(new Set(defs.map((d) => d.tier))).toEqual(new Set([1, 2, 3, 4]));
  });

  it('every generated route has 5–9 stops, one finale, no dead ends, and is the same for the same seed', () => {
    for (const def of content.expeditions.expeditions) {
      for (let i = 0; i < 60; i++) {
        const nodes = generateRoute(def, new Rng(hashSeed(`${def.id}-${i}`)));
        expect(validateRoute(def, nodes), `${def.id} ${i}`).toEqual([]);
        expect(nodes.some((n) => n.kind === 'rest'), `${def.id} ${i} has a rest`).toBe(true);
        expect(JSON.stringify(generateRoute(def, new Rng(hashSeed(`${def.id}-${i}`))))).toBe(JSON.stringify(nodes));
      }
    }
  });

  it('validation catches a dead end and an unreachable stop', () => {
    const def = content.expeditions.expeditions[0]!;
    const nodes = generateRoute(def, new Rng(hashSeed("one")));
    const broken = structuredClone(nodes);
    broken.find((n) => n.layer === 1)!.next = [];
    expect(validateRoute(def, broken).join()).toContain('dead end');
  });
});

describe('party modes', () => {
  it('own: the party is unchanged', () => {
    const run = beginExpedition(content, gateRun('e-own', 'ember-trail'), 'gate-test');
    expect(run.phase).toBe('expedition');
    expect(run.party).toHaveLength(1);
    expect(run.expedition!.tempUids).toEqual([]);
  });

  it('rental: three rentals, your party waits, and comes back afterwards', () => {
    const start = gateRun('e-rent', 'borrowed-team');
    const ownUid = start.party[0]!.uid;
    const run = beginExpedition(content, start, 'gate-test');
    expect(run.party).toHaveLength(3);
    expect(run.party.every((p) => run.expedition!.tempUids.includes(p.uid))).toBe(true);
    const done = walk(run);
    expect(done.phase).toBe('map');
    expect(done.party.map((p) => p.uid)).toEqual([ownUid]);
    expect(done.expeditions.completed).toContain('borrowed-team');
  });

  it('draft: pick three of six, then the route opens', () => {
    let run = beginExpedition(content, gateRun('e-draft', 'draft-cup'), 'gate-test');
    expect(run.expedition!.choice!.options).toHaveLength(6);
    expect(run.party).toHaveLength(0);
    for (let i = 0; i < 3; i++) run = resolveExpeditionChoice(content, run, 0);
    expect(run.party).toHaveLength(3);
    expect(run.expedition!.choice).toBeNull();
    expect(run.expedition!.status).toBe('route');
  });

  it('combined: your party plus one recruit; a full party sends the last member to the stash', () => {
    let run = beginExpedition(content, gateRun('e-comb', 'grand-crossing'), 'gate-test');
    run = resolveExpeditionChoice(content, run, 0);
    expect(run.party).toHaveLength(2);
    const full = gateRun('e-full', 'grand-crossing');
    while (full.party.length < content.balance.partyMax) full.party.push(createPokemon(content, 'rattata', 5, `f${full.party.length}`));
    let r2 = beginExpedition(content, full, 'gate-test');
    r2 = resolveExpeditionChoice(content, r2, 0);
    expect(r2.party).toHaveLength(content.balance.partyMax);
    expect(r2.expedition!.stash).toHaveLength(1);
    const done = walk(r2);
    expect(done.party).toHaveLength(content.balance.partyMax);
    expect(done.party.some((p) => p.uid === 'f5' || p.uid.startsWith('f'))).toBe(true);
  });
});

describe('expedition rules', () => {
  it('the gate is used up, the preview states the rules, and fights keep HP between stops', () => {
    const start = gateRun('e-rules', 'ember-trail');
    const pv = expeditionPreview(content, start, 'gate-test');
    expect(pv.rules.join(' ')).toContain('never lose your own Pokémon');
    const run = beginExpedition(content, start, 'gate-test');
    expect(() => beginExpedition(content, { ...run, phase: 'map', expedition: null }, 'gate-test')).toThrow();
    run.party[0]!.hp = 5;
    const next = chooseExpeditionNode(content, run, availableNodes(run.expedition!)[0]!.id);
    expect(next.party[0]!.hp).toBe(5); // no free healing
    expect(next.phase).toBe('battle');
    expect(next.battle!.expedition).toBe(true);
  });

  it('a real win on the route returns to the expedition, with no reward draft', () => {
    let run = beginExpedition(content, gateRun('e-win', 'ember-trail'), 'gate-test');
    run = chooseExpeditionNode(content, run, availableNodes(run.expedition!)[0]!.id);
    run.battle!.enemyTeam[0]!.hp = 1;
    run.party[0]!.level = 80;
    run.party[0]!.hp = 999;
    run.party[0]!.moves = [{ id: 'tackle', pp: 35 }];
    const res = takeTurn(content, run, { kind: 'move', index: 0 });
    expect(res.end?.outcome).toBe('win');
    expect(res.run.phase === 'expedition' || res.run.phase === 'decision').toBe(true);
    if (res.run.phase === 'expedition') expect(res.run.expedition!.battleResult).toBe('win');
    expect(res.run.draft).toBeNull();
  });

  it('completing pays the finale and loot once, unlocks the next expedition and records it', () => {
    const start = gateRun('e-done', 'ember-trail');
    const before = start.money;
    const done = walk(beginExpedition(content, start, 'gate-test'));
    expect(done.phase).toBe('map');
    expect(done.expedition).toBeNull();
    expect(done.expeditions.completed).toEqual(['ember-trail']);
    expect(done.expeditions.unlocked).toEqual(['borrowed-team']);
    expect(done.money).toBeGreaterThan(before);
    expect(done.expeditions.last.join(' ')).toContain('Completed');
  });

  it('extracting early keeps the loot, no finale rewards, no unlock; losing forfeits loot and heals', () => {
    const extracted = walk(beginExpedition(content, gateRun('e-ext', 'ember-trail'), 'gate-test'), { extractAt: 2 });
    expect(extracted.phase).toBe('map');
    expect(extracted.expeditions.completed).toEqual([]);
    expect(extracted.expeditions.unlocked).toEqual([]);

    const start = gateRun('e-lose', 'ember-trail');
    let run = beginExpedition(content, start, 'gate-test');
    run.expedition!.loot.money = 1000;
    const before = run.money;
    run.party[0]!.hp = 0;
    run.party[0]!.hp = 1;
    run = walk(run, { loseAt: 1 });
    expect(run.phase).toBe('map');
    expect(run.expeditions.failed).toEqual(['ember-trail']);
    expect(run.money).toBe(before + Math.floor(1000 * getExpedition(content, 'ember-trail').failureKeep));
    expect(run.party.every((p) => p.hp > 0)).toBe(true);
    expect(run.expedition).toBeNull();
  });

  it('Mega Energy becomes a temporary Mega Stone: kept on completion, taken back on extraction or failure', () => {
    const make = () => {
      const start = gateRun('e-mega', 'ember-trail');
      start.party[0] = createPokemon(content, 'charizard', 30, start.party[0]!.uid);
      let run = beginExpedition(content, start, 'gate-test');
      run.expedition!.nodes.find((n) => n.layer === 0)!.kind = 'megaEnergy';
      run.expedition!.loot.energy = 1; // the cost is 2
      run = chooseExpeditionNode(content, run, availableNodes(run.expedition!)[0]!.id);
      return run;
    };
    const run = make();
    expect(run.expedition!.tempItems).toContain('mega-ring');
    const stone = run.expedition!.tempItems.find((i) => i !== 'mega-ring')!;
    expect(stone).toMatch(/charizardite/);
    expect(run.inventory[stone]).toBe(1);
    // Extract: stone and ring go back.
    const out = extractExpedition(content, run);
    expect(out.inventory[stone] ?? 0).toBe(0);
    expect(out.inventory['mega-ring'] ?? 0).toBe(0);
    // Complete: the stone stays, the lent ring goes.
    const won = walk(make());
    expect(won.expeditions.completed).toEqual(['ember-trail']);
    expect(won.inventory[stone]).toBeGreaterThanOrEqual(1);
    expect(won.inventory['mega-ring'] ?? 0).toBe(0);
  });

  it('rest and mystery nodes ask for a choice and apply it once', () => {
    let run = beginExpedition(content, gateRun('e-rest', 'ember-trail'), 'gate-test');
    run.expedition!.nodes.find((n) => n.layer === 0)!.kind = 'rest';
    run.party[0]!.hp = 1;
    run = chooseExpeditionNode(content, run, availableNodes(run.expedition!)[0]!.id);
    expect(run.expedition!.status).toBe('choice');
    run = resolveExpeditionChoice(content, run, 0);
    expect(run.party[0]!.hp).toBeGreaterThan(1);
    expect(run.expedition!.status).toBe('route');
    expect(() => resolveExpeditionChoice(content, run, 0)).toThrow();
    expect(run.party[0]!.hp).toBeLessThanOrEqual(maxHp(content, run.party[0]!));
  });
});

describe('expedition saves', () => {
  it('survives a save and reload in the middle of an expedition', () => {
    const run = beginExpedition(content, gateRun('e-save', 'borrowed-team'), 'gate-test');
    const saves = new SaveManager(new MemoryStorageProvider(), content);
    saves.saveRun(run);
    const loaded = saves.loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.data.phase).toBe('expedition');
      expect(loaded.data.expedition!.id).toBe('borrowed-team');
      expect(loaded.data.expedition!.stash).toHaveLength(1);
    }
  });

  it('a version 15 run loads with no expedition', () => {
    const storage = new MemoryStorageProvider();
    const { expedition: _e, expeditions: _x, ...old } = gateRun('e-old', 'ember-trail');
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 15, savedAt: '', data: old }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.data.expedition).toBeNull();
      expect(loaded.data.expeditions.completed).toEqual([]);
    }
  });
});
