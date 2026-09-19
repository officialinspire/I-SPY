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
 *
 * Two layouts:
 * - `plain` (default) centers a single label.
 * - `card` (implied by `icon` or `description`) lays out an optional sprite
 *   icon, a left-aligned title and a one-line description, for consoles that
 *   need to say what an action does as well as name it.
 */
export function createButton(scene, x, y, label, onPress, options = {}) {
  const { metrics, motion } = UI_TOKENS;

  let variantName = options.variant ?? DEFAULT_BUTTON_VARIANT;
  let variant = resolveVariant(variantName);
  let accentColor = options.accentColor ?? variant.accent;

  const isCard = Boolean(options.icon || options.description);
  const showAccent = options.accent !== false;

  // Mutable so a responsive scene can re-tier the same button on resize.
  const size = {
    width: options.width ?? 270,
    height: options.height ?? 48,
    fontSize: options.fontSize ?? 20,
    descriptionFontSize: options.descriptionFontSize ?? 11,
    iconSize: options.iconSize ?? 26,
    padding: options.padding ?? 16,
    showDescription: options.showDescription !== false,
    showIcon: options.showIcon !== false,
  };

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
  // Icons come off a 2x-rasterized sheet, so their display size is a scale
  // factor the press/hover scale multiplies rather than replaces.
  let iconBaseScale = 1;
  let motionTween = null;
  let accentPulse = null;

  const focusRing = scene.add
    .rectangle(x, y, size.width + metrics.focusRingOffset * 2, size.height + metrics.focusRingOffset * 2)
    .setStrokeStyle(metrics.focusRingWidth, hexToNumber(variant.focus), metrics.focusRingAlpha)
    .setVisible(false);

  const background = scene.add.rectangle(x, y, size.width, size.height, 0x000000, 1);

  const accent = scene.add
    .rectangle(x, y, metrics.accentWidth, 10, hexToNumber(accentColor))
    .setVisible(showAccent);

  const icon = options.icon
    ? scene.add.image(x, y, options.icon.texture, options.icon.frame).setOrigin(0.5)
    : null;

  const text = scene.add
    .text(x, y, label, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: `${size.fontSize}px`,
      color: UI_TOKENS.text.body,
      align: isCard ? 'left' : 'center',
      letterSpacing: metrics.labelSpacing,
    })
    .setOrigin(isCard ? 0 : 0.5, 0.5);

  const description = options.description
    ? scene.add
      .text(x, y, options.description, {
        fontFamily: GAME_CONFIG.typography.family,
        fontSize: `${size.descriptionFontSize}px`,
        color: UI_TOKENS.text.muted,
        align: 'left',
      })
      .setOrigin(0, 0.5)
    : null;

  const hitArea = new Phaser.Geom.Rectangle(0, 0, size.width, size.height);
  background.setInteractive({
    hitArea,
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });

  const objects = [focusRing, background, accent, icon, text, description].filter(Boolean);

  /** Offsets from the button centre, recomputed whenever the metrics change. */
  const offsets = new Map();

  const measure = () => {
    const half = size.width / 2;
    offsets.set(accent, { dx: -(half - metrics.accentInset), dy: 0 });

    if (!isCard) {
      offsets.set(text, { dx: 0, dy: 0, lifts: true });
      if (icon) offsets.set(icon, { dx: 0, dy: 0 });
      return;
    }

    const contentLeft = -half + size.padding;
    const withIcon = Boolean(icon) && size.showIcon;
    const textLeft = withIcon ? contentLeft + size.iconSize + Math.round(size.iconSize * 0.45) : contentLeft;
    if (icon) offsets.set(icon, { dx: contentLeft + size.iconSize / 2, dy: 0 });

    if (description && size.showDescription) {
      // Centre the title + description block on their measured heights so a
      // description that wraps to two lines still sits correctly in the card.
      const gap = 2;
      const blockHeight = text.height + gap + description.height;
      const blockTop = -blockHeight / 2;
      offsets.set(text, { dx: textLeft, dy: blockTop + text.height / 2, lifts: true });
      offsets.set(description, { dx: textLeft, dy: blockTop + text.height + gap + description.height / 2, lifts: true });
    } else {
      offsets.set(text, { dx: textLeft, dy: 0, lifts: true });
    }
  };

  const applyGeometry = () => {
    const scale = transform.scale;
    focusRing.setScale(scale);
    background.setScale(scale);
    accent.setScale(1, scale);
    text.setScale(scale);
    icon?.setScale(iconBaseScale * scale);
    description?.setScale(scale);
    objects.forEach((object) => {
      if (object === background || object === focusRing) {
        object.setPosition(origin.x, origin.y);
        return;
      }
      const offset = offsets.get(object);
      if (!offset) return;
      const lift = offset.lifts ? transform.lift : 0;
      object.setPosition(origin.x + offset.dx * scale, origin.y + offset.dy * scale - lift);
    });
  };

  const applyMetrics = () => {
    background.setSize(size.width, size.height);
    focusRing.setSize(size.width + metrics.focusRingOffset * 2, size.height + metrics.focusRingOffset * 2);
    accent.setSize(metrics.accentWidth, Math.max(10, Math.round(size.height * metrics.accentHeightRatio)));
    text.setFontSize(size.fontSize);
    if (description) {
      const iconSpan = icon && size.showIcon ? size.iconSize + Math.round(size.iconSize * 0.45) : 0;
      description.setFontSize(size.descriptionFontSize);
      description.setWordWrapWidth(Math.max(48, size.width - size.padding * 2 - iconSpan));
      description.setVisible(status.visible && size.showDescription);
    }
    if (icon) {
      const frameSize = icon.frame?.realWidth || icon.frame?.width || icon.width || size.iconSize;
      iconBaseScale = size.iconSize / frameSize;
      icon.setVisible(status.visible && size.showIcon);
    }

    const padX = touchPadding(size.width);
    const padY = touchPadding(size.height);
    hitArea.setTo(-padX, -padY, size.width + padX * 2, size.height + padY * 2);

    measure();
    applyGeometry();
  };

  const resolveStateName = () => {
    if (!status.enabled) return 'disabled';
    if (status.pressed) return 'pressed';
    if (status.hovered) return 'hover';
    if (status.selected) return 'selected';
    return 'idle';
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

  /**
   * A selected control breathes its accent bar so "this one is live" reads
   * without any layout movement. Reduced motion holds it steady.
   */
  const applyAccentPulse = (stateName) => {
    const wants = stateName === 'selected' && showAccent && status.visible && !prefersReducedMotion();
    if (!wants) {
      accentPulse?.remove();
      accentPulse = null;
      return;
    }
    if (accentPulse) return;
    accentPulse = scene.tweens.add({
      targets: accent,
      alpha: motion.selectedPulseFloor,
      duration: motion.selectedPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  };

  const applyVisual = (animated = true) => {
    const stateName = resolveStateName();
    const tokens = variant.states[stateName];

    background.setFillStyle(hexToNumber(tokens.fill), tokens.fillAlpha);
    background.setStrokeStyle(tokens.borderWidth, hexToNumber(tokens.border), 1);
    text.setColor(tokens.label);
    description?.setColor(tokens.label).setAlpha(stateName === 'disabled' ? 0.5 : 0.68);
    accent.setFillStyle(hexToNumber(accentColor)).setAlpha(tokens.accentAlpha);
    applyAccentPulse(stateName);
    if (icon) {
      icon.setTint(hexToNumber(accentColor));
      if (stateName === 'disabled') icon.setAlpha(0.3);
      else icon.setAlpha(stateName === 'idle' ? 0.8 : 1);
    }
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
    // Exactly one cue per activation. Controls whose handler voices the
    // outcome itself (confirm, cancel, tally steppers, pass segments) pass
    // `pressSound: false` so the press is not voiced twice.
    if (options.pressSound !== false) feedback(options.pressSound ?? 'press');
    onPress?.();
  };

  background.on('pointerover', (pointer) => {
    // Touch input must never depend on hover, and a tap must not leave a
    // hover state behind once the finger lifts.
    if (pointer?.wasTouch || !status.enabled) return;
    status.hovered = true;
    applyVisual();
    hoverTick();
    options.onHover?.(true);
  });
  background.on('pointerout', () => {
    armedPointerId = null;
    status.hovered = false;
    status.pressed = false;
    applyVisual();
    options.onHover?.(false);
  });
  /**
   * An optional veto the owner of the button can hold.
   *
   * A masked grid is the case this exists for: the cell's hit area is a
   * rectangle Phaser knows nothing about being clipped, so the scene that owns
   * the mask says whether this pointer is somewhere the button can be pressed.
   * Keyboard activation never asks, so a control stays reachable by keyboard
   * whatever the pointer is doing.
   */
  const pointerAllowed = (pointer) => options.pointerGuard?.(pointer) !== false;

  background.on('pointerdown', (pointer) => {
    unlockAudio();
    if (!status.enabled || !pointerAllowed(pointer)) return;
    armedPointerId = pointer?.id ?? 0;
    status.focused = false;
    status.pressed = true;
    applyVisual();
  });
  background.on('pointerup', (pointer) => {
    // Asked again on release: a press that began legitimately and turned into
    // a drag (scrolling a grid) must not activate when the finger lifts.
    const armed = armedPointerId !== null && armedPointerId === (pointer?.id ?? 0) && pointerAllowed(pointer);
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
  applyMetrics();
  applyVisual(false);

  const controller = {
    background,
    text,
    accent,
    focusRing,
    icon,
    description,
    get width() { return size.width; },
    get height() { return size.height; },
    get variant() { return variantName; },
    getObjects() { return objects.slice(); },
    setPosition(nx, ny) {
      origin.x = nx;
      origin.y = ny;
      applyGeometry();
      return controller;
    },
    /** Re-tier the button for a new breakpoint; omitted values are kept. */
    resize(next = {}) {
      Object.entries(next).forEach(([key, value]) => {
        if (value !== undefined && key in size) size[key] = value;
      });
      applyMetrics();
      return controller;
    },
    setDepth(depth) {
      focusRing.setDepth(depth);
      background.setDepth(depth);
      accent.setDepth(depth + 1);
      icon?.setDepth(depth + 1);
      text.setDepth(depth + 2);
      description?.setDepth(depth + 2);
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
      accent.setVisible(visible && showAccent);
      text.setVisible(visible);
      icon?.setVisible(visible && size.showIcon);
      description?.setVisible(visible && size.showDescription);
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
      if (!options.accentColor) accentColor = variant.accent;
      applyWeight();
      applyVisual(false);
      return controller;
    },
    setLabel(nextLabel) {
      text.setText(nextLabel);
      return controller;
    },
    setDescription(nextDescription) {
      description?.setText(nextDescription);
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
    setAlpha(alpha) {
      objects.forEach((object) => object.setAlpha(alpha));
      return controller;
    },
    destroy() {
      armedPointerId = null;
      accentPulse?.remove();
      motionTween?.remove();
      scene.input.off('pointerup', onSceneRelease);
      scene.input.off('pointerupoutside', onSceneRelease);
      scene.input.off('gameout', onGameOut);
      objects.forEach((object) => object.destroy());
    },
  };

  scene.events.once('shutdown', () => {
    accentPulse?.remove();
    motionTween?.remove();
    scene.input.off('pointerup', onSceneRelease);
    scene.input.off('pointerupoutside', onSceneRelease);
    scene.input.off('gameout', onGameOut);
  });

  return controller;
}
