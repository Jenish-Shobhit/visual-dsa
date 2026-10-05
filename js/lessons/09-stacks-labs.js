/* Lesson 09 — the three code-synced labs (brackets, postfix, monotonic stack), the bracket flowchart and the
   infix-to-postfix figure. Uses VDSA.algos.stacks (js/algos/09-stacks.js) and the views in
   js/lessons/09-stacks-views.js. Started lazily by js/lessons/09-stacks.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var L9 = V.lessons.l9;
  function A() { return V.algos.stacks; }
  var fmt = L9.fmt;
  L9.labs = L9.labs || {};

  /* ---------------------------------------------------------------- shared helpers */
  function rowState(list) {           // array-view state for a row of {id, value|text, state}
    return { items: list.map(function (c) { return { id: c.id, value: c.text !== undefined ? c.value : c.value, text: c.text, state: c.state }; }) };
  }
  function flowAdapter(flowView) {
    return {
      highlight: function (id, ctx) {
        var visited = [];
        if (ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var k = 0; k < ctx.index && k < st.length; k++) if (st[k].flow && visited.indexOf(st[k].flow) === -1 && st[k].flow !== id) visited.push(st[k].flow);
        }
        flowView.render({ active: id || undefined, visited: visited }, { duration: ctx ? ctx.duration : 0 });
      }
    };
  }
  /* Rotate options (and their explanations) so the right answer is not always first. */
  function rotated(options, explain, answer, k) {
    var n = options.length, order = [];
    for (var m = 0; m < n; m++) order.push((m + k) % n);
    return { options: order.map(function (m) { return options[m]; }), explain: order.map(function (m) { return explain[m]; }), answer: order.indexOf(answer) };
  }
  function setPanel(el, o) {
    el.setAttribute('data-state', o.state);
    el.querySelector('[data-title]').textContent = o.title;
    el.querySelector('[data-text]').textContent = o.text;
    var big = el.querySelector('[data-big]');
    if (big) big.textContent = o.big === undefined ? '' : o.big;
  }

  /* ================================================================== 1. Bracket matcher lab */
  var BRACKET_DEFAULT = '{[()]}(]';

  L9.FLOW_BRACKET = {
    nodes: [
      { id: 'start', type: 'start', text: 'stack = empty', col: 1, row: 0 },
      { id: 'next', type: 'decision', text: 'another\ncharacter?', col: 1, row: 1 },
      { id: 'isopen', type: 'decision', text: 'opener?', col: 1, row: 2 },
      { id: 'push', type: 'process', text: 'push it', col: 0, row: 2 },
      { id: 'isclose', type: 'decision', text: 'closer?', col: 1, row: 3 },
      { id: 'skip', type: 'process', text: 'skip it', col: 2, row: 3 },
      { id: 'empty', type: 'decision', text: 'stack\nempty?', col: 1, row: 4 },
      { id: 'match', type: 'decision', text: 'top pairs\nwith it?', col: 1, row: 5 },
      { id: 'pop', type: 'process', text: 'pop the top', col: 1, row: 6 },
      { id: 'bad', type: 'end', text: 'not balanced', col: 2, row: 5 },
      { id: 'endq', type: 'decision', text: 'stack\nempty?', col: 2, row: 1 },
      { id: 'good', type: 'end', text: 'balanced', col: 3, row: 1 }
    ],
    edges: [
      { from: 'start', to: 'next' },
      { from: 'next', to: 'isopen', label: 'yes' },
      { from: 'next', to: 'endq', label: 'no' },
      { from: 'endq', to: 'good', label: 'yes' },
      { from: 'endq', to: 'bad', label: 'no' },
      { from: 'isopen', to: 'push', label: 'yes' },
      { from: 'isopen', to: 'isclose', label: 'no' },
      { from: 'isclose', to: 'skip', label: 'no' },
      { from: 'isclose', to: 'empty', label: 'yes' },
      { from: 'empty', to: 'bad', label: 'yes', via: { fromSide: 'right', toSide: 'top', points: [[2, 4]] } },
      { from: 'empty', to: 'match', label: 'no' },
      { from: 'match', to: 'bad', label: 'no' },
      { from: 'match', to: 'pop', label: 'yes' },
      { from: 'push', to: 'next' },
      { from: 'skip', to: 'next', via: { fromSide: 'top', toSide: 'right' } },
      { from: 'pop', to: 'next' }
    ]
  };

  L9.initBracketLab = function () {
    var fig = V.$('#lab-brackets'), flowFig = V.$('#fig-flow-brackets');
    if (!fig) return;
    var chars = V.views.array(fig.querySelector('[data-chars]'), { mode: 'boxes', cellSize: 42, emptyText: 'empty text', label: 'The text being checked, one character per box' });
    var stack = V.views.stack(fig.querySelector('[data-stack]'), { cellSize: 34, label: 'Stack of openers still waiting for a closer' });
    var verdict = fig.querySelector('[data-verdict]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().CODE.bracket, default: 'pseudo', maxHeight: 360, title: 'isBalanced' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'active', c: 'compare', top: 'frontier' } });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'Opener waiting' }, { state: 'active', label: 'Just pushed' }, { state: 'compare', label: 'Being checked' },
      { state: 'done', label: 'Matched pair' }, { state: 'error', label: 'Error' }, { state: 'muted', label: 'Not a bracket' }
    ]);
    var flow = V.views.flowchart(flowFig.querySelector('[data-stage]'), L9.FLOW_BRACKET, { label: 'Flowchart of the bracket matcher', narrowWidth: 420 });
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already run' }]);

    function charState(step) {
      return { items: step.chars.map(function (c) { return { id: c.id, value: c.value, text: c.text, state: c.state }; }),
        pointers: step.i === null ? [] : [{ name: 'i', index: step.i, state: 'active', style: 'chip' }] };
    }
    function verdictFor(step) {
      var n = step.chars.length;
      if (step.result === 'valid') return { state: 'valid', big: '✓', title: 'Balanced', text: 'The text is used up and the stack is empty.' };
      if (step.result === 'invalid') {
        var ch = step.failAt === null ? '' : step.chars[step.failAt].value;
        var top = step.stack.length ? step.stack[step.stack.length - 1].value : '';
        var why = step.reason === 'underflow' ? 'The closer ' + ch + ' at index ' + step.failAt + ' found an empty stack.'
          : step.reason === 'mismatch' ? 'The closer ' + ch + ' at index ' + step.failAt + ' met ' + top + ' on top.'
          : step.stack.length + (step.stack.length === 1 ? ' opener is' : ' openers are') + ' still open at the end.';
        return { state: 'invalid', big: '✗', title: 'Not balanced', text: why };
      }
      return { state: 'run', big: '…', title: 'Checking', text: step.i === null ? 'Step forward to read the first character.' : 'Character ' + (step.i + 1) + ' of ' + n + ' · stack depth ' + step.stack.length };
    }

    function generate(text) {
      var steps = A().bracketSteps(text);
      chars.reset(); chars.prepare(steps.map(charState));
      stack.reset(); stack.prepare(steps.map(function (s) { return { items: s.stack }; }));
      return steps;
    }
    var steps = generate(BRACKET_DEFAULT);
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) {
        chars.render(charState(step), { duration: ctx.duration });
        stack.render({ items: step.stack }, { duration: ctx.duration });
        setPanel(verdict, verdictFor(step));
      },
      code: code, vars: vars, flow: flowAdapter(flow),
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { pushes: 'Pushes', pops: 'Pops', depth: 'Stack depth' },
      counterStates: { pushes: 'active', pops: 'done', depth: 'frontier' },
      baseStepMs: 1100, label: 'Bracket matcher controls'
    });

    player.addCheckpoint(function (st) {
      var k = st.findIndex(function (s) { return s.kind === 'fail' && s.reason === 'mismatch'; });
      if (k < 0) k = st.findIndex(function (s) { return s.kind === 'pop'; });
      return k;
    }, function (c) {
      var p = c.prev, s = c.step, cur = p.chars[p.i].value, top = p.stack[p.stack.length - 1].value;
      var fails = s.kind === 'fail';
      var E = V.escape;
      return Object.assign({
        question: 'The closer <code>' + E(cur) + '</code> meets <code>' + E(top) + '</code> on top of the stack. What happens next?'
      }, rotated(
        ['Pop <code>' + E(top) + '</code>: the two pair up', 'Stop: the text is not balanced', 'Push <code>' + E(cur) + '</code> on top as well'],
        [
          fails ? 'They do not pair up, so nothing is popped: the top opener needs a different closer.' : '<code>' + E(top) + '</code> is the newest unfinished group and <code>' + E(cur) + '</code> is exactly its closer, so both are finished and the opener is popped.',
          fails ? 'Right. The newest unfinished group is <code>' + E(top) + '</code>, and it must close first. <code>' + E(cur) + '</code> cannot close it, so the pairs cross instead of nesting.' : 'They do pair up, so nothing is wrong yet: pop and carry on.',
          'Closers are never pushed. Only openers wait on the stack; a closer either finishes the newest group or proves the text is wrong.'
        ], fails ? 1 : 0, p.i % 3));
    }, { id: 'bracket-lab-predict' });

    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Text to check (up to ' + A().BRACKET_MAX + ' characters)', value: BRACKET_DEFAULT, placeholder: 'e.g. ([]{})',
      parse: function (text) {
        var n = Array.from(text).length;
        if (n > A().BRACKET_MAX) return { values: null, error: 'Keep it to ' + A().BRACKET_MAX + ' characters or fewer so every step stays readable (you typed ' + n + ').' };
        return { values: text, error: null };
      },
      presets: [
        { label: 'Balanced', value: '{[()]}()' }, { label: 'Crossing ([)]', value: '([)]' }, { label: 'Extra closer', value: '(()))' },
        { label: 'Never closed', value: '((()' }, { label: 'Starts with a closer', value: ')(' }, { label: 'Code', value: 'f(a[i]) + g{x}' }, { label: 'No brackets', value: 'hello' }
      ],
      onApply: function (text) { player.setSteps(generate(text)); }
    });
    L9.labs.bracket = { player: player, load: function (t) { player.setSteps(generate(t)); } };
  };

  /* ================================================================== 2. Postfix lab */
  var POSTFIX_DEFAULT = '5 1 2 + 4 * + 3 -';

  L9.initPostfixLab = function () {
    var fig = V.$('#lab-postfix');
    if (!fig) return;
    var tokens = V.views.array(fig.querySelector('[data-tokens]'), { mode: 'boxes', cellSize: 44, emptyText: 'no tokens', label: 'Tokens of the postfix expression' });
    var tw = L9.rowWrapper(fig.querySelector('[data-tokens]'), 6);
    var stack = V.views.stack(fig.querySelector('[data-stack]'), { cellSize: 34, label: 'Stack of values' });
    var forest = L9.forestView(fig.querySelector('[data-forest]'), { label: 'Expression trees built from the stack, left to right' });
    var panel = fig.querySelector('[data-verdict]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().CODE.postfix, default: 'pseudo', maxHeight: 340, title: 'evalPostfix' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { token: 'active', a: 'compare', b: 'compare' } });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'On the stack' }, { state: 'active', label: 'Just pushed' }, { state: 'compare', label: 'Popped: a and b' },
      { state: 'found', label: 'Result' }, { state: 'error', label: 'Error' }
    ]);

    function tokState(step) {
      return { items: step.tokens.map(function (t) { return { id: t.id, value: t.text, state: t.state }; }),
        pointers: step.i === null || step.i >= step.tokens.length ? [] : [{ name: 'i', index: step.i, state: 'active', style: 'chip' }] };
    }
    function panelFor(step) {
      if (step.result === 'value') return { state: 'valid', big: step.stack[0].value, title: 'Result', text: 'One value left on the stack.' };
      if (step.result === 'error') {
        var why = step.error === 'underflow' ? 'An operator found fewer than two values: a pop on an empty stack.'
          : step.error === 'divzero' ? 'Division by zero is undefined.'
          : step.error === 'leftover' ? step.stack.length + ' values are left: an operator is missing.' : 'Nothing to return.';
        return { state: 'invalid', big: '✗', title: 'Not a valid expression', text: why };
      }
      return { state: 'run', big: '…', title: 'Evaluating', text: 'The stack holds ' + step.stack.length + (step.stack.length === 1 ? ' value.' : ' values.') };
    }
    function generate(toks) {
      var steps = A().postfixSteps(toks);
      tokens.reset(); tokens.prepare(steps.map(function (s) { return tw.wrap(tokState(s)); }));
      stack.reset(); stack.prepare(steps.map(function (s) { return { items: s.stack }; }));
      forest.reset(); forest.prepare(steps);
      return steps;
    }
    var steps = generate(A().tokenizeExpr(POSTFIX_DEFAULT).tokens);
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) {
        tokens.render(tw.wrap(tokState(step)), { duration: ctx.duration });
        stack.render({ items: step.stack }, { duration: ctx.duration });
        forest.render({ nodes: step.nodes, roots: step.roots, held: step.held }, { duration: ctx.duration });
        setPanel(panel, panelFor(step));
      },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { pushes: 'Pushes', pops: 'Pops', depth: 'Stack depth' }, counterStates: { pushes: 'active', pops: 'compare', depth: 'frontier' },
      baseStepMs: 1200, label: 'Postfix evaluator controls'
    });

    player.addCheckpoint(function (st) {
      var k = st.findIndex(function (s, m) { return s.kind === 'apply' && /[−÷]/.test(st[m - 1].tokens[st[m - 1].i].text); });
      if (k < 0) k = st.findIndex(function (s) { return s.kind === 'apply'; });
      return k;
    }, function (c) {
      var p = c.prev, s = c.step, a = p.vars.a, b = p.vars.b, op = p.vars.token, val = s.stack[s.stack.length - 1].value;
      var raw = { '+': '+', '−': '-', '×': '*', '÷': '/' };
      var na = Number(String(a).replace('−', '-')), nb = Number(String(b).replace('−', '-'));
      var flipped = A().fmtNum(A().applyOp(raw[op], nb, na));
      var other = A().fmtNum(A().applyOp(raw[op] === '+' ? '*' : '+', na, nb));
      var alt = flipped !== val ? flipped : other;
      return Object.assign({
        question: 'Popped <code>b = ' + b + '</code> (the top) and then <code>a = ' + a + '</code>. What gets pushed back for <code>a ' + op + ' b</code>?'
      }, rotated(
        ['<code>' + val + '</code>', '<code>' + alt + '</code>', 'Nothing: <code>a</code> and <code>b</code> stay off the stack'],
        [
          a + ' ' + op + ' ' + b + ' = ' + val + '. The value popped second is the left operand, so the order is a ' + op + ' b.',
          flipped !== val ? 'That reverses the operands: b ' + op + ' a. The top of the stack is the <em>right</em> operand, because it arrived last.' : 'That is the result of a different operator. The operator being applied is ' + op + '.',
          'The result must go back: it may be an operand for the next operator. Two values came off and one went on, so the stack is one shorter.'
        ], 0, String(val).length % 3));
    }, { id: 'postfix-lab-predict' });

    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Postfix tokens, separated by spaces', value: POSTFIX_DEFAULT, placeholder: 'e.g. 3 4 + 2 *',
      hint: 'Whole numbers and + − * / . Up to ' + A().EXPR_MAX + ' tokens.',
      parse: function (text) { var r = A().tokenizeExpr(text); return { values: r.tokens, error: r.error }; },
      presets: [
        { label: '(3 + 4) × 2', value: '3 4 + 2 *' }, { label: '5 + (1 + 2) × 4 − 3', value: '5 1 2 + 4 * + 3 -' }, { label: '9 − 3', value: '9 3 -' },
        { label: 'Too few operands', value: '3 +' }, { label: 'Leftover value', value: '3 4' }, { label: 'Divide by zero', value: '8 0 /' }
      ],
      onApply: function (toks) { player.setSteps(generate(toks)); }
    });
    L9.labs.postfix = {
      player: player,
      load: function (text) { input.set(text); var r = A().tokenizeExpr(text); if (!r.error) player.setSteps(generate(r.tokens)); }
    };
  };

  /* ================================================================== 3. Infix to postfix (shunting-yard) */
  var SHUNT_DEFAULT = '3 + 4 * 2 - ( 1 + 5 )';

  L9.initShunting = function () {
    var fig = V.$('#fig-shunting');
    if (!fig) return;
    var rows = V.views.array(fig.querySelector('[data-rows]'), { mode: 'boxes', cellSize: 44, label: 'Input and output rows of the shunting-yard algorithm' });
    var sw = L9.rowWrapper(fig.querySelector('[data-rows]'), 6);
    var stack = V.views.stack(fig.querySelector('[data-stack]'), { cellSize: 34, label: 'Operator stack' });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Token in hand' }, { state: 'compare', label: 'Compared with the top' }, { state: 'frontier', label: 'Waiting on the stack' }, { state: 'done', label: 'Output' }, { state: 'error', label: 'Error' }]);
    var n = 0;
    function rowsState(step) {
      return { rows: [
        { id: 'in', label: 'input', length: n, items: step.input.map(function (x) { return { id: x.id, value: x.value, index: x.index, state: x.state }; }) },
        { id: 'out', label: 'output', length: n, items: step.out.map(function (x) { return { id: x.id, value: x.value, index: x.index, state: x.state }; }) }
      ] };
    }
    var send = fig.querySelector('[data-send]');
    function generate(toks) {
      n = toks.length;
      var steps = A().shuntingSteps(toks);
      rows.reset(); rows.prepare(steps.map(function (s) { return sw.wrap(rowsState(s)); }));
      stack.reset(); stack.prepare(steps.map(function (s) { return { items: s.stack }; }));
      return steps;
    }
    var toks0 = A().tokenizeExpr(SHUNT_DEFAULT, { parens: true }).tokens;
    var steps = generate(toks0);
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) {
        rows.render(sw.wrap(rowsState(step)), { duration: ctx.duration });
        stack.render({ items: step.stack }, { duration: ctx.duration });
        send.disabled = step.result !== 'postfix';
        send.dataset.out = step.result === 'postfix' ? step.out.map(function (x) { return x.value; }).join(' ') : '';
      },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { output: 'Output length', depth: 'Stack depth', deepest: 'Deepest so far' }, counterStates: { output: 'done', depth: 'frontier', deepest: 'compare' },
      baseStepMs: 1150, label: 'Shunting-yard controls'
    });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Infix expression', value: SHUNT_DEFAULT, placeholder: 'e.g. 3 + 4 * ( 2 − 1 )',
      hint: 'Whole numbers, + − * / and parentheses. Up to ' + A().EXPR_MAX + ' tokens.',
      parse: function (text) { var r = A().tokenizeExpr(text, { parens: true }); if (r.error) { send.disabled = true; send.dataset.out = ''; } return { values: r.tokens, error: r.error }; },
      presets: [{ label: '3 + 4 × 2', value: '3 + 4 * 2' }, { label: '(3 + 4) × 2', value: '( 3 + 4 ) * 2' }, { label: '8 − 3 − 2', value: '8 - 3 - 2' }, { label: 'Nested', value: '1 + ( 2 * ( 3 - 4 ) )' }, { label: 'Missing )', value: '( 3 + 4' }],
      onApply: function (toks) { player.setSteps(generate(toks)); }
    });
    send.addEventListener('click', function () {
      var text = (send.dataset.out || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      if (!text) return;
      var go = function () { L9.labs.postfix.load(text); V.$('#lab-postfix').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      if (L9.labs.postfix) go(); else if (L9.ensurePostfix) { L9.ensurePostfix(); go(); }
    });
  };

  /* ================================================================== 4. Monotonic stack lab */
  var MONO_DEFAULT = [73, 74, 75, 71, 69, 72, 76, 73];

  L9.initMonoLab = function () {
    var fig = V.$('#lab-mono');
    if (!fig) return;
    var mode = 'days';
    var view = L9.monoView(fig.querySelector('[data-bars]'), { barHeight: 150, label: 'Bars, the answer arrows and the answer row' });
    var stack = V.views.stack(fig.querySelector('[data-stack]'), { orientation: 'horizontal', cellSize: 46, label: 'Stack of indices still waiting for a larger value' });
    var invariant = fig.querySelector('[data-invariant]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A().CODE.mono.days, default: 'js', maxHeight: 340, title: 'daysUntilWarmer' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'active', 'a[i]': 'active', top: 'compare', stack: 'frontier' } });
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'frontier', label: 'Waiting on the stack' }, { state: 'active', label: 'Current i' }, { state: 'compare', label: 'Top being tested' },
      { state: 'done', label: 'Answered' }, { state: 'muted', label: 'No larger value' }, { state: 'path', shape: 'line', label: 'Arrow: popped → its answer' }
    ]);
    function stackState(step) {
      return { items: step.stack.map(function (k, m) {
        var st = 'frontier';
        if (m === step.stack.length - 1) st = step.kind === 'push' ? 'active' : step.kind === 'cmp' ? 'compare' : 'frontier';
        return { id: 'k' + k, value: step.values[k], badge: '#' + k, state: st };
      }) };
    }
    function invariantText(step) {
      if (!step.stack.length) return { ok: true, text: 'The stack is empty.' };
      var vals = step.stack.map(function (k) { return step.values[k]; });
      var ok = vals.every(function (v, k) { return !k || vals[k - 1] >= v; });
      return { ok: ok, text: 'Values from bottom to top: ' + vals.join(' ≥ ') };
    }
    function generate(values) {
      var steps = A().monoSteps(values, mode);
      view.reset(); view.prepare(steps);
      stack.reset(); stack.prepare(steps.map(stackState));
      return steps;
    }
    var steps = generate(MONO_DEFAULT);
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) {
        view.render(step, { duration: ctx.duration });
        stack.render(stackState(step), { duration: ctx.duration });
        var inv = invariantText(step);
        invariant.querySelector('[data-inv]').textContent = inv.text;
        invariant.setAttribute('data-ok', inv.ok && step.kind !== 'cmp' && step.kind !== 'pop' ? 'true' : 'mid');
      },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { comparisons: 'Comparisons', pushes: 'Pushes', pops: 'Pops' }, counterStates: { comparisons: 'compare', pushes: 'active', pops: 'done' },
      baseStepMs: 1200, label: 'Monotonic stack controls'
    });
    player.addCheckpoint(function (st) { return st.findIndex(function (s) { return s.kind === 'pop'; }); }, function (c) {
      var p = c.prev, i = p.i, t = p.topIdx, a = p.values;
      var day = p.mode === 'days';
      return Object.assign({
        question: '<code>a[' + t + '] = ' + a[t] + '</code> is smaller than <code>a[' + i + '] = ' + a[i] + '</code>. What happens to index ' + t + '?'
      }, rotated(
        ['It is popped and answered: ' + (day ? (i - t) + ' day' + (i - t === 1 ? '' : 's') : 'its answer is ' + a[i]), 'It stays on the stack and waits', 'It is popped, but its answer is still unknown'],
        [
          'Right. Index ' + i + ' is the first value to the right of ' + t + ' that is larger, so the answer is settled, and ' + t + ' has no reason to stay.',
          'It has been waiting for exactly this: a larger value to its right. Keeping it would only make later comparisons slower.',
          'The answer is known the moment a larger value arrives: ' + (day ? i + ' − ' + t + ' = ' + (i - t) : String(a[i])) + '. Nothing else has to be searched.'
        ], 0, (i + t) % 3));
    }, { id: 'mono-lab-predict' });

    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (up to ' + A().MONO_MAX + ', 1 to 99)', value: MONO_DEFAULT,
      parse: { min: 1, max: 99, integers: true, minCount: 0, maxCount: A().MONO_MAX },
      presets: [
        { label: 'Temperatures', value: MONO_DEFAULT }, { label: 'Random', value: function () { return V.presets.random(9, { min: 10, max: 90 }); } },
        { label: 'Decreasing', value: [9, 8, 7, 6, 5, 4, 3, 2] }, { label: 'Increasing', value: [2, 3, 4, 5, 6, 7, 8, 9] },
        { label: 'Duplicates', value: [4, 4, 4, 2, 4, 4] }, { label: 'Mountain', value: [1, 3, 6, 9, 6, 3, 1] }, { label: 'One value', value: [5] }
      ],
      onApply: function (values) { current = values; player.setSteps(generate(values)); }
    });
    var current = MONO_DEFAULT;
    V.segmented(fig.querySelector('[data-mode]'), {
      label: 'Question', value: 'days',
      options: [{ value: 'days', label: 'Days until warmer' }, { value: 'greater', label: 'Next greater value' }],
      onChange: function (m) {
        mode = m;
        code.setSource(A().CODE.mono[m === 'days' ? 'days' : 'greater']);
        player.setSteps(generate(current));
      }
    });
    L9.labs.mono = { player: player };
  };
}());
