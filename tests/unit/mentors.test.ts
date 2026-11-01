// Mentors and apprentices (spec section 15): data, trust and loyalty, lessons, events, the fellow apprentice and the lasting bond.

import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { createProfile } from '../../src/core/profile';
import { applyRunToProfile } from '../../src/core/progress';
import { chooseStarter, createRun, takeTurn, type TurnResult } from '../../src/core/run';
import { applyEffect, chooseEvent, conditionMet, eligibleEvents, eventBattleWon, isApprenticeBattle } from '../../src/core/events';
import { Rng, hashSeed } from '../../src/core/rng';
import {
  MENTORS,
  MENTOR_CATEGORIES,
  availableMentors,
  bondOf,
  changeMentor,
  getMentor,
  isProdigy,
  makeFellow,
  mentorBadgeWon,
  mentorHudLine,
  mentorEnding,
  mentorProblems,
  mentorStopEvent,
  settleMentor,
  startMentorship,
} from '../../src/core/mentors';
import { defaultPrep } from '../../src/core/runPrep';
import { ProfileSchema, RunStateSchema } from '../../src/core/state';
import { MIGRATIONS } from '../../src/save/saveManager';
import { content } from './helpers';

const prepWith = (mentorId: string | null) => ({ ...defaultPrep(content), mentorId });
const start = (seed: string, mentorId: string | null = 'ravi-ironhand', bonds: Record<string, ReturnType<typeof bondOf>> = {}) =>
  structuredClone(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red', prep: prepWith(mentorId), mentorBonds: bonds }), 0));

describe('mentor data', () => {
  it('has twelve mentors, one for every category, with no content problems', () => {
    expect(MENTORS).toHaveLength(12);
    expect(new Set(MENTORS.map((m) => m.category))).toEqual(new Set(MENTOR_CATEGORIES));
    expect(mentorProblems(content)).toEqual([]);
  });

  it('every mentor has four lessons, a mission and a graduation; some give no combat bonus', () => {
    for (const m of MENTORS) {
      expect(m.lessons.length).toBeGreaterThanOrEqual(4);
      expect(m.mission.bosses).toBeGreaterThan(0);
      expect(m.graduation.title.length).toBeGreaterThan(0);
    }
    const noCombat = MENTORS.filter((m) => m.lessons.every((l) => l.effects.every((e) => !['damageMultiplier', 'typeDamageMultiplier', 'bossDamageMultiplier', 'critChanceMultiplier', 'statMultiplier'].includes(e.kind))));
    expect(noCombat.length).toBeGreaterThanOrEqual(3);
  });

  it('four mentors are open from the start; the rest unlock through runs, wins or trust', () => {
    const profile = createProfile(content, 'p');
    expect(availableMentors(profile).map((m) => m.id)).toHaveLength(4);
    profile.counters.runsFinished = 4;
    profile.counters.runsWon = 2;
    expect(availableMentors(profile).length).toBeGreaterThan(8);
    expect(availableMentors(profile).some((m) => m.id === 'dax-corvane')).toBe(false);
    profile.mentorBonds['ravi-ironhand'] = { ...bondOf(profile, 'ravi-ironhand'), trust: 30 };
    expect(availableMentors(profile).some((m) => m.id === 'dax-corvane')).toBe(true);
  });
});

describe('a mentorship in a run', () => {
  it('no mentor means no mentorship, and the run shape stays null', () => {
    expect(start('m-none', null).mentor).toBeNull();
  });

  it('the first lesson applies at the start, once, and the fellow apprentice is the same for the same seed', () => {
    const a = start('m-start');
    const b = start('m-start');
    expect(a.mentor!.lessons).toEqual(['ravi-footwork']);
    expect(a.perkEffects.filter((e) => e.kind === 'critChanceMultiplier')).toHaveLength(1);
    expect(a.mentor!.fellow).toEqual(b.mentor!.fellow);
    expect(makeFellow('m-start', getMentor('ravi-ironhand')!, bondOf({ mentorBonds: {} }, 'x'))).toEqual(a.mentor!.fellow);
  });

  it('trust unlocks lessons in order, each exactly once, and the tier follows', () => {
    const run = start('m-trust');
    changeMentor(content, run, { trust: 30 });
    expect(run.mentor!.lessons).toContain('ravi-finisher');
    expect(run.mentor!.tier).toBe('student');
    const before = run.perkEffects.length;
    changeMentor(content, run, { trust: 0 });
    changeMentor(content, run, { trust: 1 });
    expect(run.perkEffects.length).toBe(before);
    changeMentor(content, run, { trust: 40 });
    expect(run.mentor!.lessons).toContain('ravi-captain');
    expect(run.mentor!.tier).toBe('protege');
  });

  it('trust and loyalty are clamped; advanced lessons need an earlier graduation', () => {
    const run = start('m-clamp');
    changeMentor(content, run, { trust: 999, loyalty: -999 });
    expect(run.mentor!.trust).toBe(100);
    expect(run.mentor!.loyalty).toBe(0);
    expect(run.mentor!.lessons).not.toContain('ravi-veteran');
    const bond = { ...bondOf({ mentorBonds: {} }, 'ravi-ironhand'), graduated: 1 };
    expect(start('m-adv', 'ravi-ironhand', { 'ravi-ironhand': bond }).mentor!.lessons).toContain('ravi-veteran');
  });

  it('lasting trust carries over at half, capped', () => {
    const bond = { ...bondOf({ mentorBonds: {} }, 'ravi-ironhand'), trust: 90 };
    expect(startMentorship('x', 'ravi-ironhand', bond)!.trust).toBe(30);
    expect(startMentorship('x', 'ravi-ironhand', { ...bond, trust: 20 })!.trust).toBe(10);
  });

  it('a gym badge raises trust and loyalty and grows the fellow apprentice; a mission finishes after its badges', () => {
    const run = start('m-badge');
    const t0 = run.mentor!.trust;
    const p0 = run.mentor!.fellow.progress;
    applyEffect(content, run, { kind: 'mentor', trust: 0, loyalty: 0, rivalry: 0, mission: 'start', disagree: false }, new Rng(hashSeed('x')));
    expect(run.mentor!.mission).toEqual({ state: 'active', bossesLeft: 2 });
    mentorBadgeWon(content, run);
    expect(run.mentor!.trust).toBe(t0 + 6);
    expect(run.mentor!.fellow.progress).toBeGreaterThan(p0);
    expect(run.mentor!.mission.bossesLeft).toBe(1);
    const potions = run.inventory['x-speed'] ?? 0;
    mentorBadgeWon(content, run);
    expect(run.mentor!.mission.state).toBe('done');
    expect(run.inventory['x-speed']).toBe(potions + 2);
    // a second mission offer is refused once taken
    applyEffect(content, run, { kind: 'mentor', trust: 0, loyalty: 0, rivalry: 0, mission: 'start', disagree: false }, new Rng(hashSeed('x')));
    expect(run.mentor!.mission.state).toBe('done');
  });
});

describe('mentor events', () => {
  it('only appear with a mentor, and the mentor-specific one only for that mentor', () => {
    const none = start('e-none', null);
    expect(eligibleEvents(content, none).some((e) => e.group === 'Mentors')).toBe(false);
    const run = start('e-ravi');
    const ids = eligibleEvents(content, run).filter((e) => e.group === 'Mentors').map((e) => e.id);
    expect(ids).toContain('mentor-ravi-ironhand-lesson');
    expect(ids).not.toContain('mentor-marigold-hatch-lesson');
    expect(ids).toContain('mentor-training-session');
    expect(ids).not.toContain('mentor-graduation-trial');
  });

  it('every stage offers exactly one mentor event, picked from a stream of its own', () => {
    const run = start('e-stop');
    run.stage = { index: 0 } as never;
    const open = new Set(eligibleEvents(content, run).map((e) => e.id));
    const a = mentorStopEvent(content, run, open);
    expect(a).not.toBeNull();
    expect(mentorStopEvent(content, run, open)).toBe(a);
    expect(mentorStopEvent(content, start('e-none2', null), open)).toBeNull();
  });

  it('conditions read trust, loyalty, lesson and mission', () => {
    const run = start('e-cond');
    expect(conditionMet(content, run, { kind: 'mentor', trustAtLeast: 20 })).toBe(false);
    changeMentor(content, run, { trust: 25 });
    expect(conditionMet(content, run, { kind: 'mentor', trustAtLeast: 20 })).toBe(true);
    expect(conditionMet(content, run, { kind: 'mentor', lesson: 'ravi-finisher' })).toBe(true);
    expect(conditionMet(content, run, { kind: 'mentor', mission: 'none' })).toBe(true);
    expect(conditionMet(content, run, { kind: 'mentor', id: 'marigold-hatch' })).toBe(false);
  });
});

describe('the lasting bond', () => {
  it('graduation needs trust; loyalty decides devoted or independent; the fellow apprentice is remembered', () => {
    const run = start('b-grad');
    expect(mentorEnding(run)).toBeNull();
    changeMentor(content, run, { trust: 70, loyalty: 40 });
    expect(mentorEnding(run)).toBe('devoted');
    run.mentor!.loyalty = 10;
    expect(mentorEnding(run)).toBe('independent');
    const profile = createProfile(content, 'p');
    const lines = settleMentor(profile, run);
    const bond = bondOf(profile, 'ravi-ironhand');
    expect(lines.length).toBe(2);
    expect(bond).toMatchObject({ runs: 1, graduated: 1, devoted: 0 });
    expect(bond.apprentices).toHaveLength(1);
    expect(bond.lessons).toContain('ravi-finisher');
    expect(bond.trust).toBe(run.mentor!.trust);
  });

  it('a graduate\'s fellow apprentice can come back as a veteran, one potential higher', () => {
    const run = start('b-vet');
    changeMentor(content, run, { trust: 70, loyalty: 40 });
    const profile = createProfile(content, 'p');
    settleMentor(profile, run);
    const bond = bondOf(profile, 'ravi-ironhand');
    let veteran = false;
    for (let i = 0; i < 20 && !veteran; i++) {
      const f = makeFellow(`vet-${i}`, getMentor('ravi-ironhand')!, bond);
      if (f.veteran) {
        veteran = true;
        expect(f.name).toBe(bond.apprentices[0]!.name);
        expect(f.potential).toBe(Math.min(5, bond.apprentices[0]!.potential + 1));
      }
    }
    expect(veteran).toBe(true);
  });

  it('applyRunToProfile writes the bond for a counting run and none without a mentor', () => {
    const profile = createProfile(content, 'p');
    const run = start('b-end');
    run.victory = true;
    changeMentor(content, run, { trust: 65, loyalty: 60 });
    const summary = applyRunToProfile(content, profile, run, '2026-11-01T00:00:00Z');
    expect(summary.mentorLines?.length).toBe(2);
    expect(bondOf(profile, 'ravi-ironhand').devoted).toBe(1);
    const plain = createProfile(content, 'q');
    const run2 = start('b-end2', null);
    run2.victory = true;
    expect(applyRunToProfile(content, plain, run2, '2026-11-01T00:00:00Z').mentorLines).toEqual([]);
    expect(plain.mentorBonds).toEqual({});
  });
});

describe('saves', () => {
  it('a mentorship survives a save and reload (schema round trip), and old saves migrate', () => {
    const run = start('s-round');
    changeMentor(content, run, { trust: 30, loyalty: 5, rivalry: 2 });
    const back = RunStateSchema.parse(JSON.parse(JSON.stringify(run)));
    expect(back.mentor).toEqual(run.mentor);
    expect(back.prep.mentorId).toBe('ravi-ironhand');
    const profile = createProfile(content, 'p');
    settleMentor(profile, run);
    expect(ProfileSchema.parse(JSON.parse(JSON.stringify(profile))).mentorBonds).toEqual(profile.mentorBonds);
    const old = { ...JSON.parse(JSON.stringify(run)), mentor: undefined, prep: { ...run.prep, mentorId: undefined } };
    const migrated = MIGRATIONS.run[32]!(old) as { mentor: unknown; prep: { mentorId: unknown } };
    expect(migrated.mentor).toBeNull();
    expect(migrated.prep.mentorId).toBeNull();
    expect((MIGRATIONS.profile[14]!({ profileId: 'x' }) as { mentorBonds: unknown }).mentorBonds).toEqual({});
  });
});

describe('the fellow apprentice as a real battle', () => {
  const atEvent = (run: ReturnType<typeof start>, eventId: string) => {
    const node = run.stage!.map.nodes[0]!;
    run.stage!.current = node.id;
    run.stage!.visited = [node.id];
    node.sides.push({ id: 'test-event', kind: 'event', used: false, eventId });
    return run;
  };
  const duel = (seed: string) => {
    const run = start(seed);
    const index = content.events.get('mentor-fellow-duel')!.choices.findIndex((c) => c.label === 'Spar for real');
    return { run, result: chooseEvent(content, atEvent(run, 'mentor-fellow-duel'), 'test-event', index) };
  };

  it('sparring starts a trainer battle with the fellow apprentice, named and leaning on their types', () => {
    const { run, result } = duel('f-battle');
    const b = result.run.battle!;
    expect(b.kind).toBe('trainer');
    expect(b.trainer!.name).toBe(run.mentor!.fellow.name);
    expect(b.enemyTeam).toHaveLength(2);
    expect(isApprenticeBattle(content, b.event!)).toBe(true);
    const types = new Set(b.enemyTeam.flatMap((m) => content.species.get(m.speciesId)!.types));
    expect(run.mentor!.fellow.types.some((t) => types.has(t))).toBe(true);
  });

  it('winning raises trust and rivalry; losing is friendly: the party is healed, the run goes on, the apprentice pulls ahead', () => {
    const won = duel('f-win');
    const t0 = won.run.mentor!.trust;
    const r0 = won.run.mentor!.rivalry;
    eventBattleWon(content, won.result.run, won.result.run.battle!.event!);
    expect(won.result.run.mentor!.trust).toBe(t0 + 2);
    expect(won.result.run.mentor!.rivalry).toBe(r0 + 2);

    const lost = duel('f-lose');
    const run = lost.result.run;
    run.party[0]!.hp = 1;
    for (const m of run.battle!.enemyTeam) m.level = 100;
    let turn: TurnResult | null = null;
    let cur = run;
    for (let i = 0; i < 80 && cur.phase === 'battle'; i++) {
      turn = takeTurn(content, cur, { kind: 'move', index: 0 });
      cur = turn.run;
    }
    expect(turn?.clubLost).toBe(true);
    expect(turn?.defeated).toBe(false);
    expect(cur.phase).toBe('map');
    expect(cur.battle).toBeNull();
    expect(cur.party.every((m) => m.hp > 0)).toBe(true);
    expect(cur.mentor!.rivalry).toBe(-2);
  });

  it('there is a bigger showdown later, gated by trust and stage', () => {
    const ev = content.events.get('mentor-apprentice-showdown')!;
    expect(ev.minStage).toBe(4);
    expect(ev.choices[0]!.success.battle).toMatchObject({ kind: 'trainer', apprentice: true, size: 3 });
  });
});

describe('map HUD line', () => {
  it('is null without a mentor and names mentor, tier, trust, loyalty, rival and mission with one', () => {
    expect(mentorHudLine(start('h-none', null))).toBeNull();
    const run = start('h-line');
    const line = mentorHudLine(run)!;
    expect(line).toContain('Mentor Ravi');
    expect(line).toContain('Newcomer');
    expect(line).toContain(run.mentor!.fellow.name);
    expect(line).not.toContain('Mission');
    applyEffect(content, run, { kind: 'mentor', trust: 0, loyalty: 0, rivalry: 0, mission: 'start', disagree: false }, new Rng(hashSeed('x')));
    changeMentor(content, run, { rivalry: 2 });
    expect(mentorHudLine(run)).toContain('+2');
    expect(mentorHudLine(run)).toContain('Mission 2');
  });
});

describe('the rest of section 15', () => {
  it('a lesson can teach a move: the first healthy Pokémon that can learn it gets it as a pending lesson', () => {
    const run = start('g-move');
    run.party[0] = createPokemon(content, 'machamp', 40, run.party[0]!.uid);
    run.party[0]!.moves = run.party[0]!.moves.filter((m) => m.id !== 'close-combat');
    changeMentor(content, run, { trust: 60 });
    expect(run.mentor!.lessons).toContain('ravi-captain');
    expect(run.pending.filter((p) => p.kind === 'learnMove' && p.moveId === 'close-combat')).toHaveLength(1);
    changeMentor(content, run, { trust: 5 });
    expect(run.pending.filter((p) => p.kind === 'learnMove' && p.moveId === 'close-combat')).toHaveLength(1);
  });

  it('every mentor has a personal storyline and a recommendation event, and the moves they teach are supported', () => {
    for (const m of MENTORS) {
      expect(content.events.has(`mentor-${m.id}-story`), m.id).toBe(true);
      expect(content.events.has(`mentor-${m.id}-recruit`), m.id).toBe(true);
      expect(m.lessons.some((l) => l.teachMove), m.id).toBe(true);
    }
    expect(mentorProblems(content)).toEqual([]);
  });

  it('a recommendation brings a new teammate', () => {
    const run = start('g-recruit');
    changeMentor(content, run, { trust: 30 });
    const node = run.stage!.map.nodes[0]!;
    run.stage!.current = node.id;
    run.stage!.visited = [node.id];
    node.sides.push({ id: 'test-event', kind: 'event', used: false, eventId: 'mentor-ravi-ironhand-recruit' });
    const after = chooseEvent(content, run, 'test-event', 0).run;
    expect(after.pending.some((d) => d.kind === 'caught')).toBe(true);
  });

  it('a graduate comes back as a veteran, and the veteran event waits for one; a prodigy needs two graduations', () => {
    const bond = { ...bondOf({ mentorBonds: {} }, 'ravi-ironhand'), graduated: 2, apprentices: [makeFellow('seed-a', getMentor('ravi-ironhand')!, bondOf({ mentorBonds: {} }, 'x'))] };
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const f = makeFellow(`kind-${i}`, getMentor('ravi-ironhand')!, bond);
      kinds.add(f.veteran ? 'veteran' : isProdigy(f) ? 'prodigy' : 'plain');
    }
    expect(kinds).toEqual(new Set(['veteran', 'prodigy', 'plain']));
    const fresh = bondOf({ mentorBonds: {} }, 'ravi-ironhand');
    for (let i = 0; i < 40; i++) expect(makeFellow(`kind-${i}`, getMentor('ravi-ironhand')!, { ...fresh, graduated: 1 }).potential).toBeLessThanOrEqual(5);
    const run = start('g-vet');
    expect(conditionMet(content, run, { kind: 'mentor', fellow: 'veteran' })).toBe(false);
    run.mentor!.fellow = { ...run.mentor!.fellow, veteran: true };
    expect(conditionMet(content, run, { kind: 'mentor', fellow: 'veteran' })).toBe(true);
    run.mentor!.fellow = { ...run.mentor!.fellow, veteran: false, potential: 5 };
    expect(conditionMet(content, run, { kind: 'mentor', fellow: 'prodigy' })).toBe(true);
  });
});
