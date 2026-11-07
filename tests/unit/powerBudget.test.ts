// Overhaul slice 4 (THE OVERHAUL.md rule 2): every species and form fits its power class, and learnable moves fit the move cap.

import { describe, expect, it } from 'vitest';
import { basePower, movePower, overBudget, powerClass, powerScore, reachableForms } from '../../src/core/powerBudget';
import { buildContent } from '../../src/data';
import { content } from './helpers';

const sp = (id: string) => content.species.get(id)!;

describe('Power budget', () => {
  it('everything in the game fits its cap today (normal)', () => {
    expect(overBudget(content)).toEqual([]);
  });

  it('counts Tera and Z access: a species Z-Crystal counts more than the type Z-Move, and the gate uses the headroom', () => {
    const a = content.balance.powerBudget.access;
    const pika = powerScore(content, sp('pikachu'));
    expect(pika.withAccess).toBe(Math.round(pika.base * (1 + (a.teraPercent + a.speciesZPercent) / 100)));
    const bulba = powerScore(content, sp('bulbasaur'));
    expect(bulba.withAccess).toBe(Math.round(bulba.base * (1 + (a.teraPercent + a.zPercent) / 100)));
    expect(pika.withAccess).toBeGreaterThan(pika.base);
    // Tightening the headroom to 1 makes the strongest species fail the access check.
    const tight = { ...content, balance: { ...content.balance, powerBudget: { ...content.balance.powerBudget, access: { ...a, headroom: 1 } } } };
    expect(overBudget(tight as typeof content).some((l) => l.includes('Tera/Z access'))).toBe(true);
  });

  it('puts species in the right class', () => {
    expect(powerClass(sp('pichu'))).toBe('baby');
    expect(powerClass(sp('charmander'))).toBe('basic');
    expect(powerClass(sp('charmeleon'))).toBe('middle');
    expect(powerClass(sp('charizard'))).toBe('final');
    expect(powerClass(sp('mewtwo'))).toBe('legendary');
    expect(powerClass(sp('mew'))).toBe('mythical');
    expect(powerClass(sp('charizard-mega-x'))).toBe('form');
  });

  it('a species is also scored with the battle forms it can reach, and the score is stable', () => {
    expect(reachableForms(content, 'charizard')).toEqual(expect.arrayContaining(['charizard-mega-x', 'charizard-mega-y']));
    const p = powerScore(content, sp('charizard'));
    expect(p.withForms).toBeGreaterThan(p.base);
    expect(p.withForms).toBe(Math.max(...reachableForms(content, 'charizard').map((id) => basePower(content, id)), p.base));
    expect(powerScore(content, sp('charizard'))).toEqual(p);
  });

  it('a species exactly at its cap passes; one point over fails (boundary)', () => {
    const c = buildContent();
    const base = basePower(c, 'garchomp');
    c.balance.powerBudget.caps.final = base;
    expect(overBudget(c).filter((x) => x.startsWith('species garchomp '))).toEqual([]);
    c.balance.powerBudget.caps.final = base - 1;
    expect(overBudget(c)).toContain(`species garchomp (final): ${base} > ${base - 1}`);
  });

  it('a new overpowered form or move is caught; an exempt one is not (failure)', () => {
    const c = buildContent();
    const mega = c.species.get('charizard-mega-x')!;
    mega.baseStats = { hp: 255, atk: 255, def: 255, spa: 255, spd: 255, spe: 255 };
    const hit = c.moves.get('tackle')!;
    hit.power = 300;
    const problems = overBudget(c);
    expect(problems.some((p) => p.startsWith('species charizard-mega-x (form):'))).toBe(true);
    expect(problems).toContain(`move tackle: ${movePower(hit)} > ${c.balance.powerBudget.moveCap}`);
    c.balance.powerBudget.exempt['charizard-mega-x'] = 'test';
    expect(overBudget(c).some((p) => p.startsWith('species charizard-mega-x'))).toBe(false);
  });

  it('move power counts accuracy and the most hits; status moves score 0', () => {
    expect(movePower(content.moves.get('growl')!)).toBe(0);
    const m = content.moves.get('bullet-seed')!;
    expect(movePower(m)).toBe(Math.round(m.power! * ((m.accuracy ?? 100) / 100) * m.effects.hits![1]));
  });
});
