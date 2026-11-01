// The run "state machine". Every player action is a function that takes the
// current run state and returns a NEW run state (the old one is untouched),
// plus whatever the screens need to show what happened.
//
// Phases:  starter → map → battle → (decision) → reward → (decision) → map → ... → over
//   map      = choose the next node on the stage map (or visit a healing stop / shop beside the current one)
//   shop     = buying items at a shop stop
//   decision = choices the player must make: learning a move, or what to do
//              with a caught Pokémon.
// Beating the gym leader at the end of a stage moves the run to a new stage
// with a new theme. After the region's last stage comes its Pokémon League
// (Elite Four, then the champion); beating the champion moves the run to the
// next region, or wins the run after the last one.

import { makeShadow, rollShadowHeart, soothePartyAfterBattle } from './shadow';
import { advanceShadowWorld, addFlag, gangNotes, gangRaidWon, liberatedHpDiscount, outbreakShadow, placeGangDen } from './shadowWorld/world';
import { blissfulAfterBattle, blissfulAtRest } from './shadowWorld/blissful';
import { wildCatchMultiplier } from './wildBehavior';
import { interruptFlag, interruptingRival } from './rivals/interrupt';
import { captureMultiplier, getArchetype, runArchetype, runPerks, healingMultiplier, moneyMultiplier, priceMultiplier, shopUnlockOffset, trainerPreviews, typeModifiers, xpMultiplier } from './archetypes';
import { chooseSignatureOption, signatureDecisions } from './signature';
import { boxCapacity, catchLevelOffset, encounterWeightPerk, partyLimit, postBattleHealShare, hasStarterSignature, releaseLimit, signatureMoveFor, evolutionLevelOffset, isBossClass, regionLevelOffset, startingAttributes, startingLevelOffset, syncHpPerks, xpPerk, bossMoneyPerk, championMoneyPerk, ordinaryMoneyPerk, catchMoneyPerk, doubleBattleRewardPerk, singleBattleXpPerk, shopEarlyStockPerk, shopEarlyRareStockPerk, shopRefreshPerk, thirdBossLevels, isUltraBeast, fishingRareTriesPerk, bonusRewardChancePerk } from './trainerPerks';
import { createBattle, resolveTurn, startBattle, type BattleContext, type BattleEvent, type PlayerAction } from './battle/engine';
import { autoCommands, canBeDoubles, makeDoubles, primarySpot, resolveDoublesTurn, startDoubles } from './battle/doubles';
import { endBattle as endHeldBattle, expMultiplier, giveBossItems, growthOnLevelUp } from './battle/held';
import { bossMechanics, revertTransformations } from './battle/transform';
import { RARITIES, TYPE_NAMES, type AttributeKey, type Content, type TypeName } from './contentSchema';
import { auditEncounter, directSpecies } from './encounterDirector';
import {
  curveLevel,
  bossTeamSpecies,
  candiesForRelease,
  CHAMPION_CLASS,
  enemyLevel,
  rollShiny,
  ELITE_FOUR_CLASS,
  GYM_LEADER_CLASS,
  createPlannedPokemon,
  leagueScale,
  levelScale,
  planChampion,
  planEliteFour,
  planGymLeader,
  planFirstRival,
  planTrainer,
  planWild,
  type TrainerPlan,
  rollLegendaryWild,
  withPartyStrength,
} from './encounters';
import { evolveFully, type EvolutionResult } from './evolution';
import { changeFriendship } from './friendship';
import { addItem, applyItemToPokemon, consumeItem, getItem, itemCount, itemUseProblem } from './items';
import { addLevels, createPokemon, gainXp, getSpecies, MAX_PP_UPS, maxHp, maxPp, xpForDefeat, xpForLevel } from './pokemon';
import { bankShopEntries, runLicenses } from './bank';
import { withTokenAttribute } from './runPrep';
import { applyReward, generateDraft, rewardTargetProblem, type RewardResult } from './rewards';
import { pickRunQuest } from './quests';
import { masteredStarters, runMasteryPerks } from './mastery';
import { gameEventModifiers } from './gameEvents';
import { blackMarketMarkup, fieldResearchMoney, spookyEncounterChance, voiceAsksToJoin } from './trainerEvolution';
import { growGarden } from './berries';
import { layEgg, tickEggs } from './eggs';
import { addEventStops, continueEventChain, eventBattleWon, eventChainNext, eventGymPreview } from './events';
import { advanceRoamers, convoyStep, applyFrontWeather, spawnRoamers } from './world';
import { currentColumn, findNode, generateLeagueMap, generateStageMap, nextChoices, validateLeagueMap, validateStageMap } from './map';
import { addItemAttribute, addRunAttribute, attributeText, luckWeights, readAttributes, runAttributeEffects, zeroAttributes } from './attributes';
import { count, countShiny, discover } from './progress';
import { passivePercent } from './catalog';
import { defaultPrep, draftStarters, startingResources, withSignatureStarter } from './runPrep';
import { currentRegion, generateRegionOrder, getCampaign, pickLeague, runLevelCap } from './regions';
import { expShareUnlocked, FIRST_RIVAL_FLAG } from './firstRival';
import {
  activeMods,
  addBridgeStops,
  addItemStops,
  afterPurchase,
  afterTrainerWin,
  earlyStockCount,
  fishingRod,
  hiddenItemFound,
  catchDrop,
  palPadLevels,
  hiddenItemNode,
  hasPerk,
  mapItemRng,
  activePerks,
  markUsedThisStage,
  perksOf,
  perkItem,
  type MapItemRun,
  priceMultiplierFromItems,
  prizeMoneyFromItems,
  regionMoneyFromItems,
  repelActive,
  spendUse,
  stageKey,
  startStageEffects,
  usedThisStage,
  usesLeft,
  throwMultiplier,
  useRepel,
  useThrowCharges,
  useUses,
  useWildBattleCharges,
  voucherOf,
  wildBattleSetup,
  wildExpMultiplier,
  wildLevelBonus,
  wildShinyMultiplier,
  wildSpeciesWithItems,
} from './mapItems';
import { pickRaidRival } from './raid/rivalAlly';
import { RAID_MEMORY_FRIENDSHIP, RETURNING_HP_PERCENT, RETURNING_LEVEL_BONUS, cheerLevelFor, pickApproach, raidMemories, applyBossHp, describeMechanics, describeRewards, freshRaidBattle, getRaid, placeRaidDens, raidDef, raidLevel, raidSpecies, type RaidPreview } from './raid/raid';
import { applyBossAbility, raidBadgeLevel, scaledRaid } from './raid/scaling';
import type { RaidApproach, RaidDef } from './raid/schema';
import { placeExpeditionGate } from './expedition/gate';
import { placeLegendaryGate } from './legendary/legendary';
import { pickStones } from './expedition/flow';
import { gainBattleMaterials, RARE_TOKEN_EFFECTS } from './crafting';
import { minigameDiscount, placeMinigameStop } from './minigame/gate';
import { placeServiceStop } from './services/gate';
import { placePlaza } from './plaza/gate';
import { noteFoe, plazaClubLost, plazaClubWon } from './plaza/flow';
import { allyLevel, applyTotemHp, describeAlly, describeTotemRewards, freshTotemBattle, getTotem, placeTotem, totemLevel, totemSpecies, type TotemPreview } from './totem/totem';
import type { TotemDef } from './totem/schema';
import { createStreams, hashSeed, Rng, withStream } from './rng';
import { currentEnemy, type BattleState, type MapNode, type SideStop, type RunPrep, type PastPokemon, type PendingDecision, type PokemonInstance, type Profile, type RunState, type StageState, freshPlaza } from './state';
import { itemSlotLimit } from './trainerPerks';
import { applyTrainerTier, readTrainerMemory } from './trainerTiers';
import { getTheme, pickGymLeader, pickTheme, typesPool, wildEligibleSpecies } from './themes';
import {
  ensureHistories,
  recordBattleStarted,
  recordBattleTurn,
  recordCaught,
  recordChanges,
  recordReleased,
  recordRewardTaken,
  recordRouteChosen,
  recordRunStarted,
} from './story/hooks';
import { buildHyperContext } from './story/hyper';
import type { PresentationCue } from './story/queue';
import { withTrainingEvolution, midBattleEvolution } from './drama/evolution';
import { styleTrick } from './rivals/tricks';
import { dueNarrativeDefeat, foreshadowNote, getNarrativeDef, narrativeWon, recordNarrativeDefeat } from './rivals/narrativeDefeat';
import { rivalBond } from './drama/bond';
import { recapLines } from './drama/recap';
import { bondEvolves, bondLessons, bondVictory, enemyCombo, playerCombo, revealMove, shapeAction, updateBondsTurn } from './bond';
import { trackFeelings } from './bond/feelings';
import { openingDrama, planDrama, type DialogueFrequency, type DramaLine } from './drama';
import { createStoryState, emit } from './story/record';
import { createPartyLife, partyLifeCamp, partyLifeTurn, partyLifeVictory } from './partyLife';
import { openingWild, softenOpeningMoves, extendEndless, spookyWild, noBattleItems, noEvolution, bossRemix, noHealStops, noRevives, quickWinBonus, battleMoneyScale, disabledByRules, joinProblem, lockSpecies, makeRules, partyCap, pickGeneration, randomDraft, rulesCampaign, startScale, wantsCheckpoint, wantsGenerationLock, wantsRandomDraft, wantsTypeLock, getMode, RUN_RULES, type RulesChoice } from './rules';
import { withChampionTeam } from './story/championDefense';
import { grandGauntlet, gauntletRival, markGauntletFight } from './story/gauntlet';
import { growCrisis } from './story/crisis';
import { recapRegion, tellAct } from './campaign/director';
import { freshClock, stepClock } from './clock';
import { finalRivalLine, tellCampfire } from './story/highHype';
import { ultimateRival } from './rivals/ultimate';
import { applyGrandInfluence, endGrandBattle, grandNotes, startGrandBattle } from './story/grandEnemy';
import { simulateRivalWorld } from './rivals/world';
import { noteProtagonistTitle, rivalSighting } from './rivals/recognition';
import { rivalRivalries, rivalTeamUp } from './rivals/rivalries';
import { ensureAce, withSignatureAce } from './rivals/signatureTeam';
import { pickLegacyRival } from './rivals/legacy';
import { rivalReturn, rivalReturnFlag, rivalSeenFlag, RIVAL_SEEN_ANY, scheduleKey, waitingRival } from './rivals/adapt';
import { rematchRule, returnFlag, revisedTeam, waitingTrainer } from './story/returns';
import { withTeamTypes } from './rivals/adapt';
import { finaleAssistRival } from './rivals/living';
import { markTakeover, takeoverNote, takeoverRival } from './rivals/promotion';
import { frontRunnerIntro, onFrontRunnerBattle } from './timeline/frontRunner';
import { beginBossRematch, bossRematchPlan, dueBossRematch, recordBossDefeat, type BossRecord } from './story/bossRematch';
import { bondScoreOf } from './battle/spectacle';
import { freshSpectacle } from './battle/spectacle';
import { memoryPick } from './memories/encounters';
import { noteReplayTurn, sealReplay } from './memories/replay';
import { noteSkips, worldStageStart } from './memories/world';
import { beginNemesisBattle, counterTypes, dueNemesis, isHunted, markHunted, nemesisMember, nemesisTrainerPlan } from './story/nemesis';
import type { Nemesis } from './story/schema';
import { answerMentorship, graduateMentorships, planMentorship } from './story/mentorship';
import { answerAskLead, planAskLead } from './story/askLead';
import { planReunion, reunionPokemon } from './story/reunion';

export interface NewRunOptions {
  /** The Daily Run's fixed starter set: replaces the drafted choices (a few lines below the draft). */
  starterOverride?: string[];
  runId: string;
  seed: string;
  archetypeId: string;
  /** "full" (default) or a shorter campaign such as "dev". Ignored when `prep` is given. */
  campaignId?: string;
  /** The Preparation Desk's choices (default: the classic pool, the standard draft, no token). */
  prep?: RunPrep;
  /** The profile's permanent attributes (default: none). */
  attributes?: Record<string, number>;
  /** The profile's past Pokémon; one may come back this run (core/story/reunion.ts). */
  pastPokemon?: readonly PastPokemon[];
  /** The account's archived rivals; one may shape a rival this run (core/rivals/legacy.ts). */
  rivalArchive?: Profile['rivalArchive'];
  /** The account's finished runs; the newest win becomes the Champion Defense team (core/story/championDefense.ts). */
  runHistory?: Profile['runHistory'];
  /** Mode, difficulty, modifiers and Death-Block (default: the standard rules). */
  rules?: RulesChoice;
  /** The profile's Species Mastery: unlocks for joining Pokémon and the "Mastered" starter set (default: none). */
  mastery?: Profile['mastery'];
  /** Game event editions on right now (core/gameEvents.ts activeGameEvents): their rules apply to this run. */
  gameEvents?: string[];
  /** The best raid tier the account has won (profile best counter "raidBestTier"); higher tiers stay closed. Default: every tier open. */
  raidTierUnlocked?: number;
  /** The Bank licenses the profile owns (core/bank.ts runLicenses keeps the three that act inside a run). */
  licenses?: string[];
  /** Candy Shop perks the profile owns (core/candyShop.ts): they add to the starting Bag. */
  candyPerks?: string[];
  /** The account's unlocked trainers; map events that recruit one of them stop appearing (itemCounters `owned:<id>`). */
  ownedTrainers?: readonly string[];
}

export function createRun(content: Content, opts: NewRunOptions): RunState {
  const archetype = getArchetype(content, opts.archetypeId);
  const prep: RunPrep = { ...(opts.prep ?? { ...defaultPrep(content), campaignId: opts.campaignId ?? 'full' }) };
  const resources = startingResources(content, archetype, prep, opts.candyPerks);
  const rules = makeRules(opts.rules ?? { modeId: 'standard', difficultyId: 'standard', modifierIds: [], deathBlock: false });
  const scale = startScale(rules);
  const inventory: Record<string, number> = {};
  for (const [id, n] of Object.entries(resources.items)) addItem(inventory, id, scale < 1 ? Math.floor(n * scale) : n);
  const campaign = getCampaign(content, rulesCampaign(rules) ?? prep.campaignId);
  if (wantsGenerationLock(rules)) rules.lockGeneration = pickGeneration(content, opts.seed);
  if (wantsRandomDraft(rules)) Object.assign(prep, randomDraft(content, opts.seed, prep));
  const rng = createStreams(opts.seed);
  const mastered = masteredStarters(content, opts);
  const draft = withStream(rng, 'starter', (r) => draftStarters(content, r, prep, mastered));
  // Used once here, so its own seed-derived generator needs no saved stream.
  const starterChoices = opts.starterOverride?.length ? [...opts.starterOverride] : withSignatureStarter(content, new Rng(hashSeed(`${opts.seed}::signature`)), archetype, prep, draft.choices, mastered);
  const regionOrder = withStream(rng, 'map', (r) => generateRegionOrder(content, campaign, r, rules.regionId));
  const run: RunState = {
    runId: opts.runId,
    journal: [],
    seed: opts.seed,
    archetypeId: opts.archetypeId,
    phase: 'starter',
    starterChoices,
    prep: { ...prep, campaignId: campaign.id, note: draft.note },
    party: [],
    eggs: [],
    garden: [],
    past: null,
    money: Math.floor(resources.money * scale),
    inventory,
    candies: 0,
    encountersCompleted: 0,
    battle: null,
    pending: [],
    afterDecisions: 'reward',
    stage: null,
    usedThemes: [],
    usedLeaders: [],
    materials: {},
    plaza: freshPlaza(),
    badges: [],
    ...(opts.ownedTrainers?.length ? { itemCounters: Object.fromEntries(opts.ownedTrainers.map((id) => [`owned:${id}`, 1])) } : {}),
    campaignId: campaign.id,
    regionOrder,
    regionIndex: 0,
    regionsCleared: [],
    victory: false,
    draft: null,

    box: [],
    // A game event's themed rules work like trainer perks for the whole run.
    perkEffects: gameEventModifiers(content, opts.gameEvents ?? []),
    licenses: runLicenses(opts.licenses ?? []),
    signatureApplied: {},
    hype: 0,
    tempEffects: [],
    disabledMechanics: disabledByRules(rules),
    rules,
    runQuest: pickRunQuest(content, opts.seed),
    mastery: runMasteryPerks(content, opts),
    gameEvents: [...(opts.gameEvents ?? [])],
    baseAttributes: opts.attributes ? readAttributes(content, opts.attributes) : zeroAttributes(),
    attributeModifiers: withTokenAttribute(content, prep, { ...zeroAttributes(), ...startingAttributes(archetype.modifiers) }),
    rng,
    nextUid: 1,
    log: { rewardsTaken: [], battlesWon: 0, counters: {}, speciesSeen: [], speciesCaught: [], speciesShiny: [], charmUsedInRegion: false, defeatedBy: null, starterUid: null },
    story: withChampionTeam(createStoryState(), opts.runHistory ?? []),
    partyLife: createPartyLife(),
    clock: freshClock(),
    legacyRival: pickLegacyRival(opts.rivalArchive ?? [], opts.seed),
    rentalsUsed: [],
    raids: { entered: 0, won: 0, lost: 0, bestTier: 0, done: [], escaped: [], unlockedTier: opts.raidTierUnlocked ?? 6 },
    totems: { entered: 0, won: 0, lost: 0, done: [], unlocks: [], research: 0 },
    expedition: null,
    expeditions: { completed: [], failed: [], unlocked: [], last: [] },
    minigame: null,
    minigames: { stage: -1, money: 0, items: 0, plays: {}, attempts: {}, best: {}, effects: 0, discount: null },
  };
  const reunion = planReunion(content, opts.seed, opts.pastPokemon ?? []);
  if (reunion) run.reunion = reunion;
  recordRunStarted(content, run);
  return run;
}

/** Keeps a copy of the run for a wipe to return to (mutates `run`); drops it when no rule needs it. */
function takeCheckpoint(run: RunState): void {
  if (!wantsCheckpoint(run)) {
    delete run.checkpoint;
    return;
  }
  const { checkpoint: _old, ...rest } = run;
  run.checkpoint = structuredClone(rest) as Record<string, unknown>;
}

/**
 * The party is wiped: Adventure returns to the checkpoint (with a small money loss), Death-Block does it once in the first
 * battles. Returns the restored run, or null when the run really ends. The party comes back healed.
 */
function restoreAfterWipe(content: Content, run: RunState): RunState | null {
  if (!run.checkpoint) return null;
  const adventure = getMode(run.rules.modeId)?.checkpoints === true;
  const block = !adventure && run.rules.deathBlock && !run.rules.deathBlockUsed && run.encountersCompleted < RUN_RULES.deathBlock.battles;
  if (!adventure && !block) return null;
  const maxWipes = getMode(run.rules.modeId)?.maxWipes;
  if (adventure && maxWipes !== undefined && run.rules.wipes >= maxWipes) return null;
  const back = structuredClone(run.checkpoint) as unknown as RunState;
  // A nemesis made (or made stronger) by the wipe is remembered after it.
  back.story.nemeses = structuredClone(run.story.nemeses);
  back.rules = { ...run.rules, wipes: run.rules.wipes + 1, deathBlockUsed: run.rules.deathBlockUsed || block };
  if (adventure) back.money = Math.floor(back.money * (1 - (getMode(run.rules.modeId)?.wipeMoneyLoss ?? 0)));
  healParty(content, back);
  back.battle = null;
  back.phase = 'map';
  takeCheckpoint(back);
  return back;
}

/** Adventure wipes so far and the most the mode allows (null: the mode has no wipe limit or no checkpoints). */
export function wipeStatus(run: Pick<RunState, 'rules'>): { wipes: number; max: number | null } | null {
  const mode = getMode(run.rules.modeId);
  return mode?.checkpoints ? { wipes: run.rules.wipes, max: mode.maxWipes ?? null } : null;
}

/** Ends an Adventure run on purpose (from the map): the run is over, not won. Other modes can't be ended this way. */
export function endRunEarly(current: RunState): RunState {
  assertPhase(current, 'map');
  if (!wipeStatus(current)) throw new Error('Only Adventure runs can be ended from the map');
  const run = structuredClone(current);
  run.phase = 'over';
  run.victory = false;
  return run;
}

