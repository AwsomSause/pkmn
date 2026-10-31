// Map events ("?" stops; plans/events-and-map-stops-plan): small scenes
// beside a map node with two to four choices. Choices can need an item,
// money, a party type or an attribute; some are attribute checks (40% + 1%
// per point). Outcomes change money, items, HP, friendship, attributes and
// Research Points, or start a battle whose `win` effects pay out if you win.
//
// Determinism: where the stops go and which events they hold come from a
// generator seeded by the run seed and the stage, and every choice's roll from
// one seeded by the stop. No existing stream is touched, so adding events
// changes no other roll, and choosing again after a reload gives the same result.

import { featuredMapEvents, runGameEventIds } from './gameEvents';
import { eventChanceScale } from './rules';
import { getArchetype, runPerks } from './archetypes';
import { ATTRIBUTE_LABELS, addRunAttribute, effectiveAttributes, runAttributeEffects } from './attributes';
import { createBattle } from './battle/engine';
import type { Content, EventBattle, EventChoice, EventCondition, EventDef, EventEffect, EventOutcome, TradeWant, TypeName } from './contentSchema';
import { curveLevel, enemyLevel, evolvedFormAt, levelScale, rollShiny } from './encounters';
import { changeFriendship } from './friendship';
import { applyCatalog, catalogTargetProblem, isFreeReroll } from './catalog';
import { addItem } from './items';
import { championTeam } from './story/championDefense';
import { oldFoe } from './story/promises';
import { openFeud, settleFeud } from './story/feud';
import { noteEventMorality } from './story/nemesis';
import { addHuntClue, finishHunt, huntClues, huntDone } from './story/grandEnemy';
import { gauntletLeft, startGauntlet } from './story/gauntlet';
import { changeAid, changeCrisis, crisisAid, crisisEventIds, crisisLevel, setTournament, tournamentEventId, tournamentRound } from './story/crisis';
import { activePerks, hasPerk, perkItem, perksOf, spendUse, stageKey } from './mapItems';
import { scavengerBonus } from './bank';
import { addLevels, calcStats, maxHp } from './pokemon';
import { count, countShiny, discover } from './progress';
import { eggStatus, layEgg } from './eggs';
import { eggMoveOptions, familyId, teachEggMove } from './mastery';
import { getCampaign, levelCap, runLevelCap } from './regions';
import { auditEncounter, auditSpecies, directSpecies, type EncounterSource } from './encounterDirector';
import { hashSeed, Rng } from './rng';
import { continueAfterDecisions, healParty, newMon } from './run';
import type { MapNode, RunState, SideStop } from './state';
import { applyReward, rewardTargetProblem } from './rewards';
import { focusIs, MYSTERY_EXTRA_STOPS, regionFocus } from './campaign/focus';
import { emit } from './story/record';
import { recordBattleStarted } from './story/hooks';
import { getTheme, typesPool } from './themes';

// ---------- placing event stops ----------

/** The stage number counted from the start of the run (1 = the first stage). */
export function stageNumber(content: Content, run: RunState): number {
  return run.regionIndex * getCampaign(content, run.campaignId).stagesPerRegion + (run.stage?.index ?? 0) + 1;
}

function conditionMet(content: Content, run: RunState, c: EventCondition): boolean {
  switch (c.kind) {
    case 'money':
      return run.money >= c.atLeast;
    case 'partySize':
      return run.party.length >= c.atLeast;
    case 'attribute':
      return effectiveAttributes(content, run)[c.key] >= c.atLeast;
    case 'meter': {
      const v = effectiveAttributes(content, run)[c.key];
      return c.side === 'positive' ? v >= c.atLeast : -v >= c.atLeast;
    }
    case 'item':
      return (run.inventory[c.id] ?? 0) > 0 || (run.passives?.[c.id] ?? 0) > 0;
    case 'partyType':
      return run.party.some((m) => content.species.get(m.speciesId)?.types.includes(c.type));
    case 'partySpecies':
      return run.party.some((m) => m.speciesId === c.species);
    case 'eventSeen':
      return (run.itemCounters?.[`event-seen:${c.id}`] ?? 0) > 0;
    case 'noTrainerTag':
      return !getArchetype(content, run.archetypeId).eventTags.includes(c.tag);
    case 'friendship':
      return run.party.some((m) => m.friendship >= c.atLeast);
    case 'rivalMet':
      return run.story.rivals.some((r) => r.encounters >= c.atLeast);
    case 'crisis':
      return crisisLevel(run) >= c.atLeast && crisisLevel(run) <= c.atMost;
    case 'aid':
      return crisisAid(run) >= c.atLeast;
    case 'tournament':
      return tournamentRound(run) === c.round;
    case 'flag':
      return Number(run.story.flags[`ev:${c.key}`] ?? 0) >= c.atLeast && Number(run.story.flags[`ev:${c.key}`] ?? 0) <= c.atMost;
    case 'oldFoe':
      return oldFoe(run) !== null;
    case 'feud':
      return openFeud(run) !== null;
    case 'championGhost':
      return championTeam(run.story).length > 0;
    case 'hunt':
      return huntClues(run) >= c.atLeast && huntClues(run) <= c.atMost && !(c.atLeast > 0 && huntDone(run));
    case 'gauntlet':
      return (gauntletLeft(run) > 0) === c.active;
    case 'partyTag':
      return run.party.some((m) => content.species.get(m.speciesId)?.tags.includes(c.tag));
    case 'bond':
      return run.story.relationships.some((r) => r.open && r.kind === 'bond');
    case 'focus':
      return regionFocus(run, run.regionIndex) === c.focus;
  }
}

