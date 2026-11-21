// Fixed-timestep loop with a speed control (0 = paused, Loop Hero style). The run ticks at
// exactly TICK_RATE of game time; each frame renders with an interpolation factor.

import { DT } from '../game/constants';

const MAX_FRAME = 0.25;
const MAX_TICKS_PER_FRAME = 16;

export class FixedLoop {
  /** Game seconds per real second. 0 pauses. */
  speed = 1;
  private acc = 0;
  private last = 0;
  private running = false;

  constructor(
    private readonly tick: () => void,
    private readonly frame: (alpha: number, dt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.onFrame);
  }

  private readonly onFrame = (now: number) => {
    const dt = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;
    if (this.speed > 0) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= DT && n++ < MAX_TICKS_PER_FRAME) {
        this.tick();
        this.acc -= DT;
      }
      if (n >= MAX_TICKS_PER_FRAME) this.acc = 0;
    }
    this.frame(this.speed > 0 ? this.acc / DT : 1, dt);
    requestAnimationFrame(this.onFrame);
  };
}
