/* Iterative sift-down keeps the sorting algorithm's extra space O(1). */
SortLab.register('heap', {
  title: 'Heap sort',
  idea: 'Build a max heap, move its root to the right edge, and restore the heap on what remains.',
  invariant: 'The unsorted prefix is a max heap; the settled suffix contains final values.',
  best: 'Θ(n log n)', average: 'Θ(n log n)', worst: 'Θ(n log n)', space: 'O(1)', stable: 'No',
  detail: 'The sift-down loop is iterative. The visualization stores frames separately; that is not algorithm working space.',
  sort: function (t) {
    function siftDown(start, size) {
      var root = start;
      while (2 * root + 1 < size) {
        var left = 2 * root + 1;
        var right = left + 1;
        var largest = root;
        if (t.compare(left, largest, 'Compare parent and left child in the heap.') > 0) largest = left;
        if (right < size && t.compare(right, largest, 'Compare the right child with the largest seen.') > 0) largest = right;
        if (largest === root) {
          t.note('The parent is at least as large as its children. Stop sifting here.', [root]);
          return;
        }
        t.swap(root, largest, 'Swap the parent with its larger child to restore the heap rule.');
        root = largest;
      }
    }
    for (var i = Math.floor(t.length / 2) - 1; i >= 0; i--) siftDown(i, t.length);
    t.note('The array prefix is now a max heap: its root is the largest value.', [0]);
    for (var end = t.length - 1; end > 0; end--) {
      t.swap(0, end, 'Move the maximum to final position ' + end + '.');
      t.mark([end], 'Position ' + end + ' is final; the heap is one value shorter.');
      siftDown(0, end);
    }
    t.mark([0], 'The final root is the smallest remaining value.');
  }
});
