// The ending credits (M9, minimal): a roll of what this run was, then thanks.
// Pure: reads a finished run, changes nothing, draws no random numbers.

import type { Content } from './contentSchema';
import type { RunState } from './state';
import { buildEpilogue } from './ending';
import { buildRecap } from './recap';

export interface CreditsLine {
  kind: 'title' | 'heading' | 'text' | 'gap' | 'mons';
  text: string;
  /** `mons`: a row of up to 6 species (their sprites) shown in the roll. */
  species?: string[];
}

/** Credits for a won run: the trainer, each party member, how it went, then the project's thanks. */
export function buildCredits(content: Content, run: RunState): CreditsLine[] {
  const recap = buildRecap(content, run);
  const trainer = content.archetypes.get(run.archetypeId)?.name ?? run.archetypeId;
  const lines: CreditsLine[] = [
    { kind: 'title', text: 'Pocket Raiders' },
    { kind: 'text', text: `${trainer} conquered ${run.regionsCleared.length} regions` },
    ...buildEpilogue(content, run).map((text): CreditsLine => ({ kind: 'text', text })),
    { kind: 'gap', text: '' },
    { kind: 'heading', text: 'The Team' },
    ...run.party.map((m): CreditsLine => ({ kind: 'text', text: `${m.shiny ? '✦ ' : ''}${content.species.get(m.speciesId)?.name ?? m.speciesId}  Lv${m.level}` })),
    { kind: 'gap', text: '' },
    { kind: 'heading', text: 'The Journey' },
    { kind: 'text', text: `${run.badges.length} badges · ${run.encountersCompleted} encounters` },
    ...(recap.legend ? [{ kind: 'text', text: `Legend: ${recap.legend}` } as CreditsLine] : []),
    ...(recap.biggestMoment ? [{ kind: 'text', text: `★ ${recap.biggestMoment}` } as CreditsLine] : []),
    ...(recap.stamps.length ? [{ kind: 'text', text: `Stamps: ${recap.stamps.join(' · ')}` } as CreditsLine] : []),
    ...recap.rivals.map((r): CreditsLine => ({ kind: 'text', text: r })),
    ...defeatedLines(content, run),
    { kind: 'gap', text: '' },
    { kind: 'heading', text: 'Made by' },
    { kind: 'text', text: 'Kice, director' },
    { kind: 'text', text: 'Built with Claude' },
    { kind: 'gap', text: '' },
    { kind: 'heading', text: 'Thanks' },
    { kind: 'text', text: 'PokeRogue and its asset packs (AGPL-3.0)' },
    { kind: 'text', text: 'Pokémon Essentials, Enhanced Battle UI and Deluxe Battle Kit' },
    { kind: 'text', text: 'Pokémon belongs to Nintendo, Game Freak and Creatures Inc.' },
    { kind: 'gap', text: '' },
    { kind: 'text', text: `Seed ${run.seed}` },
    { kind: 'title', text: 'Thanks for playing' },
  ];
  return lines;
}

/** Ideas W5 (F178): everyone you beat, with their teams' sprites in rows (at most MAX_FOES trainers, newest first). */
const MAX_FOES = 8;
export function defeatedLines(content: Content, run: RunState): CreditsLine[] {
  const beaten = run.story.enemyProfiles.filter((p) => p.battles.some((b) => b.result === 'win')).slice(-MAX_FOES).reverse();
  if (beaten.length === 0) return [];
  return [
    { kind: 'gap', text: '' },
    { kind: 'heading', text: 'Everyone We Beat' },
    ...beaten.flatMap((p): CreditsLine[] => [
      { kind: 'text', text: p.name },
      { kind: 'mons', text: '', species: p.team.map((m) => m.speciesId).filter((id) => content.species.has(id)).slice(0, 6) },
    ]),
  ];
}
