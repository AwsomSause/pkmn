// Data for the Trainer Plaza's look, crowd and mini-events (plazaLife.json).

import { z } from 'zod';
import json from '../../data/plazaLife.json';
import { EventEffectSchema } from '../contentSchema';

const SECTION_IDS = ['stalls', 'oddities', 'traders', 'board', 'rumors', 'club', 'errands', 'alley', 'services', 'people', 'caravan'] as const;
export const DistrictIdSchema = z.enum(['market', 'trading', 'gathering', 'social', 'services', 'secret']);
export type DistrictId = z.infer<typeof DistrictIdSchema>;

const Effects = z.array(EventEffectSchema).default([]);

const LifeSchema = z.object({
  districts: z.array(z.object({
    id: DistrictIdSchema,
    name: z.string(),
    blurb: z.string(),
    sections: z.array(z.enum(SECTION_IDS)).min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    color: z.string(),
  })).length(6),
  looks: z.array(z.object({ id: z.string(), name: z.string(), decor: z.array(z.string()), tint: z.number().int() })).min(3),
  travelers: z.array(z.object({ name: z.string(), line: z.string() })).min(6),
  chatter: z.array(z.tuple([z.string(), z.string()])).min(3),
  rare: z.array(z.object({ id: z.string(), name: z.string(), line: z.string(), minBadges: z.number().int().min(0), giftText: z.string(), gift: Effects })).min(2),
  fountain: z.object({ cost: z.number().int().min(0), text: z.string(), wishes: z.array(z.object({ weight: z.number().positive(), text: z.string(), effects: Effects })).min(1) }),
  performance: z.object({ cost: z.number().int().min(0), text: z.string(), rewardText: z.string(), rep: z.number().int(), effects: Effects }),
  bubbles: z.object({ player: z.array(z.string()).min(1), secretClosed: z.string() }),
});
export const PLAZA_LIFE = LifeSchema.parse(json);

