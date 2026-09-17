import Phaser from 'phaser';
import { GAME_CONFIG } from '../runtime-config.js';
import { preloadSpriteSheets, registerSpriteFrames } from '../assets/registerSpriteFrames.js';
import { createTerminalChrome, drawReticle, prefersReducedMotion } from '../ui/presentation.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() { preloadSpriteSheets(this); }

  create() {
    registerSpriteFrames(this);
    this.cameras.main.setBackgroundColor(GAME_CONFIG.palette.black);
    this.reducedMotion = prefersReducedMotion();
    this.chrome = createTerminalChrome(this, {
      station: 'INTELLIGENCE DIRECTORATE // ORBITAL RECONNAISSANCE',
      classification: GAME_CONFIG.presentation.classification,
    });

    this.graphics = this.add.graphics().setDepth(20);
    this.title = this.add.text(0, 0, 'SATELLITE LINK ACQUISITION', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '22px',
      color: GAME_CONFIG.palette.offWhite,
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.status = this.add.text(0, 0, 'INITIALIZING ORBITAL IMAGERY CHANNEL...', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '12px',
      color: GAME_CONFIG.palette.lightGray,
      align: 'center',
    }).setOrigin(0.5);
    this.telemetry = this.add.text(0, 0, 'TRACK: 071 // SENSOR: OPTICAL\nLINK: ENCRYPTED // GRID DATUM: VERIFIED', {
      fontFamily: GAME_CONFIG.typography.family,
      fontSize: '10px',
      color: GAME_CONFIG.palette.gray,
      lineSpacing: 5,
      align: 'center',
    }).setOrigin(0.5);

    this.sweep = this.add.rectangle(0, 0, 2, 100, 0xf6f6ee, 0.18).setDepth(19);
    this.layout(this.scale.gameSize);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: this.sweep,
        x: this.scale.gameSize.width * 0.68,
        duration: 760,
        ease: 'Sine.InOut',
      });
      this.time.delayedCall(260, () => this.status.setText('EPHEMERIS VERIFIED // ORBITAL TRACK LOCKED'));
      this.time.delayedCall(610, () => this.status.setText('IMAGERY CHANNEL OPEN // ANALYSIS CONSOLE READY'));
    } else {
      this.status.setText('IMAGERY CHANNEL OPEN // ANALYSIS CONSOLE READY');
    }

    this.time.delayedCall(this.reducedMotion ? 180 : GAME_CONFIG.presentation.bootDurationMs, () => this.scene.start('MainMenu'));
  }

  layout(gameSize) {
    const { width, height } = gameSize;
    this.chrome.layout(gameSize);
    const cx = width / 2;
    const cy = height * 0.43;
    const radius = Math.max(30, Math.min(52, width * 0.08));

    this.graphics.clear();
    drawReticle(this.graphics, cx, cy, radius, 0.7);
    this.graphics.lineStyle(1, 0xbdbdbd, 0.35);
    this.graphics.strokeRect(cx - radius - 34, cy - radius - 34, radius * 2 + 68, radius * 2 + 68);
    this.graphics.lineBetween(cx - radius - 34, cy + radius + 52, cx + radius + 34, cy + radius + 52);

    this.sweep.setPosition(cx - radius - 30, cy).setSize(2, radius * 2 + 60);
    this.title.setFontSize(width < 520 ? 16 : 22).setPosition(cx, cy - radius - 64);
    this.status.setPosition(cx, cy + radius + 76).setWordWrapWidth(Math.min(560, width - 50));
    this.telemetry.setPosition(cx, cy + radius + 122).setVisible(height >= 480);
  }
}
