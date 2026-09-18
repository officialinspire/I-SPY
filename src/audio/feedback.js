import { getSettings } from '../settings/userSettings.js';

/**
 * Procedural feedback engine.
 *
 * Everything is synthesised at runtime — no audio files, no dependencies. The
 * vocabulary is deliberately small and dry: relay clicks, short square blips
 * and filtered noise, the way a 1980s imaging workstation would acknowledge an
 * input. Nothing sweeps, nothing rings out, nothing lasts past ~220ms.
 *
 * Every cue is named for the event that causes it, so a caller asks for
 * `feedback('cancel')` rather than describing a waveform, and one event can
 * never be voiced twice by two different call sites.
 */

let audioContext = null;
let noiseBuffer = null;

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

function audioReady() {
  const settings = getSettings();
  if (!settings.sfxEnabled || settings.masterVolume <= 0) return null;
  const context = getContext();
  if (!context || context.state === 'closed') return null;
  return { context, volume: settings.masterVolume };
}

/**
 * One oscillator voice. `slideTo` bends the pitch across the note, which is
 * what gives the arm/hold cues their mechanical rise and fall.
 */
function tone(frequency, durationMs, gainValue, offsetMs = 0, type = 'square', slideTo = null) {
  const ready = audioReady();
  if (!ready) return;
  const { context, volume } = ready;
  const start = context.currentTime + offsetMs / 1000;
  const stop = start + durationMs / 1000;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.linearRampToValueAtTime(slideTo, stop);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue * volume), start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(stop + 0.01);
  } catch { /* unsupported audio path */ }
}

/**
 * Band-limited noise burst: the contact click inside a relay or a switch.
 * Falls back silently when a browser lacks filters or buffer sources.
 */
function click(durationMs, gainValue, offsetMs = 0, centre = 1800) {
  const ready = audioReady();
  if (!ready) return;
  const { context, volume } = ready;
  try {
    if (!noiseBuffer) {
      const frames = Math.max(1, Math.floor(context.sampleRate * 0.12));
      noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
      const channel = noiseBuffer.getChannelData(0);
      let seed = 0x9e3779b9;
      for (let i = 0; i < frames; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        channel[i] = (seed / 0x80000000) - 1;
      }
    }
    const start = context.currentTime + offsetMs / 1000;
    const stop = start + durationMs / 1000;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centre, start);
    filter.Q.setValueAtTime(0.9, start);
    const gain = context.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, gainValue * volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(start);
    source.stop(stop + 0.01);
  } catch { /* unsupported audio path */ }
}

/** Named cues. Keep them short, dry and few. */
const VOICES = Object.freeze({
  hover: () => tone(880, 14, 0.008),
  focus: () => tone(520, 22, 0.014),
  press: () => { tone(620, 32, 0.03); click(14, 0.02, 0, 2600); },
  card: () => { tone(430, 38, 0.032); tone(645, 24, 0.022, 36); },
  toggle: () => { click(12, 0.022, 0, 2200); tone(520, 26, 0.024, 10); },

  arm: () => tone(300, 72, 0.038, 0, 'square', 520),
  select: () => { click(18, 0.026, 0, 1500); tone(520, 34, 0.032, 8); },
  cancel: () => { tone(430, 38, 0.028); tone(300, 54, 0.026, 40); },
  confirm: () => { tone(520, 62, 0.046); tone(780, 88, 0.042, 64); },
  error: () => { tone(180, 96, 0.046, 0, 'sawtooth'); tone(146, 110, 0.032, 82, 'sawtooth'); },

  relay: () => { click(22, 0.03, 0, 1200); tone(240, 34, 0.028, 12); },
  tickUp: () => tone(700, 14, 0.02),
  tickDown: () => tone(560, 14, 0.02),
  submit: () => { click(26, 0.028, 0, 900); tone(300, 58, 0.038, 8); },

  hold: () => tone(420, 84, 0.03, 0, 'square', 300),
  resume: () => tone(300, 84, 0.03, 0, 'square', 430),

  acquire: () => { tone(330, 58, 0.034); tone(495, 58, 0.038, 62); tone(660, 82, 0.038, 124); },
  countdown: () => tone(360, 48, 0.032),
  complete: () => { tone(440, 74, 0.042); tone(660, 84, 0.046, 80); tone(880, 112, 0.042, 168); },
  fail: () => { tone(260, 96, 0.042, 0, 'sawtooth'); tone(195, 124, 0.042, 100, 'sawtooth'); },
});

/** Haptics stay sparing: a selection tick, and patterns only for outcomes. */
const HAPTICS = Object.freeze({
  press: 8,
  card: 8,
  toggle: 8,
  arm: 10,
  select: 12,
  cancel: 8,
  confirm: [12, 18, 20],
  error: [18, 26, 18],
  relay: 8,
  tickUp: 6,
  tickDown: 6,
  submit: 12,
  hold: 8,
  resume: 8,
  acquire: [10, 18, 10],
  countdown: 6,
  complete: [12, 20, 24],
  fail: [24, 35, 24],
});

/**
 * Per-event repeat guard. Rapid navigation (double clicks, a held key, two
 * call sites racing) can never stack the same cue on top of itself.
 */
const REPEAT_GUARD_MS = Object.freeze({ hover: 90, focus: 60, countdown: 400, default: 45 });
const lastPlayed = new Map();

function throttled(eventName) {
  const now = globalThis.performance?.now?.() ?? Date.now();
  const window = REPEAT_GUARD_MS[eventName] ?? REPEAT_GUARD_MS.default;
  const previous = lastPlayed.get(eventName);
  if (previous !== undefined && now - previous < window) return true;
  lastPlayed.set(eventName, now);
  return false;
}

export function playFeedback(eventName) {
  const voice = VOICES[eventName];
  if (!voice) return;
  unlockAudio();
  voice();
}

export function haptic(pattern = 10) {
  const settings = getSettings();
  if (!settings.hapticsEnabled || !pattern) return;
  try {
    if (typeof globalThis.navigator?.vibrate === 'function') globalThis.navigator.vibrate(pattern);
  } catch { /* unsupported haptics */ }
}

/**
 * Voice one event.
 *
 * `vibration` is optional: omit it to use the event's own restrained default,
 * or pass `false` to stay silent on the haptics channel.
 */
export function feedback(eventName, vibration) {
  if (throttled(eventName)) return;
  playFeedback(eventName);
  const pattern = vibration === undefined ? HAPTICS[eventName] : vibration;
  if (pattern) haptic(pattern);
}
