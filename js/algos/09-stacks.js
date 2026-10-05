/* Stacks: pure step generators and models for lesson 09. No DOM. UMD: in the browser it merges into
   VDSA.algos.stacks; in Node it exports the same API.

     bracketSteps(text)              -> steps   bracket matcher (push openers, pop and match closers)
     bracketReference(text)          -> {balanced, failIndex, reason}   reason: 'underflow' | 'mismatch' | 'leftover' | null
     tokenizeExpr(text, opts)        -> {tokens, error}   opts {parens: bool, maxTokens}
     evalPostfix(tokens)             -> {value} | {error, at}          reference evaluator
     postfixSteps(tokens)            -> steps   postfix evaluation: stack + expression forest
     toPostfix(tokens)               -> {tokens} | {error}             reference shunting-yard
     shuntingSteps(tokens)           -> steps   infix -> postfix with an operator stack
     nextGreater(values) / daysUntilWarmer(values)                     reference answers
     monoSteps(values, mode)         -> steps   monotonic stack, mode 'greater' | 'days'
     naiveCompareCount(values), monoCompareCount(values)               comparison counts (chart)
     StackModel(capacity)            push/pop/peek with overflow and underflow results
     createHistory(initial, domain)  undo/redo with two stacks; HISTORY_DOMAINS.shapes / .browser
     arrayVsLinkedSteps(ops, cap)    -> steps   the same pushes and pops on an array and on a linked list
     scenarioSteps(ops)              -> steps   plain push / pop / peek storyboard for the stack view
     growCosts(n, policy)            -> {costs, total, capacities}     growable-array stack (chart)
     callChainSteps()                -> steps   nested calls on the call stack
     CODE.bracket / .postfix / .mono{greater,days}                     {pseudo, js, py} with // @labels

   Every step is a complete snapshot; steps carry the player fields caption, line, flow, vars, counters.
   Truth rules (tested in tests/algos/09-stacks.test.js): an opener is 'done' only once its closer has popped it;
   a failing step is the last step of its trace; stack contents always equal a reference implementation's. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    var V = root.VDSA = root.VDSA || {};
    V.algos = V.algos || {};
    V.algos.stacks = Object.assign(V.algos.stacks || {}, api);
  }
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function code(s) { return '<code>' + esc(s) + '</code>'; }
  function bold(s) { return '<b>' + esc(s) + '</b>'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many || one + 's'); }

  /* ================================================================== 1. Bracket matcher */
  var OPEN = { '(': ')', '[': ']', '{': '}' };
  var CLOSE = { ')': '(', ']': '[', '}': '{' };
  var BRACKET_MAX = 26;

  function bracketReference(text) {
    var chars = Array.from(String(text)), st = [];
    for (var k = 0; k < chars.length; k++) {
      var c = chars[k];
      if (OPEN[c]) st.push(k);
      else if (CLOSE[c]) {
        if (!st.length) return { balanced: false, failIndex: k, reason: 'underflow' };
        if (chars[st[st.length - 1]] !== CLOSE[c]) return { balanced: false, failIndex: k, reason: 'mismatch' };
        st.pop();
      }
    }
    if (st.length) return { balanced: false, failIndex: st[0], reason: 'leftover' };
    return { balanced: true, failIndex: null, reason: null };
  }

  function bracketSteps(text) {
    var chars = Array.from(String(text)), n = chars.length;
    var stack = [], status = chars.map(function () { return 'unseen'; });
    var steps = [], pushes = 0, pops = 0;

    function snap(kind, cur, curState, o) {
      o = o || {};
      var top = stack.length ? stack[stack.length - 1] : null;
      steps.push({
        kind: kind,
        chars: chars.map(function (c, k) {
          var st = k === cur ? curState : status[k] === 'open' ? 'frontier' : status[k] === 'matched' ? 'done' : status[k] === 'skip' ? 'muted' : status[k] === 'bad' ? 'error' : 'default';
          return { id: 'c' + k, value: c, text: c === ' ' ? '␣' : c, state: st };
        }),
        i: cur,
        stack: stack.map(function (s, idx) {
          var st = 'frontier';
          if (idx === stack.length - 1 && o.topState) st = o.topState;
          if (o.allState) st = o.allState;
          return { id: s.id, value: s.ch, state: st };
        }),
        result: o.result || null, failAt: o.failAt === undefined ? null : o.failAt, reason: o.reason || null,
        caption: o.caption, line: o.line, flow: o.flow,
        vars: { i: cur, c: cur === null ? null : chars[cur], top: top ? top.ch : null, size: stack.length },
        counters: { pushes: pushes, pops: pops, depth: stack.length }
      });
    }

    snap('init', null, 'default', {
      caption: 'The stack starts empty. It will hold every opener that is still waiting for its closer, with the newest opener on top.',
      line: 'init', flow: 'start'
    });
    for (var k = 0; k < n; k++) {
      var c = chars[k];
      if (OPEN[c]) {
        stack.push({ id: 'c' + k, ch: c, index: k });
        status[k] = 'open'; pushes++;
        snap('push', k, 'active', {
          topState: 'active', line: 'push', flow: 'push',
          caption: bold(c) + ' opens a group, so push it. The group is unfinished until its closer arrives, and the newest unfinished group must be the first to close.'
        });
      } else if (CLOSE[c]) {
        if (!stack.length) {
          status[k] = 'bad';
          snap('fail', k, 'error', {
            result: 'invalid', reason: 'underflow', failAt: k, line: 'empty', flow: 'empty',
            caption: bold(c) + ' closes a group, but the stack is empty: no opener is waiting for it. Popping an empty stack is an <em>underflow</em>, so the text is <b>not balanced</b>.'
          });
          return steps;
        }
        var top = stack[stack.length - 1];
        snap('compare', k, 'compare', {
          topState: 'compare', line: 'cmp', flow: 'match',
          caption: bold(c) + ' must close the newest unfinished opener, the top of the stack: ' + bold(top.ch) + '. Do they pair up?'
        });
        if (top.ch === CLOSE[c]) {
          stack.pop(); pops++;
          status[top.index] = 'matched'; status[k] = 'matched';
          snap('pop', k, 'done', {
            line: 'pop', flow: 'pop',
            caption: bold(top.ch) + ' and ' + bold(c) + ' pair up. Pop the opener: that group is finished, and the next-newest opener is exposed.'
          });
        } else {
          status[k] = 'bad';
          snap('fail', k, 'error', {
            topState: 'error', result: 'invalid', reason: 'mismatch', failAt: k, line: 'bad', flow: 'bad',
            caption: bold(c) + ' needs ' + bold(CLOSE[c]) + ' on top, but the top is ' + bold(top.ch) + '. The ' + code(top.ch) + ' group is still open, so this closer crosses it instead of nesting. <b>Not balanced.</b>'
          });
          return steps;
        }
      } else {
        status[k] = 'skip';
        snap('skip', k, 'muted', {
          line: 'loop', flow: 'skip',
          caption: bold(c === ' ' ? 'A space' : c) + (c === ' ' ? ' is' : ' is') + ' not a bracket, so it neither opens nor closes anything. Skip it.'
        });
      }
    }
    if (!stack.length) {
      snap('valid', null, 'default', {
        result: 'valid', line: 'end', flow: 'good',
        caption: n && chars.some(function (c) { return OPEN[c] || CLOSE[c]; })
          ? 'The text is used up and the stack is empty: every opener was closed by the right closer, in the right order. <b>Balanced.</b>'
          : 'The text is used up and the stack is empty. There were no brackets at all, so nothing can be out of place. <b>Balanced.</b>'
      });
    } else {
      stack.forEach(function (s) { status[s.index] = 'bad'; });
      snap('fail', null, 'default', {
        allState: 'error', result: 'invalid', reason: 'leftover', failAt: stack[0].index, line: 'end', flow: 'bad',
        caption: 'The text is used up, but ' + plural(stack.length, 'opener is', 'openers are') + ' still on the stack: ' + stack.map(function (s) { return code(s.ch); }).join(' ') + '. Nothing ever closed ' + (stack.length === 1 ? 'it' : 'them') + '. <b>Not balanced.</b>'
      });
    }
    return steps;
  }

  /* ================================================================== 2. Expressions: tokens, postfix, shunting-yard */
  function pretty(t) { return t === '*' ? '×' : t === '/' ? '÷' : t === '-' ? '−' : t; }
  function fmtNum(v) {
    var r = Math.round(v * 10000) / 10000;
    return String(r).replace('-', '−');
  }
  function isNum(t) { return /^\d+$/.test(t); }
  function isOp(t) { return t === '+' || t === '-' || t === '*' || t === '/'; }
  function applyOp(op, a, b) { return op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b; }
  var PREC = { '+': 1, '-': 1, '*': 2, '/': 2 };
  var EXPR_MAX = 17;

  /* Split text into number and operator tokens, with friendly errors. */
  function tokenizeExpr(text, opts) {
    opts = opts || {};
    var max = opts.maxTokens || EXPR_MAX;
    var t = String(text).replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
    var bad = t.replace(/[\d+\-*/()\s]/g, '');
    if (bad) return { tokens: [], error: 'Only whole numbers, + − × ÷' + (opts.parens ? ' and parentheses' : '') + ' are allowed. Found “' + bad[0] + '”.' };
    var tokens = t.match(/\d+|[-+*/()]/g) || [];
    if (!opts.parens && tokens.some(function (x) { return x === '(' || x === ')'; })) return { tokens: [], error: 'Postfix has no parentheses: the order of the tokens already says what happens first.' };
    if (!tokens.length) return { tokens: [], error: 'Type at least one token.' };
    if (tokens.length > max) return { tokens: [], error: 'Keep it to ' + max + ' tokens or fewer so every step stays readable.' };
    if (tokens.some(function (x) { return isNum(x) && x.length > 3; })) return { tokens: [], error: 'Use numbers up to 999.' };
    if (opts.parens) {
      var bad2 = infixShapeError(tokens);
      if (bad2) return { tokens: [], error: bad2 };
    }
    return { tokens: tokens, error: null };
  }

  /* Infix must alternate operand, operator, operand ...; a group may not be empty. */
  function infixShapeError(tokens) {
    var expectOperand = true, depth = 0;
    for (var k = 0; k < tokens.length; k++) {
      var x = tokens[k];
      if (expectOperand) {
        if (isNum(x)) expectOperand = false;
        else if (x === '(') depth++;
        else if (x === ')') return k && tokens[k - 1] === '(' ? 'The parentheses are empty: put an expression between ( and ).' : 'An operand is missing before “)”: an operator needs a number on both sides.';
        else if (k && isOp(tokens[k - 1])) return 'Two operators in a row (“' + pretty(tokens[k - 1]) + ' ' + pretty(x) + '”): an operator needs a number on both sides.';
        else return 'The operator “' + pretty(x) + '” has no number before it: an operator needs a number on both sides.';
      } else {
        if (isOp(x)) expectOperand = true;
        else if (x === ')') { if (depth) depth--; /* unmatched ) is reported by the stepper */ }
        else return 'Two operands in a row (“' + pretty(tokens[k - 1]) + ' ' + pretty(x) + '”): an operator is missing between them.';
      }
    }
    if (expectOperand) return 'The expression ends with an operator or an open (: it needs an operand to finish.';
    return null;
  }

  function evalPostfix(tokens) {
    var st = [];
    for (var k = 0; k < tokens.length; k++) {
      var t = tokens[k];
      if (isNum(t)) st.push(Number(t));
      else if (isOp(t)) {
        if (st.length < 2) return { error: 'underflow', at: k };
        var b = st.pop(), a = st.pop();
        if (t === '/' && b === 0) return { error: 'divzero', at: k };
        st.push(applyOp(t, a, b));
      } else return { error: 'token', at: k };
    }
    if (st.length !== 1) return { error: st.length ? 'leftover' : 'empty', at: tokens.length };
    return { value: st[0] };
  }

  function postfixSteps(tokens) {
    var toks = tokens.slice(), n = toks.length;
    var stack = [], nodes = {}, order = [], roots = [];
    var steps = [], pushes = 0, pops = 0, applied = 0;

    function snap(kind, i, o) {
      o = o || {};
      var ns = o.nodeStates || {};
      steps.push({
        kind: kind, i: i,
        tokens: toks.map(function (t, k) {
          var st = k < i ? 'visited' : k === i ? (o.tokState || 'active') : 'default';
          if (o.allTokens) st = o.allTokens;
          return { id: 't' + k, text: pretty(t), state: st };
        }),
        stack: stack.map(function (id) { return { id: id, value: fmtNum(nodes[id].value), state: ns[id] || 'frontier' }; }),
        nodes: order.map(function (id) {
          var nd = nodes[id];
          return { id: id, label: nd.label, value: fmtNum(nd.value), left: nd.left, right: nd.right, state: ns[id] || (roots.indexOf(id) !== -1 && stack.indexOf(id) !== -1 ? 'frontier' : 'default') };
        }),
        roots: roots.slice(),
        held: o.held || null,
        result: o.result === undefined ? null : o.result, error: o.error || null,
        caption: o.caption, line: o.line, flow: o.flow,
        vars: { token: i === null || i >= n ? null : pretty(toks[i]), a: o.a === undefined ? null : fmtNum(o.a), b: o.b === undefined ? null : fmtNum(o.b), size: stack.length },
        counters: { pushes: pushes, pops: pops, depth: stack.length }
      });
    }

    snap('init', null, { caption: 'The stack starts empty. Tokens arrive left to right. A number waits on the stack; an operator uses the two newest numbers.', line: 'init' });
    for (var k = 0; k < n; k++) {
      var t = toks[k];
      if (isNum(t)) {
        var id = 'n' + k;
        nodes[id] = { id: id, label: t, value: Number(t), left: null, right: null };
        order.push(id); roots.push(id); stack.push(id); pushes++;
        snap('push', k, { nodeStates: (function () { var m = {}; m[id] = 'active'; return m; }()), line: 'push',
          caption: bold(t) + ' is a number, so push it. It cannot be used until an operator asks for it, and the newest number is the first one an operator will ask for.' });
      } else {
        var opId = 'n' + k;
        if (stack.length < 2) {
          snap('error', k, { tokState: 'error', error: 'underflow', result: 'error', line: stack.length ? 'popa' : 'popb', allTokens: undefined,
            nodeStates: stack.length ? (function () { var m = {}; m[stack[0]] = 'error'; return m; }()) : {},
            caption: bold(pretty(t)) + ' needs two numbers, but the stack holds only ' + stack.length + '. Popping an empty stack is an <em>underflow</em>: this is not a valid postfix expression.' });
          return steps;
        }
        var bId = stack[stack.length - 1], aId = stack[stack.length - 2];
        var bv = nodes[bId].value, av = nodes[aId].value;
        var popStates = {}; popStates[aId] = 'compare'; popStates[bId] = 'compare';
        var popB = {}; popB[bId] = 'compare';
        stack.pop(); pops++;
        snap('pop', k, { held: { b: bId }, nodeStates: popB, b: bv, line: 'popb',
          caption: bold(pretty(t)) + ' is an operator. Pop <b>b = ' + fmtNum(bv) + '</b> first: it is the newest value, so it is the right operand.' });
        stack.pop(); pops++;
        snap('pop', k, { held: { a: aId, b: bId }, nodeStates: popStates, a: av, b: bv, line: 'popa',
          caption: 'Pop <b>a = ' + fmtNum(av) + '</b> next: it is the left operand. The order matters for − and ÷.' });
        if (t === '/' && bv === 0) {
          snap('error', k, { tokState: 'error', error: 'divzero', result: 'error', held: { a: aId, b: bId }, nodeStates: popStates, a: av, b: bv, line: 'apply',
            caption: 'Dividing ' + fmtNum(av) + ' by 0 is undefined, so the evaluation stops here.' });
          return steps;
        }
        var val = applyOp(t, av, bv);
        nodes[opId] = { id: opId, label: pretty(t), value: val, left: aId, right: bId };
        order.push(opId);
        roots = roots.filter(function (r) { return r !== aId && r !== bId; });
        roots.push(opId); stack.push(opId); pushes++; applied++;
        var ap = {}; ap[opId] = 'active';
        snap('apply', k, { nodeStates: ap, a: av, b: bv, line: 'apply',
          caption: fmtNum(av) + ' ' + pretty(t) + ' ' + fmtNum(bv) + ' = <b>' + fmtNum(val) + '</b>. Push the result: it stands for the whole subtree, and the tree grows one level.' });
      }
    }
    if (stack.length === 1) {
      var fin = {}; fin[stack[0]] = 'found';
      snap('done', n, { allTokens: 'visited', nodeStates: fin, result: 'value', line: 'ret',
        caption: 'The tokens are used up and exactly one value remains: <b>' + fmtNum(nodes[stack[0]].value) + '</b>. Its tree is the expression, with every operator above its operands.' });
    } else {
      var errs = {}; stack.forEach(function (id) { errs[id] = 'error'; });
      snap('error', n, { allTokens: 'visited', nodeStates: errs, error: stack.length ? 'leftover' : 'empty', result: 'error', line: 'ret',
        caption: stack.length
          ? 'The tokens are used up, but ' + stack.length + ' values are left on the stack. An operator is missing, so the expression has no single answer.'
          : 'There is nothing on the stack to return.' });
    }
    return steps;
  }

  /* Reference shunting-yard (left associative, + − at 1, × ÷ at 2). */
  function toPostfix(tokens) {
    var out = [], st = [];
    for (var k = 0; k < tokens.length; k++) {
      var t = tokens[k];
      if (isNum(t)) out.push(t);
      else if (isOp(t)) {
        while (st.length && isOp(st[st.length - 1]) && PREC[st[st.length - 1]] >= PREC[t]) out.push(st.pop());
        st.push(t);
      } else if (t === '(') st.push(t);
      else if (t === ')') {
        while (st.length && st[st.length - 1] !== '(') out.push(st.pop());
        if (!st.length) return { error: 'paren', at: k };
        st.pop();
      }
    }
    while (st.length) {
      var top = st.pop();
      if (top === '(') return { error: 'paren', at: tokens.length };
      out.push(top);
    }
    return { tokens: out };
  }

  function shuntingSteps(tokens) {
    var toks = tokens.slice(), n = toks.length;
    var input = toks.map(function (t, k) { return { id: 't' + k, text: pretty(t), index: k }; });
    var stack = [], out = [], steps = [], maxDepth = 0;
    var cur = null;

    function snap(kind, o) {
      o = o || {};
      maxDepth = Math.max(maxDepth, stack.length);
      steps.push({
        kind: kind, i: cur,
        input: input.map(function (x) { return { id: x.id, value: x.text, index: x.index, state: x.index === cur ? (o.curState || 'active') : 'default' }; }),
        out: out.map(function (x, m) { return { id: x.id, value: x.text, index: m, state: o.outState && o.outState === x.id ? 'active' : 'done' }; }),
        stack: stack.map(function (x, m) { return { id: x.id, value: x.text, state: o.stackState && o.stackState[m] ? o.stackState[m] : m === stack.length - 1 && o.topState ? o.topState : 'frontier' }; }),
        error: o.error || null, result: o.result || null,
        caption: o.caption, line: o.line,
        counters: { output: out.length, depth: stack.length, deepest: maxDepth }
      });
    }
    function rec(k) { return { id: 't' + k, text: pretty(toks[k]), index: k, tok: toks[k] }; }

    snap('init', { caption: 'Three places: the input, the operator stack, and the output. Numbers go straight to the output; operators wait on the stack until it is safe to release them.' });
    for (var k = 0; k < n; k++) {
      var t = toks[k], r = rec(k);
      cur = k;
      if (isNum(t)) {
        input = input.filter(function (x) { return x.index !== k; });
        out.push(r);
        snap('output', { outState: r.id, caption: bold(t) + ' is a number. Numbers keep their order in postfix, so it goes straight to the output.' });
      } else if (t === '(') {
        input = input.filter(function (x) { return x.index !== k; });
        stack.push(r);
        snap('push', { topState: 'active', caption: bold('(') + ' starts a group. Push it: it is a wall that operators inside the group must not pop through.' });
      } else if (t === ')') {
        var found = false;
        while (true) {
          if (!stack.length) break;
          var top = stack[stack.length - 1];
          if (top.tok === '(') { found = true; break; }
          snap('cmp', { topState: 'compare', caption: bold(')') + ' ends the group. The top, ' + bold(top.text) + ', is still inside it, so release it to the output.' });
          stack.pop(); out.push(top);
          snap('pop', { outState: top.id, caption: bold(top.text) + ' moves from the stack to the output.' });
        }
        if (!found) {
          snap('error', { curState: 'error', error: 'paren', result: 'error', caption: bold(')') + ' has no ( to close: the stack is empty. The parentheses do not match.' });
          return steps;
        }
        snap('cmp', { topState: 'compare', caption: 'The top is ' + bold('(') + ', the start of the group. Both parentheses have done their job.' });
        stack.pop();
        input = input.filter(function (x) { return x.index !== k; });
        snap('discard', { caption: 'Discard the pair: parentheses never appear in postfix, because the order of the output already encodes the grouping.' });
      } else {
        var p = PREC[t];
        while (true) {
          if (!stack.length) {
            input = input.filter(function (x) { return x.index !== k; });
            stack.push(r);
            snap('push', { topState: 'active', caption: 'The stack is empty, so nothing must go first. Push ' + bold(r.text) + '.' });
            break;
          }
          var tp = stack[stack.length - 1];
          if (tp.tok === '(') {
            input = input.filter(function (x) { return x.index !== k; });
            stack.push(r);
            snap('push', { topState: 'active', caption: 'The top is ' + bold('(') + ', a wall. Push ' + bold(r.text) + ' on top of it.' });
            break;
          }
          if (PREC[tp.tok] >= p) {
            snap('cmp', { topState: 'compare', caption: bold(tp.text) + ' (precedence ' + PREC[tp.tok] + ') binds at least as tightly as ' + bold(r.text) + ' (precedence ' + p + '), so ' + bold(tp.text) + ' must be applied first. Release it.' });
            stack.pop(); out.push(tp);
            snap('pop', { outState: tp.id, caption: bold(tp.text) + ' moves to the output before ' + bold(r.text) + '.' });
          } else {
            snap('cmp', { topState: 'compare', caption: bold(tp.text) + ' (precedence ' + PREC[tp.tok] + ') binds more loosely than ' + bold(r.text) + ' (precedence ' + p + '), so ' + bold(r.text) + ' must be applied first. Keep ' + bold(tp.text) + ' waiting.' });
            input = input.filter(function (x) { return x.index !== k; });
            stack.push(r);
            snap('push', { topState: 'active', caption: 'Push ' + bold(r.text) + ' on top of ' + bold(tp.text) + '. When it leaves, it will leave first.' });
            break;
          }
        }
      }
    }
    cur = null;
    while (stack.length) {
      var last = stack[stack.length - 1];
      if (last.tok === '(') {
        snap('error', { stackState: stack.map(function (x) { return x.tok === '(' ? 'error' : 'frontier'; }), error: 'paren', result: 'error', caption: 'A ' + bold('(') + ' is still on the stack and no ) ever closed it. The parentheses do not match.' });
        return steps;
      }
      snap('flush', { topState: 'compare', caption: 'The input is used up. Whatever is still waiting goes out, newest first: ' + bold(last.text) + '.' });
      stack.pop(); out.push(last);
      snap('pop', { outState: last.id, caption: bold(last.text) + ' moves to the output.' });
    }
    snap('done', { result: 'postfix', caption: 'The stack is empty and the input is used up. The output, <b>' + out.map(function (x) { return esc(x.text); }).join(' ') + '</b>, is the expression in postfix.' });
    return steps;
  }

  /* ================================================================== 3. Monotonic stack */
  var MONO_MAX = 14;
  function nextGreater(a) {
    return a.map(function (v, i) { for (var j = i + 1; j < a.length; j++) if (a[j] > v) return a[j]; return -1; });
  }
  function daysUntilWarmer(a) {
    return a.map(function (v, i) { for (var j = i + 1; j < a.length; j++) if (a[j] > v) return j - i; return 0; });
  }
  function naiveCompareCount(a) {
    var c = 0;
    for (var i = 0; i < a.length; i++) for (var j = i + 1; j < a.length; j++) { c++; if (a[j] > a[i]) break; }
    return c;
  }
  function monoCompareCount(a) {
    var st = [], c = 0;
    for (var i = 0; i < a.length; i++) {
      while (st.length) { c++; if (a[st[st.length - 1]] < a[i]) st.pop(); else break; }
      st.push(i);
    }
    return c;
  }

  function monoSteps(values, mode) {
    mode = mode === 'days' ? 'days' : 'greater';
    var a = values.slice(), n = a.length;
    var none = mode === 'days' ? 0 : -1;
    var ans = a.map(function () { return null; });
    var stack = [], arrows = [], resolved = a.map(function () { return false; });
    var steps = [], cmp = 0, pushes = 0, pops = 0;

    function snap(kind, i, o) {
      o = o || {};
      var states = a.map(function (v, k) {
        if (o.allDone) return resolved[k] ? 'done' : 'muted';
        if (k === i && o.curState !== null) return o.curState || 'active';
        if (o.topIdx === k) return 'compare';
        if (resolved[k]) return 'done';
        if (stack.indexOf(k) !== -1) return 'frontier';
        return 'default';
      });
      var top = stack.length ? stack[stack.length - 1] : null;
      steps.push({
        kind: kind, mode: mode, values: a, i: i, stack: stack.slice(), answers: ans.slice(), resolved: resolved.slice(),
        arrows: arrows.map(function (x) { return { from: x.from, to: x.to, label: x.label, fresh: !!(o.fresh && x.from === o.fresh) }; }),
        states: states, topIdx: o.topIdx === undefined ? null : o.topIdx,
        caption: o.caption, line: o.line,
        vars: { i: i, 'a[i]': i === null ? null : a[i], top: top, stack: stack.slice(), ans: ans.slice() },
        counters: { comparisons: cmp, pushes: pushes, pops: pops }
      });
    }

    snap('init', null, { curState: null, line: 'init', caption: mode === 'days'
      ? 'For each day, find how many days until a warmer one. The stack will hold days that are still waiting, coldest on top, so each new day can settle every colder day it beats.'
      : 'For each value, find the next value to its right that is strictly larger. The stack will hold indices still waiting for an answer, with the largest values at the bottom.' });
    for (var i = 0; i < n; i++) {
      var pushedReason = null;
      while (stack.length) {
        var t = stack[stack.length - 1];
        cmp++;
        if (a[t] < a[i]) {
          snap('cmp', i, { topIdx: t, line: 'cmp', caption: 'Is <b>a[' + t + '] = ' + a[t] + '</b> smaller than <b>a[' + i + '] = ' + a[i] + '</b>? Yes: index ' + i + ' is the first value to the right of ' + t + ' that beats it.' });
          stack.pop(); pops++;
          resolved[t] = true;
          ans[t] = mode === 'days' ? i - t : a[i];
          arrows.push({ from: t, to: i, label: mode === 'days' ? String(i - t) : String(a[i]) });
          snap('pop', i, { fresh: t, line: ['pop', 'answer'], caption: 'Pop ' + t + '. Its answer is ' + (mode === 'days' ? '<b>' + (i - t) + ' day' + (i - t === 1 ? '' : 's') + '</b> (' + i + ' − ' + t + ')' : '<b>' + a[i] + '</b>') + ', and the arrow shows where it came from. Nothing before ' + i + ' can ever answer ' + t + ' better, so it never returns.' });
        } else {
          snap('cmp', i, { topIdx: t, line: 'cmp', caption: 'Is <b>a[' + t + '] = ' + a[t] + '</b> smaller than <b>a[' + i + '] = ' + a[i] + '</b>? No. ' + (a[t] === a[i] ? 'Equal is not strictly larger, so ' + t + ' keeps waiting.' : 'It is larger, so ' + t + ' keeps waiting, and everything beneath it is at least as large.') + ' Stop popping.' });
          pushedReason = 'stop';
          break;
        }
      }
      stack.push(i); pushes++;
      snap('push', i, { line: pushedReason === 'stop' ? 'push' : ['cmp', 'push'], caption: (pushedReason === 'stop' ? '' : 'The stack is empty, so there is nothing to settle. ') + 'Push index <b>' + i + '</b>: it is waiting for a larger value. The stack now reads, from bottom to top, ' + (stack.map(function (k) { return a[k]; }).join(', ')) + ': never increasing.' });
    }
    stack.forEach(function (k) { ans[k] = none; });
    snap('leftover', null, { curState: null, allDone: true, line: 'ret', caption: stack.length
      ? 'The input is used up. ' + plural(stack.length, 'index', 'indices') + ' (' + stack.slice().reverse().join(', ') + ') never met a larger value to their right, so their answer is <b>' + none + '</b>.'
      : 'The input is used up and the stack is empty: every index found an answer.' });
    return steps;
  }

  /* ================================================================== 4. Stack model and undo/redo */
  function StackModel(capacity) {
    var items = [], cap = capacity === undefined || capacity === null ? null : capacity;
    return {
      capacity: cap,
      push: function (v) {
        if (cap !== null && items.length >= cap) return { ok: false, error: 'overflow' };
        items.push(v); return { ok: true, size: items.length };
      },
      pop: function () {
        if (!items.length) return { ok: false, error: 'underflow' };
        var v = items.pop(); return { ok: true, value: v, size: items.length };
      },
      peek: function () {
        if (!items.length) return { ok: false, error: 'empty' };
        return { ok: true, value: items[items.length - 1] };
      },
      isEmpty: function () { return items.length === 0; },
      size: function () { return items.length; },
      items: function () { return items.slice(); }
    };
  }

  function createHistory(initial, domain) {
    var doc = initial, undo = [], redo = [];
    return {
      do: function (action) {
        doc = domain.apply(doc, action); undo.push(action);
        var cleared = redo.length; redo = [];
        return { ok: true, clearedRedo: cleared };
      },
      undo: function () {
        if (!undo.length) return { ok: false, error: 'nothing to undo' };
        var a = undo.pop(); doc = domain.revert(doc, a); redo.push(a);
        return { ok: true, action: a };
      },
      redo: function () {
        if (!redo.length) return { ok: false, error: 'nothing to redo' };
        var a = redo.pop(); doc = domain.apply(doc, a); undo.push(a);
        return { ok: true, action: a };
      },
      snapshot: function () { return { doc: doc, undo: undo.slice(), redo: redo.slice() }; }
    };
  }
  var HISTORY_DOMAINS = {
    shapes: {
      apply: function (doc, a) { return a.type === 'add' ? doc.concat([a.item]) : []; },
      revert: function (doc, a) { return a.type === 'add' ? doc.filter(function (x) { return x.id !== a.item.id; }) : a.prev.slice(); }
    },
    browser: {
      apply: function (doc, a) { return a.to; },
      revert: function (doc, a) { return a.from; }
    }
  };

  /* ================================================================== 5. Array vs linked stack */
  function arrayVsLinkedSteps(ops, capacity) {
    var cap = capacity || 6;
    var slots = [], size = 0;                 // slots: {id, value} | null (stale values stay in memory)
    for (var q = 0; q < cap; q++) slots.push(null);
    var list = [];                            // nodes, head first: {id, value}
    var steps = [], nid = 0, writes = 0, allocs = 0;

    function snap(kind, o) {
      o = o || {};
      steps.push({
        kind: kind,
        array: {
          capacity: cap,
          items: slots.map(function (s, idx) {
            if (!s) return null;
            var st = idx < size ? 'default' : 'muted';
            if (o.arrState && o.arrState[idx]) st = o.arrState[idx];
            return { id: s.id, value: s.value, index: idx, state: st };
          }).filter(Boolean),
          top: size - 1
        },
        list: {
          nodes: list.map(function (nd, idx) {
            var ns = o.listState && o.listState[nd.id];
            var entry = { id: nd.id, value: nd.value, next: idx + 1 < list.length ? list[idx + 1].id : null, state: ns || 'default' };
            if (o.detached && o.detached === nd.id) entry.detached = 'above';
            return entry;
          }),
          head: o.headOn === undefined ? (list.length ? list[0].id : null) : o.headOn,
          ghost: o.ghost || null
        },
        caption: o.caption,
        counters: { size: size, writes: writes, allocations: allocs }
      });
    }
    snap('init', { caption: 'Both stacks start empty. The array has ' + cap + ' slots and a top index of −1. The linked stack is just a head pointer that points at nothing.' });
    ops.forEach(function (op) {
      if (op.op === 'push') {
        var id = 'v' + (nid++), node = { id: 'n' + id, value: op.v };
        slots[size] = { id: 'a' + id, value: op.v };
        writes++; allocs++;
        var ast = {}; ast[size] = 'swap';
        list.unshift(node);
        var ls = {}; ls[node.id] = 'swap';
        snap('write', { arrState: ast, listState: ls, detached: node.id, headOn: list.length > 1 ? list[1].id : null,
          caption: 'push(' + op.v + '). Array: write into the next free slot. List: allocate a node whose <code>next</code> points at the old head. Neither touches any other value.' });
        size++;
        var ls2 = {}; ls2[node.id] = 'active'; var ast2 = {}; ast2[size - 1] = 'active';
        snap('move', { arrState: ast2, listState: ls2,
          caption: 'Array: <code>top</code> moves up one slot. List: <code>head</code> now points at the new node. Two pointer moves, no shifting, no walking.' });
      } else {
        if (!size) return;
        var topSlot = slots[size - 1], hd = list[0];
        var ast3 = {}; ast3[size - 1] = 'compare'; var ls3 = {}; ls3[hd.id] = 'compare';
        snap('read', { arrState: ast3, listState: ls3,
          caption: 'pop(). The value to return is <b>' + topSlot.value + '</b>, at the top of the array and at the head of the list.' });
        size--; list.shift();
        snap('move', { ghost: hd.id,
          caption: 'Array: <code>top</code> moves down. The ' + topSlot.value + ' is still in memory, greyed, until a later push overwrites it. List: <code>head</code> moves to the next node and the old node is released.' });
      }
    });
    return steps;
  }

  /* ================================================================== 6. Plain storyboard for the stack view */
  function scenarioSteps(ops, opts) {
    opts = opts || {};
    var st = [], steps = [], n = 0;
    function snap(o) {
      steps.push({
        items: st.map(function (x, k) { return { id: x.id, value: x.value, state: o.state && o.state[k] ? o.state[k] : 'default' }; }),
        caption: o.caption, kind: o.kind, counters: { size: st.length }
      });
    }
    if (opts.intro !== false) snap({ kind: 'init', caption: opts.intro || 'An empty stack.' });
    ops.forEach(function (op) {
      if (op.op === 'push') {
        st.push({ id: 'p' + (n++), value: op.v });
        snap({ kind: 'push', state: { [st.length - 1]: 'active' }, caption: op.caption || 'push(' + op.v + ')' });
      } else if (op.op === 'peek') {
        snap({ kind: 'peek', state: { [st.length - 1]: 'compare' }, caption: op.caption || 'peek() reads the top without removing it.' });
      } else {
        var x = st.pop();
        snap({ kind: 'pop', caption: op.caption || 'pop() returns ' + (x ? x.value : '') });
      }
    });
    return steps;
  }

  /* ================================================================== 7. Growable array stack costs */
  function growCosts(n, policy) {
    var cap = 4, size = 0, costs = [], total = 0, capacities = [];
    for (var k = 0; k < n; k++) {
      var c = 1;
      if (size === cap) {
        c += size;
        cap = policy === 'plus4' ? cap + 4 : cap * 2;
      }
      size++; total += c; costs.push(c); capacities.push(cap);
    }
    return { costs: costs, total: total, capacities: capacities };
  }

  /* ================================================================== 8. Call stack */
  function callChainSteps() {
    var steps = [];
    function F(id, fn, args, locals, extra) { return Object.assign({ id: id, fn: fn, args: args, locals: locals || [] }, extra || {}); }
    function snap(frames, caption) { steps.push({ frames: frames.map(function (f) { return Object.assign({}, f, { locals: f.locals.map(function (l) { return l.slice(); }) }); }), caption: caption }); }
    var main = F('main', 'main', '', [['result', '?']]);
    snap([main], '<code>main</code> starts. Its frame holds its own local variable, <code>result</code>.');
    var avg = F('avg', 'average', 'a=4, b=8', [['total', '?']]);
    snap([main, avg], 'main calls <code>average(4, 8)</code>. A new frame is pushed on top: main must wait, and its frame stays exactly as it was.');
    var sum = F('sum', 'sum', 'a=4, b=8', []);
    snap([main, avg, sum], 'average calls <code>sum(4, 8)</code>. Another frame goes on top. The newest call is always the one running.');
    snap([main, avg, F('sum', 'sum', 'a=4, b=8', [], { returnValue: 12 })], '<code>sum</code> finishes and returns 12. Its frame is about to be popped.');
    var avg2 = F('avg', 'average', 'a=4, b=8', [['total', 12]]);
    snap([main, avg2], 'The frame is popped and control returns to <code>average</code>, exactly where it left off, now holding total = 12. The most recent call finished first: last in, first out.');
    snap([main, F('avg', 'average', 'a=4, b=8', [['total', 12]], { returnValue: 6 })], '<code>average</code> divides by 2 and returns 6.');
    snap([F('main', 'main', '', [['result', 6]])], 'Popped again. <code>main</code> gets 6. The stack has unwound completely, in exactly the reverse order the calls were made.');
    return steps;
  }

  /* ================================================================== 9. Code for the labs */
  var CODE = {
    bracket: {
      pseudo: [
        'function isBalanced(text)',
        '  stack ← empty stack                  // @init',
        '  for each character ch in text        // @loop',
        '    if ch is one of ( [ {              // @opener',
        '      push(stack, ch)                  // @push',
        '    else if ch is one of ) ] }         // @closer',
        '      if stack is empty                // @empty',
        '        return false',
        '      if top(stack) does not pair with ch   // @cmp',
        '        return false                   // @bad',
        '      pop(stack)                       // @pop',
        '  return stack is empty                // @end'
      ].join('\n'),
      js: [
        'function isBalanced(text) {',
        '  const stack = [];                                  // @init',
        "  const pair = { ')': '(', ']': '[', '}': '{' };",
        '  for (const ch of text) {                           // @loop',
        "    if ('([{'.includes(ch)) {                        // @opener",
        '      stack.push(ch);                                // @push',
        '    } else if (ch in pair) {                         // @closer',
        '      if (stack.length === 0) return false;          // @empty',
        '      if (stack[stack.length - 1] !== pair[ch]) return false;  // @cmp @bad',
        '      stack.pop();                                   // @pop',
        '    }',
        '  }',
        '  return stack.length === 0;                         // @end',
        '}'
      ].join('\n'),
      py: [
        'def is_balanced(text):',
        '    stack = []                                   # @init',
        "    pair = {')': '(', ']': '[', '}': '{'}",
        '    for ch in text:                              # @loop',
        "        if ch in '([{':                          # @opener",
        '            stack.append(ch)                     # @push',
        '        elif ch in pair:                         # @closer',
        '            if not stack: return False           # @empty',
        '            if stack[-1] != pair[ch]: return False   # @cmp @bad',
        '            stack.pop()                          # @pop',
        '    return not stack                             # @end'
      ].join('\n')
    },
    postfix: {
      pseudo: [
        'function evalPostfix(tokens)',
        '  stack ← empty stack                  // @init',
        '  for each token t in tokens           // @loop',
        '    if t is a number                   // @isnum',
        '      push(stack, t)                   // @push',
        '    else                               // @isop',
        '      b ← pop(stack)                   // @popb',
        '      a ← pop(stack)                   // @popa',
        '      push(stack, a t b)               // @apply',
        '  return pop(stack)                    // @ret'
      ].join('\n'),
      js: [
        'function evalPostfix(tokens) {',
        '  const apply = (op, a, b) =>',
        "    op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;",
        '  const stack = [];                       // @init',
        '  for (const t of tokens) {               // @loop',
        '    if (/^\\d+$/.test(t)) {                // @isnum',
        '      stack.push(Number(t));              // @push',
        '    } else {                              // @isop',
        '      const b = stack.pop();              // @popb',
        '      const a = stack.pop();              // @popa',
        '      stack.push(apply(t, a, b));         // @apply',
        '    }',
        '  }',
        '  return stack.pop();                     // @ret',
        '}'
      ].join('\n'),
      py: [
        'def eval_postfix(tokens):',
        '    ops = {"+": lambda a, b: a + b, "-": lambda a, b: a - b,',
        '           "*": lambda a, b: a * b, "/": lambda a, b: a / b}',
        '    stack = []                        # @init',
        '    for t in tokens:                  # @loop',
        '        if t.isdigit():               # @isnum',
        '            stack.append(int(t))      # @push',
        '        else:                         # @isop',
        '            b = stack.pop()           # @popb',
        '            a = stack.pop()           # @popa',
        '            stack.append(ops[t](a, b))   # @apply',
        '    return stack.pop()                # @ret'
      ].join('\n')
    },
    mono: {
      greater: {
        pseudo: [
          'function nextGreater(a)',
          '  ans ← array of length(a), all −1      // @init',
          '  stack ← empty stack of indices',
          '  for i ← 0 to length(a) − 1            // @loop',
          '    while stack is not empty and a[top(stack)] < a[i]   // @cmp',
          '      t ← pop(stack)                    // @pop',
          '      ans[t] ← a[i]                     // @answer',
          '    push(stack, i)                      // @push',
          '  return ans                            // @ret'
        ].join('\n'),
        js: [
          'function nextGreater(a) {',
          '  const ans = new Array(a.length).fill(-1);           // @init',
          '  const stack = [];                                   // indices; values never increase',
          '  for (let i = 0; i < a.length; i++) {                // @loop',
          '    while (stack.length && a[stack[stack.length - 1]] < a[i]) {   // @cmp',
          '      const t = stack.pop();                          // @pop',
          '      ans[t] = a[i];                                  // @answer',
          '    }',
          '    stack.push(i);                                    // @push',
          '  }',
          '  return ans;                                         // @ret',
          '}'
        ].join('\n'),
        py: [
          'def next_greater(a):',
          '    ans = [-1] * len(a)                       # @init',
          '    stack = []                                # indices; values never increase',
          '    for i in range(len(a)):                   # @loop',
          '        while stack and a[stack[-1]] < a[i]:  # @cmp',
          '            t = stack.pop()                   # @pop',
          '            ans[t] = a[i]                     # @answer',
          '        stack.append(i)                       # @push',
          '    return ans                                # @ret'
        ].join('\n')
      },
      days: {
        pseudo: [
          'function daysUntilWarmer(temps)',
          '  ans ← array of length(temps), all 0   // @init',
          '  stack ← empty stack of indices',
          '  for i ← 0 to length(temps) − 1        // @loop',
          '    while stack is not empty and temps[top(stack)] < temps[i]   // @cmp',
          '      t ← pop(stack)                    // @pop',
          '      ans[t] ← i − t                    // @answer',
          '    push(stack, i)                      // @push',
          '  return ans                            // @ret'
        ].join('\n'),
        js: [
          'function daysUntilWarmer(temps) {',
          '  const ans = new Array(temps.length).fill(0);        // @init',
          '  const stack = [];                                   // indices; temps never increase',
          '  for (let i = 0; i < temps.length; i++) {            // @loop',
          '    while (stack.length && temps[stack[stack.length - 1]] < temps[i]) {   // @cmp',
          '      const t = stack.pop();                          // @pop',
          '      ans[t] = i - t;                                 // @answer',
          '    }',
          '    stack.push(i);                                    // @push',
          '  }',
          '  return ans;                                         // @ret',
          '}'
        ].join('\n'),
        py: [
          'def days_until_warmer(temps):',
          '    ans = [0] * len(temps)                          # @init',
          '    stack = []                                      # indices; temps never increase',
          '    for i in range(len(temps)):                     # @loop',
          '        while stack and temps[stack[-1]] < temps[i]:   # @cmp',
          '            t = stack.pop()                         # @pop',
          '            ans[t] = i - t                          # @answer',
          '        stack.append(i)                             # @push',
          '    return ans                                      # @ret'
        ].join('\n')
      }
    }
  };

  return {
    bracketSteps: bracketSteps, bracketReference: bracketReference, BRACKET_MAX: BRACKET_MAX,
    tokenizeExpr: tokenizeExpr, evalPostfix: evalPostfix, postfixSteps: postfixSteps, toPostfix: toPostfix, shuntingSteps: shuntingSteps,
    EXPR_MAX: EXPR_MAX, pretty: pretty, fmtNum: fmtNum, applyOp: applyOp,
    nextGreater: nextGreater, daysUntilWarmer: daysUntilWarmer, monoSteps: monoSteps, MONO_MAX: MONO_MAX,
    naiveCompareCount: naiveCompareCount, monoCompareCount: monoCompareCount,
    StackModel: StackModel, createHistory: createHistory, HISTORY_DOMAINS: HISTORY_DOMAINS,
    arrayVsLinkedSteps: arrayVsLinkedSteps, scenarioSteps: scenarioSteps, growCosts: growCosts, callChainSteps: callChainSteps,
    CODE: CODE
  };
}));
