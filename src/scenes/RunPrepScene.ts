// The Preparation Desk (GAME_DESIGN.md §14.7): after choosing a trainer, pick
// the campaign, starter pool, draft rule and one preparation, check the Run
// Build Summary, save or load a loadout preset, then roll the starters.

import { loanProblem, presetSlotCount } from '../core/bank';
import { LICENSES, licenseName, type LicenseId } from '../core/license';
import Phaser from 'phaser';
import { decodeSeedCode } from '../core/seedCode';
import { TYPE_NAMES, type TypeName } from '../core/contentSchema';
import {
  buildSummary,
  defaultPrep,
  draftRuleAvailable,
  poolStatus,
  poolTypes,
  presetIn,
  presetParts,
  resolvePrep,
  tokenAvailable,
  tokenLockText,
} from '../core/runPrep';
import { availableMentors, getMentor, mentorBlurb, mentorUnlocked, MENTORS } from '../core/mentors';
import type { LoadoutPreset, RunPrep } from '../core/state';
import { services } from '../game/services';
import { playSfx } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { Menu } from '../ui/widgets';
import { AERO, drawGlass, glassPanel as drawPanel, type MotionLevel } from '../ui/aero';
import { dailySetup } from '../core/daily';
import { boardLines } from '../core/boards';
import { decodeGhostCode, keepGhost } from '../core/ghost';
import { weeklyClaimKey, weeklySeed, weeklySetup } from '../core/weekly';
import { dailyClaimKey, dailySeed, getDifficulty, getMode, getModifier, RUN_RULES, rulesLines, STANDARD_CHOICE, type RulesChoice } from '../core/rules';
import { isClaimed } from '../core/quests';

export interface RunPrepData {
  archetypeId: string;
  prep?: RunPrep;
  /** A fixed seed for the run (null: random). */
  seed?: string | null;
  focus?: number;
  notice?: string;
  /** Mode, difficulty, modifier and Death-Block (default: standard; Death-Block on for a player's first three runs). */
  rules?: RulesChoice;
  /** Which modifier the Modifier row shows (Enter turns it on or off). */
  modCursor?: number;
  /** The page shown (0 to 4; default the Overview). */
  page?: number;
  /** Page change direction, for the slide-in. */
  slide?: 1 | -1;
}

type Row = 'start' | 'trainer' | 'campaign' | 'pool' | 'draft' | 'type' | 'token' | 'directive' | 'license' | 'loan' | 'vault' | 'mentor' | 'mode' | 'region' | 'difficulty' | 'weeks' | 'modifier' | 'deathBlock' | 'seed' | 'save' | 'load';

interface PageDef {
  id: string;
  title: string;
  blurb: string;
  tint: number;
  rows: Row[];
}

/** The five pages of the Preparation Desk (spec §13). It opens on the Overview, where Enter rolls the starters. */
const PAGES: PageDef[] = [
  { id: 'config', title: 'Run Setup', blurb: 'Mode, region, difficulty, campaign, Weeks and seed.', tint: 0x2f80d0, rows: ['mode', 'region', 'difficulty', 'campaign', 'weeks', 'seed'] },
  { id: 'trainer', title: 'Trainer', blurb: 'Who you are and what you bring: preparation, directive, license, loan, Vault, mentor.', tint: 0x2fa080, rows: ['trainer', 'token', 'directive', 'license', 'loan', 'vault', 'mentor'] },
  { id: 'starters', title: 'Starters', blurb: 'The starter pool and how the starters are drafted.', tint: 0xd0902f, rows: ['pool', 'draft', 'type'] },
  { id: 'modifiers', title: 'Modifiers', blurb: 'Special rules, challenges and Death-Block.', tint: 0xb050c0, rows: ['modifier', 'deathBlock'] },
  { id: 'overview', title: 'Overview', blurb: 'Check everything, keep a preset, then roll the starters.', tint: 0xd04a5a, rows: ['start', 'save', 'load'] },
];
const OVERVIEW = PAGES.length - 1;

