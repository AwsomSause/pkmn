import { describe, expect, it } from 'vitest';
import { choiceKind } from '../../src/core/events';
import { EVENT_BACKDROPS, EVENT_STYLE_IDS, EVENT_STYLES_READY, eventBackdrop, eventStyleOf, nextEventStyle } from '../../src/core/presentation/eventStyles';
import { FIXED_ASSETS } from '../../src/assets/catalog';
import { SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { content } from './helpers';

describe('event styles setting', () => {
  it('cycles only through built styles and falls back to Diorama', () => {
    expect(eventStyleOf(undefined)).toBe('diorama');
    expect(eventStyleOf('nonsense')).toBe('diorama');
    for (const id of EVENT_STYLE_IDS) expect(EVENT_STYLES_READY).toContain(eventStyleOf(id));
    let at = EVENT_STYLES_READY[0]!;
    const seen = new Set<string>();
    for (let i = 0; i < EVENT_STYLES_READY.length; i++) (seen.add(at), (at = nextEventStyle(at)));
    expect([...seen].sort()).toEqual([...EVENT_STYLES_READY].sort());
    expect(at).toBe(EVENT_STYLES_READY[0]);
  });

  it('old settings saves load with the Diorama style (settings v14 -> v15)', () => {
    const storage = new MemoryStorageProvider();
    const current = new SaveManager(storage, content).loadSettings();
    const { eventStyle: _e, ...old } = current;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 14, savedAt: '', data: old }));
    expect(new SaveManager(storage, content).loadSettings().eventStyle).toBe('diorama');
  });
});

describe('event backdrops', () => {
  it('maps the stage type and the hour to art that exists', () => {
    expect(eventBackdrop(['grass'], 'Approved events', 'afternoon')).toBe('forest');
    expect(eventBackdrop(['grass'], 'Approved events', 'evening')).toBe('forest_eve');
    expect(eventBackdrop(['normal'], 'Approved events', 'night')).toBe('field_night');
    expect(eventBackdrop(['ghost'], 'Approved events', 'morning')).toBe('forest_night');
  });
  it('a group can pick its own place and hour (Entei on a midnight cliff)', () => {
    expect(eventBackdrop(['water'], 'Roaming Legendaries', 'morning')).toBe('rocky_night');
    expect(eventBackdrop(['fire'], 'Wild Pokémon scenes', 'afternoon')).toBe('forest');
  });
  it('a missing hour falls to the nearest drawn one, and unknown types get a field', () => {
    expect(eventBackdrop(['ice'], 'x', 'afternoon')).toBe('snow_eve');
    expect(eventBackdrop(['psychic'], 'x', 'night')).toBe('ruins');
    expect(eventBackdrop([], 'x', 'afternoon')).toBe('field');
  });
  it('every backdrop file is in the asset catalog', () => {
    const ids = new Set(FIXED_ASSETS.map((e) => e.id));
    for (const [bg, times] of Object.entries(EVENT_BACKDROPS)) for (const t of times) expect(ids.has(`pack.memories.eventbg.${t === 'day' ? bg : `${bg}_${t}`}`), `${bg} ${t}`).toBe(true);
  });
});

describe('choice kinds', () => {
  const kinds = new Set<string>();
  for (const ev of content.events.values()) for (const c of ev.choices) kinds.add(choiceKind(c, c.check !== undefined || c.chance !== undefined ? 0.5 : null));
  it('every kind is used by some event choice', () => {
    expect([...kinds].sort()).toEqual(['battle', 'chance', 'cost', 'safe', 'trade']);
  });
  it('a sure battle is a battle; a trade is a trade', () => {
    const ambush = content.events.get('rocket-ambush')!;
    expect(choiceKind(ambush.choices[0]!, null)).toBe('battle');
    const trade = [...content.events.values()].flatMap((e) => e.choices).find((c) => c.success.effects.some((f) => f.kind === 'tradeAway'))!;
    expect(choiceKind(trade, null)).toBe('trade');
  });
});
