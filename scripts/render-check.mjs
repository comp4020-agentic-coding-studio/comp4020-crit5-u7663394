// Render the built site in real Chrome and report what it actually does.
//
// `pnpm check` proves the HTML is well-formed; it cannot see a layout that
// overflows its viewport, and JSDOM has no layout engine at all. This drives
// Chrome over the DevTools Protocol so the two marked viewports -- 1920x1080
// and 390x844 -- are measured rather than assumed.
//
//   node scripts/render-check.mjs [--shots <dir>]
//
// Exits non-zero if any page overflows its viewport horizontally, loses its
// single h1, throws an uncaught exception, leaves [data-reveal] content
// transparent at the bottom of the page, hides a marked control from Tab, or
// overflows after a resize taken mid-interaction.
//
// Carried forward from comp4020-ass1, generic core only: the range-walking
// screenshot loop and the inspection-camera pass went with the explainer they
// were built for. What stays is everything that is true of any prototype.
//
// Three things are derived rather than hardcoded, because each was pinned to
// one repo at some point and each failed quietly when it moved:
//   - the base path, read from astro.config.ts (the actual source of truth)
//   - the page list, discovered from dist/ so a new page is checked for free
//   - the preview server, started and stopped by this script rather than
//     assumed to be already running
// The viewport widths stay hardcoded on purpose: a threshold derived from the
// thing it measures cannot fail, which is the bug that has cost the most.
//
// UNWIRED THIS WEEK: probeAudio. It read window.__pianoProbe off an
// AnalyserNode on the instrument's master bus, and neither the hook nor the
// piano DOM it pressed exists in a game. The *pattern* is what carries -- if a
// sensor suite cannot see the main artefact, it is not measuring the artefact
// -- and C5's opaque artefact is not sound but game state: whether a wrong move
// is possible and whether play ends. That lives in a canvas or a JS object, and
// every probe in this file is as blind to it as they all were to an
// AudioContext. Filling that hole is check:play's job this week; see the note
// there. If C5's game does make sound, restore probeAudio from
// comp4020-crit4-u7663394 rather than rewriting it -- the trusted-gesture
// requirement and the reverb-tail timing were both paid for once already.

import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// The CDP client, the Chrome launch and the preview-daemon lifecycle live in
// one place now, shared with check:play. See scripts/cdp.mjs for why.
import {
  connect,
  debuggerUrl,
  launchChrome,
  openPage,
  readBase,
  sleep,
  startPreview,
  stopPreview,
  waitForServer,
} from "./cdp.mjs";

const CDP_PORT = 9333;
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT ?? 4988);
const ORIGIN = `http://localhost:${PREVIEW_PORT}`;

const VIEWPORTS = [
  { name: "desktop", width: 1920, height: 1080, mobile: false },
  { name: "phone", width: 390, height: 844, mobile: true },
];

const shotsIndex = process.argv.indexOf("--shots");
const shotsDir = shotsIndex === -1 ? null : process.argv[shotsIndex + 1];

/** Every built HTML page, as the URL path the preview server serves it at. */
async function discoverPages(dir = "dist", prefix = "") {
  const pages = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      pages.push(...(await discoverPages(full, `${prefix}${entry.name}/`)));
    } else if (entry.name.endsWith(".html")) {
      const isIndex = entry.name === "index.html";
      pages.push({
        path: `/${prefix}${isIndex ? "" : entry.name}`,
        name:
          (prefix + entry.name.replace(/\.html$/, "")).replace(/\/$/, "") ||
          "index",
      });
    }
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}

/* Runs inside the page. Reports the horizontal overflow and names the
   widest offenders, because "something overflows" is not actionable.
   Compares against the width we asked the browser to emulate, not
   window.innerWidth: a grid track with a min larger than the screen widens
   the layout viewport too, so measuring against innerWidth reported an
   overflow of zero on a page that was 46px too wide for the phone. */
