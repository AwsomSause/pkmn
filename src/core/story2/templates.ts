// Story text templates: {token} placeholders in news headlines and Chronicle lines. Pure and deterministic.

/** Every token story text may use. A token outside this list fails the `story-template-tokens` gate. */
export const TEMPLATE_TOKENS = [
  'player', 'rival', 'leader', 'town', 'region', 'team', 'legend', 'professor',
  'theme', 'ending', 'starter', 'seed', 'character', 'stage', 'node', 'event', 'choice', 'quest', 'outcome', 'speaker', 'pokemon', 'title', 'memory',
  // The player's pronouns (story2/identity.ts pronounForms), lower and capitalised; Story Run scenes fill them.
  'they', 'them', 'their', 'theirs', 'themself', 'they_are', 'they_were', 'They', 'Them', 'Their', 'Theirs', 'Themself', 'They_are', 'They_were',
] as const;
export type TemplateToken = (typeof TEMPLATE_TOKENS)[number];

export const OUTLETS = ['meridian_courier', 'reaches_herald', 'the_wire'] as const;

const TOKEN_RE = /\{(\w+)\}/g;

/** The tokens a text uses, in order, without repeats. */
export function tokensIn(text: string): string[] {
  return [...new Set([...text.matchAll(TOKEN_RE)].map((m) => m[1]!))];
}

/** Fills every {token} from `values`. A missing value leaves the token visible so a gap shows up in testing instead of silently vanishing. */
export function renderTemplate(text: string, values: Partial<Record<string, string | number>>): string {
  return text.replace(TOKEN_RE, (whole, k: string) => (values[k] === undefined ? whole : String(values[k])));
}
