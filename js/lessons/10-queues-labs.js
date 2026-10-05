/* Lesson 10 — the two code-synced labs: the circular-buffer lab (ring + flat views, three bookkeeping schemes,
   flowchart) and the sliding-window-maximum lab (bars, monotonic deque, output row, flowchart).
   Uses VDSA.algos.queues (js/algos/10-queues.js) and helpers from js/lessons/10-queues-views.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L10 = V.lessons.l10;
  function Q() { return V.algos.queues; }
  var fmt = L10.fmt;

  /* a flowchart adapter for the player: lights the node, remembers the nodes already run */
  function flowAdapter(flowView) {
    return {
      highlight: function (id, ctx) {
        var visited = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var k = Math.max(0, ctx.index - 12); k < ctx.index && k < st.length; k++) if (st[k].flow && visited.indexOf(st[k].flow) === -1 && st[k].flow !== id) visited.push(st[k].flow);
        }
        flowView.render({ active: id || undefined, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };
  }

  /* ================================================================== 1. circular buffer lab */
  var PRESETS = [
    { id: 'wrap', label: 'Wrap-around', text: '1 2 3 4 5 d d d 6 7 8 9', cap: 6, scheme: 'size', policy: 'reject', title: 'Fill, drain three, then keep writing: tail wraps round and the buffer ends up full' },
    { id: 'full', label: 'Fill it up', text: '1 2 3 4 5 d', cap: 4, scheme: 'size', policy: 'reject', title: 'A fifth value does not fit in four slots' },
    { id: 'empty', label: 'Drain it', text: '1 2 d d d', cap: 4, scheme: 'size', policy: 'reject', title: 'Dequeue from an empty buffer' },
    { id: 'bug', label: 'Full or empty?', text: '1 2 3 4 d', cap: 4, scheme: 'bug', policy: 'reject', title: 'With only head and tail, a full buffer looks empty' },
    { id: 'spare', label: 'Spare slot fix', text: '1 2 3 4 d', cap: 4, scheme: 'spare', policy: 'reject', title: 'Leave one slot empty so full and empty differ' },
    { id: 'over', label: 'Overwrite oldest', text: '1 2 3 4 5 6 7', cap: 4, scheme: 'size', policy: 'overwrite', title: 'What audio buffers do when the reader falls behind' },
    { id: 'random', label: 'Random', text: null, cap: 5, scheme: 'size', policy: 'reject', title: 'A random run of 14 operations' }
  ];
  var SCHEME_LABEL = { size: 'head + size', spare: 'head + tail, one spare slot', bug: 'head + tail only' };

  L10.initRingLab = function () {
    var fig = V.$('#lab-fig'), flowFig = V.$('#fig-flow');
    var st = { cap: 6, scheme: 'size', policy: 'reject', ops: Q().parseOps(PRESETS[0].text).ops };
    var ringV = V.views.ring(fig.querySelector('[data-ring]'), { unrolled: false, radius: 92, headLabel: 'head', tailLabel: 'tail', label: 'The buffer drawn as a ring' });
    var flatV = V.views.array(fig.querySelector('[data-flat]'), { mode: 'boxes', cellSize: 46, showIndices: true, label: 'The same memory as a plain array' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: Q().ringCode(st.scheme, st.policy), default: 'pseudo', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var flags = fig.querySelector('[data-flags]');
    var legendEl = fig.querySelector('[data-legend]');
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), Q().ringFlow(st.scheme, st.policy), { label: 'Flowchart of enqueue and dequeue in the buffer running in the lab', narrowWidth: 460 });
    var flowTitle = flowFig.querySelector('[data-flow-title]');
    var steps, player, input, segScheme, segCap, segPolicy, policyWrap = fig.querySelector('[data-policy-wrap]');

    function flatState(s) { return { items: s.flat, length: s.capacity, pointers: s.pointers, regions: s.regions }; }
    function renderFlags(s) {
      V.clear(flags);
      var f = s.flags;
      flags.appendChild(L10.chip('isEmpty() → ' + f.isEmpty, f.isEmpty ? 'compare' : 'default'));
      flags.appendChild(L10.chip('isFull() → ' + (f.isFull === null ? 'cannot tell' : f.isFull), f.isFull === null ? 'error' : f.isFull ? 'compare' : 'default'));
      flags.appendChild(L10.chip('values stored: ' + f.stored + (f.lost ? ' (' + f.lost + ' unreachable)' : ''), f.lost ? 'error' : 'default'));
      flags.appendChild(L10.chip('usable slots: ' + f.usable + ' of ' + s.capacity, f.usable < s.capacity ? 'compare' : 'default'));
    }
    function generate() { return Q().ring(st.cap, st.ops, { scheme: st.scheme, policy: st.policy }); }
    function paint(s, ctx) {
      var d = ctx.duration;
      ringV.render({ capacity: s.capacity, slots: s.slots, head: s.head, tail: s.tail, size: s.size }, { duration: d });
      flatV.render(flatState(s), { duration: d });
      renderFlags(s);
    }
    function legend() {
      var items = [{ state: 'swap', label: 'Being written' }, { state: 'found', label: 'Being read' }, { state: 'default', label: 'Queue value' }, { state: 'muted', label: 'Stale (already dequeued)' }, { state: 'active', label: 'head' }, { state: 'frontier', label: 'tail (next write)' }];
      if (st.scheme === 'bug') items.splice(4, 0, { state: 'error', label: 'Lost: unread but unreachable' });
      V.legend(legendEl, items);
    }
    steps = generate();
    flatV.prepare(steps.map(flatState));
    player = V.player({
      root: fig, steps: steps, render: paint, code: code, vars: vars, flow: flowAdapter(flowView),
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { enqueued: 'Enqueued', dequeued: 'Dequeued', wraps: 'Wrap-arounds', refused: 'Refused', overwritten: 'Overwritten' },
      counterStates: { refused: 'error', overwritten: 'error', wraps: 'swap' },
      baseStepMs: 1150, label: 'Circular buffer lab controls'
    });

    /* ---- predictions ---- */
    player.addCheckpoint(function (sts) { for (var k = 1; k < sts.length; k++) if (sts[k].wrapWrite) return k; return -1; }, function (c) {
      var C = c.step.capacity, last = C - 1;
      return {
        question: 'The previous enqueue wrote into slot <b>' + last + '</b>, the last slot of the array. Where will the next enqueue write?',
        options: ['Slot ' + C + ', the next index up', 'Slot 0: (' + last + ' + 1) mod ' + C + ' wraps round', 'Slot ' + last + ' again'],
        answer: 1,
        explain: [
          'There is no slot ' + C + ': the array has slots 0 to ' + last + '. Writing there would corrupt whatever memory follows the array.',
          'Right. The index runs off the end, and <b>mod ' + C + '</b> brings it back to 0. Slot 0 is free because the front has already moved past it.',
          'Slot ' + last + ' still holds the value just written. The write index moves one slot forward after every enqueue.'
        ]
      };
    }, { id: 'l10-lab-wrap' });
    player.addCheckpoint(function (sts) {
      for (var k = 1; k < sts.length; k++) { var s = sts[k]; if (s.kind === 'advance' && s.op && /^enqueue/.test(s.op) && s.head === s.tail && s.flags.stored === s.capacity) return k; }
      return -1;
    }, function (c) {
      var bug = c.step.scheme === 'bug';
      return {
        question: 'This enqueue fills the last free slot. Afterwards <code>head</code> and <code>tail</code> point at the <b>same slot</b>. Is the buffer full, or empty?',
        options: ['Full: every slot holds a value', 'Empty: head = tail means nothing is stored', 'Head and tail cannot say: full and empty look identical, so something else must decide'],
        answer: 2,
        explain: [
          'It is full, but the pointers alone do not prove it: head = tail is also what an empty buffer looks like. ' + (bug ? 'This version treats it as empty. ' : 'Only the extra <code>size</code> tells them apart. ') + 'Look at the next steps.',
          'It is not empty: all the slots hold values. ' + (bug ? 'But this code would read it as empty, which is exactly the bug you are about to see.' : 'head = tail is ambiguous: it is also the state of a completely full buffer.'),
          'Right. An empty buffer and a full one both have head = tail. That is why the buffer keeps a <code>size</code>, or leaves one slot always empty, or keeps a full flag.'
        ]
      };
    }, { id: 'l10-lab-fullempty' });

    /* ---- controls ---- */
    function reload() {
      steps = generate();
      flatV.reset(); flatV.prepare(steps.map(flatState));
      player.setSteps(steps);
    }
    function applyConfig(o) {
      if (o.cap !== undefined) { st.cap = o.cap; segCap.set(String(o.cap)); }
      if (o.scheme !== undefined) { st.scheme = o.scheme; segScheme.set(o.scheme); }
      if (o.policy !== undefined) { st.policy = o.policy; segPolicy.set(o.policy); }
      policyWrap.hidden = st.scheme === 'bug';
      code.setSource(Q().ringCode(st.scheme, st.policy));
      flowView.setSpec(Q().ringFlow(st.scheme, st.policy));
      if (flowTitle) flowTitle.textContent = 'Enqueue and dequeue: ' + SCHEME_LABEL[st.scheme];
      legend();
    }
    input = L10.opsInput(fig.querySelector('[data-input]'), {
      value: PRESETS[0].text, maxOps: 20, hint: 'Up to 20 operations. Values from −99 to 99.',
      onApply: function (ops) { st.ops = ops; reload(); }
    });
    segScheme = V.segmented(fig.querySelector('[data-scheme]'), { label: 'How the buffer remembers its contents', value: st.scheme,
      options: [{ value: 'size', label: 'head + size' }, { value: 'spare', label: 'spare slot' }, { value: 'bug', label: 'head + tail only' }],
      onChange: function (v) { st.scheme = v; applyConfig({}); reload(); } });
    segCap = V.segmented(fig.querySelector('[data-cap]'), { label: 'Capacity C', value: String(st.cap),
      options: [{ value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }, { value: '6', label: '6' }, { value: '8', label: '8' }],
      onChange: function (v) { st.cap = +v; reload(); } });
    segPolicy = V.segmented(fig.querySelector('[data-policy]'), { label: 'When full', value: st.policy,
      options: [{ value: 'reject', label: 'Reject' }, { value: 'overwrite', label: 'Overwrite oldest' }],
      onChange: function (v) { st.policy = v; applyConfig({}); reload(); } });
    var presetHost = fig.querySelector('[data-presets]');
    var rng = V.rng(10);
    PRESETS.forEach(function (p) {
      presetHost.appendChild(h('button', { type: 'button', class: 'btn btn--sm', title: p.title, onclick: function () {
        var text = p.text;
        if (text === null) {
          var parts = [], live = 0;
          for (var k = 0; k < 14; k++) { if (live > 0 && rng() < 0.42) { parts.push('d'); live--; } else { parts.push(String(rng.int(1, 99))); live++; } }
          text = parts.join(' ');
        }
        st.ops = Q().parseOps(text).ops;
        input.set(text, false);
        applyConfig({ cap: p.cap, scheme: p.scheme, policy: p.policy });
        reload();
      } }, p.label));
    });
    policyWrap.hidden = false;
    legend();
    return { player: player, set: applyConfig };
  };

  /* ================================================================== 2. sliding window maximum lab */
  var WPRESETS = [
    { label: 'Classic', nums: [4, 2, 12, 3, 8, 1, 9, 5, 7, 6], k: 3 },
    { label: 'Random', nums: null, k: 3 },
    { label: 'Increasing', nums: [10, 20, 30, 40, 50, 60, 70, 80], k: 3, title: 'Every new value pops the old one: the deque holds one index' },
    { label: 'Decreasing', nums: [80, 70, 60, 50, 40, 30, 20, 10], k: 3, title: 'Nothing is ever popped from the back: the deque fills up to k' },
    { label: 'Big early value', nums: [90, 20, 30, 10, 40, 25, 60, 15], k: 3, title: 'The 90 expires from the front after k steps' },
    { label: 'All equal', nums: [5, 5, 5, 5, 5, 5], k: 3 }
  ];

  L10.initWindowLab = function () {
    var fig = V.$('#win-fig'), flowFig = V.$('#fig-winflow');
    var st = { nums: WPRESETS[0].nums.slice(), k: 3 };
    var hostBars = fig.querySelector('[data-bars]'), hostDq = fig.querySelector('[data-dq]'), hostOut = fig.querySelector('[data-out]');
    var barsV = V.views.array(hostBars, { mode: 'bars', cellSize: 44, showIndices: true, barHeight: 120, label: 'The values with the sliding window over them' });
    var dqV = null, outV = V.views.array(hostOut, { mode: 'boxes', cellSize: 42, showIndices: true, label: 'The maximum of each window so far' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: Q().WINDOW_CODE, default: 'pseudo', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), Q().windowFlow(), { label: 'Flowchart of the sliding window maximum running in the lab', narrowWidth: 460 });
    var note = fig.querySelector('[data-note]');
    var steps, player, input, segK;

    function makeDq() {
      if (dqV) dqV.destroy();
      V.clear(hostDq);
      dqV = V.views.deque(hostDq, { capacity: st.k, cellSize: 46, label: 'The deque of candidate indices, front to back' });
    }
    function barState(s) {
      var pointers = s.i === null ? [] : [{ name: 'i', index: s.i, state: 'active', side: 'above' }];
      var regions = s.window ? [{ id: 'win', from: s.window.from, to: s.window.to, state: 'active', label: 'window, k = ' + s.k }] : [];
      return { items: s.nums, pointers: pointers, regions: regions };
    }
    function outState(s) { return { items: s.out.map(function (o, ix) { return { id: o.id, value: o.value, index: ix, state: o.state }; }), length: s.outLength }; }
    function generate() { return Q().slidingMax(st.nums, st.k); }
    function paint(s, ctx) {
      var d = ctx.duration;
      barsV.render(barState(s), { duration: d });
      dqV.render({ items: s.dq }, { duration: d });
      outV.render(outState(s), { duration: d });
    }
    function prepareViews(sts) {
      barsV.reset(); barsV.prepare(sts.map(barState));
      makeDq(); dqV.prepare(sts.map(function (s) { return { items: s.dq, capacity: st.k }; }));
      outV.reset(); outV.prepare(sts.map(outState));
    }
    steps = generate();
    makeDq(); prepareViews(steps);
    player = V.player({
      root: fig, steps: steps, render: paint, code: code, vars: vars, flow: flowAdapter(flowView),
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Deque comparisons', pops: 'Popped from the back', brute: 'Brute force would have made' },
      counterStates: { comparisons: 'compare', pops: 'swap', brute: 'error' },
      baseStepMs: 1100, label: 'Sliding window maximum lab controls'
    });
    player.addCheckpoint(function (sts) {
      var pick = -1, first = -1;
      for (var k = 1; k < sts.length; k++) {
        if (sts[k].kind === 'pop' && sts[k - 1].kind !== 'pop') {
          var run = 0; while (sts[k + run] && sts[k + run].kind === 'pop') run++;
          if (first < 0) first = k;
          if (run >= 2) { pick = k; break; }
        }
      }
      return pick >= 0 ? pick : first;
    }, function (c) {
      var prev = c.prev, k = c.index, run = 0;
      while (c.steps[k + run] && c.steps[k + run].kind === 'pop') run++;
      var dq = prev.dq.map(function (x) { return x.value; });
      var v = prev.nums[prev.i].value;
      var opts = [];
      for (var q = 0; q <= Math.min(dq.length, 4); q++) opts.push(q === 0 ? 'None' : q === dq.length ? (dq.length === 1 ? 'The one value' : 'All ' + q) : String(q));
      var expl = opts.map(function (_, q) {
        var back = dq[dq.length - 1 - q];
        if (q === run) return 'Right. Working from the back: ' + dq.slice(dq.length - run).reverse().map(function (x) { return '<b>' + fmt(x) + '</b> ≤ ' + fmt(v); }).join(', ') + ' each pop' + (run < dq.length ? '; then <b>' + fmt(dq[dq.length - 1 - run]) + '</b> is larger than ' + fmt(v) + ', so the popping stops there' : '; then the deque is empty') + '.';
        if (q < run) return 'Too few. The back value <b>' + fmt(dq[dq.length - 1 - q]) + '</b> is ≤ ' + fmt(v) + ' and will leave the window before ' + fmt(v) + ' does, so it can never be a maximum again.';
        return 'Too many. <b>' + fmt(back === undefined ? dq[0] : dq[dq.length - run - 1]) + '</b> is larger than ' + fmt(v) + ', so it stays: it is still a possible maximum until it expires.';
      });
      return { question: 'The value <b>' + fmt(v) + '</b> has just entered. The deque holds <b>' + (dq.length ? dq.map(fmt).join(', ') : 'nothing') + '</b> (front to back). How many values leave from the <em>back</em> before it is pushed?', options: opts, answer: run, explain: expl };
    }, { id: 'l10-win-pops' });

    function reload() {
      if (st.k > st.nums.length) { st.k = st.nums.length; segK.set(String(st.k)); note.textContent = 'The window cannot be bigger than the list, so k was reduced to ' + st.k + '.'; }
      else note.textContent = '';
      steps = generate();
      prepareViews(steps);
      player.setSteps(steps);
    }
    input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (2 to 14 values, 0 to 99)', value: st.nums, parse: { min: 0, max: 99, minCount: 2, maxCount: 14, integers: true },
      hint: 'The window size k has its own buttons: 2, 3, 4 or 5.', onApply: function (vals) { st.nums = vals; reload(); }
    });
    segK = V.segmented(fig.querySelector('[data-k]'), { label: 'Window size k', value: String(st.k),
      options: [{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }, { value: '5', label: '5' }],
      onChange: function (v) { st.k = +v; reload(); } });
    var host = fig.querySelector('[data-presets]');
    var rng = V.rng(21);
    WPRESETS.forEach(function (p) {
      host.appendChild(h('button', { type: 'button', class: 'btn btn--sm', title: p.title || null, onclick: function () {
        st.nums = p.nums ? p.nums.slice() : V.presets.random(12, { min: 5, max: 95, rng: rng });
        st.k = p.k; segK.set(String(p.k));
        input.set(st.nums, false);
        reload();
      } }, p.label));
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'New value i' }, { state: 'frontier', label: 'Candidate in the deque' }, { state: 'found', label: 'Window maximum' }, { state: 'muted', label: 'Outside the window' }]);
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);
    return { player: player };
  };
}());
