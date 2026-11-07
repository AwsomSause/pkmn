// Overhaul slice 12: Legendary and Mythical roles, rare chains and boss phases (data and rules only).
import { describe, expect, it } from 'vitest';
import { LEGEND_ROLE_DATA, LEGEND_ROLES, LegendRolesFileSchema, legendRoleOf } from '../../src/core/legendary/roles';
import { RaidPhaseSchema } from '../../src/core/raid/schema';
import { wildEligibleSpecies } from '../../src/core/themes';
import { content } from './helpers';

const special = (tags: readonly string[]) => tags.includes('legendary') || tags.includes('mythical');
const bases = [...content.species.values()].filter((s) => !s.form && special(s.tags));
const events = content.expeditions.expeditions.filter((e) => e.legendary);
const eventsOf = (id: string) => events.filter((e) => e.legendary!.species === id);

describe('Legendary battle roles', () => {
  it('every Legendary and Mythical species has one, and nothing else does', () => {
    expect(LegendRolesFileSchema.safeParse(LEGEND_ROLE_DATA).success).toBe(true);
    expect(bases.length).toBeGreaterThan(90);
    for (const s of bases) expect(LEGEND_ROLE_DATA.species[s.id], s.id).toBeTruthy();
    for (const id of Object.keys(LEGEND_ROLE_DATA.species)) expect(bases.some((s) => s.id === id), id).toBe(true);
    for (const r of LEGEND_ROLES) expect(LEGEND_ROLE_DATA.roles[r], r).toBeTruthy();
  });

  it('each role fits the base stats, and the roles are spread out', () => {
    const count: Record<string, number> = {};
    for (const s of bases) {
      const b = s.baseStats;
      const role = legendRoleOf(content, s.id)!;
      const off = Math.max(b.atk, b.spa);
      if (role === 'striker') expect(off >= 100 && b.spe >= 80, s.id).toBe(true);
      if (role === 'powerhouse') expect(off, s.id).toBeGreaterThanOrEqual(100);
      if (role === 'wall') expect(b.def + b.spd >= 170 || (b.hp >= 100 && b.def + b.spd >= 140), s.id).toBe(true);
      count[role] = (count[role] ?? 0) + 1;
    }
    for (const r of LEGEND_ROLES) expect(count[r] ?? 0, r).toBeGreaterThanOrEqual(8);
    expect(Math.max(...Object.values(count))).toBeLessThan(bases.length * 0.4);
  });

  it('forms use their base species\' role, and ordinary Pokémon have none', () => {
    expect(legendRoleOf(content, 'mewtwo-mega-x')).toBe(legendRoleOf(content, 'mewtwo'));
    expect(legendRoleOf(content, 'pikachu')).toBeNull();
    expect(legendRoleOf(content, 'kyogre')).toBe('controller');
  });
});

describe('Mythicals come only through rare chains', () => {
  const mythicals = bases.filter((s) => s.tags.includes('mythical'));
  it('are never in ordinary wild encounters', () => {
    const wild = new Set(wildEligibleSpecies(content).map((s) => s.id));
    for (const s of mythicals) expect(wild.has(s.id), s.id).toBe(false);
  });

  it('each one has a Very Rare Legendary event from region 3 on, except two that come from another Pokémon', () => {
    const viaOther = ['phione', 'meltan']; // Phione hatches from Manaphy's line, Meltan evolves into Melmetal
    for (const s of mythicals) {
      const ev = eventsOf(s.id);
      if (viaOther.includes(s.id)) { expect(ev, s.id).toHaveLength(0); continue; }
      expect(ev.length, s.id).toBeGreaterThan(0);
      for (const e of ev) {
        expect(e.legendary!.rarity, s.id).toBe('veryRare');
        expect(e.legendary!.trigger.minRegion, s.id).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('Legendary boss battles', () => {
  const finales = events.map((e) => ({ e, boss: e.finale.kind === 'raid' ? content.raids.raids.find((r) => r.id === (e.finale as { raidId: string }).raidId) : e.finale.kind === 'totem' ? content.totems.totems.find((t) => t.id === (e.finale as { totemId: string }).totemId) : undefined }));

  it('every Legendary event ends in a boss with at least two phases that get tougher as it falls', () => {
    expect(finales.length).toBe(107);
    for (const { e, boss } of finales) {
      expect(boss, e.id).toBeTruthy();
      const phases = boss!.phases;
      expect(phases.length, e.id).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < phases.length; i++) expect(phases[i]!.atHp, e.id).toBeLessThan(phases[i - 1]!.atHp);
    }
  });

  it('a phase never heals the boss or hides its stats, and every stat change is announced', () => {
    for (const { e, boss } of finales) for (const p of boss!.phases) {
      expect(RaidPhaseSchema.safeParse(p).success, e.id).toBe(true);
      expect(p.text.length, e.id).toBeGreaterThan(5);
    }
    expect(RaidPhaseSchema.safeParse({ atHp: 0.5, text: 'x', heal: 0.5 }).success).toBe(false);
    expect(RaidPhaseSchema.safeParse({ atHp: 0.5, text: 'x', hideStats: true }).success).toBe(false);
  });

  it('every event has an omen, lore, an intro and both endings (the special encounter presentation)', () => {
    for (const e of events) {
      const l = e.legendary!;
      expect(l.omen.length, e.id).toBeGreaterThan(10);
      expect(l.lore.length, e.id).toBeGreaterThanOrEqual(1);
      expect(l.finale.intro.length, e.id).toBeGreaterThan(10);
      expect(l.finale.win.length, e.id).toBeGreaterThan(10);
      expect(l.finale.lose.length, e.id).toBeGreaterThan(10);
      expect(content.species.has(l.species), e.id).toBe(true);
    }
  });
});

describe('Legendary roles in battle', () => {
  it('a Legendary gets one stage for its role when it comes onto the field, on either side; others get none', async () => {
    const { createBattle, resolveTurn } = await import('../../src/core/battle/engine');
    const { createPokemon } = await import('../../src/core/pokemon');
    const { Rng, hashSeed } = await import('../../src/core/rng');
    const run = (a: string, b: string) => {
      const p = createPokemon(content, a, 50, 'p1'); p.moves = [{ id: 'splash', pp: 40 }];
      const e = createPokemon(content, b, 50, 'e1'); e.moves = [{ id: 'splash', pp: 40 }];
      const battle = createBattle('wild', [e], 0, p.uid, null);
      const ctx = { content, battle, party: [p], inventory: {}, rng: new Rng(hashSeed('role')), captureRng: new Rng(hashSeed('role-c')), catchMultiplier: 1 };
      resolveTurn(ctx, { kind: 'move', index: 0 });
      return battle;
    };
    const wall = run('magikarp', 'cobalion'); // wall: +1 Defense
    expect(wall.enemyStages.def).toBe(1);
    expect(wall.playerStages.def).toBe(0);
    const striker = run('azelf', 'magikarp'); // striker: +1 Speed
    expect(striker.playerStages.spe).toBe(1);
    expect(striker.enemyStages.spe).toBe(0);
  });
});
