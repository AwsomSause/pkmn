// The single place where asset file names and folders are defined.
//
// Every asset has a logical ID (e.g. "pokemon.front.1") that game data and
// screens refer to. This catalog maps IDs to file paths under public/assets/.
// Nothing here guarantees a file exists: tools/build-asset-manifest.ts checks
// which files are really present and writes public/assets/manifest.json, and
// the game uses placeholders for anything missing.
//
// This file must stay free of runtime imports so the Node tools can use it.

export type AssetKind = 'image' | 'atlas' | 'audio' | 'font' | 'spritesheet' | 'json';
export type AssetCategory = 'pokemon' | 'trainer' | 'item' | 'background' | 'ui' | 'music' | 'sound' | 'font' | 'animation';

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  category: AssetCategory;
  /** Path relative to public/assets/ (for atlases, the image). */
  path: string;
  /** Atlas JSON path (TexturePacker multi-atlas format, as in the supplied packs). */
  atlasPath?: string;
  /** Spritesheet cell size in pixels (square cells). */
  frameSize?: number;
  /**
   * Loaded when a screen first needs it instead of at start-up. Every Pokémon's
   * sprites, icon and cry are lazy: there are over a thousand of them.
   */
  lazy?: boolean;
}

/** A species' file names in the asset pack (species.json `assets`). */
export interface PokemonArt {
  /** "25" → images/pokemon/25.png (+ back/, shiny/, back/shiny/). Regional forms use PokeRogue's numbers (Alolan Rattata is 2019). */
  sprite: string;
  /** "<generation folder>/<name>" → images/pokemon/icons/7/2019.png (a 1 or 2 frame atlas, json beside it). */
  icon: string;
  /** "25" → audio/cry/25.m4a. */
  cry: string;
}

/** What the catalog needs to know about the game data. */
export interface CatalogInputs {
  pokemon: PokemonArt[];
  trainerAssetIds: string[];
  itemAssetIds: string[];
  /** Battle backgrounds ("bg.arena.<name>"), e.g. the arena for each stage theme's type. */
  backgroundAssetIds: string[];
  /** Battle animations (src/data/moveAnims.json): animation names, sprite sheet and sound slugs. */
  battleAnims?: { names: string[]; sheets: string[]; backgrounds: string[]; sounds: string[] };
  /** Scripted EBDX move animations (src/data/ebdxAnims.json): the pictures and sounds they use. */
  ebdxAnims?: { images: string[]; sounds: string[] };
}

const atlas = (id: string, category: AssetCategory, base: string): AssetEntry => ({
  id,
  kind: 'atlas',
  category,
  path: `${base}.png`,
  atlasPath: `${base}.json`,
});

/** Items whose pictures double as menu icons. */
export const MENU_ICON_ITEMS = [
  'scanner', 'leaders_crest', 'calendar', 'golden_mystic_ticket', 'master_ribbon', 'coin_case',
  'mystery_egg', 'exp_charm', 'map', 'pair_of_tickets', 'dna_splicers', 'candy',
];

/** UIE battleback names (tools/import-battlebacks.py). */
export const UIE_ARENAS: readonly string[] = [
  'cave1', 'cave2', 'cave3', 'champion1', 'champion2', 'city', 'city_eve', 'city_night', 'distortion', 'elite1', 'elite2', 'elite3', 'elite4', 'elite5', 'elite6', 'elite7', 'elite8', 'field', 'field_eve', 'field_night', 'forest', 'forest_eve', 'forest_night', 'indoor1', 'indoor2', 'indoor3', 'rocky', 'rocky_eve', 'rocky_night', 'snow', 'snow_eve', 'snow_night', 'underwater', 'water', 'water_eve', 'water_night',
];
export const uieArenaId = (name: string) => `bg.uie.${name}`;

