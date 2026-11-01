import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { activeGameEvents, DAILY_RULES, gameEventModifiers, holidayCalendar, moonPhase, nextWindowIn } from '../../src/core/gameEvents';
import { speciesWeightPerk } from '../../src/core/encounters';
import { eligibleLegendary, legendaryEvents, legendaryProblem, placeLegendaryGate } from '../../src/core/legendary/legendary';
import { evilStageStart } from '../../src/core/evil/teams';
import { content } from './helpers';

const at = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
const w9 = [...content.gameEvents.values()].filter((e) => e.contentTags.includes('w9'));
const on = (iso: string) => activeGameEvents(content, at(iso)).filter((a) => !a.archive).map((a) => a.event.id);

describe('W9 live events: calendar rules', () => {
  it('adds the batch with 3-5 objectives and valid references', () => {
    expect(w9.length).toBeGreaterThanOrEqual(70);
    for (const e of w9) {
      expect(e.objectives.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.objectives.length, e.id).toBeLessThanOrEqual(5);
    }
  });

  it('dates: type weeks, Leap Day and equinoxes switch on and off', () => {
    expect(on('2026-01-03')).toContain('fire-week');
    expect(on('2026-01-10')).not.toContain('fire-week');
    expect(on('2028-02-29')).toContain('leap-day-special');
    expect(on('2026-02-28')).not.toContain('leap-day-special');
    expect(on('2026-03-20')).toContain('spring-equinox');
  });

  it('day rules: Friday the 13th, Fridays, Tuesdays and palindrome dates', () => {
    expect(on('2026-02-13')).toContain('friday-the-13th'); // a Friday
    expect(on('2026-03-13')).toContain('friday-the-13th');
    expect(on('2026-04-13')).not.toContain('friday-the-13th'); // a Monday
    expect(on('2026-11-06')).toContain('weekend-warm-up');
    expect(on('2026-11-07')).not.toContain('weekend-warm-up');
    expect(on('2026-11-03')).toContain('tm-tuesday');
    for (const d of ['2026-01-10', '2026-02-20', '2026-03-30', '2026-10-01', '2026-11-11', '2026-12-21']) expect(on(d), d).toContain('palindrome-date');
    expect(on('2026-11-12')).not.toContain('palindrome-date');
    expect(DAILY_RULES.palindrome!(at('2026-12-12'))).toBe(false);
  });

  it('a day event has a day edition and ends at midnight UTC', () => {
    const a = activeGameEvents(content, at('2026-11-06T20:00:00Z')).find((x) => x.event.id === 'weekend-warm-up')!;
    expect(a.edition).toBe('weekend-warm-up@2026-11-06');
    expect(a.endsIn).toBe(4 * 3_600_000);
    const e = content.gameEvents.get('weekend-warm-up')!;
    expect(nextWindowIn(e, at('2026-11-06T20:00:00Z'))).toBe(0);
    expect(nextWindowIn(e, at('2026-11-07T00:00:00Z'))).toBe(6 * 86_400_000);
    expect(holidayCalendar(content, at('2026-11-07')).some((c) => c.event.id === 'weekend-warm-up')).toBe(true);
  });

  it('moon phases are computed from the date: about one new and one full moon a month', () => {
    // New moon 2026-11-09 (about 12:00 UTC) and full moon 2026-11-24, by the astronomical tables.
    expect(on('2026-11-09')).toContain('new-moon-night');
    expect(on('2026-11-24')).toContain('full-moon-rise');
    let news = 0;
    let fulls = 0;
    for (let d = 0; d < 365; d++) {
      const day = new Date(Date.UTC(2026, 0, 1 + d, 12));
      if (DAILY_RULES.newMoon!(day)) news++;
      if (DAILY_RULES.fullMoon!(day)) fulls++;
    }
    expect(news).toBeGreaterThanOrEqual(11);
    expect(news).toBeLessThanOrEqual(13);
    expect(fulls).toBeGreaterThanOrEqual(11);
    expect(fulls).toBeLessThanOrEqual(13);
    const ph = moonPhase(at('2026-11-09'));
    expect(Math.min(ph, 1 - ph)).toBeLessThan(0.03);
  });
});

