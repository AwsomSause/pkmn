// The minigames (Blueprint section 4). Each one is a small pure state machine behind the same interface, so the
// framework (flow.ts) and the one generic screen can run any of them. State is plain JSON (saved with the run), the
// generator state lives inside it, and nothing here touches the gameplay RNG streams.

import { typeEffectiveness } from '../battle/damage';
import { TYPE_NAMES, type Content } from '../contentSchema';
import { Rng, type RngState } from '../rng';

export interface Cell {
  id: string;
  label: string;
  detail?: string;
  tone?: 'good' | 'bad' | 'info' | 'dim' | 'hot';
  disabled?: boolean;
}

export interface MinigameView {
  hud: string[];
  prompt: string;
  cols: number;
  cells: Cell[];
  done: boolean;
}

export interface BaseState {
  rs: RngState;
  done: boolean;
  msg: string;
  tick: number;
}

export interface MinigameModule<S extends BaseState = BaseState> {
  start(content: Content, params: Record<string, number>, rs: RngState): S;
  view(content: Content, s: S): MinigameView;
  act(content: Content, s: S, cellId: string): void;
  tick?(content: Content, s: S): void;
  /** The score and the best possible score. */
  result(s: S): { score: number; max: number };
}

const base = (rs: RngState): BaseState => ({ rs, done: false, msg: '', tick: 0 });
const rng = (s: BaseState) => new Rng(s.rs);
const keep = (s: BaseState, r: Rng) => void (s.rs = r.state);
const cap = (n: number, max: number) => Math.max(0, Math.min(n, max));
const TYPES6 = ['fire', 'water', 'grass', 'electric', 'ice', 'rock'] as const;

// ---------- 1. Pokémon Memory ----------
interface MemoryState extends BaseState {
  cards: { t: string; shown: boolean; matched: boolean; decoy: boolean }[];
  open: number[];
  moves: number;
  pairs: number;
  score: number;
}
const memory: MinigameModule<MemoryState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const types = r.shuffle([...TYPE_NAMES]).slice(0, p.pairs!);
    const cards = r.shuffle([
      ...types.flatMap((t) => [t, t]).map((t) => ({ t: t as string, shown: false, matched: false, decoy: false })),
      ...Array.from({ length: p.decoys ?? 0 }, (_, i) => ({ t: `bomb${i}`, shown: false, matched: false, decoy: true })),
    ]);
    return { ...base(r.state), cards, open: [], moves: p.moves!, pairs: p.pairs!, score: 0 };
  },
  view(_c, s) {
    return {
      hud: [`Moves left: ${s.moves}`, `Pairs: ${s.score}/${s.pairs}`, s.msg],
      prompt: 'Flip two tiles to find a pair.',
      cols: 4,
      done: s.done,
      cells: s.cards.map((c, i) => ({ id: String(i), label: c.matched || c.shown ? (c.decoy ? 'BOMB' : c.t) : '?', tone: c.matched ? 'good' : c.shown ? (c.decoy ? 'bad' : 'info') : 'dim' })),
    };
  },
  act(_c, s, id) {
    const i = Number(id);
    const card = s.cards[i];
    if (s.done || !card || card.matched || card.shown) return;
    if (s.open.length === 2 || (s.open.length === 1 && s.cards[s.open[0]!]!.decoy)) {
      for (const j of s.open) s.cards[j]!.shown = false;
      s.open = [];
    }
    card.shown = true;
    if (card.decoy) {
      s.moves = Math.max(0, s.moves - 2);
      s.open = [i];
      s.msg = 'A decoy! Two moves lost.';
    } else {
      s.open.push(i);
      if (s.open.length === 2) {
        s.moves -= 1;
        const [a, b] = s.open.map((j) => s.cards[j]!);
        if (a!.t === b!.t) {
          a!.matched = b!.matched = true;
          s.score += 1;
          s.open = [];
          s.msg = 'A pair!';
        } else s.msg = 'No match.';
      }
    }
    if (s.score >= s.pairs || s.moves <= 0) s.done = true;
  },
  result: (s) => ({ score: s.score, max: s.pairs }),
};

