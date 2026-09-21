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
 *   ISPY_E2E_STARVE_FRAMES   ms between animation frames, to rehearse a host
 *                            that starves the page (one CI runner gave
 *                            headless WebKit twenty frames in 130 seconds)
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
    splitViewGestureStress: true,
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
    launchOptions: { args: CHROMIUM_ARGS },
    viewport: { width: 412, height: 915 },
    rotateTo: { width: 915, height: 412 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2.625,
    mode: 'LOCATE',
    map: 'dustline-sector',
    androidGestureStress: true,
  },
  {
    // The commonest Android handset size, on the mode with two cameras. Too
    // narrow for SPLIT VIEW, so this is CHANGE's single-pane gesture model.
    name: 'android-change-chromium',
    engine: chromium,
    launchOptions: { args: CHROMIUM_ARGS },
    viewport: { width: 390, height: 844 },
    rotateTo: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2.75,
    mode: 'CHANGE',
    map: 'woodland-corridor-7',
    androidGestureStress: true,
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
    androidGestureStress: true,
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
  const game = () => window.__ISPY_QA__.game;

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

  /**
   * A control as two rectangles: the box it draws, and the box it actually
   * answers presses in.
   *
   * They are not the same. A control shorter than the 44px minimum touch
   * target pads its hit area out to reach it, and Phaser hit-tests that
   * padded rectangle, awarding any shared pixels to whichever control is
   * drawn last. Two controls can therefore look separated and still fight
   * over the same presses, so the drawn box answers "can a finger reach
   * this" and the hit box answers "does it get the control it aimed at".
   */
  const controlRect = (button) => {
    const bounds = button.background.getBounds();
    const area = button.background.input?.hitArea;
    const left = Math.round(bounds.left);
    const top = Math.round(bounds.top);
    const right = Math.round(bounds.right);
    const bottom = Math.round(bounds.bottom);
    const padX = area ? Math.max(0, (area.width - button.width) / 2) : 0;
    const padY = area ? Math.max(0, (area.height - button.height) / 2) : 0;
    return {
      label: button.text.text,
      left, top, right, bottom,
      hit: {
        left: Math.round(left - padX), top: Math.round(top - padY),
        right: Math.round(right + padX), bottom: Math.round(bottom + padY),
      },
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
    /**
     * The contacts this mission still wants confirmed.
     *
     * A generated LOCATE mission can ask for several, and the debrief only
     * arrives once every one of them is confirmed — so the suite has to mark
     * each in turn rather than assuming the mission has a single answer.
     */
    pendingTargetIds() {
      const scene = game().scene.getScene('Recon');
      if (!scene || !scene.mission) return [];
      const wanted = (scene.locateTargets ?? []).map((target) => target.id)
        .filter(Boolean);
      const ids = wanted.length ? wanted : [scene.mission.targetId].filter(Boolean);
      const done = new Set(scene.completedTargetIds ?? []);
      return ids.filter((id) => !done.has(id));
    },
    /** Where one of the mission's answer objects sits on screen, right now. */
    targetPoint(passId, targetId) {
      const scene = game().scene.getScene('Recon');
      if (!scene || !scene.mission) return null;
      const entities = scene.passEntities
        ? scene.passEntities[passId ?? scene.activePass ?? 'A']
        : scene.entities;
      const wanted = targetId ?? scene.mission.targetId;
      const entity = entities?.find((candidate) => candidate.id === wanted);
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
      return (scene.buttons ?? []).filter((button) => button.isVisible()).map(controlRect);
    },
    /** Every visible recon control, with its own rectangle. */
    reconControls() {
      const scene = game().scene.getScene('Recon');
      if (!scene) return [];
      const all = [
        ...(scene.commonButtons ?? []), ...(scene.locateButtons ?? []),
        ...(scene.countButtons ?? []), ...(scene.changeButtons ?? []),
      ];
      return all.filter((button) => button.isVisible()).map(controlRect);
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
    /**
     * Whether the game is still stepping.
     *
     * A throw inside a step stops Phaser's animation-frame loop for good:
     * queued scene transitions are never processed, so the symptom is a
     * scene that simply never arrives. Reporting the loop separates that
     * from a scene that is merely slow to build.
     */
    loopState() {
      const loop = game().loop;
      return {
        running: loop?.running ?? null,
        time: Math.round(loop?.time ?? 0),
        frame: loop?.frame ?? null,
        fps: Math.round(loop?.actualFps ?? 0),
        isPaused: game().isPaused ?? null,
      };
    },
    /** Every scene and the state Phaser has it in. */
    sceneStatus() {
      return game().scene.scenes.map((scene) => `${scene.scene.key}:${scene.sys.settings.status}`);
    },
  };
};

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

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

/** Frames a transition is given, whatever the wall clock says it took. */
const SCENE_FRAME_BUDGET = 45;
/**
 * How long the page may render nothing at all before it counts as dead.
 *
 * A ceiling on total elapsed time punishes a slow page for its host's frame
 * rate. What actually distinguishes a dead page from a crawling one is
 * whether any frames are still arriving, so that is what is measured.
 */
const NO_PROGRESS_CEILING_MS = 60_000;

/**
 * Waits for a scene, measured in rendered frames as well as in seconds.
 *
 * Phaser queues a scene transition and processes it from the game loop, so
 * how long one takes is a question about frames, not about seconds. A
 * headless browser can be starved of animation frames by its host — one CI
 * run rendered twenty frames in a hundred and thirty seconds — and a plain
 * wall-clock timeout then expires after about three frames and reports a
 * working transition as a broken one.
 *
 * So the wait gives up only when the page has had both its seconds and its
 * frames. A page getting frames at a normal rate is unaffected; a starved
 * one is given the frames the transition actually needs, and a dead one
 * still fails, now with the frame count that says which it was.
 */
async function waitForScene(page, key, label, timeout = 12_000, errors = []) {
  const startedAt = Date.now();
  const framesAt = async () => {
    const loop = await page.evaluate(() => window.__qa?.loopState() ?? null).catch(() => null);
    return loop?.frame ?? null;
  };
  const openingFrame = await framesAt();

  let lastFrame = openingFrame;
  let lastProgressAt = Date.now();

  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.waitForFunction(
        (sceneKey) => window.__qa?.activeScenes().includes(sceneKey),
        key,
        { timeout, polling: 100 },
      );
      return;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      const currentFrame = await framesAt();
      const rendered = (openingFrame !== null && currentFrame !== null)
        ? currentFrame - openingFrame
        : null;
      if (currentFrame !== null && currentFrame !== lastFrame) {
        lastFrame = currentFrame;
        lastProgressAt = Date.now();
      }

      // The predicate polls inside the page, so on a page that is barely
      // running it can time out in the same breath as the scene arriving.
      // Never report a failure without looking once more, directly.
      const arrived = await page.evaluate(
        (sceneKey) => window.__qa?.activeScenes().includes(sceneKey) ?? false,
        key,
      ).catch(() => false);
      if (arrived) return;

      // Frames are still arriving, just slowly, and the transition has not
      // yet had the frames it needs. Keep waiting rather than blaming the
      // game for the host's frame rate.
      const stalledFor = Date.now() - lastProgressAt;
      if (rendered !== null && rendered < SCENE_FRAME_BUDGET && stalledFor < NO_PROGRESS_CEILING_MS) {
        continue;
      }

      const state = await page.evaluate(() => ({
        active: window.__qa?.activeScenes() ?? null,
        overlays: window.__qa?.domOverlays() ?? null,
        loop: window.__qa?.loopState() ?? null,
        scenes: window.__qa?.sceneStatus() ?? null,
        // A press that never landed and a press that landed on a console
        // holding a stale lock look identical from out here.
        input: window.__ISPY_QA__?.inputState?.() ?? null,
        events: window.__ISPY_QA__?.readInput?.() ?? null,
      })).catch((evaluationError) => ({ evaluationFailed: String(evaluationError) }));
      state.lastTap = lastTap;
      // A scene that never arrives is usually a scene whose create() threw,
      // and a throw inside a game step stops the loop for good, so the
      // collected browser errors are the diagnosis, not a footnote to it.
      const reported = errors.length ? errors.join(' | ') : 'no browser errors';
      throw new Error(`${label}: scene '${key}' never became active after ${rendered ?? '?'} rendered frames in ${elapsed}ms (${stalledFor}ms since the last frame) // ${JSON.stringify(state)} // ${reported} // ${error.message}`);
    }
  }
}

