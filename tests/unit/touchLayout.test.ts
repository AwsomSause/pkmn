import { describe, expect, it } from 'vitest';
import { MIN_READABLE_CANVAS, canvasWidth, showRotateHint, showTouchPad } from '../../src/core/presentation/touchLayout';

describe('mobile fallback (catalog #125)', () => {
  it('shows the pad on touch devices and narrow windows only', () => {
    expect(showTouchPad({ width: 1280, height: 720, coarse: false })).toBe(false);
    expect(showTouchPad({ width: 1280, height: 720, coarse: true })).toBe(true);
    expect(showTouchPad({ width: 600, height: 900, coarse: false })).toBe(true);
  });
  it('hints to rotate only on portrait phones', () => {
    expect(showRotateHint({ width: 390, height: 844, coarse: true })).toBe(true);
    expect(showRotateHint({ width: 844, height: 390, coarse: true })).toBe(false);
  });
  it('a landscape phone with the pad keeps a readable canvas', () => {
    expect(canvasWidth({ width: 844, height: 390, coarse: true }, 110)).toBeGreaterThanOrEqual(MIN_READABLE_CANVAS);
    expect(canvasWidth({ width: 1280, height: 720, coarse: false }, 0)).toBe(1280);
  });
});