// ---------- 2. Pokémon Catching Challenge ----------
interface CatchState extends BaseState {
  targets: { x: number; y: number; v: number; dir: number }[];
  throws: number;
  ticksLeft: number;
  score: number;
  goal: number;
}
const COLS_C = 5;
const ROWS_C = 3;
function spawnTarget(r: Rng): CatchState['targets'][number] {
  const v = r.weighted([{ item: 1, weight: 6 }, { item: 2, weight: 3 }, { item: 3, weight: 1 }]);
  const dir = r.chance(0.5) ? 1 : -1;
  return { x: dir === 1 ? 0 : COLS_C - 1, y: r.int(0, ROWS_C - 1), v, dir };
}
const catching: MinigameModule<CatchState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const targets = Array.from({ length: p.targets! }, () => ({ ...spawnTarget(r), x: r.int(0, COLS_C - 1) }));
    return { ...base(r.state), targets, throws: p.throws!, ticksLeft: p.ticks!, score: 0, goal: p.goal! };
  },
  view(_c, s) {
    const cells: Cell[] = [];
    for (let y = 0; y < ROWS_C; y++) {
      for (let x = 0; x < COLS_C; x++) {
        const t = s.targets.find((q) => q.x === x && q.y === y);
        cells.push({ id: `${x},${y}`, label: t ? ['', '●', '◆', '★'][t.v]! : '·', tone: t ? (t.v === 3 ? 'hot' : 'good') : 'dim' });
      }
    }
    return { hud: [`Throws: ${s.throws}`, `Time: ${s.ticksLeft}`, `Score: ${s.score}/${s.goal}`, s.msg], prompt: 'Tag a Pokémon (● 1, ◆ 2, ★ 3).', cols: COLS_C, cells, done: s.done };
  },
  act(_c, s, id) {
    if (s.done || s.throws <= 0) return;
    const [x, y] = id.split(',').map(Number);
    s.throws -= 1;
    const i = s.targets.findIndex((t) => t.x === x && t.y === y);
    if (i >= 0) {
      s.score += s.targets[i]!.v;
      s.msg = 'Tagged!';
      const r = rng(s);
      s.targets[i] = spawnTarget(r);
      keep(s, r);
    } else s.msg = 'Missed.';
    if (s.throws <= 0 || s.score >= s.goal) s.done = true;
  },
  tick(_c, s) {
    if (s.done) return;
    const r = rng(s);
    s.targets = s.targets.map((t) => {
      const nx = t.x + t.dir * (t.v === 3 ? 2 : 1);
      return nx < 0 || nx >= COLS_C ? spawnTarget(r) : { ...t, x: nx };
    });
    keep(s, r);
    s.ticksLeft -= 1;
    if (s.ticksLeft <= 0) s.done = true;
  },
  result: (s) => ({ score: Math.min(s.score, s.goal), max: s.goal }),
};

// ---------- 3. Rhythm Challenge ----------
interface RhythmState extends BaseState {
  queue: number[];
  notes: { lane: number; row: number }[];
  combo: number;
  score: number;
  max: number;
}
const ROWS_R = 5;
const rhythm: MinigameModule<RhythmState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const queue: number[] = [];
    for (let i = 0; i < p.notes!; i++) {
      queue.push(r.int(0, 3));
      if (r.chance(0.6)) queue.push(-1);
    }
    return { ...base(r.state), queue, notes: [], combo: 0, score: 0, max: p.notes! * 2 + Math.floor(p.notes! / 5) };
  },
  view(_c, s) {
    const cells: Cell[] = [];
    for (let row = 0; row < ROWS_R; row++) {
      for (let lane = 0; lane < 4; lane++) {
        const n = s.notes.find((q) => q.lane === lane && q.row === row);
        cells.push({ id: String(row * 4 + lane), label: n ? '♪' : row === ROWS_R - 1 ? '▬' : '·', tone: n ? (row === ROWS_R - 1 ? 'hot' : 'info') : 'dim' });
      }
    }
    return { hud: [`Score: ${s.score}`, `Combo: ${s.combo}`, s.msg], prompt: 'Press a lane as its note reaches the bottom row.', cols: 4, cells, done: s.done };
  },
  act(_c, s, id) {
    if (s.done) return;
    const lane = Number(id) % 4;
    const i = s.notes.findIndex((n) => n.lane === lane && n.row >= ROWS_R - 2);
    if (i < 0) {
      s.combo = 0;
      s.msg = 'Too early!';
      return;
    }
    const perfect = s.notes[i]!.row === ROWS_R - 1;
    s.notes.splice(i, 1);
    s.score += perfect ? 2 : 1;
    s.combo += 1;
    if (s.combo % 5 === 0) s.score += 1;
    s.msg = perfect ? 'Perfect!' : 'Good';
  },
  tick(_c, s) {
    if (s.done) return;
    for (const n of s.notes) n.row += 1;
    const missed = s.notes.filter((n) => n.row >= ROWS_R);
    if (missed.length > 0) {
      s.combo = 0;
      s.msg = 'Missed!';
      s.notes = s.notes.filter((n) => n.row < ROWS_R);
    }
    const next = s.queue.shift();
    if (next !== undefined && next >= 0) s.notes.push({ lane: next, row: 0 });
    if (s.queue.length === 0 && s.notes.length === 0) s.done = true;
  },
  result: (s) => ({ score: Math.min(s.score, s.max), max: s.max }),
};

