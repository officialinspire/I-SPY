# Phase 13C — Reconnaissance graphics and environmental art polish

Phase 13C re-authors the four gameplay sprite sheets and re-composes parts of the authored map so
the imagery reads as satellite reconnaissance rather than placeholder geometry. Mission rules,
scoring, seeded generation, target validation, entity metadata, hitboxes and the Recon camera are
untouched, and no target is made brighter, outlined or otherwise easier to spot than its neighbours.

## What the audit found

Rendering the authored map through the real 2x raster pipeline made four problems obvious:

1. **Every terrain tile drew its own border.** Each 64x64 tile was inset by 4 units and stroked, so
   the ground tiled as a hard grid of separated squares — the single largest placeholder artefact.
2. **Linear assets pointed the wrong way.** `road_straight`, `bridge` and `fence` were authored
   north-south but placed east-west (or the reverse), so a 192x72 road segment stretched a vertical
   band into a squat block and a 570x30 fence run smeared nine posts into blobs.
3. **Buildings were drawn as front elevations** — pitched-roof triangles with doors and windows —
   inside a top-down reconnaissance view.
4. **Vehicles faced north while every authored footprint is wider than tall**, so each one rendered
   squashed across its long axis.

## Art rules this phase establishes

- **Four tones only.** `#0B0B0B`, `#333333`, `#BDBDBD`, `#F6F6EE`. Intermediate values are built by
  dithering two real tones, never by opacity or gradients.
- **One sun.** Light comes from the upper left, so cast shadows fall to the lower right on every
  vehicle, structure and tree. This is what gives structures depth without perspective.
- **Linear assets run east-west.** Roads, tracks, rail, fences, gates, pipelines and bridges are
  authored horizontally; north-south runs in map data rotate the frame 90 degrees instead of
  stretching an east-west asset down a north-south footprint.
- **Vehicles head east.** Every authored vehicle footprint is wider than tall, so the long axis of
  the artwork now matches the long axis of the placement.
- **Terrain tiles bleed to the frame edge** and wrap their texture, so nothing reads as a grid.
  Each frame is clipped to its own cell, which lets a pattern overhang an edge and reappear on the
  opposite side without bleeding into the neighbouring frame.

## Sheet-by-sheet changes

### Environment

- `ground`, `dirt`, `mud`, `field`, `water`, `rocky`, `snow` are now full-bleed seamless tiles with
  clumped, low-contrast noise instead of bordered squares with a centred motif. Noise clumps rather
  than distributing evenly, which stops a repeated tile reading as polka dots.
- `field` carries plough furrows on a pitch that divides the tile, so crop rows run unbroken across
  a whole field.
- `water` runs its flow lines along the channel's long axis with a dark thalweg and light ripples.
- `rocky` is faceted scree with a consistent shadow side; stones are small and numerous so a
  one-tile-wide riverbank does not read as a repeated stamp.
- `conifer` is a needled rosette seen from above, `deciduous` a lobed crown, and both carry a cast
  shadow and a lit upper-left face. `forest_cluster` is nine crowns that fill the frame edge to
  edge, so adjacent stands merge into continuous canopy.
- `crater`, `stump`, `fallen_tree`, `bush`, `hedge` and `dead_tree` were redrawn with the same
  shadow-and-highlight recipe; `hedge` is edge-continuous so field boundaries join up.

### Infrastructure

- `road_straight` is a sealed carriageway with gravel shoulders, black edge lines, a dashed centre
  line pitched so it still reads correctly under the 3x stretch of a 192-unit segment, and a few
  patch marks. `road_curve` and `road_intersection` match it.
- `dirt_track` is two worn ruts; `rail` is ballast, sleepers and running rails; `bridge` is a road
  deck with parapets and abutments instead of a caged panel; `pipeline` sits on saddles.
