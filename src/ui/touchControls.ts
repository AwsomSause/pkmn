// On-screen pad (catalog #125): arrows and Confirm/Back buttons that send the same key events as the keyboard,
// so every screen works by touch. Shown only on touch devices and narrow windows. Presentation only.

import { showRotateHint, showTouchPad, type Viewport } from '../core/presentation/touchLayout';

const BUTTONS: { label: string; code: string; keyCode: number; grid: string }[] = [
  { label: '▲', code: 'ArrowUp', keyCode: 38, grid: '1 / 2' },
  { label: '◀', code: 'ArrowLeft', keyCode: 37, grid: '2 / 1' },
  { label: '▼', code: 'ArrowDown', keyCode: 40, grid: '2 / 2' },
  { label: '▶', code: 'ArrowRight', keyCode: 39, grid: '2 / 3' },
  { label: 'OK', code: 'Enter', keyCode: 13, grid: '1 / 5' },
  { label: 'Back', code: 'Escape', keyCode: 27, grid: '2 / 5' },
];

const viewport = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight, coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false });

function press(code: string, keyCode: number): void {
  for (const type of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(type, { code, key: code, keyCode, which: keyCode, bubbles: true } as KeyboardEventInit));
}

export function installTouchControls(): void {
  if (typeof document === 'undefined' || document.getElementById('touch-pad')) return;
  const style = document.createElement('style');
  style.textContent = `
    #touch-pad{position:fixed;left:0;right:0;bottom:0;display:none;justify-content:space-between;align-items:center;padding:8px 14px;gap:10px;background:rgba(20,16,30,.88);touch-action:manipulation;user-select:none;z-index:5}
    #touch-pad .dpad,#touch-pad .acts{display:grid;gap:6px}
    #touch-pad .dpad{grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,44px)}
    #touch-pad .acts{grid-template-columns:repeat(1,92px);grid-template-rows:repeat(2,44px)}
    #touch-pad button{font:600 18px system-ui,sans-serif;color:#fff;background:linear-gradient(#6fb7ff,#2f7fd8);border:0;border-radius:14px;min-width:44px;min-height:44px}
    #touch-pad button:active{filter:brightness(1.25)}
    #rotate-hint{position:fixed;top:6px;left:50%;transform:translateX(-50%);display:none;background:rgba(20,16,30,.9);color:#fff;font:14px system-ui,sans-serif;padding:6px 12px;border-radius:12px;z-index:5}
    body.touch-pad-on #game{height:calc(100vh - 110px)}`;
  document.head.appendChild(style);
  const pad = document.createElement('div');
  pad.id = 'touch-pad';
  const dpad = document.createElement('div');
  dpad.className = 'dpad';
  const acts = document.createElement('div');
  acts.className = 'acts';
  for (const b of BUTTONS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = b.label;
    el.setAttribute('aria-label', b.label);
    const isAct = b.code === 'Enter' || b.code === 'Escape';
    if (!isAct) el.style.gridArea = b.grid;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press(b.code, b.keyCode);
    });
    (isAct ? acts : dpad).appendChild(el);
  }
  pad.append(dpad, acts);
  const hint = document.createElement('div');
  hint.id = 'rotate-hint';
  hint.textContent = 'Turn your phone sideways for a bigger view';
  document.body.append(pad, hint);
  const update = () => {
    const v = viewport();
    const on = showTouchPad(v);
    pad.style.display = on ? 'flex' : 'none';
    document.body.classList.toggle('touch-pad-on', on);
    hint.style.display = showRotateHint(v) ? 'block' : 'none';
  };
  window.addEventListener('resize', update);
  update();
}
