/* Lesson 17 — counting sort figures: the three-pass mechanism, the stability comparison, the code-synced lab and its
   flowchart. Steps come from VDSA.algos.sorting.counting (js/algos/17-linear-time-sorts.js).
     L17.countingView(host, {chart})   input / count / output rows (VDSA.views.array) + a live count histogram
     L17.initCountSteps(), L17.initCountStable(), L17.initCountLab() */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L17 = V.lessons.l17;
  function S() { return V.algos.sorting; }

  var CLASSIC = [2, 5, 3, 0, 2, 3, 0, 3];
  function labelled(vals) { return S().labelDuplicates(vals); }

  var LEGEND = [
    { state: 'compare', label: 'Item being read' }, { state: 'swap', label: 'Counter changing' },
    { state: 'visited', label: 'Counted / reserved stretch' }, { state: 'active', label: 'Stretch being filled' },
    { state: 'done', label: 'Placed: final' }, { state: 'muted', label: 'Already placed' }
  ];

  /* ================================================================== view: rows + histogram */
  L17.countingView = function (host, o) {
    o = o || {};
    var arrHost = h('div', { class: 'l17-cview__rows' });
    host.appendChild(arrHost);
    var view = V.views.array(arrHost, { mode: 'boxes', cellSize: o.cellSize || 46, label: o.label || 'Counting sort: input, counters and output', rowLabels: 'auto' });
    var chartHost = null, chart = null, n = 0, k = 0;
    if (o.chart) {
      chartHost = h('div', { class: 'l17-cview__chart' });
      host.appendChild(chartHost);
      chart = V.views.chart(chartHost, { type: 'bar', height: o.chartHeight || 132, label: 'Counters as bars', valueLabels: true });
    }
    function toState(step) { return { rows: step.rows }; }
    function drawChart(step, dur) {
      if (!chart) return;
      var cnt = step.rows[1].items;
      var hot = null;
      cnt.forEach(function (c, v) { if (c.state === 'swap') hot = v; });
      chart.render({
        categories: cnt.map(function (c, v) { return String(v); }),
        series: [{ id: 'count', label: 'count[v]', values: cnt.map(function (c) { return c.value; }), state: step.phase === 'prefix' ? 'visited' : step.phase === 'place' ? 'compare' : 'active' }],
        y: { label: 'count[key]', min: 0, max: Math.max(1, step.n) },
        highlight: hot === null ? undefined : { category: String(hot) }
      }, { duration: dur });
    }
    return {
      el: host,
      render: function (step, ctx) {
        var dur = ctx ? ctx.duration : 0;
        view.render(toState(step), { duration: dur });
        drawChart(step, dur);
      },
      prepare: function (steps) { view.prepare(steps.map(toState)); return this; },
      reset: function () { view.reset(); return this; },
      view: view
    };
  };

  /* ================================================================== three-pass mechanism */
  L17.initCountSteps = function () {
    var fig = V.$('#fig-cs-steps');
    var all = S().counting(labelled(CLASSIC));
    function idx(kind) { return all.findIndex(function (s) { return s.kind === kind; }); }
    var tallyDone = idx('tallyDone'), prefixDone = idx('prefixDone');
    var slices = {
      count: all.slice(0, tallyDone + 1),
      prefix: all.slice(tallyDone, prefixDone + 1),
      place: all.slice(prefixDone)
    };
    var cv = L17.countingView(fig.querySelector('[data-stage]'), { chart: false, cellSize: 50, label: 'Counting sort on 2, 5, 3, 0, 2, 3, 0, 3' });
    cv.prepare(all);
    var cur = 'count';
    var player = V.player({
      root: fig, steps: slices.count, render: function (s, ctx) { cv.render(s, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Key compares', tallies: 'Tallies', additions: 'Additions', placements: 'Placed' },
      counterStates: { comparisons: 'error', tallies: 'compare', additions: 'swap', placements: 'done' },
      baseStepMs: 1050, label: 'Counting sort passes'
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Pass', value: cur,
      options: [{ value: 'count', label: '1 · Count' }, { value: 'prefix', label: '2 · Prefix sums' }, { value: 'place', label: '3 · Place' }],
      onChange: function (v) { cur = v; player.setSteps(slices[v]); }
    });
    V.legend(fig.querySelector('[data-legend]'), LEGEND);
    return player;
  };

  /* ================================================================== right to left vs left to right */
  L17.initCountStable = function () {
    var fig = V.$('#fig-cs-stable');
    var stage = fig.querySelector('[data-stage]');
    var vals = labelled(CLASSIC);
    var R = S().counting(vals), Lx = S().counting(vals, { direction: 'ltr' });
    function slice(steps) { return steps.filter(function (s) { return s.kind === 'prefixDone' || s.kind === 'place' || s.kind === 'done'; }); }
    var r = slice(R), l = slice(Lx);
    function mk(title, cls) {
      var box = h('div', { class: 'l17-twin ' + cls }, h('p', { class: 'l17-twin__title' }, title));
      var host = h('div', {});
      box.appendChild(host); stage.appendChild(box);
      return L17.countingView(host, { cellSize: 44, label: title });
    }
    var vr = mk('Right to left: the stable way', 'is-good');
    var vl = mk('Left to right: sorted, but not stable', 'is-bad');
    // drop the counter row here: this figure is about the input and output only
    function noCount(s) { return Object.assign({}, s, { rows: s.rows.filter(function (row) { return row.id !== 'cnt'; }) }); }
    function view(vw, s, ctx) { vw.view.render({ rows: noCount(s).rows }, { duration: ctx.duration }); }
    var steps = r.map(function (s, t) { return { a: s, b: l[t], t: t }; });
    vr.view.prepare(r.map(noCount)); vl.view.prepare(l.map(noCount));
    function nameOf(step) {
      var newest = step.rows[2].items.filter(function (it) { return it.from; })[0];
      return newest ? { text: newest.value + (newest.label || ''), slot: newest.index } : null;
    }
    function orderText(step) {
      return step.rows[2].items.slice().sort(function (x, y) { return x.index - y.index; }).map(function (it) { return it.value + (it.label || ''); }).join(' ');
    }
    // captions come from a tiny per-step map so both rows are described together
    steps.forEach(function (s, t) {
      if (t === 0) s.caption = 'Both rows start from the same prefix sums: each key owns the same stretch of the output. They differ only in the order the items are visited.';
      else if (t === steps.length - 1) s.caption = '<b>Right to left:</b> ' + orderText(s.a) + ': equal keys keep their input order (a before b before c). <b>Left to right:</b> ' + orderText(s.b) + ': every group of equal keys came out reversed.';
      else {
        var x = nameOf(s.a), y = nameOf(s.b);
        s.caption = '<b>Right to left</b> writes <b>' + x.text + '</b> into slot ' + x.slot + '. <b>Left to right</b> writes <b>' + y.text + '</b> into slot ' + y.slot + '. Each takes the last free slot of its key’s stretch.';
      }
    });
    V.player({
      root: fig, steps: steps, baseStepMs: 1000, label: 'Placement order comparison',
      render: function (s, ctx) { view(vr, s.a, ctx); view(vl, s.b, ctx); },
      caption: fig.querySelector('[data-caption]')
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Item being read' }, { state: 'done', label: 'Placed: final' }, { state: 'muted', label: 'Already placed' }, { state: 'active', label: 'Stretch being filled' }]);
    return null;
  };

  /* ================================================================== flowchart lit by the lab */
  var FLOW = {
    nodes: [
      { id: 'init', type: 'start', text: 'count = k + 1 zeros', col: 0, row: 0 },
      { id: 'tallyQ', type: 'decision', text: 'items left\nto tally?', col: 0, row: 1 },
      { id: 'tally', type: 'process', text: 'count[a[i]] += 1', col: 1, row: 1 },
      { id: 'prefixQ', type: 'decision', text: 'v ≤ k ?', col: 0, row: 2 },
      { id: 'prefix', type: 'process', text: 'count[v] += count[v − 1]', col: 1, row: 2 },
      { id: 'placeQ', type: 'decision', text: 'items left\nto place?\n(i from the right)', col: 0, row: 3 },
      { id: 'place', type: 'process', text: 'count[a[i]] −= 1\nout[count[a[i]]] = a[i]', col: 1, row: 3 },
      { id: 'done', type: 'end', text: 'return out', col: 0, row: 4 }
    ],
    edges: [
      { from: 'init', to: 'tallyQ' },
      { from: 'tallyQ', to: 'tally', label: 'yes' },
      { from: 'tally', to: 'tallyQ', via: { fromSide: 'top', toSide: 'top' } },
      { from: 'tallyQ', to: 'prefixQ', label: 'no' },
      { from: 'prefixQ', to: 'prefix', label: 'yes' },
      { from: 'prefix', to: 'prefixQ', via: { fromSide: 'top', toSide: 'top' } },
      { from: 'prefixQ', to: 'placeQ', label: 'no' },
      { from: 'placeQ', to: 'place', label: 'yes' },
      { from: 'place', to: 'placeQ', via: { fromSide: 'top', toSide: 'top' } },
      { from: 'placeQ', to: 'done', label: 'no' }
    ]
  };

  /* ================================================================== the lab */
  L17.initCountLab = function () {
    var fig = V.$('#lab-count');
    var flowFig = V.$('#fig-flow');
    var values = CLASSIC.slice();
    var cv = L17.countingView(fig.querySelector('[data-stage]'), { chart: true, cellSize: 46, chartHeight: 128, label: 'Counting sort lab: input, counters and output' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE17.counting, default: 'pseudo', maxHeight: 337, title: 'countingSort' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW, { label: 'Flowchart of counting sort', narrowWidth: 380 });
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);
    var flowAdapter = {
      highlight: function (id, ctx) {
        var visited = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var q = 0; q < ctx.index && q < st.length; q++) if (st[q].flow && visited.indexOf(st[q].flow) === -1 && st[q].flow !== id) visited.push(st[q].flow);
        }
        flowView.render({ active: id || undefined, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };
    function generate() { return S().counting(labelled(values)); }
    var steps = generate();
    cv.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { cv.render(s, ctx); },
      code: code, vars: vars, flow: flowAdapter,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Key compares', tallies: 'Tallies', additions: 'Additions', placements: 'Placed' },
      counterStates: { comparisons: 'error', tallies: 'compare', additions: 'swap', placements: 'done' },
      baseStepMs: 950, label: 'Counting sort lab controls'
    });

    /* predictions */
    player.addCheckpoint(function (st) {
      for (var q = 1; q < st.length; q++) if (st[q].kind === 'prefix') return q;
      return -1;
    }, function (c) {
      var v = c.step.vars, cnt = c.prev.rows[1].items;
      var idx = c.step.rows[1].items.findIndex(function (it) { return it.state === 'swap'; });
      if (idx < 1) return null;
      var own = cnt[idx].value, before = cnt[idx - 1].value, want = own + before;
      var opts = [want, own, before + 1].filter(function (x, q, arr) { return arr.indexOf(x) === q; });
      while (opts.length < 3) opts.push(want + opts.length);
      return L17.shuffleSpec({
        question: 'The prefix pass reaches key <b>' + idx + '</b>. <code>count[' + idx + ']</code> is ' + own + ' and <code>count[' + (idx - 1) + ']</code> is ' + before + '. What does <code>count[' + idx + ']</code> become?',
        options: opts.map(String), answer: 0,
        explain: opts.map(function (x, q) {
          if (q === 0) return 'Right: ' + own + ' + ' + before + ' = ' + want + '. It now counts every item whose key is ' + idx + ' or less.';
          if (x === own) return 'That would leave the counter unchanged. The prefix pass adds the previous counter, so the running total keeps growing.';
          return 'Add the previous counter, ' + before + ', to this counter’s own value, ' + own + '.';
        })
      });
    }, { id: 'l17-lab-prefix' });

    player.addCheckpoint(function (st) {
      for (var q = 1; q < st.length; q++) if (st[q].kind === 'take') return q;
      return -1;
    }, function (c) {
      var ptr = c.step.rows[2].pointers.filter(function (p) { return p.name === 'slot'; })[0];
      if (!ptr) return null;
      var slot = ptr.index, key = c.step.vars.key, lo = null;
      c.step.rows[2].regions.forEach(function (r) { if (r.state === 'active') lo = r.from; });
      var before = c.prev.rows[1].items[key].value;
      var opts = [slot, before, lo === null || lo === slot ? slot + 1 : lo].filter(function (x, q, arr) { return arr.indexOf(x) === q; });
      while (opts.length < 3) opts.push(opts[opts.length - 1] + 1);
      return L17.shuffleSpec({
        question: 'The last input item has key <b>' + key + '</b>, and <code>count[' + key + ']</code> is <b>' + before + '</b>. Which output slot will it be written to?',
        options: opts.map(function (x) { return 'Slot ' + x; }), answer: 0,
        explain: opts.map(function (x, q) {
          if (q === 0) return 'Right. Decrement first: count[' + key + '] becomes ' + (before - 1) + ', and that is the slot. It is the last free slot of key ' + key + '’s stretch, which is where the last copy belongs.';
          if (x === before) return 'Slot ' + before + ' is one past the stretch: count[' + key + '] is the <em>end</em> of the stretch, exclusive. Subtract 1 before using it.';
          return 'Slot ' + x + ' is the <em>start</em> of the stretch. The first copy goes there, but the last copy, which we visit first, takes the last slot.';
        })
      });
    }, { id: 'l17-lab-place' });

    /* input */
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your keys (0 to 12 whole numbers from 0 to 9)',
      value: values,
      parse: { min: 0, max: 9, maxCount: 12, minCount: 0, integers: true },
      presets: [
        { label: 'Classic', value: CLASSIC },
        { label: 'Random', value: function () { return V.presets.random(9, { min: 0, max: 9 }); } },
        { label: 'Sorted', value: function () { return V.presets.sorted(8, { min: 0, max: 9 }); } },
        { label: 'Reversed', value: function () { return V.presets.reversed(8, { min: 0, max: 9 }); } },
        { label: 'Few unique', title: 'Many equal keys: watch stability', value: function () { return V.presets.fewUnique(10, { min: 0, max: 9, k: 3 }); } },
        { label: 'Wide gap', title: 'Keys 0 and 9 only: most counters stay 0', value: [9, 0, 9, 0, 9, 0] },
        { label: 'All equal', value: [4, 4, 4, 4, 4] },
        { label: 'One value', value: [7] }
      ],
      hint: 'Repeated keys get a, b, c tags in input order. The count row has one counter for every key from 0 up to your largest key.',
      onApply: function (vals) {
        values = vals; steps = generate();
        cv.reset(); cv.prepare(steps);
        player.setSteps(steps);
      }
    });
    V.legend(fig.querySelector('[data-legend]'), LEGEND);
    return { player: player };
  };
}());
