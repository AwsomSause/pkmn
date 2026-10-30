// Weather in the arena: rain streaks, hail, a drifting sandstorm, blizzard snow
// and a sunny glow (Visual Bible §4.3). Art is the Weather folder of the
// Pokémon Essentials 21.1 UIE pack; sun is drawn from shapes.
//
// Presentation only and driven by the battle's weather events. Fixed layouts
// (no random numbers). Full motion animates, reduced motion shows a still
// layer, "off" shows nothing.

import type Phaser from 'phaser';
import type { Weather } from '../../core/contentSchema';
import type { MotionLevel } from '../aero';

export const WEATHER_ASSET_IDS = [
  'fx.weather.rain1', 'fx.weather.rain2', 'fx.weather.rain3',
  'fx.weather.hail1', 'fx.weather.hail2', 'fx.weather.hail3',
  'fx.weather.snow1', 'fx.weather.snow2', 'fx.weather.snow3', 'fx.weather.snow4',
  'fx.weather.sandTile', 'fx.weather.snowTile',
] as const;

type Obj = Phaser.GameObjects.GameObject;

export class WeatherLayer {
  private objs: Obj[] = [];
  private current: Weather | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly field: Phaser.GameObjects.Container,
    private readonly motion: MotionLevel,
  ) {}

  /** Shows this weather (null clears it). Calling it with the weather already shown does nothing. */
  set(weather: Weather | null): void {
    if (weather === this.current) return;
    this.current = weather;
    this.objs.forEach((o) => { this.scene.tweens.killTweensOf(o); o.destroy(); });
    this.objs = [];
    if (!weather || this.motion === 'off') return;
    const W = this.scene.scale.width;
    const H = this.scene.scale.height;
    const moving = this.motion === 'full';
    const put = <T extends Obj>(o: T): T => { o.setName('weather'); this.field.add(o); this.objs.push(o); return o; };
    const has = (k: string) => this.scene.textures.exists(k);
    const falling = (keys: string[], count: number, fall: number, drift: number, alpha: number, scale: number) => {
      const usable = keys.filter(has);
      if (usable.length === 0) return;
      for (let i = 0; i < count; i++) {
        const x = (i * 97 + 23) % (W + 120) - 60;
        const y0 = ((i * 53) % H);
        const s = put(this.scene.add.image(x, y0, usable[i % usable.length]!).setAlpha(alpha).setScale(scale * (0.8 + (i % 3) * 0.2)));
        if (moving) {
          this.scene.tweens.add({ targets: s, y: H + 40, x: x + drift, duration: fall + (i % 5) * 90, delay: (i % 7) * 120, repeat: -1,
            onRepeat: () => { s.y = -40; s.x = x; } });
        }
      }
    };
    const scrolling = (key: string, alpha: number, dx: number, dy: number, tint?: number) => {
      if (!has(key)) return;
      const t = put(this.scene.add.tileSprite(0, 0, W, H, key).setOrigin(0).setAlpha(alpha));
      if (tint !== undefined) t.setTint(tint);
      if (moving) this.scene.tweens.addCounter({ from: 0, to: 1, duration: 6000, repeat: -1, onUpdate: (c) => { const v = c.getValue() ?? 0; t.tilePositionX = dx * v; t.tilePositionY = dy * v; } });
    };
    switch (weather) {
      case 'rain':
        put(this.scene.add.rectangle(0, 0, W, H, 0x203050, 0.16).setOrigin(0));
        falling(['fx.weather.rain1', 'fx.weather.rain2', 'fx.weather.rain3'], 34, 520, -40, 0.5, 1);
        break;
      case 'hail':
        put(this.scene.add.rectangle(0, 0, W, H, 0x90a8c8, 0.14).setOrigin(0));
        falling(['fx.weather.hail1', 'fx.weather.hail2', 'fx.weather.hail3'], 40, 900, -60, 0.85, 1.2);
        break;
      case 'snow':
        put(this.scene.add.rectangle(0, 0, W, H, 0xe8f0ff, 0.12).setOrigin(0));
        scrolling('fx.weather.snowTile', 0.35, -300, 160);
        falling(['fx.weather.snow1', 'fx.weather.snow2', 'fx.weather.snow3', 'fx.weather.snow4'], 36, 3200, -90, 0.8, 1.4);
        break;
      case 'sand':
        put(this.scene.add.rectangle(0, 0, W, H, 0xb08848, 0.2).setOrigin(0));
        scrolling('fx.weather.sandTile', 0.5, -900, 60);
        break;
      case 'sun': {
        const glow = put(this.scene.add.rectangle(0, 0, W, H, 0xffd070, 0.1).setOrigin(0));
        const g = put(this.scene.add.graphics());
        g.fillStyle(0xfff0b0, 0.1);
        for (let i = 0; i < 5; i++) g.fillTriangle(120 + i * 190, -10, 120 + i * 190 + 60, -10, 20 + i * 190 + 260, H * 0.7);
        if (moving) this.scene.tweens.add({ targets: [glow, g], alpha: { from: 0.7, to: 1 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
    }
  }
}
