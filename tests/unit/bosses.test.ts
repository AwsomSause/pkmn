// Boss teams (director, 2026-10-25): every boss can be a gym leader, an Elite
// Four member or a champion, with 16 gym teams, 10 Elite Four teams and 10
// champion teams each (bosses.json + bossTeams.json).

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { trainerEntry } from '../../src/assets/catalog';
import { getArchetype } from '../../src/core/archetypes';
import { chooseEnemyMove } from '../../src/core/battle/engine';
import type { BossTeam } from '../../src/core/contentSchema';
import { BossMemberSchema } from '../../src/core/contentSchema';
import {
  bossTeamIndex,
  createPlannedPokemon,
  GYM_TEAM_COUNT,
  leagueScale,
  LEAGUE_TEAM_COUNT,
  planChampion,
  planEliteFour,
  planGymLeader,
} from '../../src/core/encounters';
import { createPokemon } from '../../src/core/pokemon';
import { bossInfo, pickLeague } from '../../src/core/regions';
import { hashSeed, Rng } from '../../src/core/rng';
import { freshStages } from '../../src/core/state';
import { pickGymLeader } from '../../src/core/themes';
import { content, scaleAt } from './helpers';

const RED = getArchetype(content, 'red');
const FULL = content.campaigns.get('full')!;
const bosses = [...content.bosses.values()];
const stacks = (t: BossTeam) => t.members.reduce((sum, m) => sum + Object.values(m.training).reduce((a, b) => a + b, 0), 0) / t.members.length;

