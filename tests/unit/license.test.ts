// The Field License (Untitled doc §10): an exploration hint chosen on the Preparation Desk.

import { describe, expect, it } from 'vitest';
import { LICENSES, licenseNote } from '../../src/core/license';
import { defaultPrep } from '../../src/core/runPrep';
import { RunPrepSchema } from '../../src/core/state';
import { chooseStarter, createRun } from '../../src/core/run';
import { content } from './helpers';

function runWith(license: (typeof LICENSES)[number]['id'] | null) {
  const run = chooseStarter(content, createRun(content, { runId: 'r', seed: 'lic', archetypeId: 'red', prep: { ...defaultPrep(content), license } }), 0);
  return run;
}

describe('Field License', () => {
  it('says nothing without a license', () => {
    expect(licenseNote(content, runWith(null))).toBeNull();
  });
  it('each license gives a text and changes no roll', () => {
    for (const l of LICENSES) {
      const run = runWith(l.id);
      const rng = structuredClone(run.rng);
      const text = licenseNote(content, run);
      expect(text, l.id).toBeTruthy();
      expect(run.rng).toEqual(rng);
    }
  });
  it('the boss preview names the leader, the hint names weak types', () => {
    expect(licenseNote(content, runWith('boss'))).toMatch(/uses .* Pokémon/);
    expect(licenseNote(content, runWith('weakness'))).toMatch(/weak to|no common weakness/);
  });
  it('an older prep with no license loads as none', () => {
    const { license: _l, ...old } = defaultPrep(content);
    expect(RunPrepSchema.parse(old).license).toBeNull();
  });
});
