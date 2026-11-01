// Ideas W10: adds the set-piece and misc-touch events (tools/events/w10.ts) to src/data/events.json.
// Safe to re-run: events with the same ids are replaced, all others kept. Run: npm run data:w10-events
import { readFileSync, writeFileSync } from 'node:fs';
import { W10_EVENTS } from './events/w10.ts';

type Json = Record<string, unknown>;
const path = new URL('../src/data/events.json', import.meta.url);
const file = JSON.parse(readFileSync(path, 'utf8')) as { events: Json[] };
const ids = new Set<string>();
for (const e of W10_EVENTS) {
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
    Object.values(r).forEach(collect);
  }
};
collect(W10_EVENTS);
for (const e of W10_EVENTS) if (rooms.has(String(e.id))) e.room = true;
file.events = [...file.events.filter((e) => !ids.has(String(e.id))), ...W10_EVENTS];
writeFileSync(path, JSON.stringify(file, null, 1) + '\n');
console.log(`events.json: ${file.events.length} events (${W10_EVENTS.length} from the W10 builder)`);
