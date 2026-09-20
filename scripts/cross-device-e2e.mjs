/**
 * Cross-device browser smoke suite for the built I SPY app.
 *
 * CI installs Playwright ephemerally; keeping it out of package dependencies
 * avoids shipping a browser-test runtime to players. This suite drives the
 * production Vite preview through the real intro/menu/briefing/recon flow.
 */
import crypto from 'node:crypto';
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.ISPY_E2E_URL ?? 'http://127.0.0.1:4173/';
const SETTINGS_KEY = 'i-spy-settings-v1';

const PROFILES = [
  {
    name: 'desktop-chromium',
    engine: chromium,
    launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader'] },
    viewport: { width: 1440, height: 900 },
    rotateTo: { width: 900, height: 700 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    mode: 'LOCATE',
    map: 'greywall-district',
  },
  {
    name: 'tablet-chromium',
    engine: chromium,
    launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader'] },
    viewport: { width: 1024, height: 768 },
    rotateTo: { width: 768, height: 1024 },
    isMobile: false,
    hasTouch: true,
    deviceScaleFactor: 2,
    mode: 'COUNT',
    map: 'border-farms',
  },
  {
    name: 'iphone-webkit',
    engine: webkit,
    viewport: { width: 393, height: 852 },
    rotateTo: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    mode: 'CHANGE',
    map: 'frostline-relay',
  },
  {
    name: 'android-chromium',
    engine: chromium,
    launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader'] },
    viewport: { width: 412, height: 915 },
    rotateTo: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2.625,
    mode: 'LOCATE',
    map: 'dustline-sector',
  },
];

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function screenHash(page) {
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 15_000 });
  // Screenshot the viewport rather than the canvas element. WebKit considers a
  // continuously rendered canvas "unstable" for element screenshots even when
  // its geometry is fixed, which creates a harness timeout unrelated to game
  // playability.
  return hash(await page.screenshot());
}

async function assertViewport(page, expected, label) {
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      bodyScrollWidth: document.body.scrollWidth,
      bodyScrollHeight: document.body.scrollHeight,
      docScrollWidth: document.documentElement.scrollWidth,
      docScrollHeight: document.documentElement.scrollHeight,
      canvas: rect ? {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      } : null,
    };
  });

  const fail = (message) => {
    throw new Error(`${label}: ${message} // ${JSON.stringify(metrics)}`);
  };

  if (!metrics.canvas) fail('canvas missing');
  if (Math.abs(metrics.innerWidth - expected.width) > 2) fail('unexpected viewport width');
  if (Math.abs(metrics.innerHeight - expected.height) > 2) fail('unexpected viewport height');
  if (metrics.bodyScrollWidth > metrics.innerWidth + 2 || metrics.docScrollWidth > metrics.innerWidth + 2) {
    fail('horizontal page overflow');
  }
  if (metrics.bodyScrollHeight > metrics.innerHeight + 2 || metrics.docScrollHeight > metrics.innerHeight + 2) {
    fail('vertical page overflow');
  }
  if (metrics.canvas.left < -2 || metrics.canvas.top < -2
      || metrics.canvas.right > metrics.innerWidth + 2
      || metrics.canvas.bottom > metrics.innerHeight + 2) {
    fail('canvas extends outside viewport');
  }
  if (metrics.canvas.width < Math.max(1, metrics.innerWidth - 4)
      || metrics.canvas.height < Math.max(1, metrics.innerHeight - 4)) {
    fail('canvas does not fill the safe viewport');
  }
}

async function activateAcquireImagery(page, profile) {
  if (profile.hasTouch) {
    const compact = profile.viewport.width < 600;
    const x = compact ? profile.viewport.width / 2 : profile.viewport.width / 2 - 115;
    const y = compact ? profile.viewport.height - 112 : profile.viewport.height - 48;
    await page.touchscreen.tap(x, y);
  } else {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
  }
}

