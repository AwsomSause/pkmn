import { describe, expect, it } from 'vitest';
import { InputBuffer } from '../../src/core/inputBuffer';

describe('input buffer (#122)', () => {
  it('hands a fresh dropped press to the next screen once', () => {
    const b = new InputBuffer<string>(300);
    b.drop('confirm', 1000);
    expect(b.take(1200)).toBe('confirm');
    expect(b.take(1201)).toBeNull();
  });
  it('forgets a press that is too old and keeps only the latest', () => {
    const b = new InputBuffer<string>(300);
    b.drop('up', 1000);
    expect(b.take(1400)).toBeNull();
    b.drop('up', 2000);
    b.drop('confirm', 2100);
    expect(b.take(2200)).toBe('confirm');
  });
});
