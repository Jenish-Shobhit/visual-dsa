/* Lesson 11 — Hash tables: custom figures, part 1.
   Shared helpers (V.lessons.l11), the fold figure, the hash-function machine, the bad-vs-good spread histogram,
   the click-the-bucket mini table, and the birthday-paradox simulator + chart.
   Pure logic lives in js/algos/11-hash-tables.js (VDSA.algos.hashing). Started by js/lessons/11-hash-tables.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L11 = V.lessons = V.lessons || {};
  L11 = V.lessons.l11 = V.lessons.l11 || {};
  function H() { return V.algos.hashing; }
  L11.H = H;

  /* ------------------------------------------------------------------ shared helpers */
  L11.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 11] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };
  L11.svg = function (W, Hh, label, maxWidth) {
    var svg = s('svg', { class: 'l11-svg', viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': label });
    if (maxWidth) svg.style.maxWidth = maxWidth + 'px';
    return svg;
  };
  L11.clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  L11.pct = function (x) { return (x * 100 < 10 ? (x * 100).toFixed(1) : Math.round(x * 100)) + '%'; };
  L11.fmtInt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  /* Wrap a flowchart (or anything with render({active})) so a player can light its nodes from step.flow. */
  L11.flowAdapter = function (view) {
    return { highlight: function (id, ctx) { view.render({ active: id || undefined }, { duration: ctx && ctx.duration || 0 }); } };
  };
  /* Tween a text node's integer value. */
  L11.countTo = function (textEl, from, to, ms) {
    if (from === to || !ms) { textEl.textContent = String(to); return null; }
    return V.tween(ms, function (t, e) { textEl.textContent = String(Math.round(from + (to - from) * e)); });
  };

  /* ================================================================== the fold: direct addressing vs hashing */
  L11.foldFigure = function () {
    var fig = V.$('#fig-fold'), stage = fig.querySelector('[data-stage]');
    var W = 420, HH = 470, CELL = 24, P = 26, GX = (W - (P * 10 - 2)) / 2, GY = 40, BX = 20, BP = 38, BY = 350;
    var KEYS = [12, 27, 42, 65, 83, 98], M = 10;
    var svg = L11.svg(W, HH, 'Ninety-nine possible keys shown as a 10 by 10 grid with six stored keys; in hashing mode the keys slide into ten buckets', 560);
    var grid = s('g', { class: 'l11-grid' }), cells = [];
    for (var k = 0; k < 100; k++) {
      var r = Math.floor(k / 10), c = k % 10, used = KEYS.indexOf(k) >= 0;
      var g = s('g', { class: 'l11-cell' + (used ? ' is-used' : ''), transform: 'translate(' + (GX + c * P) + ' ' + (GY + r * P) + ')' },
        s('rect', { width: CELL, height: CELL, rx: 4 }), s('text', { x: CELL / 2, y: CELL / 2 + 3 }, k));
      grid.appendChild(g); cells.push(g);
    }
    svg.appendChild(s('text', { class: 'l11-note', x: W / 2, y: 20, 'text-anchor': 'middle' }, 'every possible key, 0 … 99: one slot each'));
    svg.appendChild(grid);
    var fnPill = s('g', { class: 'l11-fnpill', transform: 'translate(' + W / 2 + ' 318)' },
      s('rect', { x: -78, y: -16, width: 156, height: 32, rx: 16 }), s('text', { x: 0, y: 5, 'text-anchor': 'middle' }, 'h(k) = k mod 10'));
    var buckets = s('g', { class: 'l11-buckets' });
    for (var b = 0; b < M; b++) {
      buckets.appendChild(s('g', { class: 'l11-bucket', transform: 'translate(' + (BX + b * BP) + ' ' + BY + ')' },
        s('rect', { width: Math.max(0, BP - 4), height: 26, rx: 6 }), s('text', { x: (BP - 4) / 2, y: 18, 'text-anchor': 'middle' }, b)));
    }
    var direct = s('g', { class: 'l11-directnote', transform: 'translate(' + W / 2 + ' 372)' },
      s('text', { class: 'l11-big', x: 0, y: 0, 'text-anchor': 'middle' }, '6 of 100 slots used'),
      s('text', { class: 'l11-note', x: 0, y: 22, 'text-anchor': 'middle' }, '94 slots hold nothing'));
    var collide = s('text', { class: 'l11-note l11-collide', x: BX + 2 * BP + (BP - 4) / 2, y: BY + 26 + 24 + 2 * 26 + 16, 'text-anchor': 'middle' }, 'collision');
    svg.appendChild(fnPill); svg.appendChild(buckets); svg.appendChild(direct); svg.appendChild(collide);
    var chips = KEYS.map(function (key, i) {
      var g = s('g', { class: 'l11-chip', 'data-key': key }, s('rect', { x: 0, y: 0, width: CELL, height: CELL, rx: 5 }), s('text', { x: CELL / 2, y: CELL / 2 + 4, 'text-anchor': 'middle' }, key));
      V.place(g, { x: GX + (key % 10) * P, y: GY + Math.floor(key / 10) * P });
      svg.appendChild(g);
      return g;
    });
    stage.appendChild(svg);
    V.place(fnPill, { opacity: 0 }); V.place(buckets, { opacity: 0 }); V.place(collide, { opacity: 0 });

    V.legend(fig.querySelector('[data-legend]'), [{ state: 'key', label: 'Stored key' }, { state: 'error', label: 'Two keys, one bucket' }, { state: 'default', shape: 'outline', label: 'Empty slot' }]);
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { slots: 'Slots allocated', keys: 'Keys stored', empty: 'Slots holding nothing' }, states: { empty: 'muted' } });
    var caption = fig.querySelector('[data-caption]');
    var mode = 'direct';
    function place(target, dur) {
      var perBucket = {};
      chips.forEach(function (g, i) {
        var key = KEYS[i], x, y;
        if (target === 'direct') { x = GX + (key % 10) * P; y = GY + Math.floor(key / 10) * P; }
        else { var bk = key % M; perBucket[bk] = (perBucket[bk] || 0) + 1; x = BX + bk * BP + (BP - 4 - CELL) / 2; y = BY + 34 + (perBucket[bk] - 1) * 28; }
        g.classList.toggle('is-hash', target === 'hash');
        g.classList.toggle('is-collide', target === 'hash' && KEYS.filter(function (o) { return o % M === key % M; }).length > 1);
        V.animate(g, { x: x, y: y }, { duration: dur, delay: dur ? i * 70 : 0, ease: 'inOut' });
      });
      V.animate(grid, { opacity: target === 'direct' ? 1 : 0.28 }, { duration: dur });
      V.animate(fnPill, { opacity: target === 'direct' ? 0 : 1 }, { duration: dur });
      V.animate(buckets, { opacity: target === 'direct' ? 0 : 1 }, { duration: dur });
      V.animate(direct, { opacity: target === 'direct' ? 1 : 0 }, { duration: dur });
      V.animate(collide, { opacity: target === 'direct' ? 0 : 1 }, { duration: dur, delay: dur ? 700 : 0 });
      var usedBuckets = {}; KEYS.forEach(function (k2) { usedBuckets[k2 % M] = true; });
      var nb = Object.keys(usedBuckets).length;
      if (target === 'direct') {
        stats.update({ slots: 100, keys: 6, empty: 94 });
        caption.innerHTML = '<b>Direct addressing:</b> key <em>k</em> lives in slot <em>k</em>, so lookup is one array access. But the array must have a slot for every key that <em>could</em> exist. 94 of these 100 slots hold nothing. With 10-digit phone numbers it would be ten billion slots.';
      } else {
        stats.update({ slots: M, keys: 6, empty: M - nb });
        caption.innerHTML = '<b>Folded with <code>k mod 10</code>:</b> ten buckets instead of a hundred, and every key still knows where to go. The price: <b>12 and 42 both map to bucket 2</b>. Different keys, same bucket. That is a collision.';
      }
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Addressing', value: 'direct', options: [{ value: 'direct', label: 'Direct address' }, { value: 'hash', label: 'Hash: k mod 10' }],
      onChange: function (v) { mode = v; place(v, V.dur(750)); } });
    place('direct', 0);
    return { place: place };
  };

  /* ================================================================== the hash-function machine */
  function machineView(stage) {
    var svg = null, tiles = [], curKey = '', numText, formula, modText, ptr, bucketEls = [], m = 0, hint, lastAcc = 0, tw = null, geom = {}, C = null, last = null;
    function layout(narrow) {
      return narrow
        ? { W: 360, HH: 336, TILE: 30, TH: 44, PITCH: 34, CH: 18, CODE: 10, BX: 10, BOXY: 92, BOXH: 92, NUM: 28, FORM: 12, MODY: 222, MODW: 210, MODF: 14, BUCKY: 276, BH: 34, BF: 12, LBL: 11 }
        : { W: 640, HH: 352, TILE: 46, TH: 56, PITCH: 54, CH: 24, CODE: 12, BX: 58, BOXY: 112, BOXH: 100, NUM: 34, FORM: 14, MODY: 248, MODW: 220, MODF: 17, BUCKY: 296, BH: 38, BF: 14, LBL: 12 };
    }
    function accUpTo(chars, kind, n) {
      var acc = 0;
      for (var i = 0; i < n; i++) acc = kind === 'sum' ? acc + chars[i].code : kind === 'first' ? chars[0].code : acc * 31 + chars[i].code;
      return acc;
    }
    function build(step) {
      V.clear(stage);
      var narrow = stage.clientWidth > 0 && stage.clientWidth < 520;
      C = layout(narrow);
      var W = C.W, n = step.chars.length;
      svg = L11.svg(W, C.HH, 'Hash-function machine' + (step.text ? ' for the text ' + step.text : ''), 780);
      tiles = []; bucketEls = []; m = step.m;
      var x0 = (W - (n * C.PITCH - (C.PITCH - C.TILE))) / 2;
      hint = s('text', { class: 'l11-note', x: W / 2, y: 46, 'text-anchor': 'middle' }, n ? '' : 'Type a word above and press Hash it.');
      svg.appendChild(hint);
      step.chars.forEach(function (c, i) {
        var g = s('g', { class: 'l11-tile' },
          s('rect', { width: C.TILE, height: C.TH, rx: narrow ? 8 : 11 }),
          s('text', { class: 'l11-ch', x: C.TILE / 2, y: C.TH * 0.48, 'text-anchor': 'middle', style: 'font-size:' + C.CH + 'px' }, c.ch === ' ' ? '␣' : c.ch),
          s('text', { class: 'l11-code', x: C.TILE / 2, y: C.TH - (narrow ? 7 : 10), 'text-anchor': 'middle', style: 'font-size:' + C.CODE + 'px' }, c.code));
        V.place(g, { x: x0 + i * C.PITCH, y: 14 });
        g.querySelector('.l11-code').style.opacity = 0;
        svg.appendChild(g); tiles.push(g);
      });
      svg.appendChild(s('text', { class: 'l11-note', x: C.BX, y: C.BOXY - 10, style: 'font-size:' + C.LBL + 'px' }, n ? 'characters and their codes' : ''));
      svg.appendChild(s('g', { class: 'l11-machine' }, s('rect', { x: C.BX, y: C.BOXY, width: Math.max(0, W - 2 * C.BX), height: C.BOXH, rx: 16 }),
        s('text', { class: 'l11-note', x: C.BX + 16, y: C.BOXY + 22, style: 'font-size:' + C.LBL + 'px' }, 'the number so far')));
      numText = s('text', { class: 'l11-num', x: W / 2, y: C.BOXY + C.BOXH * 0.6, 'text-anchor': 'middle', style: 'font-size:' + C.NUM + 'px' }, '0');
      formula = s('text', { class: 'l11-formula', x: W / 2, y: C.BOXY + C.BOXH * 0.86, 'text-anchor': 'middle', style: 'font-size:' + C.FORM + 'px' }, '');
      svg.appendChild(numText); svg.appendChild(formula);
      modText = s('g', { class: 'l11-modbox' }, s('rect', { x: -C.MODW / 2, y: -19, width: C.MODW, height: 38, rx: 19 }), s('text', { x: 0, y: 6, 'text-anchor': 'middle', style: 'font-size:' + C.MODF + 'px' }, ''));
      V.place(modText, { x: W / 2, y: C.MODY, opacity: 0 });
      svg.appendChild(modText);
      var pitch = (W - 2 * (narrow ? 8 : 20)) / m, bw = Math.max(2, Math.min(narrow ? 34 : 46, pitch - (narrow ? 3 : 4)));
      geom = { pitch: pitch, bw: bw, x0: (narrow ? 8 : 20) + (pitch - bw) / 2 };
      for (var b = 0; b < m; b++) {
        var g2 = s('g', { class: 'l11-bucket', transform: 'translate(' + (geom.x0 + b * pitch) + ' ' + C.BUCKY + ')' },
          s('rect', { width: bw, height: C.BH, rx: narrow ? 6 : 8 }), s('text', { x: bw / 2, y: C.BH * 0.63, 'text-anchor': 'middle', style: 'font-size:' + C.BF + 'px' }, b));
        svg.appendChild(g2); bucketEls.push(g2);
      }
      ptr = s('path', { class: 'l11-ptr', d: 'M0 0 L-9 -13 L9 -13 Z' });
      V.place(ptr, { x: geom.x0 + bw / 2, y: C.BUCKY - 3, opacity: 0 });
      svg.appendChild(ptr);
      stage.appendChild(svg);
      lastAcc = 0; curKey = step.text + '|' + step.fn + '|' + step.m + '|' + (narrow ? 'n' : 'w');
    }
    function render(step, ctx) {
      last = step;
      var narrowNow = stage.clientWidth > 0 && stage.clientWidth < 520;
      var key = step.text + '|' + step.fn + '|' + step.m + '|' + (narrowNow ? 'n' : 'w');
      if (!svg || key !== curKey || !ctx.prev) build(step);
      var d = ctx.duration;
      svg.style.setProperty('--t', d + 'ms');
      var n = step.chars.length, active = step.active === undefined ? -1 : step.active;
      tiles.forEach(function (g, i) {
        var done = i < step.upto, isActive = i === active, ignored = step.fn === 'first' && i > 0 && step.upto > 0;
        g.setAttribute('class', 'l11-tile' + (isActive ? ' is-active' : done ? ' is-done' : '') + (ignored ? ' is-ignored' : ''));
        V.animate(g.querySelector('.l11-code'), { opacity: done || isActive ? 1 : 0 }, { duration: d });
        V.animate(g, { y: isActive ? 8 : 14 }, { duration: d, ease: 'out' });
      });
      var acc = step.acc || 0;
      if (tw) tw.cancel();
      var from = lastAcc; lastAcc = acc;
      if (acc === 0 && !n) numText.textContent = '0';
      else { tw = L11.countTo(numText, from, acc, d ? Math.min(d, 500) : 0); if (!tw) numText.textContent = String(acc); }
      var f = '';
      if (step.kind === 'char' && n) {
        var before = accUpTo(step.chars, step.fn, step.upto - 1), code = step.chars[step.upto - 1].code;
        f = step.fn === 'first' ? 'code of the first letter = ' + code : step.fn === 'sum' ? before + ' + ' + code : (step.upto === 1 ? '0 × 31 + ' + code : before + ' × 31 + ' + code);
      } else if (step.kind === 'mod') f = step.fn === 'sum' ? 'sum of all codes' : step.fn === 'first' ? 'code of the first letter' : 'polynomial hash, base 31';
      else if (step.kind === 'text') f = 'nothing added yet';
      formula.textContent = f;
      numText.style.opacity = n ? 1 : 0.35;
      var isMod = step.kind === 'mod';
      modText.querySelector('text').textContent = isMod ? step.acc + ' mod ' + step.m + ' = ' + step.bucket : '';
      V.animate(modText, { opacity: isMod ? 1 : 0 }, { duration: d });
      bucketEls.forEach(function (g, b) { g.setAttribute('class', 'l11-bucket' + (isMod && b === step.bucket ? ' is-hit' : '')); });
      if (isMod) V.animate(ptr, { x: geom.x0 + step.bucket * geom.pitch + geom.bw / 2, opacity: 1 }, { duration: d, ease: 'out' });
      else V.animate(ptr, { opacity: 0 }, { duration: d });
    }
    V.onResize(stage, function () { if (last && svg) { var nn = stage.clientWidth > 0 && stage.clientWidth < 520; if (curKey.slice(-1) !== (nn ? 'n' : 'w')) render(last, { prev: null, duration: 0 }); } });
    return render;
  }

  L11.machineFigure = function () {
    var fig = V.$('#fig-machine'), A = H();
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Character being added' }, { state: 'visited', label: 'Already in the number' }, { state: 'muted', label: 'Ignored by this function' }, { state: 'found', label: 'Chosen bucket' }]);
    var fn = 'poly', m = 11, text = 'cat';
    var render = machineView(fig.querySelector('[data-stage]'));
    var player = V.player({ root: fig, steps: A.machine(text, fn, m), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1100, label: 'Hash function machine controls' });
    function go(play) { player.setSteps(A.machine(text, fn, m)); if (play) player.play(); }
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your word (up to 10 characters)', value: text, applyLabel: 'Hash it', placeholder: 'type a word',
      parse: function (t) {
        var v = String(t);
        if (!v.length) return { error: 'Type at least one character.' };
        if (v.length > 10) return { error: 'Please use at most 10 characters so the numbers stay exact.' };
        if (!/^[\x20-\x7e]+$/.test(v)) return { error: 'Please use plain keyboard characters (letters, digits, punctuation).' };
        return { values: v };
      },
      presets: ['cat', 'act', 'tac', 'banana', 'Hello', 'hello'].map(function (w) { return { label: w, value: w }; }),
      onApply: function (v) { text = v; go(true); }
    });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Hash function', value: fn, options: [{ value: 'first', label: 'First letter' }, { value: 'sum', label: 'Sum of codes' }, { value: 'poly', label: 'Polynomial ×31' }],
      onChange: function (v) { fn = v; go(true); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Buckets m', min: 5, max: 16, value: m, onInput: function (v) { m = v; go(false); player.goto(player.steps.length - 1); } });
    return player;
  };

  /* ================================================================== bad hash vs good hash: the spread histogram */
  L11.spreadFigure = function () {
    var fig = V.$('#fig-spread'), stage = fig.querySelector('[data-stage]'), A = H();
    var M = 13, W = 640, HH = 316, BASE = 262, L = 24, PITCH = (W - 2 * L) / M, TW = Math.min(44, PITCH - 8), narrow = false;
    function dims() { narrow = stage.clientWidth > 0 && stage.clientWidth < 520; W = narrow ? 380 : 640; L = narrow ? 12 : 24; PITCH = (W - 2 * L) / M; TW = Math.max(2, Math.min(44, PITCH - (narrow ? 5 : 8))); }
    var setName = 'usernames', fnName = 'first';
    var svg, tiles = [], counts = [], ideal, idealText, keys = [], maxAll = 1, tileH = 10;
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { max: 'Fullest bucket', empty: 'Empty buckets', avg: 'Average per bucket' }, states: { max: 'error', empty: 'muted' } });
    var caption = fig.querySelector('[data-caption]');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'One key' }, { state: 'error', label: 'Crowded bucket (over 2× the average)' }]);
    var NAMES = { usernames: 'usernames', words: 'words', anagrams: 'anagrams' };
    var FNOTE = {
      first: 'Only the first character counts, so keys that begin alike all land together.',
      sum: 'Adding character codes ignores order, so anagrams (and many similar words) share a total.',
      poly: 'Multiplying by 31 before adding gives every position its own weight, so order and every character matter.'
    };
    function build() {
      V.clear(stage); dims();
      keys = A.KEYSETS[setName];
      maxAll = 1; ['first', 'sum', 'poly'].forEach(function (f) { maxAll = Math.max(maxAll, A.distribution(keys, M, f).max); });
      tileH = L11.clamp(Math.floor(200 / maxAll), 4, 17);
      BASE = 34 + tileH * maxAll + 10; HH = BASE + 44;
      svg = L11.svg(W, HH, 'Histogram of ' + keys.length + ' ' + NAMES[setName] + ' in ' + M + ' buckets', 780);
      var axis = s('line', { class: 'l11-axis', x1: L - 6, x2: W - L + 6, y1: BASE + 2, y2: BASE + 2 });
      svg.appendChild(axis);
      counts = []; for (var b = 0; b < M; b++) {
        svg.appendChild(s('text', { class: 'l11-idx', x: L + b * PITCH + PITCH / 2, y: BASE + 22, 'text-anchor': 'middle' }, b));
        var c = s('text', { class: 'l11-count', x: L + b * PITCH + PITCH / 2, y: BASE - 6, 'text-anchor': 'middle' }, '');
        svg.appendChild(c); counts.push(c);
      }
      ideal = s('line', { class: 'l11-ideal', x1: L - 6, x2: W - L + 6, y1: 0, y2: 0 });
      idealText = s('text', { class: 'l11-note', x: L - 6, y: 16 }, 'dashed line: an even spread (keys ÷ buckets)');
      svg.appendChild(ideal); svg.appendChild(idealText);
      tiles = keys.map(function (k) {
        var g = s('g', { class: 'l11-keytile' }, s('title', null, k), s('rect', { width: Math.max(0, TW), height: Math.max(1, tileH - 1.5), rx: Math.min(3, tileH / 3) }));
        V.place(g, { x: L + PITCH / 2 - TW / 2, y: BASE - 4 });
        svg.appendChild(g); return g;
      });
      stage.appendChild(svg);
    }
    function apply(animate) {
      var d = animate ? V.dur(700) : 0, dist = A.distribution(keys, M, fnName), rank = {};
      var avg = keys.length / M, idealY = BASE - avg * tileH;
      V.animate(ideal, { attr: { y1: idealY, y2: idealY } }, { duration: d });
      keys.forEach(function (k, i) {
        var b = dist.bucketOf[i]; rank[b] = (rank[b] || 0) + 1;
        var hot = dist.counts[b] > 2 * avg;
        tiles[i].setAttribute('class', 'l11-keytile' + (hot ? ' is-hot' : ''));
        V.animate(tiles[i], { x: L + b * PITCH + PITCH / 2 - TW / 2, y: BASE - rank[b] * tileH }, { duration: d, delay: d ? (i % 12) * 25 : 0, ease: 'inOut' });
      });
      counts.forEach(function (c, b) {
        c.textContent = dist.counts[b] ? dist.counts[b] : '';
        V.animate(c, { attr: { y: BASE - dist.counts[b] * tileH - 6 } }, { duration: d, ease: 'inOut' });
      });
      stats.update({ max: dist.max, empty: dist.empty + ' of ' + M, avg: avg.toFixed(1) });
      var worst = dist.counts.indexOf(dist.max);
      caption.innerHTML = '<b>' + { first: 'First letter', sum: 'Sum of codes', poly: 'Polynomial ×31' }[fnName] + ' on ' + keys.length + ' ' + NAMES[setName] + ':</b> ' + FNOTE[fnName] +
        ' The fullest bucket (' + worst + ') holds <b>' + dist.max + '</b> keys against an average of ' + avg.toFixed(1) + (dist.max > 2 * avg ? ', so lookups there are ' + Math.round(dist.max / avg) + '× slower than they should be.' : ': close to even.');
    }
    V.segmented(fig.querySelector('[data-keys]'), { label: 'Key set', value: setName, options: [{ value: 'usernames', label: 'user01…user36' }, { value: 'words', label: 'Words' }, { value: 'anagrams', label: 'Anagrams' }],
      onChange: function (v) { setName = v; build(); apply(false); } });
    V.segmented(fig.querySelector('[data-fn]'), { label: 'Hash function', value: fnName, options: [{ value: 'first', label: 'First letter' }, { value: 'sum', label: 'Sum of codes' }, { value: 'poly', label: 'Polynomial ×31' }],
      onChange: function (v) { fnName = v; apply(true); } });
    build(); apply(false);
    V.onResize(stage, function () { var nn = stage.clientWidth > 0 && stage.clientWidth < 520; if (nn !== narrow) { build(); apply(false); } });
  };

  /* ================================================================== click the bucket */
  L11.bucketClick = function () {
    var fig = V.$('#fig-bucketclick'), stage = fig.querySelector('[data-stage]');
    var W = 380, HH = 150, P = 52, X0 = 8;
    var existing = { 0: [14], 1: [22], 3: [10], 5: [19], 6: [6] };
    var svg = L11.svg(W, HH, 'Seven buckets numbered 0 to 6. Bucket 0 holds 14, bucket 1 holds 22, bucket 3 holds 10, bucket 5 holds 19 and bucket 6 holds 6.', 560);
    svg.appendChild(s('text', { class: 'l11-note', x: 14, y: 20 }, 'h(k) = k mod 7'));
    for (var b = 0; b < 7; b++) {
      var g = s('g', { class: 'l11-bucket l11-pick', 'data-id': 'b' + b, 'data-label': 'Bucket ' + b + (existing[b] ? ', holds ' + existing[b].join(', ') : ', empty'), transform: 'translate(' + (X0 + b * P) + ' 34)' },
        s('rect', { width: Math.max(0, P - 6), height: 46, rx: 9 }), s('text', { class: 'l11-bidx', x: (P - 6) / 2, y: 17, 'text-anchor': 'middle' }, b));
      if (existing[b]) g.appendChild(s('text', { class: 'l11-bval', x: (P - 6) / 2, y: 36, 'text-anchor': 'middle' }, existing[b].join(',')));
      svg.appendChild(g);
    }
    svg.appendChild(s('text', { class: 'l11-note', x: W / 2, y: 118, 'text-anchor': 'middle' }, 'New key: 38. Click the bucket it belongs in.'));
    stage.appendChild(svg);
    V.clickQuiz(stage, {
      el: '#quiz-click', id: 'l11-click-bucket',
      question: 'Click the bucket that key 38 hashes to.',
      check: function (id) {
        var got = +id.slice(1);
        if (got === 3) return true;
        return { correct: false, message: 'Divide 38 by 7 and keep the remainder: 38 = 5 × 7 + 3, so the bucket is 3, not ' + got + '.' };
      },
      right: '38 = 5 × 7 + 3, so 38 mod 7 = 3. Bucket 3 already holds 10, so this is a collision: with chaining, 38 joins 10 in bucket 3’s chain.'
    });
  };

  /* ================================================================== birthday paradox: the simulator */
  L11.birthdayFigure = function () {
    var fig = V.$('#fig-birthday'), stage = fig.querySelector('[data-stage]'), A = H();
    var m = 365, W = 520, PAD = 12, TOP = 40;
    var svg, cells = [], dot, run = [], taken = {}, over = false, busy = false, gen = 0, runs = [];
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { thrown: 'Keys thrown', load: 'Table full', prob: 'Chance of a collision by now', avg: 'Your runs (average)' }, states: { prob: 'error' } });
    var caption = fig.querySelector('[data-caption]');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'Empty slot' }, { state: 'active', label: 'Filled by a key' }, { state: 'error', label: 'First collision' }]);
    function layout() {
      var cols = m <= 10 ? 10 : m <= 100 ? 20 : m <= 365 ? 30 : 40, rows = Math.ceil(m / cols), pitch = (W - 2 * PAD) / cols;
      return { cols: cols, rows: rows, pitch: pitch, cell: Math.max(3, pitch - (pitch > 16 ? 3 : 2)), H: TOP + rows * pitch + PAD };
    }
    var lay;
    function build() {
      V.clear(stage); lay = layout();
      svg = L11.svg(W, lay.H, 'A grid of ' + m + ' empty slots; thrown keys fill slots until one lands on a filled slot', 620);
      cells = [];
      for (var i = 0; i < m; i++) {
        var r = Math.floor(i / lay.cols), c = i % lay.cols;
        var el = s('rect', { class: 'l11-bslot', x: PAD + c * lay.pitch, y: TOP + r * lay.pitch, width: lay.cell, height: lay.cell, rx: Math.min(4, lay.cell / 4) });
        svg.appendChild(el); cells.push(el);
      }
      dot = s('circle', { class: 'l11-throw', r: Math.max(4, Math.min(8, lay.cell / 1.6)), cx: W / 2, cy: 16 });
      V.place(dot, { opacity: 0 });
      svg.appendChild(dot);
      stage.appendChild(svg);
    }
    function center(i) { var r = Math.floor(i / lay.cols), c = i % lay.cols; return { x: PAD + c * lay.pitch + lay.cell / 2, y: TOP + r * lay.pitch + lay.cell / 2 }; }
    var expected = function () { return Math.sqrt(Math.PI * m / 2) + 2 / 3; };
    function updateStats() {
      var n = run.length;
      stats.update({ thrown: n, load: L11.pct(Math.min(1, (over ? n - 1 : n) / m)), prob: n ? L11.pct(A.birthdayProb(n, m)) : '0%',
        avg: runs.length ? (runs.reduce(function (a, b2) { return a + b2; }, 0) / runs.length).toFixed(1) + ' (' + runs.length + ' run' + (runs.length === 1 ? '' : 's') + ')' : '–' });
    }
    function intro() {
      caption.innerHTML = 'A hash table with <b>' + L11.fmtInt(m) + '</b> slots. Each throw is a key with a perfectly random hash. Press <b>Throw one key</b>, or run until the first collision. On average it takes about <b>' + expected().toFixed(1) + '</b> throws.';
    }
    function throwOne(fast) {
      if (over) return Promise.resolve();
      var slot = Math.floor(Math.random() * m), c = center(slot), d = fast ? 0 : V.dur(m <= 100 ? 320 : 200);
      run.push(slot);
      var hit = taken[slot] !== undefined;
      dot.setAttribute('cx', W / 2); dot.setAttribute('cy', 16);
      V.place(dot, { opacity: 1 });
      var p = V.animate(dot, { attr: { cx: c.x, cy: c.y } }, { duration: d, ease: 'in' });
      return p.then(function () {
        V.place(dot, { opacity: 0 });
        if (hit) {
          over = true; runs.push(run.length);
          cells[slot].setAttribute('class', 'l11-bslot is-hit');
          cells[taken[slot]].setAttribute('class', 'l11-bslot is-used is-first');
          var n = run.length;
          caption.innerHTML = '<b>Collision on throw ' + n + '!</b> Key ' + n + ' hashed to a slot that already held key ' + (taken[slot] + 1) + '. The table is only <b>' + L11.pct((n - 1) / m) + '</b> full. The chance of at least one collision by now was ' + L11.pct(A.birthdayProb(n, m)) + '.';
        } else {
          taken[slot] = run.length - 1;
          cells[slot].setAttribute('class', 'l11-bslot is-used is-new');
          caption.innerHTML = 'Key ' + run.length + ' lands in slot ' + slot + ', which was empty. ' + (run.length === 1 ? 'Nothing can collide yet.' : 'Chance that some pair has collided so far: ' + L11.pct(A.birthdayProb(run.length, m)) + '.');
        }
        updateStats();
      });
    }
    function reset() { gen++; run = []; taken = {}; over = false; busy = false; build(); intro(); updateStats(); setButtons(); }
    var btns = fig.querySelector('[data-btns]'), bOne, bRun, bNew;
    function setButtons() { bOne.disabled = over || busy; bRun.disabled = over || busy; bNew.disabled = false; bRun.textContent = 'Throw until the first collision'; }
    bOne = h('button', { type: 'button', class: 'btn btn--sm btn--primary', onclick: function () { if (busy) return; busy = true; setButtons(); throwOne().then(function () { busy = false; setButtons(); }); } }, 'Throw one key');
    bRun = h('button', { type: 'button', class: 'btn btn--sm', onclick: function () {
      if (busy || over) return;
      busy = true; setButtons(); var g = gen;
      (function loop() {
        if (g !== gen || over) { busy = false; setButtons(); return; }
        throwOne().then(function () { if (over || g !== gen) { busy = false; setButtons(); } else loop(); });
      }());
    } }, 'Throw until the first collision');
    bNew = h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: reset }, 'New run');
    btns.appendChild(bOne); btns.appendChild(bRun); btns.appendChild(bNew);
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Slots', value: m, options: [{ value: 10, label: '10' }, { value: 100, label: '100' }, { value: 365, label: '365' }, { value: 1000, label: '1,000' }],
      onChange: function (v) { m = v; runs = []; reset(); } });
    build(); intro(); updateStats(); setButtons();
  };

  /* ================================================================== birthday paradox: the probability chart */
  L11.birthdayChart = function () {
    var fig = V.$('#fig-birthday-chart'), stage = fig.querySelector('[data-stage]'), A = H();
    var m = 365, sim = null, seed = 20260929;
    var chart = V.views.chart(stage, { type: 'scatter', label: 'Probability of a collision against the number of keys', height: 330, format: function (v, axis) { return axis === 'y' ? Math.round(v * 100) + '%' : L11.fmtInt(v); }, valueFormat: function (v, series) { return series && series.id === 'exact' || series === 'exact' ? L11.pct(v) : L11.pct(v); } });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n50: '50% chance at n =', n99: '99% chance at n =', load: 'Table full at 50%' }, states: { n50: 'active', n99: 'error' } });
    function xmax() { return Math.min(m + 1, Math.ceil(3.5 * Math.sqrt(m))); }
    function firstAt(p) { for (var n = 1; n <= m + 1; n++) if (A.birthdayProb(n, m) >= p) return n; return m + 1; }
    function draw(dur) {
      var xm = xmax(), n50 = firstAt(0.5), n99 = firstAt(0.99);
      var series = [{ id: 'exact', label: 'exact probability', fn: function (n) { return A.birthdayProb(Math.round(n), m); }, domain: [0, xm], samples: Math.min(xm + 1, 120), state: 'active' }];
      if (sim) series.push({ id: 'sim', label: 'simulated runs', points: sim, state: 'done', markers: true });
      chart.render({ x: { label: 'keys inserted, n', min: 0, max: xm }, y: { label: 'chance of a collision', min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] }, series: series,
        highlight: { series: 'exact', x: n50, y: A.birthdayProb(n50, m), label: n50 + ' keys: ' + L11.pct(A.birthdayProb(n50, m)) } }, { duration: dur === undefined ? 600 : dur });
      stats.update({ n50: L11.fmtInt(n50), n99: L11.fmtInt(n99), load: L11.pct(n50 / m) });
    }
    function simulate() {
      seed += 7919;
      var trials = 2000, hist = A.birthdayHistogram(m, trials, V.rng(seed)), xm = xmax(), pts = [], cum = 0, next = 1;
      var step = Math.max(1, Math.round(xm / 14));
      var keysSorted = Object.keys(hist.counts).map(Number).sort(function (a, b) { return a - b; }), ki = 0;
      for (var n = 1; n <= xm; n++) {
        while (ki < keysSorted.length && keysSorted[ki] <= n) { cum += hist.counts[keysSorted[ki]]; ki++; }
        if (n % step === 0) pts.push({ x: n, y: cum / trials, id: 's' + n });
      }
      sim = pts;
      draw(700);
    }
    var btns = fig.querySelector('[data-btns]');
    btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--primary', onclick: simulate }, 'Run 2,000 experiments'));
    btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: function () { sim = null; draw(400); } }, 'Clear dots'));
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Slots', value: m, options: [{ value: 10, label: '10' }, { value: 100, label: '100' }, { value: 365, label: '365' }, { value: 1000, label: '1,000' }, { value: 1000000, label: '1,000,000' }],
      onChange: function (v) { m = v; sim = null; draw(700); } });
    draw(0);
    simulate();
  };
}());
