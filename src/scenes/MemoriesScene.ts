// Memories (APPROVED.md §3 and §7): Run Journal, Hall of Memories, Memory Lane, Archive of Fallen Trainers, Battle Replays
// and the Heirlooms a past Ace can pass on. Everything is read from the frozen legacy records; the only thing the player
// changes here is which heirloom option the next run starts with. Opened from the Hub (Events); Esc goes back one level.

import Phaser from 'phaser';
import { fallenTrainers, hallOfMemories, journalEntry, memoryLane } from '../core/memories/journal';
import { keepsakeName } from '../core/memories/keepsakes';
import { pastDigest } from '../core/memories/past';
import type { Heirloom } from '../core/memories/schema';
import { services } from '../game/services';
import { drawGlass } from '../ui/aero';
import { onInputAction } from '../ui/input';
import { preloadPokemon } from '../ui/lazyAssets';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { pokemonIcon } from '../ui/sprites';
import { GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';

const GOLD = '#ffe08a';
const SKY = '#cfefff';

type Section = 'journal' | 'hall' | 'lane' | 'fallen' | 'replays' | 'heirlooms' | 'lost';
const SECTIONS: { id: Section; label: string; blurb: string }[] = [
  { id: 'journal', label: 'Run Journal', blurb: 'A written entry for every finished run: team, Ace, rivals, rescues and milestones.' },
  { id: 'hall', label: 'Hall of Memories', blurb: 'Your most memorable runs, retold as short stories.' },
  { id: 'lane', label: 'Memory Lane', blurb: 'Revisit the moments, battle recaps and story beats of your own past adventures.' },
  { id: 'fallen', label: 'Archive of Fallen Trainers', blurb: 'Trainers whose runs ended in defeat: their party, victories and final opponent.' },
  { id: 'replays', label: 'Battle Replays', blurb: 'Turn-by-turn records of boss, rival, nemesis and ghost fights.' },
  { id: 'heirlooms', label: 'Legacy Heirlooms', blurb: 'Choose what a past Ace passes on to your next run: an egg, a move, a nature or a keepsake.' },
  { id: 'lost', label: 'Lost-and-Found', blurb: 'Items from earlier journeys that may turn up at auctions and recovery stops.' },
];

export class MemoriesScene extends Phaser.Scene {
  private picker: Picker | null = null;
  private reader: Phaser.GameObjects.Container | null = null;
  private back: (() => void) | null = null;

  constructor() {
    super('Memories');
  }

  preload(): void {
    const { session } = services();
    const ids = new Set(session.profile.legacyRuns.flatMap((r) => r.team.map((m) => m.speciesId)));
    preloadPokemon(this, [...ids].flatMap((id) => session.content.species.get(id) ?? []), { icon: true });
  }

  create(): void {
    this.reader = null;
    this.showMenu();
    onInputAction(this, (a) => {
      if (this.reader) {
        if (a === 'back' || a === 'confirm') this.closeReader();
        return;
      }
      this.picker?.handle(a);
    });
  }

  private get content() {
    return services().session.content;
  }

  private get records() {
    return services().session.profile.legacyRuns;
  }

  private name(id: string): string {
    return this.content.species.get(id)?.name ?? id;
  }

  private open(rows: PickerRow[], title: string, onSelect: (i: number) => void, onBack: () => void, start?: number): void {
    this.picker?.close();
    this.back = onBack;
    this.picker = new Picker(this, { glass: true, title, columns: 1, rowHeight: 76, rows, onSelect, onBack, ...(start !== undefined ? { start } : {}) });
  }

  private row(hint: string, title: string, sub: string, icons: string[] = [], tint = '#ffffff'): PickerRow {
    return {
      problem: null,
      hint,
      draw: (_s, box, w) => {
        box.add(this.add.text(14, 8, title, textStyle(18, tint, { stroke: '#10203a', strokeThickness: 4 })));
        box.add(this.add.text(14, 38, sub, textStyle(14, SKY, { wordWrap: { width: w - 28 - icons.length * 46 } })));
        icons.slice(0, 6).forEach((id, i) => {
          const species = this.content.species.get(id);
          if (species) box.add(pokemonIcon(this, species, w - 30 - i * 46, 38, 1.3));
        });
      },
    };
  }

  private showMenu(start?: number): void {
    const rows = SECTIONS.map((s) => this.row(s.blurb, s.label, s.blurb));
    this.open(rows, 'Memories', (i) => this.openSection(SECTIONS[i]!.id, i), () => this.scene.start('Hub', { focus: 3 }), start);
  }

  private openSection(id: Section, menuIndex: number): void {
    const back = () => this.showMenu(menuIndex);
    const empty = (title: string) => this.open([this.row('Nothing here yet.', 'Nothing here yet', 'Finish a run to fill this page.')], title, () => undefined, back);
    const { session } = services();
    switch (id) {
      case 'journal': {
        if (!this.records.length) return empty('Run Journal');
        const rows = this.records.map((r) => {
          const e = journalEntry(this.content, r);
          return this.row(e.lines[0] ?? '', e.title, e.lines[0] ?? '', r.team.map((m) => m.speciesId), r.outcome === 'victory' ? GOLD : '#ffffff');
        });
        this.open(rows, 'Run Journal', (i) => {
          const r = this.records[i]!;
          const e = journalEntry(this.content, r);
          this.read(e.title, [...e.lines, ...(r.journal.length ? ['', 'The road:', ...r.journal] : [])]);
        }, back);
        return;
      }
      case 'hall': {
        const vignettes = hallOfMemories(this.content, this.records);
        if (!vignettes.length) return empty('Hall of Memories');
        this.open(vignettes.map((v) => this.row(`Memorability ${Math.round(v.score)}`, `★ ${v.title}`, v.lines[1] ?? v.lines[0] ?? '', v.speciesId ? [v.speciesId] : [], GOLD)), 'Hall of Memories', (i) => this.read(vignettes[i]!.title, vignettes[i]!.lines), back);
        return;
      }
      case 'lane': {
        const lane = memoryLane(this.content, this.records);
        if (!lane.length) return empty('Memory Lane');
        this.open(lane.map((m) => this.row(m.lines[0] ?? '', m.label, m.lines[0] ?? '', m.speciesId ? [m.speciesId] : [])), 'Memory Lane', (i) => this.read(lane[i]!.label, lane[i]!.lines), back);
        return;
      }
      case 'fallen': {
        const fallen = fallenTrainers(this.content, this.records);
        if (!fallen.length) return empty('Archive of Fallen Trainers');
        this.open(fallen.map((f) => this.row(f.summary, `${f.trainer} · fell in ${f.region}`, `Final opponent: ${f.finalOpponent}`, f.team.map((m) => m.speciesId))), 'Archive of Fallen Trainers', (i) => {
          const f = fallen[i]!;
          this.read(`${f.trainer}, fallen in ${f.region}`, [f.summary, `Party: ${f.team.map((m) => `${this.name(m.speciesId)} Lv ${m.level}`).join(', ')}`, `Notable victories: ${f.victories.join(', ') || 'none recorded'}`, `Final opponent: ${f.finalOpponent}`, 'They may return as a Ghost on a later journey.']);
        }, back);
        return;
      }
      case 'replays': {
        const all = this.records.flatMap((r) => r.replays.map((p) => ({ r, p })));
        if (!all.length) return empty('Battle Replays');
        this.open(all.map(({ r, p }) => this.row(`${p.turns} turns`, `${p.outcome === 'win' ? '✔' : '✘'} ${p.title}`, `${this.content.archetypes.get(r.archetypeId)?.name ?? ''} · ${p.turns} turns · ${p.foe.team.map((s) => this.name(s)).join(', ')}`, p.team, p.outcome === 'win' ? '#ffffff' : '#ff9f9f')), 'Battle Replays', (i) => {
          const { p } = all[i]!;
          this.read(p.title, [`${p.outcome === 'win' ? 'Won' : 'Lost'} in ${p.turns} turns.`, `Your team: ${p.team.map((s) => this.name(s)).join(', ')}`, `Their team: ${p.foe.team.map((s) => this.name(s)).join(', ')}`, '', ...p.lines]);
        }, back);
        return;
      }
      case 'heirlooms': {
        const list = session.profile.memories.heirlooms;
        if (!list.length) return empty('Legacy Heirlooms');
        this.showHeirlooms(list, 0, back);
        return;
      }
      case 'lost': {
        const digest = pastDigest(this.content, session.profile);
        const rows = digest.keepsakes.map((k) => this.row(k.line, keepsakeName(this.content, k.itemId), k.line));
        if (!rows.length) return empty('Lost-and-Found');
        this.open(rows, 'Lost-and-Found', () => undefined, back);
        return;
      }
    }
  }

  private showHeirlooms(list: readonly Heirloom[], start: number, back: () => void): void {
    const rows = list.map((h) => {
      const chosen = h.options.find((o) => o.id === h.chosen);
      const sub = h.spent ? 'Handed over to a run.' : chosen ? `Next run gets: ${chosen.label}. Enter changes the pick.` : 'Not chosen yet. Enter picks an option.';
      return this.row(h.options.map((o) => `${o.label}: ${o.text}`).join('  ·  '), `${h.name} Lv ${h.level} · ${h.trainer}${h.shiny ? ' ✦' : ''}`, sub, [h.speciesId], h.spent ? '#9aa8bd' : GOLD);
    });
    this.open(rows, 'Legacy Heirlooms', (i) => {
      const h = list[i]!;
      if (h.spent) return;
      // Enter cycles to the next option (the first Enter picks the first).
      const at = h.options.findIndex((o) => o.id === h.chosen);
      const next = h.options[(at + 1) % h.options.length]!;
      services().session.pickHeirloom(h.runId, next.id);
      this.showHeirlooms(services().session.profile.memories.heirlooms, i, back);
    }, back, start);
  }

  private read(title: string, lines: readonly string[]): void {
    this.closeReader();
    const root = this.add.container(0, 0).setDepth(3000).setName('memories-reader');
    root.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050a14, 0.92).setOrigin(0).setInteractive().on('pointerdown', () => this.closeReader()));
    root.add(drawGlass(this, 90, 70, GAME_WIDTH - 180, GAME_HEIGHT - 140, { radius: 28 }));
    root.add(this.add.text(GAME_WIDTH / 2, 92, title, textStyle(26, GOLD, { stroke: '#10203a', strokeThickness: 5, align: 'center', wordWrap: { width: GAME_WIDTH - 260 } })).setOrigin(0.5, 0));
    root.add(this.add.text(130, 150, lines.join('\n'), textStyle(16, '#ffffff', { wordWrap: { width: GAME_WIDTH - 260 }, lineSpacing: 6 })).setName('memories-text'));
    root.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 96, 'Enter or Esc to close', textStyle(14, SKY)).setOrigin(0.5));
    this.reader = root;
  }

  private closeReader(): void {
    this.reader?.destroy();
    this.reader = null;
  }
}
