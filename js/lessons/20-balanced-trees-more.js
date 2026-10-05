/* Lesson 20 · Balanced trees — the B-tree view and figure, the 2-3-4 correspondence, the multiple-choice checks
   and the summary card. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var A = V.algos.lesson20, L = V.lesson20;
  var num = A.num, nearView = L.nearView;

  /* ================================================================== B-tree view (custom): nodes are rows of key cells */
  var KW = 34, KH = 32, PAD = 5, GAP = 14, LEVEL = 66, TOP = 12;
  function btreeView(container, opts) {
    opts = opts || {};
    var svg = s('svg', { class: 'vz vz-btree', role: 'img', 'aria-label': opts.label || 'B-tree' });
    container.appendChild(svg);
    var desc = s('desc'); svg.appendChild(desc);
    var gE = s('g'), gF = s('g'), gK = s('g');
    svg.appendChild(gE); svg.appendChild(gF); svg.appendChild(gK);
    var F = {}, K = {}, E = {};     // frames, keys, edges by id
    var tw = null, last = null, prepared = { W: 0, H: 0 }, maxKeys = opts.max || 3;
    function copy(o) { return { x: o.x, y: o.y, w: o.w, o: o.o }; }
    function slot() { return (maxKeys + 1) * KW + 2 * PAD; }

    function layout(state) {
      var map = {};
      state.nodes.forEach(function (n) { map[n.id] = n; });
      var pos = {}, x = 0, depth = 0, S = slot();
      function place(id, d) {
        var n = map[id], w = 2 * PAD + n.keys.length * KW;
        if (d > depth) depth = d;
        if (!n.children.length) { pos[id] = { x: x + (S - w) / 2, w: w, d: d }; x += S + GAP; return; }
        n.children.forEach(function (c) { place(c, d + 1); });
        var a = pos[n.children[0]], b = pos[n.children[n.children.length - 1]];
        var cx = ((a.x + a.w / 2) + (b.x + b.w / 2)) / 2;
        pos[id] = { x: cx - w / 2, w: w, d: d };
      }
      if (state.root !== null && map[state.root]) place(state.root, 0);
      var W = Math.max(S, x - GAP);
      var minX = Infinity; Object.keys(pos).forEach(function (id) { minX = Math.min(minX, pos[id].x); });
      return { pos: pos, W: W, depth: depth, map: map, shift: isFinite(minX) ? -minX : 0 };
    }
    function size(lay) {
      var levels = Math.max(lay.depth + 1, prepared.levels || 0, 1);
      return { W: Math.max(lay.W, prepared.W || 0) + 2 * TOP, H: TOP * 2 + KH + (levels - 1) * LEVEL + 22 };
    }
    function targets(state) {
      var lay = layout(state), sz = size(lay);
      var ox = (sz.W - lay.W) / 2 + lay.shift;
      var T = { frames: {}, keys: {}, edges: {}, W: sz.W, H: sz.H };
      state.nodes.forEach(function (n) {
        var p = lay.pos[n.id];
        if (!p) return;
        var y = TOP + p.d * LEVEL, left = ox + p.x;
        T.frames[n.id] = { x: left, y: y, w: p.w, state: n.state || 'default', parent: null };
        n.keys.forEach(function (k, i) { T.keys[k.id] = { x: left + PAD + i * KW, y: y + (KH - (KH - 6)) / 2 + 0, v: k.v, state: k.state || 'default' }; });
        n.children.forEach(function (c, i) { T.edges[c] = { parent: n.id, idx: i }; });
      });
      return T;
    }
    function fmt(v) { return v < 0 ? '−' + Math.abs(v) : String(v); }
    function ensure(kind, id) {
      var store = kind === 'f' ? F : kind === 'k' ? K : E;
      if (store[id]) return store[id];
      var rec = { id: id, cur: { x: 0, y: 0, w: 0, o: 0 }, from: null, tgt: null, isNew: true };
      if (kind === 'f') { rec.el = s('rect', { class: 'bt-bframe', rx: 9, ry: 9, height: KH + 6 }); gF.appendChild(rec.el); }
      else if (kind === 'k') {
        rec.el = s('g', { class: 'vz-item bt-bkey' });
        rec.shape = s('rect', { class: 'vz-shape', rx: 6, ry: 6, width: KW - 4, height: KH - 2 });
        rec.txt = s('text', { class: 'vz-ink vz-value vz-mono', 'text-anchor': 'middle', dy: '.35em', x: (KW - 4) / 2, y: (KH - 2) / 2 });
        rec.el.appendChild(rec.shape); rec.el.appendChild(rec.txt); gK.appendChild(rec.el);
      } else { rec.el = s('g', { class: 'vz-edge is-default' }); rec.path = s('path', { class: 'vz-line' }); rec.el.appendChild(rec.path); gE.appendChild(rec.el); }
      store[id] = rec; return rec;
    }
    function setState(el, cls, st) { el.setAttribute('class', cls + ' is-' + st); }
    function paint() {
      Object.keys(F).forEach(function (id) {
        var r = F[id], c = r.cur;
        r.el.setAttribute('x', c.x - PAD + PAD); r.el.setAttribute('y', c.y - 3); r.el.setAttribute('width', Math.max(0, c.w)); r.el.setAttribute('opacity', c.o);
      });
      Object.keys(K).forEach(function (id) {
        var r = K[id], c = r.cur;
        r.el.setAttribute('transform', 'translate(' + c.x.toFixed(2) + ',' + (c.y).toFixed(2) + ')'); r.el.setAttribute('opacity', c.o);
      });
      Object.keys(E).forEach(function (id) {
        var r = E[id];
        if (!r.tgt || !r.tgt.parent || !F[r.tgt.parent] || !F[id]) { r.el.setAttribute('opacity', 0); return; }
        var p = F[r.tgt.parent].cur, c = F[id].cur;
        var px = p.x + PAD + r.tgt.idx * KW, py = p.y + KH + 3;
        var cx = c.x + c.w / 2, cy = c.y - 3;
        var my = (py + cy) / 2;
        r.path.setAttribute('d', 'M' + px.toFixed(1) + ',' + py.toFixed(1) + ' C' + px.toFixed(1) + ',' + my.toFixed(1) + ' ' + cx.toFixed(1) + ',' + my.toFixed(1) + ' ' + cx.toFixed(1) + ',' + cy.toFixed(1));
        r.el.setAttribute('opacity', Math.min(p.o, c.o));
      });
    }
    function render(state, o) {
      o = o || {};
      var T = targets(state), prevKeyNode = {};
      if (last) last.nodes.forEach(function (n) { n.keys.forEach(function (k) { prevKeyNode[k.id] = n.id; }); });
      svg.setAttribute('viewBox', '0 0 ' + T.W + ' ' + T.H);
      var avail = container.clientWidth || T.W;
      var disp = opts.fit ? Math.min(T.W, avail) : Math.min(T.W, Math.max(avail, 600));
      svg.style.width = disp + 'px'; svg.style.height = (T.H * disp / T.W) + 'px';
      svg.style.margin = '0 auto'; svg.style.display = 'block';
      svg.style.setProperty('--vz-dur', (o.duration || 0) + 'ms');
      desc.textContent = state.nodes.map(function (n) { return '[' + n.keys.map(function (k) { return fmt(k.v); }).join(' ') + ']'; }).join(' ');
      var seen = { f: {}, k: {}, e: {} };
      Object.keys(T.frames).forEach(function (id) {
        var r = ensure('f', id), t = T.frames[id];
        seen.f[id] = true;
        if (r.isNew) {
          /* a split node grows out of the node its keys came from */
          var src = null;
          state.nodes.forEach(function (n) { if (n.id === id) n.keys.forEach(function (k) { if (!src && prevKeyNode[k.id] && F[prevKeyNode[k.id]]) src = F[prevKeyNode[k.id]]; }); });
          r.cur = src ? { x: src.cur.x, y: src.cur.y, w: src.cur.w, o: 0 } : { x: t.x, y: t.y, w: t.w, o: 0 };
          r.isNew = false;
        }
        r.tgt = { x: t.x, y: t.y, w: t.w, o: 1 };
        setState(r.el, 'bt-bframe', t.state);
      });
      Object.keys(T.keys).forEach(function (id) {
        var r = ensure('k', id), t = T.keys[id];
        seen.k[id] = true;
        if (r.isNew) { r.cur = { x: t.x, y: t.y, w: 0, o: 0 }; r.isNew = false; }
        r.tgt = { x: t.x, y: t.y, w: 0, o: 1 };
        r.txt.textContent = fmt(t.v);
        setState(r.el, 'vz-item bt-bkey', t.state);
      });
      Object.keys(T.edges).forEach(function (id) { var r = ensure('e', id); seen.e[id] = true; r.tgt = T.edges[id]; if (r.isNew) { r.cur = { x: 0, y: 0, w: 0, o: 0 }; r.isNew = false; } });
      [[F, 'f'], [K, 'k'], [E, 'e']].forEach(function (pair) {
        Object.keys(pair[0]).forEach(function (id) { if (!seen[pair[1]][id]) { var r = pair[0][id]; r.gone = true; r.tgt = { x: r.cur.x, y: r.cur.y, w: r.cur.w, o: 0 }; if (pair[1] === 'e') r.tgt = { parent: null }; } else pair[0][id].gone = false; });
      });
      last = state;
      /* on a narrow screen the stage scrolls sideways: keep the action (the highlighted nodes) in view */
      if (container.scrollWidth > container.clientWidth + 2) {
        var hot = Object.keys(T.frames).filter(function (id) { return T.frames[id].state !== 'default'; });
        if (!hot.length) hot = Object.keys(T.frames).filter(function (id) { return T.frames[id].y === TOP; });
        if (hot.length) {
          var x0 = Infinity, x1 = -Infinity;
          hot.forEach(function (id) { x0 = Math.min(x0, T.frames[id].x); x1 = Math.max(x1, T.frames[id].x + T.frames[id].w); });
          var sc = parseFloat(svg.style.width) / T.W, mid = ((x0 + x1) / 2) * sc + (svg.offsetLeft - container.offsetLeft || 0);
          var left = Math.max(0, mid - container.clientWidth / 2);
          if (container.scrollTo && !V.reducedMotion()) container.scrollTo({ left: left, behavior: o.duration ? 'smooth' : 'auto' }); else container.scrollLeft = left;
        }
      }
      var dur = V.dur(o.duration === undefined ? 600 : o.duration);
      if (tw) tw.cancel();
      var recs = Object.keys(F).map(function (id) { return F[id]; }).concat(Object.keys(K).map(function (id) { return K[id]; }));
      recs.forEach(function (r) { r.from = copy(r.cur); });
      function apply(e) {
        recs.forEach(function (r) {
          r.cur.x = r.from.x + (r.tgt.x - r.from.x) * e; r.cur.y = r.from.y + (r.tgt.y - r.from.y) * e;
          r.cur.w = r.from.w + (r.tgt.w - r.from.w) * e; r.cur.o = r.from.o + (r.tgt.o - r.from.o) * e;
        });
        paint();
      }
      function cleanup() {
        [[F, 'f'], [K, 'k'], [E, 'e']].forEach(function (pair) {
          Object.keys(pair[0]).forEach(function (id) { var r = pair[0][id]; if (r.gone) { r.el.remove(); delete pair[0][id]; } });
        });
      }
      if (dur <= 0) { apply(1); cleanup(); return; }
      tw = V.tween(dur, function (t, e) { apply(e); });
      tw.promise.then(function () { apply(1); cleanup(); }, function () {});
    }
    return {
      el: svg, render: render,
      prepare: function (states) {
        prepared = { W: 0, levels: 0 };
        states.forEach(function (st) { var lay = layout(st); prepared.W = Math.max(prepared.W, lay.W); prepared.levels = Math.max(prepared.levels, lay.depth + 1); });
      },
      reset: function () { if (tw) tw.cancel(); Object.keys(F).concat([]).forEach(function (id) { F[id].el.remove(); delete F[id]; }); Object.keys(K).forEach(function (id) { K[id].el.remove(); delete K[id]; }); Object.keys(E).forEach(function (id) { E[id].el.remove(); delete E[id]; }); last = null; },
      setMax: function (m) { maxKeys = m; }
    };
  }
  L.btreeView = btreeView;

  function btreeFigure() {
    var fig = V.$('#fig-btree');
    L.legend(fig, [{ state: 'key', label: 'new key' }, { state: 'error', label: 'overflowing node' }, { state: 'pivot', label: 'middle key, promoted' }, { state: 'active', label: 'nodes after the split' }, { state: 'compare', label: 'room: nothing to split' }]);
    var stage = fig.querySelector('[data-stage]');
    var max = 3, keys = [10, 20, 30, 40, 50, 60, 70, 80, 25, 35];
    var view = btreeView(stage, { max: max, label: 'B-tree insertions with node splits' });
    var player = V.player({
      root: fig, steps: [A.bBuildSteps([], max).steps[0]],
      render: function (st, c) { view.render(st, { duration: c.duration }); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'), counterLabels: L.LABELS,
      counterStates: { splits: 'active' }, baseStepMs: 1500, label: 'B-tree controls'
    });
    function load(o) {
      o = o || {};
      var res = A.bBuildSteps(keys, max, { quick: true });
      view.setMax(max); view.reset(); view.prepare(res.steps);
      player.setSteps(res.steps);
      if (o.end) player.goto(res.steps.length - 1);
    }
    /* the first overflow is a prediction */
    var asked = false;
    player.addCheckpoint(function (steps) {
      if (asked) return -1;
      for (var i = 1; i < steps.length; i++) if (steps[i].kind === 'overflow') return i;
      return -1;
    }, function (c) {
      var st = c.step, node = st.nodes.filter(function (n) { return n.state === 'error'; })[0];
      if (!node) return null;
      var mid = Math.floor((node.keys.length - 1) / 2), median = node.keys[mid].v;
      var opts = node.keys.map(function (k) { return num(k.v); });
      return {
        question: 'This node holds <b>' + node.keys.length + '</b> keys but may hold at most <b>' + max + '</b>. When it splits, which key moves up into the parent?',
        options: opts, answer: mid,
        explain: opts.map(function (o, i) { return i === mid ? 'Yes: ' + o + ' is the middle key. It separates the smaller keys (left node) from the larger ones (right node), which is exactly what a parent key must do.' : (i < mid ? o + ' is too far left: promoting it would leave almost nothing on its left and an over-full node on its right.' : o + ' is too far right: the split would be lopsided. The middle key ' + num(median) + ' goes up.'); })
      };
    }, { id: 'btree-split-key' });
    player.on('checkpointdone', function () { asked = true; });
    if (V.quizScore) V.quizScore.register('btree-split-key');
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Node capacity', value: '3',
      options: [{ value: '2', label: '2-3 tree (up to 2 keys)' }, { value: '3', label: 'B-tree (up to 3 keys)' }],
      onChange: function (v) { max = +v; load(); }
    });
    var rng = V.rng(1972);
    V.inputRow(fig.querySelector('[data-input]'), {
      label: 'Insert these keys, in this order (up to 14)', value: keys, parse: { min: 1, max: 99, maxCount: 14, minCount: 0 }, applyLabel: 'Build',
      presets: [
        { label: 'Sorted', value: [10, 20, 30, 40, 50, 60, 70, 80, 90] },
        { label: 'Reversed', value: [90, 80, 70, 60, 50, 40, 30, 20, 10] },
        { label: 'Random', value: function () { return V.presets.random(10, { min: 1, max: 99, unique: true, rng: rng }); } },
        { label: 'First split only', value: [10, 20, 30, 40] }
      ],
      hint: 'Duplicates are skipped.',
      onApply: function (values) { keys = values; load(); if (!V.reducedMotion()) player.play(); }
    });
    load({ end: false });
  }

  /* ================================================================== red-black = 2-3-4: one wide node */
  function two34Mini() {
    var host = V.$('[data-mini="two34"]');
    if (!host) return;
    host.classList.add('bt-two34');
    var left = h('div', { class: 'bt-two34__tree' }), arrow = h('div', { class: 'bt-two34__arrow', 'aria-hidden': 'true' }, '→');
    var right = h('div', { class: 'bt-two34__node' }, h('div', { class: 'bt-bkeys' }, [10, 20, 30].map(function (k) { return h('span', { class: 'bt-bkey' }, String(k)); })), h('span', { class: 'bt-two34__cap' }, 'one 4-node'));
    host.appendChild(left); host.appendChild(arrow); host.appendChild(right);
    var t = A.fromShape([20, [10, null, null, 'r'], [30, null, null, 'r'], 'b']);
    var view = V.views.tree(left, { nodeSize: 34, gap: 0.5, label: 'A black node with two red children' });
    var st = A.viewOf(t); view.prepare([st]); view.render(st, { duration: 0 });
  }

  /* ================================================================== multiple-choice checks */
  function quizzes() {
    V.quiz('#quiz-bf', {
      id: 'l20-bf', kicker: 'Quick check',
      question: 'In the tree above, what is the balance factor of node <b>40</b>? (height of left subtree − height of right subtree)',
      options: ['+2', '+1', '0', '−2'], answer: 0,
      explain: [
        'Yes. The left subtree (rooted at 20) has height 2: 20 → 30 → 25. The right subtree (just 50) has height 0. So 2 − 0 = +2, and 40 is out of balance.',
        'Close, but +1 is the balance factor of node 30 (left height 0, right height −1). For 40 the left height is 2, not 1: count the links 20 → 30 → 25.',
        'A balance factor of 0 means both sides are equally tall. Here the left side has two more levels than the right.',
        'The sign is backwards: the left side is the taller one, so the balance factor is positive.'
      ]
    });
    V.quiz('#quiz-fix', {
      id: 'l20-fix', kicker: 'Which rotation fixes it?',
      question: 'Node 40 is out of balance. Its left child, 20, leans <em>right</em> (its right subtree, under 30, is taller). Which repair restores the AVL property?',
      options: ['Rotate right at 40', 'Rotate left at 20, then rotate right at 40', 'Rotate left at 40', 'Rotate right at 20, then rotate left at 40'], answer: 1,
      explain: [
        'A single right rotation at 40 lifts 20 to the top, but 30 and 25, the tall part, end up on the far side. The tree would be a mirror image of the problem: 20 would have balance factor −2. When the heavy child leans the other way (a bend), one rotation only moves the bend.',
        'Yes. This is the LR case. Rotating left at 20 lifts 30 and straightens the bend into a line; rotating right at 40 then lifts 30 to the top with 20 and 40 as its children.',
        'A left rotation at 40 would lift 50, the light side, making the imbalance worse.',
        'That is the RL sequence, for a heavy right side that leans left. Here the heavy side is the left.'
      ]
    });
    V.quiz('#quiz-cost', {
      id: 'l20-cost', kicker: 'Worst case',
      question: 'After <em>one insert</em>, how many rotations can an AVL tree and a red-black tree need at most?',
      options: ['AVL: 2, red-black: 2', 'AVL: log n, red-black: 2', 'AVL: 2, red-black: log n', 'Both: log n'], answer: 0,
      explain: [
        'Yes. After an insert, one repair (a single or a double rotation) restores the subtree to its old height, so nothing above changes. A red-black insert also ends after at most two rotations; recolouring may climb, but recolouring is not a rotation.',
        'log n rotations is what an AVL <em>delete</em> can need, because a delete can leave the subtree shorter and keep unbalancing ancestors. An insert never does.',
        'Red-black recolouring can climb log n levels, but the rotations happen at most twice, at the very end of the climb.',
        'Both trees stop after two rotations for an insert. The log n behaviour is recolouring in red-black trees and rotations in AVL deletes.'
      ]
    });
    V.quiz('#quiz-btree', {
      id: 'l20-btree', kicker: 'Why wide?',
      question: 'Why do databases and file systems prefer B-trees to AVL trees for indexes stored on disk?',
      options: ['Each node holds many keys, so the tree is shallow and a lookup needs only a few disk reads', 'B-trees need no comparisons', 'B-trees do not stay balanced, which makes inserts faster', 'AVL trees cannot hold more than a million keys'], answer: 0,
      explain: [
        'Yes. A disk read fetches a whole block, and a B-tree node fills one block with hundreds of keys. A million keys fit in three or four levels, so a lookup costs three or four reads instead of twenty.',
        'B-tree lookups compare keys inside each node, just like any search tree.',
        'B-trees are perfectly balanced: every leaf is at the same depth, always.',
        'AVL trees hold any number of keys. They are just tall, and each level can mean a slow read.'
      ]
    });
  }

  /* ================================================================== summary card */
  function summary() {
    var grid = V.$('#summary-card .summary__grid');
    if (!grid) return;
    function tile(title, text, build) {
      var viz = h('div', { class: 'summary__viz stage-grid bt-sumviz' });
      grid.appendChild(h('div', { class: 'summary__item' }, viz, h('p', { class: 'summary__label' }, title), h('p', { class: 'summary__text' }, text)));
      try { build(viz); } catch (e) { console.error(e); }
    }
    function tree(viz, spec, o) {
      var t = A.fromShape(spec);
      var v = V.views.tree(viz, Object.assign({ nodeSize: 26, gap: 0.5, describe: false, label: 'Small tree' }, o || {}));
      var st = A.viewOf(t);
      if (o && o.badges) { var bf = A.bfTable(t); st.nodes.forEach(function (n) { n.badge = A.bfText(bf[n.id]); if (Math.abs(bf[n.id]) > 1) n.badgeState = 'error'; }); }
      if (o && o.mark) st.nodes.forEach(function (n) { if (o.mark[n.value]) n.state = o.mark[n.value]; });
      v.prepare([st]); v.render(st, { duration: 0 });
      v.el.setAttribute('aria-hidden', 'true');
      return v;
    }
    tile('Rotation: O(1)', 'Lift one node, lower its neighbour, move one subtree. The in-order sequence never changes.', function (viz) {
      var xy = A.xyState('right', { states: { x: 'active', y: 'active', A: 'frontier', C: 'frontier', B: 'pivot' } });
      var v = V.views.tree(viz, { order: 'inorder', nodeSize: 26, gap: 0.9, describe: false, label: 'Rotation' });
      var st = { root: xy.root, nodes: xy.nodes, edges: {} }; v.prepare([st]); v.render(st, { duration: 0 }); v.el.setAttribute('aria-hidden', 'true');
    });
    tile('Balance factor', 'height(left) − height(right). AVL keeps every node at −1, 0 or +1.', function (viz) {
      tree(viz, [40, [20, [10]], [60]], { badges: true, nodeSize: 28 });
    });
    tile('Straight: one rotation', 'LL and RR: the heavy path runs straight. One rotation at the top node.', function (viz) {
      tree(viz, [30, [20, [10]]], { badges: true, nodeSize: 28, mark: { 30: 'error', 20: 'pivot', 10: 'pivot' } });
    });
    tile('Bend: two rotations', 'LR and RL: the heavy path bends. Straighten it, then rotate the top.', function (viz) {
      tree(viz, [30, [10, null, [20]]], { badges: true, nodeSize: 28, mark: { 30: 'error', 10: 'pivot', 20: 'pivot' } });
    });
    tile('Red-black: 5 rules', 'Root black, no red-red, equal black count on every path. Height ≤ 2 log₂(n + 1).', function (viz) {
      tree(viz, [20, [10, null, null, 'r'], [30, null, null, 'r'], 'b'], { nodeSize: 28 });
    });
    tile('Height guarantees', 'Perfect: log₂ n. AVL: ≤ 1.44 log₂ n. Red-black: ≤ 2 log₂ n. Plain BST: up to n − 1.', function (viz) {
      var bars = [['perfect', 1, 'done'], ['AVL', 1.44, 'active'], ['red-black', 2, 'pivot'], ['plain BST', 5, 'error']];
      viz.appendChild(h('div', { class: 'bt-bars', role: 'img', 'aria-label': 'Height bounds for n keys: perfect 1 times log n, AVL 1.44 times log n, red-black 2 times log n, plain BST up to n minus 1' }, bars.map(function (b) {
        return h('div', { class: 'bt-bars__row' }, h('span', { class: 'bt-bars__l' }, b[0]), h('span', { class: 'bt-bars__b' }, h('i', { style: { width: (b[1] / 5 * 100) + '%', background: 'var(--st-' + b[2] + ')' } })));
      })));
    });
    tile('B-tree: wide and shallow', 'Many keys per node, all leaves at one depth. Overflow splits a node and promotes its middle key.', function (viz) {
      var res = A.bBuildSteps([10, 20, 30, 40], 3, { quick: true });
      var last = res.steps[res.steps.length - 1];
      var v = btreeView(viz, { max: 3, fit: true, label: 'A small B-tree' }); v.prepare([last]); v.render(last, { duration: 0 }); v.el.setAttribute('aria-hidden', 'true');
    });
  }

  V.ready(function () {
    try { quizzes(); } catch (e) { console.error(e); }
    nearView(V.$('#fig-btree'), btreeFigure);
    nearView(V.$('#variants'), two34Mini);
    nearView(V.$('#summary-card'), summary);
  });
}());
