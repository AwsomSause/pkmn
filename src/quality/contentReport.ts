// The content report (M8.6): counts, with the offending ids, of everything
// in the game data that doesn't fully work yet. `npm run report:content`
// prints it; `npm run report:content -- --check` fails when a count is worse
// than the last accepted one in tools/content-baseline.json.
//
// Read-only: it never changes the data or the game's rules. Things it needs
// from outside the game data (files on disk, the test sources) are passed in,
// so this file stays free of Node and Phaser.

import type { Content } from '../core/contentSchema';
import { generateLeagueMap, generateStageMap, validateLeagueMap, validateStageMap } from '../core/map';
import { usableLearnset } from '../core/pokemon';
import { isSpecialForm } from '../core/specialForms';
import { eligibleSpecies } from '../core/runPrep';
import { wildEligibleSpecies } from '../core/themes';
import { hashSeed, Rng } from '../core/rng';
import type { StageMap } from '../core/state';
import { buildCatalog, filesOf, pokemonEntries } from '../assets/catalog';
import { allStatuses, evolutionId, meetableSpecies, statusSummary, type EntryStatus, type StatusInputs } from './supportStatus';

export interface ReportInputs extends StatusInputs {
  /** The raw balance.json (before defaults are filled in), to list its settings. */
  balanceJson: unknown;
  /** Source text of the game's code (src/, without data and this folder), to see which settings are read. */
  gameSources: string[];
  /** Source text of the unit tests, to see which save upgrades have a test. */
  testSources: string[];
  /** Save upgrades: record name → the versions that have a migration to the next version. */
  migrations: Record<string, number[]>;
  /** The asset catalog's inputs come from the data files; only trainer/item/background ids are needed here. */
  catalogIds: { trainerAssetIds: string[]; itemAssetIds: string[]; backgroundAssetIds: string[] };
  /** How many seeds to generate stage maps for, per campaign. */
  mapSeeds?: number;
}

export interface ReportCheck {
  id: string;
  title: string;
  /** One plain sentence on what the number means. */
  explain: string;
  count: number;
  offenders: string[];
}

export interface ContentReport {
  totals: Record<string, number>;
  checks: ReportCheck[];
  statuses: EntryStatus[];
  summary: ReturnType<typeof statusSummary>;
}

/** Leaves of balance.json as dotted paths ("difficulty.curve", "campaigns[].columns"). */
export function settingPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    const objects = value.filter((v) => v !== null && typeof v === 'object' && !Array.isArray(v));
    if (objects.length === 0) return [prefix];
    return [...new Set(objects.flatMap((o) => settingPaths(o, `${prefix}[]`)))];
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => settingPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

/**
 * Settings whose keys are data (item ids, rarities, side-stop kinds): the code
 * reads the whole map, so only the map's own name has to appear in the code.
 */
const DATA_KEYED = new Set(['startingItems', 'rarityWeights', 'harderRarityWeights', 'bossRarityWeights', 'stage.sideWeights']);

/** The settings in balance.json that no game code reads. */
export function unusedSettings(balanceJson: unknown, sources: string[]): string[] {
  // Comments don't count as reading a setting.
  const text = sources.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const used = (word: string) => new RegExp(`\\b${word}\\b`).test(text);
  return settingPaths(balanceJson).filter((path) => {
    const keyed = [...DATA_KEYED].find((k) => path.startsWith(`${k}.`));
    const key = (keyed ?? path).split('.').pop()!.replace('[]', '');
    return !used(key);
  });
}

/** Save upgrades (record vN → vN+1) that no unit test starts from. */
export function untestedMigrations(migrations: Record<string, number[]>, testSources: string[]): string[] {
  const tested = new Set<string>();
  for (const text of testSources) {
    for (const m of text.matchAll(/record:\s*'(\w+)',\s*schemaVersion:\s*(\d+)/g)) tested.add(`${m[1]} v${m[2]}`);
  }
  return Object.entries(migrations).flatMap(([record, versions]) => versions.filter((v) => !tested.has(`${record} v${v}`)).map((v) => `${record} v${v} -> v${v + 1}`));
}

