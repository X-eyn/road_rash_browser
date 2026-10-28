// WebAudio: original WAV effects + procedural engine / siren / music.
const ENGINE_FILES = {
  rat: "engrat.wav",
  sport: "engsport.wav",
  super: "engsuper.wav",
  tuned: "engtunne.wav",
  nitro: "engnitro.wav",
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.engineBus = null;
    this.engine = null;
    this.engineFilter = null;
    this.siren = null;
    this.musicTimer = null;
    this.musicKind = null;
    this.nextNote = 0;
    this.step = 0;
    this.volumes = { master: 0.85, music: 0.35, sfx: 0.8, engine: 0.65 };
    this.musicOn = true;
    this.noise = null;
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.volumes.music;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.volumes.sfx;
    this.sfxBus.connect(this.master);
    this.engineBus = this.ctx.createGain();
    this.engineBus.gain.value = this.volumes.engine;
    this.engineBus.connect(this.master);
    // noise buffer for drums / skid
    const len = this.ctx.sampleRate * 1.2;
    const nb = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = nb.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    this.noise = nb;
    await this.loadSfx();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  async loadSfx() {
    const names = [
      "engrat", "engsport", "engsuper", "engtunne", "engnitro", "engcar11",
      "crashhar", "crashmed", "crashlit", "punchhea", "punchlig", "kick_mw4",
      "skidoffr", "skidonNR", "skidonNR", "bounce", "footstep", "ridersli",
      "chainimp", "clubimpa", "siren", "sirenfst", "swishcha", "swishgen",
      "engother", "m_yeah", "f_yeah", "af1_eek", "am1_dooo", "bounce",
    ];
    const uniq = [...new Set(names.map((n) => n.toLowerCase()))];
    await Promise.all(
      uniq.map(async (n) => {
        try {
          const r = await fetch(`./assets/audio/sfx/${n}.wav`);
          if (!r.ok) return;
          const ab = await r.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(ab);
          this.buffers.set(n, buf);
        } catch {}
      })
    );
  }

  setVolumes(v) {
    this.volumes = { ...this.volumes, ...v };
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.musicBus.gain.value = this.volumes.music * (this.musicOn ? 1 : 0);
    this.sfxBus.gain.value = this.volumes.sfx;
    this.engineBus.gain.value = this.volumes.engine;
  }

  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    this.musicBus.gain.value = this.volumes.music * (on ? 1 : 0);
    if (!on) this.stopMusic();
  }

  sfx(name, { volume = 1, rate = 1, loop = false, bus = this.sfxBus } = {}) {
    if (!this.ctx || !bus) return null;
    const key = String(name).toLowerCase().replace(/\.wav$/, "");
    const buf = this.buffers.get(key);
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(bus);
    src.start();
    return { src, gain: g };
  }

  startEngine(kind = "sport") {
    if (!this.ctx) return;
    this.stopEngine();
    const key = ENGINE_FILES[kind] || ENGINE_FILES.sport;
    const buf = this.buffers.get(key.replace(".wav", ""));
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    src.connect(this.engineFilter).connect(g).connect(this.engineBus);
    src.start();
    this.engine = { src, gain: g };
  }

  setEngine(rpm, throttle, offroad = false) {
    if (!this.engine) return;
    const r = 0.7 + Math.max(0, Math.min(1.2, rpm)) * 1.35;
    this.engine.src.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.05);
    this.engine.gain.gain.setTargetAtTime(0.05 + throttle * 0.12, this.ctx.currentTime, 0.08);
    if (this.engineFilter) {
      const f = (offroad ? 900 : 1500) + rpm * 2200;
      this.engineFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.1);
    }
  }

  stopEngine() {
    if (!this.engine) return;
    try {
      this.engine.src.stop();
    } catch {}
    this.engine = null;
  }

  startSiren() {
    if (!this.ctx || this.siren) return;
    const buf = this.buffers.get("sirenfst") || this.buffers.get("siren");
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    src.connect(g).connect(this.sfxBus);
    src.start();
    g.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.4);
    this.siren = { src, gain: g };
  }

  stopSiren() {
    if (!this.siren) return;
    try {
      this.siren.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      this.siren.src.stop(this.ctx.currentTime + 0.8);
    } catch {}
    this.siren = null;
  }

  // ---- Procedural soundtrack -------------------------------------------------
  playMusic(kind = "menu") {
    if (!this.ctx || !this.musicOn) return;
    if (this.musicKind === kind) return;
    this.stopMusic();
    this.musicKind = kind;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.05;
    const bpm = kind === "race" ? 146 : 112;
    this.noteLen = 60 / bpm / 2; // eighth note
    this.musicTimer = setInterval(() => this.schedule(), 80);
    this.schedule();
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicKind = null;
  }

  schedule() {
    if (!this.ctx || !this.musicKind) return;
    const ahead = this.ctx.currentTime + 0.25;
    const race = this.musicKind === "race";
    while (this.nextNote < ahead) {
      const t = this.nextNote;
      const s = this.step % 16;
      const root = race ? 82.41 : 73.42; // E2 / D2
      const chords = race ? [0, 0, 3, 5, 0, 0, 7, 5] : [0, 0, 5, 3, 0, 0, 7, 5];
      const chord = chords[(this.step / 2) % chords.length | 0];
      const freq = root * Math.pow(2, chord / 12);
      // bass on every eighth
      this.note(freq, t, this.noteLen * 0.9, "sawtooth", 0.11, 380);
      // power chord stabs
      if (s % 4 === 0 || s === 6 || s === 14) {
        this.note(freq * 4, t, this.noteLen * 1.6, "square", 0.045, 1400);
        this.note(freq * 6, t, this.noteLen * 1.6, "square", 0.025, 1800);
      }
      // drums
      if (s % 4 === 0) this.kick(t);
      if (s % 4 === 2) this.snare(t, race ? 0.16 : 0.1);
      if (race && s % 2 === 1) this.hat(t, 0.05);
      if (!race && s % 4 === 1) this.hat(t, 0.03);
      this.nextNote += this.noteLen;
      this.step++;
    }
  }

  note(freq, t, dur, type, gain, cutoff) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(cutoff, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  kick(t) {
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.2);
  }

  snare(t, vol) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.14);
  }

  hat(t, vol) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.06);
  }

  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.note(880, t, 0.04, "square", 0.05, 3000);
    this.note(1320, t + 0.03, 0.05, "square", 0.035, 3000);
  }
}

export const audio = new AudioManager();
