// The soundtrack: an original surf-spy loop on a deliberately cheap synth, made on the fly with
// Web Audio. A twangy lead (sawtooth, bandpass, a little pitch bend and a slapback echo), a
// walking surf bass, and kick, snare and hats, over eight bars in A minor. Soft at the lodge,
// the full band on the slopes, and harder while a boss is out.

import type { Sfx } from './sfx';

export type MusicMode = 'off' | 'lodge' | 'run' | 'boss';

const BPM = 152;
const STEP = 60 / BPM / 4; // a sixteenth note
const BARS = 8;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Chord roots per bar (bass octave), and the lead: [step, note, length in steps]. */
const ROOTS = [45, 45, 41, 40, 50, 45, 40, 40];
const LEAD: [number, number, number][][] = [
  [[0, 69, 2], [3, 72, 1], [4, 76, 3], [8, 74, 2], [10, 72, 2], [12, 71, 2], [14, 72, 2]],
  [[0, 69, 4], [6, 64, 2], [8, 67, 2], [10, 69, 6]],
  [[0, 72, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2], [8, 72, 4], [12, 69, 4]],
  [[0, 68, 3], [4, 71, 2], [6, 74, 2], [8, 76, 6], [14, 68, 2]],
  // The B section: surf tremolo, the same note picked every sixteenth.
  [...tremolo(0, 69, 8), ...tremolo(8, 72, 8)],
  [...tremolo(0, 76, 12), [12, 74, 2], [14, 72, 2]],
  [...tremolo(0, 68, 8), ...tremolo(8, 71, 8)],
  [[0, 76, 4], [4, 74, 2], [6, 71, 2], [8, 68, 8]],
];
/** Bass intervals over the root, a step at a time (null rests). */
const BASS: (number | null)[] = [0, null, 0, null, 12, null, 0, null, 7, null, 0, null, 10, null, 7, null];

function tremolo(start: number, note: number, steps: number): [number, number, number][] {
  return Array.from({ length: steps }, (_, k) => [start + k, note, 1] as [number, number, number]);
}

export class Music {
  private mode: MusicMode = 'off';
  private bus: GainNode | null = null;
  private echo: DelayNode | null = null;
  private timer = 0;
  private step = 0;
  private next = 0;

  constructor(private readonly sfx: Sfx) {}

  /** Switches mood. Needs the audio unlocked (call after a user gesture). */
  setMode(mode: MusicMode): void {
    const audio = this.sfx.audio;
    if (!audio) return;
    if (!this.bus) this.build(audio.ctx, audio.out);
    const ctx = audio.ctx;
    const level = { off: 0, lodge: 0.16, run: 0.22, boss: 0.25 }[mode];
    this.bus!.gain.setTargetAtTime(level, ctx.currentTime, 0.6);
    if (mode !== 'off' && !this.timer) {
      this.next = ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 50);
    }
    this.mode = mode;
  }

  private build(ctx: AudioContext, out: AudioNode): void {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(out);
    // A slapback echo for the lead, the surf-guitar sound.
    this.echo = ctx.createDelay(0.5);
    this.echo.delayTime.value = 0.11;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.echo.connect(feedback).connect(this.echo);
    this.echo.connect(wet).connect(this.bus);
  }

  private schedule(): void {
    const audio = this.sfx.audio;
    if (!audio || !this.bus) return;
    const ctx = audio.ctx;
    if (this.mode === 'off' && this.bus.gain.value < 0.001) {
      clearInterval(this.timer);
      this.timer = 0;
      return;
    }
    while (this.next < ctx.currentTime + 0.2) {
      this.play(ctx, this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % (16 * BARS);
    }
  }

  private play(ctx: AudioContext, step: number, t: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const full = this.mode === 'run' || this.mode === 'boss';
    const interval = BASS[s];
    if (interval !== null) this.bass(ctx, hz(ROOTS[bar] + interval), t, full ? 0.5 : 0.35);
    for (const [at, note, len] of LEAD[bar]) if (at === s) this.lead(ctx, hz(note), t, len * STEP, full ? 0.22 : 0.12);
    if (!full) return;
    // Drums: kick on the beat and the and-of-three, snare on two and four, eighth-note hats.
    if (s === 0 || s === 8 || s === 10 || (this.mode === 'boss' && (s === 4 || s === 12))) this.kick(ctx, t);
    if (s === 4 || s === 12 || (bar === BARS - 1 && s >= 13)) this.snare(ctx, t, bar === BARS - 1 && s >= 13 ? 0.18 : 0.3);
    if (s % 2 === 0 || this.mode === 'boss') this.hat(ctx, t, s % 4 === 2 ? 0.09 : 0.05);
  }

  private env(ctx: AudioContext, t: number, peak: number, decay: number, len: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * decay), t + Math.max(0.02, len * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
    return g;
  }

  private lead(ctx: AudioContext, f: number, t: number, len: number, peak: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    // The twang: start a little flat and bend up, then a touch of vibrato.
    osc.frequency.setValueAtTime(f * 0.97, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const vib = ctx.createOscillator();
    vib.frequency.value = 6;
    const depth = ctx.createGain();
    depth.gain.value = f * 0.006;
    vib.connect(depth).connect(osc.frequency);
    const tone = ctx.createBiquadFilter();
    tone.type = 'bandpass';
    tone.frequency.value = 1900;
    tone.Q.value = 1.1;
    const g = this.env(ctx, t, peak, 0.35, len);
    osc.connect(tone).connect(g);
    g.connect(this.bus!);
    g.connect(this.echo!);
    osc.start(t);
    vib.start(t);
    osc.stop(t + len + 0.1);
    vib.stop(t + len + 0.1);
  }

  private bass(ctx: AudioContext, f: number, t: number, peak: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = this.mode === 'lodge' ? 500 : 900;
    const g = this.env(ctx, t, peak * 0.5, 0.4, STEP * 1.6);
    osc.connect(lp).connect(g).connect(this.bus!);
    osc.start(t);
    osc.stop(t + STEP * 2);
  }

  private kick(ctx: AudioContext, t: number): void {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(this.bus!);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private noise(ctx: AudioContext, t: number, type: BiquadFilterType, freq: number, peak: number, len: number): void {
    const audio = this.sfx.audio!;
    const src = ctx.createBufferSource();
    src.buffer = audio.noise;
    src.playbackRate.value = 1 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(filter).connect(g).connect(this.bus!);
    src.start(t, Math.random());
    src.stop(t + len + 0.02);
  }

  private snare(ctx: AudioContext, t: number, peak: number): void {
    this.noise(ctx, t, 'bandpass', 1900, peak, 0.13);
    const body = ctx.createOscillator();
    body.frequency.value = 190;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak * 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    body.connect(g).connect(this.bus!);
    body.start(t);
    body.stop(t + 0.1);
  }

  private hat(ctx: AudioContext, t: number, peak: number): void {
    this.noise(ctx, t, 'highpass', 7500, peak, 0.04);
  }
}
