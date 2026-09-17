import { GAME_CONFIG } from '../runtime-config.js';

export function createLocateMission() {
  return {
    id: 'OP-NIGHT-WATCH-001',
    operation: 'OPERATION NIGHT WATCH',
    satellitePass: '03:42 ZULU',
    sector: 'WOODLAND CORRIDOR 7',
    mapId: GAME_CONFIG.recon.defaultMapId,
    mode: 'LOCATE',
    objective: 'LOCATE THE RADAR INSTALLATION.',
    targetId: 'radar-01',
    targetLabel: 'RADAR INSTALLATION',
    timeLimitSeconds: GAME_CONFIG.locate.timeLimitSeconds,
  };
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
