/* Lesson 10 · Queues & deques: pure step generators (no DOM). UMD: attaches to VDSA.algos.queues in the browser,
   module.exports in Node.

     parseOps(text, opts)            'Enqueue 5, dequeue' text -> {ops: [{type:'enq', value}|{type:'deq'}], error}
     parsePlan(text, opts)           'A B C - D' text -> {plan: [{type:'arrive', value}|{type:'serve'}], error}
     ticketLine(script)              hero + problem: a line of people ('j' join, 's' serve)
     queueOps(ops)                   the four operations on a queue (front/rear markers, peek, underflow)
     arrayQueues(ops, opts)          same operations on a shifting array and on a moving front index (wasted slots)
     ring(cap, ops, opts)            circular buffer lab: scheme 'size' | 'spare' | 'bug', policy 'reject' | 'overwrite'
     ringCode(scheme, policy)        {pseudo, js, py} with // @labels matching step.line
     ringFlow(scheme, policy)        flowchart spec whose node ids match step.flow
     stackVsQueue(plan)              the same arrivals served LIFO and FIFO
     slidingMax(nums, k)             sliding window maximum with a monotonic deque (lab)
     slidingMaxReference(nums, k)    brute force reference
     slidingMaxCount(nums, k)        fast comparison count of the deque method (no steps)
     bruteCount(n, k)                comparisons the brute force method makes
     dequeCreate / dequeApply / dequeView   the double-ended queue on a ring (playground)
     twoStacks(ops)                  a queue built from two stacks
     linkedQueue(ops)                a queue as a linked list with head and tail pointers
     bfsGrid(rows, cols, walls, start)  a queue feeding a breadth-first flood fill
     bfsReference(...)               plain BFS distances for tests
     dequeueCost(kind, n)            elements touched by one dequeue at length n (measured on real implementations)
     drainCost(kind, n)              average elements touched per dequeue when draining n items

   Every step is a complete snapshot: renderers draw it with no history. Items keep stable ids. Colours come only
   from the shared states (VDSA.STATES). Counters keep the same keys on every step of one trace. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.queues = Object.assign(V.algos.queues || {}, api);
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ helpers */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v) { return typeof v === 'number' && v < 0 ? '−' + Math.abs(v) : String(v); }
  function plural(n, w, many) { return n + ' ' + (n === 1 ? w : (many || w + 's')); }
  function copy(o) { return Object.assign({}, o); }
  function nm(v) { return '<b>' + esc(fmt(v)) + '</b>'; }

  var DEQ_RE = /^(d|deq|dequeue|-|x)$/i;

  /* ------------------------------------------------------------------ input parsing */
  function parseOps(text, o) {
    o = o || {};
    var max = o.maxOps || 20, lo = o.min === undefined ? -99 : o.min, hi = o.max === undefined ? 99 : o.max;
    var toks = String(text === undefined || text === null ? '' : text).split(/[\s,;]+/).filter(Boolean);
    if (!toks.length) return { ops: [], error: 'Type at least one operation: a number to enqueue it, or d to dequeue.' };
    if (toks.length > max) return { ops: [], error: 'That is ' + toks.length + ' operations. Please keep it to ' + max + ' or fewer so every step stays readable.' };
    var ops = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (DEQ_RE.test(t)) { ops.push({ type: 'deq' }); continue; }
      if (/^[+-]?\d+$/.test(t)) {
        var v = parseInt(t, 10);
        if (v < lo || v > hi) return { ops: [], error: '“' + t + '” is out of range. Use whole numbers from ' + lo + ' to ' + hi + '.' };
        ops.push({ type: 'enq', value: v });
        continue;
      }
      return { ops: [], error: '“' + t + '” is not an operation. Use a whole number to enqueue it, or d to dequeue (separate with spaces).' };
    }
    return { ops: ops, error: null };
  }

  /* 'A B C - D -' : letters (or single digits) arrive, '-' or s serves. */
  function parsePlan(text, o) {
    o = o || {};
    var max = o.maxTokens || 14, maxArr = o.maxArrivals || 8;
    var toks = String(text === undefined || text === null ? '' : text).split(/[\s,;]+/).filter(Boolean);
    if (!toks.length) return { plan: [], error: 'Type at least one letter to arrive, or - to serve one.' };
    if (toks.length > max) return { plan: [], error: 'That is ' + toks.length + ' entries. Please keep it to ' + max + ' or fewer.' };
    var plan = [], arrivals = 0, seen = {};
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (/^(-|serve)$/i.test(t)) { plan.push({ type: 'serve' }); continue; }
      if (/^[A-Za-z0-9]$/.test(t)) {
        var v = t.toUpperCase();
        if (seen[v]) return { plan: [], error: 'The label ' + v + ' is used twice. Use each label once so you can tell arrivals apart.' };
        seen[v] = true; arrivals++;
        plan.push({ type: 'arrive', value: v });
        continue;
      }
      return { plan: [], error: '“' + t + '” is not valid. Use single letters or digits for arrivals and - for “serve next”.' };
    }
    if (arrivals > maxArr) return { plan: [], error: 'Please use at most ' + maxArr + ' arrivals.' };
    if (!arrivals) return { plan: [], error: 'Add at least one arrival (a letter) before serving.' };
    return { plan: plan, error: null };
  }

  /* ================================================================== ticket line (hero + problem) */
  /* script: array of 'j' (a person joins) and 's' (the person at the front is served). */
  function ticketLine(script, o) {
    o = o || {};
    var line = [], served = 0, n = 0, steps = [];
    function snap(event, caption, extra) {
      steps.push(Object.assign({
        event: event, line: line.map(copy), served: served, caption: caption, serving: null
      }, extra || {}));
    }
    snap('start', 'A ticket window opens. Nobody is waiting.');
    (script || []).forEach(function (c) {
      if (c === 'j') {
        n++;
        var p = { id: 'p' + n, n: n };
        line.push(p);
        snap('join', 'Person <b>#' + n + '</b> takes a ticket and joins the <em>back</em> of the line.', { joined: p.id });
      } else if (c === 's') {
        if (!line.length) { snap('idle', 'The window is free but nobody is waiting.'); return; }
        var f = line.shift(); served++;
        snap('serve', 'The window calls <b>#' + f.n + '</b>, the person who has waited longest, from the <em>front</em>.', { serving: f.id, servedPerson: copy(f) });
      }
    });
    return steps;
  }

  /* ================================================================== the four operations */
  function queueOps(ops) {
    var q = [], n = 0, steps = [], cnt = { enqueue: 0, dequeue: 0, peek: 0, refused: 0 };
    function snap(kind, caption, hot, hotState, o) {
      o = o || {};
      steps.push({
        kind: kind, caption: caption, line: o.line || null,
        items: q.map(function (x) { return { id: x.id, value: x.value, state: hot === x.id ? hotState : 'default' }; }),
        label: o.label,
        vars: { size: q.length, front: q.length ? q[0].value : VOID, rear: q.length ? q[q.length - 1].value : VOID, returned: o.returned === undefined ? VOID : o.returned },
        counters: { enqueue: cnt.enqueue, dequeue: cnt.dequeue, peek: cnt.peek, refused: cnt.refused },
        flow: o.flow || null, returned: o.returned
      });
    }
    var VOID = { __vdsaRaw: true, text: '–', type: 'undef' };
    snap('start', 'An empty queue. <b>front</b> is where values leave, <b>rear</b> is where they join.', null, null, {});
    ops.forEach(function (op) {
      if (op.type === 'enq') {
        var it = { id: 'q' + (n++), value: op.value };
        q.push(it); cnt.enqueue++;
        snap('enqueue', '<b>enqueue(' + esc(fmt(op.value)) + ')</b> adds ' + nm(op.value) + ' at the <em>rear</em>. Everything already waiting stays where it is, so ' + nm(op.value) + ' will be served after all of them.', it.id, 'frontier', { line: 'enq', returned: undefined });
      } else if (op.type === 'peek') {
        cnt.peek++;
        if (!q.length) { cnt.refused++; snap('underflow', '<b>peek()</b> on an empty queue: there is no front. Real code must return nothing or raise an error.', null, null, { line: 'peek', label: 'peek() on an empty queue: nothing to look at' }); return; }
        snap('peek', '<b>peek()</b> reads the front value, ' + nm(q[0].value) + ', without removing it. The queue is unchanged.', q[0].id, 'compare', { line: 'peek', returned: q[0].value });
      } else {
        if (!q.length) { cnt.refused++; snap('underflow', '<b>dequeue()</b> on an empty queue: <em>underflow</em>. There is nothing to remove, so the call must fail loudly (raise an error) or report “empty”.', null, null, { line: 'deq', label: 'dequeue() on an empty queue: underflow' }); return; }
        var f = q.shift(); cnt.dequeue++;
        snap('dequeue', '<b>dequeue()</b> removes and returns the <em>front</em> value, ' + nm(f.value) + ': the value that has waited longest. The next value becomes the new front.', null, null, { line: 'deq', returned: f.value });
      }
    });
    return steps;
  }

  /* ================================================================== shifting array vs moving front index */
  /* Two arrays of the same capacity handle the same operations. Row "naive" keeps the front at slot 0 and slides
     everything left on every dequeue. Row "index" leaves values in place and moves a front index: no sliding, but
     the slots behind the front are wasted, and the rear runs into the end of the array. */
  var ARRAY_DEFAULT = '4 7 1 9 3 d d d 6 2 8 5';
  function arrayQueues(ops, o) {
    o = o || {};
    var cap = o.capacity || 8, steps = [];
    var naive = [];                              // [{id, value}] contiguous from slot 0
    var idx = new Array(cap).fill(null);         // slot -> {id, value, gone}
    var front = 0, rear = 0, n = 0;
    var moves = 0, refused = 0;
    function rows(hotN, hotI, errI, off) {
      off = off || 0;
      var nItems = naive.map(function (x, i) { return { id: x.id, value: x.value, index: i + off, state: hotN[x.id] || 'default' }; });
      var iItems = [];
      idx.forEach(function (x, i) {
        if (x) iItems.push({ id: x.id, value: x.value, index: i, state: x.gone ? 'muted' : (hotI[x.id] || 'default') });
      });
      return [
        { id: 'naive', label: 'Shift left', items: nItems, length: cap, showIndices: true,
          pointers: [{ name: 'front', index: off, state: 'active', side: 'above' }, { name: 'rear', index: naive.length + off, state: 'frontier', side: 'above' }] },
        { id: 'index', label: 'Move front', items: iItems, length: cap, showIndices: true,
          pointers: [{ name: 'front', index: front, state: 'active', side: 'above' }, { name: 'rear', index: rear, state: errI ? 'error' : 'frontier', side: 'above' }],
          regions: front > 0 ? [{ id: 'wasted', from: 0, to: front - 1, state: 'muted', label: 'wasted' }] : [] }
      ];
    }
    function snap(kind, caption, hotN, hotI, errI, off) {
      steps.push({
        kind: kind, rows: rows(hotN || {}, hotI || {}, errI, off), caption: caption,
        counters: { moves: moves, wasted: front, refused: refused },
        vars: { 'live values': naive.length, front: front, rear: rear }
      });
    }
    snap('start', 'Two arrays of ' + cap + ' slots run the same operations. <b>Shift left</b> always keeps the front at slot 0. <b>Move front</b> keeps a front index that advances. <em>rear</em> is the next free slot.');
    for (var oi = 0; oi < ops.length; oi++) {
      var op = ops[oi];
      if (op.type === 'enq') {
        var full = naive.length >= cap, stuck = rear >= cap;
        var an = { id: 'n' + n, value: op.value }, ai = { id: 'i' + n, value: op.value };
        n++;
        if (full) {
          refused++;
          snap('full', 'Both arrays hold ' + cap + ' values: <b>enqueue(' + esc(fmt(op.value)) + ')</b> is refused, and rightly so.', {}, {}, true);
        } else if (stuck) {
          refused++;
          naive.push(an);
          var hn = {}; hn[an.id] = 'frontier';
          snap('nospace', '<b>enqueue(' + esc(fmt(op.value)) + ')</b>: <em>Shift left</em> writes into slot ' + (naive.length - 1) + '. <em>Move front</em> is stuck: its rear is at slot ' + cap + ', past the end of the array, although the ' + plural(front, 'slot') + ' behind the front are free. It reports “full” with only ' + (rear - front) + ' of ' + cap + ' slots in use.', hn, {}, true);
        } else {
          naive.push(an); idx[rear] = { id: ai.id, value: ai.value, gone: false }; rear++;
          var hn2 = {}, hi2 = {}; hn2[an.id] = 'frontier'; hi2[ai.id] = 'frontier';
          snap('enqueue', '<b>enqueue(' + esc(fmt(op.value)) + ')</b> writes ' + nm(op.value) + ' into the next free slot of each array: one write each, no sliding.', hn2, hi2, false);
        }
      } else {
        if (!naive.length) { refused++; snap('underflow', '<b>dequeue()</b> on an empty queue: underflow in both arrays.', {}, {}, false); continue; }
        var f = naive.shift();
        idx[front].gone = true; front++;
        var live = naive.length;
        snap('dequeue', '<b>dequeue()</b> returns ' + nm(f.value) + ' from the front. <em>Move front</em> just advances its front index to ' + front + ': the old value stays behind as a wasted slot (grey). <em>Shift left</em> now has a hole at slot 0.', {}, {}, false, 1);
        if (live) {
          moves += live;
          var hs = {}; naive.forEach(function (x) { hs[x.id] = 'swap'; });
          snap('shift', '<em>Shift left</em> slides the other ' + plural(live, 'value') + ' one slot left so the front is at slot 0 again: <b>' + plural(live, 'move') + '</b>. That is the price of a fixed front, and it grows with the queue.', hs, {}, false, 0);
        }
      }
    }
    var last = steps[steps.length - 1];
    steps.push(Object.assign({}, last, {
      kind: 'done',
      caption: 'Totals: shifting made <b>' + moves + '</b> extra moves and wasted no slot; the moving front index made none, but it wasted <b>' + front + '</b> slots and can run out of room while the queue is short. A <em>circular</em> buffer keeps both advantages.'
    }));
    return steps;
  }

  /* ================================================================== circular buffer lab */
  var RING_SCHEMES = {
    size: { title: 'head + size', usable: function (C) { return C; } },
    spare: { title: 'head + tail, one spare slot', usable: function (C) { return C - 1; } },
    bug: { title: 'head + tail only (ambiguous)', usable: function (C) { return C; } }
  };

  function ringCode(scheme, policy) {
    var ow = policy === 'overwrite';
    if (scheme === 'spare') {
      return {
        pseudo: [
          'enqueue(x):',
          '  if (tail + 1) mod C = head:            // @enq-full',
          ow ? '    head ← (head + 1) mod C            // @enq-evict' : '    return FULL                        // @enq-reject',
          '  buf[tail] ← x                          // @enq-write',
          '  tail ← (tail + 1) mod C                // @enq-move',
          '',
          'dequeue():',
          '  if head = tail:                        // @deq-empty',
          '    return EMPTY                         // @deq-under',
          '  x ← buf[head]                          // @deq-read',
          '  head ← (head + 1) mod C                // @deq-move',
          '  return x'
        ].join('\n'),
        js: [
          'class Ring {',
          '  constructor(C) { this.buf = new Array(C); this.head = 0; this.tail = 0; }',
          '  enqueue(x) {',
          '    const C = this.buf.length;',
          '    if ((this.tail + 1) % C === this.head) {    // @enq-full',
          ow ? '      this.head = (this.head + 1) % C;          // @enq-evict' : '      return false;                             // @enq-reject',
          '    }',
          '    this.buf[this.tail] = x;                    // @enq-write',
          '    this.tail = (this.tail + 1) % C;            // @enq-move',
          '    return true;',
          '  }',
          '  dequeue() {',
          '    if (this.head === this.tail) {              // @deq-empty',
          '      return undefined;                         // @deq-under',
          '    }',
          '    const x = this.buf[this.head];              // @deq-read',
          '    this.head = (this.head + 1) % this.buf.length;  // @deq-move',
          '    return x;',
          '  }',
          '}'
        ].join('\n'),
        py: [
          'class Ring:',
          '    def __init__(self, C):',
          '        self.buf = [None] * C; self.head = 0; self.tail = 0',
          '    def enqueue(self, x):',
          '        C = len(self.buf)',
          '        if (self.tail + 1) % C == self.head:      # @enq-full',
          ow ? '            self.head = (self.head + 1) % C       # @enq-evict' : '            return False                          # @enq-reject',
          '        self.buf[self.tail] = x                   # @enq-write',
          '        self.tail = (self.tail + 1) % C           # @enq-move',
          '        return True',
          '    def dequeue(self):',
          '        if self.head == self.tail:                # @deq-empty',
          '            return None                           # @deq-under',
          '        x = self.buf[self.head]                   # @deq-read',
          '        self.head = (self.head + 1) % len(self.buf)  # @deq-move',
          '        return x'
        ].join('\n')
      };
    }
    if (scheme === 'bug') {
      return {
        pseudo: [
          'enqueue(x):',
          '  // no test can tell "full" from "empty"    // @enq-full',
          '  buf[tail] ← x                          // @enq-write',
          '  tail ← (tail + 1) mod C                // @enq-move',
          '',
          'dequeue():',
          '  if head = tail:                        // @deq-empty',
          '    return EMPTY                         // @deq-under',
          '  x ← buf[head]                          // @deq-read',
          '  head ← (head + 1) mod C                // @deq-move',
          '  return x'
        ].join('\n'),
        js: [
          'class BrokenRing {',
          '  constructor(C) { this.buf = new Array(C); this.head = 0; this.tail = 0; }',
          '  enqueue(x) {',
          '    // head === tail means empty, so full has no test   // @enq-full',
          '    this.buf[this.tail] = x;                    // @enq-write',
          '    this.tail = (this.tail + 1) % this.buf.length;  // @enq-move',
          '  }',
          '  dequeue() {',
          '    if (this.head === this.tail) {              // @deq-empty',
          '      return undefined;                         // @deq-under',
          '    }',
          '    const x = this.buf[this.head];              // @deq-read',
          '    this.head = (this.head + 1) % this.buf.length;  // @deq-move',
          '    return x;',
          '  }',
          '}'
        ].join('\n'),
        py: [
          'class BrokenRing:',
          '    def __init__(self, C):',
          '        self.buf = [None] * C; self.head = 0; self.tail = 0',
          '    def enqueue(self, x):',
          '        # head == tail means empty, so full has no test   # @enq-full',
          '        self.buf[self.tail] = x                   # @enq-write',
          '        self.tail = (self.tail + 1) % len(self.buf)  # @enq-move',
          '    def dequeue(self):',
          '        if self.head == self.tail:                # @deq-empty',
          '            return None                           # @deq-under',
          '        x = self.buf[self.head]                   # @deq-read',
          '        self.head = (self.head + 1) % len(self.buf)  # @deq-move',
          '        return x'
        ].join('\n')
      };
    }
    return {
      pseudo: [
        'enqueue(x):',
        '  if size = C:                           // @enq-full',
        ow ? '    head ← (head + 1) mod C; size ← size − 1   // @enq-evict' : '    return FULL                          // @enq-reject',
        '  buf[(head + size) mod C] ← x           // @enq-write',
        '  size ← size + 1                        // @enq-move',
        '',
        'dequeue():',
        '  if size = 0:                           // @deq-empty',
        '    return EMPTY                         // @deq-under',
        '  x ← buf[head]                          // @deq-read',
        '  head ← (head + 1) mod C                // @deq-move',
        '  size ← size − 1                        // @deq-move',
        '  return x'
      ].join('\n'),
      js: [
        'class Ring {',
        '  constructor(C) { this.buf = new Array(C); this.head = 0; this.size = 0; }',
        '  enqueue(x) {',
        '    const C = this.buf.length;',
        '    if (this.size === C) {                      // @enq-full',
        ow ? '      this.head = (this.head + 1) % C; this.size--;  // @enq-evict' : '      return false;                             // @enq-reject',
        '    }',
        '    this.buf[(this.head + this.size) % C] = x;  // @enq-write',
        '    this.size++;                                // @enq-move',
        '    return true;',
        '  }',
        '  dequeue() {',
        '    if (this.size === 0) {                      // @deq-empty',
        '      return undefined;                         // @deq-under',
        '    }',
        '    const x = this.buf[this.head];              // @deq-read',
        '    this.head = (this.head + 1) % this.buf.length;  // @deq-move',
        '    this.size--;                                // @deq-move',
        '    return x;',
        '  }',
        '}'
      ].join('\n'),
      py: [
        'class Ring:',
        '    def __init__(self, C):',
        '        self.buf = [None] * C; self.head = 0; self.size = 0',
        '    def enqueue(self, x):',
        '        C = len(self.buf)',
        '        if self.size == C:                        # @enq-full',
        ow ? '            self.head = (self.head + 1) % C; self.size -= 1  # @enq-evict' : '            return False                          # @enq-reject',
        '        self.buf[(self.head + self.size) % C] = x # @enq-write',
        '        self.size += 1                            # @enq-move',
        '        return True',
        '    def dequeue(self):',
        '        if self.size == 0:                        # @deq-empty',
        '            return None                           # @deq-under',
        '        x = self.buf[self.head]                   # @deq-read',
        '        self.head = (self.head + 1) % len(self.buf)  # @deq-move',
        '        self.size -= 1                            # @deq-move',
        '        return x'
      ].join('\n')
    };
  }

  /* Flowchart spec for the two operations. Node ids are the `flow` values of the steps. */
  function ringFlow(scheme, policy) {
    var ow = policy === 'overwrite' && scheme !== 'bug';
    var fullText = scheme === 'size' ? 'size = C ?' : scheme === 'spare' ? '(tail + 1) mod C\n= head ?' : 'full? (no test\nis possible)';
    var emptyText = scheme === 'size' ? 'size = 0 ?' : 'head = tail ?';
    var writeText = scheme === 'size' ? 'buf[(head + size) mod C] ← x' : 'buf[tail] ← x';
    var moveText = scheme === 'size' ? 'size ← size + 1' : 'tail ← (tail + 1) mod C';
    var readMove = scheme === 'size' ? 'head ← (head + 1) mod C\nsize ← size − 1' : 'head ← (head + 1) mod C';
    var nodes = [
      { id: 'e-start', type: 'start', text: 'enqueue(x)', col: 0, row: 0 },
      { id: 'e-full', type: 'decision', text: fullText, col: 0, row: 1 },
      ow ? { id: 'e-evict', type: 'process', text: 'drop the oldest:\nhead ← head + 1', col: 1, row: 1, narrow: { col: 1, row: 2 } }
         : { id: 'e-reject', type: 'end', text: 'return FULL', col: 1, row: 1, narrow: { col: 1, row: 2 } },
      { id: 'e-write', type: 'process', text: writeText, col: 0, row: 2, narrow: { col: 0, row: 3 } },
      { id: 'e-move', type: 'process', text: moveText, col: 0, row: 3, narrow: { col: 0, row: 4 } },
      { id: 'd-start', type: 'start', text: 'dequeue()', col: 3, row: 0, narrow: { col: 0, row: 5 } },
      { id: 'd-empty', type: 'decision', text: emptyText, col: 3, row: 1, narrow: { col: 0, row: 6 } },
      { id: 'd-under', type: 'end', text: 'return EMPTY', col: 4, row: 1, narrow: { col: 1, row: 7 } },
      { id: 'd-read', type: 'process', text: 'x ← buf[head]', col: 3, row: 2, narrow: { col: 0, row: 7 } },
      { id: 'd-move', type: 'process', text: readMove, col: 3, row: 3, narrow: { col: 0, row: 8 } }
    ];
    var edges = [
      { from: 'e-start', to: 'e-full' },
      ow ? { from: 'e-full', to: 'e-evict', label: 'yes' } : { from: 'e-full', to: 'e-reject', label: 'yes' },
      { from: 'e-full', to: 'e-write', label: 'no' },
      { from: 'e-write', to: 'e-move' },
      { from: 'd-start', to: 'd-empty' },
      { from: 'd-empty', to: 'd-under', label: 'yes' },
      { from: 'd-empty', to: 'd-read', label: 'no' },
      { from: 'd-read', to: 'd-move' }
    ];
    if (ow) edges.push({ from: 'e-evict', to: 'e-write', via: { fromSide: 'bottom', toSide: 'right' } });
    return { nodes: nodes, edges: edges };
  }

  /* ring(cap, ops, {scheme, policy}) -> steps.
     Snapshot fields drawn by VDSA.views.ring (slots, head, tail, size, capacity) and by an array view of the same
     memory (flat: items with index, pointers, regions). "live" slots are the ones the code believes hold queue
     values; "stale" slots still hold an old, already-dequeued value; "lost" slots hold an unread value the code
     can no longer reach (only in the ambiguous scheme). */
  function ring(cap, ops, o) {
    o = o || {};
    var C = cap, scheme = o.scheme || 'size', policy = scheme === 'bug' ? 'reject' : (o.policy || 'reject');
    if (!(C >= 2 && C <= 12)) throw new Error('capacity must be between 2 and 12');
    if (!RING_SCHEMES[scheme]) throw new Error('unknown scheme ' + scheme);
    var buf = new Array(C).fill(null);          // {id, value, consumed}
    var head = 0, tail = 0, size = 0, n = 0;    // size is used by scheme 'size'; tail by the other two
    var cnt = { enqueued: 0, dequeued: 0, wraps: 0, refused: 0, overwritten: 0 };
    var accepted = [], outs = [], steps = [];

    function tailIdx() { return scheme === 'size' ? (head + size) % C : tail; }
    function believed() { return scheme === 'size' ? size : ((tail - head) % C + C) % C; }
    function isEmpty() { return scheme === 'size' ? size === 0 : head === tail; }
    function isFull() { return scheme === 'size' ? size === C : scheme === 'spare' ? (tail + 1) % C === head : null; }

    function snap(kind, caption, line, flow, opLabel, hot) {
      var b = believed(), tl = tailIdx(), slots = [], flat = [], stored = 0, lost = 0;
      for (var i = 0; i < C; i++) {
        var it = buf[i];
        if (!it) { slots.push(null); continue; }
        var live = (b > 0 && ((i - head + C) % C) < b) || !!(hot && hot.slot === i && hot.state === 'swap');
        var st = it.consumed ? 'muted' : (live ? 'default' : 'error');
        if (hot && hot.slot === i) st = hot.state;
        if (!it.consumed) { stored++; if (!live) lost++; }
        var fi = { id: it.id, value: it.value, index: i, state: st };
        if (it.consumed) fi.badge = 'old'; else if (!live) { fi.badge = 'lost'; fi.badgeState = 'error'; }
        flat.push(fi);
        slots.push(it.consumed ? null : { id: it.id, value: it.value, state: st });
      }
      var regions = [];
      if (b > 0) {
        var end = head + b - 1;
        if (end < C) regions.push({ id: 'live1', from: head, to: end, state: 'active', label: 'queue' });
        else { regions.push({ id: 'live1', from: head, to: C - 1, state: 'active', label: 'queue' }); regions.push({ id: 'live2', from: 0, to: end - C, state: 'active' }); }
      }
      var vars = { op: opLabel || VOIDV, head: head, tail: tl };
      if (scheme === 'size') vars.size = size;
      steps.push({
        kind: kind, capacity: C, slots: slots, head: head, tail: tl, size: b,
        flat: flat, regions: regions,
        pointers: [{ name: 'head', index: head, state: 'active', side: 'above' }, { name: 'tail', index: tl, state: 'frontier', side: 'below' }],
        flags: { isEmpty: isEmpty(), isFull: isFull(), stored: stored, lost: lost, believed: b, usable: RING_SCHEMES[scheme].usable(C) },
        scheme: scheme, policy: policy,
        caption: caption, line: line || null, flow: flow || null, vars: vars,
        counters: { enqueued: cnt.enqueued, dequeued: cnt.dequeued, wraps: cnt.wraps, refused: cnt.refused, overwritten: cnt.overwritten },
        op: opLabel || null
      });
    }
    var VOIDV = { __vdsaRaw: true, text: '–', type: 'undef' };
    function tailFormula() {
      if (scheme === 'size') return '(head + size) mod C = (' + head + ' + ' + size + ') mod ' + C + ' = ' + ((head + size) % C);
      return 'tail = ' + tail;
    }

    snap('start', 'A buffer of <b>' + C + ' slots</b>, drawn as a ring because slot ' + (C - 1) + ' is followed by slot 0. ' + (scheme === 'size'
      ? 'It remembers <b>head</b> (the front) and <b>size</b> (how many values are stored); the next write goes to <b>(head + size) mod C</b>.'
      : scheme === 'spare' ? 'It remembers <b>head</b> (the front) and <b>tail</b> (the next slot to write). One slot is always left empty, so at most ' + (C - 1) + ' values fit.'
      : 'It remembers only <b>head</b> and <b>tail</b>, and treats head = tail as “empty”. Watch what happens when the buffer fills up.'), null, null, null);

    ops.forEach(function (op) {
      if (op.type === 'enq') {
        var label = 'enqueue(' + fmt(op.value) + ')';
        var item = { id: 'q' + (n++), value: op.value, consumed: false };
        var full = isFull();
        // ---- the guard
        if (scheme === 'bug') {
          snap('check', '<b>' + esc(label) + '</b>. This version has no test for “full”: the only pointer test it knows is head = tail, and that already means empty. So it just writes at <b>tail = ' + tail + '</b>' +
            (buf[tail] && !buf[tail].consumed ? ', on top of a value nobody has read yet.' : '.'), 'enq-full', 'e-full', label);
        } else if (full) {
          snap('check', '<b>' + esc(label) + '</b>. The test ' + (scheme === 'size' ? '<b>size = C</b> (' + size + ' = ' + C + ')' : '<b>(tail + 1) mod C = head</b> (' + ((tail + 1) % C) + ' = ' + head + ')') + ' is true: the buffer is <em>full</em>.', 'enq-full', 'e-full', label);
        } else {
          snap('check', '<b>' + esc(label) + '</b>. Is there room? ' + (scheme === 'size' ? 'size ' + size + ' &lt; C ' + C : '(tail + 1) mod C = ' + ((tail + 1) % C) + ', head = ' + head + ': they differ') + ', so yes.', 'enq-full', 'e-full', label);
        }
        if (full) {
          if (policy === 'reject') {
            cnt.refused++;
            accepted.push(false);
            snap('reject', 'The value ' + nm(op.value) + ' is <b>rejected</b>: enqueue returns FULL and nothing changes. Real systems then block the producer, drop the value, or grow the buffer.', 'enq-reject', 'e-reject', label);
            return;
          }
          // overwrite: drop the oldest value first
          var dropped = buf[head];
          buf[head] = null; head = (head + 1) % C; if (scheme === 'size') size--;
          if (head === 0) cnt.wraps++;
          cnt.overwritten++;
          snap('evict', 'Overwrite policy: the <b>oldest</b> value ' + nm(dropped.value) + ' is dropped by moving <b>head</b> forward to ' + head + '. Audio and sensor buffers do this: fresh data matters more than stale data.', 'enq-evict', 'e-evict', label);
        }
        // ---- write
        var slot = tailIdx();
        var overwritten = buf[slot] && !buf[slot].consumed ? buf[slot] : null;
        buf[slot] = item;
        if (overwritten) cnt.overwritten++;
        var wrapNote = slot < head || (scheme === 'size' && head + size >= C) ? ' The index ran off the end of the array and came back: this is the <b>wrap-around</b>.' : '';
        snap('write', 'Write ' + nm(op.value) + ' into slot <b>' + slot + '</b>' + (scheme === 'size' ? ' = ' + tailFormula() : '') + '.' + wrapNote +
          (overwritten ? ' The value ' + nm(overwritten.value) + ' that was there is gone: unread data destroyed.' : ''), 'enq-write', 'e-write', label, { slot: slot, state: 'swap' });
        steps[steps.length - 1].wrapWrite = slot === 0 && cnt.enqueued > 0;
        // ---- advance
        var oldTail = tailIdx();
        if (scheme === 'size') size++; else tail = (tail + 1) % C;
        if (oldTail === C - 1) cnt.wraps++;
        cnt.enqueued++;
        accepted.push(true);
        var nt = tailIdx();
        var bugFull = scheme === 'bug' && head === tail;
        snap('advance', scheme === 'size'
          ? '<b>size</b> becomes ' + size + '. The write index (head + size) mod C moves to slot ' + nt + (oldTail === C - 1 ? ', wrapping from slot ' + (C - 1) + ' to slot 0' : '') + '.' + (size === C ? ' size = C: the buffer is <b>full</b>, and head (' + head + ') equals tail (' + nt + ') again.' : '')
          : '<b>tail</b> moves to (' + oldTail + ' + 1) mod ' + C + ' = ' + nt + (oldTail === C - 1 ? ', wrapping around' : '') + '.' +
            (bugFull ? ' Now <b>head = tail = ' + head + '</b>. The code reads that as <b>empty</b>, but every one of the ' + C + ' slots holds an unread value.' : '') +
            (scheme === 'spare' && (tail + 1) % C === head ? ' (tail + 1) mod C = head: the buffer is <b>full</b>, with one slot deliberately left empty.' : ''),
          'enq-move', 'e-move', label);
      } else {
        var dl = 'dequeue()';
        var empty = isEmpty();
        snap('check', '<b>dequeue()</b>. Is there anything to remove? ' + (scheme === 'size' ? 'size = ' + size : 'head = ' + head + ', tail = ' + tail) + (empty ? ', so the buffer looks <em>empty</em>.' : ', so yes.'), 'deq-empty', 'd-empty', dl);
        if (empty) {
          cnt.refused++;
          outs.push(null);
          var hidden = 0; buf.forEach(function (x) { if (x && !x.consumed) hidden++; });
          snap('underflow', 'dequeue returns EMPTY (underflow) and nothing changes.' + (hidden ? ' <b>But ' + plural(hidden, 'unread value') + ' are still stored in the buffer</b>: the code cannot see them, so they are lost.' : ''), 'deq-under', 'd-under', dl);
          return;
        }
        var it = buf[head];
        snap('read', 'Read the front value ' + nm(it.value) + ' from slot <b>head = ' + head + '</b>. The slot keeps its old bits for now.', 'deq-read', 'd-read', dl, { slot: head, state: 'found' });
        it.consumed = true;
        var oldHead = head;
        head = (head + 1) % C; if (scheme === 'size') size--;
        if (oldHead === C - 1) cnt.wraps++;
        cnt.dequeued++;
        outs.push(it.value);
        snap('advance', '<b>head</b> moves to (' + oldHead + ' + 1) mod ' + C + ' = ' + head + (oldHead === C - 1 ? ', wrapping around' : '') + (scheme === 'size' ? ' and <b>size</b> drops to ' + size : '') + '. Slot ' + oldHead + ' still holds ' + nm(it.value) + ', but it is now <b>stale</b>: no pointer leads to it, and the next enqueue that lands there may overwrite it.',
          'deq-move', 'd-move', dl);
      }
    });
    var live = [];
    var b = believed();
    for (var k = 0; k < b; k++) { var x = buf[(head + k) % C]; if (x && !x.consumed) live.push(x.value); }
    var lastStep = steps[steps.length - 1];
    var lostN = lastStep.flags.lost;
    steps.push(Object.assign({}, lastStep, { kind: 'done', line: null, flow: null,
      caption: 'Done. ' + (lostN ? 'The code believes the queue is empty, but <b>' + plural(lostN, 'unread value') + '</b> sit in the buffer where no pointer can reach them.'
        : live.length ? 'The queue holds ' + live.map(function (v) { return nm(v); }).join(', ') + ' (front first).' : 'The queue is empty.'),
      live: live, out: outs.slice() }));
    steps.live = live; steps.out = outs; steps.accepted = accepted;
    return steps;
  }

  /* ================================================================== stack vs queue */
  function stackVsQueue(plan) {
    var stack = [], queue = [], servedS = [], servedQ = [], t = 0, steps = [], n = 0;
    function worst(list, served) {
      var w = 0;
      served.forEach(function (s) { w = Math.max(w, s.wait); });
      list.forEach(function (x) { w = Math.max(w, t - x.at); });
      return w;
    }
    function snap(caption, opts) {
      opts = opts || {};
      steps.push({
        t: t, caption: caption, kind: opts.kind || 'step',
        stack: stack.map(function (x) { return { id: x.id, value: x.value, state: opts.hotS === x.id ? 'frontier' : 'default' }; }),
        queue: queue.map(function (x) { return { id: x.id, value: x.value, state: opts.hotQ === x.id ? 'frontier' : 'default' }; }),
        servedStack: servedS.map(copy), servedQueue: servedQ.map(copy),
        waitingStack: stack.map(function (x) { return { id: x.id, value: x.value, wait: t - x.at }; }),
        waitingQueue: queue.map(function (x) { return { id: x.id, value: x.value, wait: t - x.at }; }),
        counters: { stackWorst: worst(stack, servedS), queueWorst: worst(queue, servedQ), served: servedQ.length }
      });
    }
    snap('Two empty containers wait for the same arrivals. Both let a value in at one end; they differ in <em>which</em> value they serve.', { kind: 'start' });
    plan.forEach(function (p) {
      t++;
      if (p.type === 'arrive') {
        var it = { id: 's' + (n++), value: p.value, at: t };
        stack.push(it); queue.push(copy(it));
        snap('<b>' + esc(p.value) + '</b> arrives. The stack puts it on top; the queue puts it at the rear.', { hotS: it.id, hotQ: it.id, kind: 'arrive' });
      } else {
        if (!stack.length) { snap('Someone is ready to serve, but nobody is waiting.', { kind: 'idle' }); return; }
        var s = stack.pop(), q = queue.shift();
        servedS.push({ id: s.id, value: s.value, wait: t - s.at });
        servedQ.push({ id: q.id, value: q.value, wait: t - q.at });
        var same = s.value === q.value;
        snap('Serve one. The stack serves the <b>newest</b> value, <b>' + esc(s.value) + '</b> (waited ' + (t - s.at) + '); the queue serves the <b>oldest</b>, <b>' + esc(q.value) + '</b> (waited ' + (t - q.at) + ').' + (same ? ' Only one value was waiting, so they agree.' : ''), { kind: 'serve' });
      }
    });
    var last = steps[steps.length - 1];
    var sw = last.counters.stackWorst, qw = last.counters.queueWorst;
    steps.push(Object.assign({}, last, {
      kind: 'done',
      caption: stack.length
        ? 'Longest wait so far: <b>' + sw + '</b> ticks for the stack (<b>' + esc(stack[0].value) + '</b> is still buried at the bottom), <b>' + qw + '</b> for the queue. A queue guarantees nobody waits behind later arrivals; a stack does not.'
        : 'Everyone was served. Longest wait: <b>' + sw + '</b> for the stack, <b>' + qw + '</b> for the queue.'
    }));
    return steps;
  }

  /* ================================================================== sliding window maximum */
  var WINDOW_CODE = {
    pseudo: [
      'maxSliding(nums, k):',
      '  dq ← empty deque of indices             // @init',
      '  out ← empty list',
      '  for i ← 0 to n − 1:                     // @loop',
      '    if dq not empty and front(dq) ≤ i − k:  // @expire',
      '      popFront(dq)                        // @expire',
      '    while dq not empty and nums[back(dq)] ≤ nums[i]:  // @pop-test',
      '      popBack(dq)                         // @pop',
      '    pushBack(dq, i)                       // @push',
      '    if i ≥ k − 1:                         // @emit',
      '      append nums[front(dq)] to out       // @emit',
      '  return out                              // @ret'
    ].join('\n'),
    js: [
      'function maxSliding(nums, k) {',
      '  const dq = [];                                     // @init',
      '  const out = [];',
      '  for (let i = 0; i < nums.length; i++) {            // @loop',
      '    if (dq.length && dq[0] <= i - k) {               // @expire',
      '      dq.shift();                                    // @expire',
      '    }',
      '    while (dq.length && nums[dq[dq.length - 1]] <= nums[i]) {  // @pop-test',
      '      dq.pop();                                      // @pop',
      '    }',
      '    dq.push(i);                                      // @push',
      '    if (i >= k - 1) out.push(nums[dq[0]]);           // @emit',
      '  }',
      '  return out;                                        // @ret',
      '}'
    ].join('\n'),
    py: [
      'from collections import deque',
      '',
      'def max_sliding(nums, k):',
      '    dq = deque()                                     # @init',
      '    out = []',
      '    for i in range(len(nums)):                       # @loop',
      '        if dq and dq[0] <= i - k:                    # @expire',
      '            dq.popleft()                             # @expire',
      '        while dq and nums[dq[-1]] <= nums[i]:        # @pop-test',
      '            dq.pop()                                 # @pop',
      '        dq.append(i)                                 # @push',
      '        if i >= k - 1:                               # @emit',
      '            out.append(nums[dq[0]])                  # @emit',
      '    return out                                       # @ret'
    ].join('\n')
  };

  function slidingMaxReference(nums, k) {
    var out = [];
    for (var i = 0; i + k <= nums.length; i++) out.push(Math.max.apply(null, nums.slice(i, i + k)));
    return out;
  }
  function bruteCount(n, k) { return n >= k ? (n - k + 1) * (k - 1) : 0; }
  function slidingMaxCount(nums, k) {
    var dq = [], cmp = 0, pops = 0, out = [];
    for (var i = 0; i < nums.length; i++) {
      if (dq.length && dq[0] <= i - k) dq.shift();
      while (dq.length) { cmp++; if (nums[dq[dq.length - 1]] <= nums[i]) { dq.pop(); pops++; } else break; }
      dq.push(i);
      if (i >= k - 1) out.push(nums[dq[0]]);
    }
    return { comparisons: cmp, pops: pops, out: out };
  }

  function slidingMax(nums, k) {
    var n = nums.length;
    if (!(k >= 1 && k <= n)) throw new Error('k must be between 1 and n');
    var dq = [], out = [], steps = [], cmp = 0, pops = 0, evict = 0;
    var VOIDV = { __vdsaRaw: true, text: '–', type: 'undef' };
    function bars(i, hot) {
      var lo = Math.max(0, i - k + 1), inDq = {};
      dq.forEach(function (ix) { inDq[ix] = true; });
      return nums.map(function (v, ix) {
        var st = 'default';
        if (i !== null && ix > i) st = 'default';
        else if (i !== null && ix < lo) st = 'muted';
        else if (inDq[ix]) st = 'frontier';
        if (hot && hot.states && hot.states[ix]) st = hot.states[ix];
        return { id: 'n' + ix, value: v, state: st };
      });
    }
    function snap(kind, i, caption, line, flow, hot) {
      var lo = i === null ? 0 : Math.max(0, i - k + 1);
      steps.push({
        kind: kind, i: i, k: k, lo: lo, nums: bars(i, hot),
        dq: dq.map(function (ix, pos) { return { id: 'n' + ix, value: nums[ix], badge: 'i=' + ix, state: hot && hot.dq && hot.dq[ix] ? hot.dq[ix] : 'default' }; }),
        out: out.map(function (v, ix) { return { id: 'o' + ix, value: v, state: hot && hot.out === ix ? 'found' : 'default' }; }),
        outLength: n - k + 1,
        window: i === null ? null : { from: lo, to: i },
        caption: caption, line: line || null, flow: flow || null,
        vars: { i: i === null ? VOIDV : i, window: i === null ? VOIDV : { __vdsaRaw: true, text: i >= k - 1 ? '[' + lo + '..' + i + ']' : '[0..' + i + '] filling', type: 'text' }, dq: dq.slice(), out: out.slice() },
        counters: { comparisons: cmp, pops: pops, brute: out.length * (k - 1) }
      });
    }
    snap('start', null, 'Slide a window of <b>k = ' + k + '</b> over ' + n + ' values and report the maximum of every window. The deque will hold <em>indices</em> of values that could still become a window maximum, in decreasing order of value.', 'init', 'loop');
    for (var i = 0; i < n; i++) {
      var v = nums[i];
      snap('arrive', i, 'Value <b>' + fmt(v) + '</b> at index ' + i + ' enters the window' + (i >= k ? ', and index ' + (i - k) + ' falls out of it' : '') + '.', 'loop', 'loop', { states: (function () { var s = {}; s[i] = 'active'; return s; }()) });
      if (dq.length && dq[0] <= i - k) {
        var gone = dq[0];
        var stG = {}; stG[i] = 'active';
        dq.shift(); evict++;
        snap('expire', i, 'The front index <b>' + gone + '</b> is older than the window (' + gone + ' ≤ ' + i + ' − ' + k + '). Its value ' + nm(nums[gone]) + ' can no longer be a maximum, so it leaves from the <em>front</em>.', 'expire', 'evict', { states: stG });
      }
      while (dq.length) {
        cmp++;
        var back = dq[dq.length - 1];
        if (nums[back] <= v) {
          var stP = {}; stP[i] = 'active';
          dq.pop(); pops++;
          snap('pop', i, nm(nums[back]) + ' ≤ ' + nm(v) + ': the older ' + nm(nums[back]) + ' will leave the window <em>before</em> ' + nm(v) + ' does and is not larger, so it can never be the maximum again. It is popped from the <em>back</em>.', ['pop-test', 'pop'], 'pop', { states: stP });
        } else break;
      }
      var stK = {}; stK[i] = 'active';
      var why = dq.length ? 'The back, ' + nm(nums[dq[dq.length - 1]]) + ', is larger than ' + nm(v) + ', so it stays: it may be the maximum once ' + nm(v) + '’s neighbours are gone.' : 'The deque is empty, so ' + nm(v) + ' is the only candidate.';
      dq.push(i);
      var hotDq = {}; hotDq['n' + i] = 'active';
      snap('push', i, why + ' Index ' + i + ' joins at the back. Values in the deque now decrease from front to back.', 'push', 'push', { states: stK });
      if (i >= k - 1) {
        out.push(nums[dq[0]]);
        var stE = {}; stE[i] = 'active'; stE[dq[0]] = 'found';
        snap('emit', i, 'The window <b>[' + (i - k + 1) + '..' + i + ']</b> is full. Its maximum is the <em>front</em> of the deque: <b>' + fmt(nums[dq[0]]) + '</b>. No scan of the window was needed.', 'emit', 'emit', { states: stE, out: out.length - 1 });
      }
    }
    snap('done', null, 'Every window is answered. The deque made <b>' + cmp + '</b> comparisons; checking every window from scratch would have made <b>' + bruteCount(n, k) + '</b>. Each index is pushed once and popped at most once, so the total stays under 2n.', 'ret', 'ret');
    steps[steps.length - 1].window = null;
    steps.result = out.slice();
    return steps;
  }

  function windowFlow() {
    return {
      nodes: [
        { id: 'loop', type: 'decision', text: 'next i < n ?', col: 0, row: 0 },
        { id: 'expire', type: 'decision', text: 'front index\nexpired ?', col: 0, row: 1 },
        { id: 'evict', type: 'process', text: 'pop the front', col: 1, row: 1, narrow: { col: 1, row: 1 } },
        { id: 'popq', type: 'decision', text: 'back ≤ nums[i] ?', col: 0, row: 2 },
        { id: 'pop', type: 'process', text: 'pop the back', col: 1, row: 2, narrow: { col: 1, row: 2 } },
        { id: 'push', type: 'process', text: 'push i at the back', col: 0, row: 3 },
        { id: 'emitq', type: 'decision', text: 'i ≥ k − 1 ?', col: 0, row: 4 },
        { id: 'emit', type: 'process', text: 'output nums[front]', col: 1, row: 4, narrow: { col: 1, row: 4 } },
        { id: 'ret', type: 'end', text: 'return out', col: 2, row: 0, narrow: { col: 1, row: 0 } }
      ],
      edges: [
        { from: 'loop', to: 'expire', label: 'yes' },
        { from: 'loop', to: 'ret', label: 'no' },
        { from: 'expire', to: 'evict', label: 'yes' },
        { from: 'expire', to: 'popq', label: 'no' },
        { from: 'evict', to: 'popq' },
        { from: 'popq', to: 'pop', label: 'yes' },
        { from: 'pop', to: 'popq' },
        { from: 'popq', to: 'push', label: 'no' },
        { from: 'push', to: 'emitq' },
        { from: 'emitq', to: 'emit', label: 'yes' },
        { from: 'emitq', to: 'loop', label: 'no: i + 1' },
        { from: 'emit', to: 'loop', via: { fromSide: 'right', toSide: 'right' } }
      ]
    };
  }

  /* ================================================================== deque on a ring (playground) */
  function dequeCreate(cap) { return { cap: cap, buf: new Array(cap).fill(null), head: 0, size: 0, next: 0 }; }
  function dequeApply(m, op, value) {
    var C = m.cap, buf = m.buf.slice(), head = m.head, size = m.size, next = m.next;
    var msg, ok = true, hot = null, returned;
    function idxBack() { return (head + size) % C; }
    if (op === 'pushFront') {
      if (size === C) return { model: m, ok: false, msg: '<b>pushFront</b>: the buffer is full (' + C + ' of ' + C + ' slots). Something must be removed first.', hot: null };
      var oh = head;
      head = (head - 1 + C) % C;
      buf[head] = { id: 'd' + next, value: value }; next++; size++; hot = buf[head].id;
      msg = '<b>pushFront(' + fmt(value) + ')</b> moves <b>head</b> one slot <em>backwards</em>: (' + oh + ' − 1 + ' + C + ') mod ' + C + ' = ' + head + '.' + (oh === 0 ? ' From slot 0 it wraps round to slot ' + (C - 1) + '. The “+ C” matters: in most languages (−1) mod ' + C + ' is −1, not ' + (C - 1) + '.' : '');
    } else if (op === 'pushBack') {
      if (size === C) return { model: m, ok: false, msg: '<b>pushBack</b>: the buffer is full (' + C + ' of ' + C + ' slots). Something must be removed first.', hot: null };
      var at = idxBack();
      buf[at] = { id: 'd' + next, value: value }; next++; size++; hot = buf[at].id;
      msg = '<b>pushBack(' + fmt(value) + ')</b> writes at (head + size) mod C = (' + head + ' + ' + (size - 1) + ') mod ' + C + ' = ' + at + ' and grows the size to ' + size + '.';
    } else if (op === 'popFront') {
      if (!size) return { model: m, ok: false, msg: '<b>popFront</b> on an empty deque: underflow.', hot: null };
      var f = buf[head]; buf[head] = null; returned = f.value;
      var h0 = head; head = (head + 1) % C; size--;
      msg = '<b>popFront()</b> returns ' + nm(f.value) + ' from slot ' + h0 + ' and moves head forward to ' + head + '.';
    } else if (op === 'popBack') {
      if (!size) return { model: m, ok: false, msg: '<b>popBack</b> on an empty deque: underflow.', hot: null };
      var bi = (head + size - 1) % C, b = buf[bi]; buf[bi] = null; size--; returned = b.value;
      msg = '<b>popBack()</b> returns ' + nm(b.value) + ' from slot ' + bi + ' and shrinks the size to ' + size + '. Head does not move.';
    } else throw new Error('unknown deque operation ' + op);
    return { model: { cap: C, buf: buf, head: head, size: size, next: next }, ok: ok, msg: msg, hot: hot, returned: returned };
  }
  function dequeItems(m) {
    var out = [];
    for (var k = 0; k < m.size; k++) out.push(m.buf[(m.head + k) % m.cap]);
    return out;
  }
  /* snapshots for VDSA.views.deque (logical order) and VDSA.views.ring (physical slots) */
  function dequeView(m, hot) {
    var items = dequeItems(m).map(function (x) { return { id: x.id, value: x.value, state: x.id === hot ? 'active' : 'default' }; });
    return {
      deque: { items: items },
      ring: { capacity: m.cap, slots: m.buf.map(function (x) { return x ? { id: x.id, value: x.value, state: x.id === hot ? 'active' : 'default' } : null; }), head: m.head, tail: (m.head + m.size) % m.cap, size: m.size }
    };
  }

  /* ================================================================== a queue from two stacks */
  function twoStacks(ops) {
    var inb = [], outb = [], n = 0, steps = [], pushes = 0, pops = 0, transfers = 0, outVals = [];
    function snap(kind, caption, hot, o) {
      o = o || {};
      steps.push({
        kind: kind, caption: caption,
        inbox: inb.map(function (x) { return { id: x.id, value: x.value, state: hot === x.id ? 'active' : 'default' }; }),
        outbox: outb.map(function (x) { return { id: x.id, value: x.value, state: hot === x.id ? 'active' : 'default' }; }),
        counters: { pushes: pushes, pops: pops, transfers: transfers },
        flow: o.flow || null, hotIn: o.hotIn, hotOut: o.hotOut
      });
    }
    snap('start', 'A queue made of two stacks. <b>inbox</b> receives every enqueue. <b>outbox</b> serves every dequeue. Values only ever move inbox → outbox.');
    ops.forEach(function (op) {
      if (op.type === 'enq') {
        var it = { id: 'w' + (n++), value: op.value };
        inb.push(it); pushes++;
        snap('enqueue', '<b>enqueue(' + esc(fmt(op.value)) + ')</b>: push ' + nm(op.value) + ' on the inbox. One push, no matter how long the queue is.', it.id);
      } else {
        if (!inb.length && !outb.length) { snap('underflow', '<b>dequeue()</b> on an empty queue: both stacks are empty, so this is an underflow.'); return; }
        if (!outb.length) {
          snap('need', '<b>dequeue()</b>: the outbox is empty, so the oldest value is buried at the <em>bottom</em> of the inbox. Pour the inbox into the outbox: popping and pushing <b>reverses</b> the order, which puts the oldest value on top.');
          while (inb.length) {
            var m = inb.pop(); pops++;
            outb.push(m); pushes++; transfers++;
            snap('transfer', 'Pop ' + nm(m.value) + ' from the inbox and push it on the outbox. ' + (inb.length ? plural(inb.length, 'value') + ' still to move.' : 'The inbox is empty: the outbox now holds the values in queue order, oldest on top.'), m.id);
          }
        }
        var top = outb.pop(); pops++; outVals.push(top.value);
        snap('dequeue', '<b>dequeue()</b> pops the top of the outbox: ' + nm(top.value) + ', the oldest value. ' + (outb.length ? 'The next dequeues are single pops until the outbox runs dry.' : 'The outbox is empty again: the next dequeue will refill it.'));
      }
    });
    var last = steps[steps.length - 1];
    steps.push(Object.assign({}, last, { kind: 'done', caption: 'A single dequeue can be slow (it may move every value), but each value is pushed and popped at most twice on each stack, so the average over many operations is constant: about ' + (transfers ? ((pushes + pops) / Math.max(1, n)).toFixed(1) : '1–2') + ' stack operations per value here. That is <em>amortized</em> O(1).' }));
    steps.dequeued = outVals;
    return steps;
  }

  /* ================================================================== a linked queue */
  function linkedQueue(ops) {
    var nodes = [], head = null, tail = null, n = 0, steps = [];
    function view(extra) {
      extra = extra || {};
      return nodes.map(function (x) {
        var o = { id: x.id, value: x.value, next: x.next, state: extra.state && extra.state[x.id] ? extra.state[x.id] : 'default' };
        if (extra.nextState && extra.nextState[x.id]) o.nextState = extra.nextState[x.id];
        if (extra.detached && extra.detached[x.id]) o.detached = extra.detached[x.id];
        return o;
      });
    }
    function snap(kind, caption, extra) {
      extra = extra || {};
      steps.push({
        kind: kind, caption: caption, nodes: view(extra),
        pointers: [{ name: 'head', target: head, state: 'active', side: 'above' }, { name: 'tail', target: tail, state: 'frontier', side: 'below' }],
        counters: { size: nodes.length }, order: nodes.map(function (x) { return x.id; }),
        headId: head, tailId: tail
      });
    }
    snap('start', 'A linked queue keeps two pointers: <b>head</b> at the front node and <b>tail</b> at the rear node. Both operations touch only one end, so neither has to walk the list.');
    ops.forEach(function (op) {
      if (op.type === 'enq') {
        var nn = { id: 'l' + (n++), value: op.value, next: null };
        var old = tail ? nodes.filter(function (x) { return x.id === tail; })[0] : null;
        nodes.push(nn);
        var det = {}; det[nn.id] = 'below';
        snap('create', '<b>enqueue(' + esc(fmt(op.value)) + ')</b>: make a new node holding ' + nm(op.value) + '. It points to nothing yet.', { detached: det, state: (function () { var s = {}; s[nn.id] = 'active'; return s; }()) });
        if (!old) {
          head = nn.id; tail = nn.id;
          snap('first', 'The queue was empty, so this node is both the front and the rear: <b>head</b> and <b>tail</b> both point to it.', { state: (function () { var s = {}; s[nn.id] = 'active'; return s; }()) });
        } else {
          old.next = nn.id;
          var ns = {}; ns[old.id] = 'swap';
          snap('link', 'Point the old rear node’s <b>next</b> at the new node. This one pointer write joins the new node to the line; nothing else moves.', { detached: det, nextState: ns, state: (function () { var s = {}; s[nn.id] = 'active'; return s; }()) });
          tail = nn.id;
          snap('tail', 'Move <b>tail</b> to the new node, the new rear. Total cost: two pointer writes, whatever the length.', { state: (function () { var s = {}; s[nn.id] = 'active'; return s; }()) });
        }
      } else {
        if (!head) { snap('underflow', '<b>dequeue()</b> on an empty queue: head is null. Underflow.'); return; }
        var first = nodes.filter(function (x) { return x.id === head; })[0];
        var st = {}; st[first.id] = 'swap';
        head = first.next;
        var willEmpty = head === null;
        snap('head', '<b>dequeue()</b>: read ' + nm(first.value) + ' at the front and move <b>head</b> to the next node' + (willEmpty ? ' (there is none, so head becomes null)' : '') + '.', { state: st });
        nodes = nodes.filter(function (x) { return x.id !== first.id; });
        if (willEmpty) {
          tail = null;
          snap('reset', 'The old node is unlinked. Because the queue is now empty, <b>tail must be set to null too</b>. Forgetting this line is the classic linked-queue bug: tail would still point at a node that is no longer in the queue.');
        } else {
          snap('free', 'The old node is unlinked and can be freed. <b>tail</b> did not change.');
        }
      }
    });
    return steps;
  }

  /* ================================================================== BFS flood fill on a grid */
  function cellName(r, c) { return String.fromCharCode(65 + c) + (r + 1); }
  function bfsReference(rows, cols, walls, start) {
    var wall = {}; walls.forEach(function (w) { wall[w[0] + ',' + w[1]] = true; });
    var dist = {}, q = [start], order = [];
    dist[start[0] + ',' + start[1]] = 0;
    while (q.length) {
      var u = q.shift(); order.push(u);
      [[-1, 0], [0, 1], [1, 0], [0, -1]].forEach(function (d) {
        var r = u[0] + d[0], c = u[1] + d[1], key = r + ',' + c;
        if (r < 0 || c < 0 || r >= rows || c >= cols || wall[key] || dist[key] !== undefined) return;
        dist[key] = dist[u[0] + ',' + u[1]] + 1; q.push([r, c]);
      });
    }
    return { dist: dist, order: order };
  }
  function bfsGrid(rows, cols, walls, start) {
    var wall = {}; walls.forEach(function (w) { wall[w[0] + ',' + w[1]] = true; });
    var dist = {}, state = {}, queue = [], steps = [], processed = 0, maxQ = 1, seq = 0;
    function cells(activeKey) {
      var o = {};
      Object.keys(state).forEach(function (k) { o[k] = { state: activeKey === k ? 'active' : state[k], label: String(dist[k]) }; });
      return o;
    }
    function snap(kind, caption, activeKey) {
      steps.push({
        kind: kind, rows: rows, cols: cols, walls: walls.map(function (w) { return [w[0], w[1]]; }), start: [start[0], start[1]],
        cells: cells(activeKey),
        queue: queue.map(function (x) { return { id: x.id, value: cellName(x.r, x.c), state: 'frontier', badge: undefined }; }),
        caption: caption,
        counters: { visited: processed, queued: queue.length, biggest: maxQ }
      });
    }
    var sk = start[0] + ',' + start[1];
    if (wall[sk]) throw new Error('start is a wall');
    dist[sk] = 0; state[sk] = 'frontier'; queue.push({ id: 'b' + (seq++), r: start[0], c: start[1] });
    snap('start', 'Start at <b>' + cellName(start[0], start[1]) + '</b>: put it in the queue with distance 0. The queue always holds the cells that are discovered but not yet expanded.');
    while (queue.length) {
      var u = queue.shift(); var uk = u.r + ',' + u.c;
      processed++;
      var found = [];
      [[-1, 0], [0, 1], [1, 0], [0, -1]].forEach(function (d) {
        var r = u.r + d[0], c = u.c + d[1], key = r + ',' + c;
        if (r < 0 || c < 0 || r >= rows || c >= cols || wall[key] || dist[key] !== undefined) return;
        dist[key] = dist[uk] + 1; state[key] = 'frontier';
        queue.push({ id: 'b' + (seq++), r: r, c: c }); found.push(cellName(r, c));
      });
      state[uk] = 'visited';
      maxQ = Math.max(maxQ, queue.length);
      snap('expand', 'Dequeue <b>' + cellName(u.r, u.c) + '</b> (distance ' + dist[uk] + ') from the front. ' + (found.length
        ? 'Its new neighbours ' + found.map(function (x) { return '<b>' + x + '</b>'; }).join(', ') + ' join the rear with distance ' + (dist[uk] + 1) + '.'
        : 'It has no undiscovered neighbours, so nothing joins the queue.') + ' Cells leave in the order they were found, so distances never decrease.', uk);
    }
    snap('done', 'The queue is empty: every reachable cell has its shortest distance. Cells at distance <em>d</em> were all expanded before any cell at distance d + 1, because the queue is first in, first out.');
    steps.dist = dist;
    return steps;
  }

  /* ================================================================== rate limiter and priority queue (minis) */
  /* At most `limit` requests per `window` seconds: a deque of accepted timestamps. */
  function rateLimiter(times, limit, win) {
    limit = limit || 3; win = win || 10;
    var dq = [], steps = [], n = 0;
    function snap(kind, label, hot, req) {
      steps.push({ kind: kind, label: label, request: req === undefined ? null : req,
        items: dq.map(function (x) { return { id: x.id, value: x.t, state: hot === x.id ? 'active' : 'default' }; }) });
    }
    snap('start', 'limit: ' + limit + ' requests per ' + win + ' s');
    times.forEach(function (t) {
      snap('arrive', 'request at t = ' + t, null, t);
      while (dq.length && t - dq[0].t >= win) {
        var old = dq.shift();
        snap('expire', 't = ' + old.t + ' is ' + (t - old.t) + ' s old: it leaves the window', null, t);
      }
      if (dq.length < limit) { var it = { id: 'r' + (n++), t: t }; dq.push(it); snap('accept', 'accepted (' + dq.length + ' of ' + limit + ' used)', it.id, t); }
      else snap('reject', 'rejected: ' + limit + ' requests in the last ' + win + ' s', null, t);
    });
    return steps;
  }
  /* Smaller number = more urgent. Ties go to the earlier arrival. */
  function priorityQueue(ops) {
    var items = [], n = 0, steps = [];
    function snap(kind, caption, hot) {
      steps.push({ kind: kind, caption: caption, items: items.map(function (x) { return { id: x.id, value: x.value, state: hot === x.id ? 'compare' : 'default' }; }) });
    }
    snap('start', 'A priority queue serves the most urgent value, not the oldest.');
    ops.forEach(function (op) {
      if (op.type === 'enq') { var it = { id: 'p' + (n++), value: op.value }; items.push(it); snap('enqueue', 'enqueue(' + fmt(op.value) + '): joins at the rear, like any queue.', it.id); return; }
      if (!items.length) { snap('underflow', 'Nothing to serve.'); return; }
      var best = 0;
      items.forEach(function (x, i) { if (x.value < items[best].value) best = i; });
      var b = items[best];
      snap('pick', 'The most urgent value is ' + fmt(b.value) + ', even though ' + (best === 0 ? 'it is also the oldest' : plural(best, 'older value') + (best === 1 ? ' is' : ' are') + ' waiting'), b.id);
      items.splice(best, 1);
      snap('serve', 'dequeue() removes ' + fmt(b.value) + ' from the middle of the line.');
    });
    return steps;
  }

  /* ================================================================== measured costs */
  /* Real implementations that count how many stored elements one operation reads or writes. */
  function makeShift(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return { a: a, ops: 0 }; }
  function dequeueCost(kind, n) {
    if (n < 1) return 0;
    if (kind === 'shift') {
      var q = makeShift(n), ops = 0;
      ops++; var x = q.a[0];                                   // read the front
      for (var i = 1; i < q.a.length; i++) { q.a[i - 1] = q.a[i]; ops++; }   // slide every other value one slot left
      q.a.length -= 1; void x;
      return ops;
    }
    if (kind === 'ring' || kind === 'linked') {
      var C = Math.max(n, 2), buf = new Array(C).fill(0), head = 0, size = n, o = 0;
      o++; var y = buf[head]; head = (head + 1) % C; size--; void y; void head; void size;   // one read, two index updates
      return o;
    }
    if (kind === 'twostack') {
      var inb = [], outb = [], ops2 = 0;
      for (var k = 0; k < n; k++) inb.push(k);
      while (inb.length) { outb.push(inb.pop()); ops2 += 2; }  // one pop + one push per moved value
      outb.pop(); ops2++;
      return ops2;
    }
    throw new Error('unknown kind ' + kind);
  }
  /* Average elements touched per dequeue while draining a queue that starts with n items. */
  function drainCost(kind, n) {
    if (n < 1) return 0;
    if (kind === 'shift') { var t = 0; for (var m = n; m >= 1; m--) t += dequeueCost('shift', m); return t / n; }
    if (kind === 'ring' || kind === 'linked') return 1;
    if (kind === 'twostack') {
      var inb = [], outb = [], ops = 0;
      for (var k = 0; k < n; k++) inb.push(k);
      for (var d = 0; d < n; d++) {
        if (!outb.length) while (inb.length) { outb.push(inb.pop()); ops += 2; }
        outb.pop(); ops++;
      }
      return ops / n;
    }
    throw new Error('unknown kind ' + kind);
  }

  return {
    parseOps: parseOps, parsePlan: parsePlan,
    ticketLine: ticketLine, queueOps: queueOps,
    arrayQueues: arrayQueues, ARRAY_DEFAULT: ARRAY_DEFAULT,
    ring: ring, ringCode: ringCode, ringFlow: ringFlow, RING_SCHEMES: RING_SCHEMES,
    stackVsQueue: stackVsQueue,
    slidingMax: slidingMax, slidingMaxReference: slidingMaxReference, slidingMaxCount: slidingMaxCount, bruteCount: bruteCount,
    WINDOW_CODE: WINDOW_CODE, windowFlow: windowFlow,
    dequeCreate: dequeCreate, dequeApply: dequeApply, dequeItems: dequeItems, dequeView: dequeView,
    twoStacks: twoStacks, linkedQueue: linkedQueue, rateLimiter: rateLimiter, priorityQueue: priorityQueue,
    bfsGrid: bfsGrid, bfsReference: bfsReference, cellName: cellName,
    dequeueCost: dequeueCost, drainCost: drainCost
  };
}));
