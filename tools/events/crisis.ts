// Regional Crisis reports and the Rival Tournament bracket (Techno §7A/§7B, Electric §2E).
// Crisis events show once the region's meter is 2 or more and move the meter (crisis) and the Aid gathered for its boss.
// The bracket: an entry stop, then one round per stage (always placed until played), then the final.

import { $, any, ch, cure, ev, eggMove, fight, flag, fr, gym, good, heal, peace, reveal, leave, lv, money, out, rp, trainer, TREASURE, VITAMINS, type Json } from './dsl.ts';

const D = 'Regional Crisis';
const T = 'Rival Tournament';
const crisis = (atLeast: number, atMost = 5): Json => ({ kind: 'crisis', atLeast, atMost });
const eff = {
  crisis: (amount: number): Json => ({ kind: 'crisis', amount }),
  aid: (amount = 1): Json => ({ kind: 'aid', amount }),
  round: (round: number): Json => ({ kind: 'tournament', round }),
};

const report = (id: string, name: string, intro: string, tint: string, help: string, prep: string): Json =>
  ev(id, name, D, { rarity: 'uncommon', minStage: 2, requires: [crisis(2)], cast: ['trainer.psychic_m'], effect: 'glint', tint }, intro, [
    ch(help, out('You pitch in at once. People remember it, and some of them promise to stand with you.', eff.crisis(-2), eff.aid(1), good(2), rp(15))),
    ch(prep, out('You gather what the region needs most. The trouble eases a little.', eff.crisis(-1), eff.aid(1), any(...VITAMINS)), { requires: [money(200)], fail: leave() }),
    ch('Ignore it and keep moving', out('You are not the only one who walks on. The trouble keeps growing, but a grateful merchant pays you for your silence.', eff.crisis(1), $(300), flag('ignored-crisis'))),
  ]);

export const CRISIS_EVENTS: Json[] = [
  report('crisis-report-industry', 'Smoke on the Horizon', 'A factory on the edge of town has gone wrong. Smoke is rolling over the fields and the workers are waving for help.', '#2a2018', 'Help clear the site (safe)', 'Bring supplies (₽200)'),
  report('crisis-report-flood', 'The River Is Rising', 'The river has burst its banks. Families are carrying what they can to higher ground.', '#1a2838', 'Help carry people to safety (safe)', 'Bring sandbags and supplies (₽200)'),
  report('crisis-report-outbreak', 'Something Is Making Pokémon Sick', 'Pokémon across the region are coming down with the same fever. The local ranger looks exhausted.', '#1f2a1d', 'Help treat them (safe)', 'Bring medicine (₽200)'),
  report('crisis-report-blackout', 'The Lights Went Out', 'Every light in the next town is dark. A stranger stands at the generator: "Whatever it is, it is getting worse."', '#14141f', 'Help restore the power (safe)', 'Bring spare parts (₽200)'),
  ev('crisis-old-friend', 'They Heard You Were Here', D, { rarity: 'rare', minStage: 3, requires: [crisis(3), { kind: 'rivalMet', atLeast: 2 }], cast: [], effect: 'hearts', tint: '#2a2038' },
    'A rival you have fought more than once is waiting at the town gate, team at full strength. "Whatever this is, you will not face it alone. Not again."', [
      ch('Fight side by side', out('You stand together. Your Pokémon feel the difference.', eff.crisis(-2), eff.aid(2), lv(1, 'party'), heal(0.5))),
      ch('Thank them, but go alone', out('They nod. "Your call."', eff.crisis(-1))),
    ]),
];

const entry = (id: string, round: number, name: string, intro: string, cls: string, size: number, lvBonus: number, win: Json[], yes: string): Json =>
  ev(id, name, T, { rarity: 'common', minStage: 2, requires: [{ kind: 'tournament', round }], cast: ['trainer.psychic_m'], effect: 'sparkle', tint: '#2a1d3a' }, intro, [
    ch(yes, fight('The crowd roars as the match begins.', trainer(cls, { size, lv: lvBonus, win }))),
    ch('Withdraw from the bracket', out('You hand back your number. The bracket carries on without you.', eff.round(9))),
  ]);

