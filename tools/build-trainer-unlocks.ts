// Writes src/data/trainerUnlocks.json: one unlock challenge per trainer, shaped by the character
// and scaled by tier (1 = easy support trainers ... 5 = Champions and apex trainers).
// Run with: npm run data:trainer-unlocks   (also reruns after `npm run data:trainer-perks`)
//
// Parts use existing profile counters; "mono"/"solo" boss feats use the counters added in run.ts
// (bossWinsMono.<type>, bossWinsSolo). Tiers scale the numbers, the number of parts and the Bank Credit cost.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Json = Record<string, unknown>;
type Arch = { id: string; name: string; unlockedByDefault: boolean; evolvedFrom?: string; unlock?: { kind: string }; signatureTypes?: string[]; signatureSpecies?: string[]; modifiers?: Array<{ type?: string; types?: string[]; value?: number }> };
type Sp = { id: string; evolutionStage: number; evolvesFrom: string | null; tags?: string[] };
const data = (f: string) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'));
const archetypes = data('archetypes.json') as Arch[];
const species = new Map((data('species.json') as Sp[]).map((s) => [s.id, s]));

const TIER5 = 'cynthia cynthia-gen-7 cynthia-masters cynthia-masters-4 red-masters red-classic blue-gen-3-champion steven-gen-6 diantha leon-masters lance wallace-gen-6 drake-gen-3 giovanni n oak alder zinnia ash-kalos geeta'.split(' ');
const TIER4 = 'ash lysandre cyrus archie-gen-6 archie-usum maxie-gen-6 ghetsis colress volo blue-gen-7 blue-classic green-classic n-classic oak-classic silver spr-hgss-silver gladion-masters-2 gladion-stance sabrina-lgpe lorelei-lgpe agatha-lgpe bruno bruno-gen-3 glacia phoebe-gen-6 drasna drayden sidney caitlin ryuki gloria-league nemona-v marnie-masters-4 raihan grusha nanu guzma plumeria olympia wulfric clair lt-surge the-royal rei emmet'.split(' ');
const TIER1 = 'ball-guy bill cheryl wicke todd-snap brigette trace trevor tierno shauna harmony mr-fuji-gen-3 sophocles sonia lillie-z wally spr-pt-dawn spr-pt-barry spr-pt-lucas spr-pt-looker spr-hgss-ethan bianca-pwt noland'.split(' ');
const TIER2 = 'brock misty brock-classic brock-masters misty-classic bugsy falkner roxanne-gen-6 brawly-gen-6 milo cilan chili cress ilima whitney erika erika-gen-3 wattson flannery gardenia calem serena brendan-ruby-sapphire brendan-emerald may-ruby-sapphire may-emerald dawn dawn-gen-4-platinum lucas lucas-gen-4-platinum barry nate rosa hilbert hilda hugh selene elio-usum lyra ethan hau-stance lana mallow hop'.split(' ');
const tierOf = (id: string): number => (TIER5.includes(id) ? 5 : TIER4.includes(id) ? 4 : TIER1.includes(id) ? 1 : TIER2.includes(id) ? 2 : 3);

const RIVALS = 'barry hop hugh nate hilbert cheren silver spr-hgss-silver gladion-masters-2 gladion-stance nemona-v gloria-league marnie-masters-4 bede calem shauna trace green-classic blue-gen-7 blue-classic sordward-shielbert'.split(' ');
const PROFS = 'elm rowan oak-classic sycamore sonia cogita colress mr-fuji-gen-3 todd-snap bill cheryl spr-pt-looker'.split(' ');
const VILLAINS = 'team-rocket archie-gen-6 archie-usum maxie-gen-6 cyrus ghetsis lysandre tabitha shelly matt guzma plumeria sordward-shielbert geeta volo'.split(' ');
const HEROES = 'ash ash-kalos brendan-ruby-sapphire brendan-emerald may-ruby-sapphire may-emerald dawn dawn-gen-4-platinum lucas lucas-gen-4-platinum ethan spr-hgss-ethan spr-pt-dawn spr-pt-lucas leaf-gen-3 selene elio-usum rosa hilda calem serena lyra'.split(' ');
const CHAMPS = 'cynthia cynthia-gen-7 cynthia-masters cynthia-masters-4 red-masters red-classic blue-gen-3-champion steven-gen-6 diantha leon-masters lance wallace-gen-6 drake-gen-3 alder zinnia'.split(' ');
const SUPPORT = 'ball-guy wicke brigette harmony tierno trevor wally noland norman'.split(' ');
const SKIP = new Set(['hex-maniac']); // earned as the Spooky Season reward

