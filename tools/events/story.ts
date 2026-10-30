// Story-item events: deliveries, trades and form changes for the story items in the
// item catalog (Oak's Parcel, Letter, Grams, Kyurem's stones, the Therian mirror...).
// Each opens one stop on the next stage while you hold the item, and is used up there.

import { $, RARE_HELD, any, attr, ch, ev, good, item, join, out, type Json } from './dsl.ts';

const S = 'Story items';
const EPIC = ['relic-statue', 'relic-crown', 'ruby', 'sapphire', 'sacred-ash'];
const partyHas = (species: string): Json => ({ kind: 'partySpecies', species });
const seen = (id: string): Json => ({ kind: 'eventSeen', id });
const form = (from: string, to: string, consume?: string): Json => ({ kind: 'formChange', from, to, ...(consume ? { consume } : {}) });

export const STORY_EVENTS: Json[] = [
  ev('deliver-oaks-parcel', "Oak's Parcel", S, { keyItem: 'oaks-parcel', rarity: 'uncommon', cast: ['boss.oak'], effect: 'glint' }, 'A clerk at the Poké Mart waves. "Is that parcel for Professor Oak? He told us to expect it!"', [
    ch('Hand it over', out('"Thank you! Here, for your trouble."', item('poke-ball', 5), any(...RARE_HELD))),
  ]),
  ev('deliver-letter', 'A Letter to Deliver', S, { keyItem: 'letter', rarity: 'common', effect: 'glint' }, 'A shopkeeper reads the address on your letter and gasps. "That is for me!"', [
    ch('Hand it over', out('He pays you and tells everyone about your kindness.', $(500), good(2))),
  ]),
  ev('deliver-parcel', 'A Parcel for the Nurse', S, { keyItem: 'parcel', rarity: 'common', effect: 'glint', tint: '#302018' }, 'The healer at the clinic eyes your parcel. "I have been waiting for that!"', [
    ch('Hand it over', out('She gives you something from her shelf.', any(...RARE_HELD))),
  ]),
  ev('deliver-devon-goods', 'Devon Goods', S, { keyItem: 'devon-goods', rarity: 'rare', effect: 'sparkle' }, 'A Devon Corp. agent is waiting. "Those goods! Let me return the favour at half price."', [
    ch('Buy an Epic item (₽2500)', out('A rare piece from Devon Corp.', $(-2500), any(...EPIC)), { requires: [{ kind: 'money', atLeast: 2500 }] }),
    ch('Take a payment instead', out('A fair fee.', $(1200))),
  ]),
  ev('trade-scanner', 'The Scanner Collector', S, { keyItem: 'scanner', rarity: 'rare', effect: 'glint' }, 'A collector at the dock spots your Scanner. "I will trade you something fine for it."', [
    ch('Trade for an Epic item', out('He hands over a treasure.', any(...EPIC))),
    ch('Sell it', out('Easy money.', $(2500))),
  ]),
  ev('return-gold-teeth', 'The Gold Teeth', S, { keyItem: 'gold-teeth', rarity: 'common', effect: 'sparkle', tint: '#302810' }, 'The old Safari warden is tapping his jaw. "My teeth! You found my gold teeth!"', [
    ch('Return them', out('He pays you and grins.', $(1000), good(2))),
  ]),
  ev('deliver-gram-1', 'Gram 1', S, { keyItem: 'gram-1', rarity: 'common', effect: 'glint' }, 'A Gram clerk looks up. "Gram 1! One piece of the set."', [
    ch('Deliver it', out('He pays you for it.', $(500))),
  ]),
  ev('deliver-gram-2', 'Gram 2', S, { keyItem: 'gram-2', rarity: 'common', effect: 'glint' }, 'The clerk\'s friend smiles. "Gram 2! You are kind to bring it."', [
    ch('Deliver it', out('You feel good about it.', good(2))),
  ]),
  ev('deliver-gram-3', 'Gram 3', S, { keyItem: 'gram-3', rarity: 'rare', effect: 'sparkle' }, 'Both clerks stand together. "Gram 3! With the other two, the set is complete."', [
    ch('Deliver the last Gram (after Grams 1 and 2)', out('The whole set is theirs, and they pay handsomely.', $(3000)), { requires: [seen('deliver-gram-1'), seen('deliver-gram-2')] }),
    ch('Keep the secret and leave', out('You walk away with a lighter heart.', attr('charisma', 1))),
  ]),
  ev('fix-machine-part', 'The Broken Machine', S, { keyItem: 'machine-part', rarity: 'uncommon', cast: ['trainer.worker_m'], effect: 'rattle' }, 'A shop\'s register is jammed. "If only I had that machine part!"', [
    ch('Fix the shop machine', out('The shop reopens, and the owner knocks the price down for you.', { kind: 'addStop', stop: 'shop' }, $(400))),
  ]),
  ev('return-lost-item', 'The Lost Item', S, { keyItem: 'lost-item', rarity: 'uncommon', effect: 'glint' }, 'The Lost and Found counter spots the item in your bag. "Someone has been looking for that."', [
    ch('Return it', out('The owner is grateful.', good(3), any(...RARE_HELD))),
  ]),
  ev('file-data-card', 'The Data Card', S, { keyItem: 'data-card', rarity: 'common', effect: 'glint', tint: '#103040' }, 'A researcher scans your Data Card. "This helps the whole Pokédex project."', [
    ch('Upload it', out('The research team credits you.', { kind: 'research', amount: 15 }, attr('intelligence', 1))),
  ]),
  ev('odd-keystone-spiritomb', 'The Odd Keystone', S, { keyItem: 'odd-keystone', rarity: 'rare', pokemon: 'spiritomb', effect: 'fog', tint: '#181028' }, 'The Odd Keystone hums. 108 spirits whisper from inside it.', [
    ch('Break the keystone', out('A Spiritomb follows you out of the mist.', join({ species: ['spiritomb'], lv: 0 }))),
    ch('Put it back', out('The whispers fade.', attr('luck', 1))),
  ]),
  ev('meteorite-deoxys', 'The Meteorite', S, { keyItem: 'meteorite', rarity: 'epic', pokemon: 'deoxys', effect: 'sparkle', tint: '#100820' }, 'The Meteorite shakes. A Deoxys in your party glows.', [
    ch('Attack Forme', out('Deoxys changes to its Attack Forme!', form('deoxys', 'deoxys-attack')), { requires: [partyHas('deoxys')] }),
    ch('Defense Forme', out('Deoxys changes to its Defense Forme!', form('deoxys', 'deoxys-defense')), { requires: [partyHas('deoxys')] }),
    ch('Speed Forme', out('Deoxys changes to its Speed Forme!', form('deoxys', 'deoxys-speed')), { requires: [partyHas('deoxys')] }),
    ch('Put it away', out('The meteorite goes quiet.')),
  ]),
  ev('kyurem-black', 'The Dark Stone Fusion', S, { keyItem: 'kyurem-black', rarity: 'epic', pokemon: 'kyurem-black', effect: 'spin', tint: '#080818' }, 'Kyurem and Zekrom call to each other.', [
    ch('Fuse them', out('Kyurem fuses with Zekrom into Black Kyurem!', form('kyurem', 'kyurem-black', 'zekrom')), { requires: [partyHas('kyurem'), partyHas('zekrom')] }),
    ch('Not now', out('The stones go quiet.')),
  ]),
  ev('kyurem-white', 'The Light Stone Fusion', S, { keyItem: 'kyurem-white', rarity: 'epic', pokemon: 'kyurem-white', effect: 'spin', tint: '#181830' }, 'Kyurem and Reshiram call to each other.', [
    ch('Fuse them', out('Kyurem fuses with Reshiram into White Kyurem!', form('kyurem', 'kyurem-white', 'reshiram')), { requires: [partyHas('kyurem'), partyHas('reshiram')] }),
    ch('Not now', out('The stones go quiet.')),
  ]),
  ev('tornadus-mirror', 'The Reveal Glass: Tornadus', S, { keyItem: 'tornadus-therian', rarity: 'epic', pokemon: 'tornadus-therian', effect: 'float' }, 'The mirror shows Tornadus as it truly is.', [
    ch('Show the true form', out('Tornadus becomes Therian Forme!', form('tornadus', 'tornadus-therian')), { requires: [partyHas('tornadus')] }),
    ch('Look away', out('The glass clouds over.')),
  ]),
  ev('thundurus-mirror', 'The Reveal Glass: Thundurus', S, { keyItem: 'thundurus-therian', rarity: 'epic', pokemon: 'thundurus-therian', effect: 'sparkle' }, 'The mirror shows Thundurus as it truly is.', [
    ch('Show the true form', out('Thundurus becomes Therian Forme!', form('thundurus', 'thundurus-therian')), { requires: [partyHas('thundurus')] }),
    ch('Look away', out('The glass clouds over.')),
  ]),
  ev('landorus-mirror', 'The Reveal Glass: Landorus', S, { keyItem: 'landorus-therian', rarity: 'epic', pokemon: 'landorus-therian', effect: 'shake' }, 'The mirror shows Landorus as it truly is.', [
    ch('Show the true form', out('Landorus becomes Therian Forme!', form('landorus', 'landorus-therian')), { requires: [partyHas('landorus')] }),
    ch('Look away', out('The glass clouds over.')),
  ]),
];
