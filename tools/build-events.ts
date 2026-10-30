// Writes src/data/events.json from the event lists in tools/events/*.ts.
// Run with: npm run data:events
import { writeFileSync } from 'node:fs';
import { KEY_EVENTS } from './events/keys.ts';
import { MORE_EVENTS } from './events/more.ts';
import { DIRECTOR_EVENTS } from './events/director.ts';
import { OVERDRIVE_EVENTS } from './events/overdrive.ts';
import { PLAN_EVENTS } from './events/plan.ts';
import { STORY_EVENTS } from './events/story.ts';
import { WILD_EVENTS } from './events/wild.ts';
import { HOLIDAY_EVENTS } from './events/holidays.ts';

const events = [...PLAN_EVENTS, ...KEY_EVENTS, ...MORE_EVENTS, ...OVERDRIVE_EVENTS, ...DIRECTOR_EVENTS, ...STORY_EVENTS, ...HOLIDAY_EVENTS, ...WILD_EVENTS];
const seen = new Set<string>();
for (const e of events) {
  const id = String(e.id);
  if (seen.has(id)) throw new Error(`duplicate event id ${id}`);
  seen.add(id);
}
writeFileSync(new URL('../src/data/events.json', import.meta.url), JSON.stringify({ events }, null, 1) + '\n');
console.log(`events.json: ${events.length} events`);
