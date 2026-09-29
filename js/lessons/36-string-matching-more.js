/* Lesson 36 — the race, the cost chart, the variations (Boyer–Moore, many patterns) and the decision diagram.
   Started by js/lessons/36-string-matching.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var SM = V.lessons.l36;
  function S() { return V.algos.stringMatch; }
  var LEG = SM.LEG;

  /* ------------------------------------------------------------------ inputs for the race and the chart */
  function repeat(ch, n) { return new Array(n + 1).join(ch); }
  function inputFor(kind, n, m, seed) {
    var text, pat, rng = V.rng(seed || 7), i;
    m = Math.max(1, Math.min(m, n));
    if (kind === 'adv') { text = repeat('a', n); pat = repeat('a', m - 1) + 'b'; }
    else if (kind === 'all') { text = repeat('a', n); pat = repeat('a', m); }
    else if (kind === 'periodic') {
      text = ''; for (i = 0; i < n; i++) text += i % 2 ? 'b' : 'a';
      pat = ''; for (i = 0; i < m - 1; i++) pat += i % 2 ? 'b' : 'a';
      pat += 'c';
    } else {
      text = ''; for (i = 0; i < n; i++) text += 'acgt'[rng.int(0, 3)];
      var at = Math.floor((n - m) / 2);
      pat = text.substr(Math.max(0, at), m);
    }
    return { text: text, pat: pat };
  }
  SM.inputFor = inputFor;
  var NAMES = ['naive', 'kmp', 'rk'];
  var TITLE = { naive: 'Naive', kmp: 'KMP', rk: 'Rabin–Karp' };
  function tracer(name, t, p) {
    if (name === 'naive') return S().naive(t, p);
    if (name === 'kmp') return S().kmp(t, p);
    return S().rabinKarp(t, p, { mod: 1009 });
  }

  /* ================================================================== the race */
  SM.initRace = function () {
    var fig = V.$('#fig-race'), lanesEl = fig.querySelector('[data-lanes]');
    var kind = 'adv', n = 24, m = 5, seed = 5;
    var lanes = NAMES.map(function (name) {
      var status = h('span', { class: 'sm-lane__status' });
      var host = h('div', { class: 'sm-lane__stage' });
      var stats = h('div', { class: 'sm-lane__stats' });
      var el = h('div', { class: 'sm-lane', 'data-algo': name }, h('div', { class: 'sm-lane__head' }, h('span', { class: 'sm-lane__name' }, TITLE[name]), status), host, stats);
      lanesEl.appendChild(el);
      var view = SM.view(host, { cell: 24, minCell: 8, labels: false, indices: false, gapY: 22, label: TITLE[name] + ' lane' });
      var st = V.stats(stats, { labels: { ticks: 'Ticks', comparisons: 'Letters compared' }, states: { ticks: 'active', comparisons: 'compare' } });
      return { name: name, el: el, status: status, view: view, stats: st, steps: [], frame: [], total: 0, rank: 0, tableCost: 0 };
    });
    /* a lane frame: the snapshot with everything that would make lane heights differ removed; bands become cell colours */
    function laneFrame(s) {
      var t = Object.assign({}, s.tStates);
      (s.bands || []).forEach(function (b) { for (var q = b.from; q <= b.to; q++) if (!t[q] || t[q] === 'default') t[q] = b.state === 'done' ? 'done' : b.state === 'error' ? 'error' : b.state === 'compare' ? 'compare' : 'active'; });
      return Object.assign({}, s, { pointers: [], table: null, arrows: [], bands: [], hash: null, tStates: t, ghost: null });
    }
    function build() {
      var inp = inputFor(kind, n, m, seed);
      var T = 0;
      lanes.forEach(function (l) {
        l.steps = tracer(l.name, inp.text, inp.pat);
        l.total = l.steps[l.steps.length - 1].work;
        l.tableCost = l.name === 'kmp' ? l.steps[0].work : 0;
        T = Math.max(T, l.total);
        // frame index at tick t: the first step whose work reaches t, so a mismatch is seen on its own tick
        l.frame = [];
        var idx = 0;
        for (var t = 0; t <= l.total; t++) { while (idx < l.steps.length - 1 && l.steps[idx].work < t) idx++; l.frame.push(idx); }
        l.view.reset(); l.view.prepare(l.steps.map(laneFrame));
      });
      var sorted = lanes.map(function (l) { return l.total; }).sort(function (a, b) { return a - b; });
      lanes.forEach(function (l) { l.rank = sorted.indexOf(l.total) + 1; });
      var out = [];
      for (var t = 0; t <= T; t++) out.push({ t: t, T: T, caption: caption(t, T, inp) });
      return out;
    }
    var KIND_NOTE = {
      adv: 'Every alignment matches all but the last letter, so naive search re-reads almost everything.',
      random: 'Random letters: most alignments fail at the first letter, so all three are fast and close.',
      periodic: 'Repetitive text: naive search keeps matching a long stretch before it fails.',
      all: 'Every window is a real match. KMP reports them all in linear time; Rabin–Karp must verify each hit, so it does the full work of naive search.'
    };
    function caption(t, T, inp) {
      if (t === 0) return 'Text <code>' + inp.text + '</code>, pattern <code>' + inp.pat + '</code>. One tick = one character comparison or one hash update; KMP starts with its table and Rabin–Karp with hashing. Press play.';
      var done = lanes.filter(function (l) { return t >= l.total; }).sort(function (a, b) { return a.total - b.total; });
      if (t >= T) {
        var order = lanes.slice().sort(function (a, b) { return a.total - b.total; });
        return 'Finished: ' + order.map(function (l) { return '<b>' + TITLE[l.name] + '</b> ' + l.total; }).join(', ') + ' ticks. ' + KIND_NOTE[kind];
      }
      return 'Tick ' + t + '. ' + (done.length ? done.map(function (l) { return TITLE[l.name] + ' finished at tick ' + l.total; }).join('; ') + '.' : 'All three are still working.');
    }
    function render(step, ctx) {
      lanes.forEach(function (l) {
        var k = Math.min(step.t, l.total), s = l.steps[l.frame[k]];
        l.view.render(laneFrame(s), { duration: Math.min(ctx.duration, 220) });
        l.stats.update({ ticks: k, comparisons: s.counters.comparisons });
        var fin = step.t >= l.total;
        l.el.classList.toggle('is-finished', fin);
        var busy = l.tableCost && step.t < l.tableCost;
        l.status.textContent = fin ? (l.rank === 1 ? '1st' : l.rank === 2 ? '2nd' : '3rd') + ' · ' + l.total + ' ticks' : busy ? 'building table…' : 'running';
        l.status.setAttribute('data-rank', fin ? l.rank : '');
        l.status.setAttribute('data-busy', busy ? '1' : '');
      });
    }
    var player = V.player({ root: fig, steps: build(), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 170, speed: 2, speeds: [0.5, 1, 2, 4, 8], label: 'Race controls' });
    function rebuild() { player.setSteps(build()); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Input', value: kind,
      options: [{ value: 'adv', label: 'aaa…ab' }, { value: 'random', label: 'Random DNA' }, { value: 'periodic', label: 'abab…c' }, { value: 'all', label: 'All match' }],
      onChange: function (v) { kind = v; rebuild(); }
    });
    V.slider(fig.querySelector('[data-slider-n]'), { label: 'Text length n', min: 12, max: 28, value: n, onChange: function (v) { n = v; rebuild(); }, onInput: function (v) { n = v; } });
    V.slider(fig.querySelector('[data-slider-m]'), { label: 'Pattern length m', min: 3, max: 8, value: m, onChange: function (v) { m = v; rebuild(); }, onInput: function (v) { m = v; } });
    V.legend(fig.querySelector('[data-legend]'), [LEG.found, LEG.error, { state: 'done', label: 'Match' }, { state: 'active', label: 'Rabin–Karp window' }, { state: 'compare', label: 'Hash hit' }]);
    return player;
  };

  /* ================================================================== the cost chart */
  SM.initGrowth = function () {
    var fig = V.$('#fig-growth');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Work against text length for naive, KMP and Rabin–Karp' });
    var kind = 'adv', m = 8, scale = 'linear', cache = {};
    var NOTE = {
      adv: 'Text <code>aaa…a</code>, pattern <code>aaa…ab</code>: naive search climbs like n × m, while KMP and Rabin–Karp stay close to straight lines under the dashed 2n + 2m bound.',
      all: 'Pattern <code>aa…a</code> in <code>aaa…a</code>: every alignment is a real match. KMP stays linear, but Rabin–Karp must verify every hit, so it climbs with naive search.',
      periodic: 'Pattern <code>abab…c</code> in <code>abab…</code>: naive search matches about half a pattern at every other alignment. KMP and Rabin–Karp stay linear.',
      random: 'Random DNA: most alignments fail at the first letter, so naive search costs only about n and all three lines lie close together. The worst case needs an unlucky input.'
    };
    function work(name, t, p) {
      if (name === 'naive') return S().count.naive(t, p).comparisons;
      if (name === 'kmp') { var c = S().count.kmp(t, p); return c.tableCost + c.comparisons; }
      return S().count.rabinKarp(t, p, { mod: 1009 }).work;
    }
    function series(name) {
      var key = [name, kind, m].join('|');
      if (cache[key]) return cache[key];
      var pts = [];
      for (var n = Math.max(8, m); n <= 240; n += 8) {
        var runs = kind === 'random' ? 12 : 1, tot = 0;
        for (var r = 0; r < runs; r++) { var inp = inputFor(kind, n, m, 100 + r * 31 + n); tot += work(name, inp.text, inp.pat); }
        pts.push([n, Math.round(tot / runs * 10) / 10]);
      }
      return (cache[key] = pts);
    }
    function draw(dur) {
      var ser = [
        { id: 'naive', label: 'Naive', points: series('naive'), state: 'error' },
        { id: 'kmp', label: 'KMP', points: series('kmp'), state: 'done' },
        { id: 'rk', label: 'Rabin–Karp', points: series('rk'), state: 'active' },
        { id: 'ref', label: '2n + 2m', fn: function (x) { return 2 * x + 2 * m; }, domain: [Math.max(8, m), 240], state: 'muted', dashed: true }
      ];
      chart.render({
        x: { label: 'text length n', min: 0, max: 240 },
        y: scale === 'log' ? { label: 'work (log scale)', scale: 'log', min: 1, max: 100000 } : { label: 'work: comparisons and hash updates', min: 0 },
        series: ser
      }, { duration: dur === undefined ? 700 : dur });
      fig.querySelector('[data-note]').innerHTML = NOTE[kind] + ' Pattern length m = ' + m + '.';
    }
    V.segmented(fig.querySelector('[data-case]'), {
      label: 'Input', value: kind,
      options: [{ value: 'adv', label: 'aaa…ab' }, { value: 'all', label: 'All match' }, { value: 'periodic', label: 'abab…c' }, { value: 'random', label: 'Random DNA' }],
      onChange: function (v) { kind = v; draw(); }
    });
    V.segmented(fig.querySelector('[data-scale]'), {
      label: 'Scale', value: scale, options: [{ value: 'linear', label: 'Linear' }, { value: 'log', label: 'Log' }],
      onChange: function (v) { scale = v; draw(900); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'Pattern length m', min: 3, max: 20, value: m, onChange: function (v) { m = v; draw(500); }, onInput: function (v) { m = v; } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'error', shape: 'line', label: 'Naive' }, { state: 'done', shape: 'line', label: 'KMP' }, { state: 'active', shape: 'line', label: 'Rabin–Karp' }, { state: 'muted', shape: 'dash', label: '2n + 2m' }]);
    draw(0);
  };

  /* ================================================================== variations: Boyer–Moore + many patterns */
  SM.initVariants = function () {
    var fig = V.$('#fig-bm');
    var steps = S().boyerMoore('thequickbrownfoxjumpsoverthelazydog', 'lazy');
    var view = SM.view(fig.querySelector('[data-stage]'), { cell: 36, minCell: 17, gapY: 34, label: 'Boyer–Moore searching for lazy' });
    view.prepare(steps);
    V.player({ root: fig, steps: steps, render: function (s, ctx) { view.render(s, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', shifts: 'Pattern shifts' }, counterStates: { comparisons: 'compare', shifts: 'swap' }, baseStepMs: 1000, label: 'Boyer–Moore controls' });
    V.legend(fig.querySelector('[data-legend]'), [LEG.found, LEG.error, LEG.done, { state: 'compare', label: 'Letter looked up in the pattern' }, { state: 'default', shape: 'dash', label: 'Where the pattern was' }]);
    // many patterns: one pass, two patterns marked
    var host = V.$('#variants [data-mini="multi"]');
    var text = 'acatsatdogsawacat';
    host.appendChild(SM.tile({ text: text, pat: null, offset: null, tStates: { 1: 'done', 2: 'done', 3: 'done', 7: 'active', 8: 'active', 9: 'active', 14: 'done', 15: 'done', 16: 'done' }, pStates: {}, table: null, arrows: [], pointers: [],
      bands: [{ from: 1, to: 3, state: 'done', label: 'cat' }, { from: 7, to: 9, state: 'active', label: 'dog' }, { from: 14, to: 16, state: 'done', label: 'cat' }] }, { cell: 26, width: 340, minCell: 14 }));
    V.tabs('#variants', {});
  };

  /* ================================================================== which string algorithm? */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Many patterns at once?', col: 0, row: 0 },
      { id: 'many', type: 'end', text: 'Aho–Corasick (or Rabin–Karp + a hash set)', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Same text searched again and again?', col: 0, row: 1 },
      { id: 'index', type: 'end', text: 'Build an index: suffix array or tree', col: 1, row: 1 },
      { id: 'q3', type: 'decision', text: 'Need a worst-case guarantee?', col: 0, row: 2 },
      { id: 'kmp', type: 'end', text: 'KMP or the Z-algorithm', col: 1, row: 2 },
      { id: 'q4', type: 'decision', text: 'Long pattern, big alphabet (like English)?', col: 0, row: 3 },
      { id: 'bm', type: 'end', text: 'Boyer–Moore–Horspool', col: 1, row: 3 },
      { id: 'lib', type: 'end', text: 'Naive or the library search', col: 0, row: 4 }
    ],
    edges: [
      { from: 'q1', to: 'many', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'index', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'kmp', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
      { from: 'q4', to: 'bm', label: 'yes' }, { from: 'q4', to: 'lib', label: 'no' }
    ]
  };
  var CHOOSE_WHY = {
    many: '<b>Aho–Corasick.</b> It merges all patterns into one trie with KMP-style failure links, and reports every occurrence of every pattern in a single pass: O(n + total pattern length + matches). If all patterns share one length, a rolling hash and a hash set do the same with far less code.',
    index: '<b>Build an index.</b> Pay once to preprocess the text (a suffix array or suffix tree), and then each query costs about O(m log n) or O(m), independent of the text length. A genome is searched this way.',
    kmp: '<b>KMP or Z.</b> Both make at most about 2n comparisons whatever the input, even on <code>aaa…ab</code>. Choose them for adversarial or untrusted input, streaming text (KMP never looks back), or when you also need borders and periods.',
    bm: '<b>Boyer–Moore–Horspool.</b> Reading the pattern right to left lets it skip up to m letters at a time, so on ordinary text it looks at only a fraction of the characters. This is why editors and grep use it. The worst case can still be slower than KMP.',
    lib: '<b>Naive, or your language\'s built-in search.</b> For short patterns or short texts the simple loop is fast and hard to get wrong, and library routines already pick a good method for you.'
  };
  SM.initChooser = function () {
    var fig = V.$('#fig-choose');
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Which string-matching method should you use?', narrowWidth: 420 });
    var out = fig.querySelector('[data-answer]');
    var path = ['q1'], taken = {};
    function show(d) {
      var cur = path[path.length - 1];
      var states = {}; if (CHOOSE_WHY[cur]) states[cur] = 'found';
      view.render({ active: cur, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: states }, { duration: d === undefined ? 550 : d });
      out.innerHTML = CHOOSE_WHY[cur] || 'Answer the question in the highlighted box with its <b>yes</b> or <b>no</b> button.';
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Your current question' }, { state: 'path', shape: 'line', label: 'Your answers' }, { state: 'found', label: 'Recommendation' }]);
    show(0);
  };
}());
