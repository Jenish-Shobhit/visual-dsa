/* Jenish Shobhit's bubble sort, traced one comparison at a time. */
SortLab.register('bubble', {
  title: 'Bubble sort',
  idea: 'Neighbors trade places until each pass leaves its largest value at the right edge.',
  invariant: 'After a complete pass, the settled suffix contains its final values.',
  best: 'Θ(n)', average: 'Θ(n²)', worst: 'Θ(n²)', space: 'O(1)', stable: 'Yes',
  detail: 'This version stops as soon as a pass makes no swaps. Equal values are never swapped.',
  sort: function (t) {
    for (var end = t.length - 1; end > 0; end--) {
      var changed = false;
      for (var j = 0; j < end; j++) {
        if (t.compare(j, j + 1, 'Compare neighboring values at ' + j + ' and ' + (j + 1) + '.') > 0) {
          t.swap(j, j + 1, 'They are out of order, so swap them.');
          changed = true;
        }
      }
      t.mark([end], 'The largest remaining value has reached position ' + end + '.');
      if (!changed) {
        var rest = [];
        for (var i = 0; i < end; i++) rest.push(i);
        t.mark(rest, 'No swap happened in this pass. The entire array is already sorted.');
        break;
      }
    }
  }
});
