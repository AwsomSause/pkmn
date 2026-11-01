// Pocket Town menus (W7): the building list, each building's actions and the little games they use.
// Every rule lives in core/town; this file only picks arguments (which option, which grade) and shows the answer.

import type Phaser from 'phaser';
import { contractBoard, contractDone } from '../core/contracts';
import { promptById } from '../core/interaction/prompt';
import { basementCode, buildingProblem, currentSeason, dummyHit, dummyMoves, elevatorFloors, forecast, getBuilding, guestbook, jukeboxTracks, lastTeam, ledger, LEDGER_FILTERS, LEDGER_SORTS, collections, optionsOf, ownedSet, quizQuestion, rosterOpen, statueTarget, theatreList, TOWN, todaysQuests, townOf, townProblem, townStats, townWeather, trackView, trophies, localDay, type LedgerFilter, type LedgerSort, type TownAction, type TownBuilding } from '../core/town';
import { services } from '../game/services';
import { playCry, playMusicLazy } from './audio';
import { runInteractionPrompt } from './interactionPrompt';
import { Picker, type PickerRow } from './partyPanel';
import { COLORS, textStyle } from './theme';

interface Choice { label: string; desc?: string; problem?: string | null }
export interface TownHost { scene: Phaser.Scene; setPicker(p: Picker | null): void; refresh(note: string): void; setDecorMode?(on: boolean): void; enter?(b: TownBuilding): void }

const motion = () => services().session.settings.battleAnimations as 'full' | 'reduced' | 'off';

function row(c: Choice): PickerRow {
  return {
    problem: c.problem ?? null,
    hint: c.desc,
    draw: (scene, box, w) => {
      box.add(scene.add.text(16, 6, c.label, textStyle(20)));
      if (c.desc) box.add(scene.add.text(16, 34, c.desc, textStyle(14, '#d8d0e0', { wordWrap: { width: w - 32 }, maxLines: 1 })));
    },
  };
}

function choose(host: TownHost, title: string, items: Choice[], onPick: (i: number) => void, onBack: () => void, opts: { columns?: 1 | 2 | 3; tabs?: ConstructorParameters<typeof Picker>[1]['tabs'] } = {}): void {
  const picker: Picker = new Picker(host.scene, {
    glass: true,
    title,
    columns: opts.columns ?? 1,
    rowHeight: 64,
    tabs: opts.tabs,
    rows: items.length > 0 ? items.map(row) : [row({ label: 'Nothing here yet.', problem: 'Nothing to pick.' })],
    onSelect: (i) => { picker.close(); host.setPicker(null); onPick(i); },
    onBack: () => { picker.close(); host.setPicker(null); onBack(); },
  });
  host.setPicker(picker);
}

/** Read-only lines (stats, guestbook, shelves...). */
function show(host: TownHost, title: string, lines: Choice[], back: () => void, onPick?: (i: number) => void): void {
  choose(host, title, lines, (i) => (onPick ? onPick(i) : back()), back);
}

const now = () => new Date();
const todayKey = () => localDay(now());

// ---------- the building list ----------

export function openTown(host: TownHost, leave: () => void, note = ''): void {
  const { session } = services();
  const p = session.profile;
  const list = TOWN.buildings.filter((b) => !b.hidden || !buildingProblem(p, b));
  const t = townOf(p);
  choose(host, `Pocket Town${note ? ` · ${note.slice(0, 80)}` : ''}${t.pins.length ? ` · ${t.pins.length} pinned` : ''}`, list.map((b) => ({ label: b.name, desc: b.blurb })), (i) => {
    session.visitTown(list[i]!.id);
    host.enter?.(list[i]!);
    openBuilding(host, list[i]!, () => openTown(host, leave), leave);
  }, leave, { columns: 2 });
}

