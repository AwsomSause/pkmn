// Trainers.md perks (batch 1: Aaron to Bianca). Pure perk maths, the data, and the run-level effects.

import { describe, expect, it } from 'vitest';
import { getArchetype } from '../../src/core/archetypes';
import { calcStats } from '../../src/core/pokemon';
import { chooseStarter, createRun, depositToBox, partyCapacity, releaseLimitReached, shopPrice, withdrawFromBox } from '../../src/core/run';
import { chooseSignatureOption, signatureDecisions } from '../../src/core/signature';
import { createBattle } from '../../src/core/battle/engine';
import {
  damageDealtPerk, damageTakenPerk, evolutionLevelOffset, isLegendaryLike, megaPartyLimit, permanentMegaFriendship,
  regionLevelOffset, releaseLimit, signatureMoveFor, startingAttributes, statPerk, statusChancePerk, statusTurnsPerk,
  survivalChance, syncHpPerks, xpPerk, boxCapacity, catchLevelOffset, ppCostExtra, rivalTeamTypes, rivalCounterBonus, weatherHealPercent, burnDamagePerk, inThreeStageLine, wildWeightPerk, partyLimit, itemSlotLimit,
  isSpreadMove, turnHealPercent, healingMoveMultiplier, burnDamageTakenPerk, bossMoneyPerk, statusMoveAccuracyPerk, shopEarlyStockPerk, zMoveDelayTurns,
  scaleHeldBonus, postBattleHealShare, rareItemWeightPerk, critDamagePerk, megaDelayTurns, eliteLevelOffset, enemyHealingBlocked,
} from '../../src/core/trainerPerks';
import { autoplay, gameplayFingerprint } from './autoplay';
import { content } from './helpers';

const perks = (id: string) => getArchetype(content, id).modifiers;
const hit = { userTypes: ['bug'] as const, physical: true, hpShare: 1, userLevel: 20, targetLevel: 20, targetIsBoss: false, weather: null, moveType: 'bug' as const, userBaseSpeed: 70, userIsMega: false, partyHasMega: false, firstInBattle: true, isStarter: false, targetTypes: ['normal'] as const };

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

