import Phaser from 'phaser';
import EnhancedReconScene from './EnhancedReconScene.js';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { UI_TOKENS, hexToNumber } from '../ui/designTokens.js';
import { updateSettings } from '../settings/userSettings.js';
import { TRAINING_MAP_ID } from '../world/mapRegistry.js';
import {
  TRAINING_STEP_COUNT,
  clampTrainingStep,
  createTrainingMission,
  createTrainingScript,
  trainingModeForStep,
} from '../game/trainingMissions.js';

/**
 * ANALYST TRAINING.
 *
 * The tutorial is the recon console, not a copy of it: this scene extends the
 * one that flies live taskings, so MARK / CANCEL / CONFIRM, the tally
 * steppers, the pass segments and split view all behave exactly as they will
 * in a real mission. What it changes is the frame around them — no clock, no
 * score, no generation, and a step panel that will not advance until the
 * trainee has actually done the thing the step teaches.
 */
export default class TrainingScene extends EnhancedReconScene {
  constructor() { super('Training'); }

  create(data = {}) {
    this.step = clampTrainingStep(data.step ?? 0);
    this.script = createTrainingScript(TRAINING_MAP_ID);
    this.progress = new Set();
    super.create({ mission: createTrainingMission(this.step, TRAINING_MAP_ID) });
    this.applyStep();
  }

  currentStep() { return this.script[this.step] ?? this.script[0]; }

  isFinalStep() { return this.step === TRAINING_STEP_COUNT - 1; }

  stepRequires(id) { return (this.currentStep().requires ?? []).some((requirement) => requirement.id === id); }

  stepSatisfied() { return (this.currentStep().requires ?? []).every((requirement) => this.progress.has(requirement.id)); }

  // --- no clock, no score -------------------------------------------------

  /** Training is untimed, so there is no timer to start and none to count down. */
  startMissionTimer() {
    this.timerText?.setText('TRAINING').setColor(UI_TOKENS.text.attention);
  }

  /**
   * A lesson finishing is not a mission finishing. The console stays live so
   * the trainee can keep practising, and nothing is scored on the way out.
   */
  finishMission() {
    const lesson = this.isCountMode ? 'count' : (this.isChangeMode ? 'change' : 'mark');
    this.missionEnded = false;
    this.resolvingIdentification = false;
    this.falseIdentifications = 0;
    this.incorrectSubmissions = 0;
    this.refreshModeStrip();
    this.refreshAnalysisMode();
    this.recordProgress(lesson);
  }

  // --- progress the step panel waits on -----------------------------------

  recordProgress(id) {
    if (!this.stepRequires(id) || this.progress.has(id)) return;
    this.progress.add(id);
    this.refreshPanel();
    if (this.stepSatisfied()) this.flashStatus('STEP COMPLETE · PRESS NEXT');
  }

  bindInput() {
    super.bindInput();
    // The base scene has already updated its drag bookkeeping by the time this
    // runs, so a real pan — not a tap that wandered — is what gets credited.
    this.input.on('pointermove', () => {
      if (this.dragging && !this.paused && (this.tapPointer?.travel ?? 0) >= 28) this.recordProgress('pan');
    });
  }

  zoomAt(screenPoint, delta) {
    const before = this.cameras.main.zoom;
    super.zoomAt(screenPoint, delta);
    if (Math.abs(this.cameras.main.zoom - before) > 0.0001) this.recordProgress('zoom');
  }

  resetView() {
    super.resetView();
    this.recordProgress('reset');
  }

  setActivePass(passId, showMessage = true) {
    super.setActivePass(passId, showMessage);
    if (this.activePass === 'B') this.recordProgress('pass');
  }

  enableSplitView() {
    super.enableSplitView();
    // Split view shows both passes at once, which is the lesson either way.
    if (this.splitView) this.recordProgress('pass');
  }

  /**
   * Nothing in training is counted against the trainee, so the strip never
   * carries a FALSE ID or REJECTED tally to read as one.
   */
  refreshModeStrip() {
    super.refreshModeStrip();
    if (!this.modeDetail || !this.modeChip) return;
    const detail = this.isChangeMode ? `PASS ${this.activePass}` : '';
    this.modeDetail.setText(detail).setColor(UI_TOKENS.text.muted);
    const detailX = this.modeChip.x + this.modeChip.width + 10;
    this.modeDetail.setPosition(detailX, this.modeDetail.y);
    if (this.coordText) this.coordText.setPosition(detail ? detailX + this.modeDetail.width + 12 : detailX, this.coordText.y);
  }

