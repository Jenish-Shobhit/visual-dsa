/* Lesson 07 — the two code-synced labs and the flowchart that is lit by the window lab.
   Lab 1: two pointers (palindrome, two-sum on a sorted array, reverse in place, remove duplicates).
   Lab 2: sliding window (longest substring without repeats, max sum of k) with a live count table.
   Started lazily by js/lessons/07-strings-and-two-pointers.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L7 = V.lessons.l07;
  function A() { return V.algos.strings; }
  function fmt(v) { return L7.fmt(v); }
  function q(c) { return '“' + (c === ' ' ? '␣' : c) + '”'; }
  function uniqueSorted(list) {
    var seen = {}, out = [];
    list.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out.sort(function (a, b) { return a - b; });
  }

  /* an input may arrive as text where numbers are expected (or the reverse) after a tab switch or preset:
     convert it, or return null so the caller can show a friendly message */
  function coerce(vals, numeric, cfg) {
    if (numeric) {
      if (Array.isArray(vals)) return vals.filter(function (x) { return typeof x === 'number' && isFinite(x); });
      var r = V.parseNumbers(String(vals == null ? '' : vals), { min: -20, max: 60, maxCount: 14, minCount: 0, integers: true });
      return r.error ? null : r.values;
    }
    if (Array.isArray(vals)) return vals.join('');
    return vals == null ? '' : String(vals);
  }

  /* ================================================================== lab 1: two pointers */
  var TP_TITLE = { palindrome: 'Palindrome', twosum: 'Two-sum (sorted)', reverse: 'Reverse in place', dedupe: 'Remove duplicates' };
  var TP_LEGEND = {
    palindrome: [{ state: 'compare', label: 'Pair being compared' }, { state: 'done', label: 'Matched, settled' }, { state: 'error', label: 'Mismatch' }],
    twosum: [{ state: 'compare', label: 'lo and hi' }, { state: 'visited', shape: 'dash', label: 'Still possible' }, { state: 'muted', label: 'Ruled out' }, { state: 'found', label: 'Answer' }],
    reverse: [{ state: 'compare', label: 'Pair to swap' }, { state: 'done', label: 'In its final place' }],
    dedupe: [{ state: 'compare', label: 'Being compared' }, { state: 'swap', label: 'Just written' }, { state: 'done', label: 'Kept: unique so far' }, { state: 'muted', label: 'Read, may be overwritten' }]
  };

  L7.initPointerLab = function () {
    var fig = V.$('#lab-pointers'), stage = fig.querySelector('[data-stage]');
    var tab = 'palindrome', target = 28;
    var inputs = { palindrome: 'madam', twosum: [2, 5, 8, 12, 16, 23], reverse: 'stressed', dedupe: [1, 1, 2, 2, 2, 3, 5, 5, 8] };
    var view = V.views.array(stage, { mode: 'boxes', cellSize: 52, label: 'Array with two pointers' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().CODE.palindrome, default: 'pseudo', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var note = fig.querySelector('[data-note]'), targetHost = fig.querySelector('[data-target]'), inputHost = fig.querySelector('[data-input]'), legendEl = fig.querySelector('[data-legend]');
    var slider, input;

    function generate() {
      var t = coerce(inputs.twosum, true), d = coerce(inputs.dedupe, true);
      t = t ? t.slice().sort(function (a, b) { return a - b; }) : []; d = d ? d.slice().sort(function (a, b) { return a - b; }) : [];
      if (tab === 'palindrome') return A().palindrome(coerce(inputs.palindrome, false));
      if (tab === 'twosum') return A().twoSum(t, target);
      if (tab === 'reverse') return A().reverse(coerce(inputs.reverse, false));
      return A().dedupe(d);
    }
    var steps = generate();
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps, render: function (step, ctx) { view.render(L7.plain(step), { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', sums: 'Sums checked', ruledOut: 'Pairs ruled out unseen', swaps: 'Swaps', reads: 'Reads', writes: 'Writes' },
      counterStates: { comparisons: 'compare', sums: 'compare', ruledOut: 'muted', swaps: 'swap', reads: 'compare', writes: 'swap' },
      baseStepMs: 950, label: 'Two-pointer lab controls'
    });

    /* predictions: one for remove-duplicates, one for reverse */
    player.addCheckpoint(function (st) {
      if (tab !== 'dedupe') return -1;
      var first = -1, any = -1;
      st.forEach(function (x, k) { if (x.kind === 'cmp' && any < 0) any = k; if (x.kind === 'cmp' && first < 0 && st[k + 1] && st[k + 1].kind === 'skip') first = k; });
      var c = first >= 0 ? first : any;
      return c < 0 ? -1 : c + 1;
    }, function (c) {
      var p = c.prev, r = p.r, w = p.w, av = p.items[r].value, last = p.items[w - 1].value, skip = c.step.kind === 'skip';
      return {
        question: 'Compare <code>a[' + r + '] = ' + fmt(av) + '</code> with the last kept value <code>a[' + (w - 1) + '] = ' + fmt(last) + '</code>. What happens?',
        options: ['Duplicate: skip it, and <b>w</b> stays put', 'New value: write it at <code>a[w]</code> and advance <b>w</b>'],
        answer: skip ? 0 : 1,
        explain: skip
          ? ['Right. ' + fmt(av) + ' equals ' + fmt(last) + ', and in a sorted array equal values are neighbours, so it is a duplicate of something already kept.', 'It equals the last kept value, so it is not new. Only a different value earns a slot.']
          : ['It differs from the last kept value, so it is new. Skipping it would lose a unique value.', 'Right. ' + fmt(av) + ' ≠ ' + fmt(last) + ', so it is a new value and goes into the next free slot.']
      };
    }, { id: 'l07-lab-dedupe' });
    player.addCheckpoint(function (st) { return tab === 'reverse' && st.length > 3 ? 1 : -1; }, function (c) {
      var n = c.steps[0].items.length, fl = Math.floor(n / 2);
      var opts = uniqueSorted([fl, n, n - 1, Math.ceil(n / 2)]);
      return {
        question: 'The string has <b>' + n + '</b> characters. How many swaps will it take to reverse it in place?',
        options: opts.map(String), answer: opts.indexOf(fl),
        explain: opts.map(function (x) {
          if (x === fl) return 'Right. Each swap fixes two characters (one at each end), so it takes ⌊n / 2⌋ = ' + fl + ' swaps. ' + (n % 2 ? 'The middle character never moves.' : '');
          if (x === n) return 'Swapping once per character would swap each pair twice and undo the work: every swap fixes two characters.';
          if (x === n - 1) return 'That is the count for a rotation, not a reversal. Each swap here puts two characters in their final places.';
          return 'Round down, not up: when n is odd the middle character has no partner to swap with.';
        })
      };
    }, { id: 'l07-lab-reverse' });

    function setNote(msg) { note.textContent = msg || ''; }
    function sortedCopy(values) { return values.slice().sort(function (a, b) { return a - b; }); }
    function numberInput(cfg) {
      return function (text) { return V.parseNumbers(text, cfg); };
    }
    var INPUTS = {
      palindrome: { label: 'Your string (0 to 16 characters, case matters)', parse: L7.textParser(0, 16), hint: 'Spaces and punctuation count as characters here.',
        presets: [{ label: 'madam', value: 'madam' }, { label: 'racecar', value: 'racecar' }, { label: 'abba', value: 'abba' }, { label: 'abca', value: 'abca' }, { label: 'Aba', title: 'Case matters: A ≠ a', value: 'Aba' }, { label: 'x', value: 'x' }, { label: 'empty', value: '' }] },
      twosum: { label: 'Your numbers (2 to 12, sorted for you)', parse: numberInput({ min: -20, max: 60, maxCount: 12, minCount: 0, integers: true }), hint: 'Two pointers need sorted input, so unsorted numbers are sorted first. Use the slider for the target.',
        presets: [{ label: 'Pair exists', value: function () { slider.set(28); target = 28; return [2, 5, 8, 12, 16, 23]; } }, { label: 'No pair', value: function () { slider.set(30); target = 30; return [2, 5, 8, 12, 16, 23]; } }, { label: 'Duplicates', value: function () { slider.set(8); target = 8; return [1, 4, 4, 4, 9]; } },
          { label: 'Negatives', value: function () { slider.set(1); target = 1; return [-6, -3, 0, 4, 5, 9]; } }, { label: 'One value', value: function () { return [7]; } }, { label: 'Random', value: function () { return V.presets.sorted(8, { min: 1, max: 30 }); } }] },
      reverse: { label: 'Your string (0 to 14 characters)', parse: L7.textParser(0, 14), hint: 'Odd lengths leave a middle character that never moves.',
        presets: [{ label: 'stressed', value: 'stressed' }, { label: 'abc', value: 'abc' }, { label: 'abcd', value: 'abcd' }, { label: 'a', value: 'a' }, { label: 'empty', value: '' }, { label: '😀ab', value: '😀ab' }] },
      dedupe: { label: 'Your numbers (0 to 14, sorted for you)', parse: numberInput({ min: -20, max: 60, maxCount: 14, minCount: 0, integers: true }), hint: 'Duplicates are only neighbours in a sorted array, so unsorted numbers are sorted first.',
        presets: [{ label: 'Some repeats', value: [1, 1, 2, 2, 2, 3, 5, 5, 8] }, { label: 'All equal', value: [4, 4, 4, 4, 4] }, { label: 'Already unique', value: [1, 2, 3, 4, 5, 6] }, { label: 'One value', value: [9] }, { label: 'empty', value: [] }, { label: 'Random', value: function () { return V.presets.fewUnique(10, { min: 1, max: 30, k: 4 }).sort(function (a, b) { return a - b; }); } }] }
    };
    function buildInput() {
      var cfg = INPUTS[tab];
      input = V.inputRow(inputHost, {
        label: cfg.label, value: inputs[tab], parse: cfg.parse, presets: cfg.presets, hint: cfg.hint,
        onApply: function (vals) {
          setNote('');
          var numeric = tab === 'twosum' || tab === 'dedupe';
          vals = coerce(vals, numeric, cfg);
          if (vals === null) { input.setError(numeric ? 'Type whole numbers separated by commas.' : 'Type some text.'); return; }
          if (numeric) {
            var sorted = sortedCopy(vals);
            if (sorted.join() !== vals.join()) { input.set(sorted, false); setNote('Sorted for you: ' + sorted.join(', ') + '.'); }
            vals = sorted;
          }
          inputs[tab] = vals; reload();
        }
      });
    }
    function reload() {
      steps = generate();
      view.reset(); view.prepare(steps);
      player.setSteps(steps);
    }
    V.legend(legendEl, TP_LEGEND[tab]);
    slider = V.slider(targetHost, { label: 'Target sum', min: -10, max: 60, value: target, onChange: function (v) { target = v; if (tab === 'twosum') reload(); } });
    var tabs = V.tabs('#lab-pointers-tabs', { onChange: function (name) { select(name); } });
    function select(name, force) {
      if (name === tab && !force) return;
      tab = name;
      code.setSource(A().CODE[{ palindrome: 'palindrome', twosum: 'twoSum', reverse: 'reverse', dedupe: 'dedupe' }[tab]]);
      V.legend(legendEl, TP_LEGEND[tab]);
      targetHost.hidden = tab !== 'twosum';
      setNote('');
      buildInput();
      reload();
    }
    select('palindrome', true);
    return { select: function (n) { tabs.select(n); }, player: player };
  };

  /* ================================================================== lab 2: sliding window */
  var FLOWS = {
    longest: {
      nodes: [
        { id: 'init', type: 'start', text: 'count = { }\nl = 0, best = 0', col: 0, row: 0 },
        { id: 'add', type: 'process', text: 'r moves right:\ncount[s[r]] += 1', col: 0, row: 1 },
        { id: 'dup', type: 'decision', text: 'count[s[r]] > 1 ?', col: 0, row: 2 },
        { id: 'shrink', type: 'process', text: 'count[s[l]] −= 1\nl = l + 1', col: 1, row: 2 },
        { id: 'update', type: 'process', text: 'best = max(best,\nr − l + 1)', col: 0, row: 3 },
        { id: 'ret', type: 'end', text: 'return best', col: 1, row: 4, narrow: { col: 0, row: 4 } }
      ],
      edges: [
        { from: 'init', to: 'add' },
        { from: 'add', to: 'dup' },
        { from: 'dup', to: 'shrink', label: 'yes' },
        { from: 'shrink', to: 'dup', via: { fromSide: 'top', toSide: 'top' } },
        { from: 'dup', to: 'update', label: 'no' },
        { from: 'update', to: 'add', label: 'next r' },
        { from: 'update', to: 'ret', label: 'no more characters', via: { fromSide: 'bottom', toSide: 'left' } }
      ]
    },
    fixed: {
      nodes: [
        { id: 'init', type: 'start', text: 'sum = first k values\nbest = sum', col: 0, row: 0 },
        { id: 'slide', type: 'process', text: 'r moves right:\nsum += a[r] − a[r − k]', col: 0, row: 1 },
        { id: 'better', type: 'decision', text: 'sum > best ?', col: 0, row: 2 },
        { id: 'upd', type: 'process', text: 'best = sum', col: 1, row: 2 },
        { id: 'more', type: 'decision', text: 'more values\nto the right?', col: 0, row: 3 },
        { id: 'ret', type: 'end', text: 'return best', col: 1, row: 4, narrow: { col: 0, row: 4 } }
      ],
      edges: [
        { from: 'init', to: 'slide' },
        { from: 'slide', to: 'better' },
        { from: 'better', to: 'upd', label: 'yes' },
        { from: 'better', to: 'more', label: 'no' },
        { from: 'upd', to: 'more' },
        { from: 'more', to: 'slide', label: 'yes' },
        { from: 'more', to: 'ret', label: 'no' }
      ]
    }
  };
  var WIN_TITLE = { longest: 'Longest substring without repeats', fixed: 'Max sum of k values' };
  var WIN_ALT = {
    longest: 'Text alternative: start with an empty count table, l = 0 and best = 0. Move r right and add s[r] to the table. While the count of s[r] is above 1, drop s[l] from the table and move l right. Then set best to the larger of best and the window length, and continue with the next r. When r has passed the last character, return best.',
    fixed: 'Text alternative: sum the first k values and call that the best. Then slide: add the value entering on the right and subtract the value leaving on the left. If the new sum beats the best, remember it. Repeat while there are more values to the right, then return the best.'
  };
  var WIN_LEGEND = {
    longest: [{ state: 'active', label: 'Character just added' }, { state: 'visited', label: 'Inside the window' }, { state: 'error', label: 'Repeated: window broken' }, { state: 'compare', label: 'Dropped from the left' }, { state: 'done', label: 'Best so far' }],
    fixed: [{ state: 'active', label: 'Entering (+)' }, { state: 'compare', label: 'Leaving (−)' }, { state: 'visited', label: 'Inside the window' }, { state: 'done', label: 'Best window so far' }]
  };

  /* live character-count table (longest) and running-sum ledger (fixed) */
  function tableView(host) {
    var key = '', cells = {}, ledger = null;
    function build(step) {
      V.clear(host); cells = {}; ledger = null;
      var grid = h('div', { class: 'l07-ct', role: 'table', 'aria-label': 'Count of each character inside the window' });
      step.alphabet.forEach(function (c) {
        var cnt = h('span', { class: 'l07-ct__n' }, '0');
        var cell = h('div', { class: 'l07-ct__cell', role: 'row' }, h('span', { class: 'l07-ct__c', role: 'rowheader' }, c === ' ' ? '␣' : c), cnt);
        grid.appendChild(cell); cells[c] = { el: cell, n: cnt, v: 0 };
      });
      host.appendChild(h('p', { class: 'l07-ct__title' }, 'count[c]: how many times each character is inside the window'));
      host.appendChild(grid);
      key = step.alphabet.join('\u0001');
    }
    function renderLongest(step) {
      if (host.getAttribute('data-kind') !== 'longest' || key !== step.alphabet.join('\u0001')) { host.setAttribute('data-kind', 'longest'); build(step); }
      step.alphabet.forEach(function (c) {
        var cell = cells[c], v = step.counts[c] || 0;
        if (cell.v !== v) { cell.n.textContent = v; cell.el.classList.remove('is-bump'); void cell.el.offsetWidth; cell.el.classList.add('is-bump'); cell.v = v; }
        cell.el.classList.toggle('is-on', v > 0);
        cell.el.classList.toggle('is-dup', v > 1);
        cell.el.setAttribute('aria-label', (c === ' ' ? 'space' : c) + ': ' + v);
      });
      if (!step.alphabet.length) host.appendChild(h('p', { class: 'muted' }, 'No characters, no table.'));
    }
    function renderFixed(step) {
      if (host.getAttribute('data-kind') !== 'fixed') {
        host.setAttribute('data-kind', 'fixed'); V.clear(host); key = ''; cells = {};
        ledger = { eq: h('p', { class: 'l07-ledger__eq', 'aria-live': 'off' }), sum: h('span', { class: 'l07-ledger__v' }), best: h('span', { class: 'l07-ledger__v l07-ledger__v--best' }) };
        host.appendChild(h('p', { class: 'l07-ct__title' }, 'Running sum: one addition and one subtraction per slide'));
        host.appendChild(h('div', { class: 'l07-ledger' }, ledger.eq, h('div', { class: 'l07-ledger__row' }, h('span', null, 'window sum'), ledger.sum, h('span', null, 'best so far'), ledger.best)));
      }
      var d = step.delta;
      ledger.eq.innerHTML = d ? '<span>' + fmt(d.before) + '</span> <em>+</em> <b class="in">' + fmt(d.enter) + '</b> <em>−</em> <b class="out">' + fmt(d.leave) + '</b> <em>=</em> <span>' + fmt(step.sum) + '</span>'
        : step.kind === 'first' ? 'first window: add its ' + (step.k === 1 ? '1 value' : step.k + ' values') + ' once' : 'window sum stays ' + fmt(step.sum);
      ledger.eq.classList.toggle('is-note', !d);
      ledger.sum.textContent = fmt(step.sum); ledger.best.textContent = step.best === null ? '–' : fmt(step.best);
    }
    return { render: function (step, kind) { if (kind === 'longest') renderLongest(step); else renderFixed(step); } };
  }

  L7.initWindowLab = function () {
    var fig = V.$('#lab-window'), flowFig = V.$('#fig-flow'), stage = fig.querySelector('[data-stage]');
    var tab = 'longest', k = 3;
    var inputs = { longest: 'abcabcbb', fixed: [2, 1, 5, 1, 3, 2, 8, 4] };
    var view = V.views.array(stage, { mode: 'boxes', cellSize: 46, label: 'String with a sliding window' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().CODE.longest, default: 'pseudo', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables' });
    var table = tableView(fig.querySelector('[data-table]'));
    var inputHost = fig.querySelector('[data-input]'), kHost = fig.querySelector('[data-k]'), legendEl = fig.querySelector('[data-legend]');
    var slider, input;

    /* flowchart wired to this lab */
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOWS.longest, { label: 'Flowchart of the sliding window running in the lab', narrowWidth: 420 });
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);
    var flowAdapter = {
      highlight: function (id, ctx) {
        var visited = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var i = 0; i < ctx.index && i < st.length; i++) if (st[i].flow && visited.indexOf(st[i].flow) === -1 && st[i].flow !== id) visited.push(st[i].flow);
        }
        flowView.render({ active: id || undefined, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };

    function fixedValues() { var v = coerce(inputs.fixed, true); return v && v.length ? v : [2, 1, 5, 1, 3, 2, 8, 4]; }
    function generate() {
      if (tab === 'longest') return A().windowLongest(coerce(inputs.longest, false));
      var v = fixedValues();
      return A().windowFixed(v, Math.max(1, Math.min(k, v.length)), { flow: true });
    }
    var steps = generate();
    view.prepare(steps.map(function (x) { return { rows: x.rows }; }));
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) { view.render({ rows: step.rows }, { duration: ctx.duration }); table.render(step, tab); },
      code: code, vars: vars, flow: flowAdapter, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { added: 'Added', dropped: 'Dropped', best: 'Best length', ops: 'Additions and subtractions' },
      counterStates: { added: 'active', dropped: 'compare', best: 'done', ops: 'swap' }, baseStepMs: 950, label: 'Sliding window lab controls'
    });

    /* predictions */
    player.addCheckpoint(function (st) {
      if (tab !== 'longest') return -1;
      for (var i = 1; i < st.length; i++) if (st[i].kind === 'shrink') return i;
      return -1;
    }, function (c) {
      var idx = c.index, end = idx;
      while (c.steps[end] && c.steps[end].kind !== 'update') end++;
      var l0 = c.prev.l, lf = c.steps[end].l, cnt = lf - l0, ch = c.prev.dup;
      if (ch === null || cnt < 1) return null;
      var opts = uniqueSorted([cnt, cnt + 1, cnt + 2, Math.max(1, cnt - 1)].filter(function (x) { return x >= 1 && x <= (c.prev.r - l0 + 1); }));
      return {
        question: 'The window <code>s[' + l0 + '..' + c.prev.r + ']</code> holds two ' + q(ch) + '. How many characters must leave from the left before it is valid again?',
        options: opts.map(String), answer: opts.indexOf(cnt),
        explain: opts.map(function (x) {
          if (x === cnt) return 'Right. The older ' + q(ch) + ' sits at index ' + (lf - 1) + '. A window is one unbroken stretch, so l has to pass it, and that drops every character from index ' + l0 + ' to ' + (lf - 1) + ': ' + cnt + '.';
          if (x > cnt) return 'That drops more than needed. l stops the moment the older ' + q(ch) + ' is gone, because the window is valid again.';
          return 'Not enough: after dropping only ' + x + ', the older ' + q(ch) + ' is still inside the window.';
        })
      };
    }, { id: 'l07-lab-shrink' });
    player.addCheckpoint(function (st) {
      if (tab !== 'fixed') return -1;
      for (var i = 1; i < st.length; i++) if (st[i].kind === 'slide') return i;
      return -1;
    }, function (c) {
      var d = c.step.delta, cand = uniqueSorted([c.step.sum, d.before + d.enter, d.before - d.leave, d.before]);
      return {
        question: 'The window sum is <b>' + fmt(d.before) + '</b>. The window slides right: <b>' + fmt(d.enter) + '</b> enters, <b>' + fmt(d.leave) + '</b> leaves. What is the new sum?',
        options: cand.map(fmt), answer: cand.indexOf(c.step.sum),
        explain: cand.map(function (x) {
          if (x === c.step.sum) return 'Right: ' + fmt(d.before) + ' + ' + fmt(d.enter) + ' − ' + fmt(d.leave) + ' = ' + fmt(x) + '. Add what enters, subtract what leaves, and never re-add the values that stay.';
          if (x === d.before + d.enter) return 'That forgets the value that left. The window still holds exactly k values.';
          if (x === d.before - d.leave) return 'That forgets the value that entered.';
          return 'That is the old sum: the window moved, so the sum changes by (entering − leaving).';
        })
      };
    }, { id: 'l07-lab-slide' });

    var INPUTS = {
      longest: { label: 'Your string (0 to 18 characters)', parse: L7.textParser(0, 18), hint: 'Repeats are what make the window shrink: try “abba”.',
        presets: [{ label: 'abcabcbb', value: 'abcabcbb' }, { label: 'pwwkew', value: 'pwwkew' }, { label: 'abba', title: 'The window must not jump backwards', value: 'abba' }, { label: 'dvdf', value: 'dvdf' }, { label: 'abcdef', title: 'No repeats: never shrinks', value: 'abcdef' }, { label: 'aaaa', value: 'aaaa' }, { label: 'a', value: 'a' }, { label: 'empty', value: '' }] },
      fixed: { label: 'Your numbers (1 to 12, −20 to 60)', parse: { min: -20, max: 60, maxCount: 12, minCount: 1, integers: true }, hint: 'Choose the window size with the slider.',
        presets: [{ label: 'Example', value: [2, 1, 5, 1, 3, 2, 8, 4] }, { label: 'Negatives', value: [-2, 5, -1, -8, 3, 4] }, { label: 'All equal', value: [3, 3, 3, 3, 3, 3] }, { label: 'Random', value: function () { return V.presets.random(9, { min: 1, max: 20 }); } }, { label: 'One value', value: [6] }] }
    };
    function buildInput() {
      var cfg = INPUTS[tab];
      input = V.inputRow(inputHost, {
        label: cfg.label, value: inputs[tab], parse: cfg.parse, presets: cfg.presets, hint: cfg.hint,
        onApply: function (vals) {
          vals = coerce(vals, tab === 'fixed', cfg);
          if (vals === null || (tab === 'fixed' && !vals.length)) { input.setError('Type at least one whole number.'); return; }
          inputs[tab] = vals;
          if (tab === 'fixed') { slider.input.max = String(vals.length); if (k > vals.length) { k = vals.length; slider.set(k); } }
          reload();
        }
      });
    }
    function reload() {
      steps = generate();
      view.reset(); view.prepare(steps.map(function (x) { return { rows: x.rows }; }));
      player.setSteps(steps);
    }
    slider = V.slider(kHost, { label: 'Window size k', min: 1, max: inputs.fixed.length, value: k, onChange: function (v) { k = v; if (tab === 'fixed') reload(); } });
    var flowSeg, tabs;
    function select(name, fromTabs, force) {
      if (name === tab && !force) return;
      tab = name;
      if (!fromTabs) tabs.select(name);
      code.setSource(A().CODE[tab === 'longest' ? 'longest' : 'fixed']);
      V.legend(legendEl, WIN_LEGEND[tab]);
      kHost.hidden = tab !== 'fixed';
      if (tab === 'fixed') { var fv = fixedValues(); slider.input.max = String(fv.length); if (k > fv.length) { k = fv.length; slider.set(k); } }
      flowView.setSpec(FLOWS[tab]);
      var ft = flowFig.querySelector('[data-flow-title]'); if (ft) ft.textContent = WIN_TITLE[tab] + ' as a flowchart';
      var alt = flowFig.querySelector('[data-flow-alt]'); if (alt) alt.textContent = WIN_ALT[tab];
      if (flowSeg && flowSeg.value !== tab) flowSeg.set(tab);
      buildInput();
      reload();
    }
    tabs = V.tabs('#lab-window-tabs', { onChange: function (name) { select(name, true); } });
    flowSeg = V.segmented(flowFig.querySelector('[data-seg]'), {
      label: 'Algorithm', value: tab,
      options: [{ value: 'longest', label: 'Longest substring' }, { value: 'fixed', label: 'Max sum of k' }],
      onChange: function (v) { select(v, false); }
    });
    select('longest', true, true);
    return { select: function (n) { select(n, false); }, player: player };
  };
}());
