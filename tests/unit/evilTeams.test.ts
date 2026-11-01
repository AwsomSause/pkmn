// Evil Teams (spec §16) and Permanent Run Choices (spec §17).
import { describe, expect, it } from 'vitest';
import { chooseEvent, conditionMet, eligibleEvents } from '../../src/core/events';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { evilBattle, evilOf, evilStageStart, evilSummary, evilTeam, villainLine } from '../../src/core/evil/teams';
import { choiceHistory, choiceMade, recordChoice } from '../../src/core/evil/choices';
import { evilEventId } from '../../src/core/evil/content';
import { freshEvil } from '../../src/core/evil/schema';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { content } from './helpers';

function newRun(seed = 'evil'): RunState {
  return chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId: 'red' }), 0);
}

/** Stands the run on the first node with this event beside it. */
function atEvent(run: RunState, eventId: string, sideId = 'test-event'): RunState {
  const node = run.stage!.map.nodes[0]!;
  run.stage!.current = node.id;
  run.stage!.visited = [node.id];
  node.sides.push({ id: sideId, kind: 'event', used: false, eventId });
  return run;
}

/** A run whose team has been picked (as if `firstStage` stages had begun). */
function withTeam(seed = 'evil'): RunState {
  const run = newRun(seed);
  while (!evilOf(run).teamId) evilStageStart(content, run);
  return run;
}

const pickChoice = (run: RunState, eventId: string, label: string) => {
  const ev = content.events.get(eventId)!;
  const index = ev.choices.findIndex((c) => c.label === label);
  expect(index, `${eventId}: ${label}`).toBeGreaterThanOrEqual(0);
  return chooseEvent(content, atEvent(run, eventId), 'test-event', index);
};

