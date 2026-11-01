// Choices the run waits on between battles, one at a time:
//   - a Pokémon wants to learn a move but already knows four
//   - a Pokémon was caught: add it, replace a party member, or release it
// Replacing, releasing and forgetting can't be undone, so each asks to confirm.

import { fixedDamageLabel } from '../ui/battleText';
import Phaser from 'phaser';
import { EGG_TIERS, eggTier } from '../core/eggs';
import { catchSummary } from '../core/catchSummary';
import { masteryPreview } from '../core/mastery';
import { candiesForRelease } from '../core/encounters';
import { partyCapacity, releaseLimitReached } from '../core/run';
import { runPerks } from '../core/archetypes';
import { boxCapacity } from '../core/trainerPerks';
import { joinProblem } from '../core/rules';
import type { Content } from '../core/contentSchema';
import { calcStats, getSpecies, MAX_PP_UPS, maxPp } from '../core/pokemon';
import type { DecisionChoice } from '../core/run';
import { pathName, type MentorPath } from '../core/story/mentorship';
import { askLeadText } from '../core/story/askLead';

const PATH_BLURB: Record<MentorPath, string> = {
  guardian: 'protecting allies and standing firm under pressure',
  striker: 'timing attacks and finishing blows',
  strategist: 'exploiting weaknesses and countering setups',
  survivor: 'enduring the hardest battles',
  challenger: 'facing stronger opponents head on',
  bonded: 'fighting beside a specific teammate',
};
import type { MoveSlot, PokemonInstance } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx, playMusicLazy } from '../ui/audio';
import { raidCaptureTrack } from '../core/presentation/battleMusic';
import { onInputAction, type InputAction } from '../ui/input';
import { partyRows, Picker } from '../ui/partyPanel';
import { fitHeight } from '../ui/showcase';
import { pokemonVisual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TYPE_COLORS, textStyle } from '../ui/theme';
import { Menu } from '../ui/widgets';
import { glassPanel as drawPanel } from '../ui/aero';
import { sceneForRun } from './routing';
import { partySpecies, preloadPokemon, queueAssets } from '../ui/lazyAssets';

/** The EBDX art the Egg hatch uses (loaded only when an Egg is hatching). */
const HATCH_ASSETS = ['pack.ebdx.egg', 'pack.ebdx.eggCracks', 'pack.ebdx.hatch.hatchbg', 'pack.ebdx.hatch.line', 'pack.ebdx.hatch.overlay', 'pack.ebdx.hatch.shine6', 'pack.ebdx.hatch.shine7', 'se.egg_get'];

function describeMove(content: Content, id: string): string {
  const m = content.moves.get(id)!;
  const power = m.power ?? fixedDamageLabel(m.effects.fixedDamage);
  return `${m.type.toUpperCase()} · ${m.category} · Pow ${power} · Acc ${m.accuracy ?? '—'} · PP ${m.pp}`;
}

export class DecisionScene extends Phaser.Scene {
  private menu: Menu | null = null;
  private picker: Picker | null = null;
  private confirmMenu: Menu | null = null;
  private confirmLayer: Phaser.GameObjects.Container | null = null;
  private done = false;
  /** The Egg hatch is playing; input waits until the Pokémon is shown. */
  private hatching = false;

  constructor() {
    super('Decision');
  }

  private raidTier(): number | null {
    const d = services().session.run?.pending[0];
    return d?.kind === 'caught' && d.raidTier ? d.raidTier : null;
  }