async function assertViewport(page, expected, label) {
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    const scale = window.__ISPY_QA__?.game?.scale;
    const known = scale?.canvasBounds;
    return {
      // Where Phaser believes the canvas is. Every pointer is translated
      // through this, so if it disagrees with the real rectangle then taps
      // land somewhere other than where the analyst aimed and the console
      // simply stops responding.
      canvasBounds: known ? { left: known.x, top: known.y, width: known.width, height: known.height } : null,
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
  if (metrics.canvasBounds) {
    const offsetX = Math.abs(metrics.canvasBounds.left - metrics.canvas.left);
    const offsetY = Math.abs(metrics.canvasBounds.top - metrics.canvas.top);
    if (offsetX > 1 || offsetY > 1) {
      fail(`pointer input is offset by ${Math.round(offsetX)}x${Math.round(offsetY)}px: the game's record of where the canvas is disagrees with where it is`);
    }
  }
}

/**
 * Controls have to be where a finger can reach them, and only one of them
 * can answer any given point. Both have failed on small phones: SETTINGS was
 * composed off the bottom of a 320px console, and the compact recon rails
 * drew RESET VIEW on top of MARK TARGET.
 *
 * Reachability is judged on the box a control draws, since that is what the
 * analyst aims at. Exclusivity is judged on its hit area, which is the box
 * Phaser actually tests and is larger whenever a short control has padded
 * itself out to the minimum touch target. Controls that look separated can
 * still share hit-area pixels, and the shared pixels go to whichever control
 * is drawn last — so a press on the edge of one runs its neighbour, with
 * nothing on screen to say why.
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
      const boxA = a.hit ?? a;
      const boxB = b.hit ?? b;
      const overlapX = Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left);
      const overlapY = Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top);
      if (overlapX > 2 && overlapY > 2) {
        throw new Error(`${label}: controls '${a.label}' and '${b.label}' share ${overlapX}x${overlapY}px of hit area // ${JSON.stringify([a, b])}`);
      }
    }
  }
  return controls.length;
}

/**
 * Waits for the page to actually render.
 *
 * Everything the suite asserts on — a tap being processed, a layout being
 * re-run after a resize, a queued transition — happens inside a game step,
 * so "give it a moment" has to be counted in frames. A headless browser
 * starved of animation frames by its host turns every millisecond-based
 * pause into no pause at all, and the assertion that follows then reads a
 * state the game has not reached yet.
 *
 * `minMs` is for the things that are genuinely on a clock as well: the
 * viewport sync re-checks itself over 300ms after a resize.
 */
async function settle(page, frames = 3, { minMs = 0, maxMs = 12_000 } = {}) {
  const startedAt = Date.now();
  const opening = await page.evaluate(() => window.__qa?.loopState()?.frame ?? null).catch(() => null);
  if (opening === null) {
    await page.waitForTimeout(Math.max(minMs, frames * 60));
    return;
  }
  await page.waitForFunction(
    ([from, wanted]) => ((window.__qa?.loopState()?.frame ?? 0) - from) >= wanted,
    [opening, frames],
    { timeout: maxMs, polling: 50 },
  ).catch(() => { /* a starved page still moves on; the assertion reports it */ });
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await page.waitForTimeout(remaining);
}

/**
 * Resize, and wait for the game to have actually taken the new size.
 *
 * The app deliberately settles a rotation over several frames — a mobile
 * browser reports its layout viewport in stages — so the browser having
 * resized says nothing about the scene having re-laid out. Waiting on a
 * duration instead of on the size is what made this suite intermittent: a
 * tap that lands a frame early is read against the old width, and SPLIT
 * VIEW, which refuses below 980px, simply declines.
 */
async function resizeTo(page, size, label) {
  await page.setViewportSize(size);
  await settle(page, 4, { minMs: 420 });
  await page.waitForFunction(
    ([width, height]) => {
      const chrome = window.__qa?.reconChrome();
      return Boolean(chrome) && chrome.width === width && chrome.height === height;
    },
    [size.width, size.height],
    { timeout: 10_000, polling: 50 },
  ).catch(async () => {
    const chrome = await page.evaluate(() => window.__qa?.reconChrome()).catch(() => null);
    throw new Error(`${label}: the scene never took the ${size.width}x${size.height} viewport // ${JSON.stringify(chrome)}`);
  });
  await settle(page, 2);
}

/**
 * The console must not act on the tail of the press that dismissed the gate.
 *
 * The gate is a DOM layer over a canvas, and it has to act on pointerdown —
 * that press is the session's one trusted gesture. So it is gone while the
 * finger is still down, and a mobile browser then sends the compatibility
 * mouse cascade (mousedown, mouseup, click) at the coordinates of the tap.
 * mousedown plus mouseup is a complete press to Phaser, and the menu is now
 * underneath: one tap on START used to launch the mission whose card had
 * appeared under the START button.
 *
 * Playwright's touch emulation does not synthesise that cascade, so the
 * suite sends it, at the point the gate was dismissed from, and requires
 * that the console did not move.
 */
async function assertHandoverIsGuarded(page, cdp, point, label) {
  // The shield stands for a fixed window after the gate is dismissed, and
  // the cascade it guards against arrives within milliseconds of that press
  // on a real device. Sending it after the rest of the menu audit has run is
  // not that scenario: on a loaded runner the window has already closed, and
  // the suite then blames the console for acting on a press no longer being
  // guarded. Only assert while the shield is genuinely up.
  const shielded = await page.evaluate(() => Boolean(document.querySelector('.intro-handover')));
  if (!shielded) {
    console.log(`SKIP ${label}: handover shield had already stood down before the cascade could be sent`);
    return false;
  }
  const before = await page.evaluate(() => window.__qa.activeScenes());
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y, button: 'none', clickCount: 0 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await settle(page, 4);
  const after = await page.evaluate(() => window.__qa.activeScenes());
  if (before.join() !== after.join()) {
    throw new Error(`${label}: the press that dismissed the start gate carried into the console `
      + `// ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  }
  return true;
}

/**
 * Audit every control the live scenes actually expose, whatever they are.
 *
 * The named readers only know the menu and the recon console, so a scene
 * neither of them covers was never checked: the IDENTIFICATION GUIDE's
 * category tabs sit a few pixels apart and pad out to the minimum touch
 * target, and on a 360px phone they overlapped by 9px — a press near the
 * seam opened the category next door. This reads whatever is on screen.
 */
async function assertLiveTouchTargets(page, label) {
  const report = await page.evaluate(() => window.__ISPY_QA__?.touchTargets?.() ?? null);
  if (!report) throw new Error(`${label}: live touch target audit unavailable`);
  if (!report.targets.length) throw new Error(`${label}: no live controls found to check`);

  const overlaps = [];
  for (let i = 0; i < report.targets.length; i += 1) {
    for (let j = i + 1; j < report.targets.length; j += 1) {
      const a = report.targets[i];
      const b = report.targets[j];
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (overlapX > 0.5 && overlapY > 0.5) {
        overlaps.push(`${a.name} / ${b.name} share ${Math.round(overlapX)}x${Math.round(overlapY)}px`);
      }
    }
  }
  if (overlaps.length) throw new Error(`${label}: overlapping hit areas // ${overlaps.join(' | ')}`);

  const unreachable = report.targets
    .filter((t) => t.x < -0.5 || t.y < -0.5 || t.x + t.width > report.width + 0.5 || t.y + t.height > report.height + 0.5)
    .map((t) => `${t.name} @ ${Math.round(t.x)},${Math.round(t.y)}`);
  if (unreachable.length) {
    throw new Error(`${label}: controls outside the ${report.width}x${report.height} viewport // ${unreachable.join(' | ')}`);
  }
}

/** A tap where the device has a finger, a click where it has a pointer. */
/** The most recent press the suite made, so a failure can say where it went. */
let lastTap = null;

async function tap(page, profile, point) {
  lastTap = { x: point.x, y: point.y, touch: Boolean(profile.hasTouch), at: Date.now() };
  if (profile.hasTouch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await settle(page, 2);
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
  lastTap = { ...point, touch: Boolean(profile.hasTouch), control: label, scene: sceneKey };
  await tap(page, profile, point);
  lastTap.control = label;
  lastTap.scene = sceneKey;
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
  await settle(page, 2);
}

/**
 * Bring the mission's answer object into the workspace band — clear of the
 * HUD strip and of the mode's bottom control rail — so the tap that follows
 * is a tap a player could make.
 */
async function centreOnTarget(page, profile, passId, context, targetId = null) {
  const chrome = await page.evaluate(() => window.__qa.reconChrome());
  const safeTop = 78 + 26;
  const safeBottom = chrome.height - chrome.railHeight - 26;
  // In split view each pass has its own pane, and the mark has to land in
  // the pane that shows it.
  const paneLeft = chrome.splitView && passId === 'B' ? Math.floor(chrome.width / 2) : 0;
  const paneRight = chrome.splitView && passId !== 'B' ? Math.floor(chrome.width / 2) : chrome.width;
  const centre = { x: (paneLeft + paneRight) / 2, y: (safeTop + safeBottom) / 2 };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const target = await page.evaluate(([pass, id]) => window.__qa.targetPoint(pass, id), [passId ?? null, targetId]);
    if (!target) throw new Error(`${context}: mission target entity is not on the map`);
    // A camera clamped to the imagery cannot centre an object that was
    // authored close to a map edge. The player does not need it centred; its
    // mark point only needs to be visibly inside the pane and clear of HUD.
    const inside = target.screen.x > paneLeft + 4 && target.screen.x < paneRight - 4
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
  const final = await page.evaluate(([pass, id]) => window.__qa.targetPoint(pass, id), [passId ?? null, targetId]);
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

  // A generated LOCATE mission can ask for more than one contact, and the
  // debrief only arrives once every one of them is confirmed. CHANGE keeps
  // its single changed object, which this loop runs exactly once.
  const pending = isChange
    ? [null]
    : await page.evaluate(() => window.__qa.pendingTargetIds());
  if (!pending.length) throw new Error(`${context}: the mission asks for no contacts`);

  for (let index = 0; index < pending.length; index += 1) {
    const targetId = pending[index];
    const step = pending.length > 1 ? `${context}/contact ${index + 1} of ${pending.length}` : context;

    await tapControl(page, profile, 'Recon', markLabel, step);
    const armed = await page.evaluate(() => window.__qa.missionSummary());
    if (!armed.marking) throw new Error(`${step}: marking did not arm after '${markLabel}'`);

    const target = await centreOnTarget(page, profile, passId, step, targetId);
    await tap(page, profile, { x: Math.round(target.screen.x), y: Math.round(target.screen.y) });

    const marked = await page.evaluate(() => window.__qa.missionSummary());
    if (!marked.hasCandidate) throw new Error(`${step}: tapping the target placed no mark`);
    if (!marked.candidateHasEntity) {
      throw new Error(`${step}: the mark resolved to no object // ${JSON.stringify({ target, marked })}`);
    }

    await tapControl(page, profile, 'Recon', 'CONFIRM', step);
    await settle(page, 6);
  }
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

/* ------------------------------------------------------------------ *
 * Android multitouch.
 *
 * Playwright's own touchscreen helper can only tap. Real pan and pinch
 * regressions live in the sequence of contacts, so these drive CDP
 * directly and, crucially, deliver the two fingers of a pinch on
 * SEPARATE events the way Android does — moving both in one event is
 * precisely the case the broken build handled correctly.
 * ------------------------------------------------------------------ */
function androidTouchDriver(cdp) {
  return (type, points) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
      id: point.id,
      radiusX: 3,
      radiusY: 3,
      force: 1,
    })),
  });
}

