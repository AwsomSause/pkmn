// Trainers.md perks (batch 1: Aaron to Bianca). Pure perk maths, the data, and the run-level effects.

import { describe, expect, it } from 'vitest';
import { getArchetype, healingMultiplier } from '../../src/core/archetypes';
import { calcStats, createPokemon, getSpecies } from '../../src/core/pokemon';
import { chooseStarter, createRun, fishingOffer, tickTempEffects, depositToBox, partyCapacity, releaseLimitReached, shopPrice, shopSaleItem, withdrawFromBox } from '../../src/core/run';
import { chooseSignatureOption, signatureDecisions } from '../../src/core/signature';
import { applyHype, createBattle } from '../../src/core/battle/engine';
import { battleTypes } from '../../src/core/battle/transform';
import {
  damageDealtPerk, damageTakenPerk, evolutionLevelOffset, isLegendaryLike, megaPartyLimit, permanentMegaFriendship,
  regionLevelOffset, releaseLimit, signatureMoveFor, startingAttributes, statPerk, statusChancePerk, statusTurnsPerk,
  survivalChance, syncHpPerks, xpPerk, boxCapacity, catchLevelOffset, ppCostExtra, rivalTeamTypes, rivalCounterBonus, weatherHealPercent, burnDamagePerk, inThreeStageLine, wildWeightPerk, partyLimit, itemSlotLimit,
  hypeMeterOf, thirdBossLevels, doubleBattleRewardPerk, singleBattleXpPerk, shopRefreshPerk, statusLengthPerk, poisonDamagePerk, evasionPerk, startingLevelOffset, championMoneyPerk, ordinaryMoneyPerk, critChancePerk, bonusFriendship,
  isSpreadMove, turnHealPercent, healingMoveMultiplier, burnDamageTakenPerk, bossMoneyPerk, statusMoveAccuracyPerk, shopEarlyStockPerk, zMoveDelayTurns,
  scaleHeldBonus, postBattleHealShare, rareItemWeightPerk, critDamagePerk, megaDelayTurns, eliteLevelOffset, enemyHealingBlocked,
  critChanceBonusPerk, catchMoneyPerk, moveFlagsOf, moveStyleOf, foodCount, unusualKind, bonusRewardChancePerk, fishingRareTriesPerk,
} from '../../src/core/trainerPerks';
import { hiddenItemNode } from '../../src/core/mapItems';
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
    // Ingo: single battles give 10% less EXP, double battles don't; Elm: hatched Pokémon +15%.
    expect(xpPerk(perks('ingo'), xp)).toBeCloseTo(0.9);
    expect(xpPerk(perks('ingo'), { ...xp, isDoubles: true })).toBe(1);
    expect(xpPerk(perks('elm'), { ...xp, isHatched: true, isDoubles: true })).toBeCloseTo(1.15);
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
    const message = chooseSignatureOption(run, 0).message;
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

  describe('batch 5 (Glacia to Ingo)', () => {
    const base = { userTypes: ['normal'] as const, physical: true, hpShare: 1, userLevel: 10, targetLevel: 10, targetIsBoss: false, weather: null, moveType: 'normal' as const, userBaseSpeed: 70, userIsMega: false, partyHasMega: false, firstInBattle: true, isStarter: false, targetTypes: ['normal'] as const };
    const taken = { targetTypes: ['normal'] as const, moveType: 'normal' as const, attackerIsLegendary: false, attackerIsBoss: false, weather: null };

    it('Gladion (Stance) and Ingo guard a Pokémon that just came in; Gladion hits softer once settled', () => {
      expect(damageTakenPerk(perks('gladion-stance'), { ...taken, targetTurnsOut: 0 })).toBeCloseTo(0.9);
      expect(damageTakenPerk(perks('gladion-stance'), { ...taken, targetTurnsOut: 1 })).toBe(1);
      expect(damageDealtPerk(perks('gladion-stance'), { ...base, turnsOut: 1 })).toBeCloseTo(0.9);
      expect(damageDealtPerk(perks('gladion-stance'), { ...base, turnsOut: 0 })).toBe(1);
      expect(damageTakenPerk(perks('ingo'), { ...taken, targetTurnsOut: 0 })).toBeCloseTo(0.9);
    });

    it('Hop: super-effective hits work both ways', () => {
      expect(damageDealtPerk(perks('hop'), { ...base, effectiveness: 2 })).toBeCloseTo(1.1);
      expect(damageDealtPerk(perks('hop'), { ...base, effectiveness: 1 })).toBe(1);
      expect(damageTakenPerk(perks('hop'), { ...taken, effectiveness: 2 })).toBeCloseTo(1.1);
    });

    it('money, crit chance and friendship perks', () => {
      expect(championMoneyPerk(perks('gloria-league'))).toBeCloseTo(1.2);
      expect(ordinaryMoneyPerk(perks('gloria-league'))).toBeCloseTo(0.85);
      expect(critChancePerk(perks('guzma'))).toBeCloseTo(1.1);
      expect(critChancePerk(perks('grimsley-gen-7'))).toBeCloseTo(1.15);
      expect(bonusFriendship(perks('harmony'), 100)).toBeCloseTo(120);
      expect(bonusFriendship(perks('red'), 100)).toBe(100);
    });

    it('Hugh trades damage by level gap; Green starts a level lower', () => {
      expect(damageDealtPerk(perks('hugh'), { ...base, targetLevel: 20 })).toBeCloseTo(1.2);
      expect(damageDealtPerk(perks('hugh'), { ...base, targetLevel: 5 })).toBeCloseTo(0.9);
      expect(startingLevelOffset(perks('green-classic'))).toBe(-1);
    });

    it('every batch-5 trainer plays battles without errors, and the same seed plays the same way', () => {
      for (const id of ["glacia", "gladion-masters-2", "gladion-stance", "gloria-league", "grace", "grant", "green-classic", "grimsley-gen-7", "grusha", "guzma", "hala", "hapu", "harmony", "hau-stance", "hilbert", "hilda", "hop", "hugh", "ilima", "ingo"]) {
        const play = () => autoplay({ seed: `perk5-${id}`, archetypeId: id, steps: 220, healOnMap: true, starterLevel: 25 });
        const a = play();
        expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
      }
    }, 180_000);
  });
});