function assertPhase(run: RunState, ...phases: RunState['phase'][]): void {
  if (!phases.includes(run.phase)) throw new Error(`Action needs phase "${phases.join('" or "')}" but run is in "${run.phase}"`);
}

export function nextUid(run: RunState, prefix: string): string {
  const uid = `${prefix}${run.nextUid}`;
  run.nextUid += 1;
  return uid;
}

/** A new Pokémon for this run; its ability comes from the run seed and its uid. */
export function newMon(content: Content, run: RunState, speciesId: string, level: number, prefix: 'p' | 'e', cap = 100): PokemonInstance {
  const uid = nextUid(run, prefix);
  // Difficulty: every enemy's level (the rules were fixed when the run started).
  const shown = prefix === 'e' ? Math.max(1, Math.min(cap, level + run.rules.enemyLevelBonus)) : level;
  const mon = createPokemon(content, speciesId, shown, uid, `${run.seed}:${uid}`);
  if (prefix === 'e') softenOpeningMoves(content, mon);
  return mon;
}

function speciesName(content: Content, id: string): string {
  return getSpecies(content, id).name;
}

export function chooseStarter(content: Content, current: RunState, choiceIndex: number): RunState {
  assertPhase(current, 'starter');
  const speciesId = current.starterChoices[choiceIndex];
  if (!speciesId) throw new Error(`Invalid starter choice ${choiceIndex}`);
  const run = structuredClone(current);
  const special = getSpecies(content, speciesId).tags.some((t) => t === 'legendary' || t === 'mythical');
  const specimenPenalty = special ? content.balance.specialSpecimen.levelPenalty : 0;
  run.party = [newMon(content, run, speciesId, Math.max(1, content.balance.starterLevel + startingLevelOffset(runArchetype(content, run).modifiers) - specimenPenalty), 'p')];
  if (wantsTypeLock(run.rules)) run.rules.lockType = getSpecies(content, speciesId).types[0]!;
  run.party[0]!.friendship = content.balance.friendship.starter;
  const perks = runArchetype(content, run).modifiers;
  const fixed = runArchetype(content, run).signatureMovesets[speciesId];
  if (fixed) run.party[0]!.moves = fixed.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
  const signature = hasStarterSignature(perks) ? signatureMoveFor(content, speciesId) : null;
  if (signature && !run.party[0]!.moves.some((m) => m.id === signature)) {
    const starter = run.party[0]!;
    const slot = { id: signature, pp: content.moves.get(signature)!.pp };
    if (starter.moves.length < 4) starter.moves.push(slot);
    else {
      // Replace the weakest move (status moves first).
      const power = (id: string) => content.moves.get(id)?.power ?? 0;
      const weakest = starter.moves.reduce((w, m, i) => (power(m.id) < power(starter.moves[w]!.id) ? i : w), 0);
      starter.moves[weakest] = slot;
    }
  }
  run.log.starterUid = run.party[0]!.uid;
  enterStage(content, run, 0);
  recordChanges(content, current, run, 'level');
  return run;
}

/**
 * Saves from before regions existed have no region order. Gives them one
 * (mutates `run`; does nothing when the run already has one).
 */
export function fillRegionOrder(content: Content, run: RunState): void {
  if (run.regionOrder.length > 0) return;
  const campaign = getCampaign(content, run.campaignId);
  run.regionOrder = withStream(run.rng, 'map', (r) => generateRegionOrder(content, campaign, r, run.rules.regionId));
  run.regionIndex = Math.min(run.regionIndex, run.regionOrder.length - 1);
}

/** Returns a copy of `run` with a region order (see fillRegionOrder), or `run` itself if it has one. */
export function ensureRegionOrder(content: Content, run: RunState): RunState {
  if (run.regionOrder.length > 0) return run;
  const copy = structuredClone(run);
  fillRegionOrder(content, copy);
  return copy;
}

/**
 * Fills in what an older save could not have: the region order and a story
 * history for every party Pokémon. Returns `run` itself when nothing was missing.
 */
export function prepareLoadedRun(content: Content, run: RunState): RunState {
  const ordered = ensureRegionOrder(content, run);
  if (run.party.every((m) => ordered.story.histories[m.uid])) return ordered;
  const copy = ordered === run ? structuredClone(run) : ordered;
  ensureHistories(content, copy);
  return copy;
}

/** Journal: writes down the stops of the stage that just ended (mutates `run`). */
export function noteJournal(content: Content, run: RunState): void {
  if (!run.stage || !hasPerk(content, run, 'journal')) return;
  const stops = run.stage.visited.map((id) => findNode(run.stage!.map, id).kind).join(' > ');
  run.journal = [...(run.journal ?? []), `Region ${run.regionIndex + 1}, ${run.stage.kind} ${run.stage.index + 1}: ${stops || 'no stops'}`];
}

/** Berry Pots: after each gym, a random Berry (two with Growth Mulch) goes to a Pokémon with room to hold it. */
export function plantBerries(content: Content, run: RunState): void {
  if (passivePercent(content, run, 'berryPots') <= 0) return;
  const berries = [...content.catalog.values()].filter((e) => e.family.startsWith('Berries') && e.status === 'supported' && e.effect?.kind === 'held' && e.stacksOn === 'pokemon' && (e.rarity === 'common' || e.rarity === 'uncommon'));
  if (berries.length === 0) return;
  const rng = new Rng(hashSeed(`${run.seed}::berry-pots::${run.badges.length}`));
  const slots = itemSlotLimit(content.balance.heldItemSlots, runPerks(content, run));
  const picks = passivePercent(content, run, 'berryPotsExtra') > 0 ? 2 : 1;
  for (let i = 0; i < picks; i++) {
    const berry = rng.pick(berries);
    const mon = run.party.find((m) => (m.held?.[berry.id] ?? 0) > 0 && (berry.max === null || m.held![berry.id]! < berry.max)) ?? run.party.find((m) => Object.keys(m.held ?? {}).length < slots);
    if (mon) mon.held = { ...mon.held, [berry.id]: (mon.held?.[berry.id] ?? 0) + 1 };
  }
}

/**
 * A new stage: every stage Egg (core/eggs.ts) gets one closer and ready ones hatch. Mystery Eggs from saves
 * made before Eggs had their own list (`egg:<n>` item counters) become Eggs first, so none is lost.
 */
export function hatchEggs(content: Content, run: RunState): void {
  for (const key of Object.keys(run.itemCounters ?? {}).filter((k) => k.startsWith('egg:'))) {
    const left = run.itemCounters![key]!;
    const shiny = run.itemCounters![`egg-shiny:${key.slice(4)}`] ?? 1;
    const { [key]: _gone, [`egg-shiny:${key.slice(4)}`]: _shine, ...rest } = run.itemCounters!;
    run.itemCounters = rest;
    if (left <= 0) continue;
    const rng = new Rng(hashSeed(`${run.seed}::egg::${key}`));
    const species = rng.pick(wildEligibleSpecies(content).filter((s) => s.evolutionStage === 1));
    const levels = run.party.map((m) => m.level);
    const level = Math.max(1, Math.min(runLevelCap(content, run), Math.floor(levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length)) - 5));
    layEgg(content, run, species.id, { level, left, unit: 'stage', source: 'Mystery Egg', shinyMultiplier: runAttributeEffects(content, run).shinyChance * shiny }, rng);
  }
  tickEggs(content, run, 'stage');
  growGarden(run);
}

/** Starts a stage (mutates `run`): picks a fresh theme and gym leader, generates the map, and shows it. */
function enterStage(content: Content, run: RunState, index: number): void {
  fillRegionOrder(content, run);
  const campaign = getCampaign(content, run.campaignId);
  const region = currentRegion(content, run);
  const { theme, leader, map } = withStream(run.rng, 'map', (r) => {
    const theme = pickTheme(content, run.usedThemes, r);
    const leader = pickGymLeader(content, theme, run.usedLeaders, r, region.gymLeaders);
    return { theme, leader, map: generateStageMap(content, campaign, r) };
  });
  const problems = validateStageMap(map);
  if (problems.length > 0) throw new Error(`Generated an invalid stage map: ${problems.join('; ')}`);
  noteSkips(content, run);
  noteJournal(content, run);
  run.usedThemes.push(theme.id);
  run.usedLeaders.push(leader.id);
  run.stage = { kind: 'stage', index, themeId: theme.id, leaderId: leader.id, eliteFour: [], map, current: null, visited: [], scoutedTo: 0, extraFronts: [], roamers: [], convoy: null };
  startStageEffects(run);
  hatchEggs(content, run);
  simulateRivalWorld(content, run);
  rivalRivalries(content, run);
  rivalSighting(content, run);
  noteProtagonistTitle(content, run);
  tellCampfire(content, run);
  tellAct(content, run);
  worldStageStart(content, run);
  applyGrandInfluence(content, run);
  growCrisis(content, run);
  grandGauntlet(content, run);
  advanceShadowWorld(content, run);
  // Rods, and Wave, Tropic and Harbor Mail, add stops to the new map; then the event ("?") stops.
  addItemStops(content, run);
  addEventStops(content, run);
  spawnRoamers(content, run);
  placeRaidDens(content, run);
  placeGangDen(content, run);
  placeTotem(content, run);
  placeExpeditionGate(content, run);
  placeLegendaryGate(content, run);
  placeMinigameStop(content, run);
  placeServiceStop(run);
  placePlaza(run);
  run.battle = null;
  run.phase = 'map';
  takeCheckpoint(run);
}

/** Starts the region's Pokémon League (mutates `run`): picks the Elite Four and champion and heals the party. */
function enterLeague(content: Content, run: RunState): void {
  fillRegionOrder(content, run);
  const campaign = getCampaign(content, run.campaignId);
  const region = currentRegion(content, run);
  const league = withStream(run.rng, 'map', (r) => pickLeague(content, region, campaign, run.usedLeaders, r));
  const map = generateLeagueMap(campaign.eliteFourSize);
  const problems = validateLeagueMap(map);
  if (problems.length > 0) throw new Error(`Generated an invalid league map: ${problems.join('; ')}`);
  run.usedLeaders.push(...league.eliteFour, league.champion);
  const themeId = run.usedThemes[run.usedThemes.length - 1] ?? run.stage?.themeId ?? '';
  run.stage = {
    kind: 'league',
    index: campaign.stagesPerRegion,
    themeId,
    leaderId: league.champion,
    eliteFour: league.eliteFour,
    map,
    current: null,
    visited: [],
    scoutedTo: 0,
    convoy: null,
    extraFronts: [],
    roamers: [],
  };
  startStageEffects(run);
  syncHpPerks(content, runArchetype(content, run).modifiers, run.party);
  healParty(content, run);
  run.battle = null;
  run.phase = 'map';
  takeCheckpoint(run);
}

/** Signature effects that run out: counts this battle against each and removes the finished ones from the run's perks (mutates `run`). */
export function tickTempEffects(run: RunState, battle: BattleState, boss: boolean): void {
  const kept: RunState['tempEffects'] = [];
  for (const temp of run.tempEffects) {
    // Raids and Totems are not wild encounters, so they never use up a "next wild encounter" effect.
    const counts = temp.until === 'battle' || (temp.until === 'boss' && boss) || (temp.until === 'wild' && battle.kind === 'wild' && !battle.trainer && !battle.raid && !battle.totem);
    if (counts && temp.battles <= 1) {
      for (const effect of temp.effects) {
        const at = run.perkEffects.findIndex((m) => JSON.stringify(m) === JSON.stringify(effect));
        if (at >= 0) run.perkEffects.splice(at, 1);
      }
    } else kept.push(counts ? { ...temp, battles: temp.battles - 1 } : temp);
  }
  run.tempEffects = kept;
}

/** Moves every party Pokémon up or down by whole levels (a trainer perk); experience follows the level. */
function shiftPartyLevels(content: Content, run: RunState, levels: number): void {
  for (const mon of run.party) shiftLevel(content, run, mon, levels);
}

/** Raises or lowers one Pokémon by whole levels; experience follows the level. */
function shiftLevel(content: Content, run: RunState, mon: PokemonInstance, levels: number): void {
  if (levels === 0) return;
  if (levels > 0) {
    addLevels(content, mon, levels, runLevelCap(content, run));
    return;
  }
  mon.level = Math.max(1, mon.level + levels);
  mon.xp = xpForLevel(getSpecies(content, mon.speciesId).growthRate, mon.level, content.balance.difficulty.highLevelXp);
  mon.hp = Math.min(mon.hp, maxHp(content, mon));
}

/** Pokémon the party can hold for this run's trainer. */
export function partyCapacity(content: Content, run: Pick<RunState, 'archetypeId' | 'perkEffects' | 'rules'>): number {
  return Math.min(partyLimit(content.balance.partyMax, runPerks(content, run)), partyCap(content, run.rules));
}

/** Run flag for the final boss's second phase: absent before the first win, 'pending' until the second fight is won, then 'done'. */
const FINALE_FLAG = 'finale:phase2';

/** Whether the champion of the region the run is in is the final boss: the last region of a campaign that has a Grand Region. */
export function isFinalBoss(content: Content, run: Pick<RunState, 'regionOrder' | 'regionIndex'>): boolean {
  return !!content.regions.get(run.regionOrder[run.regionIndex] ?? '')?.grand && run.regionIndex === run.regionOrder.length - 1;
}

/** Starts the next region at its first stage, or ends the run in victory after the last one (mutates `run`). */
function enterNextRegion(content: Content, run: RunState): void {
  recapRegion(content, run);
  if (run.regionIndex + 1 >= run.regionOrder.length) {
    run.victory = true;
    run.phase = 'over';
    return;
  }
  run.regionIndex += 1;
  run.log.charmUsedInRegion = false;
  shiftPartyLevels(content, run, regionLevelOffset(runArchetype(content, run).modifiers));
  // Pass Orbs turn into money in each new region.
  const orbMoney = regionMoneyFromItems(content, run);
  run.money += orbMoney;
  count(run, 'moneyEarned', orbMoney);
  enterStage(content, run, 0);
}

/** Pokémon released so far this run (caught ones turned into candies). */
export function releasesUsed(run: Pick<RunState, 'log'>): number {
  return run.log.counters.caughtToCandies ?? 0;
}

/** Whether the trainer's release limit (Ash) has been reached. */
export function releaseLimitReached(content: Content, run: Pick<RunState, 'log' | 'archetypeId'>): boolean {
  const limit = releaseLimit(runArchetype(content, run).modifiers);
  return limit !== null && releasesUsed(run) >= limit;
}

function assertCanRelease(content: Content, run: RunState, forced = false): void {
  if (!forced && releaseLimitReached(content, run)) throw new Error('This trainer can only release a few Pokémon per run, and you have used them all');
}

export function requireStage(run: RunState): StageState {
  if (!run.stage) throw new Error('The run has no stage');
  return run.stage;
}

/** Moves to a node on the map and starts its encounter. */
export function chooseNode(content: Content, current: RunState, nodeId: string): RunState {
  assertPhase(current, 'map');
  const choices = mapChoices(content, current);
  if (!choices.some((n) => n.id === nodeId)) throw new Error(`Node "${nodeId}" is not one of the next choices`);
  const run = structuredClone(current);
  const stage = run.stage!;
  const mode = run.moveMode;
  delete run.moveMode;
  const node = findNode(stage.map, nodeId);
  // The Bicycle rides through a node of the skipped column without stopping.
  if (mode === 'bicycle') stage.visited.push(nextChoices(stage).find((n) => n.next.includes(nodeId))!.id);
  if (mode && (mode !== 'machBike' || node.kind === 'wild')) markUsedThisStage(run, perkItem(content, run, mode)!);
  stage.current = nodeId;
  stage.visited.push(nodeId);
  stepClock(content, run);
  // Bridge Mail adds a stop beside the node the player reaches.
  addBridgeStops(content, run, nodeId);
  // Roaming Legendaries move on as you do.
  advanceRoamers(content, run, node);
  // An escort is struck on the way to a battle, and delivered (or lost) at the gym.
  convoyStep(content, run, node);
  recordRouteChosen(content, run, nodeId, node.harder, node.kind);
  // The Mach Bike rides past a wild Pokémon: no battle, but the reward draft still comes.
  if (mode === 'machBike' && node.kind === 'wild') {
    run.afterDecisions = 'reward';
    continueAfterDecisions(content, run);
    return run;
  }
  // A Repel keeps a wild Pokémon away: no battle and no reward, but the level counts.
  if (node.kind === 'wild' && repelActive(content, run)) {
    useRepel(content, run);
    return run;
  }
  startEncounter(content, run, node);
  // A weather front over the node sets the battle's weather.
  applyFrontWeather(content, run, node);
  recordBattleStart(content, run);
  return run;
}

/** VS Recorder: keeps the run as a trainer battle begins, for one replay after a loss (mutates `run`). */
function recordBattleStart(content: Content, run: RunState): void {
  delete run.recorder;
  if (run.battle?.kind !== 'trainer' || !hasPerk(content, run, 'vsRecorder') || (run.itemCounters?.['vs-recorder-used'] ?? 0) > 0) return;
  const { checkpoint: _c, recorder: _r, ...rest } = run;
  run.recorder = structuredClone(rest) as Record<string, unknown>;
}

// ---------- map items: getting around (M8.75 slice 3b-2) ----------

/** The nodes the player may move to next: the normal choices, or where a chosen bike can reach. */
export function mapChoices(content: Content, run: RunState): MapNode[] {
  const stage = requireStage(run);
  const plain = nextChoices(stage);
  if (run.moveMode === 'bicycle') {
    const ahead = new Map<string, MapNode>();
    for (const n of plain) for (const id of n.next) ahead.set(id, findNode(stage.map, id));
    return ahead.size > 0 ? [...ahead.values()] : plain;
  }
  if (run.moveMode === 'acroBike') {
    const column = currentColumn(stage) + 1;
    return stage.map.nodes.filter((n) => n.column === column);
  }
  return plain;
}

export type MapActionKind = 'escapeRope' | 'bicycle' | 'acroBike' | 'machBike' | 'rematch' | 'transceiver' | 'pail' | 'sprayduck' | 'squirt';

export interface MapAction {
  kind: MapActionKind;
  itemId: string;
  /** What the item does now, for the Items menu. */
  text: string;
  /** Why it can't be used now, or null. */
  problem: string | null;
  /** A bike chosen for the next move. */
  on: boolean;
}

/** Where an Escape Rope leads: the index in `visited` of the last node with a choice of paths (-1 = the start), or null. */
function lastFork(stage: StageState): number | null {
  for (let i = stage.visited.length - 2; i >= 0; i--) if (findNode(stage.map, stage.visited[i]!).next.length > 1) return i;
  return stage.visited.length > 0 && stage.map.nodes.filter((n) => n.column === 1).length > 1 ? -1 : null;
}

/** The trainer a VS Seeker calls back: the last one beaten on this stage. */
function rematchNode(stage: StageState): MapNode | null {
  for (let i = stage.visited.length - 1; i >= 0; i--) {
    const node = findNode(stage.map, stage.visited[i]!);
    if (node.kind === 'trainer') return node;
  }
  return null;
}

