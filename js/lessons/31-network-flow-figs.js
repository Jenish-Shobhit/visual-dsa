/* Lesson 31 · Max flow & min cut — part 2: the greedy trap, the residual graph, the minimum cut.
   Needs js/lessons/31-network-flow.js (VDSA.L31) and js/algos/31-network-flow.js. */
(function () {
  'use strict';
  var V = window.VDSA, h = V.h, s = V.s;
  var NF = V.algos.networkFlow;
  var L = V.L31;

  /* ================================================================== greedy gets stuck, reverse arcs fix it */
  function greedySteps() {
    var raw = NF.trace(L.DIAMOND, { forced: [['s', 'a', 'b', 't']], detail: 'rounds' });
    var out = [];
    var pushSeen = 0;
    raw.forEach(function (st, i) {
      var o = Object.assign({}, st, { counters: { value: st.value, augmentations: st.counters.augmentations } });
      if (st.kind === 'init') o.caption = 'A tiny network. From s, 3 units can go into a and 2 into b; a and b can pass 2 and 3 on to t. Greedy picks <em>any</em> route that still has room and pushes as much as fits. Press <kbd>→</kbd> to let it choose a route that looks great.';
      out.push(o);
      if (st.kind === 'push' && ++pushSeen === 1) {
        var quiet = {};
        Object.keys(st.states).forEach(function (k) { quiet[k] = 'default'; });
        out.push(Object.assign({}, o, {
          kind: 'stuck', states: quiet, path: null, pathNodes: null, pushed: null, bottleneck: null, bottleArc: -1,
          caption: 'Greedy looks for another route with room. s→a is full (3/3). s→b still has room, but b→t is full (3/3), so s→b→t is blocked. No route is left and greedy stops at <b>3</b>. Yet a→t and s→b both have room, and the pipes could carry <b>5</b>. The mistake was sending so much through a→b.'
        }));
        out.push(Object.assign({}, o, {
          kind: 'reveal', states: quiet, path: null, pathNodes: null, pushed: null, bottleneck: null, bottleArc: -1,
          found: [{ from: 'b', to: 'a', edge: 'a-b', dir: 'back', res: 3 }],
          caption: 'The fix: for every pipe that carries flow, also draw a <em>reverse arc</em> with room equal to that flow. Pipe a→b carries 3, so the residual graph (right) has a dashed arc b→a with room 3. Sending flow along it means taking flow back off a→b.'
        }));
      }
    });
    return out;
  }

  function greedyFigure(fig) {
    var net = L.DIAMOND;
    var steps = greedySteps();
    var pair = L.pair(fig, net, { maxHeight: 340, leftLabel: 'Pipes: flow over capacity', rightLabel: 'Residual graph: room left and reverse arcs' });
    L.legend(fig.querySelector('[data-legend]'), [L.LEG.empty, L.LEG.flow, L.LEG.full, L.LEG.path, L.LEG.reverse]);
    var player = V.player({
      root: fig, steps: steps, render: function (step, ctx) { pair.render(step, ctx); },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { value: 'Total flow', augmentations: 'Augmentations' }, counterStates: { value: 'done' },
      baseStepMs: 1500, label: 'Greedy trap controls'
    });
    player.addCheckpoint(function (st) {
      for (var i = 0; i < st.length; i++) if (st[i].kind === 'push' && st[i].round === 2) return i;
      return -1;
    }, function (c) {
      return {
        question: 'The next push runs 2 units along s→b→a→t, and its middle hop goes <em>backward</em> along the pipe a→b, which now carries 3. What happens to the flow on a→b?',
        options: ['It rises from 3 to 5', 'It stays at 3', 'It drops from 3 to 1'],
        answer: 2,
        explain: [
          'A backward hop never adds flow to the pipe. Pipe a→b holds only 5, and it points from a to b: nothing is pushed <em>along</em> it here.',
          'The path uses the reverse arc b→a, and that arc exists precisely to change the flow on a→b, so it cannot stay at 3.',
          'Yes. The reverse arc means “take flow back off a→b”. Those 2 units stop crossing from a to b and leave a through a→t instead. The bookkeeping trick is a rerouting.'
        ]
      };
    }, { id: 'nf-cp-greedy-drop' });
  }

  /* ================================================================== the residual arcs of one pipe */
  function residualFigure(fig) {
    var CAP = 5, W = 760, H = 380;
    var svg = s('svg', { class: 'nf-res', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'A pipe from u to v with capacity 5 and the two residual arcs it produces' });
    var ux = 120, vx = 640;
    function node(id, x, y) {
      var g = s('g', { class: 'nf-node', transform: 'translate(' + x + ' ' + y + ')' });
      g.appendChild(s('circle', { r: 26 })); g.appendChild(s('text', { x: 0, y: 1 }, id));
      return g;
    }
    // top: the pipe
    var y1 = 82;
    var pipe = s('g', { class: 'nf-pipe' });
    pipe.appendChild(s('line', { class: 'nf-pipe-wall', x1: ux, y1: y1, x2: vx, y2: y1, 'stroke-width': 10 + 10 + CAP * 6 }));
    pipe.appendChild(s('line', { class: 'nf-pipe-chan', x1: ux, y1: y1, x2: vx, y2: y1, 'stroke-width': 10 + CAP * 6 }));
    var water = s('line', { class: 'nf-pipe-water nf-res__water', x1: ux, y1: y1, x2: vx, y2: y1, 'stroke-width': 0 });
    pipe.appendChild(water);
    svg.appendChild(pipe);
    var pillG = s('g', { class: 'nf-pill', transform: 'translate(' + (ux + vx) / 2 + ' ' + y1 + ')' });
    pillG.appendChild(s('rect', { x: -30, y: -13, width: 60, height: 26, rx: 13 }));
    var pillT = s('text', { x: 0, y: 1 }, '0/5');
    pillG.appendChild(pillT); svg.appendChild(pillG);
    svg.appendChild(node('u', ux, y1)); svg.appendChild(node('v', vx, y1));
    svg.appendChild(s('text', { class: 'nf-res__title', x: 24, y: 24 }, 'The pipe (capacity 5)'));
    // bottom: the two residual arcs
    var yF = 232, yB = 314;
    svg.appendChild(s('text', { class: 'nf-res__title', x: 24, y: 168 }, 'Its residual arcs'));
    svg.appendChild(node('u', ux, (yF + yB) / 2)); svg.appendChild(node('v', vx, (yF + yB) / 2));
    function arc(y, dashed, dir) {
      var x1 = dir > 0 ? ux + 30 : vx - 30, x2 = dir > 0 ? vx - 40 : ux + 40;
      var line = s('line', { class: 'nf-res__arc' + (dashed ? ' is-back' : ' is-fwd'), x1: x1, y1: y, x2: x2, y2: y, 'stroke-width': 0 });
      var head = s('path', { class: 'nf-res__head' + (dashed ? ' is-back' : ' is-fwd'), d: 'M' + (x2 + dir * 16) + ' ' + y + ' L' + x2 + ' ' + (y - 11) + ' L' + x2 + ' ' + (y + 11) + ' Z' });
      var txt = s('text', { class: 'nf-res__lab', x: (ux + vx) / 2, y: y - 22 }, '');
      svg.appendChild(line); svg.appendChild(head); svg.appendChild(txt);
      return { line: line, head: head, txt: txt };
    }
    var fwd = arc(yF, false, 1), back = arc(yB, true, -1);
    fig.querySelector('[data-stage]').appendChild(svg);
    var stats = V.stats(fig.querySelector('[data-stats]'), { labels: { f: 'Flow f on u→v', fwd: 'Forward room, 5 − f', back: 'Reverse room, f' }, states: { f: 'active', fwd: 'path', back: 'pivot' } });
    var cap = fig.querySelector('[data-caption]');
    L.legend(fig.querySelector('[data-legend]'), [{ state: 'active', shape: 'line', label: 'Flow in the pipe' }, { state: 'path', shape: 'line', label: 'Forward arc: room left' }, { state: 'pivot', shape: 'dash', label: 'Reverse arc: flow to take back' }]);
    function set(f) {
      water.style.strokeWidth = (f / CAP * (10 + CAP * 6)) + 'px';
      pillT.textContent = f + '/' + CAP;
      var wf = (CAP - f) * 6, wb = f * 6;
      fwd.line.style.strokeWidth = wf + 'px'; back.line.style.strokeWidth = wb + 'px';
      fwd.head.style.opacity = CAP - f > 0 ? 1 : 0; back.head.style.opacity = f > 0 ? 1 : 0;
      fwd.txt.textContent = CAP - f > 0 ? 'u → v: room ' + (CAP - f) : 'u → v: full, no arc';
      back.txt.textContent = f > 0 ? 'v → u: room ' + f + ' (take back)' : 'v → u: nothing to take back';
      back.txt.setAttribute('y', yB + 34); fwd.txt.setAttribute('y', yF - 24);
      stats.update({ f: f, fwd: CAP - f, back: f });
      cap.innerHTML = f === 0 ? 'The pipe is empty, so all 5 units of room are forward room and there is nothing to take back.'
        : f === CAP ? 'The pipe is full. The forward arc has vanished, but the reverse arc has room 5: all of the flow could still be taken back.'
        : 'Each unit of flow moves one unit of room from the forward arc to the reverse arc. The two always add up to the capacity, ' + CAP + '.';
    }
    V.slider(fig.querySelector('[data-slider]'), { label: 'Flow f on u→v', min: 0, max: CAP, value: 2, format: function (v) { return v + ' of ' + CAP; }, onInput: set });
    set(2);
    V.quiz('#quiz-residual', {
      id: 'nf-quiz-residual',
      question: 'A pipe u→v has capacity 8 and currently carries flow 3. What is the room on the reverse arc v→u, and what is the room on the forward arc u→v?',
      options: ['Reverse 3, forward 5', 'Reverse 5, forward 3', 'Reverse 8, forward 0', 'Reverse 3, forward 8'],
      answer: 0,
      explain: [
        'Yes. The reverse arc offers exactly the flow that could be taken back, 3. The forward arc offers the unused room, 8 − 3 = 5.',
        'These are swapped. The reverse arc can only undo flow that exists, so its room equals the flow, 3; the forward arc has the leftover 8 − 3 = 5.',
        'Room 0 forward would mean the pipe is full, but it carries only 3 of 8. And the reverse arc cannot take back more than the 3 units that are there.',
        'The forward room is what is left, 8 − 3 = 5, not the full capacity: 3 units already occupy the pipe.'
      ]
    });
  }

  /* ================================================================== the minimum cut, read off the final residual graph */
  function cutFigure(fig) {
    var net = L.MAIN;
    var full = NF.trace(net);
    var lastPush = 0;
    full.forEach(function (st, i) { if (st.kind === 'push') lastPush = i; });
    var steps = full.slice(lastPush).map(function (st, i) {
      var o = L.fixVars(st);
      if (i === 0) o.caption = 'The last augmentation is done and the total is <b>' + st.value + '</b>. Is there another route? To find out, run the same search once more, in the residual graph on the right.';
      return o;
    });
    var pair = L.pair(fig, net, { maxHeight: 340, leftLabel: 'Pipes at the end', rightLabel: 'Final residual graph' });
    L.legend(fig.querySelector('[data-legend]'), [L.LEG.queued, L.LEG.visited, L.LEG.current, L.LEG.cut, L.LEG.full]);
    var eq = fig.querySelector('[data-eq]');
    function eqText(step) { return '<span>Cut capacity</span> <b>' + step.cut.caps.join(' + ') + ' = ' + step.cut.value + '</b> <span>=</span> <span>max flow</span> <b>' + step.value + '</b>'; }
    steps.forEach(function (s) { if (s.kind === 'cut') eq.innerHTML = eqText(s); });   // reserve the banner's height from the first step
    var player = V.player({
      root: fig, steps: steps,
      render: function (step, ctx) {
        pair.render(step, ctx, { levels: true });
        if (step.kind === 'cut') {
          eq.innerHTML = eqText(step);
          eq.classList.add('is-on');
        } else { eq.classList.remove('is-on'); }
      },
      caption: fig.querySelector('[data-caption]'), counters: fig.querySelector('[data-counters]'),
      counterLabels: { value: 'Flow value', augmentations: 'Augmentations', scans: 'Arcs examined' }, counterStates: { value: 'done' },
      baseStepMs: 1300, label: 'Minimum cut controls'
    });
    void player;
  }

  /* An explorer: click vertices to move them to the source side, watch the cut capacity. */
  function explorerFigure(fig) {
    var net = L.MAIN, N = L.norm(net);
    var res = NF.trace(net, { detail: 'rounds' });
    var fin = L.last(res), maxV = fin.value;
    var minCut = fin.cut;
    var total = N.edges.reduce(function (a, e) { return a + e.cap; }, 0);
    var view = V.views.graph(fig.querySelector('[data-stage]'), { directed: true, bounds: { w: 1000, h: 600 }, maxHeight: 440, label: 'Cut explorer: click a vertex to move it between the two sides', nodeRadius: 24 });
    var inS = {};
    inS[N.source] = true;
    var best = Infinity;
    var read = fig.querySelector('[data-read]'), meterFill = fig.querySelector('[data-fill]'), meterMark = fig.querySelector('[data-mark]'), bestEl = fig.querySelector('[data-best]');
    meterMark.style.left = (maxV / total * 100) + '%';
    if (maxV / total < 0.3) meterMark.classList.add('is-lo'); else if (maxV / total > 0.7) meterMark.classList.add('is-hi');
    L.legend(fig.querySelector('[data-legend]'), [L.LEG.side, { state: 'default', shape: 'outline', label: 'Sink side T' }, L.LEG.cut, { state: 'muted', shape: 'line', label: 'Edge back into S (does not count)' }]);
    function render(ms) {
      var S = N.ids.filter(function (id) { return inS[id]; });
      var caps = [], edgesCut = {};
      N.edges.forEach(function (e) { if (inS[e.from] && !inS[e.to]) { caps.push(e.cap); edgesCut[e.id] = 'cut'; } else if (!inS[e.from] && inS[e.to]) edgesCut[e.id] = 'back'; });
      var val = caps.reduce(function (a, b) { return a + b; }, 0);
      var st = { fl: fin.fl, states: {}, kind: 'x', cut: null };
      N.ids.forEach(function (id) { st.states[id] = inS[id] ? 'frontier' : 'default'; });
      var gs = L.flowState(net, st, { spread: true });
      gs.nodes.forEach(function (n) { if (n.id === N.sink) n.state = 'key'; });
      gs.edges.forEach(function (e) { if (edgesCut[e.id] === 'cut') e.state = 'error'; else if (edgesCut[e.id] === 'back') e.state = 'muted'; });
      view.render(gs, { duration: ms });
      var eqMin = val === maxV;
      read.innerHTML = '<span class="nf-read__k">Source side S</span> <b>{' + S.join(', ') + '}</b><br><span class="nf-read__k">Edges leaving S</span> <b>' + (caps.length ? caps.join(' + ') + ' = ' + val : '0') + '</b>' +
        '<br><span class="nf-read__k">Max flow</span> <b>' + maxV + '</b> <span class="nf-read__cmp ' + (eqMin ? 'is-eq' : '') + '">' + (eqMin ? 'equal: this is a minimum cut' : 'your cut is ' + (val - maxV) + ' above it') + '</span>';
      meterFill.style.width = Math.min(100, val / total * 100) + '%';
      meterFill.classList.toggle('is-eq', eqMin);
      if (val < best) best = val;
      bestEl.textContent = 'Lowest cut you have found: ' + best;
      fig.querySelector('[data-caption]').innerHTML = eqMin
        ? 'Every cut has capacity at least the max flow, and this one matches it exactly. No flow can ever beat it, and no smaller cut exists: <b>max flow = min cut</b>.'
        : 'Only edges going <em>from</em> S <em>to</em> the sink side count. This cut is <b>' + val + '</b>, never below <b>' + maxV + '</b>: however you split the vertices, the whole flow must cross the split.';
    }
    view.on('click', function (e) {
      if (e.kind !== 'node') return;
      if (e.id === N.source || e.id === N.sink) return;
      inS[e.id] = !inS[e.id];
      render(350);
    });
    fig.querySelector('[data-reset]').addEventListener('click', function () { inS = {}; inS[N.source] = true; render(350); });
    fig.querySelector('[data-min]').addEventListener('click', function () { inS = {}; minCut.S.forEach(function (id) { inS[id] = true; }); render(450); });
    render(0);
    V.quiz('#quiz-cut', {
      id: 'nf-quiz-cut',
      question: 'Take the cut with S = {s, a}. What is its capacity? Remember that only edges going from S out to the other side count.',
      options: ['15', '22', '8', '12'],
      answer: 0,
      explain: [
        'Yes. The edges that leave S are s→b (7), a→c (7) and a→d (1): 7 + 7 + 1 = 15. The edge s→a stays inside S, so it does not count.',
        '22 adds s→a (7), but s and a are both in S, so that edge never crosses the cut.',
        '8 counts only a→c and a→d and forgets s→b. Every edge from S to the outside counts, wherever it starts.',
        '12 is the maximum flow, and it is the capacity of the <em>smallest</em> cut. This particular cut is bigger. Try it in the explorer above.'
      ]
    });
  }

  V.ready(function () {
    L.lazy('#fig-greedy', greedyFigure);
    L.lazy('#fig-residual', residualFigure);
    L.lazy('#fig-cut', cutFigure);
    L.lazy('#fig-explorer', explorerFigure);
  });
}());