function openBuilding(host: TownHost, b: TownBuilding, back: () => void, leave: () => void, note = ''): void {
  const { session } = services();
  const rows = b.actions.map((a) => ({ label: a.name, desc: a.desc, problem: townProblem(session.content, session.profile, a, now()) }));
  const again = (msg: string) => { host.refresh(msg); openBuilding(host, b, back, leave, msg); };
  choose(host, `${b.name}${note ? ` · ${note.slice(0, 90)}` : ''}`, rows.map((r) => ({ label: r.label, desc: r.desc, problem: null })), (i) => {
    const a = b.actions[i]!;
    const problem = rows[i]!.problem;
    if (problem && a.kind !== 'view') return again(problem);
    runAction(host, b, a, (msg) => again(msg));
  }, back);
}

function call(a: TownAction, args: Parameters<ReturnType<typeof services>['session']['town']>[1], done: (msg: string) => void): void {
  const r = services().session.town(a.id, args);
  done(r.message);
}

function runAction(host: TownHost, b: TownBuilding, a: TownAction, done: (msg: string) => void): void {
  const { session } = services();
  const p = session.profile;
  const again = () => openBuilding(host, b, () => openTown(host, () => host.refresh('')), () => host.refresh(''));
  const grade = async (choice?: string): Promise<void> => {
    const g = a.prompt ? (await runInteractionPrompt(host.scene, promptById(a.prompt), { motion: motion() })).grade : 'ok';
    call(a, { grade: g, ...(choice ? { choice } : {}) }, done);
  };
  switch (a.kind) {
    case 'grade': {
      if (!a.dynamic) return void grade();
      const opts = optionsOf(session.content, p, a, now());
      return choose(host, a.name, opts.map((o) => ({ label: o.label, desc: o.desc })), (i) => void grade(opts[i]!.id), again);
    }
    case 'pick': {
      const opts = optionsOf(session.content, p, a, now());
      return choose(host, a.name, opts.map((o) => ({ label: o.label, desc: o.desc || (o.cost ? costText(o.cost) : ''), problem: null })), (i) => call(a, { choice: opts[i]!.id }, done), again);
    }
    case 'buy': {
      const t = townOf(p);
      return choose(host, `${a.name} · ${p.bankCredits} credits`, a.goods.map((g) => ({ label: `${g.label}${g.rarity !== 'common' ? ` (${g.rarity})` : ''}`, desc: `${(t.sets[g.set] ?? []).includes(g.id) && g.set !== 'boon' ? 'Owned' : costText(g.cost)} ${g.desc}` })), (i) => call(a, { choice: a.goods[i]!.id }, done), again);
    }
    case 'equip': {
      const owned = ownedSet(p, a.set!);
      const eq = townOf(p).equipped[a.slot!] ?? '';
      return choose(host, `${a.name}`, owned.map((id) => ({ label: friendly(session, id), desc: (a.slot === 'case' ? eq.split(',').includes(id) : eq === id) ? 'Equipped' : '' })), (i) => call(a, { choice: owned[i]! }, done), again);
    }
    case 'quiz': {
      const q = quizQuestion(p, a, now());
      if (!q) return done('No questions.');
      return choose(host, q.q, q.a.map((x) => ({ label: x })), (i) => call(a, { answer: i }, done), again);
    }
    case 'tend': return tend(host, a, done, again);
    case 'puzzle': return puzzle(host, a, done, again);
    case 'gacha': return gacha(host, a, done);
    case 'daily': return daily(host, a, done, again);
    case 'place': return place(host, a, done, again);
    case 'view': return view(host, a, done, again);
  }
}

const costText = (c: { credits?: number; rp?: number; coins?: number; offerings?: number }): string => [c.credits ? `${c.credits} credits` : '', c.rp ? `${c.rp} Research` : '', c.coins ? `${c.coins} coins` : '', c.offerings ? `${c.offerings} offering` : ''].filter(Boolean).join(', ') || 'Free';
const friendly = (session: ReturnType<typeof services>['session'], id: string): string => session.content.bosses.get(id)?.name ?? id.replace(/^[a-z]{1,3}-/, '').replace(/[-_.]/g, ' ');

// ---------- gardens ----------

