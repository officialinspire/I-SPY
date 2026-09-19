/**
 * Phase 17C/17D progression regression QA.
 *
 * Pure record reducers and deterministic operation builders are exercised here
 * so local persistence, three-mission series, daily seeds, PBs and failure
 * termination cannot silently drift.
 */
import {
  ANALYST_RECORD_VERSION,
  applyMissionResultToRecord,
  createEmptyAnalystRecord,
  getAnalystRecord,
  recordOperationOutcome,
  recordOperationStarted,
  resetAnalystRecord,
  sanitizeAnalystRecord,
} from '../src/game/analystRecord.js';
import { createGeneratedMission } from '../src/game/missionGenerator.js';
import {
  OPERATION_MISSION_COUNT,
  createDailyDossier,
  createOperationSeries,
  dailyRootSeed,
  operationCleanSweep,
  resolveOperationMissionResult,
  restartOperation,
  utcDateKey,
} from '../src/game/operationSeries.js';

const errors = [];
let checks = 0;
const assert = (condition, message) => {
  checks += 1;
  if (!condition) errors.push(message);
};

// --- Analyst Record -------------------------------------------------------
const sanitized = sanitizeAnalystRecord({
  schemaVersion: 999,
  missions: { played: -4, wins: 7, currentStreak: '3' },
  grades: { S: 2, A: -9 },
  byMode: { LOCATE: { played: 2, wins: 1, bestScore: 1234, fastestTime: 42 } },
  daily: { 'bad-date': { attempts: 99 }, '2026-09-19': { attempts: 2, bestScore: 3000 } },
});
assert(sanitized.schemaVersion === ANALYST_RECORD_VERSION, 'record migration pins the current schema version');
assert(sanitized.missions.played === 0 && sanitized.missions.wins === 7, 'record migration clamps counters safely');
assert(sanitized.grades.S === 2 && sanitized.grades.A === 0, 'record migration sanitizes grade counts');
assert(!sanitized.daily['bad-date'] && sanitized.daily['2026-09-19']?.attempts === 2, 'record migration drops invalid daily keys');

let record = createEmptyAnalystRecord();
const mission = { mode: 'LOCATE', mapId: 'woodland-corridor-7' };
let update = applyMissionResultToRecord(record, mission, {
  success: true,
  score: { totalScore: 1800 },
  elapsedSeconds: 35,
  performance: { grade: 'S', errors: 0, directive: { completed: true } },
});
record = update.record;
assert(update.newBestScore && update.newFastestTime, 'first successful mission establishes score and time PBs');
assert(record.missions.played === 1 && record.missions.wins === 1 && record.missions.currentStreak === 1, 'win updates mission totals and streak');
assert(record.missions.flawless === 1 && record.missions.directives === 1 && record.grades.S === 1, 'win records flawless directive and grade totals');
assert(record.byMode.LOCATE.bestScore === 1800 && record.bySector['woodland-corridor-7'].fastestTime === 35, 'mode and sector PBs update together');

update = applyMissionResultToRecord(record, mission, {
  success: true,
  score: { totalScore: 1500 },
  elapsedSeconds: 50,
  performance: { grade: 'A', errors: 1, directive: { completed: false } },
});
record = update.record;
assert(!update.newBestScore && !update.newFastestTime, 'slower lower-scoring win does not replace PBs');
assert(record.missions.currentStreak === 2 && record.missions.bestStreak === 2, 'consecutive wins grow best streak');

update = applyMissionResultToRecord(record, mission, {
  success: false,
  score: { totalScore: 0 },
  elapsedSeconds: 90,
  performance: { grade: 'C', errors: 2, directive: { completed: false } },
});
record = update.record;
assert(record.missions.failures === 1 && record.missions.currentStreak === 0, 'failure increments failures and resets current streak');
assert(record.missions.bestStreak === 2, 'failure preserves best streak');

resetAnalystRecord();
recordOperationStarted({ kind: 'daily', dailyDate: '2026-09-19' });
recordOperationOutcome({
  kind: 'daily',
  dailyDate: '2026-09-19',
  cumulative: { score: 900, wins: 1, directives: 1, errors: 1 },
}, 'failed');
let persisted = getAnalystRecord();
assert(persisted.operations.failed === 1 && persisted.operations.bestScore === 0,
  'failed operation counts but cannot establish an operation PB');
assert(persisted.daily['2026-09-19'].attempts === 1 && persisted.daily['2026-09-19'].bestScore === 0,
  'failed daily attempt is retained without replacing the daily best');

