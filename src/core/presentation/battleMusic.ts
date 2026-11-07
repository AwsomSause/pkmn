// Which music track a battle plays, and which victory fanfare follows a win. Pure and presentation-only:
// the track never changes the battle.

/** Who the player faces; picks the battle song and the win fanfare. */
export type BattleRole = 'wild' | 'trainer' | 'rival' | 'gym' | 'elite' | 'champion' | 'final';

/** Battle songs per role: ORAS Gym Leader, B2W2 PWT Final Round, EBDX Low HP Battle; the champion and final boss borrow raid songs. */
const ROLE_TRACKS: Record<'rival' | 'gym' | 'elite' | 'champion' | 'final', string> = {
  rival: 'bgm.battle_rival',
  gym: 'bgm.battle_leader',
  elite: 'bgm.battle_elite',
  champion: 'bgm.raid.ultra3',
  final: 'bgm.raid.tera3',
};
export const ROLE_TRACK_IDS: readonly string[] = Object.values(ROLE_TRACKS);

export interface BattleMusicInput {
  /** Set for rivals and bosses; wild and ordinary trainer fights leave it off. */
  role?: BattleRole;
  /** The raid arena's track (bgm.raid.*), if this is a raid. */
  raidTrack: string | null;
  trainer: boolean;
  /** The GB Sounds item: battles play the Game Boy style stand-in loop. */
  gbSounds: boolean;
  /** A stable string for this battle (run seed + battles won): ordinary fights then pick one of the extra songs by hash. Left off, the default song plays. */
  variantKey?: string;
}

/** Extra songs from Pokemon Decades (ORAS, DPPT, HGSS, B2W2 battle themes), picked per battle by string hash (never the gameplay RNG). */
export const WILD_TRACKS = ['bgm.battle', 'bgm.battle_wild_oras', 'bgm.battle_wild_dppt', 'bgm.battle_wild_hgss', 'bgm.battle_wild_bw2'] as const;
export const TRAINER_TRACKS = ['bgm.battle_trainer', 'bgm.battle_trainer_oras', 'bgm.battle_trainer_dppt', 'bgm.battle_trainer_hgss', 'bgm.battle_trainer_bw2'] as const;
const GYM_TRACKS = ['bgm.battle_leader', 'bgm.battle_gym_oras', 'bgm.battle_gym_dppt', 'bgm.battle_gym_hgss'] as const;
const ELITE_TRACKS = ['bgm.battle_elite', 'bgm.battle_elite_oras', 'bgm.battle_elite_dppt'] as const;
/** Every song a battle can pick, besides the always-loaded wild and trainer defaults. */
export const BATTLE_VARIANT_IDS: readonly string[] = [...WILD_TRACKS, ...TRAINER_TRACKS, ...GYM_TRACKS, ...ELITE_TRACKS].filter((id) => id !== 'bgm.battle' && id !== 'bgm.battle_trainer');

function hashPick<T>(list: readonly T[], key: string): T {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length]!;
}

export function battleTrack(i: BattleMusicInput): string {
  if (i.raidTrack) return i.raidTrack;
  if (i.gbSounds) return 'bgm.battle_gb';
  const key = i.variantKey;
  if (i.role && i.role !== 'wild' && i.role !== 'trainer') {
    const base = ROLE_TRACKS[i.role];
    if (key !== undefined && i.role === 'gym') return hashPick(GYM_TRACKS, key);
    if (key !== undefined && i.role === 'elite') return hashPick(ELITE_TRACKS, key);
    return base;
  }
  if (key !== undefined) return hashPick(i.trainer ? TRAINER_TRACKS : WILD_TRACKS, key);
  return i.trainer ? 'bgm.battle_trainer' : 'bgm.battle';
}

/** The Deluxe Battle Kit's low-HP song. */
export const LOW_HP_TRACK = 'bgm.battle_lowhp';

/**
 * Ordinary wild and trainer fights swap to the low-HP song while your lead is in danger (under a fifth of its HP).
 * Boss, rival, raid and GB Sounds songs stay. Presentation only: it never touches the battle.
 */
export function lowHpTrack(base: string, hpShare: number): string {
  return hpShare < 0.2 && ((WILD_TRACKS as readonly string[]).includes(base) || (TRAINER_TRACKS as readonly string[]).includes(base)) ? LOW_HP_TRACK : base;
}

/** The victory fanfare: the big one for bosses (gym leaders, Elite Four, champions), then trainers, then wild. */
export function victoryTrack(i: { trainer: boolean; boss: boolean; role?: BattleRole }): string {
  if (i.role === 'elite') return 'bgm.victory_elite';
  if (i.boss) return 'bgm.victory_leader';
  return i.trainer ? 'bgm.victory_trainer' : 'bgm.victory_wild';
}

export const VICTORY_TRACKS = ['bgm.victory_wild', 'bgm.victory_trainer', 'bgm.victory_leader', 'bgm.victory_elite'] as const;

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

/** Map songs: Route 101 plus the pack's Bicycle and Surfing themes, and five route songs from Pokemon Decades. A region keeps one (string hash, never the gameplay RNG). */
export const MAP_TRACKS = ['bgm.map', 'bgm.map_bike', 'bgm.map_surf', 'bgm.map_bw', 'bgm.map_oras', 'bgm.map_dppt', 'bgm.map_dppt2', 'bgm.map_hgss'] as const;
export function mapTrack(regionId: string): string {
  let h = 0;
  for (const c of regionId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return MAP_TRACKS[h % MAP_TRACKS.length]!;
}
