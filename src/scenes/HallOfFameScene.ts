// The Hall of Fame (Electric plan §5): records, champion teams with their
// epitaphs, unusual wins, rare (shiny) Pokémon and the Legacy Cards of
// Pokémon that earned a title. Opened from the Hub; read-only.

import Phaser from 'phaser';
import { hallOfFame } from '../core/hallOfFame';
import type { RunRecord } from '../core/state';
import { services } from '../game/services';
import { AERO, type MotionLevel } from '../ui/aero';
import { onInputAction } from '../ui/input';
import { preloadPokemon } from '../ui/lazyAssets';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { pokemonIcon } from '../ui/sprites';
import { textStyle } from '../ui/theme';

const GOLD = '#ffe08a';

export class HallOfFameScene extends Phaser.Scene {
  private picker: Picker | null = null;

  constructor() {
    super('HallOfFame');
  }

  preload(): void {
    const { session } = services();
    const ids = new Set(session.profile.runHistory.flatMap((r) => [...r.party.map((m) => m.speciesId), ...r.legacy.map((c) => c.speciesId)]));
    preloadPokemon(this, [...ids].flatMap((id) => session.content.species.get(id) ?? []), { icon: true });
  }

  create(): void {
    const { session } = services();
    const content = session.content;
    const motion: MotionLevel = session.settings.battleAnimations;
    const hof = hallOfFame(session.profile);
    const name = (id: string) => content.species.get(id)?.name ?? id;
    const trainer = (r: RunRecord) => content.archetypes.get(r.archetypeId)?.name ?? r.archetypeId;
    const date = (r: RunRecord) => r.endedAt.slice(0, 10);
    // A little shine on an icon: shinies sparkle, champions bob.
    const icon = (box: Phaser.GameObjects.Container, id: string, x: number, y: number, scale: number, shiny: boolean, order: number) => {
      const species = content.species.get(id);
      if (!species) return;
      const o = pokemonIcon(this, species, x, y, scale) as Phaser.GameObjects.Image;
      box.add(o);
      if (motion === 'full') this.tweens.add({ targets: o, y: y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: order * 110 });
      if (shiny) {
        const star = this.add.text(x + 20, y - 18, '✦', textStyle(16, GOLD, { stroke: '#3a2a00', strokeThickness: 3 })).setOrigin(0.5);
        box.add(star);
        if (motion === 'full') this.tweens.add({ targets: star, alpha: 0.2, scale: 1.4, duration: 600, yoyo: true, repeat: -1 });
      }
    };
    const heading = (box: Phaser.GameObjects.Container, text: string, color = GOLD) => box.add(this.add.text(14, 8, text, textStyle(20, color, { stroke: '#10203a', strokeThickness: 4 })));

    const rows: PickerRow[] = [];
    rows.push({
      problem: null,
      hint: 'Your records across every run.',
      draw: (_scene, box, w) => {
        heading(box, '★ Records');
        hof.records.forEach((rec, i) => {
          const x = 14 + (i % 3) * ((w - 28) / 3);
          const y = 40 + Math.floor(i / 3) * 26;
          box.add(this.add.text(x, y, `${rec.label}: `, textStyle(16, '#cfefff')));
          box.add(this.add.text(x + 190, y, rec.value, textStyle(16, '#ffffff')));
        });
      },
    });
    for (const [n, r] of hof.champions.entries()) {
      const odd = hof.unusual.find((u) => u.run === r);
      rows.push({
        problem: null,
        hint: `${r.epitaph ?? 'No epitaph: nothing stood out on this run.'}${odd ? `  Unusual: ${odd.why}.` : ''}  Seed ${r.seed} · ${r.encounters} encounters · ${r.badges} badges.`,
        draw: (_scene, box, w) => {
          heading(box, `♛ Champion team · ${trainer(r)}`);
          box.add(this.add.text(w - 14, 10, date(r), textStyle(14, '#a8c8e8')).setOrigin(1, 0));
          r.party.slice(0, 6).forEach((m, i) => icon(box, m.speciesId, 40 + i * 52, 64, 1.6, m.shiny, i + n));
          box.add(this.add.text(352, 38, r.epitaph ?? '', textStyle(15, '#ffffff', { wordWrap: { width: w - 370 } })));
          if (odd) box.add(this.add.text(352, 74, `Unusual: ${odd.why}`, textStyle(14, '#ff9fe0', { wordWrap: { width: w - 370 } })));
        },
      });
    }
    if (hof.rareForms.length > 0) {
      rows.push({
        problem: null,
        hint: hof.rareForms.map((f) => `Shiny ${name(f.speciesId)} (Lv${f.level}, ${trainer(f.run)}, ${date(f.run)})`).join(' · '),
        draw: (_scene, box) => {
          heading(box, '✦ Rare forms', '#7ff3ff');
          hof.rareForms.slice(0, 12).forEach((f, i) => icon(box, f.speciesId, 40 + i * 60, 64, 1.6, true, i));
        },
      });
    }
    for (const { run, card, record } of hof.legacyRecords) {
      rows.push({
        problem: null,
        hint: `Legacy Record: ${name(card.speciesId)} finished “${record}” on ${trainer(run)}'s ${run.victory ? 'champion run' : 'run'} of ${date(run)}. This entry is permanent.`,
        draw: (_scene, box, w) => {
          heading(box, `✶ Legacy Record · ${record}`, GOLD);
          icon(box, card.speciesId, 40, 64, 1.8, card.shiny, 0);
          box.add(this.add.text(80, 46, `${name(card.speciesId)}  Lv${card.level}  ·  ${trainer(run)}  ·  ${date(run)}`, textStyle(16, '#ffffff', { wordWrap: { width: w - 100 } })));
        },
      });
    }
    for (const { run, card } of hof.legends) {
      rows.push({
        problem: null,
        hint: `${name(card.speciesId)} · ${trainer(run)} · ${run.victory ? 'champion run' : 'run'} of ${date(run)}${card.signature ? `  ·  “${card.signature}”` : ''}`,
        draw: (_scene, box, w) => {
          icon(box, card.speciesId, 36, 52, 1.8, card.shiny, 0);
          box.add(this.add.text(70, 10, `${name(card.speciesId)}  Lv${card.level}`, textStyle(20)));
          const badges = [...card.titles.map((t) => `“${t}”`), ...card.tags, ...(card.mentor ? [`Carried ${name(card.mentor)}'s legacy`] : [])].join('  ·  ');
          box.add(this.add.text(70, 38, badges, textStyle(15, GOLD, { wordWrap: { width: w - 90 } })));
          if (card.signature) box.add(this.add.text(70, 64, card.signature, textStyle(14, '#cfefff', { wordWrap: { width: w - 90 } })));
        },
      });
    }
    const empty = hof.champions.length === 0 && hof.legends.length === 0;
    this.picker = new Picker(this, {
      glass: true,
      title: empty ? 'Hall of Fame: win a run to see your champions here' : 'Hall of Fame',
      columns: 1,
      rowHeight: 104,
      rows,
      onSelect: () => undefined,
      onBack: () => this.scene.start('Hub', { focus: 3 }),
    });
    // The title band shines once.
    if (motion === 'full') {
      const shine = this.add.rectangle(-80, 40, 60, 60, AERO.white, 0.25).setAngle(20).setBlendMode('ADD').setDepth(2000);
      this.tweens.add({ targets: shine, x: this.scale.width + 80, duration: 900, delay: 200, ease: 'Sine.easeInOut', onComplete: () => shine.destroy() });
    }
    onInputAction(this, (a) => this.picker?.handle(a));
  }
}
