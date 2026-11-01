// Connects the pure game rules to saving. Screens call these methods; every
// method that changes the run saves it at a safe checkpoint:
//   - after the starter is chosen
//   - after every completed battle turn
//   - after a reward is chosen, a decision is answered, or an item is used
//   - on entering a map node, using a side stop, or buying at a shop
//   - when the run ends (profile first, then the run record is cleared)

import { setCalendar } from '../core/clock';
import type { Achievement, Content } from '../core/contentSchema';
import { finalizeRun, recordRunStarted } from '../core/profile';
import { awardLiveAchievements, claimTrainer, setActiveTitle, type RunEndSummary } from '../core/progress';
import { setCardFrame, setCryTheme, setMenuArena } from '../core/wardrobe';
import { buyNote } from '../core/researchNotes';
import { makeRandomSeed } from '../core/rng';
import { chooseEvent, type EventResult } from '../core/events';
import { activeGameEvents } from '../core/gameEvents';
import { setMasteryPicks } from '../core/mastery';
import { applyStartGrants, startGrants } from '../core/legacy';
import { applyHeirloom, chooseHeirloom, pendingHeirloom, spendHeirloom } from '../core/memories/heirloom';
import { pastDigest } from '../core/memories/past';
import * as Timeline from '../core/timeline/genesis';
import { captureOrigin, timelineOutcome } from '../core/timeline/frontRunner';
import { buyCandyPerk } from '../core/candyShop';
import { loanProblem, runBankFlags, vaultTake, buyTier, exchange, type ExchangeDirection } from '../core/bank';
import { buyLicense, savePreset, unlockPool } from '../core/runPrep';
import type { PlayerAction } from '../core/battle/engine';
import { autoCommands } from '../core/battle/doubles';
import { chooseAutoAction, setStance, type AutoPick, type Stance } from '../core/battle/autoBattle';
import type { DramaLine } from '../core/drama';
import * as Exp from '../core/expedition/flow';
import * as Mini from '../core/minigame/flow';
import { claim } from '../core/quests';
import { claimCollectionMilestones } from '../core/collection';
import * as Run from '../core/run';
import * as PartyLife from '../core/partyLife';
type PartyScene = PartyLife.Scene;
import * as Svc from '../core/services/flow';
import * as Plz from '../core/plaza/flow';
import { availableMentors } from '../core/mentors';
import type { RulesChoice } from '../core/rules';
import type { LoadoutPreset, Profile, RunPrep, RunState, Settings } from '../core/state';
import { SaveManager, SLOTS, readActiveSlot, writeActiveSlot, type LoadResult, type SlotNumber, type SlotPeek } from '../save/saveManager';
import type { StorageProvider } from '../save/storage';

