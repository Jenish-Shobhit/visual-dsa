/* Gallery demos: VDSA.views.tree */
(function () {
  'use strict';
  var G = Gallery;

  /* ---------- tiny mutable binary tree used by the step generators ---------- */
  function T() { this.n = {}; this.root = null; }
  T.prototype.add = function (id, value) { this.n[id] = { id: id, value: value, left: null, right: null }; return this.n[id]; };
  T.prototype.height = function (id) { if (!id) return 0; var x = this.n[id]; return 1 + Math.max(this.height(x.left), this.height(x.right)); };
  T.prototype.bf = function (id) { var x = this.n[id]; return this.height(x.left) - this.height(x.right); };
  T.prototype.parentOf = function (id) { for (var k in this.n) if (this.n[k].left === id || this.n[k].right === id) return k; return null; };
  T.prototype.snap = function (o) {
    o = o || {};
    var self = this, nodes = [];
    Object.keys(this.n).forEach(function (k) {
      var x = self.n[k];
      var node = { id: k, value: x.value, left: x.left, right: x.right, state: (o.mark && o.mark[k]) || 'default' };
      if (o.bf) { var b = self.bf(k); node.badge = (b > 0 ? '+' : b < 0 ? '−' : '') + Math.abs(b); node.badgeState = Math.abs(b) > 1 ? 'error' : 'default'; }
      if (x.color) node.color = x.color;
      nodes.push(node);
    });
    return { root: this.root, nodes: nodes, edges: o.edges || {}, pointers: o.ptrs || [], caption: o.caption };
  };
  function sign(b) { return (b > 0 ? '+' : b < 0 ? '−' : '') + Math.abs(b); }

  /* ---------- BST insert with a search path ---------- */
  function bstSteps(values) {
    var t = new T(), steps = [];
    steps.push(t.snap({ caption: 'An empty tree.' }));
    values.forEach(function (v, idx) {
      var id = 'b' + v;
      if (!t.root) { t.add(id, v); t.root = id; steps.push(t.snap({ mark: (function () { var m = {}; m[id] = 'found'; return m; })(), caption: v + ' becomes the root.' })); return; }
      var cur = t.root, path = [], edges = {};
      while (true) {
        var m = {}; path.forEach(function (p) { m[p] = 'visited'; }); m[cur] = 'compare';
        steps.push(t.snap({ mark: m, edges: Object.assign({}, edges), ptrs: [{ name: 'curr', target: cur }], caption: 'Insert ' + v + ': compare with ' + t.n[cur].value + (v < t.n[cur].value ? ' → go left.' : ' → go right.') }));
        path.push(cur);
        var side = v < t.n[cur].value ? 'left' : 'right';
        var nxt = t.n[cur][side];
        if (!nxt) {
          t.add(id, v); t.n[cur][side] = id;
          edges[cur + '-' + id] = 'path';
          var m2 = {}; path.forEach(function (p) { m2[p] = 'visited'; }); m2[id] = 'found';
          steps.push(t.snap({ mark: m2, edges: edges, ptrs: [{ name: 'curr', target: id, state: 'found' }], caption: 'Empty ' + side + ' child: ' + v + ' goes here.' }));
          break;
        }
        edges[cur + '-' + nxt] = 'path';
        cur = nxt;
      }
    });
    steps.push(t.snap({ caption: 'In-order reading of the tree is sorted.' }));
    return steps;
  }

  G.demo('tree', {
    id: 'bst-insert', title: 'BST insert — search path, pointer, growth',
    note: 'Edges on the search path use state "path"; a sliding "curr" pointer; new nodes grow out of their parent.',
    duration: 560, hold: 380,
    build: function (host) {
      var view = VDSA.views.tree(host, { label: 'Binary search tree insert' });
      var steps = bstSteps([50, 30, 70, 20, 40, 60, 80, 35, 65, 45]);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- AVL insert with rotations ---------- */
  function avlSteps() {
    var t = new T(), steps = [];
    [30, 20, 40, 10, 25].forEach(function (v) { t.add('a' + v, v); });
    t.root = 'a30'; t.n.a30.left = 'a20'; t.n.a30.right = 'a40'; t.n.a20.left = 'a10'; t.n.a20.right = 'a25';
    steps.push(t.snap({ bf: true, caption: 'An AVL tree: every balance factor (badge) is −1, 0 or +1.' }));
    function rotateRight(y) {
      var x = t.n[y].left, p = t.parentOf(y);
      t.n[y].left = t.n[x].right; t.n[x].right = y;
      if (!p) t.root = x; else if (t.n[p].left === y) t.n[p].left = x; else t.n[p].right = x;
      return x;
    }
    function rotateLeft(x) {
      var y = t.n[x].right, p = t.parentOf(x);
      t.n[x].right = t.n[y].left; t.n[y].left = x;
      if (!p) t.root = y; else if (t.n[p].left === x) t.n[p].left = y; else t.n[p].right = y;
      return y;
    }
    function insert(v) {
      var id = 'a' + v, cur = t.root, path = [];
      while (cur) { path.push(cur); var side = v < t.n[cur].value ? 'left' : 'right'; if (!t.n[cur][side]) { t.add(id, v); t.n[cur][side] = id; break; } cur = t.n[cur][side]; }
      var mk = {}; path.forEach(function (p) { mk[p] = 'visited'; }); mk[id] = 'found';
      steps.push(t.snap({ bf: true, mark: mk, caption: 'Insert ' + v + ' as a leaf; recompute balance factors on the way up.' }));
      for (var i = path.length - 1; i >= 0; i--) {
        var z = path[i], b = t.bf(z);
        if (Math.abs(b) <= 1) continue;
        var m = {}; m[z] = 'error';
        steps.push(t.snap({ bf: true, mark: m, caption: t.n[z].value + ' has balance ' + sign(b) + ': too heavy on the ' + (b > 0 ? 'left' : 'right') + '.' }));
        if (b > 1 && t.bf(t.n[z].left) < 0) {
          var l = t.n[z].left, m1 = {}; m1[l] = 'pivot'; m1[z] = 'error';
          steps.push(t.snap({ bf: true, mark: m1, caption: 'Left-right case: first rotate ' + t.n[l].value + ' left.' }));
          rotateLeft(l);
          var m1b = {}; m1b[t.n[z].left] = 'pivot'; m1b[z] = 'error';
          steps.push(t.snap({ bf: true, mark: m1b, caption: 'Now it is a left-left case.' }));
        }
        if (b < -1 && t.bf(t.n[z].right) > 0) {
          var r = t.n[z].right, m2 = {}; m2[r] = 'pivot'; m2[z] = 'error';
          steps.push(t.snap({ bf: true, mark: m2, caption: 'Right-left case: first rotate ' + t.n[r].value + ' right.' }));
          rotateRight(r);
          var m2b = {}; m2b[t.n[z].right] = 'pivot'; m2b[z] = 'error';
          steps.push(t.snap({ bf: true, mark: m2b, caption: 'Now it is a right-right case.' }));
        }
        var pivot = b > 1 ? t.n[z].left : t.n[z].right;
        var m3 = {}; m3[pivot] = 'pivot'; m3[z] = 'swap';
        steps.push(t.snap({ bf: true, mark: m3, caption: 'Rotate ' + (b > 1 ? 'right' : 'left') + ' around ' + t.n[z].value + ': ' + t.n[pivot].value + ' moves up.' }));
        var top = b > 1 ? rotateRight(z) : rotateLeft(z);
        var m4 = {}; m4[top] = 'done'; m4[z] = 'swap';
        steps.push(t.snap({ bf: true, mark: m4, caption: t.n[top].value + ' is the new subtree root; order is unchanged.' }));
        break;
      }
      steps.push(t.snap({ bf: true, caption: 'Balanced again.' }));
    }
    insert(5); insert(27); insert(26);
    return steps;
  }

  G.demo('tree', {
    id: 'avl', title: 'AVL rotations — nodes swing into place',
    note: 'badge = balance factor (badgeState "error" when |bf| > 1). Re-parented nodes travel on arcs around the rotating pair.',
    duration: 800, hold: 700,
    build: function (host) {
      var view = VDSA.views.tree(host, { label: 'AVL tree rotations' });
      var steps = avlSteps();
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- red-black insert (CLRS) ---------- */
  function rbSteps(values) {
    var t = new T(), steps = [];
    function color(id) { return id ? t.n[id].color : 'black'; }
    function rot(x, dir) {
      var other = dir === 'left' ? 'right' : 'left', y = t.n[x][other], p = t.parentOf(x);
      t.n[x][other] = t.n[y][dir]; t.n[y][dir] = x;
      if (!p) t.root = y; else if (t.n[p].left === x) t.n[p].left = y; else t.n[p].right = y;
    }
    values.forEach(function (v) {
      var id = 'r' + v, cur = t.root, par = null;
      while (cur) { par = cur; cur = v < t.n[cur].value ? t.n[cur].left : t.n[cur].right; }
      t.add(id, v).color = 'red';
      if (!par) t.root = id; else if (v < t.n[par].value) t.n[par].left = id; else t.n[par].right = id;
      var m = {}; m[id] = 'active';
      steps.push(t.snap({ mark: m, caption: 'Insert ' + v + ' as a red leaf.' }));
      var z = id;
      while (t.parentOf(z) && color(t.parentOf(z)) === 'red') {
        var p = t.parentOf(z), g = t.parentOf(p);
        var left = t.n[g].left === p, u = left ? t.n[g].right : t.n[g].left;
        if (color(u) === 'red') {
          t.n[p].color = 'black'; t.n[u].color = 'black'; t.n[g].color = 'red';
          var mm = {}; mm[g] = 'compare';
          steps.push(t.snap({ mark: mm, caption: 'Red uncle: recolour parent and uncle black, grandparent red.' }));
          z = g; continue;
        }
        if (z === (left ? t.n[p].right : t.n[p].left)) {
          z = p; rot(z, left ? 'left' : 'right');
          var m1 = {}; m1[z] = 'pivot';
          steps.push(t.snap({ mark: m1, caption: 'Zig-zag: rotate the parent to make it a straight line.' }));
          p = t.parentOf(z); g = t.parentOf(p);
        }
        t.n[p].color = 'black'; t.n[g].color = 'red';
        rot(g, left ? 'right' : 'left');
        var m2 = {}; m2[p] = 'pivot';
        steps.push(t.snap({ mark: m2, caption: 'Rotate the grandparent and swap colours.' }));
      }
      if (t.n[t.root].color === 'red') { t.n[t.root].color = 'black'; steps.push(t.snap({ caption: 'The root is always black.' })); }
    });
    steps.push(t.snap({ caption: 'Every root-to-null path has the same number of black nodes.' }));
    return steps;
  }

  G.demo('tree', {
    id: 'rb', title: 'Red-black tree — colour plus state halo',
    note: 'node.color "red" | "black" sets the fill; a non-default state shows as a halo ring.',
    duration: 700, hold: 600,
    build: function (host) {
      var view = VDSA.views.tree(host, { label: 'Red-black tree insert' });
      var steps = rbSteps([10, 20, 30, 15, 25, 5, 1, 27]);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- recursion tree: fib(4) ---------- */
  function fibSteps(n) {
    var nodes = {}, steps = [], counter = 0, stack = [];
    function snapshot(caption) {
      var list = Object.keys(nodes).map(function (k) { var x = nodes[k]; return { id: k, label: 'fib(' + x.n + ')', children: x.children.slice(), state: x.state, returnValue: x.ret }; });
      steps.push({ root: 'f0', nodes: list, caption: caption, frames: stack.map(function (id) { var x = nodes[id]; return { id: id, fn: 'fib', args: 'n=' + x.n, state: x.state === 'done' ? 'done' : x.state === 'active' ? 'active' : 'default', returnValue: x.ret, locals: x.locals.slice() }; }) });
    }
    function call(k, parent) {
      var id = 'f' + (counter++);
      nodes[id] = { n: k, children: [], state: 'active', ret: undefined, locals: [] };
      if (parent) { nodes[parent].children.push(id); nodes[parent].state = 'frontier'; }
      stack.push(id);
      snapshot('Call fib(' + k + ').');
      var r;
      if (k < 2) { r = k; }
      else {
        var a = call(k - 1, id);
        nodes[id].locals = [['a', a]];
        nodes[id].state = 'active';
        snapshot('fib(' + (k - 1) + ') returned ' + a + '; now call fib(' + (k - 2) + ').');
        var b = call(k - 2, id);
        nodes[id].locals = [['a', a], ['b', b]];
        nodes[id].state = 'active';
        r = a + b;
      }
      nodes[id].ret = r; nodes[id].state = 'done';
      snapshot('fib(' + k + ') returns ' + r + '.');
      stack.pop();
      if (parent) nodes[parent].state = 'active';
      return r;
    }
    call(n, null);
    return steps;
  }
  window.__fibSteps = fibSteps; // shared with demo-callstack.js

  G.demo('tree', {
    id: 'fib', title: 'Recursion tree — fib(4)',
    note: 'n-ary nodes (children: [ids]) with labels; active = running, frontier = waiting on a child, done + returnValue chip = returned.',
    duration: 520, hold: 420,
    build: function (host) {
      var view = VDSA.views.tree(host, { label: 'Recursion tree of fib(4)', nodeSize: 34 });
      var steps = fibSteps(4);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- n-ary tree: preorder DFS ---------- */
  G.demo('tree', {
    id: 'nary', title: 'n-ary tree — contour layout, preorder walk',
    note: 'Variable child counts; subtrees pack by contour and parents centre over their children.',
    duration: 480, hold: 320,
    build: function (host) {
      var view = VDSA.views.tree(host, { label: 'General tree preorder traversal', nodeSize: 36 });
      var shape = { A: ['B', 'C', 'D'], B: ['E', 'F'], C: [], D: ['G', 'H', 'I', 'J'], E: [], F: ['K'], G: [], H: ['L', 'M'], I: [], J: [], K: [], L: [], M: [] };
      var order = [];
      (function walk(id) { order.push(id); shape[id].forEach(walk); }('A'));
      var steps = [];
      for (var i = 0; i <= order.length; i++) {
        steps.push({
          root: 'A',
          nodes: Object.keys(shape).map(function (id) { var k = order.indexOf(id); return { id: id, label: id, children: shape[id], state: k < i - 1 ? 'visited' : k === i - 1 ? 'active' : 'default', badge: k < i ? String(k + 1) : undefined }; }),
          pointers: i > 0 && i <= order.length ? [{ name: 'visit', target: order[i - 1] }] : [],
          caption: i === 0 ? 'Preorder: visit a node, then its children left to right.' : 'Visit ' + order[i - 1] + ' (#' + i + ').'
        });
      }
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- showNulls ---------- */
  G.demo('tree', {
    id: 'nulls', title: 'Null children — showNulls',
    note: 'showNulls draws ∅ stubs for missing children; an insert replaces a stub with a node.',
    duration: 560, hold: 600,
    build: function (host) {
      var view = VDSA.views.tree(host, { label: 'Tree with null children', showNulls: true });
      var t = new T(), steps = [];
      t.add('n4', 4); t.add('n2', 2); t.add('n6', 6); t.root = 'n4'; t.n.n4.left = 'n2'; t.n.n4.right = 'n6';
      steps.push(t.snap({ caption: 'Every missing child is a null reference.' }));
      [5, 1, 7].forEach(function (v) {
        var cur = t.root, path = [];
        while (true) { path.push(cur); var side = v < t.n[cur].value ? 'left' : 'right'; if (!t.n[cur][side]) break; cur = t.n[cur][side]; }
        var m = {}; path.forEach(function (p) { m[p] = 'visited'; }); m[cur] = 'compare';
        steps.push(t.snap({ mark: m, caption: 'Insert ' + v + ': follow the path to a null.' }));
        t.add('n' + v, v); t.n[cur][v < t.n[cur].value ? 'left' : 'right'] = 'n' + v;
        var m2 = {}; m2['n' + v] = 'found';
        steps.push(t.snap({ mark: m2, caption: 'The null becomes node ' + v + ' with two new nulls.' }));
      });
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- large random tree ---------- */
  G.demo('tree', {
    id: 'large', title: 'Large tree — 48 random keys, auto-scaled', wide: true,
    note: 'Nodes shrink to fit the width (labels hide below ~16 px); search paths still read clearly.',
    duration: 520, hold: 500,
    build: function (host) {
      var view = VDSA.views.tree(host, { label: 'Large binary search tree' });
      var rnd = VDSA.rng(11), t = new T(), keys = [];
      while (keys.length < 48) { var v = rnd.int(1, 199); if (keys.indexOf(v) === -1) keys.push(v); }
      keys.forEach(function (v) {
        var id = 'k' + v;
        t.add(id, v);
        if (!t.root) { t.root = id; return; }
        var cur = t.root;
        while (true) { var side = v < t.n[cur].value ? 'left' : 'right'; if (!t.n[cur][side]) { t.n[cur][side] = id; break; } cur = t.n[cur][side]; }
      });
      var steps = [t.snap({ caption: '48 keys inserted in random order.' })];
      [keys[17], keys[40], keys[5]].forEach(function (target) {
        var cur = t.root, path = [], edges = {};
        while (cur) {
          path.push(cur);
          var m = {}; path.forEach(function (p) { m[p] = 'visited'; }); m[cur] = t.n[cur].value === target ? 'found' : 'compare';
          steps.push(t.snap({ mark: m, edges: Object.assign({}, edges), ptrs: [{ name: 'find ' + target, target: cur, state: t.n[cur].value === target ? 'found' : 'active' }], caption: 'Search ' + target + ' — depth ' + (path.length - 1) + '.' }));
          if (t.n[cur].value === target) break;
          var nx = target < t.n[cur].value ? t.n[cur].left : t.n[cur].right;
          if (nx) edges[cur + '-' + nx] = 'path';
          cur = nx;
        }
      });
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });
}());