/** Nodes no route from column 1 reaches, and nodes from which the last node can't be reached. */
export function mapReachProblems(map: StageMap): string[] {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const reached = new Set<string>();
  const queue = map.nodes.filter((n) => n.column === 1).map((n) => n.id);
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const next of byId.get(id)?.next ?? []) queue.push(next);
  }
  const canFinish = new Set(map.nodes.filter((n) => n.column === map.columns).map((n) => n.id));
  for (let col = map.columns - 1; col >= 1; col--) {
    for (const n of map.nodes.filter((x) => x.column === col)) if (n.next.some((id) => canFinish.has(id))) canFinish.add(n.id);
  }
  return [
    ...map.nodes.filter((n) => !reached.has(n.id)).map((n) => `${n.id} unreachable`),
    ...map.nodes.filter((n) => !canFinish.has(n.id)).map((n) => `${n.id} can't reach the end`),
  ];
}

/** A boss team's species, moves and training; levels come from the difficulty curve, so they don't tell teams apart. */
const teamKey = (t: { members: { speciesId: string; moves: string[]; training: Record<string, number> }[] }) =>
  t.members.map((m) => `${m.speciesId}:${[...m.moves].sort().join('+')}:${JSON.stringify(Object.entries(m.training).sort())}`).join('|');

