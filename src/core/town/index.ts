// Pocket Town (W7): the Hub's town of small buildings. Every action is pure: it takes the profile and returns a new one.
// Rolls are hashes of the action and a saved counter, so a reload repeats the last result and no gameplay RNG stream moves.
// Rewards: Research Points, credits and café coins go straight to the profile; money, items, stuff and notes wait as the
// next run's "boon" (core/legacy.ts startGrants hands them over when a run starts). Numbers and text: data/town.json.

import { CAMP } from '../camp/schema';
import type { Content } from '../contentSchema';
import { GRADES, type Grade } from '../interaction/prompt';
import { hashSeed, Rng } from '../rng';
import type { Profile } from '../state';
import { TOWN, freshTown, type Reward, type TownAction, type TownBuilding, type TownOption, type TownProfile } from './schema';
import { bestMove, curseKnown, lastTeam, memorialList, miniBattle, ownedSet, pedestalBonus, pets as petList, primaryType, relicList, trophies as trophyList } from './views';
import { familyId } from '../mastery';

export * from './schema';
export * from './views';

export interface TownArgs {
  grade?: Grade;
  choice?: string;
  answer?: number;
  misses?: number;
  text?: string;
}
export interface TownResult { profile: Profile; message: string; ok: boolean; detail?: { rarity?: string; label?: string } }
class Problem extends Error {}
const fail = (text: string): never => { throw new Problem(text); };

export const townOf = (p: Pick<Profile, 'town'>): TownProfile => p.town ?? freshTown();
export const getBuilding = (id: string): TownBuilding | undefined => TOWN.buildings.find((b) => b.id === id);
export const getTownAction = (id: string): TownAction | undefined => TOWN.buildings.flatMap((b) => b.actions).find((a) => a.id === id);
export const buildingOf = (actionId: string): TownBuilding | undefined => TOWN.buildings.find((b) => b.actions.some((a) => a.id === actionId));

/** The player's local calendar day, "2026-11-01". The caller passes the clock. */
export const localDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const yesterday = (d: Date): string => localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));

const achievementsOf = (p: Profile): number => Object.keys(p.achievements ?? {}).length;
const winsOf = (p: Profile): number => p.runHistory.filter((r) => r.victory).length;

// ---------- gates ----------

export function needsProblem(p: Profile, needs: { achievements?: number; runs?: number; wins?: number; has?: [string, string]; visits?: number; text?: string } | undefined): string | null {
  if (!needs) return null;
  const t = townOf(p);
  if (needs.achievements !== undefined && achievementsOf(p) < needs.achievements) return needs.text ?? `Needs ${needs.achievements} achievements.`;
  if (needs.runs !== undefined && p.stats.runsStarted < needs.runs) return needs.text ?? `Needs ${needs.runs} runs started.`;
  if (needs.wins !== undefined && winsOf(p) < needs.wins) return needs.text ?? 'Needs a victory first.';
  if (needs.visits !== undefined && (t.counts.visits ?? 0) < needs.visits) return needs.text ?? `Visit the Town ${needs.visits} times.`;
  if (needs.has && !ownedSet(p, needs.has[0]).includes(needs.has[1])) return needs.text ?? 'Not yet.';
  return null;
}

export function buildingProblem(p: Profile, b: TownBuilding): string | null {
  return needsProblem(p, b.needs);
}

type Cost = { credits?: number; rp?: number; coins?: number; offerings?: number } | undefined;
function costProblem(p: Profile, cost: Cost): string | null {
  if (!cost) return null;
  const t = townOf(p);
  if ((cost.credits ?? 0) > p.bankCredits) return `Costs ${cost.credits} credits.`;
  if ((cost.rp ?? 0) > p.researchPoints) return `Costs ${cost.rp} Research Points.`;
  if ((cost.coins ?? 0) > (t.counts.coins ?? 0)) return `Costs ${cost.coins} café coins.`;
  if ((cost.offerings ?? 0) > (t.counts.offerings ?? 0)) return 'Needs an offering at the Shrine first.';
  return null;
}
function pay(p: Profile, t: TownProfile, cost: Cost): void {
  if (!cost) return;
  p.bankCredits -= cost.credits ?? 0;
  p.researchPoints -= cost.rp ?? 0;
  t.counts.coins = (t.counts.coins ?? 0) - (cost.coins ?? 0);
  t.counts.offerings = (t.counts.offerings ?? 0) - (cost.offerings ?? 0);
}

const isNight = (d: Date): boolean => d.getHours() >= 20 || d.getHours() < 6;
const dayCount = (t: TownProfile, key: string, today: string): number => { const v = t.daily[key]; return v && v.startsWith(`${today}:`) ? Number(v.split(':')[1]) : 0; };

/** Why an action cannot be used right now, or null. Used by the screen to grey rows out. */
export function townProblem(content: Content, p: Profile, a: TownAction, now: Date): string | null {
  const t = townOf(p);
  const today = localDay(now);
  const b = buildingOf(a.id);
  const bp = b ? buildingProblem(p, b) : null;
  if (bp) return bp;
  const np = needsProblem(p, a.needs);
  if (np) return np;
  if (a.id === 'night-firefly') {
    if (!isNight(now)) return 'Fireflies only come out at night (8 pm to 6 am).';
    if (dayCount(t, a.id, today) >= (a.max ?? 5)) return 'The fireflies have gone for tonight.';
  }
  if (a.limit === 'run' && t.spent.includes(a.id)) return 'Done for now. It opens again when you start a run.';
  if (a.limit === 'day' && a.kind !== 'quiz' && a.kind !== 'gacha' && t.daily[a.id] === today) return 'Done for today. Come back tomorrow.';
  if (a.kind === 'quiz' && dayCount(t, a.id, today) >= (a.max ?? 3)) return 'Out of questions for today.';
  void content;
  return costProblem(p, a.cost);
}

