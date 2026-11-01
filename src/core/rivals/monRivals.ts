// Persistent Pokémon rivalries across stages (Kice spec §11), separate from trainer rivals.
//
// A wild Pokémon that knocked out one of your Pokémon, or fought one of them in a long, close duel, may become that
// Pokémon's rival: one individual with a mark you can recognize ("a torn ear"). It takes the first wild battle of each
// later stage, can't be caught, and is built from the level the run had planned (so no roll moves). A hostile trainer
// rival may catch it off-screen; from then on that rival always carries it, and it still wants its old rival.
// Every roll here uses a seeded stream of its own.

import type { Content } from '../contentSchema';
import { evolvedFormAt } from '../encounters';
import { getSpecies, maxHp, movesAtLevel } from '../pokemon';
import { hashSeed, Rng } from '../rng';
import type { PokemonInstance, RunState } from '../state';
import { emit } from '../story/record';
import type { Candidate, PlanCtx } from '../drama/events';
import { pickIndex } from '../drama/schema';
import type { MonRival, Rival, Where } from '../story/schema';
import { scheduleKey } from './adapt';
import { MAJOR } from './major';
import { isHostile } from './outcome';

export const monRivals = (run: RunState): MonRival[] => run.story.monRivals ?? [];
/** Still part of the run (not sacrificed) and its rival is still on your team. */
export const liveMonRivals = (run: RunState): MonRival[] => monRivals(run).filter((m) => !m.sacrificed && run.party.some((p) => p.uid === m.rivalOf));
export const monRivalById = (run: RunState, id: string | undefined): MonRival | undefined => (id ? monRivals(run).find((m) => m.id === id) : undefined);

const name = (content: Content, id: string) => content.species.get(id)?.name ?? id;
const note = (m: MonRival, line: string) => {
  m.history.push(line);
  if (m.history.length > 6) m.history.splice(0, m.history.length - 6);
};

export interface MonRivalSpark {
  /** The wild Pokémon, your Pokémon it now has a rivalry with, and why. */
  foe: PokemonInstance;
  rival: PokemonInstance;
  cause: 'knockout' | 'duel';
  eventId: string;
  where: Where;
}

/**
 * Which of your Pokémon this wild battle made a rival for the wild one, if any (pure; the roll is separate).
 * `kos` are this battle's knockouts of your Pokémon (fainted uid → the enemy uid that did it).
 */
export function monRivalCandidate(content: Content, run: RunState, kos: { fainted: string; by: string }[]): { rival: PokemonInstance; cause: 'knockout' | 'duel' } | null {
  const b = run.battle;
  if (!b || b.kind !== 'wild' || b.outcome !== 'win' || b.raid || b.totem || b.nemesis || b.monRival || b.event || b.expedition || b.doubles || b.fishing) return null;
  const foe = b.enemyTeam[0];
  if (!foe || foe.shadow || foe.blissful) return null;
  const ko = kos.find((k) => k.by === foe.uid && run.party.some((p) => p.uid === k.fainted));
  if (ko) return { rival: run.party.find((p) => p.uid === ko.fainted)!, cause: 'knockout' };
  const cfg = MAJOR.monRival;
  const fighter = run.party[b.activeIndex];
  if (!fighter || b.turn - 1 < cfg.minTurns) return null;
  const share = fighter.hp / Math.max(1, maxHp(content, fighter));
  return share <= 0.3 && share > 0 ? { rival: fighter, cause: 'duel' } : null;
}

/** Forms a Pokémon rival when the seeded roll passes and the run has room (mutates run). Returns it, or null. */
export function maybeFormMonRival(content: Content, run: RunState, spark: MonRivalSpark): MonRival | null {
  const cfg = MAJOR.monRival;
  const all = (run.story.monRivals ??= []);
  if (all.filter((m) => !m.sacrificed).length >= cfg.maxOpen || all.some((m) => m.id === `monrival-${spark.eventId}`)) return null;
  const rng = new Rng(hashSeed(`${run.seed}::mon-rival::${spark.eventId}`));
  if (!rng.chance(cfg.chance)) return null;
  const foeName = name(content, spark.foe.speciesId);
  const rivalName = name(content, spark.rival.speciesId);
  const mr: MonRival = {
    id: `monrival-${spark.eventId}`,
    speciesId: spark.foe.speciesId,
    level: spark.foe.level,
    mark: rng.pick(cfg.marks),
    rivalOf: spark.rival.uid,
    rivalName,
    formedAt: spark.where,
    lastMet: scheduleKey(run),
    meetings: 1,
    wins: spark.cause === 'knockout' ? 1 : 0,
    losses: 1,
    owner: null,
    bond: 0,
    sacrificed: false,
    history: [],
  };
  note(mr, spark.cause === 'knockout' ? `Knocked out ${rivalName}, then fled` : `Fought ${rivalName} to the edge, then fled`);
  all.push(mr);
  emit(content, run, 'rivalryFormed', {
    where: spark.where,
    actors: [spark.rival.uid],
    data: { kind: 'monRival', speciesId: spark.foe.speciesId, monRival: mr.id },
    importance: content.story.importance.nemesisReturned,
    text: `A wild ${foeName} with ${mr.mark} got back up, glared at ${rivalName} and ran. This isn't over between them`,
  });
  return mr;
}

