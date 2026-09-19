const STORAGE_KEY = 'i-spy-analyst-record-v1';
const LEGACY_KEYS = Object.freeze(['i-spy-analyst-record']);
export const ANALYST_RECORD_VERSION = 1;
const MODES = Object.freeze(['LOCATE', 'COUNT', 'CHANGE']);
const GRADES = Object.freeze(['S', 'A', 'B', 'C']);

function emptyMode() {
  return { played: 0, wins: 0, bestScore: 0, fastestTime: null };
}

export function createEmptyAnalystRecord() {
  return {
    schemaVersion: ANALYST_RECORD_VERSION,
    missions: {
      played: 0,
      wins: 0,
      failures: 0,
      currentStreak: 0,
      bestStreak: 0,
      flawless: 0,
      directives: 0,
    },
    grades: { S: 0, A: 0, B: 0, C: 0 },
    byMode: Object.fromEntries(MODES.map((mode) => [mode, emptyMode()])),
    bySector: {},
    operations: {
      started: 0,
      completed: 0,
      failed: 0,
      bestScore: 0,
      bestDirectives: 0,
      cleanSweeps: 0,
    },
    daily: {},
  };
}

const nonNegativeInt = (value) => Math.max(0, Math.floor(Number(value) || 0));
const positiveTime = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

function sanitizeMode(input = {}) {
  return {
    played: nonNegativeInt(input.played),
    wins: nonNegativeInt(input.wins),
    bestScore: nonNegativeInt(input.bestScore),
    fastestTime: positiveTime(input.fastestTime),
  };
}

export function sanitizeAnalystRecord(input = {}) {
  const defaults = createEmptyAnalystRecord();
  const missions = input?.missions ?? {};
  const operations = input?.operations ?? {};
  const grades = input?.grades ?? {};

  const byMode = {};
  MODES.forEach((mode) => { byMode[mode] = sanitizeMode(input?.byMode?.[mode]); });

  const bySector = {};
  for (const [sectorId, value] of Object.entries(input?.bySector ?? {})) {
    if (!sectorId || typeof value !== 'object' || !value) continue;
    bySector[String(sectorId)] = sanitizeMode(value);
  }

  const daily = {};
  for (const [date, value] of Object.entries(input?.daily ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof value !== 'object' || !value) continue;
    daily[date] = {
      attempts: nonNegativeInt(value.attempts),
      completions: nonNegativeInt(value.completions),
      bestScore: nonNegativeInt(value.bestScore),
      bestDirectives: nonNegativeInt(value.bestDirectives),
      cleanSweeps: nonNegativeInt(value.cleanSweeps),
    };
  }

  return {
    schemaVersion: ANALYST_RECORD_VERSION,
    missions: {
      played: nonNegativeInt(missions.played),
      wins: nonNegativeInt(missions.wins),
      failures: nonNegativeInt(missions.failures),
      currentStreak: nonNegativeInt(missions.currentStreak),
      bestStreak: nonNegativeInt(missions.bestStreak),
      flawless: nonNegativeInt(missions.flawless),
      directives: nonNegativeInt(missions.directives),
    },
    grades: Object.fromEntries(GRADES.map((grade) => [grade, nonNegativeInt(grades[grade])])),
    byMode,
    bySector,
    operations: {
      started: nonNegativeInt(operations.started),
      completed: nonNegativeInt(operations.completed),
      failed: nonNegativeInt(operations.failed),
      bestScore: nonNegativeInt(operations.bestScore),
      bestDirectives: nonNegativeInt(operations.bestDirectives),
      cleanSweeps: nonNegativeInt(operations.cleanSweeps),
    },
    daily,
    ...defaults.schemaVersion && {},
  };
}

function loadStoredRecord() {
  try {
    const current = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (current) return sanitizeAnalystRecord(JSON.parse(current));
    for (const key of LEGACY_KEYS) {
      const raw = globalThis.localStorage?.getItem(key);
      if (!raw) continue;
      const migrated = sanitizeAnalystRecord(JSON.parse(raw));
      try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch { /* unavailable */ }
      return migrated;
    }
  } catch { /* corrupt/unavailable storage resets safely */ }
  return createEmptyAnalystRecord();
}

let state = loadStoredRecord();

