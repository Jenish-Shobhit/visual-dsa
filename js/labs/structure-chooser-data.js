/* Which structure? — the decision tree and scenarios as pure data (UMD: window.VDSA_CHOOSER, module.exports).
   Leaf ids are structure ids from reference-data.js. Tested in tests/labs/structure-chooser.test.js. */
(function (root) {
  'use strict';

  /* q: full question for the "ask me" cards; hint: an example; t: terse text inside the flowchart diamond. */
  function Q(id, t, col, row, q, hint) { return { id: id, type: 'decision', text: t, col: col, row: row, q: q, hint: hint }; }
  function L(id, text, col, row) { return { id: id, type: 'end', text: text, col: col, row: row, rec: id }; }

  var NODES = [
    { id: 'start', type: 'start', text: 'What do you need?', col: 0, row: 0 },
    Q('q_key', 'Look up by key?', 0, 1, 'Do you need to look items up by a key: a name, an id, a word?', 'Find user 42. Is “apple” in the dictionary?'),
    Q('q_order', 'Sorted order or key ranges?', 1, 1, 'Do you also need the keys in sorted order, or everything between two keys?', 'Next larger key, the top 10, all orders from May.'),
    Q('q_prefix', 'Prefix queries on strings?', 2, 1, 'Are the keys strings, and do you need “everything starting with…”?', 'Autocomplete, spell-check suggestions.'),
    Q('q_static', 'Data never changes?', 2, 2, 'Is the data built once and never (or rarely) changed?', 'A read-only price list, loaded at start-up.'),
    Q('q_min', 'Repeatedly need the min or max?', 0, 4, 'Do you repeatedly need the smallest or largest item, while items keep arriving?', 'Next task by priority, the closest unvisited node.'),
    Q('q_range', 'Range sums / mins with updates?', 0, 5, 'Do you ask questions about a range of positions (sum, minimum, maximum) while values change?', 'Total sales between day 40 and day 90, after edits.'),
    Q('q_sum', 'Only sums?', 1, 5, 'Is it only sums (or counts), never minimum or maximum?', 'A running total can be undone by subtracting; a minimum cannot.'),
    Q('q_group', 'Merge groups, test “same group?”', 0, 6, 'Do items join into groups that merge over time, and you ask whether two items are in the same group?', 'Friends of friends, connected pixels, network components.'),
    Q('q_net', 'Items linked in a network?', 0, 7, 'Are your items connected to each other by relationships (roads, links, dependencies)?', 'Cities and roads, web pages and hyperlinks.'),
    Q('q_dense', 'Dense, or O(1) edge tests?', 1, 8, 'Is almost every pair connected, or do you constantly ask “is there an edge from u to v?”', 'A complete distance table between 200 cities.'),
    Q('q_lifo', 'Last in, first out?', 0, 10, 'Do you always take the item that arrived last?', 'Undo, matching brackets, backtracking.'),
    Q('q_fifo', 'First in, first out?', 0, 11, 'Do you always take the item that arrived first?', 'A print queue, breadth-first search.'),
    Q('q_ends', 'Need both ends?', 1, 11, 'Do you need to add or remove at both ends?', 'Sliding-window maximum, a work-stealing pool.'),
    Q('q_pos', 'Jump to items by position?', 0, 12, 'Do you jump straight to “the k-th item”?', 'The 5th photo in an album, pixel (x, y).'),
    Q('q_mid', 'Edit the middle often?', 0, 13, 'Do you insert or remove in the middle of the sequence a lot, with a handle on the spot rather than searching for it?', 'A playlist, a text editor’s cursor, an LRU cache’s recency list.'),
    Q('q_grow', 'Does the size change?', 1, 12, 'Does the number of items change while the program runs?', 'A shopping cart versus a fixed 8 × 8 board.'),
    L('hash-table', 'Hash table', 1, 2),
    L('trie', 'Trie', 3, 1),
    L('sorted-array', 'Sorted array', 3, 2),
    L('balanced-bst', 'Balanced BST', 2, 3),
    L('heap', 'Heap', 1, 4),
    L('fenwick', 'Fenwick tree', 2, 5),
    L('segment-tree', 'Segment tree', 2, 6),
    L('union-find', 'Union-find', 1, 6),
    L('adj-matrix', 'Adjacency matrix', 2, 8),
    L('adj-list', 'Adjacency list', 1, 9),
    L('stack', 'Stack', 1, 10),
    L('deque', 'Deque', 2, 11),
    L('queue', 'Queue', 2, 12),
    L('dynamic-array', 'Dynamic array', 1, 13),
    L('array', 'Array', 2, 13),
    L('dll', 'Doubly linked list', 0, 14)
  ];

  function E(from, to, label) { return { from: from, to: to, label: label, id: from + '.' + label }; }
  var EDGES = [
    { from: 'start', to: 'q_key', id: 'start.go' },
    E('q_key', 'q_order', 'yes'), E('q_key', 'q_min', 'no'),
    E('q_order', 'q_prefix', 'yes'), E('q_order', 'hash-table', 'no'),
    E('q_prefix', 'trie', 'yes'), E('q_prefix', 'q_static', 'no'),
    E('q_static', 'sorted-array', 'yes'), E('q_static', 'balanced-bst', 'no'),
    E('q_min', 'heap', 'yes'), E('q_min', 'q_range', 'no'),
    E('q_range', 'q_sum', 'yes'), E('q_range', 'q_group', 'no'),
    E('q_sum', 'fenwick', 'yes'), E('q_sum', 'segment-tree', 'no'),
    E('q_group', 'union-find', 'yes'), E('q_group', 'q_net', 'no'),
    E('q_net', 'q_dense', 'yes'), E('q_net', 'q_lifo', 'no'),
    E('q_dense', 'adj-matrix', 'yes'), E('q_dense', 'adj-list', 'no'),
    E('q_lifo', 'stack', 'yes'), E('q_lifo', 'q_fifo', 'no'),
    E('q_fifo', 'q_ends', 'yes'), E('q_fifo', 'q_pos', 'no'),
    E('q_ends', 'deque', 'yes'), E('q_ends', 'queue', 'no'),
    E('q_pos', 'q_grow', 'yes'), E('q_pos', 'q_mid', 'no'),
    E('q_mid', 'dll', 'yes'), E('q_mid', 'dynamic-array', 'no'),
    E('q_grow', 'dynamic-array', 'yes'), E('q_grow', 'array', 'no')
  ];

  /* Scenario answers are yes/no strings from the start question onward. `why` explains each landing. */
  var SCENARIOS = [
    { id: 'autocomplete', label: 'Autocomplete', blurb: 'Suggest words as you type.', answers: ['yes', 'yes', 'yes'], leaf: 'trie', why: 'Every suggestion starts with the letters typed so far: walk down the trie by that prefix and list what hangs below.' },
    { id: 'scheduler', label: 'Task scheduler', blurb: 'Always run the most urgent job next.', answers: ['no', 'yes'], leaf: 'heap', why: 'You only ever need the top priority, and new jobs keep arriving: a heap gives it in O(1) and takes inserts in O(log n).' },
    { id: 'undo', label: 'Undo', blurb: 'Step back through your edits.', answers: ['no', 'no', 'no', 'no', 'no', 'yes'], leaf: 'stack', why: 'The last edit is the first to be undone: last in, first out.' },
    { id: 'leaderboard', label: 'Leaderboard', blurb: 'Rank players by score, live.', answers: ['yes', 'yes', 'no', 'no'], leaf: 'balanced-bst', why: 'Scores change constantly, and you need ranks, neighbours and top-k in sorted order: a balanced tree keeps all of that at O(log n).' },
    { id: 'friends', label: 'Friend groups', blurb: 'Are Ana and Raj in the same circle?', answers: ['no', 'no', 'no', 'yes'], leaf: 'union-find', why: 'Friendships only ever merge circles, and the question is “same circle?”: union-find answers in near-constant time.' },
    { id: 'cache', label: 'Cache by user id', blurb: 'Fetch a profile by its id.', answers: ['yes', 'no'], leaf: 'hash-table', why: 'Exact key, no ordering needed: hashing gives O(1) on average.' },
    { id: 'print', label: 'Print queue', blurb: 'Jobs print in the order they arrive.', answers: ['no', 'no', 'no', 'no', 'no', 'no', 'yes', 'no'], leaf: 'queue', why: 'Fairness: first in, first out, with O(1) at both ends of the line.' },
    { id: 'window', label: 'Sliding-window max', blurb: 'The highest price in the last 5 minutes.', answers: ['no', 'no', 'no', 'no', 'no', 'no', 'yes', 'yes'], leaf: 'deque', why: 'New prices enter at one end, old ones leave from the other, and dominated prices drop off the back: a deque.' },
    { id: 'map', label: 'Road map', blurb: 'Cities and the roads between them.', answers: ['no', 'no', 'no', 'no', 'yes', 'no'], leaf: 'adj-list', why: 'Each city has a handful of roads out of V cities: an adjacency list stores V + E, not V².' },
    { id: 'sales', label: 'Sales totals', blurb: 'Revenue between two dates, after edits.', answers: ['no', 'no', 'yes', 'yes'], leaf: 'fenwick', why: 'Sums can be undone by subtracting two prefixes, so the compact Fenwick tree does range sums and updates in O(log n).' },
    { id: 'sensor', label: 'Coldest reading', blurb: 'The minimum temperature in a time range.', answers: ['no', 'no', 'yes', 'no'], leaf: 'segment-tree', why: 'A minimum cannot be subtracted away, so use a segment tree: any range splits into O(log n) stored answers.' },
    { id: 'album', label: 'Photo album', blurb: 'Open photo number 5, add photos over time.', answers: ['no', 'no', 'no', 'no', 'no', 'no', 'no', 'yes', 'yes'], leaf: 'dynamic-array', why: 'Jump by index in O(1) and append in O(1) amortized: the everyday dynamic array.' },
    { id: 'pricelist', label: 'Read-only price list', blurb: 'Loaded once, searched a million times.', answers: ['yes', 'yes', 'no', 'yes'], leaf: 'sorted-array', why: 'Nothing is inserted, so binary search on a sorted array gives O(log n) with the least memory and best cache behaviour.' },
    { id: 'playlist', label: 'Playlist editor', blurb: 'Drag songs in and out of the middle of a queue.', answers: ['no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'yes'], leaf: 'dll', why: 'You never ask for “song number k”, but you often unhook or splice a song at a spot you already hold: a doubly linked list does that in O(1) with no shifting.' },
    { id: 'log', label: 'Collect, then scan', blurb: 'Gather readings, then read them front to back.', answers: ['no', 'no', 'no', 'no', 'no', 'no', 'no', 'no', 'no'], leaf: 'dynamic-array', why: 'No lookups by key or position and no editing in the middle: just append and scan, which a dynamic array does with the best cache behaviour.' }
  ];

  var byId = {};
  NODES.forEach(function (n) { byId[n.id] = n; });
  function node(id) { return byId[id] || null; }
  function out(id) { return EDGES.filter(function (e) { return e.from === id; }); }
  function step(id, label) {
    var es = out(id);
    for (var i = 0; i < es.length; i++) if (es[i].label === label || (label === undefined && es.length === 1)) return es[i];
    return null;
  }
  /* answers → { path: [node ids], edges: [edge ids], leaf: id|null, complete } starting from 'q_key' (after start). */
  function walk(answers) {
    var path = ['start', 'q_key'], edges = ['start.go'], cur = 'q_key';
    for (var i = 0; i < answers.length; i++) {
      var e = step(cur, answers[i]);
      if (!e) break;
      path.push(e.to); edges.push(e.id); cur = e.to;
      if (node(cur).rec) break;
    }
    return { path: path, edges: edges, leaf: node(cur).rec || null, current: cur };
  }
  function isLeaf(id) { var n = node(id); return !!(n && n.rec); }

  var api = { NODES: NODES, EDGES: EDGES, SCENARIOS: SCENARIOS, node: node, out: out, step: step, walk: walk, isLeaf: isLeaf };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.VDSA_CHOOSER = api;
}(typeof window !== 'undefined' ? window : null));
