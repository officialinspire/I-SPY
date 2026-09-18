import { GAME_CONFIG } from '../runtime-config.js';
import { getMapEntities } from '../world/reconMapSchema.js';
import { resolveReconMap } from '../world/mapRegistry.js';

export const COUNT_REGION = Object.freeze({
  id: 'delta-3',
  label: 'GRID DELTA-3',
  x: 500,
  y: 500,
  width: 1550,
  height: 500,
});

export function entityCenterInRegion(entity, region) {
  const x = entity.x + entity.width / 2;
  const y = entity.y + entity.height / 2;
  return x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
}

export function countEntitiesInRegion(entities, region, targetCategory) {
  return (entities ?? []).filter((entity) => entity.category === targetCategory && entityCenterInRegion(entity, region)).length;
}

export function createCountMission(mapSource) {
  const map = resolveReconMap(mapSource);
  const entities = getMapEntities(map);
  const targetCategory = 'military_vehicle';
  const expectedCount = countEntitiesInRegion(entities, COUNT_REGION, targetCategory);

  return {
    id: 'OP-TALLY-SHEET-001',
    operation: 'OPERATION TALLY SHEET',
    satellitePass: '04:17 ZULU',
    sector: map.title,
    mapId: map.id,
    mode: 'COUNT',
    objective: `COUNT ALL MILITARY VEHICLES INSIDE ${COUNT_REGION.label}.`,
    targetCategory,
    targetCategoryLabel: 'MILITARY VEHICLES',
    region: { ...COUNT_REGION },
    expectedCount,
    timeLimitSeconds: GAME_CONFIG.count.timeLimitSeconds,
  };
}

export function validateCountAnswer(mission, answer) {
  const normalized = Number.isFinite(Number(answer)) ? Math.max(0, Math.floor(Number(answer))) : 0;
  return {
    correct: normalized === mission.expectedCount,
    answer: normalized,
    expectedCount: mission.expectedCount,
    reason: normalized === mission.expectedCount ? 'COUNT CONFIRMED' : 'COUNT UNVERIFIED',
  };
}

export function calculateCountScore({ success, incorrectSubmissions, remainingSeconds }) {
  const scoring = GAME_CONFIG.count.scoring;
  const baseScore = success ? scoring.correctAnswer : 0;
  const answerPenalty = incorrectSubmissions * scoring.incorrectSubmissionPenalty;
  const timeBonus = success ? Math.max(0, Math.floor(remainingSeconds)) * scoring.timeBonusPerSecond : 0;
  const perfectBonus = success && incorrectSubmissions === 0 ? scoring.perfectBonus : 0;
  const totalScore = Math.max(0, baseScore + timeBonus + perfectBonus - answerPenalty);
  return { baseScore, answerPenalty, timeBonus, perfectBonus, totalScore };
}
