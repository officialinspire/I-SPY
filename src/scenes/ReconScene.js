import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { createButton } from '../ui/createButton.js';
import { createPlaceholderReconMap } from '../world/createPlaceholderReconMap.js';

export default class ReconScene extends Phaser.Scene {
  constructor() {
    super('Recon');
  }

  create() {
    const cfg = GAME_CONFIG.recon;
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.cameras.main.setBounds(0, 0, cfg.worldWidth, cfg.worldHeight);
    this.cameras.main.setZoom(0.75);
    this.cameras.main.centerOn(cfg.worldWidth / 2, cfg.worldHeight / 2);

    this.worldLayer = createPlaceholderReconMap(this, cfg.worldWidth, cfg.worldHeight);
    this.createHud();
    this.createGridOverlay();
    this.bindInput();

    this.scale.on('resize', this.onResize, this);
    this.onResize(this.scale.gameSize);
  }

  createHud() {
    const hudHeight = GAME_CONFIG.recon.hudHeight;
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.hudBackground = this.add.rectangle(0, 0, 10, hudHeight, 0x0b0b0b, 0.96).setOrigin(0);
    this.hudBorder = this.add.rectangle(0, hudHeight - 2, 10, 2, 0xe8e8df).setOrigin(0);

    this.missionText = this.add.text(16, 12, 'OP NIGHT GLASS // TRAINING PASS', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '14px',
      color: GAME_CONFIG.palette.offWhite,
    });
    this.objectiveText = this.add.text(16, 39, 'OBJECTIVE: VISUAL RECONNAISSANCE', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '12px',
      color: GAME_CONFIG.palette.lightGray,
    });
    this.coordText = this.add.text(16, 58, 'GRID: ---- / ----', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '11px',
      color: GAME_CONFIG.palette.gray,
    });
    this.timerText = this.add.text(0, 15, 'T--:--', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '16px',
      color: GAME_CONFIG.palette.offWhite,
    }).setOrigin(1, 0);

    this.hud.add([this.hudBackground, this.hudBorder, this.missionText, this.objectiveText, this.coordText, this.timerText]);

    this.markButton = createButton(this, 0, 0, 'MARK TARGET', () => this.flashStatus('TARGET MARKING AVAILABLE IN PHASE 2'), { width: 170, height: 36, fontSize: 13 });
    this.pauseButton = createButton(this, 0, 0, 'PAUSE', () => this.togglePause(), { width: 96, height: 36, fontSize: 13 });
    this.resetButton = createButton(this, 0, 0, 'RESET VIEW', () => this.resetView(), { width: 124, height: 36, fontSize: 12 });
    [this.markButton, this.pauseButton, this.resetButton].forEach((button) => {
      button.background.setScrollFactor(0).setDepth(1002);
      button.text.setScrollFactor(0).setDepth(1003);
    });

    this.statusText = this.add.text(0, 0, '', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '12px',
      color: GAME_CONFIG.palette.offWhite,
      backgroundColor: GAME_CONFIG.palette.nearBlack,
      padding: { x: 10, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1010).setVisible(false);
  }

  createGridOverlay() {
    this.grid = this.add.graphics().setDepth(900).setAlpha(0.18);
    this.grid.lineStyle(2, 0xf6f6ee, 1);
    for (let x = 0; x <= GAME_CONFIG.recon.worldWidth; x += 300) this.grid.lineBetween(x, 0, x, GAME_CONFIG.recon.worldHeight);
    for (let y = 0; y <= GAME_CONFIG.recon.worldHeight; y += 300) this.grid.lineBetween(0, y, GAME_CONFIG.recon.worldWidth, y);
  }

  bindInput() {
    this.dragging = false;
    this.paused = false;
    this.pinchDistance = null;

    this.input.on('pointerdown', (pointer) => {
      if (this.paused || pointer.y < GAME_CONFIG.recon.hudHeight) return;
      this.dragging = true;
      this.lastPointer = { x: pointer.x, y: pointer.y };
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.paused) this.updateCoordinates(pointer);
      if (!this.dragging || !pointer.isDown || this.paused) return;
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
      if (this.paused || pointer.y < GAME_CONFIG.recon.hudHeight) return;
      this.zoomAt(pointer, deltaY > 0 ? -GAME_CONFIG.recon.zoomStep : GAME_CONFIG.recon.zoomStep);
    });

    this.input.on('pointermove', () => {
      const pointers = this.input.manager.pointers.filter((p) => p.isDown);
      if (pointers.length !== 2 || this.paused) {
        this.pinchDistance = null;
        return;
      }
      const distance = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y);
      if (this.pinchDistance !== null) {
        const delta = (distance - this.pinchDistance) * 0.0035;
        const midpoint = {
          x: (pointers[0].x + pointers[1].x) / 2,
          y: (pointers[0].y + pointers[1].y) / 2,
        };
        this.zoomAt(midpoint, delta);
      }
      this.pinchDistance = distance;
    });

    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
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
    const x = Phaser.Math.Clamp(Math.round(world.x), 0, GAME_CONFIG.recon.worldWidth);
    const y = Phaser.Math.Clamp(Math.round(world.y), 0, GAME_CONFIG.recon.worldHeight);
    this.coordText.setText(`GRID: ${String(x).padStart(4, '0')} / ${String(y).padStart(4, '0')}`);
  }

  resetView() {
    const camera = this.cameras.main;
    camera.setZoom(0.75);
    camera.centerOn(GAME_CONFIG.recon.worldWidth / 2, GAME_CONFIG.recon.worldHeight / 2);
    this.flashStatus('VIEW RECENTERED');
  }

  togglePause() {
    this.paused = !this.paused;
    this.dragging = false;
    this.flashStatus(this.paused ? 'RECON PAUSED // ESC TO RESUME' : 'RECON RESUMED');
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
    this.markButton.setPosition(compact ? 92 : width - 288, compact ? height - 34 : 48);
    this.resetButton.setPosition(compact ? width / 2 : width - 137, compact ? height - 34 : 48);
    this.pauseButton.setPosition(compact ? width - 58 : width - 54, compact ? height - 34 : 48);
    this.statusText.setPosition(width / 2, height - (compact ? 82 : 30));

    this.objectiveText.setVisible(width >= 520);
    this.coordText.setVisible(width >= 420);
  }
}
