/* The Visual DSA curriculum: the single source of truth for navigation, the home map,
   search, and reading progress. Paths are relative to the site root.
   A lesson's page lives at lessons/<id>.html. `status` is 'live' once the page exists. */
(function (root) {
  'use strict';

  var units = [
    { id: 'u1', number: 1, title: 'How computers think', blurb: 'Algorithms, bits, memory, control flow, the call stack, and how to measure work.', color: '#5a4ff3' },
    { id: 'u2', number: 2, title: 'Linear structures', blurb: 'Arrays, strings, linked lists, stacks, queues and hash tables — data in a line.', color: '#0899b5' },
    { id: 'u3', number: 3, title: 'Searching & sorting', blurb: 'Recursion, binary search and every classic way to put things in order.', color: '#e08a00' },
    { id: 'u4', number: 4, title: 'Trees', blurb: 'Hierarchies that make search, priority, prefixes and ranges fast.', color: '#12a37a' },
    { id: 'u5', number: 5, title: 'Graphs', blurb: 'Networks: traversal, ordering, shortest paths, spanning trees and flow.', color: '#e5484d' },
    { id: 'u6', number: 6, title: 'Design paradigms', blurb: 'Greedy choices, backtracking, dynamic programming and string matching.', color: '#c2359a' },
    { id: 'u7', number: 7, title: 'Limits & frontiers', blurb: 'What cannot be computed quickly — and how randomness helps anyway.', color: '#7a4ff0' }
  ];

  // [id, unit, title, subtitle, minutes, keywords, study (deep reference) or null]
  var rows = [
    ['01-algorithms', 'u1', 'What is an algorithm?', 'Precise steps, a changing state, and a flowchart you can follow.', 25, 'algorithm steps instructions flowchart state program recipe', null],
    ['02-bits-and-memory', 'u1', 'Bits, bytes & memory', 'How a machine stores numbers, text and variables in addressed cells.', 18, 'binary bits bytes hexadecimal memory address RAM variable encoding ASCII two\'s complement', 'dsa-00-cost-of-a-computation'],
    ['03-control-flow', 'u1', 'Decisions & loops', 'Branches choose, loops repeat, and every loop must make progress.', 15, 'if else while for loop condition branch iteration termination', null],
    ['04-functions-and-the-stack', 'u1', 'Functions & the call stack', 'Stack frames, the heap, references, and what happens on return.', 18, 'function call stack frame heap reference pointer parameter return scope', null],
    ['05-big-o', 'u1', 'Complexity & Big-O', 'Count the work as input grows: constant, log, linear, n log n, quadratic, exponential.', 20, 'big o complexity time space asymptotic growth logarithmic linear quadratic exponential best worst average', 'dsa-00-cost-of-a-computation'],

    ['06-arrays', 'u2', 'Arrays & dynamic arrays', 'Contiguous memory, O(1) indexing, shifting costs, and doubling growth.', 18, 'array contiguous index insert delete shift dynamic array resize doubling amortized vector', 'dsa-02-amortized-cost-aggregate-accounting-potential'],
    ['07-strings-and-two-pointers', 'u2', 'Strings, two pointers & windows', 'Characters in a row, and the patterns that scan them in one pass.', 18, 'string character two pointers sliding window palindrome reverse substring prefix sum', 'dsa-01-linear-layouts-and-access-disciplines'],
    ['08-linked-lists', 'u2', 'Linked lists', 'Nodes and next-pointers: insert, delete, reverse, and detect cycles.', 18, 'linked list node pointer singly doubly circular reverse cycle floyd tortoise hare', 'dsa-01-linear-layouts-and-access-disciplines'],
    ['09-stacks', 'u2', 'Stacks', 'Last in, first out: undo, brackets, expressions and monotonic stacks.', 16, 'stack LIFO push pop peek parentheses postfix expression monotonic stack undo', 'dsa-01-linear-layouts-and-access-disciplines'],
    ['10-queues', 'u2', 'Queues & deques', 'First in, first out: circular buffers, deques and waiting lines.', 15, 'queue FIFO enqueue dequeue circular buffer ring deque double ended', 'dsa-01-linear-layouts-and-access-disciplines'],
    ['11-hash-tables', 'u2', 'Hash tables', 'Turn a key into an address: hashing, collisions, probing and resizing.', 20, 'hash table map dictionary set hash function collision chaining open addressing linear probing load factor rehash', 'dsa-08-hashing-and-expected-constant-access'],

    ['12-recursion', 'u3', 'Recursion', 'A function that calls itself: base cases, the call stack and recursion trees.', 20, 'recursion recursive base case call stack recursion tree factorial fibonacci hanoi', 'dsa-03-divide-solve-combine'],
    ['13-binary-search', 'u3', 'Binary search', 'Halve the search space every step — on arrays and on answers.', 16, 'binary search sorted halving lower bound upper bound bisect search on answer', null],
    ['14-elementary-sorts', 'u3', 'Bubble, selection & insertion sort', 'Three simple sorts, three invariants, and why they are quadratic.', 20, 'bubble sort selection sort insertion sort stable in place quadratic invariant', 'dsa-06-sorting-and-the-comparison-barrier'],
    ['15-merge-sort', 'u3', 'Merge sort & divide and conquer', 'Split, sort the halves, merge — and the recursion tree that proves n log n.', 18, 'merge sort divide and conquer merge recursion tree master theorem stable n log n', 'dsa-03-divide-solve-combine'],
    ['16-quick-sort', 'u3', 'Quick sort & quickselect', 'Partition around a pivot; why pivot choice decides everything.', 18, 'quick sort quicksort partition pivot lomuto hoare quickselect randomized worst case', 'dsa-06-sorting-and-the-comparison-barrier'],
    ['17-linear-time-sorts', 'u3', 'Counting, radix & the n log n barrier', 'Sorting without comparisons, and why comparisons can’t beat n log n.', 18, 'counting sort radix sort bucket sort lower bound decision tree comparison barrier', 'dsa-06-sorting-and-the-comparison-barrier'],

    ['18-trees', 'u4', 'Trees & traversals', 'Roots, children, height — and four ways to walk every node.', 18, 'tree binary tree root leaf height depth traversal preorder inorder postorder level order', 'dsa-07-balanced-search-trees'],
    ['19-binary-search-trees', 'u4', 'Binary search trees', 'Left is smaller, right is larger: search, insert, delete.', 18, 'binary search tree BST insert delete successor search ordered', 'dsa-07-balanced-search-trees'],
    ['20-balanced-trees', 'u4', 'Balanced trees: AVL & red-black', 'Rotations that keep height logarithmic no matter the input order.', 22, 'AVL red black tree rotation balance factor self balancing B-tree height', 'dsa-07-balanced-search-trees'],
    ['21-heaps', 'u4', 'Heaps & priority queues', 'A tree in an array that always knows its smallest item — and heap sort.', 20, 'heap priority queue min heap max heap sift up sift down heapify heap sort', 'dsa-09-partial-order-is-enough-heaps-and-priority-queues'],
    ['22-tries', 'u4', 'Tries', 'A tree of characters for prefixes, autocomplete and dictionaries.', 15, 'trie prefix tree autocomplete dictionary word search', 'dsa-19-tries-and-suffix-structures'],
    ['23-segment-and-fenwick-trees', 'u4', 'Segment & Fenwick trees', 'Answer range queries and updates in logarithmic time.', 22, 'segment tree fenwick binary indexed tree range query range sum prefix sum lazy', 'dsa-10-range-queries-fenwick-and-segment-trees'],
    ['24-union-find', 'u4', 'Union-find', 'Disjoint sets with path compression and union by rank.', 16, 'union find disjoint set union DSU path compression rank connected components', 'dsa-12-minimum-spanning-trees-and-union-find'],

    ['25-graphs', 'u5', 'Graphs & representations', 'Vertices, edges, directions, weights — as matrices and lists.', 16, 'graph vertex edge directed undirected weighted adjacency matrix adjacency list degree', 'dsa-11-graphs-and-their-traversals'],
    ['26-bfs-and-dfs', 'u5', 'BFS & DFS', 'Two ways to explore: a queue spreads in waves, a stack dives deep.', 20, 'breadth first search depth first search BFS DFS traversal flood fill connected components grid', 'dsa-11-graphs-and-their-traversals'],
    ['27-topological-sort', 'u5', 'Topological sort & cycles', 'Order tasks by dependency; detect cycles; find strongly connected parts.', 18, 'topological sort DAG kahn cycle detection dependency strongly connected components', 'dsa-11-graphs-and-their-traversals'],
    ['28-dijkstra-and-a-star', 'u5', 'Dijkstra & A*', 'Shortest paths with a priority queue, and a heuristic that aims.', 22, 'dijkstra shortest path priority queue relaxation A star heuristic pathfinding', 'dsa-13-single-source-shortest-paths'],
    ['29-bellman-ford-and-floyd-warshall', 'u5', 'Bellman-Ford & Floyd-Warshall', 'Negative edges, negative cycles, and all-pairs distances.', 20, 'bellman ford floyd warshall negative edge negative cycle all pairs shortest path', 'dsa-14-all-pairs-shortest-paths-floyd-warshall-johnson'],
    ['30-minimum-spanning-trees', 'u5', 'Minimum spanning trees', 'Connect everything cheaply: Kruskal, Prim and the cut property.', 18, 'minimum spanning tree MST kruskal prim cut property union find', 'dsa-12-minimum-spanning-trees-and-union-find'],
    ['31-network-flow', 'u5', 'Max flow & min cut', 'Push flow through pipes; the bottleneck cut that limits it.', 22, 'max flow min cut ford fulkerson edmonds karp residual graph augmenting path bipartite matching', 'dsa-17-max-flow-min-cut-and-the-power-of-duality'],

    ['32-greedy', 'u6', 'Greedy algorithms', 'Take the best-looking choice — and prove when that is safe.', 20, 'greedy activity selection interval scheduling huffman coding exchange argument coin change', 'dsa-16-when-is-greedy-optimal-exchange-arguments-and-matroids'],
    ['33-backtracking', 'u6', 'Backtracking', 'Try, recurse, undo: N-Queens, subsets, permutations and Sudoku.', 20, 'backtracking n queens subsets permutations sudoku pruning search tree', null],
    ['34-dynamic-programming', 'u6', 'Dynamic programming I', 'Overlapping subproblems: memoization, tabulation and the subproblem DAG.', 22, 'dynamic programming DP memoization tabulation fibonacci climbing stairs coin change subproblem', 'dsa-15-dynamic-programming-optimal-substructure-over-a-subproblem-dag'],
    ['35-dynamic-programming-2d', 'u6', 'Dynamic programming II', 'Grids of subproblems: LCS, edit distance and knapsack.', 22, 'dynamic programming 2D LCS longest common subsequence edit distance levenshtein knapsack grid paths', 'dsa-15-dynamic-programming-optimal-substructure-over-a-subproblem-dag'],
    ['36-string-matching', 'u6', 'String matching', 'Find a pattern fast: KMP, Rabin–Karp and the Z-algorithm.', 20, 'string matching pattern KMP knuth morris pratt rabin karp rolling hash z algorithm', 'dsa-18-linear-time-exact-matching'],

    ['37-p-vs-np', 'u7', 'P, NP & hard problems', 'Easy to check, hard to find: reductions, NP-completeness, approximation.', 22, 'P NP NP complete NP hard reduction SAT traveling salesman approximation', 'dsa-20-p-np-reductions-and-np-completeness'],
    ['38-randomized-algorithms', 'u7', 'Randomized algorithms', 'Coin flips as a tool: skip lists, Bloom filters, sampling and Monte Carlo.', 20, 'randomized algorithm probability skip list bloom filter reservoir sampling monte carlo las vegas', 'dsa-22-randomness-as-a-design-tool']
  ];

  var labs = [
    { id: 'sorting-arena', title: 'Sorting arena', blurb: 'Race every sorting algorithm on the same input.', href: 'labs/sorting-arena.html' },
    { id: 'pathfinder', title: 'Pathfinder', blurb: 'Draw walls, then watch BFS, DFS, Dijkstra and A* search a grid.', href: 'labs/pathfinder.html' },
    { id: 'graph-studio', title: 'Graph studio', blurb: 'Build any graph and run traversals, shortest paths and MSTs on it.', href: 'labs/graph-studio.html' },
    { id: 'tree-studio', title: 'Tree studio', blurb: 'Insert and delete in BSTs, AVL trees, red-black trees and heaps.', href: 'labs/tree-studio.html' },
    { id: 'big-o-explorer', title: 'Big-O explorer', blurb: 'See growth rates side by side and feel what n² really means.', href: 'labs/big-o-explorer.html' },
    { id: 'structure-chooser', title: 'Which structure?', blurb: 'A flowchart that helps you pick the right data structure.', href: 'labs/structure-chooser.html' },
    { id: 'history', title: 'A history of algorithms', blurb: 'From Euclid to Dijkstra: who discovered what, and why.', href: 'labs/history.html' },
    { id: 'cheatsheet', title: 'Complexity cheat sheet', blurb: 'Every structure and algorithm, every cost, on one page.', href: 'labs/cheatsheet.html' },
    { id: 'code-machine', title: 'Instruction machine', blurb: 'Watch fetch, decode and execute inside a tiny 8-bit computer.', href: 'labs/code-machine.html' }
  ];

  var lessons = rows.map(function (r, i) {
    return {
      id: r[0], number: i + 1, unit: r[1], title: r[2], subtitle: r[3], minutes: r[4], keywords: r[5],
      study: r[6] ? 'studies/' + r[6] + '.html' : null,
      href: 'lessons/' + r[0] + '.html',
      status: 'planned'
    };
  });

  var api = {
    units: units,
    lessons: lessons,
    labs: labs,
    byId: function (id) { for (var i = 0; i < lessons.length; i++) if (lessons[i].id === id) return lessons[i]; return null; },
    unitOf: function (lesson) { for (var i = 0; i < units.length; i++) if (units[i].id === lesson.unit) return units[i]; return null; },
    lessonsIn: function (unitId) { return lessons.filter(function (l) { return l.unit === unitId; }); },
    /* Mark lessons whose pages exist. Updated as lessons land. */
    markLive: function (ids) { ids.forEach(function (id) { var l = api.byId(id); if (l) l.status = 'live'; }); }
  };

  // Lessons that are published. Keep in sync with lessons/*.html (tests/site_integrity.py checks this).
  api.markLive(['01-algorithms', '02-bits-and-memory', '05-big-o', '06-arrays', '08-linked-lists', '14-elementary-sorts']);

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDSA_CURRICULUM = api;
}(typeof window !== 'undefined' ? window : null));
