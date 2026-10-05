/* Complexity reference data shared by three labs: Big-O explorer, Which structure?, Complexity cheat sheet.
   Pure data plus a few helpers (no DOM). UMD: window.VDSA_REF and module.exports.

   Cost strings are written for people ("O((V + E) log V)"). `key()` maps a cost string to the Big-O badge colour
   class of its dominant term (data-o="1|logn|sqrtn|n|nlogn|n2|n3|2n|nfact"); add "|n2" to a string to force a key.
   Every entry was checked against the standard references (CLRS, Sedgewick, Skiena, Knuth). */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ cost helpers */
  function split(t) {
    var i = String(t).lastIndexOf('|');
    return i > 0 && /^[a-z0-9]+$/.test(t.slice(i + 1)) ? { text: t.slice(0, i), key: t.slice(i + 1) } : { text: String(t), key: null };
  }
  function keyOf(t) {
    var p = split(t);
    if (p.key) return p.key;
    var s = p.text.replace(/^O\(/, '').replace(/\)$/, '');
    if (/!/.test(s)) return 'nfact';
    if (/[ⁿ]/.test(s)) return '2n';
    if (/³/.test(s)) return 'n3';
    if (/²/.test(s)) return 'n2';
    if (/√/.test(s)) return 'sqrtn';
    if (s === '1' || /^α/.test(s) || /^1\b/.test(s)) return '1';
    if (/log/.test(s)) return /[A-Za-z\)]\s*·?\s*log/.test(s) ? 'nlogn' : 'logn';
    if (/^[nVELkdm]$/.test(s) || /[+]/.test(s) || /\b[nVEmLk]\b/.test(s)) return 'n';
    return 'n';
  }
  function text(t) { return split(t).text; }

  /* A structure cost cell: o('O(1)', 'caption', 'O(n)' worst). Optional amortised marker via note text. */
  function o(t, note, worst) { return { t: t, n: note || '', w: worst || '' }; }
  var NA = { t: '—', n: '', w: '' };

  /* ------------------------------------------------------------------ data structures */
  /* ops: access / search / insert / delete / space. `caps`: what it is good at (used by the chooser filter).
     tag: sequence | tree | hash | priority | range | sets | graph */
  var STRUCTURES = [
    { id: 'array', name: 'Array', short: 'Array', tag: 'sequence', lesson: '06-arrays',
      ops: { access: o('O(1)', 'by index'), search: o('O(n)', 'O(log n) if sorted'), insert: o('O(n)', 'shift the tail; fixed size'), del: o('O(n)', 'shift the tail'), space: o('O(n)') },
      caps: ['index'],
      note: 'Contiguous memory: the fastest reads and the friendliest to the cache.',
      use: 'You know the size in advance and read by position far more often than you insert or delete.',
      avoid: 'The size is unknown, or you insert and delete in the middle a lot: every insert shifts the tail.' },
    { id: 'dynamic-array', name: 'Dynamic array (vector, list, ArrayList)', short: 'Dynamic array', tag: 'sequence', lesson: '06-arrays',
      ops: { access: o('O(1)', 'by index'), search: o('O(n)', 'O(log n) if sorted'), insert: o('O(n)', 'middle; O(1) amortized at the end'), del: o('O(n)', 'middle; O(1) at the end'), space: o('O(n)', 'up to 2n reserved') },
      caps: ['index', 'lifo'],
      note: 'An array that doubles when full, so appending is O(1) amortized.',
      use: 'Your default sequence: you append, iterate and read by index.',
      avoid: 'You insert or delete near the front or middle often (use a deque or linked list), or one resize pause is unacceptable.' },
    { id: 'sorted-array', name: 'Sorted array', short: 'Sorted array', tag: 'sequence', lesson: '13-binary-search',
      ops: { access: o('O(1)', 'by index'), search: o('O(log n)', 'binary search'), insert: o('O(n)', 'find O(log n), then shift'), del: o('O(n)', 'shift the tail'), space: o('O(n)') },
      caps: ['index', 'lookup', 'order', 'range'],
      note: 'Binary search finds any key or range boundary in O(log n); the price is slow updates.',
      use: 'The data is built once (or rarely changes) and you search it many times, or need ranges and neighbours.',
      avoid: 'Inserts and deletes are frequent: every one moves O(n) items.' },
    { id: 'sll', name: 'Singly linked list', short: 'Linked list', tag: 'sequence', lesson: '08-linked-lists',
      ops: { access: o('O(n)', 'walk from the head'), search: o('O(n)', 'scan node by node'), insert: o('O(1)', 'at the head, or after a node you hold'), del: o('O(1)', 'head, or after a node you hold; O(n) to find it'), space: o('O(n)', 'plus a pointer per node') },
      caps: ['insert', 'lifo'],
      note: 'Nodes joined by pointers: splicing is cheap, jumping to the k-th item is not.',
      use: 'You insert and remove at known positions (the head, or next to a node you already hold) and never need an index.',
      avoid: 'You read by index or scan a lot: every step is a pointer chase and a likely cache miss.' },
    { id: 'dll', name: 'Doubly linked list', short: 'Doubly linked list', tag: 'sequence', lesson: '08-linked-lists',
      ops: { access: o('O(n)', 'walk from either end'), search: o('O(n)', 'scan node by node'), insert: o('O(1)', 'at either end, or next to a node you hold'), del: o('O(1)', 'any node you hold, no predecessor search'), space: o('O(n)', 'two pointers per node') },
      caps: ['insert', 'fifo', 'lifo'],
      note: 'Every node knows both neighbours, so a node can remove itself.',
      use: 'You keep handles to nodes and delete or move them in O(1): an LRU cache, an editor buffer, a playlist.',
      avoid: 'You mostly iterate or index: an array is smaller and faster.' },
    { id: 'stack', name: 'Stack', short: 'Stack', tag: 'sequence', lesson: '09-stacks',
      ops: { access: o('O(1)', 'peek the top only'), search: o('O(n)'), insert: o('O(1)', 'push'), del: o('O(1)', 'pop'), space: o('O(n)') },
      caps: ['lifo'],
      note: 'Last in, first out.',
      use: 'Undo, bracket matching, depth-first search, expression evaluation, anything that backtracks.',
      avoid: 'You need the oldest item first (queue), or anything but the top.' },
    { id: 'queue', name: 'Queue', short: 'Queue', tag: 'sequence', lesson: '10-queues',
      ops: { access: o('O(1)', 'peek the front'), search: o('O(n)'), insert: o('O(1)', 'enqueue'), del: o('O(1)', 'dequeue'), space: o('O(n)') },
      caps: ['fifo'],
      note: 'First in, first out. A circular buffer or a linked list gives O(1) at both ends.',
      use: 'Fairness and waves: print jobs, breadth-first search, buffering between a producer and a consumer.',
      avoid: 'Items have priorities (use a heap), or you need both ends (deque). A plain array with shift() is O(n) per dequeue.' },
    { id: 'deque', name: 'Deque (double-ended queue)', short: 'Deque', tag: 'sequence', lesson: '10-queues',
      ops: { access: o('O(1)', 'ring buffer, by index'), search: o('O(n)'), insert: o('O(1)', 'either end'), del: o('O(1)', 'either end'), space: o('O(n)') },
      caps: ['fifo', 'lifo', 'index'],
      note: 'Push and pop at both ends. Also the workhorse of sliding-window tricks.',
      use: 'Sliding-window maximum, work stealing, a stack and queue in one, palindrome checks.',
      avoid: 'You only ever use one end: a plain stack or queue says so more clearly.' },
    { id: 'hash-table', name: 'Hash table (map, dict, set)', short: 'Hash table', tag: 'hash', lesson: '11-hash-tables',
      ops: { access: NA, search: o('O(1)', 'average, by key', 'O(n)'), insert: o('O(1)', 'average, amortized', 'O(n)'), del: o('O(1)', 'average', 'O(n)'), space: o('O(n)', 'load factor < 1') },
      caps: ['lookup'],
      note: 'A key becomes an array index through a hash function. The worst case is every key colliding.',
      use: 'Lookup, membership, counting and de-duplication by exact key.',
      avoid: 'You need sorted order, ranges, prefixes or predictable worst-case latency. Keys with no good hash are a problem too.' },
    { id: 'skip-list', name: 'Skip list', short: 'Skip list', tag: 'tree', lesson: '38-randomized-algorithms',
      ops: { access: NA, search: o('O(log n)', 'expected', 'O(n)'), insert: o('O(log n)', 'expected', 'O(n)'), del: o('O(log n)', 'expected', 'O(n)'), space: o('O(n)', 'expected, about 2n pointers') },
      caps: ['lookup', 'order', 'range'],
      note: 'A sorted linked list with random express lanes. It behaves like a balanced tree without rotations.',
      use: 'An ordered map that is easy to make concurrent (Redis sorted sets use one).',
      avoid: 'You need hard worst-case bounds, or memory is tight.' },
    { id: 'bst', name: 'Binary search tree (unbalanced)', short: 'BST', tag: 'tree', lesson: '19-binary-search-trees',
      ops: { access: NA, search: o('O(log n)', 'average', 'O(n)'), insert: o('O(log n)', 'average', 'O(n)'), del: o('O(log n)', 'average', 'O(n)'), space: o('O(n)') },
      caps: ['lookup', 'order', 'range'],
      note: 'Left is smaller, right is larger. Sorted insertions turn it into a linked list.',
      use: 'Learning, or data that arrives in random order and you want sorted traversal.',
      avoid: 'Input might arrive sorted or adversarially: use a balanced tree.' },
    { id: 'balanced-bst', name: 'Balanced BST (AVL, red-black)', short: 'Balanced BST', tag: 'tree', lesson: '20-balanced-trees',
      ops: { access: NA, search: o('O(log n)', 'worst case'), insert: o('O(log n)', 'worst case'), del: o('O(log n)', 'worst case'), space: o('O(n)') },
      caps: ['lookup', 'order', 'range'],
      note: 'Rotations keep the height at O(log n) whatever the insertion order. TreeMap, std::map and BTreeMap-style ordered maps use this idea.',
      use: 'An ordered map or set: lookups plus min, max, predecessor, successor and range queries.',
      avoid: 'Order does not matter (a hash table is faster), or the data is static (a sorted array is smaller).' },
    { id: 'heap', name: 'Binary heap (priority queue)', short: 'Heap', tag: 'priority', lesson: '21-heaps',
      ops: { access: o('O(1)', 'peek the min or max'), search: o('O(n)', 'no order beyond the top'), insert: o('O(log n)', 'O(1) on average for random keys'), del: o('O(log n)', 'extract the min or max'), space: o('O(n)', 'in place in an array') },
      caps: ['min', 'insert'],
      note: 'A tree stored in an array where every parent beats its children. Building one from n items is O(n).',
      use: 'Repeatedly take the smallest or largest: schedulers, Dijkstra, top-k, merging sorted streams.',
      avoid: 'You need to search by key or walk in sorted order: a heap only knows its top.' },
    { id: 'trie', name: 'Trie (prefix tree)', short: 'Trie', tag: 'tree', lesson: '22-tries',
      ops: { access: NA, search: o('O(L)', 'L = key length'), insert: o('O(L)', 'L = key length'), del: o('O(L)', 'L = key length'), space: o('O(N·L)', 'worst case, N keys of length L') },
      caps: ['lookup', 'prefix', 'order'],
      note: 'One node per character. The cost depends on the key length, not on how many keys are stored.',
      use: 'Autocomplete, spell check, longest-prefix match, word games, dictionaries with prefix queries.',
      avoid: 'Keys are not strings or share few prefixes: the pointers cost more memory than a hash table.' },
    { id: 'segment-tree', name: 'Segment tree', short: 'Segment tree', tag: 'range', lesson: '23-segment-and-fenwick-trees',
      ops: { access: o('O(1)', 'leaf value'), search: o('O(log n)', 'range query (sum, min, max, gcd)'), insert: o('O(log n)', 'point update; range update with lazy propagation'), del: NA, space: o('O(n)', 'about 2n to 4n nodes') },
      caps: ['range', 'insert'],
      note: 'Each node stores the answer for a segment. Any range decomposes into O(log n) nodes. Building takes O(n).',
      use: 'Range queries with updates for any associative operation: range minimum, sum, max, gcd, counts.',
      avoid: 'The data never changes (a prefix-sum array or sparse table is simpler) or you only need sums (Fenwick is smaller).' },
    { id: 'fenwick', name: 'Fenwick tree (binary indexed tree)', short: 'Fenwick tree', tag: 'range', lesson: '23-segment-and-fenwick-trees',
      ops: { access: NA, search: o('O(log n)', 'prefix sum; a range is two prefixes'), insert: o('O(log n)', 'point update'), del: NA, space: o('O(n)', 'exactly n cells') },
      caps: ['range', 'insert'],
      note: 'Cells that each cover a power-of-two block, found by bit tricks. It needs an invertible operation, such as sum.',
      use: 'Prefix and range sums with point updates; counting inversions; rank queries.',
      avoid: 'You need range minimum or max, or range updates with range queries: use a segment tree.' },
    { id: 'union-find', name: 'Union-find (disjoint sets)', short: 'Union-find', tag: 'sets', lesson: '24-union-find',
      ops: { access: NA, search: o('O(α(n))', 'find, amortized'), insert: o('O(α(n))', 'union, amortized'), del: NA, space: o('O(n)') },
      caps: ['connect'],
      note: 'Path compression plus union by rank make find and union effectively constant: α(n) is at most 4 for any n that fits in the universe.',
      use: 'Are a and b connected? Merge groups: Kruskal, connected components, percolation, friend groups.',
      avoid: 'You need to split groups apart again or list a group’s members quickly.' },
    { id: 'bloom', name: 'Bloom filter', short: 'Bloom filter', tag: 'sets', lesson: '38-randomized-algorithms',
      ops: { access: NA, search: o('O(k)|1', 'k hashes; false positives possible'), insert: o('O(k)|1', 'k hashes'), del: NA, space: o('O(m)', 'm bits, far less than the keys') },
      caps: ['lookup'],
      note: 'A bit array and k hash functions: "definitely not here" or "probably here", never a false negative.',
      use: 'A cheap first check before a slow lookup: caches, spell checkers, crawlers, databases.',
      avoid: 'You need certainty, need to delete items (a plain filter cannot), or need the stored keys back.' }
  ];
  /* Graph representations (V vertices, E edges): columns are different, so they live in their own table. */
  var GRAPH_REPS = [
    { id: 'adj-list', name: 'Adjacency list', short: 'Adjacency list', tag: 'graph', lesson: '25-graphs',
      ops: { access: o('O(deg)', 'is edge (u, v) present?; O(1) with hash sets'), search: o('O(deg)', 'list the neighbours of u'), insert: o('O(1)', 'add an edge'), del: o('O(deg)', 'remove an edge'), space: o('O(V + E)') },
      caps: ['neighbors'],
      note: 'Each vertex keeps a list of its neighbours. The default for sparse graphs, and what BFS, DFS and Dijkstra want.',
      use: 'Most real graphs: roads, networks, dependencies. Anything where E is much smaller than V².',
      avoid: 'The graph is dense, or you ask "is there an edge from u to v?" all the time.' },
    { id: 'adj-matrix', name: 'Adjacency matrix', short: 'Adjacency matrix', tag: 'graph', lesson: '25-graphs',
      ops: { access: o('O(1)', 'is edge (u, v) present?'), search: o('O(V)', 'list the neighbours of u'), insert: o('O(1)', 'add an edge'), del: o('O(1)', 'remove an edge'), space: o('O(V²)') },
      caps: ['neighbors'],
      note: 'A V × V table of edge weights. Wasteful when sparse, perfect for Floyd–Warshall and small dense graphs.',
      use: 'Dense graphs, small V, constant-time edge tests, or all-pairs algorithms and matrix tricks.',
      avoid: 'V is large and the graph is sparse: 100,000 vertices would need 10¹⁰ cells.' },
    { id: 'edge-list', name: 'Edge list', short: 'Edge list', tag: 'graph', lesson: '25-graphs',
      ops: { access: o('O(E)', 'is edge (u, v) present?'), search: o('O(E)', 'list the neighbours of u'), insert: o('O(1)', 'add an edge'), del: o('O(E)', 'remove an edge'), space: o('O(E)') },
      caps: ['neighbors'],
      note: 'Just the list of (u, v, weight) triples. Smallest to store; easy to sort by weight.',
      use: 'Kruskal’s algorithm, Bellman–Ford, reading graphs from files.',
      avoid: 'You traverse: every "who are the neighbours of u?" scans everything.' }
  ];

  /* ------------------------------------------------------------------ algorithms
     [id, group, name, best, avg, worst, space, notes, lesson, tag?]  (n items; V vertices, E edges; text length n, pattern m) */
  var A = function (id, group, name, best, avg, worst, space, notes, lesson) {
    return { id: id, group: group, name: name, best: best, avg: avg, worst: worst, space: space, notes: notes, lesson: lesson };
  };
  var ALGOS = [
    /* sorting */
    A('bubble', 'sorting', 'Bubble sort', 'O(n)', 'O(n²)', 'O(n²)', 'O(1)', 'Stable. The best case needs the early-exit check; otherwise every case is O(n²).', '14-elementary-sorts'),
    A('selection', 'sorting', 'Selection sort', 'O(n²)', 'O(n²)', 'O(n²)', 'O(1)', 'Not stable. Always O(n²) comparisons, but at most n − 1 swaps.', '14-elementary-sorts'),
    A('insertion', 'sorting', 'Insertion sort', 'O(n)', 'O(n²)', 'O(n²)', 'O(1)', 'Stable and adaptive: O(n + inversions). Fast on small or nearly sorted input.', '14-elementary-sorts'),
    A('merge', 'sorting', 'Merge sort', 'O(n log n)', 'O(n log n)', 'O(n log n)', 'O(n)', 'Stable. Needs O(n) extra space for arrays; predictable, good for linked lists and external sorting.', '15-merge-sort'),
    A('quick', 'sorting', 'Quick sort', 'O(n log n)', 'O(n log n)', 'O(n²)', 'O(log n)', 'Not stable. Worst case on bad pivots (sorted input with a first-element pivot); recurse into the smaller side first for O(log n) stack.', '16-quick-sort'),
    A('heap-sort', 'sorting', 'Heap sort', 'O(n log n)', 'O(n log n)', 'O(n log n)', 'O(1)', 'Not stable. In place with a guaranteed O(n log n), but poor cache behaviour.', '21-heaps'),
    A('timsort', 'sorting', 'Timsort', 'O(n)', 'O(n log n)', 'O(n log n)', 'O(n)', 'Stable. Merges natural runs, so already-sorted input is O(n). The sort in Python, Java (objects) and JavaScript engines.', '15-merge-sort'),
    A('counting', 'sorting', 'Counting sort', 'O(n + k)', 'O(n + k)', 'O(n + k)', 'O(n + k)', 'Stable. Not comparison-based: keys are integers in 0..k − 1, so it beats n log n when k = O(n).', '17-linear-time-sorts'),
    A('radix', 'sorting', 'Radix sort (LSD)', 'O(d(n + b))', 'O(d(n + b))', 'O(d(n + b))', 'O(n + b)', 'Stable. d digits in base b; one stable counting pass per digit.', '17-linear-time-sorts'),
    A('bucket', 'sorting', 'Bucket sort', 'O(n + k)', 'O(n + k)', 'O(n²)', 'O(n + k)', 'Stable if the per-bucket sort is stable. Fast for uniformly spread input; everything in one bucket costs O(n²) with insertion sort.', '17-linear-time-sorts'),
    A('quickselect', 'sorting', 'Quickselect (k-th smallest)', 'O(n)', 'O(n)', 'O(n²)', 'O(1)', 'Selection, not sorting. Expected linear with a random pivot; median of medians guarantees O(n) worst case.', '16-quick-sort'),
    /* searching */
    A('linear', 'searching', 'Linear search', 'O(1)', 'O(n)', 'O(n)', 'O(1)', 'Works on anything, sorted or not. Best case: the target is first.', '13-binary-search'),
    A('binary', 'searching', 'Binary search', 'O(1)', 'O(log n)', 'O(log n)', 'O(1)', 'Needs a sorted, indexable sequence (or a monotone predicate). O(log n) stack if written recursively.', '13-binary-search'),
    A('interpolation', 'searching', 'Interpolation search', 'O(1)', 'O(log log n)|logn', 'O(n)', 'O(1)', 'Sorted, uniformly distributed keys: guesses the position instead of halving. Skewed data degrades to O(n).', '13-binary-search'),
    A('hash-lookup', 'searching', 'Hash table lookup', 'O(1)', 'O(1)', 'O(n)', 'O(n)', 'Average O(1); the worst case is every key colliding (or an adversarial input).', '11-hash-tables'),
    A('bst-search', 'searching', 'BST search', 'O(1)', 'O(log n)', 'O(n)', 'O(1)', 'The worst case is a degenerate, list-shaped tree. A balanced tree makes it O(log n) always.', '19-binary-search-trees'),
    /* graphs */
    A('bfs', 'graphs', 'Breadth-first search', 'O(V + E)', 'O(V + E)', 'O(V + E)', 'O(V)', 'Fewest-edge paths in unweighted graphs. With an adjacency list; O(V²) with a matrix.', '26-bfs-and-dfs'),
    A('dfs', 'graphs', 'Depth-first search', 'O(V + E)', 'O(V + E)', 'O(V + E)', 'O(V)', 'Space is the stack depth, up to V. The engine of topological sort, cycle detection and SCCs.', '26-bfs-and-dfs'),
    A('topo', 'graphs', 'Topological sort', 'O(V + E)', 'O(V + E)', 'O(V + E)', 'O(V)', 'Kahn’s algorithm or DFS finish order. Only exists on a DAG; cycle detection comes for free.', '27-topological-sort'),
    A('scc', 'graphs', 'Strongly connected components', 'O(V + E)', 'O(V + E)', 'O(V + E)', 'O(V)', 'Tarjan or Kosaraju: two DFS passes at most.', '27-topological-sort'),
    A('dijkstra', 'graphs', 'Dijkstra (binary heap)', 'O((V + E) log V)', 'O((V + E) log V)', 'O((V + E) log V)', 'O(V)', 'Non-negative weights only. O(V²) with an array (better when dense); O(E + V log V) with a Fibonacci heap.', '28-dijkstra-and-a-star'),
    A('astar', 'graphs', 'A* search', 'O(d)', 'depends on h|n', 'O((V + E) log V)', 'O(V)', 'Best case: a perfect heuristic walks straight to the goal (d = path length). With a consistent heuristic it never expands more than Dijkstra; on huge implicit graphs the worst case is O(b^d).', '28-dijkstra-and-a-star'),
    A('bellman-ford', 'graphs', 'Bellman–Ford', 'O(E)', 'O(V E)', 'O(V E)', 'O(V)', 'Handles negative edges and detects negative cycles. The best case stops after one pass with no change.', '29-bellman-ford-and-floyd-warshall'),
    A('floyd-warshall', 'graphs', 'Floyd–Warshall', 'O(V³)', 'O(V³)', 'O(V³)', 'O(V²)', 'All-pairs shortest paths, negative edges allowed (no negative cycles). Three nested loops, always.', '29-bellman-ford-and-floyd-warshall'),
    A('kruskal', 'graphs', 'Kruskal (MST)', 'O(E log E)', 'O(E log E)', 'O(E log E)|nlogn', 'O(V)', 'Dominated by sorting the edges (E log E = O(E log V)); union-find adds O(E α(V)). Best for sparse graphs.', '30-minimum-spanning-trees'),
    A('prim', 'graphs', 'Prim (binary heap)', 'O(E log V)', 'O(E log V)', 'O(E log V)', 'O(V)', 'Grows one tree. O(V²) with an array is better for dense graphs; O(E + V log V) with a Fibonacci heap.', '30-minimum-spanning-trees'),
    A('edmonds-karp', 'graphs', 'Edmonds–Karp (max flow)', 'O(V E²)|n3', 'O(V E²)|n3', 'O(V E²)|n3', 'O(V + E)', 'Ford–Fulkerson with BFS augmenting paths: at most V E / 2 augmentations, O(E) each. Independent of the capacities.', '31-network-flow'),
    A('ford-fulkerson', 'graphs', 'Ford–Fulkerson (DFS)', 'O(E f)|n2', 'O(E f)|n2', 'O(E f)|n2', 'O(V + E)', 'Integer capacities: f is the max-flow value, so it is pseudo-polynomial and can be very slow on bad inputs.', '31-network-flow'),
    /* strings */
    A('naive-match', 'strings', 'Naive string matching', 'O(n)', 'O(n + m)', 'O(n m)|n2', 'O(1)', 'Text length n, pattern length m. Best case: the first character mismatches at every position.', '36-string-matching'),
    A('kmp', 'strings', 'Knuth–Morris–Pratt', 'O(n + m)', 'O(n + m)', 'O(n + m)', 'O(m)', 'The failure table (O(m) to build) means the text pointer never moves back.', '36-string-matching'),
    A('rabin-karp', 'strings', 'Rabin–Karp', 'O(n + m)', 'O(n + m)', 'O(n m)|n2', 'O(1)', 'Rolling hash; the worst case is every window colliding. Shines when searching for many patterns at once.', '36-string-matching'),
    A('z-algo', 'strings', 'Z-algorithm', 'O(n + m)', 'O(n + m)', 'O(n + m)', 'O(n + m)', 'Z-array of pattern + "$" + text. Linear; also solves borders and periods.', '36-string-matching'),
    A('trie-lookup', 'strings', 'Trie word lookup', 'O(L)', 'O(L)', 'O(L)', 'O(N·L)', 'L = word length, independent of the number of words. Prefix queries cost O(L + output).', '22-tries'),
    /* paradigms */
    A('fib-naive', 'paradigms', 'Fibonacci, plain recursion', 'O(2ⁿ)', 'O(2ⁿ)', 'O(2ⁿ)', 'O(n)', 'Really Θ(φⁿ) with φ ≈ 1.618, inside O(2ⁿ). The call tree recomputes the same subproblems; stack depth is n.', '34-dynamic-programming'),
    A('fib-dp', 'paradigms', 'Fibonacci, memoized or tabulated', 'O(n)', 'O(n)', 'O(n)', 'O(n)', 'O(1) space if you keep only the last two values.', '34-dynamic-programming'),
    A('coin-change', 'paradigms', 'Coin change (min coins)', 'O(n·A)|n2', 'O(n·A)|n2', 'O(n·A)|n2', 'O(A)', 'n coin types, target amount A. Pseudo-polynomial: A is a value, not a size.', '34-dynamic-programming'),
    A('lis', 'paradigms', 'Longest increasing subsequence', 'O(n log n)', 'O(n log n)', 'O(n log n)', 'O(n)', 'Patience sorting with binary search. The plain DP is O(n²).', '34-dynamic-programming'),
    A('knapsack', 'paradigms', '0/1 knapsack (DP)', 'O(n W)|n2', 'O(n W)|n2', 'O(n W)|n2', 'O(W)', 'n items, capacity W. Pseudo-polynomial; the table is O(n W), one row is enough for the value.', '35-dynamic-programming-2d'),
    A('lcs', 'paradigms', 'Longest common subsequence', 'O(n m)|n2', 'O(n m)|n2', 'O(n m)|n2', 'O(n m)|n2', 'Table of (n + 1) × (m + 1). O(min(n, m)) space if you only want the length.', '35-dynamic-programming-2d'),
    A('edit-distance', 'paradigms', 'Edit distance (Levenshtein)', 'O(n m)|n2', 'O(n m)|n2', 'O(n m)|n2', 'O(n m)|n2', 'Same table shape as LCS; two rows suffice for the distance alone.', '35-dynamic-programming-2d'),
    A('activity', 'paradigms', 'Activity selection (greedy)', 'O(n log n)', 'O(n log n)', 'O(n log n)', 'O(1)', 'Sort by finish time, then one linear pass. The sort dominates.', '32-greedy'),
    A('huffman', 'paradigms', 'Huffman coding (greedy)', 'O(n log n)', 'O(n log n)', 'O(n log n)', 'O(n)', 'n symbols, a min-heap of trees: n − 1 merges, each O(log n).', '32-greedy'),
    A('subsets', 'paradigms', 'Backtracking: all subsets', 'O(n 2ⁿ)|2n', 'O(n 2ⁿ)|2n', 'O(n 2ⁿ)|2n', 'O(n)', '2ⁿ subsets, up to n items to copy for each. Output-bound: you cannot beat the size of the answer.', '33-backtracking'),
    A('permutations', 'paradigms', 'Backtracking: all permutations', 'O(n n!)|nfact', 'O(n n!)|nfact', 'O(n n!)|nfact', 'O(n)', 'n! orderings, O(n) to copy each one. Output-bound.', '33-backtracking'),
    A('n-queens', 'paradigms', 'Backtracking: N-Queens', 'O(n!)', 'O(n!)', 'O(n!)', 'O(n)', 'Upper bound n!; pruning of attacked squares cuts the real count enormously, but no polynomial bound is known.', '33-backtracking'),
    A('sudoku', 'paradigms', 'Backtracking: Sudoku', 'O(1)|1', 'exponential|2n', 'O(9^e)|2n', 'O(e)', 'e = number of empty cells. Fixed 9 × 9 board, so technically constant, but the search is exponential in e; constraint propagation prunes hard.', '33-backtracking')
  ];
  var GROUPS = [
    { id: 'sorting', label: 'Sorting' }, { id: 'searching', label: 'Searching' }, { id: 'graphs', label: 'Graphs' },
    { id: 'strings', label: 'Strings' }, { id: 'paradigms', label: 'Paradigms' }
  ];

  var api = {
    STRUCTURES: STRUCTURES, GRAPH_REPS: GRAPH_REPS, ALGOS: ALGOS, GROUPS: GROUPS,
    key: keyOf, text: text, o: o,
    structure: function (id) {
      for (var i = 0; i < STRUCTURES.length; i++) if (STRUCTURES[i].id === id) return STRUCTURES[i];
      for (var j = 0; j < GRAPH_REPS.length; j++) if (GRAPH_REPS[j].id === id) return GRAPH_REPS[j];
      return null;
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDSA_REF = api;
}(typeof window !== 'undefined' ? window : null));
