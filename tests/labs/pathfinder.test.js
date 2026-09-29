/* Pathfinder model (js/labs/pathfinder-model.js): mazes are connected, the map codec round-trips, results agree
   with the lesson generators. Run: node --test tests/labs/pathfinder.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

global.window = {};
const ROOT = path.join(__dirname, '..', '..');
['26-bfs-and-dfs', '28-dijkstra-and-a-star'].forEach((f) => require(path.join(ROOT, 'js', 'algos', f + '.js')));
const P = require(path.join(ROOT, 'js', 'labs', 'pathfinder-model.js'));
window.Pathfinder = P;

const SIZES = [[15, 27], [16, 28], [25, 45], [40, 70], [12, 15], [5, 5], [28, 34], [39, 69]];

test('mazes always connect start and goal, and keep both open', () => {
  for (const [R, C] of SIZES) for (let seed = 1; seed <= 12; seed++) {
    for (const [name, m] of [['backtracker', P.backtracker(R, C, seed)], ['loops', P.backtracker(R, C, seed, { loops: 0.3 })], ['division', P.division(R, C, seed)]]) {
      const w = new Set(m.walls);
      assert.ok(!w.has(m.start.join(',')) && !w.has(m.goal.join(',')), `${name} ${R}x${C} #${seed}: markers open`);
      assert.ok(m.goal[0] < R && m.goal[1] < C);
      assert.ok(P.hasPath(R, C, m.walls, m.start, m.goal), `${name} ${R}x${C} #${seed}: path exists`);
    }
  }
});

test('a perfect backtracker maze has exactly one route; loops add routes', () => {
  const a = P.backtracker(15, 27, 3, { loops: 0 });
  const open = 15 * 27 - a.walls.length;
  // a tree on the odd cells: open cells = 2 * cells - 1
  const cells = 7 * 13;
  assert.equal(open, 2 * cells - 1);
  assert.ok(P.backtracker(15, 27, 3, { loops: 0.3 }).walls.length < a.walls.length);
});

test('recursive division builds real walls', () => {
  const m = P.division(25, 45, 5);
  assert.ok(m.walls.length > 100);
});

test('random walls guarantee a path at any density, and hit the density when they can', () => {
  for (const dens of [0, 0.2, 0.35, 0.5, 0.6]) for (let seed = 1; seed <= 15; seed++) {
    const m = P.randomWalls(20, 40, dens, seed);
    assert.ok(P.hasPath(20, 40, m.walls, m.start, m.goal), `density ${dens} seed ${seed}`);
  }
  const m = P.randomWalls(30, 50, 0.3, 4, { guarantee: false });
  assert.ok(Math.abs(m.walls.length / 1500 - 0.3) < 0.05);
});

test('scatterMud avoids walls and markers', () => {
  const m = P.randomWalls(20, 40, 0.25, 2);
  const mud = P.scatterMud(20, 40, m.walls, 9, { avoid: [m.start, m.goal] });
  assert.ok(mud.length > 10);
  const w = new Set(m.walls);
  mud.forEach((k) => { assert.ok(!w.has(k)); assert.notEqual(k, m.start.join(',')); assert.notEqual(k, m.goal.join(',')); });
});

test('presets keep the markers open and (except the trap shapes) leave a path', () => {
  for (const [R, C] of SIZES) for (const p of P.PRESETS) {
    const m = P.presetMap(p.id, R, C, 3);
    const w = new Set(m.walls);
    assert.ok(!w.has(m.start.join(',')) && !w.has(m.goal.join(',')), `${p.id} ${R}x${C}`);
    assert.ok(P.hasPath(R, C, m.walls, m.start, m.goal), `${p.id} ${R}x${C} has a path`);
  }
});

test('map codec round-trips (small and full size) and rejects junk', () => {
  for (const [R, C] of SIZES) {
    const m = P.randomWalls(R, C, 0.3, 5);
    const mud = P.scatterMud(R, C, m.walls, 6, { avoid: [m.start, m.goal] });
    const enc = P.encodeMap(R, C, m.walls, mud);
    assert.match(enc, /^[A-Za-z0-9_\-~.]+$/);
    const dec = P.decodeMap(enc, R, C);
    assert.deepEqual(new Set(dec.walls), new Set(m.walls));
    assert.deepEqual(new Set(dec.mud), new Set(mud));
  }
  const empty = P.encodeMap(15, 27, [], []);
  assert.ok(empty.length < 20, 'an empty map compresses');
  assert.deepEqual(P.decodeMap(empty, 15, 27), { walls: [], mud: [] });
  assert.equal(P.decodeMap('!!!', 5, 5), null);
  assert.equal(P.decodeMap('AAA', 15, 27), null);
});

test('analyze: optimal algorithms agree on cost; the path is a valid ordered route', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const R = 18, C = 30, m = P.backtracker(R, C, seed, { loops: 0.15 });
    const mud = P.scatterMud(R, C, m.walls, seed, { avoid: [m.start, m.goal], blobs: 6 });
    const grid = P.toGrid(R, C, m.walls, mud), o = { mudCost: 5 };
    const res = {};
    for (const a of P.ALGOS) {
      const steps = P.runSteps(a.id, grid, m.start, m.goal, o);
      res[a.id] = P.analyze(steps, grid, m.start, m.goal, 5);
      assert.ok(res[a.id].found, a.id);
      const p = res[a.id].path;
      assert.deepEqual(p[0], m.start); assert.deepEqual(p[p.length - 1], m.goal);
      for (let i = 1; i < p.length; i++) assert.equal(Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]), 1);
      assert.equal(res[a.id].pathLen, p.length - 1);
    }
    assert.equal(res.astar.cost, res.dijkstra.cost);
    assert.ok(res.bfs.pathLen <= res.dfs.pathLen);
    assert.ok(res.bfs.cost >= res.dijkstra.cost);
    const cmp = P.compareAll(grid, m.start, m.goal, o);
    assert.equal(cmp.best, res.dijkstra.cost);
    cmp.rows.forEach((r) => { assert.equal(r.cost, res[r.algo].cost, r.algo); assert.equal(r.expanded, res[r.algo].expanded, r.algo); });
    assert.ok(cmp.rows.find((r) => r.algo === 'dijkstra').optimal);
    assert.ok(cmp.rows.find((r) => r.algo === 'astar').optimal);
  }
});

test('walled-off goal: nobody finds a path, and compareAll says so', () => {
  const walls = []; for (let r = 0; r < 10; r++) walls.push(r + ',5');
  const grid = P.toGrid(10, 12, walls, []);
  const cmp = P.compareAll(grid, [5, 1], [5, 10], {});
  cmp.rows.forEach((r) => { assert.equal(r.found, false); assert.equal(r.optimal, false); });
  assert.equal(cmp.best, null);
});

test('expandOrder ranks each expanded cell once', () => {
  const grid = P.toGrid(10, 12, [], []);
  const steps = P.runSteps('bfs', grid, [5, 1], [5, 10]);
  const { ord, total } = P.expandOrder(steps, 10, 12);
  const seen = Array.from(ord).filter((v) => v >= 0).sort((a, b) => a - b);
  assert.equal(seen.length, total);
  assert.deepEqual(seen, seen.map((_, i) => i));
});
