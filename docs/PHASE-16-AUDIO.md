# Phase 16 — Startup and audio release audit

Phase 16 adds one user-gated startup route and centralized ownership for music
and sampled mission feedback. No scene creates its own music loop.

## Startup contract

The route is `Boot → StartIntro → MainMenu`. StartIntro accepts pointer or
keyboard activation, unlocks procedural audio, music and cached samples in the
trusted gesture, and only then requests intro playback. End, skip and playback
error all share one idempotent completion method. Scene shutdown removes DOM
listeners, stops the video and releases element references. Music remains in
`SILENT` until MainMenu is created.

## Music contract

The singleton music manager owns one MENU element and one GAMEPLAY element.
MainMenu, MissionBriefing and IdentificationGuide request MENU; Recon and its
Training subclass request GAMEPLAY; Results retains the previous state until a
button chooses the next route. State changes crossfade over 850 ms. Repeated
requests are no-ops, and a generation guard cancels stale animation frames.

Master volume scales both music and effects. `musicEnabled` affects music only;
`sfxEnabled` affects procedural and sampled effects only. Both settings persist
in the existing local settings record. Haptics remain independent.

When the document is hidden, music fades are cancelled and both elements are
paused at zero volume. Visibility restoration fades the requested state back
in; if the browser requires a fresh gesture, the manager retries once on the
next pointer or keyboard action. Playback rejections are always contained.

## Mission SFX contract

TARGET ACQUIRED is emitted only when a placed candidate resolves to a markable
entity. TARGET SECURED is emitted only after a correct LOCATE or CHANGE
confirmation. Empty ground, navigation, COUNT controls, cancellation and false
identifications never use these samples. False identification retains the
procedural error voice.

Each sample has one cached media element and a cooldown. A playing sample is
never layered with another copy, and TARGET SECURED stops TARGET ACQUIRED before
it plays. The sampled voice replaces the procedural select/confirm voice while
retaining the existing haptic pattern.

## Automated gate

`npm run validate` includes `scripts/audio-qa.mjs`, which checks the state,
idempotency, stale-fade, lifecycle, settings, sample repeat and startup cleanup
contracts in addition to the existing release and generator suites.
