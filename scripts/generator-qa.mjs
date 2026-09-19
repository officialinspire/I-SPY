/**
 * Generator regression QA.
 *
 * Plays the real generator over every playable sector and every mode for a
 * fixed list of seeds and holds each result to the rules a mission has to obey
 * to be solvable and fair. It imports the runtime generator and the runtime
 * schema rather than restating either, so a change to how missions are built
 * is answered here rather than quietly agreed with.
 *
 * Runs as part of `npm run validate`, which CI runs before the production
 * build, so a generator that can produce an unplayable mission cannot deploy.
 */
import {
  MIN_CHANGE_MOVE,
  MIN_GENERATED_COUNT,
  createGeneratedMission,
  matchesCountTarget,
  simulateEntities,
  validateGeneratedMission,
} from '../src/game/missionGenerator.js';
import { findSelectableOverlaps, OVERLAP_LIMIT } from '../src/world/reconMapSchema.js';
import { listReconMaps, resolveReconMap } from '../src/world/mapRegistry.js';
import {
  DIRECTIVE_TYPES,
  calculatePerformanceGrade,
  createMissionDirective,
  evaluateDirective,
} from '../src/game/missionPerformance.js';

const MODES = ['LOCATE', 'COUNT', 'CHANGE'];
/** Seeds per map and mode. Fixed, so a failure names a case that can be replayed. */
const SEED_COUNT = 64;
const seedFor = (index) => `QA-15J-${String(index).padStart(3, '0')}`;

const errors = [];
let checks = 0;
const failures = new Map();
const assert = (condition, key, detail) => {
  checks += 1;
  if (condition) return;
  errors.push(`${key}: ${detail}`);
  failures.set(key, (failures.get(key) ?? 0) + 1);
};

/** Ids this mission put somewhere, which is what its overlap is judged on. */
function placedIds(operations = []) {
  const ids = new Set();
  for (const operation of operations) {
    if (operation?.type === 'move_entity' && operation.entityId) ids.add(operation.entityId);
    else if (operation?.type === 'add_entity' && operation.entity?.id) ids.add(operation.entity.id);
  }
  return ids;
}

function overlapReport(entities, operations) {
  const only = placedIds(operations);
  if (!only.size) return [];
  return findSelectableOverlaps(entities, { only });
}

function operationsInBounds(operations, map) {
  return (operations ?? []).every((operation) => {
    if (operation.type === 'move_entity') {
      return Number.isFinite(operation.x) && Number.isFinite(operation.y)
        && operation.x >= 0 && operation.y >= 0
        && operation.x < map.width && operation.y < map.height;
    }
    const item = operation.entity ?? operation;
    if (operation.type === 'add_entity' || operation.type === 'add_sprite') {
      const width = item.width ?? 64;
      const height = item.height ?? 64;
      return Number.isFinite(item.x) && Number.isFinite(item.y)
        && item.x >= 0 && item.y >= 0
        && item.x + width <= map.width && item.y + height <= map.height;
    }
    return true;
  });
}

let generatedCount = 0;
let fallbackCount = 0;
const countTargetLabels = new Set();
let structureChangeCount = 0;

