import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { variantIds, variantRows } from '../../src/core/variantReport';
import { content } from './helpers';

const root = join(__dirname, '../../public/assets');
const rows = variantRows(content, (p) => existsSync(join(root, p)));

describe('variant support report (catalog 84)', () => {
  it('covers every custom form', () => {
    expect(rows).toHaveLength(variantIds().length);
    expect(rows.length).toBeGreaterThan(300);
  });
  it('no custom form has a data problem (types, stats, evolutions, moves, learnset)', () => {
    const bad = rows.map((r) => ({ id: r.id, p: r.problems.filter((x) => !/sprite|icon|cry/.test(x)) })).filter((r) => r.p.length > 0);
    expect(bad).toEqual([]);
  });
  it('lists art problems for the report without hiding them', () => {
    const art = rows.filter((r) => r.problems.some((x) => /sprite|icon|cry/.test(x)));
    // A form with missing art is "invalid" in the report; the count is printed so a regression is visible.
    console.info(`variant art problems: ${art.length} of ${rows.length}`);
    expect(art.every((r) => r.status === 'invalid')).toBe(true);
  });
});

import { buyNote, formNotes, noteKey, researchNotes, silhouettes } from '../../src/core/researchNotes';
import { createProfile } from '../../src/core/profile';

describe('form hints in the research log (catalog 34, 79, 78, 110)', () => {
  it('has a note per special-form family and generation, with Delta habitat research', () => {
    const notes = formNotes(content);
    expect(notes.some((n) => n.id === 'forms:delta:1')).toBe(true);
    expect(notes.find((n) => n.id === 'forms:delta:1')!.lines.some((l) => l.startsWith('Habitat:'))).toBe(true);
    expect(researchNotes(content).length).toBeGreaterThan(notes.length);
  });
  it('a bought note shows its unmet forms as silhouettes, and meeting one removes it', () => {
    let profile = createProfile(content, 'p1');
    profile.researchPoints = 100;
    expect(silhouettes(content, profile).size).toBe(0);
    profile = buyNote(content, profile, 'forms:delta:1', '2026-01-01T00:00:00Z');
    const shadow = silhouettes(content, profile);
    expect(shadow.size).toBeGreaterThan(5);
    const first = [...shadow.keys()][0]!;
    profile.speciesSeen.push(first);
    expect(silhouettes(content, profile).has(first)).toBe(false);
    expect(noteKey('forms:delta:1')).toBe('note:forms:delta:1');
  });
});
