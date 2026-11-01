// The Camp menu (W3): gadgets, kitchen, workshop, market and camp finds. Every action is a core/camp call through the session;
// this file only picks arguments (which item, which Pokémon, which choice) and shows the answer. The menu stays open between actions.

import type Phaser from 'phaser';
import { benchList, bagBerryChoices, campOf, campProblem, CAMP, comboList, cursedRelics, gadgetUses, getAction, hasGadget, marketLeft, marketSlots, mysteryOdds, shelfMoves, shelfTypes, slotChoices, usedHere, type CampArgs } from '../core/camp';
import { promptById } from '../core/interaction/prompt';
import { services } from '../game/services';
import { Picker, type PickerRow } from './partyPanel';
import type { FieldMenuHost } from './fieldMenus';
import { runInteractionPrompt } from './interactionPrompt';
import { textStyle } from './theme';

const GROUPS = [['gadgets', 'Gadgets'], ['kitchen', 'Kitchen'], ['workshop', 'Workshop'], ['market', 'Market'], ['camp', 'Camp']] as const;
const VIEWS: Record<string, { name: string; desc: string; group: string }> = {
  'view:cookbook': { name: 'Cookbook', desc: 'Every recipe you know, and the ones still hidden.', group: 'kitchen' },
  'view:album': { name: 'Photo Album', desc: 'Species you have photographed (kept across runs).', group: 'gadgets' },
  'view:journal': { name: 'Item Journal', desc: 'The first time you used each item.', group: 'workshop' },
  'view:stuff': { name: 'Camp Pack', desc: 'Oil, keys, bottles, scraps, pages, tokens, luck and relics.', group: 'camp' },
};

interface Choice { label: string; desc?: string; problem?: string | null }

function textRow(c: Choice): PickerRow {
  return {
    problem: c.problem ?? null,
    hint: c.desc,
    draw: (scene: Phaser.Scene, box, w) => {
      box.add(scene.add.text(16, 6, c.label, textStyle(20)));
      if (c.desc) box.add(scene.add.text(16, 34, c.desc, textStyle(14, '#d8d0e0', { wordWrap: { width: w - 32 }, maxLines: 1 })));
    },
  };
}

function choose(host: FieldMenuHost, title: string, items: Choice[], onPick: (i: number) => void, onBack: () => void, tabs?: ConstructorParameters<typeof Picker>[1]['tabs']): void {
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title,
    columns: 1,
    rowHeight: 64,
    tabs,
    rows: items.length > 0 ? items.map(textRow) : [textRow({ label: 'Nothing here yet.', problem: 'Nothing to pick.' })],
    onSelect: (i) => { picker.close(); host.setPicker(null); onPick(i); },
    onBack: () => { picker.close(); host.setPicker(null); onBack(); },
  });
  host.setPicker(picker);
}

export function openCampMenu(host: FieldMenuHost, group = 0, note = ''): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const g = GROUPS[group]![0];
  const defs = [...CAMP.actions.filter((a) => a.group === g), ...Object.entries(VIEWS).filter(([, v]) => v.group === g).map(([id, v]) => ({ id, name: v.name, desc: v.desc }))];
  const reopen = (msg: string) => openCampMenu(host, group, msg);
  const leave = () => host.changed(note);
  const items: Choice[] = defs.map((d) => {
    const real = getAction(d.id);
    const used = real ? usedHere(run, real) : 0;
    const wearText = real?.gadget && hasGadget(run, real.gadget) ? ` (${gadgetUses(run, real.gadget)} uses left)` : '';
    return { label: d.name, desc: `${d.desc}${wearText}${used > 0 ? ' · done' : ''}`, problem: real ? campProblem(content, run, d.id) : null };
  });
  const tokens = campOf(run).tokens;
  choose(host, `Camp${note ? ` · ${note.slice(0, 70)}` : ''}${tokens > 0 ? ` · ${tokens} tokens` : ''}`, items, (i) => runAction(host, defs[i]!.id, group, reopen), leave, {
    labels: GROUPS.map((x) => x[1]),
    index: group,
    onChange: (to) => { host.setPicker(null); openCampMenu(host, to, note); },
  });
}

type Back = (msg: string) => void;

function call(host: FieldMenuHost, id: string, args: CampArgs, back: Back): void {
  const r = services().session.camp(id, args);
  back(r.message);
  void host;
}

const partyChoices = (): Choice[] => {
  const { session } = services();
  return session.run!.party.map((m) => ({ label: session.content.species.get(m.speciesId)?.name ?? m.speciesId, desc: `Lv${m.level} · HP ${m.hp}` }));
};

