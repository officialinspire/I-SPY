# I SPY art direction

## North star

I SPY should look like a fictional Cold War satellite-reconnaissance workstation interpreted through detailed late-20th-century military game art. The player is an imagery analyst, not an action-game pilot, so the art rewards observation rather than highlighting answers.

The production target is now a higher-fidelity, hand-authored tactical sprite language: compact top-down / near-isometric forms with the dense mechanical readability, material definition and silhouette discipline associated with polished 1990s military arcade and tactical games, translated into I SPY's own monochrome reconnaissance style. Reference that level of craft rather than copying any external game's assets, characters, vehicles or exact compositions.

## Hard palette

Authored reconnaissance sprites use exactly four tones:

- `#0B0B0B` — black / deepest silhouette and cast shadow
- `#333333` — charcoal / primary mass
- `#BDBDBD` — light gray / secondary plane
- `#F6F6EE` — off-white / controlled highlight

Runtime UI may continue using the project's near-black and middle gray, but production sprite-sheet artwork stays four-tone.

## Phase 14 fidelity standard

Every sprite should read as intentionally drawn rather than assembled from generic primitives.

Prefer:

- strong, specific silhouettes
- believable mechanical or architectural construction
- layered roof, hull and equipment planes
- purposeful asymmetry where real machinery would have it
- wheels, tracks, wheel wells, hatches, vents, doors, panels, supports and equipment that explain the object
- clustered foliage and terrain marks with deliberate placement
- compact shadow masses that reinforce form
- highlights that describe material or orientation instead of decorating the sprite
- enough internal information to reward close inspection at gameplay zoom without turning into visual noise

Avoid:

- a single rectangle plus circles as the full description of a vehicle
- arbitrary speckles used as a substitute for texture
- generic blobs for vegetation or structures
- detail that has no relationship to the object's construction
- bright outline treatments around targets
- gradients, glow, neon or glossy modern effects

## Viewpoint and lighting

- top-down or near-top-down / shallow isometric reconnaissance viewpoint
- orientation should remain consistent within a sheet unless the object itself requires another orientation
- primary light direction: upper-left
- cast/deep shadow direction: lower-right
- `#BDBDBD` and sparse `#F6F6EE` describe upper/left-facing planes and hard highlights
- `#333333` carries most object mass
- `#0B0B0B` defines deepest recesses, tracks, openings and cast shadows

Perspective should be restrained enough that objects still make sense as satellite-analysis sprites.

## Shape language

- crisp edges
- compact geometric construction informed by real object anatomy
- no painterly anti-aliasing or gradients
- silhouettes, spatial context and clue patterns do most of the recognition work
- controlled dithering/noise is acceptable only when it supports a material or terrain surface
- no glow, neon, color-coded targets or glossy modern UI

## Military vehicle standard

Military vehicles should distinguish themselves through construction, not brightness.

Useful readable features include:

- tank/APC hull taper
- track runs and road-wheel rhythm
- turret ring and hatch placement
- barrel or launcher mounting
- truck cab vs cargo-bed separation
- fuel-tank cylinder construction
- radar/dish support hardware
- missile transporter rail geometry
- artillery trail, wheels and gun carriage

Vehicles may be visually dense, but the silhouette must remain readable at 64×64.

## Installation and structure standard

Installations should show plausible functional construction through:

- support legs and foundations
- structural frames
- dishes, masts and guying
- platforms and access points
- equipment cabinets
- roof or deck planes
- revetments, berms and perimeter forms
- pipes or service connections where appropriate

## Environment standard

Terrain and vegetation should be hand-authored rather than random-noise fields.

Prefer recognizable material cues:

- soil clumps and compressed dirt
- tire ruts in mud
- agricultural row rhythm
- directional water ripples
- rock facets
- snow exposure
- crater rim + interior shadow
- layered tree crowns
- distinct conifer vs deciduous silhouettes
- branch/trunk structure for dead or fallen trees

Repeatable terrain should not expose obvious seams or repeated single stamps.

## Intelligence-clue standard

Reconnaissance clues stay subtle. Their job is to reward observation, not advertise the answer.

Tracks, disturbed soil, footprints, camouflage, crates, barrels, smoke and abandoned equipment should read as environmental evidence at close inspection while remaining naturally embedded in the scene.

## Fairness rule

Targets must not be brighter, cleaner or more detailed than civilian decoys. A tank, radar site or military truck should sit naturally among roads, farm equipment, structures and vegetation.

The same fidelity standard applies to civilian vehicles, tractors, infrastructure and decoys as those sheets are upgraded. Do not use line weight, contrast, highlight quantity or polish level to disclose which objects are mission-relevant.

Difficult targets can be supported by indirect clues such as tire tracks, disturbed soil, cut vegetation, smoke, crates or camouflage netting.

## Cold War flavor

Preferred reference language is fictional and generic: satellite-film contact sheets, reconnaissance-map symbology, 1960s–1980s field intelligence displays, early tactical computer imagery, monochrome CRT terminals and richly constructed late-20th-century military game art.

Avoid copying real classified imagery, real facility layouts, distinctive current operational sites, or exact copyrighted game sprites.

## Production contract

The sprite library is a runtime API and remains frozen unless a later migration explicitly changes it.

For the current production set:

- five SVG sheets
- each sheet is exactly 256×256
- each sheet is a 4×4 grid
- every frame occupies one deterministic 64×64 cell
- existing frame names stay unchanged
- existing frame order stays unchanged
- transparent sheet background where applicable
- no labels inside frame boundaries
- only the four approved sprite colors
- no object may visually escape its frame
- logical gameplay dimensions, map coordinates and hitboxes do not change merely to accommodate new artwork

The existing 2× runtime SVG rasterization remains the rendering path. Higher visual fidelity comes from better source drawing, not by changing gameplay scale.

## Phase 14 benchmark

`assets/sprites/i-spy-targets-sheet.svg` is the first Phase 14 redraw and serves as the visual-quality benchmark for subsequent infrastructure, environment, intel and UI sheet upgrades.

Later sheets should match its:

- lighting direction
- shadow logic
- detail density
- mechanical/structural specificity
- silhouette quality
- disciplined four-tone rendering

Any later sprite-art change must continue to pass the project's release validator and production build.