// ---------- rewards ----------

const rngFor = (t: TownProfile, key: string): Rng => new Rng(hashSeed(`town::${key}::${t.counter}`));

function addBoonItems(t: TownProfile, items: Record<string, number>): void {
  for (const [id, n] of Object.entries(items)) {
    if (n <= 0) continue;
    if (Object.keys(t.boon.items).length >= TOWN.caps.boonItems && !(id in t.boon.items)) continue;
    t.boon.items[id] = (t.boon.items[id] ?? 0) + n;
  }
}

/** Pays a reward. Returns the story line plus a short list of what it gave. */
export function applyReward(p: Profile, t: TownProfile, r: Reward | undefined, rng: Rng): string {
  if (!r) return '';
  const gives: string[] = [];
  if (r.rp) { p.researchPoints += r.rp; gives.push(`+${r.rp} Research`); }
  if (r.credits) { p.bankCredits += r.credits; p.lifetimeBankCredits += r.credits; gives.push(`+${r.credits} credits`); }
  if (r.coins) { t.counts.coins = (t.counts.coins ?? 0) + r.coins; gives.push(`+${r.coins} café coin${r.coins === 1 ? '' : 's'}`); }
  if (r.xp) { t.counts.season = (t.counts.season ?? 0) + r.xp; gives.push(`+${r.xp} track`); }
  if (r.money) { t.boon.money += r.money; gives.push(`₽${r.money} next run`); }
  if (r.items) { addBoonItems(t, r.items); gives.push(`${Object.entries(r.items).map(([k, n]) => `${n} ${k.replace(/-/g, ' ')}`).join(', ')} next run`); }
  if (r.stuff) { for (const [k, n] of Object.entries(r.stuff)) t.boon.stuff[k] = (t.boon.stuff[k] ?? 0) + n; gives.push(`${Object.keys(r.stuff).map((k) => k.replace(/-/g, ' ')).join(', ')} next run`); }
  if (r.counts) for (const [k, n] of Object.entries(r.counts)) t.counts[k] = (t.counts[k] ?? 0) + n;
  if (r.note) { t.boon.notes.push(r.note); t.boon.notes = t.boon.notes.slice(-TOWN.caps.notes); }
  if (r.unlock) {
    const owned = new Set(t.sets[r.unlock.set] ?? []);
    const free = r.unlock.pool.filter((id) => !owned.has(id));
    if (free.length > 0) {
      const id = rng.pick(free);
      (t.sets[r.unlock.set] ??= []).push(id);
      gives.push(`new ${r.unlock.set.replace(/s$/, '')}: ${id.replace(/^[a-z]+-/, '')}`);
    } else {
      p.researchPoints += 1;
      gives.push('all owned: +1 Research');
    }
  }
  const line = r.say ?? '';
  return `${line}${gives.length > 0 ? ` (${gives.join(' · ')})` : ''}`.trim();
}

// ---------- options ----------

export interface OptionView { id: string; label: string; desc: string; say: string; cost?: TownOption['cost']; reward?: Reward; once: boolean; needs?: TownOption['needs']; problem?: string | null }

/** The choices a pick/grade action shows right now (static, lore, or built from the profile). */
export function optionsOf(content: Content, p: Profile, a: TownAction, now: Date): OptionView[] {
  const t = townOf(p);
  const base = (o: TownOption): OptionView => ({ id: o.id, label: o.label, desc: o.desc, say: o.say, cost: o.cost, reward: o.reward, once: o.once, needs: o.needs });
  if (a.pool === 'lore') return TOWN.lore.map((l) => ({ id: l.id, label: l.title, desc: t.sets.books?.includes(l.id) ? 'Read' : 'Unread: pays 1 Research Point', say: l.text, once: true, reward: { rp: 1 } }));
  const tpl = a.template;
  const from = (id: string, name: string, desc: string, say = ''): OptionView => ({ id, label: name, desc, say: tpl?.say.replace(/\{name\}/g, name) || say, reward: tpl?.reward, once: tpl?.once ?? false, cost: tpl?.cost });
  switch (a.dynamic) {
    case 'lastTeam': return lastTeam(content, p).map((m) => from(m.speciesId, m.name, `Lv${m.level} · ${m.types.join('/')}`));
    case 'history': return p.runHistory.slice(0, 8).map((r, i) => from(r.runId, `Run ${p.runHistory.length - i}: ${r.victory ? 'Champion' : r.defeatedBy ? `lost to ${content.species.get(r.defeatedBy.speciesId)?.name ?? r.defeatedBy.speciesId}` : 'ended'}`, `${r.regionsCleared}/${r.regions} regions · ${r.badges} badges`));
    case 'trophies': return trophyList(p).map((tr) => from(tr.id, tr.name, `${tr.kind} · shine ${t.counts[`polish:${tr.id}`] ?? 0}`));
    case 'relics': return relicList(p).map((r) => from(r.key, r.name, r.cursed ? 'Cursed relic' : `Tier ${r.tier}`));
    case 'museum': return relicList(p).map((r) => { const on = (t.sets.pedestal ?? []).includes(r.key); return from(r.key, r.name, `${on ? 'On a pedestal · ' : ''}Tier ${r.tier}${r.cursed ? ' · cursed' : ''}`); });
    case 'pets': return petList(content, p).map((x) => from(x.speciesId, x.name, `Bond ${t.counts[`pet:${x.speciesId}`] ?? 0}/${TOWN.pets.bondAt}`));
    case 'memorial': return memorialList(content, p).map((m) => from(String(m.index), `${m.name} Lv${m.level}${m.ace ? ' ★' : ''}`, `${m.cause} · ${t.counts[`flower:${m.index}`] ?? 0} flowers`));
    case 'items': return t.lost.map((id, i) => ({ id: `${i}:${id}`, label: id.replace(/-/g, ' '), desc: 'Left behind', say: 'It is waiting for you.', once: false }));
    case 'mail': return mailToday(content, p, now).map((m) => ({ id: m.id, label: `${m.from}${t.sets.mail?.includes(m.id) ? '' : ' (new)'}`, desc: m.text.slice(0, 70), say: m.text, once: true, reward: m.gift }));
    default: return a.options.map(base);
  }
}

