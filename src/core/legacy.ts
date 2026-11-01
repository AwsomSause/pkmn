// Legacy & Live hub systems (left-out 1.5; GAME_DESIGN §14.6 and §14.8): Research Tree, Prestige, Trainer Network,
// Item Museum, Regional Intelligence Board, Move Research room, the growing Hub and the Seed Shelf.
// Nothing here rolls a random number or deletes a collection or achievement; run effects are start-of-run grants.

import { z } from 'zod';
import legacyJson from '../data/legacy.json';
import type { Content, Region } from './contentSchema';
import { freshCamp } from './camp/schema';
import { addItem } from './items';
import { townStartGrants } from './town';
import { MOVE_RANK_USES, MOVE_RANKS, moveRank } from './moveMastery';
import { claim } from './quests';
import type { LegacyState, Profile, RunState } from './state';

const Effect = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('money'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('item'), item: z.string(), count: z.number().int().positive() }),
  z.object({ kind: z.literal('intel'), level: z.number().int().min(1).max(3) }),
  z.object({ kind: z.literal('networkSlot'), count: z.number().int().positive() }),
]);
export type LegacyEffect = z.infer<typeof Effect>;

const TreeNode = z.object({
  id: z.string(), branch: z.string(), name: z.string(), blurb: z.string(),
  cost: z.number().int().positive(), prestige: z.number().int().min(0), requires: z.string().nullable(), effect: Effect,
});
export type TreeNode = z.infer<typeof TreeNode>;

export const LEGACY = z.object({
  note: z.string(),
  prestige: z.object({ maxRank: z.number().int(), networkSlotPerRank: z.number().int(), ranks: z.array(z.object({ rank: z.number().int(), title: z.string(), cost: z.number().int(), regionsCleared: z.number().int() })) }),
  tree: z.object({ branches: z.array(z.object({ id: z.string(), name: z.string() })), nodes: z.array(TreeNode) }),
  network: z.object({ baseSlots: z.number().int(), maxSlots: z.number().int(), services: z.array(z.object({ id: z.string(), name: z.string(), blurb: z.string(), effect: Effect })).min(1) }),
  museum: z.object({ milestones: z.array(z.object({ items: z.number().int(), research: z.number().int() })) }),
  training: z.object({ usesPerLot: z.number().int(), researchPerLot: z.number().int(), maxRank: z.enum(['bronze', 'silver', 'gold']) }),
  hub: z.object({ props: z.array(z.object({ id: z.string(), name: z.string(), points: z.number().int() })) }),
  seedShelf: z.object({ slots: z.number().int() }),
}).parse(legacyJson);

const EMPTY: LegacyState = { prestige: 0, tree: [], contacts: [], museum: [], regionIntel: {}, seedShelf: [], boards: {}, ghosts: {} };
export const legacyOf = (p: Pick<Profile, 'legacy'>): LegacyState => ({ ...EMPTY, ...p.legacy });
/** Returns a new profile with its legacy state changed. */
export const withLegacy = (p: Profile, change: (l: LegacyState) => void): Profile => {
  const profile = structuredClone(p);
  const l = legacyOf(profile);
  change(l);
  profile.legacy = l;
  return profile;
};

// ---------- Prestige ----------

export const prestigeRank = (p: Pick<Profile, 'legacy'>): number => legacyOf(p).prestige;
export const nextPrestige = (p: Pick<Profile, 'legacy'>) => LEGACY.prestige.ranks.find((r) => r.rank === prestigeRank(p) + 1) ?? null;

export function prestigeProblem(p: Profile): string | null {
  const next = nextPrestige(p);
  if (!next) return 'You are at the top Prestige rank.';
  const cleared = p.counters.regionsCleared ?? 0;
  if (cleared < next.regionsCleared) return `Clear ${next.regionsCleared} regions in total first (you have ${cleared}).`;
  if (p.bankCredits < next.cost) return `You need ${next.cost} Bank Credits (you have ${p.bankCredits}).`;
  return null;
}

/** Ascends one rank: costs credits, grants a title. Collection, achievements, trainers and the Tree stay. */
export function ascend(current: Profile, now: string): Profile {
  const problem = prestigeProblem(current);
  if (problem) throw new Error(problem);
  const next = nextPrestige(current)!;
  const profile = withLegacy(current, (l) => { l.prestige = next.rank; });
  profile.bankCredits -= next.cost;
  if (!profile.titles.includes(next.title)) profile.titles.push(next.title);
  claim(profile, `prestige:${next.rank}`, now);
  return profile;
}

