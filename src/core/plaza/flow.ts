// The Trainer Plaza (APPROVED.md §11): what the plaza offers, and what each choice does.
// Pure rules. Stock, visitors, rumours and events are drawn from the run seed, the region and the stage, so a plaza looks the
// same on a reload and different from run to run. Nothing here uses the battle, encounter or reward streams.

import { applyEffect, startClubBattle, tradeCandidates } from '../events';
import { catalogTargetProblem, isFreeReroll } from '../catalog';
import { changeFriendship } from '../friendship';
import { count, discover } from '../progress';
import { addRunAttribute, effectiveAttributes, runAttributeEffects } from '../attributes';
import { bossInfo, runLevelCap } from '../regions';
import { hashSeed, Rng } from '../rng';
import { isHostile } from '../rivals/outcome';
import { continueAfterDecisions, healParty, newMon, sellPrice } from '../run';
import { stageKey } from '../mapItems';
import { getSpecies, maxHp, maxPp } from '../pokemon';
import { typeEffectiveness } from '../battle/damage';
import { recordTraded } from '../story/hooks';
import { TYPE_NAMES, type Content, type EventBattle, type EventEffect, type TypeName } from '../contentSchema';
import type { MapNode, RunState, SideStop } from '../state';
import { PLAZA, type PlazaData, type PlazaNeed } from './schema';

const B = PLAZA.balance;
type ClubFormat = PlazaData['club'][number] & { trainerName?: string; classId?: string };
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type PlazaSectionId = 'stalls' | 'oddities' | 'traders' | 'board' | 'rumors' | 'club' | 'errands' | 'alley' | 'services' | 'people' | 'caravan';

export interface PlazaOption {
  id: string;
  title: string;
  text: string;
  cost: number;
  /** Why it cannot be picked now, or null. */
  problem: string | null;
}
export interface PlazaSectionInfo {
  id: PlazaSectionId;
  title: string;
  blurb: string;
  /** How many things there are to pick. */
  count: number;
}
export interface PlazaView {
  money: number;
  rep: number;
  repTitle: string;
  event: { name: string; text: string };
  atmosphere: string;
  sections: PlazaSectionInfo[];
  /** Errands taken and still open. */
  errandsOpen: number;
  /** A line about the hidden alley when you cannot use it yet. */
  alleyHint: string | null;
}
export interface PlazaSectionView {
  title: string;
  notes: string[];
  options: PlazaOption[];
}
export interface PlazaResult {
  run: RunState;
  message: string;
  /** A Battle Club match began: go to the battle screen. */
  battle: boolean;
}

// ---------- small helpers ----------

const key = (run: RunState): string => stageKey(run) ?? 'none';
const rngFor = (run: RunState, label: string): Rng => new Rng(hashSeed(`${run.seed}::plaza::${key(run)}::${label}`));
const usedN = (run: RunState, what: string): number => run.plaza.used[`${key(run)}:${what}`] ?? 0;
const markUsed = (run: RunState, what: string): void => {
  const k = `${key(run)}:${what}`;
  run.plaza.used[k] = (run.plaza.used[k] ?? 0) + 1;
};
const friend = (run: RunState, id: string): number => run.plaza.friends[id] ?? 0;
const hasFlag = (run: RunState, flag: string): boolean => run.plaza.flags.includes(flag);
const regionPrice = (run: RunState, base: number): number => Math.round(base * (1 + B.regionScale * run.regionIndex));
const rarityOf = (content: Content, id: string): Rarity => (content.catalog.get(id)?.rarity ?? 'common') as Rarity;
const itemName = (content: Content, id: string): string => content.catalog.get(id)?.name ?? content.items.get(id)?.name ?? id;
const regularOf = (id: string) => PLAZA.regulars.find((r) => r.id === id);
const regularName = (id: string): string => regularOf(id)?.name ?? id;
const stopsOf = (n: MapNode): SideStop[] => n.sides.filter((s) => s.kind !== 'plaza');

export const plazaRepTitle = (rep: number): string => [...B.repTitles].reverse().find((t) => rep >= t.at)?.title ?? B.repTitles[0]!.title;

const shuffled = <T>(rng: Rng, items: readonly T[]): T[] => items.map((item) => ({ item, k: rng.float() })).sort((a, b) => a.k - b.k).map((x) => x.item);

/** The current event of this plaza (a quiet day most of the time). */
export function plazaEvent(run: RunState): PlazaData['events'][number] {
  const rng = rngFor(run, 'event');
  const calm = PLAZA.events.find((e) => e.id === 'calm') ?? PLAZA.events[0]!;
  if (!rng.chance(B.eventChance)) return calm;
  const pool = PLAZA.events.filter((e) => e.id !== 'calm' && e.weight > 0 && e.minBadges <= run.badges.length);
  return pool.length === 0 ? calm : rng.weighted(pool.map((e) => ({ item: e, weight: e.weight })));
}

function addRep(run: RunState, amount: number): void {
  const bonus = amount > 0 ? plazaEvent(run).repBonus : 0;
  run.plaza.rep = Math.max(0, Math.min(B.repCap, run.plaza.rep + amount + bonus));
}
function addFriend(run: RunState, id: string, amount: number): void {
  run.plaza.friends[id] = Math.max(0, friend(run, id) + amount);
}

/** The plaza stop the player stands at. */
function findPlaza(run: RunState, sideId: string): SideStop {
  const stage = run.stage;
  if (!stage || stage.current === null) throw new Error('Choose a node first');
  const side = stage.map.nodes.find((n) => n.id === stage.current)?.sides.find((s) => s.id === sideId && s.kind === 'plaza');
  if (!side) throw new Error(`No plaza "${sideId}" here`);
  return side;
}

// ---------- who is here ----------

function discountOf(run: RunState, keeperId: string): number {
  const perk = regularOf(keeperId)?.perk;
  if (hasFlag(run, `discount:${keeperId}`)) return perk?.discount ?? 0.15;
  return perk && friend(run, keeperId) >= perk.at ? perk.discount : 0;
}

