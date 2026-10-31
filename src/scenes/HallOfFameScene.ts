// The Hall of Fame (Electric plan §5): records, champion teams with their
// epitaphs, unusual wins, rare (shiny) Pokémon and the Legacy Cards of
// Pokémon that earned a title. Opened from the Hub; read-only.

import Phaser from 'phaser';
import { hallOfFame } from '../core/hallOfFame';
import { rivalHallOfFame } from '../core/legacyRuns';
import type { RunRecord } from '../core/state';
import { services } from '../game/services';
import { AERO, type MotionLevel } from '../ui/aero';
import { onInputAction } from '../ui/input';
import { preloadPokemon } from '../ui/lazyAssets';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { pokemonIcon } from '../ui/sprites';
import { textStyle } from '../ui/theme';
import { sceneForRun } from './routing';
import { activeReplay, genesisFor, genesisNote } from '../core/timeline/genesis';

const GOLD = '#ffe08a';

export class HallOfFameScene extends Phaser.Scene {
  private picker: Picker | null = null;

  constructor() {
    super('HallOfFame');
  }

  preload(): void {
    const { session } = services();
    const ids = new Set([...session.profile.runHistory.flatMap((r) => [...r.party.map((m) => m.speciesId), ...r.legacy.map((c) => c.speciesId)]), ...session.profile.legacyRuns.flatMap((r) => r.rivals.flatMap((v) => v.team.slice(0, 1)))]);
    preloadPokemon(this, [...ids].flatMap((id) => session.content.species.get(id) ?? []), { icon: true });
  }

  create(data: { confirmAbandon?: boolean } = {}): void {
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
    // Revisit This Timeline (M13): lost runs whose start was recorded can be rebuilt; the original record never changes.
    const actions = new Map<number, () => void>();
    const store = session.timeline;
    const live = activeReplay(store);
    let abandonRow: number | undefined;
    if (live) {
      const origin = session.profile.runHistory.find((r) => r.runId === live.originRunId);
      const label = origin ? `${trainer(origin)} · ${date(origin)}` : 'a lost run';
      if (session.canContinueReplay) {
        actions.set(rows.length, () => {
          const run = session.continueReplay();
          this.scene.start(sceneForRun(run));
        });
        rows.push({ problem: null, hint: `Pick up the timeline of ${label} where you left it.`, draw: (_s, box) => heading(box, `↺ Continue revisited timeline · ${label}`, '#9fd8ff') });
      }
      abandonRow = rows.length;
      actions.set(rows.length, () => {
        if (!data.confirmAbandon) return this.scene.restart({ confirmAbandon: true });
        session.abandonReplay();
        this.scene.restart({});
      });
      rows.push({
        problem: null,
        hint: data.confirmAbandon ? 'Press again to abandon. The replay ends; the original run and your profile stay exactly as they are.' : 'Walk away from this timeline. The original run is never changed.',
        draw: (_s, box) => heading(box, data.confirmAbandon ? '✕ Press again to abandon this timeline' : `✕ Abandon revisited timeline · ${label}`, '#ff9f9f'),
      });
    }
    for (const r of session.profile.runHistory) {
      if (r.victory || !genesisFor(store, r.runId)) continue;
      const tries = store.replays.filter((x) => x.originRunId === r.runId).length;
      const note = genesisNote(genesisFor(store, r.runId)!);
      actions.set(rows.length, () => {
        session.startReplay(r.runId);
        this.scene.start('StarterSelect');
      });
      rows.push({
        problem: session.replayProblem(r.runId),
        hint: `Revisit This Timeline: same seed, regions, starters and encounters as the run you lost. Revisited ${tries} time${tries === 1 ? '' : 's'}.${note ? ` ${note}` : ''}`,
        draw: (_s, box, w) => {
          heading(box, `↺ Revisit This Timeline · ${trainer(r)}`, '#9fd8ff');
          box.add(this.add.text(w - 14, 10, date(r), textStyle(14, '#a8c8e8')).setOrigin(1, 0));
          r.party.slice(0, 6).forEach((m, i) => icon(box, m.speciesId, 40 + i * 52, 64, 1.6, m.shiny, i));
          const end = r.defeatedBy ? `Lost to ${r.defeatedBy.trainer ?? name(r.defeatedBy.speciesId)}` : 'Run ended';
          box.add(this.add.text(352, 38, `${end} · ${r.badges} badges · ${r.encounters} encounters`, textStyle(15, '#ffffff', { wordWrap: { width: w - 370 } })));
        },
      });
    }
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
    // The Rival Hall of Fame (§8.1): rivals who finished their journeys, and the deepest rivalries, beside your champions.
    const rivals = rivalHallOfFame(session.profile.legacyRuns);
    const TITLE = { champion: '♛ Champion', finalist: 'Finalist', gymLeader: 'Gym Leader' } as const;
    for (const [i, rv] of rivals.entries()) {
      const region = rv.regionId ? content.regions.get(rv.regionId)?.name ?? rv.regionId : 'an unknown region';
      rows.push({
        problem: null,
        hint: `${rv.name} · ${rv.title ? `${TITLE[rv.title]} of ${region}` : `rival in ${region}`} · met ${rv.encounters}× · fame ${rv.fame}, ${rv.badges} badges${rv.narrativeWins ? ` · beat you in a story battle ${rv.narrativeWins}×` : ''} · ${rv.relationship}${rv.resolution ? ` (${rv.resolution} ending)` : ''} · ${rv.defeatedByYou ? 'you beat them' : 'you never beat them'} · ${rv.endedAt.slice(0, 10)}`,
        draw: (_scene, box, w) => {
          heading(box, `⚔ Rival Hall of Fame · ${rv.name}${rv.title ? ` · ${TITLE[rv.title]}` : ''}`, '#ff9fb8');
          if (rv.signature) icon(box, rv.signature, 40, 64, 1.8, false, i);
          box.add(this.add.text(80, 46, `${rv.signature ? `${name(rv.signature)}  ·  ` : ''}${region}  ·  met ${rv.encounters}×  ·  ${rv.relationship}  ·  ${rv.defeatedByYou ? 'You beat them' : 'Undefeated by you'}`, textStyle(16, '#ffffff', { wordWrap: { width: w - 100 } })));
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
      onSelect: (i) => actions.get(i)?.(),
      ...(data.confirmAbandon && abandonRow !== undefined ? { start: abandonRow } : {}),
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
