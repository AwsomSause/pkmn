// Effective attributes (Untitled doc §6): clamp(baseline + trainer + run-earned), in one core function.

import { describe, expect, it } from 'vitest';
import { addRunAttribute, attributeLayers, effectiveAttributes } from '../../src/core/attributes';
import { ATTRIBUTE_KEYS } from '../../src/core/contentSchema';
import { chooseStarter, createRun } from '../../src/core/run';
import { RunStateSchema } from '../../src/core/state';
import { content } from './helpers';

const newRun = (archetypeId: string, attributes?: Record<string, number>) => chooseStarter(content, createRun(content, { runId: 'r', seed: 'layers', archetypeId, attributes }), 0);

describe('attribute layers', () => {
  it('the layers add up to the effective value for every trainer', () => {
    for (const id of content.archetypes.keys()) {
      const run = newRun(id, { luck: 7 });
      const l = attributeLayers(content, run);
      for (const k of ATTRIBUTE_KEYS) {
        expect(l.earned[k], `${id} ${k}`).toBe(0);
        expect(l.effective[k]).toBe(effectiveAttributes(content, run)[k]);
      }
      expect(l.baseline.luck).toBe(7);
    }
  });
  it('run-earned changes sit in their own layer and survive a save and reload', () => {
    const run = newRun('red', { luck: 3 });
    const before = attributeLayers(content, run);
    run.attributeModifiers = { ...run.attributeModifiers, luck: (run.attributeModifiers.luck ?? 0) + 4 };
    const after = attributeLayers(content, run);
    expect(after.earned.luck).toBe(4);
    expect(after.baseline).toEqual(before.baseline);
    expect(after.trainer).toEqual(before.trainer);
    const reloaded = RunStateSchema.parse(JSON.parse(JSON.stringify(run)));
    expect(attributeLayers(content, reloaded)).toEqual(after);
  });
  it('a reward that adds an attribute lands in the earned layer', () => {
    const run = newRun('red');
    addRunAttribute(content, run, 'luck', 5);
    const l = attributeLayers(content, run);
    expect(l.earned.luck).toBe(5);
    expect(l.effective.luck).toBe(l.baseline.luck + l.trainer.luck + 5);
  });
});