const probeSource = (emulatedWidth) => `(() => {
  const docWidth = document.documentElement.scrollWidth;
  const viewport = ${emulatedWidth};
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const right = rect.right + window.scrollX;
    if (right <= viewport + 1) continue;
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\\s+/).join(".")
      : "";
    offenders.push({
      selector: el.tagName.toLowerCase() + id + cls,
      right: Math.round(right),
      width: Math.round(rect.width),
    });
  }
  offenders.sort((a, b) => b.right - a.right);
  return JSON.stringify({
    docWidth,
    viewport,
    overflow: Math.max(0, docWidth - viewport),
    height: document.documentElement.scrollHeight,
    title: document.title,
    h1: document.querySelectorAll("h1").length,
    offenders: offenders.slice(0, 8),
  });
})()`;

/* The keys go through Input.dispatchKeyEvent, NOT an in-page
   `dispatchEvent(new KeyboardEvent(...))`. Synthetic events have
   isTrusted: false, so the browser performs no default action: a perfectly
   good <button> is never activated by Enter and the check reported NO CHANGE on
   a control that worked fine by hand. That false negative would have argued for
   adding a keydown handler to a button that never needed one. CDP-injected keys
   are trusted, so native activation and native range-stepping both just work.

   This matters more this week than it ever has. Web Audio will not leave the
   suspended state without a *trusted* user gesture, so an untrusted event
   cannot make this page sound at all -- a probe built on one would report a
   silent instrument and be believed.

   Operated by keyboard rather than by .click() on purpose -- the marker tabs
   through it, and a mouse-only control passes a click test while still failing
   the artefact band. */
const KEYS = [
  { key: "Enter", code: "Enter", vk: 13, text: "\r" },
  { key: " ", code: "Space", vk: 32, text: " " },
  { key: "ArrowRight", code: "ArrowRight", vk: 39 },
  { key: "ArrowUp", code: "ArrowUp", vk: 38 },
];

const readOutput = `(() => {
  const control = document.querySelector("[data-core-interaction]");
  const output = document.querySelector("[data-core-output]");
  if (!control || !output) return JSON.stringify({ present: false });
  return JSON.stringify({
    present: true,
    focused: document.activeElement === control || control.contains(document.activeElement),
    state: output.innerHTML + "|" + output.textContent.trim()
      + "|" + JSON.stringify(getComputedStyle(output).transform),
  });
})()`;

async function evaluate(client, sessionId, expression) {
  const { result } = await client.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  return JSON.parse(result.value);
}

async function pressKey(client, sessionId, key, code, vk) {
  for (const type of ["rawKeyDown", "keyUp"]) {
    await client.send(
      "Input.dispatchKeyEvent",
      {
        type,
        key,
        code,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
      },
      sessionId,
    );
  }
}

async function probeInteraction(client, sessionId) {
  await evaluate(
    client,
    sessionId,
    `(() => { document.querySelector("[data-core-interaction]")?.focus(); return "null"; })()`,
  );
  const before = await evaluate(client, sessionId, readOutput);
  if (!before.present) return { present: false };

  for (const { key, code, vk, text } of KEYS) {
    await client.send(
      "Input.dispatchKeyEvent",
      {
        type: text ? "keyDown" : "rawKeyDown",
        key,
        code,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
        ...(text ? { text } : {}),
      },
      sessionId,
    );
    await client.send(
      "Input.dispatchKeyEvent",
      {
        type: "keyUp",
        key,
        code,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
      },
      sessionId,
    );
    await sleep(150);
  }
  await sleep(600);

  const after = await evaluate(client, sessionId, readOutput);
  return {
    present: true,
    focused: before.focused,
    changed: before.state !== after.state,
  };
}

/**
 * Can every marked control be reached by Tab alone, starting from the top of
 * the document? A control that only a mouse can get to passes every other check
 * in this file.
 */
