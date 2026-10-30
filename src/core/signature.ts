// Signature mechanics from Trainers.md ("Rival's Answer", "Distortion Protocol", ...): after a trigger
// (a rival battle, a boss win, ...) the player picks one of a few options. The options are worked out
// once, from the run's state, and stored in a pending decision, so reloading the save shows the same
// choice. A chosen option adds modifiers to `run.perkEffects`, which the perk helpers read like the
// trainer's own. Nothing here rolls a random number.

import type { ArchetypeModifier, Content, StatName, TypeName } from './contentSchema';
import { getSpecies } from './pokemon';
import { isBossClass } from './trainerPerks';
import type { BattleState, PendingDecision, RunState } from './state';

export type SignatureTrigger = 'rivalBattle' | 'bossBattle' | 'thirdBoss' | 'newSpecies';

export interface SignatureOption {
  label: string;
  description: string;
  effects: ArchetypeModifier[];
  grant?: { items?: Record<string, number>; partyLevels?: number };
  temp?: { battles: number; until: 'battle' | 'boss' | 'wild' };
}

interface SignatureDef {
  id: string;
  name: string;
  trigger: SignatureTrigger;
  /** A temporary rule: the next choice replaces this one's effects. */
  temporary?: boolean;
  title: string;
  options(content: Content, run: RunState, battle: BattleState): SignatureOption[];
}

