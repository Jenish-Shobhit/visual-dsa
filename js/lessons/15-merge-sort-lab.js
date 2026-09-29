/* Lesson 15 — the big interactive figures: the merge sort lab (array levels + recursion tree + code), its
   divide-and-conquer flowchart, the race against insertion sort, the growth chart and the "should you?" chooser.
   Uses VDSA.algos.mergesort (js/algos/15-merge-sort.js) and, for insertion sort, VDSA.algos.sorting (lesson 14).
   Started by js/lessons/15-merge-sort.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L15 = V.lessons.l15;
  function M() { return V.algos.mergesort; }
  function S() { return V.algos.sorting; }
  var fmt = L15.fmt, commas = L15.commas;

  /* ================================================================== the flowchart */
  var FLOW = {
    nodes: [
      { id: 'start', type: 'start', text: 'mergeSort(lo, hi)', col: 0, row: 0 },
      { id: 'small', type: 'decision', text: 'small enough?\nhi − lo < 1', col: 0, row: 1 },
      { id: 'base', type: 'end', text: 'Base case: one value\nis sorted, return', col: 1, row: 1 },
      { id: 'divide', type: 'process', text: 'Divide\nmid = ⌊(lo + hi) / 2⌋', col: 0, row: 2 },
      { id: 'conquer', type: 'process', text: 'Conquer\nmergeSort(lo, mid)\nmergeSort(mid + 1, hi)', col: 0, row: 3 },
      { id: 'combine', type: 'process', text: 'Combine\nmerge the two sorted halves', col: 0, row: 4 },
      { id: 'ret', type: 'end', text: 'return', col: 0, row: 5 },
      { id: 'note', type: 'note', text: 'Merge: two pointers, take the smaller front. Ties take the left one, so the sort is stable.', col: 1, row: 4, narrow: { col: 1, row: 4 }, maxWidth: 170 }
    ],
    edges: [
      { from: 'start', to: 'small' },
      { from: 'small', to: 'base', label: 'yes' },
      { from: 'small', to: 'divide', label: 'no' },
      { from: 'divide', to: 'conquer' },
      { from: 'conquer', to: 'combine' },
      { from: 'combine', to: 'ret' },
      { from: 'conquer', to: 'start', dashed: true, via: { fromSide: 'left', toSide: 'left' } },
      { from: 'combine', to: 'note', dashed: true, arrow: false }
    ]
  };

  /* ================================================================== the lab */
  var DEFAULT_INPUT = [5, 2, 8, 4, 1, 6, 3, 7];
  function fronts(step) {
    var out = [];
    step.rows.forEach(function (r) { r.items.forEach(function (it) { if (it.state === 'compare') out.push(it); }); });
    return out.sort(function (a, b) { return a.index - b.index; });
  }
  function nm(it) { return fmt(it.value) + (it.label ? it.label : ''); }

  L15.initLab = function () {
    var fig = V.$('#lab-fig'), flowFig = V.$('#fig-flow');
    var stage = fig.querySelector('[data-stage]');
    var values = DEFAULT_INPUT.slice(), mode = 'levels';
    var view = V.views.array(stage, { mode: 'boxes', cellSize: 44, label: 'Merge sort: rows are recursion levels', showIndices: false });
    var treeView = V.views.tree(fig.querySelector('[data-tree]'), { nodeSize: 34, minNodeSize: 16, gap: 0.3, label: 'Recursion tree of merge sort' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: M().CODE_MERGE, default: 'pseudo', maxHeight: 400, title: 'mergeSort' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });

    /* flowchart, lit by the lab. step.flow may name several boxes, 'conquer|small' */
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW, { label: 'Divide and conquer flowchart lit by the lab', narrowWidth: 420 });
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);
    var flowAdapter = {
      highlight: function (id, ctx) {
        var ids = id ? String(id).split('|') : [], states = {}, visited = [];
        ids.forEach(function (x) { states[x] = 'active'; });
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var k = 0; k < ctx.index && k < st.length; k++) {
            String(st[k].flow || '').split('|').forEach(function (x) { if (x && ids.indexOf(x) === -1 && visited.indexOf(x) === -1) visited.push(x); });
          }
        }
        flowView.render({ active: ids.length ? ids[ids.length - 1] : undefined, states: states, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };

    function levelsState(s) { return { rows: s.rows, pointers: s.pointers, regions: s.regions }; }
    function flatState(s) { return { items: s.flat.items, regions: s.flat.regions, pointers: [] }; }
    function toState(s) { return mode === 'levels' ? levelsState(s) : flatState(s); }
    function generate() { return M().merge(L15.labelDuplicates(values)); }
    var steps = generate();
    function prepare(st) {
      view.reset(); view.prepare(st.map(toState));
      treeView.reset();
      var trees = st.map(function (x) { return x.tree; }).filter(Boolean);
      if (trees.length) treeView.prepare(trees);
    }
    prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) {
        view.render(toState(step), { duration: ctx.duration });
        if (step.tree) treeView.render(step.tree, { duration: ctx.duration });
        else treeView.render({ nodes: [] }, { duration: ctx.duration });
      },
      code: code, vars: vars, flow: flowAdapter,
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', writes: 'Values written' },
      counterStates: { comparisons: 'compare', writes: 'swap' },
      baseStepMs: 1050, label: 'Merge sort lab controls'
    });

    /* ---- predictions ---- */
    player.addCheckpoint(function (st) {
      var fallback = -1;
      for (var k = 1; k < st.length; k++) {
        if (st[k].kind !== 'compare') continue;
        var f = fronts(st[k]);
        if (f.length !== 2 || f[0].value === f[1].value) continue;
        if (fallback < 0) fallback = k;
        if (st[k].range && st[k].range[1] - st[k].range[0] >= 3) return k;
      }
      return fallback;
    }, function (c) {
      var f = fronts(c.step);
      if (f.length !== 2) return null;
      var leftFront = f[0], rightFront = f[1], leftWins = c.step.next === leftFront.id;
      var win = leftWins ? leftFront : rightFront, lose = leftWins ? rightFront : leftFront;
      return {
        question: 'Two sorted runs are being merged, and the fronts are <code>L[i] = ' + nm(leftFront) + '</code> and <code>R[j] = ' + nm(rightFront) + '</code>. Which one is written to the output next?',
        options: ['<code>' + nm(leftFront) + '</code>, the front of the left run', '<code>' + nm(rightFront) + '</code>, the front of the right run'],
        answer: leftWins ? 0 : 1,
        explain: leftWins
          ? ['Right. ' + nm(win) + ' is the smaller front. Each run is sorted, so nothing waiting behind ' + nm(win) + ' or ' + nm(lose) + ' can be smaller than ' + nm(win) + '.', nm(lose) + ' is the larger front. The smaller front goes first, because both runs are sorted and nothing behind a front can be smaller than it.']
          : [nm(lose) + ' is the larger front. The smaller front goes first, because both runs are sorted and nothing behind a front can be smaller than it.', 'Right. ' + nm(win) + ' is the smaller front. Each run is sorted, so nothing waiting behind either front can be smaller than ' + nm(win) + '.']
      };
    }, { id: 'l15-lab-next' });

    player.addCheckpoint(function (st) {
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'drain') return k;
      return -1;
    }, function (c) {
      var r = c.step.range;
      if (!r || !c.prev || !c.prev.rows[r[2] + 1]) return null;
      var rest = c.prev.rows[r[2] + 1].items.filter(function (it) { return it.index >= r[0] && it.index <= r[1]; }).length;
      if (!rest) return null;
      return {
        question: 'One of the two runs has just run out, and <b>' + rest + '</b> ' + (rest === 1 ? 'value is' : 'values are') + ' left in the other. What does the merge do with ' + (rest === 1 ? 'it' : 'them') + '?',
        options: ['Copy ' + (rest === 1 ? 'it' : 'them') + ' to the output as ' + (rest === 1 ? 'it is' : 'they are'), 'Compare ' + (rest === 1 ? 'it' : 'each one') + ' with the last value written', 'Sort ' + (rest === 1 ? 'it' : 'them') + ' again with a recursive call'],
        answer: 0,
        explain: [
          'Right. The rest of a run is already sorted, and every value in it is at least as large as everything written so far. There is nothing left to compare against, so it is a plain copy: writes, no comparisons.',
          'The last value written came from the run that is now empty, and the leftover values are sorted and no smaller than it. Comparing would only waste time.',
          'The run was sorted before the merge began: that is what the recursive calls delivered. Sorting it again would repeat work already done.'
        ]
      };
    }, { id: 'l15-lab-drain' });

    player.addCheckpoint(function (st) {
      for (var k = 1; k < st.length; k++) {
        if (st[k].kind !== 'split') continue;
        var r = st[k].range, size = r[1] - r[0] + 1;
        if (size % 2 === 1 && size > 1) return k;
      }
      return -1;
    }, function (c) {
      var r = c.step.range, size = r[1] - r[0] + 1, left = (size + 1) / 2, right = (size - 1) / 2;
      return {
        question: 'The next call is on <code>a[' + r[0] + '..' + r[1] + ']</code>, <b>' + size + '</b> values, an odd number. With <code>mid = ⌊(lo + hi) / 2⌋</code>, how are they split?',
        options: [right + ' in the left half and ' + left + ' in the right half', left + ' in the left half and ' + right + ' in the right half', 'It cannot split: the two halves must be equal'],
        answer: 1,
        explain: [
          'Rounding goes the other way. mid = ⌊(' + r[0] + ' + ' + r[1] + ') / 2⌋ = ' + ((r[0] + r[1]) >> 1) + ', and the left half is <code>a[lo..mid]</code>, which includes mid: it gets the extra value.',
          'Right. mid = ⌊(' + r[0] + ' + ' + r[1] + ') / 2⌋ = ' + ((r[0] + r[1]) >> 1) + ', and the left half <code>a[lo..mid]</code> includes mid, so it gets the extra value: ' + left + ' and ' + right + '.',
          'Halves may differ by one value, and that costs nothing: the recursion still ends after ⌈log₂ n⌉ levels.'
        ]
      };
    }, { id: 'l15-lab-oddsplit' });

    /* ---- input, presets, view mode ---- */
    function reload() { steps = generate(); prepare(steps); player.setSteps(steps); }
    var N = 8;
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (0 to 16 values, −99 to 99)',
      value: values,
      parse: { min: -99, max: 99, maxCount: 16, minCount: 0 },
      presets: [
        { label: 'Random', value: function () { return V.presets.random(N, { min: 1, max: 40 }); } },
        { label: 'Sorted', title: 'Merge sort does the same merges: it cannot tell that the input is sorted', value: function () { return V.presets.sorted(N, { min: 1, max: 40 }); } },
        { label: 'Reversed', value: function () { return V.presets.reversed(N, { min: 1, max: 40 }); } },
        { label: 'Nearly sorted', value: function () { return V.presets.nearlySorted(N, { min: 1, max: 40, swaps: 2 }); } },
        { label: 'Few unique', value: function () { return V.presets.fewUnique(N, { min: 5, max: 40, k: 3 }); } },
        { label: '11 values', title: 'Odd sizes: the halves differ by one', value: function () { return V.presets.random(11, { min: 1, max: 40 }); } },
        { label: '16 values', value: function () { return V.presets.random(16, { min: 1, max: 40 }); } },
        { label: 'All equal', value: [4, 4, 4, 4, 4, 4] },
        { label: 'One value', value: [42] }
      ],
      hint: 'Repeated values get small a, b, c tags, so you can see that equal values keep their order.',
      onApply: function (vals) { values = vals; reload(); }
    });
    V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Show the array as', value: mode,
      options: [{ value: 'levels', label: 'Recursion levels' }, { value: 'flat', label: 'One array' }],
      onChange: function (m) { mode = m; prepare(steps); player.refresh(); }
    });

    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'default', label: 'Not sorted yet' }, { state: 'compare', label: 'Fronts being compared' }, { state: 'swap', label: 'Just written' },
      { state: 'visited', label: 'Sorted run (not final)' }, { state: 'done', label: 'Final' }
    ]);
    V.legend(fig.querySelector('[data-tree-legend]'), [{ state: 'active', label: 'Running call' }, { state: 'frontier', label: 'Waiting for its halves' }, { state: 'visited', label: 'Returned a sorted run' }]);
    return { player: player };
  };

  /* ================================================================== the race: merge sort vs insertion sort */
  function ticksOf(steps) {   // frames[t] = last step whose comparisons + writes <= t
    var work = function (x) { return x.ops.comparisons + x.ops.writes; };
    var total = work(steps[steps.length - 1]), frames = [], k = 0;
    for (var t = 0; t <= total; t++) { while (k + 1 < steps.length && work(steps[k + 1]) <= t) k++; frames.push(t === 0 ? steps[0] : steps[k]); }
    return frames;
  }
  function inputFor(preset, n, seed) {
    var o = { min: 5, max: 95, seed: seed };
    if (preset === 'sorted') return V.presets.sorted(n, o);
    if (preset === 'reversed') return V.presets.reversed(n, o);
    if (preset === 'nearly') return V.presets.nearlySorted(n, Object.assign({ swaps: 2 }, o));
    if (preset === 'few') return V.presets.fewUnique(n, Object.assign({ k: 3 }, o));
    return V.presets.random(n, o);
  }
  L15.initRace = function () {
    var fig = V.$('#fig-race'), lanesEl = fig.querySelector('[data-lanes]');
    var preset = 'random', n = 16, seed = 21;
    var narrow = lanesEl.clientWidth > 0 && lanesEl.clientWidth < 620;
    var NAMES = ['merge', 'insertion'], TITLE = { merge: 'Merge sort', insertion: 'Insertion sort' };
    var lanes = NAMES.map(function (name) {
      var status = h('span', { class: 'l15-lane__status' }), host = h('div', { class: 'l15-lane__stage' }), stats = h('div', { class: 'l15-lane__stats' });
      var el = h('div', { class: 'l15-lane', 'data-algo': name }, h('div', { class: 'l15-lane__head' }, h('span', { class: 'l15-lane__name' }, TITLE[name]), status), host, stats);
      lanesEl.appendChild(el);
      var view = V.views.array(host, { mode: 'bars', showIndices: false, showValues: false, cellSize: 30, barHeight: narrow ? 80 : 120, reserve: { held: true }, label: TITLE[name] + ' lane' });
      var st = V.stats(stats, { labels: { comparisons: 'Comparisons', writes: 'Writes', ticks: 'Ticks' }, states: { comparisons: 'compare', writes: 'swap' } });
      return { name: name, el: el, status: status, view: view, stats: st, frames: [], total: 0 };
    });
    var stride = 1;
    function build() {
      var vals = inputFor(preset, n, seed);
      var mx = Math.max.apply(null, vals.concat([1]));
      lanes.forEach(function (l) {
        var raw = l.name === 'merge'
          ? ticksOf(M().merge(vals)).map(function (f) { return { state: { items: f.flat.items, regions: [], pointers: [] }, c: f.ops.comparisons, w: f.ops.writes }; })
          : ticksOf(S().run('insertion', vals)).map(function (f) { return { state: { items: f.items, held: f.held, ghosts: f.ghosts, regions: [], pointers: [] }, c: f.ops.comparisons, w: f.ops.writes }; });
        l.frames = raw; l.total = raw.length - 1;
        l.view.setOptions({ maxValue: mx, minValue: 0 });
        l.view.reset(); l.view.prepare(raw.map(function (f) { return f.state; }));
      });
      var maxTotal = Math.max(lanes[0].total, lanes[1].total);
      stride = Math.max(1, Math.ceil(maxTotal / 150));
      var T = Math.ceil(maxTotal / stride) + 1, out = [];
      var order = lanes.slice().sort(function (a, b) { return a.total - b.total; });
      var tie = lanes[0].total === lanes[1].total;
      lanes.forEach(function (l) { l.rank = tie ? 1 : order.indexOf(l) + 1; });
      for (var t = 0; t < T; t++) out.push({ t: t, tick: Math.min(t * stride, maxTotal), last: t === T - 1 });
      return out;
    }
    var PRESET_NOTE = {
      random: 'On random input merge sort pulls ahead as n grows: its writes and comparisons grow like n log n, insertion sort’s like n².',
      nearly: 'Nearly sorted: insertion sort only pays for the few values out of place, so it is close to n. Merge sort still does every merge.',
      reversed: 'Reversed input is insertion sort’s worst case: every pair is out of order, about n²/2 comparisons and n²/2 writes. Merge sort barely notices.',
      sorted: 'Sorted input: insertion sort makes n − 1 comparisons and nothing else. Merge sort cannot tell that the input is sorted, so it does all its merges.',
      few: 'Few unique values: equal values never move past each other in insertion sort, so it saves a little; merge sort is unchanged.'
    };
    function caption(step) {
      if (step.t === 0) return 'The same ' + n + ' values in both lanes. One tick = one comparison or one write of a value. Press play' + (stride > 1 ? ' (this run is long, so each frame skips ' + stride + ' ticks).' : '.');
      var done = lanes.filter(function (l) { return step.tick >= l.total; });
      if (step.last) {
        var m = lanes[0], ins = lanes[1];
        var head = m.total === ins.total ? 'A tie at <b>' + m.total + '</b> ticks.' : '<b>' + TITLE[m.total < ins.total ? 'merge' : 'insertion'] + '</b> finishes first: merge sort ' + m.total + ' ticks, insertion sort ' + ins.total + '.';
        return head + ' ' + PRESET_NOTE[preset];
      }
      return 'Tick ' + step.tick + '. ' + (done.length ? done.map(function (l) { return TITLE[l.name] + ' has finished (' + l.total + ' ticks)'; }).join('; ') + '.' : 'Both are still working.');
    }
    function render(step, ctx) {
      lanes.forEach(function (l) {
        var k = Math.min(step.tick, l.total), f = l.frames[k];
        l.view.render(f.state, { duration: ctx.duration });
        l.stats.update({ comparisons: f.c, writes: f.w, ticks: k });
        var fin = step.tick >= l.total;
        l.el.classList.toggle('is-finished', fin);
        l.status.textContent = fin ? (l.rank === 1 ? '1st' : '2nd') + ' · ' + l.total + ' ticks' : 'running';
        l.status.setAttribute('data-rank', fin ? l.rank : '');
      });
    }
    var st0 = build();
    st0.forEach(function (x) { x.caption = null; });
    var player = V.player({ root: fig, steps: st0, render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 220, speed: 2, speeds: [0.5, 1, 2, 4, 8], label: 'Race controls' });
    function captionize(steps) { steps.forEach(function (x) { x.caption = caption(x); }); return steps; }
    captionize(st0); player.setSteps(st0);
    function rebuild() { var s2 = captionize(build()); player.setSteps(s2); }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Input', value: preset,
      options: [{ value: 'random', label: 'Random' }, { value: 'nearly', label: 'Nearly sorted' }, { value: 'reversed', label: 'Reversed' }, { value: 'sorted', label: 'Sorted' }, { value: 'few', label: 'Few unique' }],
      onChange: function (v) { preset = v; rebuild(); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 6, max: 24, value: n, onChange: function (v) { n = v; rebuild(); }, onInput: function (v) { n = v; } });
    fig.querySelector('[data-shuffle]').addEventListener('click', function () { seed = (seed * 7919 + 13) % 100003; rebuild(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Comparing' }, { state: 'swap', label: 'Just written or shifted' }, { state: 'visited', label: 'Sorted run' }, { state: 'key', label: 'Key in hand' }, { state: 'done', label: 'Final' }]);
    return player;
  };

  /* ================================================================== growth: comparisons vs n */
  L15.initGrowth = function () {
    var fig = V.$('#fig-growth');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Comparisons made by merge sort and insertion sort as n grows' });
    var kase = 'random', log = false, cache = {};
    var XS = []; for (var x = 8; x <= 192; x += 8) XS.push(x);
    function arr(n, seed) {
      if (kase === 'sorted') return V.presets.sorted(n, { min: 1, max: 999 });
      if (kase === 'reversed') return V.presets.reversed(n, { min: 1, max: 999 });
      return V.presets.random(n, { min: 1, max: 999, seed: seed });
    }
    function points(name) {
      var key = name + kase;
      if (cache[key]) return cache[key];
      var runs = kase === 'random' ? 16 : 1;
      var pts = XS.map(function (n) {
        var tot = 0;
        for (var r = 0; r < runs; r++) {
          var vals = arr(n, 900 + r * 131 + n);
          tot += name === 'merge' ? M().mergeCount(vals).comparisons : S().count('insertion', vals).comparisons;
        }
        return [n, Math.round(tot / runs)];
      });
      return (cache[key] = pts);
    }
    var NOTE = {
      random: 'Random input: insertion sort’s curve bends up like n²/4, merge sort’s stays close to n log₂ n. At n = 192 that is about 9,000 comparisons against about 1,300.',
      sorted: 'Sorted input flips the story: insertion sort makes n − 1 comparisons, a straight line, while merge sort still makes about ½ n log₂ n. Merge sort is not adaptive.',
      reversed: 'Reversed input is insertion sort’s worst case, n(n − 1)/2 comparisons. Merge sort makes about ½ n log₂ n: reversed and sorted input cost it the same.'
    };
    function draw(dur) {
      var ms = points('merge'), is = points('insertion');
      var top = Math.max(ms[ms.length - 1][1], is[is.length - 1][1]);
      chart.render({
        x: { label: 'input size n', min: 0, max: 192 },
        y: log ? { label: 'comparisons (log scale)', scale: 'log', min: 1, max: Math.pow(10, Math.ceil(Math.log10(top))) } : { label: 'comparisons', min: 0, max: Math.ceil(top / 1000) * 1000 },
        series: [
          { id: 'ins', label: 'Insertion sort', points: is, state: 'compare' },
          { id: 'mrg', label: 'Merge sort', points: ms, state: 'done' },
          { id: 'ref', label: 'n log₂ n', fn: function (n) { return n * Math.log2(Math.max(1, n)); }, domain: [2, 192], state: 'muted', dashed: true }
        ]
      }, { duration: dur === undefined ? 700 : dur });
      fig.querySelector('[data-note]').textContent = NOTE[kase];
    }
    V.segmented(fig.querySelector('[data-case]'), {
      label: 'Input order', value: kase,
      options: [{ value: 'random', label: 'Random' }, { value: 'sorted', label: 'Sorted' }, { value: 'reversed', label: 'Reversed' }],
      onChange: function (v) { kase = v; draw(); }
    });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: false, onChange: function (on) { log = on; draw(900); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', shape: 'line', label: 'Insertion sort' }, { state: 'done', shape: 'line', label: 'Merge sort' }, { state: 'muted', shape: 'dash', label: 'n log₂ n' }]);
    draw(0);
  };

  /* ================================================================== should you use merge sort? */
  var CHOOSE = {
    nodes: [
      { id: 'q0', type: 'decision', text: 'A linked list, or data too big for memory?', col: 0, row: 0 },
      { id: 'a0', type: 'end', text: 'Merge sort', col: 1, row: 0 },
      { id: 'q1', type: 'decision', text: 'Must equal keys keep their order?', col: 0, row: 1 },
      { id: 'a1', type: 'end', text: 'Merge sort (or Timsort)', col: 1, row: 1 },
      { id: 'q2', type: 'decision', text: 'Need a guaranteed n log n worst case?', col: 0, row: 2 },
      { id: 'a2', type: 'end', text: 'Quicksort or the built-in sort', col: 1, row: 2 },
      { id: 'q3', type: 'decision', text: 'Can you spare O(n) extra memory?', col: 0, row: 3 },
      { id: 'a3', type: 'end', text: 'Merge sort', col: 1, row: 3 },
      { id: 'a4', type: 'end', text: 'Heapsort', col: 0, row: 4 }
    ],
    edges: [
      { from: 'q0', to: 'a0', label: 'yes' }, { from: 'q0', to: 'q1', label: 'no' },
      { from: 'q1', to: 'a1', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'q3', label: 'yes' }, { from: 'q2', to: 'a2', label: 'no' },
      { from: 'q3', to: 'a3', label: 'yes' }, { from: 'q3', to: 'a4', label: 'no' }
    ]
  };
  var CHOOSE_WHY = {
    a0: '<b>Merge sort.</b> It reads each run strictly front to back, which is all a linked list or a disk allows. A list merge relinks nodes and needs no extra space; external sorting merges sorted chunks written to disk.',
    a1: '<b>Merge sort, or Timsort.</b> Taking the left value on ties keeps equal keys in order. Python and Java sort objects with Timsort, a merge-based hybrid, for exactly this reason.',
    a2: '<b>Quicksort or the built-in sort.</b> Without a worst-case need, quicksort is usually faster in practice and sorts in place (lesson 16). Your language’s library sort already picks something good.',
    a3: '<b>Merge sort.</b> n log n in every case, stable, and simple to reason about. The price is the O(n) buffer for merging.',
    a4: '<b>Heapsort.</b> It also guarantees n log n and sorts in place, but it is not stable and jumps around in memory. (Lesson 21 builds it.)'
  };
  L15.initChooser = function () {
    var fig = V.$('#fig-choose');
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Should you use merge sort?', narrowWidth: 420 });
    var out = fig.querySelector('[data-answer]');
    var path = ['q0'], taken = {};
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Current question' }, { state: 'path', shape: 'line', label: 'Your answers' }, { state: 'found', label: 'Answer' }]);
    function show(d) {
      var cur = path[path.length - 1], states = {};
      if (CHOOSE_WHY[cur]) states[cur] = 'found';
      view.render({ active: cur, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: states }, { duration: d === undefined ? 550 : d });
      out.innerHTML = CHOOSE_WHY[cur] || 'Answer the question in the highlighted box with its <b>yes</b> or <b>no</b> button.';
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q0']; taken = {}; show(); });
    show(0);
  };
}());
