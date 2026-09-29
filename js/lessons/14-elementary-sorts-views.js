/* Lesson 14 — custom views and helpers shared by the lesson's figures.
   Loaded before js/lessons/14-elementary-sorts-lab.js and js/lessons/14-elementary-sorts.js.

     L14.tokenRow(container, opts)   a snapshot view (same contract as VDSA.views.*) for a row of boxes or playing
                                     cards, with inversion arcs above the row and optional clickable "swap" buttons
                                     between neighbours. Items keep identity by id and glide; swaps arc.
     L14.miniCells(values, opts)     a small static SVG (summary tiles, variation thumbnails)
     L14.whenNear(el, fn)            run fn once when el comes within ~700px of the viewport (lazy figures)
     L14.labelDuplicates(values)     [{value, label}] with a/b/c tags on repeated values
     L14.restyle(step, o)            copy of a generator step with a new caption / plain states (for sliced traces)
     L14.fmt(v)                      numbers with a real minus sign */
(function () {
  'use strict';
  var V = window.VDSA, vz = V.vz;
  var L14 = V.lessons = V.lessons || {};
  L14 = V.lessons.l14 = V.lessons.l14 || {};

  L14.fmt = function (v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); };

  /* ------------------------------------------------------------------ lazy init */
  L14.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 14] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  /* ------------------------------------------------------------------ data helpers */
  var TAGS = 'abcdefghijklmnop';
  L14.labelDuplicates = function (values) {
    var counts = {}, seen = {};
    values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    return values.map(function (v) {
      if (counts[v] < 2) return { value: v };
      var k = seen[v] = (seen[v] || 0) + 1;
      return { value: v, label: TAGS[k - 1] || String(k) };
    });
  };
  /* A copy of a generator step for a sliced trace: new caption, no pointers, and highlight states reduced to what
     the step proves (final -> done, insertion prefix -> visited). */
  L14.restyle = function (step, o) {
    o = o || {};
    var fin = {};
    (step.final || []).forEach(function (k) { fin[k] = true; });
    var prefixTo = o.prefixTo === undefined ? -1 : o.prefixTo;
    var items = step.items.map(function (it) {
      var slot = it.index !== undefined ? it.index : step.order.indexOf(it.id);
      var c = Object.assign({}, it);
      c.state = fin[slot] ? 'done' : slot <= prefixTo ? 'visited' : 'default';
      return c;
    });
    return Object.assign({}, step, { items: items, pointers: o.pointers || [], caption: o.caption === undefined ? step.caption : o.caption, held: step.held, line: o.line === undefined ? step.line : o.line });
  };

  /* ------------------------------------------------------------------ tokenRow view */
  var SUIT_RED = { '♥': true, '♦': true };
  var DEFAULTS = { look: 'box', cellSize: 54, gapRatio: 0.2, showIndices: true, arcs: false, gaps: false, liftRatio: 0.34, label: 'Row of values', slots: 0 };

  L14.tokenRow = function (container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var made = vz.createView(container, 'tokens', { label: opts.label, className: 'l14-tokens l14-tokens--' + opts.look, interactive: !!opts.gaps }, draw);
    var ctx = made.ctx, api = made.api, em = made.em, tr = made.tr;
    ctx.layer('arcs'); ctx.layer('idx'); ctx.layer('items'); ctx.layer('gaps');
    var S = { items: new vz.Store(), arcs: new vz.Store(), gaps: new vz.Store(), idx: new vz.Store() };
    var G = null, reservedArc = 0, emptyEl = null;
    var assignArcs = V.views.array && V.views.array.layout ? V.views.array.layout.assignArcs : function () { return {}; };

    function geometry(state) {
      var items = state.items || [];
      var n = Math.max(opts.slots || 0, state.length || 0, items.length);
      items.forEach(function (it) { if (typeof it.index === 'number') n = Math.max(n, it.index + 1); });
      var W = ctx.width, pad = 8;
      var sw = Math.max(18, Math.min(opts.cellSize * (1 + opts.gapRatio), (W - 2 * pad) / Math.max(1, n)));
      var cw = sw / (1 + opts.gapRatio);
      var ch = opts.look === 'card' ? cw * 1.36 : cw;
      var g = { n: n, sw: sw, cw: cw, ch: ch, x0: (W - n * sw) / 2, W: W };
      g.lift = Math.round(ch * opts.liftRatio);
      var arcMax = opts.arcs ? vz.clamp(sw * 1.15, 34, 92) : 0;
      g.arcMax = arcMax;
      reservedArc = Math.max(reservedArc, arcMax);
      var y = 8 + (opts.arcs ? reservedArc + 6 : 0);
      var anyLift = opts.lift || items.some(function (it) { return it.lift; });
      if (anyLift) opts.lift = true;
      if (opts.lift) y += g.lift;
      g.top = y;                       // top edge of resting cells
      g.mid = y + ch / 2;
      y += ch;
      if (opts.showIndices) { g.idxY = y + 13; y += 22; }
      if (opts.gaps) { g.gapY = y + 20; y += 44; }
      g.height = y + 6;
      g.font = vz.clamp(Math.round(cw * (opts.look === 'card' ? 0.4 : 0.38)), 11, 22);
      return g;
    }
    function slotX(k) { return G.x0 + (k + 0.5) * G.sw; }

    function buildItem(rec) {
      var card = opts.look === 'card';
      var g = vz.svg('g', { class: card ? 'l14-card' : 'vz-item vz-box l14-tok' }, ctx.layers.items);
      rec.shape = vz.svg('rect', { class: card ? 'l14-face' : 'vz-shape' }, g);
      if (card) {
        rec.ring = vz.svg('rect', { class: 'l14-ring' }, g);
        rec.rank = vz.svg('text', { class: 'l14-rank', 'text-anchor': 'middle', dy: '.35em' }, g);
        rec.suit = vz.svg('text', { class: 'l14-suit', 'text-anchor': 'middle', dy: '.35em' }, g);
        rec.corner = vz.svg('text', { class: 'l14-corner', dy: '.35em' }, g);
      } else {
        rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
        rec.sub = vz.svg('text', { class: 'vz-ink vz-sub', 'text-anchor': 'middle', dy: '.35em' }, g);
      }
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
    }
    function sizeItem(rec, it) {
      var card = opts.look === 'card', w = G.cw, h = G.ch, r = card ? Math.min(9, w * 0.14) : Math.min(9, h * 0.16);
      [rec.shape].concat(rec.ring ? [rec.ring] : []).forEach(function (el, k) {
        var inset = k ? -3.5 : 0;
        vz.set(el, 'x', vz.n2(-w / 2 + inset)); vz.set(el, 'y', vz.n2(-h / 2 + inset));
        vz.set(el, 'width', vz.n2(w - 2 * inset)); vz.set(el, 'height', vz.n2(h - 2 * inset));
        vz.set(el, 'rx', vz.n2(r - inset)); vz.set(el, 'ry', vz.n2(r - inset));
      });
      var val = L14.fmt(it.value);
      if (card) {
        var red = SUIT_RED[it.label];
        vz.text(rec.rank, val); vz.set(rec.rank, 'y', vz.n2(-h * 0.14)); vz.set(rec.rank, 'font-size', Math.round(G.font * 1.05));
        vz.text(rec.suit, it.label || ''); vz.set(rec.suit, 'y', vz.n2(h * 0.2)); vz.set(rec.suit, 'font-size', Math.round(G.font * 1.05));
        vz.text(rec.corner, val + (it.label || '')); vz.set(rec.corner, 'x', vz.n2(-w / 2 + 5)); vz.set(rec.corner, 'y', vz.n2(-h / 2 + 9));
        vz.set(rec.corner, 'font-size', vz.clamp(Math.round(G.font * 0.46), 8, 11));
        vz.toggle(rec.el, 'is-red', !!red);
      } else {
        var hasSub = it.label !== undefined && it.label !== null && it.label !== '' && h >= 30;
        vz.text(rec.txt, val); vz.set(rec.txt, 'font-size', G.font); vz.set(rec.txt, 'y', hasSub ? vz.n2(-h * 0.12) : 0);
        vz.text(rec.sub, hasSub ? it.label : ''); vz.set(rec.sub, 'y', vz.n2(h * 0.25)); vz.set(rec.sub, 'font-size', vz.clamp(Math.round(G.font * 0.6), 8, 12));
      }
      vz.set(rec.el, 'data-id', it.id);
      vz.set(rec.el, 'data-label', (it.aria || ('Value ' + val + (it.label ? ' ' + it.label : ''))));
    }

    function buildArc(rec) {
      rec.el = vz.svg('path', { class: 'l14-arc' }, ctx.layers.arcs);
      rec.paint = paintArc;
    }
    function paintArc(rec) {
      var A = S.items.get(rec.src), B = S.items.get(rec.dst);
      if (!A || !B) { vz.set(rec.el, 'd', null); return; }
      var ax = A.cur.x, bx = B.cur.x, ay = A.cur.y - G.ch / 2 - 1, by = B.cur.y - G.ch / 2 - 1;
      var d = Math.abs(bx - ax) / G.sw;
      var h = G.arcMax * (0.34 + 0.66 * Math.min(1, d / Math.max(1, G.n - 1)));
      var lx = Math.min(ax, bx), rx = Math.max(ax, bx), ly = ax < bx ? ay : by, ry = ax < bx ? by : ay;
      // spread the feet along the top edge: nearer partners land nearer the centre, so arcs sharing a box fan out
      var foot = Math.min(G.cw * 0.4, 3 + d * G.cw * 0.09);
      lx += foot; rx -= foot;
      var top = Math.min(ly, ry) - h * 1.33;
      vz.set(rec.el, 'd', 'M' + vz.n2(lx) + ' ' + vz.n2(ly) + 'C' + vz.n2(lx) + ' ' + vz.n2(top) + ' ' + vz.n2(rx) + ' ' + vz.n2(top) + ' ' + vz.n2(rx) + ' ' + vz.n2(ry));
      vz.opacity(rec.el, rec.cur.o);
    }

    function buildGap(rec) {
      var g = vz.svg('g', { class: 'l14-gap' }, ctx.layers.gaps);
      rec.circle = vz.svg('circle', { r: 16 }, g);
      rec.txt = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
      vz.clickable(g, null, function () { em.emit('gap', { index: rec.gapIndex }); });
    }

    function buildIdx(rec) {
      rec.el = vz.svg('text', { class: 'vz-label', 'text-anchor': 'middle', dy: '.35em' }, ctx.layers.idx);
      rec.paint = function (r) { vz.set(r.el, 'x', vz.n2(r.cur.x)); vz.set(r.el, 'y', vz.n2(r.cur.y)); vz.opacity(r.el, r.cur.o); };
    }

    function draw(state, ms) {
      state = state || {};
      var items = state.items || [];
      G = geometry(state);
      ctx.setHeight(G.height);
      var anim = [];
      function upd(rec, t, from) {
        if (rec.isNew) rec.cur = Object.assign({}, t, from || { o: 0 });
        vz.retarget(rec, t); rec.arc = 0; rec.delay = 0; anim.push(rec);
      }
      if (!emptyEl) emptyEl = vz.svg('text', { class: 'vz-empty', 'text-anchor': 'middle', dy: '.35em' }, ctx.layers.idx);
      vz.text(emptyEl, G.n ? '' : 'empty');
      vz.set(emptyEl, 'x', vz.n2(ctx.width / 2)); vz.set(emptyEl, 'y', vz.n2(G.mid));

      /* items */
      var prev = {};
      S.items.each(function (rec, id) { if (!rec.exiting && rec.cur.x !== undefined) prev[id] = rec.cur.x; });
      S.items.begin();
      var moves = [];
      items.forEach(function (it, k) {
        var slot = typeof it.index === 'number' ? it.index : k;
        var rec = S.items.use(String(it.id), buildItem);
        vz.state(rec.el, it.state || 'default');
        sizeItem(rec, it);
        var t = { x: slotX(slot), y: G.mid - (it.lift ? G.lift : 0), o: 1 };
        upd(rec, t, { o: 0, y: t.y + 10 });
        if (prev[it.id] !== undefined && Math.abs(prev[it.id] - t.x) > 1) moves.push({ id: String(it.id), dx: t.x - prev[it.id] });
      });
      S.items.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.arc = 0; anim.push(rec); });
      if (ms > 0 && opts.arcSwaps !== false) {
        var arcs = assignArcs(moves, function (dx) { return vz.clamp(Math.abs(dx) * 0.2 + G.ch * 0.3, G.ch * 0.45, G.ch * 1.1); });
        Object.keys(arcs).forEach(function (id) { var r = S.items.get(id); if (r) r.arc = arcs[id]; });
      }

      /* arcs */
      S.arcs.begin();
      (state.arcs || []).forEach(function (a) {
        var key = String(a.a) + '|' + String(a.b);
        var rec = S.arcs.use(key, buildArc);
        rec.src = String(a.a); rec.dst = String(a.b);
        vz.state(rec.el, a.state || 'error');
        vz.toggle(rec.el, 'is-dashed', !!a.dashed);
        upd(rec, { o: 1 }, { o: 0 });
      });
      S.arcs.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = { o: 0 }; anim.push(rec); });

      /* index labels */
      S.idx.begin();
      if (opts.showIndices) for (var k = 0; k < G.n; k++) {
        var ir = S.idx.use('i' + k, buildIdx);
        vz.text(ir.el, k);
        upd(ir, { x: slotX(k), y: G.idxY, o: 1 }, { o: 0 });
      }
      S.idx.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); anim.push(rec); });

      /* gap buttons */
      S.gaps.begin();
      (state.gaps || []).forEach(function (gp) {
        var rec = S.gaps.use('g' + gp.index, buildGap);
        rec.gapIndex = gp.index;
        vz.state(rec.el, gp.state || 'default');
        vz.text(rec.txt, gp.text || '⇄');
        vz.set(rec.el, 'aria-label', gp.label || ('Swap positions ' + gp.index + ' and ' + (gp.index + 1)));
        vz.toggle(rec.el, 'is-disabled', !!gp.disabled);
        vz.set(rec.el, 'aria-disabled', gp.disabled ? 'true' : null);
        upd(rec, { x: G.x0 + (gp.index + 1) * G.sw, y: G.gapY, o: 1 }, { o: 0 });
      });
      S.gaps.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); anim.push(rec); });

      var arcRecs = [];
      S.arcs.each(function (r) { arcRecs.push(r); });
      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) { var r = anim[i]; vz.step(r, vz.local(t, r.delay || 0)); if (r.paint !== paintArc) r.paint(r); }
        arcRecs.forEach(function (r) { vz.step(r, vz.local(t, 0)); paintArc(r); });   // arcs follow the moving items
      }, function () { Object.keys(S).forEach(function (k) { S[k].purge(); }); });
    }

    api.describe = function (state) {
      var items = (state && state.items) || [];
      var s = 'Values in order: ' + items.map(function (it) { return L14.fmt(it.value) + (it.label || ''); }).join(', ') + '.';
      if (state && state.arcs && state.arcs.length) s += ' ' + state.arcs.length + ' out-of-order pairs are joined by arcs.';
      return s;
    };
    api.reset = function () { reservedArc = 0; return api; };
    return api;
  };

  /* ------------------------------------------------------------------ static mini figures */
  /* L14.miniCells([5, 3, 9], {states, tags:[{at, text, state}], size, index, region:{from,to,state,label},
       lift: slot, ghost: slot, arcs: [[i, j, state]], labels: [...], label}) -> <svg> */
  L14.miniCells = function (values, o) {
    o = o || {};
    var s = V.s, C = o.size || 30, P = o.pitch || Math.round(C * 1.2), PAD = 8;
    var n = values.length;
    var arcH = o.arcs && o.arcs.length ? Math.round(C * 1.1) : 0;
    var tagH = o.tags && o.tags.length ? 26 : 0;
    var liftH = o.lift !== undefined ? Math.round(C * 0.8) : 0;
    var regionH = o.region && o.region.label ? 14 : 0;
    var top = PAD + Math.max(tagH, arcH, regionH) + liftH;
    var W = PAD * 2 + n * P - (P - C), H = top + C + (o.index ? 18 : 0) + PAD;
    var svg = s('svg', { class: 'vz l14m', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.label || ('Values ' + values.join(', ')) });
    svg.style.maxWidth = Math.round(W * (o.scale || 1.5)) + 'px';
    function cx(k) { return PAD + k * P + C / 2; }
    if (o.region) {
      var rx = PAD + o.region.from * P - 4, rw = (o.region.to - o.region.from) * P + C + 8;
      var g = s('g', { class: 'vz-region is-' + (o.region.state || 'done') },
        s('rect', { class: 'vz-band', x: rx, y: top - 4, width: rw, height: C + 8 + (o.index ? 16 : 0), rx: 7 }));
      if (o.region.label) g.appendChild(s('text', { class: 'vz-region-label', x: rx + 2, y: top - 8, style: 'font-size:9px' }, o.region.label));
      svg.appendChild(g);
    }
    (o.arcs || []).forEach(function (a) {
      var x1 = cx(a[0]), x2 = cx(a[1]), d = Math.abs(a[1] - a[0]);
      var hh = Math.min(arcH, 8 + d * C * 0.3) * 1.33;
      svg.appendChild(s('path', { class: 'l14-arc is-' + (a[2] || 'error'), d: 'M' + (x1 + 2) + ' ' + (top - 2) + 'C' + (x1 + 2) + ' ' + (top - 2 - hh) + ' ' + (x2 - 2) + ' ' + (top - 2 - hh) + ' ' + (x2 - 2) + ' ' + (top - 2) }));
    });
    if (o.ghost !== undefined) svg.appendChild(s('rect', { class: 'vz-slot', x: PAD + o.ghost * P, y: top, width: C, height: C, rx: Math.round(C / 5) }));
    values.forEach(function (v, k) {
      var st = (o.states && o.states[k]) || 'default';
      var y = top + (o.lift === k ? -liftH : 0);
      var slot = o.lift === k && o.liftOver !== undefined ? o.liftOver : k;
      var g = s('g', { class: 'vz-item is-' + st, transform: 'translate(' + (PAD + slot * P) + ' ' + y + ')' },
        s('rect', { class: 'vz-shape', width: C, height: C, rx: Math.round(C / 5) }),
        s('text', { class: 'vz-ink vz-value', x: C / 2, y: C / 2 + (o.labels && o.labels[k] ? -C * 0.1 : 0), dy: '.35em', 'text-anchor': 'middle', style: 'font-size:' + Math.round(C * 0.42) + 'px' }, L14.fmt(v)));
      if (o.labels && o.labels[k]) g.appendChild(s('text', { class: 'vz-ink vz-sub', x: C / 2, y: C * 0.76, dy: '.35em', 'text-anchor': 'middle', style: 'font-size:' + Math.round(C * 0.3) + 'px' }, o.labels[k]));
      if (o.index) svg.appendChild(s('text', { class: 'vz-label', x: cx(k), y: top + C + 13, 'text-anchor': 'middle', style: 'font-size:9px' }, k));
      svg.appendChild(g);
    });
    (o.tags || []).forEach(function (t) {
      var x = cx(t.at), w = Math.max(24, t.text.length * 6.4 + 12);
      var ty = top - 6 + (o.lift === t.at ? -liftH : 0);
      svg.appendChild(s('g', { class: 'l14m-tag is-' + (t.state || 'key'), transform: 'translate(' + x + ' ' + ty + ')' },
        s('rect', { x: -w / 2, y: -17, width: w, height: 15, rx: 7.5 }),
        s('text', { x: 0, y: -9.5, dy: '.35em', 'text-anchor': 'middle' }, t.text)));
    });
    return svg;
  };
}());
