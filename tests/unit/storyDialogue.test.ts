import { describe, expect, it } from 'vitest';
import { FRIEND_FLAG, HEAT_FLAG } from '../../src/core/rivals/living';
import { chooseStarter, createRun } from '../../src/core/run';
import { playChoice, queueConsequence, relOf, relState, SCENES, sceneAvailable, stageNumber, surfaceConsequences, freshRel } from '../../src/core/story2/dialogue';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const rival = { id: 'rv', name: 'Dara', archetype: 'golden-retriever', voice: undefined, traits: { ambition: 50, pride: 50, empathy: 50, adaptability: 50, vindictiveness: 50, resilience: 50 } };
const storyRun = (seed = 'w3') => {
  const r = structuredClone(chooseStarter(content, createRun(content, { runId: 'w3', seed, archetypeId: 'red' }), 0));
  r.story.v2 = { mode: 'story_run', contentHash: '', heartbondOverrides: 0, autonomy: 'full', heartbond: { latched: [], pending: [], keystoneReady: false, ledger: [] }, dramatic: 'full', feats: { charge: 0, banked: 0, used: [], gains: [], armed: false, first: null }, sigMoves: [], sigNames: {}, cast: {}, arcs: {}, facts: {}, stops: { index: 0, planned: 0, done: [] }, replans: [], rel: {}, queue: [], scenesDone: [], rivalScene: null, notes: [], fired: [] };
  return r;
};

describe('W3 choice scenes', () => {
  it('data respects the limits: 6 scenes, deltas within +/-8 per choice and +/-20 per scene, every hidden id has data or is a flag only', () => {
    expect(SCENES.scenes).toHaveLength(6);
    for (const s of SCENES.scenes) {
      const worst = Math.max(...s.choices.map((c) => Math.abs(c.rel.respect) + Math.abs(c.rel.rivalry) + Math.abs(c.rel.affection) + Math.abs(c.rel.suspicion)));
      expect(worst).toBeLessThanOrEqual(20);
      for (const c of s.choices) for (const v of Object.values(c.rel)) expect(Math.abs(v)).toBeLessThanOrEqual(8);
      expect(Object.keys(s.reactions).sort()).toEqual(['arrogant', 'competitive', 'friendly', 'idealistic', 'insecure', 'ruthless']);
    }
  });
  it('a choice writes the record, bridges to the live flags, and answers by voice', () => {
    const run = storyRun();
    const res = playChoice(run, rival, 'sc_share_berries', 'a');
    expect(res.reaction).toBe('We\'ll have a picnic! Sit!');
    expect(relOf(run, 'rv')).toMatchObject({ respect: 2, rivalry: 0, affection: 6, suspicion: 0 });
    expect(run.story.flags[FRIEND_FLAG]).toBe(6);
    expect(run.story.flags[HEAT_FLAG]).toBeUndefined();
    playChoice(run, rival, 'sc_boast_fork', 'a');
    expect(run.story.flags[HEAT_FLAG]).toBe(6);
    expect(() => playChoice(run, rival, 'sc_boast_fork', 'b')).toThrow(/already played/);
    expect(sceneAvailable(run, 'sc_boast_fork', 'other')).toBe(true);
  });
  it('a story-run-less run is refused with a clear error', () => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'c', seed: 'c', archetypeId: 'red' }), 0));
    expect(() => playChoice(run, rival, 'sc_boast_fork', 'a')).toThrow(/Story Run/);
  });
});

describe('W3 consequences', () => {
  it('nothing shows at the moment of choice; it surfaces 3 to 4 stages later, exactly once across save and load', () => {
    const run = storyRun();
    playChoice(run, rival, 'sc_share_berries', 'a');
    expect(run.story.v2!.queue).toHaveLength(1);
    expect(surfaceConsequences(run)).toEqual([]);
    const delay = run.story.v2!.queue[0]!.due - stageNumber(run);
    expect(delay).toBeGreaterThanOrEqual(3);
    expect(delay).toBeLessThanOrEqual(4);
    run.story.v2!.queue[0]!.due = stageNumber(run); // time passes: the stage is reached
    // save and reload before surfacing, then surface, then save and reload again
    const sm = new SaveManager(new MemoryStorageProvider(), content);
    sm.saveRun(run);
    const loaded = sm.loadRun();
    expect(loaded.status).toBe('ok');
    const again = (loaded as { data: typeof run }).data;
    const first = surfaceConsequences(again, () => 'Dara');
    expect(first).toHaveLength(1);
    expect(again.story.flags['cq:shared_item']).toBe(1);
    sm.saveRun(again);
    const reloaded = (sm.loadRun() as { data: typeof run }).data;
    expect(surfaceConsequences(reloaded)).toEqual([]);
    expect(reloaded.story.v2!.fired).toHaveLength(1);
  });
  it('respects per-run caps and is deterministic by seed', () => {
    const a = storyRun('s1');
    expect(queueConsequence(a, 'rv', 'mocked_rival')).toBe(true);
    expect(queueConsequence(a, 'rv', 'mocked_rival')).toBe(false);
    expect(queueConsequence(a, 'rv', 'no_such')).toBe(false);
    const b = storyRun('s1');
    queueConsequence(b, 'rv', 'helped_trainer');
    const c = storyRun('s1');
    queueConsequence(c, 'rv', 'helped_trainer');
    expect(b.story.v2!.queue).toEqual(c.story.v2!.queue);
  });
});

describe('W3 relationship states', () => {
  it('maps the four attributes to stages; top and bottom stages need a gate event', () => {
    const rel = freshRel();
    expect(relState(rel).stage).toBe('neutral');
    Object.assign(rel, { respect: 30, affection: 20 });
    expect(relState(rel).stage).toBe('acquainted');
    Object.assign(rel, { respect: 55, affection: 40 });
    expect(relState(rel)).toEqual({ stage: 'friendly', flavors: ['respected'] });
    Object.assign(rel, { affection: 90 });
    expect(relState(rel).stage).not.toBe('close');
    rel.gates.push('share_a_secret');
    expect(relState(rel).stage).toBe('close');
    const bad = { ...freshRel(), affection: 5, suspicion: 60, rivalry: 75 };
    expect(relState(bad)).toEqual({ stage: 'disliked', flavors: ['competitive', 'rivalry'] });
    bad.gates.push('negative_scene');
    expect(relState(bad).stage).toBe('hostile');
    bad.gates.push('betrayal');
    expect(relState(bad).stage).toBe('nemesis');
  });
});
