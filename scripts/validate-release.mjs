import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_CONFIG } from '../src/runtime-config.js';
import { SPRITE_SHEETS, findSprite } from '../src/assets/spriteManifest.js';
import { MAP_CATALOG } from '../src/world/mapCatalog.js';
import { validateReconMap } from '../src/world/reconMapSchema.js';
import { GUIDE_CATEGORIES, validateIdentificationGuide } from '../src/game/identificationGuide.js';
import { HAPTICS, LEVEL_SCALE, MAX_PULSE_MS, SILENT_HAPTIC_EVENTS, VOICES, scaleHapticPattern } from '../src/audio/feedback.js';
import { HAPTIC_LEVELS } from '../src/settings/userSettings.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const errors = [];
/** The framing checks are run against a nominal desktop viewport. */
const REFERENCE_VIEWPORT = { width: 1440, height: 900 };
const warnings = [];
const checks = [];
const assert = (condition, message) => {
  if (condition) checks.push(message);
  else errors.push(message);
};
const warn = (condition, message) => {
  if (!condition) warnings.push(message);
};

const packageJson = JSON.parse(read('package.json'));
const indexHtml = read('index.html');
const styles = read('src/styles.css');
const mainSource = read('src/main.js');

assert(packageJson.version === GAME_CONFIG.version, `version match: ${packageJson.version}`);
assert(indexHtml.includes('viewport-fit=cover'), 'viewport uses viewport-fit=cover');
assert(styles.includes('safe-area-inset-top') && styles.includes('safe-area-inset-bottom'), 'safe-area CSS is present');
assert(!styles.includes('image-rendering: pixelated'), 'final canvas is not forced through pixelated CSS scaling');

// Every catalogued sector is loaded from disk and put through the same schema
// the game uses, so a map cannot ship registered but unplayable.
assert(MAP_CATALOG.length > 0, 'map catalog registers at least one sector');
assert(MAP_CATALOG.some((entry) => entry.id === GAME_CONFIG.recon.defaultMapId), `default map id is registered: ${GAME_CONFIG.recon.defaultMapId}`);
assert(new Set(MAP_CATALOG.map((entry) => entry.id)).size === MAP_CATALOG.length, 'registered map ids are unique');

const spriteNames = Object.values(SPRITE_SHEETS).flatMap((sheet) => sheet.names);
assert(spriteNames.length === 80, `sprite library contains 80 frames (found ${spriteNames.length})`);
assert(new Set(spriteNames).size === spriteNames.length, 'sprite frame names are unique');

const loadedMaps = [];
for (const entry of MAP_CATALOG) {
  assert(Boolean(entry.title && entry.environment && entry.description), `map catalog entry is described: ${entry.id}`);
  assert(Number.isFinite(entry.recommendedZoom) && entry.recommendedZoom > 0, `map recommended zoom is valid: ${entry.id}`);

  let map;
  try {
    map = JSON.parse(read(entry.source));
  } catch (error) {
    errors.push(`map source unreadable: ${entry.source} (${error.message})`);
    continue;
  }
  loadedMaps.push(map);

  assert(map.id === entry.id, `map data id matches catalog: ${entry.id}`);
  assert(map.title === entry.title, `map data title matches catalog: ${entry.id}`);

  const schema = validateReconMap(map);
  schema.errors.forEach((message) => errors.push(`[${entry.id}] ${message}`));
  schema.warnings.forEach((message) => warnings.push(`[${entry.id}] ${message}`));
  assert(schema.valid, `map passes validateReconMap: ${entry.id}`);

  for (const layer of map.layers ?? []) {
    const entries = layer.type === 'areas' ? (layer.areas ?? []) : (layer.items ?? []);
    for (const item of entries) {
      if (!item.sprite) continue;
      assert(Boolean(findSprite(item.sprite)), `[${entry.id}] map sprite resolves: ${item.sprite}`);
      const width = item.width ?? GAME_CONFIG.sprites.frameSize;
      const height = item.height ?? GAME_CONFIG.sprites.frameSize;
      const coordinatesValid = Number.isFinite(item.x) && Number.isFinite(item.y);
      assert(coordinatesValid, `[${entry.id}] map coordinates valid: ${item.sprite}`);
      if (coordinatesValid) {
        warn(item.x >= 0 && item.y >= 0 && item.x + width <= map.width && item.y + height <= map.height, `[${entry.id}] authored sprite clips map bounds: ${item.sprite}`);
      }
    }
  }

  const objectLayer = (map.layers ?? []).find((layer) => layer.id === 'objects');
  const entityIds = (objectLayer?.items ?? []).map((item) => item.id).filter(Boolean);
  assert(entityIds.length === new Set(entityIds).size, `[${entry.id}] authored entity ids are unique`);

  const metadata = (map.layers ?? []).find((layer) => layer.id === 'metadata')?.data ?? {};
  const missionTargetId = metadata.missionTargetId;
  assert(!missionTargetId || entityIds.includes(missionTargetId), `[${entry.id}] authored mission target resolves: ${missionTargetId ?? 'none'}`);

  // Every sector has to be playable in all three modes, so the change-detection
  // subject must exist and its authored second-pass position must be a real,
  // different place inside the sector.
  const changeSubject = (objectLayer?.items ?? []).find((item) => item.id === 'jeep-01');
  assert(Boolean(changeSubject), `[${entry.id}] change-detection subject jeep-01 exists`);
  const destination = metadata.changeDetection?.destination;
  if (changeSubject && destination) {
    const width = changeSubject.width ?? GAME_CONFIG.sprites.frameSize;
    const height = changeSubject.height ?? GAME_CONFIG.sprites.frameSize;
    assert(destination.x >= 0 && destination.y >= 0 && destination.x + width <= map.width && destination.y + height <= map.height,
      `[${entry.id}] change-detection destination sits inside the sector`);
    assert(Math.hypot(destination.x - changeSubject.x, destination.y - changeSubject.y) >= 200,
      `[${entry.id}] change-detection destination is a visible move`);
  }

  // A camera is clamped to the map, so a focus that asks for ground past the
  // edge quietly becomes a different focus. An authored training framing has
  // to still hold both positions of the thing it is framing once clamped.
  const focus = metadata.training?.changeFocus;
  if (changeSubject && destination && focus) {
    const zoom = focus.zoom ?? 1;
    const halfWidth = REFERENCE_VIEWPORT.width / (2 * zoom);
    const halfHeight = REFERENCE_VIEWPORT.height / (2 * zoom);
    const clamp = (value, half, span) => Math.min(Math.max(value, half), Math.max(half, span - half));
    const centreX = clamp(focus.x, halfWidth, map.width);
    const centreY = clamp(focus.y, halfHeight, map.height);
    const visible = (x, y, width, height) => x >= centreX - halfWidth && x + width <= centreX + halfWidth
      && y >= centreY - halfHeight && y + height <= centreY + halfHeight;
    assert(visible(changeSubject.x, changeSubject.y, changeSubject.width, changeSubject.height),
      `[${entry.id}] training change framing holds the subject's first position`);
    assert(visible(destination.x, destination.y, changeSubject.width, changeSubject.height),
      `[${entry.id}] training change framing holds the subject's second position`);
  }
}

