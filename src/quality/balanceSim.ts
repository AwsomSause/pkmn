// Seeded battle simulations for balance (M8.6). They play real battles with
// the game's own battle engine, with both sides picking moves the way a
// clever boss does, and report win rates. Same seed, same numbers.
//
// What they measure:
//   1. Species strength: fully evolved wild-line Pokémon, one on one, all at
//      the same level. Win rates near 100% or 0% point at outliers.
//   2. Difficulty curve: a fresh party (random wild-line Pokémon at the level
//      ordinary enemies have at that point, no items, no vitamins) against
//      every gym, Elite Four and champion slot of a full campaign.
// A real player has items, rewards, healing stops and a party they chose, so
// read the trend (where the curve jumps), not the exact percentages.
//
// Read-only: nothing here changes game rules or data.

import { chooseEnemyMove, createBattle, resolveTurn, type BattleContext } from '../core/battle/engine';
import type { Archetype, Content } from '../core/contentSchema';
import { createPlannedPokemon, evolvedFormAt, leagueScale, levelScale, planChampion, planEliteFour, planGymLeader, type TrainerPlan } from '../core/encounters';
import { createPokemon } from '../core/pokemon';
import { hashSeed, Rng } from '../core/rng';
import type { PokemonInstance } from '../core/state';
import { wildEligibleSpecies } from '../core/themes';

export interface BattleOutcome {
  winner: 'player' | 'enemy' | 'draw';
  turns: number;
}

/** How often the simulated player picks its best move rather than a random one. */
export const PLAYER_AI = 0.75;
const MAX_TURNS = 300;

/**
 * Plays one battle to the end. The player always attacks (no items or
 * switching except to replace a fainted Pokémon), choosing its move like a
 * boss with `PLAYER_AI`. The teams are copied, never changed.
 */
export function simulateBattle(content: Content, playerTeam: PokemonInstance[], enemyTeam: PokemonInstance[], enemyAi: number, seed: string): BattleOutcome {
  const party = structuredClone(playerTeam);
  const battle = createBattle('trainer', structuredClone(enemyTeam), 0, party[0]!.uid, { classId: 'sim', name: 'Sim', leaderId: null });
  battle.ai = enemyAi;
  const streams = hashSeed(seed);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(streams), captureRng: new Rng(hashSeed(`${seed}#capture`)), catchMultiplier: 1 };
  const choices = new Rng(hashSeed(`${seed}#player`));
  while (!battle.outcome && battle.turn <= MAX_TURNS) {
    if (battle.needsSwitch) {
      resolveTurn(ctx, { kind: 'switch', partyIndex: party.findIndex((p) => p.hp > 0) });
      continue;
    }
    const active = party[battle.activeIndex]!;
    const enemy = battle.enemyTeam[battle.enemyIndex]!;
    const index = chooseEnemyMove(active, choices, { content, ai: PLAYER_AI, target: enemy, stages: battle.playerStages });
    resolveTurn(ctx, { kind: 'move', index });
  }
  const winner = battle.outcome === 'win' ? 'player' : battle.outcome === 'lose' ? 'enemy' : 'draw';
  return { winner, turns: battle.turn - 1 };
}

/** The fully evolved form of every wild-eligible line at `level` (first branch when there are several). */
export function wildLines(content: Content, level: number): string[] {
  return [...new Set(wildEligibleSpecies(content).map((s) => evolvedFormAt(content, s.id, level)))].sort();
}

export interface SpeciesStrength {
  speciesId: string;
  wins: number;
  battles: number;
  winRate: number;
}

/** Each line fights `opponents` seeded random lines one on one, both at `level`. */
export function speciesStrength(content: Content, seed: string, level = 50, opponents = 40): SpeciesStrength[] {
  const lines = wildLines(content, level);
  const rng = new Rng(hashSeed(`${seed}#strength`));
  const mon = (id: string, uid: string) => createPokemon(content, id, level, uid);
  return lines.map((id) => {
    let wins = 0;
    for (let i = 0; i < opponents; i++) {
      const foe = rng.pick(lines);
      const result = simulateBattle(content, [mon(id, 'p')], [mon(foe, 'e')], 1, `${seed}#${id}#${i}`);
      if (result.winner === 'player') wins++;
    }
    return { speciesId: id, wins, battles: opponents, winRate: wins / opponents };
  });
}

export interface CurveRow {
  region: number;
  /** "gym 3", "Elite Four", "champion". */
  slot: string;
  /** Level of the simulated party, and the bosses' level range. */
  playerLevel: number;
  enemyLevels: [number, number];
  partySize: number;
  winRate: number;
  battles: number;
}

/** Party size at the run's `stageNumber`-th gym: three at the first gym, six from the fourth. */
export const partySizeAt = (stageNumber: number) => Math.min(6, 3 + stageNumber);

function randomParty(content: Content, pool: string[], size: number, level: number, rng: Rng, tag: string): PokemonInstance[] {
  return Array.from({ length: size }, (_, i) => createPokemon(content, evolvedFormAt(content, rng.pick(pool), level, rng), level, `${tag}-p${i}`));
}

function bossTeam(content: Content, plan: TrainerPlan, tag: string): PokemonInstance[] {
  return plan.members.map((m, i) => createPlannedPokemon(content, m, `${tag}-e${i}`));
}

/**
 * Win rates against every boss slot of a campaign (full by default): each gym
 * of each region, one Elite Four member and the champion. `trials` battles
 * per slot, each against a seeded random boss.
 */
