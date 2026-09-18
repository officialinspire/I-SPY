# Phase 13 — Release-candidate audit

A full pass over the Phase 13 build (`1.2.1-demo`) across the main menu, the mission flow, all
three analysis modes, the seeded generator, the artwork, input and accessibility, feedback and
responsive layout. No features were added. Everything below is a defect that was reproduced first
and then fixed, and the release was cut as **`1.2.2-demo`**.

Puzzle content is untouched: `src/game/`, `src/world/` and `assets/` are byte-identical to the
previous release, so mission generation, validation, scoring and the authored map are unchanged.

## Defects found and fixed

### 1. The HUD left the screen when the analyst zoomed

**Severity: blocker.** Screen-space objects use `scrollFactor(0)`, but a Phaser camera still applies
its zoom to them around the viewport centre. The recon console is drawn in screen space, so it was
scaled and displaced by whatever zoom the analyst was using:

- at the default 0.75 zoom the console floated as a 75%-size band inset from every edge;
- at maximum zoom the objective, the timer, MARK TARGET, RESET VIEW and PAUSE were all **off
  screen** — the analyst lost every control by zooming in, including PAUSE;
- at minimum zoom the console shrank to an illegible strip in the middle of the imagery;
- the marking reticle, which tracks the pointer in screen space, was drawn away from the pointer by
  the same transform.

Phase 13D had compensated for the displacement in the *hit test* (`toHudSpace`) so taps still
landed, which kept the console usable at the default zoom and hid how far the drawing had drifted.

**Fix.** The HUD renders through its own camera fixed at 1x. `createUiCamera()` adds it after the
world and HUD exist; `applyCameraLayers()` splits the display list so the imagery cameras ignore
every HUD object and the HUD camera ignores every world object; `raiseUiCamera()` keeps it last in
the camera list when split view adds a camera of its own. HUD coordinates are screen coordinates
again, so `toHudSpace` is gone and the tap guard reads the pointer directly.

### 2. Split view showed the two passes out of alignment

**Severity: high — it affects the puzzle.** The compare camera shares the main camera's `scrollX`
and `scrollY`, but the two had different viewport widths and zoom is applied around each camera's
own centre. The panes were therefore offset by `360 * (1 - zoom)` pixels: 90px apart at the default
zoom, more as the analyst zoomed, and only ever aligned at exactly 1x. CHANGE asks the analyst to
compare two frames object by object, so a silent horizontal offset between them is a fairness bug.

**Fix.** Split view gives the main camera the same half-width viewport as the compare camera, so
equal scroll and zoom produce identical panes. Measured by cross-correlating the two halves of a
screenshot: the best-matching shift was 156 device pixels away from the divider before the fix and
is exactly 0 after it, at the default zoom, after panning and after zooming.

### 3. Activating a menu button with Enter threw

**Severity: high.** `createFocusGroup` cleared focus on scene `shutdown`, which repaints every
button and notifies the scene through `onFocus`. Enter starts the next scene, so that repaint ran
against text objects Phaser had already destroyed:
`TypeError: Cannot read properties of null (reading 'drawImage')`. Keyboard users hit it on every
menu activation.

**Fix.** Shutdown only detaches the input listeners. An explicit `destroy()` still clears focus for
callers that use it while the scene is alive.

### 4. Zooming out exposed black gutters beside the imagery

The configured minimum zoom (0.45) let a wide window zoom out past the edge of a 2400x1800
photograph, leaving empty black bands to the right and below it. `minZoomForViewport()` raises the
floor so the imagery always covers the viewport, and `onResize` re-applies it when a window grows.
It never restricts a window the map already covers, so phones and short landscape windows are
unaffected.

### 5. Panels were stretched to the window instead of sized to their content

The briefing dossier, the debrief and the settings panel all had heights derived from the viewport.
On a 1440x900 desktop the tasking order drew a 730px sheet around 250px of text, with the
RESTRICTED stamp stranded at the bottom. All three now measure their content and sit centred in the
space above the controls. The briefing measures the *finished* order rather than the characters the
typewriter has printed so far.

### 6. Stacked controls collided on phone portrait

ACQUIRE IMAGERY sat directly on RETURN, and RETURN overlapped the terminal chrome caption along the
bottom edge; the debrief had the same layout. Both scenes now reserve a taller control band and
separate the two rows.

### 7. Every load logged a 404

No icon was declared, so the browser requested `/favicon.ico` and logged a console error on every
load. `index.html` now carries an inline SVG reticle icon; no request, no file.

### 8. Split-view HUD readouts floated mid-strip

Once the HUD was anchored (defect 1), the timer and the RESET VIEW / PAUSE pair still sat at the
half-width point they used when the whole console was scaled, leaving the right half of the strip
empty. They moved to the right edge of the strip.

## Verified, no change needed

| Area | Result |
| --- | --- |
| Main menu at 1440x900, 1280x620, 390x844, 844x390 | No overflow, clipping or overlap; `scrollWidth == clientWidth` at every size |
| Button variants, hover, focus, press, touch | Focus ring visible on Tab; touch-only run completes menu → briefing → recon with no hover |
| Settings and How To Play | Open in-scene, Escape closes, settings persist across reload |
| LOCATE | Pan, zoom, arm, mark, cancel, confirm, false ID, timeout, completion (score 1840 = 1000 + 340 + 500) |
| COUNT | Region dimming and brackets, steppers, digits, Backspace, arrows, submit, persistent rejected state |
| CHANGE | Pass switching, split view, synchronised cameras, marking, cancel, responsive pane labels |
| RANDOM | 120 seeded missions reproduce byte-identically; 60 seeds give 60 distinct missions; 400 random and 450 per-mode missions all pass `validateGeneratedMission` with zero fallbacks |
| Graphics | Sprites sharp at 2x and 3x DPR, no missing textures, terrain reads varied, no target highlighting |
| Accessibility | ~44px minimum touch target via hit padding, `prefers-reduced-motion` respected, safe-area insets applied to `#app` |
| Feedback | All 19 cue counts exactly as designed, no duplicates, SFX/haptics/volume settings honoured, no errors without `AudioContext` or `navigator.vibrate` |
| Stale state | Rapid panel, scene and control churn leaves no stuck state, stacked tween or orphaned timer, and logs no errors |

## Known limitations

- The recon workspace has no Tab focus ring. It is driven by pointer, touch and its own shortcuts
  (Escape, A/B/S in CHANGE, arrows/digits/Enter/Backspace in COUNT), which is what the field guide
  documents. Adding a focus ring there is a feature, not a fix, so it was left for a later phase.
- In split view the bottom rail spans the left pane only, so the lower edge of pass A is covered
  while the same band of pass B is visible. Both passes pan and zoom together, so the analyst can
  always bring that band into view; changing it is a layout redesign rather than a defect fix.

## How it was verified

Chromium via Playwright at four viewports, with page errors and console errors failing the run.
Beyond screenshots, three checks measure rather than look:

- **Pane alignment** — a PNG decoder plus a horizontal cross-correlation of the two split panes.
- **Generator** — the mission generator bundled for Node and run over 970 missions for
  reproducibility, variety and validation.
- **Feedback** — an instrumented `AudioContext` counting every oscillator and buffer-source start
  per interaction, compared against the Phase 13F cue table.