function tend(host: TownHost, a: TownAction, done: (m: string) => void, again: () => void): void {
  const { session } = services();
  const t = townOf(session.profile);
  const beds = Array.from({ length: a.plots }, (_, i) => {
    const plot = t.plots[`${a.field}:${i}`];
    const def = plot ? a.crops.find((c) => c.id === plot.crop) : null;
    return { i, plot, def, desc: plot && def ? `${def.label} · ${def.stages[Math.min(plot.stage, def.stages.length - 1)]} (${plot.stage}/${def.grow})${plot.wet ? ' · watered' : ' · thirsty'}` : 'Empty bed' };
  });
  choose(host, a.name, beds.map((b) => ({ label: `Bed ${b.i + 1}`, desc: b.desc })), (n) => {
    const bed = beds[n]!;
    if (!bed.plot) return choose(host, 'Plant what?', a.crops.map((c) => ({ label: c.label, desc: `${c.stages.join(' → ')} · grows ${c.grow} runs ${c.cost ? `· ${costText(c.cost)}` : ''}` })), (k) => call(a, { choice: `${bed.i}:plant:${a.crops[k]!.id}` }, done), again);
    const ripe = bed.plot.stage >= bed.def!.grow;
    call(a, { choice: `${bed.i}:${ripe ? 'harvest' : 'water'}` }, done);
  }, again);
}

// ---------- puzzles and games ----------

function puzzle(host: TownHost, a: TownAction, done: (m: string) => void, again: () => void): void {
  const { session } = services();
  const t = townOf(session.profile);
  if (a.puzzle === 'sequence') {
    const code = basementCode(t);
    const guess: string[] = [];
    const species = TOWN.pools.cries;
    const hear = (id: string) => { const sp = session.content.species.get(id); if (sp) playCry(host.scene, sp); };
    const step = (): void => {
      choose(host, `Cry code ${guess.length}/${code.length}: ${guess.map((g) => session.content.species.get(g)?.name ?? g).join(', ')}`, [{ label: '▶ Hear the code again', desc: 'The cries play in order.' }, ...species.map((s) => ({ label: session.content.species.get(s)?.name ?? s, desc: 'Press to add this cry.' }))], (i) => {
        if (i === 0) { code.forEach((c, k) => host.scene.time.delayedCall(k * 900, () => hear(c))); return step(); }
        guess.push(species[i - 1]!); hear(species[i - 1]!);
        if (guess.length >= code.length) return call(a, { choice: guess.join(',') }, done);
        step();
      }, again);
    };
    code.forEach((c, k) => host.scene.time.delayedCall(300 + k * 900, () => hear(c)));
    return step();
  }
  if (a.puzzle === 'rotate') {
    const cur = t.puzzle.statues ?? [0, 0, 0, 0];
    const names = ['Pikachu', 'Eevee', 'Snorlax', 'Mew'];
    const facing = ['North', 'East', 'South', 'West'];
    void statueTarget;
    return choose(host, 'Statue Vault · plaque: "Each looks where the next will follow."', names.map((n, i) => ({ label: `${n} statue`, desc: `Facing ${facing[cur[i] ?? 0]}. Press to turn.` })), (i) => call(a, { choice: String(i) }, done), again);
  }
  if (a.pool === 'recipes') {
    const ingredients = [...new Set(TOWN.recipes.flatMap((r) => [r.a, r.b]))];
    return choose(host, 'First ingredient', ingredients.map((x) => ({ label: x.replace(/-/g, ' ') })), (i) => choose(host, 'Second ingredient', ingredients.map((x) => ({ label: x.replace(/-/g, ' ') })), (k) => call(a, { choice: `${ingredients[i]}|${ingredients[k]}` }, done), again), again);
  }
  return memoryMatch(host, a, done, again);
}

