// Fixed-timestep loop: the simulation ticks at exactly TICK_RATE no matter the display rate,
// and each frame renders with an interpolation factor between the last two ticks.

import { DT } from '../sim/constants';

/** Never simulate more than this much time in one frame (avoids a spiral after a stall). */
const MAX_FRAME = 0.25;

export class FixedLoop {
  /** While paused, frames still render but no ticks run. */
  paused = true;
  private acc = 0;
  private last = 0;
  private running = false;

  constructor(
    private readonly tick: () => void,
    private readonly frame: (alpha: number, dt: number, ticks: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.onFrame);
  }

  private readonly onFrame = (now: number) => {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;
    let ticks = 0;
    if (this.paused) {
      this.acc = 0;
    } else {
      this.acc += dt;
      while (this.acc >= DT) {
        this.tick();
        this.acc -= DT;
        ticks++;
      }
    }
    this.frame(this.paused ? 1 : this.acc / DT, dt, ticks);
    requestAnimationFrame(this.onFrame);
  };
}
