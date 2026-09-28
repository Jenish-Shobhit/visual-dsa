const test = require('node:test');
const assert = require('node:assert/strict');
const machine = require('../js/machine-model.js');

function final(name, input, maxInstructions) {
  const trace = machine.run(machine.presets(name, input), { maxInstructions });
  return { trace, state: trace.frames.at(-1) };
}

test('every executed instruction has fetch, decode, execute frames and state changes only on execute', () => {
  const { trace, state } = final('add', 7);
  assert.equal(state.status, 'halted');
  assert.equal(trace.frames.length, 1 + state.executed * 3);
  for (let i = 1; i < trace.frames.length; i += 3) {
    const [fetch, decode, execute] = trace.frames.slice(i, i + 3);
    assert.deepEqual([fetch.phase, decode.phase, execute.phase], ['fetch', 'decode', 'execute']);
    assert.equal(fetch.active, decode.active);
    assert.equal(fetch.active, execute.active);
    assert.equal(fetch.acc, decode.acc);
    assert.deepEqual(fetch.memory, decode.memory);
    assert.deepEqual(fetch.output, decode.output);
    assert.deepEqual(fetch.ir, machine.encode(trace.program[fetch.active]));
    assert.equal(decode.decoded, machine.format(trace.program[fetch.active]));
  }
  assert.deepEqual(state.output, [12]);
  assert.equal(state.memory[0], 12);
});

test('8-bit addition and subtraction wrap, and output copies the accumulator', () => {
  const addition = final('add', 255).state;
  assert.deepEqual(addition.output, [4]);
  assert.equal(addition.memory[0], 4);
  const wrappedFrame = final('add', 255).trace.frames.find(frame => frame.phase === 'execute' && frame.active === 1);
  assert.equal(wrappedFrame.wrapped, true);
  assert.equal(wrappedFrame.acc, 4);
  const loadAfterWrap = final('add', 255).trace.frames.find(frame => frame.phase === 'execute' && frame.active === 3);
  assert.equal(loadAfterWrap.wrapped, true, 'last arithmetic flag survives memory load');
  const underflow = machine.run([
    { op: 'LOADI', arg: 0 }, { op: 'SUBI', arg: 1 }, { op: 'OUT', arg: 0 }, { op: 'HALT', arg: 0 }
  ]).frames.at(-1);
  assert.deepEqual(underflow.output, [255]);
});

test('countdown branches and stops exactly at zero, including zero input', () => {
  for (const n of [0, 1, 4, 12]) {
    const { state } = final('countdown', n);
    assert.equal(state.status, 'halted');
    assert.deepEqual(state.output, Array.from({ length: n }, (_, i) => n - i));
    assert.equal(state.acc, 0);
  }
});

test('sum program reads and writes memory, with output modulo 256', () => {
  for (const n of [0, 1, 5, 23]) {
    const { trace, state } = final('sum', n);
    assert.equal(state.status, 'halted');
    assert.deepEqual(state.output, [(n * (n + 1) / 2) % 256]);
    assert.equal(state.memory[1], 0);
    assert.ok(trace.frames.some(frame => frame.lastWrite === 0));
  }
});

test('the safety limit is distinct from HALT and snapshots are immutable', () => {
  const { trace, state } = final('countdown', 255, 9);
  assert.equal(state.status, 'limit');
  assert.equal(state.executed, 9);
  assert.deepEqual(state.output, [255, 254, 253]);
  assert.equal(Object.isFrozen(trace.frames[0]), true);
  assert.equal(Object.isFrozen(trace.frames[0].memory), true);
  assert.equal(Object.isFrozen(trace.frames[0].output), true);
  assert.deepEqual(trace.frames[0].memory, [0, 0, 0, 0]);
});

test('invalid byte values, addresses, opcodes, and branch targets are rejected', () => {
  assert.throws(() => machine.presets('add', 256), /byte/);
  assert.throws(() => machine.presets('add', -1), /byte/);
  assert.throws(() => machine.presets('add', 3.5), /byte/);
  assert.throws(() => machine.run([{ op: 'EVAL', arg: 0 }]), /opcode/);
  assert.throws(() => machine.run([{ op: 'STORE', arg: 4 }]), /Memory address/);
  assert.throws(() => machine.run([{ op: 'JNZ', arg: 1 }]), /Branch target/);
});
