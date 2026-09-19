import { GAME_CONFIG } from '../runtime-config.js';

export const DIRECTIVE_TYPES = Object.freeze({
  FLAWLESS: 'FLAWLESS',
  RAPID_ANALYSIS: 'RAPID_ANALYSIS',
  FIRST_CALL: 'FIRST_CALL',
  CLEAN_SWEEP: 'CLEAN_SWEEP',
});

const DIRECTIVES = Object.freeze([
  Object.freeze({ id: DIRECTIVE_TYPES.FLAWLESS, label: 'FLAWLESS', description: 'COMPLETE WITH ZERO FALSE IDENTIFICATIONS OR REJECTED SUBMISSIONS.' }),
  Object.freeze({ id: DIRECTIVE_TYPES.RAPID_ANALYSIS, label: 'RAPID ANALYSIS', description: 'COMPLETE BEFORE THE RAPID-ANALYSIS TIME THRESHOLD.' }),
  Object.freeze({ id: DIRECTIVE_TYPES.FIRST_CALL, label: 'FIRST CALL', description: 'MAKE THE CORRECT CONFIRMATION OR SUBMISSION ON THE FIRST ATTEMPT.' }),
  Object.freeze({ id: DIRECTIVE_TYPES.CLEAN_SWEEP, label: 'CLEAN SWEEP', description: 'COMPLETE CLEANLY WITH TIME STILL IN RESERVE.' }),
]);

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createMissionDirective(seed) {
  const index = hashSeed(`${seed}:directive`) % DIRECTIVES.length;
  return { ...DIRECTIVES[index] };
}

export function countMissionErrors({ falseIdentifications = 0, incorrectSubmissions = 0 } = {}) {
  return Math.max(0, Math.floor(Number(falseIdentifications) || 0))
    + Math.max(0, Math.floor(Number(incorrectSubmissions) || 0));
}

export function evaluateDirective(mission, {
  success = false,
  errors = 0,
  elapsedSeconds = 0,
  remainingSeconds = 0,
} = {}) {
  const directive = mission?.directive;
  if (!directive) return { id: null, label: 'NONE', description: '', completed: false, bonus: 0 };

  const limit = Math.max(1, Number(mission.timeLimitSeconds) || 1);
  const rapidLimit = limit * GAME_CONFIG.performance.rapidAnalysisTimeFraction;
  const cleanReserve = limit * GAME_CONFIG.performance.cleanSweepReserveFraction;
  const normalizedErrors = Math.max(0, Math.floor(Number(errors) || 0));
  let completed = false;

  if (directive.id === DIRECTIVE_TYPES.RAPID_ANALYSIS) {
    completed = success && Number(elapsedSeconds) <= rapidLimit;
  } else if (directive.id === DIRECTIVE_TYPES.CLEAN_SWEEP) {
    completed = success && normalizedErrors === 0 && Number(remainingSeconds) >= cleanReserve;
  } else {
    completed = success && normalizedErrors === 0;
  }

  return {
    ...directive,
    completed,
    bonus: completed ? GAME_CONFIG.performance.directiveBonus : 0,
  };
}

export function calculatePerformanceGrade({
  success = false,
  errors = 0,
  remainingSeconds = 0,
  timeLimitSeconds = 1,
} = {}) {
  if (!success) return { grade: 'C', score: 0 };

  const limit = Math.max(1, Number(timeLimitSeconds) || 1);
  const reserveRatio = Math.max(0, Math.min(1, Number(remainingSeconds) / limit));
  const normalizedErrors = Math.max(0, Math.floor(Number(errors) || 0));
  const score = Math.max(0, Math.min(100,
    Math.round(65 + reserveRatio * 35 - normalizedErrors * GAME_CONFIG.performance.errorGradePenalty)));

  const thresholds = GAME_CONFIG.performance.gradeThresholds;
  const grade = score >= thresholds.S ? 'S'
    : score >= thresholds.A ? 'A'
      : score >= thresholds.B ? 'B' : 'C';
  return { grade, score };
}

export function assessMissionPerformance(mission, metrics = {}) {
  const errors = Math.max(0, Math.floor(Number(metrics.errors) || 0));
  const directive = evaluateDirective(mission, { ...metrics, errors });
  const grade = calculatePerformanceGrade({
    success: metrics.success,
    errors,
    remainingSeconds: metrics.remainingSeconds,
    timeLimitSeconds: mission?.timeLimitSeconds,
  });
  return { errors, directive, grade: grade.grade, performanceScore: grade.score };
}

export function applyPerformanceBonus(score = {}, performance = {}) {
  const directiveBonus = performance.directive?.bonus ?? 0;
  return {
    ...score,
    directiveBonus,
    totalScore: Math.max(0, Number(score.totalScore || 0) + directiveBonus),
  };
}
