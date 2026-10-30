// The Pokémon summary (Visual Bible V4 "party/detail: tabs, moves with
// type/category, memories"): two glass pages per Pokémon side by side. Left
// and right flip between "Info & stats" and "Moves & story"; up and down go
// to the next Pokémon. Type and category labels are Essentials art, the
// gender marks and stat arrows Enhanced Battle UI's. Read-only.

import type Phaser from 'phaser';
import type { PokemonInstance, RunState } from '../core/state';
import type { Content } from '../core/contentSchema';
import { genderSign } from '../core/gender';
import { getSpecies } from '../core/pokemon';
import { services } from '../game/services';
import { AERO, categoryIcon, typeLabel, type MotionLevel } from './aero';
import { Picker, type PickerRow } from './partyPanel';
import { itemVisual, pokemonIcon } from './sprites';
import { BASE_STAT_SCALE, summaryInfo } from './summaryLook';
import { textStyle } from './theme';
import type { FieldMenuHost } from './fieldMenus';

const ROW_H = 366;
const STAT_COLORS: Record<string, number> = { hp: 0x6ee87a, atk: 0xf0a040, def: 0xf0d050, spa: 0x60b0ff, spd: 0x80e0d0, spe: 0xf070b0 };

function header(scene: Phaser.Scene, box: Phaser.GameObjects.Container, x: number, y: number, text: string): void {
  box.add(scene.add.text(x, y, text, textStyle(15, '#bfe9ff')));
}

function infoPage(content: Content, run: RunState | null, mon: PokemonInstance, motion: MotionLevel, order: number): PickerRow {
  const info = summaryInfo(content, run, mon);
  return {
    problem: null,
    hint: info.ability ? `${info.ability.name}: ${info.ability.text}` : 'Its types, ability, held items and stats.',
    draw: (scene, box, w) => {
      const icon = pokemonIcon(scene, getSpecies(content, mon.speciesId), 46, 46, 2.2);
      box.add(icon);
      if (motion === 'full') scene.tweens.add({ targets: icon, y: 40, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: order * 150 });
      const name = scene.add.text(96, 10, `${info.name}${mon.shiny ? ' ★' : ''}`, textStyle(26));
      box.add(name);
      const sign = genderSign(content, mon);
      const genderFrame = sign === '♂' ? 0 : sign === '♀' ? 1 : -1;
      if (genderFrame >= 0 && scene.textures.exists('pack.ebui.gender')) box.add(scene.add.image(96 + name.width + 16, 25, 'pack.ebui.gender', genderFrame).setScale(1.2));
      box.add(scene.add.text(w - 14, 12, `Lv${info.level}`, textStyle(22)).setOrigin(1, 0));
      info.types.forEach((t, i) => {
        const label = typeLabel(scene, 96 + i * 112, 60, t, 1.5);
        if (label) box.add(label);
        else box.add(scene.add.text(96 + i * 112, 60, t.toUpperCase(), textStyle(16)).setOrigin(0, 0.5));
      });
      header(scene, box, 14, 90, 'Ability');
      box.add(scene.add.text(90, 88, `${info.ability?.name ?? '—'}${info.nature ? `  ·  ${info.nature}` : ''}`, textStyle(18)));
      header(scene, box, 14, 116, 'Holding');
      if (info.held.length === 0) box.add(scene.add.text(90, 114, 'Nothing', textStyle(18, '#9fb4c8')));
      let hx = 90;
      for (const h of info.held.slice(0, 3)) {
        if (h.icon) box.add(itemVisual(scene, h.icon, hx + 10, 124, 1));
        const t = scene.add.text(hx + (h.icon ? 24 : 0), 114, `${h.name}${h.count > 1 ? ` ×${h.count}` : ''}`, textStyle(15));
        box.add(t);
        hx += t.width + (h.icon ? 34 : 12);
        if (hx > w - 60) break;
      }
      header(scene, box, 14, 146, 'Stats (bar = base stat)');
      info.stats.forEach((s, i) => {
        const y = 182 + i * 30;
        box.add(scene.add.text(14, y, s.label, textStyle(17)).setOrigin(0, 0.5));
        box.add(scene.add.text(156, y, String(s.value), textStyle(17)).setOrigin(1, 0.5));
        if (s.boosted && scene.textures.exists('pack.ebui.statArrows')) box.add(scene.add.image(170, y, 'pack.ebui.statArrows', 0).setScale(1));
        const bx = 188;
        const bw = w - bx - 52;
        const bg = scene.add.graphics();
        bg.fillStyle(0x061528, 0.85).fillRoundedRect(bx, y - 7, bw, 14, 7);
        bg.lineStyle(1, AERO.rim, 0.5).strokeRoundedRect(bx, y - 7, bw, 14, 7);
        box.add(bg);
        const fw = Math.max(8, Math.min(1, s.base / BASE_STAT_SCALE) * bw);
        const fill = scene.add.graphics({ x: bx, y });
        fill.fillStyle(STAT_COLORS[s.key] ?? 0xffffff, 1).fillRoundedRect(0, -7, fw, 14, 7);
        fill.fillStyle(0xffffff, 0.45).fillRoundedRect(3, -6, Math.max(2, fw - 6), 4, 2);
        box.add(fill);
        box.add(scene.add.text(w - 14, y, String(s.base), textStyle(15, '#bfe9ff')).setOrigin(1, 0.5));
        if (motion === 'off') return;
        fill.setScale(0, 1);
        scene.tweens.add({ targets: fill, scaleX: 1, duration: motion === 'full' ? 600 : 200, delay: motion === 'full' ? i * 50 : 0, ease: motion === 'full' ? 'Back.easeOut' : 'Quad.easeOut' });
      });
    },
  };
}

