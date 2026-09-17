import { UI_TOKENS, hexToNumber } from './designTokens.js';
import { prefersReducedMotion } from './presentation.js';

/**
 * Shared recon marking visuals.
 *
 * Two rules shape everything here:
 * - The pending marker is tonally neutral. It reports where the analyst
 *   marked, never whether the mark is right.
 * - Nothing reacts to what is under the pointer, so sweeping the reticle
 *   across the image cannot reveal which shapes are selectable objects.
 */

export const MARKER_TONES = Object.freeze({
  pending: UI_TOKENS.color.offWhite,
  confirmed: UI_TOKENS.color.phosphorBright,
  rejected: UI_TOKENS.color.rustBright,
});

/** Screen-space geometry of the candidate marker, in CSS pixels. */
const MARK = Object.freeze({
  radius: 19,
  gap: 7,
  arm: 13,
  bracket: 7,
  lineWidth: 2,
});

/**
 * Candidate marker, drawn in world space but sized in screen pixels so it
 * stays legible at every zoom level instead of ballooning as the analyst
 * zooms in.
 */
export function drawCandidateReticle(graphics, x, y, zoom, tone = 'pending', scale = 1) {
  graphics.clear();
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const unit = 1 / Math.max(0.05, zoom || 1);
  const color = hexToNumber(MARKER_TONES[tone] ?? MARKER_TONES.pending);
  const radius = MARK.radius * unit * scale;
  const arm = MARK.arm * unit;
  const gap = MARK.gap * unit;
  const bracket = MARK.bracket * unit;
  const width = MARK.lineWidth * unit;

  graphics.lineStyle(width, color, 0.95);
  graphics.strokeCircle(x, y, radius);

  // Crosshair arms stop short of the centre so the marked object stays visible.
  graphics.lineBetween(x - radius - arm, y, x - gap, y);
  graphics.lineBetween(x + gap, y, x + radius + arm, y);
  graphics.lineBetween(x, y - radius - arm, x, y - gap);
  graphics.lineBetween(x, y + gap, x, y + radius + arm);

  const corner = radius + arm * 0.55;
  graphics.lineStyle(width, color, 0.75);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    graphics.lineBetween(x + sx * corner, y + sy * corner, x + sx * (corner - bracket), y + sy * corner);
    graphics.lineBetween(x + sx * corner, y + sy * corner, x + sx * corner, y + sy * (corner - bracket));
  });

  graphics.fillStyle(color, 0.95);
  graphics.fillRect(x - width, y - width, width * 2, width * 2);
}

/**
 * Pointer reticle shown while marking is armed.
 *
 * It tracks the pointer in screen space and sweeps a slow targeting tick,
 * which is the whole "selection mode is live" signal. Reduced-motion users get
 * the same reticle without the sweep.
 */
export function createPointerReticle(scene, options = {}) {
  const depth = options.depth ?? 960;
  const color = hexToNumber(options.color ?? UI_TOKENS.color.amber);
  const radius = options.radius ?? 17;

  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(depth).setVisible(false);
  const state = { sweep: 0, breathe: 1 };
  const position = { x: -999, y: -999 };
  let active = false;
  let tween = null;

  const redraw = () => {
    graphics.clear();
    if (!active) return;
    const r = radius * state.breathe;

    graphics.lineStyle(2, color, 0.9);
    graphics.strokeCircle(position.x, position.y, r);
    graphics.lineStyle(1, color, 0.45);
    graphics.strokeCircle(position.x, position.y, r + 6);

    graphics.lineStyle(2, color, 0.9);
    graphics.lineBetween(position.x - r - 9, position.y, position.x - 5, position.y);
    graphics.lineBetween(position.x + 5, position.y, position.x + r + 9, position.y);
    graphics.lineBetween(position.x, position.y - r - 9, position.x, position.y - 5);
    graphics.lineBetween(position.x, position.y + 5, position.x, position.y + r + 9);

    if (state.sweep > 0) {
      const angle = state.sweep * Math.PI * 2;
      graphics.lineStyle(2, color, 0.6);
      graphics.lineBetween(
        position.x + Math.cos(angle) * (r + 2),
        position.y + Math.sin(angle) * (r + 2),
        position.x + Math.cos(angle) * (r + 8),
        position.y + Math.sin(angle) * (r + 8),
      );
    }

    graphics.fillStyle(color, 0.9);
    graphics.fillRect(position.x - 1, position.y - 1, 2, 2);
  };

  const stopTween = () => {
    tween?.remove();
    tween = null;
    state.sweep = 0;
    state.breathe = 1;
  };

  const startTween = () => {
    stopTween();
    if (prefersReducedMotion()) return;
    tween = scene.tweens.add({
      targets: state,
      sweep: 1,
      breathe: 1.09,
      duration: 1400,
      repeat: -1,
      yoyo: false,
      ease: 'Linear',
      onUpdate: redraw,
      onRepeat: () => { state.sweep = 0; state.breathe = 1; },
    });
  };

  const onPointerMove = (pointer) => {
    position.x = pointer.x;
    position.y = pointer.y;
    if (active) redraw();
  };
  scene.input.on('pointermove', onPointerMove);

  const controller = {
    graphics,
    setActive(next) {
      if (active === next) return controller;
      active = next;
      graphics.setVisible(next);
      if (next) startTween(); else stopTween();
      redraw();
      return controller;
    },
    setPosition(x, y) {
      position.x = x;
      position.y = y;
      if (active) redraw();
      return controller;
    },
    isActive() { return active; },
    destroy() {
      stopTween();
      scene.input.off('pointermove', onPointerMove);
      graphics.destroy();
    },
  };

  scene.events.once('shutdown', () => {
    stopTween();
    scene.input.off('pointermove', onPointerMove);
  });

  return controller;
}
