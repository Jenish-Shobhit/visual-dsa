/* Gallery demos: VDSA.views.array */
(function () {
  'use strict';
  var G = Gallery;

  function itemsOf(a, stateFn) { return a.map(function (it, k) { return { id: it.id, value: it.value, state: stateFn ? stateFn(k, it) || 'default' : 'default' }; }); }

  /* ---------- bubble sort (bars + boxes) ---------- */
  function bubbleSteps(values) {
    var a = values.map(function (v, i) { return { id: 'b' + i, value: v }; });
    var steps = [], sorted = a.length;
    function snap(mark, ptrs, caption) {
      steps.push({
        items: itemsOf(a, function (k) { return k >= sorted ? 'done' : mark[k]; }),
        pointers: ptrs,
        regions: sorted < a.length ? [{ from: sorted, to: a.length - 1, state: 'done', label: 'sorted' }] : [],
        caption: caption
      });
    }
    snap({}, [], 'Unsorted input.');
    for (var end = a.length - 1; end > 0; end--) {
      var swapped = false;
      for (var j = 0; j < end; j++) {
        var m = {}; m[j] = 'compare'; m[j + 1] = 'compare';
        var ptrs = [{ name: 'j', index: j }, { name: 'j+1', index: j + 1, state: 'compare' }];
        snap(m, ptrs, 'Compare a[' + j + ']=' + a[j].value + ' with a[' + (j + 1) + ']=' + a[j + 1].value + '.');
        if (a[j].value > a[j + 1].value) {
          var t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; swapped = true;
          var s = {}; s[j] = 'swap'; s[j + 1] = 'swap';
          snap(s, ptrs, 'Out of order, so they trade places.');
        }
      }
      sorted = end;
      if (!swapped) { sorted = 0; break; }
    }
    sorted = 0;
    snap({}, [], 'Every element is in its final place.');
    return steps;
  }

  G.demo('array', {
    id: 'bubble-bars', title: 'Bubble sort — bars with arcing swaps',
    note: 'mode: "bars". Swapped bars arc (one up, one down); the sorted region grows from the right.',
    duration: 520, hold: 260,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'bars', label: 'Bubble sort bars' });
      var steps = bubbleSteps([38, 12, 55, 27, 70, 5, 44, 19, 62, 31]);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  G.demo('array', {
    id: 'bubble-boxes', title: 'Bubble sort — boxes',
    note: 'mode: "boxes" with index labels and pointers j, j+1.',
    duration: 560, hold: 320,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'boxes', label: 'Bubble sort boxes' });
      var steps = bubbleSteps([5, 1, 4, 2, 8, 3]);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- insertion sort with a held key ---------- */
  function insertionSteps(values) {
    var slots = values.map(function (v, i) { return { id: 'n' + i, value: v }; });
    var steps = [], sortedTo = 0;
    function snap(o) {
      var items = [];
      slots.forEach(function (it, k) {
        if (!it) return;
        items.push({ id: it.id, value: it.value, index: k, state: (o.mark && o.mark[k]) || (k <= sortedTo ? 'done' : 'default') });
      });
      steps.push({
        items: items, held: o.held || null, ghosts: o.hole !== undefined ? [o.hole] : [],
        pointers: o.ptrs || [], regions: [{ from: 0, to: sortedTo, state: 'done', label: 'sorted prefix' }],
        caption: o.caption
      });
    }
    snap({ caption: 'The first element alone is a sorted prefix.' });
    for (var i = 1; i < slots.length; i++) {
      var key = slots[i];
      slots[i] = null;
      var held = { id: key.id, value: key.value, over: i, state: 'key' };
      snap({ held: held, hole: i, ptrs: [{ name: 'i', index: i, state: 'key' }], caption: 'Lift key = ' + key.value + ' out of slot ' + i + '.' });
      var j = i - 1;
      while (j >= 0) {
        var m = {}; m[j] = 'compare';
        snap({ held: { id: key.id, value: key.value, over: j + 1, state: 'key' }, hole: j + 1, mark: m, ptrs: [{ name: 'j', index: j, state: 'compare' }], caption: 'Is ' + slots[j].value + ' > ' + key.value + '?' });
        if (slots[j].value <= key.value) break;
        slots[j + 1] = slots[j]; slots[j] = null;
        var m2 = {}; m2[j + 1] = 'swap';
        snap({ held: { id: key.id, value: key.value, over: j, state: 'key' }, hole: j, mark: m2, ptrs: [{ name: 'j', index: j, state: 'compare' }], caption: 'Yes: shift ' + slots[j + 1].value + ' one slot right.' });
        j--;
      }
      slots[j + 1] = key;
      sortedTo = i;
      var m3 = {}; m3[j + 1] = 'key';
      snap({ mark: m3, ptrs: [{ name: 'j+1', index: j + 1, state: 'key' }], caption: 'Drop the key into the gap at index ' + (j + 1) + '.' });
    }
    snap({ caption: 'Sorted.' });
    return steps;
  }

  G.demo('array', {
    id: 'insertion', title: 'Insertion sort — held key',
    note: 'held: {id, value, over} lifts the key above the row; ghosts mark the hole; items shift without arcs.',
    duration: 560, hold: 360,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'boxes', label: 'Insertion sort', reserve: { held: true } });
      var steps = insertionSteps([7, 3, 9, 1, 5, 2]);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- merge sort with an aux row ---------- */
  function mergeAuxSteps(values) {
    var main = values.map(function (v, i) { return { id: 'm' + i, value: v }; });
    var aux = values.map(function () { return null; });
    var steps = [];
    function snap(o) {
      var mItems = [], aItems = [];
      main.forEach(function (it, k) { if (it) mItems.push({ id: it.id, value: it.value, index: k, state: (o.mm && o.mm[it.id]) || (o.doneAll ? 'done' : 'default') }); });
      aux.forEach(function (it, k) { if (it) aItems.push({ id: it.id, value: it.value, index: k, state: (o.am && o.am[it.id]) || 'default' }); });
      steps.push({
        rows: [
          { id: 'main', label: 'a', items: mItems, length: values.length, regions: o.region ? [o.region] : [] },
          { id: 'aux', label: 'temp', items: aItems, length: values.length }
        ],
        pointers: o.ptrs || [], caption: o.caption
      });
    }
    snap({ caption: 'Split until runs have one element, then merge neighbours through temp.' });
    function sort(lo, hi) {
      if (hi <= lo) return;
      var mid = (lo + hi) >> 1;
      sort(lo, mid); sort(mid + 1, hi);
      var region = { from: lo, to: hi, state: 'active', label: 'merge ' + lo + '…' + hi };
      for (var k = lo; k <= hi; k++) { aux[k] = main[k]; main[k] = null; }
      snap({ region: region, caption: 'Copy a[' + lo + '…' + hi + '] down into temp.' });
      var i = lo, j = mid + 1;
      for (k = lo; k <= hi; k++) {
        var takeLeft = j > hi || (i <= mid && aux[i].value <= aux[j].value);
        var am = {};
        if (i <= mid) am[aux[i].id] = 'compare';
        if (j <= hi) am[aux[j].id] = 'compare';
        var ptrs = [{ name: 'i', row: 'aux', index: i, state: 'compare' }, { name: 'j', row: 'aux', index: j, state: 'compare' }, { name: 'k', row: 'main', index: k, side: 'above', state: 'swap' }];
        snap({ region: region, am: am, ptrs: ptrs, caption: i <= mid && j <= hi ? 'Compare ' + aux[i].value + ' and ' + aux[j].value + '.' : 'One side is empty; take from the other.' });
        var src = takeLeft ? i++ : j++;
        main[k] = aux[src]; aux[src] = null;
        var mm = {}; mm[main[k].id] = 'swap';
        snap({ region: region, mm: mm, ptrs: [{ name: 'i', row: 'aux', index: i, state: 'compare' }, { name: 'j', row: 'aux', index: j, state: 'compare' }, { name: 'k', row: 'main', index: k, side: 'above', state: 'swap' }], caption: 'Write ' + main[k].value + ' back to a[' + k + '].' });
      }
    }
    sort(0, values.length - 1);
    snap({ doneAll: true, caption: 'Merged: the whole array is sorted.' });
    return steps;
  }

  G.demo('array', {
    id: 'merge-aux', title: 'Merge sort — items travel between rows', wide: true,
    note: 'rows: [{id:"main"}, {id:"aux", label:"temp"}]. The same item id moving between rows glides; row pointers (i, j in temp, k above main).',
    duration: 520, hold: 240,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'boxes', label: 'Merge sort with a temp row', cellSize: 46 });
      var steps = mergeAuxSteps([6, 2, 7, 3, 8, 1, 5, 4]);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- merge sort recursion levels with breaks ---------- */
  function mergeLevelSteps(values) {
    var n = values.length, depth = Math.ceil(Math.log2(n));
    var where = values.map(function (v, i) { return { id: 'L' + i, value: v, level: 0, slot: i, state: 'default' }; });
    var steps = [];
    function breaksFor(level) {
      var size = n / Math.pow(2, level), out = [];
      for (var b = size; b < n; b += size) out.push(b);
      return level === 0 ? [] : out;
    }
    function snap(caption) {
      var rows = [];
      for (var l = 0; l <= depth; l++) rows.push({ id: 'lvl' + l, items: [], breaks: breaksFor(l), showIndices: false });
      where.forEach(function (w) { rows[w.level].items.push({ id: w.id, value: w.value, index: w.slot, state: w.state }); });
      steps.push({ rows: rows, caption: caption });
    }
    snap('Level 0: the whole array.');
    function split(lo, hi, level) {
      if (hi - lo < 1) { where[idx(lo)].state = 'done'; return; }
      var mid = (lo + hi) >> 1;
      for (var k = lo; k <= hi; k++) { var w = byslot(k, level); w.level = level + 1; }
      snap('Split [' + lo + '…' + hi + '] into two halves.');
      split(lo, mid, level + 1); split(mid + 1, hi, level + 1);
      // merge back up to `level`
      var run = [];
      for (k = lo; k <= hi; k++) run.push(byslot(k, level + 1));
      run.sort(function (a, b) { return a.value - b.value; });
      run.forEach(function (w, t) { w.level = level; w.slot = lo + t; w.state = level === 0 ? 'done' : 'active'; });
      snap('Merge [' + lo + '…' + hi + '] in sorted order.');
      run.forEach(function (w) { if (level !== 0) w.state = 'default'; });
    }
    function idx(slot) { for (var i = 0; i < where.length; i++) if (where[i].slot === slot) return i; return 0; }
    function byslot(slot, level) { for (var i = 0; i < where.length; i++) if (where[i].slot === slot && where[i].level === level) return where[i]; return where[idx(slot)]; }
    split(0, n - 1, 0);
    return steps;
  }

  G.demo('array', {
    id: 'merge-levels', title: 'Merge sort — recursion levels with breaks',
    note: 'Rows are recursion levels; row.breaks opens gaps between runs so items drop into halves and rise back sorted.',
    duration: 650, hold: 350,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'boxes', label: 'Merge sort levels', cellSize: 40, showIndices: false });
      var steps = mergeLevelSteps([5, 2, 7, 1, 8, 3, 6, 4]);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- binary search: dots + regions + muted ---------- */
  function binarySteps(values, target) {
    var steps = [], lo = 0, hi = values.length - 1;
    function snap(mid, caption, found) {
      steps.push({
        items: values.map(function (v, k) { return { id: 'd' + k, value: v, state: found && k === mid ? 'found' : k === mid ? 'compare' : (k < lo || k > hi) ? 'muted' : 'default' }; }),
        pointers: [{ name: 'lo', index: lo, state: 'active' }, { name: 'hi', index: hi, state: 'active' }].concat(mid !== null ? [{ name: 'mid', index: mid, state: found ? 'found' : 'compare', side: 'above' }] : []),
        regions: lo <= hi ? [{ from: lo, to: hi, state: 'active', label: 'search range' }] : [],
        caption: caption
      });
    }
    snap(null, 'Looking for ' + target + ' in a sorted array.');
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      snap(mid, 'mid = ' + mid + ': compare ' + values[mid] + ' with ' + target + '.');
      if (values[mid] === target) { snap(mid, 'Found ' + target + ' at index ' + mid + '.', true); return steps; }
      if (values[mid] < target) lo = mid + 1; else hi = mid - 1;
      snap(null, values[mid] < target ? 'Too small: discard the left half.' : 'Too big: discard the right half.');
    }
    return steps;
  }

  G.demo('array', {
    id: 'binary-dots', title: 'Binary search — dots, muted halves, pointers above and below',
    note: 'mode: "dots". Out-of-range items use state "muted"; mid points from above.',
    duration: 520, hold: 520,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'dots', label: 'Binary search' });
      var steps = binarySteps([2, 5, 8, 12, 16, 23, 38, 45, 56, 72, 91], 56);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- memory-style array with addresses ---------- */
  G.demo('array', {
    id: 'addresses', title: 'Array in memory — addresses, chip pointers, badges, sub-labels',
    note: 'showAddresses with baseAddress/elementSize; item.label adds a second line; item.badge adds a corner pill.',
    duration: 480, hold: 700,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'boxes', showAddresses: true, baseAddress: 0x7ff0, elementSize: 4, pointerStyle: 'chip', cellSize: 56, label: 'Array with addresses' });
      var vals = [12, 7, 7, 30, 4];
      var steps = [];
      for (var k = 0; k <= vals.length; k++) {
        steps.push({
          items: vals.map(function (v, i) { return { id: 'x' + i, value: v, label: i === 1 ? 'a' : i === 2 ? 'b' : undefined, badge: i === k ? '×' + (i + 1) : undefined, state: i === k ? 'active' : i < k ? 'visited' : 'default' }; }),
          pointers: k < vals.length ? [{ name: 'p', index: k, state: 'active' }] : [{ name: 'end', index: k, state: 'default' }],
          caption: k < vals.length ? 'a[' + k + '] lives at base + ' + k + ' × 4 bytes.' : 'One past the end: index ' + k + ' is outside the array.'
        });
      }
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- counting sort: three rows, items spawn from others ---------- */
  G.demo('array', {
    id: 'counting', title: 'Counting sort — input, counts, output (items spawn from a source)', wide: true,
    note: 'Three rows with indexLabels; output copies use item.from to fly out of the input cell they copy.',
    duration: 520, hold: 260,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'boxes', cellSize: 40, label: 'Counting sort' });
      var input = [3, 1, 4, 1, 3, 0, 2, 3];
      var K = 5, count = [0, 0, 0, 0, 0], out = [];
      var steps = [];
      function snap(o) {
        steps.push({
          rows: [
            { id: 'in', label: 'input', items: input.map(function (v, i) { return { id: 'in' + i, value: v, state: o.inMark === i ? 'active' : 'default' }; }) },
            { id: 'count', label: 'count', items: count.map(function (c, v) { return { id: 'c' + v, value: c, state: o.cMark === v ? 'swap' : 'default' }; }), indexLabels: [0, 1, 2, 3, 4] },
            { id: 'out', label: 'output', length: input.length, items: out.map(function (e, i) { return e ? { id: e.id, value: e.value, index: i, from: e.from, state: e.fresh ? 'swap' : 'done' } : null; }) }
          ],
          pointers: o.ptrs || [], caption: o.caption
        });
      }
      snap({ caption: 'Count how many times each value appears.' });
      input.forEach(function (v, i) { count[v]++; snap({ inMark: i, cMark: v, ptrs: [{ name: 'i', row: 'in', index: i }], caption: 'Saw ' + v + ': count[' + v + '] becomes ' + count[v] + '.' }); });
      var pos = 0;
      for (var v = 0; v < K; v++) {
        while (count[v] > 0) {
          var srcIdx = -1;
          for (var s = 0; s < input.length; s++) if (input[s] === v && !out.some(function (e) { return e && e.src === s; })) { srcIdx = s; break; }
          out.forEach(function (e) { if (e) e.fresh = false; });
          out[pos] = { id: 'o' + pos, value: v, from: 'in' + srcIdx, src: srcIdx, fresh: true };
          count[v]--;
          snap({ cMark: v, inMark: srcIdx, ptrs: [{ name: 'out', row: 'out', index: pos, state: 'swap' }], caption: 'Write ' + v + ' to output[' + pos + '].' });
          pos++;
        }
      }
      out.forEach(function (e) { if (e) e.fresh = false; });
      snap({ caption: 'Output is sorted.' });
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- cells mode, many items ---------- */
  G.demo('array', {
    id: 'cells', title: 'Selection sort — 32 cells, compact mode',
    note: 'mode: "cells" for long arrays: colour carries the state; values hide automatically when cells get small.',
    duration: 380, hold: 120,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'cells', label: 'Selection sort cells', showIndices: false });
      var rnd = VDSA.rng(7), a = [];
      for (var i = 0; i < 32; i++) a.push({ id: 'c' + i, value: rnd.int(1, 99) });
      var steps = [];
      function snap(mark, sorted, ptrs) { steps.push({ items: itemsOf(a, function (k) { return k < sorted ? 'done' : mark[k]; }), pointers: ptrs }); }
      for (i = 0; i < a.length - 1; i++) {
        var min = i;
        for (var j = i + 1; j < a.length; j++) if (a[j].value < a[min].value) min = j;
        var m = {}; m[i] = 'compare'; m[min] = 'pivot';
        snap(m, i, [{ name: 'i', index: i }, { name: 'min', index: min, state: 'pivot', side: 'above' }]);
        var t = a[i]; a[i] = a[min]; a[min] = t;
        var s = {}; s[i] = 'swap'; s[min] = 'swap';
        snap(s, i, [{ name: 'i', index: i }, { name: 'min', index: min, state: 'pivot', side: 'above' }]);
      }
      snap({}, a.length, []);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });
  /* ---------- naive string matching: a pattern row slides via offset ---------- */
  G.demo('array', {
    id: 'pattern', title: 'String matching — the pattern row slides (row.offset)', wide: true,
    note: 'Changing a row\'s offset glides the whole row; indexStart keeps pattern indices 0…m−1; states mark matches and the mismatch.',
    duration: 480, hold: 380,
    build: function (host) {
      var view = VDSA.views.array(host, { mode: 'boxes', cellSize: 38, label: 'Naive string matching' });
      var text = 'ABABCABAB', pat = 'ABAB', steps = [];
      function snap(s, j, st, caption, found) {
        steps.push({
          rows: [
            { id: 'text', label: 'text', items: text.split('').map(function (c, i) {
              var inWin = i >= s && i < s + pat.length;
              return { id: 't' + i, value: c, state: found && found.indexOf(i) !== -1 ? 'found' : (inWin && i - s < j) ? 'done' : (inWin && i - s === j) ? st : 'default' };
            }) },
            { id: 'pat', label: 'pattern', offset: s, indexStart: 0, items: pat.split('').map(function (c, k) {
              return { id: 'p' + k, value: c, state: k < j ? 'done' : k === j ? st : 'default' };
            }) }
          ],
          pointers: [{ name: 's', row: 'text', index: s, side: 'above', state: 'active' }],
          regions: [{ row: 'text', from: s, to: s + pat.length - 1, state: 'active', label: 'window' }],
          caption: caption
        });
      }
      var found = [];
      for (var s = 0; s + pat.length <= text.length; s++) {
        var j = 0;
        while (j < pat.length) {
          var ok = text[s + j] === pat[j];
          snap(s, j, ok ? 'compare' : 'error', 'Compare text[' + (s + j) + ']=' + text[s + j] + ' with pattern[' + j + ']=' + pat[j] + (ok ? ': match.' : ': mismatch, slide by one.'), found);
          if (!ok) break;
          j++;
        }
        if (j === pat.length) { for (var k = 0; k < pat.length; k++) found.push(s + k); snap(s, j, 'done', 'Full match at shift ' + s + '.', found); }
      }
      view.prepare(steps);
      return { steps: steps, render: function (st, c) { view.render(st, { duration: c.duration }); } };
    }
  });
}());
