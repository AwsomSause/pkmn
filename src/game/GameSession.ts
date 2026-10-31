// Connects the pure game rules to saving. Screens call these methods; every
// method that changes the run saves it at a safe checkpoint:
//   - after the starter is chosen
//   - after every completed battle turn
//   - after a reward is chosen, a decision is answered, or an item is used
//   - on entering a map node, using a side stop, or buying at a shop
//   - when the run ends (profile first, then the run record is cleared)

import type { Content } from '../core/contentSchema';
import { finalizeRun, recordRunStarted } from '../core/profile';
import { claimTrainer, setActiveTitle, type RunEndSummary } from '../core/progress';
import { setCardFrame, setCryTheme, setMenuArena } from '../core/wardrobe';
import { buyNote } from '../core/researchNotes';
import { makeRandomSeed } from '../core/rng';
import { chooseEvent, type EventResult } from '../core/events';
import { activeGameEvents } from '../core/gameEvents';
import { setMasteryPicks } from '../core/mastery';
import { applyStartGrants } from '../core/legacy';
import { loanProblem, runBankFlags, vaultTake, buyTier, exchange, type ExchangeDirection } from '../core/bank';
import { buyLicense, savePreset, unlockPool } from '../core/runPrep';
import type { PlayerAction } from '../core/battle/engine';
import type { DramaLine } from '../core/drama';
import * as Exp from '../core/expedition/flow';
import * as Mini from '../core/minigame/flow';
import { claim } from '../core/quests';
import { claimCollectionMilestones } from '../core/collection';
import * as Run from '../core/run';
import * as Svc from '../core/services/flow';
import type { RulesChoice } from '../core/rules';
import type { LoadoutPreset, Profile, RunPrep, RunState, Settings } from '../core/state';
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
  /** What the run that just ended paid out and unlocked (for the run-end screen). */
  lastRunSummary: RunEndSummary | null = null;
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

  /**
   * Starts a new run. `campaignId` picks a shorter campaign such as "dev" (default "full");
   * `prep` carries the Preparation Desk's choices (and its campaign) and is remembered for next time.
   */
  newRun(archetypeId: string, seed: string = makeRandomSeed(), campaignId?: string, prep?: RunPrep, rules?: RulesChoice): RunState {
    // A saved preset can name a loan or Vault item the profile no longer has.
    if (prep) prep = { ...prep, loan: prep.loan && !loanProblem(this.content, this.profile), vaultItem: prep.vaultItem && this.profile.vault.includes(prep.vaultItem) ? prep.vaultItem : null };
    this.run = Run.createRun(this.content, { runId: randomId('run'), seed, archetypeId, campaignId, prep, rules, attributes: this.profile.attributes, pastPokemon: this.profile.pastPokemon, rivalArchive: this.profile.rivalArchive, runHistory: this.profile.runHistory, mastery: this.profile.mastery, gameEvents: activeGameEvents(this.content, new Date()).map((a) => a.edition), raidTierUnlocked: this.profile.best.raidBestTier ?? 0, licenses: runBankFlags(this.profile) , ownedTrainers: this.profile.unlockedArchetypes });
    applyStartGrants(this.content, this.run, this.profile);
    this.profile = recordRunStarted(this.profile);
    if (prep?.vaultItem) {
      const profile = structuredClone(this.profile);
      vaultTake(profile, prep.vaultItem);
      this.profile = profile;
    }
    if (prep) this.profile = { ...this.profile, lastPrep: { ...prep, name: 'Last run', archetypeId } };
    this.checkSave(this.saves.saveProfile(this.profile));
    this.persistRun();
    return this.run;
  }

  continueRun(): RunState {
    this.refreshSavedRun();
    if (this.savedRun.status !== 'ok') throw new Error('No saved run to continue');
    this.run = Run.prepareLoadedRun(this.content, this.savedRun.data);
    if (this.run !== this.savedRun.data) this.persistRun();
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

  /** A rival may cut in on a stop; returns the run with the battle started, or null. */
  rivalChallenge(sideId: string): RunState | null {
    const run = Run.rivalChallenge(this.content, this.requireRun(), sideId);
    if (!run) return null;
    this.run = run;
    this.persistRun();
    return run;
  }

  chooseNode(nodeId: string): RunState {
    this.run = Run.chooseNode(this.content, this.requireRun(), nodeId);
    this.persistRun();
    return this.run;
  }

  /** Fishes up one of a fishing spot's Pokémon and starts the battle. */
  fish(sideId: string, index: number): RunState {
    this.run = Run.fish(this.content, this.requireRun(), sideId, index);
    this.persistRun();
    return this.run;
  }

  /** Pays for a raid den and starts the boss fight. */
  enterRaid(sideId: string, approachId?: string): RunState {
    this.run = Run.enterRaid(this.content, this.requireRun(), sideId, approachId);
    this.persistRun();
    return this.run;
  }

  /** Makes a choice at an event ("?") stop; a battle outcome starts the battle. */
  chooseEvent(sideId: string, choiceIndex: number, tradeUid?: string): EventResult {
    const result = chooseEvent(this.content, this.requireRun(), sideId, choiceIndex, tradeUid);
    this.run = result.run;
    this.persistRun();
    return result;
  }

  /** Starts the fight with a Totem. */
  enterTotem(sideId: string): RunState {
    this.run = Run.enterTotem(this.content, this.requireRun(), sideId);
    this.persistRun();
    return this.run;
  }

  /** Opens an expedition from its gate on the map. */
  beginExpedition(sideId: string): RunState {
    return this.setRun(Exp.beginExpedition(this.content, this.requireRun(), sideId));
  }

  chooseExpeditionNode(nodeId: string): RunState {
    return this.setRun(Exp.chooseExpeditionNode(this.content, this.requireRun(), nodeId));
  }

  resolveExpeditionChoice(index: number): RunState {
    return this.setRun(Exp.resolveExpeditionChoice(this.content, this.requireRun(), index));
  }

  /** Reads the result of the last expedition fight (win: next stop or finish; loss: the expedition fails). */
  settleExpedition(): RunState {
    return this.setRun(Exp.settleExpedition(this.content, this.requireRun()));
  }

  extractExpedition(): RunState {
    return this.setRun(Exp.extractExpedition(this.content, this.requireRun()));
  }

  beginMinigame(sideId: string, tier: number): RunState {
    return this.setRun(Mini.beginMinigame(this.content, this.requireRun(), sideId, tier));
  }

  minigameAct(cellId: string): RunState {
    return this.setRun(Mini.minigameAct(this.content, this.requireRun(), cellId));
  }

  minigameTick(): RunState {
    return this.setRun(Mini.minigameTick(this.content, this.requireRun()));
  }

  leaveMinigame(): RunState {
    return this.setRun(Mini.leaveMinigame(this.requireRun()));
  }

  private setRun(run: RunState): RunState {
    this.run = run;
    this.persistRun();
    return run;
  }

  /** Uses a map item from the map's Items menu (Escape Rope, a bike, VS Seeker). */
  useMapAction(kind: Run.MapActionKind): string {
    const result = Run.useMapAction(this.content, this.requireRun(), kind);
    this.run = result.run;
    this.persistRun();
    return result.message;
  }

    visitSide(sideId: string): string {
    const result = Run.visitSide(this.content, this.requireRun(), sideId);
    this.run = result.run;
    this.persistRun();
    return result.message;
  }

  serviceView(sideId: string): Svc.ServiceView {
    return Svc.serviceView(this.content, this.requireRun(), sideId);
  }

  useService(sideId: string, optionId: string): string {
    const result = Svc.useService(this.content, this.requireRun(), sideId, optionId);
    this.run = result.run;
    this.persistRun();
    return result.message;
  }

  buyItem(itemId: string): string {
    const result = Run.buyItem(this.content, this.requireRun(), itemId);
    this.run = result.run;
    this.persistRun();
    return result.message;
  }

  sellItem(itemId: string): string {
    const result = Run.sellItem(this.content, this.requireRun(), itemId);
    this.run = result.run;
    this.persistRun();
    return result.message;
  }

  leaveShop(): void {
    this.run = Run.leaveShop(this.content, this.requireRun());
    this.persistRun();
  }

  /** Battle start: entry abilities (Intimidate, Drizzle), saved so they happen once. */
  beginBattle(): Run.RunEvent[] {
    const result = Run.beginBattle(this.content, this.requireRun());
    if (result.events.length === 0) return [];
    this.run = result.run;
    this.persistRun();
    return result.events;
  }

  /** The trainer's opening line, once per battle. */
  battleOpening(): DramaLine[] {
    const result = Run.battleOpening(this.content, this.requireRun(), this.settings.dialogueFrequency);
    if (result.drama.length === 0) return [];
    this.run = result.run;
    this.persistRun();
    return result.drama;
  }

  takeTurn(action: PlayerAction): Run.TurnResult {
    const result = Run.takeTurn(this.content, this.requireRun(), action, this.settings.dialogueFrequency);
    this.run = result.run;
    this.persistRun();
    if (result.run.phase === 'over') this.finishRun();
    return result;
  }

  chooseReward(index: number, targetIndex = 0): Run.RewardChoiceResult {
    const result = Run.chooseReward(this.content, this.requireRun(), index, targetIndex);
    this.run = result.run;
    this.persistRun();
    if (result.run.phase === 'over') this.finishRun(); // the last champion was beaten
    return result;
  }

  useDraftItem(kind: Run.DraftItemKind, index: number): { run: RunState; message: string } {
    const result = Run.useDraftItem(this.content, this.requireRun(), kind, index);
    this.run = result.run;
    this.persistRun();
    return result;
  }

  resolveDecision(choice: Run.DecisionChoice): Run.DecisionResult {
    const result = Run.resolveDecision(this.content, this.requireRun(), choice);
    this.run = result.run;
    this.persistRun();
    if (result.run.phase === 'over') this.finishRun(); // the last champion was beaten
    return result;
  }

  useItem(itemId: string, partyIndex: number, evolveTo?: string): string {
    const result = Run.useItemOutsideBattle(this.content, this.requireRun(), itemId, partyIndex, evolveTo);
    this.run = result.run;
    this.persistRun();
    return result.message;
  }

  cashIn(itemId: string): string {
    const result = Run.cashInItem(this.content, this.requireRun(), itemId);
    this.run = result.run;
    this.persistRun();
    return result.message;
  }

  depositToBox(partyIndex: number): void {
    this.run = Run.depositToBox(this.content, this.requireRun(), partyIndex);
    this.persistRun();
  }

  withdrawFromBox(boxIndex: number): void {
    this.run = Run.withdrawFromBox(this.content, this.requireRun(), boxIndex);
    this.persistRun();
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
    const { profile, summary } = finalizeRun(this.content, this.profile, run);
    this.profile = profile;
    if (summary) this.lastRunSummary = summary;
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

  /** Claims a trainer in the Trainer Archive (its requirement must be met; may cost Bank Credits). */
  claimTrainer(archetypeId: string): void {
    this.profile = claimTrainer(this.content, this.profile, archetypeId);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  /** Chooses a family's Species Mastery egg moves or ability. */
  setMasteryPicks(family: string, picks: { eggMoves?: string[]; abilitySlot?: number }): void {
    this.profile = setMasteryPicks(this.content, this.profile, family, picks);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  unlockPool(poolId: string): void {
    this.profile = unlockPool(this.content, this.profile, poolId);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  buyLicense(licenseId: string): void {
    this.profile = buyLicense(this.content, this.profile, licenseId);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  /** Changes the profile through one of the Legacy hub systems (core/legacy.ts: Tree, Prestige, Network, training, Seed Shelf) and saves it. */
  changeProfile(change: (profile: Profile) => Profile): void {
    this.profile = change(this.profile);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  /** Buys the next Bank tier. */
  buyBankTier(): void {
    this.profile = buyTier(this.content, this.profile, new Date().toISOString());
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  /** One lot at the Bank's Exchange Counter. */
  exchangeAtBank(dir: ExchangeDirection): void {
    this.profile = exchange(this.content, this.profile, dir);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  /** Records a claim-ledger key (the Daily Run's reward for the day). */
  claimOnce(key: string): void {
    const profile = structuredClone(this.profile);
    if (!claim(profile, key, new Date().toISOString())) return;
    this.profile = profile;
    this.checkSave(this.saves.saveProfile(this.profile));
  }

  /** Research Room: pays every collection milestone reached and not yet paid. Returns what was paid. */
  claimCollections(): { setName: string; pct: number; researchPoints: number }[] {
    const profile = structuredClone(this.profile);
    const paid = claimCollectionMilestones(this.content, profile, new Date().toISOString());
    if (paid.length === 0) return paid;
    this.profile = profile;
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
    return paid;
  }

  /** Buys a Research Room field note with Research Points (throws with the reason when it can't). */
  buyResearchNote(id: string): void {
    this.profile = buyNote(this.content, this.profile, id, new Date().toISOString());
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  savePreset(slot: number, preset: LoadoutPreset): void {
    this.profile = savePreset(this.content, this.profile, slot, preset);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  setActiveTitle(title: string | null): void {
    this.profile = setActiveTitle(this.profile, title);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  setCryTheme(id: string): void {
    this.profile = setCryTheme(this.profile, id);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  setMenuArena(key: string | null): void {
    this.profile = setMenuArena(this.profile, key);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  setCardFrame(id: string): void {
    this.profile = setCardFrame(this.profile, id);
    this.checkSave(this.saves.saveProfile(this.profile));
    this.changed();
  }

  exportSave(): string {
    return this.saves.exportSave();
  }

  /** Replaces the profile and settings with an exported save. Returns a message for the player. */
  importSave(text: string): string {
    const result = this.saves.importSave(text);
    if (!result.ok) return `Import failed: ${result.reason}`;
    this.profile = result.profile;
    if (result.settings) this.settings = result.settings;
    this.changed();
    return `Save imported.${result.backup ? ' Your previous profile was kept as a backup.' : ''}`;
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

  debugJumpToColumn(column: number): void {
    this.run = Run.debugJumpToColumn(this.requireRun(), column);
    this.persistRun();
  }

  debugJumpToLeague(): void {
    this.run = Run.debugJumpToLeague(this.content, this.requireRun());
    this.persistRun();
  }

  debugHeal(): void {
    this.run = Run.debugHealParty(this.content, this.requireRun());
    this.persistRun();
  }
}
