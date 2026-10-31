// Using a service stop (Untitled doc §19): Pokémon Center, Move Tutor, Move Reminder, Research Lab, Trade Post, Scout Tower.
// Every option shows its price and why it cannot be picked. Choices come from the run seed and the stop, never from UI events,
// so a reload shows the same offers. Paying and applying happen together, once.

import { bossInfo } from '../regions';
import { count, discover } from '../progress';
import { baseStatTotal, wildEligibleSpecies } from '../themes';
import { hashSeed, Rng } from '../rng';
import { healParty, newMon, partyCapacity, requireStage } from '../run';
import { runLevelCap } from '../regions';
import { layEgg } from '../eggs';
import { familyId } from '../mastery';
import { evolveFully } from '../evolution';
import { abilityOf, addLevels, createPokemon, maxHp, maxPp, usableLearnset, getSpecies } from '../pokemon';
import { specialFamily } from '../specialForms';
import { applyCatalog, catalogTargetProblem, getCatalogEntry } from '../catalog';
import { addItem, itemUseProblem } from '../items';
import { applyRecipe, CRAFTING, materialName, recipeCost, recipeProblem } from '../crafting';
import { isHostile } from '../rivals/outcome';
import { changeFriendship } from '../friendship';
import { ATTRIBUTE_KEYS, METER_ATTRIBUTES, type Content, type Item, type StatName } from '../contentSchema';
import type { PokemonInstance, RunState, SideStop } from '../state';
import { recordTraded } from '../story/hooks';
import { claimKeepsake, grantKeepsake, keepsakeName, keepsakeValid, nextKeepsake, type Keepsake } from '../memories/keepsakes';
import { MEMORIES } from '../memories/schema';
import { getService, SERVICES, type ServiceDef } from './schema';
import { highestOpenTier } from '../raid/raid';

export interface ServiceOption {
  id: string;
  title: string;
  text: string;
  cost: number;
  /** Why it cannot be picked now, or null. */
  problem: string | null;
}
export interface ServiceView {
  service: ServiceDef;
  money: number;
  used: boolean;
  options: ServiceOption[];
}

const C = SERVICES.costs;
const price = (run: RunState, base: number): number => Math.round(base * (1 + C.regionScale * run.regionIndex));

function findStop(run: RunState, sideId: string): SideStop {
  const stage = requireStage(run);
  if (stage.current === null) throw new Error('Choose a node first');
  const side = stage.map.nodes.find((n) => n.id === stage.current)!.sides.find((s) => s.id === sideId && s.kind === 'service' && s.serviceId);
  if (!side) throw new Error(`No service stop "${sideId}" here`);
  return side;
}

const moveName = (content: Content, id: string) => content.moves.get(id)?.name ?? id;
const monName = (content: Content, mon: PokemonInstance) => getSpecies(content, mon.speciesId).name;

/** Which known move a new one would replace (-1: a free slot): the weakest by power, status moves count as 30. */
export function replacedIndex(content: Content, mon: PokemonInstance): number {
  if (mon.moves.length < 4) return -1;
  let best = 0;
  let bestScore = Infinity;
  mon.moves.forEach((slot, i) => {
    const score = content.moves.get(slot.id)?.power ?? 30;
    if (score < bestScore) { best = i; bestScore = score; }
  });
  return best;
}

function moveCard(content: Content, id: string): string {
  const m = content.moves.get(id)!;
  return `${m.type}, ${m.category}, power ${m.power ?? '-'}, accuracy ${m.accuracy ?? '-'}, ${m.pp} PP`;
}

function replaceText(content: Content, mon: PokemonInstance, moveId: string): string {
  const at = replacedIndex(content, mon);
  const forgets = at < 0 ? 'learns it in a free slot' : `forgets ${moveName(content, mon.moves[at]!.id)}`;
  return `${monName(content, mon)} ${forgets}. ${moveName(content, moveId)}: ${moveCard(content, moveId)}.`;
}

/** Moves a Pokémon could learn here that it does not know: TM/tutor/egg moves (tutor) or level-up moves up to its level (reminder). */
function tutorMoves(content: Content, mon: PokemonInstance, sideId: string, run: RunState): string[] {
  const species = getSpecies(content, mon.speciesId);
  const levelUp = new Set(species.learnset.map((e) => e.move));
  const pool = (content.learnables.get(species.id) ?? (species.form ? content.learnables.get(species.form.base) : undefined) ?? [])
    .filter((id) => content.moves.get(id)?.supported === true && !levelUp.has(id) && !mon.moves.some((m) => m.id === id))
    .sort();
  const rng = new Rng(hashSeed(`${run.seed}::tutor::${sideId}:${mon.uid}`));
  const picked: string[] = [];
  const rest = [...pool];
  while (picked.length < 3 && rest.length > 0) picked.push(rest.splice(rng.int(0, rest.length - 1), 1)[0]!);
  return picked;
}

