/* Lesson 22 · Tries — figures: live autocomplete, trie-vs-hash-set race, nodes-vs-words chart, radix compression,
   longest-prefix routing and the "trie, hash map or sorted array?" decision diagram.
   Each figure starts lazily (V.onVisible) except where the score needs its check registered at load. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, T = V.algos.tries, L = V.lesson22;

  function lazy(el, fn) {
    var done = false;
    V.onVisible(el, function (vis) { if (vis && !done) { done = true; fn(); } }, { threshold: 0.05 });
    /* also start when the browser cannot report visibility */
    if (!('IntersectionObserver' in window)) { done = true; fn(); }
  }

  /* ================================================================== autocomplete */
  var AC = [['car', 90], ['card', 60], ['care', 75], ['careful', 30], ['cart', 40], ['cat', 120], ['cab', 25], ['can', 100], ['cap', 35], ['cape', 10], ['do', 200], ['dog', 80], ['dodo', 5], ['done', 45], ['dot', 30]];

  function autocomplete() {
    var fig = V.$('#fig-ac');
    if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'path', label: 'Path to the prefix' },
      { state: 'active', label: 'Prefix node' },
      { state: 'visited', label: 'Subtree read by the DFS' },
      { state: 'found', label: 'Suggested word' },
      { state: 'error', label: 'No such prefix' }
    ]);
    var t = T.build(AC.map(function (a) { return a[0]; }), AC.map(function (a) { return a[1]; }));
    var view = L.treeView(fig.querySelector('[data-stage]'), { nodeSize: 36, label: 'Trie of fifteen words, lit for the typed prefix' });
    view.prepare([T.completeView(t, '', {}).tree]);
    var input = fig.querySelector('#ac-input'), list = fig.querySelector('[data-results]'), note = fig.querySelector('[data-note]');
    var cap = fig.querySelector('[data-caption]'), count = fig.querySelector('[data-ac-count]');
    var order = 'rank', maxFreq = 200;

    function update(dur) {
      var prefix = input.value;
      var v = T.completeView(t, prefix, { k: 5, order: order });
      view.render(v.tree, { duration: dur });
      var c = v.c;
      V.clear(list);
      v.showing.forEach(function (r, i) {
        var li = h('li', { class: 'tr-result', style: { '--i': i } },
          h('span', { class: 'tr-result__rank' }, i + 1),
          h('span', { class: 'tr-result__word' }, h('b', {}, r.word.slice(0, prefix.length)), r.word.slice(prefix.length)),
          h('span', { class: 'tr-result__bar', style: { '--w': (r.freq / maxFreq * 100).toFixed(1) + '%' } }, h('i', {})),
          h('span', { class: 'tr-result__n' }, r.freq));
        list.appendChild(li);
      });
      count.textContent = c.ok ? '(' + Math.min(5, c.all.length) + ' of ' + c.all.length + ')' : '(none)';
      if (!c.ok) {
        note.textContent = 'No stored word starts with “' + prefix + '”.';
        cap.innerHTML = 'The walk stops after <b>' + c.matched + '</b> letter' + (c.matched === 1 ? '' : 's') + ': <code>' + V.escape(c.node.prefix || 'root') + '</code> has no child <code>' + V.escape(c.failChar) + '</code>. Nothing else is read, and no suggestion exists.';
      } else if (!c.all.length) {
        note.textContent = '';
        cap.textContent = 'Empty trie.';
      } else {
        note.textContent = order === 'rank' ? 'Ranked by popularity score.' : 'In depth-first order: the order the DFS meets them, which is alphabetical.';
        cap.innerHTML = (prefix ? 'Walked <b>' + c.matched + '</b> letter' + (c.matched === 1 ? '' : 's') + ' to <code>' + V.escape(prefix) + '</code>, then read the <b>' + c.visited + '</b> node' + (c.visited === 1 ? '' : 's') + ' of the subtree there (that node included) to collect <b>' + c.all.length + '</b> word' + (c.all.length === 1 ? '' : 's') + '. ' : 'No prefix typed, so the DFS starts at the root and reads all <b>' + c.visited + '</b> nodes. ') +
          'Showing the ' + Math.min(5, c.all.length) + ' ' + (order === 'rank' ? 'most popular' : 'first in DFS order') + ': ' + v.showing.map(function (r) { return '<code>' + r.word + '</code>'; }).join(', ') + '.';
      }
    }
    input.addEventListener('input', function () {
      var clean = input.value.toLowerCase().replace(/[^a-z]/g, '');
      if (clean !== input.value) input.value = clean;
      update(280);
    });
    var chips = fig.querySelector('[data-chips]');
    ['ca', 'car', 'do', 'cx', ''].forEach(function (p) {
      chips.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { input.value = p; update(380); input.focus(); } }, p === '' ? 'clear' : p));
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Order of suggestions', value: 'rank',
      options: [{ value: 'rank', label: 'By popularity' }, { value: 'dfs', label: 'DFS order' }],
      onChange: function (v) { order = v; update(300); }
    });
    input.value = 'ca';
    update(0);
    L.centerScroll(fig.querySelector('[data-stage]'));
  }

  /* ================================================================== trie vs hash set race */
  var RACE_WORDS = ['tea', 'team', 'tear', 'ten', 'tent', 'ted', 'tab', 'tan', 'tap', 'car', 'card', 'cart', 'cat', 'dog', 'dot', 'do'];
  function race() {
    var fig = V.$('#fig-race');
    if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'compare', label: 'Key being tested' },
      { state: 'found', label: 'Match / arrived' },
      { state: 'visited', label: 'Tested, no match' },
      { state: 'path', label: 'Trie path' },
      { state: 'error', label: 'Dead end' }
    ]);
    var keys = fig.querySelector('[data-keys]');
    var chips = RACE_WORDS.map(function (w) { return h('span', { class: 'tr-chip tr-chip--sm' }, w); });
    chips.forEach(function (c) { keys.appendChild(c); });
    var hashRes = fig.querySelector('[data-hash-result]'), trieRes = fig.querySelector('[data-trie-result]');
    var view = L.treeView(fig.querySelector('[data-stage]'), { nodeSize: 30, minNodeSize: 15, label: 'Trie of sixteen words with a count in each node' });
    var state = { prefix: 'te' };
    function steps(prefix) { return T.raceSteps(RACE_WORDS, prefix); }
    var first = steps(state.prefix);
    view.prepare(first.map(function (s) { return s.tree; }));
    var player = V.player({
      root: fig, steps: first, baseStepMs: 750, animMs: 480, label: 'Race controls',
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { keys: 'Keys examined (hash set)', nodes: 'Nodes visited (trie)' },
      counterStates: { keys: 'compare', nodes: 'path' },
      render: function (step, ctx) {
        step.keyStates.forEach(function (st, k) { chips[k].className = 'tr-chip tr-chip--sm' + (st === 'default' ? '' : ' is-' + st); });
        view.render(step.tree, { duration: ctx.duration });
        hashRes.innerHTML = step.hashCount === null
          ? 'Tested <b>' + step.counters.keys + '</b> of ' + RACE_WORDS.length + ' keys · matches so far <b>' + step.matches + '</b>'
          : 'Answer <b class="tr-big">' + step.hashCount + '</b> after testing all ' + RACE_WORDS.length + ' keys';
        trieRes.innerHTML = step.trieCount === null
          ? (step.tick === 0 ? 'Ready at the root' : 'Walked <b>' + step.counters.nodes + '</b> node' + (step.counters.nodes === 1 ? '' : 's') + ' so far')
          : 'Answer <b class="tr-big">' + step.trieCount + '</b> after visiting ' + step.counters.nodes + ' node' + (step.counters.nodes === 1 ? '' : 's');
      }
    });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Count the words that start with (1 to 4 letters)', value: 'te', placeholder: 'e.g. te', applyLabel: 'Race',
      parse: L.parseAdapter(T.parseWord, { maxLen: 4 }),
      presets: [{ label: 'te', value: 'te' }, { label: 'ca', value: 'ca' }, { label: 'do', value: 'do' }, { label: 'tea', value: 'tea' }, { label: 'x (none)', value: 'x' }],
      onApply: function (p) {
        state.prefix = p;
        var s = steps(p);
        view.reset(); view.prepare(s.map(function (x) { return x.tree; }));
        player.setSteps(s);
        player.play();
      }
    });
  }

  /* ================================================================== growth chart */
  function growth() {
    var fig = V.$('#fig-growth');
    if (!fig) return;
    var dict = T.shuffled(T.DICTIONARY, 4), rnd = T.randomLike(dict, 6);
    var N = dict.length, gd = T.growth(dict), gr = T.growth(rnd);
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'muted', shape: 'dash', label: 'Letters typed (no sharing)', color: 'var(--ink-3)' },
      { state: 'path', shape: 'line', label: 'Trie, random strings' },
      { state: 'done', shape: 'line', label: 'Trie, English words' },
      { state: 'active', shape: 'line', label: 'Radix tree, English words' }
    ]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 320, label: 'Letter nodes created as words are inserted: letters typed, random strings, English words and a radix tree' });
    function pts(a) { return a.map(function (v, i) { return [i, v]; }); }
    var series = [
      { id: 'letters', label: 'letters typed', points: pts(gd.letters), state: 'muted', dashed: true, markers: false },
      { id: 'random', label: 'random strings', points: pts(gr.nodes), state: 'path', markers: false },
      { id: 'dict', label: 'English words', points: pts(gd.nodes), state: 'done', markers: false },
      { id: 'radix', label: 'radix tree', points: pts(gd.radix), state: 'active', markers: false }
    ];
    var stats = V.stats(fig.querySelector('[data-stats]'), {
      labels: { words: 'Words inserted', letters: 'Letters typed', dict: 'Trie nodes (English)', rnd: 'Trie nodes (random)', radix: 'Radix nodes', saved: 'Saved by sharing' },
      states: { dict: 'done', rnd: 'path', radix: 'active' }
    });
    var n = 40;
    function show(dur) {
      chart.render({
        x: { label: 'words inserted', min: 0, max: N }, y: { label: 'letter nodes (root not counted)', min: 0, max: gd.letters[N] },
        series: series,
        highlight: [{ series: 'dict', x: n, label: gd.nodes[n] + '' }, { series: 'letters', x: n, label: gd.letters[n] + '' }]
      }, { duration: dur });
      stats.update({ words: n, letters: gd.letters[n], dict: gd.nodes[n], rnd: gr.nodes[n], radix: gd.radix[n], saved: Math.round((1 - gd.nodes[n] / gd.letters[n]) * 100) + '%' });
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Words inserted', min: 1, max: N, value: n, onInput: function (v) { n = v; show(120); } });
    lazy(fig, function () { show(700); });
  }

  /* ================================================================== radix compression */
  var RADIX_PRESETS = {
    roman: ['romane', 'romanus', 'romulus', 'rubens', 'ruber', 'rubicon', 'rubicundus'],
    play: ['play', 'played', 'player', 'plan', 'plant', 'planet'],
    cars: ['car', 'card', 'care', 'careful', 'cat', 'dog'],
    few: ['owl', 'ant', 'eel', 'yak']
  };
  function radix() {
    var fig = V.$('#fig-radix');
    if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'Node just merged' }, { state: 'found', shape: 'ring', label: 'Word ends here (✓)' }, { state: 'default', shape: 'dot', label: 'Node (label = letters)' }]);
    var view = L.treeView(fig.querySelector('[data-stage]'), { nodeSize: 34, minNodeSize: 15, label: 'A trie folding into a radix tree' });
    var words = RADIX_PRESETS.roman;
    var first = T.compressSteps(words);
    view.prepare(first.map(function (s) { return s.tree; }));
    var player = V.player({
      root: fig, steps: first, baseStepMs: 1100, animMs: 720, label: 'Radix compression controls',
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { nodes: 'Nodes now', saved: 'Nodes saved', letters: 'Letters stored' },
      counterStates: { nodes: 'frontier', saved: 'done' },
      render: function (step, ctx) { view.render(step.tree, { duration: ctx.duration }); }
    });
    L.centerScroll(fig.querySelector('[data-stage]'));
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Words (up to 10, a to z)', value: words, placeholder: 'e.g. car, card, cat', applyLabel: 'Compress',
      parse: L.parseAdapter(T.parseWords, { minCount: 1, maxCount: 10 }),
      presets: [
        { label: 'romane · romanus · rubens …', value: RADIX_PRESETS.roman },
        { label: 'play · plan family', value: RADIX_PRESETS.play },
        { label: 'car · card · careful …', value: RADIX_PRESETS.cars },
        { label: 'Little sharing', value: RADIX_PRESETS.few }
      ],
      onApply: function (w) {
        var s = T.compressSteps(w);
        view.reset(); view.prepare(s.map(function (x) { return x.tree; }));
        player.setSteps(s);
      }
    });
  }

  /* ================================================================== longest-prefix routing */
  var LPM_CODE = {
    pseudo: [
      'lookup(address)',
      '  node ← root; best ← root.hop            // @init',
      '  for each bit b of address               // @loop',
      '    node ← node.child[b]                  // @follow',
      '    if node is null: stop                 // @stop',
      '    if node has a route: best ← node.hop  // @update',
      '  return best                             // @ret'
    ].join('\n'),
    js: [
      'function lookup(root, bits) {',
      '  let node = root, best = root.hop;        // @init',
      '  for (const b of bits) {                  // @loop',
      '    node = node.children[b];               // @follow',
      '    if (!node) break;                      // @stop',
      '    if (node.hop) best = node.hop;         // @update',
      '  }',
      '  return best;                             // @ret',
      '}'
    ].join('\n'),
    py: [
      'def lookup(root, bits):',
      '    node, best = root, root.hop          # @init',
      '    for b in bits:                       # @loop',
      '        node = node.children.get(b)      # @follow',
      '        if node is None: break           # @stop',
      '        if node.hop: best = node.hop     # @update',
      '    return best                          # @ret'
    ].join('\n')
  };

  function routing() {
    var fig = V.$('#fig-lpm');
    if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'path', label: 'Path walked' },
      { state: 'active', label: 'Current node' },
      { state: 'found', label: 'Longest route so far' },
      { state: 'error', label: 'No child: walk ends' },
      { state: 'visited', label: 'Bit already read' }
    ]);
    var view = L.treeView(fig.querySelector('[data-stage]'), { nodeSize: 36, minNodeSize: 16, label: 'Binary trie of routing prefixes' });
    var bitsView = V.views.array(fig.querySelector('[data-bits]'), { mode: 'boxes', cellSize: 34, showIndices: true, outerPointers: false, label: 'Address bits' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: LPM_CODE, default: 'pseudo', maxHeight: 260 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { bit: 'compare', node: 'active', best: 'found' } });

    var table = h('table', { class: 'table table--compact tr-routes__table' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Prefix'), h('th', { scope: 'col' }, 'Next hop'))),
      h('tbody', {}, T.ROUTES.map(function (r) {
        return h('tr', { 'data-hop': r[1] }, h('td', {}, h('code', {}, r[0] ? r[0] + '*' : '(default)')), h('td', {}, r[1]));
      })));
    fig.querySelector('[data-routes]').appendChild(h('div', { class: 'table-wrap' }, table));
    function markRoute(prefix) {
      V.$$('tr[data-hop]', table).forEach(function (tr, k) { tr.classList.toggle('is-best', prefix !== null && T.ROUTES[k][0] === prefix); });
    }

    var addr = '10111001';
    var first = T.lpmSteps(T.ROUTES, addr);
    view.prepare(first.map(function (s) { return s.tree; }));
    var player = V.player({
      root: fig, steps: first, baseStepMs: 950, animMs: 600, label: 'Routing lookup controls',
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { read: 'Bits read', bestLen: 'Best prefix length' }, counterStates: { read: 'visited', bestLen: 'found' },
      render: function (step, ctx) {
        view.render(step.tree, { duration: ctx.duration });
        bitsView.render(step.bits, { duration: ctx.duration });
        markRoute(step.kind === 'result' ? step.bestPrefix : null);
      }
    });
    player.addCheckpoint(
      function (steps) {
        var seen = [];
        steps.forEach(function (s) { if (s.bestPrefix !== null && seen.indexOf(s.bestPrefix) === -1) seen.push(s.bestPrefix); });
        return seen.length >= 2 ? steps.length - 1 : -1;
      },
      function (c) {
        var seen = [];
        c.steps.forEach(function (s) { if (s.bestPrefix !== null && seen.indexOf(s.bestPrefix) === -1) seen.push(s.bestPrefix); });
        var hops = {}; T.ROUTES.forEach(function (r) { hops[r[0]] = r[1]; });
        return {
          question: 'The walk along <code>' + c.step.vars.bit + '</code> has ended. Several routes matched the address on the way. Which one does the router use?',
          options: seen.map(function (p) { return (p ? '<code>' + p + '*</code>' : 'the default route') + ' → ' + hops[p]; }),
          answer: seen.length - 1,
          explain: seen.map(function (p, k) {
            return k === seen.length - 1 ? 'Right: the last route remembered is the longest match. More matching bits means a more specific route, and the most specific one wins.'
              : 'That route matches too, but a longer one matched later along the same walk. Longest prefix wins, not the first match.';
          })
        };
      },
      { id: 'tries-lpm-winner' });
    L.centerScroll(fig.querySelector('[data-stage]'));
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Destination address (1 to 8 bits)', value: addr, placeholder: 'e.g. 10111001', applyLabel: 'Look up',
      parse: L.parseAdapter(T.parseBits, { max: 8 }),
      presets: [
        { label: '10111001', value: '10111001' }, { label: '10100101', value: '10100101' }, { label: '11010000', value: '11010000' },
        { label: '00100000', value: '00100000' }, { label: '11110000 (default)', value: '11110000' }
      ],
      onApply: function (bits) {
        var s = T.lpmSteps(T.ROUTES, bits);
        view.reset(); view.prepare(s.map(function (x) { return x.tree; }));
        bitsView.reset();
        player.setSteps(s);
        player.play();
      }
    });
  }

  /* ================================================================== decision diagram */
  var DECISION = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Prefix queries?', col: 2, row: 0, maxWidth: 150 },
      { id: 'q2', type: 'decision', text: 'Set never changes?', col: 1, row: 1, maxWidth: 150 },
      { id: 'q4', type: 'decision', text: 'Need order or ranges?', col: 3, row: 1, maxWidth: 150 },
      { id: 'sortedA', type: 'end', text: 'Sorted array + binary search', col: 0, row: 2, maxWidth: 140 },
      { id: 'q3', type: 'decision', text: 'Memory tight?', col: 2, row: 2, maxWidth: 140 },
      { id: 'radix', type: 'end', text: 'Radix tree', col: 1, row: 3, maxWidth: 130 },
      { id: 'trie', type: 'end', text: 'Plain trie', col: 2, row: 3, maxWidth: 130 },
      { id: 'q5', type: 'decision', text: 'Data changes a lot?', col: 3, row: 2, maxWidth: 140 },
      { id: 'hash', type: 'end', text: 'Hash map / set', col: 4, row: 2, maxWidth: 130 },
      { id: 'bst', type: 'end', text: 'Balanced tree', col: 3, row: 3, maxWidth: 130 },
      { id: 'sortedB', type: 'end', text: 'Sorted array', col: 4, row: 3, maxWidth: 130 }
    ],
    edges: [
      { from: 'q1', to: 'q2', label: 'yes' }, { from: 'q1', to: 'q4', label: 'no' },
      { from: 'q2', to: 'sortedA', label: 'yes' }, { from: 'q2', to: 'q3', label: 'no' },
      { from: 'q3', to: 'radix', label: 'yes' }, { from: 'q3', to: 'trie', label: 'no' },
      { from: 'q4', to: 'q5', label: 'yes' }, { from: 'q4', to: 'hash', label: 'no' },
      { from: 'q5', to: 'bst', label: 'yes' }, { from: 'q5', to: 'sortedB', label: 'no' }
    ]
  };
  var VERDICTS = {
    sortedA: ['Sorted array + binary search', 'The set is fixed, so a sorted array holds it in the least memory. Two binary searches find the first and last word with the prefix in O(L log n), and everything between them is the answer.'],
    radix: ['Radix (compressed) tree', 'Prefix queries on changing data, with memory to watch. Folding single-child chains leaves one node per word end or fork: fewer than 2n nodes for n words.'],
    trie: ['Plain trie', 'Prefix queries on changing data, with short words or a small alphabet. One hop per letter, no rebuilding, and the simplest code. Use hash-map children if the alphabet is large.'],
    hash: ['Hash map or hash set', 'Only exact questions: is this key here, what is its value? O(L) on average, compact and cache friendly. A trie would cost you memory and buy you nothing.'],
    bst: ['Balanced tree (sorted map)', 'Order and ranges on data that keeps changing: O(log n) comparisons per operation, and an in-order walk lists any range of keys.'],
    sortedB: ['Sorted array', 'Ordered questions on data that rarely changes: binary search plus a contiguous scan for ranges. Inserts shift many elements, so batch them or rebuild.']
  };
  function decision() {
    var fig = V.$('#fig-decide');
    if (!fig) return;
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Current question' }, { state: 'path', label: 'Your answers' }, { state: 'found', label: 'Recommendation' }]);
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), DECISION, { interactive: true, label: 'Trie, hash map or sorted array decision diagram' });
    var verdict = fig.querySelector('[data-verdict]');
    var path, taken, stage = fig.querySelector('[data-stage]');
    /* the chart is wider than a phone: keep the current question in view */
    function followActive(id) {
      setTimeout(function () {
        var nodes = V.$$('.vz-flow-node', stage), target = null;
        nodes.forEach(function (n) { if (n.classList.contains('is-active') || n.classList.contains('is-found')) target = n; });
        if (!target || stage.scrollWidth <= stage.clientWidth + 1) return;
        var a = target.getBoundingClientRect(), b = stage.getBoundingClientRect();
        stage.scrollTo({ left: stage.scrollLeft + (a.left + a.width / 2) - (b.left + b.width / 2), behavior: V.reducedMotion() ? 'auto' : 'smooth' });
      }, 60);
      void id;
    }
    function reset() {
      path = ['q1']; taken = {};
      view.render({ active: 'q1' }, { duration: 300 });
      verdict.innerHTML = '<p class="tr-verdict__hint">Click <b>yes</b> or <b>no</b> on the arrows leaving the highlighted question.</p>';
      followActive('q1');
    }
    view.on('choose', function (e) {
      path.push(e.to); taken[e.node + '->' + e.to] = 'path';
      var leaf = VERDICTS[e.to];
      view.render({ active: e.to, visited: path.slice(0, -1), edgeStates: taken, states: leaf ? (function () { var o = {}; o[e.to] = 'found'; return o; }()) : undefined }, { duration: 500 });
      followActive(e.to);
      if (leaf) verdict.innerHTML = '<p class="tr-verdict__title">Use: <b>' + leaf[0] + '</b></p><p>' + leaf[1] + '</p>';
      else verdict.innerHTML = '<p class="tr-verdict__hint">Next question. Keep clicking answers.</p>';
    });
    fig.querySelector('[data-restart]').addEventListener('click', reset);
    reset();
  }

  V.ready(function () {
    autocomplete();
    race();
    growth();
    radix();
    routing();
    decision();
  });
}());
