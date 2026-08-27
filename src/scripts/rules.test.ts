import { describe, expect, it } from "vitest";

import {
  GUIDE_UNTIL,
  guideStrength,
  sweepPeriod,
  triangle,
  WIN_AT,
} from "./rules";

// The difficulty curve, as a shape rather than as a set of numbers.
//
// Co-located rather than in spec/, because none of this answers a line of C5's
// published spec --- it is a property of *this* design, and it retires with the
// game. What it protects is the thing a tuning session breaks by accident: the
// curve is two segments joined at GUIDE_UNTIL, and the whole promise of that
// join is that a player crossing it feels a change of rate and not a step. A
// discontinuity would be invisible in every screenshot and obvious to the one
// person who plays through slab ten.
//
// Deliberately no assertion on any specific period. Pinning "2.4s at slab 10"
// would turn every tuning pass red for no reason and get the file deleted;
// scripts/difficulty.mjs is where the actual values are judged, against 4000
// simulated rounds, because a balance number is a design decision and not a
// contract.

describe("the sweep gets harder, smoothly, and stops getting harder", () => {
  const heights = Array.from({ length: WIN_AT + 1 }, (_, i) => i);

  it("never gets easier as the tower grows", () => {
    for (const height of heights.slice(1)) {
      expect(
        sweepPeriod(height),
        `slab ${height} sweeps slower than slab ${height - 1}, so the game got easier`,
      ).toBeLessThanOrEqual(sweepPeriod(height - 1));
    }
  });

  it("has no step at the boundary between the two halves", () => {
    // Approach the join from both sides. The segments are defined separately,
    // so this is the assertion that keeps them agreeing.
    const below = sweepPeriod(GUIDE_UNTIL - 0.0001);
    const at = sweepPeriod(GUIDE_UNTIL);
    const above = sweepPeriod(GUIDE_UNTIL + 0.0001);
    expect(at).toBeCloseTo(below, 3);
    expect(above).toBeCloseTo(at, 3);
  });

  it("speeds up faster after the guide goes than before", () => {
    // The point of the two segments: the second half is where the difficulty
    // lives. If these ever came out equal the split would be decoration.
    const early = sweepPeriod(0) - sweepPeriod(GUIDE_UNTIL);
    const late = sweepPeriod(GUIDE_UNTIL) - sweepPeriod(WIN_AT);
    expect(late).toBeGreaterThan(early * 2);
  });

  it("holds a steady speed over the last slab instead of accelerating into it", () => {
    // Losing at 19 to a speed you never got to learn does not read as fair.
    expect(sweepPeriod(WIN_AT)).toBe(sweepPeriod(WIN_AT - 1));
  });

  it("never sweeps faster than a person can react to", () => {
    expect(sweepPeriod(WIN_AT)).toBeGreaterThan(0.6);
  });
});

describe("the landing guide fades out rather than switching off", () => {
  it("is fully drawn while the player is still learning", () => {
    expect(guideStrength(0)).toBe(1);
    expect(guideStrength(GUIDE_UNTIL - 4)).toBe(1);
  });

  it("is gone from the boundary onwards, and stays gone", () => {
    expect(guideStrength(GUIDE_UNTIL)).toBe(0);
    expect(guideStrength(WIN_AT)).toBe(0);
  });

  it("dims over several slabs, and never brightens again", () => {
    const run = Array.from({ length: WIN_AT + 1 }, (_, i) => guideStrength(i));
    for (const height of run.keys()) {
      if (height === 0) continue;
      expect(
        run[height],
        `the guide got stronger at slab ${height}, which reads as the game changing its mind`,
      ).toBeLessThanOrEqual(run[height - 1]);
    }
    // More than one step, or it is a switch wearing a fade's name.
    const partial = run.filter((value) => value > 0 && value < 1);
    expect(partial.length).toBeGreaterThan(1);
  });
});

describe("the sweep itself", () => {
  it("starts hard over at one side and crosses at a constant speed", () => {
    const period = 2;
    expect(triangle(0, period)).toBeCloseTo(-1, 10);
    expect(triangle(period / 4, period)).toBeCloseTo(0, 10);
    expect(triangle(period / 2, period)).toBeCloseTo(1, 10);
    expect(triangle(period, period)).toBeCloseTo(-1, 10);

    // Constant speed is the whole reason this is not a sine: equal slices of
    // time must cover equal distance, or the game is quickest exactly where the
    // player is aiming.
    const step = period / 16;
    const first = triangle(step, period) - triangle(0, period);
    for (let i = 1; i < 8; i += 1) {
      expect(
        triangle((i + 1) * step, period) - triangle(i * step, period),
      ).toBeCloseTo(first, 10);
    }
  });
});
