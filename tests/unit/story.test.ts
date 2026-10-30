import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runAttributeEffects } from '../../src/core/attributes';
import { createBattle, resolveTurn, type BattleContext } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { finalizeRun } from '../../src/core/profile';
import { createStreams, hashSeed, Rng, STREAM_NAMES } from '../../src/core/rng';
import { chooseStarter, createRun, debugHealParty, takeTurn, useItemOutsideBattle } from '../../src/core/run';
import type { RunState } from '../../src/core/state';
import { applyStoryEffect } from '../../src/core/story/effects';
import { resolveQueue, type StoryTrigger } from '../../src/core/story/queue';
import {
  createEnemyProfile,
  createStoryState,
  emit,
  eventId,
  openHistory,
  openRelationship,
  topMoments,
} from '../../src/core/story/record';
import { buildContent, RAW_CONTENT } from '../../src/data';
import { GameSession } from '../../src/game/GameSession';
import { CURRENT_VERSIONS, SaveManager } from '../../src/save/saveManager';
import { MemoryStorageProvider } from '../../src/save/storage';
import { autoplay, gameplayFingerprint, step } from './autoplay';
import { content, toBattle } from './helpers';

const LOVE = { love: 100 };

function freshRun(seed = 'story-seed'): RunState {
  return chooseStarter(content, createRun(content, { runId: `run-${seed}`, seed, archetypeId: 'red', attributes: LOVE }), 0);
}

/** A battle where the enemy always knocks out the player's Pokémon in one hit. */
function doomedBattle(seed: string): RunState {
  let run = toBattle(freshRun(seed));
  const enemy = createPokemon(content, 'machamp', 80, 'e900');
  enemy.moves = [{ id: 'cross-chop', pp: 30 }];
  run = structuredClone(run);
  run.battle = createBattle('wild', [enemy], 0, run.party[0]!.uid);
  return run;
}

describe('story foundation: random streams', () => {
  it('adds the story and hyper streams without changing any existing stream', () => {
    const streams = createStreams('SEED42');
    expect(STREAM_NAMES).toContain('story');
    expect(STREAM_NAMES).toContain('hyper');
    for (const name of ['starter', 'encounter', 'reward', 'battle', 'map', 'capture', 'shop'] as const) {
      expect(streams[name]).toEqual(hashSeed(`SEED42::${name}`));
    }
  });

  // Fingerprints of what the rules decided for these seeds, recorded on main
  // before the story layer existed (tests/unit/autoplay.ts). If one changes,
  // the story layer has changed a gameplay roll. Re-pinned after M8.75 item
  // effects slices 2 to 3b-3 (held, map, shop, money, map-movement and map-stop items in drafts, bosses
  // holding items), which change play on purpose.
  const BEFORE_STORY: Record<string, string> = {
    'STORY1/0': '510cb88e183af954',
    'STORY2/0': '289336f1e73c4f84',
    'STORY4/0': '96f2cac3866fccfe',
    'STORY5/0': '6a94ccb4c56bb170',
    'STORY6/0': 'fb12816df446bfee',
    'STORY7/0': '173c815313e80667',
    'STORY8/0': '9c19185effaefb06',
  };
  // Hyper moments (M8.9 Phase 1) do change battles on purpose, so the check runs without their definitions:
  // what is left must still match main exactly, which proves the story and hyper streams moved no other roll.
  // Love 0 only, and not STORY3: on main, Love's old endure was rolled on the battle stream once Love grew
  // above 0 (STORY3 reaches Love 3), and that roll is gone now that Toughened It Out rolls on the hyper stream.
  const noHyper = buildContent({ ...structuredClone(RAW_CONTENT), story: { ...structuredClone(RAW_CONTENT.story as object), definitions: [] } });
  it('old seeds play exactly as they did before the story layer (Hyper moments switched off)', () => {
    for (const [key, expected] of Object.entries(BEFORE_STORY)) {
      const [seed, love] = key.split('/');
      const run = autoplay({ content: noHyper, seed: seed!, steps: 600, healOnMap: true, attributes: { love: Number(love) } });
      expect(createHash('sha1').update(gameplayFingerprint(run)).digest('hex').slice(0, 16), key).toBe(expected);
    }
  });
});