function openStallIds(run: RunState): string[] {
  const rng = rngFor(run, 'stalls');
  const eligible = PLAZA.stalls.filter((s) => s.minRep <= run.plaza.rep);
  return shuffled(rng, eligible).slice(0, B.stallsOpen + (run.plaza.rep >= 10 ? 1 : 0)).map((s) => s.id);
}

const alleyOpen = (content: Content, run: RunState): boolean =>
  hasFlag(run, 'alley') || run.plaza.rep >= B.alleyRep || (effectiveAttributes(content, run).goodEvil ?? 0) <= B.alleyEvil || (effectiveAttributes(content, run).intelligence ?? 0) >= 6;

function presentRegulars(content: Content, run: RunState): string[] {
  const keepers = openStallIds(run).map((id) => PLAZA.stalls.find((s) => s.id === id)!.keeper);
  const fixed = [PLAZA.oddities.keeper, 'gus', 'vera', 'pip', ...PLAZA.services.map((s) => s.keeper)];
  if (alleyOpen(content, run)) fixed.push(PLAZA.alley.keeper);
  return [...new Set([...keepers, ...fixed])];
}

function factionsHere(run: RunState): PlazaData['factions'] {
  const rng = rngFor(run, 'factions');
  const list = shuffled(rng, PLAZA.factions);
  return list.slice(0, rng.chance(0.5) ? 2 : 1);
}

function rivalHere(run: RunState): { id: string; name: string; classId: string; state: string } | null {
  const rivals = run.story.rivals;
  if (rivals.length === 0 || !rngFor(run, 'rival').chance(B.rivalChance)) return null;
  const r = rngFor(run, 'rival-pick').pick(rivals);
  return { id: r.id, name: r.name, classId: r.classId, state: r.state };
}

function foeHere(run: RunState): { name: string; classId: string } | null {
  const foes = run.plaza.foes.filter((f) => f.won);
  if (foes.length === 0 || !rngFor(run, 'foe').chance(B.foeChance)) return null;
  const f = rngFor(run, 'foe-pick').pick(foes);
  return { name: f.name, classId: f.classId };
}

function caravanHere(run: RunState): PlazaData['caravans'][number] | null {
  const rng = rngFor(run, 'caravan');
  if (!rng.chance(B.caravanChance)) return null;
  const pool = PLAZA.caravans.filter((c) => c.minBadges <= run.badges.length);
  return pool.length === 0 ? null : rng.pick(pool);
}

/** Notes the party makes about the people here (types and species that react). */
function reactionNotes(content: Content, run: RunState): string[] {
  const present = new Set<string>([...presentRegulars(content, run), ...factionsHere(run).map((f) => f.id)]);
  if (rivalHere(run)) present.add('rival');
  if (foeHere(run)) present.add('foe');
  const types = new Set(run.party.flatMap((m) => getSpecies(content, m.speciesId).types));
  return PLAZA.reactions
    .filter((r) => present.has(r.at) && ((r.type && types.has(r.type)) || (r.species && run.party.some((m) => m.speciesId === r.species))))
    .map((r) => r.text)
    .slice(0, 3);
}

function atmosphereOf(content: Content, run: RunState): string {
  const rng = rngFor(run, 'mood');
  const g = PLAZA.gatherings;
  const stage = run.stage;
  const boss = stage ? bossInfo(content, 'gym', stage.leaderId).title : 'the boss';
  const pool: { item: string[]; weight: number }[] = [{ item: g.preBoss, weight: 2 }];
  if (run.regionIndex === 0 && (stage?.index ?? 0) === 0) pool.push({ item: g.early, weight: 3 });
  if (run.badges.length > 0) pool.push({ item: g.postBadge, weight: 2 });
  if (run.regionIndex >= 2) pool.push({ item: g.late, weight: 2 });
  const lines = rng.weighted(pool);
  const line = rng.pick(lines);
  return lines === g.preBoss ? `${line} (Everyone is talking about ${boss}.)` : line;
}

// ---------- needs (trade posts, errands) ----------

const counterNow = (run: RunState, counter: string): number => run.log.counters[counter] ?? 0;

function needProblem(content: Content, run: RunState, need: PlazaNeed, base = 0): string | null {
  switch (need.kind) {
    case 'have':
      return tradeCandidates(content, run, need.want).length === 0 ? `Needs ${need.want.label} in your party` : null;
    case 'mon':
      if (run.party.length < 2) return 'Needs another Pokémon at your side';
      return tradeCandidates(content, run, need.want).length === 0 ? `Needs ${need.want.label} in your party` : null;
    case 'item':
      return (run.inventory[need.id] ?? 0) < need.count ? `Needs ${need.count} × ${itemName(content, need.id)}` : null;
    case 'badges':
      return run.badges.length < need.n ? `Needs ${need.n} badge${need.n > 1 ? 's' : ''}` : null;
    case 'counter': {
      const have = counterNow(run, need.counter) - base;
      return have < need.n ? `${need.label} (${Math.max(0, have)}/${need.n})` : null;
    }
  }
}

/** Hands over what a need asks for (mutates `run`). */
function needPay(content: Content, run: RunState, need: PlazaNeed, rng: Rng): void {
  if (need.kind === 'mon') {
    const pick = tradeCandidates(content, run, need.want)[0]!;
    applyEffect(content, run, { kind: 'tradeAway', want: need.want }, rng, pick.uid);
  } else if (need.kind === 'item') {
    run.inventory[need.id] = (run.inventory[need.id] ?? 0) - need.count;
    if ((run.inventory[need.id] ?? 0) <= 0) delete run.inventory[need.id];
  }
}

