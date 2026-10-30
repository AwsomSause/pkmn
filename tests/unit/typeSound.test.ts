import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TYPE_SOUND, typeSoundFor } from '../../src/core/presentation/typeSound';
import { content } from './helpers';

describe('type sound vocabulary (#127)', () => {
  it('has a real sound file for every type in the game', () => {
    const types = new Set([...content.moves.values()].map((m) => m.type));
    for (const t of types) {
      const slug = typeSoundFor(t);
      expect(slug, t).not.toBeNull();
      expect(existsSync(`public/assets/audio/battle_anims/${slug}.m4a`), `${t} -> ${slug}`).toBe(true);
    }
    expect(Object.keys(TYPE_SOUND)).toHaveLength(18);
  });
  it('returns null for an unknown type', () => expect(typeSoundFor('cosmic')).toBeNull());
});