/** Memory Match: twelve face-down cards (six pairs of Pokémon). Misses decide the grade. */
function memoryMatch(host: TownHost, a: TownAction, done: (m: string) => void, again: () => void): void {
  const { session } = services();
  const scene = host.scene;
  const ids = TOWN.pools.memory.slice(0, 6);
  const deck = [...ids, ...ids].map((id, i) => ({ id, k: (i * 7 + 3) % 12 })).sort((x, y) => x.k - y.k).map((x) => x.id);
  const picked: number[] = [];
  const matched = new Set<number>();
  let misses = 0;
  const flip = (): void => {
    const rows: Choice[] = deck.map((id, i) => ({ label: matched.has(i) || picked.includes(i) ? (session.content.species.get(id)?.name ?? id) : `Card ${i + 1}`, desc: matched.has(i) ? 'Matched' : picked.includes(i) ? 'Face up' : 'Face down', problem: matched.has(i) ? 'Matched' : null }));
    choose(host, `Memory Match · misses ${misses}`, rows, (i) => {
      if (picked.includes(i)) return flip();
      picked.push(i);
      if (picked.length === 2) {
        const [x, y] = picked as [number, number];
        if (deck[x] === deck[y]) { matched.add(x); matched.add(y); } else misses += 1;
        const note = deck[x] === deck[y] ? 'A pair!' : 'No match.';
        picked.length = 0;
        if (matched.size === deck.length) return call(a, { misses }, done);
        scene.time.delayedCall(0, () => { host.refresh(note); flip(); });
        return;
      }
      flip();
    }, again, { columns: 2 });
  };
  flip();
}

