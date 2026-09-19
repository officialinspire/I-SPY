import { getMapEntities, getMapMetadata } from '../world/reconMapSchema.js';
import { getSettings } from '../settings/userSettings.js';
import { resolveReconMap, TRAINING_MAP_ID } from '../world/mapRegistry.js';
import { countEntitiesInRegion } from './countMission.js';

/**
 * ANALYST TRAINING: the scripted lessons, and the missions they run on.
 *
 * Nothing here is generated and nothing is timed. Each step names the console
 * behaviour it teaches and what the trainee has to actually do before NEXT
 * unlocks; the recon scene enforces that with its own controls rather than
 * with a parallel set. The missions are ordinary mission objects, so the same
 * scene that flies a real tasking flies the tutorial.
 */

export const TRAINING_STEPS = Object.freeze(['NAVIGATION', 'IDENTIFICATION', 'MARKING', 'COUNT', 'CHANGE', 'COMPLETE']);

export const TRAINING_STEP_COUNT = TRAINING_STEPS.length;

/** No clock runs in training; the recon HUD reads TRAINING where the timer would be. */
const NO_TIME_LIMIT = 0;

export function clampTrainingStep(step) {
  const index = Math.floor(Number(step));
  if (!Number.isFinite(index)) return 0;
  return Math.min(TRAINING_STEP_COUNT - 1, Math.max(0, index));
}

function trainingData(map) {
  return getMapMetadata(map).training ?? {};
}

/**
 * Which mission a step runs on. Steps that share a mission share a scene, so
 * the tutorial only rebuilds the world when the mode genuinely changes.
 */
export function trainingModeForStep(step) {
  const index = clampTrainingStep(step);
  if (index <= 2) return 'LOCATE';
  if (index === 3) return 'COUNT';
  return 'CHANGE';
}

const BASE = Object.freeze({
  operation: 'ANALYST TRAINING',
  satellitePass: 'TRAINING RANGE // NO LIVE PASS',
  training: true,
  timeLimitSeconds: NO_TIME_LIMIT,
});

export function createTrainingLocateMission(mapSource = TRAINING_MAP_ID) {
  const map = resolveReconMap(mapSource);
  const data = trainingData(map);
  const entities = getMapEntities(map);
  const target = entities.find((entity) => entity.id === data.identifyId);
  if (!target) throw new Error(`Training target '${data.identifyId ?? 'unset'}' is missing from map '${map.id}'.`);
  return {
    ...BASE,
    id: 'TRAINING-LOCATE',
    sector: map.title,
    mapId: map.id,
    mode: 'LOCATE',
    objective: 'TRAINING // STUDY THEN MARK THE TRAINING TARGET.',
    targetId: target.id,
    targetLabel: target.label,
    focus: data.identifyView ?? null,
  };
}

export function createTrainingCountMission(mapSource = TRAINING_MAP_ID) {
  const map = resolveReconMap(mapSource);
  const data = trainingData(map);
  const region = data.countRegion;
  if (!region) throw new Error(`Training map '${map.id}' does not define a count region.`);
  const targetCategory = data.countCategory ?? 'military_vehicle';
  const expectedCount = countEntitiesInRegion(getMapEntities(map), region, targetCategory);
  return {
    ...BASE,
    id: 'TRAINING-COUNT',
    sector: map.title,
    mapId: map.id,
    mode: 'COUNT',
    objective: `TRAINING // COUNT ALL MILITARY VEHICLES INSIDE ${region.label}.`,
    targetCategory,
    targetCategoryLabel: 'MILITARY VEHICLES',
    region: { ...region },
    expectedCount,
  };
}

export function createTrainingChangeMission(mapSource = TRAINING_MAP_ID) {
  const map = resolveReconMap(mapSource);
  const data = trainingData(map);
  const metadata = getMapMetadata(map);
  const target = getMapEntities(map).find((entity) => entity.id === 'jeep-01');
  if (!target) throw new Error(`Training change subject jeep-01 is missing from map '${map.id}'.`);
  const destination = metadata.changeDetection?.destination;
  if (!destination) throw new Error(`Training map '${map.id}' does not define a change destination.`);
  return {
    ...BASE,
    id: 'TRAINING-CHANGE',
    sector: map.title,
    mapId: map.id,
    mode: 'CHANGE',
    objective: 'TRAINING // FIND THE OBJECT THAT MOVED BETWEEN THE TWO PASSES.',
    targetId: target.id,
    targetLabel: target.label,
    changeType: 'vehicle_moved',
    passA: { id: 'A', label: 'PASS A', time: 'TRAINING PASS A' },
    passB: { id: 'B', label: 'PASS B', time: 'TRAINING PASS B' },
    focus: data.changeFocus ?? metadata.recommendedView ?? null,
    passBOperations: [
      { type: 'move_entity', entityId: target.id, x: destination.x, y: destination.y },
    ],
    changeSummary: metadata.changeDetection?.summary ?? `${target.label} moved between the two passes.`,
  };
}

