# Phase 15I — First-run onboarding

A new analyst should find the tutorial and the manual without being made to use them.

## The panel

On a device's first launch, and only then, the Main Menu opens with a compact `ANALYST ORIENTATION`
panel over the console:

```
ANALYST ORIENTATION
THIS CONSOLE READS SATELLITE IMAGERY. TWO THINGS HELP
BEFORE A FIRST TASKING, AND NEITHER IS REQUIRED.

ANALYST TRAINING WALKS THE CONSOLE, STEP BY STEP.
IDENTIFICATION GUIDE NAMES WHAT IS ON THE GROUND.

[ BEGIN TRAINING ]
[ IDENTIFICATION GUIDE ]
[ SKIP ]

SKIP OR PRESS ESC TO GO STRAIGHT TO THE CONSOLE
```

Three choices, and **none of them starts a mission**. BEGIN TRAINING opens ANALYST TRAINING at step
one, IDENTIFICATION GUIDE opens the manual, SKIP closes the panel and leaves the console live. The
body text is written as flowing sentences rather than hand-broken lines, so a phone wraps it to its
own width instead of inheriting a desktop's line ends.

## Dismissible by every route

A button, `ESC`, or a tap anywhere outside the panel. Whichever route is taken is what records
`orientationSeen`, so the panel is offered exactly once and never stands in a returning analyst's way
again — including the analyst who chose BEGIN TRAINING and came back, since the flag is written before
the scene changes.

While it is open the console behind it is disabled rather than merely covered, so a press cannot fall
through to a control the analyst cannot see. The keyboard walk starts on the panel's own three
buttons; the focus group skips the disabled console automatically.

## ANALYST CERTIFIED

Once ANALYST TRAINING has been completed, the Main Menu carries a small standing at the right-hand end
of the `SYSTEM` rule, beside the control it refers to:

```
SYSTEM ─────────────────────────────── ANALYST CERTIFIED
```

The section rule stops short of it rather than running underneath. It is hidden on consoles narrower
than 360px of inner width, where the rule has no room to spare, and while the settings panel is over
the console.

It records a certification and gates nothing: training stays repeatable, and every control is
available whether or not it is shown.

## Storage

`orientationSeen` and `tutorialCompleted` are booleans in the same local settings record as everything
else — `localStorage`, on the device, alongside volume and haptics. No accounts, no login, no network,
no cloud. Clearing site data returns a device to its first launch, which is the correct behaviour for
a setting that only means "this browser has seen it".

## Responsiveness

The three choices are stacked at full panel width, so each is the same size and the same easy target
on a phone as on a desktop. The panel is capped at 520px, pads down on narrow screens, drops its hint
line below 420px of height or 380px of width, and shortens its rows on a short window. Checked with no
overflow at 1440x900, 1280x620, 1024x460, 844x390 landscape, 390x844 portrait and 360x640.

## Validation

`npm run validate`: 2779 checks, 0 warnings. `npm run build`: clean.

In the browser, every route was driven from a device with no stored settings: SKIP, ESC and a tap
outside each record `orientationSeen` and leave the console usable; BEGIN TRAINING and IDENTIFICATION
GUIDE each record it and open their destination; none of the three writes a mission or a tutorial
step; and a device that has already seen it answers the first press on RANDOM MISSION instead of
showing the panel.

## Not done

- No accounts, login or cloud storage.
- Nothing is forced: the panel never reappears, and completing training is not required for anything.
- No gameplay, scoring or generator changes. The 303-mission seeded fingerprint is unchanged.
