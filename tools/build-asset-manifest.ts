// Checks which catalog assets really exist under public/assets/ and writes
// public/assets/manifest.json. Missing files are listed, never invented.
//
//   npm run assets:manifest

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog, filesOf, type AssetManifest } from '../src/assets/catalog.ts';
import { readCatalogInputs } from './catalogInputs.ts';

const assetsDir = join(import.meta.dirname, '..', 'public', 'assets');

const catalog = buildCatalog(readCatalogInputs());
const manifest: AssetManifest = { generatedAt: new Date().toISOString(), assets: [], missing: [] };

for (const entry of catalog) {
  const missingFiles = filesOf(entry).filter((f) => !existsSync(join(assetsDir, f)));
  if (missingFiles.length === 0) manifest.assets.push(entry);
  else manifest.missing.push({ id: entry.id, files: missingFiles });
}

writeFileSync(join(assetsDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Asset manifest: ${manifest.assets.length} found, ${manifest.missing.length} missing.`);
for (const m of manifest.missing) console.log(`  missing ${m.id}: ${m.files.join(', ')}`);
