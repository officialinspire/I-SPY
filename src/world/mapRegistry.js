import { GAME_CONFIG } from '../runtime-config.js';
import { MAP_CATALOG } from './mapCatalog.js';
import { validateReconMap } from './reconMapSchema.js';
import woodlandCorridor7 from '../../assets/maps/woodland-corridor-7.json';
import frostlineRelay from '../../assets/maps/frostline-relay.json';
import riverworksSector from '../../assets/maps/riverworks-sector.json';
import borderFarms from '../../assets/maps/border-farms.json';
import trainingRangeAlpha from '../../assets/maps/training-range-alpha.json';

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
  'border-farms': borderFarms,
  'training-range-alpha': trainingRangeAlpha,
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

/** Every registered map, training ranges included. */
export const RECON_MAPS = Object.freeze(MAP_CATALOG.map(buildEntry));

/**
 * The playable sectors: everything a mission can be set in.
 *
 * A training range is registered like any other map — it is built, validated
 * and resolved by the same code — but it is not somewhere missions happen, so
 * it is kept out of the picker and out of the generator's reach rather than
 * being special-cased at each call site.
 */
export const SECTOR_MAPS = Object.freeze(RECON_MAPS.filter((entry) => !entry.training));

export const DEFAULT_MAP_ID = GAME_CONFIG.recon.defaultMapId;

export const TRAINING_MAP_ID = 'training-range-alpha';

/** The "no preference" sector: a seed picks the map for itself. */
export const ANY_SECTOR = 'any';

export function isAnySector(value) {
  return !value || String(value).toLowerCase() === ANY_SECTOR;
}

/** 'any', or a playable sector id. Anything else — including a training range — falls back to 'any'. */
export function normalizeSector(value) {
  if (isAnySector(value)) return ANY_SECTOR;
  const id = String(value);
  return SECTOR_MAPS.some((entry) => entry.id === id) ? id : ANY_SECTOR;
}

/** Sector choices for a picker: ANY first, then every playable sector. */
export function listSectorOptions() {
  return [
    { id: ANY_SECTOR, title: 'ANY SECTOR', environment: 'OPERATOR CHOICE', description: 'The seed selects the sector as well as the task.' },
    ...SECTOR_MAPS,
  ];
}

export function sectorTitle(value) {
  if (isAnySector(value)) return 'ANY SECTOR';
  return getReconMapEntry(String(value))?.title ?? 'ANY SECTOR';
}

/** The sectors missions can be set in. Training ranges are not among them. */
export function listReconMaps() {
  return SECTOR_MAPS;
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
