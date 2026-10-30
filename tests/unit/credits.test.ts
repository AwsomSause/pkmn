import { describe, expect, it } from 'vitest';
import { buildCredits } from '../../src/core/credits';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

describe('credits', () => {
  const run = chooseStarter(content, createRun(content, { runId: 'cr', seed: 'cr', archetypeId: 'red' }), 0);

  it('names the trainer, every party member and the seed, and is the same every time', () => {
    const lines = buildCredits(content, run);
    const text = lines.map((l) => l.text).join('\n');
    expect(text).toContain(content.archetypes.get('red')!.name);
    for (const m of run.party) expect(text).toContain(content.species.get(m.speciesId)!.name);
    expect(text).toContain('Seed cr');
    expect(buildCredits(content, run)).toEqual(lines);
  });

  it('starts and ends on a title and leaves the run untouched', () => {
    const before = JSON.stringify(run);
    const lines = buildCredits(content, run);
    expect(lines[0]!.kind).toBe('title');
    expect(lines[lines.length - 1]!.kind).toBe('title');
    expect(JSON.stringify(run)).toBe(before);
  });
});
