/* Selection sort keeps choosing the minimum of the unsorted suffix. */
SortLab.register('selection', {
  title: 'Selection sort',
  idea: 'Scan the remaining values, choose the smallest, and put it in the next open position.',
  invariant: 'The left prefix contains the smallest values in their final positions.',
  best: 'Θ(n²)', average: 'Θ(n²)', worst: 'Θ(n²)', space: 'O(1)', stable: 'No',
  detail: 'It makes few swaps, but still scans the full remainder. A distant swap can reverse equal values.',
  sort: function (t) {
    for (var i = 0; i < t.length - 1; i++) {
      var min = i;
      t.note('Find the smallest value from position ' + i + ' onward.', [i]);
      for (var j = i + 1; j < t.length; j++) {
        if (t.compare(j, min, 'Compare position ' + j + ' with the smallest seen so far at ' + min + '.') < 0) {
          min = j;
          t.note('A new smallest value is at position ' + min + '.', [min]);
        }
      }
      if (min !== i) t.swap(i, min, 'Move the smallest remaining value into position ' + i + '.');
      t.mark([i], 'Position ' + i + ' now holds its final value.');
    }
    t.mark([t.length - 1], 'The last remaining value is also in its final position.');
  }
});