export const TOURNAMENT_EVENTS: Json[] = [
  ev('tournament-entry', 'The Rival Circuit', T, { rarity: 'rare', minStage: 3, requires: [{ kind: 'rivalMet', atLeast: 1 }, { kind: 'tournament', round: 0 }, money(300)], cast: ['trainer.psychic_m'], effect: 'sparkle', tint: '#2a1d3a' },
    'A banner stretches across the plaza: the Rival Circuit. Trainers you have crossed paths with are signing up. The entry fee is ₽300, and the bracket runs over the next stages.', [
      ch('Enter the circuit (₽300)', out('You are in. Your first match comes at the next stop.', $(-300), eff.round(1))),
      ch('Watch from the stands', out('You cheer from the crowd and learn how the best of them fight.', rp(10), eff.round(9))),
    ]),
  entry('tournament-quarter', 1, 'Circuit: Quarterfinal', 'Your first match. A lively crowd fills the stands.', 'Circuit Trainer', 3, 0, [$(500), eff.round(2)], 'Play the quarterfinal'),
  entry('tournament-semi', 2, 'Circuit: Semifinal', 'The field has thinned. Your opponent has clearly studied your last match.', 'Circuit Ace', 4, 1, [$(900), eff.round(3), rp(20)], 'Play the semifinal'),
  entry('tournament-final', 3, 'Circuit: The Final', 'The final. The best of the circuit stands across from you, and the whole plaza has gone quiet.', 'Circuit Champion', 5, 2, [$(2000), any(...TREASURE), rp(60), eff.round(9), good(2), flag('won-circuit')], 'Play the final'),
];

export const GAUNTLET_EVENTS: Json[] = [
  ev('rival-gauntlet-entry', 'The Rival Gauntlet', T, { rarity: 'rare', minStage: 4, requires: [{ kind: 'rivalMet', atLeast: 2 }, { kind: 'gauntlet', active: false }], cast: ['trainer.psychic_m'], effect: 'sparkle', tint: '#38202a' },
    'A hand-painted sign on the wall: "Everyone you have ever beaten wants a word." Rivals you have crossed paths with are lining up, each with the team they have trained since.', [
      ch('Take on the gauntlet', out('Word spreads fast. One rival will meet you on each of the next stops, in order of how dangerous they are. Beat them all for a big purse.', { kind: 'gauntlet', rivals: 3 })),
      ch('Not today', leave()),
    ]),
];

const clue = (id: string, name: string, intro: string, tint: string, look: string): Json =>
  ev(id, name, 'Grand-Enemy Hunt', { rarity: 'uncommon', minStage: 3, requires: [{ kind: 'hunt', atLeast: 0, atMost: 2 }], cast: [], effect: 'fog', tint }, intro, [
    ch(look, out('You piece it together. It is a little more than a rumour now.', { kind: 'hunt' }, rp(20))),
    ch('Leave it', leave()),
  ]);

export const HUNT_EVENTS: Json[] = [
  clue('hunt-clue-scorch', 'Scorch Marks in a Perfect Circle', 'The grass is burned in a ring, as wide as a house. Nothing living would do this. Something very large landed here.', '#2a1d18', 'Study the marks'),
  clue('hunt-clue-witness', 'A Shaken Witness', 'A ranger sits on a stump with a blanket over her shoulders. "It was in the clouds. It looked at me. It was not afraid of me."', '#1d2230', 'Hear her out'),
  clue('hunt-clue-feather', 'A Feather That Hums', 'A single feather lies on the road. It hums faintly, and every Pokémon you own turns to look at it.', '#1a2630', 'Take the feather'),
  ev('hunt-lair', 'Where the Storm Rests', 'Grand-Enemy Hunt', { rarity: 'rare', minStage: 4, requires: [{ kind: 'hunt', atLeast: 3 }], cast: ['trainer.psychic_m'], effect: 'glint', tint: '#14141f' },
    'Everything you have gathered points to one place. A figure in a storm-grey coat steps out and bows. "You have been looking for us. Then show us what you know."', [
      ch('Face the herald', fight('Lightning splits the sky as the herald sends out its team.', trainer('Storm Herald', { size: 4, lv: 3, win: [$(1500), any(...TREASURE), rp(80), { kind: 'hunt', finish: true }] }))),
      ch('Not yet', leave()),
    ]),
];

