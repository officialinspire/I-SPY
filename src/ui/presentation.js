import { GAME_CONFIG } from '../runtime-config.js';

export function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export function createTerminalChrome(scene, options = {}) {
  const classification = options.classification ?? 'RESTRICTED // TRAINING USE';
  const station = options.station ?? 'ORBITAL IMAGERY ANALYSIS CONSOLE';
  const depth = options.depth ?? 5000;

  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(depth);
  const topLeft = scene.add.text(0, 0, station, {
    fontFamily: GAME_CONFIG.typography.family,
    fontSize: '10px',
    color: GAME_CONFIG.palette.gray,
    letterSpacing: 1,
  }).setScrollFactor(0).setDepth(depth + 1);
  const topRight = scene.add.text(0, 0, classification, {
    fontFamily: GAME_CONFIG.typography.family,
    fontSize: '10px',
    color: GAME_CONFIG.palette.lightGray,
    letterSpacing: 1,
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(depth + 1);
  const bottomLeft = scene.add.text(0, 0, `I SPY // SYSTEM ${GAME_CONFIG.version}`, {
    fontFamily: GAME_CONFIG.typography.family,
    fontSize: '9px',
    color: GAME_CONFIG.palette.gray,
  }).setOrigin(0, 1).setScrollFactor(0).setDepth(depth + 1);
  const bottomRight = scene.add.text(0, 0, 'NO EXTERNAL TRANSMISSION', {
    fontFamily: GAME_CONFIG.typography.family,
    fontSize: '9px',
    color: GAME_CONFIG.palette.gray,
  }).setOrigin(1, 1).setScrollFactor(0).setDepth(depth + 1);

  const layout = (gameSize) => {
    const { width, height } = gameSize;
    const margin = width < 540 ? 10 : 16;
    const corner = width < 540 ? 14 : 20;
    graphics.clear();
    graphics.lineStyle(1, 0xbdbdbd, 0.42);
    graphics.strokeRect(margin, margin, Math.max(1, width - margin * 2), Math.max(1, height - margin * 2));
    graphics.lineStyle(2, 0xf6f6ee, 0.72);
    graphics.lineBetween(margin, margin + corner, margin, margin);
    graphics.lineBetween(margin, margin, margin + corner, margin);
    graphics.lineBetween(width - margin - corner, margin, width - margin, margin);
    graphics.lineBetween(width - margin, margin, width - margin, margin + corner);
    graphics.lineBetween(margin, height - margin - corner, margin, height - margin);
    graphics.lineBetween(margin, height - margin, margin + corner, height - margin);
    graphics.lineBetween(width - margin - corner, height - margin, width - margin, height - margin);
    graphics.lineBetween(width - margin, height - margin - corner, width - margin, height - margin);

    topLeft.setPosition(margin + 8, margin + 7).setVisible(width >= 420);
    topRight.setPosition(width - margin - 8, margin + 7).setVisible(width >= 420);
    bottomLeft.setPosition(margin + 8, height - margin - 6).setVisible(height >= 360);
    bottomRight.setPosition(width - margin - 8, height - margin - 6).setVisible(width >= 620 && height >= 360);
  };

  layout(scene.scale.gameSize);
  return { graphics, topLeft, topRight, bottomLeft, bottomRight, layout };
}

/**
 * Slight panel settle: alpha only, never position, so a transition can never
 * fight a responsive layout. Reduced motion lands the panel already solid.
 */
export function fadeIn(scene, targets, options = {}) {
  const list = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
  if (!list.length) return null;
  const to = options.to ?? 1;
  if (prefersReducedMotion()) {
    scene.tweens.killTweensOf(list);
    list.forEach((target) => target.setAlpha?.(to));
    return null;
  }
  // Re-opening a panel mid-fade must not stack two tweens on one target.
  scene.tweens.killTweensOf(list);
  list.forEach((target) => target.setAlpha?.(options.from ?? 0));
  return scene.tweens.add({
    targets: list,
    alpha: to,
    duration: options.duration ?? 140,
    ease: 'Sine.easeOut',
  });
}

export function typeText(scene, textObject, fullText, options = {}) {
  const charsPerSecond = options.charsPerSecond ?? 110;
  if (prefersReducedMotion() || options.instant) {
    textObject.setText(fullText);
    options.onComplete?.();
    return null;
  }

  textObject.setText('');
  let index = 0;
  const delay = Math.max(8, Math.round(1000 / charsPerSecond));
  return scene.time.addEvent({
    delay,
    repeat: Math.max(0, fullText.length - 1),
    callback: () => {
      index += 1;
      textObject.setText(fullText.slice(0, index));
      if (index >= fullText.length) options.onComplete?.();
    },
  });
}

export function drawReticle(graphics, x, y, radius = 38, alpha = 0.72) {
  graphics.lineStyle(2, 0xf6f6ee, alpha);
  graphics.strokeCircle(x, y, radius);
  graphics.lineBetween(x - radius - 14, y, x - radius + 5, y);
  graphics.lineBetween(x + radius - 5, y, x + radius + 14, y);
  graphics.lineBetween(x, y - radius - 14, x, y - radius + 5);
  graphics.lineBetween(x, y + radius - 5, x, y + radius + 14);
  graphics.fillStyle(0xf6f6ee, alpha);
  graphics.fillRect(x - 1, y - 1, 3, 3);
}
