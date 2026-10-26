// The item catalog's effects (M8.75 item effects; data in itemCatalog.json,
// design in the "Item effects plan" Claude Doc).
//
// A catalog item taken from the reward draft works right away: attribute
// items, valuables, Wings, berries, healing items, PP Ups, TMs and HMs,
// fossils, and run-long perks like the Amulet Coin. Copies pile up where the
// entry's `stacksOn` says:
//   - "pokemon": on the Pokémon the player picks (Wings count toward `max`)
//   - "team" / "player": on the run (run.passives counts copies)
// A team or player item already at its max is still offered, and picking it
// is a free re-roll of the draft (director, answer 5).
// Battle, map and event items are "pending" and never offered until built.

import { addRunAttribute, attributeText, runAttributeEffects } from './attributes';
import type { AttributeKey, CatalogEffect, CatalogEntry, Content } from './contentSchema';
import { changeFriendship } from './friendship';
import { createPokemon, getSpecies, MAX_PP_UPS, maxHp, maxPp } from './pokemon';
import { addMapItem, mapItemCopies } from './mapItems';
import { discover } from './progress';
import { runLevelCap } from './regions';
import type { Rng } from './rng';
import type { PendingDecision, PokemonInstance, RunState } from './state';

/** How many random moves a TM offers (an HM offers every one). */
export const TM_CHOICES = 3;

export type PassiveKind = Extract<CatalogEffect, { kind: 'passive' }>['passive'];

export function getCatalogEntry(content: Content, id: string): CatalogEntry {
  const entry = content.catalog.get(id);
  if (!entry) throw new Error(`Unknown catalog item "${id}"`);
  return entry;
}

/** Copies of a team or player item this run (map items: charges left or stage effects waiting). */
export function ownedCopies(run: RunState, entry: CatalogEntry): number {
  if (entry.effect?.kind === 'encounter' || entry.effect?.kind === 'perk') return mapItemCopies(run, entry);
  return run.passives?.[entry.id] ?? 0;
}

/** A team or player item already at its max: picking it re-rolls the draft instead. */
export function isFreeReroll(run: RunState, entry: CatalogEntry): boolean {
  return entry.stacksOn !== 'pokemon' && entry.max !== null && ownedCopies(run, entry) >= entry.max;
}

/** The run-long bonus from every copy of every item with this passive, in percent. */
export function passivePercent(content: Content, run: RunState, passive: PassiveKind): number {
  let total = 0;
  for (const [id, copies] of Object.entries(run.passives ?? {})) {
    const effect = content.catalog.get(id)?.effect;
    if (effect?.kind === 'passive' && effect.passive === passive) total += effect.percent * copies;
  }
  return total;
}

/** Moves of one type this Pokémon could learn by TM, tutor or egg (or level-up) that it doesn't know. */
export function teachableMoves(content: Content, mon: PokemonInstance, type: string): string[] {
  const species = getSpecies(content, mon.speciesId);
  const ids = new Set([
    ...(content.learnables.get(species.id) ?? (species.form ? content.learnables.get(species.form.base) : undefined) ?? []),
    ...species.learnset.map((e) => e.move),
  ]);
  return [...ids]
    .filter((id) => {
      const move = content.moves.get(id);
      return move?.supported === true && move.type === type && !mon.moves.some((m) => m.id === id);
    })
    .sort();
}

/** Why this item can't go to this Pokémon, or null if it can. Only for "pokemon" items. */
export function catalogTargetProblem(content: Content, run: RunState, entry: CatalogEntry, mon: PokemonInstance): string | null {
  const effect = entry.effect!;
  const fainted = mon.hp <= 0;
  switch (effect.kind) {
    case 'statBoost': {
      const copies = Math.round((mon.statBoosts?.[effect.stat] ?? 0) / effect.percent);
      return entry.max !== null && copies >= entry.max ? 'That Pokémon has already had the maximum.' : null;
    }
    case 'ppUp':
      return mon.moves.some((m) => (m.ppUps ?? 0) < MAX_PP_UPS) ? null : "That Pokémon's moves already have the most PP they can.";
    case 'care':
      if (effect.revive) return fainted ? null : 'That Pokémon has not fainted.';
      if (fainted) return 'That Pokémon has fainted.';
      if (effect.heal && mon.hp >= maxHp(content, mon)) return "That Pokémon's HP is already full.";
      if (effect.cure && !mon.status) return 'That Pokémon has no status problem.';
      if (effect.ppMove && !mon.moves.some((m) => m.pp < maxPp(content, m))) return "That Pokémon's PP is already full.";
      return null;
    case 'teachMove':
      return teachableMoves(content, mon, effect.type).length > 0 ? null : `That Pokémon can't learn a new ${capitalize(effect.type)} move.`;
    case 'held': {
      const copies = mon.held?.[entry.id] ?? 0;
      return entry.max !== null && copies >= entry.max ? `That Pokémon already holds ${copies === 1 ? 'one' : 'the most'}.` : null;
    }
    case 'battleBoost': {
      const stats = effect.boosts.map((b) => (b.kind === 'stage' ? b.stat : b.kind));
      const pending = (mon.boosts ?? []).filter((b) => stats.includes(b.kind === 'stage' ? b.stat : b.kind)).length;
      if (entry.max !== null && pending >= entry.max * effect.boosts.length) return 'That Pokémon already has the most of this boost.';
      if (effect.cure && fainted) return 'That Pokémon has fainted.';
      return null;
    }
    case 'feed':
      return null;
    default:
      return null;
  }
}