/** The wild Pokémon rival due in this stage's first wild battle (one with no trainer and not yet met this stage). */
export function dueMonRival(content: Content, run: RunState): MonRival | null {
  if (run.encountersCompleted < content.balance.opening.encounters) return null;
  const now = scheduleKey(run);
  return liveMonRivals(run).find((m) => m.owner === null && m.lastMet !== now) ?? null;
}

/** The rival Pokémon as it comes back: at the planned level (+levelBonus, never below its own), evolved for it. */
export function monRivalMember(content: Content, m: MonRival, plannedLevel: number): { speciesId: string; level: number; moves: string[] } {
  const level = Math.max(1, Math.min(content.balance.difficulty.maxLevel, Math.max(m.level, plannedLevel + MAJOR.monRival.levelBonus)));
  const speciesId = evolvedFormAt(content, m.speciesId, level);
  return { speciesId, level, moves: movesAtLevel(content, getSpecies(content, speciesId), level) };
}

/** Marks the battle as a meeting with this Pokémon rival (mutates run): it's recognizable, can't be caught and is fired up. */
export function beginMonRivalBattle(content: Content, run: RunState, m: MonRival, foe: PokemonInstance): string {
  const battle = run.battle!;
  battle.monRival = { id: m.id, uid: foe.uid, rivalOf: m.rivalOf };
  battle.enemyStages.atk = Math.min(6, (battle.enemyStages.atk ?? 0) + MAJOR.monRival.atkBoost);
  m.lastMet = scheduleKey(run);
  m.meetings += 1;
  m.level = Math.max(m.level, foe.level);
  if (foe.speciesId !== m.speciesId && !m.history.some((h) => h.includes(name(content, foe.speciesId)))) note(m, `Evolved into ${name(content, foe.speciesId)}`);
  const owner = m.owner ? run.story.rivals.find((r) => r.id === m.owner) : undefined;
  const who = name(content, foe.speciesId);
  return owner
    ? `${who} with ${m.mark} is with ${owner.name} now, and it is looking for your ${m.rivalName}!`
    : `It's the ${who} with ${m.mark}! It only has eyes for your ${m.rivalName}.`;
}

/** After a battle with a Pokémon rival: who won between the two, kept in its history (mutates run). */
export function monRivalAfterBattle(content: Content, run: RunState, kos: { fainted: string; by: string }[]): void {
  const b = run.battle;
  const m = monRivalById(run, b?.monRival?.id);
  if (!b?.monRival || !m || m.sacrificed) return;
  const beatRival = kos.some((k) => k.by === b.monRival!.uid && k.fainted === m.rivalOf);
  const fell = b.enemyTeam.find((e) => e.uid === b.monRival!.uid)?.hp === 0;
  if (beatRival) { m.wins += 1; note(m, `Beat ${m.rivalName} again`); }
  if (fell && !m.owner) emit(content, run, 'rivalryFormed', { actors: [m.rivalOf], data: { kind: 'monRivalFled', monRival: m.id }, text: `The ${name(content, b.enemyTeam.find((e) => e.uid === b.monRival!.uid)?.speciesId ?? m.speciesId)} with ${m.mark} got back up and limped off. It will be back` });
  if (fell) { m.losses += 1; note(m, m.owner ? `Fell to ${m.rivalName}'s team in ${run.story.rivals.find((r) => r.id === m.owner)?.name ?? 'its trainer'}'s team` : `Lost to your team and slipped away`); }
  if (m.owner) m.bond = Math.min(100, m.bond + (fell ? 4 : 8));
}

/**
 * Off-screen, once per stage: a hostile trainer rival may catch a wild Pokémon rival it has heard about (after it has
 * met you a few times). The major rival tries first. Returns the rumour line, or null. Mutates run.
 */
