// Rival Pokémon transfer (Examples section 8): a rival may release a Pokémon it has no trust with, trade one
// with a friend or training partner, or rehome one it loves but cannot look after. Each has a reason on
// record and a consequence: the team changes (it is rebuilt from the saved roster), the bond moves with the
// Pokémon, and the rival's character shifts. Seeded per stage, rival and pair; never the gameplay streams.

import type { Content } from '../contentSchema';
import { hashSeed, Rng } from '../rng';
import { getSpecies } from '../pokemon';
import type { RunState } from '../state';
import type { Rival } from '../story/schema';
import { RIVAL_WORLD } from './schema';

const T = RIVAL_WORLD.transfer;
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const team = (r: Rival): string[] => r.memory.lastBattle.team;
const nameOf = (content: Content, id: string) => getSpecies(content, id).name;
const who = (content: Content, r: Rival) => `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;
const nudge = (r: Rival, key: 'empathy', n: number) => { r.traits[key] = clamp(r.traits[key] + n); };

/** Takes a species from a rival's roster; its bond goes with it. */
function takeOut(r: Rival, speciesId: string) {
  r.memory.lastBattle.team = team(r).filter((id) => id !== speciesId);
  const bond = r.bonds[speciesId];
  delete r.bonds[speciesId];
  return bond;
}

/** The Pokémon a rival has the least trust in and the most strain with, if it meets the release rule. */
function unhappiest(r: Rival): string | null {
  const ids = team(r).filter((id) => {
    const b = r.bonds[id];
    return b && b.trust <= T.releaseMaxTrust && b.strain >= T.releaseMinStrain;
  });
  ids.sort((a, b) => r.bonds[a]!.trust - r.bonds[b]!.trust || a.localeCompare(b));
  return ids[0] ?? null;
}

/** The loved-but-strained Pokémon a rival might rehome. */
function strained(r: Rival): string | null {
  const ids = team(r).filter((id) => {
    const b = r.bonds[id];
    return b && b.affection >= T.rehomeMinAffection && b.strain >= T.rehomeMinStrain;
  });
  ids.sort((a, b) => r.bonds[b]!.strain - r.bonds[a]!.strain || a.localeCompare(b));
  return ids[0] ?? null;
}

/** One stage of transfers. Returns the first thing worth a rumour, or null. */
export function rivalTransfers(content: Content, run: RunState, stageKey: string): string | null {
  const rivals = run.story.rivals.filter((r) => r.state !== 'retired');
  let rumor: string | null = null;
  // Release: a Pokémon that does not trust its trainer and is under strain is let go (the team keeps at least `minTeam`).
  for (const r of rivals) {
    const id = unhappiest(r);
    if (!id || team(r).length <= T.minTeam) continue;
    if (new Rng(hashSeed(`${run.seed}::rival-release::${stageKey}::${r.id}`)).float() >= T.releaseChance) continue;
    takeOut(r, id);
    nudge(r, 'empathy', T.releaseEmpathy);
    rumor ??= `${who(content, r)} released ${nameOf(content, id)}: it never trusted them`;
  }
  // Trade and rehome: only between rivals who get on (friends or training partners).
  for (const e of run.story.rivalGraph) {
    if (e.kind === 'enemies') continue;
    const a = rivals.find((r) => r.id === e.a);
    const b = rivals.find((r) => r.id === e.b);
    if (!a || !b) continue;
    const rng = new Rng(hashSeed(`${run.seed}::rival-transfer::${stageKey}::${e.a}::${e.b}`));
    const roll = rng.float();
    const giveA = strained(a);
    const giveB = strained(b);
    if (roll < T.rehomeChance && giveA && team(b).length < T.maxTeam && !team(b).includes(giveA)) {
      const bond = takeOut(a, giveA)!;
      b.memory.lastBattle.team = [...team(b), giveA];
      b.bonds[giveA] = { ...bond, trust: clamp(bond.trust - T.tradeTrustLoss), strain: 10 };
      nudge(a, 'empathy', T.rehomeEmpathy);
      rumor ??= `${who(content, a)} gave ${nameOf(content, giveA)} to ${who(content, b)}: it needed more than they could give`;
    } else if (roll >= 1 - T.tradeChance && giveA === null) {
      const ids = (x: Rival, y: Rival) => team(x).filter((id) => !team(y).includes(id));
      const offerA = ids(a, b).sort()[0];
      const offerB = ids(b, a).sort()[0];
      if (!offerA || !offerB) continue;
      const bondA = takeOut(a, offerA)!;
      const bondB = takeOut(b, offerB)!;
      a.memory.lastBattle.team = [...team(a), offerB];
      b.memory.lastBattle.team = [...team(b), offerA];
      a.bonds[offerB] = { ...bondB, trust: clamp(bondB.trust - T.tradeTrustLoss) };
      b.bonds[offerA] = { ...bondA, trust: clamp(bondA.trust - T.tradeTrustLoss) };
      nudge(a, 'empathy', T.tradeEmpathy);
      nudge(b, 'empathy', T.tradeEmpathy);
      rumor ??= `${who(content, a)} traded ${nameOf(content, offerA)} for ${who(content, b)}'s ${nameOf(content, offerB)}`;
    }
    void giveB;
  }
  return rumor;
}