  preload(): void {
    const { session } = services();
    const caught = (session.run?.pending ?? []).flatMap((d) => (d.kind === 'caught' || d.kind === 'reunion' ? (session.content.species.get(d.mon.speciesId) ?? []) : []));
    preloadPokemon(this, [...partySpecies(), ...caught], { front: true, shiny: true, icon: true });
    if (session.run?.pending.some((d) => d.kind === 'caught' && d.mon.hatched)) queueAssets(this, HATCH_ASSETS);
    const tier = this.raidTier();
    if (tier) queueAssets(this, [raidCaptureTrack(tier)]);
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
    // A beaten raid boss asking to join plays that tier's capture jingle (Raid Battles pack).
    const tier = this.raidTier();
    if (tier) playMusic(this, raidCaptureTrack(tier));
    else playMusicLazy(this, 'bgm.event');

    onInputAction(this, (a) => this.handleInput(a));
    if (decision.kind === 'learnMove') this.buildLearnMove(decision.uid, decision.moveId);
    else if (decision.kind === 'caught' && decision.mon.hatched) this.playHatch(decision.mon);
    else if (decision.kind === 'caught') this.buildCaught(decision.mon);
    else if (decision.kind === 'reunion') this.buildCaught(decision.mon, decision.hallOfFame);
    else if (decision.kind === 'teachMove') this.buildTeachMove(decision.uid, decision.itemName, decision.moveIds);
    else if (decision.kind === 'signature') this.buildSignature(decision.title, decision.options);
    else if (decision.kind === 'mentorship') this.buildMentorship(decision.mentorUid, decision.proteUid, decision.path);
    else if (decision.kind === 'askLead') this.buildAskLead(decision.uid, decision.reason);
    else this.buildPpUp(decision.uid, decision.itemName, decision.ups);
  }

  private compareStep?: (d: number) => void;

