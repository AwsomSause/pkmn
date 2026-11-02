// Screen styles (screens redesign, Kice 2026-11-02): every redesigned screen has several looks Kice
// picked from the mock-ups in /mnt/project-files/redesign/<screen>/. By default a screen rotates
// between its built looks at random; Settings can pin one, or keep the original look.
// Presentation only: a style never changes an outcome, and the random pick never uses gameplay RNG.
// Dependency-free so the settings schema can import it.

/** Each screen and the looks Kice picked for it (style id -> label), in mock-up order. */
export const SCREEN_STYLES = {
  battle: { label: 'Battle screen', styles: { wii: 'Wii Channel', classic: 'Enhanced Classic', cyber: 'Cyber HUD', arcade: 'Arcade Versus', cards: 'Card Hand', ring: 'Ring Command', stadium: 'Stadium Broadcast', cinematic: 'Cinematic', shonen: 'Shonen Versus', ink: 'Ink Duel' } },
  map: { label: 'Route map', styles: { townmap: 'Town Map', starchart: 'Star Chart', wiigrid: 'Wii Menu Grid', nextstop: 'Next Stop Cards', panorama: 'Region Panorama' } },
  reward: { label: 'Reward pick', styles: { aero: 'Aero Cards', holopack: 'Holo Card Pack', gifts: 'Gift Boxes', ds: 'DS Touch', wiishop: 'Wii Shop Shelf', orbit: 'Loot Orbit', reels: 'Prize Reels', trail: 'Trail Finds', episode: 'Episode Title Card', novel: 'Visual Novel', cutin: 'Cut-in Strips' } },
  party: { label: 'Party and summary', styles: { aero: 'Aero Glass', classic: 'Enhanced Classic', mii: 'Mii Plaza Lineup', binder: 'Card Binder', manga: 'Manga Roster', spotlight: 'Spotlight Stage', shonen: 'Shonen Roster', sticker: 'Sticker Team' } },
  title: { label: 'Title and save slots', styles: { classic: 'Classic Press Start', wii: 'Wii Menu', ds: 'DS Boot', anime: 'Anime Key Art', carousel: 'Save Carousel', manga: 'Manga Volume', flyover: 'Region Flyover' } },
  trainer: { label: 'Trainer select', styles: { aero: 'Aero Roster', fighter: 'Fighter Select', mii: 'Mii Channel', card: 'Trainer Card', carousel: 'Carousel Parade', crowd: 'Plaza Crowd', manga: 'Manga Cast', gallery: 'Portrait Gallery', wheel: 'Trainer Wheel', storybook: 'Storybook Shelf' } },
  starter: { label: 'Run prep and starters', styles: { aero: 'Aero Bubbles', wii: 'Wii Channel', meadow: 'Meadow Meet', pack: 'Starter Pack', egg: 'Egg Choice', manga: 'Manga Trio', wizard: 'Step Wizard', spotlight: 'Spotlight Pick', triangle: 'Type Triangle' } },
  briefing: { label: 'Campaign briefing', styles: { aero: 'Aero Brief', missionmap: 'Mission Map', storybook: 'Storybook', trailer: 'Movie Trailer', wii: 'Wii Bulletin', letter: "Professor's Letter", boarding: 'Boarding Pass' } },
  bag: { label: 'Bag', styles: { aero: 'Aero Satchel', classic: 'Enhanced Classic', manga: 'Manga Page', shonen: 'Shonen Rush', sticker: 'Sticker Book', shoujo: 'Shoujo Sparkle', wiishop: 'Wii Shop Shelf', episode: 'Episode Title Card', ink: 'Ink Brush', grid: 'Inventory Grid' } },
  evolve: { label: 'Evolution, hatch and moves', styles: { aero: 'Aero Bubble', classic: 'Enhanced Classic', shonen: 'Shonen Power-Up', ink: 'Ink Impact', episode: 'Episode Title Card', dna: 'DNA Rewrite', eyecatch: 'Anime Eyecatch' } },
  runend: { label: 'Run end', styles: { aero: 'Aero Hall of Fame', classic: 'Classic Hall of Fame', finale: 'Final Episode Card', manga: 'Manga End', sunset: 'Sunset Farewell', cards: 'Card Collection', anime: 'Anime Victory', credits: 'Rolling Credits', wii: 'Wii Results', ink: 'Ink Defeat', mvp: 'MVP Bloom' } },
  dex: { label: 'Pokédex and Codex', styles: { aero: 'Aero Encyclopedia', ds: 'DS Pokédex', sticker: 'Sticker Album', wii: 'Wii Channel Dex', ink: 'Ink Scroll' } },
  settings: { label: 'Settings', styles: { aero: 'Aero Control Panel', wii: 'Wii System Settings', shoujo: 'Shoujo Options', ink: 'Ink Scroll', notebook: 'Notebook Tabs', rotom: 'Rotom Assistant', sticker: 'Sticker Cards' } },
  camp: { label: 'Camp', styles: { wii: 'Wii Camp Channels', novel: 'Visual Novel Camp', scrapbook: 'Camp Scrapbook', fieldbase: 'Field Base', ink: 'Ink Camp', cards: 'Camp Card Hand' } },
  raid: { label: 'Raids', styles: { maxden: 'Max Den', shonen: 'Shonen Squad', tera: 'Tera Episode' } },
  totem: { label: 'Totems', styles: { ink: 'Ink Ruler' } },
  expedition: { label: 'Expeditions', styles: { aero: 'Aero Layers', manga: 'Manga Dungeon', depth: 'Depth Scan' } },
  minigame: { label: 'Minigames', styles: { wii: 'Wii Channels' } },
  hubmenus: { label: 'Hub menus', styles: { aero: 'Aero Office', wii: 'Wii Channel', shonen: 'Shonen Missions', sticker: 'Sticker Planner', ink: 'Ink Ledger', achievements: 'Achievement Cards', album: 'Photo Album' } },
  legacy: { label: 'Legacy and memories', styles: { museum: 'Museum Gallery', polaroids: 'Sunset Polaroids', manga: 'Manga Volumes', timeline: 'Timeline Branches', cards: 'Legacy Cards', previously: 'Previously On', bloom: 'Bond Memory Bloom', aero: 'Aero Gallery', ink: 'Ink Chronicle', wii: 'Wii Photo Channel', hall: 'Hall of Legends' } },
  loading: { label: 'Loading screen', styles: { aero: 'Aero Splash', ball: 'Spinning Ball', terminal: 'Boot Terminal', wiihealth: 'Wii Health Screen', ds: 'DS Boot', ink: 'Ink Brush', shuffle: 'Card Shuffle', sparkle: 'Sparkle Load', region: 'Region Preview' } },
} as const satisfies Record<string, { label: string; styles: Record<string, string> }>;

