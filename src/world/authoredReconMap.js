import woodlandCorridor7 from '../../assets/maps/woodland-corridor-7.json';
import { findSprite } from '../assets/spriteManifest.js';

export const DEFAULT_RECON_MAP = woodlandCorridor7;
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

export function validateReconMap(map) {
  const errors = [];
  const warnings = [];

  if (!map || typeof map !== 'object') return { valid: false, errors: ['Map data is missing.'], warnings };
  if (map.schemaVersion !== 1) errors.push(`Unsupported map schema version: ${map.schemaVersion ?? 'missing'}.`);
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

  const metadata = getMapLayer(map, 'metadata')?.data ?? {};
  if (metadata.missionTargetId && !entityIds.has(metadata.missionTargetId)) errors.push(`Metadata missionTargetId '${metadata.missionTargetId}' does not match an entity.`);

  return { valid: errors.length === 0, errors, warnings };
}

function addSprite(scene, root, item) {
  const definition = findSprite(item.sprite);
  if (!definition) return null;
  const width = item.width ?? 64;
  const height = item.height ?? 64;
  const image = scene.add.image(item.x + width / 2, item.y + height / 2, definition.sheet.key, item.sprite);
  image.setDisplaySize(width, height);
  if (Number.isFinite(item.rotation)) image.setAngle(item.rotation);
  if (item.flipX) image.setFlipX(true);
  if (item.flipY) image.setFlipY(true);
  if (Number.isFinite(item.alpha)) image.setAlpha(item.alpha);
  root.add(image);
  return image;
}

function addArea(scene, root, area) {
  const definition = findSprite(area.sprite);
  if (!definition) return null;
  const tile = scene.add.tileSprite(area.x, area.y, area.width, area.height, definition.sheet.key, area.sprite).setOrigin(0);
  if (Number.isFinite(area.alpha)) tile.setAlpha(area.alpha);
  root.add(tile);
  return tile;
}

export function createAuthoredReconMap(scene, map = DEFAULT_RECON_MAP) {
  const validation = validateReconMap(map);
  validation.warnings.forEach((warning) => console.warn(`[I SPY map warning] ${warning}`));
  if (!validation.valid) {
    validation.errors.forEach((error) => console.error(`[I SPY map error] ${error}`));
    throw new Error(`Recon map '${map?.id ?? 'unknown'}' failed validation.`);
  }

  const root = scene.add.container(0, 0);
  const renderLayerIds = ['terrain', 'vegetation', 'infrastructure', 'structures', 'objects', 'recon-clues'];
  for (const id of renderLayerIds) {
    const layer = getMapLayer(map, id);
    if (!layer) continue;
    if (layer.type === 'areas') (layer.areas ?? []).forEach((area) => addArea(scene, root, area));
    else (layer.items ?? []).forEach((item) => addSprite(scene, root, item));
  }

  const entities = (getMapLayer(map, 'objects')?.items ?? []).map((entity) => ({ ...entity }));
  const spawnZones = (getMapLayer(map, 'spawn-zones')?.zones ?? []).map((zone) => ({ ...zone, accepts: [...(zone.accepts ?? [])] }));
  const metadata = { ...(getMapLayer(map, 'metadata')?.data ?? {}) };

  return { root, map, entities, spawnZones, metadata, validation };
}

export function entityAtPoint(x, y, entities) {
  return (entities ?? []).find((entity) => x >= entity.x && x <= entity.x + entity.width && y >= entity.y && y <= entity.y + entity.height) ?? null;
}

export function getSpawnZonesByTag(spawnZones, tag) {
  return (spawnZones ?? []).filter((zone) => zone.tag === tag);
}
