/* Gallery demos: VDSA.views.stack / queue / deque / ring */
(function () {
  'use strict';
  var G = Gallery;
  function copyItems(a) { return a.map(function (x) { return Object.assign({}, x); }); }

  /* ---------- stack: balanced brackets ---------- */
  function parenSteps(text) {
    var stack = [], steps = [], pairs = { ')': '(', ']': '[', '}': '{' }, n = 0;
    function snap(caption, mark) {
      steps.push({ items: stack.map(function (x, i) { return { id: x.id, value: x.value, state: mark && i === stack.length - 1 ? mark : 'default' }; }), caption: caption });
    }
    snap('Scan "' + text + '" left to right. The stack starts empty.');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (!pairs[ch]) {
        stack.push({ id: 'p' + (n++), value: ch });
        snap('"' + ch + '" opens a group: push it.', 'active');
      } else {
        snap('"' + ch + '" closes: does the top match?', 'compare');
        stack.pop();
        snap('It matches ' + pairs[ch] + ', so pop.');
      }
    }
    snap('Input finished with an empty stack: balanced.');
    return steps;
  }
  G.demo('stack', {
    id: 'stack-parens', title: 'Stack — balanced brackets (push drops in, pop lifts out)',
    note: 'items are bottom → top; the "top" marker slides; an empty stack shows top at −1.',
    duration: 520, hold: 420,
    build: function (host) {
      var view = VDSA.views.stack(host, { label: 'Bracket stack' });
      var steps = parenSteps('{[()]}()');
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- stack: capacity + overflow, horizontal ---------- */
  G.demo('stack', {
    id: 'stack-overflow', title: 'Array-backed stack — capacity and overflow',
    note: 'orientation: "horizontal", capacity: 4. Pushing a fifth item marks it "error" and the tray turns red.',
    duration: 520, hold: 520,
    build: function (host) {
      var view = VDSA.views.stack(host, { orientation: 'horizontal', capacity: 4, label: 'Stack with capacity 4' });
      var steps = [], items = [];
      steps.push({ items: [], caption: 'Capacity 4, empty.' });
      for (var i = 1; i <= 5; i++) {
        items.push({ id: 'h' + i, value: i * 10 });
        var over = items.length > 4;
        steps.push({ items: copyItems(items).map(function (x, k) { return Object.assign(x, { state: over && k === 4 ? 'error' : k === items.length - 1 ? 'active' : 'default' }); }), overflow: over, caption: over ? 'Stack overflow: there is no slot for 50.' : 'push(' + i * 10 + ')' });
      }
      items.pop();
      steps.push({ items: copyItems(items), caption: 'Reject the push; the stack is unchanged.' });
      while (items.length) { items.pop(); steps.push({ items: copyItems(items), caption: 'pop()' }); }
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- queue ---------- */
  G.demo('stack', {
    id: 'queue', title: 'Queue — enqueue at the rear, dequeue at the front',
    note: 'New ids slide in from the right; removed ids slide out to the left; front/rear markers follow.',
    duration: 520, hold: 460,
    build: function (host) {
      var view = VDSA.views.queue(host, { label: 'Queue' });
      var q = [], n = 0, steps = [];
      function snap(caption, mark) { steps.push({ items: q.map(function (x, i) { return { id: x.id, value: x.value, state: mark === 'rear' && i === q.length - 1 ? 'frontier' : 'default' }; }), caption: caption }); }
      snap('An empty queue.');
      var ops = ['A', 'B', 'C', '-', 'D', '-', 'E', '-', '-', '-'];
      ops.forEach(function (op) {
        if (op === '-') { var x = q.shift(); snap('dequeue() → ' + x.value + ' (first in, first out).'); }
        else { q.push({ id: 'q' + (n++), value: op }); snap('enqueue(' + op + ')', 'rear'); }
      });
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- deque ---------- */
  G.demo('stack', {
    id: 'deque', title: 'Deque — both ends',
    note: 'VDSA.views.deque: entry and exit side are inferred from where an id appears or disappears.',
    duration: 520, hold: 460,
    build: function (host) {
      var view = VDSA.views.deque(host, { label: 'Deque' });
      var d = [], n = 0, steps = [];
      function snap(caption, id) { steps.push({ items: d.map(function (x) { return { id: x.id, value: x.value, state: x.id === id ? 'active' : 'default' }; }), caption: caption }); }
      snap('Empty deque.');
      [['pushBack', 5], ['pushBack', 8], ['pushFront', 2], ['pushFront', 1], ['popBack'], ['pushBack', 9], ['popFront'], ['popFront']].forEach(function (op) {
        var id;
        if (op[0] === 'pushBack') { id = 'd' + (n++); d.push({ id: id, value: op[1] }); }
        else if (op[0] === 'pushFront') { id = 'd' + (n++); d.unshift({ id: id, value: op[1] }); }
        else if (op[0] === 'popBack') d.pop(); else d.shift();
        snap(op[0] + '(' + (op[1] !== undefined ? op[1] : '') + ')', id);
      });
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- ring buffer ---------- */
  G.demo('stack', {
    id: 'ring', title: 'Ring buffer — head and tail wrap around', wide: true,
    note: 'A fixed array of 6 slots used as a circle. tail = where the next value is written, head = the oldest value; both wrap from 5 back to 0. The row below is the same memory as a plain array.',
    duration: 620, hold: 520,
    build: function (host) {
      var view = VDSA.views.ring(host, { label: 'Ring buffer', headLabel: 'head', tailLabel: 'tail' });
      var cap = 6, slots = [null, null, null, null, null, null], head = 0, tail = 0, size = 0, n = 0, steps = [];
      function snap(caption, mark) {
        steps.push({ capacity: cap, slots: slots.map(function (x, i) { return x ? { id: x.id, value: x.value, state: i === mark ? 'active' : 'default' } : null; }), head: head, tail: tail, size: size, caption: caption });
      }
      snap('Empty: head = tail = 0.');
      function enq(v) {
        if (size === cap) { snap('Full: enqueue(' + v + ') must wait (or overwrite the oldest).'); return; }
        slots[tail] = { id: 'v' + (n++), value: v };
        var at = tail;
        tail = (tail + 1) % cap; size++;
        snap('enqueue(' + v + ') writes slot ' + at + '; tail moves to ' + tail + '.', at);
      }
      function deq() {
        var x = slots[head]; slots[head] = null;
        var at = head;
        head = (head + 1) % cap; size--;
        snap('dequeue() → ' + x.value + ' from slot ' + at + '; head moves to ' + head + '.');
      }
      enq(3); enq(7); enq(1); enq(9); deq(); deq(); enq(4); enq(6); enq(8); enq(2); enq(5); deq(); deq(); deq(); deq(); deq(); deq();
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });
}());