export interface Mail { id: string; from: string; text: string; gift?: Reward }
/** Today's three letters: a seeded draw from the letter pool, plus the rival's note when a rival wrote. */
export function mailToday(content: Content, p: Profile, now: Date): Mail[] {
  const rng = new Rng(hashSeed(`town::mail::${localDay(now)}`));
  const pool = [...TOWN.letters];
  const out: Mail[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) { const l = pool.splice(rng.int(0, pool.length - 1), 1)[0]!; out.push({ id: `${l.id}@${localDay(now)}`, from: l.from, text: l.text, gift: l.gift }); }
  const species = p.speciesCaught.length > 0 ? p.speciesCaught[rng.int(0, p.speciesCaught.length - 1)]! : null;
  if (species) out.push({ id: `wild-${species}@${localDay(now)}`, from: `A wild ${content.species.get(species)?.name ?? species}`, text: 'It left a muddy paw print and a pretty stone.', gift: { xp: 1, say: 'A pretty stone: +1 track point.' } });
  return out;
}

// ---------- the action runner ----------

type Ctx = { content: Content; p: Profile; t: TownProfile; a: TownAction; args: TownArgs; now: Date; today: string };
const reward = (c: Ctx, r: Reward | undefined, key = c.a.id): string => applyReward(c.p, c.t, r, rngFor(c.t, key));
const gradeOf = (g: Grade | undefined): Grade => (g && (GRADES as readonly string[]).includes(g) ? g : 'miss');

function optionChoice(c: Ctx): OptionView {
  const list = optionsOf(c.content, c.p, c.a, c.now);
  const o = list.find((x) => x.id === c.args.choice);
  if (!o) fail('Pick something first.');
  return o!;
}

function runGrade(c: Ctx): string {
  const g = gradeOf(c.args.grade);
  if (c.a.dynamic) optionChoice(c);
  if (c.a.id === 'trophy-polish') {
    const steps = { miss: 0, ok: 1, good: 2, perfect: 3 }[g];
    c.t.counts[`polish:${c.args.choice}`] = (c.t.counts[`polish:${c.args.choice}`] ?? 0) + steps;
  }
  if (c.a.id === 'dojo-spar') {
    const mon = lastTeam(c.content, c.p).find((m) => m.speciesId === c.args.choice);
    const move = mon ? bestMove(c.content, mon.speciesId, mon.level) : null;
    if (move) { const uses = { miss: 1, ok: 3, good: 5, perfect: 8 }[g]; c.p.moveUses = { ...(c.p.moveUses ?? {}), [move]: (c.p.moveUses?.[move] ?? 0) + uses }; }
  }
  if (c.a.id === 'night-firefly') c.t.daily[c.a.id] = `${c.today}:${dayCount(c.t, c.a.id, c.today) + 1}`;
  let r = c.a.rewards![g];
  if (c.a.id === 'stage-contest' && g !== 'miss') {
    const mon = lastTeam(c.content, c.p).find((m) => m.speciesId === c.args.choice);
    const cat = TOWN.contest.find((x) => x.types.includes(mon ? primaryType(mon) : '')) ?? TOWN.contest[1]!;
    return `${cat.name} contest. ${reward(c, r)}`;
  }
  if (c.a.id === 'mirror-contest') r = { ...r, credits: (r.credits ?? 0) + Math.min(10, (c.t.sets.outfits ?? []).length * 2) };
  return reward(c, r);
}

