// Later chain choices that only show after a matching earlier choice (Overhaul plan: "some stage-2 options depend on your earlier choice").
// Writes `needs` (one earlier `sets` flag of the same chain) onto the options below. Idempotent: node tools/overhaul/chain-needs.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const FILE = 'src/data/overhaul/event_chains.json';
const NEEDS = {
  'roadside-stand-s2-o1': 'stand_patron',
  'fisherman-tip-s2-o2': 'bait_gift',
  'tinkering-kid-s2-o1': 'gadget_tested',
  'abandoned-backpack-s2-o1': 'pack_read',
  'abandoned-backpack-s2-o2': 'pack_taken',
  'rival-note-s2-o1': 'rival_note_read',
  'snowed-in-inn-s2-o1': 'inn_stay',
  'traveling-trainer-s2-o1': 'tt_battle',
  'crossroads-duelist-s2-o1': 'duelist_accept',
  'mirror-trainer-s2-o1': 'mirror_battle',
  'long-letter-s2-o2': 'letter_read',
  'lost-expedition-s2-o1': 'expedition_supplies',
  'marathon-of-three-s2-o1': 'marathon_join',
  'two-gym-feud-s2-o2': 'feud_mediate',
  'the-trainer-with-no-name-s2-o1': 'nn_battle',
  'the-borrowed-badge-s2-o1': 'bb_lend',
  'the-friend-you-didnt-make-s2-o1': 'fm_berry',
};
const j = JSON.parse(readFileSync(FILE, 'utf8'));
let n = 0;
for (const c of j.entries) for (const s of c.stages) for (const o of s.options) if (NEEDS[o.id]) { o.needs = NEEDS[o.id]; n++; }
if (n !== Object.keys(NEEDS).length) throw new Error(`matched ${n} of ${Object.keys(NEEDS).length} options`);
writeFileSync(FILE, JSON.stringify(j, null, 1) + '\n');
console.log(`chain needs: ${n} options`);
