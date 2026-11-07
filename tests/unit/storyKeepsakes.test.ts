import { describe, expect, it } from 'vitest';
import { chooseStarter, createRun } from '../../src/core/run';
import { createProfile } from '../../src/core/profile';
import { atTypeDisadvantage, BIRD_LINES, foldKeepsakes, foldStarterMastery, keepsakeDef, keepsakeEvent, keepsakeMark, keepsakesEarned, keepsakeVictory, KEEPSAKES, markKeepsake, NATURE_EVENTS, noteKeepsakeFaint, SLOT_TOTALS, slotCounts, wearKeepsake } from '../../src/core/story2/keepsakes';
import { StoryV2Schema } from '../../src/core/story2/schema';
import { personalityOfMon } from '../../src/core/overhaul/personality';
import { temperamentOf } from '../../src/core/story2/temperament';
import { content } from './helpers';

function setup() {
  const run = structuredClone(chooseStarter(content, createRun(content, { runId: 'kp', seed: 'kp', archetypeId: 'red' }), 0));
  const v2 = StoryV2Schema.parse({ mode: 'story_run' });
  v2.heartbond.partner = run.party[0]!.uid;
  run.story.v2 = v2;
  return { run, v2, tm: temperamentOf(personalityOfMon(run.party[0]!).id) };
}

