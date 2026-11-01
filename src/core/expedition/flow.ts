// Mega-Expedition flow (Blueprint section 2). Every function takes a run and returns a new run.
// Rules in one place:
//  - Loot (cache, research, Mega Energy, finale) is kept only on extraction. Finishing the finale keeps everything and
//    unlocks the next expedition; leaving early keeps the loot but not the finale rewards; losing a fight forfeits the
//    loot (a share of its money is kept) and heals the party. Your own Pokémon are never lost: rentals and recruits leave,
//    your party comes back, and the run goes on.
//  - HP, status and PP carry from node to node; only rest nodes and events heal.
//  - Mega Evolution is never automatic: Mega Energy turns into a temporary Mega Stone for a party Pokémon that can use one,
//    plus a lent Mega Ring; stones become permanent when the expedition is completed.

import { createBattle } from '../battle/engine';
import { addItem, consumeItem, itemCount } from '../items';
import { discover } from '../progress';
import { levelScale } from '../encounters';
import { getCampaign } from '../regions';
import { maxHp } from '../pokemon';
import { hashSeed, Rng } from '../rng';
import { getRaid } from '../raid/raid';
import { getTotem } from '../totem/totem';
import { recordBattleStarted } from '../story/hooks';
import { afterStop, applyBattleEnvironment, legendaryRecord, recordOutcome, stageRules } from '../legendary/legendary';
import { newMon, requireStage, startEncounter, startRaidBattle, startTotemBattle } from '../run';
import type { Content, Item } from '../contentSchema';
import type { ExpeditionState, MapNode, RunState } from '../state';
import { generateRoute, validateRoute, type RouteNode } from './graph';
import type { ExpeditionDef, ExpeditionNodeKind } from './schema';