/** The trainer's type theme: listed signature types, else the type their perks boost. */
const typeOf = (a: Arch): string | undefined => a.signatureTypes?.[0] ?? a.modifiers?.find((m) => (m.value ?? 1) > 1 && (m.type || m.types?.length))?.type ?? a.modifiers?.find((m) => (m.value ?? 1) > 1 && m.types?.length)?.types?.[0];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Raised when two trainers would get the same text, so the second one picks different numbers and feats. */
let bump = 0;
const hash = (id: string, salt = 0) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7 + (salt + bump * 53) * 131);
/** Scale a tier number by a stable +-20% per trainer, rounded to a friendly step. */
const scale = (table: number[], tier: number, id: string, salt: number): number => {
  const base = table[tier - 1]!;
  const v = Math.max(1, Math.round(base * (0.8 + (hash(id, salt) % 41) / 100)));
  return base >= 1000 ? Math.round(v / 500) * 500 : base >= 100 ? Math.round(v / 10) * 10 : base >= 20 ? Math.round(v / 5) * 5 : v;
};

const total = (counter: string, atLeast: number): Json => ({ kind: 'total', counter, atLeast });
const best = (counter: string, atLeast: number): Json => ({ kind: 'best', counter, atLeast });

interface Part { req: Json; text: string; }
const WORDS: Record<string, string> = {
  gymLeadersDefeated: 'gym leaders beaten', eliteFourDefeated: 'Elite Four members beaten', championsDefeated: 'Champions beaten', regionsCleared: 'regions cleared',
  pokemonCaught: 'Pokémon caught', evolutions: 'evolutions', moneyEarned: 'money earned', moneySpent: 'money spent', tradesMade: 'trades made', raidsWon: 'raids won',
  totemsWon: 'Totems beaten', rivalBattlesWon: 'rival battles won', eventsCompleted: 'events completed', candiesEarned: 'candies earned', statsBoosted: 'stat boosts',
  healStopsUsed: 'rest stops used', runsWon: 'runs won', shiniesFound: 'shiny Pokémon found', runQuestsDone: 'Run Quests done', trainersDefeated: 'trainers defeated',
  regionsClearedNoCharm: 'regions cleared without a charm', regionsClearedWithStarter: 'regions cleared with the starter', battlesWon: 'battles won',
};
const counter = (name: string, table: number[], tier: number, id: string, salt: number, kind: 'total' | 'best' = 'total'): Part => {
  const n = scale(table, tier, id, salt);
  return { req: kind === 'total' ? total(name, n) : best(name, n), text: `${cap(WORDS[name]!)}: ${n.toLocaleString('en-US')}${kind === 'best' ? ' in one run' : ''}` };
};
const mono = (type: string, tier: number, id: string): Part => {
  const n = scale([1, 2, 3, 5, 8], tier, id, 1);
  return { req: total(`bossWinsMono.${type}`, n), text: `Win ${n} boss battle${n === 1 ? '' : 's'} with an all-${cap(type)} party` };
};
const doc = (type: string, tier: number, id: string): Part => {
  const n = scale([10, 25, 50, 100, 200], tier, id, 2);
  return { req: total(`defeatedOrCaught.${type}`, n), text: `Defeat or catch ${n} ${cap(type)}-type Pokémon` };
};
const solo = (tier: number, id: string): Part => {
  const n = scale([1, 1, 2, 4, 6], tier, id, 3);
  return { req: total('bossWinsSolo', n), text: `Win ${n} boss battle${n === 1 ? '' : 's'} with a one-Pokémon party` };
};
const seen = (tier: number, id: string): Part => {
  const n = scale([30, 60, 100, 200, 350], tier, id, 4);
  return { req: { kind: 'distinct', set: 'speciesSeen', atLeast: n }, text: `See ${n} different species` };
};
const kept = (tier: number, id: string): Part => {
  const n = scale([10, 25, 50, 100, 200], tier, id, 5);
  return { req: { kind: 'distinct', set: 'speciesCaught', atLeast: n }, text: `Catch ${n} different species` };
};
const catchSp = (id: string): Part => ({ req: { kind: 'caught', species: id }, text: `Catch ${id.split('-').map(cap).join(' ')}` });

/** A trainer's signature species, stepped back to a catchable middle form; legendaries and mythicals are skipped. */
const signatureCatch = (a: Arch): string | null => {
  for (const id of a.signatureSpecies ?? []) {
    let s = species.get(id);
    if (!s || s.tags?.some((t) => t === 'legendary' || t === 'mythical')) continue;
    while (s && s.evolutionStage >= 3 && s.evolvesFrom) s = species.get(s.evolvesFrom);
    if (s && !s.tags?.some((t) => t === 'legendary' || t === 'mythical')) return s.id;
  }
  return null;
};

