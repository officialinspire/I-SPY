import { GAME_CONFIG } from '../runtime-config.js';
import { getMapEntities, getMapLayer, getMapSpawnZones } from '../world/reconMapSchema.js';
import { isAnySector, listReconMaps, resolveReconMap } from '../world/mapRegistry.js';
import { createLocateMission } from './locateMission.js';
import { createCountMission } from './countMission.js';
import { createChangeDetectionMission, CHANGE_TYPES } from './changeDetectionMission.js';

const MODES = Object.freeze(['LOCATE', 'COUNT', 'CHANGE']);
const CLUE_SPRITES = Object.freeze(['tire_tracks', 'track_marks', 'disturbed_soil', 'cut_vegetation', 'crates', 'barrels', 'camouflage_net']);
const LOCATE_OBJECTIVES = Object.freeze([
  (label) => `LOCATE AND IDENTIFY THE ${label}.`,
  (label) => `FIND THE ${label} BEFORE THE SATELLITE WINDOW CLOSES.`,
  (label) => `CONFIRM THE POSITION OF THE ${label}.`,
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

function visualModifiers(rng) {
  return {
    grain: range(rng, GAME_CONFIG.generator.visual.grainMin, GAME_CONFIG.generator.visual.grainMax, 2),
    haze: range(rng, GAME_CONFIG.generator.visual.hazeMin, GAME_CONFIG.generator.visual.hazeMax, 2),
    contrast: range(rng, GAME_CONFIG.generator.visual.contrastMin, GAME_CONFIG.generator.visual.contrastMax, 2),
  };
}

function generatedTimeLimit(rng) {
  return pick(rng, GAME_CONFIG.generator.timeLimits) ?? 90;
}

function simulateEntities(map, operations = []) {
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

function createLocateGenerated(rng, seed, map) {
  const entities = authoredEntities(map);
  const zones = authoredZones(map);
  const candidates = entities.filter((entity) => entity.selectable && ['military_vehicle', 'strategic_installation'].includes(entity.category) && compatibleZones(entity, zones).length > 0);
  const target = pick(rng, candidates);
  if (!target) throw new Error('No valid LOCATE target candidates are available.');

  const targetZone = pick(rng, compatibleZones(target, zones));
  const targetPosition = placementInZone(rng, targetZone, target);
  const operations = [{ type: 'move_entity', entityId: target.id, ...targetPosition }];

  const decoyCandidates = entities.filter((entity) => entity.id !== target.id && entity.selectable && compatibleZones(entity, zones).length > 0);
  const decoyCount = Math.min(decoyCandidates.length, integer(rng, GAME_CONFIG.generator.decoysMin, GAME_CONFIG.generator.decoysMax));
  for (let index = 0; index < decoyCount; index += 1) {
    const decoy = decoyCandidates.splice(Math.floor(rng() * decoyCandidates.length), 1)[0];
    const zone = pick(rng, compatibleZones(decoy, zones));
    operations.push({ type: 'move_entity', entityId: decoy.id, ...placementInZone(rng, zone, decoy) });
  }

  operations.push(...addClues(rng, map, targetPosition, integer(rng, GAME_CONFIG.generator.cluesMin, GAME_CONFIG.generator.cluesMax)));
  const objective = pick(rng, LOCATE_OBJECTIVES)(target.label);
  return {
    id: `GEN-LOCATE-${hashSeed(seed).toString(16).toUpperCase()}`,
    operation: pick(rng, ['OPERATION COLD LENS', 'OPERATION WATCHTOWER', 'OPERATION SILENT ORBIT']),
    satellitePass: `${String(integer(rng, 0, 23)).padStart(2, '0')}:${String(integer(rng, 0, 59)).padStart(2, '0')} ZULU`,
    sector: map.title,
    mapId: map.id,
    mode: 'LOCATE',
    objective,
    targetId: target.id,
    targetLabel: target.label,
    worldOperations: operations,
    timeLimitSeconds: generatedTimeLimit(rng),
    visualModifiers: visualModifiers(rng),
    generated: true,
    seed,
  };
}

function createCountGenerated(rng, seed, map) {
  const entities = authoredEntities(map);
  const zones = authoredZones(map);
  const roadZones = zones.filter((zone) => zone.tag === 'road_vehicle');
  const zone = pick(rng, roadZones);
  if (!zone) throw new Error('No road vehicle zone is available for generated COUNT missions.');

  const military = entities.filter((entity) => entity.category === 'military_vehicle' && zone.accepts.includes(entity.type));
  if (!military.length) throw new Error('No military vehicle entities are compatible with the COUNT region.');
  const selectedTargets = military.slice(0, Math.min(military.length, integer(rng, 1, Math.min(3, military.length))));
  const operations = [];
  const totalSlots = selectedTargets.length + 1;
  selectedTargets.forEach((entity, index) => {
    operations.push({ type: 'move_entity', entityId: entity.id, ...placementInZone(rng, zone, entity, index, totalSlots) });
  });

  const civilianTruck = entities.find((entity) => entity.type === 'civilian_truck' && zone.accepts.includes(entity.type));
  if (civilianTruck) operations.push({ type: 'move_entity', entityId: civilianTruck.id, ...placementInZone(rng, zone, civilianTruck, totalSlots - 1, totalSlots) });

  const padding = 36;
  const region = {
    x: Math.max(0, zone.x - padding),
    y: Math.max(0, zone.y - padding),
    width: Math.min(map.width - Math.max(0, zone.x - padding), zone.width + padding * 2),
    height: Math.min(map.height - Math.max(0, zone.y - padding), zone.height + padding * 2),
  };
  region.id = `generated-${zone.id}`;
  region.label = gridLabel(map, region);

  const simulated = simulateEntities(map, operations);
  const expectedCount = simulated.filter((entity) => entity.category === 'military_vehicle' && entityCenterInRegion(entity, region)).length;
  return {
    id: `GEN-COUNT-${hashSeed(seed).toString(16).toUpperCase()}`,
    operation: pick(rng, ['OPERATION ROAD COUNT', 'OPERATION GREY COLUMN', 'OPERATION MOTOR POOL']),
    satellitePass: `${String(integer(rng, 0, 23)).padStart(2, '0')}:${String(integer(rng, 0, 59)).padStart(2, '0')} ZULU`,
    sector: map.title,
    mapId: map.id,
    mode: 'COUNT',
    objective: `COUNT ALL MILITARY VEHICLES INSIDE ${region.label}.`,
    targetCategory: 'military_vehicle',
    targetCategoryLabel: 'MILITARY VEHICLES',
    region,
    expectedCount,
    worldOperations: operations,
    timeLimitSeconds: generatedTimeLimit(rng),
    visualModifiers: visualModifiers(rng),
    generated: true,
    seed,
  };
}

function createChangeGenerated(rng, seed, map) {
  const entities = authoredEntities(map);
  const zones = authoredZones(map);
  const movable = entities.filter((entity) => entity.selectable && compatibleZones(entity, zones).length > 0 && ['military_vehicle', 'strategic_installation'].includes(entity.category));
  const eventType = pick(rng, ['moved', 'disappeared', 'appeared']);
  const worldOperations = [];
  const passBOperations = [];
  let target;
  let targetId;
  let targetLabel;
  let changeType;
  let changeSummary;
  let focus;

  if (eventType === 'appeared') {
    const template = pick(rng, movable.filter((entity) => entity.category === 'military_vehicle'));
    if (!template) throw new Error('No compatible template exists for an appeared CHANGE event.');
    const zone = pick(rng, compatibleZones(template, zones));
    const position = placementInZone(rng, zone, template);
    targetId = `generated-contact-${hashSeed(`${seed}-contact`).toString(16)}`;
    targetLabel = template.label;
    target = { ...cloneEntity(template), id: targetId, ...position, target: true, selectable: true };
    passBOperations.push({ type: 'add_entity', entity: target });
    passBOperations.push(...addClues(rng, map, position, 1));
    changeType = CHANGE_TYPES.VEHICLE_APPEARED;
    changeSummary = `${targetLabel} appeared between the two reconnaissance passes.`;
    focus = { x: position.x + target.width / 2, y: position.y + target.height / 2, zoom: 0.66 };
  } else {
    target = pick(rng, movable);
    if (!target) throw new Error('No compatible target exists for a CHANGE event.');
    targetId = target.id;
    targetLabel = target.label;
    const zonesForTarget = compatibleZones(target, zones);
    const startZone = pick(rng, zonesForTarget);
    const start = placementInZone(rng, startZone, target, 0, 2);
    worldOperations.push({ type: 'move_entity', entityId: target.id, ...start });

    if (eventType === 'disappeared') {
      passBOperations.push({ type: 'hide_entity', entityId: target.id });
      passBOperations.push(...addClues(rng, map, start, 1));
      changeType = CHANGE_TYPES.VEHICLE_DISAPPEARED;
      changeSummary = `${targetLabel} disappeared between PASS A and PASS B.`;
      focus = { x: start.x + target.width / 2, y: start.y + target.height / 2, zoom: 0.66 };
    } else {
      const destinationZone = zonesForTarget.length > 1 ? pick(rng, zonesForTarget.filter((zone) => zone.id !== startZone.id)) : startZone;
      const destination = placementInZone(rng, destinationZone ?? startZone, target, 1, 2);
      passBOperations.push({ type: 'move_entity', entityId: target.id, ...destination });
      passBOperations.push(...addClues(rng, map, destination, 1));
      changeType = CHANGE_TYPES.VEHICLE_MOVED;
      changeSummary = `${targetLabel} changed position between the two reconnaissance passes.`;
      focus = { x: Math.round((start.x + destination.x) / 2), y: Math.round((start.y + destination.y) / 2), zoom: 0.62 };
    }
  }

  const firstHour = integer(rng, 0, 22);
  const firstMinute = integer(rng, 0, 44);
  const interval = integer(rng, 8, 15);
  const secondMinuteTotal = firstHour * 60 + firstMinute + interval;
  const passATime = `${String(firstHour).padStart(2, '0')}:${String(firstMinute).padStart(2, '0')} ZULU`;
  const passBTime = `${String(Math.floor(secondMinuteTotal / 60) % 24).padStart(2, '0')}:${String(secondMinuteTotal % 60).padStart(2, '0')} ZULU`;

  return {
    id: `GEN-CHANGE-${hashSeed(seed).toString(16).toUpperCase()}`,
    operation: pick(rng, ['OPERATION SECOND FRAME', 'OPERATION TIME SLICE', 'OPERATION GREY ECHO']),
    satellitePass: `PASS A ${passATime} // PASS B ${passBTime}`,
    sector: map.title,
    mapId: map.id,
    mode: 'CHANGE',
    objective: eventType === 'appeared'
      ? 'IDENTIFY THE OBJECT THAT APPEARED BETWEEN PASS A AND PASS B.'
      : eventType === 'disappeared'
        ? 'IDENTIFY THE OBJECT THAT DISAPPEARED BETWEEN PASS A AND PASS B.'
        : 'IDENTIFY THE OBJECT THAT CHANGED POSITION BETWEEN PASS A AND PASS B.',
    targetId,
    targetLabel,
    changeType,
    passA: { id: 'A', label: 'PASS A', time: passATime },
    passB: { id: 'B', label: 'PASS B', time: passBTime },
    worldOperations,
    passBOperations,
    changeSummary,
    focus,
    timeLimitSeconds: generatedTimeLimit(rng),
    visualModifiers: visualModifiers(rng),
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
  if (!Number.isFinite(mission.timeLimitSeconds) || mission.timeLimitSeconds <= 0) errors.push('Generated mission time limit is invalid.');
  for (const operation of [...(mission.worldOperations ?? []), ...(mission.passBOperations ?? [])]) {
    if (!operationBoundsValid(operation, map)) errors.push(`Operation '${operation.type ?? 'unknown'}' exceeds map bounds.`);
  }

  const passA = simulateEntities(map, mission.worldOperations ?? []);
  if (mission.mode === 'LOCATE') {
    const target = passA.find((entity) => entity.id === mission.targetId);
    if (!target || target.hidden || !target.selectable) errors.push('LOCATE target is not visible/selectable after generation.');
  }

  if (mission.mode === 'COUNT') {
    const region = mission.region;
    if (!region || region.x < 0 || region.y < 0 || region.x + region.width > map.width || region.y + region.height > map.height) errors.push('COUNT region is outside map bounds.');
    const count = passA.filter((entity) => entity.category === mission.targetCategory && entityCenterInRegion(entity, region)).length;
    if (count <= 0) errors.push('COUNT mission generated no valid target objects.');
    if (count !== mission.expectedCount) errors.push('COUNT expected answer does not match generated entity state.');
  }

  if (mission.mode === 'CHANGE') {
    const passB = simulateEntities(map, [...(mission.worldOperations ?? []), ...(mission.passBOperations ?? [])]);
    const targetA = passA.find((entity) => entity.id === mission.targetId);
    const targetB = passB.find((entity) => entity.id === mission.targetId);
    const visibleA = Boolean(targetA && !targetA.hidden);
    const visibleB = Boolean(targetB && !targetB.hidden);
    const moved = visibleA && visibleB && (Math.abs(targetA.x - targetB.x) > 8 || Math.abs(targetA.y - targetB.y) > 8);
    if (!visibleA && !visibleB) errors.push('CHANGE target is not visible in either pass.');
    if (visibleA === visibleB && !moved) errors.push('CHANGE target state does not materially differ between passes.');
  }

  return { valid: errors.length === 0, errors };
}

function fallbackMission(mode, seed, map) {
  const fallback = mode === 'COUNT' ? createCountMission(map) : mode === 'CHANGE' ? createChangeDetectionMission(map) : createLocateMission(map);
  return { ...fallback, generated: false, seed, generationWarning: 'Generator exhausted validation attempts; using authored fallback.' };
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
    mission.generationAttempt = attempt + 1;
    const validation = validateGeneratedMission(mission, map);
    if (validation.valid) return mission;
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