function randomId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export class GameSession {
  /** The save slot in use; its keys hold this session's profile, run and timeline (swapped by `switchSlot`). */
  saves: SaveManager;
  profile: Profile;
  settings: Settings;
  run: RunState | null = null;
  /** The saved run found at startup (or why it couldn't be loaded). */
  savedRun: LoadResult<RunState>;
  /** Most recent save failure, shown to the player. Null when saving works. */
  lastSaveError: string | null = null;
  readonly warnings: string[] = [];
  /** Revisit This Timeline: the genesis of lost runs and every replay's record, saved apart from the profile. */
  timeline: Timeline.TimelineStore;
  /** The saved timeline replay found at startup (or why it couldn't be loaded). Lives in its own slot beside the normal run. */
  savedReplay: LoadResult<RunState>;
  /** What the run that just ended paid out and unlocked (for the run-end screen). */
  lastRunSummary: RunEndSummary | null = null;
  private listeners = new Set<() => void>();

  constructor(readonly content: Content, private readonly storage: StorageProvider, slot: SlotNumber = readActiveSlot(storage)) {
    this.saves = new SaveManager(storage, content, undefined, slot);
    const { profile, warning } = this.saves.loadOrCreateProfile(() => randomId('profile'));
    this.profile = profile;
    if (warning) this.warnings.push(warning);
    this.settings = this.saves.loadSettings();
    this.savedRun = this.saves.loadRun();
    const timeline = this.saves.loadTimeline();
    this.timeline = timeline.store;
    if (timeline.warning) this.warnings.push(timeline.warning);
    this.savedReplay = this.saves.loadReplay();
  }

  get slot(): SlotNumber {
    return this.saves.slot;
  }

  /** What each of the three slots holds (read only; nothing is created). */
  slotPeeks(): SlotPeek[] {
    return SLOTS.map((n) => (n === this.slot ? this.saves : new SaveManager(this.storage, this.content, undefined, n)).peekSlot());
  }

  /** The slot with a run to continue that was saved most recently, or null. */
  latestRunSlot(): SlotNumber | null {
    const live = this.slotPeeks().filter((p) => p.run.status === 'ok');
    live.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
    return live[0]?.slot ?? null;
  }

  /**
   * Moves to another slot: its profile, run and timeline are loaded; nothing is written to any slot but the active-slot
   * marker. Any run in play is already saved (every checkpoint saves), so it is only closed here.
   */
  switchSlot(slot: SlotNumber): void {
    if (slot === this.slot) {
      this.refreshSavedRun();
      return;
    }
    this.run = null;
    this.saves = new SaveManager(this.storage, this.content, undefined, slot);
    const { profile, warning } = this.saves.loadOrCreateProfile(() => randomId('profile'));
    this.profile = profile;
    if (warning) this.warnings.push(warning);
    this.savedRun = this.saves.loadRun();
    const timeline = this.saves.loadTimeline();
    this.timeline = timeline.store;
    if (timeline.warning) this.warnings.push(timeline.warning);
    this.savedReplay = this.saves.loadReplay();
    this.lastRunSummary = null;
    this.toasts = [];
    this.liveSignature = '';
    this.checkSave(writeActiveSlot(this.storage, slot));
    this.changed();
  }

  /** Empties a slot (a copy is kept). Deleting the slot in use leaves a fresh, empty profile in its place. */
  deleteSlot(slot: SlotNumber): { ok: true } | { ok: false; reason: string } {
    const result = new SaveManager(this.storage, this.content, undefined, slot).deleteSlot();
    if (!result.ok) return result;
    if (slot === this.slot) {
      this.run = null;
      this.saves = new SaveManager(this.storage, this.content, undefined, slot);
      this.profile = this.saves.loadOrCreateProfile(() => randomId('profile')).profile;
      this.savedRun = this.saves.loadRun();
      this.timeline = this.saves.loadTimeline().store;
      this.savedReplay = this.saves.loadReplay();
    }
    this.changed();
    return result;
  }

  /** True while the run in play is a replayed timeline (it never changes the profile). */
  get inReplay(): boolean {
    return !!this.run?.timeline;
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

  /** Achievements earned mid-run that no screen has announced yet. */
  private toasts: Achievement[] = [];
  private liveSignature = '';

  /** The achievements earned during the run since the last call (for the toast on the map). */
  takeAchievementToasts(): Achievement[] {
    const out = this.toasts;
    this.toasts = [];
    return out;
  }

  /** Awards achievements as soon as a run's progress meets them; checked only when a counter moved. */
  private checkLiveAchievements(): void {
    const run = this.run;
    if (!run || run.timeline) return;
    const sig = `${run.runId}:${Object.values(run.log.counters).reduce((a, b) => a + b, 0)}:${run.log.speciesCaught.length}:${run.log.speciesSeen.length}:${run.party.length}`;
    if (sig === this.liveSignature) return;
    this.liveSignature = sig;
    const profile = structuredClone(this.profile);
    const earned = awardLiveAchievements(this.content, profile, run, new Date().toISOString());
    if (earned.length === 0) return;
    this.profile = profile;
    this.toasts.push(...earned);
    this.checkSave(this.saves.saveProfile(this.profile));
  }

  private persistRun(): void {
    this.checkLiveAchievements();
    if (this.run) this.checkSave(this.run.timeline ? this.saves.saveReplay(this.run) : this.saves.saveRun(this.run));
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
  newRun(archetypeId: string, seed: string = makeRandomSeed(), campaignId?: string, prep?: RunPrep, rules?: RulesChoice, starterOverride?: string[]): RunState {
    // A saved preset can name a loan or Vault item the profile no longer has.
    if (prep) prep = { ...prep, loan: prep.loan && !loanProblem(this.content, this.profile), vaultItem: prep.vaultItem && this.profile.vault.includes(prep.vaultItem) ? prep.vaultItem : null, mentorId: availableMentors(this.profile).some((m) => m.id === prep!.mentorId) ? prep.mentorId : null };
    const opts = { seed, archetypeId, campaignId, prep, rules, attributes: this.profile.attributes, mastery: this.profile.mastery, gameEvents: rules?.weeks === false ? [] : activeGameEvents(this.content, new Date()).map((a) => a.edition), raidTierUnlocked: this.profile.best.raidBestTier ?? 0, licenses: runBankFlags(this.profile), candyPerks: this.profile.candyPerks, ownedTrainers: this.profile.unlockedArchetypes, mentorBonds: this.profile.mentorBonds };
    this.run = Run.createRun(this.content, { ...opts, runId: randomId('run'), pastPokemon: this.profile.pastPokemon, rivalArchive: this.profile.rivalArchive, runHistory: this.profile.runHistory });
    const grants = startGrants(this.content, this.profile, archetypeId);
    applyStartGrants(this.content, this.run, this.profile);
    // Memories: what earlier runs left behind (ghosts, keepsakes, old friends, the chosen heirloom). Picked from the profile, not rolled.
    this.syncCalendar();
    this.run.past = pastDigest(this.content, this.profile);
    const heirloomUsed = pendingHeirloom(this.profile);
    const heirloom = applyHeirloom(this.content, this.run, this.profile);
    if (heirloom) this.profile = spendHeirloom(this.profile, heirloom.runId);
    // Everything needed to rebuild this run later if it is lost (Revisit This Timeline).
    this.timeline = Timeline.rememberGenesis(this.timeline, Timeline.captureGenesis(this.run, opts, grants, new Date().toISOString(), heirloomUsed));
    this.checkSave(this.saves.saveTimeline(this.timeline));
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
    this.syncCalendar();
    if (this.run !== this.savedRun.data) this.persistRun();
    if (this.run.phase === 'over') this.finishRun();
    this.changed();
    return this.run;
  }

  /** Gives the run today's real-world date (the core reads no clock; camp celebrations on special dates use it). */
  private syncCalendar(): void {
    if (!this.run) return;
    const now = new Date();
    setCalendar(this.run, now.getMonth() + 1, now.getDate());
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
    this.syncCalendar();
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

  plazaView(sideId: string): Plz.PlazaView {
    return Plz.plazaView(this.content, this.requireRun(), sideId);
  }

  plazaSection(sideId: string, section: Plz.PlazaSectionId): Plz.PlazaSectionView {
    return Plz.sectionView(this.content, this.requireRun(), sideId, section);
  }

  usePlaza(sideId: string, section: Plz.PlazaSectionId, optionId: string): Plz.PlazaResult {
    const result = Plz.usePlaza(this.content, this.requireRun(), sideId, section, optionId);
    this.run = result.run;
    this.persistRun();
    return result;
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

  /** Ends an Adventure run from the map. */
  endRunEarly(): void {
    this.run = Run.endRunEarly(this.requireRun());
    this.persistRun();
    this.finishRun();
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

  /**
   * Auto-Battle (spec §32): plays the action the active Pokémon picks by itself. The battle is marked first, so its EXP is
   * reduced for the whole fight (switching back to manual later does not undo it). A pick the engine refuses falls back to a
   * plain move, so a mistake never freezes the battle. Returns null when Auto-Battle can't play this turn.
   */
  takeAutoTurn(): { result: Run.TurnResult; pick: AutoPick } | null {
    const run = this.requireRun();
    const pick = chooseAutoAction(this.content, run);
    if (!pick) return null;
    const marked = structuredClone(run);
    marked.battle!.autoUsed = true;
    const tries: PlayerAction[] = [pick.action];
    if (pick.action.kind === 'move' && (pick.action.transform || pick.action.rally)) tries.push({ kind: 'move', index: pick.action.index });
    if (marked.battle!.doubles) {
      if (!marked.battle!.needsSwitch) tries.push({ kind: 'double', commands: autoCommands({ battle: marked.battle!, party: marked.party, content: this.content }) });
    } else tries.push({ kind: 'move', index: marked.party[marked.battle!.activeIndex]?.moves.findIndex((m) => m.pp > 0) ?? -1 });
    for (const [n, action] of tries.entries()) {
      try {
        const result = Run.takeTurn(this.content, marked, action, this.settings.dialogueFrequency);
        this.run = result.run;
        this.persistRun();
        if (result.run.phase === 'over') this.finishRun();
        return { result, pick: n === 0 ? pick : { ...pick, action, tags: [...pick.tags, 'fallback'] } };
      } catch (err) {
        if (n === tries.length - 1) throw err;
      }
    }
    return null;
  }

  /** Teaches a Pokémon how to fight in Auto-Battle (core/battle/autoBattle.ts). */
  teachStance(uid: string, stance: Stance): void {
    this.run = setStance(this.requireRun(), uid, stance);
    this.persistRun();
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

  /** Party scenes (core/partyLife): the scene waiting on the map, rolled once per transition and saved. */
  ensureScene(): PartyScene | null {
    const current = this.requireRun();
    if (current.partyLife?.scene) return current.partyLife.scene;
    // Browser tests drive the map with key presses a scene would swallow; they put scenes there themselves.
    if (typeof navigator !== 'undefined' && navigator.webdriver) return null;
    const run = structuredClone(current);
    const scene = PartyLife.ensureScene(this.content, run);
    if (run.partyLife.rolledFor !== current.partyLife?.rolledFor) {
      this.run = run;
      this.persistRun();
    }
    return scene;
  }

  resolveScene(choice: number | null): PartyLife.SceneResult | null {
    const run = structuredClone(this.requireRun());
    const result = PartyLife.resolveScene(this.content, run, choice);
    this.run = run;
    this.persistRun();
    return result;
  }

  takeTeamPhoto(): boolean {
    const run = structuredClone(this.requireRun());
    const ok = PartyLife.teamPhoto(this.content, run);
    if (ok) {
      this.run = run;
      this.persistRun();
    }
    return ok;
  }

  /** Rearranges the party: the Pokémon at `from` moves to `to`. */
  moveParty(from: number, to: number): void {
    this.run = Run.moveParty(this.requireRun(), from, to);
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
    if (run.timeline) return this.finishReplay(run);
    // The run's genesis moves onto its legacy record (with how it ended, for a lost run's front-runner): from then on
    // Revisit This Timeline reads it there, and the timeline store only holds runs still in play.
    const g = Timeline.genesisFor(this.timeline, run.runId);
    const genesis = g ? { ...g, origin: run.victory ? null : captureOrigin(this.content, run) } : null;
    const { profile, summary } = finalizeRun(this.content, this.profile, run, undefined, genesis);
    this.profile = profile;
    if (summary) this.lastRunSummary = summary;
    const profileSave = this.saves.saveProfile(profile);
    this.checkSave(profileSave);
    if (profileSave.ok) this.checkSave(this.saves.clearRun());
    if (g && profileSave.ok && profile.legacyRuns.some((r) => r.runId === run.runId && r.genesis)) {
      this.timeline = Timeline.forgetGenesis(this.timeline, run.runId);
      this.checkSave(this.saves.saveTimeline(this.timeline));
    } else if (g && !run.victory) {
      this.timeline = Timeline.attachOrigin(this.timeline, run.runId, captureOrigin(this.content, run));
      this.checkSave(this.saves.saveTimeline(this.timeline));
    }
    this.refreshSavedRun();
    this.changed();
  }

  // ---------- Revisit This Timeline (core/timeline/genesis.ts) ----------

  /** Why this lost run can't be revisited now, or null. */
  replayProblem(originRunId: string): string | null {
    return Timeline.replayProblem(this.timeline, this.profile, originRunId);
  }

  /** Rebuilds a lost run from its genesis and makes it the run in play. The original record is never touched. */
  startReplay(originRunId: string): RunState {
    const { store, run } = Timeline.beginReplay(this.content, this.timeline, this.profile, originRunId, new Date().toISOString());
    this.timeline = store;
    this.checkSave(this.saves.saveTimeline(store));
    this.run = run;
    this.persistRun();
    this.refreshSavedReplay();
    return run;
  }

  refreshSavedReplay(): void {
    this.savedReplay = this.saves.loadReplay();
  }

  get canContinueReplay(): boolean {
    return this.savedReplay.status === 'ok';
  }

  continueReplay(): RunState {
    this.refreshSavedReplay();
    if (this.savedReplay.status !== 'ok') throw new Error('No saved timeline to continue');
    this.run = Run.prepareLoadedRun(this.content, this.savedReplay.data);
    if (this.run !== this.savedReplay.data) this.persistRun();
    if (this.run.phase === 'over') this.finishRun();
    this.changed();
    return this.run;
  }

  /** Walks away from the current timeline: its record says "abandoned", its save is removed, nothing else changes. */
  abandonReplay(): void {
    const saved = this.saves.loadReplay();
    const run = this.run?.timeline ? this.run : saved.status === 'ok' ? saved.data : null;
    const active = Timeline.activeReplay(this.timeline);
    const now = new Date().toISOString();
    if (run) this.timeline = Timeline.endReplay(this.timeline, run, 'abandoned', now);
    // A damaged or missing replay save still frees the slot.
    else if (active) this.timeline = { ...this.timeline, replays: this.timeline.replays.map((r) => (r === active ? { ...r, status: 'abandoned' as const, endedAt: now } : r)) };
    this.checkSave(this.saves.saveTimeline(this.timeline));
    this.checkSave(this.saves.clearReplay());
    if (this.run?.timeline) this.run = null;
    this.refreshSavedReplay();
    this.changed();
  }

  /** A replay ended: its result goes to the timeline store only; the profile and the original run stay as they were. */
  private finishReplay(run: RunState): void {
    this.timeline = Timeline.endReplay(this.timeline, run, 'finished', new Date().toISOString(), timelineOutcome(this.content, run).id);
    this.lastRunSummary = null;
    const saved = this.saves.saveTimeline(this.timeline);
    this.checkSave(saved);
    if (saved.ok) this.checkSave(this.saves.clearReplay());
    this.refreshSavedReplay();
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

  /** Legacy Inheritance Choice: what a past Ace passes on to the next run (changes freely until a run starts with it). */
  pickHeirloom(runId: string, kind: Parameters<typeof chooseHeirloom>[2]): void {
    this.profile = chooseHeirloom(this.profile, runId, kind);
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

  /** Buys a Candy Shop perk. */
  buyCandyPerk(id: string): void {
    this.profile = buyCandyPerk(this.content, this.profile, id);
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
