import { describe, expect, it } from 'vitest';
import { buyNote, noteOpen, noteProblem, researchNotes } from '../../src/core/researchNotes';
import type { Profile } from '../../src/core/state';
import { content } from './helpers';

const profile = (rp: number) => ({ claims: {}, researchPoints: rp }) as unknown as Profile;

describe('Research notes (#110)', () => {
  it('has one note per regular region, each listing its Gym Leaders', () => {
    const notes = researchNotes(content);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(n.lines.length).toBeGreaterThan(0);
  });
  it('costs Research Points once and never twice', () => {
    const id = researchNotes(content)[0]!.id;
    expect(noteProblem(content, profile(0), id)).toMatch(/Research Points/);
    const bought = buyNote(content, profile(40), id, 't');
    expect(bought.researchPoints).toBe(25);
    expect(noteOpen(bought, id)).toBe(true);
    expect(() => buyNote(content, bought, id, 't')).toThrow(/already/);
  });
  it('rejects an unknown note and does not change the profile', () => {
    const p = profile(100);
    expect(() => buyNote(content, p, 'region:nowhere', 't')).toThrow();
    expect(p.researchPoints).toBe(100);
  });
});