for (const entry of listReconMaps()) {
  const map = resolveReconMap(entry.id);
  for (const mode of MODES) {
    for (let index = 0; index < SEED_COUNT; index += 1) {
      const seed = seedFor(index);
      const where = `${entry.id}/${mode}/${seed}`;
      const mission = createGeneratedMission({ seed, mode, map: entry.id });

      // --- every mission, however it was produced -------------------------
      assert(mission.mode === mode, 'mode honoured', `${where} produced ${mission.mode}`);
      assert(mission.mapId === entry.id, 'sector honoured', `${where} produced ${mission.mapId}`);
      const validation = validateGeneratedMission(mission, entry.id);
      assert(validation.valid, 'mission validates', `${where} ${validation.errors.join(' ')}`);

      const worldOperations = mission.worldOperations ?? [];
      const passBOperations = mission.passBOperations ?? [];
      assert(operationsInBounds(worldOperations, map), 'pass A operations in bounds', where);
      assert(operationsInBounds(passBOperations, map), 'pass B operations in bounds', where);

      // Determinism: the same request, built twice, is the same mission.
      const repeat = createGeneratedMission({ seed, mode, map: entry.id });
      assert(JSON.stringify(repeat) === JSON.stringify(mission), 'seed reproduces identically', where);
      assert(Boolean(mission.directive?.id && mission.directive?.label), 'directive assigned', where);
      assert(JSON.stringify(createMissionDirective(seed)) === JSON.stringify(mission.directive),
        'directive deterministic from seed', where);

      if (mission.generated) generatedCount += 1;
      else fallbackCount += 1;

      const passA = simulateEntities(map, worldOperations);
      const overlapA = overlapReport(passA, worldOperations);
      assert(overlapA.length === 0, 'no material overlap in PASS A',
        `${where} ${overlapA.map((hit) => `${hit.a}/${hit.b} ${Math.round(hit.ratio * 100)}%`).join(', ')}`);

      if (mode === 'LOCATE') {
        const target = passA.find((item) => item.id === mission.targetId);
        assert(Boolean(target), 'LOCATE target exists', where);
        assert(Boolean(target) && !target.hidden, 'LOCATE target is visible', where);
        assert(Boolean(target?.selectable), 'LOCATE target is selectable', where);
      }

      if (mode === 'COUNT') {
        const region = mission.region;
        const inRegion = passA.filter((item) => matchesCountTarget(item, mission)
          && !item.hidden
          && item.x + item.width / 2 >= region.x && item.x + item.width / 2 <= region.x + region.width
          && item.y + item.height / 2 >= region.y && item.y + item.height / 2 <= region.y + region.height);
        assert(mission.expectedCount >= MIN_GENERATED_COUNT, 'COUNT is a tally, not a yes/no',
          `${where} expected ${mission.expectedCount}`);
        assert(inRegion.length === mission.expectedCount, 'COUNT answer matches the plate',
          `${where} region holds ${inRegion.length}, mission says ${mission.expectedCount}`);
        assert(region.x >= 0 && region.y >= 0
          && region.x + region.width <= map.width && region.y + region.height <= map.height,
        'COUNT region is inside the sector', where);
        if (mission.generated) countTargetLabels.add(mission.targetCategoryLabel);
      }

      if (mode === 'CHANGE') {
        const passB = simulateEntities(map, [...worldOperations, ...passBOperations]);
        const overlapB = overlapReport(passB, [...worldOperations, ...passBOperations]);
        assert(overlapB.length === 0, 'no material overlap in PASS B',
          `${where} ${overlapB.map((hit) => `${hit.a}/${hit.b} ${Math.round(hit.ratio * 100)}%`).join(', ')}`);

        const targetA = passA.find((item) => item.id === mission.targetId);
        const targetB = passB.find((item) => item.id === mission.targetId);
        const visibleA = Boolean(targetA && !targetA.hidden);
        const visibleB = Boolean(targetB && !targetB.hidden);
        assert(visibleA || visibleB, 'CHANGE target is in at least one pass', where);

        if (visibleA && visibleB) {
          const distance = Math.hypot(targetA.x - targetB.x, targetA.y - targetB.y);
          assert(distance >= MIN_CHANGE_MOVE, 'CHANGE move is plainly visible',
            `${where} moved ${Math.round(distance)} units`);
        } else {
          assert(visibleA !== visibleB, 'CHANGE target state differs between passes', where);
        }
        // A disappearance is only readable if the thing was there to begin with.
        if (!visibleB) assert(visibleA, 'disappeared CHANGE target exists in PASS A', where);
        if (!visibleA) assert(visibleB, 'appeared CHANGE target exists in PASS B', where);
        if (mission.generated && mission.changeType === 'structure_changed') structureChangeCount += 1;
      }
    }
  }
}