function runPick(c: Ctx): string {
  const o = optionChoice(c);
  const cost = o.cost ?? c.a.cost;
  const cp = costProblem(c.p, cost);
  if (cp) fail(cp);
  const np = needsProblem(c.p, o.needs);
  if (np) fail(np);
  const key = `${c.a.id}:${o.id}`;
  const first = !c.t.done.includes(key);
  let r = o.reward;
  const id = c.a.id;
  // actions with their own rules
  if (id === 'wishing-tag') {
    if (c.t.wishes.length >= TOWN.caps.wishes) fail('The tree already holds three tags.');
    c.t.wishes.push(r?.note ?? o.label);
    return `${o.say} You hang the tag "${o.label}".`;
  }
  if (id === 'shrine-offer') {
    const rel = relicList(c.p).find((x) => x.key === o.id);
    if (!rel) return fail('That relic is gone.');
    c.t.sets.relics = (c.t.sets.relics ?? []).filter((k) => k !== o.id);
    (c.t.sets.offered ??= []).push(o.id);
    c.t.sets.pedestal = (c.t.sets.pedestal ?? []).filter((k) => k !== o.id);
    c.t.counts.offerings = (c.t.counts.offerings ?? 0) + 1;
    const bless = rel.cursed ? ' The curse leaves it with a sigh; Shrine Water joins your pack.' : '';
    if (rel.cursed) c.t.boon.stuff['shrine-water'] = (c.t.boon.stuff['shrine-water'] ?? 0) + 1;
    return `${rel.name} rests on the altar.${bless} You earned an offering. ${reward(c, { xp: 1 })}`;
  }
  if (id === 'museum-pedestal') {
    const on = c.t.sets.pedestal ?? [];
    if (on.includes(o.id)) { c.t.sets.pedestal = on.filter((k) => k !== o.id); return 'You take it off the pedestal.'; }
    if (on.length >= 3) fail('All three pedestals are full. Pick a placed relic to take it off.');
    c.t.sets.pedestal = [...on, o.id];
    const b = pedestalBonus(c.p, c.t);
    return `Placed. Set bonus now: ₽${b.money}${b.items ? ` and ${Object.entries(b.items).map(([k, n]) => `${n} ${k}`).join(', ')}` : ''} each run.`;
  }
  if (id === 'daycare-collect') {
    if (c.t.daycare.length === 0) fail('Nobody is staying at the Daycare. Leave a Pokémon first.');
    if ((c.t.counts.dayAge ?? 0) < 2) fail('The egg is not ready. It takes two runs after you leave a Pokémon.');
    const parent = rngFor(c.t, key).pick(c.t.daycare);
    const species = familyId(c.content, parent);
    c.t.boon.eggs.push(species);
    c.t.daycare = [];
    c.t.counts.dayAge = 0;
    return `The caretaker hands you an egg from the ${c.content.species.get(species)?.name} family. It will be in your party at the start of the next run. ${reward(c, r)}`;
  }
  if (id === 'daycare-leave') {
    if (c.t.daycare.length >= 2 && !c.t.daycare.includes(o.id)) fail('The Daycare holds two. Collect the egg first.');
    if (!c.t.daycare.includes(o.id)) c.t.daycare.push(o.id);
    c.t.counts.dayAge = 0;
    return `${o.label} settles in at the Daycare. Come back two runs from now.`;
  }
  if (id === 'lost-claim') {
    const idx = Number(o.id.split(':')[0]);
    const item = c.t.lost[idx];
    if (!item) fail('It is gone.');
    c.t.lost.splice(idx, 1);
    addBoonItems(c.t, { [item!]: 1 });
    return `You take the ${item!.replace(/-/g, ' ')}. It will ride with you next run.`;
  }
  if (id === 'pets-play') {
    const dk = `pet:${o.id}`;
    if (c.t.daily[dk] === c.today) fail('They have played enough for today.');
    c.t.daily[dk] = c.today;
    c.t.counts[dk] = (c.t.counts[dk] ?? 0) + 1;
    const line = rngFor(c.t, dk).pick(TOWN.pets.chatter).replace(/\{name\}/g, o.label);
    if (c.t.counts[dk] === TOWN.pets.bondAt) { pay(c.p, c.t, cost); return `${line} Your bond is strong now! ${reward(c, { items: { 'soothe-bell': 1 }, rp: 1, say: 'A gift for you.' })}`; }
    return `${line} ${reward(c, r)}`;
  }
  if (id === 'fireplace-chat') {
    const mon = lastTeam(c.content, c.p).find((m) => m.speciesId === o.id);
    const pool = TOWN.vignettes[mon ? primaryType(mon) : 'default'] ?? TOWN.vignettes.default!;
    const line = rngFor(c.t, key).pick(pool).replace(/\{name\}/g, o.label);
    c.t.done.push(key);
    return `${line} ${first ? reward(c, r) : ''}`.trim();
  }
  if (id === 'arcade-duel' || id === 'replica-mirror') {
    const mon = lastTeam(c.content, c.p).find((m) => m.speciesId === o.id);
    if (!mon) return fail('Pick a Pokémon from your last team.');
    const rng = rngFor(c.t, key);
    const foe = id === 'replica-mirror' ? { speciesId: mon.speciesId, level: mon.level } : { speciesId: rng.pick([...c.content.species.values()].filter((x) => x.evolutionStage === 1 && !x.form).map((x) => x.id)), level: Math.max(5, mon.level - 2 + rng.int(0, 4)) };
    const res = miniBattle(c.content, { speciesId: mon.speciesId, level: mon.level }, foe, rng);
    const head = id === 'replica-mirror' ? `${mon.name}'s ghost steps out of the mirror.` : `${mon.name} faces a Lv${foe.level} ${c.content.species.get(foe.speciesId)?.name}.`;
    return res.win ? `${head} ${res.log.slice(-2).join(' ')} You win in ${res.rounds} rounds! ${reward(c, r)}` : `${head} ${res.log.slice(-2).join(' ')} You lose this one after ${res.rounds} rounds.`;
  }
  if (id === 'memorial-flower') {
    const dk = `flower:${o.id}`;
    if (c.t.daily[dk] === c.today) fail('You already left a flower here today.');
    c.t.daily[dk] = c.today;
    c.t.counts[dk] = (c.t.counts[dk] ?? 0) + 1;
    return `${o.say} ${c.t.counts[dk] === 1 ? reward(c, r) : ''}`.trim();
  }
  if (id === 'replica-duel' || id === 'time-whatif' || id === 'cinema-play') {
    const run = c.p.runHistory.find((x) => x.runId === o.id);
    if (!run) return fail('That run is gone.');
    const rr = run!;
    if (id === 'cinema-play') { c.t.done.push(key); return `${rr.moments.slice(0, 3).join(' ') || 'A quiet run with no big moments.'} ${first ? reward(c, r) : ''}`.trim(); }
    if (id === 'time-whatif') { c.t.done.push(key); const alt = rngFor(c.t, key).pick(['You picked the other path at the fork. Everything was calmer, and a little duller.', 'You rested one more night. The rival you lost to never found you.', 'You switched your lead before the last fight. It almost, almost worked.', 'You skipped the shop and kept your money. It bought you one more Revive at the end.', 'You took the shortcut. A trainer was waiting. You won, but were late for supper.']); return `${alt} ${first ? reward(c, r) : ''}`.trim(); }
    const lead = [...rr.party].sort((a, b) => b.level - a.level)[0];
    const ghost = rr.defeatedBy ? { speciesId: rr.defeatedBy.speciesId, level: rr.defeatedBy.level } : lead ? { speciesId: lead.speciesId, level: lead.level } : null;
    if (!lead || !ghost || !c.content.species.has(ghost.speciesId)) return fail('That run left no ghost to face.');
    const res = miniBattle(c.content, { speciesId: lead.speciesId, level: lead.level }, ghost, rngFor(c.t, key));
    const tag = `${c.content.species.get(lead.speciesId)?.name} Lv${lead.level} vs the ghost ${c.content.species.get(ghost.speciesId)?.name} Lv${ghost.level}.`;
    return res.win ? `${tag} ${res.log.slice(-2).join(' ')} Practice win in ${res.rounds} rounds! ${reward(c, r)}` : `${tag} ${res.log.slice(-2).join(' ')} The ghost wins this time. Try again next run.`;
  }
  if (id === 'mail-read') {
    c.t.sets.mail = [...new Set([...(c.t.sets.mail ?? []), o.id])];
    c.t.done.push(key);
    return `${o.say} ${first ? reward(c, r) : ''}`.trim();
  }
  if (id === 'library-read') {
    (c.t.sets.books ??= []).includes(o.id) || c.t.sets.books.push(o.id);
    if (first) c.t.done.push(key);
    return `${o.say} ${first ? reward(c, r) : ''}`.trim();
  }
  if (o.once && !first) r = undefined;
  if (o.once) c.t.done.push(key);
  pay(c.p, c.t, cost);
  return `${o.say} ${reward(c, r)}`.trim();
}

