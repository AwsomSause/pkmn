// Ideas W5: NPCs, shops and story. Shop loyalty and the secret tier, insurance, NPC memory across runs, lore/news/diary/backstory,
// Tales room data, credits foes, drama tags, settings/profile migrations, and the consistency of the new map events.
import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/core/battle/engine';
import { buildCredits, defeatedLines } from '../../src/core/credits';
import { flavorTags } from '../../src/core/drama/flavor';
import { buryFallen } from '../../src/core/nuzlocke';
import { NEWS_KEPT, backstoryFor, buildNewsIssue, diaryLine, foldNpcMemory, loreFound, ngVariant, nextHint, seedNpcMemory, taleEntries } from '../../src/core/npcMemory';
import { eventFlag, npcShopFactor, secretTierEntries, spendInsurance } from '../../src/core/npcShop';
import { createProfile, finalizeRun } from '../../src/core/profile';
import { chooseStarter, createRun, shopPrice, shopStock } from '../../src/core/run';
import { STANDARD_CHOICE } from '../../src/core/rules';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { content } from './helpers';

const newRun = (seed = 'w5') => chooseStarter(content, createRun(content, { runId: seed, seed, archetypeId: 'red' }), 0);
const setFlag = (run: ReturnType<typeof newRun>, key: string, n: number) => { run.story.flags[`ev:${key}`] = n; };

describe('shopkeeper loyalty and the secret tier', () => {
  it('discounts grow with loyalty and never go below the best step reached', () => {
    const run = newRun();
    expect(npcShopFactor(content, run.story)).toBe(1);
    setFlag(run, 'shop-loyalty', 2);
    expect(npcShopFactor(content, run.story)).toBeCloseTo(0.95);
    setFlag(run, 'shop-loyalty', 4);
    expect(npcShopFactor(content, run.story)).toBeCloseTo(0.9);
    setFlag(run, 'shop-loyalty', 40);
    expect(npcShopFactor(content, run.story)).toBeCloseTo(0.85);
    const entry = content.shop.find((e) => e.price >= 100)!;
    const base = shopPrice(content, newRun(), entry);
    expect(shopPrice(content, run, entry)).toBeLessThan(base);
  });
  it('the secret tier stays closed until a gift opens it, and adds stock without duplicating the shop', () => {
    const run = newRun();
    expect(secretTierEntries(content, run.story)).toEqual([]);
    const before = shopStock(content, run).length;
    setFlag(run, 'secret-shop', 1);
    expect(secretTierEntries(content, run.story).length).toBeGreaterThan(0);
    const after = shopStock(content, run);
    expect(after.length).toBeGreaterThan(before);
    expect(new Set(after.map((e) => e.item)).size).toBe(after.length);
  });
});

describe('insurance', () => {
  const nz = () => {
    const run = chooseStarter(content, createRun(content, { runId: 'ins', seed: 'ins', archetypeId: 'red', rules: { ...STANDARD_CHOICE, modeId: 'nuzlocke' } }), 0);
    run.party.push({ ...structuredClone(run.party[0]!), uid: 'p-extra', level: run.party[0]!.level + 5 });
    return run;
  };
  it('saves the highest-level fallen Pokémon once per policy, then burial resumes', () => {
    const run = nz();
    setFlag(run, 'insured', 1);
    run.party[0]!.hp = 0;
    run.party[1]!.hp = 0;
    run.party.push({ ...structuredClone(run.party[0]!), uid: 'p-alive', hp: 10 });
    expect(buryFallen(content, run, 'x')).toHaveLength(1);
    expect(run.party.some((m) => m.uid === 'p-extra')).toBe(true);
    expect(eventFlag(run.story, 'insured')).toBe(0);
    expect(buryFallen(content, run, 'y')).toHaveLength(1);
  });
  it('does nothing without a policy', () => {
    const run = nz();
    const fallen = [{ level: 5 }, { level: 9 }];
    expect(spendInsurance(run, fallen)).toEqual(fallen);
  });
});

