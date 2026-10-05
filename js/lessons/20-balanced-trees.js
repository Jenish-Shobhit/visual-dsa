/* Lesson 20 · Balanced trees: AVL & red-black — shared helpers, hero teaser, the problem, rotations, balance factors.
   Step generators: js/algos/20-balanced-trees.js (VDSA.algos.lesson20, tested in Node).
   More figures: -figs.js (four cases, thinnest trees, red-black rules, race, chart), -labs.js (AVL lab, red-black lab,
   flowchart), -more.js (B-tree, variations, quizzes, summary).

   Heavy figures start when they come within ~600px of the viewport (nearView). Append ?all to the URL to start every
   figure at once (used for full-page screenshots). */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h;
  var A = V.algos.lesson20;
  var L = V.lesson20 = V.lesson20 || {};
  var EAGER = /[?&]all\b/.test(location.search);
  var num = A.num;

  /* ================================================================== shared helpers */
  function nearView(el, fn) {
    if (!el) return;
    function run() { try { fn(); } catch (e) { console.error('[lesson 20] figure failed', el.id, e); } }
    if (EAGER || !('IntersectionObserver' in window)) { run(); return; }
    var done = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && !done) { done = true; io.disconnect(); run(); } });
    }, { rootMargin: '600px 0px 600px 0px' });
    io.observe(el);
  }
  function legend(fig, entries) { var el = fig.querySelector('[data-legend]'); if (el) V.legend(el, entries); }
  /* make tree nodes targets for VDSA.clickQuiz: data-id = the key text */
  function tagNodes(view) {
    V.$$('.vz-node', view.el).forEach(function (g) {
      var t = g.querySelector('.vz-value');
      var v = t ? t.textContent.replace('−', '-') : '';
      g.setAttribute('data-id', v);
      g.setAttribute('data-label', 'Node ' + v);
    });
  }
  function inf(v) { return v === -Infinity ? '−∞' : v === Infinity ? '∞' : num(v); }
  /* one tree view + one player, the common shape of a small figure */
  function treeFigure(fig, steps, o) {
    o = o || {};
    var view = V.views.tree(fig.querySelector('[data-stage]'), Object.assign({ nodeSize: 40, label: 'Tree figure' }, o.view || {}));
    view.prepare(steps);
    var player = V.player({
      root: fig, steps: steps,
      render: function (s, c) { view.render(s, { duration: c.duration }); if (o.onRender) o.onRender(s, c); },
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: L.LABELS, counterStates: o.counterStates,
      flow: o.flow, baseStepMs: o.baseStepMs || 1250, label: o.label || 'Figure controls',
      code: o.code, vars: o.vars
    });
    return { view: view, player: player, load: function (next) { view.reset(); view.prepare(next); player.setSteps(next); } };
  }
  L.nearView = nearView; L.legend = legend; L.tagNodes = tagNodes; L.treeFigure = treeFigure; L.inf = inf; L.EAGER = EAGER;
  L.LABELS = {
    comparisons: 'Comparisons', rotations: 'Rotations', recolours: 'Recolourings', height: 'Height', nodes: 'Nodes',
    blackNodes: 'Black nodes on path', pathLength: 'Nodes on path', minNodes: 'Fewest nodes', splits: 'Splits', keys: 'Keys',
    plain: 'Comparisons', balanced: 'Comparisons', rotationsAvl: 'AVL rotations', rotationsRb: 'Red-black rotations', n: 'Keys inserted'
  };
  var LABELS = L.LABELS;
  var STATE_LEGEND = {
    key: { state: 'key', label: 'new key' }, compare: { state: 'compare', label: 'being checked' }, visited: { state: 'visited', label: 'checked' },
    error: { state: 'error', label: 'out of balance' }, pivot: { state: 'pivot', label: 'child on the heavy side' }, active: { state: 'active', label: 'rotating' }
  };
  L.STATE_LEGEND = STATE_LEGEND;

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    function innerHeight() {
      var cs = getComputedStyle(stage);
      return Math.max(170, stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    }
    var view = V.views.tree(stage, { nodeSize: 48, gap: 2.4, height: innerHeight(), describe: false, label: 'A tree balancing itself' });
    view.el.setAttribute('aria-hidden', 'true');
    var laps = [
      [10, 20, 30, 40, 50, 60, 70],
      [70, 60, 50, 40, 30, 20, 10],
      [30, 10, 20, 50, 40, 60, 70],
      [50, 70, 60, 30, 40, 20, 10]
    ];
    var lapNo = 0;
    function lap() {
      var keys = laps[lapNo % laps.length]; lapNo += 1;
      var steps = A.avlBuildSteps(keys, { brief: true, caption: '' }).steps;
      view.reset(); view.prepare(steps);
      return steps;
    }
    V.teaser(stage, {
      steps: lap(), stepMs: 700, holdMs: 2000, instantWrap: true, regenerate: lap,
      render: function (s, c) { view.render(s, { duration: c.duration }); }
    });
    V.onResize(stage, function () { view.setOptions({ height: innerHeight() }); });
  }

  /* ================================================================== problem: search the stick and the balanced tree */
  function stickFigure() {
    var fig = V.$('#fig-stick');
    legend(fig, [{ state: 'compare', label: 'compared now' }, { state: 'visited', label: 'already passed' }, { state: 'found', label: 'found' }]);
    var res = A.stickRace(15);
    var stageA = fig.querySelector('[data-stage="a"]'), stageB = fig.querySelector('[data-stage="b"]');
    var vA = V.views.tree(stageA, { nodeSize: 24, minNodeSize: 16, levelHeight: 27, label: 'Plain binary search tree holding 1 to 15 as a single right-leaning branch' });
    var vB = V.views.tree(stageB, { nodeSize: 34, label: 'AVL tree holding 1 to 15, height 3' });
    vA.prepare(res.steps.map(function (s) { return s.a; }));
    vB.prepare(res.steps.map(function (s) { return s.b; }));
    var sA = V.stats(fig.querySelector('[data-stats="a"]'), { labels: LABELS, states: { comparisons: 'compare' } });
    var sB = V.stats(fig.querySelector('[data-stats="b"]'), { labels: LABELS, states: { comparisons: 'compare' } });
    V.player({
      root: fig, steps: res.steps, baseStepMs: 520, animMs: 320, label: 'Search race controls',
      caption: fig.querySelector('[data-caption]'),
      render: function (s, c) {
        vA.render(s.a, { duration: c.duration }); vB.render(s.b, { duration: c.duration });
        sA.update({ comparisons: s.counters.plain, height: s.heights.a });
        sB.update({ comparisons: s.counters.balanced, height: s.heights.b });
      }
    });
  }

  /* ================================================================== rotation explorer */
  function rotateFigure() {
    var fig = V.$('#fig-rotate');
    legend(fig, [{ state: 'active', label: 'the rotating pair x, y' }, { state: 'pivot', label: 'B: changes parent' }, { state: 'frontier', label: 'A and C: keep their parent' }]);
    var stage = fig.querySelector('[data-stage]'), strip = fig.querySelector('[data-strip]'), caption = fig.querySelector('[data-caption]');
    var NUM = { A: '10', x: '20', B: '30', y: '40', C: '50' };
    var orient = 'left', numbers = false, count = 0, busy = false;
    var view = V.views.tree(stage, {
      order: 'inorder', nodeSize: 48, gap: 1.05, label: 'Rotation of two nodes x and y with subtrees A, B and C. Click x or y to rotate.',
      onNodeClick: function (e) { if (e.id === 'x' && orient === 'left') go(); else if (e.id === 'y' && orient === 'right') go(); else if (e.id === 'x' || e.id === 'y') say('Only the higher of x and y can rotate down here: ' + (orient === 'left' ? 'x is on top, so rotate <b>left</b> at x.' : 'y is on top, so rotate <b>right</b> at y.')); }
    });
    function stateOf(o) {
      var s = A.xyState(o, { states: { x: 'active', y: 'active', A: 'frontier', C: 'frontier', B: 'pivot' } });
      s.nodes.forEach(function (n) {
        if (numbers) { n.label = NUM[n.id]; delete n.sub; }
        if (n.id === 'x' || n.id === 'y') n.sub = numbers ? n.id : undefined;
      });
      return { root: s.root, nodes: s.nodes, edges: o === orient ? {} : {} };
    }
    view.prepare([stateOf('left'), stateOf('right')]);
    function text(id) { return numbers ? NUM[id] : id; }
    /* the strip: chips placed under the nodes' columns */
    var chips = {};
    ['A', 'x', 'B', 'y', 'C'].forEach(function (id) {
      var c = h('span', { class: 'bt-chip bt-chip--' + (id === 'x' || id === 'y' ? 'pair' : id === 'B' ? 'mid' : 'sub') }, id);
      chips[id] = c; strip.appendChild(c);
    });
    strip.insertBefore(h('span', { class: 'bt-strip__label' }, 'in-order'), strip.firstChild);
    function layoutStrip() {
      var sr = strip.getBoundingClientRect(), vr = view.el.getBoundingClientRect();
      Object.keys(chips).forEach(function (id) {
        var p = view.positionOf(id);
        chips[id].textContent = text(id);
        if (p) { chips[id].style.left = (vr.left - sr.left + p.x) + 'px'; chips[id].style.opacity = 1; }
      });
    }
    function say(html) { caption.innerHTML = html; }
    var buttons = fig.querySelector('[data-buttons]');
    var bL = h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: function () { if (orient === 'left') go(); } }, 'Rotate left at x');
    var bR = h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: function () { if (orient === 'right') go(); } }, 'Rotate right at y');
    buttons.appendChild(bL); buttons.appendChild(bR);
    function sync() { bL.disabled = orient !== 'left'; bR.disabled = orient !== 'right'; }
    function words() {
      var X = numbers ? '20' : 'x', Y = numbers ? '40' : 'y', B = numbers ? '30' : 'B';
      return { X: X, Y: Y, B: B };
    }
    function describe(first) {
      var w = words();
      if (first) return orient === 'left'
        ? '<b>' + w.X + '</b> is on top, with <b>' + w.Y + '</b> as its right child. Rotate left at ' + w.X + ': ' + w.Y + ' rises and ' + w.X + ' sinks.'
        : '<b>' + w.Y + '</b> is on top, with <b>' + w.X + '</b> as its left child. Rotate right at ' + w.Y + ': ' + w.X + ' rises and ' + w.Y + ' sinks.';
      return orient === 'right'
        ? 'Rotated left at <b>' + w.X + '</b>. <b>' + w.Y + '</b> rose to the top and <b>' + w.X + '</b> sank to its left. Subtree <b>' + w.B + '</b>, which sat between them, had to change parent: it was <b>' + w.Y + '</b>’s left child and is now <b>' + w.X + '</b>’s right child. The strip below has not changed.'
        : 'Rotated right at <b>' + w.Y + '</b>. <b>' + w.X + '</b> rose to the top and <b>' + w.Y + '</b> sank to its right. Subtree <b>' + w.B + '</b> moved from <b>' + w.X + '</b>’s right to <b>' + w.Y + '</b>’s left. Same strip again: a rotation and its mirror undo each other.';
    }
    function go() {
      orient = orient === 'left' ? 'right' : 'left';
      count += 1;
      view.render(stateOf(orient), { duration: 700 });
      sync(); say(describe(false) + ' <span class="muted">Rotations: ' + count + '.</span>');
      setTimeout(layoutStrip, 0);
    }
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Show keys instead of letters', checked: false, onChange: function (on) { numbers = on; view.render(stateOf(orient), { duration: 0 }); layoutStrip(); say(describe(true)); } });
    view.render(stateOf(orient), { duration: 0 });
    sync(); say(describe(true));
    layoutStrip();
    V.onResize(stage, function () { requestAnimationFrame(layoutStrip); });
    void busy;
  }

  /* ================================================================== rotation playground */
  function playFigure() {
    var fig = V.$('#fig-play');
    legend(fig, [{ state: 'pivot', label: 'hint: click this node' }, { state: 'done', label: 'height 2: done' }]);
    var stage = fig.querySelector('[data-stage]'), caption = fig.querySelector('[data-caption]');
    var start = A.fromKeys([10, 20, 30, 40, 50, 60, 70]);
    var tree = start, history = [], moves = 0, showBf = true, hinted = null, won = false;
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { rotations: 'Rotations', height: 'Height', best: 'Fewest possible from here' }, states: { best: 'pivot' } });
    /* the fewest rotations to reach height ≤ 2 (breadth-first search over shapes; 429 shapes for 7 keys) */
    function solve(t) {
      var key = function (x) { return JSON.stringify(A.shape(x)); };
      var seen = {}, q = [{ t: t, d: 0, first: null }];
      seen[key(t)] = true;
      while (q.length) {
        var cur = q.shift();
        if (A.height(cur.t) <= 2) return { dist: cur.d, first: cur.first };
        var ids = Object.keys(cur.t.nodes);
        for (var i = 0; i < ids.length; i++) {
          var nx = A.rotateUp(cur.t, ids[i]);
          if (!nx) continue;
          var k = key(nx);
          if (seen[k]) continue;
          seen[k] = true;
          q.push({ t: nx, d: cur.d + 1, first: cur.first === null ? ids[i] : cur.first });
        }
      }
      return { dist: 0, first: null };
    }
    var view = V.views.tree(stage, {
      nodeSize: 42, gap: 0.6, label: 'Seven keys in a search tree. Click a node to rotate it up over its parent.',
      onNodeClick: function (e) { rotate(e.id); }
    });
    function stateOf() {
      var H = A.heightsOf(tree), done = A.height(tree) <= 2;
      return {
        root: tree.root,
        nodes: Object.keys(tree.nodes).map(function (id) {
          var n = tree.nodes[id], o = { id: id, value: n.value, left: n.left, right: n.right };
          if (showBf) { var b = (n.left === null ? -1 : H[n.left]) - (n.right === null ? -1 : H[n.right]); o.badge = A.bfText(b); if (Math.abs(b) > 1) o.badgeState = 'error'; }
          if (done) o.state = 'done'; else if (id === hinted) o.state = 'pivot';
          return o;
        })
      };
    }
    function reserve() {
      var sts = [stateOf()];
      view.prepare(sts.concat([A.viewOf(start)]).map(function (s) { return Object.assign({}, s); }));
    }
    function draw(d) {
      var sol = solve(tree);
      view.render(stateOf(), { duration: d === undefined ? 600 : d });
      stats.update({ rotations: moves, height: A.height(tree), best: sol.dist });
      fig.querySelector('[data-undo]').disabled = !history.length;
      fig.querySelector('[data-reset]').disabled = !history.length;
      return sol;
    }
    function say(html) { caption.innerHTML = html; }
    function rotate(id) {
      var n = tree.nodes[id];
      if (!n) return;
      var p = A.parentOf(tree, id);
      if (p === null) { say('<b>' + n.value + '</b> is already the root: there is nothing above it to rotate over. Click another node.'); return; }
      var up = A.rotateUp(tree, id);
      history.push(tree); tree = up; moves += 1; hinted = null;
      var pv = up.nodes[id].right !== null && up.nodes[up.nodes[id].right] && up.nodes[up.nodes[id].right].value;
      var sol = draw();
      if (A.height(tree) <= 2) {
        won = true;
        var opt = solve(start).dist;
        say('Height <b>2</b> in <b>' + moves + '</b> rotations' + (moves === opt ? ': the fewest possible.' : ' (the fewest possible is ' + opt + ').') + ' The in-order sequence is still 10 … 70, so it is still a valid search tree.');
      } else {
        won = false;
        say('Rotated <b>' + n.value + '</b> up over its parent. The height is now <b>' + A.height(tree) + '</b>. ' + (sol.dist ? 'At least ' + sol.dist + ' more rotation' + (sol.dist === 1 ? '' : 's') + ' are needed from here.' : ''));
      }
      void pv;
    }
    fig.querySelector('[data-undo]').addEventListener('click', function () { if (!history.length) return; tree = history.pop(); moves -= 1; hinted = null; won = false; draw(); say('Undone. Click a node to rotate it up.'); });
    fig.querySelector('[data-reset]').addEventListener('click', function () { tree = start; history = []; moves = 0; hinted = null; won = false; draw(); say('Back to the stick. Every rotation lifts one node and lowers its parent.'); });
    fig.querySelector('[data-hint]').addEventListener('click', function () {
      var sol = solve(tree);
      if (sol.first === null) { say('Nothing to do: the height is already 2.'); return; }
      hinted = sol.first; draw(0);
      say('Hint: click <b>' + tree.nodes[sol.first].value + '</b>. It lies on a shortest solution: <b>' + sol.dist + '</b> rotations from here.');
    });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Show balance factors', checked: true, onChange: function (on) { showBf = on; reserve(); draw(0); } });
    reserve();
    draw(0);
    say('This tree is a stick: height 6 for seven keys. Click <b>20</b> to rotate it up over 10, then see what happens to the shape.');
  }

  /* ================================================================== balance factor explorer */
  function bfFigure() {
    var fig = V.$('#fig-bf');
    legend(fig, [{ state: 'pivot', label: 'chosen node' }, { state: 'frontier', label: 'left subtree' }, { state: 'compare', label: 'right subtree' }]);
    var t = A.fromShape([40, [20, [10, [5]], [30]], [60, null, [70]]]);
    var H = A.heightsOf(t), selected = t.root, all = true;
    function hh(id) { return id === null ? -1 : H[id]; }
    function bfOf(id) { var n = t.nodes[id]; return hh(n.left) - hh(n.right); }
    function state() {
      var n = t.nodes[selected];
      var left = A.inorderIds(t, n.left === null ? undefined : n.left), right = A.inorderIds(t, n.right === null ? undefined : n.right);
      if (n.left === null) left = []; if (n.right === null) right = [];
      return {
        root: t.root,
        nodes: Object.keys(t.nodes).map(function (id) {
          var x = t.nodes[id], o = { id: id, value: x.value, left: x.left, right: x.right };
          var b = bfOf(id);
          if (all || id === selected) { o.badge = A.bfText(b); if (Math.abs(b) > 1) o.badgeState = 'error'; }
          if (id === selected) o.state = 'pivot';
          else if (left.indexOf(id) !== -1) o.state = 'frontier';
          else if (right.indexOf(id) !== -1) o.state = 'compare';
          if (id === n.left || id === n.right) o.sub = 'h ' + H[id];
          return o;
        })
      };
    }
    var caption = fig.querySelector('[data-caption]');
    var view = V.views.tree(fig.querySelector('[data-stage]'), { nodeSize: 44, label: 'AVL tree: click a node to see its balance factor', onNodeClick: function (e) { selected = e.id; draw(); } });
    function words(id) { var x = hh(id); return x < 0 ? 'no child (height −1)' : 'height ' + x; }
    function draw(d) {
      var n = t.nodes[selected], b = bfOf(selected);
      view.render(state(), { duration: d === undefined ? 420 : d });
      caption.innerHTML = 'Node <b>' + n.value + '</b>: left ' + (n.left === null ? 'has ' + words(null) : words(n.left)) + ', right ' + (n.right === null ? 'has ' + words(null) : words(n.right)) + '. Balance factor = ' + hh(n.left) + ' − ' + (hh(n.right) < 0 ? '(' + hh(n.right) + ')' : hh(n.right)) + ' = <b>' + A.bfText(b) + '</b>. ' +
        (b === 0 ? 'Perfectly level.' : Math.abs(b) === 1 ? 'Leaning ' + (b > 0 ? 'left' : 'right') + ' by one: allowed.' : 'Out of balance.') + (selected === t.root ? ' <span class="muted">Click another node.</span>' : '');
    }
    view.prepare([state()]);
    draw(0);
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Show every balance factor', checked: true, onChange: function (on) { all = on; draw(300); } });
  }

  function bfQuiz() {
    var fig = V.$('#fig-bfq');
    legend(fig, [{ state: 'error', label: 'balance factor ±2' }]);
    var t = A.fromShape([50, [30, [20, [10, [5]]], [40]], [70, [60], [80]]]);
    var H = A.heightsOf(t);
    function hh(id) { return id === null ? -1 : H[id]; }
    var view = V.views.tree(fig.querySelector('[data-stage]'), { nodeSize: 42, label: 'A tree with several nodes at balance factor plus 2: click the lowest one' });
    function state(reveal) {
      return {
        root: t.root,
        nodes: Object.keys(t.nodes).map(function (id) {
          var x = t.nodes[id], b = hh(x.left) - hh(x.right), o = { id: id, value: x.value, left: x.left, right: x.right, badge: A.bfText(b) };
          if (Math.abs(b) > 1) o.badgeState = 'error';
          if (reveal && x.value === 20) o.state = 'error';
          return o;
        })
      };
    }
    view.prepare([state(false), state(true)]);
    view.render(state(false), { duration: 0 });
    tagNodes(view);
    V.clickQuiz(fig.querySelector('[data-stage]'), {
      el: '#quiz-bf-click', id: 'bf-lowest', kicker: 'Click to answer',
      question: 'Three nodes have balance factor +2. Click the <b>lowest</b> one: the one where the repair starts.',
      check: function (id) {
        if (id === '20') return { correct: true, message: 'Yes. Rotating right at 20 makes its subtree one level shorter, and that also fixes 30 and 50 above it, whose +2 was only caused by the tall spot below.' };
        if (id === '30' || id === '50') return { correct: false, message: id + ' does have balance factor +2, but only because 20’s subtree is too tall. Fix the lowest unbalanced node first, and the ones above usually fix themselves.' };
        var n = t.nodes[A.findId(t, parseInt(id, 10))];
        return { correct: false, message: n ? id + ' has balance factor ' + A.bfText(hh(n.left) - hh(n.right)) + ': within ±1, so it is not out of balance.' : 'Click one of the nodes.' };
      }
    }).onAnswer(function (r) { if (r.correct) view.render(state(true), { duration: 420 }); });
  }

  V.ready(function () {
    if (V.quizScore) ['bf-lowest', 'rb-violation', 'avl-lab-case', 'rb-lab-uncle', 'l20-bf', 'l20-fix', 'l20-cost', 'l20-btree', 'btree-split-key'].forEach(function (id) { V.quizScore.register(id); });
    try { heroTeaser(); } catch (e) { console.error(e); }
    nearView(V.$('#fig-stick'), stickFigure);
    nearView(V.$('#fig-rotate'), rotateFigure);
    nearView(V.$('#fig-play'), playFigure);
    nearView(V.$('#fig-bf'), bfFigure);
    nearView(V.$('#fig-bfq'), bfQuiz);
  });
}());
