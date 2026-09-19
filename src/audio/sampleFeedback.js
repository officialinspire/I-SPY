import acquiredUrl from '../../Target acquired (Counter Strike Bot Call) - Sound Effect for editing.mp3?url';
import securedUrl from '../../Target secured - Sound Effect.mp3?url';
import { getSettings, subscribeSettings } from '../settings/userSettings.js';
import { haptic, HAPTICS } from './feedback.js';

export const SAMPLE_EVENTS = Object.freeze({
  TARGET_ACQUIRED: 'targetAcquired',
  TARGET_SECURED: 'targetSecured',
});

const SAMPLE_GAIN = Object.freeze({
  [SAMPLE_EVENTS.TARGET_ACQUIRED]: 0.72,
  [SAMPLE_EVENTS.TARGET_SECURED]: 0.78,
});
const COOLDOWN_MS = Object.freeze({
  [SAMPLE_EVENTS.TARGET_ACQUIRED]: 420,
  [SAMPLE_EVENTS.TARGET_SECURED]: 900,
});

let samples = null;
let unlockAttempted = false;
const lastPlayed = new Map();

subscribeSettings((settings) => {
  if (!samples) return;
  Object.entries(samples).forEach(([eventName, sample]) => {
    sample.volume = Math.max(0, Math.min(1, settings.masterVolume * SAMPLE_GAIN[eventName]));
    if (!settings.sfxEnabled || settings.masterVolume <= 0) {
      sample.pause();
      sample.currentTime = 0;
    }
  });
});

function ensureSamples() {
  if (samples || typeof Audio === 'undefined') return samples;
  const makeSample = (url) => {
    const audio = new Audio(url);
    audio.preload = 'auto';
    return audio;
  };
  samples = {
    [SAMPLE_EVENTS.TARGET_ACQUIRED]: makeSample(acquiredUrl),
    [SAMPLE_EVENTS.TARGET_SECURED]: makeSample(securedUrl),
  };
  return samples;
}

/** Prime both cached elements from the same trusted gesture as the intro. */
export function unlockSamples() {
  const players = ensureSamples();
  if (!players || unlockAttempted) return;
  unlockAttempted = true;
  Object.values(players).forEach((sample) => {
    sample.load();
    sample.muted = true;
    const attempt = sample.play();
    if (!attempt?.then) {
      sample.pause();
      sample.muted = false;
      return;
    }
    attempt.then(() => {
      // Unlock happens during the intro, before target feedback is possible.
      sample.pause();
      sample.currentTime = 0;
      sample.muted = false;
    }).catch(() => { sample.muted = false; });
  });
}

function stopOtherSamples(eventName) {
  if (!samples) return;
  Object.entries(samples).forEach(([name, player]) => {
    if (name === eventName) return;
    player.pause();
    player.currentTime = 0;
  });
}

/**
 * Play a mission sample on one exclusive target-voice channel.
 *
 * Acquired/secured can never overlap each other, and a repeated request for
 * the same clip while it is already speaking is ignored. Haptics remain
 * independent of the file channel, so disabling SFX does not remove tactile
 * confirmation.
 */
export function sampleFeedback(eventName) {
  const players = ensureSamples();
  const sample = players?.[eventName];
  if (!sample) return false;

  const hapticEvent = eventName === SAMPLE_EVENTS.TARGET_SECURED ? 'confirm' : 'select';
  haptic(HAPTICS[hapticEvent]);

  const settings = getSettings();
  if (!settings.sfxEnabled || settings.masterVolume <= 0) return false;

  const now = globalThis.performance?.now?.() ?? Date.now();
  const previous = lastPlayed.get(eventName);
  if (previous !== undefined && now - previous < COOLDOWN_MS[eventName]) return false;
  if (!sample.paused && !sample.ended) return false;

  stopOtherSamples(eventName);
  lastPlayed.set(eventName, now);
  sample.currentTime = 0;
  sample.volume = Math.max(0, Math.min(1, settings.masterVolume * SAMPLE_GAIN[eventName]));
  try {
    const playback = sample.play();
    playback?.catch?.(() => {});
  } catch { /* media playback is optional; gameplay continues */ }
  return true;
}
