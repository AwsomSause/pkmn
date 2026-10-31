// Totems with doubles (true 2v1): the ally stands beside the Totem, aura and phases run, status field effect, Mega Stone reward.

import { describe, expect, it } from 'vitest';
import { enterTotem, chooseStarter, createRun, takeTurn } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { getTotem } from '../../src/core/totem/totem';
import { content } from './helpers';

function runAt(totemId: string, seed: string, partySize: number): RunState {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'td', seed, archetypeId: 'red' }), 0));
  const node = run.stage!.map.nodes.find((n) => n.column === 1)!;
  node.sides = node.sides.filter((s) => s.kind !== 'totem' && s.kind !== 'raid');
  node.sides.push({ id: 'totem-test', kind: 'totem', totemId, used: false });
  run.stage!.current = node.id;
  run.money = 99999;
  while (run.party.length < partySize) run.party.push({ ...structuredClone(run.party[0]!), uid: `p-extra${run.party.length}` });
  return run;
}

describe('Totem 2v1', () => {
  it('with two Pokémon able to fight, the ally stands beside the Totem as a double battle', () => {
    const started = enterTotem(content, runAt('totem-salazzle', 'td-1', 2), 'totem-test');
    const b = started.battle!;
    expect(b.doubles).toBeTruthy();
    expect(b.enemyTeam.map((m) => m.speciesId)).toEqual([getTotem(content, 'totem-salazzle').species[0], 'salandit']);
    expect(b.totem!.allyUid).toBe(b.enemyTeam[1]!.uid);
    expect(b.totem!.callsUsed).toBe(getTotem(content, 'totem-salazzle').ally!.maxCalls);
  });

  it('alone, the Totem keeps the mid-fight ally call (one-on-one)', () => {
    const b = enterTotem(content, runAt('totem-salazzle', 'td-2', 1), 'totem-test').battle!;
    expect(b.doubles).toBeFalsy();
    expect(b.enemyTeam).toHaveLength(1);
    expect(b.totem!.callsUsed).toBe(0);
  });

  it('a Totem without twoVsOne is unchanged', () => {
    const b = enterTotem(content, runAt('totem-gumshoos', 'td-3', 2), 'totem-test').battle!;
    expect(b.doubles).toBeFalsy();
  });

  it('plays turns and the aura fires once', () => {
    let run = enterTotem(content, runAt('totem-salazzle', 'td-4', 2), 'totem-test');
    for (let i = 0; i < 3 && run.battle && !run.battle.outcome; i++) run = takeTurn(content, run, { kind: 'move', index: 0 }).run;
    if (run.battle) expect(run.battle.totem!.auraDone).toBe(true);
  });

  it('the territory spreads its status over a long fight', () => {
    let run = enterTotem(content, runAt('totem-salazzle', 'td-5', 2), 'totem-test');
    for (const m of run.party) m.hp = 9999;
    let seen = false;
    for (let i = 0; i < 40 && run.battle && !run.battle.outcome; i++) {
      run = takeTurn(content, run, { kind: 'double', commands: [{ action: { kind: 'idle' } }, { action: { kind: 'idle' } }] }).run;
      if (run.party.some((m) => m.status?.id === 'psn')) seen = true;
    }
    expect(seen).toBe(true);
  });

  it('every two-versus-one Totem has an ally and valid data', () => {
    const list = content.totems.totems.filter((t) => t.twoVsOne);
    expect(list.length).toBeGreaterThanOrEqual(6);
    for (const t of list) expect(t.ally).not.toBeNull();
    expect(content.totems.totems.filter((t) => t.fieldEffect).length).toBeGreaterThanOrEqual(3);
    expect(content.totems.totems.filter((t) => t.rewards.megaStones > 0).length).toBeGreaterThanOrEqual(3);
  });
});