// ---------- 4. Foraging and Berry Picking ----------
interface ForageState extends BaseState {
  items: { name: string; value: number; hidden: boolean }[];
  idx: number;
  basket: number[];
  capacity: number;
}
const BERRIES = ['Oran', 'Pecha', 'Rawst', 'Cheri', 'Chesto', 'Sitrus', 'Lum', 'Leppa', 'Aspear', 'Persim'];
const forage: MinigameModule<ForageState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const items = Array.from({ length: p.items! }, () => {
      const rotten = r.chance(0.2);
      return { name: `${r.pick(BERRIES)} Berry`, value: rotten ? -3 : r.int(1, 5), hidden: rotten && p.hideRotten === 1 };
    });
    return { ...base(r.state), items, idx: 0, basket: [], capacity: p.capacity! };
  },
  view(_c, s) {
    const it = s.items[s.idx];
    const full = s.basket.length >= s.capacity;
    return {
      hud: [`Berry ${Math.min(s.idx + 1, s.items.length)}/${s.items.length}`, `Basket: ${s.basket.length}/${s.capacity}`, `Value so far: ${s.basket.reduce((a, b) => a + b, 0)}`],
      prompt: it ? `${it.name}: ${it.hidden ? 'value unknown (it smells odd)' : it.value < 0 ? 'ROTTEN (-3)' : `value ${'★'.repeat(it.value)}`}` : 'All berries seen.',
      cols: 2,
      done: s.done,
      cells: [{ id: 'take', label: 'Take', disabled: full || !it }, { id: 'skip', label: 'Skip', disabled: !it }],
    };
  },
  act(_c, s, id) {
    const it = s.items[s.idx];
    if (s.done || !it) return;
    if (id === 'take' && s.basket.length < s.capacity) s.basket.push(it.value);
    s.idx += 1;
    if (s.idx >= s.items.length) s.done = true;
  },
  result: (s) => ({
    score: Math.max(0, s.basket.reduce((a, b) => a + b, 0)),
    max: [...s.items.map((i) => i.value)].sort((a, b) => b - a).slice(0, s.capacity).filter((v) => v > 0).reduce((a, b) => a + b, 0) || 1,
  }),
};

// ---------- 5. Pokémon Knowledge Quiz (the game's own data) ----------
interface Question {
  text: string;
  options: string[];
  answer: number;
}
interface QuizState extends BaseState {
  questions: Question[];
  idx: number;
  score: number;
}
const plain = (c: Content) => [...c.species.values()].filter((sp) => !sp.id.includes('-') && sp.evolutionStage !== undefined);
const combo = (types: readonly string[]) => types.map((t) => t[0]!.toUpperCase() + t.slice(1)).join('/');
export function makeQuestion(content: Content, r: Rng): Question {
  const pool = plain(content);
  const sp = r.pick(pool);
  const kind = r.pick(['type', 'super', 'evolve', 'ability', 'speed'] as const);
  const finish = (text: string, correct: string, wrong: string[]): Question => {
    const options = r.shuffle([correct, ...wrong]);
    return { text, options, answer: options.indexOf(correct) };
  };
  const distinct = (make: () => string, avoid: string[], n: number) => {
    const out: string[] = [];
    for (let g = 0; g < 200 && out.length < n; g++) {
      const v = make();
      if (!avoid.includes(v) && !out.includes(v)) out.push(v);
    }
    return out;
  };
  if (kind === 'evolve' && sp.evolutions.length > 0) {
    const to = content.species.get(sp.evolutions[0]!.to)?.name;
    if (to) return finish(`What does ${sp.name} evolve into?`, to, distinct(() => r.pick(pool).name, [to, sp.name], 3));
  }
  if (kind === 'ability' && sp.abilities.normal.length > 0) {
    const mine: string[] = [...sp.abilities.normal];
    if (sp.abilities.hidden) mine.push(sp.abilities.hidden);
    const ok = sp.abilities.normal[0]!;
    return finish(`Which ability can ${sp.name} have?`, ok, distinct(() => r.pick(pool).abilities.normal[0] ?? ok, [...mine, ok], 3));
  }
  if (kind === 'speed') {
    const other = distinct(() => r.pick(pool).id, [sp.id], 1)[0]!;
    const o = content.species.get(other)!;
    if (o.baseStats.spe !== sp.baseStats.spe) return finish(`Which has the higher base Speed?`, sp.baseStats.spe > o.baseStats.spe ? sp.name : o.name, [sp.baseStats.spe > o.baseStats.spe ? o.name : sp.name]);
  }
  if (kind === 'super') {
    const good = TYPE_NAMES.filter((t) => typeEffectiveness(content.typeChart, t, sp.types) > 1);
    const bad = TYPE_NAMES.filter((t) => typeEffectiveness(content.typeChart, t, sp.types) <= 1);
    if (good.length > 0 && bad.length >= 3) {
      const correct = r.pick(good);
      return finish(`Which type is super effective against ${sp.name} (${combo(sp.types)})?`, combo([correct]), r.shuffle(bad).slice(0, 3).map((t) => combo([t])));
    }
  }
  const right = combo(sp.types);
  return finish(`What type is ${sp.name}?`, right, distinct(() => combo(r.pick(pool).types), [right], 3));
}
const quiz: MinigameModule<QuizState> = {
  start(content, p, rs) {
    const r = new Rng(rs);
    const questions = Array.from({ length: p.questions! }, () => makeQuestion(content, r));
    return { ...base(r.state), questions, idx: 0, score: 0 };
  },
  view(_c, s) {
    const q = s.questions[s.idx];
    return {
      hud: [`Question ${Math.min(s.idx + 1, s.questions.length)}/${s.questions.length}`, `Right: ${s.score}`, s.msg],
      prompt: q?.text ?? 'Quiz over.',
      cols: 2,
      done: s.done,
      cells: (q?.options ?? []).map((o, i) => ({ id: String(i), label: o })),
    };
  },
  act(_c, s, id) {
    const q = s.questions[s.idx];
    if (s.done || !q) return;
    const ok = Number(id) === q.answer;
    if (ok) s.score += 1;
    s.msg = ok ? 'Correct!' : `Not quite: ${q.options[q.answer]}`;
    s.idx += 1;
    if (s.idx >= s.questions.length) s.done = true;
  },
  result: (s) => ({ score: s.score, max: s.questions.length }),
};

