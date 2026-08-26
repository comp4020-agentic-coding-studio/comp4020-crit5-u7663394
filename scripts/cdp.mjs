// Shared plumbing for the two Chrome-driven sensors, check:render and
// check:play.
//
// It exists because of what is in `waitForServer` and `stopPreview` below.
// Those two functions encode a day that was lost to a stale `astro preview`
// daemon, and a second copy of them in a second script is a second chance to
// lose it — the copy that does not get the fix is the one that reports
// success at the wrong server. Everything here is the part both scripts must
// agree on; everything specific to what a script measures stays in that
// script.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

export const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The base path Astro is actually configured with, not one we hope matches. */
export async function readBase() {
  const config = await readFile("astro.config.ts", "utf8");
  const match = config.match(/base:\s*["'`]([^"'`]*)["'`]/);
  if (!match) throw new Error("no `base` found in astro.config.ts");
  return match[1].replace(/\/$/, "");
}

/** Stop any preview daemon, ours or a leftover, so each run owns its server. */
export function stopPreview() {
  return new Promise((resolve) => {
    const stop = spawn("pnpm", ["exec", "astro", "preview", "stop"], {
      stdio: "ignore",
    });
    stop.on("exit", resolve);
    stop.on("error", resolve);
  });
}

export function startPreview(port) {
  return spawn("pnpm", ["exec", "astro", "preview", "--port", String(port)], {
    stdio: "ignore",
  });
}

/**
 * Wait for the preview server to answer, and prove it is serving the build we
 * just made.
 *
 * `astro preview` is a daemon. It survives `subprocess.kill()`, and a second
 * `astro preview` does not start -- it prints "already running" and exits 0.
 * So a script once spent a whole day measuring a server started ten hours
 * earlier, on whatever config it had then, and reporting success at it.
 *
 * Answering is not enough, so this compares the bytes: the page the server
 * hands back has to be the page in dist/. Check identity, not liveness.
 */
export async function waitForServer(url) {
  const built = await readFile("dist/index.html", "utf8");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const served = await response.text();
        if (served.trim() !== built.trim()) {
          throw new Error(
            `${url} is not serving this build.\n` +
              `A stale \`astro preview\` daemon is the usual cause; ` +
              `\`pnpm exec astro preview stop\` clears it.`,
          );
        }
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("not serving"))
        throw error;
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`preview server never answered at ${url}`);
}

export function launchChrome(port, extraArgs = []) {
  return spawn(
    CHROME,
    [
      "--headless=new",
      // Headless Chrome has no hardware GPU. If the prototype draws with WebGL,
      // ask ANGLE for its software implementation explicitly rather than
      // silently testing the fallback copy and calling that a render check.
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--hide-scrollbars",
      // Both sensors play real notes. The graph still runs and an AnalyserNode
      // still reads it; the laptop just doesn't have to listen to a piano
      // every time the checks run.
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=/tmp/cdp-profile-${port}`,
      "about:blank",
      ...extraArgs,
    ],
    { stdio: "ignore" },
  );
}

/** Ask the browser for its debugger websocket, retrying while it boots. */
export async function debuggerUrl(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      const info = await response.json();
      return info.webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Chrome did not expose a debugger port");
}

/** Minimal CDP client: send a command, resolve on the matching id. */
export function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    // Events carry a method and no id. Nothing was listening for these before,
    // so a script that threw on load reported a perfectly clean run.
    if (message.method) {
      for (const listener of listeners.get(message.method) ?? [])
        listener(message.params);
      return;
    }
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    ready,
    on(method, listener) {
      listeners.set(method, [...(listeners.get(method) ?? []), listener]);
    },
    send(method, params = {}, sessionId) {
      const id = (nextId += 1);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    close: () => socket.close(),
  };
}

/**
 * Open a page and return a session id, with Page and Runtime enabled and an
 * uncaught-exception listener already wired: a page that throws on load looks
 * perfect in a screenshot and is dead to the visitor.
 */
export async function openPage(client, onError) {
  const { targetId } = await client.send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await client.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);
  if (onError) {
    client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      onError(
        exceptionDetails?.exception?.description ??
          exceptionDetails?.text ??
          "unknown exception",
      );
    });
  }
  return sessionId;
}
