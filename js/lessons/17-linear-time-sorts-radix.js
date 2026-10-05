/* Lesson 17 — the bucket figures: hero teaser, the "deal into pockets" figure, the radix sort lab (with a stable / stack
   toggle) and bucket sort. Steps come from VDSA.algos.sorting.radix / .bucket; drawing is L17.bucketView.
     L17.initHero(), L17.initPigeon(), L17.initRadixLab(), L17.initBucket() */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L17 = V.lessons.l17;
  function S() { return V.algos.sorting; }

  var PLACE = ['ones', 'tens', 'hundreds', 'thousands'];
  function headerFor(step) {
    if (!step || !step.pass || step.kind === 'init') return '';
    if (step.kind === 'done') return step.items.every(function (i) { return i.state === 'done'; }) ? 'sorted' : 'not sorted';
    return 'pass ' + step.pass + ' of ' + step.d + ' · ' + (PLACE[step.pass - 1] || 'digit ' + step.pass) + ' digit';
  }
  function withHeader(step) { return Object.assign({}, step, { header: headerFor(step) }); }

  /* ================================================================== hero: numbers drop into buckets and back */
  L17.initHero = function () {
    var stage = V.$('#teaser');
    var view = L17.bucketView(stage, { label: 'Numbers dropping into digit buckets', chipH: 30, showHeader: true });
    var rng = V.rng(1954);
    function data() {
      var vals = V.presets.random(7, { min: 11, max: 98, rng: rng, unique: true });
      var all = S().radix(vals);
      // batch the deal: one step per phase (every number drops, then every bucket empties) so a lap takes ~7 seconds
      var out = [withHeader(all[0])];
      var d = all[0].d;
      for (var p = 1; p <= d; p++) {
        var drops = all.filter(function (s) { return s.pass === p && s.kind === 'drop'; });
        var collects = all.filter(function (s) { return s.pass === p && s.kind === 'collect'; });
        var end = all.filter(function (s) { return s.pass === p && s.kind === 'passEnd'; })[0];
        var afterDrops = drops[drops.length - 1];
        out.push(withHeader(Object.assign({}, afterDrops, { pos: p - 1, items: afterDrops.items.map(function (it) { return Object.assign({}, it, { state: 'default' }); }) })));
        out.push(withHeader(Object.assign({}, end, { pos: p - 1, items: end.items.map(function (it) { return Object.assign({}, it, { state: p === d ? 'done' : 'visited' }); }) })));
        void collects;
      }
      out = out.map(function (s) { return Object.assign({}, s, { activeBucket: null, listLabel: 'numbers' }); });
      view.reset(); view.prepare(out);
      return out;
    }
    var first = data();
    V.teaser(stage, {
      steps: first, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      stepMs: 1700, holdMs: 2000, regenerate: data, staticIndex: 3
    });
  };

  /* ================================================================== pigeonhole figure (one digit, ten pockets) */
  L17.initPigeon = function () {
    var fig = V.$('#fig-pigeon');
    var view = L17.bucketView(fig.querySelector('[data-stage]'), { label: 'Twelve scores dealt into ten pockets', chipH: 30 });
    var seed = 5;
    function scores() {
      var r = V.rng(seed), out;
      do { out = []; for (var i = 0; i < 12; i++) out.push(r.int(0, 9)); } while (Math.max.apply(null, out) < 6);
      return out;
    }
    function build() {
      var vals = scores(), all = S().radix(vals);
      var st = all.filter(function (s) { return s.kind !== 'pass' && s.kind !== 'passEnd'; }).map(function (s) {
        var c = Object.assign({}, s.counters); delete c.passes;
        return Object.assign({}, s, { header: s.kind === 'init' ? '' : 'a score is its own pocket number', listLabel: 'scores', counters: c });
      });
      // captions in the plain "score" language of this figure; no digit highlight (a score has one digit)
      st.forEach(function (s, k) {
        s.pos = -1;
        if (s.kind === 'init') s.caption = 'Twelve scores, each a whole number from 0 to 9. Ten pockets are ready, one per possible score. Press <b>next</b> to deal the first card.';
        else if (s.kind === 'drop') {
          var it = s.items.filter(function (i) { return i.state === 'swap'; })[0];
          var behind = s.items.filter(function (i) { return i.where === 'bucket' && i.bucket === it.bucket && i.depth < it.depth; }).length;
          s.caption = 'Score <b>' + it.value + '</b> goes into pocket <b>' + it.value + '</b>: its own value is the address, so nothing is compared. ' + (behind ? 'It lands on the pile behind ' + behind + ' earlier card' + (behind === 1 ? '' : 's') + '.' : 'The pocket was empty.');
        } else if (s.kind === 'collect') {
          var ids = s.items.filter(function (i) { return i.state === 'swap'; });
          s.caption = 'Empty pocket <b>' + s.activeBucket + '</b> into the row: ' + ids.map(function (i) { return '<b>' + i.value + '</b>'; }).join(', ') + '. Pockets are read from 0 upward, so the row fills in order.';
        } else if (s.kind === 'done') s.caption = 'Sorted: <b>' + s.items.slice().sort(function (a, b) { return a.index - b.index; }).map(function (i) { return i.value; }).join(', ') + '</b>. Twelve cards dealt, twelve collected, <b>0</b> comparisons: about 2n steps plus one look at each pocket.';
        void k;
      });
      view.reset(); view.prepare(st);
      return st;
    }
    var steps = build();
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', drops: 'Cards dealt', collected: 'Cards collected' },
      counterStates: { comparisons: 'error', drops: 'swap', collected: 'done' },
      baseStepMs: 620, label: 'Dealing scores into pockets'
    });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { seed = (seed * 7919 + 13) % 100003; player.setSteps(build()); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'swap', label: 'Card being moved' }, { state: 'done', label: 'Sorted' }, { state: 'active', shape: 'outline', label: 'Pocket in use' }]);
    return player;
  };

  /* ================================================================== radix lab */
  var RLEG = [
    { state: 'swap', label: 'Number moving' }, { state: 'visited', label: 'Ordered by the last p digits' },
    { state: 'done', label: 'Sorted' }, { state: 'error', label: 'Out of order' }, { state: 'pivot', shape: 'outline', label: 'Digit being read' }
  ];
  L17.initRadixLab = function () {
    var fig = V.$('#lab-radix');
    var view = L17.bucketView(fig.querySelector('[data-stage]'), { label: 'Radix sort: numbers and ten digit buckets', chipH: 30 });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: S().CODE17.radix, default: 'pseudo', maxHeight: 337, title: 'radixSort' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var CLASSIC = [170, 45, 75, 90, 802, 24, 2, 66];
    var values = CLASSIC.slice(), stable = true;
    function generate() { return S().radix(S().labelDuplicates(values), { stable: stable }).map(withHeader); }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', passes: 'Passes', drops: 'Dropped into buckets', collected: 'Collected back' },
      counterStates: { comparisons: 'error', passes: 'pivot', drops: 'swap', collected: 'done' },
      baseStepMs: 720, label: 'Radix sort lab controls'
    });

    player.addCheckpoint(function (st) {
      for (var q = 1; q < st.length; q++) if (st[q].kind === 'drop' && st[q].pass === 2) return q;
      return -1;
    }, function (c) {
      var moving = c.step.items.filter(function (i) { return i.state === 'swap'; })[0];
      if (!moving) return null;
      var v = moving.value, dig = Math.floor(v / 10) % 10, ones = v % 10, hun = Math.floor(v / 100) % 10;
      var opts = [dig, ones, hun].filter(function (x, q, arr) { return arr.indexOf(x) === q; });
      var pad = 0; while (opts.length < 3) { if (opts.indexOf(pad) < 0) opts.push(pad); pad++; }
      return L17.shuffleSpec({
        question: 'Pass 2 reads the <b>tens</b> digit. Which bucket will <b>' + v + '</b> be dealt into?',
        options: opts.map(function (x) { return 'Bucket ' + x; }), answer: 0,
        explain: opts.map(function (x) {
          if (x === dig) return 'Right. The tens digit of ' + v + ' is ' + dig + (v < 10 ? ' (a one-digit number has a leading zero in the tens place)' : '') + '.';
          if (x === ones) return 'That is the ones digit, which pass 1 already used. Pass 2 moves one position to the left.';
          if (x === hun) return 'That is the hundreds digit, which is the last pass. Pass 2 reads the tens digit.';
          return 'That is not a digit of ' + v + ' in the tens place.';
        })
      });
    }, { id: 'l17-lab-bucket' });

    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (0 to 10 whole numbers from 0 to 999)',
      value: values,
      parse: { min: 0, max: 999, maxCount: 10, minCount: 0, integers: true },
      presets: [
        { label: 'Classic', value: CLASSIC },
        { label: 'Random', value: function () { return V.presets.random(8, { min: 1, max: 999 }); } },
        { label: 'Many ties', title: 'Numbers that share digits: stability matters', value: [31, 21, 11, 32, 22, 12, 33, 13] },
        { label: 'Two digits', value: function () { return V.presets.random(8, { min: 10, max: 99 }); } },
        { label: 'Sorted', value: function () { return V.presets.sorted(8, { min: 1, max: 999 }); } },
        { label: 'Reversed', value: function () { return V.presets.reversed(8, { min: 1, max: 999 }); } },
        { label: 'Short and long', value: [7, 100, 45, 3, 999, 12] },
        { label: 'One digit', value: [5, 3, 9, 3, 1] }
      ],
      hint: 'Shorter numbers get leading zeros (shown faded). Equal numbers get a, b, c tags.',
      onApply: function (vals) { values = vals; reload(); }
    });
    function reload() { steps = generate(); view.reset(); view.prepare(steps); player.setSteps(steps); }
    V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Bucket type', value: 'queue',
      options: [{ value: 'queue', label: 'Queue (stable)' }, { value: 'stack', label: 'Stack (breaks it)' }],
      onChange: function (v) { stable = v === 'queue'; reload(); }
    });
    V.legend(fig.querySelector('[data-legend]'), RLEG);
    return { player: player };
  };

  /* ================================================================== bucket sort */
  L17.initBucket = function () {
    var fig = V.$('#fig-bucket');
    var view = L17.bucketView(fig.querySelector('[data-stage]'), { label: 'Bucket sort on numbers between 0 and 1', chipH: 30, maxChipW: 56 });
    var SPREAD = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68];
    var values = SPREAD.slice(), k = 5;
    function generate() { return S().bucket(values, { buckets: k }); }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons (inside buckets)', scattered: 'Scattered', sortedBuckets: 'Buckets sorted', collected: 'Collected' },
      counterStates: { comparisons: 'compare', scattered: 'swap', sortedBuckets: 'pivot', collected: 'done' },
      baseStepMs: 820, label: 'Bucket sort controls'
    });
    function reload() { steps = generate(); view.reset(); view.prepare(steps); player.setSteps(steps); }
    function rnd(n, lo, hi) { var r = V.rng(Math.floor(Math.random() * 1e6)); var out = []; for (var i = 0; i < n; i++) out.push(Math.round((lo + r() * (hi - lo)) * 100) / 100); return out; }
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Numbers from 0 to 0.99 (up to 12)',
      value: values,
      parse: function (text) {
        var r = V.parseNumbers(text, { min: 0, max: 0.99, maxCount: 12, minCount: 0, integers: false });
        if (!r.error) r.values = r.values.map(function (x) { return Math.round(x * 100) / 100; });
        return r;
      },
      presets: [
        { label: 'Spread evenly', value: SPREAD },
        { label: 'Random', value: function () { return rnd(10, 0, 0.99); } },
        { label: 'Clustered', title: 'All in one bucket: the worst case', value: [0.51, 0.55, 0.53, 0.59, 0.52, 0.58, 0.54, 0.57] },
        { label: 'One per bucket', value: [0.05, 0.25, 0.45, 0.65, 0.85] },
        { label: 'Sorted', value: [0.05, 0.15, 0.28, 0.33, 0.47, 0.52, 0.66, 0.71, 0.86, 0.93] },
        { label: 'One value', value: [0.42] }
      ],
      hint: 'Two decimals, each at least 0 and below 1.',
      onApply: function (vals) { values = vals; reload(); }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Buckets', value: String(k),
      options: [{ value: '3', label: '3 buckets' }, { value: '5', label: '5 buckets' }, { value: '8', label: '8 buckets' }],
      onChange: function (v) { k = +v; reload(); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'swap', label: 'Number being dealt' }, { state: 'compare', label: 'Bucket being insertion-sorted' }, { state: 'done', label: 'Final position' }, { state: 'active', shape: 'outline', label: 'Bucket in use' }]);
    return player;
  };
}());
