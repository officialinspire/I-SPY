# Phase 15A — Multi-map architecture

The game assumed WOODLAND CORRIDOR 7 was the only sector that existed. Map data was imported at
the top of `authoredReconMap.js` and re-exported as `DEFAULT_RECON_MAP`; every mission factory
defaulted to it, and `ReconScene` called `createAuthoredReconMap(this)` with no map at all — so a
mission could carry a `mapId` and the scene would still build woodland.

Phase 15A replaces that assumption with a registry. A mission now *requests* a sector by id and the
scene builds the sector it asked for. Nothing about WOODLAND CORRIDOR 7 changed: the same 303
seeded missions hash identically before and after.

## Shape

Three modules, split by what each one is allowed to depend on:

| Module | Holds | Depends on |
| --- | --- | --- |
| `src/world/reconMapSchema.js` | `validateReconMap()`, layer/entity/zone/metadata readers, required layers and spawn tags | the sprite manifest only |
| `src/world/mapCatalog.js` | what sectors exist: id, title, environment, description, difficulty, recommended zoom, source path | nothing |
| `src/world/mapRegistry.js` | binds each catalog entry to its bundled map JSON; lookup and resolution | catalog, schema, map JSON |

The split is what lets the release validator enforce the acceptance criterion. `mapRegistry.js`
imports JSON, which Vite resolves and Node does not, so the validator reads `mapCatalog.js`
instead — plain data, importable anywhere — loads each entry's `source` from disk, and runs the
*same* `validateReconMap()` the game runs. One list of sectors, two consumers, no second place to
forget a map.

`authoredReconMap.js` keeps its job — turning map data into Phaser objects — and re-exports the
schema helpers so existing import sites did not have to move.

## Resolution

`resolveReconMap()` accepts a registry id, a registry entry or raw map data, and returns map data.
Everything that used to default to `DEFAULT_RECON_MAP` now calls it:

```js
createAuthoredReconMap(scene, mission.mapId)   // ReconScene, both worlds in CHANGE
createLocateMission(mapSource)                 // sector and mapId come from the resolved map
createCountMission(mapSource)
createChangeDetectionMission(mapSource)
createGeneratedMission({ seed, mode, map })
validateGeneratedMission(mission)              // resolves mission.mapId when no map is passed
```

An unknown id warns and falls back to the default sector rather than throwing. A mission saved
against a map that no longer ships should still be playable; a black screen is a worse answer than
the wrong woodland.

## Seeded reproducibility

The generator's map is **never drawn from the seeded RNG**. It is an explicit option that defaults
to the registry default, so selecting a sector cannot shift the random stream, and a seed keeps
producing the same mission on the map it was generated for. This was the main constraint on the
refactor and it is verified rather than asserted: a fingerprint of 303 missions — 180 mode-locked,
120 free-mode and the 3 authored taskings — hashes to `5a3b3c6c…` both before and after the change,
and `createGeneratedMission({ seed })`, `{ seed, map: 'woodland-corridor-7' }` and
`{ seed, map: <data> }` produce identical missions across 40 seeds.

## Validation

`npm run validate` now walks the catalog instead of one hard-coded path. Per registered map it
asserts the catalog entry is described, the data's `id` and `title` match the catalog, and the map
**passes `validateReconMap()`**, with schema errors and warnings reported under the map's id. It
also asserts that the default map id is registered and that registered ids are unique.

The check count moved from 273 to 265 because sixteen individual layer/spawn-tag assertions are now
covered by the single schema call, which tests those plus sprite resolution, entity integrity, zone
bounds and metadata targets. Coverage went up; the counter went down.

## Also changed

- `GAME_CONFIG.recon.worldWidth` / `worldHeight` are gone. They hard-coded woodland's 2400x1800 into
  config and nothing read them — camera bounds already come from the loaded map, and the registry
  exposes per-map `width`/`height`.
- `?map=<id>` joins `?seed=` and `?mode=` as a generator option, so a sector can be requested from
  the URL.

## Not in this phase

No new map, no gameplay, scoring or sprite-contract changes, and no UI text changes: the briefing's
`SECTOR:` line resolves through the registry but still reads `WOODLAND CORRIDOR 7`.

## Verified

- 303-mission generator fingerprint identical before and after (`sha256 5a3b3c6c…`).
- 29 registry checks: lookup by id/entry/data, unknown-id fallback with exactly one warning,
  `validateMapRegistry()` clean for every entry, every authored and generated mission carrying a
  `mapId` whose sector matches the registry title.
- Browser smoke test of all three authored modes plus `?map=woodland-corridor-7` and a deliberately
  bogus `?map=does-not-exist`: canvas builds in every case, no page or console errors.
- `npm run validate` (265 checks, 0 warnings) and `npm run build` pass.