function runBuy(c: Ctx): string {
  const good = c.a.goods.find((x) => x.id === c.args.choice);
  if (!good) return fail('Pick something to buy.');
  const g = good!;
  const np = needsProblem(c.p, g.needs);
  if (np) fail(np);
  if (g.set !== 'boon' && (c.t.sets[g.set] ?? []).includes(g.id)) fail('You already own that.');
  const cp = costProblem(c.p, g.cost);
  if (cp) fail(cp);
  pay(c.p, c.t, g.cost);
  if (g.set === 'boon') return `Done. ${reward(c, { ...g.reward, say: `${g.label} will be in your pack next run.` })}`;
  (c.t.sets[g.set] ??= []).push(g.id);
  return `Bought ${g.label}.`;
}

function runEquip(c: Ctx): string {
  const set = c.a.set!;
  const owned = ownedSet(c.p, set);
  const id = c.args.choice ?? '';
  if (!owned.includes(id)) fail('You do not own that yet.');
  if (c.a.slot === 'case') {
    const now = (c.t.equipped.case ?? '').split(',').filter(Boolean);
    const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
    if (next.length > 3) fail('The badge case holds three. Take one out first.');
    c.t.equipped.case = next.join(',');
    return now.includes(id) ? 'Badge removed from the case.' : `Badge added. Perk: ${TOWN.badgePerks[badgeType(c.content, id)]?.say ?? 'none'}`;
  }
  c.t.equipped[c.a.slot!] = c.t.equipped[c.a.slot!] === id ? '' : id;
  return c.t.equipped[c.a.slot!] ? 'Equipped.' : 'Taken off.';
}

/** A badge's type (from the boss who gave it), for the badge case perk. */
export function badgeType(content: Content, bossId: string): string {
  return content.bosses.get(bossId)?.types?.[0] ?? 'normal';
}

function runQuiz(c: Ctx): string {
  const pool = TOWN.quizzes[c.a.pool!] ?? [];
  const n = dayCount(c.t, c.a.id, c.today);
  const rng = new Rng(hashSeed(`town::quiz::${c.a.id}::${c.today}::${n}`));
  const q = pool[rng.int(0, pool.length - 1)]!;
  const right = c.args.answer === q.right;
  const streak = dayCount(c.t, `${c.a.id}:ok`, c.today);
  c.t.daily[c.a.id] = `${c.today}:${n + 1}`;
  c.t.daily[`${c.a.id}:ok`] = `${c.today}:${right ? streak + 1 : 0}`;
  const g: Grade = !right ? 'miss' : streak === 0 ? 'ok' : streak === 1 ? 'good' : 'perfect';
  return `${right ? 'Correct!' : `Not quite: ${q.a[q.right]}.`} ${q.why} ${reward(c, c.a.rewards![g])}`.replace(/\s+/g, ' ').trim();
}

/** Today's quiz question (the screen shows it before asking for an answer). */
export function quizQuestion(p: Profile, a: TownAction, now: Date): { q: string; a: string[] } | null {
  const t = townOf(p);
  const today = localDay(now);
  const pool = TOWN.quizzes[a.pool ?? ''] ?? [];
  if (pool.length === 0) return null;
  const q = pool[new Rng(hashSeed(`town::quiz::${a.id}::${today}::${dayCount(t, a.id, today)}`)).int(0, pool.length - 1)]!;
  return { q: q.q, a: q.a };
}

function runTend(c: Ctx): string {
  const [slot, op, crop] = (c.args.choice ?? '').split(':');
  const field = c.a.field!;
  const key = `${field}:${slot}`;
  if (!slot || Number(slot) >= c.a.plots) fail('Pick a bed first.');
  const plot = c.t.plots[key];
  if (op === 'plant') {
    if (plot) fail('That bed is already planted.');
    const def = c.a.crops.find((x) => x.id === crop);
    if (!def) return fail('Pick a seed.');
    const cp = costProblem(c.p, def!.cost);
    if (cp) fail(cp);
    pay(c.p, c.t, def!.cost);
    c.t.plots[key] = { crop: def!.id, stage: 0, wet: true };
    return `You plant ${def!.label} and water it.`;
  }
  if (!plot) fail('Nothing is planted there.');
  const def = c.a.crops.find((x) => x.id === plot!.crop)!;
  if (op === 'water') {
    if (plot!.stage >= def.grow) fail('It is fully grown. Harvest it.');
    if (plot!.wet) fail('It is already watered. It grows when you start a run.');
    plot!.wet = true;
    return `You water the ${def.label}.`;
  }
  if (op === 'harvest') {
    if (plot!.stage < def.grow) fail(`Not ripe yet: ${def.stages[Math.min(plot!.stage, def.stages.length - 1)]}.`);
    delete c.t.plots[key];
    const bonus = field === 'aquarium' && (c.t.sets.tank ?? []).length >= 3 ? { rp: 1 } : {};
    return reward(c, { ...def.yield, ...bonus });
  }
  return fail('Unknown garden action.');
}

