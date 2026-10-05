'use strict';
/* Loads the graph studio scripts the way labs/graph-studio.html does (browser globals, same order) and checks that
   lesson 29 replacing VDSA.algos.shortestPaths does not break Dijkstra on the negative-weight presets. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadLikeBrowser() {
  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'labs', 'graph-studio.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="\.\.\/(js\/(?:algos|labs)\/[^"]+)"/g)].map(m => m[1]).filter(s => !/graph-studio\.js$/.test(s));
  const win = { VDSA: {} }; win.window = win;   // js/vdsa/core.js normally creates VDSA
  const ctx = vm.createContext(win);
  for (const s of srcs) vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), ctx, { filename: s });
  return { win, srcs };
}

test('graph-studio.html loads lesson 28, the capture script, then lesson 29', () => {
  const { srcs } = loadLikeBrowser();
  const i28 = srcs.findIndex(s => /28-dijkstra/.test(s)), ic = srcs.findIndex(s => /graph-studio-capture/.test(s)), i29 = srcs.findIndex(s => /29-bellman/.test(s));
  assert.ok(i28 >= 0 && i28 < ic && ic < i29);
});

test('negative presets run Dijkstra and Bellman-Ford in a browser-like load order', () => {
  const { win } = loadLikeBrowser();
  const Model = win.VDSA.labs.graphStudio;
  assert.ok(Model, 'model loaded on VDSA.labs.graphStudio');
  assert.notEqual(win.VDSA.algos.sp28.bellmanFord, win.VDSA.algos.shortestPaths.bellmanFord);
  for (const id of ['negedge', 'negcycle']) {
    const g = Model.preset(id);
    const d = Model.run('dijkstra', g, { src: g.nodes[0].id });
    assert.equal(d.ok, true, id + ' dijkstra: ' + d.error);
    assert.ok(d.frames.length > 1);
    const b = Model.run('bellman', g, { src: g.nodes[0].id });
    assert.equal(b.ok, true, id + ' bellman: ' + b.error);
  }
  const neg = Model.run('bellman', Model.preset('negcycle'), { src: 'A' });
  assert.match(neg.summary.headline, /negative cycle/i);
});
