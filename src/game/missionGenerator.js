import { GAME_CONFIG } from '../runtime-config.js';
import { findSelectableOverlaps, getMapEntities, getMapLayer, getMapSpawnZones } from '../world/reconMapSchema.js';
import { isAnySector, listReconMaps, resolveReconMap, resolveReconMapEntry } from '../world/mapRegistry.js';
import { createLocateMission } from './locateMission.js';
import { createCountMission } from './countMission.js';
import { createChangeDetectionMission, CHANGE_TYPES } from './changeDetectionMission.js';
import { createMissionDirective } from './missionPerformance.js';
import { isConditionAllowed, withMissionCondition } from './environmentConditions.js';

const MODES = Object.freeze(['LOCATE', 'COUNT', 'CHANGE']);
const CLUE_SPRITES = Object.freeze(['tire_tracks', 'track_marks', 'disturbed_soil', 'cut_vegetation', 'crates', 'barrels', 'camouflage_net']);
const LOCATE_OBJECTIVES = Object.freeze([
  (label) => `LOCATE AND IDENTIFY THE ${label}.`,
  (label) => `FIND THE ${label} BEFORE THE SATELLITE WINDOW CLOSES.`,
  (label) => `CONFIRM THE POSITION OF THE ${label}.`,
]);

const COUNT_TARGETS = Object.freeze([
  Object.freeze({ field: 'category', value: 'military_vehicle', label: 'MILITARY VEHICLES' }),
  Object.freeze({ field: 'category', value: 'civilian_vehicle', label: 'CIVILIAN VEHICLES' }),
  Object.freeze({ field: 'category', value: 'strategic_installation', label: 'STRATEGIC INSTALLATIONS' }),
  Object.freeze({ field: 'category', value: 'industrial_structure', label: 'INDUSTRIAL STRUCTURES' }),
  Object.freeze({ field: 'type', value: 'military_truck', label: 'MILITARY TRUCKS' }),
  Object.freeze({ field: 'type', value: 'civilian_truck', label: 'CIVILIAN TRUCKS' }),
  Object.freeze({ field: 'type', value: 'tractor', label: 'TRACTORS' }),
]);

function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 0xFFFFFF).toString(36).padStart(5, '0').toUpperCase();
  return `${time}-${random}`;
}

function pick(rng, items) {
  if (!items?.length) return null;
  return items[Math.floor(rng() * items.length)];
}

