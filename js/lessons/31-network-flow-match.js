/* Lesson 31 · Max flow & min cut — part 4: bipartite matching (workers and jobs) as a flow network.
   Needs js/lessons/31-network-flow.js (VDSA.L31) and js/algos/31-network-flow.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var NF = V.algos.networkFlow;
  var L = V.L31;

  var PRESETS = [
    { label: 'A cascade of moves', text: 'Ana-Web, Ana-Data, Ben-Web, Cy-Data, Cy-Ops' },
    { label: 'Everyone fits', text: 'Ana-Web, Ana-Data, Ben-Data, Ben-Ops, Cy-Ops, Cy-Web' },
    { label: 'Too many for too few', text: 'Ana-Web, Ana-Data, Ben-Web, Ben-Data, Cy-Web, Cy-Data, Dee-Ops' },
    { label: 'Random', random: true }
  ];

  /* "Ana-Web, Ben-Web" -> {values: {pairs}, error} */
  function parsePairs(text) {
    var src = String(text || '').trim();
    if (!src) return { values: null, error: 'Type some pairs, for example Ana-Web, Ana-Data, Ben-Web.' };
    var parts = src.split(/[,;\n]+/).map(function (p) { return p.trim(); }).filter(Boolean);
    var pairs = [], W = {}, J = {}, seen = {}, nw = 0, nj = 0;
    for (var i = 0; i < parts.length; i++) {
      var m = /^([A-Za-z0-9_]+)\s*(?:->|→|-|>)\s*([A-Za-z0-9_]+)$/.exec(parts[i]);
      if (!m) return { values: null, error: '“' + parts[i] + '” is not a pair. Write it as worker-job, like Ana-Web.' };
      var w = m[1], j = m[2];
      if (!W[w]) { W[w] = true; nw++; }
      if (!J[j]) { J[j] = true; nj++; }
      if (W[j] && !J[j] && j !== w) { /* the same name used as worker and job is fine: roles come from position */ }
      if (!seen[w + '|' + j]) { seen[w + '|' + j] = true; pairs.push([w, j]); }
    }
    if (nw > 6) return { values: null, error: 'That is ' + nw + ' workers. Keep it to 6 or fewer so the picture stays readable.' };
    if (nj > 6) return { values: null, error: 'That is ' + nj + ' jobs. Keep it to 6 or fewer.' };
    if (pairs.length > 20) return { values: null, error: 'That is ' + pairs.length + ' pairs. Keep it to 20 or fewer.' };
    return { values: { pairs: pairs }, error: null };
  }
  function pairsText(pairs) { return pairs.map(function (p) { return p[0] + '-' + p[1]; }).join(', '); }
  function randomPairs(seed) {
    var rng = V.rng(seed), W = ['Ana', 'Ben', 'Cy', 'Dee', 'Eli'].slice(0, rng.int(3, 5)), J = ['Web', 'Data', 'Ops', 'QA', 'Docs'].slice(0, rng.int(3, 5)), out = [];
    W.forEach(function (w) {
      var k = rng.int(1, 2), pool = V.shuffle(J.slice(), rng);
      for (var i = 0; i < k; i++) out.push([w, pool[i]]);
    });
    return out;
  }

  function matchFigure(fig) {
    var seed = 5, residual = false, pairs = parsePairs(PRESETS[0].text).values.pairs;
    var m = NF.matchingNetwork(pairs), net = m.net;
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 420, label: 'Workers and jobs as a flow network', nodeRadius: 26, minRadius: 18 });
    function isMiddle(e) { return e.from.indexOf('w:') === 0 && e.to.indexOf('j:') === 0; }
    var labelT = L.spreadLabels(net, isMiddle);
    var list = fig.querySelector('[data-assign]');
    var rowEls = {}, lastAssign = {};
    L.legend(fig.querySelector('[data-legend]'), [L.LEG.path, L.LEG.reverse, { state: 'done', shape: 'line', label: 'Assigned pair' }, L.LEG.flow, L.LEG.cut, L.LEG.side]);

    function nm(id) { return L.norm(net).label[id] !== undefined ? L.norm(net).label[id] : id; }
    function sentence(step) {
      var arcs = step.path, parts = [], displaced = {};
      for (var i = 0; i < arcs.length; i++) {
        var a = arcs[i];
        if (a.dir === 'back') { displaced[a.to] = true; continue; }
        if (a.from.indexOf('w:') === 0 && a.to.indexOf('j:') === 0) {
          var next = arcs[i + 1];
          var holder = next && next.dir === 'back' && next.from === a.to ? nm(next.to) : null;
          if (displaced[a.from]) parts.push('<b>' + nm(a.from) + '</b>, who just lost a job, moves to <b>' + nm(a.to) + '</b>' + (holder ? ' (held by ' + holder + ')' : ''));
          else parts.push('<b>' + nm(a.from) + '</b> takes <b>' + nm(a.to) + '</b>' + (holder ? ' away from <b>' + holder + '</b>' : ''));
        }
      }
      return parts.join('; ');
    }
    function assignText(fl) {
      var a = NF.assignments(net, fl);
      return a.length ? a.map(function (p) { return p[0] + ' → ' + p[1]; }).join(', ') : 'nobody yet';
    }
    function generate() {
      var raw = NF.trace(net, { detail: 'rounds' });
      var W = m.workers.length;
      var steps = raw.map(function (st) {
        var o = L.fixVars(st);
        o.counters = { value: st.value, augmentations: st.counters.augmentations };
        if (st.kind === 'init') o.caption = 'Turn the question into pipes. The tap s feeds every worker one unit, every worker is joined to the jobs they can do, and every job drains one unit into t. Each pipe holds 1, so a worker gets at most one job and a job at most one worker. A flow of value <b>k</b> is then a matching of <b>k</b> pairs.';
        if (st.kind === 'path') {
          var back = st.path.some(function (a) { return a.dir === 'back'; });
          o.caption = 'Augmenting path <b>' + st.pathNodes.map(nm).join(' → ') + '</b>. Read it as: ' + sentence(st) + '.' + (back ? ' The dashed reverse hop is what lets the algorithm take a job back from someone who can do another one.' : ' No one loses anything: every worker and job on the path is free.');
        }
        if (st.kind === 'bottleneck') o.caption = 'Every arc has room 1, so the bottleneck is <b>1</b>: one more pair is matched, no more.';
        if (st.kind === 'push') o.caption = 'Push 1. The matching grows to <b>' + st.value + '</b> pair' + (st.value === 1 ? '' : 's') + '. Now: ' + assignText(st.fl) + '.';
        if (st.kind === 'nopath' || st.kind === 'cut') {
          var S = (st.kind === 'cut' ? st.cut.S : Object.keys(st.states).filter(function (id) { return st.states[id] === 'visited'; }));
          var sw = S.filter(function (id) { return id.indexOf('w:') === 0; }).map(nm), sj = S.filter(function (id) { return id.indexOf('j:') === 0; }).map(nm);
          var deficit = W - st.value;
          var tail = deficit > 0 && sw.length
            ? ' The workers <b>' + sw.join(', ') + '</b> can only reach the jobs <b>' + sj.join(', ') + '</b>: ' + sw.length + ' workers, ' + sj.length + ' job' + (sj.length === 1 ? '' : 's') + ', so someone has to go without. That is the cut, and it is the proof.'
            : (st.value === W ? ' Every worker has a job.' : ' There are fewer jobs than workers, so this is the most that is possible.');
          o.caption = st.kind === 'nopath'
            ? 'The search finds no way to reach t: no augmenting path, so <b>' + st.value + '</b> pair' + (st.value === 1 ? '' : 's') + ' is the maximum.' + tail
            : 'The vertices the search reached form the source side of a minimum cut, of capacity <b>' + st.cut.value + '</b> = the matching size.' + tail;
        }
        return o;
      });
      return steps;
    }
    function drawAssign(step, ms) {
      var a = NF.assignments(net, step.fl), cur = {};
      a.forEach(function (p) { cur[p[0]] = p[1]; });
      m.workers.forEach(function (w) {
        var row = rowEls[w];
        if (!row) {
          row = rowEls[w] = { el: h('li', { class: 'nf-assign__row' }, h('b', null, w), h('span', { class: 'nf-assign__arrow', 'aria-hidden': 'true' }, '→'), h('span', { class: 'nf-assign__job' })), job: null };
          list.appendChild(row.el);
        }
        var job = cur[w] || null, txt = job || 'no job yet';
        row.el.querySelector('.nf-assign__job').textContent = txt;
        row.el.classList.toggle('is-none', !job);
        if (lastAssign[w] !== undefined && lastAssign[w] !== job) { row.el.classList.remove('is-changed'); void row.el.offsetWidth; row.el.classList.add('is-changed'); }
        lastAssign[w] = job;
      });
      list.setAttribute('aria-label', 'Assignments: ' + (a.length ? a.map(function (p) { return p[0] + ' has ' + p[1]; }).join(', ') : 'none yet'));
    }
    function rebuildList() {
      V.clear(list); rowEls = {}; lastAssign = {};
    }
    function render(step, ctx) {
      view.render(L.flowState(net, step, { residual: residual, labelT: labelT }), { duration: ctx.duration });
      drawAssign(step, ctx.duration);
    }
    rebuildList();
    var player = V.player({
      root: fig, steps: generate(), render: render,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { value: 'Pairs matched', augmentations: 'Augmentations' }, counterStates: { value: 'done' },
      baseStepMs: 1500, label: 'Matching lab controls'
    });
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'path' && steps[i].path.some(function (a) { return a.dir === 'back'; })) return i;
      return -1;
    }, function (c) {
      var arcs = c.step.path, bi = -1;
      arcs.forEach(function (a, i) { if (bi < 0 && a.dir === 'back') bi = i; });
      if (bi < 1) return null;
      var taker = nm(arcs[bi - 1].from), job = nm(arcs[bi].from), holder = nm(arcs[bi].to);
      var moveTo = arcs[bi + 1] ? nm(arcs[bi + 1].to) : null;
      if (!moveTo) return null;
      return {
        question: '<b>' + taker + '</b> wants <b>' + job + '</b>, but <b>' + holder + '</b> holds it. The next augmenting path runs backward along ' + holder + '→' + job + '. What happens to ' + holder + '?',
        options: [holder + ' moves to ' + moveTo + ', and ' + taker + ' gets ' + job, holder + ' loses ' + job + ' and is left with no job', holder + ' keeps ' + job + ' and ' + taker + ' goes without'],
        answer: 0,
        explain: [
          'Yes. Going backward along the pipe means “take the job back from ' + holder + '”, and the path continues from ' + holder + ' to another job, ' + moveTo + '. Nobody is worse off and the matching grows by one.',
          'The path does not end at ' + holder + ': it goes on to ' + moveTo + ' and then to t. Taking the job back is only half of the move, and the other half seats ' + holder + ' elsewhere.',
          'That is what a greedy algorithm would do, and it is exactly the trap. The reverse arc exists so that an earlier choice can be changed when it blocks someone else.'
        ]
      };
    }, { id: 'nf-match-reroute' });

    function setPairs(p) {
      pairs = p; m = NF.matchingNetwork(pairs); net = m.net; labelT = L.spreadLabels(net, isMiddle);
      if (view.resetPositions) view.resetPositions();
      rebuildList();
      player.setSteps(generate());
    }
    var pending = null;
    var input = V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Worker-job pairs (up to 6 + 6)',
      value: pairsText(pairs), placeholder: 'e.g. Ana-Web, Ana-Data, Ben-Web',
      parse: parsePairs,
      presets: PRESETS.map(function (p) {
        return { label: p.label, value: function () { pending = p.random ? randomPairs(seed++) : parsePairs(p.text).values.pairs; return pairsText(pending); } };
      }),
      hint: 'Each pair says that this worker can do that job. Names are letters and digits.',
      onApply: function (values) { pending = null; setPairs(values.pairs); }
    });
    V.toggle(fig.querySelector('[data-residual]'), {
      label: 'Show the residual graph', checked: false,
      onChange: function (on) { residual = on; view.render(L.flowState(net, player.step, { residual: residual, labelT: labelT }), { duration: 450 }); }
    });
    void input;
  }

  V.ready(function () { L.lazy('#lab-match', matchFigure); });
}());