export function getExpedition(content: Content, id: string): ExpeditionDef {
  const e = content.expeditions.expeditions.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown expedition "${id}"`);
  return e;
}

const KIND_LABEL: Record<ExpeditionNodeKind, string> = {
  wild: 'Wild encounter', trainer: 'Trainer battle', elite: 'Elite encounter', rest: 'Rest area', cache: 'Item cache', research: 'Research station',
  mystery: 'Mystery event', recruit: 'Recruit', megaEnergy: 'Mega-energy deposit', totem: 'Totem encounter', raid: 'Raid boss', finale: 'Finale',
};
export const nodeLabel = (kind: string): string => KIND_LABEL[kind as ExpeditionNodeKind] ?? kind;

export interface ExpeditionPreview {
  id: string;
  name: string;
  tier: number;
  blurb: string;
  partyMode: string;
  partyText: string;
  nodes: string;
  finale: string;
  rewards: string[];
  rules: string[];
  /** Set for a Legendary world event: its presentation (omen, lore, whether the chance is temporary...). */
  legendary?: { speciesId: string; epithet: string; rarity: string; omen: string; lore: string[]; temporaryNote: string; tint: string; accent: string; modifiers: string[]; stage: string[] };
}

const PARTY_TEXT: Record<string, string> = {
  own: 'Bring your own party.',
  rental: 'Your party stays behind: you borrow three rental Pokémon.',
  recruit: 'Your party, plus Pokémon you can recruit along the way.',
  draft: 'Draft three Pokémon from six offered; your party waits at the gate.',
  combined: 'Your party, plus one recruit chosen at the start.',
};

export function expeditionPreview(content: Content, run: RunState, sideId: string): ExpeditionPreview {
  const side = gate(run, sideId);
  const def = getExpedition(content, side.expeditionId!);
  const fin = def.finale;
  const finale = fin.kind === 'megaBoss' ? `Mega guardian (${fin.species.join(' / ')})` : fin.kind === 'raid' ? `Raid: ${getRaid(content, fin.raidId).name}` : `Totem: ${getTotem(content, fin.totemId).name}`;
  const rewards = [`₽${def.rewards.moneyPerLevel} × level`, ...def.rewards.items.map((i) => i.item.replace(/-/g, ' ')), `${def.rewards.megaStones} Mega Stone${def.rewards.megaStones === 1 ? '' : 's'}`];
  if (def.unlocks) rewards.push(`unlocks ${getExpedition(content, def.unlocks).name}`);
  return {
    id: def.id, name: def.name, tier: def.tier, blurb: def.blurb, partyMode: def.partyMode, partyText: PARTY_TEXT[def.partyMode]!,
    nodes: `${def.nodes.min}–${def.nodes.max} stops`, finale, rewards,
    legendary: def.legendary && {
      speciesId: def.legendary.species, epithet: def.legendary.epithet, rarity: def.legendary.rarity, omen: def.legendary.omen, lore: def.legendary.lore, temporaryNote: def.legendary.temporaryNote,
      tint: def.legendary.visual.tint, accent: def.legendary.visual.accent, modifiers: def.legendary.modifiers, stage: stageRules(def, 0),
    },
    rules: ['Loot is kept when you extract or finish.', `Losing a fight forfeits the loot (${Math.round(def.failureKeep * 100)}% of its money is kept).`, 'You never lose your own Pokémon.'],
  };
}

function gate(run: RunState, sideId: string) {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const node = stage.map.nodes.find((n) => n.id === stage.current)!;
  const side = node.sides.find((s) => s.id === sideId && s.kind === 'expedition' && s.expeditionId);
  if (!side) throw new Error(`No expedition gate "${sideId}" here`);
  return side;
}

function rentalOptions(def: ExpeditionDef, rng: Rng, count: number): string[] {
  const pool = [...def.rentals];
  const out: string[] = [];
  while (out.length < count && pool.length > 0) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
  return out;
}

/** Leaves the gate: builds the route, sets up the party mode and opens the expedition (phase "expedition"). */
export function beginExpedition(content: Content, current: RunState, sideId: string): RunState {
  if (current.phase !== 'map') throw new Error('Expeditions start from the map');
  const side = gate(current, sideId);
  if (side.used) throw new Error('This expedition gate has already been used');
  const def = getExpedition(content, side.expeditionId!);
  if (!current.party.some((p) => p.hp > 0)) throw new Error('No healthy Pokémon');
  const run = structuredClone(current);
  const stage = requireStage(run);
  stage.map.nodes.find((n) => n.id === stage.current)!.sides.find((s) => s.id === sideId)!.used = true;
  const campaign = getCampaign(content, run.campaignId);
  const scale = levelScale(content, campaign, run.regionIndex, stage.index, campaign.columns);
  const level = Math.max(2, Math.min(scale.cap, Math.round(scale.end)));
  const rng = new Rng(hashSeed(`${run.seed}::expedition-route::${def.id}:${run.regionIndex}:${stage.index}`));
  const nodes = generateRoute(def, rng);
  const problems = validateRoute(def, nodes);
  if (problems.length > 0) throw new Error(`Generated an invalid expedition route: ${problems.join('; ')}`);
  const exp: ExpeditionState = {
    id: def.id, nodes, current: null, node: null, status: 'route', choice: null, stash: null, tempUids: [], loot: { money: 0, items: {}, energy: 0, research: 0 },
    tempItems: [], level, battleResult: null, log: [`${def.name} begins.`],
  };
  run.expedition = exp;
  const pick = new Rng(hashSeed(`${run.seed}::expedition-party::${def.id}:${stage.index}`));
  if (def.partyMode === 'rental') {
    exp.stash = run.party;
    run.party = [];
    for (const id of rentalOptions(def, pick, 3)) addTemp(content, run, exp, id);
    exp.log.push('You borrowed three rental Pokémon.');
  } else if (def.partyMode === 'draft') {
    exp.stash = run.party;
    run.party = [];
    exp.status = 'choice';
    exp.choice = { kind: 'draft', title: 'Draft your team: pick 3', left: 3, options: draftOptions(content, rentalOptions(def, pick, 6), exp.level) };
  } else if (def.partyMode === 'combined') {
    exp.status = 'choice';
    exp.choice = { kind: 'combined', title: 'Choose one recruit', left: 1, options: draftOptions(content, rentalOptions(def, pick, 3), exp.level) };
  }
  if (def.legendary) {
    const rec = legendaryRecord(run);
    if (!rec.offered.includes(def.id)) rec.offered.push(def.id);
    exp.log.push(`${def.name}: ${def.legendary.omen}`);
  }
  run.phase = 'expedition';
  return run;
}

function draftOptions(content: Content, ids: string[], level: number) {
  return ids.map((id) => ({ label: content.species.get(id)?.name ?? id, detail: `Lv${level}`, speciesId: id }));
}

/** Adds an expedition-only Pokémon. If the party is full, the last own Pokémon waits in the stash. */
function addTemp(content: Content, run: RunState, exp: ExpeditionState, speciesId: string): void {
  if (run.party.length >= content.balance.partyMax) {
    const [displaced] = run.party.splice(run.party.length - 1, 1);
    exp.stash = [...(exp.stash ?? []), displaced!];
  }
  const mon = newMon(content, run, speciesId, exp.level, 'p');
  exp.tempUids.push(mon.uid);
  run.party.push(mon);
  discover(run, speciesId, false);
}

export function nodeById(exp: ExpeditionState, id: string): RouteNode {
  const n = exp.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`No expedition node "${id}"`);
  return n as RouteNode;
}

/** The nodes you may go to next. */
export function availableNodes(exp: ExpeditionState): RouteNode[] {
  if (exp.status !== 'route') return [];
  const ids = exp.current === null ? exp.nodes.filter((n) => n.layer === 0).map((n) => n.id) : nodeById(exp, exp.current).next;
  return ids.map((id) => nodeById(exp, id)).filter((n) => !n.done && !n.blocked);
}

function complete(content: Content, run: RunState, exp: ExpeditionState, nodeId: string): void {
  const node = nodeById(exp, nodeId);
  node.done = true;
  exp.current = nodeId;
  exp.node = null;
  exp.status = 'route';
  // A Legendary stage acts on the party and on the route after every stop (but not after its finale).
  const def = getExpedition(content, exp.id);
  if (def.legendary && node.kind !== 'finale') exp.log.push(...afterStop(content, run, exp, def, node.layer));
}

function tierName(tier: number): 'early' | 'mid' | 'late' | 'grand' {
  return (['early', 'mid', 'late', 'grand'] as const)[Math.max(0, Math.min(3, tier - 1))]!;
}

export function chooseExpeditionNode(content: Content, current: RunState, nodeId: string): RunState {
  const run = structuredClone(current);
  const exp = run.expedition;
  if (run.phase !== 'expedition' || !exp) throw new Error('No expedition in progress');
  if (exp.battleResult) throw new Error('Settle the last fight first');
  const target = availableNodes(exp).find((n) => n.id === nodeId);
  if (!target) throw new Error(`Node "${nodeId}" is not available`);
  const def = getExpedition(content, exp.id);
  const rng = new Rng(hashSeed(`${run.seed}::expedition-node::${exp.id}:${nodeId}`));
  exp.node = nodeId;
  const fight = (start: () => void) => {
    if (!run.party.some((p) => p.hp > 0)) throw new Error('No healthy Pokémon to battle with');
    start();
    run.battle!.expedition = true;
    exp.status = 'battle';
    exp.log.push(`${nodeLabel(target.kind)}.`);
    // A Legendary stage sets the weather and terrain of its fights (the finale Totem brings its own).
    if (def.legendary && target.kind !== 'finale') {
      const line = applyBattleEnvironment(def, run.battle!, target.layer, new Rng(hashSeed(`${run.seed}::legend-env::${exp.id}:${nodeId}`)));
      if (line) exp.log.push(line);
    }
  };
  switch (target.kind as ExpeditionNodeKind) {
    case 'wild':
    case 'trainer':
    case 'elite': {
      const column = getCampaign(content, run.campaignId).columns;
      if (def.legendary && target.kind === 'wild') {
        fight(() => startLegendWild(content, run, rng.pick(def.legendary!.wild), exp.level + def.legendary!.wildLevelBonus));
        break;
      }
      const node: MapNode = { id: `exp-${nodeId}`, column, row: 0, kind: target.kind === 'wild' ? 'wild' : 'trainer', harder: target.kind === 'elite', next: [], sides: [], note: '' };
      fight(() => startEncounter(content, run, node));
      if (target.kind === 'elite') run.battle!.ai = Math.max(run.battle!.ai, 0.5);
      break;
    }
    case 'totem': {
      const pool = content.totems.totems.filter((t) => t.tier === tierName(def.tier) && !t.legendary);
      const totem = rng.pick(pool.length > 0 ? pool : content.totems.totems.filter((t) => !t.legendary));
      fight(() => startTotemBattle(content, run, totem, rng.pick(totem.species), Math.min(exp.level + totem.levelBonus, exp.level + 4)));
      break;
    }
    case 'raid': {
      const pool = content.raids.raids.filter((r) => !r.gang && r.tier === Math.min(6, def.tier + 1) && !r.legendary);
      const raid = rng.pick(pool.length > 0 ? pool : content.raids.raids.filter((r) => !r.gang && !r.legendary));
      fight(() => startRaidBattle(content, run, raid, rng.pick(raid.species), Math.min(exp.level + raid.levelBonus, exp.level + 5)));
      break;
    }
    case 'finale': {
      const fin = def.finale;
      if (def.legendary) exp.log.push(def.legendary.finale.intro);
      if (fin.kind === 'raid') {
        const raid = getRaid(content, fin.raidId);
        fight(() => startRaidBattle(content, run, raid, rng.pick(raid.species), Math.min(exp.level + raid.levelBonus, exp.level + 5)));
      } else if (fin.kind === 'totem') {
        const totem = getTotem(content, fin.totemId);
        fight(() => startTotemBattle(content, run, totem, rng.pick(totem.species), Math.min(exp.level + totem.levelBonus, exp.level + 4)));
      } else {
        fight(() => startMegaGuardian(content, run, rng.pick(fin.species), exp.level + fin.levelBonus, fin.hpBoostPercent));
      }
      break;
    }
    case 'cache': {
      for (const c of def.cache) if (rng.chance(c.chance)) addLoot(exp, c.item, 1);
      exp.log.push('You found a cache of supplies.');
      complete(content, run, exp, nodeId);
      break;
    }
    case 'research': {
      exp.loot.research += 1;
      exp.log.push(`Research station: ${exp.loot.research}/${def.researchGoal}.`);
      complete(content, run, exp, nodeId);
      break;
    }
    case 'megaEnergy': {
      exp.loot.energy += 1;
      exp.log.push(`Mega Energy collected (${exp.loot.energy}).`);
      grantMegaIfReady(content, run, exp, def, rng);
      complete(content, run, exp, nodeId);
      break;
    }
    case 'rest': {
      exp.status = 'choice';
      exp.choice = {
        kind: 'rest', title: 'Rest area', left: 1,
        options: [{ label: 'Rest', detail: `Heal ${Math.round(def.restHeal * 100)}% of every Pokémon's HP and cure status.` }, { label: 'Forage', detail: 'Skip the rest and gather supplies instead.' }],
      };
      break;
    }
    case 'mystery': {
      const npc = def.legendary ? rng.pick(def.legendary.npcs) : null;
      const ev = npc ? { id: `npc:${npc.id}`, text: `${npc.name}: ${npc.text}`, options: npc.options } : rng.pick(content.expeditions.mysteryEvents);
      exp.status = 'choice';
      exp.choice = { kind: 'mystery', title: ev.text, left: 1, options: ev.options.map((o) => ({ label: o.label, detail: '', speciesId: undefined })) };
      exp.log.push(ev.id);
      break;
    }
    case 'recruit': {
      exp.status = 'choice';
      exp.choice = { kind: 'recruit', title: 'A Pokémon wants to join you', left: 1, options: [...draftOptions(content, rentalOptions(def, rng, 3), exp.level), { label: 'Move on', detail: 'Recruit no one.' }] };
      break;
    }
  }
  return run;
}

