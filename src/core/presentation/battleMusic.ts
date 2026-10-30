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
