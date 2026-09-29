/* Lesson 04 · Functions & the call stack — pure step generators (no DOM).
   Browser: VDSA.algos.functions.   Node: module.exports (tests/algos/04-functions-and-the-stack.test.js).

   Generators (every step is a complete snapshot; nothing is mutated after it is pushed)
   - teaser(w, h)             hero loop: frames push/pop on a stack-and-heap diagram, arrows into the heap
   - jumps()                  the problem: one function, two call sites, a note that says where to return
   - notes()                  the intuition: interruptions pile up as notes, the newest is handled first
   - argFlight(w, h)          arguments are copied into parameters; the return value replaces the call
   - nested()                 hyp2(3, 4) calls square twice: call stack + a timeline of every call
   - valueVsRef()             a = 5; b = a; b++  beside  xs = [1, 2]; ys = xs; ys.push(3)
   - passing(kind)            'number' | 'mutate' | 'rebind': what a function can change through a parameter
   - overflow(withBase, cap)  countdown(3) with and without a base case, on a stack of `cap` frames
   - variant(kind)            'pure' | 'effect' | 'copy' | 'swap' | 'swapArr': the variations lab (global frame at the bottom)
   - lab(program, input)      'area' | 'total' | 'grow': the full code-synced lab (frames, heap, output)
   - labCode(program, input)  the lab's code in pseudocode, JavaScript and Python (labels: // @name, # @name)
   - parseLabInput(program, text) -> {values, error}
   Reference implementations (for tests and the lab's final answers): area, total, grow, listText. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.functions = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* ================================================================== small helpers */
  function num(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }          // typographic minus for captions
  function src(v) { return String(v); }                                      // ASCII minus for source code
  function listText(a) { return '[' + a.map(num).join(', ') + ']'; }
  function listSrc(a) { return '[' + a.map(src).join(', ') + ']'; }
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function raw(s) { return { __vdsaRaw: true, text: String(s) }; }          // VDSA.vars shows it without quotes

  /* Reference implementations: what the traced programs must compute. */
  function area(w, h) { return w * h; }
  function total(xs) { var s = 0; for (var i = 0; i < xs.length; i++) s += xs[i]; return s; }
  function grow(xs, v) { var a = xs.slice(); a.push(v); var b = [v]; b.push(v); return { scores: a, n: b.length }; }

  /* ================================================================== a tiny tracer for stack-and-heap programs
     Frames and heap arrays are mutable models; snap() freezes them into memory-view snapshots:
       frames: [{id, fn, args, state, returnValue?, vars: [{id?, name, value | ptr, state}]}]   (outermost first)
       heap:   [{id, kind: 'array', label, state, fields: [{value, state}]}]
     A heap array that no variable refers to is drawn 'muted' (unreachable): that is computed, never guessed. */
  function Tracer(opts) {
    opts = opts || {};
    this.frames = []; this.heap = []; this.out = [];
    this.calls = 0; this.returns = 0; this.deepest = 0; this.seq = 0; this.arrays = 0;
    this.steps = [];
    this.retLabel = opts.retLabel === undefined ? '↩ to' : opts.retLabel;
    this.showRet = opts.showRet !== false;
  }
  Tracer.prototype.push = function (fn, args, retTo) {
    this.seq += 1;
    var f = { id: fn + '-' + this.seq, fn: fn, args: args, retTo: retTo, vars: [], ret: undefined };
    this.frames.push(f);
    this.calls += 1;
    this.deepest = Math.max(this.deepest, this.frames.length);
    return f;
  };
  Tracer.prototype.pop = function () { this.returns += 1; return this.frames.pop(); };
  Tracer.prototype.top = function () { return this.frames[this.frames.length - 1]; };
  Tracer.prototype.caller = function () { return this.frames[this.frames.length - 2]; };
  Tracer.prototype.set = function (frame, name, value) {
    for (var i = 0; i < frame.vars.length; i++) if (frame.vars[i].name === name) { frame.vars[i] = { name: name, value: value }; return; }
    frame.vars.push({ name: name, value: value });
  };
  Tracer.prototype.setPtr = function (frame, name, ptr) {
    for (var i = 0; i < frame.vars.length; i++) if (frame.vars[i].name === name) { frame.vars[i] = { name: name, ptr: ptr }; return; }
    frame.vars.push({ name: name, ptr: ptr });
  };
  Tracer.prototype.get = function (frame, name) {
    for (var i = 0; i < frame.vars.length; i++) if (frame.vars[i].name === name) return frame.vars[i];
    return null;
  };
  Tracer.prototype.newArray = function (values) {
    this.arrays += 1;
    var a = { id: 'A' + this.arrays, label: 'array #' + this.arrays, values: values.slice() };
    this.heap.push(a);
    return a;
  };
  Tracer.prototype.array = function (id) { return this.heap.filter(function (a) { return a.id === id; })[0]; };
  Tracer.prototype.title = function (f) { return f.fn + '(' + f.args + ')'; };
  Tracer.prototype.reachable = function () {
    var seen = {};
    this.frames.forEach(function (f) { f.vars.forEach(function (v) { if (v.ptr) seen[v.ptr] = true; }); });
    return seen;
  };
  /* o: {kind, line, flow, caption, hl: {'frameId/name': state}, fields: {'A1/0': state}, top: 'active'|'done',
         fly: {from: frame, to: frame, name, value}, extra: {...}} */
  Tracer.prototype.snap = function (o) {
    var self = this, hl = o.hl || {}, fields = o.fields || {}, last = this.frames.length - 1;
    var reach = this.reachable();
    var frames = this.frames.map(function (f, i) {
      var st = i === last ? (o.top || 'active') : 'frontier';
      var vars = [];
      if (self.showRet && f.retTo) vars.push({ id: 'ret', name: self.retLabel, value: f.retTo, state: 'default' });
      f.vars.forEach(function (v) {
        var s = hl[f.id + '/' + v.name] || (v.value === '…' ? 'frontier' : 'default');
        vars.push(v.ptr !== undefined ? { name: v.name, ptr: v.ptr, state: s } : { name: v.name, value: v.value, state: s });
      });
      var snap = { id: f.id, fn: f.fn, args: f.args, state: st, vars: vars };
      if (i === last && o.top === 'done' && f.ret !== undefined) snap.returnValue = f.ret;
      return snap;
    });
    var heap = this.heap.map(function (a) {
      return {
        id: a.id, kind: 'array', label: a.label, state: reach[a.id] ? 'default' : 'muted',
        fields: a.values.map(function (v, k) { return { value: v, state: fields[a.id + '/' + k] || 'default' }; })
      };
    });
    var step = {
      kind: o.kind, line: o.line === undefined ? null : o.line, flow: o.flow || null, caption: o.caption,
      frames: frames, heap: heap, output: this.out.slice(),
      counters: { depth: this.frames.length, deepest: this.deepest, calls: this.calls, returns: this.returns }
    };
    if (o.fly) step.fly = { from: this.title(o.fly.from), to: this.title(o.fly.to), name: o.fly.name, value: o.fly.value };
    if (o.extra) Object.keys(o.extra).forEach(function (k) { step[k] = o.extra[k]; });
    this.steps.push(copy(step));
    return step;
  };

  /* ================================================================== hero teaser */
  function teaser(w, h) {
    var T = new Tracer({ showRet: false });
    var main = T.push('main', '', null);
    var A1 = T.newArray([w, h]);
    T.setPtr(main, 'dims', A1.id);
    T.snap({ kind: 'start', caption: 'main makes an array on the heap; dims holds a reference to it.', hl: {} });
    T.set(main, 's', '…');
    var ar = T.push('area', 'dims', 'main');
    T.setPtr(ar, 'd', A1.id);
    T.snap({ kind: 'push', caption: 'Calling area pushes a frame. d is a copy of the reference: two arrows, one array.', hl: {} });
    T.set(ar, 'r', '…');
    var mu = T.push('multiply', num(w) + ', ' + num(h), 'area');
    T.set(mu, 'a', w); T.set(mu, 'b', h);
    var hl = {}; hl[mu.id + '/a'] = 'swap'; hl[mu.id + '/b'] = 'swap';
    T.snap({ kind: 'push', caption: 'multiply gets copies of the two numbers.', hl: hl, fields: { 'A1/0': 'compare', 'A1/1': 'compare' } });
    mu.ret = w * h;
    T.snap({ kind: 'ret', caption: 'multiply returns ' + num(w * h) + '.', top: 'done' });
    T.pop();
    T.snap({ kind: 'pop', caption: 'Its frame pops, and the value travels back to area.', fly: { from: mu, to: ar, name: 'r', value: w * h } });
    T.set(ar, 'r', w * h); ar.ret = w * h;
    hl = {}; hl[ar.id + '/r'] = 'swap';
    T.snap({ kind: 'ret', caption: 'area stores it in r and returns it.', hl: hl, top: 'done' });
    T.pop();
    T.snap({ kind: 'pop', caption: 'area pops. Its reference to the array disappears with it.', fly: { from: ar, to: main, name: 's', value: w * h } });
    T.set(main, 's', w * h);
    hl = {}; hl[main.id + '/s'] = 'swap';
    T.snap({ kind: 'resume', caption: 'main resumes: s = ' + num(w * h) + '.', hl: hl });
    var A2 = T.newArray([w * h]);
    T.setPtr(main, 'dims', A2.id);
    hl = {}; hl[main.id + '/dims'] = 'swap';
    T.snap({ kind: 'rebind', caption: 'dims is rebound to a new array; the arrow swings, and the old array is unreachable.', hl: hl });
    T.heap = T.heap.filter(function (a) { return a.id !== A1.id; });
    T.snap({ kind: 'gc', caption: 'The garbage collector reclaims the old array.', hl: {} });
    return T.steps;
  }

  /* ================================================================== the problem: where does a function return to? */
  var JUMP_LINES = [
    'function area(w, h) {',
    '  return w * h;',
    '}',
    '',
    'let kitchen = area(3, 4);',
    'let hall = area(2, 5);',
    'let total = kitchen + hall;'
  ];
  function jumps() {
    var steps = [];
    function s(o) {
      steps.push(copy({
        line: o.line, notes: o.notes || [], arrow: o.arrow || null, params: o.params || null, result: o.result === undefined ? null : o.result,
        values: o.values || {}, caption: o.caption
      }));
    }
    s({ line: 5, caption: 'The program runs top to bottom. Line 5 needs the area of a 3 × 4 kitchen, so it calls <code>area(3, 4)</code>.' });
    s({ line: 1, notes: [5], arrow: { from: 5, to: 1, kind: 'call' }, params: { w: 3, h: 4 },
      caption: 'Control jumps up to <code>area</code>. It will have to come back, so first a note records <b>where</b>: line 5.' });
    s({ line: 2, notes: [5], params: { w: 3, h: 4 }, result: 12, caption: 'Inside the function, <code>w * h</code> is 3 × 4 = 12.' });
    s({ line: 5, arrow: { from: 2, to: 5, kind: 'ret' }, values: { kitchen: 12 },
      caption: '<code>return</code> reads the note and jumps back to line 5, carrying 12. The note is used up, and <code>kitchen</code> becomes 12.' });
    s({ line: 6, values: { kitchen: 12 }, caption: 'Line 6 needs the same computation for a 2 × 5 hall. No new code: it calls <code>area</code> again.' });
    s({ line: 1, notes: [6], arrow: { from: 6, to: 1, kind: 'call' }, params: { w: 2, h: 5 }, values: { kitchen: 12 },
      caption: 'Same jump, different note. This time the way back is line 6, so that is what gets written down.' });
    s({ line: 2, notes: [6], params: { w: 2, h: 5 }, result: 10, values: { kitchen: 12 }, caption: '2 × 5 = 10.' });
    s({ line: 6, arrow: { from: 2, to: 6, kind: 'ret' }, values: { kitchen: 12, hall: 10 },
      caption: 'The same <code>return</code> line now lands on line 6, because the note said 6. <code>hall</code> becomes 10.' });
    s({ line: 7, values: { kitchen: 12, hall: 10, total: 22 },
      caption: 'No calls on line 7: <code>total</code> = 12 + 10 = 22. One function served two callers because each call left a note.' });
    return steps;
  }

  /* ================================================================== intuition: a pile of notes */
  function notes() {
    var steps = [];
    function s(items, now, nowState, caption, kind) { steps.push(copy({ items: items, now: now, nowState: nowState, caption: caption, kind: kind })); }
    var n1 = { id: 'n1', value: 'book · p. 42' }, n2 = { id: 'n2', value: 'call · mid-sentence' };
    s([], 'Reading a book, page 42', 'active', 'You are reading, and nothing is waiting. The pile of notes is empty.', 'start');
    s([n1], 'Phone call with Sam', 'active', 'The phone rings. Before you answer, you jot down “page 42” and put the note on the pile.', 'push');
    s([n1, n2], 'Signing for a parcel', 'active', 'Mid-call, the doorbell rings. A second note, “mid-sentence”, goes on <b>top</b> of the first.', 'push');
    s([n1], 'Phone call, mid-sentence', 'done', 'Parcel signed. The <b>top</b> note says where to go back: the call, mid-sentence. The older note waits.', 'pop');
    s([], 'Reading, page 42', 'done', 'The call ends. The only note left says page 42. The last interruption was finished first.', 'pop');
    return steps;
  }

  /* ================================================================== arguments become parameters */
  function argFlight(w, h) {
    var p = w * h;
    return [
      { phase: 0, w: w, h: h, p: p, caption: 'The definition is a recipe. Writing it runs nothing: <code>w</code> and <code>h</code> are empty slots waiting for a call.' },
      { phase: 1, w: w, h: h, p: p, caption: 'The call <code>area(' + num(w) + ', ' + num(h) + ')</code> supplies the <b>arguments</b>: the values ' + num(w) + ' and ' + num(h) + '.' },
      { phase: 2, w: w, h: h, p: p, caption: 'Each argument is <b>copied</b> into the matching <b>parameter</b>, by position: first to <code>w</code>, second to <code>h</code>.' },
      { phase: 3, w: w, h: h, p: p, caption: 'The body runs with those values: <code>w * h</code> becomes ' + num(w) + ' × ' + num(h) + ' = ' + num(p) + '.' },
      { phase: 4, w: w, h: h, p: p, caption: '<code>return</code> sends ' + num(p) + ' back. It takes the place of the whole call expression.' },
      { phase: 5, w: w, h: h, p: p, caption: 'Now the line reads <code>kitchen = ' + num(p) + '</code>. The parameters are gone; only the value came back.' }
    ];
  }

  /* ================================================================== nested calls: call stack + timeline */
  var NESTED_LINES = { sq: 'sq', hyp: 'hyp', main: 'main', print: 'print' };
  function nested() {
    var steps = [], stack = [], bars = [], t = 0;
    function snap(line, caption, kind) {
      steps.push(copy({
        frames: stack.map(function (f) {
          var o = { id: f.id, fn: f.fn, args: f.args, locals: f.locals.slice(), line: f.line };
          if (f.state) o.state = f.state;
          if (f.returnValue !== undefined) o.returnValue = f.returnValue;
          return o;
        }),
        bars: bars.map(function (b) { return { id: b.id, label: b.label, depth: b.depth, start: b.start, end: b.end }; }),
        now: t, line: line, caption: caption, kind: kind, depth: stack.length
      }));
      t += 1;
    }
    function push(id, fn, args, label, locals) {
      var f = { id: id, fn: fn, args: args, locals: locals || [] };
      stack.forEach(function (g) { g.state = 'frontier'; });
      stack.push(f);
      bars.push({ id: id, label: label, depth: stack.length - 1, start: t, end: null });
      return f;
    }
    function pop() {
      var f = stack.pop();
      bars.forEach(function (b) { if (b.id === f.id) b.end = t; });
      if (stack.length) delete stack[stack.length - 1].state;
      return f;
    }
    var main = push('m', 'main', '', 'main()');
    snap('main', '<code>main</code> starts. Its frame is the only one on the stack, and its bar starts on the timeline.', 'push');
    main.locals = [['d', '…']];
    var hyp = push('h', 'hyp2', 'a=3, b=4', 'hyp2(3, 4)', [['a', 3], ['b', 4]]);
    snap('hyp', '<code>main</code> calls <code>hyp2(3, 4)</code>. <code>main</code> pauses, waiting for <code>d</code>; a second frame goes on top.', 'push');
    var sq1 = push('s1', 'square', 'x=3', 'square(3)', [['x', 3]]);
    snap('sq', '<code>hyp2</code> needs <code>square(a)</code> first, so a third frame goes on top. Now three calls are unfinished.', 'push');
    sq1.returnValue = 9; sq1.state = 'done';
    snap('sq', '<code>square(3)</code> computes 3 × 3 and returns 9. It is the last call made, and the first to finish.', 'ret');
    pop(); hyp.locals = [['a', 3], ['b', 4], ['square(a)', 9]];
    snap('hyp', 'Its frame pops. <code>hyp2</code> resumes halfway through its line, holding 9, and still needs <code>square(b)</code>.', 'pop');
    var sq2 = push('s2', 'square', 'x=4', 'square(4)', [['x', 4]]);
    snap('sq', 'A fresh frame for <code>square(4)</code> takes the spot the first one left. Same function, new frame, new <code>x</code>.', 'push');
    sq2.returnValue = 16; sq2.state = 'done';
    snap('sq', '<code>square(4)</code> returns 16.', 'ret');
    pop(); hyp.locals = [['a', 3], ['b', 4], ['square(a)', 9], ['square(b)', 16]];
    snap('hyp', '<code>hyp2</code> has both answers: 9 + 16.', 'pop');
    hyp.returnValue = 25; hyp.state = 'done';
    snap('hyp', '<code>hyp2</code> returns 25 to the caller that has waited longest: <code>main</code>.', 'ret');
    pop(); main.locals = [['d', 25]];
    snap('main', 'Back in <code>main</code>: <code>d</code> = 25. Only one frame is left.', 'pop');
    snap('print', '<code>main</code> prints 25. Every call ended in the reverse order it started.', 'run');
    main.returnValue = 'done'; main.state = 'done';
    delete main.returnValue;
    pop();
    snap(null, '<code>main</code> finishes and its frame pops. The stack is empty; the timeline shows every call nested inside its caller.', 'pop');
    return steps;
  }
  var NESTED_CODE = {
    pseudo: [
      'function square(x)',
      '  return x × x                  // @sq',
      '',
      'function hyp2(a, b)',
      '  return square(a) + square(b)  // @hyp',
      '',
      'function main()',
      '  d ← hyp2(3, 4)                // @main',
      '  print(d)                      // @print'
    ].join('\n'),
    js: [
      'function square(x) {',
      '  return x * x;                  // @sq',
      '}',
      'function hyp2(a, b) {',
      '  return square(a) + square(b);  // @hyp',
      '}',
      'function main() {',
      '  const d = hyp2(3, 4);          // @main',
      '  console.log(d);                // @print',
      '}'
    ].join('\n'),
    py: [
      'def square(x):',
      '    return x * x                  # @sq',
      '',
      'def hyp2(a, b):',
      '    return square(a) + square(b)  # @hyp',
      '',
      'def main():',
      '    d = hyp2(3, 4)                # @main',
      '    print(d)                      # @print'
    ].join('\n')
  };

  /* ================================================================== value vs reference, side by side */
  function valueVsRef() {
    var steps = [];
    function main(vars) { return [{ id: 'main', fn: 'main', args: '', state: 'active', vars: vars }]; }
    function A(vals, states, state) { return [{ id: 'A1', kind: 'array', label: 'array #1', state: state || 'default', fields: vals.map(function (v, i) { return { value: v, state: (states && states[i]) || 'default' }; }) }]; }
    function s(o) { steps.push(copy(o)); }
    s({ left: { frames: main([]), heap: [] }, right: { frames: main([]), heap: [] }, lineL: null, lineR: null, outL: '', outR: '',
      caption: 'Two tiny programs run side by side. They make the same moves: store, copy, change, print.' });
    s({ left: { frames: main([{ name: 'a', value: 5, state: 'swap' }]), heap: [] },
      right: { frames: main([{ name: 'xs', ptr: 'A1', state: 'swap' }]), heap: A([1, 2]) }, lineL: 1, lineR: 1, outL: '', outR: '',
      caption: 'A number fits in the variable’s box. An array is built on the <b>heap</b>, and <code>xs</code> holds a <b>reference</b> to it: the arrow.' });
    s({ left: { frames: main([{ name: 'a', value: 5, state: 'compare' }, { name: 'b', value: 5, state: 'swap' }]), heap: [] },
      right: { frames: main([{ name: 'xs', ptr: 'A1', state: 'compare' }, { name: 'ys', ptr: 'A1', state: 'swap' }]), heap: A([1, 2]) }, lineL: 2, lineR: 2, outL: '', outR: '',
      caption: 'Assignment copies whatever is in the box. <code>a</code> holds 5, so <code>b</code> gets its own 5. <code>xs</code> holds a reference, so <code>ys</code> gets the <b>same reference</b>: one array, two arrows.' });
    s({ left: { frames: main([{ name: 'a', value: 5 }, { name: 'b', value: 6, state: 'swap' }]), heap: [] },
      right: { frames: main([{ name: 'xs', ptr: 'A1' }, { name: 'ys', ptr: 'A1', state: 'swap' }]), heap: A([1, 2, 3], [null, null, 'swap']) }, lineL: 3, lineR: 3, outL: '', outR: '',
      caption: 'Changing <code>b</code> changes only <code>b</code>’s box. <code>ys.push(3)</code> follows the arrow and changes the one array, which <code>xs</code> also points at.' });
    s({ left: { frames: main([{ name: 'a', value: 5 }, { name: 'b', value: 6 }]), heap: [] },
      right: { frames: main([{ name: 'xs', ptr: 'A1' }, { name: 'ys', ptr: 'A1' }]), heap: A([1, 2, 3]) }, lineL: 4, lineR: 4, outL: '5 6', outR: '[1, 2, 3] [1, 2, 3]',
      caption: 'The prints show it: <code>a</code> is still 5, but <code>xs</code> “changed” without being touched, because it names the same array as <code>ys</code>.' });
    return steps;
  }
  var VVR_CODE = {
    left: ['let a = 5;', 'let b = a;', 'b = b + 1;', 'print(a, b);'],
    right: ['let xs = [1, 2];', 'let ys = xs;', 'ys.push(3);', 'print(xs, ys);']
  };

  /* ================================================================== passing into a function */
  var PASS_CODE = {
    number: ['function bump(n) {', '  n = n + 1;', '  return n;', '}', 'let count = 5;', 'let r = bump(count);', 'print(count, r);'],
    mutate: ['function add(xs) {', '  xs.push(9);', '}', '', 'let list = [1, 2];', 'add(list);', 'print(list);'],
    rebind: ['function replace(xs) {', '  xs = [9];', '}', '', 'let list = [1, 2];', 'replace(list);', 'print(list);']
  };
  function passing(kind) {
    var T = new Tracer();
    var main = T.push('main', '', null), hl, f;
    function out(o) { o.extra = o.extra || {}; return o; }
    if (kind === 'number') {
      T.set(main, 'count', 5);
      T.snap(out({ kind: 'make', line: 5, caption: '<code>count</code> holds the number 5.', hl: { 'main-1/count': 'swap' } }));
      T.set(main, 'r', '…');
      f = T.push('bump', 'count', 'main'); T.set(f, 'n', 5);
      hl = {}; hl[f.id + '/n'] = 'swap'; hl['main-1/count'] = 'compare';
      T.snap(out({ kind: 'push', line: 1, caption: 'The call copies the <b>value</b> 5 into a new frame. <code>n</code> and <code>count</code> are two separate boxes that happen to hold equal numbers.', hl: hl }));
      T.set(f, 'n', 6); hl = {}; hl[f.id + '/n'] = 'swap';
      T.snap(out({ kind: 'run', line: 2, caption: '<code>n = n + 1</code> writes 6 into <code>n</code>’s box. <code>count</code> is in a different frame and cannot be reached from here.', hl: hl }));
      f.ret = 6;
      T.snap(out({ kind: 'ret', line: 3, caption: '<code>return n</code> hands back 6.', top: 'done' }));
      T.pop();
      T.snap(out({ kind: 'pop', line: 6, caption: 'The frame pops and <code>n</code> is gone. The only way the 6 reaches <code>main</code> is as the return value.', fly: { from: f, to: main, name: 'r', value: 6 } }));
      T.set(main, 'r', 6);
      T.snap(out({ kind: 'resume', line: 6, caption: '<code>r</code> = 6.', hl: { 'main-1/r': 'swap' } }));
      T.out.push('5 6');
      T.snap(out({ kind: 'print', line: 7, caption: 'Prints <code>5 6</code>: <code>count</code> never changed. A function cannot rebind its caller’s variables.' }));
      return T.steps;
    }
    var A1 = T.newArray([1, 2]);
    T.setPtr(main, 'list', A1.id);
    T.snap({ kind: 'make', line: 5, caption: '<code>list</code> holds a reference to an array on the heap.', hl: { 'main-1/list': 'swap' } });
    var fn = kind === 'mutate' ? 'add' : 'replace';
    f = T.push(fn, 'list', 'main'); T.setPtr(f, 'xs', A1.id);
    hl = {}; hl[f.id + '/xs'] = 'swap'; hl['main-1/list'] = 'compare';
    T.snap({ kind: 'push', line: 1, caption: 'The call copies the value in <code>list</code>, which is a <b>reference</b>. Now <code>xs</code> and <code>list</code> point at the same array.', hl: hl });
    if (kind === 'mutate') {
      A1.values.push(9);
      T.snap({ kind: 'run', line: 2, caption: '<code>xs.push(9)</code> follows the arrow and changes the shared array. <code>list</code> sees it too: there is only one array.', fields: { 'A1/2': 'swap' } });
      T.pop();
      T.snap({ kind: 'pop', line: 6, caption: '<code>add</code> returns nothing and its frame pops. <code>xs</code> is gone, but the change it made lives on in the array.' });
      T.out.push('[1, 2, 9]');
      T.snap({ kind: 'print', line: 7, caption: 'Prints <code>[1, 2, 9]</code>. Mutating through a reference is visible to everyone holding that reference.' });
      return T.steps;
    }
    var A2 = T.newArray([9]);
    T.setPtr(f, 'xs', A2.id);
    hl = {}; hl[f.id + '/xs'] = 'swap';
    T.snap({ kind: 'run', line: 2, caption: '<code>xs = [9]</code> builds a new array and <b>rebinds</b> <code>xs</code> to it. The arrow swings away; <code>list</code>’s arrow does not move.', hl: hl });
    T.pop();
    T.snap({ kind: 'pop', line: 6, caption: 'The frame pops. Nothing refers to <code>[9]</code> any more, so it is unreachable: garbage, reclaimed at some later moment.' });
    T.out.push('[1, 2]');
    T.snap({ kind: 'print', line: 7, caption: 'Prints <code>[1, 2]</code>. Rebinding a parameter changes only the function’s own box.' });
    return T.steps;
  }

  /* ================================================================== variations: pure, impure, copy, swap
     Every variant runs at the top level, so the bottom frame is 'global' (top-level code and global variables). */
  var VARIANT_CODE = {
    pure: ['function bumped(xs) {', '  const out = xs.map(x => x + 1);', '  return out;', '}', 'let a = [1, 2];', 'let b = bumped(a);', 'print(a, b);'],
    effect: ['let count = 0;', 'function next() {', '  count = count + 1;', '  return count;', '}', 'let a = next();', 'let b = next();', 'print(a, b);'],
    copy: ['function withNine(xs) {', '  const ys = xs.slice();', '  ys.push(9);', '  return ys;', '}', 'let a = [1, 2];', 'let b = withNine(a);', 'print(a, b);'],
    swap: ['function swap(x, y) {', '  const t = x;', '  x = y;', '  y = t;', '}', 'let a = 1;', 'let b = 2;', 'swap(a, b);', 'print(a, b);'],
    swapArr: ['function swap(xs, i, j) {', '  const t = xs[i];', '  xs[i] = xs[j];', '  xs[j] = t;', '}', 'let a = [1, 2];', 'swap(a, 0, 1);', 'print(a);']
  };
  var VARIANT_TITLES = {
    pure: 'Pure: same input, same output, nothing else changes',
    effect: 'Impure: a global changes, so the same call answers differently',
    copy: 'Copy first, then change the copy',
    swap: 'The swap that swaps nothing',
    swapArr: 'The swap that works: it changes the array'
  };
  function variant(kind) {
    if (!VARIANT_CODE[kind]) throw new Error('unknown variant ' + kind);
    var T = new Tracer(), g = T.push('global', '', null), f, hl, fl, A1, A2, ret;
    function S(o) { return T.snap(o); }
    function key(fr, name) { return fr.id + '/' + name; }
    if (kind === 'pure' || kind === 'copy') {
      var pure = kind === 'pure';
      var off = pure ? 4 : 5, vals = [1, 2];
      A1 = T.newArray(vals); T.setPtr(g, 'a', A1.id);
      hl = {}; hl[key(g, 'a')] = 'swap';
      S({ kind: 'make', line: off + 1, hl: hl, caption: '<code>a</code> refers to the array [1, 2] on the heap.' });
      T.set(g, 'b', '…');
      f = T.push(pure ? 'bumped' : 'withNine', 'a', 'global'); T.setPtr(f, 'xs', A1.id);
      hl = {}; hl[key(f, 'xs')] = 'swap'; hl[key(g, 'a')] = 'compare';
      S({ kind: 'push', line: 1, hl: hl, caption: 'The call copies the reference, so <code>xs</code> and <code>a</code> share one array. What the function does next decides whether the caller notices.' });
      A2 = T.newArray(pure ? [2, 3] : [1, 2]);
      T.setPtr(f, pure ? 'out' : 'ys', A2.id);
      hl = {}; hl[key(f, pure ? 'out' : 'ys')] = 'swap';
      S({ kind: 'make', line: 2, hl: hl, caption: pure
        ? '<code>map</code> builds a <b>new</b> array with each value plus one, and <code>out</code> refers to it. <code>a</code>’s array is only read.'
        : '<code>slice()</code> makes a <b>copy</b> of the array. <code>ys</code> refers to the copy; <code>xs</code> still refers to the original.' });
      if (!pure) {
        A2.values.push(9);
        fl = {}; fl[A2.id + '/2'] = 'swap';
        S({ kind: 'mutate', line: 3, fields: fl, caption: '<code>ys.push(9)</code> changes the copy. The original array, and so <code>a</code>, cannot be affected.' });
      }
      f.ret = 'array #2';
      S({ kind: 'ret', line: pure ? 3 : 4, top: 'done', caption: '<code>return</code> hands back the reference in <code>' + (pure ? 'out' : 'ys') + '</code>: the address of the new array, not its contents.' });
      T.pop(); T.setPtr(g, 'b', A2.id);
      hl = {}; hl[key(g, 'b')] = 'swap';
      S({ kind: 'pop', line: pure ? 6 : 7, hl: hl, fly: { from: f, to: g, name: 'b', value: '→ #2' },
        caption: 'The frame pops and its variables disappear, but the new array stays on the heap because <code>b</code> now refers to it.' });
      T.out.push(listText(A1.values) + ' ' + listText(A2.values));
      S({ kind: 'print', line: pure ? 7 : 8, caption: 'Prints <code>' + listText(A1.values) + ' ' + listText(A2.values) + '</code>. The caller’s array is untouched: nothing outside the function changed.' });
      return T.steps;
    }
    if (kind === 'effect') {
      T.set(g, 'count', 0);
      hl = {}; hl[key(g, 'count')] = 'swap';
      S({ kind: 'make', line: 1, hl: hl, caption: '<code>count</code> is a <b>global</b>: it lives in the outermost frame, visible to every function.' });
      T.set(g, 'a', '…');
      var results = [];
      [['a', 6, 7], ['b', 7, 8]].forEach(function (cfg, k) {
        var name = cfg[0], callLine = cfg[1], printLine = cfg[2];
        if (k) T.set(g, 'b', '…');
        f = T.push('next', '', 'global');
        S({ kind: 'push', line: 2, caption: k ? '<code>next()</code> is called again with exactly the same arguments: none.' : '<code>next()</code> takes no arguments and has no locals. Everything it uses lives outside the frame.' });
        T.set(g, 'count', k + 1);
        hl = {}; hl[key(g, 'count')] = 'swap';
        S({ kind: 'effect', line: 3, hl: hl, caption: 'It reaches out and changes <code>count</code> in the global frame: a <b>side effect</b>. The change outlives this call.' });
        f.ret = k + 1; results.push(k + 1);
        S({ kind: 'ret', line: 4, top: 'done', caption: '<code>return count</code> gives back ' + (k + 1) + '.' });
        T.pop(); T.set(g, name, k + 1);
        hl = {}; hl[key(g, name)] = 'swap';
        S({ kind: 'pop', line: callLine, hl: hl, fly: { from: f, to: g, name: name, value: k + 1 },
          caption: k ? 'Same call, different answer: <code>b</code> = 2. The result depends on hidden state, not only on the arguments.' : '<code>a</code> = 1. The frame is gone, but the global <code>count</code> keeps the change it made.' });
      });
      T.out.push(results.join(' '));
      S({ kind: 'print', line: 8, caption: 'Prints <code>1 2</code>. Because the result depends on <code>count</code>, you cannot predict a call from its arguments alone. That makes such functions harder to test and reuse.' });
      return T.steps;
    }
    if (kind === 'swap') {
      T.set(g, 'a', 1); T.set(g, 'b', 2);
      hl = {}; hl[key(g, 'a')] = 'swap'; hl[key(g, 'b')] = 'swap';
      S({ kind: 'make', line: 7, hl: hl, caption: '<code>a</code> and <code>b</code> hold the numbers 1 and 2.' });
      f = T.push('swap', 'a, b', 'global'); T.set(f, 'x', 1); T.set(f, 'y', 2);
      hl = {}; hl[key(f, 'x')] = 'swap'; hl[key(f, 'y')] = 'swap'; hl[key(g, 'a')] = 'compare'; hl[key(g, 'b')] = 'compare';
      S({ kind: 'push', line: 1, hl: hl, caption: 'The parameters <code>x</code> and <code>y</code> are <b>copies</b> of the numbers, in a new frame. They are not <code>a</code> and <code>b</code>.' });
      T.set(f, 't', 1);
      hl = {}; hl[key(f, 't')] = 'swap';
      S({ kind: 'run', line: 2, hl: hl, caption: 'The temporary <code>t</code> keeps a copy of <code>x</code>.' });
      T.set(f, 'x', 2);
      hl = {}; hl[key(f, 'x')] = 'swap';
      S({ kind: 'run', line: 3, hl: hl, caption: '<code>x = y</code> overwrites the local <code>x</code> with 2.' });
      T.set(f, 'y', 1);
      hl = {}; hl[key(f, 'y')] = 'swap';
      S({ kind: 'run', line: 4, hl: hl, caption: '<code>y = t</code> puts 1 in the local <code>y</code>. Inside this frame the values have swapped.' });
      S({ kind: 'ret', line: 5, top: 'done', caption: 'The function ends. It returns nothing, so nothing carries the swapped values out.' });
      T.pop();
      S({ kind: 'pop', line: 8, caption: 'The frame pops and <code>x</code>, <code>y</code> and <code>t</code> vanish. <code>a</code> and <code>b</code> never changed.' });
      T.out.push('1 2');
      S({ kind: 'print', line: 9, caption: 'Prints <code>1 2</code>. A function cannot change its caller’s number variables.' });
      return T.steps;
    }
    // swapArr
    A1 = T.newArray([1, 2]); T.setPtr(g, 'a', A1.id);
    hl = {}; hl[key(g, 'a')] = 'swap';
    S({ kind: 'make', line: 6, hl: hl, caption: '<code>a</code> refers to the array [1, 2].' });
    f = T.push('swap', 'a, 0, 1', 'global'); T.setPtr(f, 'xs', A1.id); T.set(f, 'i', 0); T.set(f, 'j', 1);
    hl = {}; hl[key(f, 'xs')] = 'swap'; hl[key(g, 'a')] = 'compare';
    S({ kind: 'push', line: 1, hl: hl, caption: '<code>xs</code> is a copy of the <b>reference</b>: it points at the caller’s array. <code>i</code> and <code>j</code> are copies of the numbers 0 and 1.' });
    T.set(f, 't', 1);
    hl = {}; hl[key(f, 't')] = 'swap';
    fl = {}; fl[A1.id + '/0'] = 'compare';
    S({ kind: 'run', line: 2, hl: hl, fields: fl, caption: '<code>t</code> keeps a copy of the number in <code>xs[0]</code>.' });
    A1.values[0] = 2;
    fl = {}; fl[A1.id + '/0'] = 'swap';
    S({ kind: 'mutate', line: 3, fields: fl, caption: '<code>xs[0] = xs[1]</code> follows the arrow and overwrites slot 0 of the shared array.' });
    A1.values[1] = 1;
    fl = {}; fl[A1.id + '/1'] = 'swap';
    S({ kind: 'mutate', line: 4, fields: fl, caption: '<code>xs[1] = t</code> writes the saved 1 into slot 1. The array itself is now [2, 1].' });
    S({ kind: 'ret', line: 5, top: 'done', caption: 'The function ends and returns nothing. The change does not need a return value: it was made on the array.' });
    T.pop();
    S({ kind: 'pop', line: 7, caption: 'The frame pops. <code>xs</code> is gone, but the array it changed is not.' });
    T.out.push(listText(A1.values));
    S({ kind: 'print', line: 8, caption: 'Prints <code>[2, 1]</code>. This time the caller sees the swap, because the function changed the shared object rather than its own copies.' });
    return T.steps;
  }

  /* ================================================================== stack overflow */
  function overflow(withBase, cap) {
    cap = cap || 10;
    var steps = [], frames = [], out = [], seq = 0;
    function snap(o) {
      steps.push(copy({
        frames: frames.map(function (f, i) { return { id: f.id, n: f.n, state: i === frames.length - 1 ? (o.top || 'active') : 'frontier' }; }),
        output: out.slice(), cap: cap, overflow: !!o.overflow, line: o.line, caption: o.caption, kind: o.kind,
        counters: { frames: frames.length, limit: cap }
      }));
    }
    function push(n) { seq += 1; frames.push({ id: 'c' + seq, n: n }); }
    snap({ kind: 'start', line: 'start', caption: withBase ? 'The program calls <code>countdown(3)</code>. The stack region is empty; the heap sits far below.' : 'The same function with the base case deleted. Watch what stops it now.' });
    var n = 3;
    for (;;) {
      push(n);
      if (frames.length > cap) {
        snap({ kind: 'overflow', line: 'rec', top: 'error', overflow: true,
          caption: 'Frame ' + frames.length + ' does not fit: the stack has hit its limit. The program crashes with a <b>stack overflow</b> (JavaScript: <code>RangeError: Maximum call stack size exceeded</code>; Python: <code>RecursionError</code>).' });
        return steps;
      }
      if (withBase && n === 0) {
        snap({ kind: 'push', line: 'base', caption: '<code>countdown(0)</code>: the base case is true, so it returns without calling again. The pile stops growing at ' + frames.length + ' frames.' });
        break;
      }
      out.push(num(n));
      snap({ kind: 'push', line: 'rec', caption: frames.length === 1
        ? '<code>countdown(3)</code> prints 3 and calls <code>countdown(2)</code>. Its frame must stay until that call returns.'
        : '<code>countdown(' + num(n) + ')</code> prints ' + num(n) + ' and calls again. ' + frames.length + ' frames are waiting' + (withBase ? '.' : ', and nothing ever says stop.') });
      n -= 1;
    }
    while (frames.length) {
      var f = frames[frames.length - 1];
      snap({ kind: 'ret', line: frames.length === 4 ? 'base' : 'rec', top: 'done', caption: '<code>countdown(' + num(f.n) + ')</code> is finished and returns.' });
      frames.pop();
    }
    snap({ kind: 'end', line: 'start', caption: 'The frames popped in reverse order. The deepest the stack got was 4 frames, far below the limit.' });
    return steps;
  }
  var OVERFLOW_CODE = {
    base: {
      pseudo: ['function countdown(n)', '  if n = 0 then return          // @base', '  print(n)', '  countdown(n − 1)               // @rec', '', 'countdown(3)                     // @start'].join('\n'),
      js: ['function countdown(n) {', '  if (n === 0) return;           // @base', '  console.log(n);', '  countdown(n - 1);              // @rec', '}', 'countdown(3);                    // @start'].join('\n'),
      py: ['def countdown(n):', '    if n == 0: return            # @base', '    print(n)', '    countdown(n - 1)             # @rec', '', 'countdown(3)                     # @start'].join('\n')
    },
    none: {
      pseudo: ['function countdown(n)', '  (no base case here)            // @base', '  print(n)', '  countdown(n − 1)               // @rec', '', 'countdown(3)                     // @start'].join('\n'),
      js: ['function countdown(n) {', '  /* no base case here */       // @base', '  console.log(n);', '  countdown(n - 1);              // @rec', '}', 'countdown(3);                    // @start'].join('\n'),
      py: ['def countdown(n):', '    pass  # no base case here    # @base', '    print(n)', '    countdown(n - 1)             # @rec', '', 'countdown(3)                     # @start'].join('\n')
    }
  };

  /* ================================================================== the lab */
  var PROGRAMS = {
    area: { title: 'Nested calls', file: 'area', input: [3, 4] },
    total: { title: 'Pass an array', file: 'total', input: [4, 7, 1] },
    grow: { title: 'Mutate, then rebind', file: 'grow', input: [4, 7] }
  };
  var GROW_V = 5;

  function parseLabInput(program, text) {
    var tokens = String(text === undefined || text === null ? '' : text).replace(/−/g, '-').replace(/[\[\]()]/g, ' ').split(/[\s,;]+/).filter(Boolean);
    var values = [];
    for (var i = 0; i < tokens.length; i++) {
      var n = Number(tokens[i]);
      if (!isFinite(n) || !Number.isInteger(n)) return { values: [], error: '“' + tokens[i] + '” is not a whole number.' };
      if (n < -99 || n > 99) return { values: [], error: 'Keep numbers between −99 and 99 so they fit in the boxes.' };
      values.push(n);
    }
    if (program === 'area') {
      if (values.length !== 2) return { values: [], error: 'area needs exactly two numbers: a width and a height, e.g. 3, 4.' };
      return { values: values, error: null };
    }
    var max = program === 'total' ? 6 : 5;
    if (values.length > max) return { values: [], error: 'Use at most ' + max + ' numbers so every frame and cell stays readable.' };
    return { values: values, error: null };
  }

  function labCode(program, input) {
    if (program === 'area') {
      var call = src(input[0]) + ', ' + src(input[1]);
      return {
        pseudo: [
          'function multiply(a, b)        // @mulSig',
          '  p ← a × b                    // @mulBody',
          '  return p                     // @mulRet',
          '',
          'function area(w, h)            // @areaSig',
          '  r ← multiply(w, h)           // @areaCall',
          '  return r                     // @areaRet',
          '',
          'function main()                // @mainSig',
          '  s ← area(' + call + ')' + pad(18 - call.length) + '// @mainCall',
          '  print(s)                     // @print',
          '',
          'main()                         // @start'
        ].join('\n'),
        js: [
          'function multiply(a, b) {      // @mulSig',
          '  const p = a * b;             // @mulBody',
          '  return p;                    // @mulRet',
          '}',
          '',
          'function area(w, h) {          // @areaSig',
          '  const r = multiply(w, h);    // @areaCall',
          '  return r;                    // @areaRet',
          '}',
          '',
          'function main() {              // @mainSig',
          '  const s = area(' + call + ');' + pad(12 - call.length) + '// @mainCall',
          '  console.log(s);              // @print',
          '}',
          '',
          'main();                        // @start'
        ].join('\n'),
        py: [
          'def multiply(a, b):            # @mulSig',
          '    p = a * b                  # @mulBody',
          '    return p                   # @mulRet',
          '',
          'def area(w, h):                # @areaSig',
          '    r = multiply(w, h)         # @areaCall',
          '    return r                   # @areaRet',
          '',
          'def main():                    # @mainSig',
          '    s = area(' + call + ')' + pad(16 - call.length) + '# @mainCall',
          '    print(s)                   # @print',
          '',
          'main()                         # @start'
        ].join('\n')
      };
    }
    if (program === 'total') {
      var lit = listSrc(input);
      return {
        pseudo: [
          'function total(xs)             // @sig',
          '  s ← 0                        // @init',
          '  for each x in xs             // @loop',
          '    s ← s + x                  // @add',
          '  return s                     // @ret',
          '',
          'function main()                // @mainSig',
          '  scores ← ' + lit + pad(20 - lit.length) + '// @make',
          '  t ← total(scores)            // @call',
          '  print(t)                     // @print',
          '',
          'main()                         // @start'
        ].join('\n'),
        js: [
          'function total(xs) {           // @sig',
          '  let s = 0;                   // @init',
          '  for (const x of xs) {        // @loop',
          '    s = s + x;                 // @add',
          '  }',
          '  return s;                    // @ret',
          '}',
          '',
          'function main() {              // @mainSig',
          '  const scores = ' + lit + ';' + pad(14 - lit.length) + '// @make',
          '  const t = total(scores);     // @call',
          '  console.log(t);              // @print',
          '}',
          '',
          'main();                        // @start'
        ].join('\n'),
        py: [
          'def total(xs):                 # @sig',
          '    s = 0                      # @init',
          '    for x in xs:               # @loop',
          '        s = s + x              # @add',
          '    return s                   # @ret',
          '',
          'def main():                    # @mainSig',
          '    scores = ' + lit + pad(18 - lit.length) + '# @make',
          '    t = total(scores)          # @call',
          '    print(t)                   # @print',
          '',
          'main()                         # @start'
        ].join('\n')
      };
    }
    var lit2 = listSrc(input);
    return {
      pseudo: [
        'function grow(xs, v)           // @sig',
        '  append v to xs               // @push1',
        '  xs ← [v]                     // @rebind',
        '  append v to xs               // @push2',
        '  return length(xs)            // @ret',
        '',
        'function main()                // @mainSig',
        '  scores ← ' + lit2 + pad(20 - lit2.length) + '// @make',
        '  n ← grow(scores, ' + GROW_V + ')          // @call',
        '  print(scores, n)             // @print',
        '',
        'main()                         // @start'
      ].join('\n'),
      js: [
        'function grow(xs, v) {         // @sig',
        '  xs.push(v);                  // @push1',
        '  xs = [v];                    // @rebind',
        '  xs.push(v);                  // @push2',
        '  return xs.length;            // @ret',
        '}',
        '',
        'function main() {              // @mainSig',
        '  const scores = ' + lit2 + ';' + pad(14 - lit2.length) + '// @make',
        '  const n = grow(scores, ' + GROW_V + ');  // @call',
        '  console.log(scores, n);      // @print',
        '}',
        '',
        'main();                        // @start'
      ].join('\n'),
      py: [
        'def grow(xs, v):               # @sig',
        '    xs.append(v)               # @push1',
        '    xs = [v]                   # @rebind',
        '    xs.append(v)               # @push2',
        '    return len(xs)             # @ret',
        '',
        'def main():                    # @mainSig',
        '    scores = ' + lit2 + pad(18 - lit2.length) + '# @make',
        '    n = grow(scores, ' + GROW_V + ')        # @call',
        '    print(scores, n)           # @print',
        '',
        'main()                         # @start'
      ].join('\n')
    };
  }
  function pad(k) { var s = ' '; while (s.length < k) s += ' '; return s; }

  /* Variable-watch rows shared by every lab step: what runs, who waits, what came back, what was printed. */
  function watch(T, extra) {
    var names = T.frames.map(function (f) { return f.fn; });
    var o = {
      running: names.length ? raw(names[names.length - 1]) : raw('—'),
      waiting: names.length > 1 ? raw(names.slice(0, -1).reverse().join(' ← ')) : raw('—'),
      returned: extra && extra.returned !== undefined ? extra.returned : raw('nothing yet')
    };
    return o;
  }

  function lab(program, input) {
    var T = new Tracer();
    function S(o) {
      o.extra = o.extra || {};
      o.extra.program = program;
      o.extra.vars = watch(T, o);
      o.extra.varStates = o.returned !== undefined ? { returned: 'done' } : {};
      return T.snap(o);
    }
    var main;
    S({ kind: 'start', line: 'start', flow: 'call', caption: 'The program’s last line calls <code>main()</code>. Nothing has run yet, so the stack is empty.' });
    S({ kind: 'eval', line: 'start', flow: 'eval', caption: '<code>main()</code> has no arguments, so there is nothing to evaluate. The call goes straight to setting up its frame.' });
    main = T.push('main', '', null);
    S({ kind: 'push', line: 'mainSig', flow: 'push', caption: 'A frame for <code>main</code> is pushed: the first plate on the stack. It has no local variables yet.' });

    if (program === 'area') return labArea(T, S, main, input[0], input[1]);
    if (program === 'total') return labTotal(T, S, main, input);
    return labGrow(T, S, main, input);
  }

  function labArea(T, S, main, w, h) {
    var hl, p = w * h, W = num(w), H = num(h), P = num(p);
    S({ kind: 'call', line: 'mainCall', flow: 'nested', caption: '<code>main</code> reaches <code>area(' + W + ', ' + H + ')</code>. A call means <code>main</code> must pause mid-line until an answer comes back.' });
    S({ kind: 'eval', line: 'mainCall', flow: 'eval', caption: 'First the arguments are evaluated. <code>' + W + '</code> and <code>' + H + '</code> are already values, so the call is <code>area(' + W + ', ' + H + ')</code>.' });
    T.set(main, 's', '…');
    var ar = T.push('area', W + ', ' + H, 'main');
    S({ kind: 'push', line: 'areaSig', flow: 'push', caption: 'A new frame for <code>area</code> goes on top. It records where to resume (<b>↩ to main</b>), and <code>main</code> is paused with <code>s</code> still waiting.' });
    T.set(ar, 'w', w); T.set(ar, 'h', h);
    hl = {}; hl[ar.id + '/w'] = 'swap'; hl[ar.id + '/h'] = 'swap';
    S({ kind: 'bind', line: 'areaSig', flow: 'bind', hl: hl, caption: 'The parameters <code>w</code> and <code>h</code> are new variables in <code>area</code>’s frame, holding copies of ' + W + ' and ' + H + '.' });
    S({ kind: 'call', line: 'areaCall', flow: 'nested', caption: '<code>area</code>’s first line calls another function. <code>area</code> will pause here just as <code>main</code> did.' });
    hl = {}; hl[ar.id + '/w'] = 'compare'; hl[ar.id + '/h'] = 'compare';
    S({ kind: 'eval', line: 'areaCall', flow: 'eval', hl: hl, caption: 'Evaluate the arguments: look up <code>w</code> and <code>h</code> in <code>area</code>’s own frame. They are ' + W + ' and ' + H + '.' });
    T.set(ar, 'r', '…');
    var mu = T.push('multiply', W + ', ' + H, 'area');
    S({ kind: 'push', line: 'mulSig', flow: 'push', caption: 'A third frame, for <code>multiply</code>, goes on top. Two calls are now paused beneath it, each waiting for a value.' });
    T.set(mu, 'a', w); T.set(mu, 'b', h);
    hl = {}; hl[mu.id + '/a'] = 'swap'; hl[mu.id + '/b'] = 'swap';
    S({ kind: 'bind', line: 'mulSig', flow: 'bind', hl: hl, caption: '<code>a</code> and <code>b</code> receive copies. They are different boxes from <code>w</code> and <code>h</code>, even though the numbers match.' });
    T.set(mu, 'p', p);
    hl = {}; hl[mu.id + '/p'] = 'swap';
    S({ kind: 'run', line: 'mulBody', flow: 'run', hl: hl, caption: '<code>multiply</code> computes ' + W + ' × ' + H + ' = ' + P + ' and keeps it in its local <code>p</code>.' });
    mu.ret = p;
    S({ kind: 'ret', line: 'mulRet', flow: 'ret', top: 'done', returned: p, caption: '<code>return p</code> sends back ' + P + '. The frame is finished but still on the stack for one more moment.' });
    T.pop();
    S({ kind: 'pop', line: 'mulRet', flow: 'pop', returned: p, fly: { from: mu, to: ar, name: 'r', value: p },
      caption: '<code>multiply</code>’s frame is popped: <code>a</code>, <code>b</code> and <code>p</code> no longer exist. Only the value ' + P + ' travels back, to the call that is waiting on top.' });
    T.set(ar, 'r', p);
    hl = {}; hl[ar.id + '/r'] = 'swap';
    S({ kind: 'resume', line: 'areaCall', flow: 'resume', hl: hl, caption: '<code>area</code> resumes in the middle of its line. The call <code>multiply(w, h)</code> is replaced by ' + P + ', so <code>r</code> = ' + P + '.' });
    ar.ret = p;
    S({ kind: 'ret', line: 'areaRet', flow: 'ret', top: 'done', returned: p, caption: '<code>return r</code>: <code>area</code> is done and hands ' + P + ' back.' });
    T.pop();
    S({ kind: 'pop', line: 'areaRet', flow: 'pop', returned: p, fly: { from: ar, to: main, name: 's', value: p },
      caption: 'Pop. <code>w</code>, <code>h</code> and <code>r</code> vanish with the frame; the value goes to the only caller left, <code>main</code>.' });
    T.set(main, 's', p);
    S({ kind: 'resume', line: 'mainCall', flow: 'resume', hl: { 'main-1/s': 'swap' }, caption: '<code>main</code> resumes where it paused: <code>s</code> = ' + P + '.' });
    T.out.push(P);
    S({ kind: 'print', line: 'print', flow: 'run', caption: 'Print <code>s</code>: ' + P + '. Three frames were needed at the deepest point; now there is one.' });
    S({ kind: 'end', line: 'print', flow: 'ret', top: 'done', caption: '<code>main</code> has no more lines, so it returns (with no value).' });
    T.pop();
    S({ kind: 'pop', line: 'start', flow: 'pop', caption: 'The last frame pops. An empty stack means the program is over.' });
    return T.steps;
  }

  function labTotal(T, S, main, xs) {
    var hl, A1 = T.newArray(xs), L = listText(xs), sum = 0;
    T.setPtr(main, 'scores', A1.id);
    S({ kind: 'make', line: 'make', flow: 'run', hl: { 'main-1/scores': 'swap' },
      caption: 'The array ' + L + ' is built on the <b>heap</b>. <code>scores</code> does not hold the numbers; it holds a <b>reference</b>, drawn as an arrow.' });
    S({ kind: 'call', line: 'call', flow: 'nested', caption: '<code>main</code> calls <code>total(scores)</code> and pauses.' });
    S({ kind: 'eval', line: 'call', flow: 'eval', hl: { 'main-1/scores': 'compare' },
      caption: 'Evaluate the argument. The value in <code>scores</code> is the reference, so the reference is what will be passed: one small value, however long the array.' });
    T.set(main, 't', '…');
    var f = T.push('total', 'scores', 'main');
    S({ kind: 'push', line: 'sig', flow: 'push', caption: 'A frame for <code>total</code> goes on top, remembering to return to <code>main</code>.' });
    T.setPtr(f, 'xs', A1.id);
    hl = {}; hl[f.id + '/xs'] = 'swap';
    S({ kind: 'bind', line: 'sig', flow: 'bind', hl: hl, caption: '<code>xs</code> receives a copy of the reference. Two arrows now point at <b>one</b> array; nothing was copied except the arrow.' });
    T.set(f, 's', 0);
    hl = {}; hl[f.id + '/s'] = 'swap';
    S({ kind: 'run', line: 'init', flow: 'run', hl: hl, caption: 'A local running total <code>s</code> starts at 0. It lives in <code>total</code>’s frame only.' });
    for (var k = 0; k < xs.length; k++) {
      T.set(f, 'x', xs[k]);
      hl = {}; hl[f.id + '/x'] = 'swap';
      var fl = {}; fl[A1.id + '/' + k] = 'compare';
      S({ kind: 'loop', line: 'loop', flow: 'run', hl: hl, fields: fl, caption: 'Follow the arrow to item ' + k + ' of the array: <code>x</code> = ' + num(xs[k]) + '. Reading through a reference changes nothing.' });
      sum += xs[k];
      T.set(f, 's', sum);
      hl = {}; hl[f.id + '/s'] = 'swap';
      S({ kind: 'add', line: 'add', flow: 'run', hl: hl, fields: fl, caption: '<code>s</code> = ' + num(sum - xs[k]) + ' + ' + num(xs[k]) + ' = ' + num(sum) + '.' });
    }
    S({ kind: 'loopEnd', line: 'loop', flow: 'run', caption: xs.length ? 'No items left, so the loop ends.' : 'The array is empty, so the loop body never runs and <code>s</code> stays 0.' });
    f.ret = sum;
    S({ kind: 'ret', line: 'ret', flow: 'ret', top: 'done', returned: sum, caption: '<code>return s</code> hands back ' + num(sum) + '.' });
    T.pop();
    S({ kind: 'pop', line: 'ret', flow: 'pop', returned: sum, fly: { from: f, to: main, name: 't', value: sum },
      caption: 'The frame pops. <code>xs</code>’s arrow disappears, but the array stays: <code>scores</code> still refers to it.' });
    T.set(main, 't', sum);
    S({ kind: 'resume', line: 'call', flow: 'resume', hl: { 'main-1/t': 'swap' }, caption: '<code>main</code> resumes: <code>t</code> = ' + num(sum) + '.' });
    T.out.push(num(sum));
    S({ kind: 'print', line: 'print', flow: 'run', caption: 'Print ' + num(sum) + '. The array was read, never copied and never changed.' });
    S({ kind: 'end', line: 'print', flow: 'ret', top: 'done', caption: '<code>main</code> returns.' });
    T.pop();
    S({ kind: 'pop', line: 'start', flow: 'pop', caption: 'The last frame pops. With no variable left pointing at it, the array is unreachable (faded): the garbage collector can reclaim it.' });
    return T.steps;
  }

  function labGrow(T, S, main, xs) {
    var hl, fl, v = GROW_V, A1 = T.newArray(xs), L = listText(xs);
    T.setPtr(main, 'scores', A1.id);
    S({ kind: 'make', line: 'make', flow: 'run', hl: { 'main-1/scores': 'swap' }, caption: 'The array ' + L + ' is built on the heap, and <code>scores</code> refers to it.' });
    S({ kind: 'call', line: 'call', flow: 'nested', caption: '<code>main</code> calls <code>grow(scores, ' + v + ')</code> and pauses.' });
    S({ kind: 'eval', line: 'call', flow: 'eval', hl: { 'main-1/scores': 'compare' }, caption: 'The arguments are the reference held in <code>scores</code> and the number ' + v + '.' });
    T.set(main, 'n', '…');
    var f = T.push('grow', 'scores, ' + v, 'main');
    S({ kind: 'push', line: 'sig', flow: 'push', caption: 'A frame for <code>grow</code> goes on top.' });
    T.setPtr(f, 'xs', A1.id); T.set(f, 'v', v);
    hl = {}; hl[f.id + '/xs'] = 'swap'; hl[f.id + '/v'] = 'swap';
    S({ kind: 'bind', line: 'sig', flow: 'bind', hl: hl, caption: '<code>xs</code> gets a copy of the reference (same array as <code>scores</code>); <code>v</code> gets a copy of ' + v + '.' });
    A1.values.push(v);
    fl = {}; fl[A1.id + '/' + (A1.values.length - 1)] = 'swap';
    S({ kind: 'mutate', line: 'push1', flow: 'run', fields: fl, caption: '<b>Mutation.</b> <code>push</code> follows <code>xs</code>’s arrow and changes the array itself. <code>scores</code> points at the same array, so <code>main</code> will see ' + listText(A1.values) + '.' });
    var A2 = T.newArray([v]);
    T.setPtr(f, 'xs', A2.id);
    hl = {}; hl[f.id + '/xs'] = 'swap';
    S({ kind: 'rebind', line: 'rebind', flow: 'run', hl: hl, caption: '<b>Rebinding.</b> <code>xs = [' + v + ']</code> builds a new array and points <code>xs</code> at it. Only the local arrow swings; <code>scores</code> still points at the first array.' });
    A2.values.push(v);
    fl = {}; fl[A2.id + '/1'] = 'swap';
    S({ kind: 'mutate2', line: 'push2', flow: 'run', fields: fl, caption: 'This <code>push</code> follows the <b>new</b> arrow, so it changes the new array. The first array is untouched this time.' });
    f.ret = A2.values.length;
    S({ kind: 'ret', line: 'ret', flow: 'ret', top: 'done', returned: A2.values.length, caption: 'The new array has 2 items, so <code>grow</code> returns 2.' });
    T.pop();
    S({ kind: 'pop', line: 'ret', flow: 'pop', returned: 2, fly: { from: f, to: main, name: 'n', value: 2 },
      caption: 'The frame pops and <code>xs</code> goes with it. Nothing refers to [' + v + ', ' + v + '] any more, so it fades: unreachable garbage.' });
    T.set(main, 'n', 2);
    S({ kind: 'resume', line: 'call', flow: 'resume', hl: { 'main-1/n': 'swap' }, caption: '<code>main</code> resumes: <code>n</code> = 2.' });
    T.out.push(listText(A1.values) + ' 2');
    S({ kind: 'print', line: 'print', flow: 'run', caption: 'Prints <code>' + listText(A1.values) + ' 2</code>. The first <code>push</code> reached <code>main</code>’s array; the rebinding and the second <code>push</code> did not.' });
    S({ kind: 'end', line: 'print', flow: 'ret', top: 'done', caption: '<code>main</code> returns.' });
    T.pop();
    S({ kind: 'pop', line: 'start', flow: 'pop', caption: 'The last frame pops, so no variable refers to either array. Both are garbage now.' });
    return T.steps;
  }

  return {
    PROGRAMS: PROGRAMS,
    GROW_V: GROW_V,
    JUMP_LINES: JUMP_LINES,
    NESTED_CODE: NESTED_CODE,
    NESTED_LINES: NESTED_LINES,
    VVR_CODE: VVR_CODE,
    PASS_CODE: PASS_CODE,
    OVERFLOW_CODE: OVERFLOW_CODE,
    teaser: teaser,
    jumps: jumps,
    notes: notes,
    argFlight: argFlight,
    nested: nested,
    valueVsRef: valueVsRef,
    passing: passing,
    overflow: overflow,
    lab: lab,
    variant: variant,
    VARIANT_CODE: VARIANT_CODE,
    VARIANT_TITLES: VARIANT_TITLES,
    labCode: labCode,
    parseLabInput: parseLabInput,
    area: area,
    total: total,
    grow: grow,
    listText: listText,
    num: num,
    Tracer: Tracer
  };
}));
