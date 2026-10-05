/* Lesson 07 — Strings, two pointers & windows: helpers and the mechanism figures.
   Generators: js/algos/07-strings-and-two-pointers.js (VDSA.algos.strings).
   Labs: 07-strings-and-two-pointers-labs.js. Boot, hero, checks, summary: 07-strings-and-two-pointers.js.
   Heavy figures start lazily (L7.whenNear) so a lesson with many figures stays light. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L7 = (V.lessons = V.lessons || {}).l07 = (V.lessons || {}).l07 || {};
  function A() { return V.algos.strings; }
  L7.A = A;

  /* ------------------------------------------------------------------ helpers */
  L7.whenNear = function (el, fn) {
    el = V.$(el);
    if (!el) return;
    function go() { try { fn(el); } catch (e) { console.error('[lesson 07] figure failed to start', e); } }
    if (!('IntersectionObserver' in window)) { go(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      if (done) return;
      if (entries.some(function (e) { return e.isIntersecting; })) { done = true; io.disconnect(); go(); }
    }, { rootMargin: '700px 0px 700px 0px' });
    io.observe(el);
  };
  L7.fmt = function (v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); };
  /* text input parser for the string labs: code points, not UTF-16 units, so an emoji is one box */
  L7.textParser = function (min, max, what) {
    return function (text) {
      var n = Array.from(text).length;
      if (n < min || n > max) return { values: null, error: (min === 0 ? 'Type up to ' : 'Type ' + min + ' to ') + max + ' characters' + (what ? ' ' + what : '') + '. You typed ' + n + '.' };
      return { values: text };
    };
  };
  L7.seedSorted = function (n, seed, lo, hi) {
    return V.presets.sorted(n, { min: lo === undefined ? 1 : lo, max: hi === undefined ? 30 : hi, seed: seed });
  };
  /* single-row array snapshot from a generator step, with a fixed map from step fields */
  L7.plain = function (st) { return { items: st.items, pointers: st.pointers || [], regions: st.regions || [] }; };

  var BLANK = { wall: true };   // the lower half of the grid is not a pair: drawn as dark filler

  /* ------------------------------------------------------------------ the pair grid (rows i, columns j, cell = a[i] + a[j]) */
  /* step: a twoSum step (lo, hi, path, found, kind). Cells below the diagonal are blank. */
  L7.pairGridState = function (a, st, o) {
    o = o || {};
    var n = a.length, seen = {}, cells = [];
    (st.path || []).forEach(function (p) { seen[p[0] + ',' + p[1]] = true; });
    var isSum = st.kind === 'sum';
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        if (j <= i) { row.push(BLANK); continue; }
        var elim = i < st.lo || j > st.hi, state = 'default';
        var cur = isSum && i === st.lo && j === st.hi;
        if (st.found && st.found[0] === i && st.found[1] === j) state = 'found';
        else if (cur) state = 'active';
        else if (seen[i + ',' + j]) state = 'visited';
        else if (elim) state = 'muted';
        row.push({ value: a[i] + a[j], state: state });
      }
      cells.push(row);
    }
    var live = st.kind !== 'none' && n > 1 && st.lo < st.hi;
    return {
      rows: n, cols: n, cells: cells, rowHeaders: a.map(String), colHeaders: a.map(String), corner: 'i\\j',
      highlightRow: live && o.bands !== false ? { index: st.lo, state: 'active' } : null,
      highlightCol: live && o.bands !== false ? { index: st.hi, state: 'active' } : null,
      cursor: live && o.cursor !== false ? { cell: [st.lo, st.hi], state: st.kind === 'sum' ? 'active' : 'compare' } : null
    };
  };
  /* brute-force grid frame: k pairs examined in row order */
  L7.bruteFrame = function (a, trace, k) {
    var n = a.length, seen = {}, cells = [], last = k > 0 ? trace.pairs[k - 1] : null;
    for (var t = 0; t < k; t++) seen[trace.pairs[t][0] + ',' + trace.pairs[t][1]] = true;
    var done = trace.found && k === trace.pairs.length;
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        if (j <= i) { row.push(BLANK); continue; }
        var st = 'default';
        if (done && trace.found[0] === i && trace.found[1] === j) st = 'found';
        else if (last && last[0] === i && last[1] === j) st = 'active';
        else if (seen[i + ',' + j]) st = 'visited';
        row.push({ value: a[i] + a[j], state: st });
      }
      cells.push(row);
    }
    return { rows: n, cols: n, cells: cells, rowHeaders: a.map(String), colHeaders: a.map(String), corner: 'i\\j', cursor: last && !done ? { cell: [last[0], last[1]], state: 'active' } : null };
  };
  /* two-pointer grid frame after k checks: cells ruled out by sorted order are muted */
  L7.pointerFrame = function (a, trace, k) {
    var n = a.length, lo = 0, hi = n - 1, seen = {}, cells = [], last = null;
    for (var t = 0; t < k; t++) {
      var p = trace.pairs[t]; seen[p[0] + ',' + p[1]] = true; last = p;
      if (p[2] < (trace.target === undefined ? 0 : trace.target)) lo = p[0] + 1; else if (p[2] > trace.target) hi = p[1] - 1;
    }
    var done = trace.found && k === trace.pairs.length;
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        if (j <= i) { row.push(BLANK); continue; }
        var st = 'default';
        if (done && trace.found[0] === i && trace.found[1] === j) st = 'found';
        else if (last && last[0] === i && last[1] === j && !done) st = 'active';
        else if (seen[i + ',' + j]) st = 'visited';
        else if (i < lo || j > hi) st = 'muted';
        row.push({ value: a[i] + a[j], state: st });
      }
      cells.push(row);
    }
    return { rows: n, cols: n, cells: cells, rowHeaders: a.map(String), colHeaders: a.map(String), corner: 'i\\j', cursor: last && !done ? { cell: [last[0], last[1]], state: 'active' } : null };
  };

  /* ================================================================== a string is an array of characters */
  L7.charsFigure = function () {
    var fig = V.$('#fig-chars'), stage = fig.querySelector('[data-stage]'), table = fig.querySelector('[data-table]');
    var selected = -1, info = [];
    var view = V.views.array(stage, { mode: 'boxes', cellSize: 54, label: 'A string drawn as an array of characters, with each character code underneath', cellAspect: 1 });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { chars: 'Characters (Python len)', units: 'JavaScript .length', bytes: 'UTF-8 bytes' }, states: { chars: 'done', units: 'compare', bytes: 'active' } });
    function draw() {
      var items = info.map(function (c, k) {
        var it = { id: 'k' + k, value: c.ch, label: String(c.codePoint), state: k === selected ? 'active' : 'default' };
        if (c.ch === ' ') it.text = '␣';
        return it;
      });
      // phones: ten boxes in one row would be too narrow for a six-digit code point, so wrap to rows of five
      var narrow = stage.clientWidth - 28 < 460 && items.length > 5, rows = [];
      if (narrow) for (var r = 0; r < items.length; r += 5) rows.push({ id: 'r' + r / 5, items: items.slice(r, r + 5).map(function (it, q) { return Object.assign({}, it, { index: q }); }), length: Math.min(5, items.length - r), indexStart: r });
      view.render(narrow ? { rows: rows } : { items: items }, { duration: 260 });
      var units = 0, bytes = 0;
      info.forEach(function (c) { units += c.units.length; bytes += c.bytes; });
      stats.update({ chars: info.length, units: units, bytes: bytes });
      var body = table.querySelector('tbody');
      V.clear(body);
      info.forEach(function (c, k) {
        var tr = h('tr', { class: k === selected ? 'is-selected' : null, 'data-k': k, tabindex: '0', 'aria-label': 'Character ' + (c.ch === ' ' ? 'space' : c.ch) + ' at index ' + k },
          h('td', { class: 'num' }, k), h('th', { scope: 'row', class: 'l07-ch' }, c.ch === ' ' ? '␣' : c.ch), h('td', { class: 'num' }, c.codePoint + ' (' + c.hex + ')'),
          h('td', null, c.units.map(function (u) { return u.toString(16).toUpperCase().padStart(4, '0'); }).join(' + ')), h('td', { class: 'num' }, c.bytes));
        tr.addEventListener('click', function () { pick(k); });
        tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } });
        body.appendChild(tr);
      });
      if (!info.length) body.appendChild(h('tr', null, h('td', { colspan: 5, class: 'muted' }, 'The empty string: zero characters, length 0.')));
    }
    function pick(k) { selected = selected === k ? -1 : k; draw(); }
    view.on('click', function (e) { pick(e.index); });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Type a string (0 to 10 characters)', value: 'naïve 😀', placeholder: 'e.g. café',
      parse: L7.textParser(0, 10),
      presets: [{ label: 'code', value: 'code' }, { label: 'café', value: 'café' }, { label: 'naïve 😀', value: 'naïve 😀' }, { label: 'A😀B', value: 'A😀B' }, { label: 'empty', value: '' }],
      hint: 'Click a box or a table row to link them. Boxes show each character’s code point.',
      onApply: function (text) { selected = -1; info = A().charInfo(text); draw(); }
    });
    info = A().charInfo('naïve 😀');
    draw();
  };

  /* ================================================================== s += c in a loop, versus a builder */
  L7.concatFigure = function () {
    var fig = V.$('#fig-concat'), mode = 'naive', n = 8;
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 38, showIndices: false, label: 'Building a string one character at a time' });
    function steps() { var st = A().concatSteps(n, mode); view.reset(); view.prepare(st.map(function (x) { return { rows: x.rows }; })); return st; }
    var st = steps();
    var player = V.player({
      root: fig, steps: st, render: function (step, ctx) { view.render({ rows: step.rows }, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { writes: 'Characters written', length: 'Length of s' }, counterStates: { writes: 'swap', length: 'done' },
      baseStepMs: 780, label: 'String building controls'
    });
    function reload() { player.setSteps(steps()); }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Method', value: mode, options: [{ value: 'naive', label: 's = s + c' }, { value: 'builder', label: 'Builder / join' }], onChange: function (v) { mode = v; reload(); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Length n', min: 3, max: A().LIMITS.concat, value: n, onChange: function (v) { n = v; reload(); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'swap', label: 'Copied' }, { state: 'key', label: 'New character' }, { state: 'default', label: 'Sitting in memory' }]);
  };

  /* ================================================================== palindrome, converging */
  L7.palindromeFigure = function () {
    var fig = V.$('#fig-pal'), word = 'racecar';
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 54, label: 'Palindrome check with two pointers' });
    function gen() { var st = A().palindrome(word); view.reset(); view.prepare(st); return st; }
    var player = V.player({
      root: fig, steps: gen(), render: function (step, ctx) { view.render(L7.plain(step), { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { comparisons: 'Comparisons' }, counterStates: { comparisons: 'compare' },
      baseStepMs: 1000, label: 'Palindrome controls'
    });
    player.addCheckpoint(function (st) {
      var cmps = [];
      st.forEach(function (x, k) { if (x.kind === 'cmp') cmps.push(k); });
      var c = cmps.length > 1 ? cmps[1] : cmps[0];
      return c === undefined ? -1 : c + 1;
    }, function (c) {
      var p = c.prev;
      var l = p.l, r = p.r, ch = function (i) { return p.items[i].value; };
      var yes = c.step.kind === 'match';
      return {
        question: 'The pointers stand on <code>s[' + l + '] = ' + ch(l) + '</code> and <code>s[' + r + '] = ' + ch(r) + '</code>. What happens next?',
        options: ['They match: both turn green and the pointers move inward', 'They differ: the check stops here with “not a palindrome”'],
        answer: yes ? 0 : 1,
        explain: yes
          ? ['Right. ' + ch(l) + ' = ' + ch(r) + ', so this mirror pair is fine and the rest of the word still has to be checked.', 'They are equal, so nothing is wrong yet. One difference would stop the check, but this pair has none.']
          : ['They are different, so the word cannot be a palindrome. Mirror pairs must be equal.', 'Right. ' + ch(l) + ' ≠ ' + ch(r) + ' is enough to answer “no” immediately, without looking at the middle.']
      };
    }, { id: 'l07-pal-next' });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Word', value: word,
      options: [{ value: 'racecar', label: 'racecar' }, { value: 'noon', label: 'noon' }, { value: 'abca', label: 'abca' }, { value: 'x', label: 'x' }],
      onChange: function (v) { word = v; player.setSteps(gen()); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Pair being compared' }, { state: 'done', label: 'Matched, settled' }, { state: 'error', label: 'Mismatch' }]);
  };

  /* ================================================================== two-sum on a sorted array + the pair grid */
  L7.pairsFigure = function () {
    var fig = V.$('#fig-pairs'), a = [1, 3, 5, 8, 10, 13, 16], target = 18, rng = V.rng(70);
    var arr = V.views.array(fig.querySelector('[data-array]'), { mode: 'boxes', cellSize: 46, label: 'Sorted array with two pointers, lo and hi' });
    var grid = V.views.grid(fig.querySelector('[data-grid]'), { mode: 'table', cellSize: 40, label: 'Pair grid: every pair of indices, one cell each' });
    var player;
    function gen() { var st = A().twoSum(a, target); arr.reset(); arr.prepare(st); return st; }
    function render(step, ctx) {
      arr.render(L7.plain(step), { duration: ctx.duration });
      grid.render(L7.pairGridState(a, step), { duration: ctx.duration });
    }
    player = V.player({
      root: fig, steps: gen(), render: render, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { sums: 'Sums checked', ruledOut: 'Pairs ruled out unseen' }, counterStates: { sums: 'compare', ruledOut: 'muted' },
      baseStepMs: 1500, label: 'Two-sum controls'
    });
    player.addCheckpoint(function (st) {
      var sums = [];
      st.forEach(function (x, k) { if (x.kind === 'sum') sums.push(k); });
      var pick = sums.length > 1 && st[sums[1] + 1] && st[sums[1] + 1].kind !== 'found' ? sums[1] : sums[0];
      return pick === undefined ? -1 : pick + 1;
    }, function (c) {
      var p = c.prev, out = c.step.kind;
      var rel = p.sum === target ? '=' : p.sum < target ? '<' : '>';
      var ans = out === 'lo' ? 0 : out === 'hi' ? 1 : 2;
      return {
        question: 'The sum is <b>' + p.sum + '</b> and the target is <b>' + target + '</b>. What does the algorithm do next?',
        options: ['Move <b>lo</b> right', 'Move <b>hi</b> left', 'Stop: the pair is found'],
        answer: ans,
        explain: [
          ans === 0 ? 'Right. ' + p.sum + ' ' + rel + ' ' + target + ': too small. The only way to make the sum bigger is a bigger left value, and sorted order says that lies to the right of lo.' : 'lo moves right only when the sum is too small. Here ' + p.sum + ' ' + rel + ' ' + target + '.',
          ans === 1 ? 'Right. ' + p.sum + ' ' + rel + ' ' + target + ': too big. The only way to make the sum smaller is a smaller right value, and sorted order says that lies to the left of hi.' : 'hi moves left only when the sum is too big. Here ' + p.sum + ' ' + rel + ' ' + target + '.',
          ans === 2 ? 'Right. The sum equals the target, so we are done.' : 'Not yet: ' + p.sum + ' ≠ ' + target + ', so the search goes on.'
        ]
      };
    }, { id: 'l07-pairs-move' });
    function reload() { player.setSteps(gen()); }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Target', min: 4, max: 32, value: target, onChange: function (v) { target = v; reload(); } });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () {
      a = V.presets.sorted(7, { min: 1, max: 20, rng: rng });
      reload();
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Pair being summed' }, { state: 'visited', label: 'Checked' }, { state: 'muted', label: 'Ruled out, never checked' }, { state: 'found', label: 'Answer' }]);
  };

  /* ================================================================== the race: brute force vs two pointers on the pair grid */
  L7.raceFigure = function () {
    var fig = V.$('#fig-race'), n = 10, seed = 5, kind = 'late';
    var lanes = ['brute', 'pointers'].map(function (name) {
      var host = fig.querySelector('[data-lane="' + name + '"] [data-grid]');
      var view = V.views.grid(host, { mode: 'table', cellSize: 28, showValues: false, label: name === 'brute' ? 'Brute force checking pairs in row order' : 'Two pointers walking the pair grid' });
      var stats = V.stats(fig.querySelector('[data-lane="' + name + '"] [data-stats]'), { labels: { checks: 'Pairs checked' }, states: { checks: 'compare' } });
      return { name: name, view: view, stats: stats, status: fig.querySelector('[data-lane="' + name + '"] [data-status]'), total: 0, trace: null };
    });
    var a, target, T, player;
    function build() {
      a = V.presets.sorted(n, { min: 1, max: 40, seed: seed });
      if (kind === 'early') target = a[0] + a[1];
      else if (kind === 'late') target = a[Math.min(Math.floor(n * 0.6), n - 3)] + a[n - 2];   // two distinct indices, so a pair really exists, deep in the grid
      else target = a[n - 1] * 2 + 1;                                           // larger than every possible sum
      var b = A().bruteTrace(a, target), t = A().twoSumTrace(a, target);
      t.target = target; b.target = target;
      lanes[0].trace = b; lanes[1].trace = t;
      lanes.forEach(function (l) { l.total = l.trace.pairs.length; });
      T = Math.max(lanes[0].total, lanes[1].total);
      var st = [];
      for (var k = 0; k <= T; k++) st.push({ t: k, caption: caption(k) });   // real text per step, so the caption box is sized for the longest one
      return st;
    }
    function caption(k) {
      var b = lanes[0], p = lanes[1], name = kind === 'absent' ? 'no pair' : 'the pair ' + a[b.trace.found ? b.trace.found[0] : 0] + ' + ' + a[b.trace.found ? b.trace.found[1] : 0];
      if (k === 0) return 'Same ' + n + ' sorted numbers, target <b>' + target + '</b>' + (kind === 'absent' ? ' (no pair adds up to it)' : '') + '. One tick = one pair examined. Brute force walks the grid row by row; two pointers walk one staircase and rule out the rest by sorted order.';
      if (k >= T) {
        var fastest = b.total === p.total ? 'They tie.' : b.total < p.total ? '<b>Brute force wins this one</b>: the pair sits near the start of its row-by-row search, while two pointers still had to walk in from both ends.' : 'Two pointers examined <b>' + p.total + '</b> pair' + (p.total === 1 ? '' : 's') + ' against brute force’s <b>' + b.total + '</b>.';
        return 'Finished. ' + fastest + ' Worst case for two pointers is n − 1 = ' + (n - 1) + '; for brute force it is n(n − 1)/2 = ' + (n * (n - 1) / 2) + '.';
      }
      var fin = lanes.filter(function (l) { return k >= l.total; }).map(function (l) { return l.name === 'brute' ? 'Brute force' : 'Two pointers'; });
      return 'Tick ' + k + ' of ' + T + '. ' + (fin.length ? fin.join(' and ') + ' finished.' : 'Both are still searching.');
    }
    function render(step, ctx) {
      lanes.forEach(function (l) {
        var k = Math.min(step.t, l.total);
        var state = l.name === 'brute' ? L7.bruteFrame(a, l.trace, k) : L7.pointerFrame(a, l.trace, k);
        l.view.render(state, { duration: ctx.duration });
        l.stats.update({ checks: k });
        var done = k >= l.total;
        l.status.textContent = done ? (l.trace.found ? 'found ' + a[l.trace.found[0]] + ' + ' + a[l.trace.found[1]] + ' = ' + target : 'no pair') : 'searching…';
        l.status.setAttribute('data-done', done ? '1' : '0');
      });
    }
    var st = build();
    player = V.player({
      root: fig, steps: st, render: render, caption: '[data-caption]', baseStepMs: 520, label: 'Race controls',
      speeds: [0.5, 1, 2, 4, 8], speed: 1
    });
    function reload() { st = build(); player.setSteps(st); fig.querySelector('[data-caption]').innerHTML = caption(0); }
    reload();
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Where is the pair?', value: kind,
      options: [{ value: 'early', label: 'First pair' }, { value: 'late', label: 'Deep pair' }, { value: 'absent', label: 'No pair' }],
      onChange: function (v) { kind = v; reload(); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Size n', min: 5, max: A().LIMITS.grid, value: n, onChange: function (v) { n = v; reload(); } });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { seed = seed * 7 + 3; reload(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Pair just checked' }, { state: 'visited', label: 'Checked' }, { state: 'muted', label: 'Ruled out unseen' }, { state: 'found', label: 'Answer' }]);
  };

  /* ================================================================== fixed window: slide vs recompute */
  L7.fixedFigure = function () {
    var fig = V.$('#fig-fixed'), vals = [4, 2, 7, 1, 8, 3, 9, 5], k = 3, mode = 'slide';
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 52, label: 'Sliding window of size k over an array' });
    function gen() { var st = A().windowFixed(vals, k, { recompute: mode === 'recompute' }); view.reset(); view.prepare(st.map(function (x) { return { rows: x.rows }; })); return st; }
    var player = V.player({
      root: fig, steps: gen(), render: function (step, ctx) { view.render({ rows: step.rows }, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { ops: 'Additions and subtractions' }, counterStates: { ops: 'swap' }, baseStepMs: 1150, label: 'Fixed window controls'
    });
    function reload() { player.setSteps(gen()); }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Method', value: mode, options: [{ value: 'slide', label: 'Slide the window' }, { value: 'recompute', label: 'Re-add every window' }], onChange: function (v) { mode = v; reload(); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Window size k', min: 1, max: 6, value: k, onChange: function (v) { k = v; reload(); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Entering (+)' }, { state: 'compare', label: 'Leaving (−)' }, { state: 'visited', label: 'Inside the window' }, { state: 'done', label: 'Best window so far' }]);
  };

  /* ================================================================== prefix sums as bar differences (custom SVG view) */
  function prefixView(stage) {
    var PITCH = 54, BOX = 46, PADL = 46, PADR = 30, BOXTOP = 28, BASE = 290, HMAX = 158, BW = 20;
    var svg = null, vals = null, valsKey = '', n = 0, bars = [], plabels = [], pidx = [], boxes = [], band, level, gap, sumLabel, maxP = 1, bracket;
    function bx(j) { return PADL + j * PITCH; }
    function by(v) { return BASE - (maxP ? HMAX * v / maxP : 0); }
    function build(step) {
      V.clear(stage); vals = step.values; valsKey = String(vals); n = vals.length;
      var avail = stage.clientWidth || 440, tight = avail < 480;
      PADL = tight ? 30 : 46; PADR = tight ? 26 : 30;
      PITCH = tight ? Math.max(30, Math.min(54, Math.floor((avail - PADL - PADR) / (n + 0.2)))) : 54; BOX = Math.min(46, PITCH - 6);
      var P = step.P; maxP = Math.max.apply(null, P.concat([1]));
      var W = PADL + n * PITCH + PADR, H = BASE + 46;
      svg = s('svg', { class: 'l07-pfx', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Values with a bar of prefix sums under the boundaries between them' });
      svg.style.minWidth = Math.min(W, tight ? Math.max(avail - 4, 300) : 440) + 'px'; svg.style.maxWidth = (W * 1.3) + 'px';
      band = s('rect', { class: 'band', x: 0, y: BOXTOP - 8, width: 0, height: BASE - BOXTOP + 8, rx: 10 });
      svg.appendChild(band);
      svg.appendChild(s('line', { class: 'axis', x1: PADL - 14, x2: W - PADR + 10, y1: BASE, y2: BASE }));
      svg.appendChild(s('text', { class: 'rowlbl', x: 6, y: BOXTOP + BOX / 2 + 4 }, 'a'));
      svg.appendChild(s('text', { class: 'rowlbl', x: 6, y: BASE - 8 }, 'P'));
      boxes = vals.map(function (v, k) {
        var g = s('g', { class: 'box', transform: 'translate(' + (bx(k) + (PITCH - BOX) / 2) + ' ' + BOXTOP + ')' },
          s('rect', { width: BOX, height: BOX, rx: 10 }), s('text', { x: BOX / 2, y: BOX / 2 + 1 }, v), s('text', { class: 'idx', x: BOX / 2, y: -7 }, k));
        svg.appendChild(g); return g;
      });
      bars = []; plabels = []; pidx = [];
      for (var j = 0; j <= n; j++) {
        var r = s('rect', { class: 'bar', x: bx(j) - BW / 2, y: BASE, width: BW, height: 0, rx: 4 });
        var t = s('text', { class: 'plabel', x: bx(j), y: BASE - 6 }, P[j]);
        var ix = s('text', { class: 'pidx', x: bx(j), y: BASE + 17 }, 'P[' + j + ']');
        svg.appendChild(r); svg.appendChild(t); svg.appendChild(ix);
        bars.push(r); plabels.push(t); pidx.push(ix);
      }
      gap = s('rect', { class: 'gap', x: 0, y: BASE, width: BW, height: 0, rx: 4 });
      level = s('line', { class: 'level', x1: 0, x2: 0, y1: BASE, y2: BASE });
      sumLabel = s('text', { class: 'sumlbl', x: 0, y: 0 }, '');
      bracket = s('path', { class: 'bracket', d: '' });
      svg.appendChild(level); svg.appendChild(gap); svg.appendChild(sumLabel); svg.appendChild(bracket);
      stage.appendChild(svg);
    }
    return function render(step, ctx) {
      if (!svg || String(step.values) !== valsKey) build(step);
      var d = ctx.duration, P = step.P, l = step.l, r = step.r, query = step.kind === 'queryL' || step.kind === 'queryR' || step.kind === 'diff';
      svg.style.setProperty('--t', d + 'ms');
      for (var j = 0; j <= n; j++) {
        var shown = j < step.built;
        var st = 'default';
        if (step.active === j) st = 'active';
        if (query && step.focusL && j === l) st = 'key';
        if (query && step.focusR && j === r + 1) st = 'compare';
        bars[j].setAttribute('class', 'bar is-' + st);
        var y = by(P[j]);
        V.animate(bars[j], { attr: { y: shown ? y : BASE, height: shown ? BASE - y : 0 } }, { duration: d, ease: 'out' });
        plabels[j].style.opacity = shown ? '1' : '0';
        V.animate(plabels[j], { attr: { y: shown ? y - 7 : BASE - 6 } }, { duration: d, ease: 'out' });
        pidx[j].style.opacity = shown ? '1' : '.25';
      }
      boxes.forEach(function (g, k) {
        var st = 'default';
        if (query && step.focusL && k >= l && k <= r) st = 'active';
        if (!query && step.kind === 'build' && step.active === k + 1) st = 'active';
        if (!query && step.kind === 'build' && k < step.active - 1) st = 'visited';
        if (step.kind === 'init') st = 'default';
        g.setAttribute('class', 'box is-' + st);
      });
      var showBand = query && step.focusL;
      V.animate(band, { attr: { x: bx(l) + 3, width: showBand ? (r + 1 - l) * PITCH - 6 : 0 } }, { duration: d, ease: 'out' });
      band.style.opacity = showBand ? '1' : '0';
      // level line: from bar l across to bar r+1 at the height of P[l]
      var showLevel = query && step.focusL;
      level.style.opacity = showLevel ? '1' : '0';
      V.animate(level, { attr: { x1: bx(l), x2: step.focusR ? bx(r + 1) : bx(l), y1: by(P[l]), y2: by(P[l]) } }, { duration: d, ease: 'out' });
      // the difference: the top part of bar r+1 above the level
      var showGap = query && step.focusR;
      gap.style.opacity = showGap ? '1' : '0';
      var yTop = by(P[r + 1]), yLvl = by(P[l]);
      V.animate(gap, { attr: { x: bx(r + 1) - BW / 2, y: yTop, height: Math.max(0, yLvl - yTop) } }, { duration: d, ease: 'out' });
      sumLabel.textContent = step.answer !== null ? 'P[' + (r + 1) + '] − P[' + l + '] = ' + step.answer : '';
      sumLabel.style.opacity = step.answer !== null ? '1' : '0';
      var cx = Math.max(84, Math.min((bx(l) + bx(r + 1)) / 2, bx(n) - 40));
      sumLabel.setAttribute('x', cx); sumLabel.setAttribute('y', BOXTOP + BOX + 44); sumLabel.setAttribute('text-anchor', 'middle');
    };
  }
  L7.prefixFigure = function () {
    var fig = V.$('#fig-prefix'), vals = [3, 1, 4, 1, 5, 9, 2, 6], l = 2, r = 5;
    var render = prefixView(fig.querySelector('[data-stage]'));
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().CODE.prefix, default: 'js', maxHeight: 300 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    function gen() { return A().prefixSums(vals, l, r); }
    var player = V.player({
      root: fig, steps: gen(), render: render, code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { built: 'Additions to build P', queryOps: 'Subtractions for the query' }, counterStates: { built: 'swap', queryOps: 'found' },
      baseStepMs: 1050, label: 'Prefix sums controls'
    });
    player.addCheckpoint(function (st) { return st.findIndex(function (x) { return x.kind === 'diff'; }); }, function (c) {
      var p = c.prev, ans = c.step.answer, cand = [ans, p.P[p.r + 1] + p.P[p.l], p.P[p.r + 1], ans + p.values[Math.min(p.r + 1, p.values.length - 1)] + 1];
      var seen = {}, opts = cand.filter(function (x) { if (seen[x]) return false; seen[x] = true; return true; });
      var order = opts.slice().sort(function (x, y) { return x - y; });
      return {
        question: 'We hold <code>P[' + (p.r + 1) + '] = ' + p.P[p.r + 1] + '</code> and <code>P[' + p.l + '] = ' + p.P[p.l] + '</code>. What is the sum of <code>a[' + p.l + '..' + p.r + ']</code>?',
        options: order.map(String), answer: order.indexOf(ans),
        explain: order.map(function (x) {
          if (x === ans) return 'Right: ' + p.P[p.r + 1] + ' − ' + p.P[p.l] + ' = ' + ans + '. Everything before index ' + p.l + ' is in both bars and cancels.';
          if (x === p.P[p.r + 1] + p.P[p.l]) return 'Adding the two bars counts the first ' + p.l + ' values twice. The query subtracts.';
          if (x === p.P[p.r + 1]) return p.P[p.r + 1] + ' is the sum of everything up to index ' + p.r + ', including the part before index ' + p.l + ' that the query does not want.';
          return 'Subtract the two bar heights: ' + p.P[p.r + 1] + ' − ' + p.P[p.l] + '.';
        })
      };
    }, { id: 'l07-prefix-query' });
    var lo, hi;
    function reload(fromQuery) {
      var st = gen();
      player.setSteps(st, fromQuery ? { index: st.length - 3 } : undefined);
    }
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Values (1 to 10 numbers, 0 to 9 each)', value: vals, parse: { min: 0, max: 9, maxCount: 10, minCount: 1, integers: true },
      presets: [{ label: 'Example', value: [3, 1, 4, 1, 5, 9, 2, 6] }, { label: 'All ones', value: [1, 1, 1, 1, 1, 1] }, { label: 'Random', value: function () { return V.presets.random(8, { min: 0, max: 9 }); } }, { label: 'One value', value: [7] }],
      onApply: function (v) {
        vals = v; l = Math.min(l, v.length - 1); r = Math.max(l, Math.min(r, v.length - 1));
        lo.input.max = hi.input.max = String(v.length - 1); lo.set(l); hi.set(r); reload(false);
      }
    });
    lo = V.slider(fig.querySelector('[data-lo]'), { label: 'Range start l', min: 0, max: vals.length - 1, value: l, onInput: function (v) {
      l = v; if (r < l) { r = l; hi.set(r); } reload(true);
    } });
    hi = V.slider(fig.querySelector('[data-hi]'), { label: 'Range end r', min: 0, max: vals.length - 1, value: r, onInput: function (v) {
      r = v; if (l > r) { l = r; lo.set(l); } reload(true);
    } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Being added / the range' }, { state: 'key', label: 'P[l]: before the range' }, { state: 'compare', label: 'P[r + 1]: through the range' }, { state: 'found', label: 'Their difference' }]);
  };

  /* ================================================================== anagram: two frequency tables as bars */
  L7.anagramFigure = function () {
    var fig = V.$('#fig-anagram'), w1 = 'listen', w2 = 'silent';
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'bar', height: 250, label: 'Letter counts of two words as paired bars' });
    function toState(st) {
      var maxc = 1;
      st.letters.forEach(function (c) { maxc = Math.max(maxc, st.ca[c] || 0, st.cb[c] || 0); });
      var q1 = '“' + st.a + '”', q2 = '“' + st.b + '”';
      var ymax = Math.max(2, maxc + 1), ystep = Math.ceil(ymax / 5), yticks = [];   // counts are whole numbers: integer ticks only
      for (var tv = 0; tv <= ymax; tv += ystep) yticks.push(tv);
      var state = {
        categories: st.letters.length ? st.letters : ['–'], y: { label: 'count', min: 0, max: ymax, ticks: yticks },
        series: [{ id: 'a', label: q1, values: (st.letters.length ? st.letters : ['–']).map(function (c) { return st.ca[c] || 0; }), color: 0 },
          { id: 'b', label: q2, values: (st.letters.length ? st.letters : ['–']).map(function (c) { return st.cb[c] || 0; }), color: 1 }]
      };
      if (st.last) state.highlight = { category: st.last, series: st.lastSeries };
      else if (st.kind === 'compare' && st.diff.length) state.highlight = { category: st.diff[0] };
      return state;
    }
    var player;
    function gen() { return A().anagram(w1, w2); }
    var first = gen();
    player = V.player({
      root: fig, steps: first, render: function (step, ctx) { chart.render(toState(step), { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { counted: 'Letters tallied' }, counterStates: { counted: 'active' },
      baseStepMs: 900, label: 'Anagram controls'
    });
    function parse(text) {
      var t = text.toLowerCase().replace(/\s+/g, '');
      if (t.length > 10) return { error: 'Use at most 10 letters per word.' };
      if (!/^[a-z]*$/.test(t)) return { error: 'Letters a to z only, please.' };
      return { values: t };
    }
    function apply() {
      var a = parse(f1.value), b = parse(f2.value);
      if (a.error || b.error) { err.textContent = a.error || b.error; return; }
      err.textContent = ''; w1 = a.values; w2 = b.values; player.setSteps(gen());
    }
    var f1 = V.$('[data-w1]', fig), f2 = V.$('[data-w2]', fig), err = V.$('[data-err]', fig);
    f1.value = w1; f2.value = w2;
    V.$('[data-apply]', fig).addEventListener('click', apply);
    [f1, f2].forEach(function (f) { f.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); apply(); } }); });
    V.$$('[data-preset]', fig).forEach(function (b) {
      b.addEventListener('click', function () { var p = b.getAttribute('data-preset').split('|'); f1.value = p[0]; f2.value = p[1]; apply(); });
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'First word' }, { state: 'compare', label: 'Second word' }]);
  };

  /* ================================================================== cost chart */
  L7.costFigure = function () {
    var fig = V.$('#fig-cost'), prob = 'twosum', n = 60, logY = false;
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 320, label: 'Operations against input size, brute force and the pointer technique' });
    var note = fig.querySelector('[data-note]');
    var P = {
      twosum: { title: 'Two-sum on a sorted array', slow: { label: 'brute force · all pairs', fn: function (x) { return x * (x - 1) / 2; } }, fast: { label: 'two pointers', fn: function (x) { return Math.max(0, x - 1); } }, real: function (m) { var o = A().ops.twoSum(m); return [o.brute, o.pointers]; }, unit: 'sums computed in the worst case, with the target absent', big: 'n(n − 1)/2 versus n − 1' },
      substr: { title: 'Longest substring without repeats', slow: { label: 'brute force · every start', fn: function (x) { return x * (x + 1) / 2; } }, fast: { label: 'sliding window', fn: function (x) { return x; } }, real: function (m) { var o = A().ops.longest(m); return [o.brute, o.window]; }, unit: 'characters looked at, all characters different', big: 'n(n + 1)/2 versus about n' },
      range: { title: 'n range-sum queries', slow: { label: 'add each range again', fn: function (x) { return x * x; } }, fast: { label: 'prefix sums', fn: function (x) { return 2 * x; } }, real: function (m) { var o = A().ops.range(m); return [o.brute, o.prefix]; }, unit: 'additions and subtractions, n queries each covering the whole array', big: 'n × n versus n + n' },
      concat: { title: 'Building a string of n characters', slow: { label: 's = s + c in a loop', fn: function (x) { return x * (x + 1) / 2; } }, fast: { label: 'builder / join', fn: function (x) { return 2 * x; } }, real: function (m) { var o = A().ops.concat(m); return [o.naive, o.builder]; }, unit: 'characters written', big: 'n(n + 1)/2 versus 2n' }
    };
    function draw(dur) {
      var p = P[prob], real = p.real(n);
      var top = Math.max(p.slow.fn(200), 10);
      chart.render({
        x: { label: 'input size n', min: 1, max: 200 },
        y: logY ? { label: 'operations (log scale)', scale: 'log', min: 1, max: 100000 } : { label: 'operations', min: 0, max: top },
        series: [{ id: 'slow', label: p.slow.label, fn: p.slow.fn, state: 'error' }, { id: 'fast', label: p.fast.label, fn: p.fast.fn, state: 'done' }],
        highlight: [{ series: 'slow', x: n, y: real[0], label: real[0].toLocaleString('en-US') }, { series: 'fast', x: n, y: Math.max(real[1], logY ? 1 : 0), label: real[1].toLocaleString('en-US') }]
      }, { duration: dur === undefined ? 700 : dur });
      note.innerHTML = '<b>' + p.title + ', n = ' + n + ':</b> ' + real[0].toLocaleString('en-US') + ' versus ' + real[1].toLocaleString('en-US') + ' ' + p.unit + ', counted by running the code. Formula: ' + p.big + '.' + (real[1] ? ' That is <b>' + (real[0] / real[1]).toFixed(1).replace(/\.0$/, '') + '×</b> more work.' : '');
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Problem', value: prob,
      options: [{ value: 'twosum', label: 'Two-sum' }, { value: 'substr', label: 'Window' }, { value: 'range', label: 'Prefix' }, { value: 'concat', label: 'Concat' }],
      onChange: function (v) { prob = v; draw(); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Input size n', min: 4, max: 200, value: n, onInput: function (v) { n = v; draw(0); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: false, onChange: function (c) { logY = c; draw(900); } });
    draw(700);
  };

  /* ================================================================== "which pattern?" decision flowchart */
  L7.chooserFigure = function () {
    var fig = V.$('#fig-choose');
    var spec = {
      nodes: [
        { id: 'q1', type: 'decision', text: 'Keep only some of\nthe items, in place?', col: 0, row: 0, maxWidth: 200 },
        { id: 'q2', type: 'decision', text: 'Sorted input, or a\npair / mirror question?', col: 0, row: 1, maxWidth: 200 },
        { id: 'q3', type: 'decision', text: 'Is the answer one\ncontiguous piece?', col: 0, row: 2, maxWidth: 200 },
        { id: 'q4', type: 'decision', text: 'Many range-sum\nqueries, same array?', col: 0, row: 3, maxWidth: 200 },
        { id: 'q5', type: 'decision', text: 'Is the piece a\nfixed size k?', col: 0, row: 4, maxWidth: 200 },
        { id: 'rw', type: 'end', text: 'Read / write\npointers', col: 1, row: 0 },
        { id: 'conv', type: 'end', text: 'Converging\npointers', col: 1, row: 1 },
        { id: 'other', type: 'end', text: 'Counts / hash map,\nor another lesson', col: 1, row: 2 },
        { id: 'prefix', type: 'end', text: 'Prefix sums', col: 1, row: 3 },
        { id: 'fixed', type: 'end', text: 'Fixed window', col: 1, row: 4 },
        { id: 'var', type: 'end', text: 'Variable window\n(expand, shrink)', col: 0, row: 5 }
      ],
      edges: [
        { from: 'q1', to: 'rw', label: 'yes' },
        { from: 'q1', to: 'q2', label: 'no' },
        { from: 'q2', to: 'conv', label: 'yes' },
        { from: 'q2', to: 'q3', label: 'no' },
        { from: 'q3', to: 'q4', label: 'yes' },
        { from: 'q3', to: 'other', label: 'no' },
        { from: 'q4', to: 'prefix', label: 'yes' },
        { from: 'q4', to: 'q5', label: 'no' },
        { from: 'q5', to: 'fixed', label: 'yes' },
        { from: 'q5', to: 'var', label: 'no' }
      ]
    };
    var stage = fig.querySelector('[data-stage]'), answer = fig.querySelector('[data-answer]');
    var view = V.views.flowchart(stage, spec, { interactive: true, label: 'Which pattern should I use? Click the answers.', narrowWidth: 520 });
    var NOTE = {
      prefix: '<b>Prefix sums.</b> Build P once in n steps, then every range sum is one subtraction. Example: total sales between two dates, asked thousands of times.',
      fixed: '<b>Fixed window.</b> Slide a window of k values, adding the entering value and dropping the leaving one. Example: the best 7-day stretch.',
      var: '<b>Variable window.</b> Expand r until a rule breaks, then shrink l until it holds again. Example: the longest substring without a repeated character.',
      conv: '<b>Converging pointers.</b> Start at both ends and move inward, each move justified by sorted order or symmetry. Example: palindromes, two-sum on sorted data.',
      rw: '<b>Read / write pointers.</b> One pointer reads every item, a second marks where the next kept item goes. Example: removing duplicates in place.',
      other: '<b>Something else.</b> Need to look values up by content, not position? Reach for counts or a hash map (lesson 11 on hashing).'
    };
    var path, taken;
    function reset() { path = ['q1']; taken = {}; view.render({ active: 'q1' }, { duration: 0 }); answer.innerHTML = 'Click <b>yes</b> or <b>no</b> on the diagram to answer each question about your problem; the path ends at the pattern that fits.'; }
    view.on('choose', function (e) {
      path.push(e.to); taken[e.node + '->' + e.to] = 'path';
      view.render({ active: e.to, visited: path.slice(0, -1), edgeStates: taken }, { duration: 500 });
      answer.innerHTML = NOTE[e.to] || 'Next question…';
    });
    fig.querySelector('[data-restart]').addEventListener('click', reset);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Where you are' }, { state: 'visited', label: 'Questions answered' }, { state: 'path', shape: 'line', label: 'Your path' }]);
    reset();
  };
}());
