/**
 * Cross-device browser suite for the built I SPY app.
 *
 * CI installs Playwright ephemerally; keeping it out of package dependencies
 * avoids shipping a browser-test runtime to players. Every profile drives the
 * production Vite preview through the real intro, menu and briefing, then
 * plays a generated mission to its debrief using the console's own controls
 * at their real responsive coordinates, and starts the mission after it.
 *
 * Environment overrides (for sandboxes that cannot fetch a full browser set):
 *   ISPY_E2E_URL             base URL (default http://127.0.0.1:4173/)
 *   ISPY_E2E_ONLY            comma-separated profile names to run
 *   ISPY_E2E_CHROMIUM_PATH   executablePath for the Chromium profiles
 */
import crypto from 'node:crypto';
import { chromium, webkit } from 'playwright';

const BASE_URL = process.env.ISPY_E2E_URL ?? 'http://127.0.0.1:4173/';
const SETTINGS_KEY = 'i-spy-settings-v1';
const RECORD_KEY = 'i-spy-analyst-record-v2';
const CHROMIUM_ARGS = ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const ALL_PROFILES = [
  {
    name: 'desktop-chromium',
    engine: chromium,
    launchOptions: { args: CHROMIUM_ARGS },
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
    launchOptions: { args: CHROMIUM_ARGS },
    viewport: { width: 1024, height: 768 },
    rotateTo: { width: 768, height: 1024 },
    isMobile: false,
    hasTouch: true,
    deviceScaleFactor: 2,
    mode: 'CHANGE',
    map: 'border-farms',
    // Wide enough for SPLIT VIEW, and its rotation is narrow enough to force
    // the console back out of it mid-mission.
    splitView: true,
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
    launchOptions: { args: CHROMIUM_ARGS },
    viewport: { width: 412, height: 915 },
    rotateTo: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2.625,
    mode: 'LOCATE',
    map: 'dustline-sector',
  },
  {
    // The narrow end of the Android range, still common, and the width at
    // which the console and the recon rails have the least room to work in.
    name: 'small-android-chromium',
    engine: chromium,
    launchOptions: { args: CHROMIUM_ARGS },
    viewport: { width: 360, height: 640 },
    rotateTo: { width: 640, height: 360 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    mode: 'COUNT',
    map: 'riverworks-sector',
  },
];

const only = (process.env.ISPY_E2E_ONLY ?? '').split(',').map((name) => name.trim()).filter(Boolean);
const PROFILES = only.length ? ALL_PROFILES.filter((profile) => only.includes(profile.name)) : ALL_PROFILES;

/* ------------------------------------------------------------------ *
 * In-page helpers.
 *
 * These run inside the browser against the ?qa=1 handle on the running
 * Phaser game. Everything they return is plain data, and everything they
 * locate is a control the player has: no scene method is called directly,
 * so a regression in layout or hit areas fails the suite instead of being
 * stepped over.
 * ------------------------------------------------------------------ */
const PAGE_HELPERS = () => {
  const game = () => window.__ISPY_QA__;

  const flatten = (list, out = []) => {
    list.forEach((object) => {
      out.push(object);
      if (Array.isArray(object.list)) flatten(object.list, out);
    });
    return out;
  };

  /** Screen point for a world coordinate, exact for Phaser's unrotated cameras. */
  const worldToScreen = (camera, x, y) => {
    const view = camera.worldView;
    return {
      x: camera.x + ((x - view.x) / view.width) * camera.width,
      y: camera.y + ((y - view.y) / view.height) * camera.height,
    };
  };

  window.__qa = {
    activeScenes() {
      return game().scene.getScenes(true).map((scene) => scene.scene.key);
    },
    /**
     * Centre of a console control, found the way a player finds it: by the
     * label printed on it. The returned point is the button's own rectangle,
     * so a control drawn off-screen or behind the rail is reported where it
     * actually is and the tap that follows genuinely misses.
     */
    control(sceneKey, label) {
      const scene = game().scene.getScene(sceneKey);
      if (!scene) return null;
      const objects = flatten(scene.children.list);
      const text = objects.find((object) => object.type === 'Text'
        && object.visible
        && String(object.text ?? '').trim().toUpperCase() === label.toUpperCase());
      if (!text) return null;
      const textPoint = text.getCenter ? text.getCenter() : { x: text.x, y: text.y };
      // The label's own button is the nearest interactive rectangle whose
      // bounds contain the label.
      const rectangles = objects.filter((object) => object.type === 'Rectangle'
        && object.visible && object.input && object.input.enabled);
      let best = null;
      rectangles.forEach((rectangle) => {
        const bounds = rectangle.getBounds();
        if (textPoint.x < bounds.left || textPoint.x > bounds.right) return;
        if (textPoint.y < bounds.top || textPoint.y > bounds.bottom) return;
        const area = bounds.width * bounds.height;
        if (!best || area < best.area) best = { area, x: bounds.centerX, y: bounds.centerY };
      });
      const point = best ?? { x: textPoint.x, y: textPoint.y };
      return { x: Math.round(point.x), y: Math.round(point.y) };
    },
    missionSummary() {
      const scene = game().scene.getScene('Recon');
      if (!scene || !scene.mission) return null;
      return {
        mode: scene.mission.mode,
        mapId: scene.mission.mapId,
        targetId: scene.mission.targetId ?? null,
        expectedCount: scene.mission.expectedCount ?? null,
        answerValue: scene.answerValue ?? null,
        remainingSeconds: scene.remainingSeconds ?? null,
        falseIdentifications: scene.falseIdentifications ?? 0,
        incorrectSubmissions: scene.incorrectSubmissions ?? 0,
        activePass: scene.activePass ?? null,
        marking: scene.marking === true,
        hasCandidate: Boolean(scene.candidate),
        candidateHasEntity: Boolean(scene.candidate?.entity),
      };
    },
    /**
     * Which pass the analyst has to mark the change in.
     *
     * A CHANGE mission can be a vehicle that moved, one that appeared, or a
     * structure that is gone in the second pass. Only the pass where the
     * object is actually on the ground can be marked, so the answer is the
     * pass that still holds a markable copy of it — PASS B where there is
     * one, because that is the later look.
     */
    markablePass() {
      const scene = game().scene.getScene('Recon');
      if (!scene?.passEntities) return null;
      const markable = (passId) => {
        const entity = scene.passEntities[passId]
          ?.find((candidate) => candidate.id === scene.mission.targetId);
        return Boolean(entity) && entity.selectable !== false && !entity.hidden;
      };
      if (markable('B')) return 'B';
      if (markable('A')) return 'A';
      return null;
    },
    /** Where the mission's answer object sits on screen, right now. */
    targetPoint(passId) {
      const scene = game().scene.getScene('Recon');
      if (!scene || !scene.mission) return null;
      const entities = scene.passEntities
        ? scene.passEntities[passId ?? scene.activePass ?? 'A']
        : scene.entities;
      const entity = entities?.find((candidate) => candidate.id === scene.mission.targetId);
      if (!entity) return null;
      const camera = (passId === 'B' && scene.splitView && scene.compareCamera)
        ? scene.compareCamera
        : scene.cameras.main;
      const world = { x: entity.x + entity.width / 2, y: entity.y + entity.height / 2 };
      return { world, screen: worldToScreen(camera, world.x, world.y) };
    },
    /** Every visible console control on the menu, with its own rectangle. */
    menuControls() {
      const scene = game().scene.getScene('MainMenu');
      if (!scene) return [];
      return (scene.buttons ?? []).filter((button) => button.isVisible()).map((button) => {
        const bounds = button.background.getBounds();
        return {
          label: button.text.text,
          left: Math.round(bounds.left), top: Math.round(bounds.top),
          right: Math.round(bounds.right), bottom: Math.round(bounds.bottom),
        };
      });
    },
    /** Every visible recon control, with its own rectangle. */
    reconControls() {
      const scene = game().scene.getScene('Recon');
      if (!scene) return [];
      const all = [
        ...(scene.commonButtons ?? []), ...(scene.locateButtons ?? []),
        ...(scene.countButtons ?? []), ...(scene.changeButtons ?? []),
      ];
      return all.filter((button) => button.isVisible()).map((button) => {
        const bounds = button.background.getBounds();
        return {
          label: button.text.text,
          left: Math.round(bounds.left), top: Math.round(bounds.top),
          right: Math.round(bounds.right), bottom: Math.round(bounds.bottom),
        };
      });
    },
    reconChrome() {
      const scene = game().scene.getScene('Recon');
      if (!scene) return null;
      const size = scene.scale.gameSize;
      return {
        width: size.width,
        height: size.height,
        railHeight: scene.railHeight(size.width),
        splitView: scene.splitView === true,
        paused: scene.paused === true,
        missionEnded: scene.missionEnded === true,
      };
    },
    resultsSummary() {
      const scene = game().scene.getScene('Results');
      if (!scene || !scene.debrief) return null;
      return {
        success: scene.debrief.success === true,
        totalScore: scene.debrief.score?.totalScore ?? null,
        grade: scene.debrief.performance?.grade ?? null,
      };
    },
    /** Every DOM overlay the app owns, so a leaked node is visible to the suite. */
    domOverlays() {
      return [...document.getElementById('app').children].map((node) => node.tagName.toLowerCase());
    },
  };
};

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

function hash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function canvasHash(page) {
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible', timeout: 15_000 });
  return hash(await canvas.screenshot());
}

async function waitForScene(page, key, label, timeout = 12_000) {
  try {
    await page.waitForFunction(
      (sceneKey) => window.__qa?.activeScenes().includes(sceneKey),
      key,
      { timeout, polling: 100 },
    );
  } catch (error) {
    const state = await page.evaluate(() => ({
      active: window.__qa?.activeScenes() ?? null,
      overlays: window.__qa?.domOverlays() ?? null,
    })).catch(() => null);
    throw new Error(`${label}: scene '${key}' never became active // ${JSON.stringify(state)} // ${error.message}`);
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
        left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
        width: rect.width, height: rect.height,
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

/**
 * Controls have to be where a finger can reach them, and only one of them
 * can be under any given point. Both have failed on small phones: SETTINGS
 * was composed off the bottom of a 320px console, and the compact recon
 * rails drew RESET VIEW on top of MARK TARGET.
 */
async function assertControlsReachable(page, reader, label) {
  const size = page.viewportSize();
  const controls = await page.evaluate((name) => window.__qa[name](), reader);
  if (!controls.length) throw new Error(`${label}: no controls found to check`);

  controls.forEach((control) => {
    if (control.left < -2 || control.top < -2
        || control.right > size.width + 2 || control.bottom > size.height + 2) {
      throw new Error(`${label}: control '${control.label}' is outside the ${size.width}x${size.height} viewport // ${JSON.stringify(control)}`);
    }
  });

  for (let i = 0; i < controls.length; i += 1) {
    for (let j = i + 1; j < controls.length; j += 1) {
      const a = controls[i];
      const b = controls[j];
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 2 && overlapY > 2) {
        throw new Error(`${label}: controls '${a.label}' and '${b.label}' overlap by ${overlapX}x${overlapY} // ${JSON.stringify([a, b])}`);
      }
    }
  }
  return controls.length;
}

/** A tap where the device has a finger, a click where it has a pointer. */
async function tap(page, profile, point) {
  if (profile.hasTouch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(90);
}

async function tapControl(page, profile, sceneKey, label, context) {
  const point = await page.evaluate(
    ([key, name]) => window.__qa.control(key, name),
    [sceneKey, label],
  );
  if (!point) throw new Error(`${context}: control '${label}' not found in scene '${sceneKey}'`);
  const size = page.viewportSize();
  if (point.x < 0 || point.y < 0 || point.x > size.width || point.y > size.height) {
    throw new Error(`${context}: control '${label}' is outside the viewport at ${JSON.stringify(point)} (${size.width}x${size.height})`);
  }
  await tap(page, profile, point);
  return point;
}

/** Drag the imagery. Exercises the real pan path rather than moving a camera. */
async function dragBy(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Several moves: one jump is indistinguishable from a teleport and does not
  // exercise the incremental scroll maths the scene actually runs.
  const steps = 6;
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(from.x + (dx * step) / steps, from.y + (dy * step) / steps);
  }
  await page.mouse.up();
  await page.waitForTimeout(80);
}

/**
 * Bring the mission's answer object into the workspace band — clear of the
 * HUD strip and of the mode's bottom control rail — so the tap that follows
 * is a tap a player could make.
 */
async function centreOnTarget(page, profile, passId, context) {
  const chrome = await page.evaluate(() => window.__qa.reconChrome());
  const safeTop = 78 + 26;
  const safeBottom = chrome.height - chrome.railHeight - 26;
  // In split view each pass has its own pane, and the mark has to land in
  // the pane that shows it.
  const paneLeft = chrome.splitView && passId === 'B' ? Math.floor(chrome.width / 2) : 0;
  const paneRight = chrome.splitView && passId !== 'B' ? Math.floor(chrome.width / 2) : chrome.width;
  const centre = { x: (paneLeft + paneRight) / 2, y: (safeTop + safeBottom) / 2 };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const target = await page.evaluate((id) => window.__qa.targetPoint(id), passId ?? null);
    if (!target) throw new Error(`${context}: mission target entity is not on the map`);
    const inside = target.screen.x > paneLeft + 24 && target.screen.x < paneRight - 24
      && target.screen.y > safeTop && target.screen.y < safeBottom;
    if (inside) return target;
    const dx = centre.x - target.screen.x;
    const dy = centre.y - target.screen.y;
    // Pan in bounded steps: the camera is clamped to the imagery, and a step
    // larger than the viewport would simply be eaten by that clamp.
    const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
    const paneWidth = paneRight - paneLeft;
    await dragBy(page, centre, clamp(dx, paneWidth * 0.35), clamp(dy, chrome.height * 0.3));
  }
  const final = await page.evaluate((id) => window.__qa.targetPoint(id), passId ?? null);
  throw new Error(`${context}: could not bring the target into the workspace // ${JSON.stringify(final)} // ${JSON.stringify(chrome)}`);
}

async function playLocateOrChange(page, profile, context) {
  const summary = await page.evaluate(() => window.__qa.missionSummary());
  const isChange = summary.mode === 'CHANGE';
  const markLabel = isChange ? 'MARK CHANGE' : 'MARK TARGET';
  let passId = null;

  if (isChange) {
    passId = await page.evaluate(() => window.__qa.markablePass());
    if (!passId) throw new Error(`${context}: neither pass holds a markable changed object`);
    const chrome = await page.evaluate(() => window.__qa.reconChrome());
    // In split view both passes are on screen at once, so there is nothing
    // to switch: each pane is its own pass.
    if (!chrome.splitView) {
      await tapControl(page, profile, 'Recon', `PASS ${passId}`, context);
      const afterSwitch = await page.evaluate(() => window.__qa.missionSummary());
      if (afterSwitch.activePass !== passId) {
        throw new Error(`${context}: PASS ${passId} did not become the active pass`);
      }
    }
  }

  await tapControl(page, profile, 'Recon', markLabel, context);
  const armed = await page.evaluate(() => window.__qa.missionSummary());
  if (!armed.marking) throw new Error(`${context}: marking did not arm after '${markLabel}'`);

  const target = await centreOnTarget(page, profile, passId, context);
  await tap(page, profile, { x: Math.round(target.screen.x), y: Math.round(target.screen.y) });

  const marked = await page.evaluate(() => window.__qa.missionSummary());
  if (!marked.hasCandidate) throw new Error(`${context}: tapping the target placed no mark`);
  if (!marked.candidateHasEntity) {
    throw new Error(`${context}: the mark resolved to no object // ${JSON.stringify({ target, marked })}`);
  }

  await tapControl(page, profile, 'Recon', 'CONFIRM', context);
}

async function playCount(page, profile, context) {
  const summary = await page.evaluate(() => window.__qa.missionSummary());
  const expected = summary.expectedCount;
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error(`${context}: COUNT mission has no usable expected count (${expected})`);
  }
  for (let press = 0; press < expected; press += 1) {
    await tapControl(page, profile, 'Recon', '+', context);
  }
  const tallied = await page.evaluate(() => window.__qa.missionSummary());
  if (tallied.answerValue !== expected) {
    throw new Error(`${context}: tally reads ${tallied.answerValue} after ${expected} presses`);
  }
  await tapControl(page, profile, 'Recon', 'SUBMIT COUNT', context);
}

