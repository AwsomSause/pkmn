// Milestone 9: battle animations and the presentation-cue layer.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBattle, resolveTurn, type BattleContext, type BattleEvent } from '../../src/core/battle/engine';
import { createPokemon } from '../../src/core/pokemon';
import { CompactAnimSchema, Focus, FrameTarget, placeFrame, type CompactFrame } from '../../src/core/presentation/animFormat';
import { planCues, type Cue, type PresentationSettings } from '../../src/core/presentation/cues';
import { animCatalogInputs } from '../../src/core/presentation/moveAnims';
import { hashSeed, Rng } from '../../src/core/rng';
import type { PokemonInstance } from '../../src/core/state';
import { moveAnims } from '../../src/data/presentation';
import { MemoryStorageProvider } from '../../src/save/storage';
import { SaveManager } from '../../src/save/saveManager';
import { content } from './helpers';

const root = join(import.meta.dirname, '..', '..');
const assets = join(root, 'public', 'assets');
const data = moveAnims();
const FULL: PresentationSettings = { mode: 'full', intensity: 1 };

function battleCtx(seed: string) {
  const player = createPokemon(content, 'charmander', 20, 'p1');
  const enemy = createPokemon(content, 'bulbasaur', 20, 'e1');
  const party: PokemonInstance[] = [player];
  const battle = createBattle('wild', [enemy], 0, player.uid);
  const ctx: BattleContext = { content, battle, party, inventory: {}, rng: new Rng(hashSeed(seed)), captureRng: new Rng(hashSeed(`${seed}-c`)), catchMultiplier: 1 };
  return { ctx, player, enemy };
}

const kinds = (cues: Cue[][]) => cues.flat().map((c) => c.kind);

describe('move presentation data', () => {
  it('gives every move a presentation definition', () => {
    for (const id of content.moves.keys()) expect(data.moves[id], id).toBeDefined();
  });

  it('uses each move\'s own animation when it has one', () => {
    for (const [id, look] of Object.entries(data.moves)) {
      if (look.source === 'own') expect(look.anim).toBe(id);
      expect(data.anims[look.anim], `${id} -> ${look.anim}`).toBeDefined();
    }
    for (const name of Object.values(data.common)) expect(data.anims[name], name).toBeDefined();
  });

  it('has every animation file, sprite sheet, background and sound it names, in the compact format', () => {
    const files = animCatalogInputs(data);
    for (const name of files.names) {
      const path = join(assets, 'battle-anims', `${name}.json`);
      expect(existsSync(path), path).toBe(true);
      const parsed = CompactAnimSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
      expect(parsed.success, name).toBe(true);
    }
    for (const s of [...files.sheets, ...files.backgrounds]) expect(existsSync(join(assets, 'images', 'battle_anims', `${s}.png`)), s).toBe(true);
    for (const s of files.sounds) expect(existsSync(join(assets, 'audio', 'battle_anims', `${s}.m4a`)), s).toBe(true);
  });

  it('lists every animation in the asset manifest so it can be loaded on demand', () => {
    const manifest = JSON.parse(readFileSync(join(assets, 'manifest.json'), 'utf8')) as { assets: { id: string; lazy?: boolean }[] };
    const anim = manifest.assets.filter((a) => a.id.startsWith('anim.'));
    const files = animCatalogInputs(data);
    expect(anim.length).toBe(files.names.length + files.sheets.length + files.backgrounds.length + files.sounds.length);
    expect(anim.every((a) => a.lazy)).toBe(true);
  });
});

describe('animation placement', () => {
  const user = { x: 106, y: 148, halfHeight: 32 };
  const target = { x: 234, y: 84, halfHeight: 32 };
  const frame = (kind: number, x: number, y: number, focus: number): CompactFrame => [kind, 0, x, y, 100, 100, 0, 255, 1, 0, 1, focus];

  it('matches the layout the files were drawn for', () => {
    expect(placeFrame(frame(FrameTarget.GRAPHIC, 0, 0, Focus.USER), user, target)).toMatchObject({ x: 106, y: 116, scaleX: 1 });
    expect(placeFrame(frame(FrameTarget.GRAPHIC, 128, -64, Focus.TARGET), user, target)).toMatchObject({ x: 234, y: 52 });
  });

  it('follows the Pokémon when they stand elsewhere', () => {
    const t2 = { x: 250, y: 90, halfHeight: 40 };
    expect(placeFrame(frame(FrameTarget.GRAPHIC, 128, -64, Focus.TARGET), user, t2)).toMatchObject({ x: 250, y: 50 });
  });

  it('runs user-to-target paths the other way (and mirrors the sheet) when the foe attacks', () => {
    // Swap sides: the "user" is now top right.
    const start = placeFrame(frame(FrameTarget.GRAPHIC, 0, 0, Focus.USER_TARGET), target, user);
    const end = placeFrame(frame(FrameTarget.GRAPHIC, 128, -64, Focus.USER_TARGET), target, user);
    expect(start).toMatchObject({ x: 234, y: 52, scaleX: -1 });
    expect(end).toMatchObject({ x: 106, y: 116 });
  });
});

