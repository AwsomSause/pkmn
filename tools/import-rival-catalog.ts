// Turns the director's "Living Rivalry Engine: Examples" menu (tools/sources/rivalry-examples.md)
// into src/data/rivalCatalog.json: 30 rival paths, 40 personalities, 32 battle styles,
// 40 off-screen events, 36 character arcs, 24 advanced mechanics. Every entry starts with
// status "planned" (data only); a status moves to "supported" when the engine really runs it.
//
//   npm run data:rival-catalog

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const lines = readFileSync(join(root, 'tools', 'sources', 'rivalry-examples.md'), 'utf8').split(/\r?\n/);
const clean = (s: string) => s.replace(/\\([.#*_-])/g, '$1').replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
const slug = (s: string) => clean(s).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface Entry { id: string; name: string; group: string; text: string; status: 'planned' | 'limited' | 'supported' | 'disabled' }
const sections: Record<string, Entry[]> = { paths: [], personalities: [], styles: [], offscreenEvents: [], arcs: [], mechanics: [] };
const SECTION_BY_NUMBER: Record<string, string> = { '1': 'paths', '2': 'personalities', '3': 'styles', '6': 'offscreenEvents', '7': 'arcs', '8': 'mechanics' };

let section: string | null = null;
let group = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  const h2 = /^##\s+\*\*(\d+)\\?\./.exec(line);
  if (h2) {
    section = SECTION_BY_NUMBER[h2[1]!] ?? null;
    group = '';
    continue;
  }
  if (/^#\s/.test(line)) { section = null; continue; }
  if (!section) continue;
  const h3 = /^###\s+(.*)$/.exec(line);
  if (h3) { group = clean(h3[1]!).replace(/^[A-Z]\.\s+/, ''); continue; }
  // "01\. Name" followed by a description paragraph.
  const num = /^(\d{2})\\?\.\s+(.+)$/.exec(line);
  if (num && (section === 'paths' || section === 'offscreenEvents' || section === 'mechanics')) {
    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() === '') j++;
    const name = clean(num[2]!);
    sections[section]!.push({ id: slug(name), name, group, text: clean(lines[j] ?? ''), status: 'planned' });
    continue;
  }
  // Tables: "| Name | Text |" (personalities, styles, arcs: three columns -> joined).
  if (line.startsWith('|') && !/^\|\s*-/.test(line) && (section === 'personalities' || section === 'styles' || section === 'arcs')) {
    const cells = line.split('|').slice(1, -1).map((c) => clean(c));
    if (cells.length < 2 || /^(Archetype|Style|Arc)$/.test(cells[0]!)) continue;
    sections[section]!.push({ id: slug(cells[0]!), name: cells[0]!, group, text: cells.slice(1).join(' | '), status: 'planned' });
    continue;
  }
  // Numbered arcs written as "1. Name: text" (the Overdrive arcs).
  const arc = /^(\d+)\.\s+([^:]+):\s+(.*)$/.exec(line);
  if (arc && section === 'arcs') sections.arcs!.push({ id: slug(arc[2]!), name: clean(arc[2]!), group, text: clean(arc[3]!), status: 'planned' });
}

const expected = { paths: 30, personalities: 40, styles: 32, offscreenEvents: 39 /* the doc says 40 but skips #19 */, arcs: 46 /* 36 long-form + the Overdrive-specific group */, mechanics: 24 };
for (const [key, want] of Object.entries(expected)) {
  const got = sections[key]!.length;
  if (got !== want) throw new Error(`${key}: found ${got}, the doc says ${want}`);
  const ids = sections[key]!.map((e) => e.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${key}: duplicate ids ${ids.filter((x, k) => ids.indexOf(x) !== k).join(', ')}`);
}
// Statuses come from the profile files that make an entry run in the game.
const profiles = JSON.parse(readFileSync(join(root, 'src', 'data', 'rivalProfiles.json'), 'utf8')) as { personalities: Record<string, { status: Entry['status'] }>; styles: Record<string, { status: Entry['status'] }>; mechanics: Record<string, { status: Entry['status'] }> };
for (const e of sections.personalities!) e.status = profiles.personalities[e.id]?.status ?? e.status;
for (const e of sections.styles!) e.status = profiles.styles[e.id]?.status ?? e.status;
const paths = JSON.parse(readFileSync(join(root, 'src', 'data', 'rivalPaths.json'), 'utf8')) as { paths: { id: string }[] };
const pathIds = new Set(paths.paths.map((x) => x.id));
for (const e of sections.paths!) if (pathIds.has(e.id)) e.status = 'limited';
const arcs = JSON.parse(readFileSync(join(root, 'src', 'data', 'rivalArcs.json'), 'utf8')) as { arcs: { id: string }[] };
const arcIds = new Set(arcs.arcs.map((x) => x.id));
for (const e of sections.arcs!) if (arcIds.has(e.id)) e.status = 'limited';
// Off-screen events run when rivalBonds.json lists an event of that name (limited: generic habits, hyperReadiness is a number only).
const bondEvents = JSON.parse(readFileSync(join(root, 'src', 'data', 'rivalBonds.json'), 'utf8')) as { events: { name: string }[] };
const bondNames = new Set(bondEvents.events.map((x) => x.name));
for (const e of sections.offscreenEvents!) if (bondNames.has(e.name)) e.status = 'limited';
for (const e of sections.mechanics!) e.status = profiles.mechanics[e.id]?.status ?? e.status;
writeFileSync(join(root, 'src', 'data', 'rivalCatalog.json'), JSON.stringify({ source: 'A Living Rivalry Engine - Examples, Possibilities, and Guidence.md', ...sections }, null, 1) + '\n');
console.log(Object.entries(sections).map(([k, v]) => `${k}: ${v.length}`).join(', '));
