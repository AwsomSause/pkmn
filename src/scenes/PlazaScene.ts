// The Trainer Plaza (spec §18): a lively square with six districts, a wandering crowd, Pokémon that follow trainers and
// background chatter, drawn as a Pokemon-Memories tile map in the style the player picked (Plaza styles, Kice
// 2026-11-02: Aero Bubbles, Regional Looks, Diorama Island, Social Square; ui/plaza). Pure presentation over core/plaza;
// every choice still goes through session.usePlaza, so nothing here changes the rules. Animations follow the Animations
// setting (Full / Reduced / Off).

import Phaser from 'phaser';
import { plazaLayout, PLAZA_LIFE, type DistrictView, type PlazaLayout, type Wanderer } from '../core/plaza/layout';
import type { PlazaSectionId } from '../core/plaza/flow';
import { currentRegion } from '../core/regions';
import { PLAZA_OW_SHEETS, plazaSeason, plazaSheetId, plazaStyleOf, type PlazaStyleId } from '../core/presentation/plazaStyles';
import { services } from '../game/services';
import { playMusicLazy, playSfx } from '../ui/audio';
import { AERO, drawGlass, type MotionLevel } from '../ui/aero';
import { onInputAction } from '../ui/input';
import { loadAssets } from '../ui/lazyAssets';
import { Picker } from '../ui/partyPanel';
import { buildStyle, type StyleFrame } from '../ui/plaza/styles';
import { buildWorld, MAP_KEY, type PlazaWorld } from '../ui/plaza/world';
import { setAmbience, stopAmbience } from '../ui/procAudio';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { sceneForRun } from './routing';

