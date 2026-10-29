// M8.6: the content report, support statuses, the quality gate and the
// balance simulations. Each check is shown to catch the problem it reports.

import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import { generateStageMap } from '../../src/core/map';
import { hashSeed, Rng } from '../../src/core/rng';
import { createPokemon } from '../../src/core/pokemon';
import {
  buildContentReport,
  gateNumbers,
  improvements,
  mapReachProblems,
  regressions,
  settingPaths,
  unusedSettings,
  untestedMigrations,
  type ReportInputs,
} from '../../src/quality/contentReport';
import { allStatuses, meetableSpecies, moveStatus, speciesStatus, statusSummary } from '../../src/quality/supportStatus';
import { difficultyCurve, simulateBattle, speciesStrength } from '../../src/quality/balanceSim';
import type { Content } from '../../src/core/contentSchema';

const everyFileExists = () => true;
const inputs = (over: Partial<ReportInputs> = {}): ReportInputs => ({
  assetExists: everyFileExists,
  balanceJson: {},
  gameSources: [],
  testSources: [],
  migrations: {},
  catalogIds: { trainerAssetIds: [], itemAssetIds: [], backgroundAssetIds: [] },
  mapSeeds: 3,
  ...over,
});
const check = (c: Content, id: string, over: Partial<ReportInputs> = {}) => buildContentReport(c, inputs(over)).checks.find((x) => x.id === id)!;

describe('support status', () => {
  it('an unsupported move is disabled, a move with a known limit is limited, others are supported', () => {
    expect(moveStatus(content, content.moves.get('acrobatics')!).status).toBe('disabled');
    expect(moveStatus(content, content.moves.get('surf')!)).toMatchObject({ status: 'limited' });
    expect(moveStatus(content, content.moves.get('tackle')!)).toEqual({ kind: 'move', id: 'tackle', status: 'supported', notes: [] });
  });

  it('a Mega form waits for Advanced Mechanics; a species with no usable moves is disabled', () => {
    const owners = new Map<string, string>();
    expect(speciesStatus(content, content.species.get('venusaur-mega')!, { assetExists: everyFileExists }, owners, owners)).toMatchObject({ kind: 'form', status: 'disabled' });
    expect(speciesStatus(content, content.species.get('ditto')!, { assetExists: everyFileExists }, owners, owners).status).toBe('disabled');
    expect(speciesStatus(content, content.species.get('bulbasaur')!, { assetExists: everyFileExists }, owners, owners).status).toBe('supported');
  });

  it('a missing front sprite makes a species invalid; a missing shiny only limits it', () => {
    const owners = new Map<string, string>();
    const bulbasaur = content.species.get('bulbasaur')!;
    expect(speciesStatus(content, bulbasaur, { assetExists: (p) => !p.startsWith('images/pokemon/1.') }, owners, owners).status).toBe('invalid');
    expect(speciesStatus(content, bulbasaur, { assetExists: (p) => !p.startsWith('images/pokemon/shiny/') }, owners, owners).status).toBe('limited');
  });

  it('every entry gets exactly one of the four statuses, and none of the shipped data is invalid', () => {
    const statuses = allStatuses(content, { assetExists: everyFileExists });
    const summary = statusSummary(statuses);
    const total = Object.values(summary).reduce((n, k) => n + k.supported + k.limited + k.disabled + k.invalid, 0);
    expect(total).toBe(statuses.length);
    expect(statuses.filter((s) => s.status === 'invalid')).toEqual([]);
  });

  it('bosses only count as meetable when asked (they bring their own moves and cannot be caught)', () => {
    expect(meetableSpecies(content).has('smeargle')).toBe(false);
    expect(meetableSpecies(content, true).has('smeargle')).toBe(true);
  });
});

