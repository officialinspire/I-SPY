import ReconScene from './ReconScene.js';
import { feedback } from '../audio/feedback.js';
import { getSettings } from '../settings/userSettings.js';

export default class EnhancedReconScene extends ReconScene {
  constructor() {
    super();
    this.lastCountdownSecond = null;
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

  cleanup() {
    this.countdownFeedbackEvent?.remove(false);
    super.cleanup();
  }
}
