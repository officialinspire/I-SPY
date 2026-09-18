# Phase 13E — Mode-specific gameplay UX

Phase 13E makes LOCATE, COUNT and CHANGE feel like three analysis tools sharing one workspace,
rather than one workspace with three button sets. No scoring, validation, mission generation or
puzzle solution changed: `validateIdentification`, `validateChangeIdentification`,
`validateCountAnswer` and every score function are called exactly as before.

## HUD hierarchy

The workspace HUD now ranks information the same way in every mode:

| Rank | What | Where |
| --- | --- | --- |
| 1 | Objective | Top left, 15px, no `OBJECTIVE:` prefix |
| 2 | Timer | Top right, 19px, amber at 20s and rust at 10s |
| 3 | Mode state | Chip under the objective: `LOCATE · MARKING` |
| 4 | Primary action | The mode's own rail |
| 5 | Secondary utilities | RESET VIEW and PAUSE, smallest, furthest from the imagery |

Text fatigue went down rather than up. The operation name, the map id, the `OBJECTIVE:` and `MAP:`
prefixes and the 13D marking banner are gone — the chip carries state now, tinted amber while
marking, phosphor while a mark is pending, rust while held. Each mode shows exactly one counter
(`FALSE ID 0`, `PASS A`, `REJECTED 1`), and the grid readout tails that same line instead of
occupying a row of its own.

The chip row follows the objective block, so an objective that wraps to three lines on a phone can
never sit underneath it, and the objective wraps clear of the timer in every layout including split
view.

## LOCATE

- The objective is the first thing in the HUD and stays there — the concise reminder.
- MARK's armed state is unmistakable: amber chip, amber HUD rule, crosshair cursor, tracking
  reticle, and the button itself in its selected state reading `SELECT OBJECT`.
- False identifications are counted in the mode strip, in rust once above zero.
- Everything that used to compete with the imagery — operation name, map id, prefixes — is gone.

## COUNT

- **The count area is defined by dimming everything outside it**, with phosphor corner brackets and
  a label pill at its top-left. Nothing inside the area is touched, so the region is obvious while
  no individual object is hinted at.
- The tally module is a captioned group: `ADJUST` over `− [ 00 ] +`, with larger 54px steppers and
  a bordered 30px readout, set apart from a captioned `SUBMIT` action in amber. Adjusting and
  submitting no longer look like the same kind of control.
- A rejected total is acknowledged on the readout itself: the tally block turns muted red with the
  number in off-white, and stays that way until the analyst changes the number. No dialog, no
  camera move, nothing that interrupts inspection — and it says exactly which total was refused.
- Keyboard input is unchanged (arrows, digits, backspace, Enter), and every route to a new total
  clears the rejected state because they all funnel through `setAnswer`.

## CHANGE

- `VIEW PASS B` became a **segmented control**: `PASS A | PASS B`, captioned `COMPARE`. The live
  pass is a lit phosphor segment and the other is plain steel, so the active pass is never
  something the analyst has to read and invert.
- Switching passes plays a 170ms opaque wipe. The outgoing pass is already hidden when the wipe
  starts, so the two passes are never on screen together and the transition cannot make the
  difference easier to spot. Reduced motion swaps instantly.
- Split view labels each pane with its own pass and time, phosphor for A and amber for B, and the
  divider carries instrument ticks and centre arrows.
- **Split view bug fixed:** the compare camera redraws screen-space objects inside its own viewport,
  so both panes were labelled `PASS A`. Phase 13E gave the right-hand label to the compare camera in
  its local space and moved the timer and grid readout into the left pane.
- Camera synchronisation is untouched: `syncChangeCameras` still drives both cameras from one
  source, verified by dragging in the left pane and confirming both panes stay framed identically.

> **Revised by the Phase 13 release-candidate audit.** Both pane labels are now drawn by the HUD
> camera, which spans the viewport, and the readout returned to the right edge of the single HUD
> strip. The audit also found that equal scroll values did *not* frame the panes identically at any
> zoom other than 1x, and fixed it. See `docs/PHASE-13-RELEASE-AUDIT.md`.

## Rails

`railHeight()` is now a single source of truth: the enhanced scene draws the rail at that height and
`isHudPoint()` guards taps by it, so the drawn band and the guarded band cannot drift apart. Rails
are sized per mode and per breakpoint, and the phone layouts were rebuilt — LOCATE's rail had
MARK TARGET overlapping RESET VIEW, and COUNT's had the `+` stepper underneath SUBMIT COUNT. On
desktop the controls stay at the edges and nothing new covers the imagery.

## Verification

- `npm run validate` — 273 checks, 0 warnings. `npm run build` — clean.
- Chromium against the production build: all three modes at 1280x800 and 390x780, the armed marking
  state, a count adjustment and rejection with its acknowledgement and clearing, a pass switch, and
  split view including a synchronised pan. Phase 13D's interaction regression (tap versus drag,
  single-shot confirm, pause state) re-run and still passing. No console or page errors.