async function runProfile(profile) {
  const browser = await profile.engine.launch({ headless: true, ...(profile.launchOptions ?? {}) });
  const context = await browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    deviceScaleFactor: profile.deviceScaleFactor,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  const errors = [];
  const badResponses = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    const url = new URL(response.url());
    const base = new URL(BASE_URL);
    if (url.origin !== base.origin || response.status() < 400) return;
    // Media is deliberately interrupted when the skippable intro is skipped.
    const type = response.request().resourceType();
    if (type === 'media') return;
    badResponses.push(`${response.status()} ${type} ${url.pathname}`);
  });

  await page.addInitScript(({ key }) => {
    localStorage.setItem(key, JSON.stringify({
      masterVolume: 0,
      musicEnabled: false,
      sfxEnabled: false,
      hapticsLevel: 'off',
      scanlinesEnabled: true,
      imageGrainEnabled: true,
      sector: 'any',
      tutorialCompleted: false,
      tutorialStep: 0,
      orientationSeen: true,
    }));
  }, { key: SETTINGS_KEY });

  const url = new URL(BASE_URL);
  url.searchParams.set('seed', `QA-CROSS-DEVICE-${profile.name}`);
  url.searchParams.set('mode', profile.mode);
  url.searchParams.set('map', profile.map);

  try {
    const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (!response?.ok()) throw new Error(`initial document failed: ${response?.status()}`);

    // Boot always creates the canvas first. The optional MP4 may be unsupported
    // by a browser build; StartIntro deliberately treats a media error as a
    // valid skip-to-menu route. Exercise the gesture/skip path when available,
    // but accept the documented media fallback when the gate disappears first.
    await page.locator('canvas').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(450);

    const introStart = page.locator('.intro-start__button');
    if (await introStart.isVisible().catch(() => false)) {
      await introStart.dispatchEvent('pointerdown', { pointerType: profile.hasTouch ? 'touch' : 'mouse' })
        .catch(() => {});
      await page.waitForTimeout(40);
      const skip = page.locator('.intro-skip.is-visible');
      if (await skip.isVisible().catch(() => false)) {
        await skip.dispatchEvent('pointerdown', { pointerType: profile.hasTouch ? 'touch' : 'mouse' })
          .catch(() => {});
      }
    }

    await page.waitForFunction(() => !document.querySelector('.intro-gate'), null, { timeout: 5_000 })
      .catch(async (error) => {
        const diagnostic = await page.evaluate(() => {
          const notice = document.getElementById('boot-notice');
          const detail = document.getElementById('boot-detail');
          return {
            canvas: Boolean(document.querySelector('canvas')),
            bootNoticeDisplay: notice ? getComputedStyle(notice).display : null,
            bootDetail: detail?.textContent ?? null,
            introPresent: Boolean(document.querySelector('.intro-gate')),
            readyState: document.readyState,
          };
        });
        throw new Error(`intro/menu startup did not settle // ${JSON.stringify(diagnostic)} // ${errors.join(' | ')} // ${error.message}`);
      });

    await page.waitForTimeout(250);
    await assertViewport(page, profile.viewport, `${profile.name}/menu`);
    const menuHash = await screenHash(page);

    // MainMenu focus order starts with RANDOM MISSION. This simultaneously
    // smoke-tests keyboard navigation on every form factor.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const briefingHash = await screenHash(page);
    if (briefingHash === menuHash) throw new Error('menu did not transition to mission briefing');

    await assertViewport(page, profile.viewport, `${profile.name}/briefing`);

    // On touch profiles, ACQUIRE IMAGERY is tapped directly on the Phaser
    // canvas at its responsive layout coordinate. Desktop uses the keyboard.
    await activateAcquireImagery(page, profile);
    await page.waitForTimeout(500);
    const reconHash = await screenHash(page);
    if (reconHash === briefingHash) throw new Error('briefing did not transition to recon');

    await assertViewport(page, profile.viewport, `${profile.name}/recon`);

    // ESC pause/resume is a low-risk way to exercise the recon input and
    // lifecycle state machine without solving the mission in automation.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);

    // Rotate/resize while the live mission is running. This hits the layout,
    // camera, rail, weather and safe-area resize paths under actual rendering.
    await page.setViewportSize(profile.rotateTo);
    await page.waitForTimeout(200);
    await assertViewport(page, profile.rotateTo, `${profile.name}/rotated-recon`);

    await page.setViewportSize(profile.viewport);
    await page.waitForTimeout(200);
    await assertViewport(page, profile.viewport, `${profile.name}/restored-recon`);

    if (badResponses.length) throw new Error(`HTTP failures: ${badResponses.join(' | ')}`);
    if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);

    console.log(`PASS ${profile.name}: ${profile.mode} / ${profile.map}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

const failures = [];
for (const profile of PROFILES) {
  try {
    await runProfile(profile);
  } catch (error) {
    failures.push(`${profile.name}: ${error.stack ?? error.message}`);
    console.error(`FAIL ${profile.name}: ${error.message}`);
  }
}

if (failures.length) {
  console.error(`\nI SPY cross-device browser QA FAILED (${failures.length}/${PROFILES.length})`);
  failures.forEach((failure) => console.error(`\n${failure}`));
  process.exit(1);
}

console.log(`I SPY cross-device browser QA passed: ${PROFILES.length} device profiles.`);