// ---------- Research Tree ----------

export const getNode = (id: string): TreeNode | undefined => LEGACY.tree.nodes.find((n) => n.id === id);
export type NodeStatus = 'owned' | 'open' | 'locked';

export function nodeStatus(p: Profile, node: TreeNode): NodeStatus {
  const l = legacyOf(p);
  if (l.tree.includes(node.id)) return 'owned';
  return l.prestige >= node.prestige && (node.requires === null || l.tree.includes(node.requires)) ? 'open' : 'locked';
}

export function nodeProblem(p: Profile, node: TreeNode): string | null {
  const l = legacyOf(p);
  if (l.tree.includes(node.id)) return 'Already researched.';
  if (node.requires !== null && !l.tree.includes(node.requires)) return `Needs ${getNode(node.requires)?.name ?? node.requires} first.`;
  if (l.prestige < node.prestige) return `Needs Prestige rank ${node.prestige}.`;
  if (p.researchPoints < node.cost) return `You need ${node.cost} Research Points (you have ${p.researchPoints}).`;
  return null;
}

export function buyNode(current: Profile, id: string): Profile {
  const node = getNode(id);
  if (!node) throw new Error(`Unknown Research Tree node "${id}"`);
  const problem = nodeProblem(current, node);
  if (problem) throw new Error(problem);
  const profile = withLegacy(current, (l) => { l.tree = [...l.tree, id]; });
  profile.researchPoints -= node.cost;
  return profile;
}

const ownedEffects = (p: Profile): LegacyEffect[] => legacyOf(p).tree.map((id) => getNode(id)?.effect).filter((e): e is LegacyEffect => e !== undefined);

// ---------- Trainer Network ----------