- `fence` and `gate` are drawn for 64-unit runs with thin posts and wire.
- `pole` is a plan view: crossarm, insulators and a long cast shadow.
- **All six buildings are now roof plans.** `farmhouse`, `barn` and `barracks` are two-plane pitched
  roofs with a ridge line, eaves shadow, battens near the eaves and a yard apron; `warehouse` is a
  flat roof with panel seams, vents, a skylight strip and a loading dock; `bunker` is a hardened
  slab inside an earth berm; `hangar` is an arched roof with rib arcs and a door bay.

### Targets

- All eight vehicles head east with rectangular contact-patch wheels rather than protruding dots,
  and are differentiated by silhouette alone: tank (track bands, offset turret, long barrel), APC
  (eight wheels, sloped nose), military truck (cab plus ribbed tilt bed), fuel truck (cab plus
  cylindrical barrel), jeep (short, open, spare on the tail), radar vehicle (dish on a flatbed),
  missile transporter (twin canisters on a long chassis), artillery (split trails, wheels, barrel).
- Installations are plan views: `radar_dish` with ribbed face and pedestal, `antenna_array` with
  guy anchors, `radio_tower` as a lattice plan with a long shadow, `watchtower` as a railed
  platform, `fuel_tanks` as three tanks inside a containment berm, plus `bunker_entrance`,
  `generator` and `sam_site`.
- The mission target on the authored map (`radar-01`) uses exactly the same tonal recipe and level
  of detail as the fuel tanks, generator and bunker beside it.

### Intel

- Clues are deliberately quiet. `disturbed_soil`, `camouflage_net` and `smoke` are dithered
  mid-tones rather than solid black masses; `tire_tracks`, `track_marks` and `footprints` are faint
  ground signs; `cut_vegetation` is felled scrub and stumps.
- `crates`, `barrels`, `trench`, `destroyed_bridge` and `abandoned_equipment` were redrawn with the
  shared shadow recipe.
- **Decoys are built from the same parts library as the military vehicles.** `tractor` and
  `civilian_truck` get the same hull, wheel and shadow treatment as the tank and the military
  truck, so a decoy never reads as second-class art. `dummy_tank` keeps a plausible tank silhouette
  but is flat, featureless and staked down — distinguishable on inspection, not at a glance.

## Map composition

`assets/maps/woodland-corridor-7.json` changed only in its decorative layers. No entity, spawn
zone, hitbox, id, category or metadata value was touched.

- Six fence runs were split into 64-unit segments so post spacing stays honest instead of smearing
  across a 570-unit run, and the four north-south runs plus the compound gate now rotate the
  east-west artwork by 90 degrees. The pipeline was segmented the same way.
- The four north-south `dirt_track` runs rotate the east-west track art.
- 24 vegetation stands carry deterministic `flipX` / `flipY` variants so the same forest sprite
  stops reading as a repeated stamp.
- Three small terrain patches (two `dirt`, one `rocky`) break up the largest stretches of open
  ground.

## Deliberate departures

- **Buildings changed viewpoint.** The brief asked to preserve the top-down viewpoint; the previous
  building art was front-elevation, which contradicted both the brief and the premise of satellite
  imagery. They are now genuinely top-down, which is the single largest readability gain in the
  phase. Footprints, ids and hitboxes are unchanged.
- **Linear art changed orientation**, which required the decorative map edits above. The alternative
  — authoring each linear asset twice — would have needed the manifest to grow past its 4x4 frame
  grid.

## Constraints held

- All 80 frame names, the 4x4 x 64px frame grid, the logical frame sizes and the five-sheet layout
  are unchanged; the manifest was not expanded.
- HiDPI rendering and the 2x supersampled raster pipeline are untouched.
- No gradients, glows, photorealism, high-saturation colour, target outlines or highlighting.

## Verification

- `npm run validate` — 273 checks, 0 warnings (up from 207: the segmented fence and pipeline runs
  add sprite-resolution checks).
- `npm run build` — clean.
- Rendered through a harness that reproduces the real pipeline (SVG rasterized at 2x, frames
  sampled at 128px, `tileSprite` repeat step matched) at full-map and 1.6x inspection crops, then
  confirmed in the built game in Chromium across LOCATE, COUNT and CHANGE at minimum, default and
  maximum zoom, with no console or page errors.
