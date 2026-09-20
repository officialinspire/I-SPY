import Phaser from 'phaser';
import { unlockAudio } from '../audio/feedback.js';
import { inspireIntroUrl } from '../assets/brandAssets.js';
import { musicManager, MUSIC_STATES } from '../audio/musicManager.js';
import { unlockSamples } from '../audio/sampleFeedback.js';

/**
 * How long the console waits for the intro to actually start playing before
 * it gives up and opens the menu. A device that accepts play() but never
 * paints a frame (slow mobile network, throttled background tab) must not
 * leave the analyst looking at a black screen.
 */
const PLAYBACK_WATCHDOG_MS = 6000;

/**
 * The only pre-menu route. Keeping the media gate in its own scene prevents
 * browser autoplay policy and DOM video lifecycle from leaking into missions.
 */
export default class StartIntroScene extends Phaser.Scene {
  constructor() { super('StartIntro'); }

  create() {
    musicManager.request(MUSIC_STATES.SILENT);
    this.started = false;
    this.finished = false;
    // The branded intro is optional decoration. The start gate is not: it is
    // the one user gesture that unlocks Web Audio for the whole session.
    this.videoUsable = true;

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
      event.preventDefault();
      event.stopPropagation();
      this.finish();
    };

    // A media failure before the analyst has pressed START must never dismiss
    // the gate. Doing so skipped the only trusted gesture the session gets,
    // and every browser then refused to start music and SFX for the whole
    // run. Browsers without the intro's codec (and any blocked or failed
    // download) take this route, so it has to keep the console playable.
    this.onVideoUnavailable = () => {
      this.videoUsable = false;
      if (this.started) this.finish();
    };
    // Playback reached the analyst, so the watchdog has nothing left to guard.
    this.onVideoPlaying = () => this.clearWatchdog();
    this.onVideoFinished = () => this.finish();

    // pointerdown is one path for mouse, pen, and touch and remains inside the
    // browser's trusted gesture stack when video.play() is called. click is
    // kept beside it for keyboard activation and for engines that withhold
    // pointer events from a control layered over a playing video.
    this.startButton.addEventListener('pointerdown', this.onStartPointer);
    this.startButton.addEventListener('touchend', this.onStartPointer, { passive: false });
    this.startButton.addEventListener('click', this.onStartPointer);
    this.skipButton.addEventListener('pointerdown', this.onSkip);
    this.skipButton.addEventListener('touchend', this.onSkip, { passive: false });
    this.skipButton.addEventListener('click', this.onSkip);
    document.addEventListener('keydown', this.onKey);
    this.video.addEventListener('ended', this.onVideoFinished, { once: true });
    this.video.addEventListener('error', this.onVideoUnavailable);
    this.video.addEventListener('playing', this.onVideoPlaying);
    this.startButton.focus({ preventScroll: true });

    this.events.once('shutdown', () => this.destroyOverlay());
  }

  beginIntro() {
    if (this.started || this.finished) return;
    this.started = true;
    // Always taken, on every route out of this gate: this press is the
    // session's audio unlock whether or not the intro can be played.
    unlockAudio();
    this.sound.unlock();
    musicManager.unlock();
    unlockSamples();

    // A media element that already failed has nothing to show. Go straight to
    // the console rather than holding the analyst on a black screen.
    if (!this.videoUsable || this.video?.error) {
      this.finish();
      return;
    }

    this.startPanel.hidden = true;
    this.video.classList.add('is-visible');
    this.skipButton.classList.add('is-visible');
    this.skipButton.focus({ preventScroll: true });

    // Playback is deliberately requested only here, in the initiating user
    // gesture. A rejected promise is a valid route onward, never a dead end.
    const playback = this.video.play();
    if (playback?.catch) playback.catch(() => this.finish());
    this.watchdog = window.setTimeout(() => {
      this.watchdog = null;
      // Nothing has been painted and nothing has errored: treat the intro as
      // unavailable rather than stranding the analyst.
      if (!this.finished && !(this.video?.currentTime > 0)) this.finish();
    }, PLAYBACK_WATCHDOG_MS);
  }

  clearWatchdog() {
    if (this.watchdog === null || this.watchdog === undefined) return;
    window.clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.clearWatchdog();
    this.video?.pause();
    this.destroyOverlay();
    this.scene.start('MainMenu');
  }

  destroyOverlay() {
    this.clearWatchdog();
    if (!this.overlay) return;
    document.removeEventListener('keydown', this.onKey);
    this.startButton?.removeEventListener('pointerdown', this.onStartPointer);
    this.startButton?.removeEventListener('touchend', this.onStartPointer);
    this.startButton?.removeEventListener('click', this.onStartPointer);
    this.skipButton?.removeEventListener('pointerdown', this.onSkip);
    this.skipButton?.removeEventListener('touchend', this.onSkip);
    this.skipButton?.removeEventListener('click', this.onSkip);
    this.video?.removeEventListener('ended', this.onVideoFinished);
    this.video?.removeEventListener('error', this.onVideoUnavailable);
    this.video?.removeEventListener('playing', this.onVideoPlaying);
    this.video?.removeAttribute('src');
    this.video?.load();
    this.overlay?.remove();
    this.overlay = null;
    this.startPanel = null;
    this.startButton = null;
    this.skipButton = null;
    this.video = null;
  }
}
