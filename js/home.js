/* Visual DSA home page (index.html).

   Sections wired here
   1. Hero calls to action (Start / Resume / Continue), from VDSA.progress and the curriculum's live status.
   2. Hero reel: six short live traces drawn with the real renderers, cycling with a progress row.
   3. Stats strip: counts computed from js/curriculum.js.
   4. "How a lesson works": four tiny loops (VDSA.teaser).
   5. Journey map: an SVG route through all 7 units and 38 lessons (a vertical list on narrow screens).
   6. Unit cards with progress rings, plus a "your progress" card.
   7. Lab cards with lazily built thumbnail animations (one plays at a time; hover or focus picks it).
   8. Go deeper: the history link, taken from the curriculum's lab list.

   Everything reads the curriculum and progress at runtime, so the page follows lessons as they go live.
   Nothing here edits engine files. Test hook: window.VDSAHome.refresh() re-renders the map, units and CTAs. */
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
  function unitById(id) { for (var i = 0; i < C.units.length; i++) if (C.units[i].id === id) return C.units[i]; return null; }
  function labById(id) { for (var i = 0; i < C.labs.length; i++) if (C.labs[i].id === id) return C.labs[i]; return null; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function safe(fn, label) { try { return fn(); } catch (e) { console.error('[home] ' + label, e); return null; } }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = doc.createElement('script');
      el.src = src; el.async = true;
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error('Could not load ' + src)); };
      doc.head.appendChild(el);
    });
  }

  /* A small step looper for thumbnails: plays only when asked, renders frame 0 at once. */
  function Loop(o) {
    var steps = o.steps || [], index = -1, timer = 0, running = false;
    var stepMs = o.stepMs || 700, holdMs = o.holdMs === undefined ? 1400 : o.holdMs;
    function show(i, instant) {
      index = i;
      safe(function () { o.render(steps[i], instant ? 0 : Math.round(stepMs * 0.75), i); }, 'loop render');
    }
    function tick() {
      timer = 0;
      if (!running) return;
      if (index >= steps.length - 1) {
        if (o.regenerate) steps = o.regenerate() || steps;
        show(0, !!o.instantWrap);
      } else show(index + 1, false);
      timer = setTimeout(tick, index === steps.length - 1 ? holdMs : stepMs);
    }
    show(o.startAt || 0, true);
    return {
      play: function () { if (running || reduced() || steps.length < 2) return; running = true; timer = setTimeout(tick, Math.min(500, stepMs)); },
      pause: function () { running = false; if (timer) { clearTimeout(timer); timer = 0; } },
      get playing() { return running; }
    };
  }

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

  /* Bubble sort with compare and swap steps (the "Watch" card). */
  function bubbleSteps(values, prefix) {
    var a = values.map(function (v, i) { return { id: prefix + i, value: v }; });
    var steps = [], sorted = a.length;
    function snap(mark) {
      steps.push({ items: a.map(function (it, k) { return { id: it.id, value: it.value, state: k >= sorted ? 'done' : (mark && mark[k]) || 'default' }; }) });
    }
    snap();
    for (var end = a.length - 1; end > 0; end--) {
      var swapped = false;
      for (var j = 0; j < end; j++) {
        var m = {}; m[j] = 'compare'; m[j + 1] = 'compare';
        snap(m);
        if (a[j].value > a[j + 1].value) {
          var t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; swapped = true;
          var sw = {}; sw[j] = 'swap'; sw[j + 1] = 'swap';
          snap(sw);
        }
      }
      sorted = end;
      if (!swapped) break;
    }
    sorted = 0;
    snap();
    return steps;
  }

  /* Swap-only traces for the sorting race thumbnail. */
  function swapTrace(values, prefix, kind) {
    var a = values.map(function (v, i) { return { id: prefix + i, value: v }; });
    var steps = [];
    function snap(i, j, done) {
      steps.push({ items: a.map(function (it, k) { return { id: it.id, value: it.value, state: done ? 'done' : (k === i || k === j) ? 'swap' : 'default' }; }) });
    }
    function swap(i, j) { var t = a[i]; a[i] = a[j]; a[j] = t; snap(i, j); }
    snap(-1, -1);
    if (kind === 'bubble') {
      for (var end = a.length - 1; end > 0; end--) for (var j = 0; j < end; j++) if (a[j].value > a[j + 1].value) swap(j, j + 1);
    } else {
      (function qs(lo, hi) {
        if (lo >= hi) return;
        var p = a[hi].value, i = lo;
        for (var k = lo; k < hi; k++) if (a[k].value < p) { if (i !== k) swap(i, k); i++; }
        if (i !== hi) swap(i, hi);
        qs(lo, i - 1); qs(i + 1, hi);
      }(0, a.length - 1));
    }
    snap(-1, -1, true);
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
      if (p.completed.indexOf(last.id) === -1) return { kind: 'resume', label: 'Resume: ' + last.title, href: url(last.href), lesson: last };
      var nx = nextAfter(last, p);
      if (nx) return { kind: 'continue', label: 'Continue: ' + nx.title, href: url(nx.href), lesson: nx };
      return { kind: 'resume', label: 'Revisit: ' + last.title, href: url(last.href), lesson: last };
    }
    var one = C.lessons[0];
    if (isLive(one)) return { kind: 'start', label: 'Start with lesson 1', href: url(one.href), lesson: one };
    var fl = firstLive();
    if (fl) return { kind: 'start', label: 'Start with lesson ' + fl.number, href: url(fl.href), lesson: fl };
    return { kind: 'map', label: 'See the course map', href: '#journey', lesson: null };
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
    var note = $('#cta-note');
    if (note) {
      var done = p.completed.filter(function (id) { return C.byId(id); }).length;
      note.textContent = act.kind === 'resume' || act.kind === 'continue'
        ? 'Welcome back. ' + done + ' of ' + C.lessons.length + ' lessons complete, saved in this browser.'
        : 'Free and open. No account needed: your progress stays in this browser.';
    }
    var fin = $('[data-final-text]');
    if (fin) {
      if (act.lesson && act.kind !== 'start') fin.textContent = 'Pick up at lesson ' + act.lesson.number + ': ' + act.lesson.subtitle;
      else if (act.lesson) fin.textContent = 'Lesson ' + act.lesson.number + ' takes about ' + act.lesson.minutes + ' minutes. ' + (act.lesson.number === 1 ? 'You will follow an algorithm by hand before you ever write one.' : act.lesson.subtitle);
      else fin.textContent = 'Lessons are being published one by one. The map shows what is ready and what is coming next.';
    }
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

  /* ================================================================== 3. stats */
  function initStats() {
    var counts = { lessons: C.lessons.length, units: C.units.length, labs: C.labs.length };
    var els = $$('[data-stat]');
    els.forEach(function (el) { el.textContent = String(counts[el.getAttribute('data-stat')]); });
    if (reduced() || !els.length) return;
    var host = els[0].closest('.hstats'), played = false;
    VDSA.onVisible(host, function (v) {
      if (!v || played) return;
      played = true;
      els.forEach(function (el) {
        var target = counts[el.getAttribute('data-stat')];
        VDSA.tween(900, function (t, e) { el.textContent = String(Math.round(target * e)); }, { ease: 'out' });
      });
    }, { threshold: 0.6 });
  }

  /* ================================================================== 4. how a lesson works */
  function initHow() {
    var TEASER = VDSA.teaser;
    if (!TEASER || !V.array) return;

    // 1 Watch: bubble sort on six bars, fresh numbers every lap
    var watch = $('[data-how="watch"] [data-how-stage]');
    if (watch) safe(function () {
      var host = h('div', { class: 'how__view' }); watch.appendChild(host);
      var view = V.array(host, { mode: 'bars', showIndices: false, showValues: false, maxValue: 99, minValue: 0, barHeight: 96, label: 'Bubble sort' });
      var lap = 0, seeds = [[62, 25, 81, 40, 14, 55], [33, 90, 18, 71, 47, 26], [75, 38, 12, 64, 29, 86]];
      function gen() { var v = seeds[lap++ % seeds.length]; return bubbleSteps(v, 'w' + lap + '-'); }
      TEASER(watch, { steps: gen(), render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 560, holdMs: 1600, regenerate: gen, instantWrap: true, staticIndex: 5 });
    }, 'how watch');

    // 2 Predict: pause, ask, answer, reveal
    var pred = $('[data-how="predict"] [data-how-stage]');
    if (pred) safe(function () {
      var host = h('div', { class: 'how__view how__view--boxes' }); pred.appendChild(host);
      var view = V.array(host, { mode: 'boxes', showIndices: false, cellSize: 48, label: 'Prediction' });
      function it(id, v, st) { return { id: id, value: v, state: st || 'default' }; }
      var steps = [
        { items: [it('p0', 7), it('p1', 3), it('p2', 9)], phase: 'idle' },
        { items: [it('p0', 7, 'compare'), it('p1', 3, 'compare'), it('p2', 9)], phase: 'ask' },
        { items: [it('p0', 7, 'compare'), it('p1', 3, 'compare'), it('p2', 9)], phase: 'pick' },
        { items: [it('p0', 7, 'compare'), it('p1', 3, 'compare'), it('p2', 9)], phase: 'right' },
        { items: [it('p1', 3, 'swap'), it('p0', 7, 'swap'), it('p2', 9)], phase: 'swap' },
        { items: [it('p1', 3), it('p0', 7), it('p2', 9)], phase: 'idle' }
      ];
      TEASER(pred, { steps: steps, render: function (st, ctx) { pred.setAttribute('data-phase', st.phase); view.render({ items: st.items }, { duration: ctx.duration }); }, stepMs: 950, holdMs: 1500, instantWrap: true, staticIndex: 4 });
    }, 'how predict');

    // 3 Play: type numbers, bars redraw, scrub through the sort
    var play = $('[data-how="play"] [data-how-stage]');
    if (play) safe(function () {
      var host = $('[data-mv]', play), textEl = $('[data-mi-text]', play), fill = $('[data-ms-fill]', play), thumb = $('[data-ms-thumb]', play);
      var view = V.array(host, { mode: 'bars', showIndices: false, showValues: true, maxValue: 9, minValue: 0, barHeight: 60, emptyText: '\u00a0', label: 'Your numbers as bars' });
      var inputs = [[8, 3, 5, 1, 6], [2, 9, 4, 7, 1], [5, 1, 8, 2, 6]], lap = 0;
      function gen() {
        var vals = inputs[lap % inputs.length], tag = 'y' + (lap++) + '-', out = [], typed = '';
        out.push({ text: '', items: [], pos: 0 });
        vals.forEach(function (v, i) { typed += (i ? ' ' : '') + v; out.push({ text: typed, items: [], pos: 0 }); });
        var sortSteps = bubbleSteps(vals, tag).filter(function (st, i, arr) { return i === 0 || i === arr.length - 1 || st.items.some(function (x) { return x.state === 'swap'; }); });
        sortSteps.forEach(function (st, i) { out.push({ text: typed, items: st.items, pos: sortSteps.length > 1 ? i / (sortSteps.length - 1) : 1 }); });
        return out;
      }
      function render(st, ctx) {
        textEl.textContent = st.text;
        play.setAttribute('data-typing', st.items.length ? 'false' : 'true');
        view.render({ items: st.items }, { duration: ctx.duration });
        var pct = (st.pos * 100).toFixed(1) + '%';
        fill.style.width = pct; thumb.style.left = pct;
      }
      TEASER(play, { steps: gen(), render: render, stepMs: 520, holdMs: 1500, regenerate: gen, instantWrap: true, staticIndex: 8 });
    }, 'how play');

    // 4 Check: pick, confirm, explain
    var chk = $('[data-how="check"] [data-how-stage]');
    if (chk) safe(function () {
      var score = $('[data-mk-score]', chk);
      var steps = [{ phase: 'idle', score: 3 }, { phase: 'hover-c', score: 3 }, { phase: 'hover-a', score: 3 }, { phase: 'pick', score: 3 }, { phase: 'why', score: 4 }];
      TEASER(chk, { steps: steps, render: function (st) { chk.setAttribute('data-phase', st.phase); score.textContent = String(st.score); }, stepMs: 1000, holdMs: 2200, instantWrap: true, staticIndex: 4 });
    }, 'how check');
  }

  /* ================================================================== 5. journey map */
  var mapState = { host: null, canvas: null, width: 0, mode: null, focusId: null, stations: [], card: null, hoverEl: null, pinned: null };

  function mapNodes() {
    var list = [];
    C.units.forEach(function (u) {
      list.push({ kind: 'unit', unit: u, id: u.id });
      C.lessonsIn(u.id).forEach(function (l) { list.push({ kind: 'lesson', unit: u, lesson: l, id: l.id }); });
    });
    return list;
  }

  function renderSummary(p) {
    var host = $('[data-jm-summary]');
    if (!host) return;
    var total = C.lessons.length;
    var done = C.lessons.filter(function (l) { return p.completed.indexOf(l.id) !== -1; }).length;
    var inProg = C.lessons.filter(function (l) { return lessonState(l, p) === 'visited'; }).length;
    var live = C.lessons.filter(isLive).length;
    var act = primaryAction(p);
    VDSA.clear(host);
    var pct = total ? done / total : 0;
    host.appendChild(h('div', { class: 'jm__count' },
      h('span', { class: 'jm__big' }, String(done)),
      h('span', { class: 'jm__of' }, 'of ' + total + ' complete')));
    host.appendChild(h('div', { class: 'jm__meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done, 'aria-label': done + ' of ' + total + ' lessons complete' },
      h('i', { style: { width: (pct * 100).toFixed(2) + '%' } })));
    var bits = [];
    if (inProg) bits.push(inProg + ' in progress');
    bits.push(live === total ? 'every lesson is published' : live + ' of ' + total + ' published so far');
    var line = h('p', { class: 'jm__sub' }, bits.join(', ') + '.');
    if (act.lesson) line.appendChild(h('span', null, ' ', h('a', { href: act.href }, act.label)));
    host.appendChild(line);
  }

  function initMap() {
    var host = $('#journey-map'), canvas = $('[data-jm-canvas]');
    if (!host || !canvas) return;
    mapState.host = host; mapState.canvas = canvas;
    mapState.card = h('div', { class: 'jm-card', 'aria-hidden': 'true' });
    renderMap(true);
    VDSA.onResize(canvas, function (r) {
      var w = Math.round(r.width);
      if (Math.abs(w - mapState.width) >= 2) renderMap(false);
    });
  }

  function renderMap(first) {
    var canvas = mapState.canvas, p = progress();
    var active = doc.activeElement, refocus = null;
    if (active && canvas.contains(active)) refocus = active.getAttribute('data-id');
    var w = Math.round(canvas.clientWidth || canvas.getBoundingClientRect().width || 0);
    mapState.width = w;
    renderSummary(p);
    VDSA.clear(canvas);
    mapState.stations = [];
    if (w < 700) { mapState.mode = 'list'; renderMapList(canvas, p); }
    else { mapState.mode = 'svg'; renderMapSvg(canvas, w, p); }
    var hint = $('[data-jm-hint]');
    if (hint) hint.hidden = mapState.mode !== 'svg';
    if (refocus) {
      var el = canvas.querySelector('[data-id="' + refocus + '"]');
      if (el) { setRoving(el); el.focus({ preventScroll: true }); }
    }
  }

  /* ---- narrow screens: a vertical route */
  function renderMapList(canvas, p) {
    var ol = h('ol', { class: 'jl', 'aria-label': 'Course map' });
    C.units.forEach(function (u) {
      var ls = C.lessonsIn(u.id);
      var done = ls.filter(function (l) { return p.completed.indexOf(l.id) !== -1; }).length;
      var inner = h('ol', { class: 'jl__lessons' });
      ls.forEach(function (l) {
        var st = lessonState(l, p), here = p.last === l.id && st !== 'planned';
        var body = [
          h('span', { class: 'jl__dot', 'aria-hidden': 'true' }),
          h('span', { class: 'jl__num' }, pad2(l.number)),
          h('span', { class: 'jl__title' }, l.title),
          st === 'planned' ? h('span', { class: 'jl__soon' }, 'Soon') : st === 'completed' ? h('span', { class: 'sr-only' }, ' (completed)') : st === 'visited' ? h('span', { class: 'sr-only' }, ' (in progress)') : null
        ];
        var row = st === 'planned'
          ? h('span', { class: 'jl__row', 'aria-disabled': 'true', title: 'Coming soon: ' + l.subtitle }, body)
          : h('a', { class: 'jl__row', href: url(l.href), title: l.subtitle }, body);
        inner.appendChild(h('li', { class: 'jl__st jl__st--' + st + (here ? ' is-here' : ''), 'data-id': l.id }, row));
      });
      ol.appendChild(h('li', { class: 'jl__unit', 'data-unit': u.id },
        h('a', { class: 'jl__hub', href: '#' + u.id },
          h('span', { class: 'jl__hubnum', 'aria-hidden': 'true' }, String(u.number)),
          h('span', { class: 'jl__hubtitle' }, h('span', { class: 'sr-only' }, 'Unit ' + u.number + ': '), u.title),
          h('span', { class: 'jl__hubcount', 'aria-label': done + ' of ' + ls.length + ' complete' }, done + '/' + ls.length)),
        inner));
    });
    canvas.appendChild(ol);
  }

  /* ---- wide screens: a serpentine SVG route */
  function renderMapSvg(canvas, W, p) {
    var nodes = mapNodes(), N = nodes.length;
    var vz = VDSA.vz;
    var FS = 12.5, LH = 15.5, GAP = 22, RST = 13;
    function measure(text, weight) { return vz && vz.textWidth ? vz.textWidth(text, FS, false, weight || 560) : text.length * FS * 0.55; }
    function wrap(text, width, weight) {
      if (vz && vz.wrap) return vz.wrap(text, width, FS, function (t) { return measure(t, weight); }).slice(0, 3);
      return [text];
    }
    var S_MIN = 80;
    // First pass with a guessed turn radius, then refine once label heights are known.
    var R = 70, L, x0, x1, sp, labels, pitch;
    function layoutPass() {
      x0 = Math.max(R + 36, 96); x1 = W - x0;
      L = Math.floor((x1 - x0) / S_MIN) + 1;
      if (L % 2) L -= 1;
      L = Math.max(4, L);
      sp = (x1 - x0) / (L - 1);
      var wrapW = Math.min(2 * sp - 18, 168);
      labels = nodes.map(function (n) {
        var text = n.kind === 'unit' ? n.unit.title : n.lesson.title;
        return wrap(text, wrapW, n.kind === 'unit' ? 700 : 560);
      });
      var maxLines = 1;
      labels.forEach(function (ls) { maxLines = Math.max(maxLines, ls.length); });
      var zone = GAP + maxLines * LH;
      pitch = Math.max(132, 2 * zone + 34);
    }
    layoutPass();
    R = pitch / 2;
    layoutPass();
    R = pitch / 2;
    var rows = Math.ceil(N / L);
    var topZone = 26 + GAP + 3 * LH;
    // Only the first row's "above" labels need room at the top; measure them exactly.
    var firstAbove = 1;
    for (var q = 1; q < Math.min(L, N); q += 2) firstAbove = Math.max(firstAbove, labels[q].length);
    topZone = 22 + GAP + firstAbove * LH;
    var lastRowStart = (rows - 1) * L, lastBelow = 1;
    for (var q2 = lastRowStart; q2 < N; q2 += 2) lastBelow = Math.max(lastBelow, labels[q2].length);
    var H = Math.round(topZone + (rows - 1) * pitch + GAP + lastBelow * LH + 26);

    nodes.forEach(function (n, i) {
      var r = Math.floor(i / L), k = i % L, dir = r % 2 === 0 ? 1 : -1;
      n.row = r; n.k = k;
      n.x = dir > 0 ? x0 + k * sp : x1 - k * sp;
      n.y = topZone + r * pitch;
      n.above = k % 2 === 1;
      n.labelH = GAP + labels[i].length * LH;
    });

    function seg(i) { // path command from node i-1 to node i
      var a = nodes[i - 1], b = nodes[i];
      if (a.row === b.row) return 'L' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
      var sweep = a.row % 2 === 0 ? 1 : 0;
      return 'A' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 0 ' + sweep + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }
    function pathFrom(i, j) { // from node i to node j (i < j)
      var d = 'M' + nodes[i].x.toFixed(1) + ' ' + nodes[i].y.toFixed(1);
      for (var k = i + 1; k <= j; k++) d += seg(k);
      return d;
    }

    var svg = s('svg', { class: 'jm-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'group', 'aria-label': 'Course map: 7 units and ' + C.lessons.length + ' lessons along one route. Use the arrow keys to move between stations.' });
    svg.style.height = H + 'px';
    var gBand = s('g', { class: 'jm-bands', 'aria-hidden': 'true' });
    var gLine = s('g', { class: 'jm-lines', 'aria-hidden': 'true' });
    var gNodes = s('g', { class: 'jm-nodes' });
    svg.appendChild(gBand); svg.appendChild(gLine); svg.appendChild(gNodes);

    // Start marker before the first hub
    var n0 = nodes[0];
    gLine.appendChild(s('path', { class: 'jm-start', d: 'M' + (n0.x - 46) + ' ' + n0.y + 'H' + n0.x }));
    gLine.appendChild(s('circle', { class: 'jm-start-dot', cx: n0.x - 46, cy: n0.y, r: 4 }));

    // Finish marker after the last station
    var nl = nodes[N - 1], fdir = nl.row % 2 === 0 ? 1 : -1;
    gLine.appendChild(s('path', { class: 'jm-start', d: 'M' + nl.x + ' ' + nl.y + 'H' + (nl.x + fdir * 46) }));
    gLine.appendChild(s('circle', { class: 'jm-start-dot', cx: nl.x + fdir * 46, cy: nl.y, r: 4 }));

    // Unit bands and lines
    C.units.forEach(function (u) {
      var a = -1, b = -1;
      nodes.forEach(function (n, i) { if (n.unit === u) { if (a < 0) a = i; b = i; } });
      if (a < 0) return;
      gBand.appendChild(s('path', { class: 'jm-band', 'data-unit': u.id, d: pathFrom(a, b) }));
      // line segments into each node of this unit (the lead-in to the hub takes the unit's colour)
      for (var i = Math.max(1, a); i <= b; i++) {
        var n = nodes[i];
        var soft = n.kind === 'lesson' && !isLive(n.lesson);
        gLine.appendChild(s('path', { class: 'jm-line' + (soft ? ' is-soft' : ''), 'data-unit': u.id, d: 'M' + nodes[i - 1].x.toFixed(1) + ' ' + nodes[i - 1].y.toFixed(1) + seg(i) }));
      }
    });

    // Stations
    var rovingSet = false, preferred = null;
    var hereId = p.last && C.byId(p.last) && isLive(C.byId(p.last)) ? p.last : null;
    nodes.forEach(function (n, i) {
      var lines = labels[i];
      var ty = n.above ? n.y - GAP - (lines.length - 1) * LH : n.y + GAP + LH * 0.72;
      var label = s('text', { class: 'jm-label', x: n.x.toFixed(1), y: ty.toFixed(1), 'text-anchor': 'middle' });
      lines.forEach(function (ln, li) { label.appendChild(s('tspan', { x: n.x.toFixed(1), dy: li ? LH : 0 }, ln)); });
      var g;
      if (n.kind === 'unit') {
        g = s('a', { class: 'jm-hub', 'data-unit': n.unit.id, 'data-id': n.id, href: '#' + n.unit.id, tabindex: -1,
          'aria-label': 'Unit ' + n.unit.number + ': ' + n.unit.title + '. ' + C.lessonsIn(n.unit.id).length + ' lessons.' },
          s('rect', { class: 'jm-hub__ring', x: n.x - 21, y: n.y - 21, width: 42, height: 42, rx: 13 }),
          s('rect', { class: 'jm-hub__box', x: n.x - 16, y: n.y - 16, width: 32, height: 32, rx: 10 }),
          s('text', { class: 'jm-hub__num', x: n.x, y: n.y + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(n.unit.number)),
          label);
      } else {
        var l = n.lesson, st = lessonState(l, p), here = hereId === l.id;
        var attrs = { class: 'jm-st jm-st--' + st + (here ? ' is-here' : ''), 'data-unit': n.unit.id, 'data-id': l.id, tabindex: -1,
          'aria-label': 'Lesson ' + l.number + ': ' + l.title + '. ' + l.minutes + ' minutes. ' + STATE_TEXT[st] + '.' + (here ? ' Where you left off.' : '') };
        if (st === 'planned') { attrs.role = 'link'; attrs['aria-disabled'] = 'true'; }
        else attrs.href = url(l.href);
        g = s('a', attrs,
          here ? s('circle', { class: 'jm-st__pulse', cx: n.x, cy: n.y, r: RST + 6 }) : null,
          s('circle', { class: 'jm-st__ring', cx: n.x, cy: n.y, r: RST + 6 }),
          s('circle', { class: 'jm-st__hit', cx: n.x, cy: n.y, r: RST + 10 }),
          s('circle', { class: 'jm-st__dot', cx: n.x, cy: n.y, r: RST }),
          st === 'completed'
            ? s('path', { class: 'jm-st__check', d: 'M' + (n.x - 5.2) + ' ' + (n.y + 0.2) + 'l3.4 3.4 6.8-7' })
            : s('text', { class: 'jm-st__num', x: n.x, y: n.y + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, pad2(l.number)),
          label);
        if (here) preferred = g;
        if (!preferred && st !== 'planned' && st !== 'completed' && !rovingSet) { preferred = g; rovingSet = true; }
      }
      n.el = g;
      mapState.stations.push({ el: g, node: n });
      gNodes.appendChild(g);
    });
    var first = preferred || (mapState.stations[1] && mapState.stations[1].el) || mapState.stations[0].el;
    first.setAttribute('tabindex', '0');

    canvas.appendChild(svg);
    canvas.appendChild(mapState.card);
    hideCard();
    wireMap(svg);
  }

  function setRoving(el) {
    mapState.stations.forEach(function (st) { st.el.setAttribute('tabindex', st.el === el ? '0' : '-1'); });
  }
  function stationFor(el) {
    for (var i = 0; i < mapState.stations.length; i++) if (mapState.stations[i].el === el) return i;
    return -1;
  }
  function wireMap(svg) {
    function target(e) { return e.target.closest ? e.target.closest('.jm-st, .jm-hub') : null; }
    svg.addEventListener('pointerover', function (e) {
      var t = target(e);
      if (t && t !== mapState.hoverEl) { mapState.hoverEl = t; showCard(t); }
    });
    svg.addEventListener('pointerleave', function () {
      mapState.hoverEl = null;
      var f = doc.activeElement;
      if (f && svg.contains(f)) showCard(f); else hideCard();
    });
    svg.addEventListener('focusin', function (e) { var t = target(e); if (t) { setRoving(t); showCard(t); } });
    svg.addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !svg.contains(e.relatedTarget)) { if (mapState.hoverEl) showCard(mapState.hoverEl); else hideCard(); }
    });
    svg.addEventListener('click', function (e) {
      var t = target(e);
      if (t && t.getAttribute('aria-disabled') === 'true') { e.preventDefault(); t.focus({ preventScroll: true }); showCard(t); }
    });
    svg.addEventListener('keydown', function (e) {
      var t = target(e);
      if (!t) return;
      var i = stationFor(t), j = -1, n = mapState.stations.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = Math.min(n - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = Math.max(0, i - 1);
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      else if ((e.key === 'Enter' || e.key === ' ') && t.getAttribute('aria-disabled') === 'true') { e.preventDefault(); showCard(t); return; }
      else if (e.key === ' ' && t.hasAttribute('href')) { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return; }
      if (j < 0) return;
      e.preventDefault();
      var el = mapState.stations[j].el;
      setRoving(el);
      el.focus({ preventScroll: false });
    });
  }

  function showCard(el) {
    var card = mapState.card, i = stationFor(el);
    if (!card || i < 0) return;
    var n = mapState.stations[i].node, p = progress();
    VDSA.clear(card);
    card.setAttribute('data-unit', n.unit.id);
    if (n.kind === 'unit') {
      var ls = C.lessonsIn(n.unit.id), mins = ls.reduce(function (a, l) { return a + l.minutes; }, 0);
      var done = ls.filter(function (l) { return p.completed.indexOf(l.id) !== -1; }).length;
      card.appendChild(h('p', { class: 'jm-card__kicker' }, h('span', { class: 'jm-card__swatch' }), 'Unit ' + n.unit.number));
      card.appendChild(h('p', { class: 'jm-card__title' }, n.unit.title));
      card.appendChild(h('p', { class: 'jm-card__text' }, n.unit.blurb));
      card.appendChild(h('p', { class: 'jm-card__meta' }, ls.length + ' lessons, about ' + Math.round(mins / 5) * 5 + ' minutes. ' + done + ' complete.'));
      card.appendChild(h('p', { class: 'jm-card__action' }, 'Jump to the unit'));
    } else {
      var l = n.lesson, st = lessonState(l, p);
      card.appendChild(h('p', { class: 'jm-card__kicker' }, h('span', { class: 'jm-card__swatch' }), 'Lesson ' + pad2(l.number) + ' in ' + n.unit.title));
      card.appendChild(h('p', { class: 'jm-card__title' }, l.title));
      card.appendChild(h('p', { class: 'jm-card__text' }, l.subtitle));
      card.appendChild(h('p', { class: 'jm-card__meta' },
        h('span', { class: 'jm-card__state jm-card__state--' + st }, STATE_TEXT[st]),
        h('span', null, l.minutes + ' min')));
      card.appendChild(h('p', { class: 'jm-card__action' + (st === 'planned' ? ' is-muted' : '') },
        st === 'planned' ? 'This lesson is being written.' : st === 'completed' ? 'Open to review' : st === 'visited' ? 'Open to continue' : 'Open the lesson'));
    }
    var W = mapState.width, cw = 290;
    var x = n.x - cw / 2;
    x = Math.max(8, Math.min(W - cw - 8, x));
    card.style.width = cw + 'px';
    card.style.left = x + 'px';
    card.classList.add('is-measuring');
    var chH = card.offsetHeight;
    card.classList.remove('is-measuring');
    // Put the card on the side opposite the label so it never hides the station's title.
    // Prefer the side opposite the station's label; if that leaves the map, clear the label on the other side.
    var Hc = mapState.canvas.clientHeight, lh = n.labelH || 40;
    var cands = n.above ? [n.y + 30, n.y - lh - 10 - chH] : [n.y - 30 - chH, n.y + lh + 10];
    function fits(v) { return v >= 4 && v + chH <= Hc - 4; }
    var y = fits(cands[0]) || !fits(cands[1]) ? cands[0] : cands[1];
    if (!fits(y) && y < 4) y = cands[1];
    card.style.top = y + 'px';
    card.classList.add('is-on');
  }
  function hideCard() { if (mapState.card) mapState.card.classList.remove('is-on'); }

  /* ================================================================== 6. unit cards */
  function ring(frac, size, stroke, label) {
    var r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return s('svg', { class: 'ring', viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, role: 'img', 'aria-label': label },
      s('circle', { class: 'ring__track', cx: size / 2, cy: size / 2, r: r, 'stroke-width': stroke }),
      s('circle', { class: 'ring__bar', cx: size / 2, cy: size / 2, r: r, 'stroke-width': stroke, 'stroke-dasharray': c.toFixed(2), 'stroke-dashoffset': (c * (1 - frac)).toFixed(2), 'stroke-opacity': frac > 0 ? 1 : 0, transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')' }));
  }

  function renderUnits() {
    var host = $('[data-units]');
    if (!host) return;
    var p = progress();
    VDSA.clear(host);
    C.units.forEach(function (u) {
      var ls = C.lessonsIn(u.id);
      var done = ls.filter(function (l) { return p.completed.indexOf(l.id) !== -1; }).length;
      var live = ls.filter(isLive).length;
      var mins = ls.reduce(function (a, l) { return a + l.minutes; }, 0);
      var list = h('ol', { class: 'unit__lessons' });
      ls.forEach(function (l) {
        var st = lessonState(l, p);
        var inner = [
          h('span', { class: 'unit__mark', 'aria-hidden': 'true' }),
          h('span', { class: 'unit__num' }, pad2(l.number)),
          h('span', { class: 'unit__ltitle' }, l.title),
          h('span', { class: 'sr-only' }, ' (' + STATE_TEXT[st].toLowerCase() + ')')
        ];
        list.appendChild(h('li', { class: 'unit__lesson unit__lesson--' + st },
          st === 'planned' ? h('span', { class: 'unit__row', title: 'Coming soon: ' + l.subtitle }, inner) : h('a', { class: 'unit__row', href: url(l.href), title: l.subtitle }, inner)));
      });
      var status = live === 0 ? 'Coming soon' : live === ls.length ? 'All ' + ls.length + ' lessons ready' : live + ' of ' + ls.length + ' lessons ready';
      host.appendChild(h('article', { class: 'unit', id: u.id, 'data-unit': u.id, 'aria-labelledby': u.id + '-title' },
        h('header', { class: 'unit__head' },
          h('span', { class: 'unit__badge', 'aria-hidden': 'true' }, String(u.number)),
          h('div', { class: 'unit__ring' }, ring(ls.length ? done / ls.length : 0, 44, 5, done + ' of ' + ls.length + ' lessons complete'),
            h('span', { class: 'unit__ringtext', 'aria-hidden': 'true' }, done + '/' + ls.length))),
        h('h3', { class: 'unit__title', id: u.id + '-title' }, h('span', { class: 'sr-only' }, 'Unit ' + u.number + ': '), u.title),
        h('p', { class: 'unit__blurb' }, u.blurb),
        list,
        h('p', { class: 'unit__foot' }, h('span', null, ls.length + ' lessons · about ' + Math.round(mins / 5) * 5 + ' min'), h('span', { class: 'unit__status' + (live ? '' : ' is-soon') }, status))));
    });

    // An eighth card: overall progress, resume and reset.
    var total = C.lessons.length;
    var doneAll = C.lessons.filter(function (l) { return p.completed.indexOf(l.id) !== -1; }).length;
    var visitedAll = C.lessons.filter(function (l) { return lessonState(l, p) === 'visited'; }).length;
    var act = primaryAction(p);
    var resetBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm you__reset' }, 'Reset progress');
    resetBtn.addEventListener('click', function () {
      if (win.confirm('Clear your saved progress for every lesson? This cannot be undone.')) VDSA.progress.reset();
    });
    var hasProgress = p.visited.length || p.completed.length;
    host.appendChild(h('article', { class: 'unit you', 'aria-labelledby': 'you-title' },
      h('header', { class: 'unit__head' },
        h('div', { class: 'you__ring' }, ring(total ? doneAll / total : 0, 92, 8, doneAll + ' of ' + total + ' lessons complete'),
          h('span', { class: 'you__pct', 'aria-hidden': 'true' }, Math.round(total ? 100 * doneAll / total : 0) + '%'))),
      h('h3', { class: 'unit__title', id: 'you-title' }, 'Your progress'),
      h('p', { class: 'unit__blurb' }, hasProgress
        ? doneAll + ' of ' + total + ' lessons complete' + (visitedAll ? ', ' + visitedAll + ' in progress.' : '.')
        : 'Nothing yet. Open a lesson and it will be marked here, in this browser only.'),
      h('div', { class: 'you__actions' },
        h('a', { class: 'btn btn--primary btn--sm you__go', href: act.href }, h('span', { class: 'you__go-label' }, act.label)),
        hasProgress ? resetBtn : null)));
  }

  /* ================================================================== 7. labs */
  var LAB_THUMBS = {
    'sorting-arena': function (host) {
      var wrap = h('div', { class: 'lt-race' }), top = h('div', { class: 'lt-race__lane' }), bot = h('div', { class: 'lt-race__lane' });
      wrap.appendChild(h('span', { class: 'lt-race__tag' }, 'bubble')); wrap.appendChild(top);
      wrap.appendChild(h('span', { class: 'lt-race__tag' }, 'quick')); wrap.appendChild(bot);
      host.appendChild(wrap);
      var o = { mode: 'bars', showIndices: false, showValues: false, maxValue: 99, minValue: 0, barHeight: 44, label: 'Sorting race' };
      var va = V.array(top, o), vb = V.array(bot, o);
      var vals = [52, 17, 88, 35, 64, 9, 73, 41, 26, 95, 58, 12];
      var A = swapTrace(vals, 'ba', 'bubble'), B = swapTrace(vals, 'qa', 'quick');
      var steps = []; for (var i = 0; i < Math.max(A.length, B.length); i++) steps.push({ a: A[Math.min(i, A.length - 1)], b: B[Math.min(i, B.length - 1)] });
      return { steps: steps, stepMs: 170, holdMs: 1800, render: function (st, ms) { va.render(st.a, { duration: ms }); vb.render(st.b, { duration: ms }); } };
    },
    pathfinder: function (host) {
      var view = V.grid(host, { mode: 'path', cellSize: 16, label: 'Pathfinding' });
      var walls = [];
      for (var r = 0; r < 6; r++) walls.push([r, 5]);
      for (r = 3; r < 9; r++) walls.push([r, 10]);
      var steps = bfsGridSteps(9, 16, walls, [4, 1], [4, 14], 2);
      if (view.prepare) view.prepare(steps);
      return { steps: steps, stepMs: 170, holdMs: 1600, render: function (st, ms) { view.render(st, { duration: ms }); } };
    },
    'graph-studio': function (host) {
      var P = { A: [110, 150], B: [380, 80], C: [640, 150], D: [900, 110], E: [230, 450], F: [520, 400], G: [820, 470] };
      var E = [['A', 'B', 4], ['A', 'E', 2], ['B', 'C', 6], ['B', 'F', 3], ['C', 'D', 5], ['C', 'F', 1], ['D', 'G', 2], ['E', 'F', 7], ['F', 'G', 4], ['C', 'G', 8]];
      var sorted = E.slice().sort(function (a, b) { return a[2] - b[2]; });
      var parent = {}; Object.keys(P).forEach(function (k) { parent[k] = k; });
      function find(x) { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; }
      var est = {}, nst = {}, steps = [];
      function snap(cur) {
        steps.push({
          nodes: Object.keys(P).map(function (k) { return { id: k, x: P[k][0], y: P[k][1], state: nst[k] || 'default' }; }),
          edges: E.map(function (e) { var id = e[0] + '-' + e[1]; return { from: e[0], to: e[1], weight: e[2], state: cur === id ? 'compare' : est[id] || 'default', dashed: est[id] === 'muted' }; })
        });
      }
      snap();
      sorted.forEach(function (e) {
        var id = e[0] + '-' + e[1];
        snap(id);
        var a = find(e[0]), b = find(e[1]);
        if (a !== b) { parent[a] = b; est[id] = 'path'; nst[e[0]] = nst[e[1]] = 'done'; } else est[id] = 'muted';
      });
      snap();
      var view = V.graph(host, { label: 'Kruskal’s minimum spanning tree', nodeRadius: 22, bounds: 'auto', maxHeight: 152 });
      return { steps: steps, stepMs: 560, holdMs: 1800, render: function (st, ms) { view.render(st, { duration: ms }); } };
    },
    'tree-studio': function (host) {
      var order = [50, 30, 70, 20, 40, 60, 80, 35, 65];
      var nodes = {}, rootId = null, steps = [];
      function snapshot(newId, path) {
        var list = Object.keys(nodes).map(function (id) { var n = nodes[id]; return { id: id, value: n.value, left: n.left, right: n.right, state: id === newId ? 'key' : 'default' }; });
        var edges = {}; for (var i = 1; i < path.length; i++) edges[path[i - 1] + '-' + path[i]] = 'path';
        steps.push({ root: rootId, nodes: list, edges: edges });
      }
      order.forEach(function (v) {
        var id = 't' + v; nodes[id] = { value: v, left: null, right: null };
        var path = [];
        if (!rootId) rootId = id;
        else {
          var cur = rootId;
          for (;;) {
            path.push(cur);
            var side = v < nodes[cur].value ? 'left' : 'right';
            if (!nodes[cur][side]) { nodes[cur][side] = id; break; }
            cur = nodes[cur][side];
          }
        }
        path.push(id);
        snapshot(id, path);
      });
      snapshot(null, []);
      var view = V.tree(host, { label: 'Binary search tree inserts', nodeSize: 30, height: 150 });
      view.prepare(steps);
      return { steps: steps, stepMs: 650, holdMs: 1800, render: function (st, ms) { view.render(st, { duration: ms }); } };
    },
    'big-o-explorer': function (host) {
      if (!V.chart) return null;
      var view = V.chart(host, { type: 'line', hover: false, height: 150, labels: 'direct', label: 'Growth rates' });
      var series = [
        { id: 'log', label: 'log n', fn: function (n) { return Math.log2(n); }, domain: [1, 32] },
        { id: 'n', label: 'n', fn: function (n) { return n; }, domain: [1, 32] },
        { id: 'nlogn', label: 'n log n', fn: function (n) { return n * Math.log2(n); }, domain: [1, 32] },
        { id: 'n2', label: 'n²', fn: function (n) { return n * n; }, domain: [1, 32] }
      ];
      var steps = [
        { x: { min: 1, max: 32, ticks: 3 }, y: { min: 0, max: 200, ticks: 3 }, series: series },
        { x: { min: 1, max: 32, ticks: 3 }, y: { min: 1, max: 1100, scale: 'log', ticks: 3 }, series: series }
      ];
      return { steps: steps, stepMs: 2200, holdMs: 2400, startAt: 0, render: function (st, ms) { view.render(st, { duration: ms ? 900 : 0 }); } };
    },
    'structure-chooser': function (host) {
      if (!V.flowchart) return null;
      var spec = {
        nodes: [
          { id: 'q', type: 'decision', text: 'By key?', col: 0, row: 0 },
          { id: 'hash', type: 'end', text: 'Hash table', col: 1, row: 0 },
          { id: 'q2', type: 'decision', text: 'In order?', col: 0, row: 1 },
          { id: 'bst', type: 'end', text: 'Balanced tree', col: 1, row: 1 },
          { id: 'arr', type: 'end', text: 'Array', col: 2, row: 1 }
        ],
        edges: [
          { from: 'q', to: 'hash', label: 'yes' }, { from: 'q', to: 'q2', label: 'no' },
          { from: 'q2', to: 'bst', label: 'yes' }, { from: 'q2', to: 'arr', label: 'no', via: { fromSide: 'bottom', toSide: 'bottom' } }
        ]
      };
      var view = V.flowchart(host, spec, { label: 'Which structure should I use?' });
      var steps = [{ active: 'q' }, { active: 'q2', visited: ['q'] }, { active: 'bst', visited: ['q', 'q2'], edgeStates: { 'q->q2': 'path', 'q2->bst': 'path' } }, { active: 'q' }, { active: 'hash', visited: ['q'], edgeStates: { 'q->hash': 'path' } }];
      return { steps: steps, stepMs: 1100, holdMs: 1500, startAt: 2, render: function (st, ms) { view.render(st, { duration: ms }); } };
    },
    history: function (host) {
      var ev = [['c. 300 BCE', 'Euclid'], ['825', 'al-Khwarizmi'], ['1843', 'Lovelace'], ['1936', 'Turing'], ['1959', 'Dijkstra'], ['1971', 'Cook'], ['2025', 'Today']];
      var line = h('div', { class: 'lt-tl' });
      var dots = ev.map(function (e, i) { return h('span', { class: 'lt-tl__dot', style: { left: (6 + i * (88 / (ev.length - 1))) + '%' } }); });
      var year = h('span', { class: 'lt-tl__year' }), who = h('span', { class: 'lt-tl__who' });
      var flag = h('span', { class: 'lt-tl__flag' }, year, who);
      line.appendChild(h('span', { class: 'lt-tl__rule' }));
      dots.forEach(function (d) { line.appendChild(d); });
      line.appendChild(flag);
      host.appendChild(line);
      var steps = ev.map(function (e, i) { return { i: i }; });
      return { steps: steps, stepMs: 950, holdMs: 1400, startAt: 3, render: function (st) {
        var e = ev[st.i];
        year.textContent = e[0]; who.textContent = e[1];
        flag.style.left = (6 + st.i * (88 / (ev.length - 1))) + '%';
        dots.forEach(function (d, k) { d.classList.toggle('is-past', k < st.i); d.classList.toggle('is-on', k === st.i); });
      } };
    },
    cheatsheet: function (host) {
      var rows = [['Array', '1', 'n'], ['Hash table', '1', '1'], ['Balanced BST', 'logn', 'logn'], ['Binary heap', 'n', 'logn']];
      var table = h('div', { class: 'lt-cs' },
        h('span', { class: 'lt-cs__h' }), h('span', { class: 'lt-cs__h' }, 'access'), h('span', { class: 'lt-cs__h' }, 'insert'));
      var rowEls = rows.map(function (r) {
        var cells = [h('span', { class: 'lt-cs__name' }, r[0]), h('span', { class: 'big-o', 'data-o': r[1] }), h('span', { class: 'big-o', 'data-o': r[2] })];
        cells.forEach(function (c) { table.appendChild(c); });
        return cells;
      });
      host.appendChild(table);
      if (VDSA.shell && VDSA.shell.fillBigO) VDSA.shell.fillBigO(table);
      var steps = rows.map(function (r, i) { return { i: i }; });
      return { steps: steps, stepMs: 900, holdMs: 900, startAt: 2, render: function (st) {
        rowEls.forEach(function (cells, k) { cells.forEach(function (c) { c.classList.toggle('is-on', k === st.i); }); });
      } };
    },
    'code-machine': function (host) {
      var prog = ['LOAD 7', 'ADD 5', 'STORE 9', 'OUT', 'HALT'];
      var acc = h('span', { class: 'lt-cm__acc' }, 'ACC ', h('b', null, '0'), h('span', { class: 'lt-cm__out' }, 'OUT ', h('b', null, '–')));
      var box = h('div', { class: 'lt-cm__mem' });
      host.appendChild(box); host.appendChild(acc);
      var view = V.array(box, { mode: 'boxes', cellAspect: 1.9, cellSize: 40, label: 'Instruction memory', indexStart: 0 });
      var accs = [0, 7, 12, 12, 12, 12], outs = ['–', '–', '–', '–', '12', '12'];
      var steps = [];
      for (var i = 0; i <= prog.length; i++) {
        steps.push({
          view: { items: prog.map(function (t, k) { return { id: 'c' + k, value: t, text: t, state: k === i ? 'active' : k < i ? 'visited' : 'default' }; }), pointers: i < prog.length ? [{ name: 'PC', index: i, state: 'active' }] : [] },
          acc: accs[i], out: outs[i]
        });
      }
      view.prepare(steps.map(function (x) { return x.view; }));
      var accB = acc.querySelector('b'), outB = acc.querySelector('.lt-cm__out b');
      return { steps: steps, stepMs: 800, holdMs: 1400, render: function (st, ms) { view.render(st.view, { duration: ms }); accB.textContent = String(st.acc); outB.textContent = st.out; } };
    }
  };

  function renderLabs() {
    var host = $('[data-labs]');
    if (!host) return;
    VDSA.clear(host);
    var cards = [];
    C.labs.forEach(function (lab) {
      var thumb = h('div', { class: 'labcard__thumb', 'aria-hidden': 'true', 'data-thumb': lab.id });
      var a = h('a', { class: 'labcard', href: url(lab.href), 'data-lab': lab.id },
        thumb,
        h('span', { class: 'labcard__body' },
          h('span', { class: 'labcard__title' }, lab.title),
          h('span', { class: 'labcard__blurb' }, lab.blurb)));
      host.appendChild(h('li', null, a));
      cards.push({ lab: lab, a: a, thumb: thumb, loop: null });
    });
    $$('[data-lab-link]').forEach(function (a) {
      var lab = labById(a.getAttribute('data-lab-link'));
      if (lab) a.href = url(lab.href);
    });
    initLabThumbs(host, cards);
  }

  function initLabThumbs(host, cards) {
    var built = false, visible = false, spot = -1, spotTimer = 0, hoverCard = null;
    function build() {
      if (built) return;
      built = true;
      var extra = [];
      if (!V.chart) extra.push(loadScript(url('js/vdsa/views/chart.js')).catch(function (e) { console.warn('[home]', e.message); }));
      if (!V.flowchart) extra.push(loadScript(url('js/vdsa/views/flowchart.js')).catch(function (e) { console.warn('[home]', e.message); }));
      Promise.all(extra).then(function () {
        V = VDSA.views || V;
        cards.forEach(function (c) {
          var make = LAB_THUMBS[c.lab.id];
          var spec = make ? safe(function () { return make(c.thumb); }, 'lab thumb ' + c.lab.id) : null;
          if (spec && spec.steps && spec.steps.length) {
            c.loop = Loop({ steps: spec.steps, render: spec.render, stepMs: spec.stepMs, holdMs: spec.holdMs, instantWrap: true, startAt: spec.startAt === undefined ? spec.steps.length - 1 : spec.startAt });
            c.thumb.classList.add('is-ready');
          } else {
            c.thumb.classList.add('is-generic');
          }
        });
        schedule();
      });
    }
    function stopAll() { cards.forEach(function (c) { if (c.loop) c.loop.pause(); c.a.classList.remove('is-playing'); }); }
    function playCard(c) { stopAll(); if (c && c.loop && !reduced()) { c.loop.play(); c.a.classList.add('is-playing'); } }
    // advance: move the spotlight to the next card (timer); otherwise keep or start the current one.
    function schedule(advance) {
      clearTimeout(spotTimer);
      if (!built || hoverCard || !visible || doc.hidden || reduced()) { if (!hoverCard) stopAll(); return; }
      if (advance === true || spot < 0 || !cards[spot].loop) {
        spot = (spot + 1) % cards.length;
        var tries = 0;
        while (!cards[spot].loop && tries++ < cards.length) spot = (spot + 1) % cards.length;
      }
      playCard(cards[spot]);
      spotTimer = setTimeout(function () { schedule(true); }, 5200);
    }
    cards.forEach(function (c, i) {
      function on() { hoverCard = c; clearTimeout(spotTimer); spot = i; playCard(c); }
      function off() { if (hoverCard === c) { hoverCard = null; spotTimer = setTimeout(function () { schedule(true); }, 1800); } }
      c.a.addEventListener('pointerenter', on);
      c.a.addEventListener('pointerleave', off);
      c.a.addEventListener('focus', on);
      c.a.addEventListener('blur', off);
    });
    // Build when the section gets close; play only while it is on screen.
    if ('IntersectionObserver' in win) {
      var near = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { near.disconnect(); build(); } }, { rootMargin: '600px 0px' });
      near.observe(host);
    } else build();
    // Also build during idle time after load, so the thumbnails are ready before anyone scrolls there.
    var idle = win.requestIdleCallback || function (fn) { return setTimeout(fn, 1800); };
    win.addEventListener('load', function () { idle(function () { build(); }, { timeout: 4000 }); });
    VDSA.onVisible(host, function (v) { visible = v; schedule(false); }, { threshold: 0.15 });
    doc.addEventListener('visibilitychange', function () { schedule(false); });
  }

  /* ================================================================== hash targets built by script */
  function scrollToHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    if (!id) return;
    var el = doc.getElementById(id);
    if (el && el.closest('[data-units]')) win.requestAnimationFrame(function () { el.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  }

  /* ================================================================== boot */
  function refresh() {
    safe(renderActions, 'actions');
    safe(function () { if (mapState.canvas) renderMap(false); }, 'map');
    safe(renderUnits, 'units');
  }
  function boot() {
    safe(renderActions, 'actions');
    safe(initReel, 'reel');
    safe(initStats, 'stats');
    safe(initHow, 'how');
    safe(initMap, 'map');
    safe(renderUnits, 'units');
    safe(renderLabs, 'labs');
    scrollToHash();
    if (VDSA.progress && VDSA.progress.onChange) VDSA.progress.onChange(function () { refresh(); });
  }
  win.VDSAHome = { refresh: refresh };
  VDSA.ready(boot);
}(typeof window !== 'undefined' ? window : null));