function reminderMoves(content: Content, mon: PokemonInstance): string[] {
  const seen = new Set<string>();
  return usableLearnset(content, getSpecies(content, mon.speciesId))
    .filter((e) => e.level <= mon.level && !mon.moves.some((m) => m.id === e.move))
    .reverse()
    .filter((e) => (seen.has(e.move) ? false : (seen.add(e.move), true)))
    .slice(0, 4)
    .map((e) => e.move);
}

/** The Trade Post's offer for one party member: similar strength, sometimes a regional form (only reachable this way or by events). */
export function tradeOffer(content: Content, run: RunState, sideId: string, mon: PokemonInstance): string | null {
  const own = getSpecies(content, mon.speciesId);
  const bst = baseStatTotal(own);
  const rng = new Rng(hashSeed(`${run.seed}::trade::${sideId}:${mon.uid}`));
  const owned = new Set(run.party.map((p) => p.speciesId));
  const fits = (spread: number) => (s: { id: string; baseStats: typeof own.baseStats }) => !owned.has(s.id) && Math.abs(baseStatTotal(s as typeof own) - bst) <= bst * spread;
  const open = ['regional', ...openFormFamilies(run)];
  const special = [...content.species.values()].filter((s) => open.includes(specialFamily(s) ?? '') && fits(C.tradeBstSpread * 2)(s));
  if (special.length > 0 && rng.chance(C.tradeSpecialChance)) return special[rng.int(0, special.length - 1)]!.id;
  const normal = wildEligibleSpecies(content).filter(fits(C.tradeBstSpread));
  return normal.length > 0 ? normal[rng.int(0, normal.length - 1)]!.id : null;
}


/** Three shrine offers: which attribute rises and which falls, from the seed. */
function relicPairs(run: RunState, sideId: string): [string, string][] {
  const keys = ATTRIBUTE_KEYS.filter((k) => !METER_ATTRIBUTES.includes(k as never)) as string[];
  const rng = new Rng(hashSeed(`${run.seed}::relic::${sideId}`));
  const out: [string, string][] = [];
  while (out.length < 3) {
    const gain = rng.pick(keys);
    const lose = rng.pick(keys.filter((k) => k !== gain));
    if (!out.some(([g, l]) => g === gain && l === lose)) out.push([gain, lose]);
  }
  return out;
}

/** The auction's three lots with their opening bids. */
/** The two fossils on offer at a stop: fixed by the seed, so reloading never changes them. */
function fossilLots(content: Content, run: RunState, sideId: string): { id: string; name: string; species: string }[] {
  const pool = [...content.catalog.values()].filter((e) => e.status === 'supported' && e.effect?.kind === 'fossil' && content.species.has(e.effect.species)).sort((a, b) => a.id.localeCompare(b.id));
  const rng = new Rng(hashSeed(`${run.seed}::fossil::${sideId}`));
  return rng.shuffle(pool).slice(0, 2).map((e) => ({ id: e.id, name: e.name, species: (e.effect as { species: string }).species }));
}

/** Up to three shop items your badges haven't unlocked, fixed by the seed, with their marked-up prices. */
function marketLots(content: Content, run: RunState, sideId: string): [Item, number][] {
  const locked = content.shop.filter((e) => e.minBadges > run.badges.length && content.items.has(e.item)).sort((a, b) => a.item.localeCompare(b.item));
  const rng = new Rng(hashSeed(`${run.seed}::market::${sideId}`));
  return rng.shuffle(locked).slice(0, 3).map((e) => [content.items.get(e.item)!, Math.round(price(run, e.price) * C.marketMarkup)]);
}

/** The berry growing at a garden stop: a held berry from the item catalog, fixed by the seed. */
function gardenBerry(content: Content, run: RunState, sideId: string) {
  const pool = [...content.catalog.values()].filter((e) => e.status === 'supported' && e.family.startsWith('Berries') && e.stacksOn === 'pokemon' && e.effect?.kind === 'held').sort((a, b) => a.id.localeCompare(b.id));
  return pool.length === 0 ? null : pool[new Rng(hashSeed(`${run.seed}::garden::${sideId}`)).int(0, pool.length - 1)]!;
}

