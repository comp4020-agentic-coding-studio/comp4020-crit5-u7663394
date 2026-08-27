// How hard is One Button Tower, actually?
//
//   node scripts/difficulty.mjs
//
// A throwaway that stopped being one. It plays thousands of rounds against
// src/scripts/rules.ts with a model of a human hand -- a timing error in
// milliseconds, converted to a horizontal offset by however fast the slab is
// moving at that height -- and reports where players of each ability die.
//
// It exists because "is this fair?" is not a question a screenshot answers and
// not one a pass/fail sensor answers either. check:play proves an ending is
// reachable; it says nothing about whether the ending is always a loss on slab
// nine, which is the difference between a game and a formality. And the rules
// are pure functions, so the whole distribution costs milliseconds -- there is
// no reason to guess.
//
// NOT wired into `pnpm check`: it measures a design, not a contract, and a
// tuning number is not a thing to go red about.

import {
  applyDrop,
  newGame,
  resolveDrop,
  scoreOf,
  START_WIDTH,
  SWEEP,
  sweepPeriod,
  topOf,
  WIN_AT,
} from "../src/scripts/rules.ts";

const ROUNDS = 4000;

/** Timing precision, in milliseconds of standard deviation. */
const HANDS = [
  { name: "expert   (40ms)", sigma: 0.04 },
  { name: "practised(70ms)", sigma: 0.07 },
  { name: "newcomer(110ms)", sigma: 0.11 },
  { name: "flailing(300ms)", sigma: 0.3 },
];

/** Box-Muller, so the error model is a bell rather than a coin. */
function gaussian() {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

/**
 * A slab crosses 4 * SWEEP world units per full period, at constant speed --
 * the sweep is a triangle wave, so a millisecond of hand error is worth the
 * same offset wherever in the sweep it lands.
 */
function offsetFor(height, sigma) {
  const speed = (4 * SWEEP) / sweepPeriod(height);
  const error = gaussian() * sigma * speed;
  return Math.max(-SWEEP, Math.min(SWEEP, error));
}

function playRound(sigma) {
  let state = newGame();
  while (state.outcome === "playing") {
    const base = topOf(state);
    const height = scoreOf(state);
    state = applyDrop(state, {
      x: base.x + offsetFor(height, sigma),
      w: base.w,
    }).state;
  }
  return { score: scoreOf(state), outcome: state.outcome };
}

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

console.log(
  `${ROUNDS} rounds per hand; win at ${WIN_AT}; start width ${START_WIDTH}\n`,
);
console.log("hand              median   p90   best   win%   reached 10+");
for (const { name, sigma } of HANDS) {
  const rounds = Array.from({ length: ROUNDS }, () => playRound(sigma));
  const scores = rounds.map((r) => r.score).sort((a, b) => a - b);
  const wins = rounds.filter((r) => r.outcome === "won").length;
  const ten = rounds.filter((r) => r.score >= 10).length;
  console.log(
    `${name}   ${String(quantile(scores, 0.5)).padStart(5)} ` +
      `${String(quantile(scores, 0.9)).padStart(5)} ` +
      `${String(scores[scores.length - 1]).padStart(6)} ` +
      `${((wins / ROUNDS) * 100).toFixed(1).padStart(6)} ` +
      `${((ten / ROUNDS) * 100).toFixed(1).padStart(9)}%`,
  );
}

// How much width a single drop costs at a given hand, which is the number that
// actually decides the shape of the curve.
console.log("\nwidth kept after one drop, from a full-width slab:");
for (const { name, sigma } of HANDS) {
  const kept = Array.from({ length: ROUNDS }, () => {
    const result = resolveDrop(
      { x: 0, w: START_WIDTH },
      { x: offsetFor(0, sigma), w: START_WIDTH },
    );
    return result.placed?.w ?? 0;
  }).sort((a, b) => a - b);
  console.log(`${name}   median ${quantile(kept, 0.5).toFixed(3)}`);
}
