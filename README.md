# I SPY 🕵️‍♂️

**I SPY** is a browser-based Cold War-inspired satellite reconnaissance and imagery-analysis puzzle game by **INSPIRE**.

The player studies fictional monochrome overhead reconnaissance imagery, pans and zooms across terrain, and eventually identifies targets, structures, patterns, clues, and changes between satellite passes.

## Visual direction

- Cold War intelligence terminal aesthetic
- Black, white, and grayscale only
- Pixel-art / old handheld monochrome game presentation
- Top-down reconnaissance imagery
- Subtle scanline/grain treatment rather than glossy modern UI

## Current implementation

### Phase 0 — Foundation

- Phaser 3 + Vite
- Modern JavaScript modules
- Responsive canvas for mobile and desktop
- Boot, Main Menu, Mission Briefing, Recon, and Results scenes
- Centralized runtime configuration
- Placeholder-only art pipeline ready for later sprite-sheet integration
- Monochrome UI and navigation shell

### Phase 1 — Recon map engine

- Large 2400×1800 fictional woodland/rural reconnaissance map
- Mouse/touch drag panning
- Wheel zoom and two-pointer pinch zoom
- Min/max zoom limits
- Camera world bounds
- Reset-view control
- Recon HUD with mission, objective, coordinates, timer placeholder, mark-target placeholder, and pause
- Optional-style coordinate grid visualization
- Procedural placeholder terrain containing forest, clearings, fields, roads, dirt tracks, river, bridge, farm structures, fenced installation, and utilities

Target validation, scoring, and actual mission logic are intentionally deferred to later phases.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Controls

### Desktop

- Drag: pan reconnaissance image
- Mouse wheel: zoom
- `Esc`: pause/resume
- RESET VIEW: recenter map

### Touch

- One finger: pan
- Two fingers: pinch zoom
- RESET VIEW: recenter map

## Planned development sequence

1. ✅ Project foundation
2. ✅ Recon map engine
3. Target identification system
4. LOCATE mission mode
5. Sprite-sheet integration preparation
6. Authored woodland tilemap
7. COUNT mode
8. CHANGE DETECTION mode
9. Mission generator
10. Cold War presentation pass
11. Audio / haptics / feedback
12. Release-candidate audit

## Asset directories

- `assets/sprites/` — future monochrome sprite sheet / atlas
- `assets/maps/` — authored reconnaissance maps
- `assets/ui/` — interface assets
- `public/` — static public files

## Design principle

I SPY should reward observation and contextual reasoning. Targets should not glow or visually advertise themselves; they should blend naturally into the same monochrome visual language as the rest of the reconnaissance imagery.