  /** Training records no penalties: a wrong call is coached and cleared. */
  confirmCandidate() {
    const before = this.falseIdentifications;
    super.confirmCandidate();
    if (this.falseIdentifications <= before) return;
    this.falseIdentifications = 0;
    this.refreshModeStrip();
    this.flashStatus(this.isChangeMode
      ? 'NOT THE ONE THAT MOVED · COMPARE THE PASSES AND TRY AGAIN'
      : 'NOT THE TRAINING TARGET · MARK AGAIN');
  }

  submitCount() {
    const before = this.incorrectSubmissions;
    super.submitCount();
    if (this.incorrectSubmissions <= before) return;
    this.incorrectSubmissions = 0;
    this.refreshModeStrip();
    this.flashStatus('NOT YET · COUNT ONLY MILITARY VEHICLES INSIDE THE BRACKET');
  }

  // --- camera -------------------------------------------------------------

  /** A step may frame its own lesson; otherwise the mission's framing stands. */
  resetCamera(showMessage = true) {
    const view = this.currentStep()?.view;
    if (!view) {
      super.resetCamera(showMessage);
      return;
    }
    this.cameras.main.setZoom(Phaser.Math.Clamp(view.zoom ?? GAME_CONFIG.recon.defaultZoom,
      this.minZoomForViewport(), GAME_CONFIG.recon.maxZoom));
    this.cameras.main.centerOn(view.x, view.y);
    if (this.isChangeMode && this.splitView) this.syncChangeCameras(this.cameras.main);
    if (showMessage) this.flashStatus('VIEW RECENTERED');
  }

  // --- the step panel -----------------------------------------------------

  createHud() {
    super.createHud();
    this.createAnnotation();
    this.createTrainingPanel();
  }

  createAnnotation() {
    // World-space brackets, so the callout stays on the object through every
    // pan and zoom. It is an instructor's annotation, not a target glow: it
    // only ever appears on the one object a step is talking about.
    this.annotationGraphics = this.add.graphics().setDepth(955);
  }