// ---------- 6. Fossil Excavation ----------
interface DigState extends BaseState {
  size: number;
  cells: { dug: boolean; value: number }[];
  durability: number;
  score: number;
  total: number;
  found: number;
  treasures: number;
}
const DIG = 6;
const excavation: MinigameModule<DigState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const cells = Array.from({ length: DIG * DIG }, () => ({ dug: false, value: 0 }));
    const spots = r.shuffle(cells.map((_, i) => i)).slice(0, p.treasures!);
    let total = 0;
    for (const i of spots) {
      cells[i]!.value = r.int(1, 3);
      total += cells[i]!.value;
    }
    return { ...base(r.state), size: DIG, cells, durability: p.durability!, score: 0, total, found: 0, treasures: p.treasures! };
  },
  view(_c, s) {
    const near = (i: number) => {
      const x = i % DIG;
      const y = Math.floor(i / DIG);
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < DIG && ny < DIG && s.cells[ny * DIG + nx]!.value > 0 && !s.cells[ny * DIG + nx]!.dug) n += 1;
      }
      return n;
    };
    return {
      hud: [`Tool durability: ${s.durability}`, `Treasure value: ${s.score}/${s.total}`],
      prompt: 'Dig a tile. A number counts the buried treasures next to it.',
      cols: DIG,
      done: s.done,
      cells: s.cells.map((c, i) => ({ id: String(i), label: !c.dug ? '▒' : c.value > 0 ? `◆${c.value}` : String(near(i) || '·'), tone: !c.dug ? 'dim' : c.value > 0 ? 'hot' : 'info' })),
    };
  },
  act(_c, s, id) {
    const c = s.cells[Number(id)];
    if (s.done || !c || c.dug) return;
    c.dug = true;
    s.durability -= 1;
    if (c.value > 0) {
      s.score += c.value;
      s.found += 1;
    }
    if (s.durability <= 0 || s.found >= s.treasures) s.done = true;
  },
  result: (s) => ({ score: s.score, max: s.total }),
};

