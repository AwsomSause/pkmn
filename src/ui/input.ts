// Keyboard controls shared by every screen.
//   Arrows / WASD : move        Enter / Space / Z : confirm        Esc / X / Backspace : back

import type Phaser from 'phaser';

export type InputAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

const KEY_MAP: Record<string, InputAction> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm', KeyZ: 'confirm',
  Escape: 'back', KeyX: 'back', Backspace: 'back',
};

/** Calls `handler` with a game action for each key press while the scene is running. */
export function onInputAction(scene: Phaser.Scene, handler: (action: InputAction) => void): void {
  const keyboard = scene.input.keyboard;
  if (!keyboard) return;
  const listener = (event: KeyboardEvent) => {
    // Let the debug panel's text boxes receive typing.
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    const action = KEY_MAP[event.code];
    if (action) handler(action);
  };
  keyboard.on('keydown', listener);
  scene.events.once('shutdown', () => keyboard.off('keydown', listener));
}
