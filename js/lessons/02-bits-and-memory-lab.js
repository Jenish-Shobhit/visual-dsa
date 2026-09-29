/* Lesson 02 · Bits, bytes & memory — figures, part 2.
   The 8-bit addition lab, the memory lab (+ its synced flowchart), the cost chart, variations, checks and the
   summary card. Shared helpers come from part 1 (VDSA.lessons.bits02); generators from VDSA.algos.bits. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s, B = V.algos.bits;
  var X = V.lessons.bits02, legend = X.legend, svg = X.svg, txt = X.txt, setT = X.setT, lazy = X.lazy, arcTo = X.arcTo, placeAt = X.placeAt;
  function fmt(v) { return B.fmtNum(v); }

  /* ================================================================== 8-bit addition lab */
  var ADD_CODE = {
    pseudo: [
      'function add8(a, b)',
      '  carry ← 0                              // @init',
      '  for i ← 0 to 7                         // @loop',
      '    s ← a[i] + b[i] + carry              // @sum',
      '    sum[i] ← s mod 2                     // @write',
      '    carry ← s div 2                      // @carry',
      '  overflow ← (carry = 1)                 // @done',
      '  return sum, overflow'
    ].join('\n'),
    js: [
      'function add8(a, b) {',
      '  let carry = 0, sum = 0;                                // @init',
      '  for (let i = 0; i < 8; i++) {                          // @loop',
      '    const s = ((a >> i) & 1) + ((b >> i) & 1) + carry;   // @sum',
      '    sum |= (s & 1) << i;                                 // @write',
      '    carry = s >> 1;                                      // @carry',
      '  }',
      '  return { sum, overflow: carry === 1 };                 // @done',
      '}'
    ].join('\n'),
    py: [
      'def add8(a, b):',
      '    carry, total = 0, 0                        # @init',
      '    for i in range(8):                         # @loop',
      '        s = (a >> i & 1) + (b >> i & 1) + carry  # @sum',
      '        total |= (s & 1) << i                  # @write',
      '        carry = s >> 1                         # @carry',
      '    return total, carry == 1                   # @done'
    ].join('\n')
  };

  function addView(stage) { return X.responsive(stage, function (narrow) { return addBuild(stage, narrow); }, 480); }
  function addBuild(stage, narrow) {
    var W = narrow ? 336 : 560, H = 300, P = narrow ? 32 : 46, BX = narrow ? 28 : 38, X0 = narrow ? 42 : 56, YP = 22, YC = 52, YA = 94, YB = 144, YL = 174, YS = 206;
    var CR = narrow ? 9 : 11;
    var el = svg(W, H, 'b2-add' + (narrow ? ' is-narrow' : ''), 'Two bytes added column by column');
    function cx(p) { return X0 + (8 - p) * P + BX / 2; }
    var band = s('rect', { class: 'b2-add__band', x: -BX / 2 - 5, y: 36, width: BX + 10, height: 226, rx: 11 });
    el.appendChild(band); V.place(band, { x: cx(0), y: 0, opacity: 0 });
    [['carry', YC], ['a', YA], ['b', YB], ['sum', YS]].forEach(function (r) { el.appendChild(txt(4, r[1], r[0], 'b2-add__rowl')); });
    el.appendChild(txt(X0 - 14, YB + 1, '+', 'b2-add__plus', { 'text-anchor': 'middle' }));
    el.appendChild(s('line', { class: 'b2-add__line', x1: cx(8) - BX / 2, x2: cx(0) + BX / 2, y1: YL, y2: YL }));
    var cols = [];
    for (var p = 0; p <= 8; p++) {
      var c = { p: p };
      el.appendChild(txt(cx(p), YP, p === 8 ? '256?' : String(Math.pow(2, p)), 'b2-add__place' + (p === 8 ? ' is-over' : ''), { 'text-anchor': 'middle' }));
      if (p < 8) {
        c.a = s('g', { class: 'b2-cell' }, s('rect', { x: -BX / 2, y: -BX / 2, width: BX, height: BX, rx: 7 }), txt(0, 1, '0', 'b2-cell__t'));
        c.b = s('g', { class: 'b2-cell' }, s('rect', { x: -BX / 2, y: -BX / 2, width: BX, height: BX, rx: 7 }), txt(0, 1, '0', 'b2-cell__t'));
        V.place(c.a, { x: cx(p), y: YA }); V.place(c.b, { x: cx(p), y: YB });
        el.appendChild(c.a); el.appendChild(c.b);
      }
      c.sum = s('g', { class: 'b2-cell b2-add__sum is-empty' }, s('rect', { x: -BX / 2, y: -BX / 2, width: BX, height: BX, rx: 7 }), txt(0, 1, '', 'b2-cell__t'));
      V.place(c.sum, { x: cx(p), y: YS });
      el.appendChild(c.sum);
      if (p >= 1) {
        c.chip = s('g', { class: 'b2-chip' + (p === 8 ? ' is-lost' : ''), opacity: 0 }, s('circle', { r: CR }), txt(0, 1, '1', 'b2-chip__t'));
        el.appendChild(c.chip); placeAt(c.chip, cx(p), YC);
      }
      cols.push(c);
    }
    var colSum = txt(0, YS + 36, '', 'b2-add__cs', { 'text-anchor': 'middle' });
    el.appendChild(colSum);
    var RX = cx(0) + BX / 2 + 10;
    var rA = txt(RX, YA + 1, '', 'b2-add__dec'), rB = txt(RX, YB + 1, '', 'b2-add__dec'), rS = txt(RX, YS + 1, '', 'b2-add__dec');
    var lineU = txt(8, H - 30, '', 'b2-add__read'), lineS = txt(8, H - 10, '', 'b2-add__read');
    [rA, rB, rS, lineU, lineS].forEach(function (t) { el.appendChild(t); });
    if (narrow) [rA, rB, rS].forEach(function (t) { t.setAttribute('display', 'none'); });
    stage.appendChild(el);
    return function render(step, ctx) {
      var d = ctx.duration, prev = ctx.prev, w = 8;
      setT(el, d);
      var single = prev && !ctx.instant && d > 0;
      var forward = single && ctx.direction > 0;
      cols.forEach(function (c) {
        var p = c.p;
        if (p < 8) {
          var ab = step.aBits[w - 1 - p], bb = step.bBits[w - 1 - p];
          c.a.querySelector('text').textContent = ab; c.a.setAttribute('class', 'b2-cell' + (ab ? ' is-on' : ''));
          c.b.querySelector('text').textContent = bb; c.b.setAttribute('class', 'b2-cell' + (bb ? ' is-on' : ''));
          var sv = step.sum[w - 1 - p];
          var was = prev ? prev.sum[w - 1 - p] : null;
          c.sum.querySelector('text').textContent = sv === null ? '' : sv;
          c.sum.setAttribute('class', 'b2-cell b2-add__sum' + (sv === null ? ' is-empty' : sv ? ' is-on' : '') + (sv !== null && step.col === p && step.phase === 'write' ? ' is-new' : ''));
          if (forward && sv !== null && was === null) { V.place(c.sum, { scale: 1.3 }); V.animate(c.sum, { scale: 1 }, { duration: d, ease: 'out' }); }
          else V.place(c.sum, { scale: 1 });
        } else {
          var lost = step.phase === 'done' && step.unsignedOverflow;
          c.sum.querySelector('text').textContent = lost ? '1' : '';
          c.sum.setAttribute('class', 'b2-cell b2-add__sum is-empty' + (lost ? ' is-lost' : ''));
        }
        if (c.chip) {
          var on = step.carries[p] === 1, wasOn = prev && prev.carries[p] === 1;
          if (on && forward && !wasOn) {
            placeAt(c.chip, cx(p - 1), YS);
            c.chip.setAttribute('opacity', 1);
            arcTo(c.chip, { x: cx(p), y: YC }, d, 18);
          } else { placeAt(c.chip, cx(p), YC); c.chip.setAttribute('opacity', on ? 1 : 0); }
        }
      });
      var col = step.col;
      if (col < 0) V.animate(band, { opacity: 0 }, { duration: d });
      else V.animate(band, { x: cx(Math.min(col, 8)), opacity: 1 }, { duration: d, ease: 'inOut' });
      band.setAttribute('class', 'b2-add__band' + (col === 8 && step.unsignedOverflow ? ' is-error' : ''));
      if (step.phase === 'sum') { colSum.textContent = 's = ' + step.colSum; colSum.setAttribute('x', cx(col)); colSum.setAttribute('opacity', 1); }
      else colSum.setAttribute('opacity', 0);
      var sa = B.toSigned(step.a, 8), sb = B.toSigned(step.b, 8);
      rA.textContent = step.a + (sa < 0 ? ' (' + fmt(sa) + ')' : '');
      rB.textContent = step.b + (sb < 0 ? ' (' + fmt(sb) + ')' : '');
      if (step.phase === 'done') {
        rS.textContent = step.result + (step.signedResult < 0 ? ' (' + fmt(step.signedResult) + ')' : '');
        if (narrow) {
          lineU.textContent = 'unsigned ' + step.a + ' + ' + step.b + ' → ' + step.result + (step.unsignedOverflow ? ' (overflow)' : ' ✓');
          lineS.textContent = 'signed ' + fmt(sa) + ' + ' + fmt(sb) + ' → ' + fmt(step.signedResult) + (step.signedOverflow ? ' (overflow)' : ' ✓');
        } else {
          lineU.textContent = 'unsigned: ' + step.a + ' + ' + step.b + ' = ' + (step.a + step.b) + (step.unsignedOverflow ? ' → keeps ' + step.result + ' (overflow)' : ' ✓');
          lineS.textContent = 'signed: ' + fmt(sa) + ' + ' + fmt(sb) + ' = ' + fmt(sa + sb) + (step.signedOverflow ? ' → reads ' + fmt(step.signedResult) + ' (overflow)' : ' ✓');
        }
        lineU.setAttribute('class', 'b2-add__read' + (step.unsignedOverflow ? ' is-bad' : ' is-good'));
        lineS.setAttribute('class', 'b2-add__read' + (step.signedOverflow ? ' is-bad' : ' is-good'));
      } else {
        rS.textContent = '';
        lineU.textContent = 'unsigned: ' + step.a + ' + ' + step.b + ' = ?';
        lineS.textContent = 'signed: ' + fmt(sa) + ' + ' + fmt(sb) + ' = ?';
        lineU.setAttribute('class', 'b2-add__read'); lineS.setAttribute('class', 'b2-add__read');
      }
    };
  }
  function parsePair(text) {
    var toks = String(text || '').split(/[\s,;+]+/).filter(Boolean);
    if (toks.length !== 2) return { values: [], error: 'Type exactly two numbers, like 200, 100.' };
    var out = [];
    for (var i = 0; i < 2; i++) {
      var t = toks[i], neg = t[0] === '-' || t[0] === '−';
      var body = neg ? t.slice(1) : t;
      var r = X.parseByte(body);
      if (r.error && !/^\d+$/.test(body)) return { values: [], error: '“' + t + '” is not a number I can read.' };
      var v = /^\d+$/.test(body) ? parseInt(body, 10) : r.values[0];
      if (neg) v = -v;
      if (!(v >= -128 && v <= 255)) return { values: [], error: 'Keep each number between −128 and 255 so it fits in one byte.' };
      out.push(v);
    }
    return { values: out, error: null };
  }
  function addLab(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Current column' }, { state: 'key', shape: 'dot', label: 'Carry' }, { state: 'default', label: '1 bit', color: 'var(--accent)' }, { state: 'error', shape: 'dot', label: 'Lost carry' }]);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: ADD_CODE, default: 'pseudo', title: 'add8', maxHeight: 260 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { carry: 'key', s: 'active', i: 'active' } });
    function addSteps(a, b) {
      return B.addSteps(a, b, 8).map(function (st) {
        var vars = {};
        Object.keys(st.vars).forEach(function (k) { var v = st.vars[k]; vars[k] = typeof v === 'string' ? V.vars.raw(v) : v; });
        return Object.assign({}, st, { vars: vars });
      });
    }
    var player = V.player({
      root: fig, steps: addSteps(200, 100), render: addView(fig.querySelector('[data-stage]')), code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { columns: 'Columns done', carries: 'Carries' }, counterStates: { carries: 'key' },
      baseStepMs: 1100, label: 'Addition controls'
    });
    player.addCheckpoint(
      function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].phase === 'write' && steps[k].colSum >= 2) return k; return -1; },
      function (c) {
        var p = c.prev, sum = p.colSum;
        return {
          question: 'Column ' + p.col + ' adds up to <b>s = ' + sum + '</b>. What gets written, and what is carried?',
          options: ['Write 0, carry 1', 'Write 1, carry 1', 'Write ' + sum + ', no carry', 'Write 1, no carry'],
          answer: sum === 2 ? 0 : 1,
          explain: sum === 2
            ? ['2 is <b>10</b> in binary: the 0 stays in this column and the 1 moves one place left.', '3 would write 1 and carry 1. This column holds 2 = 10₂, so it writes 0.', 'A column holds one bit, 0 or 1, so 2 cannot be written as it is.', 'Writing 1 without a carry would lose 1 from the total.']
            : ['That would be 2. This column holds 3 = 11₂, so it writes 1.', '3 is <b>11</b> in binary: write 1 here and carry 1 to the next column.', 'A column holds one bit, so 3 cannot be written as it is.', 'That drops 2 from the total: 3 = 2 + 1 needs a carry.']
        };
      }, { id: 'b02-add-predict' });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Two numbers (−128 to 255)', value: '200, 100', placeholder: 'e.g. 200, 100', parse: parsePair,
      presets: [
        { label: '5 + 2', value: '5, 2', title: 'No carries at all' },
        { label: '15 + 1', value: '15, 1', title: 'A carry ripples through four columns' },
        { label: '200 + 100', value: '200, 100', title: 'Unsigned overflow' },
        { label: '255 + 1', value: '255, 1', title: 'Every column carries; the answer wraps to 0' },
        { label: '100 + 50', value: '100, 50', title: 'Signed overflow without a lost carry' },
        { label: '−1 + 1', value: '-1, 1', title: 'A lost carry that is harmless for signed numbers' },
        { label: 'Random', value: function () { return Math.floor(Math.random() * 256) + ', ' + Math.floor(Math.random() * 256); } }
      ],
      hint: 'Negative numbers are stored in two’s complement.',
      onApply: function (vals) { player.setSteps(addSteps(vals[0], vals[1])); }
    });
  }

  /* ================================================================== the memory lab */
  var LAB_PRESETS = [
    { label: 'Copy and add', title: 'The program from the text', src: "int a = 5;\nint b = a;\nb = b + 1;\nchar c = 'A';" },
    { label: 'Overflow', title: 'Values that do not fit', src: 'char k = 250;\nk = k + 10;\nshort s = 32767;\ns = s + 1;' },
    { label: 'Negatives', title: "Two's complement bytes", src: 'int n = -1;\nshort t = -2;\nint m = n * 1000;' },
    { label: 'Array', title: 'arr[i] is base + i × size', src: 'int arr[4] = {10, 20, 30};\narr[3] = 99;\nint x = arr[1] + arr[3];' },
    { label: 'Text', title: 'Characters and the 0 byte', src: 'char name[6] = "Hello";\nname[0] = \'J\';\nchar c = name[1] - 32;' },
    { label: 'Pointer', title: 'A variable that holds an address', src: 'int a = 7;\nint b = 1;\nint* p = &a;\n*p = *p + 1;\np = &b;\n*p = 5;' },
    { label: 'Big number', title: 'Four bytes, and what happens past 2³¹', src: 'int big = 1000000;\nbig = big * 3000;' },
    { label: 'Leftovers', title: 'Reading memory that was never written', src: 'int x;\nint y = x + 1;' },
    { label: 'Out of bounds', title: 'An index past the end', src: 'int arr[2] = {1, 2};\nint i = 2;\narr[i] = 5;' }
  ];
  var FLOW_SPEC = {
    nodes: [
      { id: 'more', type: 'decision', text: 'Another statement?', col: 1, row: 0 },
      { id: 'done', type: 'end', text: 'Done', col: 2, row: 0 },
      { id: 'decl', type: 'decision', text: 'Declares a variable?', col: 1, row: 1 },
      { id: 'alloc', type: 'process', text: 'Reserve its bytes;\nname → address', col: 0, row: 2 },
      { id: 'addr', type: 'process', text: 'Work out the target address', col: 2, row: 2 },
      { id: 'init', type: 'decision', text: 'Starting value?', col: 0, row: 3 },
      { id: 'eval', type: 'process', text: 'Evaluate the right side (read bytes)', col: 1, row: 4 },
      { id: 'write', type: 'process', text: 'Wrap to fit the type; write the bytes', col: 1, row: 5 },
      { id: 'next', type: 'process', text: 'Next statement', col: 0, row: 5 }
    ],
    edges: [
      { from: 'more', to: 'decl', label: 'yes' },
      { from: 'more', to: 'done', label: 'no' },
      { from: 'decl', to: 'alloc', label: 'yes' },
      { from: 'decl', to: 'addr', label: 'no' },
      { from: 'alloc', to: 'init' },
      { from: 'init', to: 'eval', label: 'yes' },
      { from: 'init', to: 'next', label: 'no' },
      { from: 'addr', to: 'eval' },
      { from: 'eval', to: 'write' },
      { from: 'write', to: 'next' },
      { from: 'next', to: 'more', via: { fromSide: 'left', toSide: 'left', points: [[-0.5, 5], [-0.5, 0]] } }
    ]
  };
  function flowAdapter(view) {
    return {
      highlight: function (f, ctx) {
        f = f || {};
        var trail = f.trail || [], edgeStates = {};
        for (var i = 1; i < trail.length; i++) edgeStates[trail[i - 1] + '->' + trail[i]] = 'visited';
        var st = {};
        if (f.error && f.active) st[f.active] = 'error';
        view.render({ active: f.active || null, visited: trail.filter(function (n) { return n !== f.active; }), edgeStates: edgeStates, states: st }, { duration: ctx ? ctx.duration : 0 });
      }
    };
  }
  function memoryLab(fig) {
    var flowFig = V.$('#fig-flow');
    legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Running in the lab' }, { state: 'visited', label: 'Path so far for this line' }, { state: 'error', label: 'Stopped' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_SPEC, { label: 'What happens for each statement' });
    var flow = flowAdapter(flowView);

    legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Reserved / target' }, { state: 'compare', label: 'Being read' }, { state: 'swap', label: 'Being written' },
      { state: 'muted', label: 'Not in use (leftover bits)' }, { state: 'error', label: 'Out of bounds' }
    ]);
    var mode = 'hex', program = null, raw = [];
    var view = V.views.memory(fig.querySelector('[data-stage]'), { mode: 'ram', perRow: 8, addrDigits: 3, cellWidth: 64, label: 'The lab’s 32 bytes of memory' });
    function toView(step) {
      return {
        base: B.MEM.base, perRow: 8,
        cells: step.bytes.map(function (b, i) { return { value: b, text: mode === 'dec' ? String(b) : B.hexByte(b), state: step.states[i], bits: mode === 'bits' }; }),
        vars: step.brackets.map(function (br) { return { id: br.id, name: br.from === br.to || !br.type ? br.name : br.name + ' : ' + br.type, from: br.from, to: br.to, state: br.state }; }),
        pointers: step.pointers
      };
    }
    function decorate(steps) {
      return steps.map(function (st) {
        var vars = {}, states = {};
        st.watch.forEach(function (w) { vars[w.name] = V.vars.raw(w.value + (w.garbage ? '  (leftover)' : '') + '   @' + w.addr); });
        st.brackets.forEach(function (br) { if (br.state !== 'default') states[br.name.replace(/\[.*$/, '')] = br.state; });
        return Object.assign({}, st, { vars: vars, varStates: states });
      });
    }
    program = B.parseProgram(LAB_PRESETS[0].src).program;
    raw = B.runProgram(program);
    var steps0 = decorate(raw);
    view.prepare(steps0.map(toView));
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: B.translate(program), default: 'pseudo', maxHeight: 300 });
    var varsP = V.varsPanel(fig.querySelector('[data-vars]'), { title: 'Variables (value @ address)', empty: 'Declared variables appear here.' });
    var player = V.player({
      root: fig, steps: steps0,
      render: function (step, ctx) { view.render(toView(step), { duration: ctx.duration }); },
      code: code, vars: varsP, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { used: 'Bytes in use', read: 'Bytes read', written: 'Bytes written' }, counterStates: { read: 'compare', written: 'swap' },
      baseStepMs: 1500, animMs: 650, label: 'Memory lab controls'
    });
    function stmtOf(step) { return program && step && step.stmt !== null && step.stmt !== undefined ? program.statements[step.stmt] : null; }
    player.addCheckpoint(
      function (steps) {
        for (var k = 1; k < steps.length; k++) {
          var st = steps[k];
          if (st.kind !== 'write') continue;
          var idx = st.states.map(function (x, i) { return x === 'swap' ? i : -1; }).filter(function (i) { return i >= 0; });
          if (idx.length < 2 || idx.length > 4) continue;
          var bytes = idx.map(function (i) { return st.bytes[i]; });
          if (bytes.join() === bytes.slice().reverse().join()) continue;
          return k;
        }
        return -1;
      },
      function (c) {
        var st = c.step, idx = st.states.map(function (x, i) { return x === 'swap' ? i : -1; }).filter(function (i) { return i >= 0; });
        var le = idx.map(function (i) { return st.bytes[i]; }), old = idx.map(function (i) { return c.prev.bytes[i]; });
        var hx = function (arr) { return arr.map(B.hexByte).join(' '); };
        var opt3 = [le[0]].concat(old.slice(1));
        if (hx(opt3) === hx(le) || hx(opt3) === hx(le.slice().reverse())) opt3 = le.map(function () { return le[0]; });
        var sm = stmtOf(st), from = B.hex(B.MEM.base + idx[0], 3), to = B.hex(B.MEM.base + idx[idx.length - 1], 3);
        return {
          question: '<code>' + B.esc(sm ? sm.text : '') + '</code> is about to write ' + idx.length + ' bytes at ' + from + '–' + to + '. Reading from the lowest address up, what will they be?',
          options: ['<code>' + hx(le) + '</code>', '<code>' + hx(le.slice().reverse()) + '</code>', '<code>' + hx(opt3) + '</code>'],
          answer: 0,
          explain: ['Little-endian: the lowest byte of the value goes at the lowest address, so the bytes look reversed compared with how you write the number.',
            'That is big-endian order, the way you write the number on paper. Most computers store the lowest byte first.',
            'A multi-byte value always writes all of its bytes, lowest byte first.']
        };
      }, { id: 'b02-lab-endian' });
    player.addCheckpoint(
      function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'alloc' && steps[k].brackets.length >= 2) return k; return -1; },
      function (c) {
        var st = c.step, nb = st.brackets[st.brackets.length - 1], prevB = st.brackets[st.brackets.length - 2];
        var sm = stmtOf(st);
        var right = B.MEM.base + nb.from, first = B.MEM.base + st.brackets[0].from, plus1 = B.MEM.base + prevB.from + 1;
        var opts = [right, first, plus1].filter(function (v, i, a) { return a.indexOf(v) === i; });
        if (opts.length < 3) opts.push(right + 4);
        var name = sm ? sm.name : nb.name;
        return {
          question: '<code>' + B.esc(sm ? sm.text : '') + '</code> needs ' + (nb.to - nb.from + 1) + ' byte' + (nb.to > nb.from ? 's' : '') + '. At which address will <b>' + name + '</b> start?',
          options: opts.map(function (a) { return '<code>' + B.hex(a, 3) + '</code>'; }),
          answer: 0,
          explain: opts.map(function (a, i) {
            if (i === 0) return 'The bytes up to ' + B.hex(right - 1, 3) + ' already belong to other variables, so ' + name + ' gets the next free byte, ' + B.hex(right, 3) + '.';
            if (a === first) return B.hex(a, 3) + ' already belongs to ' + st.brackets[0].name + '. Two variables sharing bytes would overwrite each other.';
            return B.hex(a, 3) + ' is inside ' + prevB.name + ', which owns ' + B.hex(B.MEM.base + prevB.from, 3) + '–' + B.hex(B.MEM.base + prevB.to, 3) + '.';
          })
        };
      }, { id: 'b02-lab-where' });

    function load(src) {
      var r = B.parseProgram(src);
      if (r.error) { err.textContent = r.error; ta.setAttribute('aria-invalid', 'true'); return false; }
      err.textContent = ''; ta.removeAttribute('aria-invalid');
      program = r.program;
      raw = B.runProgram(program);
      code.setSource(B.translate(program));
      var steps = decorate(raw);
      view.reset(); view.prepare(steps.map(toView));
      player.setSteps(steps);
      return true;
    }
    // editor
    var ed = fig.querySelector('[data-editor]'), uid = V.uid('prog');
    var ta = h('textarea', { class: 'field lab-editor__ta', id: uid, rows: 5, spellcheck: 'false', autocomplete: 'off', 'aria-describedby': uid + '-err ' + uid + '-hint' });
    var run = h('button', { type: 'button', class: 'btn btn--primary' }, 'Run');
    var err = h('p', { class: 'input-row__error', id: uid + '-err', role: 'alert' });
    var pre = h('div', { class: 'input-row__presets', role: 'group', 'aria-label': 'Example programs' });
    LAB_PRESETS.forEach(function (p) { pre.appendChild(h('button', { type: 'button', class: 'btn btn--sm', title: p.title, onclick: function () { ta.value = p.src; load(p.src); } }, p.label)); });
    ed.appendChild(h('div', { class: 'lab-editor__main' },
      h('label', { class: 'field-label', for: uid }, 'Your program (up to 10 statements, 32 bytes of memory)'),
      h('div', { class: 'lab-editor__row' }, ta, run), err));
    ed.appendChild(pre);
    ed.appendChild(h('p', { class: 'input-row__hint', id: uid + '-hint' }, 'Types: int (4 bytes), short (2), char (1, holding 0–255). Arrays, "text", pointers with & and *, and + − * in expressions. Ctrl+Enter runs.'));
    run.addEventListener('click', function () { load(ta.value); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); load(ta.value); } });
    ta.addEventListener('input', function () { if (err.textContent) { err.textContent = ''; ta.removeAttribute('aria-invalid'); } });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Show bytes as', value: 'hex', options: [{ value: 'hex', label: 'Hex' }, { value: 'dec', label: 'Decimal' }, { value: 'bits', label: 'Hex + bits' }],
      onChange: function (v) { mode = v; var st = player.steps; view.reset(); view.prepare(st.map(toView)); player.refresh(); } });
    ta.value = LAB_PRESETS[0].src;
  }
  var labStarted = false;
  function startLab() { if (labStarted) return; labStarted = true; memoryLab(V.$("#lab-mem")); }
  X.startLab = startLab;

  /* ================================================================== cost chart: flips per +1 */
  function costFigure(fig) {
    legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Bits flipped by this +1' }, { state: 'compare', shape: 'line', label: 'Average so far' }]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Bits flipped per increment', height: 280 });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'Increments', max: 'Most in one +1', total: 'Total flips', avg: 'Average per +1' }, states: { avg: 'compare' } });
    function show(n, dur) {
      var f = B.flipCounts(n), pts = [], avg = [], tot = 0;
      f.forEach(function (c, i) { tot += c; pts.push([i + 1, c]); avg.push([i + 1, tot / (i + 1)]); });
      chart.render({
        x: { label: 'increment number (counting up from 0)', min: 1, max: n },
        y: { label: 'bits flipped', min: 0, max: Math.ceil(Math.log2(n)) + 1 },
        series: [{ id: 'flips', label: 'flips', points: pts, state: 'active', markers: n <= 32 }, { id: 'avg', label: 'average', points: avg, state: 'compare' }],
        annotations: [{ y: 2, text: '2 flips', state: 'muted', id: 'two' }]
      }, { duration: dur });
      stats.update({ n: n, max: Math.max.apply(null, f), total: tot, avg: (tot / n).toFixed(3) });
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Count up to', min: 8, max: 256, step: 8, value: 32, onInput: function (v) { show(v, 150); } });
    show(32, 0);
  }

  /* ================================================================== variations */
  function variations() {
    V.tabs('#variants');
    // byte order
    (function () {
      var host = V.$('[data-mini="endian"]'), cap = V.$('[data-mini-cap="endian"]'), btns = V.$('[data-mini-btn="endian"]');
      var view = V.views.array(host, { mode: 'boxes', showAddresses: true, baseAddress: 0x100, elementSize: 1, showIndices: false, cellSize: 52, label: 'Four bytes of 0x12345678' });
      var bytes = [{ id: 'e12', value: '12' }, { id: 'e34', value: '34' }, { id: 'e56', value: '56' }, { id: 'e78', value: '78' }];
      var little = true;
      function show(dur) {
        var items = (little ? bytes.slice().reverse() : bytes).map(function (b, i) { return { id: b.id, value: b.value, state: i === 0 ? 'active' : 'default' }; });
        view.render({ items: items }, { duration: dur });
        cap.innerHTML = little ? '<b>Little-endian</b>: 78 56 34 12, lowest byte (0x78) at the lowest address.' : '<b>Big-endian</b>: 12 34 56 78, highest byte first, as you write it.';
        toggle.textContent = little ? 'Show big-endian' : 'Show little-endian';
      }
      var toggle = h('button', { type: 'button', class: 'btn btn--sm btn--soft', onclick: function () { little = !little; show(700); } }, '');
      btns.appendChild(toggle);
      show(0);
    }());
    // shifts
    (function () {
      var host = V.$('[data-mini="shift"]'), cap = V.$('[data-mini-cap="shift"]'), btns = V.$('[data-mini-btn="shift"]');
      var view = V.views.array(host, { mode: 'boxes', showIndices: false, cellSize: 34, label: 'Eight bits being shifted' });
      var n = 0, items;
      function reset() { items = B.bitsOf(13, 8).map(function (b) { return { id: 'k' + (n++), value: b }; }); }
      reset();
      var lostOne = false;
      function val() { return B.fromBits(items.map(function (i) { return i.value; })); }
      function show(dur, what) {
        view.render({ items: items.map(function (i) { return { id: i.id, value: i.value, state: i.value ? 'active' : 'default' }; }) }, { duration: dur });
        cap.innerHTML = (what || 'Start') + ': <code>' + B.bin(val(), 8) + '</code> = <b>' + val() + '</b>' + (lostOne ? ' — a 1 fell off the end, so the value is no longer exact.' : '.');
      }
      btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--soft', onclick: function () { var old = val(); lostOne = items[0].value === 1; items = items.slice(1).concat([{ id: 'k' + (n++), value: 0 }]); show(500, old + ' &lt;&lt; 1 (× 2)'); } }, '<< 1'));
      btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--soft', onclick: function () { var old = val(); lostOne = items[7].value === 1; items = [{ id: 'k' + (n++), value: 0 }].concat(items.slice(0, 7)); show(500, old + ' &gt;&gt; 1 (÷ 2)'); } }, '>> 1'));
      btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: function () { reset(); lostOne = false; show(0); } }, 'Reset to 13'));
      show(0);
      V.codeBlock(V.$('[data-code-block="shift"]'), 'const x = 13;       // 0000 1101\nx << 1;  // 26      // 0001 1010\nx << 3;  // 104 = 13 × 8\nx >> 1;  // 6 (the 1 at the end is dropped)', 'js');
    }());
    // masks
    (function () {
      var host = V.$('[data-mini="mask"]'), cap = V.$('[data-mini-cap="mask"]'), btns = V.$('[data-mini-btn="mask"]');
      var view = V.views.array(host, { mode: 'boxes', showIndices: false, cellSize: 30, rowLabels: 'above', label: 'A flags byte, a mask and the result' });
      var flags = 0b01100101;
      function rowOf(id, v, stateFn) { return { id: id, label: id, items: B.bitsOf(v, 8).map(function (b, i) { return { id: id + i, value: b, state: stateFn ? stateFn(b, i) : (b ? 'active' : 'default') }; }) }; }
      function show(op, dur) {
        var mask = op ? op.mask : 0, res = op ? op.fn(flags, mask) : flags;
        var fb = B.bitsOf(flags, 8), rb = B.bitsOf(res, 8);
        view.render({ rows: [rowOf('flags', flags), rowOf('mask', mask, function (b) { return b ? 'key' : 'muted'; }), rowOf('result', res, function (b, i) { return op && rb[i] !== fb[i] ? 'swap' : b ? 'active' : 'default'; })] }, { duration: dur });
        cap.innerHTML = op ? op.caption(flags, mask, res) : 'Eight flags in one byte: <code>' + B.bin(flags, 8) + '</code>.';
        if (op && op.keep) flags = res;
      }
      var OPS = [
        { label: 'Test bit 2 (AND)', mask: 4, fn: function (f, m) { return f & m; }, caption: function (f, m, r) { return 'flags &amp; 0000 0100 = ' + r + (r ? ' ≠ 0, so bit 2 is <b>on</b>.' : ' = 0, so bit 2 is <b>off</b>.'); } },
        { label: 'Set bit 4 (OR)', mask: 16, keep: true, fn: function (f, m) { return f | m; }, caption: function (f, m, r) { return 'flags | 0001 0000 turns bit 4 on and leaves the rest alone: ' + r + '.'; } },
        { label: 'Clear bit 0 (AND NOT)', mask: 1, keep: true, fn: function (f, m) { return f & ~m & 255; }, caption: function (f, m, r) { return 'flags &amp; ~0000 0001 turns bit 0 off: ' + r + '.'; } },
        { label: 'Flip bit 7 (XOR)', mask: 128, keep: true, fn: function (f, m) { return f ^ m; }, caption: function (f, m, r) { return 'flags ^ 1000 0000 flips bit 7: ' + r + '.'; } }
      ];
      OPS.forEach(function (op) { btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--soft', onclick: function () { show(op, 500); } }, op.label)); });
      show(null, 0);
      V.codeBlock(V.$('[data-code-block="mask"]'), 'const CAN_READ = 1 << 2;              // 0000 0100\nif (flags & CAN_READ) { /* bit 2 is on */ }\nflags |= 1 << 4;       // set bit 4\nflags &= ~1;           // clear bit 0\nflags ^= 1 << 7;       // flip bit 7', 'js');
    }());
    // UTF-8
    (function () {
      var host = V.$('[data-mini="utf8"]'), btns = V.$('[data-mini-btn="utf8"]');
      var view = V.views.array(host, { mode: 'boxes', showIndices: false, cellSize: 60, cellAspect: 1.5, label: 'The UTF-8 bytes of one character' });
      var enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
      var cap = host.parentNode.querySelector('figcaption');
      function show(ch, dur) {
        var bytes = enc ? Array.prototype.slice.call(enc.encode(ch)) : [ch.charCodeAt(0) & 255];
        var cp = ch.codePointAt(0);
        view.render({ items: bytes.map(function (b, i) {
          var bits = B.bin(b, 8, 0), pre = i === 0 ? (bytes.length === 1 ? 1 : bytes.length + 1) : 2;
          return { id: ch + i, value: B.hexByte(b), label: bits.slice(0, pre) + '·' + bits.slice(pre), state: i === 0 ? 'active' : 'visited' };
        }) }, { duration: dur });
        cap.innerHTML = '<b>' + ch + '</b> is U+' + cp.toString(16).toUpperCase().padStart(4, '0') + ': <b>' + bytes.length + ' byte' + (bytes.length > 1 ? 's' : '') + '</b>. ' + (bytes.length === 1 ? 'A leading 0 means plain ASCII.' : 'The first byte starts with ' + bytes.length + ' ones; each byte after it starts with 10.');
      }
      ['A', 'é', '€', '😀'].forEach(function (c) { btns.appendChild(h('button', { type: 'button', class: 'btn btn--sm btn--soft', onclick: function () { show(c, 500); } }, c)); });
      show('é', 0);
    }());
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-signed', {
      question: 'A byte holds <code>1111 1111</code>. What is it read as <b>unsigned</b>, and as <b>signed</b> (two’s complement)?',
      options: ['255 and −1', '255 and −127', '127 and −128', '256 and −0'],
      answer: 0,
      explain: [
        'All eight places add to 128 + 64 + … + 1 = 255. As signed, the top bit is on, so it is 255 − 256 = −1: one step before 0 on the wheel.',
        '−127 would be <code>1000 0001</code>. Two’s complement is not “sign bit plus magnitude”.',
        '127 is <code>0111 1111</code> and −128 is <code>1000 0000</code>, the two ends of the signed range.',
        'A byte cannot hold 256 (that needs a ninth bit), and two’s complement has only one zero.'
      ],
      id: 'b02-signed'
    });
    V.quiz('#quiz-bits10', {
      question: 'A sensor reports whole numbers from 0 to 1,000. What is the <b>fewest</b> bits that can store every reading?',
      options: ['8 bits', '9 bits', '10 bits', '1,000 bits'],
      answer: 2,
      explain: [
        '8 bits give 2⁸ = 256 patterns: not enough for 1,001 different readings.',
        '9 bits give 2⁹ = 512 patterns, still short of 1,001.',
        '10 bits give 2¹⁰ = 1,024 patterns, enough for all 1,001 readings (0 to 1,000). 9 bits would give only 512.',
        'Each bit doubles the count, so you need about log₂ 1,001 ≈ 10 bits, not one per value.'
      ],
      id: 'b02-bits10'
    });
    V.quiz('#quiz-overflow', {
      question: 'An 8-bit <b>unsigned</b> counter holds 250. The program adds 10. What does the byte hold now?',
      options: ['260', '4', '255: it stops at the top', '−6'],
      answer: 1,
      explain: [
        '260 needs a ninth bit, which the byte does not have.',
        '250 + 10 = 260, and a byte keeps only the low 8 bits: 260 − 256 = 4. That is unsigned overflow.',
        'Plain integer addition does not stop at the top: it wraps. (Some special “saturating” instructions do stop, but ordinary + does not.)',
        'The counter is unsigned, so the byte is read as 0 to 255. The bits are 0000 0100 = 4.'
      ],
      id: 'b02-overflow'
    });
    // click the first byte of arr[3]
    var fig = V.$('#fig-click');
    legend(fig.querySelector('[data-legend]'), [{ state: 'default', shape: 'outline', label: 'One byte' }]);
    var stage = fig.querySelector('[data-stage]');
    var bytes = [3, 0, 0, 0, 8, 0, 0, 0, 1, 0, 0, 0, 9, 0, 0, 0, 42, 0, 0, 0];
    var view = V.views.memory(stage, { mode: 'ram', perRow: 8, addrDigits: 3, addressMode: 'cell', label: 'Twenty bytes; the first sixteen are arr', format: function (v) { return B.hexByte(v); } });
    var st = { base: 0x100, cells: bytes, vars: [{ name: 'arr : int[4]', from: 0, to: 15 }, { name: 'n : int', from: 16, to: 19 }] };
    view.prepare([st]); view.render(st, { duration: 0 });
    view.el.setAttribute('role', 'group');
    V.$$('.vz-mem-cell', view.el).forEach(function (g, i) { g.setAttribute('data-id', String(i)); g.setAttribute('data-label', 'Byte at ' + B.hex(0x100 + i, 3)); });
    V.clickQuiz(stage, {
      el: '#quiz-click', id: 'b02-click-arr3',
      question: '<code>arr</code> is an array of 4-byte ints starting at <code>0x100</code>. Click the <b>first byte of <code>arr[3]</code></b>.',
      check: function (id) {
        var i = +id;
        if (i === 12) return { correct: true, message: 'arr[3] starts at 0x100 + 3 × 4 = 0x10C. Index 3 skips three whole elements of 4 bytes each.' };
        if (i === 3) return { correct: false, message: '0x103 is the last byte of arr[0]. An index counts elements, not bytes: multiply it by the element size.' };
        if (i > 12 && i < 16) return { correct: false, message: 'That byte is inside arr[3], but not its first byte.' };
        if (i % 4 === 0 && i < 12) return { correct: false, message: 'That is the start of arr[' + (i / 4) + ']. arr[3] is ' + (3 - i / 4) + ' element' + (3 - i / 4 > 1 ? 's' : '') + ' further on.' };
        if (i >= 16) return { correct: false, message: 'That byte belongs to n, past the end of arr (0x100–0x10F).' };
        return { correct: false, message: 'arr[3] starts 3 × 4 = 12 bytes after 0x100.' };
      }
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    function tile(viz, label, text) {
      grid.appendChild(h('div', { class: 'summary__item' }, h('div', { class: 'summary__viz stage-grid' }, viz), h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text', html: text })));
    }
    tile(X.bitCells([0, 1, 0, 0, 0, 0, 0, 1], { size: 16, gap: 3, labels: ['128', '64', '32', '16', '8', '4', '2', '1'], scale: 1.1 }), 'Place value', 'A byte is 8 switches worth 128 … 1. <code>0100 0001</code> = 64 + 1 = 65.');
    var hx = svg(170, 60, 'b2-mini', '0010 1010 is 2A in hex');
    hx.appendChild(txt(44, 24, '0010', 'b2-sum__bits', { 'text-anchor': 'middle' })); hx.appendChild(txt(126, 24, '1010', 'b2-sum__bits', { 'text-anchor': 'middle' }));
    hx.appendChild(txt(44, 52, '2', 'b2-sum__hex', { 'text-anchor': 'middle' })); hx.appendChild(txt(126, 52, 'A', 'b2-sum__hex', { 'text-anchor': 'middle' }));
    tile(hx, 'n bits, 2ⁿ patterns', 'Each bit doubles the count. Hex writes 4 bits as one digit: a byte is 2 digits.');
    var mn = svg(180, 60, 'b2-mini', 'The byte 41 read as 65, as A, or as grey');
    mn.appendChild(s('g', { class: 'b2-cell', transform: 'translate(8 16)' }, s('rect', { width: 34, height: 30, rx: 6 }), txt(17, 16, '41', 'b2-cell__t')));
    ['65', "'A'", '▇'].forEach(function (t, i) { mn.appendChild(txt(80 + i * 36, 36, t, 'b2-sum__read' + (i === 2 ? ' is-grey' : ''), { 'text-anchor': 'middle' })); });
    mn.appendChild(s('path', { d: 'M46 31 H60', class: 'b2-sum__arrow' }));
    tile(mn, 'Meaning is agreed', 'The same bits are a number, a letter or a colour. The type says which.');
    var wh = svg(170, 72, 'b2-mini', 'A number wheel: the right half holds 0 to 127, the left half −128 to −1');
    wh.appendChild(s('circle', { cx: 85, cy: 36, r: 26, class: 'b2-sum__ring' }));
    wh.appendChild(s('path', { d: 'M85 10 A26 26 0 0 0 85 62', class: 'b2-sum__neg' }));
    wh.appendChild(txt(85, 5, '0', 'b2-sum__wt', { 'text-anchor': 'middle' }));
    wh.appendChild(txt(120, 36, '0…127', 'b2-sum__wt', { 'text-anchor': 'start' }));
    wh.appendChild(txt(50, 36, '−128…−1', 'b2-sum__wt', { 'text-anchor': 'end' }));
    tile(wh, 'Two’s complement', 'Top bit = negative. A byte holds −128 to 127; <code>1111 1111</code> is −1.');
    var ov = svg(170, 60, 'b2-mini', '255 plus 1 wraps to 0');
    ov.appendChild(txt(85, 26, '1111 1111 + 1', 'b2-sum__bits', { 'text-anchor': 'middle' }));
    ov.appendChild(txt(85, 50, '= 0000 0000', 'b2-sum__bits is-bad', { 'text-anchor': 'middle' }));
    tile(ov, 'Fixed width wraps', 'A carry out of the top bit is lost: 255 + 1 = 0. That is overflow.');
    var mem = svg(180, 64, 'b2-mini', 'A variable a over four bytes starting at 0x100');
    for (var i = 0; i < 5; i++) mem.appendChild(s('g', { class: 'b2-cell' + (i < 4 ? '' : ' is-muted'), transform: 'translate(' + (6 + i * 34) + ' 24)' }, s('rect', { width: 30, height: 26, rx: 5 }), txt(15, 14, i ? '00' : '05', 'b2-cell__t')));
    mem.appendChild(s('path', { d: 'M8 18 V12 H138 V18', class: 'b2-sum__br' }));
    mem.appendChild(txt(73, 9, 'a : int @ 0x100', 'b2-sum__brt', { 'text-anchor': 'middle' }));
    tile(mem, 'Variables name addresses', '<code>arr[i]</code> lives at base + i × size, found in <span class="nowrap">O(1)</span> steps.');
  }

  /* ================================================================== start */
  V.ready(function () {
    lazy('#lab-add', addLab);
    lazy('#lab-mem', startLab);
    lazy('#fig-flow', startLab);
    lazy('#fig-cost', costFigure);
    lazy('#variants', variations);
    checks();
    summaryCard();
  });
}());
