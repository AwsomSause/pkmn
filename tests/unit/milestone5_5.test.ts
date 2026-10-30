// Milestone 5.5: Run-Prep. Starter pools and the Starter Laboratory, draft
// rules and their fallbacks, preparation tokens, Bank licenses, loadout
// presets, the Run Build Summary, and save upgrades.

import { describe, expect, it } from 'vitest';
import { createProfile } from '../../src/core/profile';
import { hashSeed, Rng } from '../../src/core/rng';
import {
  buildSummary,
  buyLicense,
  defaultPrep,
  draftStarters,
  eligibleSpecies,
  licenseProblem,
  poolProblem,
  poolStatus,
  poolTypes,
  presetIn,
  presetParts,
  resolvePrep,
  savePreset,
  startingResources,
  tokenAvailable,
  unlockPool,
} from '../../src/core/runPrep';
import { chooseStarter, createRun } from '../../src/core/run';
import type { Profile, RunPrep } from '../../src/core/state';
import { buildContent, RAW_CONTENT } from '../../src/data';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

const fresh = (extra: Partial<Profile> = {}): Profile => ({ ...createProfile(content, 'p'), ...extra });
const prep = (changes: Partial<RunPrep> = {}): RunPrep => ({ ...defaultPrep(content), ...changes });
const pool = (id: string) => content.starterPools.get(id)!;
const rng = (seed: string) => new Rng(hashSeed(seed));

describe('starter pools and the Starter Laboratory', () => {
  it('starts with only the Classic pool unlocked', () => {
    const p = fresh();
    expect(poolStatus(content, p, pool('classic'))).toBe('unlocked');
    expect(poolStatus(content, p, pool('johto'))).toBe('buyable');
    expect(poolStatus(content, p, pool('hoenn'))).toBe('locked');
    expect(poolStatus(content, p, pool('research'))).toBe('needsLicense');
    expect(poolStatus(content, p, pool('rare'))).toBe('locked');
  });

  it('skips species that are not in the game yet; a pool with too few is "coming later"', () => {
    // Since Milestone 6 every listed species exists, so use a pool with made-up ids.
    const future = { ...pool('johto'), species: ['not-yet-a-pokemon', 'mareep', 'another-future-one'] };
    expect(eligibleSpecies(content, future)).toEqual(['mareep']);
    expect(eligibleSpecies(content, pool('johto'))).toContain('chikorita');
    expect(poolStatus(content, fresh(), future)).toBe('comingLater');
  });

  it('unlocks a pool with Research Points, once', () => {
    expect(poolProblem(content, fresh({ researchPoints: 10 }), pool('johto'))).toMatch(/150 Research Points/);
    const p = unlockPool(content, fresh({ researchPoints: 200 }), 'johto');
    expect(p.researchPoints).toBe(50);
    expect(poolStatus(content, p, pool('johto'))).toBe('unlocked');
    expect(() => unlockPool(content, p, 'johto')).toThrow(/already unlocked/);
  });

  it('needs the requirement (Hoenn: first badge) or license (Research) before buying', () => {
    expect(() => unlockPool(content, fresh({ researchPoints: 999 }), 'hoenn')).toThrow(/first badge/);
    const badge = fresh({ researchPoints: 999, achievements: { 'first-badge': { earnedAt: 'x' } } });
    expect(poolStatus(content, badge, pool('hoenn'))).toBe('buyable');
    expect(() => unlockPool(content, fresh({ researchPoints: 999 }), 'research')).toThrow(/Research License/);
    expect(poolStatus(content, fresh({ licenses: ['research'] }), pool('research'))).toBe('buyable');
  });
});

