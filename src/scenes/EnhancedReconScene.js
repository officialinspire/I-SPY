import ReconScene from './ReconScene.js';
import { GAME_CONFIG } from '../runtime-config.js';
import { feedback } from '../audio/feedback.js';
import { getSettings } from '../settings/userSettings.js';

export default class EnhancedReconScene extends ReconScene {
  constructor() {
    super();
    this.lastCountdownSecond = null;
  }

  createHud() {
    super.createHud();
    this.layoutChrome = this.add.graphics().setScrollFactor(0).setDepth(997);
    this.railLabel = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '9px',
      color: GAME_CONFIG.palette.gray,
      letterSpacing: 1,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1001);
    this.splitLeftLabel = this.add.text(0, 0, 'PASS A // EARLIER IMAGE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: GAME_CONFIG.palette.offWhite,
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1004).setVisible(false);
    this.splitRightLabel = this.add.text(0, 0, 'PASS B // LATER IMAGE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: GAME_CONFIG.palette.offWhite,
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1004).setVisible(false);
  }

  getUiObjects() {
    return [
      ...super.getUiObjects(),
      this.layoutChrome,
      this.railLabel,
      this.splitLeftLabel,
      this.splitRightLabel,
    ].filter(Boolean);
  }

  startMissionTimer() {
    super.startMissionTimer();
    this.countdownFeedbackEvent = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        if (this.paused || this.missionEnded) return;
        const second = Math.ceil(this.remainingSeconds);
        if (second > 0 && second <= 10 && second !== this.lastCountdownSecond) {
          this.lastCountdownSecond = second;
          feedback('countdown', 6);
        }
      },
    });
  }

  flashStatus(message) {
    super.flashStatus(message);
    const normalized = String(message ?? '').toUpperCase();
    if (normalized.includes('UNVERIFIED') || normalized.includes('FALSE ID')) {
      feedback('error', [18, 26, 18]);
    } else if (normalized.includes('CONFIRMED')) {
      feedback('confirm', [12, 18, 20]);
    } else if (normalized.includes('MARKING ACTIVE')) {
      feedback('mark', 10);
    } else if (normalized.includes('PASS A ACQUIRED') || normalized.includes('PASS B ACQUIRED')) {
      feedback('acquire', 8);
    }
  }

  redrawAtmosphere(width, height) {
    if (getSettings().imageGrainEnabled || !this.mission?.visualModifiers) {
      super.redrawAtmosphere(width, height);
      return;
    }
    const original = this.mission.visualModifiers;
    this.mission.visualModifiers = { ...original, grain: 0 };
    super.redrawAtmosphere(width, height);
    this.mission.visualModifiers = original;
  }

  onResize(gameSize) {
    super.onResize(gameSize);
    if (!this.layoutChrome) return;

    const { width, height } = gameSize;
    const compact = width < 680;
    const hudHeight = GAME_CONFIG.recon.hudHeight;
    let railHeight = 0;
    let railWidth = width;
    let railLabel = '';

    if (this.isCountMode) {
      railHeight = compact ? 112 : 66;
      railLabel = 'COUNT CONSOLE // ADJUST TOTAL AND SUBMIT';
    } else if (this.isChangeMode) {
      railHeight = compact ? 128 : 72;
      railWidth = this.splitView ? Math.floor(width / 2) : width;
      railLabel = this.splitView ? 'CHANGE CONSOLE // PASS A CONTROL DECK' : 'CHANGE CONSOLE // COMPARE AND MARK';
    } else if (compact) {
      railHeight = 66;
      railLabel = 'TARGETING CONSOLE';
    }

    this.layoutChrome.clear();
    this.layoutChrome.lineStyle(1, 0xbdbdbd, 0.22).lineBetween(0, hudHeight, width, hudHeight);

    if (railHeight > 0) {
      const railTop = height - railHeight;
      this.layoutChrome.fillStyle(0x0b0b0b, 0.94).fillRect(0, railTop, railWidth, railHeight);
      this.layoutChrome.lineStyle(1, 0xbdbdbd, 0.34).lineBetween(0, railTop, railWidth, railTop);
      this.railLabel.setText(railLabel).setPosition(12, railTop + 12).setVisible(width >= 420);
    } else {
      this.railLabel.setVisible(false);
    }

    if (this.isChangeMode && this.splitView) {
      const half = Math.floor(width / 2);
      const bottom = railHeight > 0 ? height - railHeight : height;
      this.layoutChrome.lineStyle(2, 0xf6f6ee, 0.62).lineBetween(half, hudHeight, half, bottom);
      this.layoutChrome.fillStyle(0x0b0b0b, 0.34).fillRect(half - 2, hudHeight, 4, Math.max(0, bottom - hudHeight));
      this.splitLeftLabel.setPosition(half * 0.5, hudHeight + 20).setVisible(true);
      this.splitRightLabel.setPosition(half + (width - half) * 0.5, hudHeight + 20).setVisible(true);
      this.passStatusText?.setPosition(half * 0.5, hudHeight + 50);
    } else {
      this.splitLeftLabel.setVisible(false);
      this.splitRightLabel.setVisible(false);
    }
  }

  cleanup() {
    this.countdownFeedbackEvent?.remove(false);
    super.cleanup();
  }
}