describe('story foundation: domain events', () => {
  it('ids are the seed plus a sequence number, and the same inputs give the same event list', () => {
    const a = autoplay({ seed: 'EVENTS', steps: 300, healOnMap: true, starterLevel: 30, attributes: LOVE });
    const b = autoplay({ seed: 'EVENTS', steps: 300, healOnMap: true, starterLevel: 30, attributes: LOVE });
    expect(a.story.events.length).toBeGreaterThan(20);
    expect(a.story).toEqual(b.story);
    const ids = a.story.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of a.story.events) expect(e.id).toBe(eventId('EVENTS', e.seq));
  });

  it('records the run: start, starter, routes, battles, moves, knockouts', () => {
    const run = autoplay({ seed: 'EVENTS', steps: 40, healOnMap: true, starterLevel: 30 });
    const types = new Set(run.story.events.map((e) => e.type));
    for (const t of ['runStarted', 'starterChosen', 'routeChosen', 'battleStarted', 'moveUsed', 'knockout', 'battleEnded']) expect(types, t).toContain(t);
    const starter = run.story.histories[run.log.starterUid!]!;
    expect(starter.joinedBy).toBe('starter');
    expect(starter.battles).toBeGreaterThan(0);
    expect(starter.knockoutsDealt).toBeGreaterThan(0);
    const start = run.story.events.find((e) => e.type === 'battleStarted')!;
    expect(start.where.battle).toBe(0);
    expect(start.where.level).toBe(1);
  });

  it('keeps only the most recent events, and every list within its limit', () => {
    const run = autoplay({ seed: 'LONGRUN', steps: 1500, healOnMap: true, starterLevel: 60, attributes: LOVE });
    const { limits } = content.story;
    expect(run.story.seq).toBeGreaterThan(limits.recentEvents);
    expect(run.story.events).toHaveLength(limits.recentEvents);
    expect(run.story.events.at(-1)!.seq).toBe(run.story.seq);
    expect(run.story.chronicle.length).toBeLessThanOrEqual(limits.chronicleEntries);
    for (const h of Object.values(run.story.histories)) expect(h.memories.length).toBeLessThanOrEqual(limits.memoriesPerPokemon);
  });
});

describe('story foundation: records and limits', () => {
  it('a Pokémon keeps its history (same uid) through evolution', () => {
    let run = structuredClone(freshRun('evolve'));
    const uid = run.party[0]!.uid;
    const original = run.party[0]!.speciesId;
    // Swap in an Eevee with the same uid (as if it had always been Eevee) and evolve it with a stone.
    run.party[0] = { ...createPokemon(content, 'eevee', 20, uid), friendship: 70 };
    run.story.histories[uid]!.speciesId = 'eevee';
    run.phase = 'map';
    run.inventory['fire-stone'] = 1;
    run = useItemOutsideBattle(content, run, 'fire-stone', 0, 'flareon').run;
    expect(run.party[0]!.speciesId).toBe('flareon');
    const history = run.story.histories[uid]!;
    expect(history.originalSpeciesId).toBe(original);
    expect(history.speciesId).toBe('flareon');
    expect(history.evolutions.at(-1)).toMatchObject({ from: 'eevee', to: 'flareon', trigger: 'item' });
    expect(history.memories.some((m) => m.type === 'evolved')).toBe(true);
  });

  it('keeps the 20 most important memories per Pokémon and the chronicle at 300', () => {
    const run = freshRun('limits');
    const uid = run.party[0]!.uid;
    for (let i = 0; i < 400; i++) emit(content, run, 'closeCall', { actors: [uid], text: `close call ${i}`, importance: i === 7 ? 99 : 45 });
    const history = run.story.histories[uid]!;
    expect(history.memories).toHaveLength(20);
    expect(history.memories.some((m) => m.text === 'close call 7')).toBe(true);
    expect(run.story.chronicle).toHaveLength(300);
    expect(topMoments(run.story, 1)[0]!.text).toBe('close call 7');
  });

  it('caps open relationships at 12 and recurring enemies at 6 per run, 3 per region', () => {
    const run = freshRun('caps');
    const cause = emit(content, run, 'storyMoment');
    let made = 0;
    for (let i = 0; i < 20; i++) if (openRelationship(content, run, 'rivalry', { kind: 'pokemon', id: 'p1' }, { kind: 'trainer', id: `t${i}` }, cause)) made++;
    expect(made).toBe(12);
    expect(openRelationship(content, run, 'bond', { kind: 'pokemon', id: 'p1' }, { kind: 'pokemon', id: 'p2' }, cause)).toBeNull();
    const enemy = (i: number) => ({ id: `en${i}`, name: `Enemy ${i}`, trainerId: null, team: [] });
    let enemies = 0;
    for (let i = 0; i < 5; i++) if (createEnemyProfile(content, run, enemy(i))) enemies++;
    expect(enemies).toBe(3);
    run.regionIndex = 1;
    for (let i = 5; i < 10; i++) if (createEnemyProfile(content, run, enemy(i))) enemies++;
    expect(enemies).toBe(6);
    run.regionIndex = 2;
    expect(createEnemyProfile(content, run, enemy(11))).toBeNull();
  });
});

