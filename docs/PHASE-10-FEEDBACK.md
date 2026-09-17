# Phase 10 — Audio, Haptics, and User Feedback

Phase 10 adds restrained terminal-style feedback without introducing external audio assets or additional runtime dependencies.

## Audio architecture

`src/audio/feedback.js` uses the Web Audio API to synthesize short monochrome-console style tones at runtime. Audio is unlocked from a user gesture through shared button interactions so browser autoplay restrictions are respected.

Supported feedback events:

- `button` — short console tap
- `mark` — target/change marking cue
- `confirm` — ascending confirmation pair
- `error` — low descending warning pulse
- `acquire` — three-stage imagery acquisition cue
- `countdown` — final-ten-seconds timing pulse
- `complete` — mission-success cadence
- `fail` — mission-failure cadence

Unsupported Web Audio paths fail silently rather than blocking gameplay.

## Haptics

`navigator.vibrate()` is used only when available and enabled. Unsupported devices or rejected vibration calls are ignored safely.

The feedback system uses short patterns rather than continuous vibration so it remains informational and unobtrusive.

## Persistent settings

`src/settings/userSettings.js` stores device-local preferences under `i-spy-settings-v1`.

Available settings:

- Master level: 100 / 75 / 50 / 25 / 0 percent
- Sound effects: on/off
- Haptics: on/off
- CRT scanlines: on/off
- Recon image grain: on/off

Settings are sanitized when loaded and automatically persisted when changed.

## Presentation integration

- Shared buttons unlock audio and provide a minimal tap cue.
- Mission briefing emits an imagery-acquisition cue.
- `EnhancedReconScene` adds feedback around the stable Phase 8/9 `ReconScene` without rewriting reconnaissance mechanics.
- Final ten seconds receive one pulse per second.
- Confirmation, false identification, and marking status messages map to distinct feedback events.
- Results emit separate completion/failure cadences.
- The scanline preference is applied through the global CSS shell.
- The image-grain preference suppresses generated recon grain while preserving mission geometry and scoring.

## Design constraint

Phase 10 deliberately does not add background music. The sound design is intended to resemble a quiet intelligence terminal/radio console and should never compete with the visual-analysis task.
