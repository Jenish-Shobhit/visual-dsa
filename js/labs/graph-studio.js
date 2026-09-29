/* Graph studio (labs/graph-studio.html): the UI around js/labs/graph-studio-model.js.

   One editable graph (VDSA.views.graph in editor mode) feeds the tested lesson generators through the model's adapter.
   Every run is a list of "frames" played by VDSA.player, so step, play, scrub and speed all work. Beside the graph:
   the algorithm's own data structure, the final result, and the adjacency matrix / list / edge list, all live.

   Parts: 1 setup · 2 view and player · 3 panels · 4 editing · 5 algorithm menu and selects · 6 URL · 7 boot. */
(function () {
  'use strict';
  var V = window.VDSA, M = V && V.labs && V.labs.graphStudio;
  if (!V || !M || !V.views || !V.views.graph || !V.views.grid || !V.player) { console.error('[graph studio] engine or model missing'); return; }
  var h = V.h, $ = V.$, esc = V.escape;
  var CUR = window.VDSA_CURRICULUM;
  var root = $('#studio');

  /* ================================================================ 1. Setup */
  var S = { g: null, algo: 'bfs', src: null, dst: null, undo: [], run: null, preset: null, seed: 3, random: { n: 9, density: 30 } };
  var view = null, matrixView = null, fwView = null, player = null, toolSeg = null, dirToggle = null, wtToggle = null, sizeSlider = null, densSlider = null;
  var turbo = false, noteHold = false, urlTimer = 0;
  var el = {
    stage: $('[data-stage]', root), facts: $('[data-facts]', root), notice: $('[data-notice]', root), presets: $('[data-presets]', root),
    algos: $('[data-algos]', root), src: $('[data-src]', root), dst: $('[data-dst]', root), lesson: $('[data-lesson]', root),
    ds: $('[data-ds]', root), dsTitle: $('[data-ds-title]', root), result: $('[data-result]', root), matrix: $('[data-matrix]', root),
    matrixNote: $('[data-matrix-note]', root), list: $('[data-list]', root), text: $('[data-text]', root), textMsg: $('[data-text-msg]', root),
    undo: $('[data-act="undo"]', root), useSrc: $('[data-use="src"]', root), useDst: $('[data-use="dst"]', root), hint: $('[data-hint]', root)
  };
  var layouts = V.views.graph.layouts;
  var NOTHING = 'none';

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function algoOf(id) { return M.algoById(id); }
  function nodeIds() { return S.g.nodes.map(function (n) { return n.id; }); }
  function lessonLink(id, label) {
    var l = CUR && CUR.byId ? CUR.byId(id) : null;
    if (l && l.status === 'live') return h('a', { class: 'gs-lesson__a', href: V.url('lessons/' + id + '.html') }, label || ('Lesson ' + id.slice(0, 2) + ': ' + l.title), h('span', { 'aria-hidden': 'true' }, ' →'));
    return h('span', { class: 'gs-lesson__a is-soon' }, (label || ('Lesson ' + id.slice(0, 2))) + ' (coming soon)');
  }
  function note(text, kind, hold) {
    el.notice.textContent = text || '';
    el.notice.setAttribute('data-kind', kind || '');
    noteHold = !!hold;
  }
  function flash(text, kind) { note(text, kind || 'note', true); }

  /* ================================================================ 2. Graph view and player */
  function flowMode() { return S.algo === 'flow' && S.run && S.run.ok; }

  function viewState(frame) {
    var fn = frame.nodes || {}, fe = frame.edges || {}, flow = flowMode();
    var nodes = S.g.nodes.map(function (n) {
      var f = fn[n.id] || {};
      var o = { id: n.id, x: n.x, y: n.y, state: f.state || 'default' };
      if (f.badge !== undefined) o.badge = f.badge;
      if (f.badgeState) o.badgeState = f.badgeState;
      if (f.sub !== undefined) o.sub = f.sub;
      return o;
    });
    var edges = S.g.edges.map(function (e) {
      var k = M.ekey(S.g, e), f = fe[k] || {};
      var o = { id: k, from: e.from, to: e.to, directed: S.g.directed, state: f.state || 'default' };
      if (S.g.weighted) o.weight = e.w;
      if (flow && f.capacity !== undefined) { o.capacity = f.capacity; o.flow = f.flow || 0; }
      if (f.pulse) { o.pulse = true; if (f.from !== undefined) { o.from = f.from; o.to = f.to; } }
      if (f.dashed) o.dashed = true;
      return o;
    });
    return { nodes: nodes, edges: edges };
  }

  function createView() {
    if (view) { try { view.destroy(); } catch (e) { /* already gone */ } V.clear(el.stage); }
    var H = window.innerWidth < 700 ? 800 : LIMITSH();
    view = V.views.graph(el.stage, {
      editable: true, directed: S.g.directed, weighted: S.g.weighted, defaultWeight: 1, bounds: { w: 1000, h: H }, maxHeight: H,
      nodeRadius: 26, minRadius: 14,
      label: 'Graph editor. Click empty space to add a vertex, drag from one vertex to another to add an edge, click an edge to change its weight, press Delete to remove the selection.'
    });
    view.on('change', onChange);
    view.on('select', onSelect);
    if (toolSeg && toolSeg.value === 'move') view.setTool('move');
  }
  function LIMITSH() { return M.LIMITS.bounds.h; }

  function render(frame, ctx) {
    view.render(viewState(frame), { duration: ctx.duration });
    renderDs(frame, ctx.duration);
    renderMatrix(frame, ctx.duration);
    renderList(frame);
  }

  function setFrames(frames) {
    var last = frames.length - 1;
    player.setSteps(frames, { index: turbo ? last : 0 });
  }

  /* runs the chosen algorithm on the current graph and hands the frames to the player */
  function computeRun() {
    var sel = { src: S.src, dst: S.dst };
    S.run = null;
    if (S.algo === NOTHING || !algoOf(S.algo)) {
      setFrames([M.restingFrame(S.g.nodes.length ? 'Edit the graph, then pick an algorithm above and press play.' : 'An empty canvas. Click it to add a vertex, or load a preset.')]);
      renderResult(null);
      return;
    }
    var r = M.run(S.algo, S.g, sel);
    S.run = r;
    if (!r.ok) {
      setFrames([M.restingFrame(r.error)]);
      renderResult(r);
      return;
    }
    S.src = r.sel.src; if (S.dst !== null || S.algo === 'flow') S.dst = r.sel.dst;
    setFrames(r.frames);
    V.legend($('[data-legend]', root), r.legend);
    renderResult(r);
  }

  /* ================================================================ 3. Side panels */
  var DS_TITLE = { bfs: 'Queue', dfs: 'Stack', topo: 'Ready queue and in-degrees', topodfs: 'DFS stack and finish order', scc: 'Finish stack and components',
    dijkstra: 'Priority queue and distances', bellman: 'Distance table and edge scan', floyd: 'Distance matrix', kruskal: 'Sorted edges and union-find',
    prim: 'Priority queue of edges', flow: 'Residual capacities' };

  function chipHtml(c) { return '<span class="gs-chip is-' + esc(c.s || 'default') + '">' + esc(c.t) + '</span>'; }
  function renderDs(frame, dur) {
    var p = frame.panel || {}, a = algoOf(S.algo);
    el.dsTitle.textContent = a && S.run && S.run.ok ? (DS_TITLE[a.id] || 'Data structure') : 'Data structure';
    var chipsHost = el.ds.querySelector('.gs-ds__chips'), gridHost = el.ds.querySelector('.gs-ds__grid');
    if (p.grid) {
      chipsHost.hidden = true; gridHost.hidden = false;
      if (!fwView) fwView = V.views.grid(gridHost, { cellSize: 40, minCell: 22, countUp: false, label: 'Floyd-Warshall distance matrix' });
      fwView.render(p.grid, { duration: dur });
      return;
    }
    gridHost.hidden = true; chipsHost.hidden = false;
    if (!p.sections || !p.sections.length) {
      chipsHost.innerHTML = '<p class="gs-empty-msg">' + (S.algo === NOTHING ? 'Pick an algorithm and this panel shows its queue, stack, priority queue or table, one step at a time.' : 'Nothing to show for this graph yet.') + '</p>';
      return;
    }
    chipsHost.innerHTML = p.sections.map(function (s) {
      var body = s.chips && s.chips.length ? s.chips.map(chipHtml).join('') : (s.empty ? '<span class="gs-empty">' + esc(s.empty) + '</span>' : '');
      return '<div class="gs-sec"><h4 class="gs-sec__l">' + esc(s.label) + '</h4>' + (body ? '<div class="gs-chips">' + body + '</div>' : '') + (s.note ? '<p class="gs-sec__note">' + esc(s.note) + '</p>' : '') + '</div>';
    }).join('');
  }

  function renderResult(r) {
    if (!r) { el.result.innerHTML = '<p class="gs-empty-msg">Pick an algorithm to see its answer here: distances, an order, a tree, or a flow.</p>'; return; }
    if (!r.ok) { el.result.innerHTML = '<p class="gs-empty-msg is-error">' + esc(r.error) + '</p>'; return; }
    var s = r.summary;
    el.result.innerHTML = '<p class="gs-result__head">' + s.headline + '</p><dl class="gs-dl">' + s.rows.map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<p class="gs-card__note">This is the final answer, whichever step you are on.</p>';
  }

  function sortedIds() { return nodeIds().slice().sort(M.natCmp); }
  var EDGE_CELL = { default: 'visited' };
  function renderMatrix(frame, dur) {
    var list = sortedIds(), n = list.length, fe = frame.edges || {}, ix = {}, w = {}, directed = S.g.directed;
    list.forEach(function (id, i) { ix[id] = i; });
    S.g.edges.forEach(function (e) { w[ix[e.from] + ',' + ix[e.to]] = e; if (!directed) w[ix[e.to] + ',' + ix[e.from]] = e; });
    if (!matrixView) matrixView = V.views.grid(el.matrix, { cellSize: 38, minCell: 15, label: 'Adjacency matrix of the graph' });
    if (!n) { matrixView.render({ rows: 0, cols: 0, cells: [] }, { duration: dur }); el.matrixNote.textContent = 'Add a vertex to see its matrix.'; return; }
    var cells = [];
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        var e = w[i + ',' + j], c;
        if (e) {
          var f = fe[M.ekey(S.g, e)], st = f && f.state && f.state !== 'default' ? f.state : EDGE_CELL.default;
          c = { value: S.g.weighted ? e.w : 1, state: st };
        } else c = { text: S.g.weighted ? '·' : '0', state: 'muted' };
        row.push(c);
      }
      cells.push(row);
    }
    var st2 = { rows: n, cols: n, cells: cells, rowHeaders: list, colHeaders: list, corner: '' };
    if (frame.cur && ix[frame.cur] !== undefined) { st2.highlightRow = { index: ix[frame.cur], state: 'active' }; st2.highlightCol = { index: ix[frame.cur], state: directed ? 'compare' : 'active' }; }
    matrixView.render(st2, { duration: dur });
    el.matrixNote.textContent = n * n + ' cells for ' + plural(S.g.edges.length, 'edge') + (directed ? '' : ' (each stored twice)') + '. Row = from, column = to.';
  }

  function renderList(frame) {
    var list = sortedIds(), fe = frame.edges || {}, rows = [];
    var adj = {}; list.forEach(function (id) { adj[id] = []; });
    S.g.edges.forEach(function (e) {
      adj[e.from].push({ to: e.to, e: e });
      if (!S.g.directed) adj[e.to].push({ to: e.from, e: e });
    });
    if (!list.length) { el.list.innerHTML = '<p class="gs-empty-msg">No vertices yet.</p>'; return; }
    list.forEach(function (id) {
      var items = adj[id].sort(function (a, b) { return M.natCmp(a.to, b.to); }).map(function (x) {
        var f = fe[M.ekey(S.g, x.e)], st = f && f.state && f.state !== 'default' ? f.state : 'default';
        return '<span class="gs-chip is-' + esc(st) + '">' + esc(x.to) + (S.g.weighted ? '<i>' + esc(x.e.w) + '</i>' : '') + '</span>';
      }).join('') || '<span class="gs-empty">none</span>';
      rows.push('<div class="gs-lrow' + (frame.cur === id ? ' is-cur' : '') + '"><b class="gs-lrow__h">' + esc(id) + '</b><span class="gs-lrow__arrow" aria-hidden="true">→</span><div class="gs-chips">' + items + '</div></div>');
    });
    el.list.innerHTML = rows.join('');
  }

  function renderFacts() {
    var f = M.facts(S.g);
    var items = [plural(f.V, 'vertex', 'vertices'), plural(f.E, 'edge'), 'density ' + Math.round(f.density * 100) + '%',
      f.V === 0 ? null : f.connected ? (S.g.directed ? 'weakly connected' : 'connected') : plural(f.components, 'component') + (S.g.directed ? ' (weak)' : ''),
      f.V === 0 ? null : f.cyclic ? 'has a cycle' : (S.g.directed ? 'acyclic (a DAG)' : 'a forest: no cycle'),
      f.bipartite === null || S.g.directed ? null : f.bipartite ? 'bipartite' : 'not bipartite',
      f.negative ? 'negative weight' : null];
    el.facts.innerHTML = items.filter(Boolean).map(function (t) { return '<li class="gs-fact' + (t === 'negative weight' ? ' is-warn' : '') + '">' + esc(t) + '</li>'; }).join('');
  }

  function updateText(force) {
    if (!force && document.activeElement === el.text) return;
    el.text.value = M.toText(S.g);
    el.textMsg.textContent = ''; el.text.removeAttribute('aria-invalid');
  }

  /* ================================================================ 4. Editing */
  function snapshot() { return M.clone(S.g); }
  function pushUndo(prev) {
    S.undo.push(prev || snapshot());
    if (S.undo.length > 60) S.undo.shift();
    el.undo.disabled = !S.undo.length;
  }

  function readView() {
    var gv = view.getGraph(), prevW = {};
    S.g.edges.forEach(function (e) { prevW[M.ekey(S.g, e)] = e.w; });
    return M.normalize({
      directed: S.g.directed, weighted: S.g.weighted,
      nodes: gv.nodes.map(function (n) { return { id: String(n.id), x: n.x, y: n.y }; }),
      edges: gv.edges.map(function (e) {
        var k = M.key(e.from, e.to, S.g.directed), hasW = e.weight !== undefined && e.weight !== null && e.weight !== '' && isFinite(Number(e.weight));
        return { from: String(e.from), to: String(e.to), w: S.g.weighted && hasW ? Number(e.weight) : (prevW[k] !== undefined ? prevW[k] : 1) };
      })
    });
  }

  function onChange(ev) {
    if (ev && ev.type === 'move') {
      var pos = {}; view.getGraph().nodes.forEach(function (n) { pos[n.id] = n; });
      S.g.nodes.forEach(function (n) { if (pos[n.id]) { n.x = pos[n.id].x; n.y = pos[n.id].y; } });
      syncUrl();
      return;
    }
    var prev = snapshot(), g = readView();
    if (g.nodes.length > M.LIMITS.maxNodes || g.edges.length > M.LIMITS.maxEdges) {
      flash('The studio stops at ' + M.LIMITS.maxNodes + ' vertices and ' + M.LIMITS.maxEdges + ' edges so the matrix stays readable. That last change was undone.', 'error');
      player.refresh();
      return;
    }
    pushUndo(prev);
    S.g = g; S.preset = null;
    refreshAll();
  }
  function onSelect(sel) {
    var isNode = sel && sel.kind === 'node';
    el.useSrc.disabled = !isNode; el.useDst.disabled = !isNode;
  }

  function loadGraph(g, opts) {
    opts = opts || {};
    if (opts.undo !== false) pushUndo();
    var n = M.normalize(g);
    if (M.needsLayout(n)) n = M.tidy(n, layouts);
    S.g = n;
    dirToggle.set(n.directed); wtToggle.set(n.weighted);
    createView();
    refreshAll();
  }

  function setMode(patch) {
    pushUndo();
    var g = M.clone(S.g);
    if (patch.directed !== undefined) g.directed = patch.directed;
    if (patch.weighted !== undefined) g.weighted = patch.weighted;
    S.g = M.normalize(g);
    S.preset = null;
    createView();
    refreshAll();
    if (patch.directed === false) flash('Undirected: each edge now works both ways. Opposite pairs were merged into one edge.', 'note');
  }

  function applyPreset(id) {
    var g = M.preset(id, { n: S.random.n, density: S.random.density / 100, seed: S.seed, directed: S.g.directed, weighted: true });
    S.preset = id;
    var hint = g.hint || {};
    if (id === 'random') { g = M.tidy(g, layouts, 'force'); }
    else { if (hint.algo) S.algo = hint.algo; S.src = hint.src || null; S.dst = hint.dst || null; }
    if (id === 'random') { S.src = null; S.dst = null; }
    loadGraph(g);
    S.preset = id;
    markPreset();
    flash(M.PRESETS.filter(function (p) { return p.id === id; })[0].blurb, 'note');
  }
  function markPreset() {
    Array.prototype.forEach.call(el.presets.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-preset') === S.preset ? 'true' : 'false'); });
  }

  function randomNew() {
    S.seed += 1;
    var g = M.randomGraph(S.random.n, S.random.density / 100, S.seed * 7919, { directed: S.g.directed, weighted: S.g.weighted });
    g = M.tidy(g, layouts, 'force');
    S.src = null; S.dst = null;
    loadGraph(g);
    S.preset = 'random'; markPreset();
  }

  function tidyNow() {
    if (!S.g.nodes.length) return;
    pushUndo();
    S.g = M.tidy(S.g, layouts);
    player.refresh();
    refreshAll();
    flash('Vertices rearranged.', 'note');
  }
  function clearAll() {
    if (!S.g.nodes.length) { flash('Already empty.', 'note'); return; }
    pushUndo();
    S.g = { directed: S.g.directed, weighted: S.g.weighted, nodes: [], edges: [] };
    S.preset = null; markPreset();
    createView(); refreshAll();
    flash('Cleared. Undo brings it back.', 'note');
  }
  function undo() {
    if (!S.undo.length) return;
    S.g = S.undo.pop();
    el.undo.disabled = !S.undo.length;
    dirToggle.set(S.g.directed); wtToggle.set(S.g.weighted);
    createView();
    refreshAll();
    flash('Undone.', 'note');
  }

  function importText() {
    var r = M.parseText(el.text.value, { directed: S.g.directed });
    if (r.error) { el.textMsg.textContent = r.error; el.textMsg.setAttribute('data-kind', 'error'); el.text.setAttribute('aria-invalid', 'true'); return; }
    var old = {}; S.g.nodes.forEach(function (n) { old[n.id] = n; });
    var g = { directed: r.directed, weighted: r.weighted, nodes: r.nodes.map(function (id) { return old[id] ? { id: id, x: old[id].x, y: old[id].y } : { id: id }; }), edges: r.edges };
    var missing = g.nodes.some(function (n) { return typeof n.x !== 'number'; });
    if (missing) { g.nodes.forEach(function (n) { delete n.x; delete n.y; }); }
    S.preset = null; markPreset();
    loadGraph(g);
    el.textMsg.textContent = 'Loaded ' + plural(g.nodes.length, 'vertex', 'vertices') + ' and ' + plural(g.edges.length, 'edge') + '.';
    el.textMsg.setAttribute('data-kind', 'note');
  }

  function copy(text, done, fail) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail); else fail();
  }
  function share() {
    syncUrl(true);
    var url = window.location.href;
    copy(url, function () { flash('Link copied. It reopens this graph, layout and algorithm.', 'note'); }, function () { flash('Copy this address to share: ' + url, 'note'); });
  }

  /* one function refreshes everything that depends on the graph or the choices */
  function refreshAll() {
    var ids = nodeIds();
    if (S.src && ids.indexOf(S.src) < 0) S.src = null;
    if (S.dst && ids.indexOf(S.dst) < 0) S.dst = null;
    if (!S.src && ids.length) S.src = ids[0];
    if (S.algo === 'flow') {
      if (!S.dst || S.dst === S.src) S.dst = pickSink(ids);
      if (ids.indexOf('s') >= 0 && ids.indexOf('t') >= 0 && !S.userPicked) { S.src = 's'; S.dst = 't'; }
    }
    fillSelects();
    updateMenu();
    computeRun();
    renderFacts();
    updateText();
    if (!noteHold) note(stateNote());
    noteHold = false;
    markPreset();
    el.undo.disabled = !S.undo.length;
    syncUrl();
  }
  function pickSink(ids) {
    if (ids.indexOf('t') >= 0 && S.src !== 't') return 't';
    for (var i = ids.length - 1; i >= 0; i--) if (ids[i] !== S.src) return ids[i];
    return null;
  }
  function stateNote() {
    var a = algoOf(S.algo);
    if (!a) return '';
    var av = M.availability(S.g, { src: S.src, dst: S.dst })[a.id];
    if (!av.ok) return a.full + ': ' + av.why;
    return av.warn || '';
  }

  /* ================================================================ 5. Algorithm menu and vertex pickers */
  function buildMenu() {
    var groups = [{ id: 'edit', label: 'Edit', items: [{ id: NOTHING, label: 'Just edit' }] }].concat(M.GROUPS.map(function (g) {
      return { id: g.id, label: g.label, items: M.ALGOS.filter(function (a) { return a.group === g.id; }) };
    }));
    el.algos.innerHTML = '';
    groups.forEach(function (g) {
      var box = h('div', { class: 'gs-group', 'data-group': g.id }, h('span', { class: 'gs-group__l' }, g.label));
      var row = h('div', { class: 'gs-group__b' });
      g.items.forEach(function (a) {
        var b = h('button', { class: 'gs-algo', type: 'button', 'data-algo': a.id, 'aria-pressed': 'false' }, a.label);
        b.addEventListener('click', function () { chooseAlgo(a.id); });
        row.appendChild(b);
      });
      box.appendChild(row); el.algos.appendChild(box);
    });
  }
  function updateMenu() {
    var av = M.availability(S.g, { src: S.src, dst: S.dst });
    Array.prototype.forEach.call(el.algos.querySelectorAll('[data-algo]'), function (b) {
      var id = b.getAttribute('data-algo'), a = av[id];
      b.setAttribute('aria-pressed', id === S.algo ? 'true' : 'false');
      var off = a && !a.ok;
      b.classList.toggle('is-off', !!off);
      b.classList.toggle('has-warn', !!(a && a.ok && a.warn));
      if (off) { b.setAttribute('aria-disabled', 'true'); b.title = a.why; }
      else { b.removeAttribute('aria-disabled'); b.title = a && a.warn ? a.warn : (algoOf(id) ? algoOf(id).full : 'Only edit the graph'); }
    });
    var a = algoOf(S.algo);
    V.clear(el.lesson);
    if (a) { el.lesson.appendChild(h('span', { class: 'gs-lesson__k' }, 'Learn how it works: ')); el.lesson.appendChild(lessonLink(a.lesson)); }
  }
  function chooseAlgo(id) {
    var a = algoOf(id);
    if (a) {
      var av = M.availability(S.g, { src: S.src, dst: S.dst })[id];
      if (av && !av.ok) { flash(a.full + ': ' + av.why, 'error'); return; }
    }
    S.algo = id;
    if (id === 'flow') { S.userPicked = false; }
    refreshAll();
  }

  function fillOptions(select, ids, value, none) {
    var html = (none ? '<option value="">none</option>' : '') + ids.map(function (id) { return '<option value="' + esc(id) + '">' + esc(id) + '</option>'; }).join('');
    if (select.getAttribute('data-sig') !== html) { select.innerHTML = html; select.setAttribute('data-sig', html); }
    select.value = value === null || value === undefined ? '' : value;
    if (select.value !== (value === null || value === undefined ? '' : value)) select.value = none ? '' : ids[0] || '';
  }
  var PICK = { bfs: ['Start', 'Target (optional)'], dfs: ['Start', null], dijkstra: ['Start', 'Target (optional)'], bellman: ['Start', 'Target (optional)'], floyd: ['From', 'To (optional)'], prim: ['Start', null], flow: ['Source', 'Sink'] };
  function fillSelects() {
    var ids = sortedIds(), a = algoOf(S.algo), p = a && PICK[a.id] ? PICK[a.id] : [null, null];
    fillOptions(el.src, ids, S.src, a && a.id === 'floyd');
    fillOptions(el.dst, ids, S.dst, !(a && a.id === 'flow'));
    var srcBox = $('[data-pick="src"]', root), dstBox = $('[data-pick="dst"]', root);
    srcBox.hidden = !p[0]; dstBox.hidden = !p[1];
    if (p[0]) $('[data-pick-label="src"]', root).textContent = p[0];
    if (p[1]) $('[data-pick-label="dst"]', root).textContent = p[1];
    $('[data-pickbtns]', root).hidden = !p[0];
    el.useSrc.textContent = (p[0] || 'Start') + ' = selected';
    el.useDst.textContent = (p[1] || 'Target').replace(' (optional)', '') + ' = selected';
    el.useDst.hidden = !p[1];
  }

  function buildLessons() {
    var host = $('[data-lessons]', root.parentNode);
    if (!host) return;
    ['25-graphs', '26-bfs-and-dfs', '27-topological-sort', '28-dijkstra-and-a-star', '29-bellman-ford-and-floyd-warshall', '30-minimum-spanning-trees', '31-network-flow'].forEach(function (id) {
      host.appendChild(h('li', null, lessonLink(id)));
    });
  }

  /* ================================================================ 6. URL */
  function syncUrl(now) {
    var write = function () {
      try { window.history.replaceState(null, '', M.encode({ graph: S.g, algo: S.algo, src: S.src, dst: S.dst })); } catch (e) { /* file:// or sandbox */ }
    };
    clearTimeout(urlTimer);
    if (now) write(); else urlTimer = setTimeout(write, 250);
  }

  /* ================================================================ 7. Boot */
  function boot() {
    var d = M.decode(window.location.search), fromUrl = !!d.graph, g = d.graph, hint = {};
    if (d.error) { g = null; }
    if (!g) { g = M.preset('city'); hint = g.hint; S.preset = 'city'; }
    S.algo = d.algo && (d.algo === NOTHING || algoOf(d.algo)) ? d.algo : (hint.algo || 'bfs');
    S.src = d.src || hint.src || null; S.dst = d.dst || hint.dst || null;
    S.userPicked = !!(d.src || d.dst);
    if (M.needsLayout(g)) g = M.tidy(g, layouts);
    S.g = M.normalize(g);

    M.PRESETS.forEach(function (p) {
      var b = h('button', { class: 'btn btn--sm gs-preset', type: 'button', 'data-preset': p.id, 'aria-pressed': 'false', title: p.blurb }, p.label);
      b.addEventListener('click', function () { applyPreset(p.id); });
      el.presets.appendChild(b);
    });
    dirToggle = V.toggle($('[data-directed]', root), { label: 'Directed', checked: S.g.directed, onChange: function (on) { setMode({ directed: on }); } });
    wtToggle = V.toggle($('[data-weighted]', root), { label: 'Weighted', checked: S.g.weighted, onChange: function (on) { setMode({ weighted: on }); } });
    sizeSlider = V.slider($('[data-size]', root), { label: 'Random size', min: 3, max: M.LIMITS.maxNodes, value: S.random.n, format: function (v) { return v + ' vertices'; },
      onChange: function (v) { S.random.n = v; randomNew(); } });
    densSlider = V.slider($('[data-density]', root), { label: 'Random density', min: 0, max: 100, step: 5, value: S.random.density, format: function (v) { return v + '%'; },
      onChange: function (v) { S.random.density = v; randomNew(); } });
    toolSeg = V.segmented($('[data-tool]', root), { label: 'Canvas tool', value: 'edge', options: [{ value: 'edge', label: 'Draw', title: 'Click to add vertices, drag to connect' }, { value: 'move', label: 'Move', title: 'Drag vertices around' }],
      onChange: function (v) { if (view) view.setTool(v); } });
    V.toggle($('[data-turbo]', root), { label: 'Show the result instantly', checked: false, onChange: function (on) { turbo = on; if (on) player.goto(player.steps.length - 1, { animate: false }); else player.goto(0, { animate: false }); } });

    createView();
    player = V.player({
      root: root, steps: [M.restingFrame('')], render: render, caption: '[data-caption]', counters: '[data-counters]',
      counterLabels: { visited: 'Visited', checks: 'Checks', frontier: 'Waiting', entries: 'Queue pushes', emitted: 'Placed', removed: 'Edges removed', ready: 'Ready', finished: 'Finished', depth: 'Depth', components: 'Components',
        settled: 'Settled', relaxations: 'Relaxations', pushes: 'Pushes', stale: 'Stale pops', round: 'Round', relaxed: 'Relaxed', pass: 'Pass k', updates: 'Improvements', examined: 'Examined', accepted: 'Accepted', rejected: 'Rejected', weight: 'Tree weight',
        intree: 'In tree', pops: 'Pops', augmentations: 'Augmentations', value: 'Flow', scans: 'Arcs scanned' },
      counterStates: { settled: 'done', accepted: 'done', weight: 'done', value: 'done', rejected: 'error' },
      baseStepMs: 900, label: 'Graph studio step controls'
    });
    V.legend($('[data-legend]', root), [{ state: 'default', label: 'Untouched' }, { state: 'active', label: 'Current' }]);
    buildMenu();
    buildLessons();
    refreshAll();
    if (fromUrl) flash('Loaded the graph from the link.', 'note');
    else if (d.error) flash('The link’s graph could not be read (' + d.error + '), so here is an example.', 'error');
    else flash('An example to start from. Draw your own, load a preset, or change the algorithm.', 'note');

    Array.prototype.forEach.call(root.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        if (a === 'random') randomNew();
        else if (a === 'tidy') tidyNow();
        else if (a === 'clear') clearAll();
        else if (a === 'undo') undo();
        else if (a === 'share') share();
        else if (a === 'import') importText();
        else if (a === 'copytext') copy(el.text.value, function () { el.textMsg.textContent = 'Copied.'; el.textMsg.setAttribute('data-kind', 'note'); }, function () { el.text.select(); });
        else if (a === 'end') player.goto(player.steps.length - 1, { animate: false });
      });
    });
    el.src.addEventListener('change', function () { S.src = el.src.value || null; S.userPicked = true; refreshAll(); });
    el.dst.addEventListener('change', function () { S.dst = el.dst.value || null; S.userPicked = true; refreshAll(); });
    [['src', el.useSrc], ['dst', el.useDst]].forEach(function (pair) {
      pair[1].addEventListener('click', function () {
        var sel = view.selection();
        if (!sel || sel.kind !== 'node') return;
        S[pair[0]] = sel.id; S.userPicked = true; refreshAll();
      });
    });
    el.text.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); importText(); } });
    el.text.addEventListener('input', function () { el.text.removeAttribute('aria-invalid'); el.textMsg.textContent = ''; });

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      var k = e.key.toLowerCase();
      if (k === 't') { e.preventDefault(); tidyNow(); }
      else if (k === 'u') { e.preventDefault(); undo(); }
      else if (k === 'e') { e.preventDefault(); el.text.focus(); }
    });
  }

  V.ready(boot);
}());
