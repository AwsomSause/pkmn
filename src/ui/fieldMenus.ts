// Party and Bag menus used outside battle (reward screen, map, shop): change
// the lead Pokémon, or use an item on a party member.

import type Phaser from 'phaser';
import { itemEvolutionTargets } from '../core/evolution';
import { attributeText } from '../core/attributes';
import type { AttributeKey } from '../core/contentSchema';
import { itemUseProblem } from '../core/items';
import { canCashIn } from '../core/run';
import { services } from '../game/services';
import { bagRow, partyRows, Picker, speciesRow } from './partyPanel';

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
  const regionId = run.regionOrder[run.regionIndex];
  const picker: Picker = new Picker(host.scene, {
    title: 'Bag',
    columns: 2,
    rowHeight: 48,
    rows: allIds.map((id) => {
      const item = content.items.get(id)!;
      const anyTarget = item.usableOutside && run.party.some((mon) => itemUseProblem(content, item, mon, regionId) === null);
      if (canCashIn(content, run, id)) {
        const gives = Object.entries(item.cashIn!).map(([key, amount]) => attributeText(key as AttributeKey, amount)).join(', ');
        return { ...bagRow(content, run.inventory, id, null), hint: `Nobody can use it. Choose it to cash it in for ${gives}.` };
      }
      const problem = !item.usableOutside ? `${item.name}: ${item.description}` : anyTarget ? null : `No Pokémon needs the ${item.name} right now.`;
      return bagRow(content, run.inventory, id, problem);
    }),
    onSelect: (i) => {
      close(host, picker);
      if (canCashIn(content, run, allIds[i]!)) host.changed(session.cashIn(allIds[i]!));
      else openItemTarget(host, allIds[i]!);
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
  const regionId = run.regionOrder[run.regionIndex];
  const picker: Picker = new Picker(host.scene, {
    title: `Use the ${item.name} on which Pokémon?`,
    columns: 2,
    rowHeight: 78,
    rows: partyRows(content, run.party, (i) => itemUseProblem(content, item, run.party[i]!, regionId)),
    onSelect: (i) => {
      const targets = item.effect.kind === 'evolve' ? itemEvolutionTargets(content, run.party[i]!, itemId, regionId) : [];
      close(host, picker);
      if (targets.length > 1) {
        openEvolutionChoice(host, itemId, i, targets);
        return;
      }
      host.changed(session.useItem(itemId, i));
    },
    onBack: () => {
      close(host, picker);
      openBagMenu(host);
    },
  });
  host.setPicker(picker);
}

/** An evolution item with several possible results (Eevee and a Soothe Bell): the player picks one. */
function openEvolutionChoice(host: FieldMenuHost, itemId: string, partyIndex: number, targets: string[]): void {
  const { session } = services();
  const content = session.content;
  const name = content.species.get(session.run!.party[partyIndex]!.speciesId)!.name;
  const picker: Picker = new Picker(host.scene, {
    title: `What should ${name} evolve into?`,
    columns: 2,
    rowHeight: 48,
    rows: targets.map((id) => speciesRow(content.species.get(id)!)),
    onSelect: (i) => {
      close(host, picker);
      host.changed(session.useItem(itemId, partyIndex, targets[i]!));
    },
    onBack: () => {
      close(host, picker);
      openItemTarget(host, itemId);
    },
  });
  host.setPicker(picker);
}
