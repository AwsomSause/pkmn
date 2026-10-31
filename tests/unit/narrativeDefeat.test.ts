// M12 narrative rival defeats: NARRATIVE_DEFEAT is not STANDARD_DEFEAT.

import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun, debugReplaceEnemy, takeTurn } from '../../src/core/run';
import { dueNarrativeDefeat, foreshadowNote, getNarrativeDef, narrativeFlag, narrativeLossFlag, narrativeWon, NARRATIVE_CONFIG } from '../../src/core/rivals/narrativeDefeat';
import { STANDARD_CHOICE, type RulesChoice } from '../../src/core/rules';
import { RunStateSchema, type RunState } from '../../src/core/state';
import type { Rival } from '../../src/core/story/schema';
import { content, toBattle } from './helpers';

const DEF = NARRATIVE_CONFIG.defs[0]!;
const start = (seed: string, rules: Partial<RulesChoice> = {}): RunState => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', rules: { ...STANDARD_CHOICE, ...rules } }), 0);
const fakeRival = (encounters: number) => ({ id: 'rv1', name: 'Joey', encounters }) as unknown as Rival;

function narrativeBattle(run: RunState): RunState {
  const r = debugReplaceEnemy(content, toBattle(run), 'growlithe', 60);
  r.battle!.narrative = { id: DEF.id };
  r.battle!.rivalId = 'rv1';
  return r;
}
function playOut(run: RunState) {
  let r = run;
  let last: ReturnType<typeof takeTurn> | null = null;
  for (let guard = 0; r.phase === 'battle' && guard < 100; guard++) {
    last = takeTurn(content, r, { kind: 'move', index: 0 });
    r = last.run;
  }
  return { run: r, last: last! };
}

describe('narrative defeat selection', () => {
  it('is due only after enough meetings, once, and respects maxPerRun', () => {
    const run = start('n1');
    expect(dueNarrativeDefeat(run, fakeRival(DEF.minMeetings - 1), true)).toBeNull();
    expect(dueNarrativeDefeat(run, fakeRival(DEF.minMeetings), true)?.id).toBe(DEF.id);
    expect(dueNarrativeDefeat(run, fakeRival(DEF.minMeetings), false)).toBeNull();
    run.story.flags[narrativeFlag(DEF.id)] = 'lost';
    expect(dueNarrativeDefeat(run, fakeRival(DEF.minMeetings), true)).toBeNull();
  });
  it('a rival that already won narratively never does it twice', () => {
    const run = start('n2');
    run.story.flags[narrativeLossFlag('rv1')] = 3;
    expect(dueNarrativeDefeat(run, fakeRival(5), true)).toBeNull();
  });
  it('foreshadows the meeting before, once', () => {
    const run = start('n3');
    expect(foreshadowNote(run, fakeRival(DEF.minMeetings - 1))).toBe(DEF.foreshadow);
    expect(foreshadowNote(run, fakeRival(DEF.minMeetings - 1))).toBeNull();
    expect(foreshadowNote(run, fakeRival(0))).toBeNull();
  });
  it('winning the fight anyway marks it done so it never repeats', () => {
    const run = start('n4');
    narrativeWon(run, DEF.id);
    expect(run.story.flags[narrativeFlag(DEF.id)]).toBe('won');
    expect(dueNarrativeDefeat(run, fakeRival(9), true)).toBeNull();
  });
});

describe('losing a narrative battle', () => {
  it('keeps the run: no game over, healed party, node counted, story records it', () => {
    const run = narrativeBattle(start('n5'));
    const money = run.money;
    const party = run.party.map((m) => m.uid);
    const done = run.encountersCompleted;
    const { run: after, last } = playOut(run);
    expect(last.narrativeDefeat?.id).toBe(DEF.id);
    expect(last.defeated).toBe(false);
    expect(after.phase).not.toBe('over');
    expect(after.battle).toBeNull();
    expect(after.party.map((m) => m.uid)).toEqual(party);
    expect(after.party.every((m) => m.hp > 0)).toBe(true);
    expect(after.money).toBe(money);
    expect(after.encountersCompleted).toBe(done + 1);
    expect(after.log.defeatedBy).toBeNull();
    expect(after.log.battlesWon).toBe(0);
    expect(after.story.flags[narrativeFlag(DEF.id)]).toBe('lost');
    expect(after.story.flags[narrativeLossFlag('rv1')]).toBeDefined();
    expect(after.log.counters.narrativeDefeats).toBe(1);
    expect(after.log.counters.trainersDefeated ?? 0).toBe(0);
    expect(after.story.events.some((e) => e.data.defeatType === 'NARRATIVE_DEFEAT')).toBe(true);
  });
  it('does not use up Death-Block or the VS Recorder', () => {
    const run = narrativeBattle(start('n6', { deathBlock: true }));
    const { run: after } = playOut(run);
    expect(after.rules.deathBlockUsed).toBeFalsy();
    expect(after.phase).not.toBe('over');
  });
  it('an ordinary lost battle is still a standard defeat', () => {
    const run = debugReplaceEnemy(content, toBattle(start('n7')), 'growlithe', 60);
    const { run: after, last } = playOut(run);
    expect(last.narrativeDefeat).toBeUndefined();
    expect(after.phase).toBe('over');
  });
  it('survives a save/reload in the middle of the battle', () => {
    const run = narrativeBattle(start('n8'));
    const reloaded = RunStateSchema.parse(JSON.parse(JSON.stringify(run)));
    expect(reloaded.battle?.narrative?.id).toBe(DEF.id);
    const { last } = playOut(reloaded);
    expect(last.narrativeDefeat?.id).toBe(DEF.id);
  });
  it('data is well formed', () => {
    expect(getNarrativeDef(DEF.id)).toBe(DEF);
    expect(new Set(NARRATIVE_CONFIG.defs.map((d) => d.id)).size).toBe(NARRATIVE_CONFIG.defs.length);
  });
});