  private handleInput(action: InputAction): void {
    if (this.done || this.hatching) return;
    if (!this.confirmMenu && !this.picker && (action === 'left' || action === 'right')) this.compareStep?.(action === 'left' ? -1 : 1);
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
      const power = m.power ?? fixedDamageLabel(m.effects.fixedDamage);
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

  // ---------- a trainer's signature mechanic (core/signature.ts) ----------

  private buildSignature(title: string, options: { label: string; description: string }[]): void {
    this.add.text(GAME_WIDTH / 2, 60, title, textStyle(34, COLORS.textLight, { align: 'center', wordWrap: { width: 800 } })).setOrigin(0.5, 0);
    drawPanel(this, 220, 170, 520, 70 * options.length + 30);
    this.menu = new Menu(this, {
      x: 236,
      y: 184,
      options: options.map((o) => ({ label: o.label, detail: o.description })),
      itemHeight: 70,
      itemWidth: 488,
      fontSize: 26,
      onSelect: (i) => this.resolve({ kind: 'signature', optionIndex: i }),
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

  // ---------- a veteran offers to mentor a teammate ----------

  private buildAskLead(uid: string, reason: 'leftOut' | 'campfire'): void {
    const { session } = services();
    const content = session.content;
    const run = session.run!;
    const mon = run.party.find((p) => p.uid === uid);
    if (!mon) {
      this.resolve({ kind: 'askLead', accept: false });
      return;
    }
    const sp = getSpecies(content, mon.speciesId);
    pokemonVisual(this, sp, 'front', 150, 330, 3, mon.shiny);
    this.add.text(300, 60, askLeadText(content, run, { uid, reason }), textStyle(28, COLORS.textLight, { wordWrap: { width: 640 } }));
    this.add.text(300, 190, 'Letting it lead puts it first in the party and grows its friendship. It will fight at the front next battle.', textStyle(18, '#a69cb4', { wordWrap: { width: 640 } }));
    drawPanel(this, 300, 270, 620, 150);
    this.menu = new Menu(this, {
      x: 316,
      y: 284,
      options: [{ label: `Let ${sp.name} lead` }, { label: 'Not now' }],
      itemHeight: 56,
      itemWidth: 580,
      fontSize: 26,
      onSelect: (i) => this.resolve({ kind: 'askLead', accept: i === 0 }),
    });
  }

  private buildMentorship(mentorUid: string, proteUid: string, path: MentorPath): void {
    const { session } = services();
    const content = session.content;
    const party = session.run!.party;
    const mentor = party.find((p) => p.uid === mentorUid);
    const prote = party.find((p) => p.uid === proteUid);
    if (!mentor || !prote) {
      this.resolve({ kind: 'mentor', accept: false });
      return;
    }
    const m = getSpecies(content, mentor.speciesId);
    const p = getSpecies(content, prote.speciesId);
    pokemonVisual(this, m, 'front', 150, 260, 3, mentor.shiny);
    pokemonVisual(this, p, 'front', 150, 460, 2, prote.shiny);
    this.add.text(300, 40, `${p.name} looks up to ${m.name}.`, textStyle(30, COLORS.textLight, { wordWrap: { width: 640 } }));
    this.add.text(300, 110, `${pathName(path)}: ${PATH_BLURB[path]}`, textStyle(22, '#d8d0e0', { wordWrap: { width: 640 } }));
    this.add.text(300, 190, 'A mentorship ends when the protégé evolves or catches up. It shapes stories and tactics, not raw stats.', textStyle(18, '#a69cb4', { wordWrap: { width: 640 } }));
    drawPanel(this, 300, 270, 620, 150);
    this.menu = new Menu(this, {
      x: 316,
      y: 284,
      options: [{ label: `Let ${m.name} mentor ${p.name}` }, { label: 'Not now' }],
      itemHeight: 56,
      itemWidth: 580,
      fontSize: 26,
      onSelect: (i) => this.resolve({ kind: 'mentor', accept: i === 0 }),
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

  /** A caught Pokémon, or one from a past run that wants to join (`reunion` set: true if it won a past run with you). */
  /**
   * The Egg hatches (EBDX art): it wobbles and cracks a little more each time, bursts in a white
   * flash and shines, then the usual join screen shows the Pokémon. Motion "off" skips straight to it.
   */
  private playHatch(mon: PokemonInstance): void {
    const motion = services().session.settings.battleAnimations;
    const has = (id: string) => this.textures.exists(id);
    if (motion === 'off' || !has('pack.ebdx.egg')) {
      this.buildCaught(mon);
      return;
    }
    this.hatching = true;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 10;
    const layer = this.add.container(0, 0).setDepth(200);
    layer.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0a1830).setOrigin(0));
    if (has('pack.ebdx.hatch.hatchbg')) layer.add(this.add.image(cx, GAME_HEIGHT / 2, 'pack.ebdx.hatch.hatchbg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT));
    if (has('pack.ebdx.hatch.line')) {
      const line = this.add.tileSprite(cx, cy + 96, GAME_WIDTH, 38, 'pack.ebdx.hatch.line').setAlpha(0.8);
      layer.add(line);
      this.tweens.add({ targets: line, tilePositionX: 512, duration: 4000, repeat: -1 });
    }
    const shadow = this.add.ellipse(cx, cy + 70, 120, 22, 0x000000, 0.3);
    const egg = this.add.image(cx, cy, 'pack.ebdx.egg').setScale(4.6);
    const cracks = has('pack.ebdx.eggCracks') ? this.add.image(cx, cy, 'pack.ebdx.eggCracks', 0).setScale(4.6) : null;
    const tier = eggTier(mon.eggTier);
    if (tier.id !== 'ordinary') {
      egg.setTint(Phaser.Display.Color.HexStringToColor(tier.color).color);
    }
    const caption = this.add.text(cx, 64, tier.line, textStyle(tier.line.length > 22 ? 26 : 32, COLORS.textLight)).setOrigin(0.5).setAlpha(0);
    layer.add([shadow, egg, ...(cracks ? [cracks] : []), caption]);
    if (has('pack.ebdx.hatch.overlay')) layer.add(this.add.image(cx, GAME_HEIGHT / 2, 'pack.ebdx.hatch.overlay').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.5));
    this.tweens.add({ targets: caption, alpha: 1, y: 80, duration: 400, ease: 'Back.easeOut' });
    // Idle bob while it gathers itself.
    this.tweens.add({ targets: [egg, cracks].filter(Boolean), y: cy - 10, duration: 420, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    const sparkle = (n: number) => {
      if (!has('pack.ebdx.hatch.shine6')) return;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const s = this.add.image(cx, cy - 60, 'pack.ebdx.hatch.shine6').setScale(1.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(201);
        this.tweens.add({ targets: s, x: cx + Math.cos(a) * 170, y: cy - 60 + Math.sin(a) * 140, scale: 0.3, alpha: 0, angle: 180, duration: 700, ease: 'Cubic.easeOut', onComplete: () => s.destroy() });
      }
    };
    // Three wobbles, each a little wilder, each leaving more cracks.
    const wobble = (i: number) => {
      if (i >= 3) return burst();
      const swing = 10 + i * 6;
      this.tweens.chain({
        targets: [egg, cracks].filter(Boolean),
        tweens: [
          { angle: -swing, duration: 110 - i * 15, ease: 'Sine.easeOut' },
          { angle: swing, duration: 180 - i * 25, ease: 'Sine.easeInOut', yoyo: true, repeat: 1 },
          { angle: 0, duration: 120, ease: 'Back.easeOut' },
        ],
        onComplete: () => {
          cracks?.setFrame(Math.min(4, i + 2));
          this.cameras.main.shake(90, 0.004 + i * 0.002);
          sparkle(4 + i * 2);
          this.time.delayedCall(260 + (2 - i) * 120, () => wobble(i + 1));
        },
      });
    };
    const burst = () => {
      const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setOrigin(0).setDepth(210);
      this.tweens.add({ targets: [egg, cracks].filter(Boolean), scaleX: 5.4, scaleY: 3.8, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
      this.tweens.add({
        targets: flash,
        alpha: 1,
        duration: 260,
        delay: 120,
        onComplete: () => {
          layer.destroy();
          this.cameras.main.setBackgroundColor(0x000000);
          playSfx(this, 'se.egg_get');
          this.hatching = false;
          this.buildCaught(mon);
          if (has('pack.ebdx.hatch.shine7')) {
            const ring = this.add.image(200, 220, 'pack.ebdx.hatch.shine7').setBlendMode(Phaser.BlendModes.ADD).setDepth(205).setScale(1.2);
            this.tweens.add({ targets: ring, scale: 4.5, alpha: 0, angle: 90, duration: 900, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
          }
          sparkle(10 + EGG_TIERS.findIndex((t) => t.id === tier.id) * 6);
          this.tweens.add({ targets: flash, alpha: 0, duration: 520, ease: 'Sine.easeIn', onComplete: () => flash.destroy() });
        },
      });
    };
    this.time.delayedCall(900, () => wobble(0));
  }

  private buildCaught(caught: PokemonInstance, reunion?: boolean): void {
    const { session } = services();
    const content = session.content;
    const run = session.run!;
    const species = getSpecies(content, caught.speciesId);
    const candies = candiesForRelease(content, caught.level);
    const partyMax = partyCapacity(content, run);
    const full = run.party.length >= partyMax;
    const boxRoom = !reunion && run.box.length < boxCapacity(runPerks(content, run));
    const blocked = joinProblem(content, run, caught.speciesId);

    // A soft spotlight for the new Pokémon to stand on.
    const spot = this.add.graphics();
    spot.fillStyle(0x0e0b12, 0.55).fillEllipse(200, 300, 240, 44);
    spot.fillStyle(0x4a3f5c, 0.9).fillEllipse(200, 298, 200, 32);
    fitHeight(this, pokemonVisual(this, species, 'front', 200, 300, 3.5, caught.shiny), 240);
    const past = reunion !== undefined;
    const title = !past ? (caught.hatched ? `${species.name} hatched from ${caught.eggTier && caught.eggTier !== 'ordinary' ? `a ${eggTier(caught.eggTier).name} Egg` : 'the Egg'}!` : `You caught ${species.name}!`) : reunion ? `${species.name} never forgot you!` : `${species.name} from a past run is here!`;
    this.add.text(400, 40, title, textStyle(past ? 32 : 40, COLORS.textLight));
    const profile = session.profile;
    const extras = {
      compact: session.settings.catchDetail === 'compact',
      firstDiscovery: !past && !profile.speciesCaught.includes(caught.speciesId),
      source: past ? undefined : caught.hatched ? `Hatched from ${caught.eggTier && caught.eggTier !== 'ordinary' ? `a ${eggTier(caught.eggTier).name} Egg` : 'an Egg'}` : 'Caught on this run',
    };
    const summaryText = this.add.text(400, 92, '', textStyle(16, '#d8d0e0', { lineSpacing: 4, wordWrap: { width: 560 } }));
    let compareIdx = 0;
    const drawSummary = (): void => {
      const other = run.party[compareIdx];
      const lines = [...catchSummary(content, caught, other, extras), masteryPreview(content, profile, run, caught)];
      const hint = run.party.length > 1 ? `(Left/Right: compare with ${other ? getSpecies(content, other.speciesId).name : 'nobody'})` : '';
      summaryText.setText([...lines, hint, blocked ? `${blocked}.` : full ? `Your party is full (${partyMax}).` : `Party: ${run.party.length}/${partyMax}`].join('\n'));
    };
    drawSummary();
    this.compareStep = (d: number): void => {
      if (run.party.length < 2) return;
      compareIdx = (compareIdx + d + run.party.length) % run.party.length;
      drawSummary();
    };

    const candyText = `${candies} cand${candies === 1 ? 'y' : 'ies'}`;
    const keepsake = candies * content.balance.reunion.keepsakeCandyMultiplier;
    const keepsakeText = `${keepsake} cand${keepsake === 1 ? 'y' : 'ies'}`;
    const options = [
      { label: blocked ? "Can't join" : full ? 'Replace a party Pokémon' : 'Add to party', disabled: blocked !== null && !past },
      ...(boxRoom ? [{ label: `Send to the PC (${run.box.length}/${boxCapacity(runPerks(content, run))})` }] : []),
      ...(past ? [{ label: `Take a keepsake (+${keepsakeText})` }, { label: 'Let it go on its journey' }] : releaseLimitReached(content, session.run!) && !blocked ? [] : [{ label: `Release it (+${candyText})` }]),
    ];
    drawPanel(this, 400, 345, 520, past ? 170 : 130 + (boxRoom ? 52 : 0));
    this.menu = new Menu(this, {
      x: 420,
      y: 365,
      options,
      itemWidth: 480,
      itemHeight: past ? 46 : 52,
      fontSize: 28,
      onSelect: (i) => {
        if (i === 0 && blocked && !past) return;
        if (i === 0 && !full) this.resolve({ kind: 'addToParty' });
        else if (i === 0) this.openReplace(caught);
        else if (boxRoom && i === 1) this.resolve({ kind: 'sendToBox' });
        else if (past && i === 1) this.resolve({ kind: 'keepsake' });
        else if (past) this.resolve({ kind: 'release' });
        else
          this.confirm(`Release ${species.name}? You'll get ${candyText}. This can't be undone.`, () => {
            playSfx(this, 'se.ball_release');
            this.resolve({ kind: 'release' });
          });
      },
    });
    const note = past ? 'It wants to join you again. It kept its moves; it meets you at this battle\'s level.' : 'Candies are kept after the run ends.';
    this.add.text(GAME_WIDTH / 2, past ? 520 : 500, note, textStyle(18, '#a69cb4')).setOrigin(0.5);
  }

  private openReplace(caught: PokemonInstance): void {
    const { session } = services();
    const content = session.content;
    const run = session.run!;
    const newName = getSpecies(content, caught.speciesId).name;
    this.picker = new Picker(this, {
      glass: true,
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
