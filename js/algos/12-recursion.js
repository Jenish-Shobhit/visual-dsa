/* Lesson 12 · Recursion — pure step generators (no DOM).
   Browser: VDSA.algos.recursion.   Node: module.exports (tests/algos/12-recursion.test.js).

   Generators
   - lab(kind, input)            factorial | total | power | reverse | fib: recursion tree + call stack from one trace
   - parseLabInput(kind, text)   friendly validation for the lab's input row  -> {value, error}
   - hanoi(n)                    Tower of Hanoi, every call and every move
   - hanoiMoves(n)               the plain move list (reference)
   - fibTree(n, memo)            naive or memoised fib call tree in call order (for the "explosion" figure)
   - fibCalls(n), fibMemoCalls(n), fib(n)
   - folders(tree)               "count the files under a folder" (the problem figure)
   - rows(k)                     "which row am I in?" (the cinema analogy)
   - unfold(n)                   fact(n) rewritten by substitution, token by token
   - countdown(start, withBase, capacity)   a missing base case overflows the stack
   - compare(n)                  recursive vs tail call (reused frame) vs loop, for factorial
   - palindrome(str)             isPal(s, lo, hi) on an array view
   - binarySearch(arr, target)   recursive binary search (preview of lesson 13)
   - dolls(n)                    nested frames for the hero teaser
   - fractal(depth, angleDeg, ratio)  segments of a recursive tree drawing
   Every step is a complete snapshot; nothing is mutated after it is pushed. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.VDSA = root.VDSA || {};
    root.VDSA.algos = root.VDSA.algos || {};
    root.VDSA.algos.recursion = api;
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function quote(s) { return '"' + s + '"'; }
  function num(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }
  function listText(a) { return '[' + a.map(num).join(', ') + ']'; }
  function listCompact(a) { return '[' + a.map(num).join(',') + ']'; }
  function copyLocals(l) { return l.map(function (p) { return [p[0], p[1]]; }); }

  /* ================================================================== reference implementations */
  function fib(n) { var a = 0, b = 1; for (var i = 0; i < n; i++) { var t = a + b; a = b; b = t; } return a; }
  function fibCalls(n) { return 2 * fib(n + 1) - 1; }               // calls made by naive fib(n)
  function fibMemoCalls(n) { return n <= 1 ? 1 : 2 * n - 1; }       // calls made by memoised fib(n), cache hits included
  function factorial(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
  function powInt(x, n) { var r = 1; for (var i = 0; i < n; i++) r *= x; return r; }
  function hanoiMoves(n) {
    var out = [];
    (function go(k, from, to, via) { if (k === 0) return; go(k - 1, from, via, to); out.push({ disc: k, from: from, to: to }); go(k - 1, via, to, from); }(n, 0, 2, 1));
    return out;
  }

  /* ================================================================== the lab: one tracer, five functions */
  var KINDS = {
    factorial: { fn: 'fact', title: 'Factorial', max: 10 },
    total: { fn: 'total', title: 'Sum of a list', max: 7 },
    power: { fn: 'power', title: 'Power by halving' },
    reverse: { fn: 'reverse', title: 'Reverse a string', max: 8 },
    fib: { fn: 'fib', title: 'Fibonacci', max: 6 }
  };

  function display(v) { return typeof v === 'string' ? quote(v) : v; }
  var KEY = { factorial: 'n', total: 'a', power: 'n', reverse: 's', fib: 'n' };

  function makeTracer(kind) {
    var nodes = [], byId = {}, stack = [], steps = [];
    var calls = 0, deepest = 0, repeats = 0, seen = {};
    var main = { locals: [['result', '?']] };
    function call(label, argText, locals, key) {
      var id = 'c' + nodes.length;
      var parent = stack.length ? stack[stack.length - 1] : null;
      var node = { id: id, label: label, args: argText, locals: locals, parent: parent, children: [], done: false, ret: undefined, depth: stack.length + 1 };
      nodes.push(node); byId[id] = node;
      if (parent) byId[parent].children.push(id);
      stack.push(id);
      calls++;
      if (key !== undefined) { if (seen[key]) repeats++; seen[key] = true; }
      deepest = Math.max(deepest, stack.length);
      return node;
    }
    function snap(o) {
      var top = stack.length ? stack[stack.length - 1] : null;
      var treeNodes = nodes.map(function (n) {
        return {
          id: n.id, label: n.label, children: n.children.slice(),
          state: n.done ? 'done' : (n.id === top ? 'active' : 'frontier'),
          returnValue: n.done ? display(n.ret) : undefined
        };
      });
      var frames = [{ id: 'main', fn: 'main', args: '', locals: copyLocals(main.locals) }].concat(stack.map(function (id) {
        var n = byId[id];
        var f = { id: id, fn: KINDS[kind].fn, args: n.args, locals: copyLocals(n.locals) };
        if (n.done) { f.state = 'done'; f.returnValue = display(n.ret); }
        return f;
      }));
      var counters = { calls: calls, depth: stack.length, deepest: deepest };
      if (kind === 'fib') counters.repeats = repeats;
      var cur = top ? byId[top] : null;
      var vars = {};
      if (cur) cur.locals.forEach(function (p) { vars[p[0]] = p[1]; });
      else vars.result = main.locals[0][1] === '?' ? { __vdsaRaw: true, text: '?', type: 'undef' } : main.locals[0][1];   /* not yet known: show ? bare, not as the string "?" */
      vars.depth = stack.length;
      steps.push({
        kind: o.kind, callId: top, line: o.line, flow: o.flow, caption: o.caption,
        root: nodes.length ? 'c0' : null, nodes: treeNodes, frames: frames,
        vars: vars, counters: counters, depth: stack.length, quiz: o.quiz || null
      });
    }
    return {
      call: call, snap: snap, stack: stack, byId: byId, nodes: nodes, steps: steps, main: main,
      top: function () { return byId[stack[stack.length - 1]]; },
      finish: function (n, v) { n.done = true; n.ret = v; },
      pop: function () { stack.pop(); },
      stats: function () { return { calls: calls, deepest: deepest, repeats: repeats }; }
    };
  }

  /* Distinct options with the right answer first; the caller shuffles or keeps the order. */
  function choices(right, wrongs) {
    var out = [right];
    wrongs.forEach(function (w) { if (out.map(String).indexOf(String(w)) === -1) out.push(w); });
    return out;
  }

  function lab(kind, input) {
    if (!KINDS[kind]) throw new Error('Unknown lab function: ' + kind);
    var T = makeTracer(kind);
    var fnName = KINDS[kind].fn;
    var result;

    function enter(label, args, locals, isRoot, key) {
      var node = T.call(label, args, locals, key);
      var parent = node.parent ? T.byId[node.parent] : null;
      T.snap({
        kind: 'enter', line: 'sig', flow: 'call',
        caption: isRoot
          ? 'Call <b>' + esc(label) + '</b>. The machine pushes a new frame that holds this call’s own ' + describeLocals(locals) + '.'
          : '<b>' + esc(label) + '</b> starts in a fresh frame on top of the stack. The paused <b>' + esc(parent.label) + '</b> keeps its own ' + describeLocals(parent.locals.filter(function (p) { return p[0] === KEY[kind]; })) + ' underneath.'
      });
      return node;
    }
    function describeLocals(locals) {
      return locals.map(function (p) { return '<code>' + esc(p[0]) + ' = ' + esc(display(p[1])) + '</code>'; }).join(' and ');
    }
    function baseTest(node, isBase, why) {
      T.snap({ kind: 'test', line: 'base', flow: 'test', caption: why });
      return isBase;
    }
    function baseReturn(node, value, why) {
      T.finish(node, value);
      T.snap({ kind: 'base', line: 'baseRet', flow: 'base', caption: why });
    }
    function shrink(node, line, childLabel, why) {
      T.snap({ kind: 'shrink', line: line, flow: 'shrink', caption: why || ('<b>' + esc(node.label) + '</b> pauses on this line and calls <b>' + esc(childLabel) + '</b>: the same problem, one step closer to the base case.') });
    }
    /* child returned: pop it, store the value in the parent's local, parent resumes */
    function resume(node, child, localName, line, extra) {
      T.pop();
      setLocal(node, localName, child.ret);
      T.snap({
        kind: 'resume', line: line, flow: extra && extra.flow ? extra.flow : 'combine',
        caption: (extra && extra.caption) || ('<b>' + esc(child.label) + '</b> returned <b>' + esc(display(child.ret)) + '</b>. Its frame is gone, and <b>' + esc(node.label) + '</b> picks up exactly where it paused, with <code>' + esc(localName) + ' = ' + esc(display(child.ret)) + '</code>.')
      });
    }
    function setLocal(node, name, value) {
      for (var i = 0; i < node.locals.length; i++) if (node.locals[i][0] === name) { node.locals[i] = [name, value]; return; }
      node.locals.push([name, value]);
    }
    function combine(node, value, line, why, quiz) {
      T.finish(node, value);
      T.snap({ kind: 'return', line: line, flow: 'ret', caption: why, quiz: quiz });
    }

    /* ---------------------------------------------------------- factorial */
    function fact(n, isRoot) {
      var node = enter('fact(' + n + ')', 'n=' + n, [['n', n]], isRoot);
      if (baseTest(node, n === 0, n === 0
        ? 'Is <code>n</code> 0? <b>Yes</b>: this is the <b>base case</b>, the one input the function answers without calling itself.'
        : 'Is <code>n</code> 0? No, <code>n</code> is ' + n + ', so this is not the base case: fact(' + n + ') cannot answer on its own yet.')) {
        baseReturn(node, 1, 'fact(0) returns <b>1</b> straight away (the empty product). It started last, and it is the first call to finish.');
        return node;
      }
      shrink(node, 'recurse', 'fact(' + (n - 1) + ')');
      var child = fact(n - 1, false);
      resume(node, child, 'sub', 'recurse');
      var v = n * child.ret;
      combine(node, v, 'combine', '<b>' + node.label + '</b> returns <b>' + n + ' × ' + child.ret + ' = ' + v + '</b> to the call waiting below it.', {
        label: node.label, value: v,
        question: '<code>' + node.label + '</code> has <code>n = ' + n + '</code> and <code>sub = ' + child.ret + '</code>. What does it return?',
        options: choices(v, [child.ret, n, n + child.ret]),
        explain: 'It returns n × sub = ' + n + ' × ' + child.ret + ' = ' + v + '. The smaller call already did the rest of the work.'
      });
      return node;
    }

    /* ---------------------------------------------------------- sum of a list (slicing version) */
    function total(a, isRoot) {
      var label = 'total(' + listCompact(a) + ')';
      var node = enter(label, 'a=' + listText(a), [['a', a.slice()]], isRoot);
      if (baseTest(node, a.length === 0, a.length === 0
        ? 'Is the list empty? <b>Yes</b>: the <b>base case</b>. There is nothing left to add.'
        : 'Is the list empty? No, it has ' + a.length + ' item' + (a.length === 1 ? '' : 's') + ', so ' + esc(label) + ' must first get the total of the rest.')) {
        baseReturn(node, 0, 'The sum of an empty list is <b>0</b>, so the base case returns 0 without another call.');
        return node;
      }
      var rest = a.slice(1);
      shrink(node, 'recurse', 'total(' + listCompact(rest) + ')', '<b>' + esc(label) + '</b> keeps <code>a[0] = ' + num(a[0]) + '</code> for later and calls <b>total(' + listCompact(rest) + ')</b> on the list without its first item.');
      var child = total(rest, false);
      resume(node, child, 'rest', 'recurse');
      var v = a[0] + child.ret;
      combine(node, v, 'combine', '<b>' + esc(label) + '</b> returns <b>' + num(a[0]) + ' + ' + num(child.ret) + ' = ' + num(v) + '</b>.', {
        label: label, value: v,
        question: '<code>' + esc(label) + '</code> got <code>rest = ' + num(child.ret) + '</code>. What does it return?',
        options: choices(num(v), [num(child.ret), num(a[0]), num(a[0] * child.ret)]),
        explain: 'It returns a[0] + rest = ' + num(a[0]) + ' + ' + num(child.ret) + ' = ' + num(v) + '.'
      });
      return node;
    }

    /* ---------------------------------------------------------- power by halving */
    function power(x, n, isRoot) {
      var label = 'power(' + num(x) + ',' + n + ')';
      var node = enter(label, 'x=' + num(x) + ', n=' + n, [['x', x], ['n', n]], isRoot);
      if (baseTest(node, n === 0, n === 0
        ? 'Is <code>n</code> 0? <b>Yes</b>: the <b>base case</b>. Any number to the power 0 is 1.'
        : 'Is <code>n</code> 0? No. Instead of multiplying ' + num(x) + ' by itself ' + n + ' times, compute the half power once and square it.')) {
        baseReturn(node, 1, '<b>' + label + '</b> returns <b>1</b> without another call.');
        return node;
      }
      var h = Math.floor(n / 2);
      shrink(node, 'recurse', 'power(' + num(x) + ',' + h + ')', '<b>' + label + '</b> calls <b>power(' + num(x) + ',' + h + ')</b>: ⌊' + n + ' / 2⌋ = ' + h + '. Halving shrinks n much faster than subtracting 1.');
      var child = power(x, h, false);
      resume(node, child, 'half', 'recurse');
      var even = n % 2 === 0;
      var v = even ? child.ret * child.ret : child.ret * child.ret * x;
      combine(node, v, even ? 'even' : 'odd', even
        ? n + ' is even, so <b>' + label + '</b> returns half × half = <b>' + num(child.ret) + ' × ' + num(child.ret) + ' = ' + num(v) + '</b>.'
        : n + ' is odd: half × half covers only ' + (n - 1) + ' factors, so multiply by one more x. It returns <b>' + num(child.ret) + ' × ' + num(child.ret) + ' × ' + num(x) + ' = ' + num(v) + '</b>.', {
        label: label, value: v,
        question: '<code>' + label + '</code> got <code>half = ' + num(child.ret) + '</code>. What does it return?',
        options: choices(num(v), [num(child.ret * 2), num(even ? child.ret * child.ret * x : child.ret * child.ret), num(child.ret)]),
        explain: n + ' is ' + (even ? 'even, so the answer is half × half' : 'odd, so the answer is half × half × x') + ' = ' + num(v) + '.'
      });
      return node;
    }

    /* ---------------------------------------------------------- reverse a string */
    function reverse(s, isRoot) {
      var label = 'reverse(' + quote(s) + ')';
      var node = enter(label, 's=' + quote(s), [['s', s]], isRoot);
      if (baseTest(node, s.length <= 1, s.length <= 1
        ? 'Is the string at most one character long? <b>Yes</b>: the <b>base case</b>. ' + (s.length ? 'One character reads the same both ways.' : 'The empty string is its own reverse.')
        : 'Is the string at most one character long? No, it has ' + s.length + ', so ' + esc(label) + ' reverses the rest first.')) {
        baseReturn(node, s, '<b>' + esc(label) + '</b> returns <b>' + esc(quote(s)) + '</b> unchanged.');
        return node;
      }
      var rest = s.slice(1);
      shrink(node, 'recurse', 'reverse(' + quote(rest) + ')', '<b>' + esc(label) + '</b> sets aside its first character <code>' + esc(quote(s[0])) + '</code> and calls <b>' + esc('reverse(' + quote(rest) + ')') + '</b>.');
      var child = reverse(rest, false);
      resume(node, child, 'rest', 'recurse');
      var v = child.ret + s[0];
      combine(node, v, 'combine', 'The first character goes to the <em>end</em>: <b>' + esc(label) + '</b> returns <b>' + esc(quote(child.ret)) + ' + ' + esc(quote(s[0])) + ' = ' + esc(quote(v)) + '</b>.', {
        label: label, value: v,
        question: '<code>' + esc(label) + '</code> got <code>rest = ' + esc(quote(child.ret)) + '</code>. What does it return?',
        options: choices(esc(quote(v)), [esc(quote(s[0] + child.ret)), esc(quote(child.ret)), esc(quote(s))]),
        explain: 'It returns rest + s[0]: the reversed tail, then the first character at the end, giving ' + esc(quote(v)) + '.'
      });
      return node;
    }

    /* ---------------------------------------------------------- fibonacci (two recursive calls) */
    function fibRec(n, isRoot) {
      var label = 'fib(' + n + ')';
      var node = enter(label, 'n=' + n, [['n', n]], isRoot, n);
      if (baseTest(node, n < 2, n < 2
        ? 'Is <code>n</code> below 2? <b>Yes</b>: a <b>base case</b>. fib(0) = 0 and fib(1) = 1 are known directly.'
        : 'Is <code>n</code> below 2? No, so fib(' + n + ') needs two smaller answers: fib(' + (n - 1) + ') and fib(' + (n - 2) + ').')) {
        baseReturn(node, n, '<b>' + label + '</b> returns <b>' + n + '</b>.');
        return node;
      }
      shrink(node, 'left', 'fib(' + (n - 1) + ')', '<b>' + label + '</b> makes its first call, <b>fib(' + (n - 1) + ')</b>, and waits for it.');
      var a = fibRec(n - 1, false);
      T.pop();
      setLocal(node, 'a', a.ret);
      T.snap({ kind: 'resume', line: 'right', flow: 'shrink', caption: 'fib(' + (n - 1) + ') returned <b>' + a.ret + '</b>, so <code>a = ' + a.ret + '</code>. Now <b>' + label + '</b> makes its second call, <b>fib(' + (n - 2) + ')</b>' + (n - 2 >= 2 ? ', and recomputes work it has already seen.' : '.') });
      var b = fibRec(n - 2, false);
      resume(node, b, 'b', 'right');
      var v = a.ret + b.ret;
      combine(node, v, 'combine', '<b>' + label + '</b> returns <b>' + a.ret + ' + ' + b.ret + ' = ' + v + '</b>.', {
        label: label, value: v,
        question: '<code>' + label + '</code> has <code>a = ' + a.ret + '</code> and <code>b = ' + b.ret + '</code>. What does it return?',
        options: choices(v, [a.ret, b.ret, a.ret * b.ret, n]),
        explain: 'It returns a + b = ' + a.ret + ' + ' + b.ret + ' = ' + v + '.'
      });
      return node;
    }

    var intro, rootNode;
    if (kind === 'factorial') { intro = 'main is about to call fact(' + input + ').'; }
    else if (kind === 'total') { intro = 'main is about to call total(' + listCompact(input) + ').'; }
    else if (kind === 'power') { intro = 'main is about to call power(' + num(input.x) + ', ' + input.n + ').'; }
    else if (kind === 'reverse') { intro = 'main is about to call reverse(' + esc(quote(input)) + ').'; }
    else { intro = 'main is about to call fib(' + input + ').'; }
    T.snap({ kind: 'start', line: null, flow: null, caption: 'Only <b>main</b> is on the stack. ' + intro + ' Every call you are about to see is a separate frame.' });
    if (kind === 'factorial') rootNode = fact(input, true);
    else if (kind === 'total') rootNode = total(input, true);
    else if (kind === 'power') rootNode = power(input.x, input.n, true);
    else if (kind === 'reverse') rootNode = reverse(input, true);
    else rootNode = fibRec(input, true);
    result = rootNode.ret;
    T.pop();
    T.main.locals = [['result', display(result)]];
    var st = T.stats();
    T.snap({
      kind: 'done', line: null, flow: null,
      caption: 'The stack has unwound back to main: <b>' + esc(rootNode.label) + ' = ' + esc(display(result)) + '</b>. ' +
        st.calls + ' call' + (st.calls === 1 ? '' : 's') + ' in total, but never more than ' + st.deepest + ' waiting at once.' +
        (kind === 'fib' && st.repeats ? ' ' + st.repeats + ' of those calls repeated an argument that had already been computed.' : '')
    });
    var steps = T.steps;
    steps.result = result;
    steps.calls = st.calls;
    steps.deepest = st.deepest;
    steps.repeats = st.repeats;
    return steps;
  }

  /* Validation for the lab's input row. Returns {value, error}. */
  function parseLabInput(kind, text) {
    var t = String(text === undefined || text === null ? '' : text).trim();
    function int(s) { return /^[−-]?\d+$/.test(s) ? Number(s.replace('−', '-')) : NaN; }
    if (kind === 'factorial' || kind === 'fib') {
      var max = KINDS[kind].max, fn = kind === 'factorial' ? 'fact' : 'fib';
      if (!t) return { value: null, error: 'Enter one whole number, like 4.' };
      var n = int(t);
      if (isNaN(n)) return { value: null, error: '“' + t + '” is not a whole number. Enter one, like 4.' };
      if (n < 0) return { value: null, error: fn + '(' + n + ') would never reach the base case: n only moves further below it. Use 0 to ' + max + '.' };
      if (n > max) return { value: null, error: kind === 'fib'
        ? 'fib(' + n + ') makes ' + fibCalls(n) + ' calls. The lab stops at 6 so every call stays readable; the call-explosion figure below goes further.'
        : 'Use 0 to ' + max + ': fact(' + n + ') needs ' + (n + 1) + ' frames, too tall to read here.' };
      return { value: n, error: null };
    }
    if (kind === 'total') {
      var inner = t.replace(/^\[/, '').replace(/\]$/, '').trim();
      if (!inner) return { value: [], error: null };
      var toks = inner.split(/[\s,;]+/).filter(Boolean);
      if (toks.length > KINDS.total.max) return { value: null, error: 'Use at most ' + KINDS.total.max + ' numbers so the stack stays readable.' };
      var vals = [];
      for (var i = 0; i < toks.length; i++) {
        var v = int(toks[i]);
        if (isNaN(v)) return { value: null, error: '“' + toks[i] + '” is not a whole number.' };
        if (v < -99 || v > 99) return { value: null, error: 'Keep numbers between −99 and 99.' };
        vals.push(v);
      }
      return { value: vals, error: null };
    }
    if (kind === 'power') {
      var parts = t.split(/[\s,;]+/).filter(Boolean);
      if (parts.length !== 2) return { value: null, error: 'Enter two whole numbers: x, then n. For example 2, 10.' };
      var x = int(parts[0]), p = int(parts[1]);
      if (isNaN(x) || isNaN(p)) return { value: null, error: 'Both x and n must be whole numbers, like 2, 10.' };
      if (x < -9 || x > 9) return { value: null, error: 'Keep x between −9 and 9.' };
      if (p < 0) return { value: null, error: 'Use n ≥ 0: with a negative n, halving never reaches the base case n = 0.' };
      if (p > 64) return { value: null, error: 'Keep n at most 64.' };
      if (Math.abs(powInt(x, p)) > Number.MAX_SAFE_INTEGER) return { value: null, error: num(x) + '^' + p + ' is too large to show exactly. Try a smaller n.' };
      return { value: { x: x, n: p }, error: null };
    }
    if (kind === 'reverse') {
      var str = t;
      if (str.length >= 2 && /^["'].*["']$/.test(str)) str = str.slice(1, -1);
      if (str.length > KINDS.reverse.max) return { value: null, error: 'Use at most ' + KINDS.reverse.max + ' characters so every frame stays readable.' };
      return { value: str, error: null };
    }
    return { value: null, error: 'Unknown function.' };
  }

  /* ================================================================== Tower of Hanoi */
  var PEG = ['A', 'B', 'C'];
  function hanoi(n) {
    var pegs = [[], [], []];
    for (var d = n; d >= 1; d--) pegs[0].push(d);
    var calls = [], status = [], stack = [], steps = [], moves = 0, total = Math.pow(2, n) - 1;
    function snap(kind, line, caption, extra) {
      var top = stack.length ? stack[stack.length - 1] : null;
      var s = {
        kind: kind, line: line, caption: caption,
        pegs: pegs.map(function (p) { return p.slice(); }),
        move: (extra && extra.move) || null,
        moves: moves, total: total, n: n,
        active: top, stack: stack.slice(),
        status: status.slice(),
        focus: top !== null ? { disc: calls[top].k, peg: null, call: top } : null,
        counters: { moves: moves, calls: calls.length, depth: stack.length },
        vars: top !== null ? { n: calls[top].k, from: PEG[calls[top].from], to: PEG[calls[top].to], via: PEG[calls[top].via] } : { moves: moves }
      };
      s.calls = calls;
      steps.push(s);
    }
    function mark() {
      stack.forEach(function (id, i) { status[id] = i === stack.length - 1 ? 2 : 1; });
    }
    function move(disc, from, to) {
      var got = pegs[from].pop();
      if (got !== disc) throw new Error('Illegal Hanoi state');
      var under = pegs[to][pegs[to].length - 1];
      if (under !== undefined && under < disc) throw new Error('Larger disc on a smaller one');
      pegs[to].push(disc);
      moves++;
    }
    function rec(k, from, to, via, parent) {
      var id = calls.length;
      calls.push({ id: id, k: k, from: from, to: to, via: via, parent: parent, children: [], moveStart: moves, depth: stack.length });
      status.push(0);
      if (parent !== null) calls[parent].children.push(id);
      stack.push(id); mark();
      var name = 'hanoi(' + k + ', ' + PEG[from] + '→' + PEG[to] + ')';
      if (k === 1) {
        snap('enter', 'base', '<b>' + name + '</b>: one disc. That is the <b>base case</b>: no smaller tower to get out of the way.');
        move(1, from, to);
        status[id] = 3;
        snap('move', 'baseMove', 'Move disc 1 from ' + PEG[from] + ' to ' + PEG[to] + '. <b>' + name + '</b> is finished.', { move: { disc: 1, from: from, to: to } });
        stack.pop(); mark();
        return;
      }
      snap('enter', 'base', '<b>' + name + '</b>: ' + k + ' discs. Disc ' + k + ' must reach ' + PEG[to] + ', but ' + (k === 2 ? 'disc 1 sits' : 'discs 1–' + (k - 1) + ' sit') + ' on top of it. Not the base case.');
      snap('first', 'first', 'Step 1 of 3: park the ' + (k - 1) + ' smaller disc' + (k - 1 === 1 ? '' : 's') + ' on the spare peg ' + PEG[via] + ' by calling <b>hanoi(' + (k - 1) + ', ' + PEG[from] + '→' + PEG[via] + ')</b>. Trust it to work.');
      rec(k - 1, from, via, to, id);
      move(k, from, to);
      snap('middle', 'middle', 'Step 2 of 3: ' + PEG[from] + ' now holds only disc ' + k + ' and ' + PEG[to] + ' is empty of smaller discs, so move <b>disc ' + k + '</b> from ' + PEG[from] + ' to ' + PEG[to] + '. This is the one move <b>' + name + '</b> makes itself.', { move: { disc: k, from: from, to: to } });
      snap('second', 'second', 'Step 3 of 3: stack the parked ' + (k - 1) + ' disc' + (k - 1 === 1 ? '' : 's') + ' on top of disc ' + k + ' with <b>hanoi(' + (k - 1) + ', ' + PEG[via] + '→' + PEG[to] + ')</b>.');
      rec(k - 1, via, to, from, id);
      status[id] = 3;
      snap('return', 'second', '<b>' + name + '</b> is done: all ' + k + ' discs sit on ' + PEG[to] + '. It used ' + (Math.pow(2, k) - 1) + ' moves: two towers of ' + (k - 1) + ' (' + (Math.pow(2, k - 1) - 1) + ' each) plus one.');
      stack.pop(); mark();
    }
    snap('start', null, n + ' disc' + (n === 1 ? '' : 's') + ' on peg A. Goal: move the whole tower to C, one disc at a time, never putting a larger disc on a smaller one.');
    rec(n, 0, 2, 1, null);
    snap('done', null, 'Solved in <b>' + moves + ' moves</b> = 2<sup>' + n + '</sup> − 1. No solution can use fewer: disc ' + n + ' moves once, and before it can, the other ' + (n - 1) + (n === 2 ? ' disc' : ' discs') + ' must be moved out of the way and back.');
    steps.calls = calls;
    steps.total = total;
    return steps;
  }

  /* ================================================================== fib call trees (explosion figure) */
  /* Nodes in call (preorder) order: {id: path, n, parent, depth, hit}. Ids are paths ('r', 'rL', 'rLR', ...),
     so the memoised tree is a subset of the naive tree with the same ids. */
  function fibTree(n, memo) {
    var out = [], cache = {};
    (function go(k, id, parent, depth) {
      var node = { id: id, n: k, parent: parent, depth: depth, hit: false, order: out.length };
      out.push(node);
      if (memo && cache[k] !== undefined) { node.hit = true; node.value = cache[k]; return cache[k]; }
      var v = k < 2 ? k : go(k - 1, id + 'L', id, depth + 1) + go(k - 2, id + 'R', id, depth + 1);
      node.value = v;
      if (memo) cache[k] = v;
      return v;
    }(n, 'r', null, 0));
    return out;
  }

  /* ================================================================== problem: counting files in folders */
  var FOLDERS = { name: 'home', files: 2, children: [
    { name: 'photos', files: 3, children: [{ name: '2023', files: 4, children: [] }, { name: '2024', files: 5, children: [] }] },
    { name: 'music', files: 1, children: [] },
    { name: 'notes', files: 2, children: [{ name: 'drafts', files: 3, children: [] }] }
  ] };
  function folders(tree) {
    tree = tree || FOLDERS;
    var rows = [], steps = [];
    (function flat(f, depth, parent) {
      var id = 'f' + rows.length;
      var row = { id: id, name: f.name, files: f.files, depth: depth, parent: parent, kids: [] };
      rows.push(row);
      if (parent) rows.filter(function (r) { return r.id === parent; })[0].kids.push(id);
      f.children.forEach(function (c) { flat(c, depth + 1, id); });
    }(tree, 0, null));
    var byId = {}; rows.forEach(function (r) { byId[r.id] = r; });
    var state = {}, totals = {}, tally = {}, stack = [];
    rows.forEach(function (r) { state[r.id] = 'default'; tally[r.id] = []; });
    function snap(caption, flyFrom) {
      steps.push({
        rows: rows,
        states: Object.assign({}, state),
        totals: Object.assign({}, totals),
        tally: Object.keys(tally).reduce(function (o, k) { o[k] = tally[k].slice(); return o; }, {}),
        active: stack[stack.length - 1] || null,
        fly: flyFrom || null,
        depth: stack.length,
        caption: caption
      });
    }
    snap('Every folder follows one rule: <em>my total = my own files + the total of each subfolder</em>. Which folder can report first?');
    var callsMade = 0;
    function count(id) {
      var r = byId[id];
      callsMade++;
      stack.forEach(function (s) { state[s] = 'frontier'; });
      stack.push(id); state[id] = 'active';
      tally[id] = [r.files];
      function report(total) {            // the answer reaches the caller in the same step it is returned
        totals[id] = total; state[id] = 'done';
        if (r.parent) tally[r.parent].push(total);
      }
      if (!r.kids.length) {
        report(r.files);
        snap('<b>' + r.name + '/</b> has no subfolders. That is the <b>base case</b>: its total is its own ' + r.files + ' file' + (r.files === 1 ? '' : 's') + (r.parent ? ', and that answer goes back to <b>' + byId[r.parent].name + '/</b>.' : '.'));
      } else {
        snap('<b>' + r.name + '/</b> holds ' + r.files + ' file' + (r.files === 1 ? '' : 's') + ' of its own and ' + r.kids.length + ' subfolder' + (r.kids.length === 1 ? '' : 's') + '. It cannot finish until each subfolder reports, so it asks them one at a time.');
        r.kids.forEach(function (k) {
          count(k);
          state[id] = 'active';
          stack.forEach(function (s) { if (s !== id) state[s] = 'frontier'; });
        });
        var parts = tally[id].slice();
        var sum = parts.reduce(function (a, b) { return a + b; }, 0);
        report(sum);
        snap('Every subfolder of <b>' + r.name + '/</b> has answered, so it reports <b>' + parts.join(' + ') + ' = ' + sum + '</b>' + (r.parent ? ' to <b>' + byId[r.parent].name + '/</b>.' : '.'));
      }
      stack.pop();
      if (stack.length) state[stack[stack.length - 1]] = 'active';
      return totals[id];
    }
    var all = count(rows[0].id);
    steps[steps.length - 1].caption += ' The same small rule ran ' + callsMade + ' times, once per folder, and never needed to know how deep the folders go.';
    steps.total = all;
    return steps;
  }

  /* ================================================================== intuition: "which row am I in?" */
  function rows(k) {
    var steps = [];
    var known = {}, asking = null, waiting = [];
    function snap(caption, extra) {
      steps.push({ k: k, known: Object.assign({}, known), asking: asking, waiting: waiting.slice(), passing: (extra && extra.passing) || null, caption: caption, phase: (extra && extra.phase) || 'ask' });
    }
    snap('You sit in the dark in row ' + k + ' of a cinema and want your row number. You cannot see the rows to count them.');
    for (var r = k; r > 1; r--) {
      waiting.push(r); asking = r;
      snap((r === k ? 'You' : 'The person in row ' + r) + ' can’t see either, so ' + (r === k ? 'you ask' : 'they ask') + ' the person in front: “Which row are you in?” Then ' + (r === k ? 'you wait' : 'they wait') + '.', { phase: 'ask' });
    }
    asking = null;
    known[1] = 1;
    snap('The person in row 1 has only the screen in front. No one to ask: they just know “row 1”. That is the <b>base case</b>.', { phase: 'base' });
    for (var s = 2; s <= k; s++) {
      waiting.pop();
      known[s] = s;
      snap((s === k ? 'The answer reaches you: ' + (s - 1) + ' + 1 = <b>' + s + '</b>. You know your row, and nobody had to count the whole room.' : 'Row ' + (s - 1) + ' answers “' + (s - 1) + '”. Row ' + s + ' adds one: “I’m in row ' + s + '”, and passes that back.'), { phase: 'answer', passing: { from: s - 1, to: s, value: s - 1 } });
    }
    return steps;
  }

  /* ================================================================== substitution: fact(n) unfolded */
  function unfold(n) {
    var steps = [], tokens = [{ id: 'f' + n, text: 'fact(' + n + ')', kind: 'call' }];
    function clone() { return tokens.map(function (t) { return Object.assign({}, t); }); }
    function snap(caption, extra) { steps.push({ tokens: clone(), caption: caption, pending: tokens.filter(function (t) { return t.kind === 'op'; }).length, merge: (extra && extra.merge) || null }); }
    snap('Start with the call <b>fact(' + n + ')</b>. The definition says how to rewrite it.');
    for (var k = n; k >= 1; k--) {
      var at = tokens.findIndex(function (t) { return t.id === 'f' + k; });
      tokens.splice(at, 1,
        { id: 'n' + k, text: String(k), kind: 'num', from: 'f' + k },
        { id: 'x' + k, text: '×', kind: 'op', from: 'f' + k },
        { id: 'f' + (k - 1), text: 'fact(' + (k - 1) + ')', kind: 'call', from: 'f' + k });
      snap('Recursive case: replace <b>fact(' + k + ')</b> with <b>' + k + ' × fact(' + (k - 1) + ')</b>. The multiplication has to wait: its right side is not known yet.');
    }
    var z = tokens.findIndex(function (t) { return t.id === 'f0'; });
    tokens.splice(z, 1, { id: 'b', text: '1', kind: 'num', state: 'done', from: 'f0' });
    snap('Base case: <b>fact(0) = 1</b>. No call is left in the expression; ' + n + ' multiplication' + (n === 1 ? ' is' : 's are') + ' still pending, one per waiting frame.');
    var right = 'b', rightVal = 1;
    for (var j = 1; j <= n; j++) {
      var v = j * rightVal;
      var ni = tokens.findIndex(function (t) { return t.id === 'n' + j; });
      var rid = 'r' + j;
      tokens.splice(ni, 3, { id: rid, text: String(v), kind: 'num', state: 'done', mergeOf: ['n' + j, 'x' + j, right] });
      snap('Unwind: <b>' + j + ' × ' + rightVal + ' = ' + v + '</b>. The innermost pending multiplication finishes first, just as the newest frame returns first.', { merge: { into: rid, of: ['n' + j, 'x' + j, right] } });
      right = rid; rightVal = v;
    }
    steps[steps.length - 1].caption = 'Done: <b>fact(' + n + ') = ' + rightVal + '</b>. The expression grew while calls were made and shrank while they returned.';
    return steps;
  }

  /* ================================================================== missing base case: stack overflow */
  function countdown(start, withBase, capacity) {
    var steps = [], stack = [], out = [], id = 0;
    function snap(caption, extra) {
      steps.push({ items: stack.map(function (f) { return Object.assign({}, f); }), output: out.slice(), capacity: capacity, overflow: !!(extra && extra.overflow), caption: caption, line: extra && extra.line });
    }
    snap('Call <b>countdown(' + start + ')</b>. Each call prints its number and calls itself with one less.');
    var n = start, crashed = false;
    for (;;) {
      stack.forEach(function (f) { f.state = 'default'; });
      stack.push({ id: 'cd' + (id++), value: 'countdown(' + num(n) + ')', n: n, state: 'active' });
      if (stack.length > capacity) {
        stack[stack.length - 1].state = 'error';
        snap('Frame ' + stack.length + ' does not fit. The stack is full: <b>RangeError: Maximum call stack size exceeded</b> (Python says <b>RecursionError</b>). The program crashes and none of the waiting calls ever finish.', { overflow: true, line: 'call' });
        crashed = true;
        break;
      }
      if (withBase && n === 0) {
        out.push('liftoff');
        snap('<b>countdown(0)</b> hits the base case: it prints “liftoff” and returns without calling itself.', { line: 'base' });
        break;
      }
      out.push(num(n));
      snap('<b>countdown(' + num(n) + ')</b> prints ' + num(n) + ' and calls countdown(' + num(n - 1) + ')' + (withBase ? '.' : (n <= 0 ? '. Nothing stops it below zero: there is no base case.' : '.')), { line: 'call' });
      n--;
    }
    if (!crashed) {
      while (stack.length) {
        var f = stack[stack.length - 1];
        f.state = 'done';
        snap('<b>' + f.value + '</b> has nothing left to do, so it returns and its frame is popped.' + (stack.length === 1 ? ' The stack is empty: the program finished normally.' : ''), { line: 'ret' });
        stack.pop();
        if (!stack.length) break;
      }
      snap('All ' + (start + 1) + (start === 0 ? ' frame' : ' frames') + ' came off the stack. The base case is what made that possible.');
    }
    return steps;
  }

  /* ================================================================== recursion vs tail call vs loop */
  function compare(n) {
    var A = [], B = [], C = [];
    // A: plain recursion — frames pile up with pending work
    var fr = [];
    for (var k = n; k >= 0; k--) {
      fr.forEach(function (f) { f.state = 'frontier'; });
      fr.push({ id: 'a' + k, label: 'fact(' + k + ')', note: k === 0 ? 'base case' : k + ' × ?', state: 'active' });
      A.push({ frames: fr.map(function (f) { return Object.assign({}, f); }), note: 'call' });
    }
    var val = 1;
    fr[fr.length - 1].note = '= 1'; fr[fr.length - 1].state = 'done';
    A.push({ frames: fr.map(function (f) { return Object.assign({}, f); }), note: 'return' });
    for (var j = 1; j <= n; j++) {
      fr.pop();
      val *= j;
      var top = fr[fr.length - 1];
      top.note = j + ' × ' + (val / j) + ' = ' + val; top.state = 'done';
      A.push({ frames: fr.map(function (f) { return Object.assign({}, f); }), note: 'return' });
    }
    fr.pop();
    A.push({ frames: [], note: 'finished', result: val });
    // B: tail call with frame reuse — one frame whose arguments change
    var acc = 1;
    for (var m = n; m >= 0; m--) {
      B.push({ frames: [{ id: 'b', label: 'factT(' + m + ', ' + acc + ')', note: m === 0 ? 'return ' + acc : '→ factT(' + (m - 1) + ', ' + (m * acc) + ')', state: m === 0 ? 'done' : 'active' }], note: 'call' });
      if (m > 0) acc *= m;
    }
    B.push({ frames: [], note: 'finished', result: acc });
    // C: loop — one frame, variables change
    var a2 = 1;
    C.push({ frames: [{ id: 'c', label: 'factLoop(' + n + ')', note: 'acc = 1', state: 'active' }], note: 'call' });
    for (var i = 2; i <= n; i++) {
      a2 *= i;
      C.push({ frames: [{ id: 'c', label: 'factLoop(' + n + ')', note: 'i = ' + i + ', acc = ' + a2, state: 'active' }], note: 'loop' });
    }
    C.push({ frames: [{ id: 'c', label: 'factLoop(' + n + ')', note: 'return ' + a2, state: 'done' }], note: 'return' });
    C.push({ frames: [], note: 'finished', result: a2 });
    var T = Math.max(A.length, B.length, C.length), steps = [];
    function at(L, t) { return L[Math.min(t, L.length - 1)]; }
    function peak(L, t) { var p = 0; for (var q = 0; q <= Math.min(t, L.length - 1); q++) p = Math.max(p, L[q].frames.length); return p; }
    for (var t = 0; t < T; t++) {
      var a = at(A, t), b = at(B, t), c = at(C, t);
      var cap;
      if (t === 0) cap = 'Three ways to compute ' + n + '!. Each starts with one frame. Press play and watch how many frames each one keeps in memory.';
      else if (a.note === 'call') cap = 'Plain recursion pushes a new frame for every call, and each one waits with unfinished work (“' + a.frames[a.frames.length - 1].note + '”).';
      else if (a.note === 'return' && t < A.length - 2) cap = 'Plain recursion unwinds: each frame finishes its pending multiplication and pops. The other two finished long ago with a single frame.';
      else cap = 'All three return ' + val + '. Plain recursion needed ' + (n + 1) + (n === 0 ? ' frame' : ' frames') + ' at its peak; the reused tail call and the loop needed one.';
      steps.push({
        lanes: [a, b, c],
        peaks: [peak(A, t), peak(B, t), peak(C, t)],
        caption: cap,
        counters: { recursion: a.frames.length, tailCall: b.frames.length, loop: c.frames.length }
      });
    }
    steps.result = val;
    return steps;
  }

  /* ================================================================== variations: palindrome and binary search */
  function palindrome(str) {
    var s = String(str), n = s.length, steps = [], stack = [];
    var items = s.split('').map(function (ch, i) { return { id: 'p' + i, value: ch }; });
    function snap(caption, o) {
      o = o || {};
      var regions = stack.map(function (c, depth) {
        return { id: 'call' + depth, from: c.lo, to: c.hi, state: depth === stack.length - 1 ? (o.regionState || 'active') : 'visited', label: depth === stack.length - 1 ? 'call ' + (depth + 1) : undefined };
      }).filter(function (r) { return r.from <= r.to; });
      var its = items.map(function (it, i) {
        var st = 'default';
        if (o.matched && o.matched.indexOf(i) !== -1) st = 'done';
        if (o.compare && o.compare.indexOf(i) !== -1) st = o.cmpState || 'compare';
        return { id: it.id, value: it.value, state: st };
      });
      var top = stack[stack.length - 1];
      steps.push({
        items: its, regions: regions,
        pointers: top && top.lo <= top.hi && n ? [{ name: 'lo', index: top.lo, state: 'compare' }, { name: 'hi', index: top.hi, state: 'compare', side: top.lo === top.hi ? 'above' : 'below' }] : [],
        caption: caption, depth: stack.length, result: o.result === undefined ? null : o.result
      });
    }
    var matched = [], result = true;
    function go(lo, hi) {
      stack.push({ lo: lo, hi: hi });
      var sub = s.slice(lo, hi + 1);
      if (lo >= hi) {
        snap('<b>isPal(' + esc(quote(sub)) + ')</b>: ' + (sub.length ? 'one character' : 'nothing') + ' left. <b>Base case</b>: that is a palindrome, return <b>true</b>.', { matched: matched, regionState: 'done' });
        stack.pop();
        return true;
      }
      snap('<b>isPal(' + esc(quote(sub)) + ')</b>: compare the outer pair, ' + esc(quote(s[lo])) + ' and ' + esc(quote(s[hi])) + '.', { compare: [lo, hi], matched: matched });
      if (s[lo] !== s[hi]) {
        snap(esc(quote(s[lo])) + ' ≠ ' + esc(quote(s[hi])) + ', so <b>isPal(' + esc(quote(sub)) + ')</b> returns <b>false</b> at once. It is also a base case: no smaller call is needed.', { compare: [lo, hi], cmpState: 'error', matched: matched, regionState: 'error' });
        stack.pop();
        return false;
      }
      matched = matched.concat([lo, hi]);
      snap('They match, so the answer is whatever the inside says: call <b>isPal(' + esc(quote(s.slice(lo + 1, hi))) + ')</b>.', { matched: matched });
      var r = go(lo + 1, hi - 1);
      snap('<b>isPal(' + esc(quote(sub)) + ')</b> passes <b>' + r + '</b> back up unchanged.', { matched: matched, regionState: r ? 'done' : 'error', result: r });
      stack.pop();
      return r;
    }
    if (!n) { stack.push({ lo: 0, hi: -1 }); snap('<b>isPal("")</b>: the empty string. <b>Base case</b>: it reads the same both ways, return <b>true</b>.', { result: true }); stack.pop(); steps.result = true; return steps; }
    result = go(0, n - 1);
    steps.push(Object.assign({}, steps[steps.length - 1], { regions: [], pointers: [], caption: esc(quote(s)) + (result ? ' <b>is</b> a palindrome.' : ' is <b>not</b> a palindrome.') + ' Each call peeled off one pair, so the depth is about n / 2.', result: result }));
    steps.result = result;
    return steps;
  }

  function binarySearch(arr, target) {
    var a = arr.slice(), steps = [], stack = [], calls = 0;
    var items = a.map(function (v, i) { return { id: 'b' + i, value: v }; });
    function snap(caption, o) {
      o = o || {};
      var top = stack[stack.length - 1];
      steps.push({
        items: items.map(function (it, i) {
          var st = 'default';
          if (top && (i < top.lo || i > top.hi)) st = 'muted';
          if (o.mid === i) st = o.midState || 'compare';
          return { id: it.id, value: it.value, state: st };
        }),
        regions: stack.filter(function (c) { return c.lo <= c.hi; }).map(function (c, d) { return { id: 'r' + d, from: c.lo, to: c.hi, state: d === stack.length - 1 ? 'active' : 'visited', label: d === stack.length - 1 ? 'call ' + (d + 1) : undefined }; }),
        pointers: o.mid !== undefined ? [{ name: 'mid', index: o.mid, state: o.midState || 'compare' }] : [],
        caption: caption, depth: stack.length, calls: calls, result: o.result === undefined ? null : o.result
      });
    }
    function go(lo, hi) {
      stack.push({ lo: lo, hi: hi }); calls++;
      if (lo > hi) {
        snap('<b>search(' + lo + ', ' + hi + ')</b>: the range is empty. <b>Base case</b>: ' + target + ' is not here, return −1.', { result: -1 });
        stack.pop(); return -1;
      }
      var mid = lo + Math.floor((hi - lo) / 2);
      snap('<b>search(' + lo + ', ' + hi + ')</b> looks at the middle: a[' + mid + '] = ' + a[mid] + '.', { mid: mid });
      if (a[mid] === target) {
        snap('a[' + mid + '] = ' + target + '. Found: <b>base case</b>, return ' + mid + '.', { mid: mid, midState: 'found', result: mid });
        stack.pop(); return mid;
      }
      var goRight = a[mid] < target;
      snap(a[mid] + (goRight ? ' < ' : ' > ') + target + ', so the target can only be in the ' + (goRight ? 'right' : 'left') + ' half. One recursive call on half the range; the other half is never looked at.', { mid: mid });
      var r = goRight ? go(mid + 1, hi) : go(lo, mid - 1);
      snap('<b>search(' + lo + ', ' + hi + ')</b> returns ' + r + ' unchanged: nothing is left to combine.', { result: r });
      stack.pop();
      return r;
    }
    var res = go(0, a.length - 1);
    steps.push(Object.assign({}, steps[steps.length - 1], { regions: [], pointers: res >= 0 ? [{ name: 'found', index: res, state: 'found' }] : [],
      items: items.map(function (it, i) { return { id: it.id, value: it.value, state: i === res ? 'found' : 'default' }; }),
      caption: (res >= 0 ? 'Found ' + target + ' at index ' + res : target + ' is not in the array') + ' after ' + calls + ' call' + (calls === 1 ? '' : 's') + '. Each call halves the range, so the depth is about log₂ n.', result: res }));
    steps.result = res;
    steps.calls = calls;
    return steps;
  }

  /* ================================================================== hero teaser: nested frames */
  function dolls(n) {
    var steps = [], open = [];
    function snap(extra) {
      steps.push({ dolls: open.map(function (d) { return Object.assign({}, d); }), bubble: (extra && extra.bubble) || null });
    }
    snap();
    for (var k = n; k >= 0; k--) {
      open.forEach(function (d) { d.state = 'frontier'; });
      open.push({ id: 'd' + k, k: k, label: 'fact(' + k + ')', state: 'active', value: null });
      snap();
    }
    open[open.length - 1].state = 'done'; open[open.length - 1].value = 1;
    snap();
    var v = 1;
    for (var j = 1; j <= n; j++) {
      open.pop();
      v *= j;
      var top = open[open.length - 1];
      top.state = 'done'; top.value = v; top.expr = j + ' × ' + (v / j);
      snap({ bubble: { from: 'd' + (j - 1), to: 'd' + j, value: v / j } });
    }
    return steps;
  }

  /* ================================================================== fractal tree segments */
  function fractal(depth, angleDeg, ratio) {
    var segs = [], ang = angleDeg * Math.PI / 180, r = ratio || 0.68;
    (function grow(x, y, len, dir, d, id) {
      var x2 = x + Math.cos(dir) * len, y2 = y + Math.sin(dir) * len;
      segs.push({ id: id, x1: x, y1: y, x2: x2, y2: y2, depth: d, len: len });
      if (d >= depth) return;
      grow(x2, y2, len * r, dir - ang, d + 1, id + 'l');
      grow(x2, y2, len * r, dir + ang, d + 1, id + 'r');
    }(0, 0, 1, -Math.PI / 2, 0, 't'));
    return segs;
  }

  return {
    KINDS: KINDS,
    lab: lab,
    parseLabInput: parseLabInput,
    hanoi: hanoi,
    hanoiMoves: hanoiMoves,
    fibTree: fibTree,
    fib: fib,
    fibCalls: fibCalls,
    fibMemoCalls: fibMemoCalls,
    factorial: factorial,
    powInt: powInt,
    FOLDERS: FOLDERS,
    folders: folders,
    rows: rows,
    unfold: unfold,
    countdown: countdown,
    compare: compare,
    palindrome: palindrome,
    binarySearch: binarySearch,
    dolls: dolls,
    fractal: fractal,
    esc: esc
  };
}));
