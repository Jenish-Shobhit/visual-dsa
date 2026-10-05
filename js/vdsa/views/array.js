/* VDSA.views.array(container, options) — arrays as bars, boxes, dots or cells, with pointers, regions,
   a held ("in hand") item and several aligned rows (main + aux, merge-sort levels, count arrays).

   const view = VDSA.views.array('#fig', { mode: 'boxes' });
   view.render({
     items:    [{ id: 'a', value: 5, state: 'compare' }, { id: 'b', value: 2 }],
     pointers: [{ name: 'i', index: 0, state: 'active' }],
     regions:  [{ from: 1, to: 1, state: 'done', label: 'sorted' }],
     held:     { id: 'k', value: 7, over: 1 },            // lifted above slot 1 (insertion sort's key)
     ghosts:   [1]                                         // dashed empty slot(s)
   }, { duration: ctx.duration });

   Multi-row: pass rows instead of items; an item id that moves between rows glides between them.
   view.render({ rows: [
       { id: 'main', items: [...], pointers: [...], regions: [...] },
       { id: 'aux', label: 'temp', length: 8, items: [{ id: 'a', value: 5, index: 3 }] }
     ], pointers: [{ name: 'k', row: 'main', index: 2 }] });

   Full schema, options and gotchas: docs/ENGINE.md -> "Renderers (views)" -> array.
*/
(function (root) {
  'use strict';

  /* ================================================================== pure layout (Node-testable) */
  var L = {};
  function num(a, b) { return a - b; }

  /* Normalise either {items,...} or {rows:[...]} into {rows:[...], held:[...]} with explicit slots. */
  L.normalize = function (state) {
    state = state || {};
    var src = Array.isArray(state.rows) && state.rows.length ? state.rows : [{
      id: state.rowId || 'main', label: state.label, items: state.items || [], length: state.length,
      ghosts: state.ghosts, breaks: state.breaks, offset: state.offset, indexLabels: state.indexLabels,
      indexStart: state.indexStart, addresses: state.addresses
    }];
    var rows = src.map(function (r, ri) {
      var id = r.id !== undefined ? String(r.id) : 'row' + ri;
      var items = [];
      (r.items || []).forEach(function (it, i) {
        if (it === null || it === undefined) return; // null keeps the slot empty
        if (typeof it !== 'object') it = { value: it };
        items.push({
          id: String(it.id !== undefined ? it.id : id + ':' + i),
          value: it.value, text: it.text, state: it.state || 'default', label: it.label,
          badge: it.badge, badgeState: it.badgeState, from: it.from !== undefined ? String(it.from) : undefined,
          slot: typeof it.index === 'number' ? it.index : i
        });
      });
      var ghosts = (r.ghosts || []).slice();
      var n = r.length || 0;
      items.forEach(function (it) { n = Math.max(n, it.slot + 1); });
      ghosts.forEach(function (g) { n = Math.max(n, g + 1); });
      return {
        id: id, label: r.label, items: items, n: n, length: r.length || 0, ghosts: ghosts,
        breaks: (r.breaks || []).slice().sort(num), offset: r.offset || 0, gap: r.gap,
        indexLabels: r.indexLabels, indexStart: r.indexStart, showIndices: r.showIndices,
        addresses: r.addresses, showAddresses: r.showAddresses, pointers: [], regions: []
      };
    });
    if (!rows.length) rows.push({ id: 'main', items: [], n: 0, ghosts: [], breaks: [], offset: 0, pointers: [], regions: [] });
    var byId = {};
    rows.forEach(function (r) { byId[r.id] = r; });
    function rowOf(x, fallback) { return (x && x.row !== undefined && byId[String(x.row)]) || fallback; }
    src.forEach(function (r, ri) {
      (r.pointers || []).forEach(function (p) { if (p) rows[ri].pointers.push(p); });
      (r.regions || []).forEach(function (g) { if (g) rows[ri].regions.push(g); });
    });
    if (src !== state.rows) { /* single-row form: pointers/regions were already top-level */ }
    if (Array.isArray(state.rows) && state.rows.length) {
      (state.pointers || []).forEach(function (p) { if (p) rowOf(p, rows[0]).pointers.push(p); });
      (state.regions || []).forEach(function (g) { if (g) rowOf(g, rows[0]).regions.push(g); });
    } else {
      rows[0].pointers = (state.pointers || []).filter(Boolean);
      rows[0].regions = (state.regions || []).filter(Boolean);
    }
    var held = state.held ? (Array.isArray(state.held) ? state.held : [state.held]) : [];
    held = held.filter(Boolean).map(function (h) {
      return {
        id: String(h.id), value: h.value, text: h.text, state: h.state || 'key', label: h.label, badge: h.badge,
        badgeState: h.badgeState, over: typeof h.over === 'number' ? h.over : 0,
        row: h.row !== undefined && byId[String(h.row)] ? String(h.row) : rows[0].id
      };
    });
    return { rows: rows, held: held };
  };

  /* Horizontal shift of a slot caused by a row's breaks (gaps), centred so the row stays balanced. */
  L.breakShift = function (breaks, slot, gap) {
    if (!breaks || !breaks.length) return 0;
    var before = 0;
    for (var i = 0; i < breaks.length; i++) if (breaks[i] <= slot) before++;
    return before * gap - breaks.length * gap / 2;
  };

  /* Slot width that fits `slots` (+ break gaps + outer slack) into `width`. */
  L.slotWidth = function (width, slots, opts) {
    opts = opts || {};
    var pad = opts.padding === undefined ? 12 : opts.padding;
    var want = opts.cellSize * (opts.aspect || 1);
    var denom = Math.max(1, slots) + (opts.breaks || 0) * (opts.gapFactor || 0.45) + (opts.outer || 0);
    return Math.max(opts.min || 2, Math.min(want, (width - 2 * pad) / denom));
  };

  /* Decide which horizontal movers arc. moves: [{id, dx}] (dx in px, same row).
     Swaps (movers in both directions, equal counts) arc right-movers up and left-movers down so the eye sees two
     items trade places; a lone mover jumping over a shifting run arcs up; pure shifts slide straight.
     Returns {id: arcPx} (positive = up). */
  L.assignArcs = function (moves, magnitude) {
    var right = [], left = [], out = {};
    moves.forEach(function (m) { if (m.dx > 0.5) right.push(m); else if (m.dx < -0.5) left.push(m); });
    if (!right.length || !left.length) return out;
    if (right.length === left.length) {
      right.forEach(function (m) { out[m.id] = magnitude(m.dx); });
      left.forEach(function (m) { out[m.id] = -magnitude(m.dx); });
    } else {
      (right.length < left.length ? right : left).forEach(function (m) { out[m.id] = magnitude(m.dx); });
    }
    return out;
  };

  /* Stack pointers that share (side, slot): returns [{p, level}] in input order. */
  L.pointerLevels = function (pointers) {
    var count = {};
    return pointers.map(function (p) {
      var k = (p.side === 'above' ? 'a' : 'b') + ':' + p.index;
      var level = count[k] || 0;
      count[k] = level + 1;
      return { p: p, level: level };
    });
  };

  L.hex = function (n, pad) {
    var s = Math.max(0, Math.round(n)).toString(16).toUpperCase();
    while (s.length < (pad || 0)) s = '0' + s;
    return '0x' + s;
  };

  if (typeof module === 'object' && module.exports) module.exports = L;
  if (!root || !root.VDSA || !root.VDSA.vz) return;

  /* ================================================================== view */
  var VDSA = root.VDSA, vz = VDSA.vz;
  var fmt = vz.fmt;

  var DEFAULTS = {
    mode: 'boxes',          // 'boxes' | 'bars' | 'dots' | 'cells'
    showIndices: true,
    showValues: true,
    showAddresses: false,
    baseAddress: 0x1000,
    elementSize: 4,
    cellSize: null,         // max cell size in px (boxes 48, bars 40, dots 44, cells 26)
    cellAspect: 1,          // box width / height (use 1.6 for short words)
    barHeight: null,        // bars: height of the bar band in px
    maxValue: null, minValue: null,
    outerPointers: true,    // reserve room for pointers at index -1 and n
    arc: 'auto',            // 'auto' | true | false: arcs for swaps
    stagger: true,
    reserve: null,          // {above: levels, below: levels, held: bool, regionLabels: bool} to avoid height jumps
    labelFormatter: null,   // (value, item) -> string
    onItemClick: null,
    pointerStyle: 'arrow',  // 'arrow' | 'chip'
    rowLabels: 'auto',      // 'auto' (left margin when it fits, else above) | 'above'
    emptyText: 'empty',     // shown when there are no slots at all
    duration: undefined
  };

  function arrayView(container, options) {
    var opts = Object.assign({}, DEFAULTS, options || {});
    var V = vz.createView(container, 'array', {
      label: opts.label || 'Array figure', className: 'vz-array-' + opts.mode,
      interactive: !!opts.onItemClick, duration: opts.duration, describe: opts.describe
    }, draw);
    var ctx = V.ctx, api = V.api, em = V.em, tr = V.tr;
    ctx.layer('regions'); ctx.layer('slots'); ctx.layer('rows'); ctx.layer('items'); ctx.layer('pointers');

    var S = { items: new vz.Store(), slots: new vz.Store(), rows: new vz.Store(), ptrs: new vz.Store(), regions: new vz.Store() };
    var reserve = {};                  // per row id, grows only (see opts.reserve / view.prepare)
    var prepared = { max: null, min: null };
    var clickable = !!opts.onItemClick;
    var textCache = new Map();
    var G = null;                      // last geometry
    var lastGeomKey = '';
    var filterId = null;
    function shadowFilter() {
      if (filterId) return filterId;
      filterId = (VDSA.uid ? VDSA.uid('vzsh') : 'vzsh' + Math.random().toString(36).slice(2));
      var f = vz.svg('filter', { id: filterId, x: '-50%', y: '-50%', width: '200%', height: '200%' }, ctx.defs);
      vz.svg('feGaussianBlur', { stdDeviation: 4 }, f);
      return filterId;
    }
    var emptyEl = null;

    function measure(str, px, weight) {
      var k = str + '|' + px + '|' + (weight || 400);
      var w = textCache.get(k);
      if (w === undefined) { w = vz.textWidth(str, px, false, weight); textCache.set(k, w); }
      return w;
    }
    function valueText(it) {
      if (it.text !== undefined) return String(it.text);
      return opts.labelFormatter ? String(opts.labelFormatter(it.value, it)) : fmt(it.value);
    }
    function modeDefaultCell() { return opts.mode === 'bars' ? 40 : opts.mode === 'cells' ? 26 : opts.mode === 'dots' ? 44 : 48; }

    /* ---------------------------------------------------------- geometry */
    function geometry(norm) {
      var W = ctx.width, mode = opts.mode, bars = mode === 'bars';
      var slots = 1, breaks = 0;
      norm.rows.forEach(function (r) { slots = Math.max(slots, r.offset + r.n); breaks = Math.max(breaks, r.breaks.length); });
      norm.held.forEach(function (h) { slots = Math.max(slots, h.over + 1); });
      var aspect = bars ? 1 : (opts.cellAspect || 1);
      var sw = L.slotWidth(W, slots, {
        cellSize: opts.cellSize || modeDefaultCell(), aspect: aspect, breaks: breaks,
        outer: opts.outerPointers ? 1.5 : 0.2, min: bars ? 2 : mode === 'cells' ? 4 : 12
      });
      var s = bars ? sw : sw / aspect;                         // cell height for boxes/dots/cells
      var x0 = (W - slots * sw) / 2;
      var g = { W: W, sw: sw, s: s, x0: x0, slots: slots, rows: {}, order: [], bars: bars };
      g.cellW = mode === 'cells' ? sw - Math.max(1, sw * 0.08) : bars ? (sw < 10 ? Math.max(1, sw - 1) : sw * 0.74) : sw - Math.max(2, Math.min(6, sw * 0.1));
      g.cellH = mode === 'cells' ? s - Math.max(1, s * 0.08) : s - Math.max(2, Math.min(6, s * 0.1));
      g.radius = Math.min(g.cellW, g.cellH) / 2;
      g.corner = mode === 'cells' ? Math.min(3, g.cellH * 0.12) : Math.min(9, g.cellH * 0.16);
      g.font = mode === 'cells' ? vz.clamp(Math.round(s * 0.34), 8, 13) : vz.clamp(Math.round(s * 0.36), 10, 17);
      g.showText = opts.showValues && !(mode === 'cells' && s < 22) && !(bars && sw < 16);
      g.gap = function (r) { return r.gap !== undefined ? r.gap : sw * 0.45; };

      // value scale for bars
      var mx = opts.maxValue, mn = opts.minValue;
      if (bars) {
        var hiV = -Infinity, loV = Infinity;
        norm.rows.forEach(function (r) { r.items.forEach(function (it) { var v = +it.value; if (isFinite(v)) { hiV = Math.max(hiV, v); loV = Math.min(loV, v); } }); });
        norm.held.forEach(function (h) { var v = +h.value; if (isFinite(v)) { hiV = Math.max(hiV, v); loV = Math.min(loV, v); } });
        if (mx === null || mx === undefined) mx = prepared.max !== null ? Math.max(prepared.max, hiV) : hiV;
        if (mn === null || mn === undefined) mn = Math.min(0, prepared.min !== null ? Math.min(prepared.min, loV) : loV);
        if (!isFinite(mx) || mx <= mn) mx = mn + 1;
        g.maxV = mx; g.minV = Math.min(0, mn);
      }
      var labelW = 0;
      norm.rows.forEach(function (r) { if (r.label) labelW = Math.max(labelW, measure(String(r.label), 11, 600)); });
      var leftmost = x0 - breaks * sw * 0.45 / 2;
      g.labelsLeft = labelW > 0 && opts.rowLabels !== 'above' && leftmost - 12 - labelW >= 4;
      var band = bars ? (opts.barHeight || vz.clamp(Math.round(W * 0.3), 120, 210) * (norm.rows.length > 1 ? 0.72 : 1)) : g.cellH;
      var y = 6;
      var showAddrGlobal = !!opts.showAddresses;
      norm.rows.forEach(function (r) {
        var res = reserve[r.id] || (reserve[r.id] = Object.assign({ above: 0, below: 0, held: false, regionLabels: false, label: false }, opts.reserve || {}));
        var lv = L.pointerLevels(r.pointers.filter(function (p) { return typeof p.index === 'number'; }));
        var needA = 0, needB = 0;
        lv.forEach(function (e) { if (e.p.side === 'above') needA = Math.max(needA, e.level + 1); else needB = Math.max(needB, e.level + 1); });
        res.above = Math.max(res.above, needA); res.below = Math.max(res.below, needB);
        if (norm.held.some(function (h) { return h.row === r.id; })) res.held = true;
        if (r.regions.some(function (x) { return x.label; })) res.regionLabels = true;
        if (r.label) res.label = true;
        var rg = { id: r.id, top: y, row: r, levels: lv };
        if (res.label && !g.labelsLeft) { y += 18; rg.labelY = y - 6; }
        var heldLane = bars ? Math.round(band * 0.22) + 8 : Math.round(g.cellH + 18);
        if (res.held) { rg.heldLane = heldLane; y += heldLane; }
        if (res.above) { y += 14 + 15 * (res.above - 1) + 12; }
        if (res.regionLabels) { y += 16; }
        rg.regionLabelY = y - 9;
        var showAddr = r.showAddresses !== undefined ? r.showAddresses : showAddrGlobal;
        if (showAddr) { rg.addrY = y + 6; y += 22; }
        rg.cellTop = y;
        if (bars) {
          var head = g.showText ? 16 : 4;
          var foot = g.minV < 0 && g.showText ? 15 : 0;   // room for labels under negative bars
          var usable = band - head - foot;
          rg.zeroY = y + head + usable * (g.maxV / (g.maxV - g.minV));
          rg.unit = usable / (g.maxV - g.minV);
          y += band;
        } else y += g.cellH;
        rg.cellBottom = y;
        rg.cellMid = (rg.cellTop + rg.cellBottom) / 2;
        var showIdx = r.showIndices !== undefined ? r.showIndices : opts.showIndices;
        rg.showIdx = showIdx && !(opts.mode === 'cells' && sw < 16);
        if (rg.showIdx) { rg.idxY = y + 10; y += 19; }
        rg.ptrBelowTip = y + 2;
        if (res.below) y += 14 + 15 * (res.below - 1) + 12;
        rg.ptrAboveTip = rg.cellTop - (showAddr ? 24 : 3) - (res.regionLabels ? 15 : 0);
        y += norm.rows.length > 1 ? 12 : 4;
        rg.bottom = y;
        rg.heldY = res.held ? rg.top + (res.label ? 18 : 0) + (bars ? 0 : heldLane / 2 - 4) : rg.cellMid;
        g.rows[r.id] = rg; g.order.push(rg);
      });
      g.height = y + 4;
      if (opts.height) g.height = Math.max(g.height, opts.height);
      return g;
    }
    function slotLeft(rg, slot) {
      var r = rg.row;
      return G.x0 + (r.offset + slot) * G.sw + L.breakShift(r.breaks, slot, G.gap(r));
    }
    function slotX(rg, slot) { return slotLeft(rg, slot) + G.sw / 2; }

    /* ---------------------------------------------------------- DOM builders */
    function buildItem(rec) {
      var g = vz.svg('g', { class: 'vz-item ' + (opts.mode === 'bars' ? 'vz-bar' : opts.mode === 'dots' ? 'vz-dot' : opts.mode === 'cells' ? 'vz-cellsq' : 'vz-box') });
      rec.shadow = opts.mode === 'bars' ? null : vz.svg('rect', { class: 'vz-lift-shadow', opacity: 0, filter: 'url(#' + shadowFilter() + ')' }, g);
      rec.shape = vz.svg(opts.mode === 'dots' ? 'circle' : 'rect', { class: 'vz-shape' }, g);
      rec.txt = vz.svg('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em' }, g);
      if (opts.mode === 'bars') { rec.txt.setAttribute('class', 'vz-bar-value'); rec.txt.removeAttribute('dy'); }
      rec.sub = null; rec.badge = null;
      rec.el = g;
      rec.paint = paintItem;
      ctx.layers.items.appendChild(g);
      if (clickable) makeItemClickable(rec);
    }
    function makeItemClickable(rec) {
      vz.clickable(rec.el, null, function () {
        var d = rec.data || {};
        var payload = { id: rec.id, index: d.slot, row: d.row, value: d.value, item: d.item, held: !!d.held };
        em.emit('click', payload);
        if (opts.onItemClick) opts.onItemClick(payload);
      });
    }
    function setBadge(rec, text, state) {
      if (text === undefined || text === null || text === '') {
        if (rec.badge) { rec.badge.g.remove(); rec.badge = null; }
        return;
      }
      if (!rec.badge) {
        var bg = vz.svg('g', { class: 'vz-badge' }, rec.el);
        var bh = opts.badgeSize || 14;   // opt-in: a larger pill (and glyph) for symbols such as an arrow
        rec.badge = { g: bg, rect: vz.svg('rect', { rx: bh / 2, ry: bh / 2, height: bh, y: -bh / 2 }, bg), text: vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, bg) };
        if (opts.badgeSize) rec.badge.text.style.fontSize = Math.round(bh * 1.05) + 'px';
      }
      var t = String(text), w = Math.max(opts.badgeSize || 14, measure(t, opts.badgeSize ? Math.round(opts.badgeSize * 1.05) : 10, 650) + 8);
      vz.text(rec.badge.text, t);
      vz.set(rec.badge.rect, 'width', w); vz.set(rec.badge.rect, 'x', -w / 2);
      vz.state(rec.badge.g, state || 'default');
      rec.badgeW = w;
    }

    /* Paint an item record from rec.cur and its geometry. */
    function paintItem(rec) {
      var c = rec.cur;
      vz.place(rec.el, c.x, c.y, c.s);
      vz.opacity(rec.el, c.o);
      if (opts.mode === 'bars') {
        var h = c.h, hh = Math.abs(h) < 1.5 ? (h < 0 ? -1.5 : 1.5) : h;
        vz.set(rec.shape, 'y', vz.n2(hh > 0 ? -hh : 0));
        vz.set(rec.shape, 'height', vz.n2(Math.abs(hh)));
        if (rec.txt) vz.set(rec.txt, 'y', vz.n2(hh >= 0 ? -hh - 5 : -hh + 13));
        if (rec.badge) vz.place(rec.badge.g, 0, (hh >= 0 ? -hh : 0) - (G.showText ? 26 : 10));
      }
      if (rec.shadow) {
        var lift = c.l || 0;
        vz.set(rec.shadow, 'opacity', lift > 0.01 ? lift.toFixed(2) : 0);
        vz.set(rec.shadow, 'y', vz.n2(-G.cellH / 2 + 3 + 6 * Math.max(0, lift)));
      }
    }
    function sizeItemShape(rec) {
      var mode = opts.mode;
      if (mode === 'bars') {
        vz.set(rec.shape, 'x', vz.n2(-G.cellW / 2)); vz.set(rec.shape, 'width', vz.n2(G.cellW));
        var rr = Math.min(3, G.cellW / 4);
        vz.set(rec.shape, 'rx', rr); vz.set(rec.shape, 'ry', rr);
      } else if (mode === 'dots') {
        vz.set(rec.shape, 'r', vz.n2(G.radius));
      } else {
        vz.set(rec.shape, 'x', vz.n2(-G.cellW / 2)); vz.set(rec.shape, 'y', vz.n2(-G.cellH / 2));
        vz.set(rec.shape, 'width', vz.n2(G.cellW)); vz.set(rec.shape, 'height', vz.n2(G.cellH));
        vz.set(rec.shape, 'rx', vz.n2(G.corner)); vz.set(rec.shape, 'ry', vz.n2(G.corner));
      }
      if (rec.shadow) {
        var sw = opts.mode === 'dots' ? G.radius * 2 : G.cellW, sh = opts.mode === 'dots' ? G.radius * 2 : G.cellH;
        vz.set(rec.shadow, 'x', vz.n2(-sw / 2 + 2)); vz.set(rec.shadow, 'width', vz.n2(Math.max(0, sw - 4)));
        vz.set(rec.shadow, 'height', vz.n2(Math.max(0, sh - 2)));
        vz.set(rec.shadow, 'rx', vz.n2(opts.mode === 'dots' ? sw / 2 : G.corner)); vz.set(rec.shadow, 'ry', vz.n2(opts.mode === 'dots' ? sw / 2 : G.corner));
      }
    }
    function setItemContent(rec, it) {
      var str = G.showText ? valueText(it) : '';
      if (opts.mode === 'bars') {
        vz.text(rec.txt, str);
        vz.set(rec.txt, 'font-size', vz.clamp(Math.round(G.sw * 0.34), 9, 12));
      } else {
        var hasSub = it.label !== undefined && it.label !== null && it.label !== '' && G.cellH >= 30;
        var fs = G.font, maxW = (opts.mode === 'dots' ? G.radius * 1.7 : G.cellW * 0.86);
        if (str) { var w = measure(str, fs, 650); if (w > maxW) fs = Math.max(8, Math.floor(fs * maxW / w)); }
        vz.text(rec.txt, str);
        vz.set(rec.txt, 'font-size', fs);
        vz.set(rec.txt, 'y', hasSub ? vz.n2(-G.cellH * 0.12) : 0);
        if (hasSub) {
          if (!rec.sub) rec.sub = vz.svg('text', { class: 'vz-ink vz-sub', 'text-anchor': 'middle', dy: '.35em' }, rec.el);
          vz.text(rec.sub, it.label);
          vz.set(rec.sub, 'y', vz.n2(G.cellH * 0.25));
          vz.set(rec.sub, 'font-size', vz.clamp(Math.round(G.font * 0.62), 8, 11));
        } else if (rec.sub) { rec.sub.remove(); rec.sub = null; }
      }
      setBadge(rec, it.badge, it.badgeState);
      if (rec.badge && opts.mode !== 'bars') {
        var bx = opts.mode === 'dots' ? G.radius * 0.72 : G.cellW / 2 - 2, by = opts.mode === 'dots' ? -G.radius * 0.72 : -G.cellH / 2 - 1;
        vz.place(rec.badge.g, bx, by);
      }
      var label = (it.held ? 'held ' : '') + 'value ' + str + (typeof it.slot === 'number' && !it.held ? ', index ' + it.slot : '') + (it.state && it.state !== 'default' ? ', ' + it.state : '');
      if (clickable) vz.set(rec.el, 'aria-label', label);
    }

    function buildPointer(rec) {
      var g = vz.svg('g', { class: 'vz-pointer' }, ctx.layers.pointers);
      rec.head = vz.svg('path', { class: 'vz-ptr-head' }, g);
      rec.stem = vz.svg('line', { class: 'vz-ptr-stem', x1: 0, x2: 0 }, g);
      rec.chip = null;
      rec.label = vz.svg('text', { class: 'vz-ptr-label', 'text-anchor': 'middle', dy: '.35em' }, g);
      rec.el = g;
      rec.paint = paintPointer;
    }
    function paintPointer(rec) {
      var c = rec.cur, up = rec.side !== 'above';
      vz.place(rec.el, c.x, c.y);
      vz.opacity(rec.el, c.o);
      vz.set(rec.head, 'opacity', c.a >= 0.999 ? null : c.a.toFixed(3));
      vz.set(rec.stem, 'opacity', c.a >= 0.999 ? null : c.a.toFixed(3));
      var ly = (up ? 1 : -1) * (21 + 15 * c.lv);
      vz.set(rec.label, 'y', vz.n2(ly));
      if (rec.chip) vz.set(rec.chip, 'y', vz.n2(ly - 9));
    }
    function shapePointer(rec, p) {
      var up = rec.side !== 'above';
      vz.set(rec.head, 'd', up ? 'M0 0L-5.5 8Q0 6.4 5.5 8Z' : 'M0 0L-5.5 -8Q0 -6.4 5.5 -8Z');
      vz.set(rec.stem, 'y1', up ? 7 : -7); vz.set(rec.stem, 'y2', up ? 12 : -12);
      var text = p.label !== undefined ? String(p.label) : String(p.name);
      vz.text(rec.label, text);
      var chip = (p.style || opts.pointerStyle) === 'chip';
      if (chip && !rec.chip) {
        rec.chip = vz.svg('rect', { class: 'vz-ptr-chip', height: 18, rx: 9, ry: 9 }, rec.el);
        rec.el.insertBefore(rec.chip, rec.label);
        rec.label.setAttribute('class', 'vz-ptr-chip-text');
      } else if (!chip && rec.chip) { rec.chip.remove(); rec.chip = null; rec.label.setAttribute('class', 'vz-ptr-label'); }
      if (rec.chip) { var w = measure(text, 11.5, 700) + 14; vz.set(rec.chip, 'width', vz.n2(w)); vz.set(rec.chip, 'x', vz.n2(-w / 2)); }
    }

    function buildRegion(rec) {
      var g = vz.svg('g', { class: 'vz-region' }, ctx.layers.regions);
      rec.band = vz.svg('rect', { class: 'vz-band', rx: 8, ry: 8 }, g);
      rec.label = vz.svg('text', { class: 'vz-region-label' }, g);
      rec.el = g;
      rec.paint = paintRegion;
    }
    function paintRegion(rec) {
      var c = rec.cur;
      vz.opacity(rec.el, c.o);
      vz.set(rec.band, 'x', vz.n2(c.x)); vz.set(rec.band, 'y', vz.n2(c.y));
      vz.set(rec.band, 'width', vz.n2(Math.max(0, c.w))); vz.set(rec.band, 'height', vz.n2(Math.max(0, c.h)));
      vz.set(rec.label, 'x', vz.n2(c.x + 3)); vz.set(rec.label, 'y', vz.n2(c.ly));
    }

    function buildSlot(rec, kind) {
      rec.kind = kind;
      rec.paint = paintSlot;
      if (kind === 'ghost') rec.el = vz.svg(opts.mode === 'dots' ? 'circle' : 'rect', { class: 'vz-slot' }, ctx.layers.slots);
      else rec.el = vz.svg('text', { class: 'vz-label', 'text-anchor': 'middle', dy: '.35em' }, ctx.layers.slots);
    }
    function paintSlot(rec) {
      var c = rec.cur;
      vz.opacity(rec.el, c.o);
      if (rec.kind === 'ghost') {
        if (opts.mode === 'dots') { vz.set(rec.el, 'cx', vz.n2(c.x)); vz.set(rec.el, 'cy', vz.n2(c.y)); vz.set(rec.el, 'r', vz.n2(G.radius)); }
        else if (opts.mode === 'bars') {
          vz.set(rec.el, 'x', vz.n2(c.x - G.cellW / 2)); vz.set(rec.el, 'y', vz.n2(c.y - 3));
          vz.set(rec.el, 'width', vz.n2(G.cellW)); vz.set(rec.el, 'height', 3); vz.set(rec.el, 'rx', 1.5);
        } else {
          vz.set(rec.el, 'x', vz.n2(c.x - G.cellW / 2)); vz.set(rec.el, 'y', vz.n2(c.y - G.cellH / 2));
          vz.set(rec.el, 'width', vz.n2(G.cellW)); vz.set(rec.el, 'height', vz.n2(G.cellH));
          vz.set(rec.el, 'rx', vz.n2(G.corner));
        }
      } else { vz.set(rec.el, 'x', vz.n2(c.x)); vz.set(rec.el, 'y', vz.n2(c.y)); }
    }

    function buildRow(rec) {
      var g = vz.svg('g', { class: 'vz-row' }, ctx.layers.rows);
      rec.label = vz.svg('text', { class: 'vz-caption' }, g);
      rec.base = opts.mode === 'bars' ? vz.svg('line', { class: 'vz-baseline' }, g) : null;
      rec.el = g;
      rec.paint = paintRow;
    }
    function paintRow(rec) {
      var c = rec.cur;
      vz.opacity(rec.el, c.o);
      vz.set(rec.label, 'x', vz.n2(c.lx)); vz.set(rec.label, 'y', vz.n2(c.ly));
      if (rec.base) { vz.set(rec.base, 'x1', vz.n2(c.x)); vz.set(rec.base, 'x2', vz.n2(c.x2)); vz.set(rec.base, 'y1', vz.n2(c.by)); vz.set(rec.base, 'y2', vz.n2(c.by)); }
    }

    /* ---------------------------------------------------------- draw */
    function draw(state, ms) {
      var norm = L.normalize(state);
      G = geometry(norm);
      ctx.setHeight(G.height);
      var gk = [G.cellW, G.cellH, G.corner, G.radius, G.sw].map(vz.n2).join('|');
      var geomChanged = gk !== lastGeomKey;
      lastGeomKey = gk;
      var anim = [];
      var first = !api._drawn;
      api._drawn = true;
      var stagger = opts.stagger && ms > 0;

      function enter(rec, target, fromOverride, delay) {
        rec.cur = Object.assign({}, target, fromOverride || { o: 0, s: 0.6 });
        vz.retarget(rec, target);
        rec.delay = delay || 0;
        anim.push(rec);
      }
      function update(rec, target) {
        vz.retarget(rec, target);
        rec.delay = 0; rec.arc = 0;
        anim.push(rec);
      }

      /* rows: captions + baselines */
      S.rows.begin();
      var rowLeft = function (rg) { return slotLeft(rg, 0) + (G.bars ? 0 : (G.sw - G.cellW) / 2); };
      // Rows that start at different offsets would stagger their captions diagonally; when that
      // happens, stack the captions left-aligned in one column ending just before the leftmost row.
      var minLeft = Infinity, maxLabelW = 0;
      G.order.forEach(function (rg) { minLeft = Math.min(minLeft, rowLeft(rg)); if (rg.row.label) maxLabelW = Math.max(maxLabelW, measure(String(rg.row.label), 11, 600)); });
      var staggered = G.order.some(function (rg) { return Math.abs(rowLeft(rg) - minLeft) > 1; });
      G.order.forEach(function (rg) {
        var rec = S.rows.use(rg.id, buildRow);
        var r = rg.row;
        var left = rowLeft(rg);
        var right = slotLeft(rg, Math.max(0, r.n - 1)) + G.sw;
        vz.text(rec.label, r.label || '');
        var colLeft = G.labelsLeft && staggered;
        vz.set(rec.label, 'text-anchor', G.labelsLeft && !colLeft ? 'end' : 'start');
        vz.set(rec.label, 'dy', G.labelsLeft ? '.35em' : null);
        var t = { x: left, lx: colLeft ? Math.max(4, minLeft - 12 - maxLabelW) : G.labelsLeft ? left - 12 : staggered ? minLeft : left, x2: right, ly: G.labelsLeft ? (G.bars ? (rg.cellTop + rg.zeroY) / 2 : rg.cellMid) : (rg.labelY || rg.top), by: G.bars ? rg.zeroY : 0, o: 1 };
        if (rec.isNew) enter(rec, t, { o: 0 }); else update(rec, t);
      });
      S.rows.end().forEach(function (rec) { rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.from = Object.assign({}, rec.cur); anim.push(rec); });
      var isEmpty = norm.held.length === 0 && norm.rows.every(function (r) { return r.n === 0; });
      if (!emptyEl) emptyEl = vz.svg('text', { class: 'vz-empty', 'text-anchor': 'middle', dy: '.35em' }, ctx.layers.rows);
      vz.text(emptyEl, isEmpty ? (opts.emptyText == null ? 'empty' : opts.emptyText) : '');
      vz.set(emptyEl, 'x', vz.n2(ctx.width / 2)); vz.set(emptyEl, 'y', vz.n2(G.order[0].cellMid));

      /* slots: ghosts, index labels, addresses */
      S.slots.begin();
      G.order.forEach(function (rg) {
        var r = rg.row;
        var ghostSet = {};
        r.ghosts.forEach(function (g) { ghostSet[g] = true; });
        if (r.length) for (var k = 0; k < r.length; k++) ghostSet[k] = true;
        Object.keys(ghostSet).forEach(function (k) {
          k = +k;
          var rec = S.slots.use('g|' + r.id + '|' + k, function (x) { buildSlot(x, 'ghost'); });
          var t = { x: slotX(rg, k), y: G.bars ? rg.zeroY : rg.cellMid, o: 1 };
          vz.toggle(rec.el, 'is-solid', !!r.length && r.ghosts.indexOf(k) === -1);
          if (rec.isNew) enter(rec, t, { o: 0 }); else update(rec, t);
        });
        if (rg.showIdx) {
          var every = G.sw >= 16 ? 1 : [2, 5, 10, 20, 50].filter(function (k) { return k * G.sw >= 18; })[0] || 100;
          for (var i = 0; i < r.n; i++) {
            if (i % every && !(i === r.n - 1 && i % every >= every * 0.6)) continue;
            var rec = S.slots.use('i|' + r.id + '|' + i, function (x) { buildSlot(x, 'index'); });
            var lbl = r.indexLabels ? (r.indexLabels[i] !== undefined ? r.indexLabels[i] : '') : (r.indexStart !== undefined ? r.indexStart + i : r.offset + i);
            vz.text(rec.el, lbl);
            vz.set(rec.el, 'font-size', G.sw < 22 ? 9 : 11);
            var t = { x: slotX(rg, i), y: rg.idxY, o: 1 };
            if (rec.isNew) enter(rec, t, { o: 0 }); else update(rec, t);
          }
        }
        if (rg.addrY !== undefined) {
          for (var a = 0; a < r.n; a++) {
            var arec = S.slots.use('a|' + r.id + '|' + a, function (x) { buildSlot(x, 'addr'); });
            var addr = r.addresses ? (r.addresses[a] !== undefined ? r.addresses[a] : '') : L.hex(opts.baseAddress + (r.offset + a) * opts.elementSize, 0);
            vz.text(arec.el, addr);
            vz.set(arec.el, 'font-size', G.sw < 54 ? Math.max(7, Math.floor(G.sw / 5.4)) : 10);
            var at = { x: slotX(rg, a), y: rg.addrY, o: 1 };
            if (arec.isNew) enter(arec, at, { o: 0 }); else update(arec, at);
          }
        }
      });
      S.slots.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; anim.push(rec); });

      /* items (row items + held) */
      var prevPos = {};
      S.items.each(function (rec, id) { if (!rec.exiting) prevPos[id] = { x: rec.cur.x, y: rec.cur.y, row: rec.data && rec.data.row, held: rec.data && rec.data.held }; });
      S.items.begin();
      var targets = [];
      G.order.forEach(function (rg) {
        rg.row.items.forEach(function (it, idx) {
          var t = { x: slotX(rg, it.slot), y: G.bars ? rg.zeroY : rg.cellMid, o: 1, s: 1, l: 0 };
          if (G.bars) t.h = (isFinite(+it.value) ? +it.value : 0) * rg.unit;
          targets.push({ it: it, rg: rg, t: t, held: false, order: idx });
        });
      });
      norm.held.forEach(function (h) {
        var rg = G.rows[h.row];
        var t = { x: slotX(rg, h.over), y: G.bars ? rg.zeroY - rg.heldLane : rg.heldY, o: 1, s: 1, l: 1 };
        if (G.bars) t.h = (isFinite(+h.value) ? +h.value : 0) * rg.unit;
        targets.push({ it: h, rg: rg, t: t, held: true, order: 0 });
      });
      // swap arcs: horizontal movers inside the same row
      var arcs = {};
      if (opts.arc !== false && ms > 0) {
        var perRow = {};
        targets.forEach(function (e) {
          var pp = prevPos[e.it.id];
          if (!pp || e.held || pp.held || pp.row !== e.rg.id) return;
          var dx = e.t.x - pp.x;
          if (Math.abs(dx) < 1) return;
          (perRow[e.rg.id] = perRow[e.rg.id] || []).push({ id: e.it.id, dx: dx });
        });
        Object.keys(perRow).forEach(function (rid) {
          var mag = G.bars ? function (dx) { return Math.min(26, 10 + Math.abs(dx) * 0.06); }
            : function (dx) { return vz.clamp(Math.abs(dx) * 0.22 + G.cellH * 0.38, G.cellH * 0.55, G.cellH * 1.25); };
          var a = opts.arc === true ? (function () {
            var o = {}; perRow[rid].forEach(function (m) { o[m.id] = m.dx > 0 ? mag(m.dx) : -mag(m.dx); }); return o;
          })() : L.assignArcs(perRow[rid], mag);
          Object.assign(arcs, a);
        });
      }
      var enterCount = 0;
      targets.forEach(function (e) {
        var it = e.it;
        var rec = S.items.use(it.id, buildItem);
        if (rec.el && rec.el.getAttribute('data-id') !== String(it.id)) { rec.el.setAttribute('data-id', it.id); rec.el.setAttribute('data-label', String(it.value)); }   // lets VDSA.clickQuiz target items
        rec.data = { slot: e.held ? it.over : it.slot, row: e.rg.id, value: it.value, item: it, held: e.held };
        it.held = e.held;
        vz.state(rec.el, it.state);
        vz.toggle(rec.el, 'vz-held', e.held);
        if (rec.isNew || geomChanged) sizeItemShape(rec);
        setItemContent(rec, it);
        if (rec.isNew) {
          var src = it.from !== undefined ? S.items.get(it.from) : null;
          var from = src ? { x: src.cur.x, y: src.cur.y, o: 1, s: 1, l: 0, h: src.cur.h !== undefined ? src.cur.h : e.t.h } : null;
          if (!from) {
            if (G.bars && first) from = { o: 1, s: 1, h: 0, l: 0 };
            else from = { o: 0, s: G.bars ? 1 : 0.55, h: G.bars ? 0 : undefined, l: 0 };
          }
          var delay = stagger ? Math.min(0.3, (first ? e.order : enterCount) * (first ? 0.035 : 0.05)) : 0;
          enterCount++;
          enter(rec, e.t, cleanUndef(from), delay);
        } else {
          update(rec, e.t);
          rec.arc = arcs[it.id] || 0;
        }
      });
      S.items.end().forEach(function (rec) {
        rec.from = Object.assign({}, rec.cur);
        rec.to = Object.assign({}, rec.cur, { o: 0, s: G.bars ? 1 : 0.7 });
        rec.delay = 0; rec.arc = 0;
        anim.push(rec);
      });

      /* pointers */
      S.ptrs.begin();
      var usedKeys = {};
      G.order.forEach(function (rg) {
        rg.levels.forEach(function (e) {
          var p = e.p;
          var key = String(p.id !== undefined ? p.id : p.name);
          if (usedKeys[key]) key += '@' + rg.id;
          usedKeys[key] = true;
          var rec = S.ptrs.use(key, buildPointer);
          var side = p.side === 'above' ? 'above' : 'below';
          if (rec.side !== side) { rec.side = side; }
          shapePointer(rec, p);
          vz.state(rec.el, p.state || 'active');
          var t = { x: slotX(rg, p.index), y: side === 'above' ? rg.ptrAboveTip : rg.ptrBelowTip, o: 1, lv: e.level, a: e.level === 0 ? 1 : 0 };
          if (rec.isNew) enter(rec, t, { o: 0, y: t.y + (side === 'above' ? -8 : 8) });
          else update(rec, t);
        });
      });
      S.ptrs.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; anim.push(rec); });

      /* regions */
      S.regions.begin();
      var regionKeys = {};
      G.order.forEach(function (rg) {
        rg.row.regions.forEach(function (x) {
          if (typeof x.from !== 'number' || typeof x.to !== 'number' || x.to < x.from) return;
          var key = x.id !== undefined ? String(x.id) : rg.id + '|' + (x.label || x.state || 'region');
          while (regionKeys[key]) key += '+';
          regionKeys[key] = true;
          var rec = S.regions.use(key, buildRegion);
          vz.state(rec.el, x.state || 'active');
          vz.text(rec.label, x.label || '');
          var inset = G.bars ? 3 : 4;
          var x1 = slotLeft(rg, x.from) + (G.bars ? (G.sw - G.cellW) / 2 : 0) - inset;
          var x2 = slotLeft(rg, x.to) + G.sw - (G.bars ? (G.sw - G.cellW) / 2 : 0) + inset;
          var y1 = rg.cellTop - 5, y2 = (rg.showIdx ? rg.idxY + 9 : rg.cellBottom + 5);
          var t = { x: x1, w: x2 - x1, y: y1, h: y2 - y1, ly: rg.regionLabelY, o: 1 };
          if (rec.isNew) enter(rec, t, { o: 0, w: 0, x: (x1 + x2) / 2 });
          else update(rec, t);
        });
      });
      S.regions.end().forEach(function (rec) { rec.from = Object.assign({}, rec.cur); rec.to = Object.assign({}, rec.cur, { o: 0 }); rec.delay = 0; anim.push(rec); });


      /* run one transition for everything */
      tr.run(ms, function (t) {
        for (var i = 0; i < anim.length; i++) {
          var rec = anim[i];
          vz.step(rec, vz.local(t, rec.delay, undefined));
          rec.paint(rec);
        }
      }, function () {
        Object.keys(S).forEach(function (k) { S[k].purge(); });
      });
    }
    function cleanUndef(o) { var r = {}; for (var k in o) if (o[k] !== undefined) r[k] = o[k]; return r; }

    /* ---------------------------------------------------------- public API */
    api.describe = function (state) {
      var norm = L.normalize(state);
      var parts = norm.rows.map(function (r, i) {
        var name = r.label || (norm.rows.length > 1 ? 'row ' + (i + 1) : 'array');
        var cells = [];
        for (var k = 0; k < r.n; k++) cells.push('_');
        r.items.forEach(function (it) { cells[it.slot] = valueText(it) + (it.state && it.state !== 'default' ? ' (' + it.state + ')' : ''); });
        var s = name + ': [' + cells.join(', ') + ']';
        var ps = r.pointers.filter(function (p) { return typeof p.index === 'number'; }).map(function (p) { return (p.label || p.name) + ' at index ' + p.index; });
        if (ps.length) s += '; ' + ps.join(', ');
        var rs = r.regions.filter(function (x) { return x.label; }).map(function (x) { return x.label + ' ' + x.from + '–' + x.to; });
        if (rs.length) s += '; ' + rs.join(', ');
        return s;
      });
      norm.held.forEach(function (h) { parts.push('holding ' + valueText(h) + ' above index ' + h.over); });
      return parts.join('. ') + '.';
    };
    /* Scan every snapshot of a trace once so the figure never changes height or scale mid-animation. */
    api.prepare = function (states) {
      (states || []).forEach(function (st) {
        var norm = L.normalize(st);
        norm.rows.forEach(function (r) {
          var res = reserve[r.id] || (reserve[r.id] = Object.assign({ above: 0, below: 0, held: false, regionLabels: false, label: false }, opts.reserve || {}));
          L.pointerLevels(r.pointers.filter(function (p) { return typeof p.index === 'number'; })).forEach(function (e) {
            if (e.p.side === 'above') res.above = Math.max(res.above, e.level + 1); else res.below = Math.max(res.below, e.level + 1);
          });
          if (norm.held.some(function (h) { return h.row === r.id; })) res.held = true;
          if (r.regions.some(function (x) { return x.label; })) res.regionLabels = true;
          if (r.label) res.label = true;
          r.items.forEach(function (it) {
            var v = +it.value;
            if (isFinite(v)) { prepared.max = prepared.max === null ? v : Math.max(prepared.max, v); prepared.min = prepared.min === null ? v : Math.min(prepared.min, v); }
          });
        });
        norm.held.forEach(function (h) { var v = +h.value; if (isFinite(v)) { prepared.max = prepared.max === null ? v : Math.max(prepared.max, v); prepared.min = prepared.min === null ? v : Math.min(prepared.min, v); } });
      });
      api.refresh();
      return api;
    };
    /* Forget reserved lanes / prepared scale (e.g. when the lesson loads a new input). */
    api.reset = function () { reserve = {}; prepared = { max: null, min: null }; return api; };
    api.setOptions = function (o) {
      var rebuild = o && (o.mode !== undefined && o.mode !== opts.mode);
      Object.assign(opts, o || {});
      textCache.clear();
      if (rebuild) {
        Object.keys(S).forEach(function (k) { S[k].clear(); });
        ctx.svg.setAttribute('class', 'vz vz-array vz-array-' + opts.mode);
        api._drawn = false;
      }
      lastGeomKey = '';
      api.refresh();
      return api;
    };
    var baseOn = api.on;
    api.on = function (evt, fn) {
      if (evt === 'click' && !clickable) {
        clickable = true;
        ctx.svg.setAttribute('role', 'group');
        S.items.each(function (rec) { makeItemClickable(rec); });
        api.refresh();   // writes aria-labels on existing items
      }
      return baseOn(evt, fn);
    };
    /* Current screen position of an item (for lesson overlays). */
    api.positionOf = function (id) { var r = S.items.get(String(id)); return r ? { x: r.cur.x, y: r.cur.y } : null; };
    return api;
  }

  arrayView.layout = L;
  arrayView.defaults = DEFAULTS;
  VDSA.views.array = arrayView;
}(typeof window !== 'undefined' ? window : null));
