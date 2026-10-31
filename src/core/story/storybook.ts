// The Pokémon Chronicle's stories (Techno blueprint §6.3): short readable accounts
// assembled from recorded events and authored templates (no generation), for a rivalry,
// a Pokémon's run, a mentor and protégé, and the whole team. Pure.

import type { Content } from '../contentSchema';
import { circuitRanking } from './highHype';
import { chemistryLines } from './chemistry';
import { promiseLines } from './promises';
import { FEELING_NAMES, rivalFeeling } from '../rivals/feelings';
import { legacyCard } from './legacy';
import type { RunState } from '../state';

export interface ChronicleStory {
  kind: 'rivalry' | 'pokemon' | 'mentorship' | 'team' | 'nemesis' | 'region' | 'raid';
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

function circuitStory(content: Content, run: RunState): ChronicleStory[] {
  const rows = circuitRanking(content, run);
  if (rows.length === 0) return [];
  return [{ kind: 'rivalry', title: 'Rival Tournament Circuit', body: rows.slice(0, 5).map((r) => `${r.rank}. ${r.name} (${r.state})`).join('; ') + '.', tags: ['Ranking'] }];
}

const CAUSE_TEXT: Record<string, string> = {
  defeat: 'beat your team',
  starterKo: 'knocked out your starter',
  multiKo: 'knocked out several of your Pokémon',
  escaped: 'broke free of a ball and got away',
  avenged: 'avenged a fallen partner',
  narrowBoss: 'lost to you by the narrowest margin',
};

/** One account per nemesis: why it formed, what it did on its return and how it ended (Techno §6.3). */
function nemesisStories(content: Content, run: RunState): ChronicleStory[] {
  return run.story.nemeses.map((n) => {
    const who = species(content, n.speciesId);
    const ending = n.settledAs === 'beaten' ? 'It was beaten at the Reckoning.' : n.settledAs === 'caught' ? 'It was caught at the Reckoning and joined the story on your side.' : n.phase === 'reckoning' ? 'The Reckoning is still ahead.' : 'It has not returned yet.';
    return {
      kind: 'nemesis' as const,
      title: `${who}, the ${n.archetype.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
      body: `${who} ${CAUSE_TEXT[n.cause] ?? 'left a mark'}${n.wins > 0 ? `, and has beaten your whole team ${times(n.wins)}` : ''}. ${n.changes.length > 0 ? `${n.changes.join('; ')}. ` : ''}${ending}`,
      tags: ['Nemesis', n.phase],
    };
  });
}

/** One account per cleared region and one for the raid log. */
function regionStories(content: Content, run: RunState): ChronicleStory[] {
  const out: ChronicleStory[] = run.regionsCleared.map((id) => {
    const region = content.regions.get(id);
    const crisis = Number(run.story.flags[`crisis:${id}`] ?? 0);
    return {
      kind: 'region' as const,
      title: `Chapter: ${region?.name ?? id}`,
      body: `${region?.name ?? id} is behind you. ${region ? `${region.gymLeaders.length} gym leaders stood in the way.` : ''}${crisis >= 3 ? ' Its crisis ran high before the end.' : ''}`.trim(),
      tags: ['Region'],
    };
  });
  const c = run.log.counters;
  const raids = (c.raidsWon ?? 0) + (c.totemsWon ?? 0) + (c.anomalyRaidsWon ?? 0);
  if (raids > 0) {
    out.push({
      kind: 'raid',
      title: 'The Raid Log',
      body: `The team won ${[c.raidsWon ? `${c.raidsWon} raid ${c.raidsWon === 1 ? 'den' : 'dens'}` : '', c.totemsWon ? `${c.totemsWon} Totem ${c.totemsWon === 1 ? 'fight' : 'fights'}` : '', c.anomalyRaidsWon ? `${c.anomalyRaidsWon} anomaly ${c.anomalyRaidsWon === 1 ? 'raid' : 'raids'}` : ''].filter(Boolean).join(', ')}.`,
      tags: ['Raids'],
    });
  }
  return out;
}

/** All the stories this run can tell right now, most personal first. */
export function chronicleStories(content: Content, run: RunState): ChronicleStory[] {
  return [...rivalryStories(content, run), ...pokemonStories(content, run), ...mentorStories(content, run), ...chemistryStories(content, run), ...circuitStory(content, run), ...nemesisStories(content, run), ...regionStories(content, run), ...teamStory(content, run)];
}
