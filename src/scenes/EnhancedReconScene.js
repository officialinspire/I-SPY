import ReconScene from './ReconScene.js';
import { GAME_CONFIG } from '../runtime-config.js';
import { feedback } from '../audio/feedback.js';
import { UI_TOKENS, hexToNumber } from '../ui/designTokens.js';
import { createPointerReticle, drawCandidateReticle } from '../ui/reconInteraction.js';
import { prefersReducedMotion } from '../ui/presentation.js';
import { getSettings } from '../settings/userSettings.js';

const MARKING_BANNERS = Object.freeze({
  marking: 'MARKING ACTIVE // TAP AN OBJECT',
  markingChange: 'CHANGE MARKING // TAP THE CHANGED OBJECT',
});

export default class EnhancedReconScene extends ReconScene {
  constructor() {
    super();
    this.lastCountdownSecond = null;
    this.analysisMode = 'analysis';
    this.lastStatusMessage = null;
    this.lastStatusAt = 0;
  }

  createHud() {
    super.createHud();
    this.reducedMotion = prefersReducedMotion();

    // Reticle that tracks the pointer while marking is armed. It never reacts
    // to what is underneath it, so sweeping it cannot reveal objects.
    this.pointerReticle = createPointerReticle(this, { depth: 960, color: UI_TOKENS.color.amber });

    this.markingBanner = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '11px',
      color: UI_TOKENS.text.attention,
      letterSpacing: 1,
    }).setOrigin(0.5, 0.5).setVisible(false);
    this.hud.add(this.markingBanner);

    // Grab/grabbing while navigating: the image reads as draggable before the
    // analyst has touched it. Presses that belong to a HUD control are skipped.
    this.input.on('pointerdown', () => {
      if (this.controlPressed || this.paused || this.analysisMode !== 'analysis') return;
      this.input.setDefaultCursor('grabbing');
    });
    this.input.on('pointerup', () => {
      if (this.paused || this.analysisMode !== 'analysis') return;
      this.input.setDefaultCursor('grab');
    });

    this.layoutChrome = this.add.graphics().setScrollFactor(0).setDepth(997);
    this.railLabel = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '9px',
      color: UI_TOKENS.color.phosphor,
      letterSpacing: 1,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1001);
    this.splitDivider = this.add.rectangle(0, 0, 3, 10, hexToNumber(UI_TOKENS.color.amber), 0.62)
      .setScrollFactor(0)
      .setDepth(1002)
      .setVisible(false);
    this.splitLeftLabel = this.add.text(0, 0, 'PASS A // EARLIER IMAGE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: UI_TOKENS.text.body,
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1004).setVisible(false);
    this.splitRightLabel = this.add.text(0, 0, 'PASS B // LATER IMAGE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: UI_TOKENS.text.attention,
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1004).setVisible(false);

    this.setAnalysisMode('analysis');
  }

  getUiObjects() {
    return [
      ...super.getUiObjects(),
      this.layoutChrome,
      this.railLabel,
      this.pointerReticle?.graphics,
    ].filter(Boolean);
  }

  /**
   * One place decides how the console looks in each interaction state:
   * analysis (navigating), marking (armed), selected (mark pending).
   */
  setAnalysisMode(mode) {
    this.analysisMode = mode;
    const marking = mode === 'marking' && !this.paused && !this.missionEnded;
    const selected = mode === 'selected';

    this.pointerReticle?.setActive(marking);
    this.hudBorder?.setFillStyle(hexToNumber(
      marking || selected ? UI_TOKENS.color.amber : UI_TOKENS.color.phosphorDim,
    ));

    if (this.markingBanner) {
      // Only the armed state gets a banner; once a mark exists the pending
      // buttons and the status line already say what to do next.
      const text = marking
        ? (this.isChangeMode ? MARKING_BANNERS.markingChange : MARKING_BANNERS.marking)
        : '';
      this.markingBanner.setText(text).setVisible(Boolean(text) && this.scale.gameSize.width >= 480);
    }

    let cursor = 'grab';
    if (marking) cursor = 'crosshair';
    else if (selected || this.paused) cursor = 'default';
    this.input.setDefaultCursor(cursor);
  }

  refreshAnalysisMode() {
    if (this.missionEnded) return;
    if (this.candidate) this.setAnalysisMode('selected');
    else if (this.marking) this.setAnalysisMode('marking');
    else this.setAnalysisMode('analysis');
  }

  armMarking() {
    super.armMarking();
    this.refreshAnalysisMode();
  }

  placeCandidate(pointer) {
    super.placeCandidate(pointer);
    this.refreshAnalysisMode();
  }

  cancelCandidate() {
    super.cancelCandidate();
    this.refreshAnalysisMode();
  }

  togglePause() {
    super.togglePause();
    if (this.paused) {
      this.pointerReticle?.setActive(false);
      this.input.setDefaultCursor('default');
    } else {
      this.refreshAnalysisMode();
    }
  }

  /**
   * Result feedback lands on the mark the analyst made and nowhere else, so a
   * wrong call never points at the objects around it.
   */
  onIdentificationResolved(result, mark) {
    this.setAnalysisMode('analysis');
    if (!mark || !this.selectionGraphics) {
      super.onIdentificationResolved(result, mark);
      return;
    }
    this.markerTone = result.correct ? 'confirmed' : 'rejected';
    const camera = mark.passId === 'B' && this.splitView && this.compareCamera
      ? this.compareCamera
      : this.cameras.main;
    drawCandidateReticle(this.selectionGraphics, mark.x, mark.y, camera.zoom, this.markerTone);
    this.resultFlashEvent?.remove(false);
    if (!result.correct) {
      this.resultFlashEvent = this.time.delayedCall(950, () => {
        if (this.missionEnded || this.candidate) return;
        this.markerTone = 'pending';
        this.selectionGraphics.clear();
      });
    }
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
    const now = this.time.now;
    if (normalized === this.lastStatusMessage && now - this.lastStatusAt < 320) return;
    this.lastStatusMessage = normalized;
    this.lastStatusAt = now;
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
    this.markingBanner?.setPosition(width / 2, 44);
    if (this.markingBanner?.text) this.markingBanner.setVisible(width >= 480);
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
    this.layoutChrome.lineStyle(1, hexToNumber(UI_TOKENS.surface.divider), UI_TOKENS.surface.dividerAlpha).lineBetween(0, hudHeight, width, hudHeight);

    if (railHeight > 0) {
      const railTop = height - railHeight;
      this.layoutChrome.fillStyle(hexToNumber(UI_TOKENS.color.steelDeep), 0.94).fillRect(0, railTop, railWidth, railHeight);
      this.layoutChrome.lineStyle(1, hexToNumber(UI_TOKENS.color.phosphorDim), 0.62).lineBetween(0, railTop, railWidth, railTop);
      this.railLabel.setText(railLabel).setPosition(12, railTop + 12).setVisible(width >= 420);
    } else {
      this.railLabel.setVisible(false);
    }

    if (this.isChangeMode && this.splitView) {
      const half = Math.floor(width / 2);
      const bottom = railHeight > 0 ? height - railHeight : height;
      this.splitDivider.setPosition(half, hudHeight + (bottom - hudHeight) / 2).setSize(3, Math.max(0, bottom - hudHeight)).setVisible(true);
      this.splitLeftLabel.setPosition(half * 0.5, hudHeight + 20).setVisible(true);
      this.splitRightLabel.setPosition(half + (width - half) * 0.5, hudHeight + 20).setVisible(true);
      this.passStatusText?.setPosition(half * 0.5, hudHeight + 50);
    } else {
      this.splitDivider.setVisible(false);
      this.splitLeftLabel.setVisible(false);
      this.splitRightLabel.setVisible(false);
    }
  }

  finishMission(success) {
    this.pointerReticle?.setActive(false);
    this.markingBanner?.setVisible(false);
    this.input.setDefaultCursor('default');
    super.finishMission(success);
  }

  cleanup() {
    this.countdownFeedbackEvent?.remove(false);
    this.resultFlashEvent?.remove(false);
    this.pointerReticle?.destroy();
    this.input.setDefaultCursor('default');
    super.cleanup();
  }
}
