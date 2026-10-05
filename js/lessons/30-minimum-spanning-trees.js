/* Lesson 30 · Minimum spanning trees — shared helpers and the first figures.
   Part 2 (Kruskal and Prim labs, flowcharts): js/lessons/30-minimum-spanning-trees-labs.js
   Part 3 (side by side, cycle property, clustering, cost, variations, decision diagram, checks): ...-more.js
   Step generators: js/algos/30-minimum-spanning-trees.js (VDSA.algos.mst). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var M = V.algos.mst;
  var L = V.L30 = V.L30 || {};

  /* ================================================================== data */
  function graph(nodes, edges) {
    return {
      nodes: nodes.map(function (n) { return { id: n[0], x: n[1], y: n[2] }; }),
      edges: edges.map(function (e) { return { u: e[0], v: e[1], w: e[2] }; })
    };
  }
  L.graph = graph;
  /* The lesson graph (study figure 1). Distinct weights, unique MST of weight 15. */
  L.MAIN = graph(
    [['A', 110, 300], ['B', 350, 90], ['C', 350, 510], ['D', 580, 300], ['F', 850, 110], ['E', 850, 490]],
    [['A', 'C', 1], ['D', 'F', 2], ['E', 'F', 3], ['C', 'D', 4], ['B', 'D', 5], ['A', 'B', 6], ['A', 'D', 7], ['B', 'F', 8], ['C', 'E', 9]]);
  /* Nine towns. Distinct weights, MST weight 43. Kruskal rejects B–C; Prim from A pops the stale B–C. */
  L.TOWNS = graph(
    [['A', 90, 160], ['B', 300, 70], ['C', 250, 310], ['D', 110, 500], ['E', 500, 200], ['F', 500, 450], ['G', 760, 90], ['H', 780, 330], ['I', 930, 500]],
    [['A', 'B', 7], ['A', 'C', 5], ['B', 'C', 8], ['B', 'E', 11], ['C', 'E', 3], ['C', 'D', 13], ['D', 'F', 9], ['C', 'F', 6], ['E', 'F', 12],
      ['E', 'G', 14], ['E', 'H', 10], ['G', 'H', 2], ['F', 'H', 15], ['H', 'I', 1], ['F', 'I', 16]]);
  L.TIES = graph(
    [['A', 220, 130], ['B', 720, 130], ['C', 720, 470], ['D', 220, 470]],
    [['A', 'B', 2], ['B', 'C', 2], ['C', 'D', 2], ['D', 'A', 2], ['A', 'C', 3]]);
  L.ISLANDS = graph(
    [['A', 120, 180], ['B', 330, 90], ['C', 330, 330], ['D', 640, 120], ['E', 860, 220], ['F', 640, 450], ['G', 900, 480]],
    [['A', 'B', 3], ['B', 'C', 1], ['A', 'C', 2], ['D', 'E', 4], ['E', 'F', 6], ['D', 'F', 5]]);
  L.K5 = graph(
    [['A', 500, 70], ['B', 860, 250], ['C', 720, 500], ['D', 280, 500], ['E', 140, 250]],
    [['A', 'B', 4], ['A', 'C', 9], ['A', 'D', 8], ['A', 'E', 6], ['B', 'C', 3], ['B', 'D', 10], ['B', 'E', 7], ['C', 'D', 2], ['C', 'E', 11], ['D', 'E', 5]]);
  /* Random towns on a jittered grid; roads join near neighbours; weight = distance. Seed makes it reproducible. */
  L.random = function (seed) {
    var rng = V.rng(seed || 1), cols = 4, rows = 2, nodes = [], i, j;
    for (i = 0; i < 8; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      nodes.push([String.fromCharCode(65 + i), 130 + c * 240 + rng.int(-50, 50), 150 + r * 300 + rng.int(-60, 60)]);
    }
    var all = [];
    for (i = 0; i < 8; i++) for (j = i + 1; j < 8; j++) {
      var d = Math.hypot(nodes[i][1] - nodes[j][1], nodes[i][2] - nodes[j][2]);
      all.push({ u: nodes[i][0], v: nodes[j][0], w: Math.max(1, Math.round(d / 12)), d: d });
    }
    var g = graph(nodes, []);
    var near = all.filter(function (e) { return e.d < 330; });
    var chosen = {};
    near.forEach(function (e) { chosen[M.edgeKey(e.u, e.v)] = e; });
    M.kruskal({ nodes: g.nodes, edges: all }).tree.forEach(function (e) { chosen[M.edgeKey(e.u, e.v)] = { u: e.u, v: e.v, w: e.w }; });
    g.edges = Object.keys(chosen).map(function (k) { return { u: chosen[k].u, v: chosen[k].v, w: chosen[k].w }; }).slice(0, 20);
    if (M.kruskal(g).components > 1) g.edges = Object.keys(chosen).map(function (k) { return { u: chosen[k].u, v: chosen[k].v, w: chosen[k].w }; });
    return g;
  };

  /* ================================================================== lazy init */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 30] figure failed', el.id, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };

  /* ================================================================== graph snapshots */
  var CC = 8;
  /* Component colour role for a group of nodes: cc0..cc7 by the index of the group's leader; singletons stay plain. */
  L.cc = function (ids, leader, size) { return size > 1 ? 'cc' + (ids.indexOf(leader) % CC) : 'default'; };

  /* L.state(graph, {node(id) -> state | {state, badge, sub}, edge(e, id) -> state | {state, dashed, pulse, label}, pos}) */
  L.state = function (g, o) {
    o = o || {};
    var nodes = g.nodes.map(function (n) {
      var p = o.pos && o.pos[n.id] ? o.pos[n.id] : n;
      var node = { id: n.id, x: p.x, y: p.y, state: 'default' };
      if (o.node) { var r = o.node(n.id); if (r && typeof r === 'object') Object.assign(node, r); else if (r) node.state = r; }
      return node;
    });
    var edges = g.edges.map(function (e) {
      var id = M.edgeKey(e.u, e.v);
      var edge = { id: id, from: e.u, to: e.v, weight: e.w, state: 'default' };
      if (o.edge) { var r = o.edge(e, id); if (r && typeof r === 'object') Object.assign(edge, r); else if (r) edge.state = r; }
      return edge;
    });
    return { nodes: nodes, edges: edges };
  };
  L.dash = function (e) { return e.u + '–' + e.v; };
  L.ids = function (g) { return g.nodes.map(function (n) { return n.id; }); };

  /* Kruskal trace step -> graph state */
  L.kruskalState = function (g, st) {
    var ids = L.ids(g), size = {};
    Object.keys(st.comp).forEach(function (id) { size[st.comp[id]] = (size[st.comp[id]] || 0) + 1; });
    var cur = st.cursor >= 0 ? st.sorted[st.cursor] : null;
    return L.state(g, {
      node: function (id) {
        if ((st.kind === 'pick' || st.kind === 'check') && st.active.indexOf(id) >= 0) return 'active';
        return L.cc(ids, st.comp[id], size[st.comp[id]]);
      },
      edge: function (e, id) {
        var status = st.status[id];
        if (status === 'accepted') return { state: 'done', pulse: st.kind === 'accept' && cur && cur.id === id };
        if (status === 'considering') return 'compare';
        if (status === 'rejected') return st.kind === 'reject' && cur && cur.id === id ? 'error' : { state: 'muted', dashed: true };
        return st.kind === 'done' && st.accepted.length === st.need && st.need > 0 ? 'muted' : 'default';
      }
    });
  };
  /* Prim trace step -> graph state */
  L.primState = function (g, st) {
    var inTree = {}, frontier = {};
    st.tree.forEach(function (id) { inTree[id] = true; });
    st.pq.forEach(function (q) { if (!q.dead && !inTree[q.v]) frontier[q.v] = true; });
    return L.state(g, {
      node: function (id) {
        if (st.newNode === id && st.kind !== 'done') return 'active';
        if (inTree[id]) return 'done';
        if (st.popped && st.popped.v === id && st.kind === 'pop') return 'compare';
        return frontier[id] ? 'frontier' : 'default';
      },
      edge: function (e, id) {
        var status = st.status[id];
        if (status === 'tree') return { state: 'done', pulse: st.kind === 'add' && st.treeEdges[st.treeEdges.length - 1] === id };
        if (status === 'popped') return st.kind === 'skip' ? 'error' : 'compare';
        if (status === 'queued') return 'frontier';
        if (status === 'dead') return { state: 'muted', dashed: true };
        if (status === 'skipped') return st.kind === 'skip' && st.popped && st.popped.id === id ? 'error' : { state: 'muted', dashed: true };
        return 'default';
      }
    });
  };

  /* ================================================================== small shared widgets */
  /* A keyed list of edge chips with FLIP motion. items: [{key, label, w, state, title}]; opt.cursor: sliding pointer. */
  L.chipList = function (host, o) {
    o = o || {};
    host.classList.add('mst-chips');
    if (o.label) host.setAttribute('aria-label', o.label);
    host.setAttribute('role', 'list');
    var chips = {}, cursor = o.cursor ? h('span', { class: 'mst-cursor', 'aria-hidden': 'true' }) : null;
    if (cursor) host.appendChild(cursor);
    var empty = h('span', { class: 'mst-chips__empty' }, o.empty || 'empty');
    host.appendChild(empty);
    var order = [];
    function render(items, opt) {
      opt = opt || {};
      var dur = opt.duration === undefined ? 300 : opt.duration;
      var first = {};
      Object.keys(chips).forEach(function (k) { first[k] = chips[k].el.getBoundingClientRect(); });
      var want = {};
      items.forEach(function (it) { want[it.key] = true; });
      Object.keys(chips).forEach(function (k) {
        if (want[k]) return;
        var c = chips[k], r = first[k], hr = host.getBoundingClientRect();
        delete chips[k];
        if (dur > 0) {
          c.el.style.position = 'absolute'; c.el.style.left = (r.left - hr.left + host.scrollLeft) + 'px'; c.el.style.top = (r.top - hr.top) + 'px'; c.el.style.margin = '0'; c.el.style.pointerEvents = 'none';
          var an = c.el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px) scale(.8)' }], { duration: dur, easing: 'ease-in' });
          an.onfinish = function () { c.el.remove(); };
        } else c.el.remove();
      });
      items.forEach(function (it, i) {
        var c = chips[it.key], isNew = false;
        if (!c) {
          isNew = true;
          c = chips[it.key] = { el: h('span', { class: 'mst-chip', role: 'listitem' }, h('span', { class: 'mst-chip__name' }), h('span', { class: 'mst-chip__w' })), state: null };
          c.name = c.el.firstChild; c.w = c.el.lastChild;
        }
        if (c.name.textContent !== it.label) c.name.textContent = it.label;
        var wt = String(it.w);
        if (c.w.textContent !== wt) c.w.textContent = wt;
        if (c.state !== it.state) { if (c.state) c.el.classList.remove('is-' + c.state); c.el.classList.add('is-' + it.state); c.state = it.state; }
        c.el.setAttribute('aria-label', it.title || (it.label + ', weight ' + it.w + ', ' + it.state));
        var ref = host.children[i + (cursor ? 1 : 0)];
        // keep chips in order right after the cursor element
        var target = cursor ? (host.children[i + 1] || null) : (host.children[i] || null);
        if (target !== c.el) {
          if (isNew || !first[it.key]) host.insertBefore(c.el, target || empty);
          else host.insertBefore(c.el, target);
        }
        void ref;
        c.isNew = isNew;
      });
      // FLIP
      items.forEach(function (it) {
        var c = chips[it.key], el = c.el;
        if (dur <= 0) return;
        if (c.isNew) {
          el.animate([{ opacity: 0, transform: 'translateY(-10px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)' });
        } else {
          var a = first[it.key], b = el.getBoundingClientRect();
          var dx = a.left - b.left, dy = a.top - b.top;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: dur, easing: 'cubic-bezier(.3,.7,.2,1)' });
        }
      });
      empty.hidden = items.length > 0;
      if (cursor) {
        var idx = opt.cursor === undefined ? -1 : opt.cursor;
        var key = idx >= 0 && items[idx] ? items[idx].key : null;
        if (key && chips[key]) {
          var el2 = chips[key].el;
          var x = el2.offsetLeft + el2.offsetWidth / 2, y = el2.offsetTop;
          cursor.style.transition = dur > 0 && cursor.classList.contains('is-on') ? 'transform ' + dur + 'ms cubic-bezier(.3,.7,.2,1), opacity 200ms' : 'none';
          cursor.style.transform = 'translate(' + (x - 7) + 'px,' + (y - 12) + 'px)';
          cursor.classList.add('is-on');
        } else cursor.classList.remove('is-on');
      }
    }
    return { render: render, el: host };
  };

  /* Component strip: one coloured pill per component (union-find set), pops when it grows. */
  L.groupStrip = function (host, ids) {
    host.classList.add('mst-groups');
    host.setAttribute('role', 'list');
    var pills = {};
    function render(groups) {
      var want = {};
      groups.forEach(function (gr) { want[gr[0]] = true; });
      Object.keys(pills).forEach(function (k) { if (!want[k]) { pills[k].el.remove(); delete pills[k]; } });
      groups.forEach(function (gr, i) {
        var k = gr[0], p = pills[k], text = gr.join(' ');
        if (!p) { p = pills[k] = { el: h('span', { class: 'mst-group', role: 'listitem' }), text: '' }; }
        var cls = gr.length > 1 ? 'cc' + (ids.indexOf(k) % CC) : 'solo';
        if (p.cls !== cls) { if (p.cls) p.el.classList.remove('is-' + p.cls); p.el.classList.add('is-' + cls); p.cls = cls; }
        if (p.text !== text) {
          var grew = p.text && text.length > p.text.length;
          p.el.textContent = text; p.text = text;
          p.el.setAttribute('aria-label', 'Component ' + gr.join(', '));
          if (grew) { p.el.classList.remove('is-pop'); void p.el.offsetWidth; p.el.classList.add('is-pop'); }
        }
        if (host.children[i] !== p.el) host.insertBefore(p.el, host.children[i] || null);
      });
    }
    return { render: render };
  };

  /* ================================================================== hero teaser: Kruskal connects nine towns */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var g = L.TOWNS;
    var view = V.views.graph(stage, { label: 'Towns joined by the cheapest roads', maxHeight: 420, nodeRadius: 21 });
    var tag = h('div', { class: 'mst-hero__tag', 'aria-hidden': 'true' }, h('span', { class: 'mst-hero__k' }, 'Cost'), h('b', { class: 'mst-hero__v' }, '0'), h('span', { class: 'mst-hero__k mst-hero__k--r' }, 'Networks'), h('b', { class: 'mst-hero__n' }, '9'));
    stage.appendChild(tag);
    var steps = M.kruskalTrace(g).filter(function (st) { return st.kind === 'init' || st.kind === 'accept' || st.kind === 'reject' || st.kind === 'done'; });
    V.teaser(stage, {
      steps: steps,
      render: function (st, ctx) {
        view.render(L.kruskalState(g, st), { duration: ctx.duration });
        tag.querySelector('.mst-hero__v').textContent = st.total;
        tag.querySelector('.mst-hero__n').textContent = st.groups.length;
      },
      stepMs: 700, holdMs: 2200, instantWrap: false
    });
  }

  /* ================================================================== the problem: build the network yourself */
  function problemFigure(fig) {
    var g = L.MAIN, ids = L.ids(g), best = M.kruskal(g);
    var stage = fig.querySelector('[data-stage]');
    var out = fig.querySelector('[data-readout]');
    var chosen = {};
    var view = V.views.graph(stage, { label: 'Six towns and nine possible roads. Click a road to build it.', maxHeight: 400, onEdgeClick: toggle });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'path', shape: 'line', label: 'Road you built' }, { state: 'default', shape: 'line', label: 'Possible road' },
      { state: 'default', color: 'color-mix(in srgb, var(--st-active) 30%, var(--el-fill))', label: 'Towns joined together (a colour each)' }]);
    var btnBest = fig.querySelector('[data-best]'), btnReset = fig.querySelector('[data-reset]');
    var revealed = false;

    function analyse() {
      var uf = new M.UF(ids.length), cost = 0, count = 0, loops = 0;
      Object.keys(chosen).forEach(function (id) {
        var e = g.edges.filter(function (x) { return M.edgeKey(x.u, x.v) === id; })[0];
        count++; cost += e.w;
        if (!uf.union(ids.indexOf(e.u), ids.indexOf(e.v))) loops++;
      });
      var groups = {};
      ids.forEach(function (id, i) { var r = uf.find(i); (groups[r] = groups[r] || []).push(id); });
      return { cost: cost, count: count, loops: loops, groups: groups, uf: uf, pieces: Object.keys(groups).length };
    }
    function draw(dur) {
      var a = analyse();
      var size = {};
      view.render(L.state(g, {
        node: function (id) { var r = a.uf.find(ids.indexOf(id)), sz = a.groups[r].length; return sz > 1 ? 'cc' + (r % CC) : 'default'; },
        edge: function (e, id) { return chosen[id] ? { state: 'path' } : 'default'; }
      }), { duration: dur === undefined ? 350 : dur });
      var msg, cls = '';
      if (a.pieces === 1 && a.loops === 0) {
        if (a.cost === best.total) { msg = 'That is the cheapest possible: <b>' + a.cost + '</b>. No other set of roads connects all six towns for less.'; cls = 'is-good'; }
        else { msg = 'Everything is connected for <b>' + a.cost + '</b>, with no loops. Can you do it for less?'; }
      } else if (a.loops > 0) { msg = 'You built a loop: ' + (a.loops === 1 ? 'one road is' : a.loops + ' roads are') + ' wasted, because its towns were already joined. Click a road on the loop to remove it.'; cls = 'is-warn'; }
      else if (a.count === 0) msg = 'No roads yet. Click a road to build it.';
      else msg = a.pieces + ' separate groups so far. Keep building until every town is joined.';
      out.innerHTML = '<span class="mst-stat"><small>Cost</small><b>' + a.cost + '</b></span><span class="mst-stat"><small>Roads</small><b>' + a.count + '</b></span><span class="mst-stat"><small>Groups</small><b>' + a.pieces + '</b></span><span class="mst-msg ' + cls + '">' + msg + '</span>';
    }
    function toggle(e) {
      if (revealed) { revealed = false; }
      var id = e.id;
      if (chosen[id]) delete chosen[id]; else chosen[id] = true;
      draw();
    }
    btnBest.addEventListener('click', function () {
      chosen = {};
      best.tree.forEach(function (e) { chosen[M.edgeKey(e.u, e.v)] = true; });
      revealed = true;
      draw(500);
    });
    btnReset.addEventListener('click', function () { chosen = {}; draw(300); });
    draw(0);
  }

  /* ================================================================== what is a spanning tree */
  function treeMinis(row) {
    var g = L.MAIN;
    function mini(cap, edgeIds, tone) {
      var st = h('div', { class: 'mini__stage' });
      row.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: cap })));
      var view = V.views.graph(st, { maxHeight: 190, nodeRadius: 20, minRadius: 14, showWeights: false, label: cap.replace(/<[^>]+>/g, '') });
      var set = {};
      edgeIds.forEach(function (id) { set[id] = true; });
      var uf = new M.UF(6), ids = L.ids(g), groups = {};
      g.edges.forEach(function (e) { if (set[M.edgeKey(e.u, e.v)]) uf.union(ids.indexOf(e.u), ids.indexOf(e.v)); });
      ids.forEach(function (id, i) { var r = uf.find(i); groups[r] = (groups[r] || 0) + 1; });
      view.render(L.state(g, {
        node: function (id) { var r = uf.find(ids.indexOf(id)); return tone === 'tree' ? 'done' : groups[r] > 1 ? 'cc' + (r % CC) : 'default'; },
        edge: function (e, id) {
          if (!set[id]) return { state: 'default' };
          return { state: tone === 'loop' && (id === 'A-C' || id === 'C-D' || id === 'A-D') ? 'error' : tone === 'tree' ? 'done' : 'path' };
        }
      }), { duration: 0 });
    }
    mini('<b>4 edges: too few.</b> Three separate groups; a town is left out.', ['A-C', 'D-F', 'E-F'].concat([]), 'few');
    mini('<b>5 edges, no loop.</b> Every town is joined and nothing is wasted: a spanning tree.', ['A-C', 'D-F', 'E-F', 'C-D', 'B-D'], 'tree');
    mini('<b>6 edges: one too many.</b> A-C-D-A is a loop, so one road is wasted.', ['A-C', 'D-F', 'E-F', 'C-D', 'B-D', 'A-D'], 'loop');
  }

  function treeGallery(fig) {
    var g = L.MAIN, ids = L.ids(g);
    var all = M.spanningTrees(g);
    var trees = all.trees;
    var weights = trees.map(function (t) { return t.weight; });
    var minW = Math.min.apply(null, weights), maxW = Math.max.apply(null, weights);
    var order = V.shuffle(trees.map(function (t, i) { return i; }), V.rng(4));
    var pos = -1, cur = 0;
    var stage = fig.querySelector('[data-stage]'), out = fig.querySelector('[data-readout]');
    var view = V.views.graph(stage, { label: 'A spanning tree of the six towns', maxHeight: 360 });
    var chartHost = fig.querySelector('[data-chart]');
    var chart = V.views.chart(chartHost, { type: 'bar', height: 210, label: 'How many spanning trees have each total weight' });
    var cats = [], counts = [];
    for (var w = minW; w <= maxW; w++) { cats.push(String(w)); counts.push(weights.filter(function (x) { return x === w; }).length); }
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'path', shape: 'line', label: 'In this spanning tree' }, { state: 'default', shape: 'line', label: 'Left out' }]);
    function show(i, dur) {
      cur = i;
      var t = trees[i], set = {};
      t.edges.forEach(function (id) { set[id] = true; });
      view.render(L.state(g, {
        node: function () { return t.weight === minW ? 'done' : 'default'; },
        edge: function (e, id) { return set[id] ? { state: t.weight === minW ? 'done' : 'path' } : { state: 'muted', dashed: true }; }
      }), { duration: dur === undefined ? 450 : dur });
      out.innerHTML = 'This graph has <b>' + all.count + '</b> different spanning trees. This one has weight <b>' + t.weight + '</b>' +
        (t.weight === minW ? ' &mdash; the cheapest of all ' + all.count + '.' : '; the cheapest weighs ' + minW + ' and the dearest ' + maxW + '.');
      chart.render({
        categories: cats,
        series: [{ id: 'n', label: 'Spanning trees', values: counts, state: 'visited' }],
        y: { label: 'trees', min: 0 }, highlight: { category: String(t.weight) }
      }, { duration: dur === undefined ? 450 : dur });
    }
    fig.querySelector('[data-next]').addEventListener('click', function () { pos = (pos + 1) % order.length; show(order[pos]); });
    fig.querySelector('[data-cheapest]').addEventListener('click', function () { show(weights.indexOf(minW)); });
    fig.querySelector('[data-dearest]').addEventListener('click', function () { show(weights.indexOf(maxW)); });
    var sortedW = weights.slice().sort(function (a, b) { return a - b; });
    show(weights.indexOf(sortedW[Math.floor(sortedW.length / 2)]), 0);
  }

  /* ================================================================== the cycle test: click two vertices */
  function cycleTest(fig) {
    var g = L.MAIN, ids = L.ids(g);
    var stage = fig.querySelector('[data-stage]'), out = fig.querySelector('[data-caption]');
    var forest = [['A', 'C'], ['D', 'F'], ['E', 'F']].map(function (p) { return { u: p[0], v: p[1], id: M.edgeKey(p[0], p[1]) }; });
    var uf = new M.UF(ids.length);
    forest.forEach(function (e) { uf.union(ids.indexOf(e.u), ids.indexOf(e.v)); });
    var size = {};
    ids.forEach(function (id, i) { var r = uf.find(i); size[r] = (size[r] || 0) + 1; });
    var isForest = {};
    forest.forEach(function (e) { isForest[e.id] = true; });
    var view = V.views.graph(stage, { label: 'Three groups of towns. Click two towns to test them.', maxHeight: 380, onNodeClick: click });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Your two towns' }, { state: 'path', shape: 'line', label: 'Path that would become a loop' }, { state: 'done', shape: 'line', label: 'Road already built' }]);
    var picks = [];
    function base(o) {
      o = o || {};
      view.render(L.state(g, {
        node: function (id) {
          if (picks.indexOf(id) >= 0) return 'active';
          var r = uf.find(ids.indexOf(id));
          return size[r] > 1 ? 'cc' + (r % CC) : 'default';
        },
        edge: function (e, id) {
          if (o.path && o.path.indexOf(id) >= 0) return { state: 'path' };
          return isForest[id] ? { state: 'done' } : { state: 'muted', dashed: true };
        }
      }), { duration: o.dur === undefined ? 350 : o.dur });
    }
    function click(e) {
      var id = String(e.id);
      if (picks.length >= 2) picks = [];
      if (picks.indexOf(id) >= 0) { picks = []; base(); out.innerHTML = 'Click any two towns. If they share a colour, a road between them would close a loop.'; return; }
      picks.push(id);
      if (picks.length === 1) { base(); out.innerHTML = 'You picked <b>' + id + '</b>. Now click a second town.'; return; }
      var a = picks[0], b = picks[1];
      var same = uf.find(ids.indexOf(a)) === uf.find(ids.indexOf(b));
      if (same) {
        var path = M.pathInTree(forest, a, b) || [];
        base({ path: path });
        var nodes = [a], cur = a;
        path.forEach(function (pid) { var f = forest.filter(function (x) { return x.id === pid; })[0]; cur = f.u === cur ? f.v : f.u; nodes.push(cur); });
        out.innerHTML = '<b>' + a + '</b> and <b>' + b + '</b> already have the same colour: the built roads join them along ' + nodes.join('–') + '. A new road ' + a + '–' + b + ' would close that into a <b>loop</b>. Reject it.';
      } else {
        base();
        out.innerHTML = '<b>' + a + '</b> and <b>' + b + '</b> have different colours: no built road connects them yet, so a road ' + a + '–' + b + ' joins two separate groups and cannot make a loop. Accept it.';
      }
    }
    base(0);
    out.innerHTML = 'Click any two towns. If they share a colour, a road between them would close a loop.';
  }

  /* ================================================================== the cut explorer: drag a knife across the map */
  function cutExplorer(fig) {
    var g = L.TOWNS, ids = L.ids(g), mst = M.kruskal(g), inMst = {};
    mst.tree.forEach(function (e) { inMst[e.id] = true; });
    var stage = fig.querySelector('[data-stage]'), out = fig.querySelector('[data-readout]'), statsEl = fig.querySelector('[data-explored]');
    var wrap = h('div', { class: 'cut-wrap' });
    stage.appendChild(wrap);
    var host = h('div', { class: 'cut-graph' });
    wrap.appendChild(host);
    var view = V.views.graph(host, { bounds: { w: 1000, h: 600 }, maxHeight: 460, nodeRadius: 22, label: 'Nine towns and fifteen roads, cut by a movable line' });
    var svg = s('svg', { class: 'cut-overlay', 'aria-hidden': 'false' });
    var defs = s('defs');
    var sideS = s('polygon', { class: 'cut-side cut-side--s' }), sideT = s('polygon', { class: 'cut-side cut-side--t' });
    var knife = s('line', { class: 'cut-knife' }), knifeHit = s('line', { class: 'cut-knife-hit' });
    var hTop = s('circle', { class: 'cut-handle', r: 13, tabindex: '-1' }), hBot = s('circle', { class: 'cut-handle', r: 13, tabindex: '-1' });
    var tagS = s('text', { class: 'cut-tag cut-tag--s' }, 'S'), tagT = s('text', { class: 'cut-tag cut-tag--t' }, 'V − S');
    [defs, sideS, sideT, knife, knifeHit, hTop, hBot, tagS, tagT].forEach(function (n) { svg.appendChild(n); });
    wrap.appendChild(svg);
    var top = 600, bot = 680, showMst = false;
    var explored = {}, exploredCount = 0, okCount = 0;

    var sliders = fig.querySelector('[data-sliders]');
    var slTop = V.slider(h('div', { class: 'cut-slider' }), { label: 'Top of the cut', min: 0, max: 1000, step: 10, value: top, format: function (v) { return Math.round(v / 10) + '%'; }, onInput: function (v) { top = v; update(); } });
    var slBot = V.slider(h('div', { class: 'cut-slider' }), { label: 'Bottom of the cut', min: 0, max: 1000, step: 10, value: bot, format: function (v) { return Math.round(v / 10) + '%'; }, onInput: function (v) { bot = v; update(); } });
    sliders.appendChild(slTop.el || slTop.input.closest('.slider') || slTop.input.parentNode);
    sliders.appendChild(slBot.el || slBot.input.closest('.slider') || slBot.input.parentNode);

    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', color: 'color-mix(in srgb, var(--st-active) 30%, var(--el-fill))', label: 'Side S' },
      { state: 'default', color: 'color-mix(in srgb, var(--st-pivot) 30%, var(--el-fill))', label: 'Other side' },
      { state: 'compare', shape: 'line', label: 'Crossing edge' }, { state: 'done', shape: 'line', label: 'Lightest crossing: safe' },
      { state: 'visited', shape: 'line', label: 'MST edge (if shown)' }]);

    function sideOf(n) { return (bot - top) * n.y - 600 * (n.x - top) > 0; }
    function px(x, y) { var p = view.toScreen(x, y); return p; }
    function layout() {
      var r = view.el.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      svg.style.left = (r.left - wr.left) + 'px'; svg.style.top = (r.top - wr.top) + 'px';
      svg.setAttribute('width', r.width); svg.setAttribute('height', r.height);
      svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
      var a = px(top, 0), b = px(bot, 600), tl = px(0, 0), tr = px(1000, 0), bl = px(0, 600), br = px(1000, 600);
      [knife, knifeHit].forEach(function (k) { k.setAttribute('x1', a.x); k.setAttribute('y1', a.y); k.setAttribute('x2', b.x); k.setAttribute('y2', b.y); });
      hTop.setAttribute('cx', a.x); hTop.setAttribute('cy', a.y); hBot.setAttribute('cx', b.x); hBot.setAttribute('cy', b.y);
      sideS.setAttribute('points', [tl.x, tl.y, a.x, a.y, b.x, b.y, bl.x, bl.y].join(' '));
      sideT.setAttribute('points', [a.x, a.y, tr.x, tr.y, br.x, br.y, b.x, b.y].join(' '));
      var ma = px((top + bot) / 4, 300);
      tagS.setAttribute('x', Math.max(20, (tl.x + a.x) / 2 * 0.5 + (bl.x + b.x) / 2 * 0.5 + 6)); tagS.setAttribute('y', tl.y + 26);
      tagT.setAttribute('x', Math.min(r.width - 24, (tr.x + a.x) / 2 * 0.5 + (br.x + b.x) / 2 * 0.5 - 6)); tagT.setAttribute('y', tl.y + 26);
      void ma;
    }
    function update(dur) {
      var S = g.nodes.filter(sideOf).map(function (n) { return n.id; });
      var info = M.cutInfo(g, S), inS = {};
      S.forEach(function (id) { inS[id] = true; });
      var cross = {};
      info.crossing.forEach(function (e) { cross[e.id] = true; });
      view.render(L.state(g, {
        node: function (id) { return inS[id] ? 'cc0' : 'cc3'; },
        edge: function (e, id) {
          if (info.lightest && id === info.lightest.id) return { state: 'done', pulse: false };
          if (cross[id]) return 'compare';
          return showMst && inMst[id] ? 'visited' : 'default';
        }
      }), { duration: dur === undefined ? 200 : dur });
      layout();
      if (!info.valid) {
        out.innerHTML = '<b>Every town is on one side.</b> A cut must split the towns into two non-empty groups. Drag the ends of the line across the map.';
        return;
      }
      var ws = info.crossing.map(function (e) { return e.w; }).sort(function (a, b) { return a - b; });
      out.innerHTML = '<b>' + info.S.length + '</b> towns in S, <b>' + info.T.length + '</b> on the other side. <b>' + info.crossing.length + '</b> roads cross the line (weights ' + ws.join(', ') + '). ' +
        (info.lightest ? 'The lightest is <b>' + L.dash(info.lightest) + ' (' + info.lightest.w + ')</b>: the cut property says it is in the MST' + (inMst[info.lightest.id] ? ', and it is.' : '.') : 'No road crosses, so this graph is not connected.');
      var sig = S.slice().sort().join('');
      if (!explored[sig] && info.lightest) {
        explored[sig] = true; exploredCount++;
        if (inMst[info.lightest.id]) okCount++;
        statsEl.innerHTML = 'Cuts you have tried: <b>' + exploredCount + '</b>. Lightest crossing road was in the MST: <b>' + okCount + ' of ' + exploredCount + '</b>.';
      }
    }
    function drag(handle, which) {
      handle.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        handle.classList.add('is-drag');
        function move(ev) {
          var r = svg.getBoundingClientRect();
          var l = view.toLogical(ev.clientX - r.left, ev.clientY - r.top);
          var x = Math.max(0, Math.min(1000, Math.round(l.x / 10) * 10));
          if (which === 'top') { top = x; slTop.set(x); } else { bot = x; slBot.set(x); }
          update(0);
        }
        function up() { handle.classList.remove('is-drag'); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); }
        handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
      });
    }
    drag(hTop, 'top'); drag(hBot, 'bot');
    // dragging the line itself moves both ends
    knifeHit.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      knifeHit.setPointerCapture(e.pointerId);
      var r0 = svg.getBoundingClientRect(), l0 = view.toLogical(e.clientX - r0.left, e.clientY - r0.top), t0 = top, b0 = bot;
      function move(ev) {
        var l = view.toLogical(ev.clientX - r0.left, ev.clientY - r0.top), dx = Math.round((l.x - l0.x) / 10) * 10;
        var lo = Math.min(t0, b0), hi = Math.max(t0, b0);
        dx = Math.max(-lo, Math.min(1000 - hi, dx));
        top = t0 + dx; bot = b0 + dx; slTop.set(top); slBot.set(bot); update(0);
      }
      function up() { knifeHit.removeEventListener('pointermove', move); knifeHit.removeEventListener('pointerup', up); knifeHit.removeEventListener('pointercancel', up); }
      knifeHit.addEventListener('pointermove', move); knifeHit.addEventListener('pointerup', up); knifeHit.addEventListener('pointercancel', up);
    });
    function setCut(t, b) { top = t; bot = b; slTop.set(t); slBot.set(b); update(350); }
    fig.querySelector('[data-random]').addEventListener('click', function () {
      var rng = V.rng(Date.now() % 100000), t, b, tries = 0;
      do { t = rng.int(10, 90) * 10; b = rng.int(10, 90) * 10; tries++; }
      while ((function () { var S = g.nodes.filter(function (n) { return (b - t) * n.y - 600 * (n.x - t) > 0; }).length; return S === 0 || S === g.nodes.length; }()) && tries < 30);
      setCut(t, b);
    });
    fig.querySelector('[data-reset]').addEventListener('click', function () { setCut(600, 680); });
    V.toggle(fig.querySelector('[data-mst-toggle]'), { label: 'Show the MST', checked: false, onChange: function (c) { showMst = c; update(250); } });
    V.onResize(wrap, function () { layout(); });
    update(0);
    // the click quiz asks about whatever cut is on screen right now
    V.clickQuiz(host, {
      el: '#quiz-cut', id: 'l30-cut-lightest',
      question: 'Move the cut anywhere you like, then <b>click the lightest road that crosses it</b>.',
      check: function (id) {
        var S = g.nodes.filter(sideOf).map(function (n) { return n.id; });
        var info = M.cutInfo(g, S);
        if (!info.valid || !info.lightest) return { correct: false, message: 'No road crosses this cut. Drag the line so it splits the towns.' };
        if (id === info.lightest.id) return { correct: true, message: 'Yes: ' + L.dash(info.lightest) + ' (' + info.lightest.w + ') is the lightest of the ' + info.crossing.length + ' crossing roads, so some MST contains it. Move the line and try again.' };
        var e = g.edges.filter(function (x) { return M.edgeKey(x.u, x.v) === id; })[0];
        var crosses = info.crossing.some(function (x) { return x.id === id; });
        return { correct: false, message: !crosses ? 'That road does not cross the line: both of its towns are on the same side. Look for the amber roads.' : L.dash(e) + ' crosses, but weighs ' + e.w + ' and a road of weight ' + info.lightest.w + ' also crosses. Find the smallest amber weight.' };
      }
    });
  }

  /* ================================================================== boot */
  V.ready(function () {
    heroTeaser();
    L.lazy('#fig-problem', problemFigure);
    var mr = V.$('#mini-tree'); if (mr) L.lazy(mr, treeMinis);
    L.lazy('#fig-gallery', treeGallery);
    L.lazy('#fig-cut', cutExplorer);
    L.lazy('#fig-cycle-test', cycleTest);
  });
}());
