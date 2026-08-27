# Crit 5 — A game

## What was the breakthrough that moved the work forward?

The breakthrough was when I added a bug to the game and found that the test still passed. I made a version of One Button Tower where the player could not lose. I expected check:play to fail, but it still passed 7/7 and said won after 20 moves. Then I found the real problem: my test only checked whether the game could finish, but did not check whether the player could actually lose.

This helped me understand automated tests better. A green test only proves the things that the test actually checks. Even if the test name and comments look correct, some important rules may still be missing. Now I think I should check each requirement carefully and make sure every important part has a real assertion.

## What did this work change about who I want to be as a software developer?

This work made me want to become a developer who checks things with real evidence instead of trusting my first guess. This week, I spent a long time trying to fix a blank canvas that was already fixed because I tested an old build. These experiences showed me that guessing can waste a lot of time. When possible, I should find a simple way to test my idea and use the result to make decisions. However, automated tests cannot check everything. For example, only real players can tell me whether the game is easy to understand. I want to use both automated tests and real user feedback in my future work.
