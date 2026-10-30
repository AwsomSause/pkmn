// Writes src/data/events.json from the event lists in tools/events/*.ts.
// Run with: npm run data:events
import { writeFileSync } from 'node:fs';
import { KEY_EVENTS } from './events/keys.ts';
import { MORE_EVENTS } from './events/more.ts';
import { CALLBACK_EVENTS, CLUE_EVENTS, FORM_RESEARCH_EVENTS, SECRET_ROUTE_EVENTS, HABITAT_EVENTS, LEGEND_EVENTS, MILESTONE_EVENTS, SITE_EVENTS } from './events/world.ts';
import { CAMP_EVENTS, RELIC_EVENTS, CHAMPION_EVENTS, CRISIS_EVENTS, FEUD_EVENTS, GAUNTLET_EVENTS, HUNT_EVENTS, TOURNAMENT_EVENTS } from './events/crisis.ts';
import { DIRECTOR_EVENTS } from './events/director.ts';
import { OVERDRIVE_EVENTS } from './events/overdrive.ts';
import { PLAN_EVENTS } from './events/plan.ts';
import { STORY_EVENTS } from './events/story.ts';
import { WILD_EVENTS, SHADOW_EVENTS } from './events/wild.ts';
import { HOLIDAY_EVENTS } from './events/holidays.ts';

const events = [...PLAN_EVENTS, ...KEY_EVENTS, ...MORE_EVENTS, ...OVERDRIVE_EVENTS, ...DIRECTOR_EVENTS, ...CRISIS_EVENTS, ...CAMP_EVENTS, ...MILESTONE_EVENTS, ...SITE_EVENTS, ...CALLBACK_EVENTS, ...LEGEND_EVENTS, ...FORM_RESEARCH_EVENTS, ...SECRET_ROUTE_EVENTS, ...HABITAT_EVENTS, ...CLUE_EVENTS, ...RELIC_EVENTS, ...FEUD_EVENTS, ...CHAMPION_EVENTS, ...GAUNTLET_EVENTS, ...HUNT_EVENTS, ...TOURNAMENT_EVENTS, ...STORY_EVENTS, ...HOLIDAY_EVENTS, ...WILD_EVENTS, ...SHADOW_EVENTS];
const seen = new Set<string>();
for (const e of events) {
  const id = String(e.id);
  if (seen.has(id)) throw new Error(`duplicate event id ${id}`);
  seen.add(id);
}
writeFileSync(new URL('../src/data/events.json', import.meta.url), JSON.stringify({ events }, null, 1) + '\n');
console.log(`events.json: ${events.length} events`);
