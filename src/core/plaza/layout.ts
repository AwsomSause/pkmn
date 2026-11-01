// The Trainer Plaza's look and crowd (spec 2026-11 §18): five districts, a per-stage variant look, wandering trainers and
// Pokémon, returning faces and rare visitors. Pure: everything is drawn from the run seed, region and stage with a private
// hash (never the battle, encounter or reward streams), so a reload shows the same plaza. Presentation reads this; it never
// changes game state.

import { z } from 'zod';
import json from '../../data/plazaLife.json';
import { hashSeed, Rng } from '../rng';
import { stageKey } from '../mapItems';
import type { Content } from '../contentSchema';
import type { RunState } from '../state';
import { plazaView, plazaVisitors, type PlazaSectionId, type PlazaView } from './flow';

const SECTION_IDS = ['stalls', 'oddities', 'traders', 'board', 'rumors', 'club', 'errands', 'alley', 'services', 'people', 'caravan'] as const;
const DistrictIdSchema = z.enum(['market', 'trading', 'gathering', 'social', 'services', 'secret']);
export type DistrictId = z.infer<typeof DistrictIdSchema>;

const LifeSchema = z.object({
  districts: z.array(z.object({
    id: DistrictIdSchema,
    name: z.string(),
    blurb: z.string(),
    sections: z.array(z.enum(SECTION_IDS)).min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    color: z.string(),
  })).length(6),
  looks: z.array(z.object({ id: z.string(), name: z.string(), decor: z.array(z.string()), tint: z.number().int() })).min(3),
  travelers: z.array(z.object({ name: z.string(), line: z.string() })).min(6),
  chatter: z.array(z.tuple([z.string(), z.string()])).min(3),
  rare: z.array(z.object({ id: z.string(), name: z.string(), line: z.string(), minBadges: z.number().int().min(0) })).min(2),
  bubbles: z.object({ player: z.array(z.string()).min(1), secretClosed: z.string() }),
});
export const PLAZA_LIFE = LifeSchema.parse(json);

export interface DistrictView {
  id: DistrictId;
  name: string;
  blurb: string;
  x: number;
  y: number;
  color: number;
  /** Sections that exist here right now, with how many things each one offers. */
  sections: { id: PlazaSectionId; title: string; count: number }[];
  /** The total number of things to do. */
  count: number;
  /** A closed district (the secret alley before it opens). */
  locked: boolean;
}

export type CrowdKind = 'regular' | 'traveler' | 'rival' | 'foe' | 'rare' | 'caravan' | 'pokemon';
export interface Wanderer {
  id: string;
  kind: CrowdKind;
  name: string;
  /** What they say when you walk up (their own line, or one that reflects your history). */
  line: string;
  home: DistrictId;
  /** Body colour for the figure. */
  color: number;
  /** For `pokemon`: the species shown. */
  speciesId?: string;
  /** Pokémon walk beside this wanderer's id, trainers have none. */
  follows?: string;
  /** Walk speed in pixels per second, and how wide they roam. */
  speed: number;
  roam: number;
}

export interface Chat {
  a: string;
  b: string;
  lines: [string, string];
}

export interface PlazaLayout {
  view: PlazaView;
  look: { id: string; name: string; decor: string[]; tint: number };
  districts: DistrictView[];
  crowd: Wanderer[];
  chats: Chat[];
  /** The stage's banner word (the plaza's name for this stage). */
  title: string;
  closed: boolean;
}

const BODY_COLORS = [0xe86a5a, 0x5aa8e8, 0x68c878, 0xf0c050, 0xb078e0, 0xe890b8, 0x58c8c0, 0xe8a058];
const SPECIES_STAGE_CAP = 12;

/** A private generator for the plaza's looks and crowd; it does not touch any gameplay stream. */
const lifeRng = (run: RunState, label: string): Rng => new Rng(hashSeed(`${run.seed}::plaza-life::${stageKey(run) ?? 'none'}::${label}`));

