/* Gallery demos: VDSA.views.list */
(function () {
  'use strict';
  var G = Gallery;

  function clone(nodes) { return nodes.map(function (n) { return Object.assign({}, n); }); }
  function mk(values, prefix) {
    return values.map(function (v, i) { return { id: prefix + i, value: v, next: i < values.length - 1 ? prefix + (i + 1) : null }; });
  }
  function simple(build, opts) {
    return function (host) {
      var view = VDSA.views.list(host, opts || {});
      var steps = build();
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    };
  }

  /* ---------- reversal: the showcase ---------- */
  function reversalSteps() {
    var nodes = mk([1, 2, 3, 4, 5], 'r');
    var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
    var steps = [], head = 'r0', prev = null, curr = 'r0', nxt, done = {};
    function snap(caption, o) {
      o = o || {};
      var ns = clone(nodes).map(function (n) {
        n.state = n.id === curr ? 'active' : done[n.id] ? 'visited' : 'default';
        if (o.flip === n.id) n.nextState = 'swap';
        return n;
      });
      var ptrs = [{ name: 'prev', target: prev, state: 'visited', nullSide: 'left' }, { name: 'curr', target: curr, state: 'active' }];
      if (o.showNext) ptrs.push({ name: 'next', target: nxt, state: 'compare' });
      steps.push({ nodes: ns, head: head, pointers: ptrs, caption: caption });
    }
    snap('prev = null, curr = head. Every arrow still points right.');
    while (curr !== null) {
      nxt = byId[curr].next;
      snap('Save next = curr.next so the rest of the list is not lost.', { showNext: true });
      byId[curr].next = prev;
      snap('Flip: curr.next = prev.', { showNext: true, flip: curr });
      done[curr] = true;
      prev = curr;
      snap('Advance prev to curr.', { showNext: true });
      curr = nxt;
      snap('Advance curr to next.', { showNext: true });
    }
    head = prev;
    snap('curr is null: prev is the new head. Every arrow now points left.');
    return steps;
  }
  G.demo('list', {
    id: 'list-reverse', title: 'Reversing a linked list — arrows flip one by one', wide: true,
    note: 'When node.next changes the arrow swings to its new target (a backward link arcs under the row); a null link retracts into a slash. prev/curr/next chips slide.',
    duration: 650, hold: 500,
    build: simple(reversalSteps)
  });

  /* ---------- insert in the middle ---------- */
  function insertSteps() {
    var nodes = mk([3, 7, 12, 15], 'i');
    var steps = [];
    function snap(ns, ptrs, caption) { steps.push({ nodes: clone(ns), head: 'i0', pointers: ptrs, caption: caption }); }
    snap(nodes, [], 'Insert 9 after 7.');
    snap(nodes.map(function (n) { return Object.assign({}, n, { state: n.id === 'i0' ? 'active' : 'default' }); }), [{ name: 'curr', target: 'i0' }], 'Start at the head.');
    var at1 = nodes.map(function (n) { return Object.assign({}, n, { state: n.id === 'i1' ? 'active' : n.id === 'i0' ? 'visited' : 'default' }); });
    snap(at1, [{ name: 'curr', target: 'i1' }], 'Walk to the node before the gap.');
    var withNew = at1.slice(0, 2).concat([{ id: 'n', value: 9, next: null, detached: 'above', state: 'key' }], at1.slice(2));
    snap(withNew, [{ name: 'curr', target: 'i1' }, { name: 'node', target: 'n', state: 'key' }], 'Allocate the new node; it is not linked yet.');
    var linkNext = clone(withNew); linkNext[2].next = 'i2'; linkNext[2].nextState = 'swap';
    snap(linkNext, [{ name: 'curr', target: 'i1' }, { name: 'node', target: 'n', state: 'key' }], 'node.next = curr.next (point at 12 first, so nothing is lost).');
    var linkPrev = clone(linkNext); linkPrev[2].nextState = 'default'; linkPrev[1].next = 'n'; linkPrev[1].nextState = 'swap';
    snap(linkPrev, [{ name: 'curr', target: 'i1' }, { name: 'node', target: 'n', state: 'key' }], 'curr.next = node: the arrow from 7 swings up to 9.');
    var attached = clone(linkPrev); attached[1].nextState = 'default'; delete attached[2].detached; attached[2].state = 'done';
    attached.forEach(function (n) { if (n.state === 'visited' || n.state === 'active') n.state = 'default'; });
    snap(attached, [], 'Linked in: 3 → 7 → 9 → 12 → 15.');
    return steps;
  }
  G.demo('list', {
    id: 'list-insert', title: 'Insert in the middle — a detached node glides in',
    note: 'detached: "above" keeps the new node out of the row until it is linked; arrows to and from it bend.',
    duration: 650, hold: 700,
    build: simple(insertSteps)
  });

  /* ---------- delete ---------- */
  function deleteSteps() {
    var nodes = mk([4, 8, 15, 16, 23], 'd');
    var steps = [];
    function snap(ns, ptrs, caption) { steps.push({ nodes: clone(ns), head: 'd0', pointers: ptrs, caption: caption }); }
    snap(nodes, [], 'Delete 15.');
    var s1 = clone(nodes); s1[1].state = 'active'; s1[2].state = 'error';
    snap(s1, [{ name: 'prev', target: 'd1' }, { name: 'victim', target: 'd2', state: 'error' }], 'Stop at the node before 15.');
    var s2 = clone(s1); s2[1].next = 'd3'; s2[1].nextState = 'swap';
    snap(s2, [{ name: 'prev', target: 'd1' }, { name: 'victim', target: 'd2', state: 'error' }], 'prev.next = victim.next: the arrow re-routes over 15.');
    var s3 = clone(s2).filter(function (n) { return n.id !== 'd2'; }); s3[1].nextState = 'default';
    snap(s3, [{ name: 'prev', target: 'd1' }], '15 is unreachable, so it is freed; the rest close the gap.');
    var s4 = clone(s3); s4[1].state = 'default';
    snap(s4, [], '4 → 8 → 16 → 23.');
    return steps;
  }
  G.demo('list', {
    id: 'list-delete', title: 'Delete — the bypass arrow re-routes, the node fades',
    duration: 650, hold: 700,
    build: simple(deleteSteps)
  });

  /* ---------- doubly linked insert ---------- */
  function doublySteps() {
    var vals = [2, 5, 11];
    var nodes = vals.map(function (v, i) { return { id: 'b' + i, value: v, next: i < 2 ? 'b' + (i + 1) : null, prev: i > 0 ? 'b' + (i - 1) : null }; });
    var steps = [];
    function snap(ns, ptrs, caption) { steps.push({ nodes: clone(ns), head: 'b0', pointers: ptrs || [], caption: caption }); }
    snap(nodes, [], 'A doubly linked list: every node knows both neighbours.');
    var a = clone(nodes); a.splice(2, 0, { id: 'bn', value: 8, next: null, prev: null, detached: 'below', state: 'key' }); a[1].state = 'active';
    snap(a, [{ name: 'curr', target: 'b1' }], 'Insert 8 after 5.');
    var b = clone(a); b[2].prev = 'b1'; b[2].next = 'b2'; b[2].prevState = 'swap'; b[2].nextState = 'swap';
    snap(b, [{ name: 'curr', target: 'b1' }], 'Set the new node\'s prev and next first.');
    var c = clone(b); c[2].prevState = c[2].nextState = 'default'; c[3].prev = 'bn'; c[3].prevState = 'swap';
    snap(c, [{ name: 'curr', target: 'b1' }], 'curr.next.prev = node.');
    var e = clone(c); e[3].prevState = 'default'; e[1].next = 'bn'; e[1].nextState = 'swap';
    snap(e, [{ name: 'curr', target: 'b1' }], 'curr.next = node.');
    var f = clone(e); f[1].nextState = 'default'; delete f[2].detached; f[2].state = 'done'; f[1].state = 'default';
    snap(f, [], 'Four pointers changed; both directions stay consistent.');
    return steps;
  }
  G.demo('list', {
    id: 'list-doubly', title: 'Doubly linked list — insert with four pointer updates',
    note: 'prev | value | next boxes; next arrows run above the centre line, prev arrows below; null ends are terminators.',
    duration: 650, hold: 700,
    build: simple(doublySteps)
  });

  /* ---------- circular ---------- */
  function circularSteps() {
    var nodes = mk(['A', 'B', 'C', 'D', 'E'], 'c');
    nodes[4].next = 'c0';
    var steps = [];
    for (var k = 0; k <= 7; k++) {
      var at = 'c' + (k % 5);
      steps.push({
        nodes: nodes.map(function (n) { return Object.assign({}, n, { state: n.id === at ? 'active' : 'default', nextState: k % 5 === 4 && n.id === 'c4' ? 'active' : 'default' }); }),
        head: 'c0', pointers: [{ name: 'curr', target: at }],
        caption: k % 5 === 4 ? 'The tail links back to the head: the walk never meets null.' : 'curr = curr.next'
      });
    }
    return steps;
  }
  G.demo('list', {
    id: 'list-circular', title: 'Circular list — the tail loops back to the head',
    note: 'circular: true routes the tail → head link as a return loop under the row.',
    duration: 560, hold: 420,
    build: simple(circularSteps, { circular: true })
  });

  /* ---------- Floyd cycle detection ---------- */
  function floydSteps() {
    var nodes = mk([1, 2, 3, 4, 5, 6], 'f');
    nodes[5].next = 'f2';
    var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
    var steps = [], slow = 'f0', fast = 'f0', met = false;
    function snap(caption) {
      steps.push({
        nodes: nodes.map(function (n) { return Object.assign({}, n, { state: met && n.id === slow ? 'found' : n.id === slow ? 'active' : n.id === fast ? 'compare' : 'default' }); }),
        head: 'f0', pointers: [{ name: 'slow', target: slow, state: met ? 'found' : 'active' }, { name: 'fast', target: fast, state: met ? 'found' : 'compare' }],
        caption: caption
      });
    }
    snap('slow and fast both start at the head.');
    for (var i = 0; i < 12; i++) {
      slow = byId[slow].next; fast = byId[byId[fast].next].next;
      if (slow === fast) { met = true; snap('They meet inside the loop: there is a cycle.'); break; }
      snap('slow moves one step, fast moves two.');
    }
    return steps;
  }
  G.demo('list', {
    id: 'list-floyd', title: 'Floyd\'s cycle detection — slow and fast pointers',
    note: 'A backward link (6 → 3) arcs under the row; chips on the same node stack.',
    duration: 600, hold: 550,
    build: simple(floydSteps)
  });
}());
