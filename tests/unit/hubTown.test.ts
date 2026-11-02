// Hub Town (spec 2026-11-01): the map data, walking rules, the Pokémon you walk as, the trainers on the Legacy Display,
// the Strange Merchant, and the v17 profile migration.
import { describe, expect, it } from 'vitest';
import { HUB_TOWN, OVERWORLD } from '../../src/core/hubTown/schema';
import { WalkGrid, ahead, chooseHubPokemon, facingOf, followerKey, gateAt, hubPokemon, hubPokemonChoices, mostUsedSpecies, placeAhead, placeById, trainerSheet } from '../../src/core/hubTown/world';
import { crowdSize, crowdSpecies, crowdWindow, hubCrowd } from '../../src/core/hubTown/roster';
import { chatterFor, chatterLines } from '../../src/core/hubTown/chatter';
import { HUB_MERCHANT, boughtToday, buyFromMerchant, merchantProblem, merchantStock } from '../../src/core/hubTown/merchant';
import { createProfile } from '../../src/core/profile';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { content } from './helpers';

const mastery = (battles: number, caught: number, seen: number) => ({ battles, caught, seen }) as never;

describe('the town map', () => {
  const [W, H] = HUB_TOWN.size;
  const grid = new WalkGrid();

  it('has full layers, every place reachable from a walkable stand, and doors inside the map', () => {
    expect(HUB_TOWN.ground).toHaveLength(W * H);
    expect(HUB_TOWN.overlay).toHaveLength(W * H);
    for (const p of HUB_TOWN.places) {
      expect(grid.inside(p.door.x, p.door.y), p.id).toBe(true);
      if (p.kind !== 'sign') expect(grid.isSolid(p.stand.x, p.stand.y), `${p.id} stand`).toBe(false);
    }
  });

  it('can walk from the spawn to every door (flood fill over walkable tiles)', () => {
    const seen = new Set<number>();
    const queue = [HUB_TOWN.spawn];
    seen.add(HUB_TOWN.spawn.y * W + HUB_TOWN.spawn.x);
    while (queue.length) {
      const t = queue.shift()!;
      for (const f of ['up', 'down', 'left', 'right'] as const) {
        const n = ahead(t, f);
        const k = n.y * W + n.x;
        if (seen.has(k) || grid.isSolid(n.x, n.y)) continue;
        seen.add(k);
        queue.push({ ...n, facing: f });
      }
    }
    for (const p of HUB_TOWN.places) {
      // A building door is faced from an open tile next to it; a gate is stood on.
      const near = p.kind === 'gate' ? [p.door] : (['up', 'down', 'left', 'right'] as const).map((f) => ahead(p.door, f));
      expect(near.some((t) => seen.has(t.y * W + t.x)), p.id).toBe(true);
    }
  });

  it('every room a place opens is a Hub room, and the spawn faces the Run Prep Center (Enter starts a run)', () => {
    const rooms = new Set(['run', 'archive', 'achievements', 'bank', 'lab', 'attributes', 'history', 'quests', 'mastery', 'research', 'codex', 'wardrobe', 'card', 'events', 'fame', 'legacy', 'memories', 'mentors', 'tales', 'tree', 'prestige', 'network', 'museum', 'intel', 'moves', 'seeds', 'nook', 'merchant', 'hubmon', 'save', 'depart', 'town']);
    for (const p of HUB_TOWN.places) for (const r of p.rooms) expect(rooms.has(r), `${p.id}: ${r}`).toBe(true);
    expect(placeAhead(HUB_TOWN.spawn, HUB_TOWN.spawn.facing)?.rooms).toEqual(['run']);
  });

  it('every pad, keeper and sheet it names exists', () => {
    for (const [x, y] of HUB_TOWN.pads) expect(grid.isSolid(x, y)).toBe(false);
    for (const k of HUB_TOWN.keepers) expect(OVERWORLD.trainers).toContain(k.sprite);
    expect(Object.keys(OVERWORLD.followers).length).toBeGreaterThan(900);
  });
});