describe('NPC memory across runs', () => {
  it('folds a finished run once, seeds the next run, and ignores a second finalize', () => {
    const run = newRun('mem');
    setFlag(run, 'mem-mara-spared', 1);
    setFlag(run, 'mem-mara-helped', 1);
    setFlag(run, 'trust-ranger', 6);
    setFlag(run, 'lore-hollow-bell', 1);
    setFlag(run, 'lore-nonsense', 1);
    setFlag(run, 'gossip-shiny', 1);
    run.itemCounters = { ...(run.itemCounters ?? {}), 'event-seen:fortune-teller': 1 };
    run.phase = 'over';
    run.victory = true;
    const first = finalizeRun(content, createProfile(content, 'p'), run);
    const mem = first.profile.npcMemory;
    expect(mem.npcs.mara).toMatchObject({ spared: 1, crushed: 0, helped: 1 });
    expect(mem.npcs.ranger!.trust).toBeGreaterThan(0);
    expect(mem.lore).toEqual(['hollow-bell']);
    expect(mem.ngPlus).toBe(1);
    expect(mem.epilogues.length).toBe(1);
    expect(mem.seenEvents).toContain('fortune-teller');
    expect(mem.news[0]).toContain('shiny');
    const again = finalizeRun(content, first.profile, run);
    expect(again.applied).toBe(false);
    expect(again.profile.npcMemory).toEqual(mem);
    const next = createRun(content, { runId: 'n2', seed: 'n2', archetypeId: 'red', npcMemory: mem });
    expect(next.story.flags['ev:remembers-mara-spared']).toBe(1);
    expect(next.story.flags['ev:ng-plus']).toBe(1);
    expect(next.story.flags['ev:lore-known']).toBe(1);
    // seeding never touches runs without memory
    expect(Object.keys(createRun(content, { runId: 'n3', seed: 'n3', archetypeId: 'red' }).story.flags).filter((k) => k.startsWith('ev:remembers'))).toEqual([]);
  });
  it('keeps at most NEWS_KEPT issues, newest first', () => {
    let mem = createProfile(content, 'p').npcMemory;
    for (let i = 0; i < NEWS_KEPT + 3; i++) mem = foldNpcMemory(content, mem, newRun(`news-${i}`));
    expect(mem.news).toHaveLength(NEWS_KEPT);
    expect(mem.news[0]).toBe(buildNewsIssue(content, newRun(`news-${NEWS_KEPT + 2}`)));
  });
  it('seedNpcMemory with no memory returns the story untouched', () => {
    const story = newRun().story;
    const before = JSON.stringify(story.flags);
    expect(JSON.stringify(seedNpcMemory(story, undefined).flags)).toBe(before);
  });
});

describe('story text banks', () => {
  it('backstories and diary lines are deterministic and fill their names', () => {
    const a = content.archetypes.get('red')!;
    expect(backstoryFor(content, a)).toBe(backstoryFor(content, a));
    expect(backstoryFor(content, a)).toContain(a.name);
    expect(diaryLine(content, 'u1', 'Charmander', 'Charmeleon')).toBe(diaryLine(content, 'u1', 'Charmander', 'Charmeleon'));
    expect(diaryLine(content, 'u1', 'Charmander', 'Charmeleon')).toContain('Charmander');
    expect(diaryLine(content, 'u1', 'Charmander', 'Charmeleon')).not.toContain('{');
  });
  it('lore, New Game+ steps and hints behave', () => {
    const mem = createProfile(content, 'p').npcMemory;
    expect(loreFound(content, mem)).toEqual([]);
    expect(ngVariant(content, 0)).toBeNull();
    expect(ngVariant(content, 3)!.atLeast).toBe(3);
    expect(nextHint(content, mem)).not.toBeNull();
    const seenAll = { ...mem, epilogues: ['storm', 'untouched', 'rivals', 'champion'] };
    expect(nextHint(content, seenAll)).toBeNull();
  });
  it('the Tales room lists the paper, hidden lore as ???, and what NPCs remember', () => {
    const mem = { ...createProfile(content, 'p').npcMemory, news: ['Headline'], lore: ['first-ember'], npcs: { 'old-ranger': { spared: 0, crushed: 2, helped: 1, trust: 3 } } };
    const rows = taleEntries(content, mem);
    expect(rows[0]).toMatchObject({ label: "Today's Paper", hint: 'Headline' });
    expect(rows.filter((r) => r.right === 'lore' && r.label === '???').length).toBe(content.npcStory.lore.length - 1);
    expect(rows.find((r) => r.right === 'remembers')!.hint).toContain('crushed 2x');
  });
});

