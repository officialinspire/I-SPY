import { getSettings } from '../settings/userSettings.js';

let audioContext = null;

function getContext() {
  if (audioContext) return audioContext;
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextCtor) return null;
  try { audioContext = new AudioContextCtor(); } catch { audioContext = null; }
  return audioContext;
}

export function unlockAudio() {
  const context = getContext();
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});
}

function tone(frequency, durationMs, gainValue, offsetMs = 0, type = 'square') {
  const settings = getSettings();
  if (!settings.sfxEnabled || settings.masterVolume <= 0) return;
  const context = getContext();
  if (!context || context.state === 'closed') return;
  const start = context.currentTime + offsetMs / 1000;
  const stop = start + durationMs / 1000;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue * settings.masterVolume), start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(stop + 0.01);
  } catch { /* unsupported audio path */ }
}

export function playFeedback(eventName) {
  unlockAudio();
  switch (eventName) {
    case 'button':
      tone(620, 42, 0.035, 0, 'square');
      break;
    case 'mark':
      tone(460, 55, 0.045, 0, 'square');
      break;
    case 'confirm':
      tone(520, 70, 0.05, 0, 'square');
      tone(780, 95, 0.045, 72, 'square');
      break;
    case 'error':
      tone(180, 105, 0.05, 0, 'sawtooth');
      tone(145, 120, 0.035, 88, 'sawtooth');
      break;
    case 'acquire':
      tone(330, 65, 0.035, 0, 'square');
      tone(495, 65, 0.04, 68, 'square');
      tone(660, 90, 0.04, 136, 'square');
      break;
    case 'countdown':
      tone(360, 55, 0.035, 0, 'square');
      break;
    case 'complete':
      tone(440, 80, 0.045, 0, 'square');
      tone(660, 90, 0.05, 88, 'square');
      tone(880, 120, 0.045, 182, 'square');
      break;
    case 'fail':
      tone(260, 100, 0.045, 0, 'sawtooth');
      tone(195, 130, 0.045, 105, 'sawtooth');
      break;
    default:
      break;
  }
}

export function haptic(pattern = 10) {
  const settings = getSettings();
  if (!settings.hapticsEnabled) return;
  try {
    if (typeof globalThis.navigator?.vibrate === 'function') globalThis.navigator.vibrate(pattern);
  } catch { /* unsupported haptics */ }
}

export function feedback(eventName, vibration = null) {
  playFeedback(eventName);
  if (vibration !== null) haptic(vibration);
}
