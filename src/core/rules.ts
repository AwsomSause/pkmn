// Game modes, difficulty, modifiers, Death-Block (Untitled doc §13–16, Phase E).
// The choices are copied into the run (`run.rules`) when it starts and never change; rewards use that snapshot.

import { regionRules, regionalChart } from './battle/typeRules';
import { z } from 'zod';
import rulesJson from '../data/runRules.json';
import type { Content, Ruleset, TypeName } from './contentSchema';
import { getSpecies, usableLearnset } from './pokemon';
import { applyMutator, MUTATORS } from './mutators';
import { hashSeed, Rng } from './rng';
import { poolTypes } from './runPrep';
import type { PokemonInstance, RunRules, RunState } from './state';
import { specialFamily } from './specialForms';
import { wildEligibleSpecies } from './themes';

const Status = z.enum(['supported', 'planned']);
export const RunRulesDataSchema = z.object({
  note: z.string(),
  ruleVersion: z.number().int().min(1),
  multiplierCap: z.number().min(1),
  /** Heat Levels (idea S176): opt-in stacking difficulty on top of the difficulty preset. */
  heat: z.object({ max: z.number().int().min(1), enemyLevelPerHeat: z.number().int().min(0), bonusPerHeat: z.number().min(0) }).default({ max: 10, enemyLevelPerHeat: 1, bonusPerHeat: 0.1 }),
  difficulties: z.array(z.object({ id: z.string(), name: z.string(), blurb: z.string(), multiplier: z.number().min(0), enemyLevelBonus: z.number().int(), /** Fraction of max HP every living Pokémon recovers after a won ordinary fight; fades to 0 over `winHeal.encounters`. */ winHeal: z.number().min(0).max(1).default(0) })).min(1),
  winHeal: z.object({ encounters: z.number().int().min(1) }).default({ encounters: 30 }),
  deathBlock: z.object({ battles: z.number().int().min(1), multiplier: z.number().min(0), rule: z.string() }),
  modifiers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: Status,
      bonus: z.number().min(0),
      blurb: z.string(),
      /** Modifiers in one group cannot be picked together (they would stack into the same part of the game). */
      group: z.string(),
      disables: z.array(z.enum(['mega', 'tera', 'zmove', 'dynamax'])).optional(),
      startScale: z.number().min(0).max(1).optional(),
      /** Every Pokémon you keep shares a type with your starter. */
      lockType: z.boolean().optional(),
      /** Wild and trainer Pokémon come from one generation picked from the seed. */
      lockGeneration: z.boolean().optional(),
      battleMoney: z.number().min(0).optional(),
      /** No Item Caps: bonus items stack to their full catalog limit instead of the capped one. */
      noItemCaps: z.boolean().optional(),
      enemyLevel: z.number().int().optional(),
      researchScale: z.number().min(0).optional(),
      blind: z.boolean().optional(),
      noRevives: z.boolean().optional(),
      randomDraft: z.boolean().optional(),
      campaignId: z.string().optional(),
      eventChance: z.number().min(0).optional(),
      partyCap: z.number().int().min(1).max(6).optional(),
      noDuplicates: z.boolean().optional(),
      /** Challenge Contracts: only Poké Balls can be used in battle. */
      noBattleItems: z.boolean().optional(),
      /** Challenge Contracts: healing stops on the map can't be used. */
      noHealStops: z.boolean().optional(),
      /** Challenge Contracts: nothing evolves (level-ups and evolution items). */
      noEvolution: z.boolean().optional(),
      /** Boss Remix (catalog #149): gym, Elite Four and champion teams come in a different order. */
      bossRemix: z.boolean().optional(),
      /** Speed Clear (catalog #101): an opt-in bonus for a quick trainer win. No timer, no penalty. */
      quickWin: z.object({ turns: z.number().int().min(1), money: z.number().int().min(1) }).optional(),
      /** Inverse Battle (S291): the type chart is reversed in every battle of the run. */
      inverseChart: z.boolean().optional(),
      /** Decades rule options: battle ruleset flags this modifier switches on (see Ruleset.frostbite / drowsy / normalFollowsUser). */
      /** Ability Pick: the Camp's Ability Capsule is free and unlimited, so every Pokémon can take any of its own abilities. */
      freeAbilities: z.boolean().optional(),
      rulesetFlags: z.object({ frostbite: z.boolean().optional(), drowsy: z.boolean().optional(), normalFollowsUser: z.boolean().optional() }).optional(),
      /** Elite Duelist (S275): every battle roll is the middle value (no crits, no lucky misses, fixed damage roll). */
      steady: z.boolean().optional(),
      gauntlet: z.boolean().optional(),
      doublesOnly: z.boolean().optional(),
      /** Pacifist (S300): wild Pokémon can't be knocked out; win by catching or running. */
      pacifist: z.boolean().optional(),
      /** Tag Team (S302): two players share one party at the same screen; the Pokémon in even party slots belong to Player 1, odd slots to Player 2. */
      tagTeam: z.boolean().optional(),
      /** Time Attack (S303): each trainer win in `turns` or fewer turns scores `(turns - taken + 1) * perTurn` points. */
      timeAttack: z.object({ turns: z.number().int().min(1), perTurn: z.number().int().min(1) }).optional(),
      /** Level 50 Cup (S290): the party's level cap for the whole run. */
      levelCap: z.number().int().min(1).optional(),
      /** Randomizer (S298): wild and ordinary trainer Pokémon are replaced by a random species (seeded; bosses keep theirs). */
      randomEncounters: z.boolean().optional(),
      /** Randomizer (S298): every Pokémon but boss teams gets a seeded random moveset (two of its own types, two of any). */
      randomMoves: z.boolean().optional(),
    }),
  ),
  /** What an unlock that is already owned (a set, a trainer, a title) pays instead (Untitled doc §8.3). */
  duplicateCompensation: z.object({ researchPoints: z.number().int().min(0) }),
  modeRewards: z.array(z.object({
    modeId: z.string(),
    id: z.string(),
    needs: z.object({ badges: z.number().int().optional(), loops: z.number().int().optional() }),
    claim: z.string(),
    once: z.object({ pool: z.string().optional(), trainer: z.string().optional(), title: z.string().optional(), bankCredits: z.number().int().optional(), text: z.string() }),
    repeat: z.object({ bankCredits: z.number().int().optional(), candies: z.number().int().optional(), text: z.string() }),
  })),
  modes: z.array(z.object({ id: z.string(), name: z.string(), status: Status, progressionEligible: z.boolean(), checkpoints: z.boolean(), wipeMoneyLoss: z.number().min(0).max(1).optional(), dailySeed: z.boolean().optional(), weeklySeed: z.boolean().optional(), loopLevelBonus: z.number().int().optional(), loopLimit: z.number().int().min(1).optional(), /** Endless Tower (S14): each new lap also takes a seeded curse (core/mutators.ts), so every floor climb gets harder. */ loopCurse: z.boolean().optional(), maxWipes: z.number().int().min(1).optional(), xpScale: z.number().positive().optional(), spookyChance: z.number().min(0).max(1).optional(), campaignId: z.string().optional(), bundles: z.array(z.string()).optional(), rewardScale: z.number().min(0).max(1).optional(), /** Nuzlocke / Modifier Run: added to the reward multiplier. */ rewardBonus: z.number().min(0).optional(), /** Nuzlocke rules (core/nuzlocke.ts). */ nuzlocke: z.enum(['standard', 'hardcore']).optional(), /** Modifier Run: a blessing/curse pick every N completed encounters (core/mutators.ts). */ mutatorEvery: z.number().int().min(1).optional(), /** Rule Draft: pick 1 of 3 run-wide rules once the starter is chosen (core/mutators.ts startRuleOffer). */ startDraft: z.boolean().optional(), /** Time Pressure (S20): the mode's reward bonus melts by `perDay` for every in-game day past `daysPerRegion` x regions entered (core/clock.ts timePressureTick). */ timePressure: z.object({ daysPerRegion: z.number().int().min(1), perDay: z.number().positive() }).optional(), blurb: z.string() })).min(1),
});
export const RUN_RULES = RunRulesDataSchema.parse(rulesJson);

