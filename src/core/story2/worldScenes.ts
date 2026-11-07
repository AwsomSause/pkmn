// Story Run world scenes (Design v2 Part XI, II-F, II "Party chemistry"): the 30 event templates, the Eevee Crossroads offers
// and camp scenes. They play only at Stops the backstory, rivals, the Starter arc and quest arcs left free (module.ts asks last).
//  - Recovery Stops: an Eevee Crossroads offer (an Eevee of `eeveeLevel`+ in the party, a form whose type it has met), else a
//    camp scene for the first party pair with a chemistry type.
//  - Other Stops: the next event template whose Act and needs hold, in a stable per-run order, `templatesPerAct` per Act.
// Pure and deterministic: no RNG stream (a string hash orders the templates), nothing depends on the screen.

import type { Content } from '../contentSchema';
import type { PokemonInstance, RunState } from '../state';
import type { StoryEvent, StoryV2 } from './schema';
import { temperamentOf, type TemperamentId } from './temperament';
import { personalityOfMon } from '../overhaul/personality';
import { affinityOf, peekPair, stageIndex } from '../partyLife';
import { maxHp } from '../pokemon';
import { displayName } from '../care';
import { evolve } from '../evolution';
import { getTheme } from '../themes';

type Stop = NonNullable<StoryV2['blueprint']>['stops'][number];

/** The 12 chemistry types (Design v2 Part II, Party chemistry), in the order they are checked. */
export const CHEMISTRY_TYPES = ['inseparable', 'rivalry', 'mentor', 'protective', 'dislike', 'jealousy', 'comfort', 'daredevil', 'odd_couple', 'caretaker', 'idol', 'old_friends'] as const;
export type ChemistryType = (typeof CHEMISTRY_TYPES)[number];

const hash = (s: string): number => {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
};
const temper = (mon: PokemonInstance): TemperamentId | undefined => temperamentOf(personalityOfMon(mon).id);
const hurt = (content: Content, mon: PokemonInstance): boolean => mon.hp > 0 && mon.hp < maxHp(content, mon) / 2;
const stageOf = (content: Content, mon: PokemonInstance): number => content.species.get(mon.speciesId)?.evolutionStage ?? 1;
function familyRoot(content: Content, id: string): string {
  let cur = id;
  for (let i = 0; i < 4; i++) {
    const from = content.species.get(cur)?.evolvesFrom;
    if (!from) break;
    cur = from;
  }
  return cur;
}

/** The chemistry type of a pair (a is the "giver": the protector, mentor, idol...), or null. Reads party life and the personalities. */
export function chemistryType(content: Content, run: RunState, a: PokemonInstance, b: PokemonInstance): ChemistryType | null {
  const ta = temper(a);
  const tb = temper(b);
  const pair = stageIndex(peekPair(run, a.uid, b.uid)?.points ?? 0);
  const both = (x: TemperamentId[]) => !!ta && !!tb && x.includes(ta) && x.includes(tb);
  const pairOf = (x: TemperamentId, y: TemperamentId) => (ta === x && tb === y) || (ta === y && tb === x);
  if (pair >= 3) return 'inseparable';
  if (ta === 'tm_competitive' && tb === 'tm_competitive') return 'rivalry';
  if (stageOf(content, a) > stageOf(content, b) && pair >= 1) return 'mentor';
  if (ta === 'tm_protective' && (tb === 'tm_shy' || tb === 'tm_timid')) return 'protective';
  if (affinityOf(run, a.uid, b.uid) === 'clash') return 'dislike';
  if (run.party[0]?.uid === a.uid && run.party.indexOf(b) >= 4) return 'jealousy';
  if ((tb === 'tm_shy' || tb === 'tm_timid') && (ta === 'tm_lazy' || ta === 'tm_serious')) return 'comfort';
  if (both(['tm_brave', 'tm_reckless'])) return 'daredevil';
  if (pairOf('tm_playful', 'tm_serious') || pairOf('tm_lazy', 'tm_energetic')) return 'odd_couple';
  if ((ta === 'tm_affectionate' || ta === 'tm_protective') && hurt(content, b)) return 'caretaker';
  if (stageOf(content, b) === 1 && stageOf(content, a) >= 3) return 'idol';
  if (a.speciesId !== b.speciesId && familyRoot(content, a.speciesId) === familyRoot(content, b.speciesId)) return 'old_friends';
  return null;
}

/** Every pair in the party with a chemistry type (first party pairs first), at most `maxActive` (the party screen shows 3). */
export function partyChemistry(content: Content, run: RunState): { a: PokemonInstance; b: PokemonInstance; type: ChemistryType }[] {
  const out: { a: PokemonInstance; b: PokemonInstance; type: ChemistryType }[] = [];
  const party = run.party;
  for (let i = 0; i < party.length; i++) for (let j = 0; j < party.length; j++) {
    if (i === j) continue;
    const a = party[i]!;
    const b = party[j]!;
    if (out.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a))) continue;
    const type = chemistryType(content, run, a, b);
    if (type && !out.some((p) => p.type === type)) out.push({ a, b, type });
    if (out.length >= content.balance.story.world.maxChemistry) return out;
  }
  return out;
}