describe('trainer perks, batch Z to T (Tate & Liza to Zinnia)', () => {
  const Z = ['tate-liza-gen-6', 'team-rocket', 'the-royal', 'thorton', 'tierno', 'todd-snap', 'trace', 'trevor', 'valerie', 'volkner', 'volo', 'wallace-gen-6', 'wally', 'wattson', 'whitney', 'wicke', 'winona-gen-6', 'wulfric', 'yellow', 'zinnia'];
  const info = { ...hit, userTypes: ['normal'] as const };

  it('all 20 are playable trainers', () => {
    for (const id of Z) expect(content.archetypes.has(id), id).toBe(true);
  });

  it('Whitney: Normal damage, +10 points of crit chance, weak to Fighting', () => {
    expect(damageDealtPerk(perks('whitney'), info)).toBeCloseTo(1.2);
    expect(critChanceBonusPerk(perks('whitney'))).toBeCloseTo(0.1);
    expect(critChanceBonusPerk(perks('wicke'))).toBe(0);
  });

  it('Volo: Legendary damage only, boss and catch money', () => {
    expect(damageDealtPerk(perks('volo'), { ...info, userLegendary: true })).toBeCloseTo(1.25);
    expect(damageDealtPerk(perks('volo'), { ...info, userLegendary: false })).toBe(1);
    expect(bossMoneyPerk(perks('volo'))).toBeCloseTo(1.25);
    expect(bossMoneyPerk(perks('the-royal'))).toBeCloseTo(1.15);
  });

  it('Team Rocket pays more after a catch', () => {
    expect(catchMoneyPerk(perks('team-rocket'))).toBeCloseTo(1.25);
    expect(catchMoneyPerk(perks('trace'))).toBe(1);
  });

  it('Tierno boosts dance and sound moves only', () => {
    expect(damageDealtPerk(perks('tierno'), { ...info, moveFlags: moveFlagsOf({ id: 'dragon-dance', flags: [] }) })).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('tierno'), { ...info, moveFlags: moveFlagsOf({ id: 'hyper-voice', flags: ['sound'] }) })).toBeCloseTo(1.2);
    // Dances come from Essentials' Dance flag, plus the Gen 9 ones; a move merely named "…dance" by mistake isn't one.
    for (const id of ['clangorous-soul', 'aqua-step', 'victory-dance', 'swords-dance']) expect(moveFlagsOf({ id, flags: [] })).toContain('dance');
    expect(moveFlagsOf({ id: 'tackle', flags: [] })).not.toContain('dance');
    expect(damageDealtPerk(perks('tierno'), { ...info, moveFlags: moveFlagsOf({ id: 'tackle', flags: ['contact'] }) })).toBe(1);
  });

  it('Thorton: unusual Pokémon hit harder, very common abilities hit softer', () => {
    expect(damageDealtPerk(perks('thorton'), { ...info, userRarity: 'unusual' })).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('thorton'), { ...info, userRarity: 'common' })).toBeCloseTo(0.9);
    expect(damageDealtPerk(perks('thorton'), { ...info, userRarity: null })).toBe(1);
  });

  it('the unusual / common split is sensible: some of each, most Pokémon neither', () => {
    const counts = { unusual: 0, common: 0, none: 0 };
    for (const sp of content.species.values()) {
      const mon = createPokemon(content, sp.id, 20, `rar-${sp.id}`);
      counts[unusualKind(content, mon) ?? 'none'] += 1;
    }
    expect(counts.unusual).toBeGreaterThan(20);
    expect(counts.common).toBeGreaterThan(20);
    expect(counts.none).toBeGreaterThan(counts.unusual);
  });

  it('Wally hits harder only after your side defeated an enemy', () => {
    expect(damageDealtPerk(perks('wally'), { ...info, enemiesDefeated: 0 })).toBe(1);
    expect(damageDealtPerk(perks('wally'), { ...info, enemiesDefeated: 1 })).toBeCloseTo(1.2);
  });

  it('type trainers: Wattson, Wulfric, Wallace, Zinnia, Valerie, Volkner, Winona', () => {
    expect(damageDealtPerk(perks('wattson'), { ...info, userTypes: ['electric'] })).toBeCloseTo(1.25);
    expect(statPerk(perks('wattson'), 'spe', ['electric'])).toBeCloseTo(1.15);
    expect(statPerk(perks('wulfric'), 'def', ['ice'])).toBeCloseTo(1.2);
    expect(statPerk(perks('wulfric'), 'spe', ['ice'])).toBeCloseTo(0.9);
    expect(damageDealtPerk(perks('wallace-gen-6'), { ...info, userTypes: ['water'], physical: false })).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('wallace-gen-6'), { ...info, userTypes: ['water'], physical: true })).toBe(1);
    expect(damageDealtPerk(perks('zinnia'), { ...info, userTypes: ['dragon'] })).toBeCloseTo(1.25);
    expect(damageDealtPerk(perks('valerie'), { ...info, userTypes: ['fairy'] })).toBeCloseTo(1.2);
    expect(damageTakenPerk(perks('volkner'), { targetTypes: ['electric'], moveType: 'ground', attackerIsLegendary: false, attackerIsBoss: false, weather: null })).toBeCloseTo(1.25);
    expect(damageTakenPerk(perks('winona-gen-6'), { targetTypes: ['flying'], moveType: 'rock', attackerIsLegendary: false, attackerIsBoss: false, weather: null })).toBeCloseTo(1.2);
  });

  it('Yellow and Wicke heal more and have more HP, with weaker attacks', () => {
    expect(healingMultiplier(getArchetype(content, 'yellow'))).toBeCloseTo(1.25);
    expect(statPerk(perks('wicke'), 'hp', ['normal'])).toBeCloseTo(1.1);
    expect(damageDealtPerk(perks('yellow'), info)).toBeCloseTo(0.85);
  });

  it('every trainer of the batch plays battles without errors, and the same seed plays the same way', () => {
    for (const id of Z) {
      const play = () => autoplay({ seed: `perkZ-${id}`, archetypeId: id, steps: 220, healOnMap: true, starterLevel: 25 });
      const a = play();
      expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
    }
  }, 240_000);
});


