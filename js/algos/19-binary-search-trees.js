/* Lesson 19 · Binary search trees — pure step generators (no DOM).

   Browser: VDSA.algos.lesson19.insertSteps(tree, 42) …   (loaded after js/vdsa/core.js)
   Node:    require('js/algos/19-binary-search-trees.js')

   A tree is plain data: {root: id | null, nodes: {id: {id, value, left, right}}, next: n}. Node ids ('n1', 'n2', …)
   are never reused, so a re-inserted key gets a fresh identity and the view can animate every node truthfully.
   Every operation takes a tree and returns {steps, tree} without touching its input.

   A step is a complete snapshot for the lesson's BST view (js/lessons/19-binary-search-trees-view.js):
     root, nodes: [{id, value, left, right, state?, badge?, sub?, col?, from?}]
     edges    {'parentId-childId': state}      walked links ('path'), links being rewritten ('swap')
     probe    {id, value, at: nodeId | slot: {parent, side}, note, state, path?}   the key in your hand
     chips    [{id, value, from, at, state}]   a copied key flying between nodes (two-child delete)
     slots    [{parent, side, state, label?}]  empty child links (where a search falls off the tree)
     hulls    [{id, root, state, label?}]      a shaded whole subtree (discarded, pruned, "all < 50")
     pointers [{name, target, state}]          cur, parent, s, succ …
     strip    {label, items: [{id, value, col, state, from?}]}, cols   a number line under the tree
   plus the player fields: caption (why), line (code label), vars, counters, flow (flowchart node id), kind.

   States follow VDSA.STATES: compare = the node being compared now, visited = on the walked path,
   muted = ruled out by a comparison, key = the key in hand, found = the answer (only once it is certain),
   done = a node that is final for this operation, swap = a node being removed or rewritten,
   pivot = the successor / best candidate so far, active = a subtree being moved.

   Duplicate policy: the tree is a set. Inserting a key that is already present changes nothing. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.lesson19 = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ================================================================== small helpers */
  function num(v) { return v === null || v === undefined ? '∅' : (v < 0 ? '−' + Math.abs(v) : String(v)); }
  function plural(k, word, many) { return k + ' ' + (k === 1 ? word : (many || word + 's')); }
  function copy(o) { var out = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k]; return out; }
  function lt() { return '&lt;'; }
  function gt() { return '&gt;'; }
  /* "42 < 50" as caption HTML */
  function cmpHtml(a, b) { return '<b>' + num(a) + ' ' + (a < b ? lt() : a > b ? gt() : '=') + ' ' + num(b) + '</b>'; }
  function sideWord(side) { return side === 'left' ? 'left' : 'right'; }
  function other(side) { return side === 'left' ? 'right' : 'left'; }

  /* ================================================================== tree data */
  function empty() { return { root: null, nodes: {}, next: 1 }; }
  function clone(t) {
    var nodes = {};
    Object.keys(t.nodes).forEach(function (k) { var n = t.nodes[k]; nodes[k] = { id: n.id, value: n.value, left: n.left, right: n.right }; });
    return { root: t.root, nodes: nodes, next: t.next };
  }
  function newNode(t, value) {
    var id = 'n' + t.next;
    t.next += 1;
    t.nodes[id] = { id: id, value: value, left: null, right: null };
    return id;
  }
  function size(t) { return Object.keys(t.nodes).length; }
  /* Plain insertion, no steps (reject duplicates). Returns the new id or null. */
  function insertRaw(t, value) {
    if (t.root === null) { t.root = newNode(t, value); return t.root; }
    var cur = t.root;
    for (;;) {
      var n = t.nodes[cur];
      if (value === n.value) return null;
      var side = value < n.value ? 'left' : 'right';
      if (n[side] === null) { var id = newNode(t, value); n[side] = id; return id; }
      cur = n[side];
    }
  }
  function fromKeys(keys) { var t = empty(); (keys || []).forEach(function (k) { insertRaw(t, k); }); return t; }
  /* Build an exact shape (for figures that need a tree insertion could not make, e.g. an invalid BST):
     [50, [30, [20], [40]], [70, null, [80]]]  →  value, left subtree, right subtree. */
  function fromShape(spec) {
    var t = empty();
    function build(s) {
      if (s === null || s === undefined) return null;
      if (typeof s === 'number') s = [s];
      var id = newNode(t, s[0]);
      var l = build(s[1]), r = build(s[2]);
      t.nodes[id].left = l; t.nodes[id].right = r;
      return id;
    }
    t.root = build(spec);
    return t;
  }
  function findId(t, value) {
    var cur = t.root;
    while (cur !== null) {
      var n = t.nodes[cur];
      if (value === n.value) return cur;
      cur = value < n.value ? n.left : n.right;
    }
    return null;
  }
  function parentOf(t, id) {
    for (var k in t.nodes) { var n = t.nodes[k]; if (n.left === id || n.right === id) return k; }
    return null;
  }
  /* Height in edges: empty tree −1, one node 0. Iterative, so a 1000-node stick is fine. */
  function height(t) {
    if (t.root === null) return -1;
    var best = 0, stack = [[t.root, 0]];
    while (stack.length) {
      var e = stack.pop(), n = t.nodes[e[0]];
      if (e[1] > best) best = e[1];
      if (n.left !== null) stack.push([n.left, e[1] + 1]);
      if (n.right !== null) stack.push([n.right, e[1] + 1]);
    }
    return best;
  }
  function depths(t) {
    var out = {};
    if (t.root === null) return out;
    var stack = [[t.root, 0]];
    while (stack.length) {
      var e = stack.pop(), n = t.nodes[e[0]];
      out[e[0]] = e[1];
      if (n.left !== null) stack.push([n.left, e[1] + 1]);
      if (n.right !== null) stack.push([n.right, e[1] + 1]);
    }
    return out;
  }
  function inorderIds(t, from) {
    var out = [], stack = [], cur = from === undefined ? t.root : from;
    while (cur !== null || stack.length) {
      while (cur !== null) { stack.push(cur); cur = t.nodes[cur].left; }
      cur = stack.pop();
      out.push(cur);
      cur = t.nodes[cur].right;
    }
    return out;
  }
  function inorder(t) { return inorderIds(t).map(function (id) { return t.nodes[id].value; }); }
  function subtreeIds(t, id) { return id === null || id === undefined ? [] : inorderIds(t, id); }
  /* Strict BST check with bounds (the correct way; checking only children is the classic bug). */
  function isValid(t) {
    if (t.root === null) return true;
    var stack = [[t.root, -Infinity, Infinity]], seen = {};
    while (stack.length) {
      var e = stack.pop(), n = t.nodes[e[0]];
      if (!n || seen[e[0]]) return false;
      seen[e[0]] = true;
      if (!(n.value > e[1] && n.value < e[2])) return false;
      if (n.left !== null) stack.push([n.left, e[1], n.value]);
      if (n.right !== null) stack.push([n.right, n.value, e[2]]);
    }
    return Object.keys(seen).length === size(t);
  }
  /* The first node (in a pre-order walk) whose key breaks the bounds its ancestors impose, or null. */
  function firstViolation(t) {
    if (t.root === null) return null;
    var stack = [[t.root, -Infinity, Infinity]];
    while (stack.length) {
      var e = stack.pop(), n = t.nodes[e[0]];
      if (!(n.value > e[1] && n.value < e[2])) return { id: e[0], lo: e[1], hi: e[2] };
      if (n.right !== null) stack.push([n.right, n.value, e[2]]);
      if (n.left !== null) stack.push([n.left, e[1], n.value]);
    }
    return null;
  }
  /* Open interval (lo, hi) each node's key must lie in, from its ancestors. */
  function bounds(t) {
    var out = {};
    if (t.root === null) return out;
    var stack = [[t.root, -Infinity, Infinity]];
    while (stack.length) {
      var e = stack.pop(), n = t.nodes[e[0]];
      out[e[0]] = { lo: e[1], hi: e[2] };
      if (n.left !== null) stack.push([n.left, e[1], n.value]);
      if (n.right !== null) stack.push([n.right, n.value, e[2]]);
    }
    return out;
  }
  /* Nested-array shape for comparisons in tests: [value, left, right] or null. */
  function shape(t, id) {
    if (id === undefined) id = t.root;
    if (id === null) return null;
    var n = t.nodes[id];
    return [n.value, shape(t, n.left), shape(t, n.right)];
  }
  function heightLabel(t) { var h = height(t); return h < 0 ? '—' : h; }

  /* ================================================================== step recorder */
  function Rec(t, o) {
    this.t = t; this.o = o || {}; this.steps = [];
    this.cmp = 0;
    this.marks = {}; this.edges = {}; this.subs = null; this.badges = null;
    this.probe = null; this.chips = []; this.slots = []; this.hulls = []; this.pointers = [];
    this.strip = null; this.cols = null; this.colOf = null;
  }
  Rec.prototype.snap = function (meta) {
    var t = this.t, self = this;
    var nodes = Object.keys(t.nodes).map(function (id) {
      var n = t.nodes[id];
      var o = { id: id, value: n.value, left: n.left, right: n.right };
      var st = self.marks[id];
      if (st && st !== 'default') o.state = st;
      if (self.subs && self.subs[id] !== undefined) o.sub = self.subs[id];
      if (self.badges && self.badges[id] !== undefined) o.badge = self.badges[id];
      if (self.colOf && self.colOf[id] !== undefined) o.col = self.colOf[id];
      return o;
    });
    var edges = {};
    Object.keys(this.edges).forEach(function (key) {
      var p = key.split('-');
      var pn = t.nodes[p[0]];
      if (pn && (pn.left === p[1] || pn.right === p[1])) edges[key] = self.edges[key];
    });
    var step = {
      root: t.root, nodes: nodes, edges: edges,
      probe: this.probe ? copy(this.probe) : null,
      chips: this.chips.map(copy),
      slots: this.slots.filter(function (s) { return s.parent === null || t.nodes[s.parent]; }).map(copy),
      hulls: this.hulls.filter(function (hh) { return t.nodes[hh.root]; }).map(copy),
      pointers: this.pointers.filter(function (p) { return t.nodes[p.target]; }).map(copy)
    };
    if (this.strip) step.strip = { label: this.strip.label, items: this.strip.items.map(copy) };
    if (this.cols !== null) step.cols = this.cols;
    Object.keys(meta || {}).forEach(function (k) { step[k] = meta[k]; });
    step.counters = this.o.counters ? this.o.counters(this) : { comparisons: this.cmp, height: heightLabel(t), nodes: size(t) };
    this.steps.push(step);
    return step;
  };
  Rec.prototype.val = function (id) { return id === null || id === undefined || !this.t.nodes[id] ? null : this.t.nodes[id].value; };
  Rec.prototype.markPath = function (path, state) { var self = this; path.forEach(function (id) { self.marks[id] = state || 'visited'; }); };
  Rec.prototype.muteSubtree = function (id) {
    var self = this;
    subtreeIds(this.t, id).forEach(function (k) { self.marks[k] = 'muted'; });
  };

  /* ================================================================== insert */
  /* insertSteps(tree, key, {quick}) -> {steps, tree, inserted, id}
     Detailed mode: one step per node compared (the probe hovers on it and says which way), a "fell off"
     step at the empty link, then the landing. quick: one "drop" step whose probe travels the whole path
     (probe.path), then the landing — used for builds and races. */
  function insertSteps(tree, key, o) {
    o = o || {};
    var t = clone(tree), r = new Rec(t, o);
    var newId = 'n' + t.next;
    var vars = function (cur, parent) { return { key: key, cur: r.val(cur), parent: r.val(parent) }; };
    if (t.root === null) {
      r.probe = { id: newId, value: key, slot: { parent: null, side: 'root' }, state: 'key' };
      if (!o.quick) r.snap({ kind: 'start', caption: 'Insert <b>' + num(key) + '</b>. The tree is empty: <code>cur</code> starts as null, so there is nothing to compare with.', line: 'init', vars: vars(null, null), flow: 'null' });
      var rid = newNode(t, key);
      t.root = rid;
      r.probe = null; r.marks[rid] = 'done';
      r.snap({ kind: 'insert', caption: '<b>' + num(key) + '</b> becomes the root: a tree with one node and height 0.', line: ['new', 'root'], vars: vars(null, null), flow: 'hang', inserted: rid });
      return { steps: r.steps, tree: t, inserted: true, id: rid };
    }
    var cur = t.root, parent = null, side = null, path = [];
    if (!o.quick) {
      r.probe = { id: newId, value: key, at: cur, state: 'key' };
      r.pointers = [];
      r.snap({ kind: 'start', caption: 'Insert <b>' + num(key) + '</b>. Start at the root and search for it. Where the search falls off the tree is exactly where it belongs.', line: 'init', vars: vars(cur, null), flow: 'start' });
    }
    while (cur !== null) {
      var n = t.nodes[cur];
      r.cmp += 1;
      if (key === n.value) {
        r.markPath(path); r.marks[cur] = 'found';
        r.probe = { id: newId, value: key, at: cur, note: '= ' + num(n.value), state: 'key' };
        if (o.quick) r.probe.path = path.map(function (id) { return { node: id }; });
        r.pointers = parent !== null ? [{ name: 'parent', target: parent, state: 'visited' }] : [];
        r.snap({ kind: 'dup', caption: cmpHtml(key, n.value) + ': ' + num(key) + ' is already in the tree. This tree stores a set, so it keeps one copy and changes nothing.', line: 'dup', vars: vars(cur, parent), flow: 'dup' });
        r.probe = null;
        return { steps: r.steps, tree: t, inserted: false, id: cur };
      }
      side = key < n.value ? 'left' : 'right';
      var nxt = n[side];
      if (!o.quick) {
        r.markPath(path); r.marks[cur] = 'compare';
        r.probe = { id: newId, value: key, at: cur, note: (side === 'left' ? '< ' : '> ') + num(n.value), state: 'key' };
        r.pointers = parent !== null ? [{ name: 'parent', target: parent, state: 'visited' }] : [];
        var why = side === 'left'
          ? cmpHtml(key, n.value) + '. Every key in ' + num(n.value) + '’s right subtree is larger than ' + num(n.value) + ', so ' + num(key) + ' cannot go there. Go <b>left</b>.'
          : cmpHtml(key, n.value) + '. Every key in ' + num(n.value) + '’s left subtree is smaller than ' + num(n.value) + ', so ' + num(key) + ' cannot go there. Go <b>right</b>.';
        r.snap({ kind: 'compare', caption: why, line: side, vars: vars(cur, parent), flow: side === 'left' ? 'goL' : 'goR', at: cur, side: side });
      }
      path.push(cur);
      if (nxt !== null) r.edges[cur + '-' + nxt] = 'path';
      parent = cur; cur = nxt;
    }
    r.markPath(path);
    var pv = t.nodes[parent].value;
    r.probe = { id: newId, value: key, slot: { parent: parent, side: side }, state: 'key' };
    r.slots = [{ parent: parent, side: side, state: 'key' }];
    r.pointers = [];
    if (o.quick) {
      r.probe.path = path.map(function (id) { return { node: id }; });
      r.snap({ kind: 'drop', caption: 'Insert <b>' + num(key) + '</b>: ' + plural(path.length, 'comparison') + ' lead down to an empty ' + side + ' link under ' + num(pv) + '.', line: 'loop', vars: vars(null, parent), flow: 'null' });
    } else {
      r.snap({ kind: 'null', caption: '<code>cur</code> is null: ' + num(pv) + ' has no ' + side + ' child. The search fell off the tree at exactly the spot that keeps every key in order.', line: 'loop', vars: vars(null, parent), flow: 'null' });
    }
    var id = newNode(t, key);
    t.nodes[parent][side] = id;
    r.probe = null; r.slots = [];
    r.marks[id] = 'done';
    r.edges[parent + '-' + id] = 'path';
    r.pointers = [];
    r.snap({ kind: 'insert', caption: 'Hang <b>' + num(key) + '</b> as the ' + side + ' child of ' + num(pv) + '. No existing link changes: an insert only adds one new link, at the bottom.', line: ['new', side === 'left' ? 'hangL' : 'hangR'], vars: vars(null, parent), flow: 'hang', inserted: id });
    return { steps: r.steps, tree: t, inserted: true, id: id };
  }

  /* ================================================================== search */
  /* searchSteps(tree, key, {prune}) -> {steps, found: id | null}
     prune (default true): each comparison mutes the subtree it rules out and shades it, so you can watch the
     candidates shrink. candidates = keys that could still be the target. */
  function searchSteps(tree, key, o) {
    o = o || {};
    var t = clone(tree);
    var prune = o.prune !== false;
    var candidates = size(t);
    var mode = o.counters;
    var r = new Rec(t, { counters: function (rec) { return mode === 'search' ? { comparisons: rec.cmp, candidates: candidates } : { comparisons: rec.cmp, height: heightLabel(t), nodes: size(t) }; } });
    var pid = 'q' + num(key);
    var vars = function (cur) { return { key: key, cur: r.val(cur) }; };
    if (t.root === null) {
      r.probe = { id: pid, value: key, slot: { parent: null, side: 'root' }, state: 'key' };
      r.snap({ kind: 'absent', caption: 'The tree is empty, so <b>' + num(key) + '</b> is not in it. The loop never runs: zero comparisons.', line: ['init', 'absent'], vars: vars(null), flow: 'absent' });
      return { steps: r.steps, found: null };
    }
    var cur = t.root, path = [], side = null, parent = null;
    r.probe = { id: pid, value: key, at: cur, state: 'key' };
    r.snap({ kind: 'start', caption: 'Search for <b>' + num(key) + '</b>. Start at the root: any of the ' + plural(candidates, 'key') + ' could still be it.', line: 'init', vars: vars(cur), flow: 'start' });
    while (cur !== null) {
      var n = t.nodes[cur];
      r.cmp += 1;
      r.markPath(path);
      if (key === n.value) {
        r.marks[cur] = 'found';
        r.probe = { id: pid, value: key, at: cur, note: '= ' + num(n.value), state: 'key' };
        candidates = 1;
        r.snap({ kind: 'found', caption: cmpHtml(key, n.value) + ': found after ' + plural(r.cmp, 'comparison') + '. The search touched only the ' + plural(path.length + 1, 'node') + ' on one root-to-node path.', line: 'found', vars: vars(cur), flow: 'found', result: cur });
        return { steps: r.steps, found: cur };
      }
      side = key < n.value ? 'left' : 'right';
      var ruledOut = n[other(side)];
      r.marks[cur] = 'compare';
      r.probe = { id: pid, value: key, at: cur, note: (side === 'left' ? '< ' : '> ') + num(n.value), state: 'key' };
      var gone = subtreeIds(t, ruledOut).length;
      candidates -= 1 + (prune ? gone : 0);
      if (!prune) candidates = size(t);
      if (prune && ruledOut !== null) {
        r.muteSubtree(ruledOut);
        r.hulls.push({ id: 'h-' + ruledOut, root: ruledOut, state: 'muted', label: (side === 'left' ? 'all > ' : 'all < ') + num(n.value) });
      }
      var because = side === 'left'
        ? cmpHtml(key, n.value) + ', so go <b>left</b>. ' + (ruledOut !== null ? 'The whole right subtree (' + plural(gone, 'key') + ', all larger than ' + num(n.value) + ') is ruled out without looking at it.' : 'There is no right subtree to rule out.')
        : cmpHtml(key, n.value) + ', so go <b>right</b>. ' + (ruledOut !== null ? 'The whole left subtree (' + plural(gone, 'key') + ', all smaller than ' + num(n.value) + ') is ruled out without looking at it.' : 'There is no left subtree to rule out.');
      r.snap({ kind: 'compare', caption: because, line: side, vars: vars(cur), flow: side === 'left' ? 'goL' : 'goR', at: cur, side: side });
      path.push(cur);
      if (prune) r.marks[cur] = 'muted'; else r.marks[cur] = 'visited';
      var nxt = n[side];
      if (nxt !== null) r.edges[cur + '-' + nxt] = 'path';
      parent = cur; cur = nxt;
    }
    candidates = 0;
    r.markPath(path, prune ? 'muted' : 'visited');
    var pv = t.nodes[parent].value;
    r.probe = { id: pid, value: key, slot: { parent: parent, side: side }, state: 'key' };
    r.slots = [{ parent: parent, side: side, state: 'error' }];
    r.pointers = [];
    r.snap({ kind: 'absent', caption: num(pv) + ' has no ' + side + ' child, so <code>cur</code> becomes null. Every other place ' + num(key) + ' could be has been ruled out: it is <b>not in the tree</b> (' + plural(r.cmp, 'comparison') + ').', line: ['loop', 'absent'], vars: vars(null), flow: 'absent', result: null });
    return { steps: r.steps, found: null };
  }

  /* ================================================================== min / max */
  function extremeSteps(tree, which, o) {
    o = o || {};
    var t = clone(tree), r = new Rec(t, o);
    var side = which === 'min' ? 'left' : 'right', word = which === 'min' ? 'smallest' : 'largest';
    if (t.root === null) {
      r.snap({ kind: 'empty', caption: 'The tree is empty, so it has no ' + word + ' key. Real code returns null or raises an error.', line: 'empty', vars: { cur: null }, flow: 'empty' });
      return { steps: r.steps, result: null };
    }
    var cur = t.root, path = [];
    r.marks[cur] = 'compare';
    r.pointers = [{ name: 'cur', target: cur, state: 'compare' }];
    r.snap({ kind: 'start', caption: 'Start at the root. The ' + word + ' key cannot be in any ' + other(side) + ' subtree, because everything there is ' + (which === 'min' ? 'larger' : 'smaller') + ' than its parent.', line: 'init', vars: { cur: r.val(cur) }, flow: 'start' });
    while (t.nodes[cur][side] !== null) {
      var n = t.nodes[cur];
      r.cmp += 1;
      path.push(cur);
      r.markPath(path);
      var nxt = n[side];
      r.edges[cur + '-' + nxt] = 'path';
      cur = nxt;
      r.marks[cur] = 'compare';
      r.pointers = [{ name: 'cur', target: cur, state: 'compare' }];
      r.snap({ kind: 'step', caption: num(n.value) + ' has a ' + side + ' child, so a ' + (which === 'min' ? 'smaller' : 'larger') + ' key exists. Step ' + side + ' to <b>' + num(t.nodes[cur].value) + '</b>.', line: ['loop', 'step'], vars: { cur: r.val(cur) }, flow: 'step' });
    }
    r.cmp += 1;
    r.marks[cur] = 'found';
    r.pointers = [{ name: which, target: cur, state: 'found' }];
    r.snap({ kind: 'result', caption: num(t.nodes[cur].value) + ' has no ' + side + ' child: nothing is ' + (which === 'min' ? 'smaller' : 'larger') + '. <b>' + num(t.nodes[cur].value) + '</b> is the ' + word + ' key, found in ' + plural(path.length, 'step') + ' down one edge of the tree.', line: 'ret', vars: { cur: r.val(cur) }, flow: 'ret', result: cur });
    return { steps: r.steps, result: cur };
  }
  function minSteps(tree, o) { return extremeSteps(tree, 'min', o); }
  function maxSteps(tree, o) { return extremeSteps(tree, 'max', o); }

  /* ================================================================== successor / predecessor */
  /* Root-down, no parent pointers: while searching for key, every node where the walk turns left
     (right, for the predecessor) is a candidate; the last one is the nearest. If the key's node has a
     right (left) subtree, the answer is that subtree's minimum (maximum) instead. */
  function neighbourSteps(tree, key, which, o) {
    o = o || {};
    var t = clone(tree), r = new Rec(t, o);
    var succ = which === 'succ';
    var name = succ ? 'succ' : 'pred', word = succ ? 'successor' : 'predecessor', bigger = succ ? 'larger' : 'smaller';
    var turn = succ ? 'left' : 'right', down = succ ? 'right' : 'left';
    var cand = null;
    var pid = 'q' + num(key);
    var vars = function (cur) { var v = { key: key, cur: r.val(cur) }; v[name] = r.val(cand); return v; };
    function ptrs(cur, curState) {
      var p = [];
      if (cur !== null && cur !== undefined && !r.probe) p.push({ name: 'cur', target: cur, state: curState || 'compare' });
      if (cand !== null) p.push({ name: name, target: cand, state: 'pivot' });
      return p;
    }
    if (t.root === null) {
      r.snap({ kind: 'absent', caption: 'The tree is empty, so ' + num(key) + ' has no ' + word + '.', line: ['init', 'absent'], vars: vars(null), flow: 'absent' });
      return { steps: r.steps, result: null };
    }
    var cur = t.root, path = [];
    r.probe = { id: pid, value: key, at: cur, state: 'key' };
    r.pointers = ptrs(cur);
    r.snap({ kind: 'start', caption: 'Find the ' + word + ' of <b>' + num(key) + '</b>: the next ' + bigger + ' key in sorted order. First, search for ' + num(key) + ', remembering every node where the walk turns ' + turn + '.', line: 'init', vars: vars(cur), flow: 'start' });
    while (cur !== null && t.nodes[cur].value !== key) {
      var n = t.nodes[cur];
      r.cmp += 1;
      var side = key < n.value ? 'left' : 'right';
      r.markPath(path);
      if (cand !== null && path.indexOf(cand) !== -1) r.marks[cand] = 'pivot';
      r.marks[cur] = 'compare';
      r.probe = { id: pid, value: key, at: cur, note: (side === 'left' ? '< ' : '> ') + num(n.value), state: 'key' };
      var cap;
      if (side === turn) {
        var old = cand;
        cand = cur;
        cap = cmpHtml(key, n.value) + ': go ' + side + '. ' + num(n.value) + ' is ' + bigger + ' than ' + num(key) + ', and everything still ahead is ' + (succ ? 'smaller' : 'larger') + ' than ' + num(n.value) + ', so <b>' + num(n.value) + '</b> is the best candidate so far' + (old !== null ? ' (closer than ' + num(t.nodes[old].value) + ')' : '') + '.';
        r.marks[cur] = 'pivot';
      } else {
        cap = cmpHtml(key, n.value) + ': go ' + side + '. ' + num(n.value) + ' is ' + (succ ? 'smaller' : 'larger') + ' than ' + num(key) + ', so it cannot be the ' + word + '.';
      }
      r.pointers = ptrs(cur);
      r.snap({ kind: 'compare', caption: cap, line: side, vars: vars(cur), flow: side === turn ? (succ ? 'goLs' : 'goRs') : (succ ? 'goR' : 'goL'), at: cur, side: side });
      path.push(cur);
      if (cur !== cand) r.marks[cur] = 'visited';
      var nxt = n[side];
      if (nxt !== null) r.edges[cur + '-' + nxt] = 'path';
      cur = nxt;
    }
    if (cur === null) {
      r.probe = null;
      r.pointers = ptrs(null);
      r.snap({ kind: 'absent', caption: num(key) + ' is not in the tree, so this version returns null. (A floor/ceiling query would return the candidate instead.)', line: 'absent', vars: vars(null), flow: 'absent', result: null });
      return { steps: r.steps, result: null };
    }
    r.cmp += 1;
    var target = cur;
    r.markPath(path);
    if (cand !== null) r.marks[cand] = 'pivot';
    r.marks[target] = 'compare';
    r.probe = { id: pid, value: key, at: target, note: '= ' + num(key), state: 'key' };
    r.pointers = ptrs(target, 'compare');
    var hasDown = t.nodes[target][down] !== null;
    r.snap({ kind: 'foundKey', caption: 'Found ' + num(key) + '. ' + (hasDown
      ? 'It has a ' + down + ' subtree: every key there is ' + bigger + ' than ' + num(key) + ' and ' + (succ ? 'smaller' : 'larger') + ' than any candidate above, so the answer is the ' + (succ ? 'smallest' : 'largest') + ' key in that subtree.'
      : 'It has no ' + down + ' subtree, so no ' + bigger + ' key hangs below it. The answer is the last node where the walk turned ' + turn + ': ' + (cand !== null ? num(t.nodes[cand].value) : 'there was none') + '.'),
      line: 'hasRight', vars: vars(target), flow: 'hasRight' });
    if (hasDown) {
      r.probe = null;
      var c = t.nodes[target][down];
      r.edges[target + '-' + c] = 'path';
      r.marks[target] = 'visited';
      r.marks[c] = 'compare';
      r.pointers = ptrs(c);
      r.cmp += 0;
      r.snap({ kind: 'goDown', caption: 'Step ' + down + ' once, to <b>' + num(t.nodes[c].value) + '</b>. Everything in this subtree is ' + bigger + ' than ' + num(key) + '.', line: 'goRight', vars: vars(c), flow: 'goRight' });
      var inner = succ ? 'left' : 'right';
      while (t.nodes[c][inner] !== null) {
        var cn = t.nodes[c];
        r.marks[c] = 'visited';
        r.edges[c + '-' + cn[inner]] = 'path';
        c = cn[inner];
        r.marks[c] = 'compare';
        r.pointers = ptrs(c);
        r.snap({ kind: 'dive', caption: num(cn.value) + ' has a ' + inner + ' child, so a key closer to ' + num(key) + ' exists. Keep going ' + inner + ': <b>' + num(t.nodes[c].value) + '</b>.', line: 'dive', vars: vars(c), flow: 'dive' });
      }
      r.marks[c] = 'found';
      if (cand !== null) r.marks[cand] = 'visited';
      r.pointers = [{ name: name, target: c, state: 'found' }];
      var resultValue = t.nodes[c].value;
      cand = c;
      r.snap({ kind: 'result', caption: num(t.nodes[c].value) + ' has no ' + inner + ' child. <b>' + num(resultValue) + '</b> is the ' + word + ' of ' + num(key) + ': the ' + (succ ? 'smallest' : 'largest') + ' key in ' + num(key) + '’s ' + down + ' subtree.', line: 'retMin', vars: vars(c), flow: 'retMin', result: c });
      return { steps: r.steps, result: c };
    }
    r.probe = null;
    if (cand === null) {
      r.marks[target] = 'visited';
      r.pointers = [];
      r.snap({ kind: 'result', caption: 'The walk never turned ' + turn + ' and ' + num(key) + ' has no ' + down + ' subtree, so no key is ' + bigger + ': ' + num(key) + ' is the ' + (succ ? 'largest' : 'smallest') + ' key and has <b>no ' + word + '</b>.', line: 'retAnc', vars: vars(null), flow: 'retAnc', result: null });
      return { steps: r.steps, result: null };
    }
    r.marks[target] = 'visited';
    r.marks[cand] = 'found';
    r.pointers = [{ name: name, target: cand, state: 'found' }];
    r.snap({ kind: 'result', caption: '<b>' + num(t.nodes[cand].value) + '</b> is the ' + word + ' of ' + num(key) + ': the nearest ancestor whose ' + turn + ' subtree holds ' + num(key) + '.', line: 'retAnc', vars: vars(null), flow: 'retAnc', result: cand });
    return { steps: r.steps, result: cand };
  }
  function successorSteps(tree, key, o) { return neighbourSteps(tree, key, 'succ', o); }
  function predecessorSteps(tree, key, o) { return neighbourSteps(tree, key, 'pred', o); }

  /* ================================================================== delete (Hibbard: copy the successor) */
  /* deleteSteps(tree, key) -> {steps, tree, deleted: bool, kind: 'absent' | 'leaf' | 'one' | 'two'} */
  function deleteSteps(tree, key, o) {
    o = o || {};
    var t = clone(tree), r = new Rec(t, o);
    var pid = 'q' + num(key);
    var vars = function (cur, parent, s) { return { key: key, node: r.val(cur), parent: r.val(parent), s: r.val(s) }; };
    if (t.root === null) {
      r.snap({ kind: 'absent', caption: 'The tree is empty: <code>node</code> is null at once, so there is nothing to delete.', line: 'absent', vars: vars(null, null, null), flow: 'absent' });
      return { steps: r.steps, tree: t, deleted: false, kind: 'absent' };
    }
    var cur = t.root, parent = null, side = null, path = [];
    r.probe = { id: pid, value: key, at: cur, state: 'key' };
    r.snap({ kind: 'start', caption: 'Delete <b>' + num(key) + '</b>. First find it: the same walk as a search.', line: 'absent', vars: vars(cur, null, null), flow: 'start' });
    while (cur !== null && t.nodes[cur].value !== key) {
      var n = t.nodes[cur];
      r.cmp += 1;
      side = key < n.value ? 'left' : 'right';
      r.markPath(path);
      r.marks[cur] = 'compare';
      r.probe = { id: pid, value: key, at: cur, note: (side === 'left' ? '< ' : '> ') + num(n.value), state: 'key' };
      r.snap({ kind: 'compare', caption: cmpHtml(key, n.value) + ', so if ' + num(key) + ' is in the tree it is in ' + num(n.value) + '’s ' + side + ' subtree. Recurse ' + side + '.', line: side === 'left' ? ['lt', 'goL'] : ['gt', 'goR'], vars: vars(cur, parent, null), flow: side === 'left' ? 'goL' : 'goR', at: cur, side: side });
      path.push(cur);
      var nxt = n[side];
      if (nxt !== null) r.edges[cur + '-' + nxt] = 'path';
      parent = cur; cur = nxt;
    }
    r.markPath(path);
    if (cur === null) {
      var pv = t.nodes[parent].value;
      r.probe = { id: pid, value: key, slot: { parent: parent, side: side }, state: 'key' };
      r.slots = [{ parent: parent, side: side, state: 'error' }];
      r.pointers = [];
      r.snap({ kind: 'absent', caption: num(pv) + ' has no ' + side + ' child: <code>node</code> is null. ' + num(key) + ' is <b>not in the tree</b>, so nothing changes.', line: 'absent', vars: vars(null, parent, null), flow: 'absent' });
      return { steps: r.steps, tree: t, deleted: false, kind: 'absent' };
    }
    r.cmp += 1;
    var x = cur, xn = t.nodes[x];
    r.marks[x] = 'found';
    r.probe = { id: pid, value: key, at: x, note: '= ' + num(xn.value), state: 'key' };
    r.pointers = [];
    var kids = (xn.left !== null ? 1 : 0) + (xn.right !== null ? 1 : 0);
    r.snap({ kind: 'found', caption: 'Found <b>' + num(key) + '</b> after ' + plural(r.cmp, 'comparison') + '. What happens next depends on how many children it has: here, <b>' + kids + '</b>.', line: 'found', vars: vars(x, parent, null), flow: 'kids' });
    r.probe = null;

    function relink(p, childSide, newChild) {
      if (p === null) t.root = newChild;
      else t.nodes[p][childSide] = newChild;
    }
    function finish(kind, focus) {
      Object.keys(r.marks).forEach(function (k) { if (!t.nodes[k]) delete r.marks[k]; });
      r.markPath(path.filter(function (id) { return t.nodes[id]; }));
      if (focus && t.nodes[focus]) r.marks[focus] = 'done';
      r.hulls = []; r.chips = []; r.slots = [];
      r.pointers = [];
      var seq = inorder(t);
      r.snap({ kind: 'done', caption: 'Done. The tree is still a binary search tree: reading it left to right gives ' + (seq.length ? seq.map(num).join(', ') : 'nothing — it is empty now') + '.', line: 'ret', vars: vars(focus && t.nodes[focus] ? focus : null, null, null), flow: 'done' });
      return { steps: r.steps, tree: t, deleted: true, kind: kind };
    }

    if (kids === 0) {
      r.marks[x] = 'swap';
      if (parent !== null) r.edges[parent + '-' + x] = 'swap';
      r.snap({ kind: 'case', caption: num(key) + ' is a <b>leaf</b>: no subtree hangs below it, so removing it cannot disturb any other key.', line: 'leaf', vars: vars(x, parent, null), flow: 'zero', dcase: 'leaf' });
      delete t.nodes[x];
      relink(parent, side, null);
      delete r.marks[x];
      if (parent !== null) r.slots = [{ parent: parent, side: side, state: 'swap' }];
      r.pointers = parent !== null ? [{ name: 'parent', target: parent, state: 'visited' }] : [];
      r.snap({ kind: 'remove', caption: parent !== null ? 'Return null: ' + num(t.nodes[parent].value) + '’s ' + side + ' link becomes empty and the leaf disappears.' : 'Return null: the only node is gone and the tree is empty.', line: 'leaf', vars: vars(null, parent, null), flow: 'zero' });
      return finish('leaf', parent);
    }
    if (kids === 1) {
      var cside = xn.left !== null ? 'left' : 'right';
      var child = xn[cside];
      r.marks[x] = 'swap';
      subtreeIds(t, child).forEach(function (k) { r.marks[k] = 'active'; });
      r.hulls = [{ id: 'h-move', root: child, state: 'active', label: 'moves up' }];
      r.edges[x + '-' + child] = 'active';
      var line1 = cside === 'right' ? 'oneR' : 'oneL';
      r.snap({ kind: 'case', caption: num(key) + ' has <b>one child</b>, ' + num(t.nodes[child].value) + '. ' + (parent !== null
        ? 'Every key in that subtree is already on the correct side of ' + num(t.nodes[parent].value) + ', so the whole subtree can take ' + num(key) + '’s place.'
        : num(key) + ' is the root, so its only subtree becomes the whole tree.'), line: line1, vars: vars(x, parent, null), flow: 'one', dcase: 'one' });
      delete t.nodes[x];
      relink(parent, side, child);
      delete r.marks[x];
      if (parent !== null) r.edges[parent + '-' + child] = 'swap';
      r.pointers = parent !== null ? [{ name: 'parent', target: parent, state: 'visited' }] : [];
      r.snap({ kind: 'splice', caption: parent !== null
        ? 'Return ' + num(t.nodes[child].value) + ': ' + num(t.nodes[parent].value) + '’s ' + side + ' link now points straight at it. The subtree moves up one level; its own shape does not change.'
        : 'Return ' + num(t.nodes[child].value) + ': it is the new root. The subtree moves up; its own shape does not change.', line: line1, vars: vars(child, parent, null), flow: 'one' });
      subtreeIds(t, child).forEach(function (k) { delete r.marks[k]; });
      r.hulls = [];
      return finish('one', child);
    }
    /* two children: find the successor s = minimum of the right subtree */
    r.marks[x] = 'swap';
    r.snap({ kind: 'case', caption: num(key) + ' has <b>two children</b>, so it cannot simply leave: two subtrees would compete for one parent link. Keep the node and replace its key with the next larger key, its <b>successor</b>.', line: 'found', vars: vars(x, parent, null), flow: 'two', dcase: 'two' });
    var s = xn.right, sParent = x, sPath = [x];
    r.edges[x + '-' + s] = 'path';
    r.marks[s] = 'pivot';
    r.pointers = [{ name: 'node', target: x, state: 'swap' }, { name: 's', target: s, state: 'pivot' }];
    r.snap({ kind: 'succStart', caption: 'The successor is the smallest key in ' + num(key) + '’s right subtree. Step right once, to <b>' + num(t.nodes[s].value) + '</b>: every key from here down is larger than ' + num(key) + '.', line: 'succ', vars: vars(x, parent, s), flow: 'two' });
    while (t.nodes[s].left !== null) {
      var sn = t.nodes[s];
      r.marks[s] = 'visited';
      r.edges[s + '-' + sn.left] = 'path';
      sParent = s; sPath.push(s);
      s = sn.left;
      r.marks[s] = 'pivot';
      r.pointers = [{ name: 'node', target: x, state: 'swap' }, { name: 's', target: s, state: 'pivot' }];
      r.snap({ kind: 'dive', caption: num(sn.value) + ' has a left child, so a smaller key exists in this subtree. Keep going left: <b>' + num(t.nodes[s].value) + '</b>.', line: 'dive', vars: vars(x, parent, s), flow: 'two' });
    }
    var sv = t.nodes[s].value;
    r.snap({ kind: 'succFound', caption: num(sv) + ' has no left child: it is the smallest key in the right subtree, the <b>successor</b> of ' + num(key) + '. It is larger than every key on ' + num(key) + '’s left and smaller than every other key on its right.', line: 'dive', vars: vars(x, parent, s), flow: 'two', succ: s });
    r.chips = [{ id: 'copy', value: sv, from: s, at: x, state: 'key' }];
    r.snap({ kind: 'copy', caption: 'Copy <b>' + num(sv) + '</b> up into the node that holds ' + num(key) + '. Nothing else moves, and ' + num(sv) + ' fits there: it sits between the two subtrees in sorted order.', line: 'copy', vars: vars(x, parent, s), flow: 'copy' });
    xn.value = sv;
    r.chips = [];
    r.marks[x] = 'done';
    r.marks[s] = 'swap';
    r.pointers = [{ name: 's', target: s, state: 'swap' }];
    r.snap({ kind: 'copied', caption: 'Now ' + num(sv) + ' appears twice. Delete the old copy from the right subtree. It has no left child, so it is a leaf or has one child: one of the easy cases.', line: 'delSucc', vars: vars(x, parent, s), flow: 'delSucc' });
    var sRight = t.nodes[s].right;
    var sSide = sParent === x ? 'right' : 'left';
    delete t.nodes[s];
    relink(sParent, sSide, sRight);
    delete r.marks[s];
    r.pointers = [];
    if (sRight !== null) {
      r.edges[sParent + '-' + sRight] = 'swap';
      r.snap({ kind: 'splice', caption: 'The old ' + num(sv) + ' had one child, ' + num(t.nodes[sRight].value) + ', so that child takes its place under ' + num(t.nodes[sParent].value) + '.', line: ['delSucc', 'oneR'], vars: vars(x, parent, null), flow: 'delSucc' });
    } else {
      r.slots = [{ parent: sParent, side: sSide, state: 'swap' }];
      r.snap({ kind: 'remove', caption: 'The old ' + num(sv) + ' was a leaf, so it simply disappears: ' + num(t.nodes[sParent].value) + '’s ' + sSide + ' link becomes empty.', line: ['delSucc', 'leaf'], vars: vars(x, parent, null), flow: 'delSucc' });
    }
    return finish('two', x);
  }

  /* ================================================================== build (a sequence of quick inserts) */
  /* buildSteps(keys, {quick = true, start}) -> {steps, tree, rejected: [keys]}
     counters: comparisons summed over the whole build, height, nodes. */
  function buildSteps(keys, o) {
    o = o || {};
    var quick = o.quick !== false;
    var t = o.start ? clone(o.start) : empty();
    var steps = [], total = 0, rejected = [];
    var first = new Rec(t, o);
    first.snap({ kind: 'start', caption: keys.length ? 'Insert ' + plural(keys.length, 'key') + ' one at a time, in this order: ' + keys.map(num).join(', ') + '.' : 'No keys to insert: the tree stays empty.', line: null, vars: { key: null, cur: null, parent: null }, flow: null });
    steps.push(first.steps[0]);
    keys.forEach(function (k, i) {
      var res = insertSteps(t, k, { quick: quick });
      var before = total, opCmp = 0;
      res.steps.forEach(function (s) {
        opCmp = s.counters.comparisons;
        s.counters = { comparisons: before + opCmp, height: s.counters.height, nodes: s.counters.nodes };
        s.buildIndex = i;
        steps.push(s);
      });
      total = before + opCmp;
      if (!res.inserted) rejected.push(k);
      t = res.tree;
    });
    var last = steps[steps.length - 1];
    if (keys.length) {
      var fin = Object.assign({}, last, {
        kind: 'built', probe: null, slots: [], pointers: [], chips: [], hulls: [],
        nodes: last.nodes.map(function (n) { var c = copy(n); delete c.state; return c; }), edges: {},
        caption: 'Built: ' + plural(size(t), 'node') + ', height ' + heightLabel(t) + ', ' + plural(total, 'comparison') + ' in all.' + (rejected.length ? ' Skipped the repeated ' + plural(rejected.length, 'key') + ' (' + rejected.map(num).join(', ') + '): a set keeps one copy.' : ''),
        line: null, flow: null
      });
      steps.push(fin);
    }
    return { steps: steps, tree: t, rejected: rejected, comparisons: total };
  }

  /* ================================================================== in-order walk onto a number line */
  /* inorderSteps(tree) -> {steps, order: [values]}
     Nodes carry col = their in-order index, and the view draws them in columns so that each node sits
     directly above its slot on the number line. Each visit drops a copy of the key onto the line. */
  function inorderSteps(tree, o) {
    o = o || {};
    var t = clone(tree), r = new Rec(t, Object.assign({ counters: function () { return { written: items.length, nodes: size(t) }; } }, o));
    var ids = inorderIds(t), items = [];
    r.cols = ids.length;
    r.colOf = {}; ids.forEach(function (id, i) { r.colOf[id] = i; });
    r.strip = { label: o.label || 'output', items: items };
    if (!ids.length) {
      r.snap({ kind: 'empty', caption: 'An empty tree: the walk writes nothing.', line: null, vars: {}, flow: null });
      return { steps: r.steps, order: [] };
    }
    r.snap({ kind: 'start', caption: 'In-order walk: for every node, first walk its whole left subtree, then write the node, then walk its right subtree. Each node sits directly above its place on the number line.', line: 'call', vars: { node: null, written: '' }, flow: null });
    var d = depths(t);
    ids.forEach(function (id, i) {
      var n = t.nodes[id];
      Object.keys(r.marks).forEach(function (k) { if (r.marks[k] === 'compare') r.marks[k] = 'done'; });
      r.marks[id] = 'compare';
      r.pointers = [{ name: 'visit', target: id, state: 'compare' }];
      items.forEach(function (it) { it.state = 'done'; });
      items.push({ id: 'o' + id, value: n.value, col: i, state: 'compare', from: id });
      var leftDone = n.left !== null ? 'Its left subtree (all smaller) is already written. ' : 'It has no left subtree. ';
      var why = i === 0 ? 'Keep going left from the root until there is no left child: <b>' + num(n.value) + '</b> is the leftmost node, the smallest key. Write it.'
        : leftDone + 'Write <b>' + num(n.value) + '</b>' + (i === ids.length - 1 ? ', the last key.' : (n.right !== null ? ', then walk its right subtree.' : '. With no right subtree, return to the nearest ancestor still waiting.'));
      r.snap({ kind: 'visit', caption: why, line: 'visit', vars: { node: n.value, depth: d[id], written: items.map(function (it) { return it.value; }).join(', ') }, flow: null, visit: id });
    });
    Object.keys(r.marks).forEach(function (k) { r.marks[k] = 'done'; });
    items.forEach(function (it) { it.state = 'done'; });
    r.pointers = [];
    r.snap({ kind: 'done', caption: 'Every node written once, and the line reads <b>' + inorder(t).map(num).join(', ') + '</b>: sorted. That is the BST rule at work: left subtree, then node, then right subtree means smaller, then equal, then larger.', line: null, vars: { node: null, written: items.map(function (it) { return it.value; }).join(', ') }, flow: null });
    return { steps: r.steps, order: inorder(t) };
  }

  /* ================================================================== binary search, folded into a tree */
  /* foldSteps(sortedKeys, target) -> {steps, tree}
     A sorted array lies on the number line; binary search's middles rise level by level and link into
     the perfectly balanced BST; then one search runs on both at once. */
  function foldSteps(keys, target, o) {
    o = o || {};
    var n = keys.length, t = empty(), r = new Rec(t, Object.assign({ counters: function () { return { levels: levels, comparisons: cmp }; } }, o));
    var levels = 0, cmp = 0;
    r.cols = n;
    r.colOf = {};
    var items = keys.map(function (v, i) { return { id: 'a' + i, value: v, col: i, state: 'default' }; });
    r.strip = { label: 'sorted array', items: items };
    r.snap({ kind: 'start', caption: 'A sorted array of ' + plural(n, 'key') + '. Binary search on it always asks about the middle key first, then the middle of whichever half is left.', line: null, vars: {}, flow: null });
    // level-order middles: each range [lo, hi] -> node at mid, linked to its parent
    var queue = [{ lo: 0, hi: n - 1, parent: null, side: null }];
    var idAt = {};
    while (queue.length) {
      var level = queue.splice(0, queue.length);
      levels += 1;
      var risen = [];
      level.forEach(function (q) {
        if (q.lo > q.hi) return;
        var mid = (q.lo + q.hi) >> 1;
        var id = newNode(t, keys[mid]);
        idAt[mid] = id;
        r.colOf[id] = mid;
        if (q.parent === null) t.root = id; else t.nodes[q.parent][q.side] = id;
        risen.push({ id: id, mid: mid });
        queue.push({ lo: q.lo, hi: mid - 1, parent: id, side: 'left' });
        queue.push({ lo: mid + 1, hi: q.hi, parent: id, side: 'right' });
      });
      if (!risen.length) { levels -= 1; break; }
      Object.keys(r.marks).forEach(function (k) { r.marks[k] = 'default'; });
      risen.forEach(function (x) { r.marks[x.id] = 'active'; });
      items.forEach(function (it) { it.state = idAt[it.col] ? 'visited' : 'default'; });
      var vals = risen.map(function (x) { return num(keys[x.mid]); });
      var cap = levels === 1
        ? 'The middle key, <b>' + vals[0] + '</b>, is binary search’s first question. Lift it up: it becomes the root. Everything to its left is smaller, everything to its right is larger.'
        : 'Level ' + (levels - 1) + ': the middles of the remaining ranges (' + vals.join(', ') + ') are the questions binary search asks next. Each hangs under the key whose half it came from.';
      var st = r.snap({ kind: 'rise', caption: cap, line: null, vars: {}, flow: null });
      st.nodes.forEach(function (nd) { if (risen.some(function (x) { return x.id === nd.id; })) nd.from = 'a' + r.colOf[nd.id]; });
    }
    Object.keys(r.marks).forEach(function (k) { r.marks[k] = 'default'; });
    items.forEach(function (it) { it.state = 'default'; });
    r.snap({ kind: 'folded', caption: 'Every key has risen. The result is a binary search tree: binary search’s decisions, frozen into links. Its height is ' + height(t) + ', so any search makes at most ' + (height(t) + 1) + ' comparisons.', line: null, vars: {}, flow: null });
    if (target === undefined || target === null) return { steps: r.steps, tree: t };
    // search the array and the tree side by side
    var lo = 0, hi = n - 1, cur = t.root, path = [];
    while (lo <= hi && cur !== null) {
      var mid = (lo + hi) >> 1;
      cmp += 1;
      r.markPath(path);
      r.marks[cur] = 'compare';
      items.forEach(function (it) { it.state = it.col < lo || it.col > hi ? 'muted' : (it.col === mid ? 'compare' : 'default'); });
      r.pointers = [{ name: 'mid', target: cur, state: 'compare' }];
      var v = keys[mid];
      if (v === target) {
        r.marks[cur] = 'found';
        items.forEach(function (it) { if (it.col === mid) it.state = 'found'; });
        r.pointers = [{ name: 'mid', target: cur, state: 'found' }];
        r.snap({ kind: 'found', caption: 'Search for ' + num(target) + ': ' + cmpHtml(target, v) + '. Found in ' + plural(cmp, 'comparison') + ' — the same questions in the array and in the tree.', line: null, vars: {}, flow: null });
        return { steps: r.steps, tree: t };
      }
      var goLeft = target < v;
      r.snap({ kind: 'compare', caption: 'Search for ' + num(target) + ': ' + cmpHtml(target, v) + '. In the array, keep the ' + (goLeft ? 'left' : 'right') + ' half. In the tree, go ' + (goLeft ? 'left' : 'right') + '. Same question, same answer.', line: null, vars: {}, flow: null });
      path.push(cur);
      var nxt = goLeft ? t.nodes[cur].left : t.nodes[cur].right;
      if (nxt !== null) r.edges[cur + '-' + nxt] = 'path';
      if (goLeft) hi = mid - 1; else lo = mid + 1;
      cur = nxt;
    }
    r.markPath(path);
    items.forEach(function (it) { it.state = 'muted'; });
    r.pointers = [];
    r.snap({ kind: 'absent', caption: 'The range is empty and the walk fell off the tree at the same moment: ' + num(target) + ' is not there.', line: null, vars: {}, flow: null });
    return { steps: r.steps, tree: t };
  }

  /* ================================================================== range query [lo, hi] */
  /* rangeState(tree, lo, hi) -> one snapshot + {reported: [values], visited, pruned: [subtree root ids]}
     At node x: if x > lo the left subtree may hold answers (else prune it: all < lo); report x if lo ≤ x ≤ hi;
     if x < hi the right subtree may hold answers (else prune it: all > hi). Cost O(h + k). */
  function rangeState(tree, lo, hi) {
    var t = clone(tree), r = new Rec(t, {});
    var reported = [], visited = 0, pruned = [], prunedCount = 0;
    if (lo > hi) { var sw = lo; lo = hi; hi = sw; }
    function visit(id) {
      if (id === null) return;
      var n = t.nodes[id];
      visited += 1;
      r.marks[id] = 'visited';
      if (n.value > lo) { if (n.left !== null) { r.edges[id + '-' + n.left] = 'path'; visit(n.left); } }
      else if (n.left !== null) prune(n.left, 'all < ' + num(lo));
      if (n.value >= lo && n.value <= hi) { reported.push(n.value); r.marks[id] = 'found'; }
      if (n.value < hi) { if (n.right !== null) { r.edges[id + '-' + n.right] = 'path'; visit(n.right); } }
      else if (n.right !== null) prune(n.right, 'all > ' + num(hi));
    }
    function prune(id, label) {
      pruned.push(id);
      var ids = subtreeIds(t, id);
      prunedCount += ids.length;
      ids.forEach(function (k) { r.marks[k] = 'muted'; });
      r.hulls.push({ id: 'h-' + id, root: id, state: 'muted', label: label });
    }
    visit(t.root);
    var st = r.snap({ kind: 'range', caption: '', line: null, vars: {}, flow: null });
    st.counters = { reported: reported.length, visited: visited, skipped: prunedCount };
    return { step: st, reported: reported, visited: visited, pruned: pruned, skipped: prunedCount };
  }

  /* ================================================================== simulation for the depth chart */
  /* simulate(ns, {trials, seed, rng}) -> [{n, randomDepth, randomHeight, sortedDepth, sortedHeight}]
     average node depth (edges from the root) and height, averaged over random insertion orders;
     the sorted order is deterministic: a stick with depths 0 … n − 1. */
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  function depthStats(order) {
    // array-based BST for speed: left/right index arrays
    var n = order.length; if (!n) return { avg: 0, height: -1 };
    var key = new Float64Array(n), L = new Int32Array(n).fill(-1), R = new Int32Array(n).fill(-1), D = new Int32Array(n);
    var sum = 0, hgt = 0;
    key[0] = order[0];
    for (var i = 1; i < n; i++) {
      var v = order[i], cur = 0, dep = 0;
      key[i] = v;
      for (;;) {
        dep += 1;
        if (v < key[cur]) { if (L[cur] < 0) { L[cur] = i; break; } cur = L[cur]; }
        else { if (R[cur] < 0) { R[cur] = i; break; } cur = R[cur]; }
      }
      D[i] = dep; sum += dep; if (dep > hgt) hgt = dep;
    }
    return { avg: sum / n, height: hgt };
  }
  function simulate(ns, o) {
    o = o || {};
    var rng = o.rng || mulberry(o.seed === undefined ? 19 : o.seed);
    return ns.map(function (n) {
      var trials = o.trials || (n <= 64 ? 200 : n <= 256 ? 60 : 24);
      var sd = 0, sh = 0;
      for (var k = 0; k < trials; k++) {
        var a = []; for (var i = 0; i < n; i++) a.push(i);
        for (var j = n - 1; j > 0; j--) { var m = Math.floor(rng() * (j + 1)); var tmp = a[j]; a[j] = a[m]; a[m] = tmp; }
        var st = depthStats(a); sd += st.avg; sh += st.height;
      }
      var sorted = []; for (var q = 0; q < n; q++) sorted.push(q);
      var ss = depthStats(sorted);
      return { n: n, randomDepth: sd / trials, randomHeight: sh / trials, sortedDepth: ss.avg, sortedHeight: ss.height };
    });
  }

  /* ================================================================== insertion orders for the shape race */
  function medianFirst(sortedKeys) {
    var out = [];
    (function go(lo, hi) { if (lo > hi) return; var mid = (lo + hi) >> 1; out.push(sortedKeys[mid]); go(lo, mid - 1); go(mid + 1, hi); }(0, sortedKeys.length - 1));
    return out;
  }
  function zigzag(sortedKeys) {
    var out = [], lo = 0, hi = sortedKeys.length - 1, left = true;
    while (lo <= hi) { out.push(left ? sortedKeys[lo++] : sortedKeys[hi--]); left = !left; }
    return out;
  }

  /* ================================================================== code for the lab (labels shared across languages) */
  var CODE = {
    insert: {
      title: 'insert(root, key)',
      pseudo: [
        'function insert(root, key)',
        '  parent ← null; cur ← root                 // @init',
        '  while cur ≠ null                          // @loop',
        '    if key = cur.key then return root       // @dup',
        '    parent ← cur',
        '    if key < cur.key then cur ← cur.left    // @left',
        '    else cur ← cur.right                    // @right',
        '  node ← new Node(key)                      // @new',
        '  if parent = null then return node         // @root',
        '  if key < parent.key then parent.left ← node   // @hangL',
        '  else parent.right ← node                  // @hangR',
        '  return root'
      ].join('\n'),
      js: [
        'function insert(root, key) {',
        '  let parent = null, cur = root;            // @init',
        '  while (cur !== null) {                    // @loop',
        '    if (key === cur.key) return root;       // @dup',
        '    parent = cur;',
        '    if (key < cur.key) cur = cur.left;      // @left',
        '    else cur = cur.right;                   // @right',
        '  }',
        '  const node = new Node(key);               // @new',
        '  if (parent === null) return node;         // @root',
        '  if (key < parent.key) parent.left = node; // @hangL',
        '  else parent.right = node;                 // @hangR',
        '  return root;',
        '}'
      ].join('\n'),
      py: [
        'def insert(root, key):',
        '    parent, cur = None, root                # @init',
        '    while cur is not None:                  # @loop',
        '        if key == cur.key: return root      # @dup',
        '        parent = cur',
        '        if key < cur.key: cur = cur.left    # @left',
        '        else: cur = cur.right               # @right',
        '    node = Node(key)                        # @new',
        '    if parent is None: return node          # @root',
        '    if key < parent.key: parent.left = node # @hangL',
        '    else: parent.right = node               # @hangR',
        '    return root'
      ].join('\n')
    },
    search: {
      title: 'search(root, key)',
      pseudo: [
        'function search(root, key)',
        '  cur ← root                                // @init',
        '  while cur ≠ null                          // @loop',
        '    if key = cur.key then return cur        // @found',
        '    if key < cur.key then cur ← cur.left    // @left',
        '    else cur ← cur.right                    // @right',
        '  return null                               // @absent'
      ].join('\n'),
      js: [
        'function search(root, key) {',
        '  let cur = root;                           // @init',
        '  while (cur !== null) {                    // @loop',
        '    if (key === cur.key) return cur;        // @found',
        '    if (key < cur.key) cur = cur.left;      // @left',
        '    else cur = cur.right;                   // @right',
        '  }',
        '  return null;                              // @absent',
        '}'
      ].join('\n'),
      py: [
        'def search(root, key):',
        '    cur = root                              # @init',
        '    while cur is not None:                  # @loop',
        '        if key == cur.key: return cur       # @found',
        '        if key < cur.key: cur = cur.left    # @left',
        '        else: cur = cur.right               # @right',
        '    return None                             # @absent'
      ].join('\n')
    },
    delete: {
      title: 'delete(node, key)',
      pseudo: [
        'function delete(node, key)',
        '  if node = null then return null           // @absent',
        '  if key < node.key then                    // @lt',
        '    node.left ← delete(node.left, key)      // @goL',
        '  else if key > node.key then               // @gt',
        '    node.right ← delete(node.right, key)    // @goR',
        '  else                                      // @found',
        '    if node.left = null and node.right = null then return null   // @leaf',
        '    if node.left = null then return node.right                   // @oneR',
        '    if node.right = null then return node.left                   // @oneL',
        '    s ← node.right                          // @succ',
        '    while s.left ≠ null do s ← s.left       // @dive',
        '    node.key ← s.key                        // @copy',
        '    node.right ← delete(node.right, s.key)  // @delSucc',
        '  return node                               // @ret'
      ].join('\n'),
      js: [
        'function remove(node, key) {',
        '  if (node === null) return null;           // @absent',
        '  if (key < node.key) {                     // @lt',
        '    node.left = remove(node.left, key);     // @goL',
        '  } else if (key > node.key) {              // @gt',
        '    node.right = remove(node.right, key);   // @goR',
        '  } else {                                  // @found',
        '    if (node.left === null && node.right === null) return null;  // @leaf',
        '    if (node.left === null) return node.right;                   // @oneR',
        '    if (node.right === null) return node.left;                   // @oneL',
        '    let s = node.right;                     // @succ',
        '    while (s.left !== null) s = s.left;     // @dive',
        '    node.key = s.key;                       // @copy',
        '    node.right = remove(node.right, s.key); // @delSucc',
        '  }',
        '  return node;                              // @ret',
        '}'
      ].join('\n'),
      py: [
        'def delete(node, key):',
        '    if node is None: return None            # @absent',
        '    if key < node.key:                      # @lt',
        '        node.left = delete(node.left, key)  # @goL',
        '    elif key > node.key:                    # @gt',
        '        node.right = delete(node.right, key)  # @goR',
        '    else:                                   # @found',
        '        if node.left is None and node.right is None: return None  # @leaf',
        '        if node.left is None: return node.right                   # @oneR',
        '        if node.right is None: return node.left                   # @oneL',
        '        s = node.right                      # @succ',
        '        while s.left is not None: s = s.left  # @dive',
        '        node.key = s.key                    # @copy',
        '        node.right = delete(node.right, s.key)  # @delSucc',
        '    return node                             # @ret'
      ].join('\n')
    },
    min: {
      title: 'minimum(root)',
      pseudo: [
        'function minimum(root)',
        '  if root = null then return null           // @empty',
        '  cur ← root                                // @init',
        '  while cur.left ≠ null                     // @loop',
        '    cur ← cur.left                          // @step',
        '  return cur                                // @ret'
      ].join('\n'),
      js: [
        'function minimum(root) {',
        '  if (root === null) return null;           // @empty',
        '  let cur = root;                           // @init',
        '  while (cur.left !== null) {               // @loop',
        '    cur = cur.left;                         // @step',
        '  }',
        '  return cur;                               // @ret',
        '}'
      ].join('\n'),
      py: [
        'def minimum(root):',
        '    if root is None: return None            # @empty',
        '    cur = root                              # @init',
        '    while cur.left is not None:             # @loop',
        '        cur = cur.left                      # @step',
        '    return cur                              # @ret'
      ].join('\n')
    },
    max: {
      title: 'maximum(root)',
      pseudo: [
        'function maximum(root)',
        '  if root = null then return null           // @empty',
        '  cur ← root                                // @init',
        '  while cur.right ≠ null                    // @loop',
        '    cur ← cur.right                         // @step',
        '  return cur                                // @ret'
      ].join('\n'),
      js: [
        'function maximum(root) {',
        '  if (root === null) return null;           // @empty',
        '  let cur = root;                           // @init',
        '  while (cur.right !== null) {              // @loop',
        '    cur = cur.right;                        // @step',
        '  }',
        '  return cur;                               // @ret',
        '}'
      ].join('\n'),
      py: [
        'def maximum(root):',
        '    if root is None: return None            # @empty',
        '    cur = root                              # @init',
        '    while cur.right is not None:            # @loop',
        '        cur = cur.right                     # @step',
        '    return cur                              # @ret'
      ].join('\n')
    },
    succ: {
      title: 'successor(root, key)',
      pseudo: [
        'function successor(root, key)',
        '  cur ← root; succ ← null                   // @init',
        '  while cur ≠ null and cur.key ≠ key        // @find',
        '    if key < cur.key then succ ← cur; cur ← cur.left   // @left',
        '    else cur ← cur.right                    // @right',
        '  if cur = null then return null            // @absent',
        '  if cur.right ≠ null then                  // @hasRight',
        '    cur ← cur.right                         // @goRight',
        '    while cur.left ≠ null do cur ← cur.left // @dive',
        '    return cur                              // @retMin',
        '  return succ                               // @retAnc'
      ].join('\n'),
      js: [
        'function successor(root, key) {',
        '  let cur = root, succ = null;              // @init',
        '  while (cur !== null && cur.key !== key) { // @find',
        '    if (key < cur.key) { succ = cur; cur = cur.left; }  // @left',
        '    else cur = cur.right;                   // @right',
        '  }',
        '  if (cur === null) return null;            // @absent',
        '  if (cur.right !== null) {                 // @hasRight',
        '    cur = cur.right;                        // @goRight',
        '    while (cur.left !== null) cur = cur.left; // @dive',
        '    return cur;                             // @retMin',
        '  }',
        '  return succ;                              // @retAnc',
        '}'
      ].join('\n'),
      py: [
        'def successor(root, key):',
        '    cur, succ = root, None                  # @init',
        '    while cur is not None and cur.key != key:  # @find',
        '        if key < cur.key: succ, cur = cur, cur.left  # @left',
        '        else: cur = cur.right               # @right',
        '    if cur is None: return None             # @absent',
        '    if cur.right is not None:               # @hasRight',
        '        cur = cur.right                     # @goRight',
        '        while cur.left is not None: cur = cur.left  # @dive',
        '        return cur                          # @retMin',
        '    return succ                             # @retAnc'
      ].join('\n')
    }
  };

  return {
    num: num,
    empty: empty, clone: clone, fromKeys: fromKeys, fromShape: fromShape, insertRaw: insertRaw,
    size: size, height: height, depths: depths, inorder: inorder, inorderIds: inorderIds, subtreeIds: subtreeIds,
    findId: findId, parentOf: parentOf, isValid: isValid, firstViolation: firstViolation, bounds: bounds, shape: shape,
    insertSteps: insertSteps, searchSteps: searchSteps, deleteSteps: deleteSteps,
    minSteps: minSteps, maxSteps: maxSteps, successorSteps: successorSteps, predecessorSteps: predecessorSteps,
    buildSteps: buildSteps, inorderSteps: inorderSteps, foldSteps: foldSteps, rangeState: rangeState,
    simulate: simulate, depthStats: depthStats, medianFirst: medianFirst, zigzag: zigzag,
    CODE: CODE
  };
}));
