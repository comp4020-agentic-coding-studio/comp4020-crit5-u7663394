// One Button Tower: the wiring. Rules live in rules.ts, pixels in render.ts,
// sound in audio.ts, colour in themes.ts. This file owns the loop, the input
// and the probe.
//
// The one thing in here that is a design decision rather than plumbing: a drop
// is RESOLVED at the instant the input arrives, and only then animated. The
// obvious build is the other way round --- play the fall, then work out where
// it landed --- and it feels like the game is arguing with you, because the
// slab you released over the centre lands wherever the centre had moved to by
// the time the animation finished. A dropped visual frame is a flicker; a
// dropped input is a move the player made and the game did not, and the player
// will blame themselves for it.
//
// It is also why input is never locked out during the fall: the next slab
// starts sweeping the moment the last one is committed, so there is no window
// in which a press does nothing.

import * as sfx from "./audio";
import {
  DEPTH,
  draw,
  geometryFor,
  projectPoint,
  slabColour,
  type Falling,
  type Mote,
  type Ring,
  type Scene,
  type Spark,
} from "./render";
import {
  applyDrop,
  newGame,
  scoreOf,
  SWEEP,
  sweepPeriod,
  topOf,
  triangle,
  WIN_AT,
  type GameState,
  type Outcome,
  type Slab,
} from "./rules";
import {
  parseHex,
  pickTheme,
  rampAt,
  shade,
  toCss,
  type Theme,
} from "./themes";

declare global {
  interface Window {
    __gameProbe?: () => {
      over: boolean;
      outcome: Outcome;
      moves: number;
      score: number;
      theme: string;
    };
  }
}

/** How far above its resting level the waiting slab floats, in levels. */
const HOVER = 1;
/** Seconds for a placed slab to drop into position. Short: it is not the game. */
const SETTLE = 0.13;
/** How long an ending sits before another press restarts, in milliseconds. */
const REPLAY_LOCKOUT = 700;
const BEST_KEY = "one-button-tower.best";

function must<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
}

const stage = must<HTMLElement>("[data-core-output]");
const canvas = must<HTMLCanvasElement>("[data-stage]");
const scoreText = must<HTMLElement>("[data-score]");
const bestText = must<HTMLElement>("[data-best]");
const verdict = must<HTMLElement>("[data-verdict]");
const verdictWord = must<HTMLElement>("[data-verdict-word]");
const verdictLine = must<HTMLElement>("[data-verdict-score]");
const button = must<HTMLButtonElement>("[data-core-interaction]");

const context = canvas.getContext("2d");
if (!context) throw new Error("no 2d context");
// Bound to a const so the null-check above survives into the loop. TypeScript
// drops `const` narrowing inside hoisted `function` declarations, and reaching
// for `!` would be lying about a guard that is real.
const ctx = context;

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

interface Round {
  game: GameState;
  theme: Theme;
  /** performance.now() when the current slab started its sweep. */
  moveStart: number;
  /** Which side this slab enters from; alternates so the timing is learnable. */
  dir: 1 | -1;
  /** Seconds left in the placed slab's drop. Linear: the easing is in one place. */
  settleT: number;
  falling: Falling[];
  sparks: Spark[];
  rings: Ring[];
  shake: number;
  /** performance.now() when play ended, or 0 while it is still going. */
  endedAt: number;
}

function startRound(theme: Theme): Round {
  return {
    game: newGame(),
    theme,
    moveStart: performance.now(),
    dir: 1,
    settleT: 0,
    falling: [],
    sparks: [],
    rings: [],
    shake: 0,
    endedAt: 0,
  };
}

let round = startRound(pickTheme());
let motes: Mote[] = [];
let camLevel = 1;
let camX = 0;
let last = performance.now();
let best = readBest();

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0; // private mode or storage disabled: a missing best is not a bug
  }
}

function writeBest(value: number) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* see above */
  }
}

function seedMotes() {
  const count = reduced.matches ? 0 : 30;
  motes = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    drift: 0.004 + Math.random() * 0.012,
    size: 1 + Math.round(Math.random() * 2),
    alpha: 0.15 + Math.random() * 0.5,
  }));
}

function movingSlab(now: number): Slab | null {
  if (round.game.outcome !== "playing") return null;
  const base = topOf(round.game);
  const seconds = (now - round.moveStart) / 1000;
  const period = sweepPeriod(scoreOf(round.game));
  return { x: base.x + triangle(seconds, period) * SWEEP * round.dir, w: base.w };
}

/**
 * How far the just-placed slab still has to fall, in levels.
 *
 * The countdown in step() is linear and the curve is applied here, once:
 * easing a timeline and then easing each step inside it compounds into a curve
 * nobody chose. This one is the distance still to fall under gravity, which is
 * why the slab hangs and then drops rather than drifting down evenly.
 */