export function plazaLayout(content: Content, run: RunState, sideId: string): PlazaLayout {
  const view = plazaView(content, run, sideId);
  const visitors = plazaVisitors(content, run);
  const counts = new Map(view.sections.map((s) => [s.id, s]));
  const districts: DistrictView[] = PLAZA_LIFE.districts.map((d) => {
    const sections = d.sections.flatMap((id) => {
      const s = counts.get(id);
      return s ? [{ id, title: s.title, count: s.count }] : [];
    });
    const count = sections.reduce((n, s) => n + s.count, 0);
    return { id: d.id, name: d.name, blurb: d.blurb, x: d.x, y: d.y, color: Number(d.color), sections, count, locked: sections.length === 0 };
  });

  const look = lifeRng(run, 'look').pick(PLAZA_LIFE.looks);
  const rng = lifeRng(run, 'crowd');
  const crowd: Wanderer[] = [];
  let color = 0;
  const nextColor = (): number => BODY_COLORS[color++ % BODY_COLORS.length]!;
  const add = (w: Omit<Wanderer, 'color' | 'speed' | 'roam'> & { color?: number }): Wanderer => {
    const full: Wanderer = { color: w.color ?? nextColor(), speed: 14 + Math.floor(rng.float() * 18), roam: 50 + Math.floor(rng.float() * 60), ...w } as Wanderer;
    crowd.push(full);
    return full;
  };

  if (!visitors.closed) {
    for (const r of visitors.regulars) {
      const home: DistrictId = r.stall ? 'market' : r.id === 'gus' || r.id === 'vera' || r.id === 'pip' ? 'gathering' : 'services';
      add({ id: `reg:${r.id}`, kind: 'regular', name: r.name, line: `${r.role}. "${r.line}"`, home });
    }
    if (visitors.caravan) add({ id: 'caravan', kind: 'caravan', name: visitors.caravan, line: 'The caravan is parked by the stalls. Have a look.', home: 'market', color: 0xd8a860 });
    // Returning characters, with lines that reflect the run so far.
    if (visitors.rival) {
      const r = visitors.rival;
      const line = r.state === 'ally' ? `${r.name}: "Good to see you. I saved you some supplies."` : r.state === 'retired' ? `${r.name} nods and says nothing. The rivalry is over.` : `${r.name}: "Still going? I'm further along than you think."`;
      add({ id: `rival:${r.id}`, kind: 'rival', name: r.name, line, home: 'social', color: 0xe04848 });
    }
    if (visitors.foe) add({ id: `foe:${visitors.foe.name}`, kind: 'foe', name: visitors.foe.name, line: `${visitors.foe.name}: "You beat me fair. I've been practising."`, home: 'social', color: 0x888090 });
    // Travellers: a different few every stage.
    const travelers = [...PLAZA_LIFE.travelers].map((t) => ({ t, k: rng.float() })).sort((a, b) => a.k - b.k).slice(0, 3 + (run.regionIndex >= 2 ? 1 : 0));
    travelers.forEach(({ t }, i) => add({ id: `trav:${i}`, kind: 'traveler', name: t.name, line: `${t.name}: "${t.line}"`, home: (['gathering', 'social', 'trading', 'market'] as DistrictId[])[i % 4]! }));
    // A rare visitor now and then (more often the further you are).
    const eligible = PLAZA_LIFE.rare.filter((r) => r.minBadges <= run.badges.length);
    if (eligible.length > 0 && rng.chance(Math.min(0.5, 0.15 + run.badges.length * 0.05))) {
      const r = rng.pick(eligible);
      add({ id: `rare:${r.id}`, kind: 'rare', name: r.name, line: `${r.name}: "${r.line}"`, home: 'gathering', color: 0xf8e060 });
    }
    // Pokémon wander and follow: a few of your own region's species, and one beside most trainers.
    const species = [...content.species.values()].filter((s) => s.assets && s.id).slice(0, 400);
    if (species.length > 0) {
      const trainers = crowd.filter((w) => w.kind !== 'caravan');
      const n = Math.min(SPECIES_STAGE_CAP, trainers.length + 2);
      for (let i = 0; i < n; i++) {
        const owner = trainers[i];
        const s = rng.pick(species);
        add({ id: `mon:${i}`, kind: 'pokemon', name: s.name, line: `${s.name} trots about, ${owner && i % 2 === 0 ? `sticking close to ${owner.name}` : 'sniffing at the stalls'}.`, home: owner?.home ?? 'gathering', speciesId: s.id, follows: owner ? owner.id : undefined, color: 0xffffff });
      }
    }
  }

  // Background conversations: pairs of trainers near each other swap lines.
  const talkers = crowd.filter((w) => w.kind === 'regular' || w.kind === 'traveler');
  const chats: Chat[] = [];
  const pairs = Math.min(2, Math.floor(talkers.length / 2));
  const lines = [...PLAZA_LIFE.chatter].map((c) => ({ c, k: rng.float() })).sort((a, b) => a.k - b.k);
  for (let i = 0; i < pairs; i++) chats.push({ a: talkers[i * 2]!.id, b: talkers[i * 2 + 1]!.id, lines: lines[i]!.c });

  const title = visitors.closed ? `${view.event.name} (closed)` : look.name;
  return { view, look, districts, crowd, chats, title, closed: visitors.closed };
}