/** What each row changes, shown beside the list while it is focused. */
const ROW_HELP: Record<Row, string> = {
  start: 'Rolls your starters from the pool and begins the run with everything on this desk.',
  trainer: 'The Trainer you play: their Pokémon leanings, strengths and weaknesses. ←/→ changes it.',
  campaign: 'How many regions the run covers. Shorter campaigns are for testing and do not count for progress.',
  pool: 'Which Pokémon your starters are drawn from. Unlock more pools in the Starter Laboratory.',
  draft: 'How you pick your starters: choose from a few, a blind draft, or focus on one type.',
  type: 'Type Focus only: the type your starter choices lean toward.',
  token: 'One preparation for the run (extra items, money or a hint). More unlock with achievements and licenses.',
  directive: 'Study one type this run for bonus Research Points when you defeat or catch its Pokémon.',
  license: 'A Field License gives one exploration hint for the whole run.',
  loan: 'Borrow money now. Finish with enough badges, or the Bank takes credits back.',
  mentor: 'Train under a mentor: lessons that unlock with trust, a mission, a fellow apprentice. More mentors unlock with runs, wins and trust.',
  vault: "Take a rare held item from the Collector's Vault into this run.",
  mode: 'The kind of run: Standard, Adventure, Endless, Daily Run and more. Some modes pay no account rewards.',
  region: 'Regional Circuit only: the region you run. "By seed" lets the seed pick.',
  difficulty: 'Raises enemy levels and the rewards for beating them.',
  weeks: 'Weeks ON (the default): this week\'s event and any holiday event apply to this run: their rules, roamers and map stops, and the run counts toward their goals. Weeks OFF: none of that this run. Events you already finished and their rewards are kept either way. The choice is fixed for the whole run.',
  modifier: '←/→ browse the modifiers, Enter turns one on or off. Each one changes a rule and the rewards.',
  deathBlock: 'Once, at the start of a run, a wipe sends you back to a checkpoint instead of ending it. On for your first three runs.',
  seed: 'A fixed seed makes the run play out the same way again. Paste a shared seed code (PR1.…) to copy its trainer and rules too.',
  save: 'Keeps this whole setup in a preset slot to load later.',
  load: 'Replaces this setup with one from a preset slot.',
};

