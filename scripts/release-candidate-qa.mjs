/**
 * Phase 18E release-candidate audit.
 *
 * Environmental Expansion hardening only: no new gameplay features.
 * Exercises every sector/mode, additive sprite contracts, weather determinism,
 * operation/daily paths, persistence buckets, training/guide reachability,
 * responsive/lifecycle guards, and static-host safety.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_SPRITE_FRAME_COUNT,
  LEGACY_SPRITE_SHEET_KEYS,
  SPRITE_SHEETS,
  findSprite,
  frameFor,
} from '../src/assets/spriteManifest.js';
import {
  ENVIRONMENT_CONDITIONS,
  conditionsForSector,
  isConditionAllowed,
  resolveMissionCondition,
} from '../src/game/environmentConditions.js';
import { createLocateMission, validateIdentification, calculateLocateScore } from '../src/game/locateMission.js';
import { createCountMission, validateCountAnswer, calculateCountScore } from '../src/game/countMission.js';
import { createChangeDetectionMission, validateChangeIdentification, calculateChangeScore } from '../src/game/changeDetectionMission.js';
import {
  MIN_CHANGE_MOVE,
  createGeneratedMission,
  simulateEntities,
  validateGeneratedMission,
} from '../src/game/missionGenerator.js';
import {
  OPERATION_MISSION_COUNT,
  createDailyDossier,
  createOperationSeries,
  dailyRootSeed,
  resolveOperationMissionResult,
  restartOperation,
  utcDateKey,
} from '../src/game/operationSeries.js';
import {
  applyMissionResultToRecord,
  createEmptyAnalystRecord,
} from '../src/game/analystRecord.js';
import {
  TRAINING_STEP_COUNT,
  createTrainingMission,
  createTrainingScript,
} from '../src/game/trainingMissions.js';
import { listGuideEntries, validateIdentificationGuide } from '../src/game/identificationGuide.js';
import {
  findSelectableOverlaps,
  getMapEntities,
  validateReconMap,
} from '../src/world/reconMapSchema.js';
import {
  TRAINING_MAP_ID,
  listReconMaps,
  resolveReconMap,
} from '../src/world/mapRegistry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const errors = [];
let checks = 0;
const assert = (condition, message) => {
  checks += 1;
  if (!condition) errors.push(message);
};

const MODES = Object.freeze(['LOCATE', 'COUNT', 'CHANGE']);
const EXPECTED_SECTORS = Object.freeze([
  'woodland-corridor-7',
  'frostline-relay',
  'riverworks-sector',
  'border-farms',
  'greywall-district',
  'dustline-sector',
]);

// --- Phase 18 sprite contract ---------------------------------------------
const legacy = LEGACY_SPRITE_SHEET_KEYS.flatMap((key) => SPRITE_SHEETS[key].names);
assert(legacy.length === LEGACY_SPRITE_FRAME_COUNT,
  `legacy sprite contract remains ${LEGACY_SPRITE_FRAME_COUNT} frames`);
assert(SPRITE_SHEETS.environmentSupplemental?.names?.length === 24,
  'supplemental environment sheet remains 24 additive frames');
SPRITE_SHEETS.environmentSupplemental.names.forEach((name, index) => {
  const frame = frameFor(SPRITE_SHEETS.environmentSupplemental, name);
  assert(Boolean(findSprite(name)) && frame?.index === index,
    `supplemental frame resolves at stable index: ${name}`);
});

// --- Every playable sector: authored + generated + weather ----------------
const sectors = listReconMaps();
assert(sectors.length === EXPECTED_SECTORS.length,
  `exactly ${EXPECTED_SECTORS.length} playable sectors ship`);
EXPECTED_SECTORS.forEach((id) => {
  assert(sectors.some((entry) => entry.id === id), `playable sector registered: ${id}`);
});

for (const entry of sectors) {
  const map = resolveReconMap(entry.id);
  const schema = validateReconMap(map);
  const entities = getMapEntities(map);
  assert(schema.valid, `${entry.id}: map schema valid: ${schema.errors.join(' ')}`);
  assert(findSelectableOverlaps(entities).length === 0,
    `${entry.id}: authored selectable objects do not materially overlap`);
  entities.forEach((entity) => {
    assert(entity.x >= 0 && entity.y >= 0
      && entity.x + entity.width <= map.width
      && entity.y + entity.height <= map.height,
    `${entry.id}: entity ${entity.id} stays inside map bounds`);
  });

  const allowed = conditionsForSector(entry.id);
  assert(allowed.length >= 1 && allowed.every((condition) => Object.values(ENVIRONMENT_CONDITIONS).includes(condition)),
    `${entry.id}: condition compatibility contains only supported values`);

  const locate = createLocateMission(entry.id);
  const locateTarget = entities.find((entity) => entity.id === locate.targetId);
  assert(Boolean(locateTarget?.selectable) && validateIdentification(locate, locateTarget).correct,
    `${entry.id}: authored LOCATE target validates`);
  assert(isConditionAllowed(entry.id, locate.condition),
    `${entry.id}: authored LOCATE condition is compatible`);

  const count = createCountMission(entry.id);
  assert(count.expectedCount >= 2 && validateCountAnswer(count, count.expectedCount).correct,
    `${entry.id}: authored COUNT tally is valid and >=2`);
  assert(isConditionAllowed(entry.id, count.condition),
    `${entry.id}: authored COUNT condition is compatible`);

  const change = createChangeDetectionMission(entry.id);
  const passB = simulateEntities(map, change.passBOperations ?? []);
  const targetA = entities.find((entity) => entity.id === change.targetId);
  const targetB = passB.find((entity) => entity.id === change.targetId);
  const movement = targetA && targetB
    ? Math.hypot(targetA.x - targetB.x, targetA.y - targetB.y)
    : 0;
  assert(Boolean(targetA?.selectable && targetB?.selectable) && movement >= MIN_CHANGE_MOVE,
    `${entry.id}: authored CHANGE remains visible and selectable`);
  assert(validateChangeIdentification(change, targetB, 'B').correct,
    `${entry.id}: authored CHANGE target validates`);
  assert(isConditionAllowed(entry.id, change.condition),
    `${entry.id}: authored CHANGE condition is compatible`);

  for (const mode of MODES) {
    for (let index = 0; index < 24; index += 1) {
      const seed = `QA-18E-${entry.id}-${mode}-${String(index).padStart(2, '0')}`;
      const first = createGeneratedMission({ seed, mode, map: entry.id });
      const second = createGeneratedMission({ seed, mode, map: entry.id });
      assert(JSON.stringify(first) === JSON.stringify(second),
        `${entry.id}/${mode}/${seed}: generated mission reproduces exactly`);
      assert(first.generated === true && first.mapId === entry.id,
        `${entry.id}/${mode}/${seed}: remains procedural and in-sector`);
      assert(validateGeneratedMission(first, entry.id).valid,
        `${entry.id}/${mode}/${seed}: generated mission validates`);
      assert(first.condition === resolveMissionCondition(seed, entry.id)
        && isConditionAllowed(entry.id, first.condition),
      `${entry.id}/${mode}/${seed}: weather is deterministic and compatible`);
    }
  }
}

// Desert remains intentionally clear-only in Phase 18.
assert(conditionsForSector('dustline-sector').join(',') === ENVIRONMENT_CONDITIONS.CLEAR,
  'DUSTLINE remains CLEAR-only');
assert(!conditionsForSector('frostline-relay').includes(ENVIRONMENT_CONDITIONS.RAIN),
  'FROSTLINE does not receive rain');
assert(!conditionsForSector('riverworks-sector').includes(ENVIRONMENT_CONDITIONS.SNOW),
  'RIVERWORKS does not receive snow');

// --- Scoring unchanged by environmental expansion -------------------------
const locateClean = calculateLocateScore({ success: true, falseIdentifications: 0, remainingSeconds: 40 });
const locateDirty = calculateLocateScore({ success: true, falseIdentifications: 2, remainingSeconds: 40 });
const locateFail = calculateLocateScore({ success: false, falseIdentifications: 0, remainingSeconds: 40 });
assert(locateClean.totalScore > locateDirty.totalScore && locateDirty.totalScore > locateFail.totalScore,
  'LOCATE scoring still rewards clean success');

const countClean = calculateCountScore({ success: true, incorrectSubmissions: 0, remainingSeconds: 40 });
const countDirty = calculateCountScore({ success: true, incorrectSubmissions: 2, remainingSeconds: 40 });
const countFail = calculateCountScore({ success: false, incorrectSubmissions: 0, remainingSeconds: 40 });
assert(countClean.totalScore > countDirty.totalScore && countDirty.totalScore > countFail.totalScore,
  'COUNT scoring still rewards clean success');

const changeClean = calculateChangeScore({ success: true, falseIdentifications: 0, remainingSeconds: 40 });
const changeDirty = calculateChangeScore({ success: true, falseIdentifications: 2, remainingSeconds: 40 });
const changeFail = calculateChangeScore({ success: false, falseIdentifications: 0, remainingSeconds: 40 });
assert(changeClean.totalScore > changeDirty.totalScore && changeDirty.totalScore > changeFail.totalScore,
  'CHANGE scoring still rewards clean success');

// --- Operation Series: explicitly exercise every new/old sector -----------
for (const entry of sectors) {
  const rootSeed = `QA-18E-OPS-${entry.id}`;
  const first = createOperationSeries({ rootSeed, sector: entry.id });
  const second = createOperationSeries({ rootSeed, sector: entry.id });
  assert(JSON.stringify(first) === JSON.stringify(second),
    `${entry.id}: operation composition reproduces exactly`);
  assert(first.context.sectorId === entry.id,
    `${entry.id}: operation locks requested sector`);

  let mission = first.mission;
  const seen = [];
  for (let stage = 0; stage < OPERATION_MISSION_COUNT; stage += 1) {
    seen.push(mission.mode);
    assert(mission.mapId === entry.id && validateGeneratedMission(mission, entry.id).valid,
      `${entry.id}: operation stage ${stage + 1} is valid and stays in-sector`);
    assert(isConditionAllowed(entry.id, mission.condition),
      `${entry.id}: operation stage ${stage + 1} condition is compatible`);
    const outcome = resolveOperationMissionResult(mission, {
      success: true,
      score: { totalScore: 1100 + stage },
      performance: {
        grade: ['S', 'A', 'B'][stage],
        errors: 0,
        directive: { completed: stage !== 1 },
      },
    });
    if (stage < OPERATION_MISSION_COUNT - 1) {
      assert(outcome.status === 'continue' && Boolean(outcome.nextMission),
        `${entry.id}: operation stage ${stage + 1} continues once`);
      mission = outcome.nextMission;
    } else {
      assert(outcome.status === 'complete'
        && outcome.context.cumulative.wins === 3
        && outcome.context.cumulative.score === 3303,
      `${entry.id}: operation completes with exact cumulative totals`);
    }
  }
  assert(new Set(seen).size === 3 && MODES.every((mode) => seen.includes(mode)),
    `${entry.id}: operation contains each mode once`);

  const replay = restartOperation(first.context);
  assert(replay.context.rootSeed === first.context.rootSeed
    && replay.context.sectorId === entry.id
    && replay.context.replay === true,
  `${entry.id}: operation replay preserves root and sector`);
}

// --- Daily Dossier: deterministic identity/weather through UTC rollover ----
for (let day = 1; day <= 24; day += 1) {
  const dateKey = `2026-09-${String(day).padStart(2, '0')}`;
  const first = createDailyDossier({ dateKey });
  const second = createDailyDossier({ dateKey });
  assert(JSON.stringify(first) === JSON.stringify(second),
    `${dateKey}: daily dossier reproduces exactly`);
  assert(first.context.rootSeed === dailyRootSeed(dateKey)
    && first.context.dailyDate === dateKey
    && isConditionAllowed(first.mission.mapId, first.mission.condition),
  `${dateKey}: daily identity and mission condition are valid`);
}
assert(utcDateKey(new Date('2026-09-19T23:59:59.999Z')) === '2026-09-19',
  'daily UTC key holds through final millisecond');
assert(utcDateKey(new Date('2026-09-20T00:00:00.000Z')) === '2026-09-20',
  'daily UTC key rolls exactly at midnight');

// --- Analyst Record: new sectors create independent PB buckets -------------
let record = createEmptyAnalystRecord();
for (const [index, entry] of sectors.entries()) {
  const mission = createGeneratedMission({
    seed: `QA-18E-RECORD-${entry.id}`,
    mode: MODES[index % MODES.length],
    map: entry.id,
  });
  const result = applyMissionResultToRecord(record, mission, {
    success: true,
    score: { totalScore: 1200 + index * 100 },
    elapsedSeconds: 50 - index,
    performance: { grade: 'A', errors: 0, directive: { completed: true } },
  });
  record = result.record;
  assert(record.bySector[entry.id]?.played === 1
    && record.bySector[entry.id]?.wins === 1
    && record.bySector[entry.id]?.bestScore === 1200 + index * 100,
  `${entry.id}: Analyst Record stores independent sector PBs`);
}
assert(record.missions.played === sectors.length && record.missions.wins === sectors.length,
  'Analyst Record totals include all six sector results exactly once');

// --- Training + identification guide --------------------------------------
const trainingScript = createTrainingScript(TRAINING_MAP_ID);
assert(TRAINING_STEP_COUNT === 6 && trainingScript.length === TRAINING_STEP_COUNT,
  'Analyst Training retains six scripted steps');
for (let step = 0; step < TRAINING_STEP_COUNT; step += 1) {
  const mission = createTrainingMission(step, TRAINING_MAP_ID);
  assert(mission.training === true && mission.mapId === TRAINING_MAP_ID,
    `training step ${step + 1} remains on training range`);
}
const guideValidation = validateIdentificationGuide();
assert(guideValidation.valid && listGuideEntries().length === guideValidation.entryCount,
  `identification guide validates all ${guideValidation.entryCount} entries`);

// --- Source guards: weather/input/lifecycle/responsive/static hosting ------
const reconSource = read('src/scenes/ReconScene.js');
const weatherSource = read('src/ui/weatherOverlay.js');
const briefingSource = read('src/scenes/MissionBriefingScene.js');
const resultsSource = read('src/scenes/ResultsScene.js');
const menuSource = read('src/scenes/MainMenuScene.js');
const recordSceneSource = read('src/scenes/AnalystRecordScene.js');
const trainingSource = read('src/scenes/TrainingScene.js');
const guideSceneSource = read('src/scenes/IdentificationGuideScene.js');
const introSource = read('src/scenes/StartIntroScene.js');
const settingsSource = read('src/settings/userSettings.js');
const musicSource = read('src/audio/musicManager.js');
const sampleSource = read('src/audio/sampleFeedback.js');
const mainSource = read('src/main.js');
const viteSource = read('vite.config.js');

assert(weatherSource.includes('phase += 0.018')
  && !weatherSource.includes('phase = (phase + 0.018) % 1'),
'weather phase remains continuous without a short loop seam');
assert(weatherSource.includes('wrap01')
  && !weatherSource.includes('setInteractive')
  && !weatherSource.includes('entityNearPoint'),
'weather wraps coordinates safely and cannot participate in hit-testing');
assert(weatherSource.includes("condition !== ENVIRONMENT_CONDITIONS.CLEAR && !reducedMotion")
  && weatherSource.includes('tick?.remove(false)')
  && weatherSource.includes('graphics?.destroy()'),
'reduced-motion/CLEAR avoid moving precipitation and cleanup removes weather resources');
assert(reconSource.includes('this.weatherOverlay?.setPaused(this.paused)')
  && reconSource.includes('this.weatherOverlay?.destroy()')
  && reconSource.includes('this.weatherOverlay?.resize()'),
'recon pauses, cleans up and resizes weather');
assert(briefingSource.includes("CONDITIONS: ${this.mission.condition ?? 'CLEAR'}"),
'briefing exposes mission conditions');

assert(resultsSource.includes("scene.start('MissionBriefing', { mission })")
  && resultsSource.includes("createGeneratedMission({ mode: mission.mode, map: mission.mapId })"),
'standalone retry/new-mission flow remains intact');
assert(reconSource.includes('this.totalPausedMs = 0')
  && reconSource.includes('this.pauseStartedAt = null')
  && reconSource.includes('const resultId ='),
'recon reuse resets timing and retains idempotent result token');

assert(menuSource.includes('ANALYST TRAINING')
  && menuSource.includes('IDENTIFICATION GUIDE')
  && menuSource.includes('SETTINGS'),
'training, identification guide and settings remain reachable');
assert(mainSource.includes('TrainingScene')
  && mainSource.includes('IdentificationGuideScene')
  && mainSource.includes('AnalystRecordScene'),
'training, guide and analyst record remain registered');
assert(trainingSource.includes("super('Training')")
  && trainingSource.includes('TRAINING_STEP_COUNT'),
'training remains built on the live recon console');
assert(guideSceneSource.includes('fitGrid(') && guideSceneSource.includes('gridScrollable'),
'identification guide retains responsive/scrollable layout');
assert(settingsSource.includes('masterVolume')
  && settingsSource.includes('musicEnabled')
  && settingsSource.includes('sfxEnabled')
  && settingsSource.includes('hapticsLevel')
  && settingsSource.includes('scanlinesEnabled')
  && settingsSource.includes('imageGrainEnabled'),
'core persisted settings remain available');
assert(musicSource.includes('fadeToState') && musicSource.includes('visibilitychange')
  && sampleSource.includes('stopOtherSamples'),
'audio still owns music fades/visibility and exclusive target samples');
assert(introSource.includes('if (this.started || this.finished) return')
  && introSource.includes('removeEventListener')
  && introSource.includes("this.scene.start('MainMenu')"),
'intro remains single-shot, skippable and cleaned up');

assert(menuSource.includes('const TIERS = [') && menuSource.includes('const stackCards ='),
'main console retains adaptive density');
assert(briefingSource.includes('const compact =') && briefingSource.includes('const short ='),
'briefing retains compact/short fitting');
assert(resultsSource.includes('const compact =') && resultsSource.includes('setWordWrapWidth'),
'results retains responsive wrapping');
assert(recordSceneSource.includes('const compact =') && recordSceneSource.includes('const short ='),
'Analyst Record retains compact/short fitting');
assert(reconSource.includes('railHeight(') && reconSource.includes('splitViewMinWidth'),
'recon retains compact rails and split-view width guard');
assert(viteSource.includes("base: './'"),
'production assets remain relative-path safe for GitHub Pages/static hosting');

if (errors.length) {
  console.error(`I SPY Phase 18E release-candidate QA FAILED (${errors.length}):`);
  errors.slice(0, 60).forEach((message) => console.error(`  - ${message}`));
  if (errors.length > 60) console.error(`  ...and ${errors.length - 60} more`);
  process.exit(1);
}

console.log(`I SPY Phase 18E release-candidate QA passed: ${checks} checks.`);
console.log(`Playable sectors: ${sectors.length}; generated RC cases: ${sectors.length * MODES.length * 24}; daily dates: 24.`);
