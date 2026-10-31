// Which music track a battle plays, and which victory fanfare follows a win. Pure and presentation-only:
// the track never changes the battle.

export interface BattleMusicInput {
  /** The raid arena's track (bgm.raid.*), if this is a raid. */
  raidTrack: string | null;
  trainer: boolean;
  /** The GB Sounds item: battles play the Game Boy style stand-in loop. */
  gbSounds: boolean;
}

export function battleTrack(i: BattleMusicInput): string {
  if (i.raidTrack) return i.raidTrack;
  if (i.gbSounds) return 'bgm.battle_gb';
  return i.trainer ? 'bgm.battle_trainer' : 'bgm.battle';
}

/** The victory fanfare: the big one for bosses (gym leaders, Elite Four, champions), then trainers, then wild. */
export function victoryTrack(i: { trainer: boolean; boss: boolean }): string {
  if (i.boss) return 'bgm.victory_leader';
  return i.trainer ? 'bgm.victory_trainer' : 'bgm.victory_wild';
}

export const VICTORY_TRACKS = ['bgm.victory_wild', 'bgm.victory_trainer', 'bgm.victory_leader'] as const;

/** Raid battle tracks per tier group: the first is always loaded, the rest load lazily with the battle. */
const RAID_TRACKS = {
  basic: ['bgm.raid.basic', 'bgm.raid.basic2'],
  ultra: ['bgm.raid.ultra', 'bgm.raid.ultra2', 'bgm.raid.ultra3'],
  max: ['bgm.raid.max', 'bgm.raid.max2', 'bgm.raid.max3'],
  tera: ['bgm.raid.tera', 'bgm.raid.tera2', 'bgm.raid.tera3'],
} as const;
export const RAID_TRACK_IDS: readonly string[] = Object.values(RAID_TRACKS).flat();

/**
 * The music for a raid or Totem fight: the tier picks the set (1-2 Basic, 3 Ultra, 4 Max, 5+ and Totems Tera) and the
 * raid's id picks the variant. A string hash, never the gameplay RNG, so the same raid always plays the same song.
 */
export function raidMusic(tier: number | null, totem: boolean, key: string): string | null {
  if (tier === null && !totem) return null;
  const set = totem || (tier ?? 1) >= 5 ? RAID_TRACKS.tera : tier! >= 4 ? RAID_TRACKS.max : tier! >= 3 ? RAID_TRACKS.ultra : RAID_TRACKS.basic;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return set[h % set.length]!;
}

/** The jingle for a beaten raid boss that offers to join, by raid tier (Raid Battles pack capture songs). */
export function raidCaptureTrack(tier: number): string {
  return `bgm.raid.capture.${tier >= 5 ? 'tera' : tier >= 4 ? 'max' : tier >= 3 ? 'ultra' : 'basic'}`;
}

/** Expedition route music by expedition tier (1-4): the Raid Battles pack's adventure songs. */
export function expeditionTrack(tier: number): string {
  return `bgm.raid.adventure.${(['basic', 'ultra', 'max', 'tera'] as const)[Math.min(3, Math.max(0, tier - 1))]}`;
}
export const EXPEDITION_TRACK_IDS: readonly string[] = [1, 2, 3, 4].map(expeditionTrack);
