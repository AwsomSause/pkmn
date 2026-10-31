// Encounter Director + Combat Threat Rating (left-out plan 1.2, Balancing Phases 4–10).
// Unit checks for the pipeline, then a 10,000-sample run per early stage that writes the
// per-stage diagnostics report (docs/quality/encounter-director-report.json and .md).
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { content, scaleAt } from './helpers';
import { availabilityOf, isUnlockedAt, gatePool } from '../../src/core/availability';
import { getArchetype } from '../../src/core/archetypes';
import { curveLevel, planGymLeader, planTrainer, planWild } from '../../src/core/encounters';
import { directSpecies, watchDirector, type DirectorRecord } from '../../src/core/encounterDirector';
import { calcStats, createPokemon, getSpecies } from '../../src/core/pokemon';
import { hashSeed, Rng } from '../../src/core/rng';
import { themePool } from '../../src/core/themes';
import { speciesThreat, threatBudget, threatOf } from '../../src/core/threat';

const collect = (fn: () => void): DirectorRecord[] => {
  const out: DirectorRecord[] = [];
  const stop = watchDirector((r) => out.push(r));
  try {
    fn();
  } finally {
    stop();
  }
  return out;
};

describe('Combat Threat Rating', () => {
  it('rates an evolved Pokémon above its first stage, and is the same every time', () => {
    expect(speciesThreat(content, 'charizard', 36)).toBeGreaterThan(speciesThreat(content, 'charmander', 36));
    expect(speciesThreat(content, 'charmander', 10)).toBe(speciesThreat(content, 'charmander', 10));
  });

  it('counts setup, recovery and priority moves', () => {
    const mon = createPokemon(content, 'rattata', 20, 't');
    mon.moves = [{ id: 'tackle', pp: 35 }];
    const plain = threatOf(content, mon).rating;
    mon.moves = [{ id: 'tackle', pp: 35 }, { id: 'swords-dance', pp: 20 }, { id: 'recover', pp: 5 }, { id: 'quick-attack', pp: 30 }];
    expect(threatOf(content, mon).rating).toBeGreaterThan(plain);
  });

  it('budgets rise with level and tier, and stop at their max', () => {
    expect(threatBudget(content, 'standard', 30)).toBeGreaterThan(threatBudget(content, 'standard', 5));
    expect(threatBudget(content, 'elite', 10)).toBeGreaterThan(threatBudget(content, 'easy', 10));
    expect(threatBudget(content, 'easy', 100)).toBe(content.balance.threat.budgets.easy.max);
  });
});

describe('Encounter Director', () => {
  it('accepts the first valid draw', () => {
    const { speciesId, record } = directSpecies(content, { source: 'wild', level: 5, cap: 50, draw: () => 'caterpie' });
    expect(speciesId).toBe('caterpie');
    expect(record.fallback).toBe(false);
    expect(record.draws).toBe(1);
  });

  it('rejects a too-strong draw, retries a bounded number of times, then falls back to the weakest valid one', () => {
    const draws = ['garchomp', 'tyranitar', 'caterpie'];
    let i = 0;
    const { speciesId, record } = directSpecies(content, { source: 'wild', level: 5, cap: 50, draw: () => draws[i++ % draws.length]! });
    expect(speciesId).toBe('caterpie');
    expect(record.rejections['over-threat']).toBeGreaterThan(0);
    const strong = directSpecies(content, { source: 'wild', level: 5, cap: 50, draw: () => 'garchomp' });
    expect(strong.record.fallback).toBe(true);
    expect(strong.record.draws).toBe(content.balance.threat.retries + 1);
  });

  it('flags an unknown species as invalid instead of passing it silently', () => {
    const { record } = directSpecies(content, { source: 'event', level: 5, cap: 50, draw: () => 'not-a-pokemon' });
    expect(record.invalid).toBe(true);
    expect(record.rejections['unknown-species']).toBeGreaterThan(0);
  });

  it('clamps the level to the cap', () => {
    const { level, record } = directSpecies(content, { source: 'reward', level: 80, cap: 50, draw: () => 'caterpie' });
    expect(level).toBe(50);
    expect(record.askedLevel).toBe(80);
  });

  it('same seed, same encounters', () => {
    const archetype = getArchetype(content, 'red');
    const theme = [...content.themes.values()][3]!;
    const a = planWild(content, archetype, theme, scaleAt(0, 2), 0, new Rng(hashSeed('same')));
    const b = planWild(content, archetype, theme, scaleAt(0, 2), 0, new Rng(hashSeed('same')));
    expect(a).toEqual(b);
  });

  it('boss teams are audited as authored exceptions, not re-rolled', () => {
    const boss = [...content.bosses.values()][0]!;
    const records = collect(() => planGymLeader(content, getArchetype(content, 'red'), boss.id, 0, scaleAt(0, 6), new Rng(hashSeed('gym'))));
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.source === 'gym' && r.exception === 'authored-boss-team')).toBe(true);
  });
});