export interface RulesChoice {
  modeId: string;
  difficultyId: string;
  modifierIds: readonly string[];
  deathBlock: boolean;
  /** Regional Circuit: the region to run (null or missing: picked by the seed). */
  regionId?: string | null;
  /** Set when the account rewards were already paid (a second Daily Run on the same day). */
  noRewards?: boolean;
  /** Weeks: false turns off the weekly and holiday event editions for this run (missing means on). */
  weeks?: boolean;
  /** Heat Level 0 to `RUN_RULES.heat.max` (missing means 0). */
  heat?: number;
}
export const STANDARD_CHOICE: RulesChoice = { modeId: 'standard', difficultyId: 'standard', modifierIds: [], deathBlock: false };

export const getMode = (id: string) => RUN_RULES.modes.find((m) => m.id === id);
export const getDifficulty = (id: string) => RUN_RULES.difficulties.find((d) => d.id === id);
export const getModifier = (id: string) => RUN_RULES.modifiers.find((m) => m.id === id);

/** Why a choice cannot start, or null. Planned modes and modifiers are listed but not playable. */
export function rulesProblem(choice: RulesChoice): string | null {
  const mode = getMode(choice.modeId);
  if (!mode) return `Unknown mode "${choice.modeId}"`;
  if (mode.status !== 'supported') return `${mode.name} is not available yet`;
  if (!getDifficulty(choice.difficultyId)) return `Unknown difficulty "${choice.difficultyId}"`;
  if (mode.nuzlocke && choice.deathBlock) return 'Death-Block cannot be used in a Nuzlocke (fainted Pokémon are lost for good)';
  if (new Set(choice.modifierIds).size !== choice.modifierIds.length) return 'A modifier is chosen twice';
  for (const id of choice.modifierIds) {
    const m = getModifier(id);
    if (!m) return `Unknown modifier "${id}"`;
    if (m.status !== 'supported') return `${m.name} is not available yet`;
  }
  const groups = choice.modifierIds.map((id) => getModifier(id)!.group);
  const clash = groups.find((g, i) => groups.indexOf(g) !== i);
  if (clash) return `Two modifiers of the same kind ("${clash}") cannot be combined`;
  return null;
}

