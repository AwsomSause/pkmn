// The Out-of-Run hub (GAME_DESIGN.md §14.1): start a run, or visit the Bank
// (and its licenses), Trainer Archive, Achievement Hall, Starter Laboratory,
// Run History and save data. Everything
// here reads and changes the permanent profile only.

import Phaser from 'phaser';
import { ACHIEVEMENT_CATEGORIES, type Achievement, type Archetype } from '../core/contentSchema';
import { claimProblem, requirementProgress, trainerStatus, type TrainerStatus } from '../core/progress';
import { eligibleSpecies, licenseProblem, licenseStatus, poolProblem, poolStatus, type LicenseStatus, type PoolStatus } from '../core/runPrep';
import type { RunRecord } from '../core/state';
import { services } from '../game/services';
import { playMusic, playSfx } from '../ui/audio';
import { onInputAction } from '../ui/input';
import { Picker, type PickerRow } from '../ui/partyPanel';
import { pokemonIcon, trainerVisual } from '../ui/sprites';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, textStyle } from '../ui/theme';
import { drawPanel, Menu } from '../ui/widgets';

type Room = 'run' | 'archive' | 'achievements' | 'bank' | 'lab' | 'history' | 'save' | 'back';

const ROOMS: { room: Room; label: string; blurb: string }[] = [
  { room: 'run', label: 'Start a run', blurb: 'Choose a trainer and a starter, then set off.' },
  { room: 'archive', label: 'Trainer Archive', blurb: 'Every trainer, what they change, and how to unlock them.' },
  { room: 'achievements', label: 'Achievement Hall', blurb: 'Milestones and their rewards. Progress counts automatically.' },
  { room: 'bank', label: 'Bank', blurb: 'Your permanent currencies, what your last run paid, and licenses to buy (Enter).' },
  { room: 'lab', label: 'Starter Laboratory', blurb: 'Starter pools to unlock with Research Points (Enter).' },
  { room: 'history', label: 'Run History', blurb: 'Your recent runs: how far they got and what ended them.' },
  { room: 'save', label: 'Save data', blurb: 'Export your profile to a file, or import one.' },
  { room: 'back', label: 'Back to title', blurb: '' },
];

const STATUS_LABEL: Record<TrainerStatus, string> = {
  unlocked: 'Unlocked',
  claimable: 'Ready to claim',
  locked: 'Locked',
  comingLater: 'Coming later',
};

const POOL_LABEL: Record<PoolStatus, string> = {
  unlocked: 'Unlocked',
  buyable: 'Ready to unlock',
  needsLicense: 'Needs a license',
  locked: 'Locked',
  comingLater: 'Arrives with the full Pokédex',
};

const LICENSE_LABEL: Record<LicenseStatus, string> = { owned: 'Owned', buyable: 'For sale', locked: 'Locked' };

const CATEGORY_LABEL: Record<(typeof ACHIEVEMENT_CATEGORIES)[number], string> = {
  campaign: 'Campaign',
  collection: 'Collection',
  battle: 'Battle',
  exploration: 'Exploration',
  economy: 'Economy',
  roguelike: 'Roguelike',
  relationship: 'Relationship',
  secret: 'Secret',
  endgame: 'Endgame',
};

export class HubScene extends Phaser.Scene {
  private menu!: Menu;
  private picker: Picker | null = null;
  private detail!: Phaser.GameObjects.Container;

  constructor() {
    super('Hub');
  }