describe('credits and drama', () => {
  it('lists the trainers you beat with their teams, capped, and nothing for a run with no wins', () => {
    const run = newRun('cr');
    expect(defeatedLines(content, run)).toEqual([]);
    run.story.enemyProfiles = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}`, name: `Foe ${i}`, trainerId: null, region: 0, team: [{ speciesId: run.party[0]!.speciesId, level: 5 }, { speciesId: 'missing-species', level: 5 }], battles: [{ eventId: 'x', result: 'win' as const, where: { regionIndex: 0, stage: 0, column: 0 } as never }], adaptations: [] }));
    const lines = defeatedLines(content, run);
    expect(lines.filter((l) => l.kind === 'text')).toHaveLength(8);
    expect(lines.filter((l) => l.kind === 'mons').every((l) => l.species!.length === 1)).toBe(true);
    expect(buildCredits(content, run).some((l) => l.text === 'Everyone We Beat')).toBe(true);
  });
  it('gym and Elite trainers react to badges, coverage, reputation and a returning player', () => {
    const run = newRun('dr');
    const battle = createBattle('trainer', [structuredClone(run.party[0]!)], 0, run.party[0]!.uid);
    const ctx = (cls: string) => ({ content, run, battle, cls } as never);
    expect(flavorTags(ctx('ordinary'))).not.toContain('newcomer');
    expect(flavorTags(ctx('gym'))).toContain('newcomer');
    run.badges = ['a', 'b', 'c', 'd', 'e', 'f'] as never;
    expect(flavorTags(ctx('gym'))).toContain('veteran');
    run.story.flags['ev:ng-plus'] = 2;
    expect(flavorTags(ctx('gym'))).toContain('returning');
  });
});

describe('save migrations', () => {
  it('a version 15 profile loads with empty NPC memory', () => {
    const storage = new MemoryStorageProvider();
    const { npcMemory: _n, ...old } = createProfile(content, 'p16');
    storage.set('pkr.profile', JSON.stringify({ format: 'pkmn-roguelike', record: 'profile', schemaVersion: 15, savedAt: '', data: old }));
    const { profile, warning } = new SaveManager(storage, content).loadOrCreateProfile(() => 'new');
    expect(warning).toBeUndefined();
    expect(profile.profileId).toBe('p16');
    expect(profile.npcMemory).toEqual({ npcs: {}, lore: [], epilogues: [], news: [], ngPlus: 0, hintsSeen: [], seenEvents: [] });
  });
  it('a version 13 settings record loads with skip-seen dialogue off', () => {
    const storage = new MemoryStorageProvider();
    const manager = new SaveManager(storage, content);
    const current = manager.loadSettings();
    const { skipSeenDialogue: _s, ...old } = current;
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 13, savedAt: '', data: old }));
    expect(new SaveManager(storage, content).loadSettings().skipSeenDialogue).toBe(false);
  });
});

describe('the new NPC events', () => {
  const w5 = [...content.events.values()].filter((e) => e.group === 'NPC Stories');
  const effects = w5.flatMap((e) => e.choices.flatMap((c) => [c.success, c.failure].flatMap((o) => [...(o?.effects ?? []), ...(o?.battle?.win ?? [])])));
  const setKeys = new Set(effects.flatMap((e) => (e.kind === 'flag' ? [e.key] : [])));
  it('adds a real batch, all valid and uniquely named', () => {
    expect(w5.length).toBeGreaterThanOrEqual(60);
    expect(new Set(w5.map((e) => e.id)).size).toBe(w5.length);
  });
  it('every flag an event waits for is set by some event (or is seeded from NPC memory)', () => {
    const waits = w5.flatMap((e) => [...e.requires, ...e.choices.flatMap((c) => c.requires)].flatMap((c) => (c.kind === 'flag' ? [c.key] : [])));
    for (const key of waits) {
      const ok = setKeys.has(key) || key === 'ng-plus' || (key.startsWith('remembers-') && setKeys.has(key.replace('remembers-', 'mem-')));
      expect(ok, `flag "${key}" is never set`).toBe(true);
    }
  });
  it('every lore fragment can be found, and every lore flag names a real fragment', () => {
    const lore = new Set(content.npcStory.lore.map((l) => l.id));
    const found = new Set([...setKeys].filter((k) => k.startsWith('lore-')).map((k) => k.slice(5)));
    for (const id of found) expect(lore.has(id), `unknown lore "${id}"`).toBe(true);
    for (const id of lore) expect(found.has(id), `lore "${id}" can never be found`).toBe(true);
  });
  it('every gossip flag has a gossip line', () => {
    for (const k of setKeys) if (k.startsWith('gossip-')) expect(content.npcStory.gossip[k.slice(7)], k).toBeTruthy();
  });
  it('every debt can be cleared and every policy needs the Nuzlocke mode', () => {
    expect(effects.some((e) => e.kind === 'flag' && e.key === 'debt' && e.amount < 0)).toBe(true);
    expect(content.events.get('insurance-agent')!.mode).toBe('nuzlocke');
  });
});

describe('skill-prompt event choices (chef, dance-off)', () => {
  it('use real prompts that exist, and the grade alone decides success', async () => {
    const { chooseEvent } = await import('../../src/core/events');
    for (const [id, prompt] of [['chef-cook-together', 'throw-ring'], ['dance-off', 'echo-rhythm']] as const) {
      const ev = content.events.get(id)!;
      const idx = ev.choices.findIndex((c) => c.prompt);
      expect(ev.choices[idx]!.prompt!.id).toBe(prompt);
      expect(ev.choices[idx]!.check).toBeUndefined();
      const place = () => {
        const run = newRun(`pr-${id}`);
        const node = run.stage!.map.nodes[0]!;
        run.stage!.current = node.id;
        node.sides = [{ id: 'w5-side', kind: 'event', eventId: id, used: false } as never];
        return { run, side: 'w5-side' };
      };
      const win = place();
      expect(chooseEvent(content, win.run, win.side, idx, undefined, 'perfect').success).toBe(true);
      const lose = place();
      expect(chooseEvent(content, lose.run, lose.side, idx, undefined, 'ok').success).toBe(false);
      const none = place();
      expect(chooseEvent(content, none.run, none.side, idx).success).toBe(false);
    }
  });
});
