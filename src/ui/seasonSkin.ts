// Seasonal map skins tied to the real-world date (ideas W4, F93). Presentation only: the season never changes a roll
// (the run's own calendar season, core/clock.ts, is what gameplay reads).

export type RealSeason = 'spring' | 'summer' | 'autumn' | 'winter';

/** The northern-hemisphere season of a date: Mar-May spring, Jun-Aug summer, Sep-Nov autumn, Dec-Feb winter. */
export function realSeason(date: Date): RealSeason {
  const m = date.getMonth();
  return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
}

/** The tint washed over the map and the drifting particles (an ambience type, ui/ambience) for each season. */
export const SEASON_SKIN: Record<RealSeason, { name: RealSeason; tint: number; ambience: string }> = {
  spring: { name: 'spring', tint: 0xffb0d8, ambience: 'fairy' },
  summer: { name: 'summer', tint: 0xffe080, ambience: 'fire' },
  autumn: { name: 'autumn', tint: 0xd08040, ambience: 'grass' },
  winter: { name: 'winter', tint: 0xc0e0ff, ambience: 'ice' },
};
