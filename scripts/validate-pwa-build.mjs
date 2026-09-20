import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const fail = (message) => { throw new Error(`PWA build validation failed: ${message}`); };

const manifestPath = path.join(dist, 'manifest.webmanifest');
const workerPath = path.join(dist, 'service-worker.js');
const indexPath = path.join(dist, 'index.html');

if (!fs.existsSync(manifestPath)) fail('manifest.webmanifest missing');
if (!fs.existsSync(workerPath)) fail('service-worker.js missing');
if (!fs.existsSync(indexPath)) fail('index.html missing');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.display !== 'standalone') fail('manifest display must be standalone');
if (manifest.start_url !== './' || manifest.scope !== './') fail('manifest start_url/scope must stay relative for GitHub Pages');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) fail('manifest icons missing');

for (const icon of manifest.icons) {
  const relative = icon.src.replace(/^\.\//, '');
  if (!fs.existsSync(path.join(dist, ...relative.split('/')))) fail(`manifest icon missing: ${icon.src}`);
}

const index = fs.readFileSync(indexPath, 'utf8');
if (!index.includes('rel="manifest"') || !index.includes('manifest.webmanifest')) fail('built index does not link the manifest');
if (!index.includes('apple-touch-icon')) fail('built index does not expose an Apple touch icon');

const worker = fs.readFileSync(workerPath, 'utf8');
const listMatch = worker.match(/const PRECACHE_PATHS = (\[[\s\S]*?\]);\nconst INDEX_URL/);
if (!listMatch) fail('generated worker precache list missing');
const precache = JSON.parse(listMatch[1]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(absolute);
      return entry.isFile() ? [absolute] : [];
    });
}
const builtFiles = walk(dist)
  .filter((absolute) => path.basename(absolute) !== 'service-worker.js')
  .map((absolute) => path.relative(dist, absolute).split(path.sep).join('/'))
  .sort();
const cachedFiles = precache.map((entry) => decodeURI(entry.replace(/^\.\//, ''))).sort();

if (JSON.stringify(builtFiles) !== JSON.stringify(cachedFiles)) {
  const missing = builtFiles.filter((file) => !cachedFiles.includes(file));
  const extra = cachedFiles.filter((file) => !builtFiles.includes(file));
  fail(`precache mismatch; missing=${missing.join(',') || 'none'} extra=${extra.join(',') || 'none'}`);
}

if (!worker.includes("headers.set('Content-Range'")) fail('offline media range handling missing');
if (!worker.includes("startsWith(CACHE_PREFIX)")) fail('old PWA cache cleanup missing');
if (!cachedFiles.some((file) => file.endsWith('.mp3'))) fail('audio assets are not precached');
if (!cachedFiles.some((file) => file.endsWith('.mp4'))) fail('intro video is not precached');

const totalBytes = builtFiles.reduce((sum, relative) => sum + fs.statSync(path.join(dist, ...relative.split('/'))).size, 0);
console.log(`I SPY PWA build validation passed: ${cachedFiles.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB offline payload.`);
