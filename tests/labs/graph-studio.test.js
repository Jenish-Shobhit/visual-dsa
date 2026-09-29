'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../js/labs/graph-studio-model.js');

test('edge list round-trips through parseText and toText', () => {
  const r = M.parseText('A-B:4, B-C:-2, D');
  assert.equal(r.error, null);
  assert.equal(r.directed, false); assert.equal(r.weighted, true);
  assert.deepEqual(r.nodes, ['A', 'B', 'C', 'D']);
  const g = { directed: false, weighted: true, nodes: r.nodes.map(id => ({ id })), edges: r.edges };
  assert.equal(M.toText(g), 'A-B:4, B-C:-2, D');
  const d = M.parseText('A>B, B>C');
  assert.equal(d.directed, true); assert.equal(d.weighted, false);
});
test('parse errors are friendly and limits hold', () => {
  assert.ok(M.parseText('').error);
  assert.ok(M.parseText('A-A').error);
  assert.ok(M.parseText('A-B:500').error);
  assert.ok(M.parseText('A~B').error);
  const many = Array.from({ length: 17 }, (_, i) => 'N' + i).join(',');
  assert.ok(M.parseText(many).error);
});
test('URL state round-trips graph, positions and choices', () => {
  const g = M.preset('city');
  const q = M.encode({ graph: g, algo: 'dijkstra', src: 'A', dst: 'H' });
  const d = M.decode(q);
  assert.equal(d.algo, 'dijkstra'); assert.equal(d.src, 'A'); assert.equal(d.dst, 'H');
  assert.equal(d.graph.nodes.length, 8); assert.equal(d.graph.edges.length, 12);
  assert.equal(d.graph.weighted, true); assert.equal(d.graph.nodes[0].x, 110);
});
test('availability follows the graph', () => {
  const dag = M.preset('courses'), city = M.preset('city');
  assert.equal(M.availability(dag, {}).topo.ok, true);
  assert.equal(M.availability(city, {}).topo.ok, false);
  assert.equal(M.availability(dag, {}).kruskal.ok, false);
  assert.equal(M.availability(city, {}).flow.ok, false);
  assert.ok(M.availability(M.preset('negedge'), {}).dijkstra.warn);
  assert.equal(M.availability(M.randomGraph(14, .3, 1), {}).floyd.ok, false);
});
test('every preset runs every available algorithm', () => {
  for (const p of M.PRESETS) {
    const g = M.preset(p.id), sel = { src: g.hint.src || g.nodes[0].id, dst: g.hint.dst || null };
    const av = M.availability(g, sel);
    for (const a of M.ALGOS) {
      if (!av[a.id].ok) continue;
      const r = M.run(a.id, g, sel);
      assert.ok(r.ok, p.id + ' ' + a.id + ' ' + r.error);
      assert.ok(r.frames.length > 1);
    }
  }
});
test('results match known answers', () => {
  const flow = M.run('flow', M.preset('flow'), { src: 's', dst: 't' });
  assert.match(flow.summary.headline, /23/);
  const d = M.run('dijkstra', M.preset('city'), { src: 'A', dst: 'H' });
  assert.match(d.summary.rows[1][1], /length 35/);
  const nc = M.run('bellman', M.preset('negcycle'), { src: 'S' });
  assert.match(nc.summary.headline, /Negative cycle/);
  const wrong = M.run('dijkstra', M.preset('negedge'), { src: 'S' });
  assert.match(wrong.summary.headline, /wrongly/);
  const cyc = M.run('topo', { directed: true, weighted: false, nodes: ['A', 'B'].map(id => ({ id })), edges: [{ from: 'A', to: 'B', w: 1 }, { from: 'B', to: 'A', w: 1 }] }, {});
  assert.match(cyc.summary.headline, /cycle/);
});
test('random graphs respect size and density', () => {
  const g = M.randomGraph(10, 0.5, 5);
  assert.equal(g.nodes.length, 10); assert.equal(g.edges.length, 23);
  assert.equal(M.facts(g).connected, true);
  assert.equal(M.randomGraph(6, 0, 1).edges.length, 0);
});
