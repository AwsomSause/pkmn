// Entry point: validates game data, opens the save system and starts Phaser.

import { ruleWipe, wipeAssetId, type WipeMask } from './ui/battleFx/ruleWipe';
import { loadAssets } from './ui/lazyAssets';
import { installTouchControls, setTouchLayout } from './ui/touchControls';
import { sheenSweep } from './ui/battleFx/transitions';
import { installUiJuice, noteSceneEnter, pageEnter, setUiMotion } from './ui/wiiMotion';
import { uiMotionFrom } from './core/presentation/uiMotion';
import Phaser from 'phaser';
import { regionIdentity } from './core/presentation/regionIdentity';
import { getContent } from './data';
import { installDebugPanel } from './debug/debugPanel';
import { GameSession } from './game/GameSession';
import { LocalStorageProvider, MemoryStorageProvider, type StorageProvider } from './save/storage';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { BriefingScene } from './scenes/BriefingScene';
import { ExpeditionScene } from './scenes/ExpeditionScene';
import { MinigameScene } from './scenes/MinigameScene';
import { DecisionScene } from './scenes/DecisionScene';
import { CreditsScene } from './scenes/CreditsScene';
import { GameOverScene } from './scenes/GameOverScene';
import { HallOfFameScene } from './scenes/HallOfFameScene';
import { LegacyGalleryScene } from './scenes/LegacyGalleryScene';
import { MemoriesScene } from './scenes/MemoriesScene';
import { HubScene } from './scenes/HubScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SaveSlotsScene } from './scenes/SaveSlotsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { MapScene } from './scenes/MapScene';
import { PlazaScene } from './scenes/PlazaScene';
import { RewardScene } from './scenes/RewardScene';
import { RunPrepScene } from './scenes/RunPrepScene';
import { ShopScene } from './scenes/ShopScene';
import { EventScene } from './scenes/EventScene';
import { StarterSelectScene } from './scenes/StarterSelectScene';
import { TrainerSelectScene } from './scenes/TrainerSelectScene';
import { GAME_HEIGHT, GAME_WIDTH } from './ui/theme';
import { drawBackdrop } from './ui/widgets';
import { aeroBackdrop } from './ui/aero';
import { ArenaBackdrop } from './ui/showcase';
import { applyDisplaySettings } from './ui/display';
import { applyUiSkin } from './ui/uiSkin';
import { installPointerFx } from './ui/pointerFx';
import { installGamepad } from './ui/gamepad';
import { installShareTools } from './ui/shareCard';
import { enterTransition } from './ui/transitions';
import './style.css';

function showFatalError(message: string): void {
  const el = document.getElementById('fatal-error');
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
  console.error(message);
}

/** Uses browser storage if it works, otherwise temporary memory with a warning. */
function openStorage(): { storage: StorageProvider; warning?: string } {
  const local = new LocalStorageProvider();
  try {
    local.set('pkr.__test', '1');
    local.remove('pkr.__test');
    return { storage: local };
  } catch (err) {
    return {
      storage: new MemoryStorageProvider(),
      warning: `Saving is OFF: ${err instanceof Error ? err.message : String(err)} Progress will be lost when you close the page.`,
    };
  }
}

function start(): void {
  let session: GameSession;
  try {
    const { storage, warning } = openStorage();
    session = new GameSession(getContent(), storage);
    if (warning) session.warnings.unshift(warning);
  } catch (err) {
    showFatalError(err instanceof Error ? err.message : String(err));
    return;
  }

  installTouchControls();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1d1a24',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MainMenuScene, SaveSlotsScene, SettingsScene, HubScene, TrainerSelectScene, RunPrepScene, StarterSelectScene, BriefingScene, MapScene, PlazaScene, ShopScene, EventScene, BattleScene, DecisionScene, RewardScene, ExpeditionScene, MinigameScene, GameOverScene, CreditsScene, HallOfFameScene, LegacyGalleryScene, MemoriesScene],
    callbacks: {
      preBoot: (g) => g.registry.set('session', session),
      postBoot: (g) => {
        // Screen readers get a name for the game area (the game itself is drawn on the canvas).
        applyUiSkin(session.settings);
        applyDisplaySettings(g, session.settings);
        setUiMotion(uiMotionFrom(session.settings));
        installPointerFx(g, () => session.settings, () => regionIdentity(session.run ? session.run.regionOrder[session.run.regionIndex] : undefined).sky);
        installGamepad(() => session.settings);
        setTouchLayout(session.settings.oneHanded);
        installShareTools(g, session);
        session.onChange(() => {
          applyUiSkin(session.settings);
          setTouchLayout(session.settings.oneHanded);
          applyDisplaySettings(g, session.settings);
          setUiMotion(uiMotionFrom(session.settings));
        });
        g.canvas.setAttribute('role', 'application');
        g.canvas.setAttribute('aria-label', 'Pocket Raiders, a Pokémon roguelike. Keyboard: arrows, Z/Enter to confirm, X/Esc to go back.');
        // Every screen fades in. Screens without their own scenery get a dimmed,
        // slowly changing battlefield behind them (the battle and map draw their own).
        const ownScenery = new Set(['Boot', 'Battle', 'Map', 'Hub', 'MainMenu', 'TrainerSelect']);
        // Gameplay screens in the Aero look (M10) get the glossy sky-and-bubbles backdrop instead.
        const aeroScenery = new Set(['SaveSlots', 'Reward', 'Shop', 'Event', 'Decision', 'Briefing', 'Expedition', 'Minigame', 'StarterSelect', 'RunPrep', 'GameOver', 'HallOfFame', 'LegacyGallery', 'Memories', 'Credits']);
        for (const scene of g.scene.getScenes(false)) {
          scene.events.on(Phaser.Scenes.Events.CREATE, () => {
            if (scene.scene.key !== 'Boot') {
              enterTransition(scene, session.settings);
              sheenSweep(scene, session.settings.battleAnimations);
              // Wii-style menu motion (spec §24): a soft zoom settle and hover/press bounces on everything clickable.
              if (noteSceneEnter(scene.scene.key) && scene.scene.key !== 'Battle') pageEnter(scene);
              installUiJuice(scene);
            }
            if (aeroScenery.has(scene.scene.key)) {
              // Each region tints the sky its own way (catalog 62).
              const run = session.run;
              aeroBackdrop(scene, session.settings.battleAnimations, regionIdentity(run ? run.regionOrder[run.regionIndex] : undefined).sky);
            }
            else if (!ownScenery.has(scene.scene.key)) {
              drawBackdrop(scene);
              new ArenaBackdrop(scene, { dim: 0.68 });
            }
          });
        }
      },
    },
  });

  // A small hook for automated browser tests and the debug panel.
  (window as unknown as { __pkr: unknown }).__pkr = {
    session,
    game,
    activeScene: () => game.scene.getScenes(true).map((s) => s.scene.key)[0] ?? null,
    /** Plays one rule-mask wipe over the active scene (browser tests and the debug panel). */
    wipe: (mask: WipeMask, ms = 520) => {
      const s = game.scene.getScenes(true)[0];
      return s ? loadAssets(s, [wipeAssetId(mask)]).then(() => ruleWipe(s, mask, ms)) : Promise.resolve();
    },
  };

  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV || params.has('debug')) installDebugPanel(game, session);
}

start();