const readRecon = (page) => page.evaluate(() => window.__ISPY_QA__?.reconState?.());

/** The camera may never sit outside the scroll window its bounds allow. */
function assertInBounds(state, label, step) {
  if (!state?.cameraLimits) throw new Error(`${label}/${step}: camera limits unavailable // ${JSON.stringify(state)}`);
  const { minX, maxX, minY, maxY } = state.cameraLimits;
  const epsilon = 1.5;
  if (state.scrollX < minX - epsilon || state.scrollX > maxX + epsilon
    || state.scrollY < minY - epsilon || state.scrollY > maxY + epsilon) {
    throw new Error(`${label}/${step}: camera escaped its map bounds // ${JSON.stringify(state)}`);
  }
}

/** No single rendered frame may move the camera further than a hand can. */
function assertFrameBounded(before, after, label, step, { maxScroll = 175, maxZoom = 0.2 } = {}) {
  assertInBounds(after, label, step);
  const scroll = Math.hypot(after.scrollX - before.scrollX, after.scrollY - before.scrollY);
  const zoom = Math.abs(after.zoom - before.zoom);
  if (scroll > maxScroll || zoom > maxZoom) {
    throw new Error(`${label}/${step}: camera jumped in one rendered frame // ${JSON.stringify({ scroll, zoom, before, after })}`);
  }
}

/**
 * A point inside the mode's reserved bottom rail that is not an actual
 * control.
 *
 * COUNT and CHANGE reserve up to a fifth of a small phone's height for their
 * rail, and the scene used to refuse map gestures across that whole band. A
 * second pinch finger landing in the blank space beside a button was simply
 * not seen, and the pinch it should have started collapsed into a pan.
 */
