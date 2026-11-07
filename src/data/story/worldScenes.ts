// Story Run world scenes (Design v2 Part XI event templates, Part II-F Eevee Crossroads, Part II camp scenes).
// worldScenes.json is compact (tools/story/build-world-scenes.mjs); this file expands it into ordinary story events so
// events.json stays small. The text is in text/worldScenes.en.json. When each one plays is core/story2/worldScenes.ts:
// its needs are written as tags (`need_after_<event>`, `need_heartbond_<n>`, `need_backstory_<id>`, `need_team_<id>`). Pure.

type Json = Record<string, unknown>;
interface Compact {
  templates: { id: string; act: number; needs: string[]; choices: { id: string; effects: Json[] }[] }[];
  eevee: { form: string; type: string }[];
  camp: string[];
}

const narr = (id: string, keys: string[]) => keys.map((k, i) => ({ id: `${id}_b${i + 1}`, kind: 'narration', textKey: k }));
const base = (id: string, tags: string[], beats: Json[]) => ({ id, v: 1, tags, requires: [], roles: {}, beats, choices: [] as Json[], outputs: [] as Json[], variants: [], cost: 1, tier: 'C', moment: 'minor' });

export function worldSceneEvents(c: Compact): Json[] {
  const out: Json[] = [];
  for (const t of c.templates) {
    const id = `ev_tpl_${t.id}`;
    const needs = t.needs.map((n) => `need_${n.replace(':', '_')}`);
    out.push({ ...base(id, ['world', 'template', `act${t.act}`, ...needs], narr(id, [`tpl.${t.id}.b1`, `tpl.${t.id}.b2`])), choices: t.choices.map((ch) => ({ id: ch.id, textKey: `tpl.${t.id}.c.${ch.id}`, effects: ch.effects })) });
  }
  for (const e of c.eevee) {
    const id = `ev_eevee_${e.form}`;
    out.push({ ...base(id, ['world', 'eevee', `eevee_${e.type}`], narr(id, [`eevee.${e.form}.b1`, `eevee.${e.form}.b2`])), moment: 'major', choices: [
      { id: 'change', textKey: 'eevee.c.change', effects: [{ id: `${id}_change`, kind: 'evolve_eevee', form: e.form }] },
      { id: 'stay', textKey: 'eevee.c.stay', effects: [{ id: `${id}_stay`, kind: 'set_flag', key: `eevee_stayed_${e.form}`, value: true }] },
    ] });
  }
  for (const k of c.camp) for (const n of [1, 2]) out.push(base(`ev_camp_${k}_${n}`, ['world', 'camp', `chem_${k}`], narr(`ev_camp_${k}_${n}`, [`camp.${k}.${n}`])));
  return out;
}

/** Adds the expanded world scenes to raw story files (`worldScenes` holds the compact file); a no-op without it. */
export function withWorldScenes(raw: Record<string, unknown>): Record<string, unknown> {
  const ws = raw.worldScenes as Compact | undefined;
  if (!ws?.templates) return raw;
  const { worldScenes: _drop, ...rest } = raw;
  return { ...rest, events: [...(raw.events as Json[]), ...worldSceneEvents(ws)] };
}