function settleOffset(): number {
  const p = round.settleT / SETTLE;
  return HOVER * (2 * p - p * p);
}

function sceneNow(now: number): Scene {
  const bob = reduced.matches ? 0 : Math.sin(now / 320) * 0.05;
  return {
    theme: round.theme,
    stack: round.game.stack,
    moving: movingSlab(now),
    hover: HOVER + bob,
    settle: settleOffset(),
    falling: round.falling,
    sparks: round.sparks,
    motes,
    rings: round.rings,
    camLevel,
    camX,
    shake: reduced.matches ? 0 : round.shake,
  };
}

function spawnSparks(scene: Scene, slab: Slab, level: number, count: number) {
  if (reduced.matches) return;
  const g = geometryFor(canvas.width, canvas.height);
  for (let i = 0; i < count; i += 1) {
    const [x, y] = projectPoint(
      g,
      scene,
      slab.x + (Math.random() - 0.5) * slab.w,
      Math.random() * DEPTH,
      level,
    );
    round.sparks.push({
      x,
      y,
      vx: (Math.random() - 0.5) * g.k * 1.6,
      vy: -g.k * (0.4 + Math.random() * 0.9),
      size: Math.max(2, g.k * (0.008 + Math.random() * 0.014)),
      life: 0.5 + Math.random() * 0.5,
    });
  }
}

function drop() {
  const now = performance.now();

  if (round.game.outcome !== "playing") {
    if (now - round.endedAt > REPLAY_LOCKOUT) restart();
    return;
  }

  const moving = movingSlab(now);
  if (!moving) return;

  sfx.unlock();

  const scene = sceneNow(now);
  const before = round.game;
  const base = topOf(before);
  const { state, result } = applyDrop(before, moving);

  round.game = state;
  round.moveStart = now;
  round.dir = round.dir === 1 ? -1 : 1;

  /** Index of the slab just placed, and the level its top face rests at. */
  const index = before.stack.length;
  const topLevel = index + 1;

  if (result.slice) {
    // The overhang shears off where the slab was and tumbles away from the
    // tower. It starts with roughly the slab's own downward speed so the two
    // separate by drifting apart, not by one of them stalling in mid-air.
    const away = Math.sign(moving.x - base.x) || 1;
    round.falling.push({
      slab: result.slice,
      level: topLevel + HOVER,
      vy: result.placed ? -6 : -1,
      vx: away * (result.placed ? 0.5 : 0.7),
      angle: 0,
      spin: away * (2 + Math.random()),
      life: 1.6,
      colour: slabColour(round.theme, index),
    });
  }

  if (result.placed) {
    round.settleT = SETTLE;
    sfx.place(state.stack.length, result.perfect);
    if (result.slice) sfx.shear();
    if (result.perfect) {
      round.rings.push({ slab: result.placed, level: topLevel, life: 1 });
      spawnSparks(scene, result.placed, topLevel, 16);
    }
  } else {
    sfx.miss();
    round.shake = geometryFor(canvas.width, canvas.height).k * 0.12;
  }

  if (state.outcome !== "playing") end(now, state);
  // Same reasoning as in resize(): the state changed on this thread, so show it
  // on this thread. Leaving it to the next frame is what made the score read
  // stale to a sensor, and it is what would make the game feel late to a player
  // on a machine that is not delivering sixty frames a second.
  paint(now);
}

function end(now: number, state: GameState) {
  round.endedAt = now;
  const score = scoreOf(state);
  if (score > best) {
    best = score;
    writeBest(best);
  }
  if (state.outcome === "won") sfx.win();

  verdictWord.textContent = state.outcome === "won" ? "You win" : "Game over";
  verdictLine.textContent = `${score} of ${WIN_AT}`;
  verdict.dataset.outcome = state.outcome;
  verdict.hidden = false;
  button.setAttribute("aria-label", "Play again");
}

function restart() {
  round = startRound(pickTheme(round.theme));
  camLevel = 1;
  camX = 0;
  verdict.hidden = true;
  delete verdict.dataset.outcome;
  button.setAttribute("aria-label", "Drop the slab");
  applyTheme(round.theme);
  paint(performance.now());
}

