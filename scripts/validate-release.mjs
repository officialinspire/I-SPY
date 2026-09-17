import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_CONFIG } from '../src/runtime-config.js';
import { SPRITE_SHEETS, findSprite } from '../src/assets/spriteManifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const errors = [];
const checks = [];
const assert = (condition, message) => {
  if (condition) checks.push(message);
  else errors.push(message);
};

const packageJson = JSON.parse(read('package.json'));
const map = JSON.parse(read('assets/maps/woodland-corridor-7.json'));
const indexHtml = read('index.html');
const styles = read('src/styles.css');
const mainSource = read('src/main.js');

assert(packageJson.version === GAME_CONFIG.version, `version match: ${packageJson.version}`);
assert(indexHtml.includes('viewport-fit=cover'), 'viewport uses viewport-fit=cover');
assert(styles.includes('safe-area-inset-top') && styles.includes('safe-area-inset-bottom'), 'safe-area CSS is present');
assert(!styles.includes('image-rendering: pixelated'), 'final canvas is not forced through pixelated CSS scaling');

const requiredLayers = ['terrain', 'vegetation', 'infrastructure', 'structures', 'objects', 'recon-clues', 'spawn-zones', 'metadata'];
const layerIds = new Set((map.layers ?? []).map((layer) => layer.id));
requiredLayers.forEach((id) => assert(layerIds.has(id), `map layer present: ${id}`));

const spawnLayer = (map.layers ?? []).find((layer) => layer.id === 'spawn-zones');
const requiredSpawnTags = ['road_vehicle', 'forest_concealment', 'compound_vehicle', 'open_field', 'structure', 'radar_site', 'civilian', 'clue_zone'];
const spawnTags = new Set((spawnLayer?.zones ?? []).map((zone) => zone.tag));
requiredSpawnTags.forEach((tag) => assert(spawnTags.has(tag), `spawn tag present: ${tag}`));

const spriteNames = Object.values(SPRITE_SHEETS).flatMap((sheet) => sheet.names);
assert(spriteNames.length === 80, `sprite library contains 80 frames (found ${spriteNames.length})`);
assert(new Set(spriteNames).size === spriteNames.length, 'sprite frame names are unique');

for (const layer of map.layers ?? []) {
  const entries = layer.type === 'areas' ? (layer.areas ?? []) : (layer.items ?? []);
  for (const item of entries) {
    if (!item.sprite) continue;
    assert(Boolean(findSprite(item.sprite)), `map sprite resolves: ${item.sprite}`);
    const width = item.width ?? GAME_CONFIG.sprites.frameSize;
    const height = item.height ?? GAME_CONFIG.sprites.frameSize;
    assert(Number.isFinite(item.x) && Number.isFinite(item.y), `map coordinates valid: ${item.sprite}`);
    assert(item.x >= 0 && item.y >= 0 && item.x + width <= map.width && item.y + height <= map.height, `map sprite in bounds: ${item.sprite}`);
  }
}

const objectLayer = (map.layers ?? []).find((layer) => layer.id === 'objects');
const entityIds = (objectLayer?.items ?? []).map((entity) => entity.id).filter(Boolean);
assert(entityIds.length === new Set(entityIds).size, 'authored entity ids are unique');

const missionTargetId = (map.layers ?? []).find((layer) => layer.id === 'metadata')?.data?.missionTargetId;
assert(!missionTargetId || entityIds.includes(missionTargetId), `authored mission target resolves: ${missionTargetId ?? 'none'}`);

['BootScene', 'MainMenuScene', 'MissionBriefingScene', 'EnhancedReconScene', 'ResultsScene'].forEach((sceneName) => {
  assert(mainSource.includes(sceneName), `main scene registration includes ${sceneName}`);
});

if (errors.length) {
  console.error('\nI SPY release validation failed:');
  errors.forEach((message) => console.error(`  ✗ ${message}`));
  console.error(`\n${checks.length} checks passed; ${errors.length} failed.`);
  process.exit(1);
}

console.log(`I SPY release validation passed: ${checks.length} checks.`);
console.log(`Version: ${GAME_CONFIG.version}`);
console.log(`Map: ${map.id} (${map.width}x${map.height})`);
console.log(`Sprite frames: ${spriteNames.length}`);
