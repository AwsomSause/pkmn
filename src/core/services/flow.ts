// Using a service stop (Untitled doc §19): Pokémon Center, Move Tutor, Move Reminder, Research Lab, Trade Post, Scout Tower.
// Every option shows its price and why it cannot be picked. Choices come from the run seed and the stop, never from UI events,
// so a reload shows the same offers. Paying and applying happen together, once.

import { bossInfo } from '../regions';
import { count, discover } from '../progress';
import { baseStatTotal, wildEligibleSpecies } from '../themes';
import { hashSeed, Rng } from '../rng';
import { healParty, newMon, requireStage } from '../run';
import { maxHp, maxPp, usableLearnset, getSpecies } from '../pokemon';
import { specialFamily } from '../specialForms';
import { addItem, itemUseProblem } from '../items';
import { isHostile } from '../rivals/outcome';
import type { Content, StatName } from '../contentSchema';
import type { PokemonInstance, RunState, SideStop } from '../state';
import { getService, SERVICES, type ServiceDef } from './schema';

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
  const special = [...content.species.values()].filter((s) => specialFamily(s) === 'regional' && fits(C.tradeBstSpread * 2)(s));
  if (special.length > 0 && rng.chance(C.tradeSpecialChance)) return special[rng.int(0, special.length - 1)]!.id;
  const normal = wildEligibleSpecies(content).filter(fits(C.tradeBstSpread));
  return normal.length > 0 ? normal[rng.int(0, normal.length - 1)]!.id : null;
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