function needText(content: Content, need: PlazaNeed): string {
  switch (need.kind) {
    case 'have':
      return `Show ${need.want.label}`;
    case 'mon':
      return `Give ${need.want.label}`;
    case 'item':
      return `Hand over ${need.count} × ${itemName(content, need.id)}`;
    case 'badges':
      return `Hold ${need.n} badge${need.n > 1 ? 's' : ''}`;
    case 'counter':
      return need.label;
  }
}

// ---------- stalls ----------

interface StockItem { id: string; name: string; rarity: Rarity; description: string; price: number }

function stallStock(content: Content, run: RunState, stallId: string): StockItem[] {
  const stall = PLAZA.stalls.find((s) => s.id === stallId)!;
  const rng = rngFor(run, `stock:${stallId}`);
  const ev = plazaEvent(run);
  const price = (base: number) => Math.max(1, Math.round(base * stall.markup * (1 + B.regionScale * run.regionIndex) * ev.priceScale * (1 - discountOf(run, stall.keeper)) * runAttributeEffects(content, run).price));
  let pool: StockItem[];
  if (stall.families.includes('ball')) {
    pool = [...content.items.values()]
      .filter((i) => i.category === 'ball' && i.id !== 'master-ball')
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((i) => ({ id: i.id, name: i.name, rarity: rarityOf(content, i.id), description: i.description, price: price(content.shop.find((e) => e.item === i.id)?.price ?? B.ballPrice) }));
  } else {
    pool = [...content.catalog.values()]
      .filter((e) => e.status === 'supported' && stall.families.includes(e.family) && !isFreeReroll(run, e) && (e.stacksOn !== 'pokemon' || run.party.some((m) => catalogTargetProblem(content, run, e, m) === null)))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) => ({ id: e.id, name: e.name, rarity: e.rarity as Rarity, description: e.description, price: price(B.rarityPrice[e.rarity as Rarity]) }));
  }
  const r = Math.min(1, run.plaza.rep / 20);
  const weight = (x: StockItem) => ({ common: 6, uncommon: 4, rare: 1.5 + 4 * r, epic: 0.1 + 1.5 * r })[x.rarity];
  const picked: StockItem[] = [];
  while (picked.length < stall.size && pool.length > 0) {
    const one = rng.weighted(pool.map((x) => ({ item: x, weight: weight(x) })));
    picked.push(one);
    pool = pool.filter((x) => x !== one);
  }
  return picked.sort((a, b) => a.price - b.price);
}

// ---------- oddities ----------

function oddityStock(run: RunState): PlazaData['oddities']['items'] {
  const rng = rngFor(run, 'oddities');
  return shuffled(rng, PLAZA.oddities.items.filter((o) => o.minBadges <= run.badges.length)).slice(0, B.oddityShow);
}

// ---------- traders ----------

function tradersHere(run: RunState): PlazaData['traders'] {
  const rng = rngFor(run, 'traders');
  const open = PLAZA.traders.filter((t) => (t.minRep <= run.plaza.rep && t.minBadges <= run.badges.length) || hasFlag(run, `trade:${t.id}`));
  return shuffled(rng, open).slice(0, B.traderCount);
}

function traderSpecies(run: RunState, t: PlazaData['traders'][number]): string {
  return rngFor(run, `tr:${t.id}`).pick(t.give.species);
}

// ---------- the board, rumours ----------

function postsHere(run: RunState): PlazaData['posts'] {
  const rng = rngFor(run, 'posts');
  const open = PLAZA.posts.filter((p) => !run.plaza.done.includes(p.id) && p.minBadges <= run.badges.length);
  return shuffled(rng, open).slice(0, B.postCount);
}

function stopLabel(content: Content, s: SideStop): string {
  switch (s.kind) {
    case 'heal': return 'healing spot';
    case 'shop': return 'shop';
    case 'fish': return 'fishing spot';
    case 'raid': return 'raid den';
    case 'totem': return 'Totem territory';
    case 'expedition': return 'expedition gate';
    case 'minigame': return 'minigame stop';
    case 'service': return 'service building';
    case 'event': return s.hidden ? 'strange "?" stop' : `${content.events.get(s.eventId ?? '')?.name ?? 'event'} stop`;
    case 'plaza': return 'plaza';
  }
}

/** Rumours: some are made up, some point at real stops further along; the reliability tells how much to trust them. */
function rumorNotes(content: Content, run: RunState): string[] {
  const rng = rngFor(run, 'rumors');
  const notes: string[] = [];
  const stage = run.stage!;
  const here = stage.map.nodes.find((n) => n.id === stage.current)!;
  const ahead = stage.map.nodes.filter((n) => n.column > here.column && stopsOf(n).length > 0);
  const real = shuffled(rng, ahead).slice(0, 2);
  const kinds = ['healing spot', 'shop', 'fishing spot', 'raid den', 'Totem territory', 'strange "?" stop'];
  for (const node of real) {
    const s = rng.pick(stopsOf(node));
    const label = stopLabel(content, s);
    const roll = rng.float();
    if (roll < 0.4) notes.push(`[Firsthand] A ${label} waits on level ${node.column}.`);
    else if (roll < 0.75) notes.push(`[Secondhand] Somebody saw a ${label} somewhere past level ${node.column - 1}.`);
    else notes.push(`[Hearsay] I heard there is a ${rng.chance(0.5) ? label : rng.pick(kinds)} near level ${Math.min(stage.map.columns, Math.max(here.column + 1, node.column + rng.int(-2, 2)))}. That was a while back.`);
  }
  const flavour = shuffled(rng, PLAZA.rumors.filter((r) => r.minBadges <= run.badges.length)).slice(0, 3);
  for (const f of flavour) notes.push(`[${f.source === 'firsthand' ? 'Firsthand' : f.source === 'secondhand' ? 'Secondhand' : 'Hearsay'}] ${f.text}`);
  return notes;
}

// ---------- errands ----------

