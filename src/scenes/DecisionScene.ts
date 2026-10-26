// Choices the run waits on between battles, one at a time:
//   - a Pokémon wants to learn a move but already knows four
//   - a Pokémon was caught: add it, replace a party member, or release it
// Replacing, releasing and forgetting can't be undone, so each asks to confirm.

import Phaser from 'phaser';
import { candiesForRelease } from '../core/encounters';
import type { Content } from '../core/contentSchema';
import { calcStats, getSpecies, MAX_PP_UPS, maxPp } from '../core/pokemon';
import type { DecisionChoice } from '../core/run';
import type { MoveSlot, PokemonInstance } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { onInputAction, type InputAction } from '../ui/input';
import { partyRows, Picker } from '../ui/partyPanel';
import { fitHeight } from '../ui/showcase';
import { pokemonVisual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TYPE_COLORS, textStyle } from '../ui/theme';
import { drawPanel, Menu } from '../ui/widgets';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon } from '../ui/lazyAssets';

function describeMove(content: Content, id: string): string {
  const m = content.moves.get(id)!;
  const power = m.power ?? (m.effects.fixedDamage ? 'Lv' : '—');
  return `${m.type.toUpperCase()} · ${m.category} · Pow ${power} · Acc ${m.accuracy ?? '—'} · PP ${m.pp}`;
}

export class DecisionScene extends Phaser.Scene {
  private menu: Menu | null = null;
  private picker: Picker | null = null;
  private confirmMenu: Menu | null = null;
  private confirmLayer: Phaser.GameObjects.Container | null = null;
  private done = false;

  constructor() {
    super('Decision');
  }

  preload(): void {
    const { session } = services();
    const caught = (session.run?.pending ?? []).flatMap((d) => (d.kind === 'caught' ? (session.content.species.get(d.mon.speciesId) ?? []) : []));
    preloadPokemon(this, [...partySpecies(), ...caught], { front: true, shiny: true, icon: true });
  }

  create(): void {
    const { session } = services();
    const run = session.run!;
    const decision = run.pending[0]!;
    this.menu = null;
    this.picker = null;
    this.confirmMenu = null;
    this.confirmLayer = null;
    this.done = false;
    playMusic(this, 'bgm.menu');

    onInputAction(this, (a) => this.handleInput(a));
    if (decision.kind === 'learnMove') this.buildLearnMove(decision.uid, decision.moveId);
    else if (decision.kind === 'caught') this.buildCaught(decision.mon);
    else if (decision.kind === 'teachMove') this.buildTeachMove(decision.uid, decision.itemName, decision.moveIds);
    else this.buildPpUp(decision.uid, decision.itemName, decision.ups);
  }

  private handleInput(action: InputAction): void {
    if (this.done) return;
    if (this.confirmMenu) this.confirmMenu.handle(action);
    else if (this.picker) this.picker.handle(action);
    else this.menu?.handle(action);
  }