function persist() {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function getAnalystRecord() {
  return structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
}

export function resetAnalystRecord() {
  state = createEmptyAnalystRecord();
  persist();
  return getAnalystRecord();
}

export function applyMissionResultToRecord(record, mission, result = {}) {
  const next = sanitizeAnalystRecord(record);
  const success = result.success === true;
  const score = nonNegativeInt(result.score?.totalScore);
  const elapsedSeconds = positiveTime(result.elapsedSeconds) ?? 0;
  const errors = nonNegativeInt(result.performance?.errors ?? result.errors);
  const grade = GRADES.includes(result.performance?.grade) ? result.performance.grade : 'C';
  const directiveCompleted = result.performance?.directive?.completed === true;

  next.missions.played += 1;
  if (success) {
    next.missions.wins += 1;
    next.missions.currentStreak += 1;
    next.missions.bestStreak = Math.max(next.missions.bestStreak, next.missions.currentStreak);
    if (errors === 0) next.missions.flawless += 1;
  } else {
    next.missions.failures += 1;
    next.missions.currentStreak = 0;
  }
  if (directiveCompleted) next.missions.directives += 1;
  next.grades[grade] += 1;

  const mode = MODES.includes(mission?.mode) ? mission.mode : null;
  const sectorId = typeof mission?.mapId === 'string' && mission.mapId ? mission.mapId : null;
  let newBestScore = false;
  let newFastestTime = false;

  const updateBucket = (bucket) => {
    bucket.played += 1;
    if (success) bucket.wins += 1;
    if (score > bucket.bestScore) {
      bucket.bestScore = score;
      newBestScore = true;
    }
    if (success && (bucket.fastestTime === null || elapsedSeconds < bucket.fastestTime)) {
      bucket.fastestTime = elapsedSeconds;
      newFastestTime = true;
    }
  };

  if (mode) updateBucket(next.byMode[mode]);
  if (sectorId) {
    next.bySector[sectorId] = sanitizeMode(next.bySector[sectorId]);
    updateBucket(next.bySector[sectorId]);
  }

  return {
    record: next,
    newBestScore,
    newFastestTime,
    streak: next.missions.currentStreak,
  };
}

export function recordMissionResult(mission, result = {}) {
  const update = applyMissionResultToRecord(state, mission, result);
  state = update.record;
  persist();
  return { ...update, record: getAnalystRecord() };
}

export function recordOperationStarted({ kind = 'series', dailyDate = null } = {}) {
  const next = sanitizeAnalystRecord(state);
  next.operations.started += 1;
  if (kind === 'daily' && dailyDate) {
    const existing = next.daily[dailyDate] ?? { attempts: 0, completions: 0, bestScore: 0, bestDirectives: 0, cleanSweeps: 0 };
    next.daily[dailyDate] = { ...existing, attempts: existing.attempts + 1 };
  }
  state = next;
  persist();
  return getAnalystRecord();
}

export function recordOperationOutcome(context = {}, status = 'failed') {
  const next = sanitizeAnalystRecord(state);
  const cumulative = context.cumulative ?? {};
  const score = nonNegativeInt(cumulative.score);
  const directives = nonNegativeInt(cumulative.directives);
  const cleanSweep = status === 'complete'
    && nonNegativeInt(cumulative.wins) >= 3
    && nonNegativeInt(cumulative.errors) === 0;

  if (status === 'complete') next.operations.completed += 1;
  else next.operations.failed += 1;

  const newBest = score > next.operations.bestScore;
  next.operations.bestScore = Math.max(next.operations.bestScore, score);
  next.operations.bestDirectives = Math.max(next.operations.bestDirectives, directives);
  if (cleanSweep) next.operations.cleanSweeps += 1;

  let newDailyBest = false;
  if (context.kind === 'daily' && context.dailyDate) {
    const daily = next.daily[context.dailyDate] ?? { attempts: 0, completions: 0, bestScore: 0, bestDirectives: 0, cleanSweeps: 0 };
    if (status === 'complete') daily.completions += 1;
    if (score > daily.bestScore) {
      daily.bestScore = score;
      newDailyBest = true;
    }
    daily.bestDirectives = Math.max(daily.bestDirectives, directives);
    if (cleanSweep) daily.cleanSweeps += 1;
    next.daily[context.dailyDate] = daily;
  }

  state = next;
  persist();
  return { record: getAnalystRecord(), newBest, newDailyBest, cleanSweep };
}

export function getDailyStatus(date) {
  const item = state.daily?.[date];
  return item ? { ...item } : { attempts: 0, completions: 0, bestScore: 0, bestDirectives: 0, cleanSweeps: 0 };
}