function addLoot(exp: ExpeditionState, item: string, n: number): void {
  exp.loot.items[item] = (exp.loot.items[item] ?? 0) + n;
}

/** Mega Energy for a Mega Stone: a lent Mega Ring and a stone for a party Pokémon that can use one. */
function grantMegaIfReady(content: Content, run: RunState, exp: ExpeditionState, def: ExpeditionDef, rng: Rng): void {
  const given = exp.tempItems.filter((i) => i !== 'mega-ring').length;
  if (exp.loot.energy < def.megaCost * (given + 1)) return;
  const owned = (id: string) => itemCount(run.inventory, id) > 0;
  for (const item of rng.shuffle([...content.items.values()])) {
    if (item.effect.kind !== 'megaStone' || item.effect.primal || owned(item.id)) continue;
    const forms = Object.keys(item.effect.forms);
    if (!run.party.some((m) => forms.includes(m.speciesId))) continue;
    addItem(run.inventory, item.id, 1);
    exp.tempItems.push(item.id);
    if (!owned('mega-ring')) {
      addItem(run.inventory, 'mega-ring', 1);
      exp.tempItems.push('mega-ring');
    }
    exp.log.push(`Mega Energy became ${item.name} for this expedition!`);
    return;
  }
  exp.log.push('Mega Energy gathered, but nobody in your party can use a Mega Stone yet.');
}

