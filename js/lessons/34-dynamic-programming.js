/* Lesson 34 · Dynamic programming I — figure wiring.
   Generators: js/algos/34-dynamic-programming.js (VDSA.algos['34-dynamic-programming'], tested in Node).
   Custom views: js/lessons/34-dynamic-programming-views.js (VDSA.dp34.table, .collapse, .renderEq).
   Lab problem code: js/lessons/34-dynamic-programming-lab.js (VDSA.dp34.PROBLEMS). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var A = V.algos['34-dynamic-programming'];
  var D = V.dp34;

  /* ------------------------------------------------------------------ helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  /* Initialise a figure once it comes within ~1.5 screens of the viewport. */
  function lazy(els, fn) {
    els = [].concat(els).filter(Boolean);
    var done = false;
    function run() { if (done) return; done = true; try { fn(); } catch (e) { console.error(e); } if (io) io.disconnect(); }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) run(); }, { rootMargin: '900px 0px 900px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }
  function fmtNum(v) { return v === Infinity ? '∞' : Number(v).toLocaleString('en-US'); }
  function fmtTime(calls) {
    var sec = calls / 1e8;
    if (sec < 0.001) return '< 1 ms';
    if (sec < 1) return Math.round(sec * 1000) + ' ms';
    if (sec < 60) return sec.toFixed(sec < 10 ? 1 : 0) + ' s';
    if (sec < 3600) return (sec / 60).toFixed(sec < 600 ? 1 : 0) + ' min';
    if (sec < 86400) return (sec / 3600).toFixed(1) + ' hours';
    return (sec / 86400).toFixed(1) + ' days';
  }
  function svgEl(w, hgt, cls, label) {
    return s('svg', { class: 'vz ' + (cls || ''), viewBox: '0 0 ' + w + ' ' + hgt, role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true' });
  }

  /* Tiny static tree for minis and the summary card. spec: [{id, label, parent, state}] (preorder). */
  function miniTreeSvg(nodes, o) {
    o = o || {};
    var byId = {}, kids = {};
    nodes.forEach(function (n) { byId[n.id] = n; kids[n.id] = []; });
    nodes.forEach(function (n) { if (n.parent !== null && n.parent !== undefined) kids[n.parent].push(n.id); });
    var leaf = 0, depthMax = 0;
    (function lay(id, d) {
      var n = byId[id]; n.d = d; depthMax = Math.max(depthMax, d);
      if (!kids[id].length) { n.x = leaf++; return; }
      kids[id].forEach(function (c) { lay(c, d + 1); });
      n.x = kids[id].reduce(function (a, c) { return a + byId[c].x; }, 0) / kids[id].length;
    }(nodes[0].id, 0));
    var sp = o.spacing || 30, lv = o.level || 40, r = o.r || 11, pad = r + 4;
    var W = pad * 2 + (leaf - 1) * sp, H = pad * 2 + depthMax * lv;
    var svg = svgEl(W, H, 'dp34-mini', o.label);
    svg.style.maxWidth = (W * (o.scale || 1.35)) + 'px';
    function P(n) { return [pad + n.x * sp, pad + n.d * lv]; }
    nodes.forEach(function (n) {
      if (n.parent === null || n.parent === undefined) return;
      var a = P(byId[n.parent]), b = P(n);
      svg.appendChild(s('g', { class: 'vz-edge is-default' }, s('path', { class: 'vz-line', d: 'M' + a[0] + ' ' + (a[1] + r) + 'L' + b[0] + ' ' + (b[1] - r) })));
    });
    nodes.forEach(function (n) {
      var p = P(n);
      svg.appendChild(s('g', { class: 'vz-item is-' + (n.state || 'default'), transform: 'translate(' + p[0] + ' ' + p[1] + ')' },
        s('circle', { class: 'vz-shape', r: r }),
        s('text', { class: 'vz-ink vz-value', 'text-anchor': 'middle', dy: '.35em', style: 'font-size:' + (o.font || Math.round(r * 0.95)) + 'px' }, n.label)));
    });
    return svg;
  }
  function fibMiniNodes(n) {
    return A.fibTree(n).map(function (t) { return { id: t.id, label: String(t.k), parent: t.parent, state: t.rep > 0 ? 'pivot' : 'visited' }; });
  }

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var stage = $('#teaser');
    if (!stage) return;
    var view = D.collapse(stage, { fitHeight: true, label: 'Teaser' });
    view.el.setAttribute('aria-hidden', 'true');
    var steps = A.collapseSteps(stage.clientWidth < 440 ? 5 : 6, { teaser: true });
    V.teaser(stage, { steps: steps, render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, stepMs: 1150, holdMs: 2800, instantWrap: true });
  }

  /* ================================================================== the problem: staircase */
  function stairsFigure() {
    var fig = $('#fig-stairs');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Hop of 1 stair' }, { state: 'frontier', shape: 'line', label: 'Hop of 2 stairs' }, { state: 'key', shape: 'dot', label: 'You' }]);
    var stage = fig.querySelector('[data-stage]'), cap = fig.querySelector('[data-caption]');
    cap.setAttribute('aria-live', 'polite');
    var wrap = h('div', { class: 'dp-stairs' });
    var art = h('div', { class: 'dp-stairs__art' });
    var lists = h('div', { class: 'dp-stairs__lists' });
    wrap.appendChild(art); wrap.appendChild(lists); stage.appendChild(wrap);
    var n = 4, ways = [], cur = 0, timer = 0, visible = false, token = 0, svg, climber, trail, geo;

    function stairPoint(k) { return { x: geo.x0 + k * geo.sw + geo.sw / 2, y: geo.ground - k * geo.sh - 13 }; }
    function drawStairs() {
      V.clear(art);
      var W = 320, H = 250, pad = 18;
      geo = { sw: (W - pad * 2) / (n + 1), ground: H - 22, x0: pad };
      geo.sh = Math.min(34, (H - 70) / Math.max(1, n));
      svg = svgEl(W, H, 'dp34-stairs', 'Staircase of ' + n + ' stairs');
      for (var k = 1; k <= n; k++) {
        var x = geo.x0 + k * geo.sw, y = geo.ground - k * geo.sh;
        svg.appendChild(s('rect', { class: 'dp34-step', x: x, y: y, width: (n + 1) * geo.sw + geo.x0 - x, height: geo.ground - y, rx: 3 }));
        svg.appendChild(s('text', { class: 'vz-label', x: x + geo.sw / 2, y: geo.ground + 15, 'text-anchor': 'middle' }, String(k)));
      }
      svg.appendChild(s('line', { class: 'dp34-ground', x1: 4, x2: W - 4, y1: geo.ground, y2: geo.ground }));
      svg.appendChild(s('text', { class: 'vz-label', x: geo.x0 + geo.sw / 2, y: geo.ground + 15, 'text-anchor': 'middle' }, '0'));
      var top = stairPoint(n);
      svg.appendChild(s('text', { class: 'dp34-top', x: top.x, y: top.y - 22, 'text-anchor': 'middle' }, 'top'));
      trail = s('g'); svg.appendChild(trail);
      climber = s('g', { class: 'vz-item is-key' }, s('circle', { class: 'vz-shape', r: 9 }));
      svg.appendChild(climber);
      var p0 = stairPoint(0); V.place(climber, { x: p0.x, y: p0.y });
      art.appendChild(svg);
    }
    function hopPath(a, b) {
      var p = stairPoint(a), q = stairPoint(b), lift = b - a === 1 ? 26 : 40;
      return { p: p, q: q, c: { x: (p.x + q.x) / 2, y: Math.min(p.y, q.y) - lift } };
    }
    function drawTrail(way, upto) {
      V.clear(trail);
      var at = 0;
      way.forEach(function (hop, i) {
        if (i >= upto) return;
        var g = hopPath(at, at + hop);
        trail.appendChild(s('g', { class: 'vz-edge is-' + (hop === 1 ? 'active' : 'frontier') },
          s('path', { class: 'vz-line', d: 'M' + g.p.x + ' ' + g.p.y + ' Q' + g.c.x + ' ' + g.c.y + ' ' + g.q.x + ' ' + g.q.y })));
        at += hop;
      });
    }
    function drawLists() {
      V.clear(lists);
      var one = [], two = [];
      ways.forEach(function (w, i) { (w[w.length - 1] === 1 ? one : two).push(i); });
      function group(idx, title, cls) {
        var g = h('div', { class: 'dp-stairs__group ' + cls });
        g.appendChild(h('p', { class: 'dp-stairs__gtitle', html: title }));
        var box = h('div', { class: 'dp-stairs__chips' });
        idx.forEach(function (i) {
          var chip = h('button', { type: 'button', class: 'dp-chip', 'data-way': i, 'aria-label': 'Way ' + (i + 1) + ': ' + ways[i].join(' plus ') },
            ways[i].map(function (hp, j) { return [j ? h('span', { class: 'dp-chip__plus' }, '+') : null, h('span', { class: 'dp-chip__hop is-' + (hp === 1 ? 'one' : 'two') }, String(hp))]; }));
          chip.addEventListener('click', function () { cur = i; restart(true); });
          box.appendChild(chip);
        });
        if (!idx.length) box.appendChild(h('span', { class: 'dp-stairs__none' }, 'none'));
        g.appendChild(box);
        return g;
      }
      lists.appendChild(h('p', { class: 'dp-stairs__total', html: '<b>' + ways.length + '</b> way' + (ways.length === 1 ? '' : 's') + ' to climb ' + n + ' stair' + (n === 1 ? '' : 's') }));
      lists.appendChild(group(one, 'Last hop is <b>1</b>, from stair ' + (n - 1) + ': <b>' + one.length + '</b> = ways(' + (n - 1) + ')', 'is-one'));
      lists.appendChild(group(two, n >= 2 ? 'Last hop is <b>2</b>, from stair ' + (n - 2) + ': <b>' + two.length + '</b> = ways(' + (n - 2) + ')' : 'Last hop is <b>2</b>: impossible for 1 stair', 'is-two'));
    }
    function mark() {
      V.$$('.dp-chip', lists).forEach(function (c) { c.classList.toggle('is-current', +c.getAttribute('data-way') === cur); });
      var w = ways[cur], last = w[w.length - 1];
      V.$$('.dp-stairs__group', lists).forEach(function (g) { g.classList.toggle('is-lit', g.classList.contains(last === 1 ? 'is-one' : 'is-two')); });
      cap.innerHTML = 'Way ' + (cur + 1) + ' of ' + ways.length + ': <b>' + w.join(' + ') + '</b>. Its last hop is a ' + last + ', from stair ' + (n - last) + '.';
    }
    function playWay(tok) {
      var way = ways[cur], at = 0, i = 0;
      mark(); drawTrail(way, 0);
      var p0 = stairPoint(0); V.place(climber, { x: p0.x, y: p0.y });
      function hop() {
        if (tok !== token) return;
        if (i >= way.length) { timer = setTimeout(function () { if (tok !== token) return; cur = (cur + 1) % ways.length; playWay(tok); }, 1100); return; }
        var g = hopPath(at, at + way[i]);
        V.tween(420, function (t, e) {
          var u = 1 - e, x = u * u * g.p.x + 2 * u * e * g.c.x + e * e * g.q.x, y = u * u * g.p.y + 2 * u * e * g.c.y + e * e * g.q.y;
          V.place(climber, { x: x, y: y });
        }, { ease: 'inOut' }).promise.then(function () {
          if (tok !== token) return;
          at += way[i]; i++; drawTrail(way, i);
          timer = setTimeout(hop, 140);
        });
      }
      timer = setTimeout(hop, 350);
    }
    function staticWay() { mark(); drawTrail(ways[cur], ways[cur].length); var p = stairPoint(n); V.place(climber, { x: p.x, y: p.y }); }
    function restart(userPick) {
      token++; clearTimeout(timer);
      if (visible && !V.reducedMotion()) playWay(token); else staticWay();
      if (userPick) { /* keep focus on the chip; caption announces the way */ }
    }
    function load(newN) {
      n = newN; ways = A.stairsWays(n); cur = 0;
      drawStairs(); drawLists(); restart();
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Stairs n', min: 1, max: 7, value: n, onInput: function (v) { if (v !== n) load(v); } });
    V.onVisible(fig, function (v) { var was = visible; visible = v; if (v !== was) restart(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { token++; clearTimeout(timer); } else restart(); });
    load(n);
  }

  /* ================================================================== the problem: call explosion */
  function explodeFigure() {
    var fig = $('#fig-explode');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', label: 'Plain recursion' }, { state: 'found', label: 'With a memo' }]);
    var stage = fig.querySelector('[data-stage]');
    var MAXLOG = 11;
    function bar(label, state) {
      var fill = h('div', { class: 'dp-bar__fill', 'data-state': state }), val = h('span', { class: 'dp-bar__val' });
      var row = h('div', { class: 'dp-bar' }, h('span', { class: 'dp-bar__label' }, label), h('div', { class: 'dp-bar__track' }, fill), val);
      return { row: row, fill: fill, val: val };
    }
    var plain = bar('Plain recursion', 'pivot'), memo = bar('With a memo', 'found');
    var ticks = h('div', { class: 'dp-bar dp-bar--ticks', 'aria-hidden': 'true' }, h('span', { class: 'dp-bar__label' }), h('div', { class: 'dp-bar__track dp-bar__track--ticks' },
      [[0, '1'], [3, '1 thousand'], [6, '1 million'], [9, '1 billion']].map(function (t) { return h('span', { class: 'dp-tick', style: { left: (t[0] / MAXLOG * 100) + '%' } }, t[1]); })), h('span', { class: 'dp-bar__val' }));
    stage.appendChild(h('div', { class: 'dp-bars' }, plain.row, memo.row, ticks));
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { calls: 'Plain recursion calls', time: 'Time at 10⁸ calls/s', memo: 'Calls with a memo', distinct: 'Different questions' }, states: { calls: 'pivot', memo: 'found' } });
    function update(n) {
      var c = A.naiveCalls(n), m = A.memoCalls(n);
      plain.fill.style.width = Math.max(1.5, Math.log10(c) / MAXLOG * 100) + '%';
      memo.fill.style.width = Math.max(1.5, Math.log10(m) / MAXLOG * 100) + '%';
      plain.val.textContent = fmtNum(c); memo.val.textContent = fmtNum(m);
      stats.update({ calls: fmtNum(c), time: fmtTime(c), memo: fmtNum(m), distinct: fmtNum(n + 1) });
      fig.querySelector('.fig__title').textContent = 'Calls made to count the ways up ' + n + ' stair' + (n === 1 ? '' : 's');
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Stairs n', min: 1, max: 50, value: 30, onInput: update });
    update(30);
  }

  /* ================================================================== intuition minis */
  function intuitionMinis() {
    var row = $('#mini-intuition');
    var fibSvg = miniTreeSvg(fibMiniNodes(4), { label: 'Recursion tree of fib(4): fib(2) appears twice, fib(1) three times, fib(0) twice.', spacing: 30, level: 38 });
    // notebook
    var nb = svgEl(230, 150, 'dp34-mini dp34-notebook', 'A notebook with fib(2) = 1, fib(3) = 2, fib(4) = 3; the question fib(3) is answered from the notebook.');
    nb.style.maxWidth = '300px';
    nb.appendChild(s('rect', { class: 'dp34-page', x: 70, y: 8, width: 150, height: 134, rx: 8 }));
    nb.appendChild(s('text', { class: 'dp34-page-title', x: 84, y: 30 }, 'memo'));
    [['fib(2)', '1'], ['fib(3)', '2'], ['fib(4)', '3']].forEach(function (r, i) {
      var y = 52 + i * 28, hit = i === 1;
      nb.appendChild(s('g', { class: 'vz-item is-' + (hit ? 'found' : 'visited') },
        s('rect', { class: 'vz-shape', x: 80, y: y - 11, width: 130, height: 22, rx: 5 }),
        s('text', { class: 'vz-ink', x: 90, y: y + 1, dy: '.3em', style: 'font: 600 12px var(--font-mono)' }, r[0] + ' = ' + r[1])));
    });
    nb.appendChild(s('g', { class: 'vz-item is-active' }, s('rect', { class: 'vz-shape', x: 4, y: 68, width: 52, height: 26, rx: 13 }), s('text', { class: 'vz-ink', x: 30, y: 82, dy: '.3em', 'text-anchor': 'middle', style: 'font: 700 11px var(--font-mono)' }, 'fib(3)?')));
    nb.appendChild(s('g', { class: 'vz-edge is-found' }, s('path', { class: 'vz-line', d: 'M57 81 Q68 81 76 81' }), s('path', { class: 'vz-head', d: V.vz.arrowHead(79, 81, 0, 7) })));
    // merge sort: every range different
    var ms = [], id = 0;
    (function split(lo, hi, parent) {
      var me = 'm' + (id++), letters = 'abcdefgh';
      ms.push({ id: me, parent: parent, label: hi - lo === 1 ? letters[lo] : hi - lo === 2 ? letters[lo] + letters[lo + 1] : letters[lo] + '–' + letters[hi - 1], state: 'visited' });
      if (hi - lo > 1) { var mid = (lo + hi) >> 1; split(lo, mid, me); split(mid, hi, me); }
    }(0, 8, null));
    var msSvg = miniTreeSvg(ms, { label: 'Merge sort recursion tree on 8 items: every call works on a different range.', spacing: 27, level: 36, r: 11.5, font: 9 });
    [[fibSvg, '<b>No notes.</b> Plain recursion answers fib(2) twice and fib(1) three times (magenta = repeats).'],
      [nb, '<b>A notebook.</b> Check it first: fib(3) is already written down, so no work is repeated.'],
      [msSvg, '<b>Nothing repeats.</b> Merge sort’s calls all cover different ranges: a notebook would never be read.']].forEach(function (m) {
      row.appendChild(h('figure', { class: 'mini' }, h('div', { class: 'mini__stage' }, m[0]), h('figcaption', { html: m[1] })));
    });
  }

  /* ================================================================== recursion tree: plain vs memo */
  function traceFigure() {
    var fig = $('#fig-trace');
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Running call' }, { state: 'frontier', label: 'Waiting for a child' }, { state: 'visited', label: 'Returned' },
      { state: 'pivot', label: 'Repeat of a solved question' }, { state: 'found', label: 'Memo hit' }, { state: 'muted', label: 'Skipped thanks to the memo' }]);
    var tree = V.views.tree(fig.querySelector('[data-tree]'), { label: 'Recursion tree of fib', nodeSize: 34, gap: 0.4 });
    var row = V.views.array(fig.querySelector('[data-row]'), { label: 'Times each question was asked', cellSize: 42 });
    var mode = 'plain', n = 5;
    var player = V.player({
      root: fig, steps: [], baseStepMs: 1000, label: 'Recursion tree controls',
      render: function (st, ctx) { tree.render(st.tree, { duration: ctx.duration }); row.render(st.row, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { calls: 'Calls made', distinct: 'Different questions', hits: 'Memo hits' }, counterStates: { hits: 'found', calls: 'active' }
    });
    function load() {
      var steps = A.fibTrace(n, { memo: mode === 'memo' });
      tree.reset(); tree.prepare(steps.map(function (x) { return x.tree; }));
      row.reset(); row.prepare(steps.map(function (x) { return x.row; }));
      player.setSteps(steps);
    }
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'repeat' && steps[i].repeatK >= 2) return i;
      return -1;
    }, function (c) {
      var k = c.step.repeatK;
      return {
        question: '<code>fib(' + k + ')</code> is about to be called a second time. What does plain recursion do?',
        options: ['Redo every call below it, exactly as the first time', 'Return the answer it found last time', 'Skip it, because it is already in the tree'],
        answer: 0,
        explain: ['Plain recursion keeps no notes. Each call knows only its own argument, so the whole subtree runs again.',
          'That is what a memo would do. Without one, nothing from the first time was saved.',
          'The tree is a picture of what happened, not a memory the program can read.']
      };
    }, { id: 'trace-plain-repeat' });
    player.addCheckpoint(function (steps) {
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'hit') return i;
      return -1;
    }, function (c) {
      var node = c.step.tree.nodes.filter(function (x) { return x.state === 'found' && x.badge === 'memo'; }).pop();
      var k = node ? +node.label : 2, v = A.fib(k);
      return {
        question: '<code>fib(' + k + ')</code> is asked again, and the memo already holds fib(' + k + ') = ' + v + '. What happens?',
        options: ['It returns ' + v + ' at once; nothing below it is called', 'It calls fib(' + (k - 1) + ') and fib(' + (k - 2) + ') again, then updates the memo', 'It returns 0: only base cases return immediately'],
        answer: 0,
        explain: ['The memo check comes before any recursion, so a hit costs one call and skips the whole subtree.',
          'That is plain recursion. The point of the memo is to never compute a stored answer twice.',
          'A memo hit returns immediately too, with the stored value, not 0.']
      };
    }, { id: 'trace-memo-hit' });
    V.segmented(fig.querySelector('[data-mode]'), { label: 'Recursion style', value: mode,
      options: [{ value: 'plain', label: 'Plain recursion' }, { value: 'memo', label: 'With a memo' }],
      onChange: function (v) { mode = v; load(); } });
    V.slider(fig.querySelector('[data-n]'), { label: 'n', min: 3, max: 6, value: n, onChange: function (v) { if (v !== n) { n = v; load(); } }, onInput: function (v) { if (v !== n) { n = v; load(); } } });
    load();
  }

  /* ================================================================== the collapse (showpiece) */
  function collapseFigure() {
    var fig = $('#fig-collapse');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'visited', label: 'First time a question is asked' }, { state: 'pivot', label: 'Copy of an earlier call' },
      { state: 'active', label: 'Cell being filled' }, { state: 'compare', label: 'Cells it reads' }]);
    var view = D.collapse(fig.querySelector('[data-stage]'), { label: 'Recursion tree collapsing into a row of cells' });
    var n = fig.clientWidth < 560 ? 5 : 6;
    var player = V.player({ root: fig, steps: A.collapseSteps(n), baseStepMs: 1700, animMs: 1250, label: 'Collapse controls',
      render: function (st, ctx) { view.render(st, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]') });
    function title() { fig.querySelector('.fig__title').textContent = A.naiveCalls(n) + ' calls collapse into ' + (n + 1) + ' cells'; }
    V.segmented(fig.querySelector('[data-n]'), { label: 'Which fib', value: String(n),
      options: [{ value: '4', label: 'fib(4)' }, { value: '5', label: 'fib(5)' }, { value: '6', label: 'fib(6)' }, { value: '7', label: 'fib(7)' }],
      onChange: function (v) { n = +v; title(); player.setSteps(A.collapseSteps(n)); } });
    title();
  }

  /* ================================================================== anatomy of a DP table (static) */
  function anatomyFigure() {
    var fig = $('#fig-anatomy');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'compare', label: 'Cells dp[6] reads' }, { state: 'key', label: 'Winning choice' }, { state: 'found', label: 'Answer' }, { state: 'visited', label: 'Filled' }]);
    var vals = [0, 1, 2, 1, 1, 2, 2], W = 720, H = 280, cs = 58, pitch = 86, x0 = (W - pitch * 7) / 2 + (pitch - cs) / 2, top = 132;
    var svg = svgEl(W, H, 'dp34-anatomy', 'A DP table for the fewest coins from 1, 3 and 4: dp[0..6] = 0, 1, 2, 1, 1, 2, 2. Arrows from dp[5], dp[3] and dp[2] lead into dp[6]; the arrow from dp[3] wins.');
    svg.style.maxWidth = '860px';
    function cx(i) { return x0 + i * pitch + cs / 2; }
    function marker(x, y, num) { svg.appendChild(s('g', { class: 'dp34-marker', transform: 'translate(' + x + ' ' + y + ')' }, s('circle', { r: 12 }), s('text', { 'text-anchor': 'middle', dy: '.35em' }, String(num)))); }
    // nested arcs: the shortest span lands furthest left, so no two arcs cross
    [[5, 'compare', '+1', 22, -22], [3, 'key', '+3', 50, -4], [2, 'compare', '+4', 74, 14]].forEach(function (a) {
      var x1 = cx(a[0]) + 6, x2 = cx(6) + a[4], y = top - 4, qy = y - 2 * a[3], qx = (x1 + x2) / 2;
      var ang = Math.atan2(y - qy, x2 - qx), t = 0.3, u = 1 - t;
      var lx = u * u * x1 + 2 * u * t * qx + t * t * x2, ly = u * u * y + 2 * u * t * qy + t * t * y;
      svg.appendChild(s('g', { class: 'vz-edge is-' + a[1] }, s('path', { class: 'dp34-arc-halo', d: 'M' + x1 + ' ' + y + ' Q' + qx + ' ' + qy + ' ' + x2 + ' ' + y }),
        s('path', { class: 'vz-line', d: 'M' + x1 + ' ' + y + ' Q' + qx + ' ' + qy + ' ' + x2 + ' ' + y }), s('path', { class: 'vz-head', d: V.vz.arrowHead(x2, y, ang, 8) }),
        s('text', { class: 'dp34-arclabel', x: lx - 12, y: ly - 4, 'text-anchor': 'middle' }, a[2])));
    });
    vals.forEach(function (v, i) {
      var st = i === 6 ? 'found' : i === 3 ? 'key' : (i === 5 || i === 2) ? 'compare' : 'visited';
      svg.appendChild(s('g', { class: 'vz-item is-' + st, transform: 'translate(' + (x0 + i * pitch) + ' ' + top + ')' },
        s('rect', { class: 'vz-shape', width: cs, height: cs, rx: 11 }), s('text', { class: 'vz-ink vz-value', x: cs / 2, y: cs / 2, dy: '.35em', 'text-anchor': 'middle', style: 'font-size:22px' }, String(v))));
      svg.appendChild(s('text', { class: 'vz-label', x: cx(i), y: top + cs + 18, 'text-anchor': 'middle', style: 'font-size:13px' }, 'dp[' + i + ']'));
    });
    var oy = top + cs + 46;
    svg.appendChild(s('g', { class: 'vz-edge is-active' }, s('path', { class: 'vz-line', d: 'M' + (x0 + 2) + ' ' + oy + ' L' + (x0 + 6 * pitch + cs - 8) + ' ' + oy }), s('path', { class: 'vz-head', d: V.vz.arrowHead(x0 + 6 * pitch + cs, oy, 0, 9) })));
    svg.appendChild(s('text', { class: 'dp34-note', x: W / 2, y: oy + 24, 'text-anchor': 'middle' }, 'fill in this direction: every arrow points right'));
    svg.appendChild(s('text', { class: 'dp34-note', x: x0 - 8, y: 26 }, 'dp[a] = fewest coins that make exactly a'));
    marker(x0 + 3 * pitch - 2, top - 2, 1);
    marker(cx(2) - 14, top - 40, 2);
    marker(x0 - 20, top + cs / 2, 3);
    marker(x0 - 20, oy, 4);
    marker(x0 + 6 * pitch + cs + 20, top + cs / 2, 5);
    fig.querySelector('[data-stage]').appendChild(svg);
  }

  /* ================================================================== top-down vs bottom-up */
  function orderFigure() {
    var fig = $('#fig-order');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'frontier', label: 'Asked, waiting (on the stack)' }, { state: 'active', label: 'Working on' }, { state: 'found', label: 'Memo hit' }, { state: 'visited', label: 'Finished' }, { state: 'muted', label: '∞: impossible' }]);
    var left = D.table(fig.querySelector('[data-left]'), { label: 'Top-down memo table', cellMax: 40, cellMin: 17, gap: 4, arcLabels: false, labels: false });
    var right = D.table(fig.querySelector('[data-right]'), { label: 'Bottom-up table', cellMax: 40, cellMin: 17, gap: 4, arcLabels: false, labels: false });
    var lc = fig.querySelector('[data-left-cap]'), rc = fig.querySelector('[data-right-cap]');
    var PRESETS = { a: { coins: [3, 5], amount: 11 }, b: { coins: [1, 2], amount: 8 }, c: { coins: [4, 5], amount: 13 } };
    var player = V.player({
      root: fig, steps: [], baseStepMs: 1000, label: 'Top-down versus bottom-up controls',
      render: function (st, ctx) {
        left.render({ rows: st.left.rows, arcs: st.left.arcs, cursor: st.left.cursor }, { duration: ctx.duration });
        right.render({ rows: st.right.rows, arcs: st.right.arcs, cursor: st.right.cursor }, { duration: ctx.duration });
        lc.innerHTML = st.left.caption; rc.innerHTML = st.right.caption;
        lc.classList.toggle('is-end', st.left.end); rc.classList.toggle('is-end', st.right.end);
      },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { tdCalls: 'Top-down calls', tdDepth: 'Stack depth now', tdCells: 'Top-down cells', buCells: 'Bottom-up cells' }, counterStates: { tdDepth: 'frontier' }
    });
    function load(key) {
      var p = PRESETS[key], steps = A.orderSteps(p.coins, p.amount);
      [left, right].forEach(function (v, i) { v.reset(); v.prepare(steps.map(function (x) { var side = i ? x.right : x.left; return { rows: side.rows, arcs: side.arcs }; })); });
      player.setSteps(steps);
    }
    V.segmented(fig.querySelector('[data-preset]'), { label: 'Coins and amount', value: 'a',
      options: [{ value: 'a', label: '{3, 5} → 11' }, { value: 'b', label: '{1, 2} → 8' }, { value: 'c', label: '{4, 5} → 13' }],
      onChange: load });
    load('a');
  }

  /* ================================================================== the lab */
  var FLOW_SPEC = {
    nodes: [
      { id: 'state', type: 'start', text: 'Define the state: what one cell means', col: 0, row: 0 },
      { id: 'rec', text: 'Write the recurrence from smaller states', col: 0, row: 1 },
      { id: 'base', text: 'Set the base cases', col: 0, row: 2 },
      { id: 'next', type: 'decision', text: 'Next state in order?', col: 0, row: 3 },
      { id: 'fill', text: 'Apply the recurrence, store the cell', col: 1, row: 3 },
      { id: 'answer', text: 'Read the answer cell', col: 0, row: 4 },
      { id: 'recon', type: 'end', text: 'Walk the stored choices back', col: 0, row: 5 }
    ],
    edges: [
      { from: 'state', to: 'rec' }, { from: 'rec', to: 'base' }, { from: 'base', to: 'next' },
      { from: 'next', to: 'fill', label: 'yes' }, { from: 'fill', to: 'next', via: { fromSide: 'top', toSide: 'top' } },
      { from: 'next', to: 'answer', label: 'no' }, { from: 'answer', to: 'recon' }
    ]
  };
  function lab() {
    var fig = $('#lab-fig');
    var P = D.PROBLEMS;
    var flowFig = $('#fig-flow');
    V.legend(flowFig.querySelector('[data-legend]'), [{ state: 'active', label: 'Step running in the lab' }, { state: 'visited', label: 'Already passed' }]);
    var flowView = V.views.flowchart(flowFig.querySelector('[data-stage]'), FLOW_SPEC, { label: 'Flowchart of the DP recipe' });
    var seen = [];
    var flow = { highlight: function (id, ctx) {
      if (ctx && ctx.instant) seen = [];
      if (id && seen.indexOf(id) === -1) seen.push(id);
      flowView.render({ active: id, visited: seen.filter(function (x) { return x !== id; }) }, { duration: ctx ? ctx.duration : 0 });
    } };
    var stage = fig.querySelector('[data-stage]');
    var view = D.table(stage, { label: 'DP table', cellMax: 52, cellMin: 24 });
    var eqEl = fig.querySelector('[data-eq]');
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: P.stairs.code, default: 'pseudo', maxHeight: 300, title: 'dp' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), {});
    var current = 'coinMin';
    var inputs = {
      stairs: { n: 7 },
      coinMin: { coins: [1, 3, 4], amount: 10 },
      coinWays: { coins: [1, 2, 5], amount: 8 },
      robber: { houses: [2, 7, 9, 3, 1, 8, 4] },
      lis: { values: [3, 1, 4, 1, 5, 9, 2, 6] }
    };
    var player = V.player({
      root: fig, steps: [], baseStepMs: 1150, label: 'DP lab controls',
      render: function (st, ctx) { view.render(st.table, { duration: ctx.duration }); D.renderEq(eqEl, st.eq); },
      code: code, vars: vars, flow: flow,
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { cells: 'Cells filled', reads: 'Cells read' }, counterStates: { reads: 'compare' }
    });
    function generate() {
      var inp = inputs[current];
      if (current === 'stairs') return A.lab.stairs(inp.n);
      if (current === 'coinMin') return A.lab.coinMin(inp.coins, inp.amount);
      if (current === 'coinWays') return A.lab.coinWays(inp.coins, inp.amount);
      if (current === 'robber') return A.lab.robber(inp.houses);
      return A.lab.lis(inp.values);
    }
    function load() {
      var vs = P[current].varStates;
      var steps = generate().map(function (st) { return Object.assign({}, st, { varStates: vs }); });
      view.reset(); view.prepare(steps.map(function (x) { return x.table; }));
      player.setSteps(steps);
    }
    function unique(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
    player.addCheckpoint(function (steps) {
      if (current !== 'coinMin') return -1;
      var fallback = -1;
      for (var i = 1; i < steps.length; i++) {
        var p = steps[i - 1];
        if (steps[i].kind !== 'write' || !p.predict) continue;
        var finite = p.predict.cands.filter(function (v) { return v !== '∞'; });
        if (unique(finite).length >= 2 && p.predict.a >= 4) return i;
        if (fallback < 0 && finite.length && p.predict.a >= 2) fallback = i;
      }
      return fallback;
    }, function (c) {
      var pr = c.prev.predict, best = pr.best === Infinity ? '∞' : String(pr.best);
      var opts = unique([best].concat(pr.cands));
      if (opts.length < 3 && best !== '∞') opts.push(String(pr.best + 1));
      if (opts.length < 4 && opts.indexOf('∞') === -1) opts.push('∞');
      opts = unique(opts).sort(function (x, y) { return (x === '∞' ? 1e9 : +x) - (y === '∞' ? 1e9 : +y); });
      var win = c.prev.eq.terms.filter(function (t) { return t.val === best; })[0];
      return {
        question: 'What goes into <code>dp[' + pr.a + ']</code>?',
        options: opts.map(function (o) { return o === '∞' ? '∞ (impossible)' : o + ' coin' + (o === '1' ? '' : 's'); }),
        answer: opts.indexOf(best),
        explain: opts.map(function (o) {
          if (o === best) return 'Take the smallest candidate: ' + (win ? win.sym + ' = ' + win.num + ' = ' + best : best) + '. The last coin is the one on that arrow.';
          if (o === '∞') return '∞ would mean no coin leads back to a reachable amount, but at least one candidate is finite.';
          if (pr.cands.indexOf(o) !== -1) return o + ' is one of the candidates, but min() keeps the smallest, and ' + best + ' is smaller.';
          return o + ' is not one of the candidates. Add 1 to each cell the arrows come from, then take the smallest.';
        })
      };
    }, { id: 'lab-coin-next' });

    /* per-problem input controls */
    var inputHost = fig.querySelector('[data-input]');
    function amountSlider(el, max) {
      V.slider(el, { label: 'Amount', min: 0, max: max, value: inputs[current].amount, onInput: function (v) { if (v !== inputs[current].amount) { inputs[current].amount = v; load(); } } });
    }
    function buildInputs() {
      V.clear(inputHost);
      if (current === 'stairs') {
        var sl = h('div', { class: 'dp-grow' }); inputHost.appendChild(sl);
        V.slider(sl, { label: 'Stairs n', min: 0, max: A.LIMITS.stairs, value: inputs.stairs.n, onInput: function (v) { if (v !== inputs.stairs.n) { inputs.stairs.n = v; load(); } } });
        return;
      }
      if (current === 'coinMin' || current === 'coinWays') {
        var row = h('div', { class: 'dp-lab-coinrow' });
        var ir = h('div', { class: 'dp-lab-coins' }), am = h('div', { class: 'dp-lab-amount' });
        row.appendChild(ir); row.appendChild(am); inputHost.appendChild(row);
        var presets = current === 'coinMin'
          ? [{ label: '{1, 3, 4}: greedy trap', value: [1, 3, 4] }, { label: '{1, 2, 5}', value: [1, 2, 5] }, { label: '{2}: odd is impossible', value: [2] }, { label: '{5, 7}: sparse', value: [5, 7] }, { label: '{1}', value: [1] }]
          : [{ label: '{1, 2, 5}', value: [1, 2, 5] }, { label: '{2, 3}', value: [2, 3] }, { label: '{1, 2, 3, 4}', value: [1, 2, 3, 4] }, { label: '{3}', value: [3] }];
        V.inputRow(ir, { label: 'Coin values (up to 4, from 1 to 9)', value: inputs[current].coins, parse: A.parse.coins, presets: presets, applyLabel: 'Apply',
          onApply: function (vals) { inputs[current].coins = vals; load(); } });
        amountSlider(am, current === 'coinMin' ? A.LIMITS.amount : A.LIMITS.waysAmount);
        return;
      }
      var box = h('div', { class: 'dp-grow' }); inputHost.appendChild(box);
      if (current === 'robber') {
        V.inputRow(box, { label: 'Money in each house (up to 10, 0 to 99)', value: inputs.robber.houses, parse: A.parse.houses,
          presets: [
            { label: 'Random', value: function () { return V.presets.random(7, { min: 1, max: 30 }); } },
            { label: 'All equal', value: [5, 5, 5, 5, 5, 5] },
            { label: 'Big gaps', value: [2, 1, 1, 9, 1, 1, 9] },
            { label: 'Increasing', value: [1, 2, 3, 4, 5, 6, 7] },
            { label: 'One house', value: [42] }
          ], onApply: function (vals) { inputs.robber.houses = vals; load(); } });
      } else {
        V.inputRow(box, { label: 'Your numbers (up to 10, −99 to 99)', value: inputs.lis.values, parse: A.parse.lis,
          presets: [
            { label: 'Random', value: function () { return V.presets.random(8, { min: 1, max: 40 }); } },
            { label: 'Sorted', value: [2, 5, 8, 11, 14, 20, 26, 31] },
            { label: 'Reversed', value: [31, 26, 20, 14, 11, 8, 5, 2] },
            { label: 'Duplicates', value: [4, 4, 2, 4, 6, 6, 1, 7] },
            { label: 'One value', value: [7] }
          ], onApply: function (vals) { inputs.lis.values = vals; load(); } });
      }
    }
    function selectProblem(key) {
      current = key;
      code.setSource(P[key].code);
      V.legend(fig.querySelector('[data-legend]'), P[key].legend);
      buildInputs();
      load();
    }
    V.segmented(fig.querySelector('[data-problem]'), { label: 'Problem', value: current,
      options: ['stairs', 'coinMin', 'coinWays', 'robber', 'lis'].map(function (k) { return { value: k, label: P[k].short }; }),
      onChange: selectProblem });
    selectProblem(current);
  }

  /* ================================================================== is it DP? (interactive decision tree) */
  function chooseFigure() {
    var fig = $('#fig-choose');
    var spec = {
      nodes: [
        { id: 'q1', type: 'decision', text: 'Built from answers to smaller versions?', col: 0, row: 0 },
        { id: 'other', type: 'end', text: 'Try another approach', col: 1, row: 0 },
        { id: 'q2', type: 'decision', text: 'Do the smaller problems repeat?', col: 0, row: 1 },
        { id: 'dc', type: 'end', text: 'Divide and conquer', col: 1, row: 1 },
        { id: 'q3', type: 'decision', text: 'Is one local choice provably safe?', col: 0, row: 2 },
        { id: 'greedy', type: 'end', text: 'Greedy', col: 1, row: 2 },
        { id: 'q4', type: 'decision', text: 'Does a small state capture all the future needs?', col: 0, row: 3 },
        { id: 'add', text: 'Add a dimension to the state', col: 1, row: 3 },
        { id: 'dp', type: 'end', text: 'Dynamic programming', col: 0, row: 4 }
      ],
      edges: [
        { from: 'q1', to: 'q2', label: 'yes' }, { from: 'q1', to: 'other', label: 'no' },
        { from: 'q2', to: 'q3', label: 'yes' }, { from: 'q2', to: 'dc', label: 'no' },
        { from: 'q3', to: 'greedy', label: 'yes' }, { from: 'q3', to: 'q4', label: 'no' },
        { from: 'q4', to: 'dp', label: 'yes' }, { from: 'q4', to: 'add', label: 'no' },
        { from: 'add', to: 'q4', label: 'ask again', dashed: true, via: { fromSide: 'top', toSide: 'top' } }
      ]
    };
    var CAP = {
      q1: 'Start here. Can the answer be put together from answers to smaller versions of the same problem?',
      q2: 'Yes. Next: when you break it down, do the same smaller problems come up more than once?',
      q3: 'They repeat, so remembering will pay. Can you <em>prove</em> that one local choice is always safe?',
      q4: 'Choices interact, so you must compare them. Can a small state (an index, an amount, a pair) describe everything the rest of the problem needs?',
      other: '<b>Not a DP.</b> There are no smaller versions to build from: look for a formula, a search or a simulation.',
      dc: '<b>Divide and conquer.</b> The pieces never repeat, so a memo would stay empty. Split, solve, combine, like merge sort.',
      greedy: '<b>Greedy.</b> If an exchange argument proves one choice is always safe, take it and move on: no table needed (lesson 32).',
      add: '<b>Grow the state.</b> The future depends on something the state forgot, such as whether the previous house was robbed. Add it, then ask again.',
      dp: '<b>Dynamic programming.</b> Repeated subproblems, choices to compare and a compact state: write the five decisions.'
    };
    var view = V.views.flowchart(fig.querySelector('[data-stage]'), spec, { interactive: true, label: 'Decision tree: is this a dynamic programming problem?' });
    var cap = fig.querySelector('[data-caption]'), path = ['q1'], taken = {};
    function show(active) {
      var st = {}; if (['other', 'dc', 'greedy', 'dp'].indexOf(active) !== -1) st[active] = active === 'dp' ? 'found' : 'done';
      view.render({ active: active, visited: path.slice(0, -1), edgeStates: taken, states: st }, { duration: 500 });
      cap.innerHTML = CAP[active];
    }
    view.on('choose', function (e) { path.push(e.to); taken[e.node + '->' + e.to] = 'path'; show(e.to); });
    fig.querySelector('[data-restart]').addEventListener('click', function () { path = ['q1']; taken = {}; show('q1'); });
    show('q1');
  }

  /* ================================================================== the subproblem DAG */
  function dagFigure() {
    var fig = $('#fig-dag');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Amount being settled' }, { state: 'compare', label: 'Arrows coming in' }, { state: 'key', shape: 'line', label: 'Best arrow (parent)' }, { state: 'path', label: 'Shortest path' }, { state: 'error', shape: 'dash', label: 'Greedy’s route' }]);
    var stage = fig.querySelector('[data-stage]');
    var view = D.table(stage, { shape: 'node', label: 'Subproblem DAG for paying 6 with coins 1, 3 and 4', labels: false, subPos: 'outer', dataIds: true, cellMax: 50, cellMin: 20,
      cellLabel: function (ci) { return 'Amount ' + ci; } });
    var steps = A.dagSteps([1, 3, 4], 6);
    view.prepare(steps.map(function (x) { return x.table; }));
    V.player({ root: fig, steps: steps, baseStepMs: 1100, label: 'DAG controls',
      render: function (st, ctx) { view.render(st.table, { duration: ctx.duration }); }, caption: fig.querySelector('[data-caption]') });
    V.clickQuiz(stage, {
      el: '#quiz-dag', id: 'dag-click-route',
      question: 'Pay 6 with coins {1, 3, 4} using as few coins as possible. <b>Click the amount</b> between 0 and 6 that the best route passes through.',
      check: function (id) {
        id = +id;
        if (id === 3) return { correct: true, message: '0 → 3 → 6: two coins of 3. It is the shortest path in the DAG.' };
        if (id === 4) return { correct: false, message: 'That is greedy’s first move: take the biggest coin. From 4 you still need 1 + 1, three coins in total.' };
        if (id === 5) return { correct: false, message: 'Every route through 5 ends with a 1-coin, and reaching 5 already takes two coins (4 + 1): three in total.' };
        if (id === 1 || id === 2) return { correct: false, message: 'From ' + id + ' you still need at least two more coins to reach 6: three or more in total.' };
        return { correct: false, message: 'Every route starts at 0 and ends at 6. Pick an amount in between.' };
      }
    });
  }

  /* ================================================================== space optimisation */
  function spaceFigure() {
    var fig = $('#fig-space');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'New value' }, { state: 'compare', label: 'Values it reads' }, { state: 'muted', label: 'Never read again' }, { state: 'key', label: 'The two we keep' }]);
    var view = V.views.array(fig.querySelector('[data-stage]'), { label: 'Fibonacci table shrinking to two cells', cellSize: 52, arc: false });
    var steps = A.spaceSteps(12, 7);
    view.prepare(steps.map(function (x) { return x.array; }));
    V.player({ root: fig, steps: steps, baseStepMs: 1100, label: 'Space controls', startAt: 5,
      render: function (st, ctx) { view.render(st.array, { duration: ctx.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: { stored: 'Numbers stored' }, counterStates: { stored: 'key' } });
    V.codeBlock($('[data-code-block="table"]'), 'const F = new Array(n + 1).fill(0);\nF[1] = 1;\nfor (let i = 2; i <= n; i++) F[i] = F[i - 1] + F[i - 2];\nreturn F[n];', 'js');
    V.codeBlock($('[data-code-block="pair"]'), 'let a = 0, b = 1;               // F[i-2], F[i-1]\nfor (let i = 0; i < n; i++) [a, b] = [b, a + b];\nreturn a;', 'js');
  }

  /* ================================================================== cost chart */
  function costFigure() {
    var fig = $('#fig-cost');
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'pivot', shape: 'line', label: 'Plain recursion: calls' }, { state: 'active', shape: 'line', label: 'Memoized: calls' }, { state: 'done', shape: 'line', label: 'Table: additions' }]);
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'Calls to compute fib(n) against n', labels: 'direct' });
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { n: 'n', naive: 'Plain calls', memo: 'Memo calls', table: 'Table additions' }, states: { naive: 'pivot', memo: 'active', table: 'done' } });
    var MAXN = 40, log = true, n = 25;
    function pts(fn, from) { var out = []; for (var k = from; k <= MAXN; k++) out.push([k, fn(k)]); return out; }
    var series = [
      { id: 'naive', label: 'plain', points: pts(A.naiveCalls, 1), state: 'pivot' },
      { id: 'memo', label: 'memo', points: pts(A.memoCalls, 1), state: 'active' },
      { id: 'table', label: 'table', points: pts(A.tableAdds, 2), state: 'done' }
    ];
    function render(dur) {
      chart.render({
        x: { label: 'n', min: 1, max: MAXN },
        y: log ? { label: 'operations (log scale)', scale: 'log', min: 1, max: 1e9 } : { label: 'operations', min: 0, max: 200 },
        series: series,
        highlight: [{ series: log || A.naiveCalls(n) <= 200 ? 'naive' : 'memo', x: n, label: log || A.naiveCalls(n) <= 200 ? fmtNum(A.naiveCalls(n)) : fmtNum(A.memoCalls(n)) }],
        annotations: [{ x: n, text: 'n = ' + n }]
      }, { duration: dur });
      stats.update({ n: n, naive: fmtNum(A.naiveCalls(n)), memo: fmtNum(A.memoCalls(n)), table: fmtNum(A.tableAdds(n)) });
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 2, max: MAXN, value: n, onInput: function (v) { n = v; render(120); } });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Log scale', checked: true, onChange: function (c) { log = c; render(800); } });
    render(0);
  }

  /* ================================================================== variations */
  function staticTable(host, state, o) {
    var v = D.table(host, Object.assign({ cellMax: 34, cellMin: 18, labels: false }, o || {}));
    v.prepare([state]); v.render(state, { duration: 0 });
    return v;
  }
  function miniFig(host, caption) {
    var st = h('div', { class: 'mini__stage' });
    host.appendChild(h('figure', { class: 'mini' }, st, h('figcaption', { html: caption })));
    return st;
  }
  function row(cells, idx) { return { id: 'r', label: '', cells: cells, index: idx === false ? null : cells.map(function (_, i) { return String(i); }) }; }
  function cellsOf(vals, states) { return vals.map(function (v, i) { return v === null ? null : { value: v, text: v === Infinity ? '∞' : v === true ? '✓' : v === false ? '✗' : undefined, state: (states && states[i]) || 'visited' }; }); }
  function variations() {
    V.tabs('#variants');
    var into7 = [{ id: 'x3', from: [0, 4], to: [0, 7], state: 'key', label: '−3' }, { id: 'x4', from: [0, 3], to: [0, 7], state: 'key', label: '−4' }];
    var c = $('[data-mini="combine"]');
    var st7 = ['visited', 'visited', 'visited', 'compare', 'compare', 'visited', 'visited', 'active'];
    var minV = [0, Infinity, Infinity, 1, 1, Infinity, 2, 2];
    staticTable(miniFig(c, '<b>min + 1</b>: fewest coins. dp[7] = min(1, 1) + 1 = 2.'), { rows: [row(cellsOf(minV, minV.map(function (v, i) { return v === Infinity ? 'muted' : st7[i]; })))], arcs: into7, cursor: [0, 7] });
    staticTable(miniFig(c, '<b>sum</b>: coin sequences. 1 + 1 = 2 (3 + 4 and 4 + 3).'), { rows: [row(cellsOf([1, 0, 0, 1, 1, 0, 1, 2], st7))], arcs: into7, cursor: [0, 7] });
    var can = [true, false, false, true, true, false, true, true];
    staticTable(miniFig(c, '<b>or</b>: can it be paid? ✓ or ✓ = ✓.'), { rows: [row(cellsOf(can, can.map(function (v, i) { return v ? st7[i] : 'muted'; })))], arcs: into7, cursor: [0, 7] });
    V.codeBlock($('[data-code-block="combine"]'), 'dp[a]  = Math.min(dp[a - 3], dp[a - 4]) + 1;  // fewest coins\nseq[a] = seq[a - 3] + seq[a - 4];             // coin sequences\ncan[a] = can[a - 3] || can[a - 4];            // possible at all?', 'js');

    var d = $('[data-mini="direction"]');
    staticTable(miniFig(d, '<b>Left to right</b>: dp[4] already includes the item, so dp[6] = 6 + 3 = 9 uses it three times.'),
      { rows: [row(cellsOf([0, 0, 3, 3, 6, 6, 9], ['swap', 'swap', 'swap', 'swap', 'key', 'swap', 'active']))], arcs: [{ id: 'd', from: [0, 4], to: [0, 6], state: 'key', label: '+3' }], cursor: [0, 6] });
    staticTable(miniFig(d, '<b>Right to left</b>: dp[4] is still the old 0, so dp[6] = 0 + 3 = 3 uses it once.'),
      { rows: [row(cellsOf([0, 0, 0, 0, 0, 0, 3], ['default', 'default', 'default', 'default', 'key', 'default', 'active']))], arcs: [{ id: 'd', from: [0, 4], to: [0, 6], state: 'key', label: '+3' }], cursor: [0, 6] });
    V.codeBlock($('[data-code-block="direction"]'), '// item of weight w and value v, one row dp[0..W]\nfor (let a = w; a <= W; a++)   // left to right: unlimited copies\n  dp[a] = Math.max(dp[a], dp[a - w] + v);\nfor (let a = W; a >= w; a--)   // right to left: each item once\n  dp[a] = Math.max(dp[a], dp[a - w] + v);', 'js');

    var r = $('[data-mini="rebuild"]');
    var coinSteps = A.lab.coinMin([1, 3, 4], 10), lastRecon = coinSteps[coinSteps.length - 1];
    staticTable(miniFig(r, '<b>Fewest coins for 10</b> with {1, 3, 4}: follow choice[] back from 10: 10 → 7 → 4 → 0.'), lastRecon.table, { cellMax: 32 });
    V.codeBlock($('[data-code-block="rebuild"]'), '// while filling: choice[a] = the coin that won the min\nconst coins = [];\nfor (let a = amount; a > 0; a -= choice[a]) coins.push(choice[a]);\n// coins = [3, 3, 4]', 'js');

    var an = $('[data-mini="answer"]');
    var rob = A.lab.robber([2, 7, 9, 3, 1]).filter(function (x) { return x.kind === 'answer'; })[0];
    var lis = A.lab.lis([3, 1, 4, 1, 5, 9, 2, 3]).filter(function (x) { return x.kind === 'answer'; })[0];
    staticTable(miniFig(an, '<b>House robber</b> [2, 7, 9, 3, 1]: the answer is the last cell, 12.'), rob.table, { labels: true, cellMax: 30 });
    staticTable(miniFig(an, '<b>LIS</b> of [3, 1, 4, 1, 5, 9, 2, 3]: the answer is the largest cell, 4 (ending at 9), not the last cell, 3.'), lis.table, { labels: true, cellMax: 30 });
    V.codeBlock($('[data-code-block="answer"]'), 'return best[n];          // house robber: best of the first n houses\nreturn Math.max(...len); // LIS: the best run can end anywhere', 'js');
  }

  /* ================================================================== checks */
  function checks() {
    V.quiz('#quiz-stairs', {
      id: 'stairs-six',
      question: 'How many ways are there to climb <b>6</b> stairs with hops of 1 or 2?',
      options: ['8', '13', '21', '12'],
      answer: 1,
      explain: ['8 is ways(5). Stair 6 can also be reached from stair 4 with a 2-hop, and those ways count too.',
        'ways(6) = ways(5) + ways(4) = 8 + 5 = 13. Set the slider in the figure to 6 to check the list.',
        '21 is ways(7): one stair too many.',
        'Counting by hand is easy to get wrong. Use the rule: ways(6) = ways(5) + ways(4) = 8 + 5.']
    });
    V.quiz('#quiz-memo10', {
      id: 'memo-fib10-distinct',
      question: 'Memoized <code>fib(10)</code> computes how many <em>different</em> subproblems?',
      options: ['10', '11', '19', '177'],
      answer: 1,
      explain: ['Do not forget fib(0): the arguments run from 0 to 10.',
        'fib(0) through fib(10): 11 different questions, each solved once.',
        '19 is the total number of calls: 9 that compute, 3 base-case calls and 7 memo hits that return at once.',
        '177 is how many calls plain recursion makes for fib(10).']
    });
    V.quiz('#quiz-deps', {
      id: 'coin-dp7-deps',
      question: 'Fewest coins with <code>{1, 3, 4}</code>. Which cells does <code>dp[7]</code> read?',
      options: ['dp[6]', 'dp[5]', 'dp[4]', 'dp[3]', 'dp[1]'],
      answer: [0, 2, 3],
      explain: 'dp[7] tries each coin as the last one: 7 − 1 = 6, 7 − 3 = 4 and 7 − 4 = 3. Reading dp[5] or dp[1] would need coins of 2 or 6.'
    });
    V.quiz('#quiz-bug', {
      id: 'coin-bug-zero',
      question: 'A friend’s fewest-coins code says amount 3 needs <b>0 coins</b> when the only coin is 2. What is the most likely bug?',
      options: ['Unreachable cells start at 0 instead of ∞', 'The loop goes from large amounts to small ones', 'The base case dp[0] = 0 is wrong', 'It should use max instead of min'],
      answer: 0,
      explain: ['Right. dp[3] never finds a coin that fits, so it keeps its starting value. That value must be ∞ ("impossible"), because 0 claims it is free.',
        'Order matters, but with only a 2-coin dp[3] reads dp[1], which also never changes. The real problem is what the cells start as.',
        'dp[0] = 0 is correct: zero coins make zero.',
        'max would make the numbers worse, and 0 would still leak through for unreachable cells.']
    });
  }

  /* ================================================================== summary */
  function summaryCard() {
    var grid = $('#summary-card .summary__grid');
    function tile(label, text) {
      var viz = h('div', { class: 'summary__viz stage-grid' });
      grid.appendChild(h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, label), h('p', { class: 'summary__text', html: text })));
      return viz;
    }
    tile('Spot the repeats', 'The same subproblem many times? That is the signal for DP.').appendChild(miniTreeSvg(fibMiniNodes(3), { spacing: 26, level: 30, r: 10, scale: 1.2 }));
    var o = { cellMax: 24, cellMin: 14, labels: false, arcLabels: false };
    staticTable(tile('Memoize: top-down', 'Recursion + memo: check the memo, compute, store.'),
      { rows: [row(cellsOf([0, 1, 1, 2, 3], ['visited', 'visited', 'found', 'visited', 'active']), false)], arcs: [], cursor: [0, 2] }, o);
    staticTable(tile('Tabulate: bottom-up', 'Loop over states so every input is ready first.'),
      { rows: [row(cellsOf([0, 1, 1, 2, null], ['visited', 'visited', 'compare', 'compare']).concat([]), false)], arcs: [{ id: 'a', from: [0, 3], to: [0, 4], state: 'key' }, { id: 'b', from: [0, 2], to: [0, 4], state: 'key' }], cursor: [0, 4] }, o);
    staticTable(tile('Five decisions', 'State, recurrence, base cases, order, answer.'),
      { rows: [row(cellsOf([0, 1, 2, 1, 1, 2, 2], ['done', 'visited', 'compare', 'key', 'visited', 'compare', 'found']), false)], arcs: [{ id: 'a', from: [0, 5], to: [0, 6], state: 'compare' }, { id: 'b', from: [0, 3], to: [0, 6], state: 'key' }, { id: 'c', from: [0, 2], to: [0, 6], state: 'compare' }], cursor: null }, o);
    staticTable(tile('Rebuild the answer', 'Store each winning choice, then walk back.'),
      { rows: [row(cellsOf([0, 1, 2, 1, 1, 2, 2], ['path', 'visited', 'visited', 'path', 'visited', 'visited', 'path']), false)], arcs: [{ id: 'a', from: [0, 0], to: [0, 3], state: 'path' }, { id: 'b', from: [0, 3], to: [0, 6], state: 'path' }], cursor: null }, o);
    staticTable(tile('Cost = states × work', 'Then keep only the cells you still read.'),
      { rows: [row(cellsOf([0, 1, 1, 2, 3, 5, 8], ['muted', 'muted', 'muted', 'muted', 'muted', 'key', 'key']), false)], arcs: [], cursor: null }, o);
  }

  /* ================================================================== boot */
  V.ready(function () {
    // register checkpoint ids up front so the page score total is stable while figures load lazily
    if (V.quizScore) ['trace-plain-repeat', 'trace-memo-hit', 'lab-coin-next'].forEach(V.quizScore.register);
    [heroTeaser, stairsFigure, explodeFigure, intuitionMinis, anatomyFigure, chooseFigure, dagFigure, variations, checks, summaryCard].forEach(function (fn) {
      try { fn(); } catch (e) { console.error('[lesson 34] ' + (fn.name || 'figure') + ' failed', e); }
    });
    lazy($('#fig-trace'), traceFigure);
    lazy($('#fig-collapse'), collapseFigure);
    lazy($('#fig-order'), orderFigure);
    lazy([$('#lab-fig'), $('#fig-flow')], lab);
    lazy($('#fig-space'), spaceFigure);
    lazy($('#fig-cost'), costFigure);
  });

  V.lessons = V.lessons || {};
  V.lessons['34-dynamic-programming'] = { algos: A };
}());
