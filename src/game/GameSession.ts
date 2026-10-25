// Connects the pure game rules to saving. Screens call these methods; every
// method that changes the run saves it at a safe checkpoint:
//   - after the starter is chosen
//   - after every completed battle turn
//   - after a reward is chosen, a decision is answered, or an item is used
//   - when the run ends (profile first, then the run record is cleared)

import type { Content } from '../core/contentSchema';
import { finalizeRun, recordRunStarted } from '../core/profile';
import { makeRandomSeed } from '../core/rng';
import type { PlayerAction } from '../core/battle/engine';
import * as Run from '../core/run';
import type { Profile, RunState, Settings } from '../core/state';
import { SaveManager, type LoadResult } from '../save/saveManager';
import type { StorageProvider } from '../save/storage';

function randomId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export class GameSession {
  readonly saves: SaveManager;
  profile: Profile;
  settings: Settings;
  run: RunState | null = null;
  /** The saved run found at startup (or why it couldn't be loaded). */
  savedRun: LoadResult<RunState>;
  /** Most recent save failure, shown to the player. Null when saving works. */
  lastSaveError: string | null = null;
  readonly warnings: string[] = [];
  private listeners = new Set<() => void>();

  constructor(readonly content: Content, storage: StorageProvider) {
    this.saves = new SaveManager(storage, content);
    const { profile, warning } = this.saves.loadOrCreateProfile(() => randomId('profile'));
    this.profile = profile;
    if (warning) this.warnings.push(warning);
    this.settings = this.saves.loadSettings();
    this.savedRun = this.saves.loadRun();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }

  private checkSave(result: { ok: true } | { ok: false; reason: string }): void {
    this.lastSaveError = result.ok ? null : result.reason;
  }

  private persistRun(): void {
    if (this.run) this.checkSave(this.saves.saveRun(this.run));
    this.changed();
  }

  /** True when a valid saved run exists and can be continued. */
  get canContinue(): boolean {
    return this.savedRun.status === 'ok';
  }

  refreshSavedRun(): void {
    this.savedRun = this.saves.loadRun();
  }

  newRun(archetypeId: string, seed: string = makeRandomSeed()): RunState {
    this.run = Run.createRun(this.content, { runId: randomId('run'), seed, archetypeId });
    this.profile = recordRunStarted(this.profile);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.persistRun();
    return this.run;
  }

  continueRun(): RunState {
    this.refreshSavedRun();
    if (this.savedRun.status !== 'ok') throw new Error('No saved run to continue');
    this.run = this.savedRun.data;
    if (this.run.phase === 'over') this.finishRun();
    this.changed();
    return this.run;
  }

  /** Keeps a backup copy of a damaged run save, then removes it so a new run can start. */
  discardDamagedRun(): string | null {
    const backup = this.saves.backupCorrupt('run');
    this.refreshSavedRun();
    this.changed();
    return backup;
  }

  private requireRun(): RunState {
    if (!this.run) throw new Error('No active run');
    return this.run;
  }

  chooseStarter(index: number): RunState {
    this.run = Run.chooseStarter(this.content, this.requireRun(), index);
    this.persistRun();
    return this.run;
  }

  takeTurn(action: PlayerAction): Run.TurnResult {
    const result = Run.takeTurn(this.content, this.requireRun(), action);
    this.run = result.run;
    this.persistRun();
    if (result.defeated) this.finishRun();
    return result;
  }

  chooseReward(index: number, targetIndex = 0): Run.RewardChoiceResult {
    const result = Run.chooseReward(this.content, this.requireRun(), index, targetIndex);
    this.run = result.run;
    this.persistRun();
    return result;
  }

  resolveDecision(choice: Run.DecisionChoice): Run.DecisionResult {
    const result = Run.resolveDecision(this.content, this.requireRun(), choice);
    this.run = result.run;
    this.persistRun();
    return result;
  }

  useItem(itemId: string, partyIndex: number): string {
    const result = Run.useItemOutsideBattle(this.content, this.requireRun(), itemId, partyIndex);
    this.run = result.run;
    this.persistRun();
    return result.message;
  }

  setLead(partyIndex: number): void {
    this.run = Run.setLead(this.requireRun(), partyIndex);
    this.persistRun();
  }

  /**
   * Ends the run: applies its results to the profile once (safe to call again
   * after a refresh), saves the profile, then clears the run save.
   */
  finishRun(): void {
    const run = this.requireRun();
    const { profile } = finalizeRun(this.profile, run);
    this.profile = profile;
    const profileSave = this.saves.saveProfile(profile);
    this.checkSave(profileSave);
    if (profileSave.ok) this.checkSave(this.saves.clearRun());
    this.refreshSavedRun();
    this.changed();
  }

  /** Leaves the current run in memory only (used when returning to the menu). */
  closeRun(): void {
    this.run = null;
    this.refreshSavedRun();
    this.changed();
  }

  saveSettings(settings: Settings): void {
    this.settings = settings;
    this.checkSave(this.saves.saveSettings(settings));
    this.changed();
  }

  // ---------- debug helpers ----------

  debugReplaceEnemy(speciesId: string, level: number): void {
    this.run = Run.debugReplaceEnemy(this.content, this.requireRun(), speciesId, level);
    this.persistRun();
  }

  debugAddToParty(speciesId: string, level: number): void {
    this.run = Run.debugAddToParty(this.content, this.requireRun(), speciesId, level);
    this.persistRun();
  }

  debugGiveItem(itemId: string, quantity: number): void {
    this.run = Run.debugGiveItem(this.content, this.requireRun(), itemId, quantity);
    this.persistRun();
  }

  debugHeal(): void {
    this.run = Run.debugHealParty(this.content, this.requireRun());
    this.persistRun();
  }
}
