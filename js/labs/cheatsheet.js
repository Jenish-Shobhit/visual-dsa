/* Complexity cheat sheet lab (labs/cheatsheet.html). Renders every row from reference-data.js (one source of truth shared
   with the Big-O explorer and "Which structure?"). Filter chips, search, sparklines, print. URL: ?f=graphs&q=heap */
(function () {
  'use strict';
  var h = VDSA.h, $ = VDSA.$, $$ = VDSA.$$;
  var R = window.VDSA_REF, B = window.VDSA_BIGO;

  var CHIPS = [['all', 'All'], ['sorting', 'Sorting'], ['searching', 'Searching'], ['graphs', 'Graphs'], ['structures', 'Structures'], ['strings', 'Strings'], ['paradigms', 'Paradigms']];
  /* extra topic tags on top of a row's own group */
  var EXTRA = {
    'union-find': ['graphs'], 'adj-list': ['graphs'], 'adj-matrix': ['graphs'], 'edge-list': ['graphs'], trie: ['strings'],
    'hash-table': ['searching'], bst: ['searching'], 'balanced-bst': ['searching'], 'sorted-array': ['searching'], 'skip-list': ['searching'], bloom: ['searching'],
    heap: ['sorting'], bfs: ['searching'], dfs: ['searching'], quickselect: ['searching'], 'trie-lookup': ['searching'], binary: ['structures'],
    'heap-sort': ['structures'], 'kruskal': ['structures'], 'huffman': ['structures']
  };
  delete EXTRA.binary; delete EXTRA['heap-sort']; delete EXTRA.kruskal; delete EXTRA.huffman;
  var filter = { f: 'all', q: '' };
  var rows = [], sections = [];

  function lessonOf(id) { return window.VDSA_CURRICULUM ? VDSA_CURRICULUM.byId(id) : null; }
  function badge(t) {
    var key = R.key(t), txt = R.text(t);
    return h('span', { class: 'big-o', 'data-o': key }, txt);
  }
  function nameCell(name, lessonId) {
    var l = lessonOf(lessonId);
    if (l && l.status === 'live') return h('a', { class: 'cs-name', href: '../' + l.href, title: 'Lesson ' + String(l.number).padStart(2, '0') + ': ' + l.title }, name);
    return h('span', { class: 'cs-name', title: l ? 'Lesson ' + l.number + ' (' + l.title + ') is coming soon' : null }, name);
  }
  function spark(bestKey, worstKey) {
    var ns = 'http://www.w3.org/2000/svg', W = 72, H = 26, P = 3, svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'cs-spark'); svg.setAttribute('aria-hidden', 'true');
    function path(key, cls) {
      var d = '';
      for (var i = 0; i <= 24; i++) {
        var x = i / 24, y = B.shape(key, x);
        d += (i ? 'L' : 'M') + (P + x * (W - 2 * P)).toFixed(1) + ' ' + (H - P - y * (H - 2 * P)).toFixed(1);
      }
      var p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); p.setAttribute('pathLength', '1'); p.setAttribute('fill', 'none');
      svg.appendChild(p); return p;
    }
    svg.setAttribute('data-o', worstKey);
    if (bestKey && bestKey !== worstKey) path(bestKey, 'cs-spark__best');
    path(worstKey, 'cs-spark__worst');
    return h('span', { class: 'cs-glyph', title: 'Shape of the worst case (each curve scaled to its own height)' }, svg);
  }
  function fresh(list) { return list.filter(Boolean); }

  function addRow(tbody, tr, cats, hay) {
    tbody.appendChild(tr);
    rows.push({ el: tr, cats: cats, hay: hay.toLowerCase() });
  }

  /* ------------------------------------------------------------------ structure tables */
  function costCell(c) {
    if (c.t === '—') return h('td', { class: 'cs-na' }, h('span', { 'aria-label': 'not applicable' }, '—'));
    return h('td', null, h('span', { class: 'cs-cost' }, badge(c.t), c.w ? h('small', { class: 'cs-worst' }, 'worst ', badge(c.w)) : null), c.n ? h('small', { class: 'cs-cap' }, c.n) : null);
  }
  function structureTable(id, title, blurb, list, heads) {
    var tbody = h('tbody');
    var table = h('table', { class: 'cs-table' },
      h('caption', { class: 'sr-only' }, title),
      h('thead', null, h('tr', null, [heads.name].concat(heads.ops, ['Space', 'Notes', 'Shape']).map(function (t, i) { return h('th', { scope: 'col', class: i === 0 ? 'cs-th-name' : i === heads.ops.length + 2 ? 'cs-th-notes' : null }, t); }))),
      tbody);
    list.forEach(function (s) {
      var worstKey = (function () { var c = s.ops.search.t !== '—' ? s.ops.search : s.ops.insert; return R.key(c.w || c.t); }());
      var bestKey = (function () { var c = s.ops.search.t !== '—' ? s.ops.search : s.ops.insert; return R.key(c.t); }());
      var tr = h('tr', { class: 'cs-row', id: 'r-' + s.id },
        h('th', { scope: 'row' }, nameCell(s.name, s.lesson)),
        costCell(s.ops.access), costCell(s.ops.search), costCell(s.ops.insert), costCell(s.ops.del), costCell(s.ops.space),
        h('td', { class: 'cs-notes-cell' }, s.note),
        h('td', { class: 'cs-shape' }, spark(bestKey, worstKey)));
      var cats = ['structures'].concat(EXTRA[s.id] || []);
      var hay = [s.name, s.note, s.use, s.tag].concat(['access', 'search', 'insert', 'del', 'space'].map(function (o) { return R.text(s.ops[o].t) + ' ' + R.text(s.ops[o].w || '') + ' ' + s.ops[o].n; })).join(' ');
      addRow(tbody, tr, cats, hay);
    });
    return section(id, title, blurb, table, ['structures'].concat(id === 'graph-reps' ? ['graphs'] : []));
  }

  /* ------------------------------------------------------------------ algorithm tables */
  function stableCell(a) {
    var m = /^(Not stable|Stable)/.exec(a.notes);
    if (!m) return h('td', { class: 'cs-na' }, '—');
    var yes = m[1] === 'Stable';
    return h('td', { class: 'cs-stable' }, h('span', { class: 'cs-yn ' + (yes ? 'is-yes' : 'is-no') }, yes ? 'Stable' : 'Not stable'));
  }
  function algoTable(group, title, blurb) {
    var list = R.ALGOS.filter(function (a) { return a.group === group; }), sorting = group === 'sorting';
    var tbody = h('tbody'), heads = ['Algorithm', 'Best', 'Average', 'Worst', 'Space'].concat(sorting ? ['Stable'] : [], ['Notes', 'Shape']);
    var table = h('table', { class: 'cs-table' }, h('caption', { class: 'sr-only' }, title),
      h('thead', null, h('tr', null, heads.map(function (t, i) { return h('th', { scope: 'col', class: i === 0 ? 'cs-th-name' : t === 'Notes' ? 'cs-th-notes' : null }, t); }))), tbody);
    list.forEach(function (a) {
      var notes = sorting ? a.notes.replace(/^(Not stable|Stable)(?: if the bucket sort is)?\.\s*/, '') : a.notes;
      var tr = h('tr', { class: 'cs-row', id: 'r-' + a.id },
        h('th', { scope: 'row' }, nameCell(a.name, a.lesson)),
        h('td', null, h('span', { class: 'cs-cost' }, badge(a.best))), h('td', null, h('span', { class: 'cs-cost' }, badge(a.avg))), h('td', null, h('span', { class: 'cs-cost' }, badge(a.worst))),
        h('td', null, h('span', { class: 'cs-cost' }, badge(a.space))),
        sorting ? stableCell(a) : null,
        h('td', { class: 'cs-notes-cell' }, notes),
        h('td', { class: 'cs-shape' }, spark(R.key(a.best), R.key(a.worst))));
      var cats = [group].concat(EXTRA[a.id] || []);
      var hay = [a.name, a.notes, group, R.text(a.best), R.text(a.avg), R.text(a.worst), R.text(a.space), sorting ? (/^Stable/.test(a.notes) ? 'stable' : 'not stable unstable') : ''].join(' ');
      addRow(tbody, tr, cats, hay);
    });
    return section(group, title, blurb, table, [group]);
  }

  function section(id, title, blurb, table, cats) {
    var sec = h('section', { class: 'cs-sec', id: id, 'aria-labelledby': id + '-h' },
      h('div', { class: 'cs-sec__head' }, h('h2', { id: id + '-h' }, title), h('p', null, blurb)),
      h('div', { class: 'cs-wrap' }, table),
      h('p', { class: 'cs-empty', hidden: true }, 'No rows here match.'));
    sections.push({ el: sec, table: table });
    return sec;
  }

  /* ------------------------------------------------------------------ filtering */
  function apply() {
    var terms = filter.q.toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
    rows.forEach(function (r) {
      var ok = (filter.f === 'all' || r.cats.indexOf(filter.f) >= 0) && terms.every(function (t) { return r.hay.indexOf(t) >= 0; });
      r.el.hidden = !ok; if (ok) shown++;
    });
    sections.forEach(function (s) {
      var any = $$('tbody tr', s.table).some(function (tr) { return !tr.hidden; });
      s.el.hidden = !any;
    });
    $$('.cs-chip', $('[data-chips]')).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === filter.f)); });
    $('[data-count]').textContent = shown === rows.length ? 'All ' + rows.length + ' rows' : shown ? shown + ' of ' + rows.length + ' rows' : 'No rows match. Try fewer words, or clear the filter.';
    replay();
    try {
      var q = new URLSearchParams();
      if (filter.f !== 'all') q.set('f', filter.f); if (filter.q) q.set('q', filter.q);
      var s = q.toString(); history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
    } catch (e) { /* ignore */ }
  }
  var io = null;
  function replay() {
    if (VDSA.reducedMotion()) { rows.forEach(function (r) { r.el.classList.add('is-in'); }); return; }
    if (!('IntersectionObserver' in window)) { rows.forEach(function (r) { r.el.classList.add('is-in'); }); return; }
    if (!io) io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    rows.forEach(function (r) { if (!r.el.classList.contains('is-in') && !r.el.hidden) io.observe(r.el); });
  }

  function build() {
    var key = $('[data-key]');
    B.CLASSES.forEach(function (c) { key.appendChild(h('span', { class: 'big-o', 'data-o': c.o }, c.label)); });
    var body = $('[data-body]');
    body.appendChild(structureTable('structures', 'Data structures', 'Cost of the four core operations. Captions say what each operation means for that structure.', R.STRUCTURES,
      { name: 'Structure', ops: ['Access / peek', 'Search / query', 'Insert / update', 'Delete / remove'] }));
    body.appendChild(structureTable('graph-reps', 'Graph representations', 'V vertices, E edges. Pick by density and by the question you ask most.', R.GRAPH_REPS,
      { name: 'Representation', ops: ['Edge u–v?', 'List neighbours', 'Add edge', 'Remove edge'] }));
    body.appendChild(algoTable('sorting', 'Sorting', 'Comparison sorts cannot beat O(n log n) in the worst case; counting-based sorts sidestep that by not comparing.'));
    body.appendChild(algoTable('searching', 'Searching', 'From scanning everything to jumping straight to the answer.'));
    body.appendChild(algoTable('graphs', 'Graph algorithms', 'V vertices and E edges, with adjacency lists unless noted.'));
    body.appendChild(algoTable('strings', 'String matching', 'Text of length n, pattern of length m.'));
    body.appendChild(algoTable('paradigms', 'Paradigms: dynamic programming, greedy, backtracking', 'Recursion made cheap, choices made quickly, and searches that try everything.'));
    var chips = $('[data-chips]');
    CHIPS.forEach(function (c) {
      var n = rows.filter(function (r) { return c[0] === 'all' || r.cats.indexOf(c[0]) >= 0; }).length;
      chips.appendChild(h('button', { type: 'button', class: 'cs-chip', 'data-f': c[0], 'aria-pressed': 'false', onclick: function () { filter.f = c[0]; apply(); } }, c[1], h('span', { class: 'cs-chip__n' }, String(n))));
    });
    /* hover replays a row's sparkline */
    body.addEventListener('pointerover', function (e) {
      var tr = e.target.closest && e.target.closest('.cs-row');
      if (!tr || tr._hov || VDSA.reducedMotion()) return;
      tr._hov = true; tr.classList.remove('is-in'); void tr.offsetWidth; tr.classList.add('is-in');
      setTimeout(function () { tr._hov = false; }, 1200);
    });
  }

  VDSA.ready(function () {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('f') && CHIPS.some(function (c) { return c[0] === q.get('f'); })) filter.f = q.get('f');
      if (q.get('q')) filter.q = q.get('q').slice(0, 60);
    } catch (e) { /* ignore */ }
    build();
    var s = $('[data-search]'); s.value = filter.q;
    s.addEventListener('input', function () { filter.q = s.value.trim(); apply(); });
    $('[data-print]').addEventListener('click', function () { window.print(); });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '/') { e.preventDefault(); s.focus(); }
      else if (e.key === 'p' || e.key === 'P') window.print();
    });
    apply();
  });
}());
