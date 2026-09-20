import { GAME_CONFIG } from '../runtime-config.js';
import { resolveReconMap } from '../world/mapRegistry.js';
import { withMissionCondition } from './environmentConditions.js';

/**
 * The authored LOCATE tasking. Its sector and map id come from the registry
 * rather than from literals, so the briefing always names the map the recon
 * scene will actually build.
 */
export function createLocateMission(mapSource) {
  const map = resolveReconMap(mapSource);
  return withMissionCondition({
    id: 'OP-NIGHT-WATCH-001',
    operation: 'OPERATION NIGHT WATCH',
    satellitePass: '03:42 ZULU',
    sector: map.title,
    mapId: map.id,
    mode: 'LOCATE',
    objective: 'LOCATE THE RADAR INSTALLATION.',
    targetId: 'radar-01',
    targetLabel: 'RADAR INSTALLATION',
    timeLimitSeconds: GAME_CONFIG.locate.timeLimitSeconds,
  });
}

export function validateIdentification(mission, entity) {
  if (!entity) return { correct: false, reason: 'NO IDENTIFIABLE OBJECT AT MARK' };
  if (!entity.selectable) return { correct: false, reason: 'OBJECT NOT VALID FOR IDENTIFICATION' };
  return {
    correct: entity.id === mission.targetId,
    reason: entity.id === mission.targetId ? 'CONFIRMED' : 'UNVERIFIED',
    entity,
  };
}

export function calculateLocateScore({ success, falseIdentifications, remainingSeconds }) {
  const scoring = GAME_CONFIG.locate.scoring;
  const baseScore = success ? scoring.correctIdentification : 0;
  const falsePenalty = falseIdentifications * scoring.falseIdentificationPenalty;
  const timeBonus = success ? Math.max(0, Math.floor(remainingSeconds)) * scoring.timeBonusPerSecond : 0;
  const perfectBonus = success && falseIdentifications === 0 ? scoring.perfectBonus : 0;
  const totalScore = Math.max(0, baseScore + timeBonus + perfectBonus - falsePenalty);
  return { baseScore, falsePenalty, timeBonus, perfectBonus, totalScore };
}
