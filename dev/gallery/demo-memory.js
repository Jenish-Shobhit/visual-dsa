/* Gallery demos: VDSA.views.memory */
(function () {
  'use strict';
  var G = Gallery;

  /* ---------- RAM cells: a 4-byte int, a char array, a pointer that moves ---------- */
  G.demo('memory', {
    id: 'mem-ram', title: 'RAM — an int, a char array and a pointer', wide: true,
    note: 'mode: "ram". vars bracket the cells they occupy; bits: true adds binary; pointers draw an arrow from the cell holding an address.',
    duration: 600, hold: 700,
    build: function (host) {
      var view = VDSA.views.memory(host, { mode: 'ram', label: 'Bytes in memory' });
      var base = 0x1000;
      function cells(vals, mark, bits) {
        return vals.map(function (v, i) { return { value: v, state: (mark && mark[i]) || 'default', bits: bits && bits.indexOf(i) !== -1 }; });
      }
      var q = '?';
      var v0 = [q, q, q, q, q, q, q, q, q, q, q, q, q, q, q, q];
      var nVar = { name: 'n', type: 'int', from: 0, to: 3 };
      var sVar = { name: 's', type: 'char[4]', from: 4, to: 7 };
      var pVar = { name: 'p', type: 'char*', from: 8, to: 11 };
      var nBytes = [44, 1, 0, 0];                // 300 = 0x0000012C, little-endian
      var s = ["'h'", "'i'", "'!'", "'\\0'"];
      var steps = [];
      var v1 = v0.slice();
      steps.push({ base: base, cells: cells(v1), caption: 'Sixteen bytes of memory, addresses 0x1000 upward. Nothing is initialised yet.' });
      steps.push({ base: base, cells: cells(v1, { 0: 'active', 1: 'active', 2: 'active', 3: 'active' }), vars: [nVar], caption: 'int n reserves four consecutive bytes.' });
      var v2 = nBytes.concat(v1.slice(4));
      steps.push({ base: base, cells: cells(v2, { 0: 'swap', 1: 'swap', 2: 'swap', 3: 'swap' }, [0, 1, 2, 3]), vars: [nVar], caption: 'n = 300 is stored low byte first: 0x2C, 0x01, 0x00, 0x00.' });
      var v3 = nBytes.concat(s, v1.slice(8));
      steps.push({ base: base, cells: cells(v3, { 4: 'swap', 5: 'swap', 6: 'swap', 7: 'swap' }, [0, 1, 2, 3]), vars: [nVar, sVar], caption: 'char s[4] = "hi!" takes one byte per character plus the terminator.' });
      var v4 = nBytes.concat(s, [4, 16, 0, 0], v1.slice(12));
      steps.push({ base: base, cells: cells(v4, { 8: 'swap', 9: 'swap', 10: 'swap', 11: 'swap' }, [0, 1, 2, 3]), vars: [nVar, sVar, pVar], pointers: [{ from: 8, to: 4, state: 'active' }], caption: 'p = &s[0]: the pointer stores the address 0x1004 (bytes 04 10 00 00).' });
      var v5 = nBytes.concat(s, [5, 16, 0, 0], v1.slice(12));
      steps.push({ base: base, cells: cells(v5, { 8: 'swap' }, [0, 1, 2, 3]), vars: [nVar, sVar, pVar], pointers: [{ from: 8, to: 5, state: 'active' }], caption: 'p++ adds one byte (sizeof(char)): the arrow moves to 0x1005.' });
      steps.push({ base: base, cells: cells(v5, { 5: 'compare', 8: 'active' }, [0, 1, 2, 3]), vars: [nVar, sVar, pVar], pointers: [{ from: 8, to: 5, state: 'active' }], caption: "*p reads the byte at 0x1005: 'i'." });
      view.prepare(steps);
      return { steps: steps, render: function (st, c) { view.render(st, { duration: c.duration }); } };
    }
  });

  /* ---------- stack & heap: aliasing, a call, reassignment, garbage ---------- */
  G.demo('memory', {
    id: 'mem-stackheap', title: 'Stack and heap — references, aliasing, garbage', wide: true,
    note: 'mode: "stackheap". Frames push and pop; two variables can point at one object; reassigning re-routes the arrow; unreachable objects turn muted, then vanish.',
    duration: 700, hold: 700,
    build: function (host) {
      var view = VDSA.views.memory(host, { mode: 'stackheap', label: 'Stack and heap' });
      var arr1 = function (mark) {
        return { id: 'arr1', kind: 'array', label: 'int[3]', state: mark && mark.arr || 'default', fields: [4, 1, 7].map(function (v, i) { return { value: v, state: (mark && mark[i]) || 'default' }; }) };
      };
      var n1 = function (next) { return { id: 'n1', kind: 'node', label: 'Node', fields: [{ name: 'val', value: 5 }, { name: 'next', ptr: next || null }] }; };
      var n2 = { id: 'n2', kind: 'node', label: 'Node', sameRow: true, fields: [{ name: 'val', value: 9 }, { name: 'next', ptr: null }] };
      var steps = [];
      function main(vars, st) { return { id: 'main', fn: 'main', state: st || 'active', vars: vars }; }
      steps.push({ frames: [main([])], heap: [], caption: 'main() starts with an empty frame.' });
      steps.push({ frames: [main([{ name: 'xs', ptr: 'arr1', state: 'swap' }])], heap: [arr1()], caption: 'xs = [4, 1, 7]: the array lives on the heap; the variable holds a reference.' });
      steps.push({ frames: [main([{ name: 'xs', ptr: 'arr1' }, { name: 'head', ptr: 'n1', state: 'swap' }])], heap: [arr1(), n1()], caption: 'head = new Node(5). Its next field is null (⌀).' });
      var mainV = [{ name: 'xs', ptr: 'arr1' }, { name: 'head', ptr: 'n1' }, { name: 't', value: '?' }];
      steps.push({ frames: [main(mainV, 'default'), { id: 'total', fn: 'total', args: 'xs', state: 'active', vars: [{ name: 'a', ptr: 'arr1', state: 'active' }] }], heap: [arr1({ arr: 'active' }), n1()], caption: 'Calling total(xs) pushes a frame. a and xs now point at the same array (aliasing).' });
      var sums = [4, 5, 12];
      sums.forEach(function (s, i) {
        var mk = {}; mk[i] = 'compare';
        steps.push({ frames: [main(mainV, 'default'), { id: 'total', fn: 'total', args: 'xs', state: 'active', vars: [{ name: 'a', ptr: 'arr1' }, { name: 'i', value: i }, { name: 's', value: s, state: 'swap' }] }], heap: [arr1(mk), n1()], caption: 's += a[' + i + '] → ' + s + '.' });
      });
      steps.push({ frames: [main(mainV, 'default'), { id: 'total', fn: 'total', args: 'xs', state: 'active', returnValue: 12, vars: [{ name: 'a', ptr: 'arr1' }, { name: 'i', value: 3 }, { name: 's', value: 12 }] }], heap: [arr1(), n1()], caption: 'total returns 12.' });
      var mainV2 = [{ name: 'xs', ptr: 'arr1' }, { name: 'head', ptr: 'n1' }, { name: 't', value: 12, state: 'swap' }];
      steps.push({ frames: [main(mainV2)], heap: [arr1(), n1()], caption: 'Its frame pops; t = 12. The array survives: xs still refers to it.' });
      steps.push({ frames: [main([{ name: 'xs', ptr: 'arr1' }, { name: 'head', ptr: 'n1' }, { name: 't', value: 12 }])], heap: [arr1(), n1('n2'), n2], caption: 'head.next = new Node(9): a field can hold a reference too.' });
      var arr2 = { id: 'arr2', kind: 'array', label: 'int[2]', fields: [{ value: 2 }, { value: 2 }] };
      var g1 = arr1(); g1.state = 'muted';
      steps.push({ frames: [main([{ name: 'xs', ptr: 'arr2', state: 'swap' }, { name: 'head', ptr: 'n1' }, { name: 't', value: 12 }])], heap: [g1, n1('n2'), n2, arr2], caption: 'xs = [2, 2]: the arrow re-routes. Nothing refers to the old array any more.' });
      steps.push({ frames: [main([{ name: 'xs', ptr: 'arr2' }, { name: 'head', ptr: 'n1' }, { name: 't', value: 12 }])], heap: [n1('n2'), n2, arr2], caption: 'The garbage collector reclaims the unreachable array.' });
      view.prepare(steps);
      return { steps: steps, render: function (st, c) { view.render(st, { duration: c.duration }); } };
    }
  });

  /* ---------- swapping references, stack grows up, objects with fields ---------- */
  G.demo('memory', {
    id: 'mem-swap', title: 'Swapping two references',
    note: 'stackGrows: "up" (newest frame on top); kind: "object" draws a record with named fields. Only the arrows move: the objects never copy.',
    duration: 650, hold: 650,
    build: function (host) {
      var view = VDSA.views.memory(host, { mode: 'stackheap', stackGrows: 'up', label: 'Swapping references' });
      var ada = { id: 'ada', kind: 'object', label: 'Person', fields: [{ name: 'name', value: '"Ada"' }, { name: 'born', value: 1815 }] };
      var alan = { id: 'alan', kind: 'object', label: 'Person', fields: [{ name: 'name', value: '"Alan"' }, { name: 'born', value: 1912 }] };
      function frame(a, b, t, mark) {
        var vars = [{ name: 'a', ptr: a, state: mark === 'a' ? 'swap' : 'default' }, { name: 'b', ptr: b, state: mark === 'b' ? 'swap' : 'default' }];
        if (t !== undefined) vars.push({ name: 'tmp', ptr: t, state: mark === 'tmp' ? 'swap' : 'default' });
        return { id: 'main', fn: 'main', state: 'active', vars: vars };
      }
      var steps = [
        { frames: [frame('ada', 'alan')], heap: [ada, alan], caption: 'a and b refer to two Person objects.' },
        { frames: [frame('ada', 'alan', 'ada', 'tmp')], heap: [ada, alan], caption: 'tmp = a copies the reference, not the object.' },
        { frames: [frame('alan', 'alan', 'ada', 'a')], heap: [ada, alan], caption: 'a = b: now a and b both refer to Alan.' },
        { frames: [frame('alan', 'ada', 'ada', 'b')], heap: [ada, alan], caption: 'b = tmp: the references have traded places.' },
        { frames: [frame('alan', 'ada', null, 'tmp')], heap: [ada, alan], caption: 'tmp = null (⌀) drops the extra reference.' }
      ];
      view.prepare(steps);
      return { steps: steps, render: function (st, c) { view.render(st, { duration: c.duration }); } };
    }
  });
}());
