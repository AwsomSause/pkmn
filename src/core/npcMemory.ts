// Ideas W5: lasting NPC memory, lore codex, epilogue ledger, newspaper, diary, backstories, New Game+.
// Pure: no gameplay RNG. Events write run flags (`ev:mem-<npc>-spared|crushed|helped`, `ev:trust-<npc>`, `ev:lore-<id>`);
// finalizeRun folds them into the profile once (finalizedRunIds guards a second apply); the next run's flags are seeded from it.

import type { Archetype, Content } from './contentSchema';
import { endingFor } from './ending';
import { Rng, hashSeed } from './rng';
import type { NpcMemory, RunState } from './state';
import type { StoryState } from './story/schema';

export const NEWS_KEPT = 5;
export const SEEN_KEPT = 1500;
export const NPC_KINDS = ['spared', 'crushed', 'helped'] as const;
export type NpcKind = (typeof NPC_KINDS)[number];

export const emptyNpcMemory = (): NpcMemory => ({ npcs: {}, lore: [], epilogues: [], news: [], ngPlus: 0, hintsSeen: [], seenEvents: [] });

const MEM_FLAG = /^ev:mem-(.+)-(spared|crushed|helped)$/;
const TRUST_FLAG = /^ev:trust-(.+)$/;
const LORE_FLAG = /^ev:lore-(.+)$/;

/** Seeds a new run's flags from what NPCs remember: `remembers-<npc>-<kind>`, `ng-plus`, `lore-known`. Never touches other flags. */
export function seedNpcMemory<S extends Pick<StoryState, 'flags'>>(story: S, mem: NpcMemory | undefined): S {
  if (!mem) return story;
  for (const [id, n] of Object.entries(mem.npcs)) {
    for (const k of NPC_KINDS) if (n[k] > 0) story.flags[`ev:remembers-${id}-${k}`] = n[k];
    if (n.trust > 0) story.flags[`ev:remembers-${id}-trust`] = n.trust;
  }
  if (mem.ngPlus > 0) story.flags['ev:ng-plus'] = mem.ngPlus;
  if (mem.lore.length > 0) story.flags['ev:lore-known'] = mem.lore.length;
  return story;
}

/** Folds a finished run's NPC flags into the memory (returns a new memory). A won run opens the next New Game+ step. */
export function foldNpcMemory(content: Content, mem: NpcMemory, run: RunState): NpcMemory {
  const next: NpcMemory = structuredClone(mem);
  const known = new Set(content.npcStory.lore.map((l) => l.id));
  for (const [key, value] of Object.entries(run.story.flags)) {
    const n = Number(value) || 0;
    if (n <= 0) continue;
    const m = MEM_FLAG.exec(key);
    if (m) {
      const rec = (next.npcs[m[1]!] ??= { spared: 0, crushed: 0, helped: 0, trust: 0 });
      rec[m[2] as NpcKind] += 1;
      continue;
    }
    const lore = LORE_FLAG.exec(key);
    if (lore && lore[1] !== 'known' && known.has(lore[1]!) && !next.lore.includes(lore[1]!)) next.lore.push(lore[1]!);
  }
  for (const [key, value] of Object.entries(run.story.flags)) {
    const t = TRUST_FLAG.exec(key);
    if (t && Number(value) > 0) {
      const rec = (next.npcs[t[1]!] ??= { spared: 0, crushed: 0, helped: 0, trust: 0 });
      rec.trust = Math.min(100, rec.trust + Math.min(10, Number(value)));
    }
  }
  if (run.victory) {
    next.ngPlus += 1;
    const ending = endingFor(run);
    if (!next.epilogues.includes(ending)) next.epilogues.push(ending);
  }
  for (const key of Object.keys(run.itemCounters ?? {})) {
    if (key.startsWith('event-seen:') && !next.seenEvents.includes(key.slice(11))) next.seenEvents.push(key.slice(11));
  }
  next.seenEvents = next.seenEvents.slice(-SEEN_KEPT);
  next.news = [buildNewsIssue(content, run), ...next.news].slice(0, NEWS_KEPT);
  return next;
}

const pickBy = <T>(list: readonly T[], seed: string): T => list[new Rng(hashSeed(seed)).nextUint32() % list.length]!;

