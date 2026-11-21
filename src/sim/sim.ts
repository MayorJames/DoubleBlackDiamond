// The simulation: a seeded run state advanced in fixed ticks by player inputs, and nothing else.
// No DOM, no rendering, no clocks. Multiplayer later is just a longer players list.

import { DT } from './constants';
import { Course, DEFAULT_COURSE_LENGTH } from './course';
import { createPlayer, NEUTRAL_INPUT, stepPlayer, type InputFrame, type PlayerState, type SimEvent } from './player';
import { hashSeed, Rng, type RngState } from './rng';
import { cloneTuning, type Tuning } from './tuning';

export const RUN_STATE_VERSION = 1;

/** Everything needed to resume a run exactly. Plain JSON. */
export interface RunState {
  version: number;
  seed: string;
  courseLength: number;
  tick: number;
  rng: RngState;
  tuning: Tuning;
  players: PlayerState[];
}

export interface SimOptions {
  seed: string;
  players?: number;
  tuning?: Partial<Tuning>;
  courseLength?: number;
  /** Reuse an already generated course for the same seed (saves regenerating it on a retry). */
  course?: Course;
}

export class Sim {
  readonly course: Course;
  readonly state: RunState;
  private readonly rng: Rng;
  private events: SimEvent[] = [];
  private readonly emit = (e: SimEvent) => {
    this.events.push(e);
  };

  private constructor(state: RunState, course?: Course) {
    if (state.version !== RUN_STATE_VERSION) throw new Error(`Unsupported run state version ${state.version}`);
    this.state = state;
    this.course =
      course && course.seed === state.seed && course.finishD === state.courseLength
        ? course
        : new Course(state.seed, state.courseLength);
    this.rng = new Rng(state.rng);
  }

  static create(options: SimOptions): Sim {
    const courseLength = options.courseLength ?? DEFAULT_COURSE_LENGTH;
    const tuning = { ...cloneTuning(), ...options.tuning };
    const state: RunState = {
      version: RUN_STATE_VERSION,
      seed: options.seed,
      courseLength,
      tick: 0,
      rng: hashSeed(`run:${options.seed}`),
      tuning,
      players: [],
    };
    const sim = new Sim(state, options.course);
    const count = Math.max(1, options.players ?? 1);
    for (let i = 0; i < count; i++) state.players.push(createPlayer(i, count, sim.course, tuning, sim.rng));
    return sim;
  }

  /** Resume from a snapshot. Pass the current course to skip regenerating it for the same seed. */
  static restore(snapshot: RunState | string, course?: Course): Sim {
    const state: RunState = typeof snapshot === 'string' ? JSON.parse(snapshot) : structuredClone(snapshot);
    return new Sim(state, course);
  }

  snapshot(): RunState {
    return structuredClone(this.state);
  }

  /** Advance one fixed tick. `inputs[i]` drives `players[i]`; missing inputs are neutral. */
  step(inputs: readonly InputFrame[]): void {
    const ctx = { course: this.course, tuning: this.state.tuning, tick: this.state.tick, emit: this.emit };
    const players = this.state.players;
    for (let i = 0; i < players.length; i++) stepPlayer(players[i], inputs[i] ?? NEUTRAL_INPUT, ctx);
    this.state.tick++;
  }

  /** Events since the last drain, for sound, camera and HUD juice. */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  get tick(): number {
    return this.state.tick;
  }

  get time(): number {
    return this.state.tick * DT;
  }

  get players(): readonly PlayerState[] {
    return this.state.players;
  }
}
