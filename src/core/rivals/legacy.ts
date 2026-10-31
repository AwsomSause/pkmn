// The optional legacy layer (Living Rivalry doc §11-12): rivals of finished runs are archived on the account, and a later run
// may let one shape a new rival's character. The archive is a copy: it never changes a run in progress, and a run only reads the
// record it was given at its start.

import { hashSeed, Rng } from '../rng';
import type { Profile, RunState } from '../state';
import { TRAIT_KEYS, type ArchivedRival, type Rival, type Traits } from '../story/schema';
import { RIVAL_CONFIG } from './schema';
import { everUltimateFlag, ULTIMATE_FLAG, ultimateDoneFlag } from './ultimate';

/** Story flag set once the run's legacy rival has shaped a rival. */
export const LEGACY_USED = 'legacy-rival-used';

/** Adds this run's rivals to the account archive once per run and rival (newest kept, up to the limit). Mutates `profile`. */
export function archiveRivals(profile: Profile, run: RunState): void {
  const cfg = RIVAL_CONFIG.legacy;
  const have = new Set(profile.rivalArchive.map((a) => `${a.runId}:${a.name}:${a.classId}`));
  for (const r of run.story.rivals) {
    if (r.encounters < cfg.minEncounters || have.has(`${run.runId}:${r.name}:${r.classId}`)) continue;
    profile.rivalArchive.push({ runId: run.runId, name: r.name, classId: r.classId, archetype: r.archetype, style: r.style, traits: { ...r.traits }, state: r.state, encounters: r.encounters, resolution: r.arc?.resolution ?? null, team: [...r.memory.lastBattle.team], ...(isUltimate(run, r.id) ? { ultimate: true } : {}), ...(r.world ? { world: { fame: r.world.fame, badges: r.world.badges, regionsDone: r.world.regionsDone, wins: r.world.wins, defeats: r.world.defeats, rank: r.rank ?? null } } : {}) });
  }
  profile.rivalArchive = profile.rivalArchive.slice(-cfg.archiveMax);
}

/** It was the run's Ultimate Rival at the end, or finished the Ultimate Rival quest. */
const isUltimate = (run: RunState, id: string) => run.story.flags[ULTIMATE_FLAG] === id || Boolean(run.story.flags[ultimateDoneFlag(id)]) || (run.story.flags[ULTIMATE_FLAG] === undefined && Boolean(run.story.flags[everUltimateFlag(id)]));

/** The account's Previous Ultimate Rivals, newest first. */
export function pastUltimateRivals(profile: Pick<Profile, 'rivalArchive'>, limit = RIVAL_CONFIG.ultimate.pastShown): ArchivedRival[] {
  return profile.rivalArchive.filter((a) => a.ultimate).reverse().slice(0, limit);
}

/** The archived rival that may shape this new run (or null): chosen from the seed, never from earlier rolls. */
export function pickLegacyRival(archive: readonly ArchivedRival[], seed: string): ArchivedRival | null {
  const cfg = RIVAL_CONFIG.legacy;
  const pool = archive.filter((a) => cfg.states.includes(a.state) && a.encounters >= cfg.minEncounters);
  if (pool.length === 0) return null;
  const rng = new Rng(hashSeed(`${seed}::legacy-rival`));
  return rng.chance(cfg.chance) ? structuredClone(pool[rng.int(0, pool.length - 1)]!) : null;
}

/** Lets the run's legacy rival shape a freshly sparked rival (once per run): its style and a blend of its traits. Mutates `rival` and `run`. */
export function applyLegacy(run: Pick<RunState, 'legacyRival' | 'story'>, rival: Rival): void {
  const legend = run.legacyRival;
  if (!legend || run.story.flags[LEGACY_USED]) return;
  const blend = RIVAL_CONFIG.legacy.traitBlend;
  for (const k of TRAIT_KEYS) rival.traits[k as keyof Traits] = Math.round(rival.traits[k as keyof Traits] * (1 - blend) + legend.traits[k as keyof Traits] * blend);
  rival.style = legend.style;
  rival.legacyOf = legend.name;
  // Rival ghost: the old rival's lead Pokémon comes back as this rival's ace.
  const ace = legend.team?.[0];
  if (ace) {
    const team = rival.memory.lastBattle.team;
    rival.memory.lastBattle.team = team.length > 0 ? [...team.slice(0, -1), ace] : [ace];
  }
  run.story.flags[LEGACY_USED] = true;
}

/** What a legacy rival says about the one it learned from, or null. */
export function legacyLine(rival: Rival): string | null {
  return rival.legacyOf ? `${rival.name} fights the way ${rival.legacyOf} once did.` : null;
}
