/* Sorting models share one trace recorder. A frame is a snapshot, so the
   reader can move backward or scrub without rerunning an animation. */
(function (global) {
  'use strict';

  var algorithms = Object.create(null);

  function register(name, definition) {
    if (algorithms[name]) throw new Error('Duplicate sorting algorithm: ' + name);
    algorithms[name] = definition;
  }

  function createTrace(input) {
    var items = input.map(function (value, id) {
      return Object.freeze({ value: value, id: id });
    });
    var settled = new Set();
    var frames = [];
    var comparisons = 0;
    var writes = 0;
    var swaps = 0;
    var held = null;

    function record(caption, active, phase) {
      frames.push({
        items: items.slice(),
        settled: Array.from(settled),
        active: (active || []).slice(),
        held: held,
        caption: caption,
        phase: phase || 'observe',
        comparisons: comparisons,
        writes: writes,
        swaps: swaps
      });
    }

    record('Start with this exact array. Predict the first comparison.', []);

    return {
      frames: frames,
      length: items.length,
      at: function (index) { return items[index]; },
      slice: function (start, end) { return items.slice(start, end); },
      note: function (caption, active) { record(caption, active); },
      compare: function (i, j, caption) {
        comparisons++;
        record(caption || ('Compare positions ' + i + ' and ' + j + '.'), [i, j], 'compare');
        return items[i].value - items[j].value;
      },
      compareItems: function (a, b, caption, active) {
        comparisons++;
        record(caption, active, 'compare');
        return a.value - b.value;
      },
      swap: function (i, j, caption) {
        if (i === j) return;
        var temp = items[i];
        items[i] = items[j];
        items[j] = temp;
        swaps++;
        writes += 2;
        record(caption || ('Swap positions ' + i + ' and ' + j + '.'), [i, j], 'move');
      },
      lift: function (index, caption) {
        held = items[index];
        items[index] = null;
        record(caption, [index], 'move');
      },
      move: function (from, to, caption) {
        items[to] = items[from];
        items[from] = null;
        writes++;
        record(caption, [from, to], 'move');
      },
      write: function (index, item, caption) {
        items[index] = item;
        if (held === item) held = null;
        writes++;
        record(caption, [index], 'move');
      },
      release: function (caption, active) {
        held = null;
        record(caption, active, 'place');
      },
      mark: function (indices, caption) {
        indices.forEach(function (index) { settled.add(index); });
        record(caption, indices, 'settled');
      },
      finish: function () {
        held = null;
        for (var i = 0; i < items.length; i++) settled.add(i);
        record('Sorted. Every value is now in its final position.', [], 'complete');
      }
    };
  }

  function run(name, input) {
    var definition = algorithms[name];
    if (!definition) throw new Error('Unknown sorting algorithm: ' + name);
    if (!Array.isArray(input) || input.length < 2 || input.length > 64 ||
        input.some(function (value) { return !Number.isInteger(value) || value < 0 || value > 99; })) {
      throw new Error('Use 2–64 whole numbers between 0 and 99.');
    }
    var trace = createTrace(input);
    definition.sort(trace);
    trace.finish();
    return { definition: definition, frames: trace.frames };
  }

  global.SortLab = { register: register, run: run, algorithms: algorithms };
}(typeof window !== 'undefined' ? window : globalThis));