/** Cuts a menu label so it stays inside the left panel. */
function fitLabel(text: string, max = 38): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export class RunPrepScene extends Phaser.Scene {
  private menu!: Menu;
  private picker: Picker | null = null;
  private focusIndex = 0;
  private archetypeId = '';
  private prep!: RunPrep;
  private seed: string | null = null;
  private rules: RulesChoice = STANDARD_CHOICE;
  private modCursor = 0;
  private page = OVERVIEW;
  private help: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('RunPrep');
  }

  create(data: RunPrepData): void {
    const { session } = services();
    const { content, profile } = session;
    const params = new URLSearchParams(window.location.search);
    this.picker = null;

    // Start from the choices passed in, else last run's (for this trainer's screen), else the defaults.
    let wanted = data.prep;
    if (!wanted) {
      const last = profile.lastPrep ? presetParts(profile.lastPrep).prep : defaultPrep(content);
      const urlCampaign = params.get('campaign');
      wanted = { ...last, campaignId: urlCampaign && content.campaigns.has(urlCampaign) ? urlCampaign : last.campaignId };
    }
    const resolved = resolvePrep(content, profile, data.archetypeId, wanted);
    this.archetypeId = resolved.archetypeId;
    this.prep = resolved.prep;
    this.seed = data.seed !== undefined ? data.seed : params.get('seed');
    this.modCursor = data.modCursor ?? 0;
    this.rules = data.rules ?? { ...STANDARD_CHOICE, deathBlock: profile.stats.runsEnded < 3 && !params.has('debug') };
    const notice = [data.notice, ...resolved.problems].filter(Boolean).join(' ');
    this.page = Math.max(0, Math.min(OVERVIEW, data.page ?? OVERVIEW));
    const def = PAGES[this.page]!;
    const motion = session.settings.battleAnimations;
    const rows = def.rows;
    this.help = null; // a Text from the screen's previous run is gone

    this.add.text(GAME_WIDTH / 2, 22, 'Preparation Desk', textStyle(30, COLORS.textLight)).setOrigin(0.5);
    this.drawTabs();
    drawPanel(this, 16, 96, 440, 376);
    drawPanel(this, 470, 96, GAME_WIDTH - 486, 376, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true });
    this.add.text(36, 104, def.blurb, textStyle(14, COLORS.textMuted, { wordWrap: { width: 400 } }));

    const archetype = content.archetypes.get(this.archetypeId)!;
    const pool = content.starterPools.get(this.prep.poolId)!;
    const rule = content.draftRules.get(this.prep.draftRuleId)!;
    const token = this.prep.tokenId ? content.prepTokens.get(this.prep.tokenId) : undefined;
    const labels: Record<Row, string> = {
      start: 'Roll starters  ▶',
      trainer: `Trainer: ${archetype.name}`,
      campaign: `Campaign: ${content.campaigns.get(this.prep.campaignId)?.name ?? this.prep.campaignId}`,
      pool: `Starters: ${pool.name}`,
      draft: `Draft: ${rule.name}`,
      type: `Focus type: ${this.prep.typeFocus ? capitalise(this.prep.typeFocus) : '—'}`,
      token: `Preparation: ${token?.name ?? 'none'}`,
      directive: `Research Directive: ${this.prep.directive ? capitalise(this.prep.directive) : 'none'}`,
      license: `Field License: ${this.prep.license ? licenseName(this.prep.license) : 'none'}`,
      loan: `Bank loan: ${this.prep.loan ? `ON (+₽${content.balance.bank.loan.money})` : 'off'}`,
      mentor: `Mentor: ${getMentor(this.prep.mentorId)?.name ?? 'none'}`,
      vault: `Vault item: ${this.prep.vaultItem ? content.items.get(this.prep.vaultItem)?.name ?? this.prep.vaultItem : 'none'}`,
      mode: `Mode: ${getMode(this.rules.modeId)?.name}`,
      region: `Circuit region: ${this.rules.regionId ? content.regions.get(this.rules.regionId)?.name ?? this.rules.regionId : 'by seed'}`,
      difficulty: `Difficulty: ${getDifficulty(this.rules.difficultyId)?.name}`,
      weeks: `Weeks: ${this.rules.weeks === false ? 'OFF' : 'ON (default)'}`,
      modifier: `◂ ${RUN_RULES.modifiers[this.modCursor]?.name} ▸ ${this.rules.modifierIds.includes(RUN_RULES.modifiers[this.modCursor]!.id) ? 'ON' : 'off'}`,
      deathBlock: `Death-Block: ${this.rules.deathBlock ? 'on' : 'off'}`,
      seed: `Seed: ${this.seed ?? 'random'}`,
      save: 'Save as preset…',
      load: 'Load a preset…',
    };
    const disabled = (r: Row): boolean => (r === 'type' && rule.kind !== 'typeFocus') || (r === 'region' && getMode(this.rules.modeId)?.campaignId !== 'regional-circuit');
    this.menu = new Menu(this, {
      x: 34,
      y: 134,
      options: rows.map((r) => ({ label: fitLabel(labels[r], 32), disabled: disabled(r) })),
      itemWidth: 410,
      itemHeight: rows.length > 6 ? 44 : 52, // seven rows (Trainer page) still fit the panel
      fontSize: 20,
      glass: { tints: rows.map(() => def.tint), motion: motion as MotionLevel },
      onFocus: (i) => {
        this.focusIndex = i;
        this.help?.setText(ROW_HELP[rows[i]!] ?? '');
      },
      onSelect: (i) => this.select(rows[i]!),
      onBack: () => this.scene.start('TrainerSelect'),
    });

    // The right pane: what the focused row does, then the Run Build Summary (the whole pane on the Overview).
    const overview = this.page === OVERVIEW;
    const left = 490;
    const width = GAME_WIDTH - 526;
    let top = 108;
    if (!overview) {
      this.add.text(left, top, 'What this does', textStyle(16, '#f0e0a0'));
      this.help = this.add.text(left, top + 22, ROW_HELP[rows[Math.min(data.focus ?? 0, rows.length - 1)]!] ?? '', textStyle(15, COLORS.text, { wordWrap: { width } }));
      top += 128;
    }
    const summary = this.add.container(left, top);
    let y = 0;
    const line = (text: string, size = 18, color: string = COLORS.textLight) => {
      const t = this.add.text(0, y, text, textStyle(size, color, { wordWrap: { width } }));
      summary.add(t);
      y += t.height + 4;
    };
    if (overview) {
      line('Run Overview', 24);
      for (const l of buildSummary(content, this.archetypeId, this.prep, profile.attributes)) line(l, 17, l.startsWith('  −') ? '#f0a0a0' : l.startsWith('  +') ? '#a0e0a0' : COLORS.textLight);
      y += 6;
      for (const l of rulesLines(this.rules)) line(l, 15, '#c8e0f0');
      if (getMode(this.rules.modeId)?.dailySeed) for (const l of dailySetup(content, new Date().toISOString(), this.prep, this.rules).lines) line(l, 15, '#f0e0a0');
      if (getMode(this.rules.modeId)?.weeklySeed) {
        const now = new Date().toISOString();
        for (const l of weeklySetup(content, now, this.prep, this.rules).lines) line(l, 15, '#f0e0a0');
        for (const l of boardLines(profile, 'weekly', weeklySeed(now))) line(l, 14, '#c8d8a0');
      }
      if (getMode(this.rules.modeId)?.dailySeed) for (const l of boardLines(profile, 'daily', dailySeed(new Date().toISOString()))) line(l, 14, '#c8d8a0');
      y += 6;
      line(`${rule.description}`, 15, '#d8d0e0');
      const locked = [
        ...[...content.draftRules.values()].filter((r) => !draftRuleAvailable(profile, r)).map((r) => `${r.name} (needs the ${content.licenses.get(r.license!)?.name})`),
        ...[...content.prepTokens.values()].filter((t) => !tokenAvailable(profile, t)).map((t) => `${t.name} (${tokenLockText(content, t)})`),
        ...(MENTORS.some((m) => !mentorUnlocked(m, profile)) ? [`${MENTORS.filter((m) => !mentorUnlocked(m, profile)).length} more mentors (Hub, Events, Mentors)`] : []),
      ];
      const mentor = getMentor(this.prep.mentorId);
      if (mentor) {
        y += 4;
        for (const l of mentorBlurb(mentor).slice(0, 4)) line(l, 13, '#d8c8f0');
      }
      if (locked.length > 0) {
        y += 4;
        line(`Not yet available: ${locked.slice(0, 3).join(', ')}${locked.length > 3 ? `, and ${locked.length - 3} more (see Unlocks)` : ''}.`, 13, '#a69cb4');
      }
    } else {
      // Other pages: a short, readable recap of the choices so far (the Overview has the full build).
      const mods = this.rules.modifierIds.map((id) => getModifier(id)?.name ?? id);
      line('Current setup', 18);
      for (const l of [
        `Trainer: ${archetype.name}`,
        `Mode: ${getMode(this.rules.modeId)?.name} · ${getDifficulty(this.rules.difficultyId)?.name}`,
        `Campaign: ${content.campaigns.get(this.prep.campaignId)?.name ?? this.prep.campaignId}`,
        `Weeks: ${this.rules.weeks === false ? 'off' : 'on'}`,
        `Starters: ${pool.name}, ${rule.name}`,
        `Preparation: ${token?.name ?? 'none'}`,
        `Modifiers: ${mods.length > 0 ? mods.join(', ') : 'none'}${this.rules.deathBlock ? ' · Death-Block' : ''}`,
        `Seed: ${this.seed ?? 'random'}`,
      ]) line(l, 15);
      y += 4;
      line('Page 5 (Overview) has the full summary.', 13, '#a69cb4');
    }
    // Shrink the summary to fit its pane instead of spilling out of the bottom.
    const room = 472 - 8 - top;
    if (y > room) summary.setScale(room / y);

    this.add.text(GAME_WIDTH / 2, 478, notice, textStyle(16, '#f0e0a0', { align: 'center', wordWrap: { width: GAME_WIDTH - 60 } })).setOrigin(0.5, 0);
    this.add.text(16, GAME_HEIGHT - 22, '↑/↓ choose  ·  ←/→ change  ·  Enter select  ·  Q/E or PgUp/PgDn page  ·  Esc back to trainers', textStyle(14, '#8a7f96'));

    this.focusIndex = Math.min(data.focus ?? 0, rows.length - 1);
    this.menu.focus(this.focusIndex, false);
    this.help?.setText(ROW_HELP[rows[this.focusIndex]!] ?? '');

    // Pages slide in from the side they came from (a fade when motion is reduced; nothing when it is off).
    if (data.slide && motion !== 'off') {
      const targets = [this.menu.container, summary];
      const dx = motion === 'full' ? 36 * data.slide : 0;
      for (const t of targets) {
        const x = t.x;
        t.setAlpha(0).setX(x + dx);
        this.tweens.add({ targets: t, alpha: 1, x, duration: 220, ease: 'Cubic.easeOut' });
      }
    }

    onInputAction(this, (a) => {
      if (this.picker) return this.picker.handle(a);
      if (a === 'left' || a === 'right') return this.cycle(rows[this.focusIndex]!, a === 'right' ? 1 : -1);
      this.menu.handle(a);
    });
    const keyboard = this.input.keyboard;
    if (keyboard) {
      const turn = (step: 1 | -1) => !this.picker && this.goPage(this.page + step);
      const prev = () => turn(-1);
      const next = () => turn(1);
      keyboard.on('keydown-Q', prev).on('keydown-PAGE_UP', prev).on('keydown-E', next).on('keydown-PAGE_DOWN', next);
      this.events.once('shutdown', () => keyboard.off('keydown-Q', prev).off('keydown-PAGE_UP', prev).off('keydown-E', next).off('keydown-PAGE_DOWN', next));
    }
  }

  /** The five page chips across the top; click one to jump to it. */
  private drawTabs(): void {
    const w = 172;
    const gap = 8;
    const x0 = (GAME_WIDTH - (PAGES.length * w + (PAGES.length - 1) * gap)) / 2;
    PAGES.forEach((p, i) => {
      const x = x0 + i * (w + gap);
      const on = i === this.page;
      drawGlass(this, x, 48, w, 38, { tint: on ? p.tint : AERO.glassLow, alpha: on ? 0.96 : 0.55, glow: on, radius: 14 });
      this.add.text(x + w / 2, 67, `${i + 1}  ${p.title}`, textStyle(on ? 19 : 17, on ? '#ffffff' : COLORS.textMuted)).setOrigin(0.5);
      this.add.zone(x, 48, w, 38).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => !this.picker && this.goPage(i));
    });
  }

  /** Shows another page (clamped; the first row is focused). */
  goPage(index: number): void {
    const page = Math.max(0, Math.min(OVERVIEW, index));
    if (page === this.page) return;
    this.scene.restart({ archetypeId: this.archetypeId, prep: this.prep, seed: this.seed, focus: 0, rules: this.rules, modCursor: this.modCursor, page, slide: page > this.page ? 1 : -1 } satisfies RunPrepData);
  }

  private refresh(changes: Partial<RunPrep> = {}, extra: Partial<RunPrepData> = {}): void {
    this.scene.restart({ archetypeId: this.archetypeId, prep: { ...this.prep, ...changes }, seed: this.seed, focus: this.focusIndex, rules: this.rules, modCursor: this.modCursor, page: this.page, ...extra } satisfies RunPrepData);
  }

  /** Steps through the options of a row (←/→, or Enter on rows that cycle). */
  private cycle(row: Row, step: 1 | -1): void {
    const { content, profile } = services().session;
    const next = <T>(list: T[], current: T): T => list[(list.indexOf(current) + step + list.length) % list.length]!;
    switch (row) {
      case 'trainer': {
        const ids = [...content.archetypes.values()].filter((a) => a.available && (a.unlockedByDefault || profile.unlockedArchetypes.includes(a.id))).map((a) => a.id);
        this.archetypeId = next(ids, this.archetypeId);
        return this.refresh();
      }
      case 'campaign': {
        const params = new URLSearchParams(window.location.search);
        const testing = import.meta.env.DEV || params.has('debug') || params.has('campaign');
        const ids = [...content.campaigns.values()].filter((c) => c.countsForProgress || testing).map((c) => c.id);
        if (ids.length < 2) return playSfx(this, 'ui.error', 0.4);
        return this.refresh({ campaignId: next(ids, this.prep.campaignId) });
      }
      case 'pool': {
        const ids = [...content.starterPools.values()].filter((p) => poolStatus(content, profile, p) === 'unlocked').map((p) => p.id);
        if (ids.length < 2) return this.refresh({}, { notice: 'Unlock more starter pools in the Starter Laboratory.' });
        return this.refresh({ poolId: next(ids, this.prep.poolId) });
      }
      case 'draft': {
        const ids = [...content.draftRules.values()].filter((r) => draftRuleAvailable(profile, r)).map((r) => r.id);
        return this.refresh({ draftRuleId: next(ids, this.prep.draftRuleId) });
      }
      case 'type': {
        if (this.prep.typeFocus === null) return playSfx(this, 'ui.error', 0.4);
        const types = poolTypes(content, content.starterPools.get(this.prep.poolId)!);
        return this.refresh({ typeFocus: next<TypeName>(types, this.prep.typeFocus) });
      }
      case 'token': {
        const ids: (string | null)[] = [null, ...[...content.prepTokens.values()].filter((t) => tokenAvailable(profile, t)).map((t) => t.id)];
        if (ids.length < 2) return this.refresh({}, { notice: 'Earn achievements or buy licenses to unlock preparation choices.' });
        return this.refresh({ tokenId: next(ids, this.prep.tokenId) });
      }
      case 'mentor': {
        // None, then each unlocked mentor (spec section 15); the summary below tells their story.
        const ids: (string | null)[] = [null, ...availableMentors(profile).map((m) => m.id)];
        return this.refresh({ mentorId: next(ids, this.prep.mentorId) });
      }
      case 'directive':
        // None, then every type: study it this run for bonus Research Points.
        return this.refresh({ directive: next<TypeName | null>([null, ...TYPE_NAMES], this.prep.directive) });
      case 'license':
        // None, then each license: one exploration hint for the whole run.
        return this.refresh({ license: next<LicenseId | null>([null, ...LICENSES.map((l) => l.id)], this.prep.license) });
      case 'loan': {
        const problem = loanProblem(content, profile);
        if (problem) return this.refresh({}, { notice: problem });
        const l = content.balance.bank.loan;
        return this.refresh({ loan: !this.prep.loan }, { notice: this.prep.loan ? undefined : `Loan: +₽${l.money} now; finish with ${l.badges}+ badges or lose ${l.penalty} credits.` });
      }
      case 'vault': {
        if (profile.vault.length === 0) return this.refresh({}, { notice: 'The Collector\'s Vault is empty (Bank tier 5 keeps a rare held item from each finished run).' });
        return this.refresh({ vaultItem: next<string | null>([null, ...new Set(profile.vault)], this.prep.vaultItem) });
      }
      case 'mode': {
        const ids = RUN_RULES.modes.filter((m) => m.status === 'supported').map((m) => m.id);
        return this.refresh({}, { rules: { ...this.rules, modeId: next(ids, this.rules.modeId) } });
      }
      case 'region': {
        if (getMode(this.rules.modeId)?.campaignId !== 'regional-circuit') return playSfx(this, 'ui.error', 0.5);
        const ids = [null, ...[...content.regions.values()].filter((r) => !r.grand).map((r) => r.id)];
        return this.refresh({}, { rules: { ...this.rules, regionId: next<string | null>(ids, this.rules.regionId ?? null) } });
      }
      case 'difficulty': {
        const ids = RUN_RULES.difficulties.map((d) => d.id);
        return this.refresh({}, { rules: { ...this.rules, difficultyId: next(ids, this.rules.difficultyId) } });
      }
      case 'modifier': {
        // ←/→ choose a modifier; Enter turns it on or off.
        this.modCursor = (this.modCursor + step + RUN_RULES.modifiers.length) % RUN_RULES.modifiers.length;
        return this.refresh();
      }
      case 'weeks':
        return this.refresh({}, { rules: { ...this.rules, weeks: this.rules.weeks === false } });
      case 'deathBlock':
        return this.refresh({}, { rules: { ...this.rules, deathBlock: !this.rules.deathBlock } });
      default:
        return;
    }
  }

  private select(row: Row): void {
    switch (row) {
      case 'start':
        return this.start();
      case 'modifier': {
        const m = RUN_RULES.modifiers[this.modCursor]!;
        const on = this.rules.modifierIds.includes(m.id);
        // Turning one on switches off any modifier of the same kind.
        const others = this.rules.modifierIds.filter((id) => id !== m.id && getModifier(id)!.group !== m.group);
        return this.refresh({}, { rules: { ...this.rules, modifierIds: on ? others.filter((id) => id !== m.id) : [...others, m.id] } });
      }
      case 'seed': {
        const value = window.prompt('Seed for this run (leave empty for a random one):', this.seed ?? '');
        if (value === null) return;
        // A friend's ghost code (GH1.…): their seed code plus what they did, shown against your run at the end.
        if (value.trim().startsWith('GH1.')) {
          const ghost = decodeGhostCode(value);
          if (!ghost.ok) return this.refresh({}, { notice: ghost.reason });
          services().session.changeProfile((pr) => keepGhost(pr, ghost.parts.seed, ghost.ghost));
          this.seed = ghost.parts.seed;
          const trainer = services().session.content.archetypes.has(ghost.parts.archetypeId) ? ghost.parts.archetypeId : this.archetypeId;
          this.scene.restart({ archetypeId: trainer, prep: this.prep, seed: this.seed, focus: this.focusIndex, rules: ghost.parts.rules, page: this.page, notice: `Ghost of ${ghost.ghost.from} loaded: race their seed.` } satisfies RunPrepData);
          return;
        }
        // A shared seed code (PR1.…) also sets the trainer and the rules.
        if (value.trim().startsWith('PR1.')) {
          const code = decodeSeedCode(value);
          if (!code.ok) return this.refresh({}, { notice: code.reason });
          this.seed = code.parts.seed;
          const trainer = services().session.content.archetypes.has(code.parts.archetypeId) ? code.parts.archetypeId : this.archetypeId;
          this.scene.restart({ archetypeId: trainer, prep: this.prep, seed: this.seed, focus: this.focusIndex, rules: code.parts.rules, page: this.page, notice: code.note ?? 'Seed code loaded: seed, trainer and rules set.' } satisfies RunPrepData);
          return;
        }
        this.seed = value.trim() || null;
        return this.refresh();
      }
      case 'save':
        return this.openPresets('save');
      case 'load':
        return this.openPresets('load');
      default:
        return this.cycle(row, 1);
    }
  }

  private start(): void {
    const { session } = services();
    let seed = this.seed ?? undefined;
    let rules = this.rules;
    let prep = this.prep;
    let daily: ReturnType<typeof dailySetup> | undefined;
    if (getMode(rules.modeId)?.dailySeed) {
      // Daily Run: the date is the seed; the day's account rewards pay once.
      const today = new Date().toISOString();
      daily = dailySetup(session.content, today, this.prep, rules);
      seed = daily.seed;
      prep = daily.prep;
      const key = dailyClaimKey(today);
      rules = { ...daily.rules, noRewards: isClaimed(session.profile, key) };
      if (!rules.noRewards) session.claimOnce(key);
    }
    if (getMode(rules.modeId)?.weeklySeed) {
      // Weekly Gauntlet: the week is the seed; the themed ruleset replaces the menu's; account rewards pay once a week.
      const now = new Date().toISOString();
      const weekly = weeklySetup(session.content, now, this.prep, rules);
      seed = weekly.seed;
      prep = weekly.prep;
      const key = weeklyClaimKey(now);
      rules = { ...weekly.rules, noRewards: isClaimed(session.profile, key) };
      if (!rules.noRewards) session.claimOnce(key);
      daily = weekly;
    }
    session.newRun(this.archetypeId, seed, undefined, prep, rules, daily?.starters);
    this.scene.start('StarterSelect');
  }

  private openPresets(mode: 'save' | 'load'): void {
    const { session } = services();
    const { content } = session;
    const slots = Array.from({ length: presetSlotCount(content, session.profile) }, (_, i) => presetIn(session.profile, i));
    const rows: PickerRow[] = slots.map((preset, i) => ({
      problem: null,
      hint: preset ? presetText(preset) : mode === 'save' ? 'An empty slot.' : 'Nothing saved here yet.',
      draw: (scene, box, _w, h) => {
        box.add(scene.add.text(16, h / 2, preset ? `${i + 1}. ${presetText(preset)}` : `${i + 1}. (empty)`, textStyle(18, preset ? COLORS.text : COLORS.textMuted, { wordWrap: { width: 820 } })).setOrigin(0, 0.5));
      },
    }));
    this.menu.enabled = false;
    this.picker = new Picker(this, {
      title: mode === 'save' ? 'Save this loadout in a slot' : 'Load a loadout',
      rows,
      columns: 1,
      rowHeight: 60,
      onSelect: (i) => {
        if (mode === 'save') {
          session.savePreset(i, { ...this.prep, name: `Preset ${i + 1}`, archetypeId: this.archetypeId });
          return this.refresh({}, { notice: `Saved in preset slot ${i + 1}.` });
        }
        const preset = slots[i];
        if (!preset) return playSfx(this, 'ui.error', 0.5);
        const parts = presetParts(preset);
        this.archetypeId = parts.archetypeId;
        this.scene.restart({ archetypeId: parts.archetypeId, prep: parts.prep, seed: this.seed, focus: 0, notice: `Loaded preset ${i + 1}.` } satisfies RunPrepData);
      },
      onBack: () => {
        this.picker?.close();
        this.picker = null;
        this.menu.enabled = true;
      },
    });
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function presetText(p: LoadoutPreset): string {
  const { content } = services().session;
  const parts = [
    content.archetypes.get(p.archetypeId)?.name ?? p.archetypeId,
    content.campaigns.get(p.campaignId)?.name ?? p.campaignId,
    `${content.starterPools.get(p.poolId)?.name ?? p.poolId} pool`,
    `${content.draftRules.get(p.draftRuleId)?.name ?? p.draftRuleId}${p.typeFocus ? ` (${p.typeFocus})` : ''}`,
    p.tokenId ? (content.prepTokens.get(p.tokenId)?.name ?? p.tokenId) : 'no preparation',
  ];
  return parts.join('  ·  ');
}
