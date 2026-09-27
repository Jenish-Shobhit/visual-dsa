/* Merge sort chooses the left item on ties, preserving duplicate order. */
SortLab.register('merge', {
  title: 'Merge sort',
  idea: 'Sort two halves, then repeatedly take the smaller front value into the combined run.',
  invariant: 'Each finished run is sorted internally; its values may move in a later merge.',
  best: 'Θ(n log n)', average: 'Θ(n log n)', worst: 'Θ(n log n)', space: 'O(n)', stable: 'Yes',
  detail: 'The temporary work arrays use linear extra space. On a tie, take from the left first.',
  sort: function (t) {
    function merge(lo, mid, hi) {
      var left = t.slice(lo, mid + 1);
      var right = t.slice(mid + 1, hi + 1);
      var a = 0, b = 0, out = lo;
      t.note('Merge sorted runs ' + lo + '–' + mid + ' and ' + (mid + 1) + '–' + hi + '. Values are copied to work arrays.', []);
      while (a < left.length && b < right.length) {
        var cmp = t.compareItems(left[a], right[b], 'Compare work-array fronts ' + left[a].value + ' and ' + right[b].value + '.', []);
        var chosen = cmp <= 0 ? left[a++] : right[b++];
        t.write(out, chosen, 'Write ' + chosen.value + ' into position ' + out + ' of the merged run.');
        out++;
      }
      while (a < left.length) {
        t.write(out, left[a], 'Copy the remaining left value ' + left[a].value + ' to position ' + out + '.');
        a++; out++;
      }
      while (b < right.length) {
        t.write(out, right[b], 'Copy the remaining right value ' + right[b].value + ' to position ' + out + '.');
        b++; out++;
      }
      t.note('Positions ' + lo + '–' + hi + ' form one sorted run. A later merge may still move them.', []);
    }
    function sort(lo, hi) {
      if (lo >= hi) return;
      var mid = Math.floor((lo + hi) / 2);
      t.note('Split positions ' + lo + '–' + hi + ' after ' + mid + '.', []);
      sort(lo, mid);
      sort(mid + 1, hi);
      merge(lo, mid, hi);
    }
    sort(0, t.length - 1);
  }
});
