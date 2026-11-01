// The Settings > Game Summary (W13): a readable summary of everything in the game, built from the validated
// content so it can never drift from what the game really has. Pure data, no Phaser. Each topic lists entries;
// an entry has a short line (shown in the list) and a longer text (shown when it is focused).

import { RUN_RULES } from './rules';
import type { Content } from './contentSchema';
import mechanicsJson from '../quality/mechanics.json';

export interface SummaryEntry {
  id: string;
  name: string;
  /** One short line for the list row. */
  short: string;
  /** The full text shown below the list. */
  text: string;
}

export interface SummaryTopic {
  id: string;
  label: string;
  blurb: string;
  entries: SummaryEntry[];
}

const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const list = (xs: readonly string[], max = 8): string => (xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} and ${xs.length - max} more`);
const num = (n: number | null | undefined): string => (n === null || n === undefined ? '-' : String(n));
const name = (map: Map<string, { name: string }>, id: string): string => map.get(id)?.name ?? id;

interface Mechanic { id: string; name: string; status: string; note?: string }

/** Every topic, in the order the Settings screen shows them. Counts come from the data. */
export function gameSummary(content: Content): SummaryTopic[] {
  const species = [...content.species.values()].sort((a, b) => a.dex - b.dex || Number(a.id.includes('-')) - Number(b.id.includes('-')) || a.name.localeCompare(b.name));
  const topics: SummaryTopic[] = [];
  const add = (id: string, label: string, blurb: string, entries: SummaryEntry[]) => topics.push({ id, label, blurb: `${blurb} (${entries.length})`, entries });

  add('how', 'How the game works', 'The loop of a run, in plain words.', [
    { id: 'loop', name: 'A run', short: 'Pick a trainer and a starter, then walk the map.', text: 'Pick a trainer, a starter and your rules. Each stage is a small map: wild Pokémon, trainers, rest stops, shops and events. Win the stage to reach the next. Every region ends at a gym, then the Elite Four and a Champion.' },
    { id: 'battle', name: 'Battles', short: 'Turn-based, one move or action per turn.', text: 'Choose Fight, Bag or Pokémon each turn. Bonds make your Pokémon braver, Momentum fills as you land super effective hits, and bosses telegraph their strongest attack so you can plan for it.' },
    { id: 'save', name: 'Saving', short: 'Autosave after every step, plus Save, Save & Quit and Save & Hub.', text: 'The game saves after every step. On the map, Save writes now, Save & Quit saves and goes to the title screen, and Save & go back to Hub saves and visits the Hub. Continue on the title screen resumes the run exactly where you left it.' },
    { id: 'signature', name: 'Signature moves', short: 'A move used often becomes that Pokémon\'s signature move.', text: `A damaging move a Pokémon uses ${content.story.awakening.uses} times, in wild or trainer fights, becomes its signature move: it hits ${Math.round((content.story.awakening.boost - 1) * 100)}% harder and shows a star in the party view.` },
    { id: 'levels', name: 'Levels', short: `Levels climb to ${content.balance.difficulty.maxLevel}; each region raises the cap by ${content.balance.difficulty.levelCapStep}.`, text: `Wild Pokémon start near your starter (level ${content.balance.starterLevel}) and get stronger every stage. The level cap rises by ${content.balance.difficulty.levelCapStep} each region, up to level ${content.balance.difficulty.maxLevel}.` },
  ]);

  add('pokemon', 'Pokémon', 'Every species and form.', species.map((s) => {
    const bst = Object.values(s.baseStats).reduce((a, b) => a + b, 0);
    const abilities = s.abilities.normal.map((a) => name(content.abilities, a));
    return {
      id: s.id,
      name: `#${s.dex} ${s.name}`,
      short: `${s.types.map(cap).join('/')} · base total ${bst}`,
      text: `${s.name} (#${s.dex}, generation ${s.generation}): ${s.types.map(cap).join('/')} type. Base stats ${Object.entries(s.baseStats).map(([k, v]) => `${k} ${v}`).join(', ')} (total ${bst}). Abilities: ${abilities.length > 0 ? list(abilities) : 'none'}. Weighs ${num(s.weight)} kg.`,
    };
  }));

  add('moves', 'Moves', 'Every move and what it does.', [...content.moves.values()].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({
    id: m.id,
    name: m.name,
    short: `${cap(m.type)} · ${m.category} · power ${num(m.power)}`,
    text: `${m.name}: ${cap(m.type)} ${m.category} move. Power ${num(m.power)}, accuracy ${num(m.accuracy)}, PP ${m.pp}${m.priority ? `, priority ${m.priority > 0 ? '+' : ''}${m.priority}` : ''}. Targets ${m.target}.${m.flags.length > 0 ? ` Traits: ${m.flags.join(', ')}.` : ''}${m.supported === false ? ' Not fully built yet.' : ''}`,
  })));

  add('abilities', 'Abilities', 'Passive powers Pokémon carry.', [...content.abilities.values()].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({
    id: a.id, name: a.name, short: a.description.slice(0, 70), text: `${a.name}: ${a.description}`,
  })));

  add('types', 'Types', 'What each type is strong and weak against.', Object.keys(content.typeChart).sort().map((t) => {
    const row = (content.typeChart as unknown as Record<string, Record<string, number>>)[t] ?? {};
    const strong = Object.entries(row).filter(([, v]) => v > 1).map(([k]) => cap(k));
    const weak = Object.entries(row).filter(([, v]) => v > 0 && v < 1).map(([k]) => cap(k));
    const none = Object.entries(row).filter(([, v]) => v === 0).map(([k]) => cap(k));
    return {
      id: t, name: cap(t), short: strong.length > 0 ? `Hits ${list(strong, 4)} for double` : 'No super effective hits',
      text: `${cap(t)} attacks hit ${strong.length > 0 ? list(strong, 18) : 'nothing'} for double damage, are resisted by ${weak.length > 0 ? list(weak, 18) : 'nothing'}${none.length > 0 ? ` and do nothing to ${list(none)}` : ''}.`,
    };
  }));

  add('items', 'Items', 'Everything you can carry, use or hold.', [...content.items.values()].sort((a, b) => a.name.localeCompare(b.name)).map((i) => ({
    id: i.id, name: i.name, short: `${cap(i.category)}: ${i.description.slice(0, 60)}`, text: `${i.name} (${i.category}): ${i.description}`,
  })));

  add('catalog', 'Held items and keepsakes', 'The full item catalog.', [...content.catalog.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
    const e = c as unknown as { category?: string; description?: string; effect?: string; rarity?: string; status?: string };
    const text = e.description ?? e.effect ?? '';
    return { id: c.id, name: c.name, short: `${cap(e.category ?? 'item')}${e.rarity ? ` · ${e.rarity}` : ''}`, text: `${c.name}${e.category ? ` (${e.category})` : ''}${text ? `: ${text}` : ''}${e.status && e.status !== 'supported' ? ` Status: ${e.status}.` : ''}` };
  }));

  add('trainers', 'Trainers you play', 'The trainers you can start a run as.', [...content.archetypes.values()].map((a) => ({
    id: a.id, name: a.name, short: a.title, text: `${a.name}, ${a.title}. ${a.description}${a.pros.length > 0 ? ` Strengths: ${list(a.pros, 6)}.` : ''}${a.cons.length > 0 ? ` Weaknesses: ${list(a.cons, 6)}.` : ''}`,
  })));

  add('classes', 'Trainers you fight', 'Trainer classes on the road.', [...content.trainers.values()].map((t) => ({
    id: t.id, name: t.name, short: t.style ? cap(String(t.style)) : 'Trainer', text: `${t.name}: ${t.style ? `fights in a ${String(t.style)} style` : 'an ordinary trainer'}${t.types.length > 0 ? `, favours ${list(t.types.map(cap))} Pokémon` : ''}. Pays ${t.moneyPerLevel} per level.`,
  })));

  add('bosses', 'Gym leaders, Elite Four and Champions', 'The people at the end of each region.', [...content.bosses.values()].map((b) => ({
    id: b.id, name: b.name, short: `${b.types.map(cap).join('/') || 'Mixed'} · ace ${name(content.species, b.signature[0] ?? '')}`, text: `${b.name}: ${b.types.length > 0 ? `${b.types.map(cap).join('/')} specialist` : 'uses a mixed team'}. Signature Pokémon: ${list(b.signature.map((id) => name(content.species, id)))}.`,
  })));

  add('regions', 'Regions', 'The places a run passes through.', [...content.regions.values()].map((r) => ({
    id: r.id, name: r.name, short: `${r.gymLeaders.length} gym leaders · ${r.eliteFour.length} Elite Four`, text: `${r.name}${r.grand ? ' (the Grand Region, always last)' : ''}: gym leaders ${list(r.gymLeaders.map((id) => name(content.bosses, id)), 10) || 'anyone'}; Elite Four ${list(r.eliteFour.map((id) => name(content.bosses, id)), 6) || 'anyone'}; Champions ${list(r.champions.map((id) => name(content.bosses, id)), 6) || 'anyone'}.`,
  })));

  add('modes', 'Modes, difficulties and rules', 'How to change a run.', [
    ...RUN_RULES.modes.map((m) => ({ id: `mode:${m.id}`, name: `Mode: ${m.name}`, short: m.blurb.slice(0, 70), text: `${m.name} mode (${m.status}): ${m.blurb}` })),
    ...RUN_RULES.difficulties.map((d) => ({ id: `diff:${d.id}`, name: `Difficulty: ${d.name}`, short: `Rewards x${d.multiplier}`, text: `${d.name}: ${d.blurb} Rewards x${d.multiplier}${d.enemyLevelBonus ? `, enemies +${d.enemyLevelBonus} levels` : ''}.` })),
    ...RUN_RULES.modifiers.map((m) => ({ id: `mod:${m.id}`, name: `Rule: ${m.name}`, short: m.blurb.slice(0, 70), text: `${m.name} (${m.status}): ${m.blurb} Bonus x${m.bonus}.` })),
  ]);

  add('events', 'Map events', 'Things that happen on the road.', [...content.events.values()].map((e) => ({
    id: e.id, name: e.name, short: `${e.group ?? 'Event'}${e.rarity ? ` · ${e.rarity}` : ''}`, text: `${e.name}${e.group ? ` (${e.group})` : ''}${e.rarity ? `, ${e.rarity}` : ''}.`,
  })));

  add('weeks', 'Weekly and holiday events', 'Scheduled game events.', [...content.gameEvents.values()].map((g) => ({
    id: g.id, name: g.name, short: g.kind, text: `${g.name} (${g.kind}): ${g.description}`,
  })));

  add('raids', 'Raids, Totems and expeditions', 'Big fights and long trips.', [
    ...content.raids.raids.map((r) => ({ id: `raid:${r.id}`, name: `Raid: ${r.name}`, short: `Tier ${r.tier}`, text: `${r.name} (tier ${r.tier}): ${r.blurb}` })),
    ...content.totems.totems.map((t) => ({ id: `totem:${t.id}`, name: `Totem: ${t.name}`, short: `Tier ${t.tier}`, text: `${t.name} (tier ${t.tier}): ${t.blurb}` })),
    ...content.expeditions.expeditions.map((x) => ({ id: `exp:${x.id}`, name: `Expedition: ${x.name}`, short: `Tier ${x.tier}`, text: `${x.name} (tier ${x.tier}): ${x.blurb}` })),
  ]);

  add('minigames', 'Minigames', 'Side games between battles.', content.minigames.games.map((g) => ({ id: g.id, name: g.name, short: g.category, text: `${g.name} (${g.category}): ${g.blurb} ${g.instructions}` })));

  add('achievements', 'Achievements', 'Goals that last across runs.', [...content.achievements.values()].map((a) => ({
    id: a.id, name: a.hidden ? '??? (hidden)' : a.name, short: a.hidden ? 'Hidden until earned' : a.description.slice(0, 70), text: a.hidden ? 'A hidden achievement. Play to find it.' : `${a.name}: ${a.description}`,
  })));

  add('quests', 'Quests', 'Run quests and trainer quest lines.', [
    ...[...content.runQuests.values()].map((q) => ({ id: `rq:${q.id}`, name: 'Run quest', short: q.text.slice(0, 70), text: q.text })),
    ...[...content.questLines.values()].map((l) => ({ id: `ql:${(l as { id?: string; trainerId?: string }).id ?? (l as { trainerId?: string }).trainerId ?? ''}`, name: `Quest line: ${(l as { name?: string }).name ?? ''}`, short: 'A trainer\'s quest line', text: `${(l as { name?: string }).name ?? 'A quest line'}.` })),
  ]);

  const mechanics = (mechanicsJson as unknown as { mechanics?: Mechanic[] }).mechanics ?? (mechanicsJson as unknown as Mechanic[]);
  add('mechanics', 'Game systems', 'Every mechanic and how complete it is.', mechanics.map((m) => ({
    id: m.id, name: m.name, short: cap(m.status), text: `${m.name}: ${m.status}.${m.note ? ` ${m.note}` : ''}`,
  })));

  return topics;
}
