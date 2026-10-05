/* Lesson 13 — the second half of the figures: cost charts, the scale explorer, boundaries, binary search on the answer,
   bisection, the classic bugs (overflow gauge + stuck loops), the "can I binary search this?" chooser, the checks and the
   summary card. Uses VDSA.algos.binarySearch and the helpers in 13-binary-search-views.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L13 = V.lessons.l13;
  function B() { return V.algos.binarySearch; }
  function fmt(v) { return L13.fmt(v); }

  /* ================================================================== cost: worst-case comparisons vs n */
  L13.initGrowth = function () {
    var fig = V.$('#fig-growth');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Worst-case comparisons of linear and binary search', hover: true });
    var N = 64, log = false;
    function stairs(max) {
      var pts = [], k = 1;
      for (var p = 1; p <= max; p *= 2) {
        var w = B().worstCase(p), next = Math.min(p * 2 - 0.001, max);
        pts.push([p, w]); if (next > p) pts.push([next, w]);
      }
      var last = pts[pts.length - 1];
      if (last[0] < max) pts.push([max, B().worstCase(max)]);
      return pts;
    }
    var NOTE = {
      16: 'n = 16: linear search may need 16 comparisons, binary search never more than 5.',
      64: 'n = 64: linear search up to 64 comparisons, binary search 7. The staircase steps up by one each time n passes a power of two: 1, 2, 4, 8, 16, 32, 64.',
      1000: 'n = 1,000: 1,000 comparisons against 10. On the straight scale the binary curve hugs the floor; switch to the log scale to see its staircase.'
    };
    function draw(dur) {
      var ymax = log ? N * 1.5 : N;
      var series = [
        { id: 'lin', label: 'Linear, worst case (n)', points: [[1, 1], [N, N]], state: 'path', markers: false },
        { id: 'avg', label: 'Linear, average ((n+1)/2)', points: [[1, 1], [N, (N + 1) / 2]], state: 'muted', dashed: true, markers: false },
        { id: 'bin', label: 'Binary, worst case (⌊log₂ n⌋ + 1)', points: stairs(N), state: 'done', markers: false }
      ];
      chart.render({
        x: { label: 'input size n', min: 1, max: N, scale: log ? 'log' : 'linear' },
        y: log ? { label: 'comparisons (log scale)', scale: 'log', min: 1, max: ymax } : { label: 'comparisons', min: 0, max: ymax },
        series: series, highlight: [{ series: 'lin', x: N, label: L13.num(N) }, { series: 'bin', x: N, label: String(B().worstCase(N)) }]
      }, { duration: dur === undefined ? 700 : dur });
      fig.querySelector('[data-note]').textContent = NOTE[N] + (log ? ' (Log scale: each gridline is ten times the last.)' : '');
    }
    var rangeHost = fig.querySelector('[data-range]');
    V.segmented(rangeHost, {
      label: 'n up to', value: 64,
      options: [{ value: 16, label: '16' }, { value: 64, label: '64' }, { value: 1000, label: '1,000' }],
      onChange: function (v) { N = v; draw(); }
    });
    var tog = h('div', { class: 'l13-toolbar-toggle' });
    rangeHost.parentNode.appendChild(tog);
    V.toggle(tog, { label: 'Log scale', checked: false, onChange: function (on) { log = on; draw(); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'path', shape: 'line', label: 'Linear worst case' }, { state: 'muted', shape: 'dash', label: 'Linear average' }, { state: 'done', shape: 'line', label: 'Binary worst case' }]);
    draw(0);
  };

  /* ================================================================== cost: scale explorer */
  function unit(v, word) { var r = Math.round(v * 10) / 10; return r + ' ' + word + (r === 1 ? '' : 's'); }
  function human(seconds) {
    if (seconds < 1e-6) return unit(seconds * 1e9, 'nanosecond');
    if (seconds < 1e-3) return unit(seconds * 1e6, 'microsecond');
    if (seconds < 1) return unit(seconds * 1e3, 'millisecond');
    if (seconds < 120) return unit(seconds, 'second');
    if (seconds < 7200) return unit(seconds / 60, 'minute');
    if (seconds < 172800) return unit(seconds / 3600, 'hour');
    if (seconds < 86400 * 730) return unit(seconds / 86400, 'day');
    return unit(seconds / 86400 / 365.25, 'year');
  }
  var SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function sup(n) { return String(n).split('').map(function (c) { return SUP[c]; }).join(''); }
  L13.initScale = function () {
    var fig = V.$('#fig-scale');
    var rows = { linear: fig.querySelector('[data-row="linear"]'), binary: fig.querySelector('[data-row="binary"]') };
    var caption = fig.querySelector('[data-caption]');
    var MAXE = 15;
    function draw(e) {
      var n = Math.pow(10, e), lin = n, bin = B().worstCase(n);
      var wl = Math.max(2, Math.log10(lin) / MAXE * 100), wb = Math.max(2, Math.log10(bin) / MAXE * 100);
      rows.linear.querySelector('[data-fill]').style.width = wl + '%';
      rows.binary.querySelector('[data-fill]').style.width = wb + '%';
      rows.linear.querySelector('[data-num]').textContent = L13.num(lin);
      rows.binary.querySelector('[data-num]').textContent = L13.num(bin);
      caption.innerHTML = 'With <b>n = ' + L13.num(n) + '</b> values: linear search needs up to <b>' + L13.num(lin) + '</b> comparisons (' + human(lin / 1e9) + ' at a billion per second); binary search needs <b>' + bin + '</b> (' + human(bin / 1e9) + ').';
    }
    var sl = V.slider(fig.querySelector('[data-slider]'), { label: 'n = 10ᵏ', min: 1, max: MAXE, step: 1, value: 6, format: function (v) { return '10' + sup(v) + ' = ' + L13.compact(Math.pow(10, v)); }, onInput: draw });
    draw(6);
  };

  /* ================================================================== boundaries: lower / upper bound explorer */
  L13.initBounds = function () {
    var fig = V.$('#fig-bounds');
    var A = [1, 2, 2, 4, 4, 4, 4, 7, 7, 9, 9, 9, 12, 14], n = A.length;
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 46, label: 'Sorted values with repeats and the bounds of x' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { lower: 'Lower bound', upper: 'Upper bound', count: 'Copies of x', first: 'First occurrence', last: 'Last occurrence', insert: 'Insert position' }, states: { lower: 'active', upper: 'pivot', count: 'found' } });
    var x = 4, focus = 'bounds';
    function calc(x) {
      var lo = B().probes(A, x, 'lower').result, up = B().probes(A, x, 'upper').result;
      return { lower: lo, upper: up, count: up - lo, first: up > lo ? lo : -1, last: up > lo ? up - 1 : -1 };
    }
    function state(x) {
      var c = calc(x), ptrs = [], regs = [];
      var items = A.map(function (v, i) { return { id: 'b' + i, value: v, state: v === x ? 'found' : 'default' }; });
      if (focus === 'bounds') {
        ptrs.push({ name: 'lower', index: c.lower, state: 'active', side: 'below', id: 'p-lower' });
        ptrs.push({ name: 'upper', index: c.upper, state: 'pivot', side: 'below', id: 'p-upper' });
        if (c.count > 0) regs.push({ id: 'r1', from: c.lower, to: c.upper - 1, state: 'found', label: c.count + ' × ' + x });
      } else if (focus === 'ends') {
        if (c.count > 0) {
          ptrs.push({ name: 'first', index: c.first, state: 'active', side: 'below', id: 'p-first' });
          ptrs.push({ name: 'last', index: c.last, state: 'pivot', side: 'below', id: 'p-last' });
          regs.push({ id: 'r1', from: c.first, to: c.last, state: 'found', label: 'x from first to last' });
        } else ptrs.push({ name: 'none: −1', index: Math.min(c.lower, n - 1), state: 'error', side: 'below', id: 'p-first' });
      } else {
        ptrs.push({ name: 'insert here', index: c.lower, state: 'key', side: 'below', id: 'p-ins' });
      }
      return { items: items, pointers: ptrs, regions: regs, c: c };
    }
    function draw(dur) {
      var st = state(x), c = st.c;
      view.render(st, { duration: dur === undefined ? 450 : dur });
      var keys = focus === 'bounds' ? { lower: c.lower, upper: c.upper, count: c.count } : focus === 'ends' ? { first: c.first, last: c.last, count: c.count } : { insert: c.lower };
      stats.update(keys);
      var cap;
      if (focus === 'bounds') cap = c.count > 0 ? 'x = <b>' + x + '</b>: the lower bound is <b>' + c.lower + '</b> (first value ≥ ' + x + ') and the upper bound is <b>' + c.upper + '</b> (first value &gt; ' + x + '). The <b>' + c.count + '</b> copies fill indexes ' + c.lower + ' to ' + (c.upper - 1) + '.' :
        'x = <b>' + x + '</b> is not in the array, so both bounds are the same index, <b>' + c.lower + '</b>: no copies fit between them.';
      else if (focus === 'ends') cap = c.count > 0 ? 'First occurrence = lower bound = <b>' + c.first + '</b>. Last occurrence = upper bound − 1 = <b>' + c.last + '</b>. Both are checked against x, because for an absent x the bound is just a position.' : 'x = <b>' + x + '</b> is absent: the item at the lower bound is not x (or there is none), so both searches return −1.';
      else cap = 'To keep the array sorted after inserting <b>' + x + '</b>, put it at index <b>' + c.lower + '</b>, the lower bound: every value before it is smaller, and it goes before any equal copies' + (c.lower === n ? ' (past the end)' : '') + '.';
      fig.querySelector('[data-caption]').innerHTML = cap;
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'x', min: 0, max: 15, step: 1, value: x, format: function (v) { return 'x = ' + v; }, onInput: function (v) { x = v; draw(); } });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Show', value: 'bounds',
      options: [{ value: 'bounds', label: 'Lower & upper bound' }, { value: 'ends', label: 'First & last' }, { value: 'insert', label: 'Insert position' }],
      onChange: function (v) { focus = v; draw(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'found', label: 'Equal to x' }, { state: 'active', shape: 'dot', label: 'Lower bound' }, { state: 'pivot', shape: 'dot', label: 'Upper bound' }]);
    view.prepare([state(4), state(0), state(15)]);
    draw(0);
  };

  /* ================================================================== binary search on the answer */
  L13.initAnswer = function () {
    var fig = V.$('#fig-answer');
    var stripHost = fig.querySelector('[data-stage]');
    var strip = L13.strip(stripHost, { label: 'Candidate answers, decided by halving' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: B().ANSWER_CODE, default: 'js', maxHeight: 300 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var kind = 'ship', weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], days = 5, sqrtX = 30;
    var inputHost = fig.querySelector('[data-input]'), sliderHost = fig.querySelector('[data-slider]');
    var sqrtSlider, daySlider, input;
    function problem() { return kind === 'ship' ? { kind: 'ship', weights: weights, days: days } : { kind: 'sqrt', x: sqrtX }; }
    var steps = B().answerSteps(problem());
    var player = V.player({ root: fig, steps: steps, render: function (st, ctx) { strip.render(st, { duration: ctx.duration }); }, code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { evaluations: 'Tests run', left: 'Candidates left' }, counterStates: { evaluations: 'compare', left: 'active' },
      baseStepMs: 1250, label: 'Search on the answer controls' });
    player.addCheckpoint(function (st) { for (var k = 1; k < st.length; k++) if (st[k].kind === 'test') return k; return -1; }, function (c) {
      var p = c.step, mid = p.mid, truth = p.probe;
      var info = B().problemInfo(problem());
      return { question: 'The search is about to test <code>' + mid + '</code> (' + (kind === 'ship' ? 'a ship capacity' : 'a value of m') + '). ' + (kind === 'ship' ? 'Can everything be shipped within ' + days + ' days at this capacity?' : 'Is <code>' + mid + '² &gt; ' + sqrtX + '</code>?'),
        options: ['False: not yet true', 'True'], answer: truth ? 1 : 0, explain: [truth ? 'Not quite. ' + strip2text(info.explain(mid)) : 'Right. ' + strip2text(info.explain(mid)), truth ? 'Right. ' + strip2text(info.explain(mid)) : 'Not quite. ' + strip2text(info.explain(mid))] };
    }, { id: 'l13-answer-test' });
    function strip2text(html) { return html; }
    function reload() {
      steps = B().answerSteps(problem());
      player.setSteps(steps);
    }
    function showKind(k) {
      kind = k;
      inputHost.style.display = k === 'ship' ? '' : 'none';
      daySlider.el.style.display = k === 'ship' ? '' : 'none';
      sqrtSlider.el.style.display = k === 'sqrt' ? '' : 'none';
      reload();
    }
    input = V.inputRow(inputHost, {
      label: 'Parcel weights, in shipping order (1 to 12 numbers, 1 to 20)', value: weights,
      parse: function (text) {
        var r = V.parseNumbers(text, { min: 1, max: 20, minCount: 1, maxCount: 12, integers: true });
        if (r.error) return r;
        var mx = Math.max.apply(null, r.values), sum = r.values.reduce(function (a, b) { return a + b; }, 0);
        if (sum - mx + 1 > 62) return { values: r.values, error: 'That total is too big to draw: the number of candidate capacities (total minus the heaviest, plus one) must be at most 62. Try smaller weights.' };
        return r;
      },
      presets: [{ label: '1 to 10', value: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, { label: 'One heavy parcel', value: [9, 1, 1, 1, 1, 1, 1] }, { label: 'All equal', value: [4, 4, 4, 4, 4, 4] }],
      hint: 'The ship loads parcels in this order and must finish within D days.',
      onApply: function (vals) { weights = vals; days = Math.min(days, vals.length); daySlider.set(days); daySlider.input.max = String(Math.max(1, vals.length)); reload(); }
    });
    var daySlot = sliderHost.appendChild(h('div', { class: 'l13-slider-slot' })), sqrtSlot = sliderHost.appendChild(h('div', { class: 'l13-slider-slot' }));
    daySlider = V.slider(daySlot, { label: 'Days D', min: 1, max: 10, step: 1, value: days, onInput: function (v) { days = Math.min(v, weights.length); reload(); } });
    daySlider.el = daySlot;
    sqrtSlider = V.slider(sqrtSlot, { label: 'x', min: 2, max: 60, step: 1, value: sqrtX, format: function (v) { return 'x = ' + v; }, onInput: function (v) { sqrtX = v; reload(); } });
    sqrtSlider.el = sqrtSlot;
    var tabs = V.tabs('#answer-tabs', { onChange: function (name) { showKind(name); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'muted', label: 'False (known)' }, { state: 'done', label: 'True (known)' }, { state: 'active', shape: 'outline', label: 'Undecided (?)' }, { state: 'compare', shape: 'ring', label: 'Tested now' }]);
    showKind('ship');
    return player;
  };

  /* ================================================================== bisection */
  L13.initBisect = function () {
    var fig = V.$('#fig-bisect');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'y = x² − 2 with a shrinking bracket around its root', hover: false, height: 300 });
    function f(x) { return x * x - 2; }
    var raw = B().bisection(f, 1, 2, 8);
    var steps = raw.map(function (st) {
      var ann = [{ y: 0, text: 'y = 0', state: 'muted', id: 'zero' }, { x: st.lo, text: 'lo', state: 'active', id: 'lo' }, { x: st.hi, text: 'hi', state: 'active', id: 'hi' }];
      if (st.mid !== null && st.kind !== 'done') ann.push({ x: st.mid, text: 'mid', state: 'compare', id: 'mid' });
      var out = { x: { label: 'x', min: 1, max: 2, ticks: 5 }, y: { label: 'f(x) = x² − 2', min: -1.2, max: 2.2 }, series: [{ id: 'f', label: 'x² − 2', fn: f, domain: [1, 2], state: 'active', markers: false }], annotations: ann };
      if (st.mid !== null) out.highlight = { series: 'f', x: st.mid, label: (Math.round(st.fmid * 1e4) / 1e4) + '' };
      return { chart: out, caption: st.caption, counters: { probes: st.iter, width: Math.round(st.width * 1e6) / 1e6 } };
    });
    V.player({ root: fig, steps: steps, render: function (st, ctx) { chart.render(st.chart, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { probes: 'Probes', width: 'Interval width' }, counterStates: { probes: 'compare', width: 'active' }, baseStepMs: 1200, label: 'Bisection controls' });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'f(x)' }, { state: 'active', shape: 'dash', label: 'lo / hi bracket' }, { state: 'compare', shape: 'dash', label: 'Probe' }]);
  };

  /* ================================================================== bug 1: the overflow gauge */
  L13.initOverflow = function () {
    var fig = V.$('#fig-overflow'), stage = fig.querySelector('[data-stage]');
    var MIN = -2147483648, MAX = 2147483647, M = 1e6;
    var lo = 1500 * M, hi = 2000 * M;
    var W = 640, H = 286, pad = 20;
    var svg = s('svg', { class: 'l13-over__svg', role: 'img', 'aria-label': 'Number line for 32-bit integers with lo, hi, their sum and the middle' });
    stage.appendChild(svg);
    var g = {};
    function el(name, tag, attrs, text) { var e = s(tag, attrs); if (text) e.textContent = text; svg.appendChild(e); g[name] = e; return e; }
    var trackY = 62, trackH = 24, sumY = 146, midY = 226;
    function X(v) { return pad + (v - MIN) / (MAX - MIN + 1) * (W - 2 * pad); }
    function build() {
      V.clear(svg);
      W = Math.max(300, stage.clientWidth || 640);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
      el('title1', 'text', { class: 'l13-ov-cap', x: pad, y: 16 }, '1. A 32-bit int, with lo and hi');
      el('track', 'rect', { class: 'l13-ov-track', x: pad, y: trackY, width: W - 2 * pad, height: trackH, rx: 6 });
      el('zero', 'line', { class: 'l13-ov-zero', x1: X(0), x2: X(0), y1: trackY - 6, y2: trackY + trackH + 6 });
      el('zerotext', 'text', { class: 'l13-ov-small', x: X(0), y: trackY + trackH + 20, 'text-anchor': 'middle' }, '0');
      el('mintext', 'text', { class: 'l13-ov-small', x: pad, y: trackY + trackH + 20, 'text-anchor': 'start' }, '−2,147,483,648');
      el('maxtext', 'text', { class: 'l13-ov-small', x: W - pad, y: trackY + trackH + 20, 'text-anchor': 'end' }, '2,147,483,647');
      el('lo', 'g', { class: 'l13-ov-mk is-active' }); el('hi', 'g', { class: 'l13-ov-mk is-active' });
      el('title2', 'text', { class: 'l13-ov-cap', x: pad, y: sumY - 20 }, '2. lo + hi, to scale on the same line');
      el('sum1', 'rect', { class: 'l13-ov-sum', y: sumY - 8, height: 18, rx: 4 });
      el('sum2', 'rect', { class: 'l13-ov-sum is-wrap', y: sumY - 8, height: 18, rx: 4 });
      el('sumtext', 'text', { class: 'l13-ov-small', y: sumY + 30, 'text-anchor': 'start' }, '');
      el('title3', 'text', { class: 'l13-ov-cap', x: pad, y: midY - 22 }, '3. The middle, two ways');
      el('midline', 'line', { class: 'l13-ov-zero', x1: pad, x2: W - pad, y1: midY, y2: midY });
      el('mn', 'g', { class: 'l13-ov-mk' }); el('ms', 'g', { class: 'l13-ov-mk is-done' });
      ['lo', 'hi', 'mn', 'ms'].forEach(function (k) {
        g[k].appendChild(s('line', { class: 'l13-ov-stem' })); g[k].appendChild(s('rect', { class: 'l13-ov-pill', rx: 10, height: 20 })); g[k].appendChild(s('text', { class: 'l13-ov-pilltext', 'text-anchor': 'middle' }));
      });
    }
    function mk(name, v, label, y, up, cls, extra) {
      var e = g[name], w = Math.max(24, label.length * 6.9 + 16), x = X(Math.max(MIN, Math.min(MAX, v)));
      var px = Math.max(pad + w / 2, Math.min(W - pad - w / 2, x));
      e.setAttribute('transform', 'translate(' + px.toFixed(1) + ',0)');
      var pill = e.querySelector('.l13-ov-pill'), t = e.querySelector('.l13-ov-pilltext'), st = e.querySelector('.l13-ov-stem');
      var py = up ? y - 34 : y + 8 + (extra || 0);
      pill.setAttribute('x', -w / 2); pill.setAttribute('y', py); pill.setAttribute('width', w);
      t.setAttribute('y', py + 14.2); t.textContent = label;
      st.setAttribute('x1', x - px); st.setAttribute('x2', x - px); st.setAttribute('y1', up ? py + 20 : y); st.setAttribute('y2', up ? y : py);
      e.setAttribute('class', 'l13-ov-mk ' + cls);
    }
    function draw() {
      if (!g.track) build();
      var sum = lo + hi, wrapped = B().wrap32(sum), over = sum > MAX;
      var naive = B().midNaive(lo, hi), safe = B().midSafe(lo, hi);
      var close = Math.abs(X(hi) - X(lo)) < 48;
      mk('lo', lo, close ? 'lo = hi' : 'lo', trackY, true, 'is-active');
      if (close) { g.hi.setAttribute('class', 'l13-ov-mk is-active is-hidden'); g.hi.style.display = 'none'; }
      else { g.hi.style.display = ''; mk('hi', hi, 'hi', trackY, true, 'is-active'); }
      // the true sum: a bar from 0 to sum that leaves the line, then re-enters from the left as the wrapped value
      var x0 = X(0), xsum = X(Math.min(sum, MAX + 1));
      g.sum1.setAttribute('x', x0); g.sum1.setAttribute('width', Math.max(0, xsum - x0));
      g.sum1.setAttribute('class', 'l13-ov-sum' + (over ? ' is-over' : ''));
      if (over) { g.sum2.setAttribute('x', pad); g.sum2.setAttribute('width', Math.max(2, X(wrapped) - pad)); g.sum2.style.display = ''; }
      else g.sum2.style.display = 'none';
      g.sumtext.setAttribute('x', pad);
      g.sumtext.textContent = over ? 'lo + hi = ' + L13.num(sum) + ' wraps to ' + L13.num(wrapped) : 'lo + hi = ' + L13.num(sum) + ' fits in 32 bits';
      g.sumtext.setAttribute('class', 'l13-ov-small' + (over ? ' is-err' : ''));
      mk('mn', naive, '(lo + hi) / 2 = ' + L13.num(naive), midY, false, naive < 0 ? 'is-error' : 'is-compare', 0);
      mk('ms', safe, 'lo + (hi − lo) / 2 = ' + L13.num(safe), midY, false, 'is-done', 30);
      var cap = over
        ? '<b>Overflow.</b> lo + hi = ' + L13.num(sum) + ' is beyond the largest 32-bit int (2,147,483,647), so it wraps around to <b>' + L13.num(wrapped) + '</b>. Half of that is <b>' + L13.num(naive) + '</b>: a negative index, and <code>a[' + L13.num(naive) + ']</code> crashes or reads the wrong memory. The safe formula gives <b>' + L13.num(safe) + '</b>, because <code>hi − lo</code> is never bigger than the array.'
        : 'lo + hi = ' + L13.num(sum) + ' still fits in 32 bits, so both formulas agree: mid = <b>' + L13.num(safe) + '</b>. Drag lo and hi up until their sum passes 2,147,483,647.';
      fig.querySelector('[data-caption]').innerHTML = cap;
      if (over) fig.querySelector('[data-caption]').setAttribute('data-state', 'error'); else fig.querySelector('[data-caption]').removeAttribute('data-state');
    }
    var sLo = V.slider(fig.querySelector('[data-slider-lo]'), { label: 'lo', min: 0, max: 2147, step: 1, value: lo / M, format: function (v) { return L13.compact(v * M); }, onInput: function (v) { lo = v * M; if (hi < lo) { hi = lo; sHi.set(v); } draw(); } });
    var sHi = V.slider(fig.querySelector('[data-slider-hi]'), { label: 'hi', min: 0, max: 2147, step: 1, value: hi / M, format: function (v) { return L13.compact(v * M); }, onInput: function (v) { hi = v * M; if (lo > hi) { lo = hi; sLo.set(v); } draw(); } });
    var presets = fig.querySelector('[data-presets]');
    var tw = null;
    function goto(a, b) {
      var a0 = lo / M, b0 = hi / M;
      if (tw) tw.cancel();
      tw = V.tween(V.dur(900), function (t, e) { var A = a0 + (a - a0) * e, Bv = b0 + (b - b0) * e; lo = Math.round(A) * M; hi = Math.max(lo, Math.round(Bv) * M); sLo.set(Math.round(A)); sHi.set(hi / M); draw(); });
    }
    [['Small array (up to a million)', 0, 1], ['Bloch’s numbers: 1.5 and 2.0 billion', 1500, 2000], ['Both just over 2³⁰', 1074, 1074]].forEach(function (p) {
      presets.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { goto(p[1], p[2]); } }, p[0]));
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'dot', label: 'lo, hi' }, { state: 'error', label: 'Overflowed' }, { state: 'compare', shape: 'dot', label: 'Naive mid (fits)' }, { state: 'done', shape: 'dot', label: 'Safe mid' }]);
    V.onResize(stage, function () { g = {}; draw(); });
    draw();
  };

  /* ================================================================== bugs 2 and 3: stuck loop, missed candidate */
  L13.initBugs = function () {
    var fig = V.$('#fig-bugs');
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', cellSize: 60, label: 'Buggy binary search' });
    var kind = 'loop', fixed = false;
    var CASES = { loop: { values: [3, 7], x: 7 }, last: { values: [1, 3, 5, 7], x: 7 } };
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: B().BUG_CODE.loop.bug, default: 'js', maxHeight: 290 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    function gen() { var c = CASES[kind]; return B().bugSteps(kind, c.values, c.x, fixed); }
    var steps = gen(); view.prepare(steps);
    var player = V.player({ root: fig, steps: steps, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { rounds: 'Rounds', comparisons: 'Comparisons' }, counterStates: { rounds: 'active', comparisons: 'compare' },
      baseStepMs: 1050, label: 'Bug demo controls' });
    function reload() {
      steps = gen();
      code.setSource(B().BUG_CODE[kind][fixed ? 'fix' : 'bug']);
      view.reset(); view.prepare(steps); player.setSteps(steps);
    }
    V.segmented(fig.querySelector('[data-seg-bug]'), {
      label: 'Bug', value: 'loop',
      options: [{ value: 'loop', label: 'Endless loop: lo = mid' }, { value: 'last', label: 'Missed candidate: lo < hi' }],
      onChange: function (k) { kind = k; reload(); }
    });
    V.segmented(fig.querySelector('[data-seg-fix]'), {
      label: 'Code', value: 'bug',
      options: [{ value: 'bug', label: 'Buggy code' }, { value: 'fix', label: 'Fixed code' }],
      onChange: function (v) { fixed = v === 'fix'; reload(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Candidates' }, { state: 'compare', label: 'Probe (mid)' }, { state: 'muted', label: 'Ruled out' }, { state: 'error', label: 'Stuck / missed' }, { state: 'found', label: 'Found' }]);
  };

  /* ================================================================== can I binary search this? */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Can you jump to any position in O(1)?', col: 1, row: 0 },
      { id: 'n1', type: 'end', text: 'Not directly', col: 2, row: 0 },
      { id: 'q2', type: 'decision', text: 'Is there a yes/no test that flips once?\n(false … false, true … true)', col: 1, row: 1 },
      { id: 'n2', type: 'end', text: 'Cannot halve', col: 2, row: 1 },
      { id: 'q3', type: 'decision', text: 'What do you need?', col: 1, row: 2 },
      { id: 'e1', type: 'end', text: 'Exact search', col: 0, row: 3 },
      { id: 'e2', type: 'end', text: 'Lower bound: first true', col: 1, row: 3 },
      { id: 'e3', type: 'end', text: 'Last true: upper bound − 1', col: 2, row: 3 }
    ],
    edges: [
      { from: 'q1', to: 'n1', label: 'no' }, { from: 'q1', to: 'q2', label: 'yes' },
      { from: 'q2', to: 'n2', label: 'no' }, { from: 'q2', to: 'q3', label: 'yes' },
      { from: 'q3', to: 'e1', label: 'any match', via: { fromSide: 'left', toSide: 'top' } }, { from: 'q3', to: 'e2', label: 'first true' }, { from: 'q3', to: 'e3', label: 'last true', via: { fromSide: 'right', toSide: 'top' } }
    ]
  };
  var CHOOSE_WHY = {
    n1: '<b>Binary search needs random access.</b> On a linked list, reaching the middle costs n/2 steps, so halving saves nothing. Copy into an array, use a balanced tree (lesson 19), or scan.',
    n2: '<b>No halving without monotonicity.</b> If knowing one answer tells you nothing about the values on either side, you cannot discard half. Use a scan, a hash table, or sort first so that “is a[i] ≥ x?” flips once.',
    e1: '<b>Exact search.</b> Stops as soon as <code>a[mid] = x</code>. With duplicates it returns whichever copy the probes reach first. Use it when any match will do.',
    e2: '<b>Lower bound.</b> The first index where the test is true, for example the first value ≥ x. It also gives the insert position and, with a check, the first occurrence. Also the pattern for “smallest capacity that works”.',
    e3: '<b>Last true.</b> The last index where the test is true, for example the last value ≤ x: search for the first false (the upper bound) and step back one. That is how you find the last occurrence.'
  };
  L13.initChooser = function () {
    var fig = V.$('#fig-choose');
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Can I binary search this?', narrowWidth: 420 });
    var out = fig.querySelector('[data-answer]');
    var path = ['q1'], taken = {};
    function show(d) {
      var cur = path[path.length - 1];
      var st = {}; if (CHOOSE_WHY[cur]) st[cur] = cur === 'n1' || cur === 'n2' ? 'error' : 'found';
      view.render({ active: cur, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: st }, { duration: d === undefined ? 550 : d });
      out.innerHTML = CHOOSE_WHY[cur] || 'Answer the question in the highlighted box with one of its buttons.';
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Your current question' }, { state: 'path', shape: 'line', label: 'Your answers' }, { state: 'found', label: 'Which search to use' }, { state: 'error', label: 'Binary search does not apply' }]);
    show(0);
  };

  /* ================================================================== checks */
  L13.initChecks = function () {
    V.quiz('#quiz-lohi', {
      kicker: 'Predict', id: 'l13-quiz-lohi',
      question: 'The array is <code>2, 5, 8, 12, 16, 23, 38, 56, 72, 91</code> (indexes 0 to 9) and you search for <b>56</b>. At the start <code>lo = 0</code>, <code>hi = 9</code>, so <code>mid = 4</code> and <code>a[4] = 16</code>. What are <code>lo</code> and <code>hi</code> after that comparison?',
      options: ['<code>lo = 5</code>, <code>hi = 9</code>', '<code>lo = 4</code>, <code>hi = 9</code>', '<code>lo = 0</code>, <code>hi = 3</code>', '<code>lo = 5</code>, <code>hi = 4</code>'],
      answer: 0,
      explain: [
        'Right. 16 < 56, so 16 and everything left of it is too small. <code>lo = mid + 1 = 5</code>, and <code>hi</code> stays at 9.',
        'Close, but <code>mid</code> was just compared and is not 56, so it can go too: <code>lo = mid + 1</code>. Leaving <code>lo = mid</code> is the bug that can loop forever.',
        'That keeps the wrong half. 16 is smaller than 56, so 56 (if present) is to the <em>right</em> of index 4.',
        'A comparison moves only one bound. Here <code>hi</code> stays at 9; <code>lo</code> alone moves.'
      ]
    });
    V.quiz('#quiz-million', {
      id: 'l13-quiz-million',
      question: 'What is the most comparisons binary search can need on a sorted array of <b>1,000,000</b> values?',
      options: ['10', '19', '20', '1,000'],
      answer: 2,
      explain: [
        '2¹⁰ is only 1,024, so ten halvings leave up to a thousand candidates. Ten comparisons are not enough.',
        '2¹⁹ = 524,288 is less than a million, so after 19 comparisons up to two candidates can remain. One more comparison is needed.',
        'Right. ⌊log₂ 1,000,000⌋ + 1 = 19 + 1 = 20: 2²⁰ = 1,048,576 is the first power of two above a million.',
        'That would be a slow search, not a halving one: a thousand comparisons handle about 2¹⁰⁰⁰ values, far more than a million.'
      ]
    });
    V.quiz('#quiz-dups', {
      id: 'l13-quiz-dups',
      question: 'In <code>1, 3, 3, 3, 5</code> you search for <b>3</b>. Which search returns index <b>3</b>?',
      options: ['Lower bound', 'Upper bound', 'Last occurrence', 'Exact search'],
      answer: 2,
      explain: [
        'The lower bound is the first index with a value ≥ 3, which is index 1, not 3.',
        'The upper bound is the first index with a value &gt; 3, which is index 4. The last copy of 3 is one before that.',
        'Right. The upper bound is 4, and the last occurrence is upper bound − 1 = 3, after a check that <code>a[3] = 3</code>.',
        'Exact search stops at the first probe that matches. The first probe is the middle, index 2, so it returns 2.'
      ]
    });
    // click the value that is compared next
    var host = V.$('#fig-click [data-stage]');
    var A = [4, 9, 15, 21, 28, 34, 41, 52, 60, 77, 90];
    var view = V.views.array(host, { mode: 'boxes', cellSize: 50, label: 'Binary search for 60 after one comparison' });
    var state = {
      items: A.map(function (v, k) { return { id: 'k' + k, value: v, state: k <= 5 ? 'muted' : 'default', aria: 'Value ' + v + ' at index ' + k }; }),
      pointers: [{ name: 'lo', index: 6, state: 'active', side: 'below', id: 'p-lo' }, { name: 'hi', index: 10, state: 'active', side: 'below', id: 'p-hi' }],
      regions: [{ id: 'rl', from: 0, to: 5, state: 'muted', label: '< 60' }]
    };
    view.prepare([state]); view.render(state, { duration: 0 });
    V.$$('.vz-item', host).forEach(function (g, k) { g.setAttribute('data-id', 'k' + k); g.setAttribute('data-label', 'Index ' + k + ', value ' + A[k]); });
    V.clickQuiz(host, {
      el: '#quiz-click', id: 'l13-click-next',
      question: 'The search for <b>60</b> has compared 34 (index 5) and discarded indexes 0 to 5, so now <code>lo = 6</code> and <code>hi = 10</code>. Click the value it compares next.',
      check: function (id) {
        var k = +id.slice(1);
        if (k === 8) return true;
        if (k <= 5) return { correct: false, message: 'Index ' + k + ' is already ruled out (dimmed). The next probe is inside lo to hi, which is 6 to 10.' };
        if (k === 6) return { correct: false, message: 'Index 6 is <code>lo</code>, the left end of the range, not its middle. Binary search probes halfway between lo and hi.' };
        if (k === 10) return { correct: false, message: 'Index 10 is <code>hi</code>, the right end. The probe is halfway between lo and hi.' };
        return { correct: false, message: 'Close. <code>mid = lo + (hi − lo) div 2 = 6 + (10 − 6) div 2 = 8</code>. Count halfway from 6 to 10.' };
      },
      right: '<code>mid = 6 + (10 − 6) div 2 = 8</code>, and <code>a[8] = 60</code> is the target: found after just two comparisons.'
    });
  };

  /* ================================================================== summary card */
  L13.summaryCard = function () {
    var grid = V.$('#summary-card .summary__grid');
    function tile(svgNode, label, text) { grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, svgNode), h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text' }, text))); }
    function cells(states, o) {
      o = o || {}; var n = states.length, size = o.size || 22, w = n * (size + 3) + 8, H = 56;
      var svg = s('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'img', 'aria-label': o.label || 'Row of cells', class: 'l13m' });
      states.forEach(function (st, i) {
        var x = 4 + i * (size + 3), r = s('rect', { x: x, y: 16, width: size, height: size, rx: 4, class: 'l13m-cell is-' + st });
        svg.appendChild(r);
      });
      (o.tags || []).forEach(function (t) {
        var x = 4 + t.at * (size + 3) + size / 2, wpx = Math.max(20, t.text.length * 6.4 + 10);
        var gg = s('g', { class: 'l13m-tag is-' + (t.state || 'active'), transform: 'translate(' + x + ',0)' });
        gg.appendChild(s('rect', { x: -wpx / 2, y: t.below ? 40 : 0, width: wpx, height: 14, rx: 7 }));
        gg.appendChild(s('text', { y: t.below ? 50.5 : 10.5, 'text-anchor': 'middle' }, t.text));
        svg.appendChild(gg);
      });
      return svg;
    }
    tile(cells(['muted', 'muted', 'muted', 'muted', 'compare', 'default', 'default', 'default'], { tags: [{ at: 4, text: 'mid', state: 'compare' }, { at: 0, text: 'lo', below: true }, { at: 7, text: 'hi', below: true }], label: 'Half the row ruled out' }), 'Halve every time', 'Compare with the middle, throw away the half that cannot hold the target. Needs sorted data and random access.');
    tile(cells(['muted', 'muted', 'default', 'default', 'default', 'muted', 'muted'], { tags: [{ at: 2, text: 'lo', below: true }, { at: 4, text: 'hi', below: true }], label: 'lo and hi bracket the candidates' }), 'The invariant', 'If the target is present, it is inside a[lo..hi]. Every step shrinks the range.');
    tile(cells(['done', 'done', 'found', 'found', 'found', 'compare', 'default'], { tags: [{ at: 2, text: 'lower', below: true }, { at: 5, text: 'upper', state: 'pivot', below: true }], label: 'Bounds around equal values' }), 'Bounds', 'Lower bound = first ≥ x. Upper bound = first > x. First = lower, last = upper − 1, count = upper − lower.');
    tile(cells(['muted', 'muted', 'muted', 'done', 'done', 'done', 'done'], { tags: [{ at: 3, text: 'first true', state: 'done' }], label: 'False then true' }), 'On the answer', 'Any yes/no test that flips once can be halved: capacity, square root, time, distance.');
    tile(cells(['error', 'compare', 'default', 'default', 'default', 'default', 'error'], { tags: [{ at: 1, text: 'lo = mid', state: 'error' }], label: 'Off by one' }), 'Bug checklist', 'mid = lo + (hi − lo) / 2 avoids overflow. lo = mid + 1 avoids endless loops. lo ≤ hi keeps the last candidate.');
    tile(cells(['active', 'active', 'active', 'active', 'active', 'active', 'active', 'active'], { size: 15, tags: [{ at: 3, text: 'log₂ n', state: 'done' }], label: 'Logarithmic growth' }), 'O(log n)', '⌊log₂ n⌋ + 1 comparisons in the worst case: 20 for a million values, 30 for a billion.');
  };
}());
