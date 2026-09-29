/* Lesson 32 · Greedy algorithms — the two code-synced labs (interval scheduling, Huffman coding).
   Generators: js/algos/32-greedy.js.  Views: js/lessons/32-greedy-views.js.  Exposes VDSA.gr32.labs.intervals / .huffman. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var G = V.algos.greedy;
  var gr = V.gr32;
  gr.labs = {};

  function $(sel, root) { return (root || document).querySelector(sel); }

  /* Deterministic shuffle of checkpoint options so the right answer is not always first. */
  gr.shuffleOptions = function (options, answerIndex, explain, seed) {
    var rng = V.rng(seed), idx = options.map(function (_, i) { return i; });
    idx = V.shuffle(idx, rng);
    // never leave the right answer in first position
    if (idx[0] === answerIndex && idx.length > 1) { var j = 1 + Math.floor(rng() * (idx.length - 1)); var t = idx[0]; idx[0] = idx[j]; idx[j] = t; }
    return { options: idx.map(function (i) { return options[i]; }), answer: idx.indexOf(answerIndex), explain: explain ? idx.map(function (i) { return explain[i]; }) : undefined };
  };

  /* ================================================================== interval code */
  var KEYS = {
    start: { pseudo: 'key(r) ← r.start', js: 'const key = r => r.start; // earliest start @key', py: 'key = lambda r: r.start # earliest start @key' },
    short: { pseudo: 'key(r) ← r.end − r.start', js: 'const key = r => r.end - r.start; // shortest @key', py: 'key = lambda r: r.end - r.start # shortest @key' },
    conflicts: { pseudo: 'key(r) ← number of other requests overlapping r', js: 'const key = r => requests.filter(o => o !== r && o.start < r.end && r.start < o.end).length;   // @key', py: 'key = lambda r: sum(1 for o in requests if o is not r and o.start < r.end and r.start < o.end)   # @key' },
    finish: { pseudo: 'key(r) ← r.end', js: 'const key = r => r.end; // earliest finish @key', py: 'key = lambda r: r.end # earliest finish @key' }
  };
  function codeFor(strat) {
    var K = KEYS[strat];
    return {
      pseudo: [
        K.pseudo + '        // @key',
        'function schedule(requests)',
        '  order ← requests sorted by key            // @sort',
        '  chosen ← empty list',
        '  for each r in order                       // @loop',
        '    clash ← r overlaps any request in chosen   // @cmp',
        '    if clash: skip r                        // @skip',
        '    else add r to chosen                    // @take',
        '  return chosen                             // @ret'
      ].join('\n'),
      js: [
        K.js,
        'function schedule(requests) {',
        '  const order = [...requests].sort((a, b) => key(a) - key(b));   // @sort',
        '  const chosen = [];',
        '  for (const r of order) {                                        // @loop',
        '    const clash = chosen.some(c => c.start < r.end && r.start < c.end);  // @cmp',
        '    if (clash) continue;                                          // @skip',
        '    chosen.push(r);                                               // @take',
        '  }',
        '  return chosen;                                                  // @ret',
        '}'
      ].join('\n'),
      py: [
        K.py,
        'def schedule(requests):',
        '    order = sorted(requests, key=key)                        # @sort',
        '    chosen = []',
        '    for r in order:                                          # @loop',
        '        clash = any(c.start < r.end and r.start < c.end for c in chosen)   # @cmp',
        '        if clash: continue                                   # @skip',
        '        chosen.append(r)                                     # @take',
        '    return chosen                                            # @ret'
      ].join('\n')
    };
  }
  /* The pseudo key line above already carries "// @key"; K.pseudo for conflicts would double the comment marker, so trim. */
  var HF_CODE = {
    pseudo: [
      'function huffman(text)',
      '  queue ← min-priority queue of one-node trees, one per symbol, weight = count   // @init',
      '  while queue has more than one tree                       // @loop',
      '    a ← remove the smallest tree; b ← remove the next smallest   // @pick',
      '    put a tree with children a and b, weight a + b, back in queue   // @merge',
      '  codes ← walk the last tree: left = 0, right = 1          // @assign',
      '  a leaf’s code is the path of 0s and 1s from the root      // @leaf',
      '  return each character of text replaced by its code       // @ret'
    ].join('\n'),
    js: [
      'function huffman(text) {',
      '  const heap = new MinHeap((a, b) => a.count - b.count);            // @init',
      '  for (const [ch, count] of countChars(text)) heap.push({ ch, count }); // @init',
      '  while (heap.size > 1) {                                            // @loop',
      '    const a = heap.pop(), b = heap.pop();                            // @pick',
      '    heap.push({ count: a.count + b.count, left: a, right: b });      // @merge',
      '  }',
      '  const codes = assignCodes(heap.pop());                             // @assign',
      '  return [...text].map(c => codes[c]).join(\'\');                      // @ret',
      '}',
      'function assignCodes(node, prefix = \'\') {',
      '  if (!node.left) return { [node.ch]: prefix || \'0\' };               // @leaf',
      '  return { ...assignCodes(node.left, prefix + \'0\'), ...assignCodes(node.right, prefix + \'1\') };',
      '}'
    ].join('\n'),
    py: [
      'def huffman(text):',
      '    heap = [(count, i, Node(ch)) for i, (ch, count) in enumerate(count_chars(text))]   # @init',
      '    heapq.heapify(heap)                                          # @init',
      '    while len(heap) > 1:                                         # @loop',
      '        (ca, _, a), (cb, _, b) = heapq.heappop(heap), heapq.heappop(heap)   # @pick',
      '        heapq.heappush(heap, (ca + cb, next(tick), Node(None, a, b)))       # @merge',
      '    codes = assign_codes(heap[0][2])                             # @assign',
      '    return "".join(codes[c] for c in text)                       # @ret',
      '',
      'def assign_codes(node, prefix=""):',
      '    if node.left is None: return {node.ch: prefix or "0"}        # @leaf',
      '    return {**assign_codes(node.left, prefix + "0"), **assign_codes(node.right, prefix + "1")}'
    ].join('\n')
  };

  /* ================================================================== interval lab */
  gr.labs.intervals = function () {
    var fig = $('#lab-fig');
    if (!fig) return null;
    V.legend($('[data-legend]', fig), [
      { state: 'active', label: 'Being checked' }, { state: 'done', label: 'Kept (final)' }, { state: 'error', label: 'Clashes' },
      { state: 'muted', label: 'Skipped' }, { state: 'done', shape: 'outline', label: 'Busy time' }, { state: 'path', shape: 'dash', label: 'Best possible' }]);
    var PRESETS = {
      random: null,
      start: '0-20, 2-6, 8-12, 14-18',
      short: '0-7, 6-9, 8-15',
      conflicts: '15-20, 1-8, 10-15, 0-2, 18-24, 7-11, 12-18',
      finish: '1-6, 0-3, 4-9, 2-5, 8-13, 10-15, 6-11, 12-18'
    };
    var model = G.parseIntervals(PRESETS.start).intervals, strat = 'start', seed = 1, dragging = false;
    var tl = gr.timeline($('[data-stage]', fig), { rows: 1, label: 'Requests on a timeline', gutter: 74 });
    var code = V.codePanel($('[data-code]', fig), { languages: codeFor(strat), default: 'js', title: 'schedule', maxHeight: 340 });
    var vars = V.varsPanel($('[data-vars]', fig), { states: { r: 'active', chosen: 'done', clash: 'error' } });
    function toView(st) {
      var order = st.tl.order, rowOf = {};
      order.forEach(function (id, i) { rowOf[id] = i; });
      return {
        rows: model.length,
        items: model.map(function (iv) { return { id: iv.id, s: iv.s, e: iv.e, row: rowOf[iv.id], state: st.tl.states[iv.id], label: iv.id, sub: iv.s + '–' + iv.e, draggable: true }; }),
        rowLabels: order.map(function (id, i) { return { id: id, row: i, text: id, sub: st.tl.keys ? st.tl.keys[id] : '' }; }),
        busy: st.tl.busy, clash: st.tl.clash, ghosts: st.tl.ghosts
      };
    }
    var player = V.player({
      root: fig, steps: [], baseStepMs: 1150, label: 'Interval scheduling controls',
      render: function (st, ctx) { tl.render(toView(st), { duration: ctx.duration }); },
      code: code, vars: vars,
      caption: $('[data-caption]', fig), counters: $('[data-counters]', fig),
      counterLabels: { kept: 'Kept', checked: 'Checked' }, counterStates: { kept: 'done' }
    });
    // Predict: which request is kept next?
    player.addCheckpoint(function (steps) {
      var firstTake = -1;
      for (var i = 0; i < steps.length; i++) if (steps[i].kind === 'take') { firstTake = i; break; }
      if (firstTake < 0) return -1;
      for (var j = firstTake + 1; j < steps.length; j++) if (steps[j].kind === 'look') { for (var k = j + 1; k < steps.length; k++) if (steps[k].kind === 'take') return j; return -1; }
      return -1;
    }, function (c) {
      var steps = c.steps, k = c.index, prevStep = steps[k - 1];
      var decided = {}; prevStep.tl.order.forEach(function (id) { decided[id] = prevStep.tl.states[id] !== 'default'; });
      var undecided = prevStep.tl.order.filter(function (id) { return !decided[id]; });
      var nextTakeStep = null;
      for (var i = k; i < steps.length; i++) if (steps[i].kind === 'take') { nextTakeStep = steps[i]; break; }
      var answerId = nextTakeStep.cand;
      var lastStep = steps[steps.length - 1];
      var fate = {}; undecided.forEach(function (id) { fate[id] = lastStep.tl.states[id] === 'done' ? 'kept' : 'skipped'; });
      var byId = {}; model.forEach(function (iv) { byId[iv.id] = iv; });
      var opts = [answerId].concat(undecided.filter(function (id) { return id !== answerId; }).slice(0, 3));
      var keptSoFar = prevStep.tl.busy.map(function (b) { return b.s + '–' + b.e; }).join(', ');
      var explain = opts.map(function (id) {
        var iv = byId[id];
        if (id === answerId) return '<b>' + id + '</b> (' + iv.s + '–' + iv.e + ') is the first request left in the list that does not overlap the busy time (' + keptSoFar + '). Skipped requests before it clash, so it is the next one kept.';
        var pos = undecided.indexOf(id) > undecided.indexOf(answerId);
        return pos ? '<b>' + id + '</b> comes later in the sorted list than <b>' + answerId + '</b>, so greedy reaches ' + answerId + ' first.' : '<b>' + id + '</b> is examined first but it overlaps the busy time (' + keptSoFar + '), so it is skipped.';
      });
      var sh = gr.shuffleOptions(opts.map(function (id) { return '<b>' + id + '</b> (' + byId[id].s + '–' + byId[id].e + ')'; }), 0, explain, 7 + model.length);
      return { question: 'Greedy just kept a request (busy time ' + keptSoFar + '). It keeps walking down the sorted list. Which request will it keep <em>next</em>?', options: sh.options, answer: sh.answer, explain: sh.explain };
    }, { id: 'interval-next-pick' });

    var scoreEl = $('[data-score]', fig);
    function renderScore() {
      var sb = G.scoreboard(model), best = sb.finish;
      V.clear(scoreEl);
      scoreEl.appendChild(h('span', { class: 'gr-score__label' }, 'Kept by each rule:'));
      G.STRAT_IDS.forEach(function (id) {
        scoreEl.appendChild(h('li', { class: (id === strat ? 'is-current ' : '') + (sb[id] === best ? 'is-best' : 'is-bad') }, G.STRATEGIES[id].label, ' ', h('b', {}, String(sb[id])), sb[id] < best ? h('span', {}, ' (best is ' + best + ')') : null));
      });
    }
    function load() {
      var steps = G.intervalTrace(model, strat);
      tl.reset();
      tl.prepare(steps.map(toView));
      player.setSteps(steps);
      renderScore();
    }
    var inputRow = V.inputRow($('[data-input]', fig), {
      label: 'Requests (start-end, times 0 to 24)', value: PRESETS.start, placeholder: 'e.g. 0-4, 3-8, 5-9',
      inputmode: 'text', hint: 'Between 2 and 9 requests. You can also drag the bars: move a bar, or pull its ends. Focus a bar and use the arrow keys (Shift changes the end, Alt the start). Dragging restarts the run.',
      parse: function (text) { var r = G.parseIntervals(text); return { values: r.intervals, error: r.error }; },
      presets: [
        { label: 'Random', value: function () { seed++; var rng = V.rng(seed * 31 + 5); return G.intervalsToText(G.randomIntervals(rng.int(5, 8), rng)); } },
        { label: 'Breaks earliest start', value: PRESETS.start },
        { label: 'Breaks shortest', value: PRESETS.short },
        { label: 'Breaks fewest conflicts', value: PRESETS.conflicts },
        { label: 'Earliest finish shines', value: PRESETS.finish }
      ],
      onApply: function (ivs) { model = ivs; load(); }
    });
    var seg = V.segmented($('[data-strategy]', fig), {
      label: 'Greedy rule', value: strat,
      options: G.STRAT_IDS.map(function (id) { return { value: id, label: G.STRATEGIES[id].label }; }),
      onChange: function (v) { strat = v; code.setSource(codeFor(strat)); load(); }
    });
    // find a counterexample for the current rule
    var findBtn = $('[data-find]', fig);
    var findMsg = $('[data-find-msg]', fig);
    var findSeed = 0;
    findBtn.addEventListener('click', function () {
      if (strat === 'finish') { findMsg.textContent = 'Earliest finish has no counterexample: it is provably optimal. Switch to another rule to hunt for one.'; return; }
      var ex = G.findCounterexample(strat, findSeed++);
      if (!ex) { findMsg.textContent = 'No counterexample found this time. Try again.'; return; }
      model = ex; inputRow.set(G.intervalsToText(ex), false); load();
      var sb = G.scoreboard(ex);
      findMsg.textContent = G.STRATEGIES[strat].label + ' keeps ' + sb[strat] + ', but ' + sb.finish + ' fit. Step through to see where it went wrong.';
    });
    tl.on('drag', function (e) {
      var iv = model.filter(function (x) { return x.id === e.id; })[0];
      if (!iv || (iv.s === e.s && iv.e === e.e)) return;
      iv.s = e.s; iv.e = e.e; dragging = true;
      var steps = G.intervalTrace(model, strat);
      player.setSteps(steps);
      renderScore();
    });
    tl.on('dragend', function () { dragging = false; inputRow.set(G.intervalsToText(model), false); findMsg.textContent = ''; });
    load();
    return { player: player, tl: tl };
  };

  /* ================================================================== Huffman lab */
  gr.labs.huffman = function () {
    var fig = $('#hf-fig');
    if (!fig) return null;
    V.legend($('[data-legend]', fig), [
      { state: 'frontier', label: 'Tree waiting in the queue' }, { state: 'active', label: 'Two smallest (about to merge)' },
      { state: 'found', label: 'Leaf whose code is being read' }, { state: 'done', label: 'Code assigned' }, { state: 'path', shape: 'line', label: 'Path root to leaf' }]);
    var PRESETS = ['abracadabra', 'mississippi', 'hello world', 'aaaaaaaabc', 'a'];
    var text = 'abracadabra';
    var forest = gr.forest($('[data-stage]', fig), { label: 'Huffman tree being built' });
    var queueView = V.views.array($('[data-queue]', fig), { mode: 'boxes', cellSize: 40, label: 'Priority queue, smallest first', showIndices: false });
    var code = V.codePanel($('[data-code]', fig), { languages: HF_CODE, default: 'js', title: 'huffman', maxHeight: 330 });
    var vars = V.varsPanel($('[data-vars]', fig), { states: { queue: 'frontier' } });
    var textEl = $('[data-text]', fig), tableEl = $('[data-table]', fig), barsEl = $('[data-bars]', fig), bitsEl = $('[data-bits]', fig);
    var barRows = {};
    function buildBars() {
      V.clear(barsEl);
      [['ascii', 'Plain 8-bit text'], ['fixed', 'Fixed width'], ['huff', 'Huffman']].forEach(function (b) {
        var fill = h('div', { class: 'gr-bar-row__fill' }), val = h('b', {}, '');
        barsEl.appendChild(h('div', { class: 'gr-bar-row is-' + b[0] }, h('span', {}, b[1]), h('div', { class: 'gr-bar-row__track' }, fill), val));
        barRows[b[0]] = { fill: fill, val: val };
      });
    }
    buildBars();
    var rowEls = {}, charEls = [];
    function buildTable(steps) {
      var first = steps[0].hf;
      V.clear(tableEl); rowEls = {};
      var tb = h('tbody', {});
      first.freq.forEach(function (f) {
        var tr = h('tr', {}, h('td', { class: 'mono' }, G.showCh(f.ch)), h('td', {}, String(f.f)), h('td', { class: 'code' }, ''), h('td', {}, ''));
        tb.appendChild(tr); rowEls[f.ch] = tr;
      });
      tableEl.appendChild(h('table', { class: 'gr-hf-table', 'aria-label': 'Frequency table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Symbol'), h('th', {}, 'Count'), h('th', {}, 'Code'), h('th', {}, 'Bits used'))), tb));
      V.clear(textEl); charEls = [];
      text.split('').forEach(function (c) { var sp = h('span', {}, G.showCh(c)); textEl.appendChild(sp); charEls.push(sp); });
    }
    function renderSide(st) {
      var hf = st.hf, activeIds = {};
      var nodeCh = {}; hf.nodes.forEach(function (n) { if (n.ch !== null) nodeCh[n.id] = n.ch; });
      var pairCh = {};
      (hf.pair || []).forEach(function (id) { if (nodeCh[id] !== undefined) pairCh[nodeCh[id]] = true; });
      // leaves inside a merged subtree also count as "hot" when their tree is picked
      var hot = {};
      (hf.pair || []).forEach(function (id) { (function walk(i) { var n = hf.nodes.filter(function (x) { return x.id === i; })[0]; if (!n) return; if (n.ch !== null) hot[n.ch] = true; else { walk(n.left); walk(n.right); } }(id)); });
      void activeIds;
      hf.freq.forEach(function (f) {
        var tr = rowEls[f.ch], code_ = hf.codes[f.ch];
        tr.className = (hf.activeCode === f.ch ? 'is-active' : '') + (hot[f.ch] ? ' is-pick' : '');
        tr.children[2].textContent = code_ || '';
        tr.children[3].textContent = code_ ? String(code_.length * f.f) : '';
      });
      charEls.forEach(function (sp, i) { var c = text[i]; sp.className = hot[c] || hf.activeCode === c ? 'is-hot' : ''; });
      var n = text.length, k = hf.freq.length, fixed = Math.max(1, Math.ceil(Math.log2(k))), max = 8 * n;
      barRows.ascii.fill.style.width = '100%'; barRows.ascii.val.textContent = 8 * n;
      barRows.fixed.fill.style.width = (fixed * n / max * 100) + '%'; barRows.fixed.val.textContent = fixed * n;
      barRows.huff.fill.style.width = hf.enc ? (hf.enc.huff / max * 100) + '%' : '0%';
      barRows.huff.val.textContent = hf.enc ? hf.enc.huff : '—';
      if (hf.enc) {
        var bits = text.split('').map(function (c) { return hf.codes[c]; }).join('');
        bitsEl.textContent = bits;
        bitsEl.setAttribute('aria-label', 'Encoded text: ' + bits);
        bitsEl.style.display = '';
      } else bitsEl.style.display = 'none';
    }
    function toQueue(st) {
      var hf = st.hf, byId = {}; hf.nodes.forEach(function (n) { byId[n.id] = n; });
      return { items: hf.queue.map(function (id) { var n = byId[id]; return { id: id, value: n.w, label: n.ch !== null ? G.showCh(n.ch) : '∑', state: n.state === 'default' ? 'frontier' : n.state }; }), label: 'queue' };
    }
    var player = V.player({
      root: fig, steps: [], baseStepMs: 1250, label: 'Huffman lab controls',
      render: function (st, ctx) { forest.render(st, { duration: ctx.duration }); queueView.render(toQueue(st), { duration: ctx.duration }); renderSide(st); },
      code: code, vars: vars,
      caption: $('[data-caption]', fig), counters: $('[data-counters]', fig),
      counterLabels: { merges: 'Merges', trees: 'Trees in queue' }, counterStates: { trees: 'frontier' }
    });
    player.addCheckpoint(function (steps) { for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'pick' && steps[i - 1].kind === 'merge') return i; return -1; }, function (c) {
      var st = c.step, hf = st.hf, byId = {}; hf.nodes.forEach(function (n) { byId[n.id] = n; });
      var q = c.prev.hf.queue.map(function (id) { return byId[id]; });
      function nm(n) { return (n.ch !== null ? G.showCh(n.ch) : '∑') + ' (' + n.w + ')'; }
      var pair = hf.pair.map(function (id) { return byId[id]; });
      var cand = [[q[0], q[1]], [q[q.length - 2], q[q.length - 1]], [q[0], q[q.length - 1]]].filter(function (p) { return p[0] && p[1] && p[0] !== p[1]; });
      var opts = [nm(pair[0]) + ' and ' + nm(pair[1])];
      cand.forEach(function (p) { var t = nm(p[0]) + ' and ' + nm(p[1]); if (opts.indexOf(t) < 0 && opts.length < 3) opts.push(t); });
      if (opts.length < 2) return null;
      var explain = opts.map(function (o, i) { return i === 0 ? 'The queue is ordered by weight, so the two smallest are at the front. Merging the rarest trees pushes them deepest, which gives them the longest codes.' : 'That pair includes a heavier tree while lighter ones are still waiting. Huffman always takes the two <em>smallest</em>.'; });
      var sh = gr.shuffleOptions(opts, 0, explain, 41 + text.length);
      return { question: 'The queue now holds ' + q.map(nm).join(', ') + '. Which two trees does Huffman merge next?', options: sh.options, answer: sh.answer, explain: sh.explain };
    }, { id: 'huffman-next-merge' });

    function load() {
      var steps = G.huffmanTrace(text);
      forest.reset(); forest.prepare(steps);
      queueView.reset && queueView.reset();
      var qs = steps.map(toQueue);
      queueView.prepare && queueView.prepare(qs);
      buildTable(steps);
      player.setSteps(steps);
    }
    var inputRow = V.inputRow($('[data-input]', fig), {
      label: 'Text to compress', value: text, placeholder: 'e.g. abracadabra', hint: 'Up to 80 characters and 12 different symbols. Spaces count (shown as ␣).',
      parse: function (t) { var r = G.parseText(t); return { values: r.text, error: r.error }; },
      presets: PRESETS.map(function (p) { return { label: p === 'a' ? 'One symbol' : '“' + p + '”', value: p }; }),
      onApply: function (t) { text = t; load(); }
    });
    void inputRow;
    load();
    return { player: player };
  };
}());
