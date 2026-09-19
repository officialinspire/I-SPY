import { findSprite } from '../assets/spriteManifest.js';
import { resolveReconMap } from './mapRegistry.js';
import {
  REQUIRED_MAP_LAYERS,
  REQUIRED_SPAWN_TAGS,
  getMapEntities,
  getMapLayer,
  getMapMetadata,
  getMapSpawnZones,
  validateReconMap,
} from './reconMapSchema.js';

/**
 * Builds a Phaser world from authored map data.
 *
 * The schema and the map catalogue live in `reconMapSchema.js` and
 * `mapRegistry.js`; this module only turns whichever map it is handed into
 * game objects. It re-exports the schema helpers so existing callers keep one
 * import site.
 */

export {
  REQUIRED_MAP_LAYERS,
  REQUIRED_SPAWN_TAGS,
  getMapEntities,
  getMapLayer,
  getMapMetadata,
  getMapSpawnZones,
  validateReconMap,
};

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

/**
 * `map` may be a registry id, a registry entry or raw map data. Omitting it
 * builds the default sector, which is what an authored mission without a
 * mapId asks for.
 */
export function createAuthoredReconMap(scene, mapSource) {
  const map = resolveReconMap(mapSource);
  const validation = validateReconMap(map);
  validation.warnings.forEach((warning) => console.warn(`[I SPY map warning] ${warning}`));
  if (!validation.valid) {
    validation.errors.forEach((error) => console.error(`[I SPY map error] ${error}`));
    throw new Error(`Recon map '${map?.id ?? 'unknown'}' failed validation.`);
  }

  const root = scene.add.container(0, 0);
  const entityVisuals = new Map();
  const renderLayerIds = ['terrain', 'vegetation', 'infrastructure', 'structures', 'objects', 'recon-clues'];
  for (const id of renderLayerIds) {
    const layer = getMapLayer(map, id);
    if (!layer) continue;
    if (layer.type === 'areas') {
      (layer.areas ?? []).forEach((area) => addArea(scene, root, area));
    } else {
      (layer.items ?? []).forEach((item) => {
        const visual = addSprite(scene, root, item);
        if (layer.type === 'entities' && item.id && visual) entityVisuals.set(item.id, visual);
      });
    }
  }

  const entities = getMapEntities(map);
  const spawnZones = getMapSpawnZones(map);
  const metadata = getMapMetadata(map);

  return { root, map, entities, entityVisuals, spawnZones, metadata, validation };
}

export function applyReconOperations(scene, world, operations = []) {
  for (const operation of operations) {
    if (!operation?.type) continue;

    if (operation.type === 'move_entity') {
      const entity = world.entities.find((item) => item.id === operation.entityId);
      const visual = world.entityVisuals.get(operation.entityId);
      if (!entity || !visual || !Number.isFinite(operation.x) || !Number.isFinite(operation.y)) {
        console.warn(`[I SPY change warning] Unable to move entity '${operation.entityId ?? 'unknown'}'.`);
        continue;
      }
      entity.x = operation.x;
      entity.y = operation.y;
      entity.hidden = false;
      visual.setVisible(true).setPosition(entity.x + entity.width / 2, entity.y + entity.height / 2);
      continue;
    }

    if (operation.type === 'hide_entity' || operation.type === 'remove_entity') {
      const entity = world.entities.find((item) => item.id === operation.entityId);
      const visual = world.entityVisuals.get(operation.entityId);
      if (!entity || !visual) {
        console.warn(`[I SPY change warning] Unable to hide entity '${operation.entityId ?? 'unknown'}'.`);
        continue;
      }
      entity.hidden = true;
      visual.setVisible(false);
      continue;
    }

    if (operation.type === 'add_entity' && operation.entity) {
      const entity = { ...operation.entity, clueTags: [...(operation.entity.clueTags ?? [])] };
      if (!entity.id || world.entities.some((item) => item.id === entity.id)) {
        console.warn(`[I SPY change warning] Invalid or duplicate added entity '${entity.id ?? 'unknown'}'.`);
        continue;
      }
      const visual = addSprite(scene, world.root, entity);
      if (!visual) continue;
      world.entities.push(entity);
      world.entityVisuals.set(entity.id, visual);
      continue;
    }

    if (operation.type === 'add_sprite' && operation.sprite) {
      addSprite(scene, world.root, operation);
    }
  }
  return world;
}

function markable(entity) {
  return Boolean(entity) && entity.selectable !== false && !entity.hidden;
}

function containsPoint(entity, x, y) {
  return x >= entity.x && x <= entity.x + entity.width
    && y >= entity.y && y <= entity.y + entity.height;
}

/**
 * The selectable object under a point, searched back to front.
 *
 * Entities are drawn in array order and an added contact is appended, so the
 * last match in the array is the one painted on top. Walking forwards handed
 * an exact overlap to whichever object was drawn *underneath* — the analyst
 * clicked the sprite they could see and marked the one they could not. The
 * search runs in reverse so the object on top, the one that was clicked, wins.
 */
export function entityAtPoint(x, y, entities) {
  const list = entities ?? [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const entity = list[index];
    if (markable(entity) && containsPoint(entity, x, y)) return entity;
  }
  return null;
}

function distanceToBounds(x, y, entity) {
  const dx = Math.max(entity.x - x, 0, x - (entity.x + entity.width));
  const dy = Math.max(entity.y - y, 0, y - (entity.y + entity.height));
  return Math.hypot(dx, dy);
}

/**
 * Authored bounds first, then an invisible tolerance ring.
 *
 * A mark inside an entity's real footprint always resolves to that entity, so
 * metadata bounds stay authoritative. Only when a mark misses everything does
 * the nearest entity within `tolerance` win, which makes touch comfortable
 * without enlarging any sprite or favouring targets over decoys.
 */
export function entityNearPoint(x, y, entities, tolerance = 0) {
  const exact = entityAtPoint(x, y, entities);
  if (exact || tolerance <= 0) return exact;

  // Nearest wins, and ties go to the object drawn later for the same reason
  // the exact search runs in reverse.
  let best = null;
  let bestDistance = Infinity;
  for (const entity of entities ?? []) {
    if (!markable(entity)) continue;
    const distance = distanceToBounds(x, y, entity);
    if (distance > tolerance || distance > bestDistance) continue;
    best = entity;
    bestDistance = distance;
  }
  return best;
}

export function getSpawnZonesByTag(spawnZones, tag) {
  return (spawnZones ?? []).filter((zone) => zone.tag === tag);
}
