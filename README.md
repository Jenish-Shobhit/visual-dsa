# Visual DSA

**[Open the interactive guide](https://jenish-shobhit.github.io/visual-dsa/)**

Visual DSA teaches data structures and algorithms from a starting point of zero. The guided path begins with a single instruction changing state, then earns loops, references, sequences, correctness, complexity, structures, graph search, and dynamic programming. Every guided lesson has a trace you can step backward through, a question to predict, and unsolved practice. A separate collection of 24 long-form studies develops proofs, advanced structures, algorithm design, and computational limits.

It is for first-time programmers, visual learners, and experienced programmers who want to understand *why* an algorithm works rather than memorize a template.

## Guided path

| # | Lesson | Status |
|---:|---|---|
| 01 | [What is code?](chapters/01-what-is-code.html) | Live |
| 02 | [Memory and variables](chapters/02-memory-and-variables.html) | Live |
| 03 | [Decisions and loops](chapters/04-decisions-and-loops.html) | Live |
| 04 | [Functions and references](chapters/05-functions-and-references.html) | Live |
| 05 | [Arrays and strings](chapters/03-arrays-and-strings.html) | Live |
| 06 | [How to reason](chapters/06-how-to-reason.html) | Live |
| 07 | [Complexity](chapters/04-complexity.html) | Live |
| 08 | [Sorting](chapters/05-sorting.html) | Live · six methods |
| 09 | [Searching](chapters/06-searching.html) | Live |
| 10 | [Linked lists](chapters/07-linked-lists.html) | Live |
| 11 | [Stacks and queues](chapters/08-stacks-and-queues.html) | Live |
| 12 | [Hashing](chapters/09-hashing.html) | Live |
| 13 | [Recursion](chapters/10-recursion.html) | Live |
| 14 | [Trees](chapters/11-trees.html) | Live |
| 15 | [Heaps](chapters/12-heaps.html) | Live |
| 16 | [Graphs](chapters/13-graphs.html) | Live |
| 17 | [Dynamic programming](chapters/14-dynamic-programming.html) | Live |

Continue with the [24 deep studies](studies/index.html), from cost models and amortization to balanced trees, range queries, shortest paths, greedy proofs, flow, string matching, hardness, approximation, and randomness. The [instruction machine](labs/code-machine.html) traces fetch, decode, and execution in an explicitly defined 8-bit model. The [graph route explorer](labs/graph-explorer.html) compares fewest-edge and least-weight paths on the same graph.

The [curriculum plan](docs/PLAN.md) states the one idea, dependency, figure, and practice for every guided lesson.

## Run locally

Open `index.html` in a browser. This is a static site: no account, framework, external JavaScript or CSS, package installation, or build step. A local server is convenient for testing all pages: `python3 -m http.server 8765`, then open `http://127.0.0.1:8765/`. GitHub Pages serves the same files from the root of `main`.

The guide stores visited lesson filenames and the most recently opened lesson in the browser's local storage, so the home page can mark places you have opened and resume your reading. No learner input is sent anywhere.

## Design and code rules

- Examples come before terminology; each figure exposes the changing state and supports reversal.
- The navy workspace, light reading canvas, and semantic action colors are implemented in `css/atlas.css`; the overview uses `css/home.css`. Search, chapter navigation, and local reading progress share `js/catalogue.js` and `js/site-shell.js`.
- `js/figure.js` is the shared timeline: reversible steps, playback speed, keyboard navigation, state transitions, and reduced motion. Sorting items preserve identity while moving. All lessons and studies remain static HTML, CSS, and JavaScript; the original six sorting methods are preserved and tested.

See [redesign notes](docs/REDESIGN.md) for the new learning workspace and validation commands.

## Sources and contribution

The long-form studies were adapted from the author's local DSA lecture notes. Published books in the same study library informed the pedagogy; their text and figures were not copied into this repository. See [sources and scope](docs/SOURCES.md), the [24-study resource audit](docs/RESOURCE-AUDIT.md), and the [foundations and books audit](docs/FOUNDATIONS-AUDIT.md). The audits distinguish close reading from chapter inventories and sampled book review. If a proof, edge case, visual state, or accessibility behavior is wrong, please open an issue with the exact lesson and input that reproduces it.

MIT License · Copyright © 2026 Jenish Shobhit.
