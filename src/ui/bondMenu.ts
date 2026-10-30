// The Bond screen: how each party Pokémon feels about you (the Bond Engine in
// core/bond). One glass card per Pokémon: its trait, a mood bubble, and a glossy
// bar for each bond value that fills in with a little overshoot. Read-only;
// nothing here changes the run.

import type Phaser from 'phaser';
import { bondMood, bondOf } from '../core/bond';
import { partyRoles } from '../core/partyRoles';
import { BOND_BARS, MOOD_LOOK, bondHint } from './bondLook';
import type { PokemonInstance, RunState } from '../core/state';
import type { Content } from '../core/contentSchema';
import { services } from '../game/services';
import { AERO, type MotionLevel } from './aero';
import { Picker, type PickerRow } from './partyPanel';
import { pokemonIcon } from './sprites';
import { textStyle } from './theme';
import type { FieldMenuHost } from './fieldMenus';

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function bondRow(content: Content, run: RunState, mon: PokemonInstance, motion: MotionLevel, order: number): PickerRow {
  const species = content.species.get(mon.speciesId)!;
  const bond = bondOf(run, mon.uid);
  const mood = MOOD_LOOK[bondMood(bond)];
  return {
    problem: null,
    hint: bondHint(content, run, mon),
    draw: (scene, box, w) => {
      const icon = pokemonIcon(scene, species, 32, 34, 1.4);
      box.add(icon);
      box.add(scene.add.text(64, 10, species.name, textStyle(22)));
      box.add(scene.add.text(64, 36, `${cap(bond.trait)} · Lv${mon.level} · ${partyRoles(content, mon).join(' / ')}`, textStyle(15, '#bfe9ff')));
      // Mood bubble: a glossy pill that floats.
      const pill = scene.add.container(w - 62, 22);
      const g = scene.add.graphics();
      g.fillStyle(mood.color, 0.9).fillRoundedRect(-48, -13, 96, 26, 13);
      g.fillStyle(0xffffff, 0.35).fillRoundedRect(-44, -11, 88, 10, 5);
      g.lineStyle(2, AERO.white, 0.8).strokeRoundedRect(-48, -13, 96, 26, 13);
      pill.add([g, scene.add.text(0, 0, mood.text, textStyle(16, '#ffffff', { stroke: '#0b2a4a', strokeThickness: 3 })).setOrigin(0.5)]);
      box.add(pill);
      if (motion === 'full') {
        scene.tweens.add({ targets: pill, y: 18, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: order * 180 });
        scene.tweens.add({ targets: icon, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: order * 120 });
      }
      // Bars: two columns, filling in with a bounce.
      const colW = (w - 40) / 2;
      BOND_BARS.forEach((bar, i) => {
        const col = i < 4 ? 0 : 1;
        const rowY = 66 + (i < 4 ? i : i - 4) * 19;
        const x = 14 + col * (colW + 12);
        const labelW = 92;
        const bw = colW - labelW - 34;
        box.add(scene.add.text(x, rowY, bar.label, textStyle(14, '#e8f6ff')).setOrigin(0, 0.5));
        const bg = scene.add.graphics();
        bg.fillStyle(0x061528, 0.85).fillRoundedRect(x + labelW, rowY - 6, bw, 12, 6);
        bg.lineStyle(1, AERO.rim, 0.5).strokeRoundedRect(x + labelW, rowY - 6, bw, 12, 6);
        box.add(bg);
        const fill = scene.add.graphics({ x: x + labelW, y: rowY });
        const value = bond[bar.key];
        const fw = value > 0 ? Math.max(6, (bw * value) / 100) : 0;
        if (fw > 0) {
          fill.fillStyle(bar.color, 1).fillRoundedRect(0, -6, fw, 12, 6);
          fill.fillStyle(0xffffff, 0.45).fillRoundedRect(2, -5, Math.max(2, fw - 4), 4, 2);
        }
        box.add(fill);
        box.add(scene.add.text(x + labelW + bw + 6, rowY, String(value), textStyle(13, '#ffffff')).setOrigin(0, 0.5));
        if (motion === 'off') return;
        fill.setScale(0, 1);
        scene.tweens.add({ targets: fill, scaleX: 1, duration: motion === 'full' ? 650 : 200, delay: motion === 'full' ? order * 90 + i * 45 : 0, ease: motion === 'full' ? 'Back.easeOut' : 'Quad.easeOut' });
      });
    },
  };
}

export function openBondMenu(host: FieldMenuHost): void {
  const { session } = services();
  const run = session.run!;
  const motion = session.settings.battleAnimations;
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: 'Bonds: how your Pokémon feel about you',
    columns: 2,
    rowHeight: 148,
    rows: run.party.map((mon, i) => bondRow(session.content, run, mon, motion, i)),
    onSelect: () => undefined,
    onBack: () => {
      picker.close();
      host.setPicker(null);
    },
  });
  host.setPicker(picker);
}
