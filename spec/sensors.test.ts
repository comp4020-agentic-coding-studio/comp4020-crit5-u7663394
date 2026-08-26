import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Sensors --- standards held to the agent whatever the week's brief is.
//
// spec/README.md draws the line these live on: a *contract test* answers this
// week's published spec and retires with it; a *sensor* is harness, the same as
// a rule in CLAUDE.md, and comes with me into next week's repo.
//
// Both of the checks below spent C4 inside spec/crit-4.test.ts, which was the
// wrong file for them: neither is about an instrument, and both would have been
// left behind with the piano. Nothing here names a brief, and nothing here
// names Astro --- the deploy base is read from the config rather than written
// down a second time.

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
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

/** The deploy base, read from the config rather than written down twice. */
const BASE = (
  readFileSync(resolve("astro.config.ts"), "utf8").match(
    /base:\s*["'`]([^"'`]*)["'`]/,
  )?.[1] ?? ""
).replace(/\/$/, "");

describe("sensor: internal URLs survive the deploy base", () => {
  it("writes no internal URL that breaks under the deploy base", () => {
    // Root-absolute links once put 13 broken links in front of CI. This is the
    // failure that looks perfect locally and 404s on the live URL, which is the
    // artefact that gets marked.
    //
    // Phrased as "a root-absolute URL is an error UNLESS it carries the base",
    // not "no root-absolute URLs" --- the strict version went red on Astro's
    // own emitted stylesheet, which already carries the base and is correct. A
    // check that argues with the framework's correct output gets worked around
    // instead of read.
    expect(BASE, "no `base` found in astro.config.ts").toBeTruthy();

    const offenders: string[] = [];
    for (const { name, doc } of pages) {
      for (const el of doc.querySelectorAll("[href], [src]")) {
        const url = el.getAttribute("href") ?? el.getAttribute("src") ?? "";
        if (!url.startsWith("/")) continue; // relative, protocol, hash, mailto
        if (url.startsWith(`${BASE}/`)) continue; // carries the base: correct
        offenders.push(`${name}: ${url}`);
      }
    }
    expect(
      offenders,
      `the site deploys under ${BASE}/, so a root-absolute URL is an error ` +
        `unless it carries that base. Author internal links relative, or ` +
        `prefix import.meta.env.BASE_URL:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});

describe("sensor: the marked control is a real control", () => {
  it("builds every marked control as a real interactive element", () => {
    // A real element gets mouse, keyboard and touch from the browser; a div
    // with a click handler gets one, and fails on the marker's first Tab press.
    // check:render asserts the behaviour (Tab reaches it, operating it changes
    // [data-core-output]); this asserts the structure, in milliseconds.
    const NATIVE = new Set([
      "button",
      "input",
      "select",
      "textarea",
      "details",
      "summary",
    ]);

    let marked = 0;
    for (const { name, doc } of pages) {
      for (const el of doc.querySelectorAll("[data-core-interaction]")) {
        marked += 1;
        const tag = el.tagName.toLowerCase();
        const native =
          NATIVE.has(tag) || (tag === "a" && el.hasAttribute("href"));
        expect(
          native,
          `${name}: <${tag} data-core-interaction> is not natively ` +
            `interactive, so it is mouse-only until you write the keyboard ` +
            `and touch paths by hand. Use a real control.`,
        ).toBe(true);

        const accessibleName =
          el.getAttribute("aria-label")?.trim() ||
          el.textContent?.trim() ||
          (el.getAttribute("id") &&
            doc
              .querySelector(`label[for="${el.getAttribute("id")}"]`)
              ?.textContent?.trim());
        expect(
          accessibleName,
          `${name}: <${tag} data-core-interaction> has no accessible name.`,
        ).toBeTruthy();
      }
    }

    expect(
      marked,
      `nothing in the built site carries data-core-interaction. Mark the ` +
        `control the player acts on --- check:render needs it too.`,
    ).toBeGreaterThan(0);
  });
});
