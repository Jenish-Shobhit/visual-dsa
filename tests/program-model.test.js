const test = require('node:test');
const assert = require('node:assert/strict');
const trace = require('../js/program-model.js');

test('reads see the old value; assignment and output change separate state', () => {
  const {frames, status} = trace('total = 2\ntotal = total + 3\nshow(total)');
  assert.equal(status, 'done');
  assert.deepEqual(frames.map(f => f.phase), ['ready','read','write','read','write','read','output']);
  assert.deepEqual(frames[3].memory, {total:2});
  assert.deepEqual(frames[4].memory, {total:5});
  assert.deepEqual(frames[4].output, []);
  assert.deepEqual(frames[6].output, [5]);
  assert.notEqual(frames[3].memory, frames[4].memory);
});

test('moving show earlier preserves the earlier output after memory changes', () => {
  const {frames} = trace('score = 4\nshow(score)\nscore = score * 2');
  assert.deepEqual(frames.at(-1).memory, {score:8});
  assert.deepEqual(frames.at(-1).output, [4]);
});

test('undefined names stop the program without inventing a value or running later lines', () => {
  const {frames,status} = trace('show(missing)\nmissing = 3');
  assert.equal(status, 'error');
  assert.equal(frames.at(-1).phase,'error');
  assert.deepEqual(frames.at(-1).memory,{});
  assert.deepEqual(frames.at(-1).output,[]);
});

test('signed integers and subtraction follow arithmetic within explicit bounds', () => {
  const good = trace('a = -2\nb = a - -3\nshow(b * -4)');
  assert.deepEqual(good.frames.at(-1).output, [-4]);
  for (const source of ['a = 1000001','a = 1000000 * 2']) {
    assert.equal(trace(source).status, 'error');
    assert.deepEqual(trace(source).frames.at(-1).memory, {});
  }
});

test('rejects unsupported JavaScript and malformed programs before any execution', () => {
  for (const source of ['', 'alert(1)', 'x = 2; show(x)', 'x = 1\n\nshow(x)', 'x = 1 / 2', 'show(window)', Array(14).fill('x = 1').join('\n')]) {
    const result = trace(source);
    if (source === 'show(window)') assert.equal(result.status, 'error');
    else { assert.ok(result.error); assert.equal(result.frames.length,0); }
  }
});

test('a word that matches an Object property is still an ordinary unassigned name', () => {
  assert.equal(trace('show(constructor)').status,'error');
  assert.deepEqual(trace('constructor = 7\nshow(constructor)').frames.at(-1).output,[7]);
});
