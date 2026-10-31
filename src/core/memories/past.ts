// What a new run is told about the player's earlier runs (a PastDigest) and what the run hands back when it ends.
// The digest is picked deterministically from the legacy records, newest first, so starting a run never rolls a number.

import type { Content } from '../contentSchema';
import { legacyScore } from '../legacyRuns';
import { keepsakeValid } from './keepsakes';
import type { LegacyRun, Profile, RunState } from '../state';
import { MEMORIES, PastDigestSchema, type PastDigest } from './schema';

const species = (content: Content, id: string) => content.species.get(id)?.name ?? id;

const teamOf = (content: Content, r: LegacyRun) => r.team
  .filter((m) => content.species.has(m.speciesId))
  .map((m) => ({ speciesId: m.speciesId, level: Math.max(1, m.level), moves: m.moves.filter((id) => content.moves.get(id)?.supported === true) }));

/** The snapshot a run starts with (empty when there is no history). Records rebuilt from old Run History have no moves and are skipped. */
export function pastDigest(content: Content, profile: Pick<Profile, 'legacyRuns' | 'memories'>): PastDigest {
  const claimed = new Set([...(profile.memories?.claimed ?? []), ...(profile.memories?.cameos ?? [])]);
  const runs = profile.legacyRuns.filter((r) => r.source === 'run');
  const cfg = MEMORIES.digest;
  const ghosts = runs
    .filter((r) => r.outcome === 'defeat' && r.team.length >= 2 && r.encounters >= MEMORIES.ghosts.minEncounters && !claimed.has(`ghost:${r.runId}`))
    .slice(0, cfg.ghosts)
    .map((r) => {
      const by = r.defeatedBy;
      const ace = r.team.find((m) => m.uid === r.aceUid) ?? r.team[0]!;
      return {
        runId: r.runId,
        trainer: content.archetypes.get(r.archetypeId)?.name ?? r.archetypeId,
        classId: r.archetypeId,
        region: (r.regionOrder[Math.min(r.regionReached, Math.max(0, r.regionOrder.length - 1))] ? content.regions.get(r.regionOrder[Math.min(r.regionReached, r.regionOrder.length - 1)]!)?.name : null) ?? 'a far-off region',
        team: teamOf(content, r),
        fell: by ? `${by.trainer ? `${by.trainer}'s ` : 'a wild '}${species(content, by.speciesId)} (Lv ${by.level})` : 'a defeat nobody saw',
        memento: ace.held.find((id) => keepsakeValid(content, id)) ?? null,
      };
    })
    .filter((g) => g.team.length >= 2);
  const gauntlet = [...runs]
    .filter((r) => r.team.length >= 3)
    .map((r) => ({ r, score: legacyScore(content, r) }))
    .sort((a, b) => b.score - a.score || b.r.endedAt.localeCompare(a.r.endedAt))
    .slice(0, cfg.gauntlet)
    .map(({ r }) => ({ runId: r.runId, trainer: content.archetypes.get(r.archetypeId)?.name ?? r.archetypeId, classId: r.archetypeId, team: teamOf(content, r) }))
    .filter((g) => g.team.length >= 3);
  const keepsakes: PastDigest['keepsakes'] = [];
  for (const r of runs) {
    for (const m of r.team) {
      for (const itemId of m.held) {
        const id = `keepsake:${r.runId}:${m.uid}:${itemId}`;
        if (!keepsakeValid(content, itemId) || claimed.has(id) || keepsakes.length >= cfg.keepsakes) continue;
        const owner = `${content.archetypes.get(r.archetypeId)?.name ?? 'a Trainer'}'s ${species(content, m.speciesId)}`;
        keepsakes.push({ id, itemId, owner, runId: r.runId, line: `It was held by ${owner} when that journey ended${r.outcome === 'victory' ? ' in victory' : ''}.` });
      }
    }
  }
  const friends: PastDigest['friends'] = [];
  for (const r of runs) {
    for (const rv of r.rivals.filter((x) => x.encounters >= 2)) {
      const id = `friend:${r.runId}:${rv.id}`;
      if (!claimed.has(id) && friends.length < cfg.friends) friends.push({ id, name: rv.name, speciesId: rv.team[0] ?? null, line: `We met in an earlier journey, ${rv.encounters} times. ${rv.lastResult === 'win' ? 'You beat me, and I have not forgotten.' : 'I beat you, and I have not forgotten.'}` });
    }
    for (const n of r.nemeses.filter((x) => x.settledAs === 'beaten')) {
      const id = `friend:${r.runId}:${n.id}`;
      if (!claimed.has(id) && friends.length < cfg.friends) friends.push({ id, name: species(content, n.speciesId), speciesId: n.speciesId, line: 'We fought before, and you won. I came to see how you are doing.' });
    }
  }
  return PastDigestSchema.parse({ ghosts, gauntlet, keepsakes, friends, used: [] });
}

/** Writes what a finished run used into the profile (a ghost laid to rest, a keepsake recovered, a cameo met), once. */
export function claimPast(profile: Profile, run: RunState): void {
  const used = run.past?.used ?? [];
  if (used.length === 0) return;
  profile.memories ??= { heirlooms: [], claimed: [], cameos: [] };
  for (const id of used) {
    const list = id.startsWith('friend:') ? profile.memories.cameos : profile.memories.claimed;
    if (!list.includes(id)) list.push(id);
  }
}
