/* Lesson 23 — custom views shared by the figures and labs.
     L23.segView(container, opts)   segment tree drawn above its array; nodes, band, bracket, tags and a travelling token
     L23.fenView(container, opts)   Fenwick tree: responsibility bars, array, indices, binary, jump arcs, cursor
     L23.bitCalc(container, opts)   i, ~i, -i, i & -i as rows of animated bit cells
     L23.whenNear(el, fn)           run fn once when el comes within ~700px of the viewport (lazy figures)
     L23.fmt(v)                     numbers with a real minus sign and infinity signs
   Built on VDSA.s / VDSA.animate; colours come from the state tokens through the CSS in css/lessons/23-*.css.
   Both tree views draw one snapshot at a time (js/algos/23-segment-and-fenwick-trees.js) and never rebuild between
   steps: node and bar elements persist, classes change with CSS transitions, values pop, tokens fly. */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s;
  var L23 = V.lessons = V.lessons || {};
  L23 = V.lessons.l23 = V.lessons.l23 || {};

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  L23.fmt = function (v) {
    if (v === Infinity) return '∞';
    if (v === -Infinity) return '−∞';
    if (v === null || v === undefined) return '';
    return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v);
  };
  var fmt = L23.fmt;
  function innerW(el) {
    var cs = window.getComputedStyle(el);
    return Math.max(0, el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
  }

  /* Reorder the options of a multiple-choice spec (and their explanations) in a stable, question-dependent way,
     so the right answer is not always the first one. */
  L23.mix = function (spec) {
    var n = spec.options.length, h = 2166136261, q = String(spec.question);
    for (var i = 0; i < q.length; i++) { h ^= q.charCodeAt(i); h = Math.imul(h, 16777619); }
    var order = V.shuffle(V.range(n), V.rng(h >>> 0));
    var out = Object.assign({}, spec);
    out.options = order.map(function (k) { return spec.options[k]; });
    if (Array.isArray(spec.explain)) out.explain = order.map(function (k) { return spec.explain[k]; });
    out.answer = order.indexOf(spec.answer);
    return out;
  };

  L23.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 23] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  function setState(el, base, state, extra) {
    var c = base + ' is-' + (state || 'default');
    if (extra) c += ' ' + extra;
    if (el.getAttribute('class') !== c) el.setAttribute('class', c);
  }
  function setText(el, text) {
    text = String(text);
    if (el.textContent !== text) el.textContent = text;
  }
  function pop(el, duration) {
    if (!duration || !el.animate) return;
    try { el.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: Math.max(180, duration * 0.8), easing: 'cubic-bezier(.2,.8,.2,1)' }); } catch (e) { /* ignore */ }
  }

  /* ================================================================== segment tree view */
  L23.segView = function (container, o) {
    o = o || {};
    container = V.$(container);
    var svg = s('svg', { class: 'l23-svg l23-seg', role: 'img', 'aria-label': o.label || 'Segment tree above its array' });
    container.appendChild(svg);
    var A = V.algos.rangeTrees;
    var st = { n: 0, shp: null, rec: {}, cells: [], geo: null, last: null, tween: null };
    var gBand, gEdges, gExt, gDrops, gCells, gNodes, gChips, gBracket, tokenEl, bandEl, brEl, brText;

    function geometry(n, shp) {
      var W = innerW(container) || o.width || 640;
      var pad = 10, minCw = o.cellMin || 32, maxCw = o.cellMax || 54;
      var cw = clamp(Math.floor((W - 2 * pad) / n), minCw, maxCw);
      var svgW = Math.max(W, cw * n + 2 * pad);
      var x0 = (svgW - cw * n) / 2;
      var nodeH = o.nodeH || (o.compact ? 34 : 40), rowH = o.rowH || (o.compact ? 54 : 64), top = 20;
      var g = { W: svgW, cw: cw, x0: x0, nodeH: nodeH, rowH: rowH, top: top, x: {}, y: {}, w: {} };
      (function pos(id) {
        var nd = shp.byId[id];
        if (nd.leaf) g.x[id] = x0 + (nd.lo + 0.5) * cw;
        else { pos(nd.left); pos(nd.right); g.x[id] = (g.x[nd.left] + g.x[nd.right]) / 2; }
        g.y[id] = top + nodeH / 2 + nd.depth * rowH;
        var ext = nd.hi - nd.lo + 1;
        g.w[id] = nd.leaf ? cw - 6 : clamp(ext * cw - 14, cw - 6, o.compact ? 64 : 78);
      })(shp.root);
      g.treeBottom = top + shp.maxDepth * rowH + nodeH + 8;
      g.showArray = o.showArray !== false;
      g.cellsY = g.treeBottom + 22;
      g.cellH = o.compact ? 30 : 34;
      g.idxY = g.cellsY + g.cellH + 14;
      g.bracketY = g.idxY + 14;
      g.H = g.showArray ? g.bracketY + (o.bracket === false ? 6 : 34) : g.treeBottom;
      return g;
    }

    function setup(n) {
      var shp = A.shape(n), g = geometry(n, shp);
      st.n = n; st.shp = shp; st.geo = g; st.rec = {}; st.cells = [];
      V.clear(svg);
      svg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
      svg.setAttribute('width', g.W); svg.setAttribute('height', g.H);
      svg.style.width = g.W + 'px'; svg.style.height = g.H + 'px';
      gBand = s('g'); gEdges = s('g', { class: 'l23-edges' }); gExt = s('g'); gDrops = s('g'); gCells = s('g'); gNodes = s('g'); gChips = s('g'); gBracket = s('g');
      svg.appendChild(gBand); svg.appendChild(gEdges); svg.appendChild(gDrops); svg.appendChild(gExt); svg.appendChild(gCells); svg.appendChild(gNodes); svg.appendChild(gChips); svg.appendChild(gBracket);
      bandEl = s('rect', { class: 'l23-band', rx: 6, y: 2, height: (g.showArray ? g.cellsY + g.cellH + 4 : g.treeBottom) - 2, x: g.x0, width: g.cw, style: 'opacity:0' });
      gBand.appendChild(bandEl);
      shp.nodes.forEach(function (nd) {
        var id = nd.id, x = g.x[id], y = g.y[id], w = g.w[id], h = g.nodeH;
        var r = { nd: nd };
        if (nd.parent) {
          var px = g.x[nd.parent], py = g.y[nd.parent] + h / 2, cy = y - h / 2;
          r.edge = s('path', { class: 'l23-edge is-default', d: 'M' + px + ' ' + py + ' C' + px + ' ' + (py + 16) + ' ' + x + ' ' + (cy - 16) + ' ' + x + ' ' + cy });
          gEdges.appendChild(r.edge);
        }
        if (!nd.leaf) {
          var ext = nd.hi - nd.lo + 1;
          r.ext = s('rect', { class: 'l23-ext is-default', x: g.x0 + nd.lo * g.cw + 3, width: ext * g.cw - 6, y: y + h / 2 + 3, height: 3, rx: 1.5 });
          gExt.appendChild(r.ext);
        } else if (g.showArray) {
          var top = y + h / 2 + 3;
          r.drop = s('line', { class: 'l23-drop', x1: x, x2: x, y1: top, y2: g.cellsY });
          gDrops.appendChild(r.drop);
        }
        r.g = s('g', { class: 'l23-node is-default', 'data-id': id, transform: 'translate(' + x + ' ' + y + ')' });
        r.ring = s('rect', { class: 'l23-ring', x: -w / 2 - 4, y: -h / 2 - 4, width: w + 8, height: h + 8, rx: 13 });
        r.box = s('rect', { class: 'l23-box', x: -w / 2, y: -h / 2, width: w, height: h, rx: 9 });
        r.lbl = s('text', { class: 'l23-nlabel', y: -h / 2 + (o.compact ? 11 : 13), 'text-anchor': 'middle' });
        r.lbl.textContent = nd.leaf ? '[' + nd.lo + ']' : '[' + nd.lo + ',' + nd.hi + ']';
        r.val = s('text', { class: 'l23-nval', y: h / 2 - (o.compact ? 8 : 9), 'text-anchor': 'middle' });
        r.g.appendChild(r.ring); r.g.appendChild(r.box); r.g.appendChild(r.lbl); r.g.appendChild(r.val);
        r.g.setAttribute('aria-label', 'Node covering ' + (nd.leaf ? 'index ' + nd.lo : 'indices ' + nd.lo + ' to ' + nd.hi));
        gNodes.appendChild(r.g);
        r.ret = s('g', { class: 'l23-ret', style: 'opacity:0' });
        r.retBox = s('rect', { rx: 8, height: 16, y: -8 });
        r.retTxt = s('text', { 'text-anchor': 'middle', y: 0.5 });
        r.ret.appendChild(r.retBox); r.ret.appendChild(r.retTxt);
        r.ret.setAttribute('transform', 'translate(' + (x + w / 2 - 4) + ' ' + (y - h / 2 - 1) + ')');
        gChips.appendChild(r.ret);
        r.tag = s('g', { class: 'l23-tag', style: 'opacity:0' });
        r.tagBox = s('rect', { rx: 8, height: 16, y: -8 });
        r.tagTxt = s('text', { 'text-anchor': 'middle', y: 0.5 });
        r.tag.appendChild(r.tagBox); r.tag.appendChild(r.tagTxt);
        r.tag.setAttribute('transform', 'translate(' + (x - w / 2 + 4) + ' ' + (y - h / 2 - 1) + ')');
        gChips.appendChild(r.tag);
        st.rec[id] = r;
      });
      if (g.showArray) {
        for (var i = 0; i < n; i++) {
          var cx = g.x0 + (i + 0.5) * g.cw;
          var cg = s('g', { class: 'l23-cell is-default', 'data-id': 'c' + i, transform: 'translate(' + cx + ' ' + g.cellsY + ')' });
          var rect = s('rect', { class: 'l23-cbox', x: -g.cw / 2 + 2, y: 0, width: g.cw - 4, height: g.cellH, rx: 7 });
          var vt = s('text', { class: 'l23-cval', y: g.cellH / 2 + 5, 'text-anchor': 'middle' });
          var it = s('text', { class: 'l23-cidx', y: g.cellH + 14, 'text-anchor': 'middle' });
          it.textContent = i;
          cg.appendChild(rect); cg.appendChild(vt); cg.appendChild(it);
          cg.setAttribute('aria-label', 'Array cell ' + i);
          gCells.appendChild(cg);
          st.cells.push({ g: cg, val: vt });
        }
        if (o.bracket !== false) {
          brEl = s('rect', { class: 'l23-bracket', rx: 2, y: g.bracketY, height: 4, x: g.x0, width: g.cw, style: 'opacity:0' });
          brText = s('text', { class: 'l23-brtext', y: g.bracketY + 20, 'text-anchor': 'middle', x: g.x0 + g.cw / 2, style: 'opacity:0' });
          gBracket.appendChild(brEl); gBracket.appendChild(brText);
        } else { brEl = null; brText = null; }
      }
      tokenEl = s('circle', { class: 'l23-token', r: 6, cx: 0, cy: 0, style: 'opacity:0' });
      gBracket.appendChild(tokenEl);
    }

    function nodeCentre(id) { return { x: st.geo.x[id], y: st.geo.y[id] }; }

    function flyToken(move, dur, label) {
      if (st.tween) { st.tween.cancel(); st.tween = null; }
      if (!move || !dur || !st.rec[move.from] || !st.rec[move.to]) { tokenEl.style.opacity = 0; return; }
      var a = nodeCentre(move.from), b = nodeCentre(move.to), h = st.geo.nodeH / 2;
      var ay = a.y + (move.dir === 'down' ? h : -h), by = b.y + (move.dir === 'down' ? -h : h);
      tokenEl.setAttribute('class', 'l23-token is-' + move.dir);
      tokenEl.style.opacity = 1;
      tokenEl.setAttribute('cx', a.x); tokenEl.setAttribute('cy', ay);
      st.tween = V.tween(dur * 0.9, function (t, e) {
        tokenEl.setAttribute('cx', (a.x + (b.x - a.x) * e).toFixed(1));
        tokenEl.setAttribute('cy', (ay + (by - ay) * e).toFixed(1));
      }, { ease: V.ease && V.ease.inOut });
      st.tween.promise.then(function (done) { if (done !== false) tokenEl.style.opacity = 0; });
    }

    function chip(g, box, txt, text, dur) {
      if (text === null || text === undefined || text === '') { if (g.style.opacity !== '0') g.style.opacity = 0; return; }
      var w = Math.max(24, 12 + String(text).length * 6.6);
      var shown = g.style.opacity === '1';
      var prev = txt.textContent;
      box.setAttribute('x', -w / 2); box.setAttribute('width', w);
      setText(txt, text);
      g.style.opacity = 1;
      if (!shown || prev !== String(text)) pop(g, dur);
    }

    function render(snap, opts) {
      opts = opts || {};
      var dur = opts.duration || 0;
      if (!st.shp || st.n !== snap.n) setup(snap.n);
      st.last = snap;
      var g = st.geo;
      svg.style.setProperty('--t', dur + 'ms');
      st.shp.nodes.forEach(function (nd) {
        var r = st.rec[nd.id], state = snap.states[nd.id] || 'default', v = snap.vals[nd.id];
        var stale = snap.stale && snap.stale[nd.id];
        var cls = 'l23-node is-' + state + (snap.cur === nd.id ? ' is-cur' : '') + (stale ? ' is-stale' : '') + (v === undefined ? ' is-empty' : '');
        if (r.g.getAttribute('class') !== cls) r.g.setAttribute('class', cls);
        var t = v === undefined ? '' : fmt(v);
        if (r.val.textContent !== t) {
          setText(r.val, t);
          if (t !== '') pop(r.val, dur);
        }
        var len = t.length;
        r.val.setAttribute('class', 'l23-nval' + (len > 4 ? ' is-small' : len > 3 ? ' is-mid' : ''));
        if (r.edge) setState(r.edge, 'l23-edge', state === 'muted' ? 'muted' : (state === 'default' && v === undefined ? 'default' : state));
        if (r.ext) setState(r.ext, 'l23-ext', state);
        chip(r.ret, r.retBox, r.retTxt, snap.ret && snap.ret[nd.id] !== undefined ? '↑' + fmt(snap.ret[nd.id]) : null, dur);
        chip(r.tag, r.tagBox, r.tagTxt, snap.tags && snap.tags[nd.id] ? (snap.tags[nd.id] > 0 ? '+' : '−') + Math.abs(snap.tags[nd.id]) : null, dur);
      });
      if (g.showArray) {
        st.cells.forEach(function (c, i) {
          var state = snap.cells && snap.cells[i] ? snap.cells[i] : 'default';
          var inQ = snap.query && i >= snap.query.l && i <= snap.query.r;
          setState(c.g, 'l23-cell', state, inQ && state === 'default' ? 'is-inq' : '');
          var t = fmt(snap.arr[i]);
          if (c.val.textContent !== t) { setText(c.val, t); pop(c.val, dur); }
        });
        if (snap.query) {
          var x = g.x0 + snap.query.l * g.cw, w = (snap.query.r - snap.query.l + 1) * g.cw;
          V.animate(bandEl, { opacity: 1, attr: { x: x, width: w } }, { duration: dur });
          if (brEl) {
            V.animate(brEl, { opacity: 1, attr: { x: x + 3, width: w - 6 } }, { duration: dur });
            V.animate(brText, { opacity: 1, attr: { x: x + w / 2 } }, { duration: dur });
            setText(brText, 'range [' + snap.query.l + ', ' + snap.query.r + ']');
          }
        } else {
          V.animate(bandEl, { opacity: 0 }, { duration: dur });
          if (brEl) { V.animate(brEl, { opacity: 0 }, { duration: dur }); V.animate(brText, { opacity: 0 }, { duration: dur }); }
        }
      }
      flyToken(snap.move, dur);
    }

    var off = V.onResize(container, function () {
      if (!st.n || !st.last) return;
      var geo2 = geometry(st.n, st.shp);
      if (Math.abs(geo2.W - st.geo.W) < 2 && geo2.cw === st.geo.cw) return;
      var last = st.last;
      setup(st.n); render(last, { duration: 0 });
    });

    return {
      el: svg,
      setup: setup,
      render: render,
      prepare: function (steps) { if (steps && steps.length && st.n !== steps[0].n) setup(steps[0].n); },
      reset: function () { st.last = null; },
      geometry: function () { return st.geo; },
      shape: function () { return st.shp; },
      positionOf: nodeCentre,
      destroy: function () { off && off(); svg.remove(); }
    };
  };

  /* ================================================================== Fenwick view */
  L23.fenView = function (container, o) {
    o = o || {};
    container = V.$(container);
    var svg = s('svg', { class: 'l23-svg l23-fen', role: 'img', 'aria-label': o.label || 'Fenwick tree: blocks above an array' });
    container.appendChild(svg);
    var A = V.algos.rangeTrees;
    var st = { n: 0, geo: null, bars: [], cells: [], bits: [], idx: [], arcs: {}, last: null, handlers: {}, arcLayer: null };
    var bandEl, curG, curBox, curTxt;

    function bitLen(n) { return n.toString(2).length; }
    function colX(g, k) { return g.x0 + (clamp(k, 0, g.n + 1) - 0.5) * g.cw; }

    function setup(n) {
      var W = innerW(container) || o.width || 640;
      var padL = 64, padR = 14;   // wide enough for the right-aligned row labels ("blocks T")
      var cw = clamp(Math.floor((W - padL - padR) / (n + 0.6)), o.cellMin || 34, o.cellMax || 56);
      var svgW = Math.max(W, cw * (n + 1) + padL + padR);
      var maxLevel = 0;
      for (var i = 1; i <= n; i++) maxLevel = Math.max(maxLevel, Math.round(Math.log2(i & -i)));
      var barH = 28, gap = 6, pillH = 22;
      var g = { n: n, cw: cw, W: svgW, x0: padL + cw * 0.5, maxLevel: maxLevel, barH: barH, gap: gap };
      g.barsTop = pillH + 6;
      g.barsBottom = g.barsTop + (maxLevel + 1) * (barH + gap) - gap;
      g.cellsY = g.barsBottom + 14; g.cellH = 32;
      g.idxY = g.cellsY + g.cellH + 16;
      g.binY = g.idxY + 17;
      g.arcY = g.binY + 10;
      g.arcMax = 62;
      g.H = g.arcY + g.arcMax + 22;
      st.n = n; st.geo = g; st.bars = []; st.cells = []; st.bits = []; st.idx = []; st.arcs = {};
      V.clear(svg);
      svg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
      svg.setAttribute('width', g.W); svg.setAttribute('height', g.H);
      svg.style.width = g.W + 'px'; svg.style.height = g.H + 'px';
      var gLabels = s('g', { 'aria-hidden': 'true' }), gBars = s('g'), gCells = s('g'), gIdx = s('g'), gHit = s('g'), gArcs = s('g'), gCur = s('g');
      bandEl = s('rect', { class: 'l23-fband', rx: 8, x: 0, y: g.barsTop - 4, width: g.cw, height: g.binY + 8 - g.barsTop + 4, style: 'opacity:0' });
      svg.appendChild(bandEl); svg.appendChild(gLabels); svg.appendChild(gBars); svg.appendChild(gCells); svg.appendChild(gIdx); svg.appendChild(gArcs); svg.appendChild(gHit); svg.appendChild(gCur);
      st.arcLayer = gArcs;
      [['blocks T', g.barsTop + g.barH / 2 + 4], ['array a', g.cellsY + g.cellH / 2 + 4], ['index i', g.idxY + 4], ['binary', g.binY + 4]].forEach(function (l) {
        var t = s('text', { class: 'l23-rowlbl', x: padL - 8, y: l[1], 'text-anchor': 'end' }); t.textContent = l[0]; gLabels.appendChild(t);
      });
      var bw = bitLen(n);
      for (var k = 1; k <= n; k++) {
        var low = k & -k, level = Math.round(Math.log2(low));
        var bx = g.x0 + (k - low - 0.5) * g.cw + 2, by = g.barsTop + (g.maxLevel - level) * (barH + gap), bwid = low * g.cw - 4;
        var bg = s('g', { class: 'l23-bar is-default', 'data-id': 'T' + k });
        bg.appendChild(s('rect', { class: 'l23-bbox', x: bx, y: by, width: bwid, height: barH, rx: 8 }));
        var bt = s('text', { class: 'l23-bval', x: bx + bwid / 2 + (low > 1 ? 6 : 0), y: by + barH / 2 + 5, 'text-anchor': 'middle' });
        bg.appendChild(bt);
        var tag = null;
        if (low > 1) { tag = s('text', { class: 'l23-btag', x: bx + 7, y: by + barH / 2 + 4 }); tag.textContent = 'T' + k; bg.appendChild(tag); }
        bg.setAttribute('aria-label', 'T[' + k + '] covers ' + (low === 1 ? 'a[' + k + ']' : 'a[' + (k - low + 1) + ' to ' + k + ']'));
        gBars.appendChild(bg);
        st.bars[k] = { g: bg, val: bt };
        var cx = g.x0 + (k - 0.5) * g.cw;
        var cg = s('g', { class: 'l23-cell is-default', 'data-id': 'a' + k, transform: 'translate(' + cx + ' ' + g.cellsY + ')' });
        cg.appendChild(s('rect', { class: 'l23-cbox', x: -g.cw / 2 + 2, y: 0, width: g.cw - 4, height: g.cellH, rx: 7 }));
        var cv = s('text', { class: 'l23-cval', y: g.cellH / 2 + 5, 'text-anchor': 'middle' });
        cg.appendChild(cv);
        gCells.appendChild(cg);
        st.cells[k] = { g: cg, val: cv };
        var it = s('text', { class: 'l23-fidx', x: cx, y: g.idxY, 'text-anchor': 'middle' });
        it.textContent = k; gIdx.appendChild(it); st.idx[k] = it;
        var bit = s('text', { class: 'l23-fbin', x: cx, y: g.binY, 'text-anchor': 'middle' });
        var lowPos = Math.round(Math.log2(low));
        for (var b = bw - 1; b >= 0; b--) {
          var on = (k >> b) & 1;
          var ts = s('tspan', { class: 'l23-bit' + (on ? ' is-one' : '') + (b === lowPos ? ' is-low' : '') });
          ts.textContent = on ? '1' : '0';
          bit.appendChild(ts);
        }
        gIdx.appendChild(bit); st.bits[k] = bit;
        if (o.clickable) {
          var hit = s('rect', { class: 'l23-fhit', x: g.x0 + (k - 1) * g.cw, y: g.barsTop - 4, width: g.cw, height: g.binY + 8 - g.barsTop + 4, tabindex: 0, role: 'button', 'aria-label': 'Index ' + k });
          (function (kk) {
            hit.addEventListener('click', function () { if (st.handlers.click) st.handlers.click({ index: kk }); });
            hit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (st.handlers.click) st.handlers.click({ index: kk }); } });
          })(k);
          gHit.appendChild(hit);
        }
      }
      curG = s('g', { class: 'l23-fcur', style: 'opacity:0' });
      curBox = s('rect', { rx: 11, height: 22, y: 0, width: 46, x: -23 });
      curTxt = s('text', { y: 15, 'text-anchor': 'middle' });
      curG.appendChild(curBox); curG.appendChild(curTxt);
      gCur.appendChild(curG);
    }

    function arcFor(j, firstPhase) {
      var g = st.geo, key = j.from + '>' + j.to + '>' + j.phase;
      var a = st.arcs[key];
      if (!a) {
        var x1 = colX(g, j.from), x2 = colX(g, j.to), dx = Math.abs(x2 - x1), h = clamp(20 + dx * 0.14, 24, g.arcMax);
        var y = g.arcY;
        var el = s('g', { class: 'l23-arc' });
        var p = s('path', { d: 'M' + x1 + ' ' + y + ' C' + x1 + ' ' + (y + h) + ' ' + x2 + ' ' + (y + h) + ' ' + x2 + ' ' + y, pathLength: 1 });
        var head = s('path', { class: 'l23-arch', d: 'M' + (x2 - 5) + ' ' + (y + 8) + ' L' + x2 + ' ' + (y + 0.5) + ' L' + (x2 + 5) + ' ' + (y + 8) });
        var lt = s('text', { x: (x1 + x2) / 2, y: y + h * 0.75 + 14, 'text-anchor': 'middle' });
        lt.textContent = j.label;
        el.appendChild(p); el.appendChild(head); el.appendChild(lt);
        st.arcLayer.appendChild(el);
        a = st.arcs[key] = { el: el, state: j.phase === 'update' ? 'swap' : (j.phase === firstPhase ? 'done' : 'compare') };
        el.setAttribute('class', 'l23-arc is-' + a.state);
        void el.getBoundingClientRect();
      }
      return a;
    }

    function render(snap, opts) {
      opts = opts || {};
      var dur = opts.duration || 0;
      if (!st.n || st.n !== snap.n) setup(snap.n);
      st.last = snap;
      var g = st.geo, n = snap.n;
      svg.style.setProperty('--t', dur + 'ms');
      for (var k = 1; k <= n; k++) {
        var bs = snap.bars[k] || 'default';
        setState(st.bars[k].g, 'l23-bar', bs);
        var tv = fmt(snap.tree[k - 1]);
        if (st.bars[k].val.textContent !== tv) { setText(st.bars[k].val, tv); pop(st.bars[k].val, dur); }
        var cs = snap.cells && snap.cells[k] ? snap.cells[k] : 'default';
        setState(st.cells[k].g, 'l23-cell', cs);
        var cv = fmt(snap.arr[k - 1]);
        if (st.cells[k].val.textContent !== cv) { setText(st.cells[k].val, cv); pop(st.cells[k].val, dur); }
        var isCur = snap.cursor === k;
        var cl = 'l23-fidx' + (isCur ? ' is-cur' : '');
        if (st.idx[k].getAttribute('class') !== cl) st.idx[k].setAttribute('class', cl);
        var bl = 'l23-fbin' + (isCur ? ' is-cur' : '');
        if (st.bits[k].getAttribute('class') !== bl) st.bits[k].setAttribute('class', bl);
      }
      // arcs
      var firstPhase = snap.jumps.length ? snap.jumps[0].phase : '';
      var want = {};
      snap.jumps.forEach(function (j) { want[j.from + '>' + j.to + '>' + j.phase] = j; });
      Object.keys(st.arcs).forEach(function (key) { if (!want[key]) st.arcs[key].el.classList.remove('is-on'); });
      Object.keys(want).forEach(function (key) { var a = arcFor(want[key], firstPhase); a.el.classList.add('is-on'); });
      // cursor
      if (snap.cursor === null || snap.cursor === undefined) {
        V.animate(bandEl, { opacity: 0 }, { duration: dur });
        curG.style.opacity = 0;
      } else {
        var out = snap.cursor < 0 || snap.cursor > n;
        var cx = colX(g, snap.cursor);
        V.animate(bandEl, { opacity: 1, attr: { x: cx - g.cw / 2 } }, { duration: dur });
        var wtxt = String(snap.cursor);
        var w = Math.max(46, 36 + wtxt.length * 8);
        curBox.setAttribute('width', w); curBox.setAttribute('x', -w / 2);
        setText(curTxt, 'i = ' + snap.cursor);
        curG.setAttribute('class', 'l23-fcur' + (out ? ' is-out' : ''));
        curG.style.opacity = 1;
        V.animate(curG, { x: cx, y: 0 }, { duration: dur });
      }
    }

    function fenWidth(n) {
      var W = innerW(container) || o.width || 640;
      return clamp(Math.floor((W - 46 - 14) / (n + 0.6)), o.cellMin || 34, o.cellMax || 56);
    }
    V.onResize(container, function () {
      if (!st.n || !st.last) return;
      if (fenWidth(st.n) === st.geo.cw && (Math.abs(innerW(container) - st.geo.W) < 2 || st.geo.W >= innerW(container))) return;
      var last = st.last; setup(st.n); render(last, { duration: 0 });
    });

    return {
      el: svg, setup: setup, render: render,
      prepare: function (steps) { if (steps && steps.length && st.n !== steps[0].n) setup(steps[0].n); },
      reset: function () { st.last = null; Object.keys(st.arcs).forEach(function (k) { st.arcs[k].el.remove(); }); st.arcs = {}; },
      on: function (ev, fn) { st.handlers[ev] = fn; },
      geometry: function () { return st.geo; }
    };
  };

  /* ================================================================== bit calculator */
  L23.bitCalc = function (container, o) {
    o = o || {};
    container = V.$(container);
    var bits = o.bits || 8, rowsWanted = o.rows || ['i', 'not', 'neg', 'low', 'next'];
    var h = V.h;
    var defs = {
      i: { label: '<b>i</b>' },
      not: { label: '<b>~i</b> <small>flip every bit</small>' },
      neg: { label: '<b>−i</b> <small>= ~i + 1</small>' },
      low: { label: '<b>i &amp; −i</b> <small>lowest set bit</small>' },
      next: { label: '' }
    };
    var root = h('div', { class: 'l23-bits', role: 'group', 'aria-label': o.label || 'Binary of i, minus i, and i AND minus i' });
    var rows = {};
    function build() {
      V.clear(root);
      rowsWanted.forEach(function (name) {
        var cells = h('div', { class: 'l23-bits__cells', style: '--bits:' + bits });
        var arr = [];
        for (var b = bits - 1; b >= 0; b--) { var c = h('span', { class: 'l23-bit-cell', 'data-bit': b }, '0'); cells.appendChild(c); arr.push(c); }
        var lbl = h('span', { class: 'l23-bits__lbl', html: defs[name].label });
        var val = h('span', { class: 'l23-bits__val' });
        var row = h('div', { class: 'l23-bits__row', 'data-row': name }, lbl, cells, val);
        root.appendChild(row);
        rows[name] = { row: row, cells: arr, lbl: lbl, val: val };
      });
    }
    build();
    container.appendChild(root);
    var mask = function () { return (Math.pow(2, bits) - 1); };

    function paint(name, value, opts) {
      var r = rows[name]; if (!r) return;
      opts = opts || {};
      var v = value === null ? null : value;
      r.cells.forEach(function (c, k) {
        var b = bits - 1 - k;
        var one = v !== null && (Math.floor(v / Math.pow(2, b)) % 2) === 1;
        var cls = 'l23-bit-cell' + (one ? ' is-one' : '') + (opts.low === b && v !== null ? ' is-low' : '') + (opts.carry && b <= opts.low && v !== null ? ' is-carry' : '') + (opts.flip && v !== null && b > opts.low ? ' is-flip' : '') + (v === null ? ' is-off' : '');
        if (c.className !== cls) c.className = cls;
        var t = v === null ? '·' : (one ? '1' : '0');
        if (c.textContent !== t) c.textContent = t;
      });
      r.val.textContent = opts.text !== undefined ? opts.text : (v === null ? '' : String(v));
    }

    function set(i, opt) {
      opt = opt || {};
      var m = mask();
      root.style.setProperty('--t', (opt.duration === undefined ? 320 : opt.duration) + 'ms');
      if (i === null || i === undefined || i < 1) {
        Object.keys(rows).forEach(function (n) { paint(n, null); });
        if (rows.next) rows.next.lbl.innerHTML = opt.nextLabel || '<b>next index</b>';
        return;
      }
      var low = i & -i, lowPos = Math.round(Math.log2(low));
      paint('i', i, { low: lowPos });
      paint('not', (~i) & m, { low: lowPos, flip: false });
      paint('neg', ((~i) + 1) & m, { low: lowPos, carry: true, text: '−' + i });
      paint('low', low, { low: lowPos, text: String(low) });
      if (rows.next) {
        var mode = opt.mode || 'sub';
        var nx = mode === 'add' ? i + low : i - low;
        rows.next.lbl.innerHTML = mode === 'add' ? '<b>i + (i &amp; −i)</b> <small>next block up</small>' : '<b>i − (i &amp; −i)</b> <small>next block down</small>';
        paint('next', nx > m ? null : nx, { low: nx > 0 ? Math.round(Math.log2(nx & -nx)) : -1, text: String(nx) });
      }
    }
    return { el: root, set: set, setBits: function (b) { bits = b; build(); }, get bits() { return bits; } };
  };
}());
