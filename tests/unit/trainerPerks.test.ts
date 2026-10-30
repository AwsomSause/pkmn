// Trainers.md perks (batch 1: Aaron to Bianca). Pure perk maths, the data, and the run-level effects.

import { describe, expect, it } from 'vitest';
import { getArchetype } from '../../src/core/archetypes';
import { calcStats } from '../../src/core/pokemon';
import { chooseStarter, createRun, releaseLimitReached, shopPrice } from '../../src/core/run';
import {
  damageDealtPerk, damageTakenPerk, evolutionLevelOffset, isLegendaryLike, megaPartyLimit, permanentMegaFriendship,
  regionLevelOffset, releaseLimit, signatureMoveFor, startingAttributes, statPerk, statusChancePerk, statusTurnsPerk,
  survivalChance, syncHpPerks, xpPerk,
} from '../../src/core/trainerPerks';
import { autoplay, gameplayFingerprint } from './autoplay';
import { content } from './helpers';

const perks = (id: string) => getArchetype(content, id).modifiers;
const hit = { userTypes: ['bug'] as const, physical: true, hpShare: 1, userLevel: 20, targetLevel: 20, targetIsBoss: false, weather: null, moveType: 'bug' as const, userBaseSpeed: 70, userIsMega: false, partyHasMega: false };

