/* Gallery demos: VDSA.views.callstack (and its pairing with the tree view) */
(function () {
  'use strict';
  var G = Gallery;

  /* ---------- factorial ---------- */
  function factSteps(n) {
    var stack = [], steps = [];
    function snap(caption) { steps.push({ frames: stack.map(function (f) { return Object.assign({}, f, { locals: f.locals.slice() }); }), caption: caption }); }
    snap('main is about to call fact(' + n + ').');
    function fact(k) {
      var f = { id: 'fact' + k, fn: 'fact', args: 'n=' + k, locals: [['n', k]], line: 2 };
      stack.push(f);
      snap('Push a frame for fact(' + k + ').');
      var r;
      if (k <= 1) { f.line = 2; r = 1; }
      else {
        f.line = 3;
        var sub = fact(k - 1);
        f.locals = [['n', k], ['sub', sub]];
        f.line = 3;
        snap('fact(' + (k - 1) + ') returned ' + sub + ' into fact(' + k + ').');
        r = k * sub;
      }
      f.returnValue = r; f.state = 'done';
      snap('fact(' + k + ') returns ' + r + '.');
      stack.pop();
      return r;
    }
    stack.push({ id: 'main', fn: 'main', args: '', locals: [['result', '?']], line: 7 });
    fact(n);
    stack[0].locals = [['result', 24]];
    snap('The stack unwound back to main.');
    return steps;
  }

  G.demo('callstack', {
    id: 'fact', title: 'fact(4) — push, return, pop',
    note: 'Frames drop in from above; returning frames turn "done", show "returns v", lift off, and the value flies to the caller.',
    duration: 560, hold: 480,
    build: function (host) {
      var view = VDSA.views.callstack(host, { label: 'Call stack for fact(4)' });
      var steps = factSteps(4);
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });

  /* ---------- fib(4): recursion tree + call stack from the same steps ---------- */
  G.demo('callstack', {
    id: 'fib-pair', title: 'fib(4) — recursion tree and call stack together', wide: true,
    note: 'One step list drives both views: the tree shows every call so far, the stack shows only the calls still running.',
    duration: 520, hold: 440,
    build: function (host) {
      host.style.display = 'flex'; host.style.flexWrap = 'wrap'; host.style.gap = '12px'; host.style.alignItems = 'flex-start';
      var left = document.createElement('div'), right = document.createElement('div');
      left.style.flex = '3 1 320px'; left.style.minWidth = '0';
      right.style.flex = '2 1 240px'; right.style.minWidth = '0';
      host.appendChild(left); host.appendChild(right);
      var tree = VDSA.views.tree(left, { label: 'Recursion tree of fib(4)', nodeSize: 34 });
      var stack = VDSA.views.callstack(right, { label: 'Call stack of fib(4)', frameWidth: 240 });
      var steps = (window.__fibSteps || function () { return []; })(4);
      tree.prepare(steps);
      stack.prepare(steps.map(function (s) { return { frames: s.frames }; }));
      return {
        steps: steps,
        render: function (s, c) { tree.render(s, { duration: c.duration }); stack.render({ frames: s.frames }, { duration: c.duration }); }
      };
    }
  });

  /* ---------- deep recursion: collapsed frames ---------- */
  G.demo('callstack', {
    id: 'deep', title: 'sum(7) — deep recursion with maxVisible: 4',
    note: 'Older frames fold into "… n more frames" and unfold as the stack unwinds.',
    duration: 460, hold: 300,
    build: function (host) {
      var view = VDSA.views.callstack(host, { label: 'Deep recursion call stack', maxVisible: 4, frameWidth: 260 });
      var stack = [], steps = [];
      function snap(c) { steps.push({ frames: stack.map(function (f) { return Object.assign({}, f); }), caption: c }); }
      function sum(n) {
        stack.push({ id: 's' + n, fn: 'sum', args: 'n=' + n });
        snap('Call sum(' + n + ').');
        var r = n === 0 ? 0 : n + sum(n - 1);
        stack[stack.length - 1].returnValue = r; stack[stack.length - 1].state = 'done';
        snap('sum(' + n + ') returns ' + r + '.');
        stack.pop();
        return r;
      }
      sum(7);
      snap('Done.');
      view.prepare(steps);
      return { steps: steps, render: function (s, c) { view.render(s, { duration: c.duration }); } };
    }
  });
}());
