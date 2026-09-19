const STORAGE_KEY = 'i-spy-settings-v1';

const DEFAULTS = Object.freeze({
  masterVolume: 0.75,
  sfxEnabled: true,
  hapticsEnabled: true,
  scanlinesEnabled: true,
  imageGrainEnabled: true,
  sector: 'any',
  tutorialCompleted: false,
  tutorialStep: 0,
});

let state = load();

function sanitize(input = {}) {
  return {
    masterVolume: Math.max(0, Math.min(1, Number.isFinite(Number(input.masterVolume)) ? Number(input.masterVolume) : DEFAULTS.masterVolume)),
    sfxEnabled: input.sfxEnabled !== false,
    hapticsEnabled: input.hapticsEnabled !== false,
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
    return { ...DEFAULTS };
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
  state = { ...DEFAULTS };
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

export function cycleMasterVolume() {
  const levels = [1, 0.75, 0.5, 0.25, 0];
  const currentIndex = levels.findIndex((value) => Math.abs(value - state.masterVolume) < 0.01);
  const next = levels[(currentIndex + 1 + levels.length) % levels.length];
  return updateSettings({ masterVolume: next });
}

applyPresentationPreferences();