function movesPage(content: Content, run: RunState | null, mon: PokemonInstance): PickerRow {
  const info = summaryInfo(content, run, mon);
  return {
    problem: null,
    hint: info.moves.map((m) => m.text).join('  '),
    draw: (scene, box, w) => {
      header(scene, box, 14, 8, 'Moves');
      info.moves.forEach((m, i) => {
        const y = 32 + i * 50;
        const label = typeLabel(scene, 14, y + 14, m.type, 1.2);
        if (label) box.add(label);
        const cat = categoryIcon(scene, 104, y + 14, m.category, 1.2);
        if (cat) box.add(cat);
        box.add(scene.add.text(178, y + 2, m.name, textStyle(20, '#ffffff', { fixedWidth: w - 270 })));
        box.add(scene.add.text(w - 14, y + 4, `PP ${m.pp}`, textStyle(15, '#bfe9ff')).setOrigin(1, 0));
        box.add(scene.add.text(178, y + 26, `Power ${m.power} · Accuracy ${m.accuracy}`, textStyle(13, '#d0e4f4')));
      });
      header(scene, box, 14, 236, 'This run');
      const lines = [info.record, info.titles.length ? `Titles: ${info.titles.join(', ')}` : null, ...info.memories.map((t) => `• ${t}`)].filter((t): t is string => Boolean(t));
      if (lines.length === 0) lines.push('No story yet: it will remember its battles here.');
      box.add(scene.add.text(14, 258, lines.join('\n'), textStyle(13, '#e8f6ff', { wordWrap: { width: w - 28 }, lineSpacing: 2, maxLines: 7 })));
    },
  };
}

/** Opens the summary on `start` (a party index). */
export function openSummaryMenu(host: FieldMenuHost, start = 0): void {
  const { session } = services();
  const run = session.run!;
  const motion = session.settings.battleAnimations;
  const rows = run.party.flatMap((mon, i) => [infoPage(session.content, run, mon, motion, i), movesPage(session.content, run, mon)]);
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: 'Summary: Left/Right page, Up/Down Pokémon',
    columns: 2,
    rowHeight: ROW_H,
    rows,
    onSelect: () => undefined,
    onBack: () => {
      picker.close();
      host.setPicker(null);
    },
  });
  for (let i = 0; i < start; i++) picker.handle('down');
  host.setPicker(picker);
}
