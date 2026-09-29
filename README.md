# Visual DSA

**[Open the interactive guide](https://jenish-shobhit.github.io/visual-dsa/)**

Visual DSA teaches data structures and algorithms by letting you watch them work. Every lesson is built around animated, step-through figures: items glide instead of jumping, pointers slide, trees rotate, graphs light up in waves. Every algorithm lab can run backwards, takes your own input, highlights the running line of code in pseudocode, JavaScript and Python, and stops to ask you to predict the next step.

The course runs from "what is an algorithm?" to max-flow, NP-completeness and randomized algorithms: **38 lessons in 7 units**, plus playground labs, a history timeline and 24 long-form deep studies.

## What a lesson looks like

- An animated hero that shows the idea in five seconds.
- A concrete problem, an analogy, then one small figure per idea.
- A full **code-synced lab**: custom input and presets, step/play/scrub/speed, a variable watch, operation counters, a legend, and prediction checkpoints.
- A **flowchart** lit up as the lab runs, **charts** of measured cost, comparisons and races between algorithms.
- Quizzes with per-option explanations, a visual summary card, a history note, practice problems, and a link to the matching deep study.

## The course


### Unit 1 · How computers think

Algorithms, bits, memory, control flow, the call stack, and how to measure work.

| # | Lesson | |
|---:|---|---|
| 01 | [What is an algorithm?](lessons/01-algorithms.html) | Precise steps, a changing state, and a flowchart you can follow. |
| 02 | [Bits, bytes & memory](lessons/02-bits-and-memory.html) | How a machine stores numbers, text and variables in addressed cells. |
| 03 | [Decisions & loops](lessons/03-control-flow.html) | Branches choose, loops repeat, and every loop must make progress. |
| 04 | [Functions & the call stack](lessons/04-functions-and-the-stack.html) | Stack frames, the heap, references, and what happens on return. |
| 05 | [Complexity & Big-O](lessons/05-big-o.html) | Count the work as input grows: constant, log, linear, n log n, quadratic, exponential. |

### Unit 2 · Linear structures

Arrays, strings, linked lists, stacks, queues and hash tables — data in a line.

| # | Lesson | |
|---:|---|---|
| 06 | [Arrays & dynamic arrays](lessons/06-arrays.html) | Contiguous memory, O(1) indexing, shifting costs, and doubling growth. |
| 07 | [Strings, two pointers & windows](lessons/07-strings-and-two-pointers.html) | Characters in a row, and the patterns that scan them in one pass. |
| 08 | [Linked lists](lessons/08-linked-lists.html) | Nodes and next-pointers: insert, delete, reverse, and detect cycles. |
| 09 | [Stacks](lessons/09-stacks.html) | Last in, first out: undo, brackets, expressions and monotonic stacks. |
| 10 | [Queues & deques](lessons/10-queues.html) | First in, first out: circular buffers, deques and waiting lines. |
| 11 | [Hash tables](lessons/11-hash-tables.html) | Turn a key into an address: hashing, collisions, probing and resizing. |

### Unit 3 · Searching & sorting

Recursion, binary search and every classic way to put things in order.

| # | Lesson | |
|---:|---|---|
| 12 | [Recursion](lessons/12-recursion.html) | A function that calls itself: base cases, the call stack and recursion trees. |
| 13 | [Binary search](lessons/13-binary-search.html) | Halve the search space every step — on arrays and on answers. |
| 14 | [Bubble, selection & insertion sort](lessons/14-elementary-sorts.html) | Three simple sorts, three invariants, and why they are quadratic. |
| 15 | [Merge sort & divide and conquer](lessons/15-merge-sort.html) | Split, sort the halves, merge — and the recursion tree that proves n log n. |
| 16 | [Quick sort & quickselect](lessons/16-quick-sort.html) | Partition around a pivot; why pivot choice decides everything. |
| 17 | [Counting, radix & the n log n barrier](lessons/17-linear-time-sorts.html) | Sorting without comparisons, and why comparisons can’t beat n log n. |

### Unit 4 · Trees

Hierarchies that make search, priority, prefixes and ranges fast.

| # | Lesson | |
|---:|---|---|
| 18 | [Trees & traversals](lessons/18-trees.html) | Roots, children, height — and four ways to walk every node. |
| 19 | [Binary search trees](lessons/19-binary-search-trees.html) | Left is smaller, right is larger: search, insert, delete. |
| 20 | [Balanced trees: AVL & red-black](lessons/20-balanced-trees.html) | Rotations that keep height logarithmic no matter the input order. |
| 21 | [Heaps & priority queues](lessons/21-heaps.html) | A tree in an array that always knows its smallest item — and heap sort. |
| 22 | [Tries](lessons/22-tries.html) | A tree of characters for prefixes, autocomplete and dictionaries. |
| 23 | [Segment & Fenwick trees](lessons/23-segment-and-fenwick-trees.html) | Answer range queries and updates in logarithmic time. |
| 24 | [Union-find](lessons/24-union-find.html) | Disjoint sets with path compression and union by rank. |

### Unit 5 · Graphs

Networks: traversal, ordering, shortest paths, spanning trees and flow.

| # | Lesson | |
|---:|---|---|
| 25 | [Graphs & representations](lessons/25-graphs.html) | Vertices, edges, directions, weights — as matrices and lists. |
| 26 | [BFS & DFS](lessons/26-bfs-and-dfs.html) | Two ways to explore: a queue spreads in waves, a stack dives deep. |
| 27 | [Topological sort & cycles](lessons/27-topological-sort.html) | Order tasks by dependency; detect cycles; find strongly connected parts. |
| 28 | [Dijkstra & A*](lessons/28-dijkstra-and-a-star.html) | Shortest paths with a priority queue, and a heuristic that aims. |
| 29 | [Bellman-Ford & Floyd-Warshall](lessons/29-bellman-ford-and-floyd-warshall.html) | Negative edges, negative cycles, and all-pairs distances. |
| 30 | [Minimum spanning trees](lessons/30-minimum-spanning-trees.html) | Connect everything cheaply: Kruskal, Prim and the cut property. |
| 31 | [Max flow & min cut](lessons/31-network-flow.html) | Push flow through pipes; the bottleneck cut that limits it. |

### Unit 6 · Design paradigms

Greedy choices, backtracking, dynamic programming and string matching.

| # | Lesson | |
|---:|---|---|
| 32 | [Greedy algorithms](lessons/32-greedy.html) | Take the best-looking choice — and prove when that is safe. |
| 33 | [Backtracking](lessons/33-backtracking.html) | Try, recurse, undo: N-Queens, subsets, permutations and Sudoku. |
| 34 | [Dynamic programming I](lessons/34-dynamic-programming.html) | Overlapping subproblems: memoization, tabulation and the subproblem DAG. |
| 35 | [Dynamic programming II](lessons/35-dynamic-programming-2d.html) | Grids of subproblems: LCS, edit distance and knapsack. |
| 36 | [String matching](lessons/36-string-matching.html) | Find a pattern fast: KMP, Rabin–Karp and the Z-algorithm. |

### Unit 7 · Limits & frontiers

What cannot be computed quickly — and how randomness helps anyway.

| # | Lesson | |
|---:|---|---|
| 37 | [P, NP & hard problems](lessons/37-p-vs-np.html) | Easy to check, hard to find: reductions, NP-completeness, approximation. |
| 38 | [Randomized algorithms](lessons/38-randomized-algorithms.html) | Coin flips as a tool: skip lists, Bloom filters, sampling and Monte Carlo. |

## Labs

- [Sorting arena](labs/sorting-arena.html): Race every sorting algorithm on the same input.
- [Pathfinder](labs/pathfinder.html): Draw walls, then watch BFS, DFS, Dijkstra and A* search a grid.
- [Graph studio](labs/graph-studio.html): Build any graph and run traversals, shortest paths and MSTs on it.
- [Tree studio](labs/tree-studio.html): Insert and delete in BSTs, AVL trees, red-black trees and heaps.
- [Big-O explorer](labs/big-o-explorer.html): See growth rates side by side and feel what n² really means.
- [Which structure?](labs/structure-chooser.html): A flowchart that helps you pick the right data structure.
- [A history of algorithms](labs/history.html): From Euclid to Dijkstra: who discovered what, and why.
- [Complexity cheat sheet](labs/cheatsheet.html): Every structure and algorithm, every cost, on one page.
- [Instruction machine](labs/code-machine.html): Watch fetch, decode and execute inside a tiny 8-bit computer.

The [deep studies](studies/index.html) are 24 long-form lectures with proofs and derivations, from cost models and amortization to flow, string matching, hardness and randomness. Each lesson links to the study that goes deeper.

## Run locally

It is a static site: plain HTML, CSS and JavaScript, with no framework, build step, package install or network requests. Open `index.html`, or serve the folder:

```sh
python3 -m http.server 8765   # then open http://127.0.0.1:8765/
```

Progress (visited and completed lessons, quiz scores, theme) is stored only in your browser's localStorage.

## How it is built

| Path | What it holds |
|---|---|
| `js/curriculum.js` | The registry of units, lessons and labs; navigation, the home map and progress all read it. |
| `js/vdsa/` | The engine: core helpers and animation, page shell, step player, code panel, variable watch, quizzes, widgets. |
| `js/vdsa/views/` | Keyed snapshot renderers: array, tree, graph, grid, linked list, stack/queue/deque/ring, hash table, memory, call stack, chart, flowchart. |
| `js/algos/` | Pure step generators for every algorithm (no DOM), tested in Node. |
| `js/lessons/`, `css/lessons/` | Per-lesson wiring and custom figures. |
| `lessons/`, `labs/`, `studies/` | Pages. Old `chapters/` URLs redirect to their new lessons. |
| `dev/gallery.html` | Live demos of every renderer; `dev/selftest.html` checks that every animated step settles to the same picture as an instant render. |

Read [docs/VISION.md](docs/VISION.md) for the quality bar, [docs/CURRICULUM.md](docs/CURRICULUM.md) for each lesson's specification, and [docs/ENGINE.md](docs/ENGINE.md) for the engine and renderer API.

## Tests

```sh
node --test tests/*.test.js 'tests/**/*.test.js'   # step generators, engine, renderers, data
python3 tests/site_integrity.py                     # links, anchors, ids, lessons vs curriculum
```

Every step generator is checked against a straightforward reference implementation on random and edge-case inputs, and the visual states are checked to be truthful (for example, an element is only marked final once it is provably final).

## Sources

The lessons, figures and code are original to this project. The pedagogy was informed by Charles Petzold's *Code*, the Arpaci-Dusseaus' *Operating Systems: Three Easy Pieces*, and Robert C. Martin's *We, Programmers* (history), without reproducing their text or figures; see [docs/SOURCES.md](docs/SOURCES.md) and [docs/research/HISTORY.md](docs/research/HISTORY.md). The deep studies are adapted from the author's own lecture notes. If a figure, proof or edge case is wrong, please open an issue with the lesson and the input that reproduces it.

MIT License · Copyright © 2026 Jenish Shobhit.
