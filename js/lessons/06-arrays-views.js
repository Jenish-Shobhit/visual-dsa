/* Lesson 06 · custom figures (renderers only; the data comes from js/algos/06-arrays.js).

   Every figure follows the engine's contract (docs/ENGINE.md §13): build the SVG once per layout, keep
   one element per item id, and on each render MOVE those elements (VDSA.animate) and switch state classes.
   The SVGs carry the classes `vz a6`, so cells reuse the renderer styles in css/viz.css
   (<g class="vz-item is-STATE"><rect class="vz-shape"/><text class="vz-ink vz-value"/></g>).

   Responsive figures measure their stage and use 1 SVG unit = 1 CSS pixel, so type stays crisp; they
   rebuild their layout when the stage width changes and redraw the current state instantly.

   VDSA.a6 = { responsive, raceView, shelfView, addressView, spikesView, bankView, rowMajorView, cacheView,
               cellStrip, miniSvg }                                                                        */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s;
  var A = function () { return V.algos.arrays; };

  /* ------------------------------------------------------------------ helpers */
  function contentWidth(el) {
    var cs = getComputedStyle(el);
    return Math.max(0, el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0));
  }
  function svgRoot(w, h, label, extra) {
    var svg = s('svg', { class: 'vz a6' + (extra ? ' ' + extra : ''), viewBox: '0 0 ' + w + ' ' + h, width: '100%', role: 'img', 'aria-label': label, focusable: 'false' });
    svg.style.height = 'auto';
    return svg;
  }
  function setDur(svg, ms) { svg.style.setProperty('--vz-dur', Math.round(ms || 0) + 'ms'); }
  function setState(el, st) {
    st = st || 'default';
    if (el.__st === st) return;
    if (el.__st) el.classList.remove('is-' + el.__st);
    el.classList.add('is-' + st);
    el.__st = st;
  }
  function cell(parent, w, h, text, opts) {
    opts = opts || {};
    var g = s('g', { class: 'vz-item is-default' + (opts.cls ? ' ' + opts.cls : '') });
    g.__st = 'default';
    g.rect = s('rect', { class: 'vz-shape', x: -w / 2, y: -h / 2, width: w, height: h, rx: opts.rx === undefined ? Math.min(8, h * 0.18) : opts.rx });
    g.txt = s('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em', 'font-size': opts.font || Math.max(10, Math.min(16, Math.round(h * 0.4))) }, text === undefined ? '' : String(text));
    g.appendChild(g.rect); g.appendChild(g.txt);
    if (parent) parent.appendChild(g);
    return g;
  }
  function label(parent, x, y, text, cls, anchor) {
    var t = s('text', { class: cls || 'vz-label', x: x, y: y, 'text-anchor': anchor || 'middle', dy: '.35em' }, text);
    parent.appendChild(t);
    return t;
  }
  /* Tween an element along a quadratic curve from (x0,y0) to (x1,y1) bending by `bend` px (up = positive). */
  function arcTo(el, x0, y0, x1, y1, bend, dur, opts) {
    opts = opts || {};
    var st = el.__vdsa || (el.__vdsa = { x: 0, y: 0, scale: 1, rotate: 0, opacity: null, attr: {} });
    if (st.anim) st.anim.cancel();
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - bend;
    var anim = V.tween(V.dur(dur), function (t, e) {
      var u = 1 - e, x = u * u * x0 + 2 * u * e * mx + e * e * x1, y = u * u * y0 + 2 * u * e * my + e * e * y1;
      st.x = x; st.y = y;
      el.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')' + (st.scale !== 1 ? ' scale(' + st.scale + ')' : ''));
      if (opts.onFrame) opts.onFrame(e);
    }, { ease: opts.ease || 'inOut' });
    st.anim = anim;
    return anim.promise;
  }

  /* responsive(stage, build) -> {render(state, ctx), current()}. build(width) returns {svg, update(state, ms, instant)}. */
  function responsive(stage, build) {
    var cur = null, state = null, w = 0;
    function rebuild() {
      w = Math.round(contentWidth(stage)) || 640;
      if (cur && cur.destroy) cur.destroy();
      if (cur && cur.svg && cur.svg.parentNode) cur.svg.parentNode.removeChild(cur.svg);
      cur = build(w);
      stage.appendChild(cur.svg);
      if (state !== null) cur.update(state, 0, true);
    }
    rebuild();
    V.onResize(stage, function () {
      var nw = Math.round(contentWidth(stage));
      if (nw && Math.abs(nw - w) > 4) rebuild();
    });
    return {
      render: function (st, ctx) { state = st; var inst = !ctx || !!ctx.instant || !ctx.duration; cur.update(st, inst ? 0 : ctx.duration, inst); },
      current: function () { return cur; },
      stage: stage
    };
  }

  /* ================================================================== 1. access race (linked vs array) */
  /* data: {values, nodeCell, cells, base}; state: accessRace step + {k}. */
  function raceView(stage, data) {
    return responsive(stage, function (W) {
      var n = data.values.length, cols = W >= 600 ? 12 : 6, memRows = Math.ceil(data.cells / cols);
      var pad = 10, cw = Math.min(62, Math.floor((W - 2 * pad) / cols)), ch = 34, rowGap = 46;
      var memW = cw * cols, x0 = (W - memW) / 2;
      var yA = 16, memTop = yA + 44;
      var memBottom = memTop + memRows * (ch + rowGap) - rowGap;
      var yB = memBottom + 52, pitch = Math.min(64, Math.floor((W - 2 * pad) / n)), stripW = pitch * n, xb = (W - stripW) / 2;
      var bTop = yB + 62, H = bTop + ch + 50;
      var svg = svgRoot(W, H, 'Two memories: a linked list scattered across memory and an array stored side by side');
      var gA = s('g'), gB = s('g');
      svg.appendChild(gA); svg.appendChild(gB);
      var narrow = W < 600;
      label(gA, x0, yA, narrow ? 'Linked list: follow the links' : 'Linked: nodes scattered, each one stores where the next one is', 'vz-caption a6-title', 'start');
      function cellPos(c) { var r = Math.floor(c / cols), k = c % cols; return { x: x0 + k * cw + cw / 2, y: memTop + r * (ch + rowGap) + ch / 2, r: r }; }
      var taken = {};
      data.nodeCell.forEach(function (c) { taken[c] = true; });
      for (var c = 0; c < data.cells; c++) {
        if (taken[c]) continue;
        var p = cellPos(c);
        gA.appendChild(s('rect', { class: 'a6-mem', x: p.x - cw / 2 + 2, y: p.y - ch / 2, width: cw - 4, height: ch, rx: 6 }));
      }
      var edges = [], edgeLayer = s('g');
      gA.appendChild(edgeLayer);
      function cubic(p0, c1, c2, p3, t) {
        var u = 1 - t;
        return { x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y };
      }
      for (var i = 0; i < n - 1; i++) {
        var a = cellPos(data.nodeCell[i]), b = cellPos(data.nodeCell[i + 1]);
        var P0, C1, C2, P3, hy = ch / 2;
        if (a.r === b.r) {
          // same row: arc through the gap above (below for the last row)
          var up = a.r === memRows - 1 && memRows > 1 ? 1 : -1;
          var lift = Math.min(rowGap * 0.8, 14 + Math.abs(b.x - a.x) * 0.06);
          P0 = { x: a.x + (b.x > a.x ? 6 : -6), y: a.y + up * hy }; P3 = { x: b.x, y: b.y + up * (hy + 2) };
          C1 = { x: P0.x + (P3.x - P0.x) * 0.2, y: P0.y + up * lift * 1.3 }; C2 = { x: P0.x + (P3.x - P0.x) * 0.8, y: P3.y + up * lift * 1.3 };
        } else {
          var dir = b.r > a.r ? 1 : -1, reach = rowGap * 0.75 + Math.abs(b.r - a.r - dir) * 0;
          P0 = { x: a.x, y: a.y + dir * hy }; P3 = { x: b.x, y: b.y - dir * (hy + 2) };
          C1 = { x: a.x, y: P0.y + dir * reach }; C2 = { x: b.x, y: P3.y - dir * reach };
        }
        var g = s('g', { class: 'vz-edge is-default a6-link' });
        var d = 'M' + P0.x.toFixed(1) + ' ' + P0.y.toFixed(1) + ' C' + C1.x.toFixed(1) + ' ' + C1.y.toFixed(1) + ' ' + C2.x.toFixed(1) + ' ' + C2.y.toFixed(1) + ' ' + P3.x.toFixed(1) + ' ' + P3.y.toFixed(1);
        g.appendChild(s('path', { class: 'vz-line', d: d }));
        g.appendChild(s('path', { class: 'vz-head', d: V.vz.arrowHead(P3.x, P3.y, Math.atan2(P3.y - C2.y, P3.x - C2.x), 8.5) }));
        g.__st = 'default';
        edgeLayer.appendChild(g);
        (function (a, b, C1, C2) { edges.push({ el: g, at: function (t) { return cubic(a, C1, C2, b, t); } }); }(a, b, C1, C2));
      }
      var nodes = data.values.map(function (v, k) {
        var p = cellPos(data.nodeCell[k]);
        var g = cell(gA, cw - 6, ch, v, { font: 14 });
        V.place(g, { x: p.x, y: p.y });
        g.appendChild(s('circle', { class: 'a6-ptrdot', cx: (cw - 6) / 2 - 7, cy: 0, r: 2.6 }));
        g.tag = s('text', { class: 'vz-label a6-tag', x: 0, y: 0, 'text-anchor': 'middle', dy: '.35em' }, '');
        g.p = p;
        return g;
      });
      var head0 = nodes[0].p;
      var headChip = s('g', { class: 'vz-pointer is-default' });
      headChip.appendChild(s('text', { class: 'vz-ptr-label', x: head0.x - cw / 2 - 20, y: head0.y, 'text-anchor': 'end', dy: '.35em' }, 'head'));
      headChip.appendChild(s('line', { class: 'vz-ptr-stem', x1: head0.x - cw / 2 - 16, x2: head0.x - cw / 2, y1: head0.y, y2: head0.y }));
      headChip.appendChild(s('path', { class: 'vz-ptr-head', d: V.vz.arrowHead(head0.x - cw / 2 + 1, head0.y, 0, 7) }));
      gA.appendChild(headChip);
      var tokenA = s('g', { class: 'a6-token' });
      tokenA.appendChild(s('circle', { r: Math.min(cw, ch) / 2 + 5, class: 'a6-token-ring' }));
      gA.appendChild(tokenA);
      var ringA = s('rect', { class: 'a6-target', x: -cw / 2 + 1, y: -ch / 2 - 4, width: cw - 2, height: ch + 8, rx: 9 });
      gA.appendChild(ringA);
      var hopsA = label(gA, W - x0, yA, '', 'vz-caption a6-count', 'end');

      label(gB, xb, yB, narrow ? 'Array: base + k × 4' : 'Array: side by side, so element k is at base + k × 4', 'vz-caption a6-title', 'start');
      var formula = label(gB, xb, yB + 24, '', 'a6-formula', 'start');
      var cellsB = data.values.map(function (v, k) {
        var g = cell(gB, pitch - 6, ch, v, { font: 14 });
        V.place(g, { x: xb + k * pitch + pitch / 2, y: bTop + ch / 2 });
        label(gB, xb + k * pitch + pitch / 2, bTop - 10, pitch >= 54 ? A().hex(data.base + 4 * k) : '+' + (4 * k), 'vz-label a6-addr');
        label(gB, xb + k * pitch + pitch / 2, bTop + ch + 11, String(k), 'vz-label');
        return g;
      });
      var ringB = s('rect', { class: 'a6-target', x: -pitch / 2 + 1, y: -ch / 2 - 4, width: pitch - 2, height: ch + 8, rx: 9 });
      gB.appendChild(ringB);
      var ptrB = s('g', { class: 'vz-pointer is-active' });
      ptrB.appendChild(s('path', { class: 'vz-ptr-head', d: 'M0 0L-6 9Q0 7 6 9Z' }));
      ptrB.appendChild(s('text', { class: 'vz-ptr-label', y: 20, 'text-anchor': 'middle', dy: '.35em' }, 'read'));
      gB.appendChild(ptrB);
      var jumpsB = label(gB, xb + stripW, yB, '', 'vz-caption a6-count', 'end');
      var last = null;
      function bx(k) { return xb + k * pitch + pitch / 2; }
      return {
        svg: svg,
        update: function (st, ms, instant) {
          setDur(svg, ms);
          var k = st.k;
          nodes.forEach(function (g, i) {
            var state = i < st.listAt ? 'visited' : i === st.listAt ? (st.listDone ? 'found' : 'active') : 'default';
            setState(g, state);
          });
          edges.forEach(function (e, i) {
            var state = i < st.listAt - 1 ? 'visited' : i === st.listAt - 1 ? 'active' : 'default';
            setState(e.el, state);
          });
          var tp = nodes[st.listAt].p;
          var prevAt = last ? last.listAt : null;
          if (!instant && prevAt !== null && st.listAt === prevAt + 1) {
            // follow the link's curve from the previous node to this one
            var along = edges[prevAt].at;
            var st0 = tokenA.__vdsa || (tokenA.__vdsa = { x: 0, y: 0, scale: 1, rotate: 0, opacity: null, attr: {} });
            if (st0.anim) st0.anim.cancel();
            st0.anim = V.tween(V.dur(ms), function (t, ee) {
              var q = along(ee);
              st0.x = q.x; st0.y = q.y; tokenA.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ')');
            });
          } else V.animate(tokenA, { x: tp.x, y: tp.y }, { duration: instant ? 0 : ms });
          var tk = nodes[k].p;
          V.place(ringA, { x: tk.x, y: tk.y, opacity: st.listDone ? 0 : 1 });
          hopsA.textContent = st.listHops + (st.listHops === 1 ? ' hop' : ' hops');
          cellsB.forEach(function (g, i) { setState(g, st.arrayDone && i === k ? 'found' : 'default'); });
          V.place(ringB, { x: bx(k), y: bTop + ch / 2, opacity: st.arrayDone ? 0 : 1 });
          var py = bTop + ch + 22;
          if (!instant && last && !last.arrayDone && st.arrayDone && k !== 0) arcTo(ptrB, bx(0), py, bx(k), py, 46, ms);
          else V.animate(ptrB, { x: bx(st.arrayAt), y: py }, { duration: instant ? 0 : ms });
          formula.textContent = st.arrayDone ? A().hex(data.base) + ' + ' + k + ' × 4 = ' + A().hex(data.base + 4 * k) + '  →  one jump' : 'where is element ' + k + '?';
          jumpsB.textContent = st.arrayJumps + (st.arrayJumps === 1 ? ' calculation' : ' calculations');
          last = st;
        }
      };
    });
  }

  /* ================================================================== 2. bookshelf analogy */
  /* state: {shelves: [{id, cap, row, wall?}], books: [{id, label, shelf, slot, lifted?, state}], ruler: {shelf, to}|null} */
  function shelfView(stage) {
    var W = 600, BW = 52, BH = 74, SLOT = 58, X0 = 40, ROWY = [170, 286], H = 318;
    var svg = svgRoot(W, H, 'A bookshelf: books of equal width packed side by side', 'a6-shelf');
    svg.style.maxWidth = '600px';
    var shelfLayer = s('g'), bookLayer = s('g'), top = s('g');
    svg.appendChild(shelfLayer); svg.appendChild(bookLayer); svg.appendChild(top);
    var shelves = {}, books = {};
    var ruler = s('g', { class: 'a6-ruler' });
    var rulerLine = s('line', { x1: 0, y1: 0, x2: 0, y2: 0 });
    var rulerText = s('text', { 'text-anchor': 'middle', dy: '.35em' }, '');
    ruler.appendChild(rulerLine); ruler.appendChild(rulerText);
    top.appendChild(ruler);
    function slotX(slot) { return X0 + slot * SLOT + SLOT / 2; }
    function makeShelf(sh) {
      var g = s('g', { class: 'a6-shelfg' });
      var len = sh.cap * SLOT + 12;
      g.appendChild(s('rect', { class: 'a6-plank', x: X0 - 6, y: 0, width: len, height: 9, rx: 3 }));
      for (var k = 0; k <= sh.cap; k++) g.appendChild(s('line', { class: 'a6-tick', x1: X0 + k * SLOT, x2: X0 + k * SLOT, y1: 11, y2: 17 }));
      for (k = 0; k < sh.cap; k++) g.appendChild(s('text', { class: 'vz-label', x: slotX(k), y: 27, 'text-anchor': 'middle', dy: '.35em' }, String(k)));
      g.wall = s('g', { class: 'a6-wall' });
      g.wall.appendChild(s('rect', { x: X0 + len - 4, y: -BH - 14, width: 12, height: BH + 26, rx: 2 }));
      g.appendChild(g.wall);
      shelfLayer.appendChild(g);
      V.place(g, { y: ROWY[sh.row], opacity: 0 });
      return g;
    }
    function makeBook(b) {
      var g = cell(bookLayer, BW, BH, b.label, { rx: 5, font: 18, cls: 'a6-book' });
      g.appendChild(s('line', { class: 'a6-spine', x1: -BW / 2 + 6, x2: BW / 2 - 6, y1: -BH / 2 + 12, y2: -BH / 2 + 12 }));
      g.appendChild(s('line', { class: 'a6-spine', x1: -BW / 2 + 6, x2: BW / 2 - 6, y1: BH / 2 - 12, y2: BH / 2 - 12 }));
      return g;
    }
    return {
      svg: svg,
      render: function (st, ctx) {
        var ms = ctx && !ctx.instant ? ctx.duration : 0;
        setDur(svg, ms);
        var seen = {};
        st.shelves.forEach(function (sh) {
          seen[sh.id] = true;
          var g = shelves[sh.id] || (shelves[sh.id] = makeShelf(sh));
          V.animate(g, { y: ROWY[sh.row], opacity: sh.gone ? 0 : 1 }, { duration: ms });
          g.wall.style.display = sh.wall ? '' : 'none';
        });
        Object.keys(shelves).forEach(function (id) { if (!seen[id]) V.animate(shelves[id], { opacity: 0 }, { duration: ms }); });
        var bseen = {};
        var moving = st.books.filter(function (b) { var g = books[b.id]; return g && g.__slot !== undefined && (g.__slot !== b.slot || g.__shelf !== b.shelf); });
        st.books.forEach(function (b) {
          bseen[b.id] = true;
          var isNew = !books[b.id];
          var g = books[b.id] || (books[b.id] = makeBook(b));
          setState(g, b.state || 'default');
          var sh = st.shelves.filter(function (x) { return x.id === b.shelf; })[0];
          var y = ROWY[sh.row] - BH / 2 - 1 - (b.lifted ? BH + 12 : 0);
          var x = slotX(b.slot);
          // stagger: the rightmost mover goes first so no book walks through another
          var order = moving.map(function (m) { return m.slot; }).sort(function (p, q) { return q - p; }).indexOf(b.slot);
          var delay = !ms || order < 0 ? 0 : order * ms * 0.18;
          if (isNew) { V.place(g, { x: x, y: y - 30, opacity: 0 }); V.animate(g, { y: y, opacity: 1 }, { duration: ms }); }
          else V.animate(g, { x: x, y: y, opacity: 1 }, { duration: ms ? ms * 0.8 : 0, delay: delay });
          g.__slot = b.slot; g.__shelf = b.shelf;
        });
        Object.keys(books).forEach(function (id) { if (!bseen[id]) { V.animate(books[id], { opacity: 0 }, { duration: ms }); } });
        if (st.ruler) {
          var shr = st.shelves.filter(function (x) { return x.id === st.ruler.shelf; })[0];
          var ry = ROWY[shr.row] + 44;
          rulerLine.setAttribute('x1', X0); rulerLine.setAttribute('y1', ry); rulerLine.setAttribute('y2', ry);
          V.animate(rulerLine, { attr: { x2: X0 + st.ruler.to * SLOT } }, { duration: ms });
          rulerText.setAttribute('x', X0 + st.ruler.to * SLOT / 2); rulerText.setAttribute('y', ry + 13);
          rulerText.textContent = st.ruler.to + ' × book width';
          V.animate(ruler, { opacity: 1 }, { duration: ms });
        } else V.animate(ruler, { opacity: 0 }, { duration: ms });
      }
    };
  }

  /* ================================================================== 3. address calculator */
  /* Interactive: {setSize(bytes), select(i), onSelect(fn)}. 32 bytes from base 0x1000; elements of 2, 4 or 8 bytes. */
  function addressView(stage, opts) {
    opts = opts || {};
    var BASE = A().BASE, TOTAL = 32;
    var VALUES = [7, 42, 13, 5, 99, 21, 64, 8, 30, 17, 3, 56, 11, 72, 26, 90];
    var size = opts.size || 4, index = opts.index === undefined ? 5 : opts.index, walkTimer = null, listeners = [];
    var R = responsive(stage, function (W) {
      var per = 32, rowsN = 1, pad = 6;
      var bw = Math.max(8, Math.min(34, Math.floor((W - 2 * pad) / per))), stripW = bw * per, x0 = Math.round((W - stripW) / 2);
      var narrowA = W < 600;
      var ch = 42, rowH = ch + 64, top = 100, H = top + rowsN * rowH + 40;
      var svg = svgRoot(W, H, 'Memory strip of 32 bytes starting at ' + A().hex(BASE) + ', divided into array elements');
      var fLayer = s('g'), rowsLayer = s('g'), elLayer = s('g'), fx = s('g');
      svg.appendChild(fLayer); svg.appendChild(rowsLayer); svg.appendChild(elLayer); svg.appendChild(fx);
      function bytePos(b) { var r = Math.floor(b / per), k = b % per; return { x: x0 + k * bw, y: top + r * rowH }; }
      for (var r = 0; r < rowsN; r++) {
        var y = top + r * rowH;
        for (var b = 0; b < per; b++) rowsLayer.appendChild(s('rect', { class: 'a6-byte', x: x0 + b * bw, y: y + ch + 4, width: bw - 1, height: 5, rx: 1 }));
        label(rowsLayer, x0 - 4, y + ch + 16, 'bytes', 'vz-label a6-mini', 'end').style.display = 'none';
      }
      // formula line
      var f = s('text', { class: 'a6-formula' + (W < 420 ? '' : ' a6-formula--big'), x: W / 2, y: 22, 'text-anchor': 'middle', dy: '.35em' });
      fLayer.appendChild(f);
      var fParts = ['a6-f0', 'a6-f1', 'a6-f2', 'a6-f3'].map(function (c) { var t = s('tspan', { class: c }); f.appendChild(t); return t; });
      var stat = s('text', { class: 'vz-caption a6-count', x: W / 2, y: H - 14, 'text-anchor': 'middle', dy: '.35em' });
      fLayer.appendChild(stat);
      var els = {};
      var arc = s('path', { class: 'a6-jump' }), arcHead = s('path', { class: 'a6-jump-head' });
      var jumper = s('circle', { class: 'a6-jumper', r: 6 });
      var walker = s('g', { class: 'a6-walker' });
      walker.appendChild(s('circle', { r: 5 }));
      var walkText = s('text', { class: 'vz-label a6-walktext', x: 0, y: 16, 'text-anchor': 'middle', dy: '.35em' }, '');
      walker.appendChild(walkText);
      fx.appendChild(arc); fx.appendChild(arcHead); fx.appendChild(walker); fx.appendChild(jumper);
      function elBox(k, sz) { var p = bytePos(k * sz); return { x: p.x, y: p.y, w: sz * bw, cx: p.x + sz * bw / 2 }; }
      function ensure(k) {
        if (els[k]) return els[k];
        var g = s('g', { class: 'vz-item is-default a6-elem', 'data-k': k });
        g.__st = 'default';
        g.rect = s('rect', { class: 'vz-shape', x: 0, y: 0, width: 10, height: ch, rx: 6 });
        g.sep = s('g', { class: 'a6-sep' });
        g.txt = s('text', { class: 'vz-ink vz-value', y: ch / 2, 'text-anchor': 'middle', dy: '.35em', 'font-size': 15 }, String(VALUES[k]));
        g.addr = s('text', { class: 'vz-label a6-addr', y: -10, 'text-anchor': 'middle', dy: '.35em' }, '');
        g.idx = s('text', { class: 'vz-label a6-idx', y: ch + 22, 'text-anchor': 'middle', dy: '.35em' }, 'a[' + k + ']');
        [g.rect, g.sep, g.txt, g.addr, g.idx].forEach(function (x) { g.appendChild(x); });
        g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
        g.classList.add('is-clickable');
        g.addEventListener('click', function () { select(k); });
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(k); } });
        elLayer.appendChild(g);
        V.place(g, { opacity: 0 });
        els[k] = g;
        return g;
      }
      function layout(ms) {
        var count = TOTAL / size;
        Object.keys(els).forEach(function (k) { if (+k >= count) V.animate(els[k], { opacity: 0 }, { duration: ms }).then(function () { if (+k >= TOTAL / size && els[k]) els[k].style.display = 'none'; }); });
        for (var k = 0; k < count; k++) {
          var g = ensure(k), bx = elBox(k, size), w = bx.w - 3;
          g.style.display = '';
          V.animate(g, { x: bx.x + 1.5, y: bx.y, opacity: 1 }, { duration: ms });
          V.animate(g.rect, { attr: { width: w } }, { duration: ms });
          g.txt.setAttribute('x', w / 2); g.addr.setAttribute('x', w / 2); g.idx.setAttribute('x', w / 2);
          g.txt.setAttribute('font-size', w < 24 ? 10.5 : w < 34 ? 12 : 15);
          g.addr.textContent = w >= 44 ? A().hex(BASE + k * size) : w >= 26 ? '+' + (k * size) : '';
          g.idx.textContent = w >= 30 ? 'a[' + k + ']' : String(k);
          V.clear(g.sep);
          for (var q = 1; q < size; q++) g.sep.appendChild(s('line', { x1: q * bw, x2: q * bw, y1: 6, y2: ch - 6 }));
          g.setAttribute('aria-label', 'a[' + k + '] = ' + VALUES[k] + ' at address ' + A().hex(BASE + k * size));
        }
      }
      function show(ms, instant) {
        setDur(svg, ms);
        layout(instant ? 0 : ms);
        var count = TOTAL / size;
        if (index > count - 1) index = count - 1;
        Object.keys(els).forEach(function (k) { setState(els[k], +k === index ? 'found' : (+k === 0 ? 'visited' : 'default')); });
        var addr = BASE + index * size;
        fParts[0].textContent = 'a[' + index + ']  =  ';
        fParts[1].textContent = A().hex(BASE) + ' + ';
        fParts[2].textContent = index + ' × ' + size;
        fParts[3].textContent = '  =  ' + A().hex(addr);
        fParts.forEach(function (t, i) { t.style.opacity = instant ? 1 : 0; });
        if (!instant) fParts.forEach(function (t, i) { setTimeout(function () { t.style.opacity = 1; }, V.dur(120 + i * 170)); });
        // jump arc from a[0] to a[index]
        var a0 = elBox(0, size), ai = elBox(index, size);
        var sx = a0.cx, sy = a0.y - 24, ex = ai.cx, ey = ai.y - 24;
        var lift = Math.min(34, 14 + Math.abs(ex - sx) * 0.08 + Math.abs(ey - sy) * 0.2);
        var mx = (sx + ex) / 2, my = Math.min(sy, ey) - lift;
        var d = index === 0 ? '' : 'M' + sx + ' ' + sy + ' Q' + mx + ' ' + my + ' ' + ex + ' ' + (ey - 4);
        arc.setAttribute('d', d);
        arcHead.setAttribute('d', index === 0 ? '' : V.vz.arrowHead(ex, ey - 2, Math.atan2(ey - my, ex - mx), 9));
        var total = arc.getTotalLength ? (d ? arc.getTotalLength() : 0) : 0;
        if (!instant && total) {
          arc.style.strokeDasharray = total + ' ' + total;
          V.tween(V.dur(Math.max(420, ms)), function (t, e) { arc.style.strokeDashoffset = String(total * (1 - e)); }, { ease: 'out' });
          arcTo(jumper, sx, sy, ex, ey - 4, (sy + ey) / 2 - my, Math.max(420, ms), { ease: 'out' });
        } else { arc.style.strokeDasharray = ''; arc.style.strokeDashoffset = '0'; V.place(jumper, { x: ex, y: ey - 4 }); }
        // the walker takes one element per tick: the slow way
        if (walkTimer) { clearInterval(walkTimer); walkTimer = null; }
        var wy = a0.y + ch + 40, j = 0;
        function wpos(k) { var b = elBox(k, size); return { x: b.cx, y: b.y + ch + 40 }; }
        V.place(walker, { x: wpos(0).x, y: wpos(0).y });
        walkText.textContent = 'walking: 0 steps';
        stat.textContent = narrowA ? 'formula: 1 calculation · walking: ' + index + (index === 1 ? ' step' : ' steps') : 'address formula: 1 calculation, whatever the index  ·  walking from a[0]: ' + index + (index === 1 ? ' step' : ' steps');
        if (instant || V.reducedMotion()) { var p = wpos(index); V.place(walker, { x: p.x, y: p.y }); walkText.textContent = 'walking: ' + index + (index === 1 ? ' step' : ' steps'); return; }
        walkTimer = setInterval(function () {
          if (j >= index) { clearInterval(walkTimer); walkTimer = null; return; }
          j++;
          var p = wpos(j);
          V.animate(walker, { x: p.x, y: p.y }, { duration: 200 });
          walkText.textContent = 'walking: ' + j + (j === 1 ? ' step' : ' steps');
        }, 300);
        void wy;
      }
      return { svg: svg, update: function (st, ms, instant) { show(ms, instant); }, destroy: function () { if (walkTimer) clearInterval(walkTimer); } };
    });
    function select(k) { index = k; R.render({ size: size, index: index }, { duration: 520 }); listeners.forEach(function (fn) { fn(index, size); }); }
    R.render({ size: size, index: index }, { instant: true });
    return {
      setSize: function (sz) { size = sz; if (index > TOTAL / size - 1) index = TOTAL / size - 1; R.render({ size: size, index: index }, { duration: 520 }); listeners.forEach(function (fn) { fn(index, size); }); },
      select: select,
      onSelect: function (fn) { listeners.push(fn); },
      get index() { return index; }, get size() { return size; }
    };
  }

  /* ================================================================== 4. cost per append: spikes vs the flat average */
  /* state: {k, costs: appendCosts(N, policy), N, yMax}. Bars appear up to k; the running average line follows. */
  function spikesView(stage) {
    return responsive(stage, function (W) {
      var H = W < 520 ? 270 : 320, ML = 40, MR = W < 520 ? 16 : 118, MT = 18, MB = 40;
      var N = 40, yMax = 42;
      var pw = W - ML - MR, ph = H - MT - MB;
      var svg = svgRoot(W, H, 'Bar chart: the cost of each append, with the running average as a line');
      var gGrid = s('g', { class: 'a6-grid' }), gBars = s('g'), gLine = s('g'), gTop = s('g');
      [gGrid, gBars, gLine, gTop].forEach(function (g) { svg.appendChild(g); });
      function X(k) { return ML + (k - 0.5) / N * pw; }
      function Y(v) { return MT + ph - v / yMax * ph; }
      [0, 10, 20, 30, 40].forEach(function (v) {
        gGrid.appendChild(s('line', { x1: ML, x2: ML + pw, y1: Y(v), y2: Y(v) }));
        label(gGrid, ML - 8, Y(v), String(v), 'vz-label', 'end');
      });
      [1, 8, 16, 24, 32, 40].forEach(function (k) { label(gGrid, X(k), H - MB + 14, String(k), 'vz-label'); });
      label(gGrid, ML + pw, H - 8, 'append number →', 'vz-caption', 'end');
      label(gGrid, ML - 30, MT - 6, 'work', 'vz-caption', 'start');
      var bw = Math.max(2, pw / N * 0.72);
      var bars = [], tags = [];
      for (var k = 1; k <= N; k++) {
        var g = s('g', { class: 'vz-item vz-bar is-default a6-cbar' });
        g.__st = 'default';
        g.rect = s('rect', { class: 'vz-shape', x: X(k) - bw / 2, y: Y(0), width: bw, height: 0, rx: Math.min(2, bw / 3) });
        g.appendChild(g.rect);
        gBars.appendChild(g);
        bars.push(g);
        var t = s('text', { class: 'a6-spiketag', x: X(k), y: Y(0), 'text-anchor': 'middle' }, '');
        gBars.appendChild(t); tags.push(t);
      }
      var three = s('g', { class: 'a6-three' });
      three.appendChild(s('line', { x1: ML, x2: ML + pw, y1: Y(3), y2: Y(3) }));
      var threeText = s('text', { x: ML + pw + 6, y: Y(3), dy: '.35em' }, W < 520 ? '' : 'charge: 3 each');
      three.appendChild(threeText);
      gLine.appendChild(three);
      var avgPath = s('path', { class: 'a6-avg' });
      gLine.appendChild(avgPath);
      var head = s('circle', { class: 'a6-avg-head', r: 4.5 });
      gLine.appendChild(head);
      var avgText = s('text', { class: 'a6-avg-text', dy: '.35em' }, '');
      gLine.appendChild(avgText);
      var cursor = s('line', { class: 'a6-cursor', y1: MT, y2: MT + ph });
      gTop.appendChild(cursor);
      var shown = 0, tw = null, lastCosts = null;
      function pathTo(costs, kk) {
        if (kk < 1) return '';
        var d = '', full = Math.floor(kk);
        for (var i = 1; i <= full; i++) d += (i === 1 ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(costs[i - 1].avg).toFixed(1);
        if (kk > full && full >= 1 && full < costs.length) {
          var f = kk - full, a = costs[full - 1].avg, b = costs[full].avg;
          d += 'L' + (X(full) + (X(full + 1) - X(full)) * f).toFixed(1) + ' ' + Y(a + (b - a) * f).toFixed(1);
        }
        return d;
      }
      function draw(costs, kk) {
        avgPath.setAttribute('d', pathTo(costs, kk));
        var full = Math.max(1, Math.min(costs.length, Math.round(kk)));
        var hx = kk < 1 ? X(1) : X(1) + (X(2) - X(1)) * (kk - 1), hv = kk < 1 ? 0 : costs[full - 1].avg;
        if (kk >= 1) {
          var fl = Math.floor(kk), fr = kk - fl;
          hv = fl < costs.length && fr > 0 ? costs[fl - 1].avg + (costs[fl].avg - costs[fl - 1].avg) * fr : costs[Math.min(fl, costs.length) - 1].avg;
        }
        head.setAttribute('cx', hx.toFixed(1)); head.setAttribute('cy', Y(Math.min(hv, yMax)).toFixed(1));
        head.style.opacity = kk >= 1 ? 1 : 0;
        avgText.setAttribute('x', (hx + 8).toFixed(1)); avgText.setAttribute('y', (Y(Math.min(hv, yMax)) - 12).toFixed(1));
        avgText.textContent = kk >= 1 ? 'average ' + hv.toFixed(2) : '';
        if (hx > ML + pw - 90) { avgText.setAttribute('text-anchor', 'end'); avgText.setAttribute('x', (hx - 8).toFixed(1)); } else avgText.setAttribute('text-anchor', 'start');
      }
      return {
        svg: svg,
        update: function (st, ms, instant) {
          setDur(svg, ms);
          var costs = st.costs, k = st.k;
          var policyChanged = lastCosts && lastCosts !== costs;
          bars.forEach(function (g, i) {
            var c = costs[i], on = i < k;
            setState(g, !on ? 'default' : c.grew && c.copies > 0 ? (i === k - 1 ? 'swap' : 'swap') : (i === k - 1 ? 'active' : 'default'));
            g.classList.toggle('is-cheap', on && !(c.grew && c.copies > 0));
            var hgt = on ? c.cost / yMax * ph : 0;
            V.animate(g.rect, { attr: { y: Y(0) - hgt, height: hgt } }, { duration: instant ? 0 : (policyChanged ? ms : (i === k - 1 || i === k ? ms : ms * 0.6)) });
            var tg = tags[i];
            var showTag = on && c.copies > 0 && (c.cost >= 5 || costs.every(function (x) { return x.copies > 0; }) === false && c.cost >= 2);
            if (costs.every(function (x, j) { return j === 0 || x.copies > 0; })) showTag = on && (i + 1) % 8 === 0;
            tg.textContent = showTag ? String(c.cost) : '';
            tg.setAttribute('y', (Y(c.cost) - 5).toFixed(1));
          });
          if (tw) tw.cancel();
          var from = policyChanged ? k : shown, to = k;
          if (instant || !ms || from === to || policyChanged) { draw(costs, to); }
          else tw = V.tween(V.dur(ms), function (t, e) { draw(costs, from + (to - from) * e); });
          shown = to; lastCosts = costs;
          var cx = k >= 1 ? X(k) : X(1);
          V.animate(cursor, { attr: { x1: cx, x2: cx } }, { duration: instant ? 0 : ms });
          cursor.style.opacity = k >= 1 ? 1 : 0;
        }
      };
    });
  }

  /* ================================================================== 5. bank account: coins on elements */
  /* state: bankSteps snapshot + {history, total, maxBalance}. Responsive: 16 slots per row on wide stages,
     8 per row (blocks wrap) on phones; the balance sparkline sits top right, or on top on phones. */
  function bankView(stage) {
    return responsive(stage, function (W) {
      var narrow = W < 640, per = narrow ? 8 : 16, pad = 8;
      var PITCH = Math.min(46, Math.floor((W - 2 * pad - 12) / per)), CW = PITCH - 5, X0 = Math.round((W - per * PITCH) / 2) + 2;
      var coinRx = Math.max(8, Math.min(13, CW * 0.32)), coinRy = coinRx * 0.4, coinStep = coinRy * 1.6;
      var ROWH = CW + 52, GAP = 22;
      var SW = narrow ? W - 2 * pad - 30 : Math.min(320, W * 0.36), SH = 64;
      var SX = narrow ? pad + 22 : W - pad - SW - 8, SY = narrow ? 34 : 20;
      var Y0 = narrow ? SY + SH + 112 : 132;
      function rowsOf(cap) { return Math.max(1, Math.ceil(cap / per)); }
      var H = Y0 + rowsOf(8) * ROWH + GAP + rowsOf(16) * ROWH - 10;
      var svg = svgRoot(W, H, 'A dynamic array with coins stacked on its elements, and the bank balance over time', 'a6-bank');
      var sparkLayer = s('g'), blockLayer = s('g'), itemLayer = s('g'), coinLayer = s('g');
      [sparkLayer, blockLayer, itemLayer, coinLayer].forEach(function (g) { svg.appendChild(g); });
      var blocks = {}, items = {}, coins = {}, curStep = null;
      function blockY(role, st) {
        if (role !== 'new') return Y0;
        var old = st.blocks.filter(function (b) { return b.role === 'old'; })[0];
        return Y0 + rowsOf(old ? old.cap : 1) * ROWH + GAP;
      }
      function slotXY(slot, y) { return { x: X0 + (slot % per) * PITCH + CW / 2, y: y + Math.floor(slot / per) * ROWH }; }
      function makeBlock(b) {
        var g = s('g', { class: 'a6-block' });
        for (var r = 0; r < Math.ceil(b.cap / per); r++) {
          var nIn = Math.min(per, b.cap - r * per);
          g.appendChild(s('rect', { class: 'a6-block-frame', x: X0 - 5, y: r * ROWH - CW / 2 - 5, width: nIn * PITCH + 5, height: CW + 10, rx: 9 }));
        }
        for (var k = 0; k < b.cap; k++) {
          var p = slotXY(k, 0);
          g.appendChild(s('rect', { class: 'vz-slot is-solid', x: p.x - CW / 2, y: p.y - CW / 2, width: CW, height: CW, rx: 6 }));
          g.appendChild(s('text', { class: 'vz-label', x: p.x, y: p.y + CW / 2 + 12, 'text-anchor': 'middle', dy: '.35em', 'font-size': PITCH < 34 ? 9 : 11 }, String(k)));
        }
        g.lbl = s('text', { class: 'vz-caption', x: X0 - 3, y: (Math.ceil(b.cap / per) - 1) * ROWH + CW / 2 + 30, dy: '.35em' }, '');
        g.appendChild(g.lbl);
        blockLayer.appendChild(g);
        V.place(g, { opacity: 0 });
        return g;
      }
      function coinEl() {
        var g = s('g', { class: 'a6-coin' });
        g.appendChild(s('ellipse', { class: 'a6-coin-edge', cx: 0, cy: coinRy * 0.55, rx: coinRx, ry: coinRy }));
        g.appendChild(s('ellipse', { class: 'a6-coin-face', cx: 0, cy: 0, rx: coinRx, ry: coinRy }));
        coinLayer.appendChild(g);
        return g;
      }
      var note = s('text', { class: 'vz-caption', x: X0 - 3, y: Y0 - CW / 2 - 96, dy: '.35em' }, '');
      if (narrow) note.setAttribute('y', 14);
      svg.appendChild(note);
      /* bank balance over time: a sawtooth that never crosses zero */
      sparkLayer.appendChild(s('rect', { class: 'a6-spark-bg', x: SX - 22, y: SY - 8, width: SW + 30, height: SH + 30, rx: 10 }));
      sparkLayer.appendChild(s('line', { class: 'a6-spark-zero', x1: SX, x2: SX + SW, y1: SY + SH, y2: SY + SH }));
      sparkLayer.appendChild(s('text', { class: 'vz-label', x: SX - 5, y: SY + SH, 'text-anchor': 'end', dy: '.35em' }, '0'));
      sparkLayer.appendChild(s('text', { class: 'vz-caption', x: SX, y: SY + SH + 12, dy: '.35em' }, 'coins in the bank, step by step'));
      var sparkPath = s('path', { class: 'a6-spark-line' }), sparkDot = s('circle', { class: 'a6-spark-dot', r: 3.5 }), sparkVal = s('text', { class: 'a6-spark-val', dy: '.35em' }, '');
      [sparkPath, sparkDot, sparkVal].forEach(function (e) { sparkLayer.appendChild(e); });
      function drawSpark(st) {
        if (!st.history) return;
        var n = Math.max(2, st.total || st.history.length), max = st.maxBalance || 12;
        var pts = st.history.map(function (b, i) { return [SX + i / (n - 1) * SW, SY + SH - b / max * SH]; });
        sparkPath.setAttribute('d', pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '));
        var last = pts[pts.length - 1];
        sparkDot.setAttribute('cx', last[0].toFixed(1)); sparkDot.setAttribute('cy', last[1].toFixed(1));
        var right = last[0] > SX + SW - 24;
        sparkVal.setAttribute('text-anchor', right ? 'end' : 'start');
        sparkVal.setAttribute('x', (last[0] + (right ? -7 : 7)).toFixed(1)); sparkVal.setAttribute('y', (last[1] - 8).toFixed(1));
        sparkVal.textContent = String(st.balance);
      }
      function update(st, ms, instant) {
        setDur(svg, ms);
        curStep = st;
        var bseen = {}, pos = {};
        st.blocks.forEach(function (b) {
          bseen[b.id] = true;
          var g = blocks[b.id] || (blocks[b.id] = makeBlock(b));
          g.lbl.textContent = (b.role === 'new' ? 'new block · capacity ' : b.role === 'old' ? 'old block · capacity ' : 'capacity ') + b.cap;
          g.style.display = b.cap ? '' : 'none';
          V.animate(g, { y: blockY(b.role, st), opacity: b.role === 'old' ? 0.7 : 1 }, { duration: ms });
        });
        Object.keys(blocks).forEach(function (id) {
          if (!bseen[id]) { var g = blocks[id]; delete blocks[id]; V.animate(g, { opacity: 0 }, { duration: ms }).then(function () { if (g.parentNode) g.parentNode.removeChild(g); }); }
        });
        var iseen = {};
        st.items.forEach(function (it) {
          iseen[it.id] = true;
          var blk = st.blocks.filter(function (b) { return b.id === it.block; })[0];
          var p = slotXY(it.slot, blockY(blk.role, st));
          pos[it.id] = p;
          var g = items[it.id];
          if (!g) {
            g = items[it.id] = cell(itemLayer, CW, CW, it.value, { font: CW < 30 ? 12 : 15 });
            var src = it.from && items[it.from] ? items[it.from].__vdsa : null;
            if (src && ms) { V.place(g, { x: src.x, y: src.y, opacity: 1 }); V.animate(g, { x: p.x, y: p.y }, { duration: ms }); }
            else { V.place(g, { x: p.x, y: p.y - (ms ? 20 : 0), opacity: ms ? 0 : 1 }); V.animate(g, { y: p.y, opacity: 1 }, { duration: ms }); }
          } else V.animate(g, { x: p.x, y: p.y, opacity: 1 }, { duration: ms });
          setState(g, it.state);
        });
        Object.keys(items).forEach(function (id) {
          if (!iseen[id]) { var g = items[id]; delete items[id]; V.animate(g, { opacity: 0 }, { duration: ms }).then(function () { if (g.parentNode) g.parentNode.removeChild(g); }); }
        });
        var cseen = {};
        st.coins.forEach(function (c) {
          cseen[c.id] = true;
          var x, y, o = 1, sc = 1;
          if (c.owner && pos[c.owner]) { x = pos[c.owner].x; y = pos[c.owner].y - CW / 2 - coinRy - 4 - c.level * coinStep; }
          else if (c.at) {
            var blk = st.blocks.filter(function (b) { return b.id === c.at.block; })[0];
            var p = slotXY(c.at.slot, blk ? blockY(blk.role, st) : Y0);
            x = p.x;
            if (c.at.lane === 'in') { var top = slotXY(c.at.slot, Y0); x = top.x; y = Y0 - CW / 2 - 58 - c.level * coinStep; }
            else { y = p.y; o = 0; sc = 0.4; }
          } else return;
          var g = coins[c.id];
          if (!g) {
            g = coins[c.id] = coinEl();
            if (c.state === 'incoming' && ms) { V.place(g, { x: x, y: y - 40, opacity: 0 }); V.animate(g, { y: y, opacity: 1 }, { duration: ms, delay: c.level * ms * 0.15, ease: 'out' }); }
            else V.place(g, { x: x, y: y, opacity: o, scale: sc });
          } else V.animate(g, { x: x, y: y, opacity: o, scale: sc }, { duration: ms, ease: c.state === 'spent' ? 'in' : 'inOut' });
        });
        Object.keys(coins).forEach(function (id) {
          if (!cseen[id]) { var g = coins[id]; delete coins[id]; V.animate(g, { opacity: 0 }, { duration: ms * 0.5 }).then(function () { if (g.parentNode) g.parentNode.removeChild(g); }); }
        });
        note.textContent = st.k ? 'append #' + st.k + '  ·  size ' + st.size + ' of ' + st.cap : 'no storage yet';
        drawSpark(st);
      }
      return { svg: svg, update: update };
    });
  }

  /* ================================================================== 6. 2D array -> row-major memory */
  /* Interactive: {setOrder('row'|'col'), select(r, c), replay()}. 3 × 4 grid of letters above a 12-cell strip. */
  function rowMajorView(stage, opts) {
    opts = opts || {};
    var ROWS = 3, COLS = 4, BASE = A().BASE, SZ = 4, LET = 'ABCDEFGHIJKL';
    var order = 'row', sel = { r: 1, c: 2 }, listeners = [], pendingFly = true;
    var R = responsive(stage, function (W) {
      var per = W >= 620 ? 12 : 6, stripRows = 12 / per, pad = 8;
      var sp = Math.min(60, Math.floor((W - 2 * pad) / per)), cw = sp - 6, gs = Math.min(52, sp);
      var gridW = gs * COLS, gx = Math.round((W - gridW) / 2) + 14, gy = 34;
      var sy = gy + ROWS * gs + 70, sx = Math.round((W - sp * per) / 2), srowH = cw + 44;
      var narrowF = W < 600;
      var H = sy + stripRows * srowH + (narrowF ? 64 : 44);
      var svg = svgRoot(W, H, 'A 3 by 4 grid and the same values laid out in one row of memory');
      var gLab = s('g'), gGrid = s('g'), gStrip = s('g'), gFx = s('g');
      [gLab, gGrid, gStrip, gFx].forEach(function (g) { svg.appendChild(g); });
      label(gLab, gx - 10, gy - 20, 'm[r][c]: what you write', 'vz-caption', 'start');
      for (var c = 0; c < COLS; c++) label(gLab, gx + c * gs + gs / 2, gy - 6, 'c=' + c, 'vz-label');
      for (var r = 0; r < ROWS; r++) label(gLab, gx - 8, gy + r * gs + gs / 2, 'r=' + r, 'vz-label', 'end');
      label(gLab, sx, sy - 34, 'memory: what the machine stores', 'vz-caption', 'start');
      function slotPos(k) { var rr = Math.floor(k / per), cc = k % per; return { x: sx + cc * sp + sp / 2, y: sy + rr * srowH + cw / 2 }; }
      for (var k = 0; k < 12; k++) {
        var p = slotPos(k);
        gStrip.appendChild(s('rect', { class: 'vz-slot', x: p.x - cw / 2, y: p.y - cw / 2, width: cw, height: cw, rx: 6 }));
        label(gStrip, p.x, p.y - cw / 2 - 9, sp >= 50 ? A().hex(BASE + k * SZ) : '+' + k * SZ, 'vz-label a6-addr');
        label(gStrip, p.x, p.y + cw / 2 + 10, String(k), 'vz-label');
      }
      var gridCells = {}, stripCells = {};
      function key(r, c) { return r + ',' + c; }
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        (function (r, c) {
          var g = cell(gGrid, gs - 6, gs - 6, LET[r * COLS + c], { font: 16 });
          V.place(g, { x: gx + c * gs + gs / 2, y: gy + r * gs + gs / 2 });
          var sc = cell(gStrip, cw, cw, LET[r * COLS + c], { font: 15 });
          [g, sc].forEach(function (el) {
            el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); el.classList.add('is-clickable');
            el.setAttribute('aria-label', 'm[' + r + '][' + c + '] = ' + LET[r * COLS + c]);
            el.addEventListener('click', function () { select(r, c); });
            el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(r, c); } });
          });
          gridCells[key(r, c)] = g; stripCells[key(r, c)] = sc;
        }(r, c));
      }
      var rowBand = s('rect', { class: 'a6-band', rx: 8 });
      gGrid.insertBefore(rowBand, gGrid.firstChild);
      var link = s('path', { class: 'a6-link-line' });
      gFx.appendChild(link);
      var formula = s('text', { class: 'a6-formula', x: W / 2, y: H - (narrowF ? 40 : 18), 'text-anchor': 'middle', dy: '.35em' });
      var formula2 = s('text', { class: 'a6-formula', x: W / 2, y: H - 16, 'text-anchor': 'middle', dy: '.35em' });
      gFx.appendChild(formula); gFx.appendChild(formula2);
      function idxOf(r, c) { return order === 'row' ? A().rowMajorIndex(r, c, ROWS, COLS) : A().colMajorIndex(r, c, ROWS, COLS); }
      function update(st, ms, instant) {
        setDur(svg, ms);
        var fly = st.fly && !instant && !V.reducedMotion();
        Object.keys(stripCells).forEach(function (kk) {
          var rc = kk.split(',').map(Number), p = slotPos(idxOf(rc[0], rc[1])), el = stripCells[kk];
          if (fly) {
            var gp = gridCells[kk].__vdsa, delay = idxOf(rc[0], rc[1]) * 110;
            V.place(el, { x: gp.x, y: gp.y, opacity: 0 });
            V.animate(el, { x: p.x, y: p.y, opacity: 1 }, { duration: 620, delay: delay });
          } else V.animate(el, { x: p.x, y: p.y, opacity: 1 }, { duration: instant ? 0 : ms });
          var on = rc[0] === sel.r && rc[1] === sel.c;
          var inLine = order === 'row' ? rc[0] === sel.r : rc[1] === sel.c;
          setState(el, on ? 'active' : inLine ? 'visited' : 'default');
          setState(gridCells[kk], on ? 'active' : inLine ? 'visited' : 'default');
        });
        // band over the selected row (row-major) or column (column-major)
        if (order === 'row') { rowBand.setAttribute('x', gx - 2); rowBand.setAttribute('y', gy + sel.r * gs); rowBand.setAttribute('width', gridW + 4); rowBand.setAttribute('height', gs); }
        else { rowBand.setAttribute('x', gx + sel.c * gs); rowBand.setAttribute('y', gy - 2); rowBand.setAttribute('width', gs); rowBand.setAttribute('height', ROWS * gs + 4); }
        var i = idxOf(sel.r, sel.c), g0 = { x: gx + sel.c * gs + gs / 2, y: gy + sel.r * gs + gs - 2 }, p = slotPos(i);
        link.setAttribute('d', 'M' + g0.x + ' ' + g0.y + ' C' + g0.x + ' ' + (g0.y + 40) + ' ' + p.x + ' ' + (p.y - cw / 2 - 60) + ' ' + p.x + ' ' + (p.y - cw / 2 - 18));
        link.style.opacity = fly ? 0 : 1;
        if (fly) setTimeout(function () { link.style.opacity = 1; }, 12 * 110 + 500);
        var part1 = 'm[' + sel.r + '][' + sel.c + ']  →  index ' + (order === 'row' ? sel.r + ' × 4 + ' + sel.c : sel.c + ' × 3 + ' + sel.r) + ' = ' + i;
        var part2 = 'address ' + A().hex(BASE) + ' + ' + i + ' × 4 = ' + A().hex(BASE + i * SZ);
        if (narrowF) { formula.textContent = part1; formula2.textContent = '→  ' + part2; }
        else { formula.textContent = part1 + '  →  ' + part2; formula2.textContent = ''; }
      }
      return { svg: svg, update: update };
    });
    function emit() { listeners.forEach(function (fn) { fn(sel, order); }); }
    function select(r, c) { sel = { r: r, c: c }; R.render({ fly: false }, { duration: 420 }); emit(); }
    R.render({ fly: false }, { instant: true });
    return {
      setOrder: function (o) { order = o; R.render({ fly: true }, { duration: 500 }); emit(); },
      select: select,
      replay: function () { R.render({ fly: true }, { duration: 500 }); },
      onSelect: function (fn) { listeners.push(fn); },
      get order() { return order; }, get selected() { return sel; }
    };
  }

  /* ================================================================== 7. cache lines: row walk vs column walk */
  /* state: {row: cacheWalk step, col: cacheWalk step}. 4 × 4 ints, 4 per 16-byte line, a 2-line cache. */
  function cacheView(stage) {
    var ROWS = 4, COLS = 4, LINE = 4;
    return responsive(stage, function (W) {
      var narrow = W < 600, per = narrow ? 8 : 16, pad = 6;
      var mg = narrow ? 15 : 17, gridW = mg * COLS;
      var stripX = narrow ? pad : pad + gridW + 28;
      var sp = Math.min(40, Math.floor((W - stripX - pad) / per)), cw = sp - 4;
      var laneH = (narrow ? Math.max(gridW + 18, (16 / per) * (cw + 30)) + (narrow ? gridW + 10 : 0) : Math.max(gridW + 24, cw + 60)) + 30;
      var H = laneH * 2 + 10;
      var svg = svgRoot(W, H, 'Two walks over the same 4 by 4 array: row by row and column by column, with cache lines');
      var lanes = ['row', 'col'].map(function (kind, li) {
        var g = s('g');
        svg.appendChild(g);
        var top = li * laneH + 8;
        label(g, pad, top + 6, narrow ? (kind === 'row' ? 'Row by row' : 'Column by column') : (kind === 'row' ? 'Walk row by row: m[0][0], m[0][1], m[0][2] …' : 'Walk column by column: m[0][0], m[1][0], m[2][0] …'), 'vz-caption', 'start');
        var gx = pad, gy = top + 24;
        var stripTop = narrow ? gy + gridW + 20 : gy + 12;
        var mini = {};
        for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
          var m = s('rect', { class: 'a6-minicell', x: gx + c * mg, y: gy + r * mg, width: mg - 2, height: mg - 2, rx: 2 });
          g.appendChild(m); mini[r + ',' + c] = m;
        }
        function slot(k) { var rr = Math.floor(k / per), cc = k % per; return { x: stripX + cc * sp + sp / 2, y: stripTop + rr * (cw + 30) + cw / 2 }; }
        var lines = [];
        for (var L = 0; L < 16 / LINE; L++) {
          var p0 = slot(L * LINE), bx = p0.x - sp / 2 + 1;
          var box = s('rect', { class: 'a6-line', x: bx, y: p0.y - cw / 2 - 5, width: LINE * sp - 2, height: cw + 10, rx: 8 });
          g.appendChild(box);
          var lt = s('text', { class: 'vz-label a6-linelabel', x: bx + LINE * sp / 2, y: p0.y + cw / 2 + 13, 'text-anchor': 'middle', dy: '.35em' }, 'line ' + L);
          g.appendChild(lt);
          lines.push(box);
        }
        var cells = [];
        for (var k = 0; k < 16; k++) {
          var el = cell(g, cw, cw, String(k), { font: 11 });
          var pk = slot(k);
          V.place(el, { x: pk.x, y: pk.y });
          cells.push(el);
        }
        var ptr = s('g', { class: 'vz-pointer is-active' });
        ptr.appendChild(s('path', { class: 'vz-ptr-head', d: 'M0 0L-5.5 -8Q0 -6.4 5.5 -8Z' }));
        g.appendChild(ptr);
        var count = label(g, W - pad, top + 6, '', 'vz-caption a6-count', 'end');
        return { kind: kind, mini: mini, lines: lines, cells: cells, ptr: ptr, count: count, slot: slot, cw: cw };
      });
      return {
        svg: svg,
        update: function (st, ms, instant) {
          setDur(svg, ms);
          lanes.forEach(function (ln) {
            var w = st[ln.kind], visited = w.visitedSet || {};
            ln.cells.forEach(function (el, k) { setState(el, k === w.index ? (w.hit ? 'done' : 'swap') : visited[k] ? 'visited' : 'default'); });
            ln.lines.forEach(function (box, L) {
              box.classList.toggle('is-cached', w.cache.indexOf(L) !== -1);
              box.classList.toggle('is-loading', w.line === L && w.hit === false);
            });
            Object.keys(ln.mini).forEach(function (kk) {
              var rc = kk.split(',').map(Number), idx = rc[0] * 4 + rc[1];
              ln.mini[kk].setAttribute('class', 'a6-minicell' + (idx === w.index ? ' is-now' : visited[idx] ? ' is-seen' : ''));
            });
            if (w.index === null) V.animate(ln.ptr, { opacity: 0 }, { duration: 0 });
            else { var p = ln.slot(w.index); V.animate(ln.ptr, { x: p.x, y: p.y - ln.cw / 2 - 7, opacity: 1 }, { duration: instant ? 0 : ms }); }
            ln.count.textContent = w.misses + (w.misses === 1 ? ' line load' : ' line loads') + ' · ' + w.hits + (w.hits === 1 ? ' hit' : ' hits');
          });
        }
      };
    });
  }

  /* ================================================================== small static pictures */
  /* cellStrip(values, opts) -> <svg>: a row of cells. opts: {states, size, gap, addrs, idx, ids, label, tags: [{at, text}], ghostFrom} */
  function cellStrip(values, o) {
    o = o || {};
    var C = o.size || 34, P = C + (o.gap === undefined ? 6 : o.gap), PAD = 6, TOP = (o.addrs ? 18 : 4) + (o.tags ? 26 : 0);
    var n = o.length || values.length;
    var W = PAD * 2 + n * P - (P - C), H = TOP + C + (o.idx ? 20 : 6);
    var svg = svgRoot(W, H, o.label || ('Values ' + values.join(', ')));
    svg.style.maxWidth = (W * (o.scale || 1.3)) + 'px';
    for (var k = 0; k < n; k++) {
      var x = PAD + k * P + C / 2, y = TOP + C / 2;
      if (k >= values.length || values[k] === null) {
        svg.appendChild(s('rect', { class: 'vz-slot' + (o.solid ? ' is-solid' : ''), x: x - C / 2, y: y - C / 2, width: C, height: C, rx: 6 }));
      } else {
        var g = cell(svg, C, C, values[k], { font: Math.round(C * 0.42) });
        setState(g, (o.states && o.states[k]) || 'default');
        V.place(g, { x: x, y: y });
        if (o.ids) { g.setAttribute('data-id', o.ids[k]); g.setAttribute('data-label', o.idLabel ? o.idLabel(k) : 'cell ' + k); }
      }
      if (o.addrs) label(svg, x, TOP - 9, o.addrs[k], 'vz-label a6-addr');
      if (o.idx) label(svg, x, TOP + C + 10, o.idx === true ? String(k) : o.idx[k], 'vz-label');
    }
    (o.tags || []).forEach(function (t) {
      var x = PAD + t.at * P + C / 2;
      var w = Math.max(34, t.text.length * 7 + 14);
      var tg = s('g', { class: 'vz-pointer is-' + (t.state || 'active') });
      tg.appendChild(s('rect', { class: 'vz-ptr-chip', x: x - w / 2, y: 2, width: w, height: 18, rx: 9 }));
      tg.appendChild(s('text', { class: 'vz-ptr-chip-text', x: x, y: 11, 'text-anchor': 'middle', dy: '.35em' }, t.text));
      svg.appendChild(tg);
    });
    return svg;
  }
  /* miniSvg(w, h, label, draw(svg)) -> <svg> for summary tiles and small diagrams */
  function miniSvg(w, h, lbl, draw) { var svg = svgRoot(w, h, lbl); draw(svg, { cell: cell, label: label, s: s, setState: setState, place: V.place }); return svg; }

  V.a6 = {
    responsive: responsive, raceView: raceView, shelfView: shelfView, addressView: addressView, spikesView: spikesView,
    bankView: bankView, rowMajorView: rowMajorView, cacheView: cacheView, cellStrip: cellStrip, miniSvg: miniSvg,
    cell: cell, setState: setState, label: label, svgRoot: svgRoot
  };
}());
