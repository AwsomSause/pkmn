// The Legacy Gallery (M18, §1.4): every past Trainer kept as a legacy run. Pick one to see its whole team, its Ace,
// what it achieved, its rivals, its final battle and ending and its story moments, or Relive the Moment: the run's
// key moments shown one after another. Opened from the Hub (Events); read-only.

import Phaser from 'phaser';
import { accomplishments, legacyAce, legacyScore, LEGACY_RUNS } from '../core/legacyRuns';
import type { LegacyRun } from '../core/state';
import { services } from '../game/services';
import { AERO, drawGlass, type MotionLevel } from '../ui/aero';
import { onInputAction } from '../ui/input';
import { preloadPokemon } from '../ui/lazyAssets';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { fitHeight } from '../ui/showcase';
import { pokemonIcon, pokemonVisual, trainerVisual } from '../ui/sprites';
import { GAME_HEIGHT, GAME_WIDTH, PIXEL_SCALE, textStyle } from '../ui/theme';

const GOLD = '#ffe08a';
const SKY = '#cfefff';
const MOMENT_LABEL: Record<LegacyRun['moments'][number]['kind'], string> = {
  firstGym: 'First Gym victory', firstLegendary: 'First Legendary encounter', rivalDefeat: 'Rival defeated', rivalLoss: 'Rival loss',
  championVictory: 'Champion victory', finalStanding: 'The last one standing', lastSecond: 'Last-second survival', runEnding: 'The final battle',
};

export class LegacyGalleryScene extends Phaser.Scene {
  private picker: Picker | null = null;
  private relive: { root: Phaser.GameObjects.Container; moments: LegacyRun['moments']; index: number; record: LegacyRun } | null = null;
  private motion: MotionLevel = 'full';

  constructor() {
    super('LegacyGallery');
  }

  preload(): void {
    const { session } = services();
    const ids = new Set(session.profile.legacyRuns.flatMap((r) => [...r.team.map((m) => m.speciesId), ...r.moments.flatMap((m) => (m.speciesId ? [m.speciesId] : []))]));
    preloadPokemon(this, [...ids].flatMap((id) => session.content.species.get(id) ?? []), { icon: true });
  }

  create(): void {
    this.motion = services().session.settings.battleAnimations;
    this.relive = null;
    this.showList();
    onInputAction(this, (a) => {
      if (this.relive) {
        if (a === 'back') this.closeRelive();
        else if (a === 'confirm' || a === 'right' || a === 'down') this.nextMoment();
        return;
      }
      this.picker?.handle(a);
    });
  }

  private get content() {
    return services().session.content;
  }

  private name(id: string): string {
    return this.content.species.get(id)?.name ?? id;
  }

  private trainer(r: LegacyRun): string {
    return this.content.archetypes.get(r.archetypeId)?.name ?? r.archetypeId;
  }

  private region(r: LegacyRun): string {
    const id = r.regionOrder[Math.min(r.regionReached, r.regionOrder.length - 1)];
    return id ? this.content.regions.get(id)?.name ?? id : 'Unknown region';
  }

  private icon(box: Phaser.GameObjects.Container, id: string, x: number, y: number, scale: number, shiny: boolean): void {
    const species = this.content.species.get(id);
    if (!species) return;
    box.add(pokemonIcon(this, species, x, y, scale));
    if (shiny) box.add(this.add.text(x + 18, y - 18, '✦', textStyle(14, GOLD, { stroke: '#3a2a00', strokeThickness: 3 })).setOrigin(0.5));
  }

  private open(rows: PickerRow[], title: string, onSelect: (i: number) => void, onBack: () => void, start = 0): void {
    this.picker?.close();
    this.picker = new Picker(this, { glass: true, title, columns: 1, rowHeight: 96, rows, onSelect, onBack, start });
  }