function errandsOffered(content: Content, run: RunState): PlazaData['errands'] {
  const taken = new Set(run.plaza.errands.map((e) => e.id));
  const here = new Set(presentRegulars(content, run));
  const open = PLAZA.errands.filter((e) => !taken.has(e.id) && !run.plaza.done.includes(e.id) && e.minBadges <= run.badges.length && here.has(e.giver));
  return shuffled(rngFor(run, 'errands'), open).slice(0, B.errandSlots);
}

// ---------- the Battle Club ----------

function clubFormats(run: RunState): ClubFormat[] {
  const ev = plazaEvent(run);
  return PLAZA.club.filter((f) => f.minBadges <= run.badges.length).map((f) => ({ ...f, fee: Math.round(regionPrice(run, f.fee) * ev.clubFee) }));
}

function clubFormat(content: Content, run: RunState, id: string): ClubFormat {
  if (id.startsWith('rival:')) {
    const r = run.story.rivals.find((x) => x.id === id.slice(6));
    if (!r) throw new Error('That rival is not here');
    return { id, name: `${r.name}'s challenge`, text: `${r.name} wants a battle.`, fee: 0, rounds: 1, size: 3, levelBonus: 1, themed: false, boss: false, minRep: 0, minBadges: 0, roundPrize: [], prize: [{ kind: 'money', amount: regionPrice(run, 900) }, { kind: 'attribute', key: 'charisma', amount: 1 }], prizeText: 'a purse and some respect', rep: 2, trainerName: r.name, classId: r.classId };
  }
  if (id.startsWith('foe:')) {
    const f = run.plaza.foes.find((x) => x.name === id.slice(4));
    if (!f) throw new Error('That trainer is not here');
    return { id, name: `Rematch with ${f.name}`, text: 'A rematch.', fee: 0, rounds: 1, size: 3, levelBonus: 0, themed: false, boss: false, minRep: 0, minBadges: 0, roundPrize: [], prize: [{ kind: 'money', amount: regionPrice(run, 700) }], prizeText: 'a purse', rep: 2, trainerName: f.name, classId: f.classId };
  }
  const f = clubFormats(run).find((x) => x.id === id);
  if (!f) throw new Error(`No Battle Club format "${id}"`);
  return f;
}

function clubTheme(run: RunState): string {
  return rngFor(run, 'club-theme').pick([...TYPE_NAMES]);
}

function clubBattleOf(content: Content, run: RunState, f: ClubFormat, theme: string | null, round: number): EventBattle {
  const rng = rngFor(run, `club:${f.id}:${round}`);
  let name = f.trainerName ?? `Club trainer${f.rounds > 1 ? ` (round ${round + 1})` : ''}`;
  let bossId: string | undefined;
  if (f.boss) {
    const ids = [...content.bosses.keys()].sort().filter((id) => id !== run.stage!.leaderId);
    bossId = rng.pick(ids);
    name = content.bosses.get(bossId)?.name ?? name;
  }
  return { kind: 'trainer', name, classId: f.classId, bossId, ghost: false, retired: false, rival: false, shadow: 0, chain: 1, size: f.size, types: theme ? [theme as TypeName] : [], levelBonus: f.levelBonus + Math.floor(round / 2), win: [] };
}

function beginClubRound(content: Content, run: RunState, sideId: string): void {
  const session = run.plaza.club!;
  const f = clubFormat(content, run, session.format);
  const battle = clubBattleOf(content, run, f, session.theme, session.round);
  startClubBattle(content, run, battle, rngFor(run, `club-battle:${f.id}:${session.round}`), { eventId: 'plaza:club', choiceIndex: session.round, sideId, success: true });
}

/** A club match was won (mutates `run`): pays the round, and the prize when the streak is done. */
export function plazaClubWon(content: Content, run: RunState): string[] {
  const session = run.plaza.club;
  if (!session) return [];
  const f = clubFormat(content, run, session.format);
  const rng = rngFor(run, `club-win:${f.id}:${session.round}`);
  const words: string[] = [];
  const apply = (effects: readonly EventEffect[]) => {
    for (const e of effects) {
      const w = applyEffect(content, run, e, rng);
      if (w) words.push(w);
    }
  };
  apply(f.roundPrize);
  session.round += 1;
  if (session.round >= f.rounds) {
    apply(f.prize);
    addRep(run, f.rep);
    if (f.id.startsWith('rival:') || f.id.startsWith('foe:')) markUsed(run, `club:${f.id}`);
    run.plaza.club = null;
    words.push(`${f.name} complete!`);
  } else {
    words.push(`Round ${session.round} of ${f.rounds} won. The next match waits in the Battle Club.`);
  }
  return words;
}

/** A club match was lost (mutates `run`): a friendly loss, nobody is out of the run. */
export function plazaClubLost(content: Content, run: RunState): void {
  for (const m of run.party) {
    if (m.hp <= 0) m.hp = Math.max(1, Math.floor(maxHp(content, m) / 4));
    m.status = null;
  }
  run.plaza.club = null;
  run.battle = null;
  run.phase = 'map';
}

/** Remembers an ordinary trainer you beat, for "past enemies return" (mutates `run`). */
export function noteFoe(run: RunState, name: string, classId: string): void {
  if (run.plaza.foes.some((f) => f.name === name)) return;
  run.plaza.foes.push({ name, classId, won: true });
  if (run.plaza.foes.length > 12) run.plaza.foes.shift();
}

// ---------- the view ----------

