import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import {
  DEFAULT_BUTTON_VARIANT,
  UI_TOKENS,
  hexToNumber,
  resolveVariant,
  touchPadding,
} from './designTokens.js';
import { prefersReducedMotion } from './presentation.js';
import { feedback, unlockAudio } from '../audio/feedback.js';

const HOVER_TICK_INTERVAL_MS = 90;
let lastHoverTickAt = 0;

function hoverTick() {
  const now = globalThis.performance?.now?.() ?? Date.now();
  if (now - lastHoverTickAt < HOVER_TICK_INTERVAL_MS) return;
  lastHoverTickAt = now;
  feedback('hover');
}

/**
 * Shared console button.
 *
 * Every visual value comes from the design tokens, so a button's meaning
 * (primary / secondary / tactical / warning / danger / success / disabled) is
 * readable at a glance and consistent across scenes.
 *
 * States: idle, hover, focus, pressed, selected, disabled.
 * Pointer, keyboard and touch all drive the same state machine, and every
 * release path (up, upoutside, out, cancel, game-out, visibility change)
 * clears the pressed state so a button can never stick.
 */
export function createButton(scene, x, y, label, onPress, options = {}) {
  const width = options.width ?? 270;
  const height = options.height ?? 48;
  const fontSize = options.fontSize ?? 20;
  const { metrics, motion } = UI_TOKENS;

  let variantName = options.variant ?? DEFAULT_BUTTON_VARIANT;
  let variant = resolveVariant(variantName);

  const status = {
    hovered: false,
    pressed: false,
    focused: false,
    selected: options.selected === true,
    enabled: options.enabled !== false,
    visible: true,
  };

  // Tracks which pointer armed this button, independent of the visual press
  // state, so a scene re-rendering the button mid-press cannot swallow a click.
  let armedPointerId = null;
  const origin = { x, y };
  const transform = { scale: 1, lift: 0 };
  let motionTween = null;

  const focusRing = scene.add
    .rectangle(x, y, width + metrics.focusRingOffset * 2, height + metrics.focusRingOffset * 2)
    .setStrokeStyle(metrics.focusRingWidth, hexToNumber(variant.focus), metrics.focusRingAlpha)
    .setVisible(false);

  const background = scene.add.rectangle(x, y, width, height, 0x000000, 1);

  const accent = scene.add
    .rectangle(x, y, metrics.accentWidth, Math.max(10, Math.round(height * metrics.accentHeightRatio)), hexToNumber(variant.accent))
    .setVisible(options.accent !== false);

  const text = scene.add
    .text(x, y, label, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: `${fontSize}px`,
      color: UI_TOKENS.text.body,
      align: 'center',
      letterSpacing: metrics.labelSpacing,
    })
    .setOrigin(0.5);

  const padX = touchPadding(width);
  const padY = touchPadding(height);
  const hitArea = new Phaser.Geom.Rectangle(-padX, -padY, width + padX * 2, height + padY * 2);
  background.setInteractive({
    hitArea,
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });

  const objects = [focusRing, background, accent, text];

  const resolveStateName = () => {
    if (!status.enabled) return 'disabled';
    if (status.pressed) return 'pressed';
    if (status.hovered) return 'hover';
    if (status.selected) return 'selected';
    return 'idle';
  };

  const applyGeometry = () => {
    const scale = transform.scale;
    focusRing.setScale(scale);
    background.setScale(scale);
    text.setScale(scale);
    text.setPosition(origin.x, origin.y - transform.lift);
    accent.setScale(1, scale);
    accent.setPosition(origin.x - (width / 2 - metrics.accentInset) * scale, origin.y);
  };

  const animateTo = (targetScale, targetLift, duration) => {
    motionTween?.remove();
    motionTween = null;
    if (prefersReducedMotion() || duration <= 0) {
      transform.scale = targetScale;
      transform.lift = targetLift;
      applyGeometry();
      return;
    }
    motionTween = scene.tweens.add({
      targets: transform,
      scale: targetScale,
      lift: targetLift,
      duration,
      ease: motion.ease,
      onUpdate: applyGeometry,
      onComplete: applyGeometry,
    });
  };

  const applyVisual = (animated = true) => {
    const stateName = resolveStateName();
    const tokens = variant.states[stateName];

    background.setFillStyle(hexToNumber(tokens.fill), tokens.fillAlpha);
    background.setStrokeStyle(tokens.borderWidth, hexToNumber(tokens.border), 1);
    text.setColor(tokens.label);
    accent.setFillStyle(hexToNumber(variant.accent)).setAlpha(tokens.accentAlpha);
    focusRing
      .setStrokeStyle(metrics.focusRingWidth, hexToNumber(variant.focus), metrics.focusRingAlpha)
      .setVisible(status.focused && status.enabled && status.visible);

    let targetScale = 1;
    let targetLift = 0;
    let duration = motion.releaseMs;
    if (stateName === 'pressed') {
      targetScale = motion.pressScale;
      duration = motion.pressMs;
    } else if (stateName === 'hover') {
      targetScale = motion.hoverScale;
      targetLift = motion.hoverLift;
      duration = motion.hoverMs;
    } else if (stateName === 'disabled') {
      duration = 0;
    }
    animateTo(targetScale, targetLift, animated ? duration : 0);
  };

  const setInputEnabled = (enabled) => {
    if (!background.input) return;
    background.input.enabled = enabled;
    background.input.cursor = enabled ? 'pointer' : 'default';
  };

  const releasePress = () => {
    armedPointerId = null;
    if (!status.pressed) return;
    status.pressed = false;
    applyVisual();
  };

  const clearPointerState = () => {
    armedPointerId = null;
    if (!status.hovered && !status.pressed) return;
    status.hovered = false;
    status.pressed = false;
    applyVisual();
  };

  const activate = () => {
    if (!status.enabled || !status.visible) return;
    feedback('button', 8);
    onPress?.();
  };

  background.on('pointerover', (pointer) => {
    // Touch input must never depend on hover, and a tap must not leave a
    // hover state behind once the finger lifts.
    if (pointer?.wasTouch || !status.enabled) return;
    status.hovered = true;
    applyVisual();
    hoverTick();
  });
  background.on('pointerout', () => {
    armedPointerId = null;
    status.hovered = false;
    status.pressed = false;
    applyVisual();
  });
  background.on('pointerdown', (pointer) => {
    unlockAudio();
    if (!status.enabled) return;
    armedPointerId = pointer?.id ?? 0;
    status.focused = false;
    status.pressed = true;
    applyVisual();
  });
  background.on('pointerup', (pointer) => {
    const armed = armedPointerId !== null && armedPointerId === (pointer?.id ?? 0);
    armedPointerId = null;
    status.pressed = false;
    if (pointer?.wasTouch) status.hovered = false;
    applyVisual();
    if (armed) activate();
  });
  background.on('pointerupoutside', releasePress);
  background.on('pointercancel', clearPointerState);

  // Safety nets: pointer released off-canvas, or the pointer left the game.
  const onSceneRelease = () => releasePress();
  const onGameOut = () => clearPointerState();
  scene.input.on('pointerup', onSceneRelease);
  scene.input.on('pointerupoutside', onSceneRelease);
  scene.input.on('gameout', onGameOut);

  const applyWeight = () => text.setFontStyle(variant.weight === 'bold' ? 'bold' : '');

  applyWeight();
  setInputEnabled(status.enabled);
  applyVisual(false);
  applyGeometry();

  const controller = {
    background,
    text,
    accent,
    focusRing,
    width,
    height,
    get variant() { return variantName; },
    getObjects() { return objects.slice(); },
    setPosition(nx, ny) {
      origin.x = nx;
      origin.y = ny;
      focusRing.setPosition(nx, ny);
      background.setPosition(nx, ny);
      applyGeometry();
      return controller;
    },
    setDepth(depth) {
      focusRing.setDepth(depth);
      background.setDepth(depth);
      accent.setDepth(depth + 1);
      text.setDepth(depth + 2);
      return controller;
    },
    setScrollFactor(value) {
      objects.forEach((object) => object.setScrollFactor(value));
      return controller;
    },
    setVisible(visible) {
      if (status.visible === visible) return controller;
      status.visible = visible;
      armedPointerId = null;
      status.hovered = false;
      status.pressed = false;
      if (!visible) status.focused = false;
      focusRing.setVisible(visible && status.focused && status.enabled);
      background.setVisible(visible);
      accent.setVisible(visible && options.accent !== false);
      text.setVisible(visible);
      setInputEnabled(visible && status.enabled);
      applyVisual(false);
      return controller;
    },
    setEnabled(enabled) {
      if (status.enabled === enabled) return controller;
      status.enabled = enabled;
      armedPointerId = null;
      if (!enabled) {
        status.hovered = false;
        status.pressed = false;
        status.focused = false;
      }
      setInputEnabled(enabled && status.visible);
      applyVisual(false);
      return controller;
    },
    setSelected(selected) {
      if (status.selected === selected) return controller;
      status.selected = selected;
      applyVisual();
      return controller;
    },
    setVariant(nextVariant) {
      if (nextVariant === variantName) return controller;
      variantName = nextVariant;
      variant = resolveVariant(nextVariant);
      applyWeight();
      applyVisual(false);
      return controller;
    },
    setLabel(nextLabel) {
      text.setText(nextLabel);
      return controller;
    },
    isEnabled() { return status.enabled; },
    isSelected() { return status.selected; },
    isVisible() { return status.visible; },
    isFocusable() { return status.enabled && status.visible; },
    isFocused() { return status.focused; },
    setFocused(focused) {
      if (status.focused === focused) return controller;
      status.focused = focused && status.enabled && status.visible;
      applyVisual();
      return controller;
    },
    /** Keyboard activation (Enter / Space) with the same tactile press beat. */
    activateFromKeyboard() {
      if (!status.enabled || !status.visible) return controller;
      status.pressed = true;
      applyVisual();
      const release = () => {
        if (!background.active) return;
        status.pressed = false;
        applyVisual();
      };
      if (prefersReducedMotion()) release();
      else scene.time.delayedCall(UI_TOKENS.motion.pressMs + 40, release);
      activate();
      return controller;
    },
    destroy() {
      armedPointerId = null;
      motionTween?.remove();
      scene.input.off('pointerup', onSceneRelease);
      scene.input.off('pointerupoutside', onSceneRelease);
      scene.input.off('gameout', onGameOut);
      objects.forEach((object) => object.destroy());
    },
  };

  scene.events.once('shutdown', () => {
    motionTween?.remove();
    scene.input.off('pointerup', onSceneRelease);
    scene.input.off('pointerupoutside', onSceneRelease);
    scene.input.off('gameout', onGameOut);
  });

  return controller;
}