// ---------- 7. Fishing Challenge ----------
interface FishState extends BaseState {
  fish: { rarity: number; stamina: number }[];
  round: number;
  tension: number;
  stamina: number;
  ticksLeft: number;
  score: number;
}
const fishing: MinigameModule<FishState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const fish = Array.from({ length: p.rounds! }, () => {
      const rarity = r.weighted([{ item: 1, weight: 5 }, { item: 2, weight: 3 }, { item: 3, weight: 1 }]);
      return { rarity, stamina: 8 + rarity * 4 };
    });
    return { ...base(r.state), fish, round: 0, tension: 50, stamina: fish[0]!.stamina, ticksLeft: p.ticks!, score: 0 };
  },
  view(_c, s) {
    const bar = Array.from({ length: 10 }, (_, i) => (i === Math.min(9, Math.floor(s.tension / 10)) ? '█' : i >= 3 && i <= 6 ? '▒' : '░')).join('');
    return {
      hud: [`Fish ${Math.min(s.round + 1, s.fish.length)}/${s.fish.length}`, `Tension [${bar}] keep it in the middle`, `Fish stamina: ${Math.max(0, s.stamina)}`, `Time: ${s.ticksLeft}`, s.msg],
      prompt: 'Reel to pull, ease to relax the line.',
      cols: 3,
      done: s.done,
      cells: [{ id: 'reel', label: 'Reel' }, { id: 'hold', label: 'Hold' }, { id: 'ease', label: 'Ease' }],
    };
  },
  act(_c, s, id) {
    if (s.done) return;
    if (id === 'reel') {
      s.tension += 20;
      s.stamina -= 3;
    } else if (id === 'ease') s.tension -= 14;
    settleFish(s);
  },
  tick(_c, s) {
    if (s.done) return;
    const r = rng(s);
    s.tension += r.int(-14, 16);
    keep(s, r);
    if (s.tension >= 42 && s.tension <= 58) s.stamina -= 1;
    s.ticksLeft -= 1;
    settleFish(s);
    if (s.ticksLeft <= 0) s.done = true;
  },
  result: (s) => ({ score: s.score, max: s.fish.reduce((a, f) => a + f.rarity, 0) }),
};
function settleFish(s: FishState): void {
  const next = () => {
    s.round += 1;
    s.tension = 50;
    if (s.round >= s.fish.length) s.done = true;
    else s.stamina = s.fish[s.round]!.stamina;
  };
  if (s.stamina <= 0) {
    s.score += s.fish[s.round]!.rarity;
    s.msg = 'Landed it!';
    next();
  } else if (s.tension >= 100 || s.tension <= 0) {
    s.msg = s.tension >= 100 ? 'The line snapped!' : 'The line went slack!';
    next();
  }
}

// ---------- 8. Battle Puzzle ----------
interface PuzzleState extends BaseState {
  puzzles: { foe: string; foeTypes: string[]; hp: number; moves: { type: string; power: number; uses: number; dmg: number }[] }[];
  idx: number;
  turn: number;
  turns: number;
  score: number;
}
function makePuzzle(content: Content, r: Rng): PuzzleState['puzzles'][number] {
  const foe = r.pick(plain(content));
  const types = r.shuffle([...TYPE_NAMES]).slice(0, 4);
  const moves = types.map((type, i) => {
    const power = [40, 60, 80, 100][(i + r.int(0, 3)) % 4]!;
    return { type, power, uses: 2, dmg: Math.floor(power * typeEffectiveness(content.typeChart, type, foe.types)) };
  });
  const best = moves.map((m) => m.dmg).sort((a, b) => b - a);
  const hp = Math.max(1, Math.floor((best[0]! + best[1]!) * 0.95));
  return { foe: foe.name, foeTypes: [...foe.types], hp, moves };
}
const puzzle: MinigameModule<PuzzleState> = {
  start(content, p, rs) {
    const r = new Rng(rs);
    return { ...base(r.state), puzzles: Array.from({ length: p.puzzles! }, () => makePuzzle(content, r)), idx: 0, turn: 0, turns: p.turns!, score: 0 };
  },
  view(_c, s) {
    const pz = s.puzzles[s.idx];
    return {
      hud: [`Puzzle ${Math.min(s.idx + 1, s.puzzles.length)}/${s.puzzles.length}`, `Turns left: ${s.turns - s.turn}`, `Points: ${s.score}`, s.msg],
      prompt: pz ? `${pz.foe} (${combo(pz.foeTypes)}) has ${pz.hp} HP. Win in 2 turns for 3 points, 3 turns for 2.` : 'All puzzles done.',
      cols: 2,
      done: s.done,
      cells: (pz?.moves ?? []).map((m, i) => ({ id: String(i), label: `${combo([m.type])} attack`, detail: `power ${m.power}, ${m.uses} use${m.uses === 1 ? '' : 's'} left`, disabled: m.uses <= 0 })),
    };
  },
  act(_c, s, id) {
    const pz = s.puzzles[s.idx];
    const m = pz?.moves[Number(id)];
    if (s.done || !pz || !m || m.uses <= 0) return;
    m.uses -= 1;
    pz.hp -= m.dmg;
    s.turn += 1;
    if (pz.hp <= 0) {
      const pts = s.turn <= 2 ? 3 : 2;
      s.score += pts;
      s.msg = `Won in ${s.turn}! +${pts}`;
      nextPuzzle(s);
    } else if (s.turn >= s.turns || pz.moves.every((x) => x.uses <= 0)) {
      s.msg = 'Out of turns.';
      nextPuzzle(s);
    }
  },
  result: (s) => ({ score: s.score, max: s.puzzles.length * 3 }),
};
function nextPuzzle(s: PuzzleState): void {
  s.idx += 1;
  s.turn = 0;
  if (s.idx >= s.puzzles.length) s.done = true;
}