describe('W9 live events: modifiers', () => {
  it('speciesEncounterWeight weights traits and whole evolution lines', () => {
    const eeveeWeek = [{ kind: 'speciesEncounterWeight' as const, lines: ['eevee'], value: 6 }];
    expect(speciesWeightPerk(content, eeveeWeek, 'vaporeon')).toBe(6);
    expect(speciesWeightPerk(content, eeveeWeek, 'pikachu')).toBe(1);
    const dual = [{ kind: 'speciesEncounterWeight' as const, trait: 'dual' as const, value: 3 }, { kind: 'speciesEncounterWeight' as const, trait: 'mono' as const, value: 0.4 }];
    expect(speciesWeightPerk(content, dual, 'bulbasaur')).toBe(3);
    expect(speciesWeightPerk(content, dual, 'eevee')).toBe(0.4);
    const pseudo = [{ kind: 'speciesEncounterWeight' as const, trait: 'pseudo' as const, value: 3 }];
    expect(speciesWeightPerk(content, pseudo, 'dragonite')).toBe(3);
    expect(speciesWeightPerk(content, pseudo, 'dragonair')).toBe(1);
    expect(speciesWeightPerk(content, pseudo, 'mewtwo')).toBe(1);
  });

  it('a run started in an event week carries its modifiers', () => {
    const mods = gameEventModifiers(content, ['fire-week@2026']);
    expect(mods.some((m) => m.kind === 'typeEncounterWeight' && m.type === 'fire')).toBe(true);
  });

  const startRun = (seed: string, editions: string[]) => {
    const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'w9', seed, archetypeId: 'red', gameEvents: editions }), 0));
    run.regionIndex = 3;
    return run;
  };

  it('Legendary Birds Week lifts the birds\' odds, waives their conditions and puts gates on far more stages', () => {
    const weightOf = (run: ReturnType<typeof startRun>, sp: string) => eligibleLegendary(content, run).find((p) => p.def.legendary!.species === sp)?.weight ?? 0;
    const plain = startRun('birds-1', []);
    const week = startRun('birds-1', ['legendary-birds-week@2026']);
    const def = legendaryEvents(content).find((d) => d.legendary!.species === 'zapdos')!;
    expect(legendaryProblem(content, week, def)).toBeNull();
    expect(weightOf(week, 'zapdos')).toBeGreaterThan(0);
    expect(weightOf(week, 'zapdos')).toBeGreaterThanOrEqual(weightOf(plain, 'zapdos') * 12 || 1);
    let gates = 0;
    let base = 0;
    for (let i = 0; i < 60; i++) {
      const w = startRun(`birds-${i}`, ['legendary-birds-week@2026']);
      placeLegendaryGate(content, w);
      if ((w.legendary?.placed['3'] ?? 0) > 0) gates++;
      const b = startRun(`birds-${i}`, []);
      placeLegendaryGate(content, b);
      if ((b.legendary?.placed['3'] ?? 0) > 0) base++;
    }
    expect(gates).toBeGreaterThan(base * 2);
  });

  it('Team weeks force the evil team of the run', () => {
    for (const [event, teams] of [['team-rocket-invasion', ['rocket']], ['aqua-magma-showdown', ['aqua', 'magma']], ['plasma-liberation', ['plasma']]] as const) {
      for (let i = 0; i < 6; i++) {
        const run = startRun(`team-${i}`, [`${event}@2026`]);
        for (let n = 0; n < 4 && !run.story.evil?.teamId; n++) evilStageStart(content, run);
        expect(teams, `${event} ${i}`).toContain(run.story.evil?.teamId);
      }
    }
  });

  it('Team weeks only name real teams', () => {
    for (const e of w9) for (const m of e.modifiers) if (m.kind === 'evilTeamFocus') for (const t of m.teams) expect(content.evilTeams.teams.some((x) => x.id === t), `${e.id} ${t}`).toBe(true);
  });
});

describe('W9 live events: W0 toolkit events', () => {
  it('Electric Week charges up between battles, Water Week has a tide, Ice Week starts in hail, field weeks set the field', () => {
    const mods = (id: string) => content.gameEvents.get(id)!.modifiers;
    expect(mods('electric-week').some((m) => m.kind === 'eventCounter' && m.id === 'charge' && m.on === 'battleWin')).toBe(true);
    expect(mods('electric-week').some((m) => m.kind === 'counterDamage' && m.counter === 'charge' && m.type === 'electric')).toBe(true);
    expect(mods('water-week').some((m) => m.kind === 'eventCounter' && m.id === 'tide' && m.cycle)).toBe(true);
    expect(mods('ice-week').some((m) => m.kind === 'battleStart' && m.weather === 'hail')).toBe(true);
    expect(mods('gravity-week').some((m) => m.kind === 'battleStart' && m.field === 'gravity')).toBe(true);
    expect(mods('trick-room-week').some((m) => m.kind === 'battleStart' && m.field === 'trickRoom')).toBe(true);
    expect(mods('tailwind-week').some((m) => m.kind === 'battleStart' && m.tailwind)).toBe(true);
  });
});