describe('story foundation: effects are never applied twice', () => {
  it('a run effect with the same id only pays once', () => {
    const run = freshRun('effects');
    const money = run.money;
    expect(applyStoryEffect(content, run, 'gift#1', { kind: 'money', amount: 500 })).toBe('applied');
    expect(applyStoryEffect(content, run, 'gift#1', { kind: 'money', amount: 500 })).toBe('alreadyApplied');
    expect(run.money).toBe(money + 500);
    expect(applyStoryEffect(content, run, 'flag#1', { kind: 'flag', flag: 'metRival', value: true })).toBe('applied');
    expect(run.story.flags.metRival).toBe(true);
    expect(applyStoryEffect(content, run, 'friend#1', { kind: 'friendship', amount: 10 }, 'nobody')).toBe('notApplicable');
  });

  it('survives a save and reload: the ledger is in the save', () => {
    const storage = new MemoryStorageProvider();
    const session = new GameSession(content, storage);
    session.newRun('red', 'ledger-seed');
    session.chooseStarter(0);
    applyStoryEffect(content, session.run!, 'gift#7', { kind: 'item', itemId: 'potion', quantity: 3 });
    const potions = session.run!.inventory.potion;
    new SaveManager(storage, content).saveRun(session.run!);
    const resumed = new GameSession(content, storage).continueRun();
    expect(applyStoryEffect(content, resumed, 'gift#7', { kind: 'item', itemId: 'potion', quantity: 3 })).toBe('alreadyApplied');
    expect(resumed.inventory.potion).toBe(potions);
  });

  it('battle effects belong to the battle and are thrown away when it ends', () => {
    const run = doomedBattle('battle-effect');
    const uid = run.party[0]!.uid;
    expect(applyStoryEffect(content, run, 'boost@x', { kind: 'statStage', stat: 'atk', stages: 2 }, uid)).toBe('applied');
    expect(applyStoryEffect(content, run, 'boost@x', { kind: 'statStage', stat: 'atk', stages: 2 }, uid)).toBe('alreadyApplied');
    expect(run.battle!.playerStages.atk).toBe(2);
    expect(run.story.appliedEffects).not.toContain('boost@x');
    run.battle = null;
    expect(applyStoryEffect(content, run, 'boost@x', { kind: 'statStage', stat: 'atk', stages: 2 }, uid)).toBe('notApplicable');
  });
});

