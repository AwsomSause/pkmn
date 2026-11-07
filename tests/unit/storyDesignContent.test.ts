// Story Overhaul design content: the six original Evil Teams (Part IV), Alphas (Part IX-B) and the Exhibition Bracket (Part IX).
import { describe, expect, it } from 'vitest';
import { chooseEvent, eligibleEvents } from '../../src/core/events';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { evilOf, evilStageStart, plannedEvilTeamId } from '../../src/core/evil/teams';
import { hashSeed, Rng } from '../../src/core/rng';
import { content } from './helpers';

const classic = (seed: string): RunState => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0);
const story = (seed: string): RunState => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', campaignId: 'orrery-circuit' }), 0);
const ORIGINAL = ['marauders', 'choir', 'ironvein', 'cartographers', 'wildfire', 'gilt'];
const seeds = Array.from({ length: 40 }, (_, i) => `design-${i}`);

describe('six original Evil Teams', () => {
  it('exist as full teams, Story Run only', () => {
    const own = content.evilTeams.teams.filter((t) => t.storyOnly).map((t) => t.id);
    expect(own).toEqual(ORIGINAL);
  });

  it('Classic never draws them, and its draw is the same as before they were added', () => {
    const classicTeams = content.evilTeams.teams.filter((t) => !t.storyOnly);
    for (const seed of seeds) {
      const run = classic(seed);
      const expected = classicTeams[new Rng(hashSeed(`${run.seed}::evil-team`)).int(0, classicTeams.length - 1)]!.id;
      expect(plannedEvilTeamId(content, run)).toBe(expected);
    }
  });

  it('Story Runs draw only original teams, the same one for the same seed, and every team turns up', () => {
    const seen = new Set<string>();
    for (const seed of seeds) {
      const run = story(seed);
      const id = plannedEvilTeamId(content, run)!;
      expect(ORIGINAL).toContain(id);
      expect(plannedEvilTeamId(content, story(seed))).toBe(id);
      seen.add(id);
    }
    expect(seen.size).toBe(ORIGINAL.length);
  });

  it('a Story Run takes its team into the world when the evil story starts', () => {
    const run = story('design-team');
    while (!evilOf(run).teamId && evilOf(run).stages < 10) evilStageStart(content, run);
    expect(ORIGINAL).toContain(evilOf(run).teamId);
    // Its storyline events exist (expanded from the shared templates).
    expect([...content.events.keys()].some((id) => id.startsWith(`evil-${evilOf(run).teamId}-`))).toBe(true);
  });
});

const STORY_EVENTS = () => [...content.events.values()].filter((e) => e.id.startsWith('story-alpha-') || e.id === 'story-tour-registration');

describe('Alphas and the Exhibition Bracket', () => {
  it('ten Alphas, each with the five outcomes', () => {
    const alphas = [...content.events.values()].filter((e) => e.id.startsWith('story-alpha-'));
    expect(alphas).toHaveLength(10);
    for (const a of alphas) {
      const flags = JSON.stringify(a.choices);
      for (const o of ['subdued', 'befriended', 'relocated', 'left']) expect(flags, a.id).toContain(`-${o}"`);
      const fight = a.choices[0]!.success.battle!;
      expect(fight.kind).toBe('wild');
      expect(fight.pseudo, `${a.id}: a loss never ends the run`).toBe(true);
    }
  });

  it('are never eligible in Classic, and are in a Story Run', () => {
    const c = classic('design-elig');
    c.regionIndex = 3;
    const ids = new Set(eligibleEvents(content, c).map((e) => e.id));
    for (const e of STORY_EVENTS()) expect(ids.has(e.id), e.id).toBe(false);
    const s = story('design-elig');
    const sid = new Set(eligibleEvents(content, s).map((e) => e.id));
    // Stage 1: only the early Alphas' minStage would gate; the gate itself is the Story Run check.
    for (const e of STORY_EVENTS().filter((x) => x.minStage <= 1)) expect(sid.has(e.id), e.id).toBe(true);
  });

  it('the bracket chains registration, round of eight, semifinal and final; every fight is friendly', () => {
    const reg = content.events.get('story-tour-registration')!;
    expect(reg.choices[0]!.success.effects).toContainEqual({ kind: 'addEvent', eventId: 'story-tour-opening' });
    for (const [id, next] of [['story-tour-opening', 'story-tour-semi'], ['story-tour-semi', 'story-tour-final']] as const) {
      const b = content.events.get(id)!.choices[0]!.success.battle!;
      expect(b.pseudo).toBe(true);
      expect(b.win).toContainEqual({ kind: 'addEvent', eventId: next });
      expect(content.events.get(next)!.room).toBe(true);
    }
    const final = content.events.get('story-tour-final')!.choices[0]!.success.battle!;
    expect(final.kind === 'trainer' && final.rival).toBe(true);
    expect(final.pseudo).toBe(true);
  });

  it('entering the bracket sets the entry flag in a Story Run', () => {
    const run = story('design-tour');
    const node = run.stage!.map.nodes[0]!;
    run.stage!.current = node.id;
    run.stage!.visited = [node.id];
    node.sides.push({ id: 'test-event', kind: 'event', used: false, eventId: 'story-tour-registration' });
    const after = chooseEvent(content, run, 'test-event', 0);
    expect(after.run.story.flags['ev:story-tour-entered']).toBe(1);
  });
});
