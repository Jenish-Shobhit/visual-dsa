/* Pure trace model. Each frame is the state after its highlighted operation. */
(function (root) {
  'use strict';
  function binarySearchTrace(values, target) {
    var low = 0, high = values.length - 1, comparisons = 0, frames = [];
    function record(mid, line, caption, result) {
      frames.push({low:low, high:high, mid:mid, line:line, comparisons:comparisons, result:result == null ? null : result, caption:caption});
    }
    record(-1, 0, 'The values are sorted. Instead of checking each one, start in the middle.');
    while (low <= high) {
      var mid = low + Math.floor((high - low) / 2);
      comparisons++;
      record(mid, 2, 'Inspect index '+mid+': its value is '+values[mid]+'. Compare it with '+target+'.');
      if (values[mid] === target) {
        record(mid, 3, 'Found '+target+' at index '+mid+' in '+comparisons+' comparison'+(comparisons === 1 ? '' : 's')+'. Sorted order let us skip the other candidates.', mid);
        return frames;
      }
      if (values[mid] < target) {
        low = mid + 1;
        record(-1, 4, values[mid]+' is smaller than '+target+'. Everything at or left of index '+mid+' is too small. Keep only the right side.');
      } else {
        high = mid - 1;
        record(-1, 5, values[mid]+' is larger than '+target+'. Everything at or right of index '+mid+' is too large. Keep only the left side.');
      }
    }
    record(-1, 6, 'No possible positions remain. '+target+' is absent: the insertion gap lies between the values we ruled out.', -1);
    return frames;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = binarySearchTrace;
  else root.binarySearchTrace = binarySearchTrace;
}(typeof window !== 'undefined' ? window : this));
