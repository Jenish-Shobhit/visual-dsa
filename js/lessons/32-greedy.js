/* Lesson 32 · Greedy algorithms — figure wiring.
   Generators: js/algos/32-greedy.js (VDSA.algos.greedy, tested in Node).  Views: 32-greedy-views.js.  Labs: 32-greedy-labs.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var G = V.algos.greedy, gr = V.gr32;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function lazy(el, fn) {
    var done = false, io;
    function run() { if (done) return; done = true; try { fn(); } catch (e) { console.error(e); } if (io) io.disconnect(); }
    if (!('IntersectionObserver' in window)) { run(); return; }
    io = new IntersectionObserver(function (en) { if (en.some(function (e) { return e.isIntersecting; })) run(); }, { rootMargin: '900px 0px 900px 0px' });
    io.observe(el);
  }
  function ivs(text) { return G.parseIntervals(text).intervals; }
  function svgEl(w, hh, label, cls) { return s('svg', { class: 'gr-mini ' + (cls || ''), viewBox: '0 0 ' + w + ' ' + hh, width: w, height: hh, role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true', style: 'max-width:100%;height:auto' }); }

  /* Common conversion: a trace step's tl block -> timeline view state. */
  function tlState(model, tlb, opts) {
    opts = opts || {};
    var rowOf = {}; tlb.order.forEach(function (id, i) { rowOf[id] = i; });
    return {
      rows: model.length,
      items: model.map(function (iv) { return { id: iv.id, s: iv.s, e: iv.e, row: rowOf[iv.id], state: tlb.states[iv.id], label: iv.id, sub: iv.s + '\u2013' + iv.e, aria: 'Request ' + iv.id + ' from ' + iv.s + ' to ' + iv.e }; }),
      rowLabels: opts.noLabels ? [] : tlb.order.map(function (id, i) { return { id: id, row: i, text: id, sub: tlb.keys ? tlb.keys[id] : '' }; }),
      busy: tlb.busy, clash: tlb.clash, ghosts: tlb.ghosts
    };
  }

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var stage = $('#teaser');
    if (!stage) return;
    var model = ivs('1-6, 0-3, 4-9, 2-5, 8-13, 10-15, 6-11, 12-18');
    var view = gr.timeline(stage, { rows: model.length, rowH: 27, barH: 20, gutter: 10, label: 'Teaser' });
    view.el.setAttribute('aria-hidden', 'true');
    var steps = G.intervalTrace(model, 'finish').filter(function (st) { return st.kind !== 'look'; });
    view.prepare(steps.map(function (st) { return tlState(model, st.tl, { noLabels: true }); }));
    V.teaser(stage, { steps: steps, render: function (st, ctx) { view.render(tlState(model, st.tl, { noLabels: true }), { duration: ctx.duration }); }, stepMs: 1000, holdMs: 2600 });
  }

  /* ================================================================== the problem: play it yourself */
  function playFigure() {
    var fig = $('#fig-play');
    V.legend($('[data-legend]', fig), [{ state: 'done', label: 'In your room' }, { state: 'error', label: 'Overlaps' }, { state: 'muted', label: 'Blocked by your picks' }, { state: 'default', label: 'Free' }]);
    var model = ivs('0-5, 2-8, 4-7, 6-11, 9-14, 12-16, 10-13, 15-21'), chosen = [], seed = 3, flash = null, timer = 0, msg = $('[data-msg]', fig);
    var view = gr.timeline($('[data-stage]', fig), { rows: 8, clickable: true, label: 'Requests to pick from', gutter: 30 });
    function state() {
      var blocked = {};
      model.forEach(function (iv) { if (chosen.indexOf(iv.id) < 0 && model.some(function (o) { return chosen.indexOf(o.id) >= 0 && G.overlaps(iv, o); })) blocked[iv.id] = true; });
      return {
        rows: model.length,
        items: model.map(function (iv, i) { return { id: iv.id, s: iv.s, e: iv.e, row: i, label: iv.id, sub: iv.s + '\u2013' + iv.e, state: flash === iv.id ? 'error' : chosen.indexOf(iv.id) >= 0 ? 'done' : blocked[iv.id] ? 'muted' : 'default', aria: 'Request ' + iv.id + ' from ' + iv.s + ' to ' + iv.e + (chosen.indexOf(iv.id) >= 0 ? ', in your room' : blocked[iv.id] ? ', blocked' : '') }; }),
        rowLabels: model.map(function (iv, i) { return { id: iv.id, row: i, text: iv.id }; }),
        busy: chosen.map(function (id) { var iv = model.filter(function (x) { return x.id === id; })[0]; return { s: iv.s, e: iv.e }; })
      };
    }
    function status() {
      var best = G.optimalPick(model).length, free = model.filter(function (iv) { return chosen.indexOf(iv.id) < 0 && !model.some(function (o) { return chosen.indexOf(o.id) >= 0 && G.overlaps(iv, o); }); }).length;
      var t = 'You have <b>' + chosen.length + '</b> in the room. The best possible is <b>' + best + '</b>.';
      if (!free && chosen.length) t += chosen.length === best ? ' You matched the best possible.' : ' Nothing else fits, yet ' + (best - chosen.length) + ' more were possible: your picks blocked them. Clear and try another rule.';
      msg.className = 'gr-play__msg' + (!free && chosen.length ? (chosen.length === best ? ' is-good' : ' is-bad') : '');
      msg.innerHTML = chosen.length ? t : 'Click a request to add it to the room. The best possible for this set is <b>' + best + '</b>.';
    }
    function draw(dur) { view.render(state(), { duration: dur === undefined ? 350 : dur }); status(); }
    view.on('click', function (e) {
      var id = e.id.replace(/^i:/, ''), iv = model.filter(function (x) { return x.id === id; })[0], pos = chosen.indexOf(id);
      if (pos >= 0) chosen.splice(pos, 1);
      else {
        var clash = chosen.filter(function (c) { return G.overlaps(iv, model.filter(function (x) { return x.id === c; })[0]); });
        if (clash.length) {
          flash = id; clearTimeout(timer); draw();
          msg.className = 'gr-play__msg is-bad'; msg.innerHTML = '<b>' + id + '</b> overlaps <b>' + clash.join(', ') + '</b> in your room, so it cannot join.';
          timer = setTimeout(function () { flash = null; draw(); msg.className = 'gr-play__msg is-bad'; msg.innerHTML = '<b>' + id + '</b> overlaps <b>' + clash.join(', ') + '</b> in your room, so it cannot join.'; }, 700);
          return;
        }
        chosen.push(id);
      }
      draw();
    });
    $('[data-clear]', fig).addEventListener('click', function () { chosen = []; flash = null; draw(); });
    $('[data-new]', fig).addEventListener('click', function () { seed++; var rng = V.rng(seed * 17 + 3); model = G.randomIntervals(8, rng); chosen = []; flash = null; view.reset(); draw(0); });
    draw(0);
  }

  /* ================================================================== intuition: greedy hiker */
  function hillFigure() {
    var fig = $('#fig-hill');
    V.legend($('[data-legend]', fig), [{ state: 'active', label: 'Hiker' }, { state: 'compare', shape: 'ring', label: 'Neighbours it can see' }, { state: 'path', shape: 'line', label: 'Path so far' }]);
    var view = gr.terrain($('[data-stage]', fig), { label: 'Hill landscape' });
    var kind = 'two', start = 2;
    var player = V.player({
      root: fig, steps: [], baseStepMs: 800, label: 'Hiker controls',
      render: function (st, ctx) { view.render(st, { duration: ctx.duration }); },
      caption: $('[data-caption]', fig), counters: $('[data-counters]', fig), counterLabels: { steps: 'Steps taken', height: 'Height now' }
    });
    function load() { var steps = G.hillTrace(G.TERRAINS[kind], start); view.reset(); player.setSteps(steps); }
    V.segmented($('[data-terrain]', fig), { label: 'Landscape', value: kind, options: [{ value: 'one', label: 'One hill' }, { value: 'two', label: 'Two hills' }], onChange: function (v) { kind = v; start = 2; load(); } });
    view.on('start', function (e) { start = e.index; load(); });
    load();
  }

  /* ================================================================== first-pick click quiz */
  function firstFigure() {
    var fig = $('#fig-first');
    var model = ivs('0-11, 3-7, 6-10, 9-13, 12-16, 2-8');
    var view = gr.timeline($('[data-stage]', fig), { rows: model.length, label: 'Six requests A to F', gutter: 30 });
    view.render({ rows: model.length, items: model.map(function (iv, i) { return { id: iv.id, s: iv.s, e: iv.e, row: i, label: iv.id, sub: iv.s + '\u2013' + iv.e, aria: 'Request ' + iv.id + ' from ' + iv.s + ' to ' + iv.e }; }), rowLabels: model.map(function (iv, i) { return { id: iv.id, row: i, text: iv.id }; }) }, { duration: 0 });
    V.clickQuiz($('[data-stage]', fig), { el: '#quiz-first', id: 'click-first-pick', question: 'Click the request that <b>earliest finish</b> keeps first.', answer: 'i:B',
      right: 'B ends at 7, the earliest end of all six. Earliest start would have taken A (start 0), which ends at 11 and blocks almost everything.',
      wrong: 'Look at where each bar <em>ends</em>, not where it starts or how long it is. The earliest end wins.' });
  }

  /* ================================================================== exchange argument */
  function exchangeFigure() {
    var fig = $('#fig-exchange');
    V.legend($('[data-legend]', fig), [{ state: 'done', label: 'Agrees with greedy' }, { state: 'active', label: 'Greedy\u2019s pick' }, { state: 'compare', label: 'Optimum\u2019s pick' }, { state: 'muted', label: 'Set aside' }]);
    var model = ivs('0-5, 1-4, 3-9, 5-10, 8-14, 11-15, 9-13, 14-20');
    var view = gr.timeline($('[data-stage]', fig), { rows: 3, label: 'Greedy and optimal schedules', gutter: 82 });
    function toView(st) {
      var ex = st.ex, by = {}; model.forEach(function (iv) { by[iv.id] = iv; });
      var items = [];
      ex.g.forEach(function (id, i) { var iv = by[id]; items.push({ id: 'G:' + id, s: iv.s, e: iv.e, row: 0, label: id, sub: iv.s + '\u2013' + iv.e, state: i < ex.agreeUpTo ? 'done' : (i === ex.focus && st.kind !== 'end') ? 'active' : 'default', aria: 'Greedy picks ' + id }); });
      ex.o.forEach(function (id, i) {
        var iv = by[id], fresh = (st.kind === 'swap' || st.kind === 'check') && i === ex.focus;
        items.push({ id: 'O:' + id, s: iv.s, e: iv.e, row: 1, label: id, sub: iv.s + '\u2013' + iv.e, from: fresh ? 'G:' + id : null,
          state: fresh && st.kind === 'swap' ? 'active' : i < ex.agreeUpTo ? 'done' : (i === ex.focus && st.kind === 'compare') ? 'compare' : 'default', aria: 'Optimal schedule includes ' + id });
      });
      ex.bench.forEach(function (id) { var iv = by[id]; items.push({ id: 'O:' + id, s: iv.s, e: iv.e, row: 2, label: id, sub: iv.s + '\u2013' + iv.e, state: 'muted', aria: 'Set aside ' + id }); });
      return { rows: 3, items: items, rowLabels: [{ id: 'g', row: 0, text: 'Greedy' }, { id: 'o', row: 1, text: 'Optimal' }, { id: 'b', row: 2, text: 'Set aside', small: true }] };
    }
    var steps = G.exchangeTrace(model, ['C', 'G', 'H']);
    view.prepare(steps.map(toView));
    V.player({ root: fig, steps: steps, baseStepMs: 1800, animMs: 1100, label: 'Exchange argument controls',
      render: function (st, ctx) { view.render(toView(st), { duration: ctx.duration }); },
      caption: $('[data-caption]', fig), counters: $('[data-counters]', fig), counterLabels: { size: 'Requests in optimum', agree: 'Picks agreeing with greedy', swaps: 'Swaps made' }, counterStates: { agree: 'done' } });
  }

  /* ================================================================== coins */
  function coinsFigure() {
    var fig = $('#fig-coins');
    V.legend($('[data-legend]', fig), [{ state: 'active', label: 'Greedy coin' }, { state: 'done', label: 'Coin in the best answer' }, { state: 'error', label: 'Greedy stack (worse than best)' }, { state: 'compare', shape: 'line', label: 'Left to pay' }]);
    var view = gr.coins($('[data-stage]', fig), { label: 'Greedy and best coin stacks' });
    var coins = [1, 3, 4], amount = 6;
    var player = V.player({ root: fig, steps: [], baseStepMs: 1200, label: 'Coin change controls',
      render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, caption: $('[data-caption]', fig) });
    var failEl = $('[data-fail]', fig), slider, input, seg;
    function load() {
      var steps = G.coinTrace(coins, amount);
      view.reset(); view.prepare(steps); player.setSteps(steps);
      var f = G.firstCoinFailure(coins);
      failEl.innerHTML = f.amount === null
        ? 'For coins ' + coins.join(', ') + ', greedy is optimal for <b>every</b> amount: a failure would have to appear below ' + f.bound + ' (the sum of the two largest coins), and none does.'
        : 'For coins ' + coins.join(', ') + ', greedy first fails at <b>' + f.amount + '</b>: it pays ' + f.greedy.join(' + ') + ' (' + f.greedy.length + ' coins) but ' + f.best.join(' + ') + ' (' + f.best.length + ') is better.';
    }
    var PRE = { us: { coins: '1, 5, 10, 25', amount: 30 }, odd: { coins: '1, 3, 4', amount: 6 }, five: { coins: '1, 5, 12', amount: 15 } };
    input = V.inputRow($('[data-input]', fig), {
      label: 'Coin values (must include 1)', value: PRE.odd.coins, placeholder: 'e.g. 1, 3, 4', hint: 'Between 2 and 6 different values from 1 to 60.',
      parse: function (t) { var r = G.parseCoins(t); return { values: r.coins, error: r.error }; },
      onApply: function (c) { coins = c; seg && seg.set && seg.set('custom'); load(); }
    });
    slider = V.slider($('[data-amount]', fig), { label: 'Amount to pay', min: 1, max: 60, value: amount, format: function (v) { return String(v); }, onChange: function (v) { amount = v; seg && seg.set && seg.set('custom'); load(); } });
    seg = V.segmented($('.fig__toolbar', fig).insertBefore(h('div', { 'data-preset': '' }), $('[data-input]', fig)), { label: 'Preset', value: 'odd',
      options: [{ value: 'us', label: 'US coins \u2192 30' }, { value: 'odd', label: '{1, 3, 4} \u2192 6' }, { value: 'five', label: '{1, 5, 12} \u2192 15' }, { value: 'custom', label: 'Custom' }],
      onChange: function (v) { if (v === 'custom') return; var p = PRE[v]; coins = G.parseCoins(p.coins).coins; amount = p.amount; input.set(p.coins, false); slider.set(p.amount); load(); } });
    load();
  }

  /* ================================================================== knapsack */
  function knapFigure() {
    var fig = $('#fig-knap');
    V.legend($('[data-legend]', fig), [{ state: 'done', label: 'Whole item taken' }, { state: 'compare', label: 'Poured in part' }, { state: 'muted', label: 'Skipped' }, { state: 'key', label: 'Best whole-item choice' }, { state: 'error', label: 'Does not fit' }]);
    var view = gr.knap($('[data-stage]', fig), { label: 'Three knapsacks' });
    var items = G.parseItems('10:60, 20:100, 30:120').items, cap = 50, capSlider, input, seg;
    var player = V.player({ root: fig, steps: [], baseStepMs: 1500, animMs: 1000, label: 'Knapsack controls',
      render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, caption: $('[data-caption]', fig), counters: $('[data-counters]', fig),
      counterLabels: { fractional: 'Pouring value', greedy01: 'Whole-item greedy', best01: 'Best whole items' }, counterStates: { fractional: 'compare', greedy01: 'done', best01: 'key' } });
    function load() { var steps = G.knapTrace(items, cap); view.reset(); player.setSteps(steps); }
    var PRE = { classic: { items: '10:60, 20:100, 30:120', cap: 50 }, lucky: { items: '10:60, 20:100, 30:120', cap: 30 }, awkward: { items: '6:30, 5:24, 5:24', cap: 10 } };
    input = V.inputRow($('[data-input]', fig), { label: 'Items (weight:value)', value: PRE.classic.items, placeholder: 'e.g. 10:60, 20:100', hint: '2 to 5 items; weights 1 to 60, values 1 to 300.',
      parse: function (t) { var r = G.parseItems(t); return { values: r.items, error: r.error }; },
      onApply: function (it) { items = it; seg.set('custom'); load(); } });
    capSlider = V.slider($('[data-cap]', fig), { label: 'Bag capacity (kg)', min: 5, max: 100, value: cap, onChange: function (v) { cap = v; seg.set('custom'); load(); } });
    seg = V.segmented($('.fig__toolbar', fig).insertBefore(h('div', {}), $('[data-input]', fig)), { label: 'Preset', value: 'classic',
      options: [{ value: 'classic', label: 'Classic (50 kg)' }, { value: 'lucky', label: 'Lucky size (30 kg)' }, { value: 'awkward', label: 'Awkward sizes (10 kg)' }, { value: 'custom', label: 'Custom' }],
      onChange: function (v) { if (v === 'custom') return; var p = PRE[v]; items = G.parseItems(p.items).items; cap = p.cap; input.set(p.items, false); capSlider.set(p.cap); load(); } });
    load();
  }

  /* ================================================================== bits per character chart */
  var BIT_TEXTS = [['abracadabra', 'abracadabra'], ['mississippi', 'mississippi'], ['hello world', 'hello world'], ['aaaaaaaabc', 'aaaaaaaabc'],
    ['pangram', 'the quick brown fox jumps over the lazy dog'], ['to be or not', 'to be or not to be that is the question']];
  function bitsFigure() {
    var fig = $('#fig-bits');
    var chart = V.views.chart($('[data-stage]', fig), { type: 'bar', label: 'Bits per character for six texts under four schemes', height: 300 });
    var data = BIT_TEXTS.map(function (t) { return G.bitsPerChar(t[1]); });
    function r(x) { return Math.round(x * 100) / 100; }
    var state = {
      categories: BIT_TEXTS.map(function (t) { return t[0]; }),
      y: { label: 'bits per character', min: 0, max: 10 },
      series: [
        { id: 'ascii', label: 'Plain 8-bit', values: data.map(function () { return 8; }), state: 'muted' },
        { id: 'fixed', label: 'Fixed width', values: data.map(function (d) { return d.fixed; }), color: 1 },
        { id: 'huff', label: 'Huffman', values: data.map(function (d) { return r(d.huffman); }), state: 'done' },
        { id: 'ent', label: 'Entropy (floor)', values: data.map(function (d) { return r(d.entropy); }), state: 'pivot' }
      ]
    };
    lazy(fig, function () { chart.render(state, { duration: 900 }); });
  }

  /* ================================================================== flowchart: is greedy safe? */
  function flowFigure() {
    var fig = $('#fig-flow');
    var spec = {
      nodes: [
        { id: 'start', type: 'start', text: 'A problem', col: 0, row: 0 },
        { id: 'd1', type: 'decision', text: 'Locally best pick is part of some optimal answer?', col: 0, row: 1, maxWidth: 200, narrow: { maxWidth: 76 } },
        { id: 'd2', type: 'decision', text: 'What is left is the same problem, smaller?', col: 0, row: 2, maxWidth: 200, narrow: { maxWidth: 76 } },
        { id: 'd3', type: 'decision', text: 'Can you prove it? (exchange, staying ahead, matroid)', col: 0, row: 3, maxWidth: 200, narrow: { maxWidth: 76 } },
        { id: 'safe', type: 'end', text: 'Greedy is safe: sort by the rule, commit, never look back', col: 0, row: 4, maxWidth: 220, narrow: { maxWidth: 76, text: 'Greedy is safe: sort, commit' } },
        { id: 'fail', type: 'end', text: 'Greedy can fail: use dynamic programming or search', col: 1, row: 1.5, maxWidth: 190, narrow: { maxWidth: 66, text: 'Greedy can fail: try DP' } },
        { id: 'unproven', type: 'process', text: 'Unproven: hunt for a counterexample on tiny inputs', col: 1, row: 3, maxWidth: 190, narrow: { maxWidth: 66, text: 'Unproven: hunt for a counterexample' } }
      ],
      edges: [
        { from: 'start', to: 'd1' }, { from: 'd1', to: 'd2', label: 'yes' }, { from: 'd1', to: 'fail', label: 'no' },
        { from: 'd2', to: 'd3', label: 'yes' }, { from: 'd2', to: 'fail', label: 'no' },
        { from: 'd3', to: 'safe', label: 'yes' }, { from: 'd3', to: 'unproven', label: 'no' }
      ]
    };
    var flow = V.views.flowchart($('[data-stage]', fig), spec, { label: 'Is greedy safe here? decision path' });
    var PROBLEMS = [
      { label: 'Intervals: earliest finish', path: ['d1', 'd2', 'd3', 'safe'], text: 'The earliest-finishing request fits into some optimal schedule (exchange argument), and what remains is a smaller scheduling problem.' },
      { label: 'Intervals: earliest start', path: ['d1', 'fail'], text: 'The request that starts first can be huge and block everything, so it belongs to no optimal schedule on some inputs.' },
      { label: 'US coins 1, 5, 10, 25', path: ['d1', 'd2', 'd3', 'safe'], text: 'Each bigger coin is worth at least what smaller coins can build cheaply. The Kozen\u2013Zaks check confirms it.' },
      { label: 'Coins 1, 3, 4', path: ['d1', 'fail'], text: 'For amount 6 the biggest coin, 4, is in no optimal answer (3 + 3 is best).' },
      { label: 'Fractional knapsack', path: ['d1', 'd2', 'd3', 'safe'], text: 'Best value per kilogram first is optimal because you can always cut the last item.' },
      { label: '0/1 knapsack', path: ['d1', 'fail'], text: 'The best-ratio item can waste room that a different mix would use fully.' },
      { label: 'Huffman coding', path: ['d1', 'd2', 'd3', 'safe'], text: 'The two rarest symbols can be siblings at the deepest level of some optimal code; merge them and repeat.' },
      { label: 'Kruskal\u2019s spanning tree', path: ['d1', 'd2', 'd3', 'safe'], text: 'Cheapest edge that closes no cycle: forests form a matroid, so greedy by weight is optimal.' },
      { label: 'Shortest path, negative edges', path: ['d1', 'fail'], text: 'Dijkstra\u2019s greedy step assumes a finalised distance cannot improve; a negative edge later can improve it.' },
      { label: 'A rule you just invented', path: ['d1', 'd2', 'd3', 'unproven'], text: 'It looks plausible and the pieces fit, but until you find a proof or a counterexample you cannot trust it.' }
    ];
    var chips = $('[data-chips]', fig), verdict = $('[data-verdict]', fig), timers = [], btns = [];
    function edgeKey(a, b) { return a + '->' + b; }
    function show(i, animate) {
      timers.forEach(clearTimeout); timers = [];
      btns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      var p = PROBLEMS[i], nodes = ['start'].concat(p.path), edgeStates = {};
      function frame(k, dur) {
        edgeStates = {};
        for (var e = 0; e < k; e++) edgeStates[edgeKey(nodes[e], nodes[e + 1])] = 'path';
        flow.render({ active: nodes[k], visited: nodes.slice(0, k), edgeStates: JSON.parse(JSON.stringify(edgeStates)) }, { duration: dur });
        if (k === nodes.length - 1) {
          var ok = nodes[k] === 'safe';
          verdict.innerHTML = '<b class="' + (ok ? 'is-ok' : 'is-bad') + '">' + (ok ? 'Greedy is safe.' : nodes[k] === 'fail' ? 'Greedy fails.' : 'Not yet trustworthy.') + '</b> ' + p.text;
        } else verdict.innerHTML = 'Following the questions for <b>' + p.label + '</b>\u2026';
      }
      if (!animate || V.reducedMotion()) { frame(nodes.length - 1, 0); return; }
      frame(0, 0);
      for (var k = 1; k < nodes.length; k++) (function (kk) { timers.push(setTimeout(function () { frame(kk, 500); }, kk * 850)); }(k));
    }
    PROBLEMS.forEach(function (p, i) { var b = h('button', { type: 'button', class: 'btn btn--sm', 'aria-pressed': 'false', onclick: function () { show(i, true); } }, p.label); btns.push(b); chips.appendChild(b); });
    show(0, false);
  }

  /* ================================================================== growth chart */
  function growthFigure() {
    var fig = $('#fig-growth');
    var chart = V.views.chart($('[data-stage]', fig), { type: 'line', label: 'Subsets checked against greedy steps as n grows', height: 300 });
    var log = true;
    var series = [{ id: 'subsets', label: '2\u207f subsets', fn: function (n) { return Math.pow(2, n); }, state: 'error' }, { id: 'greedy', label: 'greedy: n log\u2082 n', fn: function (n) { return n * Math.log2(Math.max(2, n)); }, state: 'done' }];
    function draw(dur) {
      chart.render({ x: { label: 'requests n', min: 2, max: 30 }, y: log ? { label: 'steps (log scale)', scale: 'log', min: 1, max: 2e9 } : { label: 'steps', min: 0, max: 400 }, series: series,
        highlight: [{ series: 'subsets', x: 20, label: '2\u00b2\u2070 = 1,048,576' }, { series: 'greedy', x: 20, label: '\u2248 86' }] }, { duration: dur });
    }
    V.segmented($('[data-scale]', fig), { label: 'Scale', value: 'log', options: [{ value: 'log', label: 'Log scale' }, { value: 'lin', label: 'Linear scale' }], onChange: function (v) { log = v === 'log'; draw(900); } });
    lazy(fig, function () { draw(900); });
  }

  /* ================================================================== jobs with deadlines */
  function jobsFigure() {
    var fig = $('#fig-jobs');
    V.legend($('[data-legend]', fig), [{ state: 'active', label: 'Job being placed' }, { state: 'done', label: 'Scheduled' }, { state: 'muted', label: 'Dropped' }, { state: 'frontier', label: 'Waiting' }]);
    var view = V.views.array($('[data-stage]', fig), { mode: 'boxes', cellSize: 52, cellAspect: 1, label: 'Jobs and hour slots' });
    var jobs = G.parseJobs('2:100, 1:19, 2:27, 1:25, 3:15').jobs;
    function toView(st) {
      var by = {}; st.jobs.forEach(function (j) { by[j.id] = j; });
      var placed = {}; st.slots.forEach(function (id) { if (id) placed[id] = true; });
      function it(id) { var j = by[id]; var stt = st.states[id]; return { id: id, value: '$' + j.p, label: 'by ' + j.d, state: stt === 'default' ? 'frontier' : stt }; }
      return { rows: [
        { id: 'jobs', label: 'Jobs by profit', items: st.order.filter(function (id) { return !placed[id]; }).map(it), showIndices: false },
        { id: 'slots', label: 'Hours', items: st.slots.map(function (id) { return id ? it(id) : null; }), length: st.T, indexStart: 1, indexLabels: st.slots.map(function (_, i) { return 'hour ' + (i + 1); }) }
      ] };
    }
    var player = V.player({ root: fig, steps: [], baseStepMs: 1300, label: 'Job scheduling controls',
      render: function (st, ctx) { view.render(toView(st), { duration: ctx.duration }); }, caption: $('[data-caption]', fig), counters: $('[data-counters]', fig), counterLabels: { profit: 'Profit', placed: 'Jobs placed' }, counterStates: { profit: 'done' } });
    function load() { var steps = G.jobTrace(jobs); view.reset(); view.prepare(steps.map(toView)); player.setSteps(steps); }
    V.inputRow($('[data-input]', fig), { label: 'Jobs (deadline:profit)', value: '2:100, 1:19, 2:27, 1:25, 3:15', hint: '2 to 8 jobs; deadlines 1 to 6, profits 1 to 999.',
      parse: function (t) { var r = G.parseJobs(t); return { values: r.jobs, error: r.error }; },
      presets: [{ label: 'Classic', value: '2:100, 1:19, 2:27, 1:25, 3:15' }, { label: 'Crowded deadline', value: '1:50, 1:40, 1:30, 2:20' }],
      onApply: function (j) { jobs = j; load(); } });
    load();
  }

  /* ================================================================== variation minis */
  function minis() {
    var host = $('[data-mini="ahead"]');
    if (host) {
      var model = ivs('0-5, 1-4, 3-9, 5-10, 8-14, 11-15, 9-13, 14-20'), by = {}; model.forEach(function (iv) { by[iv.id] = iv; });
      var g = ['B', 'D', 'F'], o = ['C', 'G', 'H'], items = [];
      g.forEach(function (id, i) { items.push({ id: 'g' + i, s: by[id].s, e: by[id].e, row: 0, label: id, sub: 'ends ' + by[id].e, state: 'done' }); });
      o.forEach(function (id, i) { items.push({ id: 'o' + i, s: by[id].s, e: by[id].e, row: 1, label: id, sub: 'ends ' + by[id].e, state: 'default' }); });
      var view = gr.timeline(host, { rows: 2, gutter: 70, label: 'Greedy versus optimal finish times' });
      view.render({ rows: 2, items: items, rowLabels: [{ id: 'g', row: 0, text: 'Greedy' }, { id: 'o', row: 1, text: 'Optimal' }], busy: [] }, { duration: 0 });
    }
    var m = $('[data-mini="matroid"]');
    if (m) {
      var svg = svgEl(320, 170, 'A graph with a forest of three independent edges and one dashed edge that would close a cycle');
      var P = [[40, 130], [110, 40], [200, 60], [280, 130], [170, 140]];
      function edge(a, b, cls) { svg.appendChild(s('line', { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1], class: 'gr-sline', style: cls === 'bad' ? 'stroke:var(--st-error);stroke-dasharray:6 5' : 'stroke:var(--st-done);stroke-width:4' })); }
      edge(0, 1); edge(1, 2); edge(2, 3); edge(1, 4, 'bad'); edge(2, 4, 'bad');
      P.forEach(function (p, i) { svg.appendChild(s('circle', { cx: p[0], cy: p[1], r: 13, class: 'gr-scircle' })); svg.appendChild(s('text', { x: p[0], y: p[1] + 4, 'text-anchor': 'middle' }, String('ABCDE'[i]))); });
      svg.appendChild(s('text', { x: 10, y: 16, class: 'gr-note' }, 'Green: a forest (independent). Dashed red: edges that would close a cycle with B, C, E.'));
      m.appendChild(svg);
    }
    var k = $('[data-mini="mst"]');
    if (k) {
      var svg2 = svgEl(320, 170, 'Kruskal on a five-node graph: cheap edges kept, the edge that closes a cycle rejected');
      var Q = [[40, 120], [100, 40], [190, 40], [280, 120], [160, 130]];
      var E = [[0, 1, 2, 'keep'], [1, 2, 3, 'keep'], [2, 3, 4, 'keep'], [0, 4, 5, 'keep'], [1, 4, 6, 'skip'], [2, 4, 7, 'skip'], [3, 4, 8, 'skip']];
      E.forEach(function (e) {
        var a = Q[e[0]], b = Q[e[1]];
        svg2.appendChild(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'gr-sline', style: e[3] === 'keep' ? 'stroke:var(--st-done);stroke-width:4' : 'stroke:var(--st-muted);stroke-dasharray:5 5' }));
        svg2.appendChild(s('text', { x: (a[0] + b[0]) / 2 + 6, y: (a[1] + b[1]) / 2 - 4, class: 'gr-note-mono' }, String(e[2])));
      });
      Q.forEach(function (p, i) { svg2.appendChild(s('circle', { cx: p[0], cy: p[1], r: 12, class: 'gr-scircle' })); svg2.appendChild(s('text', { x: p[0], y: p[1] + 4, 'text-anchor': 'middle' }, String('ABCDE'[i]))); });
      k.appendChild(svg2);
    }
  }

  /* ================================================================== summary card */
  function summary() {
    var grid = $('#summary-card .summary__grid');
    if (!grid) return;
    function item(label, text, svgNode) {
      var viz = h('div', { class: 'summary__viz stage-grid' }); viz.appendChild(svgNode);
      grid.appendChild(h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text' }, text)));
    }
    function box(w, hh) { var e = s('svg', { class: 'gr-summary-svg', viewBox: '0 0 ' + w + ' ' + hh, 'aria-hidden': 'true' }); return e; }
    var a = box(200, 80);
    [30, 90, 150].forEach(function (x, i) { a.appendChild(s('circle', { cx: x, cy: 40, r: 16, class: 'gr-scircle' })); if (i < 2) a.appendChild(s('path', { d: 'M' + (x + 18) + ' 40h' + 36 + 'm-7 -5l7 5l-7 5', fill: 'none', style: 'stroke:var(--ink-2);stroke-width:2' })); });
    item('Commit, never look back', 'Take the best-looking option now. No undo, so it needs a proof.', a);
    var b = box(200, 80);
    [[10, 0, 60], [40, 1, 50], [90, 0, 40], [130, 1, 55]].forEach(function (r, i) { b.appendChild(s('rect', { x: r[0], y: 8 + i * 17, width: r[2], height: 12, rx: 4, class: i === 1 || i === 3 ? 'gr-sbar is-muted' : 'gr-sbar' })); });
    item('Earliest finish wins', 'Sort by end time, keep what fits. Exchange argument: swap it into any optimum.', b);
    var c = box(200, 80);
    [[20, 'is-bad', '4+1+1'], [110, '', '3+3']].forEach(function (r) { c.appendChild(s('rect', { x: r[0], y: 14, width: 70, height: 34, rx: 8, class: 'gr-sbar ' + r[1] })); c.appendChild(s('text', { x: r[0] + 35, y: 36, 'text-anchor': 'middle', class: 'gr-mono', style: 'fill:var(--on-state);font-weight:700' }, r[2])); });
    c.appendChild(s('text', { x: 55, y: 68, 'text-anchor': 'middle' }, 'greedy: 3 coins')); c.appendChild(s('text', { x: 145, y: 68, 'text-anchor': 'middle' }, 'best: 2 coins'));
    item('Coins {1, 3, 4} for 6', 'A locally best coin can lock out the best answer. Test small cases.', c);
    var d = box(200, 80);
    d.appendChild(s('rect', { x: 20, y: 10, width: 60, height: 60, rx: 8, style: 'fill:var(--bg-sunken);stroke:var(--line-strong);stroke-width:2' }));
    d.appendChild(s('rect', { x: 22, y: 34, width: 56, height: 34, class: 'gr-sbar is-warn' })); d.appendChild(s('rect', { x: 22, y: 52, width: 56, height: 16, class: 'gr-sbar' }));
    d.appendChild(s('rect', { x: 120, y: 10, width: 60, height: 60, rx: 8, style: 'fill:var(--bg-sunken);stroke:var(--line-strong);stroke-width:2' }));
    d.appendChild(s('rect', { x: 122, y: 52, width: 56, height: 16, class: 'gr-sbar' })); d.appendChild(s('text', { x: 150, y: 40, 'text-anchor': 'middle' }, 'gap'));
    item('Pour or whole?', 'Fractional knapsack: greedy by ratio is optimal. Whole items: it is not.', d);
    var e = box(200, 80);
    e.appendChild(s('circle', { cx: 100, cy: 14, r: 10, class: 'gr-scircle' }));
    [[60, 44], [140, 44]].forEach(function (p) { e.appendChild(s('line', { x1: 100, y1: 24, x2: p[0], y2: p[1] - 10, class: 'gr-sline' })); e.appendChild(s('circle', { cx: p[0], cy: p[1], r: 10, class: 'gr-scircle' })); });
    [[40, 72], [80, 72]].forEach(function (p) { e.appendChild(s('line', { x1: 60, y1: 54, x2: p[0], y2: p[1] - 8, class: 'gr-sline' })); e.appendChild(s('circle', { cx: p[0], cy: p[1], r: 8, class: 'gr-scircle' })); });
    item('Huffman', 'Merge the two rarest trees. Frequent symbols get short codes.', e);
    var f = box(200, 80);
    ['Greedy choice', 'Substructure', 'Proof'].forEach(function (t, i) { f.appendChild(s('path', { d: 'M14 ' + (20 + i * 22) + 'l6 6l12 -14', fill: 'none', style: 'stroke:var(--st-done);stroke-width:3' })); f.appendChild(s('text', { x: 44, y: 24 + i * 22 }, t)); });
    item('When it is safe', 'All three: greedy choice, optimal substructure, and a proof (or a matroid).', f);
  }

  /* ================================================================== quizzes */
  function quizzes() {
    var q1 = gr.shuffleOptions(['Yes: 25 + 5, and no combination uses fewer coins', 'No: 10 + 10 + 10 is better', 'No: greedy cannot make 30 with these coins', 'It depends on the order the coins are tried'], 0,
      ['Greedy takes 25, then 5: two coins. Any answer needs at least two coins, because one coin cannot be 30. For these coins greedy never fails.', 'Three coins is worse than two.', '25 + 5 = 30 exactly, so it can.', 'Greedy always tries the biggest coin first, so there is no order to vary.'], 11);
    V.quiz('#quiz-us30', { question: 'Greedy change with coins 1, 5, 10 and 25: does it give the fewest coins for 30?', options: q1.options, answer: q1.answer, explain: q1.explain, id: 'quiz-us30', kicker: 'Quick check' });
    var q2 = gr.shuffleOptions(['1 bit', '2 bits', '3 bits', '8 bits'], 0,
      ['\u201ca\u201d appears 5 times of 11. The last merge joins it with the tree holding all other letters (weight 6), so it hangs directly off the root: one bit.', 'It would take two merges to sink that deep, but \u201ca\u201d is too heavy to be merged early.', 'That is the length for the rare letters c and d, which are merged first.', 'That is plain ASCII; Huffman exists to beat it.'], 23);
    V.quiz('#quiz-huff', { question: 'In \u201cabracadabra\u201d (a\u00d75, b\u00d72, r\u00d72, c\u00d71, d\u00d71) how long is the Huffman code of the most frequent letter, \u201ca\u201d?', options: q2.options, answer: q2.answer, explain: q2.explain, id: 'quiz-huff' });
    var q3 = gr.shuffleOptions(['240', '160', '220', '280'], 0,
      ['Ratios are 6, 5 and 4. Take 10 kg (60) and 20 kg (100), then pour 20 of the 30 kg (\u2154 of 120 = 80): 60 + 100 + 80 = 240.', 'That is what whole-item greedy gets: it skips the 30 kg item.', 'That is the best whole-item choice (100 + 120). Pouring beats it.', 'Too high: the bag holds only 50 kg and no ratio is better than 6.'], 37);
    V.quiz('#quiz-frac', { question: 'A 50 kg bag; items 10 kg worth 60, 20 kg worth 100, 30 kg worth 120. Greedy by value per kg where you <em>may pour</em> part of an item: what total value?', options: q3.options, answer: q3.answer, explain: q3.explain, id: 'quiz-frac' });
  }

  function codeBlocks() {
    var t = $('[data-code-block="template"]');
    if (t) V.codeBlock(t, ['function greedy(candidates, key, fits) {', '  const chosen = [];', '  // best-looking first', '  for (const c of [...candidates].sort(key)) {', '    // commit; never remove', '    if (fits(chosen, c)) chosen.push(c);', '  }', '  return chosen;', '}'].join('\n'), 'js');
  }

  V.ready(function () {
    function safe(fn) { try { fn(); } catch (e) { console.error(e); } }
    safe(heroTeaser); safe(playFigure); safe(hillFigure); safe(codeBlocks);
    safe(function () { gr.labs.intervals(); }); safe(firstFigure); safe(exchangeFigure);
    safe(coinsFigure); safe(knapFigure); safe(function () { gr.labs.huffman(); });
    safe(bitsFigure); safe(flowFigure); safe(growthFigure); safe(jobsFigure); safe(minis); safe(summary); safe(quizzes);
    var tabs = $('#variants'); if (tabs) safe(function () { V.tabs(tabs); });
  });
}());
