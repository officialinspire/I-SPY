# Phase 14 — Sprite Art Upgrade and Consistency Audit

Phase 14 re-authors the complete 80-frame production sprite library while preserving the runtime sprite API and all gameplay geometry.

## Scope

Five 256×256 SVG sprite sheets remain in production:

- `i-spy-targets-sheet.svg`
- `i-spy-infrastructure-sheet.svg`
- `i-spy-environment-sheet.svg`
- `i-spy-intel-sheet.svg`
- `i-spy-ui-sheet.svg`

Each sheet remains a 4×4 grid of deterministic 64×64 logical cells.

No Phase 14 art pass changes frame names/order, manifest API, authored map coordinates, entity metadata, hitboxes, missions, scoring, seeded generation, or camera/gameplay behavior.

## Visual standard

Phase 14 replaces the earlier simplified geometric sprite language with a higher-fidelity fictional Cold War reconnaissance style:

- strong top-down / shallow-isometric silhouettes
- specific mechanical and structural construction
- upper-left light direction
- lower-right deep/cast shadow
- restrained four-tone rendering
- purposeful internal detail instead of arbitrary noise
- comparable detail density for targets and decoys
- reconnaissance clues that reward observation without highlighting answers

The production palette remains exactly:

- `#0B0B0B`
- `#333333`
- `#BDBDBD`
- `#F6F6EE`

## Phase 14 stages

### 14A — art contract

The sprite library was frozen as a production API and the higher-fidelity drawing, lighting, fairness, and material rules were added to `docs/ART-DIRECTION.md`.

### 14B — targets

The 16 military target/installation frames were redrawn with improved tracks, wheels, hulls, turrets, cabs, launchers, radar hardware, support structures and equipment detail.

### 14C — infrastructure

Roads, tracks, rail, bridge, fence/gate, utility assets and buildings were redrawn with surface wear, structural depth, roof planes, openings, supports and consistent shadows.

### 14D — environment

Terrain now uses deliberate material cues rather than random speckle. Vegetation uses layered crowns, distinct species silhouettes, visible trunk/branch logic and consistent lighting.

### 14E — intelligence and decoys

Tracks, footprints, soil disturbance, cut vegetation, smoke, storage items, camouflage, civilian vehicles, destroyed infrastructure, trenching and decoys were redrawn to match the same fidelity while staying visually fair.

### 14F — UI and full-library audit

The UI sheet was redrawn as fictional reconnaissance-terminal symbology:

- precision reticles and lock brackets
- confirmed/unverified analyst marks
- warning/interrogation symbols
- grid/datum markers
- scan-line elements
- framing corners
- terminal panel
- cursor

The symbols use the same four-tone vocabulary while allowing stronger under-strokes where necessary for legibility over reconnaissance imagery.

## Cross-sheet audit

The final Phase 14 audit verified all five production sheets:

| Check | Result |
| --- | --- |
| Sheet size | 256×256 on all five |
| Grid | 4×4 on all five |
| Frames | 16 unique expected cells per sheet / 80 total |
| Cell geometry | deterministic 64×64 logical cells |
| Clipping | all 80 frame groups clipped to their cell |
| Palette | approved four tones only |
| Gradients / blur / filters | none |
| Embedded text labels | none |
| Scripts / event handlers | none |
| Runtime manifest | unchanged |
| Gameplay/map geometry | unchanged |

### Visual consistency review

The source-art review also checked:

- upper-left highlight logic across objects and structures
- lower-right shadow/deep-mass logic
- top-down / restrained shallow-isometric viewpoint
- coherent silhouette density across military and civilian vehicles
- target/decoy fairness
- quieter clue contrast relative to primary structures
- deliberate terrain texture rather than random visual noise
- repeat-friendly infrastructure and vegetation where map scaling/rotation requires it
- no target-only glow, outline, saturation or polish advantage

UI symbols intentionally use stronger bracket/outline weights than world sprites because they must remain legible when composited over map imagery; they still use the same palette and crisp-edge language.

## Regression gate

Every Phase 14 release must continue to pass:

```bash
npm run validate
npm run build
```

GitHub Pages executes the validator before every production build. The validator remains authoritative for manifest resolution, authored map sprite references and mission-target integrity.
