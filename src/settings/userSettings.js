const STORAGE_KEY = 'i-spy-settings-v1';

/**
 * Haptic strength, weakest first after OFF.
 *
 * The Vibration API offers duration and nothing else — no amplitude — so
 * "strength" here means how long each pulse runs. The levels scale the
 * durations; they do not pretend to control how hard the motor is driven.
 */
export const HAPTIC_LEVELS = Object.freeze(['off', 'light', 'standard', 'strong']);

const DEFAULTS = Object.freeze({
  masterVolume: 0.75,
  sfxEnabled: true,
  hapticsLevel: 'standard',
  scanlinesEnabled: true,
  imageGrainEnabled: true,
  sector: 'any',
  tutorialCompleted: false,
  tutorialStep: 0,
});

let state = load();

/**
 * The stored level, or the old on/off switch translated into one.
 *
 * Settings saved before Phase 15H carry `hapticsEnabled` and no level: ON
 * becomes STANDARD and OFF becomes OFF, so an existing device keeps the
 * setting it had rather than being silently turned back on.
 */
function resolveHapticsLevel(input) {
  // A level that is present decides on its own. Reading the derived on/off
  // flag as a fallback would let a corrupt level quietly inherit whatever the
  // last state happened to be instead of resetting to the default.
  if (input.hapticsLevel !== undefined && input.hapticsLevel !== null) {
    const stored = String(input.hapticsLevel).trim().toLowerCase();
    return HAPTIC_LEVELS.includes(stored) ? stored : DEFAULTS.hapticsLevel;
  }
  if (input.hapticsEnabled === false) return 'off';
  if (input.hapticsEnabled === true) return 'standard';
  return DEFAULTS.hapticsLevel;
}

function sanitize(input = {}) {
  const level = resolveHapticsLevel(input);
  return {
    masterVolume: Math.max(0, Math.min(1, Number.isFinite(Number(input.masterVolume)) ? Number(input.masterVolume) : DEFAULTS.masterVolume)),
    sfxEnabled: input.sfxEnabled !== false,
    hapticsLevel: level,
    // Derived, never stored as the truth: everything that only needs to know
    // whether haptics are on at all keeps reading this.
    hapticsEnabled: level !== 'off',
    scanlinesEnabled: input.scanlinesEnabled !== false,
    imageGrainEnabled: input.imageGrainEnabled !== false,
    // Validated against the registry where it is used; stored as written.
    sector: typeof input.sector === 'string' && input.sector.trim() ? input.sector.trim() : DEFAULTS.sector,
    // Recorded so the console can say TRAINING COMPLETE. Nothing reads it to
    // decide whether to show the tutorial: it is never forced, at any launch.
    tutorialCompleted: input.tutorialCompleted === true,
    // Where ANALYST TRAINING resumes. Clamped here so a hand-edited or stale
    // value can never point at a step that does not exist.
    tutorialStep: Math.min(5, Math.max(0, Math.floor(Number(input.tutorialStep)) || 0)),
  };
}

function load() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return sanitize(raw ? JSON.parse(raw) : DEFAULTS);
  } catch {
    return sanitize(DEFAULTS);
  }
}

function persist() {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function getSettings() {
  return { ...state };
}

export function updateSettings(patch = {}) {
  state = sanitize({ ...state, ...patch });
  persist();
  applyPresentationPreferences();
  return getSettings();
}

export function resetSettings() {
  // Through sanitize, so the derived fields are present on a reset too.
  state = sanitize(DEFAULTS);
  persist();
  applyPresentationPreferences();
  return getSettings();
}

export function applyPresentationPreferences() {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.dataset.scanlines = state.scanlinesEnabled ? 'on' : 'off';
  root.dataset.imageGrain = state.imageGrainEnabled ? 'on' : 'off';
}

/** OFF -> LIGHT -> STANDARD -> STRONG -> OFF. */
export function cycleHapticsLevel() {
  const index = HAPTIC_LEVELS.indexOf(state.hapticsLevel);
  return updateSettings({ hapticsLevel: HAPTIC_LEVELS[(index + 1) % HAPTIC_LEVELS.length] });
}

export function cycleMasterVolume() {
  const levels = [1, 0.75, 0.5, 0.25, 0];
  const currentIndex = levels.findIndex((value) => Math.abs(value - state.masterVolume) < 0.01);
  const next = levels[(currentIndex + 1 + levels.length) % levels.length];
  return updateSettings({ masterVolume: next });
}

applyPresentationPreferences();
