import { findSprite } from '../assets/spriteManifest.js';

/**
 * Recon map schema and validation.
 *
 * Deliberately free of map data and of Phaser: it imports nothing but the
 * sprite manifest, so the release validator can run these rules over every
 * registered map in Node exactly as the game runs them in the browser.
 */

export const REQUIRED_MAP_LAYERS = Object.freeze([
  'terrain',
  'vegetation',
  'infrastructure',
  'structures',
  'objects',
  'recon-clues',
  'spawn-zones',
  'metadata',
]);

export const REQUIRED_SPAWN_TAGS = Object.freeze([
  'road_vehicle',
  'forest_concealment',
  'compound_vehicle',
  'open_field',
  'structure',
  'radar_site',
  'civilian',
  'clue_zone',
]);

export function getMapLayer(map, id) {
  return map?.layers?.find((layer) => layer.id === id) ?? null;
}

/** Entities an authored map offers to missions, cloned so callers cannot edit the source. */
export function getMapEntities(map) {
  return (getMapLayer(map, 'objects')?.items ?? []).map((entity) => ({ ...entity, clueTags: [...(entity.clueTags ?? [])] }));
}

/** Spawn zones an authored map offers to the generator, cloned for the same reason. */
export function getMapSpawnZones(map) {
  return (getMapLayer(map, 'spawn-zones')?.zones ?? []).map((zone) => ({ ...zone, accepts: [...(zone.accepts ?? [])] }));
}

export function getMapMetadata(map) {
  return { ...(getMapLayer(map, 'metadata')?.data ?? {}) };
}

export function validateReconMap(map) {
  const errors = [];
  const warnings = [];

  if (!map || typeof map !== 'object') return { valid: false, errors: ['Map data is missing.'], warnings };
  if (map.schemaVersion !== 1) errors.push(`Unsupported map schema version: ${map.schemaVersion ?? 'missing'}.`);
  if (!map.id) errors.push('Map is missing an id.');
  if (!Number.isFinite(map.width) || map.width <= 0 || !Number.isFinite(map.height) || map.height <= 0) errors.push('Map width and height must be positive numbers.');
  if (!Array.isArray(map.layers)) errors.push('Map layers must be an array.');

  const layerIds = new Set((map.layers ?? []).map((layer) => layer.id));
  REQUIRED_MAP_LAYERS.forEach((id) => {
    if (!layerIds.has(id)) errors.push(`Required layer missing: ${id}.`);
  });

  const entityIds = new Set();
  for (const layer of map.layers ?? []) {
    const spriteEntries = layer.type === 'areas' ? layer.areas : layer.items;
    for (const item of spriteEntries ?? []) {
      if (!item.sprite) {
        errors.push(`Layer ${layer.id} contains an item without a sprite name.`);
        continue;
      }
      if (!findSprite(item.sprite)) errors.push(`Unknown sprite '${item.sprite}' in layer ${layer.id}.`);
      if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) errors.push(`Sprite '${item.sprite}' in layer ${layer.id} has invalid coordinates.`);
      const width = item.width ?? 64;
      const height = item.height ?? 64;
      if (item.x < 0 || item.y < 0 || item.x + width > map.width || item.y + height > map.height) warnings.push(`Sprite '${item.sprite}' in layer ${layer.id} extends outside map bounds.`);
      if (layer.type === 'entities') {
        if (!item.id) errors.push(`Entity '${item.sprite}' is missing an id.`);
        else if (entityIds.has(item.id)) errors.push(`Duplicate entity id: ${item.id}.`);
        else entityIds.add(item.id);
        if (!item.type || !item.label) errors.push(`Entity '${item.id ?? item.sprite}' requires type and label.`);
      }
    }
  }

  const spawnLayer = getMapLayer(map, 'spawn-zones');
  const spawnTags = new Set();
  for (const zone of spawnLayer?.zones ?? []) {
    if (!zone.id || !zone.tag) errors.push('Every spawn zone requires id and tag.');
    if (zone.tag) spawnTags.add(zone.tag);
    if (![zone.x, zone.y, zone.width, zone.height].every(Number.isFinite) || zone.width <= 0 || zone.height <= 0) errors.push(`Spawn zone '${zone.id ?? 'unknown'}' has invalid bounds.`);
    if (!Array.isArray(zone.accepts) || zone.accepts.length === 0) warnings.push(`Spawn zone '${zone.id ?? 'unknown'}' has no accepted object types.`);
    if (zone.x < 0 || zone.y < 0 || zone.x + zone.width > map.width || zone.y + zone.height > map.height) errors.push(`Spawn zone '${zone.id ?? 'unknown'}' exceeds map bounds.`);
  }
  REQUIRED_SPAWN_TAGS.forEach((tag) => {
    if (!spawnTags.has(tag)) errors.push(`Required spawn-zone tag missing: ${tag}.`);
  });

  const metadata = getMapMetadata(map);
  if (metadata.missionTargetId && !entityIds.has(metadata.missionTargetId)) errors.push(`Metadata missionTargetId '${metadata.missionTargetId}' does not match an entity.`);

  // A sector may author where its change-detection subject moves to. If it
  // does, that spot has to be somewhere the analyst can actually look at.
  const destination = metadata.changeDetection?.destination;
  if (destination) {
    const nominal = 64;
    if (![destination.x, destination.y].every(Number.isFinite)) errors.push('Metadata changeDetection.destination needs numeric x and y.');
    else if (destination.x < 0 || destination.y < 0 || destination.x + nominal > map.width || destination.y + nominal > map.height) errors.push('Metadata changeDetection.destination falls outside map bounds.');
  }

  // A training range scripts its own lessons in metadata. If it does, the
  // things those lessons point at have to exist, or the tutorial teaches the
  // console by failing to build.
  const training = metadata.training;
  if (training) {
    if (training.identifyId && !entityIds.has(training.identifyId)) errors.push(`Metadata training.identifyId '${training.identifyId}' does not match an entity.`);
    const region = training.countRegion;
    if (region) {
      if (![region.x, region.y, region.width, region.height].every(Number.isFinite) || region.width <= 0 || region.height <= 0) errors.push('Metadata training.countRegion has invalid bounds.');
      else if (region.x < 0 || region.y < 0 || region.x + region.width > map.width || region.y + region.height > map.height) errors.push('Metadata training.countRegion falls outside map bounds.');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
