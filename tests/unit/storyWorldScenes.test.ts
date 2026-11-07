// Story Run world scenes (Design v2 Part XI event templates, II-F Eevee Crossroads, II party chemistry and camp scenes).
import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { createPokemon } from '../../src/core/pokemon';
import type { RunState } from '../../src/core/state';
import { activeScene, chooseBackstory, finishScene, queueStopScene } from '../../src/core/story2/module';
import { CHEMISTRY_TYPES, chemistryType, eeveeForms, worldPick } from '../../src/core/story2/worldScenes';
import { content } from './helpers';

const storyRun = (seed: string, backstory = 'bs_viridian'): RunState => {
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
      for (const l of s.lines) expect(l.text, s.eventId).not.toMatch(/\{\w+\}/);
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

const ev = (id: string) => content.storyData.events.find((e) => e.id === id);

describe('world scene data', () => {
  it('has 30 templates, 8 Eevee forms and 24 camp scenes, all with text', () => {
    const world = content.storyData.events.filter((e) => e.tags.includes('world'));
    expect(world.filter((e) => e.tags.includes('template'))).toHaveLength(30);
    expect(world.filter((e) => e.tags.includes('eevee'))).toHaveLength(8);
    expect(world.filter((e) => e.tags.includes('camp'))).toHaveLength(24);
    for (const e of world) {
      for (const b of e.beats) expect(content.storyData.text[String(b.textKey)], e.id).toBeTruthy();
      for (const c of e.choices) expect(content.storyData.text[c.textKey], `${e.id} ${c.id}`).toBeTruthy();
    }
    for (const k of CHEMISTRY_TYPES) expect(ev(`ev_camp_${k}_1`), k).toBeTruthy();
    for (const f of ['vaporeon', 'jolteon', 'flareon', 'espeon', 'umbreon', 'leafeon', 'glaceon', 'sylveon']) expect(content.species.has(f), f).toBe(true);
  });
});

describe('event templates in a Story Run', () => {
  it('play at free Stops in every backstory, capped per run and per Act, same seed same scenes', () => {
    const cfg = content.balance.story.world;
    let total = 0;
    for (const bs of content.balance.story.module.enabledBackstories) {
      const run = storyRun(`world-${bs}`, bs);
      const played = playAll(run);
      const tpl = played.filter((id) => id.startsWith('ev_tpl_'));
      total += tpl.length;
      expect(tpl.length).toBeLessThanOrEqual(cfg.templatesPerRun);
      const perAct = new Map<number, number>();
      for (const id of tpl) {
        const act = Number(run.story.v2!.facts[`tpl_act.${id}`]);
        perAct.set(act, (perAct.get(act) ?? 0) + 1);
        // Never before its Act; needs hold.
        expect(act).toBeGreaterThanOrEqual(Number(ev(id)!.tags.find((t) => /^act\d$/.test(t))!.slice(3)));
      }
      for (const n of perAct.values()) expect(n).toBeLessThanOrEqual(cfg.templatesPerAct);
      // The backstory still reaches its ending (world scenes never take its Stops).
      expect(run.story.v2!.module!.ending, bs).toBeTruthy();
      expect(playAll(storyRun(`world-${bs}`, bs))).toEqual(played);
    }
    expect(total).toBeGreaterThan(0);
  });

  it('a template that needs another waits for it, and a backstory-only one needs that backstory', () => {
    const run = storyRun('world-needs');
    const stop = { ...run.story.v2!.blueprint!.stops.find((s) => s.category !== 'recovery')!, category: 'narrative' as const };
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      const id = worldPick(content, run, stop, 6, seen, []);
      if (!id) break;
      seen.push(id);
      run.story.v2!.facts[`tpl_act.${id}`] = 100 + i; // spread across "Acts" so the per-Act cap does not stop the walk
    }
    expect(seen).not.toContain('ev_tpl_ancient_recognition'); // Hisui only
    const lesson = seen.indexOf('ev_tpl_champion_lesson');
    if (lesson >= 0) expect(seen.indexOf('ev_tpl_champion_notices')).toBeLessThan(lesson);
  });
});

describe('Eevee Crossroads', () => {
  it('offers forms at a Recovery Stop for an Eevee of level 20+, and choosing one evolves it', () => {
    const run = storyRun('world-eevee');
    const eevee = createPokemon(content, 'eevee', 25, 'eevee-test');
    run.party.push(eevee);
    const recovery = { ...run.story.v2!.blueprint!.stops[0]!, category: 'recovery' as const };
    const forms = eeveeForms(content, run, 3);
    expect(forms).toContain('ev_eevee_espeon'); // day (odd Act)
    const id = worldPick(content, run, recovery, 3, [], [])!;
    expect(id.startsWith('ev_eevee_')).toBe(true);
    const v2 = run.story.v2!;
    v2.module!.active = id;
    v2.module!.activeStop = recovery.id;
    const scene = activeScene(content, run)!;
    expect(scene.kicker).toBe('Crossroads');
    expect(scene.lines.map((l) => l.text).join(' ')).toContain(eevee.care?.nickname || 'Eevee');
    expect(finishScene(content, run, 'change')).toBe(true);
    expect(eevee.speciesId).toBe(id.replace('ev_eevee_', ''));
  });

  it('no Eevee, or one under level 20, gets no offer', () => {
    const run = storyRun('world-no-eevee');
    run.party.push(createPokemon(content, 'eevee', 10, 'young-eevee'));
    const recovery = { ...run.story.v2!.blueprint!.stops[0]!, category: 'recovery' as const };
    expect(worldPick(content, run, recovery, 3, [], [])?.startsWith('ev_eevee_') ?? false).toBe(false);
  });
});

describe('party chemistry and camp scenes', () => {
  it('two Pokémon of one family are Old Friends, and a Recovery Stop plays their camp scene with both names', () => {
    const run = storyRun('world-camp');
    run.party.splice(0, run.party.length, createPokemon(content, 'charmeleon', 20, 'c1'), createPokemon(content, 'charizard', 40, 'c2'));
    const type = chemistryType(content, run, run.party[1]!, run.party[0]!);
    expect(type).not.toBeNull();
    const recovery = { ...run.story.v2!.blueprint!.stops[0]!, category: 'recovery' as const };
    const id = worldPick(content, run, recovery, 2, [], [])!;
    expect(id.startsWith('ev_camp_')).toBe(true);
    const v2 = run.story.v2!;
    v2.module!.active = id;
    const text = activeScene(content, run)!.lines.map((l) => l.text).join(' ');
    expect(text).toMatch(/Charmeleon|Charizard/);
    expect(text).not.toMatch(/\{\w+\}/);
  });
});
