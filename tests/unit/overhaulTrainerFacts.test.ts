// Plans audit 2026-11-07 section 4: the pack's major trainers agree with the game's boss teams and species types.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('major trainer facts', () => {
  it('every ace is in its boss team and every type fits its ace or team', () => {
    expect(execFileSync('node', ['tools/overhaul/check-trainer-facts.mjs'], { encoding: 'utf8' }).trim()).toBe('trainer facts ok');
  });
});