describe('trainer perks, batch Z2 (Sabrina LGPE to Tabitha)', () => {
  const Z2 = ['sabrina-lgpe', 'selene', 'serena', 'shauna', 'shelly', 'sidney', 'silver', 'spr-hgss-silver', 'skyla', 'sonia', 'sophocles', 'sordward-shielbert', 'spr-hgss-ethan', 'spr-pt-barry', 'spr-pt-dawn', 'spr-pt-looker', 'spr-pt-lucas', 'steven-gen-6', 'sycamore', 'tabitha'];
  const info = { ...hit, userTypes: ['normal'] as const };
  const taken = (id: string, moveType: 'dark' | 'grass' | 'fairy' | 'rock' | 'ground') => damageTakenPerk(perks(id), { targetTypes: ['normal'], moveType, attackerIsLegendary: false, attackerIsBoss: false, weather: null });

  it('all 20 are playable trainers', () => {
    for (const id of Z2) expect(content.archetypes.has(id), id).toBe(true);
  });

  it('type trainers deal more damage of their type and take more from the named type', () => {
    expect(damageDealtPerk(perks('sabrina-lgpe'), { ...info, userTypes: ['psychic'] })).toBeCloseTo(1.25);
    expect(taken('sabrina-lgpe', 'dark')).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('shelly'), { ...info, userTypes: ['water'] })).toBeCloseTo(1.2);
    expect(taken('shelly', 'grass')).toBeCloseTo(1.2);
    expect(statPerk(perks('shelly'), 'hp', ['normal'])).toBeCloseTo(1.1);
    expect(taken('sidney', 'fairy')).toBeCloseTo(1.2);
    expect(taken('skyla', 'rock')).toBeCloseTo(1.2);
    expect(taken('sophocles', 'ground')).toBeCloseTo(1.2);
    expect(statPerk(perks('skyla'), 'spe', ['flying'])).toBeCloseTo(1.2);
    expect(statPerk(perks('steven-gen-6'), 'def', ['steel'])).toBeCloseTo(1.2);
  });

  it('Sidney: crit chance +10 points', () => {
    expect(critChanceBonusPerk(perks('sidney'))).toBeCloseTo(0.1);
  });

  it('Silver (both versions): more damage against higher-level foes, less experience', () => {
    for (const id of ['silver', 'spr-hgss-silver']) {
      expect(damageDealtPerk(perks(id), { ...info, targetLevel: 30 })).toBeCloseTo(1.2);
      expect(damageDealtPerk(perks(id), info)).toBe(1);
      expect(perks(id).find((m) => m.kind === 'xpMultiplier')).toMatchObject({ value: 0.85 });
    }
  });

  it('Dawn and Ethan: starter experience differs from the rest of the team', () => {
    expect(xpPerk(perks('spr-pt-dawn'), { types: ['normal'], baseSpeed: 70, isStarter: true, isBossBattle: false })).toBeCloseTo(1.2);
    expect(xpPerk(perks('spr-pt-dawn'), { types: ['normal'], baseSpeed: 70, isStarter: false, isBossBattle: false })).toBeCloseTo(0.9);
    expect(xpPerk(perks('spr-hgss-ethan'), { types: ['normal'], baseSpeed: 70, isStarter: true, isBossBattle: false })).toBeCloseTo(1.15);
  });

  it('Sycamore: Mega delay and Mega damage', () => {
    expect(megaDelayTurns(perks('sycamore'))).toBe(1);
    expect(megaDelayTurns(perks('tabitha'))).toBe(0);
  });

  it('every trainer of the batch plays battles without errors, and the same seed plays the same way', () => {
    for (const id of Z2) {
      const play = () => autoplay({ seed: `perkZ2-${id}`, archetypeId: id, steps: 200, healOnMap: true, starterLevel: 25 });
      const a = play();
      expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
    }
  }, 240_000);
});