/** The party Pokémon a trade partner would accept, lowest level first. */
export function tradeCandidates(content: Content, run: RunState, want: TradeWant): RunState['party'] {
  return run.party
    .filter((m) => {
      const sp = content.species.get(m.speciesId);
      if (!sp) return false;
      return (
        (want.species.length === 0 || want.species.includes(m.speciesId)) &&
        (!want.type || sp.types.includes(want.type)) &&
        (!want.tag || sp.tags.includes(want.tag)) &&
        (!want.stage || sp.evolutionStage === want.stage) &&
        (!want.minWeight || (sp.weight ?? 50) >= want.minWeight) &&
        (!want.maxWeight || (sp.weight ?? 50) <= want.maxWeight) &&
        (!want.generation || sp.generation === want.generation) &&
        (!want.minLevel || m.level >= want.minLevel) &&
        (!want.eggGroup || sp.eggGroups.includes(want.eggGroup)) &&
        (!want.color || sp.color === want.color)
      );
    })
    .sort((a, b) => a.level - b.level);
}

function tradePicksOf(content: Content, run: RunState, choice: EventChoice): { uid: string; label: string }[] | null {
  const e = choice.success.effects.find((f) => f.kind === 'tradeAway');
  if (!e || e.kind !== 'tradeAway') return null;
  return tradeCandidates(content, run, e.want).map((m) => ({ uid: m.uid, label: `${content.species.get(m.speciesId)?.name ?? m.speciesId} Lv${m.level}` }));
}

/** Why a choice's trade cannot happen yet, in words (null when it can or the choice has no trade). */
function tradeMissing(content: Content, run: RunState, choice: EventChoice): string | null {
  for (const e of choice.success.effects) {
    if (e.kind !== 'tradeAway') continue;
    if (run.party.length < 2) return 'Needs 2 Pokémon in your party';
    if (tradeCandidates(content, run, e.want).length === 0) return `Needs ${e.want.label} in your party`;
  }
  return null;
}

/** A requirement in words, for a locked choice. */
export function conditionText(content: Content, c: EventCondition): string {
  switch (c.kind) {
    case 'money':
      return `Needs ₽${c.atLeast}`;
    case 'partySize':
      return `Needs ${c.atLeast} Pokémon in your party`;
    case 'attribute':
      return `Needs ${ATTRIBUTE_LABELS[c.key]} ${c.atLeast}`;
    case 'meter': {
      const name = c.key === 'ragePeace' ? (c.side === 'positive' ? 'Rage' : 'Peace') : c.side === 'positive' ? 'Good' : 'Evil';
      return `Needs ${name} ${c.atLeast}`;
    }
    case 'item':
      return `Needs a ${content.catalog.get(c.id)?.name ?? content.items.get(c.id)?.name ?? c.id}`;
    case 'partyType':
      return `Needs a ${c.type.charAt(0).toUpperCase()}${c.type.slice(1)}-type in your party`;
    case 'partySpecies':
      return `Needs ${content.species.get(c.species)?.name ?? c.species} in your party`;
    case 'eventSeen':
      return `Needs an earlier delivery`;
    case 'noTrainerTag':
      return `Your trainer won't do this`;
    case 'friendship':
      return `Needs a Pokémon with friendship ${c.atLeast}`;
    case 'rivalMet':
      return `Needs a rival you have fought ${c.atLeast} time${c.atLeast === 1 ? '' : 's'}`;
    case 'partyTag':
      return `Needs a ${c.tag} Pokémon in your party`;
    case 'bond':
      return 'Needs two bonded Pokémon';
    case 'focus':
      return `Only in a ${c.focus}-focused region`;
    case 'crisis':
      return c.atLeast > 0 ? 'Needs a serious crisis in this region' : 'Needs the crisis to be under control';
    case 'aid':
      return 'Needs allies gathered in this region';
    case 'tournament':
      return 'Needs the tournament bracket to be at this round';
    case 'flag':
      return 'Needs something you did earlier';
    case 'oldFoe':
      return 'Needs a wild Pokémon that once beat you';
    case 'feud':
      return 'Needs two rivals who are feuding';
    case 'championGhost':
      return 'Needs a won run in your Hall of Fame';
    case 'hunt':
      return 'Needs more clues about the Grand-Enemy';
    case 'gauntlet':
      return c.active ? 'Needs a rival gauntlet to be running' : 'Needs no rival gauntlet running';
  }
}

/** The game events whose own stops this run can meet: the editions it started in, and its trainer's eventStops perks. */
function eventPacks(content: Content, run: RunState): Set<string> {
  const own = (runPerks(content, run) ?? []).flatMap((m) => (m.kind === 'eventStops' ? [m.gameEvent] : []));
  return new Set([...runGameEventIds(run), ...own]);
}

/** An event whose only recruit is a trainer the player already owns (or is playing). */
function recruitsOwned(run: RunState, e: EventDef): boolean {
  const ids = e.choices.flatMap((c) => [c.success, c.failure ?? c.success].flatMap((o) => [...o.effects, ...(o.battle?.win ?? [])])).flatMap((x) => (x.kind === 'recruit' ? [x.trainer] : []));
  return ids.length > 0 && ids.every((id) => id === run.archetypeId || (run.itemCounters?.[`owned:${id}`] ?? 0) > 0);
}

/** Events that can appear on the current stage (key-item events only while the key item is held). */
export function eligibleEvents(content: Content, run: RunState): EventDef[] {
  const n = stageNumber(content, run);
  const packs = eventPacks(content, run);
  return [...content.events.values()].filter(
    (e) =>
      !e.keyItem &&
      e.stop !== 'rest' &&
      e.minStage <= n &&
      // An event pack's own stops (e.g. Spooky) only appear in runs started while it is on (or a trainer who brings them).
      (!e.gameEvent || packs.has(e.gameEvent)) &&
      !(run.itemCounters?.[`event-seen:${e.id}`]) &&
      !recruitsOwned(run, e) &&
      e.requires.every((c) => conditionMet(content, run, c)),
  );
}