type Family = 'type' | 'champ' | 'rival' | 'prof' | 'villain' | 'hero' | 'support' | 'fan';
const familyOf = (a: Arch): Family =>
  CHAMPS.includes(a.id) ? 'champ' : RIVALS.includes(a.id) ? 'rival' : PROFS.includes(a.id) ? 'prof' : VILLAINS.includes(a.id) ? 'villain' : HEROES.includes(a.id) ? 'hero' : SUPPORT.includes(a.id) ? 'support' : typeOf(a) ? 'type' : 'fan';

const FLAVOR: Record<Family, string[]> = {
  type: ['"Show me you understand my type, not just its power."', '"A true specialist is proven in the boss room."', '"Fight beside only my kind, and I will fight beside you."'],
  champ: ['"The title is earned again and again. Prove it."', '"Only someone who has stood at the top may stand with me."', '"A Champion answers to no one but the next challenger."'],
  rival: ['"Beat me, then beat my friends. Then we will talk."', '"I will join you when you have earned my respect."', '"Rivals make each other stronger. Start proving it."'],
  prof: ['"Fieldwork first. Come back with data."', '"Knowledge opens every door. Collect some."', '"A good researcher never stops cataloguing."'],
  villain: ['"Gold, nerve and a little ruthlessness."', '"Prove you can win without caring about the odds."', '"I only back those who can handle the stakes."'],
  hero: ['"Every great journey starts with a first step. Take plenty."', '"Come see the world and I will see it with you."', '"Adventure rewards the ones who keep going."'],
  support: ['"Help us out and we will help you."', '"A little hard work goes a long way."', '"Stay busy and look after your team."'],
  fan: ['"Show me you love these Pokémon as much as I do."', '"Bring my favourites into your team and I will follow."', '"Put the time in with them and I am yours."'],
};

const partsFor = (a: Arch, tier: number, family: Family): Part[] => {
  const id = a.id;
  const type = typeOf(a);
  const sig = signatureCatch(a);
  const pool: Part[] = [];
  switch (family) {
    case 'type':
      pool.push(mono(type!, tier, id), doc(type!, tier, id));
      if (sig) pool.push(catchSp(sig));
      pool.push(counter('gymLeadersDefeated', [3, 8, 16, 32, 64], tier, id, 6), counter('championsDefeated', [1, 1, 2, 4, 8], tier, id, 7));
      break;
    case 'champ':
      pool.push(counter('championsDefeated', [1, 2, 3, 5, 8], tier, id, 6), counter('runsWon', [1, 1, 2, 4, 7], tier, id, 7), solo(tier, id), counter('eliteFourDefeated', [4, 8, 16, 32, 64], tier, id, 8));
      break;
    case 'rival':
      pool.push(counter('rivalBattlesWon', [1, 3, 6, 10, 18], tier, id, 6));
      if (sig) pool.push(catchSp(sig));
      pool.push(counter('battlesWon', [30, 80, 160, 320, 640], tier, id, 7), solo(tier, id));
      break;
    case 'prof':
      pool.push(seen(tier, id), kept(tier, id), counter('evolutions', [3, 8, 15, 30, 60], tier, id, 6), counter('eventsCompleted', [3, 8, 15, 30, 60], tier, id, 7));
      break;
    case 'villain':
      pool.push(counter('moneyEarned', [3000, 10000, 25000, 60000, 150000], tier, id, 6), solo(tier, id), counter('tradesMade', [1, 2, 4, 7, 12], tier, id, 7), counter('moneySpent', [2000, 8000, 20000, 50000, 120000], tier, id, 8));
      break;
    case 'hero':
      if (sig) pool.push(catchSp(sig));
      pool.push(counter('regionsCleared', [1, 2, 4, 8, 15], tier, id, 6), counter('evolutions', [3, 8, 15, 30, 60], tier, id, 7), counter('runsWon', [1, 1, 2, 4, 7], tier, id, 8));
      break;
    case 'support':
      pool.push(counter('pokemonCaught', [10, 30, 70, 150, 300], tier, id, 6), counter('healStopsUsed', [3, 8, 15, 30, 60], tier, id, 7), counter('moneySpent', [2000, 8000, 20000, 50000, 120000], tier, id, 8), counter('tradesMade', [1, 2, 4, 7, 12], tier, id, 9));
      break;
    case 'fan':
      if (sig) pool.push(catchSp(sig));
      pool.push(counter('evolutions', [3, 8, 15, 30, 60], tier, id, 6), ...(tier >= 4 ? [counter('shiniesFound', [1, 1, 2, 3, 5], tier, id, 7)] : []), counter('candiesEarned', [20, 60, 120, 250, 500], tier, id, 8), counter('raidsWon', [1, 2, 4, 7, 12], tier, id, 9), counter('totemsWon', [1, 2, 3, 5, 8], tier, id, 10));
      break;
  }
  const count = [1, 2, 2, 3, 4][tier - 1]!;
  // Always keep the character's own first feat; fill the rest from the pool in a per-trainer order.
  const [first, ...rest] = bump > 0 && tier === 1 ? [pool[bump % pool.length]!, ...pool.filter((_, i) => i !== bump % pool.length)] : pool;
  const order = rest.map((p, i) => ({ p, k: hash(id, 40 + i) })).sort((x, y) => x.k - y.k).map((x) => x.p);
  // On a text collision, rotate which extras are picked.
  const rot = order.length ? bump % order.length : 0;
  const chosen = [first!, ...order.slice(rot), ...order.slice(0, rot)].slice(0, count);
  return chosen;
};