describe('trainer perks, batch Z3 (Olympia to Ryuki)', () => {
  const Z3 = ['olympia', 'opal', 'ortega', 'palmer', 'peonia', 'peony', 'phoebe-gen-6', 'piers', 'plumeria', 'pryce', 'raihan', 'red-classic', 'red-masters', 'rei', 'riley', 'rosa', 'rowan', 'roxanne-gen-6', 'roxie-masters', 'ryuki'];
  const info = { ...hit, userTypes: ['normal'] as const };
  const taken = (id: string, moveType: 'dark' | 'water' | 'psychic' | 'steel' | 'fairy') => damageTakenPerk(perks(id), { targetTypes: ['normal'], moveType, attackerIsLegendary: false, attackerIsBoss: false, weather: null });

  it('all 20 are playable trainers', () => {
    for (const id of Z3) expect(content.archetypes.has(id), id).toBe(true);
  });

  it('type trainers deal more damage of their type', () => {
    expect(damageDealtPerk(perks('ryuki'), { ...info, userTypes: ['dragon'] })).toBeCloseTo(1.25);
    expect(damageDealtPerk(perks('olympia'), { ...info, userTypes: ['psychic'] })).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('riley'), { ...info, userTypes: ['fighting'] })).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('pryce'), { ...info, userTypes: ['ice'] })).toBeCloseTo(1.15);
    expect(damageDealtPerk(perks('red-masters'), info)).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('red-classic'), info)).toBe(1);
  });

  it('weaknesses to the named move types', () => {
    expect(taken('olympia', 'dark')).toBeCloseTo(1.2);
    expect(taken('roxanne-gen-6', 'water')).toBeCloseTo(1.2);
    expect(taken('roxie-masters', 'psychic')).toBeCloseTo(1.2);
    expect(taken('ortega', 'steel')).toBeCloseTo(1.2);
    expect(taken('riley', 'fairy')).toBeCloseTo(1.15);
  });

  it('stats: Pryce, Peony, Piers, Opal', () => {
    expect(statPerk(perks('pryce'), 'def', ['ice'])).toBeCloseTo(1.2);
    expect(statPerk(perks('pryce'), 'spe', ['ice'])).toBeCloseTo(0.85);
    expect(statPerk(perks('peony'), 'atk', ['steel'])).toBeCloseTo(1.1);
    expect(statPerk(perks('piers'), 'spe', ['dark'])).toBeCloseTo(0.9);
    expect(statPerk(perks('opal'), 'spe', ['fairy'])).toBeCloseTo(0.9);
  });

  it('Piers: sound moves', () => {
    expect(damageDealtPerk(perks('piers'), { ...info, moveFlags: ['sound'] })).toBeCloseTo(1.15);
  });

  it('Palmer: boss damage; Rowan: lower start level', () => {
    expect(damageDealtPerk(perks('palmer'), { ...info, targetIsBoss: true })).toBeCloseTo(1.2);
    expect(perks('rowan').find((m) => m.kind === 'startingLevelOffset')).toMatchObject({ value: -1 });
  });

  it('every trainer of the batch plays battles without errors, and the same seed plays the same way', () => {
    for (const id of Z3) {
      const play = () => autoplay({ seed: `perkZ3-${id}`, archetypeId: id, steps: 200, healOnMap: true, starterLevel: 25 });
      const a = play();
      expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
    }
  }, 240_000);

  describe('batch 6 (Iono to Kurt)', () => {
    const base = { userTypes: ['normal'] as const, physical: true, hpShare: 1, userLevel: 10, targetLevel: 10, targetIsBoss: false, weather: null, moveType: 'normal' as const, userBaseSpeed: 70, userIsMega: false, partyHasMega: false, firstInBattle: true, isStarter: false, targetTypes: ['normal'] as const };

    it('poison damage, evasion and status-foe damage', () => {
      expect(poisonDamagePerk(perks('janine'))).toBeCloseTo(1.15);
      expect(poisonDamagePerk(perks('koga-lgpe'))).toBeCloseTo(1.25);
      expect(evasionPerk(perks('juan'), ['water'])).toBeCloseTo(1.1);
      expect(evasionPerk(perks('juan'), ['fire'])).toBe(1);
      expect(damageDealtPerk(perks('karen'), { ...base, targetStatused: true })).toBeCloseTo(1.15);
      expect(damageDealtPerk(perks('karen'), { ...base, targetStatused: false })).toBe(1);
    });

    it('Janine and Klara raise poison status chance, Iono every status chance', () => {
      expect(statusChancePerk(perks('janine'), ['poison'], 'psn')).toBeCloseTo(1.2);
      expect(statusChancePerk(perks('janine'), ['normal'], 'psn')).toBe(1);
      expect(statusChancePerk(perks('iono'), ['normal'], 'par')).toBeCloseTo(1.15);
    });

    it('every batch-6 trainer plays battles without errors, and the same seed plays the same way', () => {
      for (const id of ["iono", "irida", "iris-gen-5-bw2", "jacinthe", "janine", "jasmine", "juan", "juniper", "kabu", "kahili", "karen", "katy", "kiawe", "klara", "koga-lgpe", "koga", "korrina", "kris", "kukui", "kurt"]) {
        const play = () => autoplay({ seed: `perk6-${id}`, archetypeId: id, steps: 220, healOnMap: true, starterLevel: 25 });
        const a = play();
        expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
      }
    }, 180_000);
  });
});

