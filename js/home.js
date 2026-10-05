/* Visual DSA home page (index.html).

   1. Hero call to action (Start / Resume / Continue), from VDSA.progress and the curriculum's live status.
   2. Hero reel: six short live traces drawn with the real renderers, cycling with a progress row.
   3. Compact units list with a done/total count per unit once there is progress.
   4. The small list of labs in the quiet links row (target of the header's Labs button).

   Everything reads the curriculum and progress at runtime. Test hook: window.VDSAHome.refresh(). */
(function (win) {
  'use strict';
  var VDSA = win.VDSA, C = win.VDSA_CURRICULUM, doc = win.document;
  if (!VDSA || !C || !VDSA.h) return;
  var h = VDSA.h, s = VDSA.s;
  var V = VDSA.views || {};

  /* ================================================================== helpers */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function $(sel, scope) { return (scope || doc).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); }
  function reduced() { return VDSA.reducedMotion(); }
  function url(path) { return VDSA.url ? VDSA.url(path) : path; }
  function progress() { return VDSA.progress ? VDSA.progress.get() : { visited: [], completed: [], last: null }; }
  function isLive(l) { return !!l && l.status === 'live'; }
  function lessonState(l, p) {
    if (p.completed.indexOf(l.id) !== -1) return 'completed';
    if (!isLive(l)) return 'planned';
    if (p.visited.indexOf(l.id) !== -1) return 'visited';
    return 'live';
  }
  var STATE_TEXT = { completed: 'Completed', visited: 'In progress', live: 'Ready to start', planned: 'Coming soon' };
  function safe(fn, label) { try { return fn(); } catch (e) { console.error('[home] ' + label, e); return null; } }

  /* ================================================================== step generators (pure, tiny) */

  /* Selection sort, one "find the minimum" and one "swap" step per round. */
  function selectionSteps(values, prefix) {
    var a = values.map(function (v, i) { return { id: (prefix || 's') + i, value: v }; });
    var steps = [], sorted = 0;
    function snap(mark) {
      steps.push({
        items: a.map(function (it, k) { return { id: it.id, value: it.value, state: (mark && mark[k]) || (k < sorted ? 'done' : 'default') }; })
              });
    }
    snap();
    for (var i = 0; i < a.length - 1; i++) {
      var m = i;
      for (var j = i + 1; j < a.length; j++) if (a[j].value < a[m].value) m = j;
      var mk = {}; mk[i] = 'compare'; mk[m] = 'key';
      snap(mk);
      if (m !== i) {
        var t = a[i]; a[i] = a[m]; a[m] = t;
        var sw = {}; sw[i] = 'swap'; sw[m] = 'swap';
        snap(sw);
      }
      sorted = i + 1;
    }
    sorted = a.length;
    snap();
    return steps;
  }

  /* Breadth-first search on a grid, one layer per step, then the path in a few strokes. */
  function bfsGridSteps(R, Cc, wallList, start, end, pathChunks) {
    var walls = {};
    wallList.forEach(function (w) { walls[w[0] + ',' + w[1]] = true; });
    function key(r, c) { return r + ',' + c; }
    var dist = {}, parent = {}, visited = {}, frontier = [start], steps = [];
    dist[key(start[0], start[1])] = 0;
    function snap(pathKeys) {
      var cells = {};
      Object.keys(visited).forEach(function (k) { cells[k] = { state: 'visited' }; });
      frontier.forEach(function (p) { cells[key(p[0], p[1])] = { state: 'frontier' }; });
      (pathKeys || []).forEach(function (k) { cells[k] = { state: 'path' }; });
      steps.push({ rows: R, cols: Cc, walls: wallList, cells: cells, markers: { start: { cell: start, label: 'S' }, end: { cell: end, label: 'T' } } });
    }
    snap();
    var found = false;
    while (frontier.length && !found) {
      var next = [];
      frontier.forEach(function (p) {
        var k = key(p[0], p[1]);
        visited[k] = true;
        if (p[0] === end[0] && p[1] === end[1]) found = true;
        [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(function (d) {
          var r = p[0] + d[0], c = p[1] + d[1], kk = key(r, c);
          if (r < 0 || c < 0 || r >= R || c >= Cc || walls[kk] || dist[kk] !== undefined) return;
          dist[kk] = dist[k] + 1; parent[kk] = k; next.push([r, c]);
        });
      });
      frontier = found ? [] : next;
      snap();
    }
    if (found) {
      var path = [], k2 = key(end[0], end[1]);
      while (k2) { path.unshift(k2); k2 = parent[k2]; }
      var n = pathChunks || 3, chunk = Math.ceil(path.length / n);
      for (var c = 1; c <= n; c++) snap(path.slice(0, Math.min(path.length, c * chunk)));
    }
    return steps;
  }

  /* Edit distance table (rows: a, columns: b), one cell per step with its three dependency arrows. */
  function editSteps(a, b) {
    var R = a.length + 1, Cc = b.length + 1, dp = [], steps = [], i, j;
    for (i = 0; i < R; i++) { dp.push([]); for (j = 0; j < Cc; j++) dp[i].push(null); }
    var rowH = ['ε'].concat(a.split('')), colH = ['ε'].concat(b.split(''));
    function snap(o) {
      steps.push({
        rows: R, cols: Cc, rowHeaders: rowH, colHeaders: colH,
        cells: dp.map(function (row, r) { return row.map(function (v, c) { return v === null ? null : { value: v, state: (o.mark && o.mark[r + ',' + c]) || (o.path && o.path[r + ',' + c] ? 'path' : 'default') }; }); }),
        arrows: o.arrows || [], cursor: o.cursor || null,
        highlightRow: o.hr === undefined ? null : o.hr, highlightCol: o.hc === undefined ? null : o.hc
      });
    }
    snap({});
    for (i = 0; i < R; i++) dp[i][0] = i;
    for (j = 0; j < Cc; j++) dp[0][j] = j;
    snap({});
    for (i = 1; i < R; i++) {
      for (j = 1; j < Cc; j++) {
        var same = a[i - 1] === b[j - 1];
        var del = dp[i - 1][j] + 1, ins = dp[i][j - 1] + 1, rep = dp[i - 1][j - 1] + (same ? 0 : 1);
        var best = Math.min(del, ins, rep);
        dp[i][j] = best;
        var src = best === rep ? [i - 1, j - 1] : best === del ? [i - 1, j] : [i, j - 1];
        var mark = {}; mark[i + ',' + j] = 'active'; mark[src[0] + ',' + src[1]] = 'key';
        snap({
          mark: mark, cursor: [i, j],
          arrows: [[i - 1, j], [i, j - 1], [i - 1, j - 1]].map(function (sc) { return { from: sc, to: [i, j], state: sc[0] === src[0] && sc[1] === src[1] ? 'key' : 'default' }; })
        });
      }
    }
    var path = {}, r = R - 1, c = Cc - 1;
    path[r + ',' + c] = true;
    while (r > 0 || c > 0) {
      if (r > 0 && c > 0 && dp[r][c] === dp[r - 1][c - 1] + (a[r - 1] === b[c - 1] ? 0 : 1)) { r--; c--; }
      else if (r > 0 && dp[r][c] === dp[r - 1][c] + 1) r--;
      else c--;
      path[r + ',' + c] = true;
    }
    snap({ path: path });
    return steps;
  }

  /* BST insert of 5, then the AVL right rotation at 30. */
  function avlSteps() {
    function N(id, v, l, r, extra) { return Object.assign({ id: id, value: v, left: l || null, right: r || null }, extra || {}); }
    var steps = [];
    steps.push({ root: 'a30', nodes: [N('a30', 30, 'a20', 'a40'), N('a20', 20, 'a10', 'a25'), N('a40', 40), N('a10', 10), N('a25', 25)] });
    steps.push({ root: 'a30', nodes: [N('a30', 30, 'a20', 'a40', { state: 'compare' }), N('a20', 20, 'a10', 'a25'), N('a40', 40), N('a10', 10), N('a25', 25)],
      pointers: [{ name: '5', target: 'a30', state: 'key', id: 'k' }] });
    steps.push({ root: 'a30', nodes: [N('a30', 30, 'a20', 'a40', { state: 'visited' }), N('a20', 20, 'a10', 'a25', { state: 'compare' }), N('a40', 40), N('a10', 10), N('a25', 25)],
      edges: { 'a30-a20': 'path' }, pointers: [{ name: '5', target: 'a20', state: 'key', id: 'k' }] });
    steps.push({ root: 'a30', nodes: [N('a30', 30, 'a20', 'a40', { state: 'visited' }), N('a20', 20, 'a10', 'a25', { state: 'visited' }), N('a40', 40), N('a10', 10, null, null, { state: 'compare' }), N('a25', 25)],
      edges: { 'a30-a20': 'path', 'a20-a10': 'path' }, pointers: [{ name: '5', target: 'a10', state: 'key', id: 'k' }] });
    steps.push({ root: 'a30', nodes: [N('a30', 30, 'a20', 'a40'), N('a20', 20, 'a10', 'a25'), N('a40', 40), N('a10', 10, 'a5'), N('a25', 25), N('a5', 5, null, null, { state: 'key' })],
      edges: { 'a30-a20': 'path', 'a20-a10': 'path', 'a10-a5': 'path' } });
    steps.push({ root: 'a30', nodes: [N('a30', 30, 'a20', 'a40', { state: 'error', badge: '+2', badgeState: 'error' }), N('a20', 20, 'a10', 'a25', { state: 'pivot', badge: '+1' }), N('a40', 40), N('a10', 10, 'a5'), N('a25', 25), N('a5', 5)] });
    steps.push({ root: 'a20', nodes: [N('a20', 20, 'a10', 'a30', { state: 'pivot' }), N('a10', 10, 'a5'), N('a30', 30, 'a25', 'a40', { state: 'active' }), N('a25', 25), N('a40', 40), N('a5', 5)] });
    steps.push({ root: 'a20', nodes: [N('a20', 20, 'a10', 'a30', { state: 'done', badge: '0', badgeState: 'done' }), N('a10', 10, 'a5', null, { state: 'done' }), N('a30', 30, 'a25', 'a40', { state: 'done' }), N('a25', 25, null, null, { state: 'done' }), N('a40', 40, null, null, { state: 'done' }), N('a5', 5, null, null, { state: 'done' })] });
    return steps;
  }

  /* Dijkstra on a small undirected weighted graph: one settle per step, neighbours relaxed together. */
  var DJ_NODES = [['S', 90, 300], ['A', 340, 105], ['B', 340, 495], ['C', 650, 105], ['D', 650, 495], ['T', 910, 300]];
  var DJ_EDGES = [['S', 'A', 4], ['S', 'B', 1], ['A', 'B', 2], ['A', 'C', 5], ['B', 'D', 8], ['C', 'D', 2], ['C', 'T', 3], ['D', 'T', 6]];
  function dijkstraSteps() {
    var dist = {}, st = {}, parent = {}, steps = [];
    DJ_NODES.forEach(function (n) { dist[n[0]] = Infinity; st[n[0]] = 'default'; });
    function ek(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
    function snap(pulse, path) {
      var pathEdges = {}, pathNodes = {};
      (path || []).forEach(function (id, i) { pathNodes[id] = true; if (i) pathEdges[ek(path[i - 1], id)] = true; });
      steps.push({
        nodes: DJ_NODES.map(function (n) {
          var id = n[0];
          return { id: id, x: n[1], y: n[2], state: path ? (pathNodes[id] ? 'path' : 'done') : st[id], badge: dist[id] === Infinity ? '∞' : dist[id], badgeState: path && pathNodes[id] ? 'path' : st[id] === 'done' ? 'done' : undefined };
        }),
        edges: DJ_EDGES.map(function (e) {
          var k = ek(e[0], e[1]), state = 'default';
          if (path) state = pathEdges[k] ? 'path' : 'muted';
          else if (pulse && pulse[k]) state = 'active';
          else if ((parent[e[1]] === e[0] || parent[e[0]] === e[1])) state = (st[e[0]] === 'done' && st[e[1]] === 'done') ? 'done' : 'frontier';
          return { from: e[0], to: e[1], weight: e[2], state: state, pulse: !!(pulse && pulse[k]) };
        })
      });
    }
    snap();
    dist.S = 0; st.S = 'frontier';
    for (;;) {
      var u = null;
      DJ_NODES.forEach(function (n) { if (st[n[0]] === 'frontier' && (u === null || dist[n[0]] < dist[u])) u = n[0]; });
      if (u === null) break;
      st[u] = 'active';
      var pulse = {};
      DJ_EDGES.forEach(function (e) {
        var v = e[0] === u ? e[1] : e[1] === u ? e[0] : null;
        if (!v || st[v] === 'done') return;
        var nd = dist[u] + e[2];
        if (nd < dist[v]) { dist[v] = nd; parent[v] = u; st[v] = 'frontier'; pulse[ek(u, v)] = true; }
      });
      snap(pulse);
      st[u] = 'done';
    }
    var path = [], x = 'T';
    while (x) { path.unshift(x); x = parent[x]; }
    snap(null, path);
    return steps;
  }

  /* Linked-list reversal: one arrow flips per step while prev and curr walk forward. */
  function reverseSteps(values) {
    var nodes = values.map(function (v, i) { return { id: 'r' + i, value: v, next: i < values.length - 1 ? 'r' + (i + 1) : null }; });
    var by = {}; nodes.forEach(function (n) { by[n.id] = n; });
    var steps = [], head = 'r0', prev = null, curr = 'r0', flipped = null, done = {};
    function snap(final) {
      steps.push({
        nodes: nodes.map(function (n) {
          return { id: n.id, value: n.value, next: n.next, state: final ? 'done' : n.id === curr ? 'active' : done[n.id] ? 'visited' : 'default', nextState: n.id === flipped ? 'swap' : undefined };
        }),
        head: head,
        pointers: final ? [] : [{ name: 'prev', target: prev, state: 'visited', nullSide: 'left' }, { name: 'curr', target: curr, state: 'active' }]
      });
    }
    snap();
    while (curr !== null) {
      var nxt = by[curr].next;
      by[curr].next = prev;
      flipped = curr; done[curr] = true;
      prev = curr; curr = nxt;
      snap();
    }
    flipped = null; head = prev;
    snap(true);
    return steps;
  }

  /* ================================================================== 1. calls to action */
  function firstLive() { for (var i = 0; i < C.lessons.length; i++) if (isLive(C.lessons[i])) return C.lessons[i]; return null; }
  function nextAfter(lesson, p) {
    var idx = C.lessons.indexOf(lesson);
    for (var i = idx + 1; i < C.lessons.length; i++) { var l = C.lessons[i]; if (isLive(l) && p.completed.indexOf(l.id) === -1) return l; }
    return null;
  }
  /* {label, href, lesson, kind: 'start'|'resume'|'continue'|'map'} */
  function primaryAction(p) {
    var last = p.last ? C.byId(p.last) : null;
    if (last && isLive(last)) {
      if (p.completed.indexOf(last.id) === -1) return { kind: 'resume', label: 'Resume lesson ' + last.number, href: url(last.href), lesson: last };
      var nx = nextAfter(last, p);
      if (nx) return { kind: 'continue', label: 'Continue with lesson ' + nx.number, href: url(nx.href), lesson: nx };
      return { kind: 'resume', label: 'Revisit lesson ' + last.number, href: url(last.href), lesson: last };
    }
    var one = C.lessons[0];
    if (isLive(one)) return { kind: 'start', label: 'Start with lesson 1', href: url(one.href), lesson: one };
    var fl = firstLive();
    if (fl) return { kind: 'start', label: 'Start with lesson ' + fl.number, href: url(fl.href), lesson: fl };
    return { kind: 'map', label: 'See the units', href: '#units', lesson: null };
  }
  function renderActions() {
    var p = progress(), act = primaryAction(p);
    $$('#cta-start, [data-start-link]').forEach(function (a) {
      a.href = act.href;
      a.setAttribute('data-kind', act.kind);
      var lab = $('[data-start-label]', a);
      if (lab) lab.textContent = act.label;
      a.title = act.lesson ? 'Lesson ' + pad2(act.lesson.number) + ': ' + act.lesson.title : '';
    });
  }

  /* ================================================================== 2. hero reel */
  var SCENES = [
    {
      id: 'sort', name: 'Selection sort', short: 'Sorting', lesson: '14-elementary-sorts', unit: 'u3',
      caption: 'Find the smallest bar, then swap it to the front. Swaps arc, so you can follow both bars.',
      alt: 'Animation: bars of different heights are sorted by selection sort; each swap arcs one bar over the other.',
      stepMs: 400, holdMs: 1500, staticIndex: 7,
      build: function (host) {
        var view = V.array(host, { mode: 'bars', showIndices: false, barHeight: 200, label: 'Selection sort on eight bars' });
        var steps = selectionSteps([46, 21, 70, 34, 88, 13, 58, 27], 'hs');
        view.prepare(steps);
        return { steps: steps, render: function (st, ms) { view.render(st, { duration: ms }); } };
      }
    },
    {
      id: 'bfs', name: 'Breadth-first search', short: 'BFS', lesson: '26-bfs-and-dfs', unit: 'u5',
      caption: 'A queue spreads outward in waves, so the first time it reaches T is along a shortest route.',
      alt: 'Animation: a breadth-first search spreads in waves across a grid with walls, then traces the shortest path from S to T.',
      stepMs: 185, holdMs: 1600, staticIndex: 14,
      build: function (host) {
        var walls = [];
        for (var r = 0; r < 7; r++) walls.push([r, 6]);
        for (r = 3; r < 11; r++) walls.push([r, 12]);
        walls.push([7, 3], [7, 4], [7, 5], [3, 13], [3, 14], [3, 15]);
        var view = V.grid(host, { mode: 'path', label: 'Breadth-first search on a grid' });
        var steps = bfsGridSteps(11, 19, walls, [2, 2], [8, 16], 3);
        if (view.prepare) view.prepare(steps);
        return { steps: steps, render: function (st, ms) { view.render(st, { duration: ms }); } };
      }
    },
    {
      id: 'avl', name: 'AVL rotation', short: 'AVL tree', lesson: '20-balanced-trees', unit: 'u4',
      caption: '5 drops into place, the tree tips too far left, and one rotation brings it back into balance.',
      alt: 'Animation: the value 5 travels down a binary search tree and is inserted; the root becomes unbalanced and a right rotation makes 20 the new root.',
      stepMs: 820, holdMs: 1500, staticIndex: 5,
      build: function (host) {
        var view = V.tree(host, { label: 'AVL insert and rotation', nodeSize: 46 });
        var steps = avlSteps();
        view.prepare(steps);
        return { steps: steps, render: function (st, ms) { view.render(st, { duration: ms }); } };
      }
    },
    {
      id: 'dijkstra', name: 'Dijkstra’s algorithm', short: 'Dijkstra', lesson: '28-dijkstra-and-a-star', unit: 'u5',
      caption: 'Distances settle nearest first. Each settled node offers its neighbours a shorter way round.',
      alt: 'Animation: Dijkstra’s algorithm settles nodes of a weighted graph one by one; distance badges drop from infinity, and the shortest path from S to T lights up.',
      stepMs: 860, holdMs: 1700, staticIndex: 3,
      build: function (host) {
        var view = V.graph(host, { label: 'Dijkstra’s algorithm from S', maxHeight: 340, nodeRadius: 27, bounds: { x: 30, y: 45, w: 940, h: 510 } });
        var steps = dijkstraSteps();
        return { steps: steps, render: function (st, ms) { view.render(st, { duration: ms }); } };
      }
    },
    {
      id: 'dp', name: 'Edit distance', short: 'DP table', lesson: '35-dynamic-programming-2d', unit: 'u6',
      caption: 'Each cell reuses three neighbours. The highlighted arrow shows which one was cheapest.',
      alt: 'Animation: a dynamic-programming table for the edit distance from “ros” to “horse” fills cell by cell, with arrows from the three cells each value depends on.',
      stepMs: 300, holdMs: 1700, staticIndex: 10,
      build: function (host) {
        var view = V.grid(host, { mode: 'table', cellSize: 54, label: 'Edit distance table' });
        var steps = editSteps('ros', 'horse');
        if (view.prepare) view.prepare(steps);
        return { steps: steps, render: function (st, ms) { view.render(st, { duration: ms }); } };
      }
    },
    {
      id: 'list', name: 'Reversing a linked list', short: 'Linked list', lesson: '08-linked-lists', unit: 'u2',
      caption: 'One arrow flips per step while prev and curr walk down the list. Nothing is copied.',
      alt: 'Animation: a linked list of four nodes is reversed; each next arrow swings to point backwards while the prev and curr pointers move forward.',
      stepMs: 860, holdMs: 1600, staticIndex: 3,
      build: function (host) {
        var view = V.list(host, { label: 'Reversing a linked list' });
        var steps = reverseSteps([7, 2, 9, 4]);
        view.prepare(steps);
        return { steps: steps, render: function (st, ms) { view.render(st, { duration: ms }); } };
      }
    }
  ];

  function initReel() {
    var root = $('#reel');
    if (!root) return;
    var stage = $('[data-reel-stage]', root), tabsHost = $('[data-reel-tabs]', root);
    var nameEl = $('[data-reel-name]', root), fromEl = $('[data-reel-from]', root), capEl = $('[data-reel-caption]', root);
    var toggle = $('[data-reel-toggle]', root);
    var scenes = SCENES.filter(function (sc) {
      var need = { sort: 'array', bfs: 'grid', avl: 'tree', dijkstra: 'graph', dp: 'grid', list: 'list' }[sc.id];
      return typeof V[need] === 'function';
    });
    if (!scenes.length) return;
    var built = [], tabs = [], fills = [];
    var cur = -1, step = 0, timer = 0, visible = false, userPaused = false, running = false;

    scenes.forEach(function (sc, i) {
      var viewHost = h('div', { class: 'reel__view' });
      sc.el = h('div', { class: 'reel__scene', 'data-scene': sc.id }, viewHost);
      sc.host = viewHost;
      stage.appendChild(sc.el);
      var fill = h('span', { class: 'reel__fill' });
      var tab = h('button', { type: 'button', class: 'reel__tab', 'data-unit': sc.unit, 'aria-label': 'Show ' + sc.name, title: sc.name },
        h('span', { class: 'reel__tab-label', 'aria-hidden': 'true' }, sc.short),
        h('span', { class: 'reel__track', 'aria-hidden': 'true' }, fill));
      tab.addEventListener('click', function () { go(i, true); });
      tabsHost.appendChild(tab);
      tabs.push(tab); fills.push(fill);
    });

    function ensure(i) {
      if (!built[i]) built[i] = safe(function () { return scenes[i].build(scenes[i].host); }, 'reel scene ' + scenes[i].id) || { steps: [{}], render: function () {} };
      return built[i];
    }
    function sceneTime(i, fromStep) {
      var sc = scenes[i], b = ensure(i), n = b.steps.length;
      return Math.max(0, n - 1 - (fromStep || 0)) * sc.stepMs + sc.holdMs;
    }
    function setFill(i, frac, ms) {
      var f = fills[i];
      if (!f) return;
      f.style.transitionDuration = (ms || 0) + 'ms';
      f.style.transform = 'scaleX(' + frac.toFixed(4) + ')';
    }
    function freezeFill(i) {
      var f = fills[i];
      if (!f) return 0;
      var m = getComputedStyle(f).transform, a = 1;
      if (m && m !== 'none') { var parts = m.match(/matrix\(([^,]+)/); if (parts) a = parseFloat(parts[1]); }
      setFill(i, a, 0);
      return a;
    }
    function show(i, index) {
      var b = ensure(i), sc = scenes[i];
      var prevScene = cur;
      cur = i; step = index || 0;
      b.render(b.steps[step], 0);
      scenes.forEach(function (x, k) {
        x.el.classList.toggle('is-active', k === i);
        x.el.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      });
      tabs.forEach(function (t, k) {
        t.classList.toggle('is-active', k === i);
        t.setAttribute('aria-pressed', k === i ? 'true' : 'false');
        if (k < i) setFill(k, 1, 0); else if (k > i) setFill(k, 0, 0);
      });
      setFill(i, reduced() ? 1 : 0, 0);
      root.setAttribute('data-unit', sc.unit);
      nameEl.textContent = sc.name;
      var l = C.byId(sc.lesson);
      fromEl.textContent = l ? 'Lesson ' + pad2(l.number) : '';
      capEl.textContent = sc.caption;
      stage.setAttribute('aria-label', sc.alt);
      if (prevScene !== i) {
        // build the next scene while this one plays, so the switch never stalls
        var nx = (i + 1) % scenes.length;
        setTimeout(function () { ensure(nx); }, 250);
      }
    }
    function startFill() {
      if (reduced()) return;
      // force the zero state to apply before the long transition begins
      void fills[cur].offsetWidth;
      setFill(cur, 1, sceneTime(cur, step));
    }
    function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms); }
    function tick() {
      timer = 0;
      if (!running) return;
      var b = built[cur], sc = scenes[cur];
      if (step < b.steps.length - 1) {
        step++;
        b.render(b.steps[step], Math.round(sc.stepMs * 0.8));
        schedule(step === b.steps.length - 1 ? sc.holdMs : sc.stepMs);
      } else {
        var nx = (cur + 1) % scenes.length;
        if (nx === 0) fills.forEach(function (f, k) { setFill(k, 0, 0); });
        show(nx, 0);
        startFill();
        schedule(scenes[nx].stepMs + 250);
      }
    }
    function sync() {
      var should = visible && !doc.hidden && !userPaused && !reduced();
      if (should && !running) {
        running = true;
        startFill();
        schedule(scenes[cur].stepMs);
      } else if (!should && running) {
        running = false;
        clearTimeout(timer); timer = 0;
        freezeFill(cur);
      }
    }
    function go(i, fromUser) {
      clearTimeout(timer); timer = 0;
      if (reduced()) { show(i, Math.min(scenes[i].staticIndex || 0, ensure(i).steps.length - 1)); return; }
      show(i, 0);
      if (running) { startFill(); schedule(scenes[i].stepMs + 250); }
      else if (fromUser && userPaused) {
        // paused: show a representative frame of the chosen scene instead of its empty first step
        var b = ensure(i), si = Math.min(scenes[i].staticIndex || 0, b.steps.length - 1);
        step = si; b.render(b.steps[si], 0); setFill(i, si / Math.max(1, b.steps.length - 1), 0);
      }
    }
    function syncToggle() {
      toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      var lab = userPaused ? 'Play the animations' : 'Pause the animations';
      toggle.setAttribute('aria-label', lab); toggle.title = lab;
      root.classList.toggle('is-paused', userPaused);
    }
    toggle.addEventListener('click', function () { userPaused = !userPaused; syncToggle(); sync(); });

    function applyMotionPreference() {
      root.classList.toggle('is-static', reduced());
      if (reduced()) {
        running = false; clearTimeout(timer);
        var i = cur < 0 ? 0 : cur;
        show(i, Math.min(scenes[i].staticIndex || 0, ensure(i).steps.length - 1));
      } else sync();
    }
    show(0, 0);
    if (reduced()) applyMotionPreference();
    VDSA.onVisible(root, function (v) { visible = v; sync(); }, { threshold: 0.2 });
    doc.addEventListener('visibilitychange', sync);
    var mq = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq && mq.addEventListener) mq.addEventListener('change', applyMotionPreference);
    syncToggle();
  }

  /* ================================================================== 3. units list */
  function renderUnits() {
    var host = $('[data-units]');
    if (!host) return;
    var p = progress();
    VDSA.clear(host);
    C.units.forEach(function (u) {
      var ls = C.lessonsIn(u.id);
      var done = ls.filter(function (l) { return p.completed.indexOf(l.id) !== -1; }).length;
      var seen = p.visited.length || p.completed.length;
      var list = h('ol', { class: 'unit__lessons' });
      ls.forEach(function (l) {
        var st = lessonState(l, p);
        var inner = [h('span', { class: 'unit__num' }, pad2(l.number)), h('span', { class: 'unit__ltitle' }, l.title),
          h('span', { class: 'sr-only' }, ' (' + STATE_TEXT[st].toLowerCase() + ')')];
        list.appendChild(h('li', { class: 'unit__lesson unit__lesson--' + st },
          st === 'planned' ? h('span', { class: 'unit__row', title: 'Coming soon: ' + l.subtitle }, inner) : h('a', { class: 'unit__row', href: url(l.href), title: l.subtitle }, inner)));
      });
      host.appendChild(h('article', { class: 'unit', id: u.id, 'data-unit': u.id, 'aria-labelledby': u.id + '-title' },
        h('header', { class: 'unit__head' },
          h('h3', { class: 'unit__title', id: u.id + '-title' }, h('span', { class: 'unit__n', 'aria-hidden': 'true' }, String(u.number)), h('span', { class: 'sr-only' }, 'Unit ' + u.number + ': '), u.title),
          seen ? h('span', { class: 'unit__done', title: done + ' of ' + ls.length + ' lessons complete' }, done + '/' + ls.length, h('span', { class: 'sr-only' }, ' complete')) : null),
        h('p', { class: 'unit__blurb' }, u.blurb),
        list));
    });
  }

  /* ================================================================== 4. quiet links (labs list) */
  function renderLabs() {
    var host = $('[data-labs]');
    if (!host) return;
    VDSA.clear(host);
    C.labs.forEach(function (lab) {
      if (lab.id === 'history') return;
      host.appendChild(h('li', null, h('a', { href: url(lab.href), title: lab.blurb }, lab.title)));
    });
  }


  /* ================================================================== boot */
  function refresh() {
    safe(renderActions, 'actions');
    safe(renderUnits, 'units');
  }
  function boot() {
    safe(renderActions, 'actions');
    safe(initReel, 'reel');
    safe(renderUnits, 'units');
    safe(renderLabs, 'labs');
    if (VDSA.progress && VDSA.progress.onChange) VDSA.progress.onChange(function () { refresh(); });
  }
  win.VDSAHome = { refresh: refresh };
  VDSA.ready(boot);
}(typeof window !== 'undefined' ? window : null));
