# COMP4020 prototype

This is your starter repo for a COMP4020 prototype. **This week's stack is
Astro**, the course default from C2 onward: pages live in `src/pages/` as
`.astro` files, layouts in `src/layouts/`, styles in `src/styles/`, and
`pnpm build` (`astro build`) emits the built site into `dist/`. The template's
own Vite/plain-HTML default was swapped out — there's no root-level
`index.html` or `main.ts` any more; a new page is a new file under
`src/pages/`. Deploys to GitHub Pages. The
**deployed site is what gets marked** --- not this repo, and not "it
works on my machine". It's marked live in Chrome against the deployed URL at two
viewports --- 1920×1080 (desktop) and 390×844 (phone) --- and both count in
full, so make that artefact good at both and use the checks below to know
whether it is.

What you're building this week — the spec — is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries your harness forward from last week, and helps you turn the
spec's checkable lines into tests of your own. Read the spec before you build,
and see `spec/README.md` for how the checks in this repo relate to it.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs most of what CI runs --- build,
  lint, and the spec --- so you catch those in seconds instead of waiting for
  the pipeline. The links check, the evidence check, the secrets scan, and the
  deploy itself only run in CI. To run the links check locally you have to
  reproduce what CI now does --- serve the built site *under the base path* and
  crawl that URL, not `linkinator ./dist`:

  ```sh
  pnpm build && pnpm preview --port 4989 &
  pnpm dlx linkinator "http://localhost:4989/comp4020-crit5-u7663394/" \
    --recurse --silent --skip "^https?://(?!localhost|127)"
  ```

  **The `--skip` is not optional**, and this snippet was missing it until C4.
  CI passes it so that someone else's outage cannot redden a build; without it
  the local run also checks the absolute `og:image`, which 404s until the site
  is deployed. A documented repro that disagrees with CI reports a broken link
  in a page that has none, and gets ignored the second time.
