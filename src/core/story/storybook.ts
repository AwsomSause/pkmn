// The Pokémon Chronicle's stories (Techno blueprint §6.3): short readable accounts
// assembled from recorded events and authored templates (no generation), for a rivalry,
// a Pokémon's run, a mentor and protégé, and the whole team. Pure.

import type { Content } from '../contentSchema';
import { chemistryLines } from './chemistry';
import { promiseLines } from './promises';
import { FEELING_NAMES, rivalFeeling } from '../rivals/feelings';
import { legacyCard } from './legacy';
import type { RunState } from '../state';

export interface ChronicleStory {
  kind: 'rivalry' | 'pokemon' | 'mentorship' | 'team';
  title: string;
  body: string;
  /** Short tags shown under the story. */
  tags: string[];
}

const species = (content: Content, id: string | undefined) => (id ? content.species.get(id)?.name ?? id : 'a Pokémon');
const times = (n: number) => (n === 1 ? 'once' : `${n} times`);

function rivalryStories(content: Content, run: RunState): ChronicleStory[] {
  const starter = species(content, run.party[0]?.speciesId);
  return run.story.rivals
    .filter((r) => r.encounters >= 1)
    .map((r) => {
      const name = `${content.trainers.get(r.classId)?.name ?? 'Trainer'} ${r.name}`;
      const { feeling, because } = rivalFeeling(r);
      const last = r.memory.lastBattle;
      const close = last.hpLeftShare <= 0.3;
      const title = r.state === 'ally' ? 'The Rival Who Became a Friend' : r.state === 'retired' ? 'The Rival Who Stepped Away' : r.encounters >= 2 ? "The Rival Who Wouldn't Give Up" : 'A Rivalry Begins';
      const tags = [r.state === 'ally' || r.state === 'retired' ? 'Rivalry resolved' : 'Rivalry open', FEELING_NAMES[feeling]];
      if (close) tags.push('Close call');
      return {
        kind: 'rivalry' as const,
        title,
        body: `Your team first met ${name} in region ${r.origin.where.region + 1}. They have faced each other ${times(r.encounters)} since. ${close ? `The last fight was a close one: ${starter} and the team held on with only a sliver of HP.` : `The last fight went your way cleanly.`} ${name} feels ${FEELING_NAMES[feeling].toLowerCase()} toward you, because ${because}.`,
        tags,
      };
    });
}

function pokemonStories(content: Content, run: RunState): ChronicleStory[] {
  const out: ChronicleStory[] = [];
  for (const m of run.party) {
    const card = legacyCard(content, run, m.uid);
    if (!card || (card.titles.length === 0 && card.greatest.length < 2)) continue;
    const h = run.story.histories[m.uid]!;
    out.push({
      kind: 'pokemon',
      title: `${species(content, card.speciesId)}${card.titles[0] ? `, ${card.titles[0]}` : ''}`,
      body: `${species(content, card.speciesId)} fought ${h.battles} battles and beat ${h.bossesBeaten} boss${h.bossesBeaten === 1 ? '' : 'es'}${h.survivedFatal > 0 ? `, surviving a knockout blow ${times(h.survivedFatal)}` : ''}. ${card.greatest.length > 0 ? `Its greatest moments: ${card.greatest.slice(0, 3).join('; ')}.` : ''}`,
      tags: [...card.titles, ...card.tags].slice(0, 4),
    });
  }
  return out;
}

function mentorStories(content: Content, run: RunState): ChronicleStory[] {
  const nameOf = (uid: string) => species(content, run.story.histories[uid]?.speciesId ?? run.party.find((m) => m.uid === uid)?.speciesId);
  return run.story.relationships
    .filter((r) => r.kind === 'mentorship')
    .map((r) => ({
      kind: 'mentorship' as const,
      title: `${nameOf(r.a.id)} and ${nameOf(r.b.id)}`,
      body: `${nameOf(r.a.id)} took ${nameOf(r.b.id)} under its wing. ${r.open ? 'The lessons continue.' : `The mentorship has ended: ${nameOf(r.b.id)} grew into its own.`}`,
      tags: [r.open ? 'Mentorship open' : 'Mentorship complete'],
    }));
}

function teamStory(content: Content, run: RunState): ChronicleStory[] {
  const histories = run.party.map((m) => run.story.histories[m.uid]).filter(<T,>(h: T | undefined): h is T => Boolean(h));
  const battles = histories.reduce((n, h) => n + (h as { battles: number }).battles, 0);
  if (battles === 0) return [];
  return [
    {
      kind: 'team',
      title: run.victory ? 'The Whole Journey' : 'The Journey So Far',
      body: `The team has crossed ${run.regionIndex + (run.victory ? 1 : 0)} region${run.regionIndex + (run.victory ? 1 : 0) === 1 ? '' : 's'} and fought ${battles} battles together${run.story.rivals.length > 0 ? `, with ${run.story.rivals.length} rival${run.story.rivals.length === 1 ? '' : 's'} following along` : ''}.`,
      tags: [run.victory ? 'Victory' : 'In progress'],
    },
  ];
}

function chemistryStories(content: Content, run: RunState): ChronicleStory[] {
  const lines = chemistryLines(content, run);
  const promises = promiseLines(content, run);
  return [
    ...(lines.length > 0 ? [{ kind: 'team' as const, title: 'Team Chemistry', body: `${lines.join('. ')}.`, tags: ['Chemistry'] }] : []),
    ...(promises.length > 0 ? [{ kind: 'team' as const, title: 'Open Promises', body: `${promises.join('. ')}. Bring them into the rematch.`, tags: ['Promise'] }] : []),
  ];
}

/** All the stories this run can tell right now, most personal first. */
export function chronicleStories(content: Content, run: RunState): ChronicleStory[] {
  return [...rivalryStories(content, run), ...pokemonStories(content, run), ...mentorStories(content, run), ...chemistryStories(content, run), ...teamStory(content, run)];
}
