// Research Room (catalog #105, #83, #112): collection sets built from the species data, with milestone payouts.
// Pure. Milestones pay Research Points once each through the claim ledger (no save change).

import type { Content } from './contentSchema';
import { claim } from './quests';
import { specialFamily } from './specialForms';
import type { Profile } from './state';

export interface CollectionSet {
  id: string;
  name: string;
  members: string[];
}

export interface SetProgress extends CollectionSet {
  seen: number;
  caught: number;
  /** Milestone percentages reached (of 25/50/75/100). */
  reached: number[];
}

export const MILESTONES = [25, 50, 75, 100] as const;
/** Research Points per milestone: small, never a mandatory grind. */
export const MILESTONE_PAY = [5, 10, 15, 30] as const;

const FAMILY_NAMES: Record<string, string> = { delta: 'Delta forms', zform: 'Z-Forms', spooky: 'Spooky forms', regional: 'Regional forms' };

export function collectionSets(content: Content): CollectionSet[] {
  const sets = new Map<string, string[]>();
  const add = (id: string, speciesId: string) => sets.set(id, [...(sets.get(id) ?? []), speciesId]);
  for (const s of content.species.values()) {
    const family = specialFamily(s);
    if (family) add(`form:${family}`, s.id);
    else if (s.form?.kind === 'mega') add('form:mega', s.id);
    else if (!s.form) add(`gen:${s.generation}`, s.id);
  }
  const out: CollectionSet[] = [];
  for (let g = 1; g <= 9; g++) if (sets.has(`gen:${g}`)) out.push({ id: `gen:${g}`, name: `Generation ${g} Pokédex`, members: sets.get(`gen:${g}`)! });
  for (const f of Object.keys(FAMILY_NAMES)) if (sets.has(`form:${f}`)) out.push({ id: `form:${f}`, name: FAMILY_NAMES[f]!, members: sets.get(`form:${f}`)! });
  if (sets.has('form:mega')) out.push({ id: 'form:mega', name: 'Mega Evolutions', members: sets.get('form:mega')! });
  return out;
}

export function setProgress(set: CollectionSet, profile: Profile): SetProgress {
  const seen = new Set(profile.speciesSeen);
  const caught = new Set(profile.speciesCaught);
  const c = set.members.filter((m) => caught.has(m)).length;
  const pct = set.members.length ? (c / set.members.length) * 100 : 0;
  return { ...set, seen: set.members.filter((m) => seen.has(m) || caught.has(m)).length, caught: c, reached: MILESTONES.filter((m) => pct >= m) };
}

export interface ResearchTotals {
  met: number;
  caught: number;
  evolved: number;
  total: number;
}

export function researchTotals(content: Content, profile: Profile): ResearchTotals {
  return {
    met: new Set([...profile.speciesSeen, ...profile.speciesCaught]).size,
    caught: new Set(profile.speciesCaught).size,
    evolved: Object.values(profile.mastery ?? {}).filter((m) => m.evolved > 0).length,
    total: content.species.size,
  };
}

export const milestoneKey = (setId: string, pct: number) => `collection:${setId}:${pct}`;

/** Pays every milestone reached and not yet claimed (mutates `profile`). Returns what was paid. */
export function claimCollectionMilestones(content: Content, profile: Profile, now: string): { setName: string; pct: number; researchPoints: number }[] {
  const paid: { setName: string; pct: number; researchPoints: number }[] = [];
  for (const set of collectionSets(content)) {
    const prog = setProgress(set, profile);
    for (const pct of prog.reached) {
      if (!claim(profile, milestoneKey(set.id, pct), now)) continue;
      const researchPoints = MILESTONE_PAY[MILESTONES.indexOf(pct as (typeof MILESTONES)[number])]!;
      profile.researchPoints += researchPoints;
      // A finished set also earns a title for the Wardrobe (Living Dex contract, catalog #151).
      if (pct === 100 && !profile.titles.includes(`Complete: ${set.name}`)) profile.titles = [...profile.titles, `Complete: ${set.name}`];
      paid.push({ setName: set.name, pct, researchPoints });
    }
  }
  return paid;
}
