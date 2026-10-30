// Entry point: validates game data, opens the save system and starts Phaser.

import Phaser from 'phaser';
import { getContent } from './data';
import { installDebugPanel } from './debug/debugPanel';
import { GameSession } from './game/GameSession';
import { LocalStorageProvider, MemoryStorageProvider, type StorageProvider } from './save/storage';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { BriefingScene } from './scenes/BriefingScene';
import { DecisionScene } from './scenes/DecisionScene';
import { GameOverScene } from './scenes/GameOverScene';
import { HubScene } from './scenes/HubScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { MapScene } from './scenes/MapScene';
import { RewardScene } from './scenes/RewardScene';
import { RunPrepScene } from './scenes/RunPrepScene';
import { ShopScene } from './scenes/ShopScene';
import { EventScene } from './scenes/EventScene';
import { StarterSelectScene } from './scenes/StarterSelectScene';
import { TrainerSelectScene } from './scenes/TrainerSelectScene';
import { GAME_HEIGHT, GAME_WIDTH } from './ui/theme';
import { drawBackdrop } from './ui/widgets';
import { ArenaBackdrop } from './ui/showcase';
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

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1d1a24',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MainMenuScene, HubScene, TrainerSelectScene, RunPrepScene, StarterSelectScene, BriefingScene, MapScene, ShopScene, EventScene, BattleScene, DecisionScene, RewardScene, GameOverScene],
    callbacks: {
      preBoot: (g) => g.registry.set('session', session),
      postBoot: (g) => {
        // Every screen fades in. Screens without their own scenery get a dimmed,
        // slowly changing battlefield behind them (the battle and map draw their own).
        const ownScenery = new Set(['Boot', 'Battle', 'Map', 'Hub', 'MainMenu', 'TrainerSelect']);
        for (const scene of g.scene.getScenes(false)) {
          scene.events.on(Phaser.Scenes.Events.CREATE, () => {
            if (scene.scene.key !== 'Boot') scene.cameras.main.fadeIn(220, 14, 11, 18);
            if (!ownScenery.has(scene.scene.key)) {
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
  };

  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV || params.has('debug')) installDebugPanel(game, session);
}

start();
