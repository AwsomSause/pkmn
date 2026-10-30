import { describe, expect, it } from 'vitest';
import { createPokemon } from '../../src/core/pokemon';
import { chooseStarter, createRun } from '../../src/core/run';
import { POCKET, pocketOf, shopHint, shopUsers } from '../../src/ui/shopLook';
import { content } from './helpers';

const run = () => chooseStarter(content, createRun(content, { runId: 'r', seed: 'shop-look', archetypeId: 'red' }), 0);
const item = (id: string) => content.items.get(id)!;

describe('shop rows (Visual Bible shops)', () => {
  it('every item category has a bag-pocket icon and a word', () => {
    expect(pocketOf(item('poke-ball'))).toEqual({ frame: POCKET.balls, word: 'Poké Ball' });
    expect(pocketOf(item('potion')).frame).toBe(POCKET.medicine);
    for (const i of content.items.values()) expect(pocketOf(i).frame).toBeGreaterThanOrEqual(0);
  });

  it('an evolution item says who in the party can use it, or that nobody can', () => {
    const r = run();
    const stone = [...content.items.values()].find((i) => i.id === 'thunder-stone')!;
    expect(shopUsers(content, r, stone)).toBe('Nobody in your party can use it');
    r.party.push(createPokemon(content, 'pikachu', 20, 'pika'));
    expect(shopUsers(content, r, stone)).toBe('Pikachu can use it');
    expect(shopUsers(content, r, item('potion'))).toBeNull();
  });

  it('the hint names the category, what you own and your money', () => {
    const r = run();
    r.inventory = { ...r.inventory, potion: 2 };
    r.money = 750;
    const hint = shopHint(content, r, item('potion'));
    expect(hint).toMatch(/^Medicine: /);
    expect(hint).toContain('You have 2');
    expect(hint).toContain('₽750 to spend');
  });
});
