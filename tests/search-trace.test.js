const test = require('node:test');
const assert = require('node:assert/strict');
const binarySearchTrace = require('../js/search-trace.js');

test('finds each value and reports absence across empty and varied arrays', () => {
  const arrays = [[], [4], [1, 3, 5, 8, 13, 21, 34, 55], [-8, -3, 0, 0, 0, 7, 11]];
  for (const values of arrays) {
    for (let target = -10; target <= 57; target++) {
      const frames = binarySearchTrace(values, target);
      const last = frames.at(-1);
      const exists = values.includes(target);
      assert.equal(last.result >= 0, exists, `${target} in [${values}]`);
      if (exists) assert.equal(values[last.result], target);
      else assert.equal(last.result, -1);
      assert.ok(last.comparisons <= Math.ceil(Math.log2(values.length + 1)), `${target} in [${values}] used too many comparisons`);
    }
  }
});

test('every frame keeps a present target in its live interval until found', () => {
  const values = [-5, -2, 1, 4, 9, 15, 23, 40, 61];
  for (const target of values) {
    const frames = binarySearchTrace(values, target);
    for (const frame of frames) {
      if (frame.result != null) continue;
      const targetIndex = values.indexOf(target);
      assert.ok(frame.low <= targetIndex && targetIndex <= frame.high, `${target}: discarded at ${frame.caption}`);
      if (frame.mid >= 0) assert.ok(frame.low <= frame.mid && frame.mid <= frame.high);
    }
  }
});

test('an absent result leaves the exact sorted insertion gap', () => {
  const values = [3, 7, 12, 19, 24, 31, 42, 56];
  for (const target of [-1, 4, 20, 60]) {
    const last = binarySearchTrace(values, target).at(-1);
    const insertionIndex = values.filter(value => value < target).length;
    assert.equal(last.result, -1);
    assert.equal(last.low, insertionIndex);
    assert.equal(last.high, insertionIndex - 1);
  }
});
