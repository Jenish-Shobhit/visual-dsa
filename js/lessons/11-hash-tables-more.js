/* Lesson 11 — Hash tables: custom figures, part 2.
   The clustering race, the tombstone failure/fix, the probes-vs-load-factor chart with simulated points,
   the amortised-growth chart, the "which structure?" decision flowchart, and the set / map / worst-case tabs.
   Helpers come from js/lessons/11-hash-tables-figs.js (V.lessons.l11). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L11 = V.lessons.l11;
  function A() { return V.algos.hashing; }

  L11.COUNTER_LABELS = { entries: 'Keys stored', buckets: 'Buckets', load: 'Load α', compares: 'Key comparisons', probes: 'Slots probed', collisions: 'Collisions' };
  L11.COUNTER_STATES = { collisions: 'error', load: 'compare' };

  /* ================================================================== clustering race */
  function raceView(stage) {
    var M = 23, W = 640, LX = 104, PITCH = (W - LX - 10) / M, CW = PITCH - 2, RH = 92;
    var KINDS = ['linear', 'quadratic', 'double'];
    var NAMES = { linear: 'Linear probing', quadratic: 'Quadratic probing', double: 'Double hashing' };
    var svg = L11.svg(W, 24 + 3 * RH + 8, 'Three rows of 23 slots, one per probe rule, filling with the same keys', 800), rows = {};
    KINDS.forEach(function (k, r) {
      var y0 = 26 + r * RH, row = { cells: [], txt: [], badge: [] };
      svg.appendChild(s('text', { class: 'l11-rowname', x: 6, y: y0 + 40 }, NAMES[k].split(' ')[0]));
      svg.appendChild(s('text', { class: 'l11-note', x: 6, y: y0 + 56 }, NAMES[k].split(' ')[1]));
      for (var i = 0; i < M; i++) {
        var g = s('g', { class: 'l11-rslot', transform: 'translate(' + (LX + i * PITCH) + ' ' + (y0 + 20) + ')' },
          s('rect', { width: CW, height: 34, rx: 5 }), s('text', { class: 'l11-rkey', x: CW / 2, y: 21, 'text-anchor': 'middle' }, ''));
        var bd = s('text', { class: 'l11-rbadge', x: LX + i * PITCH + CW / 2, y: y0 + 14, 'text-anchor': 'middle' }, '');
        svg.appendChild(g); svg.appendChild(bd); row.cells.push(g); row.badge.push(bd);
      }
      row.stat = s('text', { class: 'l11-note', x: LX, y: y0 + 72 }, '');
      svg.appendChild(row.stat); rows[k] = row;
    });
    stage.appendChild(svg);
    return function render(step, ctx) {
      svg.style.setProperty('--t', ctx.duration + 'ms');
      KINDS.forEach(function (k) {
        var row = rows[k], f = step.frame ? step.frame.kinds[k] : null;
        for (var i = 0; i < M; i++) {
          var key = f ? f.slots[i] : null, isNew = f && i === f.slot, probed = f && f.probed.indexOf(i) >= 0 && !isNew;
          row.cells[i].setAttribute('class', 'l11-rslot' + (key !== null ? ' is-filled' : '') + (isNew ? ' is-new' : '') + (probed ? ' is-probe' : ''));
          row.cells[i].querySelector('text').textContent = key === null ? '' : key;
          var at = f ? f.probed.indexOf(i) : -1;
          row.badge[i].textContent = at >= 0 ? String(at + 1) : '';
        }
        row.stat.textContent = f ? 'this key: ' + f.probes + ' probe' + (f.probes === 1 ? '' : 's') + ' · total ' + f.total + ' · longest run of filled slots: ' + f.longest : 'empty';
      });
    };
  }
  L11.raceFigure = function () {
    var fig = V.$('#fig-race'), A11 = A();
    var render = raceView(fig.querySelector('[data-stage]'));
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Probed: slot was taken' }, { state: 'active', label: 'New key lands here' }, { state: 'default', shape: 'outline', label: 'Filled earlier' }]);
    var SETS = {
      same: { label: 'All share one home slot', keys: [10, 33, 56, 79, 102, 125, 148, 171], note: 'These eight keys all have home slot 10, since they differ by multiples of 23.' },
      random: { label: 'Random keys', keys: V.presets.random(12, { min: 1, max: 200, unique: true, seed: 11 }), note: 'Twelve random keys: the table fills to 52%.' }
    };
    var which = 'same', player;
    function stepsFor(name) {
      var set = SETS[name], frames = A11.clusterRace(set.keys, 23);
      var steps = [{ frame: null, counters: { linear: 0, quadratic: 0, double: 0, longest: 0 }, caption: '<b>Three empty tables, 23 slots each.</b> ' + set.note + ' The same keys go into all three; only the probe rule differs.' }];
      frames.forEach(function (f, i) {
        var lin = f.kinds.linear, q = f.kinds.quadratic, d = f.kinds.double;
        steps.push({ frame: f, counters: { linear: lin.total, quadratic: q.total, double: d.total, longest: lin.longest },
          caption: 'Insert <b>' + f.key + '</b> (home slot ' + lin.home + '). Linear needed <b>' + lin.probes + '</b> probe' + (lin.probes === 1 ? '' : 's') + ', quadratic <b>' + q.probes + '</b>, double hashing <b>' + d.probes + '</b>.' +
            (i === frames.length - 1 ? ' After ' + frames.length + (frames.length === 1 ? ' key' : ' keys') + ' linear probing spent ' + lin.total + ' probes in total, quadratic ' + q.total + ', double hashing ' + d.total + '. Its longest run of filled slots is ' + lin.longest + ' long.' : '') });
      });
      return steps;
    }
    player = V.player({ root: fig, steps: stepsFor(which), render: render, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { linear: 'Linear probes', quadratic: 'Quadratic probes', double: 'Double-hash probes', longest: 'Longest linear run' }, counterStates: { linear: 'error', quadratic: 'compare', double: 'active' }, baseStepMs: 1100, label: 'Clustering race controls' });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Key set', value: which, options: Object.keys(SETS).map(function (k) { return { value: k, label: SETS[k].label }; }),
      onChange: function (v) { which = v; player.setSteps(stepsFor(v)); } });
    return player;
  };

  /* ================================================================== tombstone failure and fix */
  L11.tombFigure = function () {
    var fig = V.$('#fig-tomb'), A11 = A(), stage = fig.querySelector('[data-stage]');
    var view = V.views.hashtable(stage, { mode: 'open', threshold: 0.7, label: 'Open-addressing table: deleting a key' });
    var naive = A11.tombstoneDemo(true).steps, fixed = A11.tombstoneDemo(false).steps;
    view.prepare(naive.concat(fixed));
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Probed: slot taken' }, { state: 'error', label: 'Deleted, or wrongly missed' }, { state: 'found', label: 'Found' }, { state: 'muted', shape: 'dash', label: '† Tombstone' }]);
    var mode = 'naive';
    var player = V.player({ root: fig, steps: naive, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: L11.COUNTER_LABELS, counterStates: L11.COUNTER_STATES, baseStepMs: 1000, label: 'Deletion figure controls' });
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].opName === 'search' && steps[i].kind === 'probe') return i;
      return -1;
    }, function () {
      if (mode === 'naive') return { question: 'Key 10 was deleted and slot 3 is now <em>empty</em>. Key 24 is still stored at slot 5. What will <code>search(24)</code> report?',
        options: ['Found, in slot 5', 'Absent: the probe stops at the empty slot 3', 'An error'], answer: 1,
        explain: ['A search has no way to know 24 is at slot 5. It starts at 24’s home slot 3 and follows the rule “an empty slot ends the search”. It never looks at slot 5.',
          'Yes. Slot 3 is empty, and an empty slot is the signal “nothing further along”. The search stops and reports 24 absent, which is wrong.',
          'The code raises no error. It quietly returns the wrong answer, which is worse.'] };
      return { question: 'Slot 3 now holds a <em>tombstone</em> where key 10 used to be. What should <code>search(24)</code> do when it probes slot 3?',
        options: ['Stop and report absent', 'Keep probing to slot 4', 'Report found'], answer: 1,
        explain: ['A tombstone is not empty. Stopping here is exactly the bug the tombstone exists to prevent.',
          'Yes. A tombstone says “a key was here; something may live further along”. The search moves on to slot 4, then slot 5, where it finds 24.',
          'A tombstone holds no key, so it cannot match.'] };
    }, { id: 'l11-tomb-predict' });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Delete method', value: mode, options: [{ value: 'naive', label: 'Empty the slot (naive)' }, { value: 'tomb', label: 'Leave a tombstone' }],
      onChange: function (v) { mode = v; player.setSteps(v === 'naive' ? naive : fixed); } });
    return player;
  };

  /* ================================================================== expected probes vs load factor */
  L11.probesFigure = function () {
    var fig = V.$('#fig-probes'), stage = fig.querySelector('[data-stage]'), A11 = A();
    var chart = V.views.chart(stage, { type: 'scatter', label: 'Expected number of probes against load factor', height: 340, labels: false,
      format: function (v, axis) { return axis === 'y' ? String(Math.round(v * 10) / 10) : v.toFixed(2).replace(/0$/, ''); },
      valueFormat: function (v) { return (Math.round(v * 100) / 100).toString(); } });
    var which = 'missing', seed = 4242, sim = null;
    var SCHEMES = [{ id: 'chaining', label: 'Chaining', color: 2 }, { id: 'double', label: 'Double hashing', color: 0 }, { id: 'linear', label: 'Linear probing', color: 7 }];
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'done', shape: 'line', label: 'Chaining' }, { state: 'active', shape: 'line', label: 'Double hashing' }, { state: 'error', shape: 'line', label: 'Linear probing' }, { state: 'muted', shape: 'dot', label: 'Dots: measured', color: 'var(--ink-3)' }]);
    var caption = fig.querySelector('[data-caption]');
    function simulate() {
      seed += 101;
      var rng = V.rng(seed), alphas = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
      sim = {};
      SCHEMES.forEach(function (sc) { sim[sc.id] = A11.simulateProbes(sc.id, 997, alphas, sc.id === 'linear' ? 12 : 20, rng); });
    }
    function draw(dur) {
      var series = [];
      SCHEMES.forEach(function (sc) {
        series.push({ id: sc.id, label: sc.label, color: sc.color, fn: function (a) { return A11.expectedProbes(sc.id, a)[which]; }, domain: [0.005, 0.95], samples: 60 });
        if (sim) series.push({ id: 'sim-' + sc.id, label: sc.label + ' (measured)', color: sc.color, markers: true,
          points: sim[sc.id].map(function (p) { return { x: p.alpha, y: p[which], id: sc.id + p.alpha }; }) });
      });
      chart.render({ x: { label: 'load factor α = n / m', min: 0, max: 0.95, ticks: [0, 0.2, 0.4, 0.6, 0.8, 0.9] },
        y: { label: which === 'missing' ? 'slots or keys examined, key absent' : 'slots or keys examined, key present', min: 0, max: which === 'missing' ? 10 : 6 },
        series: series, annotations: [{ x: 0.7, text: 'resize point', id: 'thr' }] }, { duration: dur === undefined ? 600 : dur });
      var e5 = A11.expectedProbes('linear', 0.5)[which], e9 = A11.expectedProbes('linear', 0.9)[which], c5 = A11.expectedProbes('chaining', 0.5)[which], c9 = A11.expectedProbes('chaining', 0.9)[which];
      caption.innerHTML = '<b>Linear probing, key ' + (which === 'missing' ? 'absent' : 'present') + ':</b> ' + e5.toFixed(1) + ' slots at α = 0.5, but <b>' + e9.toFixed(1) + '</b> at α = 0.9. Chaining on the same table: ' + c5.toFixed(2) + ' versus ' + c9.toFixed(2) + ' keys. The dots come from real simulated tables (997 slots, random keys); the curves are the textbook formulas.';
    }
    var btns = fig.querySelector('[data-btns]');
    btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { simulate(); draw(600); } }, 'Re-run with new random keys'));
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Search case', value: which, options: [{ value: 'missing', label: 'Absent (unsuccessful)' }, { value: 'found', label: 'Present (successful)' }],
      onChange: function (v) { which = v; draw(700); } });
    simulate(); draw(0);
  };

  /* ================================================================== amortised growth */
  L11.amortizedFigure = function () {
    var fig = V.$('#fig-amortized'), stage = fig.querySelector('[data-stage]'), A11 = A();
    var chart = V.views.chart(stage, { type: 'line', label: 'Cost of each insert into a growing table', height: 330, samples: 260,
      format: function (v, axis) { return String(Math.round(v)); }, valueFormat: function (v) { return (Math.round(v * 10) / 10).toString(); } });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'Inserts', total: 'Total work', avg: 'Average per insert', resizes: 'Resizes' }, states: { avg: 'active', resizes: 'error' } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', shape: 'line', label: 'Cost of this insert (1 + keys moved)' }, { state: 'active', shape: 'line', label: 'Running average' }]);
    var policy = 'double', n = 100;
    function draw(dur) {
      var g = A11.growthCosts(n, policy), top = 1;
      g.costs.forEach(function (c) { top = Math.max(top, c); });
      var costPts = g.costs.map(function (c, i) { return { x: i + 1, y: c }; }), avgPts = g.avg.map(function (a, i) { return { x: i + 1, y: a }; });
      chart.render({ x: { label: 'insert number', min: 1, max: n }, y: { label: 'work for this insert', min: 0, max: Math.ceil(top * 1.1 / 10) * 10 },
        series: [{ id: 'cost', label: 'this insert', points: costPts, color: 1 }, { id: 'avg', label: 'running average', points: avgPts, color: 0 }] }, { duration: dur === undefined ? 600 : dur });
      stats.update({ n: n, total: g.total, avg: (g.total / n).toFixed(1), resizes: g.resizes.length });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Growth policy', value: policy, options: [{ value: 'double', label: 'Double the size' }, { value: 'plus', label: 'Add 8 slots' }],
      onChange: function (v) { policy = v; draw(700); } });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Inserts n', min: 16, max: 256, value: n, onInput: function (v) { n = v; draw(120); } });
    draw(0);
  };

  /* ================================================================== "which structure?" decision flowchart */
  L11.chooseFigure = function () {
    var fig = V.$('#fig-choose'), stage = fig.querySelector('[data-stage]'), caption = fig.querySelector('[data-caption]');
    var spec = {
      nodes: [
        { id: 'q1', type: 'decision', text: 'Look items up by a key?', col: 0, row: 0, maxWidth: 170 },
        { id: 'arr', type: 'end', text: 'Array or list: the position is the key', col: 1, row: 0, narrow: { col: 1, row: 0 }, maxWidth: 190 },
        { id: 'q2', type: 'decision', text: 'Keys are small whole numbers?', col: 0, row: 1, maxWidth: 170 },
        { id: 'direct', type: 'end', text: 'Array indexed by key (direct addressing)', col: 1, row: 1, narrow: { col: 1, row: 1 }, maxWidth: 190 },
        { id: 'q3', type: 'decision', text: 'Need order: sorted, ranges, nearest?', col: 0, row: 2, maxWidth: 170 },
        { id: 'tree', type: 'end', text: 'Sorted structure: balanced tree', col: 1, row: 2, narrow: { col: 1, row: 2 }, maxWidth: 190 },
        { id: 'q4', type: 'decision', text: 'Store a value per key?', col: 0, row: 3, maxWidth: 170 },
        { id: 'map', type: 'end', text: 'Hash map (key to value)', col: 1, row: 3, narrow: { col: 1, row: 3 }, maxWidth: 190 },
        { id: 'set', type: 'end', text: 'Hash set (keys only)', col: 0, row: 4, narrow: { col: 0, row: 4 }, maxWidth: 190 }
      ],
      edges: [
        { from: 'q1', to: 'arr', label: 'no' }, { from: 'q1', to: 'q2', label: 'yes' },
        { from: 'q2', to: 'direct', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
        { from: 'q3', to: 'tree', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
        { from: 'q4', to: 'map', label: 'yes' }, { from: 'q4', to: 'set', label: 'no' }
      ]
    };
    var WHY = {
      arr: '<b>Array or list.</b> If the natural key is a position (item 0, item 1, …) there is nothing to hash. Indexing is O(1) already.',
      direct: '<b>Direct addressing.</b> Small whole-number keys can index an array directly: no hash function, no collisions. Counting how often each score, age or digit appears is the classic use.',
      tree: '<b>A sorted structure.</b> A hash table scatters keys on purpose, so “the next larger key”, “everything between 1000 and 2000” or “the minimum” would mean scanning every bucket. A balanced search tree answers them in O(log n).',
      map: '<b>Hash map (dictionary).</b> Arbitrary keys mapped to values in expected O(1): word counts, caches, indexes by ID, JSON objects, symbol tables.',
      set: '<b>Hash set.</b> Membership tests, removing duplicates, “have I seen this before?” (like the visited set in a graph search), all in expected O(1).'
    };
    var flow = V.views.flowchart(stage, spec, { interactive: true, label: 'Which structure should I use? Decision tree', narrowWidth: 420 });
    var path, taken;
    function reset() {
      path = ['q1']; taken = {};
      flow.render({ active: 'q1', visited: [], edgeStates: {} }, { duration: 300 });
      caption.innerHTML = 'Click <b>yes</b> or <b>no</b> on the arrows below the highlighted question.';
    }
    flow.on('choose', function (e) {
      taken[e.node + '->' + e.to] = 'path';
      var prior = path.slice(); path.push(e.to);
      flow.render({ active: e.to, visited: prior, edgeStates: taken }, { duration: V.dur(500) });
      if (WHY[e.to]) caption.innerHTML = WHY[e.to] + ' <button type="button" class="btn btn--sm btn--ghost" data-again>Try another path</button>';
      else caption.innerHTML = 'Next question: <b>' + spec.nodes.filter(function (n) { return n.id === e.to; })[0].text + '</b>';
      var again = caption.querySelector('[data-again]'); if (again) again.addEventListener('click', reset);
    });
    fig.querySelector('[data-reset]').addEventListener('click', reset);
    reset();
  };

  /* ================================================================== sets, maps and the worst case */
  L11.variants = function () {
    var A11 = A(), started = {};
    var CODE = {
      set: 'const seen = new Set();\nfor (const w of words) seen.add(w);   // a repeat changes nothing\nseen.has("or");                       // expected O(1)',
      map: 'const count = new Map();\nfor (const w of words)\n  count.set(w, (count.get(w) ?? 0) + 1);',
      worst: '// keys 7, 14, 21, 28, 35 all have k % 7 === 0\nconst buckets = Array.from({ length: 7 }, () => []);\nfor (const k of keys) buckets[k % 7].push(k);\nbuckets[42 % 7].includes(42);   // scans the whole chain: O(n)'
    };
    function wordOps(words) {
      var seen = {}, ops = [];
      words.forEach(function (w) { seen[w] = (seen[w] || 0) + 1; ops.push({ op: 'insert', key: w, value: seen[w] }); });
      return ops;
    }
    var SPEC = {
      set: { fig: '#fig-set', m: 5, ops: 'to be or not to be'.split(' ').map(function (w) { return { op: 'insert', key: w }; }).concat([{ op: 'search', key: 'or' }]) },
      map: { fig: '#fig-map', m: 7, ops: wordOps('the cat and the hat and the bat'.split(' ')) },
      worst: { fig: '#fig-worst', m: 7, ops: [7, 14, 21, 28, 35].map(function (k) { return { op: 'insert', key: k }; }).concat([{ op: 'search', key: 42 }]) }
    };
    function start(name) {
      if (started[name]) return;
      started[name] = true;
      var sp = SPEC[name], fig = V.$(sp.fig), stage = fig.querySelector('[data-stage]');
      var run = A11.chaining(sp.ops, { m: sp.m });
      var view = V.views.hashtable(stage, { mode: 'chaining', showHash: false, threshold: 1, label: { set: 'Hash set of words', map: 'Hash map of word counts', worst: 'Hash table where every key collides' }[name] });
      // showHash:false draws no key box, so the flying-key state must be dropped (the view cannot place `incoming` without it)
      var steps = run.steps.filter(function (st) { return st.kind !== 'input'; }).map(function (st) { var c = Object.assign({}, st); delete c.incoming; delete c.hashValue; return c; });
      view.prepare(steps);
      V.player({ root: fig, steps: steps, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), baseStepMs: 950, label: name + ' example controls' });
    }
    Object.keys(CODE).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), CODE[k], 'js'); });
    var tabs = V.tabs('#variants', { onChange: function (name) { start(name); } });
    start('set');
  };
}());
