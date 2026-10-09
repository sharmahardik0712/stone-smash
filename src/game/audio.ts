// All sound is synthesised with WebAudio at runtime: no audio files to download or license.
// The context is created/resumed on the first tap or key press (browsers require a gesture).

type Wave = OscillatorType;

export class Audio {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private lastShot = 0;
  soundOn = true;
  musicOn = true;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.5;
        this.sfxGain.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.12;
        this.musicGain.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: Wave, vol: number, slideTo?: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.soundOn) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.noiseBuffer || !this.soundOn) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterFreq * 0.2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shoot(): void {
    if (!this.ctx) return;
    // Throttle: auto-fire is constant, keep it a soft tick.
    if (this.ctx.currentTime - this.lastShot < 0.07) return;
    this.lastShot = this.ctx.currentTime;
    this.tone(880, 0.04, 'square', 0.03, 660);
  }

  /** Hit pitch rises with each combo step: the combo is taught by sound. */
  hit(combo: number): void {
    const semis = Math.min(combo, 20);
    const f = 300 * Math.pow(2, semis / 12);
    this.tone(f, 0.07, 'triangle', 0.18, f * 0.8);
    this.noise(0.04, 0.08, 2500);
  }

  split(tier: number, combo: number): void {
    // Lower thud for bigger stones (tier 0 = Titan Rock .. 3 = Big).
    const base = tier <= 3 ? 80 + tier * 20 : 200;
    const f = base * Math.pow(2, Math.min(combo, 20) / 12);
    this.tone(f, 0.18, 'sine', 0.35, f * 0.5);
    this.noise(0.18, 0.22, 1400);
  }

  pop(combo: number): void {
    const f = 520 * Math.pow(2, Math.min(combo, 20) / 12);
    this.tone(f, 0.09, 'sine', 0.2, f * 1.5);
    this.noise(0.08, 0.1, 3000);
  }

  armor(): void {
    this.tone(1200, 0.12, 'square', 0.08, 900);
    this.tone(1800, 0.1, 'triangle', 0.06, 1400, 0.02);
  }

  bomb(): void {
    this.tone(90, 0.45, 'sine', 0.5, 35);
    this.noise(0.5, 0.45, 900);
  }

  powerUp(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.15, undefined, i * 0.06));
  }

  coin(): void {
    this.tone(1319, 0.06, 'square', 0.05);
    this.tone(1760, 0.12, 'square', 0.05, undefined, 0.05);
  }

  shield(): void {
    this.tone(400, 0.3, 'sine', 0.25, 800);
  }

  lifeLost(): void {
    // A soft "oops", not a punishment.
    this.tone(440, 0.14, 'triangle', 0.22, 330);
    this.tone(330, 0.22, 'triangle', 0.22, 220, 0.12);
  }

  gameOver(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.2, undefined, i * 0.14));
  }

  levelUp(level: number): void {
    const root = level >= 3 ? 523 : 440;
    [0, 4, 7, 12, 16].forEach((st, i) =>
      this.tone(root * Math.pow(2, st / 12), 0.12, 'square', 0.07, undefined, i * 0.05),
    );
  }

  /** A giant tier unlocked: deep rumble plus a rising call. */
  newTier(): void {
    this.tone(70, 0.6, 'sine', 0.5, 45);
    this.noise(0.6, 0.3, 600);
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.16, 'square', 0.06, undefined, 0.15 + i * 0.09));
  }

  click(): void {
    this.tone(660, 0.05, 'triangle', 0.12);
  }

  // --- Music: a gentle generated loop (pentatonic arpeggio over a bass line). ---

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const beat = 60 / 112 / 2; // eighth notes at 112 bpm
    const bass = [55, 55, 65.41, 49];
    const arp = [0, 3, 5, 7, 10, 7, 5, 3];
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const i = this.noteIndex;
      const bar = Math.floor(i / 8) % bass.length;
      if (this.musicOn) {
        if (i % 4 === 0) this.musicNote(bass[bar], beat * 3.5, 'triangle', 0.9);
        const semis = arp[i % 8] + (bar === 2 ? 3 : 0);
        this.musicNote(bass[bar] * 4 * Math.pow(2, semis / 12), beat * 0.9, 'sine', 0.35);
      }
      this.nextNoteTime += beat;
      this.noteIndex++;
    }
  }

  private musicNote(freq: number, dur: number, type: Wave, vol: number): void {
    const ctx = this.ctx!;
    const t = this.nextNoteTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicGain!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}
