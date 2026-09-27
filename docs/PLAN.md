# Visual DSA curriculum

The guided path is a continuous explanation, not a list of names to memorize. A lesson should show one concrete need, ask the reader to predict the next state, make the state visible, invite a changed input, establish an invariant or correctness argument, count work, and end with transfer problems. The 24 [deep studies](../studies/index.html) supply full derivations and broader topics after this spine.

The original fourteen-topic plan became seventeen guided lessons so decisions, loops, functions, references, and invariants have a place before data structures depend on them. Filenames from the original repository remain stable where possible; the displayed numbers below are the actual learning order.

| # | Lesson | One idea it must land | Interactive figure | Three practice problems, without solutions | Depends on |
|---:|---|---|---|---|---|
| 01 | [What is code?](../chapters/01-what-is-code.html) | A running program has a next instruction and a changing state; output is distinct from stored state. | Editable tiny machine with instruction pointer, memory, and output. | Trace arithmetic and output; reorder instructions to show 7; repair a misplaced output instruction. | None |
| 02 | [Memory and variables](../chapters/02-memory-and-variables.html) | Copying a number and copying a reference have different consequences. | Toggle between independent number values and two names sharing one list. | Trace a copied number; swap two values with a temporary name; distinguish rebinding from list mutation. | 01 |
| 03 | [Decisions and loops](../chapters/04-decisions-and-loops.html) | A condition can skip or repeat work; termination requires progress toward a false condition. | Editable ticket loop with current code line, state, and output. | Predict an empty loop; repair a nonterminating loop; explain an off-by-one result. | 02 |
| 04 | [Functions and references](../chapters/05-functions-and-references.html) | A call creates a local context; values and shared references cross the call boundary differently. | Editable call trace showing local names and a referenced object. | Trace a return value; predict a shared-list mutation; identify which names survive a return. | 03 |
| 05 | [Arrays and strings](../chapters/03-arrays-and-strings.html) | An index selects a position, while “position” in text may mean code unit rather than visible character. | Custom number-array scan and UTF-16 text trace. | Find boundary indices; trace a running total; compare visible characters with code units. | 04 |
| 06 | [How to reason](../chapters/06-how-to-reason.html) | A loop invariant connects individual steps to a claim about every input. | Editable invariant trace and prediction check. | State an invariant; find a counterexample to a broken rule; justify termination. | 03, 05 |
| 07 | [Complexity](../chapters/04-complexity.html) | Count a specified operation as input grows; cases and asymptotic bounds answer different questions. | Double input size and compare halving, one pass, and all pairs. | Count scan comparisons; compare formulas at two sizes; analyze a bounded inner loop. | 05, 06 |
| 08 | [Sorting](../chapters/05-sorting.html) | Six methods create order through different invariants, movements, and memory costs. | Custom-input bubble, selection, insertion, merge, quick, and heap traces with reversible timeline. | Trace insertion on duplicates; show bubble's early stop; compare merge, quick, and heap tradeoffs. | 07 |
| 09 | [Searching](../chapters/06-searching.html) | Sorted order lets one comparison remove a whole region of candidates. | Editable binary-search trace showing bounds and midpoint. | Search for absence; find the first duplicate; choose scan versus sorting for one query. | 05, 07, 08 |
| 10 | [Linked lists](../chapters/07-linked-lists.html) | Order can live in references rather than adjacent array slots. | Rewire next links to insert a node without losing the tail. | Follow links; insert after a known node; remove the head safely. | 02, 05 |
| 11 | [Stacks and queues](../chapters/08-stacks-and-queues.html) | Limiting which end can remove items creates LIFO or FIFO behavior. | Give a stack and queue identical arrivals, then remove once. | Trace push/pop; trace enqueue/dequeue; choose an access discipline for a real task. | 10 |
| 12 | [Hashing](../chapters/09-hashing.html) | A hash suggests a slot; collision and deletion rules preserve the ability to find a key. | Custom modulo table with insertion, linear probing, and lookup trace. | Place colliding keys; diagnose deletion without tombstones; calculate load factor. | 05, 11 |
| 13 | [Recursion](../chapters/10-recursion.html) | A call can wait for a smaller call if a base case guarantees an answer. | Editable factorial call stack expanding and returning. | Trace recursive sum; repair a missing base case; reason about stack space. | 04, 06 |
| 14 | [Trees](../chapters/11-trees.html) | A search rule chooses one branch, but height determines the cost. | Follow comparisons through a binary search tree. | Name family relationships; compare traversal orders; insert a new value. | 09, 13 |
| 15 | [Heaps](../chapters/12-heaps.html) | A partial parent order keeps one extreme accessible without sorting all values. | Append 9 and sift it upward through an array-backed heap. | Insert another value; test a heap invariant; sift after removing the root. | 14 |
| 16 | [Graphs](../chapters/13-graphs.html) | Frontier order and visited state determine how connections are explored. | BFS queue trace; [route explorer](../labs/graph-explorer.html) contrasts BFS and Dijkstra on one weighted graph. | Find an unweighted shortest path; trace DFS; include a disconnected vertex. | 11, 13 |
| 17 | [Dynamic programming](../chapters/14-dynamic-programming.html) | A precisely defined state and recurrence make repeated smaller questions reusable. | Editable minimum-coin table with predecessor and reconstruction trace. | Fill a table; handle unreachable states; add a state dimension for one-use coins. | 06, 13, 16 |

## Deep-study route

The 24 long-form studies follow six themes: models and foundations; algorithmic techniques; structured data; graphs and paths; choices and text; and limits and new tools. They cover amortized analysis, FFT, probability, sorting lower bounds, balanced search trees, hashing guarantees, heaps, Fenwick and segment trees, MST and union-find, single-source and all-pairs shortest paths, DP over a subproblem DAG, greedy and matroid reasoning, max-flow/min-cut, exact matching, tries and suffix structures, P/NP and reductions, approximation and parameterized algorithms, randomness, and modern complexity frontiers.

Study pages are progressively deeper reference chapters. The guided path establishes the models and vocabulary they use. Each study includes its own examples, figures, and exercises; readers can return to the guided figures when a mechanism needs to be seen step by step.

## Quality bar

- A visual state must match the written algorithm, including tiny, duplicate, absent, and adversarial inputs.
- Complexity claims must name the operation, input size, case, and extra-space convention when relevant.
- A highlighted element must have a truthful semantic meaning; a color cannot claim a final position before that is proved.
- The reader should be able to step backward, use keyboard controls, read a textual state description, and use a narrow phone viewport.
- Practice prompts stay unsolved on lesson pages so readers must transfer the idea to a new case.
