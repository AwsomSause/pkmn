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
import { StarterSelectScene } from './scenes/StarterSelectScene';
import { TrainerSelectScene } from './scenes/TrainerSelectScene';
import { GAME_HEIGHT, GAME_WIDTH } from './ui/theme';
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
    backgroundColor: '#101828',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MainMenuScene, HubScene, TrainerSelectScene, RunPrepScene, StarterSelectScene, BriefingScene, MapScene, ShopScene, BattleScene, DecisionScene, RewardScene, GameOverScene],
    callbacks: {
      preBoot: (g) => g.registry.set('session', session),
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
