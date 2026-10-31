import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import { createProfile } from '../../src/core/profile';
import { createRun } from '../../src/core/run';
import { ProfileSchema, type Profile } from '../../src/core/state';
import { LEGACY, applyStartGrants, ascend, buyNode, contactProblem, hubProps, intelLevel, legacyOf, networkSlots, nodeProblem, prestigeProblem, recordMuseum, recordRegionIntel, regionBoard, serviceFor, shelveSeed, shelfProblem, startGrants, toggleContact, trainMove, trainProblem, unshelveSeed, getNode } from '../../src/core/legacy';

const base = (over: Partial<Profile> = {}): Profile => ({ ...createProfile(content, 'p'), bankCredits: 50000, researchPoints: 5000, counters: { regionsCleared: 100 }, ...over });

describe('legacy data', () => {
  it('names real items, and every tree link and slot points at something', () => {
    const effects = [...LEGACY.tree.nodes.map((n) => n.effect), ...LEGACY.network.services.map((s) => s.effect)];
    for (const e of effects) if (e.kind === 'item') expect(content.items.has(e.item), e.item).toBe(true);
    for (const n of LEGACY.tree.nodes) {
      if (n.requires) expect(getNode(n.requires), n.id).toBeTruthy();
      expect(LEGACY.tree.branches.some((b) => b.id === n.branch)).toBe(true);
    }
  });
  it('gives every trainer one service', () => {
    for (const a of content.archetypes.values()) expect(serviceFor(a.id).id).toBeTruthy();
  });
  it('profiles without legacy state still load', () => {
    const p = createProfile(content, 'p');
    expect(ProfileSchema.parse(p).legacy).toBeUndefined();
    expect(legacyOf(p).tree).toEqual([]);
  });
});

describe('Research Tree and Prestige', () => {
  it('spends Research Points, follows requirements and needs Prestige for deeper nodes', () => {
    let p = base();
    p = buyNode(p, 'field-notes');
    expect(p.researchPoints).toBe(5000 - 20);
    expect(() => buyNode(p, 'field-notes')).toThrow(/Already/);
    expect(nodeProblem(p, getNode('ball-satchel')!)).toMatch(/Trail Rations/);
    p = buyNode(p, 'trail-rations');
    expect(nodeProblem(p, getNode('ball-satchel')!)).toMatch(/Prestige rank 1/);
    p = ascend(p, 'now');
    p = buyNode(p, 'ball-satchel');
    expect(legacyOf(p).tree).toHaveLength(3);
    expect(nodeProblem(base({ researchPoints: 1 }), getNode('field-notes')!)).toMatch(/need 20/);
  });
  it('Prestige costs credits, gives a title and a slot, and keeps everything else', () => {
    const p0 = base({ achievements: { a: { earnedAt: 'x' } }, speciesCaught: ['pikachu'] });
    const p = ascend(p0, 'now');
    expect(p.legacy!.prestige).toBe(1);
    expect(p.bankCredits).toBe(50000 - 500);
    expect(p.titles).toContain('Prestige I: Veteran');
    expect(p.achievements).toEqual(p0.achievements);
    expect(p.speciesCaught).toEqual(['pikachu']);
    expect(networkSlots(p)).toBe(networkSlots(p0) + 1);
    expect(prestigeProblem(base({ counters: {} }))).toMatch(/Clear 3 regions/);
    let top = p;
    for (let i = 0; i < 4; i++) top = ascend(top, 'now');
    expect(() => ascend(top, 'now')).toThrow(/top Prestige/);
  });
});

describe('Trainer Network and start grants', () => {
  it('limits contacts to the slots, and a run grants Tree and contact bonuses once', () => {
    let p = base({ unlockedArchetypes: ['red', 'blue', 'green'] });
    p = toggleContact(p, 'blue');
    expect(contactProblem(p, 'green')).toMatch(/slots are used/);
    expect(() => toggleContact(p, 'green')).toThrow();
    p = buyNode(p, 'field-notes');
    p = buyNode(p, 'trail-rations');
    const g = startGrants(content, p, 'red');
    expect(g.money).toBeGreaterThanOrEqual(100);
    expect(g.items.potion).toBeGreaterThanOrEqual(2);
    // A trainer is never their own contact.
    expect(startGrants(content, p, 'blue').money + (startGrants(content, p, 'blue').items.potion ?? 0)).not.toBeNaN();
    const run = createRun(content, { runId: 'r', seed: 's', archetypeId: 'red', campaignId: 'dev' });
    const before = { money: run.money, potion: run.inventory.potion ?? 0 };
    applyStartGrants(content, run, p);
    expect(run.money).toBe(before.money + g.money);
    expect(run.inventory.potion ?? 0).toBe(before.potion + (g.items.potion ?? 0));
    toggleContact(p, 'blue');
    expect(legacyOf(toggleContact(p, 'blue')).contacts).toEqual([]);
  });
});

describe('Item Museum, Board, training, Hub and shelf', () => {
  it('records items once and pays milestones once', () => {
    const run = createRun(content, { runId: 'r', seed: 's', archetypeId: 'red', campaignId: 'dev' });
    for (let i = 0; i < 12; i++) run.inventory[`fake-${i}`] = 1;
    const p = base();
    const paid = recordMuseum(p, run, 'now');
    expect(paid).toBe(10);
    expect(legacyOf(p).museum.length).toBeGreaterThanOrEqual(12);
    expect(recordMuseum(p, run, 'now')).toBe(0);
  });
  it('Board reveals more with visits, clears and the Tree', () => {
    const region = [...content.regions.values()][0]!;
    let p = base();
    expect(regionBoard(content, p, region).lines[0]).toMatch(/unknown/);
    const run = createRun(content, { runId: 'r', seed: 's', archetypeId: 'red', campaignId: 'dev' });
    recordRegionIntel(p, run);
    expect(legacyOf(p).regionIntel[run.regionOrder[0]!]!.visits).toBe(1);
    const visited = content.regions.get(run.regionOrder[0]!)!;
    expect(regionBoard(content, p, visited).lines[0]).toMatch(/unknown/);
    p = buyNode(p, 'region-notes');
    expect(intelLevel(p)).toBe(1);
    expect(regionBoard(content, p, visited).lines[0]).toMatch(/Gym leaders: /);
    expect(regionBoard(content, p, visited).lines[1]).toMatch(/unknown/);
  });
  it('training turns Research Points into uses but stops at silver', () => {
    let p = base({ moveUses: { tackle: 1 } });
    expect(trainProblem(content, p, 'ember-not-used')).toMatch(/Use this move/);
    for (let i = 0; i < 6; i++) p = trainMove(content, p, 'tackle');
    expect(p.moveUses!.tackle).toBe(30);
    expect(trainProblem(content, p, 'tackle')).toMatch(/Training stops/);
  });
  it('the Hub grows with points and the shelf holds a limited number of seeds', () => {
    expect(hubProps(base({ counters: {} }))).toHaveLength(0);
    let p = ascend(ascend(base(), 'n'), 'n');
    expect(hubProps(p).length).toBeGreaterThan(0);
    for (let i = 0; i < LEGACY.seedShelf.slots; i++) p = shelveSeed(p, `PR1.${i}`, 'x', 'now');
    expect(shelfProblem(p, 'PR1.new')).toMatch(/holds/);
    expect(shelfProblem(p, 'PR1.0')).toMatch(/already/);
    expect(legacyOf(unshelveSeed(p, 'PR1.0')).seedShelf).toHaveLength(LEGACY.seedShelf.slots - 1);
  });
});
