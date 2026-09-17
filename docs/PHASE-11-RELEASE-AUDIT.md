# Phase 11 — MVP Release Audit

This audit closes the original Phase 0–11 roadmap for the first I SPY working-demo build.

## Release target

Version: `1.0.0-demo`

The audit is intentionally regression-focused. No new mission types, map formats, or scoring systems are introduced in Phase 11.

## Verified by repository/code review

- Boot → Main Menu → Briefing → Recon → Results scene flow remains wired.
- LOCATE validation/scoring files are unchanged by Phases 10–11.
- COUNT validation/scoring files are unchanged by Phases 10–11.
- CHANGE generation, aligned PASS A/PASS B state, and split-view logic are unchanged by Phases 10–11.
- Seeded mission-generation logic and authored map data are unchanged.
- `EnhancedReconScene` subclasses the stable Recon scene instead of copying/replacing its gameplay implementation.
- The added countdown feedback event is removed during scene cleanup.
- Existing Recon shutdown cleanup still removes timer events, resize listeners, pointer listeners, keyboard listeners, and split-view camera state.
- Audio unlock occurs from user interaction and unsupported Web Audio paths fail silently.
- Unsupported vibration APIs fail silently.
- Local settings are sanitized, persisted, and reapplied on startup.
- Scanlines can be disabled without removing the existing vignette.
- Generated image grain can be disabled without modifying map/entity state.
- Reduced-motion behavior from Phase 9 remains intact.
- Main-menu settings layout was tightened during the audit for short mobile/landscape screens.
- Package/runtime versioning is aligned to `1.0.0-demo`.

## Release-blocker found and fixed

The first Phase 10 settings layout used spacing that could push the lower controls outside a short viewport. Phase 11 replaced that spacing with height-aware compact positioning and hides secondary help text when vertical space is limited.

## Build/runtime test limitation

A full `npm install && npm run build` attempt could not be completed in the assistant execution environment because external DNS resolution for `github.com`/package hosts is unavailable. This is therefore **not recorded as a passing build test**.

Before public deployment, run locally or in CI:

```bash
npm install
npm run build
npm run dev
```

Then smoke-test at minimum:

1. Boot/acquisition sequence and Main Menu.
2. LOCATE success, false ID, timeout, restart, and return to menu.
3. COUNT correct/incorrect submissions and keyboard controls.
4. CHANGE PASS A/B toggle, wide-screen split view, pan/zoom synchronization, correct/incorrect marks, and viewport resize below split threshold.
5. RANDOM MISSION across LOCATE, COUNT, and CHANGE with a fixed `?seed=` replay.
6. Pause/resume timing and repeated mission restarts for stale listeners/timers.
7. Settings persistence after a reload.
8. SFX disabled, master level 0, haptics disabled, scanlines disabled, and image grain disabled.
9. Devices without `navigator.vibrate` and browsers where Web Audio is unavailable/suspended.
10. Mobile portrait, mobile landscape, desktop, and reduced-motion preference.

## Demo status

With the repository-level audit complete and the one verified responsive regression fixed, the codebase is marked `1.0.0-demo`. A successful local/CI production build and browser smoke test remain the final external verification step before publishing the demo.
