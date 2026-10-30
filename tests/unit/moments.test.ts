// More Hyper moments (Overdrive blueprint §3): detected from a turn's events, one per battle per Pokémon.

import { describe, expect, it } from 'vitest';
import { maxHp } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import type { RunEvent } from '../../src/core/run';
import { recordBattleTurn } from '../../src/core/story/hooks';
import { MOMENT_EFFECTS } from '../../src/core/story/moments';
import { content, toBattle } from './helpers';

function setup(seed: string) {
  const run = structuredClone(toBattle(chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0)));
  run.battle!.kind = 'trainer';
  return { run, lead: run.party[0]! };
}
const hit = (amount: number, hpAfter: number, effectiveness = 1): RunEvent => ({ type: 'damage', side: 'player', amount, hpAfter, effectiveness, crit: false } as RunEvent);
const titles = (cues: ReturnType<typeof recordBattleTurn>) => cues.map((c) => c.title);

describe('data', () => {
  it('every moment trigger has a definition with the right effect', () => {
    for (const [trigger, effect] of Object.entries(MOMENT_EFFECTS)) {
      const def = content.story.definitions.find((d) => d.triggerConditions.trigger === trigger);
      expect(def?.effect?.kind, trigger).toBe(effect);
    }
  });
});

describe('survival moments', () => {
  it('Turned Its Pain Into Power: a big hit survived raises Attack once', () => {
    const { run, lead } = setup('moment-pain');
    const max = maxHp(content, lead);
    lead.hp = Math.floor(max * 0.4);
    const before = structuredClone(run);
    const cues = recordBattleTurn(content, before, run, [hit(Math.ceil(max * 0.5), lead.hp)]);
    expect(titles(cues)).toContain('It Turned Its Pain Into Power!');
    expect(run.battle!.playerStages.atk).toBe(1);
    // Not again in the same battle.
    const again = recordBattleTurn(content, structuredClone(run), run, [hit(Math.ceil(max * 0.5), lead.hp)]);
    expect(titles(again)).not.toContain('It Turned Its Pain Into Power!');
    expect(run.battle!.playerStages.atk).toBe(1);
  });

  it('Refused Its Weakness: surviving a super-effective hit raises Defense', () => {
    const { run, lead } = setup('moment-weak');
    const cues = recordBattleTurn(content, structuredClone(run), run, [hit(5, lead.hp - 5, 2)]);
    expect(titles(cues)).toContain('It Refused to Be Defined by Its Weakness!');
    expect(run.battle!.playerStages.def).toBe(1);
  });

  it('Second Wind: a long fight at half HP heals 10% once', () => {
    const { run, lead } = setup('moment-wind');
    run.battle!.turn = 9;
    const max = maxHp(content, lead);
    lead.hp = Math.floor(max / 2) - 1;
    const before = structuredClone(run);
    before.battle!.turn = 9;
    const hpBefore = lead.hp;
    recordBattleTurn(content, before, run, []);
    expect(lead.hp).toBeGreaterThan(hpBefore);
    const once = lead.hp;
    recordBattleTurn(content, structuredClone(run), run, []);
    expect(lead.hp).toBe(once);
  });
});

describe('enemy moments', () => {
  it('a boss at half HP is unshaken; ordinary trainers are not', () => {
    const { run } = setup('moment-boss');
    const foe = run.battle!.enemyTeam[run.battle!.enemyIndex]!;
    foe.hp = Math.floor(maxHp(content, foe) / 2);
    const plain = recordBattleTurn(content, structuredClone(run), structuredClone(run), []);
    expect(titles(plain)).not.toContain("The Enemy's Resolve Is Unshaken!");
    run.battle!.trainer = { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' };
    const cues = recordBattleTurn(content, structuredClone(run), run, []);
    expect(titles(cues)).toContain("The Enemy's Resolve Is Unshaken!");
    expect(run.battle!.enemyStages.def).toBe(1);
  });
});
