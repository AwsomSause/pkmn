// Party Personality & Chemistry screens: the scene that waits on the map between nodes, the team
// Scrapbook (and its team photo), and the lines the Bonds screen adds (personality, relationships, culture).

import { relationLines, partyCulture, personalityOf } from '../core/partyLife';
import type { Scene } from '../core/partyLife';
import { services } from '../game/services';
import { Picker, type PickerRow } from './partyPanel';
import { pokemonIcon } from './sprites';
import { textStyle } from './theme';
import type { FieldMenuHost } from './fieldMenus';
import type { Content } from '../core/contentSchema';
import type { PokemonInstance, RunState } from '../core/state';

const wrap = (w: number) => ({ wordWrap: { width: w } });

/** Shows the waiting scene: its story, then one row per choice (or a single Continue). `done` gets the result lines. */
export function openPartyScene(host: FieldMenuHost, scene: Scene, done: (lines: string[]) => void): void {
  const { session } = services();
  const content = session.content;
  const run = session.run!;
  const icons = scene.uids.map((u) => [...run.party, ...run.box].find((m) => m.uid === u)).filter((m): m is PokemonInstance => !!m);
  const story: PickerRow = {
    problem: scene.choices.length > 0 ? 'Choose how to respond.' : null,
    hint: scene.choices.length > 0 ? 'Different Pokémon like different answers. The nicest-sounding one is not always the best.' : 'Press to continue.',
    draw: (s, box, w) => {
      icons.slice(0, 2).forEach((m, i) => box.add(pokemonIcon(s, content.species.get(m.speciesId)!, 36 + i * 52, 40, 1.2)));
      box.add(s.add.text(130, 10, scene.lines.join('\n\n'), textStyle(22, '#ffffff', wrap(w - 150))));
    },
  };
  const rows: PickerRow[] = [story, ...scene.choices.map((c): PickerRow => ({ problem: null, draw: (s, box, w) => box.add(s.add.text(16, 14, c.label, textStyle(24, '#fff2b0', wrap(w - 32)))) }))];
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: scene.caption,
    columns: 1,
    rowHeight: 120,
    rows,
    onSelect: (i) => {
      const choice = scene.choices.length > 0 ? i - 1 : null;
      const result = session.resolveScene(choice);
      picker.close();
      host.setPicker(null);
      done([...(choice !== null ? [scene.choices[choice]?.text ?? ''] : []), ...(result?.lines ?? []).filter((l) => l !== scene.choices[choice ?? -1]?.text)].filter(Boolean));
    },
  });
  host.setPicker(picker);
}

/** The run scrapbook: team photos and notable moments, newest first. The first row takes a team photo. */
export function openScrapbook(host: FieldMenuHost): void {
  const { session } = services();
  const content = session.content;
  const run = session.run!;
  const book = [...(run.partyLife?.scrapbook ?? [])].reverse();
  const photoReady = (run.partyLife?.photoAt ?? -1) < run.encountersCompleted;
  const nameOf = (uid: string) => {
    const m = [...run.party, ...run.box].find((x) => x.uid === uid);
    return m ? content.species.get(m.speciesId)?.name ?? m.speciesId : 'a friend';
  };
  const rows: PickerRow[] = [
    {
      problem: photoReady ? null : 'You already took a photo this stage.',
      hint: 'Take a team photo: each Pokémon strikes its own pose.',
      draw: (s, box) => box.add(s.add.text(16, 14, 'Take a team photo', textStyle(22, '#fff2b0'))),
    },
    ...book.map((e): PickerRow => ({
      problem: 'Just a memory.',
      draw: (s, box, w) => {
        box.add(s.add.text(16, 8, `${e.kind === 'photo' ? 'Photo' : e.kind === 'milestone' ? 'Milestone' : 'Moment'} · region ${e.region + 1}, stage ${e.stage + 1}${e.delta > 0 ? `  ·  chemistry +${e.delta}` : ''}`, textStyle(14, '#bfe9ff')));
        box.add(s.add.text(16, 30, e.caption, textStyle(17, '#ffffff', wrap(w - 32))));
        box.add(s.add.text(16, 72, e.poses.length > 0 ? e.poses.join('  ·  ') : e.uids.map(nameOf).join(' & '), textStyle(14, '#e8f6ff', wrap(w - 32))));
      },
    })),
  ];
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title: `Scrapbook · ${book.length} entr${book.length === 1 ? 'y' : 'ies'}`,
    columns: 1,
    rowHeight: 110,
    rows,
    onSelect: (i) => {
      if (i !== 0) return;
      session.takeTeamPhoto();
      picker.close();
      host.setPicker(null);
      host.changed('Photo taken! It is in your Scrapbook.');
    },
    onBack: () => {
      picker.close();
      host.setPicker(null);
    },
  });
  host.setPicker(picker);
}

/** Extra Bonds-screen lines for one Pokémon: its personality quirk, and how it gets on with each teammate. */
export function personalityLines(content: Content, run: RunState, mon: PokemonInstance): { header: string; relations: string } {
  const p = personalityOf(run, mon);
  const relations = relationLines(content, run, mon).slice(0, 3).join('  ·  ');
  return { header: `${p.label}: ${p.blurb} It ${p.quirk}.`, relations };
}

/** The party's atmosphere for the Bonds screen title. */
export function cultureLine(run: RunState): string {
  return partyCulture(run).name;
}
