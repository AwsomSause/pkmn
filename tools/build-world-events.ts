// Adds the emergent-story and exploration events (APPROVED.md §4-6) to src/data/events.json: stories,
// roaming Legendaries, camps, scouting, secret paths, landmarks, the Mystery Dungeon, the Tower of Legends
// and the limited-time event stops. Existing events with the same ids are replaced, all others are kept.
// Run with: npm run data:world-events
import { readFileSync, writeFileSync } from 'node:fs';
import { EMERGENT_EVENTS } from './events/emergent.ts';
import { EXPLORE_EVENTS } from './events/explore.ts';

type Json = Record<string, unknown>;
const path = new URL('../src/data/events.json', import.meta.url);
const file = JSON.parse(readFileSync(path, 'utf8')) as { events: Json[] };
const mine = [...EMERGENT_EVENTS, ...EXPLORE_EVENTS];
const ids = new Set<string>();
for (const e of mine) {
  const id = String(e.id);
  if (ids.has(id)) throw new Error(`duplicate event id ${id}`);
  ids.add(id);
}
// A room is any event another event opens with `addEvent`/`addEventFrom`: it is never drawn on its own.
const rooms = new Set<string>();
const collect = (o: unknown): void => {
  if (Array.isArray(o)) o.forEach(collect);
  else if (o && typeof o === 'object') {
    const r = o as Json;
    if (r.kind === 'addEvent') rooms.add(String(r.eventId));
    if (r.kind === 'addEventFrom') (r.ids as string[]).forEach((i) => rooms.add(i));
    Object.values(r).forEach(collect);
  }
};
collect(mine);
for (const e of mine) if (rooms.has(String(e.id))) e.room = true;
file.events = [...file.events.filter((e) => !ids.has(String(e.id))), ...mine];
writeFileSync(path, JSON.stringify(file, null, 1) + '\n');
console.log(`events.json: ${file.events.length} events (${mine.length} from the world builder)`);