describe('presentation cues', () => {
  const tackleHit: BattleEvent[] = [
    { type: 'move', side: 'player', moveId: 'tackle' },
    { type: 'damage', side: 'enemy', amount: 12, hpAfter: 20, effectiveness: 2, crit: true },
  ];

  it('plays the move animation, then the hit with its number and badges', () => {
    const cues = planCues(tackleHit, content, data, FULL);
    expect(cues[0]!.map((c) => c.kind)).toEqual(['telegraph', 'moveAnim']);
    expect(cues[1]!.map((c) => c.kind)).toEqual(['impact', 'number', 'badge', 'badge']);
    const impact = cues[1]![0] as Extract<Cue, { kind: 'impact' }>;
    expect(impact.hitStopMs).toBeGreaterThan(0);
    expect(impact.shake).toBeGreaterThan(0);
  });

  it('skips the animation of a move that misses but still shows the marker', () => {
    const events: BattleEvent[] = [{ type: 'move', side: 'enemy', moveId: 'tackle' }, { type: 'miss', side: 'enemy' }];
    const cues = planCues(events, content, data, FULL);
    expect(kinds(cues)).toEqual(['telegraph']);
  });

  it('two-turn moves play their wind-up on the charging turn, not the attack', () => {
    const [id, look] = Object.entries(data.moves).find(([, l]) => l.chargeAnim)!;
    const events: BattleEvent[] = [{ type: 'move', side: 'player', moveId: id }, { type: 'charge', side: 'player', moveId: id, semi: null }];
    const cues = planCues(events, content, data, FULL);
    expect(kinds(cues)).toEqual(['telegraph', 'commonAnim']);
    expect(cues[1]![0]).toMatchObject({ anim: look.chargeAnim, side: 'player' });
  });

  it('aims self-targeting moves at the user', () => {
    const self = [...content.moves.values()].find((m) => m.target === 'self' && m.supported)!;
    const events: BattleEvent[] = [{ type: 'move', side: 'enemy', moveId: self.id }];
    const cues = planCues(events, content, data, FULL);
    expect(cues[0]!.find((c) => c.kind === 'moveAnim')).toMatchObject({ user: 'enemy', target: 'enemy' });
  });

  it('reduced motion: no move animation, shaking, flashing or hit-stop', () => {
    const cues = planCues(tackleHit, content, data, { mode: 'reduced', intensity: 1 }).flat();
    expect(cues.some((c) => c.kind === 'moveAnim' || c.kind === 'commonAnim')).toBe(false);
    expect(cues.some((c) => c.kind === 'pulse')).toBe(true);
    const impact = cues.find((c) => c.kind === 'impact') as Extract<Cue, { kind: 'impact' }>;
    expect([impact.shake, impact.hitStopMs, impact.flashAlpha, impact.flash]).toEqual([0, 0, 0, null]);
  });

  it('off: only the information (numbers and badges) is left', () => {
    expect(new Set(kinds(planCues(tackleHit, content, data, { mode: 'off', intensity: 1 })))).toEqual(new Set(['number', 'badge']));
  });

  it('intensity scales the shake down to nothing', () => {
    const impact = planCues(tackleHit, content, data, { mode: 'full', intensity: 0 })[1]![0] as Extract<Cue, { kind: 'impact' }>;
    expect(impact.shake).toBe(0);
    expect(impact.flashAlpha).toBe(0);
  });

  it('never changes the events, the battle or its random numbers', () => {
    const { ctx } = battleCtx('cues');
    const events = resolveTurn(ctx, { kind: 'move', index: 0 });
    const before = JSON.stringify({ events, battle: ctx.battle, party: ctx.party, rng: ctx.rng.state });
    const a = planCues(events, content, data, FULL);
    const b = planCues(events, content, data, FULL);
    planCues(events, content, data, { mode: 'reduced', intensity: 0.5 });
    expect(a).toEqual(b);
    expect(JSON.stringify({ events, battle: ctx.battle, party: ctx.party, rng: ctx.rng.state })).toBe(before);
  });

  it('a battle plays out the same whatever the animation settings', () => {
    const play = (settings: PresentationSettings) => {
      const { ctx } = battleCtx('same-result');
      const log: unknown[] = [];
      for (let t = 0; t < 30 && !ctx.battle.outcome; t++) {
        const events = resolveTurn(ctx, { kind: 'move', index: 0 });
        planCues(events, content, data, settings);
        log.push(events);
      }
      return JSON.stringify({ log, battle: ctx.battle, rng: ctx.rng.state });
    };
    expect(play({ mode: 'off', intensity: 0 })).toBe(play(FULL));
  });

  it('presentation code never draws random numbers', () => {
    const dirs = [join(root, 'src', 'core', 'presentation'), join(root, 'src', 'ui', 'battleFx')];
    for (const dir of dirs) {
      for (const f of readdirSync(dir)) {
        const text = readFileSync(join(dir, f), 'utf8');
        expect(text, f).not.toMatch(/Math\.random|from '.*\/rng'|\bRng\b/);
      }
    }
  });
});

describe('animation settings', () => {
  it('older settings get the new animation options when loaded', () => {
    const storage = new MemoryStorageProvider();
    storage.set('pkr.settings', JSON.stringify({ format: 'pkmn-roguelike', record: 'settings', schemaVersion: 1, savedAt: '', data: { musicVolume: 0.3, sfxVolume: 0.4, muted: false } }));
    expect(new SaveManager(storage, content).loadSettings()).toEqual({ musicVolume: 0.3, sfxVolume: 0.4, muted: false, battleAnimations: 'full', effectIntensity: 1 });
  });

  it('saves and reloads them', () => {
    const storage = new MemoryStorageProvider();
    const saves = new SaveManager(storage, content);
    saves.saveSettings({ musicVolume: 0.5, sfxVolume: 0.5, muted: true, battleAnimations: 'reduced', effectIntensity: 0.25 });
    expect(saves.loadSettings()).toMatchObject({ battleAnimations: 'reduced', effectIntensity: 0.25 });
  });
});
