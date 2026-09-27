const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scripts = [
  'main.js', 'bubble_sort.js', 'selection_sort.js', 'insertion_sort.js',
  'merge_sort.js', 'quick_sort.js', 'heap_sort.js'
];
const context = vm.createContext({});
for (const script of scripts) {
  const file = path.join(__dirname, '..', 'scripts', script);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const { SortLab } = context;
const names = ['bubble', 'selection', 'insertion', 'merge', 'quick', 'heap'];

function finalItems(name, input) {
  const trace = SortLab.run(name, input);
  const last = trace.frames.at(-1);
  return { trace, last, values: Array.from(last.items, item => item.value) };
}

test('all six methods sort short, duplicate, ascending, and descending inputs', () => {
  const inputs = [
    [0, 0], [9, 1], [3, 3, 3, 3], [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1], [8, 3, 5, 3, 9, 1, 6, 2, 7, 5]
  ];
  for (const name of names) {
    for (const input of inputs) {
      const { trace, last, values } = finalItems(name, input);
      assert.deepEqual(values, [...input].sort((a, b) => a - b), `${name} on ${input}`);
      assert.equal(last.settled.length, input.length, `${name} completes`);
      assert.equal(last.items.some(item => item === null), false, `${name} leaves no gap`);
      assert.ok(trace.frames.length > 1, `${name} creates a trace`);
    }
  }
});

test('every position called final stays fixed through the trace', () => {
  const input = [5, 3, 5, 1, 4, 2, 5];
  for (const name of names) {
    const { trace, last } = finalItems(name, input);
    for (const frame of trace.frames) {
      for (const index of frame.settled) {
        assert.equal(frame.items[index].id, last.items[index].id, `${name}: index ${index} marked too early`);
      }
    }
  }
});

test('algorithms labeled stable preserve the original order of equal values', () => {
  const input = [5, 3, 5, 2, 5, 3, 2, 5];
  for (const name of ['bubble', 'insertion', 'merge']) {
    const { last } = finalItems(name, input);
    for (const value of new Set(input)) {
      const ids = Array.from(last.items).filter(item => item.value === value).map(item => item.id);
      assert.deepEqual(ids, [...ids].sort((a, b) => a - b), `${name} disturbed equal ${value}s`);
    }
  }
});

test('optimized bubble sort does one pass on an already sorted row', () => {
  const { last } = finalItems('bubble', [1, 2, 3, 4, 5, 6]);
  assert.equal(last.comparisons, 5);
  assert.equal(last.swaps, 0);
});

test('trace supports direct access to earlier states without mutating them', () => {
  const { trace } = finalItems('insertion', [4, 1, 3, 2]);
  assert.deepEqual(Array.from(trace.frames[0].items, item => item.value), [4, 1, 3, 2]);
  assert.deepEqual(Array.from(trace.frames.at(-1).items, item => item.value), [1, 2, 3, 4]);
});

test('many repeat-heavy inputs preserve sorted output and final-position claims', () => {
  let seed = 193;
  function random() { seed = (seed * 48271) % 2147483647; return seed; }
  for (let caseIndex = 0; caseIndex < 60; caseIndex++) {
    const length = 2 + random() % 18;
    const input = Array.from({ length }, () => random() % 8);
    for (const name of names) {
      const { trace, last, values } = finalItems(name, input);
      assert.deepEqual(values, [...input].sort((a, b) => a - b), `${name}: ${input}`);
      for (const frame of trace.frames) {
        for (const index of frame.settled) {
          assert.equal(frame.items[index].id, last.items[index].id, `${name}: position ${index} changed after being called final`);
        }
      }
    }
  }
});
