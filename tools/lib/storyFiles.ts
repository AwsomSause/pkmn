// Plain-node helpers for the story data files (no game imports, so any tool can use them).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './gameModules.ts';

export const STORY_FILES = ['characters', 'events', 'arcs', 'themes', 'remembrances', 'moveMoments', 'dialogue', 'lore', 'news', 'interactables', 'backstories', 'quiz', 'blueprintRules', 'rivals', 'rivalThemes', 'starterArcs', 'questArcs', 'worldScenes'];
export const storyDir = join(root, 'src', 'data', 'story');

export function readStory(): { raw: Record<string, unknown>; text: unknown; hash: string; sizes: Record<string, number> } {
  const raw = Object.fromEntries(STORY_FILES.map((f) => [f, JSON.parse(readFileSync(join(storyDir, `${f}.json`), 'utf8'))]));
  // text/en.json plus any text/<part>.en.json (a slice's own strings; merged in file-name order).
  const textFiles = readdirSync(join(storyDir, 'text')).filter((f) => f.endsWith('.json')).sort((a, b) => (a === 'en.json' ? -1 : b === 'en.json' ? 1 : a.localeCompare(b)));
  const text = Object.assign({}, ...textFiles.map((f) => JSON.parse(readFileSync(join(storyDir, 'text', f), 'utf8'))));
  const hash = createHash('sha256').update(JSON.stringify([raw, text])).digest('hex').slice(0, 16);
  const sizes = Object.fromEntries([...STORY_FILES.map((f) => [f, statSync(join(storyDir, `${f}.json`)).size]), ...textFiles.map((f) => [f === 'en.json' ? 'text' : `text/${f}`, statSync(join(storyDir, 'text', f)).size])]);
  return { raw, text, hash, sizes };
}
export const storedHash = (): string => JSON.parse(readFileSync(join(storyDir, 'hash.json'), 'utf8')).hash;