function pickEvent(content: Content, run: RunState, rng: Rng, taken: Set<string>): EventDef | null {
  const theme = run.stage ? getTheme(content, run.stage.themeId) : null;
  const cfg = content.balance.events;
  const featured = featuredMapEvents(content, run);
  const pool = eligibleEvents(content, run)
    .filter((e) => !taken.has(e.id))
    .map((e) => ({
      item: e,
      weight:
        (cfg.rarityWeights[e.rarity] ?? 0) *
        (theme && e.types.some((t) => theme.types.includes(t)) ? cfg.themeWeight : 1) *
        (featured.has(e.id) || e.gameEvent ? cfg.gameEventWeight : 1),
    }))
    .filter((p) => p.weight > 0);
  if (pool.length === 0) return null;
  const e = rng.weighted(pool);
  taken.add(e.id);
  return e;
}

/**
 * When a stage starts: 3–5 event stops beside nodes (never the gym), about a
 * third hidden as "?", two rest spots, plus one stop for each key item the player holds that
 * opens an event. Intelligence at the threshold reveals one hidden stop.
 */
export function addEventStops(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage' || content.events.size === 0) return;
  const rng = new Rng(hashSeed(`${run.seed}::event-stops::${stageKey(run)}`));
  const cfg = content.balance.events;
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns);
  const taken = new Set<string>();
  const place = (eventId: string, hidden: boolean) => {
    const node = rng.pick(candidates);
    node.sides.push({ id: `event-${node.sides.length + 1}-${node.id}`, kind: 'event', used: false, eventId, ...(hidden ? { hidden: true } : {}) });
  };
  // A running tournament round and a serious crisis always get their stop (until played), so neither can be missed by luck.
  const open = new Set(eligibleEvents(content, run).map((e) => e.id));
  // A run milestone (catalog 99) is offered at the middle stage of every region.
  const milestone = (run.stage?.index ?? 0) === 2 ? ['milestone-dawn', 'milestone-crossroads', 'milestone-summit', 'milestone-embers'].find((id) => open.has(id)) : undefined;
  const forced = [tournamentEventId(run), crisisEventIds(run).find((id) => open.has(id)), milestone].filter((id): id is string => !!id && open.has(id));
  for (const id of forced) {
    taken.add(id);
    place(id, false);
  }
  const wanted = Math.round(rng.int(cfg.perStage[0], cfg.perStage[1]) * eventChanceScale(run.rules)) + (focusIs(content, run, run.regionIndex, 'mystery') ? MYSTERY_EXTRA_STOPS : 0);
  for (let i = 0; i < wanted && candidates.length > 0; i++) {
    const e = pickEvent(content, run, rng, taken);
    if (!e) break;
    place(e.id, rng.chance(cfg.hiddenShare));
  }
  // Rest spots (time with your lead Pokémon) come back every stage.
  const rests = [...content.events.values()].filter((e) => e.stop === 'rest' && e.minStage <= stageNumber(content, run));
  for (let i = 0; i < cfg.restPerStage && rests.length > 0 && candidates.length > 0; i++) place(rng.pick(rests).id, false);
  for (const e of content.events.values()) {
    if (e.keyItem && conditionMet(content, run, { kind: 'item', id: e.keyItem }) && e.minStage <= stageNumber(content, run) && !run.itemCounters?.[`event-seen:${e.id}`]) place(e.id, false);
  }
  if (effectiveAttributes(content, run).intelligence >= cfg.revealIntelligence) {
    const hidden = stage.map.nodes.flatMap((n) => n.sides).find((s) => s.kind === 'event' && s.hidden);
    if (hidden) delete hidden.hidden;
  }
}

/** Bridge Mail V: an event stop beside the node just reached. */
export function bridgeEventStop(content: Content, run: RunState, node: MapNode): SideStop | null {
  const rng = new Rng(hashSeed(`${run.seed}::bridge-event::${stageKey(run)}::${node.id}::${node.sides.length}`));
  const taken = new Set(run.stage!.map.nodes.flatMap((n) => n.sides).flatMap((s) => (s.eventId ? [s.eventId] : [])));
  const e = pickEvent(content, run, rng, taken);
  return e ? { id: `bridge-${node.sides.length + 1}`, kind: 'event', used: false, eventId: e.id } : null;
}

/** Whether the map shows a stop as "?": hidden, not reached yet, and no Silph Scope. */
export function stopIsHidden(content: Content, run: RunState, node: MapNode, side: SideStop): boolean {
  if (!side.hidden) return false;
  if (run.stage?.current === node.id) return false;
  return !hasPerk(content, run, 'revealEvents');
}

// ---------- the scene and its choices ----------

export interface ChoiceView {
  label: string;
  /** Why it can't be chosen, or null. */
  locked: string | null;
  /** Success chance 0–1, when the choice has a check or a chance. */
  chance: number | null;
  /** The attribute behind it, for the card's icon and colour. */
  attribute: string | null;
  /** With an Inquiry Mail: what happens, in words. */
  preview: string | null;
  /** What it costs for sure (paid money, an item used, HP lost), or null. Never spoils a hidden reward. */
  cost: string | null;
  /** What kind of uncertainty it carries, in words ("Depends on your Luck · a setback if it fails"). */
  risk: string;
  /** For a trade: the party Pokémon the partner would take (the player picks one), else null. */
  tradePicks: { uid: string; label: string }[] | null;
}

export interface EventView {
  event: EventDef;
  choices: ChoiceView[];
}

function findSide(run: RunState, sideId: string): { node: MapNode; side: SideStop } {
  const stage = run.stage;
  if (!stage || stage.current === null) throw new Error('Choose a node first');
  const node = stage.map.nodes.find((n) => n.id === stage.current)!;
  const side = node.sides.find((s) => s.id === sideId);
  if (!side || side.kind !== 'event' || !side.eventId) throw new Error(`No event stop "${sideId}" here`);
  return { node, side };
}

