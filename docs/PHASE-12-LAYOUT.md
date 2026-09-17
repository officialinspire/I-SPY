# Phase 12C — Layout and presentation polish

Phase 12C refines composition, spacing, responsive behavior, and information hierarchy without changing mission rules, scoring, map data, target validation, or generated-mission logic.

## Design goals

- Keep reconnaissance imagery as the visual priority.
- Use consistent safe margins and framed intelligence-console surfaces.
- Separate primary mission actions from secondary utility actions.
- Improve typography hierarchy without abandoning the monochrome terminal aesthetic.
- Keep touch controls grouped and predictable on compact screens.
- Make short landscape screens usable without excessive vertical stacking.
- Preserve reduced-motion behavior and all existing input methods.

## Screen changes

### Acquisition / Boot

- Responsive reticle frame and safer vertical spacing.
- Smaller title/telemetry treatment on compact and short displays.
- Acquisition status remains centered and readable without crowding terminal chrome.

### Main Menu

- Wide screens use a two-column mission console instead of a tall six-button stack.
- Mission actions and secondary HOW TO PLAY / SETTINGS actions have clearer hierarchy.
- Compact screens retain a single-column layout with tighter safe spacing.
- Short landscape displays use reduced title spacing and compressed button rows.

### Settings

- Wider framed configuration panel with a dedicated header divider.
- Dynamic vertical spacing keeps all six controls within the available panel height.
- Status/console elements hide when they would compete with configuration controls.

### Mission Briefing

- Briefing content is now left-aligned inside a document grid rather than centered as one large block.
- File metadata sits in the document header.
- The RESTRICTED stamp is kept out of the primary reading column.
- Desktop controls share one bottom action row; compact layouts stack the actions.
- Font size and line spacing compress on short screens.

### Recon workspace

`EnhancedReconScene` adds presentation framing around the stable `ReconScene` mechanics:

- COUNT and CHANGE controls sit on a dark control rail.
- Compact LOCATE receives the same bottom control-deck treatment.
- CHANGE split view receives a strong center divider.
- PASS A and PASS B receive explicit top labels in split comparison.
- Existing cameras, hit testing, scoring, mission timers, map transforms, and selection logic are untouched.

### Results / Debrief

- Debrief content uses a left-aligned report grid.
- Mission result and total score share a clear summary row.
- Scoring ledger is separated from the top summary with document rules.
- Desktop actions sit side by side; compact screens stack them.

## Responsive breakpoints

The scenes use content-driven breakpoints rather than device-specific assumptions:

- approximately 560–600 px for compact document/menu layouts
- 680 px for compact Recon controls
- 760 px for the wide two-column mission menu
- 980 px remains the existing CHANGE split-view minimum
- height checks compress typography and spacing on short landscape displays

## Gameplay safety

Phase 12C intentionally leaves the following unchanged:

- authored map data
- entity coordinates and selection bounds
- mission generator
- LOCATE / COUNT / CHANGE validation
- scoring formulas
- timer behavior
- camera pan/zoom mechanics
- keyboard controls

The Recon presentation additions live in `EnhancedReconScene`, continuing the non-invasive wrapper pattern introduced in Phase 10.
