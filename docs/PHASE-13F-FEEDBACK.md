# Phase 13F — Microinteraction and feedback polish

Phase 13F makes the game feel responsive without making it louder. Every cue is still synthesised
at runtime by the existing Web Audio engine — no audio files, no new dependencies — but the engine
now speaks in **named events** instead of raw waveforms, each event is voiced exactly once, and
every channel (sound, haptics, motion) can be switched off independently without leaving a dead
interaction behind.

## The cue vocabulary

`src/audio/feedback.js` was rewritten around two primitives and a fixed set of named voices:

- `tone(frequency, durationMs, gain, offset, type, slideTo)` — one short oscillator with an
  envelope, optionally bending pitch across the note.
- `click(durationMs, gain, offset, centre)` — a band-limited noise burst through a bandpass
  filter: the contact click inside a relay or a switch.

Nothing sweeps, nothing rings out, nothing lasts past ~220 ms. The reference is a military terminal
or an imaging workstation — relay clicks, dry square blips, filtered noise — not an arcade cabinet.

| Event | Cue | Sound |
| --- | --- | --- |
| Button hover | `hover` | 14 ms blip at 880 Hz, near the noise floor |
| Keyboard focus | `focus` | 22 ms blip at 520 Hz |
| Button press | `press` | 620 Hz blip + 2.6 kHz contact click |
| Mission card selection | `card` | Two-step 430 → 645 Hz acknowledgement |
| Settings row toggle | `toggle` | Switch click then a 520 Hz confirmation |
| Imagery acquisition | `acquire` | Three rising 330/495/660 Hz steps, ~200 ms total |
| Entering marking mode | `arm` | 300 → 520 Hz rising slide: equipment coming live |
| Candidate selection | `select` | 1.5 kHz click then a 520 Hz blip |
| Cancel | `cancel` | Falling 430 → 300 Hz pair |
| Confirmation | `confirm` | Rising 520 → 780 Hz pair |
| False identification | `error` | Two low sawtooth notes, 180 → 146 Hz |
| PASS A/B switch | `relay` | 1.2 kHz relay click + 240 Hz thunk |
| COUNT adjustment | `tickUp` / `tickDown` | 14 ms tick, 700 Hz up and 560 Hz down |
| COUNT submission | `submit` | Low 900 Hz click + 300 Hz note |
| Pause / resume | `hold` / `resume` | Mirror-image 420 → 300 and 300 → 430 slides |
| Final ten seconds | `countdown` | 48 ms 360 Hz tick, once per second |
| Mission complete | `complete` | Three rising notes, 440 / 660 / 880 Hz |
| Mission failure | `fail` | Two falling sawtooth notes, 260 → 195 Hz |

Adjusting a count up and down now sound different from each other, pause and resume are mirror
images, and cancel falls where confirm rises — the direction of a cue matches the direction of the
action.

## One event, one sound

The previous system routed audio by sniffing the text of HUD status banners, which meant a cue
could fire twice (once from the caller, once from the banner) or not at all when wording changed.
That router is gone. Now:

- Shared buttons voice their own press through `createButton`, and any control whose handler voices
  a more specific cue passes `pressSound: false` (ten recon controls) or names its cue
  (`pressSound: 'card'`, `'toggle'`, `'acquire'`).
- Scene handlers voice state changes, not buttons: `armMarking` voices `arm` only when marking was
  not already armed, `cancelCandidate` only when there was something to cancel, `setActivePass`
  voices `relay` on an actual pass change and a plain `press` when the live pass is re-pressed.
- A per-event repeat guard (45 ms default, 90 ms for hover, 400 ms for the countdown tick) makes it
  impossible for rapid navigation, a held key or two call sites racing to stack one cue on itself.

## Haptics

Haptics stay sparing and follow the same events: a small pulse for selection-class actions
(6–12 ms) and a pattern only for outcomes — confirmation `[12, 18, 20]`, error `[18, 26, 18]`,
completion `[12, 20, 24]`, failure `[24, 35, 24]`. `navigator.vibrate` is feature-checked and
wrapped, so a browser without it is silent rather than broken.

## Microanimations

| Interaction | Motion |
| --- | --- |
| Button press / release | 0.975 scale over 90 ms, recovering over 120 ms |
| Button hover | 110 ms lift, pointer only — touch never depends on it |
| Selected control | Accent bar breathes to 0.62 alpha over 1150 ms and back |
| Panel appearance | 140 ms alpha fade (`fadeIn`), alpha only — never position |
| Candidate marker | Reticle settles from 1.34× to 1× over 150 ms |
| Pass switch | 170 ms opaque wipe: the two passes are never visible together |

`fadeIn` touches alpha and nothing else, so a transition can never fight the responsive layout, and
it kills any running tween on its targets before starting — re-opening a panel mid-fade replaces the
fade instead of stacking a second one on the same object. The marker settle is drawn at the
analyst's own mark and animates nothing in the reconnaissance imagery, so no motion can hint at
which objects are targets. The pass wipe is opaque and identical in both directions, which is why
it cannot make differences easier to spot than comparing the passes by eye.

Every animation above is skipped under `prefers-reduced-motion`: the button lands at its final
scale, the panel appears already solid, the accent bar holds steady, and the reticle appears at
final size.

## Verification

Cue counts were measured directly rather than by ear. An instrumented `AudioContext` wrapper counted
every `createOscillator` and `createBufferSource` start during a scripted Playwright session, and
each interaction's count was compared against the cue table above:

```
OK menu hover card 1 / menu press card 2 / briefing acquire 3 / recon arm marking 1 /
OK recon place mark 2 / recon cancel 2 / recon pause 1 / recon resume 1 / recon reset view 2 /
OK arm->mark->false id 6 / 6 deliberate presses 12 / count + tick 1 / count - tick 1 /
OK count submit rejected 2 / change pass switch (relay) 2 / change re-press live pass 2 /
OK sfx off: silent press 0 / haptics off: audible, no buzz 2 (haptics=0) / master volume 0: silent 0
persisted settings: {"masterVolume":0,"sfxEnabled":true,...}
NO PAGE ERRORS / ALL CUE COUNTS AS EXPECTED
```

No event produced a duplicate cue. Settings still persist across a reload, SFX off and master
volume 0 produce complete silence while haptics and motion continue to work, and haptics off leaves
the sound untouched.

Two contracts were checked deterministically outside the browser, with fakes:

- **Repeat guard** — first `confirm` plays 2 voices, an immediate repeat plays 0, a repeat after the
  guard window plays 2 again.
- **Fade contract** — `fadeIn` kills before it adds, leaves exactly one live tween after three rapid
  re-opens, lands at final alpha with no tween under reduced motion, and no-ops on an empty target
  list.

Reduced-motion behaviour was confirmed by screenshot: captures of the candidate marker 40 ms apart
are byte-identical, so the settle does not run. Rapid settings open/close/open leaves the panel
fully opaque (max channel difference of 2 against the settled capture), so no fade is left stranded.

`npm run validate` (273 checks, 0 warnings) and `npm run build` both pass.
