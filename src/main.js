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
 * Keeps the canvas the size of the space it is supposed to fill.
 *
 * RESIZE mode decides whether to re-scale by asking whether the parent's
 * measured size changed since it last looked. An orientation change can make
 * it look once — recording the new size — and then run its refresh against
 * the size it had before. The canvas is left at the previous orientation's
 * dimensions and nothing is left to correct it, because the next check sees
 * no further change. A phone or tablet rotated mid-mission then renders a
 * canvas hanging off the screen for the rest of the session.
 *
 * So the app checks the only thing that matters — does the rendered size
 * match the element it lives in — and asks for a refresh when it does not.
 * It is a no-op whenever the scale manager is already right, so it corrects
 * that race without fighting the scale manager for control of the canvas.
 */
const appElement = document.getElementById('app');
let syncFrame = null;

function syncViewportToParent() {
  syncFrame = null;
  if (!appElement || !game.scale) return;
  const rect = appElement.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  // A zero-sized parent means the page is mid-layout or the tab is hidden;
  // resizing to it would collapse the canvas.
  if (width < 1 || height < 1) return;
  const { gameSize } = game.scale;
  if (Math.abs(gameSize.width - width) <= 1 && Math.abs(gameSize.height - height) <= 1) return;
  game.scale.setParentSize(width, height);
}

function requestViewportSync() {
  if (syncFrame !== null) return;
  // Two frames out: an orientation change reports its new metrics over more
  // than one frame on mobile browsers, so measuring immediately can read the
  // size the device is leaving rather than the one it is arriving at.
  syncFrame = window.requestAnimationFrame(() => {
    syncFrame = window.requestAnimationFrame(syncViewportToParent);
  });
}

window.addEventListener('resize', requestViewportSync);
window.addEventListener('orientationchange', requestViewportSync);
window.screen?.orientation?.addEventListener?.('change', requestViewportSync);
// The visual viewport moves on its own when a mobile browser shows or hides
// its chrome, which never fires a window resize on some engines.
window.visualViewport?.addEventListener?.('resize', requestViewportSync);
if (typeof ResizeObserver === 'function' && appElement) {
  new ResizeObserver(requestViewportSync).observe(appElement);
}

// Automated QA hook. Opt-in through ?qa=1 only, so a player's session never
// carries a handle to the running game. The browser suite uses it to read
// which scene is live and to drive real controls at their real coordinates,
// which is the only way to play a generated mission to its debrief without
// the harness guessing where a target happens to have spawned.
if (new URLSearchParams(window.location.search).get('qa') === '1') {
  window.__ISPY_QA__ = game;
}
