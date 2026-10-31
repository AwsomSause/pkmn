// The Shadow and Blissful world (APPROVED.md §12-14). Two independent forces, no morality meter: evil factions run
// operations that grow while ignored, and kindness opens sanctuaries. Everything the world remembers is a counter in
// run.story.flags ("ev:<key>", so map events can read it with the `flag` condition) and every roll comes from a
// generator of its own, so none of the rolls that existed before it move.

import type { Content } from '../contentSchema';
import { hashSeed, Rng } from '../rng';
import { getCampaign } from '../regions';
import type { PokemonInstance, RunState } from '../state';
import { makeShadow, rollShadowHeart } from '../shadow';
import type { Faction } from './schema';
import type { RaidDef } from '../raid/schema';

export const flagOf = (run: Pick<RunState, 'story'>, key: string): number => Number(run.story.flags[`ev:${key}`] ?? 0);
export function addFlag(run: Pick<RunState, 'story'>, key: string, amount = 1): number {
  const next = flagOf(run, key) + amount;
  run.story.flags[`ev:${key}`] = next;
  return next;
}
const setFlag = (run: Pick<RunState, 'story'>, key: string, value: number) => void (run.story.flags[`ev:${key}`] = value);

export const activityOf = (run: Pick<RunState, 'story'>, factionId: string) => flagOf(run, `shadow-activity-${factionId}`);
/** All factions' operations together (events read this; each faction also keeps its own count for the intel lines). */
export const totalActivity = (run: Pick<RunState, 'story'>) => flagOf(run, 'shadow-activity');
export const outbreakActive = (run: Pick<RunState, 'story'>) => flagOf(run, 'shadow-outbreak') > 0;

const factionById = (content: Content, id: string): Faction | undefined => content.shadowWorld.factions.find((f) => f.id === id);
const ordinal = (content: Content, run: RunState) => run.regionIndex * getCampaign(content, run.campaignId).stagesPerRegion + (run.stage?.index ?? 0) + 1;

/**
 * Called when a stage starts, before its stops are chosen. Operations grow by one a stage for the faction the
 * stage's roll picks (so ignoring a faction lets it expand); a quiet stage may begin a Shadow outbreak; kindness
 * so far may make a sanctuary sign appear. Skips the Pokémon League.
 */
export function advanceShadowWorld(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const rng = new Rng(hashSeed(`${run.seed}::shadow-world::${run.regionIndex}:${stage.index}`));
  const number = ordinal(content, run);
  const active = content.shadowWorld.factions.filter((f) => number >= f.startStage);
  if (active.length > 0) {
    const f = rng.pick(active);
    addFlag(run, `shadow-activity-${f.id}`);
    addFlag(run, 'shadow-activity');
  }
  // A Shadow outbreak: a route taints once the factions have been busy; it stays until someone settles it.
  if (!outbreakActive(run) && totalActivity(run) >= 3 && rng.chance(0.25)) setFlag(run, 'shadow-outbreak', 1);
  // A sanctuary sign: kindness opens the door (a pattern of it, not a score; the sign stays until it is found).
  if (flagOf(run, 'sanctuary-sign') === 0 && flagOf(run, 'kindness') >= 2 && rng.chance(0.4)) setFlag(run, 'sanctuary-sign', 1);
}

/** Gang raid dens: a faction at 2+ operations may hide a stronghold beside a node. Its own generator; no ordinary den moves. */
export function placeGangDen(content: Content, run: RunState): void {
  const stage = run.stage;
  if (!stage || stage.kind !== 'stage') return;
  const rng = new Rng(hashSeed(`${run.seed}::gang-den::${run.regionIndex}:${stage.index}`));
  const open = content.shadowWorld.factions.filter((f) => activityOf(run, f.id) >= 2 && totalActivity(run) >= 2);
  if (open.length === 0) return;
  const f = rng.pick(open);
  if (!rng.chance(Math.min(0.7, 0.2 * activityOf(run, f.id)))) return;
  const raids = content.raids.raids.filter((r) => r.gang?.faction === f.id && r.tier <= Math.max(1, run.regionIndex + 2));
  const candidates = stage.map.nodes.filter((n) => n.column < stage.map.columns && !n.sides.some((s) => s.kind === 'raid'));
  if (raids.length === 0 || candidates.length === 0) return;
  const node = rng.pick(candidates);
  node.sides.push({ id: `raid-gang-${stage.index}`, kind: 'raid', raidId: rng.pick(raids).id, used: false });
}

/** The lines the den shows before the player pays: the faction, what it is up to, and its lieutenant if they have met. */
export function gangNotes(content: Content, run: RunState, def: RaidDef): string[] {
  const g = def.gang;
  const f = g && factionById(content, g.faction);
  if (!g || !f) return [];
  const notes = [`${f.name}: ${f.aim}`];
  const ops = activityOf(run, f.id);
  if (ops >= 3) notes.push(`Operations: ${ops}. ${f.expands}`);
  if (flagOf(run, `lt-${f.id}`) > 0) notes.push(f.lieutenant.returns);
  else if (g.lieutenant) notes.push(f.lieutenant.intro);
  if (flagOf(run, `liberated-${f.id}`) > 0) notes.push('Fewer guards than before: your last raid hurt them.');
  return notes;
}

/** Hp boost (percent) a gang raid loses for each hideout of that faction already liberated (the operation is weaker). */
export const liberatedHpDiscount = (run: Pick<RunState, 'story'>, factionId: string) => Math.min(40, flagOf(run, `liberated-${factionId}`) * 15);

/** A won gang raid: operations fall, the hideout is liberated, and the lieutenant either falls or escapes to return. */
export function gangRaidWon(content: Content, run: RunState, def: RaidDef): string[] {
  const g = def.gang;
  const f = g && factionById(content, g.faction);
  if (!g || !f) return [];
  const notes: string[] = [];
  const key = `shadow-activity-${f.id}`;
  setFlag(run, key, Math.max(0, flagOf(run, key) - g.heatDrop));
  setFlag(run, 'shadow-activity', Math.max(0, totalActivity(run) - g.heatDrop));
  addFlag(run, `liberated-${f.id}`);
  addFlag(run, 'rescued');
  notes.push(`${f.name} loses a hideout. Their operations shrink.`);
  if (g.lieutenant) {
    if (flagOf(run, `lt-${f.id}`) < 2) {
      addFlag(run, `lt-${f.id}`);
      addFlag(run, 'lieutenant-loose');
      notes.push(`${f.lieutenant.name} slips away and will be back.`);
    } else {
      setFlag(run, 'lieutenant-loose', Math.max(0, flagOf(run, 'lieutenant-loose') - 1));
      notes.push(`${f.lieutenant.name} is finally caught. ${f.name} is leaderless in this region.`);
    }
  }
  return notes;
}

/** An outbreak taints a share of the stage's wild encounters with Shadow haze (a generator of its own, per node). */
export function outbreakShadow(content: Content, run: RunState, enemy: PokemonInstance, nodeId: string): boolean {
  if (!outbreakActive(run) || enemy.shadow) return false;
  const rng = new Rng(hashSeed(`${run.seed}::outbreak-wild::${nodeId}`));
  if (!rng.chance(content.shadowWorld.outbreakWildPercent / 100)) return false;
  makeShadow(enemy, rollShadowHeart(content, rng));
  return true;
}