/**
 * Push the round's palette into CSS as well as the canvas, so the page chrome,
 * the HUD ink and the no-script opening scene all move together. A theme that
 * only reached the canvas would leave a sherbet tower on an ember page.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement.style;
  root.setProperty("--sky-top", theme.sky[0]);
  root.setProperty("--sky-bottom", theme.sky[1]);
  root.setProperty("--ink", theme.ink);
  // The ending's veil. The theme's own sky-top colour, because that is the
  // colour every theme's ink was chosen to be legible against --- see the note
  // on .verdict in styles.css for the playtest that put it here.
  const [r, g, b] = parseHex(theme.sky[0]);
  root.setProperty("--scrim", `rgb(${r} ${g} ${b} / 0.82)`);
  const slab = rampAt(theme, 0);
  root.setProperty("--slab-top", toCss(shade(slab, 0.12)));
  root.setProperty("--slab-left", toCss(shade(slab, -0.1)));
  root.setProperty("--slab-right", toCss(shade(slab, -0.28)));
  document.documentElement.dataset.theme = theme.name;
}

function resize() {
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  // The early return is the whole point: a ResizeObserver that writes back a
  // size it measured never settles, and that hung a check:render run rather
  // than merely looking wrong.
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  // Assigning either dimension CLEARS the bitmap, so the stage is blank from
  // here until something repaints it. Waiting for the next animation frame is
  // the obvious thing and it is wrong: requestAnimationFrame is a request, not
  // a promise. Headless Chrome delivered 16 frames a second on one viewport and
  // *none at all* on the other, which left the canvas transparent and every DOM
  // sensor perfectly happy about it --- and a throttled tab, a backgrounded
  // window or a low-power mode does the same thing to a real player. Repaint
  // now, synchronously, on the thread that broke it.
  paint(performance.now());
}

/** Everything that puts the current state on the screen. Idempotent. */
function paint(now: number) {
  draw(ctx, geometryFor(canvas.width, canvas.height), sceneNow(now));
  const score = String(scoreOf(round.game));
  if (scoreText.textContent !== score) scoreText.textContent = score;
  const label = best > 0 ? `best ${best}` : "";
  if (bestText.textContent !== label) bestText.textContent = label;
}

function step(dt: number) {
  const follow = Math.min(1, dt * 9);
  camLevel += (round.game.stack.length - camLevel) * follow;
  camX += (topOf(round.game).x - camX) * follow;

  round.settleT = Math.max(0, round.settleT - dt);
  round.shake *= 1 - Math.min(1, dt * 7);
  if (round.shake < 0.4) round.shake = 0;

  for (const piece of round.falling) {
    piece.vy -= dt * 11;
    piece.level += piece.vy * dt;
    piece.slab = { x: piece.slab.x + piece.vx * dt, w: piece.slab.w };
    piece.angle += piece.spin * dt;
    piece.life -= dt;
  }
  round.falling = round.falling.filter(
    (piece) => piece.life > 0 && piece.level > camLevel - 14,
  );

  const g = geometryFor(canvas.width, canvas.height);
  for (const spark of round.sparks) {
    spark.vy += g.k * 4 * dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.life -= dt * 1.4;
  }
  round.sparks = round.sparks.filter((spark) => spark.life > 0);

  for (const ring of round.rings) ring.life -= dt * 2.2;
  round.rings = round.rings.filter((ring) => ring.life > 0);

  for (const mote of motes) {
    mote.y -= mote.drift * dt;
    if (mote.y < -0.02) {
      mote.y = 1.02;
      mote.x = Math.random();
    }
  }
}

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  paint(now);
  requestAnimationFrame(frame);
}

// --- input -----------------------------------------------------------------
//
// Two paths, one action. The <button> is a real button, so the browser hands us
// mouse, touch and pen through `pointerdown` for free; the window listener is
// what lets a player who has not clicked anything yet use the keyboard.
// Nothing listens for `click`, so a focused button activated by Space or Enter
// cannot drop twice.

button.addEventListener("pointerdown", () => drop());

window.addEventListener(
  "keydown",
  (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    if (event.repeat) return; // a held key is one move, not sixty
    if (event.target instanceof HTMLAnchorElement) return; // let the link be a link
    event.preventDefault(); // Space would otherwise scroll the page out from under it
    drop();
  },
  { passive: false },
);

window.__gameProbe = () => ({
  over: round.game.outcome !== "playing",
  outcome: round.game.outcome,
  moves: round.game.moves,
  score: scoreOf(round.game),
  theme: round.theme.name,
});

new ResizeObserver(() => resize()).observe(stage);
reduced.addEventListener("change", seedMotes);

applyTheme(round.theme);
seedMotes();
resize();
paint(performance.now());
// The CSS opening scene has done its job the moment a canvas is drawing one.
// Hiding it here rather than revealing the canvas keeps visibility in the safe
// direction: nothing a player needs is waiting on a script to appear.
document.documentElement.dataset.ready = "";
requestAnimationFrame(frame);
