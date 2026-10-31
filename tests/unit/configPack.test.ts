import { describe, expect, it } from 'vitest';
import { applyConfigPack, parseConfigPack } from '../../src/core/configPack';
import { DRAMA } from '../../src/core/drama/schema';

const pack = (flavor: unknown, extra: object = {}) => JSON.stringify({ format: 1, id: 'my-pack', name: 'My pack', author: 'Kice', flavor, ...extra });

describe('config packs (catalog 161)', () => {
  it('accepts a valid pack and adds its lines once', () => {
    const r = parseConfigPack(pack({ rookie: { opening: ['Ready, {name}?'] } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(applyConfigPack(r.pack)).toBe(1);
    expect(applyConfigPack(r.pack)).toBe(0);
    expect(DRAMA.flavor.rookie!.opening).toEqual(['Ready, {name}?']);
    delete DRAMA.flavor.rookie;
  });
  it('rejects bad JSON, wrong format, markup, unknown placeholders and unknown categories', () => {
    expect(parseConfigPack('{nope').ok).toBe(false);
    expect(parseConfigPack(pack({}, { format: 2 })).ok).toBe(false);
    expect(parseConfigPack(pack({ x: { opening: ['<script>alert(1)</script>'] } })).ok).toBe(false);
    expect(parseConfigPack(pack({ x: { opening: ['Hi {secret}'] } })).ok).toBe(false);
    expect(parseConfigPack(pack({ x: { shouting: ['Hi'] } })).ok).toBe(false);
  });
  it('enforces the size limits', () => {
    const many = Array.from({ length: 201 }, (_, i) => `Line ${i}`);
    const r = parseConfigPack(pack({ x: { opening: many } }));
    expect(r.ok).toBe(false);
    expect(parseConfigPack('x'.repeat(70 * 1024)).ok).toBe(false);
  });
});
