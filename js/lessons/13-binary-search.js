/* Lesson 13 — Binary search: boot file.
   Step generators: js/algos/13-binary-search.js (VDSA.algos.binarySearch).
   Figures: 13-binary-search-figs.js (hero, linear, guess game, halving, probe, walkthrough),
            13-binary-search-lab.js (lab + flowchart, decision tree, race),
            13-binary-search-more.js (cost, boundaries, search on the answer, bisection, bugs, chooser, checks, summary).
   Heavy figures start lazily as they approach the viewport. */
(function () {
  'use strict';
  var V = window.VDSA;
  var L = V.lessons.l13;
  V.ready(function () {
    // figures that start lazily register their prediction ids now, so the page score counts them from the start
    if (V.quizScore && V.quizScore.register) ['l13-lab-lohi', 'l13-lab-answer', 'l13-answer-test'].forEach(V.quizScore.register);
    L.heroTeaser();
    L.initChecks();
    L.summaryCard();
    L.whenNear('#fig-linear', L.linearFigure);
    L.whenNear('#fig-guess', L.guessFigure);
    L.whenNear('#fig-halving', L.halvingFigure);
    L.whenNear('#fig-probe', L.probeFigure);
    L.whenNear('#fig-walk', L.walkFigure);
    L.whenNear('#lab-fig', function () { L.lab = L.initLab(); });
    L.whenNear('#fig-tree', L.initTree);
    L.whenNear('#fig-race', L.initRace);
    L.whenNear('#fig-growth', L.initGrowth);
    L.whenNear('#fig-scale', L.initScale);
    L.whenNear('#fig-bounds', L.initBounds);
    L.whenNear('#fig-answer', L.initAnswer);
    L.whenNear('#fig-bisect', L.initBisect);
    L.whenNear('#fig-overflow', L.initOverflow);
    L.whenNear('#fig-bugs', L.initBugs);
    L.whenNear('#fig-choose', L.initChooser);
  });
}());