export function plazaView(content: Content, run: RunState, sideId: string): PlazaView {
  findPlaza(run, sideId);
  const ev = plazaEvent(run);
  const sections: PlazaSectionInfo[] = [];
  const add = (id: PlazaSectionId, title: string, blurb: string): void => {
    sections.push({ id, title, blurb, count: sectionView(content, run, sideId, id).options.length });
  };
  if (!ev.closed) {
    add('stalls', 'Merchant stalls', 'Rotating stalls: held items, balls, berries, supplies, evolution materials, keepsakes.');
    add('oddities', 'The Oddities Dealer', `${regularName(PLAZA.oddities.keeper)} sells things that don't fit anywhere.`);
    add('traders', 'Specialist traders', 'Trainers who swap a Pokémon for a Pokémon.');
    add('board', 'Trade board', 'Notices and wanted posters.');
    add('rumors', 'Rumour board', 'Tips, gossip and paid scouting.');
    add('club', 'Battle Club', 'Optional matches for prizes and respect.');
    add('errands', 'Errands and small jobs', 'Favours that pay in more than money.');
    if (alleyOpen(content, run)) add('alley', 'The back alley', 'Stolen goods, strange contracts. It has a price.');
  }
  add('services', 'Services', 'The nurse, the groomer, the appraiser, the coach.');
  add('people', 'People around', 'Regulars, visitors, the rival, old foes.');
  if (!ev.closed && caravanHere(run)) add('caravan', caravanHere(run)!.name, caravanHere(run)!.text);
  return {
    money: run.money,
    rep: run.plaza.rep,
    repTitle: plazaRepTitle(run.plaza.rep),
    event: { name: ev.name, text: ev.text },
    atmosphere: atmosphereOf(content, run),
    sections,
    errandsOpen: run.plaza.errands.length,
    alleyHint: alleyOpen(content, run) ? null : 'There is a narrow passage behind the bins, but nobody will let you in yet.',
  };
}

