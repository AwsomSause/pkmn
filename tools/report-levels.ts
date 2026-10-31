// Level-curve check (left-out plan 1.6): walks a full campaign with the game's own
// level curve, stage caps and EXP formulas, and prints where a lead Pokémon that
// wins every battle would sit against the enemies, stage by stage. No battles are
// played, so it only checks that the EXP numbers can keep up with the caps; the
// playtest bot checks the rest.
//
//   node tools/report-levels.ts [campaign] [--check]   (--check exits 1 if the lead falls more than 10 levels behind)
//   --step N --max N --xp N --high N                   try other balance.difficulty numbers without editing the data
//
// Read-only: it never changes the game data.

import type * as Data from '../src/data/index.ts';
import type * as Regions from '../src/core/regions.ts';
import type * as Encounters from '../src/core/encounters.ts';
import type * as Pokemon from '../src/core/pokemon.ts';
import { closeModules, loadModule } from './lib/gameModules.ts';

const { getContent } = await loadModule<typeof Data>('/src/data/index.ts');
const { getCampaign, levelCap, stageLevelCap } = await loadModule<typeof Regions>('/src/core/regions.ts');
const { levelScale, leagueScale } = await loadModule<typeof Encounters>('/src/core/encounters.ts');
const { xpForDefeat, xpForLevel, levelFromXp } = await loadModule<typeof Pokemon>('/src/core/pokemon.ts');
await closeModules();

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : undefined;
};
const base = getContent();
const d = base.balance.difficulty;
const difficulty = { ...d, levelCapStep: option('--step') ?? d.levelCapStep, maxLevel: option('--max') ?? d.maxLevel, xpScale: option('--xp') ?? d.xpScale, highLevelXp: option('--high') ?? d.highLevelXp };
const content = { ...base, balance: { ...base.balance, difficulty } };
const campaign = getCampaign(content, args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'full');
const cfg = content.balance.difficulty;
const regions = campaign.regularRegions + (campaign.grandRegion ? 1 : 0);
// A stage as the design lays it out: 13 wild Pokémon, 2 trainers of 3, a gym leader of 4 (median base EXP 120 wild, 160 trainer).
const STAGE: { exp: number; mons: number; bonus: number }[] = [...Array(13).fill({ exp: 120, mons: 1, bonus: 0 }), { exp: 160, mons: 3, bonus: cfg.trainerBonus }, { exp: 160, mons: 3, bonus: cfg.trainerBonus }, { exp: 160, mons: 4, bonus: cfg.gymBonus }];
const rate = 'medium-fast';
const { maxLevel, highLevelXp, xpScale } = cfg;

let xp = xpForLevel(rate, 5, highLevelXp);
const lead = () => levelFromXp(rate, xp, maxLevel, highLevelXp);
let worst = 0;
const rows: string[] = ['| Region | Cap | Stage 2 enemy / lead | Stage 4 | Stage 6 | Stage 8 | League enemy / lead |', '|---|---|---|---|---|---|---|'];
for (let r = 0; r < regions; r++) {
  const cells: string[] = [];
  for (let s = 0; s < campaign.stagesPerRegion; s++) {
    const cap = stageLevelCap(content, campaign, r, s);
    STAGE.forEach((fight, i) => {
      const column = 1 + Math.floor((i * campaign.columns) / STAGE.length);
      const sc = levelScale(content, campaign, r, s, column);
      const enemy = Math.min(sc.cap, Math.round(sc.start + (sc.end - sc.start) * Math.pow(sc.t, cfg.curve)) + fight.bonus);
      for (let k = 0; k < fight.mons; k++) xp = Math.min(xp + xpForDefeat(fight.exp, enemy, lead(), xpScale), Math.max(xp, xpForLevel(rate, cap, highLevelXp)));
    });
    const sc = levelScale(content, campaign, r, s, campaign.columns);
    const enemy = Math.round(sc.start + (sc.end - sc.start) * Math.pow(sc.t, cfg.curve));
    worst = Math.min(worst, lead() - enemy);
    if (s % 2 === 1) cells.push(`${enemy} / ${lead()}`);
  }
  const league = leagueScale(content, r);
  for (let k = 0; k < 5 * 5; k++) xp = Math.min(xp + xpForDefeat(160, league.end + cfg.eliteFourBonus, lead(), xpScale), Math.max(xp, xpForLevel(rate, levelCap(content, r), highLevelXp)));
  rows.push(`| ${r + 1} | ${levelCap(content, r)} | ${cells.join(' | ')} | ${Math.min(league.cap, league.end + cfg.championBonus)} / ${lead()} |`);
}
console.log(`Level curve, ${campaign.name}: cap step ${cfg.levelCapStep}, max level ${maxLevel}, EXP x${xpScale}, above-100 cost ${highLevelXp}`);
console.log(rows.join('\n'));
console.log(`Worst gap (lead minus stage-end enemy): ${worst}`);
if (args.includes('--check') && worst < -10) {
  console.error('The lead falls more than 10 levels behind the curve.');
  process.exit(1);
}