  create(data: { notice?: string; focus?: number } = {}): void {
    const { session } = services();
    session.closeRun();
    this.picker = null;
    playMusic(this, 'bgm.menu');

    const p = session.profile;
    drawPanel(this, 8, 6, GAME_WIDTH - 16, 64, { fill: COLORS.panelDark, border: 0x101420 });
    this.add.text(24, 12, 'The Hub', textStyle(30, COLORS.textLight));
    this.add.text(26, 46, p.activeTitle ? `Title: ${p.activeTitle}` : 'Prepare for your next run', textStyle(16, '#c8d0e0'));
    this.add
      .text(GAME_WIDTH - 24, 16, `Bank Credits ${p.bankCredits}  ·  Research ${p.researchPoints}  ·  Candies ${p.candies}`, textStyle(20, COLORS.textLight))
      .setOrigin(1, 0);
    const earned = Object.keys(p.achievements).length;
    this.add
      .text(GAME_WIDTH - 24, 46, `Achievements ${earned}/${session.content.achievements.size}  ·  Runs ${p.stats.runsEnded}`, textStyle(16, '#c8d0e0'))
      .setOrigin(1, 0);

    drawPanel(this, 16, 82, 300, 400);
    drawPanel(this, 330, 82, GAME_WIDTH - 346, 400, { fill: COLORS.panelDark, border: 0x101420 });
    this.detail = this.add.container(0, 0);

    const ready = [...session.content.archetypes.values()].filter((a) => trainerStatus(p, a) === 'claimable').length;
    this.menu = new Menu(this, {
      x: 52,
      y: 104,
      options: ROOMS.map((r) => ({ label: r.room === 'archive' && ready > 0 ? `${r.label} (${ready}!)` : r.label })),
      itemHeight: 46,
      fontSize: 24,
      onFocus: (i) => this.showDetail(ROOMS[i]!.room),
      onSelect: (i) => this.enter(ROOMS[i]!.room),
      onBack: () => this.scene.start('MainMenu'),
    });

    const notice = this.add.text(GAME_WIDTH / 2, 500, data.notice ?? '', textStyle(18, '#f0e0a0', { align: 'center', wordWrap: { width: GAME_WIDTH - 60 } })).setOrigin(0.5, 0);
    void notice;
    this.add.text(16, GAME_HEIGHT - 22, 'Arrows: move  ·  Enter: select  ·  Esc: back', textStyle(14, '#5a6680'));

    const focus = Math.min(data.focus ?? 0, ROOMS.length - 1);
    this.menu.focus(focus, false);
    this.showDetail(ROOMS[focus]!.room);

    onInputAction(this, (a) => {
      if (this.picker) this.picker.handle(a);
      else this.menu.handle(a);
    });
  }

  private focusIndex(room: Room): number {
    return ROOMS.findIndex((r) => r.room === room);
  }

  private restart(notice: string | undefined, room: Room): void {
    this.scene.restart({ notice, focus: this.focusIndex(room) });
  }

  // ---------- the panel on the right ----------

  private line(y: number, text: string, size = 18, color: string = COLORS.textLight): number {
    const t = this.add.text(350, y, text, textStyle(size, color, { wordWrap: { width: GAME_WIDTH - 390 } }));
    this.detail.add(t);
    return y + t.height + 6;
  }

  private showDetail(room: Room): void {
    this.detail.removeAll(true);
    const { session } = services();
    const p = session.profile;
    const info = ROOMS.find((r) => r.room === room)!;
    let y = this.line(96, info.label, 26);
    if (info.blurb) y = this.line(y, info.blurb, 17, '#c8d0e0') + 8;
    switch (room) {
      case 'bank': {
        y = this.line(y, `Bank Credits: ${p.bankCredits}   (earned in total: ${p.lifetimeBankCredits})`);
        y = this.line(y, `Research Points: ${p.researchPoints}`);
        y = this.line(y, `Candies: ${p.candies}`);
        y += 8;
        const last = p.lastPayout;
        if (last) {
          y = this.line(y, 'Last run paid:', 18, '#f0e0a0');
          y = this.line(y, `  Savings (leftover Poké Dollars): ${last.savings}`, 17);
          y = this.line(y, `  Stipend (progress): ${last.stipend}`, 17);
          y = this.line(y, `  Achievements: ${last.achievements}`, 17);
          y = this.line(y, `  Total: ${last.total} Bank Credits`, 17);
        } else {
          y = this.line(y, 'No runs paid out yet.', 17, '#c8d0e0');
        }
        const bank = session.content.balance.bank;
        y += 8;
        this.line(
          y,
          `At the end of every run, ${Math.round(bank.moneyConversionRate * 100)}% of your leftover Poké Dollars becomes Bank Credits, plus a stipend for encounters, badges, Elite Four, champions and regions, even if the run is lost. Spend credits on trainers in the Trainer Archive and on licenses here. Licenses: ${p.licenses.length} of ${session.content.licenses.size} owned.`,
          15,
          '#a0aac0',
        );
        break;
      }
      case 'archive': {
        const all = [...session.content.archetypes.values()];
        for (const a of all) y = this.line(y, `${a.name}  ·  ${STATUS_LABEL[trainerStatus(p, a)]}`, 18);
        break;
      }
      case 'lab': {
        y = this.line(y, `Research Points: ${p.researchPoints}`);
        for (const pool of session.content.starterPools.values()) y = this.line(y, `${pool.name}  ·  ${POOL_LABEL[poolStatus(session.content, p, pool)]}`, 18);
        break;
      }
      case 'achievements': {
        const earned = Object.keys(p.achievements).length;
        y = this.line(y, `${earned} of ${session.content.achievements.size} earned`);
        if (p.titles.length > 0) y = this.line(y, `Titles: ${p.titles.join(', ')}`, 17);
        break;
      }
      case 'history': {
        const runs = p.runHistory.slice(0, 5);
        if (runs.length === 0) y = this.line(y, 'No finished runs yet.', 17, '#c8d0e0');
        for (const r of runs) y = this.line(y, historyLine(r), 16);
        break;
      }
      case 'run': {
        y = this.line(y, `Trainers unlocked: ${[...session.content.archetypes.values()].filter((a) => trainerStatus(p, a) === 'unlocked').length}`);
        if (session.savedRun.status === 'ok') this.line(y, 'You have a run in progress: starting a new one replaces it.', 16, '#f0b0a0');
        break;
      }
      default:
        break;
    }
  }

