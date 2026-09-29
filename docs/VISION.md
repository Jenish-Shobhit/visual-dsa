# Visual DSA — vision and quality bar

Visual DSA aims to be the best visual resource for learning data structures and algorithms, from "what is an algorithm?" to max-flow and P vs NP. The **picture carries the explanation**. Text points at the picture. If a paragraph describes something that moves, that thing must be on screen, animated, and controllable.

Reference points for quality: Red Blob Games (interactive explanations), Bartosz Ciechanowski (explorable figures in every section), VisuAlgo (code-synced algorithm tracing), 3Blue1Brown (motion that shows cause and effect), Distill (clear, calm layout).

## What the previous attempt got wrong

- Lessons were walls of prose with a single small figure, and ASCII-art diagrams stood in for real ones.
- Figures re-rendered on each step, so elements jumped instead of moving. You could not see *what moved where*.
- There was no code-synced tracing, no variable watch, no side-by-side comparison, no charts, no flowcharts.
- Layout bugs (a broken "explain it back" grid) and a timid visual identity.

## Non-negotiables

1. **Motion with identity.** Elements keep their identity between steps and *move* (tween) to new positions. A swap is visible as two items trading places. A pointer slides. A node flies into its slot. Colours transition.
2. **Every step is reversible.** Figures are driven by precomputed step lists (snapshots). Back, forward, scrub, play/pause, speed, restart. Keyboard: ←/→ step, Space play/pause, Home/End.
3. **Code in sync.** Every algorithm lab shows code (pseudocode and at least JavaScript or Python), highlights the executing line, and shows live variables. Each step has a plain-English caption that explains *why*, not just *what*.
4. **Your own input.** Labs accept custom input (typed values, click-to-edit, drag nodes, draw walls) plus presets: random, sorted, reversed, nearly sorted, few unique, worst case.
5. **Many visuals per lesson.** A lesson has **at least 8 distinct visual aids**: an animated hero teaser, inline figures after almost every section, at least one full code-synced lab, at least one chart (growth, operation counts, or comparison), at least one flowchart or decision diagram, memory/structure diagrams, and a comparison or "race" where it fits.
6. **Predict before reveal.** At least 3 interactive checks per lesson: "what happens next?" predictions inside a trace, multiple choice with explanations, click-the-answer on a figure.
7. **Truthful visuals.** The visual state must match the algorithm exactly on tiny, duplicate, empty, absent and adversarial inputs. A colour may only claim what is true (an element is `done` only when it is provably final). Complexity claims name the operation, the case, and the input size.
8. **Semantic colour.** The shared state vocabulary (`js/vdsa/core.js` → `VDSA.STATES`, CSS vars `--st-*` in `css/tokens.css`) means the same thing on every page. Every figure includes a small legend.
9. **Accessible.** Keyboard-operable controls, visible focus, `aria-live` captions describing each step, text alternatives for figures, `prefers-reduced-motion` respected (instant transitions), 4.5:1 text contrast, works at 390 px wide with no horizontal page scroll, light and dark themes.
10. **Static and dependency-free.** Plain HTML, CSS and JavaScript. No framework, no build step, no CDN. Everything works by opening the file or serving the folder with `python3 -m http.server`. GitHub Pages serves `main`.

## Lesson anatomy

Every lesson in `lessons/NN-slug.html` follows this spine. Sections can be merged or repeated, but not skipped.

1. **Hero**: number, unit, title, one-sentence promise, and an **animated teaser** that loops quietly (paused off-screen and under reduced motion) and shows the essence of the topic in five seconds.
2. **The problem**: a concrete, real-world need, drawn as an illustration or a small interactive. The why comes before the what.
3. **Build the intuition**: an analogy with a visual, and its limits.
4. **The mechanism, one idea per figure**: short prose paragraphs, each followed by a small figure (often steppable) that shows exactly that idea.
5. **The lab**: a large code-synced visualiser with custom input, presets, controls, code panel, variable watch, operation counters and a legend.
6. **Flowchart**: the algorithm's decision logic or a "when to use it" decision diagram, with the active node lit during the trace where possible.
7. **Cost**: operation counts on a live chart, a complexity table with Big-O badges, best/average/worst with the inputs that cause them.
8. **Variations and patterns**: common variants and interview patterns, each with a mini visual.
9. **Check yourself**: predictions and quizzes with explanations.
10. **Summary card**: a visual cheat sheet of the lesson.
11. **History note**: who discovered it and when (see `docs/research/HISTORY.md`).
12. **Practice** (3–5 problems, no solutions on the page) and **Go deeper** (link to the matching study in `studies/` when one exists).
13. **Prev / next** navigation from `js/curriculum.js`.

## Voice

- Second person, present tense, short sentences. Concrete before abstract. Numbers before symbols.
- Define a term the first time it appears, right next to a picture of it.
- One idea per paragraph. Paragraphs of 2–4 sentences. No filler, no hype, no "simply" or "just".
- Explain *why* each step happens. The caption for a step is a reason, not a restatement.

## Architecture

```
index.html                  Home: animated hero, curriculum map, labs, progress
lessons/NN-slug.html        38 lessons (registry: js/curriculum.js)
labs/*.html                 Playgrounds: sorting arena, pathfinder, graph studio, tree studio, ...
studies/*.html              24 long-form deep studies (the author's research), linked as "go deeper"
css/tokens.css              Design tokens (colours, type, spacing, motion), light and dark
css/vdsa.css                Site shell, lesson layout, components (callouts, quiz, player, code panel)
css/viz.css                 Visualisation renderer styles (.vz-*)
js/vdsa/core.js             Namespace, DOM/SVG helpers, tween/animate, theme, states, rng, parsing
js/vdsa/*.js                Shell, player, code panel, quiz, charts, flowcharts, renderers
js/algos/*.js               Pure step generators (no DOM), UMD, tested in Node
js/lessons/NN-slug.js       Lesson-specific wiring and custom figures
tests/                      node --test tests/**/*.test.js and python3 tests/site_integrity.py
docs/ENGINE.md              Engine API reference (read this before building a figure)
docs/CURRICULUM.md          Per-lesson specification
```

Algorithms are traced by **pure step generators** in `js/algos/`, which return an array of snapshot objects. Renderers draw a snapshot and animate from the previous one. The player owns time. That split makes figures reversible, testable in Node, and consistent.
