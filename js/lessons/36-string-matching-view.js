/* Lesson 36: the string-matching view and small helpers, shared by every figure of the lesson.

     SM.view(container, options)   -> {render(state, {duration}), prepare(steps), reset(), refresh(), el, destroy}
         draws a text row, a pattern row that glides to any alignment, an optional table row (failure table, Z-array),
         the compared pair (a link with = or ≠), pointers, bands (windows, the Z-box), a ghost of the previous
         alignment and arrows (a failure-table jump). It reads the snapshots of js/algos/36-string-matching.js.
     SM.tile(state, options)       -> element: a small static picture (summary card, variations)
     SM.strInputs(el, config)      -> two text fields (text, pattern) + presets, validated
     SM.whenNear(el, fn)           run fn once when el comes within ~700px of the viewport
     SM.hashStrip(el)              -> {render(hash)}: the Rabin–Karp rolling-hash strip
   Colours come from the shared --st-* tokens through the state classes in css/lessons/36-string-matching.css. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var SM = V.lessons = V.lessons || {};
  SM = V.lessons.l36 = V.lessons.l36 || {};

  /* ------------------------------------------------------------------ lazy init */
  SM.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 36] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  /* the states every match figure uses, for legends */
  var LEG = {
    found: { state: 'found', label: 'Characters agree', color: 'color-mix(in srgb, var(--st-found) 32%, var(--bg-elev))' },
    error: { state: 'error', label: 'Mismatch', color: 'color-mix(in srgb, var(--st-error) 32%, var(--bg-elev))' },
    done: { state: 'done', label: 'Confirmed occurrence' },
    pattern: { state: 'active', shape: 'outline', label: 'Pattern' }
  };
  SM.LEG = LEG;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function n2(v) { return Math.round(v * 100) / 100; }

  /* ================================================================== the view */
  var DEFAULTS = {
    cell: 40, minCell: 17, letters: true, indices: true, labels: true, link: true,
    textLabel: 'text', patLabel: 'pattern', label: 'String matching figure', width: 0, ids: false, gapY: 30
  };

  SM.view = function (container, options) {
    var o = Object.assign({}, DEFAULTS, options || {});
    container = V.$(container);
    var wrap = h('div', { class: 'sm-wrap' });
    container.appendChild(wrap);
    var svg = s('svg', { class: 'sm-svg', role: 'img', 'aria-label': o.label });
    wrap.appendChild(svg);
    var desc = s('desc'); svg.appendChild(desc);
    var L = {};
    ['bands', 'labels', 'ghost', 'links', 'cells', 'arrows', 'pointers'].forEach(function (name) { L[name] = s('g', { class: 'sm-layer sm-layer--' + name }); svg.appendChild(L[name]); });

    var built = { text: null, pat: null, tlen: -1 };
    var T = [], P = [], B = [], TI = [], PI = [];        // text cells, pattern cells, table cells, index labels
    var link = null, ghost = null, rowLabels = {}, bandEls = [], ptrEls = {}, arrowEls = [], emptyEl = null;
    var res = { N: 0, ptrText: false, ptrPat: false, table: false, bands: false, tt: false, patIdx: false };
    var G = null, sig = '', last = null, lastOffset = 0, lastTable = null, lastPulse = null, destroyed = false;

    /* ---------------- reservations (stable height) */
    function scan(st) {
      if (!st) return;
      var n = st.text.length, m = st.pat ? st.pat.length : 0;
      res.N = Math.max(res.N, n, st.clip ? 0 : (st.pat && st.offset !== null ? st.offset + m : 0));
      (st.pointers || []).forEach(function (p) { if (p.row === 'text') res.ptrText = true; else res.ptrPat = true; });
      if (st.table) res.table = true;
      if ((st.bands || []).length) res.bands = true;
      (st.arrows || []).forEach(function (a) { if (a.from.row === 'table' && a.to.row === 'table') res.tt = true; });
      if (st.pat && (st.pointers || []).some(function (p) { return p.row === 'pat'; })) res.patIdx = true;
    }
    function prepare(steps) { (steps || []).forEach(scan); if (last) { sig = ''; draw(last, 0); } }
    function reset() {
      res = { N: 0, ptrText: false, ptrPat: false, table: false, bands: false, tt: false, patIdx: false };
      clearAll(); built = { text: null, pat: null, tlen: -1 }; last = null; sig = '';
    }
    function clearAll() {
      [].concat(T, P, B).forEach(function (r) { if (r.g.parentNode) r.g.parentNode.removeChild(r.g); });
      TI.concat(PI).forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
      T = []; P = []; B = []; TI = []; PI = [];
    }

    /* ---------------- building cells */
    function makeCell(layer, cls) {
      var g = s('g', { class: 'sm-cell ' + cls + ' is-default' });
      var rect = s('rect', { class: 'sm-face' });
      var txt = s('text', { class: 'sm-ch', 'text-anchor': 'middle', dy: '.35em' });
      g.appendChild(rect); g.appendChild(txt);
      layer.appendChild(g);
      return { g: g, rect: rect, txt: txt, state: 'default', x: null };
    }
    function setState(rec, st) {
      st = st || 'default';
      if (rec.state !== st) { rec.g.classList.remove('is-' + rec.state); rec.g.classList.add('is-' + st); rec.state = st; }
    }
    function ensure(st) {
      var pat = st.pat;
      if (built.text !== st.text || (pat !== null && pat !== built.pat)) {
        clearAll();
        built.text = st.text; built.pat = pat !== null ? pat : built.pat;
        var i;
        for (i = 0; i < st.text.length; i++) {
          var c = makeCell(L.cells, 'sm-cell--t'); c.txt.textContent = st.text[i];
          if (o.ids) c.g.setAttribute('data-id', 't' + i);
          T.push(c);
          var idx = s('text', { class: 'sm-idx', 'text-anchor': 'middle' }); idx.textContent = i; L.labels.appendChild(idx); TI.push(idx);
        }
        if (built.pat) for (i = 0; i < built.pat.length; i++) {
          var pc = makeCell(L.cells, 'sm-cell--p'); pc.txt.textContent = built.pat[i];
          if (o.ids) pc.g.setAttribute('data-id', 'p' + i);
          P.push(pc);
          var pidx = s('text', { class: 'sm-idx sm-idx--p', 'text-anchor': 'middle' }); pidx.textContent = i; L.labels.appendChild(pidx); PI.push(pidx);
        }
        sig = '';
      }
      var tl = st.table ? st.table.values.length : -1;
      if (st.table && (tl !== built.tlen || !B.length)) {
        B.forEach(function (r) { if (r.g.parentNode) r.g.parentNode.removeChild(r.g); }); B = [];
        for (var k = 0; k < tl; k++) B.push(makeCell(L.cells, 'sm-cell--b'));
        built.tlen = tl; sig = '';
      }
      if (!st.table && B.length) { /* hidden below */ }
    }

    /* ---------------- geometry */
    function measure() { return o.width || wrap.clientWidth || container.clientWidth || 600; }
    function geometry(st) {
      var W = measure();
      var N = Math.max(res.N, st.text.length, 1);
      var labelW = o.labels ? (W >= 560 ? 62 : (Math.max(shortLabel(o.textLabel).length, shortLabel(o.patLabel).length) >= 6 ? 40 : 34)) : 0;
      var pad = W >= 560 ? 10 : 6;
      var pitch = clamp((W - 2 * pad - labelW) / N, o.minCell, o.cell);
      var gap = pitch > 30 ? 4 : 2;
      var ch = Math.min(Math.round(pitch - gap), o.cell);
      var svgW = Math.max(W, Math.ceil(labelW + 2 * pad + N * pitch));
      var y = 6, g = { W: W, N: N, labelW: labelW, pad: pad, pitch: pitch, gap: gap, cw: pitch - gap, ch: ch, svgW: svgW };
      g.offX = Math.max(pad, Math.floor((svgW - labelW - N * pitch) / 2));
      g.font = clamp(Math.round(ch * 0.52), 10, 20);
      if (res.bands) y += 16;
      g.ptrTop = y + 1;
      if (res.ptrText) y += 30;
      if (o.indices) y += 14;
      g.y0 = y; y += ch;
      y += (res.tt ? o.gapY : o.gapY);
      g.y1 = y; y += ch;
      if (res.ptrPat) { g.idxPatY = y + 11; g.ptrPatY = g.y1 + ch + 22; y += 13 + 30; }
      if (res.table) { y += 12; g.y2 = y; g.th = Math.round(ch * 0.82); y += g.th; }
      if (res.tt) y += 30;
      g.height = y + 8;
      return g;
    }
    function xText(i) { return G.offX + G.labelW + i * G.pitch; }
    function xPat(j, off) { return G.offX + G.labelW + (off + j) * G.pitch; }
    function xTable(i, st, off) { return st.table.under === 'pat' ? xPat(i, off) : xText(i); }

    function layout(st) {
      G = geometry(st);
      var key = [G.W, G.N, G.offX, G.pitch, G.y0, G.y1, G.y2, G.height, T.length, P.length, B.length, o.letters].join('|');
      if (key === sig) return false;
      sig = key;
      svg.setAttribute('width', G.svgW); svg.setAttribute('height', G.height);
      svg.setAttribute('viewBox', '0 0 ' + G.svgW + ' ' + G.height);
      var showLetters = o.letters && G.cw >= 14;
      function size(rec, hgt) {
        rec.rect.setAttribute('width', n2(G.cw)); rec.rect.setAttribute('height', hgt); rec.rect.setAttribute('rx', n2(Math.min(8, hgt * 0.2)));
        rec.txt.setAttribute('x', n2(G.cw / 2)); rec.txt.setAttribute('y', n2(hgt / 2));
        rec.txt.style.fontSize = G.font + 'px'; rec.txt.style.display = showLetters ? '' : 'none';
      }
      T.forEach(function (r, i) { size(r, G.ch); V.place(r.g, { x: xText(i), y: G.y0 }); TI[i].setAttribute('x', n2(xText(i) + G.cw / 2)); TI[i].setAttribute('y', G.y0 - 5); TI[i].style.display = o.indices && G.cw >= 19 ? '' : 'none'; });
      P.forEach(function (r, j) { size(r, G.ch); r.x = null; });
      B.forEach(function (r) { size(r, G.th || G.ch); r.txt.style.fontSize = clamp(Math.round((G.th || G.ch) * 0.52), 9, 16) + 'px'; r.x = null; });
      // row labels
      function label(name, text, y, hgt) {
        var el = rowLabels[name];
        if (!el) { el = rowLabels[name] = s('text', { class: 'sm-rowlabel' }); L.labels.appendChild(el); }
        el.textContent = text; el.setAttribute('x', G.offX); el.setAttribute('y', n2(y + hgt / 2)); el.setAttribute('dy', '.35em');
        el.style.display = o.labels && text ? '' : 'none';
      }
      var narrow = G.labelW < 50;
      label('text', narrow ? shortLabel(o.textLabel) : o.textLabel, G.y0, G.ch);
      label('pat', narrow ? shortLabel(o.patLabel) : o.patLabel, G.y1, G.ch);
      if (G.y2 !== undefined) label('table', (st.table && st.table.label) || '', G.y2, G.th); else label('table', '', 0, 0);
      return true;
    }
    function shortLabel(t) { var map = { pattern: 'pat.', 'prefix copy': 'copy', 'shifted copy': 'copy' }; return map[t] || (t.length > 6 ? t.slice(0, 5) + '.' : t); }

    /* ---------------- drawing one snapshot */
    function draw(st, dur) {
      ensure(st); layout(st);
      last = st;
      var off = st.offset !== null && st.offset !== undefined ? st.offset : lastOffset;
      if (st.offset !== null && st.offset !== undefined) lastOffset = st.offset;
      var patVisible = st.pat !== null && st.offset !== null && st.offset !== undefined;
      var m = P.length;

      // text cells
      T.forEach(function (r, i) { setState(r, st.tStates[i]); });
      // pattern cells: glide, hide when clipped past the text end
      P.forEach(function (r, j) {
        var col = off + j, hide = !patVisible || (st.clip && col >= T.length);
        setState(r, patVisible ? st.pStates[j] : 'default');
        var tx = xPat(j, off), ty = G.y1;
        if (r.x === null || dur === 0) { V.place(r.g, { x: tx, y: ty, opacity: hide ? 0 : 1 }); }
        else V.animate(r.g, { x: tx, y: ty, opacity: hide ? 0 : 1 }, { duration: dur });
        r.x = tx; r.hidden = hide;
        r.g.style.pointerEvents = hide ? 'none' : '';
        if (PI[j]) { var visIdx = !hide && res.ptrPat && o.indices && G.cw >= 19; PI[j].style.display = visIdx ? '' : 'none'; PI[j].setAttribute('y', n2(G.idxPatY || 0)); animateAttr(PI[j], 'x', tx + G.cw / 2, dur); }
      });
      // table cells
      var tb = st.table;
      B.forEach(function (r, i) {
        if (!tb || i >= tb.values.length) { r.g.style.opacity = 0; return; }
        var v = tb.values[i];
        r.txt.textContent = v === null || v === undefined ? '' : String(v);
        var stt = tb.states && tb.states[i] ? tb.states[i] : (v === null || v === undefined ? 'muted' : 'default');
        setState(r, stt);
        r.g.classList.toggle('is-active-cell', tb.active === i);
        var tx = xTable(i, st, off), ty = G.y2, hide = tb.under === 'pat' && (!patVisible || (st.clip && off + i >= T.length));
        var hiddenNow = hide;
        if (r.x === null || dur === 0) V.place(r.g, { x: tx, y: ty, opacity: hiddenNow ? 0 : 1 });
        else V.animate(r.g, { x: tx, y: ty, opacity: hiddenNow ? 0 : 1 }, { duration: dur });
        r.x = tx;
      });
      if (tb) lastTable = tb;
      if (rowLabels.table && tb) { rowLabels.table.textContent = tb.label || ''; rowLabels.table.style.display = o.labels ? '' : 'none'; rowLabels.table.setAttribute('y', n2(G.y2 + G.th / 2)); }
      else if (rowLabels.table) rowLabels.table.style.display = 'none';
      if (rowLabels.pat) rowLabels.pat.style.opacity = patVisible ? 1 : 0.25;

      drawLink(st, off, patVisible, dur);
      drawGhost(st, patVisible, dur);
      drawBands(st, dur);
      drawPointers(st, off, dur);
      drawArrows(st, off, dur);
      pulse(st);
      describe(st, off, patVisible);
      keepInView(st, off);
      svg.style.setProperty('--t', n2(dur) + 'ms');
    }

    function animateAttr(el, attr, v, dur) {
      if (dur === 0 || el.getAttribute(attr) === null) el.setAttribute(attr, n2(v));
      else V.animate(el, { attr: (function () { var a = {}; a[attr] = v; return a; }()) }, { duration: dur });
    }

    function drawLink(st, off, patVisible, dur) {
      if (!link) {
        link = s('g', { class: 'sm-link' });
        link.appendChild(s('line', { class: 'sm-link__line' }));
        var b = s('g', { class: 'sm-link__badge' }); b.appendChild(s('circle', { r: 10 })); var t = s('text', { 'text-anchor': 'middle', dy: '.36em' }); b.appendChild(t);
        link.appendChild(b); L.links.appendChild(link);
      }
      var c = st.cmp;
      if (!c || !o.link || !patVisible) { link.style.opacity = 0; return; }
      var x = xText(c.t) + G.cw / 2, y1 = G.y0 + G.ch, y2 = G.y1;
      var line = link.firstChild, badge = link.lastChild;
      line.setAttribute('x1', n2(x)); line.setAttribute('x2', n2(x)); line.setAttribute('y1', y1); line.setAttribute('y2', y2);
      badge.setAttribute('transform', 'translate(' + n2(x) + ' ' + n2((y1 + y2) / 2) + ')');
      badge.lastChild.textContent = c.state === 'found' ? '=' : '≠';
      link.setAttribute('class', 'sm-link is-' + c.state);
      link.style.opacity = 1;
    }

    function drawGhost(st, patVisible, dur) {
      if (!ghost) { ghost = s('rect', { class: 'sm-ghost', rx: 8 }); L.ghost.appendChild(ghost); }
      if (st.ghost === null || st.ghost === undefined || !patVisible || !P.length) { ghost.style.opacity = 0; return; }
      var w = P.length * G.pitch - G.gap + 6;
      if (st.clip) w = Math.min(w, (T.length - st.ghost) * G.pitch - G.gap + 6);
      ghost.setAttribute('x', n2(xPat(0, st.ghost) - 3)); ghost.setAttribute('y', n2(G.y1 - 3));
      ghost.setAttribute('width', n2(Math.max(0, w))); ghost.setAttribute('height', G.ch + 6);
      ghost.style.opacity = 1;
    }

    function drawBands(st, dur) {
      var list = st.bands || [];
      while (bandEls.length < list.length) {
        var g = s('g', { class: 'sm-band' });
        var rect = s('rect', { class: 'sm-band__rect', rx: 8 });
        var lab = s('text', { class: 'sm-band__label' });
        g.appendChild(rect); g.appendChild(lab); L.bands.appendChild(g);
        bandEls.push({ g: g, rect: rect, lab: lab, x: null });
      }
      bandEls.forEach(function (be, k) {
        var b = list[k];
        if (!b) { be.g.style.opacity = 0; return; }
        var x = xText(b.from) - 3, w = (b.to - b.from + 1) * G.pitch - G.gap + 6, y = G.y0 - 5;
        be.g.setAttribute('class', 'sm-band is-' + (b.state || 'active') + (b.dashed ? ' is-dashed' : ''));
        be.rect.setAttribute('y', n2(y)); be.rect.setAttribute('height', G.ch + 10);
        be.lab.textContent = b.label || ''; be.lab.setAttribute('y', n2(y - 4 - (o.indices ? 12 : 0)));
        if (be.x === null || dur === 0) { be.rect.setAttribute('x', n2(x)); be.rect.setAttribute('width', n2(w)); be.lab.setAttribute('x', n2(x + 2)); }
        else { V.animate(be.rect, { attr: { x: x, width: w } }, { duration: dur }); V.animate(be.lab, { attr: { x: x + 2 } }, { duration: dur }); }
        be.x = x; be.g.style.opacity = 1;
      });
    }

    function drawPointers(st, off, dur) {
      var seen = {};
      (st.pointers || []).forEach(function (p) {
        seen[p.name] = true;
        var rec = ptrEls[p.name];
        if (!rec) {
          var g = s('g', { class: 'sm-ptr' });
          g.appendChild(s('path', { class: 'sm-ptr__tip' }));
          g.appendChild(s('rect', { class: 'sm-ptr__chip', rx: 6, height: 17, y: 0 }));
          var t = s('text', { class: 'sm-ptr__text', 'text-anchor': 'middle', dy: '.36em' }); g.appendChild(t);
          L.pointers.appendChild(g); rec = ptrEls[p.name] = { g: g, tip: g.firstChild, chip: g.childNodes[1], txt: t, x: null, row: null };
        }
        rec.txt.textContent = p.name;
        var w = 10 + 8 * p.name.length;
        rec.chip.setAttribute('width', w); rec.chip.setAttribute('x', -w / 2);
        rec.txt.setAttribute('y', 8.5);
        var above = p.row === 'text';
        var tx = above ? xText(p.index) + G.cw / 2 : xPat(p.index, off) + G.cw / 2;
        var ty = above ? G.ptrTop : G.ptrPatY;
        // chip above the cell with the tip pointing down, or below the cell with the tip pointing up
        rec.tip.setAttribute('d', above ? 'M-4.5 17 L4.5 17 L0 22 Z' : 'M-4.5 0 L4.5 0 L0 -5 Z');
        rec.chip.setAttribute('y', above ? 0 : 0);
        rec.g.setAttribute('class', 'sm-ptr is-' + (p.state || 'active'));
        if (rec.x === null || rec.row !== p.row || dur === 0) V.place(rec.g, { x: tx, y: ty, opacity: 1 });
        else V.animate(rec.g, { x: tx, y: ty, opacity: 1 }, { duration: dur });
        rec.x = tx; rec.row = p.row;
      });
      Object.keys(ptrEls).forEach(function (k) { if (!seen[k]) { ptrEls[k].g.style.opacity = 0; ptrEls[k].x = null; } });
    }

    function anchor(end, st, off) {
      var row = end.row, i = end.index;
      if (row === 'text') return { x: xText(i) + G.cw / 2, top: G.y0, bottom: G.y0 + G.ch };
      if (row === 'pat') return { x: xPat(i, off) + G.cw / 2, top: G.y1, bottom: G.y1 + G.ch };
      return { x: xTable(i, st, off) + G.cw / 2, top: G.y2, bottom: G.y2 + G.th };
    }
    function drawArrows(st, off, dur) {
      arrowEls.forEach(function (e) { if (e.parentNode) e.parentNode.removeChild(e); });
      arrowEls = [];
      (st.arrows || []).forEach(function (a) {
        if (!G.y2 && (a.from.row === 'table' || a.to.row === 'table')) return;
        var A = anchor(a.from, st, off), Bn = anchor(a.to, st, off);
        var g = s('g', { class: 'sm-arrow is-' + (a.state || 'key') });
        var d, lx, ly;
        if (a.from.row === 'table' && a.to.row === 'table') {
          var yb = A.bottom + 1, dip = 26;
          d = 'M' + n2(A.x) + ' ' + n2(yb) + ' C' + n2(A.x) + ' ' + n2(yb + dip) + ' ' + n2(Bn.x) + ' ' + n2(yb + dip) + ' ' + n2(Bn.x) + ' ' + n2(Bn.bottom + 6);
          lx = (A.x + Bn.x) / 2; ly = yb + dip * 0.75 + 6;
        } else {
          var y1 = A.top - 1, y2 = Bn.bottom + 7, ym = (y1 + y2) / 2;
          if (a.from.row === 'text' || a.to.row === 'text') { y1 = A.bottom; y2 = Bn.top - 7; ym = (y1 + y2) / 2; }
          d = 'M' + n2(A.x) + ' ' + n2(y1) + ' C' + n2(A.x) + ' ' + n2(ym) + ' ' + n2(Bn.x) + ' ' + n2(ym) + ' ' + n2(Bn.x) + ' ' + n2(y2);
          lx = (A.x + Bn.x) / 2; ly = ym;
        }
        g.appendChild(s('path', { class: 'sm-arrow__path', d: d, 'marker-end': null }));
        var head = a.from.row === 'text' || a.to.row === 'text' ? '' : '';
        var endY = (a.from.row === 'table' && a.to.row === 'table') ? Bn.bottom + 6 : Bn.bottom + 7;
        g.appendChild(s('path', { class: 'sm-arrow__head', d: 'M' + n2(Bn.x - 5) + ' ' + n2(endY + 6) + ' L' + n2(Bn.x + 5) + ' ' + n2(endY + 6) + ' L' + n2(Bn.x) + ' ' + n2(endY - 1) + ' Z' }));
        if (a.label && G.cw >= 15) {
          var wlab = 12 + 6.4 * a.label.length;
          g.appendChild(s('rect', { class: 'sm-arrow__pill', x: n2(lx - wlab / 2), y: n2(ly - 9), width: n2(wlab), height: 18, rx: 9 }));
          var t = s('text', { class: 'sm-arrow__text', x: n2(lx), y: n2(ly), 'text-anchor': 'middle', dy: '.36em' }); t.textContent = a.label; g.appendChild(t);
        }
        L.arrows.appendChild(g); arrowEls.push(g);
        g.style.opacity = 0;
        V.animate(g, { opacity: 1 }, { duration: dur === 0 ? 0 : Math.max(120, dur * 0.5), delay: dur === 0 ? 0 : dur * 0.45 });
      });
    }

    function pulse(st) {
      if (!st.pulse || st.pulse === lastPulse) { lastPulse = st.pulse || null; return; }
      lastPulse = st.pulse;
      var targets = [];
      bandEls.forEach(function (be, k) { if ((st.bands || [])[k]) targets.push(be.g); });
      if (st.table && st.table.active !== null && B[st.table.active]) targets.push(B[st.table.active].g);
      targets.forEach(function (g) { g.classList.remove('sm-pulse'); void g.getBoundingClientRect(); g.classList.add('sm-pulse'); });
    }

    function describe(st, off, patVisible) {
      var txt = 'Text ' + st.text + '.';
      if (patVisible) txt += ' Pattern ' + built.pat + ' starts under index ' + off + '.';
      if (st.table) txt += ' ' + (st.table.label || 'Table') + ': ' + st.table.values.map(function (v) { return v === null ? '·' : v; }).join(', ') + '.';
      desc.textContent = txt;
    }

    function keepInView(st, off) {
      if (G.svgW <= G.W + 1) { wrap.scrollLeft = 0; return; }
      var col = st.cmp ? st.cmp.t : (st.pointers && st.pointers[0] ? st.pointers[0].index : off);
      var x = xText(col) + G.cw / 2 - wrap.clientWidth / 2;
      wrap.scrollLeft = clamp(x, 0, G.svgW - wrap.clientWidth);
    }

    function render(state, ropts) {
      if (destroyed) return;
      var dur = ropts && ropts.duration !== undefined ? ropts.duration : 400;
      scan(state);
      draw(state, V.reducedMotion() ? 0 : dur);
    }
    var unsub = o.width ? null : V.onResize(wrap, function () { if (last && !destroyed) { sig = ''; draw(last, 0); } });
    return {
      el: svg, wrap: wrap, render: render, prepare: prepare, reset: reset,
      refresh: function () { if (last) { sig = ''; draw(last, 0); } },
      destroy: function () { destroyed = true; if (unsub) unsub(); if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    };
  };

  /* ------------------------------------------------------------------ static tile (summary card, variations) */
  SM.tile = function (state, options) {
    var host = h('div', { class: 'sm-tile' });
    var opts = Object.assign({ width: 250, cell: 26, minCell: 12, labels: false, indices: false, link: true, gapY: 20 }, options || {});
    host.style.width = opts.width + 'px';
    var view = SM.view(host, opts);
    view.render(state, { duration: 0 });
    return host;
  };

  /* ------------------------------------------------------------------ text + pattern inputs */
  SM.parseWord = function (text, label, o) {
    o = o || {};
    var v = String(text || '').trim().toLowerCase();
    if (!v && !o.allowEmpty) return { error: 'Type at least one letter for the ' + label + '.' };
    if (!/^[a-z]*$/.test(v)) return { error: 'The ' + label + ' can only use the letters a to z (no spaces, digits or capitals).' };
    if (o.max && v.length > o.max) return { error: 'The ' + label + ' can hold up to ' + o.max + ' letters here so that every step stays readable (you typed ' + v.length + ').' };
    return { value: v };
  };
  SM.strInputs = function (el, cfg) {
    el = V.$(el);
    el.classList.add('input-row', 'sm-inputs');
    V.clear(el);
    var uid = V.uid ? V.uid('sm') : 'sm' + Math.floor(Math.random() * 1e6);
    var tf = h('input', { class: 'field sm-field', id: uid + '-t', type: 'text', autocomplete: 'off', spellcheck: 'false', value: cfg.text, 'aria-describedby': uid + '-err', maxlength: 80, 'aria-label': cfg.textLabel || 'Text' });
    var pf = h('input', { class: 'field sm-field sm-field--pat', id: uid + '-p', type: 'text', autocomplete: 'off', spellcheck: 'false', value: cfg.pat, 'aria-describedby': uid + '-err', maxlength: 40, 'aria-label': cfg.patLabel || 'Pattern' });
    var apply = h('button', { type: 'button', class: 'btn btn--primary' }, cfg.applyLabel || 'Apply');
    var err = h('p', { class: 'input-row__error', id: uid + '-err', role: 'alert' });
    el.appendChild(h('div', { class: 'sm-inputs__fields' },
      h('div', { class: 'input-row__field sm-inputs__text' }, h('label', { class: 'field-label', for: uid + '-t' }, cfg.textLabel || 'Text'), tf),
      h('div', { class: 'input-row__field sm-inputs__pat' }, h('label', { class: 'field-label', for: uid + '-p' }, cfg.patLabel || 'Pattern'), h('div', { class: 'input-row__control' }, pf, apply))));
    if (cfg.presets && cfg.presets.length) {
      var row = h('div', { class: 'input-row__presets', role: 'group', 'aria-label': 'Presets' });
      cfg.presets.forEach(function (p) {
        row.appendChild(h('button', { type: 'button', class: 'btn btn--sm', title: p.title || null, onclick: function () {
          var v = typeof p.value === 'function' ? p.value() : p.value;
          tf.value = v.text; pf.value = v.pat; run();
        } }, p.label));
      });
      el.appendChild(row);
    }
    if (cfg.hint) el.appendChild(h('p', { class: 'input-row__hint' }, cfg.hint));
    el.appendChild(err);
    function setError(msg) { err.textContent = msg || ''; [tf, pf].forEach(function (f) { if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid'); }); }
    function run() {
      var t = SM.parseWord(tf.value, 'text', { max: cfg.maxText, allowEmpty: cfg.allowEmptyText });
      if (t.error) { setError(t.error); tf.focus(); return false; }
      var p = SM.parseWord(pf.value, 'pattern', { max: cfg.maxPat });
      if (p.error) { setError(p.error); pf.focus(); return false; }
      setError('');
      if (cfg.check) { var msg = cfg.check(t.value, p.value); if (msg) { setError(msg); return false; } }
      tf.value = t.value; pf.value = p.value;
      cfg.onApply(t.value, p.value);
      return true;
    }
    apply.addEventListener('click', run);
    [tf, pf].forEach(function (f) {
      f.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });
      f.addEventListener('input', function () { if (err.textContent) setError(''); });
    });
    return { set: function (t, p, doApply) { tf.value = t; pf.value = p; if (doApply !== false) run(); }, apply: run, setError: setError, text: tf, pat: pf };
  };

  /* ------------------------------------------------------------------ Rabin–Karp hash strip */
  SM.hashStrip = function (el) {
    el = V.$(el);
    el.classList.add('sm-hash');
    V.clear(el);
    var tiles = {};
    function tile(key, title) {
      var t = h('div', { class: 'sm-hash__tile', 'data-tile': key }, h('span', { class: 'sm-hash__title' }, title), h('span', { class: 'sm-hash__expr' }), h('span', { class: 'sm-hash__val' }));
      tiles[key] = t; return t;
    }
    var arrow = function () { return h('span', { class: 'sm-hash__arrow', 'aria-hidden': 'true' }, '→'); };
    el.appendChild(tile('prev', 'window hash'));
    el.appendChild(arrow());
    el.appendChild(tile('sub', '1 · subtract leading'));
    el.appendChild(arrow());
    el.appendChild(tile('mul', '2 · multiply by base'));
    el.appendChild(arrow());
    el.appendChild(tile('add', '3 · add trailing'));
    el.appendChild(h('span', { class: 'sm-hash__arrow', 'aria-hidden': 'true' }, '='));
    el.appendChild(tile('cmp', 'pattern hash'));
    function put(key, expr, val, on, state) {
      var t = tiles[key];
      t.querySelector('.sm-hash__expr').innerHTML = expr || '';
      t.querySelector('.sm-hash__val').textContent = val === null || val === undefined ? '·' : val;
      t.classList.toggle('is-on', !!on); t.classList.toggle('is-dim', !on);
      t.setAttribute('data-state', state || '');
    }
    function render(hs) {
      if (!hs) { ['prev', 'sub', 'mul', 'add', 'cmp'].forEach(function (k) { put(k, '', null, false); }); return; }
      var ph = hs.phase, roll = ph === 'sub' || ph === 'mul' || ph === 'add';
      var q = hs.q, B = hs.B;
      if (roll) {
        put('prev', 'hash of the old window', hs.prev, true, ph === 'sub' ? '' : '');
        put('sub', '− ' + hs.lv + ' · ' + hs.P + ' (<b>' + hs.lead + '</b> · B<sup>m−1</sup>)', hs.sub, ph === 'sub' || ph === 'mul' || ph === 'add', ph === 'sub' ? 'active' : '');
        put('mul', '× ' + B, ph === 'sub' ? null : hs.mul, ph === 'mul' || ph === 'add', ph === 'mul' ? 'active' : '');
        put('add', '+ ' + hs.tv + ' (<b>' + hs.trail + '</b>)', ph === 'add' ? hs.add : null, ph === 'add', ph === 'add' ? 'active' : '');
        put('cmp', 'all mod ' + q, hs.hp, false);
      } else if (ph === 'pattern') {
        put('prev', 'read as base ' + B, hs.total, true);
        put('sub', 'mod ' + q, hs.hp, true, 'active'); put('mul', '', null, false); put('add', '', null, false);
        put('cmp', '', hs.hp, true, '');
      } else if (ph === 'window') {
        put('prev', 'read as base ' + B, hs.total, true);
        put('sub', 'mod ' + q, hs.h, true, 'active'); put('mul', '', null, false); put('add', '', null, false);
        put('cmp', '', hs.hp, true);
      } else if (ph === 'compare' || ph === 'verify' || ph === 'verified' || ph === 'spurious') {
        var st = ph === 'verified' ? 'done' : ph === 'spurious' ? 'error' : hs.hit ? 'compare' : '';
        put('prev', '', hs.h, true, st); put('sub', '', null, false); put('mul', '', null, false); put('add', '', null, false);
        put('cmp', '', hs.hp, true, st);
      } else {
        put('prev', '', hs.h, false); put('sub', '', null, false); put('mul', '', null, false); put('add', '', null, false); put('cmp', '', hs.hp, false);
      }
    }
    render(null);
    return { render: render };
  };
}());
