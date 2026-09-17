# I SPY sprite-sheet specification

Phase 4 establishes the authored sprite library and its runtime contract.

## Sheets

All sheets are 256×256 SVGs arranged as 4×4 grids of 64×64 frames with transparent backgrounds.

- `i-spy-environment-sheet.svg` — terrain and vegetation
- `i-spy-infrastructure-sheet.svg` — roads, rail, utilities and buildings
- `i-spy-targets-sheet.svg` — vehicles and installations
- `i-spy-intel-sheet.svg` — reconnaissance clues, civilian decoys and change-detection states
- `i-spy-ui-sheet.svg` — reticles, markers, scan/grid overlays and terminal framing

The five sheets provide 80 deterministic frames total.

## Naming and frame order

Use lowercase `snake_case`. Coordinates and indexes are derived by `src/assets/spriteManifest.js`; gameplay metadata should refer to names, not raw frame numbers.

### Environment
`ground`, `dirt`, `mud`, `field`, `water`, `rocky`, `snow`, `crater`, `conifer`, `deciduous`, `dead_tree`, `forest_cluster`, `bush`, `hedge`, `stump`, `fallen_tree`

### Infrastructure/buildings
`road_straight`, `road_curve`, `road_intersection`, `dirt_track`, `rail`, `bridge`, `fence`, `gate`, `pole`, `pipeline`, `farmhouse`, `barn`, `warehouse`, `barracks`, `bunker`, `hangar`

### Vehicles/installations
`tank`, `apc`, `military_truck`, `fuel_truck`, `jeep`, `radar_vehicle`, `missile_transporter`, `artillery`, `radar_dish`, `antenna_array`, `radio_tower`, `watchtower`, `fuel_tanks`, `bunker_entrance`, `generator`, `sam_site`

### Clues/decoys/change detection
`tire_tracks`, `track_marks`, `footprints`, `disturbed_soil`, `cut_vegetation`, `smoke`, `crates`, `barrels`, `camouflage_net`, `tractor`, `civilian_truck`, `hay_bale`, `destroyed_bridge`, `trench`, `dummy_tank`, `abandoned_equipment`

### UI
`reticle`, `reticle_lock`, `marker_confirm`, `marker_unverified`, `question`, `exclamation`, `grid_dot`, `grid_cross`, `scanline_h`, `scanline_v`, `corner_tl`, `corner_tr`, `corner_bl`, `corner_br`, `panel`, `cursor`

## Orientation conventions

Phase 13C fixed these conventions so map data can compose the library without distorting it:

- **Linear assets are authored east-west.** `road_straight`, `road_curve`, `road_intersection`,
  `dirt_track`, `rail`, `bridge`, `fence`, `gate` and `pipeline` run left to right. A north-south
  run sets `rotation: 90` on the map item and swaps the footprint, rather than stretching an
  east-west asset down a north-south rectangle.
- **Vehicles head east.** Every vehicle and civilian decoy points right, matching authored
  footprints that are wider than they are tall.
- **Buildings are roof plans**, seen from directly above, with a ridge line and two roof planes.
- **Light comes from the upper left**, so cast shadows fall to the lower right on every frame.
- **Terrain tiles bleed to the frame edge** and wrap their texture so they tile seamlessly; each
  frame is clipped to its own 64x64 cell.
- **Long runs are segmented.** A fence or pipeline is placed as ~64-unit segments so post and
  saddle spacing stays constant instead of stretching with the run.

## Anchoring and hit areas

World objects should normally use origin `0.5, 0.5`; terrain tiles use `0, 0`; UI overlays use `0.5, 0.5`. Gameplay hit areas remain metadata-driven and must never be inferred from transparent pixels. Recommended minimum logical hit areas are roughly 40×48 for small vehicles, 48×52 for larger vehicles and a forgiving authored footprint for structures. Mobile presentation should still yield approximately 44 CSS pixels of usable touch target.

## Phaser loading

`BootScene` preloads every SVG with fixed 256×256 rasterization, then `registerSpriteFrames()` adds named 64×64 frames to each Phaser texture. Future code can use:

```js
this.add.image(x,y,'ispy-targets','tank');
this.add.image(x,y,'ispy-ui','reticle');
```

The existing procedural recon map remains in place during Phase 4. This deliberately separates the art pipeline from map conversion so the working Locate mission is not destabilized before the authored-map phase.