function runPuzzle(c: Ctx): string {
  const t = c.t;
  const vault = (k: string): number => (t.puzzle[k]?.[0] ?? 0);
  if (c.a.puzzle === 'sequence') {
    const code = basementCode(t);
    const guess = (c.args.choice ?? '').split(',').filter(Boolean);
    const hits = guess.filter((g, i) => g === code[i]).length;
    if (guess.length !== code.length) fail(`Enter all ${code.length} cries.`);
    if (hits < code.length) return `The door hums. ${hits} of ${code.length} cries were in the right place.`;
    t.puzzle.basement = [vault('basement') + 1];
    (t.sets.secrets ??= []).includes('basement') || t.sets.secrets.push('basement');
    return `The basement door swings open! ${reward(c, { rp: 3, items: { 'rare-candy': 1, 'lucky-egg': 1 }, xp: 2, say: 'A vault of old toys and one very shiny candy.' })}`;
  }
  if (c.a.puzzle === 'rotate') {
    const target = statueTarget(t);
    const cur = t.puzzle.statues ?? [0, 0, 0, 0];
    const i = Number(c.args.choice);
    if (!(i >= 0 && i < 4)) fail('Pick a statue.');
    cur[i] = (cur[i]! + 1) % 4;
    t.puzzle.statues = cur;
    const hits = cur.filter((v, k) => v === target[k]).length;
    if (hits < 4) return `The statue grinds around. ${hits} of 4 face the right way.`;
    t.puzzle.vault = [vault('vault') + 1];
    t.puzzle.statues = [0, 0, 0, 0];
    return `The vault clicks open! ${reward(c, { rp: 2, credits: 25, items: { 'rare-candy': 1 }, xp: 2, say: 'Inside: a glittering trinket and a Rare Candy.' })}`;
  }
  // match: kitchen (recipes) or memory cards
  if (c.a.pool === 'recipes') {
    const [x, y] = (c.args.choice ?? '').split('|');
    if (!x || !y) fail('Pick two ingredients.');
    const rec = TOWN.recipes.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x));
    if (rec) { (t.sets.recipes ??= []).includes(rec.id) || t.sets.recipes.push(rec.id); return `${rec.name}! ${reward(c, rec.reward)}`; }
    return `Hmm… ${reward(c, TOWN.mush)}`;
  }
  const misses = Math.max(0, Math.floor(c.args.misses ?? 99));
  const g: Grade = misses <= 3 ? 'perfect' : misses <= 6 ? 'good' : misses <= 10 ? 'ok' : 'miss';
  return reward(c, c.a.rewards![g]);
}

/** The basement's cry code for the current vault (the screen plays the cries). */
export function basementCode(t: TownProfile): string[] {
  const rng = new Rng(hashSeed(`town::basement::${t.puzzle.basement?.[0] ?? 0}`));
  return Array.from({ length: 4 }, () => rng.pick(TOWN.pools.cries));
}
/** The statue facings that open the vault. */
export function statueTarget(t: TownProfile): number[] {
  const rng = new Rng(hashSeed(`town::statues::${t.puzzle.vault?.[0] ?? 0}`));
  return Array.from({ length: 4 }, () => rng.int(0, 3));
}

function runGacha(c: Ctx): string {
  const cfg = TOWN.gacha;
  const free = c.t.daily['gacha-free'] !== c.today;
  if (!free) { const cp = costProblem(c.p, cfg.cost); if (cp) fail(cp); pay(c.p, c.t, cfg.cost); }
  else c.t.daily['gacha-free'] = c.today;
  const rng = rngFor(c.t, 'gacha');
  c.t.counter += 1;
  c.t.counts.pity = (c.t.counts.pity ?? 0) + 1;
  const forced = c.t.counts.pity >= cfg.pity;
  const pools = forced ? cfg.pools.filter((x) => x.rarity !== 'common') : cfg.pools;
  const pool = rng.weighted(pools.map((x) => ({ item: x, weight: x.weight })));
  if (pool.rarity !== 'common') c.t.counts.pity = 0;
  const prize = rng.pick(pool.goods);
  const have = (c.t.sets[prize.set] ?? []).includes(prize.id) || (prize.set === 'decor' && false);
  const tag = `${pool.rarity.toUpperCase()}: ${prize.label}`;
  if (prize.set === 'tracks') (c.t.sets.tracks ??= []).includes(prize.id) || c.t.sets.tracks.push(prize.id);
  if (have) return `${tag}. ${reward(c, cfg.dupe)}`;
  if (prize.set !== 'tracks') (c.t.sets[prize.set] ??= []).push(prize.id);
  return `${tag}! ${free ? '(free daily capsule)' : ''}`.trim();
}

