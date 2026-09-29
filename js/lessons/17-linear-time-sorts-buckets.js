/* Lesson 17 — shared helpers and the bucket view.
     V.lessons.l17.whenNear(el, fn)      run fn once when el comes within ~700px of the viewport (lazy figures)
     V.lessons.l17.bucketView(host, o)   a list row of n slots above `nBuckets` buckets (queues). Chips keep their id and
                                          fly between list slots and bucket positions. Used by the hero, the pigeonhole
                                          figure, the radix lab and bucket sort. Snapshots come from
                                          VDSA.algos.sorting.radix / .bucket (see js/algos/17-linear-time-sorts.js).
     V.lessons.l17.fmt(v)                numbers with a real minus sign, thousands separators for big ones
   Snapshot: { nBuckets, bucketLabels?, items: [{id, value, text?, digits?, label?, where, index | bucket + depth, state}],
               pos (highlighted digit from the right, or -1), activeBucket, listLabel, header? } */
(function () {
  'use strict';
  var V = window.VDSA, vz = V.vz;
  var L17 = V.lessons = V.lessons || {};
  L17 = V.lessons.l17 = V.lessons.l17 || {};

  L17.fmt = function (v) {
    if (typeof v !== 'number') return String(v);
    var s = Math.abs(v) >= 10000 ? Math.round(v).toLocaleString('en-US') : String(v);
    return v < 0 ? '−' + s.replace('-', '') : s;
  };

  /* Shuffle the options of a prediction (and their explanations) so the right answer is not always "A". */
  L17.shuffleSpec = function (spec) {
    var n = spec.options.length, idx = [], i, j, t;
    for (i = 0; i < n; i++) idx.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    return Object.assign({}, spec, {
      options: idx.map(function (k) { return spec.options[k]; }),
      explain: spec.explain ? idx.map(function (k) { return spec.explain[k]; }) : undefined,
      answer: idx.indexOf(spec.answer)
    });
  };

  L17.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 17] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  /* ------------------------------------------------------------------ bucket view */
  L17.bucketView = function (container, options) {
    var opts = Object.assign({ label: 'Numbers and buckets', chipH: 28, showHeader: true, maxChipW: 60, compactLabels: false }, options || {});
    var made = vz.createView(container, 'buckets', { label: opts.label, className: 'l17-buckets' }, draw);
    var ctx = made.ctx, api = made.api, tr = made.tr;
    ctx.layer('troughs'); ctx.layer('chrome'); ctx.layer('items');
    var chips = new vz.Store(), troughs = new vz.Store();
    var reserveDepth = 1, reserveN = 0, G = null, headText = null, listLabel = null, bucketsLabel = null;

    function geometry(state) {
      var items = state.items || [];
      var n = items.length, k = state.nBuckets || 10;
      var depth = reserveDepth;
      items.forEach(function (it) { if (it.where === 'bucket' && it.depth + 1 > depth) depth = it.depth + 1; });
      reserveDepth = depth;
      n = Math.max(n, reserveN);
      var W = ctx.width, pad = 8;
      var lw = (W - 2 * pad) / Math.max(1, n), bw = (W - 2 * pad) / Math.max(1, k);
      var chipW = Math.max(22, Math.min(opts.maxChipW, lw - 4, bw - 6));
      var chipH = W < 420 ? Math.min(opts.chipH, 24) : opts.chipH;
      var digs = 0;
      items.forEach(function (it) { var l = (it.digits || it.text || String(it.value)).length; if (l > digs) digs = l; });
      var font = vz.clamp(Math.floor((chipW - 8) / (Math.max(2, digs) * 0.62)), 9, 15);
      var g = { n: n, k: k, W: W, pad: pad, lw: lw, bw: bw, chipW: chipW, chipH: chipH, font: font, depth: depth };
      var y = 6;
      g.headY = 14; if (opts.showHeader) y += 20;
      g.listLabelY = y + 8; y += 18;
      g.listY = y + chipH / 2; y += chipH + 10;
      g.arrowY = y + 8; y += 18;
      g.bucketLabelY = y + 8; y += (state.bucketLabels && !opts.compactLabels ? 34 : 24);
      g.troughTop = y;
      g.troughH = depth * (chipH + 4) + 10;
      y += g.troughH + 8;
      g.height = y;
      return g;
    }
    function listX(i) { return G.pad + (i + 0.5) * G.lw; }
    function bucketX(b) { return G.pad + (b + 0.5) * G.bw; }
    function itemPos(it) {
      if (it.where === 'bucket') return { x: bucketX(it.bucket), y: G.troughTop + 5 + it.depth * (G.chipH + 4) + G.chipH / 2 };
      return { x: listX(it.index), y: G.listY };
    }

    function buildChip(rec) {
      var g = vz.svg('g', { class: 'vz-item l17-bchip' }, ctx.layers.items);
      rec.shape = vz.svg('rect', { class: 'vz-shape' }, g);
      rec.hl2 = vz.svg('rect', { class: 'l17-dhl', rx: 3 }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value vz-mono', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.sub = vz.svg('text', { class: 'vz-ink vz-sub', 'text-anchor': 'end' }, g);
      rec.el = g;
      rec.paint = function (r) { vz.place(r.el, r.cur.x, r.cur.y); vz.opacity(r.el, r.cur.o); };
    }
    function sizeChip(rec, it, pos) {
      var w = G.chipW, h = G.chipH;
      vz.set(rec.shape, 'x', vz.n2(-w / 2)); vz.set(rec.shape, 'y', vz.n2(-h / 2));
      vz.set(rec.shape, 'width', vz.n2(w)); vz.set(rec.shape, 'height', vz.n2(h)); vz.set(rec.shape, 'rx', Math.min(8, h * 0.28));
      var str = it.digits || it.text || L17.fmt(it.value);
      var cw = G.font * 0.6, tw = str.length * cw;
      vz.set(rec.txt, 'font-size', G.font);
      var key = str + '|' + (it.digits ? pos : '-') + '|' + G.font;
      if (rec.__key !== key) {
        rec.__key = key;
        if (it.digits) {
          // leading zeros (padding) are quiet, the digit being read is boxed
          var real = String(it.value).length, frag = '';
          for (var i = 0; i < str.length; i++) {
            var pad = i < str.length - real && it.value !== 0 || (it.value === 0 && i < str.length - 1);
            frag += '<tspan class="' + (pad ? 'l17-dz' : '') + '">' + str[i] + '</tspan>';
          }
          rec.txt.innerHTML = frag;
        } else rec.txt.textContent = str;
        rec.__t = null;
      }
      var hi = it.digits && pos >= 0 && pos < str.length ? str.length - 1 - pos : -1;
      if (hi >= 0) {
        var x0 = -tw / 2 + hi * cw;
        var r = rec.hl2;
        vz.set(r, 'x', vz.n2(x0 - 1)); vz.set(r, 'y', vz.n2(-h / 2 + 3)); vz.set(r, 'width', vz.n2(cw + 2)); vz.set(r, 'height', vz.n2(h - 6));
        vz.set(r, 'visibility', 'visible');
      } else vz.set(rec.hl2, 'visibility', 'hidden');
      var lab = it.label !== undefined && it.label !== null && it.label !== '' ? String(it.label) : '';
      vz.text(rec.sub, lab);
      vz.set(rec.sub, 'x', vz.n2(w / 2 - 3)); vz.set(rec.sub, 'y', vz.n2(h / 2 - 5)); vz.set(rec.sub, 'font-size', 9);
      vz.set(rec.el, 'data-id', it.id);
      vz.set(rec.el, 'aria-label', 'Number ' + (it.text || L17.fmt(it.value)) + (lab ? ' ' + lab : ''));
    }
    function buildTrough(rec) {
      var g = vz.svg('g', { class: 'l17-trough' }, ctx.layers.troughs);
      rec.rect = vz.svg('rect', { rx: 8 }, g);
      rec.num = vz.svg('text', { class: 'l17-tnum', 'text-anchor': 'middle' }, g);
      rec.rng = vz.svg('text', { class: 'l17-trng', 'text-anchor': 'middle' }, g);
      rec.el = g;
      rec.paint = function (r) { vz.opacity(r.el, r.cur.o); };
    }

    function draw(state, ms) {
      var items = state.items || [];
      G = geometry(state);
      ctx.setHeight(G.height);
      var anim = [];
      function upd(rec, t, from) {
        if (rec.isNew) rec.cur = Object.assign({}, t, from || { o: 0 });
        vz.retarget(rec, t); rec.arc = 0; rec.delay = 0; anim.push(rec);
      }
      /* header, row labels */
      if (!headText) {
        headText = vz.svg('text', { class: 'l17-head', 'text-anchor': 'end' }, ctx.layers.chrome);
        listLabel = vz.svg('text', { class: 'vz-caption' }, ctx.layers.chrome);
        bucketsLabel = vz.svg('text', { class: 'vz-caption' }, ctx.layers.chrome);
      }
      vz.text(headText, state.header || ''); vz.set(headText, 'x', vz.n2(G.W - G.pad)); vz.set(headText, 'y', G.headY);
      vz.text(listLabel, (state.listLabel || 'list').toUpperCase()); vz.set(listLabel, 'x', G.pad); vz.set(listLabel, 'y', G.listLabelY);
      vz.text(bucketsLabel, '');

      /* list slots (dashed outlines: a dealt-out chip leaves a hole) */
      var chrome = ctx.layers.chrome;
      if (!chrome.__slots) chrome.__slots = [];
      for (var s = 0; s < G.n; s++) {
        var sl = chrome.__slots[s];
        if (!sl) { sl = chrome.__slots[s] = vz.svg('rect', { class: 'vz-slot', rx: 7 }, chrome); }
        vz.set(sl, 'x', vz.n2(listX(s) - G.chipW / 2)); vz.set(sl, 'y', vz.n2(G.listY - G.chipH / 2));
        vz.set(sl, 'width', vz.n2(G.chipW)); vz.set(sl, 'height', vz.n2(G.chipH)); vz.set(sl, 'visibility', 'visible');
      }
      for (var s2 = G.n; s2 < chrome.__slots.length; s2++) vz.set(chrome.__slots[s2], 'visibility', 'hidden');

      /* troughs */
      troughs.begin();
      for (var b = 0; b < G.k; b++) {
        var tr0 = troughs.use('t' + b, buildTrough);
        var active = state.activeBucket === b;
        vz.toggle(tr0.el, 'is-active', active);
        var tw = G.bw - 6;
        vz.set(tr0.rect, 'x', vz.n2(bucketX(b) - tw / 2)); vz.set(tr0.rect, 'y', vz.n2(G.troughTop)); vz.set(tr0.rect, 'width', vz.n2(tw)); vz.set(tr0.rect, 'height', vz.n2(G.troughH));
        vz.text(tr0.num, state.bucketLabels ? b : b);
        vz.set(tr0.num, 'x', vz.n2(bucketX(b))); vz.set(tr0.num, 'y', vz.n2(G.bucketLabelY + 6));
        vz.set(tr0.num, 'font-size', G.bw < 40 ? 12 : 14);
        var rng = state.bucketLabels && !opts.compactLabels ? state.bucketLabels[b] : '';
        vz.text(tr0.rng, rng);
        vz.set(tr0.rng, 'x', vz.n2(bucketX(b))); vz.set(tr0.rng, 'y', vz.n2(G.bucketLabelY + 22));
        vz.set(tr0.el, 'aria-label', 'Bucket ' + b);
        upd(tr0, { o: 1 }, { o: 1 });
      }
      troughs.end();

      /* chips */
      var pos = typeof state.pos === 'number' ? state.pos : -1;
      var prev = {};
      chips.each(function (rec, id) { if (!rec.exiting && rec.cur.x !== undefined) prev[id] = { x: rec.cur.x, y: rec.cur.y }; });
      chips.begin();
      var movers = [];
      items.forEach(function (it) {
        var rec = chips.use(String(it.id), buildChip);
        vz.state(rec.el, it.state || 'default');
        sizeChip(rec, it, pos);
        var t = itemPos(it); t.o = 1;
        upd(rec, t, { o: 0 });
        var p0 = prev[it.id];
        if (p0 && (Math.abs(p0.x - t.x) > 1 || Math.abs(p0.y - t.y) > 1)) movers.push(rec);
      });
      chips.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); anim.push(rec); });
      if (ms > 0) movers.forEach(function (rec) { ctx.layers.items.appendChild(rec.el); });

      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) { var r = anim[i]; vz.step(r, vz.local(t, r.delay || 0)); r.paint(r); }
      }, function () { chips.purge(); });
    }

    api.describe = function (state) {
      var items = (state && state.items) || [];
      var inList = items.filter(function (i) { return i.where === 'list'; }).sort(function (a, b) { return a.index - b.index; });
      var byB = {};
      items.filter(function (i) { return i.where === 'bucket'; }).forEach(function (i) { (byB[i.bucket] = byB[i.bucket] || []).push(i); });
      var s = 'List: ' + (inList.length ? inList.map(function (i) { return i.text || i.value; }).join(', ') : 'empty') + '.';
      Object.keys(byB).forEach(function (bk) { s += ' Bucket ' + bk + ': ' + byB[bk].sort(function (a, b) { return a.depth - b.depth; }).map(function (i) { return i.text || i.value; }).join(', ') + '.'; });
      return s;
    };
    /* Reserve the deepest bucket and the longest list a trace ever needs, so the height never changes while playing. */
    api.prepare = function (steps) {
      var d = 1, n = 0;
      (steps || []).forEach(function (s) {
        n = Math.max(n, (s.items || []).length);
        (s.items || []).forEach(function (it) { if (it.where === 'bucket' && it.depth + 1 > d) d = it.depth + 1; });
      });
      reserveDepth = d; reserveN = n;
      return api;
    };
    api.reset = function () { reserveDepth = 1; reserveN = 0; chips.clear(); return api; };
    return api;
  };
}());
