// Party and Bag menus used outside battle (reward screen, map, shop): change
// the lead Pokémon, or use an item on a party member.

import type Phaser from 'phaser';
import { itemEvolutionTargets } from '../core/evolution';
import { attributeText } from '../core/attributes';
import type { AttributeKey } from '../core/contentSchema';
import { itemUseProblem } from '../core/items';
import { rivalChronicle } from '../core/rivals/chronicle';
import { playerFame, protagonistTitle, worldBoards } from '../core/rivals/recognition';
import { pastUltimateRivals } from '../core/rivals/legacy';
import { ULTIMATE_EMBLEM } from '../core/rivals/ultimate';
import { standingSummary } from '../core/rivals/standing';
import { boxCapacity } from '../core/trainerPerks';
import { runLevelCap } from '../core/regions';
import { runPerks } from '../core/archetypes';
import { canCashIn, partyCapacity } from '../core/run';
import { legacyCard } from '../core/story/legacy';
import { chronicleStories } from '../core/story/storybook';
import { EMOTION_NAMES } from '../core/story/emotions';
import { services } from '../game/services';
import { bagRow, emotionDot, partyRows, Picker, speciesRow } from './partyPanel';
import { textStyle } from './theme';

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
    glass: true,
    title: `Choose a Pokémon to lead the next battle  ·  Level cap ${runLevelCap(session.content, run)}`,
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

/** The PC: party Pokémon on the left list go in, PC Pokémon come out. One picker, party first, then the PC. */
export function openBoxMenu(host: FieldMenuHost): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const capacity = boxCapacity(runPerks(content, run));
  const partyFull = run.party.length >= partyCapacity(content, run);
  const rows = [
    ...partyRows(content, run.party, () => (run.party.length <= 1 ? 'The party needs one Pokémon.' : run.box.length >= capacity ? 'The PC is full.' : null), () => 'PARTY', () => 'Send this Pokémon to the PC.'),
    ...partyRows(content, run.box, () => (partyFull ? 'Your party is full.' : null), () => 'PC', () => 'Bring this Pokémon into the party.'),
  ];
  const picker: Picker = new Picker(host.scene, {
    title: `PC (${run.box.length}/${capacity})`,
    columns: 2,
    rowHeight: 78,
    rows,
    onSelect: (i) => {
      const inParty = i < run.party.length;
      const mon = inParty ? run.party[i]! : run.box[i - run.party.length]!;
      const name = content.species.get(mon.speciesId)!.name;
      if (inParty) session.depositToBox(i);
      else session.withdrawFromBox(i - run.party.length);
      close(host, picker);
      host.changed(inParty ? `${name} was sent to the PC.` : `${name} joined the party.`);
    },
    onBack: () => close(host, picker),
  });
  host.setPicker(picker);
}

/** How many of the newest chronicle entries the Story screen lists. */
const STORY_ROWS = 60;

/**
 * The Story screen: the run's chronicle, newest first. Each entry shows a dot for each of
 * its Seven Emotions tags in that emotion's colour, who it happened to, and where.
 */