  // ---------- rooms ----------

  private enter(room: Room): void {
    switch (room) {
      case 'run':
        this.scene.start('TrainerSelect');
        break;
      case 'archive':
        this.openArchive();
        break;
      case 'achievements':
        this.openAchievements();
        break;
      case 'bank':
        this.openLicenses();
        break;
      case 'lab':
        this.openLab();
        break;
      case 'history':
        this.openHistory();
        break;
      case 'save':
        this.openSaveData();
        break;
      case 'back':
        this.scene.start('MainMenu');
        break;
    }
  }

  private openPicker(config: ConstructorParameters<typeof Picker>[1]): void {
    this.menu.enabled = false;
    this.picker = new Picker(this, config);
  }

  private closePicker(): void {
    this.picker?.close();
    this.picker = null;
    this.menu.enabled = true;
  }

  private openArchive(): void {
    const { session } = services();
    const p = session.profile;
    const trainers = [...session.content.archetypes.values()];
    const rows: PickerRow[] = trainers.map((a) => {
      const status = trainerStatus(p, a);
      const problem = status === 'claimable' ? claimProblem(p, a) : null;
      return {
        problem: status === 'claimable' ? problem : null,
        hint: archiveHint(a, status, p.bankCredits),
        draw: (scene, box, w, h) => {
          box.add(trainerVisual(scene, a.spriteAssetId, a.name, 34, h / 2 + 4, 0.7));
          box.add(scene.add.text(76, 8, `${a.name}  ${a.title}`, textStyle(20)));
          const color = status === 'unlocked' ? COLORS.good : status === 'claimable' ? '#c07010' : COLORS.textMuted;
          box.add(scene.add.text(76, 34, STATUS_LABEL[status] + (status === 'claimable' && a.unlockCost ? `  ·  ${a.unlockCost} credits` : ''), textStyle(16, color)));
          if (a.unlock && status !== 'unlocked') {
            const prog = requirementProgress(p, a.unlock);
            box.add(scene.add.text(w - 12, h / 2, `${prog.current}/${prog.target}`, textStyle(18, COLORS.textMuted)).setOrigin(1, 0.5));
          }
        },
      };
    });
    this.openPicker({
      title: 'Trainer Archive',
      rows,
      columns: 2,
      rowHeight: 62,
      onSelect: (i) => {
        const a = trainers[i]!;
        if (trainerStatus(session.profile, a) !== 'claimable') {
          playSfx(this, 'ui.error', 0.5);
          return;
        }
        session.claimTrainer(a.id);
        playSfx(this, 'se.level_up', 0.6);
        this.restart(`${a.name} joined your Trainer Archive! Choose them when you start a run.`, 'archive');
      },
      onBack: () => this.closePicker(),
    });
  }

