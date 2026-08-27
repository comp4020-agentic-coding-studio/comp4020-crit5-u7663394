// The rules of One Button Tower, with no DOM and no canvas in sight.
//
// Everything here is a pure function over plain data, which is the whole point:
// the one rule C5 asks to be covered by a focused automated test is the trim,
// and a trim that can only be exercised by driving Chrome is a rule that gets
// tested once and then never again. spec/crit-5.test.ts imports this module
// directly and asserts the rule in milliseconds.
//
// World units, not pixels. A slab's width starts at 1 and the sweep is 0.85
// wide whatever the screen is, so the game is exactly as hard on a 390px phone
// as on a 1920px desktop. Sizing difficulty in pixels would have made the phone
// version a different — and unfairer — game.

/** A slab of tower: centre and width, both in world units. */
export interface Slab {
  readonly x: number;
  readonly w: number;
}

export type Outcome = "playing" | "won" | "lost";

/** Width of the first slab. Every later width is a fraction of it. */
export const START_WIDTH = 1;

/** Slabs stacked on the base before the tower is finished. */
export const WIN_AT = 20;

/**
 * How far off centre still counts as a clean landing, in world units.
 *
 * Fixed rather than proportional on purpose: as the tower narrows, the same
 * absolute tolerance is a *larger* share of the slab, so the endgame stops
 * being a coin flip on input latency. That asymmetry is the forgiveness the
 * player never notices and always feels.
 */
export const SNAP = 0.022;

/** How far either side of the slab below the hovering slab travels. */
export const SWEEP = 0.85;

export interface DropResult {
  /** Did any part of the slab land on the one below? */
  readonly hit: boolean;
  /** Was it close enough to keep its full width? */
  readonly perfect: boolean;
  /** The part that stays, or null on a complete miss. */
  readonly placed: Slab | null;
  /** The overhang that falls away, or null when there wasn't one. */
  readonly slice: Slab | null;
}

/**
 * Land `moving` on `base` and work out what survives.
 *
 * The overlap is the intersection of the two spans. Whatever of `moving` sticks
 * out past it is the slice, and it is always on one side — the side the slab
 * drifted towards.
 */
export function resolveDrop(base: Slab, moving: Slab): DropResult {
  const offset = moving.x - base.x;

  if (Math.abs(offset) <= SNAP) {
    return {
      hit: true,
      perfect: true,
      placed: { x: base.x, w: moving.w },
      slice: null,
    };
  }

  const left = Math.max(base.x - base.w / 2, moving.x - moving.w / 2);
  const right = Math.min(base.x + base.w / 2, moving.x + moving.w / 2);
  const overlap = right - left;

  if (overlap <= 0) {
    return { hit: false, perfect: false, placed: null, slice: { ...moving } };
  }

  const placed: Slab = { x: (left + right) / 2, w: overlap };
  const slice: Slab =
    offset > 0
      ? sliceBetween(right, moving.x + moving.w / 2)
      : sliceBetween(moving.x - moving.w / 2, left);

  return { hit: true, perfect: false, placed, slice };
}

function sliceBetween(from: number, to: number): Slab {
  return { x: (from + to) / 2, w: to - from };
}

export interface GameState {
  /** Bottom slab first. Its length is the tower's height in slabs. */
  readonly stack: readonly Slab[];
  readonly outcome: Outcome;
  /** Drops attempted this round, landed or not. */
  readonly moves: number;
  /** Clean landings in a row, right now. */
  readonly streak: number;
}

export function newGame(): GameState {
  return {
    stack: [{ x: 0, w: START_WIDTH }],
    outcome: "playing",
    moves: 0,
    streak: 0,
  };
}

export function topOf(state: GameState): Slab {
  return state.stack[state.stack.length - 1];
}

/** Slabs stacked *on* the base — what the player is shown as their score. */
export function scoreOf(state: GameState): number {
  return state.stack.length - 1;
}

export interface DropOutcome {
  readonly state: GameState;
  readonly result: DropResult;
}

const NO_DROP: DropResult = {
  hit: false,
  perfect: false,
  placed: null,
  slice: null,
};

/**
 * Apply one drop. A drop on a finished round is a no-op rather than an error:
 * the player is allowed to keep hitting the button, and the restart is the
 * caller's business, not the rules'.
 */
export function applyDrop(state: GameState, moving: Slab): DropOutcome {
  if (state.outcome !== "playing") return { state, result: NO_DROP };

  const result = resolveDrop(topOf(state), moving);
  const moves = state.moves + 1;

  if (!result.placed) {
    return { state: { ...state, outcome: "lost", moves, streak: 0 }, result };
  }

  const stack = [...state.stack, result.placed];
  const height = stack.length - 1;
  return {
    state: {
      stack,
      outcome: height >= WIN_AT ? "won" : "playing",
      moves,
      streak: result.perfect ? state.streak + 1 : 0,
    },
    result,
  };
}

/**
 * Seconds for one full there-and-back sweep at this height.
 *
 * The tower narrowing is the difficulty curve; this is a second, gentler one so
 * that a player who has learnt the timing still has something to learn at slab
 * fifteen. Clamped, because a sweep faster than a reaction is not difficulty.
 */
export function sweepPeriod(height: number): number {
  return Math.max(1.25, 2.3 - height * 0.05);
}

/**
 * Linear ping-pong in [-1, 1]. Starts at -1, reaches +1 at the half period.
 *
 * Deliberately not a sine. A sine lingers at the ends and is quickest through
 * the middle, which is precisely where the player is aiming — it reads as the
 * game cheating. A constant speed is legible, and one layer owns the easing.
 */
export function triangle(t: number, period: number): number {
  const phase = (((t % period) + period) % period) / period;
  return phase < 0.5 ? -1 + 4 * phase : 3 - 4 * phase;
}