describe('story foundation: the event queue', () => {
  const trigger = (defId: string, priority: StoryTrigger['priority'], combat: boolean, at: number, order: number, major = true): StoryTrigger => ({
    defId,
    uid: 'p1',
    title: defId,
    message: `${defId}!`,
    priority,
    combat,
    at,
    order,
    names: {},
    cue: { major, color: '#ffffff', sound: null, music: null, cutIn: false, shake: false },
  });

  it('resolves in priority order and lets only the top combat effect apply', () => {
    const result = resolveQueue(
      [trigger('memory', 'memory', false, 3, 0), trigger('bond', 'bondRivalry', true, 3, 1), trigger('survive', 'knockoutPrevention', true, 3, 2)],
      3,
    );
    expect(result.resolved.map((t) => t.defId)).toEqual(['survive', 'memory']);
    expect(result.suppressed.map((t) => t.defId)).toEqual(['bond']);
  });

  it('merges moments shown at the same time into one banner, and keeps to the per-battle budget', () => {
    const result = resolveQueue([trigger('a', 'memory', false, 2, 0), trigger('b', 'flavour', false, 2, 1), trigger('c', 'memory', false, 5, 2)], 1);
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0]).toMatchObject({ at: 2, title: 'a · b', messages: ['a!', 'b!'], major: true });
    expect(result.cues[1]).toMatchObject({ at: 5, major: false, sound: null });
    expect(result.majorUsed).toBe(1);
  });
});

describe('story foundation: Hyper definitions', () => {
  it('without the definitions the engine has no Hyper moments', () => {
    const raw = structuredClone(RAW_CONTENT) as typeof RAW_CONTENT & { story: { definitions: unknown[] } };
    raw.story.definitions = [];
    const noStory = buildContent(raw);
    for (let i = 0; i < 40; i++) {
      const before = doomedBattle(`nodef-${i}`);
      const result = takeTurn(noStory, before, { kind: 'move', index: 0 });
      expect(result.events.some((e) => e.type === 'hyper')).toBe(false);
      expect(result.run.rng.hyper).toEqual(before.rng.hyper);
    }
  });

  it('rejects a definition whose effect the engine does not know for its trigger', () => {
    const raw = structuredClone(RAW_CONTENT) as typeof RAW_CONTENT & { story: { definitions: { effect: unknown }[] } };
    raw.story.definitions[0]!.effect = { kind: 'money', amount: 5 };
    expect(() => buildContent(raw)).toThrow(/toughenedItOut event needs a "endure" effect/);
  });
});

describe('story foundation: saves', () => {
  it('saving and reloading after every action plays exactly like never reloading', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    const straight = autoplay({ seed: 'RELOAD', steps: 250, healOnMap: true, starterLevel: 30, attributes: LOVE });
    let run = createRun(content, { runId: 'test-RELOAD', seed: 'RELOAD', archetypeId: 'red', campaignId: 'full', attributes: LOVE });
    for (let i = 0; i < 250 && run.phase !== 'over'; i++) {
      // Same steps as autoplay(), with a save and a load in between every one.
      expect(saves.saveRun(run)).toEqual({ ok: true });
      const loaded = saves.loadRun();
      if (loaded.status !== 'ok') throw new Error(loaded.status);
      run = loaded.data;
      if (run.phase === 'map') run = debugHealParty(content, run);
      const next = step(content, run);
      if (run.phase === 'starter') next.run.party[0] = { ...createPokemon(content, next.run.party[0]!.speciesId, 30, next.run.party[0]!.uid), friendship: next.run.party[0]!.friendship };
      run = next.run;
    }
    expect(run).toEqual(straight);
  });

  it('upgrades a version 8 run: empty story, new streams from the seed, endure list moved to the ledger', () => {
    const storage = new MemoryStorageProvider();
    let run = doomedBattle('upgrade');
    const { story: _story, ...rest } = run;
    const { story: _s, hyper: _h, ...oldRng } = run.rng;
    const { storyEffects: _e, ...battle } = run.battle!;
    const v8 = { ...rest, rng: oldRng, battle: { ...battle, enduredUids: ['p1'] } };
    storage.set('pkr.run', JSON.stringify({ format: 'pkmn-roguelike', record: 'run', schemaVersion: 8, savedAt: '', data: v8 }));
    const loaded = new SaveManager(storage, content).loadRun();
    expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') return;
    expect(loaded.migratedFrom).toBe(8);
    expect(loaded.data.story).toEqual(createStoryState());
    expect(loaded.data.rng.story).toEqual(hashSeed('upgrade::story'));
    expect(loaded.data.rng.hyper).toEqual(hashSeed('upgrade::hyper'));
    expect(loaded.data.rng.battle).toEqual(run.rng.battle);
    // v8 → v9 → v10: Love's endure is now "Toughened It Out".
    expect(loaded.data.battle!.storyEffects).toEqual(['toughened-it-out@p1']);
    // Continuing gives the party its histories.
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: CURRENT_VERSIONS.profile, savedAt: '', data: new GameSession(content, new MemoryStorageProvider()).profile }));
    run = new GameSession(content, storage).continueRun();
    expect(Object.keys(run.story.histories)).toEqual(run.party.map((m) => m.uid));
  });

  it('upgrades a version 5 profile: old Run History entries get no moments', () => {
    const storage = new MemoryStorageProvider();
    const profile = new GameSession(content, new MemoryStorageProvider()).profile;
    const oldEntry = { runId: 'r', endedAt: '', seed: 's', archetypeId: 'red', campaignId: 'full', victory: false, regionsCleared: 0, regions: 10, badges: 0, encounters: 3, defeatedBy: null, party: [], bankCredits: 0, researchPoints: 0, achievements: [] };
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 5, savedAt: '', data: { ...profile, runHistory: [oldEntry] } }));
    const loaded = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(loaded.warning).toBeUndefined();
    expect(loaded.profile.runHistory[0]!.moments).toEqual([]);
  });
});