function runDaily(c: Ctx): string {
  const view = c.a.view;
  if (view === 'season') {
    const month = c.now.getMonth() + 1;
    const s = TOWN.seasons.find((x) => x.months.includes(month)) ?? TOWN.seasons[0]!;
    c.t.daily[c.a.id] = c.today;
    return `${s.tap} ${reward(c, s.reward)}`;
  }
  if (view === 'gift') {
    const streak = c.t.daily['gift-day'] === yesterday(c.now) ? (c.t.counts.giftStreak ?? 0) + 1 : 1;
    c.t.counts.giftStreak = streak;
    c.t.daily['gift-day'] = c.today;
    const gift = TOWN.dailyGifts[c.now.getDay() % TOWN.dailyGifts.length]!;
    return `${reward(c, { ...gift, credits: (gift.credits ?? 0) + Math.min(14, streak) * 2 })} Streak: ${streak} day${streak === 1 ? '' : 's'}.`;
  }
  const quest = todaysQuests(c.t, c.today).find((x) => x.id === c.args.choice);
  if (!quest) return fail('Pick a quest.');
  if (c.t.daily[`claim:${quest!.id}`] === c.today) fail('Already claimed.');
  if (c.t.daily[`used:${quest!.action}`] !== c.today) fail('Do the task first.');
  c.t.daily[`claim:${quest!.id}`] = c.today;
  return reward(c, { ...quest!.reward, say: 'Quest done!' });
}

/** The three quests of the day, picked by local date. */
export function todaysQuests(t: TownProfile, today: string): (typeof TOWN.dailyQuests)[number][] {
  void t;
  const rng = new Rng(hashSeed(`town::quests::${today}`));
  const pool = [...TOWN.dailyQuests];
  return Array.from({ length: 3 }, () => pool.splice(rng.int(0, pool.length - 1), 1)[0]!);
}

