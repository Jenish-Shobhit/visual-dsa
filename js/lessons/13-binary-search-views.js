/* Lesson 13 — helpers and custom views shared by the lesson's figures.
   Loaded before 13-binary-search-figs.js, -lab.js, -more.js and 13-binary-search.js.

     L13.whenNear(el, fn)          run fn once when el comes within ~700px of the viewport (lazy figures)
     L13.num(n)                    1,234,567 (real minus sign)
     L13.compact(n)                1.2M / 500k style numbers for narrow chips
     L13.motion()                  a tiny tween runner: run([{rec, to}], ms) moves several records in one animation
     L13.rangeBar(container, o)    a horizontal bar of N values with a bright live band, dimmed dead space, a scanned band
                                   and labelled markers above / below (guess game, halving, race lanes)
     L13.strip(container, o)       a strip of candidate answers (?, false, true) with lo / hi / mid flags (search on the answer)
     L13.restyle(steps, fn)        map over generator steps without mutating them
   Every view has render(state, {duration}) like the engine views, and animates from what is on screen. */
(function () {
  'use strict';
  var V = window.VDSA, vz = V.vz, h = V.h, s = V.s;
  var L13 = V.lessons = V.lessons || {};
  L13 = V.lessons.l13 = V.lessons.l13 || {};

  L13.num = function (n) {
    if (typeof n !== 'number' || !isFinite(n)) return String(n);
    var t = Math.round(n).toLocaleString('en-US');
    return t.replace('-', '−');
  };
  L13.compact = function (n) {
    if (n >= 1e9) return trim(n / 1e9) + 'B';
    if (n >= 1e6) return trim(n / 1e6) + 'M';
    if (n >= 1e4) return trim(n / 1e3) + 'k';
    return L13.num(n);
    function trim(v) { return String(Math.round(v * 10) / 10).replace(/\.0$/, ''); }
  };

  /* ------------------------------------------------------------------ lazy init */
  L13.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 13] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };

  /* ------------------------------------------------------------------ tiny tween runner */
  L13.rec = function (vals, apply) { var r = { vals: Object.assign({}, vals), apply: apply }; apply(r.vals); return r; };
  L13.motion = function () {
    var tw = null;
    return function run(list, ms) {
      if (tw) { tw.cancel(); tw = null; }
      list = list.filter(function (it) { return it && it.rec; });
      list.forEach(function (it) { it.from = Object.assign({}, it.rec.vals); });
      if (!ms || ms <= 0) { list.forEach(function (it) { Object.assign(it.rec.vals, it.to); it.rec.apply(it.rec.vals); }); return; }
      tw = V.tween(ms, function (t, e) {
        list.forEach(function (it) {
          Object.keys(it.to).forEach(function (k) { it.rec.vals[k] = it.from[k] + (it.to[k] - it.from[k]) * e; });
          it.rec.apply(it.rec.vals);
        });
      });
    };
  };
  function textW(text, px, mono, weight) { return vz && vz.textWidth ? vz.textWidth(String(text), px, mono, weight) : String(text).length * px * 0.58; }
  function cx(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ------------------------------------------------------------------ rangeBar */
  /* state: { live: [a, b] | null,      inclusive values that are still possible (fractions allowed)
              scan: [a, b] | null,      inclusive values that were checked (linear search)
              marks: [{id, at, label, state, side: 'above' | 'below', stem: true}],
              hit: value | null,        a single value drawn as a bright cell (the found item)
              note: 'text' }            small text centred on the live band */
  L13.rangeBar = function (container, options) {
    container = V.$(container);
    var o = Object.assign({ min: 1, max: 100, height: 108, ticks: null, tickText: L13.num, label: 'Range of values', band: 26, compact: false }, options || {});
    var svg = s('svg', { class: 'l13-rb', role: 'img', 'aria-label': o.label, focusable: 'false' });
    var desc = s('desc', null, '');
    svg.appendChild(desc);
    container.appendChild(svg);
    var pad = 14, W = 600, H = o.height, bandY = o.compact ? 20 : 36, bandH = o.band;
    var gTicks = s('g', { class: 'l13-rb-ticks' });
    var track = s('rect', { class: 'l13-rb-track', rx: 6 });
    var scan = s('rect', { class: 'l13-rb-scan', rx: 3 });
    var live = s('rect', { class: 'l13-rb-live', rx: 4 });
    var hit = s('rect', { class: 'l13-rb-hit', rx: 2 });
    var note = s('text', { class: 'l13-rb-note', 'text-anchor': 'middle' });
    var gMarks = s('g', { class: 'l13-rb-marks' });
    [gTicks, track, scan, live, hit, note, gMarks].forEach(function (n) { svg.appendChild(n); });
    var span = o.max - o.min + 1;
    var motion = L13.motion();
    var last = null, marks = {}, recs = {};
    function X(v) { return pad + (v - o.min) / span * (W - 2 * pad); }
    function place(rect, x, w) { rect.setAttribute('x', x.toFixed(2)); rect.setAttribute('width', Math.max(0, w).toFixed(2)); rect.style.opacity = w > 0.3 ? '' : '0'; }
    recs.live = L13.rec({ x: pad, w: 0 }, function (v) { place(live, v.x, v.w); });
    recs.scan = L13.rec({ x: pad, w: 0 }, function (v) { place(scan, v.x, v.w); });
    recs.hit = L13.rec({ x: pad, w: 0 }, function (v) { place(hit, v.x, v.w); });

    function layout() {
      W = Math.max(240, container.clientWidth || 600);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      track.setAttribute('x', pad); track.setAttribute('y', bandY); track.setAttribute('width', W - 2 * pad); track.setAttribute('height', bandH);
      [scan, live, hit].forEach(function (r) { r.setAttribute('y', bandY); r.setAttribute('height', bandH); });
      hit.setAttribute('y', bandY - 3); hit.setAttribute('height', bandH + 6);
      V.clear(gTicks);
      var ticks = o.ticks || [o.min, o.max];
      ticks.forEach(function (t, k) {
        var x = X(t + 0.5), anchor = k === 0 ? 'start' : k === ticks.length - 1 && ticks.length > 1 ? 'end' : 'middle';
        if (anchor === 'start') x = X(t);
        if (anchor === 'end') x = X(t + 1);
        gTicks.appendChild(s('line', { x1: x.toFixed(1), x2: x.toFixed(1), y1: bandY + bandH, y2: bandY + bandH + 5, class: 'l13-rb-tick' }));
        gTicks.appendChild(s('text', { x: x.toFixed(1), y: bandY + bandH + 17, 'text-anchor': anchor, class: 'l13-rb-ticktext' }, o.tickText(t)));
      });
      note.setAttribute('y', bandY + bandH / 2 + 4.5);
    }
    layout();

    function markEl(m) {
      var g = s('g', { class: 'l13-rb-mark' });
      g.appendChild(s('line', { class: 'l13-rb-stem' }));
      g.appendChild(s('rect', { class: 'l13-rb-pill', rx: 10, height: 20 }));
      g.appendChild(s('text', { class: 'l13-rb-pilltext', 'text-anchor': 'middle' }));
      gMarks.appendChild(g);
      return g;
    }
    function targetX(m) { return X(m.at + 0.5); }
    function drawMark(g, m) {
      var above = m.side !== 'below';
      var w = Math.max(22, textW(m.label, 12, false, 700) + 16);
      var pill = g.querySelector('.l13-rb-pill'), txt = g.querySelector('.l13-rb-pilltext'), stem = g.querySelector('.l13-rb-stem');
      var py = above ? bandY - 30 : bandY + bandH + 26;
      pill.setAttribute('x', -w / 2); pill.setAttribute('y', py); pill.setAttribute('width', w);
      txt.setAttribute('y', py + 14.2); txt.textContent = m.label;
      stem.setAttribute('y1', above ? py + 20 : bandY + bandH); stem.setAttribute('y2', above ? bandY + bandH : py);
      stem.style.display = m.stem === false ? 'none' : '';
      g.setAttribute('class', 'l13-rb-mark is-' + (m.state || 'default'));
    }

    function render(state, ropts) {
      state = state || {};
      last = state;
      var ms = ropts && ropts.duration !== undefined ? ropts.duration : 450;
      svg.style.setProperty('--t', ms + 'ms');
      var list = [];
      var lv = state.live;
      if (lv) list.push({ rec: recs.live, to: { x: X(lv[0]), w: X(lv[1] + 1) - X(lv[0]) } });
      else list.push({ rec: recs.live, to: { x: recs.live.vals.x + recs.live.vals.w / 2, w: 0 } });
      var sc = state.scan;
      if (sc) list.push({ rec: recs.scan, to: { x: X(sc[0]), w: X(sc[1] + 1) - X(sc[0]) } });
      else list.push({ rec: recs.scan, to: { x: recs.scan.vals.x, w: 0 } });
      if (state.hit !== undefined && state.hit !== null) list.push({ rec: recs.hit, to: { x: X(state.hit) - 1, w: Math.max(4, X(state.hit + 1) - X(state.hit)) + 2 } });
      else list.push({ rec: recs.hit, to: { x: recs.hit.vals.x, w: 0 } });
      var seen = {};
      (state.marks || []).forEach(function (m) {
        seen[m.id] = true;
        var mk = marks[m.id];
        var tx = targetX(m);
        if (!mk) {
          mk = marks[m.id] = { g: markEl(m), rec: null, fresh: true };
          mk.rec = L13.rec({ x: tx }, function (v) { mk.g.setAttribute('transform', 'translate(' + v.x.toFixed(2) + ',0)'); });
        }
        drawMark(mk.g, m);
        mk.g.style.opacity = '';
        mk.g.classList.remove('is-gone');
        list.push({ rec: mk.rec, to: { x: mk.fresh ? tx : tx } });
        if (mk.fresh) { mk.rec.vals.x = tx; mk.rec.apply(mk.rec.vals); mk.fresh = false; }
      });
      Object.keys(marks).forEach(function (id) { if (!seen[id]) marks[id].g.classList.add('is-gone'); });
      note.textContent = state.note || '';
      if (state.note && lv) note.setAttribute('x', ((X(lv[0]) + X(lv[1] + 1)) / 2).toFixed(1)); else note.setAttribute('x', W / 2);
      // a note wider than its band would overprint the band's edges: lift it just above the bar instead
      var noteY = bandY + bandH / 2 + 4.5;
      if (state.note && lv) {
        var bw = X(lv[1] + 1) - X(lv[0]), nw = textW(state.note, 13, false, 700);
        if (bw < nw + 14) {
          var hasAbove = (state.marks || []).some(function (m) { return m.side !== 'below'; });
          var cx = Math.max(pad + nw / 2, Math.min(W - pad - nw / 2, (X(lv[0]) + X(lv[1] + 1)) / 2));
          note.setAttribute('x', cx.toFixed(1));
          noteY = hasAbove ? bandY + bandH + 34 : bandY - 9;
        }
      }
      note.setAttribute('y', noteY.toFixed(1));
      note.style.opacity = state.note ? '' : '0';
      desc.textContent = state.describe || '';
      motion(list, ms);
    }
    var off = V.onResize(container, function () { layout(); if (last) render(last, { duration: 0 }); });
    return { el: svg, render: render, refresh: function () { layout(); if (last) render(last, { duration: 0 }); }, destroy: function () { off(); svg.remove(); }, X: X, width: function () { return W; } };
  };

  /* ------------------------------------------------------------------ strip: candidate answers */
  /* state: { base, size, lo, hi, mid, probe: true|false|null, evaluated: [indexes], done, label }
     Cell i stands for the candidate base + i. Known false left of lo, known true from hi on, unknown between. */
  L13.strip = function (container, options) {
    container = V.$(container);
    var o = Object.assign({ label: 'Candidate answers', maxCell: 46 }, options || {});
    var svg = s('svg', { class: 'l13-strip', role: 'img', 'aria-label': o.label, focusable: 'false' });
    var desc = s('desc', null, ''); svg.appendChild(desc);
    container.appendChild(svg);
    var W = 600, pad = 12, cellY = 46, cellH = 40, H = 146, cells = [], size = 0, base = 0, cw = 30;
    var gCells = s('g'), gLabels = s('g'), gFlags = s('g'), boundary = s('line', { class: 'l13-strip-boundary' }), boundaryText = s('text', { class: 'l13-strip-btext', 'text-anchor': 'middle' }, 'first true');
    [gCells, gLabels, boundary, boundaryText, gFlags].forEach(function (n) { svg.appendChild(n); });
    var flags = {};
    var motion = L13.motion(), last = null;
    function flagEl(name, above) {
      var g = s('g', { class: 'l13-flag is-' + name });
      g.appendChild(s('path', { class: 'l13-flag-arrow', d: above ? 'M0,0 L-6,-9 L6,-9 Z' : 'M0,0 L-6,9 L6,9 Z' }));
      g.appendChild(s('text', { class: 'l13-flag-text', 'text-anchor': 'middle', y: above ? -14 : 22 }, name));
      gFlags.appendChild(g);
      var rec = L13.rec({ x: 0 }, function (v) { g.setAttribute('transform', 'translate(' + v.x.toFixed(2) + ',' + (above ? cellY - 2 : cellY + cellH + 24) + ')'); });
      return { g: g, rec: rec };
    }
    function build(st) {
      size = st.size; base = st.base;
      V.clear(gCells); V.clear(gLabels); cells = [];
      cw = Math.min(o.maxCell, (W - 2 * pad) / size);
      var total = cw * size, x0 = (W - total) / 2;
      for (var i = 0; i < size; i++) {
        var g = s('g', { class: 'l13-cell' });
        var r = s('rect', { x: (x0 + i * cw + 1).toFixed(2), y: cellY, width: Math.max(1, cw - 2).toFixed(2), height: cellH, rx: Math.min(6, cw / 4) });
        var t = s('text', { x: (x0 + i * cw + cw / 2).toFixed(2), y: cellY + cellH / 2 + 5, 'text-anchor': 'middle', class: 'l13-cell-text' });
        g.appendChild(r); g.appendChild(t); gCells.appendChild(g);
        cells.push({ g: g, t: t, x: x0 + i * cw + cw / 2 });
        var every = cw >= 30 ? 1 : cw >= 15 ? 2 : cw >= 9 ? 5 : 10;
        if (i % every === 0 || i === size - 1) {
          var lab = s('text', { x: (x0 + i * cw + cw / 2).toFixed(2), y: cellY + cellH + 16, 'text-anchor': 'middle', class: 'l13-cell-label' }, String(base + i));
          if (i === size - 1 && i % every !== 0 && cw * (i % every) < 22) lab.setAttribute('class', 'l13-cell-label is-hidden');
          gLabels.appendChild(lab);
        }
      }
      ['lo', 'hi', 'mid'].forEach(function (n) { if (!flags[n]) flags[n] = flagEl(n, n === 'mid'); });
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    }
    var builtKey = '';
    function render(st, ropts) {
      last = st;
      W = Math.max(280, container.clientWidth || 600);
      var key = st.size + ':' + st.base + ':' + W;
      var fresh = key !== builtKey;
      if (fresh) { build(st); builtKey = key; }
      var ms = fresh ? 0 : (ropts && ropts.duration !== undefined ? ropts.duration : 450);
      svg.style.setProperty('--t', ms + 'ms');
      var evaluated = {}; (st.evaluated || []).forEach(function (i) { evaluated[i] = true; });
      cells.forEach(function (c, i) {
        var v = i + st.base; /* lo/hi/mid are candidate values; cell i is candidate base + i */
        var known = v < st.lo ? 'f' : v >= st.hi ? 't' : 'q';
        var cls = 'l13-cell is-' + known;
        if (evaluated[i]) cls += ' is-eval';
        if (st.mid !== null && st.mid !== undefined && i === st.mid - st.base) {
          cls += ' is-probe';
          if (st.probe === true) cls += ' is-ptrue'; else if (st.probe === false) cls += ' is-pfalse';
        }
        if (st.done && i === st.lo - st.base) cls += ' is-first';
        c.g.setAttribute('class', cls);
        var text = known === 'f' ? 'F' : known === 't' ? 'T' : '?';
        if (st.mid !== null && st.mid !== undefined && i === st.mid - st.base && st.probe !== null && st.probe !== undefined) text = st.probe ? 'T' : 'F';
        c.t.textContent = cw >= 17 ? text : '';
      });
      var list = [];
      var xOf = function (idx) { return cells[Math.max(0, Math.min(size - 1, idx))].x; };
      list.push({ rec: flags.lo.rec, to: { x: xOf(st.lo - st.base) } });
      list.push({ rec: flags.hi.rec, to: { x: xOf(st.hi - st.base) } });
      var showMid = st.mid !== null && st.mid !== undefined;
      if (showMid) list.push({ rec: flags.mid.rec, to: { x: xOf(st.mid - st.base) } });
      flags.mid.g.style.opacity = showMid ? '' : '0';
      var same = st.lo === st.hi;
      flags.lo.g.classList.toggle('is-merged', same); flags.hi.g.classList.toggle('is-merged', false);
      flags.lo.g.querySelector('text').textContent = same ? 'lo = hi' : 'lo';
      flags.hi.g.style.opacity = same ? '0' : '';
      // boundary line between the last false and the first true when the range has closed
      if (st.done) {
        var bx = cells[st.lo - st.base].x - cw / 2;
        boundary.setAttribute('x1', bx); boundary.setAttribute('x2', bx); boundary.setAttribute('y1', cellY - 8); boundary.setAttribute('y2', cellY + cellH + 8);
        boundaryText.setAttribute('x', bx); boundaryText.setAttribute('y', cellY - 12);
        boundary.style.opacity = ''; boundaryText.style.opacity = '';
      } else { boundary.style.opacity = '0'; boundaryText.style.opacity = '0'; }
      desc.textContent = 'Candidates ' + st.base + ' to ' + (st.base + size - 1) + ': false below ' + st.lo + ', true from ' + st.hi + ', undecided in between.';
      motion(list, ms);
    }
    var off = V.onResize(container, function () { if (last) { builtKey = ''; render(last, { duration: 0 }); } });
    return { el: svg, render: render, destroy: function () { off(); svg.remove(); } };
  };

  L13.restyle = function (steps, fn) { return steps.map(function (st) { return fn(Object.assign({}, st)); }); };
}());