export const CHAMPION_EVENTS: Json[] = [
  ev('champion-defense', 'The Champion Who Came Before', 'Hall of Fame', { rarity: 'rare', minStage: 6, requires: [{ kind: 'championGhost' }], cast: ['trainer.psychic_m'], effect: 'sparkle', tint: '#2a2410' },
    'A banner bears the name of a champion team you built in another life. Today the Hall has rebuilt that team and put it on the field. It is not a replay of how you won, just the same Pokémon at the same strength, fighting as hard as they know how.', [
      ch('Defend your name', fight('The old champions walk out.', trainer('Hall of Fame Team', { size: 6, ghost: true, win: [$(3000), any(...TREASURE), rp(100), good(2)] }))),
      ch('Salute and walk on', out('You tip your cap to the old team and leave them to their stage.', rp(10))),
    ]),
  ev('retired-team', 'The Team That Fell Short', 'Hall of Fame', { rarity: 'rare', minStage: 4, requires: [{ kind: 'retiredGhost' }], cast: ['trainer.psychic_m'], effect: 'glint', tint: '#1c1c22' },
    'A weathered banner hangs over an empty field. It names a team from a run that never finished. Today the Hall has set that team out again, same Pokémon, same strength, and they have something to prove.', [
      ch('Give them the rematch', fight('The retired team takes the field.', trainer('Retired Team', { size: 6, retired: true, win: [$(2000), any(...TREASURE), rp(80), good(2)] }))),
      ch('Let them rest', out('You nod to the old team. They have earned their quiet.', rp(10))),
    ]),
];

const feud = (choice: string): Json => ({ kind: 'feud', choice });
export const FEUD_EVENTS: Json[] = [
  ev('rival-feud', 'Two Rivals, One Argument', 'Rival Feud', { rarity: 'uncommon', minStage: 3, requires: [{ kind: 'feud' }], cast: ['trainer.psychic_m'], effect: 'glint', tint: '#2a1d1d' },
    'Two trainers you have both met are in the middle of the road, shouting. Each sees you and demands you take a side. A crowd is already gathering.', [
      ch('Back the stronger rival', out('You stand beside them. The crowd goes quiet.', feud('first'), fr(3, 'party'))),
      ch('Back the underdog', out('You stand beside them. The crowd goes quiet.', feud('second'), fr(3, 'party'))),
      ch('Stay out of it', out('You walk through the crowd without a word.', feud('stay-out'), rp(10))),
      ch('Work the crowd (risky)', out('While everyone is watching them, you collect a fair amount from the distracted crowd.', feud('exploit'), $(800)), { chance: 0.7, fail: out('Someone spots you. You leave in a hurry with nothing, and both rivals saw it.', feud('exploit')) }),
    ]),
];

// Between-stage interactions (catalog 38): a camp rest spot where the team picks one thing to do.
export const CAMP_EVENTS: Json[] = [
  ev('camp-council', 'Camp Council', 'Camp', { stop: 'rest', rarity: 'uncommon', minStage: 2, effect: 'hearts', tint: '#20281f' },
    'A quiet camp between two roads. You have an hour. Your team is looking at you to decide how to spend it.', [
      ch('Study a move together', out('Your lead works on a technique it has been curious about.', eggMove(), fr(3, 'lead')), { fail: out('Nothing clicks today, but the effort counts.', fr(3, 'lead')), chance: 0.6 }),
      ch('Settle a disagreement', out('You listen to both sides. The air clears, and the team is closer for it.', fr(8, 'party'), peace(2))),
      ch('Scout ahead', out('You climb a ridge and see the road ahead.', reveal(), gym())),
      ch('Care for the injured', out('You tend every scrape and bruise.', heal(0.5), cure())),
    ]),
];

// Run-defining relics (catalog 96): three unusual relics, each with an upside and a clear downside.
const relic = (id: string, name: string, effects: Json[]): Json => ({ kind: 'relic', id, name, effects });
export const RELIC_EVENTS: Json[] = [
  ev('relic-shrine', 'The Relic Shrine', 'Relics', { rarity: 'rare', minStage: 4, cast: [], effect: 'glint', tint: '#2a2410' },
    'Three relics rest on a stone table. A plaque reads: "Each gift has its price. You may take only one."', [
      ch('The Glass Crown (more Hyper, tougher rivals)', out('The crown hums on your head. Rivals will feel it too.', relic('glass-crown', 'Glass Crown', [{ kind: 'hyperChanceMultiplier', value: 1.5 }, { kind: 'rivalLevelOffset', value: 3 }]))),
      ch("The Wanderer's Compass (more rare finds, weaker catches)", out('The needle spins toward strange places.', relic('wanderer-compass', "Wanderer's Compass", [{ kind: 'encounterWeightMultiplier', group: 'rare', value: 1.6 }, { kind: 'catchLevelOffset', value: -2 }]))),
      ch('The Heavy Heart (an extra held item, slower evolution)', out('Your Pokémon feel steadier, and slower to change.', relic('heavy-heart', 'Heavy Heart', [{ kind: 'itemSlotOffset', value: 1 }, { kind: 'evolutionLevelOffset', value: 4 }]))),
      ch('Leave them', leave()),
    ]),
];
