/* A single curriculum map powers navigation, search and local reading progress. */
(function () {
  'use strict';
  var chapters = [
    ['01-what-is-code','What is code?','Follow instructions as they change memory and output.','Foundations',8],
    ['02-memory-and-variables','Memory & variables','Represent a value. Give it a name. Follow its lifetime.','Foundations',9],
    ['04-decisions-and-loops','Decisions & loops','Turn a condition into a different next instruction.','Foundations',10],
    ['05-functions-and-references','Functions & references','Follow a call, a return, and two names for one object.','Foundations',12],
    ['03-arrays-and-strings','Arrays & strings','Discover what a sequence makes easy and expensive.','Foundations',10],
    ['06-how-to-reason','Reasoning about code','Explain why a loop is right, for every valid input.','Reasoning',12],
    ['04-complexity','Time & space complexity','Count the work as the input grows.','Reasoning',10],
    ['05-sorting','Sorting algorithms','Six strategies. One input. Very different work.','Reasoning',12],
    ['06-searching','Searching','Use a comparison to eliminate possibilities.','Reasoning',12],
    ['07-linked-lists','Linked lists','Build a sequence out of connections.','Structures',10],
    ['08-stacks-and-queues','Stacks & queues','Discover the power of restricting the next operation.','Structures',10],
    ['09-hashing','Hash tables','Turn a key into a place to look. Handle collisions.','Structures',10],
    ['10-recursion','Recursion','Follow smaller calls without losing the bigger picture.','Structures',10],
    ['11-trees','Trees','Use branching to organize information.','Structures',10],
    ['12-heaps','Heaps & priority queues','Keep the next most important item within reach.','Structures',10],
    ['13-graphs','Graphs','Explore connections with a frontier and a memory.','Connections',12],
    ['14-dynamic-programming','Dynamic programming','Solve a repeated subproblem once. Reuse the answer.','Connections',12]
  ];
  var keywords = ['program instruction machine execute fetch decode state compiler interpreter', 'bits bytes RAM variable storage address memory reference', 'if else while for branch condition iteration loop', 'call stack function parameter return reference pointer alias pass value', 'array string index contiguous sequence character unicode', 'invariant correctness proof termination induction debugging', 'big O theta omega asymptotic time space growth complexity', 'bubble selection insertion merge quick heap sorting stable', 'binary search linear lower bound first match sorted', 'linked list pointer reference node insert delete', 'stack queue FIFO LIFO deque', 'hash map dictionary collision load factor', 'recursive call stack base case', 'binary search tree BST traversal inorder preorder', 'min heap max heap priority queue', 'BFS DFS graph breadth first depth first traversal adjacency', 'DP dynamic programming memoization tabulation subproblem'];
  window.DSA_CHAPTERS = chapters.map(function (c, i) { return {href:'chapters/'+c[0]+'.html', title:c[1], description:c[2], group:c[3], minutes:c[4], number:i+1, keywords:keywords[i]}; });
  window.DSA_STUDIES = [
  {
    "href": "studies/dsa-00-cost-of-a-computation.html",
    "group": "Deep studies",
    "title": "The cost of a computation",
    "description": "Count operations, distinguish bounds from cases."
  },
  {
    "href": "studies/dsa-01-linear-layouts-and-access-disciplines.html",
    "group": "Deep studies",
    "title": "Linear layouts and access disciplines",
    "description": "Derive arrays, lists, stacks, queues, and locality from memory layout."
  },
  {
    "href": "studies/dsa-02-amortized-cost-aggregate-accounting-potential.html",
    "group": "Deep studies",
    "title": "Amortized cost",
    "description": "Make an expensive resize cheap across a sequence of operations."
  },
  {
    "href": "studies/dsa-03-divide-solve-combine.html",
    "group": "Deep studies",
    "title": "Divide, solve, combine",
    "description": "Read merge sort and recurrences as work across a recursion tree."
  },
  {
    "href": "studies/dsa-04-fast-fourier-transform.html",
    "group": "Deep studies",
    "title": "The fast Fourier transform",
    "description": "Change representation to make polynomial multiplication fast."
  },
  {
    "href": "studies/dsa-05-probability-for-algorithms.html",
    "group": "Deep studies",
    "title": "Probability for algorithms",
    "description": "Use indicator variables and concentration to reason about randomness."
  },
  {
    "href": "studies/dsa-06-sorting-and-the-comparison-barrier.html",
    "group": "Deep studies",
    "title": "Sorting and the comparison barrier",
    "description": "See the decision-tree lower bound and ways around its model."
  },
  {
    "href": "studies/dsa-07-balanced-search-trees.html",
    "group": "Deep studies",
    "title": "Balanced search trees",
    "description": "Use rotations and invariants to guarantee logarithmic height."
  },
  {
    "href": "studies/dsa-08-hashing-and-expected-constant-access.html",
    "group": "Deep studies",
    "title": "Hashing and expected constant access",
    "description": "Make collisions, load factor, and randomized guarantees concrete."
  },
  {
    "href": "studies/dsa-09-partial-order-is-enough-heaps-and-priority-queues.html",
    "group": "Deep studies",
    "title": "Heaps and priority queues",
    "description": "Keep only the order needed to find an extreme."
  },
  {
    "href": "studies/dsa-10-range-queries-fenwick-and-segment-trees.html",
    "group": "Deep studies",
    "title": "Fenwick and segment trees",
    "description": "Answer changing range queries by storing aggregates at many scales."
  },
  {
    "href": "studies/dsa-11-graphs-and-their-traversals.html",
    "group": "Deep studies",
    "title": "Graphs and their traversals",
    "description": "Understand BFS, DFS, topological order, and components from one walk."
  },
  {
    "href": "studies/dsa-12-minimum-spanning-trees-and-union-find.html",
    "group": "Deep studies",
    "title": "Minimum spanning trees and union-find",
    "description": "Connect everything cheaply, and prove each edge is safe."
  },
  {
    "href": "studies/dsa-13-single-source-shortest-paths.html",
    "group": "Deep studies",
    "title": "Single-source shortest paths",
    "description": "Relax edges in the order your weight assumptions allow."
  },
  {
    "href": "studies/dsa-14-all-pairs-shortest-paths-floyd-warshall-johnson.html",
    "group": "Deep studies",
    "title": "All-pairs shortest paths",
    "description": "Add an intermediate-vertex dimension or reweight edges."
  },
  {
    "href": "studies/dsa-15-dynamic-programming-optimal-substructure-over-a-subproblem-dag.html",
    "group": "Deep studies",
    "title": "Dynamic programming",
    "description": "Make overlapping subproblems into a DAG you can evaluate once."
  },
  {
    "href": "studies/dsa-16-when-is-greedy-optimal-exchange-arguments-and-matroids.html",
    "group": "Deep studies",
    "title": "When greedy is optimal",
    "description": "Prove local choices with exchanges, and find counterexamples."
  },
  {
    "href": "studies/dsa-17-max-flow-min-cut-and-the-power-of-duality.html",
    "group": "Deep studies",
    "title": "Max-flow and min-cut",
    "description": "Use residual edges to undo choices and certify an optimum."
  },
  {
    "href": "studies/dsa-18-linear-time-exact-matching.html",
    "group": "Deep studies",
    "title": "Linear-time exact matching",
    "description": "Precompute pattern structure to avoid rescanning text."
  },
  {
    "href": "studies/dsa-19-tries-and-suffix-structures.html",
    "group": "Deep studies",
    "title": "Tries and suffix structures",
    "description": "Index prefixes and substrings for repeated queries."
  },
  {
    "href": "studies/dsa-20-p-np-reductions-and-np-completeness.html",
    "group": "Deep studies",
    "title": "P, NP, and reductions",
    "description": "Learn how to transfer difficulty from one problem to another."
  },
  {
    "href": "studies/dsa-21-living-with-hardness-approximation-and-parameterized-algorithms.html",
    "group": "Deep studies",
    "title": "Living with hardness",
    "description": "Choose approximation or parameters when exact general solutions are costly."
  },
  {
    "href": "studies/dsa-22-randomness-as-a-design-tool.html",
    "group": "Deep studies",
    "title": "Randomness as a design tool",
    "description": "Compare Las Vegas and Monte Carlo guarantees in real structures."
  },
  {
    "href": "studies/dsa-23-the-frontier-fine-grained-sublinear-predictions-p-vs-np.html",
    "group": "Deep studies",
    "title": "The frontier",
    "description": "Explore fine-grained, streaming, predictive, and quantum models."
  }
];
  window.DSA_STUDIES.forEach(function(s){s.keywords=s.href.replace(/[-/]/g,' ');if(s.href.includes('fourier'))s.keywords+=' FFT DFT convolution';if(s.href.includes('dynamic-programming'))s.keywords+=' DP memoization tabulation';if(s.href.includes('single-source'))s.keywords+=' Dijkstra Bellman Ford';if(s.href.includes('balanced'))s.keywords+=' AVL red black BST';});
  window.DSA_CATALOGUE = window.DSA_CHAPTERS.concat(window.DSA_STUDIES);
}());