export function createTrainingMission(step, mapSource = TRAINING_MAP_ID) {
  const mode = trainingModeForStep(step);
  if (mode === 'COUNT') return createTrainingCountMission(mapSource);
  if (mode === 'CHANGE') return createTrainingChangeMission(mapSource);
  return createTrainingLocateMission(mapSource);
}

/**
 * The script itself.
 *
 * `requires` lists the console actions a step will not advance without. An
 * empty list is a step the trainee only has to read, and NEXT is live at once.
 */
export function createTrainingScript(mapSource = TRAINING_MAP_ID) {
  const map = resolveReconMap(mapSource);
  const data = trainingData(map);
  const count = createTrainingCountMission(mapSource);
  const target = getMapEntities(map).find((entity) => entity.id === data.identifyId);

  return [
    {
      id: 'NAVIGATION',
      title: 'NAVIGATION',
      objective: 'TRAINING // LEARN TO MOVE AROUND THE IMAGERY.',
      body: [
        'DRAG THE IMAGERY TO PAN THE FIELD OF VIEW.',
        'WHEEL OR PINCH TO ZOOM IN AND OUT.',
        'RESET VIEW RETURNS TO THE BRIEFED FRAMING.',
      ],
      requires: [
        { id: 'pan', label: 'PAN THE IMAGERY' },
        { id: 'zoom', label: 'ZOOM IN OR OUT' },
        { id: 'reset', label: 'PRESS RESET VIEW' },
      ],
      view: data.navigationView ?? null,
    },
    {
      id: 'IDENTIFICATION',
      title: 'IDENTIFICATION',
      objective: 'TRAINING // STUDY THE BRACKETED OBJECT.',
      body: [
        'STUDY SILHOUETTE AND SURROUNDING CONTEXT.',
        `THE BRACKETED OBJECT IS A ${target?.label ?? 'TRAINING TARGET'}.`,
        'SHAPE, SHADOW AND WHAT SURROUNDS AN OBJECT IDENTIFY IT.',
      ],
      requires: [],
      view: data.identifyView ?? null,
      annotate: data.identifyId ?? null,
    },
    {
      id: 'MARKING',
      title: 'MARKING',
      objective: 'TRAINING // MARK AND CONFIRM THE TRAINING TARGET.',
      body: [
        'PRESS MARK TARGET TO ARM THE RETICLE.',
        'TAP THE OBJECT TO PLACE A CANDIDATE MARK.',
        'CANCEL DISCARDS IT. CONFIRM COMMITS THE CALL.',
      ],
      requires: [{ id: 'mark', label: 'CONFIRM THE TRAINING TARGET' }],
      view: data.identifyView ?? null,
    },
    {
      id: 'COUNT',
      title: 'COUNT',
      body: [
        `THE BRACKETED AREA IS ${count.region.label}.`,
        'USE + AND −, OR THE NUMBER KEYS, TO SET A TOTAL.',
        'COUNT ONLY MILITARY VEHICLES, THEN SUBMIT COUNT.',
      ],
      requires: [{ id: 'count', label: 'SUBMIT THE CORRECT TOTAL' }],
    },
    {
      id: 'CHANGE',
      title: 'CHANGE DETECTION',
      body: [
        'PASS A AND PASS B SHOW THE SAME GROUND, MINUTES APART.',
        'SWITCH PASSES — OR USE SPLIT VIEW — TO COMPARE THEM.',
        'MARK THE OBJECT THAT MOVED, THEN CONFIRM.',
      ],
      requires: [
        { id: 'pass', label: 'VIEW PASS B' },
        { id: 'change', label: 'CONFIRM THE OBJECT THAT MOVED' },
      ],
    },
    {
      id: 'COMPLETE',
      title: 'ANALYST CERTIFICATION COMPLETE',
      objective: 'TRAINING // ANALYST CERTIFICATION COMPLETE.',
      body: [
        'NAVIGATION, IDENTIFICATION, MARKING, COUNT AND CHANGE.',
        'THE SAME CONSOLE FLIES EVERY LIVE TASKING.',
        'RETURN TO THE MAIN MENU TO BEGIN.',
      ],
      requires: [],
    },
  ];
}

/** Where ANALYST TRAINING should pick up, given what the console remembers. */
export function resumeTrainingStep() {
  const settings = getSettings();
  return clampTrainingStep(settings.tutorialCompleted ? 0 : settings.tutorialStep ?? 0);
}
