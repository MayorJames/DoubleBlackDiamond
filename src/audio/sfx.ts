// Procedural sound: wind that rises with speed, ski hiss, and slapstick effects for the
// gunfights and the lodge. Generated noise and oscillators only, nothing to download.

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private skiGain!: GainNode;
  private skiFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private volume = 0.6;
  private muted = false;

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const windSrc = this.loop();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 300;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(this.windFilter).connect(this.windGain).connect(this.master);

    const skiSrc = this.loop();
    this.skiFilter = ctx.createBiquadFilter();
    this.skiFilter.type = 'bandpass';
    this.skiFilter.frequency.value = 1800;
    this.skiFilter.Q.value = 0.9;
    this.skiGain = ctx.createGain();
    this.skiGain.gain.value = 0;
    skiSrc.connect(this.skiFilter).connect(this.skiGain).connect(this.master);
  }

  /** The audio graph, once unlocked: for the music to play through the same master volume. */
  get audio(): { ctx: AudioContext; out: AudioNode; noise: AudioBuffer } | null {
    return this.ctx ? { ctx: this.ctx, out: this.master, noise: this.noise } : null;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : v;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.setVolume(this.volume);
    return this.muted;
  }

  /**
   * Ambience each frame: `speed` is 0..1.5 (how fast the skier is going), `scrape` is 0..1
   * (snowplowing), and `active` is false at the lodge, when paused, or in menus.
   */
  ambient(speed: number, scrape: number, active: boolean): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (!active) {
      this.windGain.gain.setTargetAtTime(0, now, 0.2);
      this.skiGain.gain.setTargetAtTime(0, now, 0.1);
      return;
    }
    this.windGain.gain.setTargetAtTime(0.03 + 0.18 * speed ** 1.6, now, 0.2);
    this.windFilter.frequency.setTargetAtTime(250 + 900 * speed * speed, now, 0.2);
    this.skiGain.gain.setTargetAtTime(Math.min(0.03 + speed * 0.05 + scrape * 0.12, 0.25), now, 0.08);
    this.skiFilter.frequency.setTargetAtTime(1300 + scrape * 1500 + speed * 600, now, 0.1);
  }

  /** A card slapped onto the map. */
  place(): void {
    if (!this.ctx) return;
    this.thump(0.35, 160);
    this.burst(0.12, 0.18, 2200);
  }

  /** A wipeout: a full yard sale. */
  yardSale(): void {
    if (!this.ctx) return;
    this.thump(1, 70);
    this.burst(0.6, 0.5, 700);
    for (let i = 0; i < 5; i++) this.click(0.1 + i * 0.09 + Math.random() * 0.05);
  }

  /** The boss arrives. */
  alarm(): void {
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) setTimeout(() => this.tone('square', 880, 660, 0.18, 0.08), i * 220);
  }

  /** Back at the lodge, or a boss beaten. */
  fanfare(): void {
    this.chime();
  }

  // --- Gunfight and scoring sounds (slapstick on purpose) -----------------------------------

  /** Your silenced pistol: a cheap "pft". */
  gunshot(): void {
    if (!this.ctx) return;
    this.burst(0.07, 0.35, 3200);
    this.tone('square', 900, 220, 0.06, 0.08);
  }

  /** A guard's shot, quieter with distance. */
  enemyShot(dist: number): void {
    if (!this.ctx) return;
    const g = Math.max(0.08, 0.5 - dist / 300);
    this.burst(0.18, g, 1400);
    this.thump(g * 0.8, 120);
  }

  /** A bullet zipping past your ear. */
  whizz(): void {
    if (!this.ctx) return;
    this.tone('sawtooth', 2400, 600, 0.12, 0.05);
  }

  /** Headshots go "bonk". */
  bonk(): void {
    if (!this.ctx) return;
    this.tone('sine', 780, 520, 0.16, 0.4);
    this.tone('triangle', 1560, 900, 0.08, 0.12);
  }

  hitTick(): void {
    if (!this.ctx) return;
    this.tone('square', 1200, 1100, 0.04, 0.08);
  }

  /** A downed guard leaves on a slide whistle. */
  slideWhistle(): void {
    if (!this.ctx) return;
    this.tone('sine', 1400, 260, 0.55, 0.22);
  }

  /** Bowling a guard over. */
  boing(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.35);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  /** You got hit. */
  oof(): void {
    if (!this.ctx) return;
    this.tone('square', 160, 70, 0.22, 0.25);
    this.thump(0.6, 90);
  }

  /** Chips land: a blip that climbs with every event in the hand. */
  chipTick(n: number): void {
    if (!this.ctx) return;
    const f = 440 * Math.pow(2, Math.min(n, 24) / 12);
    this.tone('square', f, f, 0.07, 0.07);
  }

  /** A hand cashes in. */
  chaChing(): void {
    if (!this.ctx) return;
    this.tone('square', 1318, 1318, 0.08, 0.1);
    setTimeout(() => this.tone('square', 1760, 1760, 0.25, 0.1), 80);
    this.burst(0.3, 0.12, 6000);
  }

  /** A hand lost to a bullet or a wipeout: wah-wah-wah-waaah. */
  sadTrombone(): void {
    if (!this.ctx) return;
    [311, 294, 277].forEach((f, i) => setTimeout(() => this.tone('sawtooth', f, f * 0.98, 0.22, 0.09), i * 230));
    setTimeout(() => this.tone('sawtooth', 262, 240, 0.7, 0.09), 690);
  }

  reloadClick(): void {
    if (!this.ctx) return;
    this.tone('square', 2000, 1800, 0.03, 0.08);
    setTimeout(() => this.tone('square', 1500, 1300, 0.04, 0.08), 120);
  }

  /** A sniper's laser has found you. */
  laserHum(): void {
    if (!this.ctx) return;
    this.tone('sine', 600, 1300, 1.5, 0.06);
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private loop(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(0, Math.random() * 2);
    return src;
  }

  private thump(gain: number, freq: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.18);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private burst(duration: number, gain: number, freq: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + duration + 0.05);
  }

  private click(delay: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 300 + Math.random() * 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  /** A cheap two-note surf-twang chime for reaching base camp. */
  chime(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t + i * 0.09);
      osc.frequency.linearRampToValueAtTime(freq * 0.985, t + i * 0.09 + 0.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.setValueAtTime(0.12, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.35);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + i * 0.09 + 0.4);
    });
  }
}
