import { ENVIRONMENT_CONDITIONS } from '../game/environmentConditions.js';

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticles(seed, condition, reducedMotion) {
  if (condition === ENVIRONMENT_CONDITIONS.CLEAR) return [];
  const rng = mulberry32(hashSeed(`${seed}:weather-particles:${condition}`));
  const baseCount = condition === ENVIRONMENT_CONDITIONS.RAIN ? 42 : 34;
  const count = reducedMotion ? Math.ceil(baseCount * 0.52) : baseCount;
  return Array.from({ length: count }, () => ({
    x: rng(),
    y: rng(),
    size: condition === ENVIRONMENT_CONDITIONS.RAIN ? 7 + rng() * 10 : 1.2 + rng() * 1.8,
    speed: condition === ENVIRONMENT_CONDITIONS.RAIN ? 0.55 + rng() * 0.6 : 0.12 + rng() * 0.2,
    drift: condition === ENVIRONMENT_CONDITIONS.RAIN ? -0.02 + rng() * 0.04 : -0.08 + rng() * 0.16,
    alpha: condition === ENVIRONMENT_CONDITIONS.RAIN ? 0.12 + rng() * 0.11 : 0.18 + rng() * 0.16,
  }));
}

/**
 * Lightweight screen-space precipitation. It never becomes interactive and
 * never inspects world objects, so weather cannot reveal targets or change
 * hit-testing. Reduced-motion keeps a sparse static plate instead of motion.
 */
export function createWeatherOverlay(scene, {
  mission,
  reducedMotion = false,
  depth = 936,
  getBounds = (width, height) => ({ top: 0, bottom: height }),
} = {}) {
  const condition = mission?.condition ?? ENVIRONMENT_CONDITIONS.CLEAR;
  const seed = mission?.seed ?? mission?.id ?? 'I-SPY';
  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(depth);
  const particles = buildParticles(seed, condition, reducedMotion);
  let phase = 0;
  let paused = false;
  const wrap01 = (value) => ((value % 1) + 1) % 1;

  const draw = () => {
    if (!graphics?.active) return;
    graphics.clear();
    if (condition === ENVIRONMENT_CONDITIONS.CLEAR || particles.length === 0) return;

    const { width, height } = scene.scale.gameSize;
    const requested = getBounds(width, height) ?? {};
    const top = Math.max(0, Number(requested.top) || 0);
    const bottom = Math.min(height, Number(requested.bottom) || height);
    const span = Math.max(1, bottom - top);

    if (condition === ENVIRONMENT_CONDITIONS.RAIN) {
      particles.forEach((particle) => {
        const yNorm = reducedMotion ? particle.y : wrap01(particle.y + phase * particle.speed);
        const xNorm = reducedMotion
          ? particle.x
          : wrap01(particle.x + phase * particle.drift);
        const x = xNorm * width;
        const y = top + yNorm * span;
        graphics.lineStyle(1, 0xf6f6ee, particle.alpha);
        graphics.lineBetween(x, y, x - 3, Math.min(bottom, y + particle.size));
      });
      return;
    }

    particles.forEach((particle) => {
      const yNorm = reducedMotion ? particle.y : wrap01(particle.y + phase * particle.speed);
      const sway = reducedMotion ? 0 : Math.sin((phase + particle.y) * Math.PI * 2) * particle.drift;
      const xNorm = wrap01(particle.x + sway);
      graphics.fillStyle(0xf6f6ee, particle.alpha);
      graphics.fillCircle(xNorm * width, top + yNorm * span, particle.size);
    });
  };

  const tick = condition !== ENVIRONMENT_CONDITIONS.CLEAR && !reducedMotion
    ? scene.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        if (paused) return;
        // Keep phase continuous. Resetting at 1 caused every particle to snap
        // backward together roughly every five seconds, which read as a
        // visible weather-loop seam rather than continuous precipitation.
        phase += 0.018;
        draw();
      },
    })
    : null;

  draw();

  return {
    condition,
    graphics,
    particles,
    reducedMotion,
    resize: draw,
    setPaused(value) {
      paused = value === true;
      if (tick) tick.paused = paused;
    },
    destroy() {
      tick?.remove(false);
      graphics?.destroy();
    },
  };
}
