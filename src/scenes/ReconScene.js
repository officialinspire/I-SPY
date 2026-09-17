import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createAuthoredReconMap, entityAtPoint } from '../world/authoredReconMap.js';
import { createLocateMission, validateIdentification, calculateLocateScore } from '../game/locateMission.js';

export default class ReconScene extends Phaser.Scene {
  constructor() {
    super('Recon');
  }

  create(data = {}) {
    this.mission = data.mission ?? createLocateMission();
    this.falseIdentifications = 0;
    this.remainingSeconds = this.mission.timeLimitSeconds;
    this.missionStartedAt = this.time.now;
    this.missionEnded = false;
    this.marking = false;
    this.candidate = null;

    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    const world = createAuthoredReconMap(this);
    this.worldLayer = world.root;
    this.map = world.map;
    this.entities = world.entities;
    this.spawnZones = world.spawnZones;
    this.mapMetadata = world.metadata;

    this.cameras.main.setBounds(0, 0, this.map.width, this.map.height);
    this.resetCamera(false);

    this.createHud();
    this.createGridOverlay();
    this.createSelectionOverlay();
    this.bindInput();
    this.startMissionTimer();

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.cleanup());
    this.onResize(this.scale.gameSize);
  }

  createHud() {
    const hudHeight = GAME_CONFIG.recon.hudHeight;
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.hudBackground = this.add.rectangle(0, 0, 10, hudHeight, 0x0b0b0b, 0.96).setOrigin(0);
    this.hudBorder = this.add.rectangle(0, hudHeight - 2, 10, 2, 0xe8e8df).setOrigin(0);

    this.missionText = this.add.text(16, 12, `${this.mission.operation} // ${this.mission.mode}`, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '14px', color: GAME_CONFIG.palette.offWhite,
    });
    this.objectiveText = this.add.text(16, 39, `OBJECTIVE: ${this.mission.objective}`, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '12px', color: GAME_CONFIG.palette.lightGray,
    });
    this.coordText = this.add.text(16, 58, `MAP: ${this.map.id.toUpperCase()} // GRID: ---- / ----`, {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '11px', color: GAME_CONFIG.palette.gray,
    });
    this.timerText = this.add.text(0, 15, this.formatTime(this.remainingSeconds), {
      fontFamily: GAME_CONFIG.typography.family, fontSize: '16px', color: GAME_CONFIG.palette.offWhite,
    }).setOrigin(1, 0);

    this.hud.add([this.hudBackground, this.hudBorder, this.missionText, this.objectiveText, this.coordText, this.timerText]);

    this.markButton = createButton(this, 0, 0, 'MARK TARGET', () => this.armMarking(), { width: 170, height: 36, fontSize: 13 });
    this.pauseButton = createButton(this, 0, 0, 'PAUSE', () => this.togglePause(), { width: 96, height: 36, fontSize: 13 });
    this.resetButton = createButton(this, 0, 0, 'RESET VIEW', () => this.resetView(), { width: 124, height: 36, fontSize: 12 });
    this.confirmButton = createButton(this, 0, 0, 'CONFIRM', () => this.confirmCandidate(), { width: 112, height: 34, fontSize: 12 });
    this.cancelButton = createButton(this, 0, 0, 'CANCEL', () => this.cancelCandidate(), { width: 100, height: 34, fontSize: 12 });

    [this.markButton, this.pauseButton, this.resetButton, this.confirmButton, this.cancelButton].forEach((button) => {
      button.background.setScrollFactor(0).setDepth(1002);
      button.text.setScrollFactor(0).setDepth(1003);
    });
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);

    this.statusText = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '12px',
      color: GAME_CONFIG.palette.offWhite,
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1010).setVisible(false);
  }

  createGridOverlay() {
    const gridSize = this.mapMetadata.gridSize ?? 300;
    this.grid = this.add.graphics().setDepth(900).setAlpha(0.18);
    this.grid.lineStyle(2, 0xf6f6ee, 1);
    for (let x = 0; x <= this.map.width; x += gridSize) this.grid.lineBetween(x, 0, x, this.map.height);
    for (let y = 0; y <= this.map.height; y += gridSize) this.grid.lineBetween(0, y, this.map.width, y);
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
      this.entities.forEach((entity) => this.debugGraphics.strokeRect(entity.x, entity.y, entity.width, entity.height));
    }
  }

  bindInput() {
    this.dragging = false;
    this.paused = false;
    this.pinchDistance = null;

    this.input.on('pointerdown', (pointer) => {
      if (this.paused || this.missionEnded || this.isHudPoint(pointer)) return;
      if (this.marking) {
        this.placeCandidate(pointer);
        return;
      }
      this.dragging = true;
      this.lastPointer = { x: pointer.x, y: pointer.y };
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.paused) this.updateCoordinates(pointer);
      if (!this.dragging || !pointer.isDown || this.paused || this.marking) return;
      const camera = this.cameras.main;
      const dx = pointer.x - this.lastPointer.x;
      const dy = pointer.y - this.lastPointer.y;
      camera.scrollX -= dx / camera.zoom;
      camera.scrollY -= dy / camera.zoom;
      this.lastPointer = { x: pointer.x, y: pointer.y };
    });

    this.input.on('pointerup', () => {
      this.dragging = false;
      this.pinchDistance = null;
    });

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (this.paused || this.missionEnded || this.isHudPoint(pointer)) return;
      this.zoomAt(pointer, deltaY > 0 ? -GAME_CONFIG.recon.zoomStep : GAME_CONFIG.recon.zoomStep);
    });

    this.input.on('pointermove', () => {
      const pointers = this.input.manager.pointers.filter((pointer) => pointer.isDown);
      if (pointers.length !== 2 || this.paused || this.marking) {
        this.pinchDistance = null;
        return;
      }
      const distance = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y);
      if (this.pinchDistance !== null) {
        const delta = (distance - this.pinchDistance) * 0.0035;
        const midpoint = { x: (pointers[0].x + pointers[1].x) / 2, y: (pointers[0].y + pointers[1].y) / 2 };
        this.zoomAt(midpoint, delta);
      }
      this.pinchDistance = distance;
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.candidate) this.cancelCandidate(); else this.togglePause();
    });
  }

  isHudPoint(pointer) {
    if (pointer.y < GAME_CONFIG.recon.hudHeight) return true;
    return this.scale.gameSize.width < 680 && pointer.y > this.scale.gameSize.height - 64;
  }

  armMarking() {
    if (this.paused || this.missionEnded) return;
    this.marking = true;
    this.candidate = null;
    this.selectionGraphics.clear();
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);
    this.markButton.setLabel('SELECT OBJECT');
    this.flashStatus('MARKING ACTIVE // TAP AN OBJECT');
  }

  placeCandidate(pointer) {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const entity = entityAtPoint(world.x, world.y, this.entities);
    this.candidate = { x: world.x, y: world.y, entity };
    this.selectionGraphics.clear();
    this.selectionGraphics.lineStyle(4, 0xf6f6ee, 1).strokeCircle(world.x, world.y, 26 / this.cameras.main.zoom);
    this.selectionGraphics.lineBetween(world.x - 34, world.y, world.x + 34, world.y);
    this.selectionGraphics.lineBetween(world.x, world.y - 34, world.x, world.y + 34);
    this.confirmButton.setVisible(true);
    this.cancelButton.setVisible(true);
    this.markButton.setLabel('MARK PENDING');
    this.flashStatus(entity ? 'IDENTIFICATION READY // CONFIRM OR CANCEL' : 'NO CLEAR OBJECT // CONFIRM OR CANCEL');
  }

  cancelCandidate() {
    this.marking = false;
    this.candidate = null;
    this.selectionGraphics.clear();
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);
    this.markButton.setLabel('MARK TARGET');
    this.flashStatus('MARK CANCELLED');
  }

  confirmCandidate() {
    if (!this.candidate || this.missionEnded) return;
    const result = validateIdentification(this.mission, this.candidate.entity);
    this.confirmButton.setVisible(false);
    this.cancelButton.setVisible(false);
    this.marking = false;
    this.markButton.setLabel('MARK TARGET');

    if (result.correct) {
      this.flashStatus('CONFIRMED');
      this.selectionGraphics.lineStyle(5, 0xf6f6ee, 1);
      this.time.delayedCall(350, () => this.finishMission(true));
      return;
    }

    this.falseIdentifications += 1;
    this.flashStatus(`UNVERIFIED // FALSE ID ${this.falseIdentifications}`);
    this.selectionGraphics.clear();
    this.candidate = null;
  }

  startMissionTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        if (this.paused || this.missionEnded) return;
        const elapsed = (this.time.now - this.missionStartedAt - (this.totalPausedMs ?? 0)) / 1000;
        this.remainingSeconds = Math.max(0, this.mission.timeLimitSeconds - elapsed);
        this.timerText.setText(this.formatTime(this.remainingSeconds));
        if (this.remainingSeconds <= 0) this.finishMission(false);
      },
    });
  }

  finishMission(success) {
    if (this.missionEnded) return;
    this.missionEnded = true;
    this.timerEvent?.remove(false);
    const remainingSeconds = Math.max(0, Math.floor(this.remainingSeconds));
    const elapsedSeconds = Math.max(0, Math.ceil(this.mission.timeLimitSeconds - remainingSeconds));
    const score = calculateLocateScore({ success, falseIdentifications: this.falseIdentifications, remainingSeconds });
    this.scene.start('Results', {
      success,
      mission: this.mission,
      targetLabel: this.mission.targetLabel,
      elapsedSeconds,
      falseIdentifications: this.falseIdentifications,
      score,
    });
  }

  zoomAt(screenPoint, delta) {
    const camera = this.cameras.main;
    const before = camera.getWorldPoint(screenPoint.x, screenPoint.y);
    const nextZoom = Phaser.Math.Clamp(camera.zoom + delta, GAME_CONFIG.recon.minZoom, GAME_CONFIG.recon.maxZoom);
    camera.setZoom(nextZoom);
    const after = camera.getWorldPoint(screenPoint.x, screenPoint.y);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
  }

  updateCoordinates(pointer) {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = Phaser.Math.Clamp(Math.round(world.x), 0, this.map.width);
    const y = Phaser.Math.Clamp(Math.round(world.y), 0, this.map.height);
    this.coordText.setText(`MAP: ${this.map.id.toUpperCase()} // GRID: ${String(x).padStart(4, '0')} / ${String(y).padStart(4, '0')}`);
  }

  resetCamera(showMessage = true) {
    const view = this.mapMetadata.recommendedView ?? { x: this.map.width / 2, y: this.map.height / 2, zoom: GAME_CONFIG.recon.defaultZoom };
    this.cameras.main.setZoom(Phaser.Math.Clamp(view.zoom ?? GAME_CONFIG.recon.defaultZoom, GAME_CONFIG.recon.minZoom, GAME_CONFIG.recon.maxZoom));
    this.cameras.main.centerOn(view.x ?? this.map.width / 2, view.y ?? this.map.height / 2);
    if (showMessage) this.flashStatus('VIEW RECENTERED');
  }

  resetView() {
    this.resetCamera(true);
  }

  togglePause() {
    if (this.missionEnded) return;
    this.paused = !this.paused;
    this.dragging = false;
    if (this.paused) this.pauseStartedAt = this.time.now;
    else if (this.pauseStartedAt) {
      this.totalPausedMs = (this.totalPausedMs ?? 0) + (this.time.now - this.pauseStartedAt);
      this.pauseStartedAt = null;
    }
    this.pauseButton.setLabel(this.paused ? 'RESUME' : 'PAUSE');
    this.flashStatus(this.paused ? 'RECON PAUSED // ESC TO RESUME' : 'RECON RESUMED');
  }

  formatTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(whole / 60);
    const remainder = whole % 60;
    return `T-${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  flashStatus(message) {
    this.statusText.setText(message).setVisible(true);
    this.statusTimer?.remove(false);
    this.statusTimer = this.time.delayedCall(1700, () => this.statusText.setVisible(false));
  }

  onResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.hudBackground.width = width;
    this.hudBorder.width = width;
    this.timerText.setPosition(width - 16, 13);

    const compact = width < 680;
    this.markButton.setPosition(compact ? 88 : width - 340, compact ? height - 34 : 48);
    this.resetButton.setPosition(compact ? width / 2 : width - 181, compact ? height - 34 : 48);
    this.pauseButton.setPosition(compact ? width - 56 : width - 58, compact ? height - 34 : 48);
    this.confirmButton.setPosition(width / 2 - 60, height - (compact ? 86 : 40));
    this.cancelButton.setPosition(width / 2 + 60, height - (compact ? 86 : 40));
    this.statusText.setPosition(width / 2, height - (compact ? 128 : 88));

    this.objectiveText.setVisible(width >= 620);
    this.coordText.setVisible(width >= 520);
  }

  cleanup() {
    this.timerEvent?.remove(false);
    this.scale.off('resize', this.onResize, this);
    this.input.removeAllListeners();
  }
}
