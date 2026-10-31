// Research Expeditions (catalog #110): spend Research Points on field notes. One note per region lists its Gym
// Leaders and the types their teams use. Information only: no power, and nothing the game requires.
// A bought note is a claim in the ledger ("note:<id>"), so it can never be paid for twice.

import type { Content } from './contentSchema';
import { claim, isClaimed } from './quests';
import { getBoss } from './regions';
import { SPECIAL_FORMS, specialFamily } from './specialForms';
import type { Profile } from './state';

export const NOTE_COST = 15;

export interface ResearchNote {
  id: string;
  name: string;
  cost: number;
  /** The text unlocked by the note, one line per Gym Leader. */
  lines: string[];
}

const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Where a form of this type is said to lurk (Delta field research, catalog 78). */
const HABITAT: Record<string, string> = {
  normal: 'open fields and quiet roadsides', fire: 'volcanic vents and sun-baked ridges', water: 'shorelines and deep pools', electric: 'storm-struck plains and power lines',
  grass: 'tall grass and old forests', ice: 'frozen caves and snowfields', fighting: 'rocky training grounds', poison: 'marshes and abandoned mines',
  ground: 'dry canyons and deep burrows', flying: 'cliff tops and high winds', psychic: 'still places that hum when it is quiet', bug: 'thick undergrowth and hollow logs',
  rock: 'quarries and boulder fields', ghost: 'ruins and fog after dusk', dragon: 'high peaks few people climb', dark: 'alleys and moonless woods',
  steel: 'scrapyards and factory ruins', fairy: 'meadows that glow at twilight',
};
const FAMILY_LORE: Record<string, string> = {
  delta: 'Old researchers wrote that some species changed type after a strange tide, and the changed ones were called Delta.',
  zform: 'A trainer\'s diary mentions Pokémon that answered a Z-Ring with a new shape, not only a new move.',
  spooky: 'Villagers say that on certain nights familiar Pokémon come back wearing a different face.',
  regional: 'Travellers swear the same species looks different one region over.',
};
const FORM_FAMILIES = ['delta', 'zform', 'spooky', 'regional'] as const;
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The form-hint notes: one per special-form family and generation, with the silhouettes it opens. */
export function formNotes(content: Content): (ResearchNote & { members: string[] })[] {
  const out: (ResearchNote & { members: string[] })[] = [];
  for (const family of FORM_FAMILIES) {
    const fam = SPECIAL_FORMS.families[family];
    if (!fam) continue;
    const byGen = new Map<number, string[]>();
    for (const sp of content.species.values()) if (specialFamily(sp) === family) byGen.set(sp.generation, [...(byGen.get(sp.generation) ?? []), sp.id]);
    for (const [gen, members] of [...byGen.entries()].sort((a, b) => a[0] - b[0])) {
      const tally = new Map<string, number>();
      for (const id of members) for (const t of content.species.get(id)?.types ?? []) tally.set(t, (tally.get(t) ?? 0) + 1);
      const top = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
      const lines = [
        `${members.length} silhouettes in the research log (${top.map(([t, n]) => `${upperFirst(t)} x${n}`).join(', ')}).`,
        FAMILY_LORE[family] ?? '',
        `Found through: ${fam.routes.map((r) => r.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}.`,
      ];
      // Delta field research (catalog 78): a habitat for the most common type and a hint at the signature encounter.
      if (family === 'delta' && top[0]) lines.splice(1, 0, `Habitat: ${HABITAT[top[0][0]] ?? 'unknown ground'}. Its signature encounter is an event, never a plain wild roll.`);
      out.push({ id: `forms:${family}:${gen}`, name: `Form hints: ${fam.name}, generation ${gen}`, cost: NOTE_COST, lines: lines.filter(Boolean), members });
    }
  }
  return out;
}

/** Species whose form note you bought but have not met: the research log shows them as silhouettes (catalog 34, 79). */
export function silhouettes(content: Content, profile: Profile): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const note of formNotes(content)) {
    if (!noteOpen(profile, note.id)) continue;
    for (const id of note.members) if (!profile.speciesSeen.includes(id) && !profile.speciesCaught.includes(id)) out.set(id, content.species.get(id)?.types ?? []);
  }
  return out;
}

export function researchNotes(content: Content): ResearchNote[] {
  return [...researchRegionNotes(content), ...formNotes(content).map(({ members: _members, ...n }) => n)];
}

function researchRegionNotes(content: Content): ResearchNote[] {
  return [...content.regions.values()]
    .filter((r) => !r.grand && r.gymLeaders.length > 0)
    .map((r) => ({
      id: `region:${r.id}`,
      name: `Field notes: ${r.name}`,
      cost: NOTE_COST,
      lines: r.gymLeaders.map((leaderId) => {
        const boss = getBoss(content, leaderId);
        const types = new Set<string>();
        for (const team of boss.teams.gym) for (const m of team.members) for (const t of content.species.get(m.speciesId)?.types ?? []) types.add(t);
        return `${boss.name}: ${[...types].sort().map(upper).join(', ')}`;
      }),
    }));
}

export const noteKey = (id: string) => `note:${id}`;
export const noteOpen = (profile: Profile, id: string) => isClaimed(profile, noteKey(id));

/** Why a note can't be bought right now, or null. */
export function noteProblem(content: Content, profile: Profile, id: string): string | null {
  const note = researchNotes(content).find((n) => n.id === id);
  if (!note) return 'There is no such note.';
  if (noteOpen(profile, id)) return 'You already have this note.';
  if (profile.researchPoints < note.cost) return `You need ${note.cost} Research Points (you have ${profile.researchPoints}).`;
  return null;
}

/** Buys a note. Returns a new profile. */
export function buyNote(content: Content, current: Profile, id: string, now: string): Profile {
  const problem = noteProblem(content, current, id);
  if (problem) throw new Error(problem);
  const profile = structuredClone(current);
  const note = researchNotes(content).find((n) => n.id === id)!;
  profile.researchPoints -= note.cost;
  claim(profile, noteKey(id), now);
  return profile;
}
