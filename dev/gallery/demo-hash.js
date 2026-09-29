/* Gallery demos: VDSA.views.hashtable */
(function () {
  'use strict';
  var G = Gallery;
  function mod(k, m) { return ((k % m) + m) % m; }
  function clone(list, mark) {
    return list.map(function (e) { var c = Object.assign({}, e); c.state = (mark && mark[e.id]) || 'default'; return c; });
  }

  /* ---------- separate chaining: inserts travel through h(k), collisions form chains, then a search ---------- */
  function chainingSteps(keys, m, searchKey) {
    var entries = [], steps = [], fn = 'h(k) = k mod ' + m;
    function snap(o) {
      steps.push(Object.assign({ buckets: m, hashFn: fn, entries: clone(entries, o.mark) }, o.extra || {}, { caption: o.caption }));
    }
    snap({ caption: 'An empty table: ' + m + ' buckets, each the head of a (currently empty) chain.' });
    keys.forEach(function (k) {
      var id = 'k' + k, b = mod(k, m);
      snap({ extra: { incoming: { id: id, key: k, stage: 'input', op: 'insert' } }, caption: 'Insert ' + k + '.' });
      snap({ extra: { incoming: { id: id, key: k, stage: 'hash', bucket: b, op: 'insert' }, hashValue: k + ' mod ' + m + ' = ' + b }, caption: 'Hash it: ' + k + ' mod ' + m + ' = ' + b + '.' });
      var len = entries.filter(function (e) { return e.bucket === b; }).length;
      entries.push({ id: id, key: k, bucket: b });
      var mark = {}; mark[id] = 'active';
      snap({ mark: mark, extra: { hashValue: k + ' mod ' + m + ' = ' + b, bucketStates: (function () { var s = {}; s[b] = 'active'; return s; })() },
        caption: len ? 'Collision: bucket ' + b + ' is taken, so ' + k + ' joins the end of its chain.' : 'Bucket ' + b + ' was empty: ' + k + ' starts its chain.' });
    });
    if (searchKey !== undefined) {
      var id = 's' + searchKey, b = mod(searchKey, m);
      snap({ extra: { incoming: { id: id, key: searchKey, stage: 'input', op: 'search' } }, caption: 'Search for ' + searchKey + '.' });
      var hv = searchKey + ' mod ' + m + ' = ' + b;
      snap({ extra: { incoming: { id: id, key: searchKey, stage: 'hash', bucket: b, op: 'search' }, hashValue: hv }, caption: 'Only bucket ' + b + ' can hold it.' });
      var chain = entries.filter(function (e) { return e.bucket === b; });
      for (var i = 0; i < chain.length; i++) {
        var mk = {}; mk[chain[i].id] = chain[i].key === searchKey ? 'found' : 'compare';
        for (var j = 0; j < i; j++) mk[chain[j].id] = 'visited';
        snap({ mark: mk, extra: { incoming: { id: id, key: searchKey, stage: 'hash', bucket: b, op: 'search', state: chain[i].key === searchKey ? 'found' : 'key' }, hashValue: hv },
          caption: chain[i].key === searchKey ? 'Found ' + searchKey + ' after ' + (i + 1) + ' comparison' + (i ? 's' : '') + '.' : chain[i].key + ' ≠ ' + searchKey + ': follow the next pointer.' });
        if (chain[i].key === searchKey) break;
      }
    }
    return steps;
  }

  G.demo('hash', {
    id: 'hash-chaining', title: 'Separate chaining — keys travel through h(k)', wide: true,
    note: 'incoming.stage input → hash → (entry with the same id) flies to the chain end; the load meter tracks α = n/m.',
    duration: 620, hold: 380,
    build: function (host) {
      var view = VDSA.views.hashtable(host, { mode: 'chaining', label: 'Hash table with separate chaining' });
      var steps = chainingSteps([10, 24, 17, 31, 5, 45, 12], 7, 45);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- key:value pairs with string keys (compact, no hash box) ---------- */
  G.demo('hash', {
    id: 'hash-kv', title: 'Chaining with key: value pairs, updates and deletes',
    note: 'Entries show "key: value" when values exist; deleting re-routes the predecessor\'s arrow to the next entry.',
    duration: 560, hold: 520,
    build: function (host) {
      var view = VDSA.views.hashtable(host, { mode: 'chaining', showHash: false, threshold: 1, label: 'Hash map of word counts' });
      function h(s) { var t = 0; for (var i = 0; i < s.length; i++) t += s.charCodeAt(i); return t % 5; }
      var words = ['cat', 'dog', 'owl', 'bee', 'ant', 'yak'];
      var entries = [], steps = [];
      function snap(caption, mark) { steps.push({ buckets: 5, entries: clone(entries, mark), caption: caption }); }
      snap('Five buckets.');
      words.forEach(function (w, i) {
        entries.push({ id: w, key: w, value: i + 1, bucket: h(w) });
        var m = {}; m[w] = 'active';
        snap('put("' + w + '", ' + (i + 1) + ') → bucket ' + h(w) + '.', m);
      });
      var dog = entries.filter(function (e) { return e.key === 'dog'; })[0];
      dog.value = 9;
      snap('put("dog", 9) overwrites the value in place.', { dog: 'swap' });
      var bee = entries.filter(function (e) { return e.key === 'bee'; })[0];
      snap('remove("bee"): find it in bucket ' + bee.bucket + '.', { bee: 'error' });
      entries = entries.filter(function (e) { return e.key !== 'bee'; });
      snap('Unlink it: the previous arrow now points past it.');
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- open addressing: linear probing, a tombstone, a search probing past it ---------- */
  function probingSteps(keys, m, delKey, searchKey) {
    var slots = [], tomb = [], steps = [], fn = 'h(k) = k mod ' + m;
    for (var i = 0; i < m; i++) slots.push(null);
    function entries(mark) {
      var out = [];
      slots.forEach(function (e, s) { if (e) out.push({ id: e.id, key: e.key, bucket: s, state: (mark && mark[e.id]) || 'default' }); });
      return out;
    }
    function snap(o) {
      steps.push(Object.assign({ buckets: m, hashFn: fn, entries: entries(o.mark), tombstones: tomb.slice() }, o.extra || {}, { caption: o.caption }));
    }
    snap({ caption: 'Open addressing: every key lives in the slot array itself.' });
    keys.forEach(function (k) {
      var id = 'k' + k, home = mod(k, m), hv = k + ' mod ' + m + ' = ' + home;
      snap({ extra: { incoming: { id: id, key: k, stage: 'input', op: 'insert' } }, caption: 'Insert ' + k + '.' });
      var probe = [];
      for (var p = 0; p < m; p++) {
        var s = (home + p) % m;
        probe.push(s);
        var occupied = !!slots[s];
        var mark = {}; if (occupied) mark[slots[s].id] = 'compare';
        snap({ mark: mark, extra: { incoming: { id: id, key: k, stage: 'hash', bucket: s, op: 'insert' }, hashValue: hv, probe: { slots: probe.slice(), current: s, state: occupied ? 'compare' : 'active' } },
          caption: p === 0 ? (occupied ? 'Home slot ' + s + ' is taken by ' + slots[s].key + '.' : 'Home slot ' + s + ' is free.') : (occupied ? 'Slot ' + s + ' is taken too: keep probing.' : 'Slot ' + s + ' is free.') });
        if (!occupied) {
          slots[s] = { id: id, key: k };
          var m2 = {}; m2[id] = 'active';
          snap({ mark: m2, extra: { hashValue: hv, probe: probe.length > 1 ? { slots: probe.slice(), current: s, state: 'active' } : undefined }, caption: k + ' goes into slot ' + s + (probe.length > 1 ? ' after ' + probe.length + ' probes.' : '.') });
          break;
        }
      }
    });
    // delete: leave a tombstone
    var ds = slots.findIndex(function (e) { return e && e.key === delKey; });
    var dm = {}; dm['k' + delKey] = 'error';
    snap({ mark: dm, caption: 'delete(' + delKey + '): found in slot ' + ds + '.' });
    slots[ds] = null; tomb.push(ds);
    snap({ caption: 'Leave a tombstone (†) so later searches keep probing past this slot.' });
    // search probing past the tombstone
    var sid = 's' + searchKey, home = mod(searchKey, m), hv2 = searchKey + ' mod ' + m + ' = ' + home, probe = [];
    snap({ extra: { incoming: { id: sid, key: searchKey, stage: 'input', op: 'search' } }, caption: 'Search for ' + searchKey + '.' });
    for (var q = 0; q < m; q++) {
      var s2 = (home + q) % m;
      probe.push(s2);
      var e = slots[s2], mk = {};
      var found = e && e.key === searchKey;
      if (e) mk[e.id] = found ? 'found' : 'compare';
      snap({ mark: mk, extra: { incoming: { id: sid, key: searchKey, stage: 'hash', bucket: s2, op: 'search', state: found ? 'found' : 'key' }, hashValue: hv2, probe: { slots: probe.slice(), current: s2, state: found ? 'found' : 'compare' } },
        caption: found ? 'Found ' + searchKey + ' in slot ' + s2 + '.' : tomb.indexOf(s2) !== -1 ? 'Slot ' + s2 + ' is a tombstone: do not stop, keep probing.' : e ? e.key + ' ≠ ' + searchKey + ': probe the next slot.' : 'Empty slot: ' + searchKey + ' is absent.' });
      if (found || (!e && tomb.indexOf(s2) === -1)) break;
    }
    return steps;
  }

  G.demo('hash', {
    id: 'hash-probing', title: 'Linear probing — collisions, a tombstone, a search past it', wide: true,
    note: 'mode: "open". probe: {slots, current} draws numbered probe badges and hop arcs; tombstones: [slot] draws † markers.',
    duration: 600, hold: 420,
    build: function (host) {
      var view = VDSA.views.hashtable(host, { mode: 'open', threshold: 0.7, label: 'Hash table with linear probing' });
      var steps = probingSteps([10, 17, 24, 5, 12], 7, 17, 24);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- rehash: 5 -> 11 buckets, entries fly to their new buckets ---------- */
  G.demo('hash', {
    id: 'hash-rehash', title: 'Rehash — from 5 to 11 buckets',
    note: 'Change buckets and each entry\'s bucket: new buckets grow in and every entry flies to k mod 11; resizing: {from, to} labels it.',
    duration: 900, hold: 700,
    build: function (host) {
      var view = VDSA.views.hashtable(host, { mode: 'chaining', showHash: false, threshold: 0.75, label: 'Rehashing a hash table' });
      var keys = [3, 8, 13, 4, 9, 20];
      var steps = [], entries = [];
      function snap(m, caption, extra, mark) { steps.push(Object.assign({ buckets: m, entries: clone(entries, mark), caption: caption }, extra || {})); }
      snap(5, 'm = 5 buckets.');
      keys.forEach(function (k) {
        entries.push({ id: 'k' + k, key: k, bucket: k % 5 });
        var mk = {}; mk['k' + k] = 'active';
        snap(5, 'Insert ' + k + ' → bucket ' + (k % 5) + '.', null, mk);
      });
      snap(5, 'α = 6/5 = 1.2 is over the 0.75 threshold: time to grow.', { resizing: { from: 5, to: 11 } });
      entries.forEach(function (e) { e.bucket = e.key % 11; });
      var all = {}; entries.forEach(function (e) { all[e.id] = 'swap'; });
      snap(11, 'Allocate 11 buckets and re-insert every key with h(k) = k mod 11.', { resizing: { from: 5, to: 11 } }, all);
      snap(11, 'Chains are shorter again: α = 6/11 ≈ 0.55.');
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });
}());
