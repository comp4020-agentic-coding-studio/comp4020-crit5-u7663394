import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// C5 "A game" --- the mechanically checkable lines of the published spec,
// asserted against the BUILT site so they check what actually ships.
//
//   https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/
//
// These are contracts, not implementations: what the game must do, not how it
// is built. Nothing here names Astro, and nothing here names a genre --- an
// arcade loop, a puzzle and a Twine-style branching story all have to pass.
//
// Contract tests retire with the brief they answer (spec/README.md draws that
// line); the two travelling checks live in spec/sensors.test.ts instead.
//
// FOUR SPEC LINES ARE NOT IN THIS FILE, because no test can hold them. They are
// still on the hook at the crit:
//
//   - "the opening screen invites the first move, and play teaches whatever
//     comes next" --- there IS a test below for the *absence* of instructions,
//     and one for the opening screen surviving a slow script, but no test can
//     tell an invitation from a blank rectangle. The pod plays cold and stays
//     unhelped until someone finishes or gives up; that settles it in about
//     ten seconds.
//   - "a stranger can pick it up and reach an ending inside five minutes" ---
//     check:play flails at it randomly, which proves an ending is *reachable*
//     and says nothing about five minutes or about a stranger.
//   - "one change you made came from playing the finished game rather than
//     reading its code" --- that is a claim about how the week went. It belongs
//     in PROCESS.md, pointed at the commit it produced.
//   - "you can account for how you directed, grounded and corrected the work"
//     --- that is the conversation, not the repo.
//
// And one line is satisfied by WRITING a test rather than by asserting one
// exists: "one rule of the game has a focused automated test". When the rule is
// real --- the collision that ends the round, the move that is illegal, the
// card that was the last one --- it gets its own `it()` in this file, asserting
// the rule directly and without Chrome. A test that merely counted test files
// would be a check that cannot fail on the fault it is named after.

const DIST = resolve("dist");

function walk(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const shipped = walk().map((path) =>
  relative(DIST, path).split(sep).join("/"),
);

const pages = shipped
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    html: readFileSync(join(DIST, name), "utf8"),
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

/** Everything the browser will execute: bundled modules and inline scripts. */
const shippedScript = [
  ...shipped
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(join(DIST, name), "utf8")),
  ...pages.flatMap(({ doc }) =>
    [...doc.querySelectorAll("script")].map((el) => el.textContent ?? ""),
  ),
].join("\n");

/**
 * Language that teaches the player the rules.
 *
 * The spec's words are "no instructions anywhere, on screen or off --- no
 * how-to-play modal, no instructions page, nothing in the README standing in
 * for either". This is a crude sensor for a judged line, and worth having
 * precisely because of *who* would otherwise add the text: asked to build a
 * game, an agent's most helpful, best-trained move is a controls legend or a
 * "How to play" panel, and that arrives late, in a hurry, while something else
 * is being fixed.
 *
 * Deliberately narrow. It catches text that names a control or announces a
 * lesson, not every sentence a game might want to say --- a page is allowed to
 * be named, to have a title, and to put words on an ending screen.
 */
const INSTRUCTION =
  /\b(how to play|instructions?|tutorial|controls:|objective:|goal:|the rules are|press (the )?(space|enter|arrow|[a-z]) |use the (arrow|wasd|mouse|keyboard)|click (here )?to (start|play|begin|move|jump)|tap to (start|play|begin|move|jump)|move with|jump with|aim with)\b/gi;

