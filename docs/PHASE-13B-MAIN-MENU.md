# Phase 13B — Main Menu UX/UI redesign

Phase 13B rebuilds the Main Menu on the Phase 13A interaction system so it reads as a
reconnaissance operations console rather than a stack of identical buttons. Mission launch
behavior, mission rules, scoring, seeded generation, authored map data and Recon camera
mechanics are unchanged; every action the old menu offered is still here.

## Composition

```
                       I SPY
          SATELLITE RECONNAISSANCE DIVISION

  ┌───────────────────────────────────────────────────┐
  │ ▪ SATELLITE LINK: AVAILABLE   IMAGE CHANNEL: READY   ANALYST STATION: 04
  ├───────────────────────────────────────────────────┤
  │ PRIMARY TASKING ─────────────────────────────────
  │ ▐ (⊙) RANDOM MISSION                         ──┤
  │       GENERATE A SEEDED INTELLIGENCE TASK.
  │ MISSION ARCHIVE // TRAINING MODES ───────────────
  │ [ LOCATE ]        [ COUNT ]        [ CHANGE ]
  │ SYSTEM ──────────────────────────────────────────
  │ [ HOW TO PLAY ]   [ SETTINGS ]
  └───────────────────────────────────────────────────┘
                SELECT A TASKING TO BEGIN
```

- The title block sits outside the console frame; everything actionable sits inside it.
- A status bar runs along the top of the frame, divided from the tasking sections below.
- Each section carries a small label with a hairline rule trailing to the frame edge.
- The console frame is drawn with corner ticks rather than a plain box.
- The whole composition is measured and centred in the viewport rather than hung off the top.

## Hierarchy

| Level | Treatment |
| --- | --- |
| Primary tasking | `primary` (amber) card, bold 21px label, on an amber priority band with a trace running out to the frame edge. Emphasised by fill weight and band, not by being outsized — it is ~62% of the console width on desktop and the same height class as the archive cards. |
| Mission archive | Three `tactical` cards, equal weight, each with its own accent identity. |
| System | Two `secondary` buttons, smaller, plain centred labels, no icons. |

## Mode identity

Each mode keeps a restrained accent, applied to its accent bar and its icon tint only — the
label and fill stay neutral, so nothing reads as an arcade button.

| Mode | Accent | Icon (existing UI sprite) | Description |
| --- | --- | --- | --- |
| RANDOM | amber (priority) | `reticle_lock` | GENERATE A SEEDED INTELLIGENCE TASK. |
| LOCATE | muted phosphor green | `reticle` | IDENTIFY A REQUESTED OBJECT. |
| COUNT | cool steel gray | `grid_dot` | COUNT A REQUESTED CATEGORY INSIDE A GRID. |
| CHANGE | muted amber | `scanline_v` | COMPARE TWO RECONNAISSANCE PASSES. |

Icons come from `assets/sprites/i-spy-ui-sheet.svg` via the existing sprite manifest; no new art
and no emoji. When the sheet is unavailable the cards fall back to text-only layout.

## Status activity

The status bar reads `SATELLITE LINK: AVAILABLE`, `IMAGE CHANNEL: READY`, `ANALYST STATION: 04`,
shortened to `LINK: / CHANNEL: / STATION:` on narrow consoles, with the channel readout dropping
out first when there is not enough width. A small phosphor indicator beside the link readout
pulses, and holds steady under `prefers-reduced-motion`.

A single readout line under the console echoes the hovered or keyboard-focused control
(`LOCATE // IDENTIFY A REQUESTED OBJECT.`) and returns to `SELECT A TASKING TO BEGIN`. That is the
menu's transition feedback; launching still starts the briefing immediately, with no added delay.

## Responsive behavior

Layout picks the richest of four density tiers whose measured composition fits the viewport, so
short screens degrade by dropping ornament instead of overlapping:

| Tier | Drops |
| --- | --- |
| `full` | — |
| `mid` | smaller type and cards |
| `tight` | readout line |
| `minimal` | subtitle, mode descriptions, mode icons |

Cards stack into a single column when the console is narrower than 660px, and also on tall
portrait screens where a three-up row would be cramped. Verified with no overlap at 1440x900,
1280x800, 1024x700, 820x1180, 800x420, 1024x380, 390x780 and 360x640.

## Shared button additions

`createButton()` grew what the cards needed, and the additions are available to every scene:

- `icon` (`{ texture, frame }`) and `description` compose a card layout: icon left, left-aligned
  title, description beneath. Descriptions wrap inside the card automatically and the title +
  description block is centred on its measured height, so a two-line description still sits right.
- `accentColor` overrides the variant accent for per-item identity.
- `resize({ width, height, fontSize, descriptionFontSize, iconSize, padding, showDescription, showIcon })`
  re-tiers a button in place, which is what lets one set of buttons serve every breakpoint.
- `onHover(hovered)` reports hover for console readouts.
- Icon scale is derived from the 2x sprite sheet frame, so the hover/press scale multiplies it
  rather than replacing it.

`createFocusGroup()` takes an `onFocus(button)` callback so keyboard focus drives the readout the
same way hover does.

## Preserved

- RANDOM MISSION, LOCATE, COUNT, CHANGE, HOW TO PLAY, SETTINGS — all present, all launching
  exactly what they launched before.
- Settings still opens inside the Main Menu scene. It now sits below the header when it fits, and
  centres with the header stood down when it does not, so nothing is clipped behind the panel.
- HOW TO PLAY became a framed field-guide overlay with a dimmed backdrop, dismissable by tap,
  click or ESC, and still auto-closes.

## Verification

- `npm run validate` — 207 checks, 0 warnings.
- `npm run build` — clean.
- Headless Chromium against the production build: eight viewport sizes with no page errors;
  hover, keyboard Tab/Enter focus walking with readout updates, field guide open/dismiss,
  settings open/close, touch taps on a phone viewport, and all four mission launches confirmed to
  reach the expected briefing (`MODE: LOCATE/COUNT/CHANGE`, and a generated
  `SOURCE: PROCEDURAL RECON TASKING` for RANDOM). Phase 13A recon button states re-checked after
  the shared-button refactor.
