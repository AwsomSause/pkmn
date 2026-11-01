// Mass playtest: the smart test bot plays many full runs across trainers, modes, difficulties and modifiers.
// Each run is chosen from its index, so the same index always plays the same run.
//   node tools/playtest.ts <from> <count> [out.jsonl] [--heal]   append one JSON line per run (--heal: the bot heals on the map, so runs go deeper)
// Flags per run: `error` (an exception), `stuck` (no progress for a long time), `bad` (broken numbers such as NaN HP).
// Expeditions and minigames are not played by the bot; a run that reaches one is recorded as `skipped`.

import { appendFileSync } from 'node:fs';
import type * as Auto from '../tests/unit/autoplay.ts';
import type * as Rules from '../src/core/rules.ts';
import type * as Data from '../src/data/index.ts';
import type * as RngMod from '../src/core/rng.ts';
import type * as RunMod from '../src/core/run.ts';
import type * as Expedition from '../src/core/expedition/flow.ts';
import type * as Minigame from '../src/core/minigame/flow.ts';
import type * as Events from '../src/core/events.ts';
import type * as Services from '../src/core/services/flow.ts';
import type * as Plaza from '../src/core/plaza/flow.ts';
import { closeModules, loadModule } from './lib/gameModules.ts';
import { sideBot, type SideFinding } from './lib/sideBot.ts';

const { autoplay } = await loadModule<typeof Auto>('/tests/unit/autoplay.ts');
const { RUN_RULES, rulesProblem } = await loadModule<typeof Rules>('/src/core/rules.ts');
const { buildContent } = await loadModule<typeof Data>('/src/data/index.ts');
const { Rng, hashSeed } = await loadModule<typeof RngMod>('/src/core/rng.ts');
const sideMods = { run: await loadModule<typeof RunMod>('/src/core/run.ts'), exp: await loadModule<typeof Expedition>('/src/core/expedition/flow.ts'), mini: await loadModule<typeof Minigame>('/src/core/minigame/flow.ts'), events: await loadModule<typeof Events>('/src/core/events.ts'), services: await loadModule<typeof Services>('/src/core/services/flow.ts'), plaza: await loadModule<typeof Plaza>('/src/core/plaza/flow.ts'), auto: await loadModule<typeof Auto>('/tests/unit/autoplay.ts') };
await closeModules();

const content = buildContent();
const archetypes = [...content.archetypes.values()].filter((a) => a.available !== false).map((a) => a.id);
const modes = RUN_RULES.modes.filter((m) => m.status === 'supported').map((m) => m.id);
const difficulties = RUN_RULES.difficulties.map((d) => d.id);
const modifiers = RUN_RULES.modifiers.filter((m) => m.status === 'supported').map((m) => m.id);

const args = process.argv.filter((a) => !a.startsWith('--'));
const [from, count, out] = [Number(args[2] ?? 0), Number(args[3] ?? 5), args[4]];
const HEAL = process.argv.includes('--heal');
const SIDES = process.argv.includes('--sides');
const STEPS = 4000;
const STUCK_STEPS = 1500;

export function config(i: number) {
  const rng = new Rng(hashSeed(`playtest-${i}`));
  const pick = <T>(a: T[]) => a[rng.int(0, a.length - 1)]!;
  const modeId = modes[i % modes.length]!;
  const archetypeId = archetypes[i % archetypes.length]!;
  const difficultyId = difficulties[Math.floor(i / modes.length) % difficulties.length]!;
  let modifierIds: string[] = [];
  const n = pick([0, 0, 1, 1, 2]);
  for (let t = 0; t < 20 && modifierIds.length < n; t++) {
    const next = [...modifierIds, pick(modifiers)];
    if (rulesProblem({ modeId, difficultyId, modifierIds: next, deathBlock: false }) === null) modifierIds = next;
  }
  // Death-Block cannot be combined with a Nuzlocke mode (rulesProblem says so): only ask for it where it is allowed.
  const wantsBlock = rng.int(0, 4) === 0;
  const deathBlock = wantsBlock && rulesProblem({ modeId, difficultyId, modifierIds, deathBlock: true }) === null;
  return { i, seed: `pt${i}`, archetypeId, modeId, difficultyId, modifierIds, deathBlock };
}

for (let i = from; i < from + count; i++) {
  const cfg = config(i);
  const t0 = Date.now();
  const rec: Record<string, unknown> = { ...cfg, heal: HEAL };
  let steps = 0;
  let lastProgress = 0;
  let lastKey = '';
  const bad: string[] = [];
  const findings: SideFinding[] = [];
  const visits: Record<string, number> = {};
  const visit = SIDES ? sideBot(sideMods, content, new Set(), findings, visits) : null;
  try {
    const run = autoplay({
      seed: cfg.seed,
      archetypeId: cfg.archetypeId,
      rules: { modeId: cfg.modeId, difficultyId: cfg.difficultyId, modifierIds: cfg.modifierIds, deathBlock: cfg.deathBlock },
      steps: STEPS,
      smart: true,
      healOnMap: HEAL,
      onStep: (r0) => {
        const r = visit ? visit(r0) : r0;
        steps++;
        const key = `${r.encountersCompleted}|${r.phase}|${r.party.reduce((s, p) => s + p.level, 0)}|${r.badges.length}`;
        if (key !== lastKey) (lastKey = key), (lastProgress = steps);
        if (bad.length < 3) {
          if (!Number.isFinite(r.money) || r.money < 0) bad.push(`money ${r.money}`);
          for (const p of r.party) if (!Number.isFinite(p.hp) || p.hp < 0) bad.push(`hp ${p.speciesId} ${p.hp}`);
          for (const [k, v] of Object.entries(r.inventory)) if (!Number.isFinite(v) || v < 0) bad.push(`item ${k} ${v}`);
        }
        if (steps - lastProgress > STUCK_STEPS) throw new Error('STUCK');
        return r;
      },
    });
    Object.assign(rec, { phase: run.phase, encounters: run.encountersCompleted, badges: run.badges.length, region: run.regionIndex, party: run.party.length, maxLevel: Math.max(...run.party.map((p) => p.level)), by: run.log.defeatedBy, stage: run.stage?.index ?? null, wipes: run.rules.wipes, wins: run.log.counters.battlesWon ?? null, money: run.money, earned: run.log.counters.moneyEarned ?? 0, steps });
    if (run.phase !== 'over' && steps >= STEPS) rec.capped = true;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'STUCK') Object.assign(rec, { stuck: true, steps });
    else if (/does not enter (expeditions|minigames)/.test(msg)) Object.assign(rec, { skipped: msg, steps });
    else Object.assign(rec, { error: msg.slice(0, 200), stack: String((e as Error).stack).split('\n').slice(1, 4).join(' | ').slice(0, 300), steps });
  }
  if (bad.length) rec.bad = bad;
  if (findings.length) rec.sides = findings.slice(0, 5);
  if (SIDES) rec.visits = visits;
  rec.ms = Date.now() - t0;
  // `--strict` (CI): any crash, stuck run or broken number fails the process.
  if (process.argv.includes('--strict') && (rec.error || rec.stuck || rec.bad)) process.exitCode = 1;
  const line = JSON.stringify(rec);
  if (out) appendFileSync(out, line + '\n');
  else console.log(line);
}
