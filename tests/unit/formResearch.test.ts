// Form Research (Untitled doc §8 "Research Quest"): three clues, then a research battle with a regional form.

import { describe, expect, it } from 'vitest';
import { eligibleEvents } from '../../src/core/events';
import { chooseStarter, createRun } from '../../src/core/run';
import { specialFamily } from '../../src/core/specialForms';
import { content } from './helpers';

function runAt(clues: number, stageIndex = 4) {
  const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'form-research', archetypeId: 'red' }), 0);
  run.story.flags['ev:form-clue'] = clues;
  run.stage!.index = stageIndex;
  return run;
}
const ids = (clues: number) => eligibleEvents(content, runAt(clues)).map((e) => e.id).filter((id) => id.startsWith('form-'));

describe('Form Research chain', () => {
  it('offers the three clues first, never the battle', () => {
    expect(ids(0).sort()).toEqual(['form-clue-fur', 'form-clue-sketch', 'form-clue-tracks']);
    expect(ids(2)).not.toContain('form-research-battle');
  });
  it('after three clues only the research battle remains, and its foes are regional forms', () => {
    expect(ids(3)).toEqual(['form-research-battle']);
    const battle = content.events.get('form-research-battle')!;
    const species = JSON.stringify(battle).match(/"species":\[([^\]]*)\]/)![1]!.replace(/"/g, '').split(',');
    expect(species.length).toBeGreaterThan(3);
    for (const id of species) expect(specialFamily(content.species.get(id)!), id).toBe('regional');
  });
});
