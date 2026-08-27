# Process overview

A reading guide to how One Button Tower came together. Four moments, each
pointing at the commit that carries it.

## What I built

A one-mechanic browser game in the visual language of the two images in
`reference/`: an isometric tower, a slab sweeping above it, one button. What
survives a drop is what landed on the slab below, so the tower narrows as you
build and the game sharpens itself — the difficulty curve is the mechanic, not
a level table. Twenty storeys wins; a slab that misses entirely ends the round.
Every round picks one of six handpicked palettes, so the sky, the tower's colour
ramp, the readouts and the ending screen all change together. Nothing on the
page explains any of that, which is the constraint the week was actually about.

## The moments that mattered

### 1. Putting the rule where a test could reach it

**What happened.** C5 asks for one rule of the game under a focused automated
test. The obvious build for a canvas game is one file: state, physics and
drawing in the same loop, because that is where the numbers are needed. That
version is testable only by driving Chrome, which means the rule gets tested
once, on the day it is written, and never again.

**What I did instead.** Split the rules out first, before any pixels existed, as
pure functions over `{x, w}` in world units — no DOM, no canvas, no time. The
trim then has a test that names the rule and nothing about how the rule is
drawn: `resolveDrop({x:0,w:1}, {x:0.4,w:1})` keeps `0.6` and sheds `0.4` on the
right. Widths and the sweep are in world units rather than pixels for the same
reason the tests are: a slab sized in pixels is a *different game* on a 390px
phone than on a 1920px desktop, and the phone one is always the unfair one. Both
marking viewports count in full.

**How I knew it was right.** I planted the fault `CLAUDE.md` names for this week
— a miss silently becoming a half-width landing, i.e. a game that can never be
lost — and watched two of the seven assertions go red, then restored and watched
them go green. I also got one of the assertions wrong on the first run (I had
written the surviving slab's centre as `0.3` when the overlap spans −0.1 to 0.5,
so `0.2`); the rule was right and the test was wrong, which is the failure mode
`CLAUDE.md` warns about twice, and I fixed the test.

**Citation.** [`1340f57`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/1340f57)

### 2. A falsification that came back green, and the sensor it bought

**What happened.** With the game working, `check:play` reported 7/7. I then
planted the same unlosable-game fault against it — clamping the trim so every
drop keeps at least 60% of its width — expecting red. It stayed **green**, and
reported `won after 20 moves`.

**What I did instead of the obvious thing.** The obvious reading is "the fault
was badly built". It wasn't: the game really could not be lost, and the sensor
really did pass it. `CLAUDE.md` says when a falsification comes back green the
first suspect is the check — and here the check was measuring the wrong half of
its own spec line. *"It can be lost: a wrong move is possible, and play ends
somewhere"* is two claims, and only the second was under test. So I added the
missing one rather than adjusting the fault: flail up to three rounds and assert
at least one ends in a loss. Still no scripted losing line — what is asserted is
that losing is *reachable* by hands that don't know what they're doing, which is
the claim the spec makes and the way the pod will play it. Rounds stop at the
first loss, so a losable game pays for one round and only an unlosable one pays
for three.

**How I knew it was right.** Three faults, each red on the right check and green
when restored: the unlosable game (new check only, 7/8), an ending reporting an
outcome nothing names (named-outcome *and* new, 6/8), and — the one that
justifies the whole thing — a game that **loses but reports a win** (new check
only, 7/8). Nothing else in the repo could tell that last one from a win.

**Citation.** [`faffa58`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/faffa58)

### 3. `requestAnimationFrame` is a request, not a promise

**What happened.** `check:render` reported `the canvas is blank` on the phone
viewport while its own screenshot from the same run showed the tower drawn. A
sensor and a photograph of the same page disagreeing.

**What I did instead of trusting either.** Reproduced it rather than changing the
page — and rather than dismissing it, because `CLAUDE.md` has a rule in both
directions. I wrote a throwaway that replicated the sensor's sequence and
sampled the canvas at each stage, and found the drawing loop had run **zero**
frames on that viewport, and only ~16 a second on the other. Since assigning
`canvas.width` *clears* the bitmap, the canvas was cleared by my resize handler
and then waited for a frame that never came. That is not a headless artefact: a
throttled tab, a backgrounded window or a low-power mode does the same thing to
a real player, and every DOM sensor stays green through it. So the fix went into
the page, not the sensor — `resize()` repaints synchronously, on the thread that
broke it, and so does every state change, instead of leaving it to the next
frame.

**What it cost, and the rule that came out of it.** I chased the wrong bug for a
while, because I had been running `node scripts/render-check.mjs` directly, and
that script does not build — `pnpm check:render` does. So several of those runs
were measuring a `dist/` from before the fix. That is the same shape as the
stale-preview-daemon day already recorded in `CLAUDE.md`, one level out, and it
is now written down there next to it: **run the sensor through its pnpm script,
because the script is where the build is.**

**Citation.** [`757c437`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/757c437)
(the synchronous repaint) and
[`1ad5e1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/1ad5e1d)
(the `CLAUDE.md` rule).

### 4. The change that came from playing, not from reading the code

**What happened.** Everything was green, so I played it — driven in real Chrome
at both marking viewports, six rounds each, and then looked at the screenshots
of the endings. The ending was **unreadable**. The verdict is centred on the
stage; the top of the tower sits at 56% of it. So "Game over", "11 of 20" and
the replay glyph all landed *on the slabs*. On desktop the score line was
illegible, and the ↻ was a thin ring drawn over a same-tone top face.

That last part is what made it more than cosmetic. Under a no-explanation rule
the glyph is the *only* thing telling a player they may go again — and it was
being camouflaged by the thing the player had just built. The better they'd done,
the less visible their way back in.

**What I did instead of the obvious thing.** The obvious fix is a black scrim.
That would have been wrong on `sherbet`, the one light palette, whose ink is
dark — a black veil there kills the contrast instead of creating it. So the veil
is the theme's *own* sky-top colour at 82%, because that is the colour every
theme's ink was chosen to read against. One line of JS, and it is correct for
every palette by construction rather than by six spot-checks.

**How I knew it was right.** Re-shot both endings at both viewports on both a
dark theme and the light one; `.shots/play/` has the before and after. I also
went looking for a *rules* change while I was in there and decided against one,
which is the other half of this moment. Rather than guess, I wrote
`scripts/difficulty.mjs`: it plays 4000 rounds per ability against the pure
rules, modelling a hand as a timing error in milliseconds. A newcomer's median
is 7 and an expert wins about a fifth of the time — a curve I'd have been
tuning *away* from on a hunch, since my hunch from watching the robot flail was
that the game was too punishing. Widening the snap tolerance, the knob I'd have
reached for, turned out to move only the expert's win rate and barely touch the
newcomer's. Measuring cost ten minutes and saved a mechanic I'd have had to
explain.

**Citation.** [`1ad5e1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/1ad5e1d)

## Where to look in the history

[`140898c...1ad5e1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/compare/140898c...1ad5e1d)
is the week. The spec tests were committed red before the prototype existed
([`3edaa9d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/3edaa9d)),
which is the one deliberate red state `CLAUDE.md` allows, and the commits after
it are them going green one at a time.

## What no check in here can tell you

Whether a stranger works out the first move without being told. `check:play`
proves an ending is reachable and says nothing about five minutes or about a
stranger; the settled screenshot *is* the opening screen but cannot answer what
someone would press. Four people's hands settle it in about ten seconds, and I
stay quiet until someone finishes or gives up.