describe('trainer perks, batch 2', () => {
  it('Bill and Brigette have a PC, a smaller party and their other perks', () => {
    expect(boxCapacity(perks('bill'))).toBe(6);
    expect(boxCapacity(perks('brigette'))).toBe(6);
    expect(boxCapacity(perks('red'))).toBe(0);
    expect(partyLimit(6, perks('bill'))).toBe(5);
    expect(itemSlotLimit(8, perks('bill'))).toBe(7);
    expect(catchLevelOffset(perks('brigette'))).toBe(1);
    expect(wildWeightPerk(perks('bill'), ['normal'], true)).toBeCloseTo(1.1);
    expect(wildWeightPerk(perks('bill'), ['normal'], false)).toBe(1);
  });

  it('the PC stores and returns Pokémon, within its limits', () => {
    let run = createRun(content, { runId: 't', seed: 'pc', archetypeId: 'bill' });
    run = chooseStarter(content, run, 0);
    expect(partyCapacity(content, run)).toBe(5);
    expect(() => depositToBox(content, run, 0)).toThrow(/at least one/);
    run.party.push({ ...run.party[0]!, uid: 'p99' });
    run = depositToBox(content, run, 1);
    expect(run.box).toHaveLength(1);
    run = withdrawFromBox(content, run, 0);
    expect(run.party).toHaveLength(2);
    expect(run.box).toHaveLength(0);
    const plain = chooseStarter(content, createRun(content, { runId: 't', seed: 'pc', archetypeId: 'red' }), 0);
    plain.party.push({ ...plain.party[0]!, uid: 'p98' });
    expect(() => depositToBox(content, plain, 1)).toThrow(/PC is full/);
  });

  it('Blaine, Brassius and the other conditional perks', () => {
    expect(burnDamagePerk(perks('blaine'))).toBeCloseTo(1.25);
    expect(ppCostExtra(perks('blaine'), 'fire')).toBe(2);
    expect(ppCostExtra(perks('blaine'), 'water')).toBe(0);
    expect(rivalTeamTypes(perks('blaine'))).toEqual(['water']);
    expect(wildWeightPerk(perks('blaine'), ['fire'], false)).toBeCloseTo(0.7);
    expect(statPerk(perks('blaine'), 'atk', ['fire'], { burned: true })).toBeCloseTo(1.2);
    expect(statPerk(perks('blaine'), 'atk', ['fire'])).toBe(1);
    expect(weatherHealPercent(perks('brassius'), ['grass'], 'sun')).toBe(5);
    expect(weatherHealPercent(perks('brassius'), ['grass'], 'rain')).toBe(0);
    expect(damageTakenPerk(perks('brassius'), { targetTypes: ['grass'], moveType: 'fire', attackerIsLegendary: false, attackerIsBoss: false, weather: null })).toBeCloseTo(1.15);
    expect(damageTakenPerk(perks('calem'), { targetTypes: ['fire'], moveType: 'fire', attackerIsLegendary: false, attackerIsBoss: false, weather: null, targetIsMega: true })).toBeCloseTo(1.1);
    expect(inThreeStageLine(content, 'charmander')).toBe(true);
    expect(inThreeStageLine(content, 'charizard')).toBe(true);
    expect(inThreeStageLine(content, 'pikachu')).toBe(false);
    expect(inThreeStageLine(content, 'farfetchd')).toBe(false);
    expect(statPerk(perks('blue-gen-3-champion'), 'atk', ['fire'], { threeStageLine: true })).toBeCloseTo(1.1);
    expect(rivalCounterBonus(perks('blue-gen-3-champion'))).toBe(1);
  });

  it('Blue (Gen 7) hits harder with the first Pokémon, Brendan favours the starter', () => {
    const base = { userTypes: ['normal'] as const, physical: true, hpShare: 1, userLevel: 10, targetLevel: 10, targetIsBoss: false, weather: null, moveType: 'normal' as const, userBaseSpeed: 70, userIsMega: false, partyHasMega: false, firstInBattle: true, isStarter: false, targetTypes: ['normal'] as const };
    expect(damageDealtPerk(perks('blue-gen-7'), base)).toBeCloseTo(1.25);
    expect(damageDealtPerk(perks('blue-gen-7'), { ...base, firstInBattle: false })).toBeCloseTo(0.9);
    expect(damageDealtPerk(perks('brendan-emerald'), { ...base, isStarter: true })).toBeCloseTo(1.15);
    expect(damageDealtPerk(perks('brendan-emerald'), base)).toBe(1);
    expect(xpPerk(perks('brendan-emerald'), { types: ['normal'], baseSpeed: 50, isStarter: false, isBossBattle: false })).toBeCloseTo(0.9);
  });

  it("Blue (Gen 3) offers Rival's Answer after a rival battle and each pick lasts the run", () => {
    let run = chooseStarter(content, createRun(content, { runId: 't', seed: 'ra', archetypeId: 'blue-gen-3-champion' }), 0);
    const foe = { ...run.party[0]!, uid: 'e1', speciesId: 'charizard', level: 30 };
    const battle = createBattle('trainer', [foe], 0, run.party[0]!.uid, { classId: 'youngster', name: 'Rival', leaderId: null });
    battle.outcome = 'win';
    expect(signatureDecisions(content, run, battle)).toHaveLength(0);
    battle.rivalId = 'r1';
    const decisions = signatureDecisions(content, run, battle);
    expect(decisions).toHaveLength(1);
    run.pending = decisions;
    const message = chooseSignatureOption(run, 0);
    expect(message).toMatch(/Fire/);
    expect(run.perkEffects).toEqual([{ kind: 'damageVsTypeMultiplier', foeType: 'fire', value: 1.1 }]);
    const first = damageDealtPerk([...perks('blue-gen-3-champion'), ...run.perkEffects], { userTypes: ['normal'], physical: true, hpShare: 1, userLevel: 10, targetLevel: 10, targetIsBoss: false, weather: null, moveType: 'normal', userBaseSpeed: 70, userIsMega: false, partyHasMega: false, firstInBattle: true, isStarter: false, targetTypes: ['fire'] });
    expect(first).toBeCloseTo(1.15 * 1.1);
    const plain = chooseStarter(content, createRun(content, { runId: 't', seed: 'ra', archetypeId: 'red' }), 0);
    expect(signatureDecisions(content, plain, battle)).toHaveLength(0);
  });

  it('every batch-2 trainer plays battles without errors, and the same seed plays the same way', () => {
    for (const id of [...content.archetypes.keys()].slice(29, 49)) {
      const play = () => autoplay({ seed: `perk2-${id}`, archetypeId: id, steps: 220, healOnMap: true, starterLevel: 25 });
      const a = play();
      expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
    }
  }, 120_000);

  describe('batch 3 (Carmine to Diantha)', () => {
    const base = { userTypes: ['normal'] as const, physical: true, hpShare: 1, userLevel: 10, targetLevel: 10, targetIsBoss: false, weather: null, moveType: 'normal' as const, userBaseSpeed: 70, userIsMega: false, partyHasMega: false, firstInBattle: true, isStarter: false, targetTypes: ['normal'] as const };

    it('Colress rewards held items and punishes bare Pokémon; held effects are stronger', () => {
      expect(damageDealtPerk(perks('colress'), { ...base, userHoldsItem: true })).toBeCloseTo(1.2);
      expect(damageDealtPerk(perks('colress'), { ...base, userHoldsItem: false })).toBeCloseTo(0.85);
      expect(scaleHeldBonus(perks('colress'), 1.5)).toBeCloseTo(1.575);
      expect(scaleHeldBonus(perks('red'), 1.5)).toBe(1.5);
    });

    it('Cheryl heals after battles and Cogita finds rare items', () => {
      expect(postBattleHealShare(perks('cheryl'))).toBeCloseTo(0.05);
      expect(postBattleHealShare(perks('red'))).toBe(0);
      expect(rareItemWeightPerk(perks('cogita'))).toBeCloseTo(1.1);
    });

    it('Cynthia (Masters) crits harder both ways; Cynthia (Masters 4) favours the first attack', () => {
      expect(critDamagePerk(perks('cynthia-masters'), 'player')).toBeCloseTo(1.25);
      expect(critDamagePerk(perks('cynthia-masters'), 'enemy')).toBeCloseTo(1.15);
      expect(damageDealtPerk(perks('cynthia-masters-4'), { ...base, firstAttack: true })).toBeCloseTo(1.3);
      expect(damageDealtPerk(perks('cynthia-masters-4'), { ...base, firstAttack: false })).toBeCloseTo(0.95);
    });

    it('Diantha: Mega Pokémon hit harder and Mega Evolution waits a turn', () => {
      expect(damageDealtPerk(perks('diantha'), { ...base, userIsMega: true, userTypes: ['fairy'] })).toBeCloseTo(1.2 * 1.2);
      expect(megaDelayTurns(perks('diantha'))).toBe(1);
    });

    it('Cynthia (Gen 7) boosts every Dragon-type stat and HP, Clay/Chuck boost HP of their type', () => {
      for (const stat of ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const) expect(statPerk(perks('cynthia-gen-7'), stat, ['dragon'])).toBeCloseTo(1.1);
      expect(statPerk(perks('cynthia-gen-7'), 'atk', ['normal'])).toBe(1);
      expect(statPerk(perks('clay'), 'hp', ['ground'])).toBeCloseTo(1.15);
    });

    it('Cyrus: Dark/Steel damage, longer status, weaker healing', () => {
      expect(damageDealtPerk(perks('cyrus'), { ...base, userTypes: ['steel'] })).toBeCloseTo(1.2);
      expect(statusTurnsPerk(perks('cyrus'), 3)).toBe(4);
    });

    it('Distortion Protocol offers a choice after a boss, and a new choice replaces the old one', () => {
      let run = chooseStarter(content, createRun(content, { runId: 't', seed: 'dp', archetypeId: 'cyrus' }), 0);
      const foe = { ...run.party[0]!, uid: 'e1', speciesId: 'charizard', level: 30 };
      const gym = createBattle('trainer', [foe], 0, run.party[0]!.uid, { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' });
      gym.outcome = 'win';
      const ordinary = createBattle('trainer', [foe], 0, run.party[0]!.uid, { classId: 'youngster', name: 'Joey', leaderId: null });
      ordinary.outcome = 'win';
      expect(signatureDecisions(content, run, ordinary)).toHaveLength(0);
      run.pending = signatureDecisions(content, run, gym);
      expect(run.pending).toHaveLength(1);
      chooseSignatureOption(run, 1);
      expect(enemyHealingBlocked([...perks('cyrus'), ...run.perkEffects])).toBe(true);
      expect(eliteLevelOffset(run.perkEffects)).toBe(3);
      run.pending = signatureDecisions(content, run, gym);
      chooseSignatureOption(run, 0);
      expect(enemyHealingBlocked(run.perkEffects)).toBe(false);
      expect(eliteLevelOffset(run.perkEffects)).toBe(2);
      expect(statPerk(run.perkEffects, 'spe', ['normal'])).toBeCloseTo(1.15);
    });

    it('every batch-3 trainer plays battles without errors, and the same seed plays the same way', () => {
      for (const id of [...content.archetypes.keys()].slice(49, 69)) {
        const play = () => autoplay({ seed: `perk3-${id}`, archetypeId: id, steps: 220, healOnMap: true, starterLevel: 25 });
        const a = play();
        expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
      }
    }, 180_000);
  });

  describe('batch 4 (Drake to Ginter)', () => {
    const base = { userTypes: ['normal'] as const, physical: true, hpShare: 1, userLevel: 10, targetLevel: 10, targetIsBoss: false, weather: null, moveType: 'normal' as const, userBaseSpeed: 70, userIsMega: false, partyHasMega: false, firstInBattle: true, isStarter: false, targetTypes: ['normal'] as const };

    it('Elio boosts and delays Z-Moves; Emmet favours spread moves', () => {
      expect(damageDealtPerk(perks('elio-usum'), { ...base, moveIsZ: true })).toBeCloseTo(1.2);
      expect(zMoveDelayTurns(perks('elio-usum'))).toBe(1);
      expect(damageDealtPerk(perks('emmet'), { ...base, moveIsSpread: true })).toBeCloseTo(1.15);
      expect(damageDealtPerk(perks('emmet'), { ...base, moveIsSpread: false })).toBeCloseTo(0.9);
      expect(isSpreadMove('earthquake')).toBe(true);
      expect(isSpreadMove('tackle')).toBe(false);
    });

    it('Geeta: the last Pokémon hits harder, the first one softer', () => {
      expect(damageDealtPerk(perks('geeta'), { ...base, partyIndex: 2, partySize: 3 })).toBeCloseTo(1.25);
      expect(damageDealtPerk(perks('geeta'), { ...base, partyIndex: 0, partySize: 3 })).toBeCloseTo(0.9);
      expect(damageDealtPerk(perks('geeta'), { ...base, partyIndex: 1, partySize: 3 })).toBe(1);
    });

    it('Erika heals Grass-types each turn and boosts healing moves; Flannery makes burns hurt more', () => {
      expect(turnHealPercent(perks('erika-gen-3'), ['grass'])).toBe(5);
      expect(turnHealPercent(perks('erika-gen-3'), ['fire'])).toBe(0);
      expect(healingMoveMultiplier(perks('erika'))).toBeCloseTo(1.15);
      expect(burnDamageTakenPerk(perks('flannery'))).toBeCloseTo(1.25);
    });

    it('Flint raises only the burn chance; Giacomo helps status moves hit; Ghetsis pays more for bosses', () => {
      expect(statusChancePerk(perks('flint'), ['fire'], 'brn')).toBeCloseTo(1.1);
      expect(statusChancePerk(perks('flint'), ['fire'], 'par')).toBe(1);
      expect(statusMoveAccuracyPerk(perks('giacomo'))).toBeCloseTo(1.15);
      expect(bossMoneyPerk(perks('ghetsis'))).toBeCloseTo(1.2);
    });

    it("Ginter's shop has one more early entry; Elm's catches start two levels lower", () => {
      expect(shopEarlyStockPerk(perks('ginter'))).toBe(1);
      expect(catchLevelOffset(perks('elm'))).toBe(-2);
    });

    it('every batch-4 trainer plays battles without errors, and the same seed plays the same way', () => {
      for (const id of [...content.archetypes.keys()].slice(69, 89)) {
        const play = () => autoplay({ seed: `perk4-${id}`, archetypeId: id, steps: 220, healOnMap: true, starterLevel: 25 });
        const a = play();
        expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
      }
    }, 180_000);
  });
});
