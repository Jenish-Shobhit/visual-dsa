/* Which structure? lab (labs/structure-chooser.html): a clickable decision flowchart, a recommendation card, scenario
   walk-throughs, and a filterable grid of every structure. Data: reference-data.js + structure-chooser-data.js.
   URL: ?a=ynny (answers) &k=tree &c=lookup,order &q=text */
(function () {
  'use strict';
  var h = VDSA.h, $ = VDSA.$, $$ = VDSA.$$;
  var C = window.VDSA_CHOOSER, R = window.VDSA_REF;

  var TAGS = [['sequence', 'Sequences'], ['hash', 'Hashing'], ['tree', 'Trees'], ['priority', 'Priority'], ['range', 'Ranges'], ['sets', 'Sets'], ['graph', 'Graphs']];
  var CAPS = [['index', 'Index by position'], ['lookup', 'Lookup by key'], ['order', 'Sorted order'], ['min', 'Min or max'], ['range', 'Range queries'], ['prefix', 'Prefix search'], ['fifo', 'FIFO'], ['lifo', 'LIFO'], ['insert', 'Insert and delete'], ['connect', 'Connectivity'], ['neighbors', 'Neighbours']];
  var OPS = { std: [['access', 'Access'], ['search', 'Search'], ['insert', 'Insert'], ['del', 'Delete']], graph: [['access', 'Edge u–v?'], ['search', 'Neighbours'], ['insert', 'Add edge'], ['del', 'Remove edge']] };
  var TAGNAME = {}; TAGS.forEach(function (t) { TAGNAME[t[0]] = t[1]; });
  var CAPNAME = {}; CAPS.forEach(function (t) { CAPNAME[t[0]] = t[1]; });

  var answers = [], runToken = 0, flow, activeScenario = null, filters = { tag: '', caps: [], q: '' };
  var ALL = R.STRUCTURES.concat(R.GRAPH_REPS);
  var reduced = function () { return VDSA.reducedMotion(); };

  function badge(t, key) { return h('span', { class: 'big-o', 'data-o': key || R.key(t) }, R.text(t)); }
  function lessonLink(id, label, cls) {
    var l = window.VDSA_CURRICULUM && VDSA_CURRICULUM.byId(id);
    if (l && l.status === 'live') return h('a', { class: cls || 'btn btn--soft btn--sm', href: '../' + l.href }, label || 'Learn how it works →');
    return h('span', { class: 'sc-soon' }, l ? l.title + ' (lesson coming soon)' : '');
  }

  /* ------------------------------------------------------------------ URL */
  function readUrl() {
    try {
      var q = new URLSearchParams(location.search), a = q.get('a');
      if (a) answers = a.split('').map(function (c) { return c === 'y' ? 'yes' : c === 'n' ? 'no' : null; }).filter(Boolean);
      answers = C.walk(answers).path.length - 2 === answers.length ? answers : answers.slice(0, C.walk(answers).path.length - 2);
      if (q.get('k') && TAGNAME[q.get('k')]) filters.tag = q.get('k');
      if (q.get('c')) filters.caps = q.get('c').split(',').filter(function (c) { return CAPNAME[c]; });
      if (q.get('q')) filters.q = q.get('q').slice(0, 60);
    } catch (e) { /* ignore */ }
  }
  var ut = 0;
  function writeUrl() {
    clearTimeout(ut);
    ut = setTimeout(function () {
      try {
        var q = new URLSearchParams();
        if (answers.length) q.set('a', answers.map(function (x) { return x === 'yes' ? 'y' : 'n'; }).join(''));
        if (filters.tag) q.set('k', filters.tag);
        if (filters.caps.length) q.set('c', filters.caps.join(','));
        if (filters.q) q.set('q', filters.q);
        var s = q.toString();
        history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
      } catch (e) { /* ignore */ }
    }, 200);
  }

  /* ------------------------------------------------------------------ hero teaser */
  function teaser() {
    var host = $('#teaser'), ns = 'http://www.w3.org/2000/svg', W = 400, H = 356;
    var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'sc-tz'); svg.setAttribute('aria-hidden', 'true');
    function el(tag, a) { var e = document.createElementNS(ns, tag); for (var k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; }
    var pos = {}, depth = 4, idx = 0;
    (function build(d, x, span, y) {
      var id = idx++; pos[id] = { x: x, y: y, d: d };
      if (d < depth) { pos[id].kids = [build(d + 1, x - span / 2, span / 2, y + 74), build(d + 1, x + span / 2, span / 2, y + 74)]; }
      return id;
    }(0, W / 2, W / 2 - 24, 36));
    var goal = [1, 0, 1, 1];
    var pathIds = [0], cur = 0;
    goal.forEach(function (g) { cur = pos[cur].kids[g]; pathIds.push(cur); });
    Object.keys(pos).forEach(function (id) {
      (pos[id].kids || []).forEach(function (k, i) {
        var p = pos[id], q = pos[k], onPath = pathIds.indexOf(+id) >= 0 && pathIds.indexOf(k) === pathIds.indexOf(+id) + 1;
        var line = el('path', { d: 'M' + p.x + ' ' + (p.y + 10) + 'C' + p.x + ' ' + (p.y + 40) + ' ' + q.x + ' ' + (q.y - 40) + ' ' + q.x + ' ' + (q.y - 10), fill: 'none', class: 'sc-tz__edge' + (onPath ? ' is-path' : ''), pathLength: '1' });
        if (onPath) line.style.setProperty('--i', pathIds.indexOf(+id));
      });
    });
    Object.keys(pos).forEach(function (id) {
      var p = pos[id], leaf = !p.kids, onPath = pathIds.indexOf(+id) >= 0, last = +id === pathIds[pathIds.length - 1];
      var n = el(leaf ? 'rect' : 'path', leaf ? { x: p.x - 9, y: p.y - 9, width: 18, height: 18, rx: 5, class: 'sc-tz__leaf' + (last ? ' is-goal' : '') } : { d: 'M' + p.x + ' ' + (p.y - 11) + 'L' + (p.x + 13) + ' ' + p.y + 'L' + p.x + ' ' + (p.y + 11) + 'L' + (p.x - 13) + ' ' + p.y + 'Z', class: 'sc-tz__q' + (onPath ? ' is-path' : '') });
      if (onPath) n.style.setProperty('--i', pathIds.indexOf(+id));
    });
    host.appendChild(svg);
  }

  /* ------------------------------------------------------------------ flowchart + wizard */
  function flowSpec() {
    return {
      nodes: C.NODES.map(function (n) { return { id: n.id, type: n.type, text: n.text, col: n.col, row: n.row }; }),
      edges: C.EDGES.map(function (e) { return { from: e.from, to: e.to, label: e.label, id: e.id }; })
    };
  }
  function state() {
    var w = C.walk(answers), taken = {};
    w.edges.forEach(function (id) { taken[id] = 'path'; });
    var st = {};
    if (C.isLeaf(w.current)) st[w.current] = 'found';
    return { w: w, flow: { active: w.current, visited: w.path.slice(0, -1), edgeStates: taken, states: st } };
  }
  function draw(dur) {
    var s = state();
    flow.render(s.flow, { duration: dur === undefined ? (reduced() ? 0 : 500) : dur });
    paintPanel(s.w); paintTrail(s.w); paintRec(s.w);
    $('[data-back]').disabled = !answers.length;
    $('[data-restart]').disabled = !answers.length;
    writeUrl();
  }
  function answer(label, viaScenario) {
    if (!viaScenario) cancelScenario();
    var w = C.walk(answers);
    if (C.isLeaf(w.current)) return;
    if (!C.step(w.current, label)) return;
    answers.push(label); draw();
  }
  function back() { cancelScenario(); if (answers.length) { answers.pop(); draw(); } }
  function restart() { cancelScenario(); answers = []; draw(); }
  function jumpTo(id) {
    var w = C.walk(answers), i = w.path.indexOf(id);
    if (i < 0 || id === w.current) return;
    cancelScenario(); answers = answers.slice(0, Math.max(0, i - 1)); draw();
  }

  function paintPanel(w) {
    var host = $('[data-panel]'); VDSA.clear(host);
    var n = C.node(w.current);
    if (n.rec) {
      var s = R.structure(n.rec);
      host.appendChild(h('p', { class: 'sc-panel__eyebrow' }, 'Your answer'));
      host.appendChild(h('p', { class: 'sc-panel__q' }, s.short));
      host.appendChild(h('p', { class: 'sc-panel__hint' }, s.note));
      host.appendChild(h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn btn--primary', onclick: restart }, 'Start over'), h('a', { class: 'btn', href: '#rec' }, 'See the details ↓')));
      return;
    }
    host.appendChild(h('p', { class: 'sc-panel__eyebrow' }, 'Question ' + (answers.length + 1)));
    host.appendChild(h('p', { class: 'sc-panel__q', id: 'qtext' }, n.q));
    host.appendChild(h('p', { class: 'sc-panel__hint' }, 'For example: ' + n.hint));
    var row = h('div', { class: 'sc-panel__btns', role: 'group', 'aria-labelledby': 'qtext' });
    row.appendChild(h('button', { type: 'button', class: 'btn btn--primary btn--lg', 'data-ans': 'yes', onclick: function () { answer('yes'); } }, 'Yes ', h('kbd', null, 'Y')));
    row.appendChild(h('button', { type: 'button', class: 'btn btn--secondary btn--lg', 'data-ans': 'no', onclick: function () { answer('no'); } }, 'No ', h('kbd', null, 'N')));
    host.appendChild(row);
  }
  function paintTrail(w) {
    var host = $('[data-trail]'); VDSA.clear(host);
    if (!answers.length) { host.hidden = true; return; }
    host.hidden = false;
    var ol = h('ol', { class: 'sc-trail__list' });
    answers.forEach(function (a, i) {
      var id = w.path[i + 1], n = C.node(id);
      ol.appendChild(h('li', null, h('button', { type: 'button', class: 'sc-crumb', title: 'Go back to this question', onclick: function () { jumpTo(id); } }, h('span', { class: 'sc-crumb__q' }, n.text), h('b', { class: 'sc-crumb__a is-' + a }, a))));
    });
    host.appendChild(ol);
  }

  /* recommendation card */
  function paintRec(w) {
    var host = $('[data-rec]'), key = w.leaf;
    if (host.getAttribute('data-shown') === (key || '')) return;
    host.setAttribute('data-shown', key || '');
    VDSA.clear(host);
    if (!key) return;
    var s = R.structure(key), ops = OPS[s.tag === 'graph' ? 'graph' : 'std'];
    var grid = h('div', { class: 'sc-rec__ops' });
    ops.forEach(function (o) {
      var c = s.ops[o[0]];
      grid.appendChild(h('div', { class: 'sc-op' + (c.t === '—' ? ' is-na' : '') },
        h('span', { class: 'sc-op__l' }, o[1]),
        c.t === '—' ? h('span', { class: 'sc-op__na' }, 'not supported') : h('span', { class: 'sc-op__c' }, badge(c.t), c.w ? h('small', null, 'worst ', badge(c.w)) : null),
        c.n ? h('span', { class: 'sc-op__n' }, c.n) : null));
    });
    var sc = activeScenario ? C.SCENARIOS.filter(function (x) { return x.id === activeScenario; })[0] : null;
    var card = h('article', { class: 'sc-rec', id: 'rec', tabindex: '-1', 'aria-labelledby': 'rec-h' },
      h('header', { class: 'sc-rec__head' },
        h('div', null, h('p', { class: 'sc-rec__eyebrow' }, 'Recommended'), h('h3', { id: 'rec-h' }, s.name)),
        h('div', { class: 'sc-rec__space' }, h('span', null, 'Space'), badge(s.ops.space.t))),
      sc ? h('p', { class: 'sc-rec__why' }, h('b', null, sc.label + ': '), sc.why) : h('p', { class: 'sc-rec__why' }, s.note),
      grid,
      h('div', { class: 'sc-rec__uses' },
        h('aside', { class: 'callout callout--key' }, h('p', { class: 'callout__title' }, 'Use it when'), h('p', null, s.use)),
        h('aside', { class: 'callout callout--warn' }, h('p', { class: 'callout__title' }, 'Not when'), h('p', null, s.avoid))),
      h('div', { class: 'btn-row' }, lessonLink(s.lesson, 'Learn how it works →', 'btn btn--primary'), h('a', { class: 'btn', href: '#s-' + key }, 'See it in the grid'), h('a', { class: 'btn btn--ghost', href: '../labs/cheatsheet.html' + '?q=' + encodeURIComponent(s.short) }, 'Cheat sheet')));
    host.appendChild(card);
  }

  /* ------------------------------------------------------------------ scenarios */
  function cancelScenario() { runToken++; activeScenario = null; $$('.sc-scn__btn').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); }
  function play(sc) {
    cancelScenario(); var my = runToken; activeScenario = sc.id;
    $$('.sc-scn__btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-id') === sc.id)); });
    answers = []; $('[data-rec]').setAttribute('data-shown', '~'); draw(0);
    var fig = $('#fig-ask'), say = $('[data-say]');
    try { var r = fig.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) fig.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
    var i = 0, gap = reduced() ? 0 : 1250;
    say.textContent = sc.label + ': ' + sc.blurb;
    function next() {
      if (my !== runToken) return;
      if (i >= sc.answers.length) { say.textContent = sc.label + ': ' + sc.why; $('[data-rec]').setAttribute('data-shown', '~'); draw(); return; }
      var w = C.walk(answers), n = C.node(w.current);
      say.textContent = sc.label + ' asks: “' + n.q + '” It answers ' + sc.answers[i] + '.';
      answers.push(sc.answers[i]); i++;
      draw(reduced() ? 0 : 700);
      setTimeout(next, gap);
    }
    setTimeout(next, reduced() ? 0 : 500);
  }
  function buildScenarios() {
    var host = $('[data-scenarios]');
    C.SCENARIOS.forEach(function (sc) {
      host.appendChild(h('button', { type: 'button', class: 'sc-scn__btn', 'data-id': sc.id, 'aria-pressed': 'false', onclick: function () { play(sc); } }, h('b', null, sc.label), h('span', null, sc.blurb)));
    });
  }

  /* ------------------------------------------------------------------ grid */
  function pathToLeaf(leaf) {
    var found = null;
    (function go(id, ans) {
      if (found) return;
      var n = C.node(id);
      if (n.rec) { if (n.rec === leaf) found = ans; return; }
      C.out(id).forEach(function (e) { go(e.to, ans.concat(e.label)); });
    }('q_key', []));
    return found;
  }
  function buildFilters() {
    var tags = $('[data-tags]');
    [['', 'All']].concat(TAGS).forEach(function (t) {
      tags.appendChild(h('button', { type: 'button', class: 'sc-chip', 'data-tag': t[0], 'aria-pressed': String(filters.tag === t[0]), onclick: function () { filters.tag = t[0]; paintGrid(); } }, t[1]));
    });
    var caps = $('[data-caps]');
    CAPS.forEach(function (c) {
      caps.appendChild(h('button', { type: 'button', class: 'sc-chip', 'data-cap': c[0], 'aria-pressed': String(filters.caps.indexOf(c[0]) >= 0), onclick: function () {
        var i = filters.caps.indexOf(c[0]); if (i >= 0) filters.caps.splice(i, 1); else filters.caps.push(c[0]); paintGrid();
      } }, c[1]));
    });
    var s = $('[data-search]'); s.value = filters.q;
    s.addEventListener('input', function () { filters.q = s.value.trim(); paintGrid(); });
  }
  function matches(s) {
    if (filters.tag && s.tag !== filters.tag) return false;
    if (!filters.caps.every(function (c) { return s.caps.indexOf(c) >= 0; })) return false;
    if (filters.q) {
      var hay = (s.name + ' ' + s.short + ' ' + s.note + ' ' + s.use + ' ' + TAGNAME[s.tag] + ' ' + s.caps.map(function (c) { return CAPNAME[c]; }).join(' ')).toLowerCase();
      return filters.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    }
    return true;
  }
  var cards = {};
  function buildGrid() {
    var host = $('[data-grid]');
    ALL.forEach(function (s) {
      var ops = OPS[s.tag === 'graph' ? 'graph' : 'std'];
      var dl = h('dl', { class: 'sc-card__ops' });
      ops.forEach(function (o) {
        var c = s.ops[o[0]];
        dl.appendChild(h('div', null, h('dt', null, o[1]), h('dd', null, c.t === '—' ? h('span', { class: 'sc-card__na' }, '—') : badge(c.t), c.w ? h('small', null, 'worst ', badge(c.w)) : null, c.n ? h('em', null, c.n) : null)));
      });
      var inChart = !!pathToLeaf(s.id);
      var foot = h('div', { class: 'sc-card__foot' }, lessonLink(s.lesson, 'Lesson →', 'btn btn--ghost btn--sm'));
      if (inChart) foot.insertBefore(h('button', { type: 'button', class: 'btn btn--sm', onclick: function () { showInChart(s.id); } }, 'Show in chart'), foot.firstChild);
      var el = h('article', { class: 'sc-card', id: 's-' + s.id, 'data-tag': s.tag },
        h('header', null, h('h3', null, s.name), h('span', { class: 'sc-card__tag' }, TAGNAME[s.tag])),
        h('p', { class: 'sc-card__note' }, s.note),
        dl,
        h('p', { class: 'sc-card__space' }, h('span', null, 'Space'), badge(s.ops.space.t), s.ops.space.n ? h('em', null, s.ops.space.n) : null),
        h('details', { class: 'sc-card__more' }, h('summary', null, 'Use it when, and when not'), h('p', null, h('b', null, 'Use: '), s.use), h('p', null, h('b', null, 'Avoid: '), s.avoid)),
        foot);
      cards[s.id] = el; host.appendChild(el);
    });
  }
  function showInChart(id) {
    cancelScenario(); answers = pathToLeaf(id); $('[data-rec]').setAttribute('data-shown', '~'); draw();
    $('#fig-ask').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }
  function paintGrid() {
    var n = 0;
    ALL.forEach(function (s) { var m = matches(s); cards[s.id].hidden = !m; if (m) n++; });
    $$('[data-tag]', $('[data-tags]')).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tag') === filters.tag)); });
    $$('[data-cap]').forEach(function (b) { b.setAttribute('aria-pressed', String(filters.caps.indexOf(b.getAttribute('data-cap')) >= 0)); });
    var c = $('[data-count]');
    c.textContent = n === ALL.length ? 'All ' + n + ' structures' : n ? n + ' of ' + ALL.length + ' structures match' : 'Nothing matches. Ask for less: a structure that is fast at all of those at once may not exist.';
    writeUrl();
  }

  /* ------------------------------------------------------------------ boot */
  VDSA.ready(function () {
    readUrl();
    teaser();
    flow = VDSA.views.flowchart($('[data-flow]'), flowSpec(), { interactive: true, label: 'Decision chart for choosing a data structure' });
    flow.on('choose', function (e) { answer(e.label); });
    flow.on('click', function (e) { jumpTo(e.id); });
    buildScenarios(); buildFilters(); buildGrid();
    $('[data-back]').addEventListener('click', back);
    $('[data-restart]').addEventListener('click', restart);
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      var k = e.key.toLowerCase();
      if (k === 'y') answer('yes'); else if (k === 'n') answer('no'); else if (k === 'b') back(); else if (k === 'r') restart();
    });
    $('[data-rec]').setAttribute('data-shown', '~');
    draw(0); paintGrid();
    if (location.hash && /^#s-/.test(location.hash)) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView(); }, 200); }
  });
}());