function runPlace(c: Ctx): string {
  const view = c.a.view;
  const choice = c.args.choice ?? '';
  if (view === 'pin') {
    if (c.t.pins.includes(choice)) { c.t.pins = c.t.pins.filter((x) => x !== choice); return 'Unpinned.'; }
    if (!choice) fail('Pick a contract.');
    if (c.t.pins.length >= TOWN.caps.pins) fail('The board holds three pins. Unpin one first.');
    c.t.pins.push(choice);
    return 'Pinned to the top of the board.';
  }
  if (view === 'graffiti') {
    const allowed = 1 + winsOf(c.p);
    const signed = c.t.counts.signatures ?? 0;
    if (signed >= allowed) fail('One signature per win, plus one for visiting. Win a run for another.');
    if (!/^#[0-9a-fA-F]{6}\|(?:[a-z]+|d:[0-9.,;:]{1,700})$/.test(choice)) fail('Pick a color and a stamp, or draw something.');
    c.t.wall = [...c.t.wall, choice].slice(-TOWN.caps.graffiti);
    c.t.counts.signatures = signed + 1;
    return reward(c, { xp: 1, say: 'You tag the wall. It dries instantly.' });
  }
  // decor: "id|x|y" places, "id|remove" takes back
  const [id, x, y] = choice.split('|');
  if (!id || !ownedSet(c.p, 'decor').includes(id)) fail('You do not own that piece.');
  if (x === 'remove') { delete c.t.placed[id!]; return 'Put away.'; }
  const nx = Math.max(0, Math.min(1, Number(x))), ny = Math.max(0, Math.min(1, Number(y)));
  if (Number.isNaN(nx) || Number.isNaN(ny)) fail('Bad position.');
  c.t.placed[id!] = [nx, ny];
  return 'Placed.';
}

function runView(c: Ctx): string {
  const v = c.a.view;
  if (v === 'jokes') {
    const first = !c.t.done.includes('jokes');
    c.t.done.push('jokes');
    c.t.counts.jokes = (c.t.counts.jokes ?? 0) + 1;
    return `${TOWN.jokes[(c.t.counts.jokes - 1) % TOWN.jokes.length]} ${first ? reward(c, { rp: 2, say: 'Bonus for finding the room.' }) : ''}`.trim();
  }
  if (v === 'track') {
    const xp = c.t.counts.season ?? 0;
    const claimed = c.t.sets.track ?? [];
    const next = TOWN.track.find((tr) => tr.xp <= xp && !claimed.includes(tr.label));
    if (!next) fail('Nothing to claim yet.');
    (c.t.sets.track ??= []).push(next!.label);
    return `${next!.label}: ${reward(c, next!.reward)}`;
  }
  if (v === 'elevator') {
    const f = TOWN.floors.find((x) => x.id === c.args.choice);
    if (!f) fail('Pick a floor.');
    return f!.scene;
  }
  return '';
}

const HANDLERS: Record<TownAction['kind'], (c: Ctx) => string> = {
  grade: runGrade, pick: runPick, buy: runBuy, equip: runEquip, quiz: runQuiz, tend: runTend, puzzle: runPuzzle, gacha: runGacha, daily: runDaily, view: runView, place: runPlace,
};

/** Runs one town action. Returns the new profile, or the problem. The caller passes the clock. */
export function townAction(content: Content, profile: Profile, actionId: string, args: TownArgs = {}, now: Date = new Date()): TownResult {
  const a = getTownAction(actionId);
  if (!a) return { profile, message: `Unknown town action "${actionId}".`, ok: false };
  const problem = townProblem(content, profile, a, now);
  if (problem) return { profile, message: problem, ok: false };
  const p = structuredClone(profile);
  const t = townOf(p);
  p.town = t;
  const c: Ctx = { content, p, t, a, args, now, today: localDay(now) };
  try {
    const message = HANDLERS[a.kind](c);
    // rolls move the counter; one-per-run and one-per-day actions are marked used
    if (a.kind !== 'gacha') t.counter += 1;
    if (a.limit === 'run') t.spent.push(a.id);
    if (a.limit === 'day' && a.kind !== 'quiz' && a.kind !== 'gacha') t.daily[a.id] = c.today;
    t.daily[`used:${a.id}`] = c.today;
    t.counts.visits = t.counts.visits ?? 0;
    if (a.kind === 'daily' && a.view === 'quests') t.daily[`used:${a.id}`] = c.today;
    return { profile: p, message, ok: true, detail: a.kind === 'gacha' ? { label: message } : undefined };
  } catch (e) {
    if (e instanceof Problem) return { profile, message: e.message, ok: false };
    throw e;
  }
}

/** Counts a visit to a building (the elevator opens floors, the passage under the bed opens at 20 visits). Returns a new profile. */
export function visitBuilding(profile: Profile, buildingId: string): Profile {
  const p = structuredClone(profile);
  const t = townOf(p);
  p.town = t;
  t.counts.visits = (t.counts.visits ?? 0) + 1;
  t.counts[`visit:${buildingId}`] = (t.counts[`visit:${buildingId}`] ?? 0) + 1;
  return p;
}

// ---------- run start and run end ----------

export interface TownGrants { eggs: string[]; money: number; items: Record<string, number>; stuff: Record<string, number>; notes: string[] }

/** What the town hands a new run: the waiting boon, the wishes, the badge case perks and the museum pedestals. */
export function townStartGrants(content: Content, p: Profile): TownGrants {
  const t = townOf(p);
  const out: TownGrants = { eggs: [...t.boon.eggs], money: t.boon.money, items: { ...t.boon.items }, stuff: { ...t.boon.stuff }, notes: [...t.boon.notes, ...t.wishes] };
  const add = (r: Reward | undefined): void => {
    if (!r) return;
    out.money += r.money ?? 0;
    for (const [k, n] of Object.entries(r.items ?? {})) out.items[k] = (out.items[k] ?? 0) + n;
    for (const [k, n] of Object.entries(r.stuff ?? {})) out.stuff[k] = (out.stuff[k] ?? 0) + n;
  };
  for (const id of (t.equipped.case ?? '').split(',').filter(Boolean)) add(TOWN.badgePerks[badgeType(content, id)]);
  const b = pedestalBonus(p, t);
  out.money += b.money;
  for (const [k, n] of Object.entries(b.items ?? {})) out.items[k] = (out.items[k] ?? 0) + n;
  for (const id of Object.keys(out.items)) if (!(content.items.has(id) || content.catalog.has(id)) || (out.items[id] ?? 0) <= 0) delete out.items[id];
  return out;
}

/** After a run starts: the boon and wishes are used up, "once per run" actions open again, and plants grow a stage. Returns a new profile. */
export function spendTownStart(profile: Profile): Profile {
  if (!profile.town) return profile;
  const p = structuredClone(profile);
  const t = p.town!;
  t.boon = { eggs: [], money: 0, items: {}, stuff: {}, notes: [] };
  if (t.daycare.length > 0) t.counts.dayAge = (t.counts.dayAge ?? 0) + 1;
  t.wishes = [];
  t.spent = [];
  for (const plot of Object.values(t.plots)) {
    const def = TOWN.buildings.flatMap((b) => b.actions).flatMap((a) => a.crops).find((x) => x.id === plot.crop);
    if (plot.wet && def) plot.stage = Math.min(def.grow, plot.stage + 1);
    plot.wet = false;
  }
  t.counts.season = (t.counts.season ?? 0) + 1;
  return p;
}

/** At the end of a run: the town reacts (weather, relics seen, items left behind, track points). Mutates `profile`. */
export function recordTownRun(content: Content, profile: Profile, run: { runId: string; seed: string; victory: boolean; regionIndex?: number; inventory: Record<string, number>; camp?: { relics: { id: string; cursed: boolean }[] }; nuzlocke?: { memorial: { speciesId: string; level: number; ace: boolean; cause: string }[] }; party?: { speciesId: string; level: number; hp: number; care?: { ace?: boolean } }[] }): void {
  const t = townOf(profile);
  profile.town = t;
  t.last = { victory: run.victory, cleared: run.regionIndex ?? 0, runId: run.runId };
  t.counts.season = (t.counts.season ?? 0) + (run.victory ? 3 : 1);
  for (const r of run.camp?.relics ?? []) {
    const def = CAMP.relics.find((x) => x.id === r.id);
    if (!def) continue;
    const key = r.cursed || curseKnown(t, r.id) ? `${r.id}!` : r.id;
    const have = new Set([...(t.sets.relics ?? []), ...(t.sets.offered ?? [])]);
    if (!have.has(key) && !have.has(r.id) && !have.has(`${r.id}!`)) (t.sets.relics ??= []).push(key);
  }
  // Memorial Wall: Nuzlocke losses, and aces that fell in any run.
  const stone = (sp: string, lvl: number, ace: boolean, cause: string): string => `${sp}|${lvl}|${ace ? 1 : 0}|${cause}`;
  for (const m of run.nuzlocke?.memorial ?? []) t.memorial.push(stone(m.speciesId, m.level, m.ace, m.cause));
  for (const m of run.party ?? []) if (m.hp <= 0 && m.care?.ace === true && !(run.nuzlocke?.memorial ?? []).some((x) => x.speciesId === m.speciesId && x.level === m.level)) t.memorial.push(stone(m.speciesId, m.level, true, 'Fell in battle'));
  t.memorial = t.memorial.slice(-60);
  const rng = new Rng(hashSeed(`town::lost::${run.seed}`));
  const left = Object.entries(run.inventory).filter(([id, n]) => n > 0 && (content.items.has(id) || content.catalog.has(id)));
  for (let i = 0; i < 2 && left.length > 0; i++) {
    const [id] = left.splice(rng.int(0, left.length - 1), 1)[0]!;
    t.lost.push(id);
  }
  t.lost = t.lost.slice(-8);
}
void bestMove;