/**
 * The reward multiplier: difficulty × (1 + the modifiers' bonuses), capped, then Death-Block's cut.
 * Adventure earns no account rewards, so its multiplier is 0 for them (it is 1 for in-run rewards, which are not multiplied).
 */
/** The Heat Level of a choice, clamped to the allowed range. */
export const heatOf = (choice: Pick<RulesChoice, 'heat'>): number => Math.max(0, Math.min(RUN_RULES.heat.max, Math.floor(choice.heat ?? 0)));

export function rewardMultiplier(choice: RulesChoice): number {
  const mode = getMode(choice.modeId);
  if (!mode?.progressionEligible || choice.noRewards) return 0;
  const difficulty = getDifficulty(choice.difficultyId)?.multiplier ?? 1;
  const bonus = choice.modifierIds.reduce((sum, id) => sum + (getModifier(id)?.bonus ?? 0), 0) + (mode.rewardBonus ?? 0);
  const capped = Math.min(RUN_RULES.multiplierCap, difficulty * (1 + bonus + heatOf(choice) * RUN_RULES.heat.bonusPerHeat));
  const scaled = capped * (mode.rewardScale ?? 1);
  const total = choice.deathBlock ? scaled * RUN_RULES.deathBlock.multiplier : scaled;
  return Math.round(total * 100) / 100;
}

/** The modifiers a run plays by: the mode's own bundle (Draft Lab's random draft, Research Expedition's scarce supplies...) and the player's. */
export const modeModifiers = (choice: Pick<RulesChoice, 'modeId' | 'modifierIds'>): string[] => [...new Set([...(getMode(choice.modeId)?.bundles ?? []), ...choice.modifierIds])];

/** The snapshot stored in the run. Throws on a choice that cannot start. */
export function makeRules(choice: RulesChoice): RunRules {
  const problem = rulesProblem(choice);
  if (problem) throw new Error(problem);
  return {
    ruleVersion: RUN_RULES.ruleVersion,
    modeId: choice.modeId,
    difficultyId: choice.difficultyId,
    modifierIds: modeModifiers(choice),
    deathBlock: choice.deathBlock,
    deathBlockUsed: false,
    weeks: choice.weeks !== false,
    progressionEligible: getMode(choice.modeId)!.progressionEligible && !choice.noRewards,
    rewardMultiplier: rewardMultiplier(choice),
    heat: heatOf(choice),
    enemyLevelBonus: getDifficulty(choice.difficultyId)!.enemyLevelBonus + heatOf(choice) * RUN_RULES.heat.enemyLevelPerHeat + choice.modifierIds.reduce((n, id) => n + (getModifier(id)?.enemyLevel ?? 0), 0),
    lockType: null,
    lockGeneration: null,
    regionId: getMode(choice.modeId)?.campaignId === 'regional-circuit' ? choice.regionId ?? null : null,
    loops: 0,
    wipes: 0,
  };
}