  private resolve(choice: DecisionChoice): void {
    if (this.done) return;
    this.done = true;
    const result = services().session.resolveDecision(choice);
    this.closeConfirm();
    this.picker?.close();
    this.picker = null;
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75).setOrigin(0).setDepth(150);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, result.message, textStyle(30, COLORS.textLight, { align: 'center', wordWrap: { width: GAME_WIDTH - 120 } }))
      .setOrigin(0.5)
      .setDepth(151);
    this.time.delayedCall(1300, () => this.scene.start(sceneForRun(result.run)));
  }

  /** A Yes/No box over the screen. */
  private confirm(text: string, onYes: () => void): void {
    const layer = this.add.container(0, 0).setDepth(120);
    layer.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive());
    layer.add(drawPanel(this, 160, 170, GAME_WIDTH - 320, 200));
    layer.add(this.add.text(GAME_WIDTH / 2, 190, text, textStyle(26, COLORS.text, { align: 'center', wordWrap: { width: GAME_WIDTH - 380 } })).setOrigin(0.5, 0));
    this.confirmLayer = layer;
    this.confirmMenu = new Menu(this, {
      x: GAME_WIDTH / 2 - 140,
      y: 310,
      options: [{ label: 'Yes' }, { label: 'No' }],
      columns: 2,
      itemWidth: 160,
      fontSize: 30,
      onSelect: (i) => (i === 0 ? onYes() : this.closeConfirm()),
      onBack: () => this.closeConfirm(),
    });
    this.confirmMenu.container.setDepth(121);
    // Default to "No" for choices that can't be undone.
    this.confirmMenu.focus(1, false);
  }

  private closeConfirm(): void {
    this.confirmMenu?.destroy();
    this.confirmMenu = null;
    this.confirmLayer?.destroy();
    this.confirmLayer = null;
  }

  // ---------- learning a move ----------

  private buildLearnMove(uid: string, moveId: string): void {
    const { session } = services();
    const content = session.content;
    const mon = session.run!.party.find((p) => p.uid === uid);
    const newMove = content.moves.get(moveId)!;
    if (!mon) {
      this.resolve({ kind: 'skipMove' });
      return;
    }
    const name = getSpecies(content, mon.speciesId).name;
    pokemonVisual(this, getSpecies(content, mon.speciesId), 'front', 150, 260, 3, mon.shiny);
    this.add.text(300, 40, `${name} wants to learn ${newMove.name}!`, textStyle(34, COLORS.textLight));
    this.add.text(300, 86, 'But it already knows four moves. Forget one to make room?', textStyle(22, '#d8d0e0'));
    const describe = (id: string, pp?: number, slot?: MoveSlot) => {
      const m = content.moves.get(id)!;
      const power = m.power ?? (m.effects.fixedDamage ? 'Lv' : '—');
      return `${m.type.toUpperCase()} · ${m.category} · Pow ${power} · Acc ${m.accuracy ?? '—'} · PP ${pp ?? m.pp}/${slot ? maxPp(content, slot) : m.pp}`;
    };
    drawPanel(this, 300, 124, 620, 70, { fill: COLORS.panelDark, border: TYPE_COLORS[newMove.type] ?? 0x808080 });
    this.add.text(320, 132, `NEW: ${newMove.name}`, textStyle(24, COLORS.textLight));
    this.add.text(320, 162, describe(moveId), textStyle(18, '#d8d0e0'));

    const options = [
      ...mon.moves.map((slot) => ({ label: content.moves.get(slot.id)!.name, detail: describe(slot.id, slot.pp, slot) })),
      { label: `Don't learn ${newMove.name}` },
    ];
    drawPanel(this, 300, 210, 620, 310);
    this.menu = new Menu(this, {
      x: 316,
      y: 222,
      options,
      itemHeight: 58,
      itemWidth: 600,
      fontSize: 24,
      onSelect: (i) => {
        if (i >= mon.moves.length) {
          this.confirm(`Give up on learning ${newMove.name}?`, () => this.resolve({ kind: 'skipMove' }));
          return;
        }
        const old = content.moves.get(mon.moves[i]!.id)!;
        this.confirm(`${name} will forget ${old.name} and learn ${newMove.name}. OK?`, () => this.resolve({ kind: 'forgetMove', moveIndex: i }));
      },
    });
  }

  // ---------- a TM or HM from the reward draft ----------

  private buildTeachMove(uid: string, itemName: string, moveIds: string[]): void {
    const { session } = services();
    const content = session.content;
    const mon = session.run!.party.find((p) => p.uid === uid);
    if (!mon) {
      this.resolve({ kind: 'skipMove' });
      return;
    }
    const species = getSpecies(content, mon.speciesId);
    pokemonVisual(this, species, 'front', 150, 260, 3, mon.shiny);
    this.add.text(300, 40, `The ${itemName}: which move should ${species.name} learn?`, textStyle(30, COLORS.textLight, { wordWrap: { width: 640 } }));
    this.add.text(300, 120, mon.moves.length < 4 ? '' : 'It knows four moves, so it will forget one.', textStyle(20, '#d8d0e0'));
    // An HM can offer many moves: two columns of names then (up to 15 moves).
    const wide = moveIds.length > 7;
    const shown = moveIds.slice(0, wide ? 15 : 7);
    drawPanel(this, 300, 150, 620, 380);
    this.menu = new Menu(this, {
      x: 316,
      y: 160,
      options: [
        ...shown.map((id) => ({ label: content.moves.get(id)!.name, detail: wide ? undefined : describeMove(content, id) })),
        { label: "Don't teach a move" },
      ],
      columns: wide ? 2 : 1,
      itemHeight: 46,
      itemWidth: wide ? 300 : 600,
      fontSize: 22,
      onSelect: (i) => {
        if (i >= shown.length) this.confirm(`Throw away the ${itemName}?`, () => this.resolve({ kind: 'skipMove' }));
        else this.resolve({ kind: 'teachMove', moveIndex: i });
      },
    });
  }

  // ---------- a PP Up or PP Max ----------

  private buildPpUp(uid: string, itemName: string, ups: number): void {
    const { session } = services();
    const content = session.content;
    const mon = session.run!.party.find((p) => p.uid === uid)!;
    const species = getSpecies(content, mon.speciesId);
    pokemonVisual(this, species, 'front', 150, 260, 3, mon.shiny);
    this.add.text(300, 40, `Use the ${itemName} on which of ${species.name}'s moves?`, textStyle(30, COLORS.textLight, { wordWrap: { width: 640 } }));
    this.add.text(300, 120, `Each PP Up adds a fifth of the move's PP (at most ${MAX_PP_UPS}).${ups > 1 ? ` This counts as ${ups}.` : ''}`, textStyle(20, '#d8d0e0'));
    drawPanel(this, 300, 160, 620, 280);
    this.menu = new Menu(this, {
      x: 316,
      y: 172,
      options: mon.moves.map((slot) => ({
        label: content.moves.get(slot.id)!.name,
        detail: `PP ${slot.pp}/${maxPp(content, slot)} · PP Ups ${slot.ppUps ?? 0}/${MAX_PP_UPS}`,
        disabled: (slot.ppUps ?? 0) >= MAX_PP_UPS,
      })),
      itemHeight: 58,
      itemWidth: 600,
      fontSize: 24,
      onSelect: (i) => this.resolve({ kind: 'ppUpMove', moveIndex: i }),
    });
  }

  // ---------- a caught Pokémon ----------

  private buildCaught(caught: PokemonInstance): void {
    const { session } = services();
    const content = session.content;
    const run = session.run!;
    const species = getSpecies(content, caught.speciesId);
    const candies = candiesForRelease(content, caught.level);
    const full = run.party.length >= content.balance.partyMax;

    // A soft spotlight for the new Pokémon to stand on.
    const spot = this.add.graphics();
    spot.fillStyle(0x0e0b12, 0.55).fillEllipse(200, 300, 240, 44);
    spot.fillStyle(0x4a3f5c, 0.9).fillEllipse(200, 298, 200, 32);
    fitHeight(this, pokemonVisual(this, species, 'front', 200, 300, 3.5, caught.shiny), 240);
    this.add.text(400, 40, `You caught ${species.name}!`, textStyle(40, COLORS.textLight));
    const stats = calcStats(content, caught);
    const lines = [
      `${species.name}${caught.shiny ? '  ★ Shiny' : ''}   Lv${caught.level}`,
      `Type: ${species.types.map((t) => t.toUpperCase()).join(' / ')}`,
      `HP ${caught.hp}/${stats.hp}   Atk ${stats.atk}  Def ${stats.def}  Spe ${stats.spe}`,
      `Moves: ${caught.moves.map((m) => content.moves.get(m.id)!.name).join(', ')}`,
    ];
    this.add.text(400, 100, lines.join('\n'), textStyle(22, '#d8d0e0', { lineSpacing: 6, wordWrap: { width: 520 } }));
    this.add.text(400, 250, full ? `Your party is full (${content.balance.partyMax}).` : `Party: ${run.party.length}/${content.balance.partyMax}`, textStyle(22, full ? '#f0c028' : '#a0e0a0'));

    const candyText = `${candies} cand${candies === 1 ? 'y' : 'ies'}`;
    const options = full
      ? [{ label: 'Replace a party Pokémon' }, { label: `Release it (+${candyText})` }]
      : [{ label: 'Add to party' }, { label: `Release it (+${candyText})` }];
    drawPanel(this, 400, 300, 520, 140);
    this.menu = new Menu(this, {
      x: 420,
      y: 320,
      options,
      itemWidth: 480,
      itemHeight: 52,
      fontSize: 28,
      onSelect: (i) => {
        if (i === 0 && !full) this.resolve({ kind: 'addToParty' });
        else if (i === 0) this.openReplace(caught);
        else
          this.confirm(`Release ${species.name}? You'll get ${candyText}. This can't be undone.`, () => {
            playSfx(this, 'se.ball_release');
            this.resolve({ kind: 'release' });
          });
      },
    });
    this.add.text(GAME_WIDTH / 2, 500, 'Candies are kept after the run ends.', textStyle(18, '#a69cb4')).setOrigin(0.5);
  }

  private openReplace(caught: PokemonInstance): void {
    const { session } = services();
    const content = session.content;
    const run = session.run!;
    const newName = getSpecies(content, caught.speciesId).name;
    this.picker = new Picker(this, {
      title: `Which Pokémon leaves to make room for ${newName}?`,
      columns: 2,
      rowHeight: 78,
      rows: partyRows(content, run.party, () => null, undefined, () => 'It will be gone for good, and gives no candies.'),
      onSelect: (i) => {
        const old = run.party[i]!;
        const oldName = getSpecies(content, old.speciesId).name;
        this.confirm(`Send away ${oldName}${old.shiny ? ' ★' : ''} (Lv${old.level}) and keep ${newName}? This can't be undone.`, () =>
          this.resolve({ kind: 'replace', partyIndex: i }),
        );
      },
      onBack: () => {
        this.picker?.close();
        this.picker = null;
      },
    });
  }
}