async function runProfile(profile) {
  const executablePath = process.env.ISPY_E2E_CHROMIUM_PATH;
  const launchOptions = { headless: true, ...(profile.launchOptions ?? {}) };
  if (executablePath && profile.engine === chromium) launchOptions.executablePath = executablePath;

  const browser = await profile.engine.launch(launchOptions);
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
    badResponses.push(`${response.status()} ${response.request().resourceType()} ${url.pathname}`);
  });

  await page.addInitScript(({ settingsKey, recordKey }) => {
    localStorage.setItem(settingsKey, JSON.stringify({
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
    localStorage.removeItem(recordKey);
  }, { settingsKey: SETTINGS_KEY, recordKey: RECORD_KEY });
  await page.addInitScript(PAGE_HELPERS);

  const url = new URL(BASE_URL);
  url.searchParams.set('qa', '1');
  url.searchParams.set('seed', `QA-CROSS-DEVICE-${profile.name}`);
  url.searchParams.set('mode', profile.mode);
  url.searchParams.set('map', profile.map);

  try {
    const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (!response?.ok()) throw new Error(`initial document failed: ${response?.status()}`);

    /* --- Start gate ------------------------------------------------- */
    const startButton = page.locator('.intro-start__button');
    try {
      await startButton.waitFor({ state: 'visible', timeout: 15_000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => {
        const notice = document.getElementById('boot-notice');
        return {
          canvas: Boolean(document.querySelector('canvas')),
          bootNoticeDisplay: notice ? getComputedStyle(notice).display : null,
          bootDetail: document.getElementById('boot-detail')?.textContent ?? null,
          overlays: window.__qa?.domOverlays() ?? null,
          scenes: window.__qa?.activeScenes() ?? null,
        };
      }).catch(() => ({ evaluationFailed: true }));
      throw new Error(`start gate never appeared // ${JSON.stringify(diagnostic)} // ${errors.join(' | ')} // ${error.message}`);
    }

    // The gate must survive an intro the device cannot decode: it is the one
    // user gesture that unlocks audio for the session.
    if (profile.hasTouch) await startButton.tap();
    else await startButton.click();

    /* --- Menu ------------------------------------------------------- */
    await waitForScene(page, 'MainMenu', `${profile.name}/menu`, 20_000);
    await page.waitForTimeout(250);
    await page.waitForFunction(() => (window.__qa.domOverlays() ?? []).every((tag) => tag !== 'section'), null, { timeout: 5_000 });
    await assertViewport(page, profile.viewport, `${profile.name}/menu`);
    await assertControlsReachable(page, 'menuControls', `${profile.name}/menu`);
    const menuHash = await canvasHash(page);

    await tapControl(page, profile, 'MainMenu', 'RANDOM MISSION', `${profile.name}/menu`);

    /* --- Briefing --------------------------------------------------- */
    await waitForScene(page, 'MissionBriefing', `${profile.name}/briefing`);
    await page.waitForTimeout(250);
    await assertViewport(page, profile.viewport, `${profile.name}/briefing`);
    const briefingHash = await canvasHash(page);
    if (briefingHash === menuHash) throw new Error('menu did not transition to mission briefing');

    await tapControl(page, profile, 'MissionBriefing', 'ACQUIRE IMAGERY', `${profile.name}/briefing`);

    /* --- Recon ------------------------------------------------------ */
    await waitForScene(page, 'Recon', `${profile.name}/recon`);
    await page.waitForTimeout(400);
    await assertViewport(page, profile.viewport, `${profile.name}/recon`);

    await assertControlsReachable(page, 'reconControls', `${profile.name}/recon`);

    const mission = await page.evaluate(() => window.__qa.missionSummary());
    if (!mission) throw new Error(`${profile.name}/recon: no mission on the recon scene`);
    if (mission.mode !== profile.mode) {
      throw new Error(`${profile.name}/recon: expected ${profile.mode}, got ${mission.mode}`);
    }
    if (mission.mapId !== profile.map) {
      throw new Error(`${profile.name}/recon: expected sector ${profile.map}, got ${mission.mapId}`);
    }

    // Pause/resume before playing: the timer, the rail and the weather layer
    // all have to survive a hold in the middle of a live mission.
    await tapControl(page, profile, 'Recon', 'PAUSE', `${profile.name}/recon`);
    const held = await page.evaluate(() => window.__qa.reconChrome());
    if (!held.paused) throw new Error(`${profile.name}/recon: PAUSE did not hold the mission`);
    await tapControl(page, profile, 'Recon', 'RESUME', `${profile.name}/recon`);
    const resumed = await page.evaluate(() => window.__qa.reconChrome());
    if (resumed.paused) throw new Error(`${profile.name}/recon: RESUME did not release the hold`);

    // Rotate while the mission is live. This hits the layout, camera, rail,
    // weather and safe-area resize paths under actual rendering.
    await page.setViewportSize(profile.rotateTo);
    await page.waitForTimeout(250);
    await assertViewport(page, profile.rotateTo, `${profile.name}/rotated-recon`);
    await assertControlsReachable(page, 'reconControls', `${profile.name}/rotated-recon`);
    await page.setViewportSize(profile.viewport);
    await page.waitForTimeout(250);
    await assertViewport(page, profile.viewport, `${profile.name}/restored-recon`);

    /* --- Split view -------------------------------------------------- *
     * Two passes side by side, dropped automatically when the console is
     * too narrow to hold them, and picked up again when it is not. A
     * mission finished in split view used to throw during teardown and
     * leave the game with no active scene at all.                        */
    const context$ = `${profile.name}/${profile.mode}`;
    if (profile.splitView) {
      await tapControl(page, profile, 'Recon', 'SPLIT VIEW', `${profile.name}/split`);
      let chrome = await page.evaluate(() => window.__qa.reconChrome());
      if (!chrome.splitView) throw new Error(`${context$}: SPLIT VIEW did not engage`);
      await assertControlsReachable(page, 'reconControls', `${profile.name}/split`);

      // Rotating into a console too narrow for two panes has to drop back
      // to one, in the middle of a live mission, without stranding a mark.
      await page.setViewportSize(profile.rotateTo);
      await page.waitForTimeout(300);
      chrome = await page.evaluate(() => window.__qa.reconChrome());
      if (chrome.splitView && profile.rotateTo.width < 980) {
        throw new Error(`${context$}: split view survived a resize below its minimum width`);
      }
      await assertControlsReachable(page, 'reconControls', `${profile.name}/split-narrowed`);
      await page.setViewportSize(profile.viewport);
      await page.waitForTimeout(300);

      await tapControl(page, profile, 'Recon', 'SPLIT VIEW', `${profile.name}/split-again`);
      chrome = await page.evaluate(() => window.__qa.reconChrome());
      if (!chrome.splitView) throw new Error(`${context$}: split view could not be re-entered`);
    }

    if (profile.mode === 'COUNT') await playCount(page, profile, context$);
    else await playLocateOrChange(page, profile, context$);

    /* --- Debrief ---------------------------------------------------- */
    await waitForScene(page, 'Results', `${profile.name}/results`);
    await page.waitForTimeout(350);
    await assertViewport(page, profile.viewport, `${profile.name}/results`);
    const results = await page.evaluate(() => window.__qa.resultsSummary());
    if (!results?.success) {
      throw new Error(`${context$}: mission did not resolve as a success // ${JSON.stringify(results)}`);
    }
    if (!(results.totalScore > 0)) {
      throw new Error(`${context$}: successful mission scored ${results.totalScore}`);
    }

    /* --- Second mission --------------------------------------------- *
     * A completed debrief has to hand the analyst a fresh, playable task.
     * Repeat-mission regressions have reached players from here before.     */
    await tapControl(page, profile, 'Results', 'NEXT MISSION', `${profile.name}/results`);
    await waitForScene(page, 'MissionBriefing', `${profile.name}/briefing-2`);
    await page.waitForTimeout(250);
    await tapControl(page, profile, 'MissionBriefing', 'ACQUIRE IMAGERY', `${profile.name}/briefing-2`);
    await waitForScene(page, 'Recon', `${profile.name}/recon-2`);
    await page.waitForTimeout(400);
    const second = await page.evaluate(() => window.__qa.missionSummary());
    if (!second) throw new Error(`${profile.name}/recon-2: second mission never built`);
    if (second.mode !== profile.mode) {
      throw new Error(`${profile.name}/recon-2: expected ${profile.mode}, got ${second.mode}`);
    }
    const chrome2 = await page.evaluate(() => window.__qa.reconChrome());
    if (chrome2.missionEnded) throw new Error(`${profile.name}/recon-2: second mission started already ended`);
    if (second.falseIdentifications !== 0 || second.incorrectSubmissions !== 0) {
      throw new Error(`${profile.name}/recon-2: error counters carried over // ${JSON.stringify(second)}`);
    }
    if (second.hasCandidate || second.marking) {
      throw new Error(`${profile.name}/recon-2: marking state carried over // ${JSON.stringify(second)}`);
    }
    await assertViewport(page, profile.viewport, `${profile.name}/recon-2`);

    // The second mission must accept input. A stuck resolving guard made
    // CONFIRM a permanent no-op here once; arming marking proves the path.
    if (profile.mode !== 'COUNT') {
      await tapControl(page, profile, 'Recon', profile.mode === 'CHANGE' ? 'MARK CHANGE' : 'MARK TARGET', `${profile.name}/recon-2`);
      const armed2 = await page.evaluate(() => window.__qa.missionSummary());
      if (!armed2.marking) throw new Error(`${profile.name}/recon-2: controls are dead on the second mission`);
    } else {
      await tapControl(page, profile, 'Recon', '+', `${profile.name}/recon-2`);
      const tally2 = await page.evaluate(() => window.__qa.missionSummary());
      if (tally2.answerValue !== 1) throw new Error(`${profile.name}/recon-2: tally is dead on the second mission`);
    }

    /* --- No leaked DOM ---------------------------------------------- */
    const overlays = await page.evaluate(() => window.__qa.domOverlays());
    if (overlays.filter((tag) => tag === 'canvas').length !== 1) {
      throw new Error(`${profile.name}: expected exactly one canvas, saw ${JSON.stringify(overlays)}`);
    }
    if (overlays.some((tag) => tag === 'section')) {
      throw new Error(`${profile.name}: the intro overlay leaked into gameplay // ${JSON.stringify(overlays)}`);
    }

    if (badResponses.length) throw new Error(`HTTP failures: ${badResponses.join(' | ')}`);
    if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);

    console.log(`PASS ${profile.name}: ${profile.mode} / ${profile.map} played to debrief (score ${results.totalScore}, grade ${results.grade})`);
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

console.log(`I SPY cross-device browser QA passed: ${PROFILES.length} device profiles played to debrief.`);
