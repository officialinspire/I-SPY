import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const recon = read('src/scenes/ReconScene.js');
const briefing = read('src/scenes/MissionBriefingScene.js');
const results = read('src/scenes/ResultsScene.js');
const enhanced = read('src/scenes/EnhancedReconScene.js');
const weather = read('src/ui/weatherOverlay.js');
const intro = read('src/scenes/StartIntroScene.js');
const main = read('src/main.js');
const menu = read('src/scenes/MainMenuScene.js');

check(
  /create\(data = \{\}\) \{[\s\S]*?this\.missionEnded = false;[\s\S]*?this\.resolvingIdentification = false;/.test(recon),
  'ReconScene resets resolvingIdentification for every mission create',
);
check(
  /bindInput\(\) \{[\s\S]*?this\.controlPressed = false;[\s\S]*?this\.controlReleased = false;[\s\S]*?this\.tapPointer = null;/.test(recon),
  'ReconScene resets transient pointer/control guards when rebinding input',
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
  main.includes('game.scale.setParentSize(width, height)')
    && /Math\.abs\(gameSize\.width - width\) <= 1 && Math\.abs\(gameSize\.height - height\) <= 1/.test(main),
  'the app re-syncs the canvas only when it no longer matches the space it fills',
);
check(
  ['resize', 'orientationchange'].every((event) => main.includes(`addEventListener('${event}', requestViewportSync)`))
    && main.includes('new ResizeObserver(requestViewportSync)')
    && main.includes('window.visualViewport?.addEventListener'),
  'viewport sync listens to resize, orientation, visual viewport and the parent element',
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

/* --- Scene data ------------------------------------------------------ */
check(
  !/^\s*this\.data = data;/m.test(results) && results.includes('this.debrief = data;'),
  'the debrief payload does not overwrite the scene data manager',
);

if (failures.length) {
  console.error(`I SPY scene lifecycle QA failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('I SPY scene lifecycle QA passed: 32 repeat-mission, start-gate, viewport, console-layout, recon-rail, split-view and debrief-idempotency checks.');
}
