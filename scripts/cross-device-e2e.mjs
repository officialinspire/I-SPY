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
    webkitDomIntroClick: true,
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

async function waitForScene(page, sceneKey, errors, timeout = 8_000) {
  try {
    await page.waitForFunction(
      (key) => window.__ISPY_QA__?.activeScenes().includes(key),
      sceneKey,
      { timeout },
    );
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      activeScenes: window.__ISPY_QA__?.activeScenes?.() ?? null,
      introPresent: Boolean(document.querySelector('.intro-gate')),
      canvas: Boolean(document.querySelector('canvas')),
    })).catch(() => ({ evaluationFailed: true }));
    throw new Error(`scene '${sceneKey}' not active // ${JSON.stringify(diagnostic)} // ${errors.join(' | ')} // ${error.message}`);
  }
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

async function exerciseAndroidReconGestures(page, context) {
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({
      x: point.x,
      y: point.y,
      id: point.id,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    })),
  });
  const state = () => page.evaluate(() => window.__ISPY_QA__?.reconState?.());
  const maxStep = (before, after, label) => {
    const zoomDelta = Math.abs(after.zoom - before.zoom);
    const scrollDelta = Math.hypot(after.scrollX - before.scrollX, after.scrollY - before.scrollY);
    if (zoomDelta > 0.22 || scrollDelta > 170) {
      throw new Error(`${label} jumped: ${JSON.stringify({ zoomDelta, scrollDelta, before, after })}`);
    }
  };

  const initial = await state();
  if (!initial) throw new Error('Android gesture QA could not read Recon state');

  // Multi-step one-finger pan instead of one synthetic teleport.
  let finger = { id: 1, x: 206, y: 420 };
  await touch('touchStart', [finger]);
  let previous = initial;
  for (const [dx, dy] of [[12, 8], [13, 10], [11, 9], [14, 12]]) {
    finger = { ...finger, x: finger.x + dx, y: finger.y + dy };
    await touch('touchMove', [finger]);
    await page.waitForTimeout(18);
    const next = await state();
    maxStep(previous, next, 'one-finger pan');
    previous = next;
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(80);
  const panned = await state();
  const panDistance = Math.hypot(panned.scrollX - initial.scrollX, panned.scrollY - initial.scrollY);
  if (panDistance < 20) throw new Error(`one-finger pan did not move the camera: ${JSON.stringify({ initial, panned })}`);

  const markPoint = await page.evaluate(() => window.__ISPY_QA__?.buttonCenter('Recon', 'markButton'));
  if (!markPoint) throw new Error('MARK TARGET control unavailable for Android gesture QA');
  await page.touchscreen.tap(markPoint.x, markPoint.y);
  await page.waitForTimeout(80);
  const armed = await state();
  if (!armed?.marking) throw new Error(`marking did not arm before pinch: ${JSON.stringify(armed)}`);

  // Real Android fingers arrive sequentially. First finger lands and moves a
  // little, then the second joins. The two contacts then update on alternating
  // events, which is where the old implementation could jump.
  let first = { id: 11, x: 158, y: 430 };
  let second = { id: 12, x: 254, y: 430 };
  await touch('touchStart', [first]);
  first = { ...first, x: 161, y: 432 };
  await touch('touchMove', [first]);
  await touch('touchStart', [first, second]);
  await page.waitForTimeout(30);

  let last = await state();
  if (!last.pinchActive || last.pinchPointerIds.length !== 2) {
    throw new Error(`pinch did not acquire exactly two touch IDs: ${JSON.stringify(last)}`);
  }

  const samples = [];
  const movePair = async (nextFirst, nextSecond, label) => {
    first = nextFirst;
    second = nextSecond;
    await touch('touchMove', [first, second]);
    await page.waitForTimeout(18);
    const next = await state();
    maxStep(last, next, label);
    if (!next.marking || next.candidate) {
      throw new Error(`${label} corrupted targeting state: ${JSON.stringify(next)}`);
    }
    if (next.pinchPointerIds.join(',') !== last.pinchPointerIds.join(',')) {
      throw new Error(`${label} changed pinch ownership: ${JSON.stringify({ before:last, after:next })}`);
    }
    samples.push(next);
    last = next;
  };

  // Pinch outward with alternating finger motion and slight midpoint drift.
  for (let i = 0; i < 6; i += 1) {
    await movePair({ ...first, x: first.x - 5, y: first.y + (i % 2) },
      second, 'pinch-out/first');
    await movePair(first,
      { ...second, x: second.x + 5, y: second.y + ((i + 1) % 2) },
      'pinch-out/second');
  }
  const zoomedOutward = last;
  if (!(zoomedOutward.zoom > armed.zoom + 0.15)) {
    throw new Error(`incremental pinch-out did not zoom in enough: ${JSON.stringify({ armed, zoomedOutward })}`);
  }

  // Two-finger pan at nearly constant separation, still delivered one contact
  // at a time. Zoom should stay stable while the map follows the midpoint.
  const beforeTwoFingerPan = last;
  for (let i = 0; i < 5; i += 1) {
    await movePair({ ...first, x: first.x + 7, y: first.y + 6 }, second, 'two-finger-pan/first');
    await movePair(first, { ...second, x: second.x + 7, y: second.y + 6 }, 'two-finger-pan/second');
  }
  const afterTwoFingerPan = last;
  const twoFingerScroll = Math.hypot(
    afterTwoFingerPan.scrollX - beforeTwoFingerPan.scrollX,
    afterTwoFingerPan.scrollY - beforeTwoFingerPan.scrollY,
  );
  if (twoFingerScroll < 20 || Math.abs(afterTwoFingerPan.zoom - beforeTwoFingerPan.zoom) > 0.18) {
    throw new Error(`two-finger pan was unstable: ${JSON.stringify({ beforeTwoFingerPan, afterTwoFingerPan })}`);
  }

  // Pinch back inward using the same alternating cadence.
  const beforeInward = last;
  for (let i = 0; i < 6; i += 1) {
    await movePair({ ...first, x: first.x + 5, y: first.y - (i % 2) },
      second, 'pinch-in/first');
    await movePair(first,
      { ...second, x: second.x - 5, y: second.y - ((i + 1) % 2) },
      'pinch-in/second');
  }
  const pinchedBack = last;
  if (!(pinchedBack.zoom < beforeInward.zoom - 0.12)) {
    throw new Error(`incremental pinch-in did not zoom back out: ${JSON.stringify({ beforeInward, pinchedBack })}`);
  }

  // End the pinch, then prove a fresh one-finger drag is immediately stable.
  await touch('touchEnd', []);
  await page.waitForTimeout(60);
  let post = await state();
  if (post.pinchActive || post.candidate) {
    throw new Error(`pinch did not release cleanly: ${JSON.stringify(post)}`);
  }

  let solo = { id: 21, x: 205, y: 445 };
  await touch('touchStart', [solo]);
  const postStart = await state();
  for (const [dx, dy] of [[9, 12], [10, 12], [8, 11], [10, 13]]) {
    solo = { ...solo, x: solo.x + dx, y: solo.y + dy };
    await touch('touchMove', [solo]);
    await page.waitForTimeout(18);
    const next = await state();
    maxStep(post, next, 'post-pinch pan');
    post = next;
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(80);
  const postPinchPan = await state();
  const secondPan = Math.hypot(postPinchPan.scrollX - postStart.scrollX, postPinchPan.scrollY - postStart.scrollY);
  if (secondPan < 15 || postPinchPan.candidate) {
    throw new Error(`post-pinch pan failed or created a mark: ${JSON.stringify({ postStart, postPinchPan })}`);
  }

  console.log(`PASS android gesture stress: pan ${Math.round(panDistance)} world, pinch ${armed.zoom.toFixed(2)}→${zoomedOutward.zoom.toFixed(2)}→${pinchedBack.zoom.toFixed(2)}, two-finger pan ${Math.round(twoFingerScroll)} world, no jumps`);
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
  url.searchParams.set('qa', '1');

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
    if (profile.webkitDomIntroClick) {
      // Headless Playwright WebKit does not reliably deliver synthesized touch
      // or click events to this DOM media gate. Bypass only the intro scene via
      // the query-only QA hook; all in-canvas iPhone interactions below still
      // use WebKit touchscreen taps against the real Phaser controls.
      await page.waitForFunction(
        () => window.__ISPY_QA__?.activeScenes().includes('StartIntro'),
        null,
        { timeout: 5_000 },
      );
      await page.evaluate(() => window.__ISPY_QA__?.finishIntro?.());
    } else if (await introStart.isVisible().catch(() => false)) {
      if (profile.hasTouch) {
        const startPoint = await page.evaluate(() => {
          const rect = document.querySelector('.intro-start__button')?.getBoundingClientRect();
          return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
        });
        if (!startPoint) throw new Error('intro start touch target unavailable');
        await page.touchscreen.tap(startPoint.x, startPoint.y);
      } else {
        await introStart.dispatchEvent('pointerdown', { pointerType: 'mouse' }).catch(() => {});
      }

      await page.waitForTimeout(80);
      const skip = page.locator('.intro-skip.is-visible');
      if (await skip.isVisible().catch(() => false)) {
        if (profile.hasTouch) {
          const skipPoint = await page.evaluate(() => {
            const rect = document.querySelector('.intro-skip.is-visible')?.getBoundingClientRect();
            return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
          });
          if (!skipPoint) throw new Error('intro skip touch target unavailable');
          await page.touchscreen.tap(skipPoint.x, skipPoint.y);
        } else {
          await skip.dispatchEvent('pointerdown', { pointerType: 'mouse' }).catch(() => {});
        }
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

    await waitForScene(page, 'MainMenu', errors);
    await page.waitForTimeout(120);
    await assertViewport(page, profile.viewport, `${profile.name}/menu`);
    const menuHash = await screenHash(page);

    // Desktop smoke-tests keyboard focus. Touch profiles ask the QA-only hook
    // for the button's actual responsive center and then send a real touch at
    // that coordinate, so portrait/landscape density tiers cannot invalidate
    // hard-coded test coordinates.
    if (profile.hasTouch) {
      const point = await page.evaluate(() => window.__ISPY_QA__?.buttonCenter('MainMenu', 'randomCard'));
      if (!point) throw new Error('RANDOM MISSION touch target unavailable');
      await page.touchscreen.tap(point.x, point.y);
    } else {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
    }
    await waitForScene(page, 'MissionBriefing', errors);
    await page.waitForTimeout(120);
    const briefingHash = await screenHash(page);
    if (briefingHash === menuHash) throw new Error('menu did not visually transition to mission briefing');

    await assertViewport(page, profile.viewport, `${profile.name}/briefing`);

    // On touch profiles, ACQUIRE IMAGERY is tapped directly on the Phaser
    // canvas at its responsive layout coordinate. Desktop uses the keyboard.
    const acquirePoint = await page.evaluate(() => window.__ISPY_QA__?.buttonCenter('MissionBriefing', 'begin'));
    if (!acquirePoint) throw new Error('ACQUIRE IMAGERY pointer target unavailable');
    if (profile.hasTouch) await page.touchscreen.tap(acquirePoint.x, acquirePoint.y);
    else await page.mouse.click(acquirePoint.x, acquirePoint.y);
    await waitForScene(page, 'Recon', errors);
    await page.waitForTimeout(120);
    const reconHash = await screenHash(page);
    if (reconHash === briefingHash) throw new Error('briefing did not visually transition to recon');

    await assertViewport(page, profile.viewport, `${profile.name}/recon`);

    if (profile.name === 'android-chromium') {
      await exerciseAndroidReconGestures(page, context);
    }

    // ESC pause/resume is a low-risk way to exercise the recon input and
    // lifecycle state machine without solving the mission in automation.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);

    // Rotate/resize while the live mission is running. This hits the layout,
    // camera, rail, weather and safe-area resize paths under actual rendering.
    await page.setViewportSize(profile.rotateTo);
    await page.waitForTimeout(420);
    await assertViewport(page, profile.rotateTo, `${profile.name}/rotated-recon`);

    await page.setViewportSize(profile.viewport);
    await page.waitForTimeout(420);
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