describe('trainer perks, batch Z4 (Magnus to Olivia)', () => {
  const Z4 = ['magnus', 'mallow', 'marley', 'marlon', 'marnie-masters-4', 'matt', 'maxie-gen-6', 'may-emerald', 'may-ruby-sapphire', 'maylene', 'melony', 'milo', 'mina', 'misty-classic', 'molayne', 'morty', 'mr-fuji-gen-3', 'n-classic', 'nanu', 'nate', 'nemona-v', 'nessa', 'noland', 'norman', 'oak-classic', 'olivia'];
  const info = { ...hit, userTypes: ['normal'] as const };
  const taken = (id: string, moveType: 'water' | 'grass' | 'fire' | 'fairy' | 'electric' | 'ground' | 'fighting') => damageTakenPerk(perks(id), { targetTypes: ['normal'], moveType, attackerIsLegendary: false, attackerIsBoss: false, weather: null });

  it('all 26 are playable trainers', () => {
    for (const id of Z4) expect(content.archetypes.has(id), id).toBe(true);
  });

  it('type trainers: damage, stats and weaknesses', () => {
    expect(damageDealtPerk(perks('nessa'), { ...info, userTypes: ['water'] })).toBeCloseTo(1.2);
    expect(taken('nessa', 'electric')).toBeCloseTo(1.2);
    expect(taken('olivia', 'water')).toBeCloseTo(1.15);
    expect(taken('olivia', 'grass')).toBeCloseTo(1.15);
    expect(statPerk(perks('olivia'), 'atk', ['rock'])).toBeCloseTo(1.2);
    expect(statPerk(perks('norman'), 'hp', ['normal'])).toBeCloseTo(1.1);
    expect(taken('maylene', 'fairy')).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('molayne'), { ...info, userTypes: ['electric'] })).toBeCloseTo(1.15);
    expect(damageDealtPerk(perks('misty-classic'), { ...info, userTypes: ['water'], physical: false })).toBeCloseTo(1.15);
    expect(damageDealtPerk(perks('misty-classic'), { ...info, userTypes: ['water'], physical: true })).toBe(1);
  });

  it('Nemona: bonus against higher-level foes, penalty against lower ones', () => {
    expect(damageDealtPerk(perks('nemona-v'), { ...info, targetLevel: 30 })).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('nemona-v'), { ...info, targetLevel: 10 })).toBeCloseTo(0.9);
  });

  it('Noland: unusual Pokémon only; May: starter versus others', () => {
    expect(perks('noland').find((m) => m.kind === 'unusualDamageMultiplier')).toMatchObject({ unusual: 1.2 });
    expect(xpPerk(perks('may-emerald'), { types: ['normal'], baseSpeed: 70, isStarter: true, isBossBattle: false })).toBeCloseTo(1.15);
    expect(xpPerk(perks('may-emerald'), { types: ['normal'], baseSpeed: 70, isStarter: false, isBossBattle: false })).toBeCloseTo(0.9);
  });

  it('every trainer of the batch plays battles without errors, and the same seed plays the same way', () => {
    for (const id of Z4) {
      const play = () => autoplay({ seed: `perkZ4-${id}`, archetypeId: id, steps: 200, healOnMap: true, starterLevel: 25 });
      const a = play();
      expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
    }
  }, 300_000);
});

