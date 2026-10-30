// Data for the building/service stops (Untitled doc §19): services.json.

import { z } from 'zod';
import json from '../../data/services.json';

export const ServiceDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['supported', 'limited', 'planned']),
  weight: z.number().min(0),
  minBadges: z.number().int().min(0),
  /** A reusable stop (Center, Reminder) can be visited again; others work once. */
  reusable: z.boolean(),
  /** The stop only appears when the run has what it needs (rival: a living rival). */
  requires: z.enum(['rival']).optional(),
  blurb: z.string(),
});
export type ServiceDef = z.infer<typeof ServiceDefSchema>;

export const ServicesSchema = z.object({ note: z.string(), stopChance: z.number().min(0).max(1),
  costs: z.object({ regionScale: z.number().min(0), healPerMon: z.number(), curePerMon: z.number(), revivePerMon: z.number(), tutor: z.number(), reminder: z.number(), researchPrice: z.number(), researchPoints: z.number().int(), scan: z.number(), tradeFee: z.number(), scout: z.number(), tradeSpecialChance: z.number().min(0).max(1), tradeBstSpread: z.number().min(0), evolutionItem: z.number(), dojo: z.number(), truce: z.number() }),
  services: z.array(ServiceDefSchema).min(1) });
export const SERVICES = ServicesSchema.parse(json);

export const getService = (id: string): ServiceDef => {
  const s = SERVICES.services.find((x) => x.id === id);
  if (!s) throw new Error(`No service "${id}"`);
  return s;
};
