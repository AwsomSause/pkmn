// Evil Teams in the Trainer Plaza (spec §33 "Plaza + Evil Teams"): a disguised member walks in the crowd (secret and
// front teams hide behind their front, open ones just look shifty) and can be unmasked or bought from; the executive
// you have met comes back with a line that follows your past meetings (and supplies, if you made a deal); and while the
// team controls the region's trade, the stalls charge more. Presence is a hash of the run seed and stage, so a reload
// shows the same plaza; nothing here rolls a gameplay stream.

import type { Content } from '../contentSchema';
import { stageKey } from '../mapItems';
import { hashSeed, Rng } from '../rng';
import type { RunState } from '../state';
import { teamText } from './content';
import type { EvilTeam } from './schema';
import { evilOf, evilTeam, villainLine } from './teams';

const roll = (run: RunState, label: string): number => new Rng(hashSeed(`${run.seed}::plaza-evil::${stageKey(run) ?? 'none'}::${label}`)).float();

export interface PlazaAgent {
  team: EvilTeam;
  name: string;
  line: string;
  sprite: string;
}

/** A disguised team member in the plaza crowd this stage, or null (needs the story under way and not over). */
export function plazaAgent(content: Content, run: RunState): PlazaAgent | null {
  const team = evilTeam(content, run);
  const s = run.story.evil;
  if (!team || !s || s.end !== 'none' || s.beat < 1) return null;
  const cfg = content.evilTeams.plaza;
  if (roll(run, 'agent') >= cfg.agentChance) return null;
  const look = team.style === 'open' ? cfg.open : cfg.hidden;
  return { team, name: teamText(team, look.name), line: teamText(team, look.line), sprite: team.ranks.grunt.sprite };
}

/** The executive you have met, back in the plaza (a line from your history with them), or null. */
export function plazaVillain(content: Content, run: RunState): { team: EvilTeam; name: string; line: string; allied: boolean; sprite: string } | null {
  const team = evilTeam(content, run);
  const s = run.story.evil;
  const rec = s?.villains.executive;
  if (!team || !s || !rec || rec.met < 1 || (s.end !== 'none' && s.end !== 'allied')) return null;
  if (roll(run, 'villain') >= content.evilTeams.plaza.villainChance) return null;
  const allied = s.end === 'allied';
  const line = allied ? teamText(team, content.evilTeams.plaza.allied) : villainLine(team, 'executive', rec);
  return { team, name: team.ranks.executive.name, line, allied, sprite: team.ranks.executive.sprite };
}

/** The stall price multiplier while the team controls this region's trade (a trade or control operation running or let through). */
export function evilMarkup(content: Content, run: RunState): { factor: number; note: string | null } {
  const team = evilTeam(content, run);
  if (!team || !run.story.evil) return { factor: 1, note: null };
  const op = evilOf(run).ops.find((o) => o.region === run.regionIndex);
  const kind = op ? team.ops.find((o) => o.id === op.id)?.kind : undefined;
  const holds = op && (kind === 'trade' || kind === 'control') && (op.outcome === 'running' || op.outcome === 'succeeded' || op.outcome === 'joined');
  if (!holds) return { factor: 1, note: null };
  const cfg = content.evilTeams.plaza;
  return { factor: 1 + cfg.markup, note: teamText(team, cfg.controlled, { percent: String(Math.round(cfg.markup * 100)) }) };
}