/** Three rare-ish Pokémon roaming the preserve, fixed by the seed. */
function safariLots(content: Content, run: RunState, sideId: string): string[] {
  const pool = wildEligibleSpecies(content).filter((sp) => baseStatTotal(sp) >= 400 && baseStatTotal(sp) <= 540).map((sp) => sp.id).sort();
  return new Rng(hashSeed(`${run.seed}::safari::${sideId}`)).shuffle(pool).slice(0, 3);
}

/** Other abilities a Pokémon could have: slot number and ability id (-1 is the hidden one). */
function abilityAlternatives(content: Content, mon: PokemonInstance): { slot: number; id: string }[] {
  const { normal, hidden } = getSpecies(content, mon.speciesId).abilities;
  const alts = normal.map((id, slot) => ({ slot, id }));
  if (hidden) alts.push({ slot: -1, id: hidden });
  const now = abilityOf(content, mon);
  return alts.filter((a, i) => a.id !== now && alts.findIndex((b) => b.id === a.id) === i);
}

/** Delta, Z and Spooky forms open to eggs and trades once the run has won that family's route battle (flag set by its event). */
export const FORM_FAMILY_FLAGS: Record<string, { flag: string; name: string }> = {
  delta: { flag: 'ev:delta-met', name: 'Delta' },
  zform: { flag: 'ev:z-met', name: 'Z-Form' },
  spooky: { flag: 'ev:spooky-met', name: 'Spooky' },
};
export const openFormFamilies = (run: RunState): string[] => Object.entries(FORM_FAMILY_FLAGS).filter(([, f]) => Number(run.story.flags[f.flag] ?? 0) > 0).map(([id]) => id);
const formEggSpecies = (content: Content, family: string): string[] =>
  [...content.species.values()].filter((sp) => sp.evolutionStage === 1 && specialFamily(sp) === family && specialFamily(getSpecies(content, familyId(content, sp.id))) === family).map((sp) => sp.id).sort();

/** The regional first-stage forms the nursery could hatch, in a fixed order (the choice among them is seeded). */
function regionalEggSpecies(content: Content): string[] {
  return [...content.species.values()].filter((sp) => sp.evolutionStage === 1 && specialFamily(sp) === 'regional').map((sp) => sp.id).sort();
}

function auctionLots(content: Content, run: RunState, sideId: string): [Item, number][] {
  const pool = [...content.items.values()].filter((i) => ['healing', 'pp', 'revive', 'evolution'].includes(i.category)).sort((a, b) => a.id.localeCompare(b.id));
  const rng = new Rng(hashSeed(`${run.seed}::auction::${sideId}`));
  const lots: [Item, number][] = [];
  const rest = [...pool];
  while (lots.length < 3 && rest.length > 0) lots.push([rest.splice(rng.int(0, rest.length - 1), 1)[0]!, Math.round(price(run, C.auctionReserve) * (0.6 + rng.float() * 0.8))]);
  return lots;
}

/** The Lost-and-Found lot at an auction stop: a keepsake from an earlier run, or none (a hash of the seed picks which stops have one). */
function lostFoundLot(content: Content, run: RunState, sideId: string): { index: number; k: Keepsake; cost: number } | null {
  const k = nextKeepsake(run);
  if (!k || !keepsakeValid(content, k.itemId) || new Rng(hashSeed(`${run.seed}::lostfound::${sideId}`)).float() >= MEMORIES.lostFound.chance) return null;
  return { index: run.past!.keepsakes.indexOf(k), k, cost: Math.max(50, Math.round(price(run, C.auctionReserve) * MEMORIES.lostFound.discount)) };
}

/** The room's hidden best bid on a lot: fixed by the seed, so reloading never changes the result. */
function hiddenBid(run: RunState, sideId: string, itemId: string, reserve: number): number {
  return Math.round(reserve * (0.9 + new Rng(hashSeed(`${run.seed}::auction-room::${sideId}:${itemId}`)).float() * 0.9));
}