  /** Every legacy run, newest first. */
  private showList(start = 0): void {
    const records = services().session.profile.legacyRuns;
    const rows: PickerRow[] = records.map((r) => {
      const score = legacyScore(this.content, r);
      const memorable = score >= LEGACY_RUNS.rotation.memorableScore;
      const ace = legacyAce(r);
      return {
        problem: null,
        hint: `${r.epitaph ?? accomplishments(this.content, r).join(' · ')}  ·  Legacy Score ${score}${r.source === 'history' ? '  ·  An older run: fewer details were kept.' : ''}`,
        draw: (_scene, box, w) => {
          const archetype = this.content.archetypes.get(r.archetypeId);
          const sprite = trainerVisual(this, archetype?.spriteAssetId ?? '', this.trainer(r), 44, 90, 1);
          if (sprite instanceof Phaser.GameObjects.Sprite) sprite.setOrigin(0.5, 1);
          fitHeight(this, sprite, 84);
          box.add(sprite);
          box.add(this.add.text(90, 8, `${memorable ? '★ ' : ''}${this.trainer(r)}  ·  ${r.outcome === 'victory' ? 'Champion' : 'Fell'} in ${this.region(r)}`, textStyle(19, memorable ? GOLD : '#ffffff')));
          box.add(this.add.text(w - 14, 10, r.endedAt.slice(0, 10), textStyle(14, '#a8c8e8')).setOrigin(1, 0));
          r.team.slice(0, 6).forEach((m, i) => this.icon(box, m.speciesId, 112 + i * 50, 60, 1.4, m.shiny));
          if (ace) box.add(this.add.text(420, 42, `Ace: ${this.name(ace.speciesId)} Lv ${ace.level}`, textStyle(15, SKY)));
          box.add(this.add.text(420, 64, accomplishments(this.content, r).join('  ·  '), textStyle(14, '#ffffff', { wordWrap: { width: w - 440 } })));
        },
      };
    });
    this.open(rows, records.length ? 'Legacy Gallery' : 'Legacy Gallery: finish a run to see its Trainer here', (i) => this.showRecord(i), () => this.scene.start('Hub', { focus: 3 }), start);
  }

  /** One past Trainer, row by row; the first row is Relive the Moment. */
  private showRecord(index: number): void {
    const r = services().session.profile.legacyRuns[index];
    if (!r) return;
    const ace = legacyAce(r);
    const heading = (box: Phaser.GameObjects.Container, text: string, color = GOLD) => box.add(this.add.text(14, 8, text, textStyle(18, color, { stroke: '#10203a', strokeThickness: 4 })));
    const body = (box: Phaser.GameObjects.Container, text: string, w: number, x = 14) => box.add(this.add.text(x, 36, text, textStyle(15, '#ffffff', { wordWrap: { width: w - x - 14 } })));
    const rows: PickerRow[] = [
      {
        problem: r.moments.length ? null : 'No moments were kept for this run.',
        hint: `Relive the Moment: ${r.moments.length} moment${r.moments.length === 1 ? '' : 's'} from this run (Enter, then Enter for the next, Esc to stop).`,
        draw: (_s, box, w) => {
          heading(box, '▶ Relive the Moment', '#7ff3ff');
          body(box, r.moments.map((m) => MOMENT_LABEL[m.kind]).join('  ·  ') || 'Nothing to relive.', w);
        },
      },
      {
        problem: null,
        hint: r.team.map((m) => `${this.name(m.speciesId)} Lv ${m.level}${m.moves.length ? ` (${m.moves.map((id) => this.content.moves.get(id)?.name ?? id).join(', ')})` : ''}`).join(' · '),
        draw: (_s, box, w) => {
          heading(box, `Team · Ace ${ace ? `${this.name(ace.speciesId)} Lv ${ace.level}` : 'unknown'}`);
          r.team.forEach((m, i) => {
            this.icon(box, m.speciesId, 40 + i * 64, 62, 1.6, m.shiny);
            if (m.uid === r.aceUid) box.add(this.add.text(40 + i * 64, 86, 'ACE', textStyle(12, GOLD)).setOrigin(0.5, 0));
          });
          if (ace?.titles.length) box.add(this.add.text(440, 40, ace.titles.map((t) => `“${t}”`).join('  '), textStyle(14, GOLD, { wordWrap: { width: w - 460 } })));
        },
      },
      {
        problem: null,
        hint: `Seed ${r.seed} · ${r.encounters} encounters · ${r.battlesWon} battles won · Legacy Score ${legacyScore(this.content, r)}`,
        draw: (_s, box, w) => {
          heading(box, 'Accomplishments');
          const b = r.bosses;
          body(box, [...accomplishments(this.content, r), `${b.gym} Gym Leaders, ${b.elite} Elite Four, ${b.champion} Champions`, r.legendaries.seen.length ? `Legendaries met: ${r.legendaries.seen.map((id) => this.name(id)).join(', ')}` : ''].filter(Boolean).join('  ·  '), w);
        },
      },
      {
        problem: null,
        hint: r.rivals.map((v) => `${v.name}: ${v.encounters} battles, last ${v.lastResult === 'win' ? 'won' : v.lastResult === 'lose' ? 'lost' : 'not fought'}${v.rank ? `, became ${v.rank}` : ''}`).join(' · ') || 'No rivals this run.',
        draw: (_s, box, w) => {
          heading(box, `Rival encounters (${r.rivals.length})`);
          body(box, r.rivals.map((v) => `${v.name} (${v.state}, ${v.encounters}×, ${v.lastResult === 'win' ? 'you won last' : v.lastResult === 'lose' ? 'they won last' : '—'})`).join('  ·  ') || 'No rivals this run.', w);
          r.rivals.slice(0, 1).forEach((v) => v.team[0] && this.icon(box, v.team[0], w - 40, 60, 1.6, false));
        },
      },
      {
        problem: null,
        hint: r.epitaph ?? 'No epitaph: nothing stood out.',
        draw: (_s, box, w) => {
          heading(box, 'Final battle and ending');
          const f = r.finalBattle;
          const fight = !f ? 'Not recorded.' : f.result === 'win' ? `Won${f.trainer ? ` against ${f.trainer}` : ''}.` : `Lost to ${f.trainer ? `${f.trainer}'s ` : 'a wild '}${f.speciesId ? this.name(f.speciesId) : 'Pokémon'}${f.level ? ` (Lv ${f.level})` : ''}.`;
          body(box, `${fight}  ${r.outcome === 'victory' ? 'The journey ended as Champion.' : `The journey ended in ${this.region(r)}.`}${r.epitaph ? `  “${r.epitaph}”` : ''}`, w);
          if (f?.speciesId) this.icon(box, f.speciesId, w - 40, 60, 1.6, false);
        },
      },
      {
        problem: null,
        hint: r.chronicle.map((c) => c.text).join(' · ') || 'No story moments were kept.',
        draw: (_s, box, w) => {
          heading(box, 'Story moments');
          const nem = r.nemeses.map((n) => `Nemesis ${this.name(n.speciesId)}${n.settledAs ? ` (${n.settledAs})` : ''}`);
          body(box, [...r.chronicle.slice(0, 3).map((c) => c.text), ...nem].join('  ·  ') || 'No story moments were kept.', w);
        },
      },
    ];
    this.open(rows, `${this.trainer(r)} · ${r.endedAt.slice(0, 10)}`, (i) => i === 0 && this.startRelive(r), () => this.showList(index));
  }

