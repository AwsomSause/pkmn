// Spectate an exhibition match (ideas W1 I86): two AI trainers fight and you place a friendly wager. A seeded
// round-by-round simulation (its own streams from the run seed and the plaza key), so reloading or re-opening the
// board never changes the result, and no gameplay stream is used.

import type { Content } from './contentSchema';
import { createBattle, exhibitionMove, resolveTurn, type BattleContext, type PlayerAction } from './battle/engine';
import { createPokemon, maxHp } from './pokemon';
import { Rng, hashSeed } from './rng';
import { pickThemeSpecies } from './themes';
import type { PokemonInstance, RunState } from './state';

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
  return { teams: [a, b], ...fight(content, run.seed, key, a, b) };
}

/** A real battle on the engine: both teams are played by the AI, three against three, with its own random stream. */
function fight(content: Content, seed: string, key: string, a: ExhibitionTeam, b: ExhibitionTeam): { winner: 0 | 1; lines: string[] } {
  const build = (team: ExhibitionTeam, tag: string): PokemonInstance[] =>
    team.fighters.map((f, i) => {
      const mon = createPokemon(content, f.speciesId, f.level, `ex-${tag}${i}`);
      mon.hp = maxHp(content, mon);
      return mon;
    });
  const mine = build(a, 'a');
  const theirs = build(b, 'b');
  const battle = createBattle('trainer', theirs, 0, mine[0]!.uid, { classId: 'ace-trainer', name: b.trainer, leaderId: null });
  const ctx: BattleContext = { content, battle, party: mine, inventory: {}, rng: new Rng(hashSeed(`${seed}::exhibition-battle::${key}`)), captureRng: new Rng(hashSeed(`${seed}::exhibition-catch::${key}`)), catchMultiplier: 1 };
  const owner = new Map<string, { name: string; trainer: string }>();
  [...mine.map((m) => [m, a] as const), ...theirs.map((m) => [m, b] as const)].forEach(([m, t]) => owner.set(m.uid, { name: content.species.get(m.speciesId)?.name ?? m.speciesId, trainer: t.trainer }));
  const lines: string[] = [`${a.trainer} versus ${b.trainer}!`];
  let lastMove: { side: string; moveId: string } | null = null;
  for (let turn = 0; turn < 300 && !battle.outcome; turn++) {
    const alive = mine.findIndex((m, i) => m.hp > 0 && i !== battle.activeIndex);
    const action: PlayerAction = battle.needsSwitch ? { kind: 'switch', partyIndex: alive } : { kind: 'move', index: exhibitionMove(ctx) };
    if (action.kind === 'switch' && alive < 0) break;
    for (const e of resolveTurn(ctx, action)) {
      if (e.type === 'move') lastMove = { side: e.side, moveId: e.moveId };
      else if (e.type === 'faint') {
        const who = owner.get(e.uid);
        const by = lastMove && lastMove.side !== e.side ? ` with ${content.moves.get(lastMove.moveId)?.name ?? lastMove.moveId}` : '';
        if (who) lines.push(`${who.name} (${who.trainer}) is knocked out${by}!`);
      }
    }
  }
  // A stalemate (nobody can finish the other) goes to whoever has more HP left.
  const left = (team: PokemonInstance[]): number => team.reduce((n, m) => n + Math.max(0, m.hp), 0);
  const winner: 0 | 1 = battle.outcome ? (battle.outcome === 'win' ? 0 : 1) : left(mine) >= left(theirs) ? 0 : 1;
  lines.push(`${winner === 0 ? a.trainer : b.trainer} wins the exhibition!`);
  return { winner, lines };
}