// ---------- the per-stage report (Balancing Phases 9–10) ----------

const SAMPLES = 10_000;
const TRAINER_SAMPLES = 2_000;
const STAGES = [0, 1, 2, 3];

/** Max-roll damage of the foe's best attack against an all-70 Pokémon of the same level (neutral type, no crit). */
function oneHitKo(speciesId: string, level: number): boolean {
  const foe = createPokemon(content, speciesId, level, `ohko:${speciesId}`);
  const stats = calcStats(content, foe);
  const ref = Math.floor((2 * 70 * level) / 100) + 5;
  const hp = Math.floor((2 * 70 * level) / 100) + level + 10;
  const types = getSpecies(content, speciesId).types;
  let best = 0;
  for (const slot of foe.moves) {
    const m = content.moves.get(slot.id);
    if (!m || m.category === 'status' || !m.power) continue;
    const atk = m.category === 'physical' ? stats.atk : stats.spa;
    best = Math.max(best, Math.floor((Math.floor(((2 * level) / 5 + 2) * m.power * (atk / ref)) / 50) + 2) * (types.includes(m.type) ? 1.5 : 1));
  }
  return best >= hp;
}

interface StageReport {
  stage: number;
  intendedLevels: [number, number];
  curveLevel: number;
  wild: Summary;
  trainer: Summary;
}
interface Summary {
  samples: number;
  levels: Record<string, number>;
  species: number;
  topSpecies: [string, number][];
  rarity: Record<string, number>;
  evolutionStage: Record<string, number>;
  threatAvg: number;
  threatMax: number;
  budgetAvg: number;
  rejectionRate: number;
  fallbacks: number;
  invalid: number;
  lockedPicks: number;
  oneHitKoRate: number;
}

function summarize(records: DirectorRecord[], gate: number, fallbackIds: Set<string>): Summary {
  const levels: Record<string, number> = {};
  const species: Record<string, number> = {};
  const rarity: Record<string, number> = {};
  const evo: Record<string, number> = {};
  let threat = 0, threatMax = 0, budget = 0, rejected = 0, draws = 0, fallbacks = 0, invalid = 0, locked = 0, ohko = 0;
  const ohkoCache = new Map<string, boolean>();
  for (const r of records) {
    levels[r.level] = (levels[r.level] ?? 0) + 1;
    species[r.speciesId] = (species[r.speciesId] ?? 0) + 1;
    const row = availabilityOf(content, r.speciesId);
    rarity[row?.rarity ?? 'none'] = (rarity[row?.rarity ?? 'none'] ?? 0) + 1;
    const stage = getSpecies(content, r.speciesId).evolutionStage;
    evo[stage] = (evo[stage] ?? 0) + 1;
    threat += r.threat;
    threatMax = Math.max(threatMax, r.threat);
    budget += r.budget;
    draws += r.draws;
    rejected += Object.values(r.rejections).reduce((a, b) => a + b, 0) > 0 ? r.draws - (r.fallback ? 0 : 1) : 0;
    if (r.fallback) fallbacks++;
    if (r.invalid) invalid++;
    if (r.source === 'wild' && !isUnlockedAt(content, r.speciesId, gate) && !fallbackIds.has(r.speciesId)) locked++;
    const key = `${r.speciesId}@${r.level}`;
    if (!ohkoCache.has(key)) ohkoCache.set(key, oneHitKo(r.speciesId, r.level));
    if (ohkoCache.get(key)) ohko++;
  }
  const n = Math.max(1, records.length);
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    samples: records.length,
    levels,
    species: Object.keys(species).length,
    topSpecies: Object.entries(species).sort((a, b) => b[1] - a[1]).slice(0, 8),
    rarity,
    evolutionStage: evo,
    threatAvg: round(threat / n),
    threatMax,
    budgetAvg: round(budget / n),
    rejectionRate: round(rejected / Math.max(1, draws)),
    fallbacks,
    invalid,
    lockedPicks: locked,
    oneHitKoRate: round(ohko / n),
  };
}