function gacha(host: TownHost, a: TownAction, done: (m: string) => void): void {
  const { session } = services();
  const scene = host.scene;
  const free = session.profile.town?.daily['gacha-free'] !== todayKey();
  const problem = townProblem(session.content, session.profile, a, now()) ?? (!free && session.profile.bankCredits < (TOWN.gacha.cost.credits ?? 0) ? `A capsule costs ${TOWN.gacha.cost.credits} credits.` : null);
  if (problem) return done(problem);
  // The capsule: tap or press it three times to wiggle it open (motion off: it opens at once).
  const cap = scene.add.container(480, 280).setDepth(1200);
  const body = scene.add.circle(0, 0, 54, 0xe94f4f).setStrokeStyle(4, 0xffffff);
  const top = scene.add.rectangle(0, -26, 108, 4, 0xffffff);
  const label = scene.add.text(0, 90, free ? 'Free capsule! Tap it 3 times' : 'Tap the capsule 3 times', textStyle(20, COLORS.gold)).setOrigin(0.5);
  cap.add([body, top, label]).setSize(120, 120).setInteractive({ useHandCursor: true });
  let taps = 0;
  const open = (): void => {
    cap.destroy();
    const r = session.town(a.id, {});
    host.refresh(r.message);
    done(r.message);
  };
  const tap = (): void => {
    taps += 1;
    if (motion() !== 'off') scene.tweens.add({ targets: cap, angle: { from: -14, to: 14 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => { cap.angle = 0; } });
    label.setText(taps >= 3 ? 'Pop!' : `Tap ${3 - taps} more…`);
    if (taps >= 3) scene.time.delayedCall(motion() === 'off' ? 0 : 260, open);
  };
  cap.on('pointerdown', tap);
  scene.input.keyboard?.once('keydown-ENTER', tap);
  if (motion() === 'off') { taps = 2; tap(); }
}

function daily(host: TownHost, a: TownAction, done: (m: string) => void, again: () => void): void {
  const { session } = services();
  if (a.view !== 'quests') return call(a, {}, done);
  const t = townOf(session.profile);
  const today = todayKey();
  const quests = todaysQuests(t, today);
  choose(host, 'Daily quests', quests.map((q) => ({ label: q.text, desc: t.daily[`claim:${q.id}`] === today ? 'Claimed' : t.daily[`used:${q.action}`] === today ? 'Done: press to claim' : `Do it in ${TOWN.buildings.find((b) => b.actions.some((x) => x.id === q.action))?.name ?? 'town'}` })), (i) => call(a, { choice: quests[i]!.id }, done), again);
}

function place(host: TownHost, a: TownAction, done: (m: string) => void, again: () => void): void {
  const { session } = services();
  const p = session.profile;
  const t = townOf(p);
  if (a.view === 'pin') {
    const board = contractBoard(now());
    return choose(host, `Pin a contract (${t.pins.length}/${TOWN.caps.pins})`, board.map((e) => ({ label: `${t.pins.includes(e.claimKey) ? '📌 ' : ''}${e.contract.text}`, desc: contractDone(p, e) ? 'Done' : e.period })), (i) => call(a, { choice: board[i]!.claimKey }, done), again);
  }
  if (a.view === 'graffiti') {
    const colors = ['#ff5a5a', '#ffb745', '#f8d030', '#78e080', '#5ac8fa', '#a78bfa', '#ff7ad9', '#f8f8f8'];
    const stamps = ['star', 'heart', 'bolt', 'flame', 'leaf', 'drop', 'skull', 'crown'];
    const sigs = t.wall.length;
    return choose(host, `Sign the wall (${sigs} on it, ${Math.max(0, 1 + p.runHistory.filter((r) => r.victory).length - (t.counts.signatures ?? 0))} left to sign)`, colors.map((c) => ({ label: c, desc: 'Stylus color' })), (i) => choose(host, 'Pick a stamp', stamps.map((s) => ({ label: s })), (k) => call(a, { choice: `${colors[i]}|${stamps[k]}` }, done), again), again);
  }
  // decor
  const owned = ownedSet(p, 'decor');
  const spots = [['Center', 0.5, 0.55], ['Left', 0.18, 0.55], ['Right', 0.82, 0.55], ['Back left', 0.28, 0.4], ['Back right', 0.72, 0.4], ['Put away', -1, -1]] as const;
  host.setDecorMode?.(true);
  choose(host, 'Arrange the room (or drag pieces in the Town with the Decor switch)', owned.map((id) => ({ label: id.replace(/^dc-/, ''), desc: t.placed[id] ? 'Placed' : 'In storage' })), (i) => choose(host, 'Where?', spots.map((s) => ({ label: s[0] })), (k) => call(a, { choice: spots[k]![1] < 0 ? `${owned[i]}|remove` : `${owned[i]}|${spots[k]![1]}|${spots[k]![2]}` }, done), again), again);
}

// ---------- screens that mostly read ----------

function view(host: TownHost, a: TownAction, done: (m: string) => void, again: () => void): void {
  const { session } = services();
  const p = session.profile;
  const content = session.content;
  const t = townOf(p);
  switch (a.view) {
    case 'square': {
      const weather = { sun: 'Sunny: your last run was a win.', storm: 'Stormy: your last run ended early.', cloud: 'Cloudy: your last run got part-way.', clear: 'Clear: no run to mirror yet.' }[townWeather(p)];
      return show(host, 'Town Square', [{ label: 'Sky', desc: weather }, { label: 'Pets', desc: 'Your past Pokémon trot after the cursor.' }, { label: 'Decor mode', desc: 'Press to switch dragging on or off for furniture.' }], again, (i) => { if (i === 2) { host.setDecorMode?.(true); return done('Decor mode on: drag pieces, then press Esc.'); } again(); });
    }
    case 'dummy': {
      const team = lastTeam(content, p);
      if (team.length === 0) return show(host, 'Practice dummy', [{ label: 'No last team yet.', desc: 'Finish a run first.' }], again);
      return choose(host, 'Pick a Pokémon', team.map((m) => ({ label: m.name, desc: `Lv${m.level}` })), (i) => {
        const m = team[i]!;
        const moves = dummyMoves(content, m.speciesId, m.level);
        choose(host, `${m.name}'s moves vs the dummy`, moves.map((id) => { const h = dummyHit(content, m.speciesId, m.level, id)!; return { label: content.moves.get(id)?.name ?? id, desc: `${h.min}-${h.max} damage (${h.pct[0]}-${h.pct[1]}% of the dummy's 200 HP) · x${h.effectiveness}` }; }), () => again(), again);
      }, again);
    }
    case 'shelf': {
      const list = trophies(p);
      return show(host, `Trophy shelf (${list.length})`, list.map((tr) => ({ label: tr.name, desc: `${tr.kind} · shine ${t.counts[`polish:${tr.id}`] ?? 0}` })), again);
    }
    case 'theatre': {
      const list = theatreList(p);
      return show(host, 'Cutscene theatre', list.map((x) => ({ label: x.title, desc: x.lines[0] ?? '' })), again, (i) => show(host, list[i]!.title, list[i]!.lines.map((l) => ({ label: l })), again));
    }
    case 'forecast': return show(host, 'Forecast', forecast(now()).map((f) => ({ label: f.label, desc: f.tip })), again);
    case 'jokes': return call(a, {}, done);
    case 'elevator': {
      const floors = elevatorFloors(p);
      return choose(host, 'Elevator', floors.map((f) => ({ label: f.name, desc: f.open ? 'Press to ride' : 'Locked: visit its building first', problem: f.open ? null : 'Locked' })), (i) => call(a, { choice: floors[i]!.id }, done), again);
    }
    case 'guestbook': return show(host, 'Guestbook', guestbook(p).map((g) => ({ label: g.from, desc: g.text })), again);
    case 'jukebox': {
      const tracks = jukeboxTracks(p);
      return choose(host, 'Jukebox', tracks.map((tr) => ({ label: tr.name, desc: tr.open ? 'Press to play' : tr.how, problem: tr.open ? null : tr.how })), (i) => { playMusicLazy(host.scene, tracks[i]!.id); done(`Now playing: ${tracks[i]!.name}.`); }, () => { playMusicLazy(host.scene, 'bgm.hub'); again(); });
    }
    case 'stats': {
      const s = townStats(content, p);
      return show(host, 'Statistics', [
        { label: `Runs ${s.runs} · Wins ${s.wins} (${s.winRate}%)`, desc: `Best win streak ${s.bestStreak}` },
        { label: `Favourite type ${s.favouriteType ?? '-'}`, desc: `Favourite Pokémon ${s.favouriteSpecies ? (content.species.get(s.favouriteSpecies)?.name ?? s.favouriteSpecies) : '-'}` },
        { label: `Badges ${s.badges} · Achievements ${s.achievements}`, desc: `Town visits ${s.townVisits}` },
      ], again);
    }
    case 'ledger': return openLedger(host, 'all', 'newest', again);
    case 'roster': return show(host, 'Townsfolk', rosterOpen(p).map((n) => ({ label: n.open ? `${n.name} · ${n.role}` : '???', desc: n.open ? `"${n.line}"` : `Moves in at ${n.need} achievements` })), again);
    case 'track': {
      const tv = trackView(p);
      return choose(host, `Season track · ${tv.xp} points · level ${tv.level}`, tv.rows.map((r) => ({ label: `${r.label} (${r.xp})`, desc: `${r.text} ${r.claimed ? '· claimed' : r.reached ? '· press to claim' : ''}`, problem: null })), () => call(a, { choice: 'claim' }, done), again);
    }
    case 'collections': {
      const cols = collections(p);
      return show(host, 'Collection book', cols.map((c) => ({ label: `${c.name} ${c.have}${c.of ? `/${c.of}` : ''}`, desc: c.entries.slice(0, 6).map((e) => friendly(session, e)).join(', ') || 'Nothing yet' })), again);
    }
    default: return again();
  }
}


function openLedger(host: TownHost, filter: LedgerFilter, sort: LedgerSort, back: () => void): void {
  const { session } = services();
  const rows = ledger(session.profile, filter, sort);
  const next = (f: LedgerFilter, s: LedgerSort) => openLedger(host, f, s, back);
  choose(host, `Run ledger · ${filter} · ${sort}`, [{ label: `Sort: ${sort}`, desc: 'Press to change the sort' }, ...rows.map((r) => ({ label: `${r.victory ? 'WIN' : 'loss'} · ${r.regionsCleared}/${r.regions} regions · ${r.badges} badges`, desc: `Seed ${r.seed} · press to copy the seed` }))], (i) => {
    if (i === 0) return next(filter, LEDGER_SORTS[(LEDGER_SORTS.indexOf(sort) + 1) % LEDGER_SORTS.length]!);
    const r = rows[i - 1]!;
    void navigator.clipboard?.writeText(r.seed).catch(() => undefined);
    host.refresh(`Seed ${r.seed} copied.`);
    next(filter, sort);
  }, back, { tabs: { labels: LEDGER_FILTERS.map((f) => f[0]!.toUpperCase() + f.slice(1)), index: LEDGER_FILTERS.indexOf(filter), onChange: (to) => { host.setPicker(null); next(LEDGER_FILTERS[to]!, sort); } } });
}

export { currentSeason, getBuilding };
