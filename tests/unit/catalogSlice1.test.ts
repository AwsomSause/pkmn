// Master Expansion Catalog slice 1: seed codes, run recap, accessibility profiles, settings v5.

import { describe, expect, it } from 'vitest';
import { applyProfile, nextProfile, PROFILE_ORDER } from '../../src/core/accessibility';
import { buildRecap } from '../../src/core/recap';
import { decodeSeedCode, encodeSeedCode } from '../../src/core/seedCode';
import { chooseStarter, createRun } from '../../src/core/run';
import { STANDARD_CHOICE } from '../../src/core/rules';
import { CURRENT_VERSIONS, DEFAULT_SETTINGS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { eventText } from '../../src/ui/battleText';
import { content } from './helpers';

const rules = { modeId: 'standard', difficultyId: 'standard', modifierIds: ['no-revives'], deathBlock: true };

describe('seed codes', () => {
  it('round-trips seed, trainer and rules', () => {
    const code = encodeSeedCode({ seed: 'my.odd seed/1', archetypeId: 'red', rules });
    const back = decodeSeedCode(code);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.parts.seed).toBe('my.odd seed/1');
      expect(back.parts.archetypeId).toBe('red');
      expect(back.parts.rules.deathBlock).toBe(true);
      expect(back.note).toBeNull();
    }
  });
  it('rejects junk, notes a different rule version', () => {
    expect(decodeSeedCode('hello').ok).toBe(false);
    expect(decodeSeedCode('PR1.1.a.b.nomode.standard..0').ok).toBe(false);
    const old = encodeSeedCode({ seed: 's', archetypeId: 'red', rules: { ...rules, modifierIds: [] } }).replace('PR1.', 'PR1.').split('.');
    old[1] = '0';
    const r = decodeSeedCode(old.join('.'));
    expect(r.ok && r.note).toBeTruthy();
  });
});

describe('run recap', () => {
  it('is calm and complete for a fresh run', () => {
    const run = createRun(content, { runId: 'r', seed: 'recap', archetypeId: 'red' });
    const recap = buildRecap(content, run);
    expect(recap.ending).toBeTruthy();
    expect(recap.rivals).toEqual([]);
  });
});

describe('accessibility profiles', () => {
  it('apply presets and cycle through every profile', () => {
    expect(applyProfile(DEFAULT_SETTINGS, 'reducedMotion')).toMatchObject({ battleAnimations: 'reduced', accessibilityProfile: 'reducedMotion' });
    expect(applyProfile(DEFAULT_SETTINGS, 'moreDetail').damageDetails).toBe(true);
    let p = PROFILE_ORDER[0]!;
    const seen = new Set<string>();
    for (let i = 0; i < PROFILE_ORDER.length; i++) { seen.add(p); p = nextProfile(p); }
    expect(seen.size).toBe(PROFILE_ORDER.length);
  });
  it('migrates settings v4 to v5', () => {
    expect(CURRENT_VERSIONS.settings).toBe(5);
    const storage = new MemoryStorageProvider();
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 4, savedAt: '', data: { musicVolume: 0.3, sfxVolume: 0.4, muted: false, battleAnimations: 'full', effectIntensity: 1, battleSpeed: 'fast', dialogueFrequency: 'low' } }));
    expect(new SaveManager(storage, content).loadSettings()).toMatchObject({ damageDetails: false, accessibilityProfile: 'custom', battleSpeed: 'fast' });
  });
});

describe('damage details', () => {
  it('only shows numbers when asked', () => {
    const e = { type: 'damage', side: 'enemy', amount: 30, hpAfter: 12, effectiveness: 2, crit: false } as const;
    const names = { player: 'A', enemy: 'B', trainer: null, nameOf: () => 'A' };
    expect(eventText(content, names, e)).not.toContain('30 damage');
    expect(eventText(content, names, e, true)).toContain('30 damage, ×2');
  });
});

describe('Run-end stamps (#111)', () => {
  it('earns stamps from the run and only cosmetically', async () => {
    const { runStamps } = await import('../../src/core/recap');
    const run = chooseStarter(content, createRun(content, { runId: 'st', seed: 'st', archetypeId: 'red', rules: STANDARD_CHOICE }), 0);
    expect(runStamps(run)).toEqual([]);
    run.victory = true;
    expect(runStamps(run)).toContain('Victory');
    expect(runStamps(run)).toContain('Untouched');
    Object.values(run.story.histories)[0]!.knockoutsTaken = 1;
    expect(runStamps(run)).not.toContain('Untouched');
  });
});