/** Fixed UI/audio assets used by the screens. */
export const FIXED_ASSETS: AssetEntry[] = [
  { id: 'bg.battle', kind: 'image', category: 'background', path: 'images/arenas/grass_bg.png' },
  // Raid arenas from the Raid Battles pack (resized to the game's 320×180).
  ...['max', 'tera', 'ultra', 'tera2'].map((n): AssetEntry => ({ id: `bg.raid.${n}`, kind: 'image', category: 'background', path: `images/arenas/raid_${n}_bg.png` })),
  // UIE battlebacks (Pokemon Essentials 21.1 UIE): league halls, evening/night fields, the distortion (tools/import-battlebacks.py).
  ...UIE_ARENAS.flatMap((n): AssetEntry[] => [
    { id: uieArenaId(n), kind: 'image', category: 'background', path: `images/arenas/uie/${n}_bg.png`, lazy: true },
    { id: `${uieArenaId(n)}.player`, kind: 'image', category: 'background', path: `images/arenas/uie/${n}_a.png`, lazy: true },
    { id: `${uieArenaId(n)}.enemy`, kind: 'image', category: 'background', path: `images/arenas/uie/${n}_b.png`, lazy: true },
  ]),
  { id: 'bg.battle.player', kind: 'image', category: 'background', path: 'images/arenas/grass_a.png' },
  { id: 'bg.battle.enemy', kind: 'image', category: 'background', path: 'images/arenas/grass_b.png' },
  // PokeRogue's interface art: the menu pointer, battle info boxes and message bar.
  { id: 'ui.cursor', kind: 'image', category: 'ui', path: 'images/ui/cursor.png' },
  { id: 'ui.pbinfo_player', kind: 'image', category: 'ui', path: 'images/ui/pbinfo_player.png' },
  { id: 'ui.pbinfo_enemy', kind: 'image', category: 'ui', path: 'images/ui/pbinfo_enemy_mini.png' },
  { id: 'ui.message_bg', kind: 'image', category: 'ui', path: 'images/ui/bg.png' },
  // Battle art from the director's Essentials packs (see docs/quality/asset-provenance.md).
  { id: 'pack.ebdx.types', kind: 'image', category: 'ui', path: 'images/packs/ebdx/ui/types2.png' },
  { id: 'pack.ebdx.category', kind: 'image', category: 'ui', path: 'images/packs/ebdx/ui/category.png' },
  { id: 'pack.ebdx.status', kind: 'image', category: 'ui', path: 'images/packs/ebdx/ui/status.png' },
  { id: 'pack.ebdx.symMega', kind: 'image', category: 'ui', path: 'images/packs/ebdx/ui/symMega.png' },
  { id: 'pack.ebdx.symDynamax', kind: 'image', category: 'ui', path: 'images/packs/ebdx/ui/symDynamax.png' },
  // Egg hatching (EBDX): the Egg, its crack frames, the hatch backdrop and shines.
  { id: 'pack.ebdx.egg', kind: 'image', category: 'ui', path: 'images/packs/ebdx/hatch/egg.png', lazy: true },
  { id: 'pack.ebdx.eggCracks', kind: 'spritesheet', category: 'ui', path: 'images/packs/ebdx/hatch/cracks.png', frameSize: 80, lazy: true },
  ...['hatchbg', 'line', 'overlay', 'shine6', 'shine7'].map(
    (name): AssetEntry => ({ id: `pack.ebdx.hatch.${name}`, kind: 'image', category: 'ui', path: `images/packs/ebdx/hatch/${name}.png`, lazy: true }),
  ),
  // Enhanced Battle UI: move flag icons and the effectiveness tags (unknown, immune, weak, super, normal).
  { id: 'pack.ebui.effectiveness', kind: 'image', category: 'ui', path: 'images/packs/ebui/move_effectiveness.png' },
  ...['Contact', 'Sound', 'Biting', 'Powder', 'Pulse', 'Punching', 'HighCriticalHitRate', 'ZMove', 'DynamaxMove', 'Bomb', 'Dance', 'ElectrocuteUser', 'NoMirrorMove', 'NoProtect', 'Slicing', 'ThawsUser', 'TramplesMinimize', 'Wind'].map(
    (name): AssetEntry => ({ id: `pack.ebui.flag.${name}`, kind: 'image', category: 'ui', path: `images/packs/ebui/flags/${name}.png` }),
  ),
  ...['cloud1', 'cloud2', 'bubble', 'bubbleDark', 'snow', 'star', 'sun', 'lightA', 'lightB', 'fog'].map(
    (name): AssetEntry => ({ id: `pack.ebdx.${name}`, kind: 'image', category: 'background', path: `images/packs/ebdx/elements/${name}.png` }),
  ),
  // EBDX battle transitions (the intro wipe and VS screens).
  ...['ball', 'outdoor', 'indoor', 'vs', 'vsBar', 'glow', 'shine2', ...['background', 'layer'].flatMap((k) => ['', 'Evil', 'Skull'].map((v) => `vs_${k}${v}`))].map(
    (name): AssetEntry => ({ id: `pack.ebdx.tr.${name}`, kind: 'image', category: 'ui', path: `images/packs/ebdx/transitions/${name}.png` }),
  ),
  ...['burst', 'shine', 'particle', 'pulse'].map(
    (name): AssetEntry => ({ id: `pack.dbk.${name}`, kind: 'image', category: 'ui', path: `images/packs/dbk/${name}.png` }),
  ),
  // Deluxe Battle Kit databox art for the selectable battle UI styles (ui/battleUiStyles.ts).
  ...(
    [
      ['basicPlayer', 'basic_player'],
      ['basicFoe', 'basic_foe'],
      ['longFoe', 'long_foe'],
      ['basicHpPlayer', 'basic_hp_player'],
      ['basicHpFoe', 'basic_hp_foe'],
      ['longHpFoe', 'long_hp_foe'],
      ['basicExp', 'basic_exp'],
    ] as const
  ).map(([id, file]): AssetEntry => ({ id: `pack.dbk.box.${id}`, kind: 'image', category: 'ui', path: `images/packs/dbk/databoxes/${file}.png` })),
  // Enhanced Battle UI info art for the Pokémon summary: gender marks and stat arrows.
  { id: 'pack.ebui.gender', kind: 'spritesheet', category: 'ui', path: 'images/packs/ebui/info_gender.png', frameSize: 22 },
  { id: 'pack.ebui.statArrows', kind: 'spritesheet', category: 'ui', path: 'images/packs/ebui/info_stats.png', frameSize: 18 },
  // Essentials bag pocket icons (Items, Medicine, Balls, TMs, Berries, Mail, Battle Items, Key Items): shop category icons.
  { id: 'pack.ess.pockets', kind: 'spritesheet', category: 'ui', path: 'images/packs/ess/bag_pockets.png', frameSize: 28 },
  // Transformation cinematics (battleFx/cinematics.ts): EBDX Primega crystals, Raid Battles Max/Ultra/Tera
  // transition art, Deluxe Battle Kit Mega/Primal orbs. Loaded when a battle starts.
  ...['mega', 'alpha', 'omega'].map((name) => ({ ...atlas(`cine.primega.${name}`, 'ui', `images/packs/ebdx/primega/${name}`), lazy: true })),
  ...['max/bg', 'max/icon', 'max/spiral', 'max/spiral2', 'ultra/bg', 'ultra/icon', 'tera/bg', 'tera/icon', 'tera/spiral', 'transitions/black_bars', 'transitions/impact', 'transitions/shine'].map(
    (name): AssetEntry => ({ id: `cine.raid.${name.replace('/', '.')}`, kind: 'image', category: 'ui', path: `images/packs/raid/${name}.png`, lazy: true }),
  ),
  ...['mega/orb_1', 'mega/shine', 'primal/icon_groudon', 'primal/icon_kyogre'].map(
    (name): AssetEntry => ({ id: `cine.dbk.${name.replace('/', '.')}`, kind: 'image', category: 'ui', path: `images/packs/dbk/${name}.png`, lazy: true }),
  ),
  // Item pictures used as menu icons (the Hub's tiles and currency counters).
  ...MENU_ICON_ITEMS.map((name) => itemEntry(`item.${name}`)),
  { id: 'bgm.menu', kind: 'audio', category: 'music', path: 'audio/bgm/menu.mp3' },
  { id: 'bgm.battle', kind: 'audio', category: 'music', path: 'audio/bgm/battle_wild.mp3' },
  ...['ultra', 'max', 'tera'].map((n): AssetEntry => ({ id: `bgm.raid.${n}`, kind: 'audio', category: 'music', path: `audio/bgm/raid_${n}.mp3` })),
  { id: 'bgm.raid.basic', kind: 'audio', category: 'music', path: 'audio/bgm/raid_basic.mp3', lazy: true },
  // Raid Dens / Adventures UI art, and the four raid capture jingles (played when a beaten boss offers to join).
  ...['den_entry', 'adv_header'].map((n): AssetEntry => ({ id: `ui.raid.${n}`, kind: 'image', category: 'ui', path: `images/packs/raid/ui/${n}.png` })),
  ...['basic', 'ultra', 'max', 'tera'].map((n): AssetEntry => ({ id: `bgm.raid.capture.${n}`, kind: 'audio', category: 'music', path: `audio/bgm/raid_capture_${n}.mp3`, lazy: true })),
  // Variant battle songs from the Raid Battles pack (see asset-provenance); chosen by raid id in `raidMusic`.
  { id: 'bgm.raid.basic2', kind: 'audio', category: 'music', path: 'audio/bgm/raid_basic_v2.mp3', lazy: true },
  ...['ultra', 'max', 'tera'].flatMap((n) => [2, 3].map((v): AssetEntry => ({ id: `bgm.raid.${n}${v}`, kind: 'audio', category: 'music', path: `audio/bgm/raid_${n}_v${v}.mp3`, lazy: true }))),
  // Battle weather particles (UIE pack Weather folder), loaded per battle.
  ...Object.entries({ rain1: 'rain_1', rain2: 'rain_2', rain3: 'rain_3', hail1: 'hail_1', hail2: 'hail_2', hail3: 'hail_3', snow1: 'blizzard_1', snow2: 'blizzard_2', snow3: 'blizzard_3', snow4: 'blizzard_4', sandTile: 'sandstorm_tile', snowTile: 'blizzard_tile' }).map(
    ([id, file]): AssetEntry => ({ id: `fx.weather.${id}`, kind: 'image', category: 'ui', path: `images/packs/uie/weather/${file}.png`, lazy: true }),
  ),
  ...['basic', 'ultra', 'max', 'tera'].map((n): AssetEntry => ({ id: `bgm.raid.adventure.${n}`, kind: 'audio', category: 'music', path: `audio/bgm/raid_adventure_${n}.mp3`, lazy: true })),
  // Header bars (UIE pack Graphics/Custom UI/Pause Menu), one per colour; see `ui/frames.ts`.
  ...['blue', 'green', 'orange', 'pink', 'purple', 'red'].map((c): AssetEntry => ({ id: `ui.bar.top.${c}`, kind: 'image', category: 'ui', path: `images/packs/uie/pause/top_${c}.png`, lazy: true })),
  // Options screen backdrop (UIE pack Graphics/Custom UI/Options), shown behind the title screen's Settings page.
  { id: 'ui.optionsbg', kind: 'image', category: 'ui', path: 'images/packs/uie/custom/options_bg.png', lazy: true },
  // Trainer card art (UIE pack Graphics/Custom UI/Trainer), shown in the Hub's Trainer Card room.
  { id: 'ui.trainercard', kind: 'image', category: 'ui', path: 'images/packs/uie/custom/trainer_card.png', lazy: true },
  // Party list icon boxes (UIE pack Graphics/Custom UI/Party), loaded the first time a party list opens.
  ...['icon_box', 'icon_box_faint'].map((n): AssetEntry => ({ id: `ui.party.${n}`, kind: 'image', category: 'ui', path: `images/packs/uie/party/${n}.png`, lazy: true })),
  // Bag illustration (UIE pack Graphics/Custom UI/Bag), shown in the Bag menu header.
  { id: 'ui.bag.main', kind: 'image', category: 'ui', path: 'images/packs/uie/bag/bag_1.png', lazy: true },
  { id: 'ui.bag.bg', kind: 'image', category: 'ui', path: 'images/packs/uie/bag/bg_bag.png', lazy: true },
  // Pokédex seen/caught marks (UIE pack Graphics/Custom UI/Dex), used in the Research Room rows.
  ...['seen', 'caught'].map((n): AssetEntry => ({ id: `ui.dex.${n}`, kind: 'image', category: 'ui', path: `images/packs/uie/dex/${n}.png`, lazy: true })),
  // Party status badges (7 rows of 16 px: SLP PSN BRN PAR FRZ FNT PKRS) and held-item mark, from the UIE pack Custom UI/Party.
  { id: 'ui.party.statuses', kind: 'image', category: 'ui', path: 'images/packs/uie/party/statuses.png', lazy: true },
  { id: 'ui.party.icon_item', kind: 'image', category: 'ui', path: 'images/packs/uie/party/icon_item.png', lazy: true },
  // Load/Save screens (UIE pack Graphics/Custom UI/Load and Save): the title screen's Continue card and the Save data backdrop.
  { id: 'ui.load.card', kind: 'image', category: 'ui', path: 'images/packs/uie/load/continue_card.png', lazy: true },
  { id: 'ui.save.bg', kind: 'image', category: 'ui', path: 'images/packs/uie/load/save_background.png', lazy: true },
  // Pokédex info page art (UIE pack Graphics/Custom UI/Dex), behind a species' page in the Research Room.
  { id: 'ui.dex.bg_info', kind: 'image', category: 'ui', path: 'images/packs/uie/dex/bg_info.png', lazy: true },
  // Rule-mask screen wipes (UIE pack Graphics/Transitions), loaded when a battle picks one.
  ...['fade_down', 'fade_up', 'stripes', 'stairs', 'stairs2', 'tiles', 'ripple', 'spread', 'swirl', 'hex', 'computer', 'computer_close'].map(
    (m): AssetEntry => ({ id: `fx.wipe.${m}`, kind: 'image', category: 'ui', path: `images/packs/uie/transitions/${m}.png`, lazy: true }),
  ),
  { id: 'bgm.battle_trainer', kind: 'audio', category: 'music', path: 'audio/bgm/battle_trainer.mp3' },
  // GB Sounds stand-in: an original Game Boy style loop rendered by tools/make-gb-battle.py (the packs have no Gen 1 music).
  { id: 'bgm.battle_gb', kind: 'audio', category: 'music', path: 'audio/bgm/battle_gb.mp3', lazy: true },
  // Victory fanfares from the Essentials EBDX kit ("Battle victory wild/trainer/leader"), loaded when a battle starts.
  ...['wild', 'trainer', 'leader'].map((n): AssetEntry => ({ id: `bgm.victory_${n}`, kind: 'audio', category: 'music', path: `audio/bgm/victory_${n}.mp3`, lazy: true })),
  // Ending credits: "PWT Victor!" (B2W2 arrangement shipped with the Essentials EBDX kit), looped.
  { id: 'bgm.credits', kind: 'audio', category: 'music', path: 'audio/bgm/credits.mp3' },
  // Map, Hub, shop, event and boss songs from the packs (ORAS tracks from the UIE .rar; B2W2 PWT and Low HP Battle from the EBDX zip).
  // Re-encoded to 80 kbps mp3, loaded when the screen or battle opens (`playMusicLazy`, `bossTrack`).
  ...['map', 'map_bike', 'map_surf', 'hub', 'shop', 'event', 'battle_leader', 'battle_elite', 'battle_rival', 'victory_elite'].map(
    (n): AssetEntry => ({ id: `bgm.${n}`, kind: 'audio', category: 'music', path: `audio/bgm/${n}.mp3`, lazy: true }),
  ),
  // Jingles (UIE "ME" folder): item, key item, badge, new Pokémon, evolution, healing, save, TM, berry, forgotten move.
  ...Object.entries({ item_get: 'item_get', key_item: 'key_item', badge: 'badge', pkmn_get: 'pkmn_get', evo_start: 'evo_start', evo_success: 'evo_success', heal: 'heal', save: 'save', tm_get: 'tm_get', berry: 'berry', forget_move: 'forget_move' }).map(
    ([id, file]): AssetEntry => ({ id: `me.${id}`, kind: 'audio', category: 'sound', path: `audio/me/${file}.ogg`, lazy: true }),
  ),
  // Interface and battle sounds (UIE "SE" folder). `ui.select` and `ui.error` are the pack's decision and buzzer.
  ...['cursor', 'cancel', 'menu_open', 'menu_close', 'party_switch', 'save_choice', 'ability', 'item', 'flee', 'recall', 'use_item', 'buy', 'pc_open', 'pc_close', 'exclaim', 'vs_flash', 'vs_sword', 'page', 'door', 'poison_step'].map(
    (n): AssetEntry => ({ id: `ui.${n}`, kind: 'audio', category: 'sound', path: `audio/se/ui_${n}.ogg` }),
  ),
  // Stat and status sounds reuse the pack's move-animation clips.
  ...Object.entries({ stat_up: 'ess-up', stat_down: 'ess-take-down', brn: 'prsfx-burn', psn: 'ess-poison', par: 'ess-paralyze1', slp: 'ess-sleep', frz: 'prsfx-freeze-dry1' }).map(
    ([id, file]): AssetEntry => ({ id: `se.${id}`, kind: 'audio', category: 'sound', path: `audio/battle_anims/${file}.m4a`, lazy: true }),
  ),
  { id: 'se.ball_throw', kind: 'audio', category: 'sound', path: 'audio/se/pb_throw.wav' },
  { id: 'se.ball_shake', kind: 'audio', category: 'sound', path: 'audio/se/pb_move.wav' },
  { id: 'se.ball_catch', kind: 'audio', category: 'sound', path: 'audio/se/pb_catch.wav' },
  { id: 'se.ball_release', kind: 'audio', category: 'sound', path: 'audio/se/pb_rel.wav' },
  { id: 'se.shiny', kind: 'audio', category: 'sound', path: 'audio/se/sparkle.wav' },
  { id: 'se.hit', kind: 'audio', category: 'sound', path: 'audio/se/hit.wav' },
  { id: 'se.hit_strong', kind: 'audio', category: 'sound', path: 'audio/se/hit_strong.wav' },
  { id: 'se.hit_weak', kind: 'audio', category: 'sound', path: 'audio/se/hit_weak.wav' },
  { id: 'se.faint', kind: 'audio', category: 'sound', path: 'audio/se/faint.wav' },
  { id: 'se.level_up', kind: 'audio', category: 'sound', path: 'audio/se/level_up.wav' },
  { id: 'se.exp', kind: 'audio', category: 'sound', path: 'audio/se/exp.wav' },
  { id: 'se.egg_get', kind: 'audio', category: 'sound', path: 'audio/se/egg_get.ogg' },
  { id: 'ui.select', kind: 'audio', category: 'sound', path: 'audio/se/ui_decision.ogg' },
  { id: 'ui.error', kind: 'audio', category: 'sound', path: 'audio/se/ui_buzzer.ogg' },
  { id: 'font.main', kind: 'font', category: 'font', path: 'fonts/pokemon-emerald-pro.ttf' },
  // The Gen 3 battle font: chunky pixel text for everything but fine print.
  { id: 'font.bold', kind: 'font', category: 'font', path: 'fonts/pkmnems.ttf' },
];

