/* Lesson 33 · Backtracking — custom views: the chessboard, the Sudoku grid, and small conversion helpers.
   Both views follow the engine contract: build the SVG once, keep elements alive between steps and MOVE them
   (queens drop in and lift out, rings and bands slide, digits pop). Colours come only from --st-* tokens; CSS
   transitions follow --t, which each render sets to the player's step duration. Registered on VDSA.bt33. */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s, h = V.h;
  var A = V.algos['33-backtracking'];
  var B = V.bt33 = V.bt33 || {};

  /* ================================================================== chessboard */
  /* boardView(stage, {cell, labels, hud, onCell, label}) -> {render(state, ctx), el, destroy}
     state: {n, pieces: [[r, c]], row, cand: {r, c, state: 'try'|'bad'|'ok'}, attacker: {r, c}, solved, shade,
             pairs: [[[r, c], [r, c]]], mark: [[r, c]], probe: {r, c}, hud: 'text'} */
  var CROWN = 'M-13 9 L-15.5 -7 L-7.5 -1.5 L0 -11.5 L7.5 -1.5 L15.5 -7 L13 9 Z';
  function boardView(stage, opts) {
    opts = opts || {};
    var n = 0, S = 52, ML = 22, MT = 22, MR = 6, MB = 8, W = 0, H = 0;
    var svg, gSq, gAtt, gLines, gPieces, gLbl, band, ring, ringRect, attLine, hudText, cells = [], atts = [], pieces = {}, lineEls = [], probeEls = [], gProbe;
    var last = null;
    function cx(c) { return ML + c * S + S / 2; }
    function cy(r) { return MT + r * S + S / 2; }
    function clickCell(r, c) { if (opts.onCell) opts.onCell(r, c); }

    function build(nn) {
      V.clear(stage);
      n = nn;
      S = opts.cell || (n <= 6 ? 56 : n <= 8 ? 52 : 46);
      var showLbl = opts.labels !== false;
      ML = showLbl ? 20 : 4; MT = showLbl ? 20 : 4; MB = opts.hud ? 34 : 6;
      W = ML + n * S + MR; H = MT + n * S + MB;
      svg = s('svg', { class: 'bt-board', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || (n + ' by ' + n + ' chessboard') });
      svg.style.maxWidth = Math.round(W * 1.22) + 'px';
      if (opts.fixed) { svg.setAttribute('width', W); svg.setAttribute('height', H); svg.style.width = W + 'px'; svg.style.maxWidth = '100%'; svg.style.height = 'auto'; }
      gSq = s('g'); gAtt = s('g'); gProbe = s('g'); gLines = s('g'); gPieces = s('g'); gLbl = s('g', { 'aria-hidden': 'true' });
      cells = []; atts = []; pieces = {};
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        var rect = s('rect', { class: 'bt-sq' + ((r + c) % 2 ? ' dark' : ''), x: ML + c * S, y: MT + r * S, width: S, height: S });
        gSq.appendChild(rect); cells.push(rect);
        var att = s('rect', { class: 'bt-att', x: ML + c * S, y: MT + r * S, width: S, height: S });
        gAtt.appendChild(att); atts.push(att);
        if (opts.onCell || opts.hitIds) {
          (function (rr, cc) {
            var hit = s('rect', { class: 'bt-hit', x: ML + cc * S, y: MT + rr * S, width: S, height: S, tabindex: 0, role: 'button', 'aria-label': 'Row ' + rr + ', column ' + cc, 'data-id': opts.hitIds ? rr + ',' + cc : null, 'data-label': opts.hitIds ? 'Row ' + rr + ', column ' + cc : null });
            hit.addEventListener('click', function () { clickCell(rr, cc); });
            hit.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickCell(rr, cc); } });
            gLbl.appendChild(hit);
          }(r, c));
        }
      }
      if (showLbl) for (var k = 0; k < n; k++) {
        gLbl.appendChild(s('text', { class: 'bt-lbl', x: cx(k), y: MT - 6, 'text-anchor': 'middle' }, k));
        gLbl.appendChild(s('text', { class: 'bt-lbl', x: ML - 7, y: cy(k) + 4, 'text-anchor': 'end' }, k));
      }
      band = s('rect', { class: 'bt-band', x: ML, y: 0, width: n * S, height: S, rx: 3 });
      V.place(band, { opacity: 0 });
      ringRect = s('rect', { class: 'bt-ring-rect', x: -S / 2 + 2, y: -S / 2 + 2, width: S - 4, height: S - 4, rx: 7 });
      ring = s('g', { class: 'bt-ring' }, ringRect);
      V.place(ring, { x: cx(0), y: cy(0), opacity: 0 });
      attLine = s('line', { class: 'bt-attline', x1: 0, y1: 0, x2: 0, y2: 0 });
      hudText = s('text', { class: 'bt-hud', x: ML + n * S / 2, y: MT + n * S + 24, 'text-anchor': 'middle' });
      svg.appendChild(gSq); svg.appendChild(band); svg.appendChild(gAtt); svg.appendChild(gProbe); svg.appendChild(s('rect', { class: 'bt-frame', x: ML, y: MT, width: n * S, height: n * S, rx: 3 }));
      svg.appendChild(gLines); svg.appendChild(attLine); svg.appendChild(ring); svg.appendChild(gPieces); svg.appendChild(hudText); svg.appendChild(gLbl);
      stage.appendChild(svg);
      last = null; lineEls = []; probeEls = [];
    }

    function makePiece(k) {
      var g = s('g', { class: 'bt-piece' }), inner = s('g', { transform: 'scale(' + (S / 56).toFixed(3) + ')' });
      inner.appendChild(s('path', { d: CROWN }));
      inner.appendChild(s('rect', { x: -14, y: 11, width: 28, height: 5, rx: 2.2 }));
      [[-15.5, -7], [0, -11.5], [15.5, -7]].forEach(function (p) { inner.appendChild(s('circle', { cx: p[0], cy: p[1] - 1.5, r: 2.6 })); });
      g.appendChild(inner);
      g.setAttribute('data-key', k);
      return g;
    }
    function ringState(cand) {
      ringRect.setAttribute('class', 'bt-ring-rect is-' + (cand ? cand.state : 'try'));
    }
    function setLine(el, x1, y1, x2, y2) { el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2); }

    function render(st, ctx) {
      ctx = ctx || {};
      var d = ctx.duration === undefined ? 300 : ctx.duration;
      if (!svg || st.n !== n) build(st.n);
      svg.style.setProperty('--t', d + 'ms');
      var i, keyOf = function (p) { return p[0] + ',' + p[1]; };
      // pieces: keyed by square, they drop in and lift out
      var want = {}, marks = {};
      (st.pieces || []).forEach(function (p) { want[keyOf(p)] = p; });
      (st.mark || []).forEach(function (p) { marks[keyOf(p)] = true; });
      Object.keys(pieces).forEach(function (k) {
        if (want[k]) return;
        var el = pieces[k];
        if (el.__gone) return;
        el.__gone = true;
        if (d === 0) { if (el.parentNode) el.parentNode.removeChild(el); delete pieces[k]; return; }
        V.animate(el, { scale: 0.5, y: el.__vdsa.y - 16, opacity: 0 }, { duration: d, ease: 'in' }).then(function (ok) {
          if (ok && el.__gone) { if (el.parentNode) el.parentNode.removeChild(el); if (pieces[k] === el) delete pieces[k]; }
        });
      });
      Object.keys(want).forEach(function (k) {
        var p = want[k], el = pieces[k];
        if (!el) {
          el = pieces[k] = makePiece(k); gPieces.appendChild(el);
          if (d === 0) V.place(el, { x: cx(p[1]), y: cy(p[0]), scale: 1, opacity: 1 });
          else { V.place(el, { x: cx(p[1]), y: cy(p[0]) - 26, scale: 0.35, opacity: 0 }); V.animate(el, { y: cy(p[0]), scale: 1, opacity: 1 }, { duration: d, ease: 'back' }); }
        } else if (el.__gone) {
          el.__gone = false;
          V.animate(el, { x: cx(p[1]), y: cy(p[0]), scale: 1, opacity: 1 }, { duration: d, ease: 'out' });
        }
        var cls = 'bt-piece' + (st.solved ? ' is-found' : marks[k] ? ' is-error' : '');
        if (el.getAttribute('class') !== cls) el.setAttribute('class', cls);
      });
      // attacked squares
      var shade = st.shade !== false, grid = shade && (st.pieces || []).length ? A.attackedCells(st.pieces, n) : null;
      for (i = 0; i < atts.length; i++) {
        var on = !!(grid && grid[i] && !want[Math.floor(i / n) + ',' + (i % n)]);
        var cur = atts[i].getAttribute('class').indexOf(' on') >= 0;
        if (on !== cur) atts[i].setAttribute('class', 'bt-att' + (on ? ' on' : ''));
      }
      // row band
      if (st.row !== null && st.row !== undefined && st.row >= 0 && st.row < n) V.animate(band, { y: MT + st.row * S, opacity: 1 }, { duration: d, ease: 'out' });
      else V.animate(band, { opacity: 0 }, { duration: d });
      // candidate ring
      if (st.cand) {
        ringState(st.cand);
        var wasHidden = !ring.__vdsa || !ring.__vdsa.opacity;
        if (wasHidden || d === 0) V.place(ring, { x: cx(st.cand.c), y: cy(st.cand.r), opacity: 1, scale: 1 });
        else V.animate(ring, { x: cx(st.cand.c), y: cy(st.cand.r), opacity: 1 }, { duration: d * 0.7, ease: 'out' });
        if (st.cand.state === 'bad' && d > 0) { V.place(ring, { scale: 1.32 }); V.animate(ring, { scale: 1 }, { duration: d, ease: 'out' }); }
      } else V.animate(ring, { opacity: 0 }, { duration: d * 0.6 });
      // line from the attacking queen to the tested square
      if (st.cand && st.attacker) {
        setLine(attLine, cx(st.attacker.c), cy(st.attacker.r), cx(st.cand.c), cy(st.cand.r));
        attLine.setAttribute('class', 'bt-attline on');
      } else attLine.setAttribute('class', 'bt-attline');
      // pair lines between queens that attack each other (hand-placement figure)
      var pairs = st.pairs || [];
      while (lineEls.length < pairs.length) { var ln = s('line', { class: 'bt-pairline' }); gLines.appendChild(ln); lineEls.push(ln); }
      lineEls.forEach(function (ln, k) {
        if (k < pairs.length) { setLine(ln, cx(pairs[k][0][1]), cy(pairs[k][0][0]), cx(pairs[k][1][1]), cy(pairs[k][1][0])); ln.style.display = ''; } else ln.style.display = 'none';
      });
      // probe: the column and both diagonals through a square
      var pr = st.probe, need = pr ? 3 : 0;
      while (probeEls.length < 3) { var pl = s('line', { class: 'bt-probe p' + probeEls.length }); gProbe.appendChild(pl); probeEls.push(pl); }
      probeEls.forEach(function (pl, k) {
        if (!pr) { pl.style.display = 'none'; return; }
        pl.style.display = '';
        var r0 = pr.r, c0 = pr.c, x1, y1, x2, y2, t;
        if (k === 0) { x1 = cx(c0); y1 = MT + 3; x2 = x1; y2 = MT + n * S - 3; }
        else if (k === 1) {   // "/" : r + c constant
          var sum = r0 + c0; var rTop = Math.max(0, sum - (n - 1)), cTop = sum - rTop, rBot = Math.min(n - 1, sum), cBot = sum - rBot;
          x1 = cx(cBot); y1 = cy(rBot); x2 = cx(cTop); y2 = cy(rTop);
        } else {              // "\" : r - c constant
          var diff = r0 - c0; var rA = Math.max(0, diff), cA = rA - diff, rB = Math.min(n - 1, n - 1 + diff), cB = rB - diff;
          x1 = cx(cA); y1 = cy(rA); x2 = cx(cB); y2 = cy(rB);
        }
        setLine(pl, x1, y1, x2, y2);
      });
      hudText.textContent = st.hud || '';
      last = st;
    }
    return { render: render, el: function () { return svg; }, destroy: function () { V.clear(stage); } };
  }
  B.boardView = boardView;

  /* A static board (no player): returns the <svg> for minis and the summary card. */
  B.miniBoard = function (n, pieces, o) {
    o = o || {};
    var host = h('div', { class: 'bt-mini-host' });
    var view = boardView(host, { fixed: true, cell: o.cell || 30, labels: o.labels === true, label: o.label || (n + ' by ' + n + ' board') });
    view.render({ n: n, pieces: pieces || [], cand: o.cand || null, attacker: o.attacker || null, solved: o.solved, pairs: o.pairs, mark: o.mark, shade: o.shade, row: o.row, probe: o.probe }, { duration: 0 });
    return host;
  };

  /* ================================================================== Sudoku grid */
  /* sudokuView(stage, {onToggle}) -> {render(step, ctx), setCandidates(bool)}
     step: {grid[81], given[81], cand[81] masks, focus, kind, count} */
  function sudokuView(stage, opts) {
    opts = opts || {};
    var C = 44, PAD = 8, W = 9 * C + PAD * 2, H = W;
    var showCand = opts.candidates !== false;
    var svg = s('svg', { class: 'bt-sudoku', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Sudoku grid' });
    svg.style.maxWidth = '470px';
    if (opts.mini) { svg.style.width = '150px'; svg.style.maxWidth = '100%'; }
    var rects = [], digits = [], candG = [], candT = [], lastGrid = null, lastFocus = -1;
    var bandR = s('rect', { class: 'bt-peer', width: 9 * C, height: C }), bandC = s('rect', { class: 'bt-peer', width: C, height: 9 * C }), bandB = s('rect', { class: 'bt-peer', width: 3 * C, height: 3 * C });
    [bandR, bandC, bandB].forEach(function (b) { V.place(b, { opacity: 0 }); });
    var gCells = s('g'), gCand = s('g'), gDig = s('g'), gLines = s('g');
    for (var i = 0; i < 81; i++) {
      var r = Math.floor(i / 9), c = i % 9, x = PAD + c * C, y = PAD + r * C;
      rects.push(gCells.appendChild(s('rect', { class: 'bt-cell', x: x, y: y, width: C, height: C })));
      var cg = s('g', { class: 'bt-cands', 'aria-hidden': 'true' }), ts = [];
      for (var d = 0; d < 9; d++) ts.push(cg.appendChild(s('text', { class: 'bt-cand', x: x + 7.5 + (d % 3) * 14.5, y: y + 11.5 + Math.floor(d / 3) * 14 }, d + 1)));
      candG.push(gCand.appendChild(cg)); candT.push(ts);
      var dg = s('g', { class: 'bt-dig' }, s('text', { class: 'bt-num', x: 0, y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }));
      V.place(dg, { x: x + C / 2, y: y + C / 2 });
      digits.push(gDig.appendChild(dg));
    }
    for (var k = 0; k <= 9; k++) {
      var thick = k % 3 === 0;
      gLines.appendChild(s('line', { class: 'bt-line' + (thick ? ' thick' : ''), x1: PAD + k * C, y1: PAD, x2: PAD + k * C, y2: PAD + 9 * C }));
      gLines.appendChild(s('line', { class: 'bt-line' + (thick ? ' thick' : ''), x1: PAD, y1: PAD + k * C, x2: PAD + 9 * C, y2: PAD + k * C }));
    }
    var ring = s('rect', { class: 'bt-sring', x: 0, y: 0, width: C - 3, height: C - 3, rx: 5 });
    V.place(ring, { x: PAD + 1.5, y: PAD + 1.5, opacity: 0 });
    [gCells, bandR, bandC, bandB, gCand, gDig, gLines, ring].forEach(function (g) { svg.appendChild(g); });
    stage.appendChild(svg);
    var candState = [];
    function render(st, ctx) {
      var dms = ctx && ctx.duration !== undefined ? ctx.duration : 300;
      svg.style.setProperty('--t', dms + 'ms');
      var fromScratch = !lastGrid || (ctx && ctx.prev === null);
      for (var i = 0; i < 81; i++) {
        var v = st.grid[i], changed = !lastGrid || lastGrid[i] !== v;
        var isFocus = i === st.focus;
        var cls = 'bt-cell' + (st.given[i] ? ' given' : '');
        if (isFocus) cls += st.kind === 'pick' ? (st.count === 0 ? ' is-error' : ' is-compare') : st.kind === 'place' ? ' is-active' : st.kind === 'erase' ? ' is-error' : '';
        if (rects[i].getAttribute('class') !== cls) rects[i].setAttribute('class', cls);
        if (changed) {
          var t = digits[i].firstChild;
          t.textContent = v ? v : '';
          t.setAttribute('class', 'bt-num' + (st.given[i] ? ' given' : '') + (st.kind === 'solved' || st.kind === 'summary' ? ' solved' : ''));
          if (v && !fromScratch && dms > 0 && !st.given[i]) { V.place(digits[i], { scale: 0.3, opacity: 0 }); V.animate(digits[i], { scale: 1, opacity: 1 }, { duration: dms, ease: 'back' }); }
          else V.place(digits[i], { scale: 1, opacity: v ? 1 : 0 });
        } else if (!st.given[i] && v) {
          var t2 = digits[i].firstChild, want = 'bt-num' + (st.kind === 'solved' || st.kind === 'summary' ? ' solved' : '');
          if (t2.getAttribute('class') !== want) t2.setAttribute('class', want);
        }
        // pencil marks
        var m = v || !showCand ? 0 : st.cand[i], key = m + (isFocus ? 'f' : '');
        if (candState[i] !== key) {
          candState[i] = key;
          for (var dd = 0; dd < 9; dd++) {
            var on = !!(m & (1 << dd));
            candT[i][dd].setAttribute('class', 'bt-cand' + (on ? ' on' : '') + (on && isFocus ? ' hot' : ''));
          }
        }
      }
      // focus ring and the row / column / box the digit must respect
      if (st.focus >= 0) {
        var fr = Math.floor(st.focus / 9), fc = st.focus % 9;
        var col = st.kind === 'erase' || (st.kind === 'pick' && st.count === 0) ? 'is-error' : st.kind === 'place' ? 'is-active' : 'is-compare';
        ring.setAttribute('class', 'bt-sring ' + col);
        var fresh = lastFocus < 0 || fromScratch || dms === 0;
        var props = { x: PAD + fc * C + 1.5, y: PAD + fr * C + 1.5, opacity: 1 };
        if (fresh) V.place(ring, props); else V.animate(ring, props, { duration: dms * 0.8, ease: 'out' });
        var bp = function (el, p) { if (fresh) V.place(el, p); else V.animate(el, p, { duration: dms * 0.8, ease: 'out' }); };
        bp(bandR, { x: PAD, y: PAD + fr * C, opacity: 1 }); bp(bandC, { x: PAD + fc * C, y: PAD, opacity: 1 });
        bp(bandB, { x: PAD + Math.floor(fc / 3) * 3 * C, y: PAD + Math.floor(fr / 3) * 3 * C, opacity: 1 });
      } else {
        V.animate(ring, { opacity: 0 }, { duration: dms * 0.6 });
        [bandR, bandC, bandB].forEach(function (b) { V.animate(b, { opacity: 0 }, { duration: dms * 0.6 }); });
      }
      svg.setAttribute('aria-label', 'Sudoku grid, ' + st.grid.filter(Boolean).length + ' of 81 cells filled');
      lastGrid = st.grid; lastFocus = st.focus;
    }
    return {
      render: render,
      setCandidates: function (on) { showCand = on; candState = []; },
      el: svg
    };
  }
  B.sudokuView = sudokuView;

  /* A static Sudoku thumbnail (given cells only) for the summary card and minis. */
  B.miniSudoku = function (grid, o) {
    o = o || {};
    var host = h('div', { class: 'bt-mini-host' });
    var view = sudokuView(host, { candidates: false, mini: true });
    var given = grid.map(function (v) { return v > 0; });
    view.render({ grid: grid, given: given, cand: new Uint16Array(81), focus: o.focus === undefined ? -1 : o.focus, kind: o.kind || 'pick', count: o.count === undefined ? 2 : o.count }, { duration: 0, prev: null });
    return host;
  };

  /* ================================================================== helpers */
  var PATHY = { active: 1, frontier: 1, found: 1, path: 1 };
  /* Generator tree nodes [{id, parent, label, state, badge, ret}] -> VDSA.views.tree state. */

  /* Level guides behind a recursion tree: one faint lane per depth, labelled with what a level means ("row 3").
     They exist from the first frame, so the stage is never blank, and the lane of the row being filled lights up with
     the board's row band. B.levelGuides(host, {levels, step, label}) -> {update(activeDepth)}. */
  B.levelGuides = function (host, o) {
    var svg = null, g = null, lanes = [], built = 0;
    function build() {
      svg = host.querySelector('svg.vz');
      if (!svg) return false;
      if (g && g.parentNode) g.parentNode.removeChild(g);
      lanes = [];
      g = s('g', { class: 'bt-lanes', 'aria-hidden': 'true' });
      svg.insertBefore(g, svg.querySelector('.vz-layer') || null);
      var count = typeof o.levels === 'function' ? o.levels() : o.levels;
      built = count;
      for (var d = 0; d < count; d++) {
        var line = s('line', { class: 'bt-lane__line' });
        var txt = s('text', { class: 'bt-lane__txt' }, o.label(d));
        g.appendChild(line); g.appendChild(txt); lanes.push({ line: line, txt: txt });
      }
      return true;
    }
    function update(active) {
      var want = typeof o.levels === 'function' ? o.levels() : o.levels;
      if ((!g || !g.parentNode || built !== want) && !build()) return;
      var root = svg.querySelector('.vz-node'), y0 = 24;
      if (root) {
        var t = root.getAttribute('transform') || '', m = /translate\(\s*[-\d.e]+[ ,]+([-\d.e]+)/.exec(t);
        if (m) y0 = parseFloat(m[1]); else if (root.__vdsa && typeof root.__vdsa.y === 'number') y0 = root.__vdsa.y;
      }
      var W = parseFloat(svg.getAttribute('viewBox') ? svg.getAttribute('viewBox').split(' ')[2] : 0) || svg.clientWidth;
      lanes.forEach(function (l, d) {
        var y = y0 + d * o.step;
        l.line.setAttribute('x1', 6); l.line.setAttribute('x2', W - 6); l.line.setAttribute('y1', y); l.line.setAttribute('y2', y);
        l.txt.setAttribute('x', 8); l.txt.setAttribute('y', y - 5);
        var on = d === active;
        l.line.setAttribute('class', 'bt-lane__line' + (on ? ' is-on' : ''));
        l.txt.setAttribute('class', 'bt-lane__txt' + (on ? ' is-on' : ''));
      });
    }
    return { update: update };
  };
  B.toTree = function (list, o) {
    o = o || {};
    var kids = {};
    list.forEach(function (n) { if (n.parent !== null && n.parent !== undefined) (kids[n.parent] = kids[n.parent] || []).push(n.id); });
    var nodes = list.map(function (n) {
      var out = { id: n.id, label: n.label, children: kids[n.id] || [], state: n.state };
      if (n.badge) { out.badge = n.badge; out.badgeState = n.state === 'error' ? 'error' : 'muted'; }
      if (n.ret) { out.returnValue = n.ret; out.returnPrefix = ''; out.returnState = 'found'; }
      return out;
    });
    var edges = [];
    if (o.pathEdges !== false) list.forEach(function (n) { if (n.parent !== null && n.parent !== undefined && PATHY[n.state]) edges.push({ from: n.parent, to: n.id, state: n.state === 'found' ? 'found' : 'active' }); });
    return { root: list[0].id, nodes: nodes, edges: edges };
  };
  /* Sample a long trace for tree.prepare: every step where the tree first reaches a new size, plus an even spread. */
  B.prepareTree = function (view, steps, get, host) {
    var picked = [], maxN = -1, stride = Math.max(1, Math.floor(steps.length / 260)), seen = {}, probe = [];
    steps.forEach(function (st, i) {
      var list = get(st), len = list.length;
      if (len > maxN || i % stride === 0) { picked.push(B.toTree(list)); if (len > maxN) maxN = len; }
      if (host) {
        /* the tree view adds rows for badges, return values and sub-labels, so one snapshot per combination is enough to find the tallest */
        var sig = list.map(function (n) { return (n.badge ? 1 : 0) | (n.ret ? 2 : 0) | (n.sub ? 4 : 0); }).reduce(function (a, b) { return a | b; }, 0);
        if (!seen[sig]) { seen[sig] = true; probe.push(B.toTree(list)); }
      }
    });
    view.prepare(picked);
    if (host) {
      /* reserve the tallest height so the page does not jump while the trace plays */
      host.style.minHeight = '';
      var tallest = 0;
      probe.concat(picked.slice(-1)).forEach(function (t) { view.render(t, { duration: 0 }); tallest = Math.max(tallest, host.offsetHeight); });
      host.style.minHeight = tallest + 'px';
    }
  };
}());
