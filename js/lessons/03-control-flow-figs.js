/* Lesson 03 · Decisions & loops — small figures, flowchart specs and shared helpers (VDSA.lessons.cf).
   Step generators: js/algos/03-control-flow.js (VDSA.algos.lesson03).
   The big labs live in 03-control-flow-labs.js; page wiring in 03-control-flow.js.
   Custom SVGs use the engine's .vz state vocabulary (`vz-item is-<state>`), so colours follow the tokens in both themes. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var A = V.algos.lesson03;
  var CF = V.lessons = V.lessons || {};
  CF = CF.cf = CF.cf || {};
  var num = A.num;

  /* ------------------------------------------------------------------ helpers */
  /* VDSA.legend with working `color` overrides (widgets.js sets --sw through Object.assign, which browsers ignore). */
  CF.legend = function (el, items) {
    el = V.$(el);
    V.legend(el, items);
    items.forEach(function (it, i) {
      if (typeof it === 'object' && it.color && el.children[i]) el.children[i].firstChild.style.setProperty('--sw', it.color);
    });
    return el;
  };

  /* Adapter so a player can light a flowchart: player.flow needs highlight(id, ctx).
     opts.trail: also tint the nodes used earlier in the trace (skip it for loops: every node ends up used). */
  CF.flowLink = function (view, opts) {
    opts = opts || {};
    return {
      view: view,
      highlight: function (id, ctx) {
        var seen = [];
        if (opts.trail && ctx && ctx.player) {
          var st = ctx.player.steps;
          for (var i = 0; i < ctx.index; i++) if (st[i].flow && st[i].flow !== id && seen.indexOf(st[i].flow) === -1) seen.push(st[i].flow);
        }
        view.render({ active: id || undefined, visited: seen }, { duration: ctx ? ctx.duration : 0 });
      }
    };
  };

  function node(id, type, text, col, row, extra) {
    var n = { id: id, type: type, text: text, col: col, row: row };
    if (extra) for (var k in extra) n[k] = extra[k];
    return n;
  }
  function edge(from, to, label, via) {
    var e = { from: from, to: to };
    if (label) e.label = label;
    if (via) e.via = via;
    return e;
  }

  /* ------------------------------------------------------------------ flowchart specs (VDSA.views.flowchart) */
  var S = CF.specs = {};

  S.hero = {
    nodes: [node('init', 'process', 'count = 0', 0, 0), node('test', 'decision', 'count < 3 ?', 0, 1),
      node('body', 'process', 'count = count + 1', 0, 2), node('done', 'end', 'done', 1, 1)],
    edges: [edge('init', 'test'), edge('test', 'body', 'yes'), edge('test', 'done', 'no'), edge('body', 'test')]
  };

  /* The lab loop: for i from a to b step s. Ids match loopTrace's `flow`. */
  S.loop = function (spec) {
    var acc = spec.body === 'count' ? 'count' : 'total', up = spec.step > 0;
    return {
      nodes: [
        node('init', 'process', acc + ' = 0', 0, 0),
        node('setI', 'process', 'i = ' + num(spec.from), 0, 1),
        node('test', 'decision', 'i ' + (up ? '≤' : '≥') + ' ' + num(spec.to) + ' ?', 0, 2),
        node('body', 'process', spec.body === 'count' ? 'count = count + 1' : 'total = total + i', 0, 3),
        node('update', 'process', 'i = i ' + (up ? '+' : '−') + ' ' + Math.abs(spec.step), 0, 4),
        node('done', 'end', 'print ' + acc, 1, 2)
      ],
      edges: [edge('init', 'setI'), edge('setI', 'test'), edge('test', 'body', 'yes'), edge('test', 'done', 'no'),
        edge('body', 'update'), edge('update', 'test')]
    };
  };

  S.tickets = function (start) {
    return {
      nodes: [
        node('init', 'process', 'tickets = ' + start, 0, 0),
        node('test', 'decision', 'tickets > 0 ?', 0, 1),
        node('body', 'process', 'hand out ticket', 0, 2),
        node('update', 'process', 'tickets = tickets − 1', 0, 3),
        node('done', 'end', 'print “sold out”', 1, 1)
      ],
      edges: [edge('init', 'test'), edge('test', 'body', 'yes'), edge('test', 'done', 'no'), edge('body', 'update'), edge('update', 'test')]
    };
  };

  /* if / else-if / else: which tests run. The bad order tests the small threshold first. */
  S.battery = function (order) {
    var bad = order === 'bad';
    var first = bad ? { id: 'amber', text: 'show amber', th: 20 } : { id: 'green', text: 'show green', th: 50 };
    var second = bad ? { id: 'green', text: 'show green', th: 50 } : { id: 'amber', text: 'show amber', th: 20 };
    return {
      nodes: [
        node('start', 'start', 'read level', 0, 0),
        node('t1', 'decision', 'level ≥ ' + first.th + ' ?', 0, 1),
        node(first.id, 'process', first.text, 1, 1),
        node('t2', 'decision', 'level ≥ ' + second.th + ' ?', 0, 2),
        node(second.id, 'process', second.text, 1, 2),
        node('red', 'process', 'show red', 0, 3),
        node('end', 'end', 'draw the icon', 1, 3)
      ],
      edges: [edge('start', 't1'), edge('t1', first.id, 'yes'), edge('t1', 't2', 'no'), edge('t2', second.id, 'yes'), edge('t2', 'red', 'no'),
        edge(first.id, 'end'), edge(second.id, 'end'), edge('red', 'end')]
    };
  };

  S.fizz = {
    nodes: [
      node('init', 'process', 'i = 1', 0, 0),
      node('test', 'decision', 'i ≤ n ?', 0, 1),
      node('t15', 'decision', 'i % 15 = 0 ?', 0, 2),
      node('t3', 'decision', 'i % 3 = 0 ?', 0, 3),
      node('t5', 'decision', 'i % 5 = 0 ?', 0, 4),
      node('pn', 'io', 'print i', 0, 5),
      node('p15', 'io', 'print FizzBuzz', 1, 2),
      node('p3', 'io', 'print Fizz', 1, 3),
      node('p5', 'io', 'print Buzz', 1, 4),
      node('inc', 'process', 'i = i + 1', 2, 3, { narrow: { col: 1, row: 6 } }),
      node('done', 'end', 'stop', 2, 1, { narrow: { col: 1, row: 1 } })
    ],
    edges: [
      edge('init', 'test'), edge('test', 't15', 'yes'), edge('test', 'done', 'no'),
      edge('t15', 'p15', 'yes'), edge('t15', 't3', 'no'),
      edge('t3', 'p3', 'yes'), edge('t3', 't5', 'no'),
      edge('t5', 'p5', 'yes'), edge('t5', 'pn', 'no'),
      edge('p15', 'inc'), edge('p3', 'inc'), edge('p5', 'inc'),
      edge('pn', 'inc'), edge('inc', 'test')
    ]
  };

  S.breakMode = function (mode) {
    if (mode === 'continue') {
      return {
        nodes: [
          node('start', 'start', 'total = 0', 0, 0),
          node('loop', 'decision', 'items left ?', 0, 1),
          node('test', 'decision', 'x < 0 ?', 0, 2),
          node('act', 'process', 'total = total + x', 0, 3),
          node('done', 'end', 'print total', 1, 1)
        ],
        edges: [edge('start', 'loop'), edge('loop', 'test', 'yes'), edge('loop', 'done', 'no'),
          edge('test', 'act', 'no'),
          edge('test', 'loop', 'yes: continue'),
          edge('act', 'loop')]
      };
    }
    return {
      nodes: [
        node('start', 'start', 'found = none', 0, 0),
        node('loop', 'decision', 'items left ?', 0, 1),
        node('test', 'decision', 'x < 0 ?', 0, 2),
        node('act', 'process', 'found = x', 1, 2),
        node('done', 'end', 'print found', 1, 1)
      ],
      edges: [edge('start', 'loop'), edge('loop', 'test', 'yes'), edge('loop', 'done', 'no'),
        edge('test', 'act', 'yes'), edge('act', 'done', 'break'), edge('test', 'loop', 'no')]
    };
  };

  /* Three tiny static diagrams: the only three shapes structured programs need. */
  S.seq = { nodes: [node('a', 'process', 'A', 0, 0), node('b', 'process', 'B', 0, 1), node('c', 'process', 'C', 0, 2)], edges: [edge('a', 'b'), edge('b', 'c')] };
  S.choice = {
    nodes: [node('q', 'decision', 'test ?', 0, 0), node('y', 'process', 'A', 0, 1), node('n', 'process', 'B', 1, 1), node('e', 'process', 'C', 0, 2)],
    edges: [edge('q', 'y', 'yes'), edge('q', 'n', 'no'), edge('y', 'e'), edge('n', 'e', null, { fromSide: 'bottom', toSide: 'right' })]
  };
  S.loopMini = {
    nodes: [node('q', 'decision', 'test ?', 0, 0), node('y', 'process', 'A', 0, 1), node('n', 'process', 'C', 1, 0)],
    edges: [edge('q', 'y', 'yes'), edge('q', 'n', 'no'), edge('y', 'q')]
  };

  /* ================================================================== the problem: a wall of lines vs three lines */
  CF.linesFigure = function (fig) {
    var stage = fig.querySelector('[data-stage]'), N = 40;
    var wall = h('div', { class: 'cf-wall', 'aria-hidden': 'true' });
    var lines = [];
    for (var k = 1; k <= N; k++) { var c = h('code', { class: 'cf-wall__line' }, 'total += ' + k); lines.push(c); wall.appendChild(c); }
    var nEl = h('b', { class: 'cf-n' }, '12');
    var wallCount = h('span', { class: 'cf-count__v' }), loopCount = h('span', { class: 'cf-count__v' }, '3');
    var card = h('div', { class: 'cf-loopcard' },
      h('p', { class: 'cf-loopcard__t' }, 'With a loop'),
      h('pre', { class: 'cf-loopcard__code' }, h('span', { html: 'total = 0\n<span class="k">for</span> k <span class="k">in</span> 1..' }), nEl, h('span', { html: '\n  total += k' })),
      h('p', { class: 'cf-loopcard__n' }, 'the same three lines, whatever n is'));
    stage.appendChild(h('div', { class: 'cf-lines' },
      h('div', { class: 'cf-lines__left' }, h('p', { class: 'cf-loopcard__t' }, 'Straight-line program'), wall),
      card));
    var stats = fig.querySelector('[data-stats]');
    stats.appendChild(h('div', { class: 'stat' }, h('span', { class: 'stat__label' }, 'Straight-line program'), h('span', { class: 'stat__value' }, wallCount, ' lines')));
    stats.appendChild(h('div', { class: 'stat' }, h('span', { class: 'stat__label' }, 'Loop version'), h('span', { class: 'stat__value' }, loopCount, ' lines')));
    function set(n) {
      lines.forEach(function (l, i) { l.classList.toggle('is-off', i >= n); });
      nEl.textContent = n;
      wallCount.textContent = n + 1;
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'n (how many numbers to add)', min: 1, max: N, value: 12, onInput: set });
    set(12);
  };

  /* ================================================================== comparison operators on a number line */
  CF.compareFigure = function (fig) {
    var lg = fig.querySelector('[data-legend]'); if (lg) CF.legend(lg, [{ state: 'active', label: 'a' }, { state: 'compare', label: 'b' }, { state: 'done', shape: 'outline', label: 'true' }]);
    var stage = fig.querySelector('[data-stage]');
    var W = 460, H = 118, X0 = 30, DX = 40, MAX = 10;
    var svg = s('svg', { class: 'vz cf-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Number line from 0 to 10 with the values of a and b marked' });
    svg.style.maxWidth = '640px';
    svg.appendChild(s('line', { class: 'cf-axis', x1: X0 - 10, x2: X0 + MAX * DX + 10, y1: 60, y2: 60 }));
    for (var t = 0; t <= MAX; t++) {
      svg.appendChild(s('line', { class: 'cf-tick', x1: X0 + t * DX, x2: X0 + t * DX, y1: 55, y2: 65 }));
      svg.appendChild(s('text', { class: 'vz-label', x: X0 + t * DX, y: 84, 'text-anchor': 'middle' }, t));
    }
    function disc(name, cls, y) {
      var g = s('g', { class: 'vz-item ' + cls }, s('circle', { class: 'vz-shape', r: 15 }), s('text', { class: 'vz-ink cf-disc', y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, name));
      V.place(g, { x: X0, y: y });
      svg.appendChild(g);
      return g;
    }
    var da = disc('a', 'is-active', 30), db = disc('b', 'is-compare', 30);
    var stems = { a: s('line', { class: 'cf-stem', y1: 45, y2: 60 }), b: s('line', { class: 'cf-stem', y1: 45, y2: 60 }) };
    svg.insertBefore(stems.a, da); svg.insertBefore(stems.b, da);
    stage.appendChild(svg);
    var grid = h('div', { class: 'cf-chips' });
    var chips = A.compareAll(0, 0).map(function (c) {
      var v = h('span', { class: 'cf-chip__v' });
      var el = h('div', { class: 'cf-chip' }, h('code', { class: 'cf-chip__t' }, c.text), h('span', { class: 'cf-chip__s' }), v);
      grid.appendChild(el);
      return { el: el, sub: el.querySelector('.cf-chip__s'), v: v };
    });
    fig.querySelector('[data-chips]').appendChild(grid);
    var a = 3, b = 5, sa, sb;
    function draw(dur) {
      V.animate(da, { x: X0 + a * DX }, { duration: dur, ease: 'out' });
      V.animate(db, { x: X0 + b * DX }, { duration: dur, ease: 'out' });
      V.animate(da, { y: a === b ? 22 : 30 }, { duration: dur });
      V.animate(db, { y: a === b ? 38 : 30 }, { duration: dur });
      stems.a.setAttribute('x1', X0 + a * DX); stems.a.setAttribute('x2', X0 + a * DX);
      stems.b.setAttribute('x1', X0 + b * DX); stems.b.setAttribute('x2', X0 + b * DX);
      A.compareAll(a, b).forEach(function (c, i) {
        var ch = chips[i];
        ch.el.classList.toggle('is-true', c.value);
        ch.el.classList.toggle('is-false', !c.value);
        ch.sub.textContent = num(a) + ' ' + c.op + ' ' + num(b);
        ch.v.textContent = c.value ? 'true' : 'false';
      });
      svg.setAttribute('aria-label', 'Number line: a is ' + a + ' and b is ' + b);
    }
    sa = V.slider(fig.querySelector('[data-a]'), { label: 'a', min: 0, max: MAX, value: a, onInput: function (v) { a = v; draw(160); } });
    sb = V.slider(fig.querySelector('[data-b]'), { label: 'b', min: 0, max: MAX, value: b, onInput: function (v) { b = v; draw(160); } });
    draw(0);
    var eq = fig.querySelector('[data-equal]');
    if (eq) eq.addEventListener('click', function () { b = a; sb.set(a); draw(300); });
  };

  /* ================================================================== AND / OR / NOT: switches, lamp, truth table */
  CF.logicFigure = function (fig) {
    var lg = fig.querySelector('[data-legend]'); if (lg) CF.legend(lg, [{ state: 'done', shape: 'line', label: 'Switch closed' }, { state: 'muted', shape: 'line', label: 'Switch open' }, { state: 'compare', label: 'Current flowing, lamp on' }, { state: 'active', label: 'Current row' }]);
    var host = fig.querySelector('[data-circuit]'), tableHost = fig.querySelector('[data-table]');
    var op = 'and', a = false, b = false;
    var svg = s('svg', { class: 'vz cf-svg cf-circuit', viewBox: '0 0 440 200', role: 'img' });
    svg.style.maxWidth = '560px';
    var groups = {}, wires = {}, switches = {};

    function wire(list, d, on) {
      var p = s('path', { class: 'cf-wire', d: d });
      list.push({ el: p, on: on });
      return p;
    }
    function sw(key, x, y, rot, label) {
      var lever = s('g', {}, s('line', { class: 'cf-lever', x1: 0, y1: 0, x2: 60, y2: 0 }));
      var g = s('g', { class: 'cf-switch', tabindex: '-1' },
        lever, s('circle', { class: 'cf-pole', cx: 0, cy: 0, r: 4 }), s('circle', { class: 'cf-pole', cx: 60, cy: 0, r: 4 }));
      var lab = s('text', { class: 'cf-swlabel', x: 30, y: 26, 'text-anchor': 'middle' }, label);
      if (rot) lab.setAttribute('transform', 'rotate(' + (-rot) + ' 30 0) translate(0 -10)');
      var hit = s('rect', { class: 'cf-hit', x: -6, y: -22, width: 72, height: 44, rx: 8 });
      var outer = s('g', { transform: 'translate(' + x + ' ' + y + ') rotate(' + rot + ')' }, hit, g, lab);
      outer.addEventListener('click', function () { toggle(key); });
      (switches[key] = switches[key] || []).push(lever);
      return outer;
    }
    function bulb() {
      var g = s('g', { class: 'cf-bulb', transform: 'translate(390 100)' },
        s('circle', { class: 'cf-glow', r: 38 }), s('circle', { class: 'cf-lamp', r: 20 }),
        s('path', { class: 'cf-fil', d: 'M-9 6 L-5 -7 L0 6 L5 -7 L9 6' }));
      svg.appendChild(g);
      return g;
    }
    function battery() {
      svg.appendChild(s('g', { class: 'cf-battery' }, s('line', { x1: 26, x2: 54, y1: 94, y2: 94 }), s('line', { class: 'short', x1: 33, x2: 47, y1: 106, y2: 106 }),
        s('text', { x: 66, y: 92 }, '+'), s('text', { x: 26, y: 132, 'text-anchor': 'start' }, 'battery')));
    }
    function circuit(name, build) {
      var g = s('g', { class: 'cf-circ' }), list = [];
      build(g, list);
      groups[name] = g; wires[name] = list;
      svg.appendChild(g);
    }
    var out = function () { return A.truth(op, a, b); };
    circuit('and', function (g, l) {
      [['M40 94 V30 H110', out], ['M170 30 H230', out], ['M290 30 H390 V80', out], ['M390 120 V170 H40 V106', out]].forEach(function (w) { g.appendChild(wire(l, w[0], w[1])); });
      g.appendChild(sw('a', 110, 30, 0, 'A')); g.appendChild(sw('b', 230, 30, 0, 'B'));
    });
    circuit('or', function (g, l) {
      [['M40 94 V30 H80', out], ['M80 30 H110', function () { return a; }], ['M170 30 H330', function () { return a; }],
        ['M80 30 V72 H110', function () { return b; }], ['M170 72 H330 V30', function () { return b; }],
        ['M330 30 H390 V80', out], ['M390 120 V170 H40 V106', out]].forEach(function (w) { g.appendChild(wire(l, w[0], w[1])); });
      g.appendChild(sw('a', 110, 30, 0, 'A')); g.appendChild(sw('b', 110, 72, 0, 'B'));
    });
    circuit('not', function (g, l) {
      var on = function () { return true; };
      [['M40 94 V30 H120', on], ['M170 30 H250', on], ['M250 30 H390 V80', function () { return !a; }], ['M250 30 V60', function () { return a; }],
        ['M250 120 V170', function () { return a; }], ['M390 120 V170 H250', function () { return !a; }], ['M250 170 H40 V106', on]].forEach(function (w) { g.appendChild(wire(l, w[0], w[1])); });
      g.appendChild(s('path', { class: 'cf-resistor', d: 'M120 30 l8 -10 l12 20 l12 -20 l12 20 l6 -10' }));
      g.appendChild(s('text', { class: 'cf-swlabel', x: 145, y: 12, 'text-anchor': 'middle' }, 'resistor'));
      g.appendChild(sw('a', 250, 60, 90, 'A'));
    });
    battery();
    var lamp = bulb();
    svg.appendChild(s('text', { class: 'cf-swlabel', x: 390, y: 152, 'text-anchor': 'middle' }, 'lamp'));
    host.appendChild(svg);

    /* toggles */
    var togs = {};
    var togRow = fig.querySelector('[data-toggles]');
    ['a', 'b'].forEach(function (k) {
      var btn = h('button', { type: 'button', class: 'cf-tog', 'aria-pressed': 'false', onclick: function () { toggle(k); } },
        h('span', { class: 'cf-tog__k' }, k.toUpperCase()), h('span', { class: 'cf-tog__v' }, 'false'));
      togs[k] = btn; togRow.appendChild(btn);
    });
    var readout = fig.querySelector('[data-readout]');
    var explain = fig.querySelector('[data-explain]');
    var say = {
      and: 'Two switches in <b>series</b>: the current must pass through A and then through B, so the lamp lights only when both are closed.',
      or: 'Two switches in <b>parallel</b>: the current can take either route, so one closed switch is enough.',
      not: 'A switch <b>across</b> the lamp: closing it lets the current bypass the lamp, so the lamp goes dark. NOT flips the answer.'
    };

    /* truth table */
    function buildTable() {
      V.clear(tableHost);
      var rows = A.truthTable(op), two = op !== 'not';
      var head = h('tr', {}, h('th', { scope: 'col' }, 'A'), two ? h('th', { scope: 'col' }, 'B') : null, h('th', { scope: 'col' }, op === 'not' ? 'NOT A' : 'A ' + A.OPS[op].label + ' B'));
      var body = h('tbody', {});
      rows.forEach(function (r) {
        var tr = h('tr', { class: 'cf-tt__row', tabindex: '0', 'data-a': r.a ? '1' : '0', 'data-b': two ? (r.b ? '1' : '0') : '', role: 'button', 'aria-label': 'Set A to ' + r.a + (two ? ', B to ' + r.b : '') },
          h('td', {}, tv(r.a)), two ? h('td', {}, tv(r.b)) : null, h('td', { class: 'cf-tt__out' }, tv(r.out)));
        function pick() { a = r.a; if (two) b = r.b; update(true); }
        tr.addEventListener('click', pick);
        tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        body.appendChild(tr);
      });
      tableHost.appendChild(h('table', { class: 'table table--compact cf-tt' }, h('thead', {}, head), body));
    }
    function tv(x) { return h('span', { class: 'cf-tv ' + (x ? 'is-t' : 'is-f') }, x ? 'true' : 'false'); }

    var seg;
    function update(anim) {
      var dur = anim ? 260 : 0;
      Object.keys(groups).forEach(function (k) { groups[k].style.display = k === op ? '' : 'none'; });
      togs.b.style.display = op === 'not' ? 'none' : '';
      var o = out();
      wires[op].forEach(function (w) { w.el.classList.toggle('is-live', !!w.on()); });
      (op === 'not' ? ['a'] : ['a', 'b']).forEach(function (k) {
        var closed = k === 'a' ? a : b;
        (switches[k] || []).forEach(function (lv) { if (lv.closest('.cf-circ') === groups[op]) V.animate(lv, { rotate: closed ? 0 : -30 }, { duration: dur, ease: 'out' }); });
        (switches[k] || []).forEach(function (lv) { lv.classList.toggle('is-closed', closed); });
      });
      lamp.classList.toggle('is-lit', o);
      togs.a.setAttribute('aria-pressed', a); togs.a.querySelector('.cf-tog__v').textContent = a;
      togs.b.setAttribute('aria-pressed', b); togs.b.querySelector('.cf-tog__v').textContent = b;
      var js = A.OPS[op].js;
      readout.innerHTML = '<code>' + (op === 'not' ? '!' + a : a + ' ' + js + ' ' + b) + '</code> <span class="cf-arrow">→</span> <b class="cf-tv ' + (o ? 'is-t' : 'is-f') + '">' + o + '</b>';
      explain.innerHTML = say[op];
      V.$$('.cf-tt__row', tableHost).forEach(function (tr) {
        var on = tr.dataset.a === (a ? '1' : '0') && (op === 'not' || tr.dataset.b === (b ? '1' : '0'));
        tr.classList.toggle('is-current', on);
        if (on) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current');
      });
      svg.setAttribute('aria-label', 'Circuit for ' + A.OPS[op].label + ': switch A is ' + (a ? 'closed' : 'open') + (op === 'not' ? '' : ', switch B is ' + (b ? 'closed' : 'open')) + '. The lamp is ' + (o ? 'on' : 'off') + '.');
    }
    function toggle(k) { if (k === 'a') a = !a; else if (op !== 'not') b = !b; update(true); }

    seg = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Operator', value: op,
      options: [{ value: 'and', label: 'AND' }, { value: 'or', label: 'OR' }, { value: 'not', label: 'NOT' }],
      onChange: function (v) { op = v; buildTable(); update(false); }
    });
    buildTable();
    update(false);
  };

  /* ================================================================== if / else-if / else: the battery icon */
  CF.batteryFigure = function (fig) {
    var lg = fig.querySelector('[data-legend]'); if (lg) CF.legend(lg, [{ state: 'active', label: 'Test or branch running' }, { state: 'path', shape: 'line', label: 'Route taken' }]);
    var stage = fig.querySelector('[data-stage]'), flowHost = fig.querySelector('[data-flow]');
    var order = 'good', level = 72, token = 0, timers = [];
    var svg = s('svg', { class: 'vz cf-svg cf-battery-svg', viewBox: '0 0 200 150', role: 'img' });
    var body = s('rect', { class: 'cf-bat__body', x: 20, y: 30, width: 150, height: 74, rx: 12 });
    var cap = s('rect', { class: 'cf-bat__cap', x: 170, y: 55, width: 10, height: 24, rx: 3 });
    var fillEl = s('rect', { class: 'cf-bat__fill', x: 27, y: 37, width: 0, height: 60, rx: 7 });
    var pct = s('text', { class: 'cf-bat__pct', x: 95, y: 68, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '');
    var verdict = s('text', { class: 'cf-bat__verdict', x: 100, y: 132, 'text-anchor': 'middle' }, '');
    svg.appendChild(s('g', { class: 'vz-item is-default' }, body, cap));
    var fg = s('g', { class: 'is-default' }, fillEl);
    svg.appendChild(fg); svg.appendChild(pct); svg.appendChild(verdict);
    stage.appendChild(svg);
    var msg = fig.querySelector('[data-msg]');

    var flow = V.views.flowchart(flowHost, S.battery(order), { label: 'Battery icon decision flow' });
    var STATE = { green: 'done', amber: 'compare', red: 'error' };

    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function paint(res, dur) {
      var c = res.result;
      fg.setAttribute('class', 'is-' + STATE[c]);
      svg.style.setProperty('--vz-dur', dur + 'ms');
      V.animate(fillEl, { attr: { width: 136 * level / 100 } }, { duration: dur, ease: 'out' });
      pct.textContent = level + '%';
      var ok = res.result === res.correct;
      verdict.textContent = 'shows ' + c;
      verdict.setAttribute('class', 'cf-bat__verdict' + (ok ? '' : ' is-wrong'));
      msg.innerHTML = ok
        ? 'Level ' + level + '%: the icon shows <b>' + c + '</b>. That is right.'
        : 'Level ' + level + '%: the icon shows <b>' + c + '</b>, but it should show <b>' + res.correct + '</b>. The first test <code>level ≥ 20</code> was true, so the chain stopped there and never asked about 50.';
      msg.classList.toggle('is-wrong', !ok);
    }
    function edgeStates(path) {
      var es = {};
      for (var i = 1; i < path.length; i++) es[path[i - 1] + '->' + path[i]] = 'path';
      return es;
    }
    function show(walk) {
      clearTimers();
      var my = ++token, res = A.batteryPath(level, order), path = res.path;
      var speed = walk && !V.reducedMotion() ? 420 : 0;
      paint(res, speed ? 300 : 0);
      if (!speed) { flow.render({ active: 'end', visited: path.slice(0, -1), edgeStates: edgeStates(path), states: {} }, { duration: 0 }); return; }
      flow.render({ active: 'start' }, { duration: 0 });
      path.forEach(function (id, k) {
        if (!k) return;
        timers.push(setTimeout(function () {
          if (my !== token) return;
          flow.render({ active: id, visited: path.slice(0, k), edgeStates: edgeStates(path.slice(0, k + 1)) }, { duration: 340 });
        }, k * speed));
      });
    }
    var slider = V.slider(fig.querySelector('[data-slider]'), { label: 'Battery level', min: 0, max: 100, value: level, format: function (v) { return v + '%'; },
      onInput: function (v) { level = v; show(false); }, onChange: function (v) { level = v; show(true); } });
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Order of the tests', value: order,
      options: [{ value: 'good', label: 'Big test first' }, { value: 'bad', label: 'Small test first (bug)' }],
      onChange: function (v) { order = v; flow.setSpec(S.battery(order)); show(true); }
    });
    var quick = fig.querySelector('[data-quick]');
    [90, 50, 35, 10].forEach(function (v) {
      quick.appendChild(h('button', { type: 'button', class: 'btn btn--soft btn--sm', onclick: function () { level = v; slider.set(v); show(true); } }, v + '%'));
    });
    show(false);
  };

  /* ================================================================== a loop is a jump: the program counter */
  CF.jumpsFigure = function (fig) {
    var lg = fig.querySelector('[data-legend]'); if (lg) CF.legend(lg, [{ state: 'active', label: 'Instruction running (pc)' }, { state: 'active', shape: 'line', label: 'Jump taken' }, { state: 'done', label: 'Printed' }]);
    var stage = fig.querySelector('[data-stage]');
    var limit = 3, player = null;
    var ROW = 46, TOP = 26, LX = 44, RW = 250;
    var svg, rows = [], texts = [], pc, arcs = {}, token, tape, tapeChips = [], doneChip;
    function ry(k) { return TOP + (k - 1) * ROW; }
    function code(l) { return ['i = 0', 'if i ≥ ' + l + ' goto 6', 'print i', 'i = i + 1', 'goto 2', 'print “done”']; }
    function build() {
      V.clear(stage);
      svg = s('svg', { class: 'vz cf-svg cf-jumps', viewBox: '0 0 560 ' + (ry(6) + 40), role: 'img', 'aria-label': 'Six numbered instructions with a program counter arrow and jump arrows' });
      svg.style.maxWidth = '720px';
      var defs = s('defs');
      ['', 'a'].forEach(function (k) {
        defs.appendChild(s('marker', { id: 'cfj' + k, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, s('path', { d: 'M0 0 L10 5 L0 10 z', class: k ? 'cf-arrowhead is-active' : 'cf-arrowhead' })));
      });
      svg.appendChild(defs);
      code(limit).forEach(function (t, i) {
        var k = i + 1;
        var g = s('g', { class: 'vz-item is-default' }, s('rect', { class: 'vz-shape', x: LX, y: ry(k) - 17, width: RW, height: 34, rx: 9 }),
          s('text', { class: 'vz-label is-strong', x: LX - 12, y: ry(k) + 1, 'text-anchor': 'end', 'dominant-baseline': 'central' }, k),
          s('text', { class: 'vz-ink cf-code', x: LX + 14, y: ry(k) + 1, 'dominant-baseline': 'central' }, t));
        svg.appendChild(g); rows.push(g); texts.push(g.lastChild);
      });
      function arc(name, from, to, bulge) {
        var x = LX + RW, y1 = ry(from), y2 = ry(to);
        var d = 'M' + x + ' ' + y1 + ' C' + (x + bulge) + ' ' + y1 + ' ' + (x + bulge) + ' ' + y2 + ' ' + (x + 6) + ' ' + y2;
        var p = s('path', { class: 'cf-jump', d: d, 'marker-end': 'url(#cfj)' });
        svg.appendChild(p); arcs[name] = p;
      }
      arc('5-2', 5, 2, 74); arc('2-6', 2, 6, 44);
      svg.appendChild(s('text', { class: 'vz-caption', x: LX + RW + 78, y: (ry(2) + ry(5)) / 2, 'text-anchor': 'middle', transform: 'rotate(90 ' + (LX + RW + 78) + ' ' + (ry(2) + ry(5)) / 2 + ')' }, 'jump back'));
      pc = s('g', { class: 'cf-pc' }, s('path', { d: 'M-2 -11 L18 0 L-2 11 z' }), s('text', { x: -8, y: 30, 'text-anchor': 'middle' }, 'pc'));
      V.place(pc, { x: 2, y: ry(1) });
      svg.appendChild(pc);
      token = s('circle', { class: 'cf-token', r: 7, cx: 0, cy: 0, opacity: 0 });
      svg.appendChild(token);
      var tx = 440;
      svg.appendChild(s('text', { class: 'vz-caption', x: tx, y: 18 }, 'PRINTED'));
      svg.appendChild(s('rect', { class: 'cf-tape', x: tx - 10, y: 26, width: 108, height: ry(6) - 16, rx: 12 }));
      tapeChips = [];
      for (var k = 0; k < 6; k++) {
        var g = s('g', { class: 'vz-item is-done' }, s('rect', { class: 'vz-shape', x: 0, y: 0, width: 88, height: 30, rx: 8 }), s('text', { class: 'vz-ink cf-code', x: 44, y: 16, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, ''));
        V.place(g, { x: tx, y: 36 + k * 36, opacity: 0 });
        svg.appendChild(g); tapeChips.push(g);
      }
      stage.appendChild(svg);
    }
    var lastPc = 1;
    function render(step, ctx) {
      var d = ctx.duration;
      svg.style.setProperty('--vz-dur', d + 'ms');
      rows.forEach(function (g, i) { g.setAttribute('class', 'vz-item ' + (i + 1 === step.pc ? 'is-active' : 'is-default')); });
      V.animate(pc, { y: ry(step.pc) }, { duration: d, ease: 'inOut' });
      Object.keys(arcs).forEach(function (k) {
        var on = step.jump && step.jump.from + '-' + step.jump.to === k;
        arcs[k].setAttribute('class', 'cf-jump' + (on ? ' is-active' : ''));
        arcs[k].setAttribute('marker-end', 'url(#cfj' + (on ? 'a' : '') + ')');
      });
      if (step.jump && d > 0 && ctx.direction >= 0) {
        var p = arcs[step.jump.from + '-' + step.jump.to], len = p.getTotalLength();
        token.setAttribute('opacity', 1);
        V.tween(d, function (t, e) { var pt = p.getPointAtLength(len * e); token.setAttribute('cx', pt.x); token.setAttribute('cy', pt.y); if (t >= 1) token.setAttribute('opacity', 0); }, { ease: 'inOut' });
      } else token.setAttribute('opacity', 0);
      var out = step.out.map(String);
      if (step.pc === 6) out = out.concat(['“done”']);
      tapeChips.forEach(function (g, k) {
        var on = k < out.length;
        g.lastChild.textContent = out[k] || '';
        V.animate(g, { opacity: on ? 1 : 0 }, { duration: d });
      });
    }
    function make(l) {
      limit = l;
      build();
      var steps = A.jumpTrace(l);
      if (player) player.setSteps(steps);
      else player = V.player({ root: fig, steps: steps, render: render, caption: fig.querySelector('[data-caption]'), vars: V.varsPanel(fig.querySelector('[data-vars]'), { states: { pc: 'active', i: 'key' } }),
        counters: fig.querySelector('[data-counters]'), counterLabels: { jumps: 'Jumps taken' }, baseStepMs: 1100, label: 'Program counter controls' });
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Print how many numbers', value: '3', options: [{ value: '0', label: 'Zero' }, { value: '3', label: 'Three' }, { value: '5', label: 'Five' }],
      onChange: function (v) { var l = +v; limit = l; build(); player.setSteps(A.jumpTrace(l)); } });
    make(3);
    return player;
  };

  /* ================================================================== while loop: the ticket box */
  CF.ticketFigure = function (fig) {
    var lg = fig.querySelector('[data-legend]'); if (lg) CF.legend(lg, [{ state: 'compare', label: 'Top ticket, being tested' }, { state: 'active', label: 'Being handed out' }, { state: 'done', label: 'Handed out' }]);
    var stage = fig.querySelector('[data-stage]');
    var start = 5, player, flow, flowView, svg, tickets = {}, readout, emptyNote, boxG, N = 7;
    var CW = 46, CH = 58;
    function boxPos(k) { return { x: 34 + ((k - 1) % 4) * 58, y: 50 + Math.floor((k - 1) / 4) * 70 }; }
    function trayPos(t) { return { x: 316 + t * 33, y: 92 }; }
    function build() {
      V.clear(stage);
      svg = s('svg', { class: 'vz cf-svg cf-tickets', viewBox: '0 0 560 200', role: 'img', 'aria-label': 'A box of numbered tickets and a tray for tickets handed out' });
      svg.style.maxWidth = '680px';
      boxG = s('rect', { class: 'cf-box', x: 20, y: 38, width: 250, height: 150, rx: 14 });
      svg.appendChild(boxG);
      svg.appendChild(s('text', { class: 'vz-caption', x: 28, y: 28 }, 'TICKET BOX'));
      svg.appendChild(s('rect', { class: 'cf-tray', x: 302, y: 84, width: 244, height: 80, rx: 12 }));
      svg.appendChild(s('text', { class: 'vz-caption', x: 310, y: 28 }, 'HANDED OUT'));
      readout = s('text', { class: 'cf-readout', x: 310, y: 62 }, '');
      svg.appendChild(readout);
      emptyNote = s('text', { class: 'vz-empty', x: 145, y: 118, 'text-anchor': 'middle', opacity: 0 }, 'the box is empty');
      svg.appendChild(emptyNote);
      tickets = {};
      for (var k = 1; k <= start; k++) {
        var g = s('g', { class: 'vz-item is-default' }, s('rect', { class: 'vz-shape', width: CW, height: CH, rx: 7 }),
          s('circle', { class: 'cf-notch', cx: 0, cy: CH / 2, r: 4 }), s('circle', { class: 'cf-notch', cx: CW, cy: CH / 2, r: 4 }),
          s('text', { class: 'vz-ink cf-tnum', x: CW / 2, y: CH / 2 + 1, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, k));
        V.place(g, boxPos(k));
        svg.appendChild(g); tickets[k] = g;
      }
      stage.appendChild(svg);
    }
    function render(step, ctx) {
      var d = ctx.duration;
      svg.style.setProperty('--vz-dur', d + 'ms');
      var top = step.left.length ? step.left[step.left.length - 1] : null;
      Object.keys(tickets).forEach(function (k) {
        k = +k;
        var g = tickets[k], oi = step.out.indexOf(k);
        var st = oi >= 0 ? (step.kind === 'give' && oi === step.out.length - 1 ? 'active' : 'done') : (step.kind === 'test' && k === top ? 'compare' : 'default');
        g.setAttribute('class', 'vz-item is-' + st);
        var p = oi >= 0 ? trayPos(oi) : boxPos(k);
        V.animate(g, { x: p.x, y: p.y, scale: oi >= 0 ? 0.7 : 1 }, { duration: d, ease: 'inOut' });
      });
      readout.textContent = 'tickets = ' + step.tickets;
      V.animate(emptyNote, { opacity: step.left.length ? 0 : 1 }, { duration: d });
    }
    flowView = V.views.flowchart(fig.querySelector('[data-flow]'), S.tickets(start), { label: 'While loop flowchart' });
    build();
    flow = CF.flowLink(flowView);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: TICKET_CODE, default: 'pseudo', maxHeight: 260 });
    player = V.player({ root: fig, steps: A.ticketTrace(start), render: render, code: code, flow: flow, caption: fig.querySelector('[data-caption]'),
      vars: V.varsPanel(fig.querySelector('[data-vars]'), { states: { tickets: 'active' } }),
      counters: fig.querySelector('[data-counters]'), counterLabels: { tests: 'Tests', trips: 'Body runs' }, counterStates: { tests: 'compare', trips: 'done' },
      baseStepMs: 1100, label: 'While loop controls' });
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Tickets in the box', value: '5', options: [{ value: '0', label: '0 (empty)' }, { value: '3', label: '3' }, { value: '5', label: '5' }, { value: '7', label: '7' }],
      onChange: function (v) { var n = +v; start = n; build(); flowView.setSpec(S.tickets(n)); player.setSteps(A.ticketTrace(n)); } });
    player.addCheckpoint(function (steps) { for (var k = 1; k < steps.length; k++) if (steps[k].kind === 'test' && steps[k].test === false) return k; return -1; },
      function (c) {
        var p = c.prev, t = p.tickets;
        return { question: 'The loop has just run its body ' + p.counters.trips + ' times and <code>tickets = ' + t + '</code>. What does the next test, <code>tickets &gt; 0</code>, say?',
          options: ['True: run the body again', 'False: leave the loop'], answer: 1,
          explain: ['0 &gt; 0 is false, so the loop cannot run again.', 'The variable is 0 and 0 is not greater than 0, so the test is false and the token takes the “no” exit.'] };
      }, { id: 'while-predict-exit' });
    return player;
  };
  var TICKET_CODE = {
    pseudo: ['tickets ← 5                    // @init', 'while tickets > 0            // @test', '  give out a ticket          // @body', '  tickets ← tickets − 1      // @update', 'print “sold out”              // @done'].join('\n'),
    js: ['let tickets = 5;                // @init', 'while (tickets > 0) {          // @test', '  giveTicket(tickets);        // @body', '  tickets = tickets - 1;      // @update', '}', 'console.log("sold out");      // @done'].join('\n'),
    py: ['tickets = 5                     # @init', 'while tickets > 0:              # @test', '    give_ticket(tickets)      # @body', '    tickets = tickets - 1     # @update', 'print("sold out")             # @done'].join('\n')
  };

  /* ================================================================== the for header, part by part */
  CF.anatomyFigure = function (fig) {
    var host = fig.querySelector('[data-stage]');
    var spec = { from: 1, to: 5, step: 1, body: 'sum' };
    var wrap = h('div', { class: 'cf-anat' });
    var head = h('div', { class: 'cf-anat__head', role: 'group', 'aria-label': 'The three parts of a for header' });
    var parts = [
      { id: 'setI', label: 'let i = 1', n: 1, tag: 'start', text: '<b>Start.</b> Runs exactly once, before anything else in the loop. It creates the loop variable.' },
      { id: 'test', label: 'i <= 5', n: 2, tag: 'test', text: '<b>Test.</b> Runs before every trip, including the first. When it is false the loop ends and the body is skipped.' },
      { id: 'update', label: 'i++', n: 3, tag: 'update', text: '<b>Update.</b> Runs after every trip of the body, then the token goes back to the test. Without it the test would never change.' }
    ];
    head.appendChild(h('code', { class: 'cf-anat__kw' }, 'for ('));
    var btns = {};
    parts.forEach(function (p, k) {
      var b = h('button', { type: 'button', class: 'cf-part cf-part--' + p.n, 'aria-pressed': 'false', 'data-tag': p.tag }, h('span', { class: 'cf-part__n' }, p.n), h('code', {}, p.label));
      b.addEventListener('click', function () { pick(p.id); });
      b.addEventListener('mouseenter', function () { pick(p.id, true); });
      b.addEventListener('focus', function () { pick(p.id, true); });
      btns[p.id] = b; head.appendChild(b);
      if (k < 2) head.appendChild(h('code', { class: 'cf-anat__kw' }, ';'));
    });
    head.appendChild(h('code', { class: 'cf-anat__kw' }, ') {'));
    var bodyBtn = h('div', { class: 'cf-anat__body' }, h('code', {}, '  total = total + i;'), h('span', { class: 'cf-anat__tag' }, 'body: runs only while the test is true'));
    var say = h('p', { class: 'cf-anat__say', 'aria-live': 'polite' });
    var flowHost = h('div', { class: 'cf-anat__flow' });
    wrap.appendChild(h('div', { class: 'cf-anat__left' }, head, bodyBtn, h('code', { class: 'cf-anat__kw' }, '}'), say));
    wrap.appendChild(flowHost);
    host.appendChild(wrap);
    var flow = V.views.flowchart(flowHost, S.loop(spec), { label: 'The for loop as a flowchart' });
    function pick(id) {
      Object.keys(btns).forEach(function (k) { btns[k].setAttribute('aria-pressed', k === id ? 'true' : 'false'); });
      var p = parts.filter(function (x) { return x.id === id; })[0];
      say.innerHTML = p.text;
      flow.render({ active: id }, { duration: 400 });
    }
    pick('test');
    flow.render({ active: 'test' }, { duration: 0 });
  };

  /* ================================================================== the invariant: a staircase of squares */
  CF.invariantFigure = function (fig) {
    var lg = fig.querySelector('[data-legend]'); if (lg) CF.legend(lg, [{ state: 'done', label: 'Squares added so far' }]);
    var stage = fig.querySelector('[data-stage]'), inv = fig.querySelector('[data-inv]');
    var steps = A.loopTrace({ from: 1, to: 5, step: 1, body: 'sum' });
    var U = 26, GAP = 6, X0 = 44, BASE = 176, W = 400, H = 210;
    var svg = s('svg', { class: 'vz cf-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Columns of squares of height 1 to 5 built one per trip; the total is the number of squares' });
    svg.style.maxWidth = '520px';
    svg.appendChild(s('line', { class: 'cf-axis', x1: X0 - 10, x2: W - 10, y1: BASE + 4, y2: BASE + 4 }));
    var cols = [];
    for (var k = 1; k <= 5; k++) {
      var g = s('g', { class: 'is-default' });
      for (var q = 0; q < k; q++) g.appendChild(s('rect', { class: 'cf-sq', x: 0, y: -(q + 1) * U, width: U - 2, height: U - 2, rx: 4 }));
      g.appendChild(s('text', { class: 'vz-label is-strong', x: (U - 2) / 2, y: 22, 'text-anchor': 'middle' }, 'i = ' + k));
      V.place(g, { x: X0 + (k - 1) * (U + GAP + 22), y: BASE - 60, opacity: 0 });
      svg.appendChild(g); cols.push(g);
    }
    var tot = s('text', { class: 'cf-total', x: W - 20, y: 34, 'text-anchor': 'end' }, 'total = 0');
    svg.appendChild(tot);
    stage.appendChild(svg);
    function sum(a) { return a.reduce(function (t, c) { return t + c.add; }, 0); }
    V.player({ root: fig, steps: steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1000, label: 'Invariant steps',
      render: function (step, ctx) {
        var d = ctx.duration;
        svg.style.setProperty('--vz-dur', d + 'ms');
        cols.forEach(function (g, k) {
          var on = k < step.cols.length;
          g.setAttribute('class', 'vz-item ' + (on ? 'is-done' : 'is-default'));
          V.animate(g, { y: on ? BASE : BASE - 60, opacity: on ? 1 : 0 }, { duration: d, ease: 'out' });
        });
        tot.textContent = 'total = ' + step.acc;
        var parts = step.cols.map(function (c) { return c.add; });
        var squares = sum(step.cols);
        if (step.kind !== 'body' && step.kind !== 'update') {
          inv.innerHTML = 'Invariant check at the test: <code>total = ' + (parts.length ? parts.join(' + ') : '0') + ' = ' + step.acc + '</code>, and the columns hold <b>' + squares + '</b> squares <span class="cf-ok">✓ they match</span>';
        } else inv.innerHTML = 'Mid-trip the total and the squares may disagree for a moment. The invariant only has to hold when the test runs again.';
      } });
  };

  /* ================================================================== fence posts and rails */
  CF.fencePostFigure = function (fig) {
    var lg = fig.querySelector('[data-legend]'); if (lg) CF.legend(lg, [{ state: 'key', label: 'Posts' }, { state: 'visited', label: 'Rails' }]);
    var stage = fig.querySelector('[data-stage]'), MAX = 10, PX = 46, X0 = 40, W = X0 * 2 + MAX * PX, H = 150;
    var svg = s('svg', { class: 'vz cf-svg', viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    svg.style.maxWidth = '660px';
    var posts = [], rails = [];
    svg.appendChild(s('line', { class: 'cf-axis', x1: 10, x2: W - 10, y1: 112, y2: 112 }));
    var fenceG = s('g', {});
    svg.appendChild(fenceG);
    for (var k = 0; k < MAX; k++) {
      var r = s('g', { class: 'vz-item is-visited' }, s('rect', { class: 'vz-shape', x: 0, y: 0, width: PX - 12, height: 14, rx: 4 }));
      V.place(r, { x: X0 + k * PX + 12 + 6, y: 58 }); fenceG.appendChild(r); rails.push(r);
      var r2 = s('g', { class: 'vz-item is-visited' }, s('rect', { class: 'vz-shape', x: 0, y: 0, width: PX - 12, height: 14, rx: 4 }));
      V.place(r2, { x: X0 + k * PX + 12 + 6, y: 84 }); fenceG.appendChild(r2); rails.push(r2);
    }
    for (var m = 0; m <= MAX; m++) {
      var p = s('g', { class: 'vz-item is-key' }, s('rect', { class: 'vz-shape', x: -6, y: 0, width: 12, height: 62, rx: 3 }), s('path', { class: 'vz-shape cf-cap', d: 'M-6 0 L0 -9 L6 0 z' }));
      V.place(p, { x: X0 + m * PX + 6, y: 46 }); fenceG.appendChild(p); posts.push(p);
    }
    var txt = s('text', { class: 'cf-total', x: W / 2, y: 22, 'text-anchor': 'middle' }, '');
    svg.appendChild(txt);
    stage.appendChild(svg);
    var msg = fig.querySelector('[data-msg]');
    function set(n, dur) {
      V.animate(fenceG, { x: (MAX - n) * PX / 2 }, { duration: dur, ease: 'out' });
      posts.forEach(function (p, i) { V.animate(p, { opacity: i < n ? 1 : 0, y: i < n ? 46 : 30 }, { duration: dur }); });
      rails.forEach(function (r, i) { var seg = Math.floor(i / 2); V.animate(r, { opacity: seg < n - 1 ? 1 : 0 }, { duration: dur }); });
      txt.textContent = n + ' posts, ' + (n - 1) + ' gaps';
      msg.innerHTML = 'The fence has <b>' + n + ' posts</b> but only <b>' + (n - 1) + ' rails</b> between them. In the same way, the numbers <code>0</code> to <code>' + (n - 1) + '</code> are <b>' + n + '</b> numbers, not ' + (n - 1) + '. Count the things, or count the gaps: they differ by one.';
      svg.setAttribute('aria-label', 'A fence with ' + n + ' posts and ' + (n - 1) + ' rails');
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Posts', min: 2, max: MAX, value: 6, onInput: function (v) { set(v, 220); } });
    set(6, 0);
  };
}());
