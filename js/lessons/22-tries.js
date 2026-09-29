/* Lesson 22 · Tries — page wiring: shared helpers (V.lesson22), hero teaser, problem scan, merge morph, node anatomy,
   word-or-prefix click quiz, variations, checks and the summary card. The lab and flowchart live in
   22-tries-lab.js; autocomplete, race, growth chart, radix, routing and the decision diagram in 22-tries-figs.js.
   Load order matters: this file defines V.lesson22 for the other two. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, T = V.algos.tries;
  var L = V.lesson22 = { T: T };

  /* ================================================================== shared helpers */
  L.STATE_LABELS = { path: 'Path walked', active: 'Current node', frontier: 'New node', found: 'Word found / best', error: 'Dead end / cut', visited: 'Below the prefix' };

  /* miniTrie(words, opts) -> <svg> : a static picture of a trie (no view): minis, summary tiles, click quizzes.
     opts: {states: {prefix: state}, ids, freqs, badge: fn(prefix, node) -> text, dx, dy, r, label}
     Word ends get a ring (.tr-ring); toggling class is-end on svg.nodes[prefix] animates it. */
  L.miniTrie = function (words, o) {
    o = Object.assign({ dx: 44, dy: 46, r: 14, ids: false, states: {}, label: 'Trie', badge: null, freqs: null }, o || {});
    var pad = o.r + 10;
    var t = T.build(words, o.freqs), lay = T.layoutTrie(t);
    var W = Math.round((lay.width - 1) * o.dx + 2 * pad), H = Math.round(lay.depth * o.dy + 2 * pad);
    var svg = s('svg', { class: 'tr-mini', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': o.label });
    var edges = s('g', { class: 'tr-edges' }), nodes = s('g', { class: 'tr-nodes' });
    svg.appendChild(edges); svg.appendChild(nodes);
    var pos = function (n) { var p = lay.pos[n.id]; return { x: pad + p.x * o.dx, y: pad + p.depth * o.dy }; };
    svg.nodes = {};
    (function rec(n, parent) {
      var p = pos(n), st = o.states[n.prefix] || 'default';
      if (parent) {
        var q = pos(parent), pst = o.states[parent.prefix];
        var on = st !== 'default' && (pst === 'path' || pst === 'active' || parent.prefix === '');
        edges.appendChild(s('line', { class: 'tr-edge' + (on && st !== 'visited' ? ' is-path' : ''), x1: q.x, y1: q.y, x2: p.x, y2: p.y }));
      }
      var g = s('g', { class: 'tr-node is-' + st + (n.end ? ' is-end' : '') + (n.prefix ? '' : ' is-root'), transform: 'translate(' + p.x + ' ' + p.y + ')' });
      if (o.ids && n.prefix) { g.setAttribute('data-id', n.prefix); g.setAttribute('data-label', 'node ' + n.prefix); }
      g.appendChild(s('circle', { class: 'tr-ring', r: o.r + 4 }));
      g.appendChild(s('circle', { class: 'tr-c', r: n.prefix ? o.r : o.r - 3 }));
      g.appendChild(s('text', { class: 'tr-t' + (n.prefix ? '' : ' tr-t--root') }, n.prefix ? n.ch : 'root'));
      if (o.badge) {
        var b = o.badge(n.prefix, n);
        if (b !== undefined && b !== null && b !== '') {
          var w = 8 + String(b).length * 6.4;
          g.appendChild(s('g', { class: 'tr-badge', transform: 'translate(' + (o.r * 0.8) + ' ' + (-o.r * 0.9) + ')' },
            s('rect', { x: -w / 2, y: -8, width: w, height: 16, rx: 8 }), s('text', {}, String(b))));
        }
      }
      nodes.appendChild(g); svg.nodes[n.prefix] = g;
      T.sortedKids(n).forEach(function (k) { rec(k, n); });
    }(t.root, null));
    svg.trie = t;
    return svg;
  };

  /* small labelled arrow between two miniature figures */
  L.arrowSvg = function () {
    return s('svg', { class: 'tr-arrow', viewBox: '0 0 40 20', width: 40, height: 20, 'aria-hidden': 'true' },
      s('path', { d: 'M4 10 H32 M26 4 L34 10 L26 16', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  };

  /* wide stages scroll on phones and start at the left; the root of a tree sits in the middle, so centre them */
  L.centerScroll = function (stage) {
    function go() { if (stage.scrollWidth > stage.clientWidth + 1) stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2; }
    requestAnimationFrame(go); setTimeout(go, 200);
  };

  /* a tree view configured the same way everywhere */
  L.treeView = function (host, o) {
    return V.views.tree(host, Object.assign({ nodeSize: 38, minNodeSize: 15, label: 'Trie' }, o || {}));
  };
  L.STATES = ['path', 'active', 'frontier', 'found', 'error'];

  /* text field that parses with a T.parse* function and runs a callback; hands back the inputRow */
  L.parseAdapter = function (fn, opts) {
    return function (text) { var r = fn(text, opts); return { values: r.values !== undefined ? r.values : r.value, error: r.error }; };
  };

  /* ================================================================== 1. hero teaser */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var words = ['tea', 'team', 'ten', 'tap', 'to'], cur = [], steps = [];
    words.forEach(function (w, i) {
      var r = T.opTrace(cur, 'insert', w, { brief: i > 0 });
      steps = steps.concat(r.steps);
      cur = r.words;
    });
    var view = L.treeView(stage, { nodeSize: 34, label: 'A trie growing as words are inserted' });
    view.prepare(steps.map(function (st) { return st.tree; }));
    V.teaser(stage, {
      steps: steps,
      render: function (step, ctx) { view.render(step.tree, { duration: ctx.duration }); },
      stepMs: 520, holdMs: 2000, instantWrap: false, staticIndex: steps.length - 1
    });
  }

  /* ================================================================== 2. problem: the scan */
  var SCAN_WORDS = ['cab', 'can', 'cap', 'car', 'card', 'care', 'cart', 'cat', 'dog', 'dot', 'done', 'door', 'sea', 'seat', 'see', 'tea', 'team', 'ten', 'tent', 'the'];
  function problemFigure() {
    var fig = V.$('#fig-problem');
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'compare', label: 'Being checked' },
      { state: 'found', label: 'Starts with the prefix' },
      { state: 'visited', label: 'Checked, no match' }
    ]);
    var stage = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    var chips = SCAN_WORDS.map(function (w) { return h('span', { class: 'tr-chip', 'data-w': w }, w); });
    stage.appendChild(h('div', { class: 'tr-chips', role: 'list', 'aria-label': 'Twenty words' }, chips));
    var token = 0, timer = null;
    function paint(el, cls) { el.className = 'tr-chip' + (cls ? ' is-' + cls : ''); }
    function run(prefix) {
      token++; var mine = token; clearTimeout(timer);
      chips.forEach(function (c) { paint(c, ''); });
      var matches = 0, i = 0;
      function hit(k) { return SCAN_WORDS[k].indexOf(prefix) === 0; }
      function step() {
        if (mine !== token) return;
        if (i > 0) paint(chips[i - 1], hit(i - 1) ? 'found' : 'visited');
        if (i >= chips.length) {
          cap.innerHTML = 'Checked <b>all ' + SCAN_WORDS.length + '</b> words; <b>' + matches + '</b> start with <code>' + V.escape(prefix) + '</code>. The set had no way to skip even one, because it does not know which words share a start.';
          return;
        }
        if (hit(i)) matches++;
        paint(chips[i], 'compare');
        cap.innerHTML = 'Checking <code>' + SCAN_WORDS[i] + '</code>: does it start with <code>' + V.escape(prefix) + '</code>? ' + (hit(i) ? 'Yes.' : 'No.') + ' Words checked: <b>' + (i + 1) + '</b> of ' + SCAN_WORDS.length + '.';
        i++;
        if (V.reducedMotion()) step(); else timer = setTimeout(step, 70);
      }
      step();
    }
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Prefix to look for', value: 'ca', placeholder: 'e.g. ca', applyLabel: 'Scan',
      parse: L.parseAdapter(T.parseWord, { maxLen: 4 }),
      presets: [{ label: 'ca', value: 'ca' }, { label: 'te', value: 'te' }, { label: 'do', value: 'do' }, { label: 'x', value: 'x' }],
      onApply: run
    });
    var started = false;
    V.onVisible(fig, function (vis) { if (vis && !started) { started = true; run('ca'); } });
  }

  /* ================================================================== 3. intuition: merge shared starts */
  function mergeFigure() {
    var fig = V.$('#fig-merge');
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'visited', label: 'Prefix shared with another word' },
      { state: 'default', label: 'Only this word has it' },
      { state: 'path', label: 'Merged node' },
      { state: 'found', shape: 'ring', label: 'Word ends here' }
    ]);
    var WORDS = ['car', 'card', 'care', 'cat', 'dog'];
    var t = T.build(WORDS), lay = T.layoutTrie(t);
    var W = 420, H = 320, TS = 34;
    var stage = fig.querySelector('[data-stage]');
    var svg = s('svg', { class: 'tr-fig tr-merge', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Five words as rows of letter tiles that merge into a trie' });
    svg.style.maxWidth = '540px';
    var edgesG = s('g'), tilesG = s('g'), headG = s('g');
    svg.appendChild(edgesG); svg.appendChild(tilesG); svg.appendChild(headG);
    var count = s('text', { class: 'tr-merge__count', x: 16, y: 26 }, '');
    headG.appendChild(count);
    function rowPos(r, j) { return { x: W / 2 + (j - 1.5) * (TS + 8), y: 60 + r * 52 }; }
    function treePos(prefix) { var p = lay.pos['p:' + prefix]; return { x: W / 2 + (p.x - (lay.width - 1) / 2) * 84, y: 52 + p.depth * 58 }; }
    var first = {}, tiles = [];
    WORDS.forEach(function (w, r) {
      w.split('').forEach(function (ch, j) {
        var prefix = w.slice(0, j + 1), node = T.find(t, prefix);
        var g = s('g', { class: 'tr-tile' });
        var ring = s('rect', { class: 'tr-tile__ring', x: -TS / 2 - 4, y: -TS / 2 - 4, width: TS + 8, height: TS + 8, rx: 12 });
        var rect = s('rect', { class: 'tr-tile__box', x: -TS / 2, y: -TS / 2, width: TS, height: TS, rx: 8 });
        g.appendChild(ring); g.appendChild(rect); g.appendChild(s('text', { class: 'tr-tile__t' }, ch));
        tilesG.appendChild(g);
        var rec = { g: g, rect: rect, ring: ring, r: r, j: j, prefix: prefix, shared: node.cnt >= 2, end: node.end && j === w.length - 1, dup: !!first[prefix] };
        if (!first[prefix]) first[prefix] = rec;
        V.place(g, rowPos(r, j));
        tiles.push(rec);
      });
    });
    var edgeEls = [];
    (function rec(n) {
      T.sortedKids(n).forEach(function (k) {
        var e = s('line', { class: 'tr-edge', x1: 0, y1: 0, x2: 0, y2: 0 });
        e.style.opacity = 0; edgesG.appendChild(e);
        edgeEls.push({ e: e, a: n.prefix, b: k.prefix, root: n.prefix === '' });
        rec(k);
      });
    }(t.root));
    var rootG = s('g', { class: 'tr-tile tr-tile--root' }, s('rect', { class: 'tr-tile__box', x: -22, y: -15, width: 44, height: 30, rx: 15 }), s('text', { class: 'tr-tile__t tr-tile__t--sm' }, 'root'));
    tilesG.appendChild(rootG);
    var rp = { x: W / 2 + ((lay.pos['p:'].x) - (lay.width - 1) / 2) * 84, y: 52 };
    V.place(rootG, rp); rootG.style.opacity = 0;
    stage.appendChild(svg);
    var letters = WORDS.join('').length;

    function render(step, ctx) {
      var d = ctx.duration, mode = step.mode;
      tiles.forEach(function (tl) {
        var to = mode === 2 ? treePos(tl.prefix) : rowPos(tl.r, tl.j);
        V.animate(tl.g, { x: to.x, y: to.y, opacity: mode === 2 && tl.dup ? 0 : 1 }, { duration: d, ease: 'inOut', delay: 0 });
        tl.g.setAttribute('class', 'tr-tile' + (mode >= 1 && tl.shared ? ' is-shared' : '') + (mode === 2 ? ' is-node' : '') + (mode === 2 && tl.end ? ' is-end' : ''));
        V.animate(tl.rect, { attr: { rx: mode === 2 ? TS / 2 : 8 } }, { duration: d, ease: 'inOut' });
        V.animate(tl.ring, { attr: { rx: mode === 2 ? TS / 2 + 4 : 12 } }, { duration: d, ease: 'inOut' });
      });
      edgeEls.forEach(function (ed) {
        var a = ed.root ? rp : treePos(ed.a), b = treePos(ed.b);
        ed.e.setAttribute('x1', a.x); ed.e.setAttribute('y1', a.y); ed.e.setAttribute('x2', b.x); ed.e.setAttribute('y2', b.y);
        V.animate(ed.e, { opacity: mode === 2 ? 1 : 0 }, { duration: d, delay: mode === 2 ? d * 0.6 : 0 });
      });
      V.animate(rootG, { opacity: mode === 2 ? 1 : 0 }, { duration: d, delay: mode === 2 ? d * 0.6 : 0 });
      count.textContent = mode === 2 ? '9 nodes, 5 words' : letters + ' letters, 5 words';
    }
    V.player({
      root: fig, baseStepMs: 2600, animMs: 1100, label: 'Merge shared prefixes',
      steps: [
        { mode: 0, caption: 'Five words, written out: <b>' + letters + ' letters</b>. Look at the starts: four words begin with <code>c</code>, and three of those begin with <code>car</code>.' },
        { mode: 1, caption: 'Tint every tile whose whole prefix another word also has. <code>c</code> and <code>ca</code> appear four times, <code>car</code> three times: the same work, repeated.' },
        { mode: 2, caption: 'Slide identical prefixes together. The words now share one path of <code>c</code>, <code>a</code>, <code>r</code>, then fork where they differ. <b>' + letters + ' letters became 9 nodes.</b> The green rings mark where a word ends.' }
      ],
      render: render, caption: fig.querySelector('[data-caption]')
    });
  }

  /* ================================================================== 4. anatomy: flag + children table */
  function anatomyFigure() {
    var fig = V.$('#fig-anatomy');
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'found', shape: 'ring', label: 'Word ends here' },
      { state: 'active', shape: 'dot', label: 'Node “ca”' }
    ]);
    var stage = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    var svg = L.miniTrie(['car', 'cat'], { states: { ca: 'active' }, dx: 70, dy: 52, r: 17, label: 'Trie of car and cat; node ca can be flagged as a word end' });
    stage.appendChild(svg);
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { used: 'Slots used', memory: 'Memory per node', lookup: 'Find a child' } });
    var flagged = false, mode = 'array';
    function words() { return flagged ? 'ca, car, cat' : 'car, cat'; }
    var LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
    var store = fig.querySelector('[data-store]');
    var INFO = {
      array: { used: '2 of 26', memory: '26 pointers', lookup: '1 read: slot[letter]', text: 'An array with one slot per letter: the child for <code>r</code> is slot 17 (counting <code>a</code> as slot 0), found with one read. Fast, but 24 of the 26 slots stay empty, for every node.' },
      map: { used: '2 of 2', memory: '2 entries + table', lookup: '1 hash, O(1) on average', text: 'A hash map from letter to child holds only the letters that exist. It costs a little per entry, but nothing for letters that never occur. It is the default for large alphabets.' },
      list: { used: '2 of 2', memory: '2 entries', lookup: 'scan or binary search', text: 'A short sorted list of (letter, child) pairs: the smallest memory, and reading it in order gives the children alphabetically. Searching costs up to k comparisons for k children.' }
    };
    function drawStore() {
      V.clear(store);
      var body;
      if (mode === 'array') {
        body = h('div', { class: 'tr-slots', role: 'img', 'aria-label': 'Array of 26 child slots; slots r and t are used' },
          LETTERS.map(function (c) { var used = c === 'r' || c === 't'; return h('span', { class: 'tr-slot' + (used ? ' is-used' : '') }, h('i', {}, c), used ? h('b', {}, '●') : null); }));
      } else if (mode === 'map') {
        body = h('div', { class: 'tr-map', role: 'img', 'aria-label': 'Hash map with entries r and t' },
          [['r', 'car'], ['t', 'cat']].map(function (p) { return h('div', { class: 'tr-map__row' }, h('span', { class: 'tr-map__k' }, p[0]), h('span', { class: 'tr-map__a' }, '→'), h('span', { class: 'tr-map__v' }, 'node “' + p[1] + '”')); }));
      } else {
        body = h('div', { class: 'tr-list', role: 'img', 'aria-label': 'Sorted list with entries r and t' },
          [['r', 'car'], ['t', 'cat']].map(function (p, k) { return h('span', { class: 'tr-list__item' }, h('i', {}, k), h('b', {}, p[0]), h('span', {}, '→ “' + p[1] + '”')); }));
      }
      store.appendChild(h('div', { class: 'tr-store__card' },
        h('p', { class: 'tr-store__head' }, 'children of node “ca”', h('span', { class: 'tr-store__flag' + (flagged ? ' is-on' : '') }, 'isEnd = ' + flagged)),
        body));
      stats.update({ used: INFO[mode].used, memory: INFO[mode].memory, lookup: INFO[mode].lookup });
      cap.innerHTML = 'Words stored: <code>' + words() + '</code>. ' + INFO[mode].text;
    }
    V.toggle(fig.querySelector('[data-toggle]'), {
      label: 'Flag the node “ca” as a word end', checked: false,
      onChange: function (on) {
        flagged = on;
        svg.nodes['ca'].classList.toggle('is-end', on);
        var f = store.querySelector('.tr-store__flag');
        if (f) { f.classList.toggle('is-on', on); f.textContent = 'isEnd = ' + on; }
        cap.innerHTML = on ? 'Now <code>ca</code> is a word: the same node, one flag changed. Searching <code>ca</code> returns true, and a prefix query for <code>ca</code> still finds <code>car</code> and <code>cat</code>. Words stored: <code>' + words() + '</code>.'
          : 'Without the flag, <code>ca</code> is only a prefix: searching it returns false, yet it is still on the path to <code>car</code> and <code>cat</code>. Words stored: <code>' + words() + '</code>.';
      }
    });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'How the children are stored', value: mode,
      options: [{ value: 'array', label: 'Array of 26' }, { value: 'map', label: 'Hash map' }, { value: 'list', label: 'Sorted list' }],
      onChange: function (v) { mode = v; drawStore(); }
    });
    drawStore();
  }

  /* ================================================================== 4b. word or prefix (click quiz) */
  function wordPrefixFigure() {
    var fig = V.$('#fig-wp');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'found', shape: 'ring', label: 'Word ends here' }, { state: 'default', shape: 'dot', label: 'Only a prefix' }]);
    var words = ['car', 'card', 'care', 'cat', 'dog'];
    var stage = fig.querySelector('[data-stage]');
    var svg = L.miniTrie(words, { ids: true, dx: 72, dy: 54, r: 18, label: 'Trie of car, card, care, cat and dog' });
    stage.appendChild(svg);
    V.clickQuiz(stage, {
      el: '#quiz-wp', id: 'tries-click-prefix',
      question: 'Click a node that is <em>only a prefix</em>: on the path to words, but not a word itself.',
      check: function (id) {
        if (words.indexOf(id) === -1) return { correct: true, message: '<code>' + id + '</code> has no green ring: no stored word ends there, but words continue below it. It is a prefix, and searching for it returns false.' };
        if (id === 'car') return { correct: false, message: '<code>car</code> has a green ring, so it is a word, even though <code>card</code> and <code>care</code> hang below it. A word can also be a prefix. Look for a node with no ring.' };
        return { correct: false, message: '<code>' + id + '</code> ends a word: it has the green ring. Look for a node without one.' };
      }
    });
  }

  /* ================================================================== 11. variations */
  function boggleMini() {
    var cell = 44, rows = ['cat', 'xrd', 'oge'];
    var svg = s('svg', { class: 'tr-mini tr-grid', viewBox: '0 0 ' + (cell * 3 + 20) + ' ' + (cell * 3 + 20), width: cell * 3 + 20, height: cell * 3 + 20, role: 'img', 'aria-label': 'A three by three letter grid; the path c, a, r, e is lit and the neighbour x is crossed out because no word starts with cx' });
    var path = [[0, 0], [0, 1], [1, 1], [2, 2]];
    function P(r, c) { return { x: 10 + c * cell + cell / 2, y: 10 + r * cell + cell / 2 }; }
    var pts = path.map(function (p) { var q = P(p[0], p[1]); return q.x + ',' + q.y; }).join(' ');
    svg.appendChild(s('polyline', { class: 'tr-grid__path', points: pts }));
    rows.forEach(function (row, r) {
      row.split('').forEach(function (ch, c) {
        var on = path.some(function (p) { return p[0] === r && p[1] === c; }), pruned = r === 1 && c === 0;
        var q = P(r, c);
        var g = s('g', { class: 'tr-node ' + (on ? 'is-path' : pruned ? 'is-error' : 'is-default'), transform: 'translate(' + q.x + ' ' + q.y + ')' });
        g.appendChild(s('circle', { class: 'tr-c', r: 16 })); g.appendChild(s('text', { class: 'tr-t' }, ch));
        svg.appendChild(g);
      });
    });
    var a = P(0, 0), b = P(1, 0);
    svg.appendChild(s('line', { class: 'tr-grid__cut', x1: a.x, y1: a.y + 16, x2: b.x, y2: b.y - 16 }));
    return svg;
  }
  function variations() {
    if (!V.$('#variants')) return;
    V.tabs('#variants');
    var W = ['car', 'card', 'care', 'cat', 'dog'];
    var minis = {
      count: L.miniTrie(W, { dx: 40, dy: 42, r: 13, states: { c: 'path', ca: 'active' }, badge: function (p, n) { return p ? n.cnt : ''; }, label: 'Trie with a word counter in every node: ca has 4' }),
      dfs: (function () {
        var st = { c: 'path', ca: 'active', car: 'visited', card: 'found', care: 'found', cat: 'found' };
        return L.miniTrie(W, { dx: 40, dy: 42, r: 13, states: st, label: 'Autocomplete for ca: walk to the node ca, then read the subtree below it' });
      }()),
      grid: boggleMini(),
      root: L.miniTrie(['cat', 'bat', 'rat'], { dx: 46, dy: 42, r: 13, states: { c: 'path', ca: 'path', cat: 'found' }, label: 'Roots cat, bat and rat; the word cattle stops at the first flagged node, cat' })
    };
    var blocks = {
      count: 'function insert(root, word) {\n  let node = root;\n  for (const ch of word) {\n    if (!node.children.has(ch)) node.children.set(ch, new TrieNode());\n    node = node.children.get(ch);\n    node.count++;                 // one more word passes through\n  }\n  node.isEnd = true;\n}\n\nfunction countPrefix(root, prefix) {\n  let node = root;\n  for (const ch of prefix) {\n    node = node.children.get(ch);\n    if (!node) return 0;\n  }\n  return node.count;              // O(L), whatever n is\n}',
      dfs: 'function complete(root, prefix) {\n  let node = root;\n  for (const ch of prefix) {\n    node = node.children.get(ch);\n    if (!node) return [];\n  }\n  const out = [];\n  (function dfs(n, word) {\n    if (n.isEnd) out.push(word);\n    for (const [ch, kid] of n.children) dfs(kid, word + ch);\n  })(node, prefix);\n  return out;\n}',
      grid: 'function explore(r, c, node, path) {\n  const ch = board[r][c];\n  const next = node.children.get(ch);\n  if (!next) return;              // no word starts like this: prune\n  path += ch;\n  if (next.isEnd) found.add(path);\n  board[r][c] = "#";              // do not reuse a cell\n  for (const [dr, dc] of DIRS) {\n    const rr = r + dr, cc = c + dc;\n    if (inside(rr, cc) && board[rr][cc] !== "#") explore(rr, cc, next, path);\n  }\n  board[r][c] = ch;\n}',
      root: 'function shortestRoot(root, word) {\n  let node = root, i = 0;\n  for (const ch of word) {\n    node = node.children.get(ch);\n    if (!node) return word;       // fell off: keep the word\n    i++;\n    if (node.isEnd) return word.slice(0, i);   // first flagged node\n  }\n  return word;\n}'
    };
    Object.keys(minis).forEach(function (k) {
      V.$('[data-mini="' + k + '"]').appendChild(minis[k]);
      V.codeBlock(V.$('[data-code-block="' + k + '"]'), blocks[k], 'js');
    });
  }

  /* ================================================================== 13. checks */
  function checks() {
    V.quiz('#quiz-nodes', {
      id: 'tries-count-nodes',
      question: 'You insert <code>card</code>, <code>care</code>, <code>cart</code>, <code>cat</code> and <code>dog</code> into an empty trie. How many letter nodes does it have? (Do not count the root.)',
      options: ['10', '18', '12', '5'],
      answer: 0,
      explain: [
        'Right. <code>c</code>, <code>ca</code>, <code>car</code>, <code>card</code>, <code>care</code>, <code>cart</code> and <code>cat</code> make 7 nodes; <code>d</code>, <code>do</code> and <code>dog</code> add 3 more. Each word only costs its new letters.',
        '18 is the total number of letters in the five words. That would be the count with no sharing at all, but <code>c</code>, <code>ca</code> and <code>car</code> are shared.',
        'Close, but too many. Count distinct prefixes: <code>car</code> is shared by card, care and cart, and <code>c</code>, <code>ca</code> by four words.',
        '5 is the number of words. A word ending is a flag on a node, and every word needs its whole path of nodes.'
      ]
    });
    V.quiz('#quiz-ac', {
      id: 'tries-autocomplete',
      question: 'A trie stores <code>car</code>, <code>card</code>, <code>care</code>, <code>cart</code>, <code>cat</code>, <code>dog</code>. Which words does autocomplete return for the prefix <code>car</code>?',
      options: [
        '<code>car</code>, <code>card</code>, <code>care</code>, <code>cart</code>',
        '<code>card</code>, <code>care</code>, <code>cart</code>',
        '<code>car</code>, <code>card</code>, <code>care</code>, <code>cart</code>, <code>cat</code>',
        'Only <code>car</code>'
      ],
      answer: 0,
      explain: [
        'Right. Every word in the subtree below the node <code>car</code> starts with <code>car</code>, and the node itself is flagged, so <code>car</code> counts as its own completion.',
        'It misses <code>car</code>. The node for the prefix is flagged as a word end, so it belongs in the results too.',
        '<code>cat</code> branches off at <code>ca</code>, above the node <code>car</code>. It is not in the subtree, so it does not start with <code>car</code>.',
        'Only <code>car</code> is not enough: the search reads the whole subtree, and <code>card</code>, <code>care</code> and <code>cart</code> hang below it.'
      ]
    });
    V.quiz('#quiz-cost', {
      id: 'tries-cost',
      question: 'Which statements about tries are true?',
      options: [
        'Searching a word takes about the same number of hops whether the trie holds ten words or ten million.',
        'A trie always uses less memory than a hash set holding the same words.',
        'Counting the words with a given prefix needs no scan of the other words, when nodes store counters.',
        'Words that share a prefix share the nodes of that prefix.'
      ],
      answer: [0, 2, 3],
      explain: 'Search follows one node per letter of the word, so its length matters and the number of stored words does not. Counters inside nodes make the prefix count one read, and shared prefixes share nodes. The memory claim is false: every node carries a table of children, so a trie of random words can use far more memory than a hash set.'
    });
  }

  /* ================================================================== 14. summary */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    if (!grid) return;
    function chain() {
      var svg = s('svg', { class: 'tr-mini', viewBox: '0 0 140 40', width: 140, height: 40, role: 'img', 'aria-label': 'A chain of three nodes folded into one node labelled ana' });
      [0, 1, 2].forEach(function (k) {
        var x = 14 + k * 26;
        if (k) svg.appendChild(s('line', { class: 'tr-edge', x1: x - 26 + 10, y1: 20, x2: x - 10, y2: 20 }));
        var g = s('g', { class: 'tr-node is-default', transform: 'translate(' + x + ' 20)' });
        g.appendChild(s('circle', { class: 'tr-c', r: 10 })); g.appendChild(s('text', { class: 'tr-t tr-t--sm' }, 'ana'[k]));
        svg.appendChild(g);
      });
      svg.appendChild(s('path', { d: 'M74 20 H88 M83 15 L89 20 L83 25', fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
      svg.appendChild(s('rect', { class: 'tr-pill', x: 98, y: 8, width: 38, height: 24, rx: 12 }));
      svg.appendChild(s('text', { class: 'tr-t tr-t--pill', x: 117, y: 20 }, 'ana'));
      return svg;
    }
    var mo = { dx: 34, dy: 34, r: 12 };
    var tiles = [
      { svg: L.miniTrie(['to', 'tea'], Object.assign({ states: { t: 'path', te: 'path', tea: 'found' } }, mo)), label: 'One hop per letter', text: 'Search, insert and delete walk the letters of the query: O(L), whatever n is.' },
      { svg: L.miniTrie(['car', 'card', 'care'], Object.assign({}, mo)), label: 'Shared prefixes share nodes', text: 'Each word costs only the letters that are new.' },
      { svg: L.miniTrie(['ca', 'car'], Object.assign({ states: { ca: 'active' } }, mo)), label: 'The flag makes a word', text: 'A node can be a word and a prefix at once.' },
      { svg: L.miniTrie(['car', 'card', 'care', 'cat'], Object.assign({ states: { c: 'path', ca: 'active', car: 'visited', card: 'found', care: 'found', cat: 'found' } }, mo)), label: 'A prefix is a subtree', text: 'Walk to the prefix node, then read everything below it.' },
      { svg: chain(), label: 'Compress the chains', text: 'A radix tree keeps only word ends and forks: under 2n nodes.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid' }, t.svg),
        h('p', { class: 'summary__label' }, t.label),
        h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    heroTeaser();
    problemFigure();
    mergeFigure();
    anatomyFigure();
    wordPrefixFigure();
    variations();
    checks();
    summaryCard();
  });
}());
