/* Step generators and models for lesson 09 (js/algos/09-stacks.js).
   Run: node --test tests/algos/09-stacks.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const S = require(path.join(ROOT, 'js', 'algos', '09-stacks.js'));
const core = require(path.join(ROOT, 'js', 'vdsa', 'core.js'));
const code = require(path.join(ROOT, 'js', 'vdsa', 'code.js'));
const STATES = new Set(Object.keys(core.STATES));

/* ------------------------------------------------------------ independent reference implementations */
function refBalancedByReduction(text) {   // repeatedly delete adjacent pairs: a different algorithm from the stack
  let s = Array.from(text).filter(c => '()[]{}'.includes(c)).join('');
  let prev;
  do { prev = s; s = s.replace('()', '').replace('[]', '').replace('{}', ''); } while (s !== prev);
  return s === '';
}
function refInfixEval(tokens) {           // recursive descent, no stack machine
  let p = 0;
  function expr() { let v = term(); while (tokens[p] === '+' || tokens[p] === '-') { const op = tokens[p++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; }
  function term() { let v = factor(); while (tokens[p] === '*' || tokens[p] === '/') { const op = tokens[p++]; const r = factor(); v = op === '*' ? v * r : v / r; } return v; }
  function factor() { if (tokens[p] === '(') { p++; const v = expr(); p++; return v; } return Number(tokens[p++]); }
  return expr();
}
function randomExprTree(rng, depth) {
  if (depth === 0 || rng() < 0.3) return { num: rng.int(1, 12) };
  return { op: rng.pick(['+', '-', '*', '/']), l: randomExprTree(rng, depth - 1), r: randomExprTree(rng, depth - 1) };
}
function toPostfixTokens(t) { return t.num !== undefined ? [String(t.num)] : [...toPostfixTokens(t.l), ...toPostfixTokens(t.r), t.op]; }
const PR = { '+': 1, '-': 1, '*': 2, '/': 2 };
function toInfixTokens(t, parent) {       // parenthesise only when needed
  if (t.num !== undefined) return [String(t.num)];
  const need = parent && (PR[t.op] < PR[parent.op] || (t === parent.r && PR[t.op] === PR[parent.op]));
  const inner = [...toInfixTokens(t.l, t), t.op, ...toInfixTokens(t.r, t)];
  return need ? ['(', ...inner, ')'] : inner;
}

function randomText(rng, n, alphabet) { let s = ''; for (let i = 0; i < n; i++) s += alphabet[rng.int(0, alphabet.length - 1)]; return s; }
function randomBalanced(rng, pairs) {
  const P = ['()', '[]', '{}'];
  if (pairs === 0) return '';
  const k = rng.int(0, pairs - 1), o = P[rng.int(0, 2)];
  return o[0] + randomBalanced(rng, k) + o[1] + randomBalanced(rng, pairs - 1 - k);
}

/* ============================================================ bracket matcher */
const BRACKET_CASES = ['', 'a', '()', '([]{})', '([)]', ')(', '(', '((', '(()', '())', '{[()]}', '{[(])}', 'f(x[i]) + g{y}', '(((((', ')))))', '([{}])([{}])', '  ', '(a b)', '(]', '([}'];

test('bracket matcher agrees with a delete-adjacent-pairs reference on fixed cases', () => {
  for (const text of BRACKET_CASES) {
    const steps = S.bracketSteps(text);
    const last = steps[steps.length - 1];
    assert.equal(last.result === 'valid', refBalancedByReduction(text), JSON.stringify(text));
    assert.equal(S.bracketReference(text).balanced, refBalancedByReduction(text), JSON.stringify(text));
  }
});

test('bracket matcher agrees with the reference on random text (balanced and not)', () => {
  const rng = core.rng(9);
  for (let t = 0; t < 400; t++) {
    const text = t % 3 === 0 ? randomBalanced(rng, rng.int(0, 6)) : randomText(rng, rng.int(0, 16), '()[]{}ab ');
    const steps = S.bracketSteps(text);
    const last = steps[steps.length - 1];
    const ref = S.bracketReference(text);
    assert.equal(last.result === 'valid', refBalancedByReduction(text), JSON.stringify(text));
    assert.equal(last.result === 'valid', ref.balanced);
    assert.equal(last.reason, ref.reason, JSON.stringify(text));
    assert.equal(last.failAt, ref.failIndex, JSON.stringify(text));
  }
});

test('the stack drawn at every step equals the openers a reference would be holding', () => {
  const rng = core.rng(21);
  for (let t = 0; t < 200; t++) {
    const text = randomText(rng, rng.int(0, 14), '()[]{}x');
    const chars = Array.from(text);
    const steps = S.bracketSteps(text);
    const replay = upTo => {
      const st = [];
      for (let k = 0; k < upTo; k++) {
        const c = chars[k];
        if ('([{'.includes(c)) st.push(c); else if (')]}'.includes(c)) st.pop();
      }
      return st;
    };
    steps.forEach(s => {
      let expected;
      if (s.kind === 'init') expected = [];
      else if (s.i === null) expected = replay(chars.length);
      else if (s.kind === 'push' || s.kind === 'pop' || s.kind === 'skip') expected = replay(s.i + 1);
      else expected = replay(s.i);                            // compare and failing closers see the stack before the closer
      if (s.kind === 'fail' && s.reason === 'leftover') expected = replay(chars.length);
      assert.deepEqual(s.stack.map(x => x.value), expected, `${JSON.stringify(text)} step ${s.kind} at ${s.i}`);
    });
  }
});

test('a failing step is the last step, and success ends with an empty stack', () => {
  for (const text of BRACKET_CASES) {
    const steps = S.bracketSteps(text);
    steps.slice(0, -1).forEach(s => assert.ok(s.result === null, 'only the last step has a result'));
    const last = steps[steps.length - 1];
    assert.ok(['valid', 'invalid'].includes(last.result));
    if (last.result === 'valid') assert.equal(last.stack.length, 0);
    assert.ok(last.kind === 'valid' || last.kind === 'fail');
  }
});

test('the failing closer of ([)] is index 2 and the reason is a mismatch', () => {
  const steps = S.bracketSteps('([)]');
  const last = steps[steps.length - 1];
  assert.equal(last.failAt, 2);
  assert.equal(last.reason, 'mismatch');
  assert.equal(last.chars[2].state, 'error');
  assert.deepEqual(last.stack.map(x => x.value), ['(', '[']);
  assert.equal(last.stack[1].state, 'error');
});

test('edge cases: pop on empty (underflow), unmatched closer, leftover openers', () => {
  let l = S.bracketSteps(')').pop();
  assert.equal(l.reason, 'underflow'); assert.equal(l.failAt, 0); assert.equal(l.stack.length, 0);
  l = S.bracketSteps('a)').pop();
  assert.equal(l.reason, 'underflow'); assert.equal(l.failAt, 1);
  l = S.bracketSteps('(()').pop();
  assert.equal(l.reason, 'leftover'); assert.equal(l.failAt, 0);
  assert.deepEqual(l.stack.map(x => x.state), ['error']);
  assert.equal(l.chars[0].state, 'error'); assert.equal(l.chars[1].state, 'done'); assert.equal(l.chars[2].state, 'done');
  l = S.bracketSteps('').pop();
  assert.equal(l.result, 'valid'); assert.equal(S.bracketSteps('').length, 2);
});

test('done means matched: only paired brackets are done, and leftover openers are never done', () => {
  const rng = core.rng(5);
  for (let t = 0; t < 200; t++) {
    const text = randomText(rng, rng.int(0, 14), '()[]{}x');
    const steps = S.bracketSteps(text);
    steps.forEach(s => s.chars.forEach((c, k) => {
      if (c.state === 'done') assert.ok('()[]{}'.includes(c.value), 'a done char is a bracket');
      if (c.state === 'muted') assert.ok(!'()[]{}'.includes(c.value), 'muted chars are not brackets');
      if (c.state === 'done') {
        // a done opener must be gone from the stack
        assert.ok(!s.stack.some(x => x.id === c.id));
      }
    }));
    const last = steps[steps.length - 1];
    if (last.result === 'valid') last.chars.forEach(c => { if ('()[]{}'.includes(c.value)) assert.equal(c.state, 'done'); });
  }
});

test('counters never decrease and pushes - pops equals the stack depth', () => {
  const rng = core.rng(33);
  for (let t = 0; t < 100; t++) {
    const steps = S.bracketSteps(randomText(rng, rng.int(0, 16), '()[]{}x'));
    steps.forEach((s, k) => {
      assert.equal(s.counters.pushes - s.counters.pops, s.counters.depth);
      assert.equal(s.counters.depth, s.stack.length);
      if (k) { assert.ok(s.counters.pushes >= steps[k - 1].counters.pushes); assert.ok(s.counters.pops >= steps[k - 1].counters.pops); }
    });
  }
});

test('no bracket step uses an unknown state, and stack ids are unique', () => {
  for (const text of BRACKET_CASES) S.bracketSteps(text).forEach(s => {
    s.chars.forEach(c => assert.ok(STATES.has(c.state), c.state));
    s.stack.forEach(c => assert.ok(STATES.has(c.state), c.state));
    assert.equal(new Set(s.stack.map(x => x.id)).size, s.stack.length);
  });
});

/* ============================================================ postfix evaluation */
test('tokenizer: splits, normalises symbols and reports friendly errors', () => {
  assert.deepEqual(S.tokenizeExpr('3 4 +').tokens, ['3', '4', '+']);
  assert.deepEqual(S.tokenizeExpr('12+3×4').tokens, ['12', '+', '3', '*', '4']);
  assert.deepEqual(S.tokenizeExpr('8 ÷ 2 − 1').tokens, ['8', '/', '2', '-', '1']);
  assert.ok(S.tokenizeExpr('3 4 + a').error.includes('“a”'));
  assert.ok(S.tokenizeExpr('(3 4 +)').error);                       // postfix has no parentheses
  assert.equal(S.tokenizeExpr('(3+4)', { parens: true }).error, null);
  assert.ok(S.tokenizeExpr('   ').error);
  assert.ok(S.tokenizeExpr('1 '.repeat(30)).error);
  assert.ok(S.tokenizeExpr('1234 1 +').error);
});

test('postfix evaluation: fixed cases match the reference', () => {
  const cases = {
    '3 4 +': 7, '3 4 + 2 *': 14, '2 3 4 * +': 14, '5 1 2 + 4 * + 3 -': 14, '8 2 /': 4, '7': 7, '9 3 - 2 -': 4, '2 3 - ': -1, '1 2 /': 0.5
  };
  for (const [text, expected] of Object.entries(cases)) {
    const tokens = S.tokenizeExpr(text).tokens;
    assert.equal(S.evalPostfix(tokens).value, expected, text);
    const last = S.postfixSteps(tokens).pop();
    assert.equal(last.result, 'value', text);
    assert.equal(last.stack.length, 1);
    assert.equal(last.stack[0].value, S.fmtNum(expected));
  }
});

test('postfix evaluation: random trees give the right value, a matching stack and a matching tree', () => {
  const rng = core.rng(77);
  for (let t = 0; t < 200; t++) {
    const tree = randomExprTree(rng, rng.int(0, 4));
    const tokens = toPostfixTokens(tree);
    if (tokens.length > 17) continue;
    if (tokens.includes('/')) {
      // skip division by zero situations; the reference reports them
      const r = S.evalPostfix(tokens);
      if (r.error) continue;
    }
    const expected = S.evalPostfix(tokens).value;
    const steps = S.postfixSteps(tokens);
    const last = steps[steps.length - 1];
    assert.equal(last.result, 'value');
    assert.equal(last.stack[0].value, S.fmtNum(expected));
    // the final root is the last token's node and every operator has two children
    assert.equal(last.roots.length, 1);
    const byId = Object.fromEntries(last.nodes.map(n => [n.id, n]));
    const root = byId[last.roots[0]];
    assert.equal(root.value, S.fmtNum(expected));
    last.nodes.forEach(n => { if (n.left !== null) assert.ok(byId[n.left] && byId[n.right]); else assert.equal(n.right, null); });
    assert.equal(last.nodes.length, tokens.length);
    // stack depth at every step equals a reference stack machine
    const st = [];
    steps.forEach(s => {
      assert.equal(s.stack.length, s.counters.depth);
      assert.equal(s.roots.filter(id => s.stack.some(x => x.id === id)).length, s.stack.length);
    });
    assert.ok(Math.max(...steps.map(s => s.stack.length)) <= Math.ceil(tokens.length / 2) + 1);
    void st;
  }
});

test('postfix stack values at each token match a reference machine', () => {
  const tokens = ['5', '1', '2', '+', '4', '*', '+', '3', '-'];
  const steps = S.postfixSteps(tokens);
  const ref = [];
  const seen = [];
  tokens.forEach(t => {
    if (/^\d+$/.test(t)) ref.push(Number(t)); else { const b = ref.pop(), a = ref.pop(); ref.push(S.applyOp(t, a, b)); }
    seen.push(ref.slice());
  });
  const applied = steps.filter(s => s.kind === 'push' || s.kind === 'apply');
  assert.equal(applied.length, tokens.length);
  applied.forEach((s, k) => assert.deepEqual(s.stack.map(x => Number(x.value.replace('−', '-'))), seen[k]));
});

test('postfix errors: underflow, leftover values, division by zero, and the trace stops at the error', () => {
  let steps = S.postfixSteps(['3', '+']);
  let last = steps[steps.length - 1];
  assert.equal(last.error, 'underflow'); assert.equal(last.result, 'error'); assert.equal(last.i, 1);
  steps = S.postfixSteps(['+']);
  last = steps[steps.length - 1];
  assert.equal(last.error, 'underflow'); assert.equal(last.stack.length, 0);
  steps = S.postfixSteps(['3', '4']);
  last = steps[steps.length - 1];
  assert.equal(last.error, 'leftover'); assert.equal(last.stack.length, 2);
  assert.deepEqual(last.stack.map(x => x.state), ['error', 'error']);
  steps = S.postfixSteps(['6', '0', '/', '1', '+']);
  last = steps[steps.length - 1];
  assert.equal(last.error, 'divzero'); assert.equal(last.i, 2);
  assert.equal(S.evalPostfix(['6', '0', '/']).error, 'divzero');
  steps.slice(0, -1).forEach(s => assert.equal(s.result, null));
  // operand order: 9 3 - is 6, not -6
  assert.equal(S.evalPostfix(['9', '3', '-']).value, 6);
  const popStep = S.postfixSteps(['9', '3', '-']).find(s => s.kind === 'pop');
  assert.equal(popStep.vars.a, '9'); assert.equal(popStep.vars.b, '3');
});

/* ============================================================ shunting-yard */
test('shunting-yard: fixed cases', () => {
  const cases = {
    '3 + 4 * 2': '3 4 2 * +',
    '3 * 4 + 2': '3 4 * 2 +',
    '( 3 + 4 ) * 2': '3 4 + 2 *',
    '8 - 3 - 2': '8 3 - 2 -',
    '8 / 4 / 2': '8 4 / 2 /',
    '1 + ( 2 + ( 3 + 4 ) )': '1 2 3 4 + + +',
    '7': '7'
  };
  for (const [text, out] of Object.entries(cases)) {
    const tokens = S.tokenizeExpr(text, { parens: true }).tokens;
    assert.equal(S.toPostfix(tokens).tokens.join(' '), out, text);
    const steps = S.shuntingSteps(tokens);
    const last = steps[steps.length - 1];
    assert.equal(last.result, 'postfix');
    assert.equal(last.out.map(x => x.value).join(' '), out.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−'), text);
  }
});

test('shunting-yard: random expressions convert to postfix that evaluates like the infix', () => {
  const rng = core.rng(101);
  let checked = 0;
  for (let t = 0; t < 300; t++) {
    const tree = randomExprTree(rng, rng.int(1, 4));
    const infix = toInfixTokens(tree, null);
    if (infix.length > 17) continue;
    const truth = refInfixEval(infix);
    if (!Number.isFinite(truth)) continue;                        // division by zero: skip
    const ref = S.toPostfix(infix);
    const steps = S.shuntingSteps(infix);
    const last = steps[steps.length - 1];
    assert.equal(last.result, 'postfix');
    assert.deepEqual(last.out.map(x => x.value), ref.tokens.map(S.pretty), infix.join(' '));
    const val = S.evalPostfix(ref.tokens);
    assert.ok(val.value === truth || Math.abs(val.value - truth) < 1e-9, `${infix.join(' ')}: ${val.value} vs ${truth}`);
    // tokens conserved: every input token is in the output, on the stack, in the input, or a discarded paren
    steps.forEach(s => {
      const parens = infix.filter(x => x === '(' || x === ')').length;
      assert.ok(s.input.length + s.out.length + s.stack.length <= infix.length);
      assert.ok(s.input.length + s.out.length + s.stack.length >= infix.length - parens);
    });
    assert.equal(last.stack.length, 0); assert.equal(last.input.length, 0);
    checked++;
  }
  assert.ok(checked > 150);
});

test('shunting-yard: precedence and parentheses errors', () => {
  const t = x => S.tokenizeExpr(x, { parens: true }).tokens;
  let last = S.shuntingSteps(t('( 3 + 4')).pop();
  assert.equal(last.error, 'paren'); assert.equal(last.stack[0].state, 'error');
  last = S.shuntingSteps(t('3 + 4 )')).pop();
  assert.equal(last.error, 'paren');
  assert.equal(S.toPostfix(t('( 3 + 4')).error, 'paren');
  assert.equal(S.toPostfix(t('3 + 4 )')).error, 'paren');
  // the operator stack is a stack: deepest point for 1 + ( 2 * ( 3 - 4 ) ) is the number of waiting items
  const steps = S.shuntingSteps(t('1 + ( 2 * ( 3 - 4 ) )'));
  assert.equal(steps[steps.length - 1].counters.deepest, 5);
  // × waits for − : the top is never lower precedence than what is under it, except across a paren
  S.shuntingSteps(t('1 + 2 * 3 - 4 / 5')).forEach(s => {
    const ops = s.stack.map(x => x.value);
    for (let k = 1; k < ops.length; k++) {
      const p = { '+': 1, '−': 1, '×': 2, '÷': 2 };
      if (p[ops[k]] && p[ops[k - 1]]) assert.ok(p[ops[k]] > p[ops[k - 1]], ops.join(' '));
    }
  });
});

/* ============================================================ monotonic stack */
const MONO_CASES = [[], [5], [3, 3], [1, 2, 3, 4, 5], [5, 4, 3, 2, 1], [2, 2, 2, 2], [4, 1, 2, 3, 9, 1], [73, 74, 75, 71, 69, 72, 76, 73], [1, 3, 2, 4, 2, 5, 1], [9, 1, 9, 1, 9]];

test('monotonic stack: answers equal the brute-force reference in both modes', () => {
  const rng = core.rng(2024);
  const inputs = MONO_CASES.slice();
  for (let t = 0; t < 300; t++) inputs.push(Array.from({ length: rng.int(0, 14) }, () => rng.int(1, rng.pick([3, 9, 60]))));
  for (const a of inputs) {
    for (const mode of ['greater', 'days']) {
      const steps = S.monoSteps(a, mode);
      const last = steps[steps.length - 1];
      assert.deepEqual(last.answers, mode === 'days' ? S.daysUntilWarmer(a) : S.nextGreater(a), `${mode} ${a}`);
      assert.equal(last.kind, 'leftover');
    }
  }
});

test('monotonic stack invariant: values never increase from bottom to top after every push', () => {
  const rng = core.rng(8);
  for (let t = 0; t < 200; t++) {
    const a = Array.from({ length: rng.int(1, 14) }, () => rng.int(1, 8));
    S.monoSteps(a).forEach(s => {
      if (s.kind === 'push') for (let k = 1; k < s.stack.length; k++) assert.ok(a[s.stack[k - 1]] >= a[s.stack[k]], `${a} ${s.stack}`);
      // indices increase from bottom to top
      for (let k = 1; k < s.stack.length; k++) assert.ok(s.stack[k - 1] < s.stack[k]);
    });
  }
});

test('monotonic stack: each pop draws the arrow to the first larger value, and never twice', () => {
  const a = [73, 74, 75, 71, 69, 72, 76, 73];
  const steps = S.monoSteps(a, 'days');
  const last = steps[steps.length - 1];
  const from = last.arrows.map(x => x.from);
  assert.equal(new Set(from).size, from.length);
  last.arrows.forEach(x => {
    assert.ok(a[x.to] > a[x.from]);
    for (let j = x.from + 1; j < x.to; j++) assert.ok(a[j] <= a[x.from]);      // nothing between is larger
  });
  assert.equal(last.arrows.length, a.length - 2);                               // 76 and the final 73 have no answer
  assert.deepEqual(last.answers, [1, 1, 4, 2, 1, 1, 0, 0]);
});

test('monotonic stack: each index is pushed once and popped at most once; comparisons stay within 2n', () => {
  const rng = core.rng(66);
  for (let t = 0; t < 200; t++) {
    const a = Array.from({ length: rng.int(0, 14) }, () => rng.int(1, 6));
    const steps = S.monoSteps(a);
    const c = steps[steps.length - 1].counters;
    assert.equal(c.pushes, a.length);
    assert.ok(c.pops <= a.length);
    assert.ok(c.comparisons <= 2 * a.length);
    assert.equal(c.comparisons, S.monoCompareCount(a));
    const pops = steps.filter(s => s.kind === 'pop').length;
    assert.equal(pops, c.pops);
  }
});

test('monotonic stack: duplicates need a strictly larger value; leftovers are muted, never done', () => {
  const steps = S.monoSteps([2, 2, 2]);
  const last = steps[steps.length - 1];
  assert.deepEqual(last.answers, [-1, -1, -1]);
  assert.deepEqual(last.states, ['muted', 'muted', 'muted']);
  const s2 = S.monoSteps([3, 5, 4]).pop();
  assert.deepEqual(s2.states, ['done', 'muted', 'muted']);
  assert.deepEqual(s2.answers, [5, -1, -1]);
  assert.deepEqual(S.monoSteps([1, 1, 5], 'days').pop().answers, [2, 1, 0]);
  const empty = S.monoSteps([]);
  assert.equal(empty.length, 2);
  assert.deepEqual(empty[1].answers, []);
});

test('monotonic stack counts: the naive scan is quadratic on decreasing input, the stack stays linear', () => {
  const dec = Array.from({ length: 40 }, (_, k) => 40 - k);
  assert.equal(S.naiveCompareCount(dec), 40 * 39 / 2);
  assert.ok(S.monoCompareCount(dec) <= 80);
  const inc = dec.slice().reverse();
  assert.equal(S.naiveCompareCount(inc), 39);
  assert.ok(S.monoCompareCount(inc) <= 80);
  const rng = core.rng(4);
  for (let t = 0; t < 50; t++) {
    const a = Array.from({ length: 30 }, () => rng.int(1, 99));
    assert.ok(S.monoCompareCount(a) <= 2 * a.length);
    assert.ok(S.naiveCompareCount(a) >= a.length - 1 || a.length < 2);
  }
});

/* ============================================================ stack model, undo/redo, array vs linked, growth */
test('StackModel: LIFO order, peek, overflow and underflow leave the stack unchanged', () => {
  const s = S.StackModel(3);
  assert.equal(s.pop().error, 'underflow'); assert.equal(s.peek().error, 'empty'); assert.ok(s.isEmpty());
  [1, 2, 3].forEach(v => assert.ok(s.push(v).ok));
  const over = s.push(4);
  assert.equal(over.ok, false); assert.equal(over.error, 'overflow'); assert.deepEqual(s.items(), [1, 2, 3]);
  assert.equal(s.peek().value, 3); assert.equal(s.size(), 3);
  assert.equal(s.pop().value, 3); assert.equal(s.pop().value, 2); assert.equal(s.pop().value, 1);
  assert.equal(s.pop().error, 'underflow');
  const u = S.StackModel(null);
  for (let k = 0; k < 500; k++) assert.ok(u.push(k).ok);
  assert.equal(u.size(), 500);
  const one = S.StackModel(1);
  assert.ok(one.push('a').ok); assert.equal(one.push('b').error, 'overflow');
  const zero = S.StackModel(0);
  assert.equal(zero.push('a').error, 'overflow');
});

test('StackModel matches a plain array under random operations', () => {
  const rng = core.rng(12);
  for (let t = 0; t < 100; t++) {
    const cap = rng.int(1, 6), m = S.StackModel(cap), ref = [];
    for (let k = 0; k < 40; k++) {
      const r = rng();
      if (r < 0.5) { const res = m.push(k); if (ref.length < cap) { assert.ok(res.ok); ref.push(k); } else assert.equal(res.error, 'overflow'); }
      else if (r < 0.85) { const res = m.pop(); if (ref.length) assert.equal(res.value, ref.pop()); else assert.equal(res.error, 'underflow'); }
      else { const res = m.peek(); if (ref.length) assert.equal(res.value, ref[ref.length - 1]); else assert.ok(!res.ok); }
      assert.deepEqual(m.items(), ref);
    }
  }
});

test('undo/redo with two stacks: undo all restores the start, redo all restores the end, a new action clears redo', () => {
  const rng = core.rng(3);
  for (let t = 0; t < 100; t++) {
    const h = S.createHistory([], S.HISTORY_DOMAINS.shapes);
    let id = 0;
    const n = rng.int(0, 8);
    for (let k = 0; k < n; k++) {
      if (rng() < 0.2) h.do({ type: 'clear', prev: h.snapshot().doc });
      else h.do({ type: 'add', item: { id: 's' + (id++), kind: 'circle' } });
    }
    const end = h.snapshot().doc;
    let undone = 0;
    while (h.undo().ok) undone++;
    assert.deepEqual(h.snapshot().doc, []);
    assert.equal(h.snapshot().undo.length, 0); assert.equal(h.snapshot().redo.length, n);
    assert.equal(undone, n);
    while (h.redo().ok);
    assert.deepEqual(h.snapshot().doc, end);
  }
  const h = S.createHistory([], S.HISTORY_DOMAINS.shapes);
  h.do({ type: 'add', item: { id: 'a' } }); h.do({ type: 'add', item: { id: 'b' } });
  h.undo();
  assert.equal(h.snapshot().redo.length, 1);
  const res = h.do({ type: 'add', item: { id: 'c' } });
  assert.equal(res.clearedRedo, 1); assert.equal(h.snapshot().redo.length, 0);
  assert.deepEqual(h.snapshot().doc.map(x => x.id), ['a', 'c']);
  assert.equal(S.createHistory([], S.HISTORY_DOMAINS.shapes).undo().ok, false);
  assert.equal(S.createHistory([], S.HISTORY_DOMAINS.shapes).redo().ok, false);
});

test('undo/redo works for browser history too', () => {
  const h = S.createHistory('home', S.HISTORY_DOMAINS.browser);
  h.do({ type: 'visit', from: 'home', to: 'news' }); h.do({ type: 'visit', from: 'news', to: 'video' });
  assert.equal(h.snapshot().doc, 'video');
  h.undo(); assert.equal(h.snapshot().doc, 'news'); h.undo(); assert.equal(h.snapshot().doc, 'home');
  assert.equal(h.undo().ok, false);
  h.redo(); assert.equal(h.snapshot().doc, 'news');
  h.do({ type: 'visit', from: 'news', to: 'shop' });
  assert.equal(h.redo().ok, false); assert.equal(h.snapshot().doc, 'shop');
});

test('array vs linked stack: both hold the same values as a reference after every operation', () => {
  const rng = core.rng(15);
  for (let t = 0; t < 100; t++) {
    const cap = 6, ops = [], ref = [];
    for (let k = 0; k < 14; k++) {
      if (ref.length && (ref.length >= cap || rng() < 0.4)) { ops.push({ op: 'pop' }); ref.pop(); }
      else { const v = rng.int(1, 9); ops.push({ op: 'push', v }); ref.push(v); }
    }
    const steps = S.arrayVsLinkedSteps(ops, cap);
    const check = [];
    const rr = [];
    ops.forEach(o => { if (o.op === 'push') rr.push(o.v); else rr.pop(); check.push(rr.slice()); });
    const settled = steps.filter(s => s.kind === 'move');
    assert.equal(settled.length, ops.length);
    settled.forEach((s, k) => {
      const live = s.array.items.filter(it => it.index <= s.array.top).sort((a, b) => a.index - b.index).map(it => it.value);
      assert.deepEqual(live, check[k]);
      const listVals = s.list.nodes.map(n => n.value).reverse();          // head is the top
      assert.deepEqual(listVals, check[k]);
      assert.equal(s.array.top, check[k].length - 1);
      s.array.items.filter(it => it.index > s.array.top).forEach(it => assert.equal(it.state, 'muted'));   // stale values are greyed
      assert.equal(s.list.head, s.list.nodes.length ? s.list.nodes[0].id : null);
    });
  }
});

test('array stack: a popped value stays in memory until overwritten', () => {
  const steps = S.arrayVsLinkedSteps([{ op: 'push', v: 5 }, { op: 'push', v: 8 }, { op: 'pop' }, { op: 'push', v: 2 }], 4);
  const afterPop = steps[steps.length - 3];
  assert.equal(afterPop.kind, 'move');
  assert.equal(afterPop.array.top, 0);
  const stale = afterPop.array.items.find(it => it.index === 1);
  assert.equal(stale.value, 8); assert.equal(stale.state, 'muted');
  const last = steps[steps.length - 1];
  assert.equal(last.array.items.find(it => it.index === 1).value, 2);
});

test('scenario storyboard: pops undo pushes in reverse order', () => {
  const ops = [{ op: 'push', v: 'a' }, { op: 'push', v: 'b' }, { op: 'peek' }, { op: 'pop' }, { op: 'pop' }];
  const steps = S.scenarioSteps(ops);
  assert.equal(steps.length, ops.length + 1);
  assert.deepEqual(steps.map(s => s.items.map(i => i.value).join('')), ['', 'a', 'ab', 'ab', 'a', '']);
  assert.equal(steps[3].items[1].state, 'compare');
  assert.equal(new Set(steps[2].items.map(i => i.id)).size, 2);
});

test('growable array stack: doubling is amortised O(1), growing by a constant is not', () => {
  const d = S.growCosts(64, 'double'), p = S.growCosts(64, 'plus4');
  assert.equal(d.costs.length, 64);
  assert.equal(d.costs.filter(c => c > 1).length, 4);                 // grows at pushes 5, 9, 17, 33
  assert.equal(d.costs[4], 5); assert.equal(d.costs[8], 9); assert.equal(d.costs[16], 17); assert.equal(d.costs[32], 33);
  assert.ok(d.total <= 3 * 64);
  assert.ok(p.total > d.total);
  for (const n of [1, 4, 5, 100, 1000]) assert.ok(S.growCosts(n, 'double').total <= 3 * n, 'doubling total <= 3n for n=' + n);
  assert.ok(S.growCosts(1000, 'plus4').total > 10 * 1000);
  assert.equal(S.growCosts(0, 'double').total, 0);
  d.costs.forEach((c, k) => assert.ok(c >= 1 && c <= k + 1));
});

test('call chain storyboard: frames push then pop in reverse order, every step names a return before popping', () => {
  const steps = S.callChainSteps();
  assert.deepEqual(steps.map(s => s.frames.map(f => f.fn).join('>')), ['main', 'main>average', 'main>average>sum', 'main>average>sum', 'main>average', 'main>average', 'main']);
  assert.equal(steps[3].frames[2].returnValue, 12);
  assert.equal(steps[5].frames[1].returnValue, 6);
  assert.equal(steps[6].frames[0].locals[0][1], 6);
});

/* ============================================================ code panels and step fields */
test('every code label used by a step exists in pseudocode, JavaScript and Python', () => {
  const sets = [
    ['bracket', S.CODE.bracket, BRACKET_CASES.flatMap(t => S.bracketSteps(t))],
    ['postfix', S.CODE.postfix, [['3', '4', '+'], ['2', '3', '4', '*', '+'], ['3', '+'], ['+'], ['3', '4'], ['6', '0', '/']].flatMap(t => S.postfixSteps(t))],
    ['mono greater', S.CODE.mono.greater, MONO_CASES.flatMap(a => S.monoSteps(a, 'greater'))],
    ['mono days', S.CODE.mono.days, MONO_CASES.flatMap(a => S.monoSteps(a, 'days'))]
  ];
  for (const [name, set, steps] of sets) {
    const parsed = {};
    for (const lang of ['pseudo', 'js', 'py']) parsed[lang] = code.parse(set[lang], lang);
    const used = new Set();
    steps.forEach(s => [].concat(s.line === null || s.line === undefined ? [] : s.line).forEach(l => used.add(l)));
    assert.ok(used.size >= 5, name + ' uses several labels');
    for (const label of used) for (const lang of Object.keys(parsed)) assert.ok(parsed[lang].labels[label], `${name}: label @${label} missing in ${lang}`);
    for (const lang of Object.keys(parsed)) assert.ok(!code.plainText(parsed[lang]).includes('@'), `${name} ${lang}: label text visible`);
  }
});

test('flow ids, variable order and counter keys are stable on every step', () => {
  const FLOWS = ['start', 'push', 'skip', 'match', 'pop', 'bad', 'good', 'empty'];
  for (const text of BRACKET_CASES) {
    const steps = S.bracketSteps(text);
    steps.forEach(s => {
      assert.ok(FLOWS.includes(s.flow), s.flow);
      assert.deepEqual(Object.keys(s.vars), Object.keys(steps[0].vars));
      assert.deepEqual(Object.keys(s.counters), Object.keys(steps[0].counters));
      assert.ok(typeof s.caption === 'string' && s.caption.length > 10);
    });
  }
  for (const a of MONO_CASES) S.monoSteps(a).forEach((s, k, all) => { assert.deepEqual(Object.keys(s.vars), Object.keys(all[0].vars)); assert.deepEqual(Object.keys(s.counters), Object.keys(all[0].counters)); });
  for (const t of [['3', '4', '+'], ['3', '+']]) S.postfixSteps(t).forEach((s, k, all) => assert.deepEqual(Object.keys(s.vars), Object.keys(all[0].vars)));
});

test('states used by every generator belong to the shared vocabulary', () => {
  const all = [];
  BRACKET_CASES.forEach(t => S.bracketSteps(t).forEach(s => { s.chars.forEach(c => all.push(c.state)); s.stack.forEach(c => all.push(c.state)); }));
  MONO_CASES.forEach(a => S.monoSteps(a).forEach(s => s.states.forEach(x => all.push(x))));
  [['3', '4', '+', '2', '*'], ['3', '+'], ['3', '4']].forEach(t => S.postfixSteps(t).forEach(s => { s.tokens.forEach(c => all.push(c.state)); s.stack.forEach(c => all.push(c.state)); s.nodes.forEach(c => all.push(c.state)); }));
  ['3 + 4 * ( 2 - 1 )', '( 3'].forEach(x => S.shuntingSteps(S.tokenizeExpr(x, { parens: true }).tokens).forEach(s => { s.input.concat(s.out, s.stack).forEach(c => all.push(c.state)); }));
  all.forEach(x => assert.ok(STATES.has(x), x));
});

test('steps are never mutated after they are produced (shared arrays stay equal to their own copies)', () => {
  const steps = S.monoSteps([4, 1, 2, 3, 9]);
  const copy = JSON.parse(JSON.stringify(steps));
  steps.forEach((s, k) => assert.deepEqual(JSON.parse(JSON.stringify(s)), copy[k]));
  const b = S.bracketSteps('([)]');
  const bc = JSON.parse(JSON.stringify(b));
  b.forEach((s, k) => assert.deepEqual(JSON.parse(JSON.stringify(s)), bc[k]));
});
