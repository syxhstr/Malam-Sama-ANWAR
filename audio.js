export class HorrorAudio {
  constructor() {
    this.ctx = null;
    this.customScreamUrl = null;
    this.screamBuffer = null;
    this.lastScreamTime = 0;
    this.ambientStarted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.ambientStarted) {
      this.startAmbient();
      this.loadDefaultScream();
    }
  }

  async loadDefaultScream() {
    try {
      const res = await fetch('./assets/sakau.mp3');
      if (res.ok) {
        const arr = await res.arrayBuffer();
        this.screamBuffer = await this.ctx.decodeAudioData(arr);
      }
    } catch (_) {
      // Fallback sintetik jika fail assets/sakau.mp3 belum dimasukkan
    }
  }

  async setCustomAudioFile(file) {
    this.init();
    const arr = await file.arrayBuffer();
    this.screamBuffer = await this.ctx.decodeAudioData(arr);
  }

  startAmbient() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;

    // Dengungan elektrik pejabat & bunyi hujan halus
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playTone(freq, duration, type = 'sine', volume = 0.2, slideTo = null) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playClick() {
    this.playTone(620, 0.06, 'triangle', 0.15, 300);
  }

  playPickup() {
    this.playTone(520, 0.12, 'sine', 0.22, 880);
    setTimeout(() => this.playTone(880, 0.18, 'sine', 0.2, 1180), 90);
  }

  playSwitch() {
    this.playTone(140, 0.25, 'sawtooth', 0.28, 70);
  }

  playLocker() {
    this.playTone(210, 0.18, 'square', 0.16, 110);
  }

  triggerProximityScream(distance, maxHearDist = 22) {
    if (!this.ctx || distance > maxHearDist) return;
    const now = performance.now();
    // Lebih dekat = lebih kerap menjerit "SAKAU!"
    const interval = Math.max(950, distance * 145);
    if (now - this.lastScreamTime < interval) return;
    this.lastScreamTime = now;

    const intensity = Math.max(0.12, 1 - distance / maxHearDist);

    if (this.screamBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.screamBuffer;
      src.playbackRate.value = 0.96 + Math.random() * 0.1;

      const gain = this.ctx.createGain();
      gain.gain.value = Math.min(1.0, intensity * 1.15);

      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
    } else {
      // Jeritan sintetik 2 suku kata ("SA - KAU!")
      this.playTone(290, 0.16, 'sawtooth', intensity * 0.32, 410);
      setTimeout(() => {
        this.playTone(430, 0.28, 'sawtooth', intensity * 0.38, 220);
      }, 170);
    }
  }

  playJumpscare() {
    if (!this.ctx) return;
    // Dentuman bass + jeritan kuat
    this.playTone(95, 1.3, 'sawtooth', 0.65, 32);
    this.playTone(620, 0.9, 'square', 0.45, 140);

    if (this.screamBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.screamBuffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 1.0;
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
    }
  }
}