  private openLicenses(): void {
    const { session } = services();
    const p = session.profile;
    const licenses = [...session.content.licenses.values()];
    const rows: PickerRow[] = licenses.map((l) => {
      const status = licenseStatus(p, l);
      return {
        problem: null,
        hint: status === 'owned' ? l.description : `${l.description}  ·  ${licenseProblem(p, l) ?? `Enter: buy for ${l.cost} Bank Credits.`}`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, l.name, textStyle(20)));
          const color = status === 'owned' ? COLORS.good : COLORS.textMuted;
          box.add(scene.add.text(12, 32, LICENSE_LABEL[status], textStyle(15, color)));
          if (status !== 'owned') box.add(scene.add.text(w - 12, h / 2, `${l.cost} credits`, textStyle(18, COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    this.openPicker({
      title: `Bank licenses  ·  ${p.bankCredits} Bank Credits`,
      rows,
      columns: 1,
      rowHeight: 60,
      onSelect: (i) => {
        const l = licenses[i]!;
        if (licenseProblem(session.profile, l)) {
          playSfx(this, 'ui.error', 0.5);
          return;
        }
        session.buyLicense(l.id);
        playSfx(this, 'se.exp', 0.6);
        this.restart(`You bought the ${l.name}. ${l.description}`, 'bank');
      },
      onBack: () => this.closePicker(),
    });
  }

  private openLab(): void {
    const { session } = services();
    const p = session.profile;
    const content = session.content;
    const pools = [...content.starterPools.values()];
    const rows: PickerRow[] = pools.map((pool) => {
      const status = poolStatus(content, p, pool);
      const species = eligibleSpecies(content, pool);
      const problem = status === 'unlocked' ? null : poolProblem(content, p, pool);
      return {
        problem: null,
        hint: `${pool.description}  ·  ${status === 'buyable' && !problem ? `Enter: unlock for ${pool.researchCost} Research Points.` : (problem ?? `${species.length} species.`)}`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, `${pool.name}  ·  ${POOL_LABEL[status]}`, textStyle(19, status === 'unlocked' ? COLORS.good : COLORS.text)));
          species.slice(0, 10).forEach((id, i) => box.add(pokemonIcon(scene, content.species.get(id)!, 24 + i * 40, h - 16, 0.75)));
          if (status !== 'unlocked' && pool.researchCost) box.add(scene.add.text(w - 12, 16, `${pool.researchCost} RP`, textStyle(17, COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    this.openPicker({
      title: `Starter Laboratory  ·  ${p.researchPoints} Research Points`,
      rows,
      columns: 1,
      rowHeight: 64,
      onSelect: (i) => {
        const pool = pools[i]!;
        if (poolProblem(content, session.profile, pool)) {
          playSfx(this, 'ui.error', 0.5);
          return;
        }
        session.unlockPool(pool.id);
        playSfx(this, 'se.level_up', 0.6);
        this.restart(`The ${pool.name} pool is unlocked. Choose it on the Preparation Desk.`, 'lab');
      },
      onBack: () => this.closePicker(),
    });
  }

  private openAchievements(): void {
    const { session } = services();
    const p = session.profile;
    const order = (a: Achievement) => ACHIEVEMENT_CATEGORIES.indexOf(a.category);
    const list = [...session.content.achievements.values()].sort((a, b) => order(a) - order(b));
    const rows: PickerRow[] = list.map((a) => {
      const earned = p.achievements[a.id];
      const secret = a.hidden && !earned;
      const prog = requirementProgress(p, a.requirement);
      return {
        problem: null,
        hint: secret ? 'A hidden achievement. Keep playing to find out what it is.' : `${a.description}  ·  Reward: ${rewardText(a)}${earned ? `  ·  Earned ${earned.earnedAt.slice(0, 10)}` : ''}`,
        draw: (scene, box, w, h) => {
          box.add(scene.add.text(12, 6, secret ? '???' : a.name, textStyle(19, earned ? COLORS.good : COLORS.text)));
          box.add(scene.add.text(12, 30, CATEGORY_LABEL[a.category], textStyle(14, COLORS.textMuted)));
          box.add(scene.add.text(w - 12, h / 2, earned ? '✓' : secret ? '' : `${prog.current}/${prog.target}`, textStyle(earned ? 26 : 17, earned ? COLORS.good : COLORS.textMuted)).setOrigin(1, 0.5));
        },
      };
    });
    const titles = p.titles;
    this.openPicker({
      title: `Achievement Hall  ·  ${Object.keys(p.achievements).length}/${list.length}`,
      rows,
      columns: 2,
      rowHeight: 52,
      onSelect: () => {
        // Selecting cycles the title on show through the earned titles.
        if (titles.length === 0) return;
        const next = p.activeTitle === null ? titles[0]! : titles[titles.indexOf(p.activeTitle) + 1] ?? null;
        session.setActiveTitle(next);
        this.restart(next ? `Now showing the title "${next}".` : 'No title on show.', 'achievements');
      },
      onBack: () => this.closePicker(),
    });
  }

  private openHistory(): void {
    const { session } = services();
    const runs = session.profile.runHistory;
    const rows: PickerRow[] = runs.map((r) => ({
      problem: null,
      hint: `Seed ${r.seed}  ·  ${r.encounters} encounters  ·  ${r.badges} badges  ·  +${r.bankCredits} credits, +${r.researchPoints} research${r.achievements.length ? `  ·  ${r.achievements.length} achievements` : ''}`,
      draw: (scene, box, w, h) => {
        box.add(scene.add.text(12, 6, historyLine(r), textStyle(17)));
        r.party.slice(0, 6).forEach((m, i) => {
          const species = session.content.species.get(m.speciesId);
          if (species) box.add(pokemonIcon(scene, species, 24 + i * 44, h - 16, 0.8));
        });
        box.add(scene.add.text(w - 12, h - 18, r.endedAt.slice(0, 10), textStyle(14, COLORS.textMuted)).setOrigin(1, 0.5));
      },
    }));
    this.openPicker({ title: 'Run History', rows, columns: 1, rowHeight: 64, onSelect: () => undefined, onBack: () => this.closePicker() });
  }

  private openSaveData(): void {
    const { session } = services();
    const rows: PickerRow[] = [
      { problem: null, hint: 'Downloads your profile and settings as a .json file.', draw: (scene, box, _w, h) => void box.add(scene.add.text(16, h / 2, 'Export save to a file', textStyle(22)).setOrigin(0, 0.5)) },
      { problem: null, hint: 'Replaces your profile with one from a file. Your current profile is kept as a backup.', draw: (scene, box, _w, h) => void box.add(scene.add.text(16, h / 2, 'Import save from a file', textStyle(22)).setOrigin(0, 0.5)) },
    ];
    this.openPicker({
      title: 'Save data',
      rows,
      columns: 1,
      rowHeight: 56,
      onSelect: (i) => {
        if (i === 0) {
          downloadText(`pkmn-save-${new Date().toISOString().slice(0, 10)}.json`, session.exportSave());
          this.restart('Save exported.', 'save');
        } else {
          pickTextFile((text) => this.restart(session.importSave(text), 'save'));
        }
      },
      onBack: () => this.closePicker(),
    });
  }
}

function historyLine(r: RunRecord): string {
  const { content } = services().session;
  const trainer = content.archetypes.get(r.archetypeId)?.name ?? r.archetypeId;
  const how = r.victory
    ? 'Victory!'
    : r.defeatedBy
      ? `Lost to ${r.defeatedBy.trainer ? `${r.defeatedBy.trainer}'s ` : ''}${content.species.get(r.defeatedBy.speciesId)?.name ?? r.defeatedBy.speciesId} (Lv${r.defeatedBy.level})`
      : 'Ended';
  return `${trainer}  ·  ${r.regionsCleared}/${r.regions} regions  ·  ${how}${r.campaignId !== 'full' ? `  ·  ${r.campaignId}` : ''}`;
}

function rewardText(a: Achievement): string {
  const parts: string[] = [];
  if (a.reward.bankCredits) parts.push(`${a.reward.bankCredits} credits`);
  if (a.reward.researchPoints) parts.push(`${a.reward.researchPoints} research`);
  if (a.reward.candies) parts.push(`${a.reward.candies} candies`);
  if (a.reward.title) parts.push(`title "${a.reward.title}"`);
  return parts.join(', ') || 'bragging rights';
}

function archiveHint(a: Archetype, status: TrainerStatus, credits: number): string {
  const effects = [...a.pros.map((x) => `+ ${x}`), ...a.cons.map((x) => `− ${x}`)].join('  ');
  if (status === 'unlocked') return `${a.description}  ${effects}`;
  if (status === 'comingLater') return `${a.description} Arrives in a later update. Unlock: ${a.unlockText}.`;
  if (status === 'claimable') return `Enter: claim for ${a.unlockCost} Bank Credits (you have ${credits}).  ${effects}`;
  return `Unlock: ${a.unlockText}${a.unlockCost ? `, then ${a.unlockCost} Bank Credits` : ''}.  ${effects}`;
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pickTextFile(onText: (text: string) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void file.text().then(onText);
  };
  input.click();
}
