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

  /** Seconds between shots while the trigger is held. */
  fireInterval: number;
  magSize: number;
  reloadTime: number;
  weaponRange: number;
  /** Random spread when firing without holding aim, degrees. */
  hipSpreadDeg: number;
  /** Aim assist: shots bend toward a guard inside this cone, degrees. */
  assistAimDeg: number;
  assistHipDeg: number;
  /** Fraction of the assist cone lost at full tuck. The assist is the steady half of the trade. */
  assistTuckLoss: number;
  /** Fraction added to the assist cone at full snowplow. */
  assistPlowBonus: number;

  /** Hits you can take; the last one is a wipeout. */
  playerHp: number;
  /** Seconds without being hit to win one hit back. */
  hpRegenTime: number;
  /** Multiplies every guard's hit chance. */
  guardAccuracy: number;
  /** Speed (m/s) at which guards' hit chance is halved. Going fast is your armour. */
  dodgeSpeed: number;

  /** Seconds a hand stays open after its last chips (time in the air doesn't count). */
  comboWindow: number;
  /** Mult added with every scoring event, per m/s above 10 m/s. */
  multPerSpeed: number;
  /** Mult that trickles in per second, per m/s above 20 m/s, while a hand is open. */
  multFlow: number;
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

  fireInterval: 0.22,
  magSize: 8,
  reloadTime: 1.3,
  weaponRange: 150,
  hipSpreadDeg: 2,
  assistAimDeg: 7,
  assistHipDeg: 2.5,
  assistTuckLoss: 0.8,
  assistPlowBonus: 0.6,

  playerHp: 3,
  hpRegenTime: 10,
  guardAccuracy: 1,
  dodgeSpeed: 22,

  comboWindow: 3.5,
  multPerSpeed: 0.06,
  multFlow: 0.012,
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
  fireInterval: [0.05, 1, 0.01],
  magSize: [1, 30, 1],
  reloadTime: [0.2, 4, 0.1],
  weaponRange: [30, 300, 5],
  hipSpreadDeg: [0, 10, 0.25],
  assistAimDeg: [0, 20, 0.5],
  assistHipDeg: [0, 20, 0.5],
  assistTuckLoss: [0, 1, 0.05],
  assistPlowBonus: [0, 2, 0.05],
  playerHp: [1, 10, 1],
  hpRegenTime: [1, 60, 1],
  guardAccuracy: [0, 3, 0.05],
  dodgeSpeed: [5, 60, 1],
  comboWindow: [0.5, 10, 0.25],
  multPerSpeed: [0, 0.3, 0.005],
  multFlow: [0, 0.1, 0.001],
};