// ---------- 9. Type-Match Puzzle ----------
interface TypeMatchState extends BaseState {
  tiles: (string | null)[];
  sel: number | null;
  moves: number;
  score: number;
  goal: number;
}
const typeMatch: MinigameModule<TypeMatchState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const tiles = r.shuffle(Array.from({ length: p.tiles! }, (_, i) => TYPES6[Math.floor(i / 2) % TYPES6.length]!));
    return { ...base(r.state), tiles, sel: null, moves: p.moves!, score: 0, goal: p.goal! };
  },
  view(_c, s) {
    return {
      hud: [`Moves left: ${s.moves}`, `Score: ${s.score}/${s.goal}`, s.msg],
      prompt: 'Pick two tiles: same type = 2 points; second super effective against the first = 1.',
      cols: 4,
      done: s.done,
      cells: s.tiles.map((t, i) => ({ id: String(i), label: t ?? '·', tone: t === null ? 'dim' : s.sel === i ? 'hot' : 'info', disabled: t === null })),
    };
  },
  act(content, s, id) {
    const i = Number(id);
    if (s.done || s.tiles[i] == null) return;
    if (s.sel === null) {
      s.sel = i;
      return;
    }
    if (s.sel === i) {
      s.sel = null;
      return;
    }
    const a = s.tiles[s.sel]!;
    const b = s.tiles[i]!;
    const gain = a === b ? 2 : typeEffectiveness(content.typeChart, b as never, [a as never]) > 1 ? 1 : 0;
    s.score += gain;
    s.msg = gain === 2 ? 'Match! +2' : gain === 1 ? 'Super effective! +1' : 'No score.';
    s.tiles[s.sel] = null;
    s.tiles[i] = null;
    s.sel = null;
    s.moves -= 1;
    if (s.moves <= 0 || s.score >= s.goal || s.tiles.filter((t) => t !== null).length < 2) s.done = true;
  },
  result: (s) => ({ score: Math.min(s.score, s.goal), max: s.goal }),
};

// ---------- 10. Pokémon Tracking ----------
interface TrackState extends BaseState {
  rounds: number;
  round: number;
  target: number;
  probes: number;
  probesPer: number;
  clues: Record<string, string>;
  score: number;
}
const TRACK = 5;
const tracking: MinigameModule<TrackState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    return { ...base(r.state), rounds: p.rounds!, round: 0, target: r.int(0, TRACK * TRACK - 1), probes: p.probes!, probesPer: p.probes!, clues: {}, score: 0 };
  },
  view(_c, s) {
    return {
      hud: [`Hideout ${Math.min(s.round + 1, s.rounds)}/${s.rounds}`, `Searches left: ${s.probes}`, `Score: ${s.score}`, s.msg],
      prompt: 'Search a spot. Hot is next to it, warm is close, cold is far.',
      cols: TRACK,
      done: s.done,
      cells: Array.from({ length: TRACK * TRACK }, (_, i) => ({ id: String(i), label: s.clues[i] ?? '?', tone: s.clues[i] === 'HOT' ? 'hot' : s.clues[i] === 'warm' ? 'good' : s.clues[i] ? 'dim' : 'info' })),
    };
  },
  act(_c, s, id) {
    const i = Number(id);
    if (s.done || s.clues[i]) return;
    const d = Math.max(Math.abs((i % TRACK) - (s.target % TRACK)), Math.abs(Math.floor(i / TRACK) - Math.floor(s.target / TRACK)));
    s.probes -= 1;
    if (d === 0) {
      s.score += s.probes + 1;
      s.msg = 'Found it!';
      nextRound(s);
    } else {
      s.clues[i] = d === 1 ? 'HOT' : d === 2 ? 'warm' : 'cold';
      if (s.probes <= 0) {
        s.msg = 'It got away.';
        nextRound(s);
      }
    }
  },
  result: (s) => ({ score: s.score, max: s.rounds * (s.probesPer + 1) }),
};
function nextRound(s: TrackState): void {
  s.round += 1;
  if (s.round >= s.rounds) {
    s.done = true;
    return;
  }
  const r = rng(s);
  s.target = r.int(0, TRACK * TRACK - 1);
  keep(s, r);
  s.probes = s.probesPer;
  s.clues = {};
}

