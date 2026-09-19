import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const music = read('src/audio/musicManager.js');
const samples = read('src/audio/sampleFeedback.js');
const intro = read('src/scenes/StartIntroScene.js');
const recon = read('src/scenes/EnhancedReconScene.js');
const settings = read('src/settings/userSettings.js');

check(music.includes("MENU: 'MENU'") && music.includes("GAMEPLAY: 'GAMEPLAY'") && music.includes("SILENT: 'SILENT'"), 'music state contract is complete');
check(music.includes('if (nextState === this.state) return'), 'repeated music states are idempotent');
check(music.includes('cancelFade()') && music.includes('generation !== this.fadeGeneration'), 'superseded music fades are cancelled and guarded');
check(music.includes("addEventListener('visibilitychange'"), 'music handles page visibility lifecycle');
check(samples.includes('if (!sample.paused && !sample.ended) return false'), 'sample playback cannot stack');
check(samples.includes('now - previous < COOLDOWN_MS[eventName]'), 'sample playback has repeat guards');
check(samples.includes('settings.sfxEnabled') && samples.includes('settings.masterVolume'), 'samples obey SFX and master settings');
check(recon.includes('this.candidate?.entity') && recon.includes('TARGET_ACQUIRED'), 'acquired sample requires a resolved entity');
check(recon.includes('if (result.correct) sampleFeedback') && recon.includes("else feedback('error')"), 'secured and error feedback are mutually exclusive');
check(intro.includes('if (this.started || this.finished) return') && intro.includes('if (this.finished) return'), 'startup and completion are idempotent');
check(intro.includes('removeEventListener') && intro.includes('this.video = null'), 'intro media listeners and references are cleaned up');
check(settings.includes('musicEnabled: true') && settings.includes('sfxEnabled: true'), 'music and SFX persist independently');

if (failures.length) {
  console.error(`I SPY audio QA failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('I SPY audio QA passed: 12 lifecycle and feedback checks.');
}
