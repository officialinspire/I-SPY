/**
 * Phase 17E release-candidate audit.
 *
 * Cross-feature contracts that are too broad for the generator, progression,
 * audio, or lifecycle suites live here. This stays pure Node: it exercises the
 * same mission builders/validators used at runtime and source-audits the
 * responsive/static-host paths that require Phaser/DOM to render.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocateMission, validateIdentification, calculateLocateScore } from '../src/game/locateMission.js';
import { createCountMission, validateCountAnswer, calculateCountScore } from '../src/game/countMission.js';
import { createChangeDetectionMission, validateChangeIdentification, calculateChangeScore } from '../src/game/changeDetectionMission.js';
import { MIN_CHANGE_MOVE, simulateEntities, validateGeneratedMission } from '../src/game/missionGenerator.js';
import {
  OPERATION_MISSION_COUNT,
  createDailyDossier,
  createOperationSeries,
  dailyRootSeed,
  resolveOperationMissionResult,
  restartOperation,
  utcDateKey,
} from '../src/game/operationSeries.js';
import { getMapEntities } from '../src/world/reconMapSchema.js';
import { listReconMaps, resolveReconMap } from '../src/world/mapRegistry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const errors = [];
let checks = 0;
const assert = (condition, message) => {
  checks += 1;
  if (!condition) errors.push(message);
};

const MODES = ['LOCATE', 'COUNT', 'CHANGE'];

// --- Standalone authored missions: every playable sector ------------------
for (const entry of listReconMaps()) {
  const map = resolveReconMap(entry.id);
  const entities = getMapEntities(map);

  const locate = createLocateMission(entry.id);
  const locateTarget = entities.find((entity) => entity.id === locate.targetId);
  const locateWrong = entities.find((entity) => entity.selectable && entity.id !== locate.targetId);
  assert(locate.mode === 'LOCATE' && locate.mapId === entry.id,
    `${entry.id}: authored LOCATE resolves to the requested sector`);
  assert(Boolean(locateTarget?.selectable) && validateIdentification(locate, locateTarget).correct,
    `${entry.id}: authored LOCATE target validates correctly`);
  if (locateWrong) {
    assert(!validateIdentification(locate, locateWrong).correct,
      `${entry.id}: authored LOCATE rejects a wrong selectable object`);
  }

  const count = createCountMission(entry.id);
  assert(count.mode === 'COUNT' && count.mapId === entry.id,
    `${entry.id}: authored COUNT resolves to the requested sector`);
  assert(count.expectedCount >= 2,
    `${entry.id}: authored COUNT remains a tally of at least two`);
  assert(validateCountAnswer(count, count.expectedCount).correct,
    `${entry.id}: authored COUNT accepts its computed answer`);
  assert(!validateCountAnswer(count, count.expectedCount + 1).correct,
    `${entry.id}: authored COUNT rejects an incorrect answer`);

  const change = createChangeDetectionMission(entry.id);
  const passA = entities;
  const passB = simulateEntities(map, change.passBOperations ?? []);
  const targetA = passA.find((entity) => entity.id === change.targetId);
  const targetB = passB.find((entity) => entity.id === change.targetId);
  const move = targetA && targetB ? Math.hypot(targetA.x - targetB.x, targetA.y - targetB.y) : 0;
  assert(change.mode === 'CHANGE' && change.mapId === entry.id,
    `${entry.id}: authored CHANGE resolves to the requested sector`);
  assert(Boolean(targetA?.selectable && targetB?.selectable),
    `${entry.id}: authored CHANGE target is selectable in both passes`);
  assert(move >= MIN_CHANGE_MOVE,
    `${entry.id}: authored CHANGE move is visually material (${Math.round(move)})`);
  assert(validateChangeIdentification(change, targetB, 'B').correct,
    `${entry.id}: authored CHANGE target validates on PASS B`);
}

// Standalone scoring remains monotonic around clean/error/failure cases.
const locateClean = calculateLocateScore({ success: true, falseIdentifications: 0, remainingSeconds: 40 });
const locateDirty = calculateLocateScore({ success: true, falseIdentifications: 2, remainingSeconds: 40 });
const locateFail = calculateLocateScore({ success: false, falseIdentifications: 0, remainingSeconds: 40 });
assert(locateClean.totalScore > locateDirty.totalScore && locateDirty.totalScore > locateFail.totalScore,
  'LOCATE scoring rewards a cleaner successful result');

const countClean = calculateCountScore({ success: true, incorrectSubmissions: 0, remainingSeconds: 40 });
const countDirty = calculateCountScore({ success: true, incorrectSubmissions: 2, remainingSeconds: 40 });
const countFail = calculateCountScore({ success: false, incorrectSubmissions: 0, remainingSeconds: 40 });
assert(countClean.totalScore > countDirty.totalScore && countDirty.totalScore > countFail.totalScore,
  'COUNT scoring rewards a cleaner successful result');

const changeClean = calculateChangeScore({ success: true, falseIdentifications: 0, remainingSeconds: 40 });
const changeDirty = calculateChangeScore({ success: true, falseIdentifications: 2, remainingSeconds: 40 });
const changeFail = calculateChangeScore({ success: false, falseIdentifications: 0, remainingSeconds: 40 });
assert(changeClean.totalScore > changeDirty.totalScore && changeDirty.totalScore > changeFail.totalScore,
  'CHANGE scoring rewards a cleaner successful result');

// --- Operation Series: deterministic composition and cumulative debrief ----
const OPERATION_SEEDS = 24;
for (let index = 0; index < OPERATION_SEEDS; index += 1) {
  const rootSeed = `QA-17E-OP-${String(index).padStart(2, '0')}`;
  const a = createOperationSeries({ rootSeed, sector: 'any' });
  const b = createOperationSeries({ rootSeed, sector: 'any' });
  assert(JSON.stringify(a) === JSON.stringify(b),
    `${rootSeed}: operation root reproduces identically`);

  let mission = a.mission;
  const seen = [];
  for (let stage = 0; stage < OPERATION_MISSION_COUNT; stage += 1) {
    seen.push(mission.mode);
    assert(mission.mapId === a.context.sectorId,
      `${rootSeed}: stage ${stage + 1} stays in the locked sector`);
    assert(validateGeneratedMission(mission, mission.mapId).valid,
      `${rootSeed}: stage ${stage + 1} remains a valid generated mission`);

    const outcome = resolveOperationMissionResult(mission, {
      success: true,
      score: { totalScore: 1000 + stage },
      performance: { grade: ['S', 'A', 'B'][stage], errors: 0, directive: { completed: stage !== 1 } },
    });

    if (stage < OPERATION_MISSION_COUNT - 1) {
      assert(outcome.status === 'continue' && Boolean(outcome.nextMission),
        `${rootSeed}: stage ${stage + 1} continues exactly once`);
      mission = outcome.nextMission;
    } else {
      assert(outcome.status === 'complete' && outcome.context.cumulative.wins === 3,
        `${rootSeed}: third success completes the series`);
      assert(outcome.context.cumulative.score === 3003
        && outcome.context.cumulative.directives === 2
        && outcome.context.cumulative.errors === 0
        && outcome.context.cumulative.grades.join(',') === 'S,A,B',
      `${rootSeed}: final debrief totals each stage exactly once`);
    }
  }
  assert(seen.length === 3 && new Set(seen).size === 3 && MODES.every((mode) => seen.includes(mode)),
    `${rootSeed}: series contains LOCATE COUNT CHANGE once each`);
}

const fixedSector = listReconMaps()[2]?.id ?? listReconMaps()[0].id;
const fixed = createOperationSeries({ rootSeed: 'QA-17E-FIXED', sector: fixedSector });
const fixedReplay = restartOperation(fixed.context);
assert(fixedReplay.context.rootSeed === fixed.context.rootSeed
  && fixedReplay.context.sectorId === fixed.context.sectorId
  && fixedReplay.context.replay === true,
'operation replay keeps the root/sector and is explicitly marked as replay');

// --- Daily Dossier: UTC identity and rollover ------------------------------
for (let day = 1; day <= 12; day += 1) {
  const dateKey = `2026-09-${String(day).padStart(2, '0')}`;
  const first = createDailyDossier({ dateKey });
  const second = createDailyDossier({ dateKey });
  assert(JSON.stringify(first) === JSON.stringify(second),
    `${dateKey}: daily dossier reproduces identically`);
  assert(first.context.rootSeed === dailyRootSeed(dateKey)
    && first.context.kind === 'daily'
    && first.context.dailyDate === dateKey,
  `${dateKey}: daily dossier identity is date/build derived`);
}
assert(utcDateKey(new Date('2026-09-19T23:59:59.999Z')) === '2026-09-19',
  'UTC daily key holds through the final millisecond of the date');
assert(utcDateKey(new Date('2026-09-20T00:00:00.000Z')) === '2026-09-20',
  'UTC daily key rolls exactly at midnight UTC');
const dailyReplayBase = createDailyDossier({ dateKey: '2026-09-19' });
const dailyReplay = restartOperation(dailyReplayBase.context);
assert(dailyReplay.context.rootSeed === dailyReplayBase.context.rootSeed
  && dailyReplay.context.dailyDate === dailyReplayBase.context.dailyDate
  && dailyReplay.context.replay === true,
'daily replay keeps the same dated dossier');

// --- Source-level RC guards: retry/lifecycle/responsive/static host --------
const reconSource = read('src/scenes/ReconScene.js');
const resultsSource = read('src/scenes/ResultsScene.js');
const menuSource = read('src/scenes/MainMenuScene.js');
const briefingSource = read('src/scenes/MissionBriefingScene.js');
const recordSceneSource = read('src/scenes/AnalystRecordScene.js');
const introSource = read('src/scenes/StartIntroScene.js');
const mainSource = read('src/main.js');
const viteSource = read('vite.config.js');

assert(resultsSource.includes("scene.start('MissionBriefing', { mission })"),
  'standalone failure retry reuses the exact mission');
assert(resultsSource.includes("createGeneratedMission({ mode: mission.mode, map: mission.mapId })"),
  'standalone success continues in the same mode and sector');
assert(reconSource.includes('this.totalPausedMs = 0') && reconSource.includes('this.pauseStartedAt = null'),
  'reused recon scene clears stale pause timing');
assert(reconSource.includes('const resultId =') && resultsSource.includes('recordUpdate.duplicate'),
  'completed attempts carry an idempotent result token through debrief persistence');

assert(menuSource.includes('const TIERS = [')
  && menuSource.includes('this.systemButtons.length')
  && menuSource.includes('const stackCards ='),
'main console retains adaptive density and system-grid sizing');
assert(briefingSource.includes('const compact =') && briefingSource.includes('const short =')
  && briefingSource.includes('setWordWrapWidth'),
'mission briefing retains compact/short viewport fitting');
assert(resultsSource.includes('const compact =') && resultsSource.includes('extendedDebrief')
  && resultsSource.includes('setWordWrapWidth'),
'results debrief retains compact/extended viewport fitting');
assert(recordSceneSource.includes('const compact =') && recordSceneSource.includes('const short =')
  && recordSceneSource.includes('setWordWrapWidth'),
'analyst record retains compact/short viewport fitting');
assert(reconSource.includes('railHeight(') && reconSource.includes('splitViewMinWidth'),
'recon controls retain compact rails and split-view width guard');

assert(mainSource.includes('TrainingScene') && mainSource.includes('IdentificationGuideScene')
  && mainSource.includes('AnalystRecordScene'),
'training guide and analyst record remain registered');
assert(menuSource.includes('ANALYST TRAINING') && menuSource.includes('IDENTIFICATION GUIDE')
  && menuSource.includes('SETTINGS'),
'training guide and settings remain reachable from the console');
assert(introSource.includes('if (this.started || this.finished) return')
  && introSource.includes('removeEventListener')
  && introSource.includes("this.scene.start('MainMenu')"),
'startup intro remains single-shot skippable and cleaned up');
assert(viteSource.includes("base: './'"),
'production assets remain relative-path safe for GitHub Pages/static hosting');

if (errors.length) {
  console.error(`I SPY Phase 17E release-candidate QA FAILED (${errors.length}):`);
  errors.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}

console.log(`I SPY Phase 17E release-candidate QA passed: ${checks} checks.`);
console.log(`Standalone sectors: ${listReconMaps().length}; operation roots: ${OPERATION_SEEDS}; daily dates: 12.`);