/** Hand-written challenges for iconic characters (replace the template). */
const CUSTOM: Record<string, { tier?: number; flavor: string; parts: (tier: number) => Part[]; note?: string }> = {
  ash: { flavor: '"Pikachu, I choose you!"', parts: (t) => [catchSp('pikachu'), counter('regionsCleared', [1, 2, 4, 8, 15], t, 'ash', 6), counter('rivalBattlesWon', [1, 3, 6, 10, 18], t, 'ash', 7)] },
  'ash-kalos': { flavor: '"Bond Phenomenon! Greninja and I are one!"', parts: (t) => [catchSp('froakie'), counter('evolutions', [3, 8, 15, 30, 60], t, 'ash-kalos', 6), solo(t, 'ash-kalos'), counter('championsDefeated', [1, 2, 3, 5, 8], t, 'ash-kalos', 7)] },
  'ball-guy': { flavor: '"Poké Balls! Get your Poké Balls here!"', parts: (t) => [counter('pokemonCaught', [10, 30, 70, 150, 300], t, 'ball-guy', 6)] },
  bill: { flavor: '"Mind if I use your PC? I have data to sort."', parts: (t) => [kept(t, 'bill'), catchSp('eevee')] },
  zinnia: { flavor: '"The Draconic Legend lives on. Prove you can fly with it."', parts: (t) => [doc('dragon', t, 'zinnia'), mono('dragon', t, 'zinnia'), counter('championsDefeated', [1, 2, 3, 5, 8], t, 'zinnia', 6), counter('raidsWon', [1, 2, 4, 7, 12], t, 'zinnia', 7)] },
  n: { flavor: '"I want to hear what your Pokémon are saying."', parts: (t) => [catchSp('zorua'), counter('candiesEarned', [20, 60, 120, 250, 500], t, 'n', 6), counter('tradesMade', [1, 2, 4, 7, 12], t, 'n', 7), counter('championsDefeated', [1, 2, 3, 5, 8], t, 'n', 8)] },
  oak: { flavor: '"Your journey ought to teach us all something new."', parts: (t) => [seen(t, 'oak'), kept(t, 'oak'), counter('evolutions', [3, 8, 15, 30, 60], t, 'oak', 6), counter('runsWon', [1, 1, 2, 4, 7], t, 'oak', 7)] },
  giovanni: { flavor: '"Power. Earn some, and I will lend you mine."', parts: (t) => [mono('ground', t, 'giovanni'), counter('moneyEarned', [3000, 10000, 25000, 60000, 150000], t, 'giovanni', 6), doc('ground', t, 'giovanni'), solo(t, 'giovanni')] },
  'team-rocket': { flavor: '"Prepare for trouble. And make it double."', parts: (t) => [catchSp('meowth'), counter('moneyEarned', [3000, 10000, 25000, 60000, 150000], t, 'team-rocket', 6)] },
  'lt-surge': { flavor: '"Show me some real grit, kid. Electric grit."', parts: (t) => [mono('electric', t, 'lt-surge'), catchSp('pikachu'), solo(t, 'lt-surge')] },
  'steven-gen-6': { flavor: '"Stones and steel. Bring me both."', parts: (t) => [mono('steel', t, 'steven-gen-6'), counter('championsDefeated', [1, 2, 3, 5, 8], t, 'steven-gen-6', 6), seen(t, 'steven-gen-6'), solo(t, 'steven-gen-6')] },
  eusine: { flavor: '"Suicune is out there. Chase it with me."', parts: (t) => [catchSp('hypno'), counter('totemsWon', [1, 2, 3, 5, 8], t, 'eusine', 6)] },
  'mr-fuji-gen-3': { flavor: '"Lost Pokémon need loving homes."', parts: (t) => [counter('candiesEarned', [20, 60, 120, 250, 500], t, 'mr-fuji', 6)] },
  'todd-snap': { flavor: '"Smile! I need great photos of rare ones."', parts: (t) => [seen(t, 'todd-snap')] },
  wicke: { flavor: '"Hospitality starts with caring for every Pokémon."', parts: (t) => [counter('healStopsUsed', [3, 8, 15, 30, 60], t, 'wicke', 6)] },
  cheryl: { flavor: '"I will heal anyone who keeps moving forward."', parts: (t) => [counter('healStopsUsed', [3, 8, 15, 30, 60], t, 'cheryl', 6)] },
  norman: { flavor: '"Show me a family that fights as one."', parts: (t) => [mono('normal', t, 'norman'), counter('regionsClearedWithStarter', [1, 1, 2, 4, 7], t, 'norman', 6)] },
};

