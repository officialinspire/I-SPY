import { GAME_CONFIG } from '../runtime-config.js';
import { MAP_CATALOG } from './mapCatalog.js';
import { validateReconMap } from './reconMapSchema.js';
import woodlandCorridor7 from '../../assets/maps/woodland-corridor-7.json';
import frostlineRelay from '../../assets/maps/frostline-relay.json';
import riverworksSector from '../../assets/maps/riverworks-sector.json';

/**
 * Registry of playable reconnaissance sectors.
 *
 * Everything that used to reach for one hard-coded map now asks the registry
 * for one by id, so a mission is a request for a sector rather than an
 * assumption about which sector exists. Adding a map is a catalog entry plus a
 * line in MAP_DATA; nothing else in the game needs to know.
 */

/** Catalog id -> bundled map JSON. The only place map data is imported. */
const MAP_DATA = Object.freeze({
  'woodland-corridor-7': woodlandCorridor7,
  'frostline-relay': frostlineRelay,
  'riverworks-sector': riverworksSector,
});

function buildEntry(descriptor) {
  const map = MAP_DATA[descriptor.id];
  if (!map) throw new Error(`Map '${descriptor.id}' is catalogued but its data is not registered.`);
  if (map.id !== descriptor.id) throw new Error(`Map data id '${map.id}' does not match catalog id '${descriptor.id}'.`);
  return Object.freeze({
    ...descriptor,
    map,
    title: descriptor.title ?? map.title,
    width: map.width,
    height: map.height,
  });
}

export const RECON_MAPS = Object.freeze(MAP_CATALOG.map(buildEntry));

export const DEFAULT_MAP_ID = GAME_CONFIG.recon.defaultMapId;

export function listReconMaps() {
  return RECON_MAPS;
}

export function getReconMapEntry(id) {
  return RECON_MAPS.find((entry) => entry.id === id) ?? null;
}

export function getDefaultReconMapEntry() {
  const entry = getReconMapEntry(DEFAULT_MAP_ID) ?? RECON_MAPS[0];
  if (!entry) throw new Error('No reconnaissance maps are registered.');
  return entry;
}

export function getDefaultReconMap() {
  return getDefaultReconMapEntry().map;
}

/**
 * Accepts a map id, a registry entry or raw map data and returns map data.
 *
 * Unknown ids fall back to the default sector with a warning rather than
 * throwing: a mission saved against a map that no longer ships should still be
 * playable, and the analyst should not meet a black screen over it.
 */
export function resolveReconMap(map) {
  if (!map) return getDefaultReconMap();
  if (typeof map === 'string') {
    const entry = getReconMapEntry(map);
    if (entry) return entry.map;
    console.warn(`[I SPY map warning] Unknown map id '${map}'; using '${DEFAULT_MAP_ID}'.`);
    return getDefaultReconMap();
  }
  if (map.layers) return map;
  if (map.map?.layers) return map.map;
  return getDefaultReconMap();
}

/** Registry entry for a map id, a mission, or raw map data. */
export function resolveReconMapEntry(source) {
  const id = typeof source === 'string' ? source : source?.mapId ?? source?.id;
  return getReconMapEntry(id) ?? getDefaultReconMapEntry();
}

/**
 * Every registered map must pass the schema. Returns one result per map so a
 * caller can report all of them; the release validator fails the build on any
 * invalid entry.
 */
export function validateMapRegistry() {
  return RECON_MAPS.map((entry) => ({ id: entry.id, title: entry.title, ...validateReconMap(entry.map) }));
}