function integer(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function range(rng, min, max, digits = 0) {
  const value = min + rng() * (max - min);
  return Number(value.toFixed(digits));
}

function cloneEntity(entity) {
  return { ...entity, clueTags: [...(entity.clueTags ?? [])] };
}

const authoredEntities = getMapEntities;
const authoredZones = getMapSpawnZones;

function compatibleZones(entity, zones) {
  return zones.filter((zone) => zone.accepts?.includes(entity.type) || zone.accepts?.includes(entity.sprite));
}

function placementInZone(rng, zone, entity, slot = 0, total = 1) {
  const width = entity.width ?? 64;
  const height = entity.height ?? 64;
  const padding = 12;
  const usableWidth = Math.max(1, zone.width - width - padding * 2);
  const segment = usableWidth / Math.max(1, total);
  const segmentStart = zone.x + padding + segment * slot;
  const maxX = Math.min(zone.x + zone.width - width - padding, segmentStart + segment - width * 0.2);
  const x = Math.max(zone.x + padding, Math.min(maxX, segmentStart + rng() * Math.max(1, maxX - segmentStart)));
  const minY = zone.y + padding;
  const maxY = Math.max(minY, zone.y + zone.height - height - padding);
  const y = minY + rng() * Math.max(1, maxY - minY);
  return { x: Math.round(x), y: Math.round(y) };
}

function addClues(rng, map, anchor, count) {
  const operations = [];
  for (let index = 0; index < count; index += 1) {
    const sprite = pick(rng, CLUE_SPRITES);
    const width = 64;
    const height = 64;
    const x = Math.max(0, Math.min(map.width - width, anchor.x + integer(rng, -110, 110)));
    const y = Math.max(0, Math.min(map.height - height, anchor.y + integer(rng, -90, 90)));
    operations.push({ type: 'add_sprite', sprite, x, y, width, height, alpha: range(rng, 0.72, 0.96, 2) });
  }
  return operations;
}

function difficultyProfile(map) {
  const level = Math.max(1, Math.min(4, Math.floor(resolveReconMapEntry(map).difficulty ?? 1)));
  return { level, ...(GAME_CONFIG.generator.difficulty[level] ?? {}) };
}

function visualModifiers(rng, map) {
  const profile = difficultyProfile(map);
  return {
    grain: Math.min(GAME_CONFIG.generator.visual.grainMax,
      range(rng, GAME_CONFIG.generator.visual.grainMin, GAME_CONFIG.generator.visual.grainMax, 2) + (profile.grainBonus ?? 0)),
    haze: Math.min(GAME_CONFIG.generator.visual.hazeMax,
      range(rng, GAME_CONFIG.generator.visual.hazeMin, GAME_CONFIG.generator.visual.hazeMax, 3) + (profile.hazeBonus ?? 0)),
    contrast: range(rng, GAME_CONFIG.generator.visual.contrastMin, GAME_CONFIG.generator.visual.contrastMax, 2),
  };
}

function generatedTimeLimit(rng, map) {
  const profile = difficultyProfile(map);
  return pick(rng, profile.timeLimits ?? GAME_CONFIG.generator.timeLimits) ?? 90;
}

function generatedDecoyCount(rng, map, available) {
  const profile = difficultyProfile(map);
  const min = Math.min(available, GAME_CONFIG.generator.decoysMin + Math.min(1, profile.decoyBonus ?? 0));
  const max = Math.min(available, GAME_CONFIG.generator.decoysMax + (profile.decoyBonus ?? 0));
  return max > 0 ? integer(rng, Math.min(min, max), max) : 0;
}

export function matchesCountTarget(entity, mission) {
  if (!entity || entity.hidden) return false;
  if (mission?.targetType) return entity.type === mission.targetType;
  return entity.category === mission?.targetCategory;
}

/**
 * The entity state a set of operations leaves behind.
 *
 * Exported so the release QA can read the same final state the validator
 * judges, rather than keeping a second copy of what an operation means.
 */
export function simulateEntities(map, operations = []) {
  const entities = authoredEntities(map);
  for (const operation of operations) {
    if (operation.type === 'move_entity') {
      const entity = entities.find((item) => item.id === operation.entityId);
      if (entity) {
        entity.x = operation.x;
        entity.y = operation.y;
        entity.hidden = false;
      }
    } else if (operation.type === 'hide_entity' || operation.type === 'remove_entity') {
      const entity = entities.find((item) => item.id === operation.entityId);
      if (entity) entity.hidden = true;
    } else if (operation.type === 'add_entity' && operation.entity) {
      entities.push(cloneEntity(operation.entity));
    }
  }
  return entities;
}

function entityCenterInRegion(entity, region) {
  const x = entity.x + entity.width / 2;
  const y = entity.y + entity.height / 2;
  return !entity.hidden && x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
}

function gridLabel(map, region) {
  const grid = getMapLayer(map, 'metadata')?.data?.gridSize ?? 300;
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  const column = String.fromCharCode(65 + Math.max(0, Math.min(25, Math.floor(centerX / grid))));
  const row = Math.max(1, Math.floor(centerY / grid) + 1);
  return `GRID ${column}-${row}`;
}

function operationBoundsValid(operation, map) {
  if (operation.type === 'move_entity') return Number.isFinite(operation.x) && Number.isFinite(operation.y) && operation.x >= 0 && operation.y >= 0 && operation.x < map.width && operation.y < map.height;
  const item = operation.entity ?? operation;
  if (operation.type === 'add_entity' || operation.type === 'add_sprite') {
    const width = item.width ?? 64;
    const height = item.height ?? 64;
    return Number.isFinite(item.x) && Number.isFinite(item.y) && item.x >= 0 && item.y >= 0 && item.x + width <= map.width && item.y + height <= map.height;
  }
  return true;
}

/**
 * The shortest move a CHANGE event may call a change.
 *
 * Comparing two passes is a visual diff: a shift of a few pixels reads as
 * registration noise between frames, not as something that drove away. This is
 * the distance at which the object has plainly left where it was.
 */
export const MIN_CHANGE_MOVE = 90;

/** A generated COUNT is a tally, and a tally of one is a yes/no question. */
export const MIN_GENERATED_COUNT = 2;

/**
 * The entities a mission's own operations put somewhere.
 *
 * Overlap is judged against these rather than the whole plate: a map's own
 * crowding is the map's to answer for (the release validator checks it), while
 * anything the generator moved or added landing on top of something is this
 * mission's fault and is worth another attempt.
 */
function placedEntityIds(operations = []) {
  const ids = new Set();
  for (const operation of operations) {
    if (operation?.type === 'move_entity' && operation.entityId) ids.add(operation.entityId);
    else if (operation?.type === 'add_entity' && operation.entity?.id) ids.add(operation.entity.id);
  }
  return ids;
}

function overlapErrors(entities, operations, passLabel) {
  const placed = placedEntityIds(operations);
  if (!placed.size) return [];
  return findSelectableOverlaps(entities, { only: placed }).map(
    ({ a, b, ratio }) => `${passLabel}: '${a}' and '${b}' overlap by ${Math.round(ratio * 100)}% of the smaller object.`,
  );
}

function createLocateGenerated(rng, seed, map) {
  const entities = authoredEntities(map);
  const zones = authoredZones(map);
  const candidates = entities.filter((entity) => entity.selectable
    && ['military_vehicle', 'strategic_installation'].includes(entity.category)
    && compatibleZones(entity, zones).length > 0);
  if (candidates.length < 2) throw new Error('LOCATE needs at least two valid priority-contact candidates.');

  // A generated LOCATE mission is now a short search sequence rather than a
  // one-click spot check. Two independent contacts keeps a normal round in the
  // 2–5 minute band without changing the single-target authored/training flow.
  const targetPool = [...candidates];
  const targets = [];
  while (targets.length < 2 && targetPool.length) {
    targets.push(targetPool.splice(Math.floor(rng() * targetPool.length), 1)[0]);
  }

  const operations = [];
  const targetPositions = [];
  targets.forEach((target) => {
    const targetZone = pick(rng, compatibleZones(target, zones));
    const targetPosition = placementInZone(rng, targetZone, target);
    targetPositions.push(targetPosition);
    operations.push({ type: 'move_entity', entityId: target.id, ...targetPosition });
  });

  const targetIds = new Set(targets.map((target) => target.id));
  const decoyCandidates = entities.filter((entity) => !targetIds.has(entity.id)
    && entity.selectable && compatibleZones(entity, zones).length > 0);
  const decoyCount = generatedDecoyCount(rng, map, decoyCandidates.length);
  for (let index = 0; index < decoyCount; index += 1) {
    const decoy = decoyCandidates.splice(Math.floor(rng() * decoyCandidates.length), 1)[0];
    const zone = pick(rng, compatibleZones(decoy, zones));
    operations.push({ type: 'move_entity', entityId: decoy.id, ...placementInZone(rng, zone, decoy) });
  }

  targets.forEach((target, index) => {
    operations.push(...addClues(rng, map, targetPositions[index],
      integer(rng, GAME_CONFIG.generator.cluesMin, GAME_CONFIG.generator.cluesMax)));
  });

  const targetLabels = targets.map((target) => target.label);
  const objective = `LOCATE AND IDENTIFY BOTH PRIORITY CONTACTS: ${targetLabels.join(' + ')}.`;
  return {
    id: `GEN-LOCATE-${hashSeed(seed).toString(16).toUpperCase()}`,
    operation: pick(rng, ['OPERATION COLD LENS', 'OPERATION WATCHTOWER', 'OPERATION SILENT ORBIT']),
    satellitePass: `${String(integer(rng, 0, 23)).padStart(2, '0')}:${String(integer(rng, 0, 59)).padStart(2, '0')} ZULU`,
    sector: map.title,
    mapId: map.id,
    mode: 'LOCATE',
    objective,
    targetId: targets[0].id,
    targetLabel: targetLabels.join(' + '),
    targetIds: targets.map((target) => target.id),
    targets: targets.map((target) => ({ id: target.id, label: target.label })),
    worldOperations: operations,
    timeLimitSeconds: generatedTimeLimit(rng, map),
    visualModifiers: visualModifiers(rng, map),
    generated: true,
    seed,
  };
}

function createCountGenerated(rng, seed, map) {
  const entities = authoredEntities(map);
  const zones = authoredZones(map);

  const plans = [];
  for (const target of COUNT_TARGETS) {
    for (const zone of zones) {
      const matching = entities.filter((entity) => entity.selectable
        && entity[target.field] === target.value
        && (zone.accepts?.includes(entity.type) || zone.accepts?.includes(entity.sprite)));
      if (matching.length >= MIN_GENERATED_COUNT) plans.push({ target, zone, matching });
    }
  }

  const plan = pick(rng, plans);
  if (!plan) throw new Error('No COUNT target/zone combination has at least two compatible objects.');

  const pool = [...plan.matching];
  const minimumCount = Math.min(pool.length, Math.max(MIN_GENERATED_COUNT, 3));
  const selectedCount = integer(rng, minimumCount, Math.min(5, pool.length));
  const selectedTargets = [];
  while (selectedTargets.length < selectedCount && pool.length) {
    selectedTargets.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }

  const decoyPool = entities.filter((entity) => entity.selectable
    && entity[plan.target.field] !== plan.target.value
    && (plan.zone.accepts?.includes(entity.type) || plan.zone.accepts?.includes(entity.sprite)));
  const decoyCount = decoyPool.length ? Math.min(decoyPool.length, difficultyProfile(map).level >= 3 ? 2 : 1) : 0;
  const totalSlots = selectedTargets.length + decoyCount;
  const operations = [];

  selectedTargets.forEach((entity, index) => {
    operations.push({
      type: 'move_entity',
      entityId: entity.id,
      ...placementInZone(rng, plan.zone, entity, index, Math.max(1, totalSlots)),
    });
  });

  for (let index = 0; index < decoyCount; index += 1) {
    const decoy = decoyPool.splice(Math.floor(rng() * decoyPool.length), 1)[0];
    operations.push({
      type: 'move_entity',
      entityId: decoy.id,
      ...placementInZone(rng, plan.zone, decoy, selectedTargets.length + index, Math.max(1, totalSlots)),
    });
  }

  const padding = 36;
  const region = {
    x: Math.max(0, plan.zone.x - padding),
    y: Math.max(0, plan.zone.y - padding),
    width: Math.min(map.width - Math.max(0, plan.zone.x - padding), plan.zone.width + padding * 2),
    height: Math.min(map.height - Math.max(0, plan.zone.y - padding), plan.zone.height + padding * 2),
  };
  region.id = `generated-${plan.zone.id}`;
  region.label = gridLabel(map, region);

  const targetFields = plan.target.field === 'type'
    ? { targetType: plan.target.value, targetCategory: null }
    : { targetCategory: plan.target.value, targetType: null };
  const provisionalMission = { ...targetFields };
  const simulated = simulateEntities(map, operations);
  const expectedCount = simulated.filter((entity) => matchesCountTarget(entity, provisionalMission)
    && entityCenterInRegion(entity, region)).length;

  return {
    id: `GEN-COUNT-${hashSeed(seed).toString(16).toUpperCase()}`,
    operation: pick(rng, ['OPERATION ROAD COUNT', 'OPERATION GREY COLUMN', 'OPERATION MOTOR POOL', 'OPERATION LEDGER GLASS']),
    satellitePass: `${String(integer(rng, 0, 23)).padStart(2, '0')}:${String(integer(rng, 0, 59)).padStart(2, '0')} ZULU`,
    sector: map.title,
    mapId: map.id,
    mode: 'COUNT',
    objective: `COUNT ALL ${plan.target.label} INSIDE ${region.label}.`,
    ...targetFields,
    targetCategoryLabel: plan.target.label,
    region,
    expectedCount,
    worldOperations: operations,
    timeLimitSeconds: generatedTimeLimit(rng, map),
    visualModifiers: visualModifiers(rng, map),
    generated: true,
    seed,
  };
}

function createChangeGenerated(rng, seed, map) {
  const entities = authoredEntities(map);
  const zones = authoredZones(map);
  const vehicles = entities.filter((entity) => entity.selectable
    && entity.category === 'military_vehicle' && compatibleZones(entity, zones).length > 0);
  const structures = entities.filter((entity) => entity.selectable
    && ['strategic_installation', 'industrial_structure'].includes(entity.category)
    && compatibleZones(entity, zones).length > 0);

  const eventPool = [];
  if (vehicles.length) eventPool.push('vehicle_moved', 'vehicle_disappeared', 'vehicle_appeared');
  if (structures.length) eventPool.push('structure_disappeared', 'structure_appeared');
  const eventType = pick(rng, eventPool);
  if (!eventType) throw new Error('No compatible CHANGE event can be generated.');

  const worldOperations = [];
  const passBOperations = [];
  let target;
  let targetId;
  let targetLabel;
  let changeType;
  let changeSummary;
  let focus;

  const appeared = eventType.endsWith('_appeared');
  const disappeared = eventType.endsWith('_disappeared');
  const structureEvent = eventType.startsWith('structure_');
  const sourcePool = structureEvent ? structures : vehicles;

  if (appeared) {
    const template = pick(rng, sourcePool);
    const zone = pick(rng, compatibleZones(template, zones));
    const position = placementInZone(rng, zone, template);
    targetId = `generated-contact-${hashSeed(`${seed}:${eventType}:contact`).toString(16)}`;
    targetLabel = template.label;
    target = { ...cloneEntity(template), id: targetId, ...position, target: true, selectable: true };
    passBOperations.push({ type: 'add_entity', entity: target });
    if (!structureEvent) passBOperations.push(...addClues(rng, map, position, 1));
    changeType = structureEvent ? CHANGE_TYPES.STRUCTURE_CHANGED : CHANGE_TYPES.VEHICLE_APPEARED;
    changeSummary = `${targetLabel} appeared between PASS A and PASS B.`;
    focus = { x: position.x + target.width / 2, y: position.y + target.height / 2, zoom: 0.66 };
  } else {
    target = pick(rng, sourcePool);
    if (!target) throw new Error('No compatible target exists for a CHANGE event.');
    targetId = target.id;
    targetLabel = target.label;
    const zonesForTarget = compatibleZones(target, zones);
    const startZone = pick(rng, zonesForTarget);
    const start = placementInZone(rng, startZone, target, 0, 2);
    worldOperations.push({ type: 'move_entity', entityId: target.id, ...start });

    if (disappeared) {
      passBOperations.push({ type: 'hide_entity', entityId: target.id });
      if (!structureEvent) passBOperations.push(...addClues(rng, map, start, 1));
      changeType = structureEvent ? CHANGE_TYPES.STRUCTURE_CHANGED : CHANGE_TYPES.VEHICLE_DISAPPEARED;
      changeSummary = `${targetLabel} disappeared between PASS A and PASS B.`;
      focus = { x: start.x + target.width / 2, y: start.y + target.height / 2, zoom: 0.66 };
    } else {
      const destinationZone = zonesForTarget.length > 1
        ? pick(rng, zonesForTarget.filter((zone) => zone.id !== startZone.id)) : startZone;
      const destination = placementInZone(rng, destinationZone ?? startZone, target, 1, 2);
      passBOperations.push({ type: 'move_entity', entityId: target.id, ...destination });
      passBOperations.push(...addClues(rng, map, destination, 1));
      changeType = CHANGE_TYPES.VEHICLE_MOVED;
      changeSummary = `${targetLabel} changed position between the two reconnaissance passes.`;
      focus = {
        x: Math.round((start.x + destination.x) / 2),
        y: Math.round((start.y + destination.y) / 2),
        zoom: 0.62,
      };
    }
  }

  // Add a small amount of unchanged context traffic. These contacts move to
  // their generated position in both passes, so they make the plate denser
  // without creating a second answer or a misleading extra change.
  const contextPool = entities.filter((entity) => entity.selectable
    && entity.id !== targetId
    && compatibleZones(entity, zones).length > 0);
  const contextCount = Math.min(contextPool.length, difficultyProfile(map).level >= 3 ? 2 : 1);
  for (let index = 0; index < contextCount; index += 1) {
    const decoy = contextPool.splice(Math.floor(rng() * contextPool.length), 1)[0];
    const zone = pick(rng, compatibleZones(decoy, zones));
    worldOperations.push({
      type: 'move_entity',
      entityId: decoy.id,
      ...placementInZone(rng, zone, decoy, index, Math.max(1, contextCount)),
    });
  }

  const firstHour = integer(rng, 0, 22);
  const firstMinute = integer(rng, 0, 44);
  const interval = integer(rng, 8, 15);
  const secondMinuteTotal = firstHour * 60 + firstMinute + interval;
  const passATime = `${String(firstHour).padStart(2, '0')}:${String(firstMinute).padStart(2, '0')} ZULU`;
  const passBTime = `${String(Math.floor(secondMinuteTotal / 60) % 24).padStart(2, '0')}:${String(secondMinuteTotal % 60).padStart(2, '0')} ZULU`;

  const objective = structureEvent
    ? `IDENTIFY THE STRUCTURE THAT ${appeared ? 'APPEARED' : 'DISAPPEARED'} BETWEEN PASS A AND PASS B.`
    : appeared
      ? 'IDENTIFY THE OBJECT THAT APPEARED BETWEEN PASS A AND PASS B.'
      : disappeared
        ? 'IDENTIFY THE OBJECT THAT DISAPPEARED BETWEEN PASS A AND PASS B.'
        : 'IDENTIFY THE OBJECT THAT CHANGED POSITION BETWEEN PASS A AND PASS B.';

  return {
    id: `GEN-CHANGE-${hashSeed(seed).toString(16).toUpperCase()}`,
    operation: pick(rng, ['OPERATION SECOND FRAME', 'OPERATION TIME SLICE', 'OPERATION GREY ECHO']),
    satellitePass: `PASS A ${passATime} // PASS B ${passBTime}`,
    sector: map.title,
    mapId: map.id,
    mode: 'CHANGE',
    objective,
    targetId,
    targetLabel,
    changeType,
    changeEvent: eventType,
    passA: { id: 'A', label: 'PASS A', time: passATime },
    passB: { id: 'B', label: 'PASS B', time: passBTime },
    worldOperations,
    passBOperations,
    changeSummary,
    focus,
    timeLimitSeconds: generatedTimeLimit(rng, map),
    visualModifiers: visualModifiers(rng, map),
    generated: true,
    seed,
  };
}

/**
 * Validates against the mission's own sector unless a map is passed
 * explicitly, so a mission generated for one map can never be checked
 * against another.
 */
export function validateGeneratedMission(mission, mapSource) {
  const map = resolveReconMap(isAnySector(mapSource) ? mission?.mapId : mapSource);
  const errors = [];
  if (!mission || !MODES.includes(mission.mode)) return { valid: false, errors: ['Generated mission mode is invalid.'] };
  if (!mission.seed) errors.push('Generated mission is missing a seed.');
  if (!mission.condition) errors.push('Generated mission is missing an environmental condition.');
  else if (!isConditionAllowed(mission.mapId, mission.condition)) errors.push(`Environmental condition '${mission.condition}' is not allowed in sector '${mission.mapId}'.`);
  if (!Number.isFinite(mission.timeLimitSeconds) || mission.timeLimitSeconds <= 0) errors.push('Generated mission time limit is invalid.');
  for (const operation of [...(mission.worldOperations ?? []), ...(mission.passBOperations ?? [])]) {
    if (!operationBoundsValid(operation, map)) errors.push(`Operation '${operation.type ?? 'unknown'}' exceeds map bounds.`);
  }

  const worldOperations = mission.worldOperations ?? [];
  const passBOperations = mission.passBOperations ?? [];
  const passA = simulateEntities(map, worldOperations);
  // A mark has to resolve to one object, so nothing this mission placed may
  // sit materially on top of another selectable object — in either pass.
  errors.push(...overlapErrors(passA, worldOperations, 'PASS A'));

  if (mission.mode === 'LOCATE') {
    const ids = Array.isArray(mission.targetIds) && mission.targetIds.length
      ? mission.targetIds
      : [mission.targetId].filter(Boolean);
    if (!ids.length) errors.push('LOCATE mission has no targets.');
    if (mission.generated && ids.length < 2) errors.push('Generated LOCATE mission needs at least two priority contacts.');
    for (const id of ids) {
      const target = passA.find((entity) => entity.id === id);
      if (!target || target.hidden || !target.selectable) {
        errors.push(`LOCATE target '${id}' is not visible/selectable after generation.`);
      }
    }
  }

  if (mission.mode === 'COUNT') {
    const region = mission.region;
    if (!region || region.x < 0 || region.y < 0 || region.x + region.width > map.width || region.y + region.height > map.height) errors.push('COUNT region is outside map bounds.');
    const count = passA.filter((entity) => matchesCountTarget(entity, mission) && entityCenterInRegion(entity, region)).length;
    if (count < MIN_GENERATED_COUNT) errors.push(`COUNT mission generated ${count} target object(s); a tally needs at least ${MIN_GENERATED_COUNT}.`);
    if (count !== mission.expectedCount) errors.push('COUNT expected answer does not match generated entity state.');
  }

  if (mission.mode === 'CHANGE') {
    const passB = simulateEntities(map, [...worldOperations, ...passBOperations]);
    errors.push(...overlapErrors(passB, [...worldOperations, ...passBOperations], 'PASS B'));
    const targetA = passA.find((entity) => entity.id === mission.targetId);
    const targetB = passB.find((entity) => entity.id === mission.targetId);
    const visibleA = Boolean(targetA && !targetA.hidden);
    const visibleB = Boolean(targetB && !targetB.hidden);
    const distance = visibleA && visibleB ? Math.hypot(targetA.x - targetB.x, targetA.y - targetB.y) : 0;
    const moved = distance >= MIN_CHANGE_MOVE;
    if (!visibleA && !visibleB) errors.push('CHANGE target is not visible in either pass.');
    if (visibleA === visibleB && !moved) errors.push(`CHANGE target moved ${Math.round(distance)} units; a visible move is at least ${MIN_CHANGE_MOVE}.`);
  }

  return { valid: errors.length === 0, errors };
}

function fallbackMission(mode, seed, map) {
  const fallback = mode === 'COUNT' ? createCountMission(map) : mode === 'CHANGE' ? createChangeDetectionMission(map) : createLocateMission(map);
  return withMissionCondition({
    ...fallback,
    generated: false,
    seed,
    directive: createMissionDirective(seed),
    generationWarning: 'Generator exhausted validation attempts; using authored fallback.',
  }, seed);
}

/**
 * Picks the sector for a seed when none is named.
 *
 * The draw runs on its own RNG stream, keyed `<seed>:sector`, so choosing a
 * sector never shifts the mission stream: a seed produces the same mission on
 * a given map whether that map was chosen by the seed or named explicitly.
 */
function selectReconMap(seed, mapSource) {
  if (!isAnySector(mapSource)) return resolveReconMap(mapSource);
  const entries = listReconMaps();
  const rng = mulberry32(hashSeed(`${seed}:sector`));
  return (entries[Math.floor(rng() * entries.length)] ?? entries[0]).map;
}

/**
 * `map` may be a registry id, a registry entry or raw map data. Omitting it,
 * or passing 'any', lets the seed choose the sector as well as the task.
 */
export function createGeneratedMission({ seed = randomSeed(), mode = null, map: mapSource = null } = {}) {
  const map = selectReconMap(seed, mapSource);
  const normalizedMode = MODES.includes(String(mode).toUpperCase()) ? String(mode).toUpperCase() : null;
  for (let attempt = 0; attempt < GAME_CONFIG.generator.maxAttempts; attempt += 1) {
    const rng = mulberry32(hashSeed(`${seed}:${attempt}`));
    const selectedMode = normalizedMode ?? pick(rng, MODES);
    let mission;
    try {
      mission = selectedMode === 'COUNT'
        ? createCountGenerated(rng, seed, map)
        : selectedMode === 'CHANGE'
          ? createChangeGenerated(rng, seed, map)
          : createLocateGenerated(rng, seed, map);
    } catch (error) {
      continue;
    }
    mission = withMissionCondition(mission, seed);
    mission.generationAttempt = attempt + 1;
    const validation = validateGeneratedMission(mission, map);
    if (validation.valid) return { ...mission, directive: createMissionDirective(seed) };
  }
  return fallbackMission(normalizedMode ?? 'LOCATE', seed, map);
}

export function getGeneratorOptions(search = globalThis.location?.search ?? '') {
  const params = new URLSearchParams(search);
  return {
    seed: params.get('seed') || undefined,
    mode: params.get('mode') || undefined,
    map: params.get('map') || undefined,
    debugMission: params.get('debugMission') === '1',
  };
}
