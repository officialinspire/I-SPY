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
const intro = read('src/scenes/StartIntroScene.js');
const main = read('src/main.js');
const weather = read('src/ui/weatherOverlay.js');

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
  intro.includes("addEventListener('touchend', this.onStartPointer")
    && intro.includes("addEventListener('touchend', this.onSkip")
    && intro.includes("removeEventListener('touchend', this.onStartPointer")
    && intro.includes("removeEventListener('touchend', this.onSkip"),
  'intro start and skip retain explicit iPhone Safari touch fallbacks and cleanup',
);
check(
  main.includes("new ResizeObserver(queueViewportSync)")
    && main.includes("game.scale.setGameSize(width, height)")
    && main.includes("window.visualViewport?.addEventListener('resize', queueViewportSync"),
  'game host resynchronizes Phaser dimensions across mobile viewport and orientation changes',
);
check(
  briefing.includes("CONDITIONS: ${this.mission.condition ?? 'CLEAR'}"),
  'mission briefing surfaces the environmental condition',
);

if (failures.length) {
  console.error(`I SPY scene lifecycle QA failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('I SPY scene lifecycle QA passed: 16 repeat-mission, viewport/touch, weather-lifecycle, and debrief-idempotency checks.');
}
