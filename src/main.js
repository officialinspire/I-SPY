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

const qaMode = new URLSearchParams(window.location.search).get('qa') === '1';
if (qaMode) {
  Object.defineProperty(window, '__ISPY_QA__', {
    configurable: true,
    value: {
      game,
      activeScenes: () => game.scene.getScenes(true).map((scene) => scene.scene.key),
      buttonCenter: (sceneKey, property) => {
        const scene = game.scene.getScene(sceneKey);
        const button = scene?.[property];
        return button?.background ? { x: button.background.x, y: button.background.y } : null;
      },
      finishIntro: () => game.scene.getScene('StartIntro')?.finish?.(),
    },
  });
}

/**
 * Phaser.Scale.RESIZE follows ordinary desktop resizes, but mobile browsers
 * can settle their layout viewport over several frames during rotation.
 * Observe the safe-area-aware host directly and make its final box authoritative.
 *
 * scale.resize() is intentional: it preserves RESIZE-mode semantics and was
 * verified against the portrait/landscape tablet path. setGameSize()+refresh()
 * can leave the display canvas at the pre-rotation dimensions.
 */
const gameHost = document.getElementById('app');
let viewportSyncFrame = null;
let viewportSyncTimers = [];

function syncGameViewport() {
  viewportSyncFrame = null;
  if (!gameHost || !game.scale) return;

  const rect = gameHost.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const currentWidth = Math.round(game.scale.gameSize?.width ?? 0);
  const currentHeight = Math.round(game.scale.gameSize?.height ?? 0);

  if (currentWidth !== width || currentHeight !== height) {
    game.scale.resize(width, height);
  }

  const canvas = game.canvas;
  if (canvas) {
    canvas.style.marginLeft = '0px';
    canvas.style.marginTop = '0px';
  }
}

function queueViewportSync() {
  if (viewportSyncFrame === null) {
    viewportSyncFrame = requestAnimationFrame(syncGameViewport);
  }
  viewportSyncTimers.forEach((timer) => clearTimeout(timer));
  viewportSyncTimers = [50, 150, 300].map((delay) => setTimeout(syncGameViewport, delay));
}

if (typeof ResizeObserver !== 'undefined' && gameHost) {
  const hostObserver = new ResizeObserver(queueViewportSync);
  hostObserver.observe(gameHost);
}
window.addEventListener('resize', queueViewportSync, { passive: true });
window.addEventListener('orientationchange', queueViewportSync, { passive: true });
window.visualViewport?.addEventListener('resize', queueViewportSync, { passive: true });
queueViewportSync();
