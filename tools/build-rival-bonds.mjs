// Builds src/data/rivalBonds.json from the compact tables below (Examples §4, §6, §9).
// Run: node tools/build-rival-bonds.mjs
import { writeFileSync } from 'node:fs';

const D = { T: 'trust', A: 'affection', R: 'respect', S: 'synchronization', C: 'confidence', U: 'autonomy', X: 'strain', H: 'sharedHistory', Y: 'hyperReadiness' };
const dl = (s) => Object.fromEntries(s.split(' ').filter(Boolean).map((p) => [D[p[0]], Number(p.slice(1))]));
// id|name|group|tags|fit (trait:weight)|delta|when|habit|visibility|after|text
// when: tM=trustMin tX=trustMax sM=strainMin sX=strainMax cX=confidenceMax uM=autonomyMin hM=hyperMin teams=needs 2 mons
const rows = `
01|Shared Meal|everyday|care,social|empathy:1|A4 T1 H1||comfort|private||{rival} learned what {mon} likes to eat.
02|Camp Routine|everyday|care|resilience:.5|A2 X-3 H1||comfort|private||{mon} has settled into a favourite spot at camp.
03|Grooming and Care|everyday|care|empathy:1|T3 A2 X-2 H1|||private||{rival} spent an evening looking after {mon}.
04|Play Session|everyday|care,social|empathy:.5|C3 A3 H1||ritual|private||{mon} spent the day playing with {rival}.
05|Quiet Companionship|everyday|care|empathy:1|T3 A2 H1||ritual|observed||{mon} now sits beside {rival} without being asked.
06|Preferred Sleeping Arrangement|everyday|care|empathy:.5|A3 T1||comfort|observed||{mon} sleeps next to {rival}'s bag.
07|Greeting Ritual|everyday|social|empathy:.5|A2 S2 H1||ritual|observed||{mon} and {rival} have a greeting they repeat every morning.
08|Comfort After a Bad Day|everyday|care|empathy:1|T4 C2 X-4 H1|sM30||private||{rival} sat with {mon} after a rough day.
09|Technique Practice|training|train|ambition:1|S4 R2 X3 H1||training|private||{rival} drilled {mon} on a hard technique.
10|Failed Drill|training|train|ambition:1|C-3 X4 H1|||private||{mon} could not get a drill right.
11|Independent Practice|training|solo,train|adaptability:.5|U4 C2 X2 H1||training|observed||{mon} practised alone and came back bolder.
12|Friendly Sparring|training|social,train|ambition:.5|S3 R3 X2 H1|teams|tell|observed||{mon} sparred with a teammate and the team fights closer.
13|Tactical Review|training|train|adaptability:1|R3 S3 H1|||private||{rival} went over the last battle with {mon}.
14|Move Experimentation|training|solo,train|adaptability:1|U3 C2 H1||developing|observed||{mon} has been trying something new.
15|Adaptive Exercise|training|train|adaptability:1|S3 U2 H1|||private||{mon} trained for a type of opponent it kept losing to.
16|Overtraining Incident|training|train|ambition:1 pride:.5|S3 X10 C-3 H1|sX70||private||{rival} pushed {mon} too hard and too long.
17|Recovery Day|training|care|empathy:1|X-10 T3 H1|sM40||private|16|{rival} gave {mon} a full day of rest.
18|Hyper Control Practice|training|train|ambition:1|Y8 S2 X3 H1|sX60||rumor||{mon} is practising keeping its power under control.
20|Technique Breakthrough|training|train|ambition:.5|C6 S3 R2 H2|sX60,cX80||observed||{mon} finally mastered its technique.
21|Fearful Refusal|emotional|conflict|pride:.5|T-3 X3 H2|sM50||observed||{mon} refused to do what {rival} asked and would not be pushed.
22|Unwanted Separation|emotional|conflict|ambition:.5|A-3 T-3 X4 H2|teams||private||{mon} was left behind for a while.
23|Jealousy|emotional|social,conflict|pride:.5|S-3 X3 H1|teams||private||{mon} grew jealous of a teammate.
24|Unexpected Attachment|emotional|care|empathy:1|A5 T3 H2|tX55||private||{mon} grew unexpectedly close to {rival}.
25|Conflict Over Tactics|emotional|conflict|pride:1|R-2 S-3 X4 H2|||observed||{mon} and {rival} disagreed over tactics.
26|Apology|emotional|care|empathy:1|T5 R3 X-3 H2|sM30||observed|25|{rival} admitted a mistake to {mon}.
27|Earned Independence|emotional|solo|adaptability:1|U8 T3 R3 H2|tM60||observed||{rival} lets {mon} make its own calls now.
28|A Broken Promise|emotional|conflict|ambition:1 pride:.5|T-8 A-3 X4 H2|||private||{rival} broke a promise to {mon}.
29|The Protective Intervention|emotional|danger,care|empathy:1|T8 A3 H3|tM40||observed||{rival} stepped in to protect {mon}.
30|The Unspoken Reconciliation|emotional|care|empathy:1|T5 A4 X-6 H3|sM30||observed|22|{mon} and {rival} made up without a word.
31|Wild Pokémon Encounter|world|danger|ambition:.5|C3 S2 H1|||rumor||{mon} faced a wild Pokémon and held its ground.
32|Rescue Operation|world|danger,social|empathy:1|T4 R3 C3 H3|||rumor||{rival} and {mon} helped someone in trouble.
33|Team Member Missing|world|danger,social|empathy:1|X4 A2 H2|teams||rumor||{mon} went missing for a night and came back.
34|Shared Environmental Challenge|world|danger,train|resilience:1|S4 R2 H2|||private||{rival} and {mon} crossed rough ground together.
35|Another Trainer's Advice|world|social|adaptability:1|R2 S2 H1|||rumor||Another trainer gave {rival} advice about {mon}.
36|Public Praise|world|public|ambition:.5|C5 A2 H1|||rumor||{mon} was praised in front of a crowd.
37|Public Embarrassment|world|public,conflict|pride:1|C-6 T-2 X3 H1|||rumor||{mon} was embarrassed in front of a crowd.
38|Raid Cooperation|world|danger,social|ambition:.5|S5 R3 H2|teams||rumor||{rival} and the team took on a raid together.
39|Hyper/Overdrive Witness Event|world|danger,public|ambition:1|Y6 C3 H2|hM30||rumor||People saw {mon} reach for a power beyond itself.
40|Unexpected Act of Compassion|world|care,social|empathy:1|A4 R4 T3 H3|||observed||{mon} did something kind for a stranger.
`.trim().split('\n');