export class PlazaScene extends Phaser.Scene {
  private sideId = '';
  private layout!: PlazaLayout;
  private menu: Picker | null = null;
  private focus = 0;
  private busy = false;
  /** False until the map and walk sheets are loaded and the style is drawn (tests wait for it). */
  ready = false;
  style: PlazaStyleId = 'aero';
  private world: PlazaWorld | null = null;
  private frame: StyleFrame | null = null;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('Plaza');
  }

  private get picker(): Picker | null {
    return this.menu;
  }

  /** Every menu goes through here, so the style's chrome hides while one is open. */
  private set picker(p: Picker | null) {
    this.menu = p;
    for (const o of this.frame?.hud ?? []) (o as Phaser.GameObjects.Text).setVisible(p === null);
    if (p) {
      this.bubble?.destroy();
      this.bubble = null;
    }
  }

  private get motion(): MotionLevel {
    return services().session.settings.battleAnimations;
  }

  create(data: { sideId?: string; notice?: string; focus?: number } = {}): void {
    const { session } = services();
    const run = session.run!;
    this.sideId = data.sideId ?? this.sideId;
    this.layout = plazaLayout(session.content, run, this.sideId);
    this.focus = data.focus ?? 0;
    this.menu = null;
    this.frame = null;
    this.world = null;
    this.ready = false;
    this.busy = false;
    this.bubble = null;
    this.bubbleTimer = null;
    this.style = plazaStyleOf(session.settings.plazaStyle);
    playMusicLazy(this, 'bgm.shop');
    if (this.motion !== 'off') setAmbience(this, 'crowd');
    this.events.once('shutdown', () => stopAmbience());
    this.cameras.main.setBackgroundColor(0x78c070);
    const loading = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Walking into the plaza…', textStyle(18)).setOrigin(0.5);
    void loadAssets(this, [MAP_KEY, ...PLAZA_OW_SHEETS.map(plazaSheetId)]).then(() => {
      if (!this.sys.isActive() || this.layout === undefined) return;
      loading.destroy();
      this.build(data.notice);
    });
    onInputAction(this, (action) => {
      if (this.picker) return this.picker.handle(action);
      if (this.busy || !this.ready) return;
      if (action === 'left') this.moveFocus(-1);
      else if (action === 'right') this.moveFocus(1);
      else if (action === 'confirm') this.openDistrict(this.layout.districts[this.focus]!);
      else if (action === 'back') this.leave();
    });
  }

  private build(notice?: string): void {
    const { session } = services();
    const run = session.run!;
    const lead = run.party.find((m) => m.hp > 0) ?? run.party[0];
    this.world = buildWorld(this, {
      layout: this.layout,
      sideId: this.sideId,
      motion: this.motion,
      focus: this.focus,
      lead: lead ? session.content.species.get(lead.speciesId) : undefined,
      species: (id) => session.content.species.get(id),
      onTalk: (w, node) => this.talk(w, node),
    });
    const region = currentRegion(session.content, run);
    this.frame = buildStyle(this.style, {
      scene: this,
      world: this.world,
      layout: this.layout,
      motion: this.motion,
      season: plazaSeason(run.stage?.index ?? 0, region.id),
      head: () => `${this.layout.view.repTitle} (${run.plaza.rep})  ·  ₽${run.money}`,
      blurb: (d) => (d.locked && d.id === 'secret' ? (this.layout.view.alleyHint ?? PLAZA_LIFE.bubbles.secretClosed) : d.locked ? 'Closed right now.' : d.blurb),
      onFocus: (i) => {
        if (this.picker || this.busy || i === this.focus) return;
        this.focus = i;
        this.refreshFocus(false);
      },
      onPick: (i) => {
        if (this.picker || this.busy) return;
        this.focus = i;
        this.refreshFocus(false);
        this.openDistrict(this.layout.districts[i]!);
      },
    });
    this.refreshFocus(true);
    this.chatLoop();
    this.ready = true;
    const me = this.world.player;
    if (notice) this.say(notice, GAME_WIDTH / 2, 150, 4200);
    else {
      const at = this.world.toScreen(me.x, me.y);
      this.say(PLAZA_LIFE.bubbles.player[(this.focus + run.plaza.visits) % PLAZA_LIFE.bubbles.player.length]!, at.x, at.y - 80, 2600);
    }
  }

  // ---------- life ----------

  private talk(w: Wanderer, node: Phaser.GameObjects.Container): void {
    if (this.picker || this.busy || !this.world) return;
    const at = this.world.toScreen(node.x, node.y);
    this.say(w.line, at.x, at.y - 80, 4000);
    if (w.kind === 'rare') this.time.delayedCall(1400, () => !this.picker && !this.busy && this.openDistrict(this.layout.districts.find((d) => d.id === 'gathering')!));
  }

  private chatLoop(): void {
    if (this.motion === 'off' || this.layout.chats.length === 0) return;
    let i = 0;
    this.time.addEvent({
      delay: 5200, loop: true,
      callback: () => {
        const chat = this.layout.chats[i % this.layout.chats.length]!;
        const a = this.world?.people.get(chat.a);
        const b = this.world?.people.get(chat.b);
        if (a && b && !this.picker && this.world) {
          const pa = this.world.toScreen(a.x, a.y);
          this.say(chat.lines[0], pa.x, pa.y - 80, 2200, false);
          this.time.delayedCall(2300, () => {
            if (this.picker || !b.active || !this.world) return;
            const pb = this.world.toScreen(b.x, b.y);
            this.say(chat.lines[1], pb.x, pb.y - 80, 2200, false);
          });
        }
        i++;
      },
    });
  }

  // ---------- interaction ----------

  private moveFocus(delta: number): void {
    const n = this.layout.districts.length;
    this.focus = (this.focus + delta + n) % n;
    playSfx(this, 'ui.move');
    this.refreshFocus(false);
  }

  private refreshFocus(instant: boolean): void {
    const d = this.layout.districts[this.focus]!;
    this.frame?.focus(this.focus, instant);
    this.world?.walkTo(d, instant);
  }

  private say(text: string, x: number, y: number, ms: number, sound = true): void {
    this.bubble?.destroy();
    this.bubbleTimer?.remove(false);
    const w = Math.min(360, 60 + text.length * 6.4);
    const t = this.add.text(0, 0, text, textStyle(13, '#ffffff', { wordWrap: { width: w } })).setOrigin(0.5);
    const bw = t.width + 24;
    const bh = t.height + 16;
    const bx = Phaser.Math.Clamp(x, bw / 2 + 12, GAME_WIDTH - bw / 2 - 12);
    const by = Math.max(bh / 2 + 70, y);
    const box = drawGlass(this, -bw / 2, -bh / 2, bw, bh, { tint: AERO.glass, rim: AERO.rim, glow: false, radius: 12 });
    this.bubble = this.add.container(bx, by, [box, t]).setDepth(1100);
    if (this.motion !== 'off') this.tweens.add({ targets: this.bubble, scale: { from: 0.7, to: 1 }, duration: 180, ease: 'Back.easeOut' });
    if (sound) playSfx(this, 'ui.move', 0.4);
    this.bubbleTimer = this.time.delayedCall(ms, () => {
      this.bubble?.destroy();
      this.bubble = null;
    });
  }

  private leave(notice?: string): void {
    this.busy = true;
    this.picker?.close();
    this.picker = null;
    this.scene.start('Map', { notice: notice ?? 'You leave the plaza.', focus: 0 });
  }

  /** Opens a district: its only section straight away, or a short list of its sections. */
  private openDistrict(d: DistrictView, notice?: string): void {
    if (d.locked) {
      playSfx(this, 'ui.error', 0.5);
      this.say(d.id === 'secret' ? (this.layout.view.alleyHint ?? PLAZA_LIFE.bubbles.secretClosed) : 'Closed right now.', GAME_WIDTH / 2, 150, 2600);
      return;
    }
    playSfx(this, 'ui.select');
    if (d.sections.length === 1) return this.openSection(d, d.sections[0]!.id, notice);
    const picker: Picker = new Picker(this, {
      depth: 2000,
      glass: true,
      title: `${d.name}  ·  ₽${services().session.run!.money}`,
      columns: 1,
      rowHeight: 64,
      rows: d.sections.map((s) => ({
        problem: s.count === 0 ? 'Nothing here right now.' : null,
        hint: s.title,
        draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
          box.add(scene.add.text(16, 8, `${s.title}   (${s.count})`, textStyle(22)));
          box.add(scene.add.text(16, 36, this.sectionBlurb(s.id), textStyle(15, '#d8d0e0', { wordWrap: { width: w - 32 } })));
        },
      })),
      onSelect: (i) => {
        picker.close();
        this.picker = null;
        this.openSection(d, d.sections[i]!.id);
      },
      onBack: () => this.closeMenu(),
    });
    this.picker = picker;
  }

  private sectionBlurb(id: PlazaSectionId): string {
    return this.layout.view.sections.find((s) => s.id === id)?.blurb ?? '';
  }

  private closeMenu(notice?: string): void {
    this.picker?.close();
    this.picker = null;
    this.scene.restart({ focus: this.focus, notice });
  }

  private openSection(d: DistrictView, section: PlazaSectionId, notice?: string): void {
    const { session } = services();
    const view = session.plazaSection(this.sideId, section);
    const notes = [...(notice ? [`» ${notice}`] : []), ...view.notes];
    const rows = view.options;
    const picker: Picker = new Picker(this, {
      depth: 2000,
      glass: true,
      title: `${d.name}  ·  ₽${session.run!.money}`,
      columns: 1,
      rowHeight: 78,
      rows: [
        ...notes.map((note) => ({ problem: note, draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => box.add(scene.add.text(16, 6, note, textStyle(15, '#f0e0a0', { wordWrap: { width: w - 32 } }))) })),
        ...rows.map((row) => ({
          problem: row.problem,
          hint: row.text,
          draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
            box.add(scene.add.text(16, 6, `${row.title}${row.cost > 0 ? `   ₽${row.cost}` : ''}`, textStyle(20, '#ffffff', { wordWrap: { width: w - 32 } })));
            box.add(scene.add.text(16, 34, row.text, textStyle(14, '#d8d0e0', { wordWrap: { width: w - 32 } })));
          },
        })),
      ],
      onSelect: (i) => {
        const row = rows[i - notes.length]!;
        picker.close();
        this.picker = null;
        playSfx(this, 'ui.select');
        let result;
        try {
          result = session.usePlaza(this.sideId, section, row.id);
        } catch (err) {
          playSfx(this, 'ui.error', 0.5);
          return this.openSection(d, section, String(err instanceof Error ? err.message : err));
        }
        if (result.battle || session.run!.phase !== 'map') {
          this.busy = true;
          this.scene.start(sceneForRun(session.run!));
          return;
        }
        this.frame?.refreshHead();
        this.openSection(d, section, result.message);
      },
      onBack: () => this.closeMenu(),
    });
    this.picker = picker;
  }
}