describe('Encounter Director report (10,000 samples per early stage)', () => {
  it('early stages: no invalid or locked Pokémon, levels within the cap, and writes the report', () => {
    const archetype = getArchetype(content, 'red');
    const themes = [...content.themes.values()];
    const reports: StageReport[] = [];
    for (const stage of STAGES) {
      const scale = scaleAt(stage, 3);
      const gate = curveLevel(content, scale);
      const fallbackIds = new Set(themes.flatMap((t) => gatePool(content, themePool(content, t), gate).fallbacks));
      const wild = collect(() => {
        for (let i = 0; i < SAMPLES; i++) planWild(content, archetype, themes[i % themes.length]!, scale, 0, new Rng(hashSeed(`w${stage}:${i}`)));
      }).filter((r) => r.source === 'wild');
      const trainer = collect(() => {
        for (let i = 0; i < TRAINER_SAMPLES; i++) planTrainer(content, archetype, themes[i % themes.length]!, stage, scale, new Rng(hashSeed(`t${stage}:${i}`)));
      }).filter((r) => r.source === 'trainer');
      const report: StageReport = { stage, intendedLevels: [Math.max(content.balance.difficulty.minLevel, gate - content.balance.difficulty.variance), Math.min(scale.cap, gate + content.balance.difficulty.variance)], curveLevel: gate, wild: summarize(wild, gate, fallbackIds), trainer: summarize(trainer, gate, fallbackIds) };
      reports.push(report);
      expect(report.wild.samples).toBe(SAMPLES);
      expect(report.wild.invalid + report.trainer.invalid, `stage ${stage}`).toBe(0);
      expect(report.wild.lockedPicks, `stage ${stage}`).toBe(0);
      for (const r of [...wild, ...trainer]) expect(r.level).toBeLessThanOrEqual(scale.cap);
    }
    // Early wild fights should rarely one-shot an even-level Pokémon (a budget, not a ban: Phase 6).
    expect(reports[0]!.wild.oneHitKoRate).toBeLessThan(0.05);
    const json = { generated: 'tests/unit/encounterDirector.test.ts', note: 'Region 1, column 3 of each stage, trainer Red, Standard. Party loss and win rates come from the playtest bot (docs/quality/playtest), not from these generation samples.', stages: reports };
    writeFileSync(new URL('../../docs/quality/encounter-director-report.json', import.meta.url), JSON.stringify(json, null, 1) + '\n');
    const rows = reports.flatMap((r) => (['wild', 'trainer'] as const).map((k) => {
      const s = r[k];
      return `| ${r.stage + 1} | ${k} | ${r.intendedLevels.join('–')} | ${Object.keys(s.levels).sort((a, b) => +a - +b).join(', ')} | ${s.samples} | ${s.species} | ${s.threatAvg} / ${s.threatMax} (budget ${s.budgetAvg}) | ${(s.rejectionRate * 100).toFixed(1)}% | ${s.fallbacks} | ${s.invalid} | ${s.lockedPicks} | ${(s.oneHitKoRate * 100).toFixed(2)}% |`;
    }));
    writeFileSync(
      new URL('../../docs/quality/encounter-director-report.md', import.meta.url),
      [
        '# Encounter Director report',
        '',
        `Written by \`tests/unit/encounterDirector.test.ts\` (part of \`npm run check\`): ${SAMPLES} wild and ${TRAINER_SAMPLES} trainer teams per early stage, region 1, column 3, trainer Red. Full numbers (level, rarity and evolution-stage spreads, top species) are in \`encounter-director-report.json\`.`,
        '',
        '| Stage | Source | Intended levels | Levels seen | Samples | Species | Threat avg / max | Draws rejected | Fallbacks | Invalid | Locked picks | One-hit KO |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|',
        ...rows,
        '',
        'One-hit KO = the foe\'s best attack at a max roll, neutral type, no crit, beats an all-70 Pokémon of the same level. Party loss and win rates are measured by the playtest bot (`node tools/playtest.ts`, `docs/quality/playtest/`), not here.',
        '',
      ].join('\n'),
    );
  }, 300_000);
});
