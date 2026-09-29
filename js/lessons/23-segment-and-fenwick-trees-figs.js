/* Lesson 23 — the smaller figures: hero teaser, the three-approaches comparison, the cover explorer, the three node kinds,
   the build / query / update players, the lowbit explorer, the responsibility figure, variation minis, the click check
   and the summary tiles. Uses VDSA.algos.rangeTrees and the views in 23-segment-and-fenwick-trees-views.js.
   Started by js/lessons/23-segment-and-fenwick-trees.js (heavy figures start lazily). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var L = V.lessons.l23;
  function A() { return V.algos.rangeTrees; }
  function fmt(v) { return L.fmt(v); }

  var A8 = [5, 3, 8, 1, 6, 2, 7, 4];
  L.A8 = A8;

  var LEG = {
    query: [{ state: 'done', label: 'Fully inside: take its value' }, { state: 'compare', label: 'Partly inside: split' }, { state: 'muted', label: 'Outside: skip' }, { state: 'active', shape: 'ring', label: 'Node being handled' }],
    update: [{ state: 'path', label: 'On the path to the leaf' }, { state: 'swap', label: 'Rewritten' }, { state: 'active', shape: 'ring', label: 'Node being handled' }],
    build: [{ state: 'swap', label: 'Just computed' }, { state: 'visited', label: 'Ready' }, { state: 'active', shape: 'ring', label: 'Node being handled' }]
  };
  L.LEG = LEG;

  /* the last snapshot of a trace, restyled as a quiet final picture */
  function finalOf(steps) { return steps[steps.length - 1]; }

  /* ================================================================== hero teaser */
  L.heroTeaser = function () {
    var stage = V.$('#teaser');
    var view = L.segView(stage, { compact: true, cellMax: 50, label: 'Segment tree animation' });
    var arr = [4, 7, 2, 9, 5, 3, 8, 6];
    var steps = [];
    [[1, 5], [0, 3], [3, 7], [2, 2]].forEach(function (rg) {
      var tr = A().segQuery('sum', arr, rg[0], rg[1]);
      tr.forEach(function (st) { if (st.kind === 'split' || st.kind === 'inside' || st.kind === 'outside' || st.kind === 'done') steps.push(Object.assign({}, st, { move: null })); });
    });
    view.setup(8);
    var still = steps.findIndex(function (st) { return st.kind === 'done'; });
    V.teaser(stage, { steps: steps, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 380, holdMs: 900, staticIndex: still });
  };

  /* ================================================================== a plain strip of cells (used by the comparison) */
  function stripView(container, n, opts) {
    opts = opts || {};
    var cw = opts.cw || 38;
    var W = n * cw + 8, H = 62;
    var svg = s('svg', { class: 'l23-svg l23-strip', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || 'Cells' });
    var cells = [];
    for (var i = 0; i < n; i++) {
      var g = s('g', { class: 'l23-cell is-default', transform: 'translate(' + (4 + (i + 0.5) * cw) + ' 6)' });
      g.appendChild(s('rect', { class: 'l23-cbox', x: -cw / 2 + 2, y: 0, width: cw - 4, height: 34, rx: 7 }));
      var v = s('text', { class: 'l23-cval', y: 22, 'text-anchor': 'middle' });
      var ix = s('text', { class: 'l23-cidx', y: 48, 'text-anchor': 'middle' }); ix.textContent = i;
      g.appendChild(v); g.appendChild(ix); svg.appendChild(g);
      cells.push({ g: g, v: v });
    }
    container.appendChild(svg);
    return {
      el: svg,
      render: function (vals, states, dur) {
        svg.style.setProperty('--t', (dur || 0) + 'ms');
        cells.forEach(function (c, i) {
          var st = states && states[i] ? states[i] : 'default';
          c.g.setAttribute('class', 'l23-cell is-' + st);
          var t = fmt(vals[i]);
          if (c.v.textContent !== t) {
            c.v.textContent = t;
            if (dur && c.v.animate) c.v.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300 });
          }
        });
      }
    };
  }

  /* ================================================================== the problem: three approaches */
  L.threeWays = function () {
    var fig = V.$('#fig-three'), stage = fig.querySelector('[data-stage]');
    var N = 8, rng = V.rng(23);
    var arr = A8.slice();
    var totals = { naive: { q: 0, u: 0 }, prefix: { q: 0, u: 0 }, seg: { q: 0, u: 0 } };
    var panels = {};
    function panel(key, title, sub) {
      var host = h('div', { class: 'l23-panel__stage' });
      var note = h('p', { class: 'l23-panel__note' });
      var bign = h('span', { class: 'l23-big__n' }, '–');
      var bigl = h('span', { class: 'l23-big__l' }, 'last operation');
      var big = h('div', { class: 'l23-big', 'aria-hidden': 'true' }, bign, bigl);
      var stats = h('div', { class: 'l23-panel__stats' });
      var bar = h('div', { class: 'l23-panel__bar' }, h('i'));
      var el = h('div', { class: 'l23-panel', 'data-key': key },
        h('div', { class: 'l23-panel__head' }, h('span', { class: 'l23-panel__name' }, title), h('span', { class: 'l23-panel__sub', html: sub })),
        h('div', { class: 'l23-panel__body' }, host, big, note), stats, bar);
      stage.appendChild(el);
      return { el: el, host: host, note: note, bign: bign, bigl: bigl, stats: V.stats(stats, { labels: { q: 'Query cost', u: 'Update cost', t: 'Total' }, states: { q: 'compare', u: 'swap', t: 'active' } }), bar: bar.firstChild };
    }
    panels.naive = panel('naive', 'Plain array', 'query <span class="big-o" data-o="n"></span> · update <span class="big-o" data-o="1"></span>');
    panels.prefix = panel('prefix', 'Prefix sums', 'query <span class="big-o" data-o="1"></span> · update <span class="big-o" data-o="n"></span>');
    panels.seg = panel('seg', 'Segment tree', 'query <span class="big-o" data-o="logn"></span> · update <span class="big-o" data-o="logn"></span>');
    V.$$('.big-o[data-o]', stage).forEach(function (b) { if (!b.textContent) b.textContent = { n: 'O(n)', 1: 'O(1)', logn: 'O(log n)' }[b.dataset.o]; });
    var naiveStrip = stripView(panels.naive.host, N, { label: 'The plain array', cw: 34 });
    var prefStrip = stripView(panels.prefix.host, N, { label: 'The prefix-sum array', cw: 34 });
    var segView = L.segView(panels.seg.host, { compact: true, cellMax: 40, cellMin: 30, bracket: false, label: 'Segment tree over the same numbers' });
    function prefixOf(a) { var p = [], t = 0; a.forEach(function (x) { t += x; p.push(t); }); return p; }
    var lastSeg = null;
    function drawAll(states, segSnap, dur) {
      naiveStrip.render(arr, states.naive, dur);
      prefStrip.render(prefixOf(arr), states.prefix, dur);
      segView.render(segSnap, { duration: dur });
    }
    function idleSeg() {
      var shp = A().shape(N);
      return { type: 'seg', op: 'sum', n: N, arr: arr.slice(), vals: A().treeValues('sum', arr, shp), states: {}, ret: {}, tags: {}, stale: {}, cells: {}, query: null, cur: null, move: null };
    }
    function updateBars() {
      var max = 1;
      ['naive', 'prefix', 'seg'].forEach(function (k) { max = Math.max(max, totals[k].q + totals[k].u); });
      ['naive', 'prefix', 'seg'].forEach(function (k) {
        var t = totals[k].q + totals[k].u;
        panels[k].stats.update({ q: totals[k].q, u: totals[k].u, t: t });
        panels[k].bar.style.width = (t / Math.max(max, 20) * 100) + '%';
      });
    }
    function showBig(vals, verb) {
      ['naive', 'prefix', 'seg'].forEach(function (k) {
        panels[k].bign.textContent = vals[k];
        panels[k].bigl.textContent = (k === 'seg' ? (vals[k] === 1 ? 'node ' : 'nodes ') : (vals[k] === 1 ? 'cell ' : 'cells ')) + (verb === 'read' ? 'read' : 'written');
        panels[k].bign.parentNode.dataset.verb = verb;
      });
    }
    var caption = fig.querySelector('[data-caption]');
    var lIn, rIn, iIn;
    function sel(label, val, max) {
      var s0 = h('select', { class: 'field l23-sel', 'aria-label': label });
      for (var k = 0; k < max; k++) s0.appendChild(h('option', { value: k }, String(k)));
      s0.value = val;
      return s0;
    }
    function doQuery(l, r) {
      if (l > r) { var t = l; l = r; r = t; lIn.value = l; rIn.value = r; }
      var sum = 0; for (var k = l; k <= r; k++) sum += arr[k];
      var ns = {}, ps = {};
      for (k = l; k <= r; k++) ns[k] = 'compare';
      ps[r] = 'compare'; if (l > 0) ps[l - 1] = 'compare';
      var tr = A().segQuery('sum', arr, l, r), last = finalOf(tr);
      var seg = last.counters.visited;
      totals.naive.q += r - l + 1; totals.prefix.q += l > 0 ? 2 : 1; totals.seg.q += seg;
      drawAll({ naive: ns, prefix: ps }, last, 450);
      updateBars();
      showBig({ naive: r - l + 1, prefix: l > 0 ? 2 : 1, seg: seg }, 'read');
      panels.naive.note.innerHTML = 'Read <b>' + (r - l + 1) + '</b> cell' + (r > l ? 's' : '') + ' one by one, from ' + l + ' to ' + r + '. The longer the range, the longer the loop.';
      panels.prefix.note.innerHTML = 'Read <b>' + (l > 0 ? 2 : 1) + '</b> entr' + (l > 0 ? 'ies' : 'y') + ': the answer is <code>P[' + r + ']' + (l > 0 ? ' − P[' + (l - 1) + ']' : '') + '</code>, however wide the range.';
      panels.seg.note.innerHTML = 'Visited <b>' + seg + '</b> node' + (seg > 1 ? 's' : '') + ' and added <b>' + last.counters.used + '</b> stored sum' + (last.counters.used > 1 ? 's' : '') + ' (green).';
      caption.innerHTML = 'Query <b>a[' + l + '..' + r + '] = ' + sum + '</b>. The plain array read <b>' + (r - l + 1) + '</b> cell' + (r > l ? 's' : '') + ', the prefix array read <b>' + (l > 0 ? 2 : 1) + '</b> (P[' + r + ']' + (l > 0 ? ' − P[' + (l - 1) + ']' : '') + '), the tree visited <b>' + seg + '</b> node' + (seg > 1 ? 's' : '') + ' and used <b>' + last.counters.used + '</b> stored sum' + (last.counters.used > 1 ? 's' : '') + '.';
    }
    function doUpdate(i, v) {
      var tr = A().segUpdate('sum', arr, i, v), last = finalOf(tr);
      arr[i] = v;
      var ns = {}, ps = {};
      ns[i] = 'swap'; for (var k = i; k < N; k++) ps[k] = 'swap';
      totals.naive.u += 1; totals.prefix.u += N - i; totals.seg.u += last.counters.written;
      drawAll({ naive: ns, prefix: ps }, last, 450);
      updateBars();
      showBig({ naive: 1, prefix: N - i, seg: last.counters.written }, 'written');
      panels.naive.note.innerHTML = 'Wrote <b>1</b> cell. Nothing else stores a copy of it.';
      panels.prefix.note.innerHTML = 'Rewrote <b>' + (N - i) + '</b> entr' + (N - i > 1 ? 'ies' : 'y') + ': every prefix from index ' + i + ' onward includes the changed cell.';
      panels.seg.note.innerHTML = 'Rewrote <b>' + last.counters.written + '</b> nodes: the leaf and its ancestors, one path to the root.';
      caption.innerHTML = 'Update <b>a[' + i + '] = ' + v + '</b>. The plain array wrote <b>1</b> cell, the prefix array had to rewrite <b>' + (N - i) + '</b> (every entry from ' + i + ' to the end includes a[' + i + ']), the tree rewrote <b>' + last.counters.written + '</b> nodes, one path to the root.';
    }
    function reset() {
      arr = A8.slice();
      totals = { naive: { q: 0, u: 0 }, prefix: { q: 0, u: 0 }, seg: { q: 0, u: 0 } };
      drawAll({ naive: {}, prefix: {} }, idleSeg(), 0);
      updateBars();
      ['naive', 'prefix', 'seg'].forEach(function (k) { panels[k].bign.textContent = '–'; panels[k].bigl.textContent = 'last operation'; panels[k].bign.parentNode.dataset.verb = ''; });
      panels.naive.note.innerHTML = 'Query: read every cell of the range. Update: write one cell.';
      panels.prefix.note.innerHTML = 'Query: two reads. Update: rewrite every entry after the changed cell.';
      panels.seg.note.innerHTML = 'Query and update: touch a handful of nodes, never more than about log n per level.';
      caption.textContent = 'Pick a range and press Query, or pick an index and press Update. The bars under each column add up the cost of everything you have done.';
    }
    var bar = fig.querySelector('[data-controls-row]');
    lIn = sel('Left end l', 1, N); rIn = sel('Right end r', 6, N); iIn = sel('Index i', 2, N);
    bar.appendChild(h('div', { class: 'l23-fld' }, h('span', { class: 'field-label' }, 'Range'), h('span', { class: 'l23-fld__row' }, lIn, h('span', { 'aria-hidden': 'true' }, '…'), rIn, h('button', { type: 'button', class: 'btn btn--sm btn--primary', onclick: function () { doQuery(+lIn.value, +rIn.value); } }, 'Query'))));
    bar.appendChild(h('div', { class: 'l23-fld' }, h('span', { class: 'field-label' }, 'Point'), h('span', { class: 'l23-fld__row' }, iIn, h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { doUpdate(+iIn.value, rng.int(1, 9)); } }, 'Update to a new value'))));
    bar.appendChild(h('div', { class: 'l23-fld' }, h('span', { class: 'field-label' }, 'Or'), h('span', { class: 'l23-fld__row' },
      h('button', { type: 'button', class: 'btn btn--sm', onclick: function () {
        for (var k = 0; k < 10; k++) { if (rng() < 0.5) { var a = rng.int(0, N - 1), b = rng.int(0, N - 1); doQuery(Math.min(a, b), Math.max(a, b)); } else doUpdate(rng.int(0, N - 1), rng.int(1, 9)); }
        caption.innerHTML = 'Ten random operations later: plain array <b>' + (totals.naive.q + totals.naive.u) + '</b>, prefix sums <b>' + (totals.prefix.q + totals.prefix.u) + '</b>, segment tree <b>' + (totals.seg.q + totals.seg.u) + '</b> cells touched. The tree is never the worst at either operation.';
      } }, 'Run 10 random operations'),
      h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: reset }, 'Reset'))));
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Read' }, { state: 'swap', label: 'Written' }, { state: 'done', label: 'Tree: value taken whole' }]);
    reset();
  };

  /* ================================================================== the cover explorer (16 cells) */
  L.coverExplorer = function () {
    var fig = V.$('#fig-cover'), stage = fig.querySelector('[data-stage]');
    var arr = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
    var view = L.segView(stage, { label: 'Segment tree over sixteen cells with a chosen range', cellMin: 32 });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { cells: 'Cells in the range', blocks: 'Blocks that cover it', visited: 'Nodes visited' }, states: { cells: 'default', blocks: 'done', visited: 'compare' } });
    var caption = fig.querySelector('[data-caption]');
    var l = 3, r = 12, lS, rS;
    function draw(dur) {
      var tr = A().segQuery('sum', arr, l, r), last = finalOf(tr);
      view.render(Object.assign({}, last, { ret: {}, cur: null, move: null }), { duration: dur });
      var done = A().shape(16).nodes.filter(function (nd) { return last.states[nd.id] === 'done'; }).sort(function (a, b) { return a.lo - b.lo; });
      stats.update({ cells: r - l + 1, blocks: done.length, visited: last.counters.visited });
      caption.innerHTML = '<b>a[' + l + '..' + r + ']</b> is ' + (r - l + 1) + ' cell' + (r > l ? 's' : '') + ', covered by <b>' + done.length + '</b> block' + (done.length > 1 ? 's' : '') + ': ' + done.map(function (nd) { return nd.lo === nd.hi ? '[' + nd.lo + ']' : '[' + nd.lo + ',' + nd.hi + ']'; }).join(' + ') + '. Their stored sums add up to <b>' + last.answer + '</b>. Blocks never overlap and never leave a gap.';
    }
    lS = V.slider(fig.querySelector('[data-slider-l]'), { label: 'Left end l', min: 0, max: 15, step: 1, value: l, onInput: function (v) { l = v; if (l > r) { r = l; rS.set(r); } draw(350); } });
    rS = V.slider(fig.querySelector('[data-slider-r]'), { label: 'Right end r', min: 0, max: 15, step: 1, value: r, onInput: function (v) { r = v; if (r < l) { l = r; lS.set(l); } draw(350); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'done', label: 'Block used whole' }, { state: 'compare', label: 'Overlaps in part' }, { state: 'muted', label: 'Outside' }]);
    view.setup(16);
    draw(0);
  };

  /* ================================================================== the three node kinds (static minis) */
  L.kindMinis = function () {
    var host = V.$('#mini-kinds');
    var KINDS = [
      { state: 'muted', title: 'Outside', l: 2, r: 5, lo: 6, hi: 7, text: 'No shared cell. Return the identity (0 for a sum) and stop: nothing here belongs to the answer.' },
      { state: 'done', title: 'Fully inside', l: 2, r: 5, lo: 2, hi: 3, text: 'Every cell is wanted. Return the stored value and stop: the children need not be opened.' },
      { state: 'compare', title: 'Partly inside', l: 2, r: 5, lo: 4, hi: 7, text: 'Some cells are wanted, some not. Split, ask both children, combine their answers.' }
    ];
    KINDS.forEach(function (k) {
      var cw = 28, W = 8 * cw + 16, H = 74;
      var svg = s('svg', { class: 'vz l23-svg l23-kind', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': k.title + ': the query covers cells ' + k.l + ' to ' + k.r + ' and the node covers cells ' + k.lo + ' to ' + k.hi });
      svg.appendChild(s('rect', { class: 'l23-band', x: 8 + k.l * cw, y: 2, width: (k.r - k.l + 1) * cw, height: 38, rx: 5, style: 'opacity:1' }));
      for (var i = 0; i < 8; i++) {
        var g = s('g', { class: 'l23-cell is-' + (i >= k.l && i <= k.r ? 'default is-inq' : 'default'), transform: 'translate(' + (8 + (i + 0.5) * cw) + ' 6)' });
        g.appendChild(s('rect', { class: 'l23-cbox', x: -cw / 2 + 2, y: 0, width: cw - 4, height: 26, rx: 6 }));
        var t = s('text', { class: 'l23-cval', y: 18, 'text-anchor': 'middle' }); t.textContent = i; g.appendChild(t);
        svg.appendChild(g);
      }
      var nx = 8 + k.lo * cw + 3, nw = (k.hi - k.lo + 1) * cw - 6;
      var node = s('g', { class: 'l23-node is-' + k.state, transform: 'translate(' + (nx + nw / 2) + ' 56)' });
      node.appendChild(s('rect', { class: 'l23-box', x: -nw / 2, y: -13, width: nw, height: 26, rx: 8 }));
      var lb = s('text', { class: 'l23-nval is-mid', y: 5, 'text-anchor': 'middle' }); lb.textContent = '[' + k.lo + ',' + k.hi + ']'; node.appendChild(lb);
      svg.appendChild(node);
      var stage = h('div', { class: 'mini__stage l23-kind-stage' }, svg);
      host.appendChild(h('figure', { class: 'mini' }, h('p', { class: 'l23-mini-title', 'data-state': k.state }, k.title), stage, h('figcaption', null, k.text)));
    });
  };

  /* ================================================================== build / query / update players */
  function segPlayerFigure(sel, o) {
    var fig = V.$(sel), stage = fig.querySelector('[data-stage]');
    var view = L.segView(stage, { label: o.label });
    var cur = o.variants ? o.variants[0] : null;
    var steps = o.steps(cur);
    view.setup(steps[0].n);
    var player = V.player({
      root: fig, steps: steps,
      render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: o.counterLabels, counterStates: o.counterStates,
      baseStepMs: o.stepMs || 1150, label: o.controlsLabel
    });
    if (o.variants && o.variants.length > 1) {
      V.segmented(fig.querySelector('[data-seg]'), {
        label: o.segLabel, value: o.variants[0].id,
        options: o.variants.map(function (v) { return { value: v.id, label: v.label }; }),
        onChange: function (id) {
          cur = o.variants.filter(function (v) { return v.id === id; })[0];
          player.setSteps(o.steps(cur));
        }
      });
    }
    V.legend(fig.querySelector('[data-legend]'), o.legend);
    return player;
  }

  L.buildFigure = function () {
    segPlayerFigure('#fig-build', {
      label: 'Segment tree being built over eight numbers',
      steps: function () { return A().segBuild('sum', A8); },
      legend: LEG.build, counterLabels: { written: 'Nodes filled in' }, counterStates: { written: 'swap' }, controlsLabel: 'Build figure controls', stepMs: 950
    });
  };
  L.queryFigure = function () {
    segPlayerFigure('#fig-query', {
      label: 'A range-sum query walking down a segment tree',
      variants: [
        { id: '1-6', label: 'a[1..6]', l: 1, r: 6 }, { id: '2-5', label: 'a[2..5]', l: 2, r: 5 },
        { id: '0-7', label: 'Whole array', l: 0, r: 7 }, { id: '3-3', label: 'One cell, a[3]', l: 3, r: 3 }
      ],
      steps: function (v) { return A().segQuery('sum', A8, v.l, v.r); },
      segLabel: 'Range to query',
      legend: LEG.query, counterLabels: { visited: 'Nodes visited', used: 'Stored sums used' }, counterStates: { visited: 'compare', used: 'done' }, controlsLabel: 'Query figure controls'
    });
  };
  L.updateFigure = function () {
    segPlayerFigure('#fig-update', {
      label: 'A point update rewriting the path to the root',
      variants: [
        { id: '5', label: 'a[5] = 9', i: 5, v: 9 }, { id: '0', label: 'a[0] = 9', i: 0, v: 9 }, { id: '7', label: 'a[7] = 1', i: 7, v: 1 }
      ],
      steps: function (v) { return A().segUpdate('sum', A8, v.i, v.v); },
      segLabel: 'Update to make',
      legend: LEG.update, counterLabels: { visited: 'Nodes on the path', written: 'Nodes rewritten' }, counterStates: { visited: 'path', written: 'swap' }, controlsLabel: 'Update figure controls'
    });
  };

  /* ================================================================== the lowbit explorer */
  L.lowbitExplorer = function () {
    var fig = V.$('#fig-lowbit');
    var bits = L.bitCalc(fig.querySelector('[data-stage]'), { bits: 8, rows: ['i', 'not', 'neg', 'low'], label: 'i, its complement, minus i and i AND minus i in binary' });
    var caption = fig.querySelector('[data-caption]');
    var value = 12, slider, field;
    function show(i, quiet) {
      value = i;
      var low = i & -i, pos = Math.round(Math.log2(low)), bin = i.toString(2);
      bits.set(i, { duration: quiet ? 0 : 340 });
      caption.innerHTML = '<b>' + i + '</b> is <code>' + bin + '</code> in binary. Its lowest set bit is at position ' + pos + ', worth <b>' + low + '</b>. In a Fenwick tree that gives block <b>T[' + i + ']</b> covering ' + low + ' cell' + (low > 1 ? 's' : '') + ': <b>a[' + (i - low + 1) + (low > 1 ? '..' + i : '') + ']</b>. A query moves on to ' + (i - low) + ', an update to ' + (i + low) + '.';
      if (slider && slider.value !== i) slider.set(i);
      if (field && +field.value !== i) field.value = i;
    }
    slider = V.slider(fig.querySelector('[data-slider]'), { label: 'Index i', min: 1, max: 127, step: 1, value: value, onInput: function (v) { show(v); } });
    var host = fig.querySelector('[data-input]');
    field = h('input', { class: 'field l23-num', type: 'number', min: 1, max: 127, value: value, 'aria-label': 'Type an index between 1 and 127' });
    var err = h('span', { class: 'l23-err', role: 'alert' });
    function apply() {
      var v = Number(field.value);
      if (!field.value || !Number.isInteger(v) || v < 1 || v > 127) { err.textContent = 'Type a whole number from 1 to 127.'; return; }
      err.textContent = ''; show(v);
    }
    field.addEventListener('change', apply);
    field.addEventListener('keydown', function (e) { if (e.key === 'Enter') apply(); });
    host.appendChild(h('span', { class: 'l23-fld__row' }, field, h('button', { type: 'button', class: 'btn btn--sm', onclick: apply }, 'Show'), h('span', { class: 'field-label' }, 'or try'),
      [6, 8, 12, 13, 96].map(function (p) { return h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: function () { show(p); } }, String(p)); }), err));
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', label: 'Lowest set bit' }, { state: 'default', shape: 'square', color: 'var(--ink-2)', label: 'Bit is 1' }, { state: 'muted', shape: 'outline', label: 'Bit is 0' }]);
    show(value, true);
  };

  /* ================================================================== the responsibility figure (click an index) */
  var FEN16 = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
  L.FEN16 = FEN16;
  L.responsibility = function () {
    var fig = V.$('#fig-resp'), stage = fig.querySelector('[data-stage]');
    var view = L.fenView(stage, { clickable: true, label: 'Fenwick tree over sixteen cells; click an index' });
    var caption = fig.querySelector('[data-caption]');
    var mode = 'prefix', idx = 13;
    function draw(dur) {
      var last, txt;
      if (mode === 'prefix') {
        last = finalOf(A().fenPrefix(FEN16, idx));
        var seq = last.jumps.map(function (j) { return j.from; });
        last = Object.assign({}, last, { cursor: idx });
        txt = '<b>prefix(' + idx + ')</b> adds ' + (seq.length ? seq.map(function (k) { var low = k & -k; return 'T[' + k + '] (' + (low === 1 ? 'a[' + k + ']' : 'a[' + (k - low + 1) + '..' + k + ']') + ')'; }).join(', ') : 'nothing') + '. ' + idx + ' = ' + idx.toString(2) + '<sub>2</sub> has ' + seq.length + ' set bit' + (seq.length === 1 ? '' : 's') + ', so ' + seq.length + ' block' + (seq.length === 1 ? '' : 's') + '. The sum is <b>' + last.answer + '</b>.';
      } else {
        last = finalOf(A().fenUpdate(FEN16, idx, 0));
        var chain = last.jumps.map(function (j) { return j.from; });
        last = Object.assign({}, last, { cursor: idx });
        txt = '<b>update(' + idx + ')</b> must change every block that contains cell ' + idx + ': ' + chain.map(function (k) { return 'T[' + k + ']'; }).join(', ') + ' (' + chain.length + ' block' + (chain.length === 1 ? '' : 's') + '). Each jump adds the lowest set bit: ' + chain.map(function (k) { return k; }).join(' → ') + '.';
      }
      view.render(last, { duration: dur });
      caption.innerHTML = txt;
    }
    view.on('click', function (e) { idx = e.index; draw(420); });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Show the chain for', value: mode,
      options: [{ value: 'prefix', label: 'Prefix query' }, { value: 'update', label: 'Update' }],
      onChange: function (m) { mode = m; view.reset(); draw(0); }
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'done', label: 'Block a prefix query adds' }, { state: 'swap', label: 'Block an update rewrites' }, { state: 'pivot', label: 'Lowest set bit of the index' }, { state: 'active', shape: 'ring', label: 'Chosen index' }]);
    view.setup(16);
    draw(0);
  };

  /* ================================================================== variations (static minis) */
  L.variationMinis = function () {
    var made = {};
    var GCDS = [12, 18, 8, 30, 9, 6, 15, 21];
    var MINS = [5, 3, 8, 1, 6, 2, 7, 4];
    function seg(host, op, arr, l, r) {
      var view = L.segView(host, { compact: true, cellMax: 44, cellMin: 30, label: 'Range ' + op + ' tree' });
      var tr = l === undefined ? A().segBuild(op, arr) : A().segQuery(op, arr, l, r);
      var last = finalOf(tr);
      view.setup(arr.length);
      view.render(Object.assign({}, last, { move: null, cur: null, ret: {} }), { duration: 0 });
    }
    function fen(host, arr, snap) {
      var view = L.fenView(host, { cellMin: 34, cellMax: 44, label: 'Fenwick tree variant' });
      view.setup(arr.length);
      view.render(snap, { duration: 0 });
    }
    var makers = {
      min: function (host) { seg(host, 'min', MINS, 2, 6); },
      gcd: function (host) { seg(host, 'gcd', GCDS, 1, 4); },
      diff: function (host) {
        var d = [0, 0, 3, 0, 0, 0, -3, 0];
        var last = finalOf(A().fenPrefix(d, 5));
        fen(host, d, Object.assign({}, last, { cursor: 5 }));
      },
      count: function (host) {
        var counts = [0, 2, 0, 0, 1, 0, 1, 0];
        var last = finalOf(A().fenPrefix(counts, 4));
        fen(host, counts, Object.assign({}, last, { cursor: 4 }));
      }
    };
    var blocks = {
      min: 'const IDENTITY = Infinity;             // nothing never wins\nconst combine = (a, b) => Math.min(a, b);\n// build, query and update are unchanged:\n// tree[node] = combine(tree[2*node], tree[2*node+1]);',
      gcd: 'const IDENTITY = 0;                    // gcd(0, x) = x\nconst combine = (a, b) => gcd(a, b);\nconst gcd = (a, b) => (b ? gcd(b, a % b) : a);',
      diff: '// d[i] = a[i] - a[i-1], stored in a Fenwick tree\nfunction rangeAdd(l, r, v) {\n  update(l, +v);\n  if (r + 1 <= n) update(r + 1, -v);\n}\nfunction pointValue(i) { return prefix(i); }   // a[i]',
      count: '// how many earlier elements are smaller? (values 1..m)\nlet inversions = 0;\nfor (const x of a) {\n  inversions += seen - prefix(x);   // earlier values > x\n  update(x, 1);\n  seen++;\n}'
    };
    Object.keys(blocks).forEach(function (k) { V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js'); });
    function ensure(name) {
      if (made[name]) return;
      made[name] = true;
      var host = V.$('[data-mini="' + name + '"]');
      try { makers[name](host); } catch (e) { console.error(e); }
    }
    var tabs = V.tabs('#variants', { onChange: function (name) { requestAnimationFrame(function () { ensure(name); }); } });
    ensure('min');
  };

  /* ================================================================== click-the-answer figure */
  L.clickFigure = function () {
    var fig = V.$('#fig-click'), stage = fig.querySelector('[data-stage]');
    var view = L.segView(stage, { label: 'Segment tree over eight cells; the range 2 to 7 is marked' });
    var shp = A().shape(8);
    view.setup(8);
    view.render({ type: 'seg', op: 'sum', n: 8, arr: A8.slice(), vals: A().treeValues('sum', A8, shp), states: {}, ret: {}, tags: {}, stale: {}, cells: {}, query: { l: 2, r: 7 }, cur: null, move: null }, { duration: 0 });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'outline', label: 'Marked query range' }]);
    V.clickQuiz(stage, {
      el: '#quiz-click', id: 'l23-click-cover',
      question: 'The query is a[2..7]. Click the <b>largest</b> node whose whole segment fits inside the range.',
      check: function (id) {
        if (id === 's4_7') return true;
        if (id.charAt(0) === 'c') return { correct: false, message: 'That is a single array cell. A node that covers more cells is available, and bigger blocks mean fewer steps.' };
        var nd = shp.byId[id], inside = nd.lo >= 2 && nd.hi <= 7;
        if (id === 's0_7') return { correct: false, message: 'The root covers cells 0 to 7, but cells 0 and 1 are not in the query. It overlaps only in part, so its sum would be wrong.' };
        if (id === 's0_3') return { correct: false, message: '[0,3] includes cells 0 and 1, which are outside the range. It is only partly inside, so the query has to split it.' };
        if (inside) return { correct: false, message: '[' + nd.lo + ',' + nd.hi + '] fits inside, but it is not the largest: its parent [4,7] is fully inside too. Look higher.' };
        return { correct: false, message: '[' + nd.lo + ',' + nd.hi + '] reaches outside the range. Only nodes whose whole segment lies in [2, 7] can be taken whole.' };
      },
      right: 'The range 2..7 splits into [2,3] and [4,7]. Node [4,7] is the largest block that fits: one stored sum replaces four cells. [2,3] is the other block, and it is smaller because cell 1 is missing from the range.'
    });
  };

  /* ================================================================== summary tiles */
  function miniTree(states, o) {
    o = o || {};
    var W = 150, H = 92, pos = { r: [75, 14], a: [38, 44], b: [112, 44], c: [19, 74], d: [57, 74], e: [93, 74], f: [131, 74] };
    var edges = [['r', 'a'], ['r', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'e'], ['b', 'f']];
    var svg = s('svg', { class: 'vz l23-svg l23-tile', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
    edges.forEach(function (e) {
      var st = states[e[1]] || 'default';
      svg.appendChild(s('line', { class: 'l23-edge is-' + st, x1: pos[e[0]][0], y1: pos[e[0]][1] + 8, x2: pos[e[1]][0], y2: pos[e[1]][1] - 8 }));
    });
    Object.keys(pos).forEach(function (k) {
      var st = states[k] || 'default', stale = o.stale && o.stale.indexOf(k) >= 0;
      var g = s('g', { class: 'l23-node is-' + st + (stale ? ' is-stale' : ''), transform: 'translate(' + pos[k][0] + ' ' + pos[k][1] + ')' });
      g.appendChild(s('rect', { class: 'l23-box', x: -15, y: -9, width: 30, height: 18, rx: 6 }));
      svg.appendChild(g);
      if (o.tag && o.tag === k) {
        var tg = s('g', { class: 'l23-tag', transform: 'translate(' + (pos[k][0] - 12) + ' ' + (pos[k][1] - 10) + ')' });
        tg.appendChild(s('rect', { x: -12, y: -7, width: 24, height: 14, rx: 7 }));
        var tt = s('text', { 'text-anchor': 'middle', y: 0.5 }); tt.textContent = '+3'; tg.appendChild(tt);
        svg.appendChild(tg);
      }
    });
    return svg;
  }
  function miniBars() {
    var W = 150, H = 92, svg = s('svg', { class: 'vz l23-svg l23-tile', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
    var cw = 16, x0 = 11, levels = { 1: 3, 2: 2, 3: 3, 4: 1, 5: 3, 6: 2, 7: 3, 8: 0 };
    for (var i = 1; i <= 8; i++) {
      var low = i & -i, lvl = Math.round(Math.log2(low));
      var st = i === 6 ? 'done' : i === 4 ? 'done' : 'default';
      var g = s('g', { class: 'l23-bar is-' + st });
      g.appendChild(s('rect', { class: 'l23-bbox', x: x0 + (i - low) * cw + 1, y: 6 + (3 - lvl) * 17, width: low * cw - 2, height: 14, rx: 5 }));
      svg.appendChild(g);
      var t = s('text', { class: 'l23-fidx', x: x0 + (i - 0.5) * cw, y: 76, 'text-anchor': 'middle', style: 'font-size:9px' }); t.textContent = i; svg.appendChild(t);
    }
    return svg;
  }
  function miniBits() {
    var W = 150, H = 92, svg = s('svg', { class: 'vz l23-svg l23-tile', width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
    var data = [['1','1','0','0'], ['0','1','0','0'], ['0','1','0','0']];
    var labs = ['i = 12', '−i', 'i & −i'];
    data.forEach(function (row, r) {
      var y = 12 + r * 26;
      var lt = s('text', { class: 'l23-rowlbl', x: 2, y: y + 12 }); lt.textContent = labs[r]; svg.appendChild(lt);
      row.forEach(function (b, k) {
        var g = s('g', { class: 'l23-bitc' + (b === '1' ? ' is-one' : '') + (k === 1 ? ' is-low' : '') });
        g.appendChild(s('rect', { x: 52 + k * 24, y: y, width: 21, height: 18, rx: 5 }));
        var tt = s('text', { x: 52 + k * 24 + 10.5, y: y + 13, 'text-anchor': 'middle' }); tt.textContent = b; g.appendChild(tt);
        svg.appendChild(g);
      });
    });
    return svg;
  }
  L.summaryCard = function () {
    var grid = V.$('#summary-card .summary__grid');
    var tiles = [
      { svg: miniTree({}), label: 'Segment tree', text: 'A node per segment [lo, hi]. Root = whole array, leaves = cells. About 2n nodes, log₂ n levels.' },
      { svg: miniTree({ r: 'compare', a: 'compare', b: 'compare', c: 'muted', d: 'done', e: 'done', f: 'muted' }), label: 'Query', text: 'Inside: take the stored value. Outside: identity. Partial: split. At most 4 nodes per level.' },
      { svg: miniTree({ r: 'swap', b: 'swap', e: 'swap', a: 'default' }), label: 'Point update', text: 'Rewrite the leaf, then recompute every ancestor from its children: one path, log₂ n + 1 nodes.' },
      { svg: miniTree({ r: 'compare', a: 'swap', b: 'compare' }, { tag: 'a', stale: ['c', 'd'] }), label: 'Lazy tag', text: 'Range add: leave “+v” on the covered nodes, mark below as stale, push down only when a walk goes through.' },
      { svg: miniBars(), label: 'Fenwick tree', text: 'T[i] sums the lowbit(i) cells ending at i. One array of n numbers, no recursion.' },
      { svg: miniBits(), label: 'i & −i', text: 'Query: i −= i & −i. Update: i += i & −i. One block per set bit, at most log₂ n + 1 blocks.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, t.svg), h('p', { class: 'summary__label' }, t.label), h('p', { class: 'summary__text' }, t.text)));
    });
  };
}());
