// The Research Directive (plan Part 5, Untitled doc §10): a prep choice that names one type to study.
// Defeating or catching enough Pokémon of that type in the run pays bonus Research Points at the end
// (balance.directive). It changes no rolls; it reads the run's "defeatedOrCaught.<type>" counter.

import type { Content, TypeName } from './contentSchema';
import type { RunState } from './state';

export interface DirectiveProgress {
  type: TypeName;
  current: number;
  target: number;
  done: boolean;
  researchPoints: number;
}

/** The run's directive and how far it got, or null when the run studies no type. */
export function directiveProgress(content: Content, run: Pick<RunState, 'prep' | 'log'>): DirectiveProgress | null {
  const type = run.prep.directive;
  if (!type) return null;
  const { target, researchPoints } = content.balance.directive;
  const current = run.log.counters[`defeatedOrCaught.${type}`] ?? 0;
  return { type, current: Math.min(current, target), target, done: current >= target, researchPoints };
}

export const directiveText = (content: Content, type: TypeName) => `Research Directive: defeat or catch ${content.balance.directive.target} ${type[0]!.toUpperCase()}${type.slice(1)}-types for ${content.balance.directive.researchPoints} Research Points`;