export function buildContentReport(content: Content, inputs: ReportInputs): ContentReport {
  const checks: ReportCheck[] = [];
  const add = (id: string, title: string, explain: string, offenders: string[]) => checks.push({ id, title, explain, count: offenders.length, offenders });
  const species = [...content.species.values()];
  const meetable = meetableSpecies(content);

  add('unsupported-moves', 'Unsupported moves', 'Moves in the data that the battle engine cannot run yet; no Pokémon learns or uses them.', [...content.moves.values()].filter((m) => !m.supported).map((m) => m.id));
  add(
    'unsupported-learnset-entries',
    'Level-up moves skipped',
    'Level-up learnset entries skipped because the move is unsupported (species learn fewer moves than in the main games).',
    species.flatMap((s) => s.learnset.filter((e) => !content.moves.get(e.move)?.supported).map((e) => `${s.id}@${e.level}:${e.move}`)),
  );
  // Special forms (Untitled doc §8) must only come from approved routes: never from ordinary wild, trainer or starter pools.
  const leaks = new Set<string>();
  for (const sp of wildEligibleSpecies(content)) if (isSpecialForm(sp)) leaks.add(`${sp.id} (wild/trainer pool)`);
  for (const pool of content.starterPools.values()) if (!pool.specialForms) for (const id of eligibleSpecies(content, pool)) if (isSpecialForm(content.species.get(id)!)) leaks.add(`${id} (starter pool ${pool.id})`);
  add('special-form-leaks', 'Special forms in ordinary pools', 'Delta, Z, Spooky or regional forms that an ordinary wild, trainer or starter pool can hand out. Should be zero: they are event-only.', [...leaks]);
  add('species-no-usable-moves', 'Species with no usable moves', 'Species and forms with no supported level-up move at all (they could only use Struggle).', species.filter((s) => usableLearnset(content, s).length === 0).map((s) => s.id));
  add(
    'meetable-species-no-usable-moves',
    'Meetable species with no usable moves',
    'Of those, ones a player can own (wild, starter, or by evolving). Should be zero.',
    species.filter((s) => meetable.has(s.id) && usableLearnset(content, s).length === 0).map((s) => s.id),
  );

  // Art and sound on disk.
  const missingSprites: string[] = [];
  const missingCries: string[] = [];
  for (const s of species) {
    const [front, back, shiny, shinyBack, icon, cry] = pokemonEntries(s.assets);
    const names = ['front', 'back', 'shiny', 'shiny back', 'icon'];
    [front, back, shiny, shinyBack, icon].forEach((e, i) => {
      if (!filesOf(e!).every(inputs.assetExists)) missingSprites.push(`${s.id} (${names[i]})`);
    });
    if (!filesOf(cry!).every(inputs.assetExists)) missingCries.push(s.id);
  }
  add('missing-sprites', 'Missing Pokémon sprites', 'Sprite or icon files a species points at that are not in public/assets (the game shows a fallback).', missingSprites);
  add('missing-cries', 'Missing cries', 'Cry files a species points at that are not in public/assets.', missingCries);
  const otherCatalog = buildCatalog({ pokemon: [], ...inputs.catalogIds });
  add('missing-other-assets', 'Missing other assets', 'Trainer, item, background, music, sound and font files the game asks for that are not in public/assets.', otherCatalog.filter((e) => !filesOf(e).every(inputs.assetExists)).map((e) => e.id));

  // Stage maps over many seeds.
  const seeds = inputs.mapSeeds ?? 200;
  const mapProblems: string[] = [];
  let mapsChecked = 0;
  for (const campaign of content.campaigns.values()) {
    for (let i = 0; i < seeds; i++) {
      const seed = `report-${campaign.id}-${i}`;
      const map = generateStageMap(content, campaign, new Rng(hashSeed(seed)));
      mapsChecked++;
      for (const p of [...mapReachProblems(map), ...validateStageMap(map)]) mapProblems.push(`${seed}: ${p}`);
    }
    const league = generateLeagueMap(campaign.eliteFourSize);
    mapsChecked++;
    for (const p of [...mapReachProblems(league), ...validateLeagueMap(league)]) mapProblems.push(`league ${campaign.id}: ${p}`);
  }
  add('unreachable-map-nodes', 'Map problems', `Unreachable nodes, dead ends or rule breaks found in ${mapsChecked} generated stage and league maps.`, [...new Set(mapProblems)]);

  // Boss teams.
  const duplicates: string[] = [];
  const nearDuplicates: string[] = [];
  const firstUse = new Map<string, string>();
  const firstLineup = new Map<string, string>();
  for (const boss of content.bosses.values()) {
    for (const role of ['gym', 'elite', 'champion'] as const) {
      boss.teams[role].forEach((team, i) => {
        const key = teamKey(team);
        const here = `${boss.id} ${role} #${i + 1}`;
        const earlier = firstUse.get(key);
        if (earlier) duplicates.push(`${here} = ${earlier}`);
        else firstUse.set(key, here);
        const lineup = teamKey({ members: team.members.map((m) => ({ ...m, training: {} })) });
        const sameLineup = firstLineup.get(lineup);
        if (sameLineup && !earlier) nearDuplicates.push(`${here} ~ ${sameLineup}`);
        else if (!sameLineup) firstLineup.set(lineup, here);
      });
    }
  }
  add('duplicate-boss-teams', 'Duplicate boss teams', 'Boss teams identical (same species, moves and training) to an earlier team, for the same boss or a different one. The battle is then the same fight at a different level.', duplicates);
  add('near-duplicate-boss-teams', 'Boss teams that differ only in training', 'Boss teams with the same species and moves as an earlier team; only the extra training stacks differ.', nearDuplicates);
  const bossBadMoves: string[] = [];
  for (const boss of content.bosses.values()) {
    for (const role of ['gym', 'elite', 'champion'] as const) {
      boss.teams[role].forEach((team, i) => {
        for (const m of team.members) for (const move of m.moves) if (!content.moves.get(move)?.supported) bossBadMoves.push(`${boss.id} ${role} #${i + 1}: ${m.speciesId} ${move}`);
      });
    }
  }
  add('boss-unsupported-moves', 'Boss moves the engine cannot run', 'Moves on boss teams that are unsupported (a boss would use a move the engine treats as plain damage or nothing).', bossBadMoves);

  // Evolutions.
  const statuses = allStatuses(content, inputs);
  const brokenEvolutions = statuses.filter((e) => e.kind === 'evolution' && (e.status === 'invalid' || e.status === 'disabled')).map((e) => `${e.id}: ${e.notes.join('; ')}`);
  const cycles: string[] = [];
  for (const s of species) {
    const seen = new Set([s.id]);
    let frontier = s.evolutions.map((e) => e.to);
    for (let depth = 0; depth < 5 && frontier.length > 0; depth++) {
      if (frontier.includes(s.id)) {
        cycles.push(`${s.id}: evolves back into itself`);
        break;
      }
      frontier = frontier.filter((id) => !seen.has(id)).flatMap((id) => (seen.add(id), content.species.get(id)?.evolutions.map((e) => e.to) ?? []));
    }
  }
  const meetableBroken = brokenEvolutions.filter((line) => meetable.has(line.slice(0, line.indexOf('->'))));
  add('broken-evolutions', 'Broken evolutions', 'Evolutions a meetable Pokémon cannot complete: unknown target, wrong item, item nobody can get, level above the maximum, target with no moves, or a loop.', [...meetableBroken, ...cycles]);

  add('unused-balance-settings', 'Unused balance settings', 'Settings in balance.json that no game code reads (changing them does nothing).', unusedSettings(inputs.balanceJson, inputs.gameSources));
  add('untested-save-migrations', 'Save upgrades with no test', 'Save upgrades (old version to new) that no unit test loads an old save through.', untestedMigrations(inputs.migrations, inputs.testSources));
  add('invalid-entries', 'Invalid content entries', 'Entries whose support status is "invalid" (broken data).', statuses.filter((e) => e.status === 'invalid').map((e) => `${e.kind} ${e.id}: ${e.notes.join('; ')}`));

  const totals = {
    species: species.filter((s) => !s.form).length,
    forms: species.filter((s) => s.form).length,
    moves: content.moves.size,
    items: content.items.size,
    evolutions: species.reduce((n, s) => n + s.evolutions.length, 0),
    meetableSpecies: meetable.size,
    bosses: content.bosses.size,
    bossTeams: [...content.bosses.values()].reduce((n, b) => n + b.teams.gym.length + b.teams.elite.length + b.teams.champion.length, 0),
  };
  return { totals, checks, statuses, summary: statusSummary(statuses) };
}