export function sectionView(content: Content, run: RunState, sideId: string, section: PlazaSectionId): PlazaSectionView {
  findPlaza(run, sideId);
  const ev = plazaEvent(run);
  const options: PlazaOption[] = [];
  const notes: string[] = [];
  const broke = (cost: number) => (run.money < cost ? `You need ₽${cost}.` : null);
  const add = (id: string, title: string, text: string, cost: number, problem: string | null = null) => options.push({ id, title, text, cost, problem: problem ?? broke(cost) });
  const closed = ev.closed && section !== 'services' && section !== 'people';
  if (closed) {
    notes.push('Everything is shut. The relief workers are the only ones around.');
    return { title: section, notes, options };
  }
  const attrs = effectiveAttributes(content, run);
  switch (section) {
    case 'stalls': {
      for (const id of openStallIds(run)) {
        const stall = PLAZA.stalls.find((s) => s.id === id)!;
        const d = discountOf(run, stall.keeper);
        const k = regularOf(stall.keeper);
        const line = k ? [...k.lines].reverse().find((l) => friend(run, stall.keeper) >= l.at)?.text : '';
        notes.push(`${stall.name} (${regularName(stall.keeper)}): "${line}"${d > 0 ? ` ${k?.perk?.text ?? 'A friend discount applies.'}` : ''}`);
        for (const it of stallStock(content, run, id)) add(`buy:${id}:${it.id}`, `${stall.name}: ${it.name}  (${it.rarity})`, it.description, it.price, usedN(run, `buy:${id}:${it.id}`) > 0 ? 'Sold out.' : null);
      }
      break;
    }
    case 'oddities': {
      const sharp = (attrs.intelligence ?? 0) >= 4;
      notes.push(`"${regularOf(PLAZA.oddities.keeper)!.lines.slice().reverse().find((l) => friend(run, PLAZA.oddities.keeper) >= l.at)!.text}"`);
      if (sharp) notes.push('Your sharp eye recognises each object (Intelligence 4+).');
      for (const o of oddityStock(run)) add(`odd:${o.item}`, sharp ? itemName(content, o.item) : 'A curious object', o.hint, regionPrice(run, Math.round(o.price * ev.priceScale)), usedN(run, `odd:${o.item}`) > 0 ? 'Sold.' : null);
      break;
    }
    case 'traders': {
      for (const t of tradersHere(run)) {
        notes.push(`${t.name}: "${t.line}" Wants ${t.want.label}; offers ${t.give.label}.`);
        const species = getSpecies(content, traderSpecies(run, t));
        for (const m of tradeCandidates(content, run, t.want)) {
          const sp = getSpecies(content, m.speciesId);
          add(`trade:${t.id}:${m.uid}`, `${t.name}: ${sp.name} Lv${m.level} for ${species.name}`, `You get ${species.name} (${species.types.join('/')}), Lv${Math.min(runLevelCap(content, run), m.level + t.give.levelBonus)}. ${sp.name} leaves for good; the new Pokémon starts fresh.`, 0, usedN(run, `trade:${t.id}`) > 0 ? 'Already traded today.' : null);
        }
        if (tradeCandidates(content, run, t.want).length === 0) add(`trade:${t.id}:none`, `${t.name}: wants ${t.want.label}`, `Offers ${species.name}. You don't carry what they want.`, 0, `Needs ${t.want.label} in your party`);
      }
      break;
    }
    case 'board': {
      for (const p of postsHere(run)) add(`post:${p.id}`, p.title, `${p.text} ${needText(content, p.need)}. Reward: ${p.rewardText}.`, 0, needProblem(content, run, p.need));
      if (options.length === 0) notes.push('The board is bare today.');
      break;
    }
    case 'rumors': {
      notes.push(...rumorNotes(content, run));
      add('tip:route', 'Pay for a route tip', 'Vera sells her best tip: every hidden "?" stop on this stage shows what it is. Accurate.', regionPrice(run, B.routeTipCost), usedN(run, 'tip:route') > 0 ? 'Already bought.' : null);
      add('tip:gym', 'Pay for a gym tip', "A trusted source shows you the gym leader's whole team.", regionPrice(run, B.scoutCost), usedN(run, 'tip:gym') > 0 ? 'Already bought.' : null);
      break;
    }
    case 'club': {
      const session = run.plaza.club;
      const fighting = run.party.some((m) => m.hp > 0);
      if (session && session.stage === key(run)) {
        const f = clubFormat(content, run, session.format);
        add('club:next', `${f.name}: round ${session.round + 1} of ${f.rounds}`, 'Your team is not healed in between. Win to carry on.', 0, fighting ? null : 'No Pokémon can fight.');
        add('club:quit', 'Leave the streak', 'Walk away. The prizes you won so far are yours.', 0);
      } else {
        const theme = clubTheme(run);
        notes.push(`The board says today's Themed Cup is ${theme.toUpperCase()}-type foes only.`);
        for (const f of clubFormats(run)) {
          add(`club:${f.id}`, `${f.name} (${f.rounds} match${f.rounds > 1 ? 'es' : ''})`, `${f.text} Prize: ${f.prizeText}.`, f.fee, f.minRep > run.plaza.rep ? `Needs reputation ${f.minRep} (${plazaRepTitle(f.minRep)})` : usedN(run, `club:${f.id}`) >= 2 ? 'Played twice already today.' : !fighting ? 'No Pokémon can fight.' : null);
        }
      }
      break;
    }
    case 'errands': {
      for (const e of run.plaza.errands) {
        const def = PLAZA.errands.find((x) => x.id === e.id);
        if (def) add(`done:${e.id}`, `Turn in: ${def.title}`, `${def.text} Reward: ${def.rewardText}.`, 0, needProblem(content, run, def.need, e.base));
      }
      for (const def of errandsOffered(content, run)) add(`take:${def.id}`, `${regularName(def.giver)}: ${def.title}`, `${def.text} ${needText(content, def.need)}. Reward: ${def.rewardText}.`, 0, run.plaza.errands.length >= 6 ? 'You are already carrying six errands.' : null);
      if (options.length === 0) notes.push('Nobody has a job for you right now.');
      else notes.push('Open errands keep going after you leave. Bring the proof back to any plaza.');
      break;
    }
    case 'alley': {
      if (!alleyOpen(content, run)) {
        notes.push(PLAZA.alley.entry);
        break;
      }
      notes.push(`${regularName(PLAZA.alley.keeper)} nods you through. Everything here is cash only, and some of it bites.`);
      for (const o of shuffled(rngFor(run, 'alley'), PLAZA.alley.offers).slice(0, B.alleyShow)) {
        add(`alley:${o.id}`, o.title + (o.risk > 0 ? `  (risk ${Math.round(o.risk * 100)}%)` : ''), o.text, regionPrice(run, o.cost), o.minRep > run.plaza.rep ? `Needs reputation ${o.minRep}` : usedN(run, `alley:${o.id}`) > 0 ? 'Gone.' : null);
      }
      break;
    }
    case 'services': {
      for (const s of PLAZA.services) {
        const cost = Math.round(regionPrice(run, s.cost) * ev.serviceScale);
        const left = usedN(run, `svc:${s.id}`) >= s.limit ? `The ${s.name.toLowerCase()} is closed for today.` : s.minRep > run.plaza.rep ? `Needs reputation ${s.minRep}` : null;
        if (s.id === 'appraise') {
          const items = Object.keys(run.inventory).filter((id) => (run.inventory[id] ?? 0) > 0 && sellPrice(content, run, id) !== null).sort();
          for (const id of items.slice(0, 10)) add(`svc:appraise:${id}`, `${s.name}: ${itemName(content, id)}`, `${regularName(s.keeper)} values it at double the usual price (₽${(sellPrice(content, run, id) ?? 0) * 2}).`, cost, left);
          if (items.length === 0) add('svc:appraise:none', s.name, s.text, cost, 'You have nothing to value.');
        } else if (s.id === 'heal') {
          const hurt = run.party.some((m) => m.hp < maxHp(content, m) || m.status || m.moves.some((mv) => mv.pp < maxPp(content, mv)));
          add('svc:heal', s.name, `${s.text} (${regularName(s.keeper)})`, cost, left ?? (hurt ? null : 'Your party is already in top shape.'));
        } else {
          add(`svc:${s.id}`, s.name, `${s.text} (${regularName(s.keeper)})`, cost, left);
        }
      }
      break;
    }
    case 'people': {
      notes.push(atmosphereOf(content, run), ...reactionNotes(content, run));
      if (ev.gift.length > 0) add('gift', `The ${ev.name}: ${ev.giftText}`, ev.text, 0, usedN(run, 'gift') > 0 ? 'Already collected.' : null);
      for (const flag of run.plaza.flags.filter((f) => f.startsWith('caravan:'))) {
        const c = PLAZA.caravans.find((x) => x.id === flag.slice(8));
        if (c) add(`parcel:${c.id}`, `A parcel from the ${c.name}`, 'They sent a thank-you.', 0);
      }
      const rival = rivalHere(run);
      if (rival) {
        if (rival.state === 'ally') {
          add('rival:gift', `${rival.name} shares supplies`, `${rival.name} grins and presses two Super Potions into your hands.`, 0, usedN(run, 'rival:gift') > 0 ? 'Already taken.' : null);
        } else if (rival.state === 'retired') {
          notes.push(`${rival.name} gives you a nod across the plaza and says nothing. They have put the rivalry down.`);
        } else {
          notes.push(`${rival.name} spots you across the plaza: "Still going? I'm further along than you think."`);
          add(`club:rival:${rival.id}`, `Take ${rival.name}'s challenge`, 'A battle on the spot. Win for a purse and respect; losing is friendly.', 0, usedN(run, `club:rival:${rival.id}`) > 0 ? 'Already fought today.' : !run.party.some((m) => m.hp > 0) ? 'No Pokémon can fight.' : null);
        }
      }
      const foe = foeHere(run);
      if (foe) {
        notes.push(`${foe.name}, whom you beat earlier, is here. They look like they've been practising.`);
        add('foe:thanks', `Chat with ${foe.name}`, 'They say you were right. A small gift, and they put in a good word.', 0, usedN(run, 'foe:thanks') > 0 ? 'Already talked.' : null);
        add(`club:foe:${foe.name}`, `Rematch with ${foe.name}`, 'A friendly rematch for a purse.', 0, usedN(run, `club:foe:${foe.name}`) > 0 ? 'Already fought today.' : !run.party.some((m) => m.hp > 0) ? 'No Pokémon can fight.' : null);
      }
      const factions = factionsHere(run);
      for (const f of factions) {
        notes.push(`${f.name} ${f.rep}: ${f.text}`);
        for (const o of f.offers) add(`fac:${f.id}:${o.id}`, `${f.name}: ${o.title}`, o.text, regionPrice(run, o.cost), o.minRep > run.plaza.rep ? `Needs reputation ${o.minRep}` : usedN(run, `fac:${f.id}:${o.id}`) > 0 ? 'Done.' : null);
      }
      if (factions.length === 2 && (factions[0]!.rival === factions[1]!.id || factions[1]!.rival === factions[0]!.id)) {
        notes.push(`${factions[0]!.name} and ${factions[1]!.name} are glaring at each other across the square.`);
        add('fac:calm', 'Calm the argument', 'Step between them. A good deed (+1 Good) the whole plaza will notice.', 0, usedN(run, 'fac:calm') > 0 ? 'Already calmed.' : null);
      }
      for (const id of presentRegulars(content, run)) {
        const r = regularOf(id);
        if (!r) continue;
        const line = [...r.lines].reverse().find((l) => friend(run, id) >= l.at)!.text;
        add(`talk:${id}`, `Talk to ${r.name}`, `${r.role}. ${r.goal} (friendship ${friend(run, id)})`, 0, usedN(run, `talk:${id}`) > 0 ? `"${line}"` : null);
      }
      break;
    }
    case 'caravan': {
      const c = caravanHere(run);
      if (!c) break;
      notes.push(c.text);
      for (const o of c.offers) add(`cv:${c.id}:${o.id}`, `${c.name}: ${o.title}`, o.text, regionPrice(run, o.cost), usedN(run, `cv:${c.id}:${o.id}`) > 0 ? 'Gone.' : o.need ? needProblem(content, run, o.need) : null);
      break;
    }
  }
  return { title: section, notes, options };
}

