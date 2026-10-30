import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

const Entry = z.object({ id: z.string().min(1), name: z.string().min(1), group: z.string(), text: z.string().min(10), status: z.enum(['planned', 'limited', 'supported', 'disabled']) });
const Catalog = z.object({ source: z.string(), paths: z.array(Entry), personalities: z.array(Entry), styles: z.array(Entry), offscreenEvents: z.array(Entry), arcs: z.array(Entry), mechanics: z.array(Entry) });

describe('rivalCatalog.json (everything the Examples doc lists)', () => {
  const catalog = Catalog.parse(JSON.parse(readFileSync(new URL('../../src/data/rivalCatalog.json', import.meta.url), 'utf8')));
  it('has every entry of the doc, with unique ids', () => {
    expect(catalog.paths).toHaveLength(30);
    expect(catalog.personalities).toHaveLength(40);
    expect(catalog.styles).toHaveLength(32);
    expect(catalog.offscreenEvents).toHaveLength(39); // the doc says 40 but skips #19
    expect(catalog.arcs).toHaveLength(46); // 36 long-form + 10 Overdrive-specific
    expect(catalog.mechanics).toHaveLength(24);
    for (const list of [catalog.paths, catalog.personalities, catalog.styles, catalog.offscreenEvents, catalog.arcs, catalog.mechanics]) {
      expect(new Set(list.map((e) => e.id)).size).toBe(list.length);
    }
  });
});
