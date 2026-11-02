// Hub Town (spec 2026-11-01): the map data built by tools/hubtown/build.py from the Pokémon-Memories tilesets.
// Pure data shapes; the rules that read them are in ./world.ts.

import { z } from 'zod';
import json from '../../data/hubTown.json';
import overworldJson from '../../data/overworld.json';

const Int = z.number().int();
const Tile = z.object({ x: Int, y: Int });
export const FACINGS = ['up', 'down', 'left', 'right'] as const;
export type Facing = (typeof FACINGS)[number];

export const HubPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** building: face its door; gate: step into the gateway; sign: face the sign. */
  kind: z.enum(['building', 'gate', 'sign']),
  /** The Hub rooms (scenes/HubScene.ts) this place opens, in menu order. */
  rooms: z.array(z.string()).min(1),
  blurb: z.string(),
  /** The tile you face (building, sign) or step on (gate). */
  door: Tile,
  /** Where you stand when you come back out of it. */
  stand: Tile.extend({ facing: z.enum(FACINGS) }),
});
export type HubPlace = z.infer<typeof HubPlaceSchema>;

export const HubTownSchema = z.object({
  size: z.tuple([Int.min(1), Int.min(1)]),
  tile: Int.min(1),
  /** Columns in the ground-tile atlas (images/overworld/hubtown_tiles.png). */
  columns: Int.min(1),
  /** Ground and overlay layers, row by row (W*H tile indices; -1 = nothing). */
  ground: z.array(Int.min(-1)),
  overlay: z.array(Int.min(-1)),
  /** Buildings, trees and props: [frame in hubtown_props, x px, y px, depth (bottom of the solid part, px)], sorted by depth. */
  props: z.array(z.tuple([z.string(), Int, Int, Int])),
  /** Tiles you cannot walk on: [x, y]. */
  solid: z.array(z.tuple([Int, Int])),
  /** Water rectangles (x, y, w, h tiles), for the shimmer. */
  water: z.array(z.tuple([Int, Int, Int, Int])),
  places: z.array(HubPlaceSchema),
  spawn: Tile.extend({ facing: z.enum(FACINGS) }),
  /** People who belong to a place (shopkeepers, the gatekeeper). */
  keepers: z.array(z.object({ id: z.string(), sprite: z.string(), x: Int, y: Int, facing: z.enum(FACINGS), location: z.string() })),
  /** Named areas the wandering crowd spreads over (x, y, w, h tiles). */
  zones: z.record(z.string(), z.tuple([Int, Int, Int, Int])),
  /** The Legacy Display's six pedestals around the fountain (tiles), first = the current run's Trainer. */
  pads: z.array(z.tuple([Int, Int])).length(6),
});
export type HubTownData = z.infer<typeof HubTownSchema>;

export const HUB_TOWN: HubTownData = HubTownSchema.parse(json);

export const OverworldSchema = z.object({
  /** Trainer walk sheets in images/overworld/trainers (4x4 frames of 64 px). */
  trainers: z.array(z.string()),
  /** Pokémon follower sheets in images/overworld/followers: file name → frame size (4x4 frames). */
  followers: z.record(z.string(), Int.min(16)),
});
export const OVERWORLD = OverworldSchema.parse(overworldJson);