describe('keepsakes', () => {
  it('the catalog has 20 items with the design slot counts', () => {
    expect(KEEPSAKES).toHaveLength(20);
    expect(slotCounts()).toEqual(SLOT_TOTALS);
    expect(new Set(KEEPSAKES.map((k) => k.id)).size).toBe(20);
  });
  it('earns nothing without a Story Run partner', () => {
    const { run } = setup();
    run.story.v2 = undefined;
    expect(keepsakesEarned(run)).toEqual([]);
  });
  it('latch 5 and 7 give the Charm Necklace and Star Pin for any Starter; a Keystone gives the Tiny Hat', () => {
    const { run, v2 } = setup();
    expect(keepsakesEarned(run)).toEqual([]);
    v2.heartbond.latched = [1, 2, 3, 4, 5];
    expect(keepsakesEarned(run)).toContain('kp_charm_necklace');
    expect(keepsakesEarned(run)).not.toContain('kp_star_pin');
    v2.heartbond.latched = [1, 2, 3, 4, 5, 6, 7];
    v2.feats.gains.push('keystone');
    const got = keepsakesEarned(run);
    expect(got).toEqual(expect.arrayContaining(['kp_charm_necklace', 'kp_star_pin', 'kp_tiny_hat']));
  });
  it('the Bell Collar and Ribbon Bow need the right Temperament', () => {
    const { run, v2, tm } = setup();
    v2.heartbond.latched = [1, 2, 3, 4, 5, 6];
    const got = keepsakesEarned(run);
    expect(got.includes('kp_bell_collar')).toBe(tm === 'tm_playful' || tm === 'tm_mischievous');
    expect(got.includes('kp_ribbon_bow')).toBe(tm === 'tm_affectionate' || tm === 'tm_playful');
  });
  it('only live rules are ever earned', () => {
    const { run, v2 } = setup();
    v2.heartbond.latched = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    v2.feats.gains.push('keystone');
    for (const id of keepsakesEarned(run)) expect(keepsakeDef(id)!.status).toBe('live');
  });
  it('folding adds only new ones, once, and wearing needs an unlock and the right slot', () => {
    const { run, v2 } = setup();
    const profile = createProfile(content, 'p');
    v2.heartbond.latched = [1, 2, 3, 4, 5];
    expect(foldKeepsakes(profile, run)).toContain('kp_charm_necklace');
    expect(foldKeepsakes(profile, run)).toEqual([]);
    expect(wearKeepsake(profile, 'neck', 'kp_star_pin')).toBe(false); // locked
    expect(wearKeepsake(profile, 'head', 'kp_charm_necklace')).toBe(false); // wrong slot
    expect(wearKeepsake(profile, 'neck', 'kp_charm_necklace')).toBe(true);
    expect(profile.story.worn).toEqual({ neck: 'kp_charm_necklace' });
    expect(wearKeepsake(profile, 'neck', null)).toBe(true);
    expect(profile.story.worn).toEqual({});
  });

  it('every Keepsake is now earnable (no "later" rules left)', () => {
    expect(KEEPSAKES.filter((k) => k.status !== 'live')).toEqual([]);
  });
  it('battle marks: Gym wins with the Starter, a clean Gym, the final rival, the League and a type-disadvantage win', () => {
    const { run, v2 } = setup();
    v2.starter = { lineId: 'rm_bulbasaur', temperament: 'tm_protective', keystone: [] };
    const win = { trainerClass: 'gym-leader', partnerFought: true, finalRival: false, disadvantage: false };
    keepsakeVictory(run, win);
    keepsakeVictory(run, win);
    expect(keepsakesEarned(run)).not.toContain('kp_bandana');
    keepsakeVictory(run, win);
    expect(keepsakesEarned(run)).toEqual(expect.arrayContaining(['kp_bandana', 'kp_bowtie']));
    expect(keepsakesEarned(run)).not.toContain('kp_cape');
    keepsakeVictory(run, { trainerClass: 'champion', partnerFought: true, finalRival: true, disadvantage: true });
    expect(keepsakesEarned(run)).toEqual(expect.arrayContaining(['kp_cape', 'kp_medal', 'kp_headband']));
  });
  it('a faint in the Gym battle means no Bowtie; a faint in an earlier battle does not count', () => {
    const { run } = setup();
    noteKeepsakeFaint(run);
    keepsakeVictory(run, { trainerClass: 'gym-leader', partnerFought: false, finalRival: false, disadvantage: false });
    expect(keepsakesEarned(run)).not.toContain('kp_bowtie');
    run.encountersCompleted += 1;
    keepsakeVictory(run, { trainerClass: 'gym-leader', partnerFought: false, finalRival: false, disadvantage: false });
    expect(keepsakesEarned(run)).toContain('kp_bowtie');
  });
  it('the rival Cape needs the Starter in the fight', () => {
    const { run } = setup();
    keepsakeVictory(run, { trainerClass: 'rival', partnerFought: false, finalRival: true, disadvantage: false });
    expect(keepsakesEarned(run)).not.toContain('kp_cape');
  });
  it('event marks: weather, snow and nature events; 5 loved snacks; the Gift; a clue Stop', () => {
    const { run } = setup();
    keepsakeEvent(run, { id: 'wx-fog-bank', group: 'Weather & Hazards', scene: { effect: 'fog' } });
    expect(keepsakesEarned(run)).toContain('kp_goggles');
    expect(keepsakesEarned(run)).not.toContain('kp_scarf');
    keepsakeEvent(run, { id: 'x', group: 'Wild Scenes', scene: { effect: 'snow' } });
    keepsakeEvent(run, { id: NATURE_EVENTS[0]!, group: 'Places and weather' });
    for (let i = 0; i < 4; i++) markKeepsake(run, 'snack_loved');
    expect(keepsakesEarned(run)).not.toContain('kp_flower_pin');
    markKeepsake(run, 'snack_loved');
    markKeepsake(run, 'gift');
    markKeepsake(run, 'clue_smart');
    expect(keepsakesEarned(run)).toEqual(expect.arrayContaining(['kp_scarf', 'kp_flower_crown', 'kp_flower_pin', 'kp_satchel', 'kp_glasses']));
  });
  it('the nature list only names real events', () => {
    for (const id of NATURE_EVENTS) expect(content.events.has(id), id).toBe(true);
    expect([...content.events.values()].some((e) => e.scene?.effect === 'snow')).toBe(true);
  });
  it('Classic runs get no marks', () => {
    const { run } = setup();
    delete run.story.v2;
    markKeepsake(run, 'gift');
    keepsakeEvent(run, { id: 'wx-fog-bank', group: 'Weather & Hazards' });
    expect(keepsakeMark(run, 'gift')).toBe(0);
    expect(run.itemCounters?.['ks:weather']).toBeUndefined();
  });
  it('type disadvantage reads both sides', () => {
    expect(atTypeDisadvantage(content, { speciesId: 'bulbasaur' }, { speciesId: 'charmander' })).toBe(true);
    expect(atTypeDisadvantage(content, { speciesId: 'squirtle' }, { speciesId: 'charmander' })).toBe(false);
    expect(atTypeDisadvantage(content, { speciesId: 'bulbasaur' }, undefined)).toBe(false);
  });
  it('profile rules: Party Hat on the first Story Run, Feather, Leaf Crown via Mastery, Monocle at 10 Lore', () => {
    const { run, v2 } = setup();
    const profile = createProfile(content, 'p');
    v2.starter = { lineId: 'rm_bulbasaur', temperament: 'tm_protective', keystone: [] };
    foldStarterMastery(profile, run);
    expect(profile.story.remembrance['rm_bulbasaur']).toMatchObject({ state: 'unlocked', runs: 1, mastery: 1 });
    const grass = content.storyData.remembrances.filter((r) => r.types.includes('grass')).map((r) => r.id);
    const first = foldKeepsakes(profile, run, grass);
    expect(first).toEqual(expect.arrayContaining(['kp_party_hat', 'kp_leaf_crown']));
    expect(first).not.toContain('kp_feather');
    expect(first).not.toContain('kp_monocle');
    profile.story.remembrance[BIRD_LINES[0]!] = { state: 'unlocked', firstSeenRun: null, runs: 0, mastery: 0 };
    for (let i = 0; i < 10; i++) profile.story.lore[`lore_${i}`] = { state: 'known', sources: [] };
    expect(foldKeepsakes(profile, run, grass)).toEqual(['kp_feather', 'kp_monocle']);
  });
  it('Mastery tiers rise to Trusted Partner and Mastered and never fall', () => {
    const { run, v2 } = setup();
    const profile = createProfile(content, 'p');
    v2.starter = { lineId: 'rm_pidgey', temperament: 'tm_brave', keystone: [] };
    v2.heartbond.latched = [7];
    foldStarterMastery(profile, run);
    expect(profile.story.remembrance['rm_pidgey']!.mastery).toBe(2);
    v2.heartbond.latched = [7, 10];
    v2.feats.gains.push('keystone');
    foldStarterMastery(profile, run);
    expect(profile.story.remembrance['rm_pidgey']).toMatchObject({ mastery: 3, runs: 2 });
    v2.heartbond.latched = [];
    v2.feats.gains = [];
    foldStarterMastery(profile, run);
    expect(profile.story.remembrance['rm_pidgey']!.mastery).toBe(3);
  });
});
