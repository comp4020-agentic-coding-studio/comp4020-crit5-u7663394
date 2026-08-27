# Crit 5 — A game

## The breakthrough

Planting a fault in my own game and watching the sensor pass it.

I built an unlosable version of One Button Tower — the trim clamped so no drop
can cost you everything — expecting `check:play` to go red. It went 7/7 and
reported `won after 20 moves`. My first instinct was that I had built the fault
badly. I hadn't. The check was named after a line of the spec that is a
conjunction — *a wrong move is possible, **and** play ends somewhere* — and it
only ever tested the second half. The comment above it read perfectly. The
assertions underneath covered half of what the comment claimed.

That reframed what a sensor is for me. I had been treating green as evidence and
red as information; it is the other way round. Green is evidence only about the
clauses you actually wrote down, and the gap between the sentence in a comment
and the assertions beneath it stays invisible until something you know is broken
walks through it. The habit I took away is arithmetic: count the clauses in the
claim, count the assertions, and be suspicious when they differ.

## What it changed about the developer I want to be

I want to be more interested in what a check cannot see than in whether it is
passing.

Twice this week I nearly did the wrong work confidently. I spent half an
afternoon diagnosing a blank canvas that was already fixed, because I ran the
sensor directly instead of through the `pnpm` script that builds first — every
reading consistent, plausible, and about a stale `dist/`. And I nearly retuned
the difficulty on a hunch formed watching a robot mash the button, until four
thousand simulated rounds said the curve was already right.

Neither was saved by more care. Both were saved because what I needed to measure
was cheap to measure — the rules had no DOM in them, and the throwaway took ten
minutes. That is the developer I want to be: one who makes the question cheap to
ask and then asks it, rather than reasoning harder about an answer I cannot
check.

The part no sensor here touches is the part I am least sure of. Whether a
stranger sees that opening screen and knows to press something is settled by four
people at a keyboard in about ten seconds, and I do not get to argue.
