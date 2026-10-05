/* Lesson 25 · Graphs & representations — part 2: the live graph builder and the matrix-versus-list lab. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var G = V.algos.graphs, L = V.L25;

  /* ================================================================== keyed chips and rows (identity between renders) */
  /* items: [{key, text, cls}] -> chips inside host; existing chips keep their element (class changes transition). */
  function chipSync(host, items) {
    var map = host._chips || (host._chips = {});
    var want = {};
    items.forEach(function (it) { want[it.key] = true; });
    Object.keys(map).forEach(function (k) { if (!want[k]) { map[k].remove(); delete map[k]; } });
    items.forEach(function (it, i) {
      var el = map[it.key];
      if (!el) el = map[it.key] = h('span', { class: 'g25-chip' });
      el.className = 'g25-chip' + (it.cls ? ' ' + it.cls : '');
      if (el.textContent !== it.text) el.textContent = it.text;
      if (host.children[i] !== el) host.insertBefore(el, host.children[i] || null);
    });
    var empty = host._empty;
    if (!items.length) { if (!empty) { empty = host._empty = h('span', { class: 'g25-chip__empty' }, host.dataset.empty || 'empty'); host.appendChild(empty); } }
    else if (empty) { empty.remove(); host._empty = null; }
  }
  /* rows: [{id, head, cls, chips: [...]}] -> "A → [B][C]" rows keyed by id */
  function rowSync(host, rows) {
    var map = host._rows || (host._rows = {});
    var want = {};
    rows.forEach(function (r) { want[r.id] = true; });
    Object.keys(map).forEach(function (k) { if (!want[k]) { map[k].el.remove(); delete map[k]; } });
    rows.forEach(function (r, i) {
      var rec = map[r.id];
      if (!rec) {
        var chips = h('span', { class: 'g25-lrow__chips' });
        rec = map[r.id] = { el: h('div', { class: 'g25-lrow' }, h('span', { class: 'g25-lrow__head' }, r.head), h('span', { class: 'g25-lrow__arrow', 'aria-hidden': 'true' }, '→'), chips), chips: chips };
      }
      rec.el.className = 'g25-lrow' + (r.cls ? ' ' + r.cls : '');
      chipSync(rec.chips, r.chips);
      if (host.children[i] !== rec.el) host.insertBefore(rec.el, host.children[i] || null);
    });
  }
  L.chipSync = chipSync; L.rowSync = rowSync;

  function circlePos(n, o) {
    return V.views.graph.layouts.circle(n, Object.assign({ w: 1000, h: 760, pad: 110 }, o || {}));
  }
  function cap(n) { return n; }

  /* ================================================================== 1. the graph builder */
  function builder(fig) {
    var stage = fig.querySelector('[data-editor]');
    var matrixHost = fig.querySelector('[data-matrix]'), listHost = fig.querySelector('[data-list]'), elistHost = fig.querySelector('[data-elist]');
    var msg = fig.querySelector('[data-msg]');
    var MAXV = 12;
    var directed = false, weighted = false;
    var ed = null, lastGood = null, sel = null, rep = null;
    var grid = V.views.grid(matrixHost, { mode: 'table', cellSize: 40, minCell: 22, label: 'Adjacency matrix of the graph you are drawing' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { V: 'Vertices V', E: 'Edges E', dens: 'Density', mcells: 'Matrix cells (V²)', lcells: 'List cells (V + entries)' }, states: { mcells: 'active', lcells: 'path' } });

    var START = { nodes: [{ id: 'A', x: 140, y: 220 }, { id: 'B', x: 420, y: 110 }, { id: 'C', x: 360, y: 430 }, { id: 'D', x: 640, y: 580 }, { id: 'E', x: 870, y: 330 }],
      edges: [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }, { from: 'D', to: 'E' }] };

    function edgeKey(e) {
      var a = String(e.from), b = String(e.to);
      if (!directed && G.natCmp(b, a) < 0) { var t = a; a = b; b = t; }
      return a + '-' + b;
    }
    function currentGraph() { return ed ? ed.getGraph() : START; }

    function create(graph) {
      if (ed) { ed.destroy(); V.clear(stage); }
      ed = V.views.graph(stage, { editable: true, directed: directed, weighted: weighted, bounds: { w: 1000, h: 760 }, maxHeight: 460, nodeRadius: 30,
        label: 'Graph editor. Click empty space to add a vertex, drag from one vertex to another to add an edge, click an edge to select it, press Delete to remove the selection.' });
      ed.setGraph(graph, { duration: 0 });
      lastGood = graph;
      sel = null;
      ed.on('change', onChange);
      ed.on('select', function (s) { sel = s; sync(200); });
      sync(0);
    }

    function onChange() {
      var g = ed.getGraph();
      sel = ed.selection();
      if (g.nodes.length > MAXV) {
        msg.textContent = 'That is ' + g.nodes.length + ' vertices. This figure stops at ' + MAXV + ' so the matrix stays readable, so the last vertex was removed.';
        ed.setGraph(lastGood, { duration: 200 });
        sel = null; sync(200);
        return;
      }
      msg.textContent = '';
      lastGood = g;
      sync(250);
    }

    function sync(dur) {
      var g = ed.getGraph();
      var edges = g.edges.map(function (e) { return { from: e.from, to: e.to, weight: weighted ? (e.weight === undefined || e.weight === null ? 1 : e.weight) : undefined }; });
      rep = G.build({ nodes: g.nodes.map(function (n) { return n.id; }), edges: edges, directed: directed });
      var selEdge = null, selNode = null;
      if (sel && sel.kind === 'edge') g.edges.forEach(function (e) { if (edgeKey(e) === sel.id) selEdge = e; });
      if (sel && sel.kind === 'node') selNode = sel.id;
      var ix = rep.index;
      // matrix
      var cells = rep.ids.map(function (u, i) {
        return rep.ids.map(function (w, j) {
          var on = rep.has[i][j];
          var hot = selEdge && ((String(selEdge.from) === u && String(selEdge.to) === w) || (!directed && String(selEdge.from) === w && String(selEdge.to) === u));
          var c = weighted ? (on ? { value: rep.matrix[i][j] } : { text: '–' }) : { value: on ? 1 : 0 };
          c.state = hot ? 'active' : on ? 'visited' : 'muted';
          return c;
        });
      });
      var st = { rows: rep.V, cols: rep.V, cells: cells, rowHeaders: rep.ids, colHeaders: rep.ids, corner: '' };
      if (selNode !== null && ix[selNode] !== undefined) { st.highlightRow = { index: ix[selNode], state: 'active' }; st.highlightCol = { index: ix[selNode], state: directed ? 'compare' : 'active' }; }
      if (rep.V === 0) grid.render({ rows: 0, cols: 0, cells: [] }, { duration: dur }); else grid.render(st, { duration: dur });
      // list
      rowSync(listHost, rep.ids.map(function (u) {
        var isNode = selNode === u;
        return { id: u, head: u, cls: isNode ? 'is-sel' : '', chips: rep.adj[u].map(function (e) {
          var hot = selEdge && ((String(selEdge.from) === u && String(selEdge.to) === e.to) || (!directed && String(selEdge.from) === e.to && String(selEdge.to) === u));
          return { key: u + '>' + e.to, text: weighted ? e.to + ' (' + e.w + ')' : e.to, cls: hot ? 'is-active' : '' };
        }) };
      }));
      // edge list
      chipSync(elistHost, rep.edgeList.map(function (e) {
        var hot = selEdge && String(selEdge.from) === e.from && String(selEdge.to) === e.to;
        return { key: e.from + '>' + e.to, text: '(' + e.from + (directed ? ' → ' : ', ') + e.to + (weighted ? ', ' + e.w : '') + ')', cls: hot ? 'is-active' : '' };
      }));
      var mem = G.memory(rep.V, rep.E, directed);
      stats.update({ V: rep.V, E: rep.E, dens: Math.round(G.density(rep.V, rep.E, directed) * 100) + '%', mcells: mem.matrix, lcells: mem.list });
      fig.querySelector('[data-caption]').innerHTML = describeSel(selEdge, selNode);
    }

    function describeSel(edge, node) {
      if (edge) {
        var u = String(edge.from), w = String(edge.to);
        return 'Edge <b>' + u + (directed ? ' → ' : ' – ') + w + '</b> is selected. In the matrix it is the cell in row ' + u + ', column ' + w + (directed ? '' : ' <em>and</em> its mirror in row ' + w + ', column ' + u + ' (an undirected edge is stored twice)') +
          '. In the list, ' + w + ' appears in ' + u + '’s row' + (directed ? '' : ' and ' + u + ' appears in ' + w + '’s row') + '. In the edge list it is one pair.';
      }
      if (node) {
        var d = rep.adj[node] ? rep.adj[node].length : 0;
        return 'Vertex <b>' + node + '</b> is selected: its list row has ' + d + ' ' + (d === 1 ? 'entry' : 'entries') + ' and the highlighted matrix row holds ' + d + ' non-zero ' + (d === 1 ? 'cell' : 'cells') + '. That is its ' + (directed ? 'out-' : '') + 'degree.';
      }
      return 'Draw in the top panel: click empty space to add a vertex, drag from one vertex to another to add an edge. The matrix, the list and the edge list below it update as you go. Click an edge or a vertex to see where it lives.';
    }

    function applyPreset(p) {
      var g = p();
      create(g);
    }
    function circleGraph(ids, pairs, opts) {
      var pos = circlePos(ids.length, opts);
      return { nodes: ids.map(function (id, i) { return { id: id, x: Math.round(pos[i].x), y: Math.round(pos[i].y) }; }), edges: pairs.map(function (p) { return { from: p[0], to: p[1] }; }) };
    }
    var PRESETS = [
      { label: 'Triangle + tail', fn: function () { return JSON.parse(JSON.stringify(START)); } },
      { label: 'Star', fn: function () {
        return { nodes: [{ id: 'A', x: 500, y: 380 }, { id: 'B', x: 500, y: 110 }, { id: 'C', x: 800, y: 260 }, { id: 'D', x: 800, y: 500 }, { id: 'E', x: 500, y: 650 }, { id: 'F', x: 200, y: 500 }, { id: 'G', x: 200, y: 260 }],
          edges: ['B', 'C', 'D', 'E', 'F', 'G'].map(function (x) { return { from: 'A', to: x }; }) }; } },
      { label: 'Ring of 6', fn: function () { return circleGraph('ABCDEF'.split(''), [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['F', 'A']]); } },
      { label: 'Everyone knows everyone', fn: function () {
        var ids = 'ABCDE'.split(''), pairs = [];
        for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
        return circleGraph(ids, pairs); } },
      { label: 'Clear', fn: function () { return { nodes: [], edges: [] }; } }
    ];
    var bar = fig.querySelector('[data-presets]');
    PRESETS.forEach(function (p) {
      var b = h('button', { type: 'button', class: 'btn btn--soft btn--sm' }, p.label);
      b.addEventListener('click', function () { msg.textContent = ''; applyPreset(p.fn); });
      bar.appendChild(b);
    });
    function convert(nextDirected, nextWeighted) {
      var g = currentGraph();
      g = JSON.parse(JSON.stringify(g));
      g.edges.forEach(function (e, i) {
        if (nextWeighted && !weighted) e.weight = (i * 3 + 2) % 9 + 1;
        if (!nextWeighted) delete e.weight;
        delete e.directed;
      });
      directed = nextDirected; weighted = nextWeighted;
      create(g);
    }
    V.toggle(fig.querySelector('[data-t-directed]'), { label: 'Directed', checked: false, onChange: function (c) { convert(c, weighted); } });
    V.toggle(fig.querySelector('[data-t-weighted]'), { label: 'Weighted', checked: false, onChange: function (c) { convert(directed, c); } });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Selected edge / vertex' }, { state: 'visited', label: 'Edge present' }, { state: 'muted', label: 'No edge' }
    ]);
    create(START);
    L.builder = { create: create };
    void cap;
  }

  /* ================================================================== 2. the operations lab */
  var CODE = {
    edge: {
      pseudo: [
        '// adjacency matrix',
        'function hasEdgeMatrix(M, u, v)',
        '  return M[u][v] = 1                       // @mcheck',
        '',
        '// adjacency list',
        'function hasEdgeList(adj, u, v)',
        '  for each w in adj[u]                     // @lscan',
        '    if w = v then                          // @lcmp',
        '      return true                          // @lhit',
        '  return false                             // @lnone'
      ].join('\n'),
      js: [
        '// adjacency matrix',
        'function hasEdgeMatrix(M, u, v) {',
        '  return M[u][v] === 1;                    // @mcheck',
        '}',
        '',
        '// adjacency list',
        'function hasEdgeList(adj, u, v) {',
        '  for (const w of adj[u]) {                // @lscan',
        '    if (w === v) {                         // @lcmp',
        '      return true;                         // @lhit',
        '    }',
        '  }',
        '  return false;                            // @lnone',
        '}'
      ].join('\n'),
      py: [
        '# adjacency matrix',
        'def has_edge_matrix(M, u, v):',
        '    return M[u][v] == 1                    # @mcheck',
        '',
        '# adjacency list',
        'def has_edge_list(adj, u, v):',
        '    for w in adj[u]:                       # @lscan',
        '        if w == v:                         # @lcmp',
        '            return True                    # @lhit',
        '    return False                           # @lnone'
      ].join('\n')
    },
    neighbours: {
      pseudo: [
        '// adjacency matrix',
        'function neighboursMatrix(M, u)',
        '  out ← empty list',
        '  for v ← 0 to V − 1                       // @mloop',
        '    if M[u][v] = 1 then add v to out       // @mtest',
        '  return out',
        '',
        '// adjacency list',
        'function neighboursList(adj, u)',
        '  out ← empty list',
        '  for each w in adj[u]                     // @lloop',
        '    add w to out                           // @lvisit',
        '  return out'
      ].join('\n'),
      js: [
        '// adjacency matrix',
        'function neighboursMatrix(M, u) {',
        '  const out = [];',
        '  for (let v = 0; v < M.length; v++) {     // @mloop',
        '    if (M[u][v] === 1) out.push(v);        // @mtest',
        '  }',
        '  return out;',
        '}',
        '',
        '// adjacency list',
        'function neighboursList(adj, u) {',
        '  const out = [];',
        '  for (const w of adj[u]) {                // @lloop',
        '    out.push(w);                           // @lvisit',
        '  }',
        '  return out;',
        '}'
      ].join('\n'),
      py: [
        '# adjacency matrix',
        'def neighbours_matrix(M, u):',
        '    out = []',
        '    for v in range(len(M)):                # @mloop',
        '        if M[u][v] == 1: out.append(v)     # @mtest',
        '    return out',
        '',
        '# adjacency list',
        'def neighbours_list(adj, u):',
        '    out = []',
        '    for w in adj[u]:                       # @lloop',
        '        out.append(w)                      # @lvisit',
        '    return out'
      ].join('\n')
    },
    all: {
      pseudo: [
        '// adjacency matrix',
        'function forEachEdgeMatrix(M, visit)',
        '  for u ← 0 to V − 1                       // @mloop',
        '    for v ← 0 to V − 1',
        '      if M[u][v] = 1 then visit(u, v)      // @mtest',
        '',
        '// adjacency list',
        'function forEachEdgeList(adj, visit)',
        '  for u ← 0 to V − 1                       // @lloop',
        '    for each v in adj[u]',
        '      visit(u, v)                          // @lvisit'
      ].join('\n'),
      js: [
        '// adjacency matrix',
        'function forEachEdgeMatrix(M, visit) {',
        '  for (let u = 0; u < M.length; u++) {     // @mloop',
        '    for (let v = 0; v < M.length; v++) {',
        '      if (M[u][v] === 1) visit(u, v);      // @mtest',
        '    }',
        '  }',
        '}',
        '',
        '// adjacency list',
        'function forEachEdgeList(adj, visit) {',
        '  for (let u = 0; u < adj.length; u++) {   // @lloop',
        '    for (const v of adj[u]) {',
        '      visit(u, v);                         // @lvisit',
        '    }',
        '  }',
        '}'
      ].join('\n'),
      py: [
        '# adjacency matrix',
        'def for_each_edge_matrix(M, visit):',
        '    for u in range(len(M)):                # @mloop',
        '        for v in range(len(M)):',
        '            if M[u][v] == 1: visit(u, v)   # @mtest',
        '',
        '# adjacency list',
        'def for_each_edge_list(adj, visit):',
        '    for u in range(len(adj)):              # @lloop',
        '        for v in adj[u]:',
        '            visit(u, v)                    # @lvisit'
      ].join('\n')
    }
  };

  var LAB_PRESETS = [
    { label: 'Sparse (a road-like graph)', text: 'A-B, B-C, C-D, D-E, E-F, F-G, G-H, H-I, I-J, C-H', directed: false },
    { label: 'Dense (nearly everyone linked)', text: 'A-B, A-C, A-D, A-E, A-F, A-G, B-C, B-D, B-E, B-F, B-G, C-D, C-E, C-F, C-G, D-E, D-F, D-G, E-F, E-G, F-G', directed: false },
    { label: 'Popular hub', text: 'A-B, A-C, A-D, A-E, A-F, A-G, A-H, B-C, D-E, F-G, H-I, I-J', directed: false },
    { label: 'Directed links', text: 'A-B, A-C, B-D, C-D, D-E, E-A, C-F, F-E', directed: true }
  ];

  function opsLab(fig) {
    var stage = fig.querySelector('[data-stage]');
    var op = 'edge', directed = false, u = null, v = null, rep = null, pos = null, pendingPreset = null;
    // three panes
    var gHost = h('div', { class: 'g25-pane__body' }), mHost = h('div', { class: 'g25-pane__body' }), lHost = h('div', { class: 'g25-lgrid', 'data-empty': '(empty)' });
    stage.classList.add('g25-trio');
    stage.appendChild(h('div', { class: 'g25-pane g25-pane--graph' }, h('p', { class: 'g25-pane__title' }, 'The graph'), gHost));
    stage.appendChild(h('div', { class: 'g25-pane g25-pane--matrix' }, h('p', { class: 'g25-pane__title' }, 'Adjacency matrix'), mHost));
    stage.appendChild(h('div', { class: 'g25-pane g25-pane--list' }, h('p', { class: 'g25-pane__title' }, 'Adjacency list'), lHost));
    var gView = V.views.graph(gHost, { bounds: { w: 1000, h: 480 }, maxHeight: 300, nodeRadius: 30, minRadius: 12, label: 'The graph being queried' });
    var mView = V.views.grid(mHost, { mode: 'table', cellSize: 34, minCell: 18, label: 'Adjacency matrix being read' });

    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE.edge, default: 'pseudo', maxHeight: 340 });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { u: 'active', v: 'compare' } });

    function layout(parsed) {
      var n = parsed.nodes.length;
      var edges = parsed.edges.map(function (e) { return { from: e[0], to: e[1] }; });
      var p = n <= 2 ? circlePos(n) : V.views.graph.layouts.force(parsed.nodes, edges, { w: 1000, h: 480, pad: 70, seed: 6 });
      var out = {};
      parsed.nodes.forEach(function (id, i) { var q = Array.isArray(p) ? p[i] : p[id]; out[id] = { x: q.x, y: q.y }; });
      return out;
    }
    function opts(sel, items, value) {
      V.clear(sel);
      items.forEach(function (id) { var o = h('option', { value: id }, id); if (id === value) o.selected = true; sel.appendChild(o); });
    }
    var uSel = fig.querySelector('[data-u]'), vSel = fig.querySelector('[data-v]');
    var vWrap = fig.querySelector('[data-v-wrap]'), uWrap = fig.querySelector('[data-u-wrap]');

    function stepsFor() {
      var steps = G.opsSteps(rep, op, u, v);
      return steps;
    }
    function defaults() {
      var best = rep.ids[0];
      rep.ids.forEach(function (id) { if (rep.adj[id].length > rep.adj[best].length) best = id; });
      u = best;
      var nb = rep.adj[best];
      v = nb.length ? nb[nb.length - 1].to : rep.ids.filter(function (x) { return x !== best; })[0];
      opts(uSel, rep.ids, u); opts(vSel, rep.ids, v);
    }
    function prepareGraph(parsed, fresh) {
      directed = !!parsed.directed;
      rep = G.build(parsed);
      pos = layout(parsed);
      if (fresh || u === null || rep.index[u] === undefined || rep.index[v] === undefined) defaults();
      else { opts(uSel, rep.ids, u); opts(vSel, rep.ids, v); }
    }
    function setGraph(parsed, fresh) {
      prepareGraph(parsed, fresh);
      gView.render({ nodes: rep.ids.map(function (id) { return { id: id, x: pos[id].x, y: pos[id].y }; }), edges: [] }, { duration: 0 });
      mView.reset && mView.reset();
      reload();
    }
    function reload() {
      code.setSource(CODE[op]);
      code.setLanguage(code.language);
      var steps = stepsFor();
      player.setSteps(steps);
      uWrap.hidden = op === 'all';
      vWrap.hidden = op !== 'edge';
      fig.querySelector('[data-density]').innerHTML = 'V = <b>' + rep.V + '</b>, E = <b>' + rep.E + '</b>, density <b>' + Math.round(G.density(rep.V, rep.E, directed) * 100) + '%</b> of the edges a graph this size could hold.';
    }

    function render(step, ctx) {
      var d = ctx.duration;
      var ns = {}, es = {};
      rep.ids.forEach(function (id) { ns[id] = 'default'; });
      var hit = false;
      if (step.op === 'edge') {
        if (step.u) ns[step.u] = 'active';
        if (step.v && step.v !== step.u) ns[step.v] = 'compare';
        if (step.mHit.length && (step.kind === 'answer' || step.kind === 'done')) hit = true;
      } else if (step.op === 'neighbours') {
        if (step.u) ns[step.u] = 'active';
        step.lHit.forEach(function (c) { ns[rep.adj[rep.ids[c[0]]][c[1]].to] = 'frontier'; });
      } else if (step.mRow !== null && step.mRow !== undefined) ns[rep.ids[step.mRow]] = 'active';
      var edges = [];
      rep.edgeList.forEach(function (e) {
        var st = 'default';
        if (step.op === 'edge' && hit && ((e.from === step.u && e.to === step.v) || (!directed && e.from === step.v && e.to === step.u))) st = 'path';
        else if (step.op === 'neighbours' && (e.from === step.u || (!directed && e.to === step.u)) && ns[e.from === step.u ? e.to : e.from] === 'frontier') st = 'active';
        else if (step.op === 'all' && step.mRow !== null && step.mRow !== undefined && (rep.ids[step.mRow] === e.from || (!directed && rep.ids[step.mRow] === e.to))) st = 'active';
        edges.push({ id: L.pairKey(e.from, e.to) + (directed ? ':' + e.from : ''), from: e.from, to: e.to, directed: directed, state: st });
      });
      gView.render({ nodes: rep.ids.map(function (id) { return { id: id, x: pos[id].x, y: pos[id].y, state: ns[id] }; }), edges: edges }, { duration: d });
      // matrix
      var seen = {}, hits = {};
      step.mSeen.forEach(function (c) { seen[c[0] + ',' + c[1]] = true; });
      step.mHit.forEach(function (c) { hits[c[0] + ',' + c[1]] = true; });
      var cells = rep.ids.map(function (a, i) {
        return rep.ids.map(function (bb, j) {
          var k = i + ',' + j, on = rep.has[i][j];
          return { value: on ? 1 : 0, state: hits[k] ? 'found' : seen[k] ? 'visited' : on ? 'default' : 'muted' };
        });
      });
      var ms = { rows: rep.V, cols: rep.V, cells: cells, rowHeaders: rep.ids, colHeaders: rep.ids };
      if (step.mCell) ms.cursor = { cell: step.mCell, state: 'compare' };
      if (step.mRow !== null && step.mRow !== undefined) ms.highlightRow = { index: step.mRow, state: 'active' };
      mView.render(ms, { duration: d });
      // list
      var lh = {};
      step.lHit.forEach(function (c) { lh[c[0] + ',' + c[1]] = true; });
      L.rowSync(lHost, rep.ids.map(function (id, i) {
        var seenN = step.lSeen[i] || 0;
        return { id: id, head: id, cls: step.lRow === i || (step.op === 'all' && step.mRow === i) ? 'is-row' : '', chips: rep.adj[id].map(function (e, k) {
          var cur = step.lCur && step.lCur[0] === i && step.lCur[1] === k;
          var cls = lh[i + ',' + k] ? 'is-found' : cur ? 'is-compare' : k < seenN ? 'is-visited' : '';
          if (cur && lh[i + ',' + k]) cls = 'is-found is-cur';
          return { key: id + '>' + e.to, text: e.to, cls: cls };
        }) };
      }));
    }

    prepareGraph(G.parseEdgeList(LAB_PRESETS[0].text, {}).values, true);
    gView.render({ nodes: rep.ids.map(function (id) { return { id: id, x: pos[id].x, y: pos[id].y }; }), edges: [] }, { duration: 0 });
    var player = V.player({
      root: fig, steps: stepsFor(),
      render: render, code: code, vars: vars, caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { matrix: 'Matrix reads', list: 'List reads' }, baseStepMs: 1100, label: 'Matrix versus list controls'
    });
    L.reserveVars(player, vars, stepsFor());
    player.addCheckpoint(function (steps) { return steps.length > 3 ? 1 : -1; }, function (c) {
      var st = c.steps[0], o = st.op;
      var nbCount = rep.adj[st.u] ? rep.adj[st.u].length : 0;
      if (o === 'edge') return {
        question: 'How many matrix cells must be read to decide whether <b>' + st.u + (directed ? ' → ' : ' – ') + st.v + '</b> is an edge?',
        options: ['One: the cell M[' + st.u + '][' + st.v + ']', 'As many as ' + st.u + ' has neighbours', 'The whole row: V cells'], answer: 0,
        explain: ['Right. The matrix is indexed by both endpoints, so the answer sits at a known address: constant time, however large the graph.',
          'That is the list’s cost, not the matrix’s. The matrix never scans anything for this question.',
          'A row scan is what listing <em>all</em> neighbours costs. Checking one pair needs one cell.']
      };
      if (o === 'neighbours') return {
        question: '<b>' + st.u + '</b> has ' + nbCount + ' ' + (nbCount === 1 ? 'neighbour' : 'neighbours') + ' among ' + rep.V + ' vertices. How many cells will the <em>matrix</em> read to list them?',
        options: [String(nbCount) + ' (one per neighbour)', rep.V + ' (its whole row)', String(rep.V * rep.V) + ' (the whole table)'], answer: 1,
        explain: ['That is what the list reads. The matrix has no shortcut to the ones: it cannot know which cells hold a 1 without looking at each.',
          'Right: it reads row ' + st.u + ' from left to right, all ' + rep.V + ' cells, most of them zeros in a sparse graph.',
          'One row is enough; the other rows say nothing about ' + st.u + '.']
      };
      return {
        question: 'To visit every edge, how many cells does the matrix read in total, for a graph with ' + rep.V + ' vertices?',
        options: ['E, the number of edges', rep.V + ' (one per vertex)', rep.V + ' × ' + rep.V + ' = ' + (rep.V * rep.V)], answer: 2,
        explain: ['The matrix cannot skip the zeros, so it reads far more than E.', 'One row per vertex, and every row has V cells.', 'Right: V rows of V cells, whether the graph has 1 edge or 100.']
      };
    }, { id: 'lab-predict-cost' });

    // controls
    V.segmented(fig.querySelector('[data-op]'), {
      label: 'Question to ask', value: 'edge',
      options: [{ value: 'edge', label: 'Is u–v an edge?' }, { value: 'neighbours', label: 'List u’s neighbours' }, { value: 'all', label: 'Visit every edge' }],
      onChange: function (val) { op = val; reload(); }
    });
    uSel.addEventListener('change', function () { u = uSel.value; reload(); });
    vSel.addEventListener('change', function () { v = vSel.value; reload(); });
    var dirToggle = null;
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Edges (up to 12 vertices)', value: LAB_PRESETS[0].text, placeholder: 'e.g. A-B, A-C, B-D, E',
      parse: function (text) { return G.parseEdgeList(text, { directed: dirToggle ? dirToggle.checked : false }); },
      presets: LAB_PRESETS.map(function (p) { return { label: p.label, value: function () { pendingPreset = p; return p.text; } }; }),
      hint: 'Write edges as A-B, separated by commas. A lone name is a vertex with no edges.',
      onApply: function (parsed, text) {
        var p = pendingPreset; pendingPreset = null;
        if (p && p.text === text && !!p.directed !== !!parsed.directed) { parsed = G.parseEdgeList(text, { directed: !!p.directed }).values; }
        if (p && dirToggle && p.text === text) dirToggle.set(!!p.directed);
        u = null;
        setGraph(parsed, true);
      }
    });
    dirToggle = V.toggle(fig.querySelector('[data-t-dir]'), { label: 'Directed edges', checked: false, onChange: function () { var r = G.parseEdgeList(input.field.value, { directed: dirToggle.checked }); if (r.error) { input.setError(r.error); return; } input.setError(''); u = null; setGraph(r.values, true); } });
    L.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Vertex u' }, { state: 'compare', label: 'Vertex v / entry being read' }, { state: 'visited', label: 'Already read' }, { state: 'found', label: 'Edge found' }
    ]);
    reload();
    L.opsLab = { player: player };
  }

  V.ready(function () {
    L.lazy('#fig-builder', builder);
    opsLab(V.$('#lab-fig'));
  });
}());
