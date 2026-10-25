// Party and Bag menus used outside battle (reward screen, map, shop): change
// the lead Pokémon, or use an item on a party member.

import type Phaser from 'phaser';
import { itemUseProblem } from '../core/items';
import { services } from '../game/services';
import { bagRow, partyRows, Picker } from './partyPanel';

export interface FieldMenuHost {
  scene: Phaser.Scene;
  /** The screen shows this picker (null when it closes) and sends it keyboard input. */
  setPicker: (picker: Picker | null) => void;
  /** Called after something changed, with a message for the player. */
  changed: (notice: string) => void;
}

function close(host: FieldMenuHost, picker: Picker): void {
  picker.close();
  host.setPicker(null);
}

export function openPartyMenu(host: FieldMenuHost): void {
  const { session } = services();
  const run = session.run!;
  const picker: Picker = new Picker(host.scene, {
    title: 'Choose a Pokémon to lead the next battle',
    columns: 2,
    rowHeight: 78,
    rows: partyRows(session.content, run.party, (i) => (i === 0 ? 'Already leading.' : null), (i) => (i === 0 ? 'LEAD' : undefined), () => 'Move this Pokémon to the front.'),
    onSelect: (i) => {
      const name = session.content.species.get(run.party[i]!.speciesId)!.name;
      session.setLead(i);
      close(host, picker);
      host.changed(`${name} will lead the next battle.`);
    },
    onBack: () => close(host, picker),
  });
  host.setPicker(picker);
}

export function openBagMenu(host: FieldMenuHost): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const allIds = Object.keys(run.inventory).filter((id) => run.inventory[id]! > 0);
  const picker: Picker = new Picker(host.scene, {
    title: 'Bag',
    columns: 2,
    rowHeight: 48,
    rows: allIds.map((id) => {
      const item = content.items.get(id)!;
      const anyTarget = item.usableOutside && run.party.some((mon) => itemUseProblem(content, item, mon) === null);
      const problem = !item.usableOutside ? `${item.name}: ${item.description}` : anyTarget ? null : `No Pokémon needs the ${item.name} right now.`;
      return bagRow(content, run.inventory, id, problem);
    }),
    onSelect: (i) => {
      close(host, picker);
      openItemTarget(host, allIds[i]!);
    },
    onBack: () => close(host, picker),
  });
  host.setPicker(picker);
}

function openItemTarget(host: FieldMenuHost, itemId: string): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const item = content.items.get(itemId)!;
  const picker: Picker = new Picker(host.scene, {
    title: `Use the ${item.name} on which Pokémon?`,
    columns: 2,
    rowHeight: 78,
    rows: partyRows(content, run.party, (i) => itemUseProblem(content, item, run.party[i]!)),
    onSelect: (i) => {
      const message = session.useItem(itemId, i);
      close(host, picker);
      host.changed(message);
    },
    onBack: () => {
      close(host, picker);
      openBagMenu(host);
    },
  });
  host.setPicker(picker);
}
