import { describe, expect, it } from 'vitest';
import { carryFlags, endOfRunLetter, headToHead, inheritFlags, rivalMood, rivalNickname, scoreboardLine } from '../../src/core/rivals/ledger';
import events from '../../src/data/events.json';

type R = { name: string; encounters: number; setbacks: number; lastResult: 'win' | 'lose' | null; state: string; resolution: 'good' | 'bad' | null; world: null };
const rival = (name: string, encounters: number, setbacks: number, extra: Partial<R> = {}): R => ({ name, encounters, setbacks, lastResult: 'win', state: 'ally', resolution: null, world: null, ...extra });
const run = (runId: string, outcome: 'victory' | 'defeat', rivals: R[] = [], narrative: string[] = []) => ({ runId, outcome, rivals, narrative, source: 'run' as const, seed: runId });

describe('rival ledger (W6)', () => {
  it('sums the head-to-head record per rival and sorts by battles fought', () => {
    const rows = headToHead([run('a', 'victory', [rival('Blue', 3, 1), rival('Silver', 1, 0)]), run('b', 'defeat', [rival('Blue', 2, 2, { lastResult: 'lose' })])]);
    expect(rows[0]).toMatchObject({ name: 'Blue', fought: 5, won: 2, lost: 3, runsMet: 2 });
    expect(rows[1]!.name).toBe('Silver');
    expect(scoreboardLine(rows[0]!)).toBe('Blue: you 2, them 3 (5 battles over 2 runs)');
  });
  it('ignores rivals you never fought and clamps setbacks to the battles fought', () => {
    expect(headToHead([run('a', 'victory', [rival('Nobody', 0, 0), rival('Odd', 1, 4)])])).toEqual([expect.objectContaining({ name: 'Odd', won: 0, lost: 1 })]);
  });
  it('gives a stable nickname that changes only with your record', () => {
    expect(rivalNickname([])).toBe('Newcomer');
    const runs = [run('r3', 'victory'), run('r2', 'victory'), run('r1', 'defeat')];
    expect(rivalNickname(runs)).toBe(rivalNickname(runs));
    expect(['Champ', 'Hotshot', 'Big Shot']).toContain(rivalNickname(runs));
    expect(['Underdog', 'Stubborn', 'Comeback']).toContain(rivalNickname([run('x', 'defeat')]));
  });
  it('moods follow the newest streak', () => {
    expect(rivalMood([]).mood).toBe('steady');
    expect(rivalMood([run('a', 'victory'), run('b', 'defeat')]).mood).toBe('irked');
    expect(rivalMood([run('a', 'victory'), run('b', 'victory')]).mood).toBe('impressed');
    expect(rivalMood([run('a', 'defeat'), run('b', 'defeat'), run('c', 'victory')])).toMatchObject({ mood: 'smug', streak: 2 });
  });
  it('writes a run-end letter from the most fought rival, or none', () => {
    expect(endOfRunLetter(run('s', 'victory'), 'Champ')).toBeNull();
    const letter = endOfRunLetter(run('s', 'defeat', [rival('Gary', 1, 0), rival('Hop', 4, 1)]), 'Underdog')!;
    expect(letter.from).toBe('Hop');
    expect(letter.text).toContain('Next time, Underdog.');
    expect(endOfRunLetter(run('s', 'defeat', [rival('Hop', 2, 0)]), 'X')).toEqual(endOfRunLetter(run('s', 'defeat', [rival('Hop', 2, 0)]), 'X'));
  });
  it('carries promises to the next run and only from the newest run', () => {
    expect(carryFlags({ 'ev:carry-rival-promise': 1, 'ev:rival-friend': 3, 'ev:carry-gone': 0 })).toEqual(['flag:carry-rival-promise']);
    expect(inheritFlags([run('new', 'defeat', [], ['flag:carry-rival-promise']), run('old', 'victory', [], ['flag:carry-other'])])).toEqual({ 'ev:inherit-rival-promise': 1 });
    expect(inheritFlags([])).toEqual({});
  });
  it('ships the W6 rival events with no-cost way out choices', () => {
    const list = (events as { events: { id: string; group: string; choices: { success: { battle?: unknown; effects: unknown[] } }[] }[] }).events.filter((e) => e.group === 'Rival Interactions');
    expect(list.length).toBeGreaterThanOrEqual(20);
    for (const e of list) expect(e.choices.some((c) => !c.success.battle), e.id).toBe(true);
  });
});