export type ScreenId = keyof typeof SCREEN_STYLES;
export type ScreenStyleId<S extends ScreenId> = keyof (typeof SCREEN_STYLES)[S]['styles'] & string;
export const SCREEN_IDS = Object.keys(SCREEN_STYLES) as ScreenId[];

/** The saved choice for one screen: rotate at random, the original look, or one pinned style. */
export const RANDOM = 'random';
export const ORIGINAL = 'original';

/**
 * The styles that are built, per screen, in Settings cycle order. A screen with none keeps its
 * original look and has no Settings entry. Each build PR adds its ids here.
 */
export const SCREEN_STYLES_READY: { readonly [S in ScreenId]: readonly ScreenStyleId<S>[] } = {
  battle: [], map: [], reward: [], party: [], title: [], trainer: [], starter: [], briefing: [], bag: [], evolve: [], runend: [],
  dex: [], settings: [], camp: [], raid: [], totem: [], expedition: [], minigame: [], hubmenus: [], legacy: [], loading: [],
};

/** FNV-1a, so the random pick is stable for the same salt and never touches gameplay RNG. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * The look a screen draws with: a pinned style when it is built; 'original' when chosen or nothing is
 * built; otherwise one of the built styles picked by `salt` (for example the run seed plus the battle
 * number), so the same visit always gets the same look and a reload never changes it.
 */
export function screenStyleOf<S extends ScreenId>(screen: S, saved: Readonly<Record<string, string>> | undefined, salt: string | number, ready: readonly ScreenStyleId<S>[] = SCREEN_STYLES_READY[screen]): ScreenStyleId<S> | typeof ORIGINAL {
  const choice = saved?.[screen] ?? RANDOM;
  if (choice === ORIGINAL || ready.length === 0) return ORIGINAL;
  if ((ready as readonly string[]).includes(choice)) return choice as ScreenStyleId<S>;
  return ready[hash(`${screen}:${salt}`) % ready.length]!;
}

/** The saved choice as Settings shows it ('random' when unset or no longer built). */
export function screenChoice(screen: ScreenId, saved: Readonly<Record<string, string>> | undefined, ready: readonly string[] = SCREEN_STYLES_READY[screen]): string {
  const choice = saved?.[screen] ?? RANDOM;
  return choice === ORIGINAL || ready.includes(choice) ? choice : RANDOM;
}

/** Settings cycle: Random -> each built style -> Original -> Random. */
export function nextScreenChoice(screen: ScreenId, saved: Readonly<Record<string, string>> | undefined, ready: readonly string[] = SCREEN_STYLES_READY[screen]): string {
  const order = [RANDOM, ...ready, ORIGINAL];
  return order[(order.indexOf(screenChoice(screen, saved, ready)) + 1) % order.length]!;
}

/** The label of a saved choice. */
export function screenChoiceLabel(screen: ScreenId, choice: string): string {
  if (choice === RANDOM) return 'Random';
  if (choice === ORIGINAL) return 'Original';
  return (SCREEN_STYLES[screen].styles as Record<string, string>)[choice] ?? 'Random';
}