describe('licenses', () => {
  it('cost Bank Credits and are bought once', () => {
    expect(licenseProblem(fresh({ bankCredits: 10 }), content.licenses.get('field-medic')!)).toMatch(/400 Bank Credits/);
    const p = buyLicense(content, fresh({ bankCredits: 500 }), 'field-medic');
    expect(p.bankCredits).toBe(100);
    expect(p.licenses).toEqual(['field-medic']);
    expect(() => buyLicense(content, p, 'field-medic')).toThrow(/already own/);
  });

  it('open up the Type Focus rule and the Field Kit', () => {
    const p = fresh({ licenses: ['type-specialist', 'field-medic'] });
    expect(resolvePrep(content, fresh(), 'red', prep({ draftRuleId: 'type-focus' })).prep.draftRuleId).toBe('standard');
    expect(resolvePrep(content, p, 'red', prep({ draftRuleId: 'type-focus' })).prep.draftRuleId).toBe('type-focus');
    expect(tokenAvailable(fresh(), content.prepTokens.get('field-kit')!)).toBe(false);
    expect(tokenAvailable(p, content.prepTokens.get('field-kit')!)).toBe(true);
  });
});

describe('draft rules', () => {
  it('Standard draws the same three as before for a seed (old seeds still replay)', () => {
    const a = createRun(content, { runId: 'a', seed: 'same', archetypeId: 'red' });
    const b = createRun(content, { runId: 'b', seed: 'same', archetypeId: 'red', prep: prep() });
    expect(b.starterChoices).toEqual(a.starterChoices);
  });

  it('Type Focus gives three of the chosen type when the pool has enough', () => {
    for (let i = 0; i < 30; i++) {
      const { choices, note } = draftStarters(content, rng(`fire-${i}`), prep({ draftRuleId: 'type-focus', typeFocus: 'fire' }));
      expect(note).toBeNull();
      for (const id of choices) expect(content.species.get(id)!.types).toContain('fire');
    }
  });

  it('Type Focus falls back with a note instead of rerolling forever', () => {
    const { choices, note } = draftStarters(content, rng('ghost'), prep({ draftRuleId: 'type-focus', typeFocus: 'ghost' }));
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    expect(choices.filter((id) => content.species.get(id)!.types.includes('ghost'))).toEqual(['gastly']);
    expect(note).toMatch(/only 1 Ghost-type starter;/);
  });

  it('Balanced gives three starters with no shared types', () => {
    for (let i = 0; i < 30; i++) {
      const { choices, note } = draftStarters(content, rng(`bal-${i}`), prep({ draftRuleId: 'balanced' }));
      expect(note).toBeNull();
      const types = choices.flatMap((id) => content.species.get(id)!.types);
      expect(new Set(types).size).toBe(types.length);
    }
  });

  it('Balanced falls back with a note when the pool cannot manage it', () => {
    const raw = structuredClone(RAW_CONTENT) as any;
    raw.runPrep.starterPools[0].species = ['charmander', 'vulpix', 'growlithe'];
    const c = buildContent(raw);
    const { choices, note } = draftStarters(c, rng('fires'), { ...defaultPrep(c), draftRuleId: 'balanced' });
    expect(choices).toHaveLength(3);
    expect(note).toMatch(/share a type/);
  });

  it('only offers types that are in the pool', () => {
    const types = poolTypes(content, pool('classic'));
    expect(types).toContain('fire');
    expect(types).not.toContain('dragon');
    const resolved = resolvePrep(content, fresh({ licenses: ['type-specialist'] }), 'red', prep({ draftRuleId: 'type-focus', typeFocus: 'dragon' }));
    expect(types).toContain(resolved.prep.typeFocus);
    expect(resolved.problems.join(' ')).toMatch(/No Dragon-type starters/);
  });

  it('a run remembers its rule, pool and any fallback note', () => {
    const run = createRun(content, { runId: 'r', seed: 'note', archetypeId: 'red', prep: prep({ draftRuleId: 'type-focus', typeFocus: 'ghost' }) });
    expect(run.prep.draftRuleId).toBe('type-focus');
    expect(run.prep.note).toMatch(/Ghost/);
  });
});

