import { GAME_CONFIG } from '../runtime-config.js';
import { getMapEntities, getMapMetadata } from '../world/reconMapSchema.js';
import { resolveReconMap } from '../world/mapRegistry.js';
import { withMissionCondition } from './environmentConditions.js';

export const CHANGE_TYPES = Object.freeze({
  VEHICLE_MOVED: 'vehicle_moved',
  VEHICLE_APPEARED: 'vehicle_appeared',
  VEHICLE_DISAPPEARED: 'vehicle_disappeared',
  STRUCTURE_CHANGED: 'structure_changed',
  TERRAIN_CHANGED: 'terrain_changed',
});

export function createChangeDetectionMission(mapSource) {
  const map = resolveReconMap(mapSource);
  const entities = getMapEntities(map);
  const target = entities.find((entity) => entity.id === 'jeep-01');
  if (!target) throw new Error(`Change-detection mission target jeep-01 is missing from map '${map.id}'.`);

  // Each sector authors where its jeep goes, so the second pass puts it on
  // ground that sector actually has — a road, a yard, a lane. A sector that
  // says nothing gets a derived move across the map, clamped inside bounds, so
  // the tasking still works rather than failing to build.
  const authored = getMapMetadata(map).changeDetection ?? {};
  const destination = authored.destination ?? {
    x: Math.round(Math.min(map.width - target.width - 40, Math.max(40, target.x > map.width / 2 ? target.x - map.width * 0.28 : target.x + map.width * 0.28))),
    y: Math.round(Math.min(map.height - target.height - 40, Math.max(40, target.y + map.height * 0.06))),
  };
  const focus = authored.focus ?? {
    x: Math.round((target.x + destination.x) / 2 + target.width / 2),
    y: Math.round((target.y + destination.y) / 2 + target.height / 2),
    zoom: 0.75,
  };
  return withMissionCondition({
    id: 'OP-SECOND-LOOK-001',
    operation: 'OPERATION SECOND LOOK',
    satellitePass: 'PASS A 05:12 ZULU // PASS B 05:27 ZULU',
    sector: map.title,
    mapId: map.id,
    mode: 'CHANGE',
    objective: 'IDENTIFY THE MILITARY VEHICLE THAT CHANGED POSITION BETWEEN PASS A AND PASS B.',
    targetId: target.id,
    targetLabel: target.label,
    changeType: CHANGE_TYPES.VEHICLE_MOVED,
    passA: { id: 'A', label: 'PASS A', time: '05:12 ZULU' },
    passB: { id: 'B', label: 'PASS B', time: '05:27 ZULU' },
    focus,
    passBOperations: [
      { type: 'move_entity', entityId: target.id, x: destination.x, y: destination.y },
    ],
    changeSummary: authored.summary ?? `${target.label} moved position between the two reconnaissance passes.`,
    timeLimitSeconds: GAME_CONFIG.change.timeLimitSeconds,
  });
}

export function validateChangeIdentification(mission, entity, passId) {
  if (!entity) return { correct: false, reason: 'NO IDENTIFIABLE OBJECT AT MARK', passId };
  if (!entity.selectable) return { correct: false, reason: 'OBJECT NOT VALID FOR IDENTIFICATION', entity, passId };
  const correct = entity.id === mission.targetId;
  return { correct, reason: correct ? 'CHANGE CONFIRMED' : 'CHANGE UNVERIFIED', entity, passId };
}

export function calculateChangeScore({ success, falseIdentifications, remainingSeconds }) {
  const scoring = GAME_CONFIG.change.scoring;
  const baseScore = success ? scoring.correctIdentification : 0;
  const falsePenalty = falseIdentifications * scoring.falseIdentificationPenalty;
  const timeBonus = success ? Math.max(0, Math.floor(remainingSeconds)) * scoring.timeBonusPerSecond : 0;
  const perfectBonus = success && falseIdentifications === 0 ? scoring.perfectBonus : 0;
  const totalScore = Math.max(0, baseScore + timeBonus + perfectBonus - falsePenalty);
  return { baseScore, falsePenalty, timeBonus, perfectBonus, totalScore };
}
