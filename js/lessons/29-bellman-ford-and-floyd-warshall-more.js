/* Lesson 29 · Bellman-Ford & Floyd-Warshall — part 3: currency arbitrage, the stopover idea, next hops, cost chart,
   decision tree, variations (Johnson, transitive closure, reporting a cycle), checks and the summary card.
   Needs VDSA.L29 (…-29-bellman-ford-and-floyd-warshall.js) and VDSA.algos.shortestPaths. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var SP = V.algos.shortestPaths;
  var L = V.L29;

  function pct(x) { return (x >= 1 ? '+' : '−') + Math.abs((x - 1) * 100).toFixed(2) + ' %'; }
  function big(x) {
    if (x >= 1e9) return (x / 1e9).toFixed(x >= 1e10 ? 0 : 1) + ' B';
    if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + ' M';
    if (x >= 1e3) return (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + ' k';
    return String(Math.round(x));
  }
  function fillSelect(sel, ids, value) {
    V.clear(sel);
    ids.forEach(function (id) { sel.appendChild(h('option', { value: id, selected: id === value }, id)); });
  }

  /* ================================================================== currency arbitrage */
  function arbFigure(fig) {
    var cur = ['USD', 'EUR', 'GBP'];
    var pos = { USD: [500, 50], EUR: [160, 550], GBP: [840, 550] };
    var fwd = { 'USD>EUR': 92, 'EUR>GBP': 86, 'GBP>USD': 128 };   // hundredths
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 400, nodeRadius: 30, label: 'Three currencies and the exchange rate on every arrow' });
    var wbox = fig.querySelector('[data-weights]'), verdict = fig.querySelector('[data-verdict]');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'You hold this' }, { state: 'path', shape: 'line', label: 'Trade being made' }, { state: 'error', shape: 'line', label: 'Profit loop = negative cycle' }, { state: 'default', shape: 'line', label: 'Return quotes (fixed)' }]);
    var sliders = fig.querySelector('[data-sliders]');
    var ranges = { 'USD>EUR': [85, 100], 'EUR>GBP': [75, 100], 'GBP>USD': [110, 150] };
    var labels = { 'USD>EUR': '1 USD buys … EUR', 'EUR>GBP': '1 EUR buys … GBP', 'GBP>USD': '1 GBP buys … USD' };
    var sl = {};
    Object.keys(fwd).forEach(function (k) {
      var host = h('div', { class: 'bf-slider' });
      sliders.appendChild(host);
      sl[k] = V.slider(host, { label: labels[k], min: ranges[k][0], max: ranges[k][1], step: 1, value: fwd[k], format: function (v) { return (v / 100).toFixed(2); }, onInput: function (v) { fwd[k] = v; update(); } });
    });
    var presets = fig.querySelector('[data-presets]');
    [['Mis-priced (profit)', { 'USD>EUR': 92, 'EUR>GBP': 86, 'GBP>USD': 128 }], ['Fair market', { 'USD>EUR': 92, 'EUR>GBP': 86, 'GBP>USD': 125 }], ['Big mispricing', { 'USD>EUR': 96, 'EUR>GBP': 90, 'GBP>USD': 132 }]].forEach(function (p) {
      presets.appendChild(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { Object.keys(p[1]).forEach(function (k) { fwd[k] = p[1][k]; sl[k].set(p[1][k]); }); update(); } }, p[0]));
    });

    var player = null;
    function model() {
      var q = {}; Object.keys(fwd).forEach(function (k) { q[k] = fwd[k] / 100; });
      var rates = SP.arbitrageRates(q);
      var g = SP.arbitrageGraph(cur, rates);
      return { rates: rates, g: g, cyc: SP.negativeCycle(g), q: q };
    }
    function graphAt(m, o) {
      o = o || {};
      return {
        nodes: cur.map(function (id) { return { id: id, x: pos[id][0], y: pos[id][1], state: (o.nodes && o.nodes[id]) || 'default', badge: o.badge && o.badge[id] !== undefined ? o.badge[id] : undefined }; }),
        edges: m.g.edges.map(function (e) {
          var k = e.from + '-' + e.to, fwdEdge = fwd[e.from + '>' + e.to] !== undefined;
          var r = m.rates[e.from + '>' + e.to];
          return { id: k, from: e.from, to: e.to, directed: true, label: '×' + r.toFixed(3), state: (o.edges && o.edges[k]) || (fwdEdge ? 'default' : 'muted'), pulse: !!(o.pulse && o.pulse === k) };
        })
      };
    }
    function build() {
      var m = model();
      var loop = [['USD', 'EUR'], ['EUR', 'GBP'], ['GBP', 'USD']];
      var amt = 100, steps = [], badge = { USD: '100' }, profit = 1;
      loop.forEach(function (l) { profit *= m.rates[l[0] + '>' + l[1]]; });
      var wsum = 0; loop.forEach(function (l) { wsum += -Math.log(m.rates[l[0] + '>' + l[1]]); });
      var gain = profit > 1;
      steps.push({ g: graphAt(m, { nodes: { USD: 'active' }, badge: badge }), caption: 'You start with <b>100 USD</b>. The question: can a chain of trades that ends back in USD leave you with <em>more</em> than 100?' });
      var have = { USD: 100 }, hopNames = [];
      loop.forEach(function (l, i) {
        var r = m.rates[l[0] + '>' + l[1]];
        amt = amt * r;
        var nb = Object.assign({}, badge); nb[l[1]] = amt.toFixed(2);
        badge = nb;
        var key = l[0] + '-' + l[1], es = {};
        for (var j = 0; j <= i; j++) es[loop[j][0] + '-' + loop[j][1]] = j === i ? 'active' : 'path';
        var ns = {}; ns[l[1]] = 'active'; if (i) ns[l[0]] = 'visited';
        var last = i === loop.length - 1;
        steps.push({
          g: graphAt(m, { nodes: ns, edges: es, badge: nb, pulse: key }),
          caption: 'Trade ' + l[0] + ' → ' + l[1] + ' at ×' + r.toFixed(3) + ': you now hold <b>' + amt.toFixed(2) + ' ' + l[1] + '</b>.' + (last ? ' Back in USD: ' + amt.toFixed(2) + ' versus the 100 you started with (' + pct(amt / 100) + ').' : '')
        });
      });
      void have; void hopNames;
      var es2 = {}, ns2 = {};
      loop.forEach(function (l) { es2[l[0] + '-' + l[1]] = gain ? 'error' : 'compare'; ns2[l[0]] = gain ? 'error' : 'visited'; });
      steps.push({
        g: graphAt(m, { nodes: ns2, edges: es2, badge: badge }),
        caption: gain
          ? 'Add the weights −ln(rate) around the loop: <b>' + wsum.toFixed(4) + '</b>, negative. A negative cycle is exactly a way to end with more than you started with. Bellman-Ford’s round V finds it, and you can repeat the loop for more.'
          : 'The weights −ln(rate) around the loop add up to <b>+' + wsum.toFixed(4) + '</b>, not negative. Every lap loses money, so there is no cycle for Bellman-Ford to find: no arbitrage.'
      });
      return { steps: steps, m: m, wsum: wsum, profit: profit, gain: gain };
    }
    function panel(b) {
      var m = b.m;
      var rows = [['USD', 'EUR'], ['EUR', 'GBP'], ['GBP', 'USD']].map(function (l) {
        var r = m.rates[l[0] + '>' + l[1]], w = -Math.log(r);
        return h('tr', null, h('th', { scope: 'row' }, l[0] + ' → ' + l[1]), h('td', { class: 'num' }, '×' + r.toFixed(3)), h('td', { class: 'num' + (w < 0 ? ' bf-neg' : '') }, (w < 0 ? '−' : '+') + Math.abs(w).toFixed(4)));
      });
      V.clear(wbox);
      wbox.appendChild(h('table', { class: 'table table--compact bf-wtable' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Trade'), h('th', { scope: 'col', class: 'num' }, 'Rate'), h('th', { scope: 'col', class: 'num' }, 'Weight −ln(rate)'))),
        h('tbody', null, rows),
        h('tfoot', null, h('tr', null, h('th', { scope: 'row', colspan: 2 }, 'Sum around the loop'), h('td', { class: 'num ' + (b.wsum < 0 ? 'bf-neg' : 'bf-pos') }, (b.wsum < 0 ? '−' : '+') + Math.abs(b.wsum).toFixed(4))))));
      var cyc = m.cyc;
      verdict.className = 'bf-verdict ' + (cyc ? 'is-bad' : 'is-ok');
      verdict.innerHTML = cyc
        ? '<b>Bellman-Ford check (round V):</b> an edge still relaxes, so there is a negative cycle: <b>' + cyc.join(' → ') + ' → ' + cyc[0] + '</b>. Arbitrage: one lap turns 100 into ' + (100 * SP.bestCycle(cur, m.rates).product).toFixed(2) + '.'
        : '<b>Bellman-Ford check (round V):</b> nothing relaxes. No negative cycle, so no sequence of trades beats standing still. The best loop returns ' + (100 * SP.bestCycle(cur, m.rates).product).toFixed(2) + ' per 100.';
    }
    function update() {
      var b = build();
      panel(b);
      if (!player) {
        player = V.player({ root: fig, steps: b.steps, caption: fig.querySelector('[data-caption]'), baseStepMs: 1900, label: 'Arbitrage walk-through controls', render: function (st, ctx) { view.render(st.g, { duration: ctx.duration }); } });
      } else player.setSteps(b.steps);
    }
    update();
  }

  /* ================================================================== the stopover idea: cost of one pair as stopovers are allowed */
  function ideaFigure(fig) {
    var G = L.CLRS, ids = G.nodes.map(function (n) { return n.id; });
    var raw = SP.floydWarshall(G, { mode: 'improve' });
    var snaps = [raw[0]].concat(raw.filter(function (st) { return st.kind === 'kend'; }));
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 320, label: 'Cheapest route between two vertices as more stopovers are allowed' });
    var stops = fig.querySelector('[data-stops]');
    var fromSel = fig.querySelector('[data-from]'), toSel = fig.querySelector('[data-to]');
    var from = 'S', to = 'Z';
    fillSelect(fromSel, ids, from); fillSelect(toSel, ids, to);
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', label: 'Newest allowed stopover' }, { state: 'visited', label: 'Allowed stopover' }, { state: 'active', label: 'From' }, { state: 'compare', label: 'To' }, { state: 'path', shape: 'line', label: 'Best route so far' }]);
    var chips = ids.map(function () { return null; }), costEls = [];
    function buildStops() {
      V.clear(stops);
      costEls = [];
      var row = h('div', { class: 'bf-stops__row' }, h('span', { class: 'bf-stops__cap' }, 'stopovers allowed'));
      var row2 = h('div', { class: 'bf-stops__row' }, h('span', { class: 'bf-stops__cap' }, 'cheapest ' + from + ' → ' + to));
      for (var s0 = 0; s0 <= ids.length; s0++) {
        row.appendChild(h('span', { class: 'bf-stop' }, s0 === 0 ? 'none' : '+' + ids[s0 - 1]));
        var ce = h('span', { class: 'bf-stop bf-stop--cost' }, '');
        costEls.push(ce); row2.appendChild(ce);
      }
      stops.appendChild(row); stops.appendChild(row2);
      void chips;
    }
    var player;
    function steps() {
      var i = ids.indexOf(from), j = ids.indexOf(to);
      return snaps.map(function (sn, s0) {
        var d = sn.d[i][j], path = i === j ? [i] : SP.pathFromNext(sn.next, i, j);
        var prev = s0 ? snaps[s0 - 1].d[i][j] : undefined;
        var allowed = ids.slice(0, s0), c;
        if (i === j) c = 'A vertex reaches itself for free: 0, whatever is allowed. Pick two different vertices to see the routes change.';
        else if (s0 === 0) c = 'No stopovers allowed: only a <b>direct edge</b> from ' + from + ' to ' + to + ' counts. ' + (d === null ? 'There is none, so the cost is ∞.' : 'It costs ' + SP.fmtD(d) + '.');
        else {
          var nm = ids[s0 - 1];
          if (d === prev) c = 'Now <b>' + nm + '</b> may also be a stopover. Nothing gets cheaper: ' + (d === null ? 'still no route from ' + from + ' to ' + to + ' that stops only at ' + allowed.join(', ') + '.' : 'the best route still costs ' + SP.fmtD(d) + '.');
          else c = 'Now <b>' + nm + '</b> may also be a stopover, and it pays off: the cost drops from <b>' + SP.fmtD(prev) + '</b> to <b>' + SP.fmtD(d) + '</b> along ' + (path ? path.map(function (x) { return ids[x]; }).join(' → ') : '…') + '.';
        }
        return { d: d, path: path, s: s0, i: i, j: j, allowed: allowed, caption: c, costs: snaps.map(function (x) { return x.d[i][j]; }) };
      });
    }
    function render(st, ctx) {
      var pe = {}, onp = {};
      if (st.path) st.path.forEach(function (ix, a) { onp[ids[ix]] = true; if (a + 1 < st.path.length) pe[ids[ix] + '-' + ids[st.path[a + 1]]] = true; });
      view.render({
        nodes: G.nodes.map(function (n, ix) {
          var state = 'default';
          if (st.allowed.indexOf(n.id) >= 0) state = st.allowed[st.allowed.length - 1] === n.id ? 'pivot' : 'visited';
          if (ix === st.i) state = 'active'; else if (ix === st.j) state = 'compare';
          return { id: n.id, x: n.x, y: n.y, state: state };
        }),
        edges: G.edges.map(function (e) { var k = L.edgeKey(e); return { id: k, from: e.from, to: e.to, directed: true, weight: e.w, state: pe[k] ? 'path' : 'default' }; })
      }, { duration: ctx.duration });
      V.$$('.bf-stops__row:first-child .bf-stop', stops).forEach(function (el, x) { el.classList.toggle('is-on', x <= st.s); el.classList.toggle('is-cur', x === st.s); });
      costEls.forEach(function (el, x) {
        el.textContent = x <= st.s ? SP.fmtD(st.costs[x]) : '';
        el.classList.toggle('is-cur', x === st.s);
        el.classList.toggle('is-drop', x > 0 && x <= st.s && st.costs[x] !== st.costs[x - 1]);
      });
    }
    buildStops();
    player = V.player({ root: fig, steps: steps(), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 2300, label: 'Stopover controls' });
    function reload() { buildStops(); player.setSteps(steps()); }
    fromSel.addEventListener('change', function () { from = fromSel.value; reload(); });
    toSel.addEventListener('change', function () { to = toSel.value; reload(); });
  }

  /* ================================================================== path reconstruction with the next-hop matrix */
  function nextFigure(fig) {
    var G = L.CLRS, ids = G.nodes.map(function (n) { return n.id; });
    var res = SP.fwResult(G);
    var gview = V.views.graph(fig.querySelector('[data-graph]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 340, label: 'The graph, with the route being rebuilt' });
    var mview = V.views.grid(fig.querySelector('[data-matrix]'), { cellSize: 52, label: 'Next-hop matrix' });
    var fromSel = fig.querySelector('[data-from]'), toSel = fig.querySelector('[data-to]');
    var from = 'Y', to = 'S';
    fillSelect(fromSel, ids, from); fillSelect(toSel, ids, to);
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Where you are' }, { state: 'compare', label: 'Destination j' }, { state: 'path', shape: 'line', label: 'Hops taken' }, { state: 'key', label: 'Cell being read' }]);
    var W = {}; G.edges.forEach(function (e) { W[e.from + '>' + e.to] = e.w; });
    function steps() {
      var i = ids.indexOf(from), j = ids.indexOf(to), out = [];
      var path = SP.pathFromNext(res.next, i, j);
      var total = res.d[i][j];
      if (i === j) return [{ cur: i, j: j, taken: [], done: true, caption: 'From and to are the same vertex: the route is empty and costs 0. Pick two different vertices.' }];
      if (!path) return [{ cur: i, j: j, taken: [], done: true, caption: 'next[' + from + '][' + to + '] is empty: there is <b>no route</b> from ' + from + ' to ' + to + ', and d[' + from + '][' + to + '] is ∞.' }];
      out.push({ cur: i, j: j, taken: [], caption: 'The distance matrix says the cheapest ' + from + ' → ' + to + ' costs <b>' + SP.fmtD(total) + '</b>, but not <em>which way</em> to go. The next-hop matrix stores the first step of every best route. Start at <b>' + from + '</b> and look up <code>next[' + from + '][' + to + ']</code>.', read: [i, j] });
      for (var a = 0; a + 1 < path.length; a++) {
        var c = path[a], n2 = path[a + 1];
        var taken = path.slice(0, a + 2);
        out.push({ cur: n2, j: j, taken: taken, prevCur: c, caption: 'next[' + ids[c] + '][' + to + '] = <b>' + ids[n2] + '</b>: from ' + ids[c] + ' the best route to ' + to + ' starts with the edge ' + ids[c] + ' → ' + ids[n2] + ' (' + SP.fmtW(W[ids[c] + '>' + ids[n2]]) + ').' + (n2 === j ? ' That is the destination.' : ' Now look up <code>next[' + ids[n2] + '][' + to + ']</code>.'), read: [c, j], done: n2 === j });
      }
      var costs = []; for (var q = 0; q + 1 < path.length; q++) costs.push(SP.fmtW(W[ids[path[q]] + '>' + ids[path[q + 1]]]));
      out.push({ cur: j, j: j, taken: path, caption: 'Arrived. Route: <b>' + path.map(function (x) { return ids[x]; }).join(' → ') + '</b>, with edge costs ' + costs.join(' + ') + ' = <b>' + SP.fmtD(total) + '</b>, exactly d[' + from + '][' + to + ']. One matrix answers every pair, one hop at a time.', read: null, done: true, final: true });
      return out;
    }
    function render(st, ctx) {
      var pe = {};
      for (var a = 0; a + 1 < st.taken.length; a++) pe[ids[st.taken[a]] + '-' + ids[st.taken[a + 1]]] = true;
      gview.render({
        nodes: G.nodes.map(function (n, ix) { return { id: n.id, x: n.x, y: n.y, state: ix === st.cur ? (st.final ? 'found' : 'active') : (ix === st.j ? 'compare' : (st.taken.indexOf(ix) >= 0 ? 'visited' : 'default')) }; }),
        edges: G.edges.map(function (e) { var k = L.edgeKey(e); return { id: k, from: e.from, to: e.to, directed: true, weight: e.w, state: pe[k] ? 'path' : 'default' }; })
      }, { duration: ctx.duration });
      var cells = ids.map(function (_, r) {
        return ids.map(function (__, c) {
          var nx = res.next[r][c];
          var cell = { text: r === c ? '·' : (nx === null ? '–' : ids[nx]), state: 'default' };
          if (r === c) cell.state = 'muted';
          if (st.read && st.read[0] === r && st.read[1] === c) cell.state = 'key';
          return cell;
        });
      });
      mview.render({ rows: ids.length, cols: ids.length, cells: cells, rowHeaders: ids, colHeaders: ids, corner: 'next[i][j]', highlightCol: { index: st.j, state: 'compare' }, cursor: st.read ? { cell: st.read, state: 'key' } : undefined }, { duration: ctx.duration });
    }
    var player = V.player({ root: fig, steps: steps(), render: render, caption: fig.querySelector('[data-caption]'), baseStepMs: 2100, label: 'Next-hop walk controls' });
    function reload() { player.setSteps(steps()); }
    fromSel.addEventListener('change', function () { from = fromSel.value; reload(); });
    toSel.addEventListener('change', function () { to = toSel.value; reload(); });
  }

  /* ================================================================== operations vs V (chart) */
  function costFigure(fig) {
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', height: 360, label: 'Operations needed for all-pairs shortest paths as the number of vertices grows' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { fw: 'Floyd-Warshall', dijkstra: 'Dijkstra × V', johnson: 'Johnson', bellman: 'Bellman-Ford × V' }, states: { fw: 'active', dijkstra: 'done', johnson: 'pivot', bellman: 'compare' }, format: function (v) { return big(v); } });
    var density = 'sparse', log = true, n = 60, first = true;
    var slider;
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Floyd-Warshall V³' }, { state: 'done', shape: 'line', label: 'Dijkstra from every vertex' }, { state: 'pivot', shape: 'line', label: 'Johnson' }, { state: 'compare', shape: 'line', label: 'Bellman-Ford from every vertex' }]);
    var defs = [
      { id: 'fw', label: 'Floyd-Warshall', state: 'active', f: 'fw' },
      { id: 'dijkstra', label: 'Dijkstra × V', state: 'done', f: 'dijkstra' },
      { id: 'johnson', label: 'Johnson', state: 'pivot', f: 'johnson', dashed: true },
      { id: 'bellman', label: 'Bellman-Ford × V', state: 'compare', f: 'bellman' }
    ];
    function draw(dur) {
      var top = SP.opModel(200, density), maxv = Math.max(top.fw, top.dijkstra, top.johnson, top.bellman);
      var series = defs.map(function (d) { return { id: d.id, label: d.label, state: d.state, dashed: d.dashed, domain: [4, 200], samples: 60, fn: function (x) { return SP.opModel(x, density)[d.f]; } }; });
      var cur = SP.opModel(n, density);
      chart.render({
        x: { label: 'number of vertices V', min: 4, max: 200 },
        y: log ? { label: 'operations (log scale)', scale: 'log', min: 100, max: Math.pow(10, Math.ceil(Math.log10(maxv))) } : { label: 'operations', min: 0, max: maxv * 1.05 },
        series: series,
        highlight: defs.map(function (d) { return { series: d.id, x: n }; })
      }, { duration: first ? 700 : dur });
      first = false;
      stats.update({ fw: cur.fw, dijkstra: cur.dijkstra, johnson: cur.johnson, bellman: cur.bellman });
    }
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Graph density', value: 'sparse',
      options: [{ value: 'sparse', label: 'Sparse: E = 3V' }, { value: 'dense', label: 'Dense: E ≈ V²/2' }],
      onChange: function (v) { density = v; draw(700); }
    });
    V.toggle(fig.querySelector('[data-log]'), { label: 'Log scale', checked: true, onChange: function (c) { log = c; draw(900); } });
    slider = V.slider(fig.querySelector('[data-slider]'), { label: 'Vertices V', min: 5, max: 200, step: 1, value: n, format: function (v) { return String(v); }, onInput: function (v) { n = v; draw(150); } });
    void slider;
    V.onVisible(fig, function (vis) { if (vis && first) draw(0); });
    draw(0);
  }

  /* ================================================================== which algorithm? (interactive decision tree) */
  var CHOOSE = {
    nodes: [
      { id: 'q1', type: 'decision', text: 'Unweighted?', col: 0, row: 0 },
      { id: 'bfs', type: 'end', text: 'BFS\n(lesson 26)', col: 1, row: 0 },
      { id: 'q2', type: 'decision', text: 'Negative\nweights?', col: 0, row: 1 },
      { id: 'q3', type: 'decision', text: 'Every pair\nof vertices?', col: 0, row: 2 },
      { id: 'dij', type: 'end', text: 'Dijkstra or A*\n(lesson 28)', col: 1, row: 2 },
      { id: 'fwA', type: 'end', text: 'Floyd-Warshall if dense,\nV × Dijkstra if sparse', col: 0, row: 3, maxWidth: 170 },
      { id: 'q4', type: 'decision', text: 'Every pair\nof vertices?', col: 2, row: 1 },
      { id: 'fwB', type: 'end', text: 'Floyd-Warshall if dense,\nJohnson if sparse', col: 3, row: 1, maxWidth: 170 },
      { id: 'q5', type: 'decision', text: 'A DAG?', col: 2, row: 2 },
      { id: 'dag', type: 'end', text: 'DP in topological\norder (lesson 27)', col: 3, row: 2, maxWidth: 150 },
      { id: 'bf', type: 'end', text: 'Bellman-Ford', col: 2, row: 3 }
    ],
    edges: [
      { from: 'q1', to: 'bfs', label: 'yes' }, { from: 'q1', to: 'q2', label: 'no' },
      { from: 'q2', to: 'q3', label: 'no' }, { from: 'q2', to: 'q4', label: 'yes' },
      { from: 'q3', to: 'dij', label: 'no' }, { from: 'q3', to: 'fwA', label: 'yes' },
      { from: 'q4', to: 'fwB', label: 'yes' }, { from: 'q4', to: 'q5', label: 'no' },
      { from: 'q5', to: 'dag', label: 'yes' }, { from: 'q5', to: 'bf', label: 'no' }
    ]
  };
  var CHOOSE_TEXT = {
    q1: 'Start here: are all the edges alike (or unweighted), so a path is just “fewest edges”? Pick <b>yes</b> or <b>no</b> on the lit question (click a label, or Tab to it and press Enter).',
    q2: 'Weighted. Can any edge weight be <em>negative</em>: a discount, a refund, a reward?',
    q3: 'No negative weights. Do you need the distance between <em>every</em> pair of vertices, or from one source?',
    q4: 'Negative weights are in play, so Dijkstra is out. Do you need every pair, or one source?',
    q5: 'One source, negative weights. Is the graph acyclic (a DAG)? Then one pass in topological order is enough.',
    bfs: '<b>BFS</b> (lesson 26). With equal weights a queue visits vertices in order of distance.',
    dij: '<b>Dijkstra or A*</b> (lesson 28). Non-negative weights let a priority queue finish vertices in order. A* adds a heuristic when you only want one target.',
    fwA: '<b>All pairs, no negative edges.</b> Dense graph: Floyd-Warshall’s O(V³) with tiny constants wins. Sparse: V runs of Dijkstra cost less. This lesson’s Floyd-Warshall also works here.',
    fwB: '<b>All pairs with negative edges.</b> Dense: <b>Floyd-Warshall</b>, O(V³). Sparse: <b>Johnson</b>, one Bellman-Ford to reweight and then V runs of Dijkstra. Both are in this lesson.',
    dag: '<b>DP in topological order</b> (lesson 27): relax each vertex’s edges once, in order. Negative edges are fine and it is O(V + E), no cycles exist to worry about.',
    bf: '<b>Bellman-Ford.</b> One source, negative edges, cycles possible: O(V·E), and round V tells you when the answer does not exist.'
  };
  function chooseFigure(fig) {
    var lesson = { fwA: 'pivot', fwB: 'pivot', bf: 'pivot' };
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), CHOOSE, { interactive: true, label: 'Which shortest-path algorithm to use' });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', label: 'Covered in this lesson' }, { state: 'active', label: 'Your question' }, { state: 'found', label: 'Your answer' }]);
    var cap = fig.querySelector('[data-caption]');
    var path, taken;
    function reset() {
      path = ['q1']; taken = {};
      view.render({ active: 'q1', states: lesson }, { duration: 0 });
      cap.innerHTML = CHOOSE_TEXT.q1;
    }
    view.on('choose', function (e) {
      path.push(e.to); taken[e.node + '->' + e.to] = 'path';
      var end = CHOOSE.nodes.some(function (n) { return n.id === e.to && n.type === 'end'; });
      var states = Object.assign({}, lesson);
      if (end) states[e.to] = 'found';
      view.render({ active: e.to, visited: path.slice(0, -1), edgeStates: Object.assign({}, taken), states: states }, { duration: 500 });
      cap.innerHTML = CHOOSE_TEXT[e.to] + (end ? ' Press “Start over” to try another route.' : '');
    });
    fig.querySelector('[data-restart]').addEventListener('click', reset);
    reset();
  }

  /* ================================================================== variations */
  function johnsonFigure(fig) {
    var G = L.CLRS, J = SP.johnson(G);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 340, label: 'Johnson reweighting: original and reweighted edge weights' });
    var cap = fig.querySelector('[data-caption]');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', shape: 'line', label: 'Negative edge' }, { state: 'done', shape: 'line', label: 'Was negative, now ≥ 0' }, { state: 'key', label: 'Potential h(v)' }]);
    var mode = 'orig';
    function draw(dur) {
      var reweighted = mode === 're';
      view.render({
        nodes: G.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y, state: 'key', badge: 'h=' + J.h[n.id] }; }),
        edges: J.edges.map(function (e) {
          var neg = e.w < 0;
          return { id: e.from + '-' + e.to, from: e.from, to: e.to, directed: true, weight: reweighted ? e.w2 : e.w, state: neg ? (reweighted ? 'done' : 'compare') : 'default' };
        })
      }, { duration: dur });
      var ex = J.edges.filter(function (e) { return e.w < 0; })[0];
      cap.innerHTML = reweighted
        ? 'Every edge now weighs <b>w′(u, v) = w(u, v) + h(u) − h(v)</b>, and none is negative (for T → Z: −4 + h(T) − h(Z) = ' + J.edges.filter(function (e) { return e.from === 'T' && e.to === 'Z'; })[0].w2 + '). Any route from s to t changes by the same h(s) − h(t), so the <em>cheapest</em> route is still the cheapest. Dijkstra from every vertex now works.'
        : 'Original weights, with ' + J.edges.filter(function (e) { return e.w < 0; }).length + ' negative edges (amber). To fix them, run <b>one Bellman-Ford</b> from an imaginary vertex joined to everything by 0-weight edges. Its distances are the potentials <b>h(v)</b> shown on the vertices (' + G.nodes.map(function (n) { return n.id + ' ' + J.h[n.id]; }).join(', ') + '). Example: ' + ex.from + ' → ' + ex.to + ' is ' + ex.w + '.';
    }
    V.segmented(fig.querySelector('[data-seg]'), { label: 'Edge weights', value: 'orig', options: [{ value: 'orig', label: 'Original w' }, { value: 're', label: 'Reweighted w′ ≥ 0' }], onChange: function (v) { mode = v; draw(800); } });
    draw(0);
  }

  function closureFigure(fig) {
    var g = L.G([['A', 130, 300], ['B', 380, 110], ['C', 650, 110], ['D', 650, 490], ['E', 900, 300]], [['E', 'A', 1], ['A', 'B', 1], ['B', 'C', 1], ['C', 'D', 1], ['D', 'B', 1]]);
    var steps = SP.warshallClosure(g);
    var gview = V.views.graph(fig.querySelector('[data-graph]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 320, label: 'A small directed graph' });
    var mview = V.views.grid(fig.querySelector('[data-matrix]'), { cellSize: 50, label: 'Reachability matrix' });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', label: 'Stopover k' }, { state: 'found', label: 'Newly reachable' }, { state: 'key', label: 'The two 1s combined' }, { state: 'visited', label: 'Found earlier' }]);
    V.player({
      root: fig, steps: steps.map(function (st) { var o = Object.assign({}, st); o.vars = {}; return o; }), caption: fig.querySelector('[data-caption]'), baseStepMs: 1100, speeds: [0.5, 1, 2, 4], label: 'Transitive closure controls',
      render: function (st, ctx) {
        gview.render(L.fwGraphState(g, st, { noWeights: true }), { duration: ctx.duration });
        mview.render(L.fwGridState(st, { bool: true, corner: 'i \\ j' }), { duration: ctx.duration });
      }
    });
  }

  function reportFigure(fig) {
    var steps = SP.bellmanFord(L.CYCLE, 'S'), st = L.last(steps);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 300, label: 'The negative cycle found by walking parent pointers back' });
    view.render(L.bfGraphState(L.CYCLE, st), { duration: 0 });
    var pre = fig.querySelector('[data-code-block]');
    V.codeBlock(pre, [
      'x = v                       // the vertex relaxed in round V',
      'for (let i = 0; i < n; i++) // step back V times: now certainly on the cycle',
      '  x = parent[x];',
      'const cycle = [x];',
      'for (let y = parent[x]; y !== x; y = parent[y]) cycle.push(y);',
      'cycle.reverse();            // now in edge direction'
    ].join('\n'), 'js');
    fig.querySelector('[data-note]').innerHTML = 'In the lab’s negative-cycle preset, round V relaxes an edge into <b>' + st.v + '</b>. Following the little “← parent” labels back V times lands on <b>' + st.cycle.join(' → ') + ' → ' + st.cycle[0] + '</b>, which weighs ' + SP.fmtW(SP.cycleWeight(L.CYCLE.edges, st.cycle)) + '.';
  }

  function variations() {
    V.tabs('#variants', {});
    L.lazy('#fig-johnson', johnsonFigure);
    L.lazy('#fig-closure', closureFigure);
    L.lazy('#fig-report', reportFigure);
  }

  /* ================================================================== checks */
  function checks() {
    var fig = V.$('#fig-quiz-layers');
    var g = L.CLRS, lay = L.last(SP.layers(g, 'S'));
    var pe = {};
    Object.keys(lay.paths).forEach(function (id) { var p = lay.paths[id]; for (var a = 0; a + 1 < p.length; a++) pe[p[a] + '-' + p[a + 1]] = true; });
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 320, label: 'Cheapest routes from S, drawn as a tree' });
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'path', shape: 'line', label: 'Edge on a cheapest route from S' }, { state: 'default', shape: 'line', label: 'Other edge' }]);
    view.render({
      nodes: g.nodes.map(function (n) { return { id: n.id, x: n.x, y: n.y, state: n.id === 'S' ? 'active' : 'done', badge: lay.dist[n.id] }; }),
      edges: g.edges.map(function (e) { var k = L.edgeKey(e); return { id: k, from: e.from, to: e.to, directed: true, weight: e.w, state: pe[k] ? 'path' : 'default' }; })
    }, { duration: 0 });
    L.tagNodes(view, function (id) { return 'Vertex ' + id + ', distance ' + lay.dist[id]; });
    var len = {}; Object.keys(lay.paths).forEach(function (id) { len[id] = lay.paths[id].length - 1; });
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-layers', id: 'click-most-rounds',
      question: 'The orange edges are the cheapest routes from S. <b>Click the vertex that needs the most edges</b>, and so the most Bellman-Ford rounds, before its distance is final.',
      check: function (id) {
        if (id === 'Z') return true;
        return { correct: false, message: id === 'S' ? 'S is the source: 0 edges, final before round 1.' : id + ' is reached with ' + len[id] + (len[id] === 1 ? ' edge' : ' edges') + ' (' + lay.paths[id].join(' → ') + '). Count the edges on the orange route to each vertex: one of them needs more.' };
      },
      right: 'Z is reached by S → Y → X → T → Z: 4 edges, so its distance cannot be final before round 4. That equals V − 1 = 4, the most any shortest path can need.'
    });

    V.quiz('#quiz-vminus1', {
      id: 'quiz-why-v-minus-1',
      question: 'Why are V − 1 rounds enough for Bellman-Ford when there is no negative cycle?',
      options: ['Each round fixes exactly one vertex for good', 'A cheapest path never repeats a vertex, so it has at most V − 1 edges, and round k settles every path of k edges', 'There are only V − 1 edges in a typical graph', 'Negative edges can only be used once each'],
      answer: 1,
      explain: [
        'Not quite: one round can settle several vertices at once (or none). The reason is about path length, not one vertex per round.',
        'After round k every distance is at most the cost of the best route with ≤ k edges. A route that repeats a vertex contains a loop, and without a negative cycle the loop costs ≥ 0, so cutting it out never hurts. So a best route needs at most V − 1 edges.',
        'Graphs can have far more than V − 1 edges (up to V² − V). The count comes from path length.',
        'Bellman-Ford relaxes every edge in every round; nothing limits how often an edge is used in a route being built.'
      ]
    });
    V.quiz('#quiz-roundv', {
      id: 'quiz-round-v',
      question: 'After V − 1 rounds you run one more round and an edge <em>still</em> lowers a distance. What does that tell you?',
      options: ['There is a bug in the code', 'A negative cycle is reachable from the source, so shortest distances do not exist', 'Round V − 1 was one round short; run more rounds', 'The graph has a zero-weight edge'],
      answer: 1,
      explain: [
        'The algorithm is fine. It is telling you something about the input.',
        'All shortest simple paths were already found by round V − 1. An improvement now must come from a route that loops, and a loop only helps if its total weight is negative. Each lap lowers the numbers again, so no answer exists.',
        'No number of extra rounds helps: every lap around a negative cycle lowers the distances again, so they never settle.',
        'A weight of 0 gives a sum that is not strictly less than the current distance, so it never triggers a relaxation.'
      ]
    });
    V.quiz('#quiz-log', {
      id: 'quiz-why-log',
      question: 'Rates multiply along a chain of trades, but Bellman-Ford adds weights. Why is −log(rate) the right weight for arbitrage?',
      options: ['log turns products into sums, and the minus sign turns “product above 1” into “sum below 0”', 'log makes every rate positive, which Bellman-Ford requires', 'The minus sign makes the graph acyclic', 'It makes every weight an integer'],
      answer: 0,
      explain: [
        'log(a·b·c) = log a + log b + log c, so a chain’s total weight is the sum of its edges. And a product above 1 has a negative log-sum with the minus sign, exactly a negative cycle.',
        'Bellman-Ford needs no such thing (negative weights are its point). With rates above 1, −log(rate) is negative, and that is what creates the negative cycle.',
        'It does nothing to cycles: the graph stays exactly as cyclic as before. It changes only the meaning of “cheaper”.',
        'Logs of rates are real numbers, not integers. The algorithm does not care.'
      ]
    });
    V.quiz('#quiz-fwneg', {
      id: 'quiz-fw-negative',
      question: 'Floyd-Warshall has finished. How do you find out whether the graph has a negative cycle?',
      options: ['Some d[i][i] on the diagonal is negative', 'Some d[i][j] is ∞', 'Some d[i][j] is negative', 'Run a fourth loop over k'],
      answer: 0,
      explain: [
        'd[i][i] starts at 0 (the empty route). If it ever becomes negative, there is a route from i back to i that costs less than nothing: a negative cycle through i.',
        '∞ only means j cannot be reached from i. That happens in perfectly ordinary graphs.',
        'Negative distances are fine: an edge with a reward makes d[i][j] negative without any cycle (in the lab’s lesson graph, d[T][Z] is −4).',
        'No extra loop is needed. The diagonal already holds the answer.'
      ]
    });
    V.quiz('#quiz-choose', {
      id: 'quiz-choose-algo',
      question: 'You have 300 cities joined by flights, some with negative “fares” (rebates), no negative cycles, and you need the cheapest fare between <b>every pair</b>. The graph is dense. Which fits best?',
      options: ['BFS from every city', 'Dijkstra from every city', 'Floyd-Warshall, O(V³) with three tiny loops', 'Bellman-Ford from every city'],
      answer: 2,
      explain: [
        'BFS counts edges, not fares, so it gives the fewest flights, not the cheapest.',
        'Dijkstra needs non-negative weights. A rebate can make it lock a city too early, as in the first figure.',
        '300³ = 27 million steps, fast, works with negative weights, and gives every pair at once. On a dense graph nothing beats it.',
        'It would work, but costs V · V · E ≈ 300 · 300 · 45,000 = 4 billion steps on a dense graph, about 150 times more.'
      ]
    });
  }

  /* ================================================================== summary card */
  function summaryCard() {
    var grid = V.$('#summary-card .summary__grid');
    function svg(children, label) {
      var el = s('svg', { viewBox: '0 0 160 80', role: 'img', 'aria-label': label });
      children.forEach(function (c) { el.appendChild(c); });
      return el;
    }
    function C(x, y, st, text) {
      var fill = st === 'default' ? 'var(--el-fill)' : st === 'visited' ? 'color-mix(in srgb, var(--st-visited) 25%, var(--el-fill))' : 'var(--st-' + st + ')';
      var g = s('g', null, s('circle', { cx: x, cy: y, r: 11, style: 'fill:' + fill + ';stroke:' + (st === 'default' ? 'var(--el-stroke)' : 'var(--st-' + st + ')') + ';stroke-width:1.5' }));
      if (text !== undefined) g.appendChild(s('text', { x: x, y: y + 3.5, 'text-anchor': 'middle', style: 'font:700 10px var(--font-mono);fill:' + (st === 'default' || st === 'visited' ? 'var(--el-ink)' : 'var(--on-state)') }, text));
      return g;
    }
    function E(x1, y1, x2, y2, st, label) {
      var st2 = st ? 'var(--st-' + st + ')' : 'var(--el-edge)';
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
      var ex = x2 - ux * 12, ey = y2 - uy * 12;
      var g = s('g', null, s('line', { x1: x1 + ux * 12, y1: y1 + uy * 12, x2: ex, y2: ey, style: 'stroke:' + st2 + ';stroke-width:' + (st ? 2.2 : 1.5) }),
        s('path', { d: 'M' + ex + ' ' + ey + ' l' + (-ux * 6 - uy * 3.5) + ' ' + (-uy * 6 + ux * 3.5) + ' l' + (uy * 7) + ' ' + (-ux * 7) + ' z', style: 'fill:' + st2 }));
      if (label !== undefined) g.appendChild(s('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle', style: 'font:700 9px var(--font-mono);fill:var(--ink-2)' }, label));
      return g;
    }
    var tiles = [
      { viz: svg([E(30, 40, 130, 40, 'active', '−2'), C(30, 40, 'visited', 3), C(130, 40, 'compare', 1)], 'Relaxation'),
        label: 'Relax an edge', text: 'd[v] = min(d[v], d[u] + w). Distances only ever go down, and every value is a cost you really could achieve.' },
      { viz: svg([1, 2, 3, 4].map(function (r, i) { return s('rect', { x: 14 + i * 28, y: 22, width: 24, height: 22, rx: 5, style: 'fill:color-mix(in srgb, var(--st-done) 28%, var(--el-fill));stroke:var(--st-done);stroke-width:1.5' }); })
        .concat([1, 2, 3, 4].map(function (r, i) { return s('text', { x: 26 + i * 28, y: 37, 'text-anchor': 'middle', style: 'font:700 10px var(--font-mono);fill:var(--el-ink)' }, 'R' + r); }))
        .concat([s('rect', { x: 126, y: 22, width: 24, height: 22, rx: 5, style: 'fill:color-mix(in srgb, var(--st-error) 25%, var(--el-fill));stroke:var(--st-error);stroke-width:1.5' }), s('text', { x: 138, y: 37, 'text-anchor': 'middle', style: 'font:700 8.5px var(--font-mono);fill:var(--el-ink)' }, 'V?'), s('text', { x: 80, y: 66, 'text-anchor': 'middle', style: 'font:600 9px var(--font-sans);fill:var(--ink-3)' }, 'V − 1 rounds, then one check')]), 'Rounds'),
        label: 'V − 1 rounds, then a check', text: 'A cheapest path has at most V − 1 edges. Stop early when a round changes nothing. If round V still improves, there is a negative cycle.' },
      { viz: svg([E(40, 55, 80, 20, 'error'), E(80, 20, 120, 55, 'error'), E(120, 55, 40, 55, 'error'), C(40, 55, 'error', 2), C(80, 20, 'error', 3), C(120, 55, 'error', -6), s('text', { x: 80, y: 47, 'text-anchor': 'middle', style: 'font:700 10px var(--font-mono);fill:var(--st-error)' }, '−1')], 'Negative cycle'),
        label: 'Negative cycle', text: 'A loop with negative total weight lowers distances forever. Bellman-Ford spots it in round V; Floyd-Warshall shows a negative diagonal.' },
      { viz: svg((function () {
        var out = [];
        for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
          var pivot = r === 1 || c === 1;
          out.push(s('rect', { x: 40 + c * 20, y: 0 + r * 19 + 2, width: 18, height: 17, rx: 3, style: 'fill:' + (pivot ? 'color-mix(in srgb, var(--st-pivot) 30%, var(--el-fill))' : 'var(--el-fill)') + ';stroke:' + (pivot ? 'var(--st-pivot)' : 'var(--el-stroke)') + ';stroke-width:1.2' }));
        }
        out.push(s('rect', { x: 100, y: 40, width: 18, height: 17, rx: 3, style: 'fill:var(--st-found);stroke:var(--st-found)' }));
        return out;
      }()), 'Matrix pass'),
        label: 'Pass k = row k + column k', text: 'd[i][j] = min(d[i][j], d[i][k] + d[k][j]). Three loops, k outermost: after pass k, routes may stop over at the first k vertices.' },
      { viz: svg([E(30, 40, 65, 40, 'path'), E(65, 40, 100, 40, 'path'), E(100, 40, 135, 40, 'path'), C(30, 40, 'active', 'Y'), C(65, 40, 'visited', 'X'), C(100, 40, 'visited', 'T'), C(135, 40, 'found', 'S'), s('text', { x: 80, y: 70, 'text-anchor': 'middle', style: 'font:600 9px var(--font-mono);fill:var(--ink-3)' }, 'next[Y][S] = X, next[X][S] = T …')], 'Next hop'),
        label: 'Next hops rebuild routes', text: 'On every update next[i][j] ← next[i][k]. Follow next[·][j] from i to read off a cheapest route in O(path length).' },
      { viz: svg([s('text', { x: 80, y: 30, 'text-anchor': 'middle', style: 'font:700 15px var(--font-mono);fill:var(--st-compare)' }, 'O(V·E)'), s('text', { x: 80, y: 58, 'text-anchor': 'middle', style: 'font:700 15px var(--font-mono);fill:var(--st-active)' }, 'O(V³)')], 'Costs'),
        label: 'Bellman-Ford O(V·E), Floyd-Warshall O(V³)', text: 'One source: V − 1 rounds of E edges. All pairs: V passes of V² cells. Johnson’s reweighting wins on sparse graphs.' }
    ];
    tiles.forEach(function (t) {
      grid.appendChild(h('div', { class: 'summary__item' },
        h('div', { class: 'summary__viz stage-grid' }, t.viz),
        h('p', { class: 'summary__label' }, t.label),
        h('p', { class: 'summary__text' }, t.text)));
    });
  }

  V.ready(function () {
    L.lazy('#fig-arb', arbFigure);
    L.lazy('#fig-idea', ideaFigure);
    L.lazy('#fig-next', nextFigure);
    L.lazy('#fig-cost', costFigure);
    L.lazy('#fig-choose', chooseFigure);
    variations();
    checks();
    summaryCard();
  });
}());