  createTrainingPanel() {
    this.panelGraphics = this.add.graphics().setScrollFactor(0).setDepth(1020);
    const text = (size, color, letterSpacing = 1) => this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: `${size}px`,
      color,
      letterSpacing,
      lineSpacing: 4,
    }).setScrollFactor(0).setDepth(1021);

    this.panelStep = text(9, UI_TOKENS.text.faint, 2);
    this.panelTitle = text(14, UI_TOKENS.text.attention, 2);
    this.panelBody = text(11, UI_TOKENS.text.body);
    this.panelChecklist = text(10, UI_TOKENS.text.muted);

    this.nextButton = createButton(this, 0, 0, 'NEXT', () => this.advance(), { width: 110, height: 34, fontSize: 12, variant: 'primary' });
    this.skipButton = createButton(this, 0, 0, 'SKIP TUTORIAL', () => this.skipTutorial(), { width: 128, height: 34, fontSize: 10, variant: 'secondary' });
    this.menuButton = createButton(this, 0, 0, 'BACK TO MENU', () => this.backToMenu(), { width: 128, height: 34, fontSize: 10, variant: 'secondary' });
    this.panelButtons = [this.nextButton, this.skipButton, this.menuButton];
    this.panelButtons.forEach((button) => button.setScrollFactor(0).setDepth(1022));
  }

  /** The tutorial's own panel stands down behind the hold screen as well. */
  holdableButtons() {
    return [...super.holdableButtons(), ...(this.panelButtons ?? [])];
  }

  /**
   * Standing down from training keeps the analyst's place in it, the same
   * way BACK TO MENU does — the lesson is not an attempt to be discarded.
   */
  abortMission() {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.timerEvent?.remove(false);
    this.setPauseMenuVisible(false);
    this.backToMenu();
  }

  getUiObjects() {
    const objects = [...super.getUiObjects(), this.panelGraphics, this.panelStep, this.panelTitle,
      this.panelBody, this.panelChecklist];
    (this.panelButtons ?? []).forEach((button) => objects.push(...button.getObjects()));
    return objects.filter(Boolean);
  }

  getWorldObjects() {
    return [...super.getWorldObjects(), this.annotationGraphics].filter(Boolean);
  }

  /** A press on the step panel belongs to the panel, never to the imagery. */
  isHudPoint(pointer) {
    if (super.isHudPoint(pointer)) return true;
    const box = this.panelBox;
    if (!box) return false;
    return pointer.x >= box.left && pointer.x <= box.left + box.width
      && pointer.y >= box.top && pointer.y <= box.top + box.height;
  }

  // --- step transitions ---------------------------------------------------

  applyStep() {
    if (this.isFinalStep()) updateSettings({ tutorialCompleted: true, tutorialStep: 0 });
    else updateSettings({ tutorialStep: this.step });
    // The HUD states the lesson, not the mission: steps that share a mission
    // still each say what they are for.
    const objective = this.currentStep().objective;
    if (objective) this.objectiveText?.setText(objective);
    if (this.isFinalStep()) this.settleForCertification();
    this.resetCamera(false);
    this.drawAnnotation();
    this.refreshPanel();
    this.onResize(this.scale.gameSize);
    this.flashStatus(`TRAINING STEP ${this.step + 1} OF ${TRAINING_STEP_COUNT} · ${this.currentStep().title}`);
  }

  /**
   * The lessons are over on the certification step, so the console stands
   * down: no pending mark to read in the strip, and no live mission controls
   * under a card that says the training is finished.
   */
  settleForCertification() {
    this.marking = false;
    this.candidate = null;
    this.selectionGraphics?.clear();
    this.confirmButton?.setVisible(false);
    this.cancelButton?.setVisible(false);
    this.markButton?.setSelected(false);
    this.missionEnded = true;
    this.setMissionControlsEnabled(false);
    this.pointerReticle?.setActive(false);
    this.input.setDefaultCursor('default');
    this.refreshModeStrip();
  }

  advance() {
    if (!this.stepSatisfied()) return;
    if (this.isFinalStep()) {
      this.returnToMenu(true);
      return;
    }
    const next = this.step + 1;
    // Only a change of mode needs the world rebuilt; steps that share a
    // mission share the scene, so navigation and marking never reload.
    if (trainingModeForStep(next) !== trainingModeForStep(this.step)) {
      this.scene.start('Training', { step: next });
      return;
    }
    this.step = next;
    this.progress.clear();
    this.applyStep();
  }

  /** Leave and do not resume: the console stops offering to pick up where it was. */
  skipTutorial() {
    updateSettings({ tutorialStep: 0 });
    this.returnToMenu(false);
  }

  /** Leave but keep the place, so ANALYST TRAINING can resume at this step. */
  backToMenu() {
    if (!this.isFinalStep()) updateSettings({ tutorialStep: this.step });
    this.returnToMenu(false);
  }

  returnToMenu(certified) {
    if (certified) updateSettings({ tutorialCompleted: true, tutorialStep: 0 });
    this.scene.start('MainMenu');
  }

  drawAnnotation() {
    if (!this.annotationGraphics) return;
    this.annotationGraphics.clear();
    const id = this.currentStep().annotate;
    if (!id) return;
    const entity = (this.entities ?? []).find((item) => item.id === id);
    if (!entity) return;

    const pad = 18;
    const left = entity.x - pad;
    const top = entity.y - pad;
    const right = entity.x + entity.width + pad;
    const bottom = entity.y + entity.height + pad;
    const arm = Math.min(28, Math.min(right - left, bottom - top) * 0.34);
    this.annotationGraphics.lineStyle(3, hexToNumber(UI_TOKENS.color.amber), 0.95);
    [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]
      .forEach(([x, y, sx, sy]) => {
        this.annotationGraphics.lineBetween(x, y, x + arm * sx, y);
        this.annotationGraphics.lineBetween(x, y, x, y + arm * sy);
      });
  }

  refreshPanel() {
    if (!this.panelTitle) return;
    const step = this.currentStep();
    this.panelStep.setText(this.isFinalStep()
      ? 'ANALYST TRAINING · COMPLETE'
      : `ANALYST TRAINING · STEP ${this.step + 1} OF ${TRAINING_STEP_COUNT}`);
    this.panelTitle.setText(step.title);
    this.panelBody.setText((step.body ?? []).join('\n'));
    this.panelChecklist.setText((step.requires ?? [])
      .map((requirement) => `${this.progress.has(requirement.id) ? '[✓]' : '[ ]'} ${requirement.label}`)
      .join('\n'));

    const satisfied = this.stepSatisfied();
    this.nextButton.setLabel(this.isFinalStep() ? 'RETURN TO MAIN MENU' : 'NEXT').setEnabled(satisfied);
    this.skipButton.setVisible(!this.isFinalStep());
    this.menuButton.setVisible(!this.isFinalStep());
  }

  layoutTrainingPanel(width, height) {
    if (!this.panelGraphics) return;
    const hudHeight = GAME_CONFIG.recon.hudHeight;
    const rail = this.railHeight(width);
    const top = hudHeight + 12;
    const floor = height - (rail > 0 ? rail + 12 : 16);
    const available = Math.max(90, floor - top);
    const compact = width < 680;
    const final = this.isFinalStep();

    // Short landscape has almost no room between the HUD and the rail, so the
    // panel drops its prose and shows the step and what is still outstanding.
    const dense = !final && available < 238;
    const padding = compact ? 12 : 14;
    const panelWidth = final
      ? Math.min(560, width - 32)
      : (compact ? width - 24 : Math.min(392, Math.max(300, width * 0.32)));
    const innerWidth = panelWidth - padding * 2;

    this.panelBody.setFontSize(compact ? 10 : 11).setWordWrapWidth(innerWidth).setVisible(!dense);
    this.panelChecklist.setFontSize(compact ? 9 : 10).setWordWrapWidth(innerWidth)
      .setVisible(this.panelChecklist.text.length > 0);
    this.panelTitle.setFontSize(final ? 17 : (compact ? 12 : 14));

    const buttonHeight = compact || dense ? 32 : 34;
    const gap = 8;
    const bodyHeight = dense ? 0 : this.panelBody.height + 10;
    const listHeight = this.panelChecklist.visible ? this.panelChecklist.height + 10 : 0;
    const panelHeight = padding + this.panelStep.height + 6 + this.panelTitle.height + 10
      + bodyHeight + listHeight + buttonHeight + padding;

    const left = final ? Math.round(width / 2 - panelWidth / 2) : (compact ? 12 : 16);
    const panelTop = final
      ? Math.round(Math.max(top, top + (available - panelHeight) / 2))
      : Math.round(Math.min(top, Math.max(top, floor - panelHeight)));
    this.panelBox = { left, top: panelTop, width: panelWidth, height: panelHeight };

    this.panelGraphics.clear();
    this.panelGraphics.fillStyle(hexToNumber(UI_TOKENS.color.panel), 0.97)
      .fillRect(left, panelTop, panelWidth, panelHeight);
    this.panelGraphics.lineStyle(2, hexToNumber(UI_TOKENS.color.amber), 0.72)
      .strokeRect(left, panelTop, panelWidth, panelHeight);

    let cursor = panelTop + padding;
    this.panelStep.setPosition(left + padding, cursor);
    cursor += this.panelStep.height + 6;
    this.panelTitle.setPosition(left + padding, cursor);
    cursor += this.panelTitle.height + 10;
    if (!dense) {
      this.panelBody.setPosition(left + padding, cursor);
      cursor += this.panelBody.height + 10;
    }
    if (this.panelChecklist.visible) {
      this.panelChecklist.setPosition(left + padding, cursor);
      cursor += this.panelChecklist.height + 10;
    }

    const rowY = cursor + buttonHeight / 2;
    if (final) {
      this.nextButton.resize({ width: Math.min(280, innerWidth), height: buttonHeight, fontSize: 13 })
        .setPosition(left + panelWidth / 2, rowY);
      return;
    }
    const slot = (innerWidth - gap * 2) / 3;
    const buttonFont = slot < 108 ? 9 : 10;
    this.nextButton.resize({ width: slot, height: buttonHeight, fontSize: Math.max(11, buttonFont + 2) })
      .setPosition(left + padding + slot / 2, rowY);
    this.skipButton.resize({ width: slot, height: buttonHeight, fontSize: buttonFont })
      .setPosition(left + padding + slot * 1.5 + gap, rowY);
    this.menuButton.resize({ width: slot, height: buttonHeight, fontSize: buttonFont })
      .setPosition(left + padding + slot * 2.5 + gap * 2, rowY);
  }

  onResize(gameSize) {
    super.onResize(gameSize);
    if (!this.panelGraphics) return;
    const { width, height } = gameSize;
    this.layoutTrainingPanel(width, height);
    // The recon status line sits over the rail; in training the panel owns the
    // left of the workspace, so the line moves clear of it.
    const box = this.panelBox;
    if (box && !this.isFinalStep() && width >= 680) {
      this.statusText?.setX(Math.min(width - 20, box.left + box.width + (width - box.left - box.width) / 2));
    }
  }

  cleanup() {
    this.annotationGraphics?.destroy();
    super.cleanup();
  }
}
