/* Lesson 38 — Randomized algorithms: wiring for every figure except the three labs (those live in
   38-randomized-algorithms-labs.js) and the custom views (38-randomized-algorithms-views.js).
   Step generators: js/algos/38-randomized-algorithms.js (VDSA.algos.randomized). Quick sort: js/algos/16-quick-sort.js.

   Figures, in page order: hero teaser (darts) · adversary minis · Las Vegas / Monte Carlo minis · darts + charts ·
   shuffle steps · shuffle heatmaps (10,000 runs) · exact odds + click quiz · reservoir lab, flowchart, histogram ·
   coin-flip towers · skip list lab, cost chart · Bloom lab, false-positive chart · quick sort race + chart ·
   Las Vegas / Monte Carlo decision flowchart · amplification chart · tabs (universal hashing, Miller–Rabin,
   count-min sketch, treap) · quizzes · summary tiles · finale. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L38 = V.lessons.l38, R = V.algos.randomized, Q = V.algos.sorting;
  var esc = V.escape;

  function fmtInt(n) { return Math.round(n).toLocaleString('en-US'); }
  function pct(x, d) { return (x * 100).toFixed(d === undefined ? 1 : d) + '%'; }
  function btn(label, onclick, cls) { return h('button', { type: 'button', class: 'btn btn--sm ' + (cls || 'btn--secondary'), onclick: onclick }, label); }
  function chart(stage, opts) { return V.views.chart(stage, opts); }
  var LETTERS = 'ABCDEFGHIJKLMNOP'.split('');
  function newSeed() { return 1 + Math.floor(Math.random() * 99998); }

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var stage = V.$('#teaser'); if (!stage) return;
    var board = null, read = null, seed = 5;
    function data() { seed += 7; return R.piSteps(1600, seed, { batches: 34 }); }
    function render(step, ctx) {
      if (!board) {
        var wrap = h('div', { class: 'rz-hero' });
        var host = h('div', { class: 'rz-hero__board', style: { height: '100%', width: '100%', display: 'grid', placeItems: 'center', minHeight: 0 } });
        read = h('div', { class: 'rz-hero__read' });
        wrap.appendChild(host); wrap.appendChild(read); stage.appendChild(wrap);
        board = L38.dartBoard(host, { label: 'Darts landing in a square with a quarter circle' });
      }
      if (!ctx || !ctx.prev || step.k < board.count) { board.clear(); board.add(step.darts, false); }
      else if (step.k > board.count) board.add(step.darts.slice(board.count), !ctx.instant);
      read.innerHTML = step.k ? '<i>' + fmtInt(step.k) + ' darts</i> · 4 × ' + fmtInt(step.inside) + ' ÷ ' + fmtInt(step.k) + ' = π ≈ <b>' + step.estimate.toFixed(step.k < 100 ? 2 : 3) + '</b>' : '<i>0 darts</i> · π ≈ ?';
    }
    V.teaser(stage, { steps: data(), render: render, stepMs: 260, holdMs: 2200, regenerate: data, staticIndex: undefined });
  }

  /* ================================================================== problem: adversary minis */
  function miniFig(title, cap) {
    var stage = h('div', { class: 'mini__stage' });
    return { fig: h('figure', { class: 'mini' }, stage, h('figcaption', { html: cap })), stage: stage };
  }
  function adversaryMinis() {
    var row = V.$('#mini-adversary'); if (!row) return;
    var n = 8, vals = V.range(n, 1);
    function items(pivotIdx, states) {
      return vals.map(function (v, i) { return { id: 'a' + i, value: v, state: i === pivotIdx ? 'pivot' : (states && states[i]) || 'default' }; });
    }
    var m1 = miniFig('', '<b>Sorted, pivot = last.</b> The pivot is the biggest value: split <b>7 | 0</b>. Almost no progress.');
    var m2 = miniFig('', '<b>Sorted, pivot = coin flip</b> (landed on 5). Split <b>4 | 3</b>: about half the work is gone.');
    var adv = R.adversaryInput(n, 'middle', 1, 1200), advCost = R.quickComparisons(adv, 'middle'), rndCost = R.quickComparisons(R.quickInputs('random', n, 4), 'middle');
    var m3 = miniFig('', '<b>An array built to beat “always the middle”:</b> ' + advCost + ' comparisons, against ' + rndCost + ' for a random array of the same size.');
    row.appendChild(m1.fig); row.appendChild(m2.fig); row.appendChild(m3.fig);
    var o = { mode: 'bars', showIndices: false, showValues: false, maxValue: n, minValue: 0, cellSize: 30, barHeight: 96 };
    V.views.array(m1.stage, Object.assign({ label: 'Sorted array with the last value as pivot' }, o)).render({
      items: items(n - 1), regions: [{ from: 0, to: n - 2, state: 'muted', label: '7 left over' }]
    }, { duration: 0 });
    var pv = 4;
    V.views.array(m2.stage, Object.assign({ label: 'Sorted array with a random pivot' }, o)).render({
      items: items(pv, vals.map(function (v, i) { return i < pv ? 'done' : 'frontier'; })), regions: [{ from: 0, to: pv - 1, state: 'done', label: '4' }, { from: pv + 1, to: n - 1, state: 'frontier', label: '3' }]
    }, { duration: 0 });
    var mid = (n - 1) >> 1;
    V.views.array(m3.stage, Object.assign({ label: 'An array that defeats the middle-pivot rule' }, o)).render({
      items: adv.map(function (v, i) { return { id: 'c' + i, value: v, state: i === mid ? 'pivot' : 'default' }; })
    }, { duration: 0 });
  }

  /* ================================================================== Las Vegas / Monte Carlo minis */
  function kindsMinis() {
    var row = V.$('#mini-kinds'); if (!row) return;
    var lv = miniFig('', '<b>Las Vegas.</b> Every run ends with the right answer, but each takes a different time.');
    var mc = miniFig('', '<b>Monte Carlo.</b> Every run takes the same time, and the answer is close, but not always right.');
    row.appendChild(lv.fig); row.appendChild(mc.fig);
    function bars(stage, kind) {
      var W = 300, H = 132, svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': kind === 'lv' ? 'Three runs of different lengths, each ending in a green tick' : 'Three runs of equal length ending in slightly different answers, one marked wrong' });
      svg.style.width = '100%'; svg.style.maxWidth = '320px';
      var len = kind === 'lv' ? [150, 236, 96] : [170, 170, 170];
      var end = kind === 'lv' ? ['✓', '✓', '✓'] : ['3.14', '3.19', '2.97'];
      var bad = kind === 'lv' ? [false, false, false] : [false, true, true];
      var recs = [];
      len.forEach(function (w, i) {
        var y = 16 + i * 38;
        svg.appendChild(s('text', { x: 2, y: y + 16, style: 'font: 600 11px var(--font-mono); fill: var(--ink-3)' }, 'run ' + (i + 1)));
        var r = s('rect', { x: 40, y: y, width: 0, height: 24, rx: 6, style: 'fill: color-mix(in srgb, var(--st-active) 28%, var(--el-fill)); stroke: var(--st-active); stroke-width: 1.5' });
        var t = s('text', { x: 40 + w + 10, y: y + 17, style: 'font: 750 13px var(--font-sans); opacity: 0; fill: ' + (bad[i] ? 'var(--st-error)' : 'var(--st-done)') }, end[i] + (kind === 'mc' && bad[i] ? ' ✗' : kind === 'mc' ? ' ✓' : ''));
        svg.appendChild(r); svg.appendChild(t); recs.push({ r: r, t: t, w: w });
      });
      stage.appendChild(svg);
      function run() {
        recs.forEach(function (o, i) {
          o.r.setAttribute('width', 0); o.t.style.opacity = 0;
          V.animate(o.r, { attr: { width: o.w } }, { duration: kind === 'lv' ? 900 + i * 380 : 1200, ease: 'out' }).then(function () { o.t.style.opacity = 1; });
        });
      }
      var timer = 0;
      if (V.reducedMotion()) { recs.forEach(function (o) { o.r.setAttribute('width', o.w); o.t.style.opacity = 1; }); return; }
      V.onVisible(stage, function (vis) { clearInterval(timer); if (vis) { run(); timer = setInterval(run, 3600); } });
    }
    bars(lv.stage, 'lv'); bars(mc.stage, 'mc');
  }

  /* ================================================================== Monte Carlo pi */
  function piFigure() {
    var fig = V.$('#fig-pi'); if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Inside the circle', shape: 'dot' }, { state: 'path', label: 'Outside', shape: 'dot' },
      { state: 'muted', label: 'π and the typical error', shape: 'dash', color: 'var(--ink-3)' }
    ]);
    var stage = fig.querySelector('[data-stage]');
    var boardHost = h('div'), est = h('div', { class: 'rz-pi__chart' }, h('h4', {}, 'Estimate of π'), h('div')), err = h('div', { class: 'rz-pi__chart' }, h('h4', {}, 'Error, log scale'), h('div'));
    stage.appendChild(h('div', { class: 'rz-pi' }, boardHost, h('div', { class: 'rz-pi__charts' }, est, err)));
    var board = L38.dartBoard(boardHost);
    var estChart = chart(est.lastChild, { type: 'line', height: 190, labels: false, label: 'Estimate of pi against the number of darts thrown' });
    var errChart = chart(err.lastChild, { type: 'line', height: 190, labels: false, label: 'Absolute error against the number of darts, on log axes' });
    var CAP = 100000, seed = 5, th = R.piThrower(seed), hist = [], errs = [], nextRec = 1, auto = null, raf = 0;
    var read = fig.querySelector('[data-readbar]');
    function renderCharts(dur) {
      var series = [
        { id: 'est', label: 'estimate', points: hist.length ? hist : [[1, Math.PI]], state: 'active', markers: false },
        { id: 'pi', label: 'π', fn: function () { return Math.PI; }, state: 'muted', dashed: true },
        { id: 'hi', label: 'π + typical error', fn: function (n) { return Math.PI + R.piStd(n); }, state: 'muted', dashed: true },
        { id: 'lo', label: 'π − typical error', fn: function (n) { return Math.PI - R.piStd(n); }, state: 'muted', dashed: true }
      ];
      estChart.render({ x: { scale: 'log', min: 1, max: CAP, label: 'darts thrown' }, y: { min: 2.2, max: 4.2, label: '' }, series: series }, { duration: dur });
      errChart.render({ x: { scale: 'log', min: 1, max: CAP, label: 'darts thrown' }, y: { scale: 'log', min: 0.0001, max: 4, label: '' },
        series: [{ id: 'err', label: '|estimate − π|', points: errs.length ? errs : [[1, 1]], state: 'active', markers: false },
          { id: 'ref', label: '1.64 / √n', fn: function (n) { return R.piStd(n); }, state: 'muted', dashed: true }] }, { duration: dur });
    }
    function update() {
      var n = th.total, e = th.estimate();
      read.innerHTML = '<span><small>Darts</small>' + fmtInt(n) + '</span><span><small>Inside</small>' + fmtInt(th.inside) + '</span>' +
        '<span><small>4 × inside ÷ darts</small><b>' + (n ? e.toFixed(n < 100 ? 2 : 4) : '?') + '</b></span>' +
        '<span><small>Error</small>' + (n ? (Math.abs(e - Math.PI)).toFixed(4) : '–') + '</span><span><small>Typical error 1.64/√n</small>' + (n ? R.piStd(n).toFixed(4) : '–') + '</span>';
    }
    function throwN(n) {
      n = Math.min(n, CAP - th.total); if (n <= 0) { if (auto) { autoToggle.set(false); } return; }
      var t0 = th.total, in0 = th.inside, list = th.throwDarts(n), ins = in0;
      list.forEach(function (d, i) {
        var tot = t0 + i + 1; if (d.inside) ins++;
        if (tot >= nextRec) { var e = 4 * ins / tot; hist.push([tot, e]); if (Math.abs(e - Math.PI) > 1e-9) errs.push([tot, Math.abs(e - Math.PI)]); nextRec = Math.max(tot + 1, Math.round(tot * 1.12)); }
      });
      if (!hist.length || hist[hist.length - 1][0] !== th.total) { var e2 = th.estimate(); hist.push([th.total, e2]); if (Math.abs(e2 - Math.PI) > 1e-9) errs.push([th.total, Math.abs(e2 - Math.PI)]); }
      board.add(list, n <= 400);
      update();
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; renderCharts(260); });
    }
    function reset() {
      th = R.piThrower(seed); hist = []; errs = []; nextRec = 1; board.clear(); update(); renderCharts(300);
    }
    var tb = fig.querySelector('[data-throws]');
    [1, 10, 100, 1000, 10000].forEach(function (n) { tb.appendChild(btn('Throw ' + fmtInt(n), function () { throwN(n); }, n === 100 ? 'btn--primary' : 'btn--secondary')); });
    var autoToggle = V.toggle(fig.querySelector('[data-toggle]'), { label: 'Keep throwing', checked: false, onChange: function (on) {
      clearInterval(auto); auto = null;
      if (on) auto = setInterval(function () { if (th.total >= CAP) { autoToggle.set(false); return; } throwN(th.total < 200 ? 4 : Math.ceil(th.total / 40)); }, 160);
    } });
    tb.appendChild(btn('New seed', function () { seed = newSeed(); reset(); }, 'btn--ghost'));
    tb.appendChild(btn('Clear', function () { reset(); }, 'btn--ghost'));
    V.onVisible(fig, function (vis) { if (!vis && auto) autoToggle.set(false); });
    update(); renderCharts(0);
    L38.whenNear(fig, function () { throwN(20); });
    V.codeBlock(V.$('[data-code-block="pi"]'), 'let inside = 0;\nfor (let i = 0; i < n; i++) {\n  const x = Math.random(), y = Math.random();\n  if (x * x + y * y <= 1) inside++;\n}\nreturn 4 * inside / n;   // the circle covers π/4 of the square', 'js');
  }

  /* ================================================================== shuffle: steps */
  function shuffleFigure() {
    var fig = V.$('#fig-shuffle'); if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Slot i (this turn)', shape: 'ring' }, { state: 'compare', label: 'Random slot j' },
      { state: 'swap', label: 'Swapping' }, { state: 'done', label: 'Final (cannot move again)' }
    ]);
    var kind = 'naive', n = 6, seed = 12;
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: R.CODE.shuffleNaive, default: 'pseudo', title: 'shuffle' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'active', j: 'compare' } });
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 54, showIndices: true, label: 'Array being shuffled' });
    function steps() { return R.shuffleSteps(kind, LETTERS.slice(0, n), seed); }
    var first = steps(); view.prepare(first);
    var player = V.player({
      root: fig, steps: first, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { draws: 'Random draws', swaps: 'Swaps' }, counterStates: { swaps: 'swap' }, baseStepMs: 1000, label: 'Shuffle controls'
    });
    player.addCheckpoint(function (all) {
      var d = 0; for (var k = 0; k < all.length; k++) if (all[k].kind === 'draw' && ++d === 3) return k; return -1;
    }, function (c) {
      var p = c.prev, i = p.i, fy = p.algo === 'fisher-yates', nn = p.items.length, pool = fy ? i + 1 : nn;
      var opts = fy ? ['All ' + nn + ' slots', 'Slots 0 to ' + i + ' only (' + (i + 1) + ' choices)', 'Slots 0 to ' + (i - 1) + ' only'] : ['Slots 0 to ' + i + ' only', 'Slots 0 to ' + (i - 1) + ' only', 'Any of the ' + nn + ' slots'];
      var ans = fy ? 1 : 2;
      return {
        question: (fy ? 'Fisher–Yates, ' : 'Naive shuffle, ') + 'slot <b>i = ' + i + '</b>. Which slots can the random <b>j</b> be?',
        options: opts, answer: ans,
        explain: fy ? ['That would let a final slot on the right be disturbed again.', 'Yes: slots to the right of i are already final, so j comes from the ' + (i + 1) + ' slots that are still open.', 'j can equal i itself: keeping an item in place is one of the equally likely outcomes.']
          : ['That would be Fisher–Yates. The naive shuffle forgets which slots are done.', 'That excludes j = i and every slot to the right.', 'Yes: the naive shuffle draws j from all ' + nn + ' slots every time, including slots it has already visited.']
      };
    }, { id: 'shuffle-predict' });
    var chip = h('span', { class: 'chip chip--sm' }, 'seed ' + seed);
    function regen() {
      code.setSource(kind === 'naive' ? R.CODE.shuffleNaive : R.CODE.fisherYates);
      var st = steps(); view.reset && view.reset(); view.prepare(st); player.setSteps(st); chip.textContent = 'seed ' + seed;
    }
    var host = fig.querySelector('[data-input]');
    var segHost = h('div'), slHost = h('div', { style: { flex: '0 1 220px' } });
    host.appendChild(segHost); host.appendChild(slHost);
    host.appendChild(h('div', { class: 'btn-row' }, btn('New seed', function () { seed = newSeed(); regen(); }), chip));
    V.segmented(segHost, { label: 'Shuffle', value: kind, options: [{ value: 'naive', label: 'Naive: swap with any slot' }, { value: 'fisher-yates', label: 'Fisher–Yates' }], onChange: function (v) { kind = v; regen(); } });
    V.slider(slHost, { label: 'Items', min: 3, max: 8, value: n, onChange: function (v) { n = v; regen(); } });
  }

  /* ================================================================== shuffle: heatmaps (10,000 runs) and exact odds */
  function heatFigure() {
    var fig = V.$('#fig-heat'); if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'path', label: 'More likely than 1/n', shape: 'square' }, { state: 'active', label: 'Less likely than 1/n', shape: 'square' }]);
    var stage = fig.querySelector('[data-stage]'), n = 6, seed = 3, RUNS = 10000, running = false, ran = false;
    var grid = h('div', { class: 'rz-heat-grid' });
    function panel(title) {
      var stageEl = h('div', { style: { width: '100%', display: 'grid', placeItems: 'center' } }), sub = h('p', { class: 'rz-heat-sub', 'aria-live': 'polite' }, 'Press “Run 10,000 shuffles”.');
      grid.appendChild(h('div', {}, h('h4', {}, title), stageEl, sub));
      return { hm: L38.heatmap(stageEl, { n: n, label: title + ': how often each item lands in each position' }), sub: sub };
    }
    var pn = panel('Naive: swap with any slot'), pf = panel('Fisher–Yates');
    stage.appendChild(grid);
    var counts = { naive: null, fy: null }, done = 0;
    function describe(probs, kindLabel, panelObj, bad) {
      var worst = 0, wr = 0, wc = 0, N = probs.length;
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { var d = Math.abs(probs[r][c] - 1 / N); if (d > worst) { worst = d; wr = r; wc = c; } }
      panelObj.sub.className = 'rz-heat-sub ' + (bad ? 'is-bad' : 'is-good');
      panelObj.sub.innerHTML = 'Largest gap from fair (1/' + N + ' = ' + pct(1 / N) + '): <b>' + (worst * 100).toFixed(1) + ' points</b>, item ' + LETTERS[wr] + ' in position ' + (wc + 1) + ' (' + pct(probs[wr][wc]) + ')' + (bad ? '. That is real bias, far above sampling noise.' : '. That is just sampling noise: it shrinks as runs grow.');
    }
    function toProbs(c, total) { return c.map(function (row) { return row.map(function (x) { return x / total; }); }); }
    function run() {
      if (running) return; running = true; ran = true; runBtn.disabled = true;
      var rn = V.rng(seed), rf = V.rng(seed + 1), base = V.range(n);
      counts.naive = base.map(function () { return new Array(n).fill(0); }); counts.fy = base.map(function () { return new Array(n).fill(0); }); done = 0;
      pn.sub.textContent = 'Shuffling…'; pf.sub.textContent = 'Shuffling…';
      var CH = 1000;
      (function chunk() {
        for (var i = 0; i < CH; i++) {
          var a = R.shuffleNaive(base, rn), b = R.fisherYates(base, rf);
          for (var p = 0; p < n; p++) { counts.naive[a[p]][p]++; counts.fy[b[p]][p]++; }
        }
        done += CH;
        pn.hm.render(toProbs(counts.naive, done), { duration: 160 }); pf.hm.render(toProbs(counts.fy, done), { duration: 160 });
        if (done < RUNS) { setTimeout(chunk, V.reducedMotion() ? 0 : 90); }
        else {
          describe(toProbs(counts.naive, done), 'naive', pn, true); describe(toProbs(counts.fy, done), 'fy', pf, false);
          running = false; runBtn.disabled = false;
        }
      }());
    }
    function fresh() { pn.hm.setN(n); pf.hm.setN(n); pn.sub.className = pf.sub.className = 'rz-heat-sub'; pn.sub.textContent = pf.sub.textContent = 'Press “Run 10,000 shuffles”.'; }
    var tb = fig.querySelector('[data-toolbar]');
    var slHost = h('div', { style: { flex: '0 1 240px' } });
    var runBtn = btn('Run 10,000 shuffles', run, 'btn--primary');
    var chip = h('span', { class: 'chip chip--sm' }, 'seed ' + seed);
    tb.appendChild(slHost); tb.appendChild(h('div', { class: 'btn-row' }, runBtn, btn('New seed', function () { seed = newSeed(); chip.textContent = 'seed ' + seed; run(); }), chip));
    V.slider(slHost, { label: 'Items', min: 3, max: 8, value: n, onChange: function (v) { if (running) return; n = v; fresh(); run(); } });
    L38.whenNear(fig, function () { V.onVisible(fig, function (vis, en) { if (vis && !ran) run(); }); });
  }
  function exactFigure() {
    var fig = V.$('#fig-exact'); if (!fig) return;
    var stage = fig.querySelector('[data-stage]'), n = 6, exact = R.naiveExact(n);
    var hm = L38.heatmap(stage, { n: n, label: 'Exact probability of each item in each position under the naive shuffle' });
    hm.render(exact, { duration: 0 });
    var mx = 0; exact.forEach(function (row) { row.forEach(function (p) { if (p > mx) mx = p; }); });
    V.clickQuiz(stage, {
      el: '#quiz-exact',
      question: 'Click a cell where the naive shuffle is <b>most</b> over-represented (its odds are highest).',
      check: function (id) {
        var rc = String(id).split('-').map(Number), p = exact[rc[0]][rc[1]];
        if (p >= mx - 1e-9) return true;
        return { correct: false, message: p > 1 / n ? 'That one is too likely (' + pct(p) + ' against a fair ' + pct(1 / n) + '), but not the largest gap. Look for the darkest orange.' : 'That cell is under-represented (' + pct(p) + '). Look for the darkest orange instead of blue.' };
      },
      right: 'Two cells tie at ' + pct(mx) + ': item B in position 1, and item F in position 5. Early swaps move items forward and later draws rarely undo it.',
      wrong: 'Look for the darkest orange.'
    });
  }

  /* ================================================================== reservoir: histogram of 10,000 runs */
  function reservoirHist() {
    var fig = V.$('#fig-res-hist'); if (!fig) return;
    var stage = fig.querySelector('[data-stage]'), n = 10, k = 3, seed = 4, RUNS = 10000;
    var c = chart(stage, { type: 'bar', height: 260, label: 'How many times each stream item ended up in the reservoir, over 10,000 runs', valueLabels: true });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { expected: 'Expected per item', min: 'Fewest', max: 'Most', spread: 'Spread' } });
    function draw(counts, dur) {
      var expected = RUNS * k / n, cats = V.range(n).map(function (i) { return LETTERS[i]; });
      c.render({ categories: cats, series: [{ id: 'runs', label: 'times in the reservoir', values: counts || cats.map(function () { return 0; }), state: 'done' }],
        y: { label: 'times in the reservoir (of ' + fmtInt(RUNS) + ' runs); dashed line = fair share, ' + fmtInt(expected), min: 0, max: Math.ceil(expected * 1.35 / 500) * 500 },
        annotations: [{ y: expected, text: '', state: 'muted' }] }, { duration: dur });
      if (counts) { var mn = Math.min.apply(null, counts), mxx = Math.max.apply(null, counts); stats.update({ expected: fmtInt(expected), min: fmtInt(mn), max: fmtInt(mxx), spread: '±' + ((mxx - mn) / 2 / expected * 100).toFixed(1) + '%' }); }
      else stats.update({ expected: fmtInt(expected), min: '–', max: '–', spread: '–' });
    }
    function run() { draw(R.reservoirInclusion(n, k, RUNS, seed), 800); }
    var tb = fig.querySelector('[data-toolbar]'), sn = h('div', { style: { flex: '0 1 200px' } }), sk = h('div', { style: { flex: '0 1 200px' } });
    tb.appendChild(sn); tb.appendChild(sk);
    tb.appendChild(h('div', { class: 'btn-row' }, btn('Run 10,000 streams', run, 'btn--primary'), btn('New seed', function () { seed = newSeed(); run(); })));
    V.slider(sn, { label: 'Stream length n', min: 4, max: 16, value: n, onChange: function (v) { n = v; if (k > n) k = n; draw(null, 0); run(); } });
    V.slider(sk, { label: 'Reservoir size k', min: 1, max: 5, value: k, onChange: function (v) { k = Math.min(v, n); run(); } });
    draw(null, 0);
    L38.whenNear(fig, function () { V.onVisible(fig, function (vis) { if (vis && !fig.__ran) { fig.__ran = true; run(); } }); });
  }

  /* ================================================================== skip list: coin-flip towers */
  function towersFigure() {
    var fig = V.$('#fig-towers'); if (!fig) return;
    var stage = fig.querySelector('[data-stage]'), rnd = V.rng(21), hist = [0, 0, 0, 0, 0], total = 0, busy = false;
    var coins = h('div', { class: 'rz-coinrow', 'aria-live': 'polite' }), tower = h('div', { class: 'rz-tower', role: 'img', 'aria-label': 'A tower of blocks, one per level' });
    var left = h('div', { class: 'rz-tower-host' }, h('p', { class: 'rz-head' }, 'FLIP UNTIL TAILS'), coins, tower, h('p', { class: 'rz-note', 'data-tinfo': '' }, 'Press “Grow one tower”.'));
    var right = h('div', { class: 'rz-pi__chart' }, h('h4', {}, 'How often each height appeared'), h('div'));
    stage.appendChild(h('div', { class: 'rz-tower-grid' }, left, right));
    var c = chart(right.lastChild, { type: 'bar', height: 220, label: 'Share of towers of each height against the expected halving pattern', valueLabels: true,
      format: function (v) { return v + '%'; }, valueFormat: function (v) { return v.toFixed(1) + '%'; } });
    var cats = ['1', '2', '3', '4', '5'];
    function draw(dur) {
      var obs = hist.map(function (x) { return total ? x / total * 100 : 0; });
      var exp = [50, 25, 12.5, 6.25, 6.25];
      c.render({ categories: ['height 1', 'height 2', 'height 3', 'height 4', 'height 5'], series: [
        { id: 'obs', label: 'observed', values: obs, state: 'active' }, { id: 'exp', label: 'expected: 50, 25, 12.5, 6.25, 6.25', values: exp, state: 'muted' }],
        y: { min: 0, max: 60, label: '% of towers' } }, { duration: dur });
    }
    function growOne() {
      if (busy) return; busy = true;
      var t = R.flipTower(rnd, 5);
      V.clear(coins); V.clear(tower);
      var seq = [1].concat(t.flips.map(function (hd, i) { return hd ? i + 2 : 0; }));
      hist[t.h - 1]++; total++;
      var info = fig.querySelector('[data-tinfo]');
      var steps = [], height = 1;
      steps.push(function () { tower.appendChild(h('div', { class: 'rz-tower__block is-new' }, 'level 1')); });
      t.flips.forEach(function (hd, i) {
        steps.push(function () {
          coins.appendChild(h('span', { class: 'rz-coin-el ' + (hd ? 'is-heads' : 'is-tails') }, hd ? 'H' : 'T'));
          if (hd) { height++; tower.appendChild(h('div', { class: 'rz-tower__block is-new' }, 'level ' + height)); }
        });
      });
      var k = 0, delay = V.reducedMotion() ? 0 : 420;
      (function next() {
        if (k >= steps.length) { info.textContent = 'Tower of height ' + t.h + ' (' + t.flips.length + ' flip' + (t.flips.length === 1 ? '' : 's') + '). ' + fmtInt(total) + ' tower' + (total === 1 ? '' : 's') + ' so far.'; draw(300); busy = false; return; }
        steps[k++](); if (delay) setTimeout(next, delay); else next();
      }());
    }
    function growMany(m) {
      for (var i = 0; i < m; i++) { var t = R.flipTower(rnd, 5); hist[t.h - 1]++; total++; }
      fig.querySelector('[data-tinfo]').textContent = fmtInt(total) + ' tower' + (total === 1 ? '' : 's') + ' so far.'; draw(500);
    }
    var tb = fig.querySelector('[data-toolbar]');
    tb.appendChild(btn('Grow one tower', growOne, 'btn--primary')); tb.appendChild(btn('Grow 1,000 towers', function () { growMany(1000); }));
    tb.appendChild(btn('Reset', function () { hist = [0, 0, 0, 0, 0]; total = 0; V.clear(coins); V.clear(tower); fig.querySelector('[data-tinfo]').textContent = 'Press “Grow one tower”.'; draw(300); }, 'btn--ghost'));
    draw(0);
  }

  /* ================================================================== skip list: cost chart */
  function skipCostFigure() {
    var fig = V.$('#fig-skip-cost'); if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Skip list', shape: 'line' }, { state: 'compare', label: 'Plain linked list', shape: 'line' }]);
    var c = chart(fig.querySelector('[data-stage]'), { type: 'line', height: 300, label: 'Average comparisons per search against number of keys, skip list versus plain linked list' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'Keys', skip: 'Skip list', plain: 'Plain list', tall: 'Tallest tower' }, states: { skip: 'active', plain: 'compare' } });
    var ns = [8, 16, 32, 64, 128, 256, 512, 1024, 2048], data = null;
    function compute() {
      var skip = [], plain = [], last = null;
      ns.forEach(function (n) { var a = R.skipAverageCost(n, n > 512 ? 24 : 40, 7 + n); skip.push([n, a.skip]); plain.push([n, a.plain]); last = a; });
      data = { skip: skip, plain: plain, last: last };
    }
    var log = false;
    function draw(dur) {
      if (!data) compute();
      c.render({ x: { scale: 'log', min: 8, max: 2048, label: 'keys in the list (n)' }, y: log ? { scale: 'log', min: 1, max: 2000, label: 'comparisons per search' } : { min: 0, max: 1100, label: 'comparisons per search' },
        series: [{ id: 'plain', label: 'plain list', points: data.plain, state: 'compare', markers: true }, { id: 'skip', label: 'skip list', points: data.skip, state: 'active', markers: true }],
        highlight: [{ series: 'skip', x: 2048 }, { series: 'plain', x: 2048 }] }, { duration: dur });
      var l = data.last; stats.update({ n: '2,048', skip: l.skip.toFixed(1), plain: l.plain.toFixed(0), tall: l.height.toFixed(1) });
    }
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale (vertical)', checked: false, onChange: function (on) { log = on; draw(700); } });
    L38.whenNear(fig, function () { V.onVisible(fig, function (vis) { if (vis && !fig.__ran) { fig.__ran = true; draw(900); } }); });
  }

  /* ================================================================== Bloom: false-positive chart */
  function bloomFpFigure() {
    var fig = V.$('#fig-bloom-fp'); if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Formula (1 − e^(−kn/m))^k', shape: 'line' }, { state: 'compare', label: 'Measured with the real hash', shape: 'line' }]);
    var c = chart(fig.querySelector('[data-stage]'), { type: 'line', height: 300, label: 'False-positive rate against words added',
      format: function (v, axis) { return axis === 'y' || (typeof axis === 'object' && axis && axis.axis === 'y') ? Math.round(v * 100) + '%' : String(v); }, valueFormat: function (v, ser) { return ser && ser.id === 'theory' || ser && ser.id === 'measured' ? (v * 100).toFixed(1) + '%' : String(v); } });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n1: 'Words until 1% false positives', fp: 'False positives at n = m/8', bestk: 'Best k at n = m/8' }, states: { fp: 'error' } });
    var m = 128, k = 3, timer = 0;
    function draw(dur) {
      var nmax = Math.round(m * 0.6), pts = [];
      for (var i = 1; i <= 10; i++) { var n = Math.max(1, Math.round(nmax * i / 10)); pts.push([n, R.bloomEmpiricalFp(m, k, n, 3000, 5 + i)]); }
      var one = null; for (var q = 1; q <= nmax; q++) if (R.bloomFpRate(m, k, q) >= 0.01) { one = q; break; }
      c.render({ x: { min: 0, max: nmax, label: 'words added (n)' }, y: { min: 0, max: 1, label: 'false-positive probability' },
        series: [{ id: 'theory', label: 'formula', fn: function (x) { return R.bloomFpRate(m, k, x); }, domain: [0.01, nmax], state: 'active' }, { id: 'measured', label: 'measured', points: pts, state: 'compare', markers: true, dashed: false }],
        annotations: one ? [{ x: one, text: '1% at n = ' + one, state: 'muted' }] : [] }, { duration: dur });
      var nn = m / 8; stats.update({ n1: one ? String(one) : 'over ' + nmax, fp: pct(R.bloomFpRate(m, k, nn), 1), bestk: R.bloomBestK(m, nn).toFixed(1) });
    }
    function later() { clearTimeout(timer); timer = setTimeout(function () { draw(500); }, 120); }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Bits m', value: '128', options: [{ value: '64', label: 'm = 64' }, { value: '128', label: 'm = 128' }, { value: '256', label: 'm = 256' }], onChange: function (v) { m = +v; later(); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Hash functions k', min: 1, max: 8, value: k, onChange: function (v) { k = v; later(); } });
    L38.whenNear(fig, function () { V.onVisible(fig, function (vis) { if (vis && !fig.__ran) { fig.__ran = true; draw(900); } }); });
  }

  /* ================================================================== quick sort race */
  function raceFigure() {
    var fig = V.$('#fig-race'); if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', label: 'Pivot' }, { state: 'compare', label: 'Compared' }, { state: 'swap', label: 'Moved' }, { state: 'done', label: 'In final place' }, { state: 'muted', label: 'Out of range' }]);
    var stage = fig.querySelector('[data-stage]');
    var rule = 'last', kind = 'sorted', n = 16, seed = 3;
    function card(cls, title) {
      var st = h('div'), tag = h('small', {}, ''), meter = h('i'), note = h('span', { class: 'rz-race__n' });
      var el = h('div', { class: cls }, h('h4', {}, h('span', {}, title), tag), note, st, h('div', { class: 'rz-bar-meter' }, meter));
      return { el: el, stage: st, tag: tag, meter: meter, note: note, title: el.querySelector('h4 span') };
    }
    var A = card('is-fixed', 'Fixed pivot: last'), B = card('is-rand', 'Random pivot');
    stage.appendChild(h('div', { class: 'rz-race' }, A.el, B.el));
    var ao = { mode: 'bars', showIndices: false, showValues: false, cellSize: 26, barHeight: 130, minValue: 0 };
    var vA = V.views.array(A.stage, Object.assign({ label: 'Quick sort with a fixed pivot' }, ao)), vB = V.views.array(B.stage, Object.assign({ label: 'Quick sort with a random pivot' }, ao));
    var frames = null, values = null, costs = null;
    var ruleName = { last: 'last', first: 'first', middle: 'middle', median3: 'median of 3' };
    function make() {
      values = kind === 'adversary' ? R.adversaryInput(n, rule, seed, 1500) : R.quickInputs(kind, n, seed);
      var sa = Q.workFrames(Q.quickLomuto(values, { pivot: rule })), sb = Q.workFrames(Q.quickLomuto(values, { pivot: 'random', seed: seed }));
      var len = Math.max(sa.length, sb.length), out = [];
      var ca = sa[sa.length - 1].ops.comparisons, cb = sb[sb.length - 1].ops.comparisons;
      costs = { a: ca, b: cb };
      for (var i = 0; i < len; i++) {
        var a = sa[Math.min(i, sa.length - 1)], b = sb[Math.min(i, sb.length - 1)], fa = i >= sa.length - 1, fb = i >= sb.length - 1;
        var cap;
        if (i === 0) cap = 'Same numbers, same algorithm, different pivot rule. Left: always the <b>' + ruleName[rule] + '</b> element. Right: a random element. Press play.';
        else if (i === len - 1) cap = 'Done. The fixed rule made <b>' + ca + '</b> comparisons, the random pivot <b>' + cb + '</b> (n = ' + n + '). ' + (ca > cb * 1.3 ? 'This input is exactly the kind a fixed rule cannot handle; the coin never cares what the input looks like.' : ca < cb * 0.8 ? 'On this input the fixed rule happened to win: random pivots are never <em>guaranteed</em> to win, only never to be beaten on average.' : 'Close: this input is not one the fixed rule is bad at. Try “Adversary’s input”.');
        else cap = 'Comparisons so far: fixed <b>' + a.ops.comparisons + '</b>' + (fa ? ' (finished)' : '') + ', random <b>' + b.ops.comparisons + '</b>' + (fb ? ' (finished)' : '') + '. Each frame is one comparison or move on either side.';
        out.push({ a: a, b: b, caption: cap, fa: fa, fb: fb, counters: { fixed: a.ops.comparisons, random: b.ops.comparisons } });
      }
      var mx = Math.max.apply(null, values);
      vA.setOptions({ maxValue: mx }); vB.setOptions({ maxValue: mx });
      vA.reset(); vB.reset(); vA.prepare(sa); vB.prepare(sb);
      A.title.textContent = 'Fixed pivot: ' + ruleName[rule]; frames = out;
      return out;
    }
    var player = null;
    function paint(st, ctx) {
      vA.render(st.a, { duration: ctx.duration }); vB.render(st.b, { duration: ctx.duration });
      var last = frames && st === frames[frames.length - 1];
      A.tag.textContent = st.fa ? 'done: ' + st.a.ops.comparisons + ' comparisons' : st.a.ops.comparisons + ' comparisons';
      B.tag.textContent = st.fb ? 'done: ' + st.b.ops.comparisons + ' comparisons' : st.b.ops.comparisons + ' comparisons';
      var mxc = Math.max(costs.a, costs.b, 1);
      A.meter.style.width = (st.a.ops.comparisons / mxc * 100) + '%'; B.meter.style.width = (st.b.ops.comparisons / mxc * 100) + '%';
      A.note.textContent = st.fa ? 'finished' : 'sorting…'; B.note.textContent = st.fb ? 'finished' : 'sorting…';
      A.el.classList.toggle('is-winner', !!last && costs.a < costs.b); B.el.classList.toggle('is-winner', !!last && costs.b < costs.a);
    }
    var first = make();
    player = V.player({ root: fig, steps: first, render: paint, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { fixed: 'Fixed-pivot comparisons', random: 'Random-pivot comparisons' }, counterStates: { fixed: 'swap', random: 'done' }, baseStepMs: 220, animMs: 160, speeds: [0.5, 1, 2, 4, 8], speed: 2, label: 'Race controls' });
    var raceChart = null;
    function regen() { var st = make(); player.setSteps(st); if (raceChart) raceChart.update(); }
    var tb = fig.querySelector('[data-toolbar]');
    var s1 = h('div'), s2 = h('div'), s3 = h('div', { style: { flex: '0 1 200px' } });
    tb.appendChild(s1); tb.appendChild(s2); tb.appendChild(s3);
    tb.appendChild(btn('New seed', function () { seed = newSeed(); regen(); }));
    V.segmented(s1, { label: 'Fixed pivot rule', value: rule, options: [{ value: 'last', label: 'Last' }, { value: 'first', label: 'First' }, { value: 'middle', label: 'Middle' }, { value: 'median3', label: 'Median of 3' }], onChange: function (v) { rule = v; regen(); } });
    V.segmented(s2, { label: 'Input', value: kind, options: [{ value: 'sorted', label: 'Sorted' }, { value: 'reversed', label: 'Reversed' }, { value: 'random', label: 'Random' }, { value: 'equal', label: 'All equal' }, { value: 'adversary', label: 'Adversary’s input' }], onChange: function (v) { kind = v; regen(); } });
    V.slider(s3, { label: 'Items n', min: 8, max: 24, value: n, onChange: function (v) { n = v; regen(); } });

    /* comparisons-vs-n chart, driven by the same rule and input */
    var cf = V.$('#fig-race-chart');
    if (cf) {
      V.legend(cf.querySelector('[data-legend]'), [{ state: 'error', label: 'Fixed pivot', shape: 'line' }, { state: 'done', label: 'Random pivot (average of 6 runs)', shape: 'line' }, { state: 'muted', label: 'n log₂ n', shape: 'dash', color: 'var(--ink-3)' }]);
      var ch = chart(cf.querySelector('[data-stage]'), { type: 'line', height: 300, label: 'Comparisons against array size for a fixed pivot and a random pivot' });
      var stats = V.stats(cf.querySelector('[data-stats]'), { labels: { n: 'n', fixed: 'Fixed pivot', random: 'Random pivot', ratio: 'Ratio' }, states: { fixed: 'swap', random: 'done' } });
      var timer = 0;
      raceChart = {
        update: function () { clearTimeout(timer); timer = setTimeout(draw, 60); }
      };
      var draw = function () {
        var sizes = kind === 'adversary' ? [8, 12, 16, 20, 24, 32, 40, 48] : [8, 16, 32, 48, 64, 96, 128, 160, 192, 224];
        if (sizes.indexOf(n) < 0) sizes = sizes.concat([n]).sort(function (a, b) { return a - b; });
        var fx = [], rd = [];
        sizes.forEach(function (m) {
          var vs = kind === 'adversary' ? R.adversaryInput(m, rule, seed, m > 32 ? 900 : 1500) : R.quickInputs(kind, m, seed);
          fx.push([m, R.quickComparisons(vs, rule)]);
          var t = 0; for (var q = 1; q <= 6; q++) t += R.quickComparisons(vs, 'random', q * 13 + m); rd.push([m, t / 6]);
        });
        var top = Math.max.apply(null, fx.map(function (p) { return p[1]; }).concat(rd.map(function (p) { return p[1]; })));
        ch.render({ x: { min: 8, max: sizes[sizes.length - 1], label: 'array size n' }, y: { min: 0, max: top * 1.05, label: 'comparisons' },
          series: [{ id: 'fixed', label: 'fixed pivot', points: fx, state: 'error', markers: true }, { id: 'random', label: 'random pivot', points: rd, state: 'done', markers: true },
            { id: 'ref', label: 'n log₂ n', fn: function (x) { return x * Math.log2(x); }, domain: [8, sizes[sizes.length - 1]], state: 'muted', dashed: true }],
          highlight: [{ series: 'fixed', x: n }, { series: 'random', x: n }] }, { duration: 500 });
        var f = fx[sizes.indexOf(n)][1], r = rd[sizes.indexOf(n)][1];
        stats.update({ n: n, fixed: fmtInt(f), random: r.toFixed(0), ratio: (f / r).toFixed(1) + '×' });
      };
      L38.whenNear(cf, function () { V.onVisible(cf, function (vis) { if (vis && !cf.__ran) { cf.__ran = true; draw(); } }); });
    }
  }

  /* ================================================================== Las Vegas or Monte Carlo? */
  function decideFigure() {
    var fig = V.$('#fig-decide'); if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Current question' }, { state: 'path', label: 'Your path', shape: 'line' }]);
    var flow = V.views.flowchart(fig.querySelector('[data-stage]'), {
      nodes: [
        { id: 'q1', type: 'decision', text: 'Always the\nright answer?', col: 0, row: 0, narrow: { col: 0, row: 0 }, maxWidth: 140 },
        { id: 'lv', type: 'end', text: 'Las Vegas\nright answer, random time', col: 0, row: 1, narrow: { col: 0, row: 1 } },
        { id: 'ex1', type: 'note', text: 'randomized quick sort · quickselect · skip-list search · guess and check', col: 0, row: 2, narrow: { col: 0, row: 2 }, maxWidth: 190 },
        { id: 'q2', type: 'decision', text: 'Time fixed\nin advance?', col: 1, row: 0, narrow: { col: 1, row: 0 }, maxWidth: 130 },
        { id: 'mc', type: 'end', text: 'Monte Carlo\nfixed time, small error', col: 1, row: 1, narrow: { col: 1, row: 1 } },
        { id: 'ex2', type: 'note', text: 'Monte Carlo π · Miller–Rabin · Bloom filter · Karger min cut', col: 1, row: 2, narrow: { col: 1, row: 2 }, maxWidth: 190 },
        { id: 'mix', type: 'end', text: 'A mix\nslow and sometimes wrong (rare)', col: 2, row: 0, narrow: { col: 2, row: 0 } }
      ],
      edges: [
        { from: 'q1', to: 'lv', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
        { from: 'q2', to: 'mc', label: 'yes' }, { from: 'q2', to: 'mix', label: 'no' },
        { from: 'lv', to: 'ex1', dashed: true, arrow: false }, { from: 'mc', to: 'ex2', dashed: true, arrow: false }
      ]
    }, { label: 'Las Vegas or Monte Carlo decision diagram', narrowWidth: 0 });
    var ALGS = [
      { name: 'Randomized quick sort', right: true, fixed: false, why: 'The output is always sorted, but the number of comparisons depends on the pivots drawn.' },
      { name: 'Bloom filter check', right: false, fixed: true, why: 'It always makes k probes, but a “maybe” can be a false positive.' },
      { name: 'Miller–Rabin', right: false, fixed: true, why: 'It runs a fixed number of rounds, and a composite can (rarely) pass them all.' },
      { name: 'Skip-list search', right: true, fixed: false, why: 'It always finds the key if present, but the number of hops depends on the coins that built the towers.' },
      { name: 'Monte Carlo π', right: false, fixed: true, why: 'n darts always take n steps, and the estimate is only near π.' },
      { name: 'Guess and check', right: true, fixed: false, why: 'Guess a random answer, verify it, repeat: whatever it returns is verified, but nobody knows how many guesses it takes.' }
    ];
    var cap = fig.querySelector('[data-caption]'), timers = [];
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function walk(a) {
      clearTimers();
      var seq = ['q1'];
      if (a.right) seq.push('lv'); else { seq.push('q2'); seq.push(a.fixed ? 'mc' : 'mix'); }
      var edges = {}, visited = [];
      seq.forEach(function (id, i) {
        timers.push(setTimeout(function () {
          if (i > 0) edges[seq[i - 1] + '->' + id] = 'path';
          flow.render({ active: id, visited: visited.slice(), edgeStates: Object.assign({}, edges) }, { duration: V.dur(500) });
          visited.push(id);
          if (i === 0) cap.innerHTML = '<b>' + esc(a.name) + '.</b> ' + esc(a.why) + ' Question 1: is the answer always right? <b>' + (a.right ? 'Yes' : 'No') + '.</b>';
          if (i === seq.length - 1) cap.innerHTML = '<b>' + esc(a.name) + ' is ' + (a.right ? 'Las Vegas' : a.fixed ? 'Monte Carlo' : 'a mix') + '.</b> ' + esc(a.why);
        }, i * (V.reducedMotion() ? 0 : 900)));
      });
    }
    var host = fig.querySelector('[data-choices]');
    ALGS.forEach(function (a, i) {
      var b = btn(a.name, function () { Array.prototype.forEach.call(host.children, function (c) { c.setAttribute('aria-pressed', 'false'); }); b.setAttribute('aria-pressed', 'true'); walk(a); }, 'btn--soft');
      b.setAttribute('aria-pressed', 'false'); host.appendChild(b);
    });
    flow.render({ active: 'q1' }, { duration: 0 });
    cap.innerHTML = 'Pick an algorithm above and watch the two questions decide its kind.';
  }

  /* ================================================================== amplification chart */
  function ampFigure() {
    var fig = V.$('#fig-amp'); if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Chance that all k runs are wrong', shape: 'line' }, { state: 'muted', label: 'One in a billion', shape: 'dash', color: 'var(--ink-3)' }]);
    var c = chart(fig.querySelector('[data-stage]'), { type: 'line', height: 280, label: 'Chance that every repetition is wrong against the number of repetitions, log scale', labels: false });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { p: 'One run wrong', k: 'Runs', all: 'All runs wrong', odds: 'That is one in' }, states: { all: 'done' } });
    var p = 0.25, k = 10;
    function sup(n) { return String(n).split('').map(function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]; }).join(''); }
    function odds(x) { var o = 1 / x; if (o < 1e12) return fmtInt(o); var e = Math.floor(Math.log10(o)); return (o / Math.pow(10, e)).toFixed(1) + ' × 10' + sup(e); }
    function draw(dur) {
      c.render({ x: { min: 0, max: 30, label: 'independent runs (k)' }, y: { scale: 'log', min: 1e-18, max: 1, label: 'chance every run is wrong' },
        series: [{ id: 'all', label: 'p^k', fn: function (x) { return Math.pow(p, x); }, domain: [0, 30], state: 'active' }],
        highlight: { series: 'all', x: k, y: Math.pow(p, k) }, annotations: [{ y: 1e-9, text: 'one in a billion', state: 'muted' }] }, { duration: dur });
      var all = Math.pow(p, k);
      stats.update({ p: p === 0.5 ? '1/2' : p === 0.25 ? '1/4' : '1/10', k: k, all: all.toExponential(1).replace('e-', ' × 10⁻'), odds: odds(all) });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Chance one run is wrong', value: '0.25', options: [{ value: '0.5', label: '1/2 (a coin)' }, { value: '0.25', label: '1/4 (Miller–Rabin)' }, { value: '0.1', label: '1/10' }], onChange: function (v) { p = +v; draw(500); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Runs k', min: 1, max: 30, value: k, onChange: function (v) { k = v; draw(120); } });
    L38.whenNear(fig, function () { V.onVisible(fig, function (vis) { if (vis && !fig.__ran) { fig.__ran = true; draw(800); } }); });
  }

  /* ================================================================== variations: mini interactives */
  function universalMini() {
    var host = V.$('#mini-universal'); if (!host) return;
    var keys = V.range(10, 1).map(function (i) { return i * 7; }), m = 7, P = 101, rnd = V.rng(9), a = 37, b = 5;
    var fixedBars = h('div', { class: 'rz-bars' }), randBars = h('div', { class: 'rz-bars' }), info = h('p', { class: 'rz-note' });
    host.appendChild(h('div', { class: 'rz-uni' }, h('p', { class: 'rz-head' }, 'FIXED HASH  x mod 7'), fixedBars, h('p', { class: 'rz-head' }, 'RANDOM HASH  ((a·x + b) mod 101) mod 7'), randBars, info,
      h('div', { class: 'btn-row' }, btn('Draw new a and b', function () { a = rnd.int(1, P - 1); b = rnd.int(0, P - 1); draw(); }, 'btn--primary'))));
    function bars(el, fn, cls) {
      var loads = new Array(m).fill(0); keys.forEach(function (x) { loads[fn(x)]++; });
      V.clear(el);
      loads.forEach(function (c, i) { el.appendChild(h('div', { class: 'rz-bars__col' }, h('div', { class: 'rz-bars__bar ' + cls, style: { height: (c / keys.length * 100) + '%' }, title: c + ' keys' }, h('span', {}, c || '')), h('small', {}, String(i)))); });
      return Math.max.apply(null, loads);
    }
    function draw() {
      var f = bars(fixedBars, function (x) { return x % m; }, 'is-bad'), r = bars(randBars, function (x) { return ((a * x + b) % P) % m; }, 'is-good');
      info.innerHTML = 'The 10 keys are all multiples of 7. Fixed hash: fullest bucket holds <b>' + f + '</b>. With a = ' + a + ', b = ' + b + ': fullest bucket holds <b>' + r + '</b>.';
    }
    draw();
  }
  function millerRabinMini() {
    var host = V.$('#mini-mr'); if (!host) return;
    var n = 221, rnd = V.rng(4), a = 174;
    function mulmod(x, y, mod) { return (x * y) % mod; }
    function pow(x, e, mod) { var r = 1; x %= mod; while (e > 0) { if (e & 1) r = mulmod(r, x, mod); x = mulmod(x, x, mod); e >>= 1; } return r; }
    function test(base, N) {
      var d = N - 1, s2 = 0; while (d % 2 === 0) { d /= 2; s2++; }
      var x = pow(base, d, N), seq = [x];
      if (x === 1 || x === N - 1) return { seq: seq, d: d, s: s2, witness: false };
      for (var r = 1; r < s2; r++) { x = mulmod(x, x, N); seq.push(x); if (x === N - 1) return { seq: seq, d: d, s: s2, witness: false }; }
      return { seq: seq, d: d, s: s2, witness: true };
    }
    function liars(N) { var c = 0, t = 0; for (var b = 2; b <= N - 2; b++) { t++; if (!test(b, N).witness) c++; } return { liars: c, total: t }; }
    var out = h('div', { class: 'rz-mr', 'aria-live': 'polite' }), info = h('p', { class: 'rz-note' });
    var segHost = h('div');
    host.appendChild(h('div', {}, segHost, out, info, h('div', { class: 'btn-row' }, btn('Pick a random base a', function () { a = rnd.int(2, n - 2); draw(); }, 'btn--primary'))));
    V.segmented(segHost, { label: 'Number to test', value: '221', options: [{ value: '221', label: '221 = 13 × 17' }, { value: '223', label: '223 (prime)' }], onChange: function (v) { n = +v; a = rnd.int(2, n - 2); draw(); } });
    function draw() {
      var t = test(a, n), l = liars(n);
      var chain = t.seq.map(function (x, i) { return '<span class="pill">' + a + '<sup>' + t.d + (i ? '·2<sup>' + i + '</sup>' : '') + '</sup> mod ' + n + ' = <b>' + x + '</b></span>'; }).join(' ');
      out.innerHTML = '<p>n − 1 = ' + (n - 1) + ' = 2<sup>' + t.s + '</sup> × ' + t.d + '. Base <b>a = ' + a + '</b>:</p><p>' + chain + '</p><p><b>' +
        (t.witness ? 'a = ' + a + ' is a witness: ' + n + ' is proven composite.' : (n === 223 ? 'The chain reaches 1 or −1 (= ' + (n - 1) + '), as a prime always does. Passed.' : 'a = ' + a + ' is a liar: the chain looks prime-like, so this base learns nothing.')) + '</b></p>';
      info.textContent = 'Of ' + l.total + ' possible bases for ' + n + ', ' + l.liars + ' pass' + (n === 223 ? ' (all of them, because it is prime).' : ' (' + pct(l.liars / l.total) + ' at most 1/4 by theory). Ten random bases all lying has probability about ' + Math.pow(l.liars / l.total, 10).toExponential(1).replace('e-', ' × 10⁻') + '.');
    }
    draw();
  }
  function countMinMini() {
    var host = V.$('#mini-cms'); if (!host) return;
    var ROWS = 3, COLS = 12, grid = [], words = ['cat', 'dog', 'emu', 'fox', 'yak'], truth = {};
    for (var r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0));
    function idx(w, row) { return R.bloomIndexes(w, COLS, ROWS)[row]; }
    var table = h('div', { class: 'rz-cms' }), info = h('p', { class: 'rz-note', 'aria-live': 'polite' }, 'Add some words, then read off the estimates.'), touched = null;
    var btns = h('div', { class: 'btn-row' });
    host.appendChild(h('div', {}, table, info, btns));
    function add(w, times) { for (var t = 0; t < times; t++) for (var r2 = 0; r2 < ROWS; r2++) grid[r2][idx(w, r2)]++; truth[w] = (truth[w] || 0) + times; touched = w; draw(); }
    function est(w) { var m = Infinity; for (var r3 = 0; r3 < ROWS; r3++) m = Math.min(m, grid[r3][idx(w, r3)]); return m; }
    words.forEach(function (w) { btns.appendChild(btn('+ ' + w, function () { add(w, 1); }, 'btn--soft')); btns.appendChild(btn('+ 5 ' + w, function () { add(w, 5); }, 'btn--soft')); });
    btns.appendChild(btn('Clear', function () { grid = grid.map(function (row) { return row.map(function () { return 0; }); }); truth = {}; touched = null; draw(); }, 'btn--ghost'));
    function draw() {
      V.clear(table);
      for (var r4 = 0; r4 < ROWS; r4++) {
        var row = h('div', { class: 'rz-cms__row' });
        for (var c = 0; c < COLS; c++) row.appendChild(h('span', { class: 'rz-cms__cell' + (touched && idx(touched, r4) === c ? ' is-hit' : '') + (grid[r4][c] ? ' is-on' : '') }, String(grid[r4][c])));
        table.appendChild(row);
      }
      var parts = Object.keys(truth).map(function (w) { var e = est(w); return '<b>' + w + '</b>: true ' + truth[w] + ', estimate ' + e + (e > truth[w] ? ' (over by ' + (e - truth[w]) + ')' : ''); });
      info.innerHTML = parts.length ? parts.join(' · ') + '. Estimate = the smallest of its ' + ROWS + ' cells.' : 'Add some words, then read off the estimates.';
    }
    draw();
  }
  function treapMini() {
    var host = V.$('#mini-more'); if (!host) return;
    var nodes = [{ k: 'E', p: 9, x: 150, y: 28 }, { k: 'B', p: 7, x: 82, y: 82 }, { k: 'H', p: 5, x: 218, y: 82 }, { k: 'A', p: 2, x: 46, y: 136 }, { k: 'D', p: 4, x: 118, y: 136 }, { k: 'G', p: 1, x: 182, y: 136 }];
    var edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5]];
    var svg = s('svg', { viewBox: '0 0 300 172', role: 'img', 'aria-label': 'A treap: keys A to H in binary-search order left to right, random priorities decreasing toward the leaves' });
    svg.style.width = '100%'; svg.style.maxWidth = '320px';
    edges.forEach(function (e) { svg.appendChild(s('line', { x1: nodes[e[0]].x, y1: nodes[e[0]].y, x2: nodes[e[1]].x, y2: nodes[e[1]].y, style: 'stroke: var(--el-edge); stroke-width: 2' })); });
    nodes.forEach(function (n) {
      svg.appendChild(s('circle', { cx: n.x, cy: n.y, r: 19, style: 'fill: color-mix(in srgb, var(--st-key) 18%, var(--el-fill)); stroke: var(--st-key); stroke-width: 2' }));
      svg.appendChild(s('text', { x: n.x, y: n.y - 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font: 750 14px var(--font-sans); fill: var(--ink)' }, n.k));
      svg.appendChild(s('text', { x: n.x, y: n.y + 12, 'text-anchor': 'middle', style: 'font: 600 9.5px var(--font-mono); fill: var(--ink-3)' }, 'p=' + n.p));
    });
    host.appendChild(svg);
    host.appendChild(h('p', { class: 'rz-note', style: { marginTop: '6px' } }, 'Keys are in search-tree order; random priorities p make every parent bigger than its children, like a heap.'));
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-shuffle-why', {
      question: 'Why can the naive shuffle (swap slot i with a random slot from all n) never be perfectly fair?',
      options: ['Random number generators are never truly random', 'Swapping a slot with itself is a bug', 'It visits the slots in the wrong direction', 'With 3 items it makes 27 equally likely sequences of choices, and 27 cannot be split evenly among the 6 orders'],
      answer: 3,
      explain: ['Even with a perfect random source the naive shuffle is biased: the bias comes from the algorithm.', 'Swapping with itself is needed: keeping an item in place must be possible.', 'The direction does not matter. What matters is that j is drawn only from slots not yet fixed.', 'Yes: n choices out of n each time gives n<sup>n</sup> equally likely runs, which is not a multiple of n! for n ≥ 3. Fisher–Yates makes n! runs, one per order.'],
      id: 'shuffle-why'
    });
    V.quiz('#quiz-tenth', {
      question: 'A reservoir of size <b>k = 3</b> samples a stream. What is the probability that the <b>10th</b> item is in the reservoir <em>right after it arrives</em>?',
      options: ['1/10', '1/3', '3/10', '1 (the reservoir is full, so it always replaces something)'],
      answer: 2,
      explain: ['That would be the chance for k = 1. With 3 places, the item’s die has 3 keep faces out of 10.', '1/3 is the chance that a specific slot is chosen given that the item is kept, not the chance that it is kept.', 'Yes: roll a 10-sided die; faces 1 to 3 mean keep, so k/i = 3/10.', 'A full reservoir does not force a replacement: the die can also say “drop”.'],
      id: 'reservoir-tenth', hint: 'How many of the 10 die faces say keep?'
    });
    V.quiz('#quiz-height', {
      question: 'About how many levels tall is the tallest tower in a skip list with <b>16</b> keys (fair coins)?',
      options: ['About 5 (log₂ 16 = 4, plus the bottom level and a little luck)', 'About 2', 'About 8', 'About 16'],
      answer: 0,
      explain: ['Yes: the expected number of towers reaching level h is 16 / 2<sup>h−1</sup>, which falls to about 1 near h = 5. The exact expected maximum is about 5.4.', 'With 16 keys, the expected number reaching level 3 is 16/4 = 4, so there are surely towers taller than 2.', 'A tower of height 8 needs seven heads in a row: chance 1/128 per key, about 12 % for the whole list.', 'That would be one level per key, which is a plain list stacked on itself. Coins halve the crowd at each level.'],
      id: 'skip-height'
    });
    V.quiz('#quiz-bloom', {
      question: 'Can a Bloom filter answer “definitely not in the set” for a word that <em>was</em> added?',
      options: ['Yes, once the filter gets too full', 'Yes, with probability equal to the false-positive rate', 'No: adding sets bits, bits never clear, so an added word’s bits are all 1 forever', 'Only if two hash functions collide on the same bit'],
      answer: 2,
      explain: ['A fuller filter causes more false <em>positives</em>, never false negatives.', 'The false-positive rate describes words that were never added.', 'Yes. Adding sets all k of the word’s bits, and nothing ever sets a bit back to 0, so a check finds every one of them still 1. That is why the answer “no” is certain and “yes” is only “maybe”.', 'Two hashes sharing a bit is harmless: it is set by the add and stays set.'],
      id: 'bloom-no-false-negative'
    });
    V.quiz('#quiz-adversary', {
      question: 'Randomized quick sort chooses the pivot uniformly at random. Someone hands it an already <em>sorted</em> array of a million numbers. What can you say?',
      options: ['It is quadratic: sorted input is the worst case for quick sort', 'Its expected running time is O(n log n), exactly as for any other input', 'It is fast because sorted input is the best case', 'It is fast only for inputs the adversary did not choose'],
      answer: 1,
      explain: ['That is true for a <em>fixed</em> rule such as “last element”, not for a random pivot.', 'Yes: the guarantee is over the algorithm’s own coins, so it holds for every input, sorted or adversarial.', 'Sorted input is not special to a random pivot: it is neither best nor worst.', 'The adversary can choose any input; the coins are drawn after that, so no input is bad in advance.'],
      id: 'adversary'
    });
    V.quiz('#quiz-kind', {
      question: 'Which of these are <b>Monte Carlo</b> algorithms (fixed running time, small chance of a wrong answer)? Pick all that apply.',
      options: ['Miller–Rabin primality test', 'Bloom filter lookup', 'Randomized quick sort', 'Skip-list search', 'Estimating π with random darts'],
      answer: [0, 1, 4],
      explain: 'Miller–Rabin, a Bloom filter and dart-throwing all finish in a fixed number of steps and can be wrong. Randomized quick sort and skip-list search always return the right answer; only their running time depends on the coins, so they are Las Vegas.',
      id: 'kinds'
    });
  }

  /* ================================================================== summary tiles */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid'); if (!grid) return;
    function svgOf(inner, label) { var e = s('svg', { viewBox: '0 0 120 64', role: 'img', 'aria-label': label }); e.style.width = '100%'; e.style.maxHeight = '64px'; inner.forEach(function (c) { e.appendChild(c); }); return e; }
    var fillA = 'fill: color-mix(in srgb, var(--st-active) 25%, var(--el-fill)); stroke: var(--st-active); stroke-width: 1.5';
    var fillD = 'fill: color-mix(in srgb, var(--st-done) 25%, var(--el-fill)); stroke: var(--st-done); stroke-width: 1.5';
    var plain = 'fill: var(--el-fill); stroke: var(--el-edge-strong); stroke-width: 1.5';
    var txt = 'font: 700 11px var(--font-mono); fill: var(--ink); text-anchor: middle';
    function box(x, y, w, hh, st) { return s('rect', { x: x, y: y, width: w, height: hh, rx: 4, style: st }); }
    var tiles = [
      { svg: svgOf([box(6, 10, 44, 20, fillD), s('text', { x: 28, y: 24, style: txt }, 'right'), box(6, 38, 44, 20, plain), s('text', { x: 28, y: 52, style: txt }, 'fast'), box(66, 10, 48, 20, plain), s('text', { x: 90, y: 24, style: txt }, 'time?'), box(66, 38, 48, 20, fillA), s('text', { x: 90, y: 52, style: txt }, 'answer?')], 'Las Vegas: right answer, random time. Monte Carlo: fixed time, maybe wrong'), label: 'Las Vegas or Monte Carlo', text: 'Pay in time (always right) or in certainty (fixed time).' },
      { svg: svgOf([0, 1, 2, 3, 4].map(function (i) { return box(8 + i * 22, 20, 20, 24, i >= 3 ? fillD : plain); }).concat([s('text', { x: 60, y: 60, style: 'font: 600 9.5px var(--font-sans); fill: var(--ink-3); text-anchor: middle' }, 'draw j from 0…i only')]), 'Fisher–Yates: slots to the right are final'), label: 'Fisher–Yates', text: 'Draw j from the slots still open. Never swap with any slot.' },
      { svg: svgOf([0, 1, 2].map(function (i) { return box(10 + i * 34, 30, 28, 22, fillD); }).concat([s('text', { x: 60, y: 20, style: 'font: 750 15px var(--font-mono); fill: var(--ink); text-anchor: middle' }, 'k / i')]), 'Reservoir sampling keeps item i with probability k over i'), label: 'Reservoir sampling', text: 'Keep item i with probability k/i. Uniform without knowing n.' },
      { svg: svgOf([s('line', { x1: 8, x2: 112, y1: 52, y2: 52, style: 'stroke: var(--el-edge); stroke-width: 2' }), s('line', { x1: 8, x2: 112, y1: 34, y2: 34, style: 'stroke: var(--st-path); stroke-width: 2.5' }), s('line', { x1: 8, x2: 112, y1: 16, y2: 16, style: 'stroke: var(--el-edge); stroke-width: 2' })].concat([[20, 3], [44, 1], [64, 2], [88, 1], [104, 3]].map(function (t) { var out = []; for (var l = 0; l < t[1]; l++) out.push(box(t[0] - 5, 47 - l * 18, 10, 10, l === 1 ? fillA : plain)); return out; }).reduce(function (a, b) { return a.concat(b); }, [])), 'Skip list: towers of random height'), label: 'Skip list', text: 'Coin-flip towers give O(log n) expected search, no rotations.' },
      { svg: svgOf([0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return box(8 + i * 13.5, 42, 12, 16, [1, 4, 6].indexOf(i) >= 0 ? fillA : plain); }).concat([s('path', { d: 'M60 14 C40 24 30 30 27 42', style: 'fill:none;stroke:var(--st-compare);stroke-width:2' }), s('path', { d: 'M60 14 L67 42', style: 'fill:none;stroke:var(--st-compare);stroke-width:2' }), s('path', { d: 'M60 14 C80 24 90 30 89 42', style: 'fill:none;stroke:var(--st-compare);stroke-width:2' })]), 'Bloom filter: hash arrows set bits'), label: 'Bloom filter', text: 'Any 0 means definitely not. All 1s means maybe. No false negatives.' },
      { svg: svgOf([s('path', { d: 'M8 8 C30 14 44 42 112 52', style: 'fill:none;stroke:var(--st-active);stroke-width:2.5' }), s('path', { d: 'M8 56 C30 50 44 44 112 52', style: 'fill:none;stroke:var(--ink-3);stroke-width:1.5;stroke-dasharray:3 4' }), s('text', { x: 92, y: 26, style: 'font: 700 11px var(--font-mono); fill: var(--ink-2); text-anchor: middle' }, '1/√n')], 'Monte Carlo error shrinks like one over root n'), label: 'Monte Carlo error', text: '100× more samples buys 10× more accuracy. Repeat to shrink one-sided error.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  }

  /* ================================================================== finale */
  function finale() {
    var map = V.$('#finale-map'), count = V.$('#finale-count'); if (!map) return;
    var cur = window.VDSA_CURRICULUM, lessons = cur ? cur.lessons : [];
    function paint() {
      var p = V.progress ? V.progress.get() : { completed: [], visited: [] };
      V.clear(map);
      lessons.forEach(function (l) {
        var done = p.completed.indexOf(l.id) >= 0, seen = p.visited.indexOf(l.id) >= 0;
        map.appendChild(h('i', { title: l.number + '. ' + l.title + (done ? ' (completed)' : seen ? ' (visited)' : ''), style: { opacity: done ? 1 : seen ? 0.5 : 0.18, background: done ? 'var(--st-done)' : 'var(--ink-3)' } }));
      });
      count.textContent = lessons.length ? p.completed.length + ' of ' + lessons.length + ' lessons marked complete on this device. Mark this one complete below to add the last square.' : '';
    }
    paint();
    if (V.progress && V.progress.onChange) V.progress.onChange(paint);
  }

  /* ================================================================== start */
  V.ready(function () {
    var steps = [heroTeaser, adversaryMinis, kindsMinis, piFigure, shuffleFigure, heatFigure, exactFigure,
      L38.labs.reservoir, reservoirHist, towersFigure, L38.labs.skip, skipCostFigure, L38.labs.bloom, bloomFpFigure,
      raceFigure, decideFigure, ampFigure, function () { V.tabs('#variants'); universalMini(); millerRabinMini(); countMinMini(); treapMini(); }, checks, summaryCard, finale];
    steps.forEach(function (fn) { try { fn(); } catch (e) { console.error('[lesson 38] ' + (fn.name || 'figure') + ' failed', e); } });
  });
}());