export function choiceChance(content: Content, run: RunState, choice: EventChoice): number | null {
  if (choice.check) {
    const cfg = content.balance.events;
    const pct = Math.min(cfg.checkMax, Math.max(cfg.checkMin, cfg.checkBase + effectiveAttributes(content, run)[choice.check]));
    return pct / 100;
  }
  return choice.chance ?? null;
}

function outcomeWords(content: Content, o: EventOutcome): string {
  const parts = o.effects.map((e) => effectWords(content, e));
  if (o.battle) parts.unshift(o.battle.kind === 'wild' ? 'a wild battle' : `a battle with ${o.battle.name}`);
  return parts.filter(Boolean).join(', ') || 'nothing';
}

const HARMFUL = new Set(['damage', 'status', 'loseItem', 'tradeAway']);
function harmful(e: EventEffect): boolean {
  return HARMFUL.has(e.kind) || (e.kind === 'money' && e.amount < 0) || (e.kind === 'crisis' && e.amount > 0);
}

/**
 * The cost and the kind of risk of a choice, for its card (Visual Bible: "reveal the cost/risk where
 * known; if uncertain, explain what kind of uncertainty"). Costs are only the harmful effects every
 * outcome shares, so a reward an Inquiry Mail would reveal stays hidden.
 */
export function choiceRisk(content: Content, choice: EventChoice): { cost: string | null; risk: string } {
  const same = (a: EventEffect, b: EventEffect) => JSON.stringify(a) === JSON.stringify(b);
  const sure = choice.success.effects.filter((e) => harmful(e) && (!choice.failure || choice.failure.effects.some((f) => same(f, e))));
  const cost = sure.length ? sure.map((e) => effectWords(content, e)).join(', ') : null;
  const uncertain = choice.check !== undefined || choice.chance !== undefined;
  if (!uncertain) return { cost, risk: choice.success.battle ? 'Certain · leads to a battle' : 'Certain outcome' };
  const why = choice.check ? `Depends on your ${ATTRIBUTE_LABELS[choice.check]}` : 'Luck of the draw';
  const fail = choice.failure!;
  const ifFails = fail.battle ? 'a fight if it fails' : fail.effects.some((e) => harmful(e) && !sure.some((c) => same(c, e))) ? 'a setback if it fails' : 'nothing lost if it fails';
  return { cost, risk: `${why} · ${ifFails}` };
}

export function eventView(content: Content, run: RunState, sideId: string): EventView {
  const { side } = findSide(run, sideId);
  const event = content.events.get(side.eventId!)!;
  const insight = hasPerk(content, run, 'eventInsight');
  const choices = event.choices.map((c) => {
    const unmet = c.requires.find((r) => !conditionMet(content, run, r));
    const missing = unmet ? conditionText(content, unmet) : tradeMissing(content, run, c);
    const chance = choiceChance(content, run, c);
    const preview = insight ? `${outcomeWords(content, c.success)}${c.failure ? ` · if it fails: ${outcomeWords(content, c.failure)}` : ''}` : null;
    return { label: c.label, locked: missing, tradePicks: tradePicksOf(content, run, c), chance, attribute: c.check ?? null, preview, ...choiceRisk(content, c) };
  });
  return { event, choices };
}

export interface EventResult {
  run: RunState;
  success: boolean;
  text: string;
  /** Each change in words ("+₽500", "Luck +5"), for the outcome screen. */
  changes: string[];
  /** True when the outcome started a battle (the scene hands over to the battle). */
  battle: boolean;
}

/** Makes a choice at an event stop. The stop is used up; a battle outcome starts the battle. */
export function chooseEvent(content: Content, current: RunState, sideId: string, choiceIndex: number, tradeUid?: string): EventResult {
  if (current.phase !== 'map') throw new Error(`Action needs phase "map" but run is in "${current.phase}"`);
  const { node, side } = findSide(current, sideId);
  if (side.used) throw new Error('This event is over');
  const event = content.events.get(side.eventId!)!;
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error(`No choice ${choiceIndex}`);
  const missing = choice.requires.find((r) => !conditionMet(content, current, r));
  if (missing) throw new Error(conditionText(content, missing));
  const noTrade = tradeMissing(content, current, choice);
  if (noTrade) throw new Error(noTrade);
  if (tradeUid !== undefined && !tradePicksOf(content, current, choice)?.some((p) => p.uid === tradeUid)) throw new Error('That Pokémon does not fit the trade');
  const run = structuredClone(current);
  const runSide = run.stage!.map.nodes.find((n) => n.id === node.id)!.sides.find((s) => s.id === sideId)!;
  runSide.used = true;
  delete runSide.hidden;
  run.itemCounters = { ...run.itemCounters, [`event-seen:${event.id}`]: 1 };
  if (event.keyItem) useUpKeyItem(run, event.keyItem);
  const insight = perkItem(content, run, 'eventInsight');
  if (insight) spendUse(run, insight);
  count(run, 'eventsCompleted');
  const rng = new Rng(hashSeed(`${run.seed}::event::${stageKey(run)}::${node.id}::${sideId}`));
  const chance = choiceChance(content, run, choice);
  const success = chance === null || rng.float() < chance;
  const outcome = success ? choice.success : choice.failure!;
  // The Event Director remembers important choices (and whether you took a risk).
  const risky = chance !== null;
  run.story.flags[risky ? 'choices:risky' : 'choices:safe'] = Number(run.story.flags[risky ? 'choices:risky' : 'choices:safe'] ?? 0) + 1;
  emit(content, run, 'storyMoment', { actors: [], data: { def: 'event-choice', suppressed: false }, importance: risky ? 55 : 40, text: `${event.name}: ${choice.label}${risky ? (success ? ' (the gamble paid off)' : ' (the gamble failed)') : ''}` });
  emit(content, run, 'eventChoice', { data: { event: event.id, choice: choiceIndex, risky, success } });
  // Kindness and cruelty are remembered by the event's Pokémon types (It Hasn't Forgotten…).
  noteEventMorality(content, run, event.types ?? [], outcome.effects);
  const changes: string[] = [];
  // Prop Case: a Contest stop's Charisma counts twice.
  const contest = event.stop === 'contest' && hasPerk(content, run, 'doubleContest');
  for (const effect of outcome.effects) {
    const doubled = contest && effect.kind === 'attribute' && effect.key === 'charisma' ? { ...effect, amount: effect.amount * 2 } : effect;
    const words = applyEffect(content, run, doubled, rng, tradeUid);
    if (words) changes.push(words);
  }
  // Explorer Kit: every finished event stop turns up one more item.
  if (hasPerk(content, run, 'eventBonus')) {
    const words = giveItem(content, run, rng.pick(content.balance.events.explorerItems), 1, rng);
    if (words) changes.push(`Explorer Kit: ${words}`);
  }
  let battle = false;
  if (outcome.battle && run.party.some((p) => p.hp > 0)) {
    startEventBattle(content, run, node, outcome.battle, rng, { eventId: event.id, choiceIndex, sideId, success });
    battle = true;
  } else {
    run.afterDecisions = 'map';
    continueAfterDecisions(content, run);
  }
  return { run, success, text: outcome.text, changes, battle };
}

