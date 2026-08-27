// Appearance combinations, one picked at random for each new tower.
//
// Both reference images do the same thing and it is the reason they read as
// one artefact rather than a pile of coloured boxes: the sky is a two-stop
// gradient in one family, and the tower is a *ramp* in a different family that
// runs the whole height of the stack. So the colour of a slab is not a property
// of the slab --- it is a property of how high up the tower it is, which means
// the tower gets more beautiful as the player gets further. That is the reward
// this game has instead of a score bonus.
//
// Handpicked rather than generated. Random hues produce a different game every
// round and an ugly one most rounds; six combinations that were each looked at
// produce a different game every round and a good one every time.

export interface Theme {
  readonly name: string;
  /** Sky gradient, top to bottom. */
  readonly sky: readonly [string, string];
  /** Slab colours, bottom of the tower to the top. Sampled across WIN_AT. */
  readonly ramp: readonly string[];
  /** HUD text. Chosen against the *top* of the sky, where the score sits. */
  readonly ink: string;
  /** Drifting motes and the sparks a clean landing throws. */
  readonly spark: string;
  /** Radial wash behind the tower, so a wide viewport isn't empty either side. */
  readonly glow: string;
}

export const THEMES: readonly Theme[] = [
  {
    // reference/ref1.jpeg: charcoal sky, tower running red at the base up
    // through orange to a yellow crown.
    name: "ember",
    sky: ["#141212", "#2c1d18"],
    ramp: ["#a5121b", "#e03e22", "#f97316", "#fbbf24", "#fef3c7"],
    ink: "#f6f1ea",
    spark: "#fff4d6",
    glow: "rgb(249 115 22 / 0.16)",
  },
  {
    // reference/ref2.jpeg: teal-to-sage sky, tower from deep violet up to a
    // pale cream that almost matches the light.
    name: "aurora",
    sky: ["#17615f", "#a9d6a0"],
    ramp: ["#2b0a55", "#6d28d9", "#b39ddb", "#f3ddc6", "#fdf4e8"],
    ink: "#f4fbf3",
    spark: "#ffffff",
    glow: "rgb(255 255 255 / 0.14)",
  },
  {
    name: "dusk",
    sky: ["#140a2c", "#7d1f58"],
    ramp: ["#0369a1", "#0ea5e9", "#67e8f9", "#e0f2fe", "#ffffff"],
    ink: "#f3e8ff",
    spark: "#c7f2ff",
    glow: "rgb(56 189 248 / 0.16)",
  },
  {
    // The one light theme. It exists so a round can open bright --- and so the
    // HUD ink is exercised against a pale sky rather than only dark ones.
    name: "sherbet",
    sky: ["#fde3cb", "#f2977c"],
    ramp: ["#0f3d3a", "#0f766e", "#2dd4bf", "#a7f3d0", "#f0fdfa"],
    ink: "#3d2620",
    spark: "#ffffff",
    glow: "rgb(15 61 58 / 0.12)",
  },
  {
    name: "cobalt",
    sky: ["#081a3a", "#2f63ab"],
    ramp: ["#b45309", "#f59e0b", "#fcd34d", "#fef3c7", "#ffffff"],
    ink: "#e9f1ff",
    spark: "#ffe9b0",
    glow: "rgb(245 158 11 / 0.15)",
  },
  {
    name: "moss",
    sky: ["#0e1f19", "#41603b"],
    ramp: ["#6d1414", "#c0392b", "#fb8c48", "#fcd9b0", "#fff6ea"],
    ink: "#eef7ea",
    spark: "#ffd9b8",
    glow: "rgb(224 122 60 / 0.15)",
  },
];

/** The theme the page falls back to before any script has run. Keep the CSS in
 *  src/styles/styles.css agreeing with this one: it is what a visitor sees if
 *  the bundle is slow, and C5 gives the opening screen exactly one chance. */
export const DEFAULT_THEME = THEMES[0];

export type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toCss([r, g, b]: Rgb): string {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Shade towards white (positive) or black (negative), for the three faces. */
export function shade(colour: Rgb, amount: number): Rgb {
  return mix(colour, amount > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(amount));
}

/**
 * Sample a theme's ramp at `t` in [0, 1]. Beyond 1 it holds the crown colour,
 * which only matters if WIN_AT ever moves.
 */
export function rampAt(theme: Theme, t: number): Rgb {
  const stops = theme.ramp.map(parseHex);
  const clamped = Math.min(Math.max(t, 0), 1);
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  return mix(stops[index], stops[index + 1], scaled - index);
}

/** A theme that is not the one just played, so a restart visibly restarts. */
export function pickTheme(previous?: Theme): Theme {
  const options = previous ? THEMES.filter((t) => t !== previous) : THEMES;
  return options[Math.floor(Math.random() * options.length)];
}