async function probeKeyboardReach(client, sessionId) {
  const total = Number(
    await evaluate(
      client,
      sessionId,
      `(() => {
        document.querySelectorAll("[data-core-interaction]").forEach((el, i) => {
          el.dataset.reachIndex = String(i);
        });
        document.body.focus();
        window.scrollTo(0, 0);
        return String(document.querySelectorAll("[data-core-interaction]").length);
      })()`,
    ),
  );
  if (total === 0) return { total: 0, reached: 0 };

  const seen = new Set();
  for (let press = 0; press < 40 && seen.size < total; press += 1) {
    await pressKey(client, sessionId, "Tab", "Tab", 9);
    const index = await evaluate(
      client,
      sessionId,
      `JSON.stringify(document.activeElement?.dataset?.reachIndex ?? null)`,
    );
    if (index !== null) seen.add(index);
  }
  return { total, reached: seen.size };
}

/**
 * Turn a `KeyboardEvent.code` into the fields a trusted CDP key event needs.
 *
 * Which keys drive the page is discovered from the built page, not written
 * down here: this file used to name KeyA, and the day the keyboard was relaid
 * onto the standard two-octave layout that became a key bound to nothing. The
 * probe would have reported a dead page -- correctly, about the key it pressed,
 * and uselessly, about the page. An inventory read from the artefact is fine; a
 * constant copied out of the artefact goes stale in silence. That rule outlives
 * the piano: a game rebound from WASD to the arrows breaks a written-down table
 * exactly the same way.
 */
function keyEvent(code) {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) {
    return {
      key: letter[1].toLowerCase(),
      code,
      vk: letter[1].charCodeAt(0),
    };
  }
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return { key: digit[1], code, vk: 48 + Number(digit[1]) };
  const named = NAMED_KEYS[code];
  if (named) return { code, ...named };
  throw new Error(`don't know how to press ${code}`);
}

/* The non-printing keys a game is likely to bind. Digits and letters are
   derived above; these cannot be, so they are a table -- but a table of what
   the *keyboard* is, which does not go stale, rather than of what the page
   binds, which does. */
const NAMED_KEYS = {
  Space: { key: " ", vk: 32, text: " " },
  Enter: { key: "Enter", vk: 13, text: "\r" },
  ArrowLeft: { key: "ArrowLeft", vk: 37 },
  ArrowUp: { key: "ArrowUp", vk: 38 },
  ArrowRight: { key: "ArrowRight", vk: 39 },
  ArrowDown: { key: "ArrowDown", vk: 40 },
  Escape: { key: "Escape", vk: 27 },
};

/**
 * Every key the built page declares it responds to, in document order.
 *
 * The piano marked its keys `[data-note][data-code][data-kind="white"]`; the
 * selector is just `[data-code]` now, because the convention that carries is
 * "the page writes down its own bindings and the sensor reads them", not the
 * piano's particular attributes. A game that binds the arrows marks them the
 * same way and this keeps working.
 */
async function declaredKeys(client, sessionId) {
  const found = await evaluate(
    client,
    sessionId,
    `JSON.stringify([...document.querySelectorAll("[data-code]")]
       .map((el) => el.dataset.code))`,
  );
  return [...new Set(found)].map(keyEvent);
}

/**
 * Is the drawing drawing anything?
 *
 * Added after a layout change squeezed a canvas off the side of the phone
 * screen and left the stage blank. Every other check stayed green: the markup
 * was right, the interaction reported a change, nothing overflowed, no
 * exception was thrown. A canvas is opaque to all of them, and I only found it
 * because I opened the screenshots. So: sample the pixels and report the
 * fraction that differ from the corner, which is what "there is a picture here"
 * means without knowing what the picture is.
 *
 * If a sensor suite cannot see the main artefact, it is not measuring the
 * artefact. This week the main artefact is a game, and this probe can see that
 * something is drawn but not whether it can be lost. That is check:play's hole
 * to fill, not this one's.
 */
