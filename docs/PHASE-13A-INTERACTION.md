# Phase 13A — Interaction design system and shared button overhaul

Phase 13A makes the console feel tactile and readable without touching mission rules, scoring,
seeded mission generation, authored map data, or Recon camera mechanics.

## Audit summary (pre-13A)

| Area | Finding |
| --- | --- |
| `src/ui/createButton.js` | One hard-coded look for every button: near-black fill, off-white 2px border, invert-on-hover. No variants, no focus treatment, no selected or disabled state, no keyboard path. |
| `src/runtime-config.js` | Palette held seven greyscale values only, so no semantic color existed to spend. |
| `src/ui/presentation.js` | Owned `prefersReducedMotion()` and terminal chrome, but panel colors were hand-written hex literals in each scene. |
| `src/audio/feedback.js` | Had a press tick (`button`) but nothing for hover or keyboard focus. |
| `MainMenuScene` | Six identical buttons: RANDOM MISSION read no differently from SETTINGS. Settings toggles showed ON/OFF as text only. |
| `MissionBriefingScene` | ACQUIRE IMAGERY and RETURN were visually interchangeable. |
| `ResultsScene` | Success and failure debriefs were typographically identical. |
| `EnhancedReconScene` | Console rails and split divider drawn from literal greys. |
| `src/styles.css` | `filter: saturate(0)` on the canvas, which would have discarded any color the UI introduced. |

## Design tokens

`src/ui/designTokens.js` is the single source for interactive styling. It composes the palette from
`GAME_CONFIG.palette` and exports:

- `UI_TOKENS.color` — the full palette, including the new equipment colors.
- `UI_TOKENS.surface` — panel fill/border/divider/accent values used by every framed surface.
- `UI_TOKENS.text` — semantic text roles (`body`, `muted`, `positive`, `attention`, `negative`).
- `UI_TOKENS.motion` — durations, easing, hover scale, press scale.
- `UI_TOKENS.metrics` — 44px minimum touch target, border/focus-ring/accent geometry.
- `BUTTON_VARIANTS` — the semantic variants and their per-state tokens.
- `hexToNumber()` / `touchPadding()` — helpers so scenes never hand-mix values.

### Palette additions

The base stays terminal black and charcoal. Added to `GAME_CONFIG.palette`:

- **Phosphor green** (`phosphorDeep`/`phosphorDim`/`phosphor`/`phosphorBright`) — positive and active state.
- **Desaturated amber** (`amberDeep`/`amberDim`/`amber`/`amberBright`) — the action to take next.
- **Muted rust red** (`rustDeep`/`rustDim`/`rust`/`rustBright`) — discard, abort, failure.
- **Steel** (`steelDeep`/`steelDim`/`steel`/`steelBright`) — tactical equipment housings.

Every hue is desaturated equipment paint, not neon. Reconnaissance imagery itself remains monochrome:
the sprite library is still authored from the four-tone greyscale palette.

The canvas filter moved from `saturate(0)` to `saturate(0.92)` so that restrained color survives to the
screen; greyscale artwork is unaffected by the change.

## Semantic variants

| Variant | Meaning | Where |
| --- | --- | --- |
| `primary` | The one action the analyst is expected to take. Amber fill, bold label. | RANDOM MISSION, ACQUIRE IMAGERY, SUBMIT COUNT, RESTART MISSION, RETURN TO CONSOLE (settings) |
| `secondary` | Navigation and utility. Neutral charcoal, quiet border. | HOW TO PLAY, SETTINGS, RETURN, PAUSE, RESET VIEW, settings toggles |
| `tactical` | Mission equipment controls. Steel housing, phosphor accent. | LOCATE/COUNT/CHANGE MISSION, MARK TARGET, +/−, VIEW PASS B, SPLIT VIEW |
| `warning` | Reversible but attention-worthy. | RESUME (while the feed is held) |
| `danger` | Discards work or aborts an action. Muted rust. | CANCEL |
| `success` | Commits an identification. Phosphor. | CONFIRM |
| `disabled` | Present but not actionable. | Any button via `setEnabled(false)` |