const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The foe team's strongest type (its highest-total member's first type) and highest base stat. */
function foeProfile(content: Content, battle: BattleState): { type: TypeName; stat: StatName } {
  const team = battle.enemyTeam.map((m) => getSpecies(content, m.speciesId));
  const total = (s: { baseStats: Record<StatName, number> }) => Object.values(s.baseStats).reduce((a, b) => a + b, 0);
  const ace = team.reduce((best, s) => (total(s) > total(best) ? s : best), team[0]!);
  const sums = new Map<StatName, number>();
  for (const s of team) for (const [stat, v] of Object.entries(s.baseStats)) sums.set(stat as StatName, (sums.get(stat as StatName) ?? 0) + v);
  const stat = [...sums.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  return { type: ace.types[0]!, stat };
}

const STAT_LABELS: Record<string, string> = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed' };

const DEFS: SignatureDef[] = [
  {
    id: 'rivals-answer',
    name: "Rival's Answer",
    trigger: 'rivalBattle',
    title: "Rival's Answer: choose what you learned from the battle",
    options(content, _run, battle) {
      const { type, stat } = foeProfile(content, battle);
      return [
        { label: `Counter ${capital(type)}`, description: `+10% damage against ${capital(type)}-type foes, rivals and bosses included.`, effects: [{ kind: 'damageVsTypeMultiplier', foeType: type, value: 1.1 }] },
        { label: `Hunt ${STAT_LABELS[stat]} specialists`, description: `Wild Pokémon whose best stat is ${STAT_LABELS[stat]} turn up 25% more often.`, effects: [{ kind: 'statEncounterWeight', stat, value: 1.25 }] },
        { label: 'Take the spoils', description: '+10% money from every battle from now on.', effects: [{ kind: 'moneyMultiplier', value: 1.1 }] },
      ];
    },
  },
  {
    id: 'distortion-protocol',
    name: 'Distortion Protocol',
    trigger: 'bossBattle',
    temporary: true,
    title: 'Distortion Protocol: choose the next rule alteration',
    options() {
      return [
        { label: 'Overclock', description: 'Your team has +15% Speed. The next Elite Four member is 2 levels higher.', effects: [{ kind: 'statMultiplier', stat: 'spe', value: 1.15 }, { kind: 'eliteLevelOffset', value: 2 }] },
        { label: 'Suppress', description: 'Foes cannot heal. The next Elite Four member is 3 levels higher.', effects: [{ kind: 'enemyHealingBlocked' }, { kind: 'eliteLevelOffset', value: 3 }] },
        { label: 'Reckless trade', description: 'Healing is 25% weaker but your Pokémon deal 15% more damage. The next Elite Four member is 2 levels higher.', effects: [{ kind: 'healingMultiplier', value: 0.75 }, { kind: 'damageMultiplier', value: 1.15 }, { kind: 'eliteLevelOffset', value: 2 }] },
      ];
    },
  },
  {
    id: 'perfect-shot',
    name: 'Perfect Shot',
    trigger: 'newSpecies',
    title: 'Perfect Shot: Field Research milestone reached. Choose a reward',
    options() {
      return [
        { label: 'Rare supplies', description: '2 Full Restores and an Ether.', effects: [], grant: { items: { 'full-restore': 2, ether: 1 } } },
        { label: 'Party level boost', description: 'Every Pokémon in your party gains a level.', effects: [], grant: { partyLevels: 1 } },
        { label: 'Damage surge', description: '+20% damage for your next 5 battles.', effects: [{ kind: 'damageMultiplier', value: 1.2 }], temp: { battles: 5, until: 'battle' } },
      ];
    },
  },
  {
    id: 'final-revelation',
    name: 'The Final Revelation',
    trigger: 'thirdBoss',
    title: 'The Final Revelation: an Ancient Relic awakens. Choose one',
    options(_content, run) {
      // Every third boss also makes later bosses hit 10% harder, up to three times.
      const curse = run.perkEffects.filter((m) => m.kind === 'bossDamageTakenMultiplier' && m.value === 1.1).length < 3 ? [{ kind: 'bossDamageTakenMultiplier', value: 1.1 } as ArchetypeModifier] : [];
      return [
        { label: 'Relic of Might', description: '+10% damage for the rest of the run.', effects: [{ kind: 'damageMultiplier', value: 1.1 }, ...curse] },
        { label: 'Relic of Ward', description: '15% less damage from bosses for the rest of the run.', effects: [{ kind: 'bossDamageTakenMultiplier', value: 0.85 }, ...curse] },
        { label: 'Relic of Legends', description: 'Legendary encounters are 30% more common for the rest of the run.', effects: [{ kind: 'encounterWeightMultiplier', group: 'legendary', value: 1.3 }, ...curse] },
      ];
    },
  },
  {
    id: 'meteors-prophecy',
    name: "Meteor's Prophecy",
    trigger: 'thirdBoss',
    title: "Meteor's Prophecy: choose a prophecy",
    options() {
      return [
        { label: 'Omen of Rarity', description: 'The next wild encounter is far more likely to be rare or Legendary.', effects: [{ kind: 'encounterWeightMultiplier', group: 'rare', value: 3 }, { kind: 'encounterWeightMultiplier', group: 'legendary', value: 2 }], temp: { battles: 1, until: 'wild' } },
        { label: 'Dragon Relic', description: 'Dragon-types deal 10% more damage and have 10% more HP for the rest of the run.', effects: [{ kind: 'damageMultiplier', type: 'dragon', value: 1.1 }, { kind: 'statMultiplier', stat: 'hp', type: 'dragon', value: 1.1 }] },
        { label: 'Weaken the next boss', description: 'Your Pokémon deal 20% more and take 15% less damage in the next boss battle.', effects: [{ kind: 'bossDamageMultiplier', value: 1.2 }, { kind: 'bossDamageTakenMultiplier', value: 0.85 }], temp: { battles: 1, until: 'boss' } },
      ];
    },
  },
];

/** Bosses (gym leaders, Elite Four, champions) defeated this run, counting this battle's win. */
function bossesDefeated(run: RunState, battle: BattleState): number {
  const c = run.log.counters;
  return (c.gymLeadersDefeated ?? 0) + (c.eliteFourDefeated ?? 0) + (c.championsDefeated ?? 0) + (isBossClass(battle.trainer?.classId) ? 1 : 0);
}

export function signatureDef(id: string | null | undefined): SignatureDef | undefined {
  return DEFS.find((d) => d.id === id);
}

/** The decisions a won battle triggers for this run's trainer. */
export function signatureDecisions(content: Content, run: RunState, battle: BattleState): PendingDecision[] {
  const archetype = content.archetypes.get(run.archetypeId);
  const def = signatureDef(archetype?.signatureMechanic);
  if (!def || (battle.outcome !== 'win' && !(def.trigger === 'newSpecies' && battle.outcome === 'caught'))) return [];
  if (def.trigger === 'rivalBattle' && !battle.rivalId && !battle.rival) return [];
  if (def.trigger === 'bossBattle' && !isBossClass(battle.trainer?.classId)) return [];
  if (def.trigger === 'thirdBoss' && !(isBossClass(battle.trainer?.classId) && bossesDefeated(run, battle) % 3 === 0)) return [];
  if (def.trigger === 'newSpecies') {
    const caught = battle.enemyTeam[battle.enemyIndex]?.speciesId;
    if (battle.outcome !== 'caught' || !caught || run.log.speciesCaught.at(-1) !== caught || run.log.speciesCaught.length % 3 !== 0) return [];
  }
  return [{ kind: 'signature', mechanicId: def.id, title: def.title, options: def.options(content, run, battle) }];
}

/** Adds the chosen option's modifiers to the run (mutates `run`). Returns the message to show and any items or levels to hand out. */
export function chooseSignatureOption(run: RunState, optionIndex: number): { message: string; grant?: SignatureOption['grant'] } {
  const decision = run.pending[0];
  if (!decision || decision.kind !== 'signature') throw new Error('No signature choice is waiting');
  const option = decision.options[optionIndex];
  if (!option) throw new Error(`Invalid signature choice ${optionIndex}`);
  const def = signatureDef(decision.mechanicId);
  if (def?.temporary) {
    const old = run.signatureApplied[def.id] ?? [];
    run.perkEffects = run.perkEffects.filter((m) => !old.some((o) => JSON.stringify(o) === JSON.stringify(m)));
    run.signatureApplied[def.id] = option.effects;
  }
  run.perkEffects.push(...option.effects);
  if (option.temp && option.effects.length > 0) run.tempEffects.push({ effects: option.effects, battles: option.temp.battles, until: option.temp.until });
  return { message: `${option.label}: ${option.description}`, grant: option.grant };
}
