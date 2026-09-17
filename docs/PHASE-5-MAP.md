# Phase 5 — Authored Woodland Recon Map

Phase 5 replaces the procedural reconnaissance test environment with a data-driven authored map.

## Production map

`assets/maps/woodland-corridor-7.json`

The sector is entirely fictional and designed for gameplay. It contains a rural road corridor, river crossing, agricultural land, civilian farm, dense woodland, utility infrastructure, and a fenced Cold War-inspired installation.

## Layer contract

Every authored map must contain these layer ids:

1. `terrain` — tiled area fills
2. `vegetation` — trees, forest clusters, hedges, brush
3. `infrastructure` — roads, tracks, bridge, fences, utilities
4. `structures` — non-target buildings and compound structures
5. `objects` — selectable game entities with metadata
6. `recon-clues` — tracks, disturbed soil, camouflage and related evidence
7. `spawn-zones` — invisible gameplay-authoring regions
8. `metadata` — map-level settings and recommended camera view

## Spawn-zone tags

The first map defines reusable zones for:

- `road_vehicle`
- `forest_concealment`
- `compound_vehicle`
- `open_field`
- `structure`
- `radar_site`
- `civilian`
- `clue_zone`

Each zone has an `accepts` list. Future mission generation should select a compatible zone first, then place only an accepted object type in that zone.

## Runtime validation

`src/world/authoredReconMap.js` validates maps before rendering. Invalid schema, missing required layers, unknown sprite names, duplicate entity ids, invalid coordinates, broken spawn zones, and missing mission targets are surfaced as developer errors. Nonfatal authoring issues are surfaced as warnings.

## Debugging

- `?debugTargets=1` shows entity hit areas.
- `?debugMap=1` shows authored spawn-zone bounds.
- Both flags can be enabled together.

## Phase 6 handoff

Phase 6 can build COUNT mode on this map without changing the renderer. The same spawn-zone contract is also the base for later mission randomization.
