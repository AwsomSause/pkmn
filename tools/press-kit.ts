// Press kit page (W12 F225): `node tools/press-kit.ts [promoImagesDir] [count]` copies a few promo images into
// docs/press-kit/images and writes docs/press-kit/index.html. Re-running replaces the page.
//   promoImagesDir  default /mnt/project-files/promo/ads-2000s-v2/images
//   count           default 8 (spread evenly over the folder)
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2] ?? '/mnt/project-files/promo/ads-2000s-v2/images';
const count = Number(process.argv[3] ?? 8);
const out = new URL('../docs/press-kit/', import.meta.url).pathname;
const files = readdirSync(src).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
if (files.length === 0) throw new Error(`no images in ${src}`);
const picks = Array.from({ length: Math.min(count, files.length) }, (_, i) => files[Math.floor((i * files.length) / Math.min(count, files.length))]!);
mkdirSync(join(out, 'images'), { recursive: true });
for (const f of picks) copyFileSync(join(src, f), join(out, 'images', f));

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pocket Raiders press kit</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#123;background:#f4f9ff}h1{margin-bottom:0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}img{width:100%;border-radius:10px;box-shadow:0 2px 8px #0003}</style></head><body>
<h1>Pocket Raiders</h1><p><em>A Pokémon roguelike you can replay in your browser.</em></p>
<h2>About</h2><p>Pocket Raiders is a deterministic, seeded roguelike: pick a trainer and a starter, build a team across regions, beat gym leaders, rivals and the Pokémon League, and carry a legacy into the next run. It runs in a web browser and installs as an offline app.</p>
<h2>Facts</h2><ul><li>Play: <a href="https://awsomsause.github.io/pkmn/">awsomsause.github.io/pkmn</a></li><li>Made with TypeScript, Phaser and Vite</li><li>Fan project. Pokémon and its characters belong to their owners; the project repository is private.</li></ul>
<h2>Screens</h2><div class="grid">${picks.map((f) => `<a href="images/${f}"><img src="images/${f}" alt="Promo image ${f.replace(/\.[a-z]+$/i, '')}" loading="lazy"></a>`).join('')}</div>
</body></html>`;
writeFileSync(join(out, 'index.html'), html);
console.log(`press kit: ${picks.length} images -> docs/press-kit/index.html`);