describe('trainer perks, batch 1', () => {
  it('imports the 20 trainers with pros and cons from Trainers.md', () => {
    const ids = ['aaron', 'acerola', 'adaman', 'agatha-lgpe', 'alain', 'alder', 'allister', 'anabel-gen-7', 'archie-gen-6', 'archie-usum', 'arezu', 'ash-kalos', 'ash', 'az', 'ball-guy', 'barry', 'bea', 'bede', 'benga', 'bianca-pwt'];
    for (const id of ids) {
      const a = getArchetype(content, id);
      expect(a.pros.length, id).toBeGreaterThan(0);
      expect(a.cons.length, id).toBeGreaterThan(0);
      expect(a.modifiers.length, id).toBeGreaterThan(0);
      expect(a.unlockedByDefault).toBe(false);
    }
  });

  it('damage perks follow type, category, speed, HP, level gap, boss and Mega rules', () => {
    expect(damageDealtPerk(perks('aaron'), hit)).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('aaron'), { ...hit, userTypes: ['fire'] })).toBe(1);
    expect(damageDealtPerk(perks('adaman'), { ...hit, physical: false })).toBeCloseTo(0.9);
    expect(damageDealtPerk(perks('alder'), { ...hit, hpShare: 0.4 })).toBeCloseTo(1.25);
    expect(damageDealtPerk(perks('alder'), { ...hit, hpShare: 0.5 })).toBe(1);
    expect(damageDealtPerk(perks('benga'), { ...hit, targetIsBoss: true })).toBeCloseTo(1.15);
    expect(damageDealtPerk(perks('arezu'), { ...hit, userBaseSpeed: 40 })).toBeCloseTo(0.9);
    expect(damageDealtPerk(perks('alain'), { ...hit, partyHasMega: true })).toBeCloseTo(0.95);
    expect(damageDealtPerk(perks('alain'), { ...hit, partyHasMega: true, userIsMega: true })).toBe(1);
    expect(damageDealtPerk(perks('archie-usum'), { ...hit, userTypes: ['water'], moveType: 'water', weather: 'rain' })).toBeCloseTo(1.25);
    expect(damageDealtPerk(perks('bede'), { ...hit, userTypes: ['psychic', 'fairy'] })).toBeCloseTo(1.2);
  });

  it('damage taken perks', () => {
    const base = { targetTypes: ['fire'] as const, moveType: 'water' as const, attackerIsLegendary: false, attackerIsBoss: false, weather: null };
    expect(damageTakenPerk(perks('alain'), base)).toBeCloseTo(1.15);
    expect(damageTakenPerk(perks('alain'), { ...base, moveType: 'grass' })).toBe(1);
    expect(damageTakenPerk(perks('ash-kalos'), { ...base, attackerIsLegendary: true })).toBeCloseTo(1.1);
    expect(damageTakenPerk(perks('ash'), { ...base, attackerIsBoss: true })).toBeCloseTo(1.1);
    expect(damageTakenPerk(perks('archie-usum'), { ...base, moveType: 'fire', weather: 'sun' })).toBeCloseTo(1.35);
  });

  it('experience, stats, status and survival perks', () => {
    const xp = { types: ['ghost'] as const, baseSpeed: 100, isStarter: false, isBossBattle: false };
    expect(xpPerk(perks('acerola'), xp)).toBe(1);
    expect(xpPerk(perks('acerola'), { ...xp, types: ['fire'] })).toBeCloseTo(0.85);
    expect(xpPerk(perks('adaman'), xp)).toBeCloseTo(1.1);
    expect(xpPerk(perks('benga'), xp)).toBeCloseTo(0.8);
    expect(xpPerk(perks('benga'), { ...xp, isBossBattle: true })).toBe(1);
    expect(statPerk(perks('barry'), 'spe', ['fire'])).toBeCloseTo(1.2);
    expect(statPerk(perks('bea'), 'spd', ['fire'])).toBeCloseTo(0.85);
    expect(survivalChance(perks('acerola'), ['ghost'])).toBeCloseTo(0.15);
    expect(survivalChance(perks('acerola'), ['fire'])).toBe(0);
    expect(statusTurnsPerk(perks('agatha-lgpe'), 5)).toBe(6);
    expect(statusChancePerk(perks('allister'), ['ghost'])).toBeCloseTo(1.15);
    expect(statusChancePerk(perks('allister'), ['fire'])).toBe(1);
  });

  it('run-level numbers', () => {
    expect(evolutionLevelOffset(perks('alder'))).toBe(5);
    expect(regionLevelOffset(perks('bianca-pwt'))).toBe(-1);
    expect(startingAttributes(perks('ash'))).toEqual({ luck: 20 });
    expect(releaseLimit(perks('ash'))).toBe(6);
    expect(releaseLimit(perks('aaron'))).toBeNull();
    expect(permanentMegaFriendship(perks('alain'))).toBe(220);
    expect(megaPartyLimit(perks('alain'))).toBe(1);
    expect(isLegendaryLike(content.species.get('mewtwo')!)).toBe(true);
    expect(isLegendaryLike(content.species.get('buzzwole')!)).toBe(true);
    expect(isLegendaryLike(content.species.get('pikachu')!)).toBe(false);
  });

  it('Ash starts with 20 Luck, a signature move on the starter and a release limit', () => {
    let run = createRun(content, { runId: 't', seed: 'ash-test', archetypeId: 'ash' });
    expect(run.attributeModifiers.luck).toBe(20);
    run = chooseStarter(content, run, 0);
    const starter = run.party[0]!;
    const signature = signatureMoveFor(content, starter.speciesId);
    if (signature) expect(starter.moves.some((m) => m.id === signature)).toBe(true);
    expect(releaseLimitReached(content, run)).toBe(false);
    run.log.counters.caughtToCandies = 6;
    expect(releaseLimitReached(content, run)).toBe(true);
  });

  it('AZ starts three levels higher and Ball Guy sells balls cheaper', () => {
    const base = chooseStarter(content, createRun(content, { runId: 't', seed: 's', archetypeId: 'red' }), 0).party[0]!;
    const az = chooseStarter(content, createRun(content, { runId: 't', seed: 's', archetypeId: 'az' }), 0).party[0]!;
    expect(az.level).toBe(base.level + 3);
    const ball = content.shop.find((e) => e.item === 'poke-ball')!;
    const potion = content.shop.find((e) => e.item === 'potion')!;
    const price = (id: string, e: typeof ball) => shopPrice(content, createRun(content, { runId: 't', seed: 's', archetypeId: id }), e);
    expect(price('ball-guy', ball)).toBeLessThan(price('red', ball));
    expect(price('ball-guy', potion)).toBeGreaterThan(price('red', potion));
  });

  it('HP perks raise max HP and keep it in step', () => {
    const run = chooseStarter(content, createRun(content, { runId: 't', seed: 's', archetypeId: 'az' }), 0);
    const mon = run.party[0]!;
    syncHpPerks(content, perks('az'), run.party);
    const boosted = calcStats(content, mon).hp;
    syncHpPerks(content, perks('red'), run.party);
    expect(boosted).toBeGreaterThan(calcStats(content, mon).hp);
    expect(mon.hp).toBeLessThanOrEqual(calcStats(content, mon).hp);
  });

  it('every batch-1 trainer plays battles without errors, and the same seed plays the same way', () => {
    const ids = content.archetypes.size > 0 ? [...content.archetypes.keys()].slice(9, 29) : [];
    for (const id of ids) {
      const play = () => autoplay({ seed: `perk-${id}`, archetypeId: id, steps: 220, healOnMap: true, starterLevel: 25 });
      const a = play();
      expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
    }
  }, 120_000);
});
