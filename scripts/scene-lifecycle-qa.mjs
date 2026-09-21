import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oncePerKeyEvent } from '../src/ui/keyboardEvents.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
let total = 0;
const check = (condition, message) => {
  total += 1;
  if (!condition) failures.push(message);
};

const recon = read('src/scenes/ReconScene.js');
const briefing = read('src/scenes/MissionBriefingScene.js');
const record = read('src/scenes/AnalystRecordScene.js');
const results = read('src/scenes/ResultsScene.js');
const enhanced = read('src/scenes/EnhancedReconScene.js');
const weather = read('src/ui/weatherOverlay.js');
const intro = read('src/scenes/StartIntroScene.js');
const focusGroup = read('src/ui/focusGroup.js');
const guide = read('src/scenes/IdentificationGuideScene.js');
const main = read('src/main.js');
const menu = read('src/scenes/MainMenuScene.js');
const styles = read('src/styles.css');
const button = read('src/ui/createButton.js');
const tokens = read('src/ui/designTokens.js');

check(
  /create\(data = \{\}\) \{[\s\S]*?this\.missionEnded = false;[\s\S]*?this\.resolvingIdentification = false;/.test(recon),
  'ReconScene resets resolvingIdentification for every mission create',
);
check(
  /bindInput\(\) \{[\s\S]*?this\.controlPointerIds = new Set\(\);[\s\S]*?this\.controlReleasedPointerIds = new Set\(\);[\s\S]*?this\.tapPointer = null;/.test(recon)
    && !recon.includes('this.controlPressed')
    && !recon.includes('this.controlReleased ='),
  'ReconScene owns control presses per pointer id, with no shared flag one finger can spend on another',
);
check(
  /create\(data = \{\}\) \{[\s\S]*?this\.totalPausedMs = 0;[\s\S]*?this\.pauseStartedAt = null;/.test(recon),
  'ReconScene resets pause accounting for every mission create',
);
check(
  /createHud\(\) \{[\s\S]*?this\.lastCountdownSecond = null;/.test(enhanced),
  'EnhancedReconScene resets countdown feedback for every reused mission scene',
);
check(
  /finishMission\(success\) \{[\s\S]*?const resultId =[\s\S]*?scene\.start\('Results'/.test(recon)
    && (recon.match(/resultId,/g) ?? []).length >= 3,
  'every mission result carries one attempt id into Results',
);
check(
  /create\(data = \{\}\) \{[\s\S]*?this\.transitioning = false;/.test(briefing),
  'MissionBriefingScene resets its transition guard on scene reuse',
);
check(
  results.includes("success ? 'NEXT MISSION' : 'RETRY MISSION'"),
  'Results primary action distinguishes next mission from retry',
);
check(
  results.includes("createGeneratedMission({ mode: mission.mode, map: mission.mapId })"),
  'successful debrief creates a fresh generated mission in the same mode/sector',
);
check(
  /if \(!success\) \{[\s\S]*?scene\.start\('MissionBriefing', \{ mission \}\)/.test(results),
  'failed debrief retries the exact mission',
);
check(
  results.includes('recordOperationOutcome(operationOutcome.context, operationOutcome.status, data.resultId)'),
  'final operation debrief uses the same attempt id for idempotent persistence',
);
check(
  results.includes('recordUpdate.duplicate') && results.includes('operationRecord?.duplicate'),
  'duplicate mission and operation debriefs are surfaced without recounting',
);
check(
  recon.includes('this.weatherOverlay?.setPaused(this.paused)') && recon.includes('this.weatherOverlay?.destroy()'),
  'mission weather pauses with recon and is destroyed on scene shutdown',
);
check(
  weather.includes('tick?.remove(false)') && weather.includes('graphics?.destroy()'),
  'weather overlay removes its timer and graphics on destroy',
);
check(
  briefing.includes("CONDITIONS: ${this.mission.condition ?? 'CLEAR'}"),
  'mission briefing surfaces the environmental condition',
);
check(
  main.includes('game.scale.resize(width, height)')
    && main.includes("window.addEventListener('orientationchange'")
    && main.includes("window.visualViewport?.addEventListener('resize'"),
  'mobile/tablet viewport sync follows host dimensions through rotation',
);
check(
  main.includes("new ResizeObserver(queueViewportSync)")
    && main.includes("viewportSyncTimers = [50, 150, 300]"),
  'viewport sync retries after mobile browser layout settles',
);
check(
  main.includes('canvas.getBoundingClientRect()')
    && main.includes("canvas.style.width =")
    && main.includes("canvas.style.height ="),
  'viewport sync corrects the displayed canvas box when Phaser logical size updates first',
);
check(
  intro.includes("addEventListener('touchend', this.onStartPointer")
    && intro.includes("addEventListener('touchend', this.onSkip")
    && intro.includes("removeEventListener('touchend', this.onStartPointer")
    && intro.includes("removeEventListener('touchend', this.onSkip"),
  'intro start/skip carry iPhone Safari touch fallbacks and cleanup',
);

/* --- Start gate ----------------------------------------------------- *
 * The gate is the session's only trusted user gesture. A device that
 * cannot decode or download the intro used to have the gate dismissed for
 * it, which skipped that gesture and left music and SFX locked for the
 * whole run.                                                             */
check(
  /onVideoUnavailable = \(\) => \{\s*this\.videoUsable = false;\s*if \(this\.started\) this\.finish\(\);/.test(intro),
  'an intro media failure before START marks the video unusable instead of dismissing the gate',
);
check(
  /beginIntro\(\) \{[\s\S]*?unlockAudio\(\);[\s\S]*?this\.sound\.unlock\(\);[\s\S]*?musicManager\.unlock\(\);[\s\S]*?unlockSamples\(\);[\s\S]*?if \(!this\.videoUsable/.test(intro),
  'START unlocks every audio channel before it decides whether the intro can play',
);
check(
  intro.includes('PLAYBACK_WATCHDOG_MS') && /this\.watchdog = window\.setTimeout/.test(intro),
  'a requested intro that never starts playing still hands the analyst the console',
);
check(
  intro.includes("this.skipButton.addEventListener('click', this.onSkip)")
    && intro.includes("this.skipButton?.removeEventListener('click', this.onSkip)"),
  'SKIP INTRO answers click as well as pointerdown, and removes both',
);

/* --- Viewport ------------------------------------------------------- *
 * RESIZE mode can record a new parent size and then refresh against the
 * old one, leaving a rotated phone rendering the previous orientation's
 * canvas with nothing left to correct it.                                */
check(
  main.includes('game.scale.resize(width, height)')
    && main.includes('if (currentWidth !== width || currentHeight !== height)'),
  'the app re-syncs the canvas only when it no longer matches the space it fills',
);
check(
  main.includes("window.screen?.orientation?.addEventListener?.('change', queueViewportSync"),
  'viewport sync also follows the Screen Orientation API, which some engines report a rotation through alone',
);
check(
  /canvas\.style\.marginTop = '0px';\s*refitted = true;/.test(main)
    && /if \(refitted\) game\.scale\.updateBounds\(\);/.test(main),
  'moving or resizing the canvas tells the scale manager, so pointer input is not left behind',
);

/* --- Console layout -------------------------------------------------- *
 * A screen shorter than the smallest density tier used to compose past
 * the bottom edge, which put SYSTEM controls where nothing could reach
 * them.                                                                  */
check(
  /for \(let pass = 0; pass < 4 && composed\.total > available; pass \+= 1\)/.test(menu)
    && menu.includes('compressTier(tier, available / composed.total)'),
  'the console compresses its smallest tier rather than composing off-screen',
);
check(
  menu.includes('COMPRESSION_FLOORS') && /systemHeight: 30, systemFont: 8/.test(menu),
  'compression stops at floors that keep controls legible and tappable',
);
check(
  menu.includes('this.systemLabelRatio = this.measureSystemLabelRatio()')
    && menu.includes('systemColumns(tier, innerWidth, this.systemButtons.length, this.systemLabelRatio)'),
  'SYSTEM column count is measured from the rendered label, not estimated',
);
check(
  menu.includes('const shortConsole = height < 470;') && menu.includes('const stackCards = !shortConsole'),
  'a short console keeps the tasking cards on one row instead of stacking them',
);

/* --- Recon rails ------------------------------------------------------ *
 * The compact rails used fixed offsets that assumed a phone at least
 * ~390px wide. Narrower Android phones drew RESET VIEW over MARK TARGET,
 * + over SUBMIT COUNT and MARK CHANGE over PASS A.                        */
check(
  /placeRail\(entries, \{ width, margin = 14, minGap = 10 \} = \{\}\) \{/.test(recon)
    && recon.includes('const scale = Phaser.Math.Clamp((available - minGap * slots) / Math.max(1, requested), 0.1, 1);'),
  'a rail that does not fit shrinks every control in it by the same factor',
);
check(
  (recon.match(/this\.placeRail\(\[/g) ?? []).length >= 5,
  'every compact rail — LOCATE, COUNT, CHANGE and their utility rows — is laid out through the rail',
);
check(
  !/this\.markButton\.setPosition\(compact \? 93/.test(recon)
    && !/this\.resetButton\.setPosition\(compact \? width - 162/.test(recon)
    && !/const groupCentre = compact \?/.test(recon),
  'no compact rail positions a control from a fixed phone-width offset',
);
check(
  recon.includes('fontSize: placed < 118 ? 11 : 13'),
  'SUBMIT COUNT steps its label down when the rail has compressed its button',
);

/* --- Split view teardown --------------------------------------------- *
 * Phaser shuts its camera manager down before the scene's own shutdown
 * handler runs, so unwinding split view from cleanup() threw and took the
 * whole transition with it: finishing a CHANGE mission in split view left
 * the game with no active scene at all.                                   */
check(
  /cleanup\(\) \{[\s\S]*?this\.splitView = false;\s*this\.compareCamera = null;/.test(recon)
    && !/cleanup\(\) \{[\s\S]*?this\.disableSplitView\(false\)/.test(recon),
  'recon cleanup forgets split view instead of unwinding its cameras',
);
check(
  /disableSplitView\(showMessage = true\) \{[\s\S]*?if \(!this\.cameras\?\.main\) \{/.test(recon),
  'disableSplitView bails out safely when the camera manager is already gone',
);

/* --- Keyboard delivery ------------------------------------------------ *
 * Phaser processes its whole key queue on every new key event and clears it
 * only at the next game step, and its own duplicate guard only looks one
 * event back. More than two key events inside a frame therefore re-deliver
 * the earlier ones: one press moved a COUNT tally by three or five, and ESC
 * toggled the hold an even number of times and looked like a dead key.     */
{
  let runs = 0;
  const handler = oncePerKeyEvent('qa', () => { runs += 1; });
  const event = { key: 'ArrowUp' };
  handler(event);
  handler(event);
  handler(event);
  check(runs === 1, `a re-delivered key event runs its handler once, not ${runs}`);

  let second = 0;
  oncePerKeyEvent('qa-other', () => { second += 1; })(event);
  check(second === 1, 'a second handler still sees a key event the first one has taken');

  let fresh = 0;
  const counter = oncePerKeyEvent('qa-fresh', () => { fresh += 1; });
  counter({ key: 'ArrowUp' });
  counter({ key: 'ArrowUp' });
  check(fresh === 2, `two separate presses run the handler twice, not ${fresh}`);

  check(
    Object.keys(event).length === 1,
    'the guard stamps events without making the mark enumerable',
  );
}
check(
  /keydown-ESC', oncePerKeyEvent\('recon-esc'/.test(recon)
    && /'keydown', oncePerKeyEvent\('recon-key'/.test(recon),
  'both recon key handlers are guarded against re-delivery',
);
check(
  /keydown-ESC', oncePerKeyEvent\('menu-esc'/.test(menu)
    && /keydown-ESC', oncePerKeyEvent\('guide-esc'/.test(guide),
  'the console and the guide guard their ESC handlers',
);
check(
  focusGroup.includes('const onKeyDownOnce = oncePerKeyEvent(')
    && focusGroup.includes("scene.input.keyboard?.on('keydown', onKeyDownOnce)")
    && focusGroup.includes("scene.input.keyboard?.off('keydown', onKeyDownOnce)"),
  'the focus ring guards its key handler and detaches the same function it attached',
);

/* --- Scene data ------------------------------------------------------ */
check(
  !/^\s*this\.data = data;/m.test(results) && results.includes('this.debrief = data;'),
  'the debrief payload does not overwrite the scene data manager',
);

check(
  recon.includes('pinchPointers(pointers = this.mapPointersDown())')
    && recon.includes('beginPinch(pointers = this.mapPointersDown())')
    && recon.includes('stepPinchGesture(pointers = this.mapPointersDown())')
    && recon.includes('finishPinch(remaining = [])')
    && recon.includes('this.pinchGesture.pointerIds')
    && recon.includes('camera.zoom * scaleRatio'),
  'ReconScene keeps stable touch IDs and applies incremental two-finger transforms',
);
check(
  /pinchPointers\(pointers[\s\S]*?this\.pinchGesture\.pointerIds\.map\(\(id\) => byId\.get\(id\)\)/.test(recon)
    && /releasePointer = \(pointer, allowTap\) => \{[\s\S]*?if \(!this\.pinchGesture\.pointerIds\.includes\(pointer\.id\)\) return;/.test(recon)
    && /pointerdown'[\s\S]*?if \(this\.pinchGesture\) return;[\s\S]*?const active = this\.mapPointersDown\(\);/.test(recon),
  'a pinch keeps the two contacts it captured: a third or reordered finger can neither join it nor end it',
);
check(
  /pointermove'[\s\S]*?this\.pinchGesture\.dirty = true;[\s\S]*?this\.panGestureDirty = true;/.test(recon)
    && /update\(\) \{[\s\S]*?this\.stepPinchGesture\(\);[\s\S]*?this\.stepPanGesture\(\);/.test(recon),
  'raw Android pointer events only mark a gesture dirty; the camera transform is sampled once per game frame',
);
check(
  recon.includes('panStepMax')
    && recon.includes('touchPanStepMax')
    && recon.includes('pinchDistanceDeadZone')
    && recon.includes('pinchMidpointDeadZone')
    && recon.includes('pinchScaleStepMin')
    && recon.includes('pinchScaleStepMax')
    && recon.includes('pinchPanStepMax'),
  'Android pan and pinch filter jitter and bound the per-frame zoom and pan delta',
);
check(
  recon.includes('isGestureBlockedPointer(pointer)')
    && recon.includes('isTopHudPoint(pointer)')
    && recon.includes('this.controlPointerIds.has(pointer.id)')
    && !/mapPointersDown\(\) \{[\s\S]*?!this\.isHudPoint\(pointer\)/.test(recon),
  'map gestures block the top HUD and actual control pointers, never the whole COUNT/CHANGE bottom rail',
);
check(
  recon.includes("this.input.on('pointerupoutside', (pointer) => releasePointer(pointer, false))")
    && recon.includes("this.input.on('pointercancel', (pointer) => releasePointer(pointer, false))")
    && recon.includes("addEventListener('touchcancel', this.nativeGestureCancel")
    && recon.includes("addEventListener('pointercancel', this.nativeGestureCancel")
    && recon.includes("removeEventListener('touchcancel', this.nativeGestureCancel")
    && recon.includes("removeEventListener('pointercancel', this.nativeGestureCancel")
    && recon.includes('cancelActiveMapGesture()'),
  'every way a touch can end clears gesture ownership, and its DOM listeners come off at shutdown',
);
check(
  recon.includes('this.stepPanGesture(pointer)')
    && recon.includes('this.stepPinchGesture([pointer, ...remaining])')
    && recon.includes('stepPanGesture(pointerOverride = null)'),
  'a fast pan or pinch flushes its final coordinates even after the contact is no longer down',
);
check(
  /finishPinch\(remaining = \[\]\) \{[\s\S]*?remaining\.length === 1[\s\S]*?this\.lastPointer = \{ x: pointer\.x, y: pointer\.y \};/.test(recon),
  'lifting one finger rebases the survivor before one-finger panning resumes, so the map cannot jump',
);
check(
  /beginPinch\(pointers[\s\S]*?const firstContext = this\.getPointerContext\(first\);[\s\S]*?const secondContext = this\.getPointerContext\(second\);[\s\S]*?if \(firstContext\.camera !== secondContext\.camera\) return false;/.test(recon),
  'a CHANGE split-view pinch needs both fingers on one imagery camera, never one per pane',
);
check(
  recon.includes('cameraScrollLimits(camera = this.cameras.main)')
    && recon.includes('clampCameraScroll(camera = this.cameras.main)')
    && recon.includes('camera.clampX(camera.scrollX)')
    && recon.includes('camera.clampY(camera.scrollY)')
    && (recon.match(/this\.clampCameraScroll\(/g) ?? []).length >= 6,
  'pan, pinch, wheel zoom, split sync, reset and resize all settle the camera inside its map bounds',
);
check(
  /onResize\(gameSize\)[\s\S]*?setViewport\(0, 0, half, height\)[\s\S]*?const floor = this\.minZoomForCamera\(this\.cameras\.main\);/.test(recon)
    && !/onResize\(gameSize\) \{\s*\n\s*const \{ width, height \} = gameSize;\s*\n\s*this\.uiCamera\?\.setSize\(width, height\);\s*\n\s*const floor/.test(recon),
  'resize applies the imagery viewport before it computes and enforces that viewport zoom floor',
);
check(
  !/pointers\.length !== 2 \|\| this\.paused \|\| this\.marking/.test(recon)
    && recon.includes('this.tapPointer = null;')
    && recon.includes('this.dragPointerId = null;'),
  'pinch remains available while marking and cancels tap/pan interpretation',
);
check(
  recon.includes('this.completedTargetIds = []')
    && recon.includes('CONTACT CONFIRMED //')
    && recon.includes('this.locateTargets.length > 1'),
  'generated LOCATE can continue through multiple required contacts before mission completion',
);

/* --- Handover and press ownership -------------------------------------- *
 * The gate is a DOM layer over a canvas and has to act on pointerdown, so it
 * is gone while the finger is still down and the browser's compatibility
 * mouse cascade lands on the console underneath. And a press belongs to the
 * pointer that made it: the release safety nets used to fire for any pointer,
 * so a second finger lifting cancelled the press the analyst was holding.   */
check(
  intro.includes('function shieldHandover(host)')
    && /finish\(\) \{[\s\S]*?shieldHandover\([\s\S]*?this\.destroyOverlay\(\);/.test(intro),
  'the start gate raises its handover shield before it comes down',
);
check(
  /if \(this\.dismissedByPress\) \{\s*this\.dismissedByPress = false;\s*shieldHandover\(/.test(intro)
    && intro.includes('this.dismissedByPress = true;'),
  'the shield is raised only for a press, which is the only dismissal with a tail to guard',
);
check(
  intro.includes("shield.className = 'intro-handover'")
    && /SHIELD_EVENTS[\s\S]*?'mousedown', 'mouseup', 'click'/.test(intro)
    && intro.includes('event.preventDefault();'),
  'the shield swallows the compatibility mouse cascade, not just clicks',
);
check(
  /\.intro-handover \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;/.test(styles)
    && /\.intro-handover \{[\s\S]*?z-index: 101;/.test(styles),
  'the shield covers the console it is guarding',
);
check(
  button.includes('const ownsPress = (pointer) => armedContact === null || armedContact === contactKey(pointer);')
    && /const onSceneRelease = \(pointer\) => \{\s*if \(!ownsPress\(pointer\)\) return;/.test(button)
    && /background\.on\('pointerout', \(pointer\) => \{\s*if \(!ownsPress\(pointer\)\) return;/.test(button),
  'only the contact that armed a control can release it',
);
check(
  button.includes('let armLock = null;')
    && button.includes('if (lockHeldByAnother(background)) return;')
    && button.includes('if (armLock.pointer?.isDown) return true;')
    && (button.match(/releaseLock\(background\)/g) ?? []).length >= 6,
  'one control at a time, and a lock whose pointer is gone is taken over rather than stranding the console',
);

/* --- Navigation -------------------------------------------------------- *
 * ESC means the same thing everywhere: back out of where you are. The
 * mission scenes hold it for pause; the screens that are only navigation
 * had no binding at all, so the key did nothing on three of them.          */
check(
  /keydown-ESC', oncePerKeyEvent\('briefing-esc'/.test(briefing)
    && /keydown-ESC', oncePerKeyEvent\('results-esc'/.test(results)
    && /keydown-ESC', oncePerKeyEvent\('record-esc'/.test(record),
  'the briefing, the debrief and the analyst record all return on ESC',
);
check(
  /oncePerKeyEvent\('briefing-esc', \(\) => \{\s*if \(!this\.transitioning\)/.test(briefing),
  'ESC on the briefing respects the same transition guard ACQUIRE IMAGERY does',
);

/* --- Touch targets ---------------------------------------------------- *
 * A control shorter than the 44px minimum grows its hit area to reach it.
 * Two grown hit areas that meet are worse than two small ones: Phaser gives
 * the shared pixels to whichever control is drawn last, so a press on the
 * edge of one silently ran its neighbour. Every packed row and column tells
 * the button how much of its gap the padding may take.                      */
check(
  /export function touchPadding\(size, limit = UI_TOKENS\.metrics\.maxHitPadding\)/.test(tokens)
    && tokens.includes('Math.min(UI_TOKENS.metrics.maxHitPadding, limit)'),
  'hit padding is capped by the room its own layout says it has',
);
check(
  button.includes('hitPaddingX: options.hitPaddingX ?? UI_TOKENS.metrics.maxHitPadding')
    && button.includes('touchPadding(size.width, size.hitPaddingX)')
    && button.includes('touchPadding(size.height, size.hitPaddingY)'),
  'the shared button takes a per-axis hit padding limit and applies it on every resize',
);
check(
  recon.includes('const pad = hitGap(gap);')
    && recon.includes('entry.place(Math.round(cursor + entryWidth / 2), entryWidth, pad)')
    && (recon.match(/hitPaddingX: pad/g) ?? []).length >= 5,
  'every rail control is padded only into the gap the rail left it',
);
check(
  /hitPaddingX: hitGap\(tabGap\),\s*hitPaddingY: hitGap\(tabGap\),/.test(guide),
  'the guide category tabs are padded only into the gap between them',
);
check(
  /export function hitGap\(gap\)/.test(tokens)
    && !/^function hitGap\(/m.test(menu) && !/^function hitGap\(/m.test(recon),
  'hitGap lives with touchPadding, which it bounds, rather than being copied per scene',
);
check(
  menu.includes('const stackPad = hitGap(sectorGap(tier));')
    && (menu.match(/hitPadding[XY]: (stackPad|hitGap\()/g) ?? []).length >= 6,
  'every stacked console control is padded only into the gap below it',
);

check(
  button.includes('function contactKey(pointer)')
    && button.includes('armedContact = contactKey(pointer)')
    && button.includes("armedContact === contactKey(pointer)")
    && !button.includes('armedPointerId'),
  'a control matches its release to the contact that armed it, not to the pointer object Phaser routed it through',
);
check(
  main.includes('releaseStrandedTouchPointers')
    && /onTouchSequenceEnd\(event\) \{[\s\S]*?if \(event\.touches\?\.length\) return;/.test(main)
    && main.includes("window.addEventListener('touchend', onTouchSequenceEnd")
    && main.includes("window.addEventListener('touchcancel', onTouchSequenceEnd")
    && main.includes('setTimeout(releaseStrandedTouchPointers, 0)'),
  'a touch sequence that ends with no contacts left releases any pointer the browser stopped reporting',
);

/* --- Hold screen and the in-mission recognition manual ----------------- */
check(
  recon.includes('createPauseMenu()')
    && recon.includes("createButton(this, 0, 0, 'RESUME'")
    && recon.includes("createButton(this, 0, 0, 'IDENTIFICATION GUIDE'")
    && recon.includes("createButton(this, 0, 0, 'ABORT MISSION'")
    && recon.includes("createButton(this, 0, 0, 'CONFIRM ABORT'")
    && recon.includes("createButton(this, 0, 0, 'KEEP ANALYSING'"),
  'holding a mission opens a menu whose controls each carry one fixed label',
);
check(
  /armAbort\(armed\) \{[\s\S]*?this\.abortArmed = armed;/.test(recon)
    && recon.includes("this.abortButton = createButton(this, 0, 0, 'ABORT MISSION', () => this.armAbort(true)")
    && recon.includes("this.abortConfirmButton = createButton(this, 0, 0, 'CONFIRM ABORT', () => this.abortMission()")
    && recon.includes("this.abortCancelButton = createButton(this, 0, 0, 'KEEP ANALYSING', () => this.armAbort(false)"),
  'aborting asks for confirmation instead of acting on the first press',
);
// Read the method's own body: `finishMission` and `Results` appear all over
// this file, so a lazy match from the method name proves nothing about it.
const abortBody = (recon.match(/\n  abortMission\(\) \{([\s\S]*?)\n  \}/) ?? [])[1] ?? '';
check(
  abortBody.includes('this.missionEnded = true;')
    && abortBody.includes('this.timerEvent?.remove(false);')
    && abortBody.includes("this.scene.start('MainMenu');")
    && !abortBody.includes('finishMission')
    && !abortBody.includes("'Results'"),
  'an abandoned attempt goes straight to the console, never through the debrief',
);
check(
  recon.includes('setRailHidden(hidden)')
    && recon.includes('this.railVisibilityBeforeHold')
    && recon.includes('holdableButtons()')
    && recon.includes('holdableFurniture()'),
  'the console rail leaves while the hold screen is up and returns exactly as it was',
);
check(
  /openIdentificationGuide\(\) \{[\s\S]*?if \(!this\.paused\) this\.togglePause\(\);[\s\S]*?this\.setConsoleInputEnabled\(false\);[\s\S]*?this\.scene\.launch\('IdentificationGuide', \{ returnTo: this\.scene\.key \}\);/.test(recon)
    && recon.includes('closeIdentificationGuide()')
    && /setConsoleInputEnabled\(enabled\) \{[\s\S]*?this\.input\.keyboard\.enabled = enabled;/.test(recon),
  'the manual opens over a held mission and the console underneath stops answering input',
);
check(
  guide.includes('this.returnTo = data.returnTo ?? null;')
    && /leave\(\) \{[\s\S]*?const caller = this\.scene\.get\(this\.returnTo\);[\s\S]*?this\.scene\.stop\(\);[\s\S]*?caller\?\.closeIdentificationGuide\?\.\(\);/.test(guide)
    && !guide.includes("() => this.scene.start('MainMenu')")
    && guide.includes("if (!this.returnTo) musicManager.request(MUSIC_STATES.MENU);"),
  'the manual returns to the mission that opened it, and leaves its music alone',
);
check(
  /layoutPauseMenu\(width, height\) \{[\s\S]*?this\.pauseTitle\.setFontSize[\s\S]*?setWordWrapWidth\(rowWidth\)[\s\S]*?const headerHeight = Math\.ceil\(this\.pauseTitle\.height/.test(recon)
    && /while \(heightFor\(rowHeight, gap\) > available/.test(recon)
    && /onResize\(gameSize\)[\s\S]*?this\.layoutPauseMenu\(width, height\);/.test(recon),
  'the hold screen measures its own header and gives way on height, so a rotated phone keeps every control reachable',
);
check(
  /cleanup\(\) \{[\s\S]*?if \(this\.guideOpen\) \{[\s\S]*?this\.scene\.stop\('IdentificationGuide'\);/.test(recon),
  'a console that is shutting down takes the manual with it',
);

const appBlock = (styles.match(/#app\s*\{[^}]*\}/) ?? [''])[0];
const canvasBlock = (styles.match(/\bcanvas\s*\{[^}]*\}/) ?? [''])[0];
const suppressesNativeTouch = (block) => /touch-action:\s*none;/.test(block)
  && /overscroll-behavior:\s*none;/.test(block)
  && /user-select:\s*none;/.test(block)
  && /-webkit-user-select:\s*none;/.test(block);
check(
  suppressesNativeTouch(appBlock)
    && suppressesNativeTouch(canvasBlock)
    && /-webkit-touch-callout:\s*none;/.test(canvasBlock),
  'game host and canvas explicitly suppress browser-native Android touch, scroll and selection gestures',
);

if (failures.length) {
  console.error(`I SPY scene lifecycle QA failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`I SPY scene lifecycle QA passed: ${total} mission, start-gate, viewport, console-layout, recon-rail, touch-target, split-view, keyboard, weather and persistence checks.`);
}