function useUpKeyItem(run: RunState, id: string): void {
  if ((run.inventory[id] ?? 0) > 0) {
    run.inventory[id]! -= 1;
    if (run.inventory[id] === 0) delete run.inventory[id];
  } else if ((run.passives?.[id] ?? 0) > 0) {
    const passives = { ...run.passives };
    passives[id]! -= 1;
    if (passives[id] === 0) delete passives[id];
    run.passives = passives;
  }
}

// ---------- effects ----------

function itemName(content: Content, id: string): string {
  return content.catalog.get(id)?.name ?? content.items.get(id)?.name ?? id;
}

function effectWords(content: Content, e: EventEffect): string {
  switch (e.kind) {
    case 'money':
      return e.amount >= 0 ? `+₽${e.amount}` : `−₽${-e.amount}`;
    case 'item':
      return `${itemName(content, e.id)}${e.count > 1 ? ` ×${e.count}` : ''}`;
    case 'itemFrom':
      return `one of ${e.ids.map((id) => itemName(content, id)).join(' / ')}`;
    case 'loseItem':
      return e.id ? `use a ${itemName(content, e.id)}` : 'lose an item';
    case 'tradeAway':
      return `trade away ${e.want.label}`;
    case 'heal':
      return e.share >= 1 ? 'full heal' : `heal ${Math.round(e.share * 100)}%`;
    case 'damage':
      return `party loses ${Math.round(e.share * 100)}% HP`;
    case 'cure':
      return 'cure status';
    case 'status':
      return `party ${e.status === 'paralysis' ? 'paralysed' : e.status === 'sleep' ? 'asleep' : e.status === 'burn' ? 'burned' : 'poisoned'}`;
    case 'friendship':
      return `friendship ${e.amount >= 0 ? '+' : ''}${e.amount}`;
    case 'attribute': {
      const label = e.key === 'ragePeace' ? (e.amount >= 0 ? 'Rage' : 'Peace') : e.key === 'goodEvil' ? (e.amount >= 0 ? 'Good' : 'Evil') : ATTRIBUTE_LABELS[e.key];
      return `${label} +${Math.abs(e.amount)}`;
    }
    case 'research':
      return `+${e.amount} Research Points`;
    case 'levels':
      return `${e.who === 'lead' ? 'lead' : 'party'} +${e.amount} level${e.amount === 1 ? '' : 's'}`;
    case 'join':
      return 'a Pokémon joins';
    case 'egg':
      return 'you get an Egg';
    case 'eggMove':
      return 'your lead learns an egg move';
    case 'betterDraft':
      return `better next reward${e.extra ? ` (+${e.extra} choice)` : ''}`;
    case 'gymPreview':
      return "see the gym leader's team";
    case 'revealStops':
      return 'reveal every "?" stop';
    case 'addStop':
      return e.stop === 'heal' ? 'a healing spot opens here' : e.stop === 'shop' ? 'a shop opens here' : 'a fishing spot opens here';
    case 'skipAhead':
      return 'skip ahead to the gym';
    case 'formChange':
      return 'a Pokémon changes form';
    case 'crisis':
      return e.amount < 0 ? 'the crisis eases' : 'the crisis grows';
    case 'aid':
      return 'allies gathered';
    case 'flag':
      return '';
    case 'relic':
      return `the ${e.name}`;
    case 'feud':
      return 'a feud is settled';
    case 'hunt':
      return e.finish ? 'the hunt ends' : 'a clue';
    case 'gauntlet':
      return `${e.rivals} rivals will come for you`;
    case 'tournament':
      return e.round === 9 ? 'tournament over' : 'tournament round';
    case 'recruit':
      return `${content.archetypes.get(e.trainer)?.name ?? e.trainer} will join your roster after this run`;
    case 'count':
      return e.counter === 'eventClues' ? (e.amount === 1 ? 'a clue' : `${e.amount} clues`) : e.counter === 'eventBossesWon' ? 'an event boss beaten' : 'the event finale won';
  }
}

/**
 * Gives an item the way a reward draft would (mutates `run`): Bag items go to
 * the Bag, reward items (Nugget, vitamins, Rare Candy) and catalog items work
 * at once on the first Pokémon that can take them. An item nobody can take, or
 * one you already hold the most of, is sold for its worth instead.
 */
