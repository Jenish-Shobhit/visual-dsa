/* Lesson 23 — the big interactive figures: the segment-tree lab (+ its flowchart), the lazy-propagation lab, the
   Fenwick lab, the cost chart and the "which structure?" decision diagram. Uses VDSA.algos.rangeTrees and the views in
   23-segment-and-fenwick-trees-views.js. Started by js/lessons/23-segment-and-fenwick-trees.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L = V.lessons.l23;
  function A() { return V.algos.rangeTrees; }
  function fmt(v) { return L.fmt(v); }

  /* ------------------------------------------------------------------ small form helpers */
  function numField(label, o) {
    var input = h('input', { class: 'field l23-num', type: 'number', min: o.min, max: o.max, value: o.value, 'aria-label': o.aria || label, step: 1 });
    var wrap = h('label', { class: 'l23-param' }, h('span', { class: 'field-label' }, label), input);
    return { wrap: wrap, input: input, get: function () { return input.value === '' ? NaN : Number(input.value); }, set: function (v) { input.value = v; } };
  }
  function opsBar(host, items) {
    var el = h('div', { class: 'l23-paramrow' });
    items.forEach(function (it) { el.appendChild(it); });
    host.appendChild(el);
    return el;
  }
  var ARRAY_PRESETS = function (n) {
    return [
      { label: 'Random', value: function () { return V.presets.random(n, { min: 1, max: 20 }); } },
      { label: 'Ascending', value: function () { return V.presets.sorted(n, { min: 1, max: 20 }); } },
      { label: 'Not a power of two', title: 'n = 11: the halves are uneven, and leaves sit at different depths', value: function () { return V.presets.random(11, { min: 1, max: 20 }); } },
      { label: 'Negatives', value: function () { return V.presets.random(n, { min: -9, max: 9 }); } },
      { label: 'One value', value: [7] },
      { label: 'Sixteen values', value: function () { return V.presets.random(16, { min: 1, max: 9 }); } }
    ];
  };

  /* ================================================================== flowcharts for the segment lab */
  var FLOWS = {
    query: {
      nodes: [
        { id: 'start', type: 'start', text: 'query(node, lo, hi, l, r)', col: 1, row: 0 },
        { id: 'decide', type: 'decision', text: 'how does [lo, hi]\nrelate to [l, r] ?', col: 1, row: 1 },
        { id: 'outside', type: 'process', text: 'share no cell:\nreturn identity', col: 0, row: 2 },
        { id: 'inside', type: 'process', text: 'all inside:\nreturn tree[node]', col: 1, row: 2 },
        { id: 'split', type: 'process', text: 'partly inside:\nask left child,\nthen right child', col: 2, row: 2, narrow: { col: 1, row: 3 } },
        { id: 'combine', type: 'process', text: 'combine both\nanswers, return', col: 2, row: 3, narrow: { col: 1, row: 4 } },
        { id: 'end', type: 'end', text: 'answer', col: 1, row: 4, narrow: { col: 0, row: 5 } }
      ],
      edges: [
        { from: 'start', to: 'decide' },
        { from: 'decide', to: 'outside', label: 'disjoint' },
        { from: 'decide', to: 'inside', label: 'contained' },
        { from: 'decide', to: 'split', label: 'overlap' },
        { from: 'split', to: 'combine' },
        { from: 'outside', to: 'end' },
        { from: 'inside', to: 'end' },
        { from: 'combine', to: 'end' }
      ]
    },
    update: {
      nodes: [
        { id: 'start', type: 'start', text: 'update(i, v)', col: 0, row: 0 },
        { id: 'descend', type: 'process', text: 'lo < hi: go to the half\nthat contains i', col: 0, row: 1 },
        { id: 'leaf', type: 'process', text: 'lo = hi: tree[leaf] = v', col: 0, row: 2 },
        { id: 'pull', type: 'process', text: 'tree[node] = combine(\nleft child, right child)', col: 0, row: 3 },
        { id: 'end', type: 'end', text: 'root recomputed: done', col: 0, row: 4 }
      ],
      edges: [
        { from: 'start', to: 'descend' },
        { from: 'descend', to: 'leaf', label: 'reached the leaf' },
        { from: 'leaf', to: 'pull' },
        { from: 'pull', to: 'end', label: 'at the root' }
      ]
    },
    build: {
      nodes: [
        { id: 'start', type: 'start', text: 'build(node, lo, hi)', col: 0, row: 0 },
        { id: 'leaf', type: 'process', text: 'lo = hi: tree[node] = a[lo]', col: 0, row: 1 },
        { id: 'pull', type: 'process', text: 'children done first, then\ntree[node] = combine(children)', col: 0, row: 2 },
        { id: 'end', type: 'end', text: 'root filled: done', col: 0, row: 3 }
      ],
      edges: [
        { from: 'start', to: 'leaf', label: 'leaves first' },
        { from: 'leaf', to: 'pull' },
        { from: 'pull', to: 'end', label: 'at the root' }
      ]
    }
  };
  var FLOW_TITLE = { query: 'What one node does during a query', update: 'A point update, top to bottom and back', build: 'Building the tree, bottom-up' };
  var FLOW_ALT = {
    query: 'Text alternative: at each node, if its segment shares no cell with the query return the identity; if it is contained in the query return the stored value; if it overlaps in part, ask the left child, then the right child, and combine their answers.',
    update: 'Text alternative: walk down toward the leaf that holds index i, overwrite it with v, then recompute every ancestor from its two children until the root is done.',
    build: 'Text alternative: leaves copy the array cells; every other node is filled in once both of its children are ready, and the root is filled in last.'
  };

  /* ================================================================== the segment-tree lab */
  L.initSegLab = function () {
    var fig = V.$('#lab-fig'), flowFig = V.$('#fig-flow');
    var stage = fig.querySelector('[data-stage]');
    var op = 'sum', action = 'query', values = [5, 3, 8, 1, 6, 2, 7, 4];
    var view = L.segView(stage, { label: 'Segment tree above its array' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().segCode('query', 'sum'), default: 'pseudo', maxHeight: 340, title: 'query' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var legendEl = fig.querySelector('[data-legend]');

    /* flowchart below, lit by this lab */
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOWS.query, { label: 'Flowchart of the operation running in the lab', narrowWidth: 420 });
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);
    var flowAdapter = {
      highlight: function (id, ctx) {
        var visited = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var k = 0; k < ctx.index && k < st.length; k++) if (st[k].flow && visited.indexOf(st[k].flow) === -1 && st[k].flow !== id) visited.push(st[k].flow);
        }
        flowView.render({ active: id || undefined, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };

    /* controls */
    var paramHost = fig.querySelector('[data-ops]');
    var fl = numField('l', { min: 0, max: 15, value: 1 }), fr = numField('r', { min: 0, max: 15, value: 6 });
    var fi = numField('index i', { min: 0, max: 15, value: 5 }), fv = numField('new value', { min: -99, max: 99, value: 9 });
    var keepBtn = h('button', { type: 'button', class: 'btn btn--sm', title: 'Write the new value into the array, so the next operation starts from it' }, 'Keep this change');
    var msg = h('p', { class: 'l23-msg', role: 'alert' });
    var segHost = h('div', { class: 'l23-seghost' });
    var queryRow = h('div', { class: 'l23-paramrow', 'data-for': 'query' }, fl.wrap, fr.wrap);
    var updateRow = h('div', { class: 'l23-paramrow', 'data-for': 'update' }, fi.wrap, fv.wrap, keepBtn);
    paramHost.appendChild(segHost); paramHost.appendChild(queryRow); paramHost.appendChild(updateRow); paramHost.appendChild(msg);
    var actionSeg = V.segmented(segHost, {
      label: 'Operation', value: action,
      options: [{ value: 'query', label: 'Range query' }, { value: 'update', label: 'Point update' }, { value: 'build', label: 'Build' }],
      onChange: function (a) { action = a; reload(); }
    });

    function clampParams() {
      var n = values.length;
      [fl, fr, fi].forEach(function (f) { f.input.max = n - 1; });
      if (fl.get() > n - 1) fl.set(n - 1);
      if (fr.get() > n - 1) fr.set(n - 1);
      if (fi.get() > n - 1) fi.set(n - 1);
    }
    function generate() {
      msg.textContent = '';
      var n = values.length;
      if (action === 'query') {
        var l = fl.get(), r = fr.get();
        if (!Number.isInteger(l) || !Number.isInteger(r) || l < 0 || r > n - 1 || l > r) throw new Error('Choose whole numbers with 0 ≤ l ≤ r ≤ ' + (n - 1) + '.');
        return A().segQuery(op, values, l, r);
      }
      if (action === 'update') {
        var i = fi.get(), v = fv.get();
        if (!Number.isInteger(i) || i < 0 || i > n - 1) throw new Error('The index must be a whole number from 0 to ' + (n - 1) + '.');
        if (!Number.isInteger(v) || v < -99 || v > 99) throw new Error('The new value must be a whole number from −99 to 99.');
        return A().segUpdate(op, values, i, v);
      }
      return A().segBuild(op, values);
    }
    var steps = generate();
    view.setup(values.length);
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      code: code, vars: vars, flow: flowAdapter,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { visited: 'Nodes visited', used: 'Stored values used', written: 'Nodes written' },
      counterStates: { visited: 'compare', used: 'done', written: 'swap' },
      baseStepMs: 1000, label: 'Segment tree lab controls'
    });

    /* predictions */
    player.addCheckpoint(function (st) {
      if (!st.length || st[0].counters.used === undefined) return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'inside') return k;
      return -1;
    }, function (c) {
      var m = /^s(\d+)_(\d+)$/.exec(c.step.cur || ''), lo = +m[1], hi = +m[2], q = c.step.query;
      var val = fmt(c.step.vals[c.step.cur]);
      return L.mix({
        question: 'The walk arrives at segment <code>[' + lo + ', ' + hi + ']</code>. The query is <code>[' + q.l + ', ' + q.r + ']</code>. What happens here?',
        options: ['Take the stored value <b>' + val + '</b> and stop: the whole segment is inside the range', 'Split at mid and ask both children', 'Skip the node: it does not overlap the range'],
        answer: 0,
        explain: [
          'Right. Every cell of [' + lo + ', ' + hi + '] is in the query, so the stored value is exactly the part of the answer this node owns. Nothing below it needs to be visited.',
          'Splitting is for nodes that overlap only in part. Here every cell from ' + lo + ' to ' + hi + ' is inside [' + q.l + ', ' + q.r + '], so the children would only repeat what this node already knows.',
          'The segment [' + lo + ', ' + hi + '] lies inside [' + q.l + ', ' + q.r + '], so it overlaps completely, not zero. Skipping it would lose part of the answer.'
        ]
      });
    }, { id: 'l23-lab-query-inside' });

    player.addCheckpoint(function (st) {
      if (!st.length || st[0].counters.written === undefined || st[0].counters.visited === undefined) return -1;
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'leaf') return k;
      return -1;
    }, function (c) {
      var path = Object.keys(c.step.states).filter(function (id) { return c.step.states[id] === 'path' || c.step.states[id] === 'swap'; }).length;
      var anc = path - 1, n = c.step.n;
      if (anc < 1) return null;
      var total = 2 * n - 1;
      return L.mix({
        question: 'The leaf now holds its new value. How many <em>other</em> nodes still have to be recomputed?',
        options: ['Only the ' + anc + ' ancestor' + (anc > 1 ? 's' : '') + ' of the leaf, up to the root', 'All ' + (total - 1) + ' other nodes', 'Only the leaf’s parent'],
        answer: 0,
        explain: [
          'Right. A node stores a value that includes exactly the cells of its segment, so only nodes whose segment contains this index can be wrong. That is one node per level: the path to the root.',
          'Nodes whose segment does not contain the index never included the old value, so they are still correct. Rewriting them would waste time.',
          'The parent is not enough: the grandparent’s sum includes the parent’s, so it would stay out of date. The change has to climb all the way to the root.'
        ]
      });
    }, { id: 'l23-lab-update-path' });

    function legendFor() { V.legend(legendEl, L.LEG[action]); }
    function reload() {
      /* the chrome always follows the selected operation, even when its parameters are invalid */
      queryRow.hidden = action !== 'query'; updateRow.hidden = action !== 'update';
      legendFor();
      code.setSource(A().segCode(action, op));
      flowView.setSpec(FLOWS[action]);
      flowFig.querySelector('[data-flow-title]').textContent = FLOW_TITLE[action];
      flowFig.querySelector('[data-flow-alt]').textContent = FLOW_ALT[action];
      try { steps = generate(); } catch (e) {
        msg.textContent = e.message;
        steps = []; player.setSteps([]); /* no stale steps from another operation */
        return;
      }
      view.prepare(steps);
      player.setSteps(steps);
    }
    ['change', 'input'].forEach(function (ev) { [fl, fr, fi, fv].forEach(function (f) { f.input.addEventListener(ev, function () { if (ev === 'change' || f.input.value !== '') reload(); }); }); });
    keepBtn.addEventListener('click', function () {
      var last = steps[steps.length - 1];
      if (action === 'update' && last && last.arr) { values = last.arr.slice(); inputApi.set(values); reload(); }
    });

    var tabs = V.tabs('#lab-tabs', { onChange: function (name) { op = name; code.setSource(A().segCode(action, op)); reload(); } });
    var inputApi = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (1 to 16 whole numbers, −99 to 99)', value: values,
      parse: { min: -99, max: 99, minCount: 1, maxCount: 16, integers: true },
      presets: ARRAY_PRESETS(8),
      hint: 'With a length that is not a power of two the halves are uneven and some leaves sit higher than others.',
      onApply: function (vals) { values = vals; clampParams(); reload(); }
    });
    clampParams();
    legendFor();
    queryRow.hidden = false; updateRow.hidden = true;
    return { player: player };
  };

  /* ================================================================== the lazy-propagation lab */
  L.initLazyLab = function () {
    var fig = V.$('#fig-lazy'), stage = fig.querySelector('[data-stage]');
    var values = [4, 2, 7, 1, 5, 3, 6, 8];
    var view = L.segView(stage, { label: 'Segment tree with pending lazy tags' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().LAZY_CODE, default: 'pseudo', maxHeight: 360, title: 'lazy sum tree' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var host = fig.querySelector('[data-ops]');
    var al = numField('add: l', { min: 0, max: 15, value: 2 }), ar = numField('r', { min: 0, max: 15, value: 5 }), av = numField('amount', { min: -99, max: 99, value: 3 });
    var ql = numField('then query: l', { min: 0, max: 15, value: 3 }), qr = numField('r', { min: 0, max: 15, value: 6 });
    var msg = h('p', { class: 'l23-msg', role: 'alert' });
    host.appendChild(h('div', { class: 'l23-paramrow' }, al.wrap, ar.wrap, av.wrap, h('span', { class: 'l23-sep', 'aria-hidden': 'true' }, '→'), ql.wrap, qr.wrap));
    host.appendChild(msg);
    function ops() {
      var n = values.length, f = [al, ar, av, ql, qr].map(function (x) { return x.get(); });
      if (f.some(function (x) { return !Number.isInteger(x); })) throw new Error('All five boxes need whole numbers.');
      if (f[0] < 0 || f[1] > n - 1 || f[0] > f[1]) throw new Error('For the add, choose 0 ≤ l ≤ r ≤ ' + (n - 1) + '.');
      if (f[2] < -99 || f[2] > 99 || f[2] === 0) throw new Error('The amount must be a non-zero whole number from −99 to 99.');
      if (f[3] < 0 || f[4] > n - 1 || f[3] > f[4]) throw new Error('For the query, choose 0 ≤ l ≤ r ≤ ' + (n - 1) + '.');
      return [{ type: 'add', l: f[0], r: f[1], v: f[2] }, { type: 'query', l: f[3], r: f[4] }];
    }
    var steps = A().lazyRun(values, ops());
    view.setup(values.length); view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { visited: 'Nodes visited', pushes: 'Tags pushed down' }, counterStates: { visited: 'compare', pushes: 'key' },
      baseStepMs: 1100, label: 'Lazy propagation lab controls'
    });
    player.addCheckpoint(function (st) {
      for (var k = 1; k < st.length; k++) if (st[k].kind === 'push') return k;
      return -1;
    }, function (c) {
      var m = /^s(\d+)_(\d+)$/.exec(c.step.cur || ''), lo = +m[1], hi = +m[2];
      var t = c.prev.tags[c.step.cur];
      return L.mix({
        question: 'Node <code>[' + lo + ', ' + hi + ']</code> carries a pending tag <b>+' + fmt(t) + '</b>, and the walk must go into its children. What has to happen first?',
        options: ['Push the tag down: add it to both children, then clear it here', 'Add the tag to this node’s sum again', 'Nothing: the children can be read as they are'],
        answer: 0,
        explain: [
          'Right. The tag is a promise that the children owe ' + fmt(t) + ' per cell. Before reading them we pay that debt, so their sums are true. The node keeps no tag afterwards.',
          'This node’s sum already includes the tag (it was added when the tag was placed). Adding it again would count it twice.',
          'The children are stale: they never saw the +' + fmt(t) + '. Reading them now would return numbers that are too small.'
        ]
      });
    }, { id: 'l23-lazy-push' });
    function reload() {
      msg.textContent = '';
      try { steps = A().lazyRun(values, ops()); } catch (e) { msg.textContent = e.message; return; }
      view.prepare(steps); player.setSteps(steps);
    }
    V.$$('input', host).forEach(function (i) { i.addEventListener('change', reload); });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (1 to 16 whole numbers, −99 to 99)', value: values,
      parse: { min: -99, max: 99, minCount: 1, maxCount: 16, integers: true },
      presets: [
        { label: 'Default', value: [4, 2, 7, 1, 5, 3, 6, 8] },
        { label: 'All zeros', value: [0, 0, 0, 0, 0, 0, 0, 0] },
        { label: 'Sixteen values', value: function () { return V.presets.random(16, { min: 1, max: 9 }); } },
        { label: 'Random', value: function () { return V.presets.random(8, { min: 1, max: 9 }); } }
      ],
      onApply: function (vals) {
        values = vals;
        [al, ar, ql, qr].forEach(function (f) { f.input.max = values.length - 1; if (f.get() > values.length - 1) f.set(values.length - 1); });
        reload();
      }
    });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'swap', label: 'Tag placed or pushed' }, { state: 'done', label: 'Query: taken whole' }, { state: 'compare', label: 'Partly covered' }, { state: 'muted', label: 'Outside' },
      { state: 'key', shape: 'dot', label: 'Pending tag +v' }, { state: 'default', shape: 'dash', label: 'Stale (a tag is above)' }
    ]);
    return { player: player };
  };

  /* ================================================================== the Fenwick lab */
  L.initFenLab = function () {
    var fig = V.$('#fen-lab'), stage = fig.querySelector('[data-stage]');
    var values = L.FEN16.slice(), action = 'prefix';
    var view = L.fenView(stage, { label: 'Fenwick tree above its array' });
    var bits = L.bitCalc(fig.querySelector('[data-bits]'), { bits: 6, rows: ['i', 'neg', 'low', 'next'], label: 'The bit arithmetic of the current jump' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().FEN_CODE.prefix, default: 'pseudo', maxHeight: 250, title: 'prefix' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var host = fig.querySelector('[data-ops]');
    var fp = numField('prefix(i), i', { min: 0, max: 16, value: 13 });
    var fl = numField('l', { min: 1, max: 16, value: 4 }), fr = numField('r', { min: 1, max: 16, value: 13 });
    var fi = numField('index i', { min: 1, max: 16, value: 5 }), fd = numField('add', { min: -99, max: 99, value: 4 });
    var keepBtn = h('button', { type: 'button', class: 'btn btn--sm', title: 'Write the change into the array so the next operation starts from it' }, 'Keep this change');
    var msg = h('p', { class: 'l23-msg', role: 'alert' });
    var segHost = h('div', { class: 'l23-seghost' });
    var rows = {
      prefix: h('div', { class: 'l23-paramrow' }, fp.wrap),
      range: h('div', { class: 'l23-paramrow' }, fl.wrap, fr.wrap),
      update: h('div', { class: 'l23-paramrow' }, fi.wrap, fd.wrap, keepBtn)
    };
    host.appendChild(segHost);
    Object.keys(rows).forEach(function (k) { host.appendChild(rows[k]); });
    host.appendChild(msg);
    V.segmented(segHost, {
      label: 'Operation', value: action,
      options: [{ value: 'prefix', label: 'Prefix sum' }, { value: 'range', label: 'Range sum' }, { value: 'update', label: 'Update' }],
      onChange: function (a) { action = a; reload(); }
    });
    function clampParams() {
      var n = values.length;
      [fp, fl, fr, fi].forEach(function (f) { f.input.max = n; });
      if (fp.get() > n) fp.set(n);
      [fl, fr, fi].forEach(function (f) { if (f.get() > n) f.set(n); });
    }
    function generate() {
      var n = values.length;
      msg.textContent = '';
      if (action === 'prefix') {
        var i = fp.get();
        if (!Number.isInteger(i) || i < 0 || i > n) throw new Error('i must be a whole number from 0 to ' + n + '.');
        return A().fenPrefix(values, i);
      }
      if (action === 'range') {
        var l = fl.get(), r = fr.get();
        if (!Number.isInteger(l) || !Number.isInteger(r) || l < 1 || r > n || l > r) throw new Error('Choose whole numbers with 1 ≤ l ≤ r ≤ ' + n + '. Fenwick indices start at 1.');
        return A().fenRange(values, l, r);
      }
      var j = fi.get(), d = fd.get();
      if (!Number.isInteger(j) || j < 1 || j > n) throw new Error('The index must be a whole number from 1 to ' + n + '.');
      if (!Number.isInteger(d) || d < -99 || d > 99) throw new Error('The amount must be a whole number from −99 to 99.');
      return A().fenUpdate(values, j, d);
    }
    var steps = generate();
    view.setup(values.length); view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (st, ctx) {
        view.render(st, { duration: ctx.duration });
        bits.set(st.calc ? st.calc.i : null, { mode: st.calc ? st.calc.mode : 'sub', duration: ctx.duration });
      },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { steps: 'Blocks visited' }, counterStates: { steps: 'compare' },
      baseStepMs: 1050, label: 'Fenwick lab controls'
    });

    function jumpCheck(kind) {
      return function (st) {
        if (!st.length || st[0].type !== 'fen') return -1;
        var isUpdate = st[1] && st[1].phase === 'update';
        if ((kind === 'update') !== !!isUpdate) return -1;
        for (var k = 1; k < st.length; k++) if (st[k].kind === 'jump') return k;
        return -1;
      };
    }
    function jumpSpec(kind) {
      return function (c) {
        var cl = c.prev.calc; if (!cl) return null;
        var i = cl.i, low = cl.low, bin = i.toString(2), n = c.step.n;
        var right = kind === 'update' ? i + low : i - low;
        var cands = kind === 'update' ? [right, i + 1, i - low, i * 2] : [right, i - 1, i + low, i >> 1];
        var text = cands.filter(function (v, k) { return cands.indexOf(v) === k && v >= 0; });
        var why = kind === 'update'
          ? ['Right. Adding the lowest set bit (' + i + ' + ' + low + ') skips past all the 1 bits below it and lands on the next block big enough to contain the changed cell.', 'That is the next cell, not the next block. Blocks that contain the cell are found by adding the lowest set bit, not 1.', 'Subtracting is what a prefix query does. An update has to climb to larger blocks, so it adds.', 'Doubling can skip blocks that contain the cell. Adding i & −i is exact.']
          : ['Right. Strip the lowest set bit: ' + i + ' − ' + low + '. Block T[' + i + '] covered exactly ' + low + ' cell' + (low > 1 ? 's' : '') + ', so what is left is a[1..' + (i - low) + '].', 'That would step down one cell. But T[' + i + '] just covered ' + low + ' cells at once, and a[1..' + (i - low) + '] is what remains, so we can jump straight there.', 'Adding climbs to bigger blocks, which is what an update does. A prefix query moves down.', 'Halving the index does not respect the block boundaries. Only stripping the lowest set bit does.'];
        var explain = text.map(function (v) { return why[cands.indexOf(v)]; });
        return L.mix({
          question: 'Index <code>' + i + '</code> is <code>' + bin + '</code> in binary, and its lowest set bit is <b>' + low + '</b>. ' + (kind === 'update' ? 'The block has been updated.' : 'T[' + i + '] has been added.') + ' Which index comes next?',
          options: text.map(function (v) { return String(v) + (v > n ? ' (past the end)' : ''); }), answer: text.indexOf(right), explain: explain
        });
      };
    }
    player.addCheckpoint(jumpCheck('prefix'), jumpSpec('prefix'), { id: 'l23-fen-prefix-jump' });
    player.addCheckpoint(jumpCheck('update'), jumpSpec('update'), { id: 'l23-fen-update-jump' });

    var CODE_TITLE = { prefix: 'prefix', range: 'rangeSum', update: 'update' };
    function legendFor() {
      var items = [{ state: 'active', label: 'Block being read' }, { state: 'done', label: action === 'update' ? 'Block containing the cell' : 'Added to the sum' }];
      if (action === 'range') items.push({ state: 'compare', label: 'Subtracted part' });
      if (action === 'update') items = [{ state: 'swap', label: 'Block updated' }];
      items.push({ state: 'pivot', label: 'Lowest set bit' });
      V.legend(fig.querySelector('[data-legend]'), items);
    }
    function reload() {
      Object.keys(rows).forEach(function (k) { rows[k].hidden = k !== action; });
      code.setSource(A().FEN_CODE[action]);
      legendFor();
      try { steps = generate(); } catch (e) {
        msg.textContent = e.message;
        steps = []; player.setSteps([]); /* no stale steps from another operation */
        return;
      }
      view.reset(); view.prepare(steps);
      player.setSteps(steps);
    }
    [fp, fl, fr, fi, fd].forEach(function (f) { f.input.addEventListener('change', reload); });
    keepBtn.addEventListener('click', function () {
      var last = steps[steps.length - 1];
      if (action === 'update' && last) { values = last.arr.slice(); inputApi.set(values); reload(); }
    });
    var inputApi = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (1 to 16 whole numbers, −99 to 99)', value: values,
      parse: { min: -99, max: 99, minCount: 1, maxCount: 16, integers: true },
      presets: [
        { label: 'Sixteen values', value: L.FEN16 },
        { label: 'All ones', value: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
        { label: 'Powers of two (n = 8)', value: [1, 2, 4, 8, 16, 32, 64, 5] },
        { label: 'Twelve values', value: function () { return V.presets.random(12, { min: 1, max: 9 }); } },
        { label: 'One value', value: [7] }
      ],
      hint: 'A tree over n cells has ⌊log₂ n⌋ + 1 levels of blocks. Try 12 values: the last index has no block above it.',
      onApply: function (vals) { values = vals; clampParams(); reload(); }
    });
    clampParams();
    Object.keys(rows).forEach(function (k) { rows[k].hidden = k !== action; });
    legendFor();
    return { player: player };
  };

  /* ================================================================== cost chart */
  L.initCost = function () {
    var fig = V.$('#fig-cost'), stage = fig.querySelector('[data-stage]');
    var chart = V.views.chart(stage, { type: 'line', height: 320, label: 'Operations per query or update as the array grows' });
    var note = fig.querySelector('[data-note]');
    var exps = []; for (var e = 2; e <= 20; e++) exps.push(e);
    var table = null;
    function tbl() {
      if (!table) table = exps.map(function (k) { return A().costs(Math.pow(2, k), { samples: 300, seed: 7 }); });
      return table;
    }
    var mode = 'query', log = true, k = 10;
    var NAMES = { naive: 'Plain array', prefix: 'Prefix sums', seg: 'Segment tree', fen: 'Fenwick tree' };
    var STATE = { naive: 'error', prefix: 'compare', seg: 'active', fen: 'done' };
    function keyOf(name) { return name + (mode === 'query' ? 'Query' : 'Update'); }
    function draw(dur) {
      var t = tbl();
      var series = Object.keys(NAMES).map(function (name) {
        return { id: name, label: NAMES[name], state: STATE[name], points: exps.map(function (ex, i) { return [Math.pow(2, ex), Math.max(1, t[i][keyOf(name)])]; }) };
      });
      var idx = exps.indexOf(k), n = Math.pow(2, k);
      var top = 0; series.forEach(function (s) { s.points.forEach(function (p) { top = Math.max(top, p[1]); }); });
      /* one number format for the bubbles and the sentence below, so they always agree */
      function f(x) { return x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1); }
      /* A bubble sits above its point and would cover a neighbour's ring when two values are close on screen.
         Walk from the highest value down and skip a bubble that would land on one already shown; the sentence
         below the chart always lists all four values. */
      var PX = 240, ymaxV = log ? top * 1.6 : top * 1.05;
      function py(v) { return log ? -PX * Math.log10(Math.max(1, v)) / Math.log10(ymaxV) : -PX * v / ymaxV; }
      var shown = [], hl = [];
      series.slice().sort(function (a, b) { return b.points[idx][1] - a.points[idx][1]; }).forEach(function (s) {
        var v = s.points[idx][1], y = py(v);
        var clash = shown.some(function (y2) { return y2 > y - 42 && y2 < y - 4; });
        if (clash) return;
        shown.push(y); hl.push({ series: s.id, x: n, y: v, label: f(v) });
      });
      chart.render({
        x: { label: 'n (number of cells)', scale: 'log', min: 4, max: 1048576, ticks: [4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576] },
        y: log ? { label: (mode === 'query' ? 'cells read per range query' : 'cells written per update') + ' (log scale)', scale: 'log', min: 1, max: top * 1.6 } : { label: mode === 'query' ? 'cells read per range query' : 'cells written per update', min: 0, max: top * 1.05 },
        series: series,
        highlight: hl
      }, { duration: dur });
      note.innerHTML = 'At <b>n = ' + n.toLocaleString('en-US') + '</b>, one ' + (mode === 'query' ? 'range query' : 'point update') + ' touches on average: plain array <b>' + f(t[idx][keyOf('naive')]) + '</b>, prefix sums <b>' + f(t[idx][keyOf('prefix')]) + '</b>, segment tree <b>' + f(t[idx][keyOf('seg')]) + '</b>, Fenwick tree <b>' + f(t[idx][keyOf('fen')]) + '</b>. Doubling n adds about one step to the trees.';
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Operation', value: mode, options: [{ value: 'query', label: 'Range query' }, { value: 'update', label: 'Point update' }], onChange: function (m) { mode = m; draw(700); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: true, onChange: function (on) { log = on; draw(900); } });
    var sl = fig.querySelector('[data-toggle]').parentNode;
    var sHost = h('div', { class: 'l23-slider' });
    sl.appendChild(sHost);
    V.slider(sHost, { label: 'Highlight n = 2^k', min: 2, max: 20, step: 1, value: k, format: function (v) { return '2^' + v + ' = ' + Math.pow(2, v).toLocaleString('en-US'); }, onInput: function (v) { k = v; draw(250); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'error', shape: 'line', label: 'Plain array' }, { state: 'compare', shape: 'line', label: 'Prefix sums' }, { state: 'active', shape: 'line', label: 'Segment tree' }, { state: 'done', shape: 'line', label: 'Fenwick tree' }]);
    draw(0);
  };

  /* ================================================================== "which structure?" decision diagram */
  L.initChoose = function () {
    var fig = V.$('#fig-choose');
    var spec = {
      nodes: [
        { id: 'q1', type: 'decision', text: 'Does the array\nchange?', col: 1, row: 0, narrow: { col: 0, row: 0 } },
        { id: 'prefix', type: 'end', text: 'Prefix sums', col: 0, row: 1, narrow: { col: 1, row: 1 } },
        { id: 'q2', type: 'decision', text: 'Sum, xor\nor count?', col: 2, row: 1, narrow: { col: 0, row: 1 } },
        { id: 'seg', type: 'end', text: 'Segment tree\n(min, max, gcd,\nlazy updates)', col: 1, row: 2, narrow: { col: 1, row: 2 } },
        { id: 'q3', type: 'decision', text: 'Range updates\ntoo?', col: 3, row: 2, narrow: { col: 0, row: 2 } },
        { id: 'fen', type: 'end', text: 'Fenwick tree', col: 2, row: 3, narrow: { col: 0, row: 3 } },
        { id: 'both', type: 'end', text: 'Lazy segment tree\nor two Fenwick trees', col: 3, row: 3, narrow: { col: 1, row: 3 } }
      ],
      edges: [
        { from: 'q1', to: 'prefix', label: 'no' }, { from: 'q1', to: 'q2', label: 'yes' },
        { from: 'q2', to: 'seg', label: 'no' }, { from: 'q2', to: 'q3', label: 'yes' },
        { from: 'q3', to: 'fen', label: 'no' }, { from: 'q3', to: 'both', label: 'yes' }
      ]
    };
    var answers = {
      prefix: '<b>Prefix sums.</b> With no updates, precompute once: build in O(n), answer any range in O(1) as P[r] − P[l − 1].',
      seg: '<b>Segment tree.</b> It handles any associative combine: minimum, maximum, gcd. Add lazy tags if you also need range updates. O(log n) per operation.',
      fen: '<b>Fenwick tree.</b> The smallest, fastest option for prefix sums with point updates: one array of n numbers and a few lines of code.',
      both: '<b>Lazy segment tree</b>, or two Fenwick trees for range add and range sum (advanced). Both are O(log n) per operation.'
    };
    var flow = V.views.flowchart(fig.querySelector('[data-stage]'), spec, { interactive: true, label: 'Which range-query structure should I use?', narrowWidth: 460 });
    var out = fig.querySelector('[data-answer]');
    var taken, path;
    function start() { taken = {}; path = []; flow.render({ active: 'q1' }, { duration: 0 }); out.textContent = 'Click an answer to walk the diagram.'; out.removeAttribute('data-state'); }
    flow.on('choose', function (e) {
      path.push(e.node); taken[e.node + '->' + e.to] = 'path';
      if (answers[e.to]) { flow.render({ active: e.to, visited: path, edgeStates: taken, states: (function () { var o = {}; o[e.to] = 'found'; return o; })() }, { duration: 420 }); out.innerHTML = answers[e.to]; out.setAttribute('data-state', 'done'); }
      else { flow.render({ active: e.to, visited: path, edgeStates: taken }, { duration: 420 }); out.textContent = 'Now answer the next question.'; out.removeAttribute('data-state'); }
    });
    fig.querySelector('[data-restart]').addEventListener('click', start);
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Current question' }, { state: 'path', shape: 'line', label: 'Your answers' }, { state: 'found', label: 'Recommendation' }]);
    start();
  };
}());
