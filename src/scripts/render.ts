// Drawing One Button Tower. Knows about pixels; knows nothing about rules.
//
// The projection is 2:1 isometric, matching both reference images: a slab is a
// rhombus top face plus the two side faces a camera above and to the front can
// see. Movement is along the world X axis only, so the tower narrows in one
// dimension and the depth stays put --- which is what makes "the overhang falls
// off" legible rather than a puzzle.
//
// Two rules from CLAUDE.md are load-bearing in here and both were paid for:
//
//   - the canvas gets its box from its parent (position: absolute; inset: 0),
//     never from its own bitmap. A <canvas> is a replaced element, so a
//     percentage height inside a flex parent falls back to the height
//     *attribute* --- which the drawing code sets from the height it measured.
//     That loop is silent, no check goes red, and in a game it is worse than
//     cosmetic: if the drawing and the hit-testing disagree about the box, the
//     player is hit by something they can see they dodged.
//   - everything is scaled in units of the canvas box. A slab fixed in pixels
//     is a different game on a phone than on a desktop, and the phone one is
//     always the unfair one.

import type { Slab } from "./rules";
import { SWEEP, WIN_AT } from "./rules";
import { mix, rampAt, shade, toCss, type Rgb, type Theme } from "./themes";

/** Screen height of a slab, as a fraction of the projection scale. */
const BLOCK = 0.44;
/** 2:1 isometric: one world unit of depth is half a unit of screen drop. */
const TILT = 0.5;
/** Slabs are as deep as they start wide, so the opening slab is a square. */
export const DEPTH = 1;
/** Where the top of the tower sits, as a fraction of the canvas height. */
const HORIZON = 0.56;