/** One id from a gift list: the rarity is rolled first, as in drafts (balance.events.itemRarityWeights), then an item of that rarity, so a long list of uncommon items cannot outweigh a short list of common ones. */
export function pickByRarity(content: Content, ids: readonly string[], rng: Rng): string {
  const weights = content.balance.events.itemRarityWeights;
  const rarityOf = (id: string) => content.catalog.get(id)?.rarity ?? content.rewards.get(id)?.rarity ?? 'common';
  const tiers = new Map<string, string[]>();
  for (const id of ids) tiers.set(rarityOf(id), [...(tiers.get(rarityOf(id)) ?? []), id]);
  const tier = rng.weighted([...tiers.keys()].map((r) => ({ item: r, weight: Math.max(weights[r as keyof typeof weights] ?? 0, 0.0001) })));
  return rng.pick(tiers.get(tier)!);
}

function giveItem(content: Content, run: RunState, id: string, times: number, rng: Rng): string {
  const name = itemName(content, id);
  if (content.items.has(id)) {
    addItem(run.inventory, id, times);
    return `${name}${times > 1 ? ` ×${times}` : ''}`;
  }
  const sold = () => {
    const amount = content.balance.events.soldGift;
    run.money += amount;
    return `${name} (sold for ₽${amount})`;
  };
  const words: string[] = [];
  for (let i = 0; i < times; i++) {
    const reward = content.rewards.get(id);
    if (reward && reward.effect.kind !== 'catalog') {
      const index = run.party.findIndex((_, k) => rewardTargetProblem(content, run, reward, k) === null);
      if (index < 0) { words.push(sold()); continue; }
      const result = applyReward(content, run, getArchetype(content, run.archetypeId), id, index, rng);
      run.pending.push(...result.pending);
      words.push(reward.scope === 'pokemon' ? `${name} for ${content.species.get(run.party[index]!.speciesId)?.name ?? 'your Pokémon'}` : name);
      continue;
    }
    const entry = content.catalog.get(id);
    if (!entry || entry.status !== 'supported' || isFreeReroll(run, entry)) { words.push(sold()); continue; }
    const target = entry.stacksOn === 'pokemon' ? run.party.find((m) => catalogTargetProblem(content, run, entry, m) === null) : undefined;
    if (entry.stacksOn === 'pokemon' && !target) { words.push(sold()); continue; }
    const result = applyCatalog(content, run, entry, target, { moneyMultiplier: 1, rng });
    run.pending.push(...result.pending);
    words.push(target ? `${name} for ${content.species.get(target.speciesId)?.name ?? 'your Pokémon'}` : name);
  }
  return words.join(', ');
}

/** Whether an event can give this item (see giveItem). */
export function isGiftable(content: Content, id: string): boolean {
  if (content.items.has(id)) return true;
  const reward = content.rewards.get(id);
  if (reward && reward.effect.kind !== 'catalog') return true;
  return content.catalog.get(id)?.status === 'supported';
}

