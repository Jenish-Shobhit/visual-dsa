/* Lesson 21 — shared views and helpers for the heap figures.
   Loaded before 21-heaps-labs.js, 21-heaps-more.js and 21-heaps.js.

     L21.pair(stage, opts)         a tree view above an array view, driven by ONE step with the same ids.
                                   Hover a node and its array cell lights up (and the other way round).
                                   render(step, ctx), prepare(steps), reset(), setHot(id), onHover(fn), on('click', fn)
     L21.miniTree(values, opts)    a small static SVG complete tree (thumbnails, click quiz); nodes carry data-id
     L21.miniCells(values, opts)   a small static SVG array row
     L21.whenNear(el, fn)          run fn once when el comes near the viewport (lazy figures)
     L21.fmt(v)                    numbers with a real minus sign
     L21.LEG                       shared legend entries */
(function () {
  'use strict';
  var V = window.VDSA, vz = V.vz, h = V.h, s = V.s;
  var L21 = V.lessons = V.lessons || {};
  L21 = V.lessons.l21 = V.lessons.l21 || {};

  L21.fmt = function (v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); };

  /* Keep a lab's side column from growing and shrinking as the variables panel gains and loses rows: reserve the height of the
     fullest step of the current trace (and never give height back if a row ever wraps taller than planned). */
  L21.holdVars = function (fig, player) {
    var panel = fig && fig.querySelector('.vars');
    if (!panel || !player) return;
    var floor = 0, rowH = 0, base = 0;
    function bump(px) { if (px > floor + 1) { floor = px; panel.style.minHeight = Math.ceil(px) + 'px'; } }
    function plan(steps) {
      var list = panel.querySelector('.vars__list'), rows = panel.querySelectorAll('.vars__row').length;
      if (!rowH && list && rows) { rowH = list.getBoundingClientRect().height / rows; base = panel.getBoundingClientRect().height - list.getBoundingClientRect().height; }
      if (!rowH) rowH = 34.7;
      if (!base) base = 42;
      var most = 0;
      (steps || []).forEach(function (st) { most = Math.max(most, Object.keys(st.vars || {}).length); });
      if (most) bump(base + most * rowH + 4);
    }
    var set = player.setSteps;
    player.setSteps = function (steps) { plan(steps); return set.apply(this, arguments); };
    plan(player.steps);
    if (window.ResizeObserver) new ResizeObserver(function () { bump(panel.getBoundingClientRect().height); }).observe(panel);
  };

  L21.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 21] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  L21.LEG = {
    key: { state: 'key', label: 'Value being moved' },
    compare: { state: 'compare', label: 'Being compared' },
    swap: { state: 'swap', label: 'Just swapped' },
    found: { state: 'found', label: 'Top (returned)' },
    visited: { state: 'visited', label: 'Already a valid sub-heap' },
    done: { state: 'done', label: 'Final (sorted)' },
    hover: { state: 'active', label: 'Hover: same item in both views' },
    frontier: { state: 'frontier', label: 'In the heap' },
    muted: { state: 'muted', label: 'Dropped or used' }
  };

  /* ------------------------------------------------------------------ the linked pair */
  /* opts: nodeSize, cellSize, label, clickable, index (tree sub labels), map(step) -> {tree, array} custom states,
           arrayOptions, treeOptions */
  L21.pair = function (stage, opts) {
    opts = opts || {};
    stage = V.$(stage);
    var H = V.algos.heap;
    var wrap = h('div', { class: 'l21-pair' + (opts.bare ? ' l21-pair--bare' : '') });
    var treeEl = h('div', { class: 'l21-tree' });
    var arrEl = h('div', { class: 'l21-array' });
    wrap.appendChild(treeEl); wrap.appendChild(arrEl);
    stage.appendChild(wrap);
    var label = opts.label || 'Heap';
    var tree = V.views.tree(treeEl, Object.assign({ nodeSize: opts.nodeSize || 38, minNodeSize: 14, label: label + ', drawn as a tree' }, opts.treeOptions || {}));
    var arr = V.views.array(arrEl, Object.assign({ mode: 'boxes', cellSize: opts.cellSize || 44, showIndices: opts.showIndices !== false, label: label + ', stored as an array' }, opts.arrayOptions || {}));
    var cur = null, hot = null, hotHandlers = [], busyUntil = 0, clickHandlers = [];
    var api = { tree: tree, array: arr, el: wrap };

    function mapStep(step) {
      if (opts.map) return opts.map(step);
      var t = H.treeState(step, { index: opts.index !== false, pointers: opts.treePointers === true });
      return { tree: t, array: { items: step.items, pointers: opts.pointers === false ? [] : (step.pointers || []), regions: opts.pointers === false ? [] : (step.regions || []) } };
    }
    function hotify(m) {
      if (hot === null) return m;
      var t = Object.assign({}, m.tree, { nodes: m.tree.nodes.map(function (n) { return String(n.id) === hot && (n.state || 'default') === 'default' ? Object.assign({}, n, { state: 'active' }) : n; }) });
      var a;
      function fix(items) { return items.map(function (it) { return it && String(it.id) === hot && (it.state || 'default') === 'default' ? Object.assign({}, it, { state: 'active' }) : it; }); }
      if (m.array.rows) a = Object.assign({}, m.array, { rows: m.array.rows.map(function (r) { return Object.assign({}, r, { items: fix(r.items) }); }) });
      else a = Object.assign({}, m.array, { items: fix(m.array.items) });
      return { tree: t, array: a };
    }
    function draw(dur) {
      if (!cur) return;
      var m = hotify(mapStep(cur));
      tree.render(m.tree, { duration: dur });
      arr.render(m.array, { duration: dur });
    }
    api.render = function (step, ctx) {
      cur = step;
      var dur = ctx && ctx.duration !== undefined ? ctx.duration : 0;
      busyUntil = Date.now() + dur + 60;
      draw(dur);
    };
    api.prepare = function (steps) {
      var ms = steps.map(mapStep);
      tree.prepare(ms.map(function (m) { return m.tree; }));
      if (arr.prepare) arr.prepare(ms.map(function (m) { return m.array; }));
    };
    /* the tree never gives height back (a trace that ends on an empty or tiny heap would otherwise shrink the figure at its last step) */
    var treeMin = 0;
    if (window.ResizeObserver) new ResizeObserver(function () {
      var hh = Math.ceil(treeEl.getBoundingClientRect().height);
      if (hh > treeMin + 1) { treeMin = hh; treeEl.style.minHeight = hh + 'px'; }
    }).observe(treeEl);
    api.reset = function () { tree.reset(); if (arr.reset) arr.reset(); hot = null; treeMin = 0; treeEl.style.minHeight = ''; };
    api.step = function () { return cur; };
    api.setHot = function (id) {
      var v = id === null || id === undefined ? null : String(id);
      if (v === hot) return;
      hot = v;
      if (Date.now() < busyUntil) return;          // never cut an animation short
      draw(120);
    };
    api.onHover = function (fn) { hotHandlers.push(fn); return api; };
    api.on = function (evt, fn) { if (evt === 'click') { clickHandlers.push(fn); ensureClickable(); } return api; };

    /* nearest node / cell to the pointer, by the views' own positions */
    function nearest(view, ev, isArray) {
      if (!cur) return null;
      var n = isArray ? cur.items.length : (cur.size === undefined ? cur.items.length : cur.size);
      if (opts.rowsOnly) return null;
      var p = vz.pointer(view.el, ev), best = null, bd = 1e9, ids = cur.order || cur.items.map(function (i) { return i.id; });
      var spacing = 44;
      if (isArray && n > 1) {
        var a0 = view.positionOf(ids[0]), a1 = view.positionOf(ids[1]);
        if (a0 && a1) spacing = Math.max(16, Math.abs(a1.x - a0.x));
      }
      for (var i = 0; i < n; i++) {
        var pos = view.positionOf(ids[i]);
        if (!pos) continue;
        var dx = Math.abs(pos.x - p.x), dy = Math.abs(pos.y - p.y), d = Math.hypot(dx, dy);
        if (isArray ? (dx <= spacing / 2 && dy <= spacing / 2 + 4) : d <= (opts.nodeSize || 38) / 2 + 3) { if (d < bd) { bd = d; best = i; } }
      }
      return best === null ? null : { index: best, id: ids[best] };
    }
    function hover(view, isArray) {
      function move(ev) {
        var hit = nearest(view, ev, isArray);
        api.setHot(hit ? hit.id : null);
        hotHandlers.forEach(function (fn) { fn(hit ? hit.index : null, hit ? hit.id : null); });
      }
      view.el.addEventListener('pointermove', move);
      view.el.addEventListener('pointerleave', function () {
        api.setHot(null);
        hotHandlers.forEach(function (fn) { fn(null, null); });
      });
    }
    hover(tree, false); hover(arr, true);
    var clickable = false;
    function ensureClickable() {
      if (clickable) return;
      clickable = true;
      function fire(e) {
        var ids = cur && (cur.order || cur.items.map(function (i) { return i.id; }));
        var idx = ids ? ids.indexOf(String(e.id)) : -1;
        if (idx < 0 && e.index !== undefined) idx = e.index;
        clickHandlers.forEach(function (fn) { fn(idx, e.id); });
      }
      tree.on('click', fire);
      arr.on('click', fire);
    }
    return api;
  };

  /* ------------------------------------------------------------------ static minis */
  /* Complete binary tree of values[0..n-1]. opts: states {index: state}, edgeStates {index: state} (edge from parent),
     r (node radius), w (svg width), ids (data-id + data-label for click quizzes), indices (show index labels), label */
  L21.miniTree = function (values, o) {
    o = o || {};
    var n = values.length, R = o.r || 15, LV = o.levelH || 46, depth = Math.floor(Math.log2(Math.max(1, n)));
    var leaves = Math.pow(2, depth), W = o.w || Math.max(150, leaves * (R * 2 + 12) + 12), PADT = 8 + (o.tags ? 12 : 0);
    var H = PADT + depth * LV + R * 2 + 6 + (o.indices ? 14 : 0);
    var svg = s('svg', { class: 'l21m', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || ('Tree of ' + n + ' values: ' + values.join(', ')) });
    svg.style.maxWidth = (o.maxW || W * 1.3) + 'px';
    function pos(i) {
      var d = Math.floor(Math.log2(i + 1)), j = i - (Math.pow(2, d) - 1), per = Math.pow(2, d);
      return { x: W * (j + 0.5) / per, y: PADT + R + d * LV };
    }
    var eg = s('g', { class: 'l21m-edges' }), ng = s('g', { class: 'l21m-nodes' });
    svg.appendChild(eg); svg.appendChild(ng);
    for (var i = 1; i < n; i++) {
      var a = pos((i - 1) >> 1), b = pos(i);
      eg.appendChild(s('line', { class: 'l21m-edge is-' + ((o.edgeStates && o.edgeStates[i]) || 'default'), x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
    }
    values.forEach(function (v, i) {
      var p = pos(i), st = (o.states && o.states[i]) || 'default';
      var g = s('g', { class: 'l21m-node is-' + st, transform: 'translate(' + p.x + ' ' + p.y + ')',
        'data-id': o.ids ? String(i) : null, 'data-label': o.ids ? (o.idLabel ? o.idLabel(v, i) : 'Node ' + v + ' at index ' + i) : null },
        s('circle', { r: R }),
        s('text', { class: 'l21m-val', y: 1, style: 'font-size:' + Math.round(R * 0.95) + 'px' }, L21.fmt(v)));
      if (o.indices) g.appendChild(s('text', { class: 'l21m-idx', y: R + 12 }, i));
      ng.appendChild(g);
    });
    (o.tags || []).forEach(function (t) {
      var p = pos(t.at);
      svg.appendChild(s('text', { class: 'l21m-tag', x: p.x, y: p.y - R - 4, 'text-anchor': 'middle' }, t.text));
    });
    return svg;
  };

  /* Array row. opts: states, size, pitch, index, tags [{at, text}], ids, idLabel, label */
  L21.miniCells = function (values, o) {
    o = o || {};
    var C = o.size || 30, P = o.pitch || C + 6, PAD = 6, TOP = o.tags ? 24 : 6;
    var W = PAD * 2 + values.length * P - (P - C), H = TOP + C + (o.index ? 18 : 6);
    var svg = s('svg', { class: 'l21m', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || ('Array ' + values.join(', ')) });
    svg.style.maxWidth = (W * 1.5) + 'px';
    values.forEach(function (v, i) {
      var st = (o.states && o.states[i]) || 'default';
      var g = s('g', { class: 'l21m-node l21m-cell is-' + st, transform: 'translate(' + (PAD + i * P) + ' ' + TOP + ')',
        'data-id': o.ids ? String(i) : null, 'data-label': o.ids ? (o.idLabel ? o.idLabel(v, i) : 'Index ' + i + ', value ' + v) : null },
        s('rect', { width: C, height: C, rx: 6 }),
        s('text', { class: 'l21m-val', x: C / 2, y: C / 2 + 1, style: 'font-size:' + Math.round(C * 0.5) + 'px' }, L21.fmt(v)));
      if (o.index) g.appendChild(s('text', { class: 'l21m-idx', x: C / 2, y: C + 13 }, i));
      svg.appendChild(g);
    });
    (o.tags || []).forEach(function (t) {
      svg.appendChild(s('text', { class: 'l21m-tag', x: PAD + t.at * P + C / 2, y: TOP - 6, 'text-anchor': 'middle' }, t.text));
    });
    return svg;
  };
}());