export function rivalCatchesMonRival(content: Content, run: RunState): string | null {
  const cfg = MAJOR.monRival;
  const key = scheduleKey(run);
  for (const m of liveMonRivals(run)) {
    if (m.owner !== null || m.meetings < cfg.catchAfterMeetings) continue;
    const hunters = run.story.rivals.filter((r) => isHostile(r) && !r.monRival).sort((a, b) => Number(Boolean(b.major)) - Number(Boolean(a.major)) || a.id.localeCompare(b.id));
    const hunter = hunters[0];
    if (!hunter) continue;
    if (!new Rng(hashSeed(`${run.seed}::mon-rival-catch::${key}::${m.id}`)).chance(cfg.catchChance)) continue;
    m.owner = hunter.id;
    m.bond = 20;
    hunter.monRival = m.id;
    const who = name(content, m.speciesId);
    note(m, `Caught by ${hunter.name}`);
    const text = `${hunter.name} caught the ${who} with ${m.mark}, your ${m.rivalName}'s rival. It will be on their team from now on`;
    emit(content, run, 'rivalryFormed', { data: { kind: 'monRivalCaught', monRival: m.id, rival: hunter.id }, importance: content.story.importance.nemesisReturned, text });
    return text;
  }
  return null;
}

/** The trainer rival's Pokémon rival, if it carries one (always on its team from the catch on). */
export function carriedMonRival(run: RunState, rival: Rival): MonRival | null {
  const m = monRivalById(run, rival.monRival);
  return m && !m.sacrificed && m.owner === rival.id ? m : null;
}

/** Event condition (§11/§29 camp scenes): any Pokémon rival in this state whose rival is still on your team. */
export function monRivalState(run: RunState, state: 'open' | 'carried' | 'sacrificed' | 'any'): boolean {
  return monRivals(run).some((m) => run.party.some((p) => p.uid === m.rivalOf) && (state === 'any' || (state === 'sacrificed' ? m.sacrificed : !m.sacrificed && (state === 'carried' ? m.owner !== null : m.owner === null))));
}

/** Readable lines for the Story screen. */
export function monRivalLines(content: Content, run: RunState): { title: string; hint: string }[] {
  return monRivals(run).map((m) => {
    const owner = m.owner ? run.story.rivals.find((r) => r.id === m.owner) : undefined;
    const status = m.sacrificed ? 'Gave itself up for its rival' : owner ? `On ${owner.name}'s team (bond ${m.bond})` : 'Wild, roaming';
    return {
      title: `${m.sacrificed ? '✝' : '⚔'} ${name(content, m.speciesId)} with ${m.mark} vs your ${m.rivalName}`,
      hint: `${status}. Met ${m.meetings} times: it won ${m.wins}, lost ${m.losses}. ${m.history.join('. ')}.`,
    };
  });
}

/**
 * §11 battle lines for a trainer's Pokémon rival: when it comes out facing its rival, and how its trainer reacts at the end.
 * Wild meetings tell theirs in the intro and the Chronicle.
 */
export function monRivalCandidates(c: PlanCtx): Candidate[] {
  const mr = c.battle.monRival;
  const m = monRivalById(c.run, mr?.id);
  if (!mr || !m) return [];
  const mine = c.run.party.find((p) => p.uid === m.rivalOf);
  const out: Candidate[] = [];
  const who = name(c.content, c.battle.enemyTeam.find((e) => e.uid === mr.uid)?.speciesId ?? m.speciesId);
  for (const ev of c.drama) {
    if (ev.kind === 'enemySwitch' && ev.data.uid === mr.uid) {
      const pool = mine && c.run.party[c.battle.activeIndex]?.uid === mine.uid
        ? [`${who} with ${m.mark} locks eyes with your ${m.rivalName}. Nothing else on the field matters to it now!`, `${who} ignores its trainer's call and stares straight at your ${m.rivalName}!`]
        : [`${who} with ${m.mark} looks past your Pokémon, searching for your ${m.rivalName}.`];
      out.push({ ev: { ...ev, id: `${ev.id}:monRival` }, category: 'event', tier: 'major', pool: [pool[pickIndex(ev.id, pool.length)]!], cue: { event: 'monRival' } });
    } else if (ev.kind === 'battleEnd' && !m.sacrificed) {
      const won = ev.data.outcome === 'win';
      const pool = won ? [`${who} won't look at you. It is already thinking about the next time it meets your ${m.rivalName}.`] : [`${who} stands over your ${m.rivalName} for a moment, then turns away. Rivals.`];
      out.push({ ev: { ...ev, id: `${ev.id}:monRivalEnd` }, category: 'aftermath', tier: 'tactical', pool, cue: { event: 'monRivalEnd' } });
    }
  }
  return out;
}
