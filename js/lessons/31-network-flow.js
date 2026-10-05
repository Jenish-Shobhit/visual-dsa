/* Lesson 31 · Max flow & min cut — shared helpers, data and the figures from the hero to the bottleneck.
   Part 2 (greedy trap, residual graph, min cut): js/lessons/31-network-flow-figs.js
   Part 3 (the max-flow lab, flowchart, staircase chart): js/lessons/31-network-flow-lab.js
   Part 4 (bipartite matching lab): js/lessons/31-network-flow-match.js
   Part 5 (cost charts, race, patterns, checks, summary): js/lessons/31-network-flow-more.js
   Step generators: js/algos/31-network-flow.js (VDSA.algos.networkFlow). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var NF = V.algos.networkFlow;
  var L = V.L31 = V.L31 || {};

  /* ================================================================== data */
  /* A network from text, with logical positions in the graph view's 1000 x 600 box. */
  function make(text, pos) {
    var net = NF.parseNetwork(text).values;
    net.nodes = net.nodes.map(function (id) { return { id: id, x: pos[id][0], y: pos[id][1] }; });
    return net;
  }
  L.make = make;
  /* The lesson network. Both ends could move 14 units, but the middle wall lets 12 through:
     Edmonds-Karp needs 4 augmentations and the last one runs backward along a→c. */
  L.MAIN = make('s-a:7, s-b:7, a-c:7, a-d:1, b-c:3, b-d:3, c-t:8, d-t:7',
    { s: [90, 300], a: [330, 105], b: [330, 495], c: [650, 190], d: [650, 410], t: [915, 300] });
  /* The smallest network where a greedy first path blocks the optimum (greedy 3, best 5). */
  L.DIAMOND = make('s-a:3, s-b:2, a-b:5, a-t:2, b-t:3',
    { s: [90, 300], a: [450, 110], b: [450, 490], t: [915, 300] });

  L.norm = function (net) { return net._N || (net._N = NF.normalize(net)); };
  L.last = function (a) { return a[a.length - 1]; };
  L.raw = function (x) { return V.vars.raw(String(x)); };

  /* ================================================================== lazy init */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 31] figure failed', el.id, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };

  /* VDSA.legend with working `color` overrides (custom properties are dropped by VDSA.h style objects). */
  L.legend = function (el, items) {
    el = V.$(el);
    V.legend(el, items);
    var sw = el.querySelectorAll('.legend__swatch');
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  };
  L.LEG = {
    empty: { state: 'default', shape: 'line', label: 'Empty pipe' },
    flow: { state: 'active', shape: 'line', label: 'Carries flow' },
    full: { state: 'done', shape: 'line', label: 'Full pipe' },
    path: { state: 'path', shape: 'line', label: 'Augmenting path' },
    bottleneck: { state: 'compare', shape: 'line', label: 'Bottleneck' },
    reverse: { state: 'pivot', shape: 'line', label: 'Reverse hop (undo)' },
    cut: { state: 'error', shape: 'line', label: 'Cut edge' },
    queued: { state: 'frontier', label: 'In the queue' },
    visited: { state: 'visited', label: 'Searched' },
    current: { state: 'active', label: 'Current' },
    side: { state: 'frontier', label: 'Source side S' },
    dashed: { state: 'default', shape: 'dash', label: 'Reverse arc: flow you can take back' }
  };

  /* ================================================================== step -> graph view state */
  /* flowState(net, step, {residual, levels, subs, pos}) -> graph view snapshot.
     Flow view: every edge is a pipe "flow/capacity". Residual view: one arc per ordered pair with room > 0,
     labelled with that room; dashed when all of it is reverse room (flow you can take back). */
  L.flowState = function (net, step, o) {
    o = o || {};
    var N = L.norm(net), fl = step && step.fl ? step.fl : {};
    var res = !!o.residual, mark = {}, found = {}, bott = null, cutSet = {};
    function key(a) { return res ? a.from + '-' + a.to : a.edge; }
    if (step && step.path) {
      step.path.forEach(function (a, i) {
        mark[key(a)] = a.dir;
        if (i === step.bottleArc && step.kind === 'bottleneck') bott = key(a);
      });
    }
    if (step && step.found) step.found.forEach(function (a) { found[key(a)] = a.dir; });
    if (step && step.cut) step.cut.edges.forEach(function (id) { cutSet[id] = true; });
    var nodes = N.ids.map(function (id) {
      var p = (o.pos && o.pos[id]) || N.positions[id] || { x: 500, y: 300 };
      var st = step && step.states ? step.states[id] || 'default' : 'default';
      if (st === 'default' && (id === N.source || id === N.sink)) st = 'key';
      var node = { id: id, x: p.x, y: p.y, state: st };
      if (N.label[id] !== undefined) node.label = N.label[id];
      if (o.levels && step && step.level && step.level[id] !== undefined) node.badge = step.level[id];
      if (o.subs && id === N.source) node.sub = 'source';
      if (o.subs && id === N.sink) node.sub = 'sink';
      return node;
    });
    var edges;
    if (!res) {
      edges = N.edges.map(function (e) {
        var f = fl[e.id] || 0, m = mark[e.id], fm = found[e.id];
        var edge = { id: e.id, from: e.from, to: e.to, directed: true, flow: f, capacity: e.cap, state: f === 0 ? 'default' : f >= e.cap ? 'done' : 'active' };
        if (cutSet[e.id]) edge.state = 'error';
        if (fm) edge.state = fm === 'back' ? 'pivot' : 'frontier';
        if (m) edge.state = m === 'back' ? 'pivot' : 'path';
        if (bott === e.id) edge.state = 'compare';
        if (m === 'fwd' && step.kind === 'push') edge.pulse = true;
        return edge;
      });
    } else {
      edges = NF.residual(N, fl).map(function (r) {
        var k = r.from + '-' + r.to, m = mark[k], fm = found[k];
        var edge = { id: k, from: r.from, to: r.to, directed: true, label: String(r.res), state: 'default', dashed: r.reverseOnly };
        if (fm) edge.state = fm === 'back' ? 'pivot' : 'frontier';
        if (m) edge.state = m === 'back' ? 'pivot' : 'path';
        if (bott === k) edge.state = 'compare';
        if (m && step.kind === 'push') edge.pulse = true;
        return edge;
      });
    }
    if (o.spread) L.spreadArcs(edges, N.positions, o.pos);
    if (o.labelT) edges.forEach(function (e) {
      var t = o.labelT[e.from + '-' + e.to], u = o.labelT[e.to + '-' + e.from];
      if (t !== undefined) e.labelT = t; else if (u !== undefined) e.labelT = 1 - u;
    });
    return { nodes: nodes, edges: edges };
  };

  /* Pill placement. A pill stays at its edge's midpoint unless that spot is crowded; then it slides along the
     edge (labelT 0.2 .. 0.8) to the spot farthest from other pills and from the vertices. Distances are in
     the 1000-wide box, scaled by roughly one pill (110 x 70) and one vertex (130 x 100).  */
  function pickT(a, b, pills, nodes) {
    function score(t) {
      var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, sc = 9;
      pills.forEach(function (q) { sc = Math.min(sc, Math.max(Math.abs(x - q.x) / 125, Math.abs(y - q.y) / 80)); });
      nodes.forEach(function (q) { sc = Math.min(sc, Math.max(Math.abs(x - q.x) / 175, Math.abs(y - q.y) / 120)); });
      return sc;
    }
    if (score(0.5) >= 1) return 0.5;
    var best = 0.5, bs = -1;
    for (var t = 0.2; t <= 0.8001; t += 0.02) { var sc = score(t) - Math.abs(t - 0.5) * 0.05; if (sc > bs) { bs = sc; best = t; } }
    return Math.round(best * 100) / 100;
  }
  function nodePts(positions, over) {
    return Object.keys(positions).map(function (id) { return (over && over[id]) || positions[id]; });
  }
  /* Greedy placement for a drawn edge list (flowState output): edges with a reverse partner are curved and keep
     their pill at the bow, so they are fixed obstacles; straight edges may slide their pill. */
  L.spreadArcs = function (edges, positions, over) {
    var P = function (id) { return (over && over[id]) || positions[id]; }, has = {}, placed = [], lone = [], nodes = nodePts(positions, over);
    edges.forEach(function (e) { has[e.from + '>' + e.to] = true; });
    edges.forEach(function (e) {
      var a = P(e.from), b = P(e.to);
      if (!a || !b) return;
      if (has[e.to + '>' + e.from] && e.from !== e.to) {
        if (e.from > e.to) return;
        var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, off = 90, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        placed.push({ x: mx + dy / len * off, y: my - dx / len * off }, { x: mx - dy / len * off, y: my + dx / len * off });
      } else lone.push(e);
    });
    lone.forEach(function (e) {
      var a = P(e.from), b = P(e.to), t = pickT(a, b, placed, nodes);
      if (t !== 0.5) e.labelT = t;
      placed.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    });
  };

  /* Same for the plain network: returns {'from-to': t} for the edges `edgeFilter` accepts. */
  L.spreadLabels = function (net, edgeFilter) {
    var N = L.norm(net), P = N.positions, nodes = nodePts(P), list = N.edges.filter(function (e) { return (!edgeFilter || edgeFilter(e)) && P[e.from] && P[e.to]; });
    function pt(i, t) { var a = P[list[i].from], b = P[list[i].to]; return { x: a.x + (b.x - a.x) * t[i], y: a.y + (b.y - a.y) * t[i] }; }
    function worst(t) {
      var w = 9, pts = list.map(function (e, i) { return pt(i, t); });
      pts.forEach(function (p, i) {
        for (var k = i + 1; k < pts.length; k++) w = Math.min(w, Math.max(Math.abs(p.x - pts[k].x) / 125, Math.abs(p.y - pts[k].y) / 80));
        nodes.forEach(function (q) { w = Math.min(w, Math.max(Math.abs(p.x - q.x) / 150, Math.abs(p.y - q.y) / 110)); });
      });
      return w;
    }
    function descend(t) {
      for (var pass = 0; pass < 4; pass++) {
        list.forEach(function (e, i) {
          var others = [];
          list.forEach(function (f, k) { if (k !== i) others.push(pt(k, t)); });
          t[i] = pickT(P[e.from], P[e.to], others, nodes);
        });
      }
      return t;
    }
    var starts = [function () { return 0.5; }, function (i) { return 0.36 + 0.28 * (i % 2); }, function (i) { return 0.34 + 0.16 * (i % 3); }, function (i) { return 0.66 - 0.16 * (i % 3); }, function (i) { return 0.3 + 0.4 * ((i * 5) % 7) / 6; }];
    var seed = 7;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    for (var r = 0; r < 40; r++) starts.push(function () { return 0.25 + 0.5 * rnd(); });
    var best = null, bw = -1;
    starts.forEach(function (fn) {
      var t = descend(list.map(function (e, i) { return fn(i); })), w = worst(t);
      if (w > bw + 1e-9) { bw = w; best = t; }
    });
    var out = {};
    list.forEach(function (e, i) { out[e.from + '-' + e.to] = best[i]; });
    return out;
  };

  /* Steps carry `{__raw: text}` for variable-watch values that must not be quoted. */
  L.fixVars = function (step) {
    var o = Object.assign({}, step), vv = {};
    Object.keys(step.vars || {}).forEach(function (k) {
      var x = step.vars[k];
      vv[k] = x && typeof x === 'object' && x.__raw !== undefined ? L.raw(x.__raw) : x;
    });
    o.vars = vv;
    return o;
  };

  /* Network -> "s-a:7, s-b:7" text (the lab's input format). */
  L.toText = function (net) {
    return net.edges.map(function (e) { return e.from + '-' + e.to + ':' + e.cap; }).join(', ');
  };

  /* The network after `D` units have left the source: partial push of the augmenting path that crosses D.
     Integral, feasible, and it is a prefix of the Edmonds-Karp run. */
  L.flowAtValue = function (net, D) {
    var st = NF.trace(net, { detail: 'rounds' });
    var prevFl = st[0].fl, prevV = 0;
    for (var i = 1; i < st.length; i++) {
      var p = st[i];
      if (p.kind !== 'push') continue;
      if (D <= p.value) {
        var fl = Object.assign({}, prevFl), delta = D - prevV;
        p.path.forEach(function (a) { fl[a.edge] += a.dir === 'fwd' ? delta : -delta; });
        return fl;
      }
      prevFl = p.fl; prevV = p.value;
    }
    return prevFl;
  };

  /* Two synchronised graph views: the pipes (flow) on the left, the residual graph on the right. */
  L.pair = function (fig, net, o) {
    o = o || {};
    var left = V.views.graph(fig.querySelector('[data-stage="flow"]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: o.maxHeight || 330, label: o.leftLabel || 'Flow network', nodeRadius: 28, minRadius: 14 });
    var right = V.views.graph(fig.querySelector('[data-stage="res"]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: o.maxHeight || 330, label: o.rightLabel || 'Residual graph', nodeRadius: 28, minRadius: 14 });
    return {
      left: left, right: right,
      render: function (step, ctx, opts) {
        opts = opts || {};
        left.render(L.flowState(net, step, Object.assign({ spread: true }, opts, { residual: false })), { duration: ctx.duration });
        right.render(L.flowState(net, step, Object.assign({ spread: true }, opts, { residual: true })), { duration: ctx.duration });
      }
    };
  };

  /* ================================================================== hero teaser: pipes fill, then the cut lights up */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var steps = NF.trace(L.MAIN, { detail: 'rounds' });
    var view = V.views.graph(stage, { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 360, label: 'Flow network', nodeRadius: 24 });
    var badge = h('div', { class: 'nf-hero__badge', 'aria-hidden': 'true' }, h('span', { class: 'nf-hero__k' }, 'flow'), h('b', { class: 'nf-hero__v' }, '0'), h('span', { class: 'nf-hero__cut' }, ''));
    stage.appendChild(badge);
    var vEl = badge.querySelector('.nf-hero__v'), cEl = badge.querySelector('.nf-hero__cut');
    V.teaser(stage, {
      steps: steps,
      render: function (step, ctx) {
        view.render(L.flowState(L.MAIN, step, { subs: true }), { duration: ctx.duration });
        vEl.textContent = step.value;
        cEl.textContent = step.kind === 'cut' ? 'min cut = ' + step.cut.value : '';
        badge.classList.toggle('is-cut', step.kind === 'cut');
      },
      stepMs: 850, holdMs: 2200, instantWrap: false
    });
  }

  /* ================================================================== PipeNet: pipes with fill and moving particles */
  /* A custom SVG network: pipe thickness = capacity, water thickness = flow, particle density = flow.
     PipeNet(host, net, {label}) -> {setFlow(fl, ms), mark(states), destroy}. Particles run only while visible. */
  L.PipeNet = function (host, net, o) {
    o = o || {};
    var N = L.norm(net), R = 27, K = 250, SPEED = 95;
    var svg = s('svg', { class: 'nf-pipes', viewBox: '0 0 1000 600', role: 'img', 'aria-label': o.label || 'Pipe network' });
    var gPipes = s('g'), gParts = s('g'), gNodes = s('g'), gPills = s('g');
    svg.appendChild(gPipes); svg.appendChild(gParts); svg.appendChild(gNodes); svg.appendChild(gPills);
    host.appendChild(svg);
    function pos(id) { return N.positions[id]; }
    var maxCap = Math.max.apply(null, N.edges.map(function (e) { return e.cap; }).concat([1]));
    var E = N.edges.map(function (e) {
      var a = pos(e.from), b = pos(e.to), dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      var w = 10 + e.cap * 3.4;
      var g = s('g', { class: 'nf-pipe' });
      var wall = s('line', { class: 'nf-pipe-wall', x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': w + 10 });
      var chan = s('line', { class: 'nf-pipe-chan', x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': w });
      var water = s('line', { class: 'nf-pipe-water', x1: a.x, y1: a.y, x2: b.x, y2: b.y, 'stroke-width': 0 });
      g.appendChild(wall); g.appendChild(chan); g.appendChild(water);
      gPipes.appendChild(g);
      var pool = [], n = Math.ceil(len / (K / maxCap)) + 2;
      for (var i = 0; i < n; i++) { var c = s('circle', { class: 'nf-part', r: 3, cx: a.x, cy: a.y, opacity: 0 }); gParts.appendChild(c); pool.push(c); }
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var pill = s('g', { class: 'nf-pill', transform: 'translate(' + mx + ' ' + my + ')' });
      var pr = s('rect', { x: -27, y: -12, width: 54, height: 24, rx: 12 });
      var pt = s('text', { x: 0, y: 1 });
      pill.appendChild(pr); pill.appendChild(pt); gPills.appendChild(pill);
      return { e: e, a: a, b: b, len: len, ux: dx / len, uy: dy / len, w: w, g: g, water: water, pool: pool, pt: pt, pr: pr, cur: 0, tgt: 0, pill: pill };
    });
    N.ids.forEach(function (id) {
      var p = pos(id), end = id === N.source || id === N.sink;
      var g = s('g', { class: 'nf-node' + (end ? ' is-end' : ''), transform: 'translate(' + p.x + ' ' + p.y + ')' });
      g.appendChild(s('circle', { r: R }));
      g.appendChild(s('text', { x: 0, y: 1 }, id));
      if (end) g.appendChild(s('text', { class: 'nf-node__sub', x: 0, y: R + 20 }, id === N.source ? 'tap' : 'drain'));
      gNodes.appendChild(g);
    });
    var backed = s('g', { class: 'nf-backed', opacity: 0, transform: 'translate(' + (pos(N.source).x) + ' ' + (pos(N.source).y - 58) + ')' });
    backed.appendChild(s('rect', { x: -66, y: -14, width: 132, height: 28, rx: 14 }));
    var backedText = s('text', { x: 0, y: 1 }, 'backed up 0');
    backed.appendChild(backedText);
    gNodes.appendChild(backed);

    var t0 = 0, raf = 0, running = false, tw = null;
    function drawPill(p) {
      var f = Math.round(p.cur * 10) / 10;
      p.pt.textContent = (f % 1 ? f.toFixed(1) : f) + '/' + p.e.cap;
    }
    function drawWater(p) {
      p.water.setAttribute('stroke-width', (p.w * Math.min(1, p.cur / p.e.cap)).toFixed(2));
      drawPill(p);
    }
    function drawParticles(now) {
      var t = (now - t0) / 1000;
      E.forEach(function (p) {
        var f = p.cur, n = p.pool.length;
        if (f <= 0.05) { p.pool.forEach(function (c) { c.setAttribute('opacity', 0); }); return; }
        var spacing = K / f, phase = (t * SPEED) % spacing;
        var r = Math.max(2.3, Math.min(5.2, p.w * Math.min(1, f / p.e.cap) / 2 - 1.2));
        for (var i = 0; i < n; i++) {
          var d = phase + i * spacing, c = p.pool[i];
          if (d > p.len) { c.setAttribute('opacity', 0); continue; }
          c.setAttribute('cx', (p.a.x + p.ux * d).toFixed(1));
          c.setAttribute('cy', (p.a.y + p.uy * d).toFixed(1));
          c.setAttribute('r', r.toFixed(1));
          c.setAttribute('opacity', d < 12 || d > p.len - 12 ? 0.4 : 0.95);
        }
      });
    }
    function frame(now) { if (!running) return; drawParticles(now); raf = requestAnimationFrame(frame); }
    function start() { if (running || V.reducedMotion()) return; running = true; t0 = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    var unsub = V.onVisible(host, function (vis) { if (vis) start(); else stop(); });
    function paintAll() { E.forEach(drawWater); drawParticles(performance.now()); }
    function setFlow(fl, ms) {
      if (tw) { tw.cancel(); tw = null; }
      E.forEach(function (p) { p.tgt = fl[p.e.id] || 0; p.from = p.cur; });
      ms = V.dur(ms === undefined ? 450 : ms);
      if (!ms) { E.forEach(function (p) { p.cur = p.tgt; p.pill.classList.toggle('is-full', p.cur >= p.e.cap && p.cur > 0); }); paintAll(); return; }
      tw = V.tween(ms, function (t, k) {
        E.forEach(function (p) { p.cur = p.from + (p.tgt - p.from) * k; drawWater(p); p.pill.classList.toggle('is-full', p.cur >= p.e.cap - 0.001 && p.cur > 0); });
        if (!running) drawParticles(performance.now());
      });
    }
    /* mark({edgeId: 'full' | 'cut'}) sets the wall colour */
    function mark(states) {
      E.forEach(function (p) {
        var m = states && states[p.e.id];
        p.g.classList.toggle('is-full', m === 'full' || m === 'cut');
        p.g.classList.toggle('is-cut', m === 'cut');
      });
    }
    function setBacked(n) {
      backedText.textContent = 'backed up ' + n;
      backed.setAttribute('opacity', n > 0 ? 1 : 0);
    }
    paintAll();
    return { svg: svg, setFlow: setFlow, mark: mark, setBacked: setBacked, edges: E, destroy: function () { stop(); unsub(); if (tw) tw.cancel(); svg.remove(); } };
  };

  /* ================================================================== the problem: pipes and a tap */
  function pipesFigure(fig) {
    var net = L.MAIN, N = L.norm(net);
    var maxV = NF.maxFlow(net).value;
    var srcCap = N.edges.filter(function (e) { return e.from === N.source; }).reduce(function (a, e) { return a + e.cap; }, 0);
    var cut = NF.maxFlow(net).cut.edges;
    var pn = L.PipeNet(fig.querySelector('[data-stage]'), net, { label: 'Pipe network from tap s to drain t. Each pipe is as thick as its capacity and filled to the flow it carries.' });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', shape: 'line', label: 'Water in a pipe' },
      { state: 'compare', shape: 'line', label: 'Full pipe' },
      { state: 'error', shape: 'line', label: 'Pipes that limit everything' }
    ]);
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { sent: 'Pushed in at s', got: 'Arrives at t', backed: 'Backed up' }, states: { got: 'done', backed: 'error' } });
    var cap = fig.querySelector('[data-caption]');
    var D = 0;
    function show(v, ms) {
      D = v;
      var got = Math.min(v, maxV), fl = L.flowAtValue(net, got), marks = {};
      N.edges.forEach(function (e) { if (fl[e.id] >= e.cap) marks[e.id] = got >= maxV && cut.indexOf(e.id) !== -1 ? 'cut' : 'full'; });
      pn.setFlow(fl, ms);
      pn.mark(marks);
      pn.setBacked(v - got);
      stats.update({ sent: v, got: got, backed: v - got });
      if (v === 0) cap.innerHTML = 'The tap is closed. Every pipe is empty. Drag the slider to open it.';
      else if (v < maxV) cap.innerHTML = 'The pipes take <b>' + v + '</b> units without complaint. Notice how the water spreads over several routes, and how a pipe that fills up is drawn in amber.';
      else if (v === maxV) cap.innerHTML = 'The network is now carrying <b>' + maxV + '</b> units, its maximum. The red pipes are full and they cut the network in two: whatever you push at s must squeeze through <b>' + cut.map(function (id) { var e = N.byId[id]; return e.from + '→' + e.to; }).join(', ') + '</b>.';
      else cap.innerHTML = 'You push <b>' + v + '</b> units, but only <b>' + maxV + '</b> arrive. The extra <b>' + (v - maxV) + '</b> back up at the tap: the tap is not the limit, the red pipes are.';
    }
    var slider = V.slider(fig.querySelector('[data-slider]'), {
      label: 'Water you push in', min: 0, max: srcCap, value: 0, format: function (v) { return v + ' units'; },
      onInput: function (v) { stopSweep(); show(v, 250); }
    });
    var btn = fig.querySelector('[data-open]'), timer = 0;
    function stopSweep() { if (timer) { clearInterval(timer); timer = 0; btn.textContent = 'Open the tap'; } }
    btn.addEventListener('click', function () {
      if (timer) { stopSweep(); return; }
      var v = D >= srcCap ? 0 : D;
      slider.set(v); show(v, 0);
      btn.textContent = 'Stop';
      timer = setInterval(function () {
        v++;
        slider.set(v); show(v, 380);
        if (v >= srcCap) stopSweep();
      }, 620);
    });
    show(0, 0);
    V.onVisible(fig, function (vis) { if (!vis) stopSweep(); });
  }

  /* ================================================================== the two rules: three candidate flows */
  function rulesMinis(row) {
    var base = L.DIAMOND;
    function variant(f) {
      var step = { fl: { 's-a': f[0], 's-b': f[1], 'a-b': 0, 'a-t': f[2], 'b-t': f[3] }, states: {}, kind: 'x' };
      var net = { nodes: base.nodes, edges: [{ from: 's', to: 'a', cap: 4 }, { from: 's', to: 'b', cap: 3 }, { from: 'a', to: 't', cap: 5 }, { from: 'b', to: 't', cap: 2 }], source: 's', sink: 't' };
      return { net: net, step: step };
    }
    var items = [
      { tag: 'A', f: [3, 2, 3, 2], cap: 'Flow <b>A</b>: 3 and 2 leave s.' },
      { tag: 'B', f: [3, 3, 3, 3], cap: 'Flow <b>B</b>: 3 and 3 leave s.' },
      { tag: 'C', f: [4, 2, 3, 2], cap: 'Flow <b>C</b>: 4 and 2 leave s.' }
    ];
    items.forEach(function (it) {
      var v = variant(it.f);
      var st = h('div', { class: 'mini__stage nf-mini-stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: it.cap })));
      var view = V.views.graph(st, { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 190, label: 'Candidate flow ' + it.tag, nodeRadius: 26, minRadius: 15 });
      view.render(L.flowState(v.net, v.step), { duration: 0 });
    });
  }

  /* ================================================================== the path and its bottleneck */
  function bottleneckFigure(fig) {
    var rooms = [6, 2, 4], names = ['s', 'a', 'b', 't'];
    var W = 720, H = 210, x0 = 70, gap = (W - 2 * x0) / 3, cy = 108;
    var svg = s('svg', { class: 'nf-chain', viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': 'A path of three pipes with room ' + rooms.join(', ') });
    var pipes = [];
    rooms.forEach(function (room, i) {
      var xa = x0 + gap * i, xb = x0 + gap * (i + 1), w = 8 + room * 6;
      var g = s('g', { class: 'nf-chain__pipe', 'data-id': 'p' + i, 'data-label': 'Pipe ' + names[i] + ' to ' + names[i + 1] + ', room ' + room });
      g.appendChild(s('line', { class: 'nf-pipe-wall', x1: xa, y1: cy, x2: xb, y2: cy, 'stroke-width': w + 10 }));
      g.appendChild(s('line', { class: 'nf-pipe-chan', x1: xa, y1: cy, x2: xb, y2: cy, 'stroke-width': w }));
      var water = s('line', { class: 'nf-pipe-water nf-chain__water', x1: xa, y1: cy, x2: xb, y2: cy, 'stroke-width': 0 });
      g.appendChild(water);
      var flowDots = s('line', { class: 'nf-chain__dots', x1: xa, y1: cy, x2: xb, y2: cy, opacity: 0 });
      g.appendChild(flowDots);
      g.appendChild(s('text', { class: 'nf-chain__room', x: (xa + xb) / 2, y: cy - w / 2 - 20 }, 'room ' + room));
      svg.appendChild(g);
      pipes.push({ g: g, water: water, dots: flowDots, w: w, room: room });
    });
    names.forEach(function (n, i) {
      var g = s('g', { class: 'nf-node' + (i === 0 || i === 3 ? ' is-end' : ''), transform: 'translate(' + (x0 + gap * i) + ' ' + cy + ')' });
      g.appendChild(s('circle', { r: 26 }));
      g.appendChild(s('text', { x: 0, y: 1 }, n));
      svg.appendChild(g);
    });
    var note = s('text', { class: 'nf-chain__note', x: W / 2, y: H - 18 }, '');
    svg.appendChild(note);
    var stage = fig.querySelector('[data-stage]');
    stage.appendChild(svg);
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Water' }, { state: 'compare', shape: 'line', label: 'Full pipe' }]);
    var btn = fig.querySelector('[data-push]'), reset = fig.querySelector('[data-reset]');
    var b = Math.min.apply(null, rooms);
    btn.addEventListener('click', function () {
      pipes.forEach(function (p) {
        p.water.style.strokeWidth = (8 + b * 6) + 'px';
        p.dots.setAttribute('opacity', 1);
        p.g.classList.toggle('is-full', p.room === b);
      });
      note.textContent = 'The same ' + b + ' units pass through every pipe. Only the narrowest one is full.';
      fig.querySelector('[data-caption]').innerHTML = 'Push <b>' + b + '</b>: the water level is the same in every pipe, because what enters a vertex must leave it. Only the tightest pipe fills up, which is why it sets the limit.';
    });
    reset.addEventListener('click', function () {
      pipes.forEach(function (p) { p.water.style.strokeWidth = '0px'; p.dots.setAttribute('opacity', 0); p.g.classList.remove('is-full'); });
      note.textContent = '';
      fig.querySelector('[data-caption]').innerHTML = 'Three pipes in a row, each with room to spare. How much water can this one path carry?';
    });
    reset.click();
    V.clickQuiz(stage, {
      el: '#quiz-bottleneck', id: 'nf-click-bottleneck',
      question: 'Click the pipe that is the <b>bottleneck</b>: the one that limits how much this path can carry.',
      answer: 'p1',
      right: 'Yes: the pipe from a to b has room 2, the smallest of 6, 2 and 4. The path can carry min(6, 2, 4) = 2, so that is how much an augmentation pushes.',
      wrong: 'Not that one. The path can carry only as much as its narrowest pipe, so look for the smallest room.'
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    // quizzes and predictions that belong to lazily built figures: register now so the page score is complete
    if (V.quizScore && V.quizScore.register) {
      ['nf-quiz-rules', 'nf-click-bottleneck', 'nf-quiz-residual', 'nf-cp-greedy-drop', 'nf-lab-bottleneck', 'nf-lab-reverse', 'nf-quiz-cut', 'nf-match-reroute',
        'nf-check-after', 'nf-check-why-bfs', 'nf-check-matching'].forEach(V.quizScore.register);
    }
    heroTeaser();
    L.lazy('#fig-pipes', pipesFigure);
    L.lazy('#mini-rules', rulesMinis);
    L.lazy('#fig-bottleneck', bottleneckFigure);
    V.quiz('#quiz-rules', {
      id: 'nf-quiz-rules', question: 'Look at the three candidate flows. Which one is a <em>legal</em> flow?',
      options: ['Flow A', 'Flow B', 'Flow C'], answer: 0,
      explain: [
        'Yes. Every pipe carries no more than its capacity, and each middle vertex passes on exactly what it receives: a takes in 3 and sends 3, b takes in 2 and sends 2.',
        'Look at the pipe from b to t: it carries 3 but holds only 2. A pipe cannot carry more than its capacity, so this flow breaks rule one.',
        'Look at vertex a: 4 units flow in but only 3 flow out. One unit has vanished, which breaks conservation, rule two.'
      ]
    });
  });
}());
