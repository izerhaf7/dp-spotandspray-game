// ============================================================
// AUDIO.JS — Web Audio API sound synthesis
// No external audio files needed
// ============================================================

const Audio = {
  ctx: null,
  enabled: true,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  /** Play a short tone */
  _tone(freq, duration, type = 'sine', volume = 0.15) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  /** Correct tap — ascending ping */
  ping() {
    this._tone(880, 0.12, 'sine', 0.12);
    setTimeout(() => this._tone(1320, 0.1, 'sine', 0.08), 50);
  },

  /** Wrong tap — low buzz */
  buzz() {
    this._tone(180, 0.2, 'square', 0.08);
  },

  /** Combo milestone — bright ding */
  combo() {
    this._tone(660, 0.08, 'sine', 0.1);
    setTimeout(() => this._tone(990, 0.08, 'sine', 0.1), 60);
    setTimeout(() => this._tone(1320, 0.15, 'sine', 0.12), 120);
  },

  /** Game start — short ascending scale */
  gameStart() {
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.12, 'sine', 0.1), i * 80);
    });
  },

  /** Game end — descending */
  gameEnd() {
    [880, 659, 554, 440].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.2, 'triangle', 0.1), i * 120);
    });
  }
};
