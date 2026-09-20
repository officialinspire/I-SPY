import { GAME_CONFIG } from '../runtime-config.js';

/**
 * Phase 13A — centralized UI design tokens.
 *
 * Every interactive surface reads its colors, motion timings and metrics from
 * here so the console keeps one coherent Cold War equipment language:
 * terminal black and charcoal panels, muted phosphor green for positive or
 * active state, desaturated amber for the action the analyst should take,
 * muted red for destructive or failed state, off-white for neutral readout.
 */

const P = GAME_CONFIG.palette;

/** Derived fills. Kept here so no scene hand-mixes a one-off shade. */
const FILL = {
  panel: '#14150f',
  neutralIdle: P.nearBlack,
  neutralHover: '#23241f',
  neutralPressed: '#0f100e',
  steelIdle: P.steelDeep,
  steelHover: '#1d2128',
  steelPressed: '#0a0c0e',
  steelSelected: '#232833',
  amberIdle: P.amberDeep,
  amberHover: '#33250c',
  amberPressed: '#170f04',
  amberSelected: '#3c2c0f',
  phosphorIdle: P.phosphorDeep,
  phosphorHover: '#1d2f13',
  phosphorPressed: '#0b1305',
  phosphorSelected: '#243a17',
  rustIdle: P.rustDeep,
  rustHover: '#33150f',
  rustPressed: '#150806',
  disabled: '#121210',
};

