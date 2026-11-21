// Score is chips × mult, Balatro-style. Every stunt, kill and near-miss opens or extends a
// "hand": its chips add up, and its mult grows with how fast you were going when you earned
// them. The hand cashes in once you stop scoring for a moment (the clock pauses in the air).
// Getting shot or wiping out loses the open hand, so a long fast combo is a real gamble.

import { DT } from './constants';
import { length } from './math';
import type { PlayerState, SimEvent } from './player';
import type { Tuning } from './tuning';

export interface Hand {
  chips: number;
  mult: number;
  events: number;
  /** Seconds left before it cashes. */
  timer: number;
}

export interface ScoreState {
  total: number;
  hand: Hand | null;
  hands: number;
  best: number;
  kills: number;
  headshots: number;
  grazes: number;
  whiffs: number;
  /** Points thrown away by losing hands. */
  lost: number;
}

export interface ScoreContext {
  tuning: Tuning;
  emit: (event: SimEvent) => void;
}

export const newScore = (): ScoreState => ({
  total: 0,
  hand: null,
  hands: 0,
  best: 0,
  kills: 0,
  headshots: 0,
  grazes: 0,
  whiffs: 0,
  lost: 0,
});

/** Mult a scoring event is worth just for how fast you were going. */
export const speedMult = (p: PlayerState, t: Tuning): number => Math.max(0, length(p.vel) - 10) * t.multPerSpeed;

export function award(p: PlayerState, label: string, chips: number, mult: number, ctx: ScoreContext): void {
  if (p.status === 'crashed') return;
  const s = p.score;
  const hand = (s.hand ??= { chips: 0, mult: 1, events: 0, timer: 0 });
  const added = mult + speedMult(p, ctx.tuning);
  hand.chips += chips;
  hand.mult += added;
  hand.events++;
  hand.timer = ctx.tuning.comboWindow;
  ctx.emit({ type: 'chips', player: p.id, label, chips, mult: added });
}

export function cashHand(p: PlayerState, ctx: ScoreContext): void {
  const s = p.score;
  const hand = s.hand;
  if (!hand) return;
  const points = Math.round(hand.chips * hand.mult);
  s.total += points;
  s.hands++;
  s.best = Math.max(s.best, points);
  s.hand = null;
  ctx.emit({ type: 'handCashed', player: p.id, chips: hand.chips, mult: hand.mult, points });
}

export function loseHand(p: PlayerState, ctx: ScoreContext): void {
  const s = p.score;
  const hand = s.hand;
  if (!hand) return;
  const points = Math.round(hand.chips * hand.mult);
  s.lost += points;
  s.hand = null;
  ctx.emit({ type: 'handLost', player: p.id, points });
}

/** Per tick: the hand's clock, and mult that trickles in while you stay fast. */
export function stepScore(p: PlayerState, ctx: ScoreContext): void {
  const hand = p.score.hand;
  if (!hand || p.status !== 'skiing') return;
  const speed = length(p.vel);
  if (speed > 20) hand.mult += DT * (speed - 20) * ctx.tuning.multFlow * (1 + 0.5 * p.tuck);
  if (p.airTime < 0.12) hand.timer -= DT;
  if (hand.timer <= 0) cashHand(p, ctx);
}

/** Reaching base camp pays a bonus hand: faster runs get more chips and more mult. */
export function finishBonus(p: PlayerState, finishD: number, seconds: number, ctx: ScoreContext): void {
  const avg = finishD / Math.max(seconds, 1);
  const par = finishD / 15;
  const chips = 150 + Math.round(Math.max(0, par - seconds) * 3);
  award(p, 'Base camp', chips, avg * 0.06, ctx);
  cashHand(p, ctx);
}

/** What the run pays at the lodge. Wiping out halves it. */
export const payout = (p: PlayerState): number =>
  p.status === 'finished' ? p.score.total : Math.floor(p.score.total / 2);