// ---------- 11. Berry-Growing Challenge ----------
interface GrowState extends BaseState {
  plots: { low: number; high: number; ideal: number; units: number }[];
  left: number;
  score: number;
}
const growing: MinigameModule<GrowState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const plots = Array.from({ length: p.plots! }, () => {
      const ideal = r.int(1, 3);
      const low = Math.max(0, ideal - r.int(0, 1));
      return { low, high: low + 1, ideal, units: 0 };
    });
    return { ...base(r.state), plots, left: p.units!, score: 0 };
  },
  view(_c, s) {
    return {
      hud: [`Water left: ${s.left}`, s.done ? `Harvest quality: ${s.score}` : 'Spread your water, then harvest.', s.msg],
      prompt: 'Each patch wants a little more or less water. Click a patch to add 1.',
      cols: 2,
      done: s.done,
      cells: [...s.plots.map((pl, i) => ({ id: String(i), label: `Patch ${i + 1}: ${'💧'.repeat(pl.units) || 'dry'}`, detail: `wants ${pl.low}–${pl.high}`, disabled: s.left <= 0 || s.done })), { id: 'harvest', label: 'Harvest', disabled: s.done }],
    };
  },
  act(_c, s, id) {
    if (s.done) return;
    if (id === 'harvest') {
      s.score = s.plots.reduce((a, pl) => a + Math.round(10 * Math.max(0, 1 - Math.abs(pl.units - pl.ideal) / Math.max(1, pl.ideal))), 0);
      s.done = true;
      return;
    }
    const pl = s.plots[Number(id)];
    if (!pl || s.left <= 0) return;
    pl.units += 1;
    s.left -= 1;
  },
  result: (s) => ({ score: s.score, max: s.plots.length * 10 }),
};

// ---------- 12. Trainer's Trial ----------
interface TrialState extends BaseState {
  rounds: { foe: string; foeTypes: string[]; team: { name: string; type: string }[]; best: number }[];
  idx: number;
  score: number;
}
const trial: MinigameModule<TrialState> = {
  start(content, p, rs) {
    const r = new Rng(rs);
    const pool = plain(content);
    const rounds: TrialState['rounds'] = [];
    for (let guard = 0; rounds.length < p.rounds! && guard < 400; guard++) {
      const foe = r.pick(pool);
      const team = r.shuffle(pool).slice(0, 4).map((sp) => ({ name: sp.name, type: sp.types[0] as string }));
      const eff = team.map((m) => typeEffectiveness(content.typeChart, m.type as never, foe.types));
      const top = Math.max(...eff);
      if (eff.filter((e) => e === top).length !== 1 || top === Math.min(...eff)) continue;
      rounds.push({ foe: foe.name, foeTypes: [...foe.types], team, best: eff.indexOf(top) });
    }
    return { ...base(r.state), rounds, idx: 0, score: 0 };
  },
  view(_c, s) {
    const rd = s.rounds[s.idx];
    return {
      hud: [`Situation ${Math.min(s.idx + 1, s.rounds.length)}/${s.rounds.length}`, `Right: ${s.score}`, s.msg],
      prompt: rd ? `A wild ${rd.foe} (${combo(rd.foeTypes)}) appears. Who attacks best?` : 'Trial over.',
      cols: 2,
      done: s.done,
      cells: (rd?.team ?? []).map((m, i) => ({ id: String(i), label: m.name, detail: `${combo([m.type])} attack` })),
    };
  },
  act(_c, s, id) {
    const rd = s.rounds[s.idx];
    if (s.done || !rd) return;
    const ok = Number(id) === rd.best;
    if (ok) s.score += 1;
    s.msg = ok ? 'Best choice!' : `Better: ${rd.team[rd.best]!.name}`;
    s.idx += 1;
    if (s.idx >= s.rounds.length) s.done = true;
  },
  result: (s) => ({ score: s.score, max: s.rounds.length }),
};