describe("C5: it teaches itself --- no instructions on screen", () => {
  it("puts no how-to-play language in any page's visible text", () => {
    // Read off the BUILT HTML's textContent, so it sees what a player sees
    // rather than what the source says.
    for (const { name, doc } of pages) {
      const visible = (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
      for (const hit of visible.matchAll(INSTRUCTION)) {
        expect.fail(
          `${name} says "${hit[0].trim()}" --- C5 forbids instructions ` +
            `anywhere, and the opening screen has to make the first move ` +
            `obvious on its own (World 1-1, not a controls legend). If you ` +
            `think this particular line is an invitation rather than an ` +
            `instruction, argue it and change how this rule is PHRASED --- ` +
            `don't loosen it to green. The pod decides the real version of ` +
            `this question, cold, in about ten seconds.`,
        );
      }
    }
  });

  it("puts no how-to-play language in the README either", () => {
    // "nothing in the README standing in for either" is in the spec by name.
    // The README is the obvious place the explanation goes when the page can't
    // have it, and it is off the deployed site, so nothing else here can see
    // it.
    const readme = readFileSync(resolve("README.md"), "utf8");
    const hits = [...readme.matchAll(INSTRUCTION)].map((hit) =>
      hit[0].trim(),
    );
    expect(
      hits,
      `README.md explains how to play (${hits.join(", ")}). The spec rules ` +
        `the README out by name: it cannot stand in for the modal or the ` +
        `instructions page. Name the game there if you like; don't teach it.`,
    ).toEqual([]);
  });
});

describe("C5: the opening screen does not wait for JavaScript", () => {
  it("serves the thing the player acts on in the HTML, not from a script", () => {
    // C5 forbids explaining the first move in words, so the opening screen gets
    // exactly one chance to make it obvious. A screen that renders blank until
    // a bundle arrives has spent that chance on the visitor who most needed it
    // --- and unlike a page with an instruction line, it has no fallback.
    //
    // The rules and the motion may depend on JavaScript; that is the brief.
    // What must be in the served HTML is the invitation.
    const home = pages.find(({ name }) => name === "index.html");
    expect(home, "no index.html in dist/").toBeTruthy();

    const control = home!.doc.querySelector("[data-core-interaction]");
    expect(
      control,
      `nothing in the served index.html carries data-core-interaction, so ` +
        `the opening screen is script-written or not there yet. Mark what the ` +
        `player acts on --- check:render and spec/sensors.test.ts both need ` +
        `it, and a stranger needs it most of all.`,
    ).toBeTruthy();
  });
});

describe("C5: it can be lost, and play ends somewhere", () => {
  it("exposes the game state check:play has to read", () => {
    // "a wrong move is possible, and play ends somewhere --- a win, a loss or
    // a finish". None of that is in the DOM at rest: a game that can never be
    // lost throws nothing, renders fine, and passes every other check in this
    // repo. It is opaque in exactly the way a canvas and an AudioContext were.
    //
    // So the page cooperates, the same bargain probeCanvasInk strikes: it
    // exposes window.__gameProbe() returning { over, outcome, moves }, and
    // check:play drives the game until it ends and asserts what came out. This
    // test only holds the near end of that contract --- that the hook is wired
    // at all --- because the far end needs a browser and this suite has none.
    expect(
      /__gameProbe/.test(shippedScript),
      `nothing in the shipped JavaScript defines window.__gameProbe, so ` +
        `pnpm check:play cannot tell whether this game can be lost or whether ` +
        `play ever ends --- the two lines of the spec no DOM sensor can ` +
        `reach. Expose { over, outcome, moves }. (Searched every bundled ` +
        `module and inline script in dist/.)`,
    ).toBe(true);
  });
});

describe("C5: deployed and live at its public Pages URL", () => {
  // The live half is preflight's and ship's job --- it cannot be true before
  // the repo is public. The base-path half is a travelling sensor and lives in
  // spec/sensors.test.ts. What is left here is the local half of "live".
  it("emits a home page", () => {
    expect(
      shipped.includes("index.html"),
      `dist/index.html is missing, so the Pages URL has nothing to serve.`,
    ).toBe(true);
  });
});

describe("C5: the repo shows the process", () => {
  // pnpm check:evidence is the real gate and runs in CI. These two are here so
  // the reflection's absence is visible in the fast loop all week, instead of
  // at the cutoff.
  it("has this deliverable's reflection, with something in it", () => {
    const path = resolve("reflections/crit-5.md");
    let body = "";
    try {
      body = readFileSync(path, "utf8");
    } catch {
      /* absent, asserted below */
    }
    expect(
      body.trim().length,
      `reflections/crit-5.md is missing or empty. It is due at the cutoff, ` +
        `and without it the week does not count as shipped however good the ` +
        `prototype is. The filename is checked exactly against the course ` +
        `API --- last week's crit-4.md cannot stand in for it.`,
    ).toBeGreaterThan(200);
  });

  it("has a PROCESS.md that is no longer the template", () => {
    const body = readFileSync(resolve("PROCESS.md"), "utf8");
    expect(
      body.includes("<!-- TEMPLATE:"),
      `PROCESS.md still carries the template comment, so it has not been ` +
        `written yet. One of its entries has to be the change that came from ` +
        `PLAYING the finished game rather than reading its code --- that is a ` +
        `spec line, and this is the only place it can be shown.`,
    ).toBe(false);
  });
});
