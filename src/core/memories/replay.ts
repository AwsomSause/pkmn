// Battle Replay (APPROVED.md §7): a concise turn-by-turn record of the run's big battles (gym leaders, the Elite Four,
// champions, rivals, nemeses, ghosts, the gauntlet). Written from the same turn events the drama planner reads, so it
// never touches the battle; presentation and the Hall of Memories read it later.

import type { BattleEvent } from '../battle/engine';
import type { Content } from '../contentSchema';
import { CHAMPION_CLASS, ELITE_FOUR_CLASS, GYM_LEADER_CLASS } from '../encounters';
import { currentEnemy, type BattleState, type RunState } from '../state';
import { MEMORIES, type BattleReplay } from './schema';

const LINE_CAP = 170;

/** Which kind of big battle this is (null: an ordinary fight that is not kept). */
export function replayKind(battle: BattleState): BattleReplay['kind'] | null {
  if (battle.kind !== 'trainer' || battle.raid || battle.totem || battle.event) return null;
  if (battle.memory) return battle.memory.kind;
  if (battle.nemesis) return 'nemesis';
  if (battle.rivalId) return 'rival';
  const cls = battle.trainer?.classId;
  if (cls === GYM_LEADER_CLASS) return 'gym';
  if (cls === ELITE_FOUR_CLASS) return 'elite';
  if (cls === CHAMPION_CLASS) return 'champion';
  return null;
}

/** Drops the middle of a long record so the start and the finish stay. */
export function trimReplay(lines: readonly string[], max: number): string[] {
  if (lines.length <= max) return [...lines];
  const tail = Math.floor(max / 2);
  return [...lines.slice(0, max - tail - 1), '…', ...lines.slice(lines.length - tail)];
}

/** The lines for one turn: who used what, what it did, who fainted. Names come from the battle as the turn began. */
export function turnLine(content: Content, run: RunState, prior: BattleState, after: BattleState, events: readonly BattleEvent[]): string | null {
  const name = (id: string | undefined) => (id ? (content.species.get(id)?.name ?? id) : 'Pokémon');
  const mine = () => name(run.party[prior.activeIndex]?.speciesId);
  const theirs = () => name(prior.enemyTeam[prior.enemyIndex]?.speciesId);
  const who = (side: 'player' | 'enemy') => (side === 'player' ? mine() : theirs());
  const parts: string[] = [];
  let mover: string | null = null;
  for (const e of events) {
    switch (e.type) {
      case 'move':
        mover = `${who(e.side)} used ${content.moves.get(e.moveId)?.name ?? e.moveId}`;
        parts.push(mover);
        break;
      case 'damage':
      {
        const hit = `-${e.amount}${e.crit ? ', crit' : e.effectiveness > 1 ? ', super effective' : e.effectiveness < 1 && e.effectiveness > 0 ? ', not very effective' : ''}`;
        if (mover && parts[parts.length - 1] === mover) parts[parts.length - 1] = `${mover} (${hit})`;
        else parts.push(`hit for ${hit}`);
        mover = null;
        break;
      }
      case 'miss':
        parts.push('missed');
        break;
      case 'status':
        parts.push(`${who(e.side)} is ${e.status}`);
        break;
      case 'faint':
        parts.push(`${who(e.side)} fainted`);
        break;
      default:
        break;
    }
  }
  if (parts.length === 0) return null;
  const switched = after.activeIndex !== prior.activeIndex || after.enemyIndex !== prior.enemyIndex;
  const line = `T${prior.turn}: ${parts.join('; ')}${switched ? ` → ${after.enemyIndex !== prior.enemyIndex ? `foe sends ${name(after.enemyTeam[after.enemyIndex]?.speciesId)}` : 'you send the next one'}` : ''}`;
  return line.length > LINE_CAP ? `${line.slice(0, LINE_CAP - 1)}…` : line;
}

/** Adds one turn to the running battle's record (mutates the run's battle). Safe to call for any battle: only big ones keep it. */
export function noteReplayTurn(content: Content, run: RunState, prior: BattleState, events: readonly BattleEvent[]): void {
  const battle = run.battle;
  if (!battle || !replayKind(battle)) return;
  const line = turnLine(content, run, prior, battle, events);
  if (!line) return;
  const log = (battle.drama.replay ??= []);
  log.push(line);
  // Keep a little more than we will save so the finish is never lost, but never grow without bound.
  if (log.length > MEMORIES.replay.maxLines * 2) battle.drama.replay = trimReplay(log, MEMORIES.replay.maxLines * 2);
}

/** Seals a finished big battle into the run's replays (mutates the run). Each battle is kept once. */
export function sealReplay(content: Content, run: RunState): BattleReplay | null {
  const battle = run.battle;
  const kind = battle ? replayKind(battle) : null;
  if (!battle || !kind || (battle.outcome !== 'win' && battle.outcome !== 'lose')) return null;
  const id = `${run.runId}:r${run.regionIndex}:s${run.stage?.index ?? 0}:e${run.encountersCompleted}`;
  if (run.story.replays.some((r) => r.id === id)) return null;
  const foe = battle.trainer?.name ?? currentEnemy(battle).speciesId;
  const label = { gym: 'Gym battle', elite: 'Elite Four battle', champion: 'Champion battle', rival: 'Rival battle', nemesis: 'Nemesis battle', ghost: 'Ghost battle', gauntlet: 'Gauntlet battle', echo: 'Echo battle' }[kind];
  const record: BattleReplay = {
    id,
    kind,
    title: `${label} against ${foe}`,
    outcome: battle.outcome,
    region: run.regionIndex,
    stage: run.stage?.index ?? 0,
    foe: { name: foe, team: battle.enemyTeam.map((m) => m.speciesId) },
    team: [...new Set(battle.participants.map((u) => run.party.find((m) => m.uid === u)?.speciesId).filter((s): s is string => Boolean(s)))],
    turns: battle.turn,
    lines: trimReplay(battle.drama.replay ?? [], MEMORIES.replay.maxLines),
  };
  // Lost fights are always kept; wins fill the rest of the room, oldest dropped first.
  run.story.replays = [...run.story.replays, record].slice(-MEMORIES.replay.maxPerRun);
  return record;
}
