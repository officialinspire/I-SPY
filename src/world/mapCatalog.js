/**
 * Which reconnaissance sectors exist, and what the console knows about them
 * before any of their data is loaded.
 *
 * This file holds descriptions only — no map JSON, no Phaser, no imports that
 * a bundler has to resolve. `mapRegistry.js` binds each descriptor to its
 * bundled map data for the game, and the release validator reads the same
 * descriptors in Node to load each `source` file from disk and put it through
 * `validateReconMap()`. One list, two consumers, no second place to forget.
 */

export const MAP_CATALOG = Object.freeze([
  Object.freeze({
    id: 'woodland-corridor-7',
    title: 'WOODLAND CORRIDOR 7',
    environment: 'RURAL WOODLAND',
    description: 'Mixed forest and farmland either side of a north-south trunk road, with a fenced radar compound on the eastern approach.',
    difficulty: 1,
    recommendedZoom: 0.75,
    source: 'assets/maps/woodland-corridor-7.json',
  }),
  Object.freeze({
    id: 'frostline-relay',
    title: 'FROSTLINE RELAY',
    environment: 'ALPINE SNOW',
    description: 'A snow valley pinched between two rocky massifs, carrying a telegraph line and a climbing service road up to a relay station on the ridge.',
    difficulty: 2,
    recommendedZoom: 0.75,
    source: 'assets/maps/frostline-relay.json',
  }),
]);

export function getCatalogEntry(id) {
  return MAP_CATALOG.find((entry) => entry.id === id) ?? null;
}
