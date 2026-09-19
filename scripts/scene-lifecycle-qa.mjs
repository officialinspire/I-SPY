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

check(
  /create\(data = \{\}\) \{[\s\S]*?this\.missionEnded = false;[\s\S]*?this\.resolvingIdentification = false;/.test(recon),
  'ReconScene resets resolvingIdentification for every mission create',
);
check(
  /bindInput\(\) \{[\s\S]*?this\.controlPressed = false;[\s\S]*?this\.controlReleased = false;[\s\S]*?this\.tapPointer = null;/.test(recon),
  'ReconScene resets transient pointer/control guards when rebinding input',
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

if (failures.length) {
  console.error(`I SPY scene lifecycle QA failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('I SPY scene lifecycle QA passed: 6 repeat-mission checks.');
}
