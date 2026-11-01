// Settings > Game Summary (W13): built from the content, so every species, move, ability and item is covered.
import { describe, expect, it } from 'vitest';
import { gameSummary } from '../../src/core/encyclopedia';
import { content } from './helpers';

describe('Game Summary', () => {
  const topics = gameSummary(content);
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));

  it('covers every Pokémon, move, ability and item in the game', () => {
    expect(byId.pokemon!.entries).toHaveLength(content.species.size);
    expect(byId.moves!.entries).toHaveLength(content.moves.size);
    expect(byId.abilities!.entries).toHaveLength(content.abilities.size);
    expect(byId.items!.entries).toHaveLength(content.items.size);
    expect(byId.catalog!.entries).toHaveLength(content.catalog.size);
    expect(byId.bosses!.entries).toHaveLength(content.bosses.size);
    expect(byId.achievements!.entries).toHaveLength(content.achievements.size);
  });

  it('every entry has a name, a short line and text, and ids are unique within a topic', () => {
    for (const t of topics) {
      expect(t.entries.length, t.id).toBeGreaterThan(0);
      expect(new Set(t.entries.map((e) => e.id)).size, t.id).toBe(t.entries.length);
      for (const e of t.entries) {
        expect(e.name, `${t.id}/${e.id}`).not.toBe('');
        expect(e.text, `${t.id}/${e.id}`).not.toBe('');
        expect(`${e.name}${e.short}${e.text}`, `${t.id}/${e.id}`).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it('describes the save buttons and no longer mentions Guard or Brace as player options', () => {
    const text = byId.how!.entries.map((e) => e.text).join(' ');
    expect(text).toMatch(/Save & Quit/);
    expect(text).not.toMatch(/Brace to counter|Guard Break/);
  });
});