describe('walking rules', () => {
  it('blocks solid tiles, the map edge and other people, and finds doors and gates', () => {
    const grid = new WalkGrid();
    expect(grid.canEnter(-1, 0)).toBe(false);
    const { x, y } = HUB_TOWN.spawn;
    expect(grid.canEnter(x, y)).toBe(true);
    grid.claim('npc', { x, y });
    expect(grid.canEnter(x, y, 'player')).toBe(false);
    expect(grid.canEnter(x, y, 'npc')).toBe(true);
    grid.release('npc', { x, y });
    expect(grid.canEnter(x, y, 'player')).toBe(true);
    const gate = placeById('gate')!;
    expect(gateAt(gate.door)?.id).toBe('gate');
    expect(gateAt(HUB_TOWN.spawn)).toBeNull();
    expect(placeById('nope')).toBeNull();
    expect(facingOf(1, -1)).toBe('right');
    expect(facingOf(0, -1)).toBe('up');
    expect(facingOf(0, 0)).toBeNull();
  });
});

describe('the Pokémon you walk as', () => {
  it('is the chosen one, else the most used, else Pikachu; choosing never touches anything else', () => {
    const base = createProfile(content, 'walk');
    expect(hubPokemon(base)).toEqual({ speciesId: null, follower: 'PIKACHU' });
    const used = { ...base, mastery: { charmander: mastery(9, 1, 3), bulbasaur: mastery(2, 1, 5), squirtle: mastery(0, 0, 1) } };
    expect(mostUsedSpecies(used)).toBe('charmander');
    expect(hubPokemon(used).follower).toBe('CHARMANDER');
    expect(hubPokemonChoices(used)).toEqual(['charmander', 'bulbasaur']);
    const chose = chooseHubPokemon(used, 'bulbasaur');
    expect(hubPokemon(chose).speciesId).toBe('bulbasaur');
    expect({ ...chose, hubTown: used.hubTown }).toEqual(used);
    // Uncaught or unknown species are refused; null goes back to "most used".
    expect(chooseHubPokemon(used, 'squirtle')).toBe(used);
    expect(chooseHubPokemon(used, 'missingno')).toBe(used);
    expect(hubPokemon(chooseHubPokemon(chose, null)).speciesId).toBe('charmander');
  });

  it('finds a follower sheet for forms and special names', () => {
    expect(followerKey('nidoran-f')).toBe('NIDORANfE');
    expect(followerKey('pikachu')).toBe('PIKACHU');
    expect(followerKey('charizard-mega-x', { CHARIZARD: 64 })).toBe('CHARIZARD');
    expect(followerKey('not-a-mon', {})).toBeNull();
  });
});

describe('Legacy Display trainers', () => {
  it('uses a named sheet, then a class sheet, then a stable generic one', () => {
    expect(trainerSheet('red')).toBe('trainer_POKEMONTRAINER_Red');
    expect(trainerSheet('blue-gen-7')).toBe('blue_overworld');
    expect(trainerSheet('hiker-anthony', 'Hiker Anthony')).toBe('trHiker');
    const a = trainerSheet('cynthia', 'Cynthia');
    expect(OVERWORLD.trainers).toContain(a);
    expect(trainerSheet('cynthia', 'Cynthia')).toBe(a);
  });
});

describe('the Strange Merchant', () => {
  const day = '2026-11-02';
  const rich = () => ({ ...createProfile(content, 'shop'), bankCredits: 5000 });

  it('sells a stable, limited stock of real items each day', () => {
    const stock = merchantStock(day);
    expect(stock).toHaveLength(HUB_MERCHANT.stockSize);
    expect(merchantStock(day)).toEqual(stock);
    expect(new Set(stock.map((w) => w.item)).size).toBe(stock.length);
    for (const w of HUB_MERCHANT.pool) expect(content.items.has(w.item), w.item).toBe(true);
    const week = new Set(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => merchantStock(d).map((w) => w.item).join()));
    expect(week.size).toBeGreaterThan(1);
  });

  it('buying pays, puts the item in the next run boon, and sells out until tomorrow', () => {
    const ware = merchantStock(day)[0]!;
    const p = rich();
    const after = buyFromMerchant(p, ware.item, day);
    expect(after.bankCredits).toBe(5000 - ware.price);
    expect(after.town?.boon.items[ware.item]).toBe(1);
    expect(boughtToday(after, day)).toEqual([ware.item]);
    expect(merchantProblem(after, ware, day)).toMatch(/Sold out/);
    expect(buyFromMerchant(after, ware.item, day)).toBe(after);
    // Tomorrow the list starts fresh.
    expect(boughtToday(after, '2026-11-03')).toEqual([]);
  });

  it('refuses without credits or for items not in stock', () => {
    const ware = merchantStock(day)[0]!;
    const poor = { ...rich(), bankCredits: 0 };
    expect(merchantProblem(poor, ware, day)).toMatch(/Needs/);
    expect(buyFromMerchant(poor, ware.item, day)).toBe(poor);
    const other = HUB_MERCHANT.pool.find((w) => !merchantStock(day).includes(w))!;
    expect(merchantProblem(rich(), other, day)).toMatch(/Not in stock/);
  });
});