const when = (s) => {
  const w = {};
  for (const p of s.split(',').filter(Boolean)) {
    if (p === 'teams') w.teammates = true;
    else { const n = Number(p.slice(2)); ({ tM: () => (w.trustMin = n), tX: () => (w.trustMax = n), sM: () => (w.strainMin = n), sX: () => (w.strainMax = n), cX: () => (w.confidenceMax = n), uM: () => (w.autonomyMin = n), hM: () => (w.hyperMin = n) })[p.slice(0, 2)](); }
  }
  return w;
};
const events = rows.map((r) => {
  const [n, name, group, tags, fit, delta, w, habit, visibility, after, text] = r.split('|');
  return {
    id: `offscreen-${n}`, name, group, tags: tags.split(','),
    fit: Object.fromEntries(fit.split(' ').filter(Boolean).map((p) => [p.split(':')[0], Number(p.split(':')[1])])),
    delta: dl(delta), when: when(w), ...(habit ? { habit } : {}), visibility,
    ...(after ? { after: `offscreen-${after.padStart(2, '0')}` } : {}), text,
  };
});

// Examples §4.2: how a rival treats its Pokémon after a battle. trigger: when it fits; delta: the effect on every team member.
const behaviors = [
  ['celebrates', 'Celebrates a Pokémon\'s success', 'win', { empathy: 55 }, 'C3 A2'],
  ['practices-patiently', 'Practises a difficult technique patiently', 'any', { resilience: 60, empathy: 50 }, 'S3 R2'],
  ['changes-strategy', 'Changes strategy after a Pokémon struggles', 'lose', { adaptability: 60 }, 'T3'],
  ['blames', 'Repeatedly blames a Pokémon for losing', 'lose', { pride: 65 }, 'C-3 T-3 X3'],
  ['forces-training', 'Forces repeated training without recovery', 'lose', { ambition: 65, vindictiveness: 55 }, 'S2 X6'],
  ['lets-rest', 'Lets a Pokémon rest after a difficult battle', 'lose', { empathy: 55 }, 'X-5 T2'],
  ['preferred-style', 'Uses a Pokémon\'s preferred battle style', 'win', { adaptability: 55 }, 'S2 C2'],
  ['ignores-fear', 'Ignores signs of fear or fatigue', 'lose', { pride: 60 }, 'X5'],
  ['allows-improvising', 'Allows a Pokémon to improvise', 'win', { adaptability: 60 }, 'U3 S2'],
  ['admits-mistake', 'Admits a tactical mistake', 'lose', { empathy: 55 }, 'R3 T3'],
  ['rotates-fairly', 'Rotates team members fairly', 'any', { empathy: 50, adaptability: 50 }, 'C2'],
  ['benches-after-loss', 'Repeatedly benches a Pokémon after one loss', 'lose', { pride: 60 }, 'C-3'],
  ['protects-at-cost', 'Protects a Pokémon at a competitive cost', 'lose', { empathy: 65 }, 'T8'],
  ['tournament-over-welfare', 'Prioritises a tournament result over a partner\'s welfare', 'win', { ambition: 70 }, 'X4 T-3'],
].map(([id, name, on, needs, d]) => ({ id, name, on, needs, delta: dl(d) }));