export function trainerEntry(assetId: string): AssetEntry {
  // "boss.cynthia-gen7" -> images/bosses/cynthia-gen7.png (a single picture from the director's boss pack)
  if (assetId.startsWith('boss.')) {
    return { id: assetId, kind: 'image', category: 'trainer', path: `images/bosses/${assetId.slice('boss.'.length)}.png` };
  }
  // "trainer.red" -> images/trainer/red
  return atlas(assetId, 'trainer', `images/trainer/${assetId.replace(/^trainer\./, '')}`);
}

export function itemEntry(assetId: string): AssetEntry {
  // "ball.pb" -> images/pokeball/pb.png (the Poké Ball pack)
  if (assetId.startsWith('ball.')) {
    return { id: assetId, kind: 'image', category: 'item', path: `images/pokeball/${assetId.slice('ball.'.length)}.png` };
  }
  // "item.super_potion" -> images/items/super_potion.png
  return { id: assetId, kind: 'image', category: 'item', path: `images/items/${assetId.replace(/^item\./, '')}.png` };
}

export function backgroundEntry(assetId: string): AssetEntry {
  // "bg.arena.volcano" -> images/arenas/volcano_bg.png
  return { id: assetId, kind: 'image', category: 'background', path: `images/arenas/${assetId.replace(/^bg\.arena\./, '')}_bg.png` };
}