/** Whether the item does something for this run right now (it's left out of the draft otherwise). */
export function isCatalogUseful(content: Content, run: RunState, entry: CatalogEntry): boolean {
  if (entry.status !== 'supported') return false;
  if (entry.stacksOn === 'pokemon') return run.party.some((mon) => catalogTargetProblem(content, run, entry, mon) === null);
  const effect = entry.effect!;
  if (effect.kind === 'teamCare') {
    if (effect.changes && Object.keys(effect.changes).length > 0) return true;
    return run.party.some(
      (mon) =>
        (effect.revive !== undefined && mon.hp <= 0) ||
        (effect.heal !== undefined && mon.hp > 0 && mon.hp < maxHp(content, mon)) ||
        (effect.pp !== undefined && mon.moves.some((m) => m.pp < maxPp(content, m))),
    );
  }
  if (effect.kind === 'fossil') return run.party.length > 0;
  return true;
}

export interface CatalogResult {
  messages: string[];
  pending: PendingDecision[];
}

/**
 * Applies a catalog item (mutates `run`). `target` is the chosen Pokémon for
 * "pokemon" items; `moneyMultiplier` is the trainer's money bonus; `rng` picks
 * a TM's random moves.
 */
export function applyCatalog(
  content: Content,
  run: RunState,
  entry: CatalogEntry,
  target: PokemonInstance | undefined,
  opts: { moneyMultiplier: number; rng: Rng },
): CatalogResult {
  const effect = entry.effect;
  if (entry.status !== 'supported' || !effect) throw new Error(`${entry.name} doesn't work yet`);
  if (entry.stacksOn === 'pokemon') {
    if (!target) throw new Error('Choose a Pokémon');
    const problem = catalogTargetProblem(content, run, entry, target);
    if (problem) throw new Error(problem);
  }
  const messages: string[] = [];
  const pending: PendingDecision[] = [];
  const friendshipGain = runAttributeEffects(content, run).friendship;
  const name = (mon: PokemonInstance) => getSpecies(content, mon.speciesId).name;
  const applyChanges = (changes: Partial<Record<AttributeKey, number>> | undefined) => {
    for (const [key, amount] of Object.entries(changes ?? {}) as [AttributeKey, number][]) {
      const value = addRunAttribute(content, run, key, amount);
      messages.push(`${attributeText(key, value)} for the rest of this run.`);
    }
  };
  const heal = (mon: PokemonInstance, amount: number) => {
    const before = mon.hp;
    mon.hp = Math.min(maxHp(content, mon), mon.hp + amount);
    return mon.hp - before;
  };
  const befriend = (mon: PokemonInstance, amount: number) => {
    changeFriendship(content, mon, amount, friendshipGain);
    messages.push(amount >= 0 ? `${name(mon)} likes you a little more.` : `${name(mon)} didn't like that…`);
  };

  // Team and player items are counted on the run (one-time battle boosts and map items with charges aren't kept there).
  const counted = effect.kind !== 'battleBoost' && ((effect.kind !== 'encounter' && effect.kind !== 'perk') || effect.lasts.for === 'run');
  if (entry.stacksOn !== 'pokemon' && counted) run.passives = { ...run.passives, [entry.id]: ownedCopies(run, entry) + 1 };

  switch (effect.kind) {
    case 'attributes': {
      applyChanges(effect.changes);
      const lead = run.party[0];
      if (lead && effect.healLead && lead.hp > 0) messages.push(`${name(lead)} recovered ${heal(lead, effect.healLead)} HP.`);
      if (lead && effect.leadFriendship) befriend(lead, effect.leadFriendship);
      break;
    }
    case 'money': {
      const amount = Math.floor(effect.amount * opts.moneyMultiplier);
      run.money += amount;
      messages.push(`You sold the ${entry.name} for ₽${amount}.`);
      applyChanges(effect.changes);
      if (effect.teamHeal) {
        for (const mon of run.party) if (mon.hp > 0) heal(mon, Math.floor(maxHp(content, mon) * effect.teamHeal));
        messages.push('Your team feels a little better.');
      }
      break;
    }
    case 'statBoost': {
      const mon = target!;
      const before = maxHp(content, mon);
      mon.statBoosts = { ...mon.statBoosts, [effect.stat]: (mon.statBoosts?.[effect.stat] ?? 0) + effect.percent };
      if (effect.stat === 'hp' && mon.hp > 0) mon.hp += maxHp(content, mon) - before;
      messages.push(`${name(mon)}'s ${STAT_LABELS[effect.stat]} rose a little!`);
      break;
    }
    case 'feed': {
      const mon = target ?? run.party[0];
      if (mon) befriend(mon, effect.friendship);
      applyChanges(effect.changes);
      break;
    }
    case 'ppUp':
      pending.push({ kind: 'ppUp', uid: target!.uid, itemName: entry.name, ups: effect.ups });
      break;
    case 'care': {
      const mon = target!;
      if (effect.revive) {
        mon.hp = Math.max(1, Math.floor(maxHp(content, mon) * effect.revive));
        mon.status = null;
        messages.push(`${name(mon)} was revived!`);
      }
      if (effect.heal) messages.push(`${name(mon)} recovered ${heal(mon, effect.heal)} HP.`);
      if (effect.cure) {
        mon.status = null;
        messages.push(`${name(mon)} was cured.`);
      }
      if (effect.ppMove) {
        const slot = [...mon.moves].sort((a, b) => a.pp / maxPp(content, a) - b.pp / maxPp(content, b))[0]!;
        slot.pp = maxPp(content, slot);
        messages.push(`${content.moves.get(slot.id)!.name}'s PP was restored.`);
      }
      if (effect.friendship) befriend(mon, effect.friendship);
      applyChanges(effect.changes);
      break;
    }
    case 'teamCare': {
      for (const mon of run.party) {
        if (effect.revive && mon.hp <= 0) {
          mon.hp = Math.max(1, Math.floor(maxHp(content, mon) * effect.revive));
          mon.status = null;
        } else if (effect.heal && mon.hp > 0) {
          heal(mon, Math.floor(maxHp(content, mon) * effect.heal));
        }
        if (effect.cureSleep && mon.status?.id === 'slp') mon.status = null;
        if (effect.pp !== undefined) {
          for (const slot of mon.moves) slot.pp = effect.pp < 0 ? maxPp(content, slot) : Math.min(maxPp(content, slot), slot.pp + effect.pp);
        }
      }
      messages.push(`The ${entry.name} cared for your whole team.`);
      applyChanges(effect.changes);
      break;
    }
    case 'passive':
      messages.push(`${entry.name}: ${entry.description}.`);
      break;
    case 'held': {
      if (entry.stacksOn === 'pokemon') {
        const mon = target!;
        mon.held = { ...mon.held, [entry.id]: (mon.held?.[entry.id] ?? 0) + 1 };
        messages.push(`${name(mon)} is now holding ${mon.held[entry.id]! > 1 ? `${mon.held[entry.id]} ` : 'the '}${entry.name}${mon.held[entry.id]! > 1 ? 's' : ''}.`);
      } else {
        messages.push(`${entry.name}: ${entry.description}.`);
      }
      break;
    }
    case 'battleBoost': {
      const mons = entry.stacksOn === 'pokemon' ? [target!] : run.party.filter((m) => m.hp > 0);
      for (const mon of mons) {
        if (effect.cure && mon.status?.id === effect.cure) {
          mon.status = null;
          messages.push(`${name(mon)} was cured.`);
        }
        mon.boosts = [...(mon.boosts ?? []), ...effect.boosts];
      }
      messages.push(`${entry.description}: it takes effect in the next battle.`);
      break;
    }
    case 'encounter':
    case 'perk': {
      if (effect.kind === 'encounter') applyChanges(effect.changes);
      addMapItem(content, run, entry);
      messages.push(`${entry.name}: ${entry.description}.`);
      break;
    }
    case 'fossil': {
      const levels = run.party.map((m) => m.level);
      const level = Math.max(1, Math.min(runLevelCap(content, run), Math.floor(levels.reduce((a, b) => a + b, 0) / Math.max(1, levels.length))));
      const mon = createPokemon(content, effect.species, level, `p${run.nextUid}`);
      run.nextUid += 1;
      discover(run, mon.speciesId, true);
      messages.push(`The ${entry.name} was revived into ${name(mon)}!`);
      pending.push({ kind: 'caught', mon });
      break;
    }
    case 'teachMove': {
      const choices = teachableMoves(content, target!, effect.type);
      const moveIds = effect.mode === 'hm' ? choices : opts.rng.shuffle(choices).slice(0, TM_CHOICES);
      pending.push({ kind: 'teachMove', uid: target!.uid, itemName: entry.name, moveIds });
      break;
    }
  }
  return { messages, pending };
}

const STAT_LABELS = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' } as const;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
