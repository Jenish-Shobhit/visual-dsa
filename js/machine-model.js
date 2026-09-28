/* A small teaching machine, not an emulator for any real CPU. */
(function (root) {
  'use strict';
  var OPCODES = Object.freeze({ LOADI: 0x10, LOAD: 0x11, STORE: 0x12, ADDI: 0x20, ADD: 0x21, SUBI: 0x22, SUB: 0x23, JZ: 0x30, JNZ: 0x31, OUT: 0x40, HALT: 0xff });
  var ADDRESS_OPS = { LOAD: true, STORE: true, ADD: true, SUB: true };
  var JUMP_OPS = { JZ: true, JNZ: true };

  function byte(value, name) {
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError(name + ' must be a whole byte from 0 to 255.');
    return value;
  }
  function instruction(op, arg) { return Object.freeze({ op: op, arg: arg == null ? 0 : arg }); }
  function presets(name, input) {
    byte(input, 'Input');
    if (name === 'add') return [instruction('LOADI', input), instruction('ADDI', 5), instruction('STORE', 0), instruction('LOAD', 0), instruction('OUT'), instruction('HALT')];
    if (name === 'countdown') return [instruction('LOADI', input), instruction('JZ', 5), instruction('OUT'), instruction('SUBI', 1), instruction('JNZ', 2), instruction('HALT')];
    if (name === 'sum') return [instruction('LOADI', 0), instruction('STORE', 0), instruction('LOADI', input), instruction('STORE', 1), instruction('JZ', 12), instruction('LOAD', 0), instruction('ADD', 1), instruction('STORE', 0), instruction('LOAD', 1), instruction('SUBI', 1), instruction('STORE', 1), instruction('JNZ', 5), instruction('LOAD', 0), instruction('OUT'), instruction('HALT')];
    throw new Error('Unknown program: ' + name);
  }
  function format(inst) {
    var op = inst.op;
    if (op === 'LOADI' || op === 'ADDI' || op === 'SUBI') return op.slice(0, -1) + ' #' + inst.arg;
    if (ADDRESS_OPS[op]) return op + ' M' + inst.arg;
    if (JUMP_OPS[op]) return op + ' ' + inst.arg;
    return op;
  }
  function encode(inst) { return [OPCODES[inst.op], inst.arg]; }
  function validate(program) {
    if (!Array.isArray(program) || !program.length || program.length > 32) throw new RangeError('Program must contain 1–32 instructions.');
    program.forEach(function (inst, index) {
      if (!inst || !Object.prototype.hasOwnProperty.call(OPCODES, inst.op)) throw new Error('Unknown opcode at instruction ' + index + '.');
      byte(inst.arg, 'Operand at instruction ' + index);
      if (ADDRESS_OPS[inst.op] && inst.arg > 3) throw new RangeError('Memory address must be M0–M3.');
      if (JUMP_OPS[inst.op] && inst.arg >= program.length) throw new RangeError('Branch target must be inside the program.');
      if ((inst.op === 'OUT' || inst.op === 'HALT') && inst.arg !== 0) throw new RangeError(inst.op + ' has no operand.');
    });
  }

  function run(program, options) {
    validate(program);
    options = options || {};
    var maxInstructions = options.maxInstructions == null ? 256 : options.maxInstructions;
    if (!Number.isInteger(maxInstructions) || maxInstructions < 1 || maxInstructions > 2048) throw new RangeError('Instruction limit must be 1–2048.');
    var state = { pc: 0, acc: 0, memory: [0, 0, 0, 0], output: [], ir: null, decoded: null, wrapped: false, executed: 0, status: 'ready' };
    var frames = [];
    function record(phase, active, caption, lastWrite, lastOutput) {
      var frame = {
        phase: phase, active: active, pc: state.pc, acc: state.acc,
        memory: Object.freeze(state.memory.slice()), output: Object.freeze(state.output.slice()),
        ir: state.ir ? Object.freeze(state.ir.slice()) : null, decoded: state.decoded,
        wrapped: state.wrapped, executed: state.executed, status: state.status,
        lastWrite: lastWrite == null ? null : lastWrite, lastOutput: lastOutput == null ? null : lastOutput,
        caption: caption
      };
      frames.push(Object.freeze(frame));
    }
    record('ready', 0, 'The program counter points to instruction 0. No instruction has run yet.');
    while (state.status === 'ready' || state.status === 'running') {
      if (state.pc < 0 || state.pc >= program.length) {
        state.status = 'fault';
        record('stop', -1, 'The program counter left the program before HALT. This program stopped with a fault.');
        break;
      }
      var at = state.pc, inst = program[at], operand = inst.arg;
      state.status = 'running';
      state.ir = encode(inst);
      state.decoded = null;
      record('fetch', at, 'Fetch instruction ' + at + ': copy its two encoded bytes into the instruction register. A and memory have not changed.');
      state.decoded = format(inst);
      record('decode', at, 'Decode ' + state.decoded + '. The opcode chooses the operation; the operand byte supplies a value, address, or branch target.');
      var next = at + 1, caption = '', lastWrite = null, lastOutput = null;
      if (inst.op === 'LOADI') { state.acc = operand; caption = 'LOAD #' + operand + ' puts the immediate byte ' + operand + ' in A.'; }
      else if (inst.op === 'LOAD') { state.acc = state.memory[operand]; caption = 'LOAD M' + operand + ' copies ' + state.acc + ' from data memory into A.'; }
      else if (inst.op === 'STORE') { state.memory[operand] = state.acc; lastWrite = operand; caption = 'STORE M' + operand + ' writes A (' + state.acc + ') into data memory. A stays the same.'; }
      else if (inst.op === 'ADDI' || inst.op === 'ADD' || inst.op === 'SUBI' || inst.op === 'SUB') {
        var rhs = inst.op.endsWith('I') ? operand : state.memory[operand];
        var before = state.acc, adding = inst.op.slice(0, 3) === 'ADD';
        var exact = adding ? before + rhs : before - rhs;
        state.wrapped = exact < 0 || exact > 255;
        state.acc = (exact + 256) & 255;
        caption = before + (adding ? ' + ' : ' − ') + rhs + ' = ' + exact + '. A keeps the low 8 bits: ' + state.acc + (state.wrapped ? ' (wrapped modulo 256).' : '.');
      }
      else if (inst.op === 'JZ' || inst.op === 'JNZ') {
        var take = inst.op === 'JZ' ? state.acc === 0 : state.acc !== 0;
        if (take) next = operand;
        caption = inst.op + ' tests whether A is ' + (inst.op === 'JZ' ? 'zero' : 'nonzero') + '. It is ' + state.acc + ', so the branch is ' + (take ? 'taken to instruction ' + operand : 'not taken; continue to instruction ' + next) + '.';
      }
      else if (inst.op === 'OUT') { state.output.push(state.acc); lastOutput = state.output.length - 1; caption = 'OUT copies A (' + state.acc + ') to the output stream. It does not erase A.'; }
      else if (inst.op === 'HALT') { state.status = 'halted'; caption = 'HALT stops the program. No later instruction executes.'; }
      state.pc = next;
      state.executed++;
      if (state.status === 'running' && state.executed >= maxInstructions) {
        state.status = 'limit';
        caption += ' The teaching machine stopped at its ' + maxInstructions + '-instruction safety limit; this is not HALT.';
      }
      record('execute', at, caption, lastWrite, lastOutput);
    }
    return Object.freeze({ program: Object.freeze(program.map(function (inst) { return instruction(inst.op, inst.arg); })), frames: Object.freeze(frames), status: state.status });
  }

  var api = Object.freeze({ OPCODES: OPCODES, presets: presets, format: format, encode: encode, run: run });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MachineModel = api;
}(typeof window !== 'undefined' ? window : this));
