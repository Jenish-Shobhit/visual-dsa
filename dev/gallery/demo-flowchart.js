/* Gallery demos: VDSA.views.flowchart */
(function () {
  'use strict';
  var G = Gallery;

  /* ---------- 1. linear search, driven by a trace (token travels the taken edge) ---------- */
  var LINEAR = {
    nodes: [
      { id: 'start', type: 'start', text: 'Start', col: 0, row: 0 },
      { id: 'init', type: 'process', text: 'i = 0', col: 0, row: 1 },
      { id: 'cond', type: 'decision', text: 'i < n ?', col: 0, row: 2 },
      { id: 'check', type: 'decision', text: 'a[i] == target ?', col: 0, row: 3 },
      { id: 'inc', type: 'process', text: 'i = i + 1', col: 0, row: 4 },
      { id: 'found', type: 'end', text: 'return i', col: 1, row: 3 },
      { id: 'none', type: 'end', text: 'return −1', col: 1, row: 2 }
    ],
    edges: [
      { from: 'start', to: 'init' },
      { from: 'init', to: 'cond' },
      { from: 'cond', to: 'check', label: 'yes' },
      { from: 'cond', to: 'none', label: 'no' },
      { from: 'check', to: 'found', label: 'yes' },
      { from: 'check', to: 'inc', label: 'no' },
      { from: 'inc', to: 'cond' }
    ]
  };
  function linearTrace(a, target) {
    var steps = [], visited = [];
    function go(id, caption) { steps.push({ active: id, visited: visited.slice(), caption: caption }); if (visited.indexOf(id) === -1) visited.push(id); }
    go('start', 'Search [' + a.join(', ') + '] for ' + target + '.');
    go('init', 'Start at the first index.');
    for (var i = 0; ; i++) {
      go('cond', 'i = ' + i + ': is ' + i + ' < ' + a.length + '?');
      if (i >= a.length) { go('none', 'Ran off the end: ' + target + ' is not here.'); break; }
      go('check', 'Is a[' + i + '] = ' + a[i] + ' equal to ' + target + '?');
      if (a[i] === target) { go('found', 'Found it at index ' + i + '.'); break; }
      go('inc', 'No: move to the next index.');
    }
    return steps;
  }
  G.demo('flowchart', {
    id: 'flow-linear', title: 'Linear search — the token follows the trace',
    note: 'render({active, visited}): the edge from the previous active node is inferred; the token travels it and lights the arrival. Step back to see it travel in reverse.',
    duration: 700, hold: 450,
    build: function (host) {
      var view = VDSA.views.flowchart(host, LINEAR, { label: 'Linear search flowchart' });
      var steps = linearTrace([4, 8, 1, 9], 1);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- 2. binary search decision logic, explicit activeEdge (persistent highlight) ---------- */
  var BINARY = {
    nodes: [
      { id: 'init', type: 'start', text: 'lo = 0, hi = n − 1', col: 1, row: 0 },
      { id: 'cond', type: 'decision', text: 'lo ≤ hi ?', col: 1, row: 1 },
      { id: 'mid', type: 'process', text: 'mid = ⌊(lo + hi) / 2⌋', col: 1, row: 2 },
      { id: 'eq', type: 'decision', text: 'a[mid] = target ?', col: 1, row: 3 },
      { id: 'lt', type: 'decision', text: 'a[mid] < target ?', col: 1, row: 4 },
      { id: 'right', type: 'process', text: 'lo = mid + 1', col: 0, row: 5 },
      { id: 'left', type: 'process', text: 'hi = mid − 1', col: 2, row: 5 },
      { id: 'found', type: 'end', text: 'return mid', col: 2, row: 3 },
      { id: 'none', type: 'end', text: 'return −1', col: 2, row: 1 }
    ],
    edges: [
      { from: 'init', to: 'cond' },
      { from: 'cond', to: 'mid', label: 'yes' },
      { from: 'cond', to: 'none', label: 'no' },
      { from: 'mid', to: 'eq' },
      { from: 'eq', to: 'found', label: 'yes' },
      { from: 'eq', to: 'lt', label: 'no' },
      { from: 'lt', to: 'right', label: 'yes' },
      { from: 'lt', to: 'left', label: 'no' },
      { from: 'right', to: 'cond' },
      { from: 'left', to: 'cond' }
    ]
  };
  function binaryTrace(a, target) {
    var steps = [], visited = [], lo = 0, hi = a.length - 1, prev = null;
    function go(id, caption) {
      steps.push({ active: id, activeEdge: prev ? { from: prev, to: id } : null, visited: visited.slice(), caption: caption });
      if (visited.indexOf(id) === -1) visited.push(id);
      prev = id;
    }
    go('init', 'Search [' + a.join(', ') + '] for ' + target + '.');
    while (true) {
      go('cond', 'lo = ' + lo + ', hi = ' + hi + ': is the range non-empty?');
      if (lo > hi) { go('none', 'Empty range: not found.'); break; }
      var mid = (lo + hi) >> 1;
      go('mid', 'mid = ' + mid + ', a[mid] = ' + a[mid] + '.');
      go('eq', 'Is ' + a[mid] + ' = ' + target + '?');
      if (a[mid] === target) { go('found', 'Found at index ' + mid + '.'); break; }
      go('lt', 'Is ' + a[mid] + ' < ' + target + '?');
      if (a[mid] < target) { lo = mid + 1; go('right', 'Too small: lo = ' + lo + '.'); }
      else { hi = mid - 1; go('left', 'Too big: hi = ' + hi + '.'); }
    }
    return steps;
  }
  G.demo('flowchart', {
    id: 'flow-binary', title: 'Binary search — explicit activeEdge stays lit',
    note: 'activeEdge: {from, to} highlights the taken edge as part of the snapshot; two loop-backs route around both sides.',
    duration: 650, hold: 400,
    build: function (host) {
      var view = VDSA.views.flowchart(host, BINARY, { label: 'Binary search flowchart' });
      var steps = binaryTrace([1, 3, 5, 7, 9, 11, 13], 11);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- 3. interactive decision tree ---------- */
  var CHOOSE = {
    nodes: [
      // `narrow` positions take over below 480px: the tree folds into two columns
      { id: 'q1', type: 'decision', text: 'Look up items by key?', col: 1, row: 0, narrow: { col: 0, row: 0 } },
      { id: 'q2', type: 'decision', text: 'Need keys in sorted order?', col: 0, row: 1, narrow: { col: 0, row: 1 } },
      { id: 'q3', type: 'decision', text: 'Add or remove at both ends?', col: 2, row: 1, narrow: { col: 0, row: 3 } },
      { id: 'bst', type: 'end', text: 'Balanced BST', col: 0, row: 2, narrow: { col: 1, row: 1 } },
      { id: 'hash', type: 'end', text: 'Hash table', col: 1, row: 2, narrow: { col: 0, row: 2 } },
      { id: 'deque', type: 'end', text: 'Deque', col: 2, row: 2, narrow: { col: 1, row: 3 } },
      { id: 'arr', type: 'end', text: 'Dynamic array', col: 3, row: 1, narrow: { col: 0, row: 4 } }
    ],
    edges: [
      { from: 'q1', to: 'q2', label: 'yes' },
      { from: 'q1', to: 'q3', label: 'no' },
      { from: 'q2', to: 'bst', label: 'yes' },
      { from: 'q2', to: 'hash', label: 'no' },
      { from: 'q3', to: 'deque', label: 'yes' },
      { from: 'q3', to: 'arr', label: 'no' }
    ]
  };
  G.demo('flowchart', {
    id: 'flow-choose', title: 'Choose a data structure — interactive decision tree', wide: true,
    note: 'interactive: true. Answer with the yes/no pills (Tab + Enter works); the view emits "choose" and the demo renders the new path. Nodes carry narrow: {col,row} positions for small screens.',
    build: function (host, card) {
      var view = VDSA.views.flowchart(host, CHOOSE, { interactive: true, label: 'Choose a data structure' });
      var path = ['q1'], edges = {};
      function state() { return { active: path[path.length - 1], visited: path.slice(0, -1), edgeStates: Object.assign({}, edges) }; }
      function show(d) { view.render(state(), { duration: d === undefined ? Math.round(650 / G.speed) : d }); }
      view.on('choose', function (e) {
        G.log(card, 'choose ' + JSON.stringify(e));
        path.push(e.to); edges[e.node + '->' + e.to] = 'path';
        show();
      });
      view.on('click', function (e) { G.log(card, 'click ' + JSON.stringify({ id: e.id })); });
      G.button(card, 'Start over', function () { path = ['q1']; edges = {}; show(); G.log(card, ''); });
      return { steps: [state()], render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- 4. static diagram with io and note shapes ---------- */
  G.demo('flowchart', {
    id: 'flow-static', title: 'Static diagram — io, note and a dashed annotation edge',
    note: 'No render calls needed: the constructor draws the spec. io = parallelogram, note = dashed box, edge {dashed: true, arrow: false}.',
    build: function (host) {
      VDSA.views.flowchart(host, {
        nodes: [
          { id: 's', type: 'start', text: 'Start', col: 0, row: 0 },
          { id: 'read', type: 'io', text: 'Read n numbers', col: 0, row: 1 },
          { id: 'zero', type: 'process', text: 'sum = 0', col: 0, row: 2 },
          { id: 'more', type: 'decision', text: 'More numbers?', col: 0, row: 3 },
          { id: 'add', type: 'process', text: 'sum = sum + x', col: 0, row: 4 },
          { id: 'note', type: 'note', text: 'Runs once per number: n times.', col: 0, row: 5 },
          { id: 'print', type: 'io', text: 'Print sum', col: 1, row: 3 },
          { id: 'e', type: 'end', text: 'End', col: 1, row: 4 }
        ],
        edges: [
          { from: 's', to: 'read' }, { from: 'read', to: 'zero' }, { from: 'zero', to: 'more' },
          { from: 'more', to: 'add', label: 'yes' },
          { from: 'add', to: 'more' },
          { from: 'more', to: 'print', label: 'no' }, { from: 'print', to: 'e' },
          { from: 'note', to: 'add', dashed: true, arrow: false }
        ]
      }, { label: 'Summing input numbers' });
      return { steps: [], render: function () {} };
    }
  });
}());
