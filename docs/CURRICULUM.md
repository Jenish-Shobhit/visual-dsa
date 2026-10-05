# Visual DSA — lesson specifications

Each lesson below lists its **big idea**, the **concepts** it must teach (in order), the **visuals** it must contain, **checks** for understanding, **edge cases** the visuals must get right, and **sources**. The visual lists are minimums. Lesson authors should add more wherever a picture helps. Read `docs/VISION.md` for the quality bar and lesson anatomy, and `docs/ENGINE.md` for the engine API.

Legend for visuals: **T** hero teaser (looping, silent) · **F** inline figure (small, often steppable) · **L** full code-synced lab · **C** chart · **D** flowchart / decision diagram · **X** comparison or race · **I** illustration/analogy.

Sources: `studies/dsa-NN-*.html` are the author's own deep lecture notes (use their examples, invariants, proofs and exercises; they are the "go deeper" link). `docs/reading/*.md` are reading notes on Petzold's *Code*, *OSTEP*, and *We, Programmers*. `docs/research/HISTORY.md` holds history notes per lesson.

---

## Unit 1 — How computers think

### 01 · What is an algorithm?
**Big idea:** an algorithm is a finite list of precise, unambiguous steps that transforms an input into an output; running it means a *state* changing one step at a time.
**Concepts:** recipe vs algorithm (ambiguity); input → steps → output; state and the "next step" pointer; sequence, choice, repetition as the three building blocks; correctness (right for every valid input) and termination; efficiency preview (two algorithms, same answer, different work).
**Visuals:**
- T: a row of face-down cards being scanned by a pointer; a "largest so far" marker hops up whenever a bigger card flips.
- I: an ambiguous recipe ("add some salt, cook until done") vs an exact one; ambiguous words highlight and ask "how much?".
- F: "Be the computer" — find the largest of 7 cards; learner clicks cards to flip; a step counter and the "largest so far" box update; then autoplay the same algorithm and compare.
- D: flowchart of find-max (start → take first → more cards? → bigger? → update → next → output) with a travelling token synced to the card figure.
- L: find-max lab with code panel (pseudo/JS/Python), variable watch, custom input, presets (sorted, reversed, all equal, single card).
- X: guess-my-number race — "count up from 1" vs "halve the range" on the same secret number; animated step counters; bar chart of steps for secrets 1..100.
- C: steps vs n for both guessing strategies (linear vs log).
- F: the three building blocks as tiny animated flowchart fragments (sequence, if, loop).
- F: Euclid's GCD with rectangles: a w×h rectangle repeatedly cut into squares; the last square size is the GCD. Steppable, custom w/h.
**Checks:** predict the output of find-max on a given row; which recipe step is ambiguous (click it); how many steps halving needs for 1..1000.
**Edge cases:** one card, all equal cards, negative numbers.
**Sources:** `docs/reading/CODE.md`, `docs/reading/PROGRAMMERS.md`, old `chapters/01-what-is-code.html` (for ideas only), `labs/code-machine.html` (link it as "see a real CPU do this").