function pickSlot(host: FieldMenuHost, title: string, kinds: Parameters<typeof slotChoices>[2], back: () => void, then: (ref: string) => void, filter: (ref: string) => boolean = () => true): void {
  const { session } = services();
  const rows = slotChoices(session.content, session.run!, kinds).filter((s) => filter(s.ref));
  choose(host, title, rows.map((s) => ({ label: s.name, desc: `×${s.count}` })), (i) => then(rows[i]!.ref), back);
}

function runAction(host: FieldMenuHost, id: string, group: number, back: Back): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const again = () => openCampMenu(host, group, '');
  const def = getAction(id);

  if (id === 'view:cookbook') {
    const list = comboList(session.profile.camp ?? { cookbook: [], album: [], journal: [], capsule: null, digs: 0 });
    const gadgets = benchList(session.profile.camp ?? { cookbook: [], album: [], journal: [], capsule: null, digs: 0 }).filter((x) => x.page);
    return choose(host, 'Cookbook', [...list.map((c) => ({ label: c.known ? c.name : '???', desc: c.hint })), ...gadgets.map((x) => ({ label: x.open ? x.name : '??? (gadget)', desc: x.open ? x.blurb : 'Needs a recipe page.' }))], again, again);
  }
  if (id === 'view:album') { const album = session.profile.camp?.album ?? []; return choose(host, `Photo Album (${album.length})`, album.map((s) => ({ label: content.species.get(s)?.name ?? s })), again, again); }
  if (id === 'view:journal') { const j = session.profile.camp?.journal ?? []; return choose(host, `Item Journal (${j.length})`, j.map((s) => ({ label: content.items.get(s)?.name ?? content.catalog.get(s)?.name ?? s })), again, again); }
  if (id === 'view:stuff') {
    const camp = campOf(run);
    const rows: Choice[] = [...Object.entries(camp.stuff).filter(([, n]) => n > 0).map(([k, n]) => ({ label: k, desc: `×${n}` })), { label: 'Luck', desc: String(camp.luck) }, { label: 'Morality', desc: String(camp.morality) }, { label: CAMP.market.tokenName + 's', desc: String(camp.tokens) }, ...camp.relics.map((r) => ({ label: CAMP.relics.find((x) => x.id === r.id)?.name ?? r.id, desc: `${CAMP.relics.find((x) => x.id === r.id)?.blurb ?? ''}${r.cursed ? ' CURSED' : ''}` }))];
    return choose(host, 'Camp Pack', rows, again, again);
  }
  if (!def) return;

  switch (def.args) {
    case 'none':
      return call(host, id, {}, back);
    case 'party':
      return choose(host, def.name, partyChoices(), (i) => call(host, id, { party: i }, back), again);
    case 'grade': {
      const run1 = async (choice?: string): Promise<void> => {
        const result = await runInteractionPrompt(host.scene, promptById('throw-ring'), { motion: session.settings.battleAnimations });
        call(host, id, { grade: result.grade, ...(choice ? { choice } : {}) }, back);
      };
      if (id === 'chest') return choose(host, 'Locked Chest', [{ label: 'Use a key', desc: `Keys: ${campOf(run).stuff.key ?? 0}` }, { label: 'Pick the lock', desc: 'A timing skill sets your chance.' }], (i) => (i === 0 ? call(host, id, { choice: 'key' }, back) : void run1('pick')), again);
      return void run1();
    }
    case 'berries': {
      const berries = bagBerryChoices(content, run);
      const picked: string[] = [];
      const step = (): void => {
        const rows: Choice[] = [...(picked.length > 0 ? [{ label: `Cook ${picked.length} berr${picked.length === 1 ? 'y' : 'ies'} now`, desc: picked.map((p) => content.catalog.get(p)?.name ?? p).join(', ') }] : []), ...berries.map((b) => ({ label: b.name, desc: `${b.flavor} · ×${b.count - picked.filter((p) => p === b.id).length}`, problem: b.count - picked.filter((p) => p === b.id).length <= 0 ? 'None left.' : null }))];
        choose(host, `Cooking Pot (${picked.length}/${CAMP.pot.maxBerries})`, rows, (i) => {
          if (picked.length > 0 && i === 0) return call(host, id, { items: picked }, back);
          picked.push(berries[picked.length > 0 ? i - 1 : i]!.id);
          if (picked.length >= CAMP.pot.maxBerries) return call(host, id, { items: picked }, back);
          step();
        }, again);
      };
      return step();
    }
    case 'pair':
      return pickSlot(host, 'Combine: first item', ['bag', 'mat', 'held', 'stuff'], again, (a) => pickSlot(host, 'Combine: second item', ['bag', 'mat', 'held', 'stuff'], again, (b) => call(host, id, { item: a, item2: b }, back)));
    case 'mix':
      return pickSlot(host, 'Mix: first potion', ['bag'], again, (a) => pickSlot(host, 'Mix: second potion', ['bag'], again, (b) => choose(host, 'Guess the ratio', CAMP.mixPotions.ratios.map((r) => ({ label: r })), (i) => call(host, id, { item: a, item2: b, choice: CAMP.mixPotions.ratios[i]! }, back), again), (r) => r.startsWith('bag:') && /potion|ether|heal|revive/.test(r)), (r) => r.startsWith('bag:') && /potion|ether|heal|revive/.test(r));
    case 'item':
      if (id === 'capsule') return choose(host, 'Time Capsule', [{ label: 'Bury an item' }, { label: 'Dig up the capsule', desc: session.profile.camp?.capsule ? `Buried: ${session.profile.camp.capsule.item}` : 'Nothing is buried.' }], (i) => (i === 0 ? pickSlot(host, 'Bury which item?', ['bag', 'mat', 'held'], again, (s) => call(host, id, { item: s }, back)) : call(host, id, { choice: 'dig' }, back)), again);
      return pickSlot(host, def.name, id === 'recycle' || id === 'distract' || id === 'sniffItem' ? ['bag'] : ['bag', 'mat', 'held'], again, (s) => call(host, id, { item: s }, back));
    case 'label':
      return pickSlot(host, 'Label which item?', ['bag', 'held'], again, (s) => choose(host, 'Label', ['Boss', 'Save', 'Trade', 'Gift', 'Heal', '(clear)'].map((l) => ({ label: l })), (i) => call(host, id, { item: s, text: i === 5 ? '' : ['Boss', 'Save', 'Trade', 'Gift', 'Heal'][i]! }, back), again));
    case 'stall':
      return pickSlot(host, 'Put which item in the window?', ['bag'], again, (s) => choose(host, 'The customer offers...', [{ label: 'Take the offer' }, { label: 'Haggle', desc: 'Half the time they pay more; otherwise they leave.' }, { label: 'Bluff with a prop', desc: 'Needs a Prop Item. Risky.', problem: hasGadget(run, 'prop') ? null : 'Needs a Prop Item.' }], (i) => call(host, id, { item: s, choice: ['accept', 'haggle', 'bluff'][i]! }, back), again));
    case 'shelf': {
      const types = shelfTypes(run);
      return choose(host, 'TM Shelf', types.map((t) => ({ label: `${t.type} TM`, desc: `×${t.count}` })), (i) => {
        const type = types[i]!.type;
        choose(host, 'Teach to...', partyChoices(), (pi) => {
          const moves = shelfMoves(content, run, type, pi);
          choose(host, 'Preview the move', moves.map((m) => { const mv = content.moves.get(m)!; return { label: mv.name, desc: `${mv.type} · ${mv.category} · power ${mv.power ?? '-'} · acc ${mv.accuracy ?? '-'}` }; }), (mi) => {
            const mon = run.party[pi]!;
            if (mon.moves.length < 4) return call(host, id, { choice: type, party: pi, move: moves[mi]! }, back);
            choose(host, 'Forget which move?', mon.moves.map((m) => ({ label: content.moves.get(m.id)?.name ?? m.id })), (fi) => call(host, id, { choice: type, party: pi, move: moves[mi]!, forget: fi }, back), again);
          }, again);
        }, again);
      }, again);
    }
    case 'choice':
      break;
  }

  // Choice actions with their own pickers.
  if (def.choices) return choose(host, def.name, def.choices.map((c) => ({ label: c })), (i) => call(host, id, { choice: def.choices![i]! }, back), again);
  if (id === 'bench') {
    const list = benchList(session.profile.camp ?? { cookbook: [], album: [], journal: [], capsule: null, digs: 0 });
    return choose(host, 'Bench', list.map((x) => ({ label: x.open ? x.name : '??? (needs a recipe page)', desc: x.open ? `${x.blurb} Cost: ${Object.entries(x.bench).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ')}` : 'Find a recipe page to unlock.', problem: x.open ? null : 'Locked.' })), (i) => call(host, id, { choice: list[i]!.id }, back), again);
  }
  if (id === 'forge') {
    const owned = CAMP.gadgets.filter((x) => hasGadget(run, x.id));
    return choose(host, 'Forge', owned.map((x) => ({ label: x.name, desc: `${gadgetUses(run, x.id)}/${x.uses} uses · mend: ${Object.entries(x.repair).map(([k, n]) => `${n} ${k}`).join(', ') || 'cannot mend'}`, problem: gadgetUses(run, x.id) >= x.uses ? 'Not worn.' : Object.keys(x.repair).length === 0 ? 'Cannot be mended.' : null })), (i) => call(host, id, { choice: owned[i]!.id }, back), again);
  }
  if (id === 'fuse') {
    const types = shelfTypes(run);
    return pickSlot(host, 'Fuse: pick a Plate or Memory', ['held'], again, (plate) => choose(host, 'Burn which TM?', types.map((t) => ({ label: `${t.type} TM`, desc: `×${t.count}` })), (i) => call(host, id, { item: plate, item2: `stuff:tm-${types[i]!.type}` }, back), again), (r) => r.slice(5) in CAMP.fuse.plates);
  }
  if (id === 'market') {
    const slots = marketSlots(run);
    const goods = [...slots.map((x) => ({ x, id: x.id, label: `${x.name} · ₽${x.price}`, desc: `${x.blurb} (${marketLeft(run, x)} left)${x.kind === 'mystery' ? ` Odds: ${mysteryOdds().map((o) => `${o.label} ${o.percent}%`).join(', ')}.` : ''}${x.risky ? ' RISKY.' : ''}`, left: marketLeft(run, x) })), ...CAMP.market.tokenGoods.map((x) => ({ x, id: x.id, label: `${x.name} · ${x.tokens} tokens`, desc: `${x.blurb} (${marketLeft(run, x)} left)`, left: marketLeft(run, x) }))];
    return choose(host, `Camp Market · ₽${run.money} · ${campOf(run).tokens} tokens`, [...goods.map((x) => ({ label: x.label, desc: x.desc, problem: x.left <= 0 ? 'Sold out.' : null })), { label: 'Lucky Charm: reroll the stock', desc: 'Once per stop.', problem: hasGadget(run, 'lucky-charm') ? null : 'Needs a Lucky Charm.' }], (i) => call(host, id, { choice: i < goods.length ? goods[i]!.id : 'reroll' }, back), again);
  }
  if (id === 'parcel') {
    return choose(host, 'Parcels and Letters', [{ label: 'Wrap a gift', desc: 'Plain, ribbon or fancy paper: nicer paper pays more.' }, { label: 'Take a sealed letter', desc: `Letters: ${campOf(run).stuff.letter ?? 0}` }, { label: 'Open what you carry', desc: 'Morality -1.' }, { label: 'Deliver it', desc: campOf(run).parcel ? `Carrying: ${campOf(run).parcel!.item}${campOf(run).parcel!.sealed ? ' (sealed)' : ''}` : 'You carry nothing.' }], (i) => {
      if (i === 0) return pickSlot(host, 'Wrap which item?', ['bag'], again, (s) => choose(host, 'Paper', ['plain', 'ribbon', 'fancy'].map((p) => ({ label: p })), (pi) => call(host, id, { item: s, choice: `wrap:${['plain', 'ribbon', 'fancy'][pi]!}` }, back), again));
      call(host, id, { choice: ['', 'letter', 'open', 'deliver'][i]! }, back);
    }, again);
  }
  if (id === 'altar') {
    const relics = campOf(run).relics;
    const picked: number[] = [];
    const step = (): void => choose(host, `Relic Altar (${picked.length}/${CAMP.altar.need})`, relics.map((r, ix) => ({ label: CAMP.relics.find((x) => x.id === r.id)?.name ?? r.id, desc: `Tier ${CAMP.relics.find((x) => x.id === r.id)?.tier} · ${CAMP.relics.find((x) => x.id === r.id)?.blurb}${r.cursed ? ' · CURSED' : ''}`, problem: r.cursed ? 'Cleanse it first.' : picked.includes(ix) ? 'Already picked.' : null })), (i) => { picked.push(i); if (picked.length >= CAMP.altar.need) return call(host, id, { choice: picked.join(',') }, back); step(); }, again);
    return step();
  }
  if (id === 'purify') {
    const bad = cursedRelics(run);
    return choose(host, `Cleanse a Curse · ₽${CAMP.purify.money} + ${Object.entries(CAMP.purify.materials).map(([k, n]) => `${n} ${k}`).join(', ')}`, bad.map((r) => ({ label: r.name, desc: 'Lift the curse.' })), (i) => call(host, id, { choice: String(bad[i]!.index) }, back), again);
  }
  void content;
}
