/* Lesson 34 · Dynamic programming I — pure step generators (no DOM).

   Loaded in the browser as a classic script (registers VDSA.algos['34-dynamic-programming']) and in Node via
   require() for tests/algos/34-dynamic-programming.test.js.

   Contents
   - numbers:   fib, naiveCalls, memoCalls, tableAdds, stairsWays, fibTree
   - figures:   fibTrace(n, {memo})      recursion tree + memo row (plain vs memoised calls)
                collapseSteps(n, opts)    the recursion tree collapsing into a row of cached cells
                orderSteps(coins, amount) top-down (memo) vs bottom-up (table) fill order, side by side
                dagSteps(coins, target)   coin change as a shortest path in the subproblem DAG
                spaceSteps(n, keepFrom)   a full table shrinking to a sliding pair of cells
   - lab:       lab.stairs(n), lab.coinMin(coins, amount), lab.coinWays(coins, amount),
                lab.robber(houses), lab.lis(values)       table fills with arcs, recurrence, reconstruction
   - reference: plain implementations the generators are tested against
   - parse:     friendly validation for the lab inputs

   Every step is a complete snapshot (never mutated after it is pushed). Lab steps carry
   {table: {rows, arcs, cursor}, eq, caption, line, vars, counters, flow, kind}. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.VDSA) { root.VDSA.algos = root.VDSA.algos || {}; root.VDSA.algos['34-dynamic-programming'] = api; }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var INF = Infinity;
  function fmt(v) { return v === INF ? '∞' : String(v); }
  function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function range(n, s) { var out = []; for (var i = 0; i < n; i++) out.push((s || 0) + i); return out; }

  /* ================================================================== numbers */
  function fib(n) { var a = 0, b = 1; for (var i = 0; i < n; i++) { var t = a + b; a = b; b = t; } return a; }
  /* Calls made by `f(n) = n < 2 ? n : f(n-1) + f(n-2)`: C(0) = C(1) = 1, C(n) = 1 + C(n-1) + C(n-2) = 2F(n+1) - 1. */
  function naiveCalls(n) { return n < 0 ? 0 : 2 * fib(n + 1) - 1; }
  /* Calls made by the memoised version (base cases checked first, then the memo): 1 for n < 2, else 2n - 1. */
  function memoCalls(n) { return n < 0 ? 0 : n < 2 ? 1 : 2 * n - 1; }
  /* Additions made by the bottom-up loop for i = 2..n. */
  function tableAdds(n) { return Math.max(0, n - 1); }

  /* Every way to climb n stairs with hops of 1 or 2, in lexicographic order (1 before 2). */
  function stairsWays(n) {
    var out = [];
    (function go(left, path) {
      if (left === 0) { out.push(path.slice()); return; }
      [1, 2].forEach(function (h) { if (h <= left) { path.push(h); go(left - h, path); path.pop(); } });
    }(n, []));
    return out;
  }

  /* The full call tree of plain recursive fib(n), in preorder.
     nodes[i] = {id, k, parent, children, depth, pre, post, rep}; rep = how many earlier calls had the same k. */
  function fibTree(n) {
    var nodes = [], seen = {}, post = 0;
    (function call(k, parent, depth) {
      var node = { id: 'c' + nodes.length, k: k, parent: parent, children: [], depth: depth, pre: nodes.length, post: -1, rep: seen[k] || 0 };
      seen[k] = (seen[k] || 0) + 1;
      nodes.push(node);
      if (parent !== null) nodes[+parent.slice(1)].children.push(node.id);
      if (k >= 2) { call(k - 1, node.id, depth + 1); call(k - 2, node.id, depth + 1); }
      node.post = post++;
    }(n, null, 0));
    return nodes;
  }

  /* ================================================================== fibTrace: plain vs memoised calls
     Steps for a recursion tree (VDSA.views.tree) plus a row under it (VDSA.views.array).
     Plain mode: the row counts how many times each fib(k) has been asked. Memo mode: the row is memo[2..n].
     Node states: active = running, frontier = waiting on a child, visited = returned (first time for this k),
     pivot = a repeat (this k was already solved before), found = memo hit, muted = a call the memo skipped. */
  function fibTrace(n, opts) {
    opts = opts || {};
    var memoMode = !!opts.memo;
    var tree = fibTree(n);
    var byId = {}; tree.forEach(function (t) { byId[t.id] = t; });
    var vis = {};          // id -> {state, ret, badge, badgeState}
    var memo = {}, asked = {}, solved = {};
    var calls = 0, hits = 0, distinct = 0;
    var steps = [], current = null;

    function rowSnap(activeK, flash) {
      if (memoMode) {
        var items = [];
        for (var k = 2; k <= n; k++) {
          if (memo[k] === undefined) continue;
          items.push({ id: 'm' + k, value: memo[k], index: k - 2, state: flash && flash.k === k ? flash.state : 'visited' });
        }
        return { items: items, length: Math.max(0, n - 1), indexLabels: range(Math.max(0, n - 1), 2), label: 'memo',
          pointers: activeK !== null && activeK >= 2 ? [{ name: 'k', index: activeK - 2, state: flash && flash.k === activeK ? flash.state : 'active' }] : [] };
      }
      return {
        items: range(n + 1).map(function (k) {
          var c = asked[k] || 0;
          return { id: 'a' + k, value: c, state: k === activeK ? (c > 1 ? 'pivot' : 'active') : c > 1 ? 'pivot' : c === 1 ? 'visited' : 'default' };
        }),
        indexLabels: range(n + 1), label: 'times asked',
        pointers: activeK !== null ? [{ name: 'k', index: activeK, state: (asked[activeK] || 0) > 1 ? 'pivot' : 'active' }] : []
      };
    }
    function treeSnap() {
      var nodes = [];
      tree.forEach(function (t) {
        var v = vis[t.id];
        if (!v) return;
        var kids = t.children.filter(function (c) { return vis[c]; });
        var node = { id: t.id, label: String(t.k), children: kids, state: v.state };
        if (v.ret !== undefined) { node.returnValue = v.ret; node.returnState = v.state === 'pivot' ? 'pivot' : v.state === 'found' ? 'found' : 'visited'; }
        if (v.badge) { node.badge = v.badge; node.badgeState = v.badgeState || 'default'; }
        nodes.push(node);
      });
      return { root: 'c0', nodes: nodes };
    }
    function snap(kind, caption, activeK, flash, extra) {
      var s = {
        kind: kind, mode: memoMode ? 'memo' : 'plain', tree: treeSnap(), row: rowSnap(activeK, flash), caption: caption,
        counters: { calls: calls, distinct: distinct, hits: hits },
        vars: { n: current === null ? null : byId[current].k, calls: calls }
      };
      if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
      steps.push(s);
    }
    function name(k) { return '<code>fib(' + k + ')</code>'; }

    var intro = memoMode ? 'Same recursion, plus a notebook: <code>memo</code> stores each answer from fib(2) up the first time it is computed. ' : 'Plain recursion. ';

    function call(id) {
      var t = byId[id], k = t.k, parentId = t.parent;
      calls++;
      asked[k] = (asked[k] || 0) + 1;
      var repeat = !!solved[k];
      if (!solved[k] && asked[k] === 1) distinct++;
      if (parentId) vis[parentId].state = 'frontier';
      current = id;
      if (k < 2) {
        vis[id] = { state: repeat && !memoMode ? 'pivot' : 'visited', ret: k, badge: !memoMode && asked[k] > 1 ? '×' + asked[k] : null, badgeState: 'pivot' };
        solved[k] = true;
        snap('base', (calls === 1 ? intro : '') + name(k) + ' is a base case: it returns ' + k + ' straight away' +
          (!memoMode && asked[k] > 1 ? ', for the ' + ordinal(asked[k]) + ' time.' : '.'), k, null);
        if (parentId) vis[parentId].state = 'active';
        current = parentId;
        return k;
      }
      if (memoMode && memo[k] !== undefined) {
        hits++;
        vis[id] = { state: 'found', ret: memo[k], badge: 'memo', badgeState: 'found' };
        // the subtree plain recursion would have explored: shown as muted ghosts
        (function ghost(cid) { byId[cid].children.forEach(function (g) { vis[g] = { state: 'muted' }; ghost(g); }); }(id));
        snap('hit', name(k) + ' is already in the memo: return ' + memo[k] + ' at once. The greyed calls below it never happen.', k, { k: k, state: 'found' });
        if (parentId) vis[parentId].state = 'active';
        current = parentId;
        return memo[k];
      }
      vis[id] = { state: 'active', badge: !memoMode && asked[k] > 1 ? '×' + asked[k] : null, badgeState: 'pivot' };
      if (!memoMode && repeat) {
        vis[id].state = 'pivot';
        snap('repeat', name(k) + ' is asked for the ' + ordinal(asked[k]) + ' time. Plain recursion kept no notes, so it redoes every call below it.', k, null, { repeatK: k, firstRepeat: asked[k] === 2 });
      } else {
        snap('call', (calls === 1 ? intro : '') + 'Call ' + name(k) + '. It needs ' + name(k - 1) + ' first, then ' + name(k - 2) + '.', k, null);
      }
      var a = call(t.children[0]);
      var b = call(t.children[1]);
      var r = a + b;
      var wasRepeat = vis[id].state === 'pivot' || (!memoMode && repeat);
      vis[id].state = wasRepeat ? 'pivot' : 'visited';
      vis[id].ret = r;
      current = id;
      solved[k] = true;
      if (memoMode) {
        memo[k] = r;
        snap('store', name(k) + ' = ' + a + ' + ' + b + ' = ' + r + '. Write it in the memo so nobody computes it again.', k, { k: k, state: 'swap' });
      } else {
        snap('return', name(k) + ' = ' + a + ' + ' + b + ' = ' + r + '.' + (wasRepeat ? ' Same answer as last time, found the long way.' : ''), k, null);
      }
      if (parentId) vis[parentId].state = 'active';
      current = parentId;
      return r;
    }
    var result = call('c0');
    current = null;
    snap('end', memoMode
      ? name(n) + ' = ' + result + ' with ' + pl(calls, 'call') + ' (' + hits + ' answered from the memo) instead of ' + naiveCalls(n) + '. Only ' + distinct + ' different questions exist.'
      : n < 2 ? name(n) + ' is a base case: one call, no repeats.'
        : name(n) + ' = ' + result + ' after ' + calls + ' calls, but there are only ' + distinct + ' different questions: fib(0) to fib(' + n + '). ' + (calls - distinct) + ((calls - distinct) === 1 ? ' call was a repeat.' : ' calls were repeats.'), null, null);
    return steps;
  }
  function ordinal(k) { return k === 2 ? 'second' : k === 3 ? 'third' : k === 4 ? 'fourth' : k === 5 ? 'fifth' : k + 'th'; }

  /* ================================================================== collapseSteps: tree -> row of cells
     Semantic steps for a custom view that owns the layout. Phases:
       grow (depth d visible), tree, group (copies of one k lit), repeats (every repeat lit),
       collapse (every call flies into cell k), dag (dependency arrows), fill (bottom-up sweep up to index f). */
  function collapseSteps(n, opts) {
    opts = opts || {};
    var tree = fibTree(n), steps = [];
    var maxDepth = tree.reduce(function (m, t) { return Math.max(m, t.depth); }, 0);
    var count = {}; tree.forEach(function (t) { count[t.k] = (count[t.k] || 0) + 1; });
    function push(o) { o.n = n; o.calls = tree.length; o.distinct = n + 1; steps.push(o); }
    if (opts.teaser) {
      for (var d = 0; d <= maxDepth; d++) push({ phase: 'grow', depth: d, counter: tree.filter(function (t) { return t.depth <= d; }).length });
      push({ phase: 'repeats', counter: tree.length });
      push({ phase: 'collapse', counter: n + 1 });
      push({ phase: 'dag', values: true, counter: n + 1 });
      return steps;
    }
    push({ phase: 'tree', counter: tree.length,
      caption: 'Every call plain recursion makes for <code>fib(' + n + ')</code>: ' + pl(tree.length, 'circle') + '. The number in each circle is its argument.' });
    for (var k = n - 2; k >= 1; k--) {
      push({ phase: 'group', focus: k, counter: tree.length,
        caption: '<code>fib(' + k + ')</code> is computed <b>' + count[k] + ' times</b>. Every copy does the same work and returns the same value, ' + fib(k) + '.' });
    }
    push({ phase: 'repeats', counter: tree.length,
      caption: 'Light up every repeat: ' + (tree.length - (n + 1)) + ' of the ' + pl(tree.length, 'call') + (tree.length - (n + 1) === 1 ? ' asks a question that was' : ' ask a question that was') + ' already answered.' });
    push({ phase: 'collapse', counter: n + 1,
      caption: 'Now glue together every call that asks the same question. ' + pl(tree.length, 'circle') + (tree.length === 1 ? ' collapses' : ' collapse') + ' into <b>' + pl(n + 1, 'cell') + '</b>, one per value of k.' });
    push({ phase: 'dag', counter: n + 1,
      caption: 'The tree edges become arrows: cell k reads cells k − 1 and k − 2. No arrow points right to left, so this graph has no cycles: it is a <b>DAG</b>.' });
    for (var f = 0; f <= n; f++) {
      push({ phase: 'fill', fill: f, counter: n + 1,
        caption: f < 2 ? 'Fill the cells left to right. Cell ' + f + ' is a base case: fib(' + f + ') = ' + f + '.'
          : 'Cell ' + f + ' = cell ' + (f - 1) + ' + cell ' + (f - 2) + ' = ' + fib(f - 1) + ' + ' + fib(f - 2) + ' = <b>' + fib(f) + '</b>. Both inputs are already filled.' });
    }
    steps[steps.length - 1].caption += ' Done: ' + pl(n + 1, 'cell') + ' instead of ' + pl(tree.length, 'call') + '.';
    return steps;
  }

  /* ================================================================== the lab */
  /* A table snapshot builder shared by the lab problems. */
  function Table(rows) {
    this.rows = rows.map(function (r) { return { id: r.id, label: r.label, cells: r.cells.slice(), index: r.index, kind: r.kind || 'dp', offset: r.offset || 0 }; });
  }
  Table.prototype.snap = function (o) {
    o = o || {};
    var marks = o.marks || {};
    return {
      rows: this.rows.map(function (r, ri) {
        return { id: r.id, label: r.label, kind: r.kind, index: r.index, offset: r.offset,
          cells: r.cells.map(function (c, ci) {
            if (c === null) {
              var m0 = marks[ri + ',' + ci];
              return m0 ? { value: null, text: m0.text || '', state: m0.state || 'active' } : null;
            }
            var cell = { value: c.value, text: c.text, state: c.state || 'default' };
            var m = marks[ri + ',' + ci];
            if (m) { if (m.state) cell.state = m.state; if (m.text !== undefined) cell.text = m.text; }
            return cell;
          }) };
      }),
      arcs: (o.arcs || []).map(function (a) { return Object.assign({}, a); }),
      cursor: o.cursor || null
    };
  };
  Table.prototype.set = function (r, c, value, state, text) { this.rows[r].cells[c] = { value: value, text: text === undefined ? (value === INF ? '∞' : undefined) : text, state: state || 'visited' }; };
  Table.prototype.state = function (r, c, st) { if (this.rows[r].cells[c]) this.rows[r].cells[c].state = st; };

  function arc(from, to, state, label, side) { return { id: from.join(',') + '>' + to.join(','), from: from, to: to, state: state, label: label, side: side || 'above' }; }
  function empties(n) { var a = []; for (var i = 0; i < n; i++) a.push(null); return a; }

  /* --- climbing stairs: ways[i] = ways[i-1] + ways[i-2], hops of 1 or 2 --- */
  function labStairs(n) {
    var steps = [], ways = [], reads = 0, filled = 0;
    var t = new Table([{ id: 'ways', label: 'ways', cells: empties(n + 1), index: range(n + 1) }]);
    function push(o) {
      steps.push({ kind: o.kind, table: t.snap(o), eq: o.eq || null, caption: o.caption, line: o.line, flow: o.flow,
        vars: o.vars || {}, counters: { cells: filled, reads: reads } });
    }
    push({ kind: 'state', flow: 'state', line: null,
      caption: 'The state: <b>ways[i]</b> = the number of different ways to reach stair i with hops of 1 or 2. We want ways[' + n + '].',
      eq: { lhs: 'ways[i]', note: 'number of ways to reach stair i' } });
    push({ kind: 'rec', flow: 'rec', line: 'rec',
      caption: 'The last hop onto stair i came from stair i − 1 or from stair i − 2. Every way up is one or the other, never both, so add the two counts.',
      eq: { lhs: 'ways[i]', fn: '+', terms: [{ sym: 'ways[i − 1]', num: 'last hop 1', state: 'key' }, { sym: 'ways[i − 2]', num: 'last hop 2', state: 'key' }] } });
    ways[0] = 1; filled = 1;
    t.set(0, 0, 1, 'visited');
    push({ kind: 'base', flow: 'base', line: 'base', cursor: [0, 0], marks: { '0,0': { state: 'active' } },
      caption: 'Base case: <b>ways[0] = 1</b>. Standing at the bottom, there is exactly one way to be there: make no hops.',
      eq: { lhs: 'ways[0]', note: 'base case', result: '1' }, vars: { i: 0, 'ways[i]': 1 } });
    for (var i = 1; i <= n; i++) {
      var two = i >= 2 ? ways[i - 2] : 0;
      var arcs = [arc([0, i - 1], [0, i], 'key', '+1 hop')];
      if (i >= 2) arcs.push(arc([0, i - 2], [0, i], 'key', '+2 hop'));
      reads += i >= 2 ? 2 : 1;
      var terms = [{ sym: 'ways[' + (i - 1) + ']', num: String(ways[i - 1]), state: 'key' },
        i >= 2 ? { sym: 'ways[' + (i - 2) + ']', num: String(two), state: 'key' } : { sym: 'ways[−1]', num: '0 (no such stair)', state: 'muted' }];
      var marks = {}; marks['0,' + i] = { state: 'active', text: '?' }; marks['0,' + (i - 1)] = { state: 'compare' }; if (i >= 2) marks['0,' + (i - 2)] = { state: 'compare' };
      push({ kind: 'look', flow: 'next', line: 'loop', cursor: [0, i], arcs: arcs.map(function (a) { return Object.assign({}, a, { state: 'compare' }); }), marks: marks,
        caption: 'Stair ' + i + ': read the two cells it depends on. Both are already filled, because the loop runs left to right.',
        eq: { lhs: 'ways[' + i + ']', fn: '+', terms: terms.map(function (x) { return Object.assign({}, x, { state: x.state === 'muted' ? 'muted' : 'compare' }); }), result: '?' },
        vars: { i: i, 'ways[i-1]': ways[i - 1], 'ways[i-2]': i >= 2 ? two : null } });
      ways[i] = ways[i - 1] + two; filled++;
      t.set(0, i, ways[i], 'visited');
      var marks2 = {}; marks2['0,' + i] = { state: 'active' };
      push({ kind: 'write', flow: 'fill', line: 'rec', cursor: [0, i], arcs: arcs, marks: marks2,
        caption: 'ways[' + i + '] = ' + ways[i - 1] + ' + ' + two + ' = <b>' + ways[i] + '</b>.' + (i === 1 ? ' Only a 1-hop can reach stair 1.' : ''),
        eq: { lhs: 'ways[' + i + ']', fn: '+', terms: terms, result: String(ways[i]) },
        vars: { i: i, 'ways[i-1]': ways[i - 1], 'ways[i-2]': i >= 2 ? two : null, 'ways[i]': ways[i] } });
    }
    var fm = {}; fm['0,' + n] = { state: 'found' };
    push({ kind: 'answer', flow: 'answer', line: 'ret', cursor: [0, n], marks: fm,
      caption: 'The answer sits in the last cell: <b>' + ways[n] + ' way' + (ways[n] === 1 ? '' : 's') + '</b> to climb ' + n + ' stair' + (n === 1 ? '' : 's') + ', from ' + filled + ' cells and ' + reads + ' reads. The numbers are the Fibonacci numbers, shifted by one.',
      eq: { lhs: 'ways[' + n + ']', note: 'answer', result: String(ways[n]) }, vars: { n: n, answer: ways[n] } });
    return steps;
  }

  /* --- coin change, fewest coins: dp[a] = min over coins c <= a of dp[a-c] + 1 --- */
  function labCoinMin(coins, amount) {
    coins = coins.slice();
    var steps = [], dp = [], choice = [], reads = 0, filled = 0;
    var t = new Table([{ id: 'dp', label: 'dp', cells: empties(amount + 1), index: range(amount + 1) }]);
    var cl = '{' + coins.join(', ') + '}';
    function push(o) {
      var st = { kind: o.kind, table: t.snap(o), eq: o.eq || null, caption: o.caption, line: o.line, flow: o.flow,
        vars: o.vars || {}, counters: { cells: filled, reads: reads } };
      if (o.predict) st.predict = o.predict;
      steps.push(st);
    }
    push({ kind: 'state', flow: 'state', line: null,
      caption: 'The state: <b>dp[a]</b> = the fewest coins from ' + cl + ' that add up to exactly a. We want dp[' + amount + '].',
      eq: { lhs: 'dp[a]', note: 'fewest coins that make exactly a' } });
    push({ kind: 'rec', flow: 'rec', line: 'cmp',
      caption: 'Any way to make a ends with some last coin c. Remove it and the rest makes a − c, as cheaply as possible. So try every coin and keep the smallest.',
      eq: { lhs: 'dp[a]', fn: 'min', terms: coins.map(function (c) { return { sym: 'dp[a − ' + c + '] + 1', num: 'last coin ' + c, state: 'compare' }; }) } });
    dp[0] = 0; filled = 1; t.set(0, 0, 0, 'visited');
    push({ kind: 'base', flow: 'base', line: 'base', cursor: [0, 0], marks: { '0,0': { state: 'active' } },
      caption: 'Base case: <b>dp[0] = 0</b>. Zero coins make the amount 0. Every other cell starts as ∞, meaning "not possible yet".',
      eq: { lhs: 'dp[0]', note: 'base case', result: '0' }, vars: { a: 0, 'dp[a]': 0 } });
    for (var a = 1; a <= amount; a++) {
      var terms = [], arcs = [], marks = {}, best = INF, bestC = null;
      coins.forEach(function (c) {
        if (c > a) { terms.push({ sym: 'coin ' + c, num: 'too big', state: 'muted' }); return; }
        reads++;
        var v = dp[a - c] === INF ? INF : dp[a - c] + 1;
        terms.push({ sym: 'dp[' + (a - c) + '] + 1', num: fmt(dp[a - c]) + ' + 1', val: fmt(v), coin: c, state: 'compare' });
        arcs.push(arc([0, a - c], [0, a], 'compare', '+' + c));
        marks['0,' + (a - c)] = { state: 'compare' };
        if (v < best) { best = v; bestC = c; }
      });
      marks['0,' + a] = { state: 'active', text: '?' };
      var vars = { a: a, coins: coins.slice() };
      push({ kind: 'look', flow: 'next', line: 'coin', cursor: [0, a], arcs: arcs, marks: marks,
        caption: arcs.length
          ? 'Amount ' + a + ': each coin that fits points back to a smaller amount that is already solved. Which candidate is smallest?'
          : 'Amount ' + a + ': every coin is bigger than ' + a + ', so no coin can be the last one.',
        eq: { lhs: 'dp[' + a + ']', fn: 'min', terms: terms, result: '?' }, vars: vars, predict: { a: a, best: best, cands: terms.filter(function (x) { return x.val; }).map(function (x) { return x.val; }) } });
      dp[a] = best; choice[a] = bestC; filled++;
      t.set(0, a, best, best === INF ? 'muted' : 'visited');
      var won = terms.map(function (x) { return x.coin !== undefined ? Object.assign({}, x, { state: x.coin === bestC && best !== INF ? 'key' : 'compare' }) : x; });
      var arcs2 = arcs.map(function (x) { return Object.assign({}, x, { state: best !== INF && x.from[1] === a - bestC ? 'key' : 'muted' }); });
      var m2 = {}; m2['0,' + a] = { state: best === INF ? 'muted' : 'active' };
      if (best !== INF) m2['0,' + (a - bestC)] = { state: 'key' };
      push({ kind: 'write', flow: 'fill', line: best === INF ? 'cmp' : 'take', cursor: [0, a], arcs: arcs2, marks: m2,
        caption: best === INF
          ? 'dp[' + a + '] = <b>∞</b>: no coin leads back to a reachable amount, so ' + a + ' cannot be made from ' + cl + '.'
          : 'dp[' + a + '] = dp[' + (a - bestC) + '] + 1 = <b>' + best + '</b>, using a ' + bestC + ' as the last coin. Remember that choice for later.',
        eq: { lhs: 'dp[' + a + ']', fn: 'min', terms: won, result: fmt(best) },
        vars: { a: a, coins: coins.slice(), 'dp[a]': best, 'choice[a]': bestC } });
    }
    if (dp[amount] === INF) {
      var em = {}; em['0,' + amount] = { state: 'error' };
      push({ kind: 'answer', flow: 'answer', line: 'ret', cursor: [0, amount], marks: em,
        caption: 'dp[' + amount + '] = ∞: <b>no combination</b> of ' + cl + ' adds up to ' + amount + '. Real code returns −1 here.',
        eq: { lhs: 'dp[' + amount + ']', note: 'impossible', result: '∞ → −1' }, vars: { amount: amount, answer: -1 } });
      return steps;
    }
    var am = {}; am['0,' + amount] = { state: 'found' };
    push({ kind: 'answer', flow: 'answer', line: 'ret', cursor: [0, amount], marks: am,
      caption: 'The answer is the last cell: <b>' + dp[amount] + ' coin' + (dp[amount] === 1 ? '' : 's') + '</b>. The number alone does not say which coins, so walk the stored choices back.',
      eq: { lhs: 'dp[' + amount + ']', note: 'answer', result: String(dp[amount]) }, vars: { amount: amount, answer: dp[amount] } });
    // reconstruction: follow choice[] from the target down to 0
    var path = [amount], used = [], cur = amount, pathArcs = [];
    while (cur > 0) {
      var c = choice[cur];
      used.push(c);
      pathArcs.push(arc([0, cur - c], [0, cur], 'path', '+' + c));
      cur -= c; path.push(cur);
      var pm = {}; path.forEach(function (p) { pm['0,' + p] = { state: 'path' }; });
      push({ kind: 'recon', flow: 'recon', line: 'ret', cursor: [0, cur], arcs: pathArcs.slice(), marks: pm,
        caption: 'choice[' + (cur + c) + '] = ' + c + ': take a ' + c + ' and step back to amount ' + cur + '.' + (cur === 0 ? ' Reached 0: the coins are <b>' + used.join(' + ') + ' = ' + amount + '</b>.' : ''),
        eq: { lhs: 'coins', note: 'walk back through choice[]', result: used.join(' + ') }, vars: { at: cur, used: used.slice() } });
    }
    return steps;
  }

  /* --- coin change, number of combinations: W[i][a] = W[i-1][a] + W[i][a - c_i] --- */
  function labCoinWays(coins, amount) {
    coins = coins.slice();
    var k = coins.length, steps = [], W = [], reads = 0, filled = 0;
    var rows = [{ id: 'r0', label: 'none', cells: empties(amount + 1), index: range(amount + 1) }];
    coins.forEach(function (c, i) {
      var set = '{' + coins.slice(0, i + 1).join(',') + '}';
      rows.push({ id: 'r' + (i + 1), label: set.length <= 7 ? set : '+' + c, cells: empties(amount + 1) });
    });
    var t = new Table(rows);
    function push(o) {
      steps.push({ kind: o.kind, table: t.snap(o), eq: o.eq || null, caption: o.caption, line: o.line, flow: o.flow,
        vars: o.vars || {}, counters: { cells: filled, reads: reads } });
    }
    push({ kind: 'state', flow: 'state', line: null,
      caption: 'The state: <b>W[i][a]</b> = the number of ways to make a using only the first i coin types, where order does not matter (1 + 2 and 2 + 1 are the same way). Row i adds coin type i.',
      eq: { lhs: 'W[i][a]', note: 'combinations of the first i coins that make a' } });
    push({ kind: 'rec', flow: 'rec', line: 'use',
      caption: 'Split the ways to make a into two groups: those that never use coin i (the row above) and those that use it at least once (remove one, and a − cᵢ is left, still allowed to use coin i).',
      eq: { lhs: 'W[i][a]', fn: '+', terms: [{ sym: 'W[i − 1][a]', num: 'skip coin i', state: 'key' }, { sym: 'W[i][a − cᵢ]', num: 'use coin i', state: 'key' }] } });
    W.push(range(amount + 1).map(function (a) { return a === 0 ? 1 : 0; }));
    W[0].forEach(function (v, a) { t.set(0, a, v, 'visited'); });
    filled = amount + 1;
    var bm = {}; for (var a0 = 0; a0 <= amount; a0++) bm['0,' + a0] = { state: 'active' };
    push({ kind: 'base', flow: 'base', line: 'base', marks: bm,
      caption: 'Base row: with no coins at all there is exactly one way to make 0 (take nothing) and no way to make anything else.',
      eq: { lhs: 'W[0][a]', note: 'base case', result: '1 if a = 0, else 0' }, vars: { i: 0 } });
    for (var i = 1; i <= k; i++) {
      var c = coins[i - 1];
      W.push([]);
      for (var a = 0; a <= amount; a++) {
        var skip = W[i - 1][a], use = a >= c ? W[i][a - c] : 0;
        reads += a >= c ? 2 : 1;
        W[i][a] = skip + use; filled++;
        t.set(i, a, W[i][a], 'visited');
        var arcs = [arc([i - 1, a], [i, a], 'key', null, 'between')];
        if (a >= c) arcs.push(arc([i, a - c], [i, a], 'key', '+' + c, 'below'));
        var marks = {}; marks[i + ',' + a] = { state: 'active' }; marks[(i - 1) + ',' + a] = { state: 'compare' };
        if (a >= c) marks[i + ',' + (a - c)] = { state: 'compare' };
        push({ kind: 'write', flow: a === 0 ? 'next' : 'fill', line: a >= c ? ['skip', 'use'] : 'skip', cursor: [i, a], arcs: arcs, marks: marks,
          caption: (a === 0 ? 'Row ' + i + ' allows coin ' + c + '. ' : '') + 'W[' + i + '][' + a + '] = ' + skip + ' (without ' + c + ')' +
            (a >= c ? ' + ' + use + ' (with at least one ' + c + ', leaving ' + (a - c) + ')' : ' + 0 (a ' + c + ' does not fit in ' + a + ')') + ' = <b>' + W[i][a] + '</b>.',
          eq: { lhs: 'W[' + i + '][' + a + ']', fn: '+', terms: [
            { sym: 'W[' + (i - 1) + '][' + a + ']', num: String(skip), state: 'key' },
            a >= c ? { sym: 'W[' + i + '][' + (a - c) + ']', num: String(use), state: 'key' } : { sym: 'coin ' + c, num: 'too big: 0', state: 'muted' }], result: String(W[i][a]) },
          vars: { i: i, coin: c, a: a, 'W[i][a]': W[i][a] } });
      }
    }
    var fm = {}; fm[k + ',' + amount] = { state: 'found' };
    push({ kind: 'answer', flow: 'answer', line: 'ret', cursor: [k, amount], marks: fm,
      caption: 'Bottom-right cell: <b>' + W[k][amount] + ' way' + (W[k][amount] === 1 ? '' : 's') + '</b> to make ' + amount + ' from {' + coins.join(', ') + '}. Coins go in the outer loop, so each combination is counted once, in one fixed coin order.',
      eq: { lhs: 'W[' + k + '][' + amount + ']', note: 'answer', result: String(W[k][amount]) }, vars: { answer: W[k][amount] } });
    return steps;
  }

  /* --- house robber: best[i] = max(best[i-1], best[i-2] + h_i), best[-1] = best[0] = 0 --- */
  function labRobber(houses) {
    var n = houses.length, steps = [], best = [0], rob = [], reads = 0, filled = 1;
    var t = new Table([
      { id: 'h', label: 'house', kind: 'input', cells: [null].concat(houses.map(function (v) { return { value: v, state: 'default' }; })), index: range(n + 1) },
      { id: 'best', label: 'best', cells: empties(n + 1) }
    ]);
    function push(o) {
      steps.push({ kind: o.kind, table: t.snap(o), eq: o.eq || null, caption: o.caption, line: o.line, flow: o.flow,
        vars: o.vars || {}, counters: { cells: filled, reads: reads } });
    }
    push({ kind: 'state', flow: 'state', line: null,
      caption: 'Robbing two neighbouring houses sets off the alarm. The state: <b>best[i]</b> = the most money from the first i houses without robbing two neighbours.',
      eq: { lhs: 'best[i]', note: 'most money from houses 1..i, no two adjacent' } });
    push({ kind: 'rec', flow: 'rec', line: 'take',
      caption: 'House i is either skipped (then the best of the first i − 1 houses stands) or robbed (then house i − 1 must be skipped, so add hᵢ to best[i − 2]).',
      eq: { lhs: 'best[i]', fn: 'max', terms: [{ sym: 'best[i − 1]', num: 'skip house i', state: 'compare' }, { sym: 'best[i − 2] + hᵢ', num: 'rob house i', state: 'compare' }] } });
    t.set(1, 0, 0, 'visited');
    push({ kind: 'base', flow: 'base', line: 'base', cursor: [1, 0], marks: { '1,0': { state: 'active' } },
      caption: 'Base case: <b>best[0] = 0</b>. With no houses there is nothing to take. (For house 1, best[i − 2] is read as 0.)',
      eq: { lhs: 'best[0]', note: 'base case', result: '0' }, vars: { i: 0, 'best[i]': 0 } });
    for (var i = 1; i <= n; i++) {
      var h = houses[i - 1], skip = best[i - 1], two = i >= 2 ? best[i - 2] : 0, take = two + h;
      reads += 2;
      var arcs = [arc([1, i - 1], [1, i], 'compare', 'skip', 'below'), arc([0, i], [1, i], 'compare', null, 'between')];
      if (i >= 2) arcs.push(arc([1, i - 2], [1, i], 'compare', '+h' + i, 'below'));
      var marks = {}; marks['1,' + i] = { state: 'active', text: '?' }; marks['1,' + (i - 1)] = { state: 'compare' }; marks['0,' + i] = { state: 'compare' };
      if (i >= 2) marks['1,' + (i - 2)] = { state: 'compare' };
      var terms = [{ sym: 'best[' + (i - 1) + ']', num: String(skip), val: String(skip), state: 'compare' },
        { sym: (i >= 2 ? 'best[' + (i - 2) + ']' : '0') + ' + h' + i, num: two + ' + ' + h, val: String(take), state: 'compare' }];
      push({ kind: 'look', flow: 'next', line: ['skip', 'rob'], cursor: [1, i], arcs: arcs, marks: marks,
        caption: 'House ' + i + ' holds ' + h + '. Skip it and keep ' + skip + ', or rob it: ' + two + ' + ' + h + ' = ' + take + '.',
        eq: { lhs: 'best[' + i + ']', fn: 'max', terms: terms, result: '?' }, vars: { i: i, 'h[i]': h, skip: skip, rob: take } });
      var robbed = take > skip;
      best[i] = robbed ? take : skip; rob[i] = robbed; filled++;
      t.set(1, i, best[i], 'visited');
      var arcs2 = arcs.map(function (x) {
        var isSkip = x.from[0] === 1 && x.from[1] === i - 1;
        return Object.assign({}, x, { state: robbed ? (isSkip ? 'muted' : 'key') : (isSkip ? 'key' : 'muted') });
      });
      var m2 = {}; m2['1,' + i] = { state: 'active' };
      terms[0].state = robbed ? 'compare' : 'key'; terms[1].state = robbed ? 'key' : 'compare';
      push({ kind: 'write', flow: 'fill', line: 'take', cursor: [1, i], arcs: arcs2, marks: m2,
        caption: 'best[' + i + '] = max(' + skip + ', ' + take + ') = <b>' + best[i] + '</b>: ' + (robbed ? 'robbing house ' + i + ' pays more.' : take === skip ? 'a tie, so keep skipping (either choice is optimal).' : 'skipping house ' + i + ' pays more.'),
        eq: { lhs: 'best[' + i + ']', fn: 'max', terms: terms, result: String(best[i]) }, vars: { i: i, 'h[i]': h, skip: skip, rob: take, 'best[i]': best[i] } });
    }
    var am = {}; am['1,' + n] = { state: 'found' };
    push({ kind: 'answer', flow: 'answer', line: 'ret', cursor: [1, n], marks: am,
      caption: n ? 'The answer is best[' + n + '] = <b>' + best[n] + '</b>. To see which houses, walk back: a robbed house jumps two cells, a skipped one jumps one.' : 'No houses: the answer is 0.',
      eq: { lhs: 'best[' + n + ']', note: 'answer', result: String(best[n]) }, vars: { answer: best[n] } });
    if (!n) return steps;
    var cur = n, taken = [], pm = {}, pathArcs = [];
    pm['1,' + n] = { state: 'path' };
    while (cur > 0) {
      if (rob[cur]) {
        taken.unshift(cur);
        pm['0,' + cur] = { state: 'path' };
        var to = Math.max(0, cur - 2);
        if (cur >= 2) pathArcs.push(arc([1, cur - 2], [1, cur], 'path', '+h' + cur, 'below'));
        pm['1,' + to] = { state: 'path' };
        push({ kind: 'recon', flow: 'recon', line: 'ret', cursor: [1, to], arcs: pathArcs.slice(), marks: Object.assign({}, pm),
          caption: 'best[' + cur + '] came from robbing house ' + cur + ' (' + houses[cur - 1] + '). Jump back to best[' + to + '].' + (to === 0 ? ' Houses robbed: <b>' + taken.join(', ') + '</b>.' : ''),
          eq: { lhs: 'robbed', note: 'walk back through the choices', result: taken.map(function (x) { return 'h' + x; }).join(', ') }, vars: { at: to, robbed: taken.slice() } });
        cur = to;
      } else {
        pathArcs.push(arc([1, cur - 1], [1, cur], 'path', 'skip', 'below'));
        pm['1,' + (cur - 1)] = { state: 'path' };
        push({ kind: 'recon', flow: 'recon', line: 'ret', cursor: [1, cur - 1], arcs: pathArcs.slice(), marks: Object.assign({}, pm),
          caption: 'best[' + cur + '] came from skipping house ' + cur + '. Step back to best[' + (cur - 1) + '].' + (cur - 1 === 0 ? ' Houses robbed: <b>' + (taken.join(', ') || 'none') + '</b>.' : ''),
          eq: { lhs: 'robbed', note: 'walk back through the choices', result: taken.length ? taken.map(function (x) { return 'h' + x; }).join(', ') : '—' }, vars: { at: cur - 1, robbed: taken.slice() } });
        cur -= 1;
      }
    }
    return steps;
  }

  /* --- longest increasing subsequence, O(n^2): len[i] = 1 + max(len[j] : j < i, a[j] < a[i]) --- */
  function labLis(a) {
    var n = a.length, steps = [], len = [], prev = [], reads = 0, filled = 0;
    var t = new Table([
      { id: 'a', label: 'a', kind: 'input', cells: a.map(function (v) { return { value: v, state: 'default' }; }), index: range(n) },
      { id: 'len', label: 'len', cells: empties(n) }
    ]);
    function push(o) {
      steps.push({ kind: o.kind, table: t.snap(o), eq: o.eq || null, caption: o.caption, line: o.line, flow: o.flow,
        vars: o.vars || {}, counters: { cells: filled, reads: reads } });
    }
    push({ kind: 'state', flow: 'state', line: null,
      caption: 'An increasing subsequence keeps some values, in order, each larger than the last. The state: <b>len[i]</b> = the length of the longest one that <em>ends at</em> a[i].',
      eq: { lhs: 'len[i]', note: 'longest increasing subsequence ending exactly at a[i]' } });
    push({ kind: 'rec', flow: 'rec', line: 'cmp',
      caption: 'A subsequence ending at a[i] is a[i] alone, or a[i] tacked onto the best one ending at an earlier, smaller a[j].',
      eq: { lhs: 'len[i]', pre: '1 +', fn: 'max', terms: [{ sym: 'len[j]', num: 'for every j < i with a[j] < a[i]', state: 'compare' }], tail: 'or 1 if none' } });
    push({ kind: 'base', flow: 'base', line: 'init', marks: {},
      caption: 'Base case: every value on its own is an increasing subsequence of length 1, so each len[i] starts at 1 before looking back.',
      eq: { lhs: 'len[i]', note: 'starts at 1', result: '1' }, vars: {} });
    for (var i = 0; i < n; i++) {
      var terms = [], arcs = [], marks = {}, bestLen = 1, bestJ = -1;
      for (var j = 0; j < i; j++) {
        reads++;
        if (a[j] < a[i]) {
          terms.push({ sym: 'len[' + j + ']', num: String(len[j]), val: String(len[j]), j: j, state: 'compare' });
          arcs.push(arc([1, j], [1, i], 'compare', null, 'below'));
          marks['1,' + j] = { state: 'compare' }; marks['0,' + j] = { state: 'compare' };
          if (len[j] + 1 > bestLen) { bestLen = len[j] + 1; bestJ = j; }
        }
      }
      marks['1,' + i] = { state: 'active', text: '?' }; marks['0,' + i] = { state: 'active' };
      var smaller = terms.length;
      push({ kind: 'look', flow: 'next', line: 'inner', cursor: [1, i], arcs: arcs, marks: marks,
        caption: i === 0 ? 'Index 0: nothing comes before a[0] = ' + a[0] + '.'
          : smaller ? 'Index ' + i + ' (a[i] = ' + a[i] + '): look back at the ' + smaller + ' earlier value' + (smaller === 1 ? '' : 's') + ' smaller than ' + a[i] + '. Which one ends the longest run?'
            : 'Index ' + i + ' (a[i] = ' + a[i] + '): no earlier value is smaller, so a[i] can only start a new run.',
        eq: smaller ? { lhs: 'len[' + i + ']', pre: '1 +', fn: 'max', terms: terms, result: '?' } : { lhs: 'len[' + i + ']', note: 'no smaller a[j] before it', result: '?' },
        vars: { i: i, 'a[i]': a[i] } });
      len[i] = bestLen; prev[i] = bestJ; filled++;
      t.set(1, i, bestLen, 'visited');
      var arcs2 = arcs.map(function (x) { return Object.assign({}, x, { state: x.from[1] === bestJ ? 'key' : 'muted' }); });
      var m2 = {}; m2['1,' + i] = { state: 'active' }; m2['0,' + i] = { state: 'active' };
      if (bestJ >= 0) { m2['1,' + bestJ] = { state: 'key' }; m2['0,' + bestJ] = { state: 'key' }; }
      var won = terms.map(function (x) { return Object.assign({}, x, { state: x.j === bestJ ? 'key' : 'compare' }); });
      push({ kind: 'write', flow: 'fill', line: bestJ >= 0 ? 'take' : 'init', cursor: [1, i], arcs: arcs2, marks: m2,
        caption: bestJ >= 0 ? 'len[' + i + '] = 1 + len[' + bestJ + '] = <b>' + bestLen + '</b>: extend the run ending at a[' + bestJ + '] = ' + a[bestJ] + '. Remember prev[' + i + '] = ' + bestJ + '.'
          : 'len[' + i + '] = <b>1</b>: a[' + i + '] = ' + a[i] + ' starts a run of its own.',
        eq: smaller ? { lhs: 'len[' + i + ']', pre: '1 +', fn: 'max', terms: won, result: String(bestLen) } : { lhs: 'len[' + i + ']', note: 'on its own', result: '1' },
        vars: { i: i, 'a[i]': a[i], 'len[i]': bestLen, 'prev[i]': bestJ >= 0 ? bestJ : null } });
    }
    if (!n) {
      push({ kind: 'answer', flow: 'answer', line: 'ret', caption: 'An empty list has an empty increasing subsequence: length 0.', eq: { lhs: 'answer', note: 'empty input', result: '0' }, vars: { answer: 0 } });
      return steps;
    }
    var end = 0; for (var e = 1; e < n; e++) if (len[e] > len[end]) end = e;
    var am = {}; am['1,' + end] = { state: 'found' };
    push({ kind: 'answer', flow: 'answer', line: 'ret', cursor: [1, end], marks: am,
      caption: 'The answer is the <em>largest</em> cell, not the last one, because the best run can end anywhere: len[' + end + '] = <b>' + len[end] + '</b>. Walk the prev links back to see it.',
      eq: { lhs: 'max(len)', note: 'best over every end point', result: String(len[end]) }, vars: { answer: len[end], end: end } });
    var chain = [end], pm = {}, pathArcs = [], cur = end;
    pm['1,' + end] = { state: 'path' }; pm['0,' + end] = { state: 'path' };
    while (prev[cur] >= 0) {
      var p = prev[cur];
      pathArcs.push(arc([1, p], [1, cur], 'path', null, 'below'));
      chain.unshift(p);
      pm['1,' + p] = { state: 'path' }; pm['0,' + p] = { state: 'path' };
      push({ kind: 'recon', flow: 'recon', line: 'ret', cursor: [1, p], arcs: pathArcs.slice(), marks: Object.assign({}, pm),
        caption: 'prev[' + cur + '] = ' + p + ': a[' + p + '] = ' + a[p] + ' comes before ' + a[cur] + '.' + (prev[p] < 0 ? ' The run is <b>' + chain.map(function (x) { return a[x]; }).join(', ') + '</b>.' : ''),
        eq: { lhs: 'run', note: 'follow prev[] back', result: chain.map(function (x) { return a[x]; }).join(' < ') }, vars: { at: p, run: chain.map(function (x) { return a[x]; }) } });
      cur = p;
    }
    if (chain.length === 1) {
      push({ kind: 'recon', flow: 'recon', line: 'ret', cursor: [1, end], arcs: [], marks: Object.assign({}, pm),
        caption: 'prev[' + end + '] is empty: the longest run is the single value <b>' + a[end] + '</b>. No value is followed by a larger one.',
        eq: { lhs: 'run', note: 'a single value', result: String(a[end]) }, vars: { run: [a[end]] } });
    }
    return steps;
  }

  /* ================================================================== orderSteps: top-down vs bottom-up
     Coin change (fewest coins). Left: memoised recursion from the target; the stack of calls in flight is a
     chain of arcs, and cells get a completion order. Right: the table loop, left to right.
     Each "unit" is one event on its side; the two sides are shown side by side, step i = event i of each. */
  function orderSteps(coins, amount) {
    var L = [], R = [];
    // ---- top-down
    var memo = {}, stack = [], order = 0, done = {}, calls = 0, hits = 0, maxDepth = 0;
    function cellsL(active, hit) {
      return range(amount + 1).map(function (a) {
        if (done[a] !== undefined) return { value: done[a].v, text: fmt(done[a].v), state: a === hit ? 'found' : a === active ? 'active' : done[a].v === INF ? 'muted' : 'visited', sub: '#' + done[a].o };
        if (stack.indexOf(a) !== -1) return { value: null, text: '?', state: a === active ? 'active' : 'frontier' };
        return null;
      });
    }
    function arcsL() {
      var out = [];
      for (var i = 1; i < stack.length; i++) out.push(arc([0, stack[i - 1]], [0, stack[i]], 'frontier', null));
      return out;
    }
    function pushL(caption, active, extra) {
      L.push(Object.assign({ cells: cellsL(active, extra && extra.hit), arcs: arcsL(), cursor: active === null ? null : [0, active], caption: caption,
        depth: stack.length, calls: calls, hits: hits, filled: Object.keys(done).length }, extra || {}));
    }
    function solve(a) {
      calls++;
      if (a === 0) {
        stack.push(0); maxDepth = Math.max(maxDepth, stack.length);
        if (done[0] === undefined) done[0] = { v: 0, o: ++order };
        pushL('solve(0) is the base case: 0 coins. Return 0.', 0);
        stack.pop();
        return 0;
      }
      if (memo[a] !== undefined) {
        hits++;
        stack.push(a); maxDepth = Math.max(maxDepth, stack.length);
        pushL('solve(' + a + ') is already in the memo: ' + fmt(memo[a]) + '. Return it without recursing.', a, { hit: a });
        stack.pop();
        return memo[a];
      }
      stack.push(a); maxDepth = Math.max(maxDepth, stack.length);
      pushL('Call solve(' + a + '). It asks the smaller amounts it needs, one coin at a time. Stack depth ' + stack.length + '.', a);
      var best = INF;
      coins.forEach(function (c) { if (c <= a) { var r = solve(a - c); if (r + 1 < best) best = r + 1; } });
      memo[a] = best;
      done[a] = { v: best, o: ++order };
      pushL('solve(' + a + ') = ' + fmt(best) + '. It is cell #' + order + ' to be finished; store it in the memo and return.', a);
      stack.pop();
      return best;
    }
    solve(amount);
    pushL('Finished: ' + Object.keys(done).length + ' of ' + pl(amount + 1, 'cell') + (Object.keys(done).length === 1 ? ' was' : ' were') + ' ever needed (' + pl(calls, 'call') + ', deepest stack ' + maxDepth + ').', null, { end: true });
    // ---- bottom-up
    var dp = [], filledR = 0;
    function cellsR(active) {
      return range(amount + 1).map(function (a) {
        if (dp[a] === undefined) return null;
        return { value: dp[a], text: fmt(dp[a]), state: a === active ? 'active' : dp[a] === INF ? 'muted' : 'visited', sub: '#' + (a + 1) };
      });
    }
    for (var a = 0; a <= amount; a++) {
      var best = a === 0 ? 0 : INF, arcs = [];
      coins.forEach(function (c) { if (c <= a) { arcs.push(arc([0, a - c], [0, a], 'compare', null)); if (dp[a - c] + 1 < best) best = dp[a - c] + 1; } });
      dp[a] = best; filledR++;
      R.push({ cells: cellsR(a), arcs: arcs, cursor: [0, a], depth: 1, filled: filledR,
        caption: a === 0 ? 'dp[0] = 0: the base case comes first.' : 'dp[' + a + '] = ' + fmt(best) + ', read from ' + (arcs.length ? arcs.map(function (x) { return 'dp[' + x.from[1] + ']'; }).join(', ') : 'nothing (no coin fits)') + '.' });
    }
    R.push({ cells: cellsR(null), arcs: [], cursor: null, depth: 0, filled: filledR, end: true,
      caption: 'Finished: all ' + pl(amount + 1, 'cell') + ' filled in index order, with no recursion at all.' });
    var steps = [], N = Math.max(L.length, R.length);
    for (var i = 0; i < N; i++) {
      var l = L[Math.min(i, L.length - 1)], r = R[Math.min(i, R.length - 1)];
      steps.push({
        left: { rows: [{ id: 'm', label: 'memo', cells: l.cells, index: range(amount + 1) }], arcs: l.arcs, cursor: l.cursor, caption: l.caption, end: !!l.end, depth: l.depth, hit: l.hit },
        right: { rows: [{ id: 't', label: 'table', cells: r.cells, index: range(amount + 1) }], arcs: r.arcs, cursor: r.cursor, caption: r.caption, end: !!r.end },
        counters: { tdCalls: l.calls, tdDepth: l.depth, tdCells: l.filled, buCells: r.filled },
        caption: i === 0 ? 'Both sides compute the fewest coins for amounts up to ' + amount + ' with coins {' + coins.join(', ') + '}. Each step is one unit of work on each side.' : null
      });
    }
    steps.forEach(function (s, i) {
      if (s.caption) return;
      s.caption = '<b>Top-down:</b> ' + s.left.caption + '<br><b>Bottom-up:</b> ' + s.right.caption;
    });
    steps.meta = { tdCells: Object.keys(done).length, tdCalls: calls, maxDepth: maxDepth, cells: amount + 1, answer: dp[amount] };
    return steps;
  }

  /* ================================================================== dagSteps: coin change as a shortest path
     Nodes 0..target (amounts); an edge a -> a + c for every coin c (weight 1 = one coin). dp[v] = the fewest
     edges on a path from 0 to v. Relax the nodes in topological order (increasing amount). */
  function dagSteps(coins, target) {
    coins = coins.slice().sort(function (x, y) { return x - y; });
    var edges = [];
    for (var a = 0; a <= target; a++) coins.forEach(function (c, ci) { if (a + c <= target) edges.push({ id: 'e' + a + '-' + c, from: a, to: a + c, coin: c, ci: ci }); });
    var dist = [], par = [], steps = [];
    function side(e) { return e.coin === coins[0] && coins[0] === 1 ? 'mid' : (e.ci % 2 === 0 ? 'above' : 'below'); }
    function snap(o) {
      var nodeStates = o.nodeStates || {}, edgeStates = o.edgeStates || {};
      var cells = range(target + 1).map(function (v) {
        var known = dist[v] !== undefined;
        return { value: known ? dist[v] : null, text: String(v), state: nodeStates[v] || (known ? (dist[v] === INF ? 'muted' : 'visited') : 'default'), sub: known ? (dist[v] === INF ? '∞' : dist[v] + ' coin' + (dist[v] === 1 ? '' : 's')) : '' };
      });
      steps.push({
        table: { rows: [{ id: 'amt', label: '', cells: cells }], arcs: edges.map(function (e) {
          return { id: e.id, from: [0, e.from], to: [0, e.to], state: edgeStates[e.id] || 'default', label: edgeStates[e.id] && edgeStates[e.id] !== 'default' && edgeStates[e.id] !== 'muted' ? '+' + e.coin : null, side: side(e), dashed: !!(o.dashed && o.dashed[e.id]) };
        }), cursor: o.cursor === undefined ? null : [0, o.cursor] },
        caption: o.caption, kind: o.kind, counters: { relaxed: o.relaxed || 0, settled: dist.filter(function (d) { return d !== undefined; }).length }
      });
    }
    var relaxed = 0;
    snap({ kind: 'intro', caption: 'Each circle is an amount. Each arrow adds one coin: from a to a + c. Making ' + target + ' with the fewest coins is the same as finding the <b>shortest path from 0 to ' + target + '</b>.' });
    var parEdge = {};
    for (var v = 0; v <= target; v++) {
      var inc = edges.filter(function (e) { return e.to === v; });
      if (v === 0) {
        dist[0] = 0;
        snap({ kind: 'settle', cursor: 0, nodeStates: { 0: 'active' }, edgeStates: parStates(), relaxed: relaxed, caption: 'Start at 0: zero coins. Amounts are visited left to right, which is a topological order: every arrow points right.' });
        continue;
      }
      var es = parStates();
      var best = INF, bestE = null;
      inc.forEach(function (e) { relaxed++; es[e.id] = 'compare'; if (dist[e.from] + 1 < best) { best = dist[e.from] + 1; bestE = e; } });
      var ns = {}; ns[v] = 'active'; inc.forEach(function (e) { ns[e.from] = 'compare'; });
      snap({ kind: 'look', cursor: v, nodeStates: ns, edgeStates: es, relaxed: relaxed,
        caption: inc.length ? 'Amount ' + v + ': ' + inc.length + ' arrow' + (inc.length === 1 ? ' comes' : 's come') + ' in, from ' + inc.map(function (e) { return fmt(e.from); }).join(', ') + '. ' + (inc.length === 1 ? 'That one is' : 'All of those are') + ' already settled.' : 'Amount ' + v + ': no arrow comes in.' });
      dist[v] = best; par[v] = bestE;
      if (bestE) parEdge[v] = bestE.id;
      var ns2 = {}; ns2[v] = best === INF ? 'muted' : 'active';
      snap({ kind: 'settle', cursor: v, nodeStates: ns2, edgeStates: parStates(), relaxed: relaxed,
        caption: best === INF ? v + ' cannot be reached.' : 'Keep the shortest: from ' + bestE.from + ' by a ' + bestE.coin + ' coin, so ' + v + ' needs <b>' + best + '</b>. That arrow is ' + v + '’s parent.' });
    }
    function parStates() { var o = {}; Object.keys(parEdge).forEach(function (k) { o[parEdge[k]] = 'key'; }); return o; }
    if (dist[target] !== INF) {
      var es3 = {}, ns3 = {}, cur = target, path = [target];
      while (cur > 0) { es3[par[cur].id] = 'path'; cur = par[cur].from; path.unshift(cur); }
      path.forEach(function (p) { ns3[p] = 'path'; });
      Object.keys(parEdge).forEach(function (k) { if (!es3[parEdge[k]]) es3[parEdge[k]] = 'muted'; });
      snap({ kind: 'path', nodeStates: ns3, edgeStates: es3, relaxed: relaxed,
        caption: 'Follow the parents back from ' + target + ': <b>' + path.join(' → ') + '</b>. ' + pl(path.length - 1, 'arrow') + ', so ' + pl(path.length - 1, 'coin') + '. That is dynamic programming as a shortest path in a DAG.' });
      // greedy comparison: always take the biggest coin that fits
      var g = [0], gs = {}, gn = {}, left = target, at = 0, ok = true;
      while (left > 0) {
        var pick = null; for (var i = coins.length - 1; i >= 0; i--) if (coins[i] <= left) { pick = coins[i]; break; }
        if (pick === null) { ok = false; break; }
        gs['e' + at + '-' + pick] = 'error'; at += pick; left -= pick; g.push(at);
      }
      if (ok && g.length > path.length) {
        path.forEach(function (p) { gn[p] = 'path'; }); g.forEach(function (p) { if (!gn[p]) gn[p] = 'error'; });
        var es4 = Object.assign({}, es3); Object.keys(gs).forEach(function (k) { es4[k] = 'error'; });
        var dashed = {}; Object.keys(gs).forEach(function (k) { dashed[k] = true; });
        snap({ kind: 'greedy', nodeStates: gn, edgeStates: es4, dashed: dashed, relaxed: relaxed,
          caption: 'Greedy grabs the biggest coin each time: <b>' + g.join(' → ') + '</b>, ' + pl(g.length - 1, 'coin') + '. It commits early; the DAG compares every route and finds ' + (path.length - 1) + '.' });
      }
    }
    return steps;
  }

  /* ================================================================== spaceSteps: a table shrinking to two cells
     Items for VDSA.views.array. Phase 1 fills fib[0..keepFrom] in a full table and greys cells nobody will
     read again. Phase 2 drops them; phase 3 slides a pair (a, b) forward up to fib(n). */
  function spaceSteps(n, keepFrom) {
    keepFrom = Math.min(keepFrom === undefined ? 6 : keepFrom, n);
    var steps = [], F = range(n + 1).map(fib);
    function item(i, state) { return { id: 'f' + i, value: F[i], state: state }; }
    function counters(stored) { return { stored: stored, reads: 0 }; }
    // phase 1
    for (var i = 0; i <= keepFrom; i++) {
      var items = [];
      for (var j = 0; j <= i; j++) {
        var st = j === i ? 'active' : (i >= 2 && (j === i - 1 || j === i - 2)) ? 'compare' : (j < i - 2 ? 'muted' : 'visited');
        items.push(item(j, st));
      }
      steps.push({
        array: { items: items, indexLabels: range(i + 1).map(function (k) { return 'F' + k; }), regions: i >= 2 ? [{ from: i - 2, to: i - 1, state: 'compare', label: 'read' }] : [],
          pointers: i >= 2 ? [{ name: 'i', index: i, state: 'active' }] : [] },
        caption: i < 2 ? 'Full table: F' + i + ' = ' + F[i] + ' is a base case.'
          : 'F' + i + ' = F' + (i - 1) + ' + F' + (i - 2) + ' = ' + F[i - 1] + ' + ' + F[i - 2] + ' = <b>' + F[i] + '</b>.' + (i > 2 ? ' The grey cells to the left will never be read again.' : ''),
        counters: { stored: i + 1 }, vars: { i: i, 'F[i]': F[i] }, phase: 'full'
      });
    }
    // phase 2: drop everything but the last two
    var a = keepFrom - 1, b = keepFrom;
    if (keepFrom >= 1) {
      steps.push({
        array: { items: [item(a, 'key'), item(b, 'key')], indexLabels: ['F' + a, 'F' + b], regions: [{ from: 0, to: 1, state: 'key', label: 'all we keep' }], pointers: [{ name: 'a', index: 0, state: 'key' }, { name: 'b', index: 1, state: 'key' }] },
        caption: 'Only the last two cells are ever read, so throw the rest away. The table shrinks to <b>two variables</b>, a and b.',
        counters: { stored: 2 }, vars: { a: F[a], b: F[b] }, phase: 'drop'
      });
      // phase 3: slide
      for (var k = keepFrom + 1; k <= n; k++) {
        steps.push({
          array: { items: [item(k - 2, 'compare'), item(k - 1, 'compare'), item(k, 'active')], indexLabels: ['F' + (k - 2), 'F' + (k - 1), 'F' + k],
            regions: [{ from: 0, to: 1, state: 'compare', label: 'a + b' }], pointers: [{ name: 'a', index: 0, state: 'compare' }, { name: 'b', index: 1, state: 'compare' }] },
          caption: 'Next value: a + b = ' + F[k - 2] + ' + ' + F[k - 1] + ' = <b>' + F[k] + '</b> (F' + k + ').',
          counters: { stored: 3 }, vars: { a: F[k - 2], b: F[k - 1], next: F[k] }, phase: 'add'
        });
        steps.push({
          array: { items: [item(k - 1, 'key'), item(k, 'key')], indexLabels: ['F' + (k - 1), 'F' + k], regions: [{ from: 0, to: 1, state: 'key', label: 'all we keep' }],
            pointers: [{ name: 'a', index: 0, state: 'key' }, { name: 'b', index: 1, state: 'key' }] },
          caption: 'Slide the pair: a ← b, b ← next. F' + (k - 2) + ' is forgotten' + (k === n ? '. F' + n + ' = <b>' + F[n] + '</b> using two stored numbers instead of ' + (n + 1) + '.' : '.'),
          counters: { stored: 2 }, vars: { a: F[k - 1], b: F[k] }, phase: 'slide'
        });
      }
    }
    return steps;
  }

  /* ================================================================== reference implementations */
  var reference = {
    fib: function (n) { if (n < 2) return n; return reference.fib(n - 1) + reference.fib(n - 2); },
    stairs: function (n) { if (n <= 1) return 1; return reference.stairs(n - 1) + reference.stairs(n - 2); },
    /* fewest coins by exhaustive recursion (BFS over amounts); Infinity when impossible */
    coinMin: function (coins, amount) {
      var dist = {}; dist[0] = 0; var q = [0];
      while (q.length) { var x = q.shift(); coins.forEach(function (c) { var y = x + c; if (y <= amount && dist[y] === undefined) { dist[y] = dist[x] + 1; q.push(y); } }); }
      return dist[amount] === undefined ? INF : dist[amount];
    },
    /* combinations by recursion over coin index */
    coinWays: function (coins, amount) {
      function go(i, left) { if (left === 0) return 1; if (i === coins.length) return 0; var s = 0; for (var k = 0; k * coins[i] <= left; k++) s += go(i + 1, left - k * coins[i]); return s; }
      return go(0, amount);
    },
    /* best non-adjacent subset sum by brute force over subsets (n <= 16) */
    robber: function (h) {
      var n = h.length, best = 0;
      for (var m = 0; m < (1 << n); m++) { if (m & (m >> 1)) continue; var s = 0; for (var i = 0; i < n; i++) if (m & (1 << i)) s += h[i]; if (s > best) best = s; }
      return best;
    },
    /* LIS length by brute force over subsets (n <= 14) */
    lis: function (a) {
      var n = a.length, best = 0;
      for (var m = 0; m < (1 << n); m++) { var last = -INF, ok = true, c = 0; for (var i = 0; i < n && ok; i++) if (m & (1 << i)) { if (a[i] <= last) ok = false; last = a[i]; c++; } if (ok && c > best) best = c; }
      return best;
    }
  };

  /* ================================================================== input validation */
  function parseList(text, o) {
    var tokens = String(text || '').split(/[\s,;]+/).filter(Boolean), values = [];
    if (tokens.length < (o.minCount || 0)) return { values: [], error: o.minCount === 1 ? 'Enter at least one number.' : 'Enter at least ' + o.minCount + ' numbers.' };
    if (tokens.length > o.maxCount) return { values: [], error: 'Use at most ' + o.maxCount + ' numbers so every step stays readable.' };
    for (var i = 0; i < tokens.length; i++) {
      var v = Number(tokens[i]);
      if (!isFinite(v) || !Number.isInteger(v)) return { values: [], error: '“' + tokens[i] + '” is not a whole number.' };
      if (v < o.min || v > o.max) return { values: [], error: 'Keep each number between ' + o.min + ' and ' + o.max + '.' };
      if (o.unique && values.indexOf(v) !== -1) return { values: [], error: 'Each coin value should appear once (' + v + ' is repeated).' };
      values.push(v);
    }
    return { values: values, error: null };
  }
  var parse = {
    coins: function (text) { var r = parseList(text, { min: 1, max: 9, minCount: 1, maxCount: 4, unique: true }); if (!r.error) r.values.sort(function (x, y) { return x - y; }); return r; },
    houses: function (text) { return parseList(text, { min: 0, max: 99, minCount: 1, maxCount: 10 }); },
    lis: function (text) { return parseList(text, { min: -99, max: 99, minCount: 1, maxCount: 10 }); }
  };
  var LIMITS = { stairs: 12, amount: 15, waysAmount: 12, houses: 10, lis: 10, collapse: 7, trace: 6 };

  return {
    INF: INF, fib: fib, naiveCalls: naiveCalls, memoCalls: memoCalls, tableAdds: tableAdds,
    stairsWays: stairsWays, fibTree: fibTree, fibTrace: fibTrace, collapseSteps: collapseSteps,
    orderSteps: orderSteps, dagSteps: dagSteps, spaceSteps: spaceSteps,
    lab: { stairs: labStairs, coinMin: labCoinMin, coinWays: labCoinWays, robber: labRobber, lis: labLis },
    reference: reference, parse: parse, LIMITS: LIMITS, _clone: clone
  };
}));