async function probeCanvasInk(client, sessionId) {
  return evaluate(
    client,
    sessionId,
    `(() => {
      const canvases = [...document.querySelectorAll("[data-core-output] canvas")];
      if (canvases.length === 0) return JSON.stringify({ present: false, ink: 1 });
      let lit = 0;
      let total = 0;
      for (const canvas of canvases) {
        if (canvas.width === 0) continue;
        const width = canvas.width;
        const height = canvas.height;
        // Copy the browser's composited canvas into a throwaway 2D surface.
        // Direct readPixels() proved driver-dependent under software WebGL:
        // SwiftShader returned an empty back buffer on the wide viewport even
        // though the same frame was visibly present in Page.captureScreenshot.
        const sample = document.createElement("canvas");
        sample.width = width;
        sample.height = height;
        const context = sample.getContext("2d");
        if (!context) continue;
        context.drawImage(canvas, 0, 0);
        const data = context.getImageData(0, 0, width, height).data;
        const at = (x, y) => (y * width + x) * 4;
        const base = at(0, 0);
        // Sample every pixel: a stride can step over a sparse picture entirely
        // and call a visible canvas blank.
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const i = at(x, y);
            total += 1;
            const far =
              Math.abs(data[i] - data[base]) +
              Math.abs(data[i + 1] - data[base + 1]) +
              Math.abs(data[i + 2] - data[base + 2]) +
              Math.abs(data[i + 3] - data[base + 3]);
            if (far > 24) lit += 1;
          }
        }
      }
      return JSON.stringify({
        present: true,
        pixels: lit,
        ink: total === 0 ? 0 : Math.round((lit / total) * 10000) / 10000,
      });
    })()`,
  );
}

/**
 * Resize while the interaction is still in flight, then check the page again.
 * A layout that only reflows correctly from a standing start is exactly the
 * failure the marker's "resize mid-use" is looking for.
 */
async function probeResizeMidUse(client, sessionId, viewport) {
  const narrow = Math.round(viewport.width * 0.55);
  await evaluate(
    client,
    sessionId,
    `(() => { document.querySelector("[data-core-interaction]")?.focus(); return "0"; })()`,
  );
  await pressKey(client, sessionId, "ArrowRight", "ArrowRight", 39);
  await sleep(60); // mid-interaction on purpose

  await client.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: narrow,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    },
    sessionId,
  );
  await sleep(900);

  const probe = await evaluate(client, sessionId, probeSource(narrow));
  await client.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.mobile,
    },
    sessionId,
  );
  await sleep(400);
  return { width: narrow, overflow: probe.overflow, offenders: probe.offenders };
}

const BASE = await readBase();
const PAGES = await discoverPages();

if (PAGES.length === 0) {
  console.error("no built pages found in dist/ — run `pnpm build` first");
  process.exit(1);
}

console.log(`base ${BASE}  pages ${PAGES.length}  preview :${PREVIEW_PORT}`);

// A leftover daemon would silently win the port and serve someone else's build.
await stopPreview();

const preview = startPreview(PREVIEW_PORT);

let chrome;
let failures = 0;
let pageErrors = [];
let interactionPages = 0;
let interactionWorking = 0;