export function serviceView(content: Content, run: RunState, sideId: string): ServiceView {
  const side = findStop(run, sideId);
  const service = getService(side.serviceId!);
  const options: ServiceOption[] = [];
  const broke = (cost: number) => (run.money < cost ? `You need ₽${cost}.` : null);
  const add = (id: string, title: string, text: string, cost: number, problem: string | null = null) => options.push({ id, title, text, cost, problem: problem ?? broke(cost) });
  switch (service.id) {
    case 'center': {
      const hurt = run.party.filter((m) => m.hp < maxHp(content, m) || m.status || m.moves.some((s) => s.pp < maxPp(content, s)));
      const healCost = price(run, C.healPerMon) * hurt.length;
      add('heal', 'Heal everyone', 'Full HP, no status, full PP.', healCost, hurt.length === 0 ? 'Your party is already in top shape.' : null);
      const sick = run.party.filter((m) => m.status && m.hp > 0);
      add('cure', 'Cure status', `Clears status on ${sick.length} Pokémon, keeping HP.`, price(run, C.curePerMon) * sick.length, sick.length === 0 ? 'Nobody has a status problem.' : null);
      for (const m of run.party.filter((p) => p.hp <= 0)) add(`revive:${m.uid}`, `Revive ${monName(content, m)}`, 'Back on its feet with half HP.', price(run, C.revivePerMon));
      break;
    }
    case 'tutor':
      for (const m of run.party) for (const id of tutorMoves(content, m, sideId, run)) add(`tutor:${m.uid}:${id}`, `${monName(content, m)}: ${moveName(content, id)}`, replaceText(content, m, id), price(run, C.tutor), side.used ? 'The tutor has already taught someone.' : null);
      break;
    case 'reminder':
      for (const m of run.party) for (const id of reminderMoves(content, m)) add(`remind:${m.uid}:${id}`, `${monName(content, m)}: ${moveName(content, id)}`, replaceText(content, m, id), price(run, C.reminder));
      break;
    case 'lab': {
      const used = side.used ? 'The lab has already done its work for you.' : null;
      add('research', 'Field research', `Pay for ${C.researchPoints} Research Points, added when the run ends.`, price(run, C.researchPrice), used);
      const hidden = requireStage(run).map.nodes.some((n) => n.sides.some((s) => s.kind === 'event' && s.hidden));
      add('scan', 'Scan for hidden stops', 'Turns every "?" stop on this map into a named one.', price(run, C.scan), used ?? (hidden ? null : 'There are no hidden stops on this map.'));
      break;
    }
    case 'trade':
      for (const m of run.party) {
        const to = tradeOffer(content, run, sideId, m);
        if (!to) continue;
        const sp = getSpecies(content, to);
        add(`trade:${m.uid}:${to}`, `${monName(content, m)} for ${sp.name}`, `Lv${m.level} ${sp.name} (${sp.types.join('/')}, base total ${baseStatTotal(sp)}${specialFamily(sp) ? ', a special form' : ''}). Its moves and friendship start fresh.`, price(run, C.tradeFee), side.used ? 'The trade is done.' : null);
      }
      break;
    case 'lookout': {
      const stage = requireStage(run);
      add('scout', 'Scout the stage boss', `Learn ${stage.leaderId ? bossInfo(content, 'gym', stage.leaderId).title : 'the boss'}'s types and signature Pokémon.`, price(run, C.scout), side.used ? 'You already scouted from here.' : null);
      break;
    }
    case 'mart2': {
      const items = [...content.items.values()]
        .filter((it) => it.category === 'evolution' && it.effect.kind === 'evolve' && run.party.some((m) => itemUseProblem(content, it, m, run.regionOrder[run.regionIndex]) === null))
        .sort((a, b) => a.id.localeCompare(b.id));
      for (const it of items) add(`buy:${it.id}`, it.name, `${it.description} You have ${run.inventory[it.id] ?? 0}.`, price(run, C.evolutionItem));
      if (items.length === 0) add('none', 'Nothing for your party today', 'No evolution item here would work on anyone you carry.', 0, 'Nothing to sell you.');
      break;
    }
    case 'dojo':
      for (const m of run.party) {
        const top = (Object.entries(getSpecies(content, m.speciesId).baseStats) as [StatName, number][]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2);
        for (const [stat] of top) {
          const stacks = m.vitamins[stat] ?? 0;
          add(`train:${m.uid}:${stat}`, `${monName(content, m)}: ${stat.toUpperCase()}`, `One training session: +1 ${stat.toUpperCase()} stack (${stacks} of ${content.balance.vitaminMaxStacks} now).`, price(run, C.dojo),
            side.used ? 'The dojo has already trained someone today.' : stacks >= content.balance.vitaminMaxStacks ? 'Already fully trained in that.' : null);
        }
      }
      break;
    case 'meeting': {
      const rivals = run.story.rivals.filter((r) => isHostile(r));
      for (const r of rivals) {
        const who = `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;
        const used = side.used ? 'You already spent your time here.' : null;
        add(`size:${r.id}`, `Size up ${who}`, `See their last team and what they have learned about you.`, 0, used);
        add(`truce:${r.id}`, `Ask ${who} for a truce`, 'They skip their next appearance.', price(run, C.truce), used);
      }
      break;
    }
    case 'lodge':
      for (const m of run.party) add(`rest:${m.uid}`, `Rest with ${monName(content, m)}`, `Friendship +${C.lodgeFriendship} (now ${m.friendship}).`, 0, side.used ? 'You already rested here.' : m.hp <= 0 ? 'It has fainted.' : null);
      break;
    case 'nursery':
      add('egg', 'Buy a Mystery Egg', 'Hatches after 3 stages into a first-stage Pokémon (shiny chance x4). It is not a party member until it hatches.', price(run, C.eggPrice), side.used ? 'The nursery has no more eggs for you.' : null);
      add('regional', 'Buy a Regional Egg', 'Hatches after 3 stages into a first-stage regional form (Alolan, Galarian...).', price(run, C.regionalEgg), side.used ? 'The nursery has no more eggs for you.' : regionalEggSpecies(content).length === 0 ? 'No regional eggs are in stock.' : null);
      for (const family of openFormFamilies(run)) add(`formegg:${family}`, `Buy a ${FORM_FAMILY_FLAGS[family]!.name} Egg`, `Hatches after 3 stages into a first-stage ${FORM_FAMILY_FLAGS[family]!.name} form. Open because you won its route battle.`, price(run, C.formEgg), side.used ? 'The nursery has no more eggs for you.' : null);
      break;
    case 'fossil':
      for (const f of fossilLots(content, run, sideId)) add(`fossil:${f.id}`, `Restore the ${f.name}`, `Brings back ${getSpecies(content, f.species).name} at your party's average level.`, price(run, C.fossilPrice), side.used ? 'The restorer has finished for today.' : null);
      break;
    case 'school':
      for (const m of run.party) add(`class:${m.uid}`, `Enrol ${monName(content, m)}`, `+${C.schoolLevels} levels (now ${m.level}, cap ${runLevelCap(content, run)}).`, price(run, C.schoolPrice), side.used ? 'The school has closed for the day.' : m.hp <= 0 ? 'It has fainted.' : m.level >= runLevelCap(content, run) ? 'Already at the level cap.' : null);
      break;
    case 'market': {
      const lots = marketLots(content, run, sideId);
      for (const [it, cost] of lots) add(`buy:${it.id}`, it.name, `${it.description}. Sold at ${C.marketMarkup}x the shop price.`, cost, side.used ? 'The dealer has packed up.' : null);
      if (lots.length === 0) add('none', 'Nothing off the books', 'Your badges already open everything the shop sells.', 0, 'Nothing to sell you.');
      break;
    }
    case 'garden': {
      const berry = gardenBerry(content, run, sideId);
      if (!berry) break;
      for (const m of run.party) add(`berry:${m.uid}`, `Give ${berry.name} to ${monName(content, m)}`, `${berry.description}.`, price(run, C.gardenPrice), side.used ? 'The garden has been picked.' : catalogTargetProblem(content, run, berry, m));
      break;
    }
    case 'safari':
      for (const id of safariLots(content, run, sideId)) add(`safari:${id}`, `Chase ${getSpecies(content, id).name}`, `${Math.round(C.safariCatch * 100)}% to catch; it runs off if you miss. It joins the party, or the PC if full.`, price(run, C.safariEntry), side.used ? 'The preserve has closed for you.' : null);
      break;
    case 'researcher':
      for (const m of run.party) for (const a of abilityAlternatives(content, m)) add(`ability:${m.uid}:${a.slot}`, `${monName(content, m)}: ${content.abilities.get(a.id)?.name ?? a.id}`, `${content.abilities.get(a.id)?.description ?? 'Switch ability.'}${a.slot === -1 ? ' (hidden ability)' : ''}`, price(run, a.slot === -1 ? C.abilityHidden : C.abilitySwap), side.used ? 'The researcher has finished for today.' : null);
      break;
    case 'relic':
      for (const [gain, lose] of relicPairs(run, sideId)) add(`relic:${gain}:${lose}`, `${gain} +${C.relicGain}, ${lose} -${C.relicLoss}`, `For the rest of this run: ${gain} rises by ${C.relicGain} and ${lose} falls by ${C.relicLoss}.`, 0, side.used ? 'The shrine has already answered you.' : null);
      break;
    case 'auction':
      for (const [it, reserve] of auctionLots(content, run, sideId)) {
        add(`bid:${it.id}:low`, `${it.name}: bid ₽${reserve}`, `Pays only if you win. The room's best bid is hidden; a higher bid wins more often.`, reserve, side.used ? 'You already bid today.' : null);
        add(`bid:${it.id}:high`, `${it.name}: bid ₽${Math.round(reserve * C.auctionHighBid)}`, 'A strong bid. Still pays only if you win.', Math.round(reserve * C.auctionHighBid), side.used ? 'You already bid today.' : null);
      }
      {
        // Lost-and-Found: a lot with a history, from an earlier run (core/memories/keepsakes.ts), sold at a reduced price.
        const found = lostFoundLot(content, run, sideId);
        if (found) add(`found:${found.index}`, `Lost-and-Found: ${keepsakeName(content, found.k.itemId)}`, `${found.k.line} Sold at a reduced price.`, found.cost, side.used ? 'You already bid today.' : null);
      }
      break;
    case 'workshop': {
      const have = Object.entries(run.materials).filter(([, n]) => n > 0).map(([id, n]) => `${n} ${materialName(id)}`).join(', ');
      add('look', 'Check your materials', have ? `You hold: ${have}.` : 'You hold no materials yet. Win battles and raids to collect them.', 0);
      for (const r of CRAFTING.recipes) add(`craft:${r.id}`, r.name, `Costs ${Object.entries(recipeCost(content, run, r)).map(([id, n]) => `${n} ${materialName(id)}`).join(', ')}${r.money ? ` and ₽${r.money}` : ''}.`, 0, recipeProblem(content, run, r));
      break;
    }
    case 'hall':
      add('read', 'Read the board', 'Shows the event editions counting for this run.', 0);
      break;
    case 'observatory': {
      const dens = requireStage(run).map.nodes.flatMap((n) => n.sides).filter((s) => s.kind === 'raid');
      add('survey', 'Survey the raid dens', `${dens.length} den${dens.length === 1 ? '' : 's'} on this map. Raid tiers open: 1–${highestOpenTier(content, run)} (win a raid to open the next tier for later runs).`, 0, side.used ? 'You already surveyed from here.' : dens.length === 0 ? 'There are no raid dens on this map.' : null);
      break;
    }
    default:
      throw new Error(`Service "${service.id}" is not available`);
  }
  return { service, money: run.money, used: side.used, options };
}

/** Pays for and applies one option (a new run is returned; the old one is untouched). */
export function useService(content: Content, current: RunState, sideId: string, optionId: string): { run: RunState; message: string } {
  const view = serviceView(content, current, sideId);
  const option = view.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`No such option "${optionId}" at this stop`);
  if (option.problem) throw new Error(option.problem);
  const run = structuredClone(current);
  const side = findStop(run, sideId);
  const [kind, uid, arg] = optionId.split(':');
  const mon = run.party.find((m) => m.uid === uid);
  run.money -= option.cost;
  let message = '';
  switch (kind) {
    case 'heal':
      healParty(content, run);
      message = 'Your party is fully healed.';
      break;
    case 'cure':
      for (const m of run.party) if (m.hp > 0) m.status = null;
      message = 'Status problems cured.';
      break;
    case 'revive':
      mon!.hp = Math.max(1, Math.floor(maxHp(content, mon!) / 2));
      mon!.status = null;
      message = `${monName(content, mon!)} is back on its feet.`;
      break;
    case 'tutor':
    case 'remind': {
      const at = replacedIndex(content, mon!);
      const slot = { id: arg!, pp: content.moves.get(arg!)!.pp };
      const forgot = at < 0 ? null : mon!.moves[at]!.id;
      if (at < 0) mon!.moves.push(slot);
      else mon!.moves[at] = slot;
      count(run, kind === 'tutor' ? 'tutorMoves' : 'remindedMoves');
      message = `${monName(content, mon!)} learned ${moveName(content, arg!)}${forgot ? ` and forgot ${moveName(content, forgot)}` : ''}.`;
      break;
    }
    case 'research':
      count(run, 'labResearch', C.researchPoints);
      message = `The lab logged ${C.researchPoints} Research Points for the end of the run.`;
      break;
    case 'scan': {
      let n = 0;
      for (const node of requireStage(run).map.nodes) for (const s of node.sides) if (s.kind === 'event' && s.hidden) { delete s.hidden; n += 1; }
      message = `${n} hidden stop${n === 1 ? '' : 's'} revealed.`;
      break;
    }
    case 'trade': {
      const next = newMon(content, run, arg!, mon!.level, 'p');
      recordTraded(content, run, mon!, arg!);
      run.party[run.party.indexOf(mon!)] = next;
      discover(run, arg!, false);
      count(run, 'tradesMade');
      message = `${monName(content, mon!)} was traded for ${getSpecies(content, arg!).name}!`;
      break;
    }
    case 'buy': {
      addItem(run.inventory, uid!, 1);
      message = `Bought a ${content.items.get(uid!)?.name ?? uid}.`;
      break;
    }
    case 'train': {
      mon!.vitamins[arg as StatName] = (mon!.vitamins[arg as StatName] ?? 0) + 1;
      count(run, 'dojoSessions');
      message = `${monName(content, mon!)} trained its ${arg!.toUpperCase()}.`;
      break;
    }
    case 'size': {
      const r = run.story.rivals.find((x) => x.id === uid)!;
      const team = r.memory.lastBattle.team.map((id) => getSpecies(content, id).name).join(', ');
      message = `${r.name}'s last team: ${team || 'unknown'}.${r.adaptations.length ? ` They have learned: ${r.adaptations[r.adaptations.length - 1]}` : ''}${r.identity ? ` Their team leans ${r.identity.type}.` : ''}`;
      break;
    }
    case 'truce': {
      const r = run.story.rivals.find((x) => x.id === uid)!;
      r.cooldown = Math.max(r.cooldown, 2);
      message = `${r.name} agrees to stay out of your way for a while.`;
      break;
    }
    case 'rest': {
      changeFriendship(content, mon!, C.lodgeFriendship);
      message = `${monName(content, mon!)} had a lovely rest and trusts you more.`;
      break;
    }
    case 'buy': {
      addItem(run.inventory, uid!, 1);
      message = `You slip the dealer your money and take the ${content.items.get(uid!)?.name ?? uid}.`;
      break;
    }
    case 'berry': {
      const berry = gardenBerry(content, run, sideId)!;
      applyCatalog(content, run, berry, mon!, { moneyMultiplier: 1, rng: new Rng(hashSeed(`${run.seed}::garden-use::${sideId}`)) });
      message = `${monName(content, mon!)} now holds the ${berry.name}.`;
      break;
    }
    case 'safari': {
      if (!safariLots(content, current, sideId).includes(uid!)) throw new Error('That Pokémon is not in the preserve');
      const caught = new Rng(hashSeed(`${run.seed}::safari-catch::${sideId}:${uid}`)).float() < C.safariCatch;
      if (!caught) {
        message = `${getSpecies(content, uid!).name} ran off into the tall grass.`;
        break;
      }
      const levels = run.party.map((m) => m.level);
      const level = Math.max(1, Math.min(runLevelCap(content, run), Math.floor(levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length))));
      const born = createPokemon(content, uid!, level, `p${run.nextUid}`, `${run.seed}:p${run.nextUid}`);
      run.nextUid += 1;
      discover(run, born.speciesId, true);
      const toParty = run.party.length < partyCapacity(content, run);
      (toParty ? run.party : run.box).push(born);
      message = `You caught ${getSpecies(content, born.speciesId).name}! It ${toParty ? 'joins your party' : 'waits in the PC'}.`;
      break;
    }
    case 'ability': {
      const slot = Number(arg);
      const alt = abilityAlternatives(content, mon!).find((a) => a.slot === slot);
      if (!alt) throw new Error('That ability is not available');
      mon!.abilitySlot = slot;
      message = `${monName(content, mon!)} now has ${content.abilities.get(alt.id)?.name ?? alt.id}.`;
      break;
    }
    case 'class': {
      const result = addLevels(content, mon!, C.schoolLevels, runLevelCap(content, run));
      changeFriendship(content, mon!, content.balance.friendship.perLevel * result.levelsGained);
      const evolved = evolveFully(content, mon!, run.regionOrder[run.regionIndex], 0);
      for (const evo of evolved) count(run, 'evolutions');
      message = `${monName(content, mon!)} reached level ${result.newLevel}.${evolved.length ? ` It evolved into ${evolved.map((e) => getSpecies(content, e.to).name).join(', then ')}!` : ''}${result.skippedMoves.length ? ' It had no room for some new moves.' : ''}`;
      break;
    }
    case 'look':
      message = 'The workbench is yours.';
      break;
    case 'craft': {
      const recipe = CRAFTING.recipes.find((r) => r.id === uid)!;
      message = applyRecipe(content, run, recipe);
      break;
    }
    case 'fossil': {
      const lot = fossilLots(content, current, sideId).find((f) => f.id === uid)!;
      const levels = run.party.map((m) => m.level);
      const level = Math.max(1, Math.min(runLevelCap(content, run), Math.floor(levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length))));
      const born = createPokemon(content, lot.species, level, `p${run.nextUid}`);
      run.nextUid += 1;
      discover(run, born.speciesId, true);
      const toParty = run.party.length < partyCapacity(content, run);
      (toParty ? run.party : run.box).push(born);
      message = `The ${lot.name} was restored: ${getSpecies(content, born.speciesId).name} ${toParty ? 'joins your party' : 'waits in the PC'}!`;
      break;
    }
    case 'regional': {
      const rng = new Rng(hashSeed(`${run.seed}::nursery-regional::${sideId}`));
      const species = rng.pick(regionalEggSpecies(content));
      const levels = run.party.map((m) => m.level);
      const level = Math.max(1, Math.min(runLevelCap(content, run), Math.floor(levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length)) - 5));
      layEgg(content, run, species, { level, left: 3, unit: 'stage', source: 'Regional Egg' }, rng);
      message = 'You take the egg home. It hatches in 3 stages into a regional form.';
      break;
    }
    case 'formegg': {
      if (!openFormFamilies(run).includes(uid!)) throw new Error('That egg is not in stock yet.');
      const rng = new Rng(hashSeed(`${run.seed}::nursery-form::${uid}::${sideId}`));
      const species = rng.pick(formEggSpecies(content, uid!));
      const levels = run.party.map((m) => m.level);
      const level = Math.max(1, Math.min(runLevelCap(content, run), Math.floor(levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length)) - 5));
      layEgg(content, run, species, { level, left: 3, unit: 'stage', source: `${FORM_FAMILY_FLAGS[uid!]!.name} Egg` }, rng);
      message = `You take the egg home. It hatches in 3 stages into a ${FORM_FAMILY_FLAGS[uid!]!.name} form.`;
      break;
    }
    case 'egg': {
      applyCatalog(content, run, getCatalogEntry(content, 'mystery-egg'), undefined, { moneyMultiplier: 1, rng: new Rng(hashSeed(`${run.seed}::nursery::${sideId}`)) });
      message = 'You take the egg home. It hatches in 3 stages.';
      break;
    }
    case 'relic': {
      run.attributeModifiers = { ...run.attributeModifiers, [uid!]: (run.attributeModifiers[uid!] ?? 0) + C.relicGain, [arg!]: (run.attributeModifiers[arg!] ?? 0) - C.relicLoss };
      message = `The shrine hums: ${uid} +${C.relicGain}, ${arg} -${C.relicLoss}.`;
      break;
    }
    case 'bid': {
      const lot = auctionLots(content, current, sideId).find(([i]) => i.id === uid);
      const need = lot ? hiddenBid(current, sideId, uid!, lot[1]) : Infinity;
      if (option.cost >= need) {
        addItem(run.inventory, uid!, 1);
        message = `You won the auction: ${content.items.get(uid!)?.name ?? uid}!`;
      } else {
        run.money += option.cost;
        message = 'Someone in the room outbid you. You keep your money.';
      }
      break;
    }
    case 'found': {
      const k = current.past?.keepsakes[Number(uid)];
      if (!k || !grantKeepsake(content, run, k.itemId)) throw new Error('That lot is gone');
      claimKeepsake(content, run, k);
      message = `You recovered ${keepsakeName(content, k.itemId)}. ${k.line}`;
      break;
    }
    case 'read':
      message = run.gameEvents.length > 0 ? `Event editions counting for this run: ${run.gameEvents.join(', ')}.` : 'No event edition is running for this run.';
      break;
    case 'survey': {
      const dens = requireStage(run).map.nodes.flatMap((n) => n.sides).filter((s) => s.kind === 'raid');
      message = dens.map((s) => { const r = content.raids.raids.find((x) => x.id === s.raidId); return r ? `${r.name} (tier ${r.tier}): ${r.blurb}` : 'an unknown den'; }).join(' ');
      break;
    }
    case 'scout': {
      const stage = requireStage(run);
      const boss = bossInfo(content, 'gym', stage.leaderId);
      const sig = content.bosses.get(stage.leaderId)?.signature.slice(0, 3).map((id) => getSpecies(content, id).name) ?? [];
      message = `${boss.title} uses ${boss.types.join('/')} Pokémon${sig.length ? `, like ${sig.join(', ')}` : ''}.`;
      break;
    }
    default:
      throw new Error(`Unknown option "${optionId}"`);
  }
  if (!view.service.reusable) side.used = true;
  count(run, 'serviceUses');
  return { run, message };
}