/** The same rules a run without a `rules` record always had. */
export const standardRules = (): RunRules => makeRules(STANDARD_CHOICE);

/** Transformations the modifiers switch off. */
export function disabledByRules(rules: RunRules): ('mega' | 'tera' | 'zmove' | 'dynamax')[] {
  return [...new Set(rules.modifierIds.flatMap((id) => getModifier(id)?.disables ?? []))];
}

/** Scales a starting amount (money, items) by the modifiers. */
export function startScale(rules: RunRules): number {
  return rules.modifierIds.reduce((s, id) => s * (getModifier(id)?.startScale ?? 1), 1);
}

/** Whether a checkpoint should be kept now: Adventure always, Death-Block until it is used or the first battles are over. */
export function wantsCheckpoint(run: Pick<RunState, 'rules' | 'encountersCompleted'>): boolean {
  if (getMode(run.rules.modeId)?.checkpoints) return true;
  return run.rules.deathBlock && !run.rules.deathBlockUsed && run.encountersCompleted < RUN_RULES.deathBlock.battles;
}

/** Account-level rewards are scaled by the snapshot's multiplier. */
export const scaleReward = (amount: number, rules: RunRules): number => Math.round(amount * rules.rewardMultiplier);

/** The lines shown before launch: what you are choosing and what it does to rewards. */
export function rulesLines(choice: RulesChoice): string[] {
  const mode = getMode(choice.modeId);
  const difficulty = getDifficulty(choice.difficultyId);
  const lines = [`Mode: ${mode?.name ?? choice.modeId} - ${mode?.blurb ?? ''}`, `Difficulty: ${difficulty?.name ?? choice.difficultyId} - ${difficulty?.blurb ?? ''}`];
  for (const id of getMode(choice.modeId)?.bundles ?? []) lines.push(`Mode rule: ${getModifier(id)?.name ?? id} - ${getModifier(id)?.blurb ?? ''}`);
  for (const id of choice.modifierIds) lines.push(`Modifier: ${getModifier(id)?.name ?? id} - ${getModifier(id)?.blurb ?? ''}`);
  lines.push(choice.weeks === false ? 'Weeks off: no weekly or holiday event rules, roamers or stops this run.' : 'Weeks on: this week\'s and any holiday event can apply to this run.');
  if (heatOf(choice) > 0) lines.push(`Heat ${heatOf(choice)}: enemies +${heatOf(choice) * RUN_RULES.heat.enemyLevelPerHeat} levels, rewards +${Math.round(heatOf(choice) * RUN_RULES.heat.bonusPerHeat * 100)}%.`);
  if (choice.deathBlock) lines.push(`Death-Block on: ${RUN_RULES.deathBlock.rule}`);
  lines.push(mode?.progressionEligible ? `Reward multiplier: x${rewardMultiplier(choice).toFixed(2)}` : 'No Bank Credits, Research Points, candies, unlocks or achievements in this mode.');
  return lines;
}

// ---------- what each modifier does ----------

const has = (rules: Pick<RunRules, 'modifierIds'>, pick: (m: NonNullable<ReturnType<typeof getModifier>>) => unknown) => rules.modifierIds.some((id) => pick(getModifier(id)!));
const product = (rules: Pick<RunRules, 'modifierIds'>, pick: (m: NonNullable<ReturnType<typeof getModifier>>) => number | undefined) =>
  rules.modifierIds.reduce((n, id) => n * (pick(getModifier(id)!) ?? 1), 1);

