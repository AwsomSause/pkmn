// Party and Bag menus used outside battle (reward screen, map, shop): change
// the lead Pokémon, or use an item on a party member.

import type Phaser from 'phaser';
import { itemEvolutionTargets } from '../core/evolution';
import type { Content } from '../core/contentSchema';
import { BAG_POCKETS, bagEntries, bagEntryText, giveHeldProblem, POCKET_NAMES, type BagEntry, type BagPocket } from '../core/bag';
import type { RunState } from '../core/state';
import { itemUseProblem } from '../core/items';
import { rivalChronicle } from '../core/rivals/chronicle';
import { monRivalLines } from '../core/rivals/monRivals';
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
import { evilSummary } from '../core/evil/teams';
import { choiceHistory } from '../core/evil/choices';
import { EMOTION_NAMES } from '../core/story/emotions';
import { services } from '../game/services';
import { emotionDot, partyRows, Picker, speciesRow, type PickerLike, type PickerRow } from './partyPanel';
import { itemVisual } from './sprites';
import { COLORS, textStyle } from './theme';

export interface FieldMenuHost {
  scene: Phaser.Scene;
  /** The screen shows this picker (null when it closes) and sends it keyboard input. */
  setPicker: (picker: PickerLike | null) => void;
  /** Called after something changed, with a message for the player. */
  changed: (notice: string) => void;
  /** The map's item actions and intel; the Bag shows them and runs the action when one is picked. */
  mapItems?: { rows: () => MapItemRow[]; use: (row: MapItemRow) => void };
}

function close(host: FieldMenuHost, picker: Picker): void {
  picker.close();
  host.setPicker(null);
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
  // §11 Pokémon rivals: individual wild Pokémon with a grudge against one of yours (and any that gave themselves up).
  for (const m of monRivalLines(content, run)) {
    rivalRows.push({
      problem: null,
      hint: m.hint,
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 8, m.title, textStyle(20, '#ff9a7a', { fixedWidth: w - 28 })));
      },
    });
  }
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
  // Evil Team (spec §16) and the run's lasting choices (spec §17).
  const evil = evilSummary(content, run);
  const choiceRows = [
    ...(evil ? [{
      problem: null,
      hint: evil.lines.join('  ·  '),
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 8, `⚑ ${evil.title}`, textStyle(20, evil.color, { fixedWidth: w - 28 })));
      },
    }] : []),
    ...choiceHistory(run).map((c) => ({
      problem: null,
      hint: `${c.weight >= 3 ? 'Run-defining choice' : c.weight === 2 ? 'Lasting choice' : 'Small choice'}  ·  Region ${c.region + 1} · Stage ${c.stage + 1}`,
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 8, `${'◆'.repeat(c.weight)} ${c.text}`, textStyle(20, c.weight >= 3 ? '#ffb070' : c.weight === 2 ? '#ffe0a0' : '#d8d0e0', { fixedWidth: w - 28 })));
      },
    })),
  ];
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
    title: rows.length + rivalRows.length + legacyRows.length + storyRows.length + choiceRows.length > 0 ? 'Story so far' : 'Story so far: nothing memorable yet',
    columns: 1,
    rowHeight: 40,
    rows: [...storyRows, ...choiceRows, ...legacyRows, ...rivalRows, ...rows],
    onSelect: () => undefined,
    onBack: () => close(host, picker),
  });
  host.setPicker(picker);
}

/** A row of the map's item actions or intel (bikes, Escape Rope, Fame Checker, gym preview), shown in the Bag. */
export interface MapItemRow {
  action: string | null;
  itemId: string;
  title: string;
  text: string;
  problem: string | null;
}

interface BagRowData {
  entry: BagEntry | null;
  map: MapItemRow | null;
  pocket: BagPocket | 'map';
}

/** The pocket shown last, so coming back from a sub-menu lands on it (a fresh open starts on All). */
let lastPocket = 0;

/**
 * The unified Bag (Major Update §4/§7): every item the run owns in pockets, held items too
 * (listed with their holders, never counted twice). The map adds its item actions and intel.
 */