/** A wild fight on a Legendary stage, from the event's own table. */
function startLegendWild(content: Content, run: RunState, speciesId: string, level: number): void {
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  const mon = newMon(content, run, speciesId, level, 'e');
  mon.hp = maxHp(content, mon);
  run.battle = createBattle('wild', [mon], activeIndex, run.party[activeIndex]!.uid);
  run.battle.ai = 0.5;
  discover(run, speciesId, false);
  run.phase = 'battle';
  recordBattleStarted(content, run);
}

function startMegaGuardian(content: Content, run: RunState, speciesId: string, level: number, hpBoost: number): void {
  const activeIndex = run.party.findIndex((p) => p.hp > 0);
  const boss = newMon(content, run, speciesId, level, 'e');
  boss.statBoosts = { ...boss.statBoosts, hp: hpBoost };
  boss.hp = maxHp(content, boss);
  run.battle = createBattle('trainer', [boss], activeIndex, run.party[activeIndex]!.uid, { classId: 'black-belt', name: 'Mega Guardian', leaderId: null });
  run.battle.ai = 0.8;
  run.battle.transform.enemyMechanics = run.disabledMechanics?.includes('mega') ? [] : ['mega'];
  discover(run, speciesId, false);
  run.phase = 'battle';
}

/** Answers the pending choice (draft pick, recruit, rest option, event option). */
export function resolveExpeditionChoice(content: Content, current: RunState, index: number): RunState {
  const run = structuredClone(current);
  const exp = run.expedition;
  if (run.phase !== 'expedition' || !exp || !exp.choice) throw new Error('Nothing to choose');
  const choice = exp.choice;
  const def = getExpedition(content, exp.id);
  const option = choice.options[index];
  if (!option) throw new Error(`No option ${index}`);
  const rng = new Rng(hashSeed(`${run.seed}::expedition-choice::${exp.id}:${exp.node ?? 'start'}:${exp.log.length}`));
  if (choice.kind === 'draft' || choice.kind === 'combined' || choice.kind === 'recruit') {
    if (option.speciesId) {
      addTemp(content, run, exp, option.speciesId);
      exp.log.push(`${option.label} joined.`);
    }
    choice.options.splice(index, 1);
    choice.left -= 1;
    if (choice.left > 0 && choice.options.length > 0 && option.speciesId) return run;
  } else if (choice.kind === 'rest') {
    if (index === 0) {
      for (const mon of run.party) {
        mon.hp = Math.min(maxHp(content, mon), mon.hp + Math.ceil(maxHp(content, mon) * def.restHeal));
        mon.status = null;
      }
      exp.log.push('The team rested.');
    } else {
      addLoot(exp, def.cache[0]!.item, 1);
      exp.log.push('You foraged for supplies.');
    }
  } else {
    const last = exp.log[exp.log.length - 1]!;
    const npc = last.startsWith('npc:') ? def.legendary?.npcs.find((n) => `npc:${n.id}` === last) : null;
    const ev = npc ? { options: npc.options } : content.expeditions.mysteryEvents.find((e) => e.id === last);
    const eff = ev?.options[index]?.effect ?? {};
    if (ev) exp.log.push(ev.options[index]!.result);
    if (eff.heal) for (const mon of run.party) mon.hp = Math.min(maxHp(content, mon), mon.hp + Math.ceil(maxHp(content, mon) * eff.heal));
    if (eff.hurt) for (const mon of run.party) if (mon.hp > 0) mon.hp = Math.max(1, mon.hp - Math.ceil(maxHp(content, mon) * eff.hurt));
    // Gains go into the loot (kept on extraction); a price is paid from your purse.
    if (eff.money && eff.money > 0) exp.loot.money += eff.money;
    if (eff.money && eff.money < 0) run.money = Math.max(0, run.money + eff.money);
    if (eff.item) addLoot(exp, eff.item, 1);
    if (eff.research) exp.loot.research += eff.research;
    if (eff.energy) {
      exp.loot.energy += eff.energy;
      grantMegaIfReady(content, run, exp, def, rng);
    }
  }
  exp.choice = null;
  if (exp.node) complete(content, run, exp, exp.node);
  else exp.status = 'route';
  return run;
}

