import Phaser from 'phaser';
import './styles.css';
import { GAME_CONFIG } from './runtime-config.js';
import { registerOfflineSupport } from './pwa/registerServiceWorker.js';
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
registerOfflineSupport();

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
      /**
       * Every live interactive control, as a viewport rectangle.
       *
       * Two of these must never overlap and none may sit outside the viewport.
       * Where two hit areas share a pixel the object drawn last wins it, so an
       * overlap means a press on one control silently runs another — which is
       * exactly how a phone-sized rail stops working while still looking fine.
       */
      touchTargets: () => {
        const { width, height } = game.scale.gameSize;
        const targets = [];
        game.scene.getScenes(true).forEach((scene) => {
          scene.children?.list?.forEach((object) => {
            if (!object.visible || object.alpha === 0) return;
            const area = object.input?.enabled ? object.input.hitArea : null;
            if (!area || !Number.isFinite(area.width) || !Number.isFinite(area.height)) return;
            const rect = {
              scene: scene.scene.key,
              name: object.name || object.type,
              x: object.x - object.displayOriginX + area.x,
              y: object.y - object.displayOriginY + area.y,
              width: area.width,
              height: area.height,
            };
            // Modal backdrops are meant to swallow the whole viewport.
            if (rect.width * rect.height >= width * height * 0.8) return;
            targets.push(rect);
          });
        });
        return { width, height, targets };
      },
      reconState: () => {
        const scene = game.scene.getScene('Recon');
        const camera = scene?.cameras?.main;
        return scene && camera ? {
          zoom: camera.zoom,
          scrollX: camera.scrollX,
          scrollY: camera.scrollY,
          marking: Boolean(scene.marking),
          candidate: Boolean(scene.candidate),
          pinchActive: Boolean(scene.pinchGesture),
          pinchPointerIds: scene.pinchGesture?.pointerIds ? [...scene.pinchGesture.pointerIds] : [],
          activeMapPointers: scene.mapPointersDown?.().map((pointer) => pointer.id) ?? [],
          completedTargets: scene.completedTargetIds?.length ?? 0,
          requiredTargets: scene.locateTargets?.length ?? 0,
        } : null;
      },
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
    // ScaleManager can update its logical gameSize before the browser-applied
    // CSS canvas box catches up during tablet/mobile rotation. In that state a
    // gameSize-only comparison incorrectly says everything is current while
    // the player still sees the old landscape canvas. Make the host box the
    // final authority for the displayed canvas as well.
    const canvasRect = canvas.getBoundingClientRect();
    if (Math.abs(canvasRect.width - width) > 1) canvas.style.width = `${width}px`;
    if (Math.abs(canvasRect.height - height) > 1) canvas.style.height = `${height}px`;
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
