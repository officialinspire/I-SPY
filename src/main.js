import Phaser from 'phaser';
import './styles.css';
import { GAME_CONFIG } from './runtime-config.js';
import './settings/userSettings.js';
import BootScene from './scenes/BootScene.js';
import StartIntroScene from './scenes/StartIntroScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import MissionBriefingScene from './scenes/MissionBriefingScene.js';
import EnhancedReconScene from './scenes/EnhancedReconScene.js';
import TrainingScene from './scenes/TrainingScene.js';
import IdentificationGuideScene from './scenes/IdentificationGuideScene.js';
import ResultsScene from './scenes/ResultsScene.js';
import AnalystRecordScene from './scenes/AnalystRecordScene.js';

const devicePixelRatio = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
const renderResolution = Math.min(
  GAME_CONFIG.rendering.maxDevicePixelRatio,
  Math.max(1, devicePixelRatio),
);

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: GAME_CONFIG.palette.black,
  resolution: renderResolution,
  pixelArt: false,
  roundPixels: true,
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    activePointers: 3,
  },
  scene: [BootScene, StartIntroScene, MainMenuScene, MissionBriefingScene, EnhancedReconScene, TrainingScene, IdentificationGuideScene, ResultsScene, AnalystRecordScene],
};

const game = new Phaser.Game(config);

/**
 * Phaser.Scale.RESIZE follows the host in normal desktop resizes, but mobile
 * browsers can update the visual/layout viewport during rotation without the
 * canvas receiving the final host dimensions. Observe the safe-area-aware
 * #app box directly and make that box authoritative.
 */
const gameHost = document.getElementById('app');
let viewportSyncFrame = null;

function syncGameViewport() {
  viewportSyncFrame = null;
  if (!gameHost || !game.scale) return;
  const rect = gameHost.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const current = game.scale.gameSize;
  if (Math.round(current?.width ?? 0) === width && Math.round(current?.height ?? 0) === height) return;
  game.scale.resize(width, height);
}

function queueViewportSync() {
  if (viewportSyncFrame !== null) return;
  viewportSyncFrame = requestAnimationFrame(syncGameViewport);
}

if (typeof ResizeObserver !== 'undefined' && gameHost) {
  const hostObserver = new ResizeObserver(queueViewportSync);
  hostObserver.observe(gameHost);
}
window.addEventListener('resize', queueViewportSync, { passive: true });
window.addEventListener('orientationchange', queueViewportSync, { passive: true });
window.visualViewport?.addEventListener('resize', queueViewportSync, { passive: true });
queueViewportSync();