recordOperationStarted({ kind: 'daily', dailyDate: '2026-09-19' });
const completedRecord = recordOperationOutcome({
  kind: 'daily',
  dailyDate: '2026-09-19',
  cumulative: { score: 3200, wins: 3, directives: 2, errors: 0 },
}, 'complete');
persisted = completedRecord.record;
assert(completedRecord.newBest && completedRecord.newDailyBest
  && persisted.operations.bestScore === 3200
  && persisted.daily['2026-09-19'].bestScore === 3200,
'completed daily operation establishes operation and daily PBs');

// --- Operation Series -----------------------------------------------------
const rootSeed = 'QA-17D-ROOT';
const seriesA = createOperationSeries({ rootSeed, sector: 'any' });
const seriesB = createOperationSeries({ rootSeed, sector: 'any' });
assert(JSON.stringify(seriesA) === JSON.stringify(seriesB), 'same operation root seed reproduces identically');
assert(seriesA.context.modeOrder.length === OPERATION_MISSION_COUNT
  && new Set(seriesA.context.modeOrder).size === OPERATION_MISSION_COUNT
  && ['LOCATE', 'COUNT', 'CHANGE'].every((mode) => seriesA.context.modeOrder.includes(mode)),
'operation contains LOCATE COUNT CHANGE exactly once');
assert(seriesA.mission.mapId === seriesA.context.sectorId, 'first operation mission uses locked sector');

const successResult = {
  success: true,
  score: { totalScore: 1000 },
  performance: { grade: 'A', errors: 0, directive: { completed: true } },
};

let currentMission = seriesA.mission;
const seenModes = [];
for (let stage = 0; stage < OPERATION_MISSION_COUNT; stage += 1) {
  seenModes.push(currentMission.mode);
  assert(currentMission.mapId === seriesA.context.sectorId, `stage ${stage + 1} stays in the locked sector`);

  const context = currentMission.operationSeries;
  const base = createGeneratedMission({
    seed: `${context.rootSeed}:M${context.index + 1}:${currentMission.mode}`,
    mode: currentMission.mode,
    map: context.sectorId,
  });
  const factor = [1.08, 1, 0.92][stage];
  assert(currentMission.timeLimitSeconds === Math.max(60, Math.round(base.timeLimitSeconds * factor)),
    `stage ${stage + 1} applies the configured gentle escalation`);

  const outcome = resolveOperationMissionResult(currentMission, successResult);
  if (stage < OPERATION_MISSION_COUNT - 1) {
    assert(outcome.status === 'continue' && Boolean(outcome.nextMission), `stage ${stage + 1} continues to the next mission`);
    assert(outcome.context.index === stage, `stage ${stage + 1} debrief keeps the completed mission index`);
    currentMission = outcome.nextMission;
  } else {
    assert(outcome.status === 'complete' && !outcome.nextMission, 'third success completes the operation');
    assert(outcome.context.cumulative.score === 3000
      && outcome.context.cumulative.wins === 3
      && outcome.context.cumulative.directives === 3
      && outcome.context.cumulative.errors === 0,
    'operation accumulates score wins directives and errors');
    assert(outcome.context.cumulative.grades.join(',') === 'A,A,A', 'operation accumulates mission grades');
    assert(operationCleanSweep(outcome.context), 'three clean wins qualify as a clean sweep');
  }
}
assert(new Set(seenModes).size === 3, 'played operation modes remain unique');

const failed = resolveOperationMissionResult(seriesA.mission, {
  success: false,
  score: { totalScore: 0 },
  performance: { grade: 'C', errors: 1, directive: { completed: false } },
});
assert(failed.status === 'failed' && failed.nextMission === null, 'failure terminates the operation immediately');

// --- Daily Dossier --------------------------------------------------------
const date = '2026-09-19';
const dailyA = createDailyDossier({ dateKey: date });
const dailyB = createDailyDossier({ dateKey: date });
assert(JSON.stringify(dailyA) === JSON.stringify(dailyB), 'same UTC date produces the same daily dossier');
assert(dailyA.context.rootSeed === dailyRootSeed(date), 'daily dossier uses the versioned UTC-date root seed');
assert(dailyA.context.kind === 'daily' && dailyA.context.dailyDate === date, 'daily dossier carries daily identity');
assert(dailyRootSeed('2026-09-20') !== dailyRootSeed(date), 'different UTC dates produce different daily roots');
assert(utcDateKey(new Date('2026-09-19T23:59:59Z')) === date, 'daily date key is UTC-based');

const replay = restartOperation(dailyA.context);
assert(replay.context.rootSeed === dailyA.context.rootSeed && replay.context.replay === true, 'daily replay keeps the same dossier and marks replay');

if (errors.length) {
  console.error('I SPY progression QA FAILED');
  errors.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}
console.log(`I SPY progression QA passed: ${checks} checks.`);