export const blindMap = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.blind);
export const noItemCaps = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.noItemCaps);
export const freeAbilities = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.freeAbilities);
export const noRevives = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.noRevives);
export const noBattleItems = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.noBattleItems);
/** The No Evolution contract is on. */
export const noEvolution = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.noEvolution);
/** Boss Remix is on. */
/** The Speed Clear bonus for a trainer win (0 when the modifier is off or the win was slow). */
export const quickWinBonus = (rules: Pick<RunRules, 'modifierIds'>, turnsTaken: number): number =>
  rules.modifierIds.reduce((sum, id) => {
    const q = getModifier(id)?.quickWin;
    return sum + (q && turnsTaken <= q.turns ? q.money : 0);
  }, 0);
/** Time Attack points for a trainer win that took `turnsTaken` turns (0 when the modifier is off or the win was slow). */
export const timeAttackPoints = (rules: Pick<RunRules, 'modifierIds'>, turnsTaken: number): number =>
  rules.modifierIds.reduce((sum, id) => {
    const t = getModifier(id)?.timeAttack;
    return sum + (t && turnsTaken <= t.turns ? (t.turns - Math.max(1, turnsTaken) + 1) * t.perTurn : 0);
  }, 0);
export const bossRemix = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.bossRemix);
/** Elite Duelist (S275) is on: battles use a steady roll instead of the battle stream. */
export const eliteDuelist = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.steady);
/** Inverse Battle is on. */
export const inverseChart = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.inverseChart);
/** The tightest run-wide level cap a modifier sets (Level 50 Cup), or null. */
export const modifierLevelCap = (rules: Pick<RunRules, 'modifierIds'>): number | null =>
  rules.modifierIds.reduce<number | null>((cap, id) => { const c = getModifier(id)?.levelCap; return c === undefined ? cap : cap === null ? c : Math.min(cap, c); }, null);
/** The Decades ruleset flags the run's modifiers switch on. */
export const rulesetFlagsOf = (rules: Pick<RunRules, 'modifierIds'>): Partial<Pick<Ruleset, 'frostbite' | 'drowsy' | 'normalFollowsUser'>> =>
  Object.assign({}, ...rules.modifierIds.map((id) => getModifier(id)?.rulesetFlags ?? {}).map((f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v))));
const battleContents = new WeakMap<object, Map<string, Content>>();
/**
 * Content as the battle engine should see it: with Inverse Battle the type chart is reversed (2 -> 0.5, 0.5 and 0 -> 2);
 * a region with its own type rules (S156, balance `typeRules.regions`) tweaks the chart first. Cached, pure.
 */
export function battleContent(content: Content, rules: Pick<RunRules, 'modifierIds'>, regionId?: string | null): Content {
  const inverse = inverseChart(rules);
  const local = regionRules(content, regionId);
  const flags = rulesetFlagsOf(rules);
  const flagKey = Object.keys(flags).sort().join(',');
  if (!inverse && local.length === 0 && !flagKey) return content;
  const key = `${inverse ? 'inv' : ''}|${local.length ? regionId : ''}|${flagKey}`;
  let cache = battleContents.get(content);
  if (!cache) battleContents.set(content, (cache = new Map()));
  const cached = cache.get(key);
  if (cached) return cached;
  let typeChart = regionalChart(content.typeChart, local);
  if (inverse) {
    const flipped: Content['typeChart'] = {} as Content['typeChart'];
    for (const [atk, row] of Object.entries(typeChart)) {
      flipped[atk as keyof typeof flipped] = Object.fromEntries(Object.entries(row ?? {}).map(([def, v]) => [def, v > 1 ? 0.5 : v < 1 ? 2 : v])) as never;
    }
    typeChart = flipped;
  }
  const out = { ...content, typeChart, ruleset: flagKey ? { ...content.ruleset, ...flags } : content.ruleset };
  cache.set(key, out);
  return out;
}
/** Gauntlet (S294): no healing stops, and no free heal at the League gate or between Elite Four fights. */
export const gauntlet = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.gauntlet);
/** Doubles Only (S292): every fight that can be a double battle is one. */
export const doublesOnly = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.doublesOnly);
/** Pacifist (S300): wild Pokémon are never knocked out by damage. */
/** Tag Team (S302): who commands the Pokémon in party slot `index` ("Player 1" for slots 1, 3, 5; "Player 2" for 2, 4, 6), or null when the rule is off. */
export const tagPilot = (rules: Pick<RunRules, 'modifierIds'>, index: number): string | null => (has(rules, (m) => m.tagTeam) ? `Player ${(index % 2) + 1}` : null);
export const pacifist = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.pacifist);
export const noHealStops = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.noHealStops || m.gauntlet);
export const battleMoneyScale = (rules: Pick<RunRules, 'modifierIds'>): number => product(rules, (m) => m.battleMoney);
export const researchScale = (rules: Pick<RunRules, 'modifierIds'>): number => product(rules, (m) => m.researchScale);
export const eventChanceScale = (rules: Pick<RunRules, 'modifierIds'>): number => product(rules, (m) => m.eventChance);
export const wantsRandomDraft = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.randomDraft);
export const wantsGenerationLock = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.lockGeneration);
export const wantsTypeLock = (rules: Pick<RunRules, 'modifierIds'>): boolean => has(rules, (m) => m.lockType);
/** A modifier's own campaign (Boss Rush), or null. */
/** The campaign a mode or modifier forces (Quick Route), or null. */
export const rulesCampaign = (choice: Pick<RulesChoice, 'modifierIds'> & { modeId?: string }): string | null => (choice.modeId ? getMode(choice.modeId)?.campaignId : undefined) ?? choice.modifierIds.map((id) => getModifier(id)?.campaignId).find(Boolean) ?? null;

