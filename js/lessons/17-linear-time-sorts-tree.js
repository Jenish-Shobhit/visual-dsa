/* Lesson 17 — the barrier figures: the clickable decision tree, the halving game and the log2(n!) chart.
   Uses VDSA.algos.sorting (decision3, runDecision, minComparisons, log2Factorial) from js/algos/17-linear-time-sorts.js.
     L17.decisionTree(host, {mode: 'play' | 'static', onState})  -> {reset, newCards, answerForMe, ...}
     L17.initTree(), L17.initHalving(), L17.initBound(), L17.staticTree(host) */
(function () {
  'use strict';
  var V = window.VDSA, vz = V.vz, h = V.h;
  var L17 = V.lessons.l17;
  function S() { return V.algos.sorting; }

  /* ================================================================== layout of the 3-item tree */
  var LEAF_ORDER = ['abc', 'acb', 'cab', 'bac', 'bca', 'cba'];
  var W = 760, H = 352, LEAF_W = 112, LEAF_H = 44, NODE_W = 90, NODE_H = 34;
  var LEVEL_Y = [44, 122, 200], LEAF_Y = 286;
  function positions() {
    var P = {};
    LEAF_ORDER.forEach(function (id, i) { P[id] = { x: 72 + i * 123, y: LEAF_Y, leaf: true }; });
    P.q4 = { x: (P.acb.x + P.cab.x) / 2, y: LEVEL_Y[2] };
    P.q2 = { x: (P.abc.x + P.q4.x) / 2, y: LEVEL_Y[1] };
    P.q5 = { x: (P.bca.x + P.cba.x) / 2, y: LEVEL_Y[2] };
    P.q3 = { x: (P.bac.x + P.q5.x) / 2, y: LEVEL_Y[1] };
    P.q1 = { x: (P.q2.x + P.q3.x) / 2, y: LEVEL_Y[0] };
    return P;
  }
  function leafText(id) { return id.split('').join(' < '); }
  function cmpText(nd) { return nd.cmp[0] + ' < ' + nd.cmp[1] + ' ?'; }

  /* ================================================================== the decision tree */
  L17.decisionTree = function (host, o) {
    o = Object.assign({ mode: 'play' }, o || {});
    var T = S().decision3, P = positions();
    var byId = {}; T.nodes.forEach(function (nd) { byId[nd.id] = nd; });
    var play = o.mode === 'play';
    var svg = vz.svg('svg', { class: 'vz l17-dtree', viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: play ? 'group' : 'img',
      'aria-label': o.label || 'Decision tree for sorting three items with six leaves', focusable: 'false' });
    svg.style.height = 'auto'; svg.style.maxHeight = 'none';
    host.appendChild(svg);
    var gGuides = vz.svg('g', {}, svg), gEdges = vz.svg('g', {}, svg), gNodes = vz.svg('g', {}, svg), gChips = vz.svg('g', {}, svg), gTok = vz.svg('g', {}, svg);

    /* level guides: "question 1, 2, 3" and a bracket for the height */
    LEVEL_Y.forEach(function (y, i) {
      vz.svg('line', { class: 'l17-guide', x1: 8, x2: W - 8, y1: y, y2: y }, gGuides);
      vz.svg('text', { class: 'l17-guide-text', x: 8, y: y - 14 }, gGuides).textContent = 'question ' + (i + 1);
    });
    vz.svg('text', { class: 'l17-guide-text', x: 8, y: H - 6 }, gGuides).textContent = 'orderings (leaves)';

    /* edges + chips */
    var edges = {}, chips = {};
    T.nodes.forEach(function (nd) {
      if (nd.leaf) return;
      [['yes', nd.yes], ['no', nd.no]].forEach(function (pair) {
        var ans = pair[0], to = pair[1], a = P[nd.id], b = P[to];
        var y1 = a.y + NODE_H / 2, y2 = b.y - (b.leaf ? LEAF_H / 2 : NODE_H / 2);
        var e = vz.svg('line', { class: 'l17-edge', x1: a.x, y1: y1, x2: b.x, y2: y2 }, gEdges);
        edges[nd.id + '>' + to] = e;
        var t = 0.42, cx = a.x + (b.x - a.x) * t, cy = y1 + (y2 - y1) * t;
        var g = vz.svg('g', { class: 'l17-chip', transform: 'translate(' + cx + ' ' + cy + ')' }, gChips);
        vz.svg('rect', { x: -19, y: -11, width: 38, height: 22, rx: 11 }, g);
        vz.svg('text', { 'text-anchor': 'middle', dy: '.35em' }, g).textContent = ans;
        g.setAttribute('data-ans', ans);
        chips[nd.id + ':' + ans] = g;
        if (play) vz.clickable(g, 'Answer ' + ans + ' to ' + cmpText(nd), function () { answer(nd.id, ans); });
        else g.classList.add('is-static');
      });
    });
    /* nodes */
    var nodes = {};
    T.nodes.forEach(function (nd) {
      var p = P[nd.id];
      var g = vz.svg('g', { class: 'l17-node' + (nd.leaf ? ' l17-leaf' : ''), transform: 'translate(' + p.x + ' ' + p.y + ')' }, gNodes);
      var w = nd.leaf ? LEAF_W : NODE_W, hh = nd.leaf ? LEAF_H : NODE_H;
      vz.svg('rect', { class: 'l17-nrect', x: -w / 2, y: -hh / 2, width: w, height: hh, rx: nd.leaf ? 9 : hh / 2 }, g);
      vz.svg('text', { class: 'l17-ntext vz-mono', 'text-anchor': 'middle', dy: nd.leaf ? '-.1em' : '.35em' }, g).textContent = nd.leaf ? leafText(nd.id) : cmpText(nd);
      if (nd.leaf) {
        var sub = vz.svg('text', { class: 'l17-nsub', 'text-anchor': 'middle', y: 37 }, g);
        sub.textContent = '';
        g.__sub = sub;
        g.setAttribute('data-id', nd.id);
        g.setAttribute('data-label', 'Leaf: ' + nd.leaf.join(' then '));
      }
      nodes[nd.id] = g;
    });
    /* token */
    var tok = vz.svg('g', { class: 'l17-token' }, gTok);
    vz.svg('circle', { r: 7 }, tok);
    V.place(tok, { x: P.q1.x, y: P.q1.y - NODE_H / 2 - 16 });
    tok.style.display = play ? '' : 'none';

    /* on a phone the stage scrolls sideways: keep the token's node in view */
    function follow(x, smooth) {
      var k = svg.getBoundingClientRect().width / W, px = x * k;
      if (host.scrollWidth <= host.clientWidth + 2) return;
      var lo = host.scrollLeft + 70, hi = host.scrollLeft + host.clientWidth - 70;
      if (px < lo || px > hi) host.scrollTo({ left: Math.max(0, px - host.clientWidth / 2), behavior: smooth && !V.reducedMotion() ? 'smooth' : 'instant' });
    }
    function centre() { requestAnimationFrame(function () { if (host.scrollWidth > host.clientWidth + 2) host.scrollLeft = (host.scrollWidth - host.clientWidth) / 2; }); }
    /* ---------------------------------------------------------------- state (play mode) */
    var st = { vals: null, cur: T.root, path: [], found: {}, done: false };
    var listeners = [];
    function emit(kind) { listeners.forEach(function (fn) { fn(kind, st); }); }
    function consistent(order) {   // order: 'abc' means a < b < c
      return st.path.every(function (p) {
        var nd = byId[p.node];
        return (order.indexOf(nd.cmp[0]) < order.indexOf(nd.cmp[1])) === (p.answer === 'yes');
      });
    }
    function possible() { return LEAF_ORDER.filter(consistent); }
    function render(duration) {
      var poss = possible(), possSet = {};
      poss.forEach(function (id) { possSet[id] = true; });
      var onPath = {}, taken = {};
      var at = T.root;
      st.path.forEach(function (p) {
        onPath[p.node] = true;
        var to = p.answer === 'yes' ? byId[p.node].yes : byId[p.node].no;
        taken[p.node + '>' + to] = true; onPath[to] = true; at = to;
      });
      T.nodes.forEach(function (nd) {
        var g = nodes[nd.id];
        var cls = 'l17-node' + (nd.leaf ? ' l17-leaf' : '');
        if (play && !nd.leaf && st.cur === nd.id && !st.done) cls += ' is-active';
        else if (nd.leaf && st.done && st.cur === nd.id) cls += ' is-found';
        else if (onPath[nd.id]) cls += ' is-visited';
        if (nd.leaf && play && !possSet[nd.id]) cls += ' is-out';
        if (nd.leaf && st.found[nd.id] && !(st.done && st.cur === nd.id)) cls += ' is-seen';
        g.setAttribute('class', cls);
        if (nd.leaf && g.__sub) {
          var reached = st.done && st.cur === nd.id;
          g.__sub.textContent = reached ? nd.leaf.map(function (x) { return st.vals[x]; }).join(' < ') : '';
        }
      });
      Object.keys(edges).forEach(function (k) { edges[k].setAttribute('class', 'l17-edge' + (taken[k] ? ' is-path' : '')); });
      T.nodes.forEach(function (nd) {
        if (nd.leaf) return;
        ['yes', 'no'].forEach(function (ans) {
          var c = chips[nd.id + ':' + ans];
          var live = play && !st.done && st.cur === nd.id;
          var chosen = st.path.some(function (p) { return p.node === nd.id && p.answer === ans; });
          c.setAttribute('class', 'l17-chip' + (live ? ' is-live' : '') + (chosen ? ' is-chosen' : '') + (!play ? ' is-static' : ''));
          c.setAttribute('aria-disabled', live ? 'false' : 'true');
          if (play) c.setAttribute('tabindex', live ? '0' : '-1');
        });
      });
      var tgt = st.done ? { x: P[st.cur].x, y: P[st.cur].y - LEAF_H / 2 - 12 } : { x: P[st.cur].x, y: P[st.cur].y - NODE_H / 2 - 16 };
      if (duration > 0) V.animate(tok, tgt, { duration: duration }); else V.place(tok, tgt);
      follow(P[st.cur].x, duration > 0);
      return poss;
    }

    var wrongTimer = 0;
    function nodeQ(id) { var nd = byId[id]; return nd.cmp[0] + ' = ' + st.vals[nd.cmp[0]] + ' and ' + nd.cmp[1] + ' = ' + st.vals[nd.cmp[1]]; }
    function answer(nodeId, ans) {
      if (st.done || st.cur !== nodeId) return;
      var nd = byId[nodeId], x = nd.cmp[0], y = nd.cmp[1];
      var truth = st.vals[x] < st.vals[y] ? 'yes' : 'no';
      if (ans !== truth) {
        var c = chips[nodeId + ':' + ans];
        c.classList.add('is-wrong');
        clearTimeout(wrongTimer); wrongTimer = setTimeout(function () { c.classList.remove('is-wrong'); }, 900);
        emit('wrong');
        o.onMessage && o.onMessage('<b>Not quite.</b> ' + x + ' = ' + st.vals[x] + ' and ' + y + ' = ' + st.vals[y] + ', so “' + x + ' &lt; ' + y + '” is <b>' + truth + '</b>: ' + st.vals[x] + (truth === 'yes' ? ' is smaller than ' : ' is not smaller than ') + st.vals[y] + '.', 'error');
        return;
      }
      var before = possible().length;
      st.path.push({ node: nodeId, answer: ans });
      var next = ans === 'yes' ? nd.yes : nd.no;
      st.cur = next;
      var leafNow = !!byId[next].leaf;
      if (leafNow) { st.done = true; st.found[next] = true; }
      var poss = render(V.dur(480));
      var left = poss.length;
      var msg;
      if (leafNow) {
        var order = byId[next].leaf;
        var nFound = Object.keys(st.found).length;
        msg = '<b>Leaf ' + order.join(', ') + '.</b> Sorted: ' + order.map(function (q) { return q + ' = ' + st.vals[q]; }).join(' &lt; ') + ', found with <b>' + st.path.length + '</b> comparisons. ' +
          (nFound === 6 ? 'You have reached all six leaves: the tree has exactly one leaf for each of the 6 = 3! orderings.' : nFound + ' of 6 leaves reached; press <em>New cards</em> to aim for a leaf you have not seen.');
        o.onMessage && o.onMessage(msg, 'done');
      } else {
        msg = '<b>' + x + ' &lt; ' + y + ' is ' + ans + '.</b> Orderings that disagree drop out: <b>' + left + '</b> of the ' + before + ' that were still possible remain. Next: ' + cmpText(byId[next]).replace('<', '&lt;') + ' (' + nodeQ(next) + ').';
        o.onMessage && o.onMessage(msg, '');
      }
      emit('answer');
    }
    function newCards() {
      var unseen = LEAF_ORDER.filter(function (id) { return !st.found[id]; });
      var pool = unseen.length ? unseen : LEAF_ORDER;
      var prevKey = st.vals ? S().runDecision(T, st.vals).leaf : null;
      var choices = pool.filter(function (id) { return id !== prevKey; });
      if (!choices.length) choices = pool;
      var target = choices[Math.floor(Math.random() * choices.length)];
      var nums = [];
      while (nums.length < 3) { var r = 1 + Math.floor(Math.random() * 9); if (nums.indexOf(r) < 0) nums.push(r); }
      nums.sort(function (a, b) { return a - b; });
      var vals = {}; target.split('').forEach(function (nm, i) { vals[nm] = nums[i]; });
      setCards(vals);
    }
    function setCards(vals) {
      st.vals = vals; st.cur = T.root; st.path = []; st.done = false;
      render(0);
      o.onMessage && o.onMessage('Compare your cards. The root asks <b>a &lt; b ?</b> (' + nodeQ(T.root) + '). Click the answer that is true.', '');
      emit('cards');
    }
    function answerForMe() {
      if (st.done) { newCards(); return; }
      var nd = byId[st.cur];
      answer(st.cur, st.vals[nd.cmp[0]] < st.vals[nd.cmp[1]] ? 'yes' : 'no');
    }
    if (play) {
      var first = { a: 7, b: 3, c: 5 };
      st.vals = first;
      setCards(first);
    } else render(0);
    centre();
    return {
      svg: svg, state: st, newCards: newCards, answerForMe: answerForMe, possible: possible,
      onChange: function (fn) { listeners.push(fn); },
      setCards: setCards,
      /* used by the click quiz: the leaf that a = 4, b = 9, c = 1 reaches */
      leafFor: function (vals) { return S().runDecision(T, vals).leaf; }
    };
  };

  L17.initTree = function () {
    var fig = V.$('#fig-tree');
    var cards = fig.querySelector('[data-cards]');
    var caption = fig.querySelector('[data-caption]');
    var stats = V.stats(fig.querySelector('[data-stats]'), {
      labels: { asked: 'Questions asked', left: 'Orderings still possible', found: 'Leaves reached', height: 'Height of this tree' },
      states: { asked: 'compare', left: 'active', found: 'done', height: 'pivot' }
    });
    function msg(html, state) { caption.innerHTML = html; if (state) caption.setAttribute('data-state', state); else caption.removeAttribute('data-state'); }
    var tree = L17.decisionTree(fig.querySelector('[data-stage]'), { mode: 'play', onMessage: msg });
    function drawCards() {
      var st = tree.state, cur = st.done ? null : S().decision3.nodes.filter(function (n) { return n.id === st.cur; })[0];
      V.clear(cards);
      ['a', 'b', 'c'].forEach(function (nm) {
        var hot = cur && cur.cmp && cur.cmp.indexOf(nm) >= 0;
        cards.appendChild(h('span', { class: 'l17-card' + (hot ? ' is-hot' : '') }, h('b', {}, nm), h('span', {}, '\u00a0=\u00a0' + st.vals[nm])));
      });
    }
    function drawStats() {
      var st = tree.state;
      stats.update({ asked: st.path.length, left: tree.possible().length + ' of 6', found: Object.keys(st.found).length + ' of 6', height: '3 (log₂ 6 = 2.58)' });
    }
    tree.onChange(function () { drawCards(); drawStats(); });
    drawCards(); drawStats();
    fig.querySelector('[data-new]').addEventListener('click', function () { tree.newCards(); });
    fig.querySelector('[data-answer]').addEventListener('click', function () { tree.answerForMe(); });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Question to answer' }, { state: 'visited', label: 'Answered' }, { state: 'path', shape: 'line', label: 'Your path' }, { state: 'done', label: 'Leaf reached' }, { state: 'muted', label: 'Ruled out' }]);
    return tree;
  };

  /* ================================================================== halving game */
  L17.initHalving = function () {
    var fig = V.$('#fig-halving');
    var stage = fig.querySelector('[data-stage]');
    var caption = fig.querySelector('[data-caption]');
    var stats = V.stats(fig.querySelector('[data-stats]'), {
      labels: { asked: 'Questions asked', left: 'Orderings left', need: 'Fewest possible' },
      states: { asked: 'compare', left: 'active', need: 'done' }
    });
    var n = 4, cells = [], remaining = 0, asked = 0, timer = 0;
    var svg = vz.svg('svg', { class: 'vz l17-halve', role: 'img', focusable: 'false' });
    svg.style.height = 'auto'; svg.style.maxHeight = 'none';
    stage.appendChild(svg);
    function total() { return S().factorial(n); }
    function layout() {
      var N = total(), Wd = Math.max(300, stage.clientWidth - 24 || 640);
      var maxH = 190;
      var cols = Math.max(1, Math.min(N, Math.ceil(Math.sqrt(N * Wd / maxH))));
      var cell = Math.min(26, Math.floor(Wd / cols));
      var rows = Math.ceil(N / cols);
      var gap = cell >= 12 ? 3 : 1.5;
      var gw = cols * cell, x0 = (Wd - gw) / 2 + 12;
      svg.setAttribute('viewBox', '0 0 ' + (Wd + 24) + ' ' + (rows * cell + 12));
      svg.style.height = (rows * cell + 12) + 'px';
      cells.forEach(function (c, i) {
        var col = i % cols, row = Math.floor(i / cols);
        c.setAttribute('x', x0 + col * cell + gap / 2); c.setAttribute('y', 6 + row * cell + gap / 2);
        c.setAttribute('width', cell - gap); c.setAttribute('height', cell - gap); c.setAttribute('rx', Math.min(5, (cell - gap) / 3));
      });
    }
    function build() {
      V.clear(svg); cells = [];
      var N = total();
      for (var i = 0; i < N; i++) cells.push(vz.svg('rect', { class: 'l17-hcell' }, svg));
      svg.setAttribute('aria-label', N + ' squares, one for every ordering of ' + n + ' items');
      remaining = N; asked = 0;
      layout(); draw();
      caption.innerHTML = 'There are <b>' + N + '</b> ways to order ' + n + ' items, one square each. You know nothing yet. Every comparison is a yes/no question: press <em>Ask a question</em> and the answer keeps the larger half of the squares.';
    }
    function draw() {
      cells.forEach(function (c, i) { c.setAttribute('class', 'l17-hcell' + (i < remaining ? ' is-live' : ' is-gone')); });
      stats.update({ asked: asked, left: remaining, need: S().minComparisons(n) });
    }
    function ask() {
      if (remaining <= 1) return false;
      var before = remaining;
      remaining = Math.ceil(remaining / 2); asked++;
      draw();
      if (remaining === 1) {
        var need = S().minComparisons(n);
        caption.innerHTML = '<b>One ordering left after ' + asked + ' question' + (asked === 1 ? '' : 's') + '.</b> That is ⌈log₂ ' + total() + '⌉ = ' + need + ': halving is the best any question can do, so no comparison sort finishes in fewer than ' + need + ' comparisons on every input.';
        caption.setAttribute('data-state', 'done');
      } else {
        caption.innerHTML = 'Question ' + asked + ': the answer keeps the bigger half, so <b>' + before + '</b> orderings become <b>' + remaining + '</b>. Even a perfectly chosen question cannot remove more than half.';
        caption.removeAttribute('data-state');
      }
      return remaining > 1;
    }
    function stop() { clearInterval(timer); timer = 0; }
    var seg = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Number of items to sort (orderings: 2, 6, 24, 120, 720)', value: String(n),
      options: [2, 3, 4, 5, 6].map(function (k) { return { value: String(k), label: 'n = ' + k }; }),
      onChange: function (v) { stop(); n = +v; build(); }
    });
    fig.querySelector('[data-ask]').addEventListener('click', function () { stop(); ask(); });
    fig.querySelector('[data-reset]').addEventListener('click', function () { stop(); build(); });
    fig.querySelector('[data-auto]').addEventListener('click', function () {
      stop();
      if (remaining <= 1) build();
      var dur = V.reducedMotion && V.reducedMotion() ? 0 : 520;
      if (!ask()) return;
      timer = setInterval(function () { if (!ask()) stop(); }, dur || 200);
    });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', label: 'Ordering still possible' }, { state: 'muted', label: 'Ruled out' }]);
    V.onResize(stage, function () { layout(); });
    void seg;
    build();
  };

  /* ================================================================== log2(n!) chart */
  L17.initBound = function () {
    var fig = V.$('#fig-bound');
    var chart = V.views.chart(fig.querySelector('[data-stage]'), { type: 'line', label: 'log base 2 of n factorial against n log n and n squared', height: 320 });
    var readout = fig.querySelector('[data-readout]');
    var mode = 'all', n = 10;
    var MAXN = 64;
    var factPts = [];
    for (var i = 1; i <= MAXN; i++) factPts.push([i, S().log2Factorial(i)]);
    function fmtBig(v) { return v >= 1e15 ? v.toExponential(2).replace('e+', ' × 10^') : Math.round(v).toLocaleString('en-US'); }
    function draw(dur) {
      var ser = [
        { id: 'nlogn', label: 'n log₂ n', fn: function (x) { return x * Math.log2(x); }, domain: [1, MAXN], state: 'compare' },
        { id: 'fact', label: 'log₂(n!)', points: factPts, state: 'active', markers: false }
      ];
      if (mode === 'all') ser.push({ id: 'n2', label: 'n²', fn: function (x) { return x * x; }, domain: [1, MAXN], state: 'error' });
      else ser.push({ id: 'half', label: '(n/2)·log₂(n/2)', fn: function (x) { return x < 2 ? 0 : (x / 2) * Math.log2(x / 2); }, domain: [1, MAXN], state: 'done', dashed: true });
      var lf = S().log2Factorial(n);
      chart.render({
        x: { label: 'number of items n', min: 1, max: MAXN },
        y: mode === 'all' ? { label: 'comparisons', min: 0, max: 4200 } : { label: 'comparisons', min: 0, max: 420 },
        series: ser,
        highlight: { series: 'fact', x: n, y: lf, label: 'n = ' + n + ': ' + lf.toFixed(1) }
      }, { duration: dur === undefined ? 700 : dur });
      var f = S().factorial(n), mc = S().minComparisons(n);
      readout.innerHTML = 'With <b>n = ' + n + '</b> items there are <b>' + (n <= 18 ? f.toLocaleString('en-US') : fmtBig(f)) + '</b> orderings, so a comparison sort needs at least <b>' + mc + '</b> comparisons on some input. For comparison: n log₂ n = ' + (n * Math.log2(n)).toFixed(1) + (mode === 'all' ? ' and n² = ' + n * n + '.' : ', and the easy bound (n/2)·log₂(n/2) = ' + (n < 2 ? 0 : (n / 2) * Math.log2(n / 2)).toFixed(1) + '.');
    }
    var seg = V.segmented(fig.querySelector('[data-seg]'), {
      label: 'View', value: mode,
      options: [{ value: 'all', label: 'Against n²' }, { value: 'zoom', label: 'Zoom in on n log n' }],
      onChange: function (v) { mode = v; draw(); }
    });
    V.slider(fig.querySelector('[data-slider]'), { label: 'n', min: 2, max: MAXN, step: 1, value: n, onInput: function (v) { n = v; draw(220); } });
    V.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'log₂(n!) = least comparisons' }, { state: 'compare', shape: 'line', label: 'n log₂ n' }, { state: 'error', shape: 'line', label: 'n²' }, { state: 'done', shape: 'dash', label: '(n/2) log₂(n/2)' }]);
    void seg;
    draw(0);
  };

  /* the same tree, static, with leaves as click targets (check yourself) */
  L17.staticTree = function (host) { return L17.decisionTree(host, { mode: 'static', label: 'Decision tree for sorting a, b and c' }); };
}());
