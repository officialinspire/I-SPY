import ReconScene from './ReconScene.js';
import { GAME_CONFIG } from '../runtime-config.js';
import { feedback } from '../audio/feedback.js';
import { UI_TOKENS, hexToNumber } from '../ui/designTokens.js';
import { createPointerReticle, drawCandidateReticle } from '../ui/reconInteraction.js';
import { prefersReducedMotion } from '../ui/presentation.js';
import { getSettings } from '../settings/userSettings.js';

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

    // Brief opaque wipe when the analyst switches pass. It never shows A and
    // B together, so it cannot make the difference easier to spot.
    this.passWipe = this.add.rectangle(0, 0, 10, 10, hexToNumber(UI_TOKENS.color.black), 1)
      .setOrigin(0).setScrollFactor(0).setDepth(940).setVisible(false);

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
    this.splitLeftLabel = this.add.text(0, 0, `PASS A \u00b7 ${this.mission.passA?.time ?? 'EARLIER'}`, {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: UI_TOKENS.text.positiveBright,
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1004).setVisible(false);
    this.splitRightLabel = this.add.text(0, 0, `PASS B \u00b7 ${this.mission.passB?.time ?? 'LATER'}`, {
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
      this.passWipe,
      this.splitDivider,
      this.splitLeftLabel,
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

  /** Pass switch: mask the swap, never blend the two passes. */
  onPassSwitched() {
    if (!this.passWipe) return;
    const { width, height } = this.scale.gameSize;
    this.passWipe.setSize(width, height).setPosition(0, 0);
    this.passWipeTween?.remove();
    if (prefersReducedMotion()) {
      this.passWipe.setVisible(false);
      return;
    }
    this.passWipe.setAlpha(0.95).setVisible(true);
    this.passWipeTween = this.tweens.add({
      targets: this.passWipe,
      alpha: 0,
      duration: 170,
      ease: 'Sine.easeOut',
      onComplete: () => this.passWipe.setVisible(false),
    });
  }

  /**
   * A rejected tally is acknowledged on the readout itself: no dialog, no
   * camera move, nothing that interrupts inspection. The readout holds the
   * rejected state until the analyst changes the number, which is calmer than
   * a flash and still says exactly which total was refused.
   */
  onCountRejected() {
    if (!this.tallyFrame) return;
    this.countRejected = true;
    // A near-black red fill would vanish against the rail, so the block itself
    // carries the muted red and the number flips to off-white on top of it.
    this.tallyFrame.setFillStyle(hexToNumber(UI_TOKENS.color.rust), 0.9)
      .setStrokeStyle(3, hexToNumber(UI_TOKENS.color.rustBright));
    this.answerText?.setColor(UI_TOKENS.text.primary);
  }

  clearCountRejection() {
    if (!this.countRejected) return;
    this.countRejected = false;
    this.tallyFrame?.setFillStyle(hexToNumber(UI_TOKENS.color.black), 0.92)
      .setStrokeStyle(2, hexToNumber(UI_TOKENS.color.phosphorDim));
    this.answerText?.setColor(UI_TOKENS.text.positiveBright);
  }

  /** Every route to a new total (buttons, arrows, digits) clears it. */
  setAnswer(value) {
    const previous = this.answerValue;
    super.setAnswer(value);
    if (this.answerValue !== previous) this.clearCountRejection();
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
    const compact = width < 680;
    const hudHeight = GAME_CONFIG.recon.hudHeight;
    const railHeight = this.railHeight(width);
    let railWidth = width;
    let railLabel = '';

    if (this.isCountMode) railLabel = 'COUNT CONSOLE';
    else if (this.isChangeMode) {
      railWidth = this.splitView ? Math.floor(width / 2) : width;
      railLabel = this.splitView ? 'PASS A DECK' : 'CHANGE CONSOLE';
    } else if (compact) railLabel = 'TARGETING CONSOLE';

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
      this.splitDivider.setPosition(half, hudHeight + (bottom - hudHeight) / 2)
        .setSize(3, Math.max(0, bottom - hudHeight)).setVisible(true);

      // Instrument ticks along the divider read as a comparator rather than a
      // bar dropped between two pictures.
      this.layoutChrome.lineStyle(1, hexToNumber(UI_TOKENS.color.amber), 0.55);
      for (let y = hudHeight + 24; y < bottom - 12; y += 42) {
        this.layoutChrome.lineBetween(half - 8, y, half - 3, y);
        this.layoutChrome.lineBetween(half + 3, y, half + 8, y);
      }
      const mid = hudHeight + (bottom - hudHeight) / 2;
      this.layoutChrome.lineStyle(2, hexToNumber(UI_TOKENS.color.amber), 0.9);
      this.layoutChrome.strokeTriangle(half - 9, mid, half - 2, mid - 6, half - 2, mid + 6);
      this.layoutChrome.strokeTriangle(half + 9, mid, half + 2, mid - 6, half + 2, mid + 6);

      this.splitLeftLabel.setPosition(half * 0.5, hudHeight + 20).setVisible(true);
      // The compare camera redraws screen-space objects inside its own
      // viewport, so the right-hand label is owned by that camera alone and is
      // positioned in its local space. Otherwise both panes label themselves A.
      this.splitRightLabel.setPosition((width - half) * 0.5, hudHeight + 20).setVisible(true);
      this.cameras.main.ignore(this.splitRightLabel);
      this.passStatusText?.setPosition(half * 0.5, hudHeight + 48);
    } else {
      this.splitDivider.setVisible(false);
      this.splitLeftLabel.setVisible(false);
      this.splitRightLabel.setVisible(false);
      this.splitRightLabel.cameraFilter = 0;
    }
  }

  finishMission(success) {
    this.pointerReticle?.setActive(false);
    this.input.setDefaultCursor('default');
    super.finishMission(success);
  }

  cleanup() {
    this.countdownFeedbackEvent?.remove(false);
    this.resultFlashEvent?.remove(false);
    this.passWipeTween?.remove();
    this.pointerReticle?.destroy();
    this.input.setDefaultCursor('default');
    super.cleanup();
  }
}