export function hexToNumber(value) {
  if (typeof value === 'number') return value;
  const parsed = Number.parseInt(String(value).replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const UI_TOKENS = Object.freeze({
  color: Object.freeze({ ...P, panel: FILL.panel }),
  surface: Object.freeze({
    base: P.black,
    panel: FILL.panel,
    panelAlpha: 0.44,
    panelBorder: P.steel,
    panelBorderAlpha: 0.38,
    panelAccent: P.amber,
    panelAccentAlpha: 0.66,
    divider: P.steel,
    dividerAlpha: 0.3,
  }),
  text: Object.freeze({
    primary: P.white,
    body: P.offWhite,
    muted: P.lightGray,
    faint: P.gray,
    positive: P.phosphor,
    positiveBright: P.phosphorBright,
    attention: P.amberBright,
    negative: P.rustBright,
  }),
  motion: Object.freeze({
    hoverMs: 110,
    pressMs: 90,
    releaseMs: 120,
    focusMs: 90,
    ease: 'Sine.easeOut',
    pressScale: 0.975,
    hoverScale: 1.012,
    hoverLift: 1,
    // Selected controls breathe their accent bar; nothing else moves.
    selectedPulseMs: 1150,
    selectedPulseFloor: 0.62,
  }),
  metrics: Object.freeze({
    minTouchTarget: 44,
    maxHitPadding: 12,
    borderWidth: 2,
    focusRingOffset: 7,
    focusRingWidth: 2,
    focusRingAlpha: 0.95,
    accentWidth: 3,
    accentInset: 6,
    accentHeightRatio: 0.52,
    labelSpacing: 1,
  }),
});

const state = (fill, fillAlpha, border, borderWidth, label, accentAlpha) => Object.freeze({
  fill, fillAlpha, border, borderWidth, label, accentAlpha,
});

const DISABLED_STATE = state(FILL.disabled, 0.72, P.charcoal, 1, P.gray, 0.16);

const buildVariant = ({ accent, focus, weight = 'normal', idle, hover, pressed, selected }) => Object.freeze({
  accent,
  focus,
  weight,
  states: Object.freeze({
    idle,
    hover,
    pressed,
    selected: selected ?? hover,
    disabled: DISABLED_STATE,
  }),
});

/**
 * Semantic button variants. Fill weight — not hue alone — carries hierarchy,
 * so primary reads first even on a desaturated display.
 */
export const BUTTON_VARIANTS = Object.freeze({
  // The single action the analyst is expected to take on a screen.
  primary: buildVariant({
    accent: P.amberBright,
    focus: P.amberBright,
    weight: 'bold',
    idle: state(FILL.amberIdle, 0.96, P.amber, 2, P.amberBright, 0.7),
    hover: state(FILL.amberHover, 1, P.amberBright, 2, P.white, 1),
    pressed: state(FILL.amberPressed, 1, P.amberBright, 2, P.amberBright, 1),
    selected: state(FILL.amberSelected, 1, P.amberBright, 2, P.white, 1),
  }),
  // Supporting navigation and utility actions.
  secondary: buildVariant({
    accent: P.steelBright,
    focus: P.offWhite,
    idle: state(FILL.neutralIdle, 0.86, P.steel, 1, P.lightGray, 0.28),
    hover: state(FILL.neutralHover, 0.96, P.offWhite, 2, P.white, 0.8),
    pressed: state(FILL.neutralPressed, 1, P.offWhite, 2, P.offWhite, 0.9),
    selected: state(FILL.phosphorSelected, 0.96, P.phosphor, 2, P.phosphorBright, 1),
  }),
  // Mission-equipment controls: mode selection, optics, pass handling.
  tactical: buildVariant({
    accent: P.phosphor,
    focus: P.phosphorBright,
    idle: state(FILL.steelIdle, 0.9, P.steelDim, 2, P.offWhite, 0.34),
    hover: state(FILL.steelHover, 1, P.steelBright, 2, P.white, 0.9),
    pressed: state(FILL.steelPressed, 1, P.offWhite, 2, P.offWhite, 1),
    selected: state(FILL.steelSelected, 1, P.phosphor, 2, P.phosphorBright, 1),
  }),
  // Reversible but attention-worthy: pause, holds, guarded toggles.
  warning: buildVariant({
    accent: P.amber,
    focus: P.amberBright,
    idle: state(FILL.neutralIdle, 0.86, P.amberDim, 2, P.amber, 0.5),
    hover: state(FILL.amberHover, 0.96, P.amber, 2, P.amberBright, 0.95),
    pressed: state(FILL.amberPressed, 1, P.amberBright, 2, P.amberBright, 1),
  }),
  // Discards work or aborts an in-flight action.
  danger: buildVariant({
    accent: P.rust,
    focus: P.rustBright,
    idle: state(FILL.rustIdle, 0.88, P.rustDim, 2, P.rustBright, 0.5),
    hover: state(FILL.rustHover, 1, P.rust, 2, P.white, 0.95),
    pressed: state(FILL.rustPressed, 1, P.rustBright, 2, P.rustBright, 1),
  }),
  // Commits an identification or confirms a positive result.
  success: buildVariant({
    accent: P.phosphor,
    focus: P.phosphorBright,
    weight: 'bold',
    idle: state(FILL.phosphorIdle, 0.92, P.phosphorDim, 2, P.phosphorBright, 0.62),
    hover: state(FILL.phosphorHover, 1, P.phosphor, 2, P.white, 1),
    pressed: state(FILL.phosphorPressed, 1, P.phosphorBright, 2, P.phosphorBright, 1),
    selected: state(FILL.phosphorSelected, 1, P.phosphorBright, 2, P.white, 1),
  }),
  // Present but not actionable.
  disabled: buildVariant({
    accent: P.charcoal,
    focus: P.gray,
    idle: DISABLED_STATE,
    hover: DISABLED_STATE,
    pressed: DISABLED_STATE,
    selected: DISABLED_STATE,
  }),
});

export const DEFAULT_BUTTON_VARIANT = 'secondary';

export function resolveVariant(name) {
  return BUTTON_VARIANTS[name] ?? BUTTON_VARIANTS[DEFAULT_BUTTON_VARIANT];
}

/**
 * Extra hit padding needed to reach the ~44px minimum touch target.
 *
 * `limit` is how much room the control's own layout has to give on each side.
 * A padded hit area that reaches into the neighbouring control is worse than a
 * small one: the two overlap, the topmost wins, and a press near the seam runs
 * the wrong action. So a packed row or column passes half its gap here and the
 * padding grows only into space nothing else owns.
 */
export function touchPadding(size, limit = UI_TOKENS.metrics.maxHitPadding) {
  const deficit = UI_TOKENS.metrics.minTouchTarget - size;
  if (deficit <= 0) return 0;
  const ceiling = Math.max(0, Math.min(UI_TOKENS.metrics.maxHitPadding, limit));
  return Math.min(ceiling, Math.ceil(deficit / 2));
}