const heartbondLevel = (v2: StoryV2): number => Math.max(0, ...v2.heartbond.latched);
const sceneOf = (content: Content, id: string): StoryEvent | undefined => content.storyData.events.find((e) => e.id === id);
const actTag = (e: StoryEvent): number => Number(e.tags.find((t) => /^act\d$/.test(t))?.slice(3) ?? 1);

function needsHold(run: RunState, e: StoryEvent, played: readonly string[]): boolean {
  const v2 = run.story.v2!;
  return e.tags.filter((t) => t.startsWith('need_')).every((t) => {
    const [, kind, ...rest] = t.split('_');
    const arg = rest.join('_');
    switch (kind) {
      case 'after': return played.includes(arg);
      case 'heartbond': return heartbondLevel(v2) >= Number(arg);
      case 'backstory': return v2.module?.backstory === arg;
      case 'team': return run.story.evil?.teamId === arg;
      default: return false;
    }
  });
}

/** The first Eevee in the party at the Crossroads level, if any. */
export const crossroadsEevee = (content: Content, run: RunState): PokemonInstance | undefined => run.party.find((m) => m.speciesId === 'eevee' && m.level >= content.balance.story.world.eeveeLevel);

/** The forms an Eevee may be offered now: the type of a party member, or of the stage, plus Espeon by day (odd Acts) and Umbreon by night. */
export function eeveeForms(content: Content, run: RunState, act: number): string[] {
  const types = new Set<string>(run.party.flatMap((m) => content.species.get(m.speciesId)?.types ?? []));
  if (run.stage?.themeId && content.themes.has(run.stage.themeId)) for (const t of getTheme(content, run.stage.themeId).types) types.add(t);
  types.add(act % 2 === 1 ? 'psychic' : 'dark');
  if (heartbondLevel(run.story.v2!) >= 3) types.add('fairy');
  return content.storyData.events.filter((e) => e.tags.includes('eevee') && e.tags.some((t) => t.startsWith('eevee_') && types.has(t.slice(6)))).map((e) => e.id);
}

/** Picks a world scene for a free Stop (setting its name tokens in facts), or undefined. */
export function worldPick(content: Content, run: RunState, stop: Stop, act: number, played: readonly string[], queued: readonly string[]): string | undefined {
  const v2 = run.story.v2;
  if (!v2) return undefined;
  const cfg = content.balance.story.world;
  const free = (id: string) => !played.includes(id) && !queued.includes(id);
  const place = run.stage?.themeId && content.themes.has(run.stage.themeId) ? getTheme(content, run.stage.themeId).name : 'the road';
  if (stop.category === 'recovery') {
    const eevee = crossroadsEevee(content, run);
    const offered = played.filter((id) => id.startsWith('ev_eevee_')).length;
    if (eevee && offered < cfg.eeveeOffers) {
      const form = eeveeForms(content, run, act).find(free);
      if (form) {
        Object.assign(v2.facts, { 'tok.pokemon': displayName(content, eevee), 'tok.place': place, 'tok.eevee_uid': eevee.uid });
        return form;
      }
    }
    if (played.filter((id) => id.startsWith('ev_camp_')).length < cfg.campPerRun) {
      for (const p of partyChemistry(content, run)) {
        const id = [1, 2].map((n) => `ev_camp_${p.type}_${n}`).find((x) => free(x) && sceneOf(content, x));
        if (id) {
          Object.assign(v2.facts, { 'tok.a': displayName(content, p.a), 'tok.b': displayName(content, p.b), [`chem.${p.type}`]: true });
          return id;
        }
      }
    }
    return undefined;
  }
  const done = played.filter((id) => id.startsWith('ev_tpl_'));
  if (done.length >= cfg.templatesPerRun) return undefined;
  const inAct = done.filter((id) => v2.facts[`tpl_act.${id}`] === act).length;
  if (inAct >= cfg.templatesPerAct) return undefined;
  const pick = content.storyData.events
    .filter((e) => e.tags.includes('template') && free(e.id) && actTag(e) <= act && needsHold(run, e, played))
    .sort((a, b) => hash(`${run.runId}:${a.id}`) - hash(`${run.runId}:${b.id}`))[0];
  if (!pick) return undefined;
  v2.facts[`tpl_act.${pick.id}`] = act;
  return pick.id;
}

/** `evolve_eevee`: the Crossroads Eevee (by uid) becomes the chosen form. Returns false when it is gone or no longer an Eevee. */
export function evolveCrossroads(content: Content, run: RunState, form: string): boolean {
  const uid = run.story.v2?.facts['tok.eevee_uid'];
  const mon = run.party.find((m) => m.uid === uid && m.speciesId === 'eevee');
  if (!mon || !content.species.has(form)) return false;
  evolve(content, mon, form);
  run.story.v2!.facts[`eevee.${form}`] = true;
  return true;
}