/** The map items the player can use from the map's Items menu, with why each can't be used now. */
export function mapActions(content: Content, run: RunState): MapAction[] {
  const stage = run.stage;
  if (!stage) return [];
  const out: MapAction[] = [];
  const league = stage.kind === 'league' ? 'Not in the Pokémon League.' : null;
  const rope = perkItem(content, run, 'escapeRope');
  if (rope) {
    const fork = lastFork(stage);
    out.push({
      kind: 'escapeRope',
      itemId: rope,
      text: `Go back to the last fork and choose again (${usesLeft(run, rope)} left)`,
      problem: league ?? (fork === null ? 'No fork behind you on this stage.' : null),
      on: false,
    });
  }
  const plain = nextChoices(stage);
  const bikes: { kind: 'bicycle' | 'acroBike' | 'machBike'; text: string; problem: string | null }[] = [
    { kind: 'bicycle', text: 'Ride two columns ahead, skipping one', problem: plain.every((n) => n.next.length === 0) ? 'Nothing two columns ahead.' : null },
    { kind: 'acroBike', text: 'Jump to any stop in the next column', problem: null },
    { kind: 'machBike', text: 'Ride past the next wild Pokémon and still get its reward', problem: plain.some((n) => n.kind === 'wild') ? null : 'No wild Pokémon ahead.' },
  ];
  for (const bike of bikes) {
    const itemId = perkItem(content, run, bike.kind);
    if (!itemId) continue;
    const used = usedThisStage(run, itemId) ? 'Already used on this stage.' : null;
    out.push({ kind: bike.kind, itemId, text: `${bike.text} (once per stage)`, problem: league ?? used ?? bike.problem, on: run.moveMode === bike.kind });
  }
  const seeker = perkItem(content, run, 'rematch');
  if (seeker) {
    const node = rematchNode(stage);
    out.push({
      kind: 'rematch',
      itemId: seeker,
      text: `Fight a trainer from this stage again for double money (${usesLeft(run, seeker)} left)`,
      problem: league ?? (node ? null : 'No trainer beaten on this stage yet.'),
      on: false,
    });
  }
  // Gadgets and care items: once per stage.
  const care: { kind: 'transceiver' | 'pail' | 'sprayduck' | 'squirt'; text: string; problem: string | null }[] = [
    { kind: 'transceiver', text: 'Call home: your whole team heals 25%', problem: run.party.every((m) => m.hp >= maxHp(content, m)) ? 'Your team is already healthy.' : null },
    { kind: 'pail', text: 'Water a Pokémon: friendship goes up', problem: run.party.length === 0 ? 'No Pokémon.' : null },
    { kind: 'sprayduck', text: 'Cool a Pokémon down: +1 toward Peace', problem: null },
    { kind: 'squirt', text: 'Your lead gains +5% EXP in the next battle', problem: (run.itemCounters?.['squirt-exp'] ?? 0) > 0 ? 'Already sprayed for the next battle.' : null },
  ];
  for (const c of care) {
    const itemId = perkItem(content, run, c.kind === 'squirt' ? 'squirt' : c.kind);
    if (!itemId) continue;
    const used = usedThisStage(run, itemId) ? 'Already used on this stage.' : null;
    out.push({ kind: c.kind, itemId, text: `${c.text} (once per stage)`, problem: league ?? used ?? c.problem, on: false });
  }
  return out;
}

/** Uses a map item from the Items menu: an Escape Rope, a bike (chosen for the next move, or put away), or a VS Seeker. */
export function useMapAction(content: Content, current: RunState, kind: MapActionKind): { run: RunState; message: string } {
  assertPhase(current, 'map');
  const action = mapActions(content, current).find((a) => a.kind === kind);
  if (!action) throw new Error("You don't have that item");
  if (action.problem && !action.on) throw new Error(action.problem);
  const run = structuredClone(current);
  const stage = run.stage!;
  const name = content.catalog.get(action.itemId)!.name;
  switch (kind) {
    case 'escapeRope': {
      const fork = lastFork(stage)!;
      spendUse(run, action.itemId);
      stage.visited = stage.visited.slice(0, fork + 1);
      stage.current = fork < 0 ? null : stage.visited[fork]!;
      delete run.moveMode;
      return { run, message: `You used the ${name} and went back to the last fork.` };
    }
    case 'transceiver': {
      markUsedThisStage(run, action.itemId);
      const share = perksOf(activePerks(content, run), 'transceiver')[0]?.perk.heal ?? 0.25;
      for (const mon of run.party) if (mon.hp > 0) mon.hp = Math.min(maxHp(content, mon), mon.hp + Math.ceil(maxHp(content, mon) * share));
      return { run, message: `You called home with the ${name}: your team healed a little.` };
    }
    case 'pail':
    case 'sprayduck':
    case 'squirt': {
      markUsedThisStage(run, action.itemId);
      if (kind === 'sprayduck') {
        addRunAttribute(content, run, 'ragePeace', -(perksOf(activePerks(content, run), 'sprayduck')[0]?.perk.peace ?? 1));
        return { run, message: `You cooled your Pokémon down with the ${name}: a little more Peace.` };
      }
      if (kind === 'squirt') {
        run.itemCounters = { ...run.itemCounters, 'squirt-exp': 1 };
        return { run, message: `You sprayed your lead with the ${name}: it gains extra EXP next battle.` };
      }
      // The Pokémon who likes you least gets the water.
      const mon = [...run.party].sort((a, b) => a.friendship - b.friendship)[0]!;
      changeFriendship(content, mon, perksOf(activePerks(content, run), 'pail')[0]?.perk.friendship ?? 5, runAttributeEffects(content, run).friendship);
      return { run, message: `You watered ${getSpecies(content, mon.speciesId).name} with the ${name}: it likes you more.` };
    }
    case 'rematch': {
      spendUse(run, action.itemId);
      const node = rematchNode(stage)!;
      startEncounter(content, run, node, new Rng(hashSeed(`${run.seed}::rematch::${stageKey(run)}::${run.encountersCompleted}`)));
      return { run, message: `The ${name} buzzed: a trainer wants a rematch!` };
    }
    default: {
      if (action.on) {
        delete run.moveMode;
        return { run, message: `You put the ${name} away.` };
      }
      run.moveMode = kind;
      return { run, message: `You got on the ${name}. Choose where to ride.` };
    }
  }
}

/** One map node's preview from a map item: who waits there. */
export interface NodePreview {
  /** The item showing it, or null when the trainer's passive does (Cynthia, Oak). */
  itemId: string | null;
  /** Who shows it, in words: the item's or the trainer's name. */
  source: string;
  /** Species in battle order, with levels when they are known. */
  team: { speciesId: string; level: number | null }[];
  trainerName: string | null;
}

/**
 * What map items show about the nodes on this stage: the next wild Pokémon
 * (Devon Scope), the next trainers' teams (Town Map), the gym leader's ace
 * (Rule Book) or whole team (Orange Mail). Battles are planned on a copy of
 * the run, so previews never use a gameplay roll; they show exactly the
 * battle the player gets by choosing that node next.
 */
export function mapPreviews(content: Content, run: RunState): Record<string, NodePreview> {
  const stage = run.stage;
  if (!stage || run.phase !== 'map') return {};
  const working = activePreviewItems(content, run);
  const perks = (what: 'wild' | 'trainers' | 'gymAce' | 'gymTeam') =>
    working.find((id) => {
      const effect = content.catalog.get(id)?.effect;
      return effect?.kind === 'perk' && effect.perks.some((p) => p.perk === 'preview' && p.what === what);
    }) ?? null;
  const out: Record<string, NodePreview> = {};
  const archetype = runArchetype(content, run);
  // An item's preview wins over the trainer's (it names the item); either shows the same battle.
  const source = (what: 'wild' | 'trainers' | 'gymTeam', itemId: string | null): { itemId: string | null; source: string } | null =>
    itemId ? { itemId, source: content.catalog.get(itemId)?.name ?? itemId } : trainerPreviews(archetype, what) ? { itemId: null, source: archetype.name } : null;
  const wildFrom = source('wild', perks('wild'));
  const trainerFrom = source('trainers', perks('trainers'));
  for (const node of mapChoices(content, run)) {
    const from = node.kind === 'wild' ? wildFrom : node.kind === 'trainer' ? trainerFrom : null;
    if (!from) continue;
    const copy = structuredClone(run);
    // A preview never stops the map: with no Pokémon able to battle there is nothing to show.
    if (!copy.party.some((p) => p.hp > 0)) break;
    startEncounter(content, copy, node);
    const battle = copy.battle!;
    out[node.id] = { ...from, team: battle.enemyTeam.map((m) => ({ speciesId: m.speciesId, level: m.level })), trainerName: battle.trainer?.name ?? null };
  }
  const gym = stage.map.nodes.find((n) => n.kind === 'gym');
  const teamItem = perks('gymTeam') ?? perks('gymAce');
  const teamFrom = teamItem ? source('gymTeam', teamItem) : (source('gymTeam', null) ?? (eventGymPreview(run) ? { itemId: null, source: 'Your scouting' } : null));
  if (gym && teamFrom) {
    const campaign = getCampaign(content, run.campaignId);
    const species = bossTeamSpecies(content, 'gym', stage.leaderId, run.regionIndex * campaign.stagesPerRegion + stage.index, bossRemix(run.rules));
    const shown = perks('gymTeam') || !teamItem ? species : species.slice(-1);
    out[gym.id] = { ...teamFrom, team: shown.map((speciesId) => ({ speciesId, level: null })), trainerName: null };
  }
  return out;
}

/** The map items giving a preview that are working right now. */
function activePreviewItems(content: Content, run: RunState): string[] {
  const ids = new Set<string>();
  for (const id of Object.keys(run.passives ?? {}).concat((run.mapEffects ?? []).map((e) => e.itemId))) {
    const probe = { ...run, passives: run.passives?.[id] ? { [id]: run.passives[id]! } : {}, mapEffects: (run.mapEffects ?? []).filter((e) => e.itemId === id) };
    if (hasPerk(content, probe, 'preview')) ids.add(id);
  }
  return [...ids];
}

/**
 * Fame Checker: the gym leaders of this region's stages still to come, found
 * by starting those stages on a copy of the run, so they are exactly the ones
 * the player will meet and no roll is used.
 */
export function nextGymLeaders(content: Content, run: RunState): { leaderId: string; types: TypeName[] }[] {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage' || !hasPerk(content, run, 'nextLeaders')) return [];
  const campaign = getCampaign(content, run.campaignId);
  const copy = structuredClone(run);
  const out: { leaderId: string; types: TypeName[] }[] = [];
  for (let index = stage.index + 1; index < campaign.stagesPerRegion; index++) {
    enterStage(content, copy, index);
    out.push({ leaderId: copy.stage!.leaderId, types: [...getTheme(content, copy.stage!.themeId).types] });
  }
  return out;
}

// ---------- fishing (M8.75 slice 3b-3) ----------

/** The fishing spot beside the current node, checked for use. */
function fishingSpot(run: RunState, sideId: string): { node: MapNode; side: SideStop } {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const node = findNode(stage.map, stage.current);
  const side = node.sides.find((s) => s.id === sideId);
  if (!side || side.kind !== 'fish') throw new Error(`No fishing spot "${sideId}" here`);
  if (side.used) throw new Error('You already fished here');
  return { node, side };
}

/**
 * What a fishing spot offers: Water Pokémon at this level of the stage, one
 * without a Rod or with the Old Rod, two with the Good Rod, three with the
 * Super Rod (the last the strongest of four). Rolled by a generator of the
 * spot's own, so looking changes nothing and the offer is the same every time.
 */
export function fishingOffer(content: Content, run: RunState, sideId: string): { speciesId: string; level: number; shiny: boolean }[] {
  const { node } = fishingSpot(run, sideId);
  const stage = run.stage!;
  const rod = fishingRod(content, run) ?? { choices: 1, rare: false };
  const rng = new Rng(hashSeed(`${run.seed}::fishing::${stageKey(run)}::${node.id}::${sideId}`));
  const scale = levelScale(content, getCampaign(content, run.campaignId), run.regionIndex, stage.index, node.column);
  const pool = typesPool(content, ['water'], run.regionOrder[run.regionIndex], curveLevel(content, scale)).map((p) => ({ item: p.speciesId, weight: p.weight }));
  const bst = (id: string) => Object.values(getSpecies(content, id).baseStats).reduce((a, b) => a + b, 0);
  const archetype = runArchetype(content, run);
  const shinyChance = runAttributeEffects(content, run).shinyChance;
  const out: { speciesId: string; level: number; shiny: boolean }[] = [];
  for (let i = 0; i < rod.choices; i++) {
    const hook = () => directSpecies(content, { source: 'fishing', level: curveLevel(content, scale), cap: scale.cap, draw: () => rng.weighted(pool) }).speciesId;
    let speciesId = hook();
    for (let tries = 0; tries < 5 && out.some((o) => o.speciesId === speciesId); tries++) speciesId = hook();
    const tries = (rod.rare && i === rod.choices - 1 ? 3 : 0) + fishingRareTriesPerk(archetype.modifiers);
    if (tries > 0) {
      for (let j = 0; j < tries; j++) {
        const other = rng.weighted(pool);
        if (bst(other) > bst(speciesId)) speciesId = other;
      }
    }
    out.push({ speciesId, level: enemyLevel(content, archetype, scale, 0, rng).level, shiny: rollShiny(content, rng, shinyChance) });
  }
  return out;
}