/**
 * The ground patches the Pokémon stand on in an arena, drawn over its
 * background: "bg.arena.volcano.player" -> images/arenas/volcano_a.png and
 * "bg.arena.volcano.enemy" -> images/arenas/volcano_b.png.
 */
export function arenaBaseEntries(assetId: string): AssetEntry[] {
  const name = assetId.replace(/^bg\.arena\./, '');
  return [
    { id: `${assetId}.player`, kind: 'image', category: 'background', path: `images/arenas/${name}_a.png` },
    { id: `${assetId}.enemy`, kind: 'image', category: 'background', path: `images/arenas/${name}_b.png` },
  ];
}

/** Asset IDs for one Pokémon's art. */
export const pokemonAssetIds = (art: PokemonArt) => ({
  front: `pokemon.front.${art.sprite}`,
  back: `pokemon.back.${art.sprite}`,
  shinyFront: `pokemon.shiny.front.${art.sprite}`,
  shinyBack: `pokemon.shiny.back.${art.sprite}`,
  icon: `pokemon.icon.${art.icon.slice(art.icon.indexOf('/') + 1)}`,
  cry: `cry.${art.cry}`,
});

export function pokemonEntries(art: PokemonArt): AssetEntry[] {
  const ids = pokemonAssetIds(art);
  const lazy = (e: AssetEntry): AssetEntry => ({ ...e, lazy: true });
  const entries: AssetEntry[] = [
    atlas(ids.front, 'pokemon', `images/pokemon/${art.sprite}`),
    atlas(ids.back, 'pokemon', `images/pokemon/back/${art.sprite}`),
    atlas(ids.shinyFront, 'pokemon', `images/pokemon/shiny/${art.sprite}`),
    atlas(ids.shinyBack, 'pokemon', `images/pokemon/back/shiny/${art.sprite}`),
    atlas(ids.icon, 'pokemon', `images/pokemon/icons/${art.icon}`),
    { id: ids.cry, kind: 'audio', category: 'sound', path: `audio/cry/${art.cry}.m4a` },
  ];
  return entries.map(lazy);
}

