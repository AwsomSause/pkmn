import { describe, expect, it } from 'vitest';
import { continueLines } from '../../src/core/presentation/continueLines';
import { content } from './helpers';
import { chooseStarter, createRun } from '../../src/core/run';

describe('Continue card lines', () => {
  it('names the trainer, region and stage, party and money', () => {
    const run = chooseStarter(content, createRun(content, { runId: 'run-card', seed: 'card-lines', archetypeId: 'red', campaignId: 'full' }), 0);
    const lines = continueLines(content, run);
    expect(lines).toHaveLength(4);
    expect(lines[0]!.length).toBeGreaterThan(0);
    expect(lines[1]).toMatch(/·/);
    expect(lines[2]).toBe(`Party ${run.party.length} · top Lv${Math.max(...run.party.map((p) => p.level))}`);
    expect(lines[3]).toBe(`₽${run.money}`);
  });
});
