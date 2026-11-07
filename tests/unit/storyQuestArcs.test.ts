// Quest arcs that unlock Rare and Exceptional Remembrance lines: every such line has a way in, the arcs play at free Stops in any
// backstory (one at a time, at most one started per Act), and finishing one unlocks its line for the profile.

import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/core/profile';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { activeScene, chooseBackstory, finishScene, foldModuleIntoProfile, queueStopScene } from '../../src/core/story2/module';
import { content } from './helpers';
import { keepsakeMark } from '../../src/core/story2/keepsakes';

const storyRun = (seed: string, backstory: string): RunState => {
  const run = chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', campaignId: 'orrery-circuit' }), 0);
  chooseBackstory(content, run, backstory);
  return run;
};

function playAll(run: RunState): string[] {
  const v2 = run.story.v2!;
  const played: string[] = [];
  const drain = (): void => {
    for (let guard = 0; guard < 4 && v2.module!.active; guard++) {
      const s = activeScene(content, run)!;
      played.push(s.eventId);
      expect(finishScene(content, run, s.choices[0]?.id)).toBe(true);
    }
  };
  drain();
  v2.blueprint!.stops.forEach((stop, i) => {
    v2.stops.done.push(stop.id);
    v2.stops.index = i + 1;
    queueStopScene(content, run, stop.id);
    drain();
  });
  return played;
}

const quests = () => content.storyData.arcs.filter((a) => a.id.startsWith('arc_qa_'));

describe('Rare and Exceptional unlock quests', () => {
  it('every Rare and Exceptional line has an unlock event that exists and really unlocks it', () => {
    const lines = content.storyData.remembrances.filter((r) => r.rarity === 'rare' || r.rarity === 'exceptional');
    expect(lines).toHaveLength(22);
    const unlocksOf = (eventId: string) => {
      const e = content.storyData.events.find((x) => x.id === eventId);
      const arc = content.storyData.arcs.find((a) => a.steps.some((s) => s.event === eventId));
      return [...(e?.outputs ?? []), ...(e?.choices ?? []).flatMap((c) => c.effects), ...(arc?.effects ?? [])].filter((f) => f.kind === 'unlock').map((f) => f.target);
    };
    // Lines unlocked by a story event (the map-event ones, like Poliwag's pond, live outside the story data).
    for (const r of lines.filter((x) => x.unlock.kind === 'event' && content.storyData.events.some((e) => e.id === x.unlock.arg))) expect(unlocksOf(r.unlock.arg!), r.id).toContain(r.id);
    const questLines = new Set(quests().flatMap((a) => unlocksOf(a.steps[a.steps.length - 1]!.event)));
    for (const id of ['rm_dratini', 'rm_bagon', 'rm_beldum', 'rm_gible', 'rm_deino', 'rm_goomy', 'rm_jangmo_o', 'rm_dreepy', 'rm_frigibax', 'rm_togepi', 'rm_nidoran_f', 'rm_nidoran_m', 'rm_duskull', 'rm_pawniard']) expect(questLines.has(id), id).toBe(true);
    for (const a of quests()) for (const s of a.steps) {
      const e = content.storyData.events.find((x) => x.id === s.event)!;
      for (const b of e.beats) expect(content.storyData.text[String(b.textKey)], e.id).toBeTruthy();
    }
  });

  it('plays quest arcs whole and in order at free Stops in every backstory, one per Act at most, and unlocks the line', () => {
    let finished = 0;
    let gifts = 0;
    for (const bs of content.balance.story.module.enabledBackstories) {
      for (const seed of ['q1', 'q2']) {
        const run = storyRun(`${seed}-${bs}`, bs);
        const played = playAll(run);
        const v2 = run.story.v2!;
        const started = quests().filter((a) => v2.arcs[a.id]);
        expect(started.length, bs).toBeLessThanOrEqual(5);
        expect(started.filter((a) => v2.arcs[a.id]!.state === 'active').length).toBeLessThanOrEqual(1);
        for (const a of started) {
          const idx = a.steps.map((s) => played.indexOf(s.event)).filter((i) => i >= 0);
          expect(idx, a.id).toEqual([...idx].sort((x, y) => x - y));
        }
        // S6 Keepsakes: a questline ending on its good exit plays The Gift once (Satchel mark).
        const goodEnd = started.some((a) => v2.arcs[a.id]!.state === 'done' && v2.facts[`arc.${a.id}`] === a.exits[0]);
        if (goodEnd && v2.heartbond.partner) { gifts += 1; expect(keepsakeMark(run, 'gift'), bs).toBe(1); }
        for (const a of started.filter((x) => v2.arcs[x.id]!.state === 'done')) {
          finished += 1;
          const last = content.storyData.events.find((e) => e.id === a.steps[a.steps.length - 1]!.event)!;
          const profile = createProfile(content, 'p');
          foldModuleIntoProfile(profile, run);
          for (const o of last.outputs.filter((f) => f.kind === 'unlock')) expect(profile.story.remembrance[String(o.target)]?.state, a.id).toBe('unlocked');
        }
      }
    }
    expect(finished).toBeGreaterThan(0);
    expect(gifts).toBeGreaterThan(0);
  });

  it('the same seed plays the same quest scenes', () => {
    const a = playAll(storyRun('q-same', 'bs_aether')).filter((id) => id.startsWith('ev_qa_'));
    const b = playAll(storyRun('q-same', 'bs_aether')).filter((id) => id.startsWith('ev_qa_'));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
