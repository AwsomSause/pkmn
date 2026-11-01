// Spectate an exhibition match (ideas W1 I86): two AI trainers fight and you place a friendly wager. A seeded
// round-by-round simulation (its own streams from the run seed and the plaza key), so reloading or re-opening the
// board never changes the result, and no gameplay stream is used.

import type { Content } from './contentSchema';
import { typeEffectiveness } from './battle/damage';
import { Rng, hashSeed } from './rng';
import { pickThemeSpecies } from './themes';
import type { RunState } from './state';

export interface ExhibitionFighter { speciesId: string; name: string; level: number }
export interface ExhibitionTeam { trainer: string; fighters: ExhibitionFighter[] }
export interface Exhibition { teams: [ExhibitionTeam, ExhibitionTeam]; winner: 0 | 1; lines: string[] }

const TRAINERS = ['Ace Trainer Kay', 'Hiker Dan', 'Lass Mira', 'Sailor Pete', 'Scientist Odo', 'Camper Jo', 'Veteran Ruth', 'Biker Zed'];

/** The match shown on this plaza visit: the same for the same run and stage. */
export function exhibitionFor(content: Content, run: Pick<RunState, 'seed' | 'stage' | 'party' | 'regionOrder' | 'regionIndex'>, key: string): Exhibition {
  const rng = new Rng(hashSeed(`${run.seed}::exhibition::${key}`));
  const theme = run.stage ? content.themes.get(run.stage.themeId) : undefined;
  const avg = run.party.length ? Math.round(run.party.reduce((n, m) => n + m.level, 0) / run.party.length) : 10;
  const make = (): ExhibitionTeam => {
    const trainer = TRAINERS[rng.int(0, TRAINERS.length - 1)]!;
    const fighters: ExhibitionFighter[] = [];
    for (let i = 0; i < 3; i++) {
      const speciesId = theme ? pickThemeSpecies(content, theme, rng, undefined, run.regionOrder[run.regionIndex]) : [...content.species.keys()][rng.int(0, content.species.size - 1)]!;
      fighters.push({ speciesId, name: content.species.get(speciesId)?.name ?? speciesId, level: Math.max(5, avg + rng.int(-2, 2)) });
    }
    return { trainer, fighters };
  };
  const a = make();
  let b = make();
  if (b.trainer === a.trainer) b = { ...b, trainer: TRAINERS[(TRAINERS.indexOf(a.trainer) + 1) % TRAINERS.length]! };
  const power = (f: ExhibitionFighter, foe: ExhibitionFighter): number => {
    const me = content.species.get(f.speciesId)!;
    const them = content.species.get(foe.speciesId)!;
    const bst = Object.values(me.baseStats).reduce((n, v) => n + v, 0);
    const edge = Math.max(...me.types.map((t) => typeEffectiveness(content.typeChart, t, them.types)));
    return (bst / 6 + f.level * 2) * (edge > 1 ? 1.3 : edge < 1 ? 0.75 : 1);
  };
  const lines: string[] = [`${a.trainer} versus ${b.trainer}!`];
  const idx: [number, number] = [0, 0];
  while (idx[0] < 3 && idx[1] < 3) {
    const fa = a.fighters[idx[0]]!;
    const fb = b.fighters[idx[1]]!;
    const pa = power(fa, fb) * (0.85 + rng.float() * 0.3);
    const pb = power(fb, fa) * (0.85 + rng.float() * 0.3);
    if (pa >= pb) {
      lines.push(`${fa.name} (${a.trainer}) beats ${fb.name}!`);
      idx[1] += 1;
    } else {
      lines.push(`${fb.name} (${b.trainer}) beats ${fa.name}!`);
      idx[0] += 1;
    }
  }
  const winner: 0 | 1 = idx[1] >= 3 ? 0 : 1;
  lines.push(`${winner === 0 ? a.trainer : b.trainer} wins the exhibition!`);
  return { teams: [a, b], winner, lines };
}