describe('trainer perks, batch L (Lana to Lysandre)', () => {
  const L = ['lana', 'lance', 'leaf-gen-3', 'leon-masters', 'lillie-z', 'lisia', 'lorelei-lgpe', 'lt-surge', 'lucas-gen-4-platinum', 'lucas', 'lyra', 'lysandre'];
  const info = { ...hit, userTypes: ['normal'] as const };
  const taken = (id: string, moveType: 'electric' | 'ice' | 'fire' | 'ground') => damageTakenPerk(perks(id), { targetTypes: ['normal'], moveType, attackerIsLegendary: false, attackerIsBoss: false, weather: null });

  it('all are playable trainers', () => {
    for (const id of L) expect(content.archetypes.has(id), id).toBe(true);
  });

  it('type trainers: damage, stats, weaknesses', () => {
    expect(damageDealtPerk(perks('lana'), { ...info, userTypes: ['water'], physical: false })).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('lana'), { ...info, userTypes: ['water'], physical: true })).toBe(1);
    expect(taken('lana', 'electric')).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('lance'), { ...info, userTypes: ['dragon'] })).toBeCloseTo(1.25);
    expect(taken('lance', 'ice')).toBeCloseTo(1.15);
    expect(statPerk(perks('lt-surge'), 'spe', ['electric'])).toBeCloseTo(1.15);
    expect(taken('lt-surge', 'ground')).toBeCloseTo(1.25);
    expect(statPerk(perks('lorelei-lgpe'), 'def', ['ice'])).toBeCloseTo(1.1);
  });

  it('Lucas (Platinum): starter damage and experience', () => {
    expect(damageDealtPerk(perks('lucas-gen-4-platinum'), { ...info, isStarter: true })).toBeCloseTo(1.1);
    expect(damageDealtPerk(perks('lucas-gen-4-platinum'), { ...info, isStarter: false })).toBe(1);
  });

  it('Leon: boss damage; Lysandre: weaker healing', () => {
    expect(damageDealtPerk(perks('leon-masters'), { ...info, targetIsBoss: true })).toBeCloseTo(1.2);
    expect(healingMultiplier(getArchetype(content, 'lysandre'))).toBeCloseTo(0.8);
  });

  it('every trainer of the batch plays the same way twice', () => {
    for (const id of L) {
      const play = () => autoplay({ seed: `perkL-${id}`, archetypeId: id, steps: 200, healOnMap: true, starterLevel: 25 });
      const a = play();
      expect(gameplayFingerprint(play()), id).toBe(gameplayFingerprint(a));
    }
  }, 300_000);

  describe('signature mechanics (Encore!, Perfect Shot, The Final Revelation, Meteor\'s Prophecy)', () => {
    const start = (archetypeId: string) => chooseStarter(content, createRun(content, { runId: 't', seed: 'sig', archetypeId }), 0);
    const foe = (run: ReturnType<typeof start>) => ({ ...run.party[0]!, uid: 'e1', speciesId: 'charizard', level: 30 });
    const bossWin = (run: ReturnType<typeof start>, classId = 'gym-leader') => {
      const b = createBattle('trainer', [foe(run)], 0, run.party[0]!.uid, { classId, name: 'Boss', leaderId: 'brock' });
      b.outcome = 'win';
      return b;
    };

    it('Encore!: crits build Hype, five Hype starts a 30% boost for two turns, misses cost two, a boss resets it', () => {
      const run = start('ryuki');
      const meter = hypeMeterOf(perks('ryuki'));
      expect(meter).toEqual({ needed: 5, damage: 1.3, turns: 2, missPenalty: 2 });
      const battle = createBattle('trainer', [foe(run)], 0, run.party[0]!.uid, { classId: 'youngster', name: 'Joey', leaderId: null });
      const ctx = { battle, perks: perks('ryuki') } as never;
      const crit = { type: 'damage', side: 'enemy', amount: 5, hpAfter: 1, effectiveness: 1, crit: true } as never;
      applyHype(ctx, [crit, crit, crit]);
      expect(battle.hype).toBe(3);
      applyHype(ctx, [{ type: 'miss', side: 'player' } as never]);
      expect(battle.hype).toBe(1);
      applyHype(ctx, [crit, crit, crit, crit]);
      expect(battle.hype).toBe(0);
      expect(battle.hypeTurns).toBe(2);
      applyHype(ctx, []);
      expect(battle.hypeTurns).toBe(1);
      const hit = { userTypes: ['dragon'] as const, physical: true, hpShare: 1, userLevel: 10, targetLevel: 10, targetIsBoss: false, weather: null, moveType: 'dragon' as const, userBaseSpeed: 70, userIsMega: false, partyHasMega: false, firstInBattle: true, isStarter: false, targetTypes: ['normal'] as const };
      expect(damageDealtPerk(perks('ryuki'), { ...hit, hypeActive: true }) / damageDealtPerk(perks('ryuki'), hit)).toBeCloseTo(1.3);
    });

    it('The Final Revelation: every third boss offers a relic and hardens later bosses, up to three times', () => {
      const run = start('volo');
      run.log.counters.gymLeadersDefeated = 1;
      expect(signatureDecisions(content, run, bossWin(run))).toHaveLength(0);
      run.log.counters.gymLeadersDefeated = 2;
      run.pending = signatureDecisions(content, run, bossWin(run));
      expect(run.pending).toHaveLength(1);
      chooseSignatureOption(run, 0);
      expect(run.perkEffects).toEqual([{ kind: 'damageMultiplier', value: 1.1 }, { kind: 'bossDamageTakenMultiplier', value: 1.1 }]);
      for (let i = 0; i < 4; i++) {
        run.pending = signatureDecisions(content, run, bossWin(run));
        chooseSignatureOption(run, 1);
      }
      expect(run.perkEffects.filter((m) => m.kind === 'bossDamageTakenMultiplier' && m.value === 1.1)).toHaveLength(3);
    });

    it('Ingo and Tate & Liza: double battles pay 20% more, single battles give 10% less EXP', () => {
      for (const id of ['ingo', 'tate-liza-gen-6']) {
        expect(doubleBattleRewardPerk(perks(id))).toBeCloseTo(1.2);
        expect(singleBattleXpPerk(perks(id))).toBeCloseTo(0.9);
      }
      expect(singleBattleXpPerk(perks('hop'))).toBe(1);
    });

    it('Kurt, Blaine and Plumeria: slower shop sale, longer burn and poison', () => {
      expect(shopRefreshPerk(perks('kurt'))).toBeCloseTo(1.25);
      expect(statusLengthPerk(perks('blaine-lgpe'), 'brn')).toBe(2);
      expect(statusLengthPerk(perks('blaine-lgpe'), 'psn')).toBe(0);
      expect(statusLengthPerk(perks('plumeria'), 'psn')).toBe(1);
    });

    it('the shop puts one open item on sale, the same one for the same seed and window', () => {
      const run = start('red');
      const item = shopSaleItem(content, run);
      expect(item).toBe(shopSaleItem(content, run));
      const entry = content.shop.find((e) => e.item === item);
      if (entry) expect(shopPrice(content, run, entry)).toBeLessThan(entry.price);
    });

    it("Meteor's Prophecy: a bonus type adds a second type without duplicating or touching the species", () => {
      const run = start('zinnia');
      const mon = foe(run);
      const battle = createBattle('trainer', [mon], 0, run.party[0]!.uid, { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' });
      const own = [...battleTypes(content, battle, mon)];
      battle.transform.bonusTypes[mon.uid] = own[0]!;
      expect(battleTypes(content, battle, mon)).toEqual(own);
      const extra = (['fire', 'water', 'grass', 'ghost'] as const).find((t) => !own.includes(t))!;
      battle.transform.bonusTypes[mon.uid] = extra;
      expect(battleTypes(content, battle, mon)).toEqual([...own, extra]);
    });

    it("Meteor's Prophecy: a temporary prophecy runs out after its battle; the Dragon relic stays", () => {
      const run = start('zinnia');
      expect(thirdBossLevels(perks('zinnia'))).toBe(3);
      run.log.counters.gymLeadersDefeated = 2;
      run.pending = signatureDecisions(content, run, bossWin(run));
      chooseSignatureOption(run, 2);
      expect(run.tempEffects).toHaveLength(1);
      expect(run.perkEffects).toHaveLength(2);
      tickTempEffects(run, createBattle('trainer', [foe(run)], 0, run.party[0]!.uid, { classId: 'youngster', name: 'Joey', leaderId: null }), false);
      expect(run.perkEffects).toHaveLength(2);
      tickTempEffects(run, bossWin(run), true);
      expect(run.perkEffects).toHaveLength(0);
      expect(run.tempEffects).toHaveLength(0);
      run.pending = signatureDecisions(content, run, bossWin(run));
      chooseSignatureOption(run, 1);
      expect(run.perkEffects).toHaveLength(2);
    });

    it('Perfect Shot: every third newly caught species offers a choice', () => {
      const run = start('todd-snap');
      const catchBattle = (speciesId: string) => {
        const b = createBattle('wild', [{ ...foe(run), speciesId }], 0, run.party[0]!.uid, null);
        b.outcome = 'caught';
        return b;
      };
      run.log.speciesCaught = ['pidgey', 'rattata'];
      expect(signatureDecisions(content, run, catchBattle('pidgey'))).toHaveLength(0);
      run.log.speciesCaught = ['pidgey', 'rattata', 'zubat'];
      expect(signatureDecisions(content, run, catchBattle('rattata'))).toHaveLength(0);
      run.pending = signatureDecisions(content, run, catchBattle('zubat'));
      expect(run.pending).toHaveLength(1);
      const res = chooseSignatureOption(run, 1);
      expect(res.grant).toEqual({ partyLevels: 1 });
    });
  });
});

