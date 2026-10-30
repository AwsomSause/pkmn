import { describe, expect, it } from 'vitest';
import { AMBIENCE, arenaType } from '../../src/ui/battleFx/ambience';
import { CATEGORY_ROWS, FLAG_ICONS, STATUS_ROWS, TYPE_ROWS, effectivenessWord } from '../../src/ui/aero';
import typeChart from '../../src/data/typeChart.json';
import { FIXED_ASSETS } from '../../src/assets/catalog';
import { existsSync } from 'node:fs';

// M10 visual slice 1: the pack art the battle screen uses, and arena ambience.
describe('visual slice 1 (Aero battle)', () => {
  it('has an ambience preset for every type and maps arenas to types', () => {
    const types = Object.keys(typeChart).filter((t) => t !== 'stellar');
    for (const t of types) expect(AMBIENCE[t], t).toBeDefined();
    expect(arenaType('bg.arena.sea')).toBe('water');
    expect(arenaType('bg.arena.ice_cave')).toBe('ice');
    expect(arenaType('bg.arena.volcano')).toBe('fire');
    expect(arenaType('bg.arena.graveyard')).toBe('ghost');
    expect(arenaType('bg.arena.tall_grass')).toBe('grass');
    expect(arenaType('bg.battle')).toBe('normal');
  });

  it('every ambience particle is a cataloged pack file', () => {
    const ids = new Set(FIXED_ASSETS.map((a) => a.id));
    for (const p of Object.values(AMBIENCE)) expect(ids.has(p.particle), p.particle).toBe(true);
  });

  it('has a type-label row for all 18 types and rows for every category and status', () => {
    const types = Object.keys(typeChart);
    for (const t of types.filter((t) => t !== 'stellar')) expect(TYPE_ROWS[t], t).toBeTypeOf('number');
    expect(new Set(Object.values(TYPE_ROWS)).size).toBe(Object.keys(TYPE_ROWS).length);
    expect(Object.keys(CATEGORY_ROWS).sort()).toEqual(['physical', 'special', 'status']);
    expect(Object.keys(STATUS_ROWS).sort()).toEqual(['brn', 'frz', 'par', 'psn', 'slp']);
  });

  it('ships every pack file it catalogs', () => {
    const pack = FIXED_ASSETS.filter((a) => a.id.startsWith('pack.'));
    expect(pack.length).toBe(49);
    for (const a of pack) expect(existsSync(`public/assets/${a.path}`), a.path).toBe(true);
  });

  it('slice 3: every move flag but typeless has an Enhanced Battle UI icon, and effectiveness has words', () => {
    for (const f of ['contact', 'sound', 'bite', 'powder', 'pulse', 'punch', 'zmove', 'max', 'highCrit']) expect(FLAG_ICONS[f], f).toBeDefined();
    expect(effectivenessWord(0)).toEqual({ frame: 1, text: 'No effect' });
    expect(effectivenessWord(0.5).text).toBe('Not very effective');
    expect(effectivenessWord(2).text).toBe('Super effective');
    expect(effectivenessWord(1).text).toBe('Normal damage');
  });
});