// The recognition manual: every entry has to name a frame that ships, no
// frame may appear twice, and every note stays a short description of the art.
const guide = validateIdentificationGuide();
guide.errors.forEach((message) => errors.push(`[guide] ${message}`));
assert(guide.valid, `identification guide passes its own rules (${guide.entryCount} entries)`);
GUIDE_CATEGORIES.forEach((category) => {
  category.entries.forEach((item) => {
    assert(Boolean(findSprite(item.sprite)), `[guide] frame resolves: ${item.sprite}`);
  });
  assert(category.entries.length > 0, `[guide] category has entries: ${category.id}`);
});

// Haptics: a restrained vocabulary that scales by duration, with nothing
// firing for pointer movement or focus.
SILENT_HAPTIC_EVENTS.forEach((eventName) => {
  assert(HAPTICS[eventName] === undefined, `[haptics] no pulse for '${eventName}'`);
});
Object.keys(HAPTICS).forEach((eventName) => {
  assert(VOICES[eventName] !== undefined, `[haptics] '${eventName}' is a voiced event`);
});
assert(HAPTIC_LEVELS[0] === 'off' && LEVEL_SCALE.off === 0, '[haptics] OFF scales every pulse away');
HAPTIC_LEVELS.forEach((level) => {
  assert(typeof LEVEL_SCALE[level] === 'number', `[haptics] level has a scale: ${level}`);
});
Object.entries(HAPTICS).forEach(([eventName, pattern]) => {
  assert(scaleHapticPattern(pattern, 'off') === null, `[haptics] OFF silences '${eventName}'`);
  const pulses = (level) => {
    const scaled = scaleHapticPattern(pattern, level);
    return (Array.isArray(scaled) ? scaled.filter((_, index) => index % 2 === 0) : [scaled]);
  };
  const light = pulses('light');
  const standard = pulses('standard');
  const strong = pulses('strong');
  assert(light.every((value, index) => value <= standard[index] && standard[index] <= strong[index]),
    `[haptics] '${eventName}' grows with the level`);
  assert(strong.every((value) => value >= 1 && value <= MAX_PULSE_MS),
    `[haptics] '${eventName}' stays inside the pulse bounds at STRONG`);
  if (Array.isArray(pattern)) {
    const gaps = (level) => scaleHapticPattern(pattern, level).filter((_, index) => index % 2 === 1);
    assert(gaps('light').join() === gaps('strong').join(),
      `[haptics] '${eventName}' keeps its rhythm across levels`);
  }
});

['BootScene', 'MainMenuScene', 'MissionBriefingScene', 'EnhancedReconScene', 'TrainingScene', 'IdentificationGuideScene', 'ResultsScene'].forEach((sceneName) => {
  assert(mainSource.includes(sceneName), `main scene registration includes ${sceneName}`);
});

if (warnings.length) {
  console.warn('\nI SPY release validation warnings:');
  warnings.forEach((message) => console.warn(`  ! ${message}`));
}

if (errors.length) {
  console.error('\nI SPY release validation failed:');
  errors.forEach((message) => console.error(`  ✗ ${message}`));
  console.error(`\n${checks.length} checks passed; ${errors.length} failed.`);
  process.exit(1);
}

console.log(`I SPY release validation passed: ${checks.length} checks; ${warnings.length} warnings.`);
console.log(`Version: ${GAME_CONFIG.version}`);
console.log(`Maps: ${loadedMaps.map((entry) => `${entry.id} (${entry.width}x${entry.height})`).join(', ')}`);
console.log(`Sprite frames: ${spriteNames.length}`);