describe('boss teams', () => {
  it('every boss has 16 gym, 10 Elite Four and 10 champion teams', () => {
    expect(bosses.length).toBeGreaterThanOrEqual(220);
    for (const b of bosses) {
      expect(b.teams.gym).toHaveLength(GYM_TEAM_COUNT);
      expect(b.teams.elite).toHaveLength(LEAGUE_TEAM_COUNT);
      expect(b.teams.champion).toHaveLength(LEAGUE_TEAM_COUNT);
    }
  });

  it('reads a team member written as "species / moves / training"', () => {
    expect(BossMemberSchema.parse('garchomp / earthquake dragon-claw / atk+4 spe+2')).toEqual({
      speciesId: 'garchomp',
      moves: ['earthquake', 'dragon-claw'],
      training: { atk: 4, spe: 2 },
    });
    expect(BossMemberSchema.parse('onix / tackle')).toEqual({ speciesId: 'onix', moves: ['tackle'], training: {} });
    expect(BossMemberSchema.safeParse('onix / tackle / strength+9').success).toBe(false);
    expect(BossMemberSchema.safeParse('onix').success).toBe(false);
  });

  it('gym team 1–8 are for the first eight stages, 9–16 for the next eight, and team 16 repeats after that', () => {
    expect(bossTeamIndex('gym', 0)).toBe(0);
    expect(bossTeamIndex('gym', 7)).toBe(7);
    expect(bossTeamIndex('gym', 8)).toBe(8);
    expect(bossTeamIndex('gym', 15)).toBe(15);
    expect(bossTeamIndex('gym', 16)).toBe(15);
    expect(bossTeamIndex('gym', 79)).toBe(15);
    expect(bossTeamIndex('elite', 0)).toBe(0);
    expect(bossTeamIndex('champion', 9)).toBe(9);
    expect(bossTeamIndex('champion', 12)).toBe(9);
  });

  it('a gym battle uses the team for that stage, with its moves and training', () => {
    const boss = content.bosses.get('brock')!;
    for (const stageNumber of [0, 5, 12, 30]) {
      const plan = planGymLeader(content, RED, 'brock', stageNumber, scaleAt(stageNumber % 8, FULL.columns, Math.floor(stageNumber / 8)), new Rng(hashSeed(`gym-${stageNumber}`)));
      const team = boss.teams.gym[Math.min(stageNumber, 15)]!;
      expect(plan.members.map((m) => m.speciesId)).toEqual(team.members.map((m) => m.speciesId));
      expect(plan.members.map((m) => m.moves)).toEqual(team.members.map((m) => m.moves));
      expect(plan.ai).toBe(team.ai);
      expect(plan.leaderId).toBe('brock');
    }
  });

  it('a planned boss Pokémon knows its team moves and carries its training', () => {
    const mon = createPlannedPokemon(content, { speciesId: 'onix', level: 30, moves: ['rock-throw', 'tackle'], training: { atk: 3, spe: 1 } }, 'e1');
    expect(mon.moves.map((m) => m.id)).toEqual(['rock-throw', 'tackle']);
    expect(mon.vitamins.atk).toBe(3);
    expect(mon.vitamins.spe).toBe(1);
    const plain = createPokemon(content, 'onix', 30, 'e2');
    expect(mon.hp).toBe(plain.hp);
  });

  it('the team built for each gym matches the level the game gives that gym', () => {
    const d = content.balance.difficulty;
    const flat = { ...content, balance: { ...content.balance, difficulty: { ...d, variance: 0 } } };
    for (let k = 0; k < GYM_TEAM_COUNT; k++) {
      const region = Math.floor(k / FULL.stagesPerRegion);
      const plan = planGymLeader(flat, RED, 'misty', k, scaleAt(k % FULL.stagesPerRegion, FULL.columns, region, flat), new Rng(hashSeed("1")));
      expect(Math.max(...plan.members.map((m) => m.level))).toBe(content.bosses.get('misty')!.teams.gym[k]!.level);
    }
    for (let r = 0; r < LEAGUE_TEAM_COUNT; r++) {
      const champ = planChampion(flat, RED, 'lance', r, leagueScale(flat, r), new Rng(hashSeed("1")));
      expect(Math.max(...champ.members.map((m) => m.level))).toBe(content.bosses.get('lance')!.teams.champion[r]!.level);
    }
  });

  it('teams get harder: league teams train more each region, champions most of all', () => {
    for (const b of bosses) {
      for (let r = 1; r < LEAGUE_TEAM_COUNT; r++) {
        expect(stacks(b.teams.elite[r]!)).toBeGreaterThanOrEqual(stacks(b.teams.elite[r - 1]!));
        expect(stacks(b.teams.champion[r]!)).toBeGreaterThanOrEqual(stacks(b.teams.champion[r - 1]!));
        expect(b.teams.champion[r]!.ai).toBeGreaterThanOrEqual(b.teams.champion[r - 1]!.ai);
      }
      for (let r = 0; r < LEAGUE_TEAM_COUNT; r++) {
        expect(stacks(b.teams.champion[r]!)).toBeGreaterThan(stacks(b.teams.elite[r]!));
        expect(b.teams.champion[r]!.ai).toBeGreaterThanOrEqual(b.teams.elite[r]!.ai);
      }
      for (let k = 1; k < GYM_TEAM_COUNT; k++) expect(b.teams.gym[k]!.ai).toBeGreaterThanOrEqual(b.teams.gym[k - 1]!.ai);
    }
  });

  it('teams never hold two Pokémon of the same species', () => {
    for (const b of bosses) {
      for (const team of [...b.teams.gym, ...b.teams.elite, ...b.teams.champion]) {
        const ids = team.members.map((m) => m.speciesId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('legendary and mythical Pokémon only appear in late league teams', () => {
    const legend = (id: string) => (content.species.get(id) as { tags?: string[] } | undefined)?.tags?.some((t) => t === 'legendary' || t === 'mythical') ?? false;
    for (const b of bosses) {
      for (const team of b.teams.gym) expect(team.members.filter((m) => legend(m.speciesId))).toEqual([]);
      b.teams.elite.slice(0, 8).forEach((team) => expect(team.members.filter((m) => legend(m.speciesId))).toEqual([]));
      b.teams.champion.slice(0, 4).forEach((team) => expect(team.members.filter((m) => legend(m.speciesId))).toEqual([]));
    }
  });

  it('every boss portrait is a real file', () => {
    for (const b of bosses) {
      for (const role of ['gym', 'elite', 'champion'] as const) {
        const entry = trainerEntry(bossInfo(content, role, b.id).spriteAssetId);
        expect(existsSync(join('public', 'assets', entry.path)), `${b.id} ${role}: ${entry.path}`).toBe(true);
      }
    }
  });

  it('a champion can wear a different outfit', () => {
    expect(bossInfo(content, 'gym', 'cynthia').spriteAssetId).toBe('boss.cynthia-gen7');
    expect(bossInfo(content, 'champion', 'cynthia').spriteAssetId).toBe('boss.cynthia-masters4');
    expect(bossInfo(content, 'champion', 'cynthia').title).toBe('Champion Cynthia');
  });

  it('any boss can be picked for any role, and nobody is picked twice in a run', () => {
    const theme = content.themes.get([...content.themes.keys()][0]!)!;
    const used: string[] = [];
    const rng = new Rng(hashSeed('no-repeats'));
    for (let i = 0; i < 80; i++) used.push(pickGymLeader(content, theme, used, rng).id);
    const region = content.regions.get('kanto')!;
    for (let r = 0; r < 10; r++) {
      const league = pickLeague(content, region, FULL, used, rng);
      used.push(...league.eliteFour, league.champion);
    }
    expect(used).toHaveLength(80 + 10 * (FULL.eliteFourSize + 1));
    expect(new Set(used).size).toBe(used.length);
  });

  it('a clever boss picks its best move against the Pokémon it faces', () => {
    const enemy = createPokemon(content, 'pikachu', 30, 'e');
    enemy.moves = [{ id: 'growl', pp: 40 }, { id: 'thunder-shock', pp: 30 }, { id: 'tail-whip', pp: 30 }];
    const target = createPokemon(content, 'squirtle', 30, 'p');
    const brain = { content, ai: 1, target, stages: freshStages() };
    for (let i = 0; i < 20; i++) expect(chooseEnemyMove(enemy, new Rng(hashSeed(`ai-${i}`)), brain)).toBe(1);
    // ai 0 behaves like an ordinary trainer: any move with PP.
    const picks = new Set(Array.from({ length: 40 }, (_, i) => chooseEnemyMove(enemy, new Rng(hashSeed(`ai-${i}`)), { ...brain, ai: 0 })));
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('Elite Four and champion battles', () => {
  it('use the team for the region', () => {
    const scale = leagueScale(content, 1);
    const e4 = planEliteFour(content, RED, 'karen', 1, scale, new Rng(hashSeed("1")));
    expect(e4.members.map((m) => m.speciesId)).toEqual(content.bosses.get('karen')!.teams.elite[1]!.members.map((m) => m.speciesId));
    const champ = planChampion(content, RED, 'brock', 1, scale, new Rng(hashSeed("1")));
    expect(champ.classId).toBe('champion');
    expect(champ.members.map((m) => m.speciesId)).toEqual(content.bosses.get('brock')!.teams.champion[1]!.members.map((m) => m.speciesId));
  });
});
