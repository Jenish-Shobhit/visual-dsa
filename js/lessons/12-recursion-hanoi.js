/* Lesson 12 · Recursion — Tower of Hanoi lab.
   Discs (custom SVG in CSS pixels), a move timeline split into the root's three steps, the recursion tree of
   subproblems (VDSA.views.tree) and a code panel, all driven by one player from VDSA.algos.recursion.hanoi(n). */
(function () {
  'use strict';
  var V = window.VDSA, s = V.s;
  var RC = V.lessons.rec;
  var PEG = ['A', 'B', 'C'];

  var CODE = {
    pseudo: [
      'procedure hanoi(n, from, to, via)',
      '  if n = 1 then                         // @base',
      '    move disc 1: from → to              // @baseMove',
      '    return',
      '  hanoi(n − 1, from, via, to)           // @first',
      '  move disc n: from → to                // @middle',
      '  hanoi(n − 1, via, to, from)           // @second'
    ].join('\n'),
    js: [
      'function hanoi(n, from, to, via) {',
      '  if (n === 1) {                        // @base',
      '    move(1, from, to);                  // @baseMove',
      '    return;',
      '  }',
      '  hanoi(n - 1, from, via, to);          // @first',
      '  move(n, from, to);                    // @middle',
      '  hanoi(n - 1, via, to, from);          // @second',
      '}'
    ].join('\n'),
    py: [
      'def hanoi(n, src, dst, via):',
      '    if n == 1:                          # @base',
      '        move(1, src, dst)               # @baseMove',
      '        return',
      '    hanoi(n - 1, src, via, dst)         # @first',
      '    move(n, src, dst)                   # @middle',
      '    hanoi(n - 1, via, dst, src)         # @second'
    ].join('\n')
  };

  /* ------------------------------------------------------------------ discs + timeline view */
  function discsView(stage) {
    var fig = RC.pxFig(stage, { cls: 'rc-hanoi', label: 'Three pegs with discs', draw: draw, minWidth: 280 });
    var gBase = s('g', { class: 'rc-hbase' }), gArc = s('g', { class: 'rc-harc' }), gDiscs = s('g'), gTime = s('g', { class: 'rc-htime' });
    [gBase, gArc, gDiscs, gTime].forEach(function (e) { fig.svg.appendChild(e); });
    var discs = {}, n = 0, arcPath = s('path', {}), arcHead = s('path', { class: 'rc-harc__head' }), arcLabel = s('text', { 'text-anchor': 'middle' });
    gArc.appendChild(arcPath); gArc.appendChild(arcHead); gArc.appendChild(arcLabel);
    function build(count) {
      Object.keys(discs).forEach(function (k) { discs[k].remove(); });
      discs = {}; n = count;
      for (var d = 1; d <= count; d++) {
        var g = s('g', { class: 'rc-disc' });
        g.rect = s('rect', { rx: 7, ry: 7 });
        g.text = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(d));
        g.appendChild(g.rect); g.appendChild(g.text);
        g.style.setProperty('--p', (count > 1 ? Math.round((d - 1) / (count - 1) * 100) : 0) + '%');
        gDiscs.appendChild(g);
        discs[d] = g;
        g.__peg = null;
      }
    }
    function draw(arg, dur, W) {
      var step = arg.step, steps = arg.steps;
      if (step.n !== n) build(step.n);
      var dh = Math.min(24, Math.max(15, 150 / n)), baseY = 36 + n * dh + 26;
      var pegX = [W / 6, W / 2, 5 * W / 6];
      var maxW = Math.min(W / 3 - 14, 190), minW = Math.max(34, maxW * 0.28);
      function dw(d) { return n === 1 ? maxW * 0.6 : minW + (maxW - minW) * (d - 1) / (n - 1); }
      var TL = baseY + 66, H = TL + 50;
      // base, pegs and labels
      V.clear(gBase);
      gBase.appendChild(s('rect', { class: 'rc-hbase__plate', x: 8, y: baseY, width: W - 16, height: 8, rx: 4 }));
      pegX.forEach(function (x, i) {
        gBase.appendChild(s('rect', { class: 'rc-hbase__peg', x: x - 4, y: baseY - n * dh - 22, width: 8, height: n * dh + 22, rx: 4 }));
        gBase.appendChild(s('text', { class: 'rc-hbase__label', x: x, y: baseY + 25, 'text-anchor': 'middle' }, PEG[i]));
      });
      // subproblem focus: the discs of the active call (its top k discs)
      var focusK = step.active !== null && step.active !== undefined ? step.calls[step.active].k : 0;
      fig.svg.classList.toggle('has-focus', focusK > 0 && focusK < n && step.kind !== 'done');
      var moving = step.move && dur && arg.direction > 0 ? step.move.disc : (arg.prevMove && dur && arg.direction < 0 ? arg.prevMove.disc : null);
      step.pegs.forEach(function (pile, p) {
        pile.forEach(function (d, level) {
          var g = discs[d], w = dw(d);
          var x = pegX[p], y = baseY - (level + 1) * dh + 1;
          g.setAttribute('class', 'rc-disc' + (d <= focusK && step.kind !== 'done' ? ' is-focus' : '') + (d === moving ? ' is-moving' : ''));
          g.rect.setAttribute('x', -w / 2); g.rect.setAttribute('width', w); g.rect.setAttribute('y', 0); g.rect.setAttribute('height', dh - 2);
          g.text.setAttribute('y', (dh - 2) / 2); g.text.setAttribute('font-size', Math.min(13, dh * 0.62));
          var st = g.__vdsa || { x: x, y: y };
          if (g.__peg !== null && g.__peg !== p && dur) arcMove(g, st.x, st.y, x, y, baseY - n * dh - 34, dur);
          else V.animate(g, { x: x, y: y }, { duration: dur });
          g.__peg = p;
        });
      });
      // the move arrow between pegs
      var mv = step.move;
      if (mv) {
        var x1 = pegX[mv.from], x2 = pegX[mv.to], yTop = baseY - n * dh - 30, mid = (x1 + x2) / 2;
        var lift = 22 + Math.abs(x2 - x1) * 0.06;
        arcPath.setAttribute('d', 'M' + x1 + ' ' + yTop + 'Q' + mid + ' ' + (yTop - lift * 1.6) + ' ' + (x2 + (x2 > x1 ? -7 : 7)) + ' ' + (yTop - 2));
        var dir = x2 > x1 ? 1 : -1;
        arcHead.setAttribute('d', 'M' + x2 + ' ' + yTop + 'l' + (-dir * 10) + ' -7l' + (dir * 1) + ' 9z');
        arcLabel.setAttribute('x', mid); arcLabel.setAttribute('y', yTop - lift * 0.8 - 8);
        arcLabel.textContent = 'disc ' + mv.disc + ': ' + PEG[mv.from] + ' → ' + PEG[mv.to];
        gArc.style.opacity = 1;
      } else gArc.style.opacity = 0;
      // timeline of every move, split into the root call's three steps
      V.clear(gTime);
      var total = step.total, L = 12, R = 12, bw = W - L - R, cw = bw / total, half = (total - 1) / 2;
      gTime.appendChild(s('text', { class: 'rc-htime__title', x: L, y: TL - 14 }, 'All ' + total + ' move' + (total === 1 ? '' : 's') + ', in order'));
      var segs = total > 1 ? [[0, half, 'p1'], [half, half + 1, 'p2'], [half + 1, total, 'p3']] : [[0, 1, 'p2']];
      segs.forEach(function (sg) {
        var x = L + sg[0] * cw, w = (sg[1] - sg[0]) * cw;
        if (w <= 0) return;
        gTime.appendChild(s('rect', { class: 'rc-htime__seg rc-htime__seg--' + sg[2], x: x, y: TL, width: w, height: 16, rx: 3 }));
        var done = Math.max(0, Math.min(sg[1], step.moves) - sg[0]);
        if (done > 0) gTime.appendChild(s('rect', { class: 'rc-htime__done rc-htime__seg--' + sg[2], x: x, y: TL, width: done * cw, height: 16, rx: 3 }));
      });
      if (cw >= 5) for (var m = 1; m < total; m++) gTime.appendChild(s('line', { class: 'rc-htime__tick', x1: L + m * cw, x2: L + m * cw, y1: TL, y2: TL + 16 }));
      if (total > 1) {
        var labs = [[half / 2, 'hanoi(' + (n - 1) + ', A→B)'], [half + 0.5, 'disc ' + n], [half + 1 + half / 2, 'hanoi(' + (n - 1) + ', B→C)']];
        labs.forEach(function (lb, i) {
          var x = L + lb[0] * cw, tooNarrow = W < 440 && i !== 1;
          gTime.appendChild(s('text', { class: 'rc-htime__lab rc-htime__lab--' + (i + 1), x: x, y: TL + 34, 'text-anchor': 'middle' }, tooNarrow ? (i === 0 ? 'step 1' : 'step 3') : lb[1]));
        });
      }
      // bracket over the active call's own block of moves
      if (step.active !== null && step.active !== undefined && step.kind !== 'done') {
        var c = step.calls[step.active], blk = Math.pow(2, c.k) - 1;
        var bx = L + c.moveStart * cw, bwid = Math.max(3, blk * cw);
        gTime.appendChild(s('path', { class: 'rc-htime__bracket', d: 'M' + bx + ' ' + (TL - 3) + 'v-6h' + bwid + 'v6' }));
      }
      // current position marker
      var mx = L + step.moves * cw;
      gTime.appendChild(s('path', { class: 'rc-htime__marker', d: 'M' + mx + ' ' + (TL + 17) + 'l-5 8h10z' }));
      return H;
    }
    function arcMove(g, x0, y0, x1, y1, yTop, dur) {
      var st = g.__vdsa || (g.__vdsa = { x: x0, y: y0, scale: 1, rotate: 0, opacity: null, attr: {} });
      if (st.anim) st.anim.cancel();
      var up = Math.abs(y0 - yTop), across = Math.abs(x1 - x0), down = Math.abs(y1 - yTop), tot = up + across + down || 1;
      var a = up / tot, b = (up + across) / tot;
      st.anim = V.tween(V.dur(dur), function (t, e) {
        var x, y;
        if (e < a) { x = x0; y = V.lerp(y0, yTop, e / a); }
        else if (e < b) { x = V.lerp(x0, x1, (e - a) / (b - a)); y = yTop; }
        else { x = x1; y = V.lerp(yTop, y1, (e - b) / (1 - b)); }
        st.x = x; st.y = y;
        g.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')');
      }, { ease: 'inOut' });
    }
    return { render: function (arg, dur) { fig.render(arg, dur, arg); } };
  }

  /* ------------------------------------------------------------------ the lab */
  RC.hanoiLab = function (fig) {
    var A = V.algos.recursion;
    V.legend(fig.querySelector('[data-legend]'), [
      { state: 'active', label: 'Running call' },
      { state: 'frontier', label: 'Waiting call' },
      { state: 'done', label: 'Finished' },
      { state: 'default', shape: 'outline', label: 'Not called yet' }
    ]);
    var code = V.codePanel(fig.querySelector('[data-code]'), { languages: CODE, default: 'pseudo' });
    var vars = V.varsPanel(fig.querySelector('[data-vars]'), { states: { n: 'active' } });
    var discs = discsView(fig.querySelector('[data-discs]'));
    var treeHost = fig.querySelector('[data-tree]');
    var tree = V.views.tree(treeHost, { label: 'Recursion tree of Hanoi subproblems', nodeSize: 38, gap: 0.35 });
    var STATE = ['default', 'frontier', 'active', 'done'];
    var n = 3, movesOnly = false, full = [], steps = [];
    function treeState(step) {
      var calls = step.calls;
      return {
        root: 0,
        nodes: calls.map(function (c) {
          return { id: c.id, label: c.k + ' ' + PEG[c.from] + '→' + PEG[c.to], left: c.children[0], right: c.children[1], state: STATE[step.status[c.id] || 0] };
        })
      };
    }
    function make() {
      full = A.hanoi(n);
      steps = movesOnly ? full.filter(function (st, i) { return i === 0 || i === full.length - 1 || st.move; }) : full;
      tree.reset();
      tree.prepare([treeState(full[full.length - 1])]);
      return steps;
    }
    var prevStep = null;
    var player = V.player({
      root: fig,
      steps: make(),
      render: function (step, ctx) {
        var prevMove = ctx.prev && ctx.direction < 0 ? ctx.prev.move : null;
        discs.render({ step: step, steps: steps, direction: ctx.direction, prevMove: prevMove }, ctx.duration);
        tree.render(treeState(step), { duration: ctx.duration });
        prevStep = step;
      },
      code: code, vars: vars,
      caption: fig.querySelector('[data-caption]'),
      counters: fig.querySelector('[data-counters]'),
      counterLabels: { moves: 'Moves', calls: 'Calls made', depth: 'Stack depth' },
      counterStates: { moves: 'done', depth: 'frontier' },
      baseStepMs: 1000,
      speeds: [0.5, 1, 2, 4, 8, 16],
      label: 'Tower of Hanoi controls'
    });
    player.addCheckpoint(function (st) {
      for (var i = 1; i < st.length; i++) if (st[i].kind === 'middle' && st[i].active === 0) return i;
      return -1;
    }, function (c) {
      var k = c.step.n;
      return {
        question: 'The top ' + (k - 1) + ' disc' + (k - 1 === 1 ? ' is' : 's are') + ' parked on B. What is the next move?',
        options: ['Disc ' + k + ': A → C', 'Disc 1: B → C', 'Disc ' + k + ': A → B'],
        answer: 0,
        explain: ['A holds only disc ' + k + ' and C is empty, so the biggest disc can finally go straight to C. That is step 2 of the plan.',
          'Moving disc 1 now would start stacking the small discs on C before disc ' + k + ' is there, and disc ' + k + ' could never go under them.',
          'B already holds the parked discs, all smaller than disc ' + k + '. A larger disc may never sit on a smaller one.']
      };
    }, { id: 'hanoi-middle-move' });
    V.segmented(fig.querySelector('[data-n]'), {
      label: 'Number of discs',
      options: [1, 2, 3, 4, 5, 6, 7].map(function (k) { return { value: k, label: String(k) }; }),
      value: n,
      onChange: function (v) { n = v; player.setSteps(make()); }
    });
    V.toggle(fig.querySelector('[data-toggle]'), { label: 'Moves only (skip call steps)', checked: false, onChange: function (on) { movesOnly = on; player.setSteps(make()); } });
    return player;
  };
}());
