export class HorrorAudio {
  constructor() {
    this.ctx = null;
    this.screamBuffer = null;
    this.screamSource = null;
    this.screamGain = null;
    this.screamPanner = null;
    this.lastSynthTime = 0;
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
    if (this.screamBuffer && !this.screamSource) {
      this.startContinuousScreamLoop();
    }
  }

  async loadDefaultScream() {
    // Cuba baca dari ./assets/sakau.mp3 dahulu, jika tiada cuba ./sakau.mp3 di root
    const paths = ['./assets/sakau.mp3', './sakau.mp3'];
    for (const path of paths) {
      try {
        const res = await fetch(path);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          this.screamBuffer = await this.ctx.decodeAudioData(arr);
          this.startContinuousScreamLoop();
          return;
        }
      } catch (_) {
        // Cuba laluan seterusnya
      }
    }
  }

  async setCustomAudioFile(file) {
    this.init();
    const arr = await file.arrayBuffer();
    this.screamBuffer = await this.ctx.decodeAudioData(arr);
    this.startContinuousScreamLoop();
  }

  startContinuousScreamLoop() {
    if (!this.ctx || !this.screamBuffer) return;

    // Hentikan sumber lama jika ada supaya tidak bertindih
    if (this.screamSource) {
      try {
        this.screamSource.stop();
        this.screamSource.disconnect();
      } catch (_) {}
      this.screamSource = null;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = this.screamBuffer;
    src.loop = true; // Mainkan keseluruhan trek audio (30s dsb.) penuh tanpa terpotong

    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0; // Mula senyap sehingga Anwar mendekati pemain

    if (panner) {
      src.connect(panner);
      panner.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(this.ctx.destination);

    src.start(0);
    this.screamSource = src;
    this.screamPanner = panner;
    this.screamGain = gain;
  }

  startAmbient() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.14;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;

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

  // Dikemas kini setiap bingkai (frame) supaya kelantangan & arah kiri/kanan berubah secara masa nyata
  updateProximityAudio(distance, pan = 0, isPlaying = true, maxHearDist = 30) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (!isPlaying || distance >= maxHearDist) {
      if (this.screamGain) {
        this.screamGain.gain.setTargetAtTime(0.0, now, 0.09);
      }
      return;
    }

    // Lengkung jarak semula jadi: perlahan di jauh, kuat apabila rapat, terus mengecil bila lari menjauh
    const norm = Math.max(0, Math.min(1, 1 - distance / maxHearDist));
    const dynamicVol = Math.pow(norm, 1.65) * 1.15;

    if (this.screamGain) {
      this.screamGain.gain.setTargetAtTime(Math.min(1.0, dynamicVol), now, 0.08);
      if (this.screamPanner) {
        this.screamPanner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.08);
      }
    } else {
      // Fallback sintetik jika fail audio belum dimasukkan
      const ms = performance.now();
      const interval = Math.max(950, distance * 120);
      if (ms - this.lastSynthTime >= interval) {
        this.lastSynthTime = ms;
        const v = Math.max(0.03, dynamicVol * 0.35);
        this.playTone(290, 0.16, 'sawtooth', v, 410);
        setTimeout(() => {
          this.playTone(430, 0.28, 'sawtooth', v * 1.15, 220);
        }, 170);
      }
    }
  }

  playJumpscare() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playTone(95, 1.3, 'sawtooth', 0.65, 32);
    this.playTone(620, 0.9, 'square', 0.45, 140);

    if (this.screamGain) {
      if (this.screamPanner) this.screamPanner.pan.setValueAtTime(0, now);
      this.screamGain.gain.setValueAtTime(1.0, now);
    }
  }
}
