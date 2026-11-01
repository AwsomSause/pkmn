// Battle log filter tabs (ideas W1 F3): sorts the said lines into Damage, Status, Weather and Ability by their words.
// Presentation only: it reads text, never changes a battle.

export type LogTab = 'all' | 'damage' | 'status' | 'weather' | 'ability';
export const LOG_TABS: readonly { id: LogTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'damage', label: 'Damage' },
  { id: 'status', label: 'Status' },
  { id: 'weather', label: 'Weather' },
  { id: 'ability', label: 'Ability' },
];

const RULES: { tab: Exclude<LogTab, 'all'>; re: RegExp }[] = [
  { tab: 'weather', re: /\b(rain|sun(light)?|sandstorm|hail|snow|fog|weather|terrain|harsh|downpour|gravity|trick room)\b/i },
  { tab: 'ability', re: /\b(ability|abilit|intimidate|pressure|levitate|sturdy|cheers from the bench)\b|'s [A-Z][\w' -]+!$/ },
  { tab: 'status', re: /\b(poison|burn|paraly|asleep|sleep|frozen|freez|confus|flinch|bleed|curse|woke|thawed|infatuat|fell|rose|sharply|stat|boost|wore off|cured)/i },
  { tab: 'damage', re: /\b(damage|hurt|lost|super effective|not very effective|critical|fainted|knocked|recoil|hit|took|HP)\b/i },
];

/** The tab a line belongs to (first match), or null for plain story lines that only show under All. */
export function classifyLine(line: string): Exclude<LogTab, 'all'> | null {
  for (const r of RULES) if (r.re.test(line)) return r.tab;
  return null;
}

export const filterLog = (lines: readonly string[], tab: LogTab): string[] => (tab === 'all' ? [...lines] : lines.filter((l) => classifyLine(l) === tab));