// ---------- doing things ----------

export function usePlaza(content: Content, current: RunState, sideId: string, section: PlazaSectionId, optionId: string): PlazaResult {
  if (current.phase !== 'map') throw new Error(`Action needs phase "map" but run is in "${current.phase}"`);
  const view = sectionView(content, current, sideId, section);
  const option = view.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`No such option "${optionId}" here`);
  if (option.problem) throw new Error(option.problem);
  const run = structuredClone(current);
  const ev = plazaEvent(run);
  const rng = rngFor(run, `act:${optionId}:${run.plaza.visits}:${Object.keys(run.plaza.used).length}`);
  const words: string[] = [];
  const effects = (list: readonly EventEffect[]) => {
    for (const e of list) {
      const w = applyEffect(content, run, e, rng);
      if (w) words.push(w);
    }
  };
  run.money -= option.cost;
  if (option.cost > 0) count(run, 'moneySpent', option.cost);
  const [kind, a, b] = optionId.split(':');
  let battle = false;
  switch (kind) {
    case 'buy': {
      const item = stallStock(content, current, a!).find((i) => i.id === b)!;
      effects([{ kind: 'item', id: item.id, count: 1 }]);
      markUsed(run, `buy:${a}:${b}`);
      const keeper = PLAZA.stalls.find((s) => s.id === a)!.keeper;
      if (usedN(run, `rep:${a}`) === 0) { addRep(run, 1); markUsed(run, `rep:${a}`); }
      addFriend(run, keeper, 1);
      words.unshift(`Bought ${item.name}.`);
      break;
    }
    case 'odd': {
      effects([{ kind: 'item', id: a!, count: 1 }]);
      markUsed(run, `odd:${a}`);
      addFriend(run, PLAZA.oddities.keeper, 1);
      addRep(run, 1);
      words.unshift(`It was a ${itemName(content, a!)}.`);
      break;
    }
    case 'trade': {
      const t = PLAZA.traders.find((x) => x.id === a)!;
      const mon = run.party.find((m) => m.uid === b)!;
      const speciesId = traderSpecies(run, t);
      const next = newMon(content, run, speciesId, Math.max(1, Math.min(runLevelCap(content, run), mon.level + t.give.levelBonus)), 'p');
      recordTraded(content, run, mon, speciesId);
      run.party[run.party.indexOf(mon)] = next;
      discover(run, speciesId, false);
      count(run, 'tradesMade');
      markUsed(run, `trade:${a}`);
      addRep(run, 2);
      addFriend(run, 'gus', 1);
      words.push(`${getSpecies(content, mon.speciesId).name} was traded for ${getSpecies(content, speciesId).name}!`);
      break;
    }
    case 'post': {
      const p = PLAZA.posts.find((x) => x.id === a)!;
      needPay(content, run, p.need, rng);
      effects(p.effects);
      run.plaza.done.push(p.id);
      addRep(run, p.rep);
      addFriend(run, 'vera', 1);
      words.unshift(`Notice answered: ${p.title}.`);
      break;
    }
    case 'tip': {
      effects(a === 'route' ? [{ kind: 'revealStops' }] : [{ kind: 'gymPreview' }]);
      markUsed(run, `tip:${a}`);
      addFriend(run, 'vera', 1);
      words.unshift('A trusted tip.');
      break;
    }
    case 'club': {
      if (a === 'quit') {
        run.plaza.club = null;
        words.push('You walk away from the streak.');
        break;
      }
      if (a !== 'next') {
        const id = optionId.slice(5);
        const f = clubFormat(content, run, id);
        run.plaza.club = { stage: key(run), format: f.id, round: 0, theme: f.themed ? clubTheme(run) : null };
        markUsed(run, `club:${id}`);
      }
      beginClubRound(content, run, sideId);
      battle = true;
      words.push('The match begins!');
      break;
    }
    case 'take': {
      const e = PLAZA.errands.find((x) => x.id === a)!;
      const need = e.need;
      run.plaza.errands.push({ id: e.id, base: need.kind === 'counter' ? counterNow(run, need.counter) : 0, stage: key(run) });
      addFriend(run, e.giver, 1);
      words.push(`You took the errand: ${e.title}.`);
      break;
    }
    case 'done': {
      const e = PLAZA.errands.find((x) => x.id === a)!;
      needPay(content, run, e.need, rng);
      effects(e.effects);
      run.plaza.errands = run.plaza.errands.filter((x) => x.id !== e.id);
      run.plaza.done.push(e.id);
      if (e.unlocks && !hasFlag(run, e.unlocks)) run.plaza.flags.push(e.unlocks);
      addRep(run, e.rep);
      addFriend(run, e.giver, e.friendship);
      words.unshift(`Errand done: ${e.title}.${e.unlocks ? ' Something new opened up.' : ''}`);
      break;
    }
    case 'alley': {
      const o = PLAZA.alley.offers.find((x) => x.id === a)!;
      markUsed(run, `alley:${a}`);
      if (o.evil !== 0) addRunAttribute(content, run, 'goodEvil', o.evil);
      addFriend(run, PLAZA.alley.keeper, 1);
      if (o.risk > 0 && rng.chance(o.risk)) {
        effects(o.trouble);
        words.unshift(o.troubleText || 'It went wrong.');
      } else {
        effects(o.effects);
        words.unshift('The deal went through.');
        addRep(run, 1);
      }
      break;
    }
    case 'svc': {
      const s = PLAZA.services.find((x) => x.id === a)!;
      markUsed(run, `svc:${a}`);
      addFriend(run, s.keeper, 1);
      if (a === 'heal') {
        healParty(content, run);
        words.push('Your party is fully healed.');
      } else if (a === 'groom') {
        for (const m of run.party) changeFriendship(content, m, 3);
        words.push('Everyone is groomed and glowing. Friendship rose.');
      } else if (a === 'appraise') {
        const price = (sellPrice(content, run, b!) ?? 0) * 2;
        run.inventory[b!] = (run.inventory[b!] ?? 0) - 1;
        if ((run.inventory[b!] ?? 0) <= 0) delete run.inventory[b!];
        run.money += price;
        count(run, 'moneyEarned', price);
        words.push(`${itemName(content, b!)} appraised: +₽${price}.`);
      } else {
        const boss = bossInfo(content, 'gym', run.stage!.leaderId);
        const lines = run.party.slice(0, 6).map((m) => {
          const sp = getSpecies(content, m.speciesId);
          const best = Math.max(...sp.types.map((t) => typeEffectiveness(content.typeChart, t, boss.types)));
          const worst = Math.max(...boss.types.map((t) => typeEffectiveness(content.typeChart, t, sp.types)));
          return `${sp.name}: ${best >= 2 ? 'strong' : best < 1 ? 'weak' : 'even'} offence, ${worst >= 2 ? 'fragile' : worst < 1 ? 'sturdy' : 'steady'} defence`;
        });
        words.push(`${boss.title} uses ${boss.types.join('/')} Pokémon. ${lines.join('; ')}.`);
      }
      break;
    }
    case 'gift': {
      effects(ev.gift);
      markUsed(run, 'gift');
      words.unshift(ev.giftText);
      break;
    }
    case 'parcel': {
      effects([{ kind: 'money', amount: regionPrice(run, 700) }]);
      run.plaza.flags = run.plaza.flags.filter((f) => f !== `caravan:${a}`);
      addRep(run, 1);
      words.unshift('The parcel held a thank-you note.');
      break;
    }
    case 'rival': {
      effects([{ kind: 'item', id: 'super-potion', count: 2 }]);
      markUsed(run, 'rival:gift');
      addRep(run, 1);
      break;
    }
    case 'foe': {
      effects([{ kind: 'money', amount: regionPrice(run, 300) }]);
      markUsed(run, 'foe:thanks');
      addRep(run, 1);
      words.push('Word gets around that you play fair.');
      break;
    }
    case 'fac': {
      if (a === 'calm') {
        addRunAttribute(content, run, 'goodEvil', 1);
        addRep(run, 2);
        markUsed(run, 'fac:calm');
        words.push('The argument fizzles out. People noticed.');
        break;
      }
      const f = PLAZA.factions.find((x) => x.id === a)!;
      const o = f.offers.find((x) => x.id === b)!;
      effects(o.effects);
      markUsed(run, `fac:${a}:${b}`);
      addRep(run, 1);
      words.unshift(`${f.name}: ${o.title}.`);
      break;
    }
    case 'cv': {
      const c = PLAZA.caravans.find((x) => x.id === a)!;
      const o = c.offers.find((x) => x.id === b)!;
      if (o.need) needPay(content, run, o.need, rng);
      effects(o.effects);
      markUsed(run, `cv:${a}:${b}`);
      addRep(run, 1);
      if (c.followUp && !hasFlag(run, c.followUp)) run.plaza.flags.push(c.followUp);
      words.unshift(`${c.name}: ${o.title}.`);
      break;
    }
    case 'talk': {
      const r = regularOf(a!)!;
      const before = friend(run, a!);
      addFriend(run, a!, 1);
      markUsed(run, `talk:${a}`);
      if (before === 0) addRep(run, 1);
      const line = [...r.lines].reverse().find((l) => friend(run, a!) >= l.at)!.text;
      words.push(`${r.name}: "${line}"`);
      const perk = r.perk;
      if (perk && before < perk.at && friend(run, a!) >= perk.at) words.push(perk.text);
      break;
    }
    default:
      throw new Error(`Unknown option "${optionId}"`);
  }
  if (!battle) {
    run.plaza.visits += 1;
    if (run.pending.length > 0) {
      run.afterDecisions = 'map';
      continueAfterDecisions(content, run);
    }
  }
  return { run, message: words.filter(Boolean).join(' '), battle };
}
