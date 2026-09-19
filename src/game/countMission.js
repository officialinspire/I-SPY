import { GAME_CONFIG } from '../runtime-config.js';
import {
  DEFAULT_COUNT_REGION,
  countEntitiesInRegion,
  entityCenterInRegion,
  getCountRegion,
  getMapEntities,
} from '../world/reconMapSchema.js';
import { resolveReconMap } from '../world/mapRegistry.js';

// The region helpers live with the schema so the release validator can read
// them without pulling in bundled map data; re-exported here because this is
// where the rest of the game has always imported them from.
export { entityCenterInRegion, countEntitiesInRegion };
export const COUNT_REGION = DEFAULT_COUNT_REGION;

export function createCountMission(mapSource) {
  const map = resolveReconMap(mapSource);
  const entities = getMapEntities(map);
  const targetCategory = 'military_vehicle';
  const region = getCountRegion(map);
  const expectedCount = countEntitiesInRegion(entities, region, targetCategory);

  return {
    id: 'OP-TALLY-SHEET-001',
    operation: 'OPERATION TALLY SHEET',
    satellitePass: '04:17 ZULU',
    sector: map.title,
    mapId: map.id,
    mode: 'COUNT',
    objective: `COUNT ALL MILITARY VEHICLES INSIDE ${region.label}.`,
    targetCategory,
    targetCategoryLabel: 'MILITARY VEHICLES',
    region,
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