try {
  await waitForServer(`${ORIGIN}${BASE}/`);

  chrome = launchChrome(CDP_PORT);

  const client = connect(await debuggerUrl(CDP_PORT));
  await client.ready;

  // An uncaught exception leaves a page that looks fine in a screenshot and is
  // dead to the visitor. Nothing here was listening for one.
  const sessionId = await openPage(client, (error) => pageErrors.push(error));

  if (shotsDir) await mkdir(shotsDir, { recursive: true });

  for (const viewport of VIEWPORTS) {
    console.log(`\n${viewport.name}  ${viewport.width}x${viewport.height}`);
    for (const page of PAGES) {
      await client.send(
        "Emulation.setDeviceMetricsOverride",
        {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: viewport.mobile,
        },
        sessionId,
      );

      const url = `${ORIGIN}${BASE}${page.path}`;
      pageErrors = [];
      await client.send("Page.navigate", { url }, sessionId);
      await sleep(700);

      // Walk the page down in fast steps and stop at the bottom. Measuring
      // here rather than after scrolling back up is the point: at the bottom
      // every reveal should have fired, so anything still hidden is content a
      // reader would never see.
      await client.send(
        "Runtime.evaluate",
        {
          expression: `(async () => {
            const step = window.innerHeight * 0.8;
            for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 40));
            }
            await new Promise((r) => setTimeout(r, 250));
          })()`,
          awaitPromise: true,
        },
        sessionId,
      );

      const { result } = await client.send(
        "Runtime.evaluate",
        { expression: probeSource(viewport.width), returnByValue: true },
        sessionId,
      );
      const probe = JSON.parse(result.value);

      // Measured at the bottom of the page, after a deliberately fast scroll:
      // anything still transparent here is content a reader could scroll
      // straight past and never see. Checks computed opacity rather than a
      // class, so it holds however the reveal is implemented.
      const { result: hidden } = await client.send(
        "Runtime.evaluate",
        {
          expression: `[...document.querySelectorAll("[data-reveal]")].filter((el) => {
            const rect = el.getBoundingClientRect();
            const onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
            return onScreen && Number(getComputedStyle(el).opacity) < 0.9;
          }).length`,
          returnByValue: true,
        },
        sessionId,
      );

      // Read before the interaction probe, so the inventory is taken of a page
      // nobody has touched yet.
      const bound = await declaredKeys(client, sessionId);
      const core = await probeInteraction(client, sessionId);
      const reach = await probeKeyboardReach(client, sessionId);
      const ink = await probeCanvasInk(client, sessionId);
      const resized = core.present
        ? await probeResizeMidUse(client, sessionId, viewport)
        : { width: viewport.width, overflow: 0, offenders: [] };

      // A page without the marked control isn't a failure -- a site may have an
      // about page. A *site* without one is, so that's asserted once at the end
      // rather than per page.
      if (core.present) {
        interactionPages += 1;
        if (core.focused && core.changed) interactionWorking += 1;
      }
      const ok =
        probe.overflow === 0 &&
        probe.h1 === 1 &&
        hidden.value === 0 &&
        (!core.present || (core.focused && core.changed)) &&
        reach.reached === reach.total &&
        resized.overflow === 0 &&
        pageErrors.length === 0 &&
        (!ink.present || ink.pixels >= 3);
      if (!ok) failures += 1;
      const coreStatus = !core.present
        ? "n/a"
        : !core.focused
          ? "not focusable"
          : core.changed
            ? "changes"
            : "NO CHANGE";
      console.log(
        `  ${ok ? "ok  " : "FAIL"} ${page.name.padEnd(11)} ` +
          `doc ${String(probe.docWidth).padStart(5)}px  ` +
          `overflow ${String(probe.overflow).padStart(4)}px  ` +
          `h1 ${probe.h1}  unrevealed ${hidden.value}  ` +
          `interaction ${coreStatus.padEnd(13)} ` +
          `tab ${reach.reached}/${reach.total}  ` +
          `ink ${ink.present ? `${(ink.ink * 100).toFixed(1)}%/${ink.pixels}px` : "n/a"}  ` +
          `keys ${bound.length || "n/a"}  ` +
          `resized@${resized.width} overflow ${resized.overflow}px  ` +
          `height ${probe.height}px`,
      );
      for (const error of pageErrors) {
        console.log(`         uncaught: ${error.split("\n")[0]}`);
      }
      if (ink.present && ink.pixels < 3) {
        console.log(
          "         the canvas is blank — the drawing is not reaching the screen",
        );
      }
      if (reach.reached !== reach.total) {
        console.log(
          `         ${reach.total - reach.reached} marked control(s) never got focus from Tab`,
        );
      }
      for (const offender of resized.overflow > 0 ? resized.offenders : []) {
        console.log(
          `         overflows to ${offender.right}px after a mid-use resize: ${offender.selector}`,
        );
      }
      // Only when the document itself overflows. An element wider than the
      // viewport inside an `overflow: hidden` ancestor is a full-bleed
      // background doing its job, not a bug.
      if (probe.overflow > 0) {
        for (const offender of probe.offenders) {
          console.log(
            `         overflows to ${offender.right}px: ${offender.selector}`,
          );
        }
      }

      if (shotsDir) {
        // Emulating `prefers-reduced-motion: reduce` switches scroll-driven
        // animation off at the media query, giving an honest picture of the
        // layout — and exercising the reduced-motion path at the same time.
        await client.send(
          "Emulation.setEmulatedMedia",
          { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
          sessionId,
        );
        // Reload: the interaction probe above has already driven the control,
        // and a shot of wherever it happened to stop is not a state anyone
        // designed.
        await client.send("Page.navigate", { url }, sessionId);
        await sleep(600);
        await client.send(
          "Runtime.evaluate",
          {
            expression: `(async () => {
              window.scrollTo(0, 0);
              await new Promise((r) => setTimeout(r, 200));
            })()`,
            awaitPromise: true,
          },
          sessionId,
        );

        const { data } = await client.send(
          "Page.captureScreenshot",
          { format: "png", captureBeyondViewport: true },
          sessionId,
        );
        const stem = `${viewport.name}-${page.name.replace(/\//g, "-")}`;
        await writeFile(
          join(shotsDir, `${stem}.png`),
          Buffer.from(data, "base64"),
        );
        await client.send(
          "Emulation.setEmulatedMedia",
          { features: [] },
          sessionId,
        );

        // And a second shot taken mid-play.
        //
        // The settled shot above is deliberately the reduced-motion one, and
        // for a page whose whole point is what happens once you start playing,
        // that photographs the one state the work is not about. Every still
        // frame of a broken transition looks like a plausible drawing; an
        // untouched title screen looks like a plausible game. So: press
        // whatever the page says it binds, with trusted events, let it run,
        // and look.
        //
        // A game screenshot has a job the instrument's did not: C5 forbids
        // instructions anywhere, so the opening screen has to make the first
        // move obvious on its own. The settled shot *is* that screen. Look at
        // it and ask what a stranger would press -- and then remember the
        // screenshot cannot answer it, and four people's hands at the crit
        // can, in about ten seconds.
        //
        // Not deterministic, on purpose. It is a photograph to be looked at,
        // not a baseline to be diffed.
        await client.send("Page.navigate", { url }, sessionId);
        await sleep(700);
        // Whatever the page declares, not keys typed in here. Capped at three
        // so a page marking a dozen bindings does not turn a screenshot pass
        // into a minute-long input storm.
        const played = bound.slice(0, 3);
        for (const playKey of played) {
          await client.send(
            "Input.dispatchKeyEvent",
            {
              type: "keyDown",
              key: playKey.key,
              code: playKey.code,
              windowsVirtualKeyCode: playKey.vk,
              nativeVirtualKeyCode: playKey.vk,
              ...(playKey.text ? { text: playKey.text } : {}),
            },
            sessionId,
          );
          await sleep(120);
        }
        await sleep(1400);
        const playing = await client.send(
          "Page.captureScreenshot",
          { format: "png", captureBeyondViewport: false },
          sessionId,
        );
        await writeFile(
          join(shotsDir, `${stem}-playing.png`),
          Buffer.from(playing.data, "base64"),
        );
        for (const playKey of played) {
          await client.send(
            "Input.dispatchKeyEvent",
            {
              type: "keyUp",
              key: playKey.key,
              code: playKey.code,
              windowsVirtualKeyCode: playKey.vk,
              nativeVirtualKeyCode: playKey.vk,
            },
            sessionId,
          );
        }
      }
    }
  }

  client.close();
} finally {
  chrome?.kill();
  preview.kill();
  // kill() only reaches the CLI wrapper; the server it started is a daemon.
  await stopPreview();
}

// A claim about the site, not about any one page.
if (interactionWorking === 0) {
  failures += 1;
  console.error(
    interactionPages === 0
      ? "\nNo [data-core-interaction] anywhere in the built site. Mark the " +
          "control the player acts on and the region that changes as a result."
      : "\n[data-core-interaction] found, but operating it by keyboard changed " +
          "nothing in [data-core-output] on any page or viewport.",
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log(
  "\nAll pages fit both marked viewports and the core interaction responds.\n" +
    "Nothing here knows whether the game can be lost, whether play ends, or\n" +
    "whether a stranger works out the first move. The first two are\n" +
    "check:play's; the third is the pod's, cold.",
);
