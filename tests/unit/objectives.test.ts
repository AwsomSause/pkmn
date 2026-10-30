import { describe, expect, it } from 'vitest';
import { pinnedObjective } from '../../src/core/objectives';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

describe('pinned objective (catalog #121)', () => {
  it('pins the Run Quest first, then the directive, then nothing', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'o', seed: 'obj', archetypeId: 'red' }), 0);
    const quest = content.runQuests.get(run.runQuest ?? '');
    if (quest) {
      expect(pinnedObjective(content, run)).toMatchObject({ kind: 'runQuest', text: quest.text, current: 0 });
      run.log.counters[quest.counter] = quest.atLeast;
    }
    run.prep = { ...run.prep, directive: 'fire' };
    expect(pinnedObjective(content, run)).toMatchObject({ kind: 'directive', current: 0 });
    run.log.counters['defeatedOrCaught.fire'] = 99;
    expect(pinnedObjective(content, run)).toBeNull();
  });
});
