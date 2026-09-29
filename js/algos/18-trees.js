/* Lesson 18 · Trees & traversals — pure step generators (no DOM).

   Browser: VDSA.algos.lesson18.traceSteps(tree, 'in', 'recursive') …   (loaded after js/vdsa/core.js)
   Node:    require('js/algos/18-trees.js')

   A binary tree is plain data: {root: id | null, nodes: {id: {id, value, left, right}}, order: [ids in creation order]}.
   Ids ('n0', 'n1', …) are the identity of a node; values are only labels and may repeat.
   Trees come from a level-order list with '#' for an empty place (fromLevel / parseLevel), from nested arrays
   (fromShape) or from the shape builders (perfect, complete, degenerate).

   A step is a complete snapshot for VDSA.views.tree (+ array / callstack / stack / queue views):
     root, nodes: [{id, value, left, right, state?, badge?, returnValue?}]   states follow VDSA.STATES
     edges     {'parentId-childId': 'path'}          the chain of calls that is running
     pointers  [{name, target, state}]               the node in hand
     out       [ids visited so far, in order]        outValues: the same as labels
     frames    [{id, fn, args, state?, returnValue?}]  the recursion call stack (bottom first)
     stack / queue  [{id, value}]                    the explicit stack (bottom first) or queue (front first)
     tour      token position on the Euler tour: 0 = before the walk, k = at stop k, 3n + 1 = the walk is over; null = none
   plus the player fields: caption (why), line (code label(s)), vars, varStates, counters, flow (flowchart node id), kind.

   Colours: swap = the node written to the output right now, done = already in the output, active = the node being worked on,
   frontier = waiting on the call stack / stack / queue. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.lesson18 = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var MAX_NODES = 15;
  var NULL_TOKENS = { '#': 1, 'null': 1, '_': 1, '.': 1, 'none': 1, 'x': 1 };

  /* ================================================================== tree data */
  function empty() { return { root: null, nodes: {}, order: [] }; }
  function addNode(t, value) {
    var id = 'n' + t.order.length;
    t.nodes[id] = { id: id, value: value, left: null, right: null };
    t.order.push(id);
    return id;
  }

  /* LeetCode-style level order: tokens[0] is the root; then, for each existing node in level order, its left and right
     token. null / undefined / '#' hold a place but have no children. */
  function fromLevel(tokens) {
    var t = empty();
    if (!tokens || !tokens.length || tokens[0] === null || tokens[0] === undefined || tokens[0] === '#') return t;
    t.root = addNode(t, tokens[0]);
    var queue = [t.root], i = 1;
    while (queue.length && i < tokens.length) {
      var cur = t.nodes[queue.shift()];
      var side, k;
      for (k = 0; k < 2; k++) {
        side = k === 0 ? 'left' : 'right';
        if (i >= tokens.length) break;
        var tok = tokens[i++];
        if (tok !== null && tok !== undefined && tok !== '#') { cur[side] = addNode(t, tok); queue.push(cur[side]); }
      }
    }
    return t;
  }

  /* '5 3 8 # 4' → {tree, error}. Friendly errors; at most maxNodes nodes. */
  function parseLevel(text, o) {
    o = o || {};
    var max = o.maxNodes || MAX_NODES;
    var raw = String(text === undefined || text === null ? '' : text).replace(/[\[\]"']/g, ' ').split(/[\s,;]+/).filter(function (s) { return s.length; });
    if (!raw.length) return { tree: null, error: 'Type at least one value. The first value is the root.' };
    var tokens = [], k, tok;
    for (k = 0; k < raw.length; k++) {
      tok = raw[k];
      if (NULL_TOKENS[tok.toLowerCase()]) { tokens.push('#'); continue; }
      if (tok.length > 3) return { tree: null, error: '“' + tok + '” is too long: use values of up to 3 characters, or # for an empty place.' };
      if (!/^[A-Za-z0-9−-]+$/.test(tok)) return { tree: null, error: '“' + tok + '” is not a value: use letters, digits, or # for an empty place.' };
      tokens.push(/^-?\d+$/.test(tok) ? Number(tok) : tok.replace('−', '-'));
    }
    if (tokens[0] === '#') return { tree: null, error: 'The first value is the root, so it cannot be #.' };
    // walk the tokens exactly like fromLevel does, to find values that have no free place to hang from
    var pending = 1, i = 1;
    while (pending > 0 && i < tokens.length) {
      pending -= 1;
      for (var s = 0; s < 2 && i < tokens.length; s++) { if (tokens[i] !== '#') pending += 1; i += 1; }
    }
    if (i < tokens.length) return { tree: null, error: 'Too many values: from “' + raw[i] + '” on there is no free place to hang them. A # holds a place but has no children of its own.' };
    var t = fromLevel(tokens);
    if (t.order.length > max) return { tree: null, error: 'That is ' + t.order.length + ' nodes; this lab holds up to ' + max + '.' };
    return { tree: t, error: null };
  }

  /* nested arrays: [value, left, right]; left/right may be null, an array, or omitted */
  function fromShape(shape) {
    var t = empty();
    function build(s) {
      if (!s) return null;
      var id = addNode(t, s[0]);
      t.nodes[id].left = build(s[1]);
      t.nodes[id].right = build(s[2]);
      return id;
    }
    t.root = build(shape);
    return t;
  }

  function range1(n) { var a = []; for (var i = 1; i <= n; i++) a.push(i); return a; }
  function perfect(h) { return fromLevel(range1(Math.pow(2, h + 1) - 1)); }
  function complete(n) { return fromLevel(range1(n)); }
  /* a chain: every node has one child */
  function degenerate(n, side) {
    var tokens = [1];
    for (var i = 2; i <= n; i++) {
      if (side === 'left') { tokens.push(i, '#'); } else { tokens.push('#', i); }
    }
    // tokens for a right chain: 1 # 2 # 3 …  (the '#' is the left child, each node then carries the next one on the right)
    return fromLevel(tokens);
  }
  /* full but not complete: every node has 0 or 2 children, with a gap in the last level */
  function fullNotComplete() { return fromLevel([1, 2, 3, '#', '#', 4, 5]); }

  function levelTokens(t) {
    // inverse of fromLevel (trailing # removed)
    if (t.root === null) return [];
    var out = [], q = [t.root];
    while (q.length) {
      var id = q.shift();
      if (id === null) { out.push('#'); continue; }
      out.push(t.nodes[id].value);
      q.push(t.nodes[id].left, t.nodes[id].right);
    }
    while (out.length && out[out.length - 1] === '#') out.pop();
    return out;
  }

  /* a random binary search tree shape from a shuffled key order (values = insertion keys) */
  function randomTree(n, rng) {
    var keys = [], i;
    for (i = 1; i <= n; i++) keys.push(i);
    for (i = n - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var tmp = keys[i]; keys[i] = keys[j]; keys[j] = tmp; }
    var t = empty();
    keys.forEach(function (k) {
      var id = addNode(t, k);
      if (t.root === null) { t.root = id; return; }
      var cur = t.root;
      for (;;) {
        var side = k < t.nodes[cur].value ? 'left' : 'right';
        if (t.nodes[cur][side] === null) { t.nodes[cur][side] = id; return; }
        cur = t.nodes[cur][side];
      }
    });
    return t;
  }

  /* ================================================================== facts about a tree */
  function label(t, id) { return id === null || id === undefined ? '∅' : String(t.nodes[id].value); }
  function size(t) { return t.order.length; }
  function heightOf(t, id) {
    if (id === null || id === undefined) return -1;
    var n = t.nodes[id];
    return 1 + Math.max(heightOf(t, n.left), heightOf(t, n.right));
  }
  function height(t) { return heightOf(t, t.root); }
  function depths(t) {
    var d = {};
    (function go(id, k) { if (id === null) return; d[id] = k; go(t.nodes[id].left, k + 1); go(t.nodes[id].right, k + 1); }(t.root, 0));
    return d;
  }
  function parents(t) {
    var p = {};
    Object.keys(t.nodes).forEach(function (id) {
      var n = t.nodes[id];
      if (n.left !== null) p[n.left] = id;
      if (n.right !== null) p[n.right] = id;
    });
    return p;
  }
  function childrenOf(t, id) { var n = t.nodes[id], c = []; if (n.left !== null) c.push(n.left); if (n.right !== null) c.push(n.right); return c; }
  function subtreeIds(t, id) {
    var out = [];
    (function go(x) { if (x === null || x === undefined) return; out.push(x); go(t.nodes[x].left); go(t.nodes[x].right); }(id));
    return out;
  }
  function levelWidths(t) {
    var d = depths(t), w = [];
    Object.keys(d).forEach(function (id) { w[d[id]] = (w[d[id]] || 0) + 1; });
    return w;
  }

  /* full, complete, perfect, degenerate */
  function shapeInfo(t) {
    var n = size(t), h = height(t);
    var full = true, degenerate = n > 0, perfectShape = n > 0 && n === Math.pow(2, h + 1) - 1;
    Object.keys(t.nodes).forEach(function (id) {
      var nd = t.nodes[id], k = (nd.left !== null ? 1 : 0) + (nd.right !== null ? 1 : 0);
      if (k === 1) full = false;
      if (k === 2) degenerate = false;
    });
    // complete: level-order positions are exactly 0..n-1 (heap numbering)
    var complete = true;
    (function go(id, i) {
      if (id === null) return;
      if (i >= n) complete = false;
      go(t.nodes[id].left, 2 * i + 1);
      go(t.nodes[id].right, 2 * i + 2);
    }(t.root, 0));
    return { n: n, height: h, full: full, complete: complete, perfect: perfectShape, degenerate: degenerate && n > 0, edges: Math.max(0, n - 1) };
  }
  function minHeight(n) { return n < 1 ? -1 : Math.floor(Math.log2(n)); }
  function maxHeight(n) { return n - 1; }

  /* heap numbering of a complete tree */
  function indexInfo(i, n) {
    var l = 2 * i + 1, r = 2 * i + 2;
    return { index: i, parent: i === 0 ? null : Math.floor((i - 1) / 2), left: l < n ? l : null, right: r < n ? r : null };
  }

  /* ================================================================== the four orders (reference implementations) */
  function preorder(t) { var o = []; (function go(id) { if (id === null) return; o.push(id); go(t.nodes[id].left); go(t.nodes[id].right); }(t.root)); return o; }
  function inorder(t) { var o = []; (function go(id) { if (id === null) return; go(t.nodes[id].left); o.push(id); go(t.nodes[id].right); }(t.root)); return o; }
  function postorder(t) { var o = []; (function go(id) { if (id === null) return; go(t.nodes[id].left); go(t.nodes[id].right); o.push(id); }(t.root)); return o; }
  function levelorder(t) {
    var o = [], q = t.root === null ? [] : [t.root];
    while (q.length) { var id = q.shift(); o.push(id); var n = t.nodes[id]; if (n.left !== null) q.push(n.left); if (n.right !== null) q.push(n.right); }
    return o;
  }
  function orders(t) { return { pre: preorder(t), in: inorder(t), post: postorder(t), level: levelorder(t) }; }
  function valuesOf(t, ids) { return ids.map(function (id) { return t.nodes[id].value; }); }

  /* The Euler tour: walk around the tree, keeping it on your left. Each node is touched three times:
     on the way down (pre), when you come back up from the left (in), and when you leave it (post). 3n stops. */
  function eulerStops(t) {
    var stops = [];
    (function go(id) {
      if (id === null) return;
      var n = t.nodes[id];
      stops.push({ id: id, kind: 'pre' });
      go(n.left);
      stops.push({ id: id, kind: 'in' });
      go(n.right);
      stops.push({ id: id, kind: 'post' });
    }(t.root));
    return stops;
  }
  /* map 'id:kind' → token position (1-based; 0 is "before the walk", 3n + 1 is "the walk is over") */
  function stopPositions(t) {
    var m = {};
    eulerStops(t).forEach(function (s, i) { m[s.id + ':' + s.kind] = i + 1; });
    return m;
  }

  /* peaks used by the cost chart */
  function peakStack(t) { return t.root === null ? 0 : height(t) + 1; }   // recursive DFS: one frame per node on the path
  function peakQueue(t) {
    var q = t.root === null ? [] : [t.root], peak = q.length;
    while (q.length) {
      var id = q.shift(), n = t.nodes[id];
      if (n.left !== null) q.push(n.left);
      if (n.right !== null) q.push(n.right);
      peak = Math.max(peak, q.length);
    }
    return peak;
  }
  function peakExplicitStack(t, order) { return run(t, order, 'stack').peak; }

  /* ================================================================== code (Pseudocode / JavaScript / Python) */
  var CODE = {};
  (function () {
    var names = { pre: 'preorder', in: 'inorder', post: 'postorder' };
    function rec(order) {
      var f = names[order], F = f.toUpperCase();
      var pseudo = ['procedure ' + F + '(node)  // @sig'];
      var js = ['function ' + f + '(node, out) {  // @sig'];
      var py = ['def ' + f + '(node, out):  # @sig'];
      var seq = order === 'pre' ? ['v', 'l', 'r'] : order === 'in' ? ['l', 'v', 'r'] : ['l', 'r', 'v'];
      seq.forEach(function (s) {
        if (s === 'v') { pseudo.push('  visit(node)  // @visit'); js.push('  out.push(node.value);  // @visit'); py.push('    out.append(node.value)  # @visit'); }
        if (s === 'l') { pseudo.push('  if left child: ' + F + '(node.left)  // @left'); js.push('  if (node.left)  ' + f + '(node.left, out);  // @left'); py.push('    if node.left:  ' + f + '(node.left, out)  # @left'); }
        if (s === 'r') { pseudo.push('  if right child: ' + F + '(node.right)  // @right'); js.push('  if (node.right) ' + f + '(node.right, out);  // @right'); py.push('    if node.right: ' + f + '(node.right, out)  # @right'); }
      });
      pseudo.push('end procedure  // @ret', '', F + '(root)  // @start');
      js.push('}  // @ret', '', 'const out = [];  // @start', f + '(root, out);  // @start');
      py.push('    return  # @ret', '', 'out = []  # @start', f + '(root, out)  # @start');
      return { pseudo: pseudo.join('\n'), js: js.join('\n'), py: py.join('\n') };
    }
    CODE['recursive-pre'] = rec('pre');
    CODE['recursive-in'] = rec('in');
    CODE['recursive-post'] = rec('post');

    CODE['stack-pre'] = {
      pseudo: [
        'stack ← [root]                                  // @init',
        'while stack is not empty                        // @loop',
        '  node ← pop(stack)                             // @pop',
        '  visit(node)                                   // @visit',
        '  if node has a right child: push it  // @pushR',
        '  if node has a left child: push it             // @pushL'
      ].join('\n'),
      js: [
        'function preorder(root) {',
        '  const out = [], stack = [root];               // @init',
        '  while (stack.length) {                        // @loop',
        '    const node = stack.pop();                   // @pop',
        '    out.push(node.value);                       // @visit',
        '    if (node.right) stack.push(node.right);     // @pushR',
        '    if (node.left)  stack.push(node.left);      // @pushL',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      py: [
        'def preorder(root):',
        '    out, stack = [], [root]                     # @init',
        '    while stack:                                # @loop',
        '        node = stack.pop()                      # @pop',
        '        out.append(node.value)                  # @visit',
        '        if node.right: stack.append(node.right) # @pushR',
        '        if node.left:  stack.append(node.left)  # @pushL',
        '    return out'
      ].join('\n')
    };
    CODE['stack-in'] = {
      pseudo: [
        'stack ← [ ],  cur ← root                        // @init',
        'while cur exists or stack is not empty           // @loop',
        '  while cur exists                              // @descend',
        '    push(stack, cur);  cur ← cur.left           // @push',
        '  node ← pop(stack)                             // @pop',
        '  visit(node)                                   // @visit',
        '  cur ← node.right                              // @right'
      ].join('\n'),
      js: [
        'function inorder(root) {',
        '  const out = [], stack = [];                   // @init',
        '  let cur = root;                               // @init',
        '  while (cur || stack.length) {                 // @loop',
        '    while (cur) {                               // @descend',
        '      stack.push(cur);                          // @push',
        '      cur = cur.left;                           // @push',
        '    }',
        '    const node = stack.pop();                   // @pop',
        '    out.push(node.value);                       // @visit',
        '    cur = node.right;                           // @right',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      py: [
        'def inorder(root):',
        '    out, stack = [], []                         # @init',
        '    cur = root                                  # @init',
        '    while cur or stack:                         # @loop',
        '        while cur:                              # @descend',
        '            stack.append(cur)                   # @push',
        '            cur = cur.left                      # @push',
        '        node = stack.pop()                      # @pop',
        '        out.append(node.value)                  # @visit',
        '        cur = node.right                        # @right',
        '    return out'
      ].join('\n')
    };
    CODE['stack-post'] = {
      pseudo: [
        'stack ← [ ],  cur ← root,  last ← nothing       // @init',
        'while cur exists or stack is not empty           // @loop',
        '  if cur exists                                 // @test',
        '    push(stack, cur);  cur ← cur.left           // @push',
        '  else                                          // @peek',
        '    top ← the top of stack, not removed         // @peek',
        '    if top has a right child that is not last   // @checkR',
        '      cur ← top.right                           // @goR',
        '    else                                        // @visit',
        '      visit(top);  last ← pop(stack)            // @visit'
      ].join('\n'),
      js: [
        'function postorder(root) {',
        '  const out = [], stack = [];                   // @init',
        '  let cur = root, last = null;                  // @init',
        '  while (cur || stack.length) {                 // @loop',
        '    if (cur) {                                  // @test',
        '      stack.push(cur);                          // @push',
        '      cur = cur.left;                           // @push',
        '    } else {',
        '      const top = stack[stack.length - 1];      // @peek',
        '      if (top.right && top.right !== last) {    // @checkR',
        '        cur = top.right;                        // @goR',
        '      } else {',
        '        out.push(top.value);                    // @visit',
        '        last = stack.pop();                     // @visit',
        '      }',
        '    }',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      py: [
        'def postorder(root):',
        '    out, stack = [], []                         # @init',
        '    cur, last = root, None                      # @init',
        '    while cur or stack:                         # @loop',
        '        if cur:                                 # @test',
        '            stack.append(cur)                   # @push',
        '            cur = cur.left                      # @push',
        '        else:',
        '            top = stack[-1]                     # @peek',
        '            if top.right and top.right is not last:  # @checkR',
        '                cur = top.right                 # @goR',
        '            else:',
        '                out.append(top.value)           # @visit',
        '                last = stack.pop()              # @visit',
        '    return out'
      ].join('\n')
    };
    CODE['queue-level'] = {
      pseudo: [
        'queue ← [root]                                  // @init',
        'while queue is not empty                        // @loop',
        '  node ← dequeue(queue)                         // @deq',
        '  visit(node)                                   // @visit',
        '  if node has a left child: enqueue it          // @enqL',
        '  if node has a right child: enqueue it         // @enqR'
      ].join('\n'),
      js: [
        'function levelOrder(root) {',
        '  const out = [], queue = [root];               // @init',
        '  while (queue.length) {                        // @loop',
        '    const node = queue.shift();                 // @deq',
        '    out.push(node.value);                       // @visit',
        '    if (node.left)  queue.push(node.left);      // @enqL',
        '    if (node.right) queue.push(node.right);     // @enqR',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      py: [
        'from collections import deque',
        '',
        'def level_order(root):',
        '    out, queue = [], deque([root])              # @init',
        '    while queue:                                # @loop',
        '        node = queue.popleft()                  # @deq',
        '        out.append(node.value)                  # @visit',
        '        if node.left:  queue.append(node.left)  # @enqL',
        '        if node.right: queue.append(node.right) # @enqR',
        '    return out'
      ].join('\n')
    };

    CODE.height = {
      pseudo: [
        'function HEIGHT(node)                           // @sig',
        '  l ← HEIGHT(node.left) if it exists, else −1   // @left',
        '  r ← HEIGHT(node.right) if it exists, else −1  // @right',
        '  return 1 + max(l, r)                          // @combine'
      ].join('\n'),
      js: [
        'function height(node) {                                 // @sig',
        '  const l = node.left  ? height(node.left)  : -1;       // @left',
        '  const r = node.right ? height(node.right) : -1;       // @right',
        '  return 1 + Math.max(l, r);                            // @combine',
        '}'
      ].join('\n'),
      py: [
        'def height(node):                                       # @sig',
        '    l = height(node.left)  if node.left  else -1        # @left',
        '    r = height(node.right) if node.right else -1        # @right',
        '    return 1 + max(l, r)                                # @combine'
      ].join('\n')
    };
    CODE.count = {
      pseudo: [
        'function COUNT(node)                            // @sig',
        '  l ← COUNT(node.left) if it exists, else 0     // @left',
        '  r ← COUNT(node.right) if it exists, else 0    // @right',
        '  return 1 + l + r                              // @combine'
      ].join('\n'),
      js: [
        'function count(node) {                                  // @sig',
        '  const l = node.left  ? count(node.left)  : 0;         // @left',
        '  const r = node.right ? count(node.right) : 0;         // @right',
        '  return 1 + l + r;                                     // @combine',
        '}'
      ].join('\n'),
      py: [
        'def count(node):                                        # @sig',
        '    l = count(node.left)  if node.left  else 0          # @left',
        '    r = count(node.right) if node.right else 0          # @right',
        '    return 1 + l + r                                    # @combine'
      ].join('\n')
    };
    CODE.eval = {
      pseudo: [
        'function EVALUATE(node)                         // @sig',
        '  if node is a number: return it                // @leaf',
        '  a ← EVALUATE(node.left)                       // @left',
        '  b ← EVALUATE(node.right)                      // @right',
        '  return a (node.operator) b                    // @combine'
      ].join('\n'),
      js: [
        'function evaluate(node) {                               // @sig',
        '  if (!node.left) return node.value;                    // @leaf',
        '  const a = evaluate(node.left);                        // @left',
        '  const b = evaluate(node.right);                       // @right',
        '  return apply(node.value, a, b);                       // @combine',
        '}'
      ].join('\n'),
      py: [
        'def evaluate(node):                                     # @sig',
        '    if not node.left: return node.value                 # @leaf',
        '    a = evaluate(node.left)                             # @left',
        '    b = evaluate(node.right)                            # @right',
        '    return apply(node.value, a, b)                      # @combine'
      ].join('\n')
    };
    CODE.folder = {
      pseudo: [
        'function SIZE(node)                             // @sig',
        '  total ← node.size                             // @own',
        '  for each child of node                        // @loop',
        '    total ← total + SIZE(child)                 // @add',
        '  return total                                  // @ret'
      ].join('\n'),
      js: [
        'function size(node) {                           // @sig',
        '  let total = node.size;                        // @own',
        '  for (const child of node.children)            // @loop',
        '    total += size(child);                       // @add',
        '  return total;                                 // @ret',
        '}'
      ].join('\n'),
      py: [
        'def size(node):                                 # @sig',
        '    total = node.size                           # @own',
        '    for child in node.children:                 # @loop',
        '        total += size(child)                    # @add',
        '    return total                                # @ret'
      ].join('\n')
    };
  }());

  /* ================================================================== traversal traces */
  var FN = { pre: 'preorder', in: 'inorder', post: 'postorder', level: 'levelOrder' };
  var ORDER_NAME = { pre: 'preorder', in: 'inorder', post: 'postorder', level: 'level order' };
  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function b(t, id) { return '<b>' + esc(label(t, id)) + '</b>'; }

  /* The builder holds the mutable run state and turns it into snapshots. */
  function builder(t, cfg) {
    var S = { visited: [], vset: {}, frames: [], stack: [], queue: [], cur: null, pos: cfg.tour ? 0 : null, just: null, peak: 0, calls: 0, edges: {}, pname: cfg.pname || 'node' };
    var steps = [];
    function counters() {
      var c = { visited: S.visited.length };
      if (cfg.method === 'recursive') { c.depth = S.frames.length; c.peak = S.peak; }
      else if (cfg.method === 'stack') { c.stackSize = S.stack.length; c.peak = S.peak; }
      else { c.queueSize = S.queue.length; c.peak = S.peak; }
      return c;
    }
    function snap(o) {
      var states = {};
      S.frames.forEach(function (f) { states[f.nid] = 'frontier'; });
      S.stack.forEach(function (id) { states[id] = 'frontier'; });
      S.queue.forEach(function (id) { states[id] = 'frontier'; });
      if (S.cur !== null) states[S.cur] = 'active';
      S.visited.forEach(function (id) { states[id] = 'done'; });
      if (S.just !== null) states[S.just] = 'swap';
      var nodes = t.order.map(function (id) {
        var n = t.nodes[id];
        return { id: id, value: n.value, left: n.left, right: n.right, state: states[id] || 'default' };
      });
      var edges = {};
      if (cfg.method === 'recursive') {
        for (var i = 1; i < S.frames.length; i++) edges[S.frames[i - 1].nid + '-' + S.frames[i].nid] = 'path';
      }
      var pointers = S.cur !== null && cfg.method !== 'recursive' ? [{ name: S.pname, target: S.cur, state: 'active' }] : [];
      var vars = {};
      vars[S.pname] = S.cur === null ? null : label(t, S.cur);
      if (o.vars) Object.keys(o.vars).forEach(function (k) { vars[k] = o.vars[k]; });
      if (cfg.method === 'stack') vars.stack = S.stack.map(function (id) { return label(t, id); });
      if (cfg.method === 'queue') vars.queue = S.queue.map(function (id) { return label(t, id); });
      vars.out = S.visited.map(function (id) { return label(t, id); });
      var step = {
        kind: o.kind, caption: o.caption, line: o.line === undefined ? null : o.line, vars: vars,
        counters: counters(), flow: o.flow, root: t.root, nodes: nodes, edges: edges, pointers: pointers,
        out: S.visited.slice(), outValues: S.visited.map(function (id) { return t.nodes[id].value; }), just: S.just,
        frames: S.frames.map(function (f) { return { id: f.id, fn: f.fn, args: f.args }; }),
        stack: S.stack.map(function (id) { return { id: 's' + id, nid: id, value: t.nodes[id].value }; }),
        queue: S.queue.map(function (id) { return { id: 'q' + id, nid: id, value: t.nodes[id].value }; }),
        tour: S.pos, order: cfg.order, method: cfg.method
      };
      steps.push(step);
      S.just = null;
      return step;
    }
    function visit(id) { S.visited.push(id); S.vset[id] = true; S.just = id; }
    function bump(k) { S.peak = Math.max(S.peak, k); }
    return { S: S, steps: steps, snap: snap, visit: visit, bump: bump, tree: t };
  }

  /* Recursive depth-first traversal in the three orders. Three steps per node: call, visit, return. */
  function traceRecursive(t, order) {
    var bd = builder(t, { order: order, method: 'recursive', tour: true }), S = bd.S;
    var fn = FN[order];
    var sp = stopPositions(t), total = 3 * size(t);
    var pointName = 'node';
    S.pname = pointName;
    var pointLabel = { pre: 'before its children', in: 'between its children', post: 'after its children' }[order];
    bd.snap({ kind: 'start', line: 'start', flow: 'call',
      caption: 'Nothing is visited yet, and the call stack is empty. <b>' + ORDER_NAME[order] + '</b> means: visit each node ' + pointLabel + '. The walk starts with a call on the root.' });
    function rec(id, parentId, side) {
      var n = t.nodes[id];
      S.frames.push({ id: 'f' + id, nid: id, fn: fn, args: 'node=' + label(t, id) });
      S.cur = id; S.calls += 1; bd.bump(S.frames.length);
      S.pos = sp[id + ':pre'];
      bd.snap({ kind: 'call', line: parentId === null ? ['start', 'sig'] : [side, 'sig'], flow: 'call',
        caption: parentId === null
          ? 'Call <code>' + fn + '(' + esc(label(t, id)) + ')</code> on the root. A frame for it goes on the call stack; the token starts on the tour at the left of ' + b(t, id) + '.'
          : b(t, parentId) + ' calls <code>' + fn + '</code> on its ' + side + ' child ' + b(t, id) + '. The frame of ' + b(t, parentId) + ' stays on the stack, waiting: it has work left after this call returns.' });
      var hasL = n.left !== null, hasR = n.right !== null;
      function doVisit(point) {
        bd.visit(id);
        S.pos = sp[id + ':' + point];
        var why;
        if (point === 'pre') why = 'Preorder visits a node <em>before</em> its children, so ' + b(t, id) + ' goes into the output right now, on the way down.';
        else if (point === 'in') why = hasL
          ? 'The left subtree of ' + b(t, id) + ' is finished, and the right one has not started. Inorder visits a node <em>between</em> its children, so ' + b(t, id) + ' goes into the output now.'
          : b(t, id) + ' has no left child, so nothing stands between arriving and “between the children”. Inorder visits it now, before its right side.';
        else why = hasL || hasR
          ? 'Both subtrees of ' + b(t, id) + ' are finished. Postorder visits a node <em>after</em> its children, so ' + b(t, id) + ' goes into the output now.'
          : b(t, id) + ' is a leaf: it has no children to wait for. Postorder visits it at once.';
        bd.snap({ kind: 'visit', line: 'visit', flow: point,
          caption: why + ' Output so far: ' + S.visited.map(function (x) { return esc(label(t, x)); }).join(', ') + '.' });
      }
      if (order === 'pre') doVisit('pre');
      if (hasL) rec(n.left, id, 'left');
      if (order === 'in') doVisit('in');
      if (hasR) rec(n.right, id, 'right');
      if (order === 'post') doVisit('post');
      // return: pop the frame
      S.frames.pop();
      S.pos = sp[id + ':post'];
      S.cur = parentId === null ? null : parentId;
      bd.snap({ kind: 'return', line: 'ret', flow: 'ret',
        caption: parentId === null
          ? 'The root’s call finishes. The stack is empty: every node has been visited exactly once.'
          : '<code>' + fn + '(' + esc(label(t, id)) + ')</code> has nothing left to do, so it returns and its frame is popped. Control goes back to ' + b(t, parentId) + ', which continues after its ' + side + ' call.' });
    }
    if (t.root !== null) rec(t.root, null, null);
    S.pos = total + 1;
    bd.snap({ kind: 'end', line: null, flow: 'ret',
      caption: 'Done. The walk went once around the tree and back, and the output is ' + S.visited.map(function (x) { return esc(label(t, x)); }).join(', ') + '. The call stack was never deeper than <b>' + S.peak + '</b> frames: the height plus one.' });
    return { steps: bd.steps, peak: S.peak, out: S.visited.slice() };
  }

  /* Depth-first with an explicit stack. */
  function traceStack(t, order) {
    var bd = builder(t, { order: order, method: 'stack', tour: false }), S = bd.S;
    var vis = function (id, text) { return text; };
    function listOut() { return S.visited.map(function (x) { return esc(label(t, x)); }).join(', '); }
    S.pname = order === 'in' || order === 'post' ? 'cur' : 'node';
    if (t.root === null) { bd.snap({ kind: 'end', caption: 'The tree is empty: nothing to visit.' }); return { steps: bd.steps, peak: 0, out: [] }; }

    if (order === 'pre') {
      S.stack.push(t.root); bd.bump(1);
      bd.snap({ kind: 'init', line: 'init',
        caption: 'The explicit stack does the job of the call stack. Start by pushing the root: ' + b(t, t.root) + ' is the only unfinished work.' });
      while (S.stack.length) {
        var id = S.stack.pop(); S.cur = id;
        bd.snap({ kind: 'pop', line: ['loop', 'pop'],
          caption: 'The stack is not empty, so pop its top: ' + b(t, id) + '. The stack is last-in first-out, so the most recently pushed node comes out first.' });
        bd.visit(id);
        bd.snap({ kind: 'visit', line: 'visit',
          caption: 'Preorder visits a node before anything below it, so ' + b(t, id) + ' goes into the output now. Output so far: ' + listOut() + '.' });
        var n = t.nodes[id];
        if (n.right !== null) {
          S.stack.push(n.right); bd.bump(S.stack.length);
          bd.snap({ kind: 'push', line: 'pushR',
            caption: 'Push the right child ' + b(t, n.right) + ' first. It will come out <em>last</em> of the two, because whatever is pushed last is popped first.' });
        }
        if (n.left !== null) {
          S.stack.push(n.left); bd.bump(S.stack.length);
          bd.snap({ kind: 'push', line: 'pushL',
            caption: 'Then push the left child ' + b(t, n.left) + '. It lands on top, so the whole left subtree is finished before the right child is even popped.' });
        }
        if (n.left === null && n.right === null) {
          S.cur = null;
          bd.snap({ kind: 'note', line: 'pushL',
            caption: b(t, id) + ' is a leaf: there is nothing to push, so the next pop goes back to the most recent unfinished node.' });
        } else S.cur = null;
      }
    }

    if (order === 'in') {
      var cur = t.root;
      bd.snap({ kind: 'init', line: 'init',
        caption: 'Inorder cannot visit a node when it first meets it: its left subtree comes first. So walk left as far as possible, remembering the way back on a stack. <code>cur</code> starts at the root.' });
      S.cur = cur;
      while (cur !== null || S.stack.length) {
        while (cur !== null) {
          S.stack.push(cur); bd.bump(S.stack.length);
          var nx = t.nodes[cur].left;
          var pushed = cur;
          S.cur = nx;
          cur = nx;
          bd.snap({ kind: 'push', line: ['descend', 'push'],
            caption: 'Push ' + b(t, pushed) + ': it must wait until its left subtree is done. Then <code>cur</code> moves to its left child' + (nx === null ? ', which is empty. The way left is blocked.' : ' ' + b(t, nx) + '.') });
        }
        var node = S.stack.pop(); S.cur = node;
        bd.snap({ kind: 'pop', line: 'pop',
          caption: '<code>cur</code> is empty, so nothing is left on this side. Pop the most recent waiting node: ' + b(t, node) + '. Its left subtree is completely visited.' });
        bd.visit(node);
        bd.snap({ kind: 'visit', line: 'visit',
          caption: 'Left side finished, right side not started: inorder visits ' + b(t, node) + ' now. Output so far: ' + listOut() + '.' });
        cur = t.nodes[node].right;
        S.cur = cur;
        bd.snap({ kind: 'right', line: 'right',
          caption: cur === null
            ? b(t, node) + ' has no right child, so <code>cur</code> becomes empty. The next round will pop the next waiting node.'
            : 'Now the right subtree: <code>cur</code> moves to ' + b(t, cur) + ', and the same walk-left-and-remember starts again there.' });
      }
    }

    if (order === 'post') {
      var cu = t.root, last = null;
      bd.snap({ kind: 'init', line: 'init',
        caption: 'Postorder visits a node last, so a node stays on the stack until both children are done. <code>last</code> remembers the node visited most recently, to tell “coming back from the right” from “about to go right”.' });
      S.cur = cu;
      while (cu !== null || S.stack.length) {
        if (cu !== null) {
          S.stack.push(cu); bd.bump(S.stack.length);
          var pu = cu;
          cu = t.nodes[cu].left; S.cur = cu;
          bd.snap({ kind: 'push', line: ['test', 'push'],
            caption: 'Push ' + b(t, pu) + ' and go left' + (cu === null ? ': there is no left child, so <code>cur</code> becomes empty.' : ' to ' + b(t, cu) + '.') });
        } else {
          var top = S.stack[S.stack.length - 1];
          var tn = t.nodes[top];
          S.cur = top;
          if (tn.right !== null && tn.right !== last) {
            cu = tn.right; S.cur = cu;
            bd.snap({ kind: 'goRight', line: ['peek', 'checkR', 'goR'],
              caption: 'Look at the top, ' + b(t, top) + ', without removing it. Its right child ' + b(t, tn.right) + ' has not been visited, so the walk goes there first.' });
          } else {
            S.stack.pop();
            bd.visit(top); last = top;
            bd.snap({ kind: 'visit', line: ['peek', 'checkR', 'visit'],
              caption: 'Look at the top, ' + b(t, top) + ': ' + (tn.right === null ? 'it has no right child' : 'its right child was just visited') + ', so both sides are done. Pop it and visit it. Output so far: ' + listOut() + '.' });
            S.cur = null;
          }
        }
      }
    }
    S.cur = null;
    bd.snap({ kind: 'end', line: 'loop',
      caption: 'The stack is empty and <code>cur</code> has nowhere to go: every node was visited once. Output: ' + listOut() + '. The stack held at most <b>' + S.peak + '</b> nodes at once.' });
    return { steps: bd.steps, peak: S.peak, out: S.visited.slice() };
  }

  /* Breadth-first with a queue. */
  function traceLevel(t) {
    var bd = builder(t, { order: 'level', method: 'queue', tour: false }), S = bd.S;
    function listOut() { return S.visited.map(function (x) { return esc(label(t, x)); }).join(', '); }
    if (t.root === null) { bd.snap({ kind: 'end', caption: 'The tree is empty: nothing to visit.' }); return { steps: bd.steps, peak: 0, out: [] }; }
    S.queue.push(t.root); bd.bump(1);
    bd.snap({ kind: 'init', line: 'init', flow: 'init',
      caption: 'Level order uses a <em>queue</em>: first in, first out. Start with the root waiting in line.' });
    while (S.queue.length) {
      var id = S.queue.shift(); S.cur = id;
      bd.snap({ kind: 'dequeue', line: ['loop', 'deq'], flow: 'deq',
        caption: 'The queue is not empty. Take the node at the <em>front</em>: ' + b(t, id) + '. Because children join at the back, everything nearer the root leaves the line first.' });
      bd.visit(id);
      bd.snap({ kind: 'visit', line: 'visit', flow: 'visit',
        caption: 'Visit ' + b(t, id) + ': it goes into the output. Output so far: ' + listOut() + '.' });
      var n = t.nodes[id];
      if (n.left !== null) {
        S.queue.push(n.left); bd.bump(S.queue.length);
        bd.snap({ kind: 'enqueue', line: 'enqL', flow: 'enq', caption: 'Its left child ' + b(t, n.left) + ' joins the back of the queue, behind every node that is already waiting on this level.' });
      }
      if (n.right !== null) {
        S.queue.push(n.right); bd.bump(S.queue.length);
        bd.snap({ kind: 'enqueue', line: 'enqR', flow: 'enq', caption: 'Its right child ' + b(t, n.right) + ' joins the back, right after its sibling.' });
      }
      if (n.left === null && n.right === null) {
        S.cur = null;
        bd.snap({ kind: 'note', line: 'enqR', flow: 'enq', caption: b(t, id) + ' is a leaf: no children to enqueue, so the line just gets shorter.' });
      }
      S.cur = null;
    }
    bd.snap({ kind: 'end', line: 'loop', flow: 'done',
      caption: 'The queue is empty: every node was visited, level by level. Output: ' + listOut() + '. The line was never longer than <b>' + S.peak + '</b>: about the width of the widest level.' });
    return { steps: bd.steps, peak: S.peak, out: S.visited.slice() };
  }

  /* run(tree, 'pre'|'in'|'post'|'level', 'recursive'|'stack') → {steps, peak, out (ids)} */
  function run(t, order, method) {
    if (order === 'level') return traceLevel(t);
    if (method === 'stack') return traceStack(t, order);
    return traceRecursive(t, order);
  }
  function traceSteps(t, order, method) { return run(t, order, method).steps; }
  function codeKey(order, method) { return order === 'level' ? 'queue-level' : (method === 'stack' ? 'stack-' : 'recursive-') + order; }

  /* ================================================================== the Euler tour walk */
  /* One step per stop. Three output rows build as the token passes each dot. */
  function eulerSteps(t) {
    var stops = eulerStops(t), n = size(t), steps = [];
    var rows = { pre: [], in: [], post: [] }, doneNodes = {};
    var kindWord = { pre: 'left dot', in: 'bottom dot', post: 'right dot' };
    var kindText = {
      pre: 'This is the first time the walk touches it, on the way down. Preorder writes it now.',
      in: 'The walk has come back up from the left side (or there was none). Inorder writes it now.',
      post: 'The walk leaves it for the last time: both sides are finished. Postorder writes it now.'
    };
    function snap(pos, cur, kind, caption) {
      var nodes = t.order.map(function (id) {
        var nd = t.nodes[id];
        return { id: id, value: nd.value, left: nd.left, right: nd.right, state: id === cur ? 'key' : doneNodes[id] ? 'done' : 'default' };
      });
      steps.push({
        kind: kind, caption: caption, root: t.root, nodes: nodes, tour: pos, edges: {},
        rows: { pre: rows.pre.slice(), in: rows.in.slice(), post: rows.post.slice() }, cur: cur,
        counters: { pre: rows.pre.length, in: rows.in.length, post: rows.post.length }
      });
    }
    snap(0, null, 'start', 'The Euler tour is one walk around the tree, keeping it on your left, from the top left of the root back to the top right. Each node gets three dots: left (touched on the way down), bottom (back up from the left), right (leaving for good).');
    stops.forEach(function (s, i) {
      rows[s.kind].push(s.id);
      if (s.kind === 'post') doneNodes[s.id] = true;
      snap(i + 1, s.id, s.kind, 'At the <b>' + kindWord[s.kind] + '</b> of ' + b(t, s.id) + '. ' + kindText[s.kind]);
    });
    snap(3 * n + 1, null, 'end', 'The walk is over after ' + (3 * n) + ' stops: 3 × ' + n + ' nodes. Three different orders came from one and the same walk: the only difference is <em>which dot</em> you count.');
    return steps;
  }

  /* ================================================================== postorder computations with return chips */
  function fmtNum(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }
  function applyOp(op, a, c) {
    if (op === '+') return a + c;
    if (op === '−' || op === '-') return a - c;
    if (op === '×' || op === '*') return a * c;
    if (op === '÷' || op === '/') return a / c;
    return NaN;
  }
  function isOp(v) { return v === '+' || v === '−' || v === '-' || v === '×' || v === '*' || v === '÷' || v === '/'; }

  /* kind: 'height' | 'count' | 'eval' */
  function computeSteps(t, kind) {
    var steps = [], frames = [], done = {}, results = {}, cur = null, calls = 0, peak = 0;
    var fn = { height: 'height', count: 'count', eval: 'evaluate' }[kind];
    function snap() {
      var nodes = t.order.map(function (id) {
        var nd = t.nodes[id], st = 'default';
        if (frames.some(function (f) { return f.nid === id; })) st = 'frontier';
        if (id === cur) st = 'active';
        if (done[id]) st = 'done';
        var out = { id: id, value: nd.value, left: nd.left, right: nd.right, state: st };
        if (done[id]) out.returnValue = fmtNum(results[id]);
        return out;
      });
      var edges = {};
      for (var i = 1; i < frames.length; i++) edges[frames[i - 1].nid + '-' + frames[i].nid] = 'path';
      steps.push({
        kind: o.kind, caption: o.caption, line: o.line, flow: o.flow, root: t.root, nodes: nodes, edges: edges,
        frames: frames.map(function (f) { return { id: f.id, fn: f.fn, args: f.args, state: f.state, returnValue: f.returnValue }; }),
        vars: o.vars || {}, counters: { calls: calls, depth: frames.length, peak: peak },
        results: JSON.parse(JSON.stringify(results)), current: cur
      });
    }
    var o = {};
    function emit(x) { o = x; snap(); }
    emit({ kind: 'start', line: null, caption: kind === 'height'
      ? 'The height of a node is the number of links on the longest path down to a leaf. Ask each node for its height, and let every node ask its children first.'
      : kind === 'count' ? 'Count the nodes: each node asks its children how many nodes they hold, then adds itself.'
        : 'Evaluate the expression: each operator waits for the values of its two operands. An operator node cannot be computed until both of its children are.' });
    function rec(id, parentId, side) {
      var n = t.nodes[id];
      frames.push({ id: 'f' + id, nid: id, fn: fn, args: 'node=' + label(t, id) });
      cur = id; calls += 1; peak = Math.max(peak, frames.length);
      emit({ kind: 'call', line: parentId === null ? 'sig' : [side, 'sig'], flow: 'call', vars: { node: label(t, id) },
        caption: parentId === null ? 'Call <code>' + fn + '</code> on the root ' + b(t, id) + '.' : b(t, parentId) + ' needs the value of its ' + side + ' side, so it calls <code>' + fn + '</code> on ' + b(t, id) + ' and waits.' });
      var a = null, c = null;
      if (n.left !== null) { a = rec(n.left, id, 'left'); }
      if (n.right !== null) { c = rec(n.right, id, 'right'); }
      var v, why, ln;
      if (kind === 'height') {
        var hl = n.left === null ? -1 : a, hr = n.right === null ? -1 : c;
        v = 1 + Math.max(hl, hr);
        ln = 'combine';
        why = n.left === null && n.right === null
          ? b(t, id) + ' is a leaf: both sides are empty and an empty side counts as −1, so its height is 1 + max(−1, −1) = <b>0</b>.'
          : 'Height of ' + b(t, id) + ' = 1 + max(' + fmtNum(hl) + ', ' + fmtNum(hr) + ') = <b>' + fmtNum(v) + '</b>' + (n.left === null || n.right === null ? ' (the missing side counts as −1)' : '') + '. The longer side decides, and one more link connects it to ' + b(t, id) + '.';
      } else if (kind === 'count') {
        var cl = n.left === null ? 0 : a, cr = n.right === null ? 0 : c;
        v = 1 + cl + cr; ln = 'combine';
        why = 'Nodes under ' + b(t, id) + ' = 1 + ' + cl + ' + ' + cr + ' = <b>' + v + '</b>: itself, plus everything on its left, plus everything on its right.';
      } else if (n.left === null && n.right === null) {
        v = Number(n.value); ln = 'leaf';
        why = b(t, id) + ' is a plain number, so it evaluates to itself: <b>' + fmtNum(v) + '</b>.';
      } else {
        v = applyOp(n.value, a, c); ln = 'combine';
        why = 'Both operands are known, so ' + b(t, id) + ' can finally act: ' + fmtNum(a) + ' ' + esc(n.value) + ' ' + fmtNum(c) + ' = <b>' + fmtNum(v) + '</b>.';
      }
      results[id] = v; done[id] = true;
      frames[frames.length - 1].state = 'done';
      frames[frames.length - 1].returnValue = fmtNum(v);
      emit({ kind: 'compute', line: ln, flow: 'compute', vars: { node: label(t, id), result: v }, caption: why + ' The frame returns this value to its caller.' });
      frames.pop();
      cur = parentId;
      return v;
    }
    var result = t.root === null ? null : rec(t.root, null, null);
    cur = null;
    emit({ kind: 'end', line: null, vars: { result: result },
      caption: kind === 'height' ? 'The height of the tree is the height of its root: <b>' + fmtNum(result) + '</b>. Every node was asked once, and always after its children: that is a postorder walk.'
        : kind === 'count' ? 'The tree has <b>' + result + '</b> nodes. Every node was asked once, after its children: a postorder walk.'
          : 'The whole expression equals <b>' + fmtNum(result) + '</b>. The values were computed in the order 3 4 + 5 2 − ×: the postfix order, which is the postorder of the tree.' });
    return { steps: steps, value: result };
  }
  function referenceCompute(t, kind) {
    function go(id) {
      if (id === null) return kind === 'height' ? -1 : 0;
      var n = t.nodes[id];
      if (kind === 'height') return 1 + Math.max(go(n.left), go(n.right));
      if (kind === 'count') return 1 + go(n.left) + go(n.right);
      if (n.left === null && n.right === null) return Number(n.value);
      return applyOp(n.value, go(n.left), go(n.right));
    }
    return go(t.root);
  }

  /* ---------------------------------------------------------------- expression tokens (prefix / infix / postfix) */
  function exprTokens(t) {
    var pre = [], post = [], inf = [];
    (function go(id, top) {
      if (id === null) return;
      var n = t.nodes[id], leaf = n.left === null && n.right === null;
      pre.push({ id: id, text: String(n.value) });
      if (!leaf && !top) inf.push({ id: id, text: '(', paren: true });
      go(n.left, false);
      inf.push({ id: id, text: String(n.value) });
      go(n.right, false);
      if (!leaf && !top) inf.push({ id: id, text: ')', paren: true });
      post.push({ id: id, text: String(n.value) });
    }(t.root, true));
    return { prefix: pre, infix: inf, postfix: post };
  }

  /* ---------------------------------------------------------------- n-ary trees (file system, org chart, DOM) */
  /* tree: {id, label, size?, children?: [...]}. Returns the same steps as computeSteps, for folder sizes. */
  function naryIndex(root) {
    var map = {}, order = [];
    (function go(n, parent) { map[n.id] = { node: n, parent: parent, children: (n.children || []).map(function (c) { return c.id; }) }; order.push(n.id); (n.children || []).forEach(function (c) { go(c, n.id); }); }(root, null));
    return { map: map, order: order };
  }
  function naryTotal(n) { return (n.size || 0) + (n.children || []).reduce(function (s, c) { return s + naryTotal(c); }, 0); }
  function folderSteps(root, unit) {
    var ix = naryIndex(root), steps = [], frames = [], done = {}, results = {}, cur = null, calls = 0, peak = 0;
    unit = unit || ' KB';
    function snap() {
      var nodes = ix.order.map(function (id) {
        var m = ix.map[id], st = 'default';
        if (frames.some(function (f) { return f.nid === id; })) st = 'frontier';
        if (id === cur) st = 'active';
        if (done[id]) st = 'done';
        var out = { id: id, label: m.node.label, children: m.children.slice(), state: st };
        if (done[id]) out.returnValue = results[id] + unit.replace(' ', '');
        return out;
      });
      var edges = {};
      for (var i = 1; i < frames.length; i++) edges[frames[i - 1].nid + '-' + frames[i].nid] = 'path';
      steps.push({
        kind: o.kind, caption: o.caption, line: o.line, root: root.id, nodes: nodes, edges: edges,
        frames: frames.map(function (f) { return { id: f.id, fn: f.fn, args: f.args, state: f.state, returnValue: f.returnValue }; }),
        vars: o.vars || {}, counters: { calls: calls, depth: frames.length, peak: peak }
      });
    }
    var o = {};
    function emit(x) { o = x; snap(); }
    emit({ kind: 'start', line: null, caption: 'How much space does a folder use? Its own files, plus every folder inside it. A folder cannot know its size until each folder inside it has answered.' });
    function rec(n, parent) {
      frames.push({ id: 'f' + n.id, nid: n.id, fn: 'size', args: 'node=' + n.label });
      cur = n.id; calls += 1; peak = Math.max(peak, frames.length);
      var isDir = (n.children || []).length > 0;
      emit({ kind: 'call', line: parent ? ['loop', 'sig'] : 'sig', vars: { node: n.label },
        caption: parent ? '<b>' + esc(parent.label) + '</b> asks <b>' + esc(n.label) + '</b> for its size and waits.' : 'Call <code>size</code> on the root <b>' + esc(n.label) + '</b>.' });
      var total = n.size || 0, parts = [];
      if (n.size) parts.push(String(n.size));
      (n.children || []).forEach(function (c) { var v = rec(c, n); total += v; parts.push(String(v)); });
      results[n.id] = total; done[n.id] = true;
      frames[frames.length - 1].state = 'done'; frames[frames.length - 1].returnValue = total + unit.replace(' ', '');
      emit({ kind: 'compute', line: isDir ? ['add', 'ret'] : ['own', 'ret'], vars: { node: n.label, total: total },
        caption: isDir
          ? '<b>' + esc(n.label) + '</b> has all its answers: ' + parts.join(' + ') + ' = <b>' + total + unit + '</b>. That is a postorder step: children first, then the parent.'
          : '<b>' + esc(n.label) + '</b> is a file with no children: its size is just its own <b>' + total + unit + '</b>.' });
      frames.pop(); cur = parent ? parent.id : null;
      return total;
    }
    var total = rec(root, null);
    cur = null;
    emit({ kind: 'end', line: null, vars: { total: total }, caption: 'The whole project is <b>' + total + unit + '</b>. Every folder was measured exactly once, and only after everything inside it.' });
    return { steps: steps, total: total };
  }

  /* ---------------------------------------------------------------- growing a tree, node by node */
  /* Adds the nodes of `t` in level order: each new node needs exactly one new edge. */
  function growSteps(t) {
    var ids = levelorder(t), steps = [], shown = {};
    var par = parents(t);
    function nodesNow(newId) {
      return ids.filter(function (id) { return shown[id]; }).map(function (id) {
        var nd = t.nodes[id];
        var out = { id: id, value: nd.value, left: nd.left !== null && shown[nd.left] ? nd.left : null, right: nd.right !== null && shown[nd.right] ? nd.right : null };
        out.state = id === newId ? 'active' : id === par[newId] ? 'compare' : 'default';
        return out;
      });
    }
    var count = 0;
    ids.forEach(function (id, i) {
      shown[id] = true; count += 1;
      var edges = {};
      if (par[id] !== undefined) edges[par[id] + '-' + id] = 'path';
      var cap;
      if (i === 0) cap = 'Every tree starts with one <b>root</b>: ' + b(t, id) + '. One node, no edges yet.';
      else cap = 'Add ' + b(t, id) + ' as the ' + (t.nodes[par[id]].left === id ? 'left' : 'right') + ' child of ' + b(t, par[id]) + '. A new node needs exactly one new edge, to its one parent: nodes <b>' + count + '</b>, edges <b>' + (count - 1) + '</b>.';
      steps.push({ kind: i === 0 ? 'root' : 'add', caption: cap, root: t.root, nodes: nodesNow(id), edges: edges, counters: { nodes: count, edges: count - 1 } });
    });
    var last = steps[steps.length - 1];
    steps.push({
      kind: 'end', root: t.root, edges: {}, counters: last.counters,
      nodes: nodesNow(null).map(function (n) { n.state = 'default'; return n; }),
      caption: 'A tree with <b>n</b> nodes always has <b>n − 1</b> edges: every node except the root has exactly one edge up to its parent. Add one more edge anywhere and you would close a loop, and it would no longer be a tree.'
    });
    return steps;
  }

  /* ---------------------------------------------------------------- hero teaser: grow, then walk in preorder */
  function teaserSteps(t) {
    var steps = growSteps(t).slice(0, -1);
    steps.forEach(function (s) { s.tour = null; s.caption = ''; });
    var ids = levelorder(t), sp = stopPositions(t), pre = preorder(t), done = {}, n = size(t);
    function nodesNow(cur) {
      return t.order.map(function (id) {
        var nd = t.nodes[id];
        return { id: id, value: nd.value, left: nd.left, right: nd.right, state: id === cur ? 'swap' : done[id] ? 'done' : 'default' };
      });
    }
    void ids;
    steps.push({ kind: 'still', root: t.root, nodes: nodesNow(null), edges: {}, tour: 0, caption: '' });
    pre.forEach(function (id) {
      done[id] = true;
      steps.push({ kind: 'walk', root: t.root, nodes: nodesNow(id), edges: {}, tour: sp[id + ':pre'], caption: '' });
    });
    steps.push({ kind: 'end', root: t.root, nodes: nodesNow(null), edges: {}, tour: 3 * n + 1, caption: '' });
    return steps;
  }

  /* ---------------------------------------------------------------- vocabulary explorer */
  function vocabFacts(t, id) {
    var par = parents(t), d = depths(t)[id];
    var anc = [], x = id;
    while (par[x] !== undefined) { x = par[x]; anc.push(x); }
    var kids = childrenOf(t, id), sub = subtreeIds(t, id);
    var sibs = par[id] === undefined ? [] : childrenOf(t, par[id]).filter(function (c) { return c !== id; });
    var dmap = depths(t);
    var level = Object.keys(dmap).filter(function (k) { return dmap[k] === d; });
    var h = heightOf(t, id);
    return {
      id: id, parent: par[id] === undefined ? null : par[id], children: kids, siblings: sibs, ancestors: anc, descendants: sub.filter(function (s) { return s !== id; }),
      depth: d, height: h, leaf: kids.length === 0, subtreeSize: sub.length, level: level, treeHeight: height(t)
    };
  }
  /* the longest path from id down to a leaf, as node ids (ties go left) */
  function longestDown(t, id) {
    var path = [id];
    while (true) {
      var n = t.nodes[id], hl = heightOf(t, n.left), hr = heightOf(t, n.right);
      if (n.left === null && n.right === null) break;
      id = hl >= hr ? n.left : n.right;
      path.push(id);
    }
    return path;
  }

  /* ================================================================== exports */
  return {
    MAX_NODES: MAX_NODES, CODE: CODE, FN: FN, ORDER_NAME: ORDER_NAME,
    // data
    empty: empty, fromLevel: fromLevel, parseLevel: parseLevel, fromShape: fromShape, levelTokens: levelTokens,
    perfect: perfect, complete: complete, degenerate: degenerate, fullNotComplete: fullNotComplete, randomTree: randomTree,
    // facts
    label: label, size: size, height: height, heightOf: heightOf, depths: depths, parents: parents, childrenOf: childrenOf, subtreeIds: subtreeIds,
    levelWidths: levelWidths, shapeInfo: shapeInfo, minHeight: minHeight, maxHeight: maxHeight, indexInfo: indexInfo,
    vocabFacts: vocabFacts, longestDown: longestDown,
    // orders
    preorder: preorder, inorder: inorder, postorder: postorder, levelorder: levelorder, orders: orders, valuesOf: valuesOf,
    eulerStops: eulerStops, stopPositions: stopPositions, peakStack: peakStack, peakQueue: peakQueue, peakExplicitStack: peakExplicitStack,
    // traces
    run: run, traceSteps: traceSteps, codeKey: codeKey, eulerSteps: eulerSteps,
    computeSteps: computeSteps, referenceCompute: referenceCompute, exprTokens: exprTokens,
    folderSteps: folderSteps, naryTotal: naryTotal, naryIndex: naryIndex,
    growSteps: growSteps, teaserSteps: teaserSteps
  };
}));
