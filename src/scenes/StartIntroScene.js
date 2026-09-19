import Phaser from 'phaser';
import { unlockAudio } from '../audio/feedback.js';
import { inspireIntroUrl } from '../assets/brandAssets.js';

/**
 * The only pre-menu route. Keeping the media gate in its own scene prevents
 * browser autoplay policy and DOM video lifecycle from leaking into missions.
 */
export default class StartIntroScene extends Phaser.Scene {
  constructor() { super('StartIntro'); }

  create() {
    this.started = false;
    this.finished = false;

    this.overlay = document.createElement('section');
    this.overlay.className = 'intro-gate';
    this.overlay.setAttribute('aria-label', 'I SPY introduction');
    this.overlay.innerHTML = `
      <div class="intro-start">
        <p class="intro-start__eyebrow">I SPY // ANALYSIS CONSOLE</p>
        <button class="intro-start__button" type="button">TOUCH / CLICK TO START</button>
        <p class="intro-start__hint">PRESS ENTER OR SPACE</p>
      </div>
      <video class="intro-video" preload="auto" playsinline disablepictureinpicture aria-label="Inspire Software introduction"></video>
      <button class="intro-skip" type="button">SKIP INTRO</button>
    `;
    document.getElementById('app').appendChild(this.overlay);

    this.startPanel = this.overlay.querySelector('.intro-start');
    this.startButton = this.overlay.querySelector('.intro-start__button');
    this.video = this.overlay.querySelector('.intro-video');
    this.skipButton = this.overlay.querySelector('.intro-skip');
    this.video.src = inspireIntroUrl;

    this.onStartPointer = (event) => {
      event.preventDefault();
      this.beginIntro();
    };
    this.onKey = (event) => {
      if (!this.started && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.beginIntro();
      } else if (this.started && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.finish();
      }
    };
    this.onSkip = (event) => {
      event.stopPropagation();
      this.finish();
    };

    // pointerdown is one path for mouse, pen, and touch and remains inside the
    // browser's trusted gesture stack when video.play() is called.
    this.startButton.addEventListener('pointerdown', this.onStartPointer);
    this.startButton.addEventListener('click', this.onStartPointer);
    this.skipButton.addEventListener('pointerdown', this.onSkip);
    document.addEventListener('keydown', this.onKey);
    this.video.addEventListener('ended', () => this.finish(), { once: true });
    this.video.addEventListener('error', () => this.finish(), { once: true });
    this.startButton.focus({ preventScroll: true });

    this.events.once('shutdown', () => this.destroyOverlay());
  }

  beginIntro() {
    if (this.started || this.finished) return;
    this.started = true;
    unlockAudio();
    this.sound.unlock();
    this.startPanel.hidden = true;
    this.video.classList.add('is-visible');
    this.skipButton.classList.add('is-visible');
    this.skipButton.focus({ preventScroll: true });

    // Playback is deliberately requested only here, in the initiating user
    // gesture. A rejected promise is a valid route onward, never a dead end.
    const playback = this.video.play();
    if (playback?.catch) playback.catch(() => this.finish());
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.video?.pause();
    this.destroyOverlay();
    this.scene.start('MainMenu');
  }

  destroyOverlay() {
    document.removeEventListener('keydown', this.onKey);
    this.startButton?.removeEventListener('pointerdown', this.onStartPointer);
    this.startButton?.removeEventListener('click', this.onStartPointer);
    this.skipButton?.removeEventListener('pointerdown', this.onSkip);
    this.video?.removeAttribute('src');
    this.video?.load();
    this.overlay?.remove();
    this.overlay = null;
  }
}