/** True when a run on this campaign still counts for the account: normal campaigns, or the campaign a mode brings. */
export const campaignCounts = (campaign: { id: string; countsForProgress: boolean }, modeId: string): boolean => campaign.countsForProgress || getMode(modeId)?.campaignId === campaign.id;

/** How many Pokémon the party may hold. */
export function partyCap(content: Content, rules: Pick<RunRules, 'modifierIds'>): number {
  return rules.modifierIds.reduce((cap, id) => Math.min(cap, getModifier(id)?.partyCap ?? cap), content.balance.partyMax);
}

/** The first evolution stage of a species (the "line" for No Duplicate Species). */
function lineRoot(content: Content, speciesId: string): string {
  let id = speciesId;
  for (let guard = 0; guard < 6; guard++) {
    const from = [...content.species.values()].find((s) => s.evolutions.some((e) => e.to === id));
    if (!from) return id;
    id = from.id;
  }
  return id;
}

/** Why a Pokémon cannot join the party under this run's modifiers, or null. */
export function joinProblem(content: Content, run: Pick<RunState, 'rules' | 'party'>, speciesId: string, replacing?: string): string | null {
  const species = getSpecies(content, speciesId);
  if (run.rules.lockType && !species.types.includes(run.rules.lockType as TypeName)) return `Monotype: only ${run.rules.lockType}-type Pokémon can join`;
  if (has(run.rules, (m) => m.noDuplicates)) {
    const root = lineRoot(content, speciesId);
    if (run.party.some((p) => p.uid !== replacing && lineRoot(content, p.speciesId) === root)) return 'No Duplicate Species: you already have this line';
  }
  return null;
}

/** The generation of a Single Region Dex run: a seeded pick among generations with plenty of wild Pokémon. */
export function pickGeneration(content: Content, seed: string): number {
  const counts = new Map<number, number>();
  for (const s of wildEligibleSpecies(content)) counts.set(s.generation, (counts.get(s.generation) ?? 0) + 1);
  const gens = [...counts].filter(([, n]) => n >= 40).map(([g]) => g).sort((a, b) => a - b);
  return gens[new Rng(hashSeed(`${seed}::generation`)).int(0, gens.length - 1)]!;
}

/** A species outside the locked generation is swapped for one of the same type from inside it (seeded by `key`, never a gameplay stream). */
export function lockSpecies(content: Content, run: Pick<RunState, 'rules' | 'seed'>, speciesId: string, key: string): string {
  const gen = run.rules.lockGeneration;
  if (has(run.rules, (m) => m.randomEncounters)) return randomSpecies(content, run, key);
  const species = getSpecies(content, speciesId);
  if (!gen || species.generation === gen) return speciesId;
  const inside = wildEligibleSpecies(content).filter((s) => s.generation === gen);
  const same = inside.filter((s) => s.types.some((t) => species.types.includes(t)));
  const pool = same.length > 0 ? same : inside;
  return pool[new Rng(hashSeed(`${run.seed}::genlock::${key}`)).int(0, pool.length - 1)]!.id;
}

