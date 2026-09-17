import { GAME_CONFIG } from '../runtime-config.js';
import { DEFAULT_RECON_MAP, getMapLayer } from '../world/authoredReconMap.js';

export const CHANGE_TYPES = Object.freeze({
  VEHICLE_MOVED: 'vehicle_moved',
  VEHICLE_APPEARED: 'vehicle_appeared',
  VEHICLE_DISAPPEARED: 'vehicle_disappeared',
  STRUCTURE_CHANGED: 'structure_changed',
  TERRAIN_CHANGED: 'terrain_changed',
});

export function createChangeDetectionMission(map = DEFAULT_RECON_MAP) {
  const entities = getMapLayer(map, 'objects')?.items ?? [];
  const target = entities.find((entity) => entity.id === 'jeep-01');
  if (!target) throw new Error('Change-detection mission target jeep-01 is missing from authored map data.');

  const destination = { x: 1515, y: 870 };
  return {
    id: 'OP-SECOND-LOOK-001',
    operation: 'OPERATION SECOND LOOK',
    satellitePass: 'PASS A 05:12 ZULU // PASS B 05:27 ZULU',
    sector: map.title ?? 'WOODLAND CORRIDOR 7',
    mapId: map.id,
    mode: 'CHANGE',
    objective: 'IDENTIFY THE MILITARY VEHICLE THAT CHANGED POSITION BETWEEN PASS A AND PASS B.',
    targetId: target.id,
    targetLabel: target.label,
    changeType: CHANGE_TYPES.VEHICLE_MOVED,
    passA: { id: 'A', label: 'PASS A', time: '05:12 ZULU' },
    passB: { id: 'B', label: 'PASS B', time: '05:27 ZULU' },
    passBOperations: [
      { type: 'move_entity', entityId: target.id, x: destination.x, y: destination.y },
    ],
    changeSummary: `${target.label} moved from its original compound position to the eastern road approach.`,
    timeLimitSeconds: GAME_CONFIG.change.timeLimitSeconds,
  };
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
