# Phase 15H — Haptics plus

Richer tactile feedback on the devices that can produce it, a strength preference, and nothing at all
on the devices that cannot.

## The architecture stays

`src/audio/feedback.js` still maps a named event to a cue on two channels — a synthesised voice and a
haptic pattern — and a caller still asks for `feedback('cancel')` rather than describing either. What
changed is inside the haptic channel.

## The vocabulary

Milliseconds at STANDARD. A single number is one pulse; an array is read by the Vibration API as
vibrate / pause / vibrate.

| Event | Pattern | | Event | Pattern |
| --- | --- | --- | --- | --- |
| hover | — | | relay | 12 |
| focus | — | | tickUp / tickDown | 8 |
| press | 10 | | submit | 16 |
| card | 12 | | hold | 12 |
| toggle | 10 | | resume | 12 |
| arm | 14 | | acquire | [12, 18, 14] |
| select | 16 | | countdown | 8 |
| cancel | 10 | | complete | [18, 26, 32] |
| confirm | [16, 20, 26] | | fail | [30, 38, 30] |
| error | [24, 30, 24] | | | |

Incidental acknowledgements are one short pulse; only an outcome — a call confirmed or refused, an
acquisition, a debrief — earns a pattern.

## What never fires

`hover` and `focus` have no haptic at all, so sweeping a pointer across the console or walking it with
Tab is silent on that channel. Nothing fires while panning, zooming, holding a control or simply
looking at imagery, and that is structural rather than a rule someone has to remember: `ReconScene`,
which owns pan, pinch, wheel and the pointer handlers, calls `feedback()` from nowhere. Every cue
lives in `EnhancedReconScene`, on discrete actions only. The test suite asserts both.

The one repeating cue is `countdown`, at 8ms once a second over the last ten seconds, which the brief
asks for and the existing 400ms repeat guard keeps to one pulse per second.

## Strength

`hapticsLevel` is stored as `off | light | standard | strong`, and the settings row cycles them:

```
HAPTICS // STANDARD
```

The Vibration API offers duration and nothing else — no amplitude — so the levels scale how long each
pulse runs (LIGHT 0.6x, STANDARD 1x, STRONG 1.45x, capped at 60ms) rather than pretending to control
how hard the motor is driven.

Within a pattern **only the pulses scale; the pauses keep their length**, so LIGHT and STRONG are the
same rhythm at a different weight rather than two different rhythms. `error` is `[14, 30, 14]` at
LIGHT and `[35, 30, 35]` at STRONG — the same shape, felt differently.

Cycling the row fires one `select` pulse 90ms later, at the new level. The button's own press cue runs
before the handler does, so it would always demonstrate the *previous* strength; this second pulse is
the one that answers the question the analyst is actually asking.

## Migration

`hapticsEnabled` was a boolean. A device that stored `true` reads back as STANDARD and one that stored
`false` reads back as OFF, so nobody's setting is silently turned back on. `hapticsEnabled` survives as
a **derived** field — `hapticsLevel !== 'off'` — so everything that only needs to know whether haptics
are on at all keeps working unchanged.

A stored level that is present decides on its own; only its absence falls through to the legacy
boolean. The first version consulted the derived flag as a fallback, which let a corrupt level quietly
inherit whatever the last state happened to be instead of resetting to the default. The test suite
caught that.

## Unsupported devices

`navigator.vibrate` is feature-detected once, and there is no user-agent string anywhere in the
codebase. A browser without the API has no haptic channel: every call is a silent no-op, never an
error and never a substitute effect. The settings row says so rather than offering a control that
could not do anything:

```
HAPTICS // UNAVAILABLE
```

and is disabled, so the keyboard walk skips it too.

## Not stacking

Two guards, at different scales:

- The existing **per-event repeat guard** (45ms, 400ms for `countdown`) means a double tap, a held
  key or two call sites racing can never fire the same cue twice.
- A new **outcome guard**: `navigator.vibrate` replaces whatever is playing, so a press arriving
  mid-debrief would cut the pattern short. An incidental single pulse is dropped while an outcome
  pattern is still running; another pattern is allowed to take over.

## Validation and tests

The release validator checks the vocabulary itself: `hover` and `focus` carry no pulse, every haptic
event is a voiced event, OFF silences everything, pulses grow monotonically from LIGHT to STRONG, no
pulse exceeds the cap, and every pattern keeps its rhythm across levels.

`haptics-test.mjs` (36 checks) adds a recording vibration motor and drives the real module: the table
matches the brief exactly, the levels scale as specified, migration works from a freshly loaded
module with legacy storage, sound and haptics stay independently configurable, a burst of one event
collapses to a single call, an incidental pulse cannot cut an outcome pattern short, and a browser
with the API removed no-ops without throwing.

In the browser, a spy on `Navigator.prototype.vibrate` records every call through real gameplay:
pointer sweeps, Tab walks, panning, zooming, holding and plain viewing produce none; a toggle produces
one pulse that changes length with the level; arming, marking and confirming produce the specified
pulses and pattern.

`npm run validate`: 2779 checks, 0 warnings. `npm run build`: clean.

## Not done

- No amplitude control, no timed re-triggering to simulate it, and no iOS workaround. Safari has no
  Vibration API; the honest behaviour there is nothing at all.
- No haptics on hover, focus, pan, zoom or idle viewing, by design.
- No gameplay, scoring or generator changes. The 303-mission seeded fingerprint is unchanged.
