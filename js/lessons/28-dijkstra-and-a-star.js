/* Lesson 28 · Dijkstra & A* — shared helpers and the figures from the hero to the fuse analogy.
   Part 2 (relaxation, cut, hand run, lazy deletion): js/lessons/28-dijkstra-and-a-star-figs.js
   Part 3 (graph lab, flowchart, negative edge): js/lessons/28-dijkstra-and-a-star-labs.js
   Part 4 (A*: f = g + h, grid lab, heuristic explorer): js/lessons/28-dijkstra-and-a-star-grid.js
   Part 5 (decision tree, cost charts, variations, checks, summary): js/lessons/28-dijkstra-and-a-star-more.js
   Step generators: js/algos/28-dijkstra-and-a-star.js (VDSA.algos.shortestPaths). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var SP = V.algos.shortestPaths;
  var L = V.L28 = V.L28 || {};

  /* ================================================================== data */
  /* graph([[id, x, y, label?]], [[a, b, w]], directed) in the 1000 × 600 logical box */
  L.graph = function (nodes, edges, directed) {
    return { nodes: nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2], label: n[3] }; }), edges: edges, directed: !!directed };
  };
  /* The lesson map. From S: B 2, A 5 (through B), C 6, D 8, T 11. */
  L.MAP = L.graph(
    [['S', 90, 300], ['A', 330, 120], ['B', 310, 480], ['C', 610, 120], ['D', 650, 480], ['T', 910, 300]],
    [['S', 'A', 7], ['S', 'B', 2], ['B', 'A', 3], ['A', 'C', 1], ['B', 'D', 8], ['C', 'D', 2], ['C', 'T', 6], ['D', 'T', 3]]);
  L.WORLD = L.graph(
    [['A', 80, 300], ['B', 250, 120], ['C', 250, 480], ['D', 460, 300], ['E', 480, 80], ['F', 480, 520], ['G', 690, 190], ['H', 690, 410], ['I', 890, 80], ['J', 900, 300], ['K', 890, 520]],
    [['A', 'B', 4], ['A', 'C', 3], ['B', 'D', 5], ['C', 'D', 4], ['B', 'E', 6], ['C', 'F', 5], ['D', 'G', 6], ['D', 'H', 4], ['E', 'G', 3], ['F', 'H', 4], ['G', 'I', 4], ['G', 'J', 7], ['H', 'J', 3], ['H', 'K', 5], ['I', 'J', 2], ['J', 'K', 4]]);
  L.ROAD = L.graph(
    [['H', 70, 300], ['A', 290, 110], ['B', 290, 490], ['C', 570, 110], ['D', 570, 300], ['E', 570, 490], ['T', 900, 300]],
    [['H', 'A', 2], ['A', 'C', 2], ['C', 'T', 3], ['H', 'D', 9], ['D', 'T', 8], ['H', 'B', 4], ['B', 'E', 3], ['E', 'T', 4], ['A', 'D', 5], ['B', 'D', 5]]);

  function last(a) { return a[a.length - 1]; }
  L.last = last;

  /* ================================================================== lazy init */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 28] figure failed', el.id, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };

  /* ================================================================== legends */
  L.legend = function (el, items) {
    el = V.$(el);
    V.legend(el, items);
    var sw = el.querySelectorAll('.legend__swatch');
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  };
  L.LEGEND_DIJKSTRA = [
    { state: 'default', shape: 'outline', label: 'Not reached (∞)' },
    { state: 'frontier', label: 'Tentative distance' },
    { state: 'active', label: 'Just settled' },
    { state: 'done', label: 'Settled (final)' },
    { state: 'compare', shape: 'line', label: 'Edge being relaxed' },
    { state: 'frontier', shape: 'line', label: 'Best route so far' },
    { state: 'done', shape: 'line', label: 'Shortest-path tree' }
  ];

  /* ================================================================== graph snapshots */
  function fmtDist(d) { return d === null || d === undefined ? '∞' : d; }
  L.fmtDist = fmtDist;
  /* graphState(graph, step, opts) -> graph view state.
     Distance badges (∞ before a vertex is reached), "via X" parent labels, the relaxed edge pulsing.
     opts.badge / opts.sub: false to hide; opts.mapNode / opts.mapEdge tweak a node or edge. */
  L.graphState = function (g, step, o) {
    o = o || {};
    var directed = !!g.directed;
    var nodes = g.nodes.map(function (n) {
      var node = { id: n.id, x: n.x, y: n.y, state: step && step.states ? (step.states[n.id] || 'default') : 'default' };
      if (n.label) node.label = n.label;
      if (step && step.dist && o.badge !== false) node.badge = fmtDist(step.dist[n.id]);
      if (step && step.parent && step.parent[n.id] && o.sub !== false) node.sub = 'via ' + step.parent[n.id];
      if (step && step.truth && step.wrong && step.wrong.indexOf(n.id) >= 0) { node.sub = 'really ' + step.truth[n.id]; node.badgeState = 'error'; }
      if (o.mapNode) o.mapNode(node, step);
      return node;
    });
    var edges = g.edges.map(function (e) {
      var a = e[0], b = e[1], key = SP.edgeKey(a, b, directed);
      var edge = { id: key, from: a, to: b, directed: directed, weight: e[2], state: (step && step.edges && step.edges[key]) || 'default' };
      if (step && step.pulse && SP.edgeKey(step.pulse.from, step.pulse.to, directed) === key) {
        edge.from = step.pulse.from; edge.to = step.pulse.to;
        edge.state = step.pulse.result === 'relax' ? 'active' : step.pulse.result === 'ignore' ? 'error' : 'compare';
        edge.pulse = true;
      }
      if (o.mapEdge) o.mapEdge(edge, step);
      return edge;
    });
    return { nodes: nodes, edges: edges };
  };

  /* data-id / data-label on graph view nodes so VDSA.clickQuiz can target them. */
  L.tagNodes = function (view, describe) {
    V.$$('.vz-gnode', view.el).forEach(function (g) {
      var t = g.querySelector('.vz-value');
      var id = t ? t.textContent : '';
      if (!id) return;
      g.setAttribute('data-id', id);
      g.setAttribute('data-label', describe ? describe(id) : 'Vertex ' + id);
    });
  };

  /* ================================================================== the priority-queue panel */
  /* pqPanel(host) -> {render(step, ms), el}. Entries are keyed by id: chips slide (FLIP) when the order changes,
     the popped entry glides into the "popped" slot, and stale entries turn grey with a strike-through. */
  L.pqPanel = function (host) {
    host = V.$(host);
    var hint = h('span', { class: 'dj-pq__hint' }, 'nothing popped yet');
    var slot = h('div', { class: 'dj-pq__slot' }, hint);
    var box = h('div', { class: 'dj-pq__chips', role: 'list' });
    var count = h('span', { class: 'dj-pq__count' });
    var root = h('div', { class: 'dj-pq', role: 'group' },
      h('div', { class: 'dj-pq__pop' }, h('span', { class: 'dj-pq__label' }, 'Popped'), slot),
      h('div', { class: 'dj-pq__q' }, h('span', { class: 'dj-pq__label' }, 'Priority queue, smallest first', count), box));
    host.appendChild(root);
    var chips = {};
    function makeChip() {
      return h('div', { class: 'dj-chip', role: 'listitem' }, h('b', { class: 'dj-chip__d' }), h('span', { class: 'dj-chip__v' }));
    }
    function paint(c, e, popped) {
      c.querySelector('.dj-chip__d').textContent = e.d;
      c.querySelector('.dj-chip__v').textContent = e.v;
      c.classList.toggle('is-stale', !!e.stale);
      c.classList.toggle('is-popped', !!popped);
      c.setAttribute('aria-label', '(' + e.d + ', ' + e.v + ')' + (e.stale ? ', stale' : ''));
      c.title = e.stale ? 'Stale: ' + e.v + ' already has a shorter distance' : '';
    }
    function render(step, ms) {
      var pq = step.pq || [], pop = step.popped || null;
      var want = {};
      pq.forEach(function (e) { want[e.id] = e; });
      if (pop) want[pop.id] = pop;
      var old = {};
      Object.keys(chips).forEach(function (id) { old[id] = chips[id].getBoundingClientRect(); });
      Object.keys(chips).forEach(function (id) { if (!want[id]) { chips[id].remove(); delete chips[id]; } });
      var fresh = {};
      Object.keys(want).forEach(function (id) {
        if (!chips[id]) { chips[id] = makeChip(); fresh[id] = true; }
        paint(chips[id], want[id], pop && pop.id === id);
      });
      pq.forEach(function (e, i) {
        var c = chips[e.id];
        c.classList.toggle('is-front', i === 0);
        if (box.children[i] !== c) box.insertBefore(c, box.children[i] || null);
      });
      if (pop) {
        var pc = chips[pop.id];
        pc.classList.remove('is-front');
        if (pc.parentNode !== slot) slot.appendChild(pc);
      }
      hint.hidden = !!pop;
      count.textContent = pq.length ? ' · ' + pq.length + (pq.length === 1 ? ' entry' : ' entries') : '';
      root.setAttribute('aria-label', 'Priority queue: ' + (pq.map(function (e) { return '(' + e.d + ', ' + e.v + ')' + (e.stale ? ' stale' : ''); }).join(', ') || 'empty'));
      if (ms > 0 && !V.reducedMotion() && Element.prototype.animate) {
        Object.keys(chips).forEach(function (id) {
          var c = chips[id];
          if (fresh[id]) { c.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: ms, easing: 'cubic-bezier(.2,.8,.2,1)' }); return; }
          var r0 = old[id], r1 = c.getBoundingClientRect();
          if (!r0) return;
          var dx = r0.left - r1.left, dy = r0.top - r1.top;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: ms, easing: 'cubic-bezier(.2,.7,.2,1)' });
        });
      }
    }
    return { render: render, el: root };
  };

  /* ================================================================== grid helpers */
  /* Grid steps (codes strings) -> grid view state.
     opts.heat: expanded cells are drawn by the heat overlay, so the view shows them as plain cells.
     opts.markers: false hides S and T. */
  var CODE_STATE = { f: 'frontier', a: 'active', v: 'visited', p: 'path' };
  L.gridState = function (step, o) {
    o = o || {};
    var cells = {}, walls = [], C = step.cols, codes = step.codes;
    for (var k = 0; k < codes.length; k++) {
      var ch = codes[k];
      if (ch === '#') { walls.push([Math.floor(k / C), k % C]); continue; }
      if (ch === '.') continue;
      if (ch === 'v' && o.heat) continue;
      cells[Math.floor(k / C) + ',' + (k % C)] = { state: CODE_STATE[ch] || 'default' };
    }
    var state = { rows: step.rows, cols: C, walls: walls, cells: cells };
    if (o.markers !== false) {
      state.markers = {};
      if (step.start) state.markers.start = { cell: step.start, label: 'S' };
      if (step.goal) state.markers.end = { cell: step.goal, label: 'T' };
    }
    return state;
  };

  /* gridOverlay(view) -> {draw(step, {heat}), destroy()}.
     Draws two things the grid view has no state for, in an SVG layer between the cells and their text:
     the heat of expanded cells (cost from the start, one purple ramp) and hatching on mud cells.
     Both come from tokens, so both themes work; the layer ignores the pointer. */
  var overlayId = 0;
  L.gridOverlay = function (view) {
    var layer = view.ctx.layers.texts;
    var pid = 'dj-hatch-' + (++overlayId);
    var pattern = s('pattern', { id: pid, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, s('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'dj-hatch__line' }));
    var heatG = s('g', { class: 'dj-heat' }), mudG = s('g', { class: 'dj-mud' });
    var g = s('g', { class: 'dj-overlay', 'pointer-events': 'none', 'aria-hidden': 'true' }, s('defs', {}, pattern), heatG, mudG);
    layer.parentNode.insertBefore(g, layer);
    var heat = {}, mud = {}, lastStep = null, lastOpts = null, geomKey = '', mudKey = '';
    function rectOf(r, c) { return view.cellRect(r, c); }
    function draw(step, o) {
      lastStep = step; lastOpts = o || {};
      if (!step) return;
      var R = step.rows, C = step.cols, r0 = rectOf(0, 0);
      if (!r0) return;
      var cs = r0.w, gk = [cs.toFixed(2), r0.x.toFixed(1), r0.y.toFixed(1), R, C].join('|');
      var geomChanged = gk !== geomKey;
      geomKey = gk;
      var rx = Math.max(1, cs * 0.14).toFixed(1);
      pattern.setAttribute('width', Math.max(3, cs / 3.2).toFixed(1));
      pattern.setAttribute('height', Math.max(3, cs / 3.2).toFixed(1));
      pattern.firstChild.setAttribute('y2', Math.max(3, cs / 3.2).toFixed(1));
      pattern.firstChild.style.strokeWidth = Math.max(1, cs / 9).toFixed(1);
      // heat
      var want = {}, codes = step.codes, maxG = Math.max(1, step.maxG || 1);
      if (lastOpts.heat) {
        for (var k = 0; k < codes.length; k++) {
          if (codes[k] !== 'v') continue;
          var t = Math.max(0, Math.min(1, step.closedG[k] / maxG));
          want[k] = 16 + Math.round(t * 17) * 4;   // 16 … 84 percent, in steps of 4
        }
      }
      Object.keys(heat).forEach(function (k) { if (want[k] === undefined) { heat[k].el.remove(); delete heat[k]; } });
      Object.keys(want).forEach(function (k) {
        var rec = heat[k];
        var rr = rectOf(Math.floor(k / C), k % C);
        if (!rr) return;
        if (!rec) { rec = heat[k] = { el: s('rect', { class: 'dj-heat__cell' }), p: -1 }; heatG.appendChild(rec.el); geomChanged = true; rec.geom = ''; }
        if (rec.p !== want[k]) { rec.el.style.fill = 'color-mix(in srgb, var(--st-visited) ' + want[k] + '%, var(--bg-sunken))'; rec.p = want[k]; }
        var gg = rr.x.toFixed(1) + ',' + rr.y.toFixed(1) + ',' + rr.w.toFixed(1);
        if (rec.geom !== gg) { rec.geom = gg; var pad = cs > 6 ? 0.5 : 0; rec.el.setAttribute('x', (rr.x + pad).toFixed(1)); rec.el.setAttribute('y', (rr.y + pad).toFixed(1)); rec.el.setAttribute('width', (rr.w - 2 * pad).toFixed(1)); rec.el.setAttribute('height', (rr.h - 2 * pad).toFixed(1)); rec.el.setAttribute('rx', rx); }
      });
      // mud
      var mk = (step.mud || '') + '|' + gk;
      if (mk !== mudKey) {
        mudKey = mk;
        Object.keys(mud).forEach(function (k) { mud[k].remove(); delete mud[k]; });
        var mstr = step.mud || '';
        for (var m = 0; m < mstr.length; m++) {
          if (mstr[m] !== '1' || codes[m] === '#') continue;
          var mr = rectOf(Math.floor(m / C), m % C);
          if (!mr) continue;
          mud[m] = s('rect', { class: 'dj-mud__cell', x: mr.x.toFixed(1), y: mr.y.toFixed(1), width: mr.w.toFixed(1), height: mr.h.toFixed(1), rx: rx, style: 'fill:url(#' + pid + ')' });
          mudG.appendChild(mud[m]);
        }
      }
    }
    return { draw: draw, redraw: function () { geomKey = ''; mudKey = ''; draw(lastStep, lastOpts); }, destroy: function () { g.remove(); } };
  };

  /* ================================================================== hero teaser: distances spreading over a map */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var view = V.views.graph(stage, { bounds: { w: 1000, h: 600 }, maxHeight: 330, nodeRadius: 21, minRadius: 12, label: 'Dijkstra on a map of towns' });
    var laps = [['A', 'K'], ['K', 'A'], ['E', 'F'], ['I', 'C']], lap = 0;
    function steps() {
      var p = laps[lap++ % laps.length];
      return SP.dijkstra(L.WORLD, p[0], { target: p[1] }).filter(function (st) { return st.kind === 'init' || st.kind === 'settle' || st.kind === 'relax' || st.kind === 'path'; });
    }
    V.teaser(stage, {
      steps: steps(),
      render: function (step, ctx) { view.render(L.graphState(L.WORLD, step, { sub: false }), { duration: ctx.duration }); },
      stepMs: 520, holdMs: 2000, regenerate: steps, instantWrap: false
    });
  }

  /* ================================================================== the problem: fewest roads vs least time */
  function hopsFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Town' },
      { state: 'compare', shape: 'line', label: 'Route with the fewest roads' },
      { state: 'done', shape: 'line', label: 'Route with the least time' }
    ]);
    var g = L.ROAD;
    var bfsRes = SP.fewestEdges(g, 'H', 'T');
    var dj = SP.dijkstraResult(g, 'H');
    var djPath = SP.pathTo(dj.parent, 'T');
    var vb = V.views.graph(fig.querySelector('[data-stage="bfs"]'), { bounds: { w: 1000, h: 600 }, maxHeight: 300, nodeRadius: 22, minRadius: 14, label: 'Map with the fewest-roads route' });
    var vd = V.views.graph(fig.querySelector('[data-stage="dj"]'), { bounds: { w: 1000, h: 600 }, maxHeight: 300, nodeRadius: 22, minRadius: 14, label: 'Map with the least-time route' });
    var tb = fig.querySelector('[data-tally="bfs"]'), td = fig.querySelector('[data-tally="dj"]');
    function state(path, edgeState, nodeState) {
      var st = { states: {}, edges: {} };
      (path || []).forEach(function (id, i) {
        st.states[id] = nodeState;
        if (i + 1 < path.length) st.edges[SP.edgeKey(id, path[i + 1], false)] = edgeState;
      });
      return st;
    }
    var steps = [
      { caption: 'A map from <b>H</b>ome to the <b>T</b> Café. Each number is the minutes to drive that road.', bfs: null, dj: null },
      { caption: 'BFS counts roads. Home to Café takes at least <b>' + bfsRes.edges + '</b> roads, and only one route has that few: H → D → T. Nothing in BFS looks at the minutes.', bfs: 'compare', dj: null },
      { caption: 'Dijkstra adds up minutes. Its best route uses <b>' + (djPath.length - 1) + '</b> roads, one more, but costs only <b>' + dj.dist.T + '</b> minutes.', bfs: 'compare', dj: 'done' },
      { caption: 'So the route with the fewest roads takes <b>' + (bfsRes.cost - dj.dist.T) + ' minutes longer</b>. BFS answers “fewest edges”, which is a different question from “least weight”.', bfs: 'error', dj: 'done' }
    ];
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1600, label: 'Fewest roads versus least time',
      render: function (step, ctx) {
        var sb = step.bfs ? state(bfsRes.path, step.bfs === 'error' ? 'error' : 'compare', step.bfs === 'error' ? 'error' : 'compare') : { states: {}, edges: {} };
        var sd = step.dj ? state(djPath, 'done', 'done') : { states: {}, edges: {} };
        sb.states.H = sb.states.H || 'active'; sd.states.H = sd.states.H || 'active';
        vb.render(L.graphState(g, sb, { badge: false, sub: false }), { duration: ctx.duration });
        vd.render(L.graphState(g, sd, { badge: false, sub: false }), { duration: ctx.duration });
        tb.innerHTML = step.bfs ? '<b>' + bfsRes.edges + ' roads</b> · <b>' + bfsRes.cost + ' min</b>' : '&nbsp;';
        td.innerHTML = step.dj ? '<b>' + (djPath.length - 1) + ' roads</b> · <b>' + dj.dist.T + ' min</b>' : '&nbsp;';
        tb.classList.toggle('is-bad', step.bfs === 'error');
        td.classList.toggle('is-good', !!step.dj);
      }
    });
    V.quiz('#quiz-hops', {
      id: 'quiz-hops',
      question: 'BFS returned H → D → T. Under which condition would that be the cheapest route as well?',
      options: ['When every road has the same weight', 'When the graph has no cycles', 'When the start and target are close together', 'Never: BFS cannot find cheapest routes'],
      answer: 0,
      explain: [
        'With equal weights, the total is just (weight × number of roads), so the fewest roads is also the least total. This is why BFS is the unweighted special case of Dijkstra.',
        'Cycles are not the issue. Even in a tree, two routes with different weights can have different numbers of roads.',
        'Distance on the page or the number of roads does not decide the winner: the weights do.',
        'It can, when weights are all equal. It fails only when weights differ.'
      ]
    });
  }

  /* ================================================================== uses (three static minis) */
  function usesMinis(row) {
    function mini(cap, build) {
      var st = h('div', { class: 'mini__stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: cap })));
      build(st);
    }
    mini('<b>Driving:</b> the fastest route, in minutes.', function (st) {
      var r = SP.dijkstra(L.WORLD, 'A', { target: 'K' });
      V.views.graph(st, { bounds: { w: 1000, h: 600 }, maxHeight: 190, nodeRadius: 24, minRadius: 16, label: 'Fastest route on a road map' })
        .render(L.graphState(L.WORLD, last(r), { badge: false, sub: false }), { duration: 0 });
    });
    mini('<b>Networks:</b> the lowest-delay route for a packet.', function (st) {
      var net = L.graph([['R1', 80, 300], ['R2', 300, 130], ['R3', 300, 470], ['R4', 560, 300], ['R5', 810, 150], ['R6', 900, 430]],
        [['R1', 'R2', 12], ['R1', 'R3', 5], ['R2', 'R4', 4], ['R3', 'R4', 20], ['R4', 'R5', 6], ['R4', 'R6', 9], ['R5', 'R6', 3]]);
      var r = SP.dijkstra(net, 'R1', { target: 'R6' });
      V.views.graph(st, { bounds: { w: 1000, h: 600 }, maxHeight: 190, nodeRadius: 28, minRadius: 16, label: 'Lowest-delay route between routers' })
        .render(L.graphState(net, last(r), { badge: false, sub: false }), { duration: 0 });
    });
    mini('<b>Games:</b> the cheapest path around walls and swamp.', function (st) {
      var walls = ['1,4', '2,4', '3,4', '4,4', '5,4', '2,8', '3,8', '4,8', '5,8', '6,8', '0,8'];
      var mud = ['3,5', '3,6', '3,7', '4,5', '4,6', '4,7', '5,5', '5,6', '5,7'];
      var steps = SP.gridAStar({ rows: 8, cols: 13, walls: walls, mud: mud }, [4, 1], [4, 11]);
      var view = V.views.grid(st, { mode: 'path', cellSize: 20, showValues: false, label: 'A* path around walls and mud' });
      var ov = L.gridOverlay(view);
      var f = last(steps);
      view.render(L.gridState(f, { heat: true }), { duration: 0 });
      ov.draw(f, { heat: true });
      V.onResize(st, function () { requestAnimationFrame(function () { ov.redraw(); }); });
    });
  }

  /* ================================================================== the fuse analogy */
  function fuseFigure(fig) {
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', shape: 'outline', label: 'Not on fire yet' },
      { state: 'done', label: 'On fire (distance = time it caught)' },
      { state: 'active', shape: 'line', label: 'Fuse burning now' },
      { state: 'done', shape: 'line', label: 'First flame came this way' },
      { state: 'muted', shape: 'line', label: 'Burnt out, not needed' }
    ]);
    var g = L.MAP;
    var res = SP.dijkstraResult(g, 'S');
    var dist = res.dist, maxT = 0;
    Object.keys(dist).forEach(function (id) { if (dist[id] > maxT) maxT = dist[id]; });
    var tree = {};
    Object.keys(res.parent).forEach(function (id) { if (res.parent[id]) tree[SP.edgeKey(res.parent[id], id, false)] = true; });
    var steps = [];
    for (var t = 0; t <= maxT; t++) {
      var lit = g.nodes.filter(function (n) { return dist[n.id] === t; }).map(function (n) { return n.id; });
      var burning = g.edges.filter(function (e) {
        var ts = Math.min(dist[e[0]], dist[e[1]]), tb = (dist[e[0]] + dist[e[1]] + e[2]) / 2;
        return ts <= t && t < tb;
      });
      var cap;
      if (t === 0) cap = '<b>t = 0.</b> The fire starts at <b>S</b>. Every fuse out of S starts to burn.';
      else if (lit.length) cap = '<b>t = ' + t + '.</b> The first flame reaches <b>' + lit.join(' and ') + '</b>: its distance is ' + t + '. ' + (t === maxT ? 'Everything is burning; the green fuses form the shortest-path tree.' : 'New fuses start to burn from there.');
      else cap = '<b>t = ' + t + '.</b> Nothing new catches fire; the flames are still travelling along ' + burning.map(function (e) { return e[0] + '–' + e[1]; }).join(', ') + '.';
      steps.push({ t: t, caption: cap });
    }
    var view = V.views.graph(fig.querySelector('[data-stage]'), { bounds: { w: 1000, h: 600 }, maxHeight: 380, label: 'A fire spreading along weighted fuses' });
    V.player({
      root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 900, label: 'Fuse animation controls',
      render: function (step, ctx) {
        var t = step.t, states = {}, edges = {}, d = {};
        g.nodes.forEach(function (n) {
          var on = dist[n.id] <= t;
          states[n.id] = on ? (dist[n.id] === t && t > 0 ? 'active' : 'done') : 'default';
          d[n.id] = on ? dist[n.id] : null;
        });
        g.edges.forEach(function (e) {
          var k = SP.edgeKey(e[0], e[1], false);
          var ts = Math.min(dist[e[0]], dist[e[1]]), tb = (dist[e[0]] + dist[e[1]] + e[2]) / 2;
          if (t < ts) return;
          if (t < tb) edges[k] = 'active';
          else edges[k] = tree[k] ? 'done' : 'muted';
        });
        view.render(L.graphState(g, { states: states, edges: edges, dist: d }, { sub: false }), { duration: ctx.duration });
      }
    });
  }

  V.ready(function () {
    heroTeaser();
    L.lazy('#fig-hops', hopsFigure);
    L.lazy('#mini-uses', usesMinis);
    L.lazy('#fig-fuse', fuseFigure);
    // checks that live in lazily built figures: register them now so the page score total is stable
    ['quiz-hops', 'quiz-relax', 'dj-relax-predict', 'dj-hand-next', 'dj-lab-next', 'dj-lab-relax', 'dj-neg-ignore', 'quiz-fgh', 'quiz-admissible', 'quiz-next', 'quiz-pq-size', 'quiz-guarantee', 'quiz-negfix'].forEach(function (id) { if (V.quizScore && V.quizScore.register) V.quizScore.register(id); });
  });
}());