describe('evil team data', () => {
  it('has at least ten distinct teams with a full hierarchy, rule, spoils and operations', () => {
    const teams = content.evilTeams.teams;
    expect(teams.length).toBeGreaterThanOrEqual(10);
    expect(new Set(teams.map((t) => t.style))).toEqual(new Set(['open', 'secret', 'front']));
    for (const t of teams) {
      for (const rank of ['grunt', 'specialist', 'executive', 'leader'] as const) expect(t.ranks[rank].species.length, `${t.id} ${rank}`).toBeGreaterThanOrEqual(4);
      expect(t.ops.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('expands every storyline beat and operation into a map event for every team', () => {
    for (const t of content.evilTeams.teams) {
      for (const id of ['suspicious', 'evidence', 'recognized', 'rising-star', 'nemesis', 'the-plan', 'hideout', 'ambush', 'legend']) expect(content.events.has(evilEventId(t.id, id)), `${t.id} ${id}`).toBe(true);
      for (const op of t.ops) expect(content.events.has(evilEventId(t.id, 'op', op.id)), `${t.id} ${op.id}`).toBe(true);
      expect(content.events.has(evilEventId(t.id, 'disguise'))).toBe(t.style !== 'open');
      const intro = content.events.get(evilEventId(t.id, 'rising-star'))!.intro;
      expect(intro).toContain(t.ranks.executive.name);
      expect(intro).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('evil team progression', () => {
  it('picks the same team for the same seed, and none before the first beat stage', () => {
    const run = newRun('pick');
    expect(evilOf(run).stages).toBeLessThan(content.evilTeams.config.firstStage);
    expect(evilOf(run).teamId).toBeNull();
    expect(withTeam('pick').story.evil.teamId).toBe(withTeam('pick').story.evil.teamId);
  });

  it('starts one operation per region, and an operation left behind succeeds with its lasting downside', () => {
    const run = withTeam('ops');
    const s = evilOf(run);
    expect(s.ops).toHaveLength(1);
    expect(s.ops[0]!.outcome).toBe('running');
    const before = run.perkEffects?.length ?? 0;
    evilStageStart(content, run);
    expect(s.ops).toHaveLength(1);
    run.regionIndex += 1;
    evilStageStart(content, run);
    expect(s.ops[0]!.outcome).toBe('succeeded');
    expect(s.ops).toHaveLength(2);
    expect((run.perkEffects?.length ?? 0)).toBeGreaterThan(before);
    expect(choiceHistory(run).some((c) => c.pick === 'succeeded')).toBe(true);
  });

  it('opens the first beat only for the run team, and moves the story one beat per choice, paced by stages', () => {
    const run = withTeam('beats');
    const team = evilTeam(content, run)!;
    const open = eligibleEvents(content, run).map((e) => e.id);
    expect(open).toContain(evilEventId(team.id, 'suspicious'));
    expect(open.filter((id) => id.startsWith('evil-') && id.endsWith('-suspicious'))).toHaveLength(1);
    const after = pickChoice(run, evilEventId(team.id, 'suspicious'), 'Walk on').run;
    expect(after.story.evil.beat).toBe(1);
    // The next beat waits for `beatEvery` more stages.
    expect(eligibleEvents(content, after).map((e) => e.id)).not.toContain(evilEventId(team.id, 'evidence'));
    for (let i = 0; i < content.evilTeams.config.beatEvery; i++) evilStageStart(content, after);
    expect(eligibleEvents(content, after).map((e) => e.id)).toContain(evilEventId(team.id, 'evidence'));
  });

  it('stopping an operation adds its upside for good, once, and records the choice', () => {
    const run = withTeam('foil');
    const team = evilTeam(content, run)!;
    const op = evilOf(run).ops[0]!;
    const res = pickChoice(run, evilEventId(team.id, 'op', op.id), 'Sneak in disguised');
    const r = res.run;
    const def = team.ops.find((o) => o.id === op.id)!;
    const effects = content.evilTeams.consequences[def.kind];
    if (res.success) {
      expect(r.story.evil.ops[0]!.outcome).toBe('infiltrated');
      expect(r.perkEffects).toEqual(expect.arrayContaining(effects.stopped.effects));
      expect(res.changes.join(' ')).toContain(effects.stopped.text);
    } else {
      expect(r.phase).toBe('battle');
    }
  });

  it('letting an operation through applies its downside', () => {
    const run = withTeam('leave');
    const team = evilTeam(content, run)!;
    const op = evilOf(run).ops[0]!;
    const r = pickChoice(run, evilEventId(team.id, 'op', op.id), 'Leave it alone').run;
    const def = team.ops.find((o) => o.id === op.id)!;
    expect(r.story.evil.ops[0]!.outcome).toBe('succeeded');
    expect(r.perkEffects).toEqual(expect.arrayContaining(content.evilTeams.consequences[def.kind].through.effects));
  });

  it('recurring villains remember meetings: their teams grow and their lines change', () => {
    const run = withTeam('villain');
    const team = evilTeam(content, run)!;
    const b = { kind: 'trainer', name: 'x', evil: 'executive', size: 3, levelBonus: 2, shadow: 0, types: [], chain: 1, win: [], ghost: false, retired: false, rival: false } as const;
    expect(villainLine(team, 'executive', undefined)).toBe(team.ranks.executive.lines.first);
    const first = evilBattle(content, run, { ...b, types: [], win: [] })!;
    expect(villainLine(team, 'executive', evilOf(run).villains.executive)).toBe(team.ranks.executive.lines.winning);
    const second = evilBattle(content, run, { ...b, types: [], win: [] })!;
    expect(second.levelBonus).toBeGreaterThan(first.levelBonus);
    expect(second.size).toBeGreaterThanOrEqual(first.size);
    expect(first.name).toBe(team.ranks.executive.name);
    evilOf(run).villains.executive = { met: 3, won: 2, lost: 1, last: 'won' };
    expect(villainLine(team, 'executive', evilOf(run).villains.executive)).toBe(team.ranks.executive.lines.respect);
  });

  it('heat adds levels and reinforcements', () => {
    const run = withTeam('heat');
    const b = { kind: 'trainer', name: 'x', evil: 'grunt', size: 2, levelBonus: 0, shadow: 0, types: [], chain: 1, win: [], ghost: false, retired: false, rival: false } as const;
    const calm = evilBattle(content, run, { ...b, types: [], win: [] })!;
    evilOf(run).heat = content.evilTeams.config.heatMax;
    const hot = evilBattle(content, run, { ...b, types: [], win: [] })!;
    expect(hot.levelBonus).toBeGreaterThan(calm.levelBonus);
    expect(hot.size).toBe(Math.min(6, calm.size + 1));
  });

  it('the hideout can end the story without a battle when you kept evidence and stopped an operation', () => {
    const run = withTeam('expose');
    const team = evilTeam(content, run)!;
    const s = evilOf(run);
    s.beat = 6;
    s.ops[0]!.outcome = 'foiled';
    const hideout = content.events.get(evilEventId(team.id, 'hideout'))!;
    const expose = hideout.choices.findIndex((c) => c.label.startsWith('Expose'));
    expect(() => chooseEvent(content, atEvent(structuredClone(run), hideout.id), 'test-event', expose)).toThrow();
    recordChoice(content, run, { id: `${team.id}-evidence`, pick: 'kept', text: 'kept', weight: 2 });
    const r = chooseEvent(content, atEvent(run, hideout.id), 'test-event', expose).run;
    expect(r.story.evil.end).toBe('exposed');
    expect(r.story.evil.beat).toBe(7);
    expect(r.phase).not.toBe('battle');
    expect(evilSummary(content, r)!.title).toContain('exposed');
    // The Legendary they hunted stirs once they are gone.
    expect(eligibleEvents(content, r).map((e) => e.id)).toContain(evilEventId(team.id, 'legend'));
  });
});

describe('rescue missions and infighting', () => {
  it('a holding pen opens mid-story; freeing them lets a Pokémon join and is remembered', () => {
    const run = withTeam('rescue');
    const team = evilTeam(content, run)!;
    const id = evilEventId(team.id, 'rescue');
    const opens = () => content.events.get(id)!.requires.every((c) => conditionMet(content, run, c));
    expect(opens()).toBe(false);
    evilOf(run).beat = 3;
    expect(opens()).toBe(true);
    const r = pickChoice(run, id, 'Walk away').run;
    expect(choiceMade(r, `${team.id}-rescue`, 'left')).toBe(true);
  });

  it('siding with the specialist in a team feud wins an inside source (a defector for the hideout)', () => {
    const run = withTeam('feud');
    const team = evilTeam(content, run)!;
    evilOf(run).beat = 4;
    const r = pickChoice(run, evilEventId(team.id, 'infighting'), `Side with the ${team.ranks.specialist.name}`).run;
    expect(r.story.evil.defector).toBe(true);
    const hideout = content.events.get(evilEventId(team.id, 'hideout'))!;
    const back = hideout.choices.find((c) => c.label.startsWith('Let the defector'))!;
    expect(back.requires.every((c) => conditionMet(content, r, c))).toBe(true);
  });
});

describe('permanent choices', () => {
  it('keeps the first answer, and opens or closes follow-ups', () => {
    const run = newRun('choices');
    run.money = 5000;
    const r = pickChoice(run, 'stranded-trainer', 'Take their Poké Balls').run;
    expect(choiceMade(r, 'stranded-trainer', 'robbed')).toBe(true);
    const opens = (id: string) => content.events.get(id)!.requires.every((c) => conditionMet(content, r, c));
    expect(opens('stranded-trainer-revenge')).toBe(true);
    expect(opens('stranded-trainer-friend')).toBe(false);
    expect(recordChoice(content, r, { id: 'stranded-trainer', pick: 'helped', text: 'x', weight: 1 })).toBe('');
    expect(choiceMade(r, 'stranded-trainer', 'helped')).toBe(false);
  });

  it('a path choice changes the rest of the run (its modifiers stay) and is run-defining', () => {
    const r = pickChoice(newRun('fork'), 'road-fork', 'The mountain pass').run;
    expect(r.perkEffects).toEqual(expect.arrayContaining([{ kind: 'enemyLevelOffset', value: 1 }]));
    expect(choiceHistory(r)[0]).toMatchObject({ id: 'road-fork', pick: 'mountain', weight: 3 });
  });

  it('a rescued Pokémon can come back to join later', () => {
    const run = newRun('riolu');
    recordChoice(content, run, { id: 'ledge-riolu', pick: 'rescued', text: 'x', weight: 2 });
    const r = pickChoice(run, 'ledge-riolu-return', 'Welcome it to the team');
    expect(r.changes.join(' ')).toMatch(/wants to join you/);
  });
});

describe('run save v32', () => {
  it('a version 31 run loads with no Evil Team and no choice history', () => {
    const storage = new MemoryStorageProvider();
    const run = structuredClone(newRun('v28'));
    const { evil: _e, choices: _c, ...story } = run.story;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 31, savedAt: '', data: { ...run, story } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(31);
    expect(loaded.data.story.evil).toEqual(freshEvil());
    expect(loaded.data.story.choices).toEqual([]);
  });

  it('a version 27 run (before the day counter) also loads through both upgrades', () => {
    const storage = new MemoryStorageProvider();
    const run = structuredClone(newRun('v27'));
    const { evil: _e, choices: _c, ...story } = run.story;
    const { clock: _k, ...old } = run;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 27, savedAt: '', data: { ...old, story } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(27);
    expect(loaded.data.story.evil).toEqual(freshEvil());
  });

  it('a version 28 run (before Auto-Battle) loads too', () => {
    const storage = new MemoryStorageProvider();
    const run = structuredClone(newRun('v28'));
    const { evil: _e, choices: _c, ...story } = run.story;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 28, savedAt: '', data: { ...run, story } }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') expect(loaded.data.story.choices).toEqual([]);
  });

  it('version 9 settings (before Auto-Battle) still load', () => {
    const storage = new MemoryStorageProvider();
    const manager = new SaveManager(storage, content);
    manager.saveSettings(manager.loadSettings());
    const env = JSON.parse(storage.get('pkr.settings')!);
    const { autoBattle: _a, autoExplain: _x, ...old } = env.data;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 9, savedAt: '', data: old }));
    const settings = new SaveManager(storage, content).loadSettings() as unknown as { autoBattle: boolean };
    expect(settings.autoBattle).toBe(false);
  });

  it('Evil Team progress and choices survive a save and reload unchanged', () => {
    const storage = new MemoryStorageProvider();
    const manager = new SaveManager(storage, content);
    const run = withTeam('reload');
    recordChoice(content, run, { id: 'road-fork', pick: 'coast', text: 'Took the coast road', weight: 3 });
    evilOf(run).heat = 4;
    manager.saveRun(run);
    const loaded = manager.loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.data.story.evil).toEqual(run.story.evil);
    expect(loaded.data.story.choices).toEqual(run.story.choices);
  });
});