async function blankRailPoint(page) {
  return page.evaluate(() => {
    const game = window.__ISPY_QA__.game;
    const scene = game.scene.getScene('Recon');
    const { width, height } = game.scale.gameSize;
    const railTop = height - scene.railHeight(width);
    const live = window.__ISPY_QA__.touchTargets().targets.filter((target) => target.scene === 'Recon');
    const clear = (x, y) => !live.some((rect) =>
      x >= rect.x - 6 && x <= rect.x + rect.width + 6 && y >= rect.y - 6 && y <= rect.y + rect.height + 6);
    for (let y = height - 10; y > Math.max(railTop, 96); y -= 6) {
      for (let x = 14; x < width - 14; x += 10) {
        if (clear(x, y)) return { x, y, railTop, inRail: y > railTop, height };
      }
    }
    return null;
  });
}

async function exerciseAndroidTouchNavigation(page, context, profile, label) {
  const cdp = await context.newCDPSession(page);
  const touch = androidTouchDriver(cdp);
  const read = () => readRecon(page);
  const viewport = page.viewportSize();

  try {
    const baseX = Math.round(viewport.width * 0.5);
    const baseY = Math.round(Math.max(170, Math.min(viewport.height - 200, viewport.height * 0.45)));

    let state = await read();
    if (!state) throw new Error(`${label}: recon gesture state unavailable`);
    assertInBounds(state, label, 'initial');
    const startedAt = state;

    /* 1-3. A multi-step one-finger drag has to scroll gradually. */
    let finger = { id: 31, x: baseX, y: baseY };
    await touch('touchStart', [finger]);
    await settle(page, 1);
    for (const [dx, dy] of [[12, 8], [14, 9], [13, 11], [15, 8], [12, 10]]) {
      const before = await read();
      finger = { ...finger, x: finger.x + dx, y: finger.y + dy };
      await touch('touchMove', [finger]);
      const immediate = await read();
      if (immediate.panGestureDirty
        && Math.hypot(immediate.scrollX - before.scrollX, immediate.scrollY - before.scrollY) > 0.5) {
        throw new Error(`${label}/pan-event: a raw pointermove moved the camera before the frame // ${JSON.stringify({ before, immediate })}`);
      }
      await settle(page, 1);
      assertFrameBounded(before, await read(), label, 'pan-frame', { maxScroll: 140, maxZoom: 0.01 });
    }

    // One deliberately malformed sample. The excess may be discarded; it may
    // never fling the imagery.
    const beforeSpike = await read();
    finger = {
      ...finger,
      x: Math.max(28, Math.min(viewport.width - 28, finger.x - 190)),
      y: Math.max(120, Math.min(viewport.height - 40, finger.y + 170)),
    };
    await touch('touchMove', [finger]);
    await settle(page, 1);
    assertFrameBounded(beforeSpike, await read(), label, 'pan-spike', { maxScroll: 145, maxZoom: 0.01 });
    await touch('touchEnd', []);
    await settle(page, 1);

    const panned = await read();
    if (Math.hypot(panned.scrollX - startedAt.scrollX, panned.scrollY - startedAt.scrollY) < 12) {
      throw new Error(`${label}/pan: a five-step drag did not move the map // ${JSON.stringify({ startedAt, panned })}`);
    }

    /* Arm marking. Navigation must still work with the mark control live,
     * and must never leave a mark behind. */
    const summary = await page.evaluate(() => window.__qa.missionSummary());
    const markLabel = summary.mode === 'CHANGE' ? 'MARK CHANGE' : 'MARK TARGET';
    let armed = false;
    if (summary.mode !== 'COUNT') {
      await tapControl(page, profile, 'Recon', markLabel, `${label}/arm`);
      const armedState = await page.evaluate(() => window.__qa.missionSummary());
      if (!armedState.marking) throw new Error(`${label}: '${markLabel}' did not arm`);
      armed = true;
    }

    /* 4-6. Start the pinch with its second finger in blank rail space. */
    const rail = await blankRailPoint(page);
    if (!rail) throw new Error(`${label}: found no blank space in the bottom rail to pinch from`);
    // The blank space can be at either edge of the rail, so the other finger
    // goes to whichever side has room and the spread direction follows from
    // the geometry rather than being assumed.
    const margin = 34;
    const clampX = (x) => Math.max(margin, Math.min(viewport.width - margin, x));
    const partnerX = rail.x < viewport.width / 2
      ? clampX(rail.x + Math.max(90, viewport.width * 0.3))
      : clampX(rail.x - Math.max(90, viewport.width * 0.3));
    let first = { id: 41, x: clampX(rail.x), y: rail.y };
    let second = { id: 42, x: partnerX, y: Math.max(140, rail.railTop - 40) };
    // -1 moves this finger left, +1 right; outward for each of the pair.
    const outward = first.x <= second.x ? -1 : 1;

    await touch('touchStart', [first]);
    await touch('touchMove', [{ ...first, x: first.x + 3, y: first.y + 2 }]);
    first = { ...first, x: first.x + 3, y: first.y + 2 };
    await touch('touchStart', [first, second]);
    await settle(page, 1);

    let pinch = await read();
    if (!pinch.pinchActive || pinch.pinchPointerIds.length !== 2) {
      throw new Error(`${label}/pinch-start: a second finger in blank rail space did not start a pinch // ${JSON.stringify({ rail, pinch })}`);
    }
    const capturedIds = pinch.pinchPointerIds.join(',');
    const pinchStartZoom = pinch.zoom;

    /* 7. Alternate the two contacts, one event per finger — Android's cadence. */
    // One contact per event, each given its own rendered frame, because that
    // is what a phone does: the finger that did not move is re-reported at
    // its previous coordinate. Every frame is asserted on its own, so a
    // bounded step cannot hide inside a pair of steps.
    const moveContact = async (points, step) => {
      const before = await read();
      await touch('touchMove', points);
      const immediate = await read();
      if (immediate.pinchDirty) {
        const rawScroll = Math.hypot(immediate.scrollX - before.scrollX, immediate.scrollY - before.scrollY);
        if (rawScroll > 0.5 || Math.abs(immediate.zoom - before.zoom) > 0.002) {
          throw new Error(`${label}/${step}: a raw pinch event transformed the camera before the frame // ${JSON.stringify({ before, immediate })}`);
        }
      }
      await settle(page, 1);
      const after = await read();
      assertFrameBounded(before, after, label, step);
      if (!after.pinchActive) throw new Error(`${label}/${step}: the pinch dropped mid-gesture // ${JSON.stringify(after)}`);
      if (after.pinchPointerIds.join(',') !== capturedIds) {
        throw new Error(`${label}/${step}: pinch ownership changed mid-gesture // ${JSON.stringify({ capturedIds, after })}`);
      }
      if (after.candidate) throw new Error(`${label}/${step}: navigating created an accidental mark`);
      return after;
    };

    const movePair = async (nextFirst, nextSecond, step) => {
      const previousSecond = second;
      const firstChanged = nextFirst.x !== first.x || nextFirst.y !== first.y;
      const secondChanged = nextSecond.x !== second.x || nextSecond.y !== second.y;
      first = nextFirst;
      second = nextSecond;
      let after = await read();
      if (firstChanged) after = await moveContact([first, previousSecond], step);
      if (secondChanged) after = await moveContact([first, second], step);
      return after;
    };

    /* 8. Pinch outward, smoothly. */
    for (let index = 0; index < 6; index += 1) {
      pinch = await movePair({ ...first, x: clampX(first.x + 6 * outward), y: first.y + (index % 2) }, second, 'pinch-out-a');
      pinch = await movePair(first, { ...second, x: clampX(second.x - 6 * outward), y: second.y - (index % 2) }, 'pinch-out-b');
    }
    if (!(pinch.zoom > pinchStartZoom + 0.08)) {
      throw new Error(`${label}/pinch-out: zoom barely moved // ${JSON.stringify({ pinchStartZoom, pinch })}`);
    }

    /* 9. Both fingers together: a pan, at near-constant separation. */
    const beforeTwoFingerPan = pinch;
    for (let index = 0; index < 5; index += 1) {
      pinch = await movePair({ ...first, x: clampX(first.x + 6), y: first.y - 5 }, second, 'two-finger-pan-a');
      pinch = await movePair(first, { ...second, x: clampX(second.x + 6), y: second.y - 5 }, 'two-finger-pan-b');
    }
    const twoFingerScroll = Math.hypot(
      pinch.scrollX - beforeTwoFingerPan.scrollX,
      pinch.scrollY - beforeTwoFingerPan.scrollY,
    );
    if (twoFingerScroll < 8 || Math.abs(pinch.zoom - beforeTwoFingerPan.zoom) > 0.12) {
      throw new Error(`${label}/two-finger-pan: unstable translation // ${JSON.stringify({ beforeTwoFingerPan, pinch, twoFingerScroll })}`);
    }

    /* 11. A wild separation change stays bounded, then normal samples resume
     *     without springing back. */
    const beforeBadSample = await read();
    const afterBadSample = await movePair(
      { ...first, x: clampX(first.x + 110 * outward) },
      { ...second, x: clampX(second.x - 110 * outward) },
      'pinch-spike',
    );
    // movePair already bounded each of the two frames the pair produced; the
    // pair as a whole may not exceed two frames' worth either, which is what
    // catches a discarded excess springing back on the following frame.
    assertFrameBounded(beforeBadSample, afterBadSample, label, 'pinch-spike-pair', { maxScroll: 350, maxZoom: 0.4 });

    /* A third contact — a palm, a stray thumb — may not take over either of
     * the two fingers the pinch captured. */
    const intruder = { id: 43, x: clampX(Math.round(viewport.width / 2)), y: Math.max(140, rail.railTop - 90) };
    await touch('touchStart', [first, second, intruder]);
    await settle(page, 1);
    const withIntruder = await read();
    if (!withIntruder.pinchActive || withIntruder.pinchPointerIds.join(',') !== capturedIds) {
      throw new Error(`${label}/third-finger: a third contact took over the pinch // ${JSON.stringify({ capturedIds, withIntruder })}`);
    }
    await touch('touchMove', [first, second, { ...intruder, x: clampX(intruder.x + 40), y: intruder.y + 30 }]);
    await settle(page, 1);
    const afterIntruderMove = await read();
    if (afterIntruderMove.pinchPointerIds.join(',') !== capturedIds) {
      throw new Error(`${label}/third-finger: moving a third contact reassigned the pinch // ${JSON.stringify(afterIntruderMove)}`);
    }
    assertFrameBounded(withIntruder, afterIntruderMove, label, 'third-finger');
    // CDP releases the contacts it is handed, so this lifts the intruder only.
    await touch('touchEnd', [intruder]);
    await settle(page, 1);
    const afterIntruderLift = await read();
    if (!afterIntruderLift.pinchActive) {
      throw new Error(`${label}/third-finger: lifting the third contact ended the pinch // ${JSON.stringify(afterIntruderLift)}`);
    }

    /* 10. Pinch back inward. */
    for (let index = 0; index < 6; index += 1) {
      pinch = await movePair({ ...first, x: clampX(first.x - 6 * outward), y: first.y - (index % 2) }, second, 'pinch-in-a');
      pinch = await movePair(first, { ...second, x: clampX(second.x + 6 * outward), y: second.y + (index % 2) }, 'pinch-in-b');
    }
    if (!(pinch.zoom < afterBadSample.zoom - 0.06)) {
      throw new Error(`${label}/pinch-in: zoom did not come back down // ${JSON.stringify({ afterBadSample, pinch })}`);
    }

    /* 12. Release cleanly, one finger at a time: lifting the first must rebase
     *     the survivor rather than jump. */
    const beforeLift = await read();
    await touch('touchEnd', [first]);
    await settle(page, 2);
    const afterLift = await read();
    if (afterLift.pinchActive) throw new Error(`${label}/pinch-release: the pinch survived its first release`);
    // The survivor becomes a one-finger pan, rebased to where it actually is.
    if (!afterLift.dragging || afterLift.activeMapPointers.length !== 1) {
      throw new Error(`${label}/pinch-release: the remaining finger did not take over the pan // ${JSON.stringify(afterLift)}`);
    }
    assertFrameBounded(beforeLift, afterLift, label, 'pinch-release', { maxScroll: 40, maxZoom: 0.03 });

    const beforeRebasedPan = afterLift;
    first = { ...first, x: clampX(first.x + 24), y: first.y - 18 };
    await touch('touchMove', [first]);
    await settle(page, 1);
    assertFrameBounded(beforeRebasedPan, await read(), label, 'post-pinch-pan', { maxScroll: 140, maxZoom: 0.01 });
    await touch('touchEnd', []);
    await settle(page, 2);

    const released = await read();
    if (released.pinchActive || released.dragging || released.panGestureDirty) {
      throw new Error(`${label}/release: gesture state stuck after every finger lifted // ${JSON.stringify(released)}`);
    }

    /* 14. Still armed, still unmarked: navigation is not marking. */
    if (armed) {
      const afterNavigation = await page.evaluate(() => window.__qa.missionSummary());
      if (afterNavigation.hasCandidate) {
        throw new Error(`${label}: pan and pinch left an accidental mark on the map`);
      }
      if (!afterNavigation.marking) {
        throw new Error(`${label}: navigating disarmed '${markLabel}'`);
      }
      // A deliberate single tap still marks after the gesture storm, and
      // cancelling it puts the mode control back the way the mission play
      // path expects to find it.
      const chrome = await page.evaluate(() => window.__qa.reconChrome());
      await tap(page, profile, {
        x: Math.round(chrome.width / 2),
        y: Math.round((78 + (chrome.height - chrome.railHeight)) / 2),
      });
      const deliberate = await page.evaluate(() => window.__qa.missionSummary());
      if (!deliberate.hasCandidate) {
        throw new Error(`${label}: a deliberate tap no longer marks once panning and pinching are done`);
      }
      await tapControl(page, profile, 'Recon', 'CANCEL', `${label}/disarm`);
      const disarmed = await page.evaluate(() => window.__qa.missionSummary());
      if (disarmed.marking || disarmed.hasCandidate) {
        throw new Error(`${label}: CANCEL left the mark control armed // ${JSON.stringify(disarmed)}`);
      }
    }

    /* 13. Pan again immediately. */
    const freshBefore = await read();
    const fresh = { id: 51, x: baseX, y: baseY };
    await touch('touchStart', [fresh]);
    await touch('touchMove', [{ ...fresh, x: fresh.x + 20, y: fresh.y + 16 }]);
    await settle(page, 1);
    await touch('touchMove', [{ ...fresh, x: fresh.x + 40, y: fresh.y + 32 }]);
    await settle(page, 1);
    const freshAfter = await read();
    assertFrameBounded(freshBefore, freshAfter, label, 'immediate-pan', { maxScroll: 140, maxZoom: 0.01 });
    if (Math.hypot(freshAfter.scrollX - freshBefore.scrollX, freshAfter.scrollY - freshBefore.scrollY) < 6) {
      throw new Error(`${label}/immediate-pan: the map did not respond to the next drag // ${JSON.stringify({ freshBefore, freshAfter })}`);
    }

    /* A DOM-level cancellation must release everything, and the gesture after
     * it must be accepted normally. */
    await page.evaluate((pointerId) => {
      document.querySelector('canvas').dispatchEvent(new PointerEvent('pointercancel', {
        pointerId, pointerType: 'touch', isPrimary: true, bubbles: true,
      }));
    }, fresh.id);
    await touch('touchEnd', []);
    await settle(page, 2);
    const cancelled = await read();
    if (cancelled.pinchActive || cancelled.dragging || cancelled.panGestureDirty) {
      throw new Error(`${label}/touchcancel: stale gesture state survived cancellation // ${JSON.stringify(cancelled)}`);
    }
    assertInBounds(cancelled, label, 'touchcancel');

    const postCancel = { id: 61, x: baseX, y: baseY };
    await touch('touchStart', [postCancel]);
    await touch('touchMove', [{ ...postCancel, x: postCancel.x - 30, y: postCancel.y - 24 }]);
    await settle(page, 1);
    const postCancelState = await read();
    assertFrameBounded(cancelled, postCancelState, label, 'post-cancel-pan', { maxScroll: 140, maxZoom: 0.01 });
    if (Math.hypot(postCancelState.scrollX - cancelled.scrollX, postCancelState.scrollY - cancelled.scrollY) < 6) {
      throw new Error(`${label}/post-cancel-pan: the controller did not accept the next finger // ${JSON.stringify({ cancelled, postCancelState })}`);
    }
    await touch('touchEnd', []);
    await settle(page, 2);

    console.log(`PASS ${label}: Android pan/pinch stable at ${viewport.width}x${viewport.height} (zoom ${pinchStartZoom.toFixed(2)}→${afterBadSample.zoom.toFixed(2)}→${pinch.zoom.toFixed(2)})`);
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/**
 * CHANGE split view: two panes, two cameras, one gesture model.
 *
 * A pinch inside either pane zooms both, because the panes are a comparison
 * and have to stay registered. A pair of fingers that straddles the seam
 * belongs to neither camera and is refused outright rather than dragging one
 * pane's imagery with the other pane's finger.
 */
/**
 * After split view is dropped mid-mission the scene is back to one camera
 * over the full width. A gesture that still assumed two panes would move
 * nothing, or move the wrong camera.
 */
async function exerciseSinglePaneGestureAfterSplit(page, context, label) {
  const cdp = await context.newCDPSession(page);
  const touch = androidTouchDriver(cdp);
  try {
    const chrome = await page.evaluate(() => window.__qa.reconChrome());
    const before = await readRecon(page);
    assertInBounds(before, label, 'post-split-initial');
    const y = Math.round((78 + (chrome.height - chrome.railHeight)) / 2);
    const finger = { id: 91, x: Math.round(chrome.width / 2), y };
    await touch('touchStart', [finger]);
    let previous = before;
    for (let step = 1; step <= 4; step += 1) {
      await touch('touchMove', [{ ...finger, x: finger.x - 14 * step, y: y - 10 * step }]);
      await settle(page, 1);
      const next = await readRecon(page);
      assertFrameBounded(previous, next, label, 'post-split-pan', { maxScroll: 140, maxZoom: 0.01 });
      previous = next;
    }
    await touch('touchEnd', []);
    await settle(page, 2);
    const after = await readRecon(page);
    if (after.splitView) throw new Error(`${label}: split view came back on its own`);
    if (after.dragging || after.pinchActive) {
      throw new Error(`${label}: a gesture after the split was dropped did not release // ${JSON.stringify(after)}`);
    }
    if (Math.hypot(after.scrollX - before.scrollX, after.scrollY - before.scrollY) < 6) {
      throw new Error(`${label}: panning stopped working once split view was dropped // ${JSON.stringify({ before, after })}`);
    }
    console.log(`PASS ${label}: gestures stay stable after split view is dropped`);
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function exerciseSplitViewGestures(page, context, profile, label) {
  const cdp = await context.newCDPSession(page);
  const touch = androidTouchDriver(cdp);
  const read = () => readRecon(page);

  try {
    const chrome = await page.evaluate(() => window.__qa.reconChrome());
    if (!chrome?.splitView) throw new Error(`${label}: split view is not engaged`);
    const half = Math.floor(chrome.width / 2);
    const y = Math.round((78 + (chrome.height - chrome.railHeight)) / 2);

    const pinchInside = async (paneLeft, paneRight, pane) => {
      const centre = Math.round((paneLeft + paneRight) / 2);
      let a = { id: 71, x: centre - 50, y };
      let b = { id: 72, x: centre + 50, y };
      const before = await read();
      await touch('touchStart', [a]);
      await touch('touchStart', [a, b]);
      await settle(page, 1);

      const started = await read();
      if (!started.pinchActive || started.pinchPointerIds.length !== 2) {
        throw new Error(`${label}/pane-${pane}: a pinch inside one pane did not start // ${JSON.stringify(started)}`);
      }
      if (started.pinchCameraIsCompare !== (pane === 'B')) {
        throw new Error(`${label}/pane-${pane}: the pinch bound the wrong pane's camera // ${JSON.stringify(started)}`);
      }

      for (let index = 0; index < 6; index += 1) {
        const previousB = b;
        a = { ...a, x: Math.max(paneLeft + 8, a.x - 5) };
        await touch('touchMove', [a, previousB]);
        b = { ...b, x: Math.min(paneRight - 8, b.x + 5) };
        await touch('touchMove', [a, b]);
        await settle(page, 1);
        const step = await read();
        assertFrameBounded(index === 0 ? started : step, step, label, `pane-${pane}-pinch`);
        if (!step.pinchActive) throw new Error(`${label}/pane-${pane}: the pinch dropped mid-gesture`);
      }
      await touch('touchEnd', []);
      await settle(page, 2);

      const after = await read();
      if (!(after.zoom > before.zoom + 0.06)) {
        throw new Error(`${label}/pane-${pane}: pinching inside the pane did not zoom // ${JSON.stringify({ before, after })}`);
      }
      if (!after.compare) throw new Error(`${label}/pane-${pane}: the comparison camera vanished`);
      const drift = Math.hypot(after.compare.scrollX - after.scrollX, after.compare.scrollY - after.scrollY);
      if (Math.abs(after.compare.zoom - after.zoom) > 0.001 || drift > 1.5) {
        throw new Error(`${label}/pane-${pane}: the panes fell out of register // ${JSON.stringify(after)}`);
      }
      if (after.candidate) throw new Error(`${label}/pane-${pane}: pinching marked the imagery`);
      return after;
    };

    await pinchInside(0, half, 'A');
    await pinchInside(half, chrome.width, 'B');

    // One finger per pane: refused, and nothing moves.
    const before = await read();
    const left = { id: 81, x: Math.round(half / 2), y };
    const right = { id: 82, x: Math.round(half + half / 2), y };
    await touch('touchStart', [left]);
    await touch('touchStart', [left, right]);
    await settle(page, 1);
    const straddling = await read();
    if (straddling.pinchActive) {
      throw new Error(`${label}/straddle: one finger in each pane started a pinch // ${JSON.stringify(straddling)}`);
    }
    for (let index = 0; index < 4; index += 1) {
      await touch('touchMove', [{ ...left, x: left.x - 8 * (index + 1) }, right]);
      await touch('touchMove', [{ ...left, x: left.x - 8 * (index + 1) }, { ...right, x: right.x + 8 * (index + 1) }]);
      await settle(page, 1);
    }
    const afterStraddle = await read();
    if (afterStraddle.pinchActive) throw new Error(`${label}/straddle: a cross-pane pinch started on movement`);
    assertFrameBounded(before, afterStraddle, label, 'straddle', { maxScroll: 175, maxZoom: 0.06 });
    await touch('touchEnd', []);
    await settle(page, 2);
    const settled = await read();
    if (settled.pinchActive || settled.dragging) {
      throw new Error(`${label}/straddle: a refused cross-pane gesture left state behind // ${JSON.stringify(settled)}`);
    }

    console.log(`PASS ${label}: split-view pinch stays inside one pane and keeps both in register`);
  } finally {
    await cdp.detach().catch(() => {});
  }
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
  // Reproduces a host that starves the page of animation frames, which is
  // what one CI runner did to headless WebKit. The suite has to stay honest
  // under it: everything it asserts on happens inside a game step.
  if (process.env.ISPY_E2E_STARVE_FRAMES) {
    await page.addInitScript((ms) => {
      window.requestAnimationFrame = (callback) => window.setTimeout(
        () => callback(performance.now()),
        ms,
      );
    }, Number(process.env.ISPY_E2E_STARVE_FRAMES));
  }

  const url = new URL(BASE_URL);
  url.searchParams.set('qa', '1');
  url.searchParams.set('seed', `QA-CROSS-DEVICE-${profile.name}`);
  url.searchParams.set('mode', profile.mode);
  url.searchParams.set('map', profile.map);
  url.searchParams.set('qa', '1');

  try {
    const response = await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (!response?.ok()) throw new Error(`initial document failed: ${response?.status()}`);

    /* --- Start gate --------------------------------------------------- *
     * The gate has to be standing whatever the browser makes of the intro
     * media: it is the one trusted gesture that unlocks audio for the
     * session, and a device that cannot decode the MP4 used to have it
     * dismissed for it, which left music and SFX locked for the whole run. */
    // Boot hands over to the gate on a timer the game runs from its own
    // loop, so how long that takes is frames, not seconds. Sequencing on the
    // scene rather than on the DOM keeps the handover deterministic on every
    // engine, and gives a slow host the frames it needs to get there.
    await waitForScene(page, 'StartIntro', `${profile.name}/intro`, 20_000, errors);

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
          loop: window.__qa?.loopState() ?? null,
        };
      }).catch(() => ({ evaluationFailed: true }));
      throw new Error(`start gate never appeared // ${JSON.stringify(diagnostic)} // ${errors.join(' | ')} // ${error.message}`);
    }

    // Where the gate was dismissed from, so the handover guard can be tested
    // at the coordinates a real device would send the cascade to.
    const gatePoint = await page.evaluate(() => {
      const rect = document.querySelector('.intro-start__button')?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) } : null;
    });

    if (profile.domIntroUnreachable) {
      // Headless Playwright WebKit does not deliver synthesized touch or click
      // events to this DOM media gate, so the gate is only asserted to exist
      // here and the scene is asked to finish itself. Every in-canvas iPhone
      // interaction below is still a real WebKit touch on a real control.
      await page.evaluate(() => window.__ISPY_QA__?.finishIntro?.());
    } else if (profile.hasTouch) {
      await startButton.tap();
    } else {
      await startButton.click();
    }

    /* --- Menu ------------------------------------------------------- */
    await waitForScene(page, 'MainMenu', `${profile.name}/menu`, 20_000, errors);
    const loop = await page.evaluate(() => window.__qa.loopState());
    if (!loop.running) throw new Error(`${profile.name}/menu: the game loop has stopped // ${JSON.stringify(loop)}`);

    // First, before the rest of the menu audit spends the shield's window:
    // this assertion is about the tail of the dismissing press, which on a
    // real device lands milliseconds after it. The cascade has to be
    // synthesised through CDP, which is Chromium only; WebKit still
    // exercises the gate itself, just not this one assertion.
    if (gatePoint && !profile.domIntroUnreachable && profile.engine === chromium) {
      const cdp = await context.newCDPSession(page);
      try {
        await assertHandoverIsGuarded(page, cdp, gatePoint, `${profile.name}/menu`);
      } finally {
        await cdp.detach().catch(() => {});
      }
    }
    await settle(page, 3);
    await page.waitForFunction(() => (window.__qa.domOverlays() ?? []).every((tag) => tag !== 'section'), null, { timeout: 5_000 });
    await assertViewport(page, profile.viewport, `${profile.name}/menu`);
    await assertControlsReachable(page, 'menuControls', `${profile.name}/menu`);

    // The gate leaves a shield over the console for the tail of the press
    // that dismissed it, and it swallows everything while it stands. A person
    // never notices; a suite that taps the instant the menu appears does, so
    // wait for it to stand down rather than racing it.
    await page.waitForFunction(() => !document.querySelector('.intro-handover'), null, { timeout: 5_000 })
      .catch(() => { /* no shield was raised, which is the usual case here */ });
    await settle(page, 2);

    /* --- Identification guide ---------------------------------------- *
     * A whole scene the named readers do not cover, and the narrowest
     * profile is where its tabs had the least room.                       */
    if (profile.viewport.width <= 380) {
      await tapControl(page, profile, 'MainMenu', 'IDENTIFICATION GUIDE', `${profile.name}/guide`);
      await waitForScene(page, 'IdentificationGuide', `${profile.name}/guide`, 12_000, errors);
      await settle(page, 4);
      await assertLiveTouchTargets(page, `${profile.name}/guide`);
      await page.keyboard.press('Escape');
      await waitForScene(page, 'MainMenu', `${profile.name}/guide-return`, 12_000, errors);
      await settle(page, 3);
    }

    /* --- Pointer transform ------------------------------------------- *
     * Phaser translates every pointer through its record of where the
     * canvas is. The viewport sync clears the centring margins so the
     * canvas fills the safe area, which moves it; if it does not say so,
     * taps land offset by exactly that margin and nothing on the console
     * responds. Forced here rather than waited for, because which engine
     * gets given a margin is not ours to choose.                         */
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas.style.marginLeft = '40px';
      canvas.style.marginTop = '25px';
      window.__ISPY_QA__.game.scale.updateBounds();
    });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await settle(page, 4, { minMs: 420 });
    const transform = await page.evaluate(() => {
      const scale = window.__ISPY_QA__.game.scale;
      const rect = document.querySelector('canvas').getBoundingClientRect();
      return {
        offsetX: Math.round(rect.left - scale.canvasBounds.x),
        offsetY: Math.round(rect.top - scale.canvasBounds.y),
        margin: [document.querySelector('canvas').style.marginLeft, document.querySelector('canvas').style.marginTop],
      };
    });
    if (Math.abs(transform.offsetX) > 1 || Math.abs(transform.offsetY) > 1) {
      throw new Error(`${profile.name}/menu: moving the canvas left pointer input behind by ${transform.offsetX}x${transform.offsetY}px // ${JSON.stringify(transform)}`);
    }
    await assertViewport(page, profile.viewport, `${profile.name}/menu-after-recentre`);
    const menuHash = await screenHash(page);

    await page.evaluate(() => window.__ISPY_QA__?.recordInput?.());
    await tapControl(page, profile, 'MainMenu', 'RANDOM MISSION', `${profile.name}/menu`);

    /* --- Briefing --------------------------------------------------- */
    await waitForScene(page, 'MissionBriefing', `${profile.name}/briefing`, 12_000, errors);
    await settle(page, 3);
    await assertViewport(page, profile.viewport, `${profile.name}/briefing`);
    const briefingHash = await screenHash(page);
    if (briefingHash === menuHash) throw new Error('menu did not visually transition to mission briefing');

    await tapControl(page, profile, 'MissionBriefing', 'ACQUIRE IMAGERY', `${profile.name}/briefing`);

    /* --- Recon ------------------------------------------------------ */
    await waitForScene(page, 'Recon', `${profile.name}/recon`, 12_000, errors);
    await settle(page, 4);
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

    if (profile.androidGestureStress) {
      await exerciseAndroidTouchNavigation(
        page, context, profile,
        `${profile.name}/${profile.mode}/${profile.map}`,
      );
      // Back to a known view, and to a controller with no gesture left over.
      await tapControl(page, profile, 'Recon', 'RESET VIEW', `${profile.name}/post-gesture-reset`);
      await settle(page, 3);
      const resetState = await page.evaluate(() => window.__ISPY_QA__?.reconState?.());
      if (!resetState || resetState.pinchActive || resetState.dragging || resetState.candidate) {
        throw new Error(`${profile.name}/post-gesture-reset: the camera controls did not come back clean // ${JSON.stringify(resetState)}`);
      }
    }

    // Pause/resume before playing: the timer, the rail and the weather layer
    // all have to survive a hold in the middle of a live mission.
    await tapControl(page, profile, 'Recon', 'PAUSE', `${profile.name}/recon`);
    const held = await page.evaluate(() => window.__qa.reconChrome());
    if (!held.paused) throw new Error(`${profile.name}/recon: PAUSE did not hold the mission`);
    await tapControl(page, profile, 'Recon', 'RESUME', `${profile.name}/recon`);
    const resumed = await page.evaluate(() => window.__qa.reconChrome());
    if (resumed.paused) throw new Error(`${profile.name}/recon: RESUME did not release the hold`);

    // One key press is one action. Phaser re-delivers queued key events, so
    // a single ESC used to toggle the hold an even number of times and read
    // as a dead key, and a single COUNT arrow moved the tally by three.
    await page.keyboard.press('Escape');
    await settle(page, 2);
    if (!(await page.evaluate(() => window.__qa.reconChrome())).paused) {
      throw new Error(`${profile.name}/recon: one ESC press did not hold the mission`);
    }
    await page.keyboard.press('Escape');
    await settle(page, 2);
    if ((await page.evaluate(() => window.__qa.reconChrome())).paused) {
      throw new Error(`${profile.name}/recon: one ESC press did not release the hold`);
    }
    if (profile.mode === 'COUNT') {
      await page.keyboard.press('ArrowUp');
      await settle(page, 2);
      const stepped = await page.evaluate(() => window.__qa.missionSummary());
      if (stepped.answerValue !== 1) {
        throw new Error(`${profile.name}/recon: one arrow press moved the tally to ${stepped.answerValue}`);
      }
      await page.keyboard.press('ArrowDown');
      await settle(page, 2);
      const cleared = await page.evaluate(() => window.__qa.missionSummary());
      if (cleared.answerValue !== 0) {
        throw new Error(`${profile.name}/recon: one arrow press left the tally at ${cleared.answerValue}`);
      }
    }

    // Rotate while the mission is live. This hits the layout, camera, rail,
    // weather and safe-area resize paths under actual rendering.
    await resizeTo(page, profile.rotateTo, `${profile.name}/rotated-recon`);
    await assertViewport(page, profile.rotateTo, `${profile.name}/rotated-recon`);
    await assertControlsReachable(page, 'reconControls', `${profile.name}/rotated-recon`);
    await resizeTo(page, profile.viewport, `${profile.name}/restored-recon`);
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
      await resizeTo(page, profile.rotateTo, `${profile.name}/split-narrowed`);
      chrome = await page.evaluate(() => window.__qa.reconChrome());
      if (chrome.splitView && profile.rotateTo.width < 980) {
        throw new Error(`${context$}: split view survived a resize below its minimum width`);
      }
      await assertControlsReachable(page, 'reconControls', `${profile.name}/split-narrowed`);
      await resizeTo(page, profile.viewport, `${profile.name}/split-restored`);

      await tapControl(page, profile, 'Recon', 'SPLIT VIEW', `${profile.name}/split-again`);
      chrome = await page.evaluate(() => window.__qa.reconChrome());
      if (!chrome.splitView) throw new Error(`${context$}: split view could not be re-entered`);

      if (profile.splitViewGestureStress) {
        await exerciseSplitViewGestures(page, context, profile, `${profile.name}/split`);
        // Narrow until the second pane is dropped, then prove the single-pane
        // gesture model still drives the camera on the way back out.
        await resizeTo(page, profile.rotateTo, `${profile.name}/split-dropped`);
        const narrowed = await page.evaluate(() => window.__qa.reconChrome());
        if (narrowed.splitView) throw new Error(`${context$}: split view survived narrowing below its minimum`);
        await exerciseSinglePaneGestureAfterSplit(page, context, `${profile.name}/split-dropped`);
        await resizeTo(page, profile.viewport, `${profile.name}/split-restored-again`);
        await tapControl(page, profile, 'Recon', 'SPLIT VIEW', `${profile.name}/split-final`);
        chrome = await page.evaluate(() => window.__qa.reconChrome());
        if (!chrome.splitView) throw new Error(`${context$}: split view could not be re-entered after the gesture pass`);
        // Hand the mission back at the mission's own framing, not at whatever
        // the pinch stress left on screen.
        await tapControl(page, profile, 'Recon', 'RESET VIEW', `${profile.name}/split-gesture-reset`);
        await settle(page, 3);
        const restored = await page.evaluate(() => window.__ISPY_QA__?.reconState?.());
        if (!restored || restored.pinchActive || restored.dragging || restored.candidate) {
          throw new Error(`${context$}: split-view gestures did not come back clean // ${JSON.stringify(restored)}`);
        }
      }
    }

    if (profile.mode === 'COUNT') await playCount(page, profile, context$);
    else await playLocateOrChange(page, profile, context$);

    /* --- Debrief ---------------------------------------------------- */
    await waitForScene(page, 'Results', `${profile.name}/results`, 12_000, errors);
    await settle(page, 3);
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
    await waitForScene(page, 'MissionBriefing', `${profile.name}/briefing-2`, 12_000, errors);
    await settle(page, 3);
    await tapControl(page, profile, 'MissionBriefing', 'ACQUIRE IMAGERY', `${profile.name}/briefing-2`);
    await waitForScene(page, 'Recon', `${profile.name}/recon-2`, 12_000, errors);
    await settle(page, 4);
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
