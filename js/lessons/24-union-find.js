/* Lesson 24 · Union-find — shared toolkit (forest view, parent-array pair, helpers) and the first figures:
   the hero teaser and the friend-groups figure.
   Part 2 (mechanism figures): js/lessons/24-union-find-figs.js
   Part 3 (the lab and flowcharts): js/lessons/24-union-find-lab.js
   Part 4 (race, charts, percolation, cycles, applications, checks): js/lessons/24-union-find-more.js
   Step generators: js/algos/24-union-find.js (VDSA.algos.unionFind). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var UF = V.algos.unionFind;
  var L = V.L24 = V.L24 || {};
  L.UF = UF;

  /* ================================================================== small helpers */
  L.lazy = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      try { fn(el); } catch (e) { console.error('[lesson 24] figure failed', el.id, e); }
    }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); run(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
    window.addEventListener('beforeprint', run, { once: true });
  };

  /* VDSA.h applies style objects with Object.assign, which drops custom properties such as --sw: set them after. */
  L.legend = function (el, items) {
    el = V.$(el);
    V.legend(el, items);
    var sw = el.querySelectorAll('.legend__swatch');
    items.forEach(function (it, i) { if (it && it.color && sw[i]) sw[i].style.setProperty('--sw', it.color); });
    return el;
  };
  var GROUP_COLORS = ['var(--st-active)', 'var(--st-done)', 'var(--st-pivot)', 'var(--st-frontier)', 'var(--st-visited)', 'var(--st-compare)'];
  L.GROUP_COLORS = GROUP_COLORS;

  L.COUNTER_LABELS = { finds: 'Finds', unions: 'Links made', hops: 'Pointer hops', height: 'Tallest tree' };
  L.COUNTER_STATES = { hops: 'path', height: 'pivot', unions: 'swap' };

  /* Colour index per element per step: groups of two or more get a colour that survives merges (the bigger
     group keeps its colour); singletons stay neutral (null). Computed over a whole trace, in order. */
  L.groupColors = function (parents) {
    var prev = {};
    return parents.map(function (par) {
      var groups = UF.groupsOf(par), next = {}, out = [], used = {}, i;
      for (i = 0; i < par.length; i++) out.push(null);
      var pending = [];
      groups.forEach(function (g) {
        if (g.length < 2) return;
        var best = null;
        g.forEach(function (m) { var o = prev[m]; if (o && (best === null || o.size > best.size)) best = o; });
        if (best && !used[best.c]) { used[best.c] = true; next[g[0]] = { c: best.c, size: g.length }; g.forEach(function (m) { out[m] = best.c; }); }
        else pending.push(g);
      });
      pending.forEach(function (g) {
        var c = 0;
        while (used[c] && c < GROUP_COLORS.length) c++;
        if (c >= GROUP_COLORS.length) c = g[0] % GROUP_COLORS.length;
        used[c] = true; next[g[0]] = { c: c, size: g.length }; g.forEach(function (m) { out[m] = c; });
      });
      prev = next;
      return out;
    });
  };
  L.annotate = function (steps) {
    var cols = L.groupColors(steps.map(function (st) { return st.parent; }));
    steps.forEach(function (st, i) { st.colors = cols[i]; });
    return steps;
  };

  /* ================================================================== forest view */
  /* L.forestView(container, {label, nodeR, maxSlot, minWidth, showRank, onNodeClick})
       .render({parent, rank?, states?, edgeStates?, pointers?, colors?}, {duration})
       .prepare(states)  reserve room for the widest / tallest state of a whole trace
       .reset()  .el  .on('click', fn)
     Nodes keep their identity: they glide to their new tidy position, and an edge whose parent changes slides
     its arrow head from the old parent to the new one. A root shows a small loop: parent[i] = i. */
  L.forestView = function (container, o) {
    o = o || {};
    var host = V.$(container);
    var svg = s('svg', { class: 'vz vz-uf', role: 'img', 'aria-label': o.label || 'Forest of trees' });
    var gEdges = s('g'), gNodes = s('g'), gPtrs = s('g');
    svg.appendChild(gEdges); svg.appendChild(gNodes); svg.appendChild(gPtrs);
    host.appendChild(svg);
    var recs = [], ptrs = {}, reserve = { slots: 0, depth: 0 }, dims = { W: 0, H: 0, r: 0, slot: 0, level: 0 };
    var last = null, anim = null, clickFn = null, lastW = 0;

    function build(n) {
      recs.forEach(function (r) { r.g.remove(); r.edge.remove(); });
      recs = [];
      for (var i = 0; i < n; i++) (function (i) {
        var disc = s('circle', { class: 'vz-shape uf-disc', r: 16 });
        var text = s('text', { class: 'vz-ink vz-value uf-id', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(i));
        var loop = s('path', { class: 'uf-loop-line' });
        var loopHead = s('path', { class: 'uf-loop-head' });
        var loopG = s('g', { class: 'uf-loop' }, loop, loopHead);
        var brect = s('rect', { rx: 7, ry: 7, height: 14 });
        var btext = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        var badge = s('g', { class: 'vz-badge uf-badge' }, brect, btext);
        var g = s('g', { class: 'vz-item uf-node is-default', 'data-id': String(i), 'data-label': 'Element ' + i }, loopG, disc, text, badge);
        var line = s('path', { class: 'vz-line' }), head = s('path', { class: 'vz-head' });
        var edge = s('g', { class: 'vz-edge is-default uf-edge', opacity: 0 }, line, head);
        gNodes.appendChild(g); gEdges.appendChild(edge);
        var rec = { id: i, g: g, disc: disc, text: text, loop: loop, loopHead: loopHead, loopG: loopG, badge: badge, brect: brect, btext: btext,
          edge: edge, line: line, head: head, x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, parTo: -1, parFrom: -1, endFrom: null, lastEnd: null, eo: 0, eoFrom: 0, eoTo: 0, cls: '', root: null, rankTxt: null };
        g.addEventListener('click', function () { if (clickFn) clickFn({ id: i }); });
        recs.push(rec);
      }(i));
    }

    function measure() {
      var w = host.clientWidth || host.getBoundingClientRect().width || 320;
      return Math.max(w, minW());
    }
    /* minSlot: never squeeze nodes closer than this many px per leaf slot; the stage scrolls instead */
    function minW() {
      var padX = o.pointers === false ? 16 : 40;
      return Math.max(o.minWidth || 0, o.minSlot ? Math.max(reserve.slots, 1) * o.minSlot + 2 * padX : 0);
    }
    function computeDims(n) {
      var W = measure(), padX = o.pointers === false ? 16 : 40;
      var slots = Math.max(reserve.slots, 1);
      var slot = Math.min(o.maxSlot || 68, (W - 2 * padX) / slots);
      var r = Math.max(8, Math.min(o.nodeR || 20, slot * 0.44));
      var level = Math.min(o.levelH || 76, Math.max(r * 2 + 16, 44));
      var padT = Math.round(r + 20), padB = 12;
      var H = Math.round(padT + reserve.depth * level + r + padB);
      dims = { W: W, H: H, r: r, slot: slot, level: level, padX: padX, padT: padT, n: n };
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.style.minWidth = minW() + 'px';
      var fs = Math.max(11.5, Math.min(15, r * 0.95));
      recs.forEach(function (rec) {
        rec.disc.setAttribute('r', r);
        rec.text.setAttribute('font-size', fs.toFixed(1));
        var lp = 'M' + (-0.45 * r).toFixed(1) + ' ' + (-0.9 * r).toFixed(1) + 'C' + (-r * 1.0).toFixed(1) + ' ' + (-r - 22).toFixed(1) + ' ' + (r * 1.0).toFixed(1) + ' ' + (-r - 22).toFixed(1) + ' ' + (0.45 * r).toFixed(1) + ' ' + (-0.9 * r - 1).toFixed(1);
        rec.loop.setAttribute('d', lp);
        rec.loopHead.setAttribute('d', V.vz.arrowHead(0.45 * r, -0.9 * r - 1, Math.atan2(0.1 * r + 21, -0.55 * r), 6.5));
        rec.brect.setAttribute('x', 0.55 * r); rec.brect.setAttribute('y', -r - 4);
        rec.brect.setAttribute('width', 16);
        rec.btext.setAttribute('x', 0.55 * r + 8); rec.btext.setAttribute('y', -r + 3);
      });
    }
    function targetOf(lay, i) {
      var off = (reserve.slots - lay.width) / 2;
      return { x: dims.padX + (dims.W - 2 * dims.padX - reserve.slots * dims.slot) / 2 + (off + lay.pos[i].x) * dims.slot, y: dims.padT + lay.pos[i].y * dims.level };
    }

    function draw(e) {
      var r = dims.r, i, rec;
      for (i = 0; i < recs.length; i++) {
        rec = recs[i];
        rec.x = rec.fx + (rec.tx - rec.fx) * e; rec.y = rec.fy + (rec.ty - rec.fy) * e;
        rec.g.setAttribute('transform', 'translate(' + rec.x.toFixed(1) + ' ' + rec.y.toFixed(1) + ')');
      }
      for (i = 0; i < recs.length; i++) {
        rec = recs[i];
        var ax = rec.x, ay = rec.y, bx, by, op;
        if (rec.parTo < 0) {
          if (rec.parFrom < 0 || !rec.endFrom) { rec.edge.setAttribute('opacity', 0); rec.lastEnd = null; continue; }
          bx = rec.endFrom.x + (ax - rec.endFrom.x) * e; by = rec.endFrom.y + (ay - rec.endFrom.y) * e; op = 1 - e;
        } else {
          var par = recs[rec.parTo], tx = par.x, ty = par.y;
          if (rec.parFrom === rec.parTo) { bx = tx; by = ty; op = 1; }
          else {
            var sx = rec.parFrom < 0 || !rec.endFrom ? ax : rec.endFrom.x, sy = rec.parFrom < 0 || !rec.endFrom ? ay : rec.endFrom.y;
            bx = sx + (tx - sx) * e; by = sy + (ty - sy) * e; op = rec.parFrom < 0 ? Math.min(1, e * 1.6) : 1;
          }
        }
        var dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
        rec.lastEnd = { x: bx, y: by };
        if (d < r * 2 + 5) { rec.edge.setAttribute('opacity', 0); continue; }
        var ux = dx / d, uy = dy / d;
        var x1 = ax + ux * (r + 1), y1 = ay + uy * (r + 1), x2 = bx - ux * (r + 3), y2 = by - uy * (r + 3);
        rec.line.setAttribute('d', 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + (x2 - ux * 5).toFixed(1) + ' ' + (y2 - uy * 5).toFixed(1));
        rec.head.setAttribute('d', V.vz.arrowHead(x2, y2, Math.atan2(uy, ux), 9));
        rec.edge.setAttribute('opacity', op.toFixed(2));
      }
      Object.keys(ptrs).forEach(function (k) {
        var p = ptrs[k];
        p.x = p.fx + (p.tx - p.fx) * e; p.y = p.fy + (p.ty - p.fy) * e; p.op = p.fo + (p.to - p.fo) * e;
        p.g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
        p.g.setAttribute('opacity', p.op.toFixed(2));
      });
    }

    function describe(st) {
      var gs = UF.groupsOf(st.parent);
      return (o.label || 'Forest') + ': ' + gs.map(function (g) {
        var root = g.filter(function (m) { return st.parent[m] === m; })[0];
        return g.length === 1 ? 'element ' + g[0] + ' alone' : 'root ' + root + ' with ' + g.join(', ');
      }).join('; ') + '.';
    }

    var placed = {};
    function clash(c, pw, name) {
      if (c.x - pw / 2 < 0 || c.x + pw / 2 > dims.W) return true;
      for (var j = 0; j < recs.length; j++) {
        var dx = Math.max(Math.abs(c.x - recs[j].tx) - pw / 2, 0), dy = Math.max(Math.abs(c.y - recs[j].ty) - 9, 0);
        if (dx * dx + dy * dy < (dims.r + 2) * (dims.r + 2)) return true;
      }
      return Object.keys(placed).some(function (o) { var q = placed[o]; return o !== name && Math.abs(c.x - q.x) < (pw + q.w) / 2 + 2 && Math.abs(c.y - q.y) < 20; });
    }

    function render(st, ro) {
      ro = ro || {};
      placed = {};
      var n = st.parent.length;
      var dur = ro.duration === undefined ? 450 : ro.duration;
      if (V.reducedMotion()) dur = 0;
      var fresh = recs.length !== n;
      if (fresh) { build(n); dur = 0; }
      if (anim) { anim.cancel(); anim = null; }
      var lay = UF.forestLayout(st.parent);
      if (lay.width > reserve.slots || lay.depth > reserve.depth || fresh || !dims.W) {
        reserve.slots = Math.max(reserve.slots, lay.width); reserve.depth = Math.max(reserve.depth, lay.depth);
        computeDims(n);
      }
      var rollFrom = dur > 0;
      svg.style.setProperty('--vz-dur', dur + 'ms');
      recs.forEach(function (rec, i) {
        var t = targetOf(lay, i);
        rec.fx = rec.x; rec.fy = rec.y;
        if (fresh || !last) { rec.fx = t.x; rec.fy = t.y; rec.x = t.x; rec.y = t.y; }
        rec.tx = t.x; rec.ty = t.y;
        var np = st.parent[i] === i ? -1 : st.parent[i];
        rec.parFrom = rec.parTo; rec.endFrom = rec.lastEnd;
        if (fresh || !last) { rec.parFrom = np; rec.endFrom = null; }
        rec.parTo = np;
        var isRoot = np < 0;
        var state = (st.states && st.states[i]) || 'default';
        var col = st.colors && st.colors[i] !== null && st.colors[i] !== undefined ? ' uf-g' + st.colors[i] : '';
        var cls = 'vz-item uf-node is-' + state + (isRoot ? ' is-root' : '') + col;
        if (cls !== rec.cls) { rec.g.setAttribute('class', cls); rec.cls = cls; }
        var es = (st.edgeStates && st.edgeStates[i]) || 'default';
        var ecls = 'vz-edge uf-edge is-' + es;
        if (rec.ecls !== ecls) { rec.edge.setAttribute('class', ecls); rec.ecls = ecls; }
        var showRank = st.rank && isRoot && o.showRank !== false;
        rec.badge.setAttribute('opacity', showRank ? 1 : 0);
        if (showRank && rec.rankTxt !== st.rank[i]) { rec.btext.textContent = st.rank[i]; rec.rankTxt = st.rank[i]; }
        rec.loopG.setAttribute('class', 'uf-loop' + (isRoot ? ' is-on' : ''));
      });
      // pointers
      var want = {}, stackAt = {};
      (st.pointers || []).forEach(function (p) {
        want[p.name] = true;
        var rec = recs[p.node]; if (!rec) return;
        var k = stackAt[p.node] = (stackAt[p.node] || 0) + 1;
        var pw = V.vz.textWidth(p.name, 11, true, 700) + 12, r = dims.r;
        // beside the node, under its rank badge; on the other side or below when a neighbour is in the way
        var spots = [[r + 6 + pw / 2, 7], [-r - 6 - pw / 2, 7], [0, r + 14]], t = null;
        var first = null;
        spots.some(function (sp) {
          var c = { x: rec.tx + sp[0], y: rec.ty + sp[1] + (k - 1) * 20 };
          first = first || c;
          if (!clash(c, pw, p.name)) { t = c; return true; }
        });
        t = t || first;
        placed[p.name] = { x: t.x, y: t.y, w: pw };
        var cur = ptrs[p.name];
        if (!cur) {
          var w = V.vz.textWidth(p.name, 11, true, 700) + 12;
          var rect = s('rect', { x: -w / 2, y: -9, width: w, height: 18, rx: 9 });
          var tx = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, p.name);
          var g = s('g', { class: 'uf-ptr is-' + (p.state || (p.name === 'x' ? 'active' : 'compare')) }, rect, tx);
          gPtrs.appendChild(g);
          cur = ptrs[p.name] = { g: g, x: t.x, y: t.y, fx: t.x, fy: t.y, tx: t.x, ty: t.y, op: 0, fo: 0, to: 1, w: w };
        }
        cur.fx = cur.x; cur.fy = cur.y; cur.tx = t.x; cur.ty = t.y; cur.fo = cur.op; cur.to = 1;
        if (fresh || !last) { cur.fx = t.x; cur.fy = t.y; }
      });
      Object.keys(ptrs).forEach(function (k) { if (!want[k]) { ptrs[k].fx = ptrs[k].x; ptrs[k].fy = ptrs[k].y; ptrs[k].tx = ptrs[k].x; ptrs[k].ty = ptrs[k].y; ptrs[k].fo = ptrs[k].op; ptrs[k].to = 0; } });
      svg.setAttribute('aria-label', describe(st));
      last = st;
      if (dur > 0) anim = V.tween(dur, function (t, e) { draw(e); }, { ease: 'inOut' });
      else draw(1);
    }

    var view = {
      el: svg,
      render: render,
      prepare: function (states) {
        states.forEach(function (st) {
          var lay = UF.forestLayout(st.parent);
          reserve.slots = Math.max(reserve.slots, lay.width); reserve.depth = Math.max(reserve.depth, lay.depth);
        });
        if (recs.length) computeDims(recs.length);
      },
      reset: function () { reserve = { slots: 0, depth: 0 }; last = null; Object.keys(ptrs).forEach(function (k) { ptrs[k].g.remove(); }); ptrs = {}; recs.forEach(function (r) { r.cls = ''; r.ecls = ''; r.lastEnd = null; }); },
      on: function (ev, fn) { if (ev === 'click') { clickFn = fn; recs.forEach(function (r) { V.vz.clickable(r.g, 'Element ' + r.id, function () { clickFn({ id: r.id }); }); }); } },
      positionOf: function (i) { return recs[i] ? { x: recs[i].x, y: recs[i].y } : null; },
      refresh: function () { if (last) render(last, { duration: 0 }); },
      destroy: function () { svg.remove(); }
    };
    V.onResize(host, function (r) { if (last && Math.abs(measure() - lastW) > 1) { lastW = measure(); computeDims(recs.length); render(last, { duration: 0 }); } });
    return view;
  };

  /* ================================================================== forest + parent array, linked */
  /* L.pair(container, {label, showRank, array: true, minWidth}) -> {render(step, ctx), prepare(steps), reset(), forest, array} */
  L.pair = function (container, o) {
    o = o || {};
    var host = V.$(container);
    var fHost = h('div', { class: 'uf-pair__forest' }), aHost = h('div', { class: 'uf-pair__array' });
    host.classList.add('uf-pair');
    host.appendChild(fHost);
    if (o.array !== false) host.appendChild(aHost);
    var forest = L.forestView(fHost, { label: o.label || 'Forest', minWidth: o.minWidth || 0, minSlot: o.minSlot, showRank: o.showRank, maxSlot: o.maxSlot, nodeR: o.nodeR, pointers: o.pointers, levelH: o.levelH });
    var arr = o.array === false ? null : V.views.array(aHost, { mode: 'boxes', label: (o.label || 'Forest') + ': parent array', cellSize: 44, outerPointers: false });
    function fstate(st) { return { parent: st.parent, rank: o.showRank === false ? null : st.rank, states: st.states, edgeStates: st.edgeStates, pointers: st.pointers, colors: st.colors }; }
    function astate(st) {
      var showRank = o.showRank !== false && st.rank;
      return {
        label: 'parent',
        items: st.parent.map(function (p, i) {
          var it = { id: 'c' + i, value: p, state: (st.states && st.states[i]) || 'default' };
          if (showRank && st.parent[i] === i) it.badge = st.rank[i];
          return it;
        }),
        pointers: (st.pointers || []).filter(function (p) { return p.name === 'x' || p.name === 'ra' || p.name === 'rb' || p.name === 'ra = rb'; })
          .map(function (p) { return { name: p.name, index: p.node, state: p.name === 'x' ? 'active' : 'compare', side: 'below', id: 'p-' + p.name }; })
      };
    }
    return {
      forest: forest, array: arr, el: host,
      render: function (st, ctx) {
        var d = ctx && ctx.duration !== undefined ? ctx.duration : 450;
        forest.render(fstate(st), { duration: d });
        if (arr) arr.render(astate(st), { duration: d });
      },
      prepare: function (steps) {
        forest.prepare(steps.map(fstate));
        if (arr) { arr.reset(); arr.prepare(steps.map(astate)); }
      },
      reset: function () { forest.reset(); if (arr) arr.reset(); }
    };
  };

  /* A figure driven by a player: forest + array, captions, controls, counters, legend. Returns {player, pair}. */
  L.pairFigure = function (fig, cfg) {
    var stage = fig.querySelector('[data-stage]');
    var pair = L.pair(stage, { label: cfg.label, showRank: cfg.showRank, array: cfg.array, minWidth: cfg.minWidth });
    var steps = L.annotate(cfg.steps);
    pair.prepare(steps);
    if (cfg.legend) L.legend(fig.querySelector('[data-legend]'), cfg.legend);
    var opts = {
      root: fig, steps: steps, render: function (st, ctx) { pair.render(st, ctx); },
      caption: fig.querySelector('[data-caption]'), baseStepMs: cfg.baseStepMs || 1100, label: cfg.controlsLabel || 'Figure controls'
    };
    var cnt = fig.querySelector('[data-counters]');
    if (cnt) { opts.counters = cnt; opts.counterLabels = cfg.counterLabels || L.COUNTER_LABELS; opts.counterStates = L.COUNTER_STATES; }
    var player = V.player(opts);
    return { player: player, pair: pair, setSteps: function (st, o2) { st = L.annotate(st); pair.reset(); pair.prepare(st); player.setSteps(st, o2); return st; } };
  };

  /* Tag the forest nodes so VDSA.clickQuiz can target them. (forestView already sets data-id / data-label.) */

  /* ================================================================== hero teaser: dots merge into coloured groups */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var cs0 = getComputedStyle(stage);
    var W = Math.round(stage.clientWidth - parseFloat(cs0.paddingLeft) - parseFloat(cs0.paddingRight)) || 460;
    var H = Math.round(stage.clientHeight - parseFloat(cs0.paddingTop) - parseFloat(cs0.paddingBottom)) || 300;
    var narrow = W < 500, N = narrow ? 12 : 16, lap = 0, MX = 46, MY = 42, MIND = narrow ? 46 : 62;   /* the dots fill the stage at its own aspect; margins leave room for the group halos */
    var svg = s('svg', { class: 'uf-hero', viewBox: '0 0 ' + W + ' ' + H, role: 'presentation' });
    stage.appendChild(svg);
    var gHalo = s('g'), gDots = s('g');
    svg.appendChild(gHalo); svg.appendChild(gDots);
    var live = s('text', { class: 'uf-hero-live', x: W / 2, y: H - 8, 'text-anchor': 'middle' }, '');
    svg.appendChild(live);
    var halos = [], dots = [];
    for (var i = 0; i < N; i++) {
      var hc = s('circle', { class: 'uf-hero-halo', cx: 0, cy: 0, r: 0, opacity: 0 });
      gHalo.appendChild(hc); halos.push(hc);
      var dc = s('circle', { class: 'uf-hero-dot', r: narrow ? 9 : 12, cx: 0, cy: 0 });
      var dg = s('g', null, dc); gDots.appendChild(dg); dots.push({ g: dg, c: dc });
    }
    function scatter(seed) {
      var rng = V.rng(seed), pts = [], guard = 0;
      while (pts.length < N && guard++ < 4000) {
        var p = [MX + rng() * (W - 2 * MX), MY + rng() * (H - 2 * MY)];
        if (pts.every(function (q) { return Math.hypot(p[0] - q[0], p[1] - q[1]) > MIND; })) pts.push(p);
      }
      while (pts.length < N) pts.push([MX + rng() * (W - 2 * MX), MY + rng() * (H - 2 * MY)]);
      return pts;
    }
    /* Nearest-first merging (single linkage): the same order Kruskal would use. */
    function make(seed) {
      var pts = scatter(seed), d = new UF.DSU(N, { byRank: true, compress: 'full' });
      var pairs = [];
      for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) pairs.push([a, b, Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1])]);
      pairs.sort(function (p, q) { return p[2] - q[2]; });
      var steps = [{ parent: d.parent.slice(), pts: pts }];
      for (var k = 0; k < pairs.length && d.groups().length > 3; k++) {
        if (d.union(pairs[k][0], pairs[k][1])) steps.push({ parent: d.parent.slice(), pts: pts, link: pairs[k] });
      }
      var cols = L.groupColors(steps.map(function (st) { return st.parent; }));
      steps.forEach(function (st, i) { st.colors = cols[i]; });
      return steps;
    }
    function layout(st) {
      var gs = UF.groupsOf(st.parent), pos = new Array(N), halo = [], items = [];
      gs.forEach(function (g) {
        var cx = 0, cy = 0;
        g.forEach(function (m) { cx += st.pts[m][0]; cy += st.pts[m][1]; });
        cx /= g.length; cy /= g.length;
        var rr = g.length === 1 ? 0 : 8 + 5.2 * g.length;
        items.push({ g: g, cx: cx, cy: cy, rr: rr, r: g.length === 1 ? (narrow ? 14 : 18) : rr + 18 });
      });
      /* relaxation: push overlapping groups (and halos) apart, then keep each one inside the stage, clear of the caption line */
      var capH = 26;
      for (var it = 0; it < 60; it++) {
        var moved = false;
        for (var a = 0; a < items.length; a++) for (var b = a + 1; b < items.length; b++) {
          var A = items[a], B = items[b], dx = B.cx - A.cx, dy = B.cy - A.cy, dd = Math.hypot(dx, dy), need = A.r + B.r + 4;
          if (dd < need) {
            if (dd < 0.01) { dx = 1; dy = 0; dd = 1; }
            var push = (need - dd) / 2 + 0.01;
            A.cx -= dx / dd * push; A.cy -= dy / dd * push; B.cx += dx / dd * push; B.cy += dy / dd * push; moved = true;
          }
        }
        items.forEach(function (q) {
          q.cx = Math.min(Math.max(q.cx, Math.min(q.r + 4, W / 2)), Math.max(W - q.r - 4, W / 2));
          q.cy = Math.min(Math.max(q.cy, Math.min(q.r + 4, (H - capH) / 2)), Math.max(H - capH - q.r - 4, (H - capH) / 2));
        });
        if (!moved) break;
      }
      items.forEach(function (q) {
        if (q.g.length === 1) { pos[q.g[0]] = [q.cx, q.cy]; return; }
        q.g.forEach(function (m, k) { var ang = -Math.PI / 2 + (k / q.g.length) * Math.PI * 2; pos[m] = [q.cx + Math.cos(ang) * q.rr, q.cy + Math.sin(ang) * q.rr]; });
        halo.push({ min: q.g[0], cx: q.cx, cy: q.cy, r: q.r, c: st.colors[q.g[0]] });
      });
      return { pos: pos, halo: halo, groups: gs.length };
    }
    function render(st, ctx) {
      var lay = layout(st), d = ctx.duration;
      var unions = N - lay.groups;
      live.textContent = lay.groups + (lay.groups === 1 ? ' group' : ' groups') + ' \u00b7 ' + unions + (unions === 1 ? ' union' : ' unions');
      var byMin = {};
      lay.halo.forEach(function (hh) { byMin[hh.min] = hh; });
      for (var i = 0; i < N; i++) {
        V.animate(dots[i].g, { x: lay.pos[i][0], y: lay.pos[i][1] }, { duration: d, ease: 'inOut' });
        var c = st.colors[i];
        dots[i].c.setAttribute('class', 'uf-hero-dot' + (c === null ? '' : ' uf-g' + c));
        var hc = halos[i], hh = byMin[i];
        if (hh) {
          hc.setAttribute('class', 'uf-hero-halo uf-g' + hh.c);
          V.animate(hc, { attr: { cx: hh.cx, cy: hh.cy, r: hh.r }, opacity: 1 }, { duration: d, ease: 'inOut' });
        } else V.animate(hc, { opacity: 0 }, { duration: d, ease: 'inOut' });
      }
    }
    var first = make(11);
    V.teaser(stage, {
      steps: first, render: render, stepMs: 640, holdMs: 1900, loop: true, instantWrap: true,
      regenerate: function () { lap++; return make(11 + lap * 7); }
    });
  }

  /* ================================================================== the problem: friend groups you can build */
  var PEOPLE = ['Ana', 'Ben', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];
  var POS = [[0.10, 0.28], [0.29, 0.14], [0.47, 0.30], [0.66, 0.15], [0.88, 0.30], [0.12, 0.74], [0.33, 0.86], [0.53, 0.70], [0.74, 0.86], [0.91, 0.70]];
  var PRESET_FRIENDS = [[0, 1], [1, 2], [2, 8], [3, 4], [5, 6], [6, 7]];

  function groupsFigure(fig) {
    var stage = fig.querySelector('[data-stage]');
    var cap = fig.querySelector('[data-caption]');
    var selA = fig.querySelector('[data-a]'), selB = fig.querySelector('[data-b]'), out = fig.querySelector('[data-answer]');
    var N = PEOPLE.length, H = 270;
    var svg = s('svg', { class: 'uf-groups', role: 'group', 'aria-label': 'Ten people. Click two people to make them friends.' });
    stage.appendChild(svg);
    var gL = s('g'), gN = s('g');
    svg.appendChild(gL); svg.appendChild(gN);
    var d, friends, picked = null, W = 600;
    var nodes = PEOPLE.map(function (nm, i) {
      var c = s('circle', { class: 'uf-person-disc', r: 20 });
      var t = s('text', { class: 'uf-person-name', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, nm);
      var ring = s('circle', { class: 'uf-person-ring', r: 26 });
      var g = s('g', { class: 'uf-person', 'data-id': String(i), 'data-label': nm }, ring, c, t);
      V.vz.clickable(g, nm + '. Click to pick a friend for this person.', function () { pick(i); });
      gN.appendChild(g);
      return { g: g, c: c, t: t, ring: ring };
    });
    var lines = [];
    function px(i) { return [POS[i][0] * (W - 80) + 40, POS[i][1] * (H - 70) + 35]; }
    function layout() {
      W = Math.max(280, stage.clientWidth || 600);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
      var r = W < 460 ? 15 : 20;
      nodes.forEach(function (n, i) {
        var p = px(i);
        n.g.setAttribute('transform', 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')');
        n.c.setAttribute('r', r); n.ring.setAttribute('r', r + 6);
        n.t.setAttribute('y', r + 15); n.t.setAttribute('font-size', W < 460 ? 11 : 13);
      });
      lines.forEach(function (l) { placeLine(l); });
    }
    function placeLine(l) {
      var a = px(l.a), b = px(l.b);
      l.el.setAttribute('x1', a[0]); l.el.setAttribute('y1', a[1]); l.el.setAttribute('x2', b[0]); l.el.setAttribute('y2', b[1]);
      l.el.style.setProperty('--len', Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(0));
    }
    function paint() {
      var par = d.parent.slice();
      var cols = L.groupColors([par])[0];
      nodes.forEach(function (n, i) {
        n.c.setAttribute('class', 'uf-person-disc' + (cols[i] === null ? '' : ' uf-g' + cols[i]));
        n.g.classList.toggle('is-picked', picked === i);
      });
      lines.forEach(function (l) { l.el.setAttribute('class', 'uf-friend uf-g' + (cols[l.a] === null ? 0 : cols[l.a])); });
      answer();
    }
    function answer() {
      var a = +selA.value, b = +selB.value;
      var same = sameGroup(a, b);
      out.className = 'uf-answer ' + (same ? 'is-yes' : 'is-no');
      out.innerHTML = same ? '<b>Yes.</b> ' + PEOPLE[a] + ' and ' + PEOPLE[b] + ' are in the same group.' : '<b>No.</b> No chain of friendships joins ' + PEOPLE[a] + ' and ' + PEOPLE[b] + '.';
    }
    function sameGroup(a, b) { return d.find(a) === d.find(b); }
    function addFriend(a, b) {
      var already = sameGroup(a, b);
      var el = s('line', { class: 'uf-friend' });
      var l = { a: a, b: b, el: el };
      lines.push(l); gL.appendChild(el); placeLine(l);
      d.union(a, b); friends.push([a, b]);
      return already;
    }
    function pick(i) {
      if (picked === null) { picked = i; cap.innerHTML = '<b>' + PEOPLE[i] + '</b> picked. Now click someone to make them friends.'; paint(); return; }
      if (picked === i) { picked = null; cap.innerHTML = 'Selection cleared. Click two people to make them friends.'; paint(); return; }
      var a = picked; picked = null;
      var already = groupsBefore(a, i);
      addFriend(a, i);
      cap.innerHTML = already
        ? '<b>' + PEOPLE[a] + ' and ' + PEOPLE[i] + '</b> were already connected through a chain of friends, so this friendship does not merge anything. (In a graph, this edge closes a cycle.)'
        : '<b>' + PEOPLE[a] + ' and ' + PEOPLE[i] + '</b> become friends, so their two groups merge into one and share a colour.';
      paint();
    }
    function groupsBefore(a, b) { return d.find(a) === d.find(b); }
    function reset(list, msg) {
      d = new UF.DSU(N, { byRank: true, compress: 'full' }); friends = []; picked = null;
      lines.forEach(function (l) { l.el.remove(); }); lines = [];
      (list || []).forEach(function (p) { addFriend(p[0], p[1]); });
      cap.innerHTML = msg || 'Click two people to make them friends.';
      paint();
    }
    PEOPLE.forEach(function (nm, i) { selA.appendChild(h('option', { value: i }, nm)); selB.appendChild(h('option', { value: i }, nm)); });
    selA.value = '0'; selB.value = '8';
    selA.addEventListener('change', answer); selB.addEventListener('change', answer);
    fig.querySelector('[data-reset]').addEventListener('click', function () { reset([], 'Everyone is alone again. Click two people to make them friends.'); });
    fig.querySelector('[data-preset]').addEventListener('click', function () { reset(PRESET_FRIENDS, 'Six friendships so far. Try the question box, then add your own.'); });
    fig.querySelector('[data-random]').addEventListener('click', function () {
      var rng = V.rng(Date.now() % 100000), a, b, tries = 0;
      do { a = rng.int(0, N - 1); b = rng.int(0, N - 1); tries++; } while ((a === b || sameGroup(a, b)) && tries < 60);
      if (a === b) return;
      picked = null; var already = addFriend(a, b);
      cap.innerHTML = '<b>' + PEOPLE[a] + ' and ' + PEOPLE[b] + '</b> become friends: two groups merge.';
      paint();
    });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Alone' }, { state: 'active', label: 'A group (colour = group)' }, { state: 'default', shape: 'line', label: 'Friendship' }]);
    layout();
    reset(PRESET_FRIENDS, 'Six friendships so far. Try the question box, then add your own.');
    V.onResize(stage, function () { layout(); });
  }

  V.ready(function () {
    heroTeaser();
    L.lazy('#fig-groups', groupsFigure);
  });
}());
