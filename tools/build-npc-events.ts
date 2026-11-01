// Adds one "meet an NPC trainer" map event per early-game NPC trainer (ids `npc-meet-*`) to src/data/events.json.
// Win the battle, or talk them into it, and the trainer joins the roster when the run ends (effect "recruit").
// Safe to re-run: only `npc-meet-` events are replaced. Run: npm run data:npc-events (after data:npc-trainers).
import { readFileSync, writeFileSync } from 'node:fs';

type Json = Record<string, unknown>;
const path = new URL('../src/data/events.json', import.meta.url);
const arch = (JSON.parse(readFileSync(new URL('../src/data/archetypes.json', import.meta.url), 'utf8')) as Array<Json & { id: string }>).filter((a) => a.id.startsWith('npc-'));
const file = JSON.parse(readFileSync(path, 'utf8')) as { events: Json[] };
const at = file.events.findIndex((e) => String(e.id).startsWith('npc-meet-'));
const rest = file.events.filter((e) => !String(e.id).startsWith('npc-meet-'));
const npcEvents: Json[] = [];
file.events = rest;

// NPC schedules (spec §28): when each kind of trainer is out on the road. Unlisted trainers keep a stable pair of hours from their id.
const SCHEDULES: [RegExp, string[]][] = [
  [/bug|camper|hiker|bird|youngster|lass|picnic|kid|scout/i, ['morning', 'afternoon']],
  [/fisher|swimmer|sailor|surfer/i, ['morning', 'evening']],
  [/black belt|karate|battle girl|martial/i, ['morning']],
  [/biker|punk|rocker|ruffian|gambler|thug|rowdy|delinquent|hex|goth/i, ['evening', 'night']],
  [/psychic|channeler|occult|medium|mystic|ghost|ninja|sage/i, ['night']],
];
const PERIODS = ['morning', 'afternoon', 'evening', 'night'];
const hoursFor = (a: Json): string[] => {
  const label = `${a.name} ${a.id}`;
  const hit = SCHEDULES.find(([re]) => re.test(label));
  if (hit) return hit[1];
  let h = 0;
  for (const ch of String(a.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return [PERIODS[h % 4]!, PERIODS[(h + 1) % 4]!].sort((x, y) => PERIODS.indexOf(x) - PERIODS.indexOf(y));
};

const TINTS = ['#28401c', '#1c3040', '#40301c', '#301c40', '#40281c'];
arch.forEach((a, i) => {
  const name = String(a.name);
  const types = a.signatureTypes as string[];
  const recruit = { kind: 'recruit', trainer: a.id };
  npcEvents.push({
    id: `npc-meet-${String(a.id).slice('npc-'.length)}`,
    name: `Meet ${name}`,
    group: 'Trainers and challenges',
    rarity: i < 26 ? 'common' : 'uncommon',
    minStage: 1,
    requires: [{ kind: 'period', in: hoursFor(a) }],
    scene: { cast: [a.spriteAssetId], tint: TINTS[i % TINTS.length], effect: 'none' },
    intro: `${name} is out ${hoursFor(a).join(' and ')} hours, and spots you on the road. ${String(a.unlockFlavor ?? '').replace(/^"|"$/g, '')}`.trim(),
    choices: [
      {
        label: 'Battle for a spot on your roster',
        success: { text: `${name} accepts the challenge!`, effects: [], battle: { kind: 'trainer', name, size: 2, types, levelBonus: 0, ghost: false, win: [recruit, { kind: 'research', amount: 5 }] } },
      },
      {
        label: 'Ask them to join',
        chance: 0.4,
        success: { text: `${name} grins. "Why not? Count me in."`, effects: [recruit] },
        failure: { text: `${name} shakes their head. "Beat me first."`, effects: [] },
      },
      { label: 'Walk on', success: { text: 'You wave and keep going.', effects: [] } },
    ],
  });
});
// Keep the events where they were (the order is part of how events are drawn).
file.events.splice(at < 0 ? file.events.length : at, 0, ...npcEvents);
writeFileSync(path, JSON.stringify(file, null, 1) + '\n');
console.log(`npc-meet events: ${arch.length}`);
