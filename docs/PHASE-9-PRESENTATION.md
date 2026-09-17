# Phase 9 — Cold War Presentation Pass

Phase 9 converts the existing playable systems into a coherent fictional intelligence-analysis console without changing mission rules, scoring, generation, target validation, or authored map data.

## Design target

The presentation should read as a fictional late-Cold-War reconnaissance workstation interpreted through a four-tone handheld/pixel-game aesthetic.

It should feel:

- bureaucratic
- technical
- restrained
- monochrome
- slightly degraded
- readable under pressure

It should **not** feel like neon cyberpunk, a modern glass UI, or a loud action-game HUD.

## Palette

Phase 9 continues to use the production four-tone family:

- black `#0B0B0B`
- charcoal `#333333`
- light gray `#BDBDBD`
- off-white `#F6F6EE`

Additional transparency is permitted for overlays, borders, scanlines, haze and vignette effects. No new color accent is introduced.

## Shared presentation helpers

`src/ui/presentation.js` provides reusable presentation primitives:

- `createTerminalChrome()` — scene border, corner marks, classification text, station labels and system version
- `typeText()` — fast typewriter-style text reveal
- `prefersReducedMotion()` — browser reduced-motion query helper
- `drawReticle()` — monochrome reconnaissance reticle

This keeps classification markings and terminal framing consistent between scenes.

## Global CRT shell

`src/styles.css` applies a restrained display treatment above the Phaser canvas:

- subtle repeating scanlines
- edge vignette
- slight monochrome contrast increase
- a low-opacity horizontal synchronization roll

The overlay uses `pointer-events: none` and therefore cannot block gameplay input.

The synchronization roll is disabled under `prefers-reduced-motion: reduce`.

## Boot / satellite acquisition

Boot now presents a short `SATELLITE LINK ACQUISITION` sequence.

Displayed information includes:

- orbital reticle
- satellite track number
- sensor mode
- encrypted-link state
- grid datum verification
- ephemeris verification
- imagery-channel readiness

Normal-motion duration is controlled by `GAME_CONFIG.presentation.bootDurationMs` and is deliberately short. Reduced-motion users bypass the sweep/status animation and transition quickly to the menu.

## Main menu

The main menu is framed as `IMAGE ANALYSIS STATION 04` and `ORBITAL IMAGERY ANALYSIS CONSOLE`.

Existing mission buttons remain functionally unchanged. Presentation additions include:

- classification frame
- console panel border
- system/link status line
- restrained blinking link indicator when motion is permitted

No extra menu navigation layer was introduced.

## Mission briefing

Mission briefing now resembles an intelligence tasking order.

It includes:

- tasking-order heading
- mission/file identifier
- `EYES ONLY` language
- `RESTRICTED` stamp treatment
- primary objective terminology
- analyst note / image-comparison sections where applicable
- fast typewriter reveal
- `ACQUIRE IMAGERY` action

`ACQUIRE IMAGERY` performs a short presentation handoff before opening the existing `Recon` scene with the exact same mission object.

This is important: Phase 9 does not duplicate or transform mission state during presentation.

## Recon scene

The stable reconnaissance gameplay scene is intentionally not structurally rewritten in Phase 9.

Its existing elements already fit the presentation system:

- coordinate readout
- monochrome grid
- imagery grain / haze
- timer
- mission/objective header
- mark/confirm controls
- PASS A / PASS B comparison language

The global CRT shell gives Recon the same display treatment while avoiding unnecessary risk to pan/zoom, split-view, generated-world state, target selection and timer logic.

## Results / debrief

Results are presented as a post-mission intelligence debrief.

New terminology includes:

- `ASSESSMENT COMPLETE`
- `ANALYST DEBRIEF`
- `SCORING LEDGER`
- `INTELLIGENCE DISPOSITION`

The generated mission seed remains visible when present.

## Accessibility / readability rules

1. Recon imagery must remain readable; effects cannot overpower targets.
2. No rapid flicker or flashing effects.
3. Reduced-motion disables the global synchronization roll.
4. Reduced-motion skips typewriter animation and shortens acquisition transitions.
5. CRT overlays never capture pointer input.
6. Classification/chrome text may hide on narrow or short viewports before core controls do.
7. No gameplay target is visually highlighted by Phase 9 presentation effects.

## Runtime configuration

Phase 9 advances runtime version to `0.9.0` and adds:

```js
presentation: {
  bootDurationMs: 1250,
  acquisitionDelayMs: 520,
  typewriterCharsPerSecond: 130,
  classification: 'RESTRICTED // TRAINING USE'
}
```

## Phase 9 non-goals

Phase 9 does not add:

- background music
- sound effects
- haptics
- save/profile progression
- additional maps
- additional mission mechanics
- PWA/offline support

Those remain later phases.