describe('trainer perk systems: N, Rei, Looker, Mallow', () => {
  const info = { ...hit, userTypes: ['normal'] as const };
  const runOf = (seed: string, archetypeId: string) => chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId }), 0);

  it('N: more damage only against the same species', () => {
    expect(damageDealtPerk(perks('n-classic'), { ...info, sameSpecies: true })).toBeCloseTo(1.15);
    expect(damageDealtPerk(perks('n-classic'), { ...info, sameSpecies: false })).toBe(1);
  });

  it('Rei: Agile-style (quick or light) and Strong-style (heavy) moves', () => {
    expect(moveStyleOf({ power: 40, priority: 0 })).toBe('agile');
    expect(moveStyleOf({ power: 80, priority: 1 })).toBe('agile');
    expect(moveStyleOf({ power: 80, priority: 0 })).toBeNull();
    expect(moveStyleOf({ power: 120, priority: 0 })).toBe('strong');
    expect(moveStyleOf({ power: null, priority: 0 })).toBeNull();
    expect(damageDealtPerk(perks('rei'), { ...info, moveStyle: 'agile' })).toBeCloseTo(1.2);
    expect(damageDealtPerk(perks('rei'), { ...info, moveStyle: 'strong' })).toBeCloseTo(0.9);
    expect(damageDealtPerk(perks('rei'), { ...info, moveStyle: null })).toBe(1);
  });

  it('Looker: some stages hide an item without an Itemfinder, the same ones every time', () => {
    const hiddenOf = (id: string) => Array.from({ length: 40 }, (_, i) => hiddenItemNode(content, runOf(`looker-${i}`, id)));
    const looker = hiddenOf('spr-pt-looker');
    const found = looker.filter((n) => n !== null).length;
    expect(found).toBeGreaterThan(0);
    expect(found).toBeLessThan(25);
    expect(hiddenOf('spr-pt-looker')).toEqual(looker);
    expect(hiddenOf('red').every((n) => n === null)).toBe(true);
  });

  it('Mallow: Berries and Honey last 25% longer, rounded up; other items are unchanged', () => {
    expect(foodCount(perks('mallow'), 'razz-berry', 1)).toBe(2);
    expect(foodCount(perks('mallow'), 'bluk-berry', 3)).toBe(4);
    expect(foodCount(perks('mallow'), 'honey', 1)).toBe(2);
    expect(foodCount(perks('mallow'), 'repel', 1)).toBe(1);
    expect(foodCount(perks('red'), 'razz-berry', 1)).toBe(1);
  });
});