export interface Geometry {
  readonly k: number;
  readonly bh: number;
  readonly ox: number;
  readonly oy: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Projection scale for a canvas box.
 *
 * Width-led with a height cap: a wide desktop would otherwise draw a slab so
 * large the tower never fits, and a tall phone one so small it disappears. The
 * phone viewport is width-limited and the desktop one height-limited, so the
 * two terms are tuned against different screens.
 *
 * The width term is DERIVED, not chosen. A slab at the far end of its sweep
 * reaches `SWEEP + w/2` in world units, and its rightmost screen point adds
 * another `DEPTH / 2` from the projection — so half the canvas has to hold
 * `0.5 + SWEEP + DEPTH / 2` world units or the slab slides off the edge at the
 * extremes of its travel. It did: at 390px the opening slab was clipped by
 * about 20px twice a sweep, which is the one viewport where losing sight of the
 * thing you are timing is least affordable. Writing `0.27` here instead would
 * have been the same number with the reason deleted, and would go quietly wrong
 * the day SWEEP moves.
 *
 * COUPLED to `--slab-width: min(54%, 50vh)` on `.opening-slab` in
 * src/styles/styles.css, which draws the same slab in CSS for the moment before
 * this file exists: a slab is 2k wide, so the two percentages are twice the two
 * terms below. Change one and change the other, or the page pops the instant
 * the script boots.
 */
export function geometryFor(w: number, h: number): Geometry {
  const widest = 0.5 + SWEEP + DEPTH / 2;
  const k = Math.min(w / (2 * widest), h * 0.25);
  return { k, bh: k * BLOCK, ox: w / 2, oy: h * HORIZON, w, h };
}

export interface Falling {
  slab: Slab;
  level: number;
  vy: number;
  vx: number;
  angle: number;
  spin: number;
  life: number;
  colour: Rgb;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
}

export interface Mote {
  x: number;
  y: number;
  drift: number;
  size: number;
  alpha: number;
}

export interface Ring {
  slab: Slab;
  level: number;
  life: number;
}

export interface Scene {
  readonly theme: Theme;
  readonly stack: readonly Slab[];
  /** The slab waiting to be dropped, or null once play has ended. */
  readonly moving: Slab | null;
  /** How far the hovering slab floats above its resting level, in levels. */
  readonly hover: number;
  /** How far the most recently placed slab still has to fall, in levels. */
  readonly settle: number;
  readonly falling: readonly Falling[];
  readonly sparks: readonly Spark[];
  readonly motes: readonly Mote[];
  readonly rings: readonly Ring[];
  readonly camLevel: number;
  readonly camX: number;
  readonly shake: number;
  /** How strongly to draw the landing guide: 1 early, 0 once the game asks. */
  readonly guide: number;
}

/** Slab colour is a function of height, not of the slab: see themes.ts. */
export function slabColour(theme: Theme, level: number): Rgb {
  return rampAt(theme, level / WIN_AT);
}

type Point = readonly [number, number];

function projector(g: Geometry, scene: Scene) {
  const jitter = scene.shake;
  const ox = g.ox + (Math.random() - 0.5) * jitter;
  const oy = g.oy + (Math.random() - 0.5) * jitter;
  return (x: number, z: number, level: number): Point => [
    ox + (x - scene.camX - z + DEPTH / 2) * g.k,
    oy - (level - scene.camLevel) * g.bh + (x + z - DEPTH / 2) * g.k * TILT,
  ];
}

function face(ctx: CanvasRenderingContext2D, points: readonly Point[], fill: string) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * One slab, as three flat faces. No outlines: both references are flat-shaded,
 * and the seams read anyway because a slab is never wider than the one below,
 * so a sliver of each top face always shows. That stepped edge is the tower's
 * whole history, drawn for free.
 */
function drawSlab(
  ctx: CanvasRenderingContext2D,
  project: ReturnType<typeof projector>,
  g: Geometry,
  slab: Slab,
  level: number,
  colour: Rgb,
  highlight = 0,
) {
  const x0 = slab.x - slab.w / 2;
  const x1 = slab.x + slab.w / 2;
  const top = mix(shade(colour, 0.12), [255, 255, 255], highlight);
  const left = shade(colour, -0.1);
  const right = shade(colour, -0.28);

  const a = project(x0, 0, level);
  const b = project(x1, 0, level);
  const c = project(x1, DEPTH, level);
  const d = project(x0, DEPTH, level);
  const down = (p: Point): Point => [p[0], p[1] + g.bh];

  face(ctx, [d, c, down(c), down(d)], toCss(left));
  face(ctx, [b, c, down(c), down(b)], toCss(right));
  face(ctx, [a, b, c, d], toCss(top));
}

/**
 * The landing guide: where the slab has to be for a clean drop.
 *
 * It is the footprint of the slab below, drawn as an outline at the altitude
 * the slab is *currently* flying at, with two verticals tying it down to the
 * tower. Aim the moving slab into the outline and the drop is perfect.
 *
 * The obvious version is a pair of vertical rails rising from the tower's
 * corners, and it is wrong here, because in this projection a slab moving along
 * world X travels *diagonally* on screen: one world unit right is (k, k * TILT)
 * — right AND down. Vertical rails would ask the player to line up against
 * lines the slab never travels along. A target at the slab's own altitude is
 * the same comparison the eye is already making.
 *
 * Drawn under the moving slab and over the tower, so the slab occludes the
 * target as it covers it — which is itself the feedback, without a word.
 */
function drawGuide(
  ctx: CanvasRenderingContext2D,
  project: ReturnType<typeof projector>,
  g: Geometry,
  scene: Scene,
) {
  if (scene.guide <= 0 || !scene.moving) return;

  const base = scene.stack[scene.stack.length - 1];
  const topLevel = scene.stack.length;
  const flying = topLevel + 1 + scene.hover;
  const x0 = base.x - base.w / 2;
  const x1 = base.x + base.w / 2;

  const corner = (x: number, z: number, level: number) => project(x, z, level);
  const target: Point[] = [
    corner(x0, 0, flying),
    corner(x1, 0, flying),
    corner(x1, DEPTH, flying),
    corner(x0, DEPTH, flying),
  ];

  ctx.save();
  // `ink`, not `spark`. Sparks are white on five of the six palettes, which is
  // right for a flash against a slab and invisible against the pale sky of the
  // light one. `ink` is the colour every theme guarantees reads against its own
  // sky --- the same reason the ending's scrim is built from the sky colour.
  ctx.strokeStyle = scene.theme.ink;
  ctx.lineWidth = Math.max(1, g.k * 0.01);
  ctx.lineJoin = "round";

  // The two verticals, from the target's side corners down to the tower's, so
  // the outline reads as "directly above there" rather than as a floating
  // rectangle. Dashed and fainter than the target: they are the sentence's
  // subordinate clause.
  ctx.globalAlpha = scene.guide * 0.3;
  ctx.setLineDash([g.k * 0.05, g.k * 0.05]);
  for (const [x, z] of [
    [x1, 0],
    [x0, DEPTH],
  ] as const) {
    const from = corner(x, z, flying);
    const to = corner(x, z, topLevel);
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.globalAlpha = scene.guide * 0.62;
  ctx.beginPath();
  ctx.moveTo(target[0][0], target[0][1]);
  for (const [x, y] of target.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSky(ctx: CanvasRenderingContext2D, g: Geometry, scene: Scene) {
  const sky = ctx.createLinearGradient(0, 0, 0, g.h);
  sky.addColorStop(0, scene.theme.sky[0]);
  sky.addColorStop(1, scene.theme.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, g.w, g.h);

  // A soft wash behind the tower. Both references are portrait; a 1920-wide
  // viewport is mostly sky, and this is what stops it reading as empty.
  const glow = ctx.createRadialGradient(
    g.ox,
    g.oy,
    0,
    g.ox,
    g.oy,
    Math.max(g.w, g.h) * 0.62,
  );
  glow.addColorStop(0, scene.theme.glow);
  glow.addColorStop(1, "rgb(0 0 0 / 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, g.w, g.h);
}

function drawMotes(ctx: CanvasRenderingContext2D, g: Geometry, scene: Scene) {
  ctx.fillStyle = scene.theme.spark;
  for (const mote of scene.motes) {
    ctx.globalAlpha = mote.alpha;
    ctx.fillRect(mote.x * g.w, mote.y * g.h, mote.size, mote.size);
  }
  ctx.globalAlpha = 1;
}

export function draw(ctx: CanvasRenderingContext2D, g: Geometry, scene: Scene) {
  drawSky(ctx, g, scene);
  drawMotes(ctx, g, scene);

  const project = projector(g, scene);

  // Only the slabs that can reach the screen. A twenty-slab tower is mostly
  // below the fold and drawing all of it is work nobody sees.
  const lowest = Math.max(
    0,
    Math.floor(scene.camLevel - (g.h - g.oy) / g.bh) - 2,
  );
  for (let i = lowest; i < scene.stack.length; i += 1) {
    const isTop = i === scene.stack.length - 1;
    drawSlab(
      ctx,
      project,
      g,
      scene.stack[i],
      i + 1 + (isTop ? scene.settle : 0),
      slabColour(scene.theme, i),
      isTop ? Math.min(scene.settle * 1.4, 0.35) : 0,
    );
  }

  for (const ring of scene.rings) {
    const grow = 1 - ring.life;
    const spread = ring.slab.w / 2 + grow * 0.5;
    const p = (x: number, z: number) =>
      project(ring.slab.x + x, DEPTH / 2 + z, ring.level);
    ctx.beginPath();
    const corners: Point[] = [
      p(0, -DEPTH / 2 - grow * 0.5),
      p(spread, 0),
      p(0, DEPTH / 2 + grow * 0.5),
      p(-spread, 0),
    ];
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (const [x, y] of corners.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.strokeStyle = scene.theme.spark;
    ctx.globalAlpha = ring.life * 0.55;
    ctx.lineWidth = Math.max(1, g.k * 0.012);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const piece of scene.falling) {
    const centre = project(piece.slab.x, DEPTH / 2, piece.level);
    ctx.save();
    ctx.globalAlpha = Math.min(1, piece.life * 1.6);
    ctx.translate(centre[0], centre[1]);
    ctx.rotate(piece.angle);
    ctx.translate(-centre[0], -centre[1]);
    drawSlab(ctx, project, g, piece.slab, piece.level, piece.colour);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  drawGuide(ctx, project, g, scene);

  if (scene.moving) {
    drawSlab(
      ctx,
      project,
      g,
      scene.moving,
      scene.stack.length + 1 + scene.hover,
      slabColour(scene.theme, scene.stack.length),
    );
  }

  ctx.fillStyle = scene.theme.spark;
  for (const spark of scene.sparks) {
    ctx.globalAlpha = Math.min(1, spark.life * 1.8);
    ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
  }
  ctx.globalAlpha = 1;
}

/** Screen position of a point on the current top face, for spawning sparks. */
export function projectPoint(
  g: Geometry,
  scene: Scene,
  x: number,
  z: number,
  level: number,
): Point {
  return [
    g.ox + (x - scene.camX - z + DEPTH / 2) * g.k,
    g.oy - (level - scene.camLevel) * g.bh + (x + z - DEPTH / 2) * g.k * TILT,
  ];
}
