// The Mega-Expedition screen: the route (a few layers of stops, the next ones lit), the party's health, the loot
// held so far, and the choices of the moment (next stop, a recruit, a rest option, or extracting). Rules: core/expedition.

import Phaser from 'phaser';
import { availableNodes, getExpedition, nodeLabel } from '../core/expedition/flow';
import { maxHp } from '../core/pokemon';
import type { ExpeditionState, RunState } from '../core/state';
import { services } from '../game/services';
import { onInputAction } from '../ui/input';
import { playSfx } from '../ui/audio';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { drawPanel, Menu } from '../ui/widgets';
import { sceneForRun } from './routing';

const GLYPH: Record<string, { glyph: string; color: number }> = {
  wild: { glyph: 'W', color: 0x58a858 }, trainer: { glyph: 'T', color: 0xc85858 }, elite: { glyph: 'E', color: 0xa040c0 }, rest: { glyph: '+', color: 0xe06890 },
  cache: { glyph: '$', color: 0xd0a030 }, research: { glyph: '?', color: 0x4890d0 }, mystery: { glyph: '!', color: 0x9070c0 }, recruit: { glyph: 'R', color: 0x30b0a0 },
  megaEnergy: { glyph: 'M', color: 0xf0c020 }, totem: { glyph: 'O', color: 0xe8a020 }, raid: { glyph: 'X', color: 0xd04040 }, finale: { glyph: '★', color: 0xf08020 },
};

export class ExpeditionScene extends Phaser.Scene {
  private menu!: Menu;

  constructor() {
    super('Expedition');
  }

  create(): void {
    const { session } = services();
    let run = session.run!;
    if (run.expedition?.battleResult) run = session.settleExpedition();
    if (run.phase !== 'expedition' || !run.expedition) {
      // The expedition ended (finished, extracted or failed): back to the map with the result.
      this.scene.start(sceneForRun(run), { notice: run.expeditions.last.join(' '), focus: 0 });
      return;
    }
    const exp = run.expedition;
    const def = getExpedition(session.content, exp.id);
    this.add.text(GAME_WIDTH / 2, 22, `${def.name}  ·  Tier ${def.tier}`, textStyle(32, COLORS.textLight)).setOrigin(0.5);
    drawPanel(this, 16, 48, GAME_WIDTH - 32, 200, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true });
    this.drawRoute(exp);
    this.add.text(24, 256, this.partyLine(run), textStyle(15, COLORS.textLight, { wordWrap: { width: GAME_WIDTH - 48 } }));
    const loot = exp.loot;
    const items = Object.entries(loot.items).map(([id, n]) => `${n} ${id.replace(/-/g, ' ')}`);
    this.add.text(24, 282, `Loot: ₽${loot.money}${items.length ? `, ${items.join(', ')}` : ''}  ·  Mega Energy ${loot.energy}/${def.megaCost}  ·  Research ${loot.research}/${def.researchGoal}`, textStyle(15, '#f0e0a0', { wordWrap: { width: GAME_WIDTH - 48 } }));
    this.add.text(24, 306, exp.log.slice(-2).join('  ·  '), textStyle(14, '#a8d0a8', { wordWrap: { width: GAME_WIDTH - 48 } }));

    const options: { label: string; detail?: string; act: () => void }[] = [];
    if (exp.choice) {
      this.add.text(GAME_WIDTH / 2, 338, exp.choice.title, textStyle(20, '#ffd0a0')).setOrigin(0.5);
      exp.choice.options.forEach((o, i) => options.push({ label: o.label, detail: o.detail, act: () => session.resolveExpeditionChoice(i) }));
    } else {
      this.add.text(GAME_WIDTH / 2, 338, 'Choose your next stop', textStyle(20, '#ffd0a0')).setOrigin(0.5);
      for (const n of availableNodes(exp)) options.push({ label: nodeLabel(n.kind), detail: `stop ${n.layer + 1}`, act: () => session.chooseExpeditionNode(n.id) });
      options.push({ label: 'Extract now', detail: 'keep the loot, skip the finale', act: () => session.extractExpedition() });
    }
    this.menu = new Menu(this, {
      x: 40, y: 366, columns: 2, itemWidth: 440, itemHeight: 46, fontSize: 20, color: COLORS.textLight,
      options: options.map((o) => ({ label: o.label, detail: o.detail })),
      onSelect: (i) => {
        playSfx(this, 'ui.select');
        try {
          options[i]!.act();
        } catch (err) {
          this.add.text(GAME_WIDTH / 2, 320, String(err instanceof Error ? err.message : err), textStyle(16, '#ff8080')).setOrigin(0.5);
          return;
        }
        this.scene.start(sceneForRun(session.run!), { notice: '', focus: 0 });
      },
    });
    this.add.text(16, GAME_HEIGHT - 22, '←/→/↑/↓ choose  ·  Enter select', textStyle(14, '#8a7f96'));
    onInputAction(this, (a) => this.menu.handle(a));
  }

  private partyLine(run: RunState): string {
    const { content } = services().session;
    return run.party.map((m) => `${content.species.get(m.speciesId)?.name ?? m.speciesId} Lv${m.level} ${m.hp}/${maxHp(content, m)}`).join('  ·  ');
  }

  /** Layers left to right; stops you can take now are bright, finished ones dim. */
  private drawRoute(exp: ExpeditionState): void {
    const layers = Math.max(...exp.nodes.map((n) => n.layer)) + 1;
    const pos = new Map<string, { x: number; y: number }>();
    for (let l = 0; l < layers; l++) {
      const col = exp.nodes.filter((n) => n.layer === l);
      col.forEach((n, i) => pos.set(n.id, { x: 70 + (l * (GAME_WIDTH - 140)) / Math.max(1, layers - 1), y: 148 + (i - (col.length - 1) / 2) * 80 }));
    }
    const g = this.add.graphics();
    const lit = new Set(exp.status === 'route' ? availableNodes(exp).map((n) => n.id) : []);
    for (const n of exp.nodes) {
      const a = pos.get(n.id)!;
      for (const nx of n.next) {
        const b = pos.get(nx)!;
        g.lineStyle(3, n.done || exp.current === n.id ? 0xf0e0a0 : 0x6a6080, 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    for (const n of exp.nodes) {
      const p = pos.get(n.id)!;
      const style = GLYPH[n.kind] ?? { glyph: '·', color: 0x888888 };
      const bright = lit.has(n.id) || n.id === exp.node;
      g.fillStyle(style.color, n.done ? 0.35 : bright ? 1 : 0.7);
      g.fillCircle(p.x, p.y, 20);
      g.lineStyle(bright ? 4 : 2, bright ? 0xffffff : 0x202020, 1);
      g.strokeCircle(p.x, p.y, 20);
      this.add.text(p.x, p.y, n.done ? '✓' : style.glyph, textStyle(20, '#ffffff')).setOrigin(0.5);
    }
    this.add.text(70, 60, 'Start', textStyle(12, '#c8c0d8')).setOrigin(0.5);
  }
}