/** Randomizer (S298): any wild-eligible species (inside the locked generation, if any), seeded by the run and `key` (never a gameplay stream). */
export function randomSpecies(content: Content, run: Pick<RunState, 'rules' | 'seed'>, key: string): string {
  const gen = run.rules.lockGeneration;
  const all = wildEligibleSpecies(content);
  const pool = gen ? all.filter((s) => s.generation === gen) : all;
  return pool[new Rng(hashSeed(`${run.seed}::random-enc::${key}`)).int(0, pool.length - 1)]!.id;
}

/** Randomizer (S298): a random moveset for `mon` (two damaging moves of its own types when any exist, then two of any type). Mutates `mon`. */
export function randomizeMoves(content: Content, run: Pick<RunState, 'rules' | 'seed'>, mon: PokemonInstance): void {
  if (!has(run.rules, (m) => m.randomMoves)) return;
  const usable = [...content.moves.values()].filter((m) => m.supported && m.power !== null && m.power >= 30 && m.power <= 95 && !m.flags.some((f) => f === 'zmove' || f === 'max' || f === 'megasig' || f === 'storysig')).sort((a, b) => a.id.localeCompare(b.id));
  if (usable.length < 4) return;
  const rng = new Rng(hashSeed(`${run.seed}::random-moves::${mon.uid}`));
  const own = getSpecies(content, mon.speciesId).types;
  const stab = usable.filter((m) => own.includes(m.type));
  const picked: string[] = [];
  const take = (list: typeof usable) => {
    const left = list.filter((m) => !picked.includes(m.id));
    if (left.length > 0) picked.push(left[rng.int(0, left.length - 1)]!.id);
  };
  take(stab); take(stab); take(usable); take(usable);
  mon.moves = picked.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
}

/** Random Draft: a draft rule with no license, picked from the seed (a Type Focus rule also gets a type from the pool). */
export function randomDraft(content: Content, seed: string, prep: { poolId: string }): { draftRuleId: string; typeFocus: TypeName | null } {
  const rules = [...content.draftRules.values()].filter((r) => r.license === null && r.kind !== 'blind');
  const rng = new Rng(hashSeed(`${seed}::random-draft`));
  const rule = rules[rng.int(0, rules.length - 1)]!;
  const types = rule.kind === 'typeFocus' ? poolTypes(content, content.starterPools.get(prep.poolId)!) : [];
  return { draftRuleId: rule.id, typeFocus: types.length > 0 ? types[rng.int(0, types.length - 1)]! : null };
}

// ---------- Daily Run, Endless, Spooky ----------

/** The Daily Run seed: the UTC date, so everyone gets the same run on the same day. */
export const dailySeed = (isoDate: string): string => `daily-${isoDate.slice(0, 10)}`;
/** The claim-ledger key that says the day's account rewards were paid. */
export const dailyClaimKey = (isoDate: string): string => `daily:${isoDate.slice(0, 10)}`;

/**
 * Endless: when the last champion falls, add another lap of the regions instead of winning (mutates `run`).
 * Returns false in any other mode. Enemies get stronger every lap.
 */
export function extendEndless(run: Pick<RunState, 'rules' | 'regionOrder'> & Partial<Pick<RunState, 'seed' | 'mutators'>>): boolean {
  const mode = getMode(run.rules.modeId);
  const bonus = mode?.loopLevelBonus;
  // The configured endpoint: after the last lap the run is won like any other.
  if (!bonus || run.rules.loops >= (mode?.loopLimit ?? Infinity)) return false;
  const lap = run.regionOrder.length / (run.rules.loops + 1);
  run.regionOrder.push(...run.regionOrder.slice(0, lap));
  run.rules.loops += 1;
  run.rules.enemyLevelBonus += bonus;
  // Endless Tower: every lap also adds a curse (seeded by the run and the lap, never the gameplay stream).
  if (mode?.loopCurse) {
    const curses = MUTATORS.mutators.filter((m) => m.kind === 'curse' && (m.enemyLevel ?? 0) > 0);
    const curse = new Rng(hashSeed(`${run.seed ?? ''}::tower::${run.rules.loops}`)).pick(curses);
    applyMutator(run as RunState, curse.id);
  }
  return true;
}