/** Asset ids for the battle animation files (all loaded when a move first plays). */
export const animAssetIds = {
  data: (name: string) => `anim.data.${name}`,
  sheet: (slug: string) => `anim.sheet.${slug}`,
  background: (slug: string) => `anim.bg.${slug}`,
  sound: (slug: string) => `anim.sound.${slug}`,
};

export function battleAnimEntries(anims: NonNullable<CatalogInputs['battleAnims']>): AssetEntry[] {
  return [
    ...anims.names.map((n): AssetEntry => ({ id: animAssetIds.data(n), kind: 'json', category: 'animation', path: `battle-anims/${n}.json`, lazy: true })),
    ...anims.sheets.map((s): AssetEntry => ({ id: animAssetIds.sheet(s), kind: 'spritesheet', category: 'animation', path: `images/battle_anims/${s}.png`, frameSize: 96, lazy: true })),
    ...anims.backgrounds.map((b): AssetEntry => ({ id: animAssetIds.background(b), kind: 'image', category: 'animation', path: `images/battle_anims/${b}.png`, lazy: true })),
    ...anims.sounds.map((s): AssetEntry => ({ id: animAssetIds.sound(s), kind: 'audio', category: 'animation', path: `audio/battle_anims/${s}.m4a`, lazy: true })),
  ];
}