/** Each trainer's service, picked from the stable hash of its id (no RNG), so every trainer has exactly one. */
export function serviceFor(trainerId: string) {
  let h = 0;
  for (const ch of trainerId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LEGACY.network.services[h % LEGACY.network.services.length]!;
}

export function networkSlots(p: Profile): number {
  const bought = ownedEffects(p).reduce((n, e) => n + (e.kind === 'networkSlot' ? e.count : 0), 0);
  return Math.min(LEGACY.network.maxSlots, LEGACY.network.baseSlots + prestigeRank(p) * LEGACY.prestige.networkSlotPerRank + bought);
}

export function contactProblem(p: Profile, trainerId: string): string | null {
  const l = legacyOf(p);
  if (!p.unlockedArchetypes.includes(trainerId)) return 'Unlock this trainer first.';
  if (!l.contacts.includes(trainerId) && l.contacts.length >= networkSlots(p)) return `All ${networkSlots(p)} contact slots are used.`;
  return null;
}

/** Switches a trainer's service on or off. Returns a new profile. */
export function toggleContact(current: Profile, trainerId: string): Profile {
  const problem = contactProblem(current, trainerId);
  if (problem) throw new Error(problem);
  return withLegacy(current, (l) => { l.contacts = l.contacts.includes(trainerId) ? l.contacts.filter((c) => c !== trainerId) : [...l.contacts, trainerId]; });
}

/** Everything the Tree and the contacts hand over at the start of a run. The run's own trainer is never its own contact. */
export function startGrants(content: Content, p: Profile, runTrainerId: string): { money: number; items: Record<string, number>; stuff: Record<string, number> } {
  const out = { money: 0, items: {} as Record<string, number>, stuff: {} as Record<string, number> };
  const apply = (e: LegacyEffect) => {
    if (e.kind === 'money') out.money += e.amount;
    if (e.kind === 'item' && content.items.has(e.item)) addItem(out.items, e.item, e.count);
  };
  ownedEffects(p).forEach(apply);
  for (const id of legacyOf(p).contacts) if (id !== runTrainerId && p.unlockedArchetypes.includes(id)) apply(serviceFor(id).effect);
  // Pocket Town (W7): the boon waiting from the town, the badge case perks and the museum pedestals.
  const town = townStartGrants(content, p);
  out.money += town.money;
  for (const [id, n] of Object.entries(town.items)) addItem(out.items, id, n);
  for (const [id, n] of Object.entries(town.stuff)) out.stuff[id] = (out.stuff[id] ?? 0) + n;
  return out;
}

/** Hands the grants to a new run (mutates `run`). */
export function applyStartGrants(content: Content, run: RunState, p: Profile): void {
  const g = startGrants(content, p, run.archetypeId);
  run.money += g.money;
  for (const [id, n] of Object.entries(g.items)) addItem(run.inventory, id, n);
  if (Object.keys(g.stuff).length > 0) {
    const camp = (run.camp ??= freshCamp());
    for (const [id, n] of Object.entries(g.stuff)) camp.stuff[id] = (camp.stuff[id] ?? 0) + n;
  }
  const notes = townStartGrants(content, p).notes;
  for (const line of notes) run.journal.push(line);
}

// ---------- Item Museum ----------

/** Adds the items a finished run held to the Museum and pays its milestones once (mutates `profile`). Returns the Research Points paid. */
export function recordMuseum(profile: Profile, run: RunState, now: string): number {
  const l = legacyOf(profile);
  const seen = new Set(l.museum);
  for (const [id, n] of Object.entries(run.inventory)) if (n > 0) seen.add(id);
  for (const mon of run.party) for (const id of Object.keys(mon.held ?? {})) seen.add(id);
  l.museum = [...seen].sort();
  profile.legacy = l;
  let paid = 0;
  for (const m of LEGACY.museum.milestones) {
    if (l.museum.length >= m.items && claim(profile, `museum:${m.items}`, now)) paid += m.research;
  }
  profile.researchPoints += paid;
  return paid;
}

// ---------- Regional Intelligence Board ----------

export function recordRegionIntel(profile: Profile, run: RunState): void {
  const l = legacyOf(profile);
  const intel = { ...l.regionIntel };
  run.regionOrder.forEach((id, i) => {
    if (i > run.regionIndex) return;
    const cur = intel[id] ?? { visits: 0, clears: 0, bestBadges: 0 };
    intel[id] = { visits: cur.visits + 1, clears: cur.clears + (run.regionsCleared.includes(id) ? 1 : 0), bestBadges: cur.bestBadges };
  });
  const current = run.regionOrder[run.regionIndex];
  if (current && intel[current]) intel[current] = { ...intel[current]!, bestBadges: Math.max(intel[current]!.bestBadges, run.badges.length) };
  l.regionIntel = intel;
  profile.legacy = l;
}

export const intelLevel = (p: Profile): number => Math.max(0, ...ownedEffects(p).map((e) => (e.kind === 'intel' ? e.level : 0)));

/** What the Board shows about a region: level 0 only counts; 1 shows gym leaders; 2 the Elite Four and champions; 3 everything from the start. */
export function regionBoard(content: Content, p: Profile, region: Region): { visits: number; clears: number; bestBadges: number; lines: string[] } {
  const rec = legacyOf(p).regionIntel[region.id] ?? { visits: 0, clears: 0, bestBadges: 0 };
  const lvl = intelLevel(p);
  const name = (id: string) => content.bosses.get(id)?.name ?? id;
  const lines: string[] = [];
  const seenGyms = lvl >= 3 || (rec.visits > 0 && lvl >= 1) || rec.clears > 0;
  const seenLeague = lvl >= 3 || (rec.visits > 0 && lvl >= 2) || rec.clears > 0;
  lines.push(seenGyms ? `Gym leaders: ${region.gymLeaders.map(name).join(', ')}` : 'Gym leaders: unknown (visit the region).');
  lines.push(seenLeague ? `Elite Four: ${region.eliteFour.map(name).join(', ') || 'none'}` : 'Elite Four: unknown (clear the region).');
  lines.push(seenLeague ? `Champion: ${region.champions.map(name).join(', ') || 'none'}` : 'Champion: unknown.');
  lines.push(region.generations.length > 0 ? `Native Pokémon: generation ${region.generations.join(', ')}` : 'Native Pokémon: every generation.');
  return { ...rec, lines };
}

// ---------- Move Research room ----------

export function trainProblem(content: Content, p: Profile, moveId: string): string | null {
  const uses = p.moveUses?.[moveId] ?? 0;
  if (uses <= 0) return 'Use this move in a trainer fight first.';
  const cap = MOVE_RANK_USES[LEGACY.training.maxRank];
  if (uses >= cap) return `Training stops at ${LEGACY.training.maxRank}; earn the rest in battle.`;
  if (p.researchPoints < LEGACY.training.researchPerLot) return `You need ${LEGACY.training.researchPerLot} Research Points (you have ${p.researchPoints}).`;
  return content.moves.has(moveId) ? null : 'Unknown move.';
}

/** Trains a move: a lot of Research Points for a few uses, never past the training cap. Returns a new profile. */
export function trainMove(content: Content, current: Profile, moveId: string): Profile {
  const problem = trainProblem(content, current, moveId);
  if (problem) throw new Error(problem);
  const profile = structuredClone(current);
  const cap = MOVE_RANK_USES[LEGACY.training.maxRank];
  profile.researchPoints -= LEGACY.training.researchPerLot;
  profile.moveUses = { ...profile.moveUses, [moveId]: Math.min(cap, (profile.moveUses?.[moveId] ?? 0) + LEGACY.training.usesPerLot) };
  return profile;
}

export const trainedRank = (p: Profile, moveId: string) => moveRank(p.moveUses?.[moveId] ?? 0);
export const RANK_ORDER = MOVE_RANKS;

// ---------- the growing Hub ----------

/** Points that grow the Hub: Bank tier, Prestige, the Tree, the Museum and achievements. */
export function hubPoints(p: Profile): number {
  const l = legacyOf(p);
  return (p.bankTier ?? 1) - 1 + l.prestige * 3 + l.tree.length + Math.floor(l.museum.length / 10) + Math.floor(Object.keys(p.achievements).length / 5);
}

/** The Hub props shown now, in the order they appear. */
export const hubProps = (p: Profile) => LEGACY.hub.props.filter((x) => hubPoints(p) >= x.points);

// ---------- Seed Shelf ----------

export function shelfProblem(p: Profile, code: string): string | null {
  const l = legacyOf(p);
  if (l.seedShelf.some((s) => s.code === code)) return 'This seed is already on the shelf.';
  return l.seedShelf.length >= LEGACY.seedShelf.slots ? `The shelf holds ${LEGACY.seedShelf.slots} seeds; remove one first.` : null;
}

export function shelveSeed(current: Profile, code: string, label: string, now: string): Profile {
  const problem = shelfProblem(current, code);
  if (problem) throw new Error(problem);
  return withLegacy(current, (l) => { l.seedShelf = [...l.seedShelf, { code, label: label.slice(0, 40), at: now }]; });
}

export const unshelveSeed = (current: Profile, code: string): Profile => withLegacy(current, (l) => { l.seedShelf = l.seedShelf.filter((s) => s.code !== code); });

// ---------- Hub summary lines ----------

/** The lines the Hub's information card shows for a Legacy room (plain text, no Phaser). */
export function legacySummary(content: Content, p: Profile, room: 'tree' | 'prestige' | 'network' | 'museum' | 'intel' | 'moves' | 'seeds'): { text: string; size?: number; muted?: boolean }[] {
  const l = legacyOf(p);
  switch (room) {
    case 'tree':
      return [{ text: 'Research Tree', size: 22 }, { text: `Research Points: ${p.researchPoints}` }, { text: `${l.tree.length} of ${LEGACY.tree.nodes.length} researched`, muted: true }, ...l.tree.map((id) => ({ text: getNode(id)?.name ?? id, size: 14, muted: true }))];
    case 'prestige': {
      const next = nextPrestige(p);
      return [{ text: 'Prestige', size: 22 }, { text: `Rank ${l.prestige} of ${LEGACY.prestige.maxRank}` }, { text: next ? `Next: ${next.title}` : 'Top rank reached', muted: true }, { text: 'Never deletes your collection or achievements.', size: 14, muted: true }];
    }
    case 'network':
      return [{ text: 'Trainer Network', size: 22 }, { text: `Contacts: ${l.contacts.length} of ${networkSlots(p)}` }, ...l.contacts.map((id) => ({ text: `${content.archetypes.get(id)?.name ?? id}: ${serviceFor(id).name}`, size: 14, muted: true }))];
    case 'museum':
      return [{ text: 'Item Museum', size: 22 }, { text: `${l.museum.length} items on display` }, { text: 'Items you carried at the end of any run.', size: 14, muted: true }];
    case 'intel':
      return [{ text: 'Intelligence Board', size: 22 }, { text: `Intel level ${intelLevel(p)} of 3` }, { text: `${Object.keys(l.regionIntel).length} regions visited`, muted: true }];
    case 'moves':
      return [{ text: 'Move Research', size: 22 }, { text: `${Object.keys(p.moveUses ?? {}).length} moves studied` }, { text: `Train for ${LEGACY.training.researchPerLot} RP up to ${LEGACY.training.maxRank}.`, size: 14, muted: true }];
    case 'seeds':
      return [{ text: 'Seed Shelf', size: 22 }, { text: `${l.seedShelf.length} of ${LEGACY.seedShelf.slots} seeds kept` }, ...l.seedShelf.slice(0, 6).map((s) => ({ text: s.label, size: 14, muted: true }))];
  }
}