/**
 * Spooky mode, the Hex Maniac and Spooky Season: some wild Pokémon turn into Spooky forms (seeded by the run and
 * the stop, so a reload gives the same one). `extraChance` is the trainer's and the event's spookyEncounters share.
 */
export function spookyWild(content: Content, run: Pick<RunState, 'rules' | 'seed'>, speciesId: string, key: string, extraChance = 0): string {
  const chance = Math.min(1, (getMode(run.rules.modeId)?.spookyChance ?? 0) + extraChance);
  if (!chance) return speciesId;
  const rng = new Rng(hashSeed(`${run.seed}::spooky::${key}`));
  if (!rng.chance(chance)) return speciesId;
  const forms = [...content.species.values()].filter((s) => specialFamily(s) === 'spooky');
  return forms.length > 0 ? forms[rng.int(0, forms.length - 1)]!.id : speciesId;
}

// ---------- the gentle opening ----------

/** The first fights of a run are against weaker wild Pokémon, so a lone starter is not coin-flipped out of the run. Seeded by the run and the node. */
export function openingWild(content: Content, run: Pick<RunState, 'seed' | 'encountersCompleted' | 'rules'>, speciesId: string, level: number, key: string): { speciesId: string; level: number } {
  const o = content.balance.opening;
  if (run.encountersCompleted >= o.encounters) return { speciesId, level };
  const bst = (id: string) => Object.values(getSpecies(content, id).baseStats).reduce((a, b) => a + b, 0);
  let id = speciesId;
  if (bst(id) > o.maxBaseStats) {
    const gen = run.rules.lockGeneration;
    const inGen = (s: { generation: number }) => !gen || s.generation === gen;
    const pool = wildEligibleSpecies(content).filter((s) => inGen(s) && bst(s.id) <= o.maxBaseStats && s.types.some((t) => getSpecies(content, speciesId).types.includes(t)));
    const any = pool.length > 0 ? pool : wildEligibleSpecies(content).filter((s) => inGen(s) && bst(s.id) <= o.maxBaseStats);
    id = any[new Rng(hashSeed(`${run.seed}::opening::${key}`)).int(0, any.length - 1)]!.id;
  }
  return { speciesId: id, level: Math.max(o.minLevel, level - o.levelOffset) };
}

/**
 * Low-level enemies do not carry fixed-damage or one-hit-KO moves (Dragon Rage's 40 damage knocks out any level 5 Pokémon in one hit).
 * Such a move is swapped for the species' best damaging level-up move it does not already know, or just dropped. Mutates `mon`.
 */
export function softenOpeningMoves(content: Content, mon: PokemonInstance): void {
  const o = content.balance.opening;
  if (mon.level > o.softMovesUntilLevel) return;
  const harsh = (id: string) => {
    const e = content.moves.get(id)?.effects as { fixedDamage?: unknown; ohko?: unknown } | undefined;
    return typeof e?.fixedDamage === 'number' || e?.ohko !== undefined;
  };
  if (!mon.moves.some((m) => harsh(m.id))) return;
  const species = getSpecies(content, mon.speciesId);
  const spare = usableLearnset(content, species)
    .filter((e) => e.level <= mon.level && !harsh(e.move) && !mon.moves.some((m) => m.id === e.move) && (content.moves.get(e.move)?.power ?? 0) > 0)
    .map((e) => e.move);
  mon.moves = mon.moves.flatMap((m) => {
    if (!harsh(m.id)) return [m];
    const next = spare.pop();
    return next ? [{ id: next, pp: content.moves.get(next)!.pp }] : [];
  });
  if (mon.moves.length === 0) mon.moves = [{ id: 'tackle', pp: content.moves.get('tackle')?.pp ?? 35 }];
}

/**
 * Second wind: after a won wild or ordinary trainer fight, each living Pokémon recovers a share of its max HP. The share is the
 * difficulty's `winHeal`, fading to nothing over the run's first `winHeal.encounters` fights. Derived from the run's difficulty and
 * progress only (no stored state, no RNG), so saves and replays are unchanged.
 */
export function winHealFraction(run: Pick<RunState, 'rules' | 'encountersCompleted'>): number {
  const base = getDifficulty(run.rules.difficultyId)?.winHeal ?? 0;
  return base * Math.max(0, 1 - run.encountersCompleted / RUN_RULES.winHeal.encounters);
}