// ---------- 13. Treasure Hunt ----------
interface HuntState extends BaseState {
  forks: { pays: boolean; hint: string }[];
  idx: number;
  score: number;
}
const hunt: MinigameModule<HuntState> = {
  start(_c, p, rs) {
    const r = new Rng(rs);
    const forks = Array.from({ length: p.forks! }, () => {
      const pays = r.chance(0.45);
      const truthful = r.chance(0.7);
      const says = truthful ? pays : !pays;
      return { pays, hint: says ? 'Fresh footprints lead down the risky path.' : 'The risky path looks loose and broken.' };
    });
    return { ...base(r.state), forks, idx: 0, score: 0 };
  },
  view(_c, s) {
    const f = s.forks[s.idx];
    return {
      hud: [`Fork ${Math.min(s.idx + 1, s.forks.length)}/${s.forks.length}`, `Treasure: ${s.score}`, s.msg],
      prompt: f ? `${f.hint} (Hints are usually right.)` : 'You reached the end.',
      cols: 2,
      done: s.done,
      cells: [{ id: 'safe', label: 'Safe path', detail: '1 point' }, { id: 'risky', label: 'Risky path', detail: '3 points, or nothing' }],
    };
  },
  act(_c, s, id) {
    const f = s.forks[s.idx];
    if (s.done || !f) return;
    if (id === 'safe') {
      s.score += 1;
      s.msg = 'Safe and sound. +1';
    } else if (f.pays) {
      s.score += 3;
      s.msg = 'It paid off! +3';
    } else s.msg = 'A dead end.';
    s.idx += 1;
    if (s.idx >= s.forks.length) s.done = true;
  },
  result: (s) => ({ score: Math.min(s.score, s.forks.length * 2), max: s.forks.length * 2 }),
};

// ---------- 14. Reaction Challenge ----------
interface ReactState extends BaseState {
  rounds: number;
  round: number;
  phase: 'wait' | 'go' | 'decoy';
  wait: number;
  window: number;
  windowMax: number;
  score: number;
}
function newReactRound(s: ReactState): void {
  const r = rng(s);
  s.phase = 'wait';
  s.wait = r.int(2, 5);
  keep(s, r);
}
const reaction: MinigameModule<ReactState> = {
  start(_c, p, rs) {
    const s: ReactState = { ...base(rs), rounds: p.rounds!, round: 0, phase: 'wait', wait: 3, window: 0, windowMax: p.window!, score: 0 };
    newReactRound(s);
    return s;
  },
  view(_c, s) {
    return {
      hud: [`Round ${Math.min(s.round + 1, s.rounds)}/${s.rounds}`, `Score: ${s.score}`, s.msg],
      prompt: s.phase === 'go' ? 'GREEN! Press now!' : s.phase === 'decoy' ? 'RED. Do not press.' : 'Wait for green...',
      cols: 1,
      done: s.done,
      cells: [{ id: 'press', label: s.phase === 'go' ? 'PRESS' : s.phase === 'decoy' ? 'wait' : '...', tone: s.phase === 'go' ? 'good' : s.phase === 'decoy' ? 'bad' : 'dim' }],
    };
  },
  act(_c, s) {
    if (s.done) return;
    if (s.phase === 'go') {
      s.score += 1;
      s.msg = 'Fast!';
    } else {
      s.score = Math.max(0, s.score - 1);
      s.msg = s.phase === 'decoy' ? 'That was red!' : 'Too early!';
    }
    advanceReact(s);
  },
  tick(_c, s) {
    if (s.done) return;
    if (s.phase === 'wait') {
      s.wait -= 1;
      if (s.wait <= 0) {
        const r = rng(s);
        s.phase = r.chance(0.65) ? 'go' : 'decoy';
        keep(s, r);
        s.window = s.windowMax;
      }
    } else {
      s.window -= 1;
      if (s.window <= 0) {
        if (s.phase === 'decoy') {
          s.score += 1;
          s.msg = 'Good restraint.';
        } else s.msg = 'Too slow.';
        advanceReact(s);
      }
    }
  },
  result: (s) => ({ score: Math.min(s.score, s.rounds), max: s.rounds }),
};
function advanceReact(s: ReactState): void {
  s.round += 1;
  if (s.round >= s.rounds) s.done = true;
  else newReactRound(s);
}

export const MINIGAMES: Record<string, MinigameModule<never>> = {
  'pokemon-memory': memory as never,
  'catching-challenge': catching as never,
  'rhythm-challenge': rhythm as never,
  'berry-foraging': forage as never,
  'knowledge-quiz': quiz as never,
  'fossil-excavation': excavation as never,
  'fishing-challenge': fishing as never,
  'battle-puzzle': puzzle as never,
  'type-match': typeMatch as never,
  'pokemon-tracking': tracking as never,
  'berry-growing': growing as never,
  'trainers-trial': trial as never,
  'treasure-hunt': hunt as never,
  'reaction-challenge': reaction as never,
};

export function gameModule(id: string): MinigameModule<BaseState> {
  const m = MINIGAMES[id];
  if (!m) throw new Error(`No minigame "${id}"`);
  return m as unknown as MinigameModule<BaseState>;
}
void cap;
