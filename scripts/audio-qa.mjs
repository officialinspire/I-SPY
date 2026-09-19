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
const briefing = read('src/scenes/MissionBriefingScene.js');
const buttons = read('src/ui/createButton.js');
const menu = read('src/scenes/MainMenuScene.js');
const settings = read('src/settings/userSettings.js');

check(music.includes("I-Spy-Main-Menu-Theme.mp3?url") && music.includes("I-Spy-Gameplay-Theme.mp3?url"), 'music manager uses the intended bundled menu/gameplay themes');
check(music.includes("MENU: 'MENU'") && music.includes("GAMEPLAY: 'GAMEPLAY'") && music.includes("SILENT: 'SILENT'"), 'music state contract is complete');
check(music.includes('if (nextState === this.state) return'), 'repeated music states are idempotent');
check(music.includes('cancelFade()') && music.includes('generation !== this.fadeGeneration'), 'superseded music fades are cancelled and guarded');
check(music.includes("addEventListener('visibilitychange'"), 'music handles page visibility lifecycle');
check(samples.includes("Target acquired (Counter Strike Bot Call) - Sound Effect for editing.mp3?url"), 'target acquired MP3 is wired from the intended bundled asset');
check(samples.includes("Target secured - Sound Effect.mp3?url"), 'target secured MP3 is wired from the intended bundled asset');
check(samples.includes('if (!sample.paused && !sample.ended) return false'), 'sample playback cannot stack');
check(samples.includes('stopOtherSamples(eventName)'), 'target acquired/secured share one mutually exclusive voice channel');
check(samples.includes('now - previous < COOLDOWN_MS[eventName]'), 'sample playback has repeat guards');
check(samples.includes('settings.sfxEnabled') && samples.includes('settings.masterVolume'), 'samples obey SFX and master settings');
check(recon.includes('this.candidate?.entity') && recon.includes('TARGET_ACQUIRED'), 'target acquired sample fires only for a resolved selectable entity');
check(recon.includes('if (result.correct) sampleFeedback') && recon.includes('TARGET_SECURED') && recon.includes("else feedback('error')"), 'target secured sample is correct-confirm only and mutually exclusive with error feedback');
check(buttons.includes("feedback(options.pressSound ?? 'press')"), 'buttons provide a default menu click/press SFX');
check(buttons.includes("feedback('hover')") && buttons.includes('pointer?.wasTouch'), 'desktop hover has subtle SFX and touch does not fake hover audio');
check(menu.includes("pressSound: 'toggle'") && menu.includes("feedback('toggle')"), 'settings selections use the terminal toggle SFX');
check(menu.includes("pressSound: false") && menu.includes('toggleFeedbackSetting') && menu.includes('cycleHaptics'), 'state-changing feedback settings avoid duplicate old-state cues');
check(intro.includes('musicManager.unlock()') && intro.includes('unlockSamples()'), 'trusted start gesture unlocks music and sample channels');
check(intro.includes('if (this.started || this.finished) return') && intro.includes('if (this.finished) return'), 'startup and completion are idempotent');
check(intro.includes('removeEventListener') && intro.includes('this.video = null'), 'intro media listeners and references are cleaned up');
check(/create\(data = \{\}\) \{[\s\S]*?this\.transitioning = false;[\s\S]*?musicManager\.request/.test(briefing), 'mission briefing resets its transition guard on every scene create');
check(settings.includes('musicEnabled: true') && settings.includes('sfxEnabled: true'), 'music and SFX persist independently');

if (failures.length) {
  console.error(`I SPY audio QA failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('I SPY audio QA passed: 22 lifecycle, asset, SFX and feedback checks.');
}
