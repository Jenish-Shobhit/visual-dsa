/* Graph studio: lessons 28 and 29 both publish VDSA.algos.shortestPaths, and the second script replaces the first.
   This tiny script runs between them and keeps lesson 28's API (Dijkstra) as VDSA.algos.sp28. */
(function () { 'use strict'; var A = window.VDSA && window.VDSA.algos; if (A && A.shortestPaths) A.sp28 = Object.assign({}, A.shortestPaths);   /* a copy: lesson 29 merges into the same object with Object.assign */ }());
