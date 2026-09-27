const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname, '..', 'js', 'graph-model.js');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
const model = context.GraphExplorerModel;

function plain(value) { return JSON.parse(JSON.stringify(value)); }

function referenceShortest(start, target) {
  const distance = Object.fromEntries(model.nodes.map(node => [node, Infinity]));
  distance[start] = 0;
  for (let pass = 0; pass < model.nodes.length - 1; pass++) {
    for (const edge of model.edges) {
      distance[edge.b] = Math.min(distance[edge.b], distance[edge.a] + edge.weight);
      distance[edge.a] = Math.min(distance[edge.a], distance[edge.b] + edge.weight);
    }
  }
  return distance[target];
}

test('costly direct edge separates fewest edges from least total weight', () => {
  const bfs = model.trace('bfs', 'A', 'F');
  const dijkstra = model.trace('dijkstra', 'A', 'F');
  assert.deepEqual(plain(bfs.result), { path: ['A', 'F'], hops: 1, cost: 14 });
  assert.deepEqual(plain(dijkstra.result), { path: ['A', 'B', 'C', 'F'], hops: 3, cost: 6 });
});

test('both algorithms handle every start and target, including the same node', () => {
  for (const start of model.nodes) {
    for (const target of model.nodes) {
      const bfs = model.trace('bfs', start, target);
      const dijkstra = model.trace('dijkstra', start, target);
      for (const trace of [bfs, dijkstra]) {
        assert.equal(trace.result.path[0], start);
        assert.equal(trace.result.path.at(-1), target);
        assert.equal(trace.result.hops, trace.result.path.length - 1);
        assert.equal(trace.result.cost, model.weightOf(trace.result.path));
        assert.ok(trace.frames.length >= 2);
        assert.deepEqual(plain(trace.frames.at(-1).route), plain(trace.result.path));
      }
      assert.equal(dijkstra.result.cost, referenceShortest(start, target));
      assert.ok(dijkstra.result.cost <= bfs.result.cost);
      if (start === target) {
        assert.equal(bfs.result.hops, 0);
        assert.equal(dijkstra.result.cost, 0);
      }
    }
  }
});

test('BFS results use the fewest edges by an independent breadth search', () => {
  for (const start of model.nodes) {
    const hops = Object.fromEntries(model.nodes.map(node => [node, Infinity]));
    hops[start] = 0;
    const queue = [start];
    for (let index = 0; index < queue.length; index++) {
      const at = queue[index];
      for (const edge of model.edges) {
        const to = edge.a === at ? edge.b : edge.b === at ? edge.a : null;
        if (to && hops[to] === Infinity) { hops[to] = hops[at] + 1; queue.push(to); }
      }
    }
    for (const target of model.nodes) {
      assert.equal(model.trace('bfs', start, target).result.hops, hops[target]);
    }
  }
});

test('trace snapshots are independent so stepping backward restores earlier state', () => {
  const run = model.trace('dijkstra', 'A', 'F');
  assert.equal(run.frames[0].distance.F, null);
  assert.equal(run.frames.at(-1).distance.F, 6);
  assert.deepEqual(plain(run.frames[0].frontier), ['A']);
});
