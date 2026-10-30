// The rival world's sponsors, factions and debts (Living Rivalry Engine Examples sections 1 and 8).
// A sponsor signs the player after the first boss win, pays an advance (a debt called in after more boss wins)
// and a stipend per boss. Boss wins move faction standing. A rival that spared by you owes a favour.
// Rivals can have sponsors (+1 level on return). Everything here is deterministic: seeded per run and event,
// never from the gameplay streams, and every payout is guarded so it applies once.

import { bondMood, bondOf } from '../bond';
import type { Content } from '../contentSchema';
import { getSpecies } from '../pokemon';
import { hashSeed, Rng } from '../rng';
import type { RunState } from '../state';
import { emit } from '../story/record';
import type { Rival, Standing, Where } from '../story/schema';
import { usedTypes } from './adapt';
import { RIVAL_WORLD } from './schema';

const W = RIVAL_WORLD;
const clamp = (n: number) => Math.max(W.standing.min, Math.min(W.standing.max, n));
const placeKey = (where: Where) => `${where.region}.${where.stage ?? 0}`;

export const sponsorOf = (id: string | undefined | null) => (id ? W.sponsors.find((s) => s.id === id) : undefined);

export function standingOf(run: Pick<RunState, 'story'>): Standing {
  return run.story.standing;
}

/** Faction standing of the player, 0 when never touched. */
export const factionStanding = (run: Pick<RunState, 'story'>, faction: string): number => run.story.standing.factions[faction] ?? 0;

function shift(run: Pick<RunState, 'story'>, faction: string, delta: number): void {
  const f = run.story.standing.factions;
  f[faction] = clamp((f[faction] ?? 0) + delta);
}

/** The faction a new rival belongs to, from its personality. */
export function factionFor(personalityId: string): string {
  return W.rivalFactions.byPersonality[personalityId] ?? W.rivalFactions.default;
}

/** Factions the player is on bad terms with. */
export function hostileFactions(run: Pick<RunState, 'story'>): string[] {
  return W.factions.filter((f) => factionStanding(run, f.id) <= W.standing.hostileAt).map((f) => f.id);
}

/** Debts still open that the player owes. */
export const playerDebts = (run: Pick<RunState, 'story'>) => run.story.standing.debts.filter((d) => !d.settled && d.direction === 'owed-by-player');

/** A rival that owes the player a favour (it spared by your lead and has not repaid yet). */
export const owesPlayer = (run: Pick<RunState, 'story'>, rival: Pick<Rival, 'id'>): boolean =>
  run.story.standing.debts.some((d) => !d.settled && d.direction === 'owed-to-player' && d.other === rival.id);

/** Levels a rival gains from its sponsor and loses from a favour it owes you (it goes easy once). */
export function rivalDebtLevels(run: Pick<RunState, 'story'>, rival: Pick<Rival, 'id' | 'sponsor'>): number {
  return (rival.sponsor ? W.debts.sponsorRivalLevels : 0) - (owesPlayer(run, rival) ? W.debts.owedToPlayerLevels : 0);
}

const title = (content: Content, r: Rival) => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;

/**
 * A boss fell: faction standing moves, the first win brings a sponsor, later wins pay a stipend,
 * and a due advance is called in. Safe against double calls (keyed by the battle event).
 */
export function onBossBeaten(content: Content, run: RunState, where: Where, eventId: string): void {
  const flag = `standing:boss:${eventId}`;
  if (run.story.flags[flag] !== undefined) return;
  run.story.flags[flag] = true;
  const st = run.story.standing;
  st.bosses += 1;
  shift(run, 'league', W.standing.bossLeague);
  shift(run, 'syndicate', W.standing.bossSyndicate);
  const at = placeKey(where);
  if (st.sponsor) {
    const sponsor = sponsorOf(st.sponsor.id)!;
    run.money += sponsor.stipend;
    emit(content, run, 'rewardTaken', { where, data: { sponsor: sponsor.id, money: sponsor.stipend }, text: `${sponsor.name} paid a stipend of ${sponsor.stipend}` });
  } else {
    const rng = new Rng(hashSeed(`${run.seed}::sponsor`));
    const sponsor = rng.pick(W.sponsors);
    st.sponsor = { id: sponsor.id, at };
    run.money += sponsor.advance;
    shift(run, sponsor.faction, W.standing.sponsorFaction);
    st.debts.push({ id: `debt:${sponsor.id}`, other: sponsor.id, direction: 'owed-by-player', kind: 'money', amount: sponsor.advance, at, dueBosses: st.bosses + W.debts.repayAfterBosses, settled: false });
    emit(content, run, 'rewardTaken', { where, data: { sponsor: sponsor.id, money: sponsor.advance }, text: `${sponsor.line}: an advance of ${sponsor.advance} (to be repaid after ${W.debts.repayAfterBosses} more boss wins)` });
  }
  for (const d of st.debts) {
    if (d.settled || d.direction !== 'owed-by-player' || d.kind !== 'money' || st.bosses < d.dueBosses) continue;
    const paid = Math.min(run.money, d.amount);
    run.money -= paid;
    d.settled = true;
    emit(content, run, 'rewardTaken', { where, data: { debt: d.id, money: -paid }, text: `${sponsorOf(d.other)?.name ?? 'Your backer'} collected ${paid} on the advance` });
  }
}