describe('content report checks', () => {
  it('finds a meetable species that lost all its usable moves', () => {
    expect(check(content, 'meetable-species-no-usable-moves').count).toBe(0);
    const c = structuredClone(content);
    c.species.get('bulbasaur')!.learnset = [{ level: 1, move: 'acrobatics' }];
    expect(check(c, 'meetable-species-no-usable-moves').offenders).toContain('bulbasaur');
  });

  it('finds an evolution whose item nobody can get', () => {
    const c = structuredClone(content);
    c.shop = c.shop.filter((e) => e.item !== 'fire-stone');
    for (const [id, r] of c.rewards) if (r.effect.kind === 'addItem' && r.effect.item === 'fire-stone') c.rewards.delete(id);
    expect(check(c, 'broken-evolutions').offenders.some((o) => o.startsWith('vulpix->ninetales'))).toBe(true);
  });

  it('finds duplicate boss teams', () => {
    const c = structuredClone(content);
    const boss = c.bosses.get('brock')!;
    boss.teams.gym[1] = structuredClone(boss.teams.gym[0]!);
    expect(check(c, 'duplicate-boss-teams').offenders).toContain('brock gym #2 = brock gym #1');
  });

  it('finds missing art and cries', () => {
    const noCries = (p: string) => !p.startsWith('audio/cry/');
    expect(check(content, 'missing-cries', { assetExists: noCries }).count).toBe(content.species.size);
    expect(check(content, 'missing-sprites').count).toBe(0);
  });

  it('finds unreachable nodes and dead ends on a map', () => {
    const map = generateStageMap(content, content.campaigns.get('dev')!, new Rng(hashSeed('reach')));
    expect(mapReachProblems(map)).toEqual([]);
    const second = map.nodes.find((n) => n.column === 2)!;
    for (const n of map.nodes) n.next = n.next.filter((id) => id !== second.id);
    expect(mapReachProblems(map)).toContain(`${second.id} unreachable`);
  });

  it('lists balance settings no code reads', () => {
    const balance = { partyMax: 6, difficulty: { curve: 0.6, forgotten: 2 }, rarityWeights: { common: 1 }, campaigns: [{ id: 'full', columns: 20 }] };
    expect(settingPaths(balance)).toEqual(['partyMax', 'difficulty.curve', 'difficulty.forgotten', 'rarityWeights.common', 'campaigns[].id', 'campaigns[].columns']);
    const code = 'const a = b.partyMax + cfg.curve; // forgotten\nweights = balance.rarityWeights; c.campaigns.map(x => x.id + x.columns)';
    expect(unusedSettings(balance, [code])).toEqual(['difficulty.forgotten']);
  });

  it('lists save upgrades no test starts from', () => {
    const tests = ["storage.set('pkr.run', JSON.stringify({ record: 'run', schemaVersion: 1, data }))"];
    expect(untestedMigrations({ run: [1, 2], profile: [1] }, tests)).toEqual(['run v2 -> v3', 'profile v1 -> v2']);
  });
});

describe('quality gate', () => {
  it('fails when a problem count rises or the supported count falls, and notices improvements', () => {
    const now = { 'broken-evolutions': { value: 2, better: 'lower' as const }, 'supported.move': { value: 300, better: 'higher' as const }, 'new-check': { value: 5, better: 'lower' as const } };
    expect(regressions(now, { 'broken-evolutions': 1, 'supported.move': 311 })).toEqual(['broken-evolutions: 1 -> 2 (lower is better)', 'supported.move: 311 -> 300 (higher is better)']);
    expect(regressions(now, { 'broken-evolutions': 3, 'supported.move': 300 })).toEqual([]);
    expect(improvements(now, { 'broken-evolutions': 3, 'supported.move': 300 })).toEqual(['broken-evolutions: 3 -> 2']);
  });

  it('gate numbers cover every check and every kind of entry', () => {
    const numbers = gateNumbers(buildContentReport(content, inputs()));
    expect(Object.keys(numbers)).toEqual(expect.arrayContaining(['unsupported-moves', 'broken-evolutions', 'untested-save-migrations', 'supported.species', 'supported.evolution']));
  });
});

describe('balance simulations', () => {
  it('the same seed gives the same battle', () => {
    const a = [createPokemon(content, 'charmander', 20, 'a')];
    const b = [createPokemon(content, 'squirtle', 20, 'b')];
    const first = simulateBattle(content, a, b, 1, 'same');
    expect(simulateBattle(content, a, b, 1, 'same')).toEqual(first);
    expect(first.winner).not.toBe('draw');
    // The teams passed in are never changed.
    expect(a[0]!.hp).toBe(createPokemon(content, 'charmander', 20, 'a').hp);
  });

  it('species strength and the difficulty curve are deterministic', () => {
    expect(speciesStrength(content, 'det', 30, 1)).toEqual(speciesStrength(content, 'det', 30, 1));
    const curve = difficultyCurve(content, 'det', 1, 'dev');
    expect(curve).toEqual(difficultyCurve(content, 'det', 1, 'dev'));
    expect(curve.map((r) => r.slot)).toEqual(['gym 1', 'gym 2', 'Elite Four', 'champion', 'gym 1', 'gym 2', 'Elite Four', 'champion']);
  });
});
