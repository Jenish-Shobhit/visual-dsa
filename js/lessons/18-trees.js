/* Lesson 18 · Trees & traversals — hero teaser, real trees, growing a tree, vocabulary explorer, shape gallery.
   Step generators: js/algos/18-trees.js (VDSA.algos.lesson18, tested in Node).
   Shared helpers and the Euler-tour layer: js/lessons/18-trees-tour.js. Later figures: -lab.js, -figs.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, A = V.algos.lesson18, L = V.lesson18;
  var nearView = L.nearView, legend = L.legend, treeState = L.treeState, treeFigure = L.treeFigure;

  /* ================================================================== hero teaser */
  function heroTeaser() {
    var stage = V.$('#teaser');
    if (!stage) return;
    var tree = A.fromLevel(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    function innerHeight() {
      var cs = getComputedStyle(stage);
      return Math.max(200, stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    }
    var view = V.views.tree(stage, { nodeSize: 44, gap: 1, height: innerHeight(), describe: false, label: 'A tree growing and being walked' });
    view.el.setAttribute('aria-hidden', 'true');
    var layer = L.tourLayer(view, tree);
    var steps = A.teaserSteps(tree);
    view.prepare(steps.map(treeState));
    V.teaser(stage, {
      steps: steps, stepMs: 700, holdMs: 2400, instantWrap: true,
      render: function (s, c) {
        view.render(treeState(s), { duration: c.duration });
        layer.update({ pos: s.tour, ms: c.duration });
      }
    });
    V.onResize(stage, function () { view.setOptions({ height: innerHeight() }); });
  }

  /* ================================================================== real trees: collapsible n-ary trees */
  var FS = {
    id: 'project', label: 'project', children: [
      { id: 'src', label: 'src', children: [
        { id: 'app', label: 'app.js', size: 14 },
        { id: 'ui', label: 'ui', children: [{ id: 'btn', label: 'button.js', size: 6 }, { id: 'mod', label: 'modal.js', size: 9 }] }
      ] },
      { id: 'docs', label: 'docs', children: [{ id: 'rm', label: 'readme.md', size: 3 }] },
      { id: 'pkg', label: 'package.json', size: 2 }
    ]
  };
  var ORG = {
    id: 'ceo', label: 'CEO', children: [
      { id: 'cto', label: 'CTO', children: [{ id: 'dev', label: 'Dev' }, { id: 'qa', label: 'QA' }] },
      { id: 'cfo', label: 'CFO', children: [{ id: 'pay', label: 'Payroll' }, { id: 'aud', label: 'Audit' }] },
      { id: 'coo', label: 'COO', children: [{ id: 'sup', label: 'Support' }, { id: 'ops', label: 'Ops' }] }
    ]
  };
  var DOM = {
    id: 'html', label: '<html>', children: [
      { id: 'head', label: '<head>', children: [{ id: 'title', label: '<title>' }, { id: 'meta', label: '<meta>' }] },
      { id: 'body', label: '<body>', children: [
        { id: 'h1', label: '<h1>' },
        { id: 'ul', label: '<ul>', children: [{ id: 'li1', label: '<li>' }, { id: 'li2', label: '<li>' }, { id: 'li3', label: '<li>' }] },
        { id: 'p', label: '<p>' }
      ] }
    ]
  };
  L.FS = FS;
  var REAL = {
    fs: { label: 'File system', root: FS, foot: 'Folders are nodes with children; files are leaves. Every file has exactly one path from the root.', term: 'folder', leafName: 'file' },
    org: { label: 'Org chart', root: ORG, foot: 'Each person reports to exactly one manager, so following “reports to” always ends at the CEO.', term: 'manager', leafName: 'person with no reports' },
    dom: { label: 'HTML page', root: DOM, foot: 'A browser turns a web page into this tree (the DOM). A tag nested inside another tag is its child.', term: 'tag', leafName: 'tag with nothing inside' }
  };

  function realTrees() {
    var fig = V.$('#fig-real');
    if (!fig) return;
    legend(fig, [{ state: 'default', label: 'node' }, { state: 'frontier', label: 'folded: its subtree is hidden' }]);
    var stage = fig.querySelector('[data-stage]'), caption = fig.querySelector('[data-caption]'), foot = fig.querySelector('[data-foot]');
    var key = 'fs', collapsed = {};
    var view = V.views.tree(stage, { nodeSize: 36, gap: 0.45, label: 'Interactive tree: click a node with children to fold or unfold it', onNodeClick: function (e) { toggle(e.id); } });
    function count(n) { return 1 + (n.children || []).reduce(function (s, c) { return s + count(c); }, 0); }
    function build(root, col) {
      var out = [];
      (function go(n) {
        var kids = n.children || [], hid = !!col[n.id] && kids.length > 0;
        var o = { id: n.id, label: n.label, children: hid ? [] : kids.map(function (c) { return c.id; }), state: hid ? 'frontier' : 'default' };
        if (hid) o.badge = '+' + (count(n) - 1);
        out.push(o);
        if (!hid) kids.forEach(go);
      }(root));
      return { root: root.id, nodes: out, edges: {} };
    }
    function find(root, id) { var r = null; (function go(n) { if (n.id === id) r = n; (n.children || []).forEach(go); }(root)); return r; }
    function shown(st) { return st.nodes.length; }
    function describe(extra) {
      var d = REAL[key], st = build(d.root, collapsed), n = shown(st), total = count(d.root);
      var leaves = st.nodes.filter(function (x) { return !x.children.length && x.state === 'default'; }).length;
      var s = '<b>' + d.label + '</b>: ' + n + ' nodes on screen' + (n < total ? ' (' + total + ' in all)' : '') + ', ' + (n - 1) + ' links, ' + leaves + ' ' + (leaves === 1 ? 'leaf' : 'leaves') + '. The root is <b>' + V.escape(d.root.label) + '</b>.';
      return (extra ? extra + ' ' : '') + s + (Object.keys(collapsed).length ? '' : ' <span class="muted">Click a ' + d.term + ' to fold it.</span>');
    }
    function draw(dur, extra) {
      view.render(build(REAL[key].root, collapsed), { duration: dur === undefined ? 420 : dur });
      caption.innerHTML = describe(extra);
      foot.textContent = REAL[key].foot;
    }
    function toggle(id) {
      var n = find(REAL[key].root, id);
      if (!n || !(n.children || []).length) { draw(0, 'A ' + REAL[key].leafName + ' is a <b>leaf</b>: nothing hangs below it, so there is nothing to fold.'); return; }
      if (collapsed[id]) delete collapsed[id]; else collapsed[id] = true;
      draw(420);
    }
    function reset() {
      collapsed = {};
      if (stage.clientWidth < 520) {
        (function go(n, d) { if (d >= 2 && (n.children || []).length) collapsed[n.id] = true; (n.children || []).forEach(function (c) { go(c, d + 1); }); }(REAL[key].root, 0));
      }
    }
    view.prepare(Object.keys(REAL).map(function (k) { return build(REAL[k].root, {}); }));
    reset(); draw(0);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Which tree', value: 'fs',
      options: Object.keys(REAL).map(function (k) { return { value: k, label: REAL[k].label }; }),
      onChange: function (k) { key = k; reset(); draw(520); }
    });
  }

  /* ================================================================== intuition: growing a tree */
  function growFigure() {
    var fig = V.$('#fig-grow');
    if (!fig) return;
    legend(fig, [{ state: 'active', label: 'new node' }, { state: 'compare', label: 'its parent' }, { state: 'path', shape: 'line', label: 'the one new edge' }]);
    var tree = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F', 'G', 'H']);
    treeFigure(fig, A.growSteps(tree), { view: { nodeSize: 40, label: 'A tree growing one node and one edge at a time' }, baseStepMs: 1300, counterStates: { edges: 'path' }, label: 'Tree growth controls' });
  }

  /* ================================================================== vocabulary explorer */
  function vocabFigure() {
    var fig = V.$('#fig-vocab');
    if (!fig) return;
    var tree = A.fromLevel(['A', 'B', 'C', 'D', 'E', '#', 'F', 'G', '#', 'H', 'I', '#', 'J']);
    var idOf = {}; tree.order.forEach(function (id) { idOf[tree.nodes[id].value] = id; });
    var selected = idOf.B, mode = 'family';
    var caption = fig.querySelector('[data-caption]'), factsEl = fig.querySelector('[data-facts]');
    var LEGENDS = {
      family: [{ state: 'pivot', label: 'chosen node' }, { state: 'compare', label: 'parent' }, { state: 'active', label: 'children' }, { state: 'frontier', label: 'siblings' }],
      lineage: [{ state: 'pivot', label: 'chosen node' }, { state: 'visited', label: 'ancestors' }, { state: 'active', label: 'descendants' }, { state: 'path', shape: 'line', label: 'path from the root' }],
      depth: [{ state: 'pivot', label: 'chosen node' }, { state: 'path', shape: 'line', label: 'root to node: depth = links' }, { state: 'done', shape: 'line', label: 'longest way down: height = links' }, { state: 'default', label: 'small number = depth' }],
      level: [{ state: 'pivot', label: 'chosen node' }, { state: 'compare', label: 'same level (same depth)' }]
    };
    var view = V.views.tree(fig.querySelector('[data-stage]'), {
      nodeSize: 42, label: 'A tree: click a node to see its parent, children, depth and height',
      onNodeClick: function (e) { selected = e.id; draw(); }
    });
    function pairKey(a, b) { return a + '-' + b; }
    function state() {
      var f = A.vocabFacts(tree, selected), dmap = A.depths(tree);
      var st = {};
      var edges = {};
      if (mode === 'family') {
        if (f.parent !== null) st[f.parent] = 'compare';
        f.children.forEach(function (c) { st[c] = 'active'; });
        f.siblings.forEach(function (c) { st[c] = 'frontier'; });
      } else if (mode === 'lineage') {
        f.ancestors.forEach(function (a) { st[a] = 'visited'; });
        f.descendants.forEach(function (c) { st[c] = 'active'; });
      } else if (mode === 'level') {
        f.level.forEach(function (c) { st[c] = 'compare'; });
      }
      if (mode === 'lineage' || mode === 'depth') {
        var chain = f.ancestors.slice().reverse().concat([selected]);
        for (var i = 1; i < chain.length; i++) edges[pairKey(chain[i - 1], chain[i])] = 'path';
      }
      if (mode === 'depth') {
        var down = A.longestDown(tree, selected);
        for (var j = 1; j < down.length; j++) edges[pairKey(down[j - 1], down[j])] = 'done';
      }
      st[selected] = 'pivot';
      return {
        root: tree.root, edges: edges,
        nodes: tree.order.map(function (id) {
          var n = tree.nodes[id], o = { id: id, value: n.value, left: n.left, right: n.right, state: st[id] || 'default' };
          if (mode === 'depth') { o.badge = String(dmap[id]); if (id === selected) o.sub = 'height ' + f.height; }
          return o;
        })
      };
    }
    function list(ids) { return ids.length ? ids.map(function (i) { return tree.nodes[i].value; }).join(', ') : 'none'; }
    function facts() {
      var f = A.vocabFacts(tree, selected), v = tree.nodes[selected].value;
      var cells = [
        ['Parent', f.parent === null ? 'none: it is the root' : tree.nodes[f.parent].value],
        ['Children', f.children.length ? list(f.children) : 'none: it is a leaf'],
        ['Siblings', f.siblings.length ? list(f.siblings) : 'none'],
        ['Depth', f.depth + (f.depth === 1 ? ' link from the root' : ' links from the root')],
        ['Height', f.height + (f.height === 1 ? ' link down to the deepest leaf' : ' links down to the deepest leaf')],
        ['Level', 'level ' + f.depth + ': ' + list(f.level)],
        ['Subtree size', f.subtreeSize + (f.subtreeSize === 1 ? ' node (just itself)' : ' nodes, itself included')],
        ['Ancestors', list(f.ancestors)]
      ];
      VDSA_clear(factsEl);
      cells.forEach(function (c) { factsEl.appendChild(h('div', { class: 'tr-fact' }, h('dt', null, c[0]), h('dd', null, String(c[1])))); });
      caption.innerHTML = '<b>' + V.escape(String(v)) + '</b>: ' + (f.parent === null ? 'the root' : 'child of <b>' + V.escape(String(tree.nodes[f.parent].value)) + '</b>') +
        ', ' + (f.leaf ? 'a leaf' : f.children.length + (f.children.length === 1 ? ' child' : ' children')) + ', depth <b>' + f.depth + '</b>, height <b>' + f.height + '</b>.';
    }
    function VDSA_clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
    function draw(d) { view.render(state(), { duration: d === undefined ? 380 : d }); facts(); }
    var all = [];
    ['family', 'lineage', 'depth', 'level'].forEach(function (m) { mode = m; all.push(state()); });
    mode = 'family';
    view.prepare(all);
    legend(fig, LEGENDS.family);
    draw(0);
    V.segmented(fig.querySelector('[data-seg]'), {
      label: 'Highlight', value: 'family',
      options: [{ value: 'family', label: 'Family' }, { value: 'lineage', label: 'Ancestors and descendants' }, { value: 'depth', label: 'Depth and height' }, { value: 'level', label: 'Level' }],
      onChange: function (m) { mode = m; legend(fig, LEGENDS[m]); draw(360); }
    });
  }

  /* ================================================================== shape gallery */
  function shapeGallery() {
    var fig = V.$('#fig-shapes');
    if (!fig) return;
    var shapes = {
      perfect: { tree: A.perfect(2), note: 'Every level is completely full.' },
      complete: { tree: A.complete(6), note: 'Every level is full except the last, which fills from the left.' },
      full: { tree: A.fullNotComplete(), note: 'Every node has 0 or 2 children, but the bottom level has a gap.' },
      degenerate: { tree: A.degenerate(5, 'right'), note: 'Every node has one child: a linked list in disguise.' }
    };
    legend(fig, [{ state: 'done', label: 'leaf' }, { state: 'default', label: 'node with children' }]);
    Object.keys(shapes).forEach(function (k) {
      var host = fig.querySelector('[data-mini="' + k + '"]'), s = shapes[k], t = s.tree;
      var st = {};
      t.order.forEach(function (id) { if (t.nodes[id].left === null && t.nodes[id].right === null) st[id] = 'done'; });
      L.mini(host, t, { states: st, nodeSize: 30, gap: 0.5, label: k + ' binary tree with ' + A.size(t) + ' nodes and height ' + A.height(t) });
      var info = A.shapeInfo(t), tags = ['full', 'complete', 'perfect', 'degenerate'].filter(function (x) { return info[x]; });
      var cap = fig.querySelector('[data-cap="' + k + '"]');
      cap.appendChild(h('span', { class: 'tr-shape__nh' }, 'n = ' + info.n + ', height = ' + info.height));
      cap.appendChild(h('span', { class: 'tr-shape__tags' }, tags.length ? tags.map(function (x) { return h('span', { class: 'chip chip--sm' }, x); }) : null));
      cap.appendChild(h('span', { class: 'tr-shape__note' }, s.note));
    });
  }

  heroTeaser();
  nearView(V.$('#fig-real'), realTrees);
  nearView(V.$('#fig-grow'), growFigure);
  nearView(V.$('#fig-vocab'), vocabFigure);
  nearView(V.$('#fig-shapes'), shapeGallery);
}());
