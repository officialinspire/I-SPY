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
    const compact = width < 560;
    const short = height < 500;
    const cx = width / 2;
    const cy = short ? height * 0.44 : height * 0.43;
    const radius = Math.max(short ? 24 : 30, Math.min(short ? 42 : 54, width * (compact ? 0.09 : 0.075)));
    const framePad = compact ? 24 : 34;

    this.graphics.clear();
    this.graphics.fillStyle(0x171717, 0.22).fillRect(cx - radius - framePad, cy - radius - framePad, (radius + framePad) * 2, (radius + framePad) * 2);
    drawReticle(this.graphics, cx, cy, radius, 0.74);
    this.graphics.lineStyle(1, 0xbdbdbd, 0.36);
    this.graphics.strokeRect(cx - radius - framePad, cy - radius - framePad, (radius + framePad) * 2, (radius + framePad) * 2);
    this.graphics.lineStyle(1, 0xbdbdbd, 0.25);
    this.graphics.lineBetween(cx - radius - framePad, cy + radius + framePad + 16, cx + radius + framePad, cy + radius + framePad + 16);

    this.sweep.setPosition(cx - radius - framePad + 4, cy).setSize(2, radius * 2 + framePad * 1.5);
    this.title
      .setFontSize(compact ? (short ? 13 : 16) : (short ? 18 : 22))
      .setPosition(cx, cy - radius - framePad - (short ? 28 : 38))
      .setWordWrapWidth(Math.min(620, width - 36));
    this.status
      .setFontSize(compact ? 10 : 12)
      .setPosition(cx, cy + radius + framePad + (short ? 36 : 48))
      .setWordWrapWidth(Math.min(580, width - 36));
    this.telemetry
      .setFontSize(compact ? 8 : 10)
      .setPosition(cx, cy + radius + framePad + (short ? 67 : 88))
      .setVisible(height >= 430);
  }
}
