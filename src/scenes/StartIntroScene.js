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
 * How long the gate keeps swallowing input after it has handed over.
 *
 * Long enough to cover the compatibility mouse cascade, which a mobile
 * browser sends up to about 300ms after an un-prevented touchend.
 */
const HANDOVER_SHIELD_MS = 450;

const SHIELD_EVENTS = Object.freeze([
  'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click',
  'touchstart', 'touchend', 'contextmenu',
]);

/**
 * Swallow the remainder of the gesture that dismissed the start gate.
 *
 * The gate is a DOM layer; the console behind it is a canvas. A press that
 * dismisses the gate has to act on pointerdown, because that press is the
 * session's one trusted gesture and video.play() and the audio unlock have
 * to run inside it — so the gate is gone while the finger is still down.
 * What arrives next is the rest of that same press. With no touchend handler
 * left to call preventDefault, a mobile browser follows the tap with the
 * compatibility mouse cascade — mousedown, mouseup, click — at the
 * coordinates it was made, and mousedown plus mouseup is a complete press as
 * far as Phaser is concerned. Measured on a 412x915 phone: one tap on START
 * launched the COUNT mission that had appeared under the START button.
 *
 * So the gate does not simply vanish. It leaves behind a transparent shield
 * that eats every input event until the tail of that gesture has passed.
 *
 * It stands for a fixed window rather than standing down on the click that
 * ends a cascade: engines disagree about which events a dismissed layer
 * still sees and in what order, and a shield that can be talked into leaving
 * early is no shield. The window costs one ignored press at the handover, in
 * exchange for never launching a mission the analyst did not choose.
 *
 * It deliberately outlives the scene: the press it is guarding against
 * arrives after the console has already started.
 */
function shieldHandover(host) {
  if (!host || typeof document === 'undefined') return;
  const shield = document.createElement('div');
  shield.className = 'intro-handover';
  shield.setAttribute('aria-hidden', 'true');
  let timer = null;

  function remove() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    SHIELD_EVENTS.forEach((type) => shield.removeEventListener(type, swallow, true));
    shield.remove();
  }

  function swallow(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  SHIELD_EVENTS.forEach((type) => shield.addEventListener(type, swallow, true));
  host.appendChild(shield);
  timer = window.setTimeout(remove, HANDOVER_SHIELD_MS);
}

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
    // Set only by a press, and consumed by the handover: a gate dismissed by
    // the keyboard, by the video ending, by the watchdog or by automation has
    // no gesture still in flight and nothing to shield the console from.
    this.dismissedByPress = false;
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
      this.dismissedByPress = true;
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
      this.dismissedByPress = true;
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

    // The intro is going to play, so this press ends long before the gate
    // does and leaves no tail for the handover to guard against.
    this.dismissedByPress = false;

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
    // Raised before the gate comes down, so the console never appears
    // unguarded under a press that is still in progress.
    if (this.dismissedByPress) {
      this.dismissedByPress = false;
      shieldHandover(this.overlay?.parentElement ?? document.getElementById('app'));
    }
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