Hierarchy is carried by fill weight as well as hue, so primary still reads first on a desaturated or
low-color display.

## Interaction states

`createButton()` drives one state machine from pointer, keyboard and touch input:

- **idle** — variant fill, dim accent bar.
- **hover** — brighter border, lighter fill, white label, accent bar at full strength, 1px label lift and 1.012 scale.
- **focus** — a phosphor/amber focus ring drawn outside the button, shown only for keyboard navigation.
- **pressed** — 0.975 scale, darker fill, strongest border.
- **selected/active** — persistent lit treatment (`MARK PENDING`, `EXIT SPLIT`, settings toggles that are ON).
- **disabled** — flat charcoal, grey label, input disabled and hand cursor removed.

### No stuck pressed states

Press is released on `pointerup`, `pointerout`, `pointerupoutside`, `pointercancel`, the scene-level
`pointerup`/`pointerupoutside`, and `gameout` (pointer leaves the canvas). Activation is gated on the
pointer that armed the button (`armedPointerId`), kept separate from the visual press state, so a
scene that re-shows or re-styles a button between press and release cannot swallow the click, and a
drag that began on the map cannot trigger a button it happens to be released over.

### Keyboard

`src/ui/focusGroup.js` gives Main Menu, Mission Briefing and Results a focus ring: Tab / Shift+Tab and
the arrow keys walk the visible, enabled buttons; Enter or Space activates; Escape drops focus; any
pointer input clears it so the ring is only ever shown to keyboard users. Recon keeps its existing
mission hotkeys (ESC, A/B/S, digits, Enter) untouched — no focus group is installed there.

### Touch

Hover is ignored for touch pointers, so a tap leaves no hover residue, and taps never depend on hover
state. Buttons narrower or shorter than 44px get an expanded rectangular hit area (capped at 12px per
side) so every control meets the ~44 CSS px minimum touch target.

### Motion

Hover, press and release tween over 70–110ms with `Sine.easeOut`. `prefersReducedMotion()` is checked
at interaction time: reduced-motion users get the same color and border state changes applied
instantly, with no scale, lift or tween.

### Audio

Hover plays a very quiet new `hover` tick (throttled to one per 90ms); keyboard focus plays a `focus`
tick; press keeps the existing `button` tick and haptic pulse. All of it still respects the master
volume and SFX settings.

## Screen-level changes

- **Main Menu** — RANDOM MISSION is amber primary; the three authored modes are tactical; HOW TO PLAY and SETTINGS are secondary. Settings toggles now show their ON state as a lit phosphor selection rather than text alone. Panel accents use amber; the link indicator and status line use phosphor.
- **Mission Briefing** — ACQUIRE IMAGERY primary, RETURN secondary, rust RESTRICTED stamp, amber document rule, amber acquisition readout.
- **Results** — success/failure now read at a glance: phosphor or rust title, disposition and panel rule; the total score is amber.
- **Recon** — MARK shows a selected state while marking is armed; CONFIRM is success, CANCEL is danger; SUBMIT COUNT is primary; SPLIT VIEW stays lit while active; PAUSE becomes an amber RESUME and mission-action buttons visibly disable while the feed is held. The mission timer shifts to amber at 20s and rust at 10s. HUD/rail chrome draws from the tokens.

## Out of scope / unchanged

- Mission rules, validation, scoring, seeded generation, authored map data, camera and marking mechanics.
- Recon's existing scene-level pointer handling: clicking a bottom-rail control while marking is armed still places a mark first, exactly as before Phase 13A.
- Sprite art and the monochrome reconnaissance imagery pipeline.

## Verification

- `npm run validate` — 207 checks, 0 warnings.
- `npm run build` — clean.
- Chromium (headless, production build) walk-through of Boot → Main Menu → Settings → Briefing → Recon (LOCATE, COUNT, CHANGE) with no page errors: hover/press/release-outside, keyboard Tab + Space activation, touch tap with no hover residue, pause disable/enable, mark → confirm/cancel, and a reduced-motion pass.