describe('story foundation: transformations', () => {
  it('a Mega Evolution is told as a transformation, never as an evolution, and its reversion is silent', () => {
    let run = structuredClone(toBattle(freshRun('mega')));
    const uid = run.party[0]!.uid;
    run.party[0] = { ...createPokemon(content, 'venusaur', 60, uid), friendship: 70 };
    run.party[0].moves = [{ id: 'tackle', pp: 35 }];
    run.inventory['mega-ring'] = 1;
    run.inventory.venusaurite = 1;
    const enemy = createPokemon(content, 'snorlax', 60, 'e900');
    enemy.moves = [{ id: 'splash', pp: 40 }];
    run.battle = createBattle('wild', [enemy], 0, uid);
    run = takeTurn(content, run, { kind: 'move', index: 0, transform: { kind: 'mega' } }).run;
    expect(run.party[0]!.speciesId).toBe('venusaur-mega');
    let guard = 0;
    while (run.phase === 'battle' && guard++ < 60) run = takeTurn(content, run, { kind: 'move', index: 0 }).run;
    expect(run.phase).not.toBe('battle');
    expect(run.party[0]!.speciesId).toBe('venusaur');
    const events = run.story.events;
    expect(events.filter((e) => e.type === 'transformed')).toHaveLength(1);
    expect(events.find((e) => e.type === 'transformed')!.data).toMatchObject({ kind: 'mega', from: 'venusaur', to: 'venusaur-mega' });
    expect(events.some((e) => e.type === 'evolved')).toBe(false);
    expect(run.story.histories[uid]!.memories.some((m) => m.text === 'Mega Evolved into Mega Venusaur')).toBe(true);
  });
});

describe('story foundation: the run-end story', () => {
  it('the chronicle ends with the run, and its top five moments go into the Run History', () => {
    const run = autoplay({ seed: 'STORY3', steps: 2000, healOnMap: true, starterLevel: 25, attributes: LOVE });
    expect(run.phase).toBe('over');
    const ended = run.story.events.filter((e) => e.type === 'runEnded');
    expect(ended).toHaveLength(1);
    const top = topMoments(run.story);
    expect(top.length).toBeGreaterThan(0);
    expect(top.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < top.length; i++) expect(top[i - 1]!.importance).toBeGreaterThanOrEqual(top[i]!.importance);
    const profile = new GameSession(content, new MemoryStorageProvider()).profile;
    const { profile: after } = finalizeRun(content, profile, run);
    expect(after.runHistory[0]!.moments).toEqual(top.map((m) => m.text));
  });

  it('a new history is opened for a Pokémon only once', () => {
    const run = freshRun('once');
    const uid = run.party[0]!.uid;
    const first = run.story.histories[uid];
    expect(openHistory(content, run, uid, 'pikachu', 'gift')).toBe(first);
  });
});
