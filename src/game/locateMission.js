import { GAME_CONFIG } from '../runtime-config.js';
import { RECON_ENTITIES } from '../world/reconEntities.js';

export function createLocateMission() {
  const target = RECON_ENTITIES.find((entity) => entity.id === 'radar-01');
  return {
    id: 'OP-NIGHT-WATCH-001',
    operation: 'OPERATION NIGHT WATCH',
    satellitePass: '03:42 ZULU',
    sector: 'WOODLAND CORRIDOR 7',
    mode: 'LOCATE',
    objective: 'LOCATE THE RADAR INSTALLATION.',
    targetId: target.id,
    targetLabel: target.label,
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
