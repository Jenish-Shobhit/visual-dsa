/* VDSA.views.memory(container, options) — memory diagrams in two modes.

   mode: 'ram' — rows of addressed cells (a hexdump you can animate): values, optional bits, variable names
   bracketing the cells they occupy, pointer arrows from a cell holding an address to the cell it points at.

     const ram = VDSA.views.memory('#ram', { mode: 'ram', perRow: 8 });
     ram.render({
       base: 0x1000, wordSize: 1,
       cells: [{ value: 0 }, { value: 0 }, { value: 1 }, { value: 44, state: 'swap' }, { value: "'h'" }, ...],
       vars: [{ name: 'n', type: 'int', from: 0, to: 3 }, { name: 's', type: 'char[3]', from: 4, to: 6 }],
       pointers: [{ from: 8, to: 4 }]                  // cell 8 holds the address of cell 4
     }, { duration: ctx.duration });

   mode: 'stackheap' — call-stack frames on the left, heap objects on the right, pointer arrows from variables
   (and from object fields) to heap objects. Arrows are recomputed every frame and re-route smoothly.

     const mem = VDSA.views.memory('#mem', { mode: 'stackheap' });
     mem.render({
       frames: [{ id: 'main', fn: 'main', vars: [{ name: 'xs', ptr: 'arr1' }, { name: 'n', value: 3 }] },
                { id: 'f1', fn: 'sum', args: 'a, 3', state: 'active', vars: [{ name: 'a', ptr: 'arr1' }] }],
       heap: [{ id: 'arr1', kind: 'array', label: 'int[3]', fields: [{ value: 4 }, { value: 1 }, { value: 7 }] },
              { id: 'n1', kind: 'node', label: 'Node', fields: [{ name: 'val', value: 5 }, { name: 'next', ptr: null }] }]
     });

   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> memory.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure layout (Node-testable) */
  var L = {};

  L.hex = function (n, digits) {
    var s = Math.max(0, Math.round(n)).toString(16).toUpperCase();
    while (s.length < (digits || 0)) s = '0' + s;
    return '0x' + s;
  };
  /* Binary string of an integer, grouped to `width` bits (auto 8/16/32). */
  L.bits = function (value, width) {
    var v = Math.round(+value);
    if (!isFinite(v)) return '';
    if (!width) width = v >= 0 && v < 256 ? 8 : v >= -32768 && v < 65536 ? 16 : 32;
    var u = v < 0 ? (Math.pow(2, width) + v) : v;
    var s = u.toString(2);
    while (s.length < width) s = '0' + s;
    return s.slice(-width);
  };

  /* Normalise RAM cells from cells[] or values[] and resolve addresses. */
  L.ramCells = function (state) {
    state = state || {};
    var base = state.base === undefined ? 0x1000 : state.base, ws = state.wordSize || 1;
    var src = state.cells || (state.values || []).map(function (v) { return { value: v }; });
    return src.map(function (c, i) {
      if (c === null || typeof c !== 'object') c = { value: c };
      return { index: i, value: c.value, text: c.text, state: c.state || 'default', addr: c.addr !== undefined ? c.addr : base + i * ws, bits: c.bits, id: c.id };
    });
  };
  /* Split an inclusive cell range into per-row segments: [{row, from, to}]. */
  L.segments = function (from, to, perRow) {
    var out = [];
    if (to < from) return out;
    for (var r = Math.floor(from / perRow); r <= Math.floor(to / perRow); r++) {
      out.push({ row: r, from: Math.max(from, r * perRow), to: Math.min(to, r * perRow + perRow - 1) });
    }
    return out;
  };

  /* Route a pointer arrow from a source point to a target box {x, y, w, h}.
     Returns cubic control points {sx, sy, c1x, c1y, c2x, c2y, ex, ey, angle} (angle = arrival direction).
     Exits right and enters the left edge when the box is to the right; otherwise enters from the top or bottom;
     a box level with or behind the source gets a loop over the top. */
  L.route = function (sx, sy, box, opts) {
    opts = opts || {};
    var gap = opts.gap === undefined ? 12 : opts.gap;
    var ex, ey, c1x, c1y, c2x, c2y, angle;
    var inset = Math.min(12, box.h / 2), insetX = Math.min(14, box.w / 2);
    if (box.x >= sx + gap) {
      ex = box.x - 1; ey = Math.max(box.y + inset, Math.min(box.y + box.h - inset, sy));
      var k = Math.max(18, Math.min(90, (ex - sx) * 0.45));
      var k1 = Math.max(k, Math.min(ex - sx - 8, opts.minExit || 0));
      c1x = sx + k1; c1y = sy; c2x = ex - k; c2y = ey; angle = 0;
    } else if (box.y >= sy + gap) {
      ex = Math.max(box.x + insetX, Math.min(box.x + box.w - insetX, sx)); ey = box.y - 1;
      var kd = Math.max(16, Math.min(70, (ey - sy) * 0.5));
      c1x = sx + (opts.exitRight ? kd : 0); c1y = sy + (opts.exitRight ? 0 : kd); c2x = ex; c2y = ey - kd; angle = Math.PI / 2;
    } else if (box.y + box.h <= sy - gap) {
      ex = Math.max(box.x + insetX, Math.min(box.x + box.w - insetX, sx)); ey = box.y + box.h + 1;
      var ku = Math.max(16, Math.min(70, (sy - ey) * 0.5));
      c1x = sx + (opts.exitRight ? ku : 0); c1y = sy - (opts.exitRight ? 0 : ku); c2x = ex; c2y = ey + ku; angle = -Math.PI / 2;
    } else {
      ex = box.x + box.w / 2; ey = box.y - 1;
      var lift = 34 + Math.min(40, Math.abs(sx - ex) * 0.15);
      c1x = sx + 30; c1y = Math.min(sy, box.y) - lift; c2x = ex; c2y = box.y - lift; angle = Math.PI / 2;
    }
    return { sx: sx, sy: sy, c1x: c1x, c1y: c1y, c2x: c2x, c2y: c2y, ex: ex, ey: ey, angle: angle };
  };
  L.lerpRoute = function (a, b, t) {
    var o = {};
    ['sx', 'sy', 'c1x', 'c1y', 'c2x', 'c2y', 'ex', 'ey'].forEach(function (k) { o[k] = a[k] + (b[k] - a[k]) * t; });
    var da = a.angle, db = b.angle;
    while (db - da > Math.PI) db -= 2 * Math.PI;
    while (da - db > Math.PI) db += 2 * Math.PI;
    o.angle = da + (db - da) * t;
    return o;
  };

  /* Frame height for n variable rows. */
  L.frameHeight = function (n) { return 28 + Math.max(0, n) * 26 + (n ? 6 : 8); };

  /* Flow heap objects into a column of width `width`. items: [{w, h, sameRow?, x?, y?}] (x = fraction of width,
     y = px). Returns [{x, y}] relative to the heap origin and the total height. */
  L.flow = function (items, width, opts) {
    opts = opts || {};
    var gapX = opts.gapX === undefined ? 34 : opts.gapX, gapY = opts.gapY === undefined ? 20 : opts.gapY;
    var out = [], rowTop = 0, rowH = 0, cx = 0, started = false, bottom = 0;
    items.forEach(function (it) {
      if (typeof it.x === 'number' || typeof it.y === 'number') {
        var p = { x: (typeof it.x === 'number' ? it.x : 0) * width, y: typeof it.y === 'number' ? it.y : rowTop };
        out.push(p); bottom = Math.max(bottom, p.y + it.h);
        return;
      }
      if (started && it.sameRow && cx + gapX + it.w <= width + 0.5) {
        out.push({ x: cx + gapX, y: rowTop });
        cx += gapX + it.w; rowH = Math.max(rowH, it.h);
      } else {
        if (started) rowTop += rowH + gapY;
        out.push({ x: 0, y: rowTop });
        cx = it.w; rowH = it.h; started = true;
      }
      bottom = Math.max(bottom, rowTop + rowH);
    });
    return { positions: out, height: bottom };
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz, n2 = vz.n2, fmt = vz.fmt;

  var DEFAULTS = {
    mode: 'stackheap',        // 'stackheap' | 'ram'
    // ram
    perRow: null,             // cells per row (auto: 8 wide, 4 narrow)
    cellWidth: null,          // max cell width in px (default 64)
    showBits: false,          // binary line under numeric values
    bitWidth: null,           // bits per cell (auto 8/16/32)
    addressMode: 'row',       // 'row' (row start address at the left) | 'cell' (address above every cell)
    addrDigits: 4,
    format: null,             // (value, cell) -> display string (e.g. v => VDSA.views.memory.layout.hex(v, 4))
    // stackheap
    stackGrows: 'down',       // 'down' (outermost frame on top, calls stack below) | 'up' (newest on top)
    frameWidth: null,         // px (auto)
    stackLabel: 'Stack', heapLabel: 'Heap',
    label: null, duration: undefined
  };

  function memoryView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var ram = opts.mode === 'ram';
    var V = vz.createView(container, 'memory', {
      label: opts.label || (ram ? 'Memory cells' : 'Stack and heap diagram'),
      className: 'vz-memory-' + (ram ? 'ram' : 'stackheap'), duration: opts.duration, describe: opts.describe
    }, ram ? drawRam : drawStackHeap);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    ['captions', 'frames', 'heap', 'vars', 'arrows'].forEach(ctx.layer);
    var clickable = false;
    var mcache = new Map();
    function measure(t, px, mono, w) {
      var k = t + '|' + px + '|' + (mono ? 1 : 0) + '|' + (w || 400), v = mcache.get(k);
      if (v === undefined) { v = vz.textWidth(t, px, mono, w); mcache.set(k, v); }
      return v;
    }
    function run(ms, anim, arrows, stores) {
      tr.run(ms, function (t) {
        var i, rec;
        for (i = 0; i < anim.length; i++) { rec = anim[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
        for (i = 0; i < arrows.length; i++) { rec = arrows[i]; vz.step(rec, vz.local(t, rec.delay)); rec.paint(rec); }
      }, function () { stores.forEach(function (s) { s.purge(); }); });
    }
    function mkHelpers(anim, first) {
      var H = {};
      H.enter = function (rec, target, from, delay) {
        rec.cur = Object.assign({}, target, from || { o: 0 });
        vz.retarget(rec, target); rec.delay = delay || 0; anim.push(rec);
      };
      H.update = function (rec, target) { vz.retarget(rec, target); rec.delay = 0; anim.push(rec); };
      H.use = function (store, id, build, target, from, delay) {
        var rec = store.use(id, build);
        if (rec.isNew) H.enter(rec, target, from, delay); else H.update(rec, target);
        return rec;
      };
      H.fade = function (list, extra) {
        list.forEach(function (rec) {
          rec.from = Object.assign({}, rec.cur);
          rec.to = Object.assign({}, rec.cur, { o: 0 }, extra || {});
          rec.delay = 0; anim.push(rec);
        });
      };
      H.first = first;
      return H;
    }
    function drawArrowPath(rec, R, startGap) {
      if (startGap) {
        // begin at the rim of the source dot, along the initial tangent
        var dx = R.c1x - R.sx, dy = R.c1y - R.sy, dl = Math.hypot(dx, dy) || 1;
        R = Object.assign({}, R, { sx: R.sx + dx / dl * startGap, sy: R.sy + dy / dl * startGap });
      }
      var d = 'M' + n2(R.sx) + ' ' + n2(R.sy) + 'C' + n2(R.c1x) + ' ' + n2(R.c1y) + ' ' + n2(R.c2x) + ' ' + n2(R.c2y) + ' ' + n2(R.ex) + ' ' + n2(R.ey);
      vz.set(rec.line, 'd', d);
      vz.set(rec.head, 'd', vz.arrowHead(R.ex, R.ey, R.angle, 8, 4.6));
    }
    function buildArrow(rec) {
      var g = vz.svg('g', { class: 'vz-edge vz-mem-arrow' }, ctx.layers.arrows);
      rec.line = vz.svg('path', { class: 'vz-line' }, g);
      rec.head = vz.svg('path', { class: 'vz-head' }, g);
      rec.el = g;
    }
    /* Retarget an arrow keyed by its source: tgt descriptors are resolved on every frame. */
    function retargetArrow(rec, tgt, first) {
      var same = rec.tgt !== undefined && JSON.stringify(rec.tgt) === JSON.stringify(tgt);
      if (rec.isNew) {
        rec.tgt = tgt; rec.tgtOld = tgt;
        rec.cur = { o: 0, m: 1 }; vz.retarget(rec, { o: 1, m: 1 });
        rec.delay = first ? 0 : 0.3;
      } else if (!same) {
        rec.tgtOld = rec.cur.m < 0.999 && rec.lastEnd ? { kind: 'box', box: rec.lastEnd } : rec.tgt;
        rec.tgt = tgt;
        rec.cur.m = 0; vz.retarget(rec, { o: 1, m: 1 }); rec.delay = 0;
      } else { vz.retarget(rec, { o: 1, m: 1 }); rec.delay = 0; }
    }

    /* ================================================================ RAM mode */
    var R = { cells: new vz.Store(), vars: new vz.Store(), addrs: new vz.Store(), ptrs: new vz.Store() };
    var ramReserve = { vars: false, ptrs: false, bits: false };
    var RG = null;

    function ramGeometry(cells, state) {
      var W = ctx.width, pad = 12;
      var perRow = state.perRow || opts.perRow || (W >= 600 ? 8 : 4);
      var g = { W: W, perRow: perRow, n: cells.length };
      g.cellMode = opts.addressMode === 'cell';
      var addrW = g.cellMode ? 0 : measure(L.hex(0, opts.addrDigits), 11, true, 500) + 14;
      var maxW = opts.cellWidth || 64;
      g.cw = Math.max(26, Math.min(maxW, (W - 2 * pad - addrW) / perRow));
      g.bits = ramReserve.bits;
      g.ch = g.bits ? 54 : 40;
      var blockW = addrW + perRow * g.cw;
      g.x0 = Math.max(pad, (W - blockW) / 2) + addrW;   // left edge of cell 0
      g.addrX = g.x0 - 10;
      g.varLane = ramReserve.vars ? 24 : 0;
      g.addrLane = g.cellMode ? 15 : 0;
      g.ptrLane = ramReserve.ptrs ? 28 : 0;
      g.rowH = g.varLane + g.addrLane + g.ch + g.ptrLane + 8;
      g.rows = Math.max(1, Math.ceil(cells.length / perRow));
      g.top = 6;
      g.cellTop = function (r) { return g.top + r * g.rowH + g.varLane + g.addrLane; };
      g.cellX = function (i) { return g.x0 + (i % perRow) * g.cw; };
      g.row = function (i) { return Math.floor(i / perRow); };
      g.height = g.top + g.rows * g.rowH + 4;
      return g;
    }

    function buildCell(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-mem-cell' }, ctx.layers.frames);
      rec.box = vz.svg('rect', { class: 'vz-shape' }, g);
      rec.val = vz.svg('text', { class: 'vz-ink vz-value vz-mono', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.bits = vz.svg('text', { class: 'vz-ink vz-mem-bits vz-mono', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.addr = vz.svg('text', { class: 'vz-label vz-mem-celladdr', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintCell;
      if (clickable) makeCellClickable(rec);
    }
    function makeCellClickable(rec) {
      vz.clickable(rec.el, null, function () { var d = rec.data || {}; em.emit('click', { id: d.id !== undefined ? d.id : 'cell-' + d.index, type: 'cell', index: d.index, addr: d.addr, value: d.value }); });
    }
    function paintCell(rec) {
      var c = rec.cur, sc = 1 + 0.08 * Math.sin(Math.PI * c.p);
      var cx = c.x + RG.cw / 2, cy = c.y + RG.ch / 2;
      vz.place(rec.el, cx, cy, sc);
      vz.opacity(rec.el, c.o);
    }
    function buildVar(rec) {
      var g = vz.svg('g', { class: 'vz-mem-var' }, ctx.layers.captions);
      rec.path = vz.svg('path', { class: 'vz-mem-bracket' }, g);
      rec.name = vz.svg('text', { class: 'vz-mem-varname', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintVar;
    }
    function paintVar(rec) {
      var c = rec.cur;
      vz.opacity(rec.el, c.o);
      var x1 = c.x1 + 3, x2 = c.x2 - 3, y = c.y;
      vz.set(rec.path, 'd', 'M' + n2(x1) + ' ' + n2(y + 6) + 'L' + n2(x1) + ' ' + n2(y) + 'L' + n2(x2) + ' ' + n2(y) + 'L' + n2(x2) + ' ' + n2(y + 6));
      vz.set(rec.name, 'x', n2((c.x1 + c.x2) / 2)); vz.set(rec.name, 'y', n2(y - 8));
    }
    function buildAddr(rec) {
      rec.el = vz.svg('text', { class: 'vz-label vz-mem-addr', 'text-anchor': 'end', dy: '.35em' }, ctx.layers.captions);
      rec.paint = function (r) { vz.opacity(r.el, r.cur.o); vz.set(r.el, 'x', n2(r.cur.x)); vz.set(r.el, 'y', n2(r.cur.y)); };
    }
    function cellBox(i) {
      var r = RG.row(i);
      return { x: RG.cellX(i), y: RG.cellTop(r), w: RG.cw, h: RG.ch, row: r };
    }
    function ramArrowRoute(src, tgt) {
      var s = cellBox(src), t = cellBox(tgt);
      var sx = s.x + s.w / 2, tx = t.x + t.w / 2;
      if (s.row === t.row) {
        var sy = s.y + s.h + 2, ey = t.y + t.h + 3;
        var depth = Math.min(RG.ptrLane + 8, 14 + Math.abs(tx - sx) * 0.12);
        return { sx: sx, sy: sy, c1x: sx, c1y: sy + depth, c2x: tx, c2y: ey + depth, ex: tx, ey: ey, angle: -Math.PI / 2 };
      }
      if (t.row > s.row) {
        var sy2 = s.y + s.h + 2, ey2 = t.y - RG.addrLane - 2;
        return { sx: sx, sy: sy2, c1x: sx, c1y: sy2 + 34, c2x: tx, c2y: ey2 - 34, ex: tx, ey: ey2, angle: Math.PI / 2 };
      }
      var sy3 = s.y - 2, ey3 = t.y + t.h + 3;
      return { sx: sx, sy: sy3, c1x: sx, c1y: sy3 - 34, c2x: tx, c2y: ey3 + 34, ex: tx, ey: ey3, angle: -Math.PI / 2 };
    }
    function paintRamArrow(rec) {
      var c = rec.cur;
      vz.opacity(rec.el, c.o);
      if (rec.src >= RG.n) { vz.set(rec.el, 'opacity', 0); return; }
      var a = ramArrowRoute(rec.src, Math.min(rec.tgtOld.cell, RG.n - 1)), b = ramArrowRoute(rec.src, Math.min(rec.tgt.cell, RG.n - 1));
      var Rr = L.lerpRoute(a, b, c.m);
      rec.lastEnd = null;
      drawArrowPath(rec, Rr);
    }

    function drawRam(state, ms) {
      var cells = L.ramCells(state);
      if ((state.vars || []).length) ramReserve.vars = true;
      if ((state.pointers || []).length) ramReserve.ptrs = true;
      if (opts.showBits || cells.some(function (c) { return c.bits; })) ramReserve.bits = true;
      RG = ramGeometry(cells, state);
      ctx.setHeight(RG.height);
      var anim = [], arrows = [], first = !api._drawn;
      api._drawn = true;
      var H = mkHelpers(anim, first);

      R.cells.begin();
      cells.forEach(function (c, i) {
        var rec = R.cells.use('c' + i, buildCell);
        rec.data = c;
        vz.state(rec.el, c.state);
        var text = c.text !== undefined ? String(c.text) : opts.format ? String(opts.format(c.value, c)) : fmt(c.value);
        var changed = !rec.isNew && rec.lastText !== text;
        rec.lastText = text;
        var w = RG.cw - 1, h = RG.ch;
        vz.set(rec.box, 'x', n2(-RG.cw / 2)); vz.set(rec.box, 'y', n2(-h / 2));
        vz.set(rec.box, 'width', n2(w + 1)); vz.set(rec.box, 'height', n2(h));
        vz.text(rec.val, text);
        var fs = 13, tw = measure(text, 13, true, 650);
        if (tw > w - 8) fs = Math.max(8, Math.floor(13 * (w - 8) / tw));
        vz.set(rec.val, 'font-size', fs);
        vz.set(rec.val, 'y', RG.bits ? -9 : 0);
        var bits = '';
        if (RG.bits) {
          if (typeof c.bits === 'string') bits = c.bits;
          else if ((c.bits || opts.showBits) && typeof c.value === 'number') bits = L.bits(c.value, opts.bitWidth);
        }
        vz.text(rec.bits, bits);
        vz.set(rec.bits, 'y', 12);
        var bfs = bits ? Math.max(6, Math.min(9.5, (w - 6) / (bits.length * 0.6))) : 9;
        vz.set(rec.bits, 'font-size', n2(bfs));
        vz.text(rec.addr, RG.cellMode ? L.hex(c.addr, opts.addrDigits) : '');
        vz.set(rec.addr, 'y', n2(-h / 2 - 8));
        vz.set(rec.addr, 'font-size', RG.cw < 58 ? Math.max(7, Math.floor(RG.cw / 6.2)) : 9.5);
        if (clickable) vz.set(rec.el, 'aria-label', 'address ' + L.hex(c.addr, opts.addrDigits) + ', value ' + text);
        var b = cellBox(i);
        var t = { x: b.x, y: b.y, o: 1, p: 1 };
        if (rec.isNew) H.enter(rec, t, { o: 0, p: 1 }, first ? Math.min(0.3, i * 0.012) : 0);
        else { H.update(rec, t); if (changed && ms > 0) { rec.cur.p = 0; rec.from.p = 0; } }
      });
      H.fade(R.cells.end());

      R.addrs.begin();
      if (!RG.cellMode) {
        for (var r = 0; r < RG.rows; r++) {
          var ar = R.addrs.use('r' + r, buildAddr);
          var first0 = cells[r * RG.perRow];
          vz.text(ar.el, first0 ? L.hex(first0.addr, opts.addrDigits) : '');
          var at = { x: RG.addrX, y: RG.cellTop(r) + RG.ch / 2, o: 1 };
          if (ar.isNew) H.enter(ar, at, { o: 0 }); else H.update(ar, at);
        }
      }
      H.fade(R.addrs.end());

      R.vars.begin();
      (state.vars || []).forEach(function (v, vi) {
        if (typeof v.from !== 'number') return;
        var to = typeof v.to === 'number' ? v.to : v.from;
        L.segments(v.from, Math.min(to, cells.length - 1), RG.perRow).forEach(function (sg, si) {
          var key = (v.id !== undefined ? v.id : v.name || 'v' + vi) + '#' + si;
          var rec = R.vars.use(key, buildVar);
          vz.state(rec.el, v.state || 'default');
          var label = si === 0 ? (v.name || '') + (v.type ? ' : ' + v.type : '') : '…';
          vz.text(rec.name, label);
          var t = { x1: RG.cellX(sg.from), x2: RG.cellX(sg.to) + RG.cw, y: RG.cellTop(sg.row) - RG.addrLane - 5, o: 1 };
          if (rec.isNew) H.enter(rec, t, { o: 0, x1: (t.x1 + t.x2) / 2, x2: (t.x1 + t.x2) / 2 }); else H.update(rec, t);
        });
      });
      H.fade(R.vars.end());

      R.ptrs.begin();
      (state.pointers || []).forEach(function (p, pi) {
        if (typeof p.from !== 'number' || typeof p.to !== 'number' || p.from >= cells.length || p.to >= cells.length) return;
        var key = p.id !== undefined ? String(p.id) : 'p' + p.from;
        var rec = R.ptrs.use(key, function (r) { buildArrow(r); r.paint = paintRamArrow; });
        rec.src = p.from;
        retargetArrow(rec, { cell: p.to }, first);
        vz.state(rec.el, p.state || 'default');
        arrows.push(rec);
        void pi;
      });
      R.ptrs.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; arrows.push(rec); });

      run(ms, anim, arrows, [R.cells, R.addrs, R.vars, R.ptrs]);
    }

    /* ================================================================ stack/heap mode */
    var SH = { frames: new vz.Store(), vars: new vz.Store(), objs: new vz.Store(), fields: new vz.Store(), arrows: new vz.Store(), caps: new vz.Store() };
    var shReserve = { stackH: 0, heapH: 0 };
    var SG = null;

    function norm(state) {
      var frames = (state.frames || []).filter(Boolean).map(function (f, i) {
        return {
          id: String(f.id !== undefined ? f.id : 'frame' + i), fn: f.fn || f.name || 'frame', args: f.args, state: f.state || 'default', returnValue: f.returnValue,
          vars: (f.vars || []).filter(Boolean).map(function (v, j) {
            return { key: String(v.id !== undefined ? v.id : v.name !== undefined ? v.name : 'v' + j), name: v.name !== undefined ? v.name : '', value: v.value, ptr: v.ptr, isPtr: Object.prototype.hasOwnProperty.call(v, 'ptr'), state: v.state || 'default', ptrState: v.ptrState, type: v.type };
          })
        };
      });
      var heap = (state.heap || []).filter(Boolean).map(function (o, i) {
        return {
          id: String(o.id !== undefined ? o.id : 'obj' + i), kind: o.kind || 'object', label: o.label, state: o.state || 'default', x: o.x, y: o.y, sameRow: !!o.sameRow, showIndices: o.showIndices,
          fields: (o.fields || []).map(function (f, j) {
            if (f === null || typeof f !== 'object') f = { value: f };
            return { key: String(f.id !== undefined ? f.id : f.name !== undefined ? f.name : j), name: f.name, value: f.value, ptr: f.ptr, isPtr: Object.prototype.hasOwnProperty.call(f, 'ptr'), state: f.state || 'default', ptrState: f.ptrState };
          })
        };
      });
      return { frames: frames, heap: heap };
    }
    function valueText(v) { return v.isPtr ? (v.ptr === null || v.ptr === undefined ? '⌀' : '') : fmt(v.value); }

    /* size heap objects (pure-ish, uses text measurement) */
    function sizeObject(o) {
      var lab = o.label ? measure(String(o.label), 11, true, 650) : 0;
      if (o.kind === 'array') {
        var maxT = 0;
        o.fields.forEach(function (f) { maxT = Math.max(maxT, measure(valueText(f) || '•', 12.5, true, 650)); });
        var cw = vz.clamp(Math.ceil(maxT + 14), 30, 56);
        var ll = o.label ? 17 : 0, idx = o.showIndices === false ? 0 : 14;
        o.cw = cw; o.ll = ll;
        o.w = Math.max(o.fields.length * cw, lab + 4, 30); o.h = ll + 30 + idx;
        o.fieldBox = function (j) { return { x: j * cw, y: ll, w: cw, h: 30 }; };
      } else if (o.kind === 'node') {
        var ll2 = o.label ? 15 : 0, nl = o.fields.some(function (f) { return f.name; }) ? 13 : 0, x = 0, boxes = [];
        o.fields.forEach(function (f) {
          var w = vz.clamp(Math.ceil(Math.max(f.name ? measure(String(f.name), 9.5, true, 500) : 0, measure(valueText(f) || '•', 12.5, true, 650)) + 16), 34, 80);
          boxes.push({ x: x, y: ll2 + nl, w: w, h: 30 }); x += w;
        });
        o.w = Math.max(x, lab + 4, 34); o.h = ll2 + nl + 30; o.ll = ll2; o.nl = nl;
        o.fieldBox = function (j) { return boxes[j]; };
      } else {
        var nameW = 0, valW = 0;
        o.fields.forEach(function (f) {
          nameW = Math.max(nameW, f.name !== undefined ? measure(String(f.name), 11.5, true, 500) : 0);
          valW = Math.max(valW, measure(valueText(f) || '•', 12.5, true, 650));
        });
        var ncol = Math.ceil(nameW + 16), vcol = vz.clamp(Math.ceil(valW + 16), 40, 110);
        o.w = Math.max(ncol + vcol + 6, lab + 20, 70); o.h = 24 + o.fields.length * 26 + 6;
        var vx = o.w - vcol - 6;
        o.ncol = ncol;
        o.fieldBox = function (j) { return { x: vx, y: 24 + j * 26 + 3, w: vcol, h: 20 }; };
      }
    }

    function shGeometry(N) {
      var W = ctx.width, pad = 12;
      var g = { W: W, narrow: W < 560 };
      g.fw = opts.frameWidth || Math.round(vz.clamp(W * (g.narrow ? 0.44 : 0.34), 140, 250));
      g.stackX = pad;
      g.gutter = g.narrow ? 26 : 44;
      g.heapX = pad + g.fw + g.gutter;
      g.heapW = Math.max(80, W - pad - g.heapX);
      g.top = 30;
      g.vbw = Math.round(vz.clamp(g.fw * 0.42, 50, 96));
      // frames
      var stackH = 0;
      N.frames.forEach(function (f) { f.h = L.frameHeight(f.vars.length); stackH += f.h + 10; });
      stackH = Math.max(0, stackH - 10);
      shReserve.stackH = Math.max(shReserve.stackH, stackH);
      var y;
      if (opts.stackGrows === 'up') {
        var floor = g.top + shReserve.stackH;
        y = floor;
        for (var i = 0; i < N.frames.length; i++) { var f = N.frames[i]; y -= f.h; f.y = y; y -= 10; }
      } else {
        y = g.top;
        N.frames.forEach(function (f) { f.y = y; y += f.h + 10; });
      }
      // heap
      N.heap.forEach(sizeObject);
      var fl = L.flow(N.heap, g.heapW);
      N.heap.forEach(function (o, j) { o.x0 = g.heapX + fl.positions[j].x; o.y0 = g.top + fl.positions[j].y; });
      shReserve.heapH = Math.max(shReserve.heapH, fl.height);
      g.height = g.top + Math.max(shReserve.stackH, shReserve.heapH, 40) + 16;
      return g;
    }

    function buildFrame(rec) {
      var g = vz.svg('g', { class: 'vz-item vz-mem-frame' }, ctx.layers.frames);
      rec.body = vz.svg('rect', { class: 'vz-mem-frame-body', rx: 10, ry: 10 }, g);
      rec.head = vz.svg('path', { class: 'vz-shape vz-mem-frame-head' }, g);
      rec.title = vz.svg('text', { class: 'vz-ink vz-mem-frame-title', dy: '.35em' }, g);
      rec.badge = vz.svg('g', { class: 'vz-badge vz-mem-ret' }, g);
      rec.badgeRect = vz.svg('rect', { rx: 7, ry: 7, height: 15, y: -7.5 }, rec.badge);
      rec.badgeText = vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, rec.badge);
      rec.el = g; rec.paint = paintFrame;
      if (clickable) makeFrameClickable(rec);
    }
    function makeFrameClickable(rec) {
      vz.clickable(rec.el, null, function () { em.emit('click', { id: rec.id, type: 'frame', fn: rec.data && rec.data.fn }); });
    }
    function paintFrame(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y);
      vz.opacity(rec.el, c.o);
      vz.set(rec.body, 'height', n2(Math.max(28, c.h)));
    }
    function buildVarRow(rec, parent) {
      var g = vz.svg('g', { class: 'vz-mem-varrow' }, parent);
      rec.name = vz.svg('text', { class: 'vz-mem-varname2', dy: '.35em' }, g);
      rec.box = vz.svg('g', { class: 'vz-item vz-mem-val' }, g);
      rec.rect = vz.svg('rect', { class: 'vz-shape', rx: 5, ry: 5, height: 20, y: -10 }, rec.box);
      rec.val = vz.svg('text', { class: 'vz-ink vz-value vz-mono', 'text-anchor': 'middle', dy: '.35em' }, rec.box);
      rec.dot = vz.svg('circle', { class: 'vz-mem-dot', r: 3.5 }, rec.box);
      rec.el = g; rec.paint = paintVarRow;
    }
    function paintVarRow(rec) { vz.place(rec.el, 0, rec.cur.y); vz.opacity(rec.el, rec.cur.o); }

    function buildObj(rec, o) {
      var g = vz.svg('g', { class: 'vz-mem-obj vz-mem-' + o.kind }, ctx.layers.heap);
      rec.kind = o.kind;
      rec.frame = vz.svg('rect', { class: 'vz-mem-objframe', rx: o.kind === 'object' ? 9 : 6, ry: o.kind === 'object' ? 9 : 6 }, g);
      rec.label = vz.svg('text', { class: 'vz-mem-objlabel', dy: '.35em' }, g);
      rec.fieldsG = vz.svg('g', null, g);
      rec.el = g; rec.paint = paintObj;
      if (clickable) makeObjClickable(rec);
    }
    function makeObjClickable(rec) {
      vz.clickable(rec.el, null, function () { em.emit('click', { id: rec.id, type: 'object', kind: rec.kind }); });
    }
    function paintObj(rec) {
      var c = rec.cur, s = c.s;
      vz.place(rec.el, c.x + c.w / 2 * (1 - s), c.y + c.h / 2 * (1 - s), s);
      vz.opacity(rec.el, c.o);
    }
    function buildField(rec, parent, inline) {
      var g = vz.svg('g', { class: 'vz-item vz-mem-field' + (inline ? ' vz-mem-inline' : '') }, parent);
      rec.rect = vz.svg('rect', { class: 'vz-shape' }, g);
      rec.val = vz.svg('text', { class: 'vz-ink vz-value vz-mono', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.dot = vz.svg('circle', { class: 'vz-mem-dot', r: 3.5 }, g);
      rec.name = vz.svg('text', { class: 'vz-mem-fieldname', dy: '.35em' }, g);
      rec.idx = vz.svg('text', { class: 'vz-label vz-mem-idx', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g; rec.paint = paintField;
    }
    function paintField(rec) { vz.place(rec.el, rec.cur.x, rec.cur.y); vz.opacity(rec.el, rec.cur.o); }

    /* arrow anchors */
    function objBox(id) {
      var r = SH.objs.get(id);
      if (!r) return null;
      var c = r.cur, s = c.s === undefined ? 1 : c.s;
      return { x: c.x + c.w / 2 * (1 - s), y: c.y + c.h / 2 * (1 - s), w: c.w * s, h: c.h * s };
    }
    function srcPoint(src) {
      if (src.kind === 'var') {
        var f = SH.frames.get(src.frame), v = SH.vars.get(src.key);
        if (!f || !v) return null;
        return { x: f.cur.x + SG.fw - 8 - SG.vbw / 2, y: f.cur.y + v.cur.y };
      }
      var o = SH.objs.get(src.obj), fr = SH.fields.get(src.key);
      if (!o || !fr) return null;
      var c = o.cur, s = c.s === undefined ? 1 : c.s;
      var ox = c.x + c.w / 2 * (1 - s), oy = c.y + c.h / 2 * (1 - s);
      return { x: ox + (fr.cur.x + fr.w / 2) * s, y: oy + (fr.cur.y + fr.h / 2) * s };
    }
    function resolveBox(t) {
      if (!t) return null;
      if (t.kind === 'box') return t.box;
      return objBox(t.id);
    }
    function paintShArrow(rec) {
      var c = rec.cur;
      var s = srcPoint(rec.src);
      var a = resolveBox(rec.tgtOld), b = resolveBox(rec.tgt);
      if (!b) b = a; if (!a) a = b;
      if (!s || !b) { vz.set(rec.el, 'opacity', 0); return; }
      vz.opacity(rec.el, c.o);
      var o2 = { exitRight: rec.src.kind === 'var', minExit: rec.src.kind === 'var' ? SG.vbw / 2 + 8 + SG.gutter * 0.55 : 0 };
      var Ra = L.route(s.x, s.y, a, o2), Rb = L.route(s.x, s.y, b, o2);
      var Rr = c.m >= 0.999 ? Rb : L.lerpRoute(Ra, Rb, c.m);
      rec.lastEnd = { x: vz.lerp(a.x, b.x, c.m), y: vz.lerp(a.y, b.y, c.m), w: vz.lerp(a.w, b.w, c.m), h: vz.lerp(a.h, b.h, c.m) };
      drawArrowPath(rec, Rr, 5);
    }

    function drawStackHeap(state, ms) {
      var N = norm(state);
      SG = shGeometry(N);
      ctx.setHeight(SG.height);
      var anim = [], arrows = [], first = !api._drawn;
      api._drawn = true;
      var H = mkHelpers(anim, first);

      /* captions */
      SH.caps.begin();
      [['stack', opts.stackLabel, SG.stackX], ['heap', opts.heapLabel, SG.heapX]].forEach(function (cp) {
        if (!cp[1]) return;
        var rec = SH.caps.use(cp[0], function (r) {
          r.el = vz.svg('text', { class: 'vz-caption vz-mem-caption', dy: '.35em' }, ctx.layers.captions);
          r.paint = function (x) { vz.opacity(x.el, x.cur.o); vz.set(x.el, 'x', n2(x.cur.x)); vz.set(x.el, 'y', 14); };
        });
        vz.text(rec.el, cp[1]);
        var t = { x: cp[2] + 2, o: 1 };
        if (rec.isNew) H.enter(rec, t, { o: 0 }); else H.update(rec, t);
      });
      H.fade(SH.caps.end());

      /* frames + variable rows */
      SH.frames.begin(); SH.vars.begin();
      N.frames.forEach(function (f, fi) {
        var rec = SH.frames.use(f.id, buildFrame);
        rec.data = f;
        vz.state(rec.el, f.state);
        vz.set(rec.body, 'width', SG.fw);
        var r = 10, hh = 26, w = SG.fw;
        vz.set(rec.head, 'd', 'M0 ' + hh + 'V' + r + 'Q0 0 ' + r + ' 0H' + (w - r) + 'Q' + w + ' 0 ' + w + ' ' + r + 'V' + hh + 'Z');
        var title = f.fn + '(' + (f.args !== undefined ? f.args : '') + ')';
        vz.text(rec.title, title);
        vz.set(rec.title, 'x', 10); vz.set(rec.title, 'y', 13);
        var hasRet = f.returnValue !== undefined && f.returnValue !== null;
        var rt = hasRet ? '→ ' + fmt(f.returnValue) : '';
        var bw = hasRet ? Math.max(20, measure(rt, 10, true, 650) + 10) : 0;
        var maxTitle = w - 20 - (hasRet ? bw + 6 : 0);
        var tw = measure(title, 12, true, 650);
        vz.set(rec.title, 'font-size', tw > maxTitle ? Math.max(8, Math.floor(12 * maxTitle / tw)) : null);
        vz.text(rec.badgeText, rt);
        vz.set(rec.badgeRect, 'width', n2(bw)); vz.set(rec.badgeRect, 'x', n2(-bw / 2));
        vz.place(rec.badge, w - 8 - bw / 2, 13);
        vz.set(rec.badge, 'opacity', hasRet ? null : 0);
        vz.state(rec.badge, hasRet ? 'done' : 'default');
        var t = { x: SG.stackX, y: f.y, h: f.h, o: 1 };
        if (rec.isNew) H.enter(rec, t, { o: 0, y: f.y - 26, h: f.h }, first ? Math.min(0.3, fi * 0.06) : 0);
        else H.update(rec, t);
        f.vars.forEach(function (v, vi) {
          var vr = SH.vars.use(f.id + '/' + v.key, function (x) { buildVarRow(x, rec.el); });
          vr.data = v;
          vz.text(vr.name, v.name + (v.type ? ' : ' + v.type : ''));
          vz.set(vr.name, 'x', 10);
          var nameMax = SG.fw - SG.vbw - 24, nw = measure(vr.name.textContent, 11.5, true, 500);
          vz.set(vr.name, 'font-size', nw > nameMax ? Math.max(8, Math.floor(11.5 * nameMax / nw)) : null);
          vz.place(vr.box, SG.fw - 8 - SG.vbw / 2, 0);
          vz.set(vr.rect, 'width', SG.vbw); vz.set(vr.rect, 'x', n2(-SG.vbw / 2));
          vz.state(vr.box, v.state);
          var vt = valueText(v);
          vz.text(vr.val, vt);
          var vw = measure(vt, 12.5, true, 650);
          vz.set(vr.val, 'font-size', vw > SG.vbw - 8 ? Math.max(8, Math.floor(12.5 * (SG.vbw - 8) / vw)) : null);
          vz.set(vr.dot, 'opacity', v.isPtr && v.ptr !== null && v.ptr !== undefined ? null : 0);
          var vt2 = { y: 28 + vi * 26 + 13, o: 1 };
          if (vr.isNew) H.enter(vr, vt2, { o: 0, y: vt2.y - 6 }, rec.isNew ? 0.15 : 0.1);
          else H.update(vr, vt2);
        });
      });
      H.fade(SH.vars.end());
      SH.frames.end().forEach(function (rec) {
        rec.from = Object.assign({}, rec.cur);
        rec.to = Object.assign({}, rec.cur, { o: 0, y: rec.cur.y - 26 });
        rec.delay = 0; anim.push(rec);
      });

      /* heap objects + fields */
      SH.objs.begin(); SH.fields.begin();
      N.heap.forEach(function (o, oi) {
        var rec = SH.objs.use(o.id, function (r) { buildObj(r, o); });
        if (rec.kind !== o.kind) { rec.kind = o.kind; rec.el.setAttribute('class', 'vz-mem-obj vz-mem-' + o.kind); rec.el.__vzS = null; }
        vz.state(rec.el, o.state);
        var fr = o.kind === 'object' ? { x: 0, y: 0, w: o.w, h: o.h } : o.kind === 'node' ? { x: -3, y: (o.ll || 0) + (o.nl || 0) - 3, w: o.w + 6, h: 36 } : { x: -3, y: (o.ll || 0) - 3, w: o.w + 6, h: 36 };
        vz.set(rec.frame, 'x', n2(fr.x)); vz.set(rec.frame, 'y', n2(fr.y)); vz.set(rec.frame, 'width', n2(fr.w)); vz.set(rec.frame, 'height', n2(fr.h));
        vz.text(rec.label, o.label || '');
        if (o.kind === 'object') { vz.set(rec.label, 'x', 9); vz.set(rec.label, 'y', 12); }
        else { vz.set(rec.label, 'x', 0); vz.set(rec.label, 'y', 6); }
        var t = { x: o.x0, y: o.y0, w: o.w, h: o.h, o: 1, s: 1 };
        if (rec.isNew) H.enter(rec, t, { o: 0, s: 0.75 }, first ? Math.min(0.3, 0.08 * oi) : 0.12);
        else H.update(rec, t);
        o.fields.forEach(function (f, j) {
          var frec = SH.fields.use(o.id + '/' + f.key, function (x) { buildField(x, rec.fieldsG, o.kind !== 'object'); });
          var b = o.fieldBox(j);
          frec.w = b.w; frec.h = b.h; frec.data = f;
          vz.state(frec.el, f.state);
          vz.set(frec.rect, 'x', 0); vz.set(frec.rect, 'y', 0); vz.set(frec.rect, 'width', n2(b.w)); vz.set(frec.rect, 'height', n2(b.h));
          var rr = o.kind === 'object' ? 5 : 0;
          vz.set(frec.rect, 'rx', rr); vz.set(frec.rect, 'ry', rr);
          var vt = valueText(f);
          vz.text(frec.val, vt);
          vz.set(frec.val, 'x', n2(b.w / 2)); vz.set(frec.val, 'y', n2(b.h / 2));
          var vw = measure(vt, 12.5, true, 650);
          vz.set(frec.val, 'font-size', vw > b.w - 8 ? Math.max(8, Math.floor(12.5 * (b.w - 8) / vw)) : null);
          vz.set(frec.dot, 'cx', n2(b.w / 2)); vz.set(frec.dot, 'cy', n2(b.h / 2));
          vz.set(frec.dot, 'opacity', f.isPtr && f.ptr !== null && f.ptr !== undefined ? null : 0);
          var nm = '';
          if (o.kind === 'object' && f.name !== undefined) { nm = String(f.name); vz.set(frec.name, 'x', n2(-(b.x - 9))); vz.set(frec.name, 'y', n2(b.h / 2)); vz.set(frec.name, 'text-anchor', null); }
          else if (o.kind === 'node' && f.name !== undefined) { nm = String(f.name); vz.set(frec.name, 'x', n2(b.w / 2)); vz.set(frec.name, 'y', -8); vz.set(frec.name, 'text-anchor', 'middle'); }
          vz.text(frec.name, nm);
          vz.text(frec.idx, o.kind === 'array' && o.showIndices !== false ? j : '');
          vz.set(frec.idx, 'x', n2(b.w / 2)); vz.set(frec.idx, 'y', n2(b.h + 8));
          var ft = { x: b.x, y: b.y, o: 1 };
          if (frec.isNew) H.enter(frec, ft, { o: rec.isNew ? 1 : 0 }, rec.isNew ? 0 : 0.1); else H.update(frec, ft);
        });
      });
      H.fade(SH.fields.end());
      SH.objs.end().forEach(function (rec) {
        rec.from = Object.assign({}, rec.cur);
        rec.to = Object.assign({}, rec.cur, { o: 0, s: 0.85 });
        rec.delay = 0; anim.push(rec);
      });

      /* pointer arrows from variables and fields */
      SH.arrows.begin();
      var heapIds = {};
      N.heap.forEach(function (o) { heapIds[o.id] = true; });
      function arrow(key, src, ptr, state) {
        var rec = SH.arrows.use(key, function (r) { buildArrow(r); r.paint = paintShArrow; });
        rec.src = src;
        retargetArrow(rec, { kind: 'obj', id: String(ptr) }, first);
        vz.state(rec.el, state);
        arrows.push(rec);
      }
      N.frames.forEach(function (f) {
        f.vars.forEach(function (v) {
          if (!v.isPtr || v.ptr === null || v.ptr === undefined || !heapIds[String(v.ptr)]) return;
          arrow('v:' + f.id + '/' + v.key, { kind: 'var', frame: f.id, key: f.id + '/' + v.key }, v.ptr, v.ptrState || (v.state !== 'default' ? v.state : 'default'));
        });
      });
      N.heap.forEach(function (o) {
        o.fields.forEach(function (fl) {
          if (!fl.isPtr || fl.ptr === null || fl.ptr === undefined || !heapIds[String(fl.ptr)]) return;
          arrow('f:' + o.id + '/' + fl.key, { kind: 'field', obj: o.id, key: o.id + '/' + fl.key }, fl.ptr, fl.ptrState || (fl.state !== 'default' ? fl.state : (o.state === 'muted' ? 'muted' : 'default')));
        });
      });
      SH.arrows.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; arrows.push(rec); });

      run(ms, anim, arrows, [SH.caps, SH.arrows, SH.fields, SH.vars, SH.frames, SH.objs]);
    }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      if (ram) {
        var cells = L.ramCells(state);
        var parts = ['Memory: ' + cells.length + ' cells from ' + (cells[0] ? L.hex(cells[0].addr, opts.addrDigits) : '')];
        (state.vars || []).forEach(function (v) {
          var to = typeof v.to === 'number' ? v.to : v.from;
          parts.push((v.name || 'variable') + (v.type ? ' (' + v.type + ')' : '') + ' occupies ' + L.hex((cells[v.from] || {}).addr || 0, opts.addrDigits) + '–' + L.hex((cells[to] || {}).addr || 0, opts.addrDigits));
        });
        (state.pointers || []).forEach(function (p) {
          if (cells[p.from] && cells[p.to]) parts.push('cell ' + L.hex(cells[p.from].addr, opts.addrDigits) + ' points to ' + L.hex(cells[p.to].addr, opts.addrDigits));
        });
        return parts.join('. ') + '.';
      }
      var N = norm(state), names = {};
      N.heap.forEach(function (o, i) { names[o.id] = (o.label || o.kind) + ' #' + (i + 1); });
      function show(v) { return v.isPtr ? (v.ptr === null || v.ptr === undefined ? 'null' : '→ ' + (names[v.ptr] || v.ptr)) : fmt(v.value); }
      var out = [];
      out.push('Stack: ' + (N.frames.length ? N.frames.map(function (f) {
        return f.fn + (f.vars.length ? ' (' + f.vars.map(function (v) { return v.name + ' = ' + show(v); }).join(', ') + ')' : '') + (f.returnValue !== undefined ? ' returns ' + fmt(f.returnValue) : '');
      }).join('; ') : 'empty'));
      out.push('Heap: ' + (N.heap.length ? N.heap.map(function (o) {
        return names[o.id] + (o.state === 'muted' ? ' (unreachable)' : '') + ' [' + o.fields.map(function (f) { return (f.name !== undefined ? f.name + ': ' : '') + show(f); }).join(', ') + ']';
      }).join('; ') : 'empty'));
      return out.join('. ') + '.';
    };
    /* Scan a whole trace so the diagram keeps one height (and RAM lanes stay fixed). */
    api.prepare = function (states) {
      (states || []).forEach(function (st) {
        if (ram) {
          if ((st.vars || []).length) ramReserve.vars = true;
          if ((st.pointers || []).length) ramReserve.ptrs = true;
          if (opts.showBits || L.ramCells(st).some(function (c) { return c.bits; })) ramReserve.bits = true;
        } else {
          var N = norm(st), W = ctx.width;
          var stackH = 0;
          N.frames.forEach(function (f) { stackH += L.frameHeight(f.vars.length) + 10; });
          shReserve.stackH = Math.max(shReserve.stackH, stackH - 10);
          N.heap.forEach(sizeObject);
          var fw = opts.frameWidth || Math.round(vz.clamp(W * (W < 560 ? 0.44 : 0.34), 140, 250));
          var hw = Math.max(80, W - 12 - (12 + fw + (W < 560 ? 26 : 44)));
          shReserve.heapH = Math.max(shReserve.heapH, L.flow(N.heap, hw).height);
        }
      });
      prepared = states;
      api.refresh();
      return api;
    };
    var prepared = null;
    /* On resize the heap re-flows, so re-derive the reserved heights for the new width. */
    ctx.onResize(function () {
      if (prepared && !ram) { shReserve = { stackH: 0, heapH: 0 }; var p = prepared; prepared = null; api.prepare(p); }
    });
    api.reset = function () { ramReserve = { vars: false, ptrs: false, bits: false }; shReserve = { stackH: 0, heapH: 0 }; prepared = null; return api; };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) {
        clickable = true;
        ctx.svg.setAttribute('role', 'group');
        R.cells.each(makeCellClickable);
        SH.frames.each(makeFrameClickable);
        SH.objs.each(makeObjClickable);
      }
      return baseOn(evt, fn);
    };
    return api;
  }

  memoryView.layout = L;
  memoryView.defaults = DEFAULTS;
  VDSA.views.memory = memoryView;
}(typeof window !== 'undefined' ? window : null));
