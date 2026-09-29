#!/usr/bin/env node
/* Builds studies/index.html (the deep-study library) from the theme list below plus js/curriculum.js
   (for each card's related lessons) and lessons/*.html (which lessons exist).
   Usage: node dev/build-studies-index.js   (re-run when lessons land or studies change) */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const C = require(path.join(root, 'js', 'curriculum.js'));
const esc = s => s.replace(/&(?![a-z#0-9]+;)/gi, '&amp;');
const GROUPS = [
 {
  "title": "Models and foundations",
  "desc": "The cost model, physical layout, and proof tools.",
  "items": [
   {
    "file": "dsa-00-cost-of-a-computation.html",
    "no": "00",
    "title": "The cost of a computation",
    "note": "Count operations, distinguish bounds from cases."
   },
   {
    "file": "dsa-01-linear-layouts-and-access-disciplines.html",
    "no": "01",
    "title": "Linear layouts and access disciplines",
    "note": "Derive arrays, lists, stacks, queues, and locality from memory layout."
   },
   {
    "file": "dsa-02-amortized-cost-aggregate-accounting-potential.html",
    "no": "02",
    "title": "Amortized cost",
    "note": "Make an expensive resize cheap across a sequence of operations."
   },
   {
    "file": "dsa-03-divide-solve-combine.html",
    "no": "03",
    "title": "Divide, solve, combine",
    "note": "Read merge sort and recurrences as work across a recursion tree."
   }
  ]
 },
 {
  "title": "Better algorithms",
  "desc": "Representation, probability, and the limits of comparison sorting.",
  "items": [
   {
    "file": "dsa-04-fast-fourier-transform.html",
    "no": "04",
    "title": "The fast Fourier transform",
    "note": "Change representation to make polynomial multiplication fast."
   },
   {
    "file": "dsa-05-probability-for-algorithms.html",
    "no": "05",
    "title": "Probability for algorithms",
    "note": "Use indicator variables and concentration to reason about randomness."
   },
   {
    "file": "dsa-06-sorting-and-the-comparison-barrier.html",
    "no": "06",
    "title": "Sorting and the comparison barrier",
    "note": "See the decision-tree lower bound and ways around its model."
   }
  ]
 },
 {
  "title": "Structured data",
  "desc": "Dictionaries, priority, and changing range queries.",
  "items": [
   {
    "file": "dsa-07-balanced-search-trees.html",
    "no": "07",
    "title": "Balanced search trees",
    "note": "Use rotations and invariants to guarantee logarithmic height."
   },
   {
    "file": "dsa-08-hashing-and-expected-constant-access.html",
    "no": "08",
    "title": "Hashing and expected constant access",
    "note": "Make collisions, load factor, and randomized guarantees concrete."
   },
   {
    "file": "dsa-09-partial-order-is-enough-heaps-and-priority-queues.html",
    "no": "09",
    "title": "Heaps and priority queues",
    "note": "Keep only the order needed to find an extreme."
   },
   {
    "file": "dsa-10-range-queries-fenwick-and-segment-trees.html",
    "no": "10",
    "title": "Fenwick and segment trees",
    "note": "Answer changing range queries by storing aggregates at many scales."
   }
  ]
 },
 {
  "title": "Graphs and paths",
  "desc": "Traversal, connectivity, shortest paths, and optimal substructure.",
  "items": [
   {
    "file": "dsa-11-graphs-and-their-traversals.html",
    "no": "11",
    "title": "Graphs and their traversals",
    "note": "Understand BFS, DFS, topological order, and components from one walk."
   },
   {
    "file": "dsa-12-minimum-spanning-trees-and-union-find.html",
    "no": "12",
    "title": "Minimum spanning trees and union-find",
    "note": "Connect everything cheaply, and prove each edge is safe."
   },
   {
    "file": "dsa-13-single-source-shortest-paths.html",
    "no": "13",
    "title": "Single-source shortest paths",
    "note": "Relax edges in the order your weight assumptions allow."
   },
   {
    "file": "dsa-14-all-pairs-shortest-paths-floyd-warshall-johnson.html",
    "no": "14",
    "title": "All-pairs shortest paths",
    "note": "Add an intermediate-vertex dimension or reweight edges."
   },
   {
    "file": "dsa-15-dynamic-programming-optimal-substructure-over-a-subproblem-dag.html",
    "no": "15",
    "title": "Dynamic programming",
    "note": "Make overlapping subproblems into a DAG you can evaluate once."
   }
  ]
 },
 {
  "title": "Choices and text",
  "desc": "Greedy proof, flow, matching, and string indexes.",
  "items": [
   {
    "file": "dsa-16-when-is-greedy-optimal-exchange-arguments-and-matroids.html",
    "no": "16",
    "title": "When greedy is optimal",
    "note": "Prove local choices with exchanges, and find counterexamples."
   },
   {
    "file": "dsa-17-max-flow-min-cut-and-the-power-of-duality.html",
    "no": "17",
    "title": "Max-flow and min-cut",
    "note": "Use residual edges to undo choices and certify an optimum."
   },
   {
    "file": "dsa-18-linear-time-exact-matching.html",
    "no": "18",
    "title": "Linear-time exact matching",
    "note": "Precompute pattern structure to avoid rescanning text."
   },
   {
    "file": "dsa-19-tries-and-suffix-structures.html",
    "no": "19",
    "title": "Tries and suffix structures",
    "note": "Index prefixes and substrings for repeated queries."
   }
  ]
 },
 {
  "title": "Limits and new tools",
  "desc": "Hardness, approximation, randomization, and research frontiers.",
  "items": [
   {
    "file": "dsa-20-p-np-reductions-and-np-completeness.html",
    "no": "20",
    "title": "P, NP, and reductions",
    "note": "Learn how to transfer difficulty from one problem to another."
   },
   {
    "file": "dsa-21-living-with-hardness-approximation-and-parameterized-algorithms.html",
    "no": "21",
    "title": "Living with hardness",
    "note": "Choose approximation or parameters when exact general solutions are costly."
   },
   {
    "file": "dsa-22-randomness-as-a-design-tool.html",
    "no": "22",
    "title": "Randomness as a design tool",
    "note": "Compare Las Vegas and Monte Carlo guarantees in real structures."
   },
   {
    "file": "dsa-23-the-frontier-fine-grained-sublinear-predictions-p-vs-np.html",
    "no": "23",
    "title": "The frontier",
    "note": "Explore fine-grained, streaming, predictive, and quantum models."
   }
  ]
 }
];

const lessonChips = file => {
  const rel = C.lessons.filter(l => l.study === 'studies/' + file);
  if (!rel.length) return '<span class="is-soon">Stands on its own</span>';
  return rel.map(l => {
    const label = 'Lesson ' + l.number + ' · ' + esc(l.title);
    return fs.existsSync(path.join(root, 'lessons', l.id + '.html'))
      ? '<a href="../lessons/' + l.id + '.html">' + label + '</a>'
      : '<span class="is-soon">' + label + ' (coming soon)</span>';
  }).join('');
};
const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
const search = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const groups = GROUPS.map((g, i) => {
  const n = String(i + 1).padStart(2, '0');
  const cards = g.items.map(it => `<li class="lib-card">
<span class="lib-card__no">Study ${it.no}</span>
<h3 class="lib-card__title"><a href="${it.file}">${esc(it.title)}</a></h3>
<p class="lib-card__note">${esc(it.note)}</p>
<div class="lib-card__lessons" aria-label="Related lessons">${lessonChips(it.file)}</div>
</li>`).join('\n');
  return `<section class="lib-group" aria-labelledby="group-${n}">
<div class="lib-group__head"><span class="lib-group__num">${n} / 0${GROUPS.length}</span><h2 id="group-${n}">${esc(g.title)}</h2><p>${esc(g.desc)}</p></div>
<ol class="lib-grid">
${cards}
</ol>
</section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#fbfaf7">
<title>Deep studies · Visual DSA</title>
<meta name="description" content="${total} long-form studies on data structures, algorithms, proofs and computational limits: the reference shelf behind the Visual DSA lessons.">
<link rel="stylesheet" href="../css/tokens.css">
<link rel="stylesheet" href="../css/vdsa.css">
<script src="../js/vdsa/core.js"></script>
<script src="../js/curriculum.js" defer></script>
<script src="../js/vdsa/shell.js" defer></script>
<link rel="stylesheet" href="studies.css?v=vdsa1">
<script src="studies.js?v=vdsa1" defer></script>
</head>
<body class="lib" data-page="study" data-crumb="Deep studies">
<main id="main">
<header class="lib-hero">
<p class="kicker">Further reading</p>
<h1>Deep studies</h1>
<p class="lead">${total} long-form lectures that start from a concrete problem, derive the structure or algorithm, and end with exercises. Start with a <a href="../index.html">lesson</a> to see it move, then come here for the proofs and the edge cases.</p>
</header>
<div class="lib-tools" role="search">
<label for="study-search">${search}<span class="sr-only">Find a deep study</span><input id="study-search" type="search" placeholder="Search: graphs, hashing, proofs…" autocomplete="off"></label>
<p class="lib-count" id="study-count" role="status" aria-live="polite">${total} studies across ${GROUPS.length} themes</p>
</div>
<div class="lib-body">
${groups}
<p class="lib-empty" id="study-empty" hidden>No study matches that search. Try a broader term.</p>
</div>
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'studies', 'index.html'), html);
console.log('wrote studies/index.html with ' + total + ' studies');
