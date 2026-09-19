import Phaser from 'phaser';
import './styles.css';
import { GAME_CONFIG } from './runtime-config.js';
import './settings/userSettings.js';
import BootScene from './scenes/BootScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import MissionBriefingScene from './scenes/MissionBriefingScene.js';
import EnhancedReconScene from './scenes/EnhancedReconScene.js';
import TrainingScene from './scenes/TrainingScene.js';
import IdentificationGuideScene from './scenes/IdentificationGuideScene.js';
import ResultsScene from './scenes/ResultsScene.js';

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
  scene: [BootScene, MainMenuScene, MissionBriefingScene, EnhancedReconScene, TrainingScene, IdentificationGuideScene, ResultsScene],
};

new Phaser.Game(config);