  private startRelive(record: LegacyRun): void {
    if (!record.moments.length) return;
    const root = this.add.container(0, 0).setDepth(3000).setName('legacy-relive');
    root.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050a14, 0.92).setOrigin(0).setInteractive().on('pointerdown', () => this.nextMoment()));
    this.relive = { root, moments: record.moments, index: -1, record };
    this.nextMoment();
  }

  private nextMoment(): void {
    const rl = this.relive;
    if (!rl) return;
    rl.index += 1;
    if (rl.index >= rl.moments.length) return this.closeRelive();
    const m = rl.moments[rl.index]!;
    const card = this.add.container(0, 0).setName('legacy-moment');
    card.add(drawGlass(this, 120, 110, GAME_WIDTH - 240, GAME_HEIGHT - 220, { radius: 28 }));
    card.add(this.add.text(GAME_WIDTH / 2, 140, MOMENT_LABEL[m.kind], textStyle(28, GOLD, { stroke: '#10203a', strokeThickness: 5 })).setOrigin(0.5, 0));
    const species = m.speciesId ? this.content.species.get(m.speciesId) : undefined;
    if (species) card.add(fitHeight(this, pokemonVisual(this, species, 'front', GAME_WIDTH / 2, 326, PIXEL_SCALE - 1), 140));
    card.add(this.add.text(GAME_WIDTH / 2, species ? 334 : 250, m.text, textStyle(20, '#ffffff', { align: 'center', wordWrap: { width: GAME_WIDTH - 320 } })).setOrigin(0.5, 0));
    card.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 128, `${rl.index + 1} / ${rl.moments.length}  ·  Enter next  ·  Esc stop`, textStyle(14, SKY)).setOrigin(0.5));
    const old = rl.root.list.find((o) => o.name === 'legacy-moment');
    old?.destroy();
    rl.root.add(card);
    if (this.motion !== 'off') {
      card.setAlpha(0);
      this.tweens.add({ targets: card, alpha: 1, duration: this.motion === 'full' ? 600 : 250, ease: 'Sine.easeOut' });
      if (this.motion === 'full') {
        const shine = this.add.rectangle(-80, GAME_HEIGHT / 2, 80, GAME_HEIGHT, AERO.white, 0.18).setAngle(12).setBlendMode('ADD');
        card.add(shine);
        this.tweens.add({ targets: shine, x: GAME_WIDTH + 80, duration: 1100, ease: 'Sine.easeInOut', onComplete: () => shine.destroy() });
      }
    }
  }

  private closeRelive(): void {
    this.relive?.root.destroy();
    this.relive = null;
  }
}
