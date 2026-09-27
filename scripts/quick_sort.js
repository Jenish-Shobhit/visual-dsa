/* The first value is the pivot, as in the original visualizer. */
SortLab.register('quick', {
  title: 'Quick sort',
  idea: 'Place one pivot so smaller values are left and larger or equal values are right, then repeat on each side.',
  invariant: 'A placed pivot is final. The rest of its partition still needs sorting.',
  best: 'Θ(n log n)', average: 'Θ(n log n)', worst: 'Θ(n²)', space: 'O(n) worst', stable: 'No',
  detail: 'Choosing the first value as pivot can create a chain of recursive calls on ordered input; average stack use is O(log n).',
  sort: function (t) {
    function sort(lo, hi) {
      if (lo > hi) return;
      if (lo === hi) {
        t.mark([lo], 'This one-value partition is already in its final position.');
        return;
      }
      var pivot = t.at(lo);
      var boundary = lo + 1;
      t.note('Use ' + pivot.value + ' at position ' + lo + ' as the pivot.', [lo]);
      for (var j = lo + 1; j <= hi; j++) {
        if (t.compareItems(t.at(j), pivot, 'Is ' + t.at(j).value + ' smaller than pivot ' + pivot.value + '?', [lo, j]) < 0) {
          t.swap(boundary, j, 'Move this smaller value to the left partition.');
          boundary++;
        }
      }
      t.swap(lo, boundary - 1, 'Put the pivot between the smaller and larger-or-equal partitions.');
      t.mark([boundary - 1], 'Pivot ' + pivot.value + ' is now in its final position.');
      sort(lo, boundary - 2);
      sort(boundary, hi);
    }
    sort(0, t.length - 1);
  }
});
