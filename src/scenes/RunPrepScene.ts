// The Preparation Desk (GAME_DESIGN.md §14.7): after choosing a trainer, pick
// the campaign, starter pool, draft rule and one preparation, check the Run
// Build Summary, save or load a loadout preset, then roll the starters.

import { presetSlotCount } from '../core/bank';
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
import type { LoadoutPreset, RunPrep } from '../core/state';
import { services } from '../game/services';
import { playSfx } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { drawPanel, Menu } from '../ui/widgets';
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
}

type Row = 'start' | 'trainer' | 'campaign' | 'pool' | 'draft' | 'type' | 'token' | 'directive' | 'license' | 'mode' | 'difficulty' | 'modifier' | 'deathBlock' | 'seed' | 'save' | 'load';
const ROWS: Row[] = ['start', 'trainer', 'campaign', 'pool', 'draft', 'type', 'token', 'directive', 'license', 'mode', 'difficulty', 'modifier', 'deathBlock', 'seed', 'save', 'load'];

export class RunPrepScene extends Phaser.Scene {
  private menu!: Menu;
  private picker: Picker | null = null;
  private focusIndex = 0;
  private archetypeId = '';
  private prep!: RunPrep;
  private seed: string | null = null;
  private rules: RulesChoice = STANDARD_CHOICE;
  private modCursor = 0;

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

    this.add.text(GAME_WIDTH / 2, 26, 'Preparation Desk', textStyle(36, COLORS.textLight)).setOrigin(0.5);
    drawPanel(this, 16, 56, 400, 420);
    drawPanel(this, 430, 56, GAME_WIDTH - 446, 420, { fill: COLORS.panelDark, border: COLORS.borderMuted, thin: true });

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
      mode: `Mode: ${getMode(this.rules.modeId)?.name}`,
      difficulty: `Difficulty: ${getDifficulty(this.rules.difficultyId)?.name}`,
      modifier: `◂ ${RUN_RULES.modifiers[this.modCursor]?.name} ▸ ${this.rules.modifierIds.includes(RUN_RULES.modifiers[this.modCursor]!.id) ? 'ON' : 'off'}`,
      deathBlock: `Death-Block: ${this.rules.deathBlock ? 'on' : 'off'}`,
      seed: `Seed: ${this.seed ?? 'random'}`,
      save: 'Save as preset…',
      load: 'Load a preset…',
    };
    this.menu = new Menu(this, {
      x: 40,
      y: 72,
      options: ROWS.map((r) => ({ label: labels[r], disabled: r === 'type' && rule.kind !== 'typeFocus' })),
      itemHeight: 26,
      fontSize: 18,
      onFocus: (i) => (this.focusIndex = i),
      onSelect: (i) => this.select(ROWS[i]!),
      onBack: () => this.scene.start('TrainerSelect'),
    });

    // The Run Build Summary on the right.
    let y = 70;
    const line = (text: string, size = 18, color: string = COLORS.textLight) => {
      const t = this.add.text(450, y, text, textStyle(size, color, { wordWrap: { width: GAME_WIDTH - 486 } }));
      y += t.height + 5;
    };
    line('Run Build Summary', 24);
    for (const l of buildSummary(content, this.archetypeId, this.prep, profile.attributes)) line(l, 17, l.startsWith('  −') ? '#f0a0a0' : l.startsWith('  +') ? '#a0e0a0' : COLORS.textLight);
    y += 6;
    for (const l of rulesLines(this.rules)) line(l, 15, '#c8e0f0');
    y += 6;
    line(`${rule.description}`, 15, '#d8d0e0');
    const locked = [
      ...[...content.draftRules.values()].filter((r) => !draftRuleAvailable(profile, r)).map((r) => `${r.name} (needs the ${content.licenses.get(r.license!)?.name})`),
      ...[...content.prepTokens.values()].filter((t) => !tokenAvailable(profile, t)).map((t) => `${t.name} (${tokenLockText(content, t)})`),
    ];
    if (locked.length > 0) {
      y += 4;
      line(`Not yet available: ${locked.join(', ')}.`, 14, '#a69cb4');
    }

    this.add.text(GAME_WIDTH / 2, 484, notice, textStyle(16, '#f0e0a0', { align: 'center', wordWrap: { width: GAME_WIDTH - 60 } })).setOrigin(0.5, 0);
    this.add.text(16, GAME_HEIGHT - 22, '↑/↓ choose  ·  ←/→ change  ·  Enter select  ·  Esc back to trainers', textStyle(14, '#8a7f96'));

    this.focusIndex = Math.min(data.focus ?? 0, ROWS.length - 1);
    this.menu.focus(this.focusIndex, false);

    onInputAction(this, (a) => {
      if (this.picker) return this.picker.handle(a);
      if (a === 'left' || a === 'right') return this.cycle(ROWS[this.focusIndex]!, a === 'right' ? 1 : -1);
      this.menu.handle(a);
    });
  }

  private refresh(changes: Partial<RunPrep> = {}, extra: Partial<RunPrepData> = {}): void {
    this.scene.restart({ archetypeId: this.archetypeId, prep: { ...this.prep, ...changes }, seed: this.seed, focus: this.focusIndex, rules: this.rules, modCursor: this.modCursor, ...extra } satisfies RunPrepData);
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
      case 'directive':
        // None, then every type: study it this run for bonus Research Points.
        return this.refresh({ directive: next<TypeName | null>([null, ...TYPE_NAMES], this.prep.directive) });
      case 'license':
        // None, then each license: one exploration hint for the whole run.
        return this.refresh({ license: next<LicenseId | null>([null, ...LICENSES.map((l) => l.id)], this.prep.license) });
      case 'mode': {
        const ids = RUN_RULES.modes.filter((m) => m.status === 'supported').map((m) => m.id);
        return this.refresh({}, { rules: { ...this.rules, modeId: next(ids, this.rules.modeId) } });
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
        // A shared seed code (PR1.…) also sets the trainer and the rules.
        if (value.trim().startsWith('PR1.')) {
          const code = decodeSeedCode(value);
          if (!code.ok) return this.refresh({}, { notice: code.reason });
          this.seed = code.parts.seed;
          const trainer = services().session.content.archetypes.has(code.parts.archetypeId) ? code.parts.archetypeId : this.archetypeId;
          this.scene.restart({ archetypeId: trainer, prep: this.prep, seed: this.seed, focus: this.focusIndex, rules: code.parts.rules, notice: code.note ?? 'Seed code loaded: seed, trainer and rules set.' } satisfies RunPrepData);
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
    if (getMode(rules.modeId)?.dailySeed) {
      // Daily Run: the date is the seed; the day's account rewards pay once.
      const today = new Date().toISOString();
      seed = dailySeed(today);
      const key = dailyClaimKey(today);
      rules = { ...rules, noRewards: isClaimed(session.profile, key) };
      if (!rules.noRewards) session.claimOnce(key);
    }
    session.newRun(this.archetypeId, seed, undefined, this.prep, rules);
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
