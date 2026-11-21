// Every number that shapes how skiing feels. All values are starting points for the
// Feel phase; the in-game tuning panel (backtick key) edits a copy that lives in the run state.

export interface Tuning {
  /** Arcade gravity, m/s². A bit above Earth's so jumps land snappily. */
  gravity: number;
  /** Speed you drop in with, m/s. */
  startSpeed: number;

  /** Coulomb friction of skis on snow. */
  snowFriction: number;
  /** Air drag k in a = k·v², standing tall. Sets top speed in a cruise. */
  dragCruise: number;
  /** Air drag while tucked. Lower drag is what makes the tuck fast. */
  dragTuck: number;
  /** Air drag while snowplowing (you are wide and upright). */
  dragPlow: number;
  /** Snowplow braking as linear damping on speed above the floor, 1/s at full plow. */
  plowBrake: number;
  /** The plow stops braking at this speed, m/s, so you can never come to a halt. */
  plowFloor: number;
  /** Cap on plow braking deceleration, m/s², so braking from top speed stays controlled. */
  plowMaxDecel: number;

  /** How fast you can pivot your skis, rad/s, cruising. */
  turnRate: number;
  turnRateTuck: number;
  turnRatePlow: number;
  /** Pivot rate in the air, rad/s, used to line up a landing. */
  turnRateAir: number;
  /** Edge grip as max sideways acceleration in g. Beyond it you skid and scrub speed. */
  grip: number;
  gripTuck: number;
  gripPlow: number;
  /** Fraction of grip left when skidding sideways (stops the hockey stop beating the plow). */
  skidGrip: number;
  /** Furthest the skis can point away from the trail's fall line, degrees. You can't stop. */
  maxTraverseDeg: number;

  /** Stance changes per second (tuck/plow blend speed). */
  stanceRate: number;
  /** Pop off the snow with jump, m/s. */
  jumpSpeed: number;

  /** Impact speed into the snow (normal to the slope) that wipes you out, m/s. */
  crashImpact: number;
  /** Landing this far sideways (degrees between skis and travel) above 10 m/s wipes you out. */
  crashLandingSlipDeg: number;
  /** Speed straight into a tree that wipes you out, m/s. Glancing blows just bump you. */
  crashTreeSpeed: number;

  /** Aim wobble, radians: base + speed term, scaled up by tuck and down by plow. */
  wobbleBase: number;
  wobblePerSpeed: number;
  wobbleTuckBoost: number;
  wobblePlowSteady: number;
  wobbleAir: number;
}

export const DEFAULT_TUNING: Readonly<Tuning> = Object.freeze({
  gravity: 11.5,
  startSpeed: 6,

  snowFriction: 0.03,
  dragCruise: 0.0042,
  dragTuck: 0.0018,
  dragPlow: 0.0048,
  plowBrake: 0.8,
  plowFloor: 4,
  plowMaxDecel: 9,

  turnRate: 2.6,
  turnRateTuck: 1.3,
  turnRatePlow: 3.2,
  turnRateAir: 2.2,
  grip: 1.5,
  gripTuck: 0.8,
  gripPlow: 1.8,
  skidGrip: 0.5,
  maxTraverseDeg: 75,

  stanceRate: 6,
  jumpSpeed: 4,

  crashImpact: 14,
  crashLandingSlipDeg: 65,
  crashTreeSpeed: 7,

  wobbleBase: 0.002,
  wobblePerSpeed: 0.0006,
  wobbleTuckBoost: 1.5,
  wobblePlowSteady: 0.75,
  wobbleAir: 0.012,
});

export const cloneTuning = (t: Readonly<Tuning> = DEFAULT_TUNING): Tuning => ({ ...t });

/** Slider ranges for the tuning panel. */
export const TUNING_RANGES: Record<keyof Tuning, [min: number, max: number, step: number]> = {
  gravity: [5, 25, 0.1],
  startSpeed: [0, 20, 0.5],
  snowFriction: [0, 0.2, 0.005],
  dragCruise: [0.0005, 0.012, 0.0001],
  dragTuck: [0.0005, 0.012, 0.0001],
  dragPlow: [0.0005, 0.02, 0.0001],
  plowBrake: [0, 3, 0.05],
  plowFloor: [0, 15, 0.5],
  plowMaxDecel: [1, 25, 0.5],
  turnRate: [0.5, 6, 0.1],
  turnRateTuck: [0.2, 6, 0.1],
  turnRatePlow: [0.5, 6, 0.1],
  turnRateAir: [0, 6, 0.1],
  grip: [0.2, 4, 0.05],
  gripTuck: [0.2, 4, 0.05],
  gripPlow: [0.2, 4, 0.05],
  skidGrip: [0.1, 1, 0.05],
  maxTraverseDeg: [30, 90, 1],
  stanceRate: [1, 20, 0.5],
  jumpSpeed: [0, 10, 0.25],
  crashImpact: [4, 40, 0.5],
  crashLandingSlipDeg: [20, 120, 1],
  crashTreeSpeed: [1, 30, 0.5],
  wobbleBase: [0, 0.02, 0.0005],
  wobblePerSpeed: [0, 0.003, 0.0001],
  wobbleTuckBoost: [0, 5, 0.1],
  wobblePlowSteady: [0, 1, 0.05],
  wobbleAir: [0, 0.05, 0.001],
};
