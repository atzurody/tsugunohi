export class HorrorAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;
  private fallBuffer: AudioBuffer | null = null;
  private cricketSource: AudioBufferSourceNode | null = null;
  private cricketGain: GainNode | null = null;
  private memoryBuffer: AudioBuffer | null = null;
  private carPassBuffer: AudioBuffer | null = null;
  private footstepBuffer: AudioBuffer | null = null;
  private memorySource: AudioBufferSourceNode | null = null;
  private memoryGainNode: GainNode | null = null;

  init() {
    if (this.initialized) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
    this.initialized = true;

    // Preload footstep sound
    fetch("/footstep.mp3")
      .then(r => r.arrayBuffer())
      .then(buf => this.ctx!.decodeAudioData(buf))
      .then(decoded => { this.footstepBuffer = decoded; })
      .catch(() => {});

    // Preload fall sound
    fetch("/fall.mp3")
      .then(r => r.arrayBuffer())
      .then(buf => this.ctx!.decodeAudioData(buf))
      .then(decoded => { this.fallBuffer = decoded; })
      .catch(() => {});

    // Preload memory flashback sound
    fetch("/memory.mp3")
      .then(r => r.arrayBuffer())
      .then(buf => this.ctx!.decodeAudioData(buf))
      .then(decoded => { this.memoryBuffer = decoded; })
      .catch(() => {});

    // Preload car pass sound
    fetch("/car_pass.mp3")
      .then(r => r.arrayBuffer())
      .then(buf => this.ctx!.decodeAudioData(buf))
      .then(decoded => { this.carPassBuffer = decoded; })
      .catch(() => {});

    // Load and loop cricket ambient sound
    fetch("/cricket.mp3")
      .then(r => r.arrayBuffer())
      .then(buf => this.ctx!.decodeAudioData(buf))
      .then(decoded => {
        if (!this.ctx || !this.masterGain) return;
        this.cricketSource = this.ctx.createBufferSource();
        this.cricketSource.buffer = decoded;
        this.cricketSource.loop = true;
        this.cricketGain = this.ctx.createGain();
        this.cricketGain.gain.value = 0.35;
        this.cricketSource.connect(this.cricketGain);
        this.cricketGain.connect(this.masterGain);
        this.cricketSource.start();
      })
      .catch(() => {});
  }

  setCricketVolume(loop: number) {
    if (!this.cricketGain) return;
    // Cricket fades out as world gets scarier
    const vol = Math.max(0, 0.35 - loop * 0.04);
    this.cricketGain.gain.setTargetAtTime(vol, this.ctx!.currentTime, 0.5);
  }

  playCarPass() {
    if (!this.ctx || !this.masterGain || !this.carPassBuffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.carPassBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  playMemory() {
    if (!this.ctx || !this.masterGain || !this.memoryBuffer) return;
    // Stop previous if still playing
    if (this.memorySource) {
      try { this.memorySource.stop(); } catch {}
      this.memorySource = null;
    }
    this.memorySource = this.ctx.createBufferSource();
    this.memorySource.buffer = this.memoryBuffer;
    this.memoryGainNode = this.ctx.createGain();
    this.memoryGainNode.gain.value = 0.3;
    this.memorySource.connect(this.memoryGainNode);
    this.memoryGainNode.connect(this.masterGain);
    this.memorySource.start();
    this.memorySource.onended = () => { this.memorySource = null; };
  }

  stopMemory() {
    if (this.memorySource) {
      try {
        if (this.memoryGainNode && this.ctx) {
          this.memoryGainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
        }
        setTimeout(() => {
          try { this.memorySource?.stop(); } catch {}
          this.memorySource = null;
        }, 500);
      } catch {}
    }
  }

  playFall() {
    if (!this.ctx || !this.masterGain || !this.fallBuffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.fallBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  playFootstep() {
    if (!this.ctx || !this.masterGain || !this.footstepBuffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.footstepBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.8;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  playAmbientDrone(loop: number) {
    if (!this.ctx || !this.masterGain) return;
    const duration = 6;
    const t = this.ctx.currentTime;

    // Deep sub-bass drone
    const osc1 = this.ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 30 + loop * 3;

    // Dissonant second oscillator
    const osc2 = this.ctx.createOscillator();
    osc2.type = "sawtooth";
    osc2.frequency.value = 31 + loop * 2.7;

    // Third eerie oscillator for higher loops
    const osc3 = this.ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.value = 220 + loop * 15; // Eerie high tone
    osc3.detune.value = loop * 5;

    const gain = this.ctx.createGain();
    const vol = 0.025 + loop * 0.01;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.linearRampToValueAtTime(vol * 1.2, t + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Low pass filter for rumble
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200 + loop * 30;
    filter.Q.value = 2;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);

    // High eerie tone (quiet)
    if (loop >= 3) {
      const highGain = this.ctx.createGain();
      highGain.gain.setValueAtTime(0.008 + loop * 0.003, t);
      highGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.8);
      osc3.connect(highGain);
      highGain.connect(this.masterGain);
      osc3.start(t);
      osc3.stop(t + duration * 0.8);
    }
  }

  playHorrorSting() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Harsh descending screech
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.6);

    // Second layer - reverse
    const osc2 = this.ctx.createOscillator();
    osc2.type = "square";
    osc2.frequency.setValueAtTime(100, t);
    osc2.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    osc2.frequency.exponentialRampToValueAtTime(60, t + 0.6);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.06, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(this.masterGain);
    gain2.connect(this.masterGain);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.6);
    osc2.stop(t + 0.6);
  }

  playGlitch() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Harsh digital noise
      data[i] = (Math.random() > 0.5 ? 1 : -1) * Math.random() * 0.4;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  playHeartbeat(loop: number) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Double-beat: lub-dub
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 0 ? 55 : 45;
      const beatT = t + i * 0.12;
      const vol = 0.07 + loop * 0.015;
      gain.gain.setValueAtTime(vol, beatT);
      gain.gain.exponentialRampToValueAtTime(0.001, beatT + 0.1);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(beatT);
      osc.stop(beatT + 0.1);
    }
  }

  playWhisper() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const duration = 1.5;

    // Filtered noise that sounds like whispering
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.sin((i / bufferSize) * Math.PI);
      // Modulated noise for whisper texture
      const mod = Math.sin(i * 0.02) * 0.5 + 0.5;
      data[i] = (Math.random() * 2 - 1) * 0.1 * env * mod;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter for voice-like quality
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000;
    filter.Q.value = 3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
  }

  playBreathing(loop: number) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const duration = 0.8;

    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const phase = i / bufferSize;
      const env = Math.sin(phase * Math.PI);
      data[i] = (Math.random() * 2 - 1) * 0.06 * env;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    filter.Q.value = 1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.04 + loop * 0.01, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
  }

  playCreak() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Metal creaking / door hinge sound
    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(300 + Math.random() * 200, t);
    osc.frequency.linearRampToValueAtTime(150 + Math.random() * 100, t + 0.4);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.02, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playDistantBang() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    // Distant metallic bang
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (bufferSize * 0.05));
      data[i] = (Math.random() * 2 - 1) * 0.3 * env;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(t);
  }

  playLowRumble() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const duration = 3;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 20 + Math.random() * 10;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.04, t + duration * 0.3);
    gain.gain.linearRampToValueAtTime(0, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration);
  }
}