/** Applies one effect (mutates `run`) and says what changed, or '' when nothing did. */
function applyEffect(content: Content, run: RunState, e: EventEffect, rng: Rng, tradeUid?: string): string {
  switch (e.kind) {
    case 'money': {
      const bonus = e.amount > 0 ? scavengerBonus(content, run.licenses, rng) : 0;
      const amount = Math.max(-run.money, e.amount + bonus);
      run.money += amount;
      if (amount > 0) count(run, 'moneyEarned', amount);
      return amount === 0 ? '' : amount > 0 ? `+₽${amount}` : `−₽${-amount}`;
    }
    case 'item':
      return giveItem(content, run, e.id, e.count, rng);
    case 'itemFrom':
      return giveItem(content, run, pickByRarity(content, e.ids, rng), e.count, rng);
    case 'loseItem': {
      const ids = e.id
        ? (run.inventory[e.id] ?? 0) > 0 ? [e.id] : []
        : Object.keys(run.inventory).filter((id) => (run.inventory[id] ?? 0) > 0 && !(content.catalog.get(id)?.family ?? '').startsWith('Key items'));
      ids.sort();
      if (ids.length === 0) return '';
      const id = rng.pick(ids);
      run.inventory[id]! -= 1;
      if (run.inventory[id] === 0) delete run.inventory[id];
      return `Lost a ${itemName(content, id)}`;
    }
    case 'tradeAway': {
      const fits = tradeCandidates(content, run, e.want);
      const mon = fits.find((m) => m.uid === tradeUid) ?? fits[0];
      if (!mon || run.party.length < 2) return '';
      run.party.splice(run.party.indexOf(mon), 1);
      return `Traded away ${content.species.get(mon.speciesId)?.name ?? mon.speciesId}`;
    }
    case 'heal': {
      if (e.share >= 1) healParty(content, run);
      else for (const m of run.party) if (m.hp > 0) m.hp = Math.min(maxHp(content, m), m.hp + Math.ceil(maxHp(content, m) * e.share));
      return effectWords(content, e);
    }
    case 'damage': {
      // Never knocks a Pokémon out: it stops at 1 HP.
      for (const m of run.party) if (m.hp > 0) m.hp = Math.max(1, m.hp - Math.floor(maxHp(content, m) * e.share));
      return effectWords(content, e);
    }
    case 'cure':
      for (const m of run.party) m.status = null;
      return effectWords(content, e);
    case 'status': {
      const id = ({ poison: 'psn', burn: 'brn', paralysis: 'par', sleep: 'slp' } as const)[e.status];
      for (const m of run.party) if (m.hp > 0 && !m.status) m.status = id === 'slp' ? { id, turns: 2 } : { id };
      return effectWords(content, e);
    }
    case 'friendship': {
      const gain = runAttributeEffects(content, run).friendship;
      const who = e.who === 'lead' ? run.party.filter((m) => m.hp > 0).slice(0, 1) : run.party;
      for (const m of who) changeFriendship(content, m, e.amount, e.amount > 0 ? gain : 1);
      return effectWords(content, e);
    }
    case 'attribute':
      addRunAttribute(content, run, e.key, e.amount);
      return effectWords(content, e);
    case 'research':
      run.itemCounters = { ...run.itemCounters, 'event-research': (run.itemCounters?.['event-research'] ?? 0) + e.amount };
      return effectWords(content, e);
    case 'levels': {
      const cap = runLevelCap(content, run);
      const who = e.who === 'lead' ? run.party.filter((m) => m.hp > 0).slice(0, 1) : run.party;
      let gained = 0;
      for (const m of who) gained += addLevels(content, m, e.amount, cap).levelsGained;
      return gained > 0 ? effectWords(content, e) : '';
    }
    case 'join': {
      const node = run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!;
      const speciesId = pickSpecies(content, run, e.species, e.types, rng, 'reward');
      // No event lifts the party's level cap (Balancing Phase 7).
      const level = Math.max(1, Math.min(runLevelCap(content, run), eventLevel(content, run, node, rng) + e.levelBonus));
      const mon = newMon(content, run, evolvedFormAt(content, speciesId, level, rng), level, 'p');
      mon.shiny = rollShiny(content, rng, runAttributeEffects(content, run).shinyChance * e.shinyMultiplier);
      if (mon.shiny) countShiny(run, mon.speciesId);
      discover(run, mon.speciesId, true);
      count(run, 'pokemonCaught');
      run.pending.push({ kind: 'caught', mon });
      return `${content.species.get(mon.speciesId)?.name ?? mon.speciesId} wants to join you!`;
    }
    case 'egg': {
      const node = run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!;
      const speciesId = pickSpecies(content, run, e.species, e.types, rng);
      const level = Math.max(1, eventLevel(content, run, node, rng) + e.levelBonus);
      const made = layEgg(content, run, speciesId, { level, left: e.left, unit: e.unit, source: 'Event', shinyMultiplier: runAttributeEffects(content, run).shinyChance * e.shinyMultiplier }, rng);
      return `You got an Egg! ${eggStatus(made)}.`;
    }
    case 'eggMove': {
      const lead = run.party.find((m) => m.hp > 0);
      if (!lead) return '';
      const id = eggMoveOptions(content, familyId(content, lead.speciesId)).find((o) => o.active && !lead.moves.some((m) => m.id === o.id))?.id;
      if (!id || !teachEggMove(content, lead, id, [])) return '';
      return `${content.species.get(lead.speciesId)?.name ?? lead.speciesId} learned the egg move ${content.moves.get(id)!.name}!`;
    }
    case 'formChange': {
      const mon = run.party.find((m) => m.speciesId === e.from);
      const to = content.species.get(e.to);
      if (!mon || !to) return '';
      if (e.consume) {
        const gone = run.party.findIndex((m) => m.speciesId === e.consume);
        if (gone < 0) return '';
        run.party.splice(gone, 1);
      }
      const before = calcStats(content, mon).hp;
      mon.speciesId = e.to;
      mon.hp = Math.max(1, Math.min(calcStats(content, mon).hp, Math.round((mon.hp * calcStats(content, mon).hp) / before)));
      discover(run, e.to, true);
      return `${to.name} appears!`;
    }
    case 'crisis':
      changeCrisis(content, run, e.amount);
      return effectWords(content, e);
    case 'aid':
      changeAid(run, e.amount);
      return effectWords(content, e);
    case 'tournament':
      return setTournament(content, run, e.round);
    case 'flag':
      run.story.flags[`ev:${e.key}`] = Number(run.story.flags[`ev:${e.key}`] ?? 0) + e.amount;
      return '';
    case 'relic': {
      if (run.story.flags[`relic:${e.id}`]) return '';
      run.story.flags[`relic:${e.id}`] = true;
      run.perkEffects = [...(run.perkEffects ?? []), ...e.effects];
      emit(content, run, 'storyMoment', { actors: [], data: { def: 'relic', suppressed: false }, importance: 75, text: `Took the ${e.name}` });
      return effectWords(content, e);
    }
    case 'feud':
      return settleFeud(content, run, e.choice);
    case 'hunt':
      return e.finish ? finishHunt(content, run) : addHuntClue(content, run);
    case 'gauntlet':
      return startGauntlet(content, run, e.rivals) > 0 ? effectWords(content, e) : 'no rivals to face yet';
    case 'recruit':
      run.itemCounters = { ...run.itemCounters, [`recruit:${e.trainer}`]: 1 };
      return effectWords(content, e);
    case 'count':
      count(run, e.counter, e.amount);
      return effectWords(content, e);
    case 'betterDraft':
      run.itemCounters = { ...run.itemCounters, 'better-draft': 1, ...(e.extra ? { 'draft-extra': (run.itemCounters?.['draft-extra'] ?? 0) + e.extra } : {}) };
      return effectWords(content, e);
    case 'gymPreview':
      run.itemCounters = { ...run.itemCounters, [`gym-preview:${stageKey(run)}`]: 1 };
      return effectWords(content, e);
    case 'revealStops':
      for (const n of run.stage!.map.nodes) for (const s of n.sides) delete s.hidden;
      return effectWords(content, e);
    case 'addStop': {
      const here = run.stage!.map.nodes.find((n) => n.id === run.stage!.current)!;
      here.sides.push({ id: `event-stop-${here.sides.length + 1}-${here.id}`, kind: e.stop, used: false });
      return effectWords(content, e);
    }
    case 'skipAhead': {
      // The ferry lands beside the gym: one of the nodes leading into it counts as reached.
      const stage = run.stage!;
      const here = stage.map.nodes.find((n) => n.id === stage.current)!;
      const gyms = new Set(stage.map.nodes.filter((n) => n.kind !== 'wild' && n.kind !== 'trainer').map((n) => n.id));
      const landings = stage.map.nodes.filter((n) => n.column > here.column && n.next.some((id) => gyms.has(id)));
      if (landings.length === 0) return '';
      const landing = rng.pick(landings);
      stage.current = landing.id;
      stage.visited.push(landing.id);
      return effectWords(content, e);
    }
  }
}