// Phase 17B contract tests: directive thresholds and grade boundaries.
const directiveSeed = 'QA-DIRECTIVE-STABILITY';
assert(JSON.stringify(createMissionDirective(directiveSeed)) === JSON.stringify(createMissionDirective(directiveSeed)),
  'directive helper deterministic', directiveSeed);

const rapidMission = {
  directive: { id: DIRECTIVE_TYPES.RAPID_ANALYSIS, label: 'RAPID ANALYSIS', description: '' },
  timeLimitSeconds: 100,
};
assert(evaluateDirective(rapidMission, { success: true, errors: 0, elapsedSeconds: 55, remainingSeconds: 45 }).completed,
  'rapid directive includes exact threshold', 'elapsed 55/100');
assert(!evaluateDirective(rapidMission, { success: true, errors: 0, elapsedSeconds: 56, remainingSeconds: 44 }).completed,
  'rapid directive rejects over threshold', 'elapsed 56/100');

const cleanMission = {
  directive: { id: DIRECTIVE_TYPES.CLEAN_SWEEP, label: 'CLEAN SWEEP', description: '' },
  timeLimitSeconds: 100,
};
assert(evaluateDirective(cleanMission, { success: true, errors: 0, elapsedSeconds: 80, remainingSeconds: 20 }).completed,
  'clean sweep includes exact reserve threshold', 'remaining 20/100');
assert(!evaluateDirective(cleanMission, { success: true, errors: 1, elapsedSeconds: 60, remainingSeconds: 40 }).completed,
  'clean sweep rejects errors', 'one error');

assert(calculatePerformanceGrade({ success: true, errors: 0, remainingSeconds: 100, timeLimitSeconds: 100 }).grade === 'S',
  'grade S boundary works', 'perfect reserve');
assert(calculatePerformanceGrade({ success: true, errors: 0, remainingSeconds: 50, timeLimitSeconds: 100 }).grade === 'A',
  'grade A boundary works', 'half reserve');
assert(calculatePerformanceGrade({ success: true, errors: 0, remainingSeconds: 20, timeLimitSeconds: 100 }).grade === 'B',
  'grade B boundary works', 'low reserve');
assert(calculatePerformanceGrade({ success: false, errors: 0, remainingSeconds: 100, timeLimitSeconds: 100 }).grade === 'C',
  'failed mission grades C', 'failure');

assert(countTargetLabels.size >= 3, 'COUNT target variety exercised',
  `saw ${[...countTargetLabels].join(', ')}`);
assert(structureChangeCount > 0, 'structure CHANGE variants exercised',
  `saw ${structureChangeCount} generated structure changes`);

const total = listReconMaps().length * MODES.length * SEED_COUNT;
if (errors.length) {
  console.error('I SPY generator QA FAILED');
  [...failures.entries()].sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
    console.error(`  ${count} x ${key}`);
  });
  errors.slice(0, 20).forEach((message) => console.error(`  - ${message}`));
  if (errors.length > 20) console.error(`  ...and ${errors.length - 20} more`);
  process.exit(1);
}

console.log(`I SPY generator QA passed: ${checks} checks over ${total} missions.`);
console.log(`Sectors: ${listReconMaps().map((entry) => entry.id).join(', ')}`);
console.log(`Modes: ${MODES.join(', ')} x ${SEED_COUNT} seeds`);
console.log(`Generated: ${generatedCount}; authored fallback: ${fallbackCount}; overlap limit ${Math.round(OVERLAP_LIMIT * 100)}%; min CHANGE move ${MIN_CHANGE_MOVE}; min COUNT ${MIN_GENERATED_COUNT}.`);
console.log(`COUNT targets exercised: ${[...countTargetLabels].join(', ')}; structure CHANGE missions: ${structureChangeCount}.`);