export function openStoryMenu(host: FieldMenuHost): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const colors = content.story.emotions.colors;
  const entries = [...run.story.chronicle].sort((a, b) => b.seq - a.seq).slice(0, STORY_ROWS);
  const who = (uid: string) => {
    const speciesId = run.story.histories[uid]?.speciesId ?? run.party.find((m) => m.uid === uid)?.speciesId;
    return speciesId ? content.species.get(speciesId)?.name : undefined;
  };
  const rivalRows = rivalChronicle(content, run).map((r) => {
    const quest = r.quest.length > 0 ? `  Quest: ${r.quest.map((q) => `${q.done ? '✓' : '○'} ${q.text}`).join('; ')}.` : '';
    return {
      problem: null,
      hint: `World: ${r.world}.${r.signature ? `  Ace: ${r.signature}.` : ''}  ${r.summary}  ${r.memory}${r.bonds.length > 0 ? `  Team: ${r.bonds.join('; ')}.` : ''}${quest}`,
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 8, `${r.ultimate ? `${ULTIMATE_EMBLEM} Ultimate Rival` : '★ Rival'} (${r.state}): ${r.title}`, textStyle(20, '#f0c028', { fixedWidth: w - 28 })));
      },
    };
  });
  // Previous Ultimate Rivals: the rivals that defined earlier runs, from the account archive.
  for (const past of pastUltimateRivals(session.profile)) {
    const cls = content.trainers.get(past.classId)?.name ?? 'Trainer';
    const ended = past.resolution === 'good' ? 'ended as friends' : past.resolution === 'bad' ? 'ended in bitterness' : `ended as ${past.state}`;
    rivalRows.push({
      problem: null,
      hint: `${cls} ${past.name} fought you ${past.encounters} time${past.encounters === 1 ? '' : 's'} and ${ended}.${past.team?.length ? ` Team: ${past.team.map((id) => content.species.get(id)?.name ?? id).join(', ')}.` : ''}`,
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 8, `Previous Ultimate Rival: ${cls} ${past.name}`, textStyle(20, '#c8a8ff', { fixedWidth: w - 28 })));
      },
    });
  }
  // World recognition: your title, then posters, headlines, the Champion board and the rival leaderboard.
  const title = protagonistTitle(run);
  for (const b of [...worldBoards(content, run)].reverse()) {
    rivalRows.unshift({
      problem: null,
      hint: b.text,
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 8, b.text, textStyle(18, '#ffd28a', { fixedWidth: w - 28 })));
      },
    });
  }
  rivalRows.unshift({
    problem: null,
    hint: `Titles change how people talk to you, never your battles. Fame ${playerFame(run)}.`,
    draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
      box.add(scene.add.text(14, 8, `You are known as: ${title.name}`, textStyle(20, '#ffe080', { fixedWidth: w - 28 })));
    },
  });
  const standing = standingSummary(run);
  if (standing) {
    rivalRows.unshift({
      problem: null,
      hint: standing.hint,
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 8, standing.title, textStyle(20, '#9be39b', { fixedWidth: w - 28 })));
      },
    });
  }
  const legacyRows = run.party.flatMap((m) => {
    const card = legacyCard(content, run, m.uid);
    if (!card || (card.titles.length === 0 && card.tags.length === 0)) return [];
    const name = content.species.get(card.speciesId)?.name ?? card.speciesId;
    return [{
      problem: null,
      hint: [card.signature && `Signature: ${card.signature}`, card.greatest.length > 1 && `Greatest moments: ${card.greatest.join('; ')}`].filter(Boolean).join('  ·  '),
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 8, `${name}: ${[...card.titles, ...card.tags].join(' · ')}`, textStyle(20, '#7fe3ff', { fixedWidth: w - 28 })));
      },
    }];
  });
  const storyRows = chronicleStories(content, run).map((st) => ({
    problem: null,
    hint: `${st.body}  ·  ${st.tags.join(' · ')}`,
    draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
      box.add(scene.add.text(14, 8, `📖 ${st.title}`, textStyle(20, '#ffd9a0', { fixedWidth: w - 28 })));
    },
  }));
  const rows = entries.map((entry) => {
    const names = entry.actors.map(who).filter(Boolean).join(' & ');
    const where = `Region ${entry.where.region + 1}${entry.where.stage !== null ? ` · Stage ${entry.where.stage + 1}` : ''}`;
    const feelings = entry.emotions.map((e) => EMOTION_NAMES[e]).join(', ');
    return {
      problem: null,
      hint: [where, feelings && `Feelings: ${feelings}.`].filter(Boolean).join('  ·  '),
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        entry.emotions.forEach((e, i) => box.add(emotionDot(scene, 22 + i * 18, 20, colors[e])));
        box.add(scene.add.text(52, 8, `${names ? `${names}: ` : ''}${entry.text}`, textStyle(20, '#ffffff', { fixedWidth: w - 200 })));
        box.add(scene.add.text(w - 12, 10, where, textStyle(16, '#a69cb4')).setOrigin(1, 0));
      },
    };
  });
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: rows.length + rivalRows.length + legacyRows.length + storyRows.length > 0 ? 'Story so far' : 'Story so far: nothing memorable yet',
    columns: 1,
    rowHeight: 40,
    rows: [...storyRows, ...legacyRows, ...rivalRows, ...rows],
    onSelect: () => undefined,
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
    glass: true,
    title: 'Bag',
    badge: 'ui.bag.main',
    backdrop: 'ui.bag.bg',
    titleInArt: true,
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
    glass: true,
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
    glass: true,
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
