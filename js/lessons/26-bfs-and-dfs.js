/* Lesson 26 · BFS & DFS — shared helpers and the figures from the hero to the DFS section.
   Part 2 (graph lab, grid lab, flowcharts): js/lessons/26-bfs-and-dfs-labs.js
   Part 3 (components, bipartite, cycles, patterns, cost, checks, summary): js/lessons/26-bfs-and-dfs-more.js
   Step generators: js/algos/26-bfs-and-dfs.js (VDSA.algos.graphSearch). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var GS = V.algos.graphSearch;
  var L = V.L26 = V.L26 || {};

  /* ================================================================== data */
  function graph(nodes, edges, directed) {
    return { nodes: nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2], label: n[3] }; }), edges: edges, directed: !!directed };
  }
  /* The lesson graph: BFS from A gives layers {A} {B,C} {D,E,F} {G,H} {I}; DFS from A dives A B D G E C F H I. */
  L.MAIN = graph(
    [['A', 100, 300], ['B', 280, 140], ['C', 280, 460], ['D', 490, 80], ['E', 490, 300], ['F', 490, 520], ['G', 700, 190], ['H', 700, 420], ['I', 900, 300]],
    [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['C', 'F'], ['D', 'G'], ['E', 'G'], ['E', 'H'], ['F', 'H'], ['G', 'I'], ['H', 'I']]);
  L.SOCIAL = graph(
    [['You', 500, 290], ['Ana', 320, 170], ['Ben', 690, 170], ['Cat', 340, 420], ['Dan', 130, 100], ['Eve', 880, 90], ['Fay', 140, 360], ['Ivy', 880, 330], ['Gus', 170, 560], ['Hal', 500, 520]],
    [['You', 'Ana'], ['You', 'Ben'], ['You', 'Cat'], ['Ana', 'Dan'], ['Ben', 'Eve'], ['Cat', 'Fay'], ['Dan', 'Fay'], ['Eve', 'Ivy'], ['Fay', 'Gus'], ['Gus', 'Hal']]);
  L.graph = graph;

  function last(a) { return a[a.length - 1]; }
  L.last = last;

  /* ================================================================== lazy init */
  /* Build a figure when it comes within ~one screen of the viewport (or before printing). */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 26] figure failed', el.id, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };

  /* ================================================================== graph snapshots */
  /* graphState(graph, step, opts) -> graph view state.
     opts.badge: 'dist' shows BFS distances (∞ before discovery); opts.sub: 'times' shows DFS d/f;
     opts.pos: {id: {x, y}} overrides positions; opts.mapNode(node, step) / opts.mapEdge(edge, step) tweak. */
  L.graphState = function (g, step, o) {
    o = o || {};
    var directed = !!g.directed;
    var nodes = g.nodes.map(function (n) {
      var st = step && step.states ? (step.states[n.id] || 'default') : 'default';
      var p = o.pos && o.pos[n.id] ? o.pos[n.id] : n;
      var node = { id: n.id, x: p.x, y: p.y, state: st };
      if (n.label) node.label = n.label;
      if (step && o.badge === 'dist' && step.dist) {
        var d = step.dist[n.id];
        node.badge = d === null || d === undefined ? '∞' : d;
      }
      if (step && o.sub === 'times' && step.disc && step.disc[n.id] !== null && step.disc[n.id] !== undefined) {
        node.sub = step.disc[n.id] + '/' + (step.fin[n.id] === null || step.fin[n.id] === undefined ? '–' : step.fin[n.id]);
      }
      if (o.mapNode) o.mapNode(node, step);
      return node;
    });
    var edges = g.edges.map(function (e) {
      var a = e[0], b = e[1], key = GS.edgeKey(a, b, directed);
      var edge = { id: key, from: a, to: b, directed: directed, state: (step && step.edges && step.edges[key]) || 'default' };
      if (step && step.pulse && GS.edgeKey(step.pulse.from, step.pulse.to, directed) === key) {
        edge.from = step.pulse.from; edge.to = step.pulse.to;
        edge.state = step.kind === 'back' || step.kind === 'conflict' ? 'error' : 'compare';
        edge.pulse = true;
      }
      if (o.mapEdge) o.mapEdge(edge, step);
      return edge;
    });
    return { nodes: nodes, edges: edges };
  };

  /* Frontier containers as queue / stack view states. */
  L.queueState = function (step, o) {
    o = o || {};
    var seenEarlier = {};
    var visited = {};
    (step.order || []).forEach(function (id) { visited[id] = true; });
    return {
      items: (step.queue || []).map(function (q) {
        var dup = o.copies && (seenEarlier[q.v] || visited[q.v]);
        seenEarlier[q.v] = true;
        return { id: q.t, value: q.v, state: dup ? 'error' : 'frontier' };
      })
    };
  };
  L.stackState = function (step) {
    var st = step.stack || [];
    return { items: st.map(function (v, i) { return { id: 's' + v, value: v, state: i === st.length - 1 ? 'active' : 'frontier' }; }) };
  };

  /* Put data-id / data-label on graph view nodes so VDSA.clickQuiz can target them (the view has no ids). */
  L.tagNodes = function (view, describe) {
    V.$$('.vz-gnode', view.el).forEach(function (g) {
      var t = g.querySelector('.vz-value');
      var id = t ? t.textContent : '';
      if (!id) return;
      g.setAttribute('data-id', id);
      g.setAttribute('data-label', describe ? describe(id) : 'Vertex ' + id);
    });
  };

  /* A keyed row of chips for "visit order": new chips animate in, removed ones disappear. */
  L.orderChips = function (el) {
    var chips = {};
    return function (order, dur) {
      el.style.setProperty('--bd-dur', Math.max(1, dur || 0) + 'ms');
      var want = {};
      order.forEach(function (id) { want[id] = true; });
      Object.keys(chips).forEach(function (id) { if (!want[id]) { chips[id].remove(); delete chips[id]; } });
      var empty = el.querySelector('.bd-order__empty');
      if (!order.length && !empty) el.appendChild(h('span', { class: 'bd-order__empty' }, 'nothing yet'));
      if (order.length && empty) empty.remove();
      order.forEach(function (id, i) {
        var c = chips[id];
        if (!c) { c = chips[id] = h('span', { class: 'bd-order__chip' }, id); }
        if (el.children[i] !== c) el.insertBefore(c, el.children[i] || null);
        c.classList.toggle('is-new', i === order.length - 1);
      });
      el.setAttribute('aria-label', 'Visit order: ' + (order.join(', ') || 'none yet'));
    };
  };

  /* Grid steps (codes strings) -> grid view state. */
  var CODE_STATE = { f: 'frontier', a: 'active', v: 'visited', p: 'path' };
  L.gridState = function (step, o) {
    o = o || {};
    var cells = {}, walls = [], C = step.cols, codes = step.codes;
    for (var k = 0; k < codes.length; k++) {
      var ch = codes[k];
      if (ch === '#') { walls.push([Math.floor(k / C), k % C]); continue; }
      if (ch === '.') continue;
      var cell = { state: CODE_STATE[ch] || 'default' };
      if (o.labels && step.dist && step.dist[k] >= 0) cell.label = step.dist[k];
      cells[Math.floor(k / C) + ',' + (k % C)] = cell;
    }
    var state = { rows: step.rows, cols: C, walls: walls, cells: cells };
    if (o.markers !== false) {
      state.markers = {};
      if (step.start) state.markers.start = { cell: step.start, label: 'S' };
      if (step.goal) state.markers.end = { cell: step.goal, label: 'T' };
    }
    return state;
  };

  /* VDSA.legend with working `color` overrides: VDSA.h applies style objects with Object.assign, which
     silently drops custom properties such as --sw, so set them with setProperty afterwards. */
  L.legend = function (el, items) {
    el = V.$(el);
    V.legend(el, items);
    var sw = el.querySelectorAll('.legend__swatch');
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  };

  /* Legend presets */
  L.LEGEND_TRAVERSAL = [
    { state: 'default', shape: 'outline', label: 'Unseen' },
    { state: 'frontier', label: 'Frontier' },
    { state: 'active', label: 'Current' },
    { state: 'visited', label: 'Visited' },
    { state: 'compare', shape: 'line', label: 'Edge being checked' },
    { state: 'visited', shape: 'line', label: 'Tree edge' }
  ];

  /* ================================================================== hero teaser: a BFS wave on a grid */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var R = 12, C = 16, walls = [];
    for (var r = 1; r <= 6; r++) walls.push(r + ',5');
    for (var c = 7; c <= 13; c++) walls.push('8,' + c);
    for (r = 2; r <= 5; r++) walls.push(r + ',11');
    walls.push('3,12', '3,13', '9,5', '10,5', '1,8', '2,8', '5,14', '6,14', '10,10', '10,11');
    var grid = { rows: R, cols: C, walls: walls };
    var starts = [[5, 2], [10, 13], [1, 14], [6, 8]], lap = 0;
    var view = V.views.grid(stage, { mode: 'path', cellSize: 30, showValues: false, label: 'BFS wave on a grid' });
    function steps() { var st = GS.gridLayers(grid, starts[lap++ % starts.length]); return st; }
    V.teaser(stage, {
      steps: steps(),
      render: function (step, ctx) { view.render(L.gridState(step, { markers: false }), { duration: ctx.duration }); },
      stepMs: 420, holdMs: 1500, regenerate: steps, instantWrap: false
    });
  }

  /* ================================================================== the problem */
  function problemFigure(fig) {
    var stage = fig.querySelector('[data-stage]');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'You' }, { state: 'default', shape: 'outline', label: 'Person' }, { state: 'default', shape: 'line', label: 'Handshake' }]);
    var view = V.views.graph(stage, { label: 'Friendship network', maxHeight: 380, minRadius: 14 });
    var base = { states: { You: 'active' } };
    view.render(L.graphState(L.SOCIAL, base), { duration: 0 });
    L.tagNodes(view, function (id) { return id === 'You' ? 'You' : 'Person ' + id; });
    var res = GS.bfsResult(L.SOCIAL, 'You');
    var far = res.order[res.order.length - 1];
    V.clickQuiz(stage, {
      el: '#quiz-problem',
      id: 'problem-farthest',
      question: 'Click the person who is the most handshakes away from <b>You</b>.',
      answer: far,
      right: 'Right: Hal is ' + res.dist[far] + ' handshakes away (You → Cat → Fay → Gus → Hal), even though he is drawn right next to you. Everyone else is at most 3 away.',
      wrong: 'Not quite. Count handshakes along the lines, not distance on the page. Someone drawn close to You may be far away in the graph.'
    });
    // Reveal: a BFS wave writes each person's distance on them.
    var btn = h('button', { type: 'button', class: 'btn btn--soft btn--sm' }, 'Reveal the handshake counts');
    fig.querySelector('.fig__head').appendChild(btn);
    var timers = [];
    btn.addEventListener('click', function () {
      timers.forEach(clearTimeout); timers = [];
      var maxD = res.dist[far];
      function frame(k, dur) {
        var st = {}, dist = {};
        L.SOCIAL.nodes.forEach(function (n) {
          var d = res.dist[n.id];
          dist[n.id] = d <= k ? d : null;
          st[n.id] = n.id === 'You' ? 'active' : d < k ? 'visited' : d === k ? 'frontier' : 'default';
        });
        view.render(L.graphState(L.SOCIAL, { states: st, dist: dist }, { badge: 'dist' }), { duration: dur });
        L.tagNodes(view, function (id) { return (id === 'You' ? 'You' : 'Person ' + id) + (dist[id] !== null ? ', ' + dist[id] + ' handshakes' : ''); });
      }
      if (V.reducedMotion()) { frame(maxD + 1, 0); return; }
      for (var k = 0; k <= maxD + 1; k++) (function (k) { timers.push(setTimeout(function () { frame(k, 420); }, k * 650)); })(k);
    });
  }

  /* Three places the question hides: maze, web pages, paint bucket (static mini figures). */
  function usesMinis(row) {
    function mini(cap, build) {
      var st = h('div', { class: 'mini__stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: cap })));
      build(st);
    }
    mini('<b>Maze:</b> the fewest moves from S to T.', function (st) {
      var walls = ['0,2', '1,2', '2,2', '4,1', '4,2', '4,3', '4,4', '1,4', '2,4', '2,5', '2,6', '0,8', '1,8', '2,8', '4,6', '5,6', '4,7'];
      var steps = GS.gridBfs({ rows: 6, cols: 10, walls: walls }, [0, 0], [5, 9]);
      V.views.grid(st, { mode: 'path', cellSize: 18, showValues: false, label: 'Maze with the shortest path' }).render(L.gridState(last(steps)), { duration: 0 });
    });
    mini('<b>Web crawler:</b> every page within two clicks.', function (st) {
      var g = graph([['H', 500, 300], ['a', 270, 150], ['b', 730, 150], ['c', 500, 540], ['d', 50, 60], ['e', 50, 330], ['f', 950, 60], ['g', 950, 330], ['h', 760, 560], ['x', 240, 560]],
        [['H', 'a'], ['H', 'b'], ['H', 'c'], ['a', 'd'], ['a', 'e'], ['b', 'f'], ['b', 'g'], ['c', 'h'], ['e', 'x']]);
      var r = GS.bfsResult(g, 'H'), states = {};
      g.nodes.forEach(function (n) { var d = r.dist[n.id]; states[n.id] = n.id === 'H' ? 'active' : d === 1 ? 'frontier' : d === 2 ? 'visited' : 'muted'; });
      V.views.graph(st, { label: 'Pages within two clicks of the home page', maxHeight: 170, nodeRadius: 20, minRadius: 15 }).render(L.graphState(g, { states: states, dist: r.dist }, { badge: 'dist' }), { duration: 0 });
    });
    mini('<b>Paint bucket:</b> which pixels touch the one you clicked.', function (st) {
      var walls = [];
      [[0, 4], [1, 4], [2, 4], [2, 5], [2, 6], [3, 6], [4, 6], [5, 6], [3, 1], [3, 2], [3, 3], [1, 7], [1, 8], [1, 9]].forEach(function (p) { walls.push(p.join(',')); });
      var steps = GS.gridBfs({ rows: 6, cols: 10, walls: walls }, [4, 2], null);
      var state = L.gridState(last(steps), { markers: false });
      Object.keys(state.cells).forEach(function (k) { state.cells[k].state = 'path'; });
      state.markers = [{ id: 'click', kind: 'start', cell: [4, 2], label: '' }];
      V.views.grid(st, { mode: 'path', cellSize: 18, showValues: false, label: 'Flood-filled region' }).render(state, { duration: 0 });
    });
  }

  /* ================================================================== intuition: ripple and thread (custom SVG teasers) */
  function analogyMinis(row) {
    // Ripple
    var W = 260, H = 150, cx = 130, cy = 76;
    var pts = [[40, 30], [70, 110], [95, 60], [160, 40], [190, 110], [220, 70], [120, 125], [60, 70], [205, 25], [145, 95], [100, 20], [235, 120], [30, 125], [175, 70]];
    var svg1 = s('svg', { class: 'bd-mini-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'A ripple spreads from a stone and reaches nearer dots first' });
    var ring = s('circle', { class: 'ripple', cx: cx, cy: cy, r: 0 });
    svg1.appendChild(ring);
    var dots = pts.map(function (p) {
      var c = s('circle', { class: 'dot', cx: p[0], cy: p[1], r: 6 });
      svg1.appendChild(c);
      return { el: c, d: Math.hypot(p[0] - cx, p[1] - cy) };
    });
    svg1.appendChild(s('circle', { class: 'stone', cx: cx, cy: cy, r: 5 }));
    var ringSteps = [];
    for (var k = 0; k <= 8; k++) ringSteps.push({ r: k * 17 });
    var st1 = h('div', { class: 'mini__stage' }, svg1);
    row.appendChild(h('figure', { class: 'mini' }, st1, h('figcaption', { html: '<b>BFS is a ripple:</b> everything at distance 1, then 2, then 3.' })));
    V.teaser(st1, {
      steps: ringSteps, stepMs: 520, holdMs: 1200, instantWrap: true, staticIndex: 4,
      render: function (step, ctx) {
        svg1.style.setProperty('--t', (ctx.duration || 0) + 'ms');
        V.animate(ring, { attr: { r: step.r }, opacity: step.r ? 1 : 0 }, { duration: ctx.duration, ease: 'out' });
        dots.forEach(function (d) {
          d.el.setAttribute('class', 'dot' + (d.d <= step.r - 17 ? ' is-done' : d.d <= step.r ? ' is-lit' : ''));
        });
      }
    });

    // Thread in a cave
    var P = { r: [18, 76], a: [72, 76], b: [120, 36], c: [178, 22], d: [182, 60], e: [124, 118], f: [186, 118], g: [240, 92] };
    var tunnels = [['r', 'a'], ['a', 'b'], ['b', 'c'], ['b', 'd'], ['a', 'e'], ['e', 'f'], ['f', 'g']];
    var seq = [['r'], ['r', 'a'], ['r', 'a', 'b'], ['r', 'a', 'b', 'c'], ['r', 'a', 'b'], ['r', 'a', 'b', 'd'], ['r', 'a', 'b'], ['r', 'a'], ['r', 'a', 'e'], ['r', 'a', 'e', 'f'], ['r', 'a', 'e', 'f', 'g']];
    var svg2 = s('svg', { class: 'bd-mini-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'A thread follows one tunnel to a dead end, winds back to the last fork, and tries the next tunnel' });
    tunnels.forEach(function (t) { svg2.appendChild(s('path', { class: 'tunnel', d: 'M' + P[t[0]].join(' ') + ' L' + P[t[1]].join(' ') })); });
    var dead = {};
    ['c', 'd'].forEach(function (k) { dead[k] = s('circle', { class: 'deadend', cx: P[k][0], cy: P[k][1], r: 0 }); svg2.appendChild(dead[k]); });
    svg2.appendChild(s('text', { class: 'lbl', x: P.g[0] - 4, y: P.g[1] - 12, 'text-anchor': 'middle' }, 'exit'));
    var thread = s('path', { class: 'thread', d: '' });
    var walker = s('circle', { class: 'walker', r: 6, cx: P.r[0], cy: P.r[1] });
    svg2.appendChild(thread); svg2.appendChild(walker);
    var st2 = h('div', { class: 'mini__stage' }, svg2);
    row.appendChild(h('figure', { class: 'mini' }, st2, h('figcaption', { html: '<b>DFS is a thread:</b> go deep, wind back at dead ends, try the next tunnel.' })));
    var cur = { stack: ['r'], tw: null };
    function pathD(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '); }
    V.teaser(st2, {
      steps: seq.map(function (st, i) { return { stack: st, i: i }; }), stepMs: 620, holdMs: 1300, instantWrap: true,
      render: function (step, ctx) {
        var from = cur.stack, to = step.stack;
        if (cur.tw) cur.tw.cancel();
        var deadNow = {};
        seq.slice(0, step.i + 1).forEach(function (sq, j) { if (j && seq[j].length < seq[j - 1].length) deadNow[seq[j - 1][seq[j - 1].length - 1]] = true; });
        Object.keys(dead).forEach(function (k) { V.animate(dead[k], { attr: { r: deadNow[k] ? 5 : 0 } }, { duration: ctx.duration }); });
        var grow = to.length >= from.length;
        var a = P[from[from.length - 1]], b = P[to[to.length - 1]];
        var base = (grow ? to.slice(0, -1) : to).map(function (k) { return P[k]; });
        cur.stack = to;
        cur.tw = V.tween(V.dur(ctx.duration || 0), function (t, e) {
          var x = a[0] + (b[0] - a[0]) * e, y = a[1] + (b[1] - a[1]) * e;
          thread.setAttribute('d', pathD(base.concat([[x, y]])));
          walker.setAttribute('cx', x.toFixed(1)); walker.setAttribute('cy', y.toFixed(1));
        });
        if (!ctx.duration) { thread.setAttribute('d', pathD(to.map(function (k) { return P[k]; }))); walker.setAttribute('cx', b[0]); walker.setAttribute('cy', b[1]); }
      }
    });
  }

  /* ================================================================== race: the wave and the dive */
  function raceFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'Frontier' }, { state: 'active', label: 'Current' }, { state: 'visited', label: 'Visited' },
      { state: 'visited', shape: 'line', label: 'Tree edge' }, { state: 'path', label: 'Route to target' }
    ]);
    var opts = { bounds: { w: 1000, h: 600 }, maxHeight: 290, nodeRadius: 20, minRadius: 12 };
    var gB = V.views.graph(fig.querySelector('[data-stage="bfs"]'), Object.assign({ label: 'BFS on the lesson graph. Click a vertex to make it the target.' }, opts));
    var gD = V.views.graph(fig.querySelector('[data-stage="dfs"]'), Object.assign({ label: 'DFS on the lesson graph. Click a vertex to make it the target.' }, opts));
    var qB = V.views.queue(fig.querySelector('[data-strip="bfs"]'), { cellSize: 40, label: 'BFS queue' });
    var sD = V.views.stack(fig.querySelector('[data-strip="dfs"]'), { orientation: 'horizontal', cellSize: 40, label: 'DFS stack' });
    var target = 'I';

    function edges(n) { return n + ' edge' + (n === 1 ? '' : 's'); }
    function describeB(b) {
      if (b.path) return 'BFS reached ' + target + ' by a ' + (b.path.length - 1) + '-edge route, the shortest possible.';
      var q = b.queue.map(function (x) { return x.v; });
      if (!q.length) return 'BFS has nothing left in its queue.';
      var d0 = b.dist[q[0]];
      return 'BFS has visited ' + b.order.length + ' and is now on distance ' + d0 + ' (queue: ' + q.join(' ') + ').';
    }
    function describeD(d) {
      if (d.path) return 'DFS reached ' + target + ' by a ' + (d.path.length - 1) + '-edge route.';
      if (!d.stack.length) return 'DFS has finished.';
      return 'DFS is ' + (d.stack.length - 1) + ' edge' + (d.stack.length === 2 ? '' : 's') + ' deep on ' + d.stack.join(' → ') + '.';
    }
    function build() {
      var bf = GS.visitFrames(GS.bfs(L.MAIN, 'A', { target: target })).slice(1);
      var df = GS.visitFrames(GS.dfs(L.MAIN, 'A', { target: target }));
      var n = Math.max(bf.length, df.length), steps = [];
      for (var i = 0; i < n; i++) {
        var b = bf[Math.min(i, bf.length - 1)], d = df[Math.min(i, df.length - 1)];
        var cap;
        if (b.path && d.path) cap = '<b>Both reached ' + target + '.</b> BFS: ' + edges(b.path.length - 1) + '. DFS: ' + edges(d.path.length - 1) + '. ' + (b.path.length === d.path.length ? 'This time the routes are equally short, but only BFS guarantees it.' : 'The BFS route is always a shortest one; DFS takes the first route it stumbles on.');
        else if (i === 0) cap = '<b>Visit 1.</b> Both start at A. BFS has already queued A’s neighbours B and C; DFS will dive into B next.';
        else cap = '<b>Visit ' + (i + 1) + '.</b> ' + describeB(b) + ' ' + describeD(d);
        steps.push({ b: Object.assign({}, b, { pulse: null }), d: Object.assign({}, d, { pulse: null }), caption: cap });
      }
      return steps;
    }
    function render(step, ctx) {
      var dur = ctx.duration;
      gB.render(L.graphState(L.MAIN, step.b), { duration: dur });
      gD.render(L.graphState(L.MAIN, step.d), { duration: dur });
      qB.render(L.queueState(step.b), { duration: dur });
      sD.render(L.stackState(step.d), { duration: dur });
    }
    var steps = build();
    function prep(st) { qB.prepare(st.map(function (x) { return L.queueState(x.b); })); sD.prepare(st.map(function (x) { return L.stackState(x.d); })); }
    prep(steps);
    var player = V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1300, label: 'Race controls' });
    function retarget(e) {
      if (!e || e.kind !== 'node' || e.id === 'A' || e.id === target) return;
      target = e.id;
      var st = build();
      qB.reset(); sD.reset(); prep(st);
      player.setSteps(st);
    }
    gB.on('click', retarget); gD.on('click', retarget);
    // only vertices are targets: keep edges out of the tab order
    [gB, gD].forEach(function (g) { V.$$('.vz-hit', g.el).forEach(function (e) { e.removeAttribute('tabindex'); e.setAttribute('aria-hidden', 'true'); e.style.pointerEvents = 'none'; }); });
    var foot = fig.querySelector('.fig__foot');
    if (foot && !/Click any vertex/.test(foot.textContent)) foot.insertBefore(h('span', null, 'Click any vertex to race to it instead. '), foot.firstChild);
  }

  /* ================================================================== three states (mini row) */
  function statesMinis(row) {
    var items = [
      { st: 'default', name: 'unseen', cap: '<b>Unseen:</b> not discovered yet. Also called white.' },
      { st: 'frontier', name: 'frontier', cap: '<b>Frontier:</b> discovered, waiting in the queue or on the stack. Grey.' },
      { st: 'visited', name: 'visited', cap: '<b>Visited:</b> explored; it never enters the frontier again. Black.' }
    ];
    items.forEach(function (it, i) {
      var st = h('div', { class: 'mini__stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: it.cap })));
      var g = graph([['P', 200, 150], ['Q', 470, 70], ['R', 470, 230], ['S', 740, 150]], [['P', 'Q'], ['P', 'R'], ['Q', 'S'], ['R', 'S']]);
      var states = { P: 'default', Q: 'default', R: 'default', S: 'default' };
      if (i >= 1) { states.P = 'visited'; states.Q = 'frontier'; states.R = 'frontier'; }
      if (i === 2) { states.Q = 'visited'; states.S = 'frontier'; }
      var focus = i === 0 ? 'S' : i === 1 ? 'Q' : 'Q';
      V.views.graph(st, { bounds: { x: 130, y: 25, w: 680, h: 250 }, maxHeight: 130, nodeRadius: 26, minRadius: 16, label: it.name + ' example' })
        .render(L.graphState(g, { states: states }, { mapNode: function (n) { if (n.id === focus) n.badge = it.name; } }), { duration: 0 });
    });
  }

  /* ================================================================== frontier: same graph, different container */
  function frontierFigure(fig) {
    var legendEl = fig.querySelector('[data-legend]');
    var stage = fig.querySelector('[data-stage]');
    var box = fig.querySelector('[data-container]');
    var title = fig.querySelector('[data-panel-title]');
    var view = V.views.graph(stage, { label: 'Lesson graph', maxHeight: 340 });
    var qHost = h('div'), sHost = h('div');
    box.appendChild(qHost); box.appendChild(sHost);
    var qv = V.views.queue(qHost, { cellSize: 38, label: 'Queue' });
    var sv = V.views.stack(sHost, { cellSize: 28, cellWidth: 90, label: 'Stack' });
    var chips = L.orderChips(fig.querySelector('[data-order]'));
    var mode = 'queue';
    var sets = {
      queue: GS.bfs(L.MAIN, 'A').filter(function (x) { return ['init', 'dequeue', 'discover', 'done'].indexOf(x.kind) !== -1; }),
      stack: GS.dfs(L.MAIN, 'A').filter(function (x) { return ['enter', 'finish', 'done'].indexOf(x.kind) !== -1; })
    };
    qv.prepare(sets.queue.map(function (x) { return L.queueState(x); }));
    sv.prepare(sets.stack.map(function (x) { return L.stackState(x); }));
    function legend() {
      L.legend(legendEl, [
        { state: 'frontier', label: mode === 'queue' ? 'In the queue' : 'On the stack' }, { state: 'active', label: 'Current' },
        { state: 'visited', label: 'Visited' }, { state: 'visited', shape: 'line', label: 'Tree edge' }
      ]);
    }
    function show() {
      qHost.hidden = mode !== 'queue'; sHost.hidden = mode !== 'stack';
      title.textContent = mode === 'queue' ? 'Frontier: a queue (front on the left)' : 'Frontier: a stack (top at the top)';
      legend();
    }
    function render(step, ctx) {
      view.render(L.graphState(L.MAIN, step), { duration: ctx.duration });
      if (mode === 'queue') qv.render(L.queueState(step), { duration: ctx.duration });
      else sv.render(L.stackState(step), { duration: ctx.duration });
      chips(step.order, ctx.duration);
    }
    show();
    var player = V.player({ root: fig, steps: sets.queue, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1000, label: 'Frontier figure controls' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Frontier container', value: 'queue',
      options: [{ value: 'queue', label: 'Queue → BFS' }, { value: 'stack', label: 'Stack → DFS' }],
      onChange: function (v) { mode = v; show(); player.setSteps(sets[v]); }
    });
  }

  /* ================================================================== BFS layers + parent pointers */
  function layersFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'In the queue' }, { state: 'active', label: 'Current' }, { state: 'visited', label: 'Visited' },
      { state: 'visited', shape: 'line', label: 'Tree edge' }, { state: 'compare', shape: 'dash', label: 'Non-tree edge' }, { state: 'path', label: 'Path via parents' }
    ]);
    var stage = fig.querySelector('[data-stage]');
    var view = V.views.graph(stage, { bounds: { w: 1000, h: 600 }, label: 'BFS distances on the lesson graph', maxHeight: 400 });
    var base = GS.bfs(L.MAIN, 'A').filter(function (x) { return ['init', 'dequeue', 'discover', 'done'].indexOf(x.kind) !== -1; });
    var end = last(base);
    var byLayer = {};
    end.order.forEach(function (id) { (byLayer[end.dist[id]] = byLayer[end.dist[id]] || []).push(id); });
    var layers = Object.keys(byLayer).map(Number).sort(function (a, b) { return a - b; });
    var pos = {};
    layers.forEach(function (d) {
      byLayer[d].forEach(function (id, j, arr) { pos[id] = { x: 100 + d * 200, y: 300 + (j - (arr.length - 1) / 2) * 165 }; });
    });
    var tree = {};
    Object.keys(end.parent).forEach(function (v) { if (end.parent[v]) tree[GS.edgeKey(v, end.parent[v], false)] = true; });
    function extra(o) { return Object.assign({}, end, { pulse: null, edges: Object.assign({}, end.edges), states: Object.assign({}, end.states) }, o); }
    var steps = base.slice();
    steps.push(extra({ kind: 'arrange', layered: true, caption: 'Now slide every vertex into a column by its distance: ' + layers.length + ' layers, from 0 to ' + last(layers) + '. The queue visited them column by column, left to right.' }));
    steps.push(extra({ kind: 'edges', layered: true, dashNonTree: true, caption: 'Look at the edges that are not in the tree (dashed). Each one stays inside a column or joins neighbouring columns. None skips a column: its far end would have been discovered one layer sooner.' }));
    var path = GS.pathTo(end.parent, 'I');
    var arrows = {};
    for (var p = path.length - 1; p >= 0; p--) {
      var st = extra({ kind: 'back', layered: true, dashNonTree: 'quiet', arrows: {} });
      for (var q = path.length - 1; q >= p; q--) {
        st.states[path[q]] = 'path';
        if (q < path.length - 1) { var k = GS.edgeKey(path[q], path[q + 1], false); st.edges[k] = 'path'; arrows[k] = [path[q + 1], path[q]]; }
      }
      st.arrows = Object.assign({}, arrows);
      st.caption = p === path.length - 1
        ? 'To rebuild a route, start at the target <b>I</b> and follow its parent pointer.'
        : p === 0
          ? 'Back at A. Read it forwards: <b>' + path.join(' → ') + '</b>, ' + (path.length - 1) + ' edges, exactly the distance written on I.'
          : '<b>' + path[p + 1] + '</b> was discovered from <b>' + path[p] + '</b>, so its parent pointer leads there.';
      steps.push(st);
    }
    // bands behind the columns
    var bands = s('g', { class: 'bd-bands', opacity: 0, 'aria-hidden': 'true' });
    var defs = view.el.querySelector('defs');
    view.el.insertBefore(bands, defs ? defs.nextSibling : view.el.firstChild);
    var bandEls = layers.map(function (d) {
      var g = s('g', null, s('rect', { rx: 14 }), s('text', null, 'd = ' + d));
      bands.appendChild(g);
      return g;
    });
    function placeBands() {
      var o = view.toScreen(0, 0), k = view.toScreen(200, 0).x - o.x;
      var top = view.toScreen(0, 50).y, bot = view.toScreen(0, 565).y;
      layers.forEach(function (d, i) {
        var cx = view.toScreen(100 + d * 200, 0).x, w = k * 0.8;
        var r = bandEls[i].firstChild, t = bandEls[i].lastChild;
        r.setAttribute('x', (cx - w / 2).toFixed(1)); r.setAttribute('width', w.toFixed(1));
        r.setAttribute('y', (top - 22).toFixed(1)); r.setAttribute('height', (bot - top + 26).toFixed(1));
        t.setAttribute('x', cx.toFixed(1)); t.setAttribute('y', (top - 6).toFixed(1));
      });
    }
    V.onResize(stage, function () { requestAnimationFrame(placeBands); });
    function render(step, ctx) {
      view.render(L.graphState(L.MAIN, step, {
        badge: 'dist', pos: step.layered ? pos : null,
        mapEdge: function (e) {
          var nonTree = !tree[e.id];
          if (step.dashNonTree && nonTree) { e.dashed = true; e.state = step.dashNonTree === true ? 'compare' : 'default'; }
          if (step.arrows && step.arrows[e.id]) { e.from = step.arrows[e.id][0]; e.to = step.arrows[e.id][1]; e.directed = true; }
        }
      }), { duration: ctx.duration });
      placeBands();
      V.animate(bands, { opacity: step.layered ? 1 : 0 }, { duration: ctx.duration });
    }
    V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1100, label: 'BFS layers controls' });
  }

  /* ================================================================== mark on discovery vs dequeue */
  function markFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'Queued' }, { state: 'active', label: 'Current' }, { state: 'visited', label: 'Visited' },
      { state: 'error', label: 'Wasted copy in the queue' }
    ]);
    var names = ['A', 'B', 'C', 'D', 'E'];
    var pts = V.views.graph.layouts.circle(names, { w: 1000, h: 600, pad: 90 });
    var edges = [];
    for (var i = 0; i < 5; i++) for (var j = i + 1; j < 5; j++) edges.push([names[i], names[j]]);
    var K5 = { nodes: names.map(function (n) { return { id: n, x: pts[n].x, y: pts[n].y }; }), edges: edges };
    var view = V.views.graph(fig.querySelector('[data-stage]'), { label: 'Five vertices that all know each other', maxHeight: 300 });
    var qv = V.views.queue(fig.querySelector('[data-container]'), { cellSize: 34, label: 'BFS queue' });
    function stepsFor(mark) {
      return GS.bfs(K5, 'A', { mark: mark }).map(function (x) {
        return Object.assign({}, x, { counters: { entries: x.counters.entries, visited: x.counters.visited, checks: x.counters.checks } });
      });
    }
    var sets = { discover: stepsFor('discover'), dequeue: stepsFor('dequeue') };
    var mode = 'discover';
    function prep() { qv.reset(); qv.prepare(sets[mode].map(function (x) { return L.queueState(x, { copies: true }); })); }
    prep();
    var player = V.player({
      root: fig, steps: sets[mode], caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { entries: 'Queue entries created', visited: 'Vertices visited', checks: 'Edge checks' }, counterStates: { entries: 'error' },
      baseStepMs: 900, label: 'Marking controls',
      render: function (step, ctx) {
        view.render(L.graphState(K5, step), { duration: ctx.duration });
        qv.render(L.queueState(step, { copies: true }), { duration: ctx.duration });
      }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'When to mark a vertex seen', value: 'discover',
      options: [{ value: 'discover', label: 'Mark when added (correct)' }, { value: 'dequeue', label: 'Mark when removed (bug)' }],
      onChange: function (v) { mode = v; prep(); player.setSteps(sets[v]); }
    });
  }

  /* ================================================================== DFS: graph + call stack + timeline */
  function dfsFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'On the stack' }, { state: 'active', label: 'Current call' }, { state: 'visited', label: 'Finished' },
      { state: 'compare', shape: 'line', label: 'Edge being checked' }, { state: 'visited', shape: 'line', label: 'Tree edge' }
    ]);
    var view = V.views.graph(fig.querySelector('[data-stage="graph"]'), { label: 'DFS on the lesson graph', maxHeight: 360 });
    var cs = V.views.callstack(fig.querySelector('[data-stage="stack"]'), { frameWidth: 200, showLocals: false, maxVisible: fig.clientWidth < 640 ? 5 : 9, label: 'DFS call stack' });
    var steps = GS.dfs(L.MAIN, 'A');
    var N = L.MAIN.nodes.length, T = 2 * N;
    function frames(step) {
      return { frames: step.stack.map(function (u) { return { id: 'f' + u, fn: 'visit', args: u }; }) };
    }
    cs.prepare(steps.map(frames));

    // timeline: one bar per vertex from discovery to finish, stacked by depth (a flame chart of the recursion).
    // Laid out in real pixels (viewBox width = rendered width) so the text never scales.
    var tl = fig.querySelector('[data-stage="timeline"]');
    var left = 8, right = 8, rowH = 19, top = 24;
    var TH = top + N * rowH + 28, TW = 720;
    var svg = s('svg', { class: 'bd-tl', role: 'img', 'aria-label': 'DFS timeline: each vertex is a bar from its discovery time to its finish time, one row per depth in the DFS tree' });
    var axis = s('g', { class: 'bd-tl-axis' });
    var title = s('text', { class: 'bd-tl-title', x: left, y: 12, style: 'text-anchor:start' }, 'time →   one row per depth in the DFS tree');
    var base = s('line', { y1: TH - 22, y2: TH - 22 });
    var now = s('line', { class: 'bd-tl-now', y1: top - 4, y2: TH - 22 });
    var ticks = [];
    for (var t = 1; t <= T; t++) { var tk = s('text', { y: TH - 7 }, t); ticks.push(tk); axis.appendChild(tk); }
    axis.appendChild(title); axis.appendChild(base); axis.appendChild(now);
    svg.appendChild(axis);
    var bars = {};
    L.MAIN.nodes.forEach(function (n) {
      var g = s('g', { class: 'bd-tl-bar', opacity: 0 }, s('rect', { x: 0, y: 0, height: rowH - 5, width: 0, rx: 5 }), s('text', { x: 6, y: (rowH - 5) / 2 }, n.id));
      svg.appendChild(g);
      bars[n.id] = g;
    });
    tl.appendChild(svg);
    var parens = h('p', { class: 'bd-parens', 'aria-label': 'Brackets: an opening bracket when a call starts, a closing one when it returns' });
    tl.appendChild(parens);
    var unit = 1, lastStep = null;
    function X(tm) { return left + (tm - 1) * unit; }
    function layout() {
      TW = Math.max(460, Math.round(tl.clientWidth - 32) || 720);
      unit = (TW - left - right) / T;
      svg.setAttribute('viewBox', '0 0 ' + TW + ' ' + TH);
      svg.setAttribute('width', TW); svg.setAttribute('height', TH);
      ticks.forEach(function (tk, i) { tk.setAttribute('x', (X(i + 1) + unit / 2).toFixed(1)); });
      base.setAttribute('x1', left); base.setAttribute('x2', TW - right);
    }
    function depthOf(step, u) { var d = 0, p = step.parent[u]; while (p) { d++; p = step.parent[p]; } return d; }
    function renderTimeline(step, dur) {
      lastStep = step;
      svg.style.setProperty('--t', dur + 'ms');
      V.animate(now, { attr: { x1: X(step.time) + unit, x2: X(step.time) + unit } }, { duration: dur });
      var events = [];
      L.MAIN.nodes.forEach(function (n) {
        var u = n.id, g = bars[u], d = step.disc[u], f = step.fin[u];
        if (d === null) { V.animate(g, { opacity: 0 }, { duration: dur }); return; }
        var y = top + depthOf(step, u) * rowH;
        var end = f === null ? step.time : f;
        var w = Math.max(unit - 3, X(end) + unit - X(d) - 3);
        var cls = f !== null ? 'is-closed' : u === step.current ? 'is-active' : 'is-open';
        g.setAttribute('class', 'bd-tl-bar ' + cls);
        V.place(g.firstChild, { attr: { x: X(d) + 1.5, y: y } });
        g.lastChild.setAttribute('x', (X(d) + 7).toFixed(1)); g.lastChild.setAttribute('y', y + (rowH - 5) / 2);
        V.animate(g.firstChild, { attr: { width: w } }, { duration: dur, ease: 'out' });
        V.animate(g, { opacity: 1 }, { duration: dur });
        events.push([d, '(' + u]);
        if (f !== null) events.push([f, u + ')']);
      });
      events.sort(function (a, b) { return a[0] - b[0]; });
      V.clear(parens);
      parens.style.setProperty('--t', dur + 'ms');
      events.forEach(function (ev, i) {
        parens.appendChild(h('span', { class: ev[0] === step.time ? 'is-new' : '' }, ev[1]));
        if (i < events.length - 1) parens.appendChild(document.createTextNode(' '));
      });
    }
    layout();
    V.onResize(tl, function () { var old = TW; layout(); if (TW !== old && lastStep) renderTimeline(lastStep, 0); });
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 950, label: 'DFS controls',
      render: function (step, ctx) {
        view.render(L.graphState(L.MAIN, step, { sub: 'times' }), { duration: ctx.duration });
        cs.render(frames(step), { duration: ctx.duration });
        renderTimeline(step, ctx.duration);
      }
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    heroTeaser();
    L.lazy('#fig-problem', problemFigure);
    L.lazy('#mini-uses', usesMinis);
    L.lazy('#mini-analogy', analogyMinis);
    L.lazy('#fig-race', raceFigure);
    L.lazy('#mini-states', statesMinis);
    L.lazy('#fig-frontier', frontierFigure);
    L.lazy('#fig-layers', layersFigure);
    L.lazy('#fig-mark', markFigure);
    L.lazy('#fig-dfs', dfsFigure);
  });
}());
