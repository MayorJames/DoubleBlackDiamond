// Procedural sound: wind that rises with speed, ski hiss that turns to a scrape when you skid
// or plow, and thumps for landings and wipeouts. Generated noise only, nothing to download.

import { length } from '../sim/math';
import type { PlayerState, SimEvent } from '../sim/player';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private skiGain!: GainNode;
  private skiFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private volume = 0.7;
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

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : v;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.setVolume(this.volume);
    return this.muted;
  }

  /** Continuous sounds follow the player every frame. */
  update(p: PlayerState | null, active: boolean): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (!p || !active) {
      this.windGain.gain.setTargetAtTime(0, now, 0.2);
      this.skiGain.gain.setTargetAtTime(0, now, 0.1);
      return;
    }
    const speed = length(p.vel);
    const s = Math.min(speed / 45, 1.2);
    const onSnow = p.airTime < 0.1 && p.status !== 'crashed';
    this.windGain.gain.setTargetAtTime(0.05 + 0.5 * s ** 1.6, now, 0.15);
    this.windFilter.frequency.setTargetAtTime(250 + 1500 * s * s, now, 0.15);
    const scrape = p.skid * 1.4 + p.plow * 0.6 * Math.min(speed / 10, 1);
    const ski = onSnow ? Math.min(0.06 + s * 0.16 + scrape * 0.35, 0.6) : 0;
    this.skiGain.gain.setTargetAtTime(ski, now, 0.05);
    this.skiFilter.frequency.setTargetAtTime(1300 + scrape * 1800 + s * 900, now, 0.08);
  }

  onEvent(e: SimEvent): void {
    if (!this.ctx) return;
    switch (e.type) {
      case 'land':
        this.thump(Math.min(0.25 + e.impact * 0.06, 0.9), 90);
        this.burst(0.12, Math.min(0.1 + e.impact * 0.03, 0.4), 900);
        break;
      case 'impact':
        this.thump(Math.min(e.impact * 0.04, 0.5), 110);
        break;
      case 'jump':
        this.burst(0.18, 0.15, 2400);
        break;
      case 'treeBump':
        this.thump(0.5, 140);
        this.burst(0.25, 0.3, 1600);
        break;
      case 'crash':
        this.thump(1, 70);
        this.burst(0.6, 0.6, 700);
        for (let i = 0; i < 5; i++) this.click(0.1 + i * 0.09 + Math.random() * 0.05);
        break;
      case 'finish':
        this.chime();
        break;
    }
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
  private chime(): void {
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
