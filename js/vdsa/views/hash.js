/* VDSA.views.hashtable(container, options) — hash tables: a vertical bucket array with separate chaining
   (linked entries to the right) or open addressing (one slot per bucket, probe arcs, tombstones), an input
   area and a hash-function box the key travels through, a load-factor meter, and rehash animations.

   const view = VDSA.views.hashtable('#fig', { mode: 'chaining' });
   view.render({
     buckets: 7,
     hashFn: 'h(k) = k mod 7',
     entries: [{ id: 'e10', key: 10, bucket: 3 }, { id: 'e24', key: 24, bucket: 3 }],   // chain order = pos or list order
     incoming: { id: 'e17', key: 17, stage: 'hash', bucket: 3, op: 'insert' },          // 'input' -> 'hash' -> 'bucket'
     hashValue: '17 mod 7 = 3'
   }, { duration: ctx.duration });
   // next step: put { id: 'e17', key: 17, bucket: 3 } in entries (same id) and drop `incoming`: it flies to the chain end.

   Open addressing: { mode: 'open' } and entries sit in slot `bucket`; add
     probe: { slots: [3, 4, 5], current: 5 }, tombstones: [4].
   Resize: change `buckets` (e.g. 5 -> 11) and each entry's `bucket`; entries fly, new buckets grow in.

   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> hashtable.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure layout (Node-testable) */
  var L = {};

  /* Mathematical modulo (never negative). */
  L.mod = function (k, m) { return ((k % m) + m) % m; };

  /* i-th probe position from a home bucket. kind: 'linear' | 'quadratic' | 'double' (step = second hash). */
  L.probe = function (home, i, m, kind, step) {
    if (kind === 'quadratic') return L.mod(home + i * i, m);
    if (kind === 'double') return L.mod(home + i * (step || 1), m);
    return L.mod(home + i, m);
  };
  /* Whole probe sequence of length `count` (default m). */
  L.probeSequence = function (home, m, kind, step, count) {
    var out = [];
    for (var i = 0; i < (count === undefined ? m : count); i++) out.push(L.probe(home, i, m, kind, step));
    return out;
  };

  /* Normalise a snapshot. Chaining: entries grouped per bucket and ordered by `pos` (then list order).
     Open addressing: one entry per slot (`bucket` is the slot). */
  L.normalize = function (state, mode) {
    state = state || {};
    var m = Math.max(1, Math.floor(state.buckets || 1));
    var entries = [], chains = [], slots = [];
    for (var b = 0; b < m; b++) { chains.push([]); slots.push(null); }
    (state.entries || []).forEach(function (e, i) {
      if (!e) return;
      var bucket = L.mod(Math.floor(+e.bucket || 0), m);
      var ent = {
        id: String(e.id !== undefined ? e.id : 'k' + e.key), key: e.key, value: e.value, bucket: bucket,
        pos: typeof e.pos === 'number' ? e.pos : null, order: i, state: e.state || 'default', badge: e.badge, badgeState: e.badgeState
      };
      entries.push(ent);
      chains[bucket].push(ent);
    });
    chains.forEach(function (c) {
      c.sort(function (a, b) {
        var pa = a.pos === null ? Infinity : a.pos, pb = b.pos === null ? Infinity : b.pos;
        return pa !== pb ? pa - pb : a.order - b.order;
      });
      c.forEach(function (e, k) { e.pos = mode === 'open' ? 0 : k; });
    });
    if (mode === 'open') entries.forEach(function (e) { slots[e.bucket] = e; });
    var inc = null;
    if (state.incoming) {
      var s = state.incoming;
      inc = {
        id: String(s.id !== undefined ? s.id : 'in' + s.key), key: s.key, value: s.value,
        stage: s.stage === 'hash' || s.stage === 'bucket' ? s.stage : 'input',
        bucket: typeof s.bucket === 'number' ? L.mod(Math.floor(s.bucket), m) : null,
        pos: typeof s.pos === 'number' ? s.pos : null, state: s.state || 'key', op: s.op, badge: s.badge
      };
      if (inc.stage === 'bucket' && inc.bucket === null) inc.stage = 'hash';
      if (inc.stage === 'bucket' && inc.pos === null) inc.pos = mode === 'open' ? 0 : chains[inc.bucket].length;
    }
    var probe = null;
    if (state.probe && Array.isArray(state.probe.slots)) {
      probe = {
        slots: state.probe.slots.map(function (x) { return L.mod(Math.floor(x), m); }),
        current: typeof state.probe.current === 'number' ? L.mod(Math.floor(state.probe.current), m) : null,
        state: state.probe.state || 'compare'
      };
      if (probe.current === null && probe.slots.length) probe.current = probe.slots[probe.slots.length - 1];
    }
    var tomb = {};
    (state.tombstones || []).forEach(function (t) { tomb[L.mod(Math.floor(t), m)] = true; });
    var load = typeof state.loadFactor === 'number' ? state.loadFactor : entries.length / m;
    return {
      m: m, entries: entries, chains: chains, slots: slots, incoming: inc, probe: probe,
      tombstones: Object.keys(tomb).map(Number).sort(function (a, b) { return a - b; }),
      load: load, count: entries.length, threshold: typeof state.threshold === 'number' ? state.threshold : null,
      bucketStates: state.bucketStates || {}, hashFn: state.hashFn, hashValue: state.hashValue,
      resizing: state.resizing || null, showLoad: state.loadFactor !== false
    };
  };

  /* Row height for m buckets (keeps 16 buckets under ~450px). */
  L.rowHeight = function (m) { return m <= 8 ? 38 : m <= 12 ? 32 : m <= 16 ? 28 : Math.max(20, Math.floor(448 / m)); };

  /* Fit `len` chain entries into `avail` px: returns {w, gap} (entry width and arrow gap). */
  L.chainFit = function (avail, len, idealW, gap, minW) {
    gap = gap === undefined ? 22 : gap; minW = minW || 28;
    if (len <= 0) return { w: idealW, gap: gap };
    if (len * (idealW + gap) <= avail) return { w: idealW, gap: gap };
    var step = avail / len;
    var g = Math.max(12, Math.min(gap, step * 0.3));
    return { w: Math.max(minW, step - g), gap: g };
  };

  /* Meter axis maximum: at least 1, and comfortably above both the load and the threshold. */
  L.meterMax = function (load, threshold) {
    return Math.max(1, (load || 0) * 1.1, (threshold || 0) * 1.25);
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz, n2 = vz.n2;

  var DEFAULTS = {
    mode: 'chaining',       // 'chaining' | 'open'
    showHash: 'auto',       // true | false | 'auto' (appears once a state has hashFn or incoming; prepare() fixes it)
    showValues: 'auto',     // show "key: value" when entries carry values
    showLoad: true,         // load-factor meter in the header
    threshold: 0.75,        // resize threshold drawn on the meter
    rowHeight: null,        // px per bucket (auto from m)
    entryWidth: null,       // chaining: ideal entry width (auto from text)
    inputLabel: 'key',      // caption of the input area when incoming.op is not given
    label: 'Hash table',
    duration: undefined
  };

  function cubic(sx, sy, c1x, c1y, c2x, c2y, ex, ey) {
    return 'M' + n2(sx) + ' ' + n2(sy) + 'C' + n2(c1x) + ' ' + n2(c1y) + ' ' + n2(c2x) + ' ' + n2(c2y) + ' ' + n2(ex) + ' ' + n2(ey);
  }

  function hashView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var open = opts.mode === 'open';
    var V = vz.createView(container, 'hash', {
      label: opts.label, className: 'vz-hash-' + (open ? 'open' : 'chaining'), duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    ['header', 'hashbox', 'buckets', 'decor', 'edges', 'entries', 'badges'].forEach(ctx.layer);

    var S = {
      buckets: new vz.Store(), entries: new vz.Store(true), edges: new vz.Store(), decor: new vz.Store(),
      badges: new vz.Store(), fixed: new vz.Store()
    };
    var reserve = { hash: opts.showHash === true, m: 0, chain: 0, textW: 0, resize: false };
    var clickable = false;
    var G = null, geomKey = '';
    var measureCache = new Map();
    function measure(t, px, w) {
      var k = t + '|' + px + '|' + (w || 400), v = measureCache.get(k);
      if (v === undefined) { v = vz.textWidth(t, px, true, w); measureCache.set(k, v); }
      return v;
    }
    function showValues(N) {
      if (opts.showValues === true || opts.showValues === false) return opts.showValues;
      return N.entries.some(function (e) { return e.value !== undefined && e.value !== null; }) || !!(N.incoming && N.incoming.value !== undefined);
    }
    function entryText(e, withValues) {
      var k = vz.fmt(e.key);
      return withValues && e.value !== undefined && e.value !== null ? k + ': ' + vz.fmt(e.value) : k;
    }

    function noteReserve(N) {
      if (opts.showHash !== false && (N.hashFn || N.incoming)) reserve.hash = true;
      if (N.resizing) reserve.resize = true;
      var sv = showValues(N);
      N.entries.forEach(function (e) { reserve.textW = Math.max(reserve.textW, measure(entryText(e, sv), 12, 650)); });
      if (N.incoming) reserve.textW = Math.max(reserve.textW, measure(entryText(N.incoming, sv), 12, 650));
      var longest = 0;
      N.chains.forEach(function (c) { longest = Math.max(longest, c.length); });
      if (N.incoming && N.incoming.stage === 'bucket') longest = Math.max(longest, N.incoming.pos + 1);
      reserve.chain = Math.max(reserve.chain, longest);
    }

    /* ---------------------------------------------------------- geometry */
    function geometry(N) {
      var W = ctx.width, pad = 12;
      var g = { W: W, pad: pad, m: N.m };
      var showHash = reserve.hash && opts.showHash !== false;
      g.showHash = showHash;
      g.narrow = W < 600;
      g.rowH = opts.rowHeight || L.rowHeight(N.m);
      g.boxH = Math.max(18, g.rowH - 10);
      g.headerY = 6 + 11;
      g.twoLine = g.narrow && reserve.resize;
      var top = 6 + 28 + (g.twoLine ? 16 : 0);
      var textW = reserve.textW || 20;
      g.slotW = open ? vz.clamp(Math.ceil(textW + 22), 58, 120) : 40;
      if (showHash) {
        if (!g.narrow) {
          var lw = 156;
          g.input = { x: pad, y: top + 2, w: lw, h: 58 };
          g.hash = { x: pad, y: g.input.y + g.input.h + 34, w: lw, h: 88 };
          g.bucketX = pad + lw + 70;
          g.bucketsTop = top + 2;
        } else {
          var avail = W - 2 * pad, iw = Math.round((avail - 30) * 0.38);
          g.input = { x: pad, y: top + 2, w: iw, h: 88 };
          g.hash = { x: pad + iw + 30, y: top + 2, w: avail - iw - 30, h: 88 };
          g.bucketX = pad + 34;
          g.bucketsTop = top + 2 + 88 + 26;
        }
      } else {
        g.bucketX = pad + 34;
        g.bucketsTop = top + 2;
      }
      g.chainX0 = g.bucketX + g.slotW + 26;
      var ideal = opts.entryWidth || vz.clamp(Math.ceil(textW + 18), 40, 120);
      var fit = L.chainFit(W - pad - g.chainX0, Math.max(reserve.chain, 1), ideal, 22, 30);
      g.entryW = open ? g.slotW - 8 : fit.w;
      g.gap = fit.gap;
      g.rowY = function (b) { return g.bucketsTop + b * g.rowH + g.rowH / 2; };
      g.entryX = function (b, pos) { return open ? g.bucketX + g.slotW / 2 : g.chainX0 + pos * (g.entryW + g.gap) + g.entryW / 2; };
      var bottom = g.bucketsTop + N.m * g.rowH;
      if (showHash && !g.narrow) bottom = Math.max(bottom, g.hash.y + g.hash.h);
      g.height = bottom + 12;
      g.meterW = g.narrow ? 96 : 132;
      return g;
    }

    /* ---------------------------------------------------------- record builders + painters */
    function buildBucket(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-bucket' }, ctx.layers.buckets);
      rec.slot = vz.svg('rect', { class: 'vz-shape' }, g);
      rec.idx = vz.svg('text', { class: 'vz-label vz-bucket-index', 'text-anchor': 'end', dy: '.35em' }, g);
      rec.nul = vz.svg('text', { class: 'vz-hash-null', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.dot = vz.svg('circle', { class: 'vz-hash-dot', r: 3.5 }, g);
      rec.el = g; rec.paint = paintBucket;
      if (clickable) makeBucketClickable(rec);
    }
    function paintBucket(rec) {
      var c = rec.cur;
      vz.place(rec.el, G.bucketX, c.y);
      vz.opacity(rec.el, c.o);
    }
    function sizeBucket(rec) {
      var h = G.rowH - 4;
      vz.set(rec.slot, 'x', 0); vz.set(rec.slot, 'y', n2(-h / 2));
      vz.set(rec.slot, 'width', G.slotW); vz.set(rec.slot, 'height', n2(h));
      vz.set(rec.slot, 'rx', 5); vz.set(rec.slot, 'ry', 5);
      vz.set(rec.idx, 'x', -9);
      vz.set(rec.nul, 'x', n2(G.slotW / 2));
      vz.set(rec.dot, 'cx', n2(G.slotW / 2));
    }
    function makeBucketClickable(rec) {
      vz.clickable(rec.el, 'bucket ' + rec.b, function () { em.emit('click', { id: 'bucket-' + rec.b, type: 'bucket', bucket: rec.b }); });
    }

    function buildEntry(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-hash-entry' }, ctx.layers.entries);
      rec.box = vz.svg('rect', { class: 'vz-shape', rx: 6, ry: 6 }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value vz-mono', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintEntry;
      if (clickable) makeEntryClickable(rec);
    }
    function paintEntry(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, c.o);
      vz.set(rec.box, 'x', n2(-c.w / 2)); vz.set(rec.box, 'y', n2(-c.h / 2));
      vz.set(rec.box, 'width', n2(Math.max(0, c.w))); vz.set(rec.box, 'height', n2(Math.max(0, c.h)));
    }
    function makeEntryClickable(rec) {
      vz.clickable(rec.el, null, function () {
        var d = rec.data || {};
        em.emit('click', { id: rec.id, type: d.incoming ? 'incoming' : 'entry', key: d.key, value: d.value, bucket: d.bucket, pos: d.pos });
      });
    }

    function buildEdge(rec) {
      var g = vz.svg('g', { class: 'vz-edge' }, ctx.layers.edges);
      rec.line = vz.svg('path', { class: 'vz-line' }, g);
      rec.head = vz.svg('path', { class: 'vz-head' }, g);
      rec.el = g; rec.paint = paintEdge;
    }
    /* Anchor descriptors are resolved on every frame from the records' current positions. */
    function anchor(d) {
      if (!d) return null;
      if (d.kind === 'point') return { x: d.x, y: d.y };
      if (d.kind === 'entryLeft' || d.kind === 'entryRight') {
        var r = S.entries.get(d.id);
        if (!r) return null;
        return { x: r.cur.x + (d.kind === 'entryLeft' ? -1 : 1) * r.cur.w / 2 * (r.cur.s || 1), y: r.cur.y };
      }
      if (d.kind === 'bucketDot') {
        var b = S.buckets.get('b' + d.b);
        return b ? { x: G.bucketX + G.slotW / 2 + 4, y: b.cur.y } : null;
      }
      if (d.kind === 'bucketLabel') {
        var bb = S.buckets.get('b' + d.b);
        return bb ? { x: G.bucketX - 30, y: bb.cur.y } : null;
      }
      if (d.kind === 'slotRight') {
        var s = S.buckets.get('b' + d.b);
        return s ? { x: G.bucketX + G.slotW + 3, y: s.cur.y } : null;
      }
      if (d.kind === 'hashOut') {
        return G.narrow ? { x: G.hash.x + 18, y: G.hash.y + G.hash.h } : { x: G.hash.x + G.hash.w, y: G.hash.y + G.hash.h / 2 };
      }
      if (d.kind === 'inputOut') return G.narrow ? { x: G.input.x + G.input.w, y: G.input.y + G.input.h / 2 } : { x: G.input.x + G.input.w / 2, y: G.input.y + G.input.h };
      if (d.kind === 'hashIn') return G.narrow ? { x: G.hash.x - 2, y: G.hash.y + G.hash.h / 2 } : { x: G.hash.x + G.hash.w / 2, y: G.hash.y - 2 };
      return null;
    }
    function paintEdge(rec) {
      var c = rec.cur;
      var s = anchor(rec.src);
      var a = anchor(rec.tgtOld), b = anchor(rec.tgt);
      if (!b) b = a;
      if (!a) a = b;
      if (!s || !b) { vz.set(rec.el, 'opacity', 0); return; }
      var t = { x: vz.lerp(a.x, b.x, c.m), y: vz.lerp(a.y, b.y, c.m) };
      rec.lastEnd = t;
      vz.opacity(rec.el, c.o);
      var d, ang;
      if (rec.shape === 'probe') {
        // loop on the right of the slot column; wider for longer hops
        var rows = Math.abs(t.y - s.y) / G.rowH;
        var bulge = 18 + Math.min(40, rows * 9);
        var x1 = s.x + bulge, x2 = t.x + bulge;
        d = cubic(s.x, s.y, x1, s.y, x2, t.y, t.x + 2, t.y);
        ang = Math.atan2(t.y - t.y, (t.x + 2) - x2);
        rec.headAt = { x: t.x + 2, y: t.y };
      } else if (rec.shape === 'straightV') {
        d = 'M' + n2(s.x) + ' ' + n2(s.y) + 'L' + n2(t.x) + ' ' + n2(t.y - 1);
        ang = Math.atan2(t.y - s.y, t.x - s.x);
        rec.headAt = { x: t.x, y: t.y };
      } else if (rec.shape === 'hash') {
        if (G.narrow) {
          var cx = s.x, cy = t.y;
          d = cubic(s.x, s.y, s.x, s.y + (cy - s.y) * 0.6, t.x - Math.min(40, Math.abs(t.x - s.x) * 0.5 + 10), t.y, t.x, t.y);
          ang = 0;
          void cx;
        } else {
          var k = Math.max(20, Math.abs(t.x - s.x) * 0.45);
          d = cubic(s.x, s.y, s.x + k, s.y, t.x - k, t.y, t.x, t.y);
          ang = Math.atan2(t.y - t.y, k);
        }
        rec.headAt = { x: t.x, y: t.y };
      } else {
        var kk = Math.max(8, Math.abs(t.x - s.x) * 0.4);
        if (t.x < s.x + 6) kk = 30;
        var ex = t.x - 1;
        d = cubic(s.x, s.y, s.x + kk, s.y, ex - kk, t.y, ex, t.y);
        ang = Math.atan2(0, kk);
        rec.headAt = { x: ex, y: t.y };
      }
      vz.set(rec.line, 'd', d);
      vz.set(rec.head, 'd', vz.arrowHead(rec.headAt.x, rec.headAt.y, rec.shape === 'probe' ? Math.PI : ang, 8, 4.6));
    }

    function buildFixed(rec, kind) {
      rec.kind = kind;
      var g = vz.svg('g', { class: 'vz-hash-' + kind }, kind === 'meter' || kind === 'caption' ? ctx.layers.header : ctx.layers.hashbox);
      rec.el = g; rec.paint = paintFixed;
      if (kind === 'caption') {
        rec.t1 = vz.svg('text', { class: 'vz-caption', dy: '.35em' }, g);
        rec.t2 = vz.svg('text', { class: 'vz-hash-resize', dy: '.35em' }, g);
      } else if (kind === 'meter') {
        g.setAttribute('class', 'vz-hash-meter');
        rec.label = vz.svg('text', { class: 'vz-hash-meter-label', 'text-anchor': 'end', dy: '.35em' }, g);
        rec.track = vz.svg('rect', { class: 'vz-hash-meter-track', rx: 3, ry: 3, height: 6 }, g);
        rec.fill = vz.svg('rect', { class: 'vz-hash-meter-fill', rx: 3, ry: 3, height: 6 }, g);
        rec.tick = vz.svg('line', { class: 'vz-hash-meter-tick' }, g);
        rec.tickLabel = vz.svg('text', { class: 'vz-hash-meter-ticklabel', 'text-anchor': 'middle', dy: '.35em' }, g);
      } else if (kind === 'input') {
        rec.box = vz.svg('rect', { class: 'vz-hash-inputbox', rx: 10, ry: 10 }, g);
        rec.cap = vz.svg('text', { class: 'vz-caption', dy: '.35em' }, g);
      } else if (kind === 'hash') {
        rec.box = vz.svg('rect', { class: 'vz-hash-fnbox', rx: 12, ry: 12 }, g);
        rec.fn = vz.svg('text', { class: 'vz-hash-fn', 'text-anchor': 'middle', dy: '.35em' }, g);
        rec.val = vz.svg('text', { class: 'vz-hash-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      }
    }
    function paintFixed(rec) {
      var c = rec.cur;
      vz.opacity(rec.el, c.o);
      if (rec.kind === 'meter') {
        vz.set(rec.fill, 'width', n2(Math.max(0, c.f)));
      } else if (rec.kind === 'hash') {
        vz.set(rec.val, 'opacity', c.vo >= 0.999 ? null : Math.max(0, c.vo).toFixed(3));
      }
    }

    function buildDecor(rec, kind) {
      rec.kind = kind;
      var g = vz.svg('g', { class: kind === 'tomb' ? 'vz-hash-tomb' : 'vz-badge vz-hash-probe-badge' }, kind === 'tomb' ? ctx.layers.decor : ctx.layers.badges);
      if (kind === 'tomb') {
        rec.box = vz.svg('rect', { class: 'vz-slot', rx: 5, ry: 5 }, g);
        rec.txt = vz.svg('text', { class: 'vz-hash-tomb-text', 'text-anchor': 'middle', dy: '.35em' }, g);
      } else {
        rec.box = vz.svg('rect', { rx: 7.5, ry: 7.5, height: 15, y: -7.5 }, g);
        rec.txt = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, g);
      }
      rec.el = g; rec.paint = paintDecor;
    }
    function paintDecor(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, c.o);
    }

    /* ---------------------------------------------------------- draw */
    function draw(state, ms) {
      var N = L.normalize(state, opts.mode);
      noteReserve(N);
      G = geometry(N);
      ctx.setHeight(G.height);
      var gk = [G.rowH, G.slotW, G.entryW, G.bucketX, G.narrow, G.showHash].join('|');
      var geomChanged = gk !== geomKey;
      geomKey = gk;
      var sv = showValues(N);
      var anim = [], edgeList = [];
      var first = !api._drawn;
      api._drawn = true;

      function enter(rec, target, from, delay) {
        rec.cur = Object.assign({}, target, from || { o: 0 });
        vz.retarget(rec, target);
        rec.delay = delay || 0;
        anim.push(rec);
      }
      function update(rec, target) { vz.retarget(rec, target); rec.delay = 0; anim.push(rec); }
      function fade(list, extra) {
        list.forEach(function (rec) {
          rec.from = Object.assign({}, rec.cur);
          rec.to = Object.assign({}, rec.cur, { o: 0 }, extra || {});
          rec.delay = 0;
          anim.push(rec);
        });
      }
      function use(store, id, build, target, from, delay) {
        var rec = store.use(id, build);
        if (rec.isNew) enter(rec, target, from, delay); else update(rec, target);
        return rec;
      }

      /* header: caption + resize note + load meter */
      S.fixed.begin();
      var cap = S.fixed.use('caption', function (r) { buildFixed(r, 'caption'); });
      var capText = (G.narrow ? '' : (open ? 'slots' : 'buckets') + '  ') + 'm = ' + N.m;
      var capX = G.showHash && !G.narrow ? G.bucketX - 24 : G.pad;
      vz.text(cap.t1, capText);
      vz.set(cap.t1, 'x', capX);
      vz.set(cap.t1, 'y', G.headerY);
      var rz = N.resizing ? 'rehash ' + N.resizing.from + ' → ' + N.resizing.to : '';
      vz.text(cap.t2, rz);
      vz.set(cap.t2, 'x', G.twoLine ? capX : capX + vz.textWidth(capText, 11, false, 600) + 14);
      vz.set(cap.t2, 'y', G.twoLine ? G.headerY + 16 : G.headerY);
      if (cap.isNew) enter(cap, { o: 1 }); else update(cap, { o: 1 });

      if (opts.showLoad && N.showLoad) {
        var mt = S.fixed.use('meter', function (r) { buildFixed(r, 'meter'); });
        var thr = N.threshold !== null ? N.threshold : opts.threshold;
        var mx = L.meterMax(N.load, thr);
        var mw = G.meterW, mx0 = G.W - G.pad - mw;
        vz.set(mt.track, 'x', n2(mx0)); vz.set(mt.track, 'y', n2(G.headerY - 3)); vz.set(mt.track, 'width', n2(mw));
        vz.set(mt.fill, 'x', n2(mx0)); vz.set(mt.fill, 'y', n2(G.headerY - 3));
        var over = thr !== null && thr !== undefined && N.load > thr + 1e-9;
        vz.state(mt.el, over ? 'error' : 'active');
        var lbl = 'α = ' + (typeof state.loadFactor === 'number' || G.narrow ? vz.fmt(N.load) : N.count + '/' + N.m + ' = ' + vz.fmt(N.load));
        vz.text(mt.label, lbl);
        vz.set(mt.label, 'x', n2(mx0 - 8)); vz.set(mt.label, 'y', G.headerY);
        if (thr !== null && thr !== undefined) {
          var tx = mx0 + mw * thr / mx;
          vz.set(mt.tick, 'x1', n2(tx)); vz.set(mt.tick, 'x2', n2(tx));
          vz.set(mt.tick, 'y1', n2(G.headerY - 7)); vz.set(mt.tick, 'y2', n2(G.headerY + 7));
          vz.text(mt.tickLabel, vz.fmt(thr));
          vz.set(mt.tickLabel, 'x', n2(tx)); vz.set(mt.tickLabel, 'y', n2(G.headerY + 14));
          vz.set(mt.tick, 'opacity', null); vz.set(mt.tickLabel, 'opacity', null);
        } else { vz.set(mt.tick, 'opacity', 0); vz.set(mt.tickLabel, 'opacity', 0); }
        var ft = { o: 1, f: mw * Math.min(1, N.load / mx) };
        if (mt.isNew) enter(mt, ft, { o: first ? 1 : 0, f: 0 }); else update(mt, ft);
      }

      /* input area + hash function box */
      if (G.showHash) {
        var inp = S.fixed.use('input', function (r) { buildFixed(r, 'input'); });
        vz.set(inp.box, 'x', G.input.x); vz.set(inp.box, 'y', G.input.y);
        vz.set(inp.box, 'width', G.input.w); vz.set(inp.box, 'height', G.input.h);
        vz.text(inp.cap, N.incoming && N.incoming.op ? N.incoming.op : opts.inputLabel);
        vz.set(inp.cap, 'x', G.input.x + 10); vz.set(inp.cap, 'y', G.input.y + 13);
        if (inp.isNew) enter(inp, { o: 1 }); else update(inp, { o: 1 });

        var hb = S.fixed.use('hash', function (r) { buildFixed(r, 'hash'); });
        vz.set(hb.box, 'x', G.hash.x); vz.set(hb.box, 'y', G.hash.y);
        vz.set(hb.box, 'width', G.hash.w); vz.set(hb.box, 'height', G.hash.h);
        vz.text(hb.fn, N.hashFn || 'h(k)');
        vz.set(hb.fn, 'x', n2(G.hash.x + G.hash.w / 2)); vz.set(hb.fn, 'y', n2(G.hash.y + 16));
        var fnW = measure(N.hashFn || 'h(k)', 12, 600);
        vz.set(hb.fn, 'font-size', fnW > G.hash.w - 14 ? Math.max(9, Math.floor(12 * (G.hash.w - 14) / fnW)) : null);
        var hv = N.hashValue ? String(N.hashValue) : '';
        var hvChanged = hb.lastHV !== hv;
        hb.lastHV = hv;
        vz.text(hb.val, hv);
        vz.set(hb.val, 'x', n2(G.hash.x + G.hash.w / 2)); vz.set(hb.val, 'y', n2(G.hash.y + G.hash.h - 14));
        var hvW = measure(hv, 12, 700);
        vz.set(hb.val, 'font-size', hvW > G.hash.w - 12 ? Math.max(9, Math.floor(12 * (G.hash.w - 12) / hvW)) : null);
        vz.toggle(hb.el, 'is-busy', !!(N.incoming && N.incoming.stage === 'hash'));
        if (hb.isNew) enter(hb, { o: 1, vo: 1 }, { o: 0, vo: 0 });
        else { update(hb, { o: 1, vo: 1 }); if (hvChanged && hv) { hb.cur.vo = 0; hb.from.vo = 0; } }
      }
      fade(S.fixed.end());

      /* buckets */
      S.buckets.begin();
      var targetBucket = N.incoming && N.incoming.bucket !== null ? N.incoming.bucket : null;
      for (var b = 0; b < N.m; b++) {
        var brec = S.buckets.use('b' + b, buildBucket);
        brec.b = b;
        if (brec.isNew || geomChanged) sizeBucket(brec);
        vz.text(brec.idx, b);
        var st = N.bucketStates[b] || (b === targetBucket ? 'active' : (N.probe && N.probe.current === b ? N.probe.state : 'default'));
        vz.state(brec.el, st);
        var empty = open ? !N.slots[b] : !N.chains[b].length;
        var incHere = N.incoming && N.incoming.stage === 'bucket' && N.incoming.bucket === b;
        vz.text(brec.nul, open ? '' : (empty && !incHere ? '⌀' : ''));
        vz.set(brec.dot, 'opacity', !open && (!empty || incHere) ? null : 0);
        var bt = { y: G.rowY(b), o: 1 };
        if (brec.isNew) enter(brec, bt, { o: 0, y: bt.y - 8 }, first ? 0 : Math.min(0.35, 0.03 * b));
        else update(brec, bt);
      }
      fade(S.buckets.end());

      /* tombstones (open addressing) */
      S.decor.begin();
      N.tombstones.forEach(function (t) {
        if (N.slots[t]) return;
        var rec = S.decor.use('t' + t, function (r) { buildDecor(r, 'tomb'); });
        var w = G.slotW - 8, h = G.boxH;
        vz.set(rec.box, 'x', n2(-w / 2)); vz.set(rec.box, 'y', n2(-h / 2)); vz.set(rec.box, 'width', n2(w)); vz.set(rec.box, 'height', n2(h));
        vz.text(rec.txt, w >= 56 ? '† deleted' : '†');
        var tt = { x: G.bucketX + G.slotW / 2, y: G.rowY(t), o: 1, s: 1 };
        if (rec.isNew) enter(rec, tt, { o: 0, s: 0.8 }); else update(rec, tt);
      });
      fade(S.decor.end());

      /* entries + incoming key (one identity space) */
      S.entries.begin();
      var list = N.entries.map(function (e) { return { e: e, incoming: false }; });
      if (N.incoming) list.push({ e: N.incoming, incoming: true });
      var enterCount = 0;
      list.forEach(function (x) {
        var e = x.e, t;
        if (x.incoming && !G.showHash && e.stage !== 'bucket') t = { x: G.entryX(0, 0), y: G.bucketsTop - 14, w: G.entryW, h: G.boxH };
        else if (x.incoming && e.stage === 'input') t = { x: G.input.x + G.input.w / 2, y: G.input.y + G.input.h / 2 + 6, w: G.entryW, h: G.boxH };
        else if (x.incoming && e.stage === 'hash') t = { x: G.hash.x + G.hash.w / 2, y: G.hash.y + G.hash.h / 2 + 1, w: G.entryW, h: G.boxH };
        else t = { x: G.entryX(e.bucket, e.pos), y: G.rowY(e.bucket), w: G.entryW, h: G.boxH };
        t.o = 1; t.s = 1;
        var rec = S.entries.use(e.id, buildEntry);
        var wasHashing = !rec.isNew && rec.data && rec.data.incoming && rec.data.stage === 'hash';
        rec.data = { key: e.key, value: e.value, bucket: e.bucket, pos: e.pos, incoming: x.incoming, stage: x.incoming ? e.stage : 'entry' };
        // one deterministic class string (history-independent order)
        vz.set(rec.el, 'class', 'vz-item vz-hash-entry' + (x.incoming ? ' vz-hash-incoming' : '') + (clickable ? ' is-clickable' : '') + ' is-' + (e.state || 'default'));
        var txt = entryText(e, sv), fs = 12;
        var tw = measure(txt, 12, 650);
        if (tw > G.entryW - 8) fs = Math.max(8, Math.floor(12 * (G.entryW - 8) / tw));
        vz.text(rec.txt, txt);
        vz.set(rec.txt, 'font-size', fs);
        if (clickable) vz.set(rec.el, 'aria-label', (x.incoming ? 'incoming key ' : 'key ') + txt + (x.incoming ? '' : ', bucket ' + e.bucket));
        if (rec.isNew) {
          enter(rec, t, { o: 0, s: 0.6 }, Math.min(0.3, enterCount * 0.05));
          enterCount++;
        } else update(rec, t);
        // from the hash box to a bucket: reach the bucket's row first, then walk along it
        rec.travel = !!(wasHashing && rec.data.stage !== 'hash' && rec.data.stage !== 'input');
      });
      fade(S.entries.end(), { s: 0.7 });

      /* probe badges (open addressing) */
      S.badges.begin();
      if (N.probe) {
        var seen = {};
        N.probe.slots.forEach(function (slot, k) {
          seen[slot] = k + 1;
        });
        Object.keys(seen).forEach(function (slot) {
          slot = +slot;
          var rec = S.badges.use('p' + slot, function (r) { buildDecor(r, 'badge'); });
          var txt = String(seen[slot]);
          var w = Math.max(14, measure(txt, 10, 650) + 8);
          vz.set(rec.box, 'width', n2(w)); vz.set(rec.box, 'x', n2(-w / 2));
          vz.text(rec.txt, txt);
          vz.state(rec.el, slot === N.probe.current ? N.probe.state : 'default');
          var bt = { x: G.bucketX + 3, y: G.rowY(slot) - G.boxH / 2, o: 1, s: 1 };
          if (rec.isNew) enter(rec, bt, { o: 0, s: 0.5 }); else update(rec, bt);
        });
      }
      fade(S.badges.end());

      /* edges: chains, probe hops, input->hash, hash->bucket */
      S.edges.begin();
      function edge(key, shape, src, tgt, state) {
        var rec = S.edges.use(key, buildEdge);
        rec.shape = shape;
        rec.src = src;
        var same = rec.tgt && tgt && JSON.stringify(rec.tgt) === JSON.stringify(tgt);
        if (rec.isNew) {
          rec.tgt = tgt; rec.tgtOld = tgt;
          rec.cur = { o: 0, m: 1 }; vz.retarget(rec, { o: 1, m: 1 });
          rec.delay = first ? 0 : 0.35;
        } else if (!same) {
          rec.tgtOld = rec.cur.m < 0.999 && rec.lastEnd ? { kind: 'point', x: rec.lastEnd.x, y: rec.lastEnd.y } : rec.tgt;
          rec.tgt = tgt;
          rec.cur.m = 0; vz.retarget(rec, { o: 1, m: 1 }); rec.delay = 0;
        } else { vz.retarget(rec, { o: 1, m: 1 }); rec.delay = 0; }
        vz.state(rec.el, state || 'default');
        edgeList.push(rec);
        return rec;
      }
      if (!open) {
        for (var cb = 0; cb < N.m; cb++) {
          var chain = N.chains[cb].slice();
          if (N.incoming && N.incoming.stage === 'bucket' && N.incoming.bucket === cb) chain.splice(Math.min(N.incoming.pos, chain.length), 0, N.incoming);
          var prev = { kind: 'bucketDot', b: cb }, prevKey = 'b' + cb;
          chain.forEach(function (e) {
            edge('c:' + prevKey, 'chain', prev, { kind: 'entryLeft', id: e.id }, e.state === 'default' ? 'default' : (e.state === 'muted' ? 'muted' : 'default'));
            prev = { kind: 'entryRight', id: e.id }; prevKey = e.id;
          });
        }
      }
      if (open && N.probe && N.probe.slots.length > 1) {
        for (var k = 0; k + 1 < N.probe.slots.length; k++) {
          var a = N.probe.slots[k], bnext = N.probe.slots[k + 1];
          if (a === bnext) continue;
          edge('p:' + k, 'probe', { kind: 'slotRight', b: a }, { kind: 'slotRight', b: bnext }, N.probe.state);
        }
      }
      if (G.showHash) {
        edge('h:in', 'straightV', { kind: 'inputOut' }, { kind: 'hashIn' }, 'default');
        if (targetBucket !== null && N.incoming.stage !== 'input' && !G.narrow) edge('h:out', 'hash', { kind: 'hashOut' }, { kind: 'bucketLabel', b: targetBucket }, 'active');
      }
      S.edges.end().forEach(function (rec) {
        rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0;
        edgeList.push(rec);
      });

      tr.run(ms, function (t) {
        var i, rec;
        for (i = 0; i < anim.length; i++) {
          rec = anim[i];
          if (rec.travel) {
            var tt = vz.clamp((t - rec.delay) / (1 - rec.delay || 1), 0, 1);
            vz.step(rec, vz.easeInOut(tt));
            rec.cur.y = rec.from.y + (rec.to.y - rec.from.y) * vz.easeOut(Math.min(1, tt * 1.2));
          } else vz.step(rec, vz.local(t, rec.delay));
          rec.paint(rec);
        }
        for (i = 0; i < edgeList.length; i++) { rec = edgeList[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
      }, function () { Object.keys(S).forEach(function (k) { S[k].purge(); }); });
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      var N = L.normalize(state, opts.mode), sv = showValues(N);
      var parts = ['Hash table with ' + N.m + (open ? ' slots (open addressing)' : ' buckets (separate chaining)')];
      if (open) {
        var filled = [];
        N.slots.forEach(function (e, b) { if (e) filled.push(b + ': ' + entryText(e, sv)); });
        var tomb = N.tombstones.filter(function (t) { return !N.slots[t]; });
        parts.push(filled.length ? 'slots ' + filled.join(', ') : 'all slots empty');
        if (tomb.length) parts.push('deleted markers at ' + tomb.join(', '));
        if (N.probe) parts.push('probing ' + N.probe.slots.join(' → '));
      } else {
        var chains = [];
        N.chains.forEach(function (c, b) { if (c.length) chains.push('bucket ' + b + ': ' + c.map(function (e) { return entryText(e, sv); }).join(' → ')); });
        parts.push(chains.length ? chains.join('; ') : 'all buckets empty');
      }
      if (N.incoming) parts.push((N.incoming.op || 'key') + ' ' + vz.fmt(N.incoming.key) + (N.incoming.stage === 'input' ? ' waiting' : N.incoming.stage === 'hash' ? ' being hashed' + (N.hashValue ? ' (' + N.hashValue + ')' : '') : ' arriving at bucket ' + N.incoming.bucket));
      parts.push('load factor ' + vz.fmt(N.load));
      return parts.join('. ') + '.';
    };
    /* Scan all snapshots once: fixes the hash box, chain width and text width so nothing jumps. */
    api.prepare = function (states) {
      (states || []).forEach(function (s) { noteReserve(L.normalize(s, opts.mode)); });
      api.refresh();
      return api;
    };
    api.reset = function () { reserve = { hash: opts.showHash === true, m: 0, chain: 0, textW: 0, resize: false }; return api; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) {
        clickable = true;
        ctx.svg.setAttribute('role', 'group');
        S.entries.each(makeEntryClickable);
        S.buckets.each(makeBucketClickable);
      }
      return baseOn(evt, fn);
    };
    return api;
  }

  hashView.layout = L;
  hashView.defaults = DEFAULTS;
  VDSA.views.hashtable = hashView;
  VDSA.views.hash = hashView;
}(typeof window !== 'undefined' ? window : null));