describe('trainer perk systems: evasion and Lusamine', () => {
  const info = { ...hit, userTypes: ['normal'] as const };

  it('evasion for Morty and Phoebe (Ghost-types only) and Marley (everyone)', () => {
    expect(evasionPerk(perks('morty'), ['ghost'])).toBeCloseTo(1.1);
    expect(evasionPerk(perks('morty'), ['normal'])).toBe(1);
    expect(evasionPerk(perks('phoebe-gen-6'), ['ghost', 'dark'])).toBeCloseTo(1.1);
    expect(evasionPerk(perks('marley'), ['normal'])).toBeCloseTo(1.15);
  });

  it('Lusamine (Masters): Ultra Beasts hit harder, the rest earn less experience', () => {
    expect(damageDealtPerk(perks('lusamine-masters'), { ...info, userUltraBeast: true })).toBeCloseTo(1.25);
    expect(damageDealtPerk(perks('lusamine-masters'), { ...info, userUltraBeast: false })).toBe(1);
    const xp = (ultraBeast: boolean) => xpPerk(perks('lusamine-masters'), { types: ['poison'], baseSpeed: 70, isStarter: false, isBossBattle: false, ultraBeast });
    expect(xp(true)).toBe(1);
    expect(xp(false)).toBeCloseTo(0.85);
  });

  it('Lusamine (Nihilego): Poison and Psychic damage, less HP', () => {
    expect(damageDealtPerk(perks('lusamine-nihilego'), { ...info, userTypes: ['poison'] })).toBeCloseTo(1.2);
    expect(statPerk(perks('lusamine-nihilego'), 'hp', ['poison'])).toBeCloseTo(0.9);
  });

  it('Beautiful Parasite: one Assimilation after each boss, two at most, each costing 5% more damage taken', () => {
    const run = chooseStarter(content, createRun(content, { runId: 't', seed: 'bp', archetypeId: 'lusamine-nihilego' }), 0);
    const foe = { ...run.party[0]!, uid: 'e1', speciesId: 'charizard', level: 30 };
    const gym = createBattle('trainer', [foe], 0, run.party[0]!.uid, { classId: 'gym-leader', name: 'Brock', leaderId: 'brock' });
    gym.outcome = 'win';
    const ordinary = createBattle('trainer', [foe], 0, run.party[0]!.uid, { classId: 'youngster', name: 'Joey', leaderId: null });
    ordinary.outcome = 'win';
    expect(signatureDecisions(content, run, ordinary)).toHaveLength(0);
    run.pending = signatureDecisions(content, run, gym);
    expect(run.pending[0]!.kind === 'signature' && run.pending[0]!.options).toHaveLength(3);
    chooseSignatureOption(run, 0);
    expect(statPerk(run.perkEffects, 'spa', ['normal'])).toBeCloseTo(1.1);
    run.pending = signatureDecisions(content, run, gym);
    chooseSignatureOption(run, 2);
    expect(statPerk(run.perkEffects, 'spe', ['normal'])).toBeCloseTo(1.1);
    const taken = damageTakenPerk(run.perkEffects, { targetTypes: ['normal'], moveType: 'normal', attackerIsLegendary: false, attackerIsBoss: false, weather: null });
    expect(taken).toBeCloseTo(1.05 * 1.05);
    expect(signatureDecisions(content, run, gym)).toHaveLength(0);
  });
});

describe('trainer perk systems: Lana fishing and Looker bonus rewards', () => {
  const runOf = (seed: string, archetypeId: string) => chooseStarter(content, createRun(content, { runId: 'r', seed, archetypeId }), 0);
  const spots = (run: ReturnType<typeof runOf>) => run.stage!.map.nodes.flatMap((n) => n.sides.filter((s) => s.kind === 'fish').map((s) => ({ node: n.id, side: s.id })));

  it('Lana gets a fishing spot every stage without a Rod; others do not', () => {
    const lana = runOf('lana-fish', 'lana');
    expect(spots(lana).length).toBeGreaterThan(0);
    expect(spots(runOf('lana-fish', 'red'))).toHaveLength(0);
  });

  it('Lana: her offers are the same every time, and on average stronger than a plain Old Rod', () => {
    const bst = (id: string) => Object.values(getSpecies(content, id).baseStats).reduce((a, b) => a + b, 0);
    let withPerk = 0;
    let without = 0;
    for (let i = 0; i < 30; i++) {
      const run = runOf(`lana-odds-${i}`, 'lana');
      const spot = spots(run)[0]!;
      run.stage!.current = spot.node;
      const offer = fishingOffer(content, run, spot.side);
      expect(fishingOffer(content, run, spot.side)).toEqual(offer);
      withPerk += bst(offer[0]!.speciesId);
      const plain = { ...run, archetypeId: 'red' };
      without += bst(fishingOffer(content, plain, spot.side)[0]!.speciesId);
    }
    expect(withPerk).toBeGreaterThan(without);
  });

  it('Looker: the bonus reward chance is 20%, others have none', () => {
    expect(bonusRewardChancePerk(perks('spr-pt-looker'))).toBeCloseTo(0.2);
    expect(bonusRewardChancePerk(perks('red'))).toBe(0);
    expect(fishingRareTriesPerk(perks('lana'))).toBe(2);
  });
});

describe('perk re-reads (left-out 2.8)', () => {
  it('Raihan boosts sandstorm and hail too', () => {
    for (const weather of ['rain', 'sun', 'sand', 'hail'] as const) {
      expect(damageDealtPerk(perks('raihan'), { ...hit, weather }), weather).toBeCloseTo(1.2);
    }
    expect(damageDealtPerk(perks('raihan'), { ...hit, weather: 'snow' })).toBe(1);
  });
  it('Calem makes Mega Stone crafting cost 20% less, other recipes unchanged', async () => {
    const { recipeCost, CRAFTING } = await import('../../src/core/crafting');
    const run = createRun(content, { runId: 'cm', seed: 'calem', archetypeId: 'calem' });
    const mega = CRAFTING.recipes.find((r) => r.gives.kind === 'megaStone')!;
    expect(recipeCost(content, run, mega)['star-core']).toBe(Math.ceil(mega.cost['star-core']! * 0.8));
    const plain = createRun(content, { runId: 'cm2', seed: 'calem', archetypeId: 'red' });
    expect(recipeCost(content, plain, mega)).toEqual(mega.cost);
    const other = CRAFTING.recipes.find((r) => r.gives.kind !== 'megaStone')!;
    expect(recipeCost(content, run, other)).toEqual(other.cost);
  });
});