### 02 · Bits, bytes & memory
**Big idea:** a computer stores everything as bits in numbered memory cells; *meaning* comes from an agreed interpretation, and a variable is a name for a location.
**Concepts:** bits as two-state switches; counting in binary (place value, powers of two); n bits → 2ⁿ patterns; bytes and hexadecimal; the same byte read as a number, a character (ASCII) or a colour; negative numbers with two's complement and overflow (fixed width); memory as a long row of addressed bytes; variables = name → address; multi-byte values (an int takes 4 bytes); why array indexing is address arithmetic (preview).
**Visuals:**
- T: a row of 8 light-bulb bits counting upward in binary, decimal value ticking beside.
- F: interactive bit toggles (8 switches) → live decimal, hex, ASCII char, and a colour swatch; place-value labels 128…1 light up.
- F: binary counter odometer — watch carries ripple as it counts; speed slider.
- F: decision tree showing how 1, 2, 3 bits double the number of patterns (2, 4, 8 leaves).
- F: two's complement number wheel (4-bit circle 0000…1111 with signed and unsigned labels); click +1 repeatedly to see overflow wrap from 7 to −8.
- F: binary addition with carries, column by column (steppable), including overflow of an 8-bit add.
- L: memory lab — a grid of addressed cells (hex addresses); run a tiny program (`int a = 5; int b = a; b = b + 1; char c = 'A';`) and watch cells get allocated, labelled with names, written; code panel synced.
- I: "a byte doesn't know what it means": the same 4 bytes shown as an int, 4 chars, and an RGBA colour.
- C: 2ⁿ growth bar chart (how many values fit in n bits: 8→256, 16→65,536, 32→4.29 billion).
**Checks:** set switches to make 42; what does 1111 1111 mean as unsigned vs signed; which address does `arr[3]` live at if `arr` starts at 0x100 with 4-byte ints.
**Edge cases:** overflow at 255/127, the asymmetric range −128..127.
**Sources:** `docs/reading/CODE.md` (Petzold chapters on binary, bytes, ASCII, two's complement, memory), `studies/dsa-00-cost-of-a-computation.html` (RAM model), `docs/reading/OSTEP-EARLY.md`.

### 03 · Decisions & loops
**Big idea:** conditions choose which instruction runs next; loops repeat work until a condition becomes false, and every loop needs a variable that makes progress toward stopping.
**Concepts:** boolean expressions and comparisons; if / else-if / else; truth tables for AND/OR/NOT; while loops, for loops, loop variable, off-by-one errors, infinite loops and progress; nested loops (a grid of iterations — preview of n²); break/continue; tracing tables.
**Visuals:**
- T: a flowchart with a glowing token circling a loop, a counter incrementing, then exiting.
- F: truth-table explorer for AND/OR/NOT with toggle inputs and a light-bulb output (tie to Petzold's switches in series/parallel).
- F: "traffic-light" if/else: slider for a value, the taken branch lights up in the flowchart.
- L: loop tracer — editable small loop (`for i from 1 to n: total += i`), code panel, trace table filling row by row, variable watch, flowchart token synced.
- F: off-by-one visual — `<` vs `<=` on a row of fence posts/boxes; the extra or missing iteration flashes.
- F: infinite loop detector — a loop whose variable doesn't progress; a "fuel gauge" empties; learner fixes it by choosing the right update.
- F: nested loops as a grid: every (i, j) cell lights in order; count = n × m; triangle variant for j > i.
- D: FizzBuzz flowchart with the active branch lit as numbers stream through.
- C: iterations vs n for single loop vs nested loop.
**Checks:** predict how many times a loop body runs; spot the off-by-one; which update guarantees termination.
**Edge cases:** zero iterations (n = 0), negative ranges.
**Sources:** `docs/reading/CODE.md` (logic with switches, loops/jumps), old `chapters/04-decisions-and-loops.html`, `chapters/06-how-to-reason.html` (loop invariants — include a short "loop invariant" callout).

### 04 · Functions & the call stack
**Big idea:** a call pauses the caller, pushes a new frame with its own local variables, and returns a value; objects live on the heap and variables may hold references to them.
**Concepts:** function definition vs call; parameters vs arguments; return values; the call stack (frames, return address); local scope; nested calls; value vs reference (copying a number vs copying a reference to an array); mutation through a reference; the heap; stack overflow (preview of recursion); pure functions vs side effects.
**Visuals:**
- T: frames stacking up and popping like plates while arrows point into a heap.
- L: call-stack lab — program with `main → area(w,h) → multiply(a,b)`; stack frames push/pop, locals appear, return value flies back to the caller's variable; code panel synced with the executing line; memory view (stack + heap).
- F: value vs reference side by side: `a = 5; b = a; b++` vs `xs = [1,2]; ys = xs; ys.push(3)`; arrows from names to heap objects; predict first.
- F: pass-by-value vs pass-a-reference into a function; mutation visible through both names; rebinding breaks the link.
- F: scope bubbles — nested boxes showing which names are visible where.
- F: stack overflow — a runaway function pushing frames until the stack region hits its limit (red), tied to memory layout (stack grows toward heap).
- I: OSTEP-style process memory layout (code, globals, heap growing up, stack growing down) — interactive: hover each region.
- D: "what happens on a call" flowchart (evaluate args → push frame → bind params → run body → return value → pop frame → resume caller).
**Checks:** predict printed values in the reference example; how many frames exist at the deepest point; which variables survive the return.
**Sources:** `docs/reading/CODE.md` (calls, return addresses on a stack), `docs/reading/OSTEP-EARLY.md` (address space), old `chapters/05-functions-and-references.html`.

### 05 · Complexity & Big-O
**Big idea:** measure an algorithm by how its step count grows with input size; Big-O keeps the growth rate and drops constants and small terms.
**Concepts:** counting basic operations; why wall-clock time is a poor measure; growth rates: O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ), O(n!); dominant terms and dropping constants; best/average/worst case (linear search example); space complexity; the doubling experiment (what happens when n doubles); amortized preview; Ω and Θ intuition; practical sizes (what n is feasible in 1 second for each class).
**Visuals:**
- T: seven growth curves racing up a chart, n² and 2ⁿ shooting off the top.
- F: operation counter — code snippets (single loop, nested loop, halving loop, constant) run on a slider n; ops counter animates and a dot is plotted.
- C: interactive growth chart — toggle curves, linear/log y-axis, hover to read values; slider for n up to 10⁶.
- X: "the doubling game": double n and watch each class's work multiply (×1, +1, ×2, ×2+, ×4, squared); animated bars.
- F: dropping constants — 3n + 5 vs n: zoom out and the lines become parallel on a log scale; slider for constants.
- F: best/average/worst case for linear search — target at front, random, absent; histogram of comparisons over all positions.
- F: "feasibility table": if a computer does 10⁸ ops/s, the largest n solvable in 1s for each class — animated table and a timeline bar (1 second vs universe age for 2¹⁰⁰).
- L: count-the-steps lab — choose one of 6 algorithms (find max, pair sum brute force, binary search, bubble sort, subset enumeration, merge sort), run on n from a slider, step through with code panel and an ops counter; plot measured ops against the theoretical curve.
- D: "how to find the Big-O of code" decision flowchart (loops? nested? halving? recursion?).
**Checks:** match 6 snippets to their Big-O (drag or click); which grows faster at n = 1000; what happens to O(n²) work when n triples.
**Sources:** `studies/dsa-00-cost-of-a-computation.html`, `studies/dsa-02-amortized-cost-aggregate-accounting-potential.html` (amortized preview), `studies/dsa-03-divide-solve-combine.html` (recurrence preview).

## Unit 2 — Linear structures

### 06 · Arrays & dynamic arrays
**Big idea:** an array stores items contiguously, so any index is one address calculation away (O(1)); inserting in the middle shifts everything; dynamic arrays double their capacity so appends are O(1) amortized.
**Concepts:** contiguous memory; `address = base + i × size`; O(1) read/write by index; linear search; insert/delete at index with shifting (O(n)); append at end; fixed capacity problem; dynamic array growth by doubling, copying cost, amortized analysis (aggregate / bank-account intuition); shrinking policy (halve at 1/4, avoid thrashing); 2D arrays (row-major); cache locality intuition.
**Visuals:**
- T: boxes sliding right to make room as a new value drops into the middle.
- F: address calculator — memory strip with base address; click an index, the arithmetic animates and the pointer jumps directly (vs walking).
- L: array operations lab — insert at i, delete at i, append, read, search; shifting animation; ops counter; code panel.
- F: dynamic array growth — append repeatedly: when full, a new array twice as big appears, items fly across, old one fades. Capacity/size meters.
- C: cost per append (spikes at powers of two) + running average line flattening at ~3 — the amortized picture.
- F: bank-account (accounting method) coins: each append deposits 3 coins, copying spends them; the balance never goes negative.
- F: grow-by-1 vs grow-by-double race — total copies chart (quadratic vs linear).
- F: 2D array → row-major memory strip mapping; click a cell, see its linear address.
- X: array vs linked list access race (preview): reading index 7 — one jump vs seven hops.
**Checks:** address of `a[5]`; cost of inserting at index 0 of 1,000 items; total copies after 17 appends with doubling.
**Sources:** `studies/dsa-01-linear-layouts-and-access-disciplines.html`, `studies/dsa-02-amortized-cost-aggregate-accounting-potential.html`.

### 07 · Strings, two pointers & sliding windows
**Big idea:** a string is an array of characters; many string and array problems become one pass with two indices that move with purpose.
**Concepts:** characters and encodings (ASCII/Unicode, code units vs visible characters — brief); immutability and the cost of repeated concatenation; reversing; palindrome check (two pointers from both ends); two-sum on a sorted array (converging pointers); removing duplicates in place (read/write pointers); sliding window — fixed size (max sum of k) and variable size (longest substring without repeats); prefix sums for range sums; anagram check with frequency counts.
**Visuals:**
- T: two pointers converging on a palindrome, letters lighting green in matched pairs.
- F: string as a character array with indices and char codes; concatenation in a loop copying everything each time (animated growth + ops counter).
- L: two-pointer lab with tabs: palindrome, two-sum sorted, reverse in place, remove duplicates — code synced, pointer arrows, captions.
- L: sliding-window lab — fixed-k max sum and longest substring without repeating characters: window bracket expands/contracts, character-count table, best-so-far marker.
- F: brute force O(n²) vs two pointers O(n) race on two-sum: every pair checked lights a grid cell vs one diagonal walk through the grid (the "pair grid" picture that shows why pointer moves discard whole rows/columns).
- F: prefix sums — build the prefix array, then answer a range query as a difference of two bars.
- F: anagram frequency histograms side by side.
- D: "which pattern?" decision flowchart (sorted + pair? → converging; contiguous subarray? → window; range sums? → prefix).
- C: ops vs n for brute force vs two pointers.
**Checks:** predict the next pointer move in two-sum; window after the next character; prefix-sum query answer.
**Edge cases:** empty string, single char, all same chars, no valid pair.
**Sources:** `studies/dsa-01-linear-layouts-and-access-disciplines.html`, old `chapters/03-arrays-and-strings.html` (UTF-16 note).

### 08 · Linked lists
**Big idea:** a linked list stores order in pointers instead of positions: O(1) insertion when you hold the right node, O(n) to reach the i-th item.
**Concepts:** node = value + next; head, tail, null; traversal; insert at head, after a node, at tail (with/without tail pointer); delete (the "keep your grip" order of pointer updates); doubly linked lists; sentinel/dummy nodes; circular lists; reversal (prev/curr/next); fast & slow pointers: middle node, Floyd cycle detection (and why they meet); array vs linked list trade-offs (memory scattered, cache).
**Visuals:**
- T: a list reversing itself, arrows flipping one by one.
- I: scavenger hunt analogy — each clue points to the next location; memory view with nodes scattered at random addresses and arrows linking them.
- L: linked-list operations lab — insert head/tail/at index, delete value, search; arrows re-route smoothly; pointer labels (head, curr, prev); code panel.
- F: "wrong order loses the tail" — do the insertion steps in the wrong order and watch the rest of the list float away (disconnected, greyed), then the right order.
- L: reversal lab — prev/curr/next pointers, each arrow flip animated, code synced.
- F: Floyd's tortoise and hare on a list with a cycle; distances labelled; meeting point; then find cycle start.
- F: doubly linked list insert/delete with both arrows.
- X: array vs linked list comparison table with mini animations per operation (access, insert front, insert middle, append, memory).
- C: time for "access i-th" and "insert at front" as n grows, array vs list.
**Checks:** which pointer to update first; where tortoise and hare meet for a given list; cost to delete the tail of a singly linked list.
**Edge cases:** empty list, single node, delete head, delete absent value, cycle at head, cycle of length 1.
**Sources:** `studies/dsa-01-linear-layouts-and-access-disciplines.html`, old `chapters/07-linked-lists.html`.

### 09 · Stacks
**Big idea:** restricting access to one end (last in, first out) makes a stack perfect for undo, nesting and "most recent unfinished thing".
**Concepts:** push, pop, peek, isEmpty — all O(1); array-backed vs linked stack; the call stack connection; balanced brackets; evaluating postfix expressions; infix → postfix (shunting-yard, simplified); undo/redo with two stacks; monotonic stack (next greater element, daily temperatures); browser back/forward.
**Visuals:**
- T: plates dropping onto a stack and lifting off.
- F: stack playground — push/pop/peek buttons with random values; overflow/underflow states for a fixed-capacity array stack.
- L: bracket matcher — type an expression; each opener pushes, each closer pops and matches (green) or fails (red); code synced.
- L: postfix evaluator — tokens stream in; numbers pushed, operators pop two and push the result; an expression tree builds alongside.
- F: shunting-yard mini (operators waiting on a stack by precedence).
- F: undo/redo with two stacks in a tiny drawing/text editor.
- L: monotonic stack — next greater element: bars, stack of indices, arrows drawn from each element to its answer as it's popped.
- D: "does this problem want a stack?" decision flowchart (nesting? most recent? reverse order? next greater?).
**Checks:** predict the stack after a sequence; is `([)]` balanced and where does it fail; postfix result.
**Edge cases:** pop on empty, unmatched closer, leftover openers.
**Sources:** `studies/dsa-01-linear-layouts-and-access-disciplines.html`, old `chapters/08-stacks-and-queues.html`.

### 10 · Queues & deques
**Big idea:** first in, first out preserves arrival order; a circular buffer makes both ends O(1) in a fixed array; a deque allows both ends.
**Concepts:** enqueue, dequeue, front — O(1); why a naive array queue is O(n) (shifting) or wastes space; circular buffer (head/tail modulo capacity, full vs empty); linked queue; deque; priority queue preview (link to heaps); real uses: printer jobs, BFS, buffering, rate limiting; sliding window maximum with a monotonic deque.
**Visuals:**
- T: people/items flowing through a ticket line.
- F: naive array queue shifting on every dequeue (ops counter climbing) vs moving front index (wasted slots grey).
- L: circular buffer lab — ring view and flat array view side by side, head/tail pointers, wrap-around, full/empty detection; code synced.
- F: deque with pushes/pops at both ends.
- L: sliding window maximum with a monotonic deque — window over bars, deque contents, evictions animated.
- X: stack vs queue on the same arrival sequence — same inputs, different removal order (side by side).
- F: BFS preview — a queue feeding a small grid flood fill.
- C: cost per dequeue: shifting array vs circular buffer as n grows.
**Checks:** head/tail after a sequence of ops on capacity 5; is the buffer full or empty when head == tail; which structure for undo vs printer queue.
**Sources:** `studies/dsa-01-linear-layouts-and-access-disciplines.html`, old `chapters/08-stacks-and-queues.html`.

### 11 · Hash tables
**Big idea:** a hash function turns a key into an array index, giving expected O(1) insert/lookup/delete; collisions are inevitable and must be handled; resizing keeps the load factor low.
**Concepts:** direct addressing and why it fails for big key spaces; hash functions (mod m for ints; polynomial string hashing), uniformity, determinism; pigeonhole → collisions; birthday paradox; separate chaining; open addressing: linear probing (clustering), quadratic, double hashing; deletion with tombstones; load factor α and expected probe counts; resizing and rehashing (amortized O(1)); hash sets and maps in practice; worst case O(n).
**Visuals:**
- T: keys flying through a hash-function box into buckets.
- F: hash function machine — type a word; watch character codes combine into a number, then mod m picks a bucket.
- L: chaining lab — insert/search/delete; chains grow; load factor meter; code synced.
- L: open addressing lab — linear/quadratic/double hashing tabs; probe sequence animated; clusters highlighted; tombstones for deletes; resize button and auto-resize at α > 0.7 with rehash animation.
- F: birthday paradox simulator — throw random keys into 365 buckets until the first collision; histogram over many runs.
- C: expected probes vs load factor (chaining vs linear probing) with measured points from simulation.
- F: bad hash function (e.g. first letter) → all keys pile into few buckets vs a good hash spreading evenly (bucket histogram).
- F: delete without tombstone breaks a later search — show the failure, then fix with a tombstone.
- D: "set, map, sorted structure, or array?" decision flowchart.
**Checks:** bucket for a given key and m; where linear probing places a colliding key; why deleting without a tombstone breaks search.
**Sources:** `studies/dsa-08-hashing-and-expected-constant-access.html`, `studies/dsa-05-probability-for-algorithms.html` (birthday bound), old `chapters/09-hashing.html`.

## Unit 3 — Searching & sorting

### 12 · Recursion
**Big idea:** a recursive function solves a problem by trusting a smaller copy of itself; a base case stops the descent; the call stack remembers where each call is waiting.
**Concepts:** base case + recursive case; the "leap of faith"; call stack growth and unwinding; factorial and sum of a list; recursion tree; Fibonacci's exponential blow-up and repeated subproblems (memoization preview); Tower of Hanoi (2ⁿ − 1 moves); recursion vs iteration; stack overflow; tail recursion mention; recursive thinking on strings (reverse, palindrome) and arrays (binary search preview).
**Visuals:**
- T: nested Russian-doll frames opening then closing with return values bubbling up.
- L: recursion lab — choose factorial / sum / power / reverse string; call stack view + code panel + return values flying back; step both descending and unwinding.
- F: recursion tree for fib(n) — nodes appear in call order, repeated subproblems share a colour; count of calls vs n chart.
- C: calls for naive fib(n) vs memoized (exponential vs linear), log scale.
- L: Tower of Hanoi — animated discs (n = 1..7), move counter, recursion tree of subproblems in sync, and the "solve n−1, move 1, solve n−1" decomposition highlighted.
- F: missing base case → infinite descent until stack overflow (red).
- D: "writing a recursive function" flowchart (base case? → shrink → combine).
- F: recursion as fractal — a recursive tree drawing where depth is a slider (fun visual for self-similarity).
**Checks:** predict the return value; how many calls fib(5) makes; minimum moves for 5 discs.
**Sources:** `studies/dsa-03-divide-solve-combine.html`, old `chapters/10-recursion.html`.

### 13 · Binary search
**Big idea:** in sorted data, each comparison with the middle discards half of what remains, so search takes O(log n); the same idea finds boundaries and answers.
**Concepts:** linear search baseline; sorted precondition; lo/hi/mid; loop invariant (target, if present, is in [lo, hi]); termination; overflow-safe mid; lower bound / upper bound (first ≥ x, first > x); finding first/last occurrence; search insert position; binary search on the answer (monotonic predicate — e.g. smallest capacity to ship packages in D days, or integer square root); bisection on a function.
**Visuals:**
- T: a sorted row where half the boxes dim at each step until one remains.
- F: guess-the-number game (1–100) with a live halving range bar; learner plays, then the algorithm plays.
- L: binary search lab — sorted array (custom or generated up to 64), target, lo/mid/hi pointers sliding, discarded regions dim, invariant callout, code synced; variants tab: exact, lower bound, upper bound, first/last occurrence.
- X: linear vs binary search race on 1,000 items with comparison counters.
- C: comparisons vs n (log₂ n staircase) vs linear.
- F: decision tree of binary search on 7 items (every path length ≤ 3).
- F: binary search on the answer — a monotonic predicate strip (false…false true…true) with the boundary found by halving; example: integer square root or minimum shipping capacity.
- F: the classic bugs — `mid = (lo+hi)/2` overflow, `lo = mid` infinite loop — shown as a stuck animation.
- D: "can I binary search this?" flowchart (sorted/monotonic? → what's the predicate? → which bound?).
**Checks:** predict lo/hi after a comparison; max comparisons for 1,000,000 items; which variant returns 3 for duplicates [1,3,3,3,5] and x=3 (first index).
**Edge cases:** empty array, one element, target smaller/larger than all, duplicates, absent target.
**Sources:** old `chapters/06-searching.html`, `js/search-trace.js` (existing tested trace), `studies/dsa-06-sorting-and-the-comparison-barrier.html` (decision-tree argument).

### 14 · Bubble, selection & insertion sort
**Big idea:** three simple sorts, each with a different invariant; all O(n²) in the worst case, but insertion sort is excellent on nearly sorted data.
**Concepts:** what sorted means; comparisons and swaps as the cost model; bubble sort (largest bubbles to the end each pass; early exit); selection sort (select the minimum of the unsorted part; always n²/2 comparisons, ≤ n swaps); insertion sort (grow a sorted prefix; shift and insert; adaptive — O(n) on sorted input); stability (equal keys keep their order — labelled duplicates); in-place; inversions as the measure of disorder (insertion sort does exactly #inversions shifts).
**Visuals:**
- T: bars bubbling into order.
- L: one lab with three tabs (bubble / selection / insertion): bars view, pointers, sorted region, held key lifted for insertion, code panel (pseudo/JS/Python), variable watch, comparison/swap counters, custom input and presets (random, sorted, reversed, nearly sorted, few unique).
- X: race all three side by side on the same input with counters; replay on different presets.
- C: comparisons and swaps per algorithm per preset (grouped bar chart) + growth vs n line chart.
- F: stability — cards with the same number but different suits; selection sort breaks their order, insertion keeps it.
- F: inversions — every inverted pair drawn as an arc; insertion sort removes exactly one arc per shift.
- F: invariant spotlights: for each sort, a small figure that freezes mid-run and highlights what is guaranteed (bubble: suffix final; selection: prefix final; insertion: prefix sorted but not final).
- D: flowchart of insertion sort with the active node lit during the lab.
- D: "which simple sort?" decision diagram (nearly sorted? swaps expensive? stability needed?).
**Checks:** predict the array after pass 1 of bubble sort; which algorithm makes the fewest swaps on reversed input; is selection sort stable (show why not).
**Edge cases:** empty, one item, all equal, already sorted (bubble early exit, insertion O(n)).
**Sources:** `studies/dsa-06-sorting-and-the-comparison-barrier.html`, old `chapters/05-sorting.html` and `scripts/*_sort.js` + `tests/sorting.test.js` (existing tested traces — reuse or port).

### 15 · Merge sort & divide and conquer
**Big idea:** split the array in half, sort each half recursively, and merge two sorted halves in linear time; log n levels × n work per level = O(n log n).
**Concepts:** divide / conquer / combine; the merge procedure (two pointers, take the smaller, stability via ≤); recursion tree of subarrays; work per level; recurrence T(n) = 2T(n/2) + n; master theorem intuition (three cases as recursion-tree shapes); extra O(n) memory; bottom-up merge sort; counting inversions via merge; external sorting mention.
**Visuals:**
- T: an array splitting into a tree of halves and merging back up in colour.
- L: merge sort lab — array splits animate downward into levels, merges animate upward; the merge step shows two pointers and an output row; recursion tree panel highlights the active call; code synced; counters.
- F: merge in isolation — two sorted rows, pointers, items flying to the output; learner can click "which goes next?".
- F: recursion tree with work per level annotated (n, n, n, …) and the height log₂ n; slider for n.
- C: n² vs n log n comparisons measured on growing n.
- X: merge sort vs insertion sort race on random and nearly-sorted inputs.
- F: master theorem visual — three recursion trees (root-heavy, balanced, leaf-heavy) with level sums as bars.
- F: bottom-up merge sort (runs of 1, 2, 4, 8 merging).
- D: divide-and-conquer template flowchart.
**Checks:** click the next element to be output during a merge; how many levels for n = 32; T(n) = 2T(n/2) + n solves to?
**Sources:** `studies/dsa-03-divide-solve-combine.html`, `studies/dsa-06-sorting-and-the-comparison-barrier.html`.

### 16 · Quick sort & quickselect
**Big idea:** partition around a pivot so smaller items go left and larger go right, then recurse; average O(n log n) in place, but a bad pivot gives O(n²); randomization fixes the odds.
**Concepts:** partition (Lomuto and Hoare), pivot in its final place after partitioning; recursion on both sides; best/average/worst cases and their recursion trees; pivot strategies (first, last, random, median-of-three); randomized quicksort expected cost; three-way partition (Dutch national flag) for duplicates; quickselect for the k-th smallest in expected O(n); introsort mention; not stable.
**Visuals:**
- T: a pivot glowing while items split left and right around it.
- L: quicksort lab — Lomuto/Hoare tabs, pivot highlight, i/j pointers, partition regions (≤ pivot, > pivot, unknown) shaded, recursion stack/tree, code synced, counters, presets incl. sorted (worst case for first-pivot).
- F: partition in isolation with the invariant regions and a "predict where the pivot lands" check.
- F: recursion trees for good pivots vs bad pivots (balanced vs chain) side by side.
- C: comparisons on sorted input: first-pivot vs random-pivot vs median-of-three, as n grows.
- F: Dutch national flag three-way partition with red/white/blue items.
- L: quickselect — find the k-th smallest; only one side is recursed; the discarded side dims.
- X: quick vs merge vs insertion race.
- D: "choosing a pivot" decision diagram.
**Checks:** array after one Lomuto partition; which input makes first-pivot quicksort quadratic; where does the pivot end up.
**Sources:** `studies/dsa-06-sorting-and-the-comparison-barrier.html`, `studies/dsa-05-probability-for-algorithms.html` (expected comparisons 2n ln n), `studies/dsa-22-randomness-as-a-design-tool.html`.

### 17 · Counting, radix & the n log n barrier
**Big idea:** any comparison sort needs Ω(n log n) comparisons in the worst case (decision-tree argument), but if keys are small integers you can sort in linear time without comparing.
**Concepts:** decision tree of comparisons; leaves = n! permutations; height ≥ log₂(n!) ≈ n log n; counting sort (count, prefix sums, place — stable); radix sort LSD digit by digit using stable counting sort; bucket sort for uniform data; when linear sorts win and when they don't (key range k, digit count d); summary of all sorts.
**Visuals:**
- T: numbers dropping into digit buckets and back out in order.
- F: decision tree for sorting 3 items (6 leaves) — click a path of comparisons; show height ≥ log₂ 6.
- C: log₂(n!) vs n log₂ n vs n² chart.
- L: counting sort lab — count array bars filling, prefix sums sweeping, items placed from right to left into output (stability shown with labelled duplicates); code synced.
- L: radix sort lab — LSD passes with 10 digit buckets; items fly into buckets and back; digit position highlighted.
- F: bucket sort with uniform floats.
- X: grand comparison table of all sorts (time best/avg/worst, space, stable, in-place, adaptive) with mini sparkline animations.
- D: "which sort should I use?" decision flowchart for the whole unit.
**Checks:** how many leaves for n = 4; counting sort output positions; why radix sort needs a stable inner sort.
**Sources:** `studies/dsa-06-sorting-and-the-comparison-barrier.html`.

## Unit 4 — Trees

### 18 · Trees & traversals
**Big idea:** a tree is a hierarchy with one root and no cycles; four traversal orders visit every node, each useful for different jobs.
**Concepts:** root, parent, child, sibling, leaf, subtree, depth, height, level; binary trees; full/complete/perfect/degenerate shapes; n nodes ↔ n−1 edges; representing trees (node objects; array for complete trees); traversals: preorder, inorder, postorder (recursive + with an explicit stack), level order (queue); applications: file system sizes (postorder), copying/serialising (preorder), expression trees (inorder/postorder), printing by level; height computation recursively.
**Visuals:**
- T: a tree growing branch by branch, then a traversal token visiting nodes in order.
- I: real trees — file system, org chart, HTML DOM — as collapsible interactive trees.
- F: vocabulary explorer — hover/click a node and see its parent, children, depth, height, subtree highlighted.
- L: traversal lab — pre/in/post/level tabs; a token walks the tree (the "Euler tour" path around the tree with pre/in/post visit points marked), output sequence builds, call stack or queue shown; code synced.
- F: the Euler tour trick — one walk around the tree, three colored dots per node (left/under/right) → three orders.
- F: expression tree for (3 + 4) × (5 − 2) — evaluate bottom-up with postorder; show infix/prefix/postfix.
- F: shape gallery — full, complete, perfect, degenerate with n and height; complete tree ↔ array index mapping (2i+1, 2i+2).
- C: height vs n for perfect vs degenerate trees.
- D: "which traversal do I need?" decision diagram.
**Checks:** click nodes in preorder; the postorder of a given tree; height of a complete tree with 20 nodes.
**Sources:** `studies/dsa-07-balanced-search-trees.html` (intro), old `chapters/11-trees.html`.

### 19 · Binary search trees
**Big idea:** keep everything smaller to the left and larger to the right, and search becomes a walk down one path — as fast as the tree is short.
**Concepts:** BST property (whole subtrees); search; insert; min/max; successor/predecessor; delete (leaf, one child, two children via successor); inorder = sorted; range queries; height and insertion order (random vs sorted input → chain); duplicates policy; expected height of random BST ~ O(log n).
**Visuals:**
- T: a value dropping down the tree, turning left/right at each node, landing in place.
- L: BST lab — insert / search / delete / min / max / successor with animated paths, comparisons captioned, three deletion cases animated (successor copy + removal), code synced; custom sequences; "insert sorted" preset shows degeneration.
- F: "the rule applies to whole subtrees" — a tree that looks valid locally but violates globally; learner finds the offending node.
- F: range query — highlight subtrees pruned vs visited for [lo, hi].
- X: same keys, different insertion orders → different shapes; height counters; random vs sorted.
- C: average depth vs n for random insertion order vs sorted (log vs linear), from simulation.
- F: inorder walk flattens the tree into a sorted array (nodes drop vertically onto a number line).
- D: deletion decision flowchart (0 / 1 / 2 children).
**Checks:** where does 7 go; the successor of a node; what the tree looks like after deleting a node with two children.
**Sources:** `studies/dsa-07-balanced-search-trees.html`, old `chapters/11-trees.html`.

### 20 · Balanced trees: AVL & red-black
**Big idea:** self-balancing trees repair their shape after each insert/delete with local rotations, guaranteeing O(log n) height.
**Concepts:** why balance matters (recap chain); rotations (left, right) preserve inorder; AVL: height, balance factor, four cases (LL, RR, LR, RL) and the fix; AVL height bound (~1.44 log n) via minimal-node Fibonacci trees; red-black trees: five rules, black height, insert fix-up (recolor vs rotate cases), height ≤ 2 log(n+1); comparison AVL vs RB; B-trees and 2-3 trees for disks (brief, with a visual of a wide node splitting); where they're used (Java TreeMap, C++ std::map, databases).
**Visuals:**
- T: a lopsided tree snapping into balance with a rotation.
- F: rotation explorer — a node x with subtrees A, B, C; click rotate left/right; nodes swing; inorder strip beneath stays identical.
- L: AVL lab — insert/delete, balance factors as badges, the unbalanced node flashes, the case (LL/LR/RL/RR) named, rotations animate, code synced.
- F: the four AVL cases as a 2×2 gallery of mini animations.
- L: red-black lab — insert with recolorings and rotations animated; rule checker panel lights which rule is violated.
- F: 2-3 tree / B-tree node split animation (key promoted upward).
- X: insert 1..15 in order into BST vs AVL vs RB — three trees side by side with heights.
- C: height vs n for BST (sorted insert), AVL, RB, and log₂ n.
- D: AVL rebalance decision flowchart (balance factor ±2 → which child heavier → single or double rotation).
**Checks:** which rotation fixes this; balance factor of a node; is this a valid red-black tree (click the violating node).
**Sources:** `studies/dsa-07-balanced-search-trees.html`.

### 21 · Heaps & priority queues
**Big idea:** a heap keeps only a partial order (parent ≤ children) — enough to find the minimum in O(1) and insert/remove in O(log n); a complete tree fits perfectly in an array.
**Concepts:** priority queue ADT; heap property; complete tree ↔ array (parent (i−1)/2, children 2i+1, 2i+2); insert with sift-up; extract-min with sift-down; peek; build-heap in O(n) (bottom-up heapify, why the sum is linear); heap sort (in place, not stable, O(n log n)); top-k with a heap; merging k sorted lists; decrease-key (Dijkstra preview); min vs max heaps.
**Visuals:**
- T: a new value bubbling up through a heap tree while the array below mirrors each swap.
- L: heap lab — tree view and array view linked (hover one lights the other); insert (sift-up), extract (sift-down), peek, build-heap; code synced; counters.
- F: array ↔ tree index mapping explorer (click index i → parent/children highlighted with the formulas).
- F: build-heap bottom-up with the per-level work annotated; chart of n log n vs actual O(n) swaps.
- L: heap sort lab — build max-heap, then repeatedly swap root to the end and sift down; sorted region grows at the right of the array; tree shrinks.
- F: top-k streaming — a size-k min-heap keeps the k largest of a stream.
- F: merging k sorted lists with a heap of list heads.
- X: priority queue implementations compared (sorted array, unsorted array, heap) — insert/extract costs with mini animations.
- D: "heap operation" flowchart for sift-down.
**Checks:** array after inserting a value; which child sift-down swaps with; is this array a valid min-heap.
**Sources:** `studies/dsa-09-partial-order-is-enough-heaps-and-priority-queues.html`, old `chapters/12-heaps.html`.

### 22 · Tries
**Big idea:** a trie stores strings character by character along paths from the root, so lookups cost O(length of word) no matter how many words are stored, and prefixes come for free.
**Concepts:** nodes with child maps and an end-of-word flag; insert; search word vs prefix; delete (pruning); autocomplete by DFS from the prefix node; counting words with a prefix; memory cost and compression (radix/Patricia tree preview); comparison with hash sets (prefix queries) and BSTs; applications: autocomplete, spell check, IP routing (longest prefix match), word games (Boggle).
**Visuals:**
- T: words sharing prefixes branching out of a root.
- L: trie lab — insert/search/delete words; path lights character by character; end-of-word nodes marked; code synced.
- F: autocomplete — type a prefix in a search box; the prefix path lights and the subtree's words list out live (ranked).
- F: compressed trie (radix tree) vs plain trie for the same words: node counts compared.
- F: longest-prefix match for IP routing (binary trie on bits).
- X: trie vs hash set: prefix query "how many words start with 'ca'?" — visited nodes vs scanning all keys.
- C: nodes created vs words inserted (shared prefixes flatten growth).
- D: "trie, hash map or sorted array?" decision diagram.
**Checks:** how many nodes after inserting a word list; is "car" a word or just a prefix; autocomplete results for a prefix.
**Sources:** `studies/dsa-19-tries-and-suffix-structures.html`.

### 23 · Segment & Fenwick trees
**Big idea:** precompute sums over power-of-two ranges so that any range query or point update touches only O(log n) nodes.
**Concepts:** the range-sum problem; naive O(n) query vs prefix sums (O(1) query, O(n) update); segment tree structure (each node = a segment), build, point update (path to root), range query (covering nodes: fully inside / partial / outside); other operations (min, max, gcd); lazy propagation for range updates (visual of pending tags); Fenwick tree: i & −i lowbit, responsibility ranges, prefix query by stripping low bits, update by adding low bits; comparison.
**Visuals:**
- T: a range bracket sliding over an array while a handful of tree nodes light up.
- X: three approaches to range sum (naive / prefix sums / segment tree) with counters for queries and updates.
- L: segment tree lab — array below, tree above with segment labels and sums; query [l, r]: nodes colour by fully-covered / partial / outside; update: path to root recomputes; code synced; sum/min/max tabs.
- F: lazy propagation — range add with pending tags shown as badges pushed down only when needed.
- L: Fenwick lab — array with responsibility bars (each index covers i & −i elements), binary representation of indices, query/update jumps animated with the bit manipulation shown.
- F: lowbit explorer — type i, see i, −i (two's complement), i & −i.
- C: operations per query/update vs n for the three approaches.
- D: "prefix sums, Fenwick or segment tree?" decision diagram.
**Checks:** which nodes a query visits; Fenwick index sequence for prefix(13); cost of an update.
**Sources:** `studies/dsa-10-range-queries-fenwick-and-segment-trees.html`.

### 24 · Union-find
**Big idea:** represent each group as a tree pointing to a root; union links roots; path compression and union by rank make operations effectively constant.
**Concepts:** dynamic connectivity problem; parent array; find (follow to root); union (link roots); naive worst case (tall chains); union by rank/size; path compression (and path halving); the inverse Ackermann bound (intuition: ≤ 4 in practice); applications: connected components, Kruskal, cycle detection in undirected graphs, percolation, image segmentation, account merging.
**Visuals:**
- T: scattered dots merging into coloured groups.
- F: friend groups analogy — people as dots; union draws them into the same colour.
- L: union-find lab — forest view + parent array view linked; union/find buttons; toggles for union by rank and path compression; find paths light up; compression re-points nodes to the root with animation; code synced.
- X: with vs without optimisations on the same random sequence: max tree height and total pointer hops.
- C: average find cost vs number of operations for naive / rank / rank + compression.
- F: percolation grid — open random cells; union-find detects when top connects to bottom.
- F: cycle detection in an undirected graph edge by edge.
- D: "find" and "union" flowcharts.
**Checks:** parent array after a sequence of unions; which root after union by rank; tree after path compression.
**Sources:** `studies/dsa-12-minimum-spanning-trees-and-union-find.html`.

## Unit 5 — Graphs

### 25 · Graphs & representations
**Big idea:** a graph is a set of vertices connected by edges — maps, networks, dependencies; how you store it (matrix or list) decides which operations are fast.
**Concepts:** vertices, edges, directed/undirected, weighted/unweighted, degree (in/out), paths, cycles, connected components, trees as graphs, DAGs, bipartite graphs, dense vs sparse; representations: adjacency matrix (O(1) edge check, O(V²) space), adjacency list (O(V+E) space), edge list; handshake lemma; real graphs: road maps, social networks, the web, course prerequisites; implicit graphs (grids, state spaces).
**Visuals:**
- T: a network of nodes gently floating with edges pulsing.
- I: Königsberg bridges → graph (Euler 1736) morph animation.
- L: graph builder — click to add vertices, drag to connect, toggle directed/weighted; adjacency matrix and adjacency list update live side by side, highlighting the cell/list entry for the selected edge.
- F: vocabulary explorer — hover a vertex: degree, neighbours; select two: is there a path? highlight a cycle.
- X: matrix vs list for operations (edge exists?, list neighbours, space) with counters on a sparse and a dense graph.
- C: memory (cells) vs V for matrix and list on sparse vs dense graphs.
- F: grid as an implicit graph — a maze where each cell's neighbours light up.
- F: gallery of special graphs (tree, DAG, complete, bipartite with two-colouring animation, cycle).
- D: "matrix or list?" decision diagram.
**Checks:** degree of a vertex; fill in a row of the adjacency matrix; which representation for a sparse social network.
**Sources:** `studies/dsa-11-graphs-and-their-traversals.html`, old `chapters/13-graphs.html`.

### 26 · BFS & DFS
**Big idea:** BFS explores in waves with a queue and finds fewest-edge paths; DFS dives deep with a stack (or recursion) and reveals structure; both are O(V + E).
**Concepts:** frontier + visited; BFS with a queue, layers/distance, parent pointers and path reconstruction; DFS recursive and iterative; discovery/finish times; edge classification (tree/back/forward/cross) briefly; connected components; flood fill on grids; bipartite check with BFS colouring; cycle detection with DFS; complexity O(V + E).
**Visuals:**
- T: a BFS wave spreading across a grid in rings.
- L: BFS/DFS lab on a graph — frontier (queue/stack) panel, visited set, current node, parent edges forming a tree, distance badges (BFS) or discovery/finish times (DFS); code synced; custom graph (editable) and start node.
- X: BFS vs DFS on the same graph side by side, same speed — the wave vs the dive.
- L: grid lab — maze or open grid; flood fill / shortest path by BFS; draw walls; watch the frontier.
- F: BFS layers — nodes arranged by distance layer as BFS proceeds (graph morphs into layered view).
- F: DFS tree with back edges highlighted (cycle found).
- F: connected components colouring — repeated BFS from unvisited nodes.
- F: bipartite check — 2-colouring spreads; an odd cycle causes a conflict (red edge).
- D: "BFS or DFS?" decision diagram.
**Checks:** click the next node BFS will visit; DFS order from A with alphabetical neighbours; the shortest path length from BFS.
**Sources:** `studies/dsa-11-graphs-and-their-traversals.html`, old `chapters/13-graphs.html`, `labs/graph-studio.html`.

### 27 · Topological sort & cycles
**Big idea:** a DAG's vertices can be ordered so every edge points forward; Kahn's algorithm peels off nodes with no incoming edges, DFS orders by finish time; failure to finish means a cycle.
**Concepts:** dependencies (course prerequisites, build systems, spreadsheet recalculation); DAG definition; Kahn's algorithm with in-degree counts and a queue; DFS-based topological order (reverse postorder); cycle detection with three colours (white/grey/black); multiple valid orders; strongly connected components (Kosaraju or Tarjan) and the condensation DAG; critical path (longest path in DAG) mention.
**Visuals:**
- T: a tangle of tasks rearranging into a left-to-right line with all arrows pointing right.
- I: course-prerequisite graph for a CS degree (or recipe steps) as the running example.
- L: Kahn's lab — in-degree badges decrement, zero-in-degree queue, output order builds; the graph morphs into a layered left→right layout at the end; code synced.
- L: DFS topo lab — white/grey/black colouring, finish stack, reverse postorder; a back edge (grey → grey) flagged as a cycle.
- F: "many valid orders" — shuffle among valid topological orders; invalid orders show a backward arrow in red.
- F: cycle detection — add an edge that creates a cycle; Kahn's gets stuck (nodes left with in-degree > 0 glow).
- L: SCC lab — Kosaraju's two passes (or Tarjan's low-links) colouring components; then collapse into the condensation DAG.
- D: "topological order?" flowchart for Kahn's algorithm.
**Checks:** next node out of Kahn's queue; is this order valid (click the violating edge); how many SCCs.
**Sources:** `studies/dsa-11-graphs-and-their-traversals.html`.

### 28 · Dijkstra & A*
**Big idea:** with non-negative weights, always settling the closest unsettled vertex gives shortest paths; a priority queue makes it fast; A* adds a heuristic that pulls the search toward the goal.
**Concepts:** weighted shortest paths (why BFS fails with weights); relaxation (`dist[v] > dist[u] + w`); Dijkstra's greedy choice and why it's correct (settled distances never improve with non-negative weights); priority queue (lazy deletion); O((V + E) log V); path reconstruction via predecessors; failure with negative edges (counterexample); A*: f = g + h, admissible and consistent heuristics (Manhattan/Euclidean), comparison of explored nodes; greedy best-first as a contrast.
**Visuals:**
- T: distance labels rippling out from a source across a weighted map, the final shortest path glowing.
- F: relaxation in isolation — one edge, two labels, the improvement animated.
- L: Dijkstra lab — weighted editable graph; distance badges (∞ → values), priority-queue panel (sorted list with lazy stale entries), settled set, predecessor edges forming a shortest-path tree; code synced.
- X: BFS vs Dijkstra on a weighted graph where fewest edges ≠ least weight.
- F: negative-edge counterexample — Dijkstra settles too early; the true shorter path appears too late (red).
- L: grid pathfinding lab — draw walls and weighted "mud" cells; run Dijkstra vs A* vs greedy best-first; explored cells heatmap; counters for nodes expanded and path cost.
- F: heuristic explorer — h = 0 (Dijkstra), Manhattan (A*), overestimate ×3 (fast but wrong path) — compare path cost and expanded nodes.
- C: nodes expanded vs grid size for Dijkstra and A*.
- D: "which shortest-path algorithm?" decision flowchart (unweighted → BFS; non-negative → Dijkstra/A*; negative → Bellman-Ford; all pairs → Floyd-Warshall; DAG → topo order DP).
**Checks:** which vertex is settled next; distance labels after a relaxation; does A* with this heuristic guarantee the shortest path.
**Sources:** `studies/dsa-13-single-source-shortest-paths.html`, `labs/graph-studio.html`.

### 29 · Bellman-Ford & Floyd-Warshall
**Big idea:** relaxing every edge V−1 times handles negative weights (and detects negative cycles); a triple loop over intermediate vertices gives all-pairs distances.
**Concepts:** why negative edges matter (currency arbitrage, costs vs rewards); Bellman-Ford: V−1 rounds of relaxing all edges, why V−1 suffices (a shortest path has ≤ V−1 edges), early exit, negative-cycle detection on round V; O(VE); Floyd-Warshall: DP over "allowed intermediate vertices {1..k}", the matrix update `d[i][j] = min(d[i][j], d[i][k] + d[k][j])`, O(V³), path reconstruction with next-hop matrix, negative diagonal = negative cycle; Johnson's algorithm mention; transitive closure.
**Visuals:**
- T: a distance matrix rippling as k advances, cells turning smaller.
- L: Bellman-Ford lab — edges relaxed in order per round (edge list panel with a scanning cursor), distance badges update, round counter, early-exit detection; negative-cycle preset where a round-V relaxation lights the cycle red; code synced.
- F: "path with at most k edges" layers — after round k, the distances equal best paths using ≤ k edges.
- F: currency arbitrage example — exchange rates → −log weights → negative cycle means profit.
- L: Floyd-Warshall lab — graph + distance matrix side by side; for each k, row k and column k highlight; each updated cell shows the two cells that combined; the corresponding path through k lights on the graph; code synced.
- F: path reconstruction via next-hop matrix.
- C: operations vs V: Dijkstra from every vertex vs Floyd-Warshall vs Bellman-Ford from every vertex on sparse/dense graphs.
- D: the shortest-path decision flowchart (shared with lesson 28, highlighting this lesson's branch).
**Checks:** distances after round 1; which cell changes when k = 2; how does Floyd-Warshall show a negative cycle.
**Sources:** `studies/dsa-14-all-pairs-shortest-paths-floyd-warshall-johnson.html`, `studies/dsa-13-single-source-shortest-paths.html`.

### 30 · Minimum spanning trees
**Big idea:** to connect every vertex with minimum total weight, repeatedly add the cheapest edge that crosses a cut — Kruskal does it globally with union-find, Prim grows one tree with a heap.
**Concepts:** spanning tree (V−1 edges, no cycles); MST uses (networks, clustering, approximating TSP); cut property and cycle property with pictures; Kruskal: sort edges, add if it joins two components (union-find), skip if it forms a cycle; Prim: grow from a start vertex, pick the cheapest edge leaving the tree (priority queue); Borůvka mention; uniqueness with distinct weights; O(E log E) / O(E log V).
**Visuals:**
- T: cities being connected by the cheapest roads one at a time.
- F: cut property explorer — drag a cut line across the graph; crossing edges highlight; the lightest one is safe.
- L: Kruskal lab — sorted edge list with a cursor; accepted edges glow; rejected (cycle) edges flash red; union-find components as colours; code synced.
- L: Prim lab — tree grows from start; priority queue panel of crossing edges; code synced.
- X: Kruskal vs Prim on the same graph side by side — same total weight, different order of edges.
- F: cycle property — the heaviest edge in any cycle is never needed.
- F: MST clustering — remove the k−1 heaviest MST edges → k clusters.
- C: running time comparison on sparse vs dense graphs.
- D: "Kruskal or Prim?" decision diagram.
**Checks:** next edge Kruskal accepts or rejects; next vertex Prim adds; total MST weight.
**Sources:** `studies/dsa-12-minimum-spanning-trees-and-union-find.html`.

### 31 · Max flow & min cut
**Big idea:** push as much flow as possible from source to sink through capacity-limited edges by finding augmenting paths in the residual graph; the maximum flow equals the capacity of the smallest cut.
**Concepts:** flow networks (capacities, source, sink, conservation); augmenting paths; residual graph with reverse edges (why "undoing" flow is essential — show greedy failing without it); Ford-Fulkerson; Edmonds-Karp (BFS for shortest augmenting paths, O(VE²)); min cut from the final residual reachability; max-flow min-cut theorem; applications: bipartite matching (jobs to workers), image segmentation, baseball elimination, airline scheduling.
**Visuals:**
- T: water flowing through pipes, pipe thickness = capacity, fill = flow.
- I: pipe network illustration — edges drawn as pipes that fill proportionally.
- L: max-flow lab — network view with flow/capacity labels, residual graph view toggle (forward + reverse edges), augmenting path found by BFS glows, bottleneck highlighted, flow pushed with animated particles; code synced; total flow counter.
- F: why reverse edges — a greedy path that blocks the optimum, and the reverse-edge fix.
- F: min cut — after termination, reachable set shaded; cut edges highlighted; sum = max flow.
- L: bipartite matching — workers ↔ jobs as a flow network; augmenting paths re-route assignments.
- C: flow value after each augmentation (staircase to max).
- D: max-flow algorithm flowchart (find augmenting path? → bottleneck → augment → repeat → min cut).
**Checks:** bottleneck of a path; residual capacity of a reverse edge; the min cut value.
**Sources:** `studies/dsa-17-max-flow-min-cut-and-the-power-of-duality.html`.

## Unit 6 — Design paradigms

### 32 · Greedy algorithms
**Big idea:** a greedy algorithm makes the locally best choice and never looks back; it's correct only when an exchange argument (or matroid structure) proves no optimal solution is lost.
**Concepts:** the greedy template; coin change with US coins (works) vs coins {1, 3, 4} for 6 (fails — DP needed); activity selection / interval scheduling (earliest finish time) and the exchange argument; fractional knapsack (by ratio) vs 0/1 knapsack (greedy fails); Huffman coding (merge two least frequent, prefix-free codes, compression ratio); job scheduling with deadlines; matroids intuition; greedy staying ahead.
**Visuals:**
- T: intervals on a timeline being picked left to right, conflicting ones fading.
- L: interval scheduling lab — draggable intervals on a timeline; strategies tabs (earliest start, shortest, fewest conflicts, earliest finish); only earliest finish always wins — counterexamples appear for others; code synced.
- F: exchange argument animation — swap the optimal's first interval for greedy's; the schedule stays valid.
- F: coin change greedy vs optimal on {1, 3, 4} — coin stacks side by side.
- F: fractional vs 0/1 knapsack — fill a bag with liquid slices vs whole items.
- L: Huffman lab — type text; frequency table; priority queue merges two smallest nodes repeatedly building the tree; codes assigned; encoded bitstring length vs fixed-width (compression bar).
- C: bits per character: fixed 8-bit vs Huffman for several texts.
- D: "is greedy safe here?" decision flowchart (greedy-choice property? optimal substructure? proof via exchange?).
**Checks:** which interval is picked next; does greedy coin change work for {1, 5, 10, 25} and 30; the Huffman code of the most frequent letter.
**Sources:** `studies/dsa-16-when-is-greedy-optimal-exchange-arguments-and-matroids.html`.

### 33 · Backtracking
**Big idea:** explore choices depth-first, abandon a partial solution as soon as it breaks a constraint, and undo the last choice to try the next — pruning turns impossible searches into fast ones.
**Concepts:** the choose / explore / unchoose template; state-space tree; subsets (include/exclude), permutations (swap or used-array), combinations; N-Queens with column/diagonal constraint sets; Sudoku solver; pruning and its effect on nodes explored; backtracking vs brute force; bounding (branch and bound mention); word search on a grid.
**Visuals:**
- T: queens being placed and removed on a chessboard until a solution clicks into place.
- L: N-Queens lab — board (n = 4..10) + state-space tree side by side; attacked squares shaded; conflicts flash; backtrack animation; nodes-explored counter; code synced.
- L: subsets / permutations lab — recursion tree builds with include/exclude branches; current partial solution shown; results list.
- L: Sudoku solver — cells fill and erase; candidates shown; speed control; counter of attempts; "with pruning (most constrained cell first) vs naive order" comparison.
- F: word search in a letter grid — DFS path with backtracking.
- X: brute force vs backtracking node counts for N-Queens (chart and animated trees).
- C: nodes explored vs n (log scale) with and without pruning.
- D: backtracking template flowchart (valid? complete? → record : for each choice → choose → recurse → unchoose).
**Checks:** is this partial placement safe; how many subsets for n = 4; which cell does the solver try next.
**Sources:** `studies/dsa-21-living-with-hardness-approximation-and-parameterized-algorithms.html` (search trees, branching), your own knowledge.

### 34 · Dynamic programming I
**Big idea:** when a recursion solves the same subproblems again and again, store each answer once — top-down with memoization or bottom-up with a table; the subproblems form a DAG.
**Concepts:** overlapping subproblems (fib recursion tree with repeats); optimal substructure; memoization (top-down cache); tabulation (bottom-up order); state definition, recurrence, base cases, order, answer; space optimisation (keep two variables); the subproblem DAG and topological order; climbing stairs; coin change (min coins, number of ways); house robber; longest increasing subsequence (O(n²)); reconstruction of the solution with choices/predecessors.
**Visuals:**
- T: a sprawling recursion tree collapsing into a single row of cached cells.
- F: fib recursion tree with repeated subtrees highlighted, then the same with memo hits (pruned subtrees fade); call counters.
- C: calls vs n: naive vs memo vs table.
- L: DP lab with tabs (climbing stairs, coin change min coins, coin change ways, house robber, LIS): table fills cell by cell, dependency arrows from the cells each value uses, recurrence displayed with numbers plugged in, code synced; reconstruction pass highlights the chosen path.
- F: the subproblem DAG — coin change states as nodes, edges as coin choices; DP = shortest path in this DAG.
- F: top-down vs bottom-up order of filling the same table (two animations side by side).
- F: space optimisation — the table shrinking to a sliding pair of cells.
- D: "how to design a DP" flowchart (define state → recurrence → base cases → order → answer → reconstruct).
**Checks:** next cell value in the coin change table; how many distinct calls memoized fib(10) makes; which subproblems dp[7] depends on.
**Sources:** `studies/dsa-15-dynamic-programming-optimal-substructure-over-a-subproblem-dag.html`, old `chapters/14-dynamic-programming.html`.

### 35 · Dynamic programming II
**Big idea:** many problems on two sequences or on capacity form a 2D grid of subproblems, where each cell depends on its neighbours above and to the left.
**Concepts:** grid paths (with obstacles); LCS (match → diagonal + 1, else max of up/left) and reconstructing the subsequence; edit distance (insert/delete/replace — the three arrows) with the alignment shown; 0/1 knapsack (item × capacity table; take vs skip) with reconstruction; filling order; space optimisation to one row; interval DP or matrix-chain mention; recognizing 2D DP.
**Visuals:**
- T: a 2D table filling diagonally with arrows, then a glowing path traced back from the corner.
- L: LCS lab — two strings (custom), table fills with arrows (diagonal/up/left), matching characters highlighted in both strings, traceback path and resulting subsequence; code synced.
- L: edit distance lab — table with operation arrows; traceback converts the alignment into an animated sequence of edits turning word A into word B.
- L: 0/1 knapsack lab — items (weight/value cards), capacity; table rows per item; each cell shows take vs skip candidates; traceback selects items which fly into a bag.
- F: grid paths with obstacles — counts flow right/down; click to toggle obstacles.
- F: one-row space optimisation for knapsack (iterating capacity backwards — show why forwards breaks it by reusing an item).
- C: brute force (2ⁿ subsets) vs DP (n·W) operations for knapsack as n grows.
- D: "recognize a 2D DP" decision diagram (two sequences? capacity? grid?).
**Checks:** value of a given LCS cell; which edit the arrow means; does item 3 go in the bag.
**Sources:** `studies/dsa-15-dynamic-programming-optimal-substructure-over-a-subproblem-dag.html`.

### 36 · String matching
**Big idea:** naive matching wastes work after a mismatch; KMP remembers how much of the pattern still matches (failure function), Rabin–Karp compares rolling hashes, and Z-algorithm measures prefix matches — all linear time.
**Concepts:** naive O(nm) sliding with mismatch counts; KMP: prefix function / failure table (longest proper prefix that's also a suffix), building it, using it to skip, O(n + m); Rabin–Karp: polynomial rolling hash, update in O(1), spurious hits and verification, multiple patterns; Z-algorithm (Z-box); Boyer–Moore bad-character idea (brief); applications (search in editors, DNA, plagiarism).
**Visuals:**
- T: a pattern sliding along a text, jumping ahead after mismatches.
- L: naive vs KMP lab — text and pattern rows, alignment slides, character comparisons light green/red, KMP jumps using the failure table (shown under the pattern with arrows), comparison counters; code synced.
- L: failure-table builder — the pattern compared against itself, longest border highlighted for each prefix.
- L: Rabin–Karp lab — window hash rolling (subtract leading char, multiply, add trailing), hash matches vs verified matches, spurious hits flash; code synced.
- F: Z-algorithm with the Z-box [l, r] sliding.
- X: comparisons for naive vs KMP vs Rabin–Karp on adversarial input (aaaa…ab) — race with counters.
- C: comparisons vs text length for each.
- D: "which string algorithm?" decision diagram.
**Checks:** failure-table value for a prefix; where KMP resumes after a mismatch; rolling-hash update result.
**Sources:** `studies/dsa-18-linear-time-exact-matching.html`, `studies/dsa-19-tries-and-suffix-structures.html` (suffix structures mention).

## Unit 7 — Limits & frontiers

### 37 · P, NP & hard problems
**Big idea:** some problems are easy to verify but seem hard to solve; NP-complete problems are all equally hard via reductions, and when you meet one you approximate, restrict, or search cleverly.
**Concepts:** decision problems; P (solvable in polynomial time); NP (verifiable in polynomial time — certificates); exponential blow-up (TSP brute force n!); reductions (if A reduces to B, B is at least as hard); SAT and Cook–Levin; NP-complete family (3-SAT, vertex cover, clique, independent set, Hamiltonian cycle, TSP, subset sum, graph colouring); P vs NP open question; coping: approximation (2-approx vertex cover via matching, MST-based TSP 2-approx), heuristics (nearest neighbour, 2-opt), fixed-parameter tractability, special cases; NP-hard vs NP-complete; undecidability mention (halting problem) as a different kind of limit.
**Visuals:**
- T: a TSP tour trying permutations, the counter exploding.
- F: verify vs solve — Sudoku: checking a filled grid takes a sweep; solving takes search (timers side by side).
- C: n! vs 2ⁿ vs n³ — with "age of the universe" markers.
- L: TSP lab — cities (click to add); brute force for small n (tour permutations flashing, best so far), nearest-neighbour heuristic, 2-opt improvement animation, MST-based 2-approximation; tour length comparisons.
- F: reduction animation — independent set ↔ vertex cover (complement) ↔ clique (complement graph) morphing on one graph.
- F: 3-SAT playground — toggle variables; clauses light green when satisfied; count assignments tried.
- F: vertex cover 2-approximation via maximal matching vs optimal cover.
- D: the complexity-class Venn diagram (P ⊆ NP, NP-complete, NP-hard) — interactive: hover problems to place them; toggle "if P = NP" view.
- D: "I think my problem is NP-hard — what now?" decision flowchart.
**Checks:** verify a given certificate; which direction a reduction proves hardness; is a 2-approximation's answer ever less than optimal.
**Sources:** `studies/dsa-20-p-np-reductions-and-np-completeness.html`, `studies/dsa-21-living-with-hardness-approximation-and-parameterized-algorithms.html`, `studies/dsa-23-the-frontier-fine-grained-sublinear-predictions-p-vs-np.html`.

### 38 · Randomized algorithms
**Big idea:** randomness can make algorithms simpler, faster in expectation, and immune to adversarial inputs — at the price of a small, controllable chance of slowness or error.
**Concepts:** Las Vegas (always correct, random time — randomized quicksort, quickselect) vs Monte Carlo (fixed time, small error — Miller–Rabin, Monte Carlo π); expectation and linearity (intuition); randomized quicksort vs adversary; reservoir sampling (uniform sample from a stream); Fisher–Yates shuffle (and the biased naive shuffle); skip lists (coin-flip levels, expected O(log n) search); Bloom filters (k hashes, bit array, false positive rate formula); Monte Carlo estimation of π; hashing with random functions (universal hashing) mention; count-min sketch / HyperLogLog mention.
**Visuals:**
- T: random darts landing in a square, the π estimate converging.
- F: Monte Carlo π — darts thrown live; estimate and error chart converging (C).
- F: shuffle bias — naive swap-with-any vs Fisher–Yates; run 10,000 shuffles; heatmap of position probabilities (uniform vs biased).
- L: reservoir sampling — a stream flows by; the reservoir keeps k items with probability k/i animated; a histogram after many runs proves uniformity.
- L: skip list lab — insert with coin flips building towers; search path drops levels; compare hops with a plain linked list.
- L: Bloom filter lab — bit array; insert words (k hash arrows set bits); query shows "definitely not" vs "maybe" and false positives; false-positive-rate chart vs number of items (C).
- X: randomized quicksort vs fixed-pivot on sorted/adversarial input (race + comparison counters).
- D: "Las Vegas or Monte Carlo?" decision diagram.
**Checks:** probability the 10th stream item is in a reservoir of size 3; can a Bloom filter return a false negative; expected height of a skip list with 16 items.
**Sources:** `studies/dsa-22-randomness-as-a-design-tool.html`, `studies/dsa-05-probability-for-algorithms.html`.
