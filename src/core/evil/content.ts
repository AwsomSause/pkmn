// Evil Teams (spec §16): the storyline and operation stops are written once in evilTeams.json as templates with
// tokens ({team}, {exec}, {spoils}...) and expanded here into ordinary map events, one set per team. Each expanded
// event gets its gate in front of its own `requires` (the team, the beat, the running operation...).

import type { EvilFile, EvilTeam } from './schema';

const STRING_TOKENS = (team: EvilTeam): Record<string, string> => ({
  team: team.name,
  teamId: team.id,
  front: team.front,
  goal: team.goal,
  motive: team.motivation,
  philosophy: team.philosophy,
  color: team.color,
  grunt: team.ranks.grunt.name,
  specialist: team.ranks.specialist.name,
  exec: team.ranks.executive.name,
  executive: team.ranks.executive.name,
  leader: team.ranks.leader.name,
  gruntSprite: team.ranks.grunt.sprite,
  specialistSprite: team.ranks.specialist.sprite,
  execSprite: team.ranks.executive.sprite,
  leaderSprite: team.ranks.leader.sprite,
});

function fill(value: unknown, words: Record<string, string>, lists: Record<string, string[]>): unknown {
  if (typeof value === 'string') {
    const list = /^\{(\w+)\}$/.exec(value);
    if (list && lists[list[1]!]) return [...lists[list[1]!]!];
    return value.replace(/\{(\w+)\}/g, (all, key: string) => words[key] ?? all);
  }
  if (Array.isArray(value)) return value.map((v) => fill(v, words, lists));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, words, lists)]));
  return value;
}

export const evilEventId = (teamId: string, templateId: string, opId?: string): string => `evil-${teamId}-${templateId}${opId ? `-${opId}` : ''}`;

/** Every team's storyline, operation, ambush, disguise and legend stops, as raw event objects (validated by the caller). */
export function expandEvilEvents(file: EvilFile): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const team of file.teams) {
    const words = STRING_TOKENS(team);
    const lists = { spoils: team.spoils, legendary: team.legendary };
    for (const t of file.templates) {
      if (t.styles && !t.styles.includes(team.style)) continue;
      const base = t.event as { requires?: unknown[] };
      const make = (id: string, gate: Record<string, unknown>, extra: Record<string, string>, more: Record<string, unknown> = {}) => {
        const filled = fill(base, { ...words, ...extra }, lists) as Record<string, unknown> & { requires?: unknown[] };
        out.push({ ...filled, ...more, id, requires: [{ kind: 'evil', team: team.id, ...gate }, ...(filled.requires ?? [])] });
      };
      if (t.beat !== undefined) make(evilEventId(team.id, t.id), { beat: t.beat - 1 }, {}, { callback: true });
      else if (t.slot === 'op') for (const op of team.ops) make(evilEventId(team.id, t.id, op.id), { op: op.id }, { opName: op.name, opText: op.text }, { callback: true });
      else if (t.slot === 'ambush') make(evilEventId(team.id, t.id), { heat: file.config.ambushAt, ends: ['none'] }, {});
      else if (t.slot === 'disguise') make(evilEventId(team.id, t.id), { ends: ['none'], after: 2 }, {});
      else if (t.slot === 'legend') make(evilEventId(team.id, t.id), { ends: ['defeated', 'exposed'] }, {}, { callback: true });
    }
  }
  return out;
}

/** A line with the team's tokens ({team}, {front}, {exec}...) filled in. */
export function teamText(team: EvilTeam, text: string, extra: Record<string, string> = {}): string {
  return fill(text, { ...STRING_TOKENS(team), ...extra }, {}) as string;
}
