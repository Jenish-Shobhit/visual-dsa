/* VDSA.views.stack / queue / deque / ring — linear containers and circular buffers.

   Stack (bottom -> top), drawn as a tray of plates; push drops in from above, pop lifts out:
     const st = VDSA.views.stack('#fig', { capacity: 6 });
     st.render({ items: [{ id: 'a', value: '(' }, { id: 'b', value: '[', state: 'active' }] }, { duration });

   Queue (front -> rear); enqueue slides in at the rear, dequeue slides out at the front:
     const q = VDSA.views.queue('#fig');
     q.render({ items: [{ id: 'x', value: 4 }, { id: 'y', value: 9 }] });
   Deque: VDSA.views.deque(el, opts) — same as queue with front/back markers; items appearing or leaving at the
   front enter/exit on the left, at the back on the right.

   Ring buffer (fixed-capacity circular array) as a ring of slots with head/tail pointers that rotate the short
   way round, plus an optional unrolled row showing the same memory as a plain array:
     const r = VDSA.views.ring('#fig', { unrolled: true });
     r.render({ capacity: 8, slots: [null, { id: 'p', value: 3 }, ...], head: 1, tail: 4 });

   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> stack / queue / ring.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure layout (Node-testable) */
  var L = {};
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  var TAU = Math.PI * 2;

  /* Normalise items for stack/queue: explicit `index` wins, otherwise the array position. */
  L.items = function (state) {
    var out = [];
    ((state && state.items) || []).forEach(function (it, i) {
      if (it === null || it === undefined) return;
      if (typeof it !== 'object') it = { value: it };
      out.push({
        id: String(it.id !== undefined ? it.id : 'i' + i), value: it.value, text: it.text, state: it.state || 'default',
        label: it.label, badge: it.badge, slot: typeof it.index === 'number' ? it.index : i
      });
    });
    return out;
  };

  /* Where did an item enter/leave a queue or deque? prevIds/nextIds are id arrays in front->rear order.
     Returns {enter: {id: 'front'|'rear'|'middle'}, exit: {id: 'front'|'rear'|'middle'}}. */
  L.ends = function (prevIds, nextIds) {
    var prevSet = {}, nextSet = {}, enter = {}, exit = {};
    prevIds.forEach(function (id) { prevSet[id] = true; });
    nextIds.forEach(function (id) { nextSet[id] = true; });
    var keptNext = nextIds.filter(function (id) { return prevSet[id]; });
    var keptPrev = prevIds.filter(function (id) { return nextSet[id]; });
    nextIds.forEach(function (id, i) {
      if (prevSet[id]) return;
      if (!keptNext.length) enter[id] = 'rear';
      else if (i < nextIds.indexOf(keptNext[0])) enter[id] = 'front';
      else if (i > nextIds.indexOf(keptNext[keptNext.length - 1])) enter[id] = 'rear';
      else enter[id] = 'middle';
    });
    prevIds.forEach(function (id, i) {
      if (nextSet[id]) return;
      if (!keptPrev.length) exit[id] = i === 0 ? 'front' : 'rear';
      else if (i < prevIds.indexOf(keptPrev[0])) exit[id] = 'front';
      else if (i > prevIds.indexOf(keptPrev[keptPrev.length - 1])) exit[id] = 'rear';
      else exit[id] = 'middle';
    });
    return { enter: enter, exit: exit };
  };

  /* Ring: angle (radians, screen coordinates: 0 = right, clockwise positive) of the centre of slot i;
     slot 0 sits at 12 o'clock and indices run clockwise. */
  L.slotAngle = function (i, capacity) { return -Math.PI / 2 + (i * TAU) / capacity; };

  /* Equivalent angle to `to` that is closest to `from` (so rotations take the short way round). */
  L.nearestAngle = function (from, to) {
    var d = to - from;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return from + d;
  };

  /* SVG path of an annular sector between angles a0..a1 (radians) and radii r..R. */
  L.sector = function (cx, cy, r, R, a0, a1) {
    var large = a1 - a0 > Math.PI ? 1 : 0;
    function p(rad, a) { return (Math.round((cx + Math.cos(a) * rad) * 100) / 100) + ' ' + (Math.round((cy + Math.sin(a) * rad) * 100) / 100); }
    return 'M' + p(R, a0) + 'A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + p(R, a1) + 'L' + p(r, a1) + 'A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + p(r, a0) + 'Z';
  };

  /* Normalise ring state -> {capacity, slots: [item|null], head, tail, size}. Accepts slots[] or items with index. */
  L.ring = function (state) {
    state = state || {};
    var cap = Math.max(1, state.capacity || (state.slots ? state.slots.length : 0) || 8);
    var slots = [];
    for (var i = 0; i < cap; i++) slots.push(null);
    function put(it, i) {
      if (it === null || it === undefined || i < 0 || i >= cap) return;
      if (typeof it !== 'object') it = { value: it };
      slots[i] = { id: String(it.id !== undefined ? it.id : 's' + i), value: it.value, text: it.text, state: it.state || 'default', label: it.label };
    }
    if (Array.isArray(state.slots)) state.slots.forEach(function (it, i) { put(it, i); });
    (state.items || []).forEach(function (it, i) { if (it) put(it, typeof it.index === 'number' ? it.index : i); });
    var size = typeof state.size === 'number' ? state.size : slots.filter(Boolean).length;
    function idx(v) { return typeof v === 'number' ? ((v % cap) + cap) % cap : null; }
    return { capacity: cap, slots: slots, head: idx(state.head), tail: idx(state.tail), size: size };
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== views */
  var VDSA = root.VDSA, vz = VDSA.vz, fmt = vz.fmt, n2 = vz.n2;
  function easeOutBack(t) { var c1 = 1.05, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function copy(o, extra) { return Object.assign({}, o, extra || {}); }

  function itemText(opts, it) {
    if (it.text !== undefined) return String(it.text);
    return opts.labelFormatter ? String(opts.labelFormatter(it.value, it)) : fmt(it.value);
  }
  function fitText(str, px, maxW) {
    if (!str) return px;
    var w = vz.textWidth(str, px, false, 650);
    return w > maxW ? Math.max(8, Math.floor(px * maxW / w)) : px;
  }
  function badgeOn(rec, text, x, y) {
    if (text === undefined || text === null || text === '') { if (rec.badge) { rec.badge.g.remove(); rec.badge = null; } return; }
    if (!rec.badge) {
      var bg = vz.svg('g', { class: 'vz-badge' }, rec.el);
      rec.badge = { g: bg, rect: vz.svg('rect', { rx: 7, ry: 7, height: 14, y: -7 }, bg), text: vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, bg) };
    }
    var t = String(text), w = Math.max(14, vz.textWidth(t, 10, true, 650) + 8);
    vz.text(rec.badge.text, t);
    vz.set(rec.badge.rect, 'width', n2(w)); vz.set(rec.badge.rect, 'x', n2(-w / 2));
    vz.place(rec.badge.g, x, y);
  }

  /* ------------------------------------------------------------------ linear (stack / queue / deque) */
  var LINEAR_DEFAULTS = {
    capacity: null,          // fixed number of slots (dashed when empty); overflow shows the tray in error
    orientation: 'vertical', // stack only: 'vertical' | 'horizontal'
    cellSize: null,          // stack: plate height (36) / queue: box size (48)
    cellWidth: null,         // stack vertical: plate width (auto 84–150)
    showIndices: true,
    markers: true,           // auto pointers: stack "top", queue "front"/"rear", deque "front"/"back"
    reserve: 0,              // slots to reserve (prepare() computes this from a trace)
    labelFormatter: null,
    onItemClick: null,
    duration: undefined
  };

  function linearView(container, options, kind) {
    var opts = Object.assign({}, LINEAR_DEFAULTS, options || {});
    var isStack = kind === 'stack';
    var vertical = isStack && opts.orientation !== 'horizontal';
    var V = vz.createView(container, kind, {
      label: opts.label || (kind === 'stack' ? 'Stack figure' : kind === 'deque' ? 'Deque figure' : 'Queue figure'),
      className: 'vz-linear' + (vertical ? ' is-vertical' : ' is-horizontal'), interactive: !!opts.onItemClick,
      duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    ctx.layer('tray'); ctx.layer('slots'); ctx.layer('items'); ctx.layer('pointers');
    var S = { items: new vz.Store(true), slots: new vz.Store(), ptrs: new vz.Store() };
    var clickable = !!opts.onItemClick;
    var reserveSlots = opts.reserve || 0, reserveLv = { a: 0, b: 0 };
    var G = null, lastKey = '';
    var prevOrder = [];
    var tray = {
      el: vz.svg('g', { class: 'vz-tray' }, ctx.layers.tray),
      cur: {}, from: {}, to: {}
    };
    tray.path = vz.svg('path', { class: 'vz-tray-line' }, tray.el);
    tray.cap = vz.svg('text', { class: 'vz-caption vz-tray-caption', 'text-anchor': 'middle', dy: '.35em' }, tray.el);
    tray.empty = vz.svg('text', { class: 'vz-label vz-empty-text', 'text-anchor': 'middle', dy: '.35em' }, tray.el);
    vz.text(tray.empty, 'empty');

    function normalize(state) {
      state = state || {};
      var items = L.items(state);
      var cap = typeof state.capacity === 'number' ? state.capacity : opts.capacity;
      var ptrs = [];
      if (opts.markers !== false && state.markers !== false) {
        if (isStack) ptrs.push({ key: 'top', name: 'top', index: items.length ? items[items.length - 1].slot : -1, state: items.length ? 'active' : 'muted' });
        else if (items.length) {
          ptrs.push({ key: 'front', name: 'front', index: items[0].slot, state: 'active' });
          ptrs.push({ key: 'rear', name: kind === 'deque' ? 'back' : 'rear', index: items[items.length - 1].slot, state: kind === 'deque' ? 'active' : 'frontier' });
        }
      }
      (state.pointers || []).forEach(function (p) {
        if (!p) return;
        var index = typeof p.index === 'number' ? p.index : null;
        if (index === null && p.target !== undefined) items.forEach(function (it) { if (it.id === String(p.target)) index = it.slot; });
        if (index === null) return;
        var key = String(p.id !== undefined ? p.id : p.name);
        ptrs = ptrs.filter(function (q) { return q.key !== key; });
        ptrs.push({ key: key, name: String(p.name), label: p.label, index: index, state: p.state || 'active', side: p.side });
      });
      return { items: items, capacity: cap || null, pointers: ptrs, overflow: !!state.overflow || (cap && items.length > cap), label: state.label !== undefined ? state.label : opts.caption };
    }

    function geometry(N) {
      var W = ctx.width, pad = 12;
      var maxSlot = -1;
      N.items.forEach(function (it) { maxSlot = Math.max(maxSlot, it.slot); });
      var nSlots = Math.max(N.capacity || 0, maxSlot + 1, reserveSlots, 1);
      reserveSlots = Math.max(reserveSlots, maxSlot + 1);
      var g = { W: W, n: nSlots, vertical: vertical };
      // pointer stacking levels
      var lv = {}, maxA = 0, maxB = 0;
      N.pointers.forEach(function (p) {
        var side = vertical ? (p.side === 'left' ? 'left' : 'right') : (p.side === 'above' ? 'above' : 'below');
        p._side = side;
        var k = side + '|' + p.index;
        p._level = lv[k] || 0; lv[k] = p._level + 1;
        if (side === 'above' || side === 'left') maxA = Math.max(maxA, p._level + 1); else maxB = Math.max(maxB, p._level + 1);
      });
      reserveLv.a = Math.max(reserveLv.a, maxA); reserveLv.b = Math.max(reserveLv.b, maxB);
      if (vertical) {
        var bh = opts.cellSize || 36, gap = 5;
        var bw = opts.cellWidth || clamp(Math.round(W * 0.34), 84, 150);
        bw = Math.min(bw, W - 2 * pad - 130);
        bw = Math.max(bw, 56);
        g.bw = bw; g.bh = bh; g.gap = gap;
        g.cx = W / 2 - 24;
        g.top = 12 + bh + 14 + (N.label ? 18 : 0);   // room for the drop-in and a caption
        g.baseY = g.top + nSlots * (bh + gap) + 4;
        g.slot = function (k) { return { x: g.cx, y: g.baseY - 4 - gap / 2 - (k + 0.5) * (bh + gap) + gap / 2 }; };
        g.enterFrom = function (p) { return { x: p.x, y: g.top - bh - 6 }; };
        g.height = g.baseY + 14;
        g.font = clamp(Math.round(bh * 0.42), 11, 17);
      } else {
        var extra = 2.4; // entry/exit room at both ends
        var s = Math.min(opts.cellSize || 48, (W - 2 * pad) / (nSlots + extra));
        s = Math.max(s, 18);
        g.bw = s - Math.max(3, s * 0.1); g.bh = Math.min(g.bw, 52); g.gap = s - g.bw; g.s = s;
        var x0 = (W - nSlots * s) / 2;
        var y = 8 + (N.label ? 18 : 0);
        if (reserveLv.a) y += 14 + 20 + (reserveLv.a - 1) * 16;
        g.cy = y + g.bh / 2;
        y += g.bh;
        g.idxY = y + 16;
        y += opts.showIndices ? 24 : 6;
        g.ptrTipB = y + 2;
        if (reserveLv.b) y += 14 + 20 + (reserveLv.b - 1) * 16;
        g.ptrTipA = g.cy - g.bh / 2 - 3;
        g.slot = function (k) { return { x: x0 + (k + 0.5) * s, y: g.cy }; };
        g.x0 = x0;
        g.height = y + 8;
        g.font = clamp(Math.round(g.bh * 0.38), 10, 17);
      }
      if (opts.height) g.height = Math.max(g.height, opts.height);
      return g;
    }

    function buildItem(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-plate' }, ctx.layers.items);
      rec.shape = vz.svg('rect', { class: 'vz-shape' }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.sub = null; rec.badge = null;
      rec.el = g;
      rec.paint = paintItem;
      if (clickable) makeClickable(rec);
    }
    function makeClickable(rec) {
      vz.clickable(rec.el, null, function () {
        var d = rec.data || {};
        var payload = { id: rec.id, index: d.slot, value: d.value, item: d };
        em.emit('click', payload);
        if (opts.onItemClick) opts.onItemClick(payload);
      });
    }
    function paintItem(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, clamp(c.o, 0, 1));
    }
    function sizeItem(rec) {
      vz.set(rec.shape, 'x', n2(-G.bw / 2)); vz.set(rec.shape, 'y', n2(-G.bh / 2));
      vz.set(rec.shape, 'width', n2(G.bw)); vz.set(rec.shape, 'height', n2(G.bh));
      var r = Math.min(8, G.bh * 0.2);
      vz.set(rec.shape, 'rx', n2(r)); vz.set(rec.shape, 'ry', n2(r));
    }

    function buildSlot(rec, kindS) {
      rec.kind = kindS;
      if (kindS === 'ghost') rec.el = vz.svg('rect', { class: 'vz-slot' }, ctx.layers.slots);
      else rec.el = vz.svg('text', { class: 'vz-label', 'text-anchor': 'middle', dy: '.35em' }, ctx.layers.slots);
      rec.paint = function (r) {
        var c = r.cur;
        vz.opacity(r.el, c.o);
        if (r.kind === 'ghost') {
          vz.set(r.el, 'x', n2(c.x - G.bw / 2)); vz.set(r.el, 'y', n2(c.y - G.bh / 2));
          vz.set(r.el, 'width', n2(G.bw)); vz.set(r.el, 'height', n2(G.bh));
          vz.set(r.el, 'rx', n2(Math.min(8, G.bh * 0.2)));
        } else { vz.set(r.el, 'x', n2(c.x)); vz.set(r.el, 'y', n2(c.y)); }
      };
    }

    function buildPtr(rec) {
      var g = vz.svg('g', { class: 'vz-pointer' }, ctx.layers.pointers);
      rec.head = vz.svg('path', { class: 'vz-ptr-head' }, g);
      rec.stem = vz.svg('line', { class: 'vz-ptr-stem' }, g);
      rec.label = vz.svg('text', { class: 'vz-ptr-label', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = paintPtr;
    }
    function paintPtr(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y);
      vz.opacity(rec.el, c.o);
      var lv = c.lv, side = rec.side;
      if (side === 'right' || side === 'left') {
        var sg = side === 'right' ? 1 : -1;
        vz.set(rec.head, 'd', side === 'right' ? 'M0 0L8 -5.5Q6.4 0 8 5.5Z' : 'M0 0L-8 -5.5Q-6.4 0 -8 5.5Z');
        vz.set(rec.stem, 'x1', 7 * sg); vz.set(rec.stem, 'x2', n2((14 + lv * 0) * sg)); vz.set(rec.stem, 'y1', 0); vz.set(rec.stem, 'y2', 0);
        vz.set(rec.label, 'x', n2((18 + lv * 0) * sg)); vz.set(rec.label, 'y', n2(lv * 15));
        vz.set(rec.label, 'text-anchor', side === 'right' ? 'start' : 'end');
      } else {
        var up = side !== 'above';
        vz.set(rec.head, 'd', up ? 'M0 0L-5.5 8Q0 6.4 5.5 8Z' : 'M0 0L-5.5 -8Q0 -6.4 5.5 -8Z');
        vz.set(rec.stem, 'x1', 0); vz.set(rec.stem, 'x2', 0); vz.set(rec.stem, 'y1', up ? 7 : -7); vz.set(rec.stem, 'y2', up ? 12 : -12);
        vz.set(rec.label, 'x', 0); vz.set(rec.label, 'y', n2((up ? 1 : -1) * (21 + 15 * lv)));
        vz.set(rec.label, 'text-anchor', 'middle');
      }
      var a = c.a >= 0.999 ? null : c.a.toFixed(3);
      vz.set(rec.head, 'opacity', a); vz.set(rec.stem, 'opacity', a);
    }

    function paintTray(t) {
      var c = t.cur;
      vz.opacity(t.el, c.o);
      if (vertical) {
        var l = c.x - c.w / 2, r = c.x + c.w / 2, top = c.top, b = c.b;
        vz.set(t.path, 'd', 'M' + n2(l) + ' ' + n2(top) + 'L' + n2(l) + ' ' + n2(b - 6) + 'Q' + n2(l) + ' ' + n2(b) + ' ' + n2(l + 6) + ' ' + n2(b) + 'L' + n2(r - 6) + ' ' + n2(b) + 'Q' + n2(r) + ' ' + n2(b) + ' ' + n2(r) + ' ' + n2(b - 6) + 'L' + n2(r) + ' ' + n2(top));
      } else {
        var y1 = c.top, y2 = c.b, x1 = c.x - c.w / 2, x2 = c.x + c.w / 2;
        if (isStack) vz.set(t.path, 'd', 'M' + n2(x2) + ' ' + n2(y1) + 'L' + n2(x1 + 6) + ' ' + n2(y1) + 'Q' + n2(x1) + ' ' + n2(y1) + ' ' + n2(x1) + ' ' + n2(y1 + 6) + 'L' + n2(x1) + ' ' + n2(y2 - 6) + 'Q' + n2(x1) + ' ' + n2(y2) + ' ' + n2(x1 + 6) + ' ' + n2(y2) + 'L' + n2(x2) + ' ' + n2(y2));
        else vz.set(t.path, 'd', 'M' + n2(x1) + ' ' + n2(y1) + 'L' + n2(x2) + ' ' + n2(y1) + 'M' + n2(x1) + ' ' + n2(y2) + 'L' + n2(x2) + ' ' + n2(y2));
      }
      vz.set(t.cap, 'x', n2(c.x)); vz.set(t.cap, 'y', n2(c.cy));
      vz.set(t.empty, 'x', n2(c.ex)); vz.set(t.empty, 'y', n2(c.ey));
      vz.set(t.empty, 'opacity', c.eo < 0.005 ? 0 : c.eo.toFixed(3));
    }

    function draw(state, ms) {
      var N = normalize(state);
      G = geometry(N);
      ctx.setHeight(G.height);
      var key = [G.bw, G.bh].join('|');
      var resized = key !== lastKey;
      lastKey = key;
      var anim = [];
      var first = !api._drawn;
      api._drawn = true;

      /* tray */
      vz.toggle(tray.el, 'is-error', !!N.overflow);
      vz.text(tray.cap, N.label || '');
      var tt;
      if (vertical) {
        var topSlot = G.slot((N.capacity || G.n) - 1);
        tt = { x: G.cx, w: G.bw + 16, top: topSlot.y - G.bh / 2 - 8, b: G.baseY, cy: G.top - G.bh - 14 - (N.label ? 0 : 0), ex: G.cx, ey: G.slot(0).y, eo: N.items.length ? 0 : 1, o: 1 };
        tt.cy = 10;
      } else {
        var s0 = G.slot(0), sN = G.slot((isStack && N.capacity ? N.capacity : G.n) - 1);
        tt = { x: (s0.x + sN.x) / 2, w: sN.x - s0.x + G.bw + 14, top: G.cy - G.bh / 2 - 6, b: G.cy + G.bh / 2 + 6, cy: G.cy - G.bh / 2 - 6 - 14 - (reserveLv.a ? 14 + 20 + (reserveLv.a - 1) * 16 : 0), ex: (s0.x + sN.x) / 2, ey: G.cy, eo: N.items.length ? 0 : 1, o: 1 };
        if (isStack) tt.w += 10;
      }
      if (first) tray.cur = copy(tt);
      vz.retarget(tray, tt);
      tray.delay = 0; tray.paint = paintTray;
      anim.push(tray);

      /* slots: ghosts for capacity, index labels */
      S.slots.begin();
      var ghosts = N.capacity || 0;
      for (var k = 0; k < G.n; k++) {
        var p = G.slot(k);
        if (k < ghosts) {
          var gr = S.slots.use('g' + k, function (r) { buildSlot(r, 'ghost'); });
          var gt = { x: p.x, y: p.y, o: 1 };
          if (gr.isNew) { gr.cur = copy(gt, { o: 0 }); } vz.retarget(gr, gt); gr.delay = 0; anim.push(gr);
        }
        if (opts.showIndices) {
          var ir = S.slots.use('i' + k, function (r) { buildSlot(r, 'index'); });
          vz.text(ir.el, k);
          var it = vertical ? { x: G.cx - G.bw / 2 - 20, y: p.y, o: 1 } : { x: p.x, y: G.idxY, o: 1 };
          if (ir.isNew) { ir.cur = copy(it, { o: 0 }); } vz.retarget(ir, it); ir.delay = 0; anim.push(ir);
        }
      }
      S.slots.end().forEach(function (rec) { rec.from = copy(rec.cur); rec.to = copy(rec.cur, { o: 0 }); rec.delay = 0; anim.push(rec); });

      /* items */
      var ids = N.items.map(function (it) { return it.id; });
      var ends = L.ends(prevOrder, ids);
      var prevSlots = {};
      S.items.each(function (rec, id) { if (!rec.exiting && rec.data) prevSlots[id] = rec.data.slot; });
      S.items.begin();
      var enterN = 0;
      N.items.forEach(function (it) {
        var rec = S.items.use(it.id, buildItem);
        rec.data = it;
        if (rec.isNew || resized) sizeItem(rec);
        vz.state(rec.el, it.state);
        var str = itemText(opts, it);
        vz.text(rec.txt, str);
        vz.set(rec.txt, 'font-size', fitText(str, G.font, G.bw * 0.86));
        badgeOn(rec, it.badge, G.bw / 2 - 2, -G.bh / 2 - 1);
        if (clickable) vz.set(rec.el, 'aria-label', 'value ' + str + ', position ' + it.slot + (it.state !== 'default' ? ', ' + it.state : ''));
        var p = G.slot(it.slot);
        var t = { x: p.x, y: p.y, o: 1, s: 1 };
        rec.ease = null;
        if (rec.isNew) {
          var from;
          if (first) from = { x: p.x, y: p.y + (vertical ? -10 : 0), o: 0, s: 0.9 };
          else if (vertical) { from = { x: p.x, y: G.enterFrom(p).y, o: 0, s: 1 }; rec.ease = easeOutBack; }
          else {
            var side = ends.enter[it.id] || 'rear';
            if (isStack) side = 'rear';
            var dx = side === 'front' ? -G.s * 1.3 : side === 'rear' ? G.s * 1.3 : 0;
            from = { x: p.x + dx, y: p.y + (side === 'middle' ? -G.bh : 0), o: 0, s: 1 };
          }
          rec.cur = copy(t, from);
          vz.retarget(rec, t);
          rec.delay = ms > 0 ? Math.min(0.3, enterN++ * (first ? 0.06 : 0.05)) : 0;
        } else { vz.retarget(rec, t); rec.delay = 0; }
        anim.push(rec);
      });
      S.items.end().forEach(function (rec) {
        rec.from = copy(rec.cur);
        var to = copy(rec.cur, { o: 0 });
        if (vertical) to.y = rec.cur.y - G.bh * 1.6;
        else {
          var side = ends.exit[rec.id] || 'middle';
          if (isStack) side = 'rear';
          if (side === 'front') to.x = rec.cur.x - G.s * 1.3;
          else if (side === 'rear') to.x = rec.cur.x + G.s * 1.3;
          else to.y = rec.cur.y + G.bh;
        }
        rec.to = to; rec.delay = 0; rec.ease = null;
        anim.push(rec);
      });
      prevOrder = ids;

      /* pointers */
      S.ptrs.begin();
      N.pointers.forEach(function (p) {
        var rec = S.ptrs.use(p.key, buildPtr);
        rec.side = p._side;
        vz.text(rec.label, p.label !== undefined ? p.label : p.name);
        vz.state(rec.el, p.state);
        var sp = G.slot(p.index), t;
        if (p._side === 'right') t = { x: sp.x + G.bw / 2 + 4, y: sp.y, o: 1, lv: p._level, a: p._level ? 0 : 1 };
        else if (p._side === 'left') t = { x: sp.x - G.bw / 2 - 34, y: sp.y, o: 1, lv: p._level, a: p._level ? 0 : 1 };
        else if (p._side === 'above') t = { x: sp.x, y: G.ptrTipA, o: 1, lv: p._level, a: p._level ? 0 : 1 };
        else t = { x: sp.x, y: G.ptrTipB, o: 1, lv: p._level, a: p._level ? 0 : 1 };
        if (rec.isNew) { rec.cur = copy(t, { o: 0 }); rec.delay = ms > 0 ? 0.2 : 0; } else rec.delay = 0;
        vz.retarget(rec, t);
        anim.push(rec);
      });
      S.ptrs.end().forEach(function (rec) { rec.from = copy(rec.cur); rec.to = copy(rec.cur, { o: 0 }); rec.delay = 0; anim.push(rec); });

      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) {
          var rec = anim[i];
          vz.step(rec, vz.local(t, rec.delay, undefined, rec.ease || undefined));
          rec.paint(rec);
        }
      }, function () { Object.keys(S).forEach(function (k) { S[k].purge(); }); });
    }

    api.describe = function (state) {
      var N = normalize(state);
      var vals = N.items.map(function (it) { return itemText(opts, it); });
      if (isStack) return 'Stack (bottom to top): ' + (vals.length ? vals.join(', ') + '. Top is ' + vals[vals.length - 1] : 'empty') + (N.capacity ? '. Capacity ' + N.capacity : '') + (N.overflow ? '. Overflow!' : '') + '.';
      return (kind === 'deque' ? 'Deque' : 'Queue') + ' (front to ' + (kind === 'deque' ? 'back' : 'rear') + '): ' + (vals.length ? vals.join(', ') : 'empty') + (N.capacity ? '. Capacity ' + N.capacity : '') + '.';
    };
    /* Reserve slots and pointer lanes for a whole trace so the figure keeps one size. */
    api.prepare = function (states) {
      (states || []).forEach(function (st) { geometry(normalize(st)); });
      api.refresh();
      return api;
    };
    api.reset = function () { reserveSlots = opts.reserve || 0; reserveLv = { a: 0, b: 0 }; return api; };
    api.setOptions = function (o) { Object.assign(opts, o || {}); lastKey = ''; api.refresh(); return api; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) { clickable = true; ctx.svg.setAttribute('role', 'group'); S.items.each(makeClickable); }
      return baseOn(evt, fn);
    };
    return api;
  }

  /* ------------------------------------------------------------------ ring buffer */
  var RING_DEFAULTS = {
    unrolled: true,        // also draw the buffer as a plain row (the memory it really is)
    showIndices: true,
    showCenter: true,      // size / capacity in the middle
    labelFormatter: null,
    onItemClick: null,
    headLabel: 'head', tailLabel: 'tail',
    duration: undefined
  };

  function ringView(container, options) {
    var opts = Object.assign({}, RING_DEFAULTS, options || {});
    var V = vz.createView(container, 'ring', {
      label: opts.label || 'Ring buffer figure', interactive: !!opts.onItemClick, duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    ctx.layer('sectors'); ctx.layer('labels'); ctx.layer('items'); ctx.layer('row'); ctx.layer('pointers');
    var S = { sectors: new vz.Store(), labels: new vz.Store(), items: new vz.Store(true), row: new vz.Store(), ptrs: new vz.Store() };
    var clickable = !!opts.onItemClick;
    var G = null;
    var center = { el: vz.svg('g', { class: 'vz-ring-center' }, ctx.layers.labels), cur: {}, from: {}, to: {} };
    center.big = vz.svg('text', { class: 'vz-ring-size', 'text-anchor': 'middle', dy: '.35em' }, center.el);
    center.small = vz.svg('text', { class: 'vz-label vz-ring-sizecap', 'text-anchor': 'middle', dy: '.35em' }, center.el);
    center.paint = function (c) {
      vz.place(c.el, c.cur.x, c.cur.y);
      vz.opacity(c.el, c.cur.o);
      vz.set(c.big, 'y', n2(-c.cur.r * 0.1)); vz.set(c.small, 'y', n2(c.cur.r * 0.3));
    };

    function geometry(R) {
      var W = ctx.width;
      var outer = clamp(Math.min(W / 2 - 66, opts.radius || 122), 64, 160);
      var g = { W: W, cx: W / 2, cy: 12 + 44 + outer, R: outer, r: outer * 0.6, cap: R.capacity };
      g.gapA = Math.min(0.06, 2.2 / outer * 1.2);
      var y = g.cy + outer + 44;
      if (opts.unrolled) {
        var s = Math.min(46, (W - 24) / (R.capacity + 1.5));
        g.s = s; g.bw = s - Math.max(2, s * 0.1); g.bh = Math.min(g.bw, 40);
        g.x0 = (W - R.capacity * s) / 2;
        g.rowCy = y + 10 + g.bh / 2;
        g.idxY = g.rowCy + g.bh / 2 + 10;
        g.tipB = g.idxY + 10;
        y = g.tipB + 14 + 20 + 15 + 6;
      }
      g.height = y + 4;
      g.font = clamp(Math.round((g.R - g.r) * 0.34), 11, 18);
      return g;
    }
    function rowX(i) { return G.x0 + (i + 0.5) * G.s; }

    function buildSector(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-ring-slot' }, ctx.layers.sectors);
      rec.shape = vz.svg('path', { class: 'vz-shape' }, g);
      rec.el = g;
      rec.paint = function (r) {
        var c = r.cur;
        vz.opacity(r.el, c.o);
        vz.set(r.shape, 'd', L.sector(G.cx, G.cy, G.r, G.R, c.a0, c.a1));
      };
      if (clickable) makeClickable(rec, 'sector');
    }
    function buildLabel(rec) {
      rec.el = vz.svg('text', { class: 'vz-label', 'text-anchor': 'middle', dy: '.35em' }, ctx.layers.labels);
      rec.paint = function (r) {
        var c = r.cur;
        vz.opacity(r.el, c.o);
        vz.set(r.el, 'x', n2(G.cx + Math.cos(c.a) * c.rad)); vz.set(r.el, 'y', n2(G.cy + Math.sin(c.a) * c.rad));
      };
    }
    function buildItem(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-ring-value' }, ctx.layers.items);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = function (r) {
        var c = r.cur;
        vz.place(r.el, G.cx + Math.cos(c.a) * c.rad, G.cy + Math.sin(c.a) * c.rad, c.s);
        vz.opacity(r.el, clamp(c.o, 0, 1));
      };
    }
    function buildRowCell(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-ring-cell' }, ctx.layers.row);
      rec.shape = vz.svg('rect', { class: 'vz-shape' }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.idx = vz.svg('text', { class: 'vz-label', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = function (r) {
        var c = r.cur;
        vz.place(r.el, c.x, c.y);
        vz.opacity(r.el, c.o);
        vz.set(r.txt, 'opacity', c.to < 0.005 ? 0 : c.to >= 0.995 ? null : c.to.toFixed(3));
      };
      if (clickable) makeClickable(rec, 'cell');
    }
    function makeClickable(rec) {
      vz.clickable(rec.el, null, function () {
        var d = rec.data || {};
        var payload = { id: d.item ? d.item.id : null, index: d.index, value: d.item ? d.item.value : null, item: d.item || null };
        em.emit('click', payload);
        if (opts.onItemClick) opts.onItemClick(payload);
      });
    }
    function buildPtr(rec) {
      var g = vz.svg('g', { class: 'vz-pointer' }, ctx.layers.pointers);
      rec.head = vz.svg('path', { class: 'vz-ptr-head' }, g);
      rec.stem = vz.svg('line', { class: 'vz-ptr-stem' }, g);
      rec.chip = vz.svg('rect', { class: 'vz-ptr-chip', height: 18, rx: 9, ry: 9 }, g);
      rec.label = vz.svg('text', { class: 'vz-ptr-chip-text', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = function (r) {
        var c = r.cur;
        vz.opacity(r.el, c.o);
        if (r.linear) {
          vz.place(r.el, c.x, c.y);
          vz.set(r.head, 'd', 'M0 0L-5.5 8Q0 6.4 5.5 8Z');
          vz.set(r.stem, 'x1', 0); vz.set(r.stem, 'x2', 0); vz.set(r.stem, 'y1', 7); vz.set(r.stem, 'y2', 11);
          var ly = 21 + 20 * c.lv;
          vz.set(r.chip, 'y', n2(ly - 9)); vz.set(r.label, 'x', 0); vz.set(r.label, 'y', n2(ly)); vz.set(r.chip, 'x', n2(-r.cw / 2));
          var a0 = c.lv > 0.5 ? 0 : 1;
          vz.set(r.head, 'opacity', a0 ? null : 0); vz.set(r.stem, 'opacity', a0 ? null : 0);
          return;
        }
        // ring pointer: tip at radius R + 3 pointing inwards along angle a
        vz.place(r.el, G.cx, G.cy);
        var ca = Math.cos(c.a), sa = Math.sin(c.a);
        var tip = G.R + 3, len = 12 + 22 * c.lv, lab = tip + len + 16;
        var tx = ca * tip, ty = sa * tip;
        vz.set(r.head, 'd', vz.arrowHead(tx, ty, c.a + Math.PI, 8.5));
        vz.set(r.stem, 'x1', n2(ca * (tip + 7))); vz.set(r.stem, 'y1', n2(sa * (tip + 7)));
        vz.set(r.stem, 'x2', n2(ca * (tip + len + 5))); vz.set(r.stem, 'y2', n2(sa * (tip + len + 5)));
        var lx = ca * (lab + r.cw * 0.3 * Math.abs(ca)), lyy = sa * (lab + 4 * Math.abs(sa));
        vz.set(r.chip, 'x', n2(lx - r.cw / 2)); vz.set(r.chip, 'y', n2(lyy - 9));
        vz.set(r.label, 'x', n2(lx)); vz.set(r.label, 'y', n2(lyy));
        vz.set(r.head, 'opacity', null); vz.set(r.stem, 'opacity', null);
      };
    }

    function draw(state, ms) {
      var R = L.ring(state);
      G = geometry(R);
      ctx.setHeight(G.height);
      var cap = R.capacity, step = (Math.PI * 2) / cap;
      var anim = [];
      var first = !api._drawn;
      api._drawn = true;
      function push(rec, t, fromNew, delay) {
        if (rec.isNew) rec.cur = copy(t, fromNew || { o: 0 });
        vz.retarget(rec, t);
        rec.delay = rec.isNew && ms > 0 ? (delay || 0) : 0;
        anim.push(rec);
      }
      function exitAll(store, extra) {
        store.end().forEach(function (rec) { rec.from = copy(rec.cur); rec.to = copy(rec.cur, copy({ o: 0 }, extra)); rec.delay = 0; anim.push(rec); });
      }

      /* sectors (one per slot) + indices */
      S.sectors.begin(); S.labels.begin();
      var gap = G.gapA;
      for (var i = 0; i < cap; i++) {
        var mid = L.slotAngle(i, cap);
        var sec = S.sectors.use('s' + i, buildSector);
        var it = R.slots[i];
        sec.data = { index: i, item: it };
        vz.state(sec.el, it ? it.state : 'default');
        vz.toggle(sec.el, 'is-empty', !it);
        vz.toggle(sec.el, 'is-head', R.head === i);
        if (clickable) vz.set(sec.el, 'aria-label', 'slot ' + i + (it ? ', value ' + itemText(opts, it) : ', empty'));
        var a0 = mid - step / 2 + gap / 2, a1 = mid + step / 2 - gap / 2;
        if (!sec.isNew) { a0 = L.nearestAngle(sec.cur.a0, a0); a1 = a0 + (step - gap); }
        push(sec, { a0: a0, a1: a1, o: 1 }, { a0: mid, a1: mid + 0.001, o: 0 }, first ? i * 0.02 : 0);
        if (opts.showIndices) {
          var lb = S.labels.use('l' + i, buildLabel);
          vz.text(lb.el, i);
          var la = lb.isNew ? mid : L.nearestAngle(lb.cur.a, mid);
          push(lb, { a: la, rad: G.r - 12, o: 1 }, { a: mid, rad: G.r - 12, o: 0 });
        }
      }
      exitAll(S.sectors, null); exitAll(S.labels, null);

      /* values on the ring */
      S.items.begin();
      var enterN = 0;
      R.slots.forEach(function (it, i) {
        if (!it) return;
        var rec = S.items.use(it.id, buildItem);
        var str = itemText(opts, it);
        vz.text(rec.txt, str);
        var maxW = Math.min((G.R - G.r) * 0.9, step * (G.R + G.r) / 2 * 0.8);
        vz.set(rec.txt, 'font-size', fitText(str, G.font, maxW));
        vz.state(rec.el, it.state);
        var mid = L.slotAngle(i, cap);
        var a = rec.isNew ? mid : L.nearestAngle(rec.cur.a, mid);
        push(rec, { a: a, rad: (G.R + G.r) / 2, o: 1, s: 1 }, { a: mid, rad: (G.R + G.r) / 2, o: 0, s: 0.5 }, Math.min(0.3, enterN++ * 0.05));
      });
      exitAll(S.items, { s: 0.6 });

      /* unrolled row: one cell per slot (cell = slot, text fades with occupancy) */
      S.row.begin();
      if (opts.unrolled) {
        for (var k = 0; k < cap; k++) {
          var cell = S.row.use('c' + k, buildRowCell);
          var itk = R.slots[k];
          cell.data = { index: k, item: itk };
          vz.state(cell.el, itk ? itk.state : 'default');
          vz.toggle(cell.el, 'is-empty', !itk);
          vz.set(cell.shape, 'x', n2(-G.bw / 2)); vz.set(cell.shape, 'y', n2(-G.bh / 2));
          vz.set(cell.shape, 'width', n2(G.bw)); vz.set(cell.shape, 'height', n2(G.bh));
          vz.set(cell.shape, 'rx', n2(Math.min(7, G.bh * 0.18)));
          var cs = itk ? itemText(opts, itk) : '';
          if (itk) { vz.text(cell.txt, cs); vz.set(cell.txt, 'font-size', fitText(cs, clamp(Math.round(G.bh * 0.38), 10, 15), G.bw * 0.86)); cell.pendingClear = false; }
          else cell.pendingClear = true;   // keep the old value visible while it fades, clear it afterwards
          vz.text(cell.idx, k); vz.set(cell.idx, 'y', n2(G.bh / 2 + 10));
          vz.set(cell.idx, 'font-size', G.s < 26 ? 9 : 11);
          push(cell, { x: rowX(k), y: G.rowCy, o: 1, to: itk ? 1 : 0 }, { x: rowX(k), y: G.rowCy, o: 0, to: itk ? 1 : 0 });
        }
      }
      exitAll(S.row, null);

      /* pointers: head/tail on the ring and under the row */
      S.ptrs.begin();
      var ptrs = [];
      if (R.head !== null) ptrs.push({ key: 'head', name: opts.headLabel, index: R.head, state: 'active' });
      if (R.tail !== null) ptrs.push({ key: 'tail', name: opts.tailLabel, index: R.tail, state: 'frontier' });
      (state.pointers || []).forEach(function (p) { if (p && typeof p.index === 'number') ptrs.push({ key: String(p.id || p.name), name: String(p.name), index: ((p.index % cap) + cap) % cap, state: p.state || 'active' }); });
      var lvRing = {};
      ptrs.forEach(function (p) { p.lv = lvRing[p.index] || 0; lvRing[p.index] = p.lv + 1; });
      ptrs.forEach(function (p) {
        var cw = vz.textWidth(p.name, 11.5, true, 700) + 14;
        var rec = S.ptrs.use('r:' + p.key, buildPtr);
        rec.linear = false; rec.cw = cw;
        vz.text(rec.label, p.name); vz.set(rec.chip, 'width', n2(cw));
        vz.state(rec.el, p.state);
        var mid = L.slotAngle(p.index, cap);
        var a = rec.isNew ? mid : L.nearestAngle(rec.cur.a, mid);
        push(rec, { a: a, lv: p.lv, o: 1 }, { a: mid, lv: p.lv, o: 0 }, 0.2);
        if (opts.unrolled) {
          var rr = S.ptrs.use('u:' + p.key, buildPtr);
          rr.linear = true; rr.cw = cw;
          vz.text(rr.label, p.name); vz.set(rr.chip, 'width', n2(cw));
          vz.state(rr.el, p.state);
          push(rr, { x: rowX(p.index), y: G.tipB, lv: p.lv, o: 1 }, { x: rowX(p.index), y: G.tipB, lv: p.lv, o: 0 }, 0.2);
        }
      });
      exitAll(S.ptrs, null);

      /* centre */
      if (opts.showCenter) {
        var full = R.size >= cap, empty = R.size === 0;
        vz.text(center.big, full ? 'full' : empty ? 'empty' : String(R.size));
        vz.text(center.small, full || empty ? R.size + ' / ' + cap : 'of ' + cap);
        vz.set(center.big, 'font-size', n2(clamp(G.r * (full || empty ? 0.34 : 0.5), 13, 34)));
        vz.toggle(center.el, 'is-full', full);
        vz.toggle(center.el, 'is-emptyring', empty);
      }
      var ct = { x: G.cx, y: G.cy, r: G.r, o: opts.showCenter ? 1 : 0 };
      if (first) center.cur = copy(ct, { o: 0 });
      vz.retarget(center, ct); center.delay = 0;
      anim.push(center);

      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) { var rec = anim[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
      }, function () {
        S.row.each(function (r) { if (r.pendingClear) { vz.text(r.txt, ''); r.pendingClear = false; } });
        Object.keys(S).forEach(function (k) { S[k].purge(); });
      });
    }

    api.describe = function (state) {
      var R = L.ring(state);
      var filled = [];
      R.slots.forEach(function (it, i) { if (it) filled.push('slot ' + i + ' = ' + itemText(opts, it)); });
      return 'Ring buffer with capacity ' + R.capacity + ', size ' + R.size + (filled.length ? ': ' + filled.join(', ') : ' (empty)') +
        (R.head !== null ? '. head at ' + R.head : '') + (R.tail !== null ? ', tail at ' + R.tail : '') + '.';
    };
    api.setOptions = function (o) { Object.assign(opts, o || {}); api.refresh(); return api; };
    api.prepare = function () { return api; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) {
        clickable = true; ctx.svg.setAttribute('role', 'group');
        S.sectors.each(function (r) { makeClickable(r); }); S.row.each(function (r) { makeClickable(r); });
      }
      return baseOn(evt, fn);
    };
    return api;
  }

  VDSA.views.stack = function (el, opts) { return linearView(el, opts, 'stack'); };
  VDSA.views.queue = function (el, opts) { return linearView(el, Object.assign({}, opts), opts && opts.deque ? 'deque' : 'queue'); };
  VDSA.views.deque = function (el, opts) { return linearView(el, opts, 'deque'); };
  VDSA.views.ring = ringView;
  VDSA.views.stack.layout = VDSA.views.queue.layout = VDSA.views.deque.layout = VDSA.views.ring.layout = L;
}(typeof window !== 'undefined' ? window : null));
