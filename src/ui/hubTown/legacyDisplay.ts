// The Legacy Display (Hub Town spec 2026-11-01 §5): the run in progress and up to five past Trainers stand on the six
// pedestals around the plaza fountain, each with their Ace beside them. Face one and press Z to look at their record.
// The list is core/legacyRuns.ts legacyRotation (current run first, memorable runs first); records are only read.

import Phaser from 'phaser';
import { overworldAssetIds } from '../../assets/catalog';
import type { Content } from '../../core/contentSchema';
import { HUB_TOWN } from '../../core/hubTown/schema';
import { followerKey, FALLBACK_FOLLOWER, trainerSheet, type Tile } from '../../core/hubTown/world';
import type { RotationEntry } from '../../core/legacyRuns';
import { textStyle } from '../theme';
import type { HubTownView } from './townView';

const OUTCOME: Record<RotationEntry['outcome'], string> = { victory: 'Champion', defeat: 'Fell', inProgress: 'On the road now' };

/** The art one display entry needs (trainer sheet and Ace follower), for preloading. */
export function displayAssets(content: Content, entries: readonly RotationEntry[]): string[] {
  const ids: string[] = [];
  for (const e of entries.slice(0, HUB_TOWN.pads.length)) {
    ids.push(overworldAssetIds.trainer(trainerSheet(e.archetypeId, content.archetypes.get(e.archetypeId)?.name)));
    ids.push(overworldAssetIds.follower(aceFollower(e)));
  }
  return ids;
}

function aceFollower(e: RotationEntry): string {
  return (e.ace && followerKey(e.ace.speciesId)) || FALLBACK_FOLLOWER;
}

/** The lines a pedestal's card shows (also used for the name tag). */
export function displayLines(content: Content, e: RotationEntry): { name: string; ace: string; story: string; feats: string } {
  const archetype = content.archetypes.get(e.archetypeId);
  const species = e.ace ? content.species.get(e.ace.speciesId) : undefined;
  const region = e.regionId ? content.regions.get(e.regionId)?.name ?? e.regionId : null;
  return {
    name: `${e.memorable ? '★ ' : ''}${archetype?.name ?? e.archetypeId}${e.current ? '  ·  now' : ''}`,
    ace: species ? `${species.name}${e.ace!.shiny ? ' ✦' : ''}  Lv ${e.ace!.level}` : '',
    story: [region, OUTCOME[e.outcome]].filter(Boolean).join('  ·  '),
    feats: e.accomplishments.join('  ·  '),
  };
}

export class LegacyDisplay {
  /** The entry on the first pedestal (the current run when there is one); kept as `current` for tests and the old stage. */
  readonly current: RotationEntry | null;

  constructor(
    private readonly town: HubTownView,
    private readonly scene: Phaser.Scene,
    private readonly content: Content,
    readonly entries: readonly RotationEntry[],
    opts: { motion: 'full' | 'reduced' | 'off'; onInspect(entry: RotationEntry): void },
  ) {
    this.current = entries[0] ?? null;
    const T = HUB_TOWN.tile;
    const midX = HUB_TOWN.pads.reduce((s, [x]) => s + x, 0) / HUB_TOWN.pads.length;
    HUB_TOWN.pads.forEach(([px, py], i) => {
      const pad: Tile = { x: px, y: py };
      // The Ace stands on the outer side, away from the fountain.
      const aceAt: Tile = { x: px < midX ? px - 1 : px + 1, y: py };
      const entry = entries[i];
      town.world(() => this.pedestal(pad, aceAt, Boolean(entry?.current), opts.motion));
      if (!entry) return;
      const lines = displayLines(content, entry);
      const sheet = overworldAssetIds.trainer(trainerSheet(entry.archetypeId, content.archetypes.get(entry.archetypeId)?.name));
      const ace = overworldAssetIds.follower(aceFollower(entry));
      if (scene.textures.exists(sheet)) town.addPerson(`legacy-${i}`, sheet, pad, 'down', { bob: false });
      if (scene.textures.exists(ace)) {
        const mon = town.addPerson(`legacy-ace-${i}`, ace, aceAt, 'down', { bob: true });
        if (entry.ace?.shiny) mon.setTint(0xfff2c0);
      }
      // A small name tag over the pair.
      town.world(() => {
        const tagX = ((pad.x + aceAt.x) / 2) * T + T / 2;
        const tagY = pad.y * T - 58;
        const tag = scene.add
          .text(tagX, tagY, `${lines.name}\n${lines.ace}`, textStyle(12, entry.memorable ? '#ffe08a' : '#ffffff', { align: 'center', stroke: '#10203a', strokeThickness: 4 }))
          .setOrigin(0.5, 1)
          .setDepth(10 + pad.y * T + 400)
          .setName(`legacy-tag-${entry.runId}`);
        if (opts.motion === 'full') scene.tweens.add({ targets: tag, y: tagY - 3, duration: 1300 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      });
      town.addTalker({ id: `legacy-${i}`, name: lines.name.replace('★ ', ''), verb: 'Look', tiles: [pad, aceAt], onTalk: () => opts.onInspect(entry) });
    });
  }

  /** A round stone pedestal under each pair; the current run's glows sky blue, the rest gold. */
  private pedestal(pad: Tile, aceAt: Tile, current: boolean, motion: string): void {
    const T = HUB_TOWN.tile;
    const x = ((pad.x + aceAt.x) / 2) * T + T / 2;
    const y = pad.y * T + T - 4;
    const g = this.scene.add.graphics().setDepth(10 + pad.y * T - 2);
    g.fillStyle(0x000000, 0.18).fillEllipse(x + 3, y + 4, 2 * T + 18, 22);
    g.fillStyle(0xcfc6b8, 1).fillEllipse(x, y, 2 * T + 16, 20);
    g.fillStyle(0xf2ece0, 1).fillEllipse(x, y - 3, 2 * T + 8, 14);
    const glow = this.scene.add.ellipse(x, y - 3, 2 * T + 4, 12, current ? 0x7fd8ff : 0xffe08a, 0.45).setDepth(10 + pad.y * T - 1);
    if (motion === 'full') this.scene.tweens.add({ targets: glow, alpha: 0.15, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
