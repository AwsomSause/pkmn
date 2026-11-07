// Overhaul content pack: the polish pass on generated lines (plans audit 2026-11-07 section 4; overhaul plan "a cleanup
// script, then a hand-polish pass on champions, rivals and gym leaders"). Idempotent; run: node tools/overhaul/polish-lines.mjs
//  - Archetype lines: trimmed to 90 characters by dropping filler sentences ("It's X that keeps me coming back.", "I'm known
//    around here for X.") and then middle sentences, keeping the opener and the closing catchphrase.
//  - Champion, rival and Gym Leader lines (major_trainer_lines.json): one closing tic at most ("Next. ... Next."), no broken
//    ", even with <hobby>" clauses, no stray "I live for <hobby>." in a line that has enough to say, 90 characters at most,
//    and no exact repeat within one trainer.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const MAX = 90;
const load = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const save = (p, d) => writeFileSync(new URL(p, root), JSON.stringify(d) + '\n');
const split = (t) => (t.match(/[^.!?]+[.!?]+["']?/g) ?? [t]).map((s) => s.trim()).filter(Boolean);
const TICS = new Set(["Let's go!", "Isn't it great?", 'Yay!', 'Woohoo!', 'Hee hee.', 'Naturally.', 'Quite so.', 'Precisely.', 'If you would.', 'Indeed.', "That's that.", 'Hmph.', 'Ha!', 'Tch.', 'Keep up.', 'Obviously!', 'Next.', "Can't help it!", 'Take notes!', "That's me!", 'Heh.', 'Remember that.', 'Watch yourself.', "Don't forget it.", 'Hah.']);
const FILLER = [/^It's .+ that keeps me coming back[.!]$/, /^I'm known around here for .+[.!]$/, /^I thought I knew everything about .+\.$/, /^I was wrong\.$/];

/** Keeps the first sentence and, if it fits, the last; fills with middle sentences in order while under `max`. */
function fit(sentences, max) {
  if (sentences.join(' ').length <= max || sentences.length <= 1) return sentences;
  const first = sentences[0];
  const last = sentences.length > 1 ? sentences[sentences.length - 1] : null;
  const out = [first];
  const tail = last && `${first} ${last}`.length <= max ? [last] : [];
  for (const s of sentences.slice(1, -1)) if ([...out, s, ...tail].join(' ').length <= max) out.push(s);
  return [...out, ...tail];
}

function polishArchetype(text) {
  let s = split(text);
  if (s.join(' ').length > MAX) s = s.filter((x, i) => i === 0 || !FILLER.some((re) => re.test(x)));
  return fit(s, MAX).join(' ');
}

function polishMajor(text) {
  let t = text.replace(/,? even with [a-z][^.!?]*([.!?])/g, '$1');
  let s = split(t);
  // One closing tic: drop a tic that is not the last sentence when the same tic (or any tic) closes the line.
  const lastTic = TICS.has(s[s.length - 1]);
  s = s.filter((x, i) => !(TICS.has(x) && i > 0 && i < s.length - 1 && lastTic && x === s[s.length - 1]));
  if (s.length >= 3) s = s.filter((x, i) => i === 0 || !/^I live for .+\.$/.test(x));
  // A long line loses its closing tic first.
  if (s.join(' ').length > MAX && s.length > 1 && TICS.has(s[s.length - 1])) s = s.slice(0, -1);
  return fit(s, MAX).join(' ');
}

const arch = load('src/data/overhaul/lines/archetype_lines.json');
let a = 0;
for (const e of arch.entries) { const p = polishArchetype(e.text); if (p !== e.text) { e.text = p; a++; } }
save('src/data/overhaul/lines/archetype_lines.json', arch);

const roles = Object.fromEntries(load('src/data/overhaul/major_trainers.json').entries.map((t) => [t.id, t.role]));
const POLISH = new Set(['champion', 'rival', 'gym']);
const major = load('src/data/overhaul/lines/major_trainer_lines.json');
let m = 0;
const seen = new Set();
const kept = [];
for (const e of major.entries) {
  if (POLISH.has(roles[e.trainer])) {
    const p = polishMajor(e.text);
    if (p !== e.text) { e.text = p; m++; }
    const key = `${e.trainer}|${e.text}`;
    if (seen.has(key)) { m++; continue; }
    seen.add(key);
  }
  kept.push(e);
}
major.entries = kept;
save('src/data/overhaul/lines/major_trainer_lines.json', major);
console.log(`archetype lines polished ${a}; champion/rival/gym lines polished or merged ${m}`);
