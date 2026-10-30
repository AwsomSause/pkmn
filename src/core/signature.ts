// Signature mechanics from Trainers.md ("Rival's Answer", "Distortion Protocol", ...): after a trigger
// (a rival battle, a boss win, ...) the player picks one of a few options. The options are worked out
// once, from the run's state, and stored in a pending decision, so reloading the save shows the same
// choice. A chosen option adds modifiers to `run.perkEffects`, which the perk helpers read like the
// trainer's own. Nothing here rolls a random number.

import type { ArchetypeModifier, Content, StatName, TypeName } from './contentSchema';
import { getSpecies } from './pokemon';
import { isBossClass } from './trainerPerks';
import type { BattleState, PendingDecision, RunState } from './state';

export type SignatureTrigger = 'rivalBattle' | 'bossBattle';

export interface SignatureOption {
  label: string;
  description: string;
  effects: ArchetypeModifier[];
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
    id: 'beautiful-parasite',
    name: 'Beautiful Parasite',
    trigger: 'bossBattle',
    title: 'Beautiful Parasite: choose an Assimilation for your team',
    options(_content, run) {
      // Two Assimilations at most; each makes the team take 5% more damage.
      if (assimilations(run) >= 2) return [];
      const cost: ArchetypeModifier = { kind: 'damageTakenMultiplier', value: 1.05 };
      return [
        { label: 'Assimilate Special Attack', description: 'Your team has +10% Special Attack, but takes 5% more damage.', effects: [{ kind: 'statMultiplier', stat: 'spa', value: 1.1 }, cost] },
        { label: 'Assimilate poison', description: 'Your Pokémon poison 25% more often, but take 5% more damage.', effects: [{ kind: 'statusChanceMultiplier', status: 'psn', value: 1.25 }, cost] },
        { label: 'Assimilate Speed', description: 'Your team has +10% Speed, but takes 5% more damage.', effects: [{ kind: 'statMultiplier', stat: 'spe', value: 1.1 }, cost] },
      ];
    },
  },
];

/** Assimilations chosen so far (each one adds a 5% damage-taken cost). */
function assimilations(run: RunState): number {
  return (run.signatureApplied['beautiful-parasite'] ?? []).filter((m) => m.kind === 'damageTakenMultiplier').length;
}

export function signatureDef(id: string | null | undefined): SignatureDef | undefined {
  return DEFS.find((d) => d.id === id);
}

/** The decisions a won battle triggers for this run's trainer. */
export function signatureDecisions(content: Content, run: RunState, battle: BattleState): PendingDecision[] {
  const archetype = content.archetypes.get(run.archetypeId);
  const def = signatureDef(archetype?.signatureMechanic);
  if (!def || battle.outcome !== 'win') return [];
  if (def.trigger === 'rivalBattle' && !battle.rivalId && !battle.rival) return [];
  if (def.trigger === 'bossBattle' && !isBossClass(battle.trainer?.classId)) return [];
  const options = def.options(content, run, battle);
  return options.length === 0 ? [] : [{ kind: 'signature', mechanicId: def.id, title: def.title, options }];
}

/** Adds the chosen option's modifiers to the run (mutates `run`). Returns the message to show. */
export function chooseSignatureOption(run: RunState, optionIndex: number): string {
  const decision = run.pending[0];
  if (!decision || decision.kind !== 'signature') throw new Error('No signature choice is waiting');
  const option = decision.options[optionIndex];
  if (!option) throw new Error(`Invalid signature choice ${optionIndex}`);
  const def = signatureDef(decision.mechanicId);
  if (def?.temporary) {
    const old = run.signatureApplied[def.id] ?? [];
    run.perkEffects = run.perkEffects.filter((m) => !old.some((o) => JSON.stringify(o) === JSON.stringify(m)));
    run.signatureApplied[def.id] = option.effects;
  } else if (def?.id === 'beautiful-parasite') {
    run.signatureApplied[def.id] = [...(run.signatureApplied[def.id] ?? []), ...option.effects];
  }
  run.perkEffects.push(...option.effects);
  return `${option.label}: ${option.description}`;
}