describe('save migration', () => {
  it('a version 16 profile loads with Hub Town defaults', () => {
    const storage = new MemoryStorageProvider();
    const { hubTown: _h, ...old } = createProfile(content, 'p17');
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 16, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.profileId).toBe('p17');
    expect(profile.hubTown).toEqual({ pokemon: null, merchantDay: '', bought: [] });
  });
});

describe('the crowd (who is out in town)', () => {
  const base = () => createProfile(content, 'crowd');

  it('is the same for one window, changes between windows, and grows with progress', () => {
    const p = base();
    const a = hubCrowd(p, '2026-11-02#20');
    expect(hubCrowd(p, '2026-11-02#20')).toEqual(a);
    expect(hubCrowd(p, '2026-11-02#21')).not.toEqual(a);
    expect(crowdWindow(new Date(2026, 10, 2, 10, 29))).toBe(crowdWindow(new Date(2026, 10, 2, 10, 0)));
    expect(crowdWindow(new Date(2026, 10, 2, 10, 30))).not.toBe(crowdWindow(new Date(2026, 10, 2, 10, 29)));
    const veteran = { ...p, stats: { ...p.stats, runsEnded: 12 } };
    expect(crowdSize(veteran).trainers).toBeGreaterThan(crowdSize(p).trainers);
    expect(a.filter((w) => w.kind === 'trainer').length).toBeGreaterThan(5);
    expect(a.filter((w) => w.kind === 'pokemon').length).toBeGreaterThan(5);
  });

  it('stands only on free, walkable tiles away from doors, keepers and pedestals', () => {
    const crowd = hubCrowd(base(), 'w');
    const grid = new WalkGrid();
    const seen = new Set<string>();
    const reserved = new Set([...HUB_TOWN.places.flatMap((p) => [p.door, p.stand]), ...HUB_TOWN.keepers].map((t) => `${t.x},${t.y}`));
    for (const w of crowd) {
      const k = `${w.start.x},${w.start.y}`;
      expect(grid.isSolid(w.start.x, w.start.y), w.id).toBe(false);
      expect(reserved.has(k), w.id).toBe(false);
      expect(seen.has(k), w.id).toBe(false);
      seen.add(k);
      if (w.kind === 'trainer') expect(OVERWORLD.trainers).toContain(w.sheet);
      else expect(OVERWORLD.followers[w.sheet]).toBeGreaterThan(0);
    }
  });

  it('shows the Pokémon you have met once there are a few', () => {
    const p = { ...base(), mastery: Object.fromEntries(['charmander', 'bulbasaur', 'squirtle', 'pidgey', 'rattata', 'oddish', 'zubat'].map((id) => [id, mastery(1, 0, 1)])) };
    expect(crowdSpecies(p)).toEqual(['bulbasaur', 'charmander', 'oddish', 'pidgey', 'rattata', 'squirtle', 'zubat']);
    for (const w of hubCrowd(p, 'x').filter((w) => w.kind === 'pokemon')) expect(crowdSpecies(p)).toContain(w.speciesId);
  });
});

describe('what the townspeople say', () => {
  it('talks about real history when there is some, and is stable per person and window', () => {
    const p = createProfile(content, 'talk');
    const fresh = chatterLines(content, p);
    expect(fresh.length).toBeGreaterThan(5);
    const runs = { ...p, stats: { ...p.stats, runsEnded: 7 } };
    expect(chatterLines(content, runs).join('\n')).toContain('7 journeys');
    expect(chatterFor(content, runs, 'trainer-1', 'w')).toBe(chatterFor(content, runs, 'trainer-1', 'w'));
    // Reading history never changes it.
    const before = JSON.stringify(runs);
    chatterLines(content, runs);
    expect(JSON.stringify(runs)).toBe(before);
  });
});
