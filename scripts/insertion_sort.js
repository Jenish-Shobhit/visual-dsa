/* Insertion sort moves a held key into an ordered prefix. */
SortLab.register('insertion', {
  title: 'Insertion sort',
  idea: 'Take the next value and slide larger values right until there is room for it.',
  invariant: 'The left prefix is sorted after each insertion, but its values are not necessarily final yet.',
  best: 'Θ(n)', average: 'Θ(n²)', worst: 'Θ(n²)', space: 'O(1)', stable: 'Yes',
  detail: 'A sorted input needs only one comparison per new value. Equal values stay in their original order.',
  sort: function (t) {
    for (var i = 1; i < t.length; i++) {
      var key = t.at(i);
      t.lift(i, 'Hold ' + key.value + ' from position ' + i + '; this leaves a gap.');
      var j = i - 1;
      while (j >= 0) {
        var cmp = t.compareItems(t.at(j), key, 'Is ' + t.at(j).value + ' greater than the held ' + key.value + '?', [j, j + 1]);
        if (cmp <= 0) break;
        t.move(j, j + 1, 'Slide ' + t.at(j).value + ' one place right, moving the gap left.');
        j--;
      }
      t.write(j + 1, key, 'Put the held value into the open position ' + (j + 1) + '.');
      t.release('Positions 0 through ' + i + ' are sorted relative to each other.', []);
    }
  }
});