const tierCost = [100, 250, 500, 900, 1500];

const unlocks: Json[] = [];
const used = new Set<string>();
for (const a of archetypes) {
  if (a.unlockedByDefault || a.evolvedFrom || SKIP.has(a.id) || a.unlock?.kind === 'claim') continue;
  // Hand-written unlocks from the first milestones (Brock, Misty, Giovanni...) already fit their character: only the generic "defeat N trainers" ones are replaced.
  if (a.unlock && !(a.unlock.kind === 'total' && (a.unlock as { counter?: string }).counter === 'trainersDefeated')) continue;
  const tier = CUSTOM[a.id]?.tier ?? tierOf(a.id);
  const family = familyOf(a);
  const custom = CUSTOM[a.id];
  let parts: Part[] = [];
  for (bump = 0; bump < 12; bump++) {
    parts = custom && custom.parts(tier).length > 0 ? custom.parts(tier) : partsFor(a, tier, family);
    parts = parts.slice(0, Math.max([1, 2, 2, 3, 4][tier - 1]!, 1));
    if (!used.has(parts.map((p) => p.text).join('; '))) break;
  }
  used.add(parts.map((p) => p.text).join('; '));
  bump = 0;
  const cap4 = [1, 2, 2, 3, 4][tier - 1]!;
  // Custom lines may list more feats than a low tier should ask for: keep the character's first, then cap by tier.
  parts = parts.slice(0, Math.max(cap4, 1));
  if (parts.length === 0) throw new Error(`no unlock parts for ${a.id}`);
  const requirement = parts.length === 1 ? parts[0]!.req : { kind: 'all', parts: parts.map((p) => p.req) };
  unlocks.push({
    trainerId: a.id,
    tier,
    text: parts.map((p) => p.text).join('; '),
    flavor: custom?.flavor ?? FLAVOR[family][hash(a.id) % 3]!,
    requirement,
    cost: tierCost[tier - 1]!,
    status: 'supported',
  });
}
writeFileSync(new URL('../src/data/trainerUnlocks.json', import.meta.url), JSON.stringify({ unlocks }, null, 1) + '\n');
const byTier = [1, 2, 3, 4, 5].map((t) => `T${t}: ${unlocks.filter((u) => u.tier === t).length}`).join(', ');
console.log(`trainerUnlocks.json: ${unlocks.length} challenges (${byTier})`);

const rows = unlocks.map((u) => `- ${'★'.repeat(u.tier as number)}${'☆'.repeat(5 - (u.tier as number))} ${archetypes.find((a) => a.id === u.trainerId)!.name} (\`${u.trainerId}\`, ${u.cost} credits): ${u.text}`);
writeFileSync(
  fileURLToPath(new URL('../docs/plans/trainer-unlocks.md', import.meta.url)),
  `# Trainer unlock challenges\n\nGenerated by \`npm run data:trainer-unlocks\` into \`src/data/trainerUnlocks.json\`. Every locked trainer has their own challenge (stars = tier; higher tiers ask for more parts and cost more Bank Credits). All parts run on existing counters or the new \`bossWinsMono.<type>\` / \`bossWinsSolo\` boss feats and the \`caught\` species requirement. Hand-written early unlocks (Brock, Misty, Giovanni, Cynthia, Oak, N), Trainer Evolutions (quest lines) and Hex Maniac (Spooky Season reward) keep their own routes. Limited: none; challenges count account-wide across all trainers' runs.\n\n${rows.join('\n')}\n`,
);
