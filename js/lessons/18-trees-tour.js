/* Lesson 18 · Trees & traversals — shared helpers and the Euler-tour layer.

   VDSA.lesson18.tourLayer(view, tree, opts)  draws the Euler tour on top of a VDSA.views.tree view: a dashed path that
   walks around the tree, three dots per node (left = preorder, bottom = inorder, right = postorder) and a token that
   travels along the path. It reads node positions from view.positionOf, so it follows the tree layout, and it rebuilds
   itself when the layout changes (resize, new tree).
   VDSA.lesson18.hits(view, tree)             invisible, focusable hit circles with data-id, for VDSA.clickQuiz.
   VDSA.lesson18.mini(el, tree, opts)         a small static tree.
   VDSA.lesson18.nearView / legend / treeFigure   small helpers shared by the lesson's files.

   Heavy figures start when they come within ~600px of the viewport. Append ?all to the URL to start them all at once
   (used for full-page screenshots). */
(function () {
  'use strict';
  var V = window.VDSA, A = V.algos.lesson18, L = V.lesson18 = V.lesson18 || {};
  var EAGER = /[?&]all\b/.test(location.search);

  /* ================================================================== helpers */
  function nearView(el, fn) {
    if (!el) return;
    function run() { try { fn(); } catch (e) { console.error('[lesson 18] figure failed', el.id, e); } }
    if (EAGER || !('IntersectionObserver' in window)) { run(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && !done) { done = true; io.disconnect(); run(); } });
    }, { rootMargin: '600px 0px 600px 0px' });
    io.observe(el);
  }
  /* SVG element with an optional parent (VDSA.s takes children, not a parent) */
  function mk(tag, attrs, parent) { var el = V.s(tag, attrs); if (parent) parent.appendChild(el); return el; }
  function legend(fig, entries) { var el = fig.querySelector('[data-legend]'); if (el) V.legend(el, entries); }

  var LABELS = {
    visited: 'Visited', depth: 'Stack depth', stackSize: 'Stack size', queueSize: 'Queue length', peak: 'Peak',
    calls: 'Calls', nodes: 'Nodes', edges: 'Edges', pre: 'Preorder', 'in': 'Inorder', post: 'Postorder'
  };
  var TOUR_LEGEND = [
    { state: 'active', shape: 'dot', label: 'left dot: preorder' },
    { state: 'compare', shape: 'dot', label: 'bottom dot: inorder' },
    { state: 'done', shape: 'dot', label: 'right dot: postorder' }
  ];

  function treeState(s) { return { root: s.root, nodes: s.nodes, edges: s.edges || {}, pointers: s.pointers || [] }; }

  /* One tree view driven by one player. */
  function treeFigure(fig, steps, o) {
    o = o || {};
    var view = V.views.tree(fig.querySelector('[data-stage]'), o.view || {});
    view.prepare(steps.map(treeState));
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, c) { view.render(treeState(s), { duration: c.duration }); if (o.onRender) o.onRender(s, c); },
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: LABELS, counterStates: o.counterStates,
      code: o.code, vars: o.vars, flow: o.flow, baseStepMs: o.baseStepMs || 1200, label: o.label || 'Figure controls'
    });
    return {
      view: view, player: player,
      load: function (next) { view.reset(); view.prepare(next.map(treeState)); player.setSteps(next); }
    };
  }

  /* A small static tree. states: {id: state}. */
  function mini(el, tree, o) {
    o = o || {};
    var view = V.views.tree(el, {
      nodeSize: o.nodeSize || 28, gap: o.gap === undefined ? 0.45 : o.gap, showNulls: !!o.showNulls, label: o.label || 'A small tree',
      minNodeSize: o.minNodeSize || 14, describe: o.describe
    });
    var st = o.states || {};
    var state = {
      root: tree.root,
      nodes: tree.order.map(function (id) {
        var n = tree.nodes[id];
        var out = { id: id, value: n.value, left: n.left, right: n.right, state: st[id] || 'default' };
        if (o.badges && o.badges[id] !== undefined) out.badge = o.badges[id];
        if (o.subs && o.subs[id] !== undefined) out.sub = o.subs[id];
        return out;
      }),
      edges: o.edges || {}
    };
    view.prepare([state]);
    view.render(state, { duration: 0 });
    return view;
  }

  /* ================================================================== the Euler tour layer */
  function tourLayer(view, tree, o) {
    o = o || {};
    var svg = view.el, S = mk;
    var stops = A.eulerStops(tree), N = stops.length;
    var underG = S('g', { class: 'tr-tour', 'aria-hidden': 'true' });
    var nodesLayer = view.ctx && view.ctx.layers && view.ctx.layers.nodes;
    if (nodesLayer && nodesLayer.parentNode === svg) svg.insertBefore(underG, nodesLayer); else svg.appendChild(underG);
    var topG = S('g', { class: 'tr-tour-top', 'aria-hidden': 'true' });
    svg.appendChild(topG);
    var segG = S('g', { class: 'tr-tour__segs' }, underG);
    var live = S('path', { class: 'tr-seg tr-seg--live' }, underG);
    var dotG = S('g', { class: 'tr-tour__dots' }, topG);
    var token = S('g', { class: 'tr-token' }, topG);
    S('circle', { class: 'tr-token__halo', r: 11 }, token);
    S('circle', { class: 'tr-token__core', r: 6.5 }, token);

    var pts = [], segs = [], segD = [], segLen = [], dots = [];
    var built = null, u = 0, tween = null, shown = null, dead = false, focus = null;

    function radius() {
      var el = svg.querySelector('.vz-node .vz-shape');
      var hh = el ? parseFloat(el.getAttribute('height')) : NaN;
      return hh > 0 ? hh / 2 : 18;
    }
    function signature() {
      var parts = [];
      for (var i = 0; i < tree.order.length; i++) {
        var p = view.positionOf(tree.order[i]);
        if (!p) return null;
        parts.push(Math.round(p.x) + ',' + Math.round(p.y));
      }
      return parts.join(';') + '|' + Math.round(radius());
    }
    function fmt(n) { return Math.round(n * 100) / 100; }
    function build(sig) {
      built = sig;
      var r = radius(), p0 = view.positionOf(tree.root);
      pts = [{ x: p0.x - r - 16, y: p0.y - r - 14 }];
      stops.forEach(function (s) {
        var p = view.positionOf(s.id);
        var off = s.kind === 'pre' ? { x: -(r + 5), y: 1 } : s.kind === 'in' ? { x: 0, y: r + 7 } : { x: r + 5, y: 1 };
        pts.push({ x: p.x + off.x, y: p.y + off.y, kind: s.kind, id: s.id });
      });
      pts.push({ x: p0.x + r + 16, y: p0.y - r - 14 });
      segG.textContent = ''; dotG.textContent = '';
      segs = []; segD = []; segLen = []; dots = [];
      var k = 1 / 6, i;
      for (i = 0; i <= N; i++) {
        var a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(N + 1, i + 2)];
        var c1 = { x: b.x + (c.x - a.x) * k, y: b.y + (c.y - a.y) * k };
        var c2 = { x: c.x - (d.x - b.x) * k, y: c.y - (d.y - b.y) * k };
        var dd = 'M' + fmt(b.x) + ' ' + fmt(b.y) + 'C' + fmt(c1.x) + ' ' + fmt(c1.y) + ' ' + fmt(c2.x) + ' ' + fmt(c2.y) + ' ' + fmt(c.x) + ' ' + fmt(c.y);
        var el = S('path', { class: 'tr-seg', d: dd }, segG);
        segs.push(el); segD.push(dd);
        var len = 40;
        try { len = el.getTotalLength(); } catch (e) { /* not rendered */ }
        segLen.push(len || 1);
      }
      for (i = 1; i <= N; i++) {
        var q = pts[i];
        dots.push(S('circle', { class: 'tr-dot tr-dot--' + q.kind, cx: fmt(q.x), cy: fmt(q.y), r: 4 }, dotG));
      }
    }
    function sync() {
      if (dead) return false;
      var sig = signature();
      if (sig === null) return false;
      if (sig !== built) build(sig);
      return true;
    }
    function paint(uv) {
      if (!segs.length) return;
      var j = Math.min(N + 1, Math.floor(uv + 1e-6)), f = uv - j, i;
      for (i = 0; i <= N; i++) { var w = i < j; if (segs[i].__w !== w) { segs[i].__w = w; segs[i].classList.toggle('is-walked', w); } }
      if (j <= N && f > 0.002) {
        live.setAttribute('d', segD[j]);
        live.style.strokeDasharray = (f * segLen[j]).toFixed(1) + ' ' + (segLen[j] + 2).toFixed(1);
        live.style.display = '';
      } else live.style.display = 'none';
      for (i = 1; i <= N; i++) { var rch = uv >= i - 1e-6; if (dots[i - 1].__r !== rch) { dots[i - 1].__r = rch; dots[i - 1].classList.toggle('is-reached', rch); } }
      var x, y;
      if (j > N) { x = pts[N + 1].x; y = pts[N + 1].y; }
      else { var pt = segs[j].getPointAtLength(Math.max(0, Math.min(segLen[j], f * segLen[j]))); x = pt.x; y = pt.y; }
      token.setAttribute('transform', 'translate(' + fmt(x) + ' ' + fmt(y) + ')');
    }
    function show(on) {
      if (shown === on) return;
      shown = on;
      underG.style.display = on ? '' : 'none';
      topG.style.display = on ? '' : 'none';
    }
    show(false);

    var api = {
      /* update({pos, ms, focus}): pos null hides the layer; 0 = before the walk; k = at stop k; 3n + 1 = the walk is over */
      update: function (p) {
        if (dead) return;
        if (p.focus !== undefined) {
          var f = p.focus || null;
          if (f !== focus) {
            focus = f;
            ['pre', 'in', 'post'].forEach(function (kind) { topG.classList.toggle('is-dim-' + kind, !!f && f !== kind); });
            topG.classList.toggle('has-focus', !!f);
          }
        }
        if (p.pos === null || p.pos === undefined) { if (tween) { tween.cancel(); tween = null; } show(false); return; }
        if (!sync()) return;
        show(true);
        var target = Math.max(0, Math.min(N + 1, p.pos));
        if (tween) { tween.cancel(); tween = null; }
        var ms = p.ms || 0;
        if (ms <= 0 || Math.abs(target - u) < 1e-6) { u = target; paint(u); return; }
        var u0 = u;
        tween = V.tween(ms, function (t, e) { u = u0 + (target - u0) * e; paint(u); }, { ease: 'inOut' });
        tween.promise.then(function () { u = target; paint(u); }, function () {});
      },
      sync: function () { if (shown && sync()) paint(u); },
      destroy: function () { dead = true; if (tween) tween.cancel(); underG.remove(); topG.remove(); },
      stops: stops
    };
    view.ctx.onResize(function () { if (!dead && shown && sync()) paint(u); });
    return api;
  }

  /* ================================================================== hit circles for clickQuiz */
  function hits(view, tree, o) {
    o = o || {};
    var S = mk, svg = view.el;
    var g = S('g', { class: 'tr-hits' });
    svg.appendChild(g);
    var els = {};
    tree.order.forEach(function (id) {
      var label = o.label ? o.label(id) : 'Node ' + tree.nodes[id].value;
      els[id] = S('circle', { class: 'tr-hit', r: 20, 'data-id': id, 'data-label': label }, g);
    });
    function sync() {
      var el = svg.querySelector('.vz-node .vz-shape');
      var hh = el ? parseFloat(el.getAttribute('height')) : 36;
      tree.order.forEach(function (id) {
        var p = view.positionOf(id);
        if (!p) return;
        els[id].setAttribute('cx', p.x.toFixed(1)); els[id].setAttribute('cy', p.y.toFixed(1)); els[id].setAttribute('r', ((hh || 36) / 2 + 2).toFixed(1));
      });
    }
    sync();
    view.ctx.onResize(sync);
    return { sync: sync, els: els, g: g };
  }

  L.nearView = nearView; L.legend = legend; L.LABELS = LABELS; L.TOUR_LEGEND = TOUR_LEGEND;
  L.treeState = treeState; L.treeFigure = treeFigure; L.mini = mini; L.tourLayer = tourLayer; L.hits = hits;
}());