export function difficultyCurve(content: Content, seed: string, trials = 40, campaignId = 'full'): CurveRow[] {
  const campaign = content.campaigns.get(campaignId)!;
  const archetype: Archetype = content.archetypes.get('red') ?? [...content.archetypes.values()][0]!;
  const regions = campaign.regularRegions + (campaign.grandRegion ? 1 : 0);
  const bosses = [...content.bosses.keys()].sort();
  const pool = wildEligibleSpecies(content).map((s) => s.id);
  const rows: CurveRow[] = [];
  const run = (region: number, slot: string, stageNumber: number, plan: (rng: Rng) => TrainerPlan, playerLevel: number) => {
    let wins = 0;
    let lo = Infinity;
    let hi = 0;
    const size = partySizeAt(stageNumber);
    for (let i = 0; i < trials; i++) {
      const tag = `${seed}#r${region}#${slot}#${i}`;
      const rng = new Rng(hashSeed(tag));
      const p = plan(rng);
      for (const m of p.members) (lo = Math.min(lo, m.level)), (hi = Math.max(hi, m.level));
      const party = randomParty(content, pool, size, playerLevel, rng, tag);
      if (simulateBattle(content, party, bossTeam(content, p, tag), p.ai, tag).winner === 'player') wins++;
    }
    rows.push({ region: region + 1, slot, playerLevel, enemyLevels: [lo, hi], partySize: size, winRate: wins / trials, battles: trials });
  };
  for (let r = 0; r < regions; r++) {
    for (let s = 0; s < campaign.stagesPerRegion; s++) {
      const stageNumber = r * campaign.stagesPerRegion + s;
      const scale = levelScale(content, campaign, r, s, campaign.columns);
      const playerLevel = curveLevel(content, scale);
      run(r, `gym ${s + 1}`, stageNumber, (rng) => planGymLeader(content, archetype, rng.pick(bosses), stageNumber, scale, rng), playerLevel);
    }
    const scale = leagueScale(content, r);
    const last = (r + 1) * campaign.stagesPerRegion;
    run(r, 'Elite Four', last, (rng) => planEliteFour(content, archetype, rng.pick(bosses), r, scale, rng), curveLevel(content, scale));
    run(r, 'champion', last, (rng) => planChampion(content, archetype, rng.pick(bosses), r, scale, rng), curveLevel(content, scale));
  }
  return rows;
}

/** The level an ordinary enemy has at this point of the curve, before variance and bonuses (the simulated party's level). */
function curveLevel(content: Content, scale: ReturnType<typeof levelScale>): number {
  const cfg = content.balance.difficulty;
  const level = Math.round(scale.start + (scale.end - scale.start) * Math.pow(scale.t, cfg.curve));
  return Math.max(cfg.minLevel, Math.min(scale.cap, cfg.maxLevel, level));
}

export interface BalanceReport {
  seed: string;
  strength: SpeciesStrength[];
  curve: CurveRow[];
}

export function buildBalanceReport(content: Content, seed: string, opts: { opponents?: number; trials?: number } = {}): BalanceReport {
  return { seed, strength: speciesStrength(content, seed, 50, opts.opponents), curve: difficultyCurve(content, seed, opts.trials) };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The report as Markdown (docs/quality/BALANCE_REPORT.md). */
export function balanceMarkdown(content: Content, report: BalanceReport): string {
  const name = (id: string) => content.species.get(id)?.name ?? id;
  const sorted = [...report.strength].sort((a, b) => b.winRate - a.winRate || a.speciesId.localeCompare(b.speciesId));
  const strong = sorted.filter((s) => s.winRate >= 0.9);
  const weak = sorted.filter((s) => s.winRate <= 0.1);
  const lines: string[] = [];
  lines.push('# Balance report (seeded battle simulations)', '');
  lines.push(`Made by \`npm run report:balance -- --write\` with seed \`${report.seed}\`. Same seed, same numbers. Read-only: nothing in the game was changed.`, '');
  lines.push('Both sides pick moves the way a clever boss does (the player picks its best move 3 times in 4). The simulated player uses no items, no vitamins and no healing, so a real run is easier than these numbers. Read the shape of the curve, not the exact percentages.', '');
  lines.push('## 1. Species strength', '');
  lines.push(`${report.strength.length} fully evolved wild lines at level 50, each in ${report.strength[0]?.battles ?? 0} one-on-one battles against random lines.`, '');
  lines.push(`- **${strong.length}** win 90% or more (possible outliers on the strong side).`);
  lines.push(`- **${weak.length}** win 10% or less (possible outliers on the weak side, often because most of their moves are not supported yet).`, '');
  lines.push('| Strongest | Win rate | Weakest | Win rate |', '|---|---|---|---|');
  const top = sorted.slice(0, 15);
  const bottom = sorted.slice(-15).reverse();
  const cell = (s: SpeciesStrength | undefined) => (s ? `${name(s.speciesId)} | ${pct(s.winRate)}` : ' | ');
  for (let i = 0; i < Math.max(top.length, bottom.length); i++) lines.push(`| ${cell(top[i])} | ${cell(bottom[i])} |`);
  lines.push('', '## 2. Difficulty curve (full campaign)', '');
  lines.push(`A fresh party of random wild-line Pokémon at the level ordinary enemies have at that point, against a random boss, ${report.curve[0]?.battles ?? 0} battles per row. Party size: 3 at the first gym, 6 from the fourth.`, '');
  lines.push('| Region | Battle | Party level | Boss levels | Party size | Player wins |', '|---|---|---|---|---|---|');
  for (const r of report.curve) lines.push(`| ${r.region} | ${r.slot} | ${r.playerLevel} | ${r.enemyLevels[0]}–${r.enemyLevels[1]} | ${r.partySize} | ${pct(r.winRate)} |`);
  lines.push('');
  return lines.join('\n');
}
