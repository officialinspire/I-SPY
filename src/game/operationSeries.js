import { GAME_CONFIG } from '../runtime-config.js';
import { createGeneratedMission } from './missionGenerator.js';
import { isAnySector, listReconMaps, normalizeSector } from '../world/mapRegistry.js';

export const OPERATION_MISSION_COUNT = 3;
const MODES = Object.freeze(['LOCATE', 'COUNT', 'CHANGE']);

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledModes(rootSeed) {
  const modes = [...MODES];
  const rng = mulberry32(hashSeed(`${rootSeed}:mode-order`));
  for (let index = modes.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [modes[index], modes[other]] = [modes[other], modes[index]];
  }
  return modes;
}

function selectedSector(rootSeed, requestedSector) {
  const normalized = normalizeSector(requestedSector);
  if (!isAnySector(normalized)) return normalized;
  const entries = listReconMaps();
  const rng = mulberry32(hashSeed(`${rootSeed}:operation-sector`));
  return entries[Math.floor(rng() * entries.length)]?.id ?? entries[0]?.id;
}

function randomRootSeed() {
  const now = Date.now().toString(36).toUpperCase();
  const salt = Math.floor(Math.random() * 0xFFFFFF).toString(36).padStart(5, '0').toUpperCase();
  return `OPS-${now}-${salt}`;
}

export function utcDateKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

export function dailyRootSeed(dateKey = utcDateKey()) {
  return `DAILY:${dateKey}:${GAME_CONFIG.version}`;
}

function cloneContext(context) {
  return {
    ...context,
    modeOrder: [...context.modeOrder],
    cumulative: {
      score: Number(context.cumulative?.score) || 0,
      wins: Number(context.cumulative?.wins) || 0,
      directives: Number(context.cumulative?.directives) || 0,
      errors: Number(context.cumulative?.errors) || 0,
      grades: [...(context.cumulative?.grades ?? [])],
    },
  };
}

function escalationFactor(index) {
  return [1.08, 1, 0.92][index] ?? 1;
}

export function missionForOperationContext(context) {
  const safe = cloneContext(context);
  const mode = safe.modeOrder[safe.index];
  const seed = `${safe.rootSeed}:M${safe.index + 1}:${mode}`;
  const mission = createGeneratedMission({ seed, mode, map: safe.sectorId });
  const adjustedLimit = Math.max(60, Math.round(mission.timeLimitSeconds * escalationFactor(safe.index)));
  return {
    ...mission,
    timeLimitSeconds: adjustedLimit,
    operationSeries: safe,
  };
}

export function createOperationSeries({
  rootSeed = randomRootSeed(),
  sector = 'any',
  kind = 'series',
  dailyDate = null,
  replay = false,
} = {}) {
  const context = {
    schemaVersion: 1,
    id: kind === 'daily' ? `DAILY-${dailyDate}` : `OP-${hashSeed(rootSeed).toString(16).toUpperCase()}`,
    kind,
    rootSeed,
    sectorId: selectedSector(rootSeed, sector),
    modeOrder: shuffledModes(rootSeed),
    index: 0,
    replay: replay === true,
    dailyDate,
    cumulative: { score: 0, wins: 0, directives: 0, errors: 0, grades: [] },
  };
  return { context, mission: missionForOperationContext(context) };
}

export function createDailyDossier({ dateKey = utcDateKey(), replay = false } = {}) {
  return createOperationSeries({
    rootSeed: dailyRootSeed(dateKey),
    sector: 'any',
    kind: 'daily',
    dailyDate: dateKey,
    replay,
  });
}

export function resolveOperationMissionResult(mission, result = {}) {
  if (!mission?.operationSeries) return null;
  const context = cloneContext(mission.operationSeries);
  const success = result.success === true;
  context.cumulative.score += Math.max(0, Math.floor(Number(result.score?.totalScore) || 0));
  context.cumulative.wins += success ? 1 : 0;
  context.cumulative.directives += result.performance?.directive?.completed === true ? 1 : 0;
  context.cumulative.errors += Math.max(0, Math.floor(Number(result.performance?.errors) || 0));
  context.cumulative.grades.push(result.performance?.grade ?? 'C');

  if (!success) return { status: 'failed', context, nextMission: null };
  if (context.index >= OPERATION_MISSION_COUNT - 1) return { status: 'complete', context, nextMission: null };

  context.index += 1;
  return { status: 'continue', context, nextMission: missionForOperationContext(context) };
}

export function restartOperation(context) {
  if (context?.kind === 'daily') {
    return createDailyDossier({ dateKey: context.dailyDate ?? utcDateKey(), replay: true });
  }
  return createOperationSeries({
    rootSeed: context?.rootSeed ?? randomRootSeed(),
    sector: context?.sectorId ?? 'any',
    kind: 'series',
    replay: true,
  });
}

export function operationCleanSweep(context) {
  return Number(context?.cumulative?.wins) >= OPERATION_MISSION_COUNT
    && Number(context?.cumulative?.errors) === 0;
}