/** A fight with a rival is won: the League likes it; a spared rival (ally, shaken) owes a favour; a repaid favour is closed. */
export function onRivalDefeated(content: Content, run: RunState, rival: Rival, outcome: string, where: Where): void {
  shift(run, 'league', W.standing.rivalWinLeague);
  const st = run.story.standing;
  const owed = st.debts.find((d) => !d.settled && d.direction === 'owed-to-player' && d.other === rival.id);
  if (owed) {
    owed.settled = true;
    emit(content, run, 'rivalryFormed', { where, data: { rival: rival.id, outcome: 'debt-repaid' }, text: `${title(content, rival)} went easy on you: the favour is repaid` });
  }
  if ((outcome === 'ally' || outcome === 'shaken') && !st.debts.some((d) => !d.settled && d.other === rival.id && d.direction === 'owed-to-player')) {
    st.debts.push({ id: `favor:${rival.id}:${st.debts.length}`, other: rival.id, direction: 'owed-to-player', kind: 'favor', amount: 0, at: placeKey(where), dueBosses: 0, settled: false });
    emit(content, run, 'rivalryFormed', { where, data: { rival: rival.id, outcome: 'debt-owed' }, text: `${title(content, rival)} owes you for sparing their pride` });
  }
}

/** Each stage a hostile ambitious rival may win a sponsor of its own. Returns a rumour or null. */
export function rivalSponsorRoll(content: Content, run: RunState, rival: Rival, stageKey: string): string | null {
  if (rival.sponsor || rival.traits.ambition < W.debts.rivalSponsorMinAmbition) return null;
  if (new Rng(hashSeed(`${run.seed}::rival-sponsor::${stageKey}::${rival.id}`)).float() >= W.debts.rivalSponsorChance) return null;
  const mine = run.story.standing.sponsor?.id;
  const pool = W.sponsors.filter((s) => s.id !== mine);
  const sponsor = new Rng(hashSeed(`${run.seed}::rival-sponsor-pick::${rival.id}`)).pick(pool);
  rival.sponsor = sponsor.id;
  return `${title(content, rival)} signed with ${sponsor.name}`;
}

export interface PathInput {
  where: Where;
  team: string[];
  hpLeftShare: number;
  turns: number;
}

/** Facts about the player's world that the rival paths ask about. */
export function pathContext(content: Content, run: RunState, input: PathInput) {
  const st = run.story.standing;
  const rivals = run.story.rivals;
  const stage = input.where.stage ?? 0;
  const crises = run.story.events.filter((e) => (e.type === 'closeCall' || e.type === 'survivedFatal') && e.where.region === input.where.region && e.where.stage === stage).length;
  const partySpecies = new Set(run.party.map((m) => m.speciesId));
  const top = usedTypes(content, run).slice(0, 2);
  const typedLikeYou = input.team.filter((id) => getSpecies(content, id).types.some((t) => top.includes(t))).length;
  return {
    sponsored: st.sponsor !== null,
    openDebt: playerDebts(run).length > 0,
    leaguePatron: factionStanding(run, 'league') >= W.standing.patronAt,
    hostileFaction: hostileFactions(run).length > 0,
    hasAlly: rivals.some((r) => r.state === 'ally') || run.story.rivalGraph.some((e) => e.kind === 'friends'),
    hasRival: rivals.some((r) => r.state !== 'retired'),
    mentorRival: rivals.some((r) => r.identity?.source === 'mentor'),
    legacy: run.legacyRival !== null,
    crisis: crises >= W.context.crisisEvents,
    sharedSpecies: input.team.some((id) => partySpecies.has(id)),
    copiesYou: typedLikeYou >= W.context.copyTypes,
    devotedBond: run.party.some((m) => bondMood(bondOf(run, m.uid)) === 'devoted'),
    bosses: st.bosses,
  };
}
export type PathContext = ReturnType<typeof pathContext>;

/** One Story-screen row: your sponsor, faction standing and open debts. Null before anything has happened. */
export function standingSummary(run: Pick<RunState, 'story'>): { title: string; hint: string } | null {
  const st = run.story.standing;
  const marks = W.factions.filter((f) => st.factions[f.id] !== undefined).map((f) => `${f.name} ${st.factions[f.id]! > 0 ? '+' : ''}${st.factions[f.id]}`);
  if (!st.sponsor && marks.length === 0) return null;
  const debts = st.debts.filter((d) => !d.settled).map((d) => (d.direction === 'owed-by-player' ? `you owe ${sponsorOf(d.other)?.name ?? 'a backer'} ${d.amount}` : `a rival owes you a favour`));
  return { title: `Standing${st.sponsor ? `: backed by ${sponsorOf(st.sponsor.id)!.name}` : ''}`, hint: [marks.join(' · '), debts.join('; ')].filter(Boolean).join('  ·  ') };
}
