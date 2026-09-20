import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.ISPY_E2E_URL ?? 'http://127.0.0.1:4173/';
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ispy-pwa-'));
const launchOptions = {
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader'],
  viewport: { width: 412, height: 915 },
};

async function waitForScene(page, key, timeout = 12_000) {
  await page.waitForFunction(
    (sceneKey) => window.__ISPY_QA__?.activeScenes?.().includes(sceneKey),
    key,
    { timeout },
  );
}

async function prepareOnlineInstall() {
  const context = await chromium.launchPersistentContext(profileDir, launchOptions);
  const page = context.pages()[0] ?? await context.newPage();
  const url = new URL(BASE_URL);
  url.searchParams.set('qa', '1');
  url.searchParams.set('seed', 'PWA-WARM-INSTALL');
  url.searchParams.set('mode', 'LOCATE');
  url.searchParams.set('map', 'woodland-corridor-7');

  try {
    const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (!response?.ok()) throw new Error(`online warm-up failed: ${response?.status()}`);
    await page.locator('canvas').waitFor({ state: 'visible', timeout: 15_000 });

    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    }, null, { timeout: 15_000 });

    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15_000 });

    const state = await page.evaluate(async () => {
      const names = await caches.keys();
      const counts = {};
      for (const name of names) {
        const cache = await caches.open(name);
        counts[name] = (await cache.keys()).length;
      }
      return {
        controller: navigator.serviceWorker.controller?.scriptURL ?? null,
        names,
        counts,
        manifestHref: document.querySelector('link[rel="manifest"]')?.href ?? null,
      };
    });

    const offlineCache = state.names.find((name) => name.startsWith('ispy-offline-'));
    if (!offlineCache) throw new Error(`offline cache missing: ${JSON.stringify(state)}`);
    if ((state.counts[offlineCache] ?? 0) < 8) throw new Error(`offline cache unexpectedly small: ${JSON.stringify(state)}`);
    if (!state.manifestHref?.endsWith('/manifest.webmanifest')) throw new Error('manifest link not resolved');

    console.log(`WARM install: ${offlineCache} with ${state.counts[offlineCache]} cached responses`);
  } finally {
    await context.close();
  }
}

async function proveColdOfflineLaunch() {
  const context = await chromium.launchPersistentContext(profileDir, launchOptions);
  await context.setOffline(true);
  const page = context.pages()[0] ?? await context.newPage();
  const errors = [];
  const failed = [];

  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    const base = new URL(BASE_URL);
    if (url.origin === base.origin) failed.push(`${request.resourceType()} ${url.pathname}: ${request.failure()?.errorText}`);
  });

  const url = new URL(BASE_URL);
  url.searchParams.set('qa', '1');
  url.searchParams.set('seed', 'PWA-COLD-OFFLINE');
  url.searchParams.set('mode', 'LOCATE');
  url.searchParams.set('map', 'woodland-corridor-7');

  try {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.locator('canvas').waitFor({ state: 'visible', timeout: 15_000 });

    if (await page.evaluate(() => navigator.onLine)) {
      throw new Error('browser did not enter offline mode');
    }

    await waitForScene(page, 'StartIntro');
    await page.evaluate(() => window.__ISPY_QA__?.finishIntro?.());
    await waitForScene(page, 'MainMenu');

    const mediaRange = await page.evaluate(async () => {
      const names = await caches.keys();
      const offlineName = names.find((name) => name.startsWith('ispy-offline-'));
      const cache = offlineName ? await caches.open(offlineName) : null;
      const requests = cache ? await cache.keys() : [];
      const media = requests.find((request) => /\.mp3(?:$|\?)/i.test(request.url));
      if (!media) return { found: false };
      const response = await fetch(media.url, { headers: { Range: 'bytes=0-1023' } });
      return {
        found: true,
        status: response.status,
        bytes: (await response.arrayBuffer()).byteLength,
        contentRange: response.headers.get('content-range'),
      };
    });
    if (!mediaRange.found || mediaRange.status !== 206 || mediaRange.bytes !== 1024 || !mediaRange.contentRange) {
      throw new Error(`offline media range failed: ${JSON.stringify(mediaRange)}`);
    }

    const randomPoint = await page.evaluate(() => window.__ISPY_QA__?.buttonCenter('MainMenu', 'randomCard'));
    if (!randomPoint) throw new Error('offline RANDOM MISSION control unavailable');
    await page.mouse.click(randomPoint.x, randomPoint.y);
    await waitForScene(page, 'MissionBriefing');

    const beginPoint = await page.evaluate(() => window.__ISPY_QA__?.buttonCenter('MissionBriefing', 'begin'));
    if (!beginPoint) throw new Error('offline ACQUIRE IMAGERY control unavailable');
    await page.mouse.click(beginPoint.x, beginPoint.y);
    await waitForScene(page, 'Recon');

    if (errors.length) throw new Error(`offline browser errors: ${errors.join(' | ')}`);
    if (failed.length) throw new Error(`offline same-origin requests escaped cache: ${failed.join(' | ')}`);

    console.log('PASS cold offline restart: service worker -> menu -> briefing -> Recon');
    console.log(`PASS cached media range: ${mediaRange.contentRange}`);
  } finally {
    await context.close();
  }
}

try {
  await prepareOnlineInstall();
  await proveColdOfflineLaunch();
  console.log('I SPY offline PWA QA passed.');
} finally {
  fs.rmSync(profileDir, { recursive: true, force: true });
}
