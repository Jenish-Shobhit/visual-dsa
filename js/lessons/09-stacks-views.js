/* Lesson 09 — custom views and helpers shared by the lesson's figures.
   Loaded before js/lessons/09-stacks-labs.js and js/lessons/09-stacks.js.

     L9.forestView(container, opts)   snapshot view (same contract as VDSA.views.*): a row of expression trees, one per
                                      stack entry, drawn with the numbers on the ground and operators growing upward.
     L9.monoView(container, opts)     snapshot view: bars, arrows drawn from each popped bar to its answer, answer cells.
     L9.stackMini(values, opts)       small static SVG of a stack (summary tiles, variation thumbnails)
     L9.whenNear(el, fn)              run fn once when el comes within ~700px of the viewport (lazy figures)
     L9.viewFor(host, kind, opts)     create a VDSA view and prepare it for a whole trace
     L9.fmt(v)                        numbers with a real minus sign */
(function () {
  'use strict';
  var V = window.VDSA, vz = V.vz;
  var L9 = V.lessons = V.lessons || {};
  L9 = V.lessons.l9 = V.lessons.l9 || {};

  L9.fmt = function (v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); };

  L9.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 09] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  /* ================================================================== forest view */
  L9.forestView = function (container, options) {
    var opts = Object.assign({ levelH: 60, r: 19, label: 'Expression trees' }, options || {});
    var made = vz.createView(container, 'forest', { label: opts.label, className: 'l9-forest' }, draw);
    var ctx = made.ctx, api = made.api, tr = made.tr;
    ctx.layer('edges'); ctx.layer('nodes'); ctx.layer('tags');
    var S = { nodes: new vz.Store(), edges: new vz.Store(), tags: new vz.Store() };
    var reserve = { units: 0, rows: 0 };
    var G = null, emptyEl = null;

    function layout(state) {
      var byId = {}, pos = {}, hgt = {}, cursor = 0, maxH = 0;
      (state.nodes || []).forEach(function (n) { byId[n.id] = n; });
      function height(id) {
        if (hgt[id] !== undefined) return hgt[id];
        var n = byId[id];
        return (hgt[id] = !n || n.left === null || n.left === undefined ? 0 : 1 + Math.max(height(n.left), height(n.right)));
      }
      function place(id) {
        var n = byId[id];
        if (!n) return 0;
        if (n.left === null || n.left === undefined) { pos[id] = { u: cursor, h: 0 }; cursor += 1; return pos[id].u; }
        var a = place(n.left), b = place(n.right);
        pos[id] = { u: (a + b) / 2, h: height(id) };
        maxH = Math.max(maxH, pos[id].h);
        return pos[id].u;
      }
      (state.roots || []).forEach(function (r, k) { if (k) cursor += 0.55; place(r); });
      return { byId: byId, pos: pos, units: cursor, maxH: maxH };
    }

    function geometry(L) {
      var W = ctx.width, pad = 14;
      var units = Math.max(L.units, reserve.units, 3);
      var sw = vz.clamp((W - 2 * pad) / units, 26, 66);
      var r = Math.min(opts.r, sw * 0.44);
      var rows = Math.max(L.maxH, reserve.rows, 1);
      var lh = Math.min(opts.levelH, Math.max(r * 2 + 12, opts.levelH));
      var top = 26;
      var ground = top + rows * lh + r + 2;
      return { W: W, pad: pad, sw: sw, r: r, lh: lh, top: top, ground: ground, height: ground + r + 18,
        x: function (u) { return pad + u * sw + sw / 2; }, y: function (h) { return ground - h * lh; } };
    }

    function buildNode(rec) {
      var g = vz.svg('g', { class: 'vz-item l9-fnode' }, ctx.layers.nodes);
      rec.circle = vz.svg('circle', { class: 'vz-shape', r: 19 }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.chip = vz.svg('g', { class: 'l9-fchip' }, g);
      rec.chipBg = vz.svg('rect', { height: 17, rx: 8.5, y: -8.5 }, rec.chip);
      rec.chipTx = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, rec.chip);
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y, r.cur.s === undefined ? 1 : r.cur.s); vz.opacity(r.el, r.cur.o); };
    }
    function buildEdge(rec) {
      var g = vz.svg('g', { class: 'vz-edge' }, ctx.layers.edges);
      rec.line = vz.svg('path', { class: 'vz-line' }, g);
      rec.el = g;
      rec.paint = paintEdge;
    }
    function buildTag(rec) {
      var g = vz.svg('g', { class: 'l9-ftag' }, ctx.layers.tags);
      vz.svg('rect', { x: -11, y: -9, width: 22, height: 18, rx: 9 }, g);
      rec.txt = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
    }
    function paintEdge(rec) {
      var A = S.nodes.get(rec.src), B = S.nodes.get(rec.dst);
      if (!A || !B || A.cur.x === undefined || B.cur.x === undefined) { vz.set(rec.line, 'd', null); return; }
      var d = vz.shorten(A.cur.x, A.cur.y, B.cur.x, B.cur.y, 0);
      var r = G ? G.r : 19;
      var p1 = vz.shorten(B.cur.x, B.cur.y, A.cur.x, A.cur.y, r + 1), p2 = vz.shorten(A.cur.x, A.cur.y, B.cur.x, B.cur.y, r + 1);
      void d;
      vz.set(rec.line, 'd', 'M' + vz.n2(p1[0]) + ' ' + vz.n2(p1[1]) + 'L' + vz.n2(p2[0]) + ' ' + vz.n2(p2[1]));
      vz.opacity(rec.el, Math.min(rec.cur.o, A.cur.o, B.cur.o));
    }

    function draw(state, ms) {
      state = state || {};
      var L = layout(state);
      G = geometry(L);
      ctx.setHeight(G.height);
      var anim = [];
      function upd(rec, t, from) {
        if (rec.isNew) rec.cur = Object.assign({}, t, from || { o: 0 });
        vz.retarget(rec, t); rec.arc = 0; rec.delay = 0; anim.push(rec);
      }
      if (!emptyEl) emptyEl = vz.svg('text', { class: 'vz-empty', 'text-anchor': 'middle', dy: '.35em' }, ctx.layers.tags);
      vz.text(emptyEl, (state.nodes || []).length ? '' : 'no trees yet');
      vz.set(emptyEl, 'x', vz.n2(ctx.width / 2)); vz.set(emptyEl, 'y', vz.n2(G.ground - G.r));

      S.nodes.begin();
      (state.nodes || []).forEach(function (n) {
        var p = L.pos[n.id];
        if (!p) return;
        var rec = S.nodes.use(String(n.id), buildNode);
        vz.state(rec.el, n.state || 'default');
        var isOp = n.left !== null && n.left !== undefined;
        vz.set(rec.circle, 'r', vz.n2(G.r));
        vz.text(rec.txt, n.label);
        vz.set(rec.txt, 'font-size', n.label.length > 2 ? 12 : 15);
        vz.toggle(rec.chip, 'is-shown', isOp);
        if (isOp) {
          var txt = '= ' + n.value, w = Math.max(30, txt.length * 7 + 12);
          vz.text(rec.chipTx, txt); vz.set(rec.chipBg, 'width', w); vz.set(rec.chipBg, 'x', -w / 2);
          vz.set(rec.chipTx, 'x', 0);
          vz.set(rec.chip, 'transform', 'translate(' + vz.n2(G.r + w / 2 + 3) + ' ' + vz.n2(-G.r * 0.7) + ')');
        }
        vz.set(rec.el, 'data-id', n.id);
        var t = { x: G.x(p.u), y: G.y(p.h), o: 1, s: 1 };
        var from;
        if (isOp && L.pos[n.left] && L.pos[n.right]) {
          var a = S.nodes.get(String(n.left)), b = S.nodes.get(String(n.right));
          var ax = a && a.cur.x !== undefined ? a.cur.x : G.x(L.pos[n.left].u), bx = b && b.cur.x !== undefined ? b.cur.x : G.x(L.pos[n.right].u);
          from = { x: (ax + bx) / 2, y: t.y + G.lh * 0.5, o: 0, s: 0.4 };
        } else from = { x: t.x, y: t.y - 34, o: 0, s: 1 };
        upd(rec, t, from);
      });
      S.nodes.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.arc = 0; anim.push(rec); });

      S.edges.begin();
      (state.nodes || []).forEach(function (n) {
        if (n.left === null || n.left === undefined || !L.pos[n.id]) return;
        [n.left, n.right].forEach(function (c) {
          var rec = S.edges.use(n.id + '>' + c, buildEdge);
          rec.src = String(n.id); rec.dst = String(c);
          vz.state(rec.el, n.state === 'active' ? 'active' : n.state === 'found' ? 'found' : 'default');
          upd(rec, { o: 1 }, { o: 0 });
        });
      });
      S.edges.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = { o: 0 }; anim.push(rec); });

      S.tags.begin();
      var held = state.held;
      if (held) [['a', held.a], ['b', held.b]].forEach(function (pair) {
        var p = L.pos[pair[1]];
        if (!p) return;
        var rec = S.tags.use(pair[0], buildTag);
        vz.text(rec.txt, pair[0]);
        vz.state(rec.el, 'compare');
        upd(rec, { x: G.x(p.u), y: G.y(p.h) - G.r - 15, o: 1 }, { o: 0 });
      });
      S.tags.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); anim.push(rec); });

      var edgeRecs = [];
      S.edges.each(function (r) { edgeRecs.push(r); });
      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) {
          var r = anim[i];
          vz.step(r, vz.local(t, r.delay || 0));
          if (r.paint !== paintEdge) r.paint(r);
        }
        edgeRecs.forEach(function (r) { vz.step(r, vz.local(t, 0)); paintEdge(r); });
      }, function () { Object.keys(S).forEach(function (k) { S[k].purge(); }); });
    }

    api.prepare = function (steps) {
      reserve = { units: 0, rows: 0 };
      (steps || []).forEach(function (s) {
        var L = layout(s);
        reserve.units = Math.max(reserve.units, L.units);
        reserve.rows = Math.max(reserve.rows, L.maxH);
      });
      api.refresh();
      return api;
    };
    api.reset = function () { reserve = { units: 0, rows: 0 }; return api; };
    api.describe = function (state) {
      var nodes = (state && state.nodes) || [], roots = (state && state.roots) || [];
      if (!nodes.length) return 'No expression trees yet.';
      var by = {};
      nodes.forEach(function (n) { by[n.id] = n; });
      function show(id) { var n = by[id]; return n.left === null || n.left === undefined ? n.label : '(' + show(n.left) + ' ' + n.label + ' ' + show(n.right) + ')'; }
      return roots.length + (roots.length === 1 ? ' tree: ' : ' trees, left to right: ') + roots.map(show).join('; ') + '.';
    };
    return api;
  };

  /* ================================================================== monotonic-stack view */
  L9.monoView = function (container, options) {
    var opts = Object.assign({ barHeight: 150, label: 'Bars with arrows to each answer' }, options || {});
    var made = vz.createView(container, 'mono', { label: opts.label, className: 'l9-mono' }, draw);
    var ctx = made.ctx, api = made.api, tr = made.tr;
    ['base', 'bars', 'arrows', 'labels', 'answers', 'pointers'].forEach(function (l) { ctx.layer(l); });
    var S = { bars: new vz.Store(), arrows: new vz.Store(), cells: new vz.Store(), ptrs: new vz.Store(), lbl: new vz.Store() };
    var reserve = { span: 1, max: 0, n: 0 };
    var G = null, baseLine = null, rowLabels = [];

    function geometry(state) {
      var n = state.values.length, W = ctx.width, pad = 12;
      var lm = W >= 520 ? 58 : 0;
      var sw = vz.clamp((W - 2 * pad - lm) / Math.max(n, reserve.n, 1), 20, 64);
      var bw = Math.min(sw * 0.7, 40);
      var maxV = Math.max(reserve.max, Math.max.apply(null, state.values.concat([1])));
      var lane = 26 + Math.min(92, 11 * Math.max(reserve.span, 1));
      var top = 8 + lane;
      var bh = opts.barHeight;
      var base = top + bh + 20;
      var g = { n: n, W: W, pad: pad, lm: lm, sw: sw, bw: bw, maxV: maxV, lane: lane, top: top, bh: bh, base: base,
        idxY: base + 14, ptrY: base + 36, ansY: base + 52 + (lm ? 0 : 12), cw: Math.min(sw * 0.86, 38), ch: 30 };
      g.height = g.ansY + g.ch + 14;
      g.x = function (k) { return pad + lm + (k + 0.5) * sw; };
      g.barTop = function (k) { return base - state.values[k] / maxV * bh; };
      return g;
    }

    function buildBar(rec) {
      var g = vz.svg('g', { class: 'vz-item l9-bar' }, ctx.layers.bars);
      rec.rect = vz.svg('rect', { class: 'vz-shape', rx: 5 }, g);
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
    }
    function buildCell(rec) {
      var g = vz.svg('g', { class: 'vz-item l9-cell' }, ctx.layers.answers);
      rec.rect = vz.svg('rect', { class: 'vz-shape', rx: 7 }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y, r.cur.s === undefined ? 1 : r.cur.s); vz.opacity(r.el, r.cur.o); };
    }
    function buildLabel(rec) {
      rec.el = vz.svg('text', { class: 'vz-label', 'text-anchor': 'middle' }, ctx.layers.labels);
      rec.paint = function (r) { vz.set(r.el, 'x', vz.n2(r.cur.x)); vz.set(r.el, 'y', vz.n2(r.cur.y)); vz.opacity(r.el, r.cur.o); };
    }
    function buildPtr(rec) {
      var g = vz.svg('g', { class: 'vz-pointer' }, ctx.layers.pointers);
      vz.svg('path', { class: 'vz-ptr-head', d: 'M0 0 L-6 9 L6 9 Z' }, g);
      vz.svg('rect', { class: 'vz-ptr-chip', x: -13, y: 9, width: 26, height: 17, rx: 8.5 }, g);
      rec.txt = vz.svg('text', { class: 'vz-ptr-chip-text', 'text-anchor': 'middle', y: 21, dy: '0' }, g);
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
    }
    function buildArrow(rec) {
      var g = vz.svg('g', { class: 'vz-edge l9-arrow' }, ctx.layers.arrows);
      rec.line = vz.svg('path', { class: 'vz-line', pathLength: 1 }, g);
      rec.head = vz.svg('path', { class: 'vz-head' }, g);
      rec.pill = vz.svg('g', { class: 'l9-apill' }, g);
      rec.pillBg = vz.svg('rect', { height: 16, rx: 8, y: -8 }, rec.pill);
      rec.pillTx = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, rec.pill);
      rec.el = g;
      rec.paint = function (r) {
        var p = Math.max(0, Math.min(1, r.cur.p));
        vz.set(r.line, 'stroke-dasharray', '1 1');
        vz.set(r.line, 'stroke-dashoffset', vz.n2(1 - p));
        vz.opacity(r.head, p > 0.86 ? 1 : 0);
        vz.opacity(r.pill, p > 0.6 ? 1 : 0);
        vz.opacity(r.el, p <= 0 ? 0 : 1);
      };
    }

    function draw(state, ms) {
      if (!state.values || !state.values.length) { ctx.setHeight(60); return; }
      G = geometry(state);
      ctx.setHeight(G.height);
      var anim = [];
      function upd(rec, t, from) {
        if (rec.isNew) rec.cur = Object.assign({}, t, from || {});
        vz.retarget(rec, t); rec.arc = 0; rec.delay = 0; anim.push(rec);
      }
      if (!baseLine) {
        baseLine = vz.svg('line', { class: 'l9-baseline' }, ctx.layers.base);
        rowLabels = ['index', 'answer'].map(function (t) { return vz.svg('text', { class: 'vz-caption l9-rowlabel' }, ctx.layers.base); });
      }
      vz.set(baseLine, 'x1', G.pad); vz.set(baseLine, 'x2', G.W - G.pad); vz.set(baseLine, 'y1', G.base); vz.set(baseLine, 'y2', G.base);
      rowLabels.forEach(function (el, k) {
        vz.text(el, G.lm ? ['index', 'answer'][k] : '');
        vz.set(el, 'x', G.pad); vz.set(el, 'y', k ? G.ansY + G.ch / 2 + 4 : G.idxY + 4);
      });

      S.bars.begin(); S.lbl.begin(); S.cells.begin();
      var finalKind = state.kind === 'leftover';
      state.values.forEach(function (v, k) {
        var st = state.states[k] || 'default';
        var bar = S.bars.use('b' + k, buildBar);
        vz.state(bar.el, st);
        var h = v / G.maxV * G.bh;
        vz.set(bar.rect, 'x', vz.n2(-G.bw / 2)); vz.set(bar.rect, 'y', vz.n2(-h)); vz.set(bar.rect, 'width', vz.n2(G.bw)); vz.set(bar.rect, 'height', vz.n2(h));
        upd(bar, { x: G.x(k), y: G.base, o: 1 }, { o: 0 });

        var vl = S.lbl.use('v' + k, buildLabel);
        vz.text(vl.el, L9.fmt(v)); vz.toggle(vl.el, 'is-strong', true);
        vz.set(vl.el, 'font-size', G.sw < 26 ? 9 : 12);
        upd(vl, { x: G.x(k), y: G.base - h - 6, o: 1 }, { o: 0 });
        var il = S.lbl.use('i' + k, buildLabel);
        vz.text(il.el, k); vz.toggle(il.el, 'is-strong', state.i === k);
        upd(il, { x: G.x(k), y: G.idxY, o: 1 }, { o: 0 });

        var cell = S.cells.use('a' + k, buildCell);
        var ans = state.answers[k];
        var txt = ans === null || ans === undefined ? '' : L9.fmt(ans);
        var was = cell.shown;
        cell.shown = txt;
        var cst = ans === null || ans === undefined ? 'default' : (state.resolved[k] ? 'done' : 'muted');
        if (finalKind && !state.resolved[k]) cst = 'muted';
        vz.state(cell.el, cst);
        vz.toggle(cell.el, 'is-empty', txt === '');
        vz.set(cell.rect, 'x', vz.n2(-G.cw / 2)); vz.set(cell.rect, 'y', vz.n2(-G.ch / 2)); vz.set(cell.rect, 'width', vz.n2(G.cw)); vz.set(cell.rect, 'height', G.ch);
        vz.text(cell.txt, txt === '' ? '?' : txt);
        vz.set(cell.txt, 'font-size', G.cw < 26 ? 10 : 13);
        var t = { x: G.x(k), y: G.ansY + G.ch / 2, o: 1, s: 1 };
        upd(cell, t, { o: 0, s: 1 });
        if (!cell.isNew && was !== undefined && was === '' && txt !== '' && ms > 0) { cell.cur.s = 1.35; cell.from.s = 1.35; }
      });
      [S.bars, S.lbl, S.cells].forEach(function (st) { st.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); anim.push(rec); }); });

      /* pointers: i under the index row, t (the stack top being tested) beside it */
      S.ptrs.begin();
      [['i', state.i, 'active'], ['top', state.topIdx, 'compare']].forEach(function (p) {
        if (p[1] === null || p[1] === undefined) return;
        var rec = S.ptrs.use(p[0], buildPtr);
        vz.text(rec.txt, p[0] === 'top' ? 't' : 'i');
        vz.state(rec.el, p[2]);
        upd(rec, { x: G.x(p[1]), y: G.ptrY - 8, o: 1 }, { o: 0 });
      });
      S.ptrs.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); anim.push(rec); });

      /* arrows */
      S.arrows.begin();
      (state.arrows || []).forEach(function (a) {
        var rec = S.arrows.use(a.from + '>' + a.to, buildArrow);
        var x1 = G.x(a.from), x2 = G.x(a.to);
        var y1 = G.barTop(a.from) - 22, y2 = G.barTop(a.to) - 22;
        var span = a.to - a.from;
        var arcH = 14 + (G.lane - 26) * Math.pow(span / Math.max(reserve.span, 1), 0.7) + 8;
        var peak = Math.min(y1, y2) - arcH;
        var d = 'M' + vz.n2(x1) + ' ' + vz.n2(y1) + 'C' + vz.n2(x1) + ' ' + vz.n2(peak) + ' ' + vz.n2(x2) + ' ' + vz.n2(peak) + ' ' + vz.n2(x2) + ' ' + vz.n2(y2 - 8);
        vz.set(rec.line, 'd', d);
        vz.set(rec.head, 'd', vz.arrowHead(x2, y2 + 1, Math.PI / 2, 9));
        vz.state(rec.el, a.fresh ? 'path' : 'visited');
        var w = Math.max(20, String(a.label).length * 7 + 10);
        vz.set(rec.pillBg, 'width', w); vz.set(rec.pillBg, 'x', -w / 2);
        vz.text(rec.pillTx, a.label);
        vz.set(rec.pill, 'transform', 'translate(' + vz.n2((x1 + x2) / 2) + ' ' + vz.n2(0.75 * peak + 0.125 * (y1 + y2)) + ')');
        upd(rec, { p: 1 }, { p: 0 });
      });
      S.arrows.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = { p: 0 }; anim.push(rec); });

      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) { var r = anim[i]; vz.step(r, vz.local(t, r.delay || 0)); r.paint(r); }
      }, function () { Object.keys(S).forEach(function (k) { S[k].purge(); }); });
    }

    api.prepare = function (steps) {
      reserve = { span: 1, max: 0, n: 0 };
      (steps || []).forEach(function (s) {
        if (!s.values) return;
        reserve.n = Math.max(reserve.n, s.values.length);
        reserve.max = Math.max(reserve.max, Math.max.apply(null, s.values.concat([1])));
        (s.arrows || []).forEach(function (a) { reserve.span = Math.max(reserve.span, a.to - a.from); });
      });
      api.refresh();
      return api;
    };
    api.reset = function () { reserve = { span: 1, max: 0, n: 0 }; Object.keys(S).forEach(function (k) { S[k].clear(); }); return api; };
    api.describe = function (state) {
      if (!state || !state.values) return '';
      return 'Bars with values ' + state.values.join(', ') + '. Answers so far: ' + state.answers.map(function (a) { return a === null ? '?' : a; }).join(', ') + '. ' + (state.arrows || []).length + ' arrows drawn.';
    };
    return api;
  };

  /* ================================================================== static stack mini (summary tiles etc.) */
  /* L9.stackMini(['(', '['], {states:['frontier','active'], label, w, top:true, badges:[...]}) -> <svg> */
  L9.stackMini = function (values, o) {
    o = o || {};
    var s = V.s, PW = o.plate || 62, PH = o.plateH || 20, GAP = 3, PAD = 8, cap = Math.max(o.slots || values.length, 1);
    var W = PW + PAD * 2 + (o.top === false ? 0 : 44), H = cap * (PH + GAP) + PAD * 2 + 4;
    var svg = s('svg', { class: 'vz l9m', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || ('Stack, bottom to top: ' + values.join(', ')) });
    svg.style.maxWidth = Math.round(W * (o.scale || 1.5)) + 'px';
    var base = H - PAD - 2;
    svg.appendChild(s('path', { class: 'l9m-tray', d: 'M' + (PAD - 3) + ' ' + (base - cap * (PH + GAP) - 2) + ' V' + (base + 3) + ' H' + (PAD + PW + 3) + ' V' + (base - cap * (PH + GAP) - 2), fill: 'none' }));
    values.forEach(function (v, k) {
      var y = base - (k + 1) * (PH + GAP) + GAP;
      var st = (o.states && o.states[k]) || 'default';
      svg.appendChild(s('g', { class: 'vz-item is-' + st, transform: 'translate(' + PAD + ' ' + y + ')' },
        s('rect', { class: 'vz-shape', width: PW, height: PH, rx: 5 }),
        s('text', { class: 'vz-ink vz-value', x: PW / 2, y: PH / 2, dy: '.35em', 'text-anchor': 'middle', style: 'font-size:' + Math.round(PH * 0.62) + 'px' }, L9.fmt(v))));
      if (o.badges && o.badges[k] !== undefined) svg.appendChild(s('text', { class: 'vz-label', x: PAD + PW + 8, y: y + PH / 2, dy: '.35em', style: 'font-size:10px' }, o.badges[k]));
    });
    if (o.top !== false && values.length) {
      var ty = base - values.length * (PH + GAP) + GAP + PH / 2;
      svg.appendChild(s('g', { class: 'l9m-top', transform: 'translate(' + (PAD + PW + 6) + ' ' + ty + ')' },
        s('path', { d: 'M0 0 L9 -5 L9 5 Z' }), s('text', { x: 13, y: 0, dy: '.35em' }, 'top')));
    }
    return svg;
  };
}());