export function openBagMenu(host: FieldMenuHost, pocketIndex = 0): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const regionId = run.regionOrder[run.regionIndex];
  const entries = bagEntries(content, run);
  const mapRows = host.mapItems?.rows() ?? [];
  const all: BagRowData[] = entries.map((entry) => ({ entry, map: mapRows.find((m) => m.action && m.itemId === entry.itemId) ?? null, pocket: entry.pocket }));
  for (const m of mapRows) if (!all.some((r) => r.map === m)) all.push({ entry: null, map: m, pocket: 'map' });
  const pockets = [...BAG_POCKETS.filter((p) => p === 'all' || all.some((r) => r.pocket === p)), ...(mapRows.length > 0 ? (['map'] as const) : [])];
  const index = Math.min(pocketIndex, pockets.length - 1);
  lastPocket = index;
  const pocket = pockets[index]!;
  const shown = all.filter((r) => pocket === 'all' || r.pocket === pocket || (pocket === 'map' && r.map !== null));
  const problemFor = (r: BagRowData): string | null => {
    if (r.map) return r.map.problem && !r.entry ? r.map.problem : r.map.action ? r.map.problem : null;
    const e = r.entry!;
    if (e.source !== 'bag') return null;
    if (canCashIn(content, run, e.itemId)) return null;
    const item = content.items.get(e.itemId)!;
    if (!item.usableOutside) return bagEntryText(e);
    return run.party.some((mon) => itemUseProblem(content, item, mon, regionId) === null) ? null : `${bagEntryText(e)} No Pokémon needs it right now.`;
  };
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: 'Bag',
    badge: 'ui.bag.main',
    backdrop: 'ui.bag.bg',
    titleInArt: true,
    columns: 1,
    rowHeight: 64,
    tabs: {
      labels: pockets.map((p) => (p === 'map' ? 'Map' : POCKET_NAMES[p])),
      index,
      onChange: (i) => {
        close(host, picker);
        openBagMenu(host, i);
      },
    },
    rows: shown.map((r) => bagEntryRow(content, run, r, problemFor(r))),
    onSelect: (i) => {
      const r = shown[i]!;
      if (r.map?.action) {
        close(host, picker);
        host.mapItems!.use(r.map);
        return;
      }
      const e = r.entry;
      if (!e) return;
      if (e.source === 'held') {
        close(host, picker);
        openHolders(host, e);
        return;
      }
      if (e.source === 'loose') {
        close(host, picker);
        openGiveHeld(host, e);
        return;
      }
      if (e.source !== 'bag') return;
      close(host, picker);
      if (canCashIn(content, run, e.itemId)) host.changed(session.cashIn(e.itemId));
      else openItemTarget(host, e.itemId);
    },
    onBack: () => close(host, picker),
  });
  host.setPicker(picker);
}

/** One Bag row: icon, name, rarity, count, and who holds it or what it does. */
function bagEntryRow(content: Content, run: RunState, r: BagRowData, problem: string | null): PickerRow {
  const e = r.entry;
  if (!e) {
    const m = r.map!;
    return {
      problem,
      hint: m.text,
      draw: (scene, box, w, h) => {
        const icon = content.rewards.get(`item:${m.itemId}`)?.iconAssetId;
        if (icon) box.add(itemVisual(scene, icon, 26, h / 2, 2));
        box.add(scene.add.text(56, 6, m.title, textStyle(20)));
        box.add(scene.add.text(56, 34, m.text, textStyle(14, '#d8d0e0', { wordWrap: { width: w - 72 }, maxLines: 1 })));
      },
    };
  }
  const tag = e.source === 'held' ? `Held by ${e.holders.map((h) => h.name).join(', ')}` : e.source === 'loose' ? 'Not held: give it to a Pokémon' : e.source === 'bag' ? (content.items.get(e.itemId)?.usableOutside ? 'Usable' : 'Battle use') : e.source === 'map' ? 'Working now' : 'Always on';
  return {
    problem,
    hint: r.map ? `${bagEntryText(e, { action: true })} Choose it: ${r.map.text}` : bagEntryText(e) + (canCashIn(content, run, e.itemId) ? ' Nobody can use it: choose it to cash it in.' : ''),
    draw: (scene, box, w, h) => {
      if (e.iconAssetId) box.add(itemVisual(scene, e.iconAssetId, 26, h / 2, 2));
      box.add(scene.add.text(56, 6, e.name, textStyle(20)));
      const right = w - 16;
      const count = scene.add.text(right, 6, `×${e.quantity}`, textStyle(20)).setOrigin(1, 0);
      box.add(count);
      if (e.rarity) {
        const pill = scene.add.text(right - count.width - 12, 9, e.rarity.toUpperCase(), textStyle(12, `#${(COLORS.rarity[e.rarity] ?? 0xffffff).toString(16).padStart(6, '0')}`)).setOrigin(1, 0);
        box.add(pill);
      }
      box.add(scene.add.text(56, 36, `${tag}  ·  ${e.description}`, textStyle(14, e.equipped ? '#a0e0c0' : '#d8d0e0', { wordWrap: { width: w - 72 }, maxLines: 1 })));
    },
  };
}