/** Whether an event showed this stage's gym team (Fortune Teller, Gym Scout). */
export function eventGymPreview(run: RunState): boolean {
  return (run.itemCounters?.[`gym-preview:${stageKey(run)}`] ?? 0) > 0;
}

/** Research Points events earned this run, paid at the end. */
export function eventResearch(run: RunState): number {
  return run.itemCounters?.['event-research'] ?? 0;
}

// ---------- battles ----------

type EventBattleRef = NonNullable<NonNullable<RunState['battle']>['event']>;

/**
 * An event's Pokémon goes through the Encounter Director (Balancing Phase 7): an event's own species
 * list (or a Bell's favoured legendary) is an authored exception and only logged; otherwise the pool
 * is gated by availability at the stage's curve level and each draw is validated like a wild one.
 */
function pickSpecies(content: Content, run: RunState, species: string[], types: TypeName[], rng: Rng, source: EncounterSource = 'event'): string {
  const node = run.stage!.map.nodes.find((n) => n.id === run.stage!.current);
  const gate = node ? curveLevel(content, levelScale(content, getCampaign(content, run.campaignId), run.regionIndex, run.stage!.index, node.column)) : 1;
  const known = species.filter((id) => content.species.has(id));
  // Tidal Bell / Clear Bell: their legendary answers whenever it is one of the choices.
  const favored = perksOf(activePerks(content, run), 'favorSpecies').map((p) => p.perk.species).find((id) => known.includes(id));
  const authored = favored ?? (known.length > 0 ? rng.pick(known) : null);
  if (authored) {
    auditSpecies(content, source, authored, gate, favored ? 'favored-species' : 'event-species-list');
    return authored;
  }
  const theme = getTheme(content, run.stage!.themeId);
  const pool = typesPool(content, types.length > 0 ? types : theme.types, run.regionOrder[run.regionIndex], gate).map((p) => ({ item: p.speciesId, weight: p.weight }));
  return directSpecies(content, { source, level: gate, cap: levelCap(content, run.regionIndex), draw: () => rng.weighted(pool) }).speciesId;
}

function eventLevel(content: Content, run: RunState, node: MapNode, rng: Rng): number {
  const stage = run.stage!;
  const scale = levelScale(content, getCampaign(content, run.campaignId), run.regionIndex, stage.index, node.column);
  return enemyLevel(content, getArchetype(content, run.archetypeId), scale, 0, rng).level;
}

function startEventBattle(content: Content, run: RunState, node: MapNode, b: EventBattle, rng: Rng, event: EventBattleRef): void {
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  const base = eventLevel(content, run, node, rng) + b.levelBonus;
  // Event foes stay under the region's level cap like every ordinary enemy (Balancing Phase 7).
  const cap = levelCap(content, run.regionIndex);
  if (b.kind === 'wild') {
    const speciesId = (b.recall ? oldFoe(run) : null) ?? pickSpecies(content, run, b.species, b.types, rng);
    const level = Math.min(cap, Math.max(1, base));
    const enemy = newMon(content, run, evolvedFormAt(content, speciesId, level, rng), level, 'e');
    enemy.shiny = rollShiny(content, rng, runAttributeEffects(content, run).shinyChance * b.shinyMultiplier);
    if (enemy.shiny) countShiny(run, enemy.speciesId);
    run.battle = createBattle('wild', [enemy], activeIndex, run.party[activeIndex]!.uid);
  } else {
    const boss = b.bossId ? content.bosses.get(b.bossId) : undefined;
    const ghost = b.ghost ? championTeam(run.story) : [];
    const authored = ghost.length > 0 ? 'rival-ghost-team' : boss ? 'event-boss-signature' : null;
    const team = ghost.length > 0 ? ghost.map((m) => newMon(content, run, m.speciesId, Math.min(cap, Math.max(1, Math.min(m.level, base + 6))), 'e')) : Array.from({ length: b.size }, (_, i) => {
      const level = Math.min(cap, Math.max(1, base + (i === b.size - 1 ? 1 : 0)));
      const speciesId = boss ? boss.signature[i % boss.signature.length]! : pickSpecies(content, run, [], b.types, rng);
      return newMon(content, run, evolvedFormAt(content, speciesId, level, rng), level, 'e');
    });
    if (authored) for (const mon of team) auditEncounter(content, 'event', mon, authored);
    run.battle = createBattle('trainer', team, activeIndex, run.party[activeIndex]!.uid, { classId: b.classId ?? 'event', name: b.name, leaderId: null });
  }
  run.battle.event = event;
  for (const mon of run.battle.enemyTeam) discover(run, mon.speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
}

/** After an event battle you won: its `win` effects (mutates `run`). Returns the changes in words. */
export function eventBattleWon(content: Content, run: RunState, event: EventBattleRef): string[] {
  const choice = content.events.get(event.eventId)?.choices[event.choiceIndex];
  const battle = (event.success ? choice?.success : choice?.failure)?.battle;
  if (!battle) return [];
  const rng = new Rng(hashSeed(`${run.seed}::event-win::${stageKey(run)}::${event.sideId}`));
  return battle.win.map((e) => applyEffect(content, run, e, rng)).filter(Boolean);
}
