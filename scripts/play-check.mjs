// Play the game, in Chrome, the way a stranger does, and check what came out.
//
//   node scripts/play-check.mjs
//
// check:render asks whether the page *renders*. This asks whether it plays.
// C5's spec turns on two claims that no DOM sensor can reach:
//
//   - "it can be lost: a wrong move is possible, and play ends somewhere"
//   - "one rule of the game has a focused automated test"
//
// Neither is visible in the DOM at rest, and both are ways a game can be broken
// while looking perfect in a screenshot: a game with no losing move is a toy,
// and a game that never ends is a screensaver. Last week the artefact that every
// probe was blind to was sound; this week it is game state, and the hole is the
// same shape. So is the fix.
//
// Carried forward from comp4020-crit4-u7663394, frame only. The instrument's
// twenty assertions -- held mouse, glissando drag, three fingers, pedal, blur
// mid-note, octave clamps -- went with the piano they were about. What stays is
// everything that was expensive and is not about a piano: the trusted-input
// dispatchers, the preview-daemon lifecycle in cdp.mjs, the tally, and the two
// rules below.
//
// Every event here is dispatched over the DevTools Protocol, so it is trusted.
// That is not a detail: an in-page `dispatchEvent` has isTrusted false and the
// browser performs no default action for it. A version of this file built on
// synthetic events would report a dead game about a page that plays perfectly by
// hand.
//
// Two of C4's checks were red the first time they ran and both times the bug was
// in this file, not in the page: a count taken while the previous state was
// still settling, and an expectation that CDP's touchEnd lists the points that
// remain rather than the ones that ended. Reproduce a red check by hand before
// changing the page.

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

const CDP_PORT = 9334;
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT ?? 4987);
const ORIGIN = `http://localhost:${PREVIEW_PORT}`;

/** Long enough for a move to resolve and any animation to settle. */
const SETTLE = 600;

/** How many moves the random-flailing pass makes before giving up on an end. */
const FLAIL_MOVES = 400;

const BASE = await readBase();
const URL_UNDER_TEST = `${ORIGIN}${BASE}/`;

const results = [];
const pageErrors = [];

function check(name, pass, detail = "") {
  results.push(pass);
  console.log(
    `  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`,
  );
}

await stopPreview();
const preview = startPreview(PREVIEW_PORT);
let chrome;