/** A held item's holders: pick one to take the item off it (into the Bag). */
function openHolders(host: FieldMenuHost, e: BagEntry): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const holders = e.holders;
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: `Take the ${e.name} off which Pokémon?`,
    columns: 2,
    rowHeight: 78,
    rows: holders.map((h) => partyRows(content, [run.party[h.index]!], () => null, () => `×${h.copies}`, () => `${bagEntryText(e)} Choose to take it off (it waits in the Bag); Esc keeps it.`)[0]!),
    onSelect: (i) => {
      close(host, picker);
      host.changed(session.takeOffHeld(holders[i]!.index, e.itemId));
    },
    onBack: () => {
      close(host, picker);
      openBagMenu(host, lastPocket);
    },
  });
  host.setPicker(picker);
}

/** A loose held item: pick the Pokémon to give it to. */
function openGiveHeld(host: FieldMenuHost, e: BagEntry): void {
  const { session } = services();
  const run = session.run!;
  const content = session.content;
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: `Give the ${e.name} to which Pokémon?`,
    columns: 2,
    rowHeight: 78,
    rows: partyRows(content, run.party, (i) => giveHeldProblem(content, run, e.itemId, i)),
    onSelect: (i) => {
      close(host, picker);
      host.changed(session.giveHeld(e.itemId, i));
    },
    onBack: () => {
      close(host, picker);
      openBagMenu(host, lastPocket);
    },
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
      openBagMenu(host, lastPocket);
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

/** The in-run Save menu: Save, Save & Quit (title screen), Save & go back to the Hub. The run stays resumable (Continue). */
export function openSaveMenu(host: FieldMenuHost, go: (to: 'MainMenu' | 'Hub') => void): void {
  const { session } = services();
  const choices: { label: string; hint: string; run: () => void }[] = [
    { label: 'Save', hint: 'Write the run to this slot now. You keep playing.', run: () => host.changed(session.saveRunNow() ? 'Run saved.' : 'The run could not be saved.') },
    { label: 'Save & Quit', hint: 'Save, then go to the title screen. Continue picks the run up right here.', run: () => (session.saveAndLeaveRun() ? go('MainMenu') : host.changed('The run could not be saved.')) },
    { label: 'Save & go back to Hub', hint: 'Save, then visit the Hub. The run stays saved; Continue on the title screen resumes it.', run: () => (session.saveAndLeaveRun() ? go('Hub') : host.changed('The run could not be saved.')) },
  ];
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: 'Save',
    columns: 1,
    rowHeight: 56,
    rows: choices.map((c) => ({
      problem: null,
      hint: c.hint,
      draw: (scene: Phaser.Scene, box: Phaser.GameObjects.Container, w: number) => {
        box.add(scene.add.text(14, 14, c.label, textStyle(22, '#ffffff', { fixedWidth: w - 28 })));
      },
    })),
    onSelect: (i) => {
      close(host, picker);
      choices[i]!.run();
    },
    onBack: () => close(host, picker),
  });
  host.setPicker(picker);
}
