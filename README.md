# One Button Tower

A small browser game, built for COMP4020 crit 5. Deployed to GitHub Pages and
marked live in Chrome at 1920×1080 and 390×844.

The brief rules out explaining the game — on screen, in a modal, on a page of
its own, or here standing in for any of those. So this file is about the repo,
not about the game. The game is at the deployed URL, and it says everything it
has to say by moving.

## What's where

| path                       | what it is                                            |
| -------------------------- | ----------------------------------------------------- |
| `src/scripts/rules.ts`     | the rules, as pure functions over plain data          |
| `src/scripts/render.ts`    | the 2:1 isometric drawing                             |
| `src/scripts/themes.ts`    | six palettes, one picked per round                    |
| `src/scripts/audio.ts`     | a small synth; no audio files to host                 |
| `src/scripts/main.ts`      | the loop, the input, and `window.__gameProbe()`       |
| `src/pages/index.astro`    | the page, and the opening scene in served HTML        |
| `spec/`                    | the invariants, the travelling sensors, and C5's contract tests |
| `scripts/`                 | the Chrome sensors and the difficulty measurement     |
| `reference/`               | the two images the visual language came from          |

`src/scripts/rules.ts` is deliberately free of DOM and canvas: the trim — a
slab keeps only the part that landed on the slab below — is the rule under
focused test in `spec/crit-5.test.ts`, and it runs in milliseconds without a
browser.

## Working in here

```sh
pnpm install
pnpm dev                 # http://localhost:4321/comp4020-crit5-u7663394/
pnpm check               # typecheck, build, lint, tests --- the fast loop
pnpm check:render        # real Chrome at both marked viewports
pnpm check:play          # real Chrome: can it be lost, does play end
pnpm shots               # full-page screenshots into .shots/
pnpm check:evidence      # the process-evidence check CI runs
node scripts/difficulty.mjs   # where each ability of hand dies, over 4000 rounds
```

`pnpm check` is most of what CI runs. The links check, the secrets scan and the
deploy are CI-only. **Neither Chrome sensor is in `pnpm check`** — both need
Chrome and a few seconds — so run them before committing anything that touches
the rules, the input or the drawing.

To reproduce CI's links check locally, serve the build **under the base path**
and crawl that URL:

```sh
pnpm build && pnpm preview --port 4989 &
pnpm dlx linkinator "http://localhost:4989/comp4020-crit5-u7663394/" \
  --recurse --silent --skip "^https?://(?!localhost|127)"
```

The `--skip` is not optional: without it the run also checks the absolute
`og:image`, which 404s until the site is deployed.

## The process

`PROCESS.md` is the reading guide, with citations. `reflections/crit-5.md` is
the reflection. `CLAUDE.md` is the harness, and it is read as part of the mark.
