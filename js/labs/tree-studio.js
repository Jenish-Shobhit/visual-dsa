/* Tree studio (labs/tree-studio.html): the UI around js/labs/tree-studio-model.js.

   Every operation is run by the tested lesson generators (through the model), turned into "composite steps" (one frame
   per pane) and played by VDSA.player, so step, play, scrub and speed all work. One pane in single mode, three
   (BST, AVL, red-black) in compare mode; a shorter pane simply holds its last frame while a longer one finishes.

   Parts: 1 setup and helpers · 2 panes · 3 side panels (sequences, height chart) · 4 operations, undo, URL · 5 boot. */
(function () {
  'use strict';
  var V = window.VDSA, M = V && V.labs && V.labs.treeStudio;
  if (!V || !M || !V.views || !V.views.tree || !V.player) { console.error('[tree studio] engine or model missing'); return; }
  var h = V.h, s = V.s, $ = V.$;
  var CUR = window.VDSA_CURRICULUM;
  var root = $('#studio');

  /* ================================================================ 1. Setup */
  var COMPARE = ['bst', 'avl', 'rb'];
  var LINE = { bst: 'var(--st-frontier)', avl: 'var(--st-done)', rb: 'var(--st-active)', minheap: 'var(--accent)', maxheap: 'var(--accent)', trie: 'var(--accent)' };
  var mode = { kind: 'bst', compare: false, instant: false };
  var panes = [];           // {kind, S, view, el, chips, cap}
  var undoStack = [];
  var player = null;
  var cur = null;           // frames on screen
  var rng = V.rng(Date.now() % 2147483647);

  var el = {
    kind: $('[data-kind]', root), compare: $('[data-compare]', root), instant: $('[data-instant]', root),
    value: $('[data-value]', root), valueLabel: $('[data-value-label]', root), msg: $('[data-msg]', root),
    panes: $('[data-panes]', root), seq: $('[data-seq]', root), seqTitle: $('[data-seq-title]', root), seqNote: $('[data-seq-note]', root),
    spark: $('[data-spark]', root), sparkKey: $('[data-spark-key]', root),     undo: $('[data-act="undo"]', root), extract: $('[data-op="extract"]', root), extractWord: $('[data-extract-word]', root)
  };

  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function setMsg(text, kind) {
    el.msg.textContent = text || '';
    el.msg.setAttribute('data-kind', kind || '');
    if (kind === 'error') el.value.setAttribute('aria-invalid', 'true'); else el.value.removeAttribute('aria-invalid');
  }
  function lessonLink(id, label) {
    var l = CUR && CUR.byId ? CUR.byId(id) : null;
    var num = id.slice(0, 2);
    if (l && l.status === 'live') return h('a', { class: 'ts-lesson__a', href: V.url('lessons/' + id + '.html') }, label || ('Lesson ' + num + ': ' + l.title), h('span', { 'aria-hidden': 'true' }, ' →'));
    return h('span', { class: 'ts-lesson__a is-soon' }, (label || ('Lesson ' + num)) + ' (coming soon)');
  }
  function kindLabel(k) { return M.KINDS[k].label; }
  function wordy() { return M.KINDS[mode.kind].word && !mode.compare; }

  /* ================================================================ 2. Panes */
  var CHIPS = [
    { key: 'height', label: 'Height', title: 'Links on the longest root-to-node path (−1 for an empty tree)' },
    { key: 'nodes', label: 'Nodes' },
    { key: 'cmp', label: 'Comparisons', title: 'Total comparisons since the last clear' },
    { key: 'rot', label: 'Rotations', title: 'Rotations since the last clear' },
    { key: 'recol', label: 'Recolours', title: 'Colour flips since the last clear' }
  ];
  function chipDefs(kind) {
    return CHIPS.filter(function (c) {
      if (c.key === 'rot') return kind !== 'bst' || mode.compare ? kind !== 'trie' : false;
      if (c.key === 'recol') return kind === 'rb';
      return true;
    }).map(function (c) {
      if (c.key === 'rot' && M.isHeap(kind)) return { key: 'rot', label: 'Swaps', title: 'Swaps since the last clear' };
      if (c.key === 'cmp' && kind === 'trie') return { key: 'cmp', label: 'Nodes visited', title: 'Trie nodes visited since the last clear' };
      return c;
    });
  }

  function buildPanes(kinds, states) {
    panes.forEach(function (p) { try { p.view.destroy(); } catch (e) { /* ignore */ } });
    V.clear(el.panes);
    el.panes.setAttribute('data-count', String(kinds.length));
    panes = kinds.map(function (k, i) {
      var chips = {}, chipRow = h('div', { class: 'ts-chips' });
      chipDefs(k).forEach(function (c) {
        var val = h('span', { class: 'ts-chip__v' }, '0');
        chips[c.key] = { val: val, text: '0' };
        chipRow.appendChild(h('div', { class: 'ts-stat', title: c.title || null }, h('span', { class: 'ts-stat__l' }, c.label), val));
      });
      var hint = h('p', { class: 'ts-pane__hint', hidden: true }, 'Nothing here yet. Type a value above, or ',
        h('button', { class: 'ts-pane__try', type: 'button', onclick: function () { var b = $('[data-bulk="random"]', root); if (b) b.click(); } }, M.KINDS[k].word ? 'insert 5 random words' : 'insert 10 random numbers'));
      var viewEl = h('div', { class: 'ts-pane__view' }, hint);
      var cap = h('p', { class: 'ts-pane__cap', 'aria-live': 'off' });
      var lesson = h('span', { class: 'ts-pane__lesson' }, lessonLink(M.KINDS[k].lesson, kinds.length > 1 ? 'Lesson ' + M.KINDS[k].lesson.slice(0, 2) : null));
      var section = h('section', { class: 'ts-pane', 'data-kind': k, 'aria-label': M.KINDS[k].name },
        h('header', { class: 'ts-pane__head' }, h('h3', { class: 'ts-pane__name' }, M.KINDS[k].name), lesson, chipRow),
        viewEl, cap);
      el.panes.appendChild(section);
      var view = V.views.tree(viewEl, { label: M.KINDS[k].name, nodeSize: kinds.length > 1 ? 32 : 40, minNodeSize: 10 });
      return { kind: k, S: states ? states[i] : M.create(k), view: view, el: section, chips: chips, cap: cap, hint: hint };
    });
  }

  function updateChips(p, f) {
    var vals = { height: f.height < 0 ? '—' : f.height, nodes: f.nodes, cmp: f.cmp, rot: f.rot, recol: f.recol };
    Object.keys(p.chips).forEach(function (k) {
      var c = p.chips[k], t = String(vals[k]);
      if (c.text !== t) {
        c.text = t; c.val.textContent = t;
        var box = c.val.parentNode; box.classList.remove('is-bump'); void box.offsetWidth; box.classList.add('is-bump');
      }
    });
  }

  /* Node size follows the number of levels: a three-level tree gets big nodes (readable balance labels), a deep one
     falls back to the compact size. The view still shrinks nodes further when the width runs out. */
  function levelsOf(view) {
    if (!view || !view.nodes || !view.nodes.length) return 0;
    var map = {}, best = 0;
    view.nodes.forEach(function (n) { map[n.id] = n; });
    (function walk(id, d) {
      var n = map[id]; if (!n || d > 40) return;
      if (d > best) best = d;
      if (n.children) n.children.forEach(function (c) { walk(c, d + 1); });
      else { if (n.left !== undefined && n.left !== null) walk(n.left, d + 1); if (n.right !== undefined && n.right !== null) walk(n.right, d + 1); }
    }(view.root, 1));
    return best;
  }
  function nodeSizeFor(levels) {
    var table = mode.compare ? [46, 46, 46, 42, 38, 34, 32] : [76, 76, 72, 66, 58, 50, 44];
    return table[Math.min(Math.max(levels, 0), table.length - 1)];
  }

  function render(step, ctx) {
    var dur = ctx && !ctx.instant ? ctx.duration : 0;
    var lv = 0;
    step.panes.forEach(function (f) { if (f) lv = Math.max(lv, levelsOf(f.view)); });
    var empty = step.panes.every(function (f) { return !f || !f.nodes; });
    var want = empty ? 40 : nodeSizeFor(lv);           /* the empty-state hint sits over the middle of the stage */
    panes.forEach(function (p, i) {
      var f = step.panes[i];
      if (!f) return;
      if (p.nodeSize !== want) { p.nodeSize = want; p.view.setOptions({ nodeSize: want }); }
      p.view.render(f.view, { duration: dur });
      updateChips(p, f);
      p.hint.hidden = f.nodes > 0;
      if (mode.compare) p.cap.innerHTML = f.caption || '';
    });
    cur = step.panes;
    updateSeq(step.panes);
  }

  function compose(lists, summary) {
    var n = Math.max.apply(null, lists.map(function (l) { return l.length; }));
    var steps = [];
    for (var i = 0; i < n; i++) {
      var fs = lists.map(function (l) { return l[Math.min(i, l.length - 1)]; });
      steps.push({ panes: fs, caption: mode.compare ? summary : fs[0].caption });
    }
    return steps;
  }
  function restingStep(caption) {
    var fs = panes.map(function (p) { return M.idle(p.S); });
    return { panes: fs, caption: caption || '' };
  }

  /* ================================================================ 3. Side panels */
  var seqSig = '';
  function chipEls(items, opts) {
    opts = opts || {};
    return items.map(function (it, i) {
      return h('span', { class: 'ts-chip is-' + (it.state || 'default') }, opts.index ? h('sup', { class: 'ts-chip__i' }, String(i)) : null, it.label);
    });
  }
  function seqRow(title, items, opts) {
    var body = items.length ? chipEls(items, opts) : [h('span', { class: 'ts-seq__empty' }, 'empty')];
    return h('div', { class: 'ts-seq__row' }, h('span', { class: 'ts-seq__k' }, title), h('div', { class: 'ts-seq__v' }, body));
  }
  function sigOf(rows) { return rows.map(function (r) { return r[0] + ':' + r[1].map(function (i) { return i.label + '/' + i.state; }).join(','); }).join('|'); }

  function updateSeq(frames) {
    var rows = [], note = '', title = 'Sequences';
    if (mode.compare) {
      title = 'Same keys, different shapes';
      var o0 = M.orders(frames[0].view);
      rows.push(['In-order (all three)', o0.inorder]);
      panes.forEach(function (p, i) { rows.push([kindLabel(p.kind) + ' pre-order', M.orders(frames[i].view).pre]); });
      note = 'Every tree stores the same keys, so the in-order sequence is identical and sorted. The pre-order sequences differ because the shapes do.';
    } else if (M.isHeap(mode.kind)) {
      var oh = M.orders(frames[0].view);
      title = 'The heap as an array';
      rows.push(['Array, slot by slot', oh.level, true]);
      note = 'Slot i has its children in slots 2i + 1 and 2i + 2, and its parent in slot ⌊(i − 1) / 2⌋: the level-order walk of the tree is the array.';
    } else if (mode.kind === 'trie') {
      var ot = M.orders(frames[0].view);
      title = 'Words and letters';
      var words = panes[0].S.data.slice().sort().map(function (w) { return { label: w, state: 'default' }; });
      rows.push(['Words, A to Z', words]);
      rows.push(['Pre-order of the trie', ot.pre]);
      note = 'Each word is a path of letters from the root; words that share a beginning share nodes.';
    } else {
      var o = M.orders(frames[0].view);
      title = 'Traversals of this tree';
      rows.push(['In-order', o.inorder]); rows.push(['Pre-order', o.pre]); rows.push(['Post-order', o.post]); rows.push(['Level-order', o.level]);
      note = 'In-order visits left, node, right: on a search tree that is always the keys in sorted order.';
    }
    var sig = title + '#' + sigOf(rows) + '#' + mode.compare + mode.kind;
    if (sig !== seqSig) {
      seqSig = sig;
      V.clear(el.seq);
      rows.forEach(function (r) { el.seq.appendChild(seqRow(r[0], r[1], { index: !!r[2] })); });
    }
    el.seqTitle.textContent = title;
    V.clear(el.seqNote);
    el.seqNote.appendChild(document.createTextNode(note + ' '));
    if (!M.isHeap(mode.kind) && mode.kind !== 'trie') el.seqNote.appendChild(lessonLink('18-trees', 'Traversals: lesson 18'));
    else if (mode.kind === 'trie') el.seqNote.appendChild(lessonLink('22-tries', 'Tries: lesson 22'));
    else el.seqNote.appendChild(lessonLink('21-heaps', 'Heaps: lesson 21'));
  }

  /* height-over-time sparkline */
  function drawSpark() {
    var W = 360, H = 130, L = 30, R = 44, T = 10, B = 22;
    var series = panes.map(function (p) { return { kind: p.kind, h: p.S.heights, n: p.S.counts }; });
    var len = Math.max.apply(null, series.map(function (x) { return x.h.length; }).concat([0]));
    V.clear(el.spark); V.clear(el.sparkKey);
    if (!len) {
      el.spark.appendChild(h('p', { class: 'ts-spark__empty' }, 'Insert something and the height of every structure is plotted here, one point per operation.'));
      return;
    }
    var ref = series[0].n.map(function (n) { return n > 0 ? Math.floor(Math.log2(n)) : -1; });
    var all = [3];
    series.forEach(function (x) { all = all.concat(x.h); });
    if (mode.kind !== 'trie') all = all.concat(ref);
    var ymax = Math.max.apply(null, all), ymin = 0;
    var xs = function (i) { return L + (len <= 1 ? (W - L - R) / 2 : (i / (len - 1)) * (W - L - R)); };
    var ys = function (v) { return T + (1 - (Math.max(v, 0) - ymin) / (ymax - ymin || 1)) * (H - T - B); };
    var svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ts-spark__svg', role: 'img', 'aria-label': 'Height after each of ' + len + ' operations: ' + series.map(function (x) { return kindLabel(x.kind) + ' ' + x.h[x.h.length - 1]; }).join(', ') });
    var step = Math.max(1, Math.ceil(ymax / 4));
    for (var t = 0; t <= ymax; t += step) {
      svg.appendChild(s('line', { x1: L, x2: W - R, y1: ys(t), y2: ys(t), class: 'ts-spark__grid' }));
      svg.appendChild(s('text', { x: L - 6, y: ys(t) + 3.5, class: 'ts-spark__tick', 'text-anchor': 'end' }, String(t)));
    }
    svg.appendChild(s('text', { x: W - R, y: H - 5, class: 'ts-spark__tick', 'text-anchor': 'end' }, 'operation ' + len));
    svg.appendChild(s('text', { x: L, y: H - 5, class: 'ts-spark__tick', 'text-anchor': 'start' }, '1'));
    function path(vals) { return vals.map(function (v, i) { return (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1); }).join(' '); }
    if (mode.kind !== 'trie' && ref.length > 1) svg.appendChild(s('path', { d: path(ref), class: 'ts-spark__ref' }));
    series.forEach(function (x) {
      if (x.h.length > 1) svg.appendChild(s('path', { d: path(x.h), class: 'ts-spark__line', style: { stroke: LINE[x.kind] } }));
      if (x.h.length <= 40) x.h.forEach(function (v, i) { svg.appendChild(s('circle', { cx: xs(i), cy: ys(v), r: 2.2, class: 'ts-spark__dot', style: { fill: LINE[x.kind] } })); });
      var last = x.h[x.h.length - 1];
      svg.appendChild(s('text', { x: xs(x.h.length - 1) + 6, y: ys(last) + 3.5, class: 'ts-spark__last', style: { fill: LINE[x.kind] } }, String(last)));
    });
    el.spark.appendChild(svg);
    series.forEach(function (x) {
      var last = x.h[x.h.length - 1], best = x.n.length && x.n[x.n.length - 1] > 0 ? Math.floor(Math.log2(x.n[x.n.length - 1])) : -1;
      el.sparkKey.appendChild(h('li', null, h('span', { class: 'ts-swatch', style: { background: LINE[x.kind] }, 'aria-hidden': 'true' }), h('b', null, kindLabel(x.kind)), ' height ' + last + (mode.kind !== 'trie' ? ' (best possible ' + best + ')' : '')));
    });
  }

  /* ================================================================ 4. Operations, undo, URL */
  function syncUrl() {
    try {
      var q = M.encode({ kind: mode.compare ? 'bst' : mode.kind, keys: panes[0].S.keys, compare: mode.compare });
      window.history.replaceState(null, '', '?' + q);
    } catch (e) { /* file:// or sandboxed frames */ }
  }
  function syncButtons() {
    el.undo.disabled = !undoStack.length;
    var heap = M.isHeap(mode.kind) && !mode.compare;
    el.extract.hidden = !heap;
    el.extractWord.textContent = mode.kind === 'maxheap' ? 'max' : 'min';
    var del = $('[data-op="delete"]', root);
    del.disabled = heap;
    del.title = heap ? 'A heap only gives up its root: use Extract' : '';
    var w = wordy();
    el.valueLabel.textContent = w ? 'Word' : 'Value';
    el.value.placeholder = w ? 'e.g. tea' : 'e.g. 42 (or 5, 3, 8)';
    el.value.setAttribute('inputmode', w ? 'text' : 'numeric');
    $('[data-bulk="random"]', root).textContent = w ? 'Insert 5 random words' : 'Insert 10 random';
    $('[data-bulk="ordered"]', root).textContent = w ? 'Insert sample words' : 'Insert 1 to 15 in order';
  }
  function setSteps(steps, play) {
    panes.forEach(function (p, i) { p.view.prepare(steps.map(function (st) { return st.panes[i].view; })); });
    player.setSteps(steps);
    if (steps.length > 1) {
      if (play && !V.reducedMotion()) player.play();
      else player.goto(steps.length - 1, { animate: false });
    }
    drawSpark();
    el.undo.disabled = !undoStack.length;
  }
  function showResting(caption) { setSteps([restingStep(caption)], false); }

  function commit(results, opts) {
    opts = opts || {};
    var changed = results.some(function (r, i) { return r.state.data !== panes[i].S.data; });
    if (changed) undoStack.push(panes.map(function (p) { return p.S; }));
    if (undoStack.length > 60) undoStack.shift();
    panes.forEach(function (p, i) { p.S = results[i].state; });
    var lists = results.map(function (r) { return mode.instant ? r.frames.slice(-1) : r.frames; });
    setSteps(compose(lists, opts.summary || ''), !mode.instant);
    syncUrl();
  }

  function currentValue(op) {
    var raw = el.value.value;
    if (op === 'insert' && /[\s,;]/.test(raw.trim()) && raw.trim()) {
      var l = M.parseList(panes[0].kind === 'trie' ? 'trie' : 'bst', raw);
      if (l.error) { setMsg(l.error, 'error'); return null; }
      return { list: l.values };
    }
    var r = M.parseValue(panes[0].kind, raw);
    if (r.error) { setMsg(r.error, 'error'); el.value.focus(); return null; }
    return { value: r.value };
  }

  function messagesOf(results, verb, value) {
    var bad = [];
    results.forEach(function (r, i) { if (!r.ok && r.message) bad.push((panes.length > 1 ? kindLabel(panes[i].kind) + ': ' : '') + r.message); });
    return bad;
  }

  function doOp(op) {
    var v;
    if (op !== 'extract') { v = currentValue(op); if (!v) return; }
    setMsg('');
    if (v && v.list) return bulkInsert(v.list);
    var value = v ? v.value : undefined;
    var results = panes.map(function (p) { return M.run(p.S, { op: op, value: value }, { quick: mode.compare }); });
    var bad = messagesOf(results);
    var word = value === undefined ? '' : M.fmtVal(panes[0].kind, value);
    var summary = { insert: 'Insert ' + word + ' into all three trees.', delete: 'Delete ' + word + ' from all three trees.', search: 'Search for ' + word + ' in all three trees.' }[op] || '';
    commit(results, { summary: summary });
    if (bad.length) setMsg(bad.join(' '), results.every(function (r) { return !r.ok; }) ? 'note' : 'note');
    if (op === 'insert' || op === 'delete') { el.value.select(); }
  }

  function bulkInsert(values) {
    var results = panes.map(function (p) { return M.bulk(p.S, values); });
    var r0 = results[0];
    commit(results.map(function (r) { return { state: r.state, frames: r.frames, ok: true, message: '' }; }), { summary: 'Inserting ' + plural(values.length, mode.compare || !M.KINDS[mode.kind].word ? 'key' : 'word') + ' into all three trees: ' + values.join(', ') + '.' });
    var note = 'Inserted ' + plural(r0.done, wordy() ? 'word' : 'key') + '.';
    if (r0.skipped.length) note += ' Skipped ' + r0.skipped.length + ' already stored or over the size limit.';
    setMsg(note, 'note');
  }
  function bulkKind(which) {
    var k = panes[0].kind;
    var vals = which === 'random' ? M.randomValues(k, panes[0].S, wordy() ? 5 : 10, rng) : M.inOrderValues(k, panes[0].S, 15);
    if (!vals.length) { setMsg('Nothing new to insert: those keys are already stored.', 'note'); return; }
    bulkInsert(vals);
  }

  function clearAll() {
    if (!panes[0].S.keys.length && !undoStack.length) { setMsg('Already empty.', 'note'); return; }
    undoStack.push(panes.map(function (p) { return p.S; }));
    panes.forEach(function (p) { p.S = M.create(p.kind); p.view.reset(); });
    setMsg('Cleared. Undo brings it back.', 'note');
    showResting('An empty ' + (mode.compare ? 'trio of trees' : M.KINDS[mode.kind].name.toLowerCase()) + '. Insert a value to begin.');
    syncUrl();
  }
  function undo() {
    if (!undoStack.length) return;
    var prev = undoStack.pop();
    panes.forEach(function (p, i) { p.S = prev[i]; });
    setMsg('Undone.', 'note');
    showResting('Undone: back to ' + plural(M.count(panes[0].S), mode.compare || !M.KINDS[mode.kind].word ? 'key' : 'word') + '.');
    syncUrl();
  }
  function share() {
    syncUrl();
    var url = window.location.href;
    var done = function () { setMsg('Link copied. It reopens this structure with the same keys.', 'note'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { setMsg('Copy this address to share: ' + url, 'note'); });
    else setMsg('Copy this address to share: ' + url, 'note');
  }

  /* switching structure keeps the keys (when both sides take the same kind of value) so you can compare */
  function switchTo(kind, compare) {
    var keys = panes.length ? panes[0].S.keys : [];
    var oldWord = panes.length ? M.KINDS[panes[0].kind].word : false;
    var kinds = compare ? COMPARE : [kind];
    var newWord = M.KINDS[kinds[0]].word;
    if (oldWord !== newWord) keys = [];
    mode.kind = kind; mode.compare = compare;
    var states = kinds.map(function (k) { return M.replay(k, keys); });
    buildPanes(kinds, states);
    undoStack = [];
    seqSig = '';
    root.classList.toggle('is-compare', compare);
    root.setAttribute('data-kind', compare ? 'compare' : kind);
    kindSeg.set(kind);
    Array.prototype.forEach.call(el.kind.querySelectorAll('button'), function (b) { b.disabled = compare; });
    el.kind.classList.toggle('is-disabled', compare);
    syncButtons();
    setMsg('');
    showResting(keys.length ? 'Rebuilt from the same ' + plural(keys.length, 'key') + '. Insert, delete or search to see what this structure does.' : (compare ? 'Three empty trees: a plain BST, an AVL tree and a red-black tree. Every operation goes to all three.' : 'An empty ' + M.KINDS[kind].name.toLowerCase() + '. Insert a value to begin.'));
    syncUrl();
  }

  /* ================================================================ 5. Boot */
  var kindSeg, legendItems = [
    { state: 'compare', label: 'Comparing' }, { state: 'visited', label: 'On the path' }, { state: 'key', label: 'New or held' },
    { state: 'found', label: 'Found' }, { state: 'active', label: 'Rotating' }, { state: 'swap', label: 'Moving / removing' },
    { state: 'error', label: 'Out of balance' }, { state: 'done', label: 'Settled' },
    { label: 'Red node', color: 'var(--st-error)', shape: 'dot' }, { label: 'Black node', color: 'var(--ink)', shape: 'dot' }
  ];

  function boot() {
    var init = M.decode(window.location.search);
    var hasKeys = /[?&]k=/.test(window.location.search);
    var example = !hasKeys;
    if (example) init.keys = M.KINDS[init.compare ? 'bst' : init.kind].word ? M.SAMPLE_WORDS.slice(0, 6) : [50, 30, 70, 20, 40, 60, 80, 35, 65];
    V.legend($('[data-legend]', root), legendItems);
    kindSeg = V.segmented(el.kind, {
      label: 'Structure', value: init.compare ? 'bst' : init.kind,
      options: M.ORDER.map(function (k) { return { value: k, label: kindLabel(k), title: M.KINDS[k].name }; }),
      onChange: function (k) { switchTo(k, false); }
    });
    var cmpToggle = V.toggle(el.compare, { label: 'Compare BST · AVL · red-black', checked: init.compare, onChange: function (on) { switchTo(mode.kind, on); } });
    V.toggle(el.instant, { label: 'Instant (skip the animation)', checked: false, onChange: function (on) { mode.instant = on; } });

    mode.kind = init.kind; mode.compare = init.compare;
    var kinds = init.compare ? COMPARE : [init.kind];
    buildPanes(kinds, kinds.map(function (k) { return M.replay(k, init.keys); }));
    root.classList.toggle('is-compare', init.compare);
    root.setAttribute('data-kind', init.compare ? 'compare' : init.kind);
    Array.prototype.forEach.call(el.kind.querySelectorAll('button'), function (b) { b.disabled = init.compare; });
    el.kind.classList.toggle('is-disabled', init.compare);

    player = V.player({
      root: root, steps: [restingStep('')], render: render, caption: '[data-caption]',
      baseStepMs: 550, speed: 1, label: 'Tree studio step controls'
    });
    syncButtons();
    showResting(example ? 'An example to start from: nine keys already inserted. Insert, delete or search, or press Clear to begin empty.' : init.keys.length ? 'Loaded ' + plural(init.keys.length, M.KINDS[init.kind].word && !init.compare ? 'word' : 'key') + ' from the link.' : 'Insert a value to begin, or try “Insert 1 to 15 in order”.');
    void cmpToggle;

    Array.prototype.forEach.call(root.querySelectorAll('[data-op]'), function (b) { b.addEventListener('click', function () { doOp(b.getAttribute('data-op')); }); });
    Array.prototype.forEach.call(root.querySelectorAll('[data-bulk]'), function (b) { b.addEventListener('click', function () { bulkKind(b.getAttribute('data-bulk')); }); });
    $('[data-act="clear"]', root).addEventListener('click', clearAll);
    el.undo.addEventListener('click', undo);
    $('[data-act="share"]', root).addEventListener('click', share);
    el.value.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doOp('insert'); } });
    el.value.addEventListener('input', function () { if (el.value.hasAttribute('aria-invalid')) setMsg(''); });

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (document.querySelector('dialog[open]')) return;
      var k = e.key.toLowerCase();
      if (e.key === '/') { e.preventDefault(); el.value.focus(); el.value.select(); }
      else if (k === 'd' && !$('[data-op="delete"]', root).disabled) { e.preventDefault(); doOp('delete'); }
      else if (k === 's') { e.preventDefault(); doOp('search'); }
      else if (k === 'i') { e.preventDefault(); doOp('insert'); }
      else if (k === 'x' && !el.extract.hidden) { e.preventDefault(); doOp('extract'); }
      else if (k === 'u') { e.preventDefault(); undo(); }
    });
  }

  V.ready(boot);
}());
