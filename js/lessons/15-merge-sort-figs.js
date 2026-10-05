/* Lesson 15 — the mechanism figures: the scale of n log n vs n², levels split and merge, the merge game, ties and
   stability, the recursion tree with work per level, bottom-up merge sort, and the master-theorem explorer.
   Generators: js/algos/15-merge-sort.js (VDSA.algos.mergesort). Helpers: js/lessons/15-merge-sort-views.js.
   Every figure is started lazily by js/lessons/15-merge-sort.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L15 = V.lessons.l15;
  function M() { return V.algos.mergesort; }
  var commas = L15.commas;

  /* ================================================================== the problem: how much work? */
  var GIGA = 1e9;
  function timeText(sec) {
    if (sec < 1e-3) return Math.max(1, Math.round(sec * 1e6)) + ' microseconds';
    if (sec < 1) return Math.round(sec * 1e3) + ' milliseconds';
    if (sec < 60) return (sec < 10 ? Math.round(sec * 10) / 10 : Math.round(sec)) + ' seconds';
    if (sec < 3600) return Math.round(sec / 60) + ' minutes';
    if (sec < 86400) return Math.round(sec / 3600 * 10) / 10 + ' hours';
    if (sec < 86400 * 365) return Math.round(sec / 86400) + ' days';
    var y = sec / (86400 * 365);
    return (y < 10 ? Math.round(y * 10) / 10 : commas(y)) + ' years';
  }
  L15.timeText = timeText;
  L15.initScale = function () {
    var fig = V.$('#fig-scale');
    var rows = { ins: fig.querySelector('[data-row="ins"]'), mrg: fig.querySelector('[data-row="mrg"]') };
    var readout = fig.querySelector('[data-readout]');
    var kase = 'random', pos = 40;
    function nOf(p) { return Math.round(Math.pow(10, p / 10)); }
    function ins(n) { return kase === 'sorted' ? n - 1 : kase === 'reversed' ? n * (n - 1) / 2 : n * (n - 1) / 4; }
    function mrg(n) { return n * Math.log2(n); }
    function draw() {
      var n = nOf(pos), a = ins(n), b = mrg(n), mx = Math.max(a, b);
      [['ins', a], ['mrg', b]].forEach(function (p) {
        var row = rows[p[0]];
        var frac = p[1] / mx;
        row.querySelector('[data-bar]').style.width = 'max(5px, ' + (frac * 100).toFixed(3) + '%)';
        row.querySelector('[data-num]').innerHTML = '<b>' + commas(p[1]) + '</b> <i>comparisons</i><span>' + timeText(p[1] / GIGA) + '</span>';
      });
      var who = kase === 'sorted'
        ? 'On sorted input insertion sort only checks each value once: <b>' + commas(a) + '</b> comparisons, against merge sort’s <b>' + commas(b) + '</b>. Merge sort cannot notice that the input is sorted, but you cannot count on sorted input either.'
        : 'For <b>' + commas(n) + '</b> values, insertion sort needs about <b>' + commas(a) + '</b> comparisons, roughly ' + timeText(a / GIGA) + ' at a billion per second. Merge sort needs about <b>' + commas(b) + '</b>: ' + timeText(b / GIGA) + '. That is <b>' + commas(a / b) + '×</b> less work.';
      readout.innerHTML = who;
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Number of values n', min: 10, max: 70, step: 1, value: pos, format: function (p) { return commas(nOf(p)); }, onInput: function (p) { pos = p; draw(); } });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Input order', value: kase,
      options: [{ value: 'random', label: 'Random' }, { value: 'reversed', label: 'Reversed' }, { value: 'sorted', label: 'Sorted' }],
      onChange: function (v) { kase = v; draw(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Insertion sort' }, { state: 'done', label: 'Merge sort' }]);
    rows.ins.querySelector('[data-bar]').setAttribute('data-kind', 'ins');
    rows.mrg.querySelector('[data-bar]').setAttribute('data-kind', 'mrg');
    draw();
  };

  /* ================================================================== divide: split and merge level by level */
  L15.initLevels = function () {
    var fig = V.$('#fig-levels');
    var n = 8, rng = V.rng(151), values = [5, 2, 8, 4, 1, 6, 3, 7];
    function gen() { return M().mergeLevels(values); }
    var made = L15.arrayFigure(fig, gen(), { view: { cellSize: 48 }, baseStepMs: 1500, label: 'Split and merge controls' });
    function reload() { made.reload(gen()); }
    function fresh() { values = V.presets.random(n, { min: 1, max: 30, unique: true, rng: rng }); reload(); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Values', value: '8',
      options: [{ value: '5', label: '5' }, { value: '8', label: '8' }, { value: '11', label: '11' }, { value: '16', label: '16' }],
      onChange: function (v) { n = +v; if (n === 8) values = [5, 2, 8, 4, 1, 6, 3, 7]; else values = V.presets.random(n, { min: 1, max: 30, unique: true, rng: rng }); reload(); }
    });
    fig.querySelector('[data-shuffle]').addEventListener('click', fresh);
    V.legend(fig.querySelector('[data-legend]'), [L15.LEGEND.fresh, L15.LEGEND.run, { state: 'swap', label: 'Just merged' }, L15.LEGEND.done]);
    return made.player;
  };

  /* ================================================================== merge: the "which goes next?" game */
  function sortedUnique(rng, count, lo, hi, pool) {
    var vals = V.shuffle(V.range(hi - lo + 1).map(function (i) { return i + lo; }), rng).slice(0, count);
    return vals.sort(function (a, b) { return a - b; });
  }
  L15.initMergeGame = function () {
    var fig = V.$('#fig-merge'), stage = fig.querySelector('[data-stage]'), msg = fig.querySelector('[data-msg]');
    var view = V.views.array(stage, { mode: 'boxes', cellSize: 50, showIndices: false, label: 'Merging two sorted runs' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { comparisons: 'Comparisons', written: 'Values written', mistakes: 'Wrong clicks' }, states: { comparisons: 'compare', written: 'swap', mistakes: 'error' } });
    var rng = V.rng(1515), preset = 'random', runs, steps, k, mistakes, timer = null, busy = false;
    var PRESETS = {
      random: function () {
        var a = sortedUnique(rng, rng.int(3, 5), 1, 24), b = sortedUnique(rng, rng.int(3, 5), 1, 24);
        return [a, b];
      },
      early: function () { return [sortedUnique(rng, 4, 12, 24), sortedUnique(rng, rng.int(2, 3), 1, 10)]; },
      inter: function () { return [[1, 3, 5, 7], [2, 4, 6, 8]]; },
      ties: function () { return [[{ value: 2 }, { value: 4, label: 'a' }, { value: 6, label: 'a' }], [{ value: 4, label: 'b' }, { value: 5 }, { value: 6, label: 'b' }]]; }
    };
    function load() {
      runs = PRESETS[preset]();
      steps = M().mergeRuns(runs[0], runs[1]);
      view.reset(); view.prepare(steps);
      restart(true);
    }
    function show(step, dur, text, state) {
      view.render(step, { duration: dur === undefined ? 520 : dur });
      stats.update({ comparisons: step.counters.comparisons, written: step.counters.written, mistakes: mistakes });
      if (text !== undefined) { msg.innerHTML = text; if (state) msg.setAttribute('data-state', state); else msg.removeAttribute('data-state'); }
    }
    function restart(instant) {
      clearTimeout(timer); busy = false; mistakes = 0;
      k = 1;
      while (steps[k] && steps[k].kind === 'start') k++;
      var first = steps[k];
      show(first, instant ? 0 : 400, first.kind === 'compare'
        ? 'Two sorted runs. Click the front value that goes to the output next: <code>i</code> and <code>j</code> mark the fronts.'
        : 'One run is empty from the start. Click a value to copy the run over.');
      steps[0].counters && stats.update({ comparisons: 0, written: 0, mistakes: 0 });
    }
    function name(it) { return it.value + (it.label ? it.label : ''); }
    function frontsOf(step) { return step.rows.slice(0, 2).map(function (r) { return r.items.filter(function (it) { return it.state === 'compare'; })[0]; }); }
    function correct(prefix) {
      var cmp = steps[k];
      show(steps[k + 1], 520, (prefix || '<b>Right.</b> ') + cmp.caption.replace(/^Compare[^.]*\.\s*/, '') + ' ' + steps[k + 1].caption.replace(/^Write [^.]*\.\s*/, ''), 'done');
      k += 2;
      var nxt = steps[k];
      if (nxt.kind === 'drain') {
        timer = setTimeout(function () { msg.innerHTML += ' <b>One run is empty now: click what is left of the other run to copy it over.</b>'; }, 100);
      } else if (nxt.kind === 'done') {
        busy = true;
        timer = setTimeout(function () { show(nxt, 500, msg.innerHTML + ' <b>That was the last value.</b>', 'done'); busy = false; }, 800);
      } else {
        busy = true;
        timer = setTimeout(function () { show(nxt, 350); busy = false; }, 900);
      }
    }
    view.on('click', function (e) {
      if (busy) return;
      var step = steps[k];
      if (!step) return;
      var placed = step.rows[2].items.some(function (it) { return it.id === e.id; });
      if (step.kind === 'drain') {
        if (placed) { msg.innerHTML = 'That value is already written. Click a value that is still waiting in a run.'; return; }
        show(steps[k], 600, steps[k].caption, 'done');
        k++;
        busy = true;
        timer = setTimeout(function () { show(steps[k], 500, msg.innerHTML + ' <b>Merged.</b>', 'done'); busy = false; }, 900);
        return;
      }
      if (step.kind !== 'compare') return;
      if (e.id === step.next) { correct(); return; }
      mistakes++;
      var f = frontsOf(step), all = step.rows.slice(0, 2), it = null, rowIx = -1;
      all.forEach(function (r, ri) { r.items.forEach(function (x) { if (x.id === e.id) { it = x; rowIx = ri; } }); });
      var text;
      if (placed) text = 'That value is already written. Click one of the two front values, at <code>i</code> or <code>j</code>.';
      else if (it && it.state !== 'compare') text = '<b>' + name(it) + '</b> is not a front. Each run is sorted, so a value behind the front is larger than it and cannot go next. Only the fronts, at <code>i</code> and <code>j</code>, can.';
      else {
        var other = f[1 - rowIx], sameVal = it && other && it.value === other.value;
        text = sameVal
          ? 'The two fronts are equal, so the <b>left</b> one goes first. That is the tie rule: it keeps equal values in their original order.'
          : '<b>' + name(it) + '</b> is larger than <b>' + name(other) + '</b>. The smaller front goes first, because both runs are sorted and nothing waiting can be smaller than it.';
      }
      var copy = Object.assign({}, step, { rows: step.rows.map(function (r) { return Object.assign({}, r, { items: r.items.map(function (x) { return x.id === e.id ? Object.assign({}, x, { state: 'error' }) : x; }) }); }) });
      show(copy, 150, text, 'error');
      busy = true;
      timer = setTimeout(function () { view.render(step, { duration: 250 }); busy = false; }, 900);
    });
    fig.querySelector('[data-hint]').addEventListener('click', function () {
      if (busy) return;
      var step = steps[k];
      if (!step) return;
      if (step.kind === 'compare') correct('<b>Here is the next move.</b> ');
      else if (step.kind === 'drain') {
        show(step, 600, step.caption, 'done'); k++; busy = true;
        timer = setTimeout(function () { show(steps[k], 500, msg.innerHTML + ' <b>Merged.</b>', 'done'); busy = false; }, 900);
      }
    });
    fig.querySelector('[data-restart]').addEventListener('click', function () { view.reset(); view.prepare(steps); restart(true); });
    fig.querySelector('[data-shuffle]').addEventListener('click', load);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Runs', value: preset,
      options: [{ value: 'random', label: 'Random' }, { value: 'inter', label: 'Interleaved' }, { value: 'early', label: 'One run empties early' }, { value: 'ties', label: 'Equal values' }],
      onChange: function (v) { preset = v; load(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Fronts: one of these goes next' }, { state: 'visited', label: 'Waiting in a run' }, { state: 'swap', label: 'Just written' }, { state: 'done', label: 'In the output' }, { state: 'error', label: 'Wrong pick' }]);
    load();
  };

  /* ================================================================== ties and stability */
  L15.initStable = function () {
    var fig = V.$('#fig-stable');
    var L = [{ value: 2 }, { value: 3, label: 'a' }, { value: 7 }], R = [{ value: 3, label: 'b' }, { value: 5 }, { value: 9 }];
    var tie = 'left';
    function gen() { return M().mergeRuns(L, R, { tie: tie }); }
    var made = L15.arrayFigure(fig, gen(), { view: { cellSize: 54, showIndices: false }, baseStepMs: 1300, label: 'Tie rule controls', counterLabels: { comparisons: 'Comparisons', written: 'Written' } });
    var verdict = fig.querySelector('[data-verdict]');
    function updateVerdict(step) {
      if (step.kind !== 'done') { verdict.innerHTML = 'Step to the end to see whether the two <b>3</b>s kept their order.'; verdict.removeAttribute('data-state'); return; }
      var out = step.rows[2].items.slice().sort(function (x, y) { return x.index - y.index; }).filter(function (it) { return it.label; }).map(function (it) { return it.label; });
      var ok = out[0] === 'a';
      verdict.innerHTML = ok ? '<b>Stable.</b> 3<sub>a</sub> was in the left run, so it comes out before 3<sub>b</sub>, the order they had in the input.' : '<b>Not stable.</b> 3<sub>b</sub> now comes out before 3<sub>a</sub>: a sort that took the right value on ties would reorder equal records.';
      verdict.setAttribute('data-state', ok ? 'done' : 'error');
    }
    made.player.on('step', function (step) { updateVerdict(step); });
    updateVerdict(made.player.step);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'On a tie, take', value: tie,
      options: [{ value: 'left', label: 'the left value (≤)' }, { value: 'right', label: 'the right value (<)' }],
      onChange: function (v) { tie = v; made.reload(gen()); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Fronts' }, { state: 'visited', label: 'Waiting' }, { state: 'swap', label: 'Just written' }, { state: 'done', label: 'Output' }]);
    return made.player;
  };

  /* ================================================================== the recursion tree with work per level */
  L15.initTree = function () {
    var fig = V.$('#fig-tree'), stage = fig.querySelector('[data-stage]'), readout = fig.querySelector('[data-readout]');
    var n = 8, svg = null, levels = [], rowEls = [];
    var player = null;
    function sizesText(sz) {
      var same = sz.every(function (x) { return x === sz[0]; });
      return same ? sz.length + (sz.length === 1 ? ' call' : ' calls') + ' × ' + sz[0] : sz.length + ' calls';
    }
    function buildSteps() {
      levels = M().treeLevels(n);
      var D = levels.length - 1, out = [];
      for (var d = 0; d <= D; d++) {
        var lv = levels[d], cap;
        if (d === 0) cap = 'The first call handles all <b>' + n + '</b> values. When its two halves come back sorted, its merge writes <b>' + n + '</b> values.';
        else if (lv.work === 0) cap = 'Level ' + d + ': every piece is a single value. One value is already sorted, so this level does no merging: <b>0</b> writes.';
        else cap = 'Level ' + d + ': <b>' + sizesText(lv.sizes).replace(' × ', ' calls of size ').replace(/^(\d+) calls of/, '$1 calls of') + '</b>. The pieces still cover all ' + n + ' values, so their merges write <b>' + lv.work + '</b> values in total' + (lv.work === n ? ': the same as the level above.' : '.');
        out.push({ k: d, caption: cap });
      }
      var merging = levels.filter(function (l) { return l.work > 0; }).length, total = levels.reduce(function (t, l) { return t + l.work; }, 0);
      out.push({ k: D + 1, caption: 'Add the levels: <b>' + merging + '</b> merging ' + (merging === 1 ? 'level' : 'levels') + ' × about ' + n + ' = <b>' + total + '</b> writes. Each level costs n, and there are ⌈log₂ n⌉ of them.' });
      return out;
    }
    function draw() {
      V.clear(stage);
      var W = Math.max(300, stage.clientWidth || 640), narrow = W < 560;
      var leftW = narrow ? 44 : 118, rightW = narrow ? 84 : 170, pad = 8;
      var iw = W - leftW - rightW - pad * 2, rh = 32, pitch = 44, top = 10;
      var D = levels.length - 1, H = top + (D + 1) * pitch + 50;
      svg = s('svg', { class: 'l15-treesvg', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Recursion tree of merge sort on ' + n + ' values with the work of each level' });
      rowEls = [];
      var tree = M().buildTree(n);
      levels.forEach(function (lv, d) {
        var y = top + d * pitch, g = s('g', { class: 'l15-lvl', 'data-level': d });
        // level label
        g.appendChild(s('text', { class: 'l15-lvl__name', x: pad, y: y + rh / 2 - (narrow ? 0 : 6), 'dominant-baseline': 'central' }, narrow ? String(d) : 'Level ' + d));
        if (!narrow) g.appendChild(s('text', { class: 'l15-lvl__sub', x: pad, y: y + rh / 2 + 9, 'dominant-baseline': 'central' }, sizesText(lv.sizes)));
        tree.nodes.filter(function (nd) { return nd.depth === d; }).forEach(function (nd) {
          var size = nd.hi - nd.lo + 1;
          var x = pad + leftW + nd.lo / n * iw + 1.5, w = Math.max(2, size / n * iw - 3);
          var leaf = nd.hi === nd.lo;
          g.appendChild(s('rect', { class: 'l15-node' + (leaf ? ' is-leaf' : ''), x: x, y: y, width: w, height: rh, rx: Math.min(7, w / 2) }));
          if (w >= 22) g.appendChild(s('text', { class: 'l15-node__txt', x: x + w / 2, y: y + rh / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(size)));
        });
        // work bar on the right
        var bx = pad + leftW + iw + 14, bmax = rightW - 14 - 30;
        var bw = lv.work / n * bmax;
        g.appendChild(s('rect', { class: 'l15-work', x: bx, y: y + 6, width: Math.max(lv.work ? 3 : 0, bw), height: rh - 12, rx: 4 }));
        g.appendChild(s('text', { class: 'l15-work__txt', x: bx + Math.max(lv.work ? 3 : 0, bw) + 6, y: y + rh / 2, 'dominant-baseline': 'central' }, lv.work === 0 ? '0' : String(lv.work)));
        svg.appendChild(g);
        rowEls.push(g);
      });
      var yT = top + (D + 1) * pitch + 4;
      var total = levels.reduce(function (t, l) { return t + l.work; }, 0);
      var tg = s('g', { class: 'l15-total' });
      tg.appendChild(s('line', { x1: pad + leftW + iw + 14, x2: W - pad, y1: yT, y2: yT }));
      tg.appendChild(s('text', { x: pad + leftW + iw + 14, y: yT + 20, class: 'l15-total__txt' }, 'total ' + total));
      svg.appendChild(tg);
      svg._total = tg;
      stage.appendChild(svg);
      /* the caption already adds the levels up; the note under the controls only says how that compares with n log₂ n */
      readout.innerHTML = (n & (n - 1)) === 0 ? 'Check: n log₂ n = ' + n + ' × log₂ ' + n + ' = ' + n + ' × ' + Math.log2(n) + ' = <b>' + total + '</b>.' : 'n log₂ n = ' + Math.round(n * Math.log2(n)) + '; the pieces are uneven, so the last levels cost a little less than n and the real count is <b>' + total + '</b>.';
    }
    function render(step, ctx) {
      stage.style.setProperty('--t', ctx.duration + 'ms');
      rowEls.forEach(function (g, d) { g.classList.toggle('is-on', d <= step.k); });
      if (svg && svg._total) svg._total.classList.toggle('is-on', step.k > levels.length - 1);
    }
    var steps = (levels = M().treeLevels(n), buildSteps());
    draw();
    player = V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 1500, label: 'Recursion tree controls', startAt: steps.length - 1 });
    function rebuild() {
      var st = buildSteps();
      draw();
      player.setSteps(st, { index: st.length - 1 });
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Number of values n', min: 2, max: 32, step: 1, value: n, onChange: function (v) { n = v; rebuild(); }, onInput: function (v) { n = v; rebuild(); } });
    V.onResize(stage, function () { var st = player.step; draw(); player.refresh(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'visited', label: 'Single value (leaf)' }, { state: 'active', label: 'A call, sized by its piece' }, { state: 'swap', label: 'Values written by the level’s merges' }]);
    return player;
  };

  /* ================================================================== bottom-up merge sort */
  L15.initBottomUp = function () {
    var fig = V.$('#fig-bottomup');
    var n = 8, rng = V.rng(1519), values = [5, 2, 8, 4, 1, 6, 3, 7];
    function gen() { return M().mergeBottomUp(values); }
    var made = L15.arrayFigure(fig, gen(), { view: { cellSize: 48 }, baseStepMs: 1200, label: 'Bottom-up merge sort controls' });
    function reload() { made.reload(gen()); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Values', value: '8',
      options: [{ value: '8', label: '8' }, { value: '11', label: '11' }, { value: '16', label: '16' }],
      onChange: function (v) { n = +v; values = n === 8 ? [5, 2, 8, 4, 1, 6, 3, 7] : V.presets.random(n, { min: 1, max: 30, unique: true, rng: rng }); reload(); }
    });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { values = V.presets.random(n, { min: 1, max: 30, unique: true, rng: rng }); reload(); });
    V.legend(fig.querySelector('[data-legend]'), [L15.LEGEND.run, { state: 'swap', label: 'Just merged' }, L15.LEGEND.done]);
    return made.player;
  };

  /* ================================================================== master theorem explorer */
  var MASTER = {
    binary: { a: 1, c: 0, title: 'Binary search', tag: 'binary search' },
    merge: { a: 2, c: 1, title: 'Merge sort', tag: 'merge sort' },
    leaf: { a: 4, c: 1, title: 'Leaf-heavy', tag: 'a leaf-heavy recursion' },
    kara: { a: 3, c: 1, title: 'Karatsuba', tag: 'Karatsuba multiplication' },
    root: { a: 2, c: 2, title: 'Root-heavy', tag: 'a root-heavy recursion' }
  };
  L15.MASTER = MASTER;
  function powText(c) { return c === 0 ? '1' : c === 1 ? 'n' : 'n<sup>' + c + '</sup>'; }
  function compact(v) {
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
    if (v >= 1e4) return Math.round(v / 1e3) + 'k';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  }
  L15.masterAnalysis = function (a, c) {
    var cs = Math.log2(a), eq = Math.abs(c - cs) < 1e-9;
    var cstr = (Math.round(cs * 1000) / 1000);
    var t, kind;
    function sup(x) { return x === 0 ? '1' : x === 1 ? 'n' : 'n<sup>' + x + '</sup>'; }
    if (eq) { kind = 'balanced'; t = c === 0 ? 'Θ(log n)' : 'Θ(' + sup(c) + ' log n)'; }
    else if (c < cs) { kind = 'leaves'; t = 'Θ(' + sup(cstr) + ')'; }
    else { kind = 'root'; t = 'Θ(' + sup(c) + ')'; }
    return { cs: cstr, kind: kind, T: t };
  };
  L15.initMaster = function () {
    var fig = V.$('#fig-master'), stage = fig.querySelector('[data-stage]'), verdict = fig.querySelector('[data-verdict]');
    var LV = 6, n = 64, a = 2, c = 1, preset = 'merge', sa = null, sc = null, seg = null;
    var rowsEl = [];
    for (var i = 0; i <= LV; i++) {
      var bar = h('div', { class: 'l15-mbar' }), val = h('span', { class: 'l15-mbar__val' });
      var lab = h('p', { class: 'l15-mrow__lab' });
      var row = h('div', { class: 'l15-mrow' }, lab, h('div', { class: 'l15-mtrack' }, bar), val);
      stage.appendChild(row);
      rowsEl.push({ row: row, bar: bar, val: val, lab: lab });
    }
    function draw() {
      var work = [], mx = 0, i;
      for (i = 0; i <= LV; i++) { var size = n / Math.pow(2, i); var w = Math.pow(a, i) * Math.pow(size, c); work.push(w); mx = Math.max(mx, w); }
      var res = L15.masterAnalysis(a, c);
      var minW = Math.min.apply(null, work);
      work.forEach(function (w, i) {
        var r = rowsEl[i], size = n / Math.pow(2, i);
        r.lab.innerHTML = '<b>Level ' + i + '</b><span>' + compact(Math.pow(a, i)) + (Math.pow(a, i) === 1 ? ' call' : ' calls') + ' × ' + (c === 0 ? '1' : compact(Math.pow(size, c))) + '</span>';
        r.bar.style.width = 'max(3px, ' + (w / mx * 100).toFixed(2) + '%)';
        r.val.textContent = compact(w);
        r.row.setAttribute('data-big', w >= mx * 0.999 ? 'max' : '');
      });
      var lead = res.kind === 'balanced' ? 'Every level costs about the same, so multiply by the number of levels.' : res.kind === 'leaves' ? 'The bars grow towards the leaves: the leaves do most of the work.' : 'The bars shrink towards the leaves: the root’s merge dominates.';
      verdict.innerHTML = '<b>T(n) = ' + a + '·T(n/2) + ' + powText(c) + '</b> → the leaves cost about n<sup>log₂ ' + a + '</sup> = n<sup>' + res.cs + '</sup>, the root costs ' + powText(c) + '. ' + lead + ' <b>T(n) = ' + res.T + '.</b>' + (MASTER[preset] ? ' (' + MASTER[preset].title + ')' : '');
      verdict.setAttribute('data-state', res.kind === 'balanced' ? 'done' : 'compare');
    }
    function syncPreset(name) {
      preset = name;
      var m = MASTER[name];
      if (m) { a = m.a; c = m.c; sa.set(a); sc.set(c); }
      draw();
    }
    seg = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Recursion', value: preset,
      options: [{ value: 'binary', label: 'Binary search' }, { value: 'merge', label: 'Merge sort' }, { value: 'kara', label: 'Karatsuba' }, { value: 'leaf', label: 'Leaf-heavy' }, { value: 'root', label: 'Root-heavy' }],
      onChange: syncPreset
    });
    function custom() {
      var found = Object.keys(MASTER).filter(function (k) { return MASTER[k].a === a && MASTER[k].c === c; })[0];
      preset = found || 'custom';
      if (found) seg.set(found);
      draw();
    }
    sa = V.slider(fig.querySelector('[data-a]'), { label: 'Calls per level, a', min: 1, max: 5, step: 1, value: a, onInput: function (v) { a = v; custom(); } });
    sc = V.slider(fig.querySelector('[data-c]'), { label: 'Merge work per call, n^c', min: 0, max: 3, step: 0.5, value: c, format: function (v) { return v === 0 ? 'c = 0 (constant)' : 'c = ' + v; }, onInput: function (v) { c = v; custom(); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'swap', label: 'Work on the level' }, { state: 'done', label: 'Biggest level' }]);
    draw();
  };
}());