/** After a fight (the run read `battleResult`): a win moves on or finishes; a loss ends the expedition in failure. */
export function settleExpedition(content: Content, current: RunState): RunState {
  const exp = current.expedition;
  if (!exp || !exp.battleResult) return current;
  const run = structuredClone(current);
  const e = run.expedition!;
  const result = e.battleResult!;
  e.battleResult = null;
  if (result === 'lose') return finish(content, run, 'failed');
  const node = nodeById(e, e.node!);
  if (node.kind === 'elite') addLoot(e, getExpedition(content, e.id).cache[0]!.item, 1);
  complete(content, run, e, node.id);
  return node.kind === 'finale' ? finish(content, run, 'completed') : run;
}

/** Leave now with the loot (no finale rewards, no unlock). */
export function extractExpedition(content: Content, current: RunState): RunState {
  const exp = current.expedition;
  if (current.phase !== 'expedition' || !exp) throw new Error('No expedition in progress');
  if (exp.status === 'battle' || exp.battleResult) throw new Error('Finish the fight first');
  return finish(content, structuredClone(current), 'extracted');
}

function finish(content: Content, run: RunState, outcome: 'completed' | 'extracted' | 'failed'): RunState {
  const exp = run.expedition!;
  const def = getExpedition(content, exp.id);
  const summary: string[] = [];
  // Your own Pokémon come back; rentals and recruits leave.
  run.party = [...run.party.filter((p) => !exp.tempUids.includes(p.uid)), ...(exp.stash ?? [])];
  if (run.party.length === 0) throw new Error('The expedition would leave you with no Pokémon');
  if (outcome === 'failed') {
    const kept = Math.floor(exp.loot.money * def.failureKeep);
    run.money += kept;
    for (const id of exp.tempItems) while (itemCount(run.inventory, id) > 0) consumeItem(run.inventory, id);
    const frac = content.expeditions.failureHealFraction;
    for (const mon of run.party) {
      mon.hp = Math.max(1, Math.floor(maxHp(content, mon) * frac));
      mon.status = null;
    }
    summary.push(`The expedition failed. The loot was lost (₽${kept} kept). Your team is safe.`);
    run.expeditions.failed.push(def.id);
  } else {
    const rng = new Rng(hashSeed(`${run.seed}::expedition-reward::${def.id}:${run.encountersCompleted}`));
    run.money += exp.loot.money;
    for (const [id, n] of Object.entries(exp.loot.items)) addItem(run.inventory, id, n);
    summary.push(`Loot kept: ${[exp.loot.money ? `₽${exp.loot.money}` : '', ...Object.entries(exp.loot.items).map(([i, n]) => `${n} ${i.replace(/-/g, ' ')}`)].filter(Boolean).join(', ') || 'nothing'}.`);
    // The lent Mega Ring goes back; the stones stay only after a full completion.
    if (itemCount(run.inventory, 'mega-ring') > 0 && exp.tempItems.includes('mega-ring')) consumeItem(run.inventory, 'mega-ring');
    if (outcome === 'extracted') {
      for (const id of exp.tempItems) if (id !== 'mega-ring') consumeItem(run.inventory, id);
      run.expeditions.last = [...summary, 'You extracted early.'];
    } else {
      const money = def.rewards.moneyPerLevel * exp.level;
      run.money += money;
      for (const r of def.rewards.items) if (rng.chance(r.chance)) addItem(run.inventory, r.item, 1);
      const stones = grantStones(content, run, def.rewards.megaStones, rng);
      if (exp.loot.research >= def.researchGoal && def.rewards.researchBonusItem) addItem(run.inventory, def.rewards.researchBonusItem, 1);
      if (def.unlocks && !run.expeditions.unlocked.includes(def.unlocks)) run.expeditions.unlocked.push(def.unlocks);
      run.expeditions.completed.push(def.id);
      summary.push(`Completed! ₽${money}${stones.length ? `, ${stones.join(', ')}` : ''}${exp.loot.research >= def.researchGoal ? ', research goal reached' : ''}.`);
    }
  }
  if (def.legendary) {
    recordOutcome(run, def, outcome);
    const f = def.legendary.finale;
    if (outcome === 'completed') summary.unshift(f.win);
    else if (outcome === 'failed') summary.unshift(f.lose);
  }
  run.expeditions.last = summary;
  run.expedition = null;
  run.phase = 'map';
  return run;
}

/** Mega Stones for good: up to `max`, for party Pokémon that can use one and do not have it yet. Returns their names. */
export function grantStones(content: Content, run: RunState, max: number, rng: Rng): string[] {
  return pickStones(content, run, max, rng).map((stone) => {
    addItem(run.inventory, stone.id, 1);
    return stone.name;
  });
}

/** The Mega Stones `grantStones` would give (one per Pokémon, never a stone already owned), without giving them. */
export function pickStones(content: Content, run: RunState, max: number, rng: Rng): Item[] {
  const out: Item[] = [];
  const items = [...content.items.values()].filter((i) => i.effect.kind === 'megaStone' && !i.effect.primal);
  for (const mon of rng.shuffle([...run.party])) {
    if (out.length >= max) break;
    const stone = items.find((i) => i.effect.kind === 'megaStone' && mon.speciesId in i.effect.forms && itemCount(run.inventory, i.id) === 0 && !out.includes(i));
    if (stone) out.push(stone);
  }
  return out;
}