describe('preparation tokens and starting resources', () => {
  it('tokens unlock through achievements', () => {
    const money = content.prepTokens.get('pocket-money')!;
    expect(tokenAvailable(fresh(), money)).toBe(false);
    expect(tokenAvailable(fresh({ achievements: { 'first-steps': { earnedAt: 'x' } } }), money)).toBe(true);
  });

  it('a token adds money or items on top of the trainer and the base Bag', () => {
    const brock = content.archetypes.get('brock')!;
    const res = startingResources(content, brock, prep({ tokenId: 'field-kit' }));
    expect(res.items.potion).toBe(content.balance.startingItems.potion! + brock.startingItems.potion!);
    expect(res.items['super-potion']).toBe(3);
    expect(res.items.revive).toBe(1);
    const run = createRun(content, { runId: 'r', seed: 'tok', archetypeId: 'red', prep: prep({ tokenId: 'pocket-money' }) });
    expect(run.money).toBe(content.balance.money.startingMoney + 1000);
  });

  it('an unavailable choice is replaced and reported before the run starts', () => {
    const resolved = resolvePrep(content, fresh(), 'brock', prep({ poolId: 'rare', tokenId: 'pocket-money' }));
    expect(resolved.archetypeId).toBe('red');
    expect(resolved.prep.poolId).toBe('classic');
    expect(resolved.prep.tokenId).toBeNull();
    expect(resolved.problems).toHaveLength(3);
  });
});

describe('loadout presets and the build summary', () => {
  it('saves and loads presets by slot', () => {
    const preset = { ...prep({ draftRuleId: 'blind' }), name: 'Blind Red', archetypeId: 'red' };
    let p = savePreset(content, fresh(), 2, preset);
    expect(presetIn(p, 0)).toBeNull();
    expect(presetIn(p, 2)!.name).toBe('Blind Red');
    expect(presetParts(presetIn(p, 2)!)).toEqual({ archetypeId: 'red', prep: prep({ draftRuleId: 'blind' }) });
    expect(() => savePreset(content, p, content.balance.presetSlots, preset)).toThrow(/no preset slot/);
    p = savePreset(content, p, 2, { ...preset, name: 'Replaced' });
    expect(presetIn(p, 2)!.name).toBe('Replaced');
  });

  it('a preset that refers to something no longer unlocked is resolved, not used as is', () => {
    const preset = { ...prep({ poolId: 'johto' }), name: 'Johto', archetypeId: 'red' };
    const parts = presetParts(preset);
    const resolved = resolvePrep(content, fresh(), parts.archetypeId, parts.prep);
    expect(resolved.prep.poolId).toBe('classic');
    expect(resolved.problems[0]).toMatch(/Johto pool isn't unlocked/);
  });

  it('the summary shows the trainer, pool, rule, token and starting resources', () => {
    const lines = buildSummary(content, 'green', prep({ tokenId: 'ball-bundle' })).join('\n');
    expect(lines).toMatch(/Trainer: Green/);
    expect(lines).toMatch(/Classic pool \(12 species\), Standard/);
    expect(lines).toMatch(/Ball Bundle/);
    expect(lines).toMatch(/Great Ball ×5/);
  });
});

describe('content checks and save upgrades', () => {
  it('rejects a pool listing an unknown species, an unknown license, or a token with an unknown item', () => {
    const raw = structuredClone(RAW_CONTENT) as any;
    raw.runPrep.starterPools[1].species.push('not-a-species');
    raw.runPrep.draftRules[0].license = 'nope';
    raw.runPrep.tokens[0].items = { 'not-an-item': 1 };
    expect(() => buildContent(raw)).toThrow(/not-a-species[\s\S]*nope|nope[\s\S]*not-a-species/);
    expect(() => buildContent(raw)).toThrow(/not-an-item/);
  });

  it('upgrades a v3 profile and a v5 run', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const { unlockedPools: _a, licenses: _b, presets: _c, lastPrep: _d, ...oldProfile } = createProfile(content, 'old');
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 3, savedAt: 'x', data: oldProfile }));
    const loaded = saves.loadOrCreateProfile(() => 'new').profile;
    expect(loaded.profileId).toBe('old');
    expect(loaded.presets).toEqual([]);
    expect(loaded.licenses).toEqual([]);

    const run = chooseStarter(content, createRun(content, { runId: 'old-run', seed: 's', archetypeId: 'red', campaignId: 'dev' }), 0);
    const { prep: _p, ...oldRun } = run;
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 5, savedAt: 'x', data: oldRun }));
    const result = saves.loadRun();
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.prep).toEqual({ campaignId: 'dev', poolId: 'classic', draftRuleId: 'standard', typeFocus: null, tokenId: null, note: null, directive: null, license: null });
  });
});
