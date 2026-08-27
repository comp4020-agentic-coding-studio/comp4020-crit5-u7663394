# Process overview

**One Button Tower.** A slab sweeps above an isometric tower; one button drops
it; what survives is what landed on the slab below, so the tower narrows and the
game sharpens itself. Twenty storeys wins. Nothing on the page explains that.

## The moments that mattered

**Rules first, with no DOM in them.**
[`1340f57`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/1340f57)
One loop holding state, physics and drawing is the obvious build, and it makes
the trim testable only through Chrome — tested once, then never. Pure functions
over `{x, w}` gave it a test naming the rule and nothing about how it is drawn.
Falsified by clamping a miss into a half-width landing: two assertions red,
green on restore.

**A falsification came back green, and the check was the fault.**
[`faffa58`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/faffa58)
An unlosable game passed `check:play` 7/7 as `won after 20 moves`. The sensor was
named after *"a wrong move is possible, **and** play ends somewhere"* and tested
only the second clause. I added the first — flail rounds until one loses —
instead of blaming the fault. It is now the only thing here that catches a game
which loses and reports a win.

**Playing it broke the ending.**
[`1ad5e1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/1ad5e1d)
Six driven rounds at both marked viewports, then I looked at the shots: the
verdict and the replay glyph were drawn *on the tower*, in its tone. That glyph
is the only invitation back in, and the better you played the less visible it
got. A black scrim is the reflex and breaks the one light palette, so the veil is
each theme's own sky colour — right by construction. The same session,
`scripts/difficulty.mjs` (4000 rounds per ability, no browser) stopped me
retuning the rules on a hunch: my chosen knob moved only the expert's win rate.

**What those taught the harness** is
[`ee96fb8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/ee96fb8)
— five `CLAUDE.md` rules, including *`requestAnimationFrame` is a request, not a
promise* (zero frames on one viewport, ~16/s on the other, so a canvas cleared by
a resize stayed blank).

## Where to look

[`140898c...ee96fb8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/compare/140898c...ee96fb8)
is the week; the spec tests were committed red first
([`3edaa9d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-u7663394/commit/3edaa9d))
and everything after is them going green. Nothing here can tell you whether a
stranger works out the first move. The pod settles that cold, and I stay quiet.