export interface GateNumber {
  value: number;
  /** "lower": the count of a problem. "higher": how many entries are fully supported. */
  better: 'lower' | 'higher';
}

/**
 * The numbers the CI gate compares: every check's count (lower is better) and
 * how many entries of each kind are fully supported (higher is better), so new
 * content that isn't supported yet only fails the gate if it breaks something.
 */
export function gateNumbers(report: ContentReport): Record<string, GateNumber> {
  const numbers: Record<string, GateNumber> = Object.fromEntries(report.checks.map((c) => [c.id, { value: c.count, better: 'lower' as const }]));
  for (const [kind, counts] of Object.entries(report.summary)) numbers[`supported.${kind}`] = { value: counts.supported, better: 'higher' };
  return numbers;
}

/** Gate numbers that got worse than the baseline. A number missing from the baseline is new and can't regress. */
export function regressions(current: Record<string, GateNumber>, baseline: Record<string, number>): string[] {
  return Object.entries(current)
    .filter(([id, n]) => id in baseline && (n.better === 'lower' ? n.value > baseline[id]! : n.value < baseline[id]!))
    .map(([id, n]) => `${id}: ${baseline[id]} -> ${n.value} (${n.better} is better)`);
}

/** Gate numbers that got better: the baseline can be tightened with --update-baseline. */
export function improvements(current: Record<string, GateNumber>, baseline: Record<string, number>): string[] {
  return Object.entries(current)
    .filter(([id, n]) => id in baseline && (n.better === 'lower' ? n.value < baseline[id]! : n.value > baseline[id]!))
    .map(([id, n]) => `${id}: ${baseline[id]} -> ${n.value}`);
}

export { evolutionId };
