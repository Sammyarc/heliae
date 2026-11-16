// Renders the favicon set, the share image and favicon.ico.
// Needs the page server running (npm start) and Playwright + Chrome.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

let require = createRequire(new URL('../package.json', import.meta.url));
try { require.resolve('@playwright/test'); } catch { require = createRequire(new URL('../../Day-06/package.json', import.meta.url)); }
const { chromium } = require('@playwright/test');

const svg = await readFile(new URL('../assets/icons/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'chrome' });

async function tile(size, pad = 0) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<style>html,body{margin:0;background:#120c08}div{width:${size}px;height:${size}px;display:grid;place-items:center}svg{width:${inner}px;height:${inner}px;display:block}</style><div>${svg}</div>`);
  const buf = await page.screenshot({ type: 'png' });
  await page.close();
  return buf;
}

const out = (p) => new URL('../' + p, import.meta.url);
await writeFile(out('assets/icons/apple-touch-icon.png'), await tile(180));
await writeFile(out('assets/icons/icon-192.png'), await tile(192));
await writeFile(out('assets/icons/icon-512.png'), await tile(512));
await writeFile(out('assets/icons/icon-maskable-512.png'), await tile(512, 0.14));

// favicon.ico with embedded PNG images (16, 32, 48)
const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) pngs.push(await tile(s));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e); header.writeUInt8(s, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
await writeFile(out('favicon.ico'), Buffer.concat([header, ...pngs]));

// Share image: render a taller viewport so the hero crops as it does in use, then cut 1.905:1
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1200 / 1440, reducedMotion: 'reduce' });
await page.goto('http://127.0.0.1:4409/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: fileURLToPath(new URL('../assets/og-image.jpg', import.meta.url)), type: 'jpeg', quality: 86, clip: { x: 0, y: 60, width: 1440, height: 756 } });
await browser.close();
console.log('icons + og-image written');