export const ebdxAssetIds = {
  image: (name: string) => `ebdx.move.${name}`,
  sound: (id: string) => `ebdx.sfx.${id}`,
};

export function ebdxAnimEntries(input: NonNullable<CatalogInputs['ebdxAnims']>): AssetEntry[] {
  return [
    ...input.images.map((n): AssetEntry => ({ id: ebdxAssetIds.image(n), kind: 'image', category: 'animation', path: `images/packs/ebdx/moves/${n}.png`, lazy: true })),
    ...input.sounds.map((n): AssetEntry => ({ id: ebdxAssetIds.sound(n), kind: 'audio', category: 'animation', path: `audio/ebdx/${n}.m4a`, lazy: true })),
  ];
}

/** Every asset the current game data could ask for. */
export function buildCatalog(inputs: CatalogInputs): AssetEntry[] {
  const entries = [
    ...FIXED_ASSETS,
    ...inputs.pokemon.flatMap(pokemonEntries),
    ...inputs.trainerAssetIds.map(trainerEntry),
    ...inputs.itemAssetIds.map(itemEntry),
    ...inputs.backgroundAssetIds.map(backgroundEntry),
    ...inputs.backgroundAssetIds.flatMap(arenaBaseEntries),
    ...(inputs.battleAnims ? battleAnimEntries(inputs.battleAnims) : []),
    ...(inputs.ebdxAnims ? ebdxAnimEntries(inputs.ebdxAnims) : []),
  ];
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

/** Files each entry needs (an atlas needs both its image and its JSON). */
export function filesOf(entry: AssetEntry): string[] {
  return entry.atlasPath ? [entry.path, entry.atlasPath] : [entry.path];
}

export interface AssetManifest {
  generatedAt: string;
  /** Entries whose files all exist. */
  assets: AssetEntry[];
  /** Catalog IDs whose files were not found (placeholders are used). */
  missing: { id: string; files: string[] }[];
}
