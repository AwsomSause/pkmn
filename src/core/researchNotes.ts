// Research Expeditions (catalog #110): spend Research Points on field notes. One note per region lists its Gym
// Leaders and the types their teams use. Information only: no power, and nothing the game requires.
// A bought note is a claim in the ledger ("note:<id>"), so it can never be paid for twice.

import type { Content } from './contentSchema';
import { claim, isClaimed } from './quests';
import { getBoss } from './regions';
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

export function researchNotes(content: Content): ResearchNote[] {
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
