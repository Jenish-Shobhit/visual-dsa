/* Lesson 03 · Decisions & loops — the code-synced labs (VDSA.lessons.cf):
   loop tracer, off-by-one fence lab, infinite-loop fuel gauge, nested-loop grid, break / continue, FizzBuzz.
   Every lab drives its flowchart, code panel, variable watch and counters from one pure trace (js/algos/03-control-flow.js). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var A = V.algos.lesson03;
  var CF = V.lessons.cf;
  var num = A.num;
  var S = CF.specs;

  function numField(label, value, min, max, onChange) {
    var input = h('input', { type: 'number', class: 'field cf-num', value: value, min: min, max: max, step: 1, inputmode: 'numeric', 'aria-label': label });
    input.addEventListener('change', onChange);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); onChange(); } });
    return { el: h('label', { class: 'cf-field' }, h('span', { class: 'cf-field__l' }, label), input), input: input };
  }

  /* ================================================================== 1. the loop tracer */
  CF.loopLab = function (fig) {
    var spec = { from: 1, to: 5, step: 1, body: 'sum' };
    var bar = fig.querySelector('[data-input]');
    var fFrom = numField('from', 1, -20, 30, apply), fTo = numField('to', 5, -20, 30, apply), fStep = numField('step', 1, -5, 5, apply);
    var err = h('p', { class: 'cf-err', role: 'alert' });
    var bodySeg;
    var presets = [
      { label: '1 to 5', v: { from: 1, to: 5, step: 1, body: 'sum' } },
      { label: 'Countdown 5 to 1', v: { from: 5, to: 1, step: -1, body: 'sum' } },
      { label: 'Even numbers', v: { from: 2, to: 10, step: 2, body: 'sum' } },
      { label: 'Count 0 to 4', v: { from: 0, to: 4, step: 1, body: 'count' } },
      { label: 'Negative to positive', v: { from: -3, to: 3, step: 1, body: 'sum' } },
      { label: 'Never runs', v: { from: 5, to: 1, step: 1, body: 'sum' } }
    ];
    var pre = h('div', { class: 'cf-presets', role: 'group', 'aria-label': 'Example loops' }, presets.map(function (p) {
      return h('button', { type: 'button', class: 'btn btn--soft btn--sm', onclick: function () { load(p.v); } }, p.label);
    }));
    bar.appendChild(h('div', { class: 'cf-toolbar' }, fFrom.el, fTo.el, fStep.el, h('div', { class: 'cf-toolbar__seg', 'data-bodyseg': '' }), pre, err));
    bodySeg = V.segmented(bar.querySelector('[data-bodyseg]'), { label: 'Loop body', value: 'sum', options: [{ value: 'sum', label: 'total += i' }, { value: 'count', label: 'count += 1' }],
      onChange: function () { apply(); } });

    var flowView = V.views.flowchart(fig.querySelector('[data-flow]'), S.loop(spec), { label: 'The loop as a flowchart' });
    var flow = CF.flowLink(flowView);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: A.loopCode(spec), default: 'pseudo', maxHeight: 250 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'compare', total: 'key', count: 'key' } });
    CF.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Token: step running now' }, { state: 'compare', label: 'i (loop variable)' }, { state: 'key', label: 'total / count' }, { state: 'done', label: 'Body ran' }]);

    var tbody = fig.querySelector('[data-rows]'), accHead = fig.querySelector('[data-acchead]'), trips = fig.querySelector('[data-trips]');
    var rowEls = {}, chipEls = {}, finalChip = null;
    function cmpText(r) { return num(r.i) + ' ' + (spec.step > 0 ? '≤' : '≥') + ' ' + num(spec.to); }
    function render(step, ctx) {
      var n = step.rows.length;
      // rows
      Object.keys(rowEls).forEach(function (id) { if (!step.rows.some(function (r) { return r.id === id; })) { rowEls[id].el.remove(); delete rowEls[id]; } });
      step.rows.forEach(function (r, k) {
        var re = rowEls[r.id];
        if (!re) {
          var cells = [h('td', { class: 'num' }, k + 1), h('td', { class: 'num cf-i' }, num(r.i)), h('td', { class: 'cf-test' }), h('td', { class: 'num cf-acc' })];
          var tr = h('tr', { class: ctx.duration ? 'is-new' : '' }, cells);
          tbody.appendChild(tr);
          re = rowEls[r.id] = { el: tr, test: cells[2], acc: cells[3], last: undefined };
        }
        re.test.innerHTML = '<code>' + cmpText(r).replace('≤', '&le;').replace('≥', '&ge;') + '</code> <span class="cf-tv ' + (r.test ? 'is-t' : 'is-f') + '">' + (r.test ? 'yes' : 'no') + '</span>';
        var txt = r.acc === null ? (r.test ? '' : '—') : num(r.acc);
        if (re.last !== txt) { re.acc.textContent = txt; if (re.last !== undefined && ctx.duration) { re.acc.classList.remove('is-bump'); void re.acc.offsetWidth; re.acc.classList.add('is-bump'); } re.last = txt; }
        re.el.classList.toggle('is-current', r.id === step.row);
        re.el.classList.toggle('is-stop', !r.test);
      });
      if (n && step.row) { var cur = rowEls[step.row]; if (cur && cur.el.scrollIntoView && ctx.duration) { /* keep the table scrolled to the latest row inside its box */ var box = tbody.closest('.cf-tt-wrap'); if (box) box.scrollTop = box.scrollHeight; } }
      accHead.textContent = step.accName;
      // chips: one per body run
      Object.keys(chipEls).forEach(function (id) { if (!step.cols.some(function (c) { return c.id === id; })) { chipEls[id].remove(); delete chipEls[id]; } });
      step.cols.forEach(function (c) {
        if (!chipEls[c.id]) {
          var el = h('span', { class: 'cf-tchip' + (ctx.duration ? ' is-new' : '') }, spec.body === 'count' ? '+1' : (c.add < 0 ? '−' + Math.abs(c.add) : '+' + c.add));
          el.setAttribute('title', 'Body run ' + c.id.slice(1) + ' added ' + c.add);
          chipEls[c.id] = el; trips.insertBefore(el, finalChip);
        }
      });
      if (finalChip) {
        finalChip.textContent = '= ' + num(step.acc);
        finalChip.classList.toggle('is-off', step.kind !== 'done');
      }
      trips.setAttribute('aria-label', step.cols.length ? 'Body runs so far: ' + step.cols.length : 'The body has not run yet');
      trips.classList.toggle('is-empty', !step.cols.length && step.kind !== 'done');
    }
    finalChip = h('span', { class: 'cf-tchip cf-tchip--total is-off' }, '');
    trips.appendChild(finalChip);
    trips.appendChild(h('span', { class: 'cf-trips__none' }, 'the body has not run yet'));

    var player = V.player({ root: fig, steps: A.loopTrace(spec), render: render, code: code, vars: vars, flow: flow, caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'), counterLabels: { tests: 'Tests of i', runs: 'Body runs' }, counterStates: { tests: 'compare', runs: 'done' },
      baseStepMs: 1200, label: 'Loop tracer controls' });

    /* Predict: the second time the body runs, what does the accumulator become? And: what will the last test say? */
    player.addCheckpoint(function (steps) {
      var seen = 0;
      for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'body' && ++seen === 2) return k;
      return -1;
    }, function (c) {
      var p = c.prev, i = p.i, before = p.acc, nm = p.accName;
      var right = spec.body === 'count' ? before + 1 : before + i;
      var opts = [{ t: nm + ' becomes ' + num(right), v: right }];
      [before + (spec.body === 'count' ? i : 1), before, i].forEach(function (v) { if (!opts.some(function (o) { return o.v === v; })) opts.push({ t: nm + ' becomes ' + num(v), v: v }); });
      opts = opts.slice(0, 3);
      return { question: 'The test just said yes with <code>i = ' + num(i) + '</code> and <code>' + nm + ' = ' + num(before) + '</code>. What does the body do?',
        options: opts.map(function (o) { return o.t; }), answer: 0,
        explain: [spec.body === 'count' ? 'The body adds one to count, whatever i is: count now holds how many trips have run.' : 'The body adds the current i to the total: ' + num(before) + ' + ' + num(i) + ' = ' + num(right) + '.'].concat(opts.slice(1).map(function (o) {
          return o.v === before ? 'The body always changes the accumulator; if it did not, the total could never grow.' : spec.body === 'count' ? 'This body adds exactly 1 each trip, not i.' : 'The body adds i (' + num(i) + '), not 1 and not the old total again.';
        })) };
    }, { id: 'loop-predict-body' });

    function read() {
      return { from: +fFrom.input.value, to: +fTo.input.value, step: +fStep.input.value, body: bodySeg.value };
    }
    function apply() {
      var sp = read(), msg = A.validateLoop(sp);
      if (fFrom.input.value === '' || fTo.input.value === '' || fStep.input.value === '') msg = 'Fill in all three numbers.';
      err.textContent = msg || '';
      [fFrom, fTo, fStep].forEach(function (f) { f.input.setAttribute('aria-invalid', msg ? 'true' : 'false'); });
      if (msg) return;
      spec = sp;
      flowView.setSpec(S.loop(spec));
      code.setSource(A.loopCode(spec));
      for (var id in rowEls) rowEls[id].el.remove();
      rowEls = {};
      Object.keys(chipEls).forEach(function (k) { chipEls[k].remove(); }); chipEls = {};
      player.setSteps(A.loopTrace(spec));
    }
    function load(sp) {
      fFrom.input.value = sp.from; fTo.input.value = sp.to; fStep.input.value = sp.step; bodySeg.set(sp.body);
      apply();
    }
    return player;
  };

  /* ================================================================== 2. off-by-one on a row of boxes */
  var LETTERS = 'ABCDEFGH';
  function fenceCode(n, start, cmp) {
    var stop = cmp === '<=' ? n + 1 : n;
    return {
      pseudo: ['for i ← ' + start + ' to ' + (cmp === '<=' ? 'n' : 'n − 1') + '          // @loop', '  read a[i]                // @body'].join('\n'),
      js: ['for (let i = ' + start + '; i ' + cmp + ' n; i++) {   // @loop', '  read(a[i]);                        // @body', '}'].join('\n'),
      py: ['for i in range(' + start + ', ' + (cmp === '<=' ? 'n + 1' : 'n') + '):      # @loop', '    read(a[i])                     # @body'].join('\n')
    };
  }
  CF.fenceLab = function (fig) {
    var n = 5, start = 0, cmp = '<';
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', label: 'Row of boxes a[0] to a[n − 1] read by a loop', emptyText: 'no boxes', cellSize: 64 });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: fenceCode(n, start, cmp), default: 'js', maxHeight: 200 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'compare', n: 'default' } });
    CF.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Read now' }, { state: 'visited', label: 'Read' }, { state: 'error', label: 'Out of bounds or never read' }, { state: 'compare', shape: 'dot', label: 'i' }]);
    function decorate(steps) {
      return steps.map(function (st) {
        return Object.assign({}, st, { line: st.kind === 'visit' ? 'body' : 'loop', vars: { i: st.i, n: st.n } });
      });
    }
    function toView(step) {
      var items = [];
      for (var k = 0; k < step.n; k++) {
        var st = 'default';
        if (step.kind === 'exit' && step.missed.indexOf(k) >= 0) st = 'error';
        else if (step.current === k) st = 'active';
        else if (step.reads.indexOf(k) >= 0) st = 'visited';
        items.push({ id: 'a' + k, value: LETTERS[k], index: k, state: st });
      }
      if (step.oob) items.push({ id: 'oob', value: '?', index: step.n, state: 'error', label: 'undefined' });
      var ptr = step.kind === 'exit' && step.i > step.n ? null : Math.min(step.i, step.n);
      return { items: items, pointers: [{ name: 'i', index: ptr, state: 'compare' }], indexLabels: undefined };
    }
    var lastSteps = null;
    function make() {
      var steps = decorate(A.fenceTrace(n, start, cmp));
      lastSteps = steps;
      return steps;
    }
    var player = V.player({ root: fig, steps: make(), render: function (st, ctx) { view.render(toView(st), { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { runs: 'Body runs', outOfBounds: 'Out-of-bounds reads', missed: 'Boxes never read' }, counterStates: { outOfBounds: 'error', missed: 'error', runs: 'active' },
      baseStepMs: 900, label: 'Off-by-one controls' });
    view.prepare(player.steps.map(toView));
    function reload() {
      code.setSource(fenceCode(n, start, cmp));
      var steps = make();
      view.reset(); view.prepare(steps.map(toView));
      player.setSteps(steps);
    }
    V.segmented(fig.querySelector('[data-start]'), { label: 'i starts at', value: '0', options: [{ value: '0', label: 'i = 0' }, { value: '1', label: 'i = 1' }], onChange: function (v) { start = +v; reload(); } });
    V.segmented(fig.querySelector('[data-cmp]'), { label: 'Loop while', value: '<', options: [{ value: '<', label: 'i < n' }, { value: '<=', label: 'i <= n' }], onChange: function (v) { cmp = v; reload(); } });
    V.slider(fig.querySelector('[data-n]'), { label: 'n (boxes)', min: 3, max: 8, value: n, onChange: function (v) { n = v; reload(); } });
    player.addCheckpoint(function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'exit') return k; return -1; },
      function (c) {
        var p = c.prev;
        return { question: 'The loop has read ' + p.counters.runs + ' times so far, for ' + p.n + ' boxes. Is the loop finished?',
          options: ['Yes, the test will now be false', 'No, it will read once more'], answer: c.steps[c.index].kind === 'exit' ? 0 : 1,
          explain: ['i is now ' + p.i + ' and the test is <code>i ' + (cmp === '<=' ? '&lt;=' : '&lt;') + ' ' + p.n + '</code>: ' + p.i + ' is past the limit, so the token leaves the loop.', 'The last test is already false at i = ' + p.i + ', so there is no more reading.'] };
      }, { id: 'fence-predict-exit' });
    return player;
  };

  /* ================================================================== 3. the fuel gauge: infinite loops */
  var FUEL_UPDATES = [{ value: '+1', label: 'i = i + 1' }, { value: '+2', label: 'i = i + 2' }, { value: '-1', label: 'i = i − 1' }, { value: 'same', label: 'i = i' }, { value: '*2', label: 'i = i * 2' }];
  CF.fuelLab = function (fig) {
    var cond = '!=', upd = '+1', TARGET = 10, START = 1, FUEL = 20;
    var W = 560, H = 268, CELL = 18, GX = 56, BASE = 246, BW = 17, BX = 22, UNIT = 13, CAPD = 11;
    var svg = s('svg', { class: 'vz cf-svg cf-fuel', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Fuel gauge and distance-to-exit bars for a while loop' });
    svg.style.maxWidth = '720px';
    svg.appendChild(s('text', { class: 'vz-caption', x: 4, y: 24 }, 'FUEL'));
    var cells = [];
    for (var k = 0; k < FUEL; k++) {
      var c = s('rect', { class: 'cf-cell', x: GX + k * (CELL + 2), y: 10, width: CELL, height: 22, rx: 4 });
      svg.appendChild(c); cells.push(c);
    }
    var fuelTxt = s('text', { class: 'cf-total', x: W - 4, y: 26, 'text-anchor': 'end' }, '');
    svg.appendChild(fuelTxt);
    svg.appendChild(s('text', { class: 'vz-caption', x: 4, y: 72 }, 'DISTANCE FROM i TO THE EXIT, AFTER EACH TRIP'));
    svg.appendChild(s('line', { class: 'cf-axis', x1: BX - 6, x2: W - 6, y1: BASE, y2: BASE }));
    var exitLbl = s('text', { class: 'vz-label', x: W - 6, y: BASE + 14, 'text-anchor': 'end' }, 'exit: distance 0');
    svg.appendChild(exitLbl);
    var bars = [];
    for (var b = 0; b <= FUEL; b++) {
      var x = BX + b * (BW + 9.6);
      var g = s('g', { class: 'is-default', opacity: 0 }, s('rect', { class: 'cf-bar', x: x, y: BASE, width: BW, height: 0, rx: 3 }), s('text', { class: 'cf-barv', x: x + BW / 2, y: BASE - 4, 'text-anchor': 'middle' }, ''));
      svg.appendChild(g); bars.push({ g: g, r: g.firstChild, t: g.lastChild, x: x });
    }
    fig.querySelector('[data-stage]').appendChild(svg);
    var verdict = fig.querySelector('[data-verdict]');
    var pre = fig.querySelector('[data-loopcode]');
    function dist(i) { return cond === '<' ? TARGET - i : Math.abs(TARGET - i); }
    function src() {
      var u = A.UPDATES[upd].text;
      V.codeBlock(pre, 'let i = ' + START + ';\nwhile (i ' + cond + ' ' + TARGET + ') {\n  ' + u + ';\n}', 'js');
    }
    function render(step, ctx) {
      var d = ctx.duration;
      svg.style.setProperty('--vz-dur', d + 'ms');
      var burnt = step.fuelMax - step.fuel;
      cells.forEach(function (c, i) {
        var cls = 'cf-cell' + (i < burnt ? ' is-burnt' : step.fuel <= 5 ? (step.fuel === 0 ? ' is-empty' : ' is-low') : '');
        c.setAttribute('class', cls);
      });
      fuelTxt.textContent = step.fuel + ' / ' + step.fuelMax;
      var hops = step.hops;
      bars.forEach(function (bar, k) {
        var on = k < hops.length;
        if (!on) { bar.g.setAttribute('opacity', 0); V.animate(bar.r, { attr: { y: BASE, height: 0 } }, { duration: d }); return; }
        var dv = dist(hops[k]), prev = k ? dist(hops[k - 1]) : null;
        var hgt = Math.min(dv, CAPD) * UNIT;
        var st = k === 0 ? 'active' : dv < prev ? 'frontier' : dv === prev ? 'compare' : 'error';
        if (dv <= 0 && k) st = 'found';
        bar.g.setAttribute('class', 'vz-item is-' + st);
        bar.g.setAttribute('opacity', 1);
        V.animate(bar.r, { attr: { y: BASE - hgt, height: Math.max(hgt, dv <= 0 ? 3 : 0) } }, { duration: d, ease: 'out' });
        bar.t.textContent = dv > 99 ? '↑' : (dv > CAPD ? dv + '↑' : dv);
        V.animate(bar.t, { attr: { y: BASE - Math.max(hgt, 3) - 4 } }, { duration: d, ease: 'out' });
      });
      var last = step.kind;
      verdict.className = 'cf-verdict' + (last === 'exit' ? ' is-good' : last === 'empty' ? ' is-bad' : '');
      verdict.innerHTML = last === 'exit' ? '<b>Stops.</b> The test turned false after ' + step.trips + ' trips.'
        : last === 'empty' ? '<b>Never stops.</b> The tank ran dry after ' + step.trips + ' trips and the test is still true.' : 'Running: the loop is using fuel…';
    }
    var player;
    function make() { return A.fuelTrace(cond, upd, { start: START, target: TARGET, fuel: FUEL }); }
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'compare' } });
    CF.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'Closer to the exit' }, { state: 'compare', label: 'No progress' }, { state: 'error', label: 'Further away' }, { state: 'found', label: 'Exit reached' }]);
    player = V.player({ root: fig, steps: make(), render: render, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { trips: 'Trips', fuel: 'Fuel left' }, counterStates: { trips: 'active', fuel: 'compare' }, baseStepMs: 520, label: 'Fuel gauge controls' });
    src();
    function reload(play) { src(); player.setSteps(make()); if (play) player.play(); }
    V.segmented(fig.querySelector('[data-cond]'), { label: 'Loop while', value: cond, options: [{ value: '!=', label: 'i != 10' }, { value: '<', label: 'i < 10' }], onChange: function (v) { cond = v; reload(true); } });
    V.segmented(fig.querySelector('[data-upd]'), { label: 'The update line', value: upd, options: FUEL_UPDATES, onChange: function (v) { upd = v; reload(true); } });
    return player;
  };

  /* ================================================================== 4. nested loops as a grid */
  function nestedCode(shape) {
    var tri = shape === 'tri';
    return {
      pseudo: ['for i ← 0 to n − 1                    // @outer', '  for j ← ' + (tri ? 'i + 1' : '0') + ' to ' + (tri ? 'n − 1' : 'm − 1') + '               // @inner', '    visit(i, j)                       // @body', 'print visits                          // @done'].join('\n'),
      js: ['for (let i = 0; i < n; i++) {                 // @outer', '  for (let j = ' + (tri ? 'i + 1' : '0') + '; j < ' + (tri ? 'n' : 'm') + '; j++) {       // @inner', '    visit(i, j);                              // @body', '  }', '}', 'console.log(visits);                        // @done'].join('\n'),
      py: ['for i in range(n):                        # @outer', '    for j in range(' + (tri ? 'i + 1, n' : 'm') + '):' + (tri ? '             ' : '                ') + '# @inner', '        visit(i, j)                       # @body', 'print(visits)                             # @done'].join('\n')
    };
  }
  CF.nestedLab = function (fig) {
    var n = 4, m = 5, shape = 'rect';
    var view = V.views.grid(fig.querySelector('[data-stage]'), { mode: 'table', label: 'Grid of (i, j) pairs visited by nested loops', cellSize: 52 });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: nestedCode(shape), default: 'js', maxHeight: 230 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'active', j: 'compare' } });
    CF.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Cell being visited' }, { state: 'visited', label: 'Visited (number = visit order)' }, { state: 'muted', label: 'Never visited' }]);
    var formula = fig.querySelector('[data-formula]');
    function nv(x) { return x === null ? V.vars.raw('—') : x; }
    function decorate(steps) { return steps.map(function (st) { return Object.assign({}, st, { vars: { i: nv(st.i), j: nv(st.j) } }); }); }
    function toView(st) {
      var cells = {};
      if (st.shape === 'tri') for (var r = 0; r < st.n; r++) for (var c = 0; c <= r; c++) cells[r + ',' + c] = { state: 'muted' };
      st.visited.forEach(function (key, idx) { cells[key] = { value: idx + 1, state: key === st.current ? 'active' : 'visited' }; });
      var cur = st.current ? st.current.split(',').map(Number) : null;
      return { rows: st.n, cols: st.m, cells: cells, rowHeaders: true, colHeaders: true, corner: 'i \\ j',
        highlightRow: st.i !== null ? { index: st.i, state: 'active' } : undefined, highlightCol: st.j !== null ? { index: st.j, state: 'compare' } : undefined,
        cursor: cur ? { cell: cur, state: 'active' } : undefined };
    }
    function showFormula() {
      var total = A.nestedCount(n, m, shape);
      formula.innerHTML = shape === 'rect'
        ? '<span class="cf-f__k">Inner body runs</span> <b>n × m</b> = ' + n + ' × ' + m + ' = <b class="cf-f__v">' + total + '</b>'
        : '<span class="cf-f__k">Inner body runs</span> <b>n(n − 1) / 2</b> = ' + n + ' × ' + (n - 1) + ' / 2 = <b class="cf-f__v">' + total + '</b>';
    }
    function make() { return decorate(A.nestedTrace(n, m, shape)); }
    var player = V.player({ root: fig, steps: make(), render: function (st, ctx) { view.render(toView(st), { duration: ctx.duration }); },
      code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { visits: 'Visits' }, counterStates: { visits: 'done' },
      baseStepMs: 520, label: 'Nested loop controls' });
    function reload() { code.setSource(nestedCode(shape)); showFormula(); var st = make(); view.reset(); player.setSteps(st); }
    var mSlider;
    V.slider(fig.querySelector('[data-n]'), { label: 'n (rows)', min: 1, max: 8, value: n, onChange: function (v) { n = v; reload(); } });
    mSlider = V.slider(fig.querySelector('[data-m]'), { label: 'm (columns)', min: 1, max: 8, value: m, onChange: function (v) { m = v; reload(); } });
    V.segmented(fig.querySelector('[data-shape]'), { label: 'Inner loop starts at', value: 'rect', options: [{ value: 'rect', label: 'j = 0 (rectangle)' }, { value: 'tri', label: 'j = i + 1 (triangle)' }],
      onChange: function (v) { shape = v; mSlider.input.disabled = v === 'tri'; fig.classList.toggle('is-tri', v === 'tri'); reload(); } });
    showFormula();
    return player;
  };

  /* ================================================================== 5. break and continue */
  function breakCode(mode) {
    if (mode === 'continue') return {
      pseudo: ['total ← 0', 'for each x in a                 // @loop', '  if x < 0 then                 // @test', '    continue                    // @jump', '  total ← total + x             // @act', 'print total                     // @done'].join('\n'),
      js: ['let total = 0;', 'for (const x of a) {            // @loop', '  if (x < 0) {                 // @test', '    continue;                  // @jump', '  }', '  total = total + x;           // @act', '}', 'console.log(total);            // @done'].join('\n'),
      py: ['total = 0', 'for x in a:                    # @loop', '    if x < 0:                  # @test', '        continue               # @jump', '    total = total + x          # @act', 'print(total)                   # @done'].join('\n')
    };
    return {
      pseudo: ['found ← none', 'for each x in a                 // @loop', '  if x < 0 then                 // @test', '    found ← x                   // @act', '    break                       // @jump', 'print found                     // @done'].join('\n'),
      js: ['let found = null;', 'for (const x of a) {            // @loop', '  if (x < 0) {                 // @test', '    found = x;                 // @act', '    break;                     // @jump', '  }', '}', 'console.log(found);            // @done'].join('\n'),
      py: ['found = None', 'for x in a:                    # @loop', '    if x < 0:                  # @test', '        found = x              # @act', '        break                  # @jump', 'print(found)                   # @done'].join('\n')
    };
  }
  CF.breakLab = function (fig) {
    var mode = 'break', values = [4, 7, -2, 9, 5, -6];
    var view = V.views.array(fig.querySelector('[data-stage]'), { mode: 'boxes', label: 'Numbers scanned by a loop with break or continue', emptyText: 'an empty list' });
    var flowView = V.views.flowchart(fig.querySelector('[data-flow]'), S.breakMode(mode), { label: 'Break and continue flowchart' });
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: breakCode(mode), default: 'js', maxHeight: 240 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { x: 'active', found: 'found', total: 'done' } });
    var stateKey = { default: 'default' };
    function toView(st) {
      var items = st.values.map(function (v, k) { return { id: 'x' + k, value: v, index: k, state: st.states[k] }; });
      return { items: items, pointers: [{ name: 'x', index: st.k !== null && st.k < st.values.length ? st.k : null, state: 'active' }] };
    }
    function make() { return A.breakContinueTrace(values, mode); }
    var player = V.player({ root: fig, steps: make(), render: function (st, ctx) { view.render(toView(st), { duration: ctx.duration }); },
      code: code, vars: vars, flow: CF.flowLink(flowView), caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { looked: 'Items looked at', skipped: 'Skipped' }, counterStates: { looked: 'active', skipped: 'muted' }, baseStepMs: 1000, label: 'Break and continue controls' });
    view.prepare(player.steps.map(toView));
    CF.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'x (taken now)' }, { state: 'compare', label: 'Being tested' }, { state: 'visited', label: 'Tested, not negative' },
      { state: 'found', label: 'First negative' }, { state: 'done', label: 'Added to total' }, { state: 'muted', label: 'Skipped / never looked at' }]);
    function reload() {
      code.setSource(breakCode(mode));
      flowView.setSpec(S.breakMode(mode));
      var st = make(); view.reset(); view.prepare(st.map(toView));
      player.setSteps(st);
    }
    V.segmented(fig.querySelector('[data-mode]'), { label: 'Jump statement', value: mode, options: [{ value: 'break', label: 'break: stop at the first negative' }, { value: 'continue', label: 'continue: skip negatives' }],
      onChange: function (v) { mode = v; reload(); } });
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Your numbers (up to 10)', value: values, parse: { min: -99, max: 99, maxCount: 10, minCount: 0, integers: true },
      presets: [{ label: 'Negative in the middle', value: [4, 7, -2, 9, 5, -6] }, { label: 'No negatives', value: [3, 8, 1, 6] }, { label: 'Negative first', value: [-1, 5, 9] },
        { label: 'All negative', value: [-3, -1, -8] }, { label: 'Empty', value: [] }],
      onApply: function (v) { values = v.slice(); reload(); }
    });
    player.addCheckpoint(function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'jump') return k; return -1; },
      function (c) {
        var st = c.steps[c.index], p = c.prev;
        var brk = st.mode === 'break';
        return { question: 'The test <code>x &lt; 0</code> just said yes for <code>x = ' + num(p.values[p.k]) + '</code>' + (brk ? ' and found has been set' : '') + '. What happens to the rest of the list?',
          options: brk ? ['The loop keeps going through every item', 'The loop stops right now'] : ['The loop stops right now', 'The rest of this trip is skipped, then the loop moves to the next item'],
          answer: 1,
          explain: brk ? ['break leaves the loop at once, so the items after it are never looked at.', 'break jumps out of the whole loop, so no further item is tested.']
            : ['That is break. continue only ends the current trip.', 'continue jumps back to the loop header, so the addition is skipped for this x and the next item is taken.'] };
      }, { id: 'break-predict-jump' });
    return player;
  };

  /* ================================================================== 6. FizzBuzz through the flowchart */
  CF.fizzLab = function (fig) {
    var n = 15;
    var flowView = V.views.flowchart(fig.querySelector('[data-flow]'), S.fizz, { label: 'FizzBuzz flowchart' });
    var out = fig.querySelector('[data-out]');
    var CODE = {
      pseudo: ['i ← 1                              // @init', 'while i ≤ n                        // @test', '  if i is divisible by 15 then      // @t15', '    print FizzBuzz                  // @p15', '  else if i is divisible by 3 then  // @t3', '    print Fizz                      // @p3', '  else if i is divisible by 5 then  // @t5', '    print Buzz                      // @p5', '  else print i                      // @pn', '  i ← i + 1                         // @inc'].join('\n'),
      js: ['let i = 1;                           // @init', 'while (i <= n) {                     // @test', '  if (i % 15 === 0) {                // @t15', '    console.log("FizzBuzz");         // @p15', '  } else if (i % 3 === 0) {          // @t3', '    console.log("Fizz");             // @p3', '  } else if (i % 5 === 0) {          // @t5', '    console.log("Buzz");             // @p5', '  } else {', '    console.log(i);                  // @pn', '  }', '  i++;                               // @inc', '}'].join('\n'),
      py: ['i = 1                                # @init', 'while i <= n:                         # @test', '    if i % 15 == 0:                   # @t15', '        print("FizzBuzz")             # @p15', '    elif i % 3 == 0:                  # @t3', '        print("Fizz")                 # @p3', '    elif i % 5 == 0:                  # @t5', '        print("Buzz")                 # @p5', '    else:', '        print(i)                      # @pn', '    i += 1                            # @inc'].join('\n')
    };
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE, default: 'js', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { i: 'active', n: 'default' } });
    CF.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Token: test or step running' }, { state: 'compare', label: 'Fizz (÷ 3)' }, { state: 'frontier', label: 'Buzz (÷ 5)' }, { state: 'pivot', label: 'FizzBuzz (÷ 15)' }]);
    var tiles = [];
    function build() {
      V.clear(out); tiles = [];
      for (var k = 1; k <= n; k++) { var t = h('span', { class: 'cf-tile', 'data-k': k }, String(k)); out.appendChild(t); tiles.push(t); }
    }
    function decorate(steps) { return steps.map(function (st) { return Object.assign({}, st, { line: st.flow, vars: { i: st.i, n: n } }); }); }
    function render(step, ctx) {
      var done = {};
      step.out.forEach(function (o) { done[o.i] = o; });
      tiles.forEach(function (t, k) {
        var i = k + 1, o = done[i];
        var txt = o ? o.text : String(i);
        if (t.textContent !== txt) { t.textContent = txt; if (ctx.duration) { t.classList.remove('is-pop'); void t.offsetWidth; t.classList.add('is-pop'); } }
        t.className = 'cf-tile' + (o ? ' is-printed is-' + o.kind : '') + (step.i === i && step.flow !== 'done' ? ' is-current' : '');
      });
    }
    build();
    var player = V.player({ root: fig, steps: decorate(A.fizzbuzzTrace(n)), render: render, code: code, vars: vars, flow: CF.flowLink(flowView), caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'), counterLabels: { printed: 'Printed', tests: 'Divisibility tests' }, counterStates: { printed: 'done', tests: 'compare' }, baseStepMs: 700, label: 'FizzBuzz controls' });
    V.slider(fig.querySelector('[data-n]'), { label: 'n (count up to)', min: 5, max: 30, value: n, onChange: function (v) { n = v; build(); player.setSteps(decorate(A.fizzbuzzTrace(n))); } });
    player.addCheckpoint(function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].flow === 't15' && steps[k].i === 9) return k; return -1; },
      function () {
        return { question: 'i = 9. It is divisible by 3 but not by 15. Which test will say <b>yes</b> first?', options: ['i % 15 = 0', 'i % 3 = 0', 'i % 5 = 0'], answer: 1,
          explain: ['9 % 15 is 9, not 0, so this test says no.', 'Right: the 15 test says no, then 9 % 3 = 0 says yes and the chain stops with “Fizz”.', '9 % 5 is 4. And the chain would have stopped at the 3 test before reaching this one anyway.'] };
      }, { id: 'fizz-predict-test' });
    return player;
  };
}());
