import { getCatalogEntry } from '../world/mapCatalog.js';

export const ENVIRONMENT_CONDITIONS = Object.freeze({
  CLEAR: 'CLEAR',
  RAIN: 'RAIN',
  SNOW: 'SNOW',
});

const DEFAULT_CONDITIONS = Object.freeze([ENVIRONMENT_CONDITIONS.CLEAR]);

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function conditionsForSector(mapId) {
  const entry = getCatalogEntry(mapId);
  return entry?.conditions?.length ? [...entry.conditions] : [...DEFAULT_CONDITIONS];
}

export function isConditionAllowed(mapId, condition) {
  return conditionsForSector(mapId).includes(condition);
}

/**
 * One deterministic condition stream per mission/sector.
 *
 * Keeping this draw separate from mission generation means weather never
 * shifts target placement, COUNT answers, directives, or CHANGE events.
 */
export function resolveMissionCondition(seed, mapId) {
  const allowed = conditionsForSector(mapId);
  const index = hashSeed(`${seed}:environment-condition:${mapId}`) % allowed.length;
  return allowed[index] ?? ENVIRONMENT_CONDITIONS.CLEAR;
}

export function authoredMissionSeed(mapId, mode) {
  return `AUTHORED:${mapId}:${String(mode).toUpperCase()}`;
}

export function withMissionCondition(mission, seed = mission?.seed) {
  if (!mission) return mission;
  const effectiveSeed = seed ?? authoredMissionSeed(mission.mapId, mission.mode ?? 'MISSION');
  return {
    ...mission,
    seed: effectiveSeed,
    condition: resolveMissionCondition(effectiveSeed, mission.mapId),
  };
}