const traits = {
  brave: ['danger', 'train'], cautious: ['care'], proud: ['public', 'conflict'], playful: ['care', 'social'],
  protective: ['danger', 'social'], independent: ['solo'], anxious: ['care'], competitive: ['train', 'public'],
  curious: ['solo', 'train'], patient: ['train', 'care'], stubborn: ['conflict', 'train'], empathetic: ['social', 'care'],
};

const habits = {
  note: 'Examples §9.1 slots. Pools are generic with a few type-specific comfort habits (limited: no per-species pools yet).',
  slots: ['comfort', 'stress', 'social', 'training', 'ritual', 'tell', 'developing'],
  pools: {
    comfort: ['curls up by the fire', 'naps in the sun', 'watches the road'],
    stress: ['paces in circles', 'hides behind its trainer', 'goes very still'],
    social: ['greets strangers first', 'keeps to itself', 'stays close to the team'],
    training: ['solo drills', 'drills with a partner', 'obstacle courses', 'quiet repetition'],
    ritual: ['nudges its trainer awake', 'shares the first bite', 'waits at the camp edge'],
    tell: ['stamps before a big move', 'looks at its trainer before acting', 'puffs up when it is about to attack'],
    developing: ['experiments with a new rhythm', 'copies its trainer\'s stance', 'tests the wind before it moves'],
  },
  typeComfort: { fire: ['curls up by the fire'], water: ['splashes in every puddle'], grass: ['naps in the sun'], flying: ['perches on the highest branch'], ground: ['digs a hollow to sleep in'], electric: ['crackles quietly when content'], ghost: ['drifts near the lantern'], ice: ['sleeps in the shade'] },
};

const out = {
  note: 'Generated by tools/build-rival-bonds.mjs. Bond dimensions (Examples §4.1), trainer behaviours (§4.2), Pokémon traits (§4.3), 39 off-screen events (§6; the doc skips #19), habit slots (§9.1).',
  start: { low: 35, high: 60, strain: 10, history: 0, hyperReadiness: 0 },
  perStage: { events: 1, recentKept: 6, historyKept: 12, causeBoost: 4, traitBoost: 2, restStrainMax: 90 },
  effects: { levelBonusSync: 70, levelBonusConfidence: 70, worryStrain: 70, worryTrust: 35, loyaltyTrust: 75, loyaltyAffection: 65 },
  dimensions: Object.values(D).filter((d) => d !== 'hyperReadiness'),
  traits: Object.fromEntries(Object.entries(traits).map(([k, tags]) => [k, { loves: tags }])),
  behaviors, habits, events,
};
writeFileSync('src/data/rivalBonds.json', JSON.stringify(out, null, 1) + '\n');
console.log(events.length, 'events', behaviors.length, 'behaviours');