/** Fishes up one of the offered Pokémon and starts a wild battle with it; the spot is used up. */
export function fish(content: Content, current: RunState, sideId: string, index: number): RunState {
  assertPhase(current, 'map');
  const pick = fishingOffer(content, current, sideId)[index];
  if (!pick) throw new Error(`No fishing choice ${index}`);
  const activeIndex = current.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const run = structuredClone(current);
  fishingSpot(run, sideId).side.used = true;
  const enemy = createPokemon(content, pick.speciesId, pick.level, nextUid(run, 'e'));
  enemy.shiny = pick.shiny;
  if (pick.shiny) countShiny(run, pick.speciesId);
  run.battle = createBattle('wild', [enemy], activeIndex, run.party[activeIndex]!.uid);
  run.battle.fishing = true;
  discover(run, enemy.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
  return run;
}

/** Raid dens: what the player may review before paying (rules in core/raid). */
export function raidPreview(content: Content, current: RunState, sideId: string): RaidPreview {
  const { node, side } = raidDen(current, sideId);
  const def = getRaid(content, side.raidId!);
  const { speciesId, level } = raidBoss(content, current, def, node.id + sideId);
  const notes = def.grand ? grandNotes(content, current, speciesId) : gangNotes(content, current, def);
  const returning = Boolean(side.returning);
  if (returning) notes.push('It got away before, and it is back, stronger.');
  const badges = current.badges.length;
  const scaled = scaledRaid(content, def, badges);
  return {
    id: def.id, name: def.name, tier: def.tier, blurb: [def.blurb, ...notes].join(' '), speciesId, level: raidBadgeLevel(content, current, def, level + (returning ? RETURNING_LEVEL_BONUS : 0)),
    entryCost: def.entryCost, mechanics: describeMechanics(scaled, { content, badges }), rewards: describeRewards(scaled), kind: def.kind, returning,
    approaches: def.approaches.map((a) => ({ id: a.id, label: a.label, text: a.text, cost: a.cost, leave: a.leave })),
  };
}

function raidDen(run: RunState, sideId: string): { node: MapNode; side: SideStop } {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const node = findNode(stage.map, stage.current);
  const side = node.sides.find((x) => x.id === sideId && x.kind === 'raid' && x.raidId);
  if (!side) throw new Error(`No raid den "${sideId}" here`);
  return { node, side };
}

function raidBoss(content: Content, run: RunState, def: RaidDef, key: string): { speciesId: string; level: number } {
  const stage = requireStage(run);
  const campaign = getCampaign(content, run.campaignId);
  const scale = levelScale(content, campaign, run.regionIndex, stage.index, campaign.columns);
  return { speciesId: raidSpecies(def, run, key), level: raidLevel(def, scale.end, scale.cap) };
}

/** Pays the entry cost and starts the raid battle. The den is used up at once, so a reload can't charge or reward twice. */
export function enterRaid(content: Content, current: RunState, sideId: string, approachId?: string): RunState {
  assertPhase(current, 'map');
  const { node, side } = raidDen(current, sideId);
  if (side.used) throw new Error('This raid has already been fought');
  const def = getRaid(content, side.raidId!);
  const approach = pickApproach(def, approachId);
  const cost = def.entryCost + (approach?.cost ?? 0);
  if (current.money < (approach?.leave ? 0 : cost)) throw new Error(`You need ₽${cost} to enter this raid`);
  const activeIndex = current.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const run = structuredClone(current);
  raidDen(run, sideId).side.used = true;
  if (approach?.leave) {
    emit(content, run, 'storyMoment', { actors: [], data: { raid: def.id, choice: 'leave' }, importance: 40, text: `You left ${def.name} to ${def.kind === 'rival' ? 'your rival' : 'someone else'}.` });
    return run;
  }
  run.money -= cost;
  const { speciesId, level } = raidBoss(content, run, def, node.id + sideId);
  const returning = Boolean(side.returning);
  startRaidBattle(content, run, def, speciesId, level + (returning ? RETURNING_LEVEL_BONUS : 0), { approach, returning });
  return run;
}

/** Builds the raid battle (mutates `run`): the boss with its HP pool, the raid state and its field. */
export function startRaidBattle(content: Content, run: RunState, baseDef: RaidDef, speciesId: string, baseLevel: number, opts: { approach?: RaidApproach | null; returning?: boolean } = {}): void {
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  // Badges tune the boss and its mechanics (core/raid/scaling.ts); the count is kept on the fight so a reload never changes it.
  const badges = run.badges.length;
  const def = scaledRaid(content, baseDef, badges);
  const level = raidBadgeLevel(content, run, baseDef, baseLevel);
  const boss = newMon(content, run, speciesId, level, 'e');
  applyBossAbility(content, baseDef, boss, badges);
  auditEncounter(content, 'raid', boss, 'raid-boss');
  applyBossHp(def, boss);
  const approach = opts.approach ?? null;
  boss.statBoosts = { ...boss.statBoosts, hp: Math.max(0, (boss.statBoosts?.hp ?? 0) + (approach?.hpDeltaPercent ?? 0) + (opts.returning ? RETURNING_HP_PERCENT : 0)) };
  for (const id of def.extraMoves) {
    const mv = content.moves.get(id);
    if (mv && !boss.moves.some((m) => m.id === id)) boss.moves.push({ id, pp: mv.pp });
  }
  if (def.gang?.shadowBoss) makeShadow(boss, rollShadowHeart(content, new Rng(hashSeed(`${run.seed}::gang-heart::${def.id}:${run.encountersCompleted}`))));
  if (def.gang) boss.statBoosts = { ...boss.statBoosts, hp: Math.max(0, (boss.statBoosts?.hp ?? 0) - liberatedHpDiscount(run, def.gang.faction)) };
  boss.hp = maxHp(content, boss);
  if (approach?.startHp) boss.hp = Math.max(1, Math.floor(boss.hp * approach.startHp));
  run.battle = createBattle('wild', [boss], activeIndex, run.party[activeIndex]!.uid);
  run.battle.ai = 0.6;
  run.battle.raid = freshRaidBattle(def, badges);
  run.battle.raid.lead = run.party[activeIndex]!.uid;
  run.battle.raid.cheerLevel = cheerLevelFor(run.raids.won);
  const raidState = run.battle.raid;
  if (approach) {
    if (approach.startHp) raidState.pendingShields = raidState.pendingShields.filter((at) => at < approach.startHp!);
    if (approach.timerDelta !== 0) raidState.timerLeft = Math.max(3, (def.timerTurns ?? 20) + approach.timerDelta);
    raidState.rewardPercent = approach.rewardPercent;
    raidState.draftDelta = approach.draftDelta;
    raidState.rivalHelped = approach.rivalHelps;
    if (approach.rivalHelps || approach.rivalRaces) raidState.rival = pickRaidRival(content, run, level, approach.rivalRaces ? 'race' : 'help');
  }
  if (opts.returning) {
    raidState.returning = true;
    raidState.draftDelta += 1;
  }
  if (def.weather) run.battle.weather = { id: def.weather, turns: 999 };
  if (def.modifiers.terrain) run.battle.terrain = { id: def.modifiers.terrain, turns: 999 };
  run.raids.entered += 1;
  if (def.grand) startGrandBattle(content, run);
  discover(run, boss.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
}

/** Totem territory preview. */
export function totemPreview(content: Content, current: RunState, sideId: string): TotemPreview {
  const { node, side } = totemDen(current, sideId);
  const def = getTotem(content, side.totemId!);
  const { speciesId, level } = totemBoss(content, current, def, node.id + sideId);
  return {
    id: def.id, name: def.name, tier: def.tier, blurb: def.blurb, speciesId, level, aura: def.aura.text,
    environment: [def.environment?.text, def.fieldEffect?.text].filter(Boolean).join(' ') || null, ally: describeAlly(def), phases: def.phases.length, rewards: describeTotemRewards(def),
  };
}

function totemDen(run: RunState, sideId: string): { node: MapNode; side: SideStop } {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const node = findNode(stage.map, stage.current);
  const side = node.sides.find((x) => x.id === sideId && x.kind === 'totem' && x.totemId);
  if (!side) throw new Error(`No Totem territory "${sideId}" here`);
  return { node, side };
}

function totemBoss(content: Content, run: RunState, def: TotemDef, key: string): { speciesId: string; level: number } {
  const stage = requireStage(run);
  const campaign = getCampaign(content, run.campaignId);
  const scale = levelScale(content, campaign, run.regionIndex, stage.index, campaign.columns);
  return { speciesId: totemSpecies(def, run, key), level: totemLevel(def, scale.end, scale.cap) };
}

/** Starts the Totem fight. The territory is used up at once, so a reload can't repeat it or its rewards. */
export function enterTotem(content: Content, current: RunState, sideId: string): RunState {
  assertPhase(current, 'map');
  const { node, side } = totemDen(current, sideId);
  if (side.used) throw new Error('This Totem has already been fought');
  const def = getTotem(content, side.totemId!);
  const activeIndex = current.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const run = structuredClone(current);
  totemDen(run, sideId).side.used = true;
  const { speciesId, level } = totemBoss(content, run, def, node.id + sideId);
  startTotemBattle(content, run, def, speciesId, level);
  return run;
}

/** Builds the Totem battle (mutates `run`). */
export function startTotemBattle(content: Content, run: RunState, def: TotemDef, speciesId: string, level: number): void {
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  const boss = newMon(content, run, speciesId, level, 'e');
  applyTotemHp(def, boss);
  boss.hp = maxHp(content, boss);
  run.battle = createBattle('wild', [boss], activeIndex, run.party[activeIndex]!.uid);
  run.battle.ai = 0.6;
  run.battle.totem = freshTotemBattle(def, boss.uid);
  // True 2v1: the ally stands beside the Totem from the start (a double battle, so you need two Pokémon able to fight).
  if (def.twoVsOne && def.ally && run.party.filter((p) => p.hp > 0).length >= 2) {
    const ally = newMon(content, run, def.ally.species, allyLevel(def, boss.level), 'e');
    run.battle.enemyTeam.push(ally);
    run.battle.totem.allyUid = ally.uid;
    run.battle.totem.callsUsed = def.ally.maxCalls;
    makeDoubles(run.battle, run.party);
  }
  run.totems.entered += 1;
  discover(run, boss.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
}

/** Totem victory: money, items, draft choices, a rare Pokémon, an unlock and research (once: the battle is cleared right after). */
function claimTotemRewards(content: Content, run: RunState, battle: BattleState): { items: string[]; draftExtra: number; money: number } {
  const def = getTotem(content, battle.totem!.id);
  const totem = battle.enemyTeam.find((m) => m.uid === battle.totem!.uid) ?? currentEnemy(battle);
  const money = def.rewards.moneyPerLevel * totem.level;
  run.money += money;
  count(run, 'moneyEarned', money);
  const rng = new Rng(hashSeed(`${run.seed}::totem-reward::${def.id}:${run.encountersCompleted}`));
  const items = def.rewards.items.filter((i) => rng.chance(i.chance)).map((i) => i.item);
  if (def.rewards.megaStones > 0) {
    const stones = pickStones(content, run, def.rewards.megaStones, new Rng(hashSeed(`${run.seed}::totem-stones::${def.id}:${run.encountersCompleted}`)));
    if (stones.length > 0 && itemCount(run.inventory, 'mega-ring') === 0) items.push('mega-ring');
    items.push(...stones.map((stone) => stone.id));
  }
  const rare = def.rewards.rareJoin;
  if (rare && rng.chance(rare.chance)) {
    const mon = newMon(content, run, rare.species, Math.max(2, totem.level - 2), 'p');
    count(run, 'pokemonCaught');
    discover(run, mon.speciesId, true);
    run.pending.unshift({ kind: 'caught', mon });
  }
  run.totems.won += 1;
  count(run, 'totemsWon');
  run.totems.done.push(def.id);
  run.totems.research += def.rewards.research;
  if (def.rewards.unlock && !run.totems.unlocks.includes(def.rewards.unlock)) run.totems.unlocks.push(def.rewards.unlock);
  return { items, draftExtra: def.rewards.draftExtra, money };
}

/**
 * NARRATIVE_DEFEAT (M12): the rival won a battle the story needed the player to lose. The run goes on as if the fight were won:
 * the node counts as done, but no prize, EXP, badge, win counters, defeat record or protection item is touched, and
 * nobody is harmed (the party is healed). Only the story and rival layers record the loss.
 */
function narrativeDefeatEnd(content: Content, run: RunState, def: NonNullable<ReturnType<typeof getNarrativeDef>>): void {
  const battle = run.battle!;
  recordNarrativeDefeat(content, run, def, battle.rivalId);
  healParty(content, run);
  count(run, 'narrativeDefeats');
  run.hype = 0;
  run.battle = null;
  delete run.recorder;
  run.encountersCompleted += 1;
  count(run, 'encountersCompleted');
  tickEggs(content, run, 'battle');
  run.afterDecisions = 'map';
  continueAfterDecisions(content, run);
}

/** A lost or timed-out raid: no rewards, the party is back on its feet, and the run goes on. */
function failRaid(content: Content, run: RunState): void {
  const battle = run.battle!;
  const raidId = battle.raid?.id ?? battle.totem!.id;
  if (battle.raid && getRaid(content, battle.raid.id).grand) endGrandBattle(content, run, false, run.party[battle.activeIndex]?.uid);
  const frac = battle.totem ? content.totems.failureHealFraction : content.raids.failureHealFraction;
  // The timer ran out: the boss escapes and comes back in a later stage, changed (once).
  const raid = battle.raid;
  if (raid && raid.timerLeft !== null && raid.timerLeft <= 0 && !raid.returning) {
    run.raids.escaped.push(raid.id);
    const lead = run.party.find((p) => p.uid === raid.lead);
    if (lead) {
      emit(content, run, 'storyMoment', { actors: [lead.uid], data: { raidMemory: 'gotAway', raid: raid.id }, importance: 70, text: `The One That Got Away: ${speciesName(content, currentEnemy(battle).speciesId)} escaped from ${speciesName(content, lead.speciesId)}'s team.` });
    }
  }
  for (const mon of run.party) {
    mon.hp = Math.max(1, Math.floor(maxHp(content, mon) * frac));
    mon.status = null;
  }
  if (battle.totem) {
    run.totems.lost += 1;
    run.totems.done.push(raidId);
  } else {
    run.raids.lost += 1;
    run.raids.done.push(raidId);
  }
  run.battle = null;
  run.phase = 'map';
}


/** Raid victory: money, item rolls (a seeded generator), extra draft choices and maybe the boss joining (applies once: the battle is cleared right after). */
function claimRaidRewards(content: Content, run: RunState, battle: BattleState): { items: string[]; draftExtra: number; money: number; notes?: string[] } {
  const def = raidDef(content, battle.raid!);
  const boss = currentEnemy(battle);
  const money = Math.floor((def.rewards.moneyPerLevel * boss.level * battle.raid!.rewardPercent * (battle.raid!.rivalFinished ? 0.5 : 1)) / 100);
  run.money += money;
  count(run, 'moneyEarned', money);
  const rng = new Rng(hashSeed(`${run.seed}::raid-reward::${def.id}:${run.encountersCompleted}`));
  const items = def.rewards.items.filter((i) => rng.chance(i.chance)).map((i) => i.item);
  if (rng.chance(def.rewards.joinChance)) {
    const joined = structuredClone(boss);
    joined.uid = nextUid(run, 'p');
    delete joined.statBoosts;
    // A rescued Shadow boss keeps its Heart Gauge: the purification journey starts here.
    joined.hp = maxHp(content, joined);
    joined.status = null;
    count(run, 'pokemonCaught');
    discover(run, joined.speciesId, true);
    run.pending.unshift({ kind: 'caught', mon: joined, raidTier: def.tier });
  }
  // Mega resources and rare-encounter tokens roll from their own generator, so no other roll changes.
  if (def.rewards.megaStones > 0) {
    const stones = pickStones(content, run, def.rewards.megaStones, new Rng(hashSeed(`${run.seed}::raid-stones::${def.id}:${run.encountersCompleted}`)));
    if (stones.length > 0 && itemCount(run.inventory, 'mega-ring') === 0) items.push('mega-ring');
    items.push(...stones.map((stone) => stone.id));
  }
  if (def.rewards.rareEncounters > 0) {
    run.perkEffects.push(...RARE_TOKEN_EFFECTS);
    run.tempEffects.push({ effects: RARE_TOKEN_EFFECTS, battles: def.rewards.rareEncounters, until: 'wild' });
  }
  // Raid memories: rewards follow contribution, not only the last hit.
  const bossName = speciesName(content, boss.speciesId);
  const earned = new Set<string>();
  for (const m of battle.raid!.rivalFinished ? [] : raidMemories(battle, run.party[battle.activeIndex]?.uid)) {
    const mon = run.party.find((p) => p.uid === m.uid);
    if (!mon) continue;
    emit(content, run, 'storyMoment', { actors: [mon.uid], data: { raidMemory: m.key, raid: def.id }, importance: 70, text: `${m.title}: ${m.text(speciesName(content, mon.speciesId), bossName)}` });
    if (!earned.has(mon.uid)) changeFriendship(content, mon, RAID_MEMORY_FRIENDSHIP);
    earned.add(mon.uid);
  }
  const lead = run.party.find((p) => p.uid === battle.raid!.lead);
  const named = battle.raid!.rival;
  const rivalName = named?.name ?? 'a rival';
  if (battle.raid!.rivalHelped && lead && !battle.raid!.rivalFinished) {
    emit(content, run, 'storyMoment', { actors: [lead.uid], data: { raidMemory: 'rival', raid: def.id, rival: named?.id ?? null }, importance: 70, text: `The Rival Who Stood Beside You: ${rivalName} fought ${bossName} at ${speciesName(content, lead.speciesId)}'s side.` });
    changeFriendship(content, lead, RAID_MEMORY_FRIENDSHIP);
  }
  if (named) {
    const rival = run.story.rivals.find((r) => r.id === named.id);
    // A raced boss makes the rivalry hotter whoever wins; a rival that took the last hit is proud of it.
    if (rival && named.mode === 'race') rival.rivalPotential += battle.raid!.rivalFinished ? 2 : 1;
    if (named.mode === 'race' || battle.raid!.rivalFinished) {
      emit(content, run, 'storyMoment', { actors: lead ? [lead.uid] : [], data: { raidMemory: 'rival-race', raid: def.id, rival: named.id, rivalFinished: battle.raid!.rivalFinished }, importance: 65, text: battle.raid!.rivalFinished ? `${rivalName} took the last hit on ${bossName}.` : `You beat ${rivalName} to the last hit on ${bossName}.` });
    }
  }
  // An anomaly raid adds a research find and its own counter.
  if (def.kind === 'anomaly') {
    count(run, 'anomalyRaidsWon');
    run.totems.research += 2;
  }
  run.raids.won += 1;
  count(run, 'raidsWon');
  run.raids.bestTier = Math.max(run.raids.bestTier, def.tier);
  // Kept as a counter so the account remembers it (profile best "raidBestTier") and opens the next tier in later runs.
  run.log.counters.raidBestTier = run.raids.bestTier;
  run.raids.done.push(def.id);
  if (def.grand) endGrandBattle(content, run, true, run.party[battle.activeIndex]?.uid);
  const notes = def.gang ? gangRaidWon(content, run, def) : undefined;
  return { items, draftExtra: Math.max(0, def.rewards.draftExtra + battle.raid!.draftDelta), money, notes };
}

/**
 * Sets up the battle for a map node (mutates `run`). A VS Seeker rematch passes
 * a generator of its own, so the encounter stream (and every later battle) is unchanged.
 */
export function startEncounter(content: Content, run: RunState, node: MapNode, rematch?: Rng): void {
  const stage = run.stage!;
  const archetype = runArchetype(content, run);
  const theme = getTheme(content, stage.themeId);
  const campaign = getCampaign(content, run.campaignId);
  const scale = withPartyStrength(content, stage.kind === 'league' ? leagueScale(content, run.regionIndex) : levelScale(content, campaign, run.regionIndex, stage.index, node.column), run.party.map((p) => p.level));
  // Counts stages from the start of the run (trainer and gym teams grow with it).
  const stageNumber = run.regionIndex * campaign.stagesPerRegion + stage.index;
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  if (activeIndex < 0) throw new Error('No healthy Pokémon to battle with');
  const activeUid = run.party[activeIndex]!.uid;

  if (node.kind === 'wild') {
    // Map items (Flutes, Incense, Mail, Poké Radar...) change the wild Pokémon; their own rolls use a generator of their own.
    const mods = activeMods(content, run);
    const plan = withStream(run.rng, 'encounter', (r) => {
      const [lo, hi] = content.balance.difficulty.harderBonus;
      const bonus = (node.harder ? r.int(lo, hi) : 0) + wildLevelBonus(content, run, mods);
      const shiny = runAttributeEffects(content, run).shinyChance * wildShinyMultiplier(content, run, mods);
      return planWild(content, archetype, theme, scale, bonus, r, run.regionOrder[run.regionIndex], shiny);
    });
    let speciesId = lockSpecies(content, run, wildSpeciesWithItems(content, run, theme, plan.speciesId, mapItemRng(run, node.id), mods), `wild:${node.id}`);
    const legendary = rollLegendaryWild(content, new Rng(hashSeed(`${run.seed}:legendary:${run.encountersCompleted}:${node.id}`)), run.regionIndex, encounterWeightPerk(archetype.modifiers, 'legendary'));
    if (legendary) speciesId = legendary;
    else speciesId = spookyWild(content, run, speciesId, `wild:${node.id}`, spookyEncounterChance(runPerks(content, run)));
    const opened = legendary ? { speciesId, level: plan.level } : openingWild(content, run, speciesId, plan.level, `wild:${node.id}`);
    speciesId = opened.speciesId;
    // The gentle opening caps the wild level after the difficulty bonus too, so Nightmare's first fight is not a level 9 against a level 5 starter.
    // A wild nemesis takes this encounter instead (built from the planned level, so no roll changes).
    const nemesis = legendary ? null : dueNemesis(content, run, 'wild');
    const back = nemesis ? nemesisMember(content, nemesis, opened.level) : null;
    const enemy = back
      ? newMon(content, run, back.member.speciesId, back.member.level, 'e', content.balance.difficulty.maxLevel)
      : newMon(content, run, speciesId, opened.level, 'e', !legendary && run.encountersCompleted < content.balance.opening.encounters ? content.balance.opening.maxLevel : content.balance.difficulty.maxLevel);
    if (back) enemy.moves = back.member.moves!.map((id) => ({ id, pp: content.moves.get(id)!.pp }));
    enemy.shiny = back ? false : plan.shiny;
    if (plan.shiny) countShiny(run, speciesId);
    outbreakShadow(content, run, enemy, node.id);
    run.battle = createBattle('wild', [enemy], activeIndex, activeUid);
    run.battle.levelInfo = [plan.levelInfo];
    if (nemesis && back) beginNemesisBattle(content, run, nemesis, back.change, null);
    const setup = wildBattleSetup(content, run, mods);
    if (setup.drop) run.itemCounters = { ...run.itemCounters, 'pinap-drop': 1 };
    if (setup.freeTurns > 0) run.battle.mapItems = { freeTurns: setup.freeTurns, thrown: 0 };
    if (setup.foeSpeed !== 0) run.battle.enemyStages.spe = Math.max(-6, Math.min(6, run.battle.enemyStages.spe + setup.foeSpeed));
    useWildBattleCharges(run);
    // Wild Pokémon sometimes come in pairs (a second, ordinary one from this stage's pool, rolled by its own generator).
    const doublesCfg = content.balance.doubles;
    const pairRng = new Rng(hashSeed(`${run.seed}::wild-doubles::${run.regionIndex}::${stage.index}::${node.id}::${run.encountersCompleted}`));
    if (!legendary && !run.battle.mapItems && stageNumber >= doublesCfg.fromStage && run.party.filter((m) => m.hp > 0).length >= 2 && pairRng.chance(doublesCfg.wildChance)) {
      const second = planWild(content, archetype, theme, scale, 0, pairRng, run.regionOrder[run.regionIndex], runAttributeEffects(content, run).shinyChance);
      const partner = newMon(content, run, lockSpecies(content, run, second.speciesId, `wild2:${node.id}`), Math.min(second.level, enemy.level + 2), 'e');
      partner.shiny = second.shiny;
      if (partner.shiny) countShiny(run, partner.speciesId);
      run.battle.enemyTeam.push(partner);
      run.battle.levelInfo = [...(run.battle.levelInfo ?? []), second.levelInfo];
      makeDoubles(run.battle, run.party);
    }
  } else {
    const roll = <T>(fn: (r: Rng) => T): T => (rematch ? fn(rematch) : withStream(run.rng, 'encounter', fn));
    let plan: TrainerPlan = roll((r) => {
      switch (node.kind) {
        case 'gym':
          return planGymLeader(content, archetype, stage.leaderId, stageNumber, scale, r, bossRemix(run.rules));
        case 'elite': {
          const memberId = stage.eliteFour[node.column - 1];
          if (!memberId) throw new Error(`No Elite Four member for column ${node.column}`);
          return planEliteFour(content, archetype, memberId, run.regionIndex, scale, r, bossRemix(run.rules));
        }
        case 'champion':
          return planChampion(content, archetype, stage.leaderId, run.regionIndex, scale, r, bossRemix(run.rules) || run.story.flags[FINALE_FLAG] === 'pending', isFinalBoss(content, run));
        default:
          return planTrainer(content, archetype, theme, stageNumber, scale, r, run.regionOrder[run.regionIndex]);
      }
    });
    // Trainer tiers: an ordinary trainer's team grows more skilled with progress (its own seed, so no roll changes).
    if (node.kind === 'trainer') {
      const known = readTrainerMemory(run, plan.classId);
      plan = applyTrainerTier(content, plan, { stageNumber, partyBonus: scale.party ?? 0, classWins: known.wins, rematch: !!rematch, important: false }, scale.cap, `${run.seed}::${run.regionIndex}::${node.id}`, known.memory);
    }
    // Meteor's Prophecy: every third boss is stronger.
    const bossLevels = thirdBossLevels(runPerks(content, run));
    if (bossLevels > 0 && (node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion')) {
      const c = run.log.counters;
      if (((c.gymLeadersDefeated ?? 0) + (c.eliteFourDefeated ?? 0) + (c.championsDefeated ?? 0) + 1) % 3 === 0) plan = { ...plan, members: plan.members.map((m) => ({ ...m, level: m.level + bossLevels })) };
    }
    // The Rival Who Wins Without You (left-out 5.5): a rival that took over a Gym, reached the finals or became
    // Champion stands in for that boss once (the badge and rewards stay the boss's).
    const takeover = node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion' ? takeoverRival(run, node.kind) : null;
    const takeoverRule = takeover ? rematchRule(content) : null;
    if (takeover && takeoverRule) {
      const ret = rivalReturn(content, run, takeover, plan, takeoverRule.effect);
      plan = { ...plan, name: takeover.name, members: ret.plan.members, ai: Math.max(plan.ai, ret.plan.ai) };
      markTakeover(run, takeover);
    }
    // The first rival: the first ordinary trainer of balance.rival.stage is scripted (one starter-line Pokémon).
    const firstRival = node.kind === 'trainer' && !rematch && stageNumber === content.balance.rival.stage && run.story.flags[FIRST_RIVAL_FLAG] === undefined;
    if (firstRival) {
      plan = planFirstRival(content, run.seed);
      run.story.flags[FIRST_RIVAL_FLAG] = 'fighting';
    }
    // A trainer that vowed to return takes the place of the first ordinary trainer of a later stage.
    const rule = node.kind === 'trainer' && !rematch && !firstRival ? rematchRule(content) : null;
    const back = rule ? waitingTrainer(run) : null;
    if (rule && back) {
      plan = revisedTeam(content, run, back, plan, rule.effect);
      run.story.flags[returnFlag(back.id)] = 'returned';
    }
    // A rival that sparked earlier takes the first ordinary trainer slot once per region.
    const gauntlet = rule && !back ? gauntletRival(content, run) : null;
    const rivalBack = rule && !back ? (gauntlet ?? waitingRival(run, content)) : null;
    if (gauntlet) markGauntletFight(run, gauntlet);
    let rivalNote: string | null = null;
    let narrativeDef: ReturnType<typeof dueNarrativeDefeat> = null;
    let trainingIndex = -1;
    if (rule && rivalBack) {
      ensureAce(content, rivalBack);
      const ret = rivalReturn(content, run, rivalBack, plan, rule.effect);
      ret.plan = withSignatureAce(content, rivalBack, ret.plan);
      const trained = withTrainingEvolution(content, ret.plan.members);
      plan = { ...ret.plan, members: trained.members };
      trainingIndex = trained.index;
      const finale = finalRivalLine(content, run, rivalBack.id, ultimateRival(run)?.id === rivalBack.id);
      rivalNote = finale ? [ret.note, finale].filter(Boolean).join(' ') : ret.note;
      // Narrative defeat (M12): this meeting is the one the player is meant to lose; the meeting before hints at it.
      narrativeDef = dueNarrativeDefeat(run, rivalBack, !plan.leaderId);
      if (narrativeDef) {
        plan = { ...plan, members: plan.members.map((m) => ({ ...m, level: m.level + narrativeDef!.levelBonus })) };
        rivalNote = [rivalNote, narrativeDef.introLine].filter(Boolean).join(' ');
      } else {
        const hint = foreshadowNote(run, rivalBack);
        if (hint) rivalNote = [rivalNote, hint].filter(Boolean).join(' ');
      }
      // A rival far ahead of you: an ally or one of its enemies may join forces with you (heals your team, once per pair).
      const teamUp = narrativeDef ? null : rivalTeamUp(content, run, rivalBack);
      if (teamUp) {
        healParty(content, run);
        rivalNote = [rivalNote, teamUp].filter(Boolean).join(' ');
      }
      if (ret.note) rivalBack.adaptations.push(ret.note);
      run.story.flags[rivalReturnFlag(rivalBack.id)] = run.regionIndex;
      run.story.flags[rivalSeenFlag(rivalBack.id)] = scheduleKey(run);
      run.story.flags[RIVAL_SEEN_ANY] = scheduleKey(run);
      rivalBack.away = 0;
    }
    // Nemesis system: a nemesis takes the first ordinary trainer slot of a later stage (its Return, then its Reckoning).
    const nemesis = rule && !back && !rivalBack ? dueNemesis(content, run, 'trainer') : null;
    let nemesisSetup: { change: string | null; partner: Nemesis | null } | null = null;
    if (nemesis) {
      const r = nemesisTrainerPlan(content, run, nemesis, plan);
      plan = r.plan;
      nemesisSetup = r;
    }
    // Memories: a Previous-Run Gauntlet team, an Echo of a skipped branch, or a Ghost from a failed run takes the slot (one a stage).
    const memoryHit = rule && !back && !rivalBack && !nemesis ? memoryPick(content, run, plan) : null;
    if (memoryHit) plan = memoryHit.plan;
    // The Hunter Has Become the Hunted!: a class you keep beating sends a team built to beat your lead (once per region).
    const hunted = rule && !back && !rivalBack && !nemesis && !memoryHit && isHunted(content, run, plan.classId);
    if (hunted) {
      plan = withTeamTypes(content, plan, counterTypes(content, getSpecies(content, run.party[activeIndex]!.speciesId).types));
      markHunted(run);
    }
    // Boss Revenge Rematch: a boss you beat in an earlier region takes the first ordinary trainer slot, stronger and informed.
    const bossBack: BossRecord | null = rule && !back && !rivalBack && !nemesis && !hunted ? dueBossRematch(content, run) : null;
    if (bossBack) plan = bossRematchPlan(content, run, archetype, bossBack, stageNumber, scale, plan).plan;
    // RSVP Mail: the first ordinary trainer of the stage is a rival, a few levels up.
    const rsvp = node.kind === 'trainer' && !rematch && !back && !rivalBack && !firstRival && !nemesis && !hunted && !memoryHit && !bossBack ? perkItem(content, run, 'rival') : null;
    let isRival = false;
    if (rsvp && !usedThisStage(run, rsvp)) {
      isRival = true;
      markUsedThisStage(run, rsvp);
      const bonus = perksOf(activePerks(content, run), 'rival')[0]!.perk.levelBonus;
      plan = { ...plan, name: `Rival ${plan.name}`, members: plan.members.map((m) => ({ ...m, level: m.level + bonus })) };
    }
    // A boss's ace may start a stage lower and evolve in the middle of the fight (Battle Drama P5, now for gym, Elite Four and champion too).
    if (content.balance.bossEvolution && plan.leaderId && !rivalBack && !nemesis && !hunted && trainingIndex < 0) {
      const trained = withTrainingEvolution(content, plan.members);
      plan = { ...plan, members: trained.members };
      trainingIndex = trained.index;
    }
    const team = plan.members.map((m, i) => {
      const uid = nextUid(run, 'e');
      // Difficulty raises every enemy; Single Region Dex swaps ordinary trainers' species for ones from the locked generation (bosses keep theirs).
      const speciesId = plan.leaderId ? m.speciesId : lockSpecies(content, run, m.speciesId, `${node.id}:${i}`);
      const level = Math.max(1, Math.min(content.balance.difficulty.maxLevel, m.level + run.rules.enemyLevelBonus));
      return createPlannedPokemon(content, { ...m, speciesId, level }, uid, `${run.seed}:${uid}`);
    });
    run.battle = createBattle('trainer', team, activeIndex, activeUid, { classId: plan.classId, name: plan.name, leaderId: plan.leaderId });
    run.battle.ai = plan.ai;
    run.battle.levelInfo = plan.levelInfo;
    if (rematch) run.battle.rematch = true;
    if (back) run.battle.returning = back.id;
    if (isRival) run.battle.rival = true;
    if (firstRival) run.battle.firstRival = true;
    if (takeover && takeoverRule) {
      run.battle.rivalId = takeover.id;
      run.battle.rivalNote = frontRunnerIntro(content, takeover) ?? takeoverNote(content, takeover);
    }
    if (bossBack) beginBossRematch(run, bossBack);
    else if (node.kind === 'champion' && isFinalBoss(content, run)) run.battle.spectacle = { ...freshSpectacle(), final: true };
    if (nemesis && nemesisSetup) beginNemesisBattle(content, run, nemesis, nemesisSetup.change, nemesisSetup.partner);
    if (hunted) run.battle.hunted = true;
    if (memoryHit) run.battle.memory = memoryHit.memory;
    // Living Rival: a friend (or a rescued rival) arrives to help in the final boss (clear rules in rivals/living.ts).
    if (plan.classId === CHAMPION_CLASS && isFinalBoss(content, run)) {
      const assist = finaleAssistRival(content, run, Math.max(...team.map((m) => m.level)));
      if (assist) {
        run.battle.finaleAssist = assist;
        run.battle.rivalNote = [run.battle.rivalNote, `${assist.name} burst through the doors: "Not without me!"`].filter(Boolean).join(' ');
      }
    }
    if (plan.memoryNote && !hunted && !nemesis) run.battle.memoryNote = plan.memoryNote;
    // Some ordinary trainers fight two at a time (their own seed, so no other roll changes).
    const doublesCfg = content.balance.doubles;
    // Bosses known for double battles (Tate & Liza) always fight two at a time.
    if (plan.leaderId && doublesCfg.bossIds.includes(plan.leaderId) && canBeDoubles(run.party, team)) makeDoubles(run.battle, run.party);
    else if (node.kind === 'trainer' && !rematch && !back && !rivalBack && !isRival && !nemesis && !memoryHit && !bossBack && stageNumber >= doublesCfg.fromStage && canBeDoubles(run.party, team)) {
      if (new Rng(hashSeed(`${run.seed}::doubles::${run.regionIndex}::${stage.index}::${node.id}`)).chance(doublesCfg.chance)) makeDoubles(run.battle, run.party);
    }
    if (trainingIndex >= 0) run.battle.drama.evolvable.push(team[trainingIndex]!.uid);
    if (rivalBack) {
      run.battle.rivalId = rivalBack.id;
      if (rivalNote) run.battle.rivalNote = rivalNote;
      if (narrativeDef) run.battle.narrative = { id: narrativeDef.id, maxTurns: narrativeDef.maxTurns };
    }
    const role = node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion' ? node.kind : null;
    // Bosses hold items, from their own generator so no other roll changes.
    if (role) giveBossItems(content, team, role, run.regionIndex, new Rng(hashSeed(`${run.seed}::boss-items::${run.regionIndex}::${stage.index}::${node.id}`)));
    // Gym number counted from the start of the run (1 = the first gym).
    run.battle.transform.enemyMechanics = bossMechanics(content, role, run.badges.length + 1, run.disabledMechanics);
    // Meteor's Prophecy: every third boss also gains a random second type (its own seed, so no other roll changes).
    if (role && thirdBossLevels(runPerks(content, run)) > 0) {
      const c = run.log.counters;
      const bossNumber = (c.gymLeadersDefeated ?? 0) + (c.eliteFourDefeated ?? 0) + (c.championsDefeated ?? 0) + 1;
      if (bossNumber % 3 === 0) {
        const r = new Rng(hashSeed(`${run.seed}::boss-type::${bossNumber}`));
        for (const mon of run.battle.enemyTeam) run.battle.transform.bonusTypes[mon.uid] = TYPE_NAMES[r.int(0, TYPE_NAMES.length - 1)]!;
      }
    }
  }
  for (const mon of run.battle.enemyTeam) discover(run, mon.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
}

/**
 * Unscheduled challenge: a due rival cuts in on a stop before you use it. Returns the run with the battle begun,
 * or null when nobody does (nothing changes). Once per stage; the stop stays available afterwards.
 */
export function rivalChallenge(content: Content, current: RunState, sideId: string): RunState | null {
  if (current.phase !== 'map' || !current.stage || current.stage.current === null) return null;
  const node = findNode(current.stage.map, current.stage.current);
  const side = node.sides.find((s) => s.id === sideId);
  if (!side || waitingTrainer(current)) return null;
  const rival = interruptingRival(content, current, side);
  if (!rival) return null;
  const run = structuredClone(current);
  run.story.flags[interruptFlag(run)] = rival.id;
  startEncounter(content, run, { ...findNode(run.stage!.map, node.id), kind: 'trainer' });
  if (run.battle?.rivalId !== rival.id) return null;
  const where = side.kind === 'heal' ? 'a healing stop' : side.kind === 'event' ? 'an event' : 'a service stop';
  run.battle.rivalNote = `${run.story.rivals.find((r) => r.id === rival.id)!.name} cut in on you at ${where}! ${run.battle.rivalNote ?? ''}`.trim();
  recordBattleStart(content, run);
  return run;
}

/** Uses a healing stop or enters a shop beside the current node. */
export function visitSide(content: Content, current: RunState, sideId: string): { run: RunState; message: string } {
  assertPhase(current, 'map');
  const stage = requireStage(current);
  if (stage.current === null) throw new Error('Choose a node first');
  const side = findNode(stage.map, stage.current).sides.find((s) => s.id === sideId);
  if (!side) throw new Error(`No side stop "${sideId}" here`);
  if (side.kind === 'heal' && side.used) throw new Error('This healing stop has already been used');
  if (side.kind === 'fish') throw new Error('Choose a Pokémon to fish for (fishingOffer, then fish)');
  if (side.kind === 'raid') throw new Error('Review the raid first (raidPreview), then enterRaid');
  if (side.kind === 'event') throw new Error('Make a choice at the event (eventView, then chooseEvent)');
  if (side.kind === 'totem') throw new Error('Review the Totem first (totemPreview), then enterTotem');
  if (side.kind === 'service') throw new Error('Use the service menu (serviceView, then useService)');
  if (side.kind === 'plaza') throw new Error('Use the plaza menu (plazaView, then usePlaza)');
  const run = structuredClone(current);
  const runSide = findNode(run.stage!.map, stage.current).sides.find((s) => s.id === sideId)!;
  if (side.kind === 'heal' && noHealStops(run.rules)) return { run: current, message: 'Your No Rest contract forbids healing stops.' };
  if (side.kind === 'heal') {
    healParty(content, run);
    partyLifeCamp(run);
    runSide.used = true;
    count(run, 'healStopsUsed');
    // A Blissful Pokémon's aura calms the Shadow Pokémon resting beside it.
    const calmed = blissfulAtRest(content, run);
    takeCheckpoint(run);
    return { run, message: `Your Pokémon were fully healed!${calmed.length > 0 ? ` The Blissful aura lifts the haze from ${calmed.join(', ')}!` : ''}` };
  }
  run.phase = 'shop';
  // A Bike Voucher is traded for its bike (or money, if the player already has one).
  const voucher = voucherOf(content, run);
  if (voucher) {
    spendUse(run, voucher.itemId);
    const entry = content.catalog.get(voucher.item)!;
    const owned = run.passives?.[voucher.item] ?? 0;
    if (entry.max === null || owned < entry.max) {
      run.passives = { ...run.passives, [voucher.item]: owned + 1 };
      return { run, message: `Welcome to the shop! You traded your voucher for a ${entry.name}.` };
    }
    run.money += voucher.refund;
    count(run, 'moneyEarned', voucher.refund);
    return { run, message: `Welcome to the shop! You already have a ${entry.name}, so the voucher was worth ₽${voucher.refund}.` };
  }
  return { run, message: 'Welcome to the shop!' };
}

export function healParty(content: Content, run: RunState): void {
  for (const mon of run.party) {
    mon.hp = maxHp(content, mon);
    mon.status = null;
    for (const slot of mon.moves) slot.pp = maxPp(content, slot);
  }
}

/**
 * What the shop sells right now: more stock unlocks as the player earns badges,
 * and the Member Card and Wepear Berry put the next locked entries on sale early.
 * Key items you own aren't sold again.
 */
export function shopStock(content: Content, run: Pick<RunState, 'badges' | 'archetypeId'> & Partial<Pick<RunState, 'inventory' | 'rules' | 'perkEffects' | 'licenses'>> & MapItemRun): Content['shop'] {
  const noRevive = run.rules ? noRevives(run.rules) : false;
  const owned = (e: Content['shop'][number]) => !!run.inventory && ownsKeepsake(content, run.inventory, e.item);
  const open = (e: Content['shop'][number]) => run.badges.length >= shopBadgesNeeded(content, run, e);
  const early = content.shop
    .filter((e) => !open(e) && !owned(e))
    .sort((a, b) => shopBadgesNeeded(content, run, a) - shopBadgesNeeded(content, run, b))
    .slice(0, earlyStockCount(content, run) + shopEarlyStockPerk(runPerks(content, run)));
  // Ginter: the nearest locked entries for rare or epic items go on sale early too.
  const earlyRare = content.shop
    .filter((e) => !open(e) && !owned(e) && !early.includes(e) && ['rare', 'epic'].includes(content.catalog.get(e.item)?.rarity ?? ''))
    .sort((a, b) => shopBadgesNeeded(content, run, a) - shopBadgesNeeded(content, run, b))
    .slice(0, shopEarlyRareStockPerk(runPerks(content, run)));
  early.push(...earlyRare);
  // Rocket Boss Giovanni's Black Market sells everything, locked stock at a markup (shopPrice).
  const black = blackMarketMarkup(runPerks(content, run)) !== null;
  const modeStock = (content.balance.modeShops[run.rules?.modeId ?? ''] ?? []).filter((x) => content.items.has(x.item) && !content.shop.some((e) => e.item === x.item));
  const stock = [...content.shop, ...bankShopEntries(content, run.licenses).filter((x) => !content.shop.some((e) => e.item === x.item)), ...modeStock];
  return stock.filter((e) => (black || open(e) || early.includes(e)) && !owned(e) && !(noRevive && content.items.get(e.item)?.category === 'revive'));
}

/** Whether an entry is on sale only through the Black Market (your badges haven't opened it). */
export function isBlackMarket(content: Content, run: Pick<RunState, 'badges' | 'archetypeId'> & Partial<Pick<RunState, 'perkEffects'>>, entry: Content['shop'][number]): boolean {
  return blackMarketMarkup(runPerks(content, run)) !== null && run.badges.length < shopBadgesNeeded(content, run, entry);
}

/** Key items, Mega Stones and Z-Crystals last the whole run, so you only ever need one. */
function ownsKeepsake(content: Content, inventory: Record<string, number>, itemId: string): boolean {
  const kind = content.items.get(itemId)?.effect.kind;
  return (kind === 'keyItem' || kind === 'megaStone' || kind === 'zCrystal') && itemCount(inventory, itemId) > 0;
}

/** Badges needed before the shop sells an entry, after the trainer's shopUnlockOffset. */
export function shopBadgesNeeded(content: Content, run: Pick<RunState, 'archetypeId'>, entry: Content['shop'][number]): number {
  return Math.max(0, entry.minBadges - shopUnlockOffset(runArchetype(content, run)));
}

/** An entry's price for this run: some trainers pay more for some items, and Charisma lowers every price. */
/** The item on sale right now: one open item, chosen from the stage window (its own seed, so no other roll changes). */
export function shopSaleItem(content: Content, run: RunState): string | null {
  const open = shopStock(content, run).filter((e) => run.badges.length >= shopBadgesNeeded(content, run, e) && content.items.get(e.item)?.category !== 'key');
  if (open.length === 0) return null;
  const sale = content.balance.shopSale;
  const every = Math.max(1, Math.ceil(sale.everyStages * shopRefreshPerk(runPerks(content, run))));
  const stagesPer = getCampaign(content, run.campaignId).stagesPerRegion;
  const window = Math.floor((run.regionIndex * stagesPer + (run.stage?.index ?? 0)) / every);
  return new Rng(hashSeed(`${run.seed}::shop-sale::${window}`)).pick(open).item;
}

export function shopPrice(content: Content, run: RunState, entry: Content['shop'][number]): number {
  // Coupons lower the price; a full Point Card makes it free.
  const markup = isBlackMarket(content, run, entry) ? blackMarketMarkup(runPerks(content, run))! : 1;
  return Math.round(entry.price * markup * priceMultiplier(runArchetype(content, run), entry.item, content.items.get(entry.item)?.category === 'ball') * runAttributeEffects(content, run).price * priceMultiplierFromItems(content, run) * minigameDiscount(run) * (shopSaleItem(content, run) === entry.item ? 1 - content.balance.shopSale.discount : 1));
}

/** Base price for an item the shop doesn't list (urge items and other finds), by rarity. */
const RARITY_VALUE: Record<string, number> = { common: 60, uncommon: 120, rare: 240, epic: 480 };

/** What the shop pays for one of an item, or null when it can't be sold (keys, Mega gear, ...). Half the price, or all of it with a Seal Bag. */
export function sellPrice(content: Content, run: RunState, itemId: string): number | null {
  const item = content.items.get(itemId);
  if (!item || item.category === 'key' || item.category === 'transformation' || item.category === 'attribute') return null;
  const listed = content.shop.find((e) => e.item === itemId)?.price;
  const base = listed ?? RARITY_VALUE[content.catalog.get(itemId)?.rarity ?? 'common'] ?? 60;
  return Math.max(1, Math.floor(hasPerk(content, run, 'fullSell') ? base : base / 2));
}

/** Sells one of an item to the shop. */
export function sellItem(content: Content, current: RunState, itemId: string): { run: RunState; message: string } {
  assertPhase(current, 'shop');
  const item = getItem(content, itemId);
  const price = sellPrice(content, current, itemId);
  if (price === null) throw new Error(`The shop won't buy the ${item.name}.`);
  if (itemCount(current.inventory, itemId) <= 0) throw new Error(`You have no ${item.name} to sell.`);
  const run = structuredClone(current);
  consumeItem(run.inventory, itemId);
  run.money += price;
  count(run, 'moneyEarned', price);
  return { run, message: `You sold a ${item.name} for ₽${price}.` };
}

/** Buys one of an item at the shop. */
export function buyItem(content: Content, current: RunState, itemId: string): { run: RunState; message: string } {
  assertPhase(current, 'shop');
  const entry = content.shop.find((e) => e.item === itemId) ?? bankShopEntries(content, current.licenses).find((e) => e.item === itemId);
  if (!entry) throw new Error(`The shop doesn't sell "${itemId}"`);
  const item = getItem(content, itemId);
  if (ownsKeepsake(content, current.inventory, itemId)) throw new Error(`You already have the ${item.name}.`);
  const badges = shopBadgesNeeded(content, current, entry);
  if (!shopStock(content, current).some((e) => e.item === entry.item)) throw new Error(`The shop sells ${item.name} once you have ${badges} badges.`);
  const price = shopPrice(content, current, entry);
  if (current.money < price) throw new Error(`You need ₽${price} for a ${item.name}.`);
  const run = structuredClone(current);
  run.money -= price;
  count(run, 'moneySpent', price);
  afterPurchase(content, run, priceMultiplierFromItems(content, current) === 0);
  if (item.effect.kind === 'attribute') {
    // Attribute items work as soon as they're bought.
    const value = addItemAttribute(content, run, item.effect.attribute, item.effect.amount);
    return { run, message: `You bought a ${item.name} for ₽${price}: ${attributeText(item.effect.attribute, value)}.` };
  }
  addItem(run.inventory, itemId, 1);
  return { run, message: `You bought a ${item.name} for ₽${price}.` };
}

export function leaveShop(content: Content, current: RunState): RunState {
  assertPhase(current, 'shop');
  const run = structuredClone(current);
  run.phase = 'map';
  // A Wepear Berry's extra item lasts one shop visit.
  useUses(content, run, 'shops');
  return run;
}

/** Events the run adds to the battle engine's events (experience and level-ups). */
export type RunEvent =
  | BattleEvent
  | { type: 'xp'; uid: string; amount: number }
  | { type: 'levelUp'; uid: string; level: number }
  | { type: 'learnedMove'; uid: string; moveId: string }
  | { type: 'wantsMove'; uid: string; moveId: string };

export interface BattleEndResult {
  outcome: 'win' | 'caught';
  moneyGained: number;
  /** Bag items found after the battle (Loot Sack, Blue Card). */
  itemsFound: string[];
  caughtSpeciesId: string | null;
  /** Shadow Pokémon purified by this battle (names). */
  shadowPurified: string[];
  /** Recovery lines as a Shadow Pokémon opens up a stage ("Gastly: It nuzzles…"), snagged names, the Blissful aura's beneficiaries and a gang raid's aftermath. */
  shadowStages: string[];
  rescued: string[];
  blissfulHealed: string[];
  aftermath: string[];
  evolutions: (EvolutionResult & { uid: string })[];
  /** Moves devoted Pokémon learned from their bond after this win. */
  bondTaught?: { uid: string; moveId: string }[];
  /** Recap lines after a big trainer win (MVP, narrowest survival, turning point). */
  recap?: string[];
  /** The gym leader's id when this win beat a gym leader. */
  badge: string | null;
  /** The region's id when this win beat its champion. */
  regionCleared: string | null;
  /** The final boss fell for the first time and rises for a second phase. */
  finale?: boolean;
  /** What an event battle you won paid out, in words. */
  eventRewards: string[];
  /** True when this win beat the last champion and so won the run. */
  victory: boolean;
  /** King N's Voice of Pokémon: the defeated wild species that asked to join (its decision comes next). */
  voiceJoined?: string | null;
  /** Crafting materials this win dropped (material id → count). */
  materials?: Record<string, number>;
}

export interface TurnResult {
  run: RunState;
  events: RunEvent[];
  /** Set when the battle was won or the Pokémon caught. */
  end: BattleEndResult | null;
  defeated: boolean;
  /** Story moments to show while playing `events` (presentation only: never saved, never read by the rules). */
  cues: PresentationCue[];
  /** A raid was lost or timed out: the party is back on its feet and the map is next (the run goes on). */
  raidFailed?: boolean;
  /** A Battle Club match was lost: a friendly loss, nobody is out. */
  clubLost?: boolean;
  /** The whole party fainted but the rules sent the run back to its checkpoint. */
  wiped?: boolean;
  /** A narrative rival defeat (M12): the battle was lost for the story, the party is healed and the run goes on. Never a game over. */
  narrativeDefeat?: { id: string; defeatLine: string; victoryLine: string };
  /** What the trainer says during the turn (presentation only). */
  drama: DramaLine[];
}

/** The battle engine's view of the run's battle (the engine changes `run` in place). */
function battleContext(content: Content, run: RunState, rng: Rng, captureRng: Rng, hyperRng?: Rng): BattleContext {
  const archetype = runArchetype(content, run);
  syncHpPerks(content, archetype.modifiers, run.party);
  const attributes = runAttributeEffects(content, run);
  // Encore!: the run's Hype goes into the battle once.
  if (!run.battle!.hypeLoaded) {
    run.battle!.hype = run.hype;
    run.battle!.hypeLoaded = true;
  }
  return {
    content,
    battle: run.battle!,
    party: run.party,
    inventory: run.inventory,
    rng,
    captureRng,
    speciesCaught: run.log.speciesCaught,
    catchMultiplier: captureMultiplier(archetype) * attributes.catchRate * throwMultiplier(content, run, currentEnemy(run.battle!)) * wildCatchMultiplier(content, run),
    healMultiplier: healingMultiplier(archetype) * attributes.healing,
    typeModifiers: typeModifiers(archetype),
    perks: archetype.modifiers,
    starterUid: run.log.starterUid,
    attributes,
    disabledMechanics: run.disabledMechanics,
    hyper: hyperRng ? buildHyperContext(content, run, hyperRng) : undefined,
    teamItems: run.passives,
    noBattleItems: noBattleItems(run.rules),
    bondScore: (uid) => bondScoreOf(run.story.histories[uid]?.bond),
  };
}

/**
 * Battle start: plays both first Pokémon's entry abilities (Intimidate,
 * Drizzle). Does nothing if they already happened. Uses no random numbers.
 */
/** The trainer's opening line (shown once per battle; the saved state stops a repeat after a reload). */
export function battleOpening(content: Content, current: RunState, dialogue: DialogueFrequency = 'normal'): { run: RunState; drama: DramaLine[] } {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const drama = openingDrama(content, run, dialogue);
  return { run, drama };
}

export function beginBattle(content: Content, current: RunState): { run: RunState; events: RunEvent[] } {
  assertPhase(current, 'battle');
  if ((current.battle!.pendingEntry ?? []).length === 0) return { run: current, events: [] };
  const run = structuredClone(current);
  const rng = new Rng(run.rng.battle);
  const ctx = battleContext(content, run, rng, new Rng(run.rng.capture));
  const events = run.battle!.doubles ? startDoubles(ctx) : startBattle(ctx);
  run.rng.battle = rng.state;
  countAttributeGrowth(content, run, events);
  return { run, events };
}

/**
 * A double battle given one command (older callers, simple tools): it is the left-hand
 * Pokémon's, and its partner uses its first usable move on the first foe.
 */
function doublesAction(ctx: BattleContext, action: PlayerAction): PlayerAction {
  const d = ctx.battle.doubles!;
  if (action.kind === 'double' || ctx.battle.needsSwitch) return action;
  const commands = autoCommands(ctx);
  commands[primarySpot(d, 'player')] = { action };
  return { kind: 'double', commands };
}

export function takeTurn(content: Content, current: RunState, action: PlayerAction, dialogue: DialogueFrequency = 'normal'): TurnResult {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const battle = run.battle!;
  const rng = new Rng(run.rng.battle);
  const captureRng = new Rng(run.rng.capture);
  const hyperRng = new Rng(run.rng.hyper);
  const targetUid = currentEnemy(battle).uid;
  // Bond Engine: a willful Pokémon may refuse a reckless order, a synced one may step in (before the turn).
  const shaped = shapeAction(content, run, action);
  const wasForced = battle.needsSwitch;
  const outgoing = run.party[battle.activeIndex]?.uid;
  const enemyBefore = battle.enemyIndex;
  const turnCtx = battleContext(content, run, rng, captureRng, hyperRng);
  const engineEvents: BattleEvent[] = [...shaped.events, ...(battle.doubles ? resolveDoublesTurn(turnCtx, doublesAction(turnCtx, action)) : resolveTurn(turnCtx, shaped.action))];
  // A practiced pair hands over after a faint (yours, or a rival's).
  if (wasForced && action.kind === 'switch' && outgoing) {
    const combo = playerCombo(content, run, outgoing, run.party[action.partyIndex]!.uid);
    if (combo) engineEvents.push(combo);
  }
  const enemyCombo_ = enemyCombo(content, run, enemyBefore);
  if (enemyCombo_) engineEvents.push(enemyCombo_);
  updateBondsTurn(run, engineEvents);
  partyLifeTurn(content, run, engineEvents);
  run.rng.battle = rng.state;
  run.rng.capture = captureRng.state;
  run.rng.hyper = hyperRng.state;
  // Apricorns and the Fluffy Tail are used up by the throws they help.
  const thrownAt = engineEvents.some((e) => e.type === 'ball') ? (battle.enemyTeam.find((m) => m.uid === targetUid) ?? null) : null;
  if (thrownAt) useThrowCharges(content, run, thrownAt);
  if (engineEvents.some((e) => e.type === 'lastStand' && e.side === 'player')) run.log.charmUsedInRegion = true;
  countAttributeGrowth(content, run, engineEvents);
  applyHeldAttributes(content, run, engineEvents);
  for (const e of engineEvents) {
    const fainted = e.type === 'faint' && e.side === 'player' ? run.party.find((p) => p.uid === e.uid) : undefined;
    if (fainted) changeFriendship(content, fainted, content.balance.friendship.perFaint);
  }

  const events = awardExperience(content, run, engineEvents);
  // A rival's training Pokémon may evolve now that the turn is over (Battle Drama Engine, Phase 5).
  const evolved = midBattleEvolution(content, run);
  if (evolved) events.push(evolved);
  // A rival's battle style may do something now (berserker rage, revenge, last stand).
  const trick = styleTrick(content, run);
  if (trick) events.push(trick);
  // Bond Engine: a Pokémon at half HP may reveal a move it was ready to learn; a feeling may take hold.
  const rivalHere = battle.rivalId ? run.story.rivals.find((r) => r.id === battle.rivalId) : undefined;
  const reveal = [revealMove(content, run, 'player', false), revealMove(content, run, 'enemy', Boolean(rivalHere) && rivalBond(rivalHere, currentEnemy(battle).speciesId).confidence >= 40)];
  for (const r of reveal) if (r) events.push(r);
  events.push(...trackFeelings(content, current, run, events as BattleEvent[]));
  if (battle.outcome === 'win') bondVictory(run, Object.values(run.story.histories).filter((h) => h.lastBattle === run.encountersCompleted && run.party.some((m) => m.uid === h.uid)).map((h) => h.uid));
  if (battle.outcome === 'win') partyLifeVictory(content, run);
  const cues = recordBattleTurn(content, current, run, events);
  // Trainer dialogue for what just happened (presentation only: it never changes the battle).
  const drama = planDrama(content, run, current.battle!, events as BattleEvent[], dialogue);
  // Battle Replay: the big fights keep a short turn-by-turn record, sealed when the fight ends.
  noteReplayTurn(content, run, current.battle!, events as BattleEvent[]);
  if (battle.outcome) sealReplay(content, run);
  // Mega Evolution and other transformations end with the battle, and so do "next battle" item effects.
  if (battle.outcome) {
    revertTransformations(content, battle, run.party, runArchetype(content, run).modifiers);
    for (const mon of run.party) endHeldBattle(mon);
  }

  if (battle.outcome === 'win' && !run.party.some((m) => m.hp > 0)) {
    // A double KO that the player wins (recoil, Explosion by the foe) must not leave a team that cannot fight again.
    run.party[battle.activeIndex]!.hp = 1;
  }
  if (battle.outcome === 'win' || battle.outcome === 'caught') {
    const end = finishBattle(content, run);
    const caught = run.pending.find((d) => d.kind === 'caught');
    if (end.outcome === 'caught' && caught?.kind === 'caught') recordCaught(content, run, caught.mon);
    recordChanges(content, current, run, 'battle');
    return { run, events, end, defeated: false, cues, drama };
  }
  if (battle.outcome === 'lose' && battle.expedition && run.expedition) {
    run.expedition.battleResult = 'lose';
    run.battle = null;
    run.phase = 'expedition';
    recordChanges(content, current, run, 'battle');
    return { run, events, end: null, defeated: false, cues, drama, raidFailed: true };
  }
  if (battle.outcome === 'lose' && (battle.raid || battle.totem)) {
    failRaid(content, run);
    recordChanges(content, current, run, 'battle');
    return { run, events, end: null, defeated: false, cues, drama, raidFailed: true };
  }
  if (battle.outcome === 'lose' && battle.event?.eventId === 'plaza:club') {
    plazaClubLost(content, run);
    recordChanges(content, current, run, 'battle');
    return { run, events, end: null, defeated: false, cues, drama, clubLost: true };
  }
  if (battle.outcome === 'lose' && battle.narrative && getNarrativeDef(battle.narrative.id)) {
    const def = getNarrativeDef(battle.narrative.id)!;
    narrativeDefeatEnd(content, run, def);
    recordChanges(content, current, run, 'battle');
    return { run, events, end: null, defeated: false, cues, drama, narrativeDefeat: { id: def.id, defeatLine: def.defeatLine, victoryLine: def.victoryLine } };
  }
  if (battle.outcome === 'lose') {
    const enemy = currentEnemy(battle);
    run.log.defeatedBy = { speciesId: enemy.speciesId, level: enemy.level, trainer: battle.trainer?.name ?? null };
    // VS Recorder: the trainer battle replays from the start, once per run.
    if (battle.kind === 'trainer' && run.recorder) {
      const replay = structuredClone(run.recorder) as unknown as RunState;
      replay.itemCounters = { ...replay.itemCounters, 'vs-recorder-used': 1 };
      return { run: replay, events, end: null, defeated: false, cues, drama, wiped: true };
    }
    // Adventure and Death-Block: a wipe sends you back to the checkpoint instead of ending the run.
    const back = restoreAfterWipe(content, run);
    if (back) {
      recordChanges(content, current, back, 'battle');
      return { run: back, events, end: null, defeated: false, cues, drama, wiped: true };
    }
    run.phase = 'over';
    recordChanges(content, current, run, 'battle');
    return { run, events, end: null, defeated: true, cues, drama };
  }
  recordChanges(content, current, run, 'battle');
  return { run, events, end: null, defeated: false, cues, drama };
}

/**
 * Held items that change the run's attributes: healing berries' side effects,
 * and the Scarves (+1 per knockout, at most `cap` from each Scarf in a run).
 */
function applyHeldAttributes(content: Content, run: RunState, events: BattleEvent[]): void {
  for (const e of events) {
    if (e.type !== 'held' || e.what !== 'attribute' || !e.attribute || !e.amount) continue;
    const effect = content.catalog.get(e.itemId)?.effect;
    const cap = effect?.kind === 'held' ? effect.hooks.find((h) => h.hook === 'koAttribute')?.cap : undefined;
    let amount = e.amount;
    if (cap !== undefined) {
      const key = `ko:${e.itemId}`;
      const used = run.itemCounters?.[key] ?? 0;
      amount = Math.max(0, Math.min(amount, cap - used));
      if (amount === 0) continue;
      run.itemCounters = { ...run.itemCounters, [key]: used + amount };
    }
    addRunAttribute(content, run, e.attribute as AttributeKey, amount);
  }
}

/** Transformation mastery (catalog 82): which counter a player transformation feeds once the battle is won. */
const MASTERY_OF: Partial<Record<string, 'megaMastery' | 'teraMastery' | 'dynamaxMastery' | 'zMastery'>> = {
  mega: 'megaMastery', primal: 'megaMastery', tera: 'teraMastery', dynamax: 'dynamaxMastery', gigantamax: 'dynamaxMastery', zmove: 'zMastery',
};

/** A won battle turns the transformations used in it into mastery; any other end drops them. */
function settleMastery(run: RunState, won: boolean): void {
  for (const k of ['megaMastery', 'teraMastery', 'dynamaxMastery', 'zMastery'] as const) {
    const key = `xform.${k}`;
    const n = run.itemCounters?.[key] ?? 0;
    if (n > 0 && won) count(run, k, n);
    if (run.itemCounters && key in run.itemCounters) run.itemCounters = { ...run.itemCounters, [key]: 0 };
  }
}

/** Counts what grows attributes: stats your Pokémon raise on themselves, and enemies defeated or caught by type. */
function countAttributeGrowth(content: Content, run: RunState, events: BattleEvent[]): void {
  const battle = run.battle!;
  for (const e of events) {
    if (e.type === 'stat' && e.side === 'player' && e.change > 0) count(run, 'statsBoosted');
    const xform = e.type === 'transform' && e.side === 'player' ? MASTERY_OF[e.kind] : undefined;
    if (xform) run.itemCounters = { ...run.itemCounters, [`xform.${xform}`]: (run.itemCounters?.[`xform.${xform}`] ?? 0) + 1 };
    const defeated =
      e.type === 'faint' && e.side === 'enemy' ? battle.enemyTeam.find((m) => m.uid === e.uid) : e.type === 'ball' && e.caught ? currentEnemy(battle) : undefined;
    if (defeated) for (const type of getSpecies(content, defeated.speciesId).types) count(run, `defeatedOrCaught.${type}`);
  }
}

/**
 * Gives experience to every participant still standing when an enemy faints
 * or is caught (full experience each, as in Gen 6+). Inserts xp/level-up
 * events right after the faint or catch so they're shown in order.
 */
function awardExperience(content: Content, run: RunState, events: BattleEvent[]): RunEvent[] {
  const battle = run.battle!;
  const effects = runAttributeEffects(content, run);
  const archetype = runArchetype(content, run);
  const bossBattle = isBossClass(battle.trainer?.classId);
  // White Flute: more EXP from wild battles.
  const multiplier = xpMultiplier(runArchetype(content, run)) * content.balance.difficulty.xpScale * (getMode(run.rules.modeId)?.xpScale ?? 1) * (battle.doubles ? 1 : singleBattleXpPerk(runArchetype(content, run).modifiers)) * effects.exp * (battle.kind === 'wild' ? wildExpMultiplier(content, run) : 1);
  const out: RunEvent[] = [];
  for (const e of events) {
    out.push(e);
    let defeated: PokemonInstance | undefined;
    let participants: string[] = [];
    if (e.type === 'faint' && e.side === 'enemy') {
      defeated = battle.enemyTeam.find((m) => m.uid === e.uid);
      participants = e.participants;
    } else if (e.type === 'ball' && e.caught) {
      defeated = currentEnemy(battle);
      participants = battle.participants.filter((uid) => run.party.some((p) => p.uid === uid && p.hp > 0));
    }
    if (!defeated) continue;
    const baseExp = getSpecies(content, defeated.speciesId).baseExp;
    // Exp. Share: party members that didn't battle get its percent of the EXP.
    const share = expShareUnlocked(content, run) ? Math.max(passivePercent(content, run, 'expShare'), content.balance.difficulty.benchXpPercent) : 0;
    const sharers = share > 0 ? run.party.filter((p) => p.hp > 0 && !participants.includes(p.uid)).map((p) => p.uid) : [];
    const leadLevel = run.party[0]?.level ?? 0;
    for (const uid of [...participants, ...sharers]) {
      const mon = run.party.find((p) => p.uid === uid);
      if (!mon || mon.hp <= 0) continue;
      // Teachy TV: Pokémon below the lead's level catch up faster.
      const catchUp = mon.level < leadLevel ? passivePercent(content, run, 'catchUpExp') : 0;
      // Macho Brace: more EXP for its holder.
      const monSpecies = getSpecies(content, mon.speciesId);
      const perkXp = xpPerk(archetype.modifiers, { types: monSpecies.types, baseSpeed: monSpecies.baseStats.spe, isStarter: run.log.starterUid === mon.uid, isBossBattle: bossBattle, ultraBeast: isUltraBeast(mon.speciesId), isHatched: mon.hatched === true, isDoubles: battle.doubles !== undefined });
      const full = xpForDefeat(baseExp, defeated.level, mon.level, multiplier * perkXp * (1 + catchUp / 100) * expMultiplier(content, mon));
      const squirt = mon === run.party[0] && (run.itemCounters?.['squirt-exp'] ?? 0) > 0 ? 1 + (perksOf(activePerks(content, run), 'squirt')[0]?.perk.percent ?? 5) / 100 : 1;
      const amount = Math.floor((participants.includes(uid) ? full : Math.floor((full * Math.min(100, share)) / 100)) * squirt);
      if (amount <= 0) continue;
      const result = gainXp(content, mon, amount, runLevelCap(content, run));
      out.push({ type: 'xp', uid, amount });
      if (result.levelsGained > 0) {
        out.push({ type: 'levelUp', uid, level: result.newLevel });
        growthOnLevelUp(content, mon, result.newLevel - result.levelsGained);
        changeFriendship(content, mon, content.balance.friendship.perLevel * result.levelsGained, effects.friendship);
      }
      for (const moveId of result.learnedMoves) out.push({ type: 'learnedMove', uid, moveId });
      for (const moveId of result.skippedMoves) {
        out.push({ type: 'wantsMove', uid, moveId });
        run.pending.push({ kind: 'learnMove', uid, moveId });
      }
    }
  }
  return out;
}

/** After a win or a catch: prize money, evolutions, then decisions or the reward draft. */
function finishBattle(content: Content, run: RunState): BattleEndResult {
  const battle = run.battle!;
  // A temporary ally goes home: no experience, no catch-up, and it never stays in the party.
  if (battle.loaner) {
    run.party = run.party.filter((m) => m.uid !== battle.loaner);
    battle.participants = battle.participants.filter((u) => u !== battle.loaner);
  }
  const archetype = runArchetype(content, run);
  let base: number;
  const topLevel = Math.max(...battle.enemyTeam.map((m) => m.level));
  const { money } = content.balance;
  const classId = battle.trainer?.classId;
  if (classId === GYM_LEADER_CLASS) {
    base = money.gymLeaderPerLevel * topLevel;
  } else if (classId === ELITE_FOUR_CLASS) {
    base = money.eliteFourPerLevel * topLevel;
  } else if (classId === CHAMPION_CLASS) {
    base = money.championPerLevel * topLevel;
  } else if (battle.kind === 'trainer' && battle.trainer) {
    // An event's trainer (no trainer class) pays the events' rate.
    base = (content.trainers.get(battle.trainer.classId)?.moneyPerLevel ?? content.balance.events.trainerMoneyPerLevel) * topLevel;
  } else {
    base = content.balance.money.wildPerEnemyLevel * currentEnemy(battle).level;
  }
  // Amulet Coin (all prize money) and Luck Incense (trainers only) add their percent per copy.
  const itemBonus = passivePercent(content, run, 'money') + (battle.kind === 'trainer' ? passivePercent(content, run, 'trainerMoney') : 0);
  // Reply and Bead Mail (trainers), Soot Sack (wild battles on its type's stages).
  const theme = run.stage ? (content.themes.get(run.stage.themeId) ?? null) : null;
  const mapItemMoney = prizeMoneyFromItems(content, run, battle.kind, theme);
  // A VS Seeker rematch pays double.
  const rematch = battle.rematch ? 2 : 1;
  const doublesBonus = battle.doubles ? doubleBattleRewardPerk(archetype.modifiers) : 1;
  let moneyGained = Math.floor(base * rematch * doublesBonus * moneyMultiplier(archetype) * (isBossClass(classId) ? bossMoneyPerk(archetype.modifiers) * (classId === CHAMPION_CLASS ? championMoneyPerk(archetype.modifiers) : 1) : ordinaryMoneyPerk(archetype.modifiers)) * runAttributeEffects(content, run).money * (1 + (itemBonus + mapItemMoney.percent) / 100)) + mapItemMoney.flat;
  // Trainers.md perks: boss prize money, and the prize after catching a wild Pokémon.
  const perks = runPerks(content, run);
  if (battle.outcome === 'caught') moneyGained = Math.floor(moneyGained * catchMoneyPerk(perks));
  moneyGained = Math.floor(moneyGained * battleMoneyScale(run.rules));
  if (battle.kind === 'trainer') moneyGained += quickWinBonus(run.rules, battle.turn - 1);
  run.money += moneyGained;
  count(run, 'moneyEarned', moneyGained);
  // Powder Jar and Gooey Mulch: every Berry your side ate this battle.
  const eaten = battle.held?.berries ?? 0;
  if (eaten > 0) {
    const jar = eaten * passivePercent(content, run, 'berryMoney');
    run.money += jar;
    count(run, 'moneyEarned', jar);
    const peace = eaten * passivePercent(content, run, 'berryPeace');
    if (peace > 0) addRunAttribute(content, run, 'ragePeace', -peace);
  }

  let caughtSpeciesId: string | null = null;
  const caughtPending: PendingDecision[] = [];
  const itemsFoundByRaid: string[] = [];
  if (battle.outcome === 'caught') {
    const caught = structuredClone(currentEnemy(battle));
    caught.uid = nextUid(run, 'p');
    shiftLevel(content, run, caught, catchLevelOffset(runPerks(content, run)) + palPadLevels(content, run));
    // Friend, Luxury and Heal Ball.
    const ball = battle.ball ? content.items.get(battle.ball)?.effect : undefined;
    if (ball?.kind === 'catch' && ball.after === 'friend') caught.friendship = Math.max(caught.friendship, 200);
    if (ball?.kind === 'catch' && ball.after === 'luxury') caught.friendship = Math.min(255, caught.friendship + 40);
    if (ball?.kind === 'catch' && ball.after === 'heal') caught.hp = maxHp(content, caught);
    caughtSpeciesId = caught.speciesId;
    count(run, 'pokemonCaught');
    // Photo Album: a species caught for the first time this run gives Love.
    const album = passivePercent(content, run, 'newSpeciesLove');
    if (album > 0 && !run.log.speciesCaught.includes(caught.speciesId)) addRunAttribute(content, run, 'love', album);
    // Champion Oak's Field Research: a species caught for the first time this run pays money.
    const research = fieldResearchMoney(runPerks(content, run));
    if (research > 0 && !run.log.speciesCaught.includes(caught.speciesId)) {
      run.money += research;
      count(run, 'moneyEarned', research);
      moneyGained += research;
    }
    // Seal Case: a catch brings Luck.
    const seals = perksOf(activePerks(content, run), 'sealCase').reduce((sum, p) => sum + p.perk.luck * p.copies, 0);
    if (seals > 0) addRunAttribute(content, run, 'luck', seals);
    discover(run, caught.speciesId, true);
    caughtPending.push({ kind: 'caught', mon: caught });
  }
  // King N's Voice of Pokémon: a wild Pokémon you defeated may ask to join, no ball needed.
  let voiceJoined: string | null = null;
  if (battle.outcome === 'win' && battle.kind === 'wild' && !battle.trainer && !battle.raid && !battle.totem && !battle.expedition && voiceAsksToJoin(runPerks(content, run), run)) {
    const joined = structuredClone(currentEnemy(battle));
    joined.uid = nextUid(run, 'p');
    joined.hp = maxHp(content, joined);
    joined.status = null;
    count(run, 'pokemonCaught');
    discover(run, joined.speciesId, true);
    caughtPending.push({ kind: 'caught', mon: joined });
    voiceJoined = joined.speciesId;
  }

  // Snagged Shadow Pokémon (Snag Ball) join you once the fight is won; a lost fight loses them.
  const rescued: string[] = [];
  if (battle.outcome === 'win') {
    for (const taken of battle.snagged ?? []) {
      const mon = structuredClone(taken);
      mon.uid = nextUid(run, 'p');
      count(run, 'pokemonCaught');
      discover(run, mon.speciesId, true);
      addFlag(run, 'snagged');
      addFlag(run, 'rescued');
      caughtPending.push({ kind: 'caught', mon });
      rescued.push(speciesName(content, mon.speciesId));
    }
  }

  let shadowPurified: string[] = [];
  const shadowStages: string[] = [];
  let blissfulHealed: string[] = [];
  if (battle.outcome === 'win') {
    if (battle.rivalId) count(run, 'rivalBattlesWon');
    const { perBattleWon, perBossWon } = content.balance.friendship;
    const boss = classId === GYM_LEADER_CLASS || classId === ELITE_FOUR_CLASS || classId === CHAMPION_CLASS;
    const gainMultiplier = runAttributeEffects(content, run).friendship;
    for (const mon of run.party) {
      if (mon.hp > 0 && battle.participants.includes(mon.uid)) changeFriendship(content, mon, boss ? perBossWon : perBattleWon, gainMultiplier);
    }
    // Shadow Pokémon that fought are soothed; at 0 the haze lifts.
    shadowPurified = soothePartyAfterBattle(content, run, battle.participants, shadowStages);
    // Freeing a Pokémon from the haze is a kindness the world remembers.
    if (shadowPurified.length > 0) addFlag(run, 'kindness', shadowPurified.length);
    blissfulHealed = blissfulAfterBattle(content, run);
  }

  const evolutions: BattleEndResult['evolutions'] = [];
  for (const mon of noEvolution(run.rules) ? [] : run.party) {
    for (const evo of evolveFully(content, mon, run.regionOrder[run.regionIndex], evolutionLevelOffset(runArchetype(content, run).modifiers), bondEvolves(content, run, mon))) {
      evolutions.push({ ...evo, uid: mon.uid });
      for (const moveId of evo.wantsToLearn) run.pending.push({ kind: 'learnMove', uid: mon.uid, moveId });
    }
  }
  count(run, 'evolutions', evolutions.length);
  settleMastery(run, battle.outcome === 'win');
  const bondTaught = battle.outcome === 'win' ? bondLessons(content, run, battle.participants) : [];
  const recap = battle.outcome === 'win' && battle.kind === 'trainer' && (battle.ai >= 0.5 || battle.trainer?.leaderId || battle.rivalId) ? recapLines(content, run, battle) : [];
  // The caught Pokémon's decision comes first.
  run.pending = [...caughtPending, ...run.pending];
  // A trainer's signature mechanic (Rival's Answer): choose after the battle.
  run.pending.push(...signatureDecisions(content, run, battle));

  const outcome = battle.outcome as 'win' | 'caught';
  const raidWin = battle.raid && outcome === 'win' ? claimRaidRewards(content, run, battle) : battle.totem && outcome === 'win' ? claimTotemRewards(content, run, battle) : null;
  if (raidWin) {
    itemsFoundByRaid.push(...raidWin.items);
    moneyGained += raidWin.money;
  }
  // Crafting materials from the foe's type (own generator; a catch pays none).
  let materialsGained: Record<string, number> = {};
  if (outcome === 'win') {
    const foe = battle.kind === 'trainer' ? battle.enemyTeam[0]! : currentEnemy(battle);
    const kind = battle.trainer?.leaderId ? 'boss' : battle.kind === 'trainer' ? 'trainer' : 'wild';
    materialsGained = gainBattleMaterials(run, getSpecies(content, foe.speciesId).types, kind, battle.raid ? getRaid(content, battle.raid.id).tier : 0, battle.raid?.id ?? 'b');
  }
  const won = outcome === 'win' && battle.trainer?.leaderId ? battle.trainer.leaderId : null;
  const badge = won && classId === GYM_LEADER_CLASS ? won : null;
  if (badge) {
    run.badges.push(badge);
    // Coin Case: interest on the money held; Fashion Case: Charisma per stage cleared.
    const interest = Math.floor((run.money * passivePercent(content, run, 'gymInterest')) / 100);
    run.money += interest;
    count(run, 'moneyEarned', interest);
    const charisma = passivePercent(content, run, 'stageCharisma');
    if (charisma > 0) addRunAttribute(content, run, 'charisma', charisma);
    plantBerries(content, run);
  }
  // Loot Sack and Blue Card: Bag items after trainer wins, from a generator of their own.
  // Bridge Mail S: the next trainer's reward draft gets the gym leader's odds.
  const bridge = perkItem(content, run, 'betterDraft');
  if (outcome === 'win' && battle.kind === 'trainer' && bridge) {
    spendUse(run, bridge);
    run.itemCounters = { ...run.itemCounters, 'better-draft': 1 };
  }
  // Bloom Mail: one more choice in the draft after a trainer win. Dowsing Machine: one more in each stage's first draft.
  let extraChoices = raidWin?.draftExtra ?? 0;
  if (battle.firstRival) run.story.flags[FIRST_RIVAL_FLAG] = 'met';
  if (battle.narrative) narrativeWon(run, battle.narrative.id);
  // RSVP Mail: beating the rival gives the gym leader's odds and one more choice.
  if (outcome === 'win' && battle.rival) {
    run.itemCounters = { ...run.itemCounters, 'better-draft': 1 };
    extraChoices += 1;
  }
  if (outcome === 'win' && battle.kind === 'trainer' && hasPerk(content, run, 'extraChoice')) extraChoices += 1;
  // Looker: some wins add a reward choice (a generator of its own, so no other roll moves).
  const bonusChance = bonusRewardChancePerk(runArchetype(content, run).modifiers);
  if (outcome === 'win' && bonusChance > 0 && new Rng(hashSeed(`${run.seed}::bonus-reward::${run.encountersCompleted}`)).float() < bonusChance) extraChoices += 1;
  const dowsing = perkItem(content, run, 'dowsing');
  if (dowsing && !battle.fishing && !usedThisStage(run, dowsing)) {
    markUsedThisStage(run, dowsing);
    extraChoices += 1;
  }
  if (extraChoices > 0) run.itemCounters = { ...run.itemCounters, 'draft-extra': extraChoices };
  const stock = shopStock(content, run).map((e) => ({ item: e.item, price: e.price }));
  const itemsFound =
    outcome === 'win' && battle.kind === 'trainer'
      ? afterTrainerWin(content, run, stock, new Rng(hashSeed(`${run.seed}::trainer-loot::${run.encountersCompleted}`)))
      : [...itemsFoundByRaid];
  // Itemfinder: the hidden item at this stage's marked wild stop.
  const hidden = battle.kind === 'wild' ? hiddenItemFound(content, run, stock) : null;
  if (hidden) itemsFound.push(hidden);
  const dropped = battle.kind === 'wild' ? catchDrop(run, stock, outcome === 'caught') : null;
  if (dropped) itemsFound.push(dropped);
  for (const id of itemsFound) addItem(run.inventory, id, 1);
  if (outcome === 'win') {
    count(run, 'battlesWon');
    const role = classId === GYM_LEADER_CLASS ? 'gymLeadersDefeated' : classId === ELITE_FOUR_CLASS ? 'eliteFourDefeated' : classId === CHAMPION_CLASS ? 'championsDefeated' : null;
    if (role) {
      count(run, role);
      recordBossDefeat(content, run, battle);
      onFrontRunnerBattle(content, run, battle, 'win');
      const lead = run.party[battle.activeIndex];
      for (const type of lead ? getSpecies(content, lead.speciesId).types : []) count(run, `bossWinsLead.${type}`);
      // Trainer unlock feats: every Pokémon in the party shares a type, or the party is one Pokémon.
      const partyTypes = run.party.map((m) => getSpecies(content, m.speciesId).types);
      if (partyTypes.length > 0) for (const type of partyTypes[0]!) if (partyTypes.every((t) => t.includes(type))) count(run, `bossWinsMono.${type}`);
      if (run.party.length === 1) count(run, 'bossWinsSolo');
    } else {
      count(run, battle.kind === 'wild' ? 'wildDefeated' : 'trainersDefeated');
      if (battle.kind === 'trainer' && battle.trainer && !battle.trainer.leaderId && !battle.event && !battle.rival) noteFoe(run, battle.trainer.name, battle.trainer.classId);
    }
  }
  // Encore! Hype carries between battles and resets after a boss battle.
  run.hype = isBossClass(classId) ? 0 : battle.hype;
  tickTempEffects(run, battle, isBossClass(classId));
  if (won) {
    const share = postBattleHealShare(runArchetype(content, run).modifiers);
    if (share > 0) for (const mon of run.party) if (mon.hp > 0) mon.hp = Math.min(maxHp(content, mon), mon.hp + Math.ceil(maxHp(content, mon) * share));
  }
  // The Elite Four heal your party after each battle.
  if (won && classId === ELITE_FOUR_CLASS) healParty(content, run);
  let regionCleared: string | null = null;
  // The final boss rises again: its first defeat starts a second phase (a remixed team) instead of ending the run.
  const finale = !!won && classId === CHAMPION_CLASS && isFinalBoss(content, run) && run.story.flags[FINALE_FLAG] === undefined;
  if (finale) {
    run.story.flags[FINALE_FLAG] = 'pending';
    healParty(content, run);
  } else if (won && classId === CHAMPION_CLASS) {
    if (run.story.flags[FINALE_FLAG] === 'pending') run.story.flags[FINALE_FLAG] = 'done';
    regionCleared = currentRegion(content, run).id;
    run.regionsCleared.push(regionCleared);
    count(run, 'regionsCleared');
    if (!run.log.charmUsedInRegion) count(run, 'regionsClearedNoCharm');
    if (run.log.starterUid && run.party.some((m) => m.uid === run.log.starterUid)) count(run, 'regionsClearedWithStarter');
    if (run.regionIndex + 1 >= run.regionOrder.length && !extendEndless(run)) run.victory = true;
  }
  run.battle = null;
  delete run.recorder;
  if ((run.itemCounters?.['squirt-exp'] ?? 0) > 0) run.itemCounters = { ...run.itemCounters, 'squirt-exp': 0 };
  run.encountersCompleted += 1;
  count(run, 'encountersCompleted');
  run.log.battlesWon += 1;
  // Eggs: one more battle (won or caught) for every battle Egg (stage Eggs count at each new stage).
  if (!run.victory) tickEggs(content, run, 'battle');
  // A Pokémon from a past run comes to meet you (after any caught Pokémon's decision).
  const reunion = run.reunion;
  if (reunion && !reunion.done && !run.victory && run.encountersCompleted >= reunion.afterEncounters) {
    reunion.done = true;
    const level = Math.max(...battle.enemyTeam.map((m) => m.level));
    const mon = reunionPokemon(content, reunion.mon, level, nextUid(run, 'p'));
    run.pending.splice(caughtPending.length, 0, { kind: 'reunion', mon, hallOfFame: reunion.mon.hallOfFame });
    count(run, 'reunions');
  }
  // A veteran may offer to mentor a younger teammate.
  graduateMentorships(content, run);
  const mentorOffer = !run.victory ? planMentorship(content, run) : null;
  if (mentorOffer) run.pending.push({ kind: 'mentorship', ...mentorOffer });
  const leadAsk = !run.victory && battle.outcome === 'win' && !mentorOffer ? planAskLead(content, run) : null;
  if (leadAsk) run.pending.push({ kind: 'askLead', ...leadAsk });
  // An event battle you won pays its own rewards.
  const chained = outcome === 'win' && !!battle.event && eventChainNext(content, run, battle.event);
  const eventRewards = outcome === 'win' && battle.event && !chained ? (battle.event.eventId === 'plaza:club' ? plazaClubWon(content, run) : eventBattleWon(content, run, battle.event)) : [];
  // A fished Pokémon is an extra catch, and an event battle has its own rewards: no reward draft after them.
  run.afterDecisions = chained ? 'eventChain' : battle.expedition ? 'expedition' : battle.fishing || battle.event ? 'map' : 'reward';
  continueAfterDecisions(content, run);
  return { outcome, moneyGained, itemsFound, caughtSpeciesId, shadowPurified, shadowStages, rescued, blissfulHealed, aftermath: (raidWin as { notes?: string[] } | null)?.notes ?? [], evolutions, bondTaught, recap, badge, regionCleared, finale, victory: run.victory, eventRewards, voiceJoined, materials: materialsGained };
}

/**
 * Drops move-learning decisions that no longer apply: duplicates (a level-up
 * and an evolution can both offer the same move), moves already known, and
 * Pokémon no longer in the party.
 */
function prunePending(run: RunState): void {
  const seen = new Set<string>();
  run.pending = run.pending.filter((d) => {
    if (d.kind !== 'learnMove') return true;
    const key = `${d.uid}:${d.moveId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const mon = run.party.find((p) => p.uid === d.uid);
    return !!mon && !mon.moves.some((m) => m.id === d.moveId);
  });
}

/** Moves on once no decisions are pending: to the reward draft, or to the next battle. */
export function continueAfterDecisions(content: Content, run: RunState): void {
  prunePending(run);
  if (run.pending.length > 0) {
    run.phase = 'decision';
    return;
  }
  if (run.victory) {
    // The last champion is beaten: the run is won.
    run.draft = null;
    run.phase = 'over';
    return;
  }
  if (run.afterDecisions === 'eventChain') return continueEventChain(content, run);
  if (run.afterDecisions === 'expedition' && run.expedition) {
    run.expedition.battleResult = 'win';
    run.phase = 'expedition';
    return;
  }
  if (run.afterDecisions === 'reward') {
    const better = (run.itemCounters?.['better-draft'] ?? 0) > 0;
    if (better) run.itemCounters = Object.fromEntries(Object.entries(run.itemCounters!).filter(([key]) => key !== 'better-draft'));
    const weights = luckWeights(better ? content.balance.bossRarityWeights : rewardWeights(content, run), runAttributeEffects(content, run));
    run.draft = newDraft(content, run, weights);
    run.phase = 'reward';
    return;
  }
  // Back to the map. After the gym leader, the next stage (or the league) begins;
  // after the champion, the next region.
  const stage = run.stage;
  const kind = stage && stage.current !== null ? findNode(stage.map, stage.current).kind : null;
  if (!stage) {
    enterStage(content, run, 0); // a save from before stage maps existed
  } else if (kind === 'gym') {
    const campaign = getCampaign(content, run.campaignId);
    if (stage.index + 1 >= campaign.stagesPerRegion) enterLeague(content, run);
    else enterStage(content, run, stage.index + 1);
  } else if (kind === 'champion' && run.story.flags[FINALE_FLAG] === 'pending') {
    // Phase two: back to the foot of the last node, so the champion can be chosen again.
    const last = stage!.map.nodes.find((n) => n.next.includes(stage!.current!));
    stage!.current = last ? last.id : null;
    run.phase = 'map';
  } else if (kind === 'champion') {
    enterNextRegion(content, run);
  } else {
    run.phase = 'map';
  }
}

/** A fresh reward draft. The draft items' extra choices and carried-over rewards (Lock Capsule, Favored Mail) are used up here. */
function newDraft(content: Content, run: RunState, weights: Parameters<typeof generateDraft>[3]): string[] {
  const extra = run.itemCounters?.['draft-extra'] ?? 0;
  const forced = run.draftCarry ?? [];
  if (extra > 0) run.itemCounters = Object.fromEntries(Object.entries(run.itemCounters!).filter(([key]) => key !== 'draft-extra'));
  delete run.draftCarry;
  return withStream(run.rng, 'reward', (r) => generateDraft(content, run, r, weights, undefined, { size: content.balance.draftSize + extra, forced }));
}

/** Puts a reward into the next draft (once). */
function carryReward(run: RunState, rewardId: string): void {
  if (!(run.draftCarry ?? []).includes(rewardId)) run.draftCarry = [...(run.draftCarry ?? []), rewardId];
}

export type DraftItemKind = 'reroll' | 'lock';

/** Uses left of the Bag item behind a reward-screen action: Cornn Berry re-rolls one choice, Lock Capsule carries one into the next draft. */
export function draftItemUses(content: Content, run: RunState, kind: DraftItemKind): number {
  const itemId = perkItem(content, run, kind === 'reroll' ? 'rerollOne' : 'lockOne');
  return itemId ? usesLeft(run, itemId) : 0;
}

/** Uses a Cornn Berry (swap one draft choice for a new one) or a Lock Capsule (that choice comes back in the next draft too). */
export function useDraftItem(content: Content, current: RunState, kind: DraftItemKind, draftIndex: number): { run: RunState; message: string } {
  assertPhase(current, 'reward');
  const rewardId = current.draft?.[draftIndex];
  if (!rewardId) throw new Error(`Invalid reward choice ${draftIndex}`);
  const itemId = perkItem(content, current, kind === 'reroll' ? 'rerollOne' : 'lockOne');
  if (!itemId) throw new Error(kind === 'reroll' ? 'You have no Cornn Berry' : 'You have no Lock Capsule');
  const run = structuredClone(current);
  spendUse(run, itemId);
  const name = content.rewards.get(rewardId)!.name;
  if (kind === 'lock') {
    carryReward(run, rewardId);
    return { run, message: `${name} is locked in: it will be in the next draft too.` };
  }
  const weights = luckWeights(rewardWeights(content, run), runAttributeEffects(content, run));
  const fresh = withStream(run.rng, 'reward', (r) => generateDraft(content, run, r, weights, undefined, { size: 1, exclude: run.draft! }))[0]!;
  run.draft![draftIndex] = fresh;
  return { run, message: `${name} was swapped for ${content.rewards.get(fresh)!.name}.` };
}

/** Better rewards after harder routes and gym leaders. */
function rewardWeights(content: Content, run: RunState) {
  const stage = run.stage;
  if (!stage || stage.current === null) return content.balance.rarityWeights;
  const node = findNode(stage.map, stage.current);
  if (node.kind === 'gym' || node.kind === 'elite' || node.kind === 'champion') return content.balance.bossRarityWeights;
  if (node.harder) return content.balance.harderRarityWeights;
  return content.balance.rarityWeights;
}

export type DecisionChoice =
  | { kind: 'forgetMove'; moveIndex: number }
  | { kind: 'skipMove' }
  | { kind: 'addToParty' }
  | { kind: 'replace'; partyIndex: number }
  | { kind: 'release' }
  | { kind: 'sendToBox' }
  | { kind: 'signature'; optionIndex: number }
  | { kind: 'keepsake' }
  | { kind: 'teachMove'; moveIndex: number }
  | { kind: 'ppUpMove'; moveIndex: number }
  | { kind: 'mentor'; accept: boolean }
  | { kind: 'askLead'; accept: boolean };

export interface DecisionResult {
  run: RunState;
  message: string;
}

/** Answers the oldest pending decision. Replacing or releasing can't be undone, so the screen confirms first. */
export function resolveDecision(content: Content, current: RunState, choice: DecisionChoice): DecisionResult {
  assertPhase(current, 'decision');
  const run = structuredClone(current);
  const decision = run.pending[0];
  if (!decision) throw new Error('No decision is pending');
  let message: string;
  let followUp: PendingDecision | null = null;

  if (decision.kind === 'learnMove') {
    const mon = run.party.find((p) => p.uid === decision.uid);
    const move = content.moves.get(decision.moveId)!;
    if (!mon) {
      message = '';
    } else if (choice.kind === 'forgetMove') {
      const old = mon.moves[choice.moveIndex];
      if (!old) throw new Error(`Invalid move slot ${choice.moveIndex}`);
      mon.moves[choice.moveIndex] = { id: move.id, pp: move.pp };
      message = `${speciesName(content, mon.speciesId)} forgot ${content.moves.get(old.id)!.name} and learned ${move.name}!`;
    } else if (choice.kind === 'skipMove') {
      message = `${speciesName(content, mon.speciesId)} did not learn ${move.name}.`;
    } else {
      throw new Error('Choose a move to forget, or skip');
    }
  } else if (decision.kind === 'caught') {
    const caught = decision.mon;
    const name = speciesName(content, caught.speciesId);
    if (choice.kind === 'addToParty') {
      if (run.party.length >= partyCapacity(content, run)) throw new Error('Your party is full');
      const problem = joinProblem(content, run, caught.speciesId);
      if (problem) throw new Error(problem);
      run.party.push(caught);
      count(run, 'caughtKept');
      message = `${name} joined your party!`;
    } else if (choice.kind === 'replace') {
      const old = run.party[choice.partyIndex];
      if (!old) throw new Error('Choose a party member to replace');
      const problem = joinProblem(content, run, caught.speciesId, old.uid);
      if (problem) throw new Error(problem);
      run.party[choice.partyIndex] = caught;
      count(run, 'caughtKept');
      message = `${speciesName(content, old.speciesId)} left the party. ${name} joined!`;
    } else if (choice.kind === 'sendToBox') {
      if (run.box.length >= boxCapacity(runPerks(content, run))) throw new Error('The PC is full');
      run.box.push(caught);
      count(run, 'caughtKept');
      message = `${name} was sent to the PC.`;
    } else if (choice.kind === 'release') {
      assertCanRelease(content, run, joinProblem(content, run, caught.speciesId) !== null);
      const candies = candiesForRelease(content, caught.level);
      run.candies += candies;
      count(run, 'candiesEarned', candies);
      count(run, 'caughtToCandies');
      message = `${name} was released. You got ${candies} cand${candies === 1 ? 'y' : 'ies'}.`;
      recordReleased(content, run, caught);
    } else {
      throw new Error('Choose what to do with the caught Pokémon');
    }
  } else if (decision.kind === 'reunion') {
    const mon = decision.mon;
    const name = speciesName(content, mon.speciesId);
    if (choice.kind === 'addToParty') {
      if (run.party.length >= partyCapacity(content, run)) throw new Error('Your party is full');
      const problem = joinProblem(content, run, mon.speciesId);
      if (problem) throw new Error(problem);
      run.party.push(mon);
      message = `${name} joined your party again!`;
    } else if (choice.kind === 'replace') {
      const old = run.party[choice.partyIndex];
      if (!old) throw new Error('Choose a party member to replace');
      run.party[choice.partyIndex] = mon;
      message = `${speciesName(content, old.speciesId)} left the party. ${name} joined you again!`;
    } else if (choice.kind === 'keepsake') {
      const candies = candiesForRelease(content, mon.level) * content.balance.reunion.keepsakeCandyMultiplier;
      run.candies += candies;
      count(run, 'candiesEarned', candies);
      message = `${name} left you a keepsake: ${candies} cand${candies === 1 ? 'y' : 'ies'}.`;
    } else if (choice.kind === 'release') {
      message = `${name} went on with its own journey.`;
    } else {
      throw new Error('Choose what to do with the past Pokémon');
    }
  } else if (decision.kind === 'mentorship') {
    if (choice.kind !== 'mentor') throw new Error('Accept or decline the mentorship');
    message = answerMentorship(content, run, decision, choice.accept);
  } else if (decision.kind === 'askLead') {
    if (choice.kind !== 'askLead') throw new Error('Say yes or not now');
    message = answerAskLead(content, run, decision, choice.accept);
  } else if (decision.kind === 'teachMove') {
    const mon = run.party.find((p) => p.uid === decision.uid);
    if (!mon) {
      message = '';
    } else if (choice.kind === 'teachMove') {
      const moveId = decision.moveIds[choice.moveIndex];
      if (!moveId) throw new Error(`Invalid move choice ${choice.moveIndex}`);
      const move = content.moves.get(moveId)!;
      if (mon.moves.length < 4) {
        mon.moves.push({ id: move.id, pp: move.pp });
        message = `${speciesName(content, mon.speciesId)} learned ${move.name}!`;
      } else {
        // Four moves known: ask which to forget, like a level-up move.
        followUp = { kind: 'learnMove', uid: mon.uid, moveId };
        message = `${speciesName(content, mon.speciesId)} wants to learn ${move.name}.`;
      }
    } else if (choice.kind === 'skipMove') {
      message = `The ${decision.itemName} went unused.`;
    } else {
      throw new Error('Choose a move to teach, or skip');
    }
  } else if (decision.kind === 'signature') {
    if (choice.kind !== 'signature') throw new Error('Choose one of the options');
    const chosen = chooseSignatureOption(run, choice.optionIndex);
    message = chosen.message;
    for (const [itemId, qty] of Object.entries(chosen.grant?.items ?? {})) addItem(run.inventory, itemId, qty);
    if (chosen.grant?.partyLevels) shiftPartyLevels(content, run, chosen.grant.partyLevels);
  } else {
    const mon = run.party.find((p) => p.uid === decision.uid);
    if (!mon) {
      message = '';
    } else if (choice.kind === 'ppUpMove') {
      const slot = mon.moves[choice.moveIndex];
      if (!slot) throw new Error(`Invalid move slot ${choice.moveIndex}`);
      const room = MAX_PP_UPS - (slot.ppUps ?? 0);
      if (room <= 0) throw new Error('That move already has the most PP it can.');
      const before = maxPp(content, slot);
      slot.ppUps = (slot.ppUps ?? 0) + Math.min(room, decision.ups);
      slot.pp += maxPp(content, slot) - before;
      message = `${content.moves.get(slot.id)!.name}'s max PP rose to ${maxPp(content, slot)}!`;
    } else if (choice.kind === 'skipMove') {
      message = `The ${decision.itemName} went unused.`;
    } else {
      throw new Error('Choose a move for the ' + decision.itemName);
    }
  }

  run.pending.shift();
  if (followUp) run.pending.unshift(followUp);
  continueAfterDecisions(content, run);
  recordChanges(content, current, run, 'level');
  return { run, message };
}

export interface RewardChoiceResult {
  run: RunState;
  reward: RewardResult;
}

/**
 * Applies exactly one reward from the draft. Rewards for a Pokémon go to
 * `targetIndex`. Then any new decisions (from a level-up), then the next battle.
 */
export function chooseReward(content: Content, current: RunState, draftIndex: number, targetIndex = 0): RewardChoiceResult {
  assertPhase(current, 'reward');
  const rewardId = current.draft?.[draftIndex];
  if (!rewardId) throw new Error(`Invalid reward choice ${draftIndex}`);
  const problem = rewardTargetProblem(content, current, content.rewards.get(rewardId)!, targetIndex);
  if (problem) throw new Error(problem);
  const run = structuredClone(current);
  const reward = withStream(run.rng, 'reward', (r) => applyReward(content, run, runArchetype(content, run), rewardId, targetIndex, r));
  count(run, 'moneyEarned', run.money - current.money);
  if (reward.reroll) {
    // A free re-roll: a fresh draft, still in the reward phase.
    const weights = luckWeights(rewardWeights(content, run), runAttributeEffects(content, run));
    run.draft = newDraft(content, run, weights);
    return { run, reward };
  }
  // Favored Mail: the best reward you skipped comes back in the next draft (the earlier one on a tie).
  const favored = perkItem(content, run, 'favored');
  if (favored) {
    const skipped = current.draft!.filter((_, i) => i !== draftIndex).map((id) => content.rewards.get(id)!);
    const best = skipped.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity))[0];
    if (best) {
      spendUse(run, favored);
      carryReward(run, best.id);
      reward.messages.push(`The Favored Mail keeps ${best.name} for your next draft.`);
    }
  }
  run.draft = null;
  run.pending.push(...reward.pending);
  run.afterDecisions = 'map';
  recordRewardTaken(content, run, rewardId);
  continueAfterDecisions(content, run);
  recordChanges(content, current, run, 'reward');
  return { run, reward };
}

/** Uses a Bag item on a party member between battles. */
export function useItemOutsideBattle(content: Content, current: RunState, itemId: string, partyIndex: number, evolveTo?: string): { run: RunState; message: string } {
  assertPhase(current, 'reward', 'decision', 'map', 'shop');
  const item = getItem(content, itemId);
  if (!item.usableOutside) throw new Error(`${item.name} can't be used outside battle`);
  if (itemCount(current.inventory, itemId) <= 0) throw new Error(`You have no ${item.name}`);
  const target = current.party[partyIndex];
  if (!target) throw new Error('Choose a Pokémon');
  const regionId = current.regionOrder[current.regionIndex];
  const problem = itemUseProblem(content, item, target, regionId);
  if (problem) throw new Error(problem);
  if (item.effect.kind === 'evolve' && noEvolution(current.rules)) throw new Error('Your No Evolution contract forbids evolving.');
  const run = structuredClone(current);
  const message = applyItemToPokemon(content, item, run.party[partyIndex]!, {
    regionId,
    evolveTo,
    healMultiplier: healingMultiplier(runArchetype(content, run)) * runAttributeEffects(content, run).healing,
  });
  if (item.effect.kind === 'evolve') count(run, 'evolutions');
  consumeItem(run.inventory, itemId);
  recordChanges(content, current, run, 'item');
  return { run, message };
}

/** Whether a Bag item can be cashed in now: it has a cash-in value and nobody in the party can use it. */
export function canCashIn(content: Content, run: RunState, itemId: string): boolean {
  const item = content.items.get(itemId);
  if (!item?.cashIn || itemCount(run.inventory, itemId) <= 0) return false;
  const regionId = run.regionOrder[run.regionIndex];
  return !run.party.some((mon) => itemUseProblem(content, item, mon, regionId) === null);
}

/** Trades an evolution item nobody in the party can use for its attribute bonus (M8.75 item effects). */
export function cashInItem(content: Content, current: RunState, itemId: string): { run: RunState; message: string } {
  assertPhase(current, 'reward', 'decision', 'map', 'shop');
  const item = getItem(content, itemId);
  if (!canCashIn(content, current, itemId)) throw new Error(`The ${item.name} can't be cashed in right now`);
  const run = structuredClone(current);
  consumeItem(run.inventory, itemId);
  const parts = Object.entries(item.cashIn!).map(([key, amount]) => attributeText(key as AttributeKey, addRunAttribute(content, run, key as AttributeKey, amount)));
  return { run, message: `You cashed in the ${item.name}: ${parts.join(', ')}.` };
}

/** Moves a party member to the front, so it leads the next battle. */
export function setLead(current: RunState, partyIndex: number): RunState {
  assertPhase(current, 'reward', 'decision', 'map', 'shop');
  if (!current.party[partyIndex]) throw new Error('No Pokémon in that slot');
  const run = structuredClone(current);
  const [mon] = run.party.splice(partyIndex, 1);
  run.party.unshift(mon!);
  return run;
}

/** Moves the party member at `from` to position `to` (the others shift), so the party can be rearranged. Slot 0 leads. */
export function moveParty(current: RunState, from: number, to: number): RunState {
  assertPhase(current, 'reward', 'decision', 'map', 'shop');
  if (!current.party[from]) throw new Error('No Pokémon in that slot');
  if (to < 0 || to >= current.party.length) throw new Error('No such party slot');
  const run = structuredClone(current);
  const [mon] = run.party.splice(from, 1);
  run.party.splice(to, 0, mon!);
  return run;
}

/** Moves a party Pokémon into the PC (between battles). The party keeps at least one Pokémon. */
export function depositToBox(content: Content, current: RunState, partyIndex: number): RunState {
  assertPhase(current, 'map');
  if (!current.party[partyIndex]) throw new Error('No Pokémon in that slot');
  if (current.party.length <= 1) throw new Error('The party needs at least one Pokémon');
  if (current.box.length >= boxCapacity(runPerks(content, current))) throw new Error('The PC is full');
  const run = structuredClone(current);
  run.box.push(run.party.splice(partyIndex, 1)[0]!);
  return run;
}

/** Brings a Pokémon from the PC into the party (if there is room). */
export function withdrawFromBox(content: Content, current: RunState, boxIndex: number): RunState {
  assertPhase(current, 'map');
  if (!current.box[boxIndex]) throw new Error('No Pokémon in that PC slot');
  if (current.party.length >= partyCapacity(content, current)) throw new Error('Your party is full');
  const run = structuredClone(current);
  run.party.push(run.box.splice(boxIndex, 1)[0]!);
  return run;
}

// ---------- debug helpers ----------

/** Debug: replaces the current battle with a wild Pokémon of your choice. */
export function debugReplaceEnemy(content: Content, current: RunState, speciesId: string, level: number): RunState {
  assertPhase(current, 'battle');
  const run = structuredClone(current);
  const enemy = newMon(content, run, speciesId, level, 'e');
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  run.battle = createBattle('wild', [enemy], activeIndex, run.party[activeIndex]!.uid);
  recordBattleStarted(content, run);
  return run;
}

/** Debug: adds a Pokémon to the party (if there is room). */
export function debugAddToParty(content: Content, current: RunState, speciesId: string, level: number): RunState {
  if (current.party.length >= partyCapacity(content, current)) throw new Error('Your party is full');
  const run = structuredClone(current);
  run.party.push(newMon(content, run, speciesId, level, 'p'));
  recordChanges(content, current, run, 'debug');
  return run;
}

/** Debug: fully heals the party and restores PP. */
export function debugHealParty(content: Content, current: RunState): RunState {
  const run = structuredClone(current);
  healParty(content, run);
  return run;
}

/** Debug: moves the player to a node in the column before `column`, so `column` is next. */
export function debugJumpToColumn(current: RunState, column: number): RunState {
  assertPhase(current, 'map');
  const stage = requireStage(current);
  const run = structuredClone(current);
  if (column <= 1) {
    run.stage!.current = null;
    return run;
  }
  const before = stage.map.nodes.find((n) => n.column === Math.min(column, stage.map.columns) - 1);
  if (!before) throw new Error(`No column ${column - 1}`);
  run.stage!.current = before.id;
  return run;
}

/** Debug: skips the rest of the region's stages and goes straight to its Pokémon League. */
export function debugJumpToLeague(content: Content, current: RunState): RunState {
  assertPhase(current, 'map');
  const run = structuredClone(current);
  enterLeague(content, run);
  return run;
}

/** Debug: adds items to the Bag. */
export function debugGiveItem(content: Content, current: RunState, itemId: string, quantity: number): RunState {
  getItem(content, itemId);
  const run = structuredClone(current);
  addItem(run.inventory, itemId, quantity);
  return run;
}