try {
  await waitForServer(URL_UNDER_TEST);
  chrome = launchChrome(CDP_PORT);
  const client = connect(await debuggerUrl(CDP_PORT));
  await client.ready;
  const session = await openPage(client, (error) => pageErrors.push(error));

  const send = (method, params) => client.send(method, params, session);
  const evaluate = async (expression) => {
    const { result } = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.value;
  };
  const json = async (expression) => JSON.parse(await evaluate(expression));

  const rectOf = (selector) =>
    json(
      `JSON.stringify(document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect())`,
    );

  const key = (type, text, code, vk) =>
    send("Input.dispatchKeyEvent", {
      type,
      key: text,
      code,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
      ...(type === "keyDown" ? { text } : {}),
    });
  const tap = async (text, code, vk) => {
    await key("keyDown", text, code, vk);
    await sleep(30);
    await key("keyUp", text, code, vk);
  };
  // No mouse dispatcher here on purpose: the desktop pass drives by keyboard
  // and the phone pass by touch, so one would be dead code and oxlint
  // --deny-warnings is right to say so. If C5's game turns out to be
  // mouse-driven, lift `mouse` back out of comp4020-crit4-u7663394's
  // play-check.mjs rather than writing it again -- the buttons/buttons-mask
  // pairing is easy to get subtly wrong.
  const touch = (type, touchPoints) =>
    send("Input.dispatchTouchEvent", { type, touchPoints });

  const reload = async (width, height, mobile) => {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await send("Page.navigate", { url: URL_UNDER_TEST });
    await sleep(1000);
  };

  /**
   * Ask the page what it binds. Nothing below names a letter of the computer
   * keyboard: C4's version of this file used to say "a", "d", "g", and when the
   * keyboard was relaid every one of those became a different note or no note
   * at all. The tests would have gone red about the page instead of about
   * themselves. A game rebound from WASD to the arrows breaks a hardcoded table
   * exactly the same way.
   */
  const NAMED = {
    Space: [" ", 32],
    Enter: ["Enter", 13],
    ArrowLeft: ["ArrowLeft", 37],
    ArrowUp: ["ArrowUp", 38],
    ArrowRight: ["ArrowRight", 39],
    ArrowDown: ["ArrowDown", 40],
    Escape: ["Escape", 27],
  };
  const press = (code) => {
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter) return [letter[1].toLowerCase(), code, letter[1].charCodeAt(0)];
    const digit = /^Digit([0-9])$/.exec(code);
    if (digit) return [digit[1], code, 48 + Number(digit[1])];
    const named = NAMED[code];
    if (named) return [named[0], code, named[1]];
    throw new Error(`don't know how to press ${code}`);
  };

  await reload(1200, 900, false);

  /**
   * The bargain with the page, and the whole reason this file can see anything.
   *
   * probeCanvasInk strikes it with the canvas ("there is a picture here",
   * without knowing what the picture is) and C4's probeAudio struck it with an
   * AnalyserNode. This is the same trade for game state: the page exposes
   * `window.__gameProbe()` returning at least
   *
   *   { over: boolean, outcome: "playing" | "won" | "lost" | "finished",
   *     moves: number }
   *
   * and this file reads it. The sensor cannot judge whether the game is any
   * *good*, or whether a stranger works out the first move -- the pod settles
   * both, cold, in about ten seconds. It can only tell you whether the rules
   * the spec fixes are actually there.
   *
   * If the hook is missing this file fails rather than skipping. C4's audio
   * probe skipped when `__pianoProbe` was absent, which was right when sound
   * was optional and is wrong now: "it can be lost" is a fixed line of C5's
   * spec, so a page that cannot answer the question has not met it. A sensor
   * that goes quiet on the artefact it was built for is a decoration.
   */
  const hook = await evaluate(`JSON.stringify(typeof window.__gameProbe)`);
  const probe = () => json(`JSON.stringify(window.__gameProbe())`);

  console.log("\nthe page can be asked about its own state");
  check(
    "window.__gameProbe() is exposed",
    hook === '"function"',
    hook === '"function"'
      ? ""
      : "no probe: nothing below can see whether this game can be lost",
  );

  if (hook === '"function"') {
    const opening = await probe();

    console.log("\nit opens ready to play");
    check(
      "play has not already ended before anyone touches it",
      opening.over === false && opening.outcome === "playing",
      JSON.stringify(opening),
    );

    // "it can be lost: a wrong move is possible, and play ends somewhere."
    //
    // Deliberately random rather than a scripted losing line. A scripted one
    // tests that the move you had in mind still loses; flailing tests that the
    // game ends *at all* under hands that do not know what they are doing,
    // which is the claim the spec actually makes and the way the pod will
    // play it. Wire the specific rule -- the collision, the illegal move, the
    // last card -- as a focused assertion in spec/*.test.ts, where it runs in
    // milliseconds and does not need Chrome.
    console.log("\nit can be lost");
    const bound = await json(
      `JSON.stringify([...new Set([...document.querySelectorAll("[data-code]")].map((el) => el.dataset.code))])`,
    );
    check(
      "the page declares which keys it binds",
      bound.length > 0,
      bound.length ? bound.join(" ") : "no [data-code] anywhere",
    );

    let state = opening;
    let moves = 0;
    if (bound.length > 0) {
      const keys = bound.map(press);
      for (; moves < FLAIL_MOVES && !state.over; moves += 1) {
        await tap(...keys[moves % keys.length]);
        await sleep(40);
        state = await probe();
      }
    }
    check(
      "play ends somewhere under a stranger's hands",
      state.over === true,
      state.over
        ? `${state.outcome} after ${moves} moves`
        : `still playing after ${FLAIL_MOVES} moves`,
    );
    check(
      "and it ends in a named outcome, not merely stopped",
      ["won", "lost", "finished"].includes(state.outcome),
      String(state.outcome),
    );

    // A game that ends and cannot be restarted is a game the pod plays once.
    // Not a spec line -- a rule the artefact band earns, the same way "holds up
    // under use it wasn't designed for" earned the Tab check in check:render.
    console.log("\nand it can be played again");
    await reload(1200, 900, false);
    const second = await probe();
    check(
      "a reload returns it to a playable opening",
      second.over === false && second.outcome === "playing",
      JSON.stringify(second),
    );

    // Both marking viewports count in full, and a game is the kind of artefact
    // that quietly becomes unplayable on a phone: a keyboard-only control
    // scheme has no keyboard there. Whether touch drives it is the pod's to
    // feel; whether the page responds to a touch at all is measurable.
    console.log("\nthe phone can play it too");
    await reload(390, 844, true);
    const before = await probe();
    const stage =
      (await json(
        `JSON.stringify(!!document.querySelector("[data-core-interaction]"))`,
      )) === true
        ? await rectOf("[data-core-interaction]")
        : await rectOf("body");
    const point = {
      x: Math.round(stage.x + stage.width / 2),
      y: Math.round(stage.y + stage.height / 2),
    };
    await touch("touchStart", [point]);
    await sleep(80);
    await touch("touchEnd", []);
    await sleep(SETTLE);
    const after = await probe();
    check(
      "a tap on the phone changes the game state",
      JSON.stringify(after) !== JSON.stringify(before),
      `${JSON.stringify(before)} -> ${JSON.stringify(after)}`,
    );
  }

  client.close();
} finally {
  chrome?.kill();
  preview.kill();
  await stopPreview();
}

for (const error of pageErrors) {
  console.log(`  FAIL uncaught: ${error.split("\n")[0]}`);
  results.push(false);
}

const failed = results.filter((pass) => !pass).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
if (failed > 0) process.exit(1);
