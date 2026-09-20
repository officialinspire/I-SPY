import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { UI_TOKENS, hexToNumber, hitGap } from '../ui/designTokens.js';
import { createAuthoredReconMap, applyReconOperations, entityNearPoint } from '../world/authoredReconMap.js';
import { drawCandidateReticle } from '../ui/reconInteraction.js';
import { oncePerKeyEvent } from '../ui/keyboardEvents.js';
import { createLocateMission, validateIdentification, calculateLocateScore } from '../game/locateMission.js';
import { validateCountAnswer, calculateCountScore } from '../game/countMission.js';
import { validateChangeIdentification, calculateChangeScore } from '../game/changeDetectionMission.js';
import { assessMissionPerformance, applyPerformanceBonus } from '../game/missionPerformance.js';
import { musicManager, MUSIC_STATES } from '../audio/musicManager.js';
import { createWeatherOverlay as createMissionWeatherOverlay } from '../ui/weatherOverlay.js';

export default class ReconScene extends Phaser.Scene {
  /** Subclasses that are a different scene (ANALYST TRAINING) pass their own key. */
  constructor(key = 'Recon') { super(key); }

  create(data = {}) {
    musicManager.request(MUSIC_STATES.GAMEPLAY);
    this.mission = data.mission ?? createLocateMission();
    this.isCountMode = this.mission.mode === 'COUNT';
    this.isChangeMode = this.mission.mode === 'CHANGE';
    this.debugMission = new URLSearchParams(window.location.search).get('debugMission') === '1';
    this.falseIdentifications = 0;
    this.incorrectSubmissions = 0;
    this.answerValue = 0;
    this.remainingSeconds = this.mission.timeLimitSeconds;
    this.missionStartedAt = this.time.now;
    // Phaser reuses this Scene instance. Pause accounting belongs to one
    // mission attempt only; carrying it forward makes the next timer start
    // above its configured limit and inflates its time bonus.
    this.totalPausedMs = 0;
    this.pauseStartedAt = null;
    this.missionEnded = false;
    // Scene instances are reused by Phaser. These guards must reset for every
    // mission or a successful identification from the previous run can make
    // CONFIRM a permanent no-op on the next one.
    this.resolvingIdentification = false;
    this.marking = false;
    this.candidate = null;
    this.completedTargetIds = [];
    this.locateTargets = (!this.isCountMode && !this.isChangeMode)
      ? (Array.isArray(this.mission.targets) && this.mission.targets.length
        ? this.mission.targets.map((target) => ({ id: target.id, label: target.label }))
        : [{ id: this.mission.targetId, label: this.mission.targetLabel }].filter((target) => target.id))
      : [];
    this.activePass = 'A';
    this.splitView = false;
    this.compareCamera = null;

    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.createWorldState();
    this.cameras.main.setBounds(0, 0, this.map.width, this.map.height);
    this.resetCamera(false);
    this.createHud();
    this.createGridOverlay();
    this.createMissionOverlay();
    this.createAtmosphereOverlay();
    this.createWeatherOverlay();
    this.createSelectionOverlay();
    this.createUiCamera();
    this.bindInput();
    this.startMissionTimer();
    this.time.delayedCall(450, () => {
      if (!this.missionEnded && !this.paused) this.flashStatus('DRAG TO PAN // PINCH OR WHEEL TO ZOOM');
    });

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.cleanup());
    this.onResize(this.scale.gameSize);
  }

  createWorldState() {
    const commonOperations = this.mission.worldOperations ?? [];
    // The mission names its sector; the scene builds that one, not a default.
    const mapSource = this.mission.mapId;
    if (this.isChangeMode) {
      this.worldA = createAuthoredReconMap(this, mapSource);
      this.worldB = createAuthoredReconMap(this, mapSource);
      applyReconOperations(this, this.worldA, commonOperations);
      applyReconOperations(this, this.worldB, commonOperations);
      applyReconOperations(this, this.worldB, this.mission.passBOperations ?? []);
      this.worldB.root.setVisible(false);
      this.worldLayer = this.worldA.root;
      this.map = this.worldA.map;
      this.entities = this.worldA.entities;
      this.passEntities = { A: this.worldA.entities, B: this.worldB.entities };
      this.spawnZones = this.worldA.spawnZones;
      this.mapMetadata = this.worldA.metadata;
      this.applyGeneratedContrast([this.worldA.root, this.worldB.root]);
      return;
    }

    const world = createAuthoredReconMap(this, mapSource);
    applyReconOperations(this, world, commonOperations);
    this.worldLayer = world.root;
    this.map = world.map;
    this.entities = world.entities;
    this.spawnZones = world.spawnZones;
    this.mapMetadata = world.metadata;
    this.applyGeneratedContrast([world.root]);
  }

  applyGeneratedContrast(roots) {
    const contrast = Phaser.Math.Clamp(this.mission.visualModifiers?.contrast ?? 1, 0.82, 1);
    roots.forEach((root) => root?.setAlpha(contrast));
  }

  createHud() {
    // The scene instance is reused from one mission to the next, so anything
    // a previous mode built has to be forgotten before this one builds its
    // own. Its game objects went with the previous run, and every list that
    // walks all three modes — setMissionControlsEnabled, getUiObjects — would
    // otherwise still be holding them.
    this.locateButtons = null;
    this.countButtons = null;
    this.changeButtons = null;
    this.tallyFrame = null;
    this.answerText = null;
    this.adjustCaption = null;
    this.submitCaption = null;
    this.passCaption = null;
    this.passStatusText = null;

    const hudHeight = GAME_CONFIG.recon.hudHeight;
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.hudBackground = this.add.rectangle(0, 0, 10, hudHeight, 0x0b0b0b, 0.96).setOrigin(0);
    this.hudBorder = this.add.rectangle(0, hudHeight - 2, 10, 2, hexToNumber(UI_TOKENS.color.phosphorDim)).setOrigin(0);
    // HUD hierarchy: objective, timer, mode state, then the mode's own rail.
    // The operation name and map id live in the briefing, not in the workspace.
    this.objectiveText = this.add.text(16, 13, this.mission.objective, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '15px', color: UI_TOKENS.text.body,
    });
    this.modeChip = this.add.text(16, 41, '', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '11px', color: UI_TOKENS.text.body,
      backgroundColor: GAME_CONFIG.palette.charcoal, padding: { x: 7, y: 4 }, letterSpacing: 1,
    });
    this.modeDetail = this.add.text(0, 45, '', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '11px', color: UI_TOKENS.text.muted,
      letterSpacing: 1,
    }).setOrigin(0, 0.5);
    this.timerText = this.add.text(0, 11, this.formatTime(this.remainingSeconds), {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '19px', color: UI_TOKENS.text.body,
    }).setOrigin(1, 0);
    this.coordText = this.add.text(0, 45, '---- / ----', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '10px', color: UI_TOKENS.text.faint,
    }).setOrigin(0, 0.5);
    this.timerColor = UI_TOKENS.text.body;
    this.hud.add([this.hudBackground, this.hudBorder, this.objectiveText, this.modeChip,
      this.modeDetail, this.coordText, this.timerText]);
    this.refreshModeStrip();
    this.refreshLocateObjective();

    this.pauseButton = createButton(this, 0, 0, 'PAUSE', () => this.togglePause(), { width: 96, height: 36, fontSize: 13, variant: 'secondary', pressSound: false });
    this.resetButton = createButton(this, 0, 0, 'RESET VIEW', () => this.resetView(), { width: 124, height: 36, fontSize: 12, variant: 'secondary' });
    this.commonButtons = [this.pauseButton, this.resetButton];

    if (this.isCountMode) this.createCountControls();
    else if (this.isChangeMode) this.createChangeControls();
    else this.createLocateControls();

    [...this.commonButtons, ...(this.locateButtons ?? []), ...(this.countButtons ?? []), ...(this.changeButtons ?? [])]
      .forEach((button) => button.setScrollFactor(0).setDepth(1002));

    this.statusText = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '12px', color: GAME_CONFIG.palette.offWhite,
      backgroundColor: GAME_CONFIG.palette.nearBlack, padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1010).setVisible(false);

    if (this.isChangeMode) this.updatePassStatus();
  }

  /** One word for what the console is doing right now. */
  modeStateName() {
    if (this.missionEnded) return 'COMPLETE';
    if (this.paused) return 'HELD';
    if (this.candidate) return 'PENDING';
    if (this.marking) return 'MARKING';
    return 'ANALYSIS';
  }

  /**
   * Mode chip plus the one counter that mode actually needs. Everything else
   * that used to live up here (operation name, map id, prefixes) is gone.
   */
  refreshModeStrip() {
    if (!this.modeChip) return;
    const state = this.modeStateName();
    this.modeChip.setText(`${this.mission.mode} \u00b7 ${state}`);

    const tones = {
      MARKING: { background: UI_TOKENS.color.amber, color: UI_TOKENS.color.black },
      PENDING: { background: UI_TOKENS.color.phosphor, color: UI_TOKENS.color.black },
      HELD: { background: UI_TOKENS.color.rustDim, color: UI_TOKENS.text.body },
      COMPLETE: { background: GAME_CONFIG.palette.charcoal, color: UI_TOKENS.text.muted },
      ANALYSIS: { background: GAME_CONFIG.palette.charcoal, color: UI_TOKENS.text.body },
    };
    const tone = tones[state] ?? tones.ANALYSIS;
    this.modeChip.setBackgroundColor(tone.background).setColor(tone.color);

    let detail = '';
    let detailTone = UI_TOKENS.text.muted;
    if (this.isCountMode) {
      if (this.incorrectSubmissions > 0) {
        detail = `REJECTED ${this.incorrectSubmissions}`;
        detailTone = UI_TOKENS.text.negative;
      }
    } else {
      const falseIds = this.falseIdentifications;
      if (this.isChangeMode) {
        detail = `PASS ${this.activePass}`;
        if (falseIds > 0) detail += ` · FALSE ID ${falseIds}`;
      } else if ((this.locateTargets?.length ?? 0) > 1) {
        detail = `CONTACTS ${this.completedTargetIds.length}/${this.locateTargets.length}`;
        if (falseIds > 0) detail += ` · FALSE ID ${falseIds}`;
      } else {
        detail = `FALSE ID ${falseIds}`;
      }
      if (falseIds > 0) detailTone = UI_TOKENS.text.negative;
    }
    this.modeDetail.setText(detail).setColor(detailTone);
    const detailX = this.modeChip.x + this.modeChip.width + 10;
    const rowY = this.modeDetail.y || 45;
    this.modeDetail.setPosition(detailX, rowY);
    // The grid readout tails the strip, clear of the utility buttons that sit
    // in the HUD's right-hand corner.
    this.coordText?.setPosition(detail ? detailX + this.modeDetail.width + 12 : detailX, rowY);
  }

  refreshLocateObjective() {
    if (this.isCountMode || this.isChangeMode || !this.objectiveText) return;
    if ((this.locateTargets?.length ?? 0) <= 1) {
      this.objectiveText.setText(this.mission.objective);
      return;
    }

    const completed = new Set(this.completedTargetIds);
    const pending = this.locateTargets.filter((target) => !completed.has(target.id));
    if (!pending.length) {
      this.objectiveText.setText(`ALL PRIORITY CONTACTS CONFIRMED // ${this.locateTargets.length}/${this.locateTargets.length}`);
      return;
    }
    const labels = pending.map((target) => target.label).join(' + ');
    this.objectiveText.setText(
      `LOCATE PRIORITY CONTACT${pending.length === 1 ? '' : 'S'}: ${labels} // ${this.completedTargetIds.length}/${this.locateTargets.length} CONFIRMED`,
    );
  }

  createLocateControls() {
    this.markButton = createButton(this, 0, 0, 'MARK TARGET', () => this.armMarking(), { width: 170, height: 36, fontSize: 13, variant: 'tactical', pressSound: false });
    this.confirmButton = createButton(this, 0, 0, 'CONFIRM', () => this.confirmCandidate(), { width: 112, height: 34, fontSize: 12, variant: 'success', pressSound: false });
    this.cancelButton = createButton(this, 0, 0, 'CANCEL', () => this.cancelCandidate(), { width: 100, height: 34, fontSize: 12, variant: 'danger', pressSound: false });
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);
    this.locateButtons = [this.markButton, this.confirmButton, this.cancelButton];
  }

  createCountControls() {
    // Two visually separate jobs: adjust the tally, then submit it.
    this.decrementButton = createButton(this, 0, 0, '\u2212', () => this.adjustAnswer(-1), { width: 54, height: 46, fontSize: 26, variant: 'tactical', accent: false, pressSound: false });
    this.incrementButton = createButton(this, 0, 0, '+', () => this.adjustAnswer(1), { width: 54, height: 46, fontSize: 26, variant: 'tactical', accent: false, pressSound: false });
    this.submitCountButton = createButton(this, 0, 0, 'SUBMIT COUNT', () => this.submitCount(), { width: 168, height: 46, fontSize: 13, variant: 'primary', pressSound: false });

    this.tallyFrame = this.add.rectangle(0, 0, 92, 46, hexToNumber(UI_TOKENS.color.black), 0.92)
      .setStrokeStyle(2, hexToNumber(UI_TOKENS.color.phosphorDim))
      .setScrollFactor(0).setDepth(1002);
    this.answerText = this.add.text(0, 0, '00', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '30px', fontStyle: 'bold',
      color: UI_TOKENS.text.positiveBright, letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1003);

    const caption = (text) => this.add.text(0, 0, text, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '9px', color: UI_TOKENS.text.faint, letterSpacing: 2,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1002);
    this.adjustCaption = caption('ADJUST');
    this.submitCaption = caption('SUBMIT');

    this.countButtons = [this.decrementButton, this.incrementButton, this.submitCountButton];
  }

  createChangeControls() {
    this.markButton = createButton(this, 0, 0, 'MARK CHANGE', () => this.armMarking(), { width: 150, height: 36, fontSize: 12, variant: 'tactical', pressSound: false });
    this.confirmButton = createButton(this, 0, 0, 'CONFIRM', () => this.confirmCandidate(), { width: 112, height: 34, fontSize: 12, variant: 'success', pressSound: false });
    this.cancelButton = createButton(this, 0, 0, 'CANCEL', () => this.cancelCandidate(), { width: 100, height: 34, fontSize: 12, variant: 'danger', pressSound: false });
    // Segmented control: the active pass is a selected segment, not a label
    // the analyst has to read and invert.
    this.passAButton = createButton(this, 0, 0, 'PASS A', () => this.setActivePass('A'), { width: 96, height: 40, fontSize: 12, variant: 'success', pressSound: false });
    this.passBButton = createButton(this, 0, 0, 'PASS B', () => this.setActivePass('B'), { width: 96, height: 40, fontSize: 12, variant: 'tactical', pressSound: false });
    this.passAButton.setSelected(true);
    this.passCaption = this.add.text(0, 0, 'COMPARE', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '9px', color: UI_TOKENS.text.faint, letterSpacing: 2,
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1002);
    this.splitButton = createButton(this, 0, 0, 'SPLIT VIEW', () => this.toggleSplitView(), { width: 132, height: 40, fontSize: 11, variant: 'tactical' });
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);
    this.passStatusText = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '11px', color: UI_TOKENS.text.muted,
      backgroundColor: GAME_CONFIG.palette.nearBlack, padding: { x: 10, y: 5 }, letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1003);
    this.changeButtons = [this.markButton, this.confirmButton, this.cancelButton, this.passAButton, this.passBButton, this.splitButton];
  }

  createGridOverlay() {
    const gridSize = this.mapMetadata.gridSize ?? 300;
    this.grid = this.add.graphics().setDepth(900).setAlpha(0.18);
    this.grid.lineStyle(2, 0xf6f6ee, 1);
    for (let x = 0; x <= this.map.width; x += gridSize) this.grid.lineBetween(x, 0, x, this.map.height);
    for (let y = 0; y <= this.map.height; y += gridSize) this.grid.lineBetween(0, y, this.map.width, y);
  }

  createMissionOverlay() {
    if (!this.isCountMode || !this.mission.region) return;
    const region = this.mission.region;
    const right = region.x + region.width;
    const bottom = region.y + region.height;

    // The count area is defined by dimming everything outside it and bracketing
    // its corners. Nothing inside is touched, so no individual object is hinted.
    this.missionOverlay = this.add.graphics().setDepth(920);
    this.missionOverlay.fillStyle(hexToNumber(UI_TOKENS.color.black), 0.42);
    this.missionOverlay.fillRect(0, 0, this.map.width, region.y);
    this.missionOverlay.fillRect(0, bottom, this.map.width, Math.max(0, this.map.height - bottom));
    this.missionOverlay.fillRect(0, region.y, region.x, region.height);
    this.missionOverlay.fillRect(right, region.y, Math.max(0, this.map.width - right), region.height);

    this.missionOverlay.lineStyle(2, hexToNumber(UI_TOKENS.color.offWhite), 0.5);
    this.missionOverlay.strokeRect(region.x, region.y, region.width, region.height);

    const arm = Math.min(120, Math.min(region.width, region.height) * 0.18);
    this.missionOverlay.lineStyle(6, hexToNumber(UI_TOKENS.color.phosphorBright), 0.9);
    [[region.x, region.y, 1, 1], [right, region.y, -1, 1],
      [region.x, bottom, 1, -1], [right, bottom, -1, -1]].forEach(([x, y, sx, sy]) => {
      this.missionOverlay.lineBetween(x, y, x + arm * sx, y);
      this.missionOverlay.lineBetween(x, y, x, y + arm * sy);
    });

    this.regionLabel = this.add.text(region.x + 14, region.y + 14, `${region.label} \u00b7 COUNT AREA`, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '16px', color: UI_TOKENS.text.positiveBright,
      backgroundColor: GAME_CONFIG.palette.black, padding: { x: 8, y: 5 }, letterSpacing: 1,
    }).setDepth(921);
  }

  createAtmosphereOverlay() {
    this.atmosphereGraphics = this.add.graphics().setScrollFactor(0).setDepth(930);
    this.redrawAtmosphere(this.scale.gameSize.width, this.scale.gameSize.height);
  }

  createWeatherOverlay() {
    this.weatherOverlay?.destroy();
    this.weatherOverlay = createMissionWeatherOverlay(this, {
      mission: this.mission,
      reducedMotion: this.reducedMotion === true,
      getBounds: (width, height) => {
        const top = GAME_CONFIG.recon.hudHeight + 4;
        const bottom = Math.max(top + 1, height - this.railHeight(width) - 4);
        return { top, bottom };
      },
    });
  }

  redrawAtmosphere(width, height) {
    if (!this.atmosphereGraphics) return;
    this.atmosphereGraphics.clear();
    const modifiers = this.mission.visualModifiers;
    if (!modifiers) return;

    const haze = Phaser.Math.Clamp(modifiers.haze ?? 0, 0, 0.1);
    if (haze > 0) this.atmosphereGraphics.fillStyle(0xf6f6ee, haze).fillRect(0, 0, width, height);

    const grain = Phaser.Math.Clamp(modifiers.grain ?? 0, 0, 0.25);
    if (grain <= 0) return;
    let state = 2166136261;
    for (const character of String(this.mission.seed ?? this.mission.id ?? 'I-SPY')) {
      state ^= character.charCodeAt(0);
      state = Math.imul(state, 16777619) >>> 0;
    }
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const points = Math.floor((width * height / 5200) * (grain / 0.1));
    this.atmosphereGraphics.fillStyle(0xf6f6ee, Math.min(0.12, grain * 0.5));
    for (let index = 0; index < points; index += 1) {
      this.atmosphereGraphics.fillRect(Math.floor(next() * width), Math.floor(next() * height), next() > 0.82 ? 2 : 1, 1);
    }
  }

  createSelectionOverlay() {
    this.selectionGraphics = this.add.graphics().setDepth(950);
    this.debugGraphics = this.add.graphics().setDepth(951);
    const query = new URLSearchParams(window.location.search);
    this.debugTargets = query.get('debugTargets') === '1';
    this.debugMap = query.get('debugMap') === '1';
    if (this.debugTargets || this.debugMap) this.drawDebugBounds();
  }

  drawDebugBounds() {
    this.debugGraphics.clear();
    if (this.debugMap) {
      this.debugGraphics.lineStyle(3, 0xbdbdbd, 0.55);
      this.spawnZones.forEach((zone) => this.debugGraphics.strokeRect(zone.x, zone.y, zone.width, zone.height));
    }
    if (this.debugTargets) {
      this.debugGraphics.lineStyle(2, 0xf6f6ee, 0.9);
      const entities = this.isChangeMode ? this.passEntities[this.activePass] : this.entities;
      entities.forEach((entity) => {
        if (!entity.hidden) this.debugGraphics.strokeRect(entity.x, entity.y, entity.width, entity.height);
      });
    }
  }

  bindInput() {
    this.dragging = false;
    this.paused = false;
    this.dragCamera = null;
    this.dragPointerId = null;
    this.panGestureDirty = false;
    this.pinchGesture = null;
    this.controlPressed = false;
    this.controlReleased = false;
    this.tapPointer = null;

    // A press that lands on a HUD control belongs to that control, not to the
    // map: Phaser emits the game-object events before the scene-level ones.
    this.input.on('gameobjectdown', () => { this.controlPressed = true; });
    this.input.on('gameobjectup', () => { this.controlReleased = true; });

    this.input.on('pointerdown', (pointer) => {
      const onControl = this.controlPressed;
      this.controlPressed = false;
      if (onControl || this.paused || this.missionEnded || this.isHudPoint(pointer)) {
        this.tapPointer = null;
        return;
      }

      const active = this.mapPointersDown();
      if (active.length >= 2) {
        // The second finger promotes the interaction to pinch immediately.
        // From this point on no individual pointermove is allowed to move the
        // camera; the game loop samples both contacts together once per frame.
        this.beginPinch(active);
        return;
      }

      const context = this.getPointerContext(pointer);
      this.dragging = true;
      this.dragPointerId = pointer.id;
      this.dragCamera = context.camera;
      this.lastPointer = { x: pointer.x, y: pointer.y };
      this.panGestureDirty = false;
      this.tapPointer = { id: pointer.id, x: pointer.x, y: pointer.y, travel: 0 };
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.paused) this.updateCoordinates(pointer);
      if (this.paused || this.missionEnded) return;

      const active = this.mapPointersDown();
      if (this.pinchGesture) {
        this.pinchGesture.dirty = true;
        return;
      }
      if (active.length >= 2) {
        this.beginPinch(active);
        return;
      }

      if (this.tapPointer && pointer.id === this.tapPointer.id) {
        this.tapPointer.travel = Math.max(
          this.tapPointer.travel,
          Phaser.Math.Distance.Between(this.tapPointer.x, this.tapPointer.y, pointer.x, pointer.y),
        );
      }
      if (!this.dragging || pointer.id !== this.dragPointerId || !pointer.isDown) return;

      // Hold the map still inside tap slop. Once the press has clearly become
      // a drag, only mark the pan dirty; the actual camera transform happens
      // from update(), once for the whole rendered frame.
      if (this.tapPointer
        && pointer.id === this.tapPointer.id
        && this.tapPointer.travel <= this.dragThreshold(pointer)) {
        this.lastPointer = { x: pointer.x, y: pointer.y };
        return;
      }
      this.panGestureDirty = true;
    });

    const releasePointer = (pointer, allowTap) => {
      const onControl = this.controlReleased;
      this.controlReleased = false;

      if (this.pinchGesture) {
        const remaining = this.mapPointersDown().filter((item) => item.id !== pointer.id);
        this.finishPinch(remaining);
        return;
      }

      // Flush the last pan sample before deciding whether this release was a
      // tap. Android can deliver pointerup before the next game frame.
      if (this.panGestureDirty && pointer.id === this.dragPointerId) this.stepPanGesture();

      const tap = allowTap
        && this.tapPointer
        && pointer.id === this.tapPointer.id
        && this.tapPointer.travel <= this.dragThreshold(pointer);
      this.tapPointer = null;
      this.dragging = false;
      this.dragCamera = null;
      this.dragPointerId = null;
      this.panGestureDirty = false;
      if (tap && !onControl) this.handleMapTap(pointer);
    };

    this.input.on('pointerup', (pointer) => releasePointer(pointer, true));
    this.input.on('pointerupoutside', (pointer) => releasePointer(pointer, false));
    this.input.on('gameout', () => this.cancelActiveMapGesture());

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (this.paused || this.missionEnded || this.isHudPoint(pointer)) return;
      this.zoomAt(pointer, deltaY > 0 ? -GAME_CONFIG.recon.zoomStep : GAME_CONFIG.recon.zoomStep);
    });

    // Both handlers are guarded against Phaser re-delivering one press: the
    // hold used to toggle an even number of times and look like a dead key,
    // and a COUNT stepper used to move the tally by three or five at once.
    this.input.keyboard?.on('keydown-ESC', oncePerKeyEvent('recon-esc', () => {
      if (!this.isCountMode && this.candidate) this.cancelCandidate(); else this.togglePause();
    }));
    this.input.keyboard?.on('keydown', oncePerKeyEvent('recon-key', (event) => this.handleKeyboard(event)));
  }

  /**
   * Camera movement is sampled once per Phaser step.
   *
   * Android emits the two contacts in a pinch as separate DOM/Phaser pointer
   * events. Applying a transform from each event means the first event is
   * calculated against stale coordinates for the second finger, then the
   * second event corrects it in the opposite direction. That alternating
   * sawtooth is the "map jumping" a real phone exposes even when a synthetic
   * test that moves both contacts together looks perfect.
   */
  update() {
    if (this.paused || this.missionEnded) return;
    if (this.pinchGesture?.dirty) {
      this.stepPinchGesture();
      return;
    }
    if (this.panGestureDirty) this.stepPanGesture();
  }

  cancelActiveMapGesture() {
    this.dragging = false;
    this.dragCamera = null;
    this.dragPointerId = null;
    this.panGestureDirty = false;
    this.pinchGesture = null;
    this.tapPointer = null;
  }

  stepPanGesture() {
    if (!this.dragging || this.pinchGesture || this.paused || this.missionEnded) {
      this.panGestureDirty = false;
      return false;
    }
    const pointer = this.input.manager.pointers.find((item) => item.id === this.dragPointerId);
    if (!pointer?.isDown || !this.lastPointer) {
      this.panGestureDirty = false;
      return false;
    }

    let dx = pointer.x - this.lastPointer.x;
    let dy = pointer.y - this.lastPointer.y;
    const distance = Math.hypot(dx, dy);
    const maxStep = pointer.wasTouch ? GAME_CONFIG.recon.touchPanStepMax : Number.POSITIVE_INFINITY;
    if (distance > maxStep) {
      const factor = maxStep / distance;
      dx *= factor;
      dy *= factor;
    }

    const camera = this.dragCamera ?? this.cameras.main;
    this.setCameraScrollClamped(
      camera,
      camera.scrollX - dx / Math.max(0.05, camera.zoom),
      camera.scrollY - dy / Math.max(0.05, camera.zoom),
    );
    this.lastPointer = { x: pointer.x, y: pointer.y };
    this.panGestureDirty = false;
    if (this.isChangeMode && this.splitView) this.syncChangeCameras(camera);
    if (this.candidate) this.drawCandidateMarker();
    return true;
  }

  /**
   * How far a press may wander and still count as a tap rather than a pan.
   *
   * A mouse sits where it is put. A finger does not: its contact patch shifts
   * a handful of pixels between touchstart and touchend, and at the 6px mouse
   * threshold a normal phone tap was read as a drag, so marking a target
   * simply did nothing. Touch gets a slop comparable to the platform's own.
   */
  dragThreshold(pointer) {
    return pointer?.wasTouch ? GAME_CONFIG.recon.touchDragThreshold : GAME_CONFIG.recon.dragThreshold;
  }

  mapPointersDown() {
    return this.input.manager.pointers.filter((pointer) => pointer.isDown && !this.isHudPoint(pointer));
  }

  pinchPointers(pointers = this.mapPointersDown()) {
    if (!this.pinchGesture?.pointerIds?.length) return pointers.slice(0, 2);
    const byId = new Map(pointers.map((pointer) => [pointer.id, pointer]));
    return this.pinchGesture.pointerIds.map((id) => byId.get(id)).filter(Boolean);
  }

  beginPinch(pointers = this.mapPointersDown()) {
    if (pointers.length < 2 || this.paused || this.missionEnded) return false;
    const [first, second] = pointers.slice(0, 2);
    const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const camera = this.getPointerContext(midpoint).camera;
    const distance = Math.max(1, Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y));

    this.pinchGesture = {
      pointerIds: [first.id, second.id],
      lastDistance: distance,
      lastMidpoint: midpoint,
      camera,
      dirty: false,
    };
    this.tapPointer = null;
    this.dragging = false;
    this.dragCamera = null;
    this.dragPointerId = null;
    this.panGestureDirty = false;
    return true;
  }

  stepPinchGesture() {
    if (!this.pinchGesture || this.paused || this.missionEnded) return false;
    this.pinchGesture.dirty = false;

    const pair = this.pinchPointers();
    if (pair.length < 2) return false;
    const [first, second] = pair;
    const camera = this.pinchGesture.camera;
    if (!camera) return false;

    const rawMidpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const rawDistance = Math.max(1, Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y));
    const previousMidpoint = this.pinchGesture.lastMidpoint;
    const previousDistance = Math.max(1, this.pinchGesture.lastDistance);

    const distanceDelta = rawDistance - previousDistance;
    let scaleRatio = 1;
    if (Math.abs(distanceDelta) >= GAME_CONFIG.recon.pinchDistanceDeadZone) {
      scaleRatio = Phaser.Math.Clamp(
        rawDistance / previousDistance,
        GAME_CONFIG.recon.pinchScaleStepMin,
        GAME_CONFIG.recon.pinchScaleStepMax,
      );
    }

    let midpointDx = rawMidpoint.x - previousMidpoint.x;
    let midpointDy = rawMidpoint.y - previousMidpoint.y;
    const midpointDistance = Math.hypot(midpointDx, midpointDy);
    if (midpointDistance < GAME_CONFIG.recon.pinchMidpointDeadZone) {
      midpointDx = 0;
      midpointDy = 0;
    } else if (midpointDistance > GAME_CONFIG.recon.pinchPanStepMax) {
      const factor = GAME_CONFIG.recon.pinchPanStepMax / midpointDistance;
      midpointDx *= factor;
      midpointDy *= factor;
    }
    const appliedMidpoint = {
      x: previousMidpoint.x + midpointDx,
      y: previousMidpoint.y + midpointDy,
    };

    // Keep the ground point under the old midpoint under the new midpoint.
    // Clamp scroll in the same operation so Phaser cannot silently correct an
    // out-of-bounds camera later and make the next frame compensate for it.
    const anchorWorld = camera.getWorldPoint(previousMidpoint.x, previousMidpoint.y);
    const nextZoom = Phaser.Math.Clamp(
      camera.zoom * scaleRatio,
      this.minZoomForCamera(camera),
      GAME_CONFIG.recon.maxZoom,
    );
    camera.setZoom(nextZoom);
    const after = camera.getWorldPoint(appliedMidpoint.x, appliedMidpoint.y);
    this.setCameraScrollClamped(
      camera,
      camera.scrollX + anchorWorld.x - after.x,
      camera.scrollY + anchorWorld.y - after.y,
    );

    // Raw coordinates become the next frame's baseline. If Android supplies a
    // pathological sample, the capped transform absorbs only a safe amount
    // and the discarded excess cannot spring back on the following frame.
    this.pinchGesture.lastDistance = rawDistance;
    this.pinchGesture.lastMidpoint = rawMidpoint;

    if (this.isChangeMode && this.splitView) this.syncChangeCameras(camera);
    if (this.candidate) this.drawCandidateMarker();
    return true;
  }

  finishPinch(remaining = []) {
    this.pinchGesture = null;
    this.tapPointer = null;
    this.dragging = false;
    this.dragCamera = null;
    this.dragPointerId = null;
    this.panGestureDirty = false;

    // Continuing with one finger after lifting the other should begin from the
    // remaining finger's current position, not from either pinch coordinate.
    if (remaining.length === 1 && !this.paused && !this.missionEnded) {
      const pointer = remaining[0];
      const context = this.getPointerContext(pointer);
      this.dragging = true;
      this.dragPointerId = pointer.id;
      this.dragCamera = context.camera;
      this.lastPointer = { x: pointer.x, y: pointer.y };
    }
  }

  /** A tap on the imagery only marks while marking is armed. */
  handleMapTap(pointer) {
    if (this.paused || this.missionEnded || this.isCountMode) return;
    if (!this.marking || this.isHudPoint(pointer)) return;
    this.placeCandidate(pointer);
  }

  /**
   * Invisible selection tolerance, in world units.
   *
   * Authored bounds still decide any mark that lands on an object; this only
   * rescues a near miss, and touch gets a little more room than a mouse.
   */
  selectionTolerance(pointer, camera) {
    const screenPixels = pointer?.wasTouch ? 16 : 7;
    return screenPixels / Math.max(0.05, camera?.zoom ?? 1);
  }

  handleKeyboard(event) {
    if (this.paused || this.missionEnded) return;
    if (this.isChangeMode) {
      if (event.key.toLowerCase() === 'a') this.setActivePass('A');
      else if (event.key.toLowerCase() === 'b') this.setActivePass('B');
      else if (event.key.toLowerCase() === 's') this.toggleSplitView();
      return;
    }
    if (!this.isCountMode) return;
    if (event.key === 'ArrowUp' || event.key === '+') this.adjustAnswer(1);
    else if (event.key === 'ArrowDown' || event.key === '-') this.adjustAnswer(-1);
    else if (event.key === 'Enter') this.submitCount();
    else if (event.key === 'Backspace') this.setAnswer(Math.floor(this.answerValue / 10));
    else if (/^[0-9]$/.test(event.key)) this.setAnswer(this.answerValue === 0 ? Number(event.key) : this.answerValue * 10 + Number(event.key));
  }

  getPointerContext(pointer) {
    if (!this.isChangeMode) return { camera: this.cameras.main, passId: null, entities: this.entities };
    if (this.splitView && this.compareCamera && pointer.x >= this.scale.gameSize.width / 2) {
      return { camera: this.compareCamera, passId: 'B', entities: this.passEntities.B };
    }
    const passId = this.splitView ? 'A' : this.activePass;
    return { camera: this.cameras.main, passId, entities: this.passEntities[passId] };
  }

  /**
   * Dedicated HUD camera, fixed at 1x.
   *
   * Screen-space objects still inherit the main camera's zoom, so the console
   * used to drift away from the viewport edges at any zoom other than 1x, and
   * at maximum zoom it left the screen entirely, taking MARK, PAUSE and the
   * timer with it. The HUD now renders through its own camera and the two
   * cameras ignore each other's objects, so the console is anchored to the
   * viewport no matter how the analyst navigates the imagery.
   */
  createUiCamera() {
    const { width, height } = this.scale.gameSize;
    this.uiCamera = this.cameras.add(0, 0, width, height, false, 'Hud');
    this.uiCamera.setScroll(0, 0);
    this.applyCameraLayers();
  }

  /** Everything in map coordinates: the HUD camera must never draw these. */
  getWorldObjects() {
    return [this.worldLayer, this.worldA?.root, this.worldB?.root, this.grid, this.missionOverlay,
      this.regionLabel, this.selectionGraphics, this.debugGraphics].filter(Boolean);
  }

  /** Split the display list between the imagery cameras and the HUD camera. */
  applyCameraLayers() {
    if (!this.uiCamera) return;
    const ui = this.getUiObjects();
    this.cameras.main.ignore(ui);
    this.compareCamera?.ignore(ui);
    this.uiCamera.ignore(this.getWorldObjects());
  }

  /** Cameras render in list order, so the HUD camera has to stay last. */
  raiseUiCamera() {
    const list = this.cameras.cameras;
    const index = list.indexOf(this.uiCamera);
    if (index === -1 || index === list.length - 1) return;
    list.splice(index, 1);
    list.push(this.uiCamera);
  }

  /**
   * Lays a row of controls across the rail, in order, without overlaps.
   *
   * The compact rails used to be positioned from fixed offsets that assumed
   * a phone at least ~390px wide. Narrower Android phones — 360 and 320 are
   * both still in the wild — drew RESET VIEW over MARK TARGET, + over SUBMIT
   * COUNT and MARK CHANGE over PASS A, so a tap could activate a control the
   * analyst was not aiming at. Widths are requested here rather than fixed:
   * a row with room to spare spreads across the rail exactly as before, and
   * a row that does not fit shrinks every control in it by the same factor
   * instead of letting two of them share a space.
   *
   * Each entry places itself through `place(centreX, width)`, because the
   * modes put different things in a slot — a button, or the tally module's
   * three pieces.
   */
  placeRail(entries, { width, margin = 14, minGap = 10 } = {}) {
    const requested = entries.reduce((total, entry) => total + entry.width, 0);
    const available = Math.max(1, width - margin * 2);
    const slots = Math.max(1, entries.length - 1);
    const scale = Phaser.Math.Clamp((available - minGap * slots) / Math.max(1, requested), 0.1, 1);
    const widths = entries.map((entry) => Math.max(1, Math.round(entry.width * scale)));
    const used = widths.reduce((total, value) => total + value, 0);
    const gap = entries.length > 1 ? Math.max(minGap, (available - used) / slots) : 0;
    // Separating the drawn controls is only half the job: a short control also
    // pads its hit area out to the minimum touch target, and that padding has
    // to stop inside the gap this rail just left.
    const pad = hitGap(gap);

    let cursor = margin;
    entries.forEach((entry, index) => {
      const entryWidth = widths[index];
      entry.place(Math.round(cursor + entryWidth / 2), entryWidth, pad);
      cursor += entryWidth + gap;
    });
  }

  /**
   * Height of this mode's bottom control rail. One source of truth: the
   * enhanced scene draws the rail at this height and taps are guarded by it,
   * so the guarded band and the drawn band can never drift apart.
   */
  railHeight(width = this.scale.gameSize.width) {
    const compact = width < 680;
    if (this.isCountMode) return compact ? 124 : 78;
    if (this.isChangeMode) return compact ? 128 : 78;
    return compact ? 66 : 0;
  }

  isHudPoint(pointer) {
    const y = pointer.y;
    if (y < GAME_CONFIG.recon.hudHeight) return true;
    const bottomGuard = this.railHeight();
    return bottomGuard > 0 && y > this.scale.gameSize.height - bottomGuard;
  }

  adjustAnswer(delta) { this.setAnswer(this.answerValue + delta); }

  setAnswer(value) {
    this.answerValue = Phaser.Math.Clamp(Math.floor(Number(value) || 0), 0, GAME_CONFIG.count.maxAnswer);
    this.answerText?.setText(String(this.answerValue).padStart(2, '0'));
  }

  submitCount() {
    if (!this.isCountMode || this.paused || this.missionEnded) return;
    const result = validateCountAnswer(this.mission, this.answerValue);
    if (result.correct) {
      this.onCountConfirmed();
      this.flashStatus('COUNT CONFIRMED');
      this.time.delayedCall(300, () => this.finishMission(true));
      return;
    }
    this.incorrectSubmissions += 1;
    this.refreshModeStrip();
    this.onCountRejected();
    this.flashStatus('COUNT UNVERIFIED');
  }

  /** Overridden by the enhanced scene to acknowledge a tally result. */
  onCountRejected() {}

  onCountConfirmed() {}

  armMarking() {
    if (this.isCountMode || this.paused || this.missionEnded) return;
    this.marking = true;
    this.candidate = null;
    this.markerTone = 'pending';
    this.selectionGraphics.clear();
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);
    this.markButton.setLabel(this.isChangeMode ? 'SELECT CHANGE' : 'SELECT OBJECT');
    this.markButton.setSelected(true);
    this.refreshModeStrip();
    this.flashStatus(this.isChangeMode ? 'CHANGE MARKING ACTIVE // TAP THE CHANGED OBJECT' : 'MARKING ACTIVE // TAP AN OBJECT');
  }

  placeCandidate(pointer) {
    const context = this.getPointerContext(pointer);
    const world = context.camera.getWorldPoint(pointer.x, pointer.y);
    const entity = entityNearPoint(world.x, world.y, context.entities,
      this.selectionTolerance(pointer, context.camera));
    this.candidate = { x: world.x, y: world.y, entity, passId: context.passId };
    this.markerTone = 'pending';
    this.drawCandidateMarker();
    this.confirmButton.setVisible(true);
    this.cancelButton.setVisible(true);
    this.markButton.setLabel('MARK PENDING');
    this.refreshModeStrip();
    const passLabel = this.isChangeMode ? ` // ${context.passId === 'B' ? 'PASS B' : 'PASS A'}` : '';
    this.flashStatus(entity ? `IDENTIFICATION READY${passLabel} // CONFIRM OR CANCEL` : `NO CLEAR OBJECT${passLabel} // CONFIRM OR CANCEL`);
  }

  /** Camera the current mark belongs to, resolved late so it is never stale. */
  candidateCamera() {
    if (this.candidate?.passId === 'B' && this.splitView && this.compareCamera) return this.compareCamera;
    return this.cameras.main;
  }

  /** Redrawn on every pan and zoom so the mark keeps a constant screen size. */
  drawCandidateMarker() {
    if (!this.selectionGraphics) return;
    if (!this.candidate) {
      this.selectionGraphics.clear();
      return;
    }
    drawCandidateReticle(this.selectionGraphics, this.candidate.x, this.candidate.y,
      this.candidateCamera().zoom, this.markerTone ?? 'pending', this.markerScale ?? 1);
  }

  cancelCandidate() {
    this.marking = false;
    this.candidate = null;
    this.markerTone = 'pending';
    this.selectionGraphics.clear();
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);
    this.markButton.setLabel(this.isChangeMode ? 'MARK CHANGE' : 'MARK TARGET');
    this.markButton.setSelected(false);
    this.refreshModeStrip();
    this.flashStatus('MARK CANCELLED');
  }

  confirmCandidate() {
    // Single-shot: a second press while a result resolves must not re-score,
    // re-trigger audio, or fire the mission-end transition twice.
    if (!this.candidate || this.missionEnded || this.resolvingIdentification) return;
    this.resolvingIdentification = true;
    const mark = { x: this.candidate.x, y: this.candidate.y, passId: this.candidate.passId };
    const result = this.isChangeMode
      ? validateChangeIdentification(this.mission, this.candidate.entity, this.candidate.passId)
      : validateIdentification({ ...this.mission, completedTargetIds: this.completedTargetIds }, this.candidate.entity);
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);
    this.marking = false;
    this.markButton.setLabel(this.isChangeMode ? 'MARK CHANGE' : 'MARK TARGET');
    this.markButton.setSelected(false);
    if (result.correct) {
      if (!this.isChangeMode && this.locateTargets.length > 1) {
        if (!this.completedTargetIds.includes(result.entity.id)) this.completedTargetIds.push(result.entity.id);
        const complete = this.completedTargetIds.length >= this.locateTargets.length;
        this.onIdentificationResolved(result, mark);

        if (!complete) {
          this.candidate = null;
          this.marking = false;
          this.markerTone = 'pending';
          this.confirmButton.setVisible(false);
          this.cancelButton.setVisible(false);
          this.markButton.setLabel('MARK TARGET').setSelected(false);
          this.resolvingIdentification = false;
          this.refreshLocateObjective();
          this.refreshModeStrip();
          this.flashStatus(`CONTACT CONFIRMED // ${this.completedTargetIds.length}/${this.locateTargets.length} // CONTINUE SEARCH`);
          this.time.delayedCall(500, () => {
            if (!this.candidate && !this.missionEnded) this.selectionGraphics.clear();
          });
          return;
        }
      }

      this.flashStatus(this.isChangeMode ? 'CHANGE CONFIRMED' : 'MISSION CONTACTS CONFIRMED');
      this.onIdentificationResolved(result, mark);
      this.refreshLocateObjective();
      this.refreshModeStrip();
      this.time.delayedCall(350, () => this.finishMission(true));
      return;
    }
    this.falseIdentifications += 1;
    this.flashStatus(`${this.isChangeMode ? 'CHANGE UNVERIFIED' : 'UNVERIFIED'} // FALSE ID ${this.falseIdentifications}`);
    this.candidate = null;
    this.refreshModeStrip();
    this.onIdentificationResolved(result, mark);
    this.resolvingIdentification = false;
  }

  /** Overridden by the enhanced scene to flash the result at the mark. */
  onIdentificationResolved(result) {
    if (!result.correct) this.selectionGraphics.clear();
  }

  togglePass() {
    if (!this.isChangeMode || this.splitView) return;
    this.setActivePass(this.activePass === 'A' ? 'B' : 'A');
  }

  setActivePass(passId, showMessage = true) {
    if (!this.isChangeMode || !['A', 'B'].includes(passId)) return;
    if (this.splitView) {
      if (showMessage) this.flashStatus('SPLIT VIEW ACTIVE // LEFT A / RIGHT B');
      return;
    }
    if (this.candidate) this.cancelCandidate();
    const changed = this.activePass !== passId;
    this.activePass = passId;
    this.worldA.root.setVisible(passId === 'A');
    this.worldB.root.setVisible(passId === 'B');
    // The live pass is a lit segment; the other is plain equipment.
    this.passAButton.setSelected(passId === 'A').setVariant(passId === 'A' ? 'success' : 'tactical');
    this.passBButton.setSelected(passId === 'B').setVariant(passId === 'B' ? 'success' : 'tactical');
    this.refreshModeStrip();
    this.updatePassStatus();
    if (changed) this.onPassSwitched(passId);
    if (this.debugTargets) this.drawDebugBounds();
    if (showMessage) this.flashStatus(`${passId === 'A' ? 'PASS A' : 'PASS B'} ACQUIRED`);
  }

  /** Overridden by the enhanced scene to mask the A/B swap. */
  onPassSwitched() {}

  updatePassStatus() {
    if (!this.isChangeMode || !this.passStatusText) return;
    if (this.splitView) {
      this.passStatusText.setText('SPLIT \u00b7 LEFT PASS A \u00b7 RIGHT PASS B');
    } else {
      const pass = this.activePass === 'A' ? this.mission.passA : this.mission.passB;
      this.passStatusText.setText(`${pass?.label ?? `PASS ${this.activePass}`} \u00b7 ${pass?.time ?? 'TIME UNKNOWN'}`);
    }
  }

  toggleSplitView() {
    if (!this.isChangeMode || this.missionEnded) return;
    if (this.scale.gameSize.width < GAME_CONFIG.change.splitViewMinWidth) {
      this.flashStatus(`SPLIT VIEW REQUIRES ${GAME_CONFIG.change.splitViewMinWidth}px+ WIDTH`);
      return;
    }
    if (this.splitView) this.disableSplitView();
    else this.enableSplitView();
  }

  enableSplitView() {
    if (this.splitView || !this.isChangeMode) return;
    if (this.candidate) this.cancelCandidate();
    this.splitView = true;
    this.worldA.root.setVisible(true);
    this.worldB.root.setVisible(true);
    this.atmosphereGraphics?.setVisible(false);
    const { width, height } = this.scale.gameSize;
    const half = Math.floor(width / 2);
    // Both panes need identical viewports. Zoom is applied around each
    // camera's own centre, so a full-width main camera beside a half-width
    // compare camera drifts apart by 360 * (1 - zoom) pixels — the two passes
    // no longer show the same ground, which is the whole point of split view.
    this.cameras.main.setViewport(0, 0, half, height);
    this.compareCamera = this.cameras.add(half, 0, width - half, height, false, 'PassB');
    this.compareCamera.setBounds(0, 0, this.map.width, this.map.height);
    this.compareCamera.setBackgroundColor(GAME_CONFIG.palette.black);
    this.compareCamera.setZoom(this.cameras.main.zoom);
    this.compareCamera.scrollX = this.cameras.main.scrollX;
    this.compareCamera.scrollY = this.cameras.main.scrollY;

    this.cameras.main.ignore(this.worldB.root);
    this.compareCamera.ignore(this.worldA.root);
    this.compareCamera.ignore(this.getUiObjects());
    this.uiCamera?.ignore([this.worldA.root, this.worldB.root]);
    this.raiseUiCamera();
    this.passAButton.setVisible(false);
    this.passBButton.setVisible(false);
    this.passCaption.setVisible(false);
    this.splitButton.setLabel('EXIT SPLIT').setSelected(true);
    this.updatePassStatus();
    this.onResize(this.scale.gameSize);
    this.flashStatus('SPLIT VIEW // LEFT PASS A // RIGHT PASS B');
  }

  disableSplitView(showMessage = true) {
    if (!this.splitView) return;
    // The camera manager is torn down before this scene's own shutdown
    // handler runs, so a teardown route can arrive here with no main camera.
    // Restoring a viewport on a scene that is going away is pointless, and
    // throwing while doing it used to take the whole transition with it.
    if (!this.cameras?.main) {
      this.splitView = false;
      this.compareCamera = null;
      return;
    }
    this.splitView = false;
    this.worldA.root.cameraFilter = 0;
    this.worldB.root.cameraFilter = 0;
    this.getUiObjects().forEach((object) => { if (object) object.cameraFilter = 0; });
    if (this.compareCamera) {
      this.cameras.remove(this.compareCamera, true);
      this.compareCamera = null;
    }
    const { width: fullWidth, height: fullHeight } = this.scale.gameSize;
    this.cameras.main.setViewport(0, 0, fullWidth, fullHeight);
    this.applyCameraLayers();
    this.worldA.root.setVisible(this.activePass === 'A');
    this.worldB.root.setVisible(this.activePass === 'B');
    this.atmosphereGraphics?.setVisible(true);
    this.passAButton.setVisible(true);
    this.passBButton.setVisible(true);
    this.passCaption.setVisible(true);
    this.splitButton.setLabel('SPLIT VIEW').setSelected(false);
    this.updatePassStatus();
    this.onResize(this.scale.gameSize);
    if (showMessage) this.flashStatus(`${this.activePass === 'A' ? 'PASS A' : 'PASS B'} SINGLE VIEW`);
  }

  getUiObjects() {
    const objects = [this.hud, this.statusText, this.answerText, this.passStatusText, this.atmosphereGraphics,
      this.weatherOverlay?.graphics, this.tallyFrame, this.adjustCaption, this.submitCaption, this.passCaption];
    const buttons = [...(this.commonButtons ?? []), ...(this.locateButtons ?? []), ...(this.countButtons ?? []), ...(this.changeButtons ?? [])];
    buttons.forEach((button) => objects.push(...button.getObjects()));
    return objects.filter(Boolean);
  }

  syncChangeCameras(sourceCamera = this.cameras.main) {
    if (!this.splitView || !this.compareCamera) return;
    const target = sourceCamera === this.compareCamera ? this.cameras.main : this.compareCamera;
    target.setZoom(sourceCamera.zoom);
    this.setCameraScrollClamped(target, sourceCamera.scrollX, sourceCamera.scrollY);
  }

  startMissionTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 250, loop: true,
      callback: () => {
        if (this.paused || this.missionEnded) return;
        const elapsed = (this.time.now - this.missionStartedAt - (this.totalPausedMs ?? 0)) / 1000;
        this.remainingSeconds = Math.max(0, this.mission.timeLimitSeconds - elapsed);
        this.timerText.setText(this.formatTime(this.remainingSeconds));
        this.updateTimerStyle();
        if (this.remainingSeconds <= 0) this.finishMission(false);
      },
    });
  }

  finishMission(success) {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.timerEvent?.remove(false);
    // One id follows this completed attempt into Results. If Results is ever
    // recreated with the same payload, persistence can recognize the replayed
    // debrief and refuse to count it twice.
    const randomPart = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const resultId = `${this.mission.id ?? this.mission.seed ?? 'mission'}:${randomPart}`;
    const remainingSeconds = Math.max(0, Math.floor(this.remainingSeconds));
    const elapsedSeconds = Math.max(0, Math.ceil(this.mission.timeLimitSeconds - remainingSeconds));
    const errors = this.isCountMode ? this.incorrectSubmissions : this.falseIdentifications;
    const performance = assessMissionPerformance(this.mission, {
      success,
      errors,
      elapsedSeconds,
      remainingSeconds,
    });

    if (this.isCountMode) {
      const score = applyPerformanceBonus(
        calculateCountScore({ success, incorrectSubmissions: this.incorrectSubmissions, remainingSeconds }),
        performance,
      );
      this.scene.start('Results', {
        success, mission: this.mission, elapsedSeconds, score, performance, resultId,
        submittedAnswer: this.answerValue,
        correctAnswer: this.mission.expectedCount,
        incorrectSubmissions: this.incorrectSubmissions,
      });
      return;
    }

    if (this.isChangeMode) {
      const score = applyPerformanceBonus(
        calculateChangeScore({ success, falseIdentifications: this.falseIdentifications, remainingSeconds }),
        performance,
      );
      this.scene.start('Results', {
        success, mission: this.mission, elapsedSeconds, score, performance, resultId,
        falseIdentifications: this.falseIdentifications,
        markedPass: this.candidate?.passId ?? this.activePass,
      });
      return;
    }

    const score = applyPerformanceBonus(
      calculateLocateScore({ success, falseIdentifications: this.falseIdentifications, remainingSeconds }),
      performance,
    );
    this.scene.start('Results', {
      success, mission: this.mission, targetLabel: this.mission.targetLabel, elapsedSeconds,
      falseIdentifications: this.falseIdentifications, score, performance, resultId,
    });
  }

  /**
   * Zoom floor for the current viewport.
   *
   * The configured minimum lets a wide window zoom out past the edge of the
   * imagery, which left black gutters beside the photograph. The floor keeps
   * the imagery covering the viewport instead; it never restricts a window the
   * map already covers.
   */
  minZoomForViewport(width = this.scale.gameSize.width, height = this.scale.gameSize.height) {
    const cover = Math.max(width / this.map.width, height / this.map.height);
    return Phaser.Math.Clamp(Math.max(GAME_CONFIG.recon.minZoom, cover),
      GAME_CONFIG.recon.minZoom, GAME_CONFIG.recon.maxZoom);
  }

  minZoomForCamera(camera = this.cameras.main) {
    return this.minZoomForViewport(
      camera?.width ?? this.scale.gameSize.width,
      camera?.height ?? this.scale.gameSize.height,
    );
  }

  cameraScrollLimits(camera = this.cameras.main) {
    const zoom = Math.max(0.05, camera?.zoom ?? 1);
    const visibleWidth = (camera?.width ?? this.scale.gameSize.width) / zoom;
    const visibleHeight = (camera?.height ?? this.scale.gameSize.height) / zoom;
    return {
      maxX: Math.max(0, this.map.width - visibleWidth),
      maxY: Math.max(0, this.map.height - visibleHeight),
    };
  }

  setCameraScrollClamped(camera, scrollX, scrollY) {
    const { maxX, maxY } = this.cameraScrollLimits(camera);
    camera.scrollX = Phaser.Math.Clamp(scrollX, 0, maxX);
    camera.scrollY = Phaser.Math.Clamp(scrollY, 0, maxY);
    return camera;
  }

  zoomAt(screenPoint, delta) {
    const context = this.getPointerContext(screenPoint);
    const camera = context.camera;
    const before = camera.getWorldPoint(screenPoint.x, screenPoint.y);
    camera.setZoom(Phaser.Math.Clamp(camera.zoom + delta, this.minZoomForCamera(camera), GAME_CONFIG.recon.maxZoom));
    const after = camera.getWorldPoint(screenPoint.x, screenPoint.y);
    this.setCameraScrollClamped(
      camera,
      camera.scrollX + before.x - after.x,
      camera.scrollY + before.y - after.y,
    );
    if (this.isChangeMode && this.splitView) this.syncChangeCameras(camera);
    if (this.candidate) this.drawCandidateMarker();
  }

  updateCoordinates(pointer) {
    const context = this.getPointerContext(pointer);
    const world = context.camera.getWorldPoint(pointer.x, pointer.y);
    const x = Phaser.Math.Clamp(Math.round(world.x), 0, this.map.width);
    const y = Phaser.Math.Clamp(Math.round(world.y), 0, this.map.height);
    this.coordText.setText(`${String(x).padStart(4, '0')} / ${String(y).padStart(4, '0')}`);
  }

  resetCamera(showMessage = true) {
    let view = this.mapMetadata.recommendedView ?? { x: this.map.width / 2, y: this.map.height / 2, zoom: GAME_CONFIG.recon.defaultZoom };
    if (this.isCountMode && this.mission.region) {
      const region = this.mission.region;
      view = { x: region.x + region.width / 2, y: region.y + region.height / 2, zoom: 0.68 };
    } else if (this.isChangeMode && this.mission.focus) {
      view = this.mission.focus;
    }
    this.cameras.main.setZoom(Phaser.Math.Clamp(view.zoom ?? GAME_CONFIG.recon.defaultZoom, this.minZoomForViewport(), GAME_CONFIG.recon.maxZoom));
    this.cameras.main.centerOn(view.x ?? this.map.width / 2, view.y ?? this.map.height / 2);
    this.setCameraScrollClamped(this.cameras.main, this.cameras.main.scrollX, this.cameras.main.scrollY);
    if (this.isChangeMode && this.splitView) this.syncChangeCameras(this.cameras.main);
    if (showMessage) this.flashStatus('VIEW RECENTERED');
  }

  resetView() { this.resetCamera(true); }

  togglePause() {
    if (this.missionEnded) return;
    this.paused = !this.paused;
    this.dragging = false;
    this.dragPointerId = null;
    this.dragCamera = null;
    this.panGestureDirty = false;
    this.tapPointer = null;
    this.pinchGesture = null;
    if (this.paused) this.pauseStartedAt = this.time.now;
    else if (this.pauseStartedAt) {
      this.totalPausedMs = (this.totalPausedMs ?? 0) + (this.time.now - this.pauseStartedAt);
      this.pauseStartedAt = null;
    }
    this.pauseButton.setLabel(this.paused ? 'RESUME' : 'PAUSE').setVariant(this.paused ? 'warning' : 'secondary');
    this.setMissionControlsEnabled(!this.paused);
    this.weatherOverlay?.setPaused(this.paused);
    this.refreshModeStrip();
    this.flashStatus(this.paused ? 'RECON PAUSED // ESC TO RESUME' : 'RECON RESUMED');
  }

  /** Mission actions read as unavailable while the recon feed is held. */
  setMissionControlsEnabled(enabled) {
    [...(this.locateButtons ?? []), ...(this.countButtons ?? []), ...(this.changeButtons ?? [])]
      .forEach((button) => button?.setEnabled(enabled));
  }

  updateTimerStyle() {
    const { cautionSeconds, criticalSeconds } = GAME_CONFIG.recon;
    let color = UI_TOKENS.text.body;
    if (this.remainingSeconds <= criticalSeconds) color = UI_TOKENS.text.negative;
    else if (this.remainingSeconds <= cautionSeconds) color = UI_TOKENS.text.attention;
    if (color === this.timerColor) return;
    this.timerColor = color;
    this.timerText.setColor(color);
  }

  formatTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    return `T-${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
  }

  flashStatus(message) {
    this.statusText.setText(message).setVisible(true);
    this.statusTimer?.remove(false);
    this.statusTimer = this.time.delayedCall(1700, () => this.statusText.setVisible(false));
  }

  onResize(gameSize) {
    const { width, height } = gameSize;
    this.uiCamera?.setSize(width, height);
    const floor = this.minZoomForViewport(width, height);
    if (this.cameras.main.zoom < floor) {
      this.cameras.main.setZoom(floor);
      if (this.candidate) this.drawCandidateMarker();
    }
    this.setCameraScrollClamped(this.cameras.main, this.cameras.main.scrollX, this.cameras.main.scrollY);
    if (this.isChangeMode && this.splitView) this.syncChangeCameras(this.cameras.main);
    this.hudBackground.width = width;
    this.hudBorder.width = width;
    // One HUD strip spans the viewport, so the readout stays at its right
    // edge in split view too rather than floating over the middle of the bar.
    const readoutRight = width - 16;
    this.timerText.setPosition(readoutRight, 11);
    if (!this.splitView) this.redrawAtmosphere(width, height);
    this.weatherOverlay?.resize();
    const compact = width < 680;

    if (this.isChangeMode && this.splitView && width < GAME_CONFIG.change.splitViewMinWidth) {
      this.disableSplitView(false);
      return;
    }
    if (this.isChangeMode && this.splitView && this.compareCamera) {
      const half = Math.floor(width / 2);
      this.cameras.main.setViewport(0, 0, half, height);
      this.compareCamera.setViewport(half, 0, width - half, height);
      this.syncChangeCameras(this.cameras.main);
    } else if (!this.splitView) {
      this.cameras.main.setViewport(0, 0, width, height);
    }

    if (this.isCountMode) {
      // Tally module (adjust) sits apart from the submit action, each captioned.
      const controlY = compact ? height - 76 : height - 34;
      const captionY = controlY - 33;
      const stepperWidth = compact ? 48 : 54;
      const tallyWidth = compact ? 76 : 92;
      const submitWidth = compact ? 126 : 168;
      // The three tally pieces are one module and stay tight together; the
      // rail only decides where the module and the submit action sit.
      const moduleGap = compact ? 9 : 12;
      const moduleWidth = stepperWidth * 2 + tallyWidth + moduleGap * 2;

      if (compact) {
        this.placeRail([
          {
            width: moduleWidth,
            place: (centre, placed) => {
              const shrink = placed / moduleWidth;
              const stepper = Math.round(stepperWidth * shrink);
              const tally = Math.round(tallyWidth * shrink);
              const step = (stepper + tally) / 2 + moduleGap * shrink;
              // The steppers bracket the readout on the module's own gap, so
              // that gap, not the rail's, is what bounds their hit padding.
              const innerPad = hitGap(moduleGap * shrink);
              this.decrementButton.resize({ width: stepper, hitPaddingX: innerPad }).setPosition(centre - step, controlY);
              this.tallyFrame.setSize(tally, 44).setPosition(centre, controlY);
              this.answerText.setFontSize(26).setPosition(centre, controlY);
              this.incrementButton.resize({ width: stepper, hitPaddingX: innerPad }).setPosition(centre + step, controlY);
              this.adjustCaption.setPosition(centre, captionY).setVisible(height >= 420);
            },
          },
          {
            width: submitWidth,
            place: (centre, placed, pad) => {
              // The label has to stay inside its own button when the rail
              // has compressed it, so the type steps down with the width.
              this.submitCountButton
                .resize({ width: placed, fontSize: placed < 118 ? 11 : 13, hitPaddingX: pad })
                .setPosition(centre, controlY);
              this.submitCaption.setPosition(centre, captionY).setVisible(height >= 420);
            },
          },
        ], { width, margin: 16, minGap: 12 });
      } else {
        const groupCentre = width / 2 - 150;
        const submitX = width / 2 + 130;
        const step = (stepperWidth + tallyWidth) / 2 + moduleGap * 2;
        this.decrementButton.resize({ width: stepperWidth }).setPosition(groupCentre - step, controlY);
        this.tallyFrame.setSize(tallyWidth, 46).setPosition(groupCentre, controlY);
        this.answerText.setFontSize(30).setPosition(groupCentre, controlY);
        this.incrementButton.resize({ width: stepperWidth }).setPosition(groupCentre + step, controlY);
        this.adjustCaption.setPosition(groupCentre, captionY).setVisible(height >= 420);
        this.submitCountButton.resize({ width: submitWidth }).setPosition(submitX, controlY);
        this.submitCaption.setPosition(submitX, captionY).setVisible(height >= 420);
      }

      if (compact) {
        this.placeRail([
          { width: 124, place: (centre, placed, pad) => this.resetButton.resize({ width: placed, hitPaddingX: pad }).setPosition(centre, height - 26) },
          { width: 96, place: (centre, placed, pad) => this.pauseButton.resize({ width: placed, hitPaddingX: pad }).setPosition(centre, height - 26) },
        ], { width, margin: Math.max(16, width * 0.12), minGap: 12 });
      } else {
        this.resetButton.resize({ width: 124 }).setPosition(width - 181, 48);
        this.pauseButton.resize({ width: 96 }).setPosition(width - 58, 48);
      }
      this.statusText.setPosition(width / 2, height - (compact ? 134 : 88));
    } else if (this.isChangeMode) {
      const split = this.splitView;
      const usableWidth = split ? Math.floor(width / 2) : width;
      const controlY = compact ? height - 76 : height - 34;

      const segmentWidth = compact ? 84 : 96;
      const segmentGap = 4;
      const segmentPairWidth = segmentWidth * 2 + segmentGap;
      const placeSegments = (centre, placed) => {
        const half = (placed - segmentGap) / 2;
        // They read as one segmented control, so the seam between them is the
        // gap that bounds their padding, not the rail's.
        const seamPad = hitGap(segmentGap);
        this.passAButton.resize({ width: Math.round(half), hitPaddingX: seamPad })
          .setPosition(Math.round(centre - half / 2 - segmentGap / 2), controlY);
        this.passBButton.resize({ width: Math.round(half), hitPaddingX: seamPad })
          .setPosition(Math.round(centre + half / 2 + segmentGap / 2), controlY);
        this.passCaption.setPosition(centre, controlY - 32).setVisible(!split && height >= 420);
      };

      if (compact && !split) {
        // MARK and the A/B segments share one narrow rail. Below roughly
        // 390px the fixed offsets put them on top of each other.
        this.placeRail([
          { width: 128, place: (centre, placed, pad) => this.markButton.resize({ width: placed, hitPaddingX: pad }).setPosition(centre, controlY) },
          { width: segmentPairWidth, place: placeSegments },
        ], { width, margin: 16, minGap: 12 });
      } else {
        this.markButton.resize({ width: 150 })
          .setPosition(split ? usableWidth * 0.22 : width / 2 - 210, controlY);
        placeSegments(width / 2 + 10, segmentPairWidth);
      }
      this.splitButton.setPosition(split ? usableWidth * 0.78 : width / 2 + 190, controlY);
      this.splitButton.setVisible(width >= GAME_CONFIG.change.splitViewMinWidth);
      this.passAButton.setVisible(!split);
      this.passBButton.setVisible(!split);

      if (split || !compact) {
        this.resetButton.resize({ width: 124 }).setPosition(width - 181, 48);
        this.pauseButton.resize({ width: 96 }).setPosition(width - 58, 48);
      } else {
        this.placeRail([
          { width: 124, place: (centre, placed, pad) => this.resetButton.resize({ width: placed, hitPaddingX: pad }).setPosition(centre, height - 26) },
          { width: 96, place: (centre, placed, pad) => this.pauseButton.resize({ width: placed, hitPaddingX: pad }).setPosition(centre, height - 26) },
        ], { width, margin: Math.max(16, width * 0.12), minGap: 12 });
      }
      this.confirmButton.setPosition(split ? usableWidth / 2 - 60 : width / 2 - 60, height - (compact ? 132 : 82));
      this.cancelButton.setPosition(split ? usableWidth / 2 + 60 : width / 2 + 60, height - (compact ? 132 : 82));
      this.passStatusText.setPosition(split ? usableWidth / 2 : width / 2, GAME_CONFIG.recon.hudHeight + 20);
      this.statusText.setPosition(split ? usableWidth / 2 : width / 2, height - (compact ? 178 : 126));
    } else {
      // Phone rail: the primary action leads, the two utilities share the tail
      // of the row at their own smaller sizes.
      if (compact) {
        this.placeRail([
          { width: 150, place: (centre, placed, pad) => this.markButton.resize({ width: placed, hitPaddingX: pad }).setPosition(centre, height - 34) },
          { width: 104, place: (centre, placed, pad) => this.resetButton.resize({ width: placed, hitPaddingX: pad }).setPosition(centre, height - 34) },
          { width: 84, place: (centre, placed, pad) => this.pauseButton.resize({ width: placed, hitPaddingX: pad }).setPosition(centre, height - 34) },
        ], { width, margin: 14, minGap: 10 });
      } else {
        this.markButton.resize({ width: 170 }).setPosition(width - 340, 48);
        this.resetButton.resize({ width: 124 }).setPosition(width - 181, 48);
        this.pauseButton.resize({ width: 96 }).setPosition(width - 58, 48);
      }
      this.confirmButton.setPosition(width / 2 - 60, height - (compact ? 86 : 40));
      this.cancelButton.setPosition(width / 2 + 60, height - (compact ? 86 : 40));
      this.statusText.setPosition(width / 2, height - (compact ? 128 : 88));
    }

    const narrowHud = width < 680;
    // The objective wraps clear of the timer, including in split view where
    // the readouts move into the pane the analyst still controls.
    this.objectiveText
      .setFontSize(narrowHud ? 10 : 15)
      .setWordWrapWidth(Math.max(150, readoutRight - 120))
      .setVisible(width >= 320);
    // The chip follows the objective block, so a long objective that wraps to
    // three lines on a phone can never sit under it.
    const chipY = Phaser.Math.Clamp(13 + this.objectiveText.height + 3, 34, 56);
    this.modeChip.setPosition(16, chipY).setVisible(width >= 320);
    this.modeDetail.setY(chipY + 9);
    this.coordText.setY(chipY + 9);
    this.modeDetail.setVisible(width >= 470);
    this.coordText.setVisible(width >= 560);
    this.refreshModeStrip();
  }

  cleanup() {
    this.timerEvent?.remove(false);
    this.statusTimer?.remove(false);
    this.weatherOverlay?.destroy();
    this.weatherOverlay = null;
    // Split view is only forgotten here, never unwound. Phaser reuses this
    // scene instance, so the flag must not survive into the next mission;
    // the cameras it owned are the camera manager's to dispose of, and
    // reaching for them during shutdown threw and left the game with no
    // active scene at all after a CHANGE mission finished in split view.
    this.splitView = false;
    this.compareCamera = null;
    this.scale.off('resize', this.onResize, this);
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
  }
}