- To see what the page actually looks like rather than what you assume it looks
  like, open it in a browser (the `agent-browser` CLI, documented on
  [the course site](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/backpressure/#agent-browser-the-rendered-page-as-ground-truth),
  works well for this). The rendered page is the truth; your mental model of it
  isn't. **`pnpm check:render` before committing anything visual.**
- When a check fails, read its output before changing anything. Each check below
  names what it measures, and the failure message is the instruction: it tells
  you the file, the line, or the contract. Treat a red check as authoritative
  --- the page is wrong until the check is green, not until you decide it should
  be.
- Commit when the checks pass. Never commit a red state.

  **One deliberate exception, at the top of the week: the tests you write for
  this week's published spec.** They are committed red, before any prototype
  exists, because that is what they are for --- the contract arrives first and
  the work is turning each one green. The red-to-green commits are the process
  evidence `PROCESS.md` cites. The exception is narrow and it expires: it covers
  `spec/crit-5.test.ts` on the day it is written, and nothing else, ever. A
  build that doesn't build, a lint that doesn't pass, a sensor that broke while
  you were changing something unrelated --- those are red states, and they stay
  uncommitted.

## The checks (your sensors)

CI runs these on every push once your repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy` --- not one status per sensor below --- and
within `check` the steps run in sequence (`pnpm check` chains typecheck, build,
lint, and the spec with `&&`), so an early failure like a broken build stops the
later sensors from running for that push; fix it and push again to see the rest.
While the repo is private (all week, until you ship) the CI jobs stay skipped
--- `pnpm check` is the same roster on your machine, and it's the faster loop
anyway. They aren't hoops. Each is a different way of finding out something true
about the site that you can't reliably see by looking at it.

They also carry a mark at a crit: the sweep runs fifteen minutes after your
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `astro check` runs first in `pnpm check` (it type-checks
  both `.astro` files and plain `.ts`), so a type error stops the roster before
  the build even starts. The types are extra backpressure: a red here is the
  compiler telling you a claim in the code is false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **deploy / online** --- the live GitHub Pages URL must load and return the
  page you expect. An asset that 404s on the deployed URL counts as broken even
  if it loads locally.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good
  website, whatever the week's brief asks; the tests you write for the week's
  own spec run alongside it (any `spec/*.test.ts`). A failure names the contract
  you haven't met yet.
- **lint** --- `stylelint` for CSS, `oxlint` for TypeScript and `.mjs` (`.astro`
  files aren't linted by either --- `astro check` above is what catches problems
  in them). Flags code that's wrong, fragile, or non-idiomatic. Read the rule it
  names.

  The C4 template dropped both linters from the roster; they're here because A1
  had them and the stylelint rule below was earned. **Note the flag:** plain
  `oxlint` exits 0 on warnings, and most of its default rules --- `no-debugger`,
  `no-dupe-keys` --- are warnings. Carried forward unchanged from A1, it would
  print complaints while `pnpm check` went green: a sensor that cannot fail.
  `--deny-warnings` is what makes it a sensor.
- **tests** --- any other tests you write, wherever you put them (co-located
  with your source is fine, not just `spec/`), must pass. Vitest picks up both
  this and the spec suite in one `vitest run`, the last step of `pnpm check`. A
  failing test is a claim about the site that's no longer true.
- **evidence** (`pnpm check:evidence`) --- checks your process evidence:
  `PROCESS.md`'s citations resolve to real commits, the current deliverable's
  exact reflection is in `reflections/` (worked out from this repo's name
  against the public course API --- `reflections/crit-5.md` this week), and your
  `CLAUDE.md` is present. See
  [Your process is part of the mark](#your-process-is-part-of-the-mark) below,
  and the course website's
  [assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
  for what counts as evidence.

  **Correction, C5: evidence no longer gates the deploy, and this file said it
  did.** The C4 template had `deploy: needs: check`; the C5 template deliberately
  removed it, and the reasoning in `.github/workflows/checks.yml` is worth
  reading rather than paraphrasing. The short version: a blocked deploy does not
  take a site offline, because Pages keeps serving the last deployment. So the
  site silently freezes at the last green commit while the repo moves on, the
  crit sweep reads a bare HTTP 200 as live, and the tutor screenshots last
  week's work as this week's with nothing in the capture to say so. A red check
  is already priced into the mark; gating the deploy adds a second, uncalibrated
  penalty on top. **The practical consequence for how you work: a green deploy
  is no longer evidence that anything else passed.** Read the `check` job, not
  the URL.
- **links** --- internal links must resolve. A broken link is a dead end you
  didn't mean to ship. CI boots `astro preview` and crawls the site **under the
  base path** (`/comp4020-crit5-u7663394/`), so this sensor sees the same URLs a
  visitor does. That's a change from the template's old `linkinator ./dist`,
  which served `dist` as a root and so disagreed with the deployed site about
  what a root-absolute link means.
- **secrets** --- the repo is scanned for committed credentials. Never put a
  key, token, or password in a tracked file. If one leaks, rotate it. A local
  pre-commit hook (`.githooks/pre-commit`, installed by `pnpm install`) also
  blocks any commit containing something shaped like an API key --- by the time
  CI sees a key it's already pushed, so the hook is the sensor that matters.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors (`axe-core`, Lighthouse, or whatever you choose) is your work, and later
in the course the spec will ask you to show how you tested both. When you do,
read a green performance result honestly: it's a lab estimate from one run on a
CI machine, not proof the site is fast for real users.

**Nothing in the roster above knows what a game is, and this week the artefact
is one.** That hole is the same shape as the canvas hole and the audio hole
before it, and it is filled the same way. C4's answer was `probeAudio`; C5's is
`pnpm check:play`, which asks the two questions the spec fixes and no DOM sensor
can reach --- **can a wrong move be made, and does play end somewhere.** Neither
Chrome sensor is in `pnpm check` (both need Chrome), so **run them before
committing anything that touches the rules or the input**, the way
`check:render` has always been the rule for anything visual.

What still cannot be measured here: whether the game is *fun*, whether a
stranger works out the first move without being told, whether five minutes in it
still holds. That is the cold open at the crit --- and this week you stay quiet
until someone finishes or gives up. No probe substitutes for four people's hands
on the keyboard, and the no-tutorial rule is settled by them in about ten
seconds.

## The link-preview card

`public/card.png` (1200×630) is the image a shared link shows. New in the C4
template, and the Astro conversion dropped the whole head block on the way in
--- both link-preview invariants went red on the first `pnpm check`. It lives in
`src/layouts/Layout.astro`, so every page that uses the layout gets it, and
`description` is a **required prop** rather than an optional one: an optional
description is a description someone forgets.

The card URL is built absolute from `import.meta.env.BASE_URL` and `site`, not
written as `./card.png`. A relative card resolves against the page that names
it, like any link, so it is correct on the home page and wrong on the first page
one directory down --- and **nothing in CI checks it**. The link check only
crawls `href`s; a broken `og:image` fails silently, on someone else's timeline,
in a Slack unfurl you never see.

## The stack is swappable

This week is Astro: every `.astro` (or `.md`) file under `src/pages/` is a
page, and the build picks it up with no config. That's this week's choice, not
a rule (unless the week's spec says otherwise) --- a future week can swap in
plain Vite, a different generator, or hand-written HTML, because nothing in CI
names a tool. The whole contract is:

- `pnpm build` emits the complete site into `dist/`
- the `package.json` scripts (`check`, `check:evidence`, `build`) keep working
- whatever lands in `dist/` still passes the invariants in `spec/`

Two things bite in a swap. The deployed site lives under a path
(`…github.io/<repo>/`), so Astro needs `base` set explicitly in
`astro.config.ts` --- already done, to this repo's name, by the stack skill,
which derives it from the origin remote rather than trusting anyone to type it.
Getting `base` wrong looks fine locally while every asset 404s on the live URL.
The config also sets `build.format: "file"` (so `page.astro` builds to
`dist/page.html` and hand-written *relative* links keep working) and
`compressHTML: true`. And commit the updated `pnpm-lock.yaml`: CI installs with
`--frozen-lockfile`.

`pnpm dev` serves under the base path too, deliberately: a path bug reproduces
on localhost instead of only on the live URL. So the dev URL is
`http://localhost:4321/comp4020-crit5-u7663394/`, and the bare root correctly
404s. If 4321 is already taken --- by a dev server left running in another
course repo --- Astro silently picks the next free port. Read the port out of
its startup line rather than assuming; checking the wrong port once already
produced a "broken base path" that did not exist.

## Your process is part of the mark

The deployed page is only half of it. How you got there is marked too: your
commit history, your agent files, and the decisions visible across them. The
checks above can't see any of that, so a person reads it directly --- which
means building legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of your process; a single
  dump the night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what you built, the moments that mattered --- each pointing at a
  commit, an `AGENTS.md` change, or a prompt and the commit it produced --- and
  where to look in the history. It points a marker at the evidence; it doesn't
  stand in for it, and claims the history doesn't back don't count. The
  `PROCESS.md` in this repo is a template showing the shape and the citation
  format (link text the commit hash or range, target the commit or compare URL);
  `pnpm check:evidence` verifies your citations resolve to real commits before
  you ship. Markers follow those citations and don't trawl the repo for evidence
  you didn't cite.
- **Write your reflection in `reflections/`** --- a short markdown file in this
  repo, named for the deliverable it answers, so the number in the filename is
  the number in this repo's name. **This week that is `reflections/crit-5.md`**;
  `reflections/README.md` has the full rule. `pnpm check:evidence` checks the
  exact current name against the course API, not merely the presence of any
  well-named file, so last week's `crit-4.md` cannot stand in for it. It
  answers the two standing prompts: the breakthrough that moved the work
  forward, and what this work changed about the developer you want to be. It
  stays out of the deployed site. It's due at the cutoff, and if it isn't in the
  repo by then the week doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness you build to direct the agent,
  this `AGENTS.md` and any `CLAUDE.md`, is itself read as part of how you
  worked. Keep it honest and current (see below).

You don't need a name, a student number, or any identity file in the repo: we
know whose repo it is. Spend the effort on the work.

## This file is yours

This AGENTS.md is a starting point, not a fixed rulebook. As you learn what your
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching you out, a fact about the stack the agent keeps getting wrong --- write
it down here. Growing this file is the work of harness engineering, and the gap
between this boilerplate and your own version is part of what your prototype
says about the developer you're becoming.

What you add to it is the harness, and **the harness is assessed**. This file
and the sensors you wire into `check` carry across the course --- both come with
you into next week's repo. The prototype doesn't: source, and the tests
answering this week's published spec, stay behind. `spec/README.md` draws the
line, and draws it in the right place: a **contract test** answers this week's
brief and retires with it, a **sensor** asserts a standard you hold the agent to
whatever the brief is, and a sensor is harness in exactly the way a rule below
is.

---

The rules below are not style preferences. Each one is here because something
went wrong, and the note says what. They were earned in C1, C2, A1 and C4 and
carried forward; the ones that were only ever about a particular page --- the
explainer's motion choreography, the piano's key table and pedal --- have been
cut, and the ones that were about a specific artefact have been rewritten as the
rule underneath. Where a lesson was learned on last week's instrument the note
still says so, because *what went wrong* is the part that makes the rule stick.

## This week the page may not explain itself

C5's spec forbids instructions: **no how-to-play modal, no instructions page,
nothing in the README standing in for either.** The opening screen has to make
the first move obvious on its own, and play teaches whatever comes next.

Writing this down because it cuts directly against what an agent does by
default. Asked to build a game, the obvious, helpful, well-trained move is to
add a "How to play" panel, a controls legend, a paragraph under the canvas, a
README section listing the keys. Every one of those fails the spec outright, and
each is the kind of thing that gets added late, in a hurry, while fixing
something else. **If you are about to write a sentence that tells the player
what to press, the design is wrong, not the sentence.** Fix the affordance
instead.

Two boundaries, so the rule stays usable:

- **A name is not an instruction.** Naming the game is explicitly allowed.
- **An accessible name is not an instruction either.** `aria-label`, `alt`, and
  the accessible names `check:render` requires on every marked control are how
  the page is operable at all; they aren't a tutorial. Don't strip them chasing
  this rule. The rule is about *teaching the player the rules*, not about
  removing text from the DOM.

Nothing automated can enforce this --- a test cannot tell an invitation from an
instruction --- so it is the one line here that the crit settles rather than the
harness. The pod plays cold and you stay quiet until someone finishes or gives
up.

## The rendered page is the sensor, not the source

`pnpm check` proves the HTML is well-formed. It has no layout engine — Vitest
runs against JSDOM, which has none at all — so it cannot see a page that
overflows a phone or a control that never becomes reachable. **`pnpm check:render`
before committing anything visual.** It builds, serves the site under its base
path, and drives real Chrome over the DevTools Protocol at both marked
viewports (1920×1080 and 390×844), failing on horizontal overflow, on a missing
or duplicated `h1`, on an uncaught exception, on a marked control Tab can't
reach, on overflow after a resize taken mid-interaction, and on `[data-reveal]`
content still transparent at the bottom of the page.

`pnpm shots` writes full-page screenshots to `.shots/` — **look at them.** The
settled shot uses reduced motion so it is deterministic; a second `-playing.png`
shot per viewport presses whatever the page declares in `[data-code]` and
photographs the result, because for a game the settled state is the one state
the work is not about.

**The settled shot has a second job this week.** It *is* the opening screen —
the thing the no-tutorial rule turns on. Look at it and ask what a stranger
would press. Then remember the screenshot cannot answer that and the pod can.

It discovers its own page list from `dist/`, so a page you add is checked
without touching the script. It is not wired into `pnpm check`: it needs Chrome
and a few seconds, and the fast loop should stay fast.

**Neither Chrome sensor names a letter of the computer keyboard.** They read
`data-code` and `aria-label` out of the built page and turn a `code` into a
virtual key code. They used to say `KeyA`, and the day the keyboard was relaid
onto the two-octave layout that became a key bound to nothing: the audio probe
would have reported a silent instrument, correctly about the key it pressed and
uselessly about the page. An inventory read from the artefact is fine; a
constant copied out of the artefact goes stale in silence. **The same trap is
one refactor away this week** --- a game rebound from WASD to the arrows breaks
a written-down table exactly the same way. So mark the keys the game binds with
`data-code` and let the sensors read them.

**`pnpm check:play` is the second Chrome sensor, and it is about behaviour
rather than pixels.** C4's version drove the instrument the way each kind of
player does and asserted what came out; the assertions retired with the piano,
the frame did not. It now asks the two things C5's spec fixes and nothing else
can see: that a wrong move is possible, and that play ends somewhere. Both
scripts share `scripts/cdp.mjs`, which is where the CDP client and the
preview-daemon lifecycle live; a second copy of `waitForServer` is a second
chance to lose the day described below.

**The end-of-play pass flails randomly rather than running a scripted losing
line.** A scripted one proves the move you had in mind still loses; flailing
proves the game ends *at all* under hands that do not know what they are doing
— which is the claim the spec actually makes, and how the pod will play it. The
specific rule — the collision, the illegal move, the last card — belongs in
`spec/*.test.ts`, where it runs in milliseconds without Chrome. That split is
also what the spec asks for: *one rule* under a focused automated test.

What this has cost so far, which is worth remembering when reading any sensor:

- A naive `chrome --headless --screenshot --window-size=390,844` cropped a
  desktop-width render and looked exactly like a broken mobile layout. Half an
  hour went into a bug that did not exist. If a measurement disagrees with a
  screenshot, trust the measurement and check the screenshot's method.
- `check:render` first compared overflow against `window.innerWidth`, which
  widens along with an overflowing grid track and so reported zero overflow on
  a page 46px too wide. **A sensor that derives its threshold from the thing
  it's measuring cannot fail.** It compares against the requested viewport now.
  Note the boundary: deriving the *page list* from `dist/` is fine, because
  that's an inventory. Deriving the *threshold* from the measurement is not.
  `oxlint --deny-warnings` is the same lesson in a second place: check what the
  tool does on failure, not what it prints on success.
- A sensor pointed at the wrong server measures nothing and reports success at
  it. An early version assumed a preview server was already running; it now
  starts and stops its own, because "remember to boot a server first" is a
  silent-failure mode, not an instruction. **That fix was necessary and not
  sufficient**, which is the sharper version of the lesson: `astro preview` is a
  *daemon*, it survives `subprocess.kill()`, and a second one does not start —
  it prints "already running" and exits 0. A whole day's runs measured a server
  started ten hours earlier. `check:render` now stops any daemon before and
  after, and — the part that actually holds — compares the bytes the server
  hands back against `dist/index.html`. **Check identity, not liveness.** A
  server answering is not evidence it is answering with your build.
- **Run a sensor through its `pnpm` script, because the script is where the
  build is.** The same lesson as the daemon above, one level out, and it cost
  most of an afternoon in C5. `node scripts/render-check.mjs` does *not* build;
  `pnpm check:render` is `pnpm build && node scripts/render-check.mjs`. Half a
  dozen runs went into diagnosing a blank canvas that had already been fixed,
  against a `dist/` from before the fix — and because the fault was real once,
  every reading was consistent and plausible. `waitForServer` compares the
  served bytes to `dist/index.html`, so it catches a stale *server*; nothing
  catches a stale *`dist/`*, because from the sensor's point of view there is
  nothing wrong. **If a sensor disagrees with a change you just made, rebuild
  before you investigate.**
- **`requestAnimationFrame` is a request, not a promise.** Measured in headless
  Chrome on the same page in the same run: ~16 callbacks a second on one
  viewport and **zero** on the other. Assigning `canvas.width` or
  `canvas.height` *clears* the bitmap, so a resize handler that clears and then
  waits for the next frame to repaint leaves the stage blank for as long as the
  frame takes to arrive — which can be forever, and is long enough to matter in
  a throttled tab, a backgrounded window or a low-power mode. Every DOM sensor
  stays green through it; only the ink probe and the screenshot see it. So
  **repaint synchronously on the thread that cleared it**, and repaint on every
  state change rather than leaving the screen to catch up next frame. The
  second half of that is not just robustness: a readout that only updates in
  the loop reads stale to a sensor and *late* to a player.
- **A canvas is opaque to every DOM sensor.** Squeezing the drawing off the side
  of a phone left the stage blank while the markup check, the interaction check,
  the overflow check and the exception listener all stayed green. `check:render`
  samples the canvas and reports the fraction of pixels differing from the
  corner — "there is a picture here", without knowing what the picture is. If a
  sensor suite can't see the main artefact, it isn't measuring the artefact.
  **An `AudioContext` was opaque in exactly the same way, and so is game
  state.** Score, lives, whether a round has ended: none of it is in the DOM at
  rest, and a game that cannot be lost throws nothing. So `check:play` strikes
  the same bargain the ink probe and C4's audio probe struck --- the page
  exposes `window.__gameProbe()`, returning at least
  `{ over, outcome, moves }`, and the sensor reads it. **Both kinds of probe are
  a bargain with the page**: the page has to cooperate for the sensor to see the
  artefact at all. That is acceptable, and it is the reason the falsification
  below is not optional.

  One deliberate difference from C4. The audio probe *skipped* when
  `__pianoProbe` was absent, which was right when sound was optional.
  `check:play` **fails** when `__gameProbe` is absent, because "it can be lost"
  is a fixed line of C5's spec: a page that cannot answer the question has not
  met it. A sensor that goes quiet on the artefact it was built for is a
  decoration.
- **Falsify a new check before trusting it.** Every sensor here has been run
  against a deliberately planted fault — `tabindex="-1"` on a control, a 700px
  div, a throwing script, an ungated `display: none`, a foreign server squatting
  on the port, a `debugger` statement, a BEM class name, and in C4 a muted
  master gain, a skipped `init()` and a `noteOff` that returns early. All three
  audio faults printed the right sentence. A check that has never been seen to
  go red is a decoration. Don't just ask whether the check *can* fail in
  principle; watch it. **C5's two faults were planted and all three results are
  written down**: a game that can never be lost (green at first — see the
  conjunction note below — red once the missing clause was checked), an ending
  reporting an outcome nothing names (red on two checks), and a third worth
  planting next time, a game that **loses and reports a win** (red on one check
  only, and nothing else in the repo could have told it from a win).
- **A check that cannot fail on the fault it is named after is a lie.** The
  first version of "twelve keys share one particle budget" compared standing
  counts after 2.5s of holding, and stayed green against a planted fault that
  gave every key the full solo rate --- because by 2.5s the hard cap has
  engaged and clamps both cases to the same ballpark. Sampled at 1.4s, while
  both are still filling, it compares the spawn rate instead: healthy 1.8x,
  faulty 4.7x, threshold 3.5. **When a falsification comes back green, the
  first suspect is the check, not the fault.**

  **C5 found the second shape of this, and it is the one to look for first:
  the check was testing only one clause of its own sentence.** `check:play` was
  named after "it can be lost: a wrong move is possible, and play ends
  somewhere" and asserted only the second half. An unlosable game — the trim
  clamped so every drop keeps 60% of its width — sailed through 7/7 and
  reported `won after 20 moves`. True, and not what the line says. So: **when a
  spec line is a conjunction, count the clauses and count the assertions.** A
  check named after an "and" that tests one side is a lie in exactly the way the
  particle budget was, and it is harder to see, because the sentence in the
  comment above it reads correctly. The fix here was to add a check that flails
  several rounds and requires at least one to *lose* — reachability of the
  losing state, not a scripted losing line. It is also the only thing in the
  repo that can catch a game which loses and reports a win.
- **A falsification that stays green tells you something too.** C4's fourth
  planted fault — deleting the `resume()` call from the gesture handler — did
  *not* go red, because Chrome auto-starts an autoplay-blocked `AudioContext`
  on the first user gesture whether you ask it to or not. So the probe could not
  catch a missing `resume()`, and the line stayed in `audio.ts` for Safari and
  iOS, where it is load-bearing and where nothing in that repo tested. Write the
  hole down rather than deleting the line that fills it.
- **Watch the transition, don't just check the ends.** Every still frame of a
  broken transition looks like a plausible drawing, and `pnpm shots` only
  photographs settled states. A settled state matching its target says nothing
  about the path taken to it.
- **Never ease the timeline twice.** Easing a journey and then easing each step
  inside it compounds into a curve nobody chose. One layer owns the easing.
- **Don't trade continuity for a benchmark.** A sample that thins what is
  already present to make the frame budget is a regression wearing a green
  number. A dropped visual frame is a flicker; a dropped audio block is a click
  the player hears; **a dropped input is a move the player made and the game
  did not.** That last one is this week's version, and it is the worst of the
  three, because the player will blame themselves for it.

## Three loops that will not settle

All the same mistake as the overflow threshold above, one level out: a quantity
derived from a thing must not also determine that thing.

- **A layout must not depend on a figure measured from the layout.** A readout
  showing a value measured off the render, in a region the render is then fitted
  around, closes the circle — and the page reflows forever. With a
  `ResizeObserver` in the loop this hung a whole `check:render` run rather than
  merely looking wrong. Text that a measurement writes into **reserves its
  height**, and the resize handler returns early unless something actually
  moved. A live score or timer is exactly this shape: give it a fixed box.
- **A geometric heuristic has to be about the quantity you need, not a proxy
  for it.** Overlays clip one edge of a drawing's safe box each, and the first
  version chose the edge the overlay sat *nearest*. A full-width bar along the
  bottom of a phone is flush with the left edge too, so it cut the left off the
  whole frame and the drawing vanished into a 64px sliver off-screen. Choosing
  by the *area* the cut costs is correct because area is what the drawing needs.
- **A canvas sized from its own bitmap is the same loop, and it is silent.** A
  `<canvas>` is a *replaced* element: in normal flow with `height: 100%` inside
  a flex-sized parent, the percentage does not resolve, so its layout height
  falls back to its `height` **attribute** — which the drawing code sets from
  the height it just measured. Nothing errors, nothing overflows, no check goes
  red; the canvas simply settles at 496px inside a 602px stage and every beam
  stops 106px short of the key it is rising from. Only the screenshot showed
  it. **Give a canvas its box from something that is not the canvas**:
  `position: absolute; inset` against a `position: relative` parent. **In a game
  this is worse than cosmetic**: if the drawing and the hit-testing disagree
  about the canvas box, the player is hit by something they can see they
  dodged.

## The core interaction is marked in the markup

A convention, not a paragraph, so that a test can hold the spec's central line
without knowing what the idea is — which is what lets the idea change without
the tests needing to:

- the control the player acts on carries **`data-core-interaction`**
- the region that changes as a result carries **`data-core-output`**
- the keys the page binds carry **`data-code`** (see the sensors above)

`check:render` asserts the behaviour by operating the control with real keys and
checking `[data-core-output]` actually changed; your `spec/*.test.ts` asserts
the structure — the control exists, is keyboard-focusable, has an accessible
name.

**Build the control as a real element** — `button`, `input`, `select`,
`details` — rather than a `div` with a click handler. The artefact HD band is
"holds up under use it wasn't designed for: the keyboard, a resize
mid-interaction, a slow connection", and a `div` fails on the marker's first Tab
press. Both sensors reject one.

**This week that has teeth it didn't have before.** A game whose only control
scheme is the computer keyboard is unplayable at the 390×844 marking viewport,
and that viewport counts in full. Real elements are the cheapest way to get
mouse, keyboard and touch at once rather than writing three input paths — and a
game a phone cannot play is a game half the marking cannot see.

A note on testing keyboard input, because it cost an hour: an in-page
`dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))` does **not**
activate a native control. Synthetic events have `isTrusted: false`, so the
browser performs no default action, and the first version of the interaction
check reported `NO CHANGE` against a `<button>` that worked perfectly by hand.
It would have argued for adding a `keydown` handler to a button that never
needed one. Both Chrome sensors use CDP's `Input.dispatchKeyEvent`,
`Input.dispatchMouseEvent` and `Input.dispatchTouchEvent`, which are trusted.
**If a sensor says the page is broken, reproduce it by hand before changing the
page.**

**A real control gives you three input paths, and a fourth one you did not
ask for.** The reason to build the control as a `button` is that mouse, keyboard
and touch arrive without writing three handlers. The bill is that a *focused*
button also activates natively: a Space or Enter press fires `click` on top of
whatever the page already did, so one press becomes two moves the moment
anything listens for `click`. It only happens after the control has been
focused, which is why it survives a casual test. Two rules fall out:

- **Handle a pointer with `pointerdown` and never also listen for `click`.**
  One press, one path.
- **`preventDefault()` in a global key handler is load-bearing for correctness,
  not just for stopping the page scrolling.** It is what cancels the native
  activation. Measured in C5 with a `click` handler planted: with the
  `preventDefault`, one move per press; without it, **three**.

And assert it by *counting moves*, not by watching for change --- "the state
changed" is true of a doubled input too. **A doubled input is a move the game
made and the player did not**, which is the mirror of the dropped-input rule
above and ships more easily, because nothing looks wrong.

**And the rule cuts both ways.** Two of C4's twenty `check:play` checks were red
the first time they ran, and both times the bug was in the *test*: a voice count
taken while the previous chord was still decaying (the engine was right; the
sleep was too short), and an expectation that CDP's `touchEnd` lists the points
that *remain* rather than the ones that *ended*. Both would have led to "fixing"
correct code. Reproduce a red check before you believe it. **Expect the first
one again this week** — a state read before a move has resolved is the same bug
wearing a different hat, and a game has more animation between input and settled
state than a piano key did.

C5 added two more shapes of the same mistake, and both were found by a result
that looked like bad *code* and was bad *measurement*:

- **A check whose precondition a later step can undo.** The focused-button check
  set its focus up outside the helper that makes the move, and that helper
  reloads the page when the previous check ended the round — throwing the focus
  away, so the check quietly measured the unfocused path and passed. It surfaced
  only because a planted double-fire fault *failed* to redden it. Setup belongs
  inside the step, after any reset, never before it.
- **A driver that plays the game must anchor to the page's clock.** A scripted
  player aimed each press a quarter-period after its own previous press —
  correct from the second move on, and meaningless for the first, because
  nothing told it when the *page* had started moving. Measured: 612ms of error
  on move one, two thirds of the opening slab gone, and three input paths
  scoring 2–6 where a pure-rules simulation of the same hand said 13. That gap
  read exactly like an unfair difficulty curve, and I nearly retuned a curve
  that was already right. Anchoring on something the page does — the moment
  `window.__gameProbe` first answers, a few ms after the first slab starts —
  took the error to 71ms and the two measurements agreed. **When a driven
  measurement disagrees with a model of the same thing, suspect the driver: it
  has a clock of its own and the page does not share it.**

## Never make content visibility depend on JavaScript

If content is hidden by default and revealed by script, the reveal is a race and
the failure is invisible. `IntersectionObserver` only reports a *change* in
intersection, so an element that crosses the viewport between two deliveries —
a flick-scroll, an End keypress, a jump to an anchor — is never reported and
stays at `opacity: 0` permanently, with no error anywhere. Measured: 4 of 19
elements revealed at a 40ms scroll step, 19 of 19 at 120ms. A scroll handler
lost the same race.

Reveals go in CSS (`animation-timeline: view()`). If one ever needs to move back
into JavaScript, the hidden state must be gated behind something JavaScript has
already set, and the text must still be in the served HTML — assert that in
`spec/`.

Note the boundary this week. A game's *rules and motion* obviously depend on
JavaScript; that's the brief. Its *opening screen* must not. A player who
arrives before the script does should still land on something that invites the
first move — and since C5 forbids explaining that move in words, an opening
screen that renders blank without JS has no second chance to make the
invitation.

## Drawing rules that bit

- **A gradient only softens along its own axis.** A vertical linear gradient
  poured into a `fillRect` gives a beam that fades beautifully upward and has
  razor-sharp sides; at three notes the "halo" read as three grey rectangles
  laid over the background. A light with an edge is not a light. Use a radial
  gradient under a `translate`/`scale` — a squashed half-ellipse standing on
  the key line is soft in both directions and costs one extra `save`/`restore`.
- **In a column flex container, `align-items` is the horizontal axis.** Writing
  `align-items: flex-end; justify-content: center` for "put the label at the
  bottom" right-aligned every key letter and floated it up behind the black
  keys, hiding the printed keyboard bindings on five of eight keys — the only
  instruction that page had. Nothing but the screenshot could see it.
- **Scale a drawing in units of the thing it belongs to.** A beam fixed at 30px
  is a fat stripe on a phone and a thread on a desktop. Size things as a
  fraction of what they belong to, measured against the canvas box. **In a game
  this decides difficulty**: a player character fixed in pixels is a different
  game on a phone than on a desktop, and the phone version is usually the
  unfair one.
- **Blit sprites; do not build gradients per frame.** A `createRadialGradient`
  scaled across most of the stage, three times per note, is the single most
  expensive thing C4 ever did: a twelve-note chord measured 49ms a frame ---
  twenty fps, on the exact input the instrument invites. Baking each shape once
  per hue bucket into an offscreen canvas and blitting it with `globalAlpha`
  took the same chord to 16.7ms, and the hundreds-of-milliseconds spikes went
  with it.
- **Measure before optimising, because the guess was wrong.** The obvious
  suspect was the four hundred particles. Isolating the two halves --- one run
  with the beams switched off, one with the particles switched off --- showed
  the particles held a locked 60fps on their own and the beams alone cost the
  whole 34ms. An afternoon spent making particles cheaper would have bought
  nothing. A `/tmp` throwaway that installs a rAF counter and reports p50/p95
  is enough; it does not need to be a permanent sensor to be worth writing.

  **C5's version of this is about balance, not frames, and it is why the rules
  should be pure functions.** Watching a robot flail at the game, the obvious
  conclusion was "too punishing" and the obvious fix was a more forgiving
  tolerance. Four thousand simulated rounds per ability — a hand modelled as a
  timing error in milliseconds, played straight against `rules.ts` with no
  browser, in a few milliseconds — said a newcomer's median was already 7 of 20
  and an expert already won about a fifth of the time, and that the tolerance
  knob moved *only* the expert's win rate. The change I was about to make was
  the wrong one, and the measurement that stopped it was possible only because
  the rules had no DOM in them. **A tuning number is not a contract**, so this
  stays out of `pnpm check`; it is a throwaway that earned a filename.
- **An overlay's colour comes from the palette its text was designed against,
  never from black.** The ending screen's veil: a black scrim is the reflex, and
  it was right on five of six palettes and wrong on the light one, whose ink is
  dark — there the veil destroys the contrast it was added to create. Veiling
  with the *theme's own* background colour is correct for every palette by
  construction, because that is the colour the ink was chosen to read on. One
  line instead of six spot-checks and a special case.
- **The affordance that lets the player continue must not be drawn over the
  thing they just made.** The replay glyph sat exactly where the top of the
  tower sits, in the same tone, so the better a player did the less visible
  their way back in became. This is the general form: **an overlay positioned
  against the viewport will collide with content positioned against the
  viewport** — check it at the state where the content is *biggest*, not at the
  opening. Nothing but a screenshot of a finished round shows it.
- **Two numbers describing one object in two languages are one number.** The
  opening scene is drawn in CSS and then in canvas, so the slab's size exists as
  `min(60%, 50vh)` and as `min(w * 0.3, h * 0.25)`. They have to move together
  or the page pops the moment the script boots. Neither a type nor a test can
  couple them across the language boundary, so each site carries a comment
  naming the other. **When a value must be duplicated, make the duplication
  say so.**

## Two things the toolchain will keep telling you

- **TypeScript drops `const` narrowing inside hoisted `function` declarations.**
  Thirty-one `'ctx' is possibly 'null'` errors came from guarding
  `getContext("2d")` at the top of a module and reading it inside
  `function paint()`. Arrow consts declared after the guard keep the narrowing.
  Don't reach for `!` — the guard is real, the compiler just can't see the
  ordering. Expect this again with every nullable handle you grab once and use
  in a loop.
- **Conform to the linter rather than loosening it.** `stylelint-config-standard`
  rejects BEM `block__element` class names. The obvious move was to relax
  `selector-class-pattern`; the rule went in the config for a reason and my
  naming preference is not one. Renaming to kebab-case cost one command. Change
  a rule when it is *wrong about this codebase*, not when it is inconvenient.
  Applied again on the way into C5: `oxlint --deny-warnings` flagged the unused
  mouse dispatcher left in `play-check.mjs` after the piano assertions came out,
  and the fix was to delete it, not to silence the rule.

## URLs: relative in the built output, never root-absolute

The site deploys under `…github.io/<repo>/`, so a root-absolute `/about/` is
correct only when served at exactly that prefix. Root-absolute links once put 13
broken links in front of CI.

`build.format: "file"` means a plain relative `href` resolves correctly both
locally and deployed. So: **author internal links relative** (`./`, `../x/`), or
prefix `import.meta.env.BASE_URL`. Never root-absolute. Assert it in `spec/` by
resolving every internal link against `dist` — the same thing CI's crawl does,
in milliseconds instead of a pipeline run.

One correction to how that rule is *stated*, which matters more than the rule.
Written as "no root-absolute URLs at all" it went red on Astro's own stylesheet
and script, which it emits as `/comp4020-crit5-u7663394/_astro/…` — already
carrying the base, and correct on the deployed URL. A check that argues with the
framework's correct output is a check that gets worked around instead of read.
It says what actually breaks: **a root-absolute URL is an error unless it
carries the deploy base**, and the base is read from `astro.config.ts` rather
than written down a second time. When a sensor goes red on something that is
fine, the bug is usually in how the rule is phrased, not in the page — but fix
the phrasing, never the threshold.

The `og:image` in `Layout.astro` is the exception that proves the shape of this
rule: it is an absolute URL on purpose, because a scraper resolves it from
somewhere else entirely. Relative-by-default is about *internal* links.

## Layout rules that bit

- `repeat(auto-fit, minmax(26rem, 1fr))` **cannot shrink below 26rem**, so it
  overflowed a 390px phone. Always
  `repeat(auto-fit, minmax(min(<size>, 100%), 1fr))`.
- A `position: fixed` header takes no flow height, so the first section slides
  under it. Give the offset back in one place and keep the number in a single
  custom property (`--header-h`) rather than repeating it — two copies drift.
- Format dates with an explicit `en-AU` locale. A bare `toLocaleDateString()`
  renders differently on my machine and on the runner.

## Images and assets: served from this repo, never hotlinked

Downscale into `public/` and serve from here. A third-party CDN can block by
referrer or simply move, and an asset that 404s on the deployed URL counts as
broken even though it loaded locally. Assert no `<img>` has an `http(s)` src.
The same goes for any sprite sheet, font or audio file the game loads: it ships
in this repo.