/** The paper's story about a finished run (F169), templates from npcStory.json; the same run always reads the same. */
export function buildNewsIssue(content: Content, run: RunState): string {
  const bank = content.npcStory.news;
  const trainer = content.archetypes.get(run.archetypeId)?.name ?? run.archetypeId;
  const region = content.regions.get(run.regionsCleared[run.regionsCleared.length - 1] ?? '')?.name ?? 'the road';
  const lead = run.party[0] ? (content.species.get(run.party[0].speciesId)?.name ?? run.party[0].speciesId) : 'their team';
  const line = pickBy(run.victory ? bank.win : bank.loss, `${run.runId}:news`)
    .replace('{trainer}', trainer).replace('{region}', region).replace('{mons}', lead).replace('{badges}', String(run.badges.length));
  const gossip = Object.keys(run.story.flags).filter((k) => k.startsWith('ev:gossip-') && Number(run.story.flags[k]) > 0).sort().map((k) => content.npcStory.gossip[k.slice('ev:gossip-'.length)]).filter(Boolean).slice(0, 2);
  return [line, ...(gossip.length ? gossip : [pickBy(bank.rumour, `${run.runId}:rumour`)])].join(' ');
}

/** An evolution diary line (F171), the same for the same Pokémon and evolution. */
export function diaryLine(content: Content, uid: string, name: string, to: string): string {
  return pickBy(content.npcStory.diary, `${uid}:${to}:diary`).text.replaceAll('{name}', name).replaceAll('{to}', to);
}

/** A trainer's backstory for the select screen (F165): built from their id, so it never changes. */
export function backstoryFor(content: Content, a: Pick<Archetype, 'id' | 'name' | 'title'>): string {
  const b = content.npcStory.backstory;
  return `${a.name} ${pickBy(b.origins, `${a.id}:origin`)} and ${pickBy(b.motives, `${a.id}:motive`)}. ${pickBy(b.secrets, `${a.id}:secret`)}`;
}

/** Lore fragments the profile has found, in the order they are listed in npcStory.json. */
export const loreFound = (content: Content, mem: Pick<NpcMemory, 'lore'>): NpcMemory['lore'] =>
  content.npcStory.lore.filter((l) => mem.lore.includes(l.id)).map((l) => l.id);

/** The New Game+ story variant for this many wins (the highest step reached), or null. */
export const ngVariant = (content: Content, wins: number) =>
  [...content.npcStory.ngVariants].filter((v) => wins >= v.atLeast).sort((a, b) => b.atLeast - a.atLeast)[0] ?? null;

/** A secret-ending hint to show next (F168): the first for an ending not seen yet. Null when all hints were shown. */
export const nextHint = (content: Content, mem: Pick<NpcMemory, 'hintsSeen' | 'epilogues'>) =>
  content.npcStory.hints.find((h) => !mem.hintsSeen.includes(h.id) && !mem.epilogues.includes(h.ending)) ?? null;

export interface TaleEntry {
  label: string;
  right: string;
  hint: string;
  found: boolean;
}

/** Everything the Tales room lists (pure): the paper, lore fragments, what NPCs remember, epilogues, the New Game+ step and the next ending hint. */
export function taleEntries(content: Content, mem: NpcMemory): TaleEntry[] {
  const out: TaleEntry[] = [];
  mem.news.forEach((issue, i) => out.push({ label: i === 0 ? "Today's Paper" : `Back Issue ${i}`, right: 'news', hint: issue, found: true }));
  for (const l of content.npcStory.lore) {
    const found = mem.lore.includes(l.id);
    out.push({ label: found ? l.title : '???', right: 'lore', hint: found ? l.text : 'A lore fragment you have not found yet. Scribes, funerals and guides keep them.', found });
  }
  for (const [id, n] of Object.entries(mem.npcs).sort((a, b) => a[0].localeCompare(b[0]))) {
    const name = id.replace(/(^|-)([a-z])/g, (_, d: string, c: string) => `${d ? ' ' : ''}${c.toUpperCase()}`);
    const bits = [n.spared ? `spared ${n.spared}x` : '', n.crushed ? `crushed ${n.crushed}x` : '', n.helped ? `helped ${n.helped}x` : '', n.trust ? `trust ${n.trust}` : ''].filter(Boolean);
    out.push({ label: name, right: 'remembers', hint: `${name} remembers: ${bits.join(', ') || 'nothing yet'}. (They do not remember you by name, but the road does.)`, found: true });
  }
  for (const e of mem.epilogues) out.push({ label: `Ending: ${e}`, right: 'epilogue', hint: `You have reached the ${e} ending.`, found: true });
  const ng = ngVariant(content, mem.ngPlus);
  if (ng) out.push({ label: `New Game+: ${ng.name}`, right: `${mem.ngPlus} wins`, hint: ng.text, found: true });
  const hint = nextHint(content, mem);
  if (hint) out.push({ label: 'A Whisper', right: 'hint', hint: hint.text, found: true });
  return out;
}
