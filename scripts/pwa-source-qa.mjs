import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const errors = [];
const checks = [];
const check = (condition, message) => condition ? checks.push(message) : errors.push(message);

const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const index = read('index.html');
const main = read('src/main.js');
const registration = read('src/pwa/registerServiceWorker.js');
const builder = read('scripts/build-pwa.mjs');

check(index.includes('rel="manifest"') && index.includes('./manifest.webmanifest'), 'index links relative web app manifest');
check(index.includes('apple-mobile-web-app-capable') && index.includes('apple-touch-icon'), 'iPhone install metadata is present');
check(manifest.display === 'standalone', 'manifest launches standalone');
check(manifest.start_url === './' && manifest.scope === './' && manifest.id === './', 'manifest is GitHub-Pages-subpath safe');
check(manifest.orientation === 'any', 'installed app supports both orientations');
check(Array.isArray(manifest.icons) && manifest.icons.some((icon) => icon.sizes === '192x192')
  && manifest.icons.some((icon) => icon.sizes === '512x512'), 'manifest includes install-sized icons');
check(main.includes('registerOfflineSupport') && main.includes('registerOfflineSupport();'), 'main registers offline support');
check(registration.includes('navigator.serviceWorker.register') && registration.includes("updateViaCache: 'none'"), 'service worker registration bypasses stale HTTP cache');
check(registration.includes('window.isSecureContext'), 'service worker only registers in a secure context');
check(pkg.scripts.build.includes('scripts/build-pwa.mjs') && pkg.scripts.build.includes('scripts/validate-pwa-build.mjs'), 'production build generates and validates the offline worker');
check(pkg.scripts.validate.includes('scripts/pwa-source-qa.mjs'), 'normal release validation includes PWA source checks');
check(builder.includes('cache.addAll') && builder.includes('PRECACHE_PATHS'), 'worker precaches the production build');
check(builder.includes('Content-Range') && builder.includes('status: 206'), 'worker supports cached audio/video range requests');
check(builder.includes("request.mode === 'navigate'"), 'worker provides an offline navigation fallback');

const expectedIcons = [
  ['public/icons/ispy-180.png', 180, 180],
  ['public/icons/ispy-192.png', 192, 192],
  ['public/icons/ispy-512.png', 512, 512],
];
for (const [relative, expectedWidth, expectedHeight] of expectedIcons) {
  const absolute = path.join(root, relative);
  check(fs.existsSync(absolute), `PWA icon exists: ${relative}`);
  if (!fs.existsSync(absolute)) continue;
  const data = fs.readFileSync(absolute);
  const png = data.length >= 24 && data.subarray(1, 4).toString('ascii') === 'PNG';
  check(png, `PWA icon is PNG: ${relative}`);
  if (png) {
    check(data.readUInt32BE(16) === expectedWidth && data.readUInt32BE(20) === expectedHeight,
      `PWA icon dimensions are ${expectedWidth}x${expectedHeight}: ${relative}`);
  }
}

if (errors.length) {
  console.error(`I SPY PWA source QA failed (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`I SPY PWA source QA passed: ${checks.length} checks.`);
