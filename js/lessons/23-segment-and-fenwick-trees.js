/* Lesson 23 — Segment & Fenwick trees: boot, checks and lazy start-up of every figure.
   Step generators: js/algos/23-segment-and-fenwick-trees.js (VDSA.algos.rangeTrees).
   Views: js/lessons/23-segment-and-fenwick-trees-views.js. Small figures: ...-figs.js. Labs, chart, decision diagram: ...-labs.js. */
(function () {
  'use strict';
  var V = window.VDSA;
  var L = V.lessons.l23;

  function checks() {
    V.quiz('#quiz-visit', L.mix({
      kicker: 'Predict', id: 'l23-quiz-used',
      question: 'On a tree over 8 cells, the query <code>a[1..6]</code> is answered. How many <em>stored values</em> does it add together?',
      options: ['6, one per cell in the range', '4: the blocks [1], [2,3], [4,5] and [6]', '2: a left half and a right half', '3'],
      answer: 1,
      explain: [
        'Six is the number of cells, and that is the cost of the plain loop. The tree combines whole blocks, so it uses fewer values.',
        'Right. Cell 1 is alone because its neighbour cell 0 is outside the range; [2,3] and [4,5] are whole blocks; cell 6 is alone because cell 7 is outside. Four stored values cover six cells, and the walk visits 11 of the 15 nodes to find them.',
        'Two blocks would have to be [1,3] and [4,6], but the tree has no such nodes: its blocks are aligned to halves of halves. That alignment is exactly why the tree is small.',
        'Three is not enough to tile six cells with aligned blocks: the range needs two single cells at its ends and at least two 2-cell blocks between them.'
      ]
    }));
    V.quiz('#quiz-fen', L.mix({
      kicker: 'Predict', id: 'l23-quiz-fen13',
      question: 'A Fenwick tree answers <code>prefix(13)</code>. Which indices does it read, in order?',
      options: ['13, 12, 8', '13, 12, 11, 10, 9, 8, …, 1', '13, 14, 16', '13, 9, 5, 1'],
      answer: 0,
      explain: [
        'Right. 13 = 1101, lowest set bit 1: read T[13], go to 12. 12 = 1100, lowest set bit 4: read T[12] (a[9..12]), go to 8. 8 = 1000: read T[8] (a[1..8]), go to 0. Three blocks for three set bits.',
        'That is the plain loop, one cell at a time. The point of the tree is that T[12] already holds a[9..12], four cells in one read.',
        'Going up (adding the lowest set bit) is what an update does. A prefix query only needs the blocks below 13, so it strips bits.',
        'Subtracting 4 each time would ignore the binary structure: 13 − 4 = 9 is not where T[13] stops covering cells. The step size is the lowest set bit of the current index, which changes.'
      ]
    }));
    V.quiz('#quiz-update', L.mix({
      id: 'l23-quiz-update-cost',
      question: 'A segment tree covers 1,000,000 cells. About how many nodes does one point update rewrite?',
      options: ['About 21: the leaf and one ancestor per level', 'About 1,000,000: every node might be stale', 'About 1,000, the square root of n', 'Exactly 2: the leaf and the root'],
      answer: 0,
      explain: [
        'Right. The tree has about log₂(1,000,000) ≈ 20 levels, and the changed cell has one ancestor on each, plus the leaf itself: about 21 nodes.',
        'Only nodes whose segment contains the changed cell can be wrong, and there is one such node per level. All the others stay correct.',
        'The square root appears in other structures (sqrt decomposition). Here every level is halved, so the count is the number of halvings: about 20.',
        'The root’s sum depends on its children, and theirs on their children, so every node in between must be recomputed, not just the ends of the path.'
      ]
    }));
    V.quiz('#quiz-fenwhy', L.mix({
      id: 'l23-quiz-fen-min',
      question: 'Why can a Fenwick tree answer range <em>sums</em> but not range <em>minimums</em> with the same trick?',
      options: [
        'A range is prefix(r) − prefix(l − 1), and minimum has no inverse to subtract with',
        'Minimum is not associative, so the blocks cannot be combined',
        'A Fenwick tree cannot store negative numbers',
        'The lowest-set-bit trick only works for addition'
      ],
      answer: 0,
      explain: [
        'Right. Knowing the minimum of a[1..r] and of a[1..l − 1] does not give the minimum of a[l..r]: you cannot “take away” a prefix. Sums can be subtracted; minimums cannot. (A Fenwick tree does work for prefix minimum when values only decrease.)',
        'Minimum is associative: min(min(a, b), c) = min(a, min(b, c)). Segment trees rely on exactly that, and they handle minimum well.',
        'Negative numbers are fine in a Fenwick tree; the bit trick works on indices, not on the stored values.',
        'The bit trick only decides which blocks to visit. It is independent of what you combine them with; the problem is the subtraction at the end.'
      ]
    }));
  }

  V.ready(function () {
    // the labs start lazily; register their predictions now so the page score counts them from the start
    if (V.quizScore && V.quizScore.register) ['l23-lab-query-inside', 'l23-lab-update-path', 'l23-lazy-push', 'l23-fen-prefix-jump', 'l23-fen-update-jump', 'l23-click-cover'].forEach(V.quizScore.register);
    L.heroTeaser();
    checks();
    L.summaryCard();
    L.whenNear('#fig-three', L.threeWays);
    L.whenNear('#fig-cover', L.coverExplorer);
    L.whenNear('#mini-kinds', L.kindMinis);
    L.whenNear('#fig-build', L.buildFigure);
    L.whenNear('#fig-query', L.queryFigure);
    L.whenNear('#fig-update', L.updateFigure);
    L.whenNear('#lab-fig', function () { L.segLab = L.initSegLab(); });
    L.whenNear('#fig-lazy', function () { L.lazyLab = L.initLazyLab(); });
    L.whenNear('#fig-lowbit', L.lowbitExplorer);
    L.whenNear('#fig-resp', L.responsibility);
    L.whenNear('#fen-lab', function () { L.fenLab = L.initFenLab(); });
    L.whenNear('#fig-cost', L.initCost);
    L.whenNear('#fig-choose', L.initChoose);
    L.whenNear('#variants', L.variationMinis);
    L.whenNear('#fig-click', L.clickFigure);
  });
}());
